import {accountOccurrences} from './accounts.ts';
import type {Commitment,State} from './models.ts';
import {allocation,calculateDistribution,isActive,remaining,remainingToAllocate,today} from './finance.ts';
export const shiftDate=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export const daysBetween=(from:string,to:string)=>Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);
export interface Forecast {id:string;supplier:string;days:number;averageDaily:number;recentRevenue:number;projectedRevenue:number;currentAllocation:number;shortfall:number;alertShortfall:number;neededBps:number|null;minimumPreserved:number;plannedBuffer:number;otherObligations:number;availableCapacity:number;feasible:boolean;classification:'EM DIA'|'ATENÇÃO'|'RISCO DE NÃO QUITAÇÃO';noHistory:boolean;remaining:number;currentBps:number;pendingCash:number;toAllocate:number;accountsBudget:number;dailyBudget:number;fixedBudget:number}

/** Janela fixa de 7 dias, incluindo dias sem receita e hoje. Horizonte exclui hoje.
 * Não usa receitas fictícias, futuras ou pendentes. Não modifica o estado.
 */
export function financialForecast(state:State,asOf=today()):Forecast[]{
 const start=shiftDate(asOf,-6);
 const recent=state.sales.filter(s=>!s.demo&&s.paidAt&&s.paidAt>=start&&s.paidAt<=asOf);
 const recentRevenue=recent.reduce((a,s)=>a+s.amount,0);
 const active=state.commitments.filter(c=>!c.demo&&isActive(c));
 return active.map(c=>forecastCommitment(state,c,active,asOf,recentRevenue));
}
function forecastCommitment(state:State,c:Commitment,active:Commitment[],asOf:string,recentRevenue:number):Forecast{
 const days=daysBetween(asOf,c.due);const horizon=Math.max(0,days);
 const projectedRevenue=Math.floor(recentRevenue*horizon/7);const averageDaily=Math.floor(recentRevenue/7);
 const debt=remaining(c);const toAllocate=remainingToAllocate(c);const pendingCash=debt-toAllocate;
 const commissions=state.members.filter(m=>m.active&&!m.demo&&m.participationMode!=='specific'&&(m.compensation??'commission')==='commission').map(m=>({memberId:m.id,name:m.name,rateBps:m.commissionBps}));
 const simulation=calculateDistribution({id:'projection',amount:projectedRevenue,soldAt:asOf,paidAt:asOf,method:'digital',participant:null,commissionBps:0,rules:[],commissions,commitmentRules:active.map(a=>({commitmentId:a.id,supplier:a.supplier,rateBps:a.rateBps,priority:a.priority,createdAt:a.createdAt}))},active);
 const currentAllocation=simulation.entries.find(e=>e.kind==='commitment'&&e.recipientId===c.id)?.amount??0;
 const commissionBudget=simulation.entries.filter(e=>e.kind==='commission').reduce((a,e)=>a+e.amount,0);
 const minimumPreserved=Math.ceil((state.settings?.minimumWeeklyFree??0)*horizon/7);
 const plannedBuffer=state.plans.filter(p=>!p.demo&&p.status==='active'&&p.kind!=='account'&&!p.archivedAt&&p.mode==='suggested').reduce((a,p)=>a+allocation(projectedRevenue,p.rateBps??0,Math.max(0,(p.target??p.amount)-p.amount)),0);
 // Sugestões preservam dívidas de maior prioridade que vencem até esta data.
 const otherObligations=active.filter(a=>a.id!==c.id&&a.due<=c.due&&(a.priority<c.priority||(a.priority===c.priority&&(a.createdAt<c.createdAt||(a.createdAt===c.createdAt&&a.id<c.id))))).reduce((a,c)=>a+remainingToAllocate(c),0);
 const accountsBudget=accountOccurrences(state,c.due).reduce((a,p)=>a+p.amount,0);const dailyBudget=(state.dailySchedules??[]).filter(w=>w.status==='scheduled'&&w.date<=c.due).reduce((a,w)=>a+w.amount,0);const saleCount=Math.ceil(state.sales.filter(s=>!s.demo&&s.paidAt&&s.paidAt>=shiftDate(asOf,-6)&&s.paidAt<=asOf).length*horizon/7);const fixedBudget=state.members.filter(m=>!m.demo&&m.active&&m.participationMode!=='specific'&&m.compensation==='fixed_sale').reduce((a,m)=>a+(m.fixedAmount??0)*saleCount,0);
 const availableCapacity=Math.max(0,projectedRevenue-commissionBudget-minimumPreserved-plannedBuffer-otherObligations-accountsBudget-dailyBudget-fixedBudget);
 const neededBps=projectedRevenue>0?Math.ceil(toAllocate*10000/projectedRevenue):null;
 const feasible=horizon>0&&availableCapacity>=toAllocate;
 const shortfall=Math.max(0,toAllocate-currentAllocation);
 const noHistory=recentRevenue===0;
 let classification:Forecast['classification'];
 if(days<=0)classification='RISCO DE NÃO QUITAÇÃO';
 else if(noHistory)classification='ATENÇÃO';
 else if(!feasible||currentAllocation*5<toAllocate*4)classification='RISCO DE NÃO QUITAÇÃO';
 else if(currentAllocation<toAllocate)classification='ATENÇÃO';
 else classification='EM DIA';
 const alertShortfall=Math.max(shortfall,toAllocate-availableCapacity);
 return {id:c.id,supplier:c.supplier,days,averageDaily,recentRevenue,projectedRevenue,currentAllocation,shortfall,alertShortfall,neededBps,minimumPreserved,plannedBuffer,otherObligations,availableCapacity,feasible,classification,noHistory,remaining:debt,currentBps:c.rateBps,pendingCash,toAllocate,accountsBudget,dailyBudget,fixedBudget};
}
export function primaryRisk(state:State){return financialForecast(state).filter(f=>f.classification==='RISCO DE NÃO QUITAÇÃO').sort((a,b)=>a.days-b.days)[0];}
