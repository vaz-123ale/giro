import type {AgreementTerms,State} from './models.ts';
import {validateDistributionCapacity} from './capacity.ts';

export const allocationCondition='Percentuais sobre o bruto: fixos por venda, comissoes percentuais, acordos e restante do vendedor. Propostas com carga potencial acima de 100% sao bloqueadas. Vendas pequenas insuficientes para fixos e percentuais sao rejeitadas antes do registro. Prioridade ordena regras flexiveis; nao reduz silenciosamente um acordo aceito. A parcela e limitada ao restante da divida, inclusive a zero quando nada falta destinar. Dinheiro fisico exige entrega confirmada; digital e simulado localmente.';
export function allocationDisclosure(state:State,proposed:AgreementTerms,excludeId?:string){
 const capacity=validateDistributionCapacity(state,proposed,excludeId);const total=capacity.totalBps;
 return {totalBps:total,conflict:total>10000,text:`${allocationCondition} ${capacity.explanation} Regras ativas e propostas conhecidas nesta revisão: ${total/100}% (incluindo este pedido e comissões do turno atual). ${total>10000?'Conflito: a soma supera 100%; não há saldo para atender todas as porcentagens integralmente.':'Mesmo sem conflito agora, o turno e outros acordos podem mudar; o limite disponível continua valendo.'}`};
}
