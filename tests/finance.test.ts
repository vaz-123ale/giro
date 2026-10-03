import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allocation,summary,today} from '../src/domain/finance.ts';
import {requireLocalEndpoint} from '../server/solana.ts';
test('obrigação não recebe mais que o restante',()=>assert.equal(allocation(5000,2000,300),300));
test('valores inválidos são rejeitados',()=>assert.throws(()=>allocation(-1,2000,300)));
test('venda pendente não aumenta saldo livre',()=>{const state={demo:true,plans:[],members:[],commitments:[],sales:[{id:'1',amount:4000,soldAt:today(),paidAt:null,method:'cash' as const,participant:'Pedro',commissionBps:800,rules:[]}]};assert.equal(summary(state).total,0);});
test('planejamento e comissão reservam valores sem saldo negativo',()=>{const state={demo:true,plans:[{id:'p',name:'Estoque',amount:2000}],members:[],commitments:[],sales:[{id:'1',amount:1000,soldAt:today(),paidAt:today(),method:'cash' as const,participant:'Pedro',commissionBps:800,rules:[]}]};const totals=summary(state);assert.equal(totals.free,0);assert.equal(totals.committed,80);assert.equal(totals.planned,920);assert.equal(totals.reserved,1000);});
test('endpoints externos são bloqueados',()=>{assert.throws(()=>requireLocalEndpoint('https://api.devnet.solana.com'));assert.equal(requireLocalEndpoint('http://127.0.0.1:8899').hostname,'127.0.0.1');});
