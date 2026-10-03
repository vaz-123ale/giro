import type { Commitment, CommissionRule, Movement, Sale, State } from './models.ts';

export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const remaining=(commitment:Commitment)=>commitment.original-commitment.paid;
export const remainingToAllocate=(commitment:Commitment)=>Math.max(0,remaining(commitment)-(commitment.cashPending??0));
export const isActive=(commitment:Commitment)=>['active','accepted'].includes(commitment.status)&&remaining(commitment)>0;
export const statusLabel=(status:Commitment['status'])=>({draft:'RASCUNHO',awaiting_acceptance:'AGUARDANDO ACEITE',active:'ATIVO',accepted:'ATIVO',completed:'CONCLUÍDO',cancelled:'CANCELADO',pending:'PENDENTE'})[status];
export const priorityLabel=(priority:number)=>({1:'Alta',2:'Média',3:'Baixa'}[priority]??`Prioridade anterior (${priority})`);
export const movementLabel=(mode:Movement['mode'])=>({to_separate:'Valor a separar',simulated:'Distribuição digital simulada',available:'Livre para o vendedor'})[mode];

export function allocation(amount:number,rateBps:number,limit:number) {
 if(!Number.isSafeInteger(amount)||amount<0||!Number.isInteger(rateBps)||rateBps<0||rateBps>10000||!Number.isSafeInteger(limit)||limit<0)throw new Error('Valores financeiros inválidos.');
 return Math.min(Number(BigInt(amount)*BigInt(rateBps)/10000n),limit);
}

/** Percentuais sobre o bruto; comissão primeiro; prioridade 1 primeiro.
 * Cada destino é limitado ao disponível. Regras são capturadas na venda.
 * Somente recebimentos geram distribuição, uma única vez por venda.
 */
export function calculateDistribution(sale:Sale,commitments:Commitment[]) {
 if(!sale.paidAt)throw new Error('A venda ainda não foi recebida.');
 let available=sale.amount;
 const updated=structuredClone(commitments);
 const entries:Movement[]=[];
 const mode=sale.method==='cash'?'to_separate':'simulated';
 const commissions:CommissionRule[]=sale.commissions??(sale.participant?[{memberId:sale.participant,name:sale.participant,rateBps:sale.commissionBps}]:[]);
 for(const rule of [...commissions].sort((a,b)=>(b.fixedAmount?1:0)-(a.fixedAmount?1:0))){
  const amount=rule.fixedAmount!==undefined?Math.min(rule.fixedAmount,available):allocation(sale.amount,rule.rateBps,available);available-=amount;
  entries.push({kind:'commission',recipientId:rule.memberId,recipient:rule.name,amount,rateBps:rule.fixedAmount!==undefined?null:rule.rateBps,mode,...(rule.compensation?{compensation:rule.compensation}:{})});
 }
 const rules=[...(sale.commitmentRules??[])].sort((a,b)=>a.priority-b.priority||a.createdAt.localeCompare(b.createdAt)||a.commitmentId.localeCompare(b.commitmentId));
 for(const rule of rules){
  const commitment=updated.find(c=>c.id===rule.commitmentId);
  if(!commitment||commitment.demo||!isActive(commitment))continue;
  const amount=allocation(sale.amount,rule.rateBps,Math.min(remainingToAllocate(commitment),available));
  if(amount===0)continue;
  available-=amount;
  if(sale.method==='cash')commitment.cashPending=(commitment.cashPending??0)+amount;
  else {commitment.paid+=amount;if(sale.method==='digital')commitment.simulatedPaid=(commitment.simulatedPaid??0)+amount;}
  if(remaining(commitment)===0){commitment.status='completed';commitment.completedAt=sale.paidAt;commitment.completionSaleId=sale.id;}
  entries.push({kind:'commitment',recipientId:commitment.id,recipient:rule.supplier,amount,rateBps:rule.rateBps,mode,remainingAfter:remaining(commitment),allocationRemainingAfter:remainingToAllocate(commitment),...(rule.publicId?{commitmentPublicId:rule.publicId}:{})});
 }
 entries.push({kind:'seller',recipientId:'owner',recipient:'Maria',amount:available,rateBps:null,mode:'available'});
 return {entries,commitments:updated};
}

export function visibleSales(state:State){return state.sales.filter(s=>state.demo||!s.demo);}
export function visibleCommitments(state:State){return state.commitments.filter(c=>state.demo||!c.demo);}
export function visiblePlans(state:State){return state.plans.filter(p=>state.demo||!p.demo);}
export function nextCommitment(state:State){return visibleCommitments(state).filter(isActive).sort((a,b)=>a.due.localeCompare(b.due)||a.priority-b.priority)[0];}

// Vendas antigas conservam comissões, sem amortização retroativa.
export function saleDistribution(sale:Sale):Movement[]{
 if(!sale.paidAt)return [];
 if(sale.distribution)return sale.distribution;
 return calculateDistribution({...sale,commitmentRules:[]},[]).entries;
}
export function summary(state:State) {
 const sales=visibleSales(state).filter(s=>s.paidAt);
 const total=sales.reduce((a,s)=>a+s.amount,0);
 const entries=sales.flatMap(saleDistribution);
 const commission=entries.filter(e=>e.kind==='commission').reduce((a,e)=>a+e.amount,0);
 const commitments=entries.filter(e=>e.kind==='commitment').reduce((a,e)=>a+e.amount,0);
 const dailyCost=(state.dailyWages??[]).reduce((a,w)=>a+w.amount,0);
 const personalSpent=(state.accountPayments??[]).reduce((a,p)=>a+p.amount,0)+(state.cashMovements??[]).filter(m=>m.type==='MANUAL_OUTFLOW'&&m.origin==='manual').reduce((a,m)=>a+m.amount,0);
 const dailyCovered=Math.min(dailyCost,Math.max(0,total-commission-commitments-personalSpent));
 const committed=commission+commitments+dailyCovered;
 const sellerBalance=Math.max(0,total-committed-personalSpent);
 const plannedRequested=visiblePlans(state).filter(p=>!p.archivedAt).reduce((a,p)=>a+p.amount,0);
 const planned=Math.min(sellerBalance,plannedRequested);
 const cashSales=sales.filter(s=>s.method==='cash');
 const cashToSeparate=state.cashDestinations?state.cashDestinations.filter(d=>d.origin==='cash').reduce((a,d)=>a+d.amount-d.paid,0):cashSales.flatMap(saleDistribution).filter(e=>e.kind!=='seller').reduce((a,e)=>a+e.amount,0);
 return {total,commission,commitments,dailyCost,personalSpent,dailyUncovered:dailyCost-dailyCovered,committed,planned,plannedRequested,reserved:committed+planned,free:sellerBalance-planned,sellerBalance,
  today:sales.filter(s=>s.paidAt===today()).reduce((a,s)=>a+s.amount,0),
  debt:visibleCommitments(state).filter(isActive).reduce((a,c)=>a+remaining(c),0),
  cashTotal:cashSales.reduce((a,s)=>a+s.amount,0),cashToSeparate};
}

export function trustCommitments(state:State){
 return state.commitments.filter(c=>!c.demo&&c.counterpartyType!=='collaborator'&&state.contacts?.find(p=>p.id===c.contactId)?.type!=='collaborator'&&c.status==='completed'&&remaining(c)===0&&c.completedAt&&((c.completionPaymentId&&state.cashPayments?.some(p=>p.id===c.completionPaymentId&&p.kind==='supplier'&&p.recipientId===c.id))||(c.completionSaleId&&state.sales.some(s=>!s.demo&&s.id===c.completionSaleId&&s.paidAt&&s.method==='digital'&&s.distribution?.some(e=>e.kind==='commitment'&&e.recipientId===c.id&&e.remainingAfter===0)))));
}
export function trustSummary(state:State){
 // Fatos do motor local, não provas de transferência ou attestations.
 const completed=trustCommitments(state);
 const suppliers=new Map<string,number>();
 for(const c of completed){const key=c.supplier.trim().normalize('NFKC').toLocaleLowerCase('pt-BR');suppliers.set(key,(suppliers.get(key)??0)+1);}
 return {completed:completed.length,suppliers:suppliers.size,liquidated:completed.reduce((a,c)=>a+c.original,0),onTime:completed.filter(c=>c.completedAt!<=(c.completionTerms?.due??c.finalDue??c.due)).length,recurring:[...suppliers.values()].filter(n=>n>1).length};
}
export function manualTrustSummary(state:State){
 const completed=trustCommitments(state).filter(c=>c.completionPaymentId&&!(c.simulatedPaid??0));const suppliers=new Map<string,number>();
 for(const c of completed){const key=c.supplier.trim().normalize('NFKC').toLocaleLowerCase('pt-BR');suppliers.set(key,(suppliers.get(key)??0)+1);}
 const ids=new Set(completed.map(c=>c.id));const confirmed=(state.cashPayments??[]).filter(p=>p.kind==='supplier'&&ids.has(p.recipientId)).reduce((a,p)=>a+p.amount,0);
 return {completed:completed.length,suppliers:suppliers.size,confirmed,onTime:completed.filter(c=>c.completedAt!<=(c.completionTerms?.due??c.finalDue??c.due)).length,recurring:[...suppliers.values()].filter(n=>n>1).length};
}
