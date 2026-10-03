import {type Address,type Instruction,type TransactionSigner,AccountRole,address,appendTransactionMessageInstructions,compileTransaction,createNoopSigner,createTransactionMessage,
 getBase58Decoder,getBase58Encoder,getBase64EncodedWireTransaction,getBase64Encoder,pipe,setTransactionMessageFeePayer,setTransactionMessageLifetimeUsingBlockhash} from '@solana/kit';
import {getSetComputeUnitLimitInstruction} from '@solana-program/compute-budget';
import {TOKEN_PROGRAM_ADDRESS,getCreateAssociatedTokenIdempotentInstructionAsync,getMintToInstruction} from '@solana-program/token';
import {getTransferSolInstruction} from '@solana-program/system';
import {deriveAttestationPda,deriveCredentialPda,deriveSchemaPda,getAttestationDecoder,getCreateAttestationInstruction,getCreateCredentialInstruction,getCreateSchemaInstruction} from 'sas-lib';
import {GIRO_ACORDOS_PROGRAM_ADDRESS,Status,findAgreementPda,findPaymentPda,findSellerStatePda,getAcceptInstruction,getAgreementDecoder,getConfirmOffchainPaymentInstruction,getDecideChangeInstruction,
 getDisputeOffchainPaymentInstruction,getProposeChangeInstruction,getProposeInstructionAsync,getRecordOffchainPaymentInstructionAsync,getRegisterSellerInstructionAsync,getRejectInstruction,
 getSettleSaleInstructionAsync,getSettleSaleInstructionDataDecoder,AGREEMENT_DISCRIMINATOR,ACCEPT_DISCRIMINATOR,CONFIRM_OFFCHAIN_PAYMENT_DISCRIMINATOR,DECIDE_CHANGE_DISCRIMINATOR,
 DISPUTE_OFFCHAIN_PAYMENT_DISCRIMINATOR,PROPOSE_DISCRIMINATOR,PROPOSE_CHANGE_DISCRIMINATOR,RECORD_OFFCHAIN_PAYMENT_DISCRIMINATOR,REGISTER_SELLER_DISCRIMINATOR,REJECT_DISCRIMINATOR,SETTLE_SALE_DISCRIMINATOR} from '../../solana/clients/giro/index.ts';
import {GiroAcordosModel,type ChainErrorCode,type ChainStatus,dueToTs,isoToTs} from '../../src/domain/chain-model.ts';
import {orderAgreements} from '../../src/domain/chain-bridge.ts';
import {GIRO_CREDENTIAL,GIRO_SCHEMA,decodeAttestationData,encodeAttestationData,type AttestationRecord} from '../../src/domain/attestation-model.ts';
import {type AttestTarget,type ChainAdapter,type ChainAgreementView,ChainRuleError,ChainTransportError,type SalePreview,type SettleEvent,samePreview} from './adapter.ts';
import type {ChainEvent} from './events.ts';
import {attestationNonce} from './simulated.ts';
import {LocalChain} from './kit.ts';
import type {TestWallets} from './keys.ts';

/** Ordem dos códigos de erro do programa (Anchor: 6000 + índice) — igual ao enum GiroError do lib.rs. */
const PROGRAM_ERRORS:(ChainErrorCode|'AccountsMismatch')[]=['Unauthorized','InvalidStatus','InvalidTerms','CapacityExceeded','TooManyAccounts','AmountZero','Overflow','ExceedsRemaining','MissingAgreement','WrongOrder','WrongMint','WrongSeller','WrongSupplierAccount','DuplicateAgreement','ChangePending','NoPendingChange','AccountsMismatch','SaleLimit','InvalidUnit'];
const STATUS:Record<number,ChainStatus>={[Status.Proposed]:'proposed',[Status.Active]:'active',[Status.Completed]:'completed',[Status.Rejected]:'rejected',[Status.Cancelled]:'cancelled'};
const hex=(text:string)=>Uint8Array.from(text.match(/../g)!.map(b=>parseInt(b,16)));
const toHex=(b:ArrayLike<number>)=>Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
const nonceAddress=(hex64:string)=>address(getBase58Decoder().decode(hex(hex64)));
const sameBytes=(a:ArrayLike<number>,b:ArrayLike<number>)=>a.length===b.length&&Array.from(a).every((x,i)=>x===b[i]);

/** Procura, dentro de um erro do @solana/kit, o código de erro do programa (6000+) ou sinais de falta de conexão. */
export function classify(e:unknown):Error{
 const seen=new Set<unknown>();let custom:number|undefined;let text='';
 const walk=(v:unknown,depth=0)=>{if(!v||typeof v!=='object'||seen.has(v)||depth>8)return;seen.add(v);
  const o=v as Record<string,unknown>;if(typeof o.message==='string')text+=' '+o.message;
  for(const [k,x] of Object.entries(o)){if((k==='code'||k==='Custom')&&typeof x==='number'&&x>=6000)custom=x;if(typeof x==='object')walk(x,depth+1);}
  walk(o.cause,depth+1);walk(o.context,depth+1);};
 walk(e);if(custom===undefined){const m=/custom program error: 0x([0-9a-f]+)/i.exec(text+String(e));if(m)custom=parseInt(m[1],16);}
 if(custom!==undefined){const code=PROGRAM_ERRORS[custom-6000]??`Erro ${custom}`;return new ChainRuleError(code,`Programa recusou: ${code}`);}
 if(/fetch failed|ECONNREFUSED|ECONNRESET|socket|timeout|blockhash|429|Too Many/i.test(text+String(e)))return new ChainTransportError(`Sem conexão com a rede: ${(text||String(e)).trim().slice(0,200)}`);
 return new ChainRuleError('Recusado',(text||String(e)).trim().slice(0,300));
}

export type Party='vendedor'|'fornecedor'|'cliente';
/** Falta a assinatura de uma pessoa na PRÓPRIA carteira (redes públicas). O item fica esperando; nada se perde. */
export class ChainNeedsSignature extends Error{readonly party:Party;readonly role?:string;constructor(party:Party,role?:string,message?:string){super(message??`Aguarda assinatura de: ${party}`);this.party=party;this.role=role;this.name='ChainNeedsSignature';}}

/** Carteiras REAIS vinculadas (só endereços públicos; nunca chaves). */
export interface WalletRegistry {seller():string|undefined;role(role:string):string|undefined}

/** Perfil de rede: onde, quem assina e com qual token. */
export interface NetworkProfile {
 cluster:'localnet'|'devnet'|'mainnet';rpc:string;
 /** servidor = carteiras de TESTE assinam (só local) · carteira = cada pessoa assina na própria carteira. */
 signing:'servidor'|'carteira';
 /** criar = token de teste criado pelo emissor (BRL-T local, BRZ-teste Devnet) · fixo = token real (BRZ na mainnet). */
 mint:{mode:'criar';role:string;decimals:number}|{mode:'fixo';address:string;decimals:number};
 /** Teto por venda em CENTAVOS (0 = sem teto). */ maxSaleCents:number;
}
export const BRZ_MAINNET='FtgGSFADXBtroxq8VCausXRr2of47QBf5AS1NtZCu4GD';
export function networkProfile(cluster:'localnet'|'devnet'|'mainnet',rpc:string,env:Record<string,string|undefined>=process.env):NetworkProfile{
 const teto=env.GIRO_TETO_VENDA_CENTAVOS!==undefined?Number(env.GIRO_TETO_VENDA_CENTAVOS):cluster==='mainnet'?5000:cluster==='devnet'?100000:0;
 if(!Number.isSafeInteger(teto)||teto<0)throw Error('GIRO_TETO_VENDA_CENTAVOS inválido.');
 if(cluster==='localnet')return {cluster,rpc,signing:env.GIRO_ASSINATURA==='carteira'?'carteira':'servidor',mint:{mode:'criar',role:'mint-brl-t',decimals:2},maxSaleCents:teto};
 if(cluster==='devnet')return {cluster,rpc,signing:'carteira',mint:{mode:'criar',role:'mint-brz-teste',decimals:4},maxSaleCents:teto};
 return {cluster,rpc,signing:'carteira',mint:{mode:'fixo',address:env.GIRO_TOKEN_MINT??BRZ_MAINNET,decimals:4},maxSaleCents:teto};
}

/**
 * Adaptador da rede Solana REAL: validador local, Devnet ou mainnet.
 * Usa o cliente gerado pelo Codama (solana/clients/giro) e o cliente oficial do SAS (sas-lib).
 * Valores do GIRO (centavos) × scale = unidades do token (BRZ: 4 casas → scale 100).
 * Modo "carteira": o servidor só MONTA a transação; quem assina é a carteira da pessoa (não custodial).
 */
export class SolanaAdapter implements ChainAdapter {
 readonly cluster:'localnet'|'devnet'|'mainnet';readonly profile:NetworkProfile;readonly scale:bigint;
 readonly chain:LocalChain;private readonly wallets:TestWallets;private readonly registry:WalletRegistry;private prepared?:Promise<void>;
 constructor(profile:NetworkProfile,wallets:TestWallets,registry:WalletRegistry={seller:()=>undefined,role:()=>undefined}){
  this.profile=profile;this.cluster=profile.cluster;this.wallets=wallets;this.registry=registry;this.scale=10n**BigInt(profile.mint.decimals-2);
  if(profile.signing==='servidor'&&profile.cluster!=='localnet')throw Error('Carteiras de teste do servidor só podem assinar na rede local.');
  this.chain=new LocalChain(profile.rpc,wallets);
  this.chain.useMint(address(profile.mint.mode==='fixo'?profile.mint.address:wallets.get(profile.mint.role).address));
 }
 get signing(){return this.profile.signing;}
 private u(cents:number|bigint){return BigInt(cents)*this.scale;}
 private c(units:bigint){return Number(units/this.scale);}
 /** Endereço público de um papel: carteira de teste (local) ou carteira REAL vinculada (redes públicas). */
 address(role:string){
  if(this.profile.signing==='servidor')return this.wallets.get(role).address;
  if(role==='vendedor')return this.registry.seller()??'';
  if(role==='emissor'||(this.profile.mint.mode==='criar'&&role===this.profile.mint.role))return this.wallets.get(role).address;
  return this.registry.role(role)??'';
 }
 private need(role:string,party:Party){const a=this.address(role);if(!a)throw new ChainNeedsSignature(party,role,party==='vendedor'?'Vincule a carteira do negócio (Mais → Configurações → Carteira).':'Aguarda a pessoa vincular a carteira dela pelo link do acordo.');return address(a);}
 health(){return this.chain.healthy();}
 private async guard<T>(fn:()=>Promise<T>):Promise<T>{
  if(!await this.chain.healthy())throw new ChainTransportError(this.cluster==='localnet'?'Validador local não responde em 127.0.0.1:8899. Rode no WSL: bash solana/scripts/validador-local.sh':`Rede ${this.cluster} não responde agora.`);
  try{return await fn();}catch(e){if(e instanceof ChainRuleError||e instanceof ChainTransportError||e instanceof ChainNeedsSignature)throw e;throw classify(e);}
 }
 /** Uma vez por execução: taxas de teste, token de teste e (rede local) cadastro do vendedor. */
 private prepare(){
  return this.prepared??=(async()=>{
   if(this.cluster==='localnet')for(const role of ['emissor','vendedor','cliente'])await this.chain.fund(role);
   if(this.cluster==='devnet')await this.chain.fund('emissor').catch(()=>{/* faucet limitado: abastecer pelo site da Devnet */});
   if(this.profile.mint.mode==='criar')await this.chain.ensureMint(this.profile.mint.role,this.profile.mint.decimals);
   if(this.signing==='servidor'&&!await this.sellerRegistered()){const seller=await this.chain.signer('vendedor');await this.chain.send(seller,[await this.registerIx(seller)]);}
  })().catch(e=>{this.prepared=undefined;throw e;});
 }
 private async registerIx(seller:TransactionSigner){return getRegisterSellerInstructionAsync({seller,unit:this.scale,maxSale:this.u(this.profile.maxSaleCents)});}
 async sellerRegistered(){const seller=this.address('vendedor');if(!seller)return false;const [state]=await findSellerStatePda({seller:address(seller)});return !!(await this.chain.rpc.getAccountInfo(state,{encoding:'base64'}).send()).value;}
 private async pdas(key:string){const seller=this.need('vendedor','vendedor');const [agreement]=await findAgreementPda({seller,agreementKey:hex(key)});const [sellerState]=await findSellerStatePda({seller});return {seller,agreement,sellerState};}
 private async load(key:string){const {agreement}=await this.pdas(key);const info=await this.chain.rpc.getAccountInfo(agreement,{encoding:'base64'}).send();
  if(!info.value)throw new ChainRuleError('MissingAgreement');return getAgreementDecoder().decode(getBase64Encoder().encode(info.value.data[0]));}
 private terms(t:{original:number;rateBps:number;priority:number;due:string}){return {original:this.u(t.original),rateBps:t.rateBps,priority:t.priority,dueTs:dueToTs(t.due)};}
 private roleOfSupplier(addr:Address){return this.signing==='servidor'?this.wallets.roleOf(addr):undefined;}

 /** Quem precisa assinar cada evento e com qual endereço. */
 async signerOf(e:ChainEvent):Promise<{party:Party;address:Address;role?:string}>{
  switch(e.type){
   case 'register_seller':case 'propose':case 'record_offchain_payment':return {party:'vendedor',address:this.need('vendedor','vendedor')};
   case 'accept':case 'reject':case 'confirm_offchain_payment':case 'dispute_offchain_payment':{const a=await this.load(e.agreementKey);return {party:'fornecedor',address:a.supplier,role:this.roleOfSupplier(a.supplier)};}
   case 'propose_change':{if(e.proposer==='seller')return {party:'vendedor',address:this.need('vendedor','vendedor')};const a=await this.load(e.agreementKey);return {party:'fornecedor',address:a.supplier,role:this.roleOfSupplier(a.supplier)};}
   case 'decide_change':{const a=await this.load(e.agreementKey);if(a.pendingChange.__option!=='Some')throw new ChainRuleError('NoPendingChange');
    const seller=this.need('vendedor','vendedor');return a.pendingChange.value.proposer===seller?{party:'fornecedor',address:a.supplier,role:this.roleOfSupplier(a.supplier)}:{party:'vendedor',address:seller};}
   case 'settle_sale':return {party:'cliente',address:address(this.wallets.get('cliente').address)};
  }
 }
 /** Monta as instruções de um evento para quem assina (signer real no modo servidor; "vazio" no modo carteira). */
 private async instructions(e:ChainEvent,signer:TransactionSigner):Promise<Instruction[]>{
  switch(e.type){
   case 'register_seller':return [await this.registerIx(signer)];
   case 'propose':return [await getProposeInstructionAsync({seller:signer,supplier:this.need(e.supplierRole,'fornecedor'),mint:this.chain.mint,agreementKey:hex(e.agreementKey),terms:this.terms(e.terms),paidBefore:this.u(e.paidBefore),createdTs:isoToTs(e.createdAt)})];
   case 'accept':case 'reject':{const p=await this.pdas(e.agreementKey);return [(e.type==='accept'?getAcceptInstruction:getRejectInstruction)({supplier:signer,agreement:p.agreement,sellerState:p.sellerState})];}
   case 'propose_change':{const p=await this.pdas(e.agreementKey);return [getProposeChangeInstruction({signer,agreement:p.agreement,sellerState:p.sellerState,terms:this.terms(e.terms)})];}
   case 'decide_change':{const p=await this.pdas(e.agreementKey);return [getDecideChangeInstruction({signer,agreement:p.agreement,sellerState:p.sellerState,accept:e.accept})];}
   case 'record_offchain_payment':{const p=await this.pdas(e.agreementKey);return [await getRecordOffchainPaymentInstructionAsync({seller:signer,agreement:p.agreement,amount:this.u(e.amount),nonce:hex(e.nonce)})];}
   case 'confirm_offchain_payment':case 'dispute_offchain_payment':{
    const p=await this.pdas(e.agreementKey);const [payment]=await findPaymentPda({agreement:p.agreement,nonce:hex(e.nonce)});
    return [(e.type==='confirm_offchain_payment'?getConfirmOffchainPaymentInstruction:getDisputeOffchainPaymentInstruction)({supplier:signer,agreement:p.agreement,sellerState:p.sellerState,payment})];
   }
   case 'settle_sale':return [await this.settleInstruction(e,signer)];
  }
 }
 /** Modo servidor (rede local): assina com as carteiras de TESTE e envia. Modo carteira: pede a assinatura da pessoa. */
 send(e:ChainEvent):Promise<string>{return this.guard(async()=>{
  await this.prepare();
  if(e.type==='settle_sale'){
   if(this.signing==='carteira')throw new ChainRuleError('SoSolanaPay','Na rede pública, venda digital só pela carteira do cliente (Solana Pay).');
   const payer=await this.chain.signer('cliente');const ix=await this.settleInstruction(e,payer);await this.chain.mintTo('cliente',this.u(e.amount));return String(await this.chain.send(payer,[ix],400_000));
  }
  if(e.type==='register_seller'&&await this.sellerRegistered())return 'ja-cadastrado';
  const who=await this.signerOf(e);
  if(this.signing==='carteira')throw new ChainNeedsSignature(who.party,who.role);
  const role=who.party==='vendedor'?'vendedor':who.role;if(!role)throw new ChainRuleError('Unauthorized','Carteira de teste desta parte não está neste PC.');
  await this.chain.fund(role,1n);const signer=await this.chain.signer(role);
  return String(await this.chain.send(signer,await this.instructions(e,signer)));
 });}
 /**
  * Modo carteira: transação NÃO assinada deste evento para a carteira de quem deve assinar.
  * `account` precisa ser exatamente a carteira esperada (vendedor ou fornecedor do acordo).
  */
 transactionFor(e:ChainEvent,account:string){return this.guard(async()=>{
  await this.prepare();const who=await this.signerOf(e);
  if(who.address!==account)throw new ChainRuleError('Unauthorized',`Esta assinatura é da carteira do ${who.party} (${who.address.slice(0,4)}…${who.address.slice(-4)}).`);
  if(e.type==='propose')await this.chain.ensureTokenAccountsFor([this.need(e.supplierRole,'fornecedor'),who.address]);
  return this.compile(who.address,await this.instructions(e,createNoopSigner(who.address)));
 });}
 private async compile(feePayer:Address,ixs:Instruction[],units=200_000){
  const {value:blockhash}=await this.chain.rpc.getLatestBlockhash().send();
  const message=pipe(createTransactionMessage({version:0}),m=>setTransactionMessageFeePayer(feePayer,m),m=>setTransactionMessageLifetimeUsingBlockhash(blockhash,m),
   m=>appendTransactionMessageInstructions([getSetComputeUnitLimitInstruction({units}),...ixs],m));
  return getBase64EncodedWireTransaction(compileTransaction(message));
 }
 /** Confere na rede que a carteira certa assinou a instrução certa deste evento, com sucesso. undefined = ainda não confirmada. */
 verifySigned(e:ChainEvent,expectedSigner:string,signature:string){return this.guard(async()=>{
  const tx=await this.chain.rpc.getTransaction(signature as never,{maxSupportedTransactionVersion:0,commitment:'confirmed',encoding:'json'}).send();
  if(!tx)return false;if(tx.meta?.err)throw new ChainRuleError('Recusado',`A rede recusou a transação: ${JSON.stringify(tx.meta.err)}`);
  const keys=tx.transaction.message.accountKeys.map(String);const signers=keys.slice(0,tx.transaction.message.header.numRequiredSignatures);
  const disc:Record<string,ArrayLike<number>>={register_seller:REGISTER_SELLER_DISCRIMINATOR,propose:PROPOSE_DISCRIMINATOR,accept:ACCEPT_DISCRIMINATOR,reject:REJECT_DISCRIMINATOR,propose_change:PROPOSE_CHANGE_DISCRIMINATOR,
   decide_change:DECIDE_CHANGE_DISCRIMINATOR,record_offchain_payment:RECORD_OFFCHAIN_PAYMENT_DISCRIMINATOR,confirm_offchain_payment:CONFIRM_OFFCHAIN_PAYMENT_DISCRIMINATOR,dispute_offchain_payment:DISPUTE_OFFCHAIN_PAYMENT_DISCRIMINATOR,settle_sale:SETTLE_SALE_DISCRIMINATOR};
  const ok=tx.transaction.message.instructions.some(ix=>keys[ix.programIdIndex]===GIRO_ACORDOS_PROGRAM_ADDRESS&&sameBytes(getBase58Encoder().encode(ix.data).slice(0,8),disc[e.type]));
  if(!ok)throw new ChainRuleError('Recusado','A transação não é desta ação do GIRO.');
  if(!signers.includes(expectedSigner))throw new ChainRuleError('Unauthorized','Assinada pela carteira errada.');
  return true;
 });}

 /** Monta a instrução settle_sale (conferindo antes a divisão) para um pagador; reference = Solana Pay. */
 private async settleInstruction(e:SettleEvent,payer:TransactionSigner,reference?:Address){
  const model=await this.modelFromChain();const got=this.previewOn(model,e);
  if(!samePreview(got,e.expected))throw new ChainRuleError('Divergente',`A rede dividiria diferente do GIRO: rede ${JSON.stringify(got)} × GIRO ${JSON.stringify(e.expected)}.`);
  const seller=this.need('vendedor','vendedor');const ordered=orderAgreements(model,seller,e.agreements);
  const commissionOwners=[...e.fixed.map(f=>f.role),...e.percent.map(p=>p.role)].map(r=>this.need(r,'fornecedor'));
  await this.chain.ensureTokenAccountsFor([seller,...ordered.map(a=>address(a.supplier)),...commissionOwners]);
  const ix=await getSettleSaleInstructionAsync({payer,seller,mint:this.chain.mint,payerToken:await this.chain.ata(payer.address),sellerToken:await this.chain.ata(seller),tokenProgram:TOKEN_PROGRAM_ADDRESS,
   amount:this.u(e.amount),agreementsCount:ordered.length,fixed:e.fixed.map(f=>this.u(f.amount)),percentBps:e.percent.map(p=>p.rateBps)});
  const extra:{address:Address;role:AccountRole}[]=[];
  for(const a of ordered){extra.push({address:(await this.pdas(a.agreementKey)).agreement,role:AccountRole.WRITABLE},{address:await this.chain.ata(address(a.supplier)),role:AccountRole.WRITABLE});}
  for(const owner of commissionOwners)extra.push({address:await this.chain.ata(owner),role:AccountRole.WRITABLE});
  if(reference)extra.push({address:reference,role:AccountRole.READONLY});
  return {...ix,accounts:[...ix.accounts,...extra]} as Instruction;
 }
 /**
  * Solana Pay (transaction request): transação NÃO assinada para a carteira do cliente assinar e enviar.
  * O cliente paga com o próprio token e a própria taxa; o GIRO nunca toca no dinheiro (não custodial).
  */
 buildPayment(e:SettleEvent,account:string,reference:string){return this.guard(async()=>{
  await this.prepare();const payer=createNoopSigner(address(account));
  const ata=await getCreateAssociatedTokenIdempotentInstructionAsync({payer,owner:payer.address,mint:this.chain.mint});
  const settle=await this.settleInstruction(e,payer,address(reference));
  return this.compile(payer.address,[ata,settle],400_000);
 });}
 /** Acha o pagamento pela reference e confere: sucesso, programa do GIRO e valor da venda. */
 findPayment(reference:string,amount:number){return this.guard(async()=>{
  const sigs=await this.chain.rpc.getSignaturesForAddress(address(reference),{limit:10,commitment:'confirmed'}).send();
  for(const s of sigs){if(s.err)continue;
   const tx=await this.chain.rpc.getTransaction(s.signature,{maxSupportedTransactionVersion:0,commitment:'confirmed',encoding:'json'}).send();if(!tx||tx.meta?.err)continue;
   const keys=[...tx.transaction.message.accountKeys,...(tx.meta?.loadedAddresses?.writable??[]),...(tx.meta?.loadedAddresses?.readonly??[])].map(String);
   for(const ix of tx.transaction.message.instructions){
    if(keys[ix.programIdIndex]!==GIRO_ACORDOS_PROGRAM_ADDRESS)continue;
    const data=getSettleSaleInstructionDataDecoder().decode(getBase58Encoder().encode(ix.data));
    if(data.amount===this.u(amount)&&ix.accounts.some(i=>keys[i]===reference))return String(s.signature);
   }
  }
  return undefined;
 });}
 private async rawAgreements(){
  const seller=this.address('vendedor');if(!seller)return [];const b58=getBase58Decoder();
  const rows=await this.chain.rpc.getProgramAccounts(GIRO_ACORDOS_PROGRAM_ADDRESS,{encoding:'base64',filters:[
   {memcmp:{offset:0n,bytes:b58.decode(AGREEMENT_DISCRIMINATOR) as never,encoding:'base58'}},{memcmp:{offset:8n,bytes:seller as never,encoding:'base58'}}]}).send();
  return rows.map(r=>getAgreementDecoder().decode(getBase64Encoder().encode(r.account.data[0])));
 }
 /** Contas reais da rede carregadas no modelo de referência, EM CENTAVOS (para simular a venda antes de cobrar). */
 private async modelFromChain(){
  const m=new GiroAcordosModel();const seller=this.address('vendedor');let active=0;
  for(const a of await this.rawAgreements()){const status=STATUS[a.status];if(status==='active')active+=1;
   m.agreements.set(m.id(seller,toHex(a.agreementKey)),{seller,supplier:a.supplier,mint:a.mint,agreementKey:toHex(a.agreementKey),original:a.original/this.scale,paid:a.paid/this.scale,rateBps:a.rateBps,priority:a.priority,dueTs:a.dueTs,status,version:a.version,seq:a.seq,createdTs:a.createdTs,completedTs:a.completedTs,pendingChange:null});}
  m.sellers.set(seller,{seller,committedBps:0,activeCount:active,nextSeq:0n,unit:1n,maxSale:0n});return m;
 }
 private previewOn(m:GiroAcordosModel,e:SettleEvent):SalePreview{
  const seller=this.address('vendedor'),payer='cliente-simulado';const max=this.profile.maxSaleCents;
  if(max>0&&e.amount>max)throw new ChainRuleError('SaleLimit',`Venda acima do teto de segurança (R$ ${(max/100).toFixed(2)}).`);
  try{const t=m.dryRunSettle(payer,{payer,seller,mint:this.chain.mint,amount:BigInt(e.amount),now:BigInt(Math.floor(Date.now()/1000)),
    fixed:e.fixed.map(f=>({to:f.role,amount:BigInt(f.amount)})),percent:e.percent.map(p=>({to:p.role,rateBps:p.rateBps})),
    agreements:orderAgreements(m,seller,e.agreements).map(a=>({agreementKey:a.agreementKey,supplierTokenOwner:a.supplier}))});
   return {commissions:t.filter(x=>x.kind==='fixed'||x.kind==='commission').map(x=>Number(x.amount)),agreements:Object.fromEntries(t.filter(x=>x.kind==='agreement').map(x=>[x.agreementKey!,Number(x.amount)])),seller:Number(t.find(x=>x.kind==='seller')!.amount)};
  }catch(err){throw new ChainRuleError((err as {code?:string}).code??'Recusado');}
 }
 previewSale(e:SettleEvent){return this.guard(async()=>this.previewOn(await this.modelFromChain(),e));}
 agreements(){return this.guard(async()=>(await this.rawAgreements()).map((a):ChainAgreementView=>({agreementKey:toHex(a.agreementKey),supplier:a.supplier,original:this.c(a.original),paid:this.c(a.paid),rateBps:a.rateBps,priority:a.priority,dueTs:Number(a.dueTs),status:STATUS[a.status],version:a.version,pendingChange:a.pendingChange.__option==='Some'})));}

 // ---- Atestados (Solana Attestation Service oficial). Quem assina: o EMISSOR do GIRO (carteira do próprio GIRO). ----
 private async sasAccounts(){
  const issuer=address(this.wallets.get('emissor').address);const [credential]=await deriveCredentialPda({authority:issuer,name:GIRO_CREDENTIAL});
  const [schema]=await deriveSchemaPda({credential,name:GIRO_SCHEMA.name,version:GIRO_SCHEMA.version});return {credential,schema};
 }
 private async ensureSchema(){
  const issuer=await this.chain.signer('emissor');const {credential,schema}=await this.sasAccounts();const exists=async(a:Address)=>!!(await this.chain.rpc.getAccountInfo(a,{encoding:'base64'}).send()).value;
  if(!await exists(credential))await this.chain.send(issuer,[getCreateCredentialInstruction({payer:issuer,credential,authority:issuer,name:GIRO_CREDENTIAL,signers:[issuer.address]} as never) as unknown as Instruction]);
  if(!await exists(schema))await this.chain.send(issuer,[getCreateSchemaInstruction({payer:issuer,authority:issuer,credential,schema,name:GIRO_SCHEMA.name,description:GIRO_SCHEMA.description,layout:new Uint8Array(GIRO_SCHEMA.layout),fieldNames:[...GIRO_SCHEMA.fieldNames]} as never) as unknown as Instruction]);
  return {credential,schema,issuer};
 }
 /** Só atesta acordo que a REDE mostra como concluído (o emissor não inventa conclusão). */
 attest(t:AttestTarget){return this.guard(async()=>{
  await this.prepare();const a=await this.load(t.agreementKey);if(STATUS[a.status]!=='completed')throw new ChainRuleError('NotCompleted','O acordo ainda não está concluído na rede.');
  const {credential,schema,issuer}=await this.ensureSchema();const nonce=nonceAddress(attestationNonce(t.agreementKey,t.recordFingerprint));
  const [attestation]=await deriveAttestationPda({credential,schema,nonce});
  return String(await this.chain.send(issuer,[getCreateAttestationInstruction({payer:issuer,authority:issuer,credential,schema,attestation,nonce,expiry:0n,
   data:encodeAttestationData({agreementKey:t.agreementKey,recordHash:t.recordFingerprint,completedAt:isoToTs(t.completedAt),onTime:t.onTime})} as never) as unknown as Instruction]));
 });}
 findAttestation(agreementKey:string,recordFingerprint:string){return this.guard(async():Promise<AttestationRecord|undefined>=>{
  const {credential,schema}=await this.sasAccounts();const nonce=nonceAddress(attestationNonce(agreementKey,recordFingerprint));
  const [pda]=await deriveAttestationPda({credential,schema,nonce});const info=await this.chain.rpc.getAccountInfo(pda,{encoding:'base64'}).send();if(!info.value)return undefined;
  const att=getAttestationDecoder().decode(getBase64Encoder().encode(info.value.data[0]));const data=decodeAttestationData(Uint8Array.from(att.data));
  if(data.agreementKey!==agreementKey||data.recordHash!==recordFingerprint)return undefined;
  return {...data,nonce:String(att.nonce),credential:String(att.credential),schema:String(att.schema),signer:String(att.signer),expiry:att.expiry,createdTs:0n};
 });}
 /**
  * SÓ redes de TESTE (local/Devnet): o emissor do GIRO envia 0,05 SOL de teste (taxas) e, se pedido, BRZ/BRL de teste
  * para a carteira de uma pessoa. Na mainnet é recusado: ninguém recebe dinheiro do GIRO.
  */
 fundTest(owner:string,cents:number){return this.guard(async()=>{
  if(this.cluster==='mainnet'||this.profile.mint.mode!=='criar')throw new ChainRuleError('SoTeste','Abastecer só existe nas redes de teste.');
  if(!Number.isSafeInteger(cents)||cents<0||cents>1_000_000)throw new ChainRuleError('InvalidTerms','Valor de teste inválido (até R$ 10.000).');
  await this.prepare();const issuer=await this.chain.signer('emissor');const to=address(owner);
  await this.chain.send(issuer,[getTransferSolInstruction({source:issuer,destination:to,amount:50_000_000n})]);
  if(cents>0){await this.chain.ensureTokenAccountsFor([to]);await this.chain.send(issuer,[getMintToInstruction({mint:this.chain.mint,token:await this.chain.ata(to),mintAuthority:issuer,amount:this.u(cents)})]);}
  return {sol:0.05,token:cents};
 });}
 balance(role:string){return this.guard(async()=>{const a=this.address(role);return a?(await this.chain.tokenBalanceOf(address(a)))/this.scale:0n;});}
}

/** Rede local (validador em 127.0.0.1, carteiras de TESTE assinam). Mantido para os testes e o modo localnet. */
export class LocalnetAdapter extends SolanaAdapter {
 constructor(rpc:string,wallets:TestWallets){super(networkProfile('localnet',rpc),wallets);}
}
