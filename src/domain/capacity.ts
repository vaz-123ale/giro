import type {AgreementTerms,CommissionRule,State} from './models.ts';
import {isActive,remainingToAllocate,money} from './finance.ts';
/** Conservative potential load: all configured automatic percentage workers can overlap. */
export function validateDistributionCapacity(state:State,proposed?:Pick<AgreementTerms,'rateBps'>,excludeId?:string){
 const commissionBps=state.members.filter(m=>!m.demo&&!m.disabledAt&&m.participationMode!=='specific'&&(m.compensation??'commission')==='commission').reduce((a,m)=>a+m.commissionBps,0);
 const commitmentsBps=state.commitments.filter(c=>!c.demo&&c.id!==excludeId&&((isActive(c)&&remainingToAllocate(c)>0)||c.status==='awaiting_acceptance')).reduce((a,c)=>a+Math.max(c.rateBps,...(c.renegotiations??[]).filter(r=>r.status==='pending').map(r=>r.next.rateBps)),0);
 const fixedPerSale=state.members.filter(m=>!m.demo&&!m.disabledAt&&m.participationMode!=='specific'&&m.compensation==='fixed_sale').reduce((a,m)=>a+(m.fixedAmount??0),0);
 const currentBps=commissionBps+commitmentsBps,totalBps=currentBps+(proposed?.rateBps??0);
 const conflict=totalBps>10000||(totalBps===10000&&fixedPerSale>0);
 const minimumSale=totalBps<10000?Math.ceil(fixedPerSale*10000/(10000-totalBps)):fixedPerSale?null:0;
 return {status:conflict?'CONFLICT' as const:'OK' as const,currentBps,proposedBps:proposed?.rateBps??0,totalBps,commissionBps,commitmentsBps,fixedPerSale,minimumSale,explanation:conflict?`Com as regras atuais, essa divisão pode ultrapassar o valor disponível em uma venda. Regras atuais: ${currentBps/100}%. Nova regra: ${(proposed?.rateBps??0)/100}%. Total: ${totalBps/100}%. Escolha uma porcentagem menor ou altere outra regra.`:`Carga potencial: ${totalBps/100}%.${fixedPerSale?` Fixos por venda: ${money(fixedPerSale)}; venda mínima conservadora: ${minimumSale===null?'inviável':money(minimumSale)}.`:''}`};
}
export function requireDistributionCapacity(state:State,proposed?:Pick<AgreementTerms,'rateBps'>,excludeId?:string){const result=validateDistributionCapacity(state,proposed,excludeId);if(result.status==='CONFLICT')throw Error(result.explanation);return result;}
/** Reject an impossible concrete sale; never silently reduce a bilateral promise. */
export function validateSaleCapacity(amount:number,commissions:CommissionRule[],rules:{rateBps:number;commitmentId:string}[],state:State){
 const fixed=commissions.reduce((a,c)=>a+(c.fixedAmount??0),0);
 const percentage=commissions.reduce((a,c)=>a+Math.floor(amount*c.rateBps/10000),0);
 const debts=rules.reduce((a,c)=>a+Math.min(Math.floor(amount*c.rateBps/10000),(()=>{const d=state.commitments.find(d=>d.id===c.commitmentId);return d&&isActive(d)?remainingToAllocate(d):0;})()),0);
 const intended=fixed+percentage+debts;
 return {status:intended>amount?'CONFLICT' as const:'OK' as const,intended,amount,fixed,percentage,debts,explanation:intended>amount?`Venda insuficiente: as regras exigem ${money(intended)}, mas a venda é ${money(amount)}. Ajuste a venda ou renegocie as regras; nenhum destino foi reduzido silenciosamente.`:'Divisão cabe no valor desta venda.'};
}
