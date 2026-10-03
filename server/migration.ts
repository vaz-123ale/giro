import type {State} from '../src/domain/models.ts';
import {saleDistribution} from '../src/domain/finance.ts';
import {recordCashSale} from './cash-service.ts';

function migrateCashState(state:State):State {
 state.cashSessions??=[];state.cashMovements??=[];state.cashDestinations??=[];state.cashPayments??=[];state.cashActions??=[];
 for(const sale of state.sales)recordCashSale(state,sale);
 for(const c of state.commitments.filter(c=>!c.demo)){
  const legacyCash=state.cashDestinations.filter(d=>d.kind==='supplier'&&d.recipientId===c.id&&d.origin==='cash'&&d.legacy).reduce((a,d)=>a+d.amount,0);
  if(legacyCash>c.paid)throw new Error('Histórico físico inconsistente: revise o backup antes de migrar.');
  if(legacyCash){
   c.legacyCashReclassification={paidBefore:c.paid,statusBefore:c.status,completedAt:c.completedAt,completionSaleId:c.completionSaleId,at:new Date().toISOString()};
   c.paid-=legacyCash;c.cashPending=(c.cashPending??0)+legacyCash;
   if(c.status==='completed'){c.status='active';delete c.completedAt;delete c.completionSaleId;delete c.completionPaymentId;}
   (c.timeline??=[]).push({id:`cash-reclassification-${c.id}`,type:'legacy_imported',actor:'system',at:c.legacyCashReclassification.at,reason:'Destinações físicas antigas preservadas como valores a pagar. Não havia confirmação de entrega; conclusão anterior era uma simulação.'});
  }
  c.cashPending??=0;
  c.simulatedPaid??=state.sales.filter(s=>!s.demo&&s.method==='digital').flatMap(s=>s.distribution??[]).filter(e=>e.kind==='commitment'&&e.recipientId===c.id).reduce((a,e)=>a+e.amount,0);
 }
 state.schemaVersion=4;return state;
}

export function migrateState(source:State):State {
 const state=structuredClone(source);
 if(state.schemaVersion===4)return state;
 if(state.schemaVersion===3)return migrateCashState(state);
 if(state.schemaVersion!==2){
 for(const c of state.commitments){
  c.demo=c.demo??c.id==='joao';c.simulation=true;
  if(c.status==='accepted')c.status='active';
 }
 for(const plan of state.plans)plan.demo=plan.demo??['stock','reserve'].includes(plan.id);
 for(const sale of state.sales){
  sale.demo=sale.demo??sale.id==='demo-sale';sale.legacy=true;
  // Captura existente é preservada; não aplicar acordos novos a receitas antigas.
  sale.commissions=sale.commissions??(sale.participant?[{memberId:sale.participant,name:sale.participant,rateBps:sale.commissionBps}]:[]);
  sale.commitmentRules=sale.commitmentRules??[];
  if(sale.paidAt)sale.distribution=saleDistribution(sale);
 }
 state.demo=!state.sales.some(s=>!s.demo)&&!state.commitments.some(c=>!c.demo);
 }
 state.settings??={minimumWeeklyFree:0};
 for(const plan of state.plans){plan.target??=Math.max(plan.amount,1);plan.mode??='manual';plan.rateBps??=0;plan.status??=plan.amount===plan.target?'completed':'active';plan.targetDate??=null;}
 for(const c of state.commitments){
  c.originalDue??=c.due;c.finalDue??=c.due;c.version??=1;c.legacyAcceptance??=true;c.renegotiations??=[];
  if(!c.timeline){
   c.timeline=[];
   for(const s of state.sales)for(const e of s.distribution??[])if(e.kind==='commitment'&&e.recipientId===c.id){
    c.timeline.push({id:`legacy-amortized-${s.id}-${c.id}`,type:'amortized',actor:'system',at:s.settledAt??s.paidAt!,saleId:s.id,amount:e.amount,reason:'Movimento existente preservado da Fase 2.'});
    if(c.completionSaleId===s.id)c.timeline.push({id:`legacy-completed-${c.id}`,type:'completed',actor:'system',at:s.settledAt??c.completedAt!,saleId:s.id,reason:'Conclusão já registrada no banco da Fase 2.'});
   }
   c.timeline.sort((a,b)=>a.at.localeCompare(b.at));
   c.timeline.push({id:`legacy-${c.id}`,type:'legacy_imported',at:new Date().toISOString(),actor:'system',reason:'Registro preservado da fase anterior; nenhum aceite bilateral histórico foi inventado.'});
  }
  if(c.status==='completed')c.completionTerms??={original:c.original,rateBps:c.rateBps,priority:c.priority,due:c.due};
 }
 state.schemaVersion=3;return migrateCashState(state);
}
