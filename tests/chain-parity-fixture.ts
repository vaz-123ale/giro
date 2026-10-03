import assert from 'node:assert/strict';
import type {Commitment,CommissionRule,Sale} from '../src/domain/models.ts';
import {calculateDistribution} from '../src/domain/finance.ts';
import {ChainError,GiroAcordosModel,isoToTs} from '../src/domain/chain-model.ts';
import {settleInput} from '../src/domain/chain-bridge.ts';

/**
 * Cenários de paridade GIRO × programa. Usado por tests/chain-model.test.ts e por
 * scripts/gerar-vetores-paridade.mjs (vetores para o `cargo test` do programa Rust).
 */
export const SELLER='Vendedor',PAYER='Cliente',MINT='BRLT',NOW=1_790_000_000n;

/** PRNG determinístico (mulberry32): a mesma semente sempre gera os mesmos vetores. */
function rng(seed:number){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}

/** Uma venda na forma que o programa recebe: acordos já na ordem de liquidação, com o restante ANTES da venda. */
export interface ParityVector {amount:number;fixed:number[];percent:number[];agreements:[rateBps:number,remaining:number][];
 /** null = a rede recusa (CapacityExceeded); undefined = a rede aceita mas o GIRO recusaria (sem acordo prejudicado, sem comparação). */
 expected?:{fixed:number[];percent:number[];agreements:number[];seller:number}|null}

function scenario(seed:number){
 const r=rng(seed),int=(a:number,b:number)=>a+Math.floor(r()*(b-a+1));
 const commissions:CommissionRule[]=Array.from({length:int(0,2)},(_,i)=>r()<0.35?{memberId:`m${i}`,name:`m${i}`,rateBps:0,fixedAmount:int(1,3000)}:{memberId:`m${i}`,name:`m${i}`,rateBps:int(0,1500)});
 let budget=10000-commissions.reduce((a,c)=>a+c.rateBps,0);
 const commitments:Commitment[]=Array.from({length:int(0,4)},()=>{const rate=Math.min(budget,int(1,3500));budget-=rate;const original=int(100,200000);
  return {id:Math.floor(r()*0xffffffff).toString(16).padStart(8,'0'),supplier:'x',original,paid:r()<0.3?int(0,original-1):0,rateBps:rate,priority:int(1,3),createdAt:['2026-01-01','2026-01-02'][int(0,1)],due:'2099-12-31',status:'active'} as Commitment;}).filter(c=>c.rateBps>0);
 return {commissions,commitments,sales:Array.from({length:int(1,5)},()=>int(1,r()<0.2?500:300000))};
}

/** Executa um cenário no motor do GIRO e no modelo do programa e confere que são iguais. */
export function runParity(seed:number):ParityVector[]{
 const {commissions,commitments,sales}=scenario(seed);const out:ParityVector[]=[];
 const model=new GiroAcordosModel();const key=(id:string)=>'k'+id;
 for(const c of commitments){model.propose(SELLER,{seller:SELLER,supplier:'F'+c.id,mint:MINT,agreementKey:key(c.id),terms:{original:BigInt(c.original),rateBps:c.rateBps,priority:c.priority,dueTs:isoToTs(c.due)},paidBefore:BigInt(c.paid),now:NOW,createdTs:isoToTs(c.createdAt)});model.accept('F'+c.id,SELLER,key(c.id),NOW);}
 let giro=structuredClone(commitments);
 for(const [n,amount] of sales.entries()){
  const active=giro.filter(c=>c.status==='active');
  const sale:Sale={id:`s${n}`,amount,soldAt:'2026-01-03',paidAt:'2026-01-03',method:'digital',participant:null,commissionBps:0,rules:[],commissions,commitmentRules:active.map(c=>({commitmentId:c.id,supplier:c.supplier,rateBps:c.rateBps,priority:c.priority,createdAt:c.createdAt}))};
  const input=settleInput(model,sale,{seller:SELLER,mint:MINT,payer:PAYER,memberWallet:id=>'W'+id},NOW,key);
  const vector:ParityVector={amount,fixed:input.fixed.map(f=>Number(f.amount)),percent:input.percent.map(p=>p.rateBps),agreements:input.agreements.map(a=>{const x=model.agreement(SELLER,a.agreementKey)!;return [x.rateBps,Number(x.original-x.paid)];})};
  model.mintTo(PAYER,BigInt(amount));
  // O GIRO recusa a venda antes de distribuir quando um destino não caberia inteiro (validateSaleCapacity).
  const fixed=commissions.reduce((a,c)=>a+(c.fixedAmount??0),0),percent=commissions.reduce((a,c)=>a+Math.floor(amount*c.rateBps/10000),0);
  const debts=active.reduce((a,c)=>a+Math.min(Math.floor(amount*c.rateBps/10000),c.original-c.paid),0);
  if(fixed+percent+debts>amount){
   const before=JSON.stringify(model.snapshot().agreements);
   try{model.settleSale(PAYER,input);
    // Rede aceitou: só é admissível se nenhum acordo deixaria de receber (ex.: fixo maior que a venda, sem acordos com parte > 0).
    assert.ok(active.every(c=>Math.min(Math.floor(amount*c.rateBps/10000),c.original-c.paid)===0),`semente ${seed}: rede aceitou venda que prejudicaria acordo`);
   }catch(e){assert.ok(e instanceof ChainError&&e.code==='CapacityExceeded',`semente ${seed}: ${e}`);assert.equal(JSON.stringify(model.snapshot().agreements),before,'falha não altera nada');vector.expected=null;}
   model.balances.set(PAYER,0n);out.push(vector);continue;
  }
  const result=calculateDistribution(sale,giro);giro=result.commitments;
  const transfers=model.settleSale(PAYER,input);
  const g=result.entries.map(e=>[e.kind==='commitment'?'commitment:'+key(e.recipientId):e.kind,e.amount]);
  const c=transfers.map(t=>[t.kind==='agreement'?'commitment:'+t.agreementKey:t.kind==='seller'?'seller':'commission',Number(t.amount)]);
  assert.deepEqual(c,g,`semente ${seed}, venda ${n} (R$ ${amount/100})`);
  for(const x of giro){const a=model.agreement(SELLER,key(x.id))!;assert.equal(Number(a.paid),x.paid,`pago ${x.id}`);assert.equal(a.status==='completed',x.status==='completed',`situação ${x.id}`);}
  assert.equal(model.balance(PAYER),0n,'cliente paga exatamente o valor da venda');
  const commissionParts=result.entries.filter(e=>e.kind==='commission').map(e=>e.amount);
  vector.expected={fixed:commissionParts.slice(0,vector.fixed.length),percent:commissionParts.slice(vector.fixed.length),
   agreements:input.agreements.map(a=>result.entries.find(e=>e.kind==='commitment'&&key(e.recipientId)===a.agreementKey)?.amount??0),seller:result.entries.find(e=>e.kind==='seller')!.amount};
  out.push(vector);
 }
 return out;
}
export const parityVectors=(seeds=400)=>Array.from({length:seeds},(_,i)=>runParity(i+1)).flat();
