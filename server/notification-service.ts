import {randomUUID} from 'node:crypto';
import type {State,Notification} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
import {globalFinancialForecast} from '../src/domain/global-forecast.ts';
import {shiftDate} from '../src/domain/intelligence.ts';
export function refreshNotifications(state:State){
 const date=today();const add=(key:string,type:Notification['type'],message:string,planId?:string)=>{if(state.notifications?.some(n=>n.dedupeKey===key))return;(state.notifications??=[]).unshift({id:randomUUID(),dedupeKey:key,type,message,planId,recipientId:'local-owner',createdAt:new Date().toISOString()});};
 for(const p of state.plans.filter(p=>p.kind==='account'&&!p.demo&&!p.archivedAt&&(p.accountPaid??0)<(p.target??0)&&p.targetDate&&p.targetDate<=shiftDate(date,1)))add('due:'+p.id+':'+date,'INFO',`Conta ${p.name}: vencimento ${p.targetDate}.`,p.id);
 const f=globalFinancialForecast(state);if(f.shortfall)add('risk:'+date+':'+f.shortfall,'WARNING',`Previsão global de 7 dias: faltariam ${(f.shortfall/100).toFixed(2)} reais para os destinos conhecidos. Revise prazo e planejamento.`);
}
