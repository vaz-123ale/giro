import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {today} from '../src/domain/finance.ts';
async function start(directory:string){const child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:'3007'},stdio:['ignore','pipe','pipe']});let errors='';child.stderr?.on('data',chunk=>errors+=chunk);await new Promise<void>((ok,fail)=>{const timer=setTimeout(()=>{child.kill();fail(Error(errors||'API não iniciou'));},5000);child.stdout?.once('data',()=>{clearTimeout(timer);ok();});child.once('error',e=>{clearTimeout(timer);fail(e);});child.once('exit',code=>{clearTimeout(timer);fail(Error(`${code}: ${errors}`));});});return child;}
async function stop(child:ChildProcess){if(child.exitCode!==null||child.signalCode!==null)return;const ended=new Promise<void>(ok=>child.once('exit',()=>ok()));child.kill();await ended;}
async function call(path:string,body?:unknown){const r=await fetch('http://127.0.0.1:3007/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);return {status:r.status,data:await r.json()};}
test('UX API: contato, convite, aceite, mudança, notificações e termos sobrevivem ao reinício',{timeout:20000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-ux-'));let child:ChildProcess|undefined;
 try{child=await start(directory);const original=(await call('state')).data;
  assert.equal((await call('contacts',{name:'João',phone:'11999999999',note:'Privado'})).status,200);let s=(await call('state')).data;const contactId=s.contacts[0].id;
  assert.equal((await call('invitations/send',{contactId,debtAmount:60000,rateBps:2000,priority:2,due:today(),acknowledged:false})).status,400);
  assert.equal((await call('state')).data.commitments.length,original.commitments.length);
  s=(await call('invitations/send',{contactId,debtAmount:60000,rateBps:2000,priority:2,due:today(),acknowledged:true})).data;const invite=s.invitations[0];
  const recipient=await call('invitations/'+invite.token);assert.equal(recipient.status,200);assert.equal(recipient.data.actionable,true);for(const key of ['contacts','phone','note','sales','cashSessions','commitments'])assert.equal(key in recipient.data,false);
  const duplicated=await Promise.all([call('invitations/decision',{token:invite.token,decision:'accept',acknowledged:true}),call('invitations/decision',{token:invite.token,decision:'accept',acknowledged:true})]);assert.deepEqual(duplicated.map(r=>r.status).sort(),[200,400]);assert.equal('sales' in duplicated.find(r=>r.status===200)!.data,false);
  s=(await call('state')).data;const c=s.commitments.find((c:{id:string})=>c.id===invite.commitmentId);assert.equal(c.status,'active');assert.equal(s.notifications.length,2);assert.deepEqual(s.sales,original.sales);
  s=(await call('invitations/change',{id:c.id,original:60000,rateBps:2500,priority:1,due:today(),reason:'Mudar parcela',acknowledged:true})).data;const change=s.invitations[0];assert.equal(s.commitments.find((v:{id:string})=>v.id===c.id).rateBps,2000);
  const view=(await call('invitations/'+change.token)).data;assert.equal(view.previous.priority,2);assert.equal(view.terms.priority,1);
  assert.equal((await call('invitations/decision',{token:change.token,decision:'refuse'})).status,200);s=(await call('state')).data;assert.equal(s.commitments.find((v:{id:string})=>v.id===c.id).rateBps,2000);
  s=(await call('invitations/change',{id:c.id,original:60000,rateBps:2500,priority:1,due:today(),acknowledged:true})).data;const accepted=s.invitations[0];assert.equal((await call('invitations/decision',{token:accepted.token,decision:'accept',acknowledged:true})).status,200);
  s=(await call('state')).data;assert.equal(s.commitments.find((v:{id:string})=>v.id===c.id).version,2);assert.equal((await call('notifications/read',{id:s.notifications[0].id})).status,200);const before=(await call('state')).data;
  await stop(child);child=await start(directory);assert.deepEqual((await call('state')).data,before);assert.equal((await call('invitations/'+accepted.token)).data.state,'accepted');
 }finally{if(child)await stop(child);await unlink(join(directory,'giro.sqlite'));await rmdir(directory);}
});
test('UX API: decisão inválida reverte estado inteiro e rotas especiais servem página sem expor banco',{timeout:20000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-ux-reject-'));let child:ChildProcess|undefined;
 try{child=await start(directory);let s=(await call('contacts',{name:'João'})).data;s=(await call('invitations/send',{contactId:s.contacts[0].id,debtAmount:1000,rateBps:2000,priority:1,due:today(),acknowledged:true})).data;const token=s.invitations[0].token;
  assert.equal((await call('invitations/decision',{token,decision:'wrong',acknowledged:true})).status,400);assert.deepEqual((await call('state')).data,s);
  assert.equal((await call('invitations/decision',{token,decision:'accept',acknowledged:false})).status,400);assert.deepEqual((await call('state')).data,s);
  assert.equal((await call('invitations/'+('0'.repeat(48)))).status,400);
  for(const path of ['/convite/'+token,'/pagar/local-id']){const r=await fetch('http://127.0.0.1:3007'+path);assert.equal(r.status,200);assert.match(r.headers.get('content-type')!,/text\/html/);assert.match(await r.text(),/id="root"/);}
 }finally{if(child)await stop(child);await unlink(join(directory,'giro.sqlite'));await rmdir(directory);}
});
