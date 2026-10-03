import {requireDistributionCapacity} from '../src/domain/capacity.ts';
import {randomUUID} from 'node:crypto';
import type {Actor,AgreementEvent,AgreementTerms,Commitment,State} from '../src/domain/models.ts';
import {isActive,remaining} from '../src/domain/finance.ts';
import {requireAmount,validDate} from '../src/domain/validation.ts';
import {inputRecord} from './input.ts';

export const terms=(c:Commitment):AgreementTerms=>({original:c.original,rateBps:c.rateBps,priority:c.priority,due:c.due,...(c.paymentMethod?{paymentMethod:c.paymentMethod}:{})});
export function addEvent(c:Commitment,event:Omit<AgreementEvent,'id'|'at'>){(c.timeline??=[]).push({...event,id:randomUUID(),at:new Date().toISOString()});}
function actor(value:unknown):Actor{if(value!=='seller'&&value!=='supplier')throw new Error('Escolha o lado vendedor ou fornecedor da simulação.');return value;}
function find(state:State,id:unknown){const c=state.commitments.find(c=>c.id===id&&!c.demo);if(!c)throw new Error('Compromisso não encontrado.');return c;}
export function validateTerms(value:Record<string,unknown>,paid=0):AgreementTerms{
 requireAmount(value.original);if(value.original<paid)throw new Error('O valor da dívida não pode ser menor que o já pago.');
 if(typeof value.rateBps!=='number'||!Number.isInteger(value.rateBps)||value.rateBps<=0||value.rateBps>10000)throw new Error('Escolha uma porcentagem maior que zero e até 100%.');
 if(typeof value.priority!=='number'||!Number.isInteger(value.priority)||value.priority<1||value.priority>999)throw new Error('Prioridade inválida.');
 if(!validDate(value.due))throw new Error('Vencimento inválido.');
 if(value.paymentMethod!==undefined&&(typeof value.paymentMethod!=='string'||!value.paymentMethod.trim()||value.paymentMethod.length>120))throw Error('Informe uma forma de pagamento de até 120 caracteres.');
 return {original:value.original,rateBps:value.rateBps,priority:value.priority,due:value.due,...(value.paymentMethod?{paymentMethod:String(value.paymentMethod).trim()}:{})};
}
export function initializeAgreement(c:Commitment,draft=false){
 c.originalDue=c.due;c.finalDue=c.due;c.version=1;c.timeline=[];c.renegotiations=[];c.legacyAcceptance=false;
 c.status=draft?'draft':'awaiting_acceptance';addEvent(c,{type:'created',actor:'seller',next:terms(c)});
 if(!draft){c.sellerAcceptedAt=new Date().toISOString();addEvent(c,{type:'submitted',actor:'seller',next:terms(c),sellerAcceptedAt:c.sellerAcceptedAt});}
}
export function submitDraft(state:State,value:unknown){const input=inputRecord(value);const who=actor(input.actor);const c=find(state,input.id);if(who!=='seller'||c.status!=='draft')throw new Error('Somente o vendedor pode enviar um rascunho.');requireDistributionCapacity(state,{rateBps:c.rateBps},c.id);c.status='awaiting_acceptance';c.sellerAcceptedAt=new Date().toISOString();addEvent(c,{type:'submitted',actor:who,next:terms(c),sellerAcceptedAt:c.sellerAcceptedAt});}
export function editDraft(state:State,value:unknown){
 const input=inputRecord(value);const who=actor(input.actor);const c=find(state,input.id);
 if(who!=='seller'||c.status!=='draft')throw new Error('Acordo enviado ou ativo não pode ser alterado unilateralmente. Solicite renegociação.');
 const next=validateTerms(input,c.paid);const previous=terms(c);Object.assign(c,next);c.originalDue=next.due;c.finalDue=next.due;
 addEvent(c,{type:'draft_edited',actor:who,previous,next});
}
export function decideAgreement(state:State,value:unknown){
 const input=inputRecord(value);const who=actor(input.actor);const c=find(state,input.id);
 if(who!=='supplier'||c.status!=='awaiting_acceptance'||!c.sellerAcceptedAt)throw new Error('A proposta precisa aguardar o aceite do fornecedor.');
 if(input.decision!=='accept'&&input.decision!=='refuse')throw new Error('Decisão inválida.');
 if(input.decision==='refuse'){c.status='cancelled';addEvent(c,{type:'refused',actor:who,next:terms(c)});return;}
 requireDistributionCapacity(state,{rateBps:c.rateBps},c.id);c.supplierAcceptedAt=new Date().toISOString();c.activatedAt=c.supplierAcceptedAt;c.status=remaining(c)===0?'completed':'active';
 addEvent(c,{type:'accepted',actor:who,next:terms(c),sellerAcceptedAt:c.sellerAcceptedAt,supplierAcceptedAt:c.supplierAcceptedAt});
 addEvent(c,{type:'activated',actor:'system',next:terms(c)});
 // Saldo informado já zerado não cria uma conclusão pelo motor de receitas.
}
export function requestRenegotiation(state:State,value:unknown){
 const input=inputRecord(value);const who=actor(input.actor);const c=find(state,input.id);
 if(!isActive(c))throw new Error('Somente compromissos ativos podem ser renegociados.');
 if(c.renegotiations?.some(r=>r.status==='pending'))throw new Error('Já existe uma proposta aguardando resposta.');
 const next=validateTerms({...input,paymentMethod:input.paymentMethod??c.paymentMethod},c.paid+(c.cashPending??0));if(next.original<=c.paid)throw new Error('A proposta deve manter saldo a quitar; não pode fabricar quitação.');
 requireDistributionCapacity(state,{rateBps:Math.max(c.rateBps,next.rateBps)},c.id);const previous=terms(c);if(JSON.stringify(previous)===JSON.stringify(next))throw new Error('Informe ao menos uma mudança.');
 if(input.reason!==undefined&&(typeof input.reason!=='string'||input.reason.length>500))throw new Error('O motivo pode ter até 500 caracteres.');
 const at=new Date().toISOString();const consent=who==='seller'?{sellerAcceptedAt:at}:{supplierAcceptedAt:at};
 (c.renegotiations??=[]).push({id:randomUUID(),requester:who,previous,next,version:c.version??1,status:'pending',requestedAt:at,reason:input.reason as string|undefined,...consent});
 addEvent(c,{type:'renegotiation_requested',actor:who,previous,next,reason:input.reason as string|undefined,...consent});
}
export function decideRenegotiation(state:State,value:unknown){
 const input=inputRecord(value);const who=actor(input.actor);const c=find(state,input.id);const proposal=c.renegotiations?.find(r=>r.id===input.proposalId);
 if(!isActive(c)||!proposal||proposal.status!=='pending')throw new Error('Não há proposta ativa aguardando resposta.');
 if(who===proposal.requester)throw new Error('A outra parte precisa decidir a proposta.');
 if(input.decision!=='accept'&&input.decision!=='refuse')throw new Error('Decisão inválida.');
 if(proposal.version!==(c.version??1))throw new Error('A versão do acordo mudou. Solicite uma nova proposta.');
 if(input.decision==='accept'&&proposal.next.original<=c.paid)throw new Error('O saldo mudou desde a solicitação. Recuse e proponha novamente.');
 if(input.decision==='accept'&&proposal.next.original<c.paid+(c.cashPending??0))throw new Error('Existem valores físicos destinados. A proposta não pode apagar essas pendências.');
 if(input.decision==='accept')requireDistributionCapacity(state,{rateBps:proposal.next.rateBps},c.id);
 proposal.status=input.decision==='accept'?'accepted':'refused';proposal.decidedAt=new Date().toISOString();
 if(input.decision==='accept'){
  if(who==='seller')proposal.sellerAcceptedAt=proposal.decidedAt;else proposal.supplierAcceptedAt=proposal.decidedAt;
  Object.assign(c,proposal.next);c.version=(c.version??1)+1;c.finalDue=c.due;
 }
 addEvent(c,{type:input.decision==='accept'?'renegotiation_accepted':'renegotiation_refused',actor:who,previous:proposal.previous,next:proposal.next,reason:proposal.reason,sellerAcceptedAt:proposal.sellerAcceptedAt,supplierAcceptedAt:proposal.supplierAcceptedAt});
}
