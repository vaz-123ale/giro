/**
 * MODELO DE REFERÊNCIA do programa Anchor "giro_acordos" (solana/programs/giro_acordos).
 * Mesmas contas, instruções, regras e códigos de erro do programa em Rust, com aritmética u64 (bigint).
 * Serve para três coisas: (1) teste de paridade com calculateDistribution(); (2) adaptador "modelo"
 * enquanto o solana-test-validator não está instalado; (3) oráculo para os testes LiteSVM do programa.
 * Não envia nada para lugar nenhum. Nenhum nome, telefone ou observação entra aqui (regra 13).
 */
export const BPS_DENOMINATOR=10000n;
export const MAX_AGREEMENTS_PER_SALE=4;
export const MAX_COMMISSIONS_PER_SALE=2;
const U64_MAX=(1n<<64n)-1n;

export type ChainErrorCode='Unauthorized'|'InvalidStatus'|'InvalidTerms'|'CapacityExceeded'|'TooManyAccounts'|'AmountZero'|'Overflow'|'ExceedsRemaining'|'MissingAgreement'|'WrongOrder'|'WrongMint'|'WrongSeller'|'WrongSupplierAccount'|'DuplicateAgreement'|'NonceUsed'|'ChangePending'|'NoPendingChange'|'InsufficientFunds'|'AlreadyExists'|'SaleLimit'|'InvalidUnit';
export class ChainError extends Error{readonly code:ChainErrorCode;constructor(code:ChainErrorCode){super(code);this.code=code;this.name='ChainError';}}
const fail=(code:ChainErrorCode):never=>{throw new ChainError(code);};
const ensure=(ok:boolean,code:ChainErrorCode)=>{if(!ok)fail(code);};

export type ChainStatus='proposed'|'active'|'completed'|'rejected'|'cancelled';
export interface ChainTerms {original:bigint;rateBps:number;priority:number;dueTs:bigint}
export interface PendingChange {terms:ChainTerms;proposer:string;reservedBps:number}
/** PDA ["agreement", vendedor, agreement_key] */
export interface ChainAgreement {seller:string;supplier:string;mint:string;agreementKey:string;original:bigint;paid:bigint;rateBps:number;priority:number;dueTs:bigint;status:ChainStatus;version:number;seq:bigint;createdTs:bigint;completedTs:bigint;pendingChange:PendingChange|null}
/** PDA ["seller", vendedor] */
export interface SellerState {seller:string;committedBps:number;activeCount:number;nextSeq:bigint;
 /** Menor fração das divisões em unidades do token (BRZ 4 casas → 100 = 1 centavo). */ unit:bigint;
 /** Teto por venda em unidades do token (0 = sem teto). */ maxSale:bigint}
/** PDA ["cash", agreement, nonce] */
export interface OffchainPayment {agreementKey:string;nonce:string;amount:bigint;paidTs:bigint;status:'pending'|'confirmed'|'disputed';decidedTs:bigint}
export interface Transfer {to:string;amount:bigint;kind:'fixed'|'commission'|'agreement'|'seller';agreementKey?:string}
export type ChainEventLog={type:'AgreementProposed'|'AgreementAccepted'|'AgreementRejected'|'ProposalCancelled'|'ChangeProposed'|'ChangeDecided'|'SaleSettled'|'OffchainPaymentRecorded'|'OffchainPaymentConfirmed'|'OffchainPaymentDisputed'|'AgreementCompleted';agreementKey?:string;data?:Record<string,string|number|boolean>};

const checkedAdd=(a:bigint,b:bigint)=>{const r=a+b;ensure(r<=U64_MAX,'Overflow');return r;};
const checkedSub=(a:bigint,b:bigint)=>{ensure(b<=a,'Overflow');return a-b;};
const u64=(v:bigint)=>{ensure(v>=0n&&v<=U64_MAX,'Overflow');return v;};
/** floor(valor × bps / 10000) com intermediário u128, como no Rust. */
export const share=(amount:bigint,rateBps:number)=>u64(amount)*BigInt(rateBps)/BPS_DENOMINATOR;
export const remainingOf=(a:ChainAgreement)=>a.original-a.paid;
function validTerms(t:ChainTerms){ensure(t.original>0n&&t.original<=U64_MAX&&Number.isInteger(t.rateBps)&&t.rateBps>0&&t.rateBps<=10000&&Number.isInteger(t.priority)&&t.priority>=1&&t.priority<=999,'InvalidTerms');}
/** Chave de ordem que o programa EXIGE: prioridade, depois data de criação (não decrescente).
 * Empates (mesma prioridade e mesma data) ficam na ordem enviada: o GIRO desempata pelo id interno,
 * que não vai para a rede, e nenhuma das partes tem direito contratual de vir antes num empate. */
export const orderKey=(a:Pick<ChainAgreement,'priority'|'createdTs'>,b:Pick<ChainAgreement,'priority'|'createdTs'>)=>a.priority-b.priority||(a.createdTs<b.createdTs?-1:a.createdTs>b.createdTs?1:0);
/** Ordem padrão (sem informação do GIRO): chave exigida + sequência da proposta. */
export const settlementOrder=(a:ChainAgreement,b:ChainAgreement)=>orderKey(a,b)||(a.seq<b.seq?-1:a.seq>b.seq?1:0);

export interface SettleSaleInput {payer:string;seller:string;mint:string;amount:bigint;now:bigint;
 /** Valores fixos por venda (destino, centavos), na ordem da regra. */ fixed:{to:string;amount:bigint}[];
 /** Comissões percentuais (destino, bps). */ percent:{to:string;rateBps:number}[];
 /** remaining_accounts: (PDA do acordo, dono da conta de token de destino), em ordem de liquidação. */ agreements:{agreementKey:string;supplierTokenOwner:string}[]}

export interface ModelSnapshot {agreements:unknown[];sellers:unknown[];cash:unknown[];balances:unknown[];logs:unknown[]}
/** Estado da rede local simulada: contas do programa + saldos do token de teste (BRL-T). */
export class GiroAcordosModel {
 readonly agreements=new Map<string,ChainAgreement>();
 readonly sellers=new Map<string,SellerState>();
 readonly cash=new Map<string,OffchainPayment>();
 readonly balances=new Map<string,bigint>();
 readonly logs:ChainEventLog[]=[];
 id=(seller:string,key:string)=>`${seller}:${key}`;
 private emit(e:ChainEventLog){this.logs.push(e);}
 balance(owner:string){return this.balances.get(owner)??0n;}
 mintTo(owner:string,amount:bigint){this.balances.set(owner,checkedAdd(this.balance(owner),u64(amount)));}
 agreement(seller:string,key:string){return this.agreements.get(this.id(seller,key));}
 private load(seller:string,key:string){return this.agreement(seller,key)??fail('MissingAgreement');}
 private sellerState(seller:string){let s=this.sellers.get(seller);if(!s){s={seller,committedBps:0,activeCount:0,nextSeq:0n,unit:1n,maxSale:0n};this.sellers.set(seller,s);}return s;}
 /** register_seller(unit, max_sale) — assina: vendedor. */
 registerSeller(signer:string,seller:string,unit=1n,maxSale=0n){ensure(signer===seller,'Unauthorized');ensure(!this.sellers.has(seller),'AlreadyExists');ensure(unit>=1n,'InvalidTerms');const s=this.sellerState(seller);s.unit=unit;s.maxSale=maxSale;return s;}
 /** set_limits(max_sale) — assina: vendedor. */
 setLimits(signer:string,seller:string,maxSale:bigint){ensure(signer===seller,'Unauthorized');this.sellerState(seller).maxSale=maxSale;}
 private reserve(s:SellerState,bps:number){ensure(s.committedBps+bps<=10000,'CapacityExceeded');s.committedBps+=bps;}
 private release(s:SellerState,bps:number){ensure(bps<=s.committedBps,'Overflow');s.committedBps-=bps;}
 private complete(a:ChainAgreement,now:bigint){
  const s=this.sellerState(a.seller);a.status='completed';a.completedTs=now;
  this.release(s,a.rateBps+(a.pendingChange?.reservedBps??0));a.pendingChange=null;s.activeCount-=1;
  this.emit({type:'AgreementCompleted',agreementKey:a.agreementKey,data:{completedTs:Number(now)}});
 }

 /** propose(terms, paid_before) — assina: vendedor. A capacidade (≤ 100%) é reservada já na proposta. */
 propose(signer:string,p:{seller:string;supplier:string;mint:string;agreementKey:string;terms:ChainTerms;paidBefore:bigint;now:bigint;createdTs?:bigint}){
  ensure(signer===p.seller,'Unauthorized');ensure(p.supplier!==p.seller,'InvalidTerms');validTerms(p.terms);ensure(p.paidBefore>=0n&&p.paidBefore<=p.terms.original,'InvalidTerms');
  ensure(!this.agreements.has(this.id(p.seller,p.agreementKey)),'AlreadyExists');
  const s=this.sellerState(p.seller);ensure(p.terms.original%s.unit===0n&&p.paidBefore%s.unit===0n,'InvalidUnit');this.reserve(s,p.terms.rateBps);
  const a:ChainAgreement={seller:p.seller,supplier:p.supplier,mint:p.mint,agreementKey:p.agreementKey,original:p.terms.original,paid:p.paidBefore,rateBps:p.terms.rateBps,priority:p.terms.priority,dueTs:p.terms.dueTs,status:'proposed',version:1,seq:s.nextSeq,createdTs:p.createdTs??p.now,completedTs:0n,pendingChange:null};
  s.nextSeq+=1n;this.agreements.set(this.id(p.seller,p.agreementKey),a);this.emit({type:'AgreementProposed',agreementKey:a.agreementKey});return a;
 }
 /** accept() — assina: fornecedor. Saldo já zerado conclui sem passar pelo motor de vendas. */
 accept(signer:string,seller:string,key:string,now:bigint){
  const a=this.load(seller,key);ensure(signer===a.supplier,'Unauthorized');ensure(a.status==='proposed','InvalidStatus');
  a.status='active';this.sellerState(seller).activeCount+=1;this.emit({type:'AgreementAccepted',agreementKey:key});
  if(remainingOf(a)===0n)this.complete(a,now);return a;
 }
 /** reject() — assina: fornecedor; libera a capacidade reservada. */
 reject(signer:string,seller:string,key:string){const a=this.load(seller,key);ensure(signer===a.supplier,'Unauthorized');ensure(a.status==='proposed','InvalidStatus');a.status='rejected';this.release(this.sellerState(seller),a.rateBps);this.emit({type:'AgreementRejected',agreementKey:key});return a;}
 /** cancel_proposal() — assina: vendedor, só antes do aceite. */
 cancelProposal(signer:string,seller:string,key:string){const a=this.load(seller,key);ensure(signer===a.seller,'Unauthorized');ensure(a.status==='proposed','InvalidStatus');a.status='cancelled';this.release(this.sellerState(seller),a.rateBps);this.emit({type:'ProposalCancelled',agreementKey:key});return a;}
 /** propose_change(terms) — assina: qualquer parte. Não pode fabricar quitação (original > pago). */
 proposeChange(signer:string,seller:string,key:string,terms:ChainTerms){
  const a=this.load(seller,key);ensure(signer===a.seller||signer===a.supplier,'Unauthorized');ensure(a.status==='active','InvalidStatus');ensure(!a.pendingChange,'ChangePending');
  validTerms(terms);ensure(terms.original>a.paid,'InvalidTerms');ensure(terms.original%this.sellerState(seller).unit===0n,'InvalidUnit');
  const extra=Math.max(0,terms.rateBps-a.rateBps);this.reserve(this.sellerState(seller),extra);
  a.pendingChange={terms,proposer:signer,reservedBps:extra};this.emit({type:'ChangeProposed',agreementKey:key,data:{version:a.version}});return a;
 }
 /** decide_change(aceita) — assina: a OUTRA parte. Aceite aplica os termos e incrementa a versão. */
 decideChange(signer:string,seller:string,key:string,accept:boolean){
  const a=this.load(seller,key);const change=a.pendingChange??fail('NoPendingChange');
  const other=change.proposer===a.seller?a.supplier:a.seller;ensure(signer===other,'Unauthorized');ensure(a.status==='active','InvalidStatus');
  const s=this.sellerState(seller);
  if(accept){this.release(s,a.rateBps+change.reservedBps);this.reserve(s,change.terms.rateBps);Object.assign(a,{original:change.terms.original,rateBps:change.terms.rateBps,priority:change.terms.priority,dueTs:change.terms.dueTs});a.version+=1;}
  else this.release(s,change.reservedBps);
  a.pendingChange=null;this.emit({type:'ChangeDecided',agreementKey:key,data:{accepted:accept,version:a.version}});return a;
 }
 /**
  * settle_sale(amount, commissions) — assina: cliente. Uma transação divide o pagamento:
  * 1. fixos por venda; 2. comissões %; 3. acordos ativos por prioridade; 4. resto ao vendedor.
  * parte = min(floor(valor × bps / 10000), restante do acordo, ainda disponível).
  * TODOS os acordos ativos do vendedor precisam vir na ordem certa (impede omitir um fornecedor).
  * Cada acordo recebe a parte INTEIRA; se fixos/comissões não deixarem espaço, a venda é recusada
  * (CapacityExceeded) — igual ao validateSaleCapacity do GIRO; impede uma "comissão" que zere o fornecedor.
  */
 settleSale(signer:string,i:SettleSaleInput){
  ensure(signer===i.payer,'Unauthorized');ensure(i.amount>0n,'AmountZero');u64(i.amount);
  ensure(i.agreements.length<=MAX_AGREEMENTS_PER_SALE&&i.fixed.length+i.percent.length<=MAX_COMMISSIONS_PER_SALE,'TooManyAccounts');
  ensure(this.balance(i.payer)>=i.amount,'InsufficientFunds');
  const s=this.sellerState(i.seller);ensure(i.amount%s.unit===0n,'InvalidUnit');ensure(s.maxSale===0n||i.amount<=s.maxSale,'SaleLimit');
  ensure(i.fixed.every(f=>f.amount%s.unit===0n),'InvalidUnit');const round=(v:bigint)=>v/s.unit*s.unit;
  ensure(i.agreements.length===s.activeCount,'MissingAgreement');
  const seen=new Set<string>();let previous:ChainAgreement|undefined;
  const loaded=i.agreements.map(r=>{
   ensure(!seen.has(r.agreementKey),'DuplicateAgreement');seen.add(r.agreementKey);
   const a=this.agreement(i.seller,r.agreementKey)??fail('MissingAgreement');
   ensure(a.seller===i.seller,'WrongSeller');ensure(a.mint===i.mint,'WrongMint');ensure(a.status==='active','InvalidStatus');ensure(r.supplierTokenOwner===a.supplier,'WrongSupplierAccount');
   if(previous)ensure(orderKey(previous,a)<=0,'WrongOrder');previous=a;return a;
  });
  let available=i.amount;const transfers:Transfer[]=[];
  for(const f of i.fixed){const part=f.amount<available?u64(f.amount):available;available=checkedSub(available,part);transfers.push({to:f.to,amount:part,kind:'fixed'});}
  for(const c of i.percent){ensure(Number.isInteger(c.rateBps)&&c.rateBps>=0&&c.rateBps<=10000,'InvalidTerms');let part=round(share(i.amount,c.rateBps));if(part>available)part=available;available=checkedSub(available,part);transfers.push({to:c.to,amount:part,kind:'commission'});}
  // Primeiro calcula tudo; só altera contas depois (a transação é atômica: falhou, nada muda).
  const parts:[ChainAgreement,bigint][]=[];
  for(const a of loaded){
   let part=round(share(i.amount,a.rateBps));const rest=remainingOf(a);if(part>rest)part=rest;ensure(part<=available,'CapacityExceeded');
   if(part===0n)continue;
   available=checkedSub(available,part);parts.push([a,part]);transfers.push({to:a.supplier,amount:part,kind:'agreement',agreementKey:a.agreementKey});
  }
  for(const [a,part] of parts){a.paid=checkedAdd(a.paid,part);if(remainingOf(a)===0n)this.complete(a,i.now);}
  transfers.push({to:i.seller,amount:available,kind:'seller'});
  // transfer_checked: cada parte sai direto da conta do cliente (não custodial).
  this.balances.set(i.payer,checkedSub(this.balance(i.payer),i.amount));
  for(const t of transfers)if(t.amount>0n)this.balances.set(t.to,checkedAdd(this.balance(t.to),t.amount));
  this.emit({type:'SaleSettled',data:{amount:String(i.amount),toSeller:String(available)}});
  return transfers;
 }
 /** Simula settle_sale sem alterar nada (mesmo papel do simulateTransaction da rede). */
 dryRunSettle(signer:string,i:SettleSaleInput){const copy=GiroAcordosModel.restore(this.snapshot());copy.mintTo(i.payer,i.amount);return copy.settleSale(signer,i);}
 /** Estado serializável (bigint → string) para guardar a rede simulada em disco. */
 snapshot():ModelSnapshot{return JSON.parse(JSON.stringify({agreements:[...this.agreements.values()],sellers:[...this.sellers.values()],cash:[...this.cash.entries()],balances:[...this.balances.entries()],logs:this.logs},(_k,v)=>typeof v==='bigint'?`${v}n`:v));}
 static restore(snap:ModelSnapshot){
  const revive=(v:unknown):unknown=>typeof v==='string'&&/^-?\d+n$/.test(v)?BigInt(v.slice(0,-1)):Array.isArray(v)?v.map(revive):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,revive(x)])):v;
  const s=revive(snap) as {agreements:ChainAgreement[];sellers:SellerState[];cash:[string,OffchainPayment][];balances:[string,bigint][];logs:ChainEventLog[]};
  const m=new GiroAcordosModel();for(const a of s.agreements)m.agreements.set(m.id(a.seller,a.agreementKey),a);for(const x of s.sellers)m.sellers.set(x.seller,x);
  for(const [k,v] of s.cash)m.cash.set(k,v);for(const [k,v] of s.balances)m.balances.set(k,v);m.logs.push(...s.logs);return m;
 }
 /** record_offchain_payment(amount, nonce) — assina SÓ o vendedor: registra a entrega do dinheiro (pendente). Saldo não muda. */
 recordOffchainPayment(signer:string,seller:string,key:string,amount:bigint,nonce:string,now:bigint){
  const a=this.load(seller,key);ensure(signer===a.seller,'Unauthorized');ensure(a.status==='active','InvalidStatus');
  ensure(amount>0n,'AmountZero');ensure(amount%this.sellerState(seller).unit===0n,'InvalidUnit');ensure(amount<=remainingOf(a),'ExceedsRemaining');
  const pda=`${this.id(seller,key)}:${nonce}`;ensure(!this.cash.has(pda),'NonceUsed');
  this.cash.set(pda,{agreementKey:key,nonce,amount,paidTs:now,status:'pending',decidedTs:0n});
  this.emit({type:'OffchainPaymentRecorded',agreementKey:key,data:{amount:String(amount)}});return this.cash.get(pda)!;
 }
 private pendingCash(signer:string,seller:string,key:string,nonce:string){
  const a=this.load(seller,key);ensure(signer===a.supplier,'Unauthorized');const p=this.cash.get(`${this.id(seller,key)}:${nonce}`)??fail('MissingAgreement');ensure(p.status==='pending','InvalidStatus');return {a,p};
 }
 /** confirm_offchain_payment() — assina SÓ o fornecedor: confirma que recebeu; só aqui o saldo baixa. */
 confirmOffchainPayment(signer:string,seller:string,key:string,nonce:string,now:bigint){
  const {a,p}=this.pendingCash(signer,seller,key,nonce);ensure(a.status==='active','InvalidStatus');ensure(p.amount<=remainingOf(a),'ExceedsRemaining');
  p.status='confirmed';p.decidedTs=now;a.paid=checkedAdd(a.paid,p.amount);
  this.emit({type:'OffchainPaymentConfirmed',agreementKey:key,data:{amount:String(p.amount)}});
  if(remainingOf(a)===0n)this.complete(a,now);return a;
 }
 /** dispute_offchain_payment() — assina SÓ o fornecedor: não recebeu; nada muda no saldo. */
 disputeOffchainPayment(signer:string,seller:string,key:string,nonce:string,now:bigint){
  const {p}=this.pendingCash(signer,seller,key,nonce);p.status='disputed';p.decidedTs=now;
  this.emit({type:'OffchainPaymentDisputed',agreementKey:key,data:{amount:String(p.amount)}});return p;
 }
}

/** Datas do GIRO → i64 (segundos). Vencimento vale até o fim do dia em Brasília. */
export const dueToTs=(due:string)=>BigInt(Math.floor(Date.parse(`${due}T23:59:59-03:00`)/1000));
export const isoToTs=(iso:string)=>BigInt(Math.floor(Date.parse(iso.length===10?`${iso}T00:00:00Z`:iso)/1000));
