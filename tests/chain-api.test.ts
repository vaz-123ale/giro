import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {State} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
import {shiftDate} from '../src/domain/intelligence.ts';
import {trustReport} from '../src/domain/proof.ts';
import {getBase64Encoder,getBase64EncodedWireTransaction,getTransactionDecoder,signTransaction} from '@solana/kit';
import {LocalChain} from '../server/chain/kit.ts';
import {TestWallets} from '../server/chain/keys.ts';

/**
 * Fases 2–4 do plano Solana com GIRO_SOLANA_CLUSTER=simulado (modelo do programa, sem validador):
 * a mesma jornada do documento, agora com cada passo registrado na rede e conferido pela reconciliação.
 */
async function server(port:string,cluster:string,extra:Record<string,string>={}){
 const directory=await mkdtemp(join(tmpdir(),'giro-rede-'));
 const child=spawn(process.execPath,['--experimental-strip-types','--no-warnings','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:port,GIRO_SOLANA_CLUSTER:cluster,...extra},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',d=>stderr+=d);
 await new Promise<void>((ok,fail)=>{child.stdout.on('data',()=>ok());child.on('exit',code=>fail(Error(`API encerrou: ${code} ${stderr}`)));});
 const call=async(path:string,body?:unknown)=>{const r=await fetch(`http://127.0.0.1:${port}/api/`+path,body?{method:'POST',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:JSON.stringify(body)}:undefined);return {status:r.status,data:await r.json()};};
 const ok=async(path:string,body?:unknown)=>{const r=await call(path,body);assert.equal(r.status,200,`${path}: ${JSON.stringify(r.data)}`);return r.data;};
 const stop=async()=>{const ended=new Promise<void>(done=>child.once('exit',()=>done()));child.kill();await ended;await rm(directory,{recursive:true,force:true});};
 return {call,ok,stop,directory};
}

async function journey(port:string,cluster:string){
 const {call,ok,stop,directory}=await server(port,cluster);
 try{
  const sync=()=>ok('chain/sync',{});
  const row=async(id:string)=>(await ok('chain/reconcile')).rows.find((r:{commitmentId:string})=>r.commitmentId===id);
  // 1. Acordo proposto por Maria e aceito por João: registrado na rede com as duas carteiras.
  const contact=(await ok('contacts',{name:'João',type:'supplier',phone:'11 99999-0000',note:'paga às sextas'})).contacts[0];
  const invitation=(await ok('invitations/send',{contactId:contact.id,debtAmount:60000,rateBps:2000,priority:1,due:shiftDate(today(),7),acknowledged:true})).invitations[0];
  await sync();assert.equal((await row(invitation.commitmentId)).chain.status,'proposed');
  await ok('invitations/decision',{token:invitation.token,decision:'accept',acknowledged:true});await sync();
  let r=await row(invitation.commitmentId);assert.equal(r.state,'registrado',JSON.stringify(r));assert.equal(r.chain.status,'active');
  // 2. Pedro no turno (8%).
  const pedro=(await ok('members',{name:'Pedro',commissionBps:800,compensation:'commission'})).members.find((m:{name:string})=>m.name==='Pedro');
  await ok('members/schedule',{id:pedro.id,days:[0,1,2,3,4,5,6]});const token=(await ok('members/checkin-link',{id:pedro.id})).members.find((m:{id:string})=>m.id===pedro.id).checkinToken;
  await ok('checkin/request',{token,type:'start'});let state:State=await ok('state');await ok('shift/decision',{id:state.shiftRequests![0].id,decision:'confirm'});
  // 3. Cobrança digital de R$ 100: a REDE executa primeiro; o GIRO só registra depois.
  const requestId=crypto.randomUUID();state=await ok('payments/create',{requestId});const payment=state.paymentRequests!.find(p=>p.requestId===requestId)!;
  await ok('payments/amount',{id:payment.id,amount:10000});
  const paid=await ok('payments/confirm',{token:payment.token,acknowledged:true});
  assert.equal(paid.paid,true);assert.match(paid.chain.signature,cluster==='simulado'?/^simulado:/:/^[1-9A-HJ-NP-Za-km-z]{80,90}$/);
  const balances=await ok('chain/balances');
  assert.deepEqual([balances.contatos[contact.id],balances.membros[pedro.id],balances.vendedor,balances.cliente],[2000,800,7200,0],'R$ 20 João, R$ 8 Pedro, R$ 72 Maria');
  r=await row(invitation.commitmentId);assert.equal(r.chain.paid,2000);assert.equal(r.chain.original-r.chain.paid,58000,'saldo do acordo 600 → 580');assert.equal(r.state,'registrado');
  // 4. Dinheiro físico: entregue mas ainda não confirmado por João → a rede espera as duas assinaturas.
  await ok('cash/open',{opening:0});await ok('sales/cash',{amount:300000,method:'cash',soldAt:today(),paidAt:today()});
  state=await ok('cash/pay',{kind:'supplier',recipientId:invitation.commitmentId,amount:58000,requestId:'rede-pagamento'});
  await sync();r=await row(invitation.commitmentId);assert.equal(r.state,'aguardando-confirmacao',JSON.stringify(r));assert.equal(r.chain.status,'active');
  // 4b. Proteção: com dinheiro aguardando confirmação, a rede dividiria diferente → cobrança recusada sem cobrar nada.
  const request2=crypto.randomUUID();state=await ok('payments/create',{requestId:request2});const payment2=state.paymentRequests!.find(p=>p.requestId===request2)!;
  await ok('payments/amount',{id:payment2.id,amount:10000});
  const refused=await call('payments/confirm',{token:payment2.token,acknowledged:true});
  assert.equal(refused.status,400);assert.match(refused.data.error,/dividiria esta venda de forma diferente/);
  assert.equal((await ok('chain/balances')).vendedor,7200,'nada foi cobrado');
  // 5. João confirma o recebimento pelo link → registro com as DUAS assinaturas → acordo concluído na rede → atestado.
  const receipt=(await ok('receipts/request',{paymentId:state.cashPayments![0].id})).receiptConfirmations[0];
  await ok('receipts/decision',{token:receipt.token,decision:'confirm'});await sync();
  r=await row(invitation.commitmentId);assert.equal(r.state,'registrado',JSON.stringify(r));assert.equal(r.chain.status,'completed');assert.equal(r.attested,true,'comprovante atestado');
  const status=await ok('chain/status');assert.deepEqual(status.items[invitation.commitmentId],{state:'registrado',attested:true});
  // 6. Histórico: íntegro → atestado na rede; um centavo alterado → não confere.
  state=await ok('state');const report=JSON.parse(JSON.stringify(await trustReport(state,false)));
  assert.deepEqual((await ok('chain/verify',report)).map((x:{fingerprintMatches:boolean;attested:boolean})=>[x.fingerprintMatches,x.attested]),[[true,true]]);
  report.agreements[0].record.original+=1;
  assert.deepEqual((await ok('chain/verify',report)).map((x:{fingerprintMatches:boolean;attested:boolean})=>[x.fingerprintMatches,x.attested]),[[false,false]]);
  // 7. Privacidade: nada pessoal na fila de envio nem no estado da rede.
  const outbox=JSON.stringify(await ok('chain/outbox'));const recon=await ok('chain/reconcile');
  assert.equal(recon.ok,true,JSON.stringify(recon.summary));
  for(const word of ['João','Pedro','99999','sextas',contact.id,pedro.id,invitation.commitmentId,payment.id])assert.equal(outbox.includes(word),false,`"${word}" não pode ir para a rede`);
  assert.equal((await readdir(join(directory,'carteiras-teste'))).every(f=>/^[a-z0-9-]+\.json$/.test(f)&&!/joao|pedro/i.test(f)),true,'carteiras de teste sem nomes');
 }finally{await stop();}
}
const validatorUp=async()=>{try{const r=await fetch('http://127.0.0.1:8899',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getHealth'}),signal:AbortSignal.timeout(5000)});return (await r.json()).result==='ok';}catch{return false;}};

test('Rede simulada: acordo → venda digital 100 → 20/8/72 na rede → dinheiro com 2 assinaturas → atestado → histórico conferido na rede',{timeout:60000},()=>journey('3021','simulado'));
test('REDE LOCAL (solana-test-validator): a mesma jornada com o programa compilado, token BRL-T e SAS reais',{timeout:300000,skip:!await validatorUp()&&'validador local desligado (bash solana/scripts/validador-local.sh no WSL)'},()=>journey('3024','localnet'));

test('SOLANA PAY na rede local: a carteira do cliente assina e paga; o GIRO só registra depois de achar o pagamento na rede',{timeout:300000,skip:!await validatorUp()&&'validador local desligado'},async()=>{
 const {call,ok,stop,directory}=await server('3025','localnet');
 try{
  const contact=(await ok('contacts',{name:'João',type:'supplier'})).contacts[0];
  const invitation=(await ok('invitations/send',{contactId:contact.id,debtAmount:60000,rateBps:2000,priority:1,due:shiftDate(today(),7),acknowledged:true})).invitations[0];
  await ok('invitations/decision',{token:invitation.token,decision:'accept',acknowledged:true});await ok('chain/sync',{});
  const requestId=crypto.randomUUID();let state:State=await ok('payments/create',{requestId});const p=state.paymentRequests!.find(x=>x.requestId===requestId)!;
  await ok('payments/amount',{id:p.id,amount:10000});
  // Carteira EXTERNA de teste do cliente (com SOL e BRL-T de teste do validador local).
  const chain=new LocalChain('http://127.0.0.1:8899',new TestWallets(join(directory,'carteiras-teste')));
  await chain.fund('carteira-externa');await chain.mintTo('carteira-externa',10000n);const wallet=await chain.signer('carteira-externa');
  // GET (rótulo) e POST (transação) do Solana Pay.
  assert.match((await ok(`solana-pay/${p.token}`)).label,/rede local de teste/);
  const req=await ok(`solana-pay/${p.token}`,{account:wallet.address});assert.match(req.message,/R\$\s?100,00.*TESTE/);
  assert.equal((await ok(`solana-pay/${p.token}/verificar`,{})).paid,false,'antes de pagar, nada é registrado');
  // A carteira assina e envia; o servidor do GIRO não assina nada.
  const tx=getTransactionDecoder().decode(getBase64Encoder().encode(req.transaction));
  const signed=await signTransaction([wallet.keyPair],tx);
  const sig=await chain.rpc.sendTransaction(getBase64EncodedWireTransaction(signed),{encoding:'base64'}).send();
  for(let i=0;i<60;i++){const st=(await chain.rpc.getSignatureStatuses([sig]).send()).value[0];if(st?.err)assert.fail(JSON.stringify(st.err));if(st?.confirmationStatus==='confirmed'||st?.confirmationStatus==='finalized')break;await new Promise(r=>setTimeout(r,500));}
  const view=await ok(`solana-pay/${p.token}/verificar`,{});
  assert.equal(view.paid,true);assert.match(view.chain.signature,/^[1-9A-HJ-NP-Za-km-z]{80,90}$/);
  const balances=await ok('chain/balances');assert.deepEqual([balances.contatos[contact.id],balances.vendedor],[2000,8000]);
  assert.equal(await chain.tokenBalance('carteira-externa'),0n,'o cliente pagou com o próprio saldo');
  const row=(await ok('chain/reconcile')).rows.find((r:{commitmentId:string})=>r.commitmentId===invitation.commitmentId);
  assert.equal(row.state,'registrado',JSON.stringify(row));assert.equal(row.chain.paid,2000);
  // Mesma cobrança não pode ser paga de novo.
  assert.equal((await call(`solana-pay/${p.token}`,{account:wallet.address})).status,400);
 }finally{await stop();}
});

test('Rede desligada (padrão): rotas da rede respondem que está desligada e nada muda',{timeout:30000},async()=>{
 const {call,ok,stop}=await server('3022','disabled');
 try{
  assert.deepEqual(await ok('chain/status'),{enabled:false,cluster:'disabled'});
  assert.equal((await call('chain/reconcile')).status,409);
  const requestId=crypto.randomUUID();const state:State=await ok('payments/create',{requestId});const p=state.paymentRequests!.find(x=>x.requestId===requestId)!;
  await ok('payments/amount',{id:p.id,amount:5000});const view=await ok('payments/confirm',{token:p.token,acknowledged:true});
  assert.equal(view.paid,true);assert.equal('chain' in view,false);
 }finally{await stop();}
});

test('Rede local sem validador: fica pendente, explica o que falta e não perde nada',{timeout:30000},async()=>{
 const {ok,stop}=await server('3023','localnet',{GIRO_SOLANA_RPC:'http://127.0.0.1:18999'});
 try{
  const contact=(await ok('contacts',{name:'Ana',type:'supplier'})).contacts[0];
  await ok('invitations/send',{contactId:contact.id,debtAmount:1000,rateBps:1000,priority:1,due:shiftDate(today(),7),acknowledged:true});
  const s=await ok('chain/sync',{});assert.equal(s.available,false);assert.equal(s.outbox.pendente,1);assert.match(s.lastError,/Validador local não responde|cliente do programa/);
 }finally{await stop();}
});
