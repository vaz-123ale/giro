import type {State} from './models.ts';
/** Projection of recorded facts; generating or printing never pays a wage. */
export function dailyReceipt(state:State,wageId:string,paymentId?:string){
 const wage=state.dailyWages?.find(w=>w.id===wageId);if(!wage)throw Error('Diária não encontrada.');
 const payment=paymentId?state.dailyPayments?.find(p=>p.id===paymentId&&p.wageId===wage.id):undefined;
 if(paymentId&&!payment)throw Error('Pagamento não encontrado para esta diária.');
 const movement=payment?state.cashMovements?.find(m=>m.id===payment.cashMovementId&&m.origin==='daily_wage'&&m.amount===payment.amount&&m.reference===payment.requestId):undefined;
 if(payment&&!movement)throw Error('Pagamento sem registro correspondente no livro-caixa.');
 return {id:payment?.id??wage.id,kind:payment?'payment' as const:'wage' as const,name:wage.name,workDate:wage.date,generated:wage.amount,paid:wage.paid,remaining:wage.amount-wage.paid,amount:payment?.amount??wage.amount,paymentDate:payment?.date??null,recordedAt:movement?.at??null,origin:payment?'Dinheiro físico':'Registro do dia trabalhado',confirmedBy:payment?'Operador local':null};
}
