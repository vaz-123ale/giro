import {randomUUID} from 'node:crypto';
import type {State} from '../src/domain/models.ts';
import {openCash,payCash} from '../server/cash-service.ts';
import {activeCash} from '../src/domain/cash.ts';
/** A confirmação é chamada explicitamente nos testes antigos que esperavam
 * quitação imediata de uma venda física. Nunca faz parte do helper de venda.
 */
export function confirmSuppliers(state:State){
 const pending=(state.cashDestinations??[]).filter(d=>d.kind==='supplier'&&d.paid<d.amount);
 if(!pending.length)return;
 if(!activeCash(state))openCash(state,{opening:state.sales.filter(s=>!s.demo&&s.paidAt&&s.method==='cash').reduce((a,s)=>a+s.amount,0)});
 for(const id of new Set(pending.map(d=>d.recipientId))){const amount=pending.filter(d=>d.recipientId===id).reduce((a,d)=>a+d.amount-d.paid,0);payCash(state,{kind:'supplier',recipientId:id,amount,requestId:randomUUID()});}
}
