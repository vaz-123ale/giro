import {join} from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import type {Commitment,State} from '../../src/domain/models.ts';
import {commitmentId} from '../../src/domain/records.ts';
import {dueToTs} from '../../src/domain/chain-model.ts';
import type {TrustReport} from '../../src/domain/proof.ts';
import type {LocalConfig} from '../config.ts';
import {addUpdateHook,database,read,update} from '../store.ts';
import {confirmPayment} from '../payment-service.ts';
import {inputRecord} from '../input.ts';
import {type ChainAdapter,type ChainAgreementView,ChainRuleError,ChainTransportError,samePreview} from './adapter.ts';
import {type ChainEvent,agreementKeyOf,attestationTargets,chainEvents,fingerprintOf,memberRoleOf,proposeEvent,settleEvent,sha256hex,supplierRoleOf} from './events.ts';
import {type OutboxItem,counts,enqueue,ensureChainTables,itemsFor,listItems,markItem,noteAttempt,pendingItems,settledSaleRefs} from './outbox.ts';
import {TestWallets,generateKeypair,isAddress,roleFor} from './keys.ts';
import {SimulatedAdapter} from './simulated.ts';
import {ChainNeedsSignature,type Party,SolanaAdapter,networkProfile} from './localnet.ts';
import {StoredWalletRegistry,bindMessage} from './wallets.ts';
import {money} from '../../src/domain/finance.ts';

export type ChainItemState='registrado'|'pendente'|'aguardando-confirmacao'|'divergente'|'falhou'|'ausente'|'fora-da-rede';
export interface ReconcileRow {commitmentId:string;publicId:string;agreementKey:string;state:ChainItemState;differences:string[];attested:boolean;
 local:{original:number;paid:number;rateBps:number;priority:number;status:string;version:number};chain?:ChainAgreementView}

const chainStatusOf=(c:Commitment)=>c.status==='awaiting_acceptance'?'proposed':['active','accepted'].includes(c.status)?'active':c.status==='completed'?'completed':c.status==='cancelled'?'rejected':'draft';
const describe=(e:unknown)=>e instanceof Error?e.message:String(e);
/** Marca, no item da fila, de quem é a assinatura que falta (redes públicas). */
const WAIT='AGUARDA:';
export const waitingFor=(i:OutboxItem):Party|undefined=>i.status==='pendente'&&i.error?.startsWith(WAIT)?i.error.slice(WAIT.length).split(' ')[0] as Party:undefined;
const eventKey=(e:ChainEvent)=>'agreementKey' in e?e.agreementKey:undefined;
const EVENT_LABEL:Record<ChainEvent['type'],string>={register_seller:'Cadastrar o negócio na rede',propose:'Propor o acordo',accept:'Aceitar o acordo',reject:'Recusar o acordo',
 propose_change:'Pedir mudança no acordo',decide_change:'Decidir o pedido de mudança',settle_sale:'Venda',record_offchain_payment:'Registrar pagamento em dinheiro',
 confirm_offchain_payment:'Confirmar que recebeu o dinheiro',dispute_offchain_payment:'Informar que NÃO recebeu o dinheiro'};

/**
 * Camada OPCIONAL da rede (Fase 2 do plano). Com GIRO_SOLANA_CLUSTER=disabled ela não é criada e o GIRO
 * funciona exatamente como antes. O SQLite continua sendo a fonte da experiência; a rede é a prova.
 * Nada é sobrescrito sozinho: divergências aparecem na reconciliação para decisão humana.
 */
export class ChainService {
 readonly cluster:'simulado'|'localnet'|'devnet'|'mainnet';
 private readonly adapter:ChainAdapter;private readonly db:DatabaseSync;readonly wallets?:StoredWalletRegistry;
 private running?:Promise<void>;private again=false;private lastError:string|null=null;
 /** Cadastro inicial dos acordos que já existiam (bootstrap) concluído. */
 ready:Promise<unknown>=Promise.resolve();
 constructor(adapter:ChainAdapter,db:DatabaseSync,wallets?:StoredWalletRegistry){this.adapter=adapter;this.cluster=adapter.cluster;this.db=db;this.wallets=wallets;}
 /** Redes públicas: cada pessoa assina na própria carteira. */
 get walletMode(){return this.adapter instanceof SolanaAdapter&&this.adapter.signing==='carteira';}

 /** Gancho dentro da transação do GIRO: grava os eventos na fila (mesmo commit) e agenda o envio. */
 readonly hook=(before:State,after:State,db:DatabaseSync)=>{
  const sent=settledSaleRefs(db);
  const events=chainEvents(before,after).filter(e=>e.type!=='settle_sale'||!sent.has(e.saleRef));
  if(events.length){enqueue(db,events);setImmediate(()=>void this.sync());}
 };

 /**
  * Envia a fila em ordem. Regra recusada → "falhou" e segue; sem conexão → para e tenta depois.
  * Falta assinatura de alguém (redes públicas) → o item espera e só os itens do MESMO acordo ficam atrás dele;
  * vendas (sem acordo) esperam tudo o que veio antes.
  */
 sync():Promise<void>{
  if(this.running){this.again=true;return this.running;}
  this.running=(async()=>{do{this.again=false;await this.drain();await this.sweepAttestations();}while(this.again);})().finally(()=>{this.running=undefined;});
  return this.running;
 }
 private async drain(){
  const blocked=new Set<string>();let anyBlocked=false;
  for(const item of pendingItems(this.db)){
   const key=eventKey(item.event);
   if(item.event.type==='register_seller'?false:key?blocked.has(key)||blocked.has('*'):anyBlocked)continue;
   try{const signature=await this.adapter.send(item.event);markItem(this.db,item.id,'confirmado',{signature});this.lastError=null;}
   catch(e){
    if(e instanceof ChainNeedsSignature){noteAttempt(this.db,item.id,`${WAIT}${e.party} ${e.message}`);anyBlocked=true;blocked.add(key??'*');continue;}
    if(e instanceof ChainRuleError){markItem(this.db,item.id,'falhou',{error:`${e.code}: ${e.message}`});continue;}
    noteAttempt(this.db,item.id,describe(e));this.lastError=describe(e);return;
   }
  }
 }
 /** Atestado (SAS) para cada comprovante cujo acordo está concluído NA REDE e ainda não foi atestado. */
 private async sweepAttestations(){
  let chain:ChainAgreementView[];try{chain=await this.adapter.agreements();}catch(e){this.lastError=describe(e);return;}
  for(const t of attestationTargets(read())){
   if(chain.find(a=>a.agreementKey===t.agreementKey)?.status!=='completed')continue;
   try{if(!await this.adapter.findAttestation(t.agreementKey,t.recordFingerprint))await this.adapter.attest(t);}
   catch(e){if(!(e instanceof ChainRuleError)){this.lastError=describe(e);return;}}
  }
 }
 /** Acordos que já existiam antes de ligar a rede: propõe (+ aceita) com o já pago atual. Uma vez só por acordo. */
 async bootstrap(){
  let chain:ChainAgreementView[];try{chain=await this.adapter.agreements();}catch(e){this.lastError=describe(e);return 0;}
  const events:ChainEvent[]=[];
  for(const c of [...read().commitments].reverse()){
   if(c.demo||['draft','cancelled'].includes(c.status))continue;const key=agreementKeyOf(c);
   if(chain.some(a=>a.agreementKey===key)||itemsFor(this.db,key).length)continue;
   events.push(proposeEvent(c));if(chainStatusOf(c)!=='proposed')events.push({type:'accept',agreementKey:key});
  }
  if(this.walletMode&&!listItems(this.db,100000).some(i=>i.event.type==='register_seller'))events.unshift({type:'register_seller'});
  if(events.length){enqueue(this.db,events);await this.sync();}
  return events.length;
 }

 // ---------------- Carteiras reais (redes públicas) ----------------
 private solana(){if(!(this.adapter instanceof SolanaAdapter))throw Error('Disponível só na rede Solana (local, Devnet ou mainnet).');return this.adapter;}
 private requireWalletMode(){if(!this.walletMode||!this.wallets)throw Error('Assinatura pela carteira só existe nas redes públicas.');return {net:this.solana(),wallets:this.wallets};}
 /** Rede, token e carteira do negócio — para a tela. */
 walletInfo(){
  const net=this.adapter instanceof SolanaAdapter?this.adapter:undefined;
  return {cluster:this.cluster,walletMode:this.walletMode,chain:net?`solana:${net.cluster==='mainnet'?'mainnet':net.cluster}`:undefined,
   token:net?(net.profile.mint.mode==='fixo'?'BRZ':net.cluster==='devnet'?'BRZ de TESTE (Devnet)':'BRL-T de TESTE'):'modelo',mint:net?.chain.mint,
   maxSaleCents:net?.profile.maxSaleCents??0,sellerWallet:this.wallets?.seller()??null};
 }
 bindMessage(address:string,scope:string){return bindMessage(address,scope,new Date().toISOString());}
 bindSeller(value:unknown){const {wallets}=this.requireWalletMode();const a=wallets.bind({kind:'vendedor'},inputRecord(value),'o negócio');setImmediate(()=>void this.sync());return {sellerWallet:a};}
 /** Escopo de um link (convite ou confirmação de recebimento): só o acordo daquela pessoa. */
 private scopeOf(token:string){
  const state=read();const inv=state.invitations?.find(i=>i.token===token);
  const rec=inv?undefined:state.receiptConfirmations?.find(r=>r.token===token&&r.kind==='supplier');
  const member=inv||rec?undefined:state.members.find(m=>m.checkinToken===token);
  // Link de check-in: o comissionado só vincula a carteira onde recebe a comissão (não assina nada).
  if(member)return {commitment:undefined,key:undefined,role:memberRoleOf(member.id),label:`as comissões de ${member.name}`};
  const c=state.commitments.find(c=>c.id===(inv?.commitmentId??rec?.recipientId));if(!c)throw Error('Link não encontrado.');
  return {commitment:c as Commitment|undefined,key:agreementKeyOf(c) as string|undefined,role:supplierRoleOf(c),label:`o acordo ${commitmentId(c)}`};
 }
 /** O que falta assinar: do negócio (painel) ou de um fornecedor (pelo link dele). */
 pendingSignatures(token?:string){
  const scope=token?this.scopeOf(token):undefined;const state=read();const party:Party=scope?'fornecedor':'vendedor';
  const byKey=new Map(state.commitments.map(c=>[agreementKeyOf(c),c]));
  const items=pendingItems(this.db).filter(i=>waitingFor(i)===party&&(!scope||(scope.key!==undefined&&eventKey(i.event)===scope.key))).map(i=>{
   const c=byKey.get(eventKey(i.event)??'');const amount='amount' in i.event?i.event.amount:undefined;
   return {id:i.id,type:i.event.type,label:EVENT_LABEL[i.event.type],agreement:c?commitmentId(c):undefined,...(scope?{}:{counterparty:c?.supplier}),...(amount!==undefined?{amount:money(amount)}:{})};
  });
  const wallet=scope?this.wallets?.role(scope.role)??null:this.wallets?.seller()??null;
  return {...this.walletInfo(),party,wallet,needsWallet:!wallet,items,...(scope?{agreement:scope.commitment?commitmentId(scope.commitment):undefined,bindScope:scope.label}:{bindScope:'o negócio'})};
 }
 /** Vincula a carteira de uma pessoa logada (papel = o mesmo dos acordos dela ou das comissões). */
 bindRole(role:string,value:unknown,scope:string){const {wallets}=this.requireWalletMode();const a=wallets.bind({kind:'papel',role},inputRecord(value),scope);setImmediate(()=>void this.sync());return {wallet:a};}
 /** Redes de TESTE: SOL de teste (taxas) + token de teste (clientes) para a carteira vinculada da pessoa. */
 async fundTestWallet(role:string,cents:number){
  const net=this.solana();const owner=net.signing==='carteira'?this.wallets?.role(role):net.address(role);if(!owner)throw Error('Esta pessoa ainda não vinculou a carteira.');
  return net.fundTest(owner,Number(cents));
 }
 bindSupplier(token:string,value:unknown){const {wallets}=this.requireWalletMode();const scope=this.scopeOf(token);const a=wallets.bind({kind:'papel',role:scope.role},inputRecord(value),scope.label);setImmediate(()=>void this.sync());return {wallet:a};}
 private signable(id:number,token?:string){
  const item=pendingItems(this.db).find(i=>i.id===id);if(!item)throw Error('Esta assinatura não está mais pendente.');
  const party=waitingFor(item);if(!party)throw Error('Este item não aguarda assinatura.');
  if(token){const scope=this.scopeOf(token);if(party!=='fornecedor'||!scope.key||eventKey(item.event)!==scope.key)throw Error('Este link não pode assinar este item.');return {item,party,expected:this.wallets!.role(scope.role)};}
  if(party!=='vendedor')throw Error('Este item é assinado pela outra parte, pelo link dela.');
  return {item,party,expected:this.wallets!.seller()};
 }
 /** Transação NÃO assinada para a carteira certa assinar (o servidor nunca assina por ninguém). */
 async signingTransaction(id:number,value:unknown,token?:string){
  const {net}=this.requireWalletMode();const input=inputRecord(value);if(!isAddress(input.account))throw Error('Conecte a carteira.');
  const {item,expected}=this.signable(id,token);if(!expected||expected!==input.account)throw Error('Conecte a carteira vinculada a este cadastro.');
  return {transaction:await net.transactionFor(item.event,String(input.account)),label:EVENT_LABEL[item.event.type]};
 }
 /** A carteira enviou: confere na rede (carteira certa, instrução certa, sucesso) e só então dá baixa. */
 async signed(id:number,value:unknown,token?:string){
  const {net}=this.requireWalletMode();const input=inputRecord(value);if(typeof input.signature!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(input.signature))throw Error('Assinatura inválida.');
  const {item,expected}=this.signable(id,token);
  for(let i=0;i<20;i++){
   const ok=await net.verifySigned(item.event,expected!,input.signature);
   if(ok){markItem(this.db,item.id,'confirmado',{signature:input.signature});await this.sync();return {confirmed:true,signature:input.signature};}
   await new Promise(r=>setTimeout(r,1500));
  }
  return {confirmed:false};
 }

 async reconcile(state=read()){
  const chain=await this.adapter.agreements();const targets=attestationTargets(state);const rows:ReconcileRow[]=[];
  for(const c of state.commitments){
   if(c.demo||c.status==='draft')continue;const key=agreementKeyOf(c);const a=chain.find(x=>x.agreementKey===key);
   const items=itemsFor(this.db,key);const pending=items.some(i=>i.status==='pendente');const failed=items.filter(i=>i.status==='falhou');
   const local={original:c.original,paid:c.paid,rateBps:c.rateBps,priority:c.priority,status:chainStatusOf(c),version:c.version??1};
   const target=targets.find(t=>t.commitmentId===c.id);
   const attested=!!(target&&a?.status==='completed'&&await this.adapter.findAttestation(key,target.recordFingerprint));
   const row:ReconcileRow={commitmentId:c.id,publicId:commitmentId(c),agreementKey:key,state:'registrado',differences:[],attested,local,chain:a};
   if(!a){row.state=pending?'pendente':c.status==='cancelled'?'fora-da-rede':failed.length?'falhou':'ausente';if(failed.length)row.differences.push(...failed.map(f=>f.error??''));rows.push(row);continue;}
   const diff=(name:string,l:unknown,r:unknown)=>{if(l!==r)row.differences.push(`${name}: GIRO ${l} × rede ${r}`);};
   diff('valor original',local.original,a.original);diff('já pago',local.paid,a.paid);diff('percentual (bps)',local.rateBps,a.rateBps);diff('prioridade',local.priority,a.priority);
   diff('situação',local.status,a.status==='cancelled'?'rejected':a.status);diff('versão',local.version,a.version);diff('vencimento',Number(dueToTs(c.due)),a.dueTs);
   // Dinheiro entregue mas ainda não confirmado por quem recebeu: a rede só registra com as DUAS assinaturas.
   const unconfirmed=(state.cashPayments??[]).filter(p=>p.kind==='supplier'&&p.recipientId===c.id&&state.receiptConfirmations?.find(r=>r.paymentId===p.id)?.state!=='confirmed').reduce((s,p)=>s+p.amount,0);
   const onlyCash=unconfirmed>0&&local.paid-a.paid===unconfirmed&&row.differences.every(d=>d.startsWith('já pago')||d.startsWith('situação: GIRO completed × rede active'));
   row.state=row.differences.length===0?(pending?'pendente':'registrado'):pending?'pendente':onlyCash?'aguardando-confirmacao':failed.length?'falhou':'divergente';
   if(failed.length&&row.state!=='registrado')row.differences.push(...failed.map(f=>`envio recusado: ${f.error}`));
   rows.push(row);
  }
  const total=(s:ChainItemState)=>rows.filter(r=>r.state===s).length;
  return {cluster:this.cluster,at:new Date().toISOString(),ok:rows.every(r=>['registrado','fora-da-rede','aguardando-confirmacao'].includes(r.state))&&counts(this.db).falhou===0,
   summary:{registrado:total('registrado'),pendente:total('pendente'),aguardandoConfirmacao:total('aguardando-confirmacao'),divergente:total('divergente'),falhou:total('falhou'),ausente:total('ausente'),atestados:rows.filter(r=>r.attested).length},
   outbox:counts(this.db),rows};
 }
 /** Selo da tela ("Registrado ✓"): só o essencial, por compromisso. */
 async status(){
  try{const r=await this.reconcile();return {enabled:true,cluster:this.cluster,available:true,outbox:r.outbox,lastError:this.lastError,
   items:Object.fromEntries(r.rows.map(x=>[x.commitmentId,{state:x.state,attested:x.attested}]))};}
  catch(e){return {enabled:true,cluster:this.cluster,available:false,outbox:counts(this.db),lastError:describe(e),items:{}};}
 }
 /** "Verificar histórico recebido" + conferência na rede: cada comprovante íntegro precisa ter atestado. */
 async verifyOnChain(report:TrustReport){
  if(!report||!Array.isArray(report.agreements))throw Error('Arquivo não é um histórico GIRO.');
  return Promise.all(report.agreements.map(async x=>{
   const key=sha256hex('giro-acordo:'+String(x?.record?.agreement));const fp=x?.record?fingerprintOf(x.record):'';
   const attestation=fp===x?.fingerprint?await this.adapter.findAttestation(key,fp):undefined;
   return {agreement:String(x?.record?.agreement??'?'),fingerprintMatches:fp===x?.fingerprint,attested:!!attestation,attestedAt:attestation?Number(attestation.createdTs):null};
  }));
 }
 /**
  * Venda digital com a rede ligada (Fase 3): a rede executa PRIMEIRO; o GIRO só registra o recebimento
  * depois que a rede confirmou e se a divisão for idêntica à do GIRO.
  * Fase local: quem paga é a carteira de TESTE "cliente" (token BRL-T de teste).
  */
 async confirmPaymentOnChain(value:unknown){
  const input=inputRecord(value);if(input.acknowledged!==true)throw Error('Confirme que este é um pagamento de teste na rede local.');
  if(this.walletMode)throw Error('Na rede pública o cliente paga pela própria carteira (QR Solana Pay).');
  await this.ready;await this.sync();if(pendingItems(this.db).length)throw Error(`A rede local ainda não confirmou registros anteriores. ${this.lastError??''}`.trim());
  const state=read();const request=state.paymentRequests?.find(p=>p.token===input.token);if(!request?.saleId)throw Error('Aguarde o estabelecimento definir o valor.');
  const draft=structuredClone(state);confirmPayment(draft,input);const sale=draft.sales.find(s=>s.id===request.saleId)!;
  const event=settleEvent(draft,sale) as Extract<ChainEvent,{type:'settle_sale'}>;
  const preview=await this.adapter.previewSale(event);
  if(!samePreview(preview,event.expected))throw Error('A rede dividiria esta venda de forma diferente do GIRO (provável pagamento em dinheiro aguardando confirmação do fornecedor). Nada foi cobrado.');
  const signature=await this.adapter.send(event);
  enqueue(this.db,[event]);const item=listItems(this.db,1)[0];markItem(this.db,item.id,'confirmado',{signature});
  return update(s=>{confirmPayment(s,input);const p=s.paymentRequests!.find(p=>p.token===input.token)!;p.chainSignature=signature;});
 }
/** Monta o evento de venda para uma cobrança, exatamente como o GIRO vai registrar (sem gravar nada). */
 private paymentEvent(token:string){
  const state=read();const request=state.paymentRequests?.find(p=>p.token===token);if(!request?.saleId)throw Error('Aguarde o estabelecimento definir o valor.');
  if(request.chainSignature)throw Error('Esta cobrança já foi paga.');
  const draft=structuredClone(state);confirmPayment(draft,{token,acknowledged:true});
  return {request,event:settleEvent(draft,draft.sales.find(s=>s.id===request.saleId)!) as Extract<ChainEvent,{type:'settle_sale'}>};
 }
 /** Grava no GIRO uma venda que a rede JÁ confirmou (a fila não reenvia: o saleRef fica como confirmado). */
 private recordConfirmed(token:string,event:Extract<ChainEvent,{type:'settle_sale'}>,signature:string){
  enqueue(this.db,[event]);const item=listItems(this.db,1)[0];markItem(this.db,item.id,'confirmado',{signature});
  return update(s=>{confirmPayment(s,{token,acknowledged:true});const p=s.paymentRequests!.find(p=>p.token===token)!;p.chainSignature=signature;});
 }
 private localnet(){return this.solana();}
 /** Solana Pay — POST: transação para a carteira do cliente assinar (o GIRO não assina nem guarda dinheiro). */
 async solanaPayTransaction(token:string,value:unknown){
  const input=inputRecord(value);if(!isAddress(input.account))throw Error('Conta da carteira inválida.');const net=this.localnet();
  await this.ready;await this.sync();
  const {request,event}=this.paymentEvent(token);
  // Só bloqueia se a rede dividiria diferente do GIRO (ex.: acordo aceito no GIRO mas ainda sem as assinaturas na rede).
  try{const got=await net.previewSale(event);if(!samePreview(got,event.expected))throw new ChainRuleError('Divergente');}
  catch(e){if(e instanceof ChainRuleError&&e.code==='Divergente')throw Error(this.missingSignaturesMessage(event));throw e;}
  const reference=request.chainReference??generateKeypair().address;
  if(!request.chainReference)update(s=>{s.paymentRequests!.find(p=>p.token===token)!.chainReference=reference;});
  const transaction=await net.buildPayment(event,String(input.account),reference);
  return {transaction,message:`GIRO · ${money(event.amount)} · ${this.walletInfo().token}`};
 }
 /** Solana Pay — confere pela referência se a carteira já pagou; se sim, registra no GIRO. */
 async solanaPayCheck(token:string){
  const state=read();const request=state.paymentRequests?.find(p=>p.token===token);if(!request)throw Error('Cobrança não encontrada.');
  if(request.chainSignature||!request.chainReference)return state;
  const {event}=this.paymentEvent(token);const signature=await this.localnet().findPayment(request.chainReference,event.amount);
  return signature?this.recordConfirmed(token,event,signature):state;
 }
 /** Explica, em linguagem simples, quais assinaturas faltam para a venda poder ser dividida na rede. */
 private missingSignaturesMessage(event:Extract<ChainEvent,{type:'settle_sale'}>){
  const state=read();const keys=new Set(Object.keys(event.expected.agreements));
  const waiting=pendingItems(this.db).filter(i=>keys.has(eventKey(i.event)??'')&&waitingFor(i));
  const names=[...new Set(waiting.map(i=>{const c=state.commitments.find(c=>agreementKeyOf(c)===eventKey(i.event));return `${c?.supplier??'acordo'} (${waitingFor(i)==='vendedor'?'falta a assinatura do negócio em Mais → Carteira e assinaturas':'falta ela assinar o aceite na conta dela'})`;}))];
  return names.length?`Ainda não dá para dividir esta venda na rede: ${names.join('; ')}. Assim que assinarem, gere a cobrança de novo.`:'A rede dividiria esta venda de forma diferente do GIRO. Confira as assinaturas pendentes em Mais → Carteira e assinaturas.';
 }
 outbox(limit=200){return listItems(this.db,limit);}
 /** Saldos do token de TESTE (BRL-T, centavos) por pessoa do GIRO — relatório local, nunca sai do PC. */
 async balances(state=read()){
  const of=async(role:string)=>Number(await this.adapter.balance(role));
  return {token:'BRL-T (teste)',vendedor:await of('vendedor'),cliente:await of('cliente'),
   contatos:Object.fromEntries(await Promise.all((state.contacts??[]).map(async c=>[c.id,await of(roleFor('contato',c.id))]))),
   membros:Object.fromEntries(await Promise.all(state.members.filter(m=>!m.demo).map(async m=>[m.id,await of(memberRoleOf(m.id))])))};
 }
 balance(role:string){return this.adapter.balance(role);}
 address(role:string){return this.adapter.address(role);}
}

/** Liga a camada de rede conforme a configuração. disabled → undefined (nada muda no GIRO). */
export function startChain(config:LocalConfig):ChainService|undefined{
 if(config.solanaCluster==='disabled')return undefined;
 const db=database();ensureChainTables(db);
 const wallets=new TestWallets(join(config.dataDir,'carteiras-teste'));const registry=new StoredWalletRegistry(db);
 const adapter=config.solanaCluster==='simulado'?new SimulatedAdapter(db,wallets):new SolanaAdapter(networkProfile(config.solanaCluster,config.solanaRpc),wallets,registry);
 const service=new ChainService(adapter,db,registry);addUpdateHook(service.hook);
 service.ready=new Promise(ok=>setImmediate(()=>ok(service.bootstrap())));
 return service;
}
export {ChainTransportError};
