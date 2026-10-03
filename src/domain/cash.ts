import type {CashDestination,State} from './models.ts';
export const destinationPending=(d:CashDestination)=>d.amount-d.paid;
export const destinationStatus=(d:CashDestination)=>destinationPending(d)===0?'PAGO':d.separated>0?'SEPARADO':'A_SEPARAR';
export const activeCash=(state:State)=>state.cashSessions?.find(s=>!s.closedAt);
export function cashSummary(state:State,sessionId=activeCash(state)?.id){
 const session=state.cashSessions?.find(s=>s.id===sessionId);
 const movements=(state.cashMovements??[]).filter(m=>m.sessionId===sessionId&&sessionId!==undefined);
 const saleEntries=movements.filter(m=>m.type==='CASH_SALE').reduce((a,m)=>a+m.amount,0),additionalEntries=movements.filter(m=>m.type==='ADJUSTMENT'&&m.origin==='additional_entry').reduce((a,m)=>a+m.amount,0),entries=saleEntries+additionalEntries;
 const outflows=movements.filter(m=>['SUPPLIER_PAYMENT','COMMISSION_PAYMENT','MANUAL_OUTFLOW'].includes(m.type)).reduce((a,m)=>a+m.amount,0);
 const committed=session?.closure?.committed??((state.cashDestinations??[]).filter(d=>d.origin==='cash').reduce((a,d)=>a+destinationPending(d),0)+(state.dailyWages??[]).reduce((a,w)=>a+w.amount-w.paid,0));
 const expected=(session?.opening??0)+entries-outflows;
 return {session,movements,opening:session?.opening??0,entries,saleEntries,additionalEntries,outflows,expected,committed,free:session?.closure?.free??expected-committed};
}
export function cashRecipient(state:State,kind:CashDestination['kind'],recipientId:string){
 const destinations=(state.cashDestinations??[]).filter(d=>d.kind===kind&&d.recipientId===recipientId);
 return {destinations,generated:destinations.reduce((a,d)=>a+d.amount,0),paid:destinations.reduce((a,d)=>a+d.paid,0),pending:destinations.reduce((a,d)=>a+destinationPending(d),0)};
}
