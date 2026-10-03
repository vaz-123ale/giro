import type {RecurringAccount,State} from './models.ts';
import {summary} from './finance.ts';
import {validDate} from './validation.ts';
export function reserveCoverage(state:State){let budget=summary(state).sellerBalance;const covered=new Map<string,number>();for(const p of state.plans.filter(p=>!p.demo&&!p.archivedAt).sort((a,b)=>(a.priority??999)-(b.priority??999)||(a.createdAt??'').localeCompare(b.createdAt??'')||a.id.localeCompare(b.id))){const amount=Math.min(budget,p.amount);covered.set(p.id,amount);budget-=amount;}return covered;}
export function nextOccurrence(rule:RecurringAccount,date:string){
 const d=new Date(date+'T12:00:00Z');
 if(rule.frequency==='monthly'){const day=Number(rule.anchorDate.slice(8));d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}
 else d.setUTCDate(d.getUTCDate()+(rule.frequency==='weekly'?7:14));
 return d.toISOString().slice(0,10);
}
export function accountOccurrences(state:State,until:string){
 const coverage=reserveCoverage(state);const rows=state.plans.filter(p=>p.kind==='account'&&!p.demo&&!p.archivedAt&&(p.accountPaid??0)<(p.target??0)).map(p=>({id:p.id,name:p.name,date:p.targetDate!,amount:Math.max(0,(p.target??0)-(p.accountPaid??0)-(coverage.get(p.id)??0)),reserved:coverage.get(p.id)??0,virtual:false}));
 for(const rule of state.recurringAccounts??[]){if(!rule.active)continue;const existing=state.plans.filter(p=>p.recurrenceId===rule.id);let date=existing.map(p=>p.occurrenceDate??p.targetDate!).sort().at(-1)??rule.anchorDate;while(true){date=nextOccurrence(rule,date);if(!validDate(date)||date>until)break;if(!existing.some(p=>p.occurrenceDate===date))rows.push({id:rule.id+':'+date,name:rule.name,date,amount:rule.amount,reserved:0,virtual:true});}}
 return rows.filter(r=>r.date&&r.date<=until).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
