import type {Commitment,Plan,State} from './models.ts';
import {today} from './finance.ts';
export type FinancialStatus='pending'|'upcoming'|'today'|'overdue'|'partial'|'completed';
export const financialLabels:Record<FinancialStatus,string>={pending:'Pendente',upcoming:'A vencer',today:'Vence hoje',overdue:'Atrasado',partial:'Parcialmente pago',completed:'Concluído'};
// Vencimento tem precedência sobre pagamento parcial; o progresso permanece visível separadamente.
export function financialStatus(original:number,paid:number,due?:string|null,date=today()):FinancialStatus{if(original-paid<=0)return 'completed';if(due&&due<date)return 'overdue';if(due===date)return 'today';if(paid>0)return 'partial';return due?'upcoming':'pending';}
export const commitmentId=(c:Commitment)=>c.publicId??`COMP-${c.createdAt.slice(0,4)}-${c.id.toUpperCase()}`;
export function commitmentType(state:State,c:Commitment){const contact=state.contacts?.find(p=>p.id===c.contactId);return c.counterpartyType??(contact?.memberId?'collaborator':contact?.type)??'supplier';}
const normalize=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function matches(query:string,...values:unknown[]){const text=normalize(values.flat(Infinity).join(' '));return normalize(query).trim().split(/\s+/).every(term=>text.includes(term));}
export const searchDate=(date?:string|null)=>date?[date,date.slice(0,10).split('-').reverse().join('/')]:[];
export function searchCommitment(state:State,c:Commitment,query:string,date=today()){return matches(query,c.supplier,c.id,commitmentId(c),c.status,financialLabels[financialStatus(c.original,c.paid,c.due,date)],searchDate(c.due),searchDate(c.createdAt),c.timeline?.map(e=>[e.reason,e.type]),c.renegotiations?.map(r=>[r.reason,r.status]),commitmentType(state,c)==='collaborator'?'colaborador':'fornecedor',proposalStates(state,c).map(s=>({waiting:'aguardando resposta pendente',accepted:'aceita aceito',refused:'recusada recusado',changed:'alterada alterado'}[s]??s)));}
export function proposalStates(state:State,c:Commitment){const all=new Set<string>();for(const i of state.invitations??[])if(i.commitmentId===c.id)all.add(i.state);if(c.status==='awaiting_acceptance')all.add('waiting');if(c.status==='cancelled')all.add('refused');if(c.supplierAcceptedAt||c.legacyAcceptance)all.add('accepted');for(const r of c.renegotiations??[]){if(r.status==='refused')all.add('refused');if(r.status==='accepted')all.add('changed');if(r.status==='pending')all.add('waiting');}return [...all];}
export interface CommitmentFilters {type?:string;status?:string;proposal?:string;period?:string;from?:string;to?:string;query?:string;dateField?:string}
export function filterCommitments(state:State,filters:CommitmentFilters,date=today()){
 let from=filters.from,to=filters.to;
 if(filters.period==='today'){from=date;to=date;}if(filters.period==='month'){from=date.slice(0,7)+'-01';to=date.slice(0,7)+'-31';}
 if(filters.period==='week'){const day=new Date(date+'T12:00:00Z');const offset=(day.getUTCDay()+6)%7;day.setUTCDate(day.getUTCDate()-offset);from=day.toISOString().slice(0,10);day.setUTCDate(day.getUTCDate()+6);to=day.toISOString().slice(0,10);}
 const within=(d:string)=>!!d&&(!from||d>=from)&&(!to||d<=to);
 const byDate=(c:Commitment)=>{if(!from&&!to)return true;if(filters.dateField==='created')return within(c.createdAt);if(filters.dateField==='proposal'){const dates=(state.invitations??[]).filter(i=>i.commitmentId===c.id&&(!filters.proposal||i.state===filters.proposal)).map(i=>(i.decidedAt??i.createdAt).slice(0,10));for(const r of c.renegotiations??[])if(!filters.proposal||r.status===filters.proposal||(filters.proposal==='changed'&&r.status==='accepted'))dates.push((r.decidedAt??r.requestedAt).slice(0,10));for(const e of c.timeline??[])if(!filters.proposal||filters.proposal==='refused'&&['refused','renegotiation_refused'].includes(e.type)||filters.proposal==='accepted'&&e.type==='accepted')dates.push(e.at.slice(0,10));return dates.some(within);}return within(c.due);};
 return state.commitments.filter(c=>!c.demo&&(!filters.type||commitmentType(state,c)===filters.type)&&(!filters.status||(filters.status==='pending'?c.original>c.paid:filters.status==='partial'?c.paid>0&&c.original>c.paid:financialStatus(c.original,c.paid,c.due,date)===filters.status))&&(!filters.proposal||proposalStates(state,c).includes(filters.proposal))&&byDate(c)&&searchCommitment(state,c,filters.query??'',date));
}
export const planStatus=(p:Plan,date=today())=>financialStatus(p.target??p.amount,p.kind==='account'?p.accountPaid??0:p.amount,p.targetDate,date);
export const planStatusLabel=(p:Plan)=>p.kind!=='account'&&planStatus(p)==='partial'?'Em progresso':financialLabels[planStatus(p)];
