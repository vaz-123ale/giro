import {type Address,type Instruction,type KeyPairSigner,type Rpc,type RpcSubscriptions,type SolanaRpcApi,type SolanaRpcSubscriptionsApi,createDefaultRpcTransport,createSolanaRpcFromTransport,
 address,airdropFactory,appendTransactionMessageInstructions,createKeyPairSignerFromBytes,createSolanaRpc,createSolanaRpcSubscriptions,createTransactionMessage,
 getSignatureFromTransaction,lamports,pipe,sendAndConfirmTransactionFactory,setTransactionMessageFeePayerSigner,setTransactionMessageLifetimeUsingBlockhash,signTransactionMessageWithSigners} from '@solana/kit';
import {TOKEN_PROGRAM_ADDRESS,fetchMaybeToken,findAssociatedTokenPda,getCreateAssociatedTokenIdempotentInstructionAsync,getInitializeMint2Instruction,getMintSize,getMintToInstruction} from '@solana-program/token';
import {getCreateAccountInstruction} from '@solana-program/system';
import {getSetComputeUnitLimitInstruction} from '@solana-program/compute-budget';
import {requireLocalEndpoint} from '../solana.ts';
import type {TestWallets} from './keys.ts';

/**
 * Conexão com a rede Solana via @solana/kit: validador LOCAL (só 127.0.0.1) ou, com autorização explícita,
 * Devnet/mainnet (RPC https validado em server/config.ts). Carteiras do servidor: só as de TESTE (local) e a do
 * EMISSOR do GIRO (atestados e contas de token). Nunca a carteira de uma pessoa.
 */
export const BRLT_DECIMALS=2;
/**
 * RPC público (Devnet/mainnet) limita pedidos (HTTP 429). Repete com espera crescente (0,5 s, 1 s, 2 s… até ~16 s)
 * em vez de falhar na hora. Só para leitura/envio idempotente: reenviar a MESMA transação assinada não duplica.
 */
function retryingTransport(url:string){
 const base=createDefaultRpcTransport({url});
 return (async(...args:Parameters<typeof base>)=>{
  for(let attempt=0;;attempt++){
   try{return await base(...args);}
   catch(e){const text=String((e as Error)?.message??e)+JSON.stringify((e as {context?:unknown})?.context??'');
    if(attempt>=6||!/429|Too Many|ECONNRESET|fetch failed/i.test(text))throw e;await new Promise(r=>setTimeout(r,500*2**attempt));}
  }
 }) as typeof base;
}
export class LocalChain {
 readonly local:boolean;
 readonly rpc:Rpc<SolanaRpcApi>;readonly subscriptions:RpcSubscriptions<SolanaRpcSubscriptionsApi>;
 private readonly wallets:TestWallets;private readonly signers=new Map<string,KeyPairSigner>();
 constructor(rpcUrl:string,wallets:TestWallets){
  const url=new URL(rpcUrl);this.local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);if(this.local)requireLocalEndpoint(rpcUrl);else if(url.protocol!=='https:')throw Error('RPC público precisa ser https.');
  this.wallets=wallets;this.rpc=this.local?createSolanaRpc(url.toString()):createSolanaRpcFromTransport(retryingTransport(url.toString()));this.mint=address(wallets.get('mint-brl-t').address);
  const ws=new URL(url.toString());ws.protocol=url.protocol==='https:'?'wss:':'ws:';if(this.local)ws.port=String(Number(url.port||8899)+1);
  this.subscriptions=createSolanaRpcSubscriptions(ws.toString());
 }
 async signer(role:string){let s=this.signers.get(role);if(!s){s=await createKeyPairSignerFromBytes(this.wallets.get(role).secret);this.signers.set(role,s);}return s;}
 address(role:string){return address(this.wallets.get(role).address);}
 private health?:{at:number;ok:boolean};
 /** Saúde da rede, guardada por 10 s (menos pedidos ao RPC público). */
 async healthy(){if(this.health&&Date.now()-this.health.at<10_000)return this.health.ok;let ok=false;try{ok=(await this.rpc.getHealth().send())==='ok';}catch{ok=false;}this.health={at:Date.now(),ok};return ok;}
 /** Monta, assina (todas as carteiras citadas nas instruções) e confirma uma transação. */
 async send(feePayer:KeyPairSigner,instructions:Instruction[],computeUnits?:number){
  const {value:blockhash}=await this.rpc.getLatestBlockhash().send();
  const all=computeUnits?[getSetComputeUnitLimitInstruction({units:computeUnits}),...instructions]:instructions;
  const message=pipe(createTransactionMessage({version:0}),m=>setTransactionMessageFeePayerSigner(feePayer,m),m=>setTransactionMessageLifetimeUsingBlockhash(blockhash,m),m=>appendTransactionMessageInstructions(all,m));
  const tx=await signTransactionMessageWithSigners(message);
  await sendAndConfirmTransactionFactory({rpc:this.rpc,rpcSubscriptions:this.subscriptions})(tx as Parameters<ReturnType<typeof sendAndConfirmTransactionFactory>>[0],{commitment:'confirmed'});
  return getSignatureFromTransaction(tx);
 }
 /** SOL de teste (validador local ou Devnet) para pagar taxas. Na mainnet não existe: quem paga é a própria carteira. */
 async fund(role:string,minSol=1n){
  const who=this.address(role);const {value}=await this.rpc.getBalance(who).send();
  if(value<minSol*1_000_000_000n)await airdropFactory({rpc:this.rpc,rpcSubscriptions:this.subscriptions})({recipientAddress:who,lamports:lamports(minSol*2n*1_000_000_000n),commitment:'confirmed'});
 }
 /** Cria o token de TESTE (uma vez): BRL-T (2 casas, local) ou BRZ-teste (4 casas, Devnet). Autoridade: "emissor". */
 async ensureMint(role='mint-brl-t',decimals=BRLT_DECIMALS){
  const mint=await this.signer(role);const issuer=await this.signer('emissor');
  const info=await this.rpc.getAccountInfo(mint.address,{encoding:'base64'}).send();if(info.value)return mint.address;
  await this.fund('emissor');const space=BigInt(getMintSize());const rent=await this.rpc.getMinimumBalanceForRentExemption(space).send();
  await this.send(issuer,[getCreateAccountInstruction({payer:issuer,newAccount:mint,lamports:rent,space,programAddress:TOKEN_PROGRAM_ADDRESS}),
   getInitializeMint2Instruction({mint:mint.address,decimals,mintAuthority:issuer.address,freezeAuthority:null})]);
  return mint.address;
 }
 /** Token usado nas vendas (BRL-T local, BRZ-teste na Devnet ou BRZ real na mainnet). */
 mint!:Address;
 useMint(mint:Address){this.mint=mint;}
 async ata(owner:Address){const [ata]=await findAssociatedTokenPda({owner,mint:this.mint,tokenProgram:TOKEN_PROGRAM_ADDRESS});return ata;}
 /** Cria (se faltar) as contas de token BRL-T destes papéis, numa transação paga pelo emissor. */
 async ensureTokenAccounts(roles:string[]){return this.ensureTokenAccountsFor(roles.map(r=>this.address(r)));}
 /** Cria (se faltar) as contas de token destes endereços, pagas pelo emissor do GIRO. */
 async ensureTokenAccountsFor(owners:Address[]){
  const issuer=await this.signer('emissor');const mint=this.mint;const ixs:Instruction[]=[];
  for(const owner of [...new Set(owners)]){const ata=await this.ata(owner);if((await fetchMaybeToken(this.rpc,ata)).exists)continue;
   ixs.push(await getCreateAssociatedTokenIdempotentInstructionAsync({payer:issuer,owner,mint}));}
  for(let i=0;i<ixs.length;i+=6)await this.send(issuer,ixs.slice(i,i+6));
 }
 /** Emite BRL-T de TESTE para um papel (ex.: o cliente de teste antes de pagar). */
 async mintTo(role:string,amount:bigint){
  const issuer=await this.signer('emissor');await this.ensureTokenAccounts([role]);
  return this.send(issuer,[getMintToInstruction({mint:this.mint,token:await this.ata(this.address(role)),mintAuthority:issuer,amount})]);
 }
 async tokenBalance(role:string){return this.tokenBalanceOf(this.address(role));}
 async tokenBalanceOf(owner:Address){const t=await fetchMaybeToken(this.rpc,await this.ata(owner));return t.exists?t.data.amount:0n;}
}
