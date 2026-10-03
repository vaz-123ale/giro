import {loadConfig} from './config.ts';
import {refreshNotifications} from './notification-service.ts';
import {previewSale} from './preview-service.ts';
import {requestReceipt,receiptView,decideReceipt} from './receipt-service.ts';
import {setSchedule,issueCheckin,checkinView,requestShift,decideShift} from './shift-request-service.ts';
import {globalFinancialForecast} from '../src/domain/global-forecast.ts';
import {payAccount} from './account-service.ts';
import {scheduleDaily} from './daily-service.ts';
import {createPayment,amountPayment,confirmPayment,paymentView} from './payment-service.ts';
import {registerDaily,payDaily} from './daily-service.ts';
import {startChain} from './chain/service.ts';
import {AccessControl} from './auth.ts';
import {People,type Person} from './people.ts';
import {myView,photoOf,profile,profiles,publicProfile} from './profile-service.ts';
import {memberRoleOf} from './chain/events.ts';
import {roleFor} from './chain/keys.ts';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {database,read,update} from './store.ts';
import {createCommitment,createSale,receiveSale} from './financial-service.ts';
import {decideAgreement,decideRenegotiation,editDraft,requestRenegotiation,submitDraft} from './agreement-service.ts';
import {changePlan,createPlan,reserveSuggestion,updateSettings} from './planning-service.ts';
import {financialForecast} from '../src/domain/intelligence.ts';
import {educationalSimulation} from '../src/domain/planning.ts';
import {activeCash} from '../src/domain/cash.ts';
import {today} from '../src/domain/finance.ts';
import {requireAmount} from '../src/domain/validation.ts';
import {createMember,toggleShift,changeMember} from './team-service.ts';
import {contributePlan} from './planning-service.ts';
import {consultCommitment,requestConsultChange} from './record-service.ts';
import {openCash,separateCash,payCash,outflowCash,closeCash,inflowCash} from './cash-service.ts';
import {createContact,sendInvitation,sendChangeInvitation,inviteExistingChange,invitationView,decideInvitation,readNotification,supplierChange,saveContactDraft} from './invitation-service.ts';
const config=loadConfig();
// Rede Solana: camada opcional, desligada por padrão (GIRO_SOLANA_CLUSTER=disabled → nada muda).
const chain=startChain(config);
// Acesso externo (túnel): tudo exige senha, exceto os links individuais com token secreto.
const access=new AccessControl(config.dataDir,!!config.publicUrl);
const people=new People(database());access.people=people;
/** Papel da carteira de uma pessoa: o mesmo usado pelos acordos (contato) ou pelas comissões (membro). */
const walletRoleOf=(p:Person)=>p.memberId?memberRoleOf(p.memberId):roleFor('contato',p.contactId!);
const server=createServer(async(req,res)=>{
 const json=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 try {
  if(req.headers.origin&&!config.allowedOrigins.includes(req.headers.origin)) return json(403,{error:'Origem não permitida.'});
  const reqPath=new URL(req.url??'/','http://localhost').pathname;
  const method=req.method??'GET';
  const readBody=async(limit=16000)=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>limit)throw Error('Solicitação muito grande.');}return JSON.parse(raw||'{}');};
  const who=access.subject(req);
  if(reqPath==='/api/sessao'&&method==='GET'){const p=who?.kind==='pessoa'?people.byId(who.id):undefined;return json(200,{required:access.enabled,authenticated:!!who,who:who?.kind??null,...(p?{mustChange:p.mustChange,name:p.name}:{})});}
  if(reqPath==='/api/login'&&method==='POST'){const input=await readBody(2000);const {cookie,who:w}=access.login(req,input.usuario,input.senha);
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Set-Cookie':cookie});return res.end(JSON.stringify({ok:true,who:w.kind}));}
  if(reqPath==='/api/sair'&&method==='POST'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Set-Cookie':access.logout(req)});return res.end('{"ok":true}');}
  if(!access.allowed(req,method,reqPath))return json(who?403:401,{error:who?'Esta área é só da dona do negócio.':'Entre com usuário e senha do GIRO.'});
  // Sem sessão da dona, o status da rede mostra só a rede (sem itens do negócio).
  if(reqPath==='/api/chain/status'&&who?.kind!=='dona')return json(200,chain?{enabled:true,cluster:chain.cluster}:{enabled:false,cluster:'disabled'});
  // ---- Pessoas e perfis (teste em grupo) ----
  const marks=async()=>chain?((await chain.status()).items as Record<string,{state:string;attested:boolean}>):{};
  if(reqPath==='/api/pessoas'&&method==='GET')return json(200,{business:{...people.business(),photo:undefined},people:people.list().map(p=>({...p,photo:undefined,hasPhoto:!!p.photo,wallet:chain?.wallets?.role(walletRoleOf(p))??null}))});
  if(reqPath==='/api/pessoas'&&method==='POST'){const input=await readBody();let created:ReturnType<typeof people.create>|undefined;update(s=>{created=people.create(s,input);});
   return json(200,{login:created!.person.login,password:created!.password,name:created!.person.name,profile:`/perfil/${created!.person.slug}`});}
  const personAction=reqPath.match(/^\/api\/pessoas\/([0-9a-f-]{36})\/(senha|abastecer)$/);
  if(personAction&&method==='POST'){const p=people.byId(personAction[1]);if(!p)throw Error('Pessoa não encontrada.');
   if(personAction[2]==='senha')return json(200,people.resetPassword(p.id));
   if(!chain)throw Error('Rede desligada.');return json(200,await chain.fundTestWallet(walletRoleOf(p),p.role==='cliente'?(await readBody()).cents??10000:0));}
  if(reqPath==='/api/negocio'&&method==='POST'){people.setBusiness(await readBody(400000));return json(200,{ok:true});}
  // Perfil PÚBLICO (sem login): só fatos de confiança, para compartilhar por link, WhatsApp ou NFC.
  const pub=reqPath.match(/^\/api\/publico\/([a-f0-9]{10})(\/foto)?$/);
  if(pub&&method==='GET'){
   if(pub[2]){const ph=photoOf(people,pub[1]);if(!ph)return json(404,{error:'Sem foto.'});res.writeHead(200,{'Content-Type':ph.type,'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'});return res.end(ph.data);}
   return json(200,publicProfile(read(),people,pub[1],await marks(),chain?.cluster));
  }
  if(reqPath==='/api/perfis'&&method==='GET')return json(200,profiles(people));
  const profileSlug=reqPath.match(/^\/api\/perfis\/([a-f0-9]{10})$/)?.[1];
  if(profileSlug&&method==='GET')return json(200,profile(read(),people,profileSlug,await marks()));
  const photoSlug=reqPath.match(/^\/api\/fotos\/([a-f0-9]{10})$/)?.[1];
  if(photoSlug&&method==='GET'){const ph=photoOf(people,photoSlug);if(!ph)return json(404,{error:'Sem foto.'});res.writeHead(200,{'Content-Type':ph.type,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'});return res.end(ph.data);}
  if(reqPath.startsWith('/api/eu')){
   if(who?.kind!=='pessoa')return json(403,{error:'Entre com o usuário da sua conta.'});const me=people.byId(who.id)!;
   if(reqPath==='/api/eu'&&method==='GET')return json(200,{...myView(read(),me,await marks()),wallet:chain?.walletInfo(),myWallet:chain?.wallets?.role(walletRoleOf(me))??null});
   if(reqPath==='/api/eu/senha'&&method==='POST'){const input=await readBody();people.changePassword(me.id,input.atual,input.nova);return json(200,{ok:true});}
   if(reqPath==='/api/eu/foto'&&method==='POST'){people.setPhoto(me.id,(await readBody(400000)).photo);return json(200,{ok:true});}
   if(reqPath==='/api/eu/carteira/mensagem'&&method==='GET'){if(!chain)throw Error('Rede desligada.');return json(200,{message:chain.bindMessage(new URL(req.url??'/','http://localhost').searchParams.get('endereco')??'',`a conta ${me.login}`)});}
   if(reqPath==='/api/eu/carteira'&&method==='POST'){if(!chain)throw Error('Rede desligada.');return json(200,chain.bindRole(walletRoleOf(me),await readBody(),`a conta ${me.login}`));}
  }
  if(req.url==='/api/state'&&req.method==='GET')return json(200,read());
  if(req.url==='/api/chain/status'&&req.method==='GET')return json(200,chain?await chain.status():{enabled:false,cluster:'disabled'});
  if(req.url?.startsWith('/api/chain/')&&!chain)return json(409,{error:'Rede desligada (GIRO_SOLANA_CLUSTER=disabled).'});
  if(chain&&req.url==='/api/chain/reconcile'&&req.method==='GET')return json(200,await chain.reconcile());
  if(chain&&req.url==='/api/chain/outbox'&&req.method==='GET')return json(200,chain.outbox());
  if(chain&&req.url==='/api/chain/balances'&&req.method==='GET')return json(200,await chain.balances());
  const paymentToken=req.url?.match(/^\/api\/payments\/([a-f0-9]{48})$/)?.[1];
  if(paymentToken&&req.method==='GET')return json(200,paymentView(read(),paymentToken));
  if(req.url?.startsWith('/api/forecast/global')&&req.method==='GET')return json(200,globalFinancialForecast(read(),new URL(req.url,'http://localhost').searchParams.get('until')??undefined));
  if(req.url==='/api/forecast'&&req.method==='GET')return json(200,financialForecast(read()));
  const receiptToken=req.url?.match(/^\/api\/receipts\/([a-f0-9]{48})$/)?.[1];
  if(receiptToken&&req.method==='GET')return json(200,receiptView(read(),receiptToken));
  const checkinToken=req.url?.match(/^\/api\/checkin\/([a-f0-9]{48})$/)?.[1];
  if(checkinToken&&req.method==='GET')return json(200,checkinView(read(),checkinToken));
  // Solana Pay (transaction request): GET = rótulo; POST {account} = transação para a carteira assinar. Só com a rede local.
  const payToken=req.url?.match(/^\/api\/solana-pay\/([a-f0-9]{48})$/)?.[1];
  if(payToken&&chain&&req.method==='GET')return json(200,{label:'GIRO · rede local de teste',icon:`${config.publicUrl??`http://127.0.0.1:${config.port}`}/logo_giro.png`});
  if(payToken&&chain&&req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4000)return json(413,{error:'Solicitação muito grande.'});}return json(200,await chain.solanaPayTransaction(payToken,JSON.parse(raw||'{}')));}
  // Carteiras reais (redes públicas): o negócio assina pelo painel; cada fornecedor só pelo próprio link (token).
  const readJson=async(limit=8000)=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>limit)throw Error('Solicitação muito grande.');}return JSON.parse(raw||'{}');};
  const route=new URL(req.url??'/','http://localhost');
  if(chain&&route.pathname==='/api/chain/carteira'&&req.method==='GET')return json(200,{...chain.walletInfo(),...(route.searchParams.get('endereco')?{message:chain.bindMessage(route.searchParams.get('endereco')!,'o negócio')}:{})});
  if(chain&&route.pathname==='/api/chain/carteira'&&req.method==='POST')return json(200,chain.bindSeller(await readJson()));
  if(chain&&route.pathname==='/api/chain/assinaturas'&&req.method==='GET')return json(200,chain.pendingSignatures());
  const sellerSign=route.pathname.match(/^\/api\/chain\/assinaturas\/(\d+)\/(transacao|assinada)$/);
  if(chain&&sellerSign&&req.method==='POST')return json(200,sellerSign[2]==='transacao'?await chain.signingTransaction(Number(sellerSign[1]),await readJson()):await chain.signed(Number(sellerSign[1]),await readJson()));
  const linkNet=route.pathname.match(/^\/api\/rede\/([a-f0-9]{48})(?:\/(carteira|mensagem)|\/(\d+)\/(transacao|assinada))?$/);
  if(chain&&linkNet){const [,tk,what,id,action]=linkNet;
   if(!what&&!id&&req.method==='GET')return json(200,chain.pendingSignatures(tk));
   if(what==='mensagem'&&req.method==='GET'){const scope=chain.pendingSignatures(tk).bindScope;return json(200,{message:chain.bindMessage(route.searchParams.get('endereco')??'',scope)});}
   if(what==='carteira'&&req.method==='POST')return json(200,chain.bindSupplier(tk,await readJson()));
   if(id&&req.method==='POST')return json(200,action==='transacao'?await chain.signingTransaction(Number(id),await readJson(),tk):await chain.signed(Number(id),await readJson(),tk));
  }
  const payCheck=req.url?.match(/^\/api\/solana-pay\/([a-f0-9]{48})\/verificar$/)?.[1];
  if(payCheck&&chain&&req.method==='POST')return json(200,paymentView(await chain.solanaPayCheck(payCheck),payCheck));
  const invitationToken=req.url?.match(/^\/api\/invitations\/([a-f0-9]{48})$/)?.[1];
  if(invitationToken&&req.method==='GET')return json(200,invitationView(read(),invitationToken));
  if(req.url?.startsWith('/api/')&&req.method==='POST'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>(req.url?.startsWith('/api/sales')||req.url==='/api/chain/verify'?3000000:16000))return json(413,{error:'Solicitação muito grande.'});}
   const input=JSON.parse(raw);
   if(req.url==='/api/sales/cash')return json(200,update(s=>{if(!activeCash(s)||activeCash(s)!.date!==today())throw Error('Abra o caixa de hoje antes de registrar uma venda em dinheiro.');if(input.method!=='cash'||input.paidAt!==today())throw Error('Venda em dinheiro deste caixa deve registrar o recebimento de hoje.');createSale(s,input);}));
   if(req.url==='/api/sales/preview')return json(200,previewSale(read(),input));
   if(req.url==='/api/receipts/decision'){const state=update(s=>{decideReceipt(s,input);});return json(200,receiptView(state,input.token));}
   if(req.url==='/api/checkin/request'){const state=update(s=>requestShift(s,input));return json(200,checkinView(state,input.token));}
   if(req.url==='/api/cash/inflow')return json(200,update(s=>inflowCash(s,input)));
   if(req.url==='/api/commitments/consult')return json(200,consultCommitment(read(),input));
   if(req.url==='/api/commitments/request-change'){const state=update(s=>requestConsultChange(s,input));return json(200,consultCommitment(state,{id:input.id}));}
   if(req.url==='/api/members/change')return json(200,update(s=>changeMember(s,input)));
   if(req.url==='/api/plans/contribute')return json(200,update(s=>contributePlan(s,input)));
   if(req.url==='/api/payments/confirm'){const result=chain?await chain.confirmPaymentOnChain(input):update(s=>confirmPayment(s,input));return json(200,paymentView(result,input.token));}
   if(chain&&req.url==='/api/chain/sync'){await chain.ready;await chain.sync();return json(200,await chain.status());}
   if(chain&&req.url==='/api/chain/verify')return json(200,await chain.verifyOnChain(input));
   if(req.url==='/api/invitations/decision'){
    const state=update(s=>decideInvitation(s,input));return json(200,invitationView(state,input.token));
   }
   if(req.url==='/api/invitations/supplier-change'){const state=update(s=>supplierChange(s,input));return json(200,invitationView(state,input.token));}
   const localActions:Record<string,(s:ReturnType<typeof read>,v:unknown)=>unknown>={'/api/notifications/refresh':refreshNotifications,'/api/accounts/pay':payAccount,'/api/team/daily/schedule':scheduleDaily,'/api/payments/create':createPayment,'/api/payments/amount':amountPayment,'/api/team/daily':registerDaily,'/api/team/daily/pay':payDaily,'/api/contacts':createContact,'/api/invitations/send':sendInvitation,'/api/invitations/change':sendChangeInvitation,'/api/invitations/change-existing':inviteExistingChange,'/api/notifications/read':readNotification,'/api/receipts/request':requestReceipt,'/api/members/schedule':setSchedule,'/api/members/checkin-link':issueCheckin,'/api/shift/decision':decideShift};
   if(req.url==='/api/invitations/draft')return json(200,update(s=>{saveContactDraft(s,input);}));
   if(localActions[req.url!])return json(200,update(s=>{localActions[req.url!](s,input);}));
   if(req.url==='/api/simulate'){
    requireAmount(input?.amount,true);
    if(input.remaining!==undefined)requireAmount(input.remaining,true);
    return json(200,educationalSimulation(input.amount,input.rateBps,input.remaining));
   }
   if(!['/api/cash/open','/api/cash/separate','/api/cash/pay','/api/cash/outflow','/api/cash/close','/api/sales','/api/shift','/api/members','/api/commitments','/api/receive','/api/agreements/submit','/api/agreements/edit','/api/agreements/decision','/api/renegotiations/request','/api/renegotiations/decision','/api/plans','/api/plans/change','/api/plans/reserve','/api/settings'].includes(req.url))return json(404,{error:'Rota não encontrada.'});
   const state=update(state=>{
    if(req.url==='/api/sales')createSale(state,input);
    else if(req.url==='/api/commitments')createCommitment(state,input);
    else if(req.url==='/api/receive')receiveSale(state,input);
    else if(req.url==='/api/agreements/submit')submitDraft(state,input);
    else if(req.url==='/api/agreements/edit')editDraft(state,input);
    else if(req.url==='/api/agreements/decision')decideAgreement(state,input);
    else if(req.url==='/api/renegotiations/request')requestRenegotiation(state,input);
    else if(req.url==='/api/renegotiations/decision')decideRenegotiation(state,input);
    else if(req.url==='/api/plans')createPlan(state,input);
    else if(req.url==='/api/plans/change')changePlan(state,input);
    else if(req.url==='/api/plans/reserve')reserveSuggestion(state,input);
    else if(req.url==='/api/settings')updateSettings(state,input);
    else if(req.url==='/api/members')createMember(state,input);
    else if(req.url==='/api/cash/open')openCash(state,input);
    else if(req.url==='/api/cash/separate')separateCash(state,input);
    else if(req.url==='/api/cash/pay')payCash(state,input);
    else if(req.url==='/api/cash/outflow')outflowCash(state,input);
    else if(req.url==='/api/cash/close')closeCash(state,input);
    else toggleShift(state,input);
   });
   return json(200,state);
  }
  if(req.url?.startsWith('/api/'))return json(404,{error:'Rota não encontrada.'});
  const root=resolve('dist');const pathname=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname);let path=resolve(root,'.'+pathname);
  if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))path=resolve(root,'index.html');
  let body;try{body=await readFile(path);}catch{path=resolve(root,'index.html');body=await readFile(path);}
  const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
  res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});res.end(body);
 }catch(error){json(400,{error:error instanceof Error?error.message:'Não foi possível concluir. Revise os dados ou tente novamente.'});}
});
server.listen(config.port,config.host,()=>console.log(`GIRO local: http://127.0.0.1:${config.port} (somente este computador)`));
