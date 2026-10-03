import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import type {State} from '../src/domain/models.ts';
import {summary,today,trustSummary} from '../src/domain/finance.ts';

async function start(directory:string){
 const child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:'3003'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr?.on('data',chunk=>errors+=chunk);
 await new Promise<void>((ok,fail)=>{const timeout=setTimeout(()=>{child.kill();fail(Error('API não iniciou: '+errors));},5000);child.stdout?.once('data',()=>{clearTimeout(timeout);ok();});child.once('error',error=>{clearTimeout(timeout);fail(error);});child.once('exit',code=>{clearTimeout(timeout);fail(Error(`API encerrou: ${code}: ${errors}`));});});
 return child;
}
async function stop(child:ChildProcess){if(child.exitCode!==null||child.signalCode!==null)return;const exited=new Promise<void>(ok=>child.once('exit',()=>ok()));child.kill();await exited;}
async function call(path:string,body?:unknown){const response=await fetch('http://127.0.0.1:3003/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return {status:response.status,data:await response.json()};}

test('fluxo completo local, recebimento idempotente e persistência após reiniciar backend',{timeout:20000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-phase2-'));let child:ChildProcess|undefined;
 try{
  child=await start(directory);const date=today();
  assert.equal((await call('cash/open',{opening:0})).status,200);
  const created=await call('commitments',{supplier:'Fornecedor João',original:10000,remaining:10000,rateBps:2000,priority:1,due:date});assert.equal(created.status,200);
  const agreement=created.data.commitments.find((c:State['commitments'][number])=>!c.demo);assert.ok(agreement.id);
  assert.equal((await call('agreements/decision',{id:agreement.id,actor:'supplier',decision:'accept'})).status,200);
  assert.equal((await call('shift',{id:'pedro'})).status,200);
  let first=await call('sales',{amount:5000,method:'cash',soldAt:date,paidAt:date});assert.equal(first.status,200);
  assert.deepEqual(first.data.sales[0].distribution.map((e:Record<string,unknown>)=>[e.recipient,e.amount]),[['Pedro',400],['Fornecedor João',1000],['Maria',3600]]);
  assert.equal(first.data.commitments.find((c:{id:string})=>c.id===agreement.id).paid,0);
  first=await call('cash/pay',{kind:'supplier',recipientId:agreement.id,amount:1000,requestId:'phase2-first'});assert.equal(first.status,200);
  assert.equal(summary(first.data).free,3600);assert.equal(first.data.commitments.find((c:{id:string})=>c.id===agreement.id).paid,1000);
  const finalPayment=await call('sales',{amount:45000,method:'digital',soldAt:date,paidAt:date});assert.equal(finalPayment.status,200);assert.equal(finalPayment.data.commitments.find((c:{id:string})=>c.id===agreement.id).status,'completed');assert.equal(trustSummary(finalPayment.data).completed,1);
  const after=await call('sales',{amount:5000,method:'cash',soldAt:date,paidAt:date});assert.equal(after.data.sales[0].distribution.filter((e:{kind:string})=>e.kind==='commitment').length,0);
  const nextAgreement=await call('commitments',{supplier:'Fornecedor Ana',original:1000,remaining:300,rateBps:2000,priority:2,due:date});assert.equal(nextAgreement.status,200);
  assert.equal((await call('agreements/decision',{id:nextAgreement.data.commitments.find((c:{demo?:boolean})=>!c.demo).id,actor:'supplier',decision:'accept'})).status,200);
  const pending=await call('sales',{amount:5000,method:'cash',soldAt:date,paidAt:null});assert.equal(pending.status,200);const pendingId=pending.data.sales[0].id;
  await call('shift',{id:'pedro'});
  const duplicate=await Promise.all([call('receive',{id:pendingId,paidAt:date}),call('receive',{id:pendingId,paidAt:date})]);assert.deepEqual(duplicate.map(r=>r.status).sort(),[200,400]);
  const paid=await call('cash/pay',{kind:'supplier',recipientId:nextAgreement.data.commitments.find((c:{demo?:boolean})=>!c.demo).id,amount:300,requestId:'phase2-last'});assert.equal(paid.status,200);
  const state=(await call('state')).data as State;const received=state.sales.find(s=>s.id===pendingId)!;
  assert.equal(received.participant,'Pedro');assert.equal(received.distribution?.find(e=>e.kind==='commission')?.amount,400);assert.equal(received.distribution?.find(e=>e.kind==='commitment')?.amount,300);assert.equal(received.distribution?.at(-1)?.amount,4300);
  assert.equal(trustSummary(state).completed,2);assert.equal(summary(state).total,60000);assert.equal(summary(state).free,44900);
  const bad=await call('commitments',{supplier:'Inválido',original:100,remaining:200,rateBps:2000,priority:1,due:date});assert.equal(bad.status,400);assert.deepEqual((await call('state')).data,state);
  const cancellation=await call('commitments/cancel',{id:agreement.id});assert.equal(cancellation.status,404);assert.deepEqual((await call('state')).data,state);
  await stop(child);child=await start(directory);
  const restarted=(await call('state')).data;assert.deepEqual(restarted,state);assert.deepEqual(trustSummary(restarted),trustSummary(state));assert.equal(summary(restarted).free,44900);
 }finally{if(child)await stop(child);await unlink(join(directory,'giro.sqlite'));await rmdir(directory);}
});

test('banco Fase 1 é migrado com backup, mantendo registros existentes',{timeout:15000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-migration-'));const file=join(directory,'giro.sqlite');let child:ChildProcess|undefined;
 const original:State={demo:true,sales:[{id:'old-sale',amount:5000,soldAt:'2026-09-29',paidAt:'2026-10-01',method:'cash',participant:'Pedro',commissionBps:800,rules:['Turno original']}],commitments:[],plans:[],members:[{id:'pedro',name:'Pedro',commissionBps:800,active:false}]};
 const db=new DatabaseSync(file);db.exec('CREATE TABLE local_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)');db.prepare('INSERT INTO local_state VALUES(1,?)').run(JSON.stringify(original));db.close();
 try{
  child=await start(directory);const migrated=(await call('state')).data as State;assert.equal(migrated.schemaVersion,4);assert.equal(migrated.sales.length,1);assert.equal(migrated.sales[0].participant,'Pedro');assert.equal(migrated.sales[0].soldAt,'2026-09-29');assert.equal(migrated.sales[0].paidAt,'2026-10-01');assert.equal(summary(migrated).free,4600);assert.equal(trustSummary(migrated).completed,0);
  await stop(child);child=undefined;const inspect=new DatabaseSync(file);const backup=inspect.prepare('SELECT payload FROM local_state_backups WHERE version=1').get() as {payload:string};assert.deepEqual(JSON.parse(backup.payload),original);inspect.close();
 }finally{if(child)await stop(child);await unlink(file);await rmdir(directory);}
});
