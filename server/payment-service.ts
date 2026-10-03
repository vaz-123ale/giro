import {randomBytes,randomUUID} from 'node:crypto';
import type {State} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
import {inputRecord} from './input.ts';
import {createSale,receiveSale} from './financial-service.ts';
export function createPayment(state:State,value:unknown){const v=inputRecord(value);if(typeof v.requestId!=='string'||! /^[a-f0-9-]{36}$/.test(v.requestId))throw Error('Identificador inválido.');if(state.paymentRequests?.some(p=>p.requestId===v.requestId))return; (state.paymentRequests??=[]).push({id:randomUUID(),token:randomBytes(24).toString('hex'),requestId:v.requestId,createdAt:new Date().toISOString()});}
export function paymentView(state:State,token:string){const p=state.paymentRequests?.find(p=>p.token===token);if(!p)throw Error('Cobrança não encontrada.');const sale=state.sales.find(s=>s.id===p.saleId);return {amount:sale?.amount??null,paid:!!sale?.paidAt,simulation:true,...(p.chainSignature?{chain:{signature:p.chainSignature,testToken:true}}:{})};}
export function amountPayment(state:State,value:unknown){const v=inputRecord(value);const p=state.paymentRequests?.find(p=>p.id===v.id);if(!p||p.saleId)throw Error('Cobrança indisponível ou valor já definido.');const sale=createSale(state,{amount:v.amount,method:'digital',soldAt:today(),paidAt:null,participantIds:v.participantIds});p.saleId=sale.id;}
export function confirmPayment(state:State,value:unknown){const v=inputRecord(value);if(v.acknowledged!==true)throw Error('Confirme que este é um pagamento simulado.');const p=state.paymentRequests?.find(p=>p.token===v.token);if(!p?.saleId)throw Error('Aguarde o estabelecimento definir o valor.');receiveSale(state,{id:p.saleId,paidAt:today()});}
