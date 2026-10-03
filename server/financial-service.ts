import type { Commitment, Sale, State } from '../src/domain/models.ts';
import {calculateDistribution,isActive,today,priorityLabel} from '../src/domain/finance.ts';
import {saleCommissions} from './team-service.ts';
import {requireAmount,validDate} from '../src/domain/validation.ts';
import {randomUUID} from 'node:crypto';
import {addEvent,initializeAgreement,terms} from './agreement-service.ts';
import {planningSuggestions} from '../src/domain/planning.ts';
import {recordCashSale} from './cash-service.ts';
import {requireDistributionCapacity,validateSaleCapacity} from '../src/domain/capacity.ts';
import {nextCommitmentId,documentFields} from './record-service.ts';
import {commitmentId} from '../src/domain/records.ts';
import {reserveAutomatic} from './planning-service.ts';

function record(input:unknown):Record<string,unknown>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Dados inválidos.');return input as Record<string,unknown>;}
function settle(state:State,sale:Sale){
 if(sale.distribution)throw new Error('Esta venda já foi distribuída.');
 if(sale.capacityChecked){const capacity=validateSaleCapacity(sale.amount,sale.commissions??[],sale.commitmentRules??[],state);if(capacity.status==='CONFLICT')throw Error(capacity.explanation);}
 const result=calculateDistribution(sale,state.commitments);
 // Recebimentos podem ser cadastrados fora de ordem cronológica.
 // A quitação ocorre na maior data de pagamento que contribuiu ao acordo.
 for(const c of result.commitments.filter(c=>c.completionSaleId===sale.id)){
  const dates=state.sales.filter(s=>s.paidAt&&s.distribution?.some(e=>e.kind==='commitment'&&e.recipientId===c.id&&e.amount>0)).map(s=>s.paidAt!);
  c.completedAt=[sale.paidAt!,...dates].sort().at(-1);
 }
 state.commitments=result.commitments;sale.distribution=result.entries;sale.settledAt=new Date().toISOString();
 for(const entry of result.entries.filter(e=>e.kind==='commitment')){
  const c=state.commitments.find(c=>c.id===entry.recipientId)!;
  addEvent(c,{type:'amortized',actor:'system',saleId:sale.id,amount:entry.amount,next:terms(c)});
  if(c.completionSaleId===sale.id){
   c.finalDue=c.due;c.completionTerms=terms(c);
   for(const proposal of c.renegotiations??[])if(proposal.status==='pending'){
    proposal.status='obsolete';proposal.decidedAt=new Date().toISOString();
    addEvent(c,{type:'renegotiation_closed',actor:'system',previous:proposal.previous,next:proposal.next,reason:'Compromisso concluído antes da decisão; a proposta não foi aplicada.'});
   }
   addEvent(c,{type:'completed',actor:'system',saleId:sale.id,amount:entry.amount,next:terms(c)});
  }
 }
 sale.planningSuggestions=planningSuggestions(state,sale);
 recordCashSale(state,sale);
 reserveAutomatic(state,sale);
}
export function createSale(state:State,value:unknown){
 const input=record(value);requireAmount(input.amount);
 if(!['cash','digital'].includes(String(input.method)))throw new Error('Meio de pagamento inválido.');
 if(!validDate(input.soldAt)||(input.paidAt!==null&&!validDate(input.paidAt))||(typeof input.paidAt==='string'&&input.paidAt<input.soldAt))throw new Error('Revise as datas da venda e do pagamento.');
 if(input.method==='cash'&&typeof input.paidAt==='string'&&input.paidAt>today())throw new Error('Recebimento físico não pode ter data futura. Deixe pendente até receber.');
 const soldAt=input.soldAt;
 const supportingDocument=documentFields(input.supportingDocument);
 if(supportingDocument?.commitmentId){const related=state.commitments.find(c=>!c.demo&&(c.id===supportingDocument.commitmentId||commitmentId(c)===supportingDocument.commitmentId));if(!related)throw Error('ID do compromisso informado no documento não foi encontrado.');supportingDocument.commitmentId=commitmentId(related);}
 const {commissions,participants,basis}=saleCommissions(state,soldAt,input.soldTime,input.participantIds);
 const commitmentRules=state.commitments.filter(c=>!c.demo&&isActive(c)&&c.createdAt<=soldAt).map(c=>({commitmentId:c.id,publicId:commitmentId(c),supplier:c.supplier,rateBps:c.rateBps,priority:c.priority,createdAt:c.createdAt,version:c.version}));
 const capacity=validateSaleCapacity(input.amount,commissions,commitmentRules,state);if(capacity.status==='CONFLICT')throw Error(capacity.explanation);
 const sale:Sale={id:randomUUID(),amount:input.amount,soldAt,paidAt:input.paidAt as string|null,method:input.method as Sale['method'],participant:participants.map(c=>c.name).join(', ')||null,participants,capacityChecked:true,commissionBps:commissions.reduce((a,c)=>a+c.rateBps,0),commissions,commitmentRules,rules:[basis,...commissions.map(c=>c.fixedAmount!==undefined?`${c.name}: valor fixo ${c.fixedAmount/100} por venda`:`Comissão de ${c.name}: ${c.rateBps/100}% do bruto no turno da venda`),...commitmentRules.map(c=>`${c.supplier}: ${c.rateBps/100}% do bruto; prioridade ${priorityLabel(c.priority)}`)],demo:false,cashAccounting:true,recordedAt:new Date().toISOString()};
 if(sale.paidAt)settle(state,sale);
 if(supportingDocument)sale.supportingDocument=supportingDocument;
 state.sales.unshift(sale);state.demo=false;return sale;
}
export function receiveSale(state:State,value:unknown){
 const input=record(value);const sale=state.sales.find(s=>s.id===input.id&&!s.demo);
 if(!sale)throw new Error('Venda não encontrada.');
 if(sale.paidAt||sale.distribution)throw new Error('O recebimento desta venda já foi registrado.');
 if(!validDate(input.paidAt)||input.paidAt<sale.soldAt)throw new Error('Revise a data do recebimento.');
 if(sale.method==='cash'&&input.paidAt>today())throw new Error('Recebimento físico não pode ter data futura.');
 // Usa os participantes e os acordos capturados na venda, nunca o turno atual.
 if(sale.capacityChecked){const capacity=validateSaleCapacity(sale.amount,sale.commissions??[],sale.commitmentRules??[],state);if(capacity.status==='CONFLICT')throw Error(capacity.explanation);}
 sale.paidAt=input.paidAt;settle(state,sale);state.demo=false;return sale;
}
export function createCommitment(state:State,value:unknown){
 const input=record(value);const original=input.debtAmount??input.original;requireAmount(original);
 if(input.remaining!==undefined){requireAmount(input.remaining,true);if(input.remaining>original)throw new Error('O restante não pode superar o valor original.');}
 const paid=input.alreadyPaid??(input.remaining!==undefined?original-input.remaining:0);requireAmount(paid,true);
 if(paid>original)throw new Error('O já pago não pode superar o valor da dívida.');
 if(typeof input.supplier!=='string'||!input.supplier.trim()||input.supplier.trim().length>120)throw new Error('Informe o fornecedor (até 120 caracteres).');
 if(typeof input.rateBps!=='number'||!Number.isInteger(input.rateBps)||input.rateBps<=0||input.rateBps>10000)throw new Error('O percentual deve ser maior que zero e no máximo 100%.');
 if(typeof input.priority!=='number'||!Number.isInteger(input.priority)||input.priority<1||input.priority>999)throw new Error('A prioridade deve ser um inteiro de 1 a 999.');
 if(!validDate(input.due))throw new Error('Vencimento inválido.');
 if(input.status!==undefined&&!['draft','active','awaiting_acceptance'].includes(String(input.status)))throw new Error('O status é definido pelo motor; não é possível alterar unilateralmente.');
 if(input.status!=='draft')requireDistributionCapacity(state,{rateBps:input.rateBps});
 const c:Commitment={id:randomUUID(),supplier:input.supplier.trim(),original,paid,rateBps:input.rateBps,priority:input.priority,createdAt:today(),due:input.due,status:'awaiting_acceptance',demo:false,simulation:true};
 initializeAgreement(c,input.status==='draft');
 c.publicId=nextCommitmentId(state,c.createdAt.slice(0,4));
 state.commitments.unshift(c);state.demo=false;return c;
}
