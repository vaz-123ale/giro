import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getBase64Encoder,getBase64EncodedWireTransaction,getTransactionDecoder,signTransaction,type KeyPairSigner} from '@solana/kit';
import type {State} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
import {shiftDate} from '../src/domain/intelligence.ts';
import {setPassword} from '../server/auth.ts';
import {LocalChain} from '../server/chain/kit.ts';
import {TestWallets,base58,keypairFromSecret,signMessage} from '../server/chain/keys.ts';

/**
 * Fluxo das REDES PÚBLICAS (Devnet/mainnet), ensaiado no validador local com GIRO_ASSINATURA=carteira:
 * login obrigatório; cada pessoa assina na PRÓPRIA carteira (aqui, carteiras externas de teste deste arquivo);
 * o servidor só monta as transações e confere na rede o que foi assinado. Pulado se o validador estiver desligado.
 */
/** GIRO_TESTE_REDE=devnet roda o MESMO ensaio na Devnet real (só à mão; nunca no npm test). */
const DEVNET=process.env.GIRO_TESTE_REDE==='devnet';
const RPC=DEVNET?'https://api.devnet.solana.com':'http://127.0.0.1:8899';
const SCALE=DEVNET?100n:1n;
const up=async()=>{if(!DEVNET&&process.env.GIRO_TESTE_REDE)return false;try{const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getHealth'}),signal:AbortSignal.timeout(5000)});return (await r.json()).result==='ok';}catch{return false;}};

test(`${DEVNET?'DEVNET REAL — ':''}MODO CARTEIRA + LOGIN: negócio, fornecedor e cliente assinam nas próprias carteiras; o servidor não assina por ninguém`,{timeout:600000,skip:!await up()&&'validador local desligado'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-carteira-'));const port='3027';const ORIGIN='https://giro-teste.exemplo';
 setPassword(directory,'senha-de-teste-123');
 const {mkdirSync,copyFileSync}=await import('node:fs');
 // Devnet: usa o emissor e o BRZ de teste do GIRO (cópia das chaves; os dados reais não são tocados).
 if(DEVNET){mkdirSync(join(directory,'carteiras-teste'),{recursive:true});for(const f of ['emissor.json','mint-brz-teste.json'])copyFileSync(join('data','carteiras-teste',f),join(directory,'carteiras-teste',f));}
 const child=spawn(process.execPath,['--experimental-strip-types','--no-warnings','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:port,...(DEVNET?{GIRO_SOLANA_CLUSTER:'devnet',GIRO_AUTORIZACAO_DEVNET:'sim'}:{GIRO_SOLANA_CLUSTER:'localnet',GIRO_ASSINATURA:'carteira'}),GIRO_PUBLIC_URL:ORIGIN,GIRO_PUBLICO:'sim',GIRO_TETO_VENDA_CENTAVOS:'50000'},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',d=>stderr+=d);
 await new Promise<void>((ok,fail)=>{child.stdout.on('data',()=>ok());child.on('exit',code=>fail(Error(`API encerrou: ${code} ${stderr}`)));});
 let cookie='';const log=(m:string)=>{if(process.env.GIRO_TESTE_DETALHE)process.stderr.write(`[carteira] ${m}
`);};
 const call=async(path:string,body?:unknown,auth=true)=>{const r=await fetch(`http://127.0.0.1:${port}/api/`+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:ORIGIN,...(auth&&cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),headers:r.headers};};
 const ok=async(path:string,body?:unknown,auth=true)=>{const r=await call(path,body,auth);assert.equal(r.status,200,`${path}: ${JSON.stringify(r.data)}`);return r.data;};
 // Carteiras EXTERNAS (fora do servidor): negócio, João e cliente.
 const ext=new LocalChain(RPC,new TestWallets(mkdtempSync(join(tmpdir(),'giro-carteiras-externas-'))));
 log('fundos');
 if(DEVNET){// faucet tem limite: as carteiras de teste recebem 0,15 SOL da carteira de implantação
  const {getTransferSolInstruction}=await import('@solana-program/system');const dir=mkdtempSync(join(tmpdir(),'giro-impl-'));
  (await import('node:fs')).copyFileSync('solana/keys/implantador.json',join(dir,'implantador.json'));const impl=new LocalChain(RPC,new TestWallets(dir));const from=await impl.signer('implantador');
  await impl.send(from,['negocio','joao','cliente'].map(r=>getTransferSolInstruction({source:from,destination:ext.address(r),amount:150_000_000n})));
 }else for(const r of ['negocio','joao','cliente'])await ext.fund(r);
 log('fundos ok');
 const negocio=await ext.signer('negocio'),joao=await ext.signer('joao'),cliente=await ext.signer('cliente');
 const kp=(s:KeyPairSigner,role:string)=>keypairFromSecret((ext as unknown as {wallets:TestWallets}).wallets.get(role).secret);
 const sendSigned=async(b64:string,signer:KeyPairSigner)=>{const tx=getTransactionDecoder().decode(getBase64Encoder().encode(b64));const signed=await signTransaction([signer.keyPair],tx);
  const sig=await ext.rpc.sendTransaction(getBase64EncodedWireTransaction(signed),{encoding:'base64',preflightCommitment:'confirmed'}).send();
  for(let i=0;i<60;i++){const st=(await ext.rpc.getSignatureStatuses([sig]).send()).value[0];if(st?.err)assert.fail(JSON.stringify(st.err));if(st?.confirmationStatus==='confirmed'||st?.confirmationStatus==='finalized')break;await new Promise(r=>setTimeout(r,400));}return sig;};
 const bind=async(path:string,msgPath:string,signer:KeyPairSigner,role:string)=>{const {message}=await ok(`${msgPath}?endereco=${signer.address}`);return ok(path,{address:signer.address,message,signature:base58(signMessage(kp(signer,role),new TextEncoder().encode(message)))});};
 /** Assina, na carteira externa, cada item pendente listado (negócio: painel; fornecedor: link). */
 const signAll=async(list:string,prefix:(id:number)=>string,signer:KeyPairSigner)=>{let n=0;for(let round=0;round<5;round++){await ok('chain/sync',{});const items=(await ok(list)).items as {id:number}[];if(!items.length)break;
  for(const it of items){const {transaction}=await ok(`${prefix(it.id)}/transacao`,{account:signer.address});const sig=await sendSigned(transaction,signer);assert.equal((await ok(`${prefix(it.id)}/assinada`,{signature:sig})).confirmed,true);n++;}}return n;};
 try{
  // 1. Login obrigatório; sem sessão nada do negócio aparece.
  log('// 1. Login obrigatório; sem sessão nada do negócio aparece.');
  assert.equal((await call('state',undefined,false)).status,401);
  assert.equal((await call('login',{senha:'errada'},false)).status,400);
  const login=await call('login',{senha:'senha-de-teste-123'},false);assert.equal(login.status,200);cookie=String(login.headers.get('set-cookie')).split(';')[0];
  assert.match(String(login.headers.get('set-cookie')),/HttpOnly; Secure; SameSite=Strict/);
  assert.deepEqual(await ok('chain/status',undefined,false),{enabled:true,cluster:DEVNET?'devnet':'localnet'},'sem sessão: só a rede, sem itens');
  // 2. Negócio vincula a carteira (prova por assinatura de mensagem). Mensagem adulterada é recusada.
  log('// 2. Negócio vincula a carteira (prova por assinatura de me');
  const {message}=await ok(`chain/carteira?endereco=${negocio.address}`);
  assert.equal((await call('chain/carteira',{address:negocio.address,message:message.replace('negócio','outro'),signature:base58(signMessage(kp(negocio,'negocio'),new TextEncoder().encode(message)))})).status,400);
  await bind('chain/carteira','chain/carteira',negocio,'negocio');
  // 3. Acordo com João; João abre o link (SEM login), vincula a carteira dele e aceita.
  log('// 3. Acordo com João; João abre o link (SEM login), vincula');
  const contact=(await ok('contacts',{name:'João',type:'supplier'})).contacts[0];
  const invitation=(await ok('invitations/send',{contactId:contact.id,debtAmount:60000,rateBps:2000,priority:1,due:shiftDate(today(),7),acknowledged:true})).invitations[0];
  await bind(`rede/${invitation.token}/carteira`,`rede/${invitation.token}/mensagem`,joao,'joao');
  assert.equal((await call(`rede/${invitation.token}/carteira`,{address:cliente.address,message:'x',signature:'1'},false)).status,400,'link não troca a carteira já vinculada');
  await ok('invitations/decision',{token:invitation.token,decision:'accept',acknowledged:true},false);
  // 4. Negócio assina cadastro + proposta; João assina o aceite — cada um na própria carteira.
  log('// 4. Negócio assina cadastro + proposta; João assina o acei');
  assert.ok(await signAll('chain/assinaturas',id=>`chain/assinaturas/${id}`,negocio)>=2);
  assert.equal(await signAll(`rede/${invitation.token}`,id=>`rede/${invitation.token}/${id}`,joao),1);
  // Item do fornecedor NÃO pode ser assinado pelo painel do negócio, nem com a carteira errada.
  let row=(await ok('chain/reconcile')).rows.find((r:{commitmentId:string})=>r.commitmentId===invitation.commitmentId);
  assert.equal(row.state,'registrado',JSON.stringify(row));assert.equal(row.chain.supplier,joao.address);
  // 5. Venda pelo Solana Pay: o CLIENTE paga da carteira dele; teto de segurança é respeitado.
  log('// 5. Venda pelo Solana Pay: o CLIENTE paga da carteira dele');

  const requestId=crypto.randomUUID();let state:State=await ok('payments/create',{requestId});const p=state.paymentRequests!.find(x=>x.requestId===requestId)!;
  await ok('payments/amount',{id:p.id,amount:10000});
  assert.equal((await call('payments/confirm',{token:p.token,acknowledged:true},false)).status,400,'na rede pública não existe pagamento pela carteira de teste');
  const serverChain=new LocalChain(RPC,new TestWallets(join(directory,'carteiras-teste')));if(DEVNET)serverChain.useMint(serverChain.address('mint-brz-teste'));await serverChain.ensureTokenAccountsFor([cliente.address]);
  await serverChain.send(await serverChain.signer('emissor'),[(await import('@solana-program/token')).getMintToInstruction({mint:serverChain.mint,token:await serverChain.ata(cliente.address),mintAuthority:await serverChain.signer('emissor'),amount:10000n*SCALE})]);
  const req=await ok(`solana-pay/${p.token}`,{account:cliente.address},false);await sendSigned(req.transaction,cliente);
  assert.equal((await ok(`solana-pay/${p.token}/verificar`,{},false)).paid,true);
  assert.deepEqual([await serverChain.tokenBalanceOf(joao.address)/SCALE,await serverChain.tokenBalanceOf(negocio.address)/SCALE],[2000n,8000n],'R$ 20 João, R$ 80 negócio — direto nas carteiras deles');
  const big=crypto.randomUUID();state=await ok('payments/create',{requestId:big});const pb=state.paymentRequests!.find(x=>x.requestId===big)!;await ok('payments/amount',{id:pb.id,amount:60000});
  const refused=await call(`solana-pay/${pb.token}`,{account:cliente.address},false);assert.equal(refused.status,400);assert.match(refused.data.error,/teto/);
  // 6. Dinheiro: o negócio registra (assina), João confirma pelo link de confirmação (assina) → concluído → atestado.
  log('// 6. Dinheiro: o negócio registra (assina), João confirma p');
  await ok('cash/open',{opening:0});await ok('sales/cash',{amount:300000,method:'cash',soldAt:today(),paidAt:today()});
  state=await ok('cash/pay',{kind:'supplier',recipientId:invitation.commitmentId,amount:58000,requestId:'rede-carteira'});
  assert.equal(await signAll('chain/assinaturas',id=>`chain/assinaturas/${id}`,negocio),1);
  const receipt=(await ok('receipts/request',{paymentId:state.cashPayments![0].id})).receiptConfirmations[0];
  await ok('receipts/decision',{token:receipt.token,decision:'confirm'},false);
  assert.equal(await signAll(`rede/${receipt.token}`,id=>`rede/${receipt.token}/${id}`,joao),1);
  await ok('chain/sync',{});
  row=(await ok('chain/reconcile')).rows.find((r:{commitmentId:string})=>r.commitmentId===invitation.commitmentId);
  assert.equal(row.state,'registrado',JSON.stringify(row));assert.equal(row.chain.status,'completed');assert.equal(row.attested,true);
  // 7. O servidor guardou só endereços públicos das pessoas — nenhuma chave de negócio, João ou cliente.
  log('// 7. O servidor guardou só endereços públicos das pessoas —');
  const {readdirSync}=await import('node:fs');const saved=readdirSync(join(directory,'carteiras-teste'));
  for(const a of [negocio.address,joao.address,cliente.address])assert.equal(saved.some(f=>new TestWallets(join(directory,'carteiras-teste')).roleOf(a)!==undefined&&f),false);
 }finally{const ended=new Promise<void>(done=>child.once('exit',()=>done()));child.kill();await ended;await rm(directory,{recursive:true,force:true});}
});
