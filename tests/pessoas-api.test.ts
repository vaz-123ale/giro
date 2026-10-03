import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {State} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
import {shiftDate} from '../src/domain/intelligence.ts';
import {setPassword} from '../server/auth.ts';

/**
 * Teste em grupo: a dona cria as contas das colegas; cada uma entra com usuário e senha, troca a senha, põe foto,
 * vê só os próprios acordos e os perfis (contratos + confiança) das outras. Acesso externo (túnel) simulado.
 */
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('Pessoas: contas das colegas, perfis com foto, acordos próprios e venda dividida entre todas',{timeout:60000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-pessoas-'));const port='3028';const ORIGIN='https://giro-grupo.exemplo';
 setPassword(directory,'senha-da-dona-123');
 const child=spawn(process.execPath,['--experimental-strip-types','--no-warnings','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:port,GIRO_PUBLIC_URL:ORIGIN,GIRO_PUBLICO:'sim',GIRO_SOLANA_CLUSTER:'disabled'},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',d=>stderr+=d);
 await new Promise<void>((ok,fail)=>{child.stdout.on('data',()=>ok());child.on('exit',code=>fail(Error(`API encerrou: ${code} ${stderr}`)));});
 const as=(cookie='')=>{
  const call=async(path:string,body?:unknown)=>{const r=await fetch(`http://127.0.0.1:${port}/api/`+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:ORIGIN,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():null,headers:r.headers};};
  const ok=async(path:string,body?:unknown)=>{const r=await call(path,body);assert.equal(r.status,200,`${path}: ${JSON.stringify(r.data)}`);return r.data;};
  return {call,ok};
 };
 const login=async(usuario:string,senha:string)=>{const r=await as().call('login',{usuario,senha});assert.equal(r.status,200,JSON.stringify(r.data));return as(String(r.headers.get('set-cookie')).split(';')[0]);};
 try{
  assert.equal((await as().call('state')).status,401);
  const dona=await login('dona','senha-da-dona-123');
  // 1. A dona cria as contas (fornecedora, ajudante com 8% e cliente).
  const ana=await dona.ok('pessoas',{name:'Ana Fornecedora',login:'ana',role:'fornecedor'});
  const bia=await dona.ok('pessoas',{name:'Bia Ajudante',login:'bia',role:'ajudante',commissionBps:800});
  const cris=await dona.ok('pessoas',{name:'Cris Cliente',login:'cris',role:'cliente'});
  assert.match(ana.password,/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.equal((await dona.call('pessoas',{name:'X',login:'ana',role:'cliente'})).status,400,'usuário repetido');
  assert.equal((await dona.call('pessoas',{name:'X',login:'dona',role:'cliente'})).status,400,'"dona" é reservado');
  const list=await dona.ok('pessoas');assert.equal(list.people.length,3);assert.equal(JSON.stringify(list).includes('hash'),false,'hash de senha nunca sai');
  // 2. Ana entra: não vê o negócio; troca a senha provisória; põe foto.
  assert.equal((await as().call('login',{usuario:'ana',senha:'errada-123'})).status,400);
  let anaS=await login('ana',ana.password);
  assert.equal((await anaS.call('state')).status,403,'colega não vê o painel do negócio');
  assert.equal((await anaS.call('pessoas')).status,403);
  let eu=await anaS.ok('eu');assert.equal(eu.person.mustChange,true);
  assert.equal((await anaS.call('eu/senha',{atual:ana.password,nova:'curta'})).status,400);
  await anaS.ok('eu/senha',{atual:ana.password,nova:'nova-senha-da-ana'});await anaS.ok('eu/foto',{photo:PNG});
  assert.equal((await anaS.call('eu/foto',{photo:'data:text/html;base64,PHNjcmlwdD4='})).status,400,'só imagem');
  anaS=await login('ana','nova-senha-da-ana');eu=await anaS.ok('eu');assert.equal(eu.person.mustChange,false);assert.ok(eu.person.photo);
  // 3. A dona propõe o acordo para Ana (20% até R$ 300); Ana vê em "Meus acordos" e aceita pelo link.
  const state:State=await dona.ok('state');const anaContact=state.contacts!.find(c=>c.name==='Ana Fornecedora')!;
  const inv=(await dona.ok('invitations/send',{contactId:anaContact.id,debtAmount:30000,rateBps:2000,priority:1,due:shiftDate(today(),30),acknowledged:true})).invitations[0];
  eu=await anaS.ok('eu');assert.equal(eu.agreements.length,1);assert.equal(eu.agreements[0].link,`/convite/${inv.token}`);assert.equal(eu.agreements[0].waiting,true);
  await anaS.ok('invitations/decision',{token:inv.token,decision:'accept',acknowledged:true});
  // 4. Bia entra no turno pelo link dela; a dona confirma.
  const biaS=await login('bia',bia.password);const biaEu=await biaS.ok('eu');assert.ok(biaEu.shift.link.startsWith('/turno/'));
  await biaS.ok('checkin/request',{token:biaEu.shift.link.split('/')[2],type:'start'});
  await dona.ok('shift/decision',{id:(await dona.ok('state')).shiftRequests[0].id,decision:'confirm'});
  // 5. Venda de R$ 10: R$ 0,80 Bia, R$ 2,00 Ana, R$ 7,20 o negócio.
  const sale=await dona.ok('sales',{amount:1000,method:'digital',soldAt:today(),paidAt:today()});
  assert.deepEqual(sale.sales[0].distribution.map((e:{amount:number})=>e.amount),[80,200,720]);
  // 6. Perfis: todas veem todas; contratos e confiança; foto servida como imagem.
  const crisS=await login('cris',cris.password);const perfis=await crisS.ok('perfis');assert.equal(perfis.length,4);
  const anaPerfil=await crisS.ok(`perfis/${ana.profile.split('/')[2]}`);assert.equal(anaPerfil.stats.total,1);assert.equal(anaPerfil.agreements[0].paid,200);
  assert.equal((await crisS.ok(`perfis/${bia.profile.split('/')[2]}`)).commissionsReceived,80);
  const foto=await crisS.call(`fotos/${ana.profile.split('/')[2]}`);assert.equal(foto.status,200);assert.equal(foto.headers.get('content-type'),'image/png');
  const negocio=await crisS.ok(`perfis/${list.business.slug}`);assert.equal(negocio.stats.active,1);
  // 7. Cris (cliente) não vê os acordos de outras pessoas como "meus".
  assert.equal((await crisS.ok('eu')).agreements.length,0);
  // 8. Sem login, perfis e fotos ficam fechados.
  assert.equal((await as().call('perfis')).status,401);assert.equal((await as().call(`fotos/${ana.profile.split('/')[2]}`)).status,401);
 }finally{const ended=new Promise<void>(done=>child.once('exit',()=>done()));child.kill();await ended;await rm(directory,{recursive:true,force:true});}
});
