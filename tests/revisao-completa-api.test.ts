import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {State} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
import {notificationFeed} from '../src/domain/notifications.ts';
test('revisão API: novos fluxos persistem, invalidam repetição e preservam transações após reinício',{timeout:30000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-review-'));let child:ChildProcess|undefined;
 const start=async()=>{child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:'3015'},stdio:['ignore','pipe','pipe']});const running=child;await new Promise<void>((ok,fail)=>{const timer=setTimeout(()=>{running.kill();fail(Error('API não iniciou'));},8000);running.stdout?.once('data',()=>{clearTimeout(timer);ok();});running.once('error',fail);});};
 const stop=async()=>{if(!child||child.exitCode!==null||child.signalCode!==null)return;const ended=new Promise<void>(resolve=>child!.once('exit',()=>resolve()));child.kill();await ended;};
 const call=async(path:string,input?:unknown)=>{const response=await fetch('http://127.0.0.1:3015/api/'+path,input===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:response.status,data:await response.json()};};
 try{
  await start();await call('sales',{amount:200000,method:'digital',soldAt:today(),paidAt:today()});
  const beforeCash=(await call('state')).data;assert.equal((await call('sales/cash',{amount:1000,method:'cash',soldAt:today(),paidAt:today()})).status,400);assert.deepEqual((await call('state')).data,beforeCash);
  const p=(await call('plans',{kind:'account',name:'Energia',target:100000,amount:60000,targetDate:today(),mode:'automatic',rateBps:1000})).data.plans.find((p:State['plans'][number])=>!p.demo);
  const requestId=randomUUID(),payment={id:p.id,amount:20000,useFreeBalance:true,origin:'digital_simulated',date:today(),acknowledged:true,requestId};assert.equal((await call('accounts/pay',payment)).status,200);const paid=(await call('state')).data;assert.equal(paid.plans.find((n:State['plans'][number])=>n.id===p.id).amount,60000);assert.equal((await call('accounts/pay',payment)).status,400);assert.deepEqual((await call('state')).data,paid);
  const goal=(await call('plans',{name:'Estoque',target:20000,amount:0,mode:'manual'})).data.plans.find((n:State['plans'][number])=>n.name==='Estoque'),deposit={id:goal.id,amount:10000,requestId:randomUUID()};assert.equal((await call('plans/contribute',deposit)).status,200);const contributed=(await call('state')).data;assert.equal((await call('plans/contribute',deposit)).status,400);assert.deepEqual((await call('state')).data,contributed);
  const person=(await call('contacts',{name:'Ana',type:'collaborator'})).data.contacts.find((n:{name:string})=>n.name==='Ana');await call('invitations/send',{contactId:person.id,debtAmount:10000,rateBps:1000,priority:1,due:today(),acknowledged:true});const s=(await call('state')).data as State,invite=s.invitations![0],c=s.commitments.find(c=>c.id===invite.commitmentId)!;
  assert.equal((await call('commitments/consult',{id:c.publicId,token:'bad'})).status,400);const view=await call('commitments/consult',{id:c.publicId,token:invite.token});assert.equal(view.status,200);assert.equal(view.data.publicId,c.publicId);assert.equal('sales' in view.data,false);await call('invitations/decision',{token:invite.token,decision:'refuse'});assert.equal((await call('commitments/consult',{id:c.publicId,token:invite.token})).data.state,'refused');
  const m=(await call('members',{name:'Lucas',commissionBps:1000})).data.members.find((m:{name:string})=>m.name==='Lucas');await call('shift',{id:m.id});await call('sales',{amount:10000,method:'digital',soldAt:today(),paidAt:today()});assert.equal((await call('members/change',{id:m.id,action:'disable'})).status,200);const disabled=(await call('state')).data;assert.equal((await call('members/change',{id:m.id,action:'delete'})).status,400);assert.deepEqual((await call('state')).data,disabled);
  await call('cash/open',{opening:10000,responsible:'Maria'});const inflow={amount:2000,description:'Reposição',requestId:randomUUID()};assert.equal((await call('cash/inflow',inflow)).status,200);const cash=(await call('state')).data;assert.equal((await call('cash/inflow',inflow)).status,400);assert.deepEqual((await call('state')).data,cash);
  const notice=notificationFeed(cash).find(n=>n.id.startsWith('derived:cash:'))!;assert.equal((await call('notifications/read',{id:notice.id})).status,200);assert.equal((await call('sales/cash',{amount:1000,method:'cash',soldAt:today(),paidAt:today()})).status,200);assert.equal((await call('cash/close',{counted:13000})).status,200);const closed=(await call('state')).data;assert.equal((await call('cash/close',{counted:13000})).status,400);assert.deepEqual((await call('state')).data,closed);const final=(await call('state')).data;await stop();await start();const restored=(await call('state')).data;assert.deepEqual(restored,final);assert.ok(restored.notifications.find((n:{id:string;readAt?:string})=>n.id===notice.id)?.readAt);
 }finally{await stop();await unlink(join(directory,'giro.sqlite'));await rmdir(directory);}
});
