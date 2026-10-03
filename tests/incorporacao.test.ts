import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {State} from '../src/domain/models.ts';
import {createCommitment,createSale} from '../server/financial-service.ts';
import {decideAgreement} from '../server/agreement-service.ts';
import {openCash,payCash} from '../server/cash-service.ts';
import {createMember,toggleShift} from '../server/team-service.ts';
import {createPlan} from '../server/planning-service.ts';
import {previewSale} from '../server/preview-service.ts';
import {requestReceipt,receiptView,decideReceipt} from '../server/receipt-service.ts';
import {setSchedule,issueCheckin,checkinView,requestShift,decideShift} from '../server/shift-request-service.ts';
import {today} from '../src/domain/finance.ts';
import {shiftDate} from '../src/domain/intelligence.ts';
import {parseDocument} from '../src/domain/import.ts';
import {planPace} from '../src/domain/pace.ts';
import {completionRecord,fingerprint,trustReport,verifyReport,completedAgreements} from '../src/domain/proof.ts';

const base=():State=>({schemaVersion:4,demo:false,sales:[],commitments:[],plans:[],members:[]});
function accepted(s:State,original=60000,rateBps=2000){const c=createCommitment(s,{supplier:'João',debtAmount:original,rateBps,priority:1,due:shiftDate(today(),10)});decideAgreement(s,{id:c.id,actor:'supplier',decision:'accept'});return c;}

test('Prévia "para onde vai cada venda" usa o motor real e não grava nada', ()=>{
 const s=base();accepted(s);const pedro=createMember(s,{name:'Pedro',commissionBps:800});toggleShift(s,{id:pedro.id});
 const before=JSON.stringify(s);const p=previewSale(s,{amount:10000});
 assert.equal(JSON.stringify(s),before,'estado original intacto');
 const by=(k:string)=>p.parts.filter(x=>x.kind===k).reduce((a,x)=>a+x.amount,0);
 assert.equal(by('commitment'),2000);assert.equal(by('commission'),800);assert.equal(by('free'),7200);
 assert.equal(p.parts.reduce((a,x)=>a+x.amount,0),10000,'partes somam o valor da venda');
 const real=createSale(s,{amount:10000,method:'digital',soldAt:today(),paidAt:today()});
 assert.equal(real.distribution!.find(e=>e.kind==='commitment')!.amount,by('commitment'),'prévia igual à venda real');
});
test('Prévia nunca destina mais do que falta na obrigação', ()=>{
 const s=base();accepted(s,300,2000);const p=previewSale(s,{amount:10000});
 assert.equal(p.parts.find(x=>x.kind==='commitment')!.amount,300);
});
test('Importação: lê o exemplo do documento, sugere recorrência e ignora linhas sem valor/data', ()=>{
 const rows=parseDocument('Fornecedor João — R$ 600 — vencimento em 08/10\nAluguel R$ 900,00 10/10/2026\nEnergia;184,70;14/10\nEnergia;190,10;14/11\nsem dados',`${today().slice(0,4)}-10-01`);
 assert.equal(rows.length,4);assert.deepEqual([rows[0].name,rows[0].amount],['Fornecedor João',60000]);
 assert.equal(rows[0].due.slice(5),'10-08');assert.equal(rows[2].recurring,true);assert.equal(rows[1].recurring,false);
});
test('Ritmo de meta: sugere percentual maior só quando o atual não basta', ()=>{
 const s=base();s.sales.push({id:'r',amount:70000,soldAt:today(),paidAt:today(),method:'digital',participant:null,commissionBps:0,rules:[]});
 createPlan(s,{kind:'goal',name:'Estoque',target:50000,amount:0,mode:'automatic',rateBps:1000,targetDate:shiftDate(today(),10)});
 const pace=planPace(s,s.plans[0])!;assert.ok(pace);assert.equal(pace.projectedRevenue,100000);assert.equal(pace.neededBps,5000);assert.equal(pace.feasible,true);
 s.plans[0].rateBps=6000;assert.equal(planPace(s,s.plans[0]),null);
});
test('Confirmação da outra parte: link único, resposta única e notificação ao vendedor', ()=>{
 const s=base();openCash(s,{opening:100000});const c=accepted(s,10000,2000);createSale(s,{amount:10000,method:'cash',soldAt:today(),paidAt:today()});
 const pay=payCash(s,{kind:'supplier',recipientId:c.id,amount:2000,requestId:randomUUID()});
 const r=requestReceipt(s,{paymentId:pay.id});assert.equal(requestReceipt(s,{paymentId:pay.id}).token,r.token,'idempotente');
 assert.deepEqual(Object.keys(receiptView(s,r.token)).sort(),['amount','authentication','decidedAt','kind','paidAt','recipient','state']);
 decideReceipt(s,{token:r.token,decision:'confirm'});assert.equal(s.receiptConfirmations![0].state,'confirmed');
 assert.throws(()=>decideReceipt(s,{token:r.token,decision:'dispute'}),/já foi respondido/);
 assert.equal(s.notifications![0].type,'SUCCESS');
});
test('Comprovante: impressão digital estável, histórico verificável e adulteração detectada', async()=>{
 const s=base();openCash(s,{opening:100000});const c=accepted(s,2000,10000);createSale(s,{amount:2000,method:'cash',soldAt:today(),paidAt:today()});
 const pay=payCash(s,{kind:'supplier',recipientId:c.id,amount:2000,requestId:randomUUID()});decideReceipt(s,{token:requestReceipt(s,{paymentId:pay.id}).token,decision:'confirm'});
 assert.equal(completedAgreements(s).length,1);const rec=completionRecord(s,c);assert.equal(rec.payments[0].confirmedByRecipient,true);
 assert.equal(await fingerprint(rec),await fingerprint(completionRecord(s,c)));
 const report=await trustReport(s,true);assert.equal(report.agreements[0].record.counterparty,'Parceiro 1');assert.equal(report.summary.cashPaymentsConfirmedByBoth,1);
 assert.equal((await verifyReport(JSON.parse(JSON.stringify(report)))).valid,true);
 const tampered=JSON.parse(JSON.stringify(report));tampered.agreements[0].record.original=999999;
 const v=await verifyReport(tampered);assert.equal(v.valid,false);assert.equal(v.items[0].valid,false);
 assert.equal((await verifyReport({format:'outro'})).valid,false);
});
test('Escala e check-in: pedido do trabalhador só vale após o vendedor confirmar', ()=>{
 const s=base();const m=createMember(s,{name:'Pedro',commissionBps:800});
 setSchedule(s,{id:m.id,days:[1,3,3,5]});assert.deepEqual(s.members[0].schedule,[1,3,5]);assert.throws(()=>setSchedule(s,{id:m.id,days:[9]}));
 const token=issueCheckin(s,{id:m.id});assert.equal(issueCheckin(s,{id:m.id}),token);
 requestShift(s,{token,type:'start'});assert.equal(s.members[0].active,false,'ainda não ativo');
 assert.throws(()=>requestShift(s,{token,type:'start'}),/aguardando/);
 decideShift(s,{id:s.shiftRequests![0].id,decision:'confirm'});assert.equal(s.members[0].active,true);
 assert.equal(s.shifts![0].startedAt,s.shiftRequests![0].at,'turno começa no horário do pedido');
 requestShift(s,{token,type:'end'});decideShift(s,{id:s.shiftRequests![0].id,decision:'refuse'});assert.equal(s.members[0].active,true);
 assert.equal(checkinView(s,token).active,true);assert.throws(()=>checkinView(s,'0'.repeat(48)));
});
test('Importação e "Usar X%" enviam dados aceitos pelo serviço de planejamento', async()=>{
 const {changePlan}=await import('../server/planning-service.ts');
 const s=base();const due=shiftDate(today(),20);
 const conta=createPlan(s,{kind:'account',name:'Energia',target:18470,amount:0,category:'Importado',recurrence:'monthly',priority:null,targetDate:due,mode:'manual',rateBps:0});
 assert.equal(conta.kind,'account');assert.equal(conta.target,18470);assert.ok(s.recurringAccounts?.length,'regra mensal criada');
 const meta=createPlan(s,{kind:'goal',name:'Estoque',target:50000,amount:0,mode:'automatic',rateBps:1000,targetDate:due});
 changePlan(s,{id:meta.id,action:'edit',kind:meta.kind,name:meta.name,category:meta.category,target:meta.target,amount:meta.amount,priority:meta.priority??null,targetDate:meta.targetDate,mode:meta.mode,rateBps:5000});
 assert.equal(s.plans.find(p=>p.id===meta.id)!.rateBps,5000);
});
