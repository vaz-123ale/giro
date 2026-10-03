import type {State} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
import {requireAmount} from '../src/domain/validation.ts';
import {inputRecord} from './input.ts';
import {createSale} from './financial-service.ts';

export interface SalePreviewPart {kind:'commission'|'commitment'|'reserve'|'free';recipient:string;amount:number}
export interface SalePreview {amount:number;parts:SalePreviewPart[];basis?:string;conflict?:string}

/**
 * "Para onde vai cada venda": simula uma venda digital recebida hoje numa CÓPIA do estado,
 * usando exatamente o mesmo motor da venda real (turnos ativos, acordos aceitos, prioridades,
 * limites de saldo e reservas automáticas). Nada é gravado.
 */
export function previewSale(state:State,value:unknown):SalePreview{
 const input=inputRecord(value);requireAmount(input.amount);const amount=input.amount as number;
 const copy=structuredClone(state);
 try{
  const sale=createSale(copy,{amount,method:'digital',soldAt:today(),paidAt:today()});
  const parts:SalePreviewPart[]=[];
  for(const e of sale.distribution??[])if(e.kind!=='seller'&&e.amount>0)parts.push({kind:e.kind==='commitment'?'commitment':'commission',recipient:e.recipient,amount:e.amount});
  let reserved=0;
  for(const e of copy.planEvents??[])if(e.saleId===sale.id&&e.type==='reserved'&&e.after>e.before){parts.push({kind:'reserve',recipient:e.name,amount:e.after-e.before});reserved+=e.after-e.before;}
  const seller=(sale.distribution??[]).filter(e=>e.kind==='seller').reduce((a,e)=>a+e.amount,0);
  parts.push({kind:'free',recipient:'Livre para você',amount:Math.max(0,seller-reserved)});
  return {amount,parts,basis:sale.rules?.[0]};
 }catch(error){return {amount,parts:[],conflict:error instanceof Error?error.message:'Não foi possível simular.'};}
}
