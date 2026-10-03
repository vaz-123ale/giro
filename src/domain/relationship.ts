import type {Commitment,State} from './models.ts';
import {financialHistory, type HistoryRow} from './history.ts';
import {today} from './finance.ts';
export function agreementPayments(state:State,c:Commitment){
 let due=c.originalDue??c.due,original=c.original;
 const events=[...(c.timeline??[])].sort((a,b)=>a.at.localeCompare(b.at));
 const valid=events.filter(e=>e.amount!==undefined&&(e.type==='cash_paid'||e.type==='amortized'&&state.sales.find(s=>s.id===e.saleId)?.method!=='cash'));
 let paid=Math.max(0,c.paid-valid.reduce((a,e)=>a+(e.amount??0),0));
 return events.flatMap(e=>{if(e.next&&['created','draft_edited','accepted','renegotiation_accepted'].includes(e.type)){due=e.next.due;original=e.next.original;}if(!valid.includes(e))return [];paid+=e.amount??0;const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(e.at.length===10?e.at+'T12:00:00Z':e.at));return [{id:e.id,at:e.at,amount:e.amount!,due,remaining:Math.max(0,original-paid),timing:due?(date<=due?'on_time':'late'):'unknown',mode:e.type==='cash_paid'?'cash':'simulated'}];});
}
export function workerHistory(state:State,memberId:string):HistoryRow[]{
 const member=state.members.find(m=>m.id===memberId);if(!member)return [];
 const agreementIds=new Set(state.commitments.filter(c=>state.contacts?.some(p=>p.id===c.contactId&&(p.memberId===memberId||p.id===member.contactId))).map(c=>c.id));
 const sales=new Set(state.sales.filter(s=>!s.demo&&(s.participants?.some(p=>p.memberId===memberId)||s.commissions?.some(p=>p.memberId===memberId))).map(s=>s.id));
 const rows=financialHistory(state).filter(r=>r.commitmentId&&agreementIds.has(r.commitmentId)||r.route?.startsWith('equipe/'+memberId+'/')||[...sales].some(id=>r.route==='receber/vendas/'+id||r.route==='receber/pagamentos/'+id));
 for(const shift of state.shifts??[])if(shift.memberId===memberId){rows.push({id:'shift-open:'+shift.id,at:shift.startedAt,category:'Turno',title:'Turno iniciado',description:member.name+' · '+shift.id});if(shift.endedAt)rows.push({id:'shift-close:'+shift.id,at:shift.endedAt,category:'Turno',title:'Turno encerrado',description:member.name+' · '+shift.id});}
 for(const e of state.memberEvents??[])if(e.memberId===memberId&&!rows.some(r=>r.id===e.id))rows.push({id:e.id,at:e.at,category:'Cadastro',title:'Alteração de cadastro',description:e.name+' · '+e.type});
 return rows.sort((a,b)=>b.at.localeCompare(a.at));
}
export function relationshipFacts(state:State,agreements:Commitment[],date=today()){
 const payments=agreements.flatMap(c=>agreementPayments(state,c));
 return {accepted:agreements.filter(c=>c.supplierAcceptedAt).length,completed:agreements.filter(c=>c.original===c.paid).length,overdue:agreements.filter(c=>['active','accepted'].includes(c.status)&&c.original>c.paid&&c.due<date).length,refused:agreements.reduce((a,c)=>a+(c.timeline?.filter(e=>e.type==='refused'||e.type==='renegotiation_refused').length??0),0),changes:agreements.reduce((a,c)=>a+(c.renegotiations?.length??0),0),onTime:payments.filter(p=>p.timing==='on_time').length,late:payments.filter(p=>p.timing==='late').length,cashPaid:payments.filter(p=>p.mode==='cash').reduce((a,p)=>a+p.amount,0),simulated:payments.filter(p=>p.mode==='simulated').reduce((a,p)=>a+p.amount,0)};
}
