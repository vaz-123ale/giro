import {createHash} from 'node:crypto';
import type {AgreementTerms,Commitment,Sale,State} from '../../src/domain/models.ts';
import {commitmentId} from '../../src/domain/records.ts';
import {completedAgreements,completionRecord,type CompletionRecord} from '../../src/domain/proof.ts';
import {roleFor} from './keys.ts';

/**
 * O que a rede precisa saber, derivado da diferença entre o estado antes e depois de cada operação.
 * Os serviços do GIRO não mudam: com a rede desligada este arquivo nem é carregado.
 * Regra 13: só hashes, papéis anônimos (hash do id interno), centavos, bps e datas. Nenhum nome.
 */
export const sha256hex=(text:string)=>createHash('sha256').update(text).digest('hex');
/** Igual a agreementKey() de src/domain/integration.ts, porém síncrono (roda dentro da transação). */
export const agreementKeyOf=(c:Commitment)=>sha256hex('giro-acordo:'+commitmentId(c));
/** Igual a fingerprint() de src/domain/proof.ts, porém síncrono. */
export const fingerprintOf=(record:CompletionRecord)=>sha256hex(JSON.stringify(record));
export const supplierRoleOf=(c:Commitment)=>c.contactId?roleFor('contato',c.contactId):roleFor('acordo',c.id);
export const memberRoleOf=(memberId:string)=>roleFor('membro',memberId);

export interface ChainTermsPayload {original:number;rateBps:number;priority:number;due:string}
export type ChainEvent=
 /** Cadastro do vendedor no programa (redes públicas: assinado pela carteira do negócio). */
 |{type:'register_seller'}
 |{type:'propose';agreementKey:string;supplierRole:string;terms:ChainTermsPayload;paidBefore:number;createdAt:string}
 |{type:'accept'|'reject';agreementKey:string}
 |{type:'propose_change';agreementKey:string;proposer:'seller'|'supplier';terms:ChainTermsPayload}
 |{type:'decide_change';agreementKey:string;accept:boolean}
 |{type:'settle_sale';saleRef:string;amount:number;fixed:{role:string;amount:number}[];percent:{role:string;rateBps:number}[];
   /** Ordem do motor local (prioridade → data → id interno). */ agreements:string[];
   /** Divisão que o GIRO calculou; a rede precisa dar o mesmo resultado (senão: falhou/divergência). */ expected:{commissions:number[];agreements:Record<string,number>;seller:number}}
 /** Dinheiro: o vendedor registra a entrega (assina só ele)… */
 |{type:'record_offchain_payment';agreementKey:string;amount:number;nonce:string}
 /** …e o fornecedor confirma ou contesta (assina só ele). Só a confirmação baixa o saldo. */
 |{type:'confirm_offchain_payment'|'dispute_offchain_payment';agreementKey:string;nonce:string};

const termsOf=(t:AgreementTerms):ChainTermsPayload=>({original:t.original,rateBps:t.rateBps,priority:t.priority,due:t.due});
const onChain=(status?:Commitment['status'])=>!!status&&!['draft'].includes(status);
const accepted=(status?:Commitment['status'])=>['active','accepted','completed'].includes(status??'');

export function proposeEvent(c:Commitment,paidBefore=c.paid):ChainEvent{return {type:'propose',agreementKey:agreementKeyOf(c),supplierRole:supplierRoleOf(c),terms:termsOf(c),paidBefore,createdAt:c.createdAt};}

export function settleEvent(state:State,sale:Sale):ChainEvent{
 const rules=sale.commissions??(sale.participant?[{memberId:sale.participant,name:sale.participant,rateBps:sale.commissionBps}]:[]);
 const keyById=new Map(state.commitments.map(c=>[c.id,agreementKeyOf(c)]));
 const order=[...(sale.commitmentRules??[])].sort((a,b)=>a.priority-b.priority||a.createdAt.localeCompare(b.createdAt)||a.commitmentId.localeCompare(b.commitmentId));
 const entries=sale.distribution??[];
 return {type:'settle_sale',saleRef:sha256hex('giro-venda:'+sale.id),amount:sale.amount,
  fixed:rules.filter(r=>r.fixedAmount!==undefined).map(r=>({role:memberRoleOf(r.memberId),amount:r.fixedAmount!})),
  percent:rules.filter(r=>r.fixedAmount===undefined).map(r=>({role:memberRoleOf(r.memberId),rateBps:r.rateBps})),
  agreements:order.map(r=>keyById.get(r.commitmentId)).filter(k=>k!==undefined),
  expected:{commissions:entries.filter(e=>e.kind==='commission').map(e=>e.amount),
   agreements:Object.fromEntries(entries.filter(e=>e.kind==='commitment'&&e.amount>0).map(e=>[keyById.get(e.recipientId)??e.recipientId,e.amount])),
   seller:entries.find(e=>e.kind==='seller')?.amount??sale.amount}};
}

/** Eventos na ordem em que a rede deve recebê-los: ciclo de vida dos acordos → vendas → dinheiro confirmado. */
export function chainEvents(before:State,after:State):ChainEvent[]{
 const events:ChainEvent[]=[];
 const prev=new Map(before.commitments.map(c=>[c.id,c]));
 // Listas do GIRO guardam o mais novo primeiro: percorre do mais antigo para o mais novo.
 for(const c of [...after.commitments].reverse()){
  if(c.demo)continue;const b=prev.get(c.id);const key=agreementKeyOf(c);
  const newlyProposed=onChain(c.status)&&c.status!=='cancelled'&&!onChain(b?.status);
  if(newlyProposed)events.push(proposeEvent(c,b?.paid??c.paid));
  if(accepted(c.status)&&(newlyProposed||b?.status==='awaiting_acceptance'))events.push({type:'accept',agreementKey:key});
  if(c.status==='cancelled'&&b?.status==='awaiting_acceptance')events.push({type:'reject',agreementKey:key});
  for(const r of c.renegotiations??[]){
   const pr=b?.renegotiations?.find(x=>x.id===r.id);
   if(!pr&&r.status!=='obsolete')events.push({type:'propose_change',agreementKey:key,proposer:r.requester,terms:termsOf(r.next)});
   if((!pr||pr.status==='pending')&&(r.status==='accepted'||r.status==='refused'))events.push({type:'decide_change',agreementKey:key,accept:r.status==='accepted'});
  }
 }
 const settled=new Set(before.sales.filter(s=>s.distribution).map(s=>s.id));
 for(const s of [...after.sales].reverse())if(!s.demo&&s.method==='digital'&&s.distribution&&!settled.has(s.id))events.push(settleEvent(after,s));
 const cashNonce=(paymentId:string)=>sha256hex('giro-dinheiro:'+paymentId).slice(0,32);
 const paidBefore=new Set((before.cashPayments??[]).map(p=>p.id));
 for(const p of [...(after.cashPayments??[])].reverse()){
  if(p.kind!=='supplier'||paidBefore.has(p.id))continue;const c=after.commitments.find(c=>c.id===p.recipientId);
  if(c&&!c.demo)events.push({type:'record_offchain_payment',agreementKey:agreementKeyOf(c),amount:p.amount,nonce:cashNonce(p.id)});
 }
 const decided=new Set((before.receiptConfirmations??[]).filter(r=>r.state!=='waiting').map(r=>r.id));
 for(const r of [...(after.receiptConfirmations??[])].reverse()){
  if(r.kind!=='supplier'||r.state==='waiting'||decided.has(r.id))continue;
  const c=after.commitments.find(c=>c.id===r.recipientId);
  if(c)events.push({type:r.state==='confirmed'?'confirm_offchain_payment':'dispute_offchain_payment',agreementKey:agreementKeyOf(c),nonce:cashNonce(r.paymentId)});
 }
 return events;
}

/** O que seria atestado agora (mesmo conteúdo de attestationPayloads(), síncrono). */
export function attestationTargets(state:State){
 return completedAgreements(state).map(c=>{const r=completionRecord(state,c);return {commitmentId:c.id,agreementKey:agreementKeyOf(c),recordFingerprint:fingerprintOf(r),completedAt:r.completedAt,onTime:r.onTime};});
}
