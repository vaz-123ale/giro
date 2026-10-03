import type {Commitment,CommissionRule,Sale} from './models.ts';
import {type ChainTerms,type GiroAcordosModel,type SettleSaleInput,dueToTs,isoToTs,orderKey,settlementOrder} from './chain-model.ts';

/**
 * Tradução GIRO → instruções do programa. Só chaves públicas, centavos, bps e datas (sem nomes).
 * As carteiras são resolvidas por quem chama (carteiras de teste na fase local; Wallet Standard no futuro).
 */
export interface ChainParties {seller:string;mint:string;payer:string;memberWallet:(memberId:string)=>string}

export const chainTerms=(c:Pick<Commitment,'original'|'rateBps'|'priority'|'due'>):ChainTerms=>({original:BigInt(c.original),rateBps:c.rateBps,priority:c.priority,dueTs:dueToTs(c.due)});

/** Parâmetros de propose(): a data de criação é a do GIRO (dia), para a ordem ser a mesma do motor local. */
export const proposeParams=(c:Commitment,seller:string,supplier:string,mint:string,agreementKey:string,now:bigint)=>({seller,supplier,mint,agreementKey,terms:chainTerms(c),paidBefore:BigInt(c.paid),now,createdTs:isoToTs(c.createdAt)});

/** Mesma ordem do motor local: fixos por venda primeiro (estável), depois percentuais. */
export function chainCommissions(sale:Sale,memberWallet:(id:string)=>string){
 const rules:CommissionRule[]=sale.commissions??(sale.participant?[{memberId:sale.participant,name:sale.participant,rateBps:sale.commissionBps}]:[]);
 return {fixed:rules.filter(r=>r.fixedAmount!==undefined).map(r=>({to:memberWallet(r.memberId),amount:BigInt(r.fixedAmount!)})),
  percent:rules.filter(r=>r.fixedAmount===undefined).map(r=>({to:memberWallet(r.memberId),rateBps:r.rateBps}))};
}

/**
 * Monta settle_sale com TODOS os acordos ativos do vendedor na rede.
 * Ordem: a do motor local (prioridade → data → id interno) para os acordos capturados na venda;
 * acordos ativos na rede que a venda não capturou entram pela ordem padrão (o dry-run acusa a diferença).
 * keyOf: id do compromisso no GIRO → agreement_key (hash), calculado antes por quem chama.
 */
export function settleInput(model:GiroAcordosModel,sale:Sale,parties:ChainParties,now:bigint,keyOf:(commitmentId:string)=>string|undefined=()=>undefined):SettleSaleInput{
 const rules=[...(sale.commitmentRules??[])].sort((a,b)=>a.priority-b.priority||a.createdAt.localeCompare(b.createdAt)||a.commitmentId.localeCompare(b.commitmentId));
 const ordered=orderAgreements(model,parties.seller,rules.map(r=>keyOf(r.commitmentId)).filter(k=>k!==undefined));
 return {payer:parties.payer,seller:parties.seller,mint:parties.mint,amount:BigInt(sale.amount),now,...chainCommissions(sale,parties.memberWallet),
  agreements:ordered.map(a=>({agreementKey:a.agreementKey,supplierTokenOwner:a.supplier}))};
}

/** Todos os acordos ativos do vendedor: primeiro na ordem preferida (a do GIRO), os demais pela ordem padrão; ordenação estável pela chave exigida. */
export function orderAgreements(model:GiroAcordosModel,seller:string,preferred:string[]){
 const active=[...model.agreements.values()].filter(a=>a.seller===seller&&a.status==='active');
 const first=preferred.map(k=>active.find(a=>a.agreementKey===k)).filter(a=>a!==undefined);
 return [...first,...active.filter(a=>!first.includes(a)).sort(settlementOrder)].sort(orderKey);
}
