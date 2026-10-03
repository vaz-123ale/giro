import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {State} from '../src/domain/models.ts';
import {summary,today,trustSummary} from '../src/domain/finance.ts';
import {shiftDate} from '../src/domain/intelligence.ts';

async function start(directory:string){
 const child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:'3004'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr?.on('data',chunk=>errors+=chunk);
 await new Promise<void>((ok,fail)=>{const timeout=setTimeout(()=>{child.kill();fail(Error('API não iniciou: '+errors));},5000);child.stdout?.once('data',()=>{clearTimeout(timeout);ok();});child.once('error',error=>{clearTimeout(timeout);fail(error);});child.once('exit',code=>{clearTimeout(timeout);fail(Error(`API encerrou: ${code}: ${errors}`));});});return child;
}
async function stop(child:ChildProcess){if(child.exitCode!==null||child.signalCode!==null)return;const exited=new Promise<void>(ok=>child.once('exit',()=>ok()));child.kill();await exited;}
async function call(path:string,body?:unknown){const response=await fetch('http://127.0.0.1:3004/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return {status:response.status,data:await response.json()};}

test('Fase 3 ponta a ponta: João R$600, exemplos, aceite, estoque, risco, renegociação, confiança e reinício',{timeout:20000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-phase3-'));let child:ChildProcess|undefined;const date=today();
 try{
  child=await start(directory);
  assert.equal((await call('cash/open',{opening:0})).status,200);
  const created=await call('commitments',{supplier:'João',debtAmount:60000,rateBps:2000,priority:1,due:shiftDate(date,5)});assert.equal(created.status,200);
  const c=created.data.commitments.find((c:State['commitments'][number])=>!c.demo);assert.equal(c.status,'awaiting_acceptance');assert.equal(c.paid,0);
  const before=(await call('state')).data;
  for(const [amount,destination] of [[5000,1000],[10000,2000],[20000,4000],[8000,1600]]){const result=await call('simulate',{amount,rateBps:2000,remaining:60000});assert.equal(result.status,200);assert.equal(result.data.destination,destination);}
  assert.deepEqual((await call('state')).data,before);
  const premature=await call('sales',{amount:5000,method:'cash',soldAt:date,paidAt:date});assert.equal(premature.data.commitments.find((v:{id:string})=>v.id===c.id).paid,0);
  assert.equal((await call('agreements/decision',{id:c.id,actor:'seller',decision:'accept'})).status,400);
  assert.equal((await call('agreements/decision',{id:c.id,actor:'supplier',decision:'accept'})).status,200);
  const received=await call('sales',{amount:5000,method:'cash',soldAt:date,paidAt:date});assert.equal(received.data.commitments.find((v:{id:string})=>v.id===c.id).paid,0);
  const physicallyPaid=await call('cash/pay',{kind:'supplier',recipientId:c.id,amount:1000,requestId:'phase3-first'});assert.equal(physicallyPaid.status,200);assert.equal(physicallyPaid.data.commitments.find((v:{id:string})=>v.id===c.id).paid,1000);
  // Recebimentos anteriores à criação do acordo alimentam projeção, sem retroatividade.
  for(let i=1;i<7;i++){const day=shiftDate(date,-i);assert.equal((await call('sales',{amount:20000,method:'cash',soldAt:day,paidAt:day})).status,200);}
  const stock=await call('plans',{name:'Novo estoque',target:100000,amount:30000,mode:'suggested',rateBps:1000,priority:2});assert.equal(stock.status,200);const planId=stock.data.plans.find((p:{demo?:boolean})=>!p.demo).id;assert.equal(summary(stock.data).planned,30000);
  assert.equal((await call('settings',{minimumWeeklyFree:30000})).status,200);
  const [forecast]=(await call('forecast')).data;assert.equal(forecast.id,c.id);assert.equal(forecast.classification,'RISCO DE NÃO QUITAÇÃO');assert.ok(forecast.neededBps>2000);assert.ok(forecast.minimumPreserved>0);
  const withSuggestion=await call('sales',{amount:8000,method:'cash',soldAt:date,paidAt:date});const saleId=withSuggestion.data.sales[0].id;assert.equal(withSuggestion.data.sales[0].planningSuggestions[0].amount,800);assert.equal(summary(withSuggestion.data).planned,30000);
  const reserved=await call('plans/reserve',{planId,saleId});assert.equal(reserved.status,200);assert.equal(summary(reserved.data).planned,30800);
  assert.equal((await call('plans/reserve',{planId,saleId})).status,400);
  const unchanged=(await call('state')).data;
  assert.equal((await call('agreements/edit',{id:c.id,actor:'seller',original:60000,rateBps:8000,priority:1,due:date})).status,400);assert.deepEqual((await call('state')).data,unchanged);
  const proposed=await call('renegotiations/request',{id:c.id,actor:'seller',original:60000,rateBps:5000,priority:1,due:shiftDate(date,7),reason:'Ajustar ao fluxo recente'});assert.equal(proposed.status,200);
  const agreement=proposed.data.commitments.find((v:{id:string})=>v.id===c.id);const proposalId=agreement.renegotiations[0].id;assert.equal(agreement.rateBps,2000);
  assert.equal((await call('renegotiations/decision',{id:c.id,proposalId,actor:'seller',decision:'accept'})).status,400);
  const accepted=await call('renegotiations/decision',{id:c.id,proposalId,actor:'supplier',decision:'accept'});assert.equal(accepted.status,200);assert.equal(accepted.data.commitments.find((v:{id:string})=>v.id===c.id).rateBps,5000);
  const completed=await call('sales',{amount:114800,method:'digital',soldAt:date,paidAt:date});assert.equal(completed.status,200);
  const paidFinal=await call('cash/pay',{kind:'supplier',recipientId:c.id,amount:1600,requestId:'phase3-final'});assert.equal(paidFinal.status,200);
  const final=paidFinal.data as State;const agreementFinal=final.commitments.find(v=>v.id===c.id)!;assert.equal(agreementFinal.paid,60000);assert.equal(agreementFinal.status,'completed');assert.equal(agreementFinal.originalDue,shiftDate(date,5));assert.equal(agreementFinal.completionTerms?.due,shiftDate(date,7));assert.ok(agreementFinal.timeline?.some(e=>e.type==='renegotiation_accepted'));assert.ok(agreementFinal.timeline?.some(e=>e.type==='amortized'));assert.equal(agreementFinal.timeline?.at(-1)?.type,'completed');assert.equal(trustSummary(final).completed,1);assert.equal(trustSummary(final).onTime,1);assert.equal(summary(final).planned,30800);
  await stop(child);child=await start(directory);assert.deepEqual((await call('state')).data,final);assert.equal(trustSummary((await call('state')).data).completed,1);
 }finally{if(child)await stop(child);await unlink(join(directory,'giro.sqlite'));await rmdir(directory);}
});

test('API persiste rascunho, recusa e CRUD pessoal sem alterar compromissos',{timeout:15000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-phase3-crud-'));let child:ChildProcess|undefined;
 try{
  child=await start(directory);const date=today();
  const draft=await call('commitments',{supplier:'Ana',debtAmount:60000,alreadyPaid:15000,rateBps:2000,priority:2,due:date,status:'draft'});const c=draft.data.commitments.find((c:{demo?:boolean})=>!c.demo);assert.equal(c.original-c.paid,45000);
  assert.equal((await call('agreements/submit',{id:c.id,actor:'supplier'})).status,400);
  assert.equal((await call('agreements/edit',{id:c.id,actor:'seller',original:60000,rateBps:3000,priority:1,due:date})).status,200);
  assert.equal((await call('agreements/submit',{id:c.id,actor:'seller'})).status,200);
  assert.equal((await call('agreements/decision',{id:c.id,actor:'supplier',decision:'refuse'})).status,200);
  const commitments=(await call('state')).data.commitments;
  assert.equal((await call('sales',{amount:50000,method:'digital',soldAt:today(),paidAt:today()})).status,200);const created=await call('plans',{name:'Estoque',target:100000,amount:30000,mode:'manual'});const p=created.data.plans.find((p:{demo?:boolean})=>!p.demo);
  assert.equal((await call('plans/change',{id:p.id,action:'edit',name:'Reserva',target:50000,amount:20000,mode:'suggested',rateBps:1000})).status,200);
  assert.equal((await call('plans/change',{id:p.id,action:'pause'})).status,200);
  await stop(child);child=await start(directory);const resumed=(await call('state')).data;assert.equal(resumed.plans.find((v:{id:string})=>v.id===p.id).status,'paused');assert.deepEqual(resumed.commitments,commitments);
  assert.equal((await call('plans/change',{id:p.id,action:'resume'})).status,200);assert.equal((await call('plans/change',{id:p.id,action:'delete'})).status,200);const final=(await call('state')).data;assert.equal(final.plans.filter((p:{demo?:boolean})=>!p.demo).length,0);assert.deepEqual(final.commitments,commitments);
 }finally{if(child)await stop(child);await unlink(join(directory,'giro.sqlite'));await rmdir(directory);}
});
