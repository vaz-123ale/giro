import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {State} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
import {shiftDate} from '../src/domain/intelligence.ts';
test('FA API transação, recorrência, diárias, identidade e previsão persistem após reinício',{timeout:25000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-fase-a-'));let child:ChildProcess|undefined;
 const start=async()=>{child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:'3014'},stdio:['ignore','pipe','pipe']});const processChild=child;await new Promise<void>((ok,fail)=>{const timeout=setTimeout(()=>{processChild.kill();fail(Error('API não iniciou'));},6000);processChild.stdout?.once('data',()=>{clearTimeout(timeout);ok();});processChild.once('error',e=>{clearTimeout(timeout);fail(e);});processChild.once('exit',c=>{clearTimeout(timeout);fail(Error('API encerrou '+c));});});};
 const stop=async()=>{if(!child||child.exitCode!==null||child.signalCode!==null)return;const ended=new Promise<void>(ok=>child!.once('exit',()=>ok()));child.kill();await ended;};
 const call=async(path:string,input?:unknown)=>{const r=await fetch('http://127.0.0.1:3014/api/'+path,input===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:r.status,data:await r.json()};};
 try{
  await start();assert.equal((await call('cash/open',{opening:0})).status,200);assert.equal((await call('sales',{amount:100000,method:'cash',soldAt:today(),paidAt:today()})).status,200);
  const created=await call('plans',{kind:'account',name:'Energia',category:'Operação',target:18000,amount:18000,targetDate:shiftDate(today(),7),recurrence:'weekly',mode:'manual'});assert.equal(created.status,200);const p=(created.data as State).plans.find(p=>p.kind==='account')!;
  const requestId=randomUUID(),input={id:p.id,amount:18000,date:today(),origin:'cash',acknowledged:true,requestId};const paid=await call('accounts/pay',input);assert.equal(paid.status,200);const paidState=paid.data as State;assert.equal(paidState.plans.find(n=>n.id===p.id)?.accountStatus,'paid');assert.equal(paidState.plans.filter(n=>n.recurrenceId===p.recurrenceId).length,2);
  assert.equal((await call('accounts/pay',input)).status,400);assert.deepEqual((await call('state')).data,paidState);
  const memberCreated=await call('members',{name:'Lucas',commissionBps:0,compensation:'daily',dailyAmount:12000});assert.equal(memberCreated.status,200);const m=(memberCreated.data as State).members.find(m=>m.name==='Lucas')!;
  assert.equal((await call('team/daily/schedule',{memberId:m.id,date:shiftDate(today(),2)})).status,200);assert.equal((await call('team/daily',{memberId:m.id,date:today(),acknowledged:true})).status,200);
  const w=((await call('state')).data as State).dailyWages![0];assert.equal((await call('team/daily/pay',{id:w.id,amount:4000,requestId:randomUUID(),acknowledged:true})).status,200);
  const people=await call('contacts',{name:'João',type:'supplier'}),contact=(people.data as State).contacts![0];const sent=await call('invitations/send',{contactId:contact.id,debtAmount:60000,rateBps:2000,priority:1,due:shiftDate(today(),7),acknowledged:true});assert.equal(sent.status,200);const i=(sent.data as State).invitations![0];
  const accepted=await call('invitations/decision',{token:i.token,decision:'accept',acknowledged:true});assert.equal(accepted.status,200);assert.equal(accepted.data.authentication,'local_simulation');assert.equal('sales' in accepted.data,false);
  assert.equal((await call('notifications/refresh',{})).status,200);const forecast=await call('forecast/global?until='+shiftDate(today(),21));assert.equal(forecast.status,200);assert.ok(forecast.data.items.some((r:{category:string})=>r.category==='Conta recorrente futura'));assert.ok(forecast.data.items.some((r:{category:string})=>r.category==='Diária futura confirmada'));assert.equal((await call('forecast/global?until=invalid')).status,400);
  const before=(await call('state')).data as State;await stop();await start();assert.deepEqual((await call('state')).data,before);assert.deepEqual((await call('forecast/global?until='+shiftDate(today(),21))).data,forecast.data);assert.equal(before.schemaVersion,4);assert.equal(before.accountPayments?.length,1);assert.equal(before.dailyPayments?.length,1);assert.equal(before.invitations?.[0].recipientId,contact.id);
 }finally{await stop();await unlink(join(directory,'giro.sqlite'));await rmdir(directory);}
});
