import type {State} from './models.ts';
import {isActive,remainingToAllocate,summary,today} from './finance.ts';
import {accountOccurrences,reserveCoverage} from './accounts.ts';
import {daysBetween,shiftDate} from './intelligence.ts';
import {validDate} from './validation.ts';
export function globalFinancialForecast(state:State,until=shiftDate(today(),7),asOf=today()){
 if(!validDate(until)||!validDate(asOf)||daysBetween(asOf,until)<0||daysBetween(asOf,until)>365)throw Error('Horizonte deve estar entre hoje e 365 dias.');
 const days=daysBetween(asOf,until),recent=state.sales.filter(s=>!s.demo&&s.paidAt&&s.paidAt>=shiftDate(asOf,-6)&&s.paidAt<=asOf),recentRevenue=recent.reduce((a,s)=>a+s.amount,0);
 const projectedRevenue=Math.floor(recentRevenue*days/7),projectedSales=Math.ceil(recent.length*days/7),members=state.members.filter(m=>!m.demo&&m.active&&m.participationMode!=='specific');
 const percentBudget=members.filter(m=>(m.compensation??'commission')==='commission').reduce((a,m)=>a+Math.floor(projectedRevenue*m.commissionBps/10000),0),fixedBudget=members.filter(m=>m.compensation==='fixed_sale').reduce((a,m)=>a+(m.fixedAmount??0)*projectedSales,0);
 const coverage=reserveCoverage(state),current=summary(state),minimum=Math.ceil((state.settings?.minimumWeeklyFree??0)*days/7);
 const items:{id:string;name:string;category:string;amount:number;reserved:number;priority:number;date:string;virtual?:boolean;funded?:number;shortfall?:number}[]=[];
 for(const c of state.commitments.filter(c=>!c.demo&&isActive(c)))items.push({id:c.id,name:c.supplier,category:'Acordo bilateral',amount:c.due<=until?remainingToAllocate(c):Math.min(remainingToAllocate(c),Math.floor(projectedRevenue*c.rateBps/10000)),reserved:c.cashPending??0,priority:0,date:c.due});
 for(const a of accountOccurrences(state,until))items.push({...a,category:a.virtual?'Conta recorrente futura':'Conta',priority:state.plans.find(p=>p.id===a.id)?.priority??3});
 for(const w of state.dailySchedules??[])if(w.status==='scheduled'&&w.date<=until)items.push({id:w.id,name:w.name,category:'Diária futura confirmada',amount:w.amount,reserved:0,priority:0,date:w.date});
 if(current.dailyUncovered)items.push({id:'daily-unfunded',name:'Diárias geradas sem cobertura',category:'Equipe',amount:current.dailyUncovered,reserved:current.dailyCost-current.dailyUncovered,priority:0,date:asOf});
 for(const p of state.plans.filter(p=>!p.demo&&!p.archivedAt&&p.kind!=='account'&&p.status==='active')){const remaining=Math.max(0,(p.target??p.amount)-(coverage.get(p.id)??0));const amount=p.targetDate&&p.targetDate<=until?remaining:p.mode==='suggested'?Math.min(remaining,Math.floor(projectedRevenue*(p.rateBps??0)/10000)):remaining;if(amount)items.push({id:p.id,name:p.name,category:'Planejamento pessoal flexível',amount,reserved:coverage.get(p.id)??0,priority:p.priority??3,date:p.targetDate??until});}
 if(minimum)items.push({id:'minimum',name:'Mínimo livre desejado',category:'Preferência pessoal',amount:minimum,reserved:0,priority:1,date:until});
 items.sort((a,b)=>a.priority-b.priority||a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const available=current.free+projectedRevenue-percentBudget-fixedBudget;let budget=Math.max(0,available);for(const item of items){item.funded=Math.min(budget,item.amount);item.shortfall=item.amount-item.funded;budget-=item.funded;}
 const obligations=items.reduce((a,i)=>a+i.amount,0),shortfall=Math.max(0,obligations-available);
 return {asOf,until,days,recentRevenue,recentSales:recent.length,projectedRevenue,projectedSales,percentBudget,fixedBudget,currentFree:current.free,confirmedReserves:current.planned,minimum,available:Math.max(0,available),obligations,shortfall,remaining:budget,feasible:shortfall===0,noHistory:recent.length===0,items,explanation:'Recebimentos dos últimos 7 dias / 7 × dias futuros. Quantidade de vendas arredondada para cima para estimar fixos. Participação específica futura não é presumida. Reservas existentes e destinos já separados não são descontados novamente. Acordos e diárias precedem intenções pessoais; prioridade ordena a cobertura estimada e não altera contratos. Estimativa local, sem garantia de receita ou pagamento.'};
}
