import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChainError,GiroAcordosModel,isoToTs,share,type ChainErrorCode,type ChainTerms} from '../src/domain/chain-model.ts';
import {MINT,NOW,PAYER,SELLER,parityVectors} from './chain-parity-fixture.ts';

/**
 * Fase 1 do plano Solana: o modelo de referência do programa "giro_acordos" (mesmas regras do Rust)
 * precisa dar EXATAMENTE o mesmo resultado do motor local, centavo por centavo.
 * Os mesmos vetores viram teste do programa Rust: npm run solana:vetores → solana/programs/giro_acordos/src/paridade_vetores.rs
 */
const terms=(original:number,rateBps:number,priority=1,due='2099-12-31'):ChainTerms=>({original:BigInt(original),rateBps,priority,dueTs:isoToTs(due)});
const throwsCode=(fn:()=>unknown,code:ChainErrorCode)=>assert.throws(fn,(e:unknown)=>e instanceof ChainError&&e.code===code,code);

test('PARIDADE: 400 cenários aleatórios (até 5 vendas cada) — rede == calculateDistribution(), centavo por centavo',()=>{
 const v=parityVectors(400);const compared=v.filter(x=>x.expected).length,refused=v.filter(x=>x.expected===null).length;
 assert.ok(compared>=800,`vendas comparadas: ${compared}`);assert.ok(refused>0,'cenários de recusa também foram exercitados');
});

function setup(){
 const m=new GiroAcordosModel();
 const joao=m.propose(SELLER,{seller:SELLER,supplier:'Joao',mint:MINT,agreementKey:'kj',terms:terms(60000,2000),paidBefore:0n,now:NOW});m.accept('Joao',SELLER,'kj',NOW);
 return {m,joao,sale:(amount:number,extra:Partial<Parameters<GiroAcordosModel['settleSale']>[1]>={})=>{m.mintTo(PAYER,BigInt(amount));return m.settleSale(PAYER,{payer:PAYER,seller:SELLER,mint:MINT,amount:BigInt(amount),now:NOW,fixed:[],percent:[{to:'Pedro',rateBps:800}],agreements:[{agreementKey:'kj',supplierTokenOwner:'Joao'}],...extra});}};
}

test('Documento: venda de R$ 100 → R$ 20 João, R$ 8 Pedro, R$ 72 Maria; saldo do acordo 600 → 580',()=>{
 const {m,joao,sale}=setup();const t=sale(10000);
 assert.deepEqual(t.map(x=>[x.to,Number(x.amount)]),[['Pedro',800],['Joao',2000],[SELLER,7200]]);
 assert.equal(joao.original-joao.paid,58000n);assert.equal(m.balance('Joao'),2000n);assert.equal(m.balance(PAYER),0n);
});
test('Nunca destina mais do que falta: faltam R$ 3 → transfere R$ 3 e conclui; venda seguinte não desconta',()=>{
 const {m,joao,sale}=setup();joao.paid=59700n;const t=sale(10000);
 assert.equal(t.find(x=>x.kind==='agreement')!.amount,300n);assert.equal(joao.status,'completed');assert.equal(m.sellers.get(SELLER)!.committedBps,0);
 assert.equal(sale(10000,{agreements:[]}).some(x=>x.kind==='agreement'),false);
});
test('Prioridade: acordo de prioridade 1 recebe antes; ordem errada é recusada',()=>{
 const {m,sale}=setup();m.propose(SELLER,{seller:SELLER,supplier:'Ana',mint:MINT,agreementKey:'ka',terms:terms(1000,1000,2),paidBefore:0n,now:NOW});m.accept('Ana',SELLER,'ka',NOW);
 throwsCode(()=>sale(10000,{agreements:[{agreementKey:'ka',supplierTokenOwner:'Ana'},{agreementKey:'kj',supplierTokenOwner:'Joao'}]}),'WrongOrder');
 const t=sale(10000,{agreements:[{agreementKey:'kj',supplierTokenOwner:'Joao'},{agreementKey:'ka',supplierTokenOwner:'Ana'}]});
 assert.deepEqual(t.filter(x=>x.kind==='agreement').map(x=>x.to),['Joao','Ana']);
});
test('Empate (mesma prioridade e data) aceita a ordem do GIRO nos dois sentidos',()=>{
 const {m,sale}=setup();m.propose(SELLER,{seller:SELLER,supplier:'Ana',mint:MINT,agreementKey:'ka',terms:terms(100000,1000,1),paidBefore:0n,now:NOW});m.accept('Ana',SELLER,'ka',NOW);
 const both=[{agreementKey:'kj',supplierTokenOwner:'Joao'},{agreementKey:'ka',supplierTokenOwner:'Ana'}];
 assert.doesNotThrow(()=>sale(10000,{agreements:both}));assert.doesNotThrow(()=>sale(10000,{agreements:[...both].reverse()}));
});
test('Capacidade: soma dos % reservados (propostos + ativos) nunca passa de 100%',()=>{
 const {m}=setup();throwsCode(()=>m.propose(SELLER,{seller:SELLER,supplier:'Ana',mint:MINT,agreementKey:'ka',terms:terms(1000,8001),paidBefore:0n,now:NOW}),'CapacityExceeded');
 m.propose(SELLER,{seller:SELLER,supplier:'Ana',mint:MINT,agreementKey:'ka',terms:terms(1000,8000),paidBefore:0n,now:NOW});assert.equal(m.sellers.get(SELLER)!.committedBps,10000);
 m.reject('Ana',SELLER,'ka');assert.equal(m.sellers.get(SELLER)!.committedBps,2000);
});
test('Aceite das duas partes: só o vendedor propõe, só o fornecedor aceita/recusa, cancelamento só antes do aceite',()=>{
 const m=new GiroAcordosModel();const p={seller:SELLER,supplier:'Joao',mint:MINT,agreementKey:'k',terms:terms(1000,1000),paidBefore:0n,now:NOW};
 throwsCode(()=>m.propose('Joao',p),'Unauthorized');throwsCode(()=>m.propose(SELLER,{...p,supplier:SELLER}),'InvalidTerms');
 m.propose(SELLER,p);throwsCode(()=>m.propose(SELLER,p),'AlreadyExists');
 throwsCode(()=>m.accept(SELLER,SELLER,'k',NOW),'Unauthorized');throwsCode(()=>m.cancelProposal('Joao',SELLER,'k'),'Unauthorized');
 m.accept('Joao',SELLER,'k',NOW);throwsCode(()=>m.cancelProposal(SELLER,SELLER,'k'),'InvalidStatus');throwsCode(()=>m.reject('Joao',SELLER,'k'),'InvalidStatus');
});
test('Mudança só vale com decisão da OUTRA parte; não pode fabricar quitação; uma por vez',()=>{
 const {m,joao}=setup();joao.paid=10000n;
 throwsCode(()=>m.proposeChange('Pedro',SELLER,'kj',terms(60000,1000)),'Unauthorized');
 throwsCode(()=>m.proposeChange(SELLER,SELLER,'kj',terms(10000,1000)),'InvalidTerms');
 m.proposeChange('Joao',SELLER,'kj',terms(50000,3000,1));throwsCode(()=>m.proposeChange(SELLER,SELLER,'kj',terms(50000,1000)),'ChangePending');
 throwsCode(()=>m.decideChange('Joao',SELLER,'kj',true),'Unauthorized');assert.equal(m.sellers.get(SELLER)!.committedBps,3000,'reserva o aumento enquanto pendente');
 m.decideChange(SELLER,SELLER,'kj',true);assert.equal(joao.version,2);assert.equal(joao.rateBps,3000);assert.equal(joao.original,50000n);assert.equal(m.sellers.get(SELLER)!.committedBps,3000);
 m.proposeChange(SELLER,SELLER,'kj',terms(50000,5000));m.decideChange('Joao',SELLER,'kj',false);assert.equal(joao.version,2);assert.equal(m.sellers.get(SELLER)!.committedBps,3000);
 throwsCode(()=>m.decideChange('Joao',SELLER,'kj',true),'NoPendingChange');
});
test('Dinheiro físico em dois passos: só o vendedor registra, só o fornecedor confirma; saldo só baixa na confirmação',()=>{
 const {m,joao}=setup();
 throwsCode(()=>m.recordOffchainPayment('Joao',SELLER,'kj',1000n,'n1',NOW),'Unauthorized');
 throwsCode(()=>m.recordOffchainPayment(SELLER,SELLER,'kj',60001n,'n1',NOW),'ExceedsRemaining');throwsCode(()=>m.recordOffchainPayment(SELLER,SELLER,'kj',0n,'n1',NOW),'AmountZero');
 m.recordOffchainPayment(SELLER,SELLER,'kj',1000n,'n1',NOW);assert.equal(joao.paid,0n,'registro do vendedor não baixa o saldo');
 throwsCode(()=>m.recordOffchainPayment(SELLER,SELLER,'kj',1000n,'n1',NOW),'NonceUsed');
 throwsCode(()=>m.confirmOffchainPayment(SELLER,SELLER,'kj','n1',NOW),'Unauthorized');
 m.confirmOffchainPayment('Joao',SELLER,'kj','n1',NOW);assert.equal(joao.paid,1000n);throwsCode(()=>m.confirmOffchainPayment('Joao',SELLER,'kj','n1',NOW),'InvalidStatus');
 m.recordOffchainPayment(SELLER,SELLER,'kj',5000n,'n2',NOW);m.disputeOffchainPayment('Joao',SELLER,'kj','n2',NOW);assert.equal(joao.paid,1000n,'contestado não baixa');
 m.recordOffchainPayment(SELLER,SELLER,'kj',59000n,'n3',NOW);m.confirmOffchainPayment('Joao',SELLER,'kj','n3',NOW);assert.equal(joao.status,'completed');
 throwsCode(()=>m.recordOffchainPayment(SELLER,SELLER,'kj',1n,'n4',NOW),'InvalidStatus');
});
test('BRZ (4 casas): divisão em unidades do token arredonda em centavos e respeita o teto por venda',()=>{
 const m=new GiroAcordosModel();m.registerSeller(SELLER,SELLER,100n,500_000n);
 throwsCode(()=>m.propose(SELLER,{seller:SELLER,supplier:'Joao',mint:MINT,agreementKey:'kj',terms:terms(6_000_050,2000),paidBefore:0n,now:NOW}),'InvalidUnit');
 m.propose(SELLER,{seller:SELLER,supplier:'Joao',mint:MINT,agreementKey:'kj',terms:terms(6_000_000,2000),paidBefore:0n,now:NOW});m.accept('Joao',SELLER,'kj',NOW);
 const base={payer:PAYER,seller:SELLER,mint:MINT,now:NOW,fixed:[],percent:[{to:'Pedro',rateBps:800}],agreements:[{agreementKey:'kj',supplierTokenOwner:'Joao'}]};m.mintTo(PAYER,10n**9n);
 // R$ 0,33 = 3300 unidades: 8% = 2,64 centavos → 2 centavos (200); 20% = 6,6 → 6 centavos (600). Igual ao GIRO em centavos.
 const t=m.settleSale(PAYER,{...base,amount:3300n});assert.deepEqual(t.map(x=>Number(x.amount)),[200,600,2500]);
 throwsCode(()=>m.settleSale(PAYER,{...base,amount:3301n}),'InvalidUnit');throwsCode(()=>m.settleSale(PAYER,{...base,amount:500_100n}),'SaleLimit');
 m.setLimits(SELLER,SELLER,0n);assert.doesNotThrow(()=>m.settleSale(PAYER,{...base,amount:500_100n}));
 throwsCode(()=>m.setLimits('Joao',SELLER,1n),'Unauthorized');
});
test('Segurança settle_sale: assinatura, valor zero, overflow, acordo omitido/duplicado/trocado, mint e vendedor errados',()=>{
 const {m,sale}=setup();m.propose('Outro',{seller:'Outro',supplier:'Joao',mint:MINT,agreementKey:'ko',terms:terms(1000,1000),paidBefore:0n,now:NOW});m.accept('Joao','Outro','ko',NOW);
 m.propose(SELLER,{seller:SELLER,supplier:'Ana',mint:'OUTRO',agreementKey:'km',terms:terms(1000,1000,2),paidBefore:0n,now:NOW});
 const base={payer:PAYER,seller:SELLER,mint:MINT,amount:1000n,now:NOW,fixed:[],percent:[],agreements:[{agreementKey:'kj',supplierTokenOwner:'Joao'}]};m.mintTo(PAYER,10n**6n);
 throwsCode(()=>m.settleSale('Joao',base),'Unauthorized');throwsCode(()=>sale(0),'AmountZero');
 throwsCode(()=>m.settleSale(PAYER,{...base,amount:1n<<64n}),'Overflow');
 throwsCode(()=>m.settleSale(PAYER,{...base,agreements:[]}),'MissingAgreement');
 throwsCode(()=>m.settleSale(PAYER,{...base,agreements:[{agreementKey:'kj',supplierTokenOwner:'Ladrao'}]}),'WrongSupplierAccount');
 throwsCode(()=>m.settleSale(PAYER,{...base,agreements:[{agreementKey:'ko',supplierTokenOwner:'Joao'}]}),'MissingAgreement');
 m.accept('Ana',SELLER,'km',NOW);
 throwsCode(()=>m.settleSale(PAYER,{...base,agreements:[base.agreements[0],base.agreements[0]]}),'DuplicateAgreement');
 throwsCode(()=>m.settleSale(PAYER,{...base,agreements:[base.agreements[0],{agreementKey:'km',supplierTokenOwner:'Ana'}]}),'WrongMint');
 throwsCode(()=>m.settleSale(PAYER,{...base,amount:10n**9n}),'InsufficientFunds');
 throwsCode(()=>m.settleSale(PAYER,{...base,fixed:[{to:'a',amount:1n},{to:'b',amount:1n}],percent:[{to:'c',rateBps:1}]}),'TooManyAccounts');
});
test('Segurança: "comissão" que zeraria o fornecedor é recusada (o acordo sempre recebe a parte inteira)',()=>{
 const {m,joao,sale}=setup();
 throwsCode(()=>sale(10000,{percent:[{to:SELLER,rateBps:10000}]}),'CapacityExceeded');
 throwsCode(()=>sale(10000,{fixed:[{to:SELLER,amount:9000n}],percent:[]}),'CapacityExceeded');
 assert.equal(joao.paid,0n);assert.equal(m.balance('Joao'),0n);
});
test('share(): floor(valor × bps / 10000) com intermediário largo, sem perda acima de 2^53',()=>{
 assert.equal(share(9999n,3333),3332n);assert.equal(share((1n<<64n)-1n,10000),(1n<<64n)-1n);assert.equal(share(1n,9999),0n);
});
test('Rede simulada: snapshot/restore preserva tudo e dry-run não altera nada',()=>{
 const {m,sale}=setup();sale(10000);const snap=JSON.stringify(m.snapshot());
 const copy=GiroAcordosModel.restore(JSON.parse(snap));assert.equal(JSON.stringify(copy.snapshot()),snap);assert.equal(copy.agreement(SELLER,'kj')!.paid,2000n);
 const t=m.dryRunSettle(PAYER,{payer:PAYER,seller:SELLER,mint:MINT,amount:5000n,now:NOW,fixed:[],percent:[],agreements:[{agreementKey:'kj',supplierTokenOwner:'Joao'}]});
 assert.equal(t[0].amount,1000n);assert.equal(JSON.stringify(m.snapshot()),snap);
});
