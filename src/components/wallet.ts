/**
 * Ligação com carteiras Solana pelo Wallet Standard (Phantom, Solflare, Backpack…), sem bibliotecas extras.
 * A carteira assina e envia; o GIRO nunca vê a chave de ninguém.
 */
export interface WalletAccount {address:string;publicKey:Uint8Array;chains:readonly string[]}
export interface StandardWallet {name:string;icon:string;chains:readonly string[];accounts:readonly WalletAccount[];features:Record<string,Record<string,(...a:never[])=>Promise<unknown>>>}

const registered=new Set<StandardWallet>();let listening=false;
/** Descobre as carteiras instaladas no navegador (protocolo app-ready/register-wallet do Wallet Standard). */
export function discoverWallets():StandardWallet[]{
 if(typeof window==='undefined')return [];
 const api={register:(...wallets:StandardWallet[])=>{for(const w of wallets)registered.add(w);return ()=>{for(const w of wallets)registered.delete(w);};}};
 if(!listening){listening=true;window.addEventListener('wallet-standard:register-wallet',e=>{(e as CustomEvent<(a:typeof api)=>void>).detail(api);});}
 try{window.dispatchEvent(new CustomEvent('wallet-standard:app-ready',{detail:api}));}catch{/* navegador antigo */}
 return [...registered].filter(w=>w.chains.some(c=>c.startsWith('solana:'))&&'standard:connect' in w.features&&'solana:signAndSendTransaction' in w.features);
}
export async function connect(wallet:StandardWallet):Promise<WalletAccount>{
 const r=await (wallet.features['standard:connect'].connect as ()=>Promise<{accounts:readonly WalletAccount[]}>)();
 const account=(r?.accounts??wallet.accounts)[0];if(!account)throw Error('A carteira não liberou nenhuma conta.');return account;
}
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58(bytes:Uint8Array){let n=0n;for(const b of bytes)n=n*256n+BigInt(b);let out='';while(n>0n){out=ALPHABET[Number(n%58n)]+out;n/=58n;}for(const b of bytes){if(b!==0)break;out='1'+out;}return out;}
const fromBase64=(b64:string)=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
/** Assina uma mensagem de texto (prova de que a carteira é sua). Devolve a assinatura em base58. */
export async function signMessage(wallet:StandardWallet,account:WalletAccount,message:string){
 const f=wallet.features['solana:signMessage'];if(!f)throw Error('Esta carteira não assina mensagens. Use Phantom ou Solflare.');
 const [r]=await (f.signMessage as (i:{account:WalletAccount;message:Uint8Array})=>Promise<{signature:Uint8Array}[]>)({account,message:new TextEncoder().encode(message)});
 return base58(r.signature);
}
/** A carteira assina e ENVIA a transação montada pelo GIRO. Devolve a assinatura da transação (base58). */
export async function signAndSend(wallet:StandardWallet,account:WalletAccount,transactionBase64:string,chain:string){
 const [r]=await (wallet.features['solana:signAndSendTransaction'].signAndSendTransaction as (i:{account:WalletAccount;transaction:Uint8Array;chain:string})=>Promise<{signature:Uint8Array}[]>)({account,transaction:fromBase64(transactionBase64),chain});
 return base58(r.signature);
}
