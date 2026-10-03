import type {Plan,PlanSuggestion,Sale,State} from './models.ts';
import {allocation} from './finance.ts';
export function planningSuggestions(state:State,sale:Sale):PlanSuggestion[]{
 if(!sale.paidAt||sale.demo)return [];
 let available=sale.distribution?.find(e=>e.kind==='seller')?.amount??0;
 const suggestions:PlanSuggestion[]=[];
 const plans=state.plans.filter(p=>!p.demo&&p.status==='active'&&p.mode==='suggested').sort((a,b)=>(a.priority??999)-(b.priority??999)||a.id.localeCompare(b.id));
 for(const plan of plans){
  const amount=allocation(sale.amount,plan.rateBps??0,Math.min(available,Math.max(0,(plan.target??plan.amount)-plan.amount-(plan.accountPaid??0))));
  if(amount>0){suggestions.push({planId:plan.id,name:plan.name,amount,rateBps:plan.rateBps??0,status:'pending'});available-=amount;}
 }
 return suggestions;
}
export function educationalSimulation(amount:number,rateBps:number,debtRemaining?:number){
 const destination=allocation(amount,rateBps,Math.min(amount,debtRemaining??amount));
 return {destination,available:amount-destination};
}
export const planRemaining=(plan:Plan)=>Math.max(0,(plan.target??plan.amount)-plan.amount-(plan.accountPaid??0));
export function educationalDebtRemaining(original:number,paid:number){if(paid>original)throw new Error('O já pago não pode superar o valor da dívida.');return original-paid;}
