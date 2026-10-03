import {agreementPayments} from './relationship.ts';
import type {Notification,State} from './models.ts';
import {today} from './finance.ts';
import {commitmentId,financialStatus} from './records.ts';
import {shiftDate} from './intelligence.ts';
export function notificationFeed(state:State,date=today()):Notification[]{
 const rows:Notification[]=[];const add=(key:string,message:string,type:Notification['type'],at:string,extra:Partial<Notification>={})=>{const id='derived:'+key;rows.push({id,dedupeKey:id,message,type,createdAt:state.notifications?.find(n=>n.id===id)?.createdAt??at,...extra,readAt:state.notifications?.find(n=>n.id===id)?.readAt});};
 for(const c of state.commitments.filter(c=>!c.demo)){
  const id=commitmentId(c),status=financialStatus(c.original,c.paid,c.due,date);
  if(['active','accepted'].includes(c.status)&&c.original>c.paid&&c.due<=shiftDate(date,7))add(`due:${c.id}:${date}`,`${id} · ${c.supplier}: ${status==='overdue'?'compromisso atrasado':status==='today'?'compromisso vence hoje':'compromisso vence em breve'} (${c.due}).`,status==='overdue'?'WARNING':'ACTION_REQUIRED',new Date().toISOString(),{commitmentId:c.id});
  for(const e of c.timeline??[])if(['accepted','refused','renegotiation_requested','renegotiation_accepted','renegotiation_refused','completed','cash_paid','amortized'].includes(e.type))add('agreement:'+e.id,`${id} · ${c.supplier}: ${({accepted:'proposta aceita',refused:'proposta recusada',renegotiation_requested:`${e.actor==='supplier'?(c.counterpartyType==='collaborator'?'colaborador':'fornecedor'):'titular'} solicitou alteração`,renegotiation_accepted:'alteração aceita',renegotiation_refused:'alteração recusada',completed:'compromisso quitado',cash_paid:((agreementPayments(state,c).find(p=>p.id===e.id)?.remaining??c.original-c.paid)>0)?'pagamento parcial registrado':'pagamento registrado',amortized:state.sales.find(s=>s.id===e.saleId)?.method==='cash'?'dinheiro destinado; entrega pendente':'distribuição simulada registrada'} as Record<string,string>)[e.type]}.`,e.type.includes('refused')?'INFO':e.type==='renegotiation_requested'?'ACTION_REQUIRED':'SUCCESS',e.at,{commitmentId:c.id});
 }
 for(const p of state.plans.filter(p=>!p.demo&&!p.archivedAt))if(planPending(p)&&p.targetDate&&p.targetDate<=shiftDate(date,7))add(`plan:${p.id}:${date}`,`${p.kind==='account'?'Conta':'Meta'} ${p.name}: ${p.targetDate<date?'prazo atrasado':p.targetDate===date?'vence hoje':'prazo próximo'} (${p.targetDate}).`,'WARNING',new Date().toISOString(),{planId:p.id});
 for(const p of state.accountPayments??[])add('account-payment:'+p.id,`Conta ${p.name}: ${p.remainingAfter===undefined?'pagamento registrado':p.remainingAfter===0?'pagamento registrado e conta quitada':'pagamento parcial registrado'}.`,'SUCCESS',p.at,{planId:p.planId});
 for(const [index,p] of (state.dailyPayments??[]).entries()){const w=state.dailyWages?.find(w=>w.id===p.wageId);if(!w)continue;const paid=(state.dailyPayments??[]).slice(0,index+1).filter(n=>n.wageId===w.id).reduce((a,n)=>a+n.amount,0);add('daily-payment:'+p.id,`Diária de ${w.name}: ${paid<w.amount?'pagamento parcial registrado':'pagamento registrado e diária quitada'}.`,'SUCCESS',state.cashMovements?.find(m=>m.id===p.cashMovementId)?.at??p.date);}
 for(const session of state.cashSessions??[])if(!session.closedAt)add('cash:'+session.id,`Caixa em dinheiro ainda aberto desde ${session.date}.`,'ACTION_REQUIRED',session.openedAt);
 const persisted=(state.notifications??[]).filter(n=>!n.id.startsWith('derived:'));
 return [...rows,...persisted].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
function planPending(p:State['plans'][number]){return (p.target??p.amount)>(p.kind==='account'?p.accountPaid??0:p.amount);}
export function notificationTarget(state:State,n:Notification){
 if(n.commitmentId)return {route:'compromissos',id:n.commitmentId};
 if(n.planId)return {route:state.plans.find(p=>p.id===n.planId)?.kind==='account'?'organizar/contas':'organizar/metas'};
 if(n.id.startsWith('derived:cash:'))return {route:'receber/caixa'};
 if(n.message.endsWith('Confirme em Equipe.'))return {route:'equipe'};
 const payment=state.dailyPayments?.find(p=>n.id==='derived:daily-payment:'+p.id),wage=state.dailyWages?.find(w=>w.id===payment?.wageId);
 return {route:wage?'equipe/'+wage.memberId+'/comprovantes/'+wage.id+'/'+payment!.id:'mais/historico'};
}
