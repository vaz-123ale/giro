import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {State} from '../src/domain/models.ts';
test('API mantém datas, comissão e persistência sem alterar acordos',{timeout:20000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-test-'));
 const child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:'3002'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise<void>((ok,fail)=>{child.stdout.on('data',()=>ok());child.on('error',fail);child.on('exit',code=>fail(Error(`API encerrou: ${code}`)));});
  const call=async(path:string,body?:unknown)=>{const response=await fetch('http://127.0.0.1:3002/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return {status:response.status,data:await response.json()};};
  const initial=(await call('state')).data as State;
  assert.equal((await call('shift',{id:'pedro'})).status,200);
  const pending=await call('sales',{amount:3500,method:'cash',soldAt:'2026-09-29',paidAt:null});
  assert.equal(pending.status,200);assert.equal(pending.data.sales[0].participant,'Pedro');assert.equal(pending.data.sales[0].commissionBps,800);
  await call('shift',{id:'pedro'});
  const delayed=await call('sales',{amount:5000,method:'digital',soldAt:'2026-09-29',paidAt:'2026-10-01'});
  assert.equal(delayed.status,200);assert.equal(delayed.data.sales[0].participant,null);assert.notEqual(delayed.data.sales[0].soldAt,delayed.data.sales[0].paidAt);
  assert.equal((await call('sales',{amount:-1,method:'cash',soldAt:'2026-10-02',paidAt:null})).status,400);
  assert.equal((await call('sales',{amount:100,method:'cash',soldAt:'2026-10-02',paidAt:'2026-10-01'})).status,400);
  const final=(await call('state')).data as State;
  assert.equal(final.sales.length,initial.sales.length+2);assert.equal(final.sales[1].participant,'Pedro');assert.deepEqual(final.commitments,initial.commitments);
  const blocked=await fetch('http://127.0.0.1:3002/api/state',{headers:{Origin:'https://example.com'}});assert.equal(blocked.status,403);
 }finally{
  const ended=new Promise<void>(ok=>child.once('exit',()=>ok()));child.kill();await ended;
  await unlink(join(directory,'giro.sqlite'));await rmdir(directory);
 }
});
