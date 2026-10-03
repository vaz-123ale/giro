import {randomBytes,randomUUID} from 'node:crypto';
import type {ReceiptConfirmation,State} from '../src/domain/models.ts';
import {inputRecord} from './input.ts';

/**
 * Pagamento em dinheiro registrado pelo vendedor ganha um segundo nível de verificação
 * quando a pessoa que recebeu confirma pelo link local. Nada é alterado no valor do acordo:
 * a confirmação só qualifica o registro para o GIRO Confiança.
 */
export function requestReceipt(state:State,value:unknown):ReceiptConfirmation{
 const input=inputRecord(value);const payment=state.cashPayments?.find(p=>p.id===input.paymentId);
 if(!payment)throw Error('Pagamento em dinheiro não encontrado.');
 const existing=state.receiptConfirmations?.find(r=>r.paymentId===payment.id);if(existing)return existing;
 const row:ReceiptConfirmation={id:randomUUID(),token:randomBytes(24).toString('hex'),paymentId:payment.id,kind:payment.kind,recipientId:payment.recipientId,recipient:payment.recipient,amount:payment.amount,paidAt:payment.at,createdAt:new Date().toISOString(),state:'waiting'};
 (state.receiptConfirmations??=[]).unshift(row);return row;
}
/** O que a pessoa que recebeu vê: apenas este pagamento, sem outros dados do negócio. */
export function receiptView(state:State,token:string){
 const r=state.receiptConfirmations?.find(r=>r.token===token);if(!r)throw Error('Link de confirmação não encontrado.');
 return {recipient:r.recipient,amount:r.amount,paidAt:r.paidAt,state:r.state,decidedAt:r.decidedAt,kind:r.kind,authentication:'local_simulation' as const};
}
export function decideReceipt(state:State,value:unknown){
 const input=inputRecord(value);const r=state.receiptConfirmations?.find(r=>r.token===input.token);if(!r)throw Error('Link de confirmação não encontrado.');
 if(r.state!=='waiting')throw Error('Este pagamento já foi respondido.');
 if(input.decision!=='confirm'&&input.decision!=='dispute')throw Error('Resposta inválida.');
 r.state=input.decision==='confirm'?'confirmed':'disputed';r.decidedAt=new Date().toISOString();
 const commitmentId=r.kind==='supplier'?r.recipientId:undefined;
 (state.notifications??=[]).unshift({id:randomUUID(),commitmentId,message:r.state==='confirmed'?`${r.recipient} confirmou o recebimento do pagamento em dinheiro.`:`${r.recipient} informou que NÃO recebeu um pagamento em dinheiro registrado. Revise o caixa.`,type:r.state==='confirmed'?'SUCCESS':'WARNING',recipientId:'local-owner',createdAt:r.decidedAt});
 return r;
}
