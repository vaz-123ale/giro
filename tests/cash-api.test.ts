import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import type {State} from '../src/domain/models.ts';
import {today,manualTrustSummary} from '../src/domain/finance.ts';
import {cashSummary} from '../src/domain/cash.ts';
async function start(directory:string){const child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:'3006'},stdio:['ignore','pipe','pipe']});let errors='';child.stderr?.on('data',chunk=>errors+=chunk);await new Promise<void>((ok,fail)=>{const timer=setTimeout(()=>{child.kill();fail(Error(errors||'API não iniciou.'));},5000);child.stdout?.once('data',()=>{clearTimeout(timer);ok();});child.once('error',e=>{clearTimeout(timer);fail(e);});child.once('exit',code=>{clearTimeout(timer);fail(Error(`API encerrou: ${code}: ${errors}`));});});return child;}
async function stop(child:ChildProcess){if(child.exitCode!==null||child.signalCode!==null)return;const ended=new Promise<void>(ok=>child.once('exit',()=>ok()));child.kill();await ended;}
async function call(path:string,body?:unknown){const r=await fetch('http://127.0.0.1:3006/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return {status:r.status,data:await r.json()};}
test('caixa 21 API: reinício preserva abertura, livro, pagamentos, contagem e diferença',{timeout:20000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-cash-'));let child:ChildProcess|undefined;
 try{
  child=await start(directory);assert.equal((await call('cash/open',{opening:10000})).status,200);assert.equal((await call('cash/open',{opening:100})).status,400);
  const created=await call('commitments',{supplier:'João',debtAmount:10000,rateBps:2000,priority:1,due:today()});const c=created.data.commitments.find((c:{demo?:boolean})=>!c.demo);assert.equal((await call('agreements/decision',{id:c.id,actor:'supplier',decision:'accept'})).status,200);assert.equal((await call('shift',{id:'pedro'})).status,200);
  const received=await call('sales',{amount:10000,method:'cash',soldAt:today(),paidAt:today()});assert.equal(received.status,200);assert.equal(received.data.commitments.find((v:{id:string})=>v.id===c.id).paid,0);assert.equal(cashSummary(received.data).expected,20000);const d=received.data.cashDestinations.find((d:{kind:string})=>d.kind==='supplier');
  assert.equal((await call('cash/separate',{destinationId:d.id})).status,200);
  assert.equal((await call('cash/pay',{kind:'supplier',recipientId:c.id,amount:2001,requestId:'too-much'})).status,400);
  assert.equal((await call('cash/pay',{kind:'supplier',recipientId:c.id,amount:1000,requestId:'supplier-partial'})).status,200);
  const duplicate=await Promise.all([call('cash/pay',{kind:'commission',recipientId:'pedro',amount:400,requestId:'commission-one'}),call('cash/pay',{kind:'commission',recipientId:'pedro',amount:400,requestId:'commission-one'})]);assert.deepEqual(duplicate.map(r=>r.status).sort(),[200,400]);
  const before=(await call('state')).data as State;assert.equal(cashSummary(before).expected,18600);assert.equal(before.cashPayments?.length,2);const sales=structuredClone(before.sales);const commitments=structuredClone(before.commitments);
  const closed=await call('cash/close',{counted:18500});assert.equal(closed.status,200);assert.equal(closed.data.cashSessions[0].closure.difference,-100);assert.deepEqual(closed.data.sales,sales);assert.deepEqual(closed.data.commitments,commitments);assert.equal((await call('cash/close',{counted:0})).status,400);assert.deepEqual((await call('state')).data,closed.data);
  await stop(child);child=await start(directory);assert.deepEqual((await call('state')).data,closed.data);
 }finally{if(child)await stop(child);await unlink(join(directory,'giro.sqlite'));await rmdir(directory);}
});
test('migração SQLite 3→4 guarda backup exato e só confirmação física conclui acordo antigo',{timeout:20000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-cash-migration-'));const file=join(directory,'giro.sqlite');let child:ChildProcess|undefined;
 const old:State={schemaVersion:3,demo:false,members:[],plans:[],sales:[{id:'old-sale',amount:1000,soldAt:today(),paidAt:today(),method:'cash',participant:null,commissionBps:0,rules:[],distribution:[{kind:'commitment',recipientId:'c',recipient:'João',amount:1000,rateBps:10000,mode:'to_separate',remainingAfter:0}]}],commitments:[{id:'c',supplier:'João',original:1000,paid:1000,rateBps:10000,priority:1,createdAt:today(),due:today(),status:'completed',completedAt:today(),completionSaleId:'old-sale'}]};
 const db=new DatabaseSync(file);db.exec('CREATE TABLE local_state (id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO local_state VALUES(1,?)').run(JSON.stringify(old));db.close();
 try{
  child=await start(directory);const migrated=(await call('state')).data as State;assert.equal(migrated.schemaVersion,4);assert.deepEqual(migrated.sales,old.sales);assert.equal(migrated.commitments[0].paid,0);assert.equal(migrated.commitments[0].cashPending,1000);assert.equal(migrated.commitments[0].status,'active');assert.equal(manualTrustSummary(migrated).completed,0);
  await stop(child);child=undefined;const inspect=new DatabaseSync(file,{readOnly:true});const backup=inspect.prepare('SELECT payload FROM local_state_backups WHERE version=3').get() as {payload:string};assert.deepEqual(JSON.parse(backup.payload),old);inspect.close();
  child=await start(directory);assert.deepEqual((await call('state')).data,migrated);assert.equal((await call('cash/open',{opening:1000})).status,200);const paid=await call('cash/pay',{kind:'supplier',recipientId:'c',amount:1000,requestId:'legacy-actual-payment'});assert.equal(paid.status,200);assert.equal(paid.data.commitments[0].status,'completed');assert.equal(paid.data.commitments[0].paid,1000);assert.equal(cashSummary(paid.data).expected,0);assert.equal(manualTrustSummary(paid.data).completed,1);
  await stop(child);child=await start(directory);assert.deepEqual((await call('state')).data,paid.data);
 }finally{if(child)await stop(child);await unlink(file);await rmdir(directory);}
});
