import type {DatabaseSync} from 'node:sqlite';
import {ChainError,GiroAcordosModel,dueToTs,isoToTs,type SettleSaleInput} from '../../src/domain/chain-model.ts';
import {orderAgreements} from '../../src/domain/chain-bridge.ts';
import {AttestationError,AttestationModel,GIRO_CREDENTIAL,GIRO_SCHEMA,encodeAttestationData} from '../../src/domain/attestation-model.ts';
import {type AttestTarget,type ChainAdapter,type ChainAgreementView,ChainRuleError,type SalePreview,type SettleEvent,samePreview} from './adapter.ts';
import {type ChainEvent,sha256hex} from './events.ts';
import {readChainState,writeChainState} from './outbox.ts';
import type {TestWallets} from './keys.ts';

const nowTs=()=>BigInt(Math.floor(Date.now()/1000));
export const attestationNonce=(agreementKey:string,recordFingerprint:string)=>sha256hex(`giro-atestado:${agreementKey}:${recordFingerprint}`);

/**
 * REDE SIMULADA (GIRO_SOLANA_CLUSTER=simulado): executa as instruções no modelo de referência do programa
 * (mesmas regras do Rust, conferidas pelo teste de paridade) e no modelo do SAS, guardando tudo no SQLite local.
 * Endereços são chaves ed25519 reais das carteiras de TESTE. Nenhuma conexão de rede é feita.
 * As assinaturas começam com "simulado:" para nunca serem confundidas com transações reais.
 */
export class SimulatedAdapter implements ChainAdapter {
 readonly cluster='simulado' as const;
 private model:GiroAcordosModel;private sas:AttestationModel;private counter:number;
 private readonly db:DatabaseSync;private readonly wallets:TestWallets;
 constructor(db:DatabaseSync,wallets:TestWallets){
  this.db=db;this.wallets=wallets;
  const saved=readChainState(db,'simulado');
  this.model=saved?GiroAcordosModel.restore(saved.model):new GiroAcordosModel();
  this.sas=saved?AttestationModel.restore(saved.sas):new AttestationModel();this.counter=saved?.counter??0;
 }
 address(role:string){return this.wallets.get(role).address;}
 private get seller(){return this.address('vendedor');}
 private get mint(){return this.address('mint-brl-t');}
 private persist(event:unknown){
  this.counter+=1;writeChainState(this.db,'simulado',{model:this.model.snapshot(),sas:this.sas.snapshot(),counter:this.counter});
  return `simulado:${sha256hex(`${this.counter}:${JSON.stringify(event)}`).slice(0,40)}`;
 }
 /** Toda instrução roda numa cópia; só grava se der certo (atomicidade da transação). */
 private run<T>(fn:(m:GiroAcordosModel)=>T){
  const copy=GiroAcordosModel.restore(this.model.snapshot());
  try{const result=fn(copy);this.model=copy;return result;}
  catch(e){if(e instanceof ChainError)throw new ChainRuleError(e.code);throw e;}
 }
 private agreementOf(m:GiroAcordosModel,key:string){const a=m.agreement(this.seller,key);if(!a)throw new ChainRuleError('MissingAgreement');return a;}
 private settleInput(m:GiroAcordosModel,e:SettleEvent):SettleSaleInput{
  return {payer:this.address('cliente'),seller:this.seller,mint:this.mint,amount:BigInt(e.amount),now:nowTs(),
   fixed:e.fixed.map(f=>({to:this.address(f.role),amount:BigInt(f.amount)})),percent:e.percent.map(p=>({to:this.address(p.role),rateBps:p.rateBps})),
   agreements:orderAgreements(m,this.seller,e.agreements).map(a=>({agreementKey:a.agreementKey,supplierTokenOwner:a.supplier}))};
 }
 private preview(m:GiroAcordosModel,e:SettleEvent):SalePreview{
  const input=this.settleInput(m,e);let t;
  try{t=m.dryRunSettle(input.payer,input);}catch(err){if(err instanceof ChainError)throw new ChainRuleError(err.code);throw err;}
  return {commissions:t.filter(x=>x.kind==='fixed'||x.kind==='commission').map(x=>Number(x.amount)),agreements:Object.fromEntries(t.filter(x=>x.kind==='agreement').map(x=>[x.agreementKey!,Number(x.amount)])),seller:Number(t.find(x=>x.kind==='seller')!.amount)};
 }
 async previewSale(e:SettleEvent){return this.preview(this.model,e);}
 async send(e:ChainEvent){
  const seller=this.seller,now=nowTs();
  this.run(m=>{
   switch(e.type){
    case 'register_seller':return m.sellers.has(seller)?undefined:m.registerSeller(seller,seller);
    case 'propose':return m.propose(seller,{seller,supplier:this.address(e.supplierRole),mint:this.mint,agreementKey:e.agreementKey,terms:{original:BigInt(e.terms.original),rateBps:e.terms.rateBps,priority:e.terms.priority,dueTs:dueToTs(e.terms.due)},paidBefore:BigInt(e.paidBefore),now,createdTs:isoToTs(e.createdAt)});
    // Fase local: o servidor assina pelo fornecedor com a carteira de TESTE dele (simulação do aceite no link).
    case 'accept':return m.accept(this.agreementOf(m,e.agreementKey).supplier,seller,e.agreementKey,now);
    case 'reject':return m.reject(this.agreementOf(m,e.agreementKey).supplier,seller,e.agreementKey);
    case 'propose_change':{const a=this.agreementOf(m,e.agreementKey);return m.proposeChange(e.proposer==='seller'?seller:a.supplier,seller,e.agreementKey,{original:BigInt(e.terms.original),rateBps:e.terms.rateBps,priority:e.terms.priority,dueTs:dueToTs(e.terms.due)});}
    case 'decide_change':{const a=this.agreementOf(m,e.agreementKey);const proposer=a.pendingChange?.proposer;return m.decideChange(proposer===seller?a.supplier:seller,seller,e.agreementKey,e.accept);}
    case 'record_offchain_payment':return m.recordOffchainPayment(seller,seller,e.agreementKey,BigInt(e.amount),e.nonce,now);
    // Fase local/simulada: o servidor assina pelo fornecedor com a carteira de TESTE dele (confirmação feita no link).
    case 'confirm_offchain_payment':return m.confirmOffchainPayment(this.agreementOf(m,e.agreementKey).supplier,seller,e.agreementKey,e.nonce,now);
    case 'dispute_offchain_payment':return m.disputeOffchainPayment(this.agreementOf(m,e.agreementKey).supplier,seller,e.agreementKey,e.nonce,now);
    case 'settle_sale':{
     const got=this.preview(m,e);
     if(!samePreview(got,e.expected))throw new ChainRuleError('Divergente',`A rede dividiria diferente do GIRO: rede ${JSON.stringify(got)} × GIRO ${JSON.stringify(e.expected)}.`);
     const input=this.settleInput(m,e);m.mintTo(input.payer,input.amount);/* cliente de TESTE recebe exatamente o valor da venda */return m.settleSale(input.payer,input);
    }
   }
  });
  return this.persist(e);
 }
 async agreements():Promise<ChainAgreementView[]>{
  return [...this.model.agreements.values()].filter(a=>a.seller===this.seller).map(a=>({agreementKey:a.agreementKey,supplier:a.supplier,original:Number(a.original),paid:Number(a.paid),rateBps:a.rateBps,priority:a.priority,dueTs:Number(a.dueTs),status:a.status,version:a.version,pendingChange:!!a.pendingChange}));
 }
 private schemaId(){
  const issuer=this.address('emissor');
  if(!this.sas.credentials.has(GIRO_CREDENTIAL))this.sas.createCredential(issuer,GIRO_CREDENTIAL,[issuer]);
  const id=`${GIRO_CREDENTIAL}/${GIRO_SCHEMA.name}/${GIRO_SCHEMA.version}`;
  if(!this.sas.schemas.has(id))this.sas.createSchema(issuer,GIRO_CREDENTIAL,GIRO_SCHEMA.name,GIRO_SCHEMA.version,GIRO_SCHEMA.fieldNames);return id;
 }
 /** Só atesta acordo que a REDE vê como concluído (o emissor não pode inventar conclusão). */
 async attest(t:AttestTarget){
  const a=this.model.agreement(this.seller,t.agreementKey);if(a?.status!=='completed')throw new ChainRuleError('NotCompleted','O acordo ainda não está concluído na rede.');
  try{this.sas.attest(this.address('emissor'),this.schemaId(),attestationNonce(t.agreementKey,t.recordFingerprint),encodeAttestationData({agreementKey:t.agreementKey,recordHash:t.recordFingerprint,completedAt:isoToTs(t.completedAt),onTime:t.onTime}),nowTs());}
  catch(e){if(e instanceof AttestationError)throw new ChainRuleError(e.code);throw e;}
  return this.persist({attest:t.agreementKey});
 }
 async findAttestation(agreementKey:string,recordFingerprint:string){return this.sas.get(attestationNonce(agreementKey,recordFingerprint),nowTs());}
 async balance(role:string){return this.model.balance(this.address(role));}
}
