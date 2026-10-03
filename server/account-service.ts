import {randomUUID} from 'node:crypto';
import type {Plan,State} from '../src/domain/models.ts';
import {summary,today} from '../src/domain/finance.ts';
import {cashSummary} from '../src/domain/cash.ts';
import {nextOccurrence} from '../src/domain/accounts.ts';
import {requireAmount,validDate} from '../src/domain/validation.ts';
import {inputRecord} from './input.ts';
export function configureAccount(state:State,p:Plan,input:Record<string,unknown>){
 if(input.category!==undefined&&(typeof input.category!=='string'||input.category.length>80))throw Error('Categoria inválida.');
 const frequency=input.recurrence??'once';if(!['once','weekly','fortnightly','monthly'].includes(String(frequency)))throw Error('Recorrência inválida.');
 p.category=String(input.category??'Geral');p.accountStatus=p.amount?'planned':'created';p.occurrenceDate=p.targetDate!;
 if(frequency!=='once'){const rule={id:randomUUID(),name:p.name,category:p.category,amount:p.target!,frequency:frequency as 'weekly'|'fortnightly'|'monthly',anchorDate:p.targetDate!,active:true,createdAt:new Date().toISOString()};(state.recurringAccounts??=[]).push(rule);p.recurrenceId=rule.id;}
}
export function payAccount(state:State,value:unknown){
 const v=inputRecord(value),p=state.plans.find(p=>p.id===v.id&&p.kind==='account'&&!p.demo&&!p.archivedAt);if(!p)throw Error('Conta não encontrada.');
 requireAmount(v.amount);if(!validDate(v.date)||v.date>today())throw Error('Data de pagamento inválida.');
 if(v.origin!=='cash'&&v.origin!=='digital_simulated')throw Error('Escolha dinheiro físico ou digital simulado.');
 if(v.acknowledged!==true)throw Error('Confirme o registro local do pagamento.');
 if(typeof v.requestId!=='string'||! /^[a-f0-9-]{36}$/.test(v.requestId))throw Error('Identificador inválido.');
 if(state.accountPayments?.some(p=>p.requestId===v.requestId)||state.cashMovements?.some(m=>m.reference===v.requestId))throw Error('Pagamento já registrado.');
 if(v.amount>(p.target??0)-(p.accountPaid??0))throw Error('Pagamento supera o restante da conta.');
 if(v.useFreeBalance===true&&v.amount>Math.max(0,(p.target??0)-(p.accountPaid??0)-p.amount))throw Error('Pagamento complementar supera o valor ainda não coberto pela reserva.');
 if(v.useFreeBalance===true&&v.amount>summary(state).free)throw Error('Saldo disponível insuficiente para o pagamento complementar.');
 if(v.amount>Math.max(0,summary(state).sellerBalance-state.plans.filter(n=>n.id!==p.id&&!n.demo&&!n.archivedAt).reduce((a,n)=>a+n.amount,0)))throw Error('Saldo livre e reserva da conta insuficientes.');
 const at=new Date().toISOString();let cashMovementId:string|undefined;
 if(v.origin==='cash'){const cash=cashSummary(state);if(!cash.session||cash.session.date!==today()||v.date!==today())throw Error('Abra o caixa de hoje e registre a entrega de hoje.');if(v.amount>cash.free)throw Error('Caixa insuficiente após os destinos protegidos.');cashMovementId=randomUUID();(state.cashMovements??=[]).push({id:cashMovementId,type:'MANUAL_OUTFLOW',amount:v.amount,at,origin:'account_payment',sessionId:cash.session.id,reference:v.requestId,description:p.name,confirmedBy:'local_operator'});}
 (state.accountPayments??=[]).push({id:randomUUID(),requestId:v.requestId,planId:p.id,name:p.name,amount:v.amount,date:v.date,origin:v.origin,at,cashMovementId,confirmedBy:'local_operator',remainingAfter:(p.target??0)-(p.accountPaid??0)-v.amount,targetAtPayment:p.target,...(v.useFreeBalance===true?{useFreeBalance:true}:{})});
 const before=p.amount;if(v.useFreeBalance!==true)p.amount=Math.max(0,p.amount-v.amount);p.accountPaid=(p.accountPaid??0)+v.amount;p.accountStatus=p.accountPaid===p.target?'paid':'partial';p.status=p.accountStatus==='paid'?'completed':'active';p.paidAt=at;
 (state.planEvents??=[]).push({id:randomUUID(),planId:p.id,name:p.name,type:'edited',at,before,after:p.amount});
 if(p.accountStatus==='paid'&&p.recurrenceId){const rule=state.recurringAccounts?.find(r=>r.id===p.recurrenceId&&r.active);if(rule){const date=nextOccurrence(rule,p.occurrenceDate??p.targetDate!);if(!state.plans.some(n=>n.recurrenceId===rule.id&&n.occurrenceDate===date)){state.plans.push({id:randomUUID(),name:rule.name,category:rule.category,target:rule.amount,amount:0,targetDate:date,occurrenceDate:date,recurrenceId:rule.id,kind:'account',mode:'manual',rateBps:0,status:'active',accountStatus:'created',createdAt:at,demo:false});}}}
}
