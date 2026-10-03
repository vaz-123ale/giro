import {requireDistributionCapacity} from '../src/domain/capacity.ts';
import {randomUUID,randomBytes} from 'node:crypto';
import type {Commitment,Invitation,State} from '../src/domain/models.ts';
import {allocationDisclosure} from '../src/domain/consent.ts';
import {createCommitment} from './financial-service.ts';
import {decideAgreement,decideRenegotiation,requestRenegotiation,submitDraft,terms} from './agreement-service.ts';
import {inputRecord} from './input.ts';
import {notificationFeed} from '../src/domain/notifications.ts';
import {commitmentId} from '../src/domain/records.ts';

export function createContact(state:State,value:unknown){
 const input=inputRecord(value);
 if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120)throw Error('Informe um nome de até 120 caracteres.');
 if(input.phone!==undefined&&(typeof input.phone!=='string'||input.phone.length>30))throw Error('Celular deve ter até 30 caracteres.');
 if(input.note!==undefined&&(typeof input.note!=='string'||input.note.length>500))throw Error('Observação deve ter até 500 caracteres.');
 if(input.type!==undefined&&!['supplier','collaborator','other'].includes(String(input.type)))throw Error('Tipo de contato invalido.');if(input.memberId!==undefined&&(!state.members.some(m=>m.id===input.memberId)||state.contacts?.some(c=>c.memberId===input.memberId)))throw Error('Colaborador inexistente ou ja vinculado.');const contact={type:input.type as 'supplier'|'collaborator'|'other'|undefined,memberId:input.memberId as string|undefined,id:randomUUID(),name:input.name.trim(),phone:input.phone as string|undefined,note:input.note as string|undefined,createdAt:new Date().toISOString()};
 (state.contacts??=[]).push(contact);if(contact.memberId)state.members.find(m=>m.id===contact.memberId)!.contactId=contact.id;return contact;
}
function notify(state:State,c:Commitment,message:string,invitationId?:string){(state.notifications??=[]).unshift({id:randomUUID(),commitmentId:c.id,invitationId,message:commitmentId(c)+' · '+message,type:message.includes('aceitou')?'SUCCESS' as const:message.includes('recusou')?'INFO' as const:'ACTION_REQUIRED' as const,recipientId:'local-owner',createdAt:new Date().toISOString()});}
function issue(state:State,c:Commitment,kind:Invitation['kind'],proposalId?:string){
 if(state.invitations?.some(i=>i.commitmentId===c.id&&i.kind===kind&&i.proposalId===proposalId&&i.state==='waiting'))throw Error('Este pedido já possui convite.');
 const proposal=c.renegotiations?.find(r=>r.id===proposalId);
 const next=proposal?.next??terms(c);requireDistributionCapacity(state,{rateBps:next.rateBps},c.id);const at=new Date().toISOString();
 const invitation:Invitation={publicId:commitmentId(c),senderId:'local-owner',recipientId:c.contactId??'agreement:'+c.id,id:randomUUID(),token:randomBytes(24).toString('hex'),commitmentId:c.id,contactId:c.contactId,recipient:c.supplier,kind,proposalId,version:c.version??1,terms:structuredClone(next),previous:proposal?structuredClone(proposal.previous):undefined,state:'waiting',createdAt:at,disclosure:allocationDisclosure(state,next,c.id).text,sellerAcknowledgedAt:at,authentication:'local_simulation'};
 (state.invitations??=[]).unshift(invitation);notify(state,c,kind==='change'?`Pedido de mudança enviado para ${c.supplier}.`:`Pedido enviado para ${c.supplier}.`,invitation.id);return invitation;
}
function resolveContact(state:State,id:unknown){
 if(typeof id==='string'&&id.startsWith('member:')){const m=state.members.find(m=>m.id===id.slice(7)&&!m.demo&&!m.disabledAt);if(!m)throw Error('Colaborador indisponível.');const existing=state.contacts?.find(c=>c.id===m.contactId||c.memberId===m.id);if(existing){existing.type='collaborator';return existing;}return createContact(state,{name:m.name,type:'collaborator',memberId:m.id});}
 return state.contacts?.find(c=>c.id===id);
}
export function sendInvitation(state:State,value:unknown){
 const input=inputRecord(value);if(input.acknowledged!==true)throw Error('Confirme que entendeu as condições e o limite disponível.');
 if(input.id){const c=state.commitments.find(c=>c.id===input.id&&!c.demo);if(!c)throw Error('Compromisso não encontrado.');
  if(c.status==='draft')submitDraft(state,{id:c.id,actor:'seller'});
  if(c.status!=='awaiting_acceptance')throw Error('O compromisso não aguarda resposta.');return issue(state,c,'agreement');
 }
 const contact=resolveContact(state,input.contactId);if(!contact)throw Error('Selecione uma pessoa cadastrada.');
 const c=createCommitment(state,{...input,supplier:contact.name,status:'awaiting_acceptance'});c.contactId=contact.id;c.counterpartyType=contact.type??'supplier';return issue(state,c,'agreement');
}
export function saveContactDraft(state:State,value:unknown){
 const input=inputRecord(value);const contact=resolveContact(state,input.contactId);if(!contact)throw Error('Selecione uma pessoa cadastrada.');
 const c=createCommitment(state,{...input,supplier:contact.name,status:'draft'});c.contactId=contact.id;c.counterpartyType=contact.type??'supplier';return c;
}
export function sendChangeInvitation(state:State,value:unknown){
 const input=inputRecord(value);if(input.acknowledged!==true)throw Error('Confirme as condições propostas e o limite disponível.');
 requestRenegotiation(state,{...input,actor:'seller'});
 const c=state.commitments.find(c=>c.id===input.id)!;const proposal=c.renegotiations!.at(-1)!;return issue(state,c,'change',proposal.id);
}
export function inviteExistingChange(state:State,value:unknown){
 const input=inputRecord(value);if(input.acknowledged!==true)throw Error('Confirme as condições propostas e o limite disponível.');
 const c=state.commitments.find(c=>c.id===input.id&&!c.demo);const proposal=c?.renegotiations?.find(r=>r.id===input.proposalId&&r.status==='pending'&&r.requester==='seller');
 if(!c||!proposal||c.status!=='active'||proposal.version!==(c.version??1))throw Error('Pedido de mudança não está disponível.');return issue(state,c,'change',proposal.id);
}
/** Projection deliberately excludes sales, cash, other contacts and the merchant panel. Token is a local capability, not identity proof. */
export function invitationView(state:State,token:string){
 const i=state.invitations?.find(i=>i.token===token);if(!i)throw Error('Convite não encontrado.');
 const c=state.commitments.find(c=>c.id===i.commitmentId);if(!c)throw Error('Compromisso não encontrado.');
 const proposal=c.renegotiations?.find(r=>r.id===i.proposalId);
 const actionable=i.state==='waiting'&&i.version===(c.version??1)&&(i.kind==='agreement'?c.status==='awaiting_acceptance':c.status==='active'&&proposal?.status==='pending');
 return {publicId:commitmentId(c),paid:c.paid,remaining:c.original-c.paid,recipient:i.recipient,kind:i.kind,terms:i.terms,previous:i.previous,state:i.state,createdAt:i.createdAt,decidedAt:i.decidedAt,disclosure:i.disclosure,currentDisclosure:allocationDisclosure(state,i.terms,c.id).text,actionable,authentication:i.authentication,currentTerms:terms(c),history:c.timeline,changes:c.renegotiations,canRequestChange:i.state==='accepted'&&c.status==='active'&&!c.renegotiations?.some(r=>r.status==='pending')};
}
export function supplierChange(state:State,value:unknown){
 const input=inputRecord(value);if(typeof input.token!=='string'||!invitationView(state,input.token).canRequestChange)throw Error('Este convite não permite pedir uma mudança agora.');
 if(input.acknowledged!==true)throw Error('Revise e confirme as condições propostas.');
 const i=state.invitations!.find(i=>i.token===input.token)!;const c=state.commitments.find(c=>c.id===i.commitmentId)!;
 requestRenegotiation(state,{...input,id:c.id,actor:'supplier'});notify(state,c,`${c.supplier} pediu uma mudança. Revise o atual e o proposto em Pedidos de alteração.`,i.id);
}
export function decideInvitation(state:State,value:unknown){
 const input=inputRecord(value);if(typeof input.token!=='string')throw Error('Convite inválido.');
 const view=invitationView(state,input.token);if(!view.actionable)throw Error('Este convite já foi respondido ou deixou de valer.');
 if(input.decision==='accept'&&input.acknowledged!==true)throw Error('Confirme que entendeu a prioridade e o limite disponível.');
 const i=state.invitations!.find(i=>i.token===input.token)!;const c=state.commitments.find(c=>c.id===i.commitmentId)!;
 if(i.kind==='agreement')decideAgreement(state,{id:c.id,actor:'supplier',decision:input.decision});
 else decideRenegotiation(state,{id:c.id,proposalId:i.proposalId,actor:'supplier',decision:input.decision});
 i.state=input.decision==='accept'?'accepted':'refused';i.decidedAt=new Date().toISOString();
 if(i.state==='accepted'){i.recipientAcknowledgedAt=i.decidedAt;i.acceptedDisclosure=view.currentDisclosure;}
 notify(state,c,`${c.supplier} ${i.state==='accepted'?'aceitou':'recusou'} ${i.kind==='change'?'o pedido de mudança':'o compromisso'}. Confirmação simulada localmente.`,i.id);
}
export function readNotification(state:State,value:unknown){const input=inputRecord(value);let n=state.notifications?.find(n=>n.id===input.id);if(!n){n=notificationFeed(state).find(n=>n.id===input.id);if(n)(state.notifications??=[]).push(n);}if(!n)throw Error('Notificação não encontrada.');n.readAt??=new Date().toISOString();}
