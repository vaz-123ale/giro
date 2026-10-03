import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
test('API cobrança e diária persistem em banco isolado sem replay',{timeout:20000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'giro-adjustments-'));let child:ReturnType<typeof spawn>;
 const start=async()=>{child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:dir,GIRO_PORT:'3008'},stdio:['ignore','pipe','pipe']});await new Promise<void>((ok,fail)=>{child.stdout!.once('data',()=>ok());child.once('error',fail);child.once('exit',code=>fail(Error(`API encerrou ${code}`)));});};
 const stop=async()=>{const done=new Promise<void>(ok=>child.once('exit',()=>ok()));child.kill();await done;};
 const call=async(path:string,input?:unknown)=>{const r=await fetch('http://127.0.0.1:3008/api/'+path,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:undefined);return {status:r.status,body:await r.json()};};
 try{await start();const requestId=randomUUID();let result=await call('payments/create',{requestId});assert.equal(result.status,200);const p=result.body.paymentRequests[0];result=await call('payments/amount',{id:p.id,amount:2500});assert.equal(result.status,200);assert.equal((await call('payments/'+p.token)).body.amount,2500);assert.equal((await call('payments/confirm',{token:p.token,acknowledged:true})).status,200);assert.equal((await call('payments/confirm',{token:p.token,acknowledged:true})).status,400);assert.equal((await call('settings',{minimumWeeklyFree:12000})).status,200);assert.equal((await call('members',{name:'Ana',compensation:'daily',commissionBps:0,dailyAmount:10000})).status,200);await stop();await start();const s=(await call('state')).body;assert.equal(s.paymentRequests[0].token,p.token);assert.equal(s.sales.find((sale:{id:string})=>sale.id===s.paymentRequests[0].saleId).amount,2500);assert.equal(s.settings.minimumWeeklyFree,12000);assert.equal(s.members.at(-1).dailyAmount,10000);assert.deepEqual(Object.keys((await call('payments/'+p.token)).body).sort(),['amount','paid','simulation']);}
 finally{if(child!&&!child!.killed)await stop();await unlink(join(dir,'giro.sqlite'));await rmdir(dir);}
});
