import {test} from 'node:test';
import assert from 'node:assert/strict';
import {myView} from '../server/profile-service.ts';
import type {State} from '../src/domain/models.ts';
import type {Person} from '../server/people.ts';
test('painel pessoal limita turnos e confirmações à própria pessoa e não conta vendas pendentes',()=>{
 const p:Person={id:'lia',login:'lia',name:'Lia',slug:'lia',role:'ajudante',memberId:'m1',mustChange:false,createdAt:'2026-10-01'};
 const s:State={demo:false,commitments:[],plans:[],members:[{id:'m1',name:'Lia',active:false,commissionBps:1000,schedule:[2,4]}],shifts:[{id:'t1',memberId:'m1',name:'Lia',rateBps:1000,startedAt:'2026-10-01T09:00:00Z',endedAt:'2026-10-01T15:00:00Z'},{id:'outro',memberId:'m2',name:'Outra',rateBps:1000,startedAt:'2026-10-01T09:00:00Z'}],sales:[{id:'s1',amount:10000,soldAt:'2026-10-01',paidAt:'2026-10-01',method:'digital',participant:'Lia',commissionBps:1000,rules:[],commissions:[{memberId:'m1',name:'Lia',rateBps:1000,shiftId:'t1'}],distribution:[{kind:'commission',recipientId:'m1',recipient:'Lia',amount:1000,rateBps:1000,mode:'simulated'}]}],receiptConfirmations:[{id:'r1',token:'token1',paymentId:'pay1',kind:'commission',recipientId:'m1',recipient:'Lia',amount:1000,paidAt:'2026-10-01',createdAt:'2026-10-01',state:'waiting'},{id:'r2',token:'token2',paymentId:'pay2',kind:'commission',recipientId:'m2',recipient:'Outra',amount:5000,paidAt:'2026-10-01',createdAt:'2026-10-01',state:'waiting'}]};
 s.sales.push({...s.sales[0],id:'pendente',paidAt:null}, {...s.sales[0],id:'exemplo',demo:true});
 const view=myView(s,p,{},'Barraca Maria');
 assert.equal(view.work?.businessName,'Barraca Maria');assert.equal(view.work?.shifts.length,1);assert.equal(view.work?.shifts[0].hours,6);assert.equal(view.work?.shifts[0].amount,1000);assert.deepEqual(view.work?.schedule,[2,4]);assert.equal(view.receipts.length,1);assert.equal(view.receipts[0].link,'/confirmar/token1');
});
