import {randomUUID} from 'node:crypto';
import type {State,Sale,CashPayment,CashMovement} from '../src/domain/models.ts';
import {activeCash,cashSummary,destinationPending} from '../src/domain/cash.ts';
import {remaining,today,saleDistribution} from '../src/domain/finance.ts';
import {inputRecord} from './input.ts';
import {requireAmount,validDate} from '../src/domain/validation.ts';
import {addEvent,terms} from './agreement-service.ts';
const now=()=>new Date().toISOString();
function movement(state:State,m:Omit<CashMovement,'id'|'at'>){const row={...m,id:randomUUID(),at:now()};(state.cashMovements??=[]).push(row);return row;}
function opened(state:State){const session=activeCash(state);if(!session)throw Error('Abra o caixa antes de confirmar uma saída física.');if(session.date!==today())throw Error('Feche o caixa do período anterior e abra o caixa de hoje.');return session;}
export function openCash(state:State,value:unknown){
 const input=inputRecord(value);requireAmount(input.opening,true);if(activeCash(state))throw Error('Já existe um caixa aberto. Feche-o antes de abrir outro.');
 const date=input.date??today();if(!validDate(date)||date!==today())throw Error('A abertura deve ser registrada na data de hoje.');
 if(input.responsible!==undefined&&(typeof input.responsible!=='string'||!input.responsible.trim()||input.responsible.length>120))throw Error('Responsável inválido.');
 const session={id:randomUUID(),date,opening:input.opening,openedAt:now(),...(input.responsible?{responsible:String(input.responsible).trim()}:{})};(state.cashSessions??=[]).push(session);
 state.demo=false;
 movement(state,{type:'OPENING',amount:session.opening,origin:'manual',sessionId:session.id,reference:session.id,description:'Saldo físico informado na abertura',confirmedBy:'local_operator'});return session;
}
/** Sem abertura, a receita é preservada fora de período; não se inventa saldo inicial.
 * Ao abrir, o usuário conta todo o saldo existente, inclusive receitas anteriores.
 */
export function recordCashSale(state:State,sale:Sale){
 if(sale.demo||!sale.paidAt)return;
 if(sale.method==='cash'&&!state.cashMovements?.some(m=>m.type==='CASH_SALE'&&m.reference===sale.id)){
  const session=activeCash(state);const sessionId=session?.date===sale.paidAt&&session.date===today()?session.id:undefined;
  (state.cashMovements??=[]).push({id:randomUUID(),type:'CASH_SALE',amount:sale.amount,at:sale.settledAt??sale.paidAt,origin:'sale',sessionId,reference:sale.id,description:'Venda recebida em dinheiro'});
 }
 for(const [index,e] of saleDistribution(sale).entries()){
  if(e.kind==='seller'||e.amount===0||(e.kind==='commitment'&&sale.method!=='cash'))continue;
  const id=`destination-${sale.id}-${index}`;if(state.cashDestinations?.some(d=>d.id===id))continue;
  let recipientId=e.recipientId;
  if(e.kind==='commission'&&!state.members.some(m=>m.id===recipientId)){const matches=state.members.filter(m=>m.name===e.recipient);if(matches.length===1)recipientId=matches[0].id;}
  (state.cashDestinations??=[]).push({id,saleId:sale.id,kind:e.kind==='commitment'?'supplier':'commission',recipientId,recipient:e.recipient,amount:e.amount,separated:0,paid:0,origin:sale.method==='cash'?'cash':'digital_simulated',at:sale.settledAt??sale.paidAt,legacy:!sale.cashAccounting});
 }
}
export function separateCash(state:State,value:unknown){
 const input=inputRecord(value);const d=state.cashDestinations?.find(d=>d.id===input.destinationId&&d.origin==='cash');if(!d)throw Error('Destinação física não encontrada.');
 const amount=destinationPending(d)-d.separated;if(amount<=0)throw Error('Este valor já foi separado ou pago.');
 d.separated+=amount;(state.cashActions??=[]).push({id:randomUUID(),type:'separated',destinationId:d.id,amount,at:now(),confirmedBy:'local_operator'});
}
export function payCash(state:State,value:unknown){
 const input=inputRecord(value);requireAmount(input.amount);
 if(input.kind!=='supplier'&&input.kind!=='commission')throw Error('Escolha fornecedor ou comissão.');
 if(typeof input.requestId!=='string'||!input.requestId.trim()||input.requestId.length>120)throw Error('A confirmação precisa de um identificador único.');
 if(state.cashPayments?.some(p=>p.requestId===input.requestId))throw Error('Este pagamento já foi confirmado.');
 const session=opened(state);const balance=cashSummary(state).expected;
 if(input.amount>balance)throw Error('O pagamento supera o dinheiro esperado no caixa.');
 const destinations=(state.cashDestinations??[]).filter(d=>d.kind===input.kind&&d.recipientId===input.recipientId&&destinationPending(d)>0).sort((a,b)=>(a.origin==='cash'?0:1)-(b.origin==='cash'?0:1)||a.at.localeCompare(b.at));
 const pending=destinations.reduce((a,d)=>a+destinationPending(d),0);if(input.amount>pending)throw Error('O pagamento não pode superar o valor pendente.');
 const c=input.kind==='supplier'?state.commitments.find(c=>c.id===input.recipientId&&!c.demo):undefined;
 if(input.kind==='supplier'&&(!c||input.amount>remaining(c)))throw Error('O pagamento não pode superar a dívida restante.');
 let left=input.amount;const allocations:{destinationId:string;amount:number}[]=[];
 for(const d of destinations){const amount=Math.min(left,destinationPending(d));if(amount>0){allocations.push({destinationId:d.id,amount});left-=amount;}if(left===0)break;}
 const cashPortion=allocations.filter(a=>destinations.find(d=>d.id===a.destinationId)?.origin==='cash').reduce((a,p)=>a+p.amount,0);
 if(input.amount-cashPortion>Math.max(0,cashSummary(state).free))throw Error('O pagamento usaria dinheiro físico já destinado a outros valores.');
 const payment:CashPayment={id:randomUUID(),requestId:input.requestId,kind:input.kind,recipientId:destinations[0].recipientId,recipient:destinations[0].recipient,amount:input.amount,at:now(),sessionId:session.id,origin:'cash',confirmedBy:'local_operator',allocations};
 for(const a of allocations){const d=destinations.find(d=>d.id===a.destinationId)!;d.paid+=a.amount;d.separated=Math.max(0,d.separated-a.amount);(state.cashActions??=[]).push({id:randomUUID(),type:'paid',destinationId:d.id,amount:a.amount,at:payment.at,confirmedBy:'local_operator',paymentId:payment.id});}
 (state.cashPayments??=[]).push(payment);
 movement(state,{type:input.kind==='supplier'?'SUPPLIER_PAYMENT':'COMMISSION_PAYMENT',amount:payment.amount,origin:'confirmed_payment',sessionId:session.id,reference:payment.id,description:`Pagamento físico: ${payment.recipient}`,confirmedBy:'local_operator'});
 if(c){
  c.paid+=payment.amount;c.cashPending=Math.max(0,(c.cashPending??0)-payment.amount);addEvent(c,{type:'cash_paid',actor:'seller',amount:payment.amount,reason:`Pagamento físico confirmado pelo operador local. Registro #${payment.id}`,next:terms(c)});
  if(remaining(c)===0){
   c.status='completed';c.completedAt=today();c.completionPaymentId=payment.id;c.completionSaleId=destinations.find(d=>d.id===allocations.at(-1)?.destinationId)?.saleId;c.finalDue=c.due;c.completionTerms=terms(c);
   for(const r of c.renegotiations??[])if(r.status==='pending'){r.status='obsolete';r.decidedAt=payment.at;addEvent(c,{type:'renegotiation_closed',actor:'system',previous:r.previous,next:r.next,reason:'Compromisso concluído após pagamento físico; proposta não aplicada.'});}
   addEvent(c,{type:'completed',actor:'system',amount:payment.amount,reason:'Saldo restante pago com confirmação física local.',next:terms(c)});
  }
 }
 return payment;
}
export function outflowCash(state:State,value:unknown){
 const input=inputRecord(value);requireAmount(input.amount);if(typeof input.description!=='string'||!input.description.trim()||input.description.length>200)throw Error('Identifique a retirada ou saída (até 200 caracteres).');
 if(input.requestId!==undefined&&(typeof input.requestId!=='string'||!input.requestId||input.requestId.length>120))throw Error('Identificador da saída inválido.');
 if(input.requestId&&state.cashMovements?.some(m=>m.type==='MANUAL_OUTFLOW'&&m.reference===input.requestId))throw Error('Esta saída física já foi registrada.');
 const session=opened(state);if(input.amount>Math.max(0,cashSummary(state).free))throw Error('A saída supera o livre em espécie. Valores pendentes de terceiros devem ser preservados.');
 movement(state,{type:'MANUAL_OUTFLOW',amount:input.amount,origin:'manual',sessionId:session.id,reference:input.requestId as string|undefined,description:input.description.trim(),confirmedBy:'local_operator'});
}
export function closeCash(state:State,value:unknown){
 const input=inputRecord(value);requireAmount(input.counted,true);const session=activeCash(state);if(!session)throw Error('Não existe caixa aberto para fechar.');
 const {entries,outflows,expected,committed,free}=cashSummary(state,session.id);
 session.closedAt=now();session.closure={entries,outflows,expected,counted:input.counted,difference:input.counted-expected,committed,free};
 session.closedBy=session.responsible??'Operador local';
}
export function inflowCash(state:State,value:unknown){const v=inputRecord(value);requireAmount(v.amount);if(typeof v.description!=='string'||!v.description.trim()||v.description.length>200||typeof v.requestId!=='string'||!v.requestId)throw Error('Informe descrição e identificador da entrada.');if(state.cashMovements?.some(m=>m.reference===v.requestId))throw Error('Entrada já registrada.');const session=opened(state);movement(state,{type:'ADJUSTMENT',amount:v.amount,origin:'additional_entry',sessionId:session.id,reference:v.requestId,description:v.description.trim(),confirmedBy:'local_operator'});}
