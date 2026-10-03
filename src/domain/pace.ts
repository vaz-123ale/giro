import type {Plan,State} from './models.ts';
import {today} from './finance.ts';
import {daysBetween,shiftDate} from './intelligence.ts';
import {planRemaining} from './planning.ts';

export interface PaceSuggestion {neededBps:number;currentBps:number;days:number;projectedRevenue:number;feasible:boolean}
/**
 * Regra pessoal (conta/meta com reserva automática ou sugerida): quanto das próximas vendas
 * precisaria ir para ela até a data-meta. Mesmo critério das previsões de compromissos:
 * receita dos últimos 7 dias (incluindo hoje), horizonte sem incluir hoje. Não altera nada.
 */
export function planPace(state:State,plan:Plan,asOf=today()):PaceSuggestion|null{
 if(plan.archivedAt||plan.status!=='active'||plan.mode==='manual'||!plan.mode||!plan.targetDate)return null;
 const left=planRemaining(plan);const days=daysBetween(asOf,plan.targetDate);if(left<=0||days<=0)return null;
 const start=shiftDate(asOf,-6);const recent=state.sales.filter(s=>!s.demo&&s.paidAt&&s.paidAt>=start&&s.paidAt<=asOf).reduce((a,s)=>a+s.amount,0);
 const projectedRevenue=Math.floor(recent*days/7);if(projectedRevenue<=0)return null;
 const neededBps=Math.ceil(left/projectedRevenue*10000/50)*50;const currentBps=plan.rateBps??0;
 if(neededBps<=currentBps)return null;
 return {neededBps:Math.min(neededBps,10000),currentBps,days,projectedRevenue,feasible:neededBps<=10000};
}
