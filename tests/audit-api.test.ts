import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {State} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
async function start(directory:string){
 const child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:'3005'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr?.on('data',chunk=>errors+=chunk);
 await new Promise<void>((ok,fail)=>{const timer=setTimeout(()=>{child.kill();fail(Error(errors||'API não iniciou.'));},5000);child.stdout?.once('data',()=>{clearTimeout(timer);ok();});child.once('error',e=>{clearTimeout(timer);fail(e);});child.once('exit',code=>{clearTimeout(timer);fail(Error(`API encerrou: ${code}: ${errors}`));});});return child;
}
async function stop(child:ChildProcess){if(child.exitCode!==null||child.signalCode!==null)return;const ended=new Promise<void>(ok=>child.once('exit',()=>ok()));child.kill();await ended;}
async function call(path:string,body?:unknown){const r=await fetch('http://127.0.0.1:3005/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return {status:r.status,data:await r.json()};}
test('auditoria API: cadastro, turno histórico, recebimento e reservas persistem após reinício',{timeout:20000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-audit-'));let child:ChildProcess|undefined;
 try{
  child=await start(directory);const registered=await call('members',{name:'Ana',commissionBps:800});assert.equal(registered.status,200);const m=registered.data.members.at(-1);
  assert.equal((await call('members',{name:'Inválido',commissionBps:10001})).status,400);assert.deepEqual((await call('state')).data,registered.data);
  assert.equal((await call('shift',{id:m.id,at:'2000-01-01T11:00:00Z'})).status,200);
  assert.equal((await call('shift',{id:m.id,at:'2000-01-01T19:00:00Z'})).status,200);
  const pending=await call('sales',{amount:10000,method:'cash',soldAt:'2000-01-01',soldTime:'14:32',paidAt:null});assert.equal(pending.status,200);const saleId=pending.data.sales[0].id;assert.equal(pending.data.sales[0].participant,'Ana');
  const received=await call('receive',{id:saleId,paidAt:today()});assert.equal(received.status,200);assert.equal(received.data.sales[0].distribution[0].amount,800);
  const plan=await call('plans',{name:'Reserva',target:10000,amount:1000,mode:'manual'});assert.equal(plan.status,200);const p=plan.data.plans.find((p:{demo?:boolean})=>!p.demo);
  assert.equal((await call('plans/change',{id:p.id,action:'delete'})).status,200);assert.equal((await call('settings',{minimumWeeklyFree:3000})).status,200);
  const before=(await call('state')).data as State;assert.equal(before.shifts?.length,1);assert.equal(before.planEvents?.at(-1)?.type,'deleted');
  await stop(child);child=await start(directory);assert.deepEqual((await call('state')).data,before);
  const invalid=await call('shift',{id:m.id,at:'1999-12-31T11:00:00Z'});assert.equal(invalid.status,400);assert.deepEqual((await call('state')).data,before);
 }finally{if(child)await stop(child);await unlink(join(directory,'giro.sqlite'));await rmdir(directory);}
});
