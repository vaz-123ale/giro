import {useCallback,useEffect,useState} from 'react';
import {Wallet} from 'lucide-react';
import {connect,discoverWallets,signAndSend,signMessage,type StandardWallet,type WalletAccount} from './wallet';

interface Pending {id:number;type:string;label:string;agreement?:string;counterparty?:string;amount?:string}
interface Info {cluster:string;walletMode:boolean;chain?:string;token:string;maxSaleCents:number;wallet:string|null;needsWallet:boolean;items:Pending[];bindScope:string;agreement?:string}
const short=(a:string)=>`${a.slice(0,4)}…${a.slice(-4)}`;
async function call<T>(url:string,body?:unknown):Promise<T>{const r=await fetch(url,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(v.error??'Falha na rede.');return v;}

/**
 * Carteira e assinaturas na rede (só nas redes públicas). Sem `token`: painel do negócio.
 * Com `token` (link de convite ou de confirmação): só o acordo daquela pessoa, assinado na carteira DELA.
 */
export function ChainWallet({token}:{token?:string}){
 const base=token?`/api/rede/${token}`:'/api/chain';
 const [info,setInfo]=useState<Info>();const [wallet,setWallet]=useState<StandardWallet>();const [account,setAccount]=useState<WalletAccount>();
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const load=useCallback(async()=>{try{setInfo(await call<Info>(token?base:'/api/chain/assinaturas'));}catch{setInfo(undefined);}},[base,token]);
 useEffect(()=>{void load();const t=setInterval(load,8000);return()=>clearInterval(t);},[load]);
 if(!info?.walletMode)return null;
 const run=async(fn:()=>Promise<string>)=>{setBusy(true);setError('');setMessage('');try{setMessage(await fn());await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const doConnect=()=>run(async()=>{
  const found=discoverWallets();if(!found.length)throw Error('Nenhuma carteira Solana encontrada neste navegador. Instale Phantom ou Solflare e recarregue a página.');
  const w=found[0];const a=await connect(w);setWallet(w);setAccount(a);
  if(info.wallet&&info.wallet!==a.address)throw Error(`Conecte a carteira vinculada (${short(info.wallet)}).`);
  if(!info.wallet){
   const {message:text}=await call<{message:string}>(`${token?`${base}/mensagem`:'/api/chain/carteira'}?endereco=${a.address}`);
   const signature=await signMessage(w,a,text);await call(token?`${base}/carteira`:'/api/chain/carteira',{address:a.address,message:text,signature});
   return `Carteira ${short(a.address)} vinculada.`;
  }
  return `Carteira ${short(a.address)} conectada.`;
 });
 const sign=(p:Pending)=>run(async()=>{
  if(!wallet||!account)throw Error('Conecte a carteira primeiro.');
  const url=token?`${base}/${p.id}`:`/api/chain/assinaturas/${p.id}`;
  const {transaction}=await call<{transaction:string}>(`${url}/transacao`,{account:account.address});
  const signature=await signAndSend(wallet,account,transaction,info.chain!);
  const r=await call<{confirmed:boolean}>(`${url}/assinada`,{signature});
  return r.confirmed?`${p.label}: registrado na rede ✓`:'Enviado. A rede ainda está confirmando; atualize em alguns segundos.';
 });
 const real=info.cluster==='mainnet';
 return <section className={`panel chain-wallet${real?' real-money':''}`} aria-labelledby="chain-wallet-title">
  <h2 id="chain-wallet-title"><Wallet size={22} aria-hidden="true"/> {token?'Sua carteira':'Carteira do negócio'}</h2>
  <p className="muted">Rede: <b>{real?'Solana (dinheiro REAL)':info.cluster==='devnet'?'Solana Devnet (TESTE, sem valor)':info.cluster}</b> · token <b>{info.token}</b>{info.maxSaleCents>0&&<> · teto por venda <b>R$ {(info.maxSaleCents/100).toFixed(2).replace('.',',')}</b></>}</p>
  <p>{info.wallet?<>Carteira vinculada: <code>{short(info.wallet)}</code></>:token?'Para registrar este acordo na rede, conecte a SUA carteira. O GIRO nunca recebe sua chave.':'Conecte a carteira do negócio. É ela que assina propostas e pagamentos em dinheiro.'}</p>
  {!account&&<button className="primary" disabled={busy} onClick={doConnect}>{info.wallet?'Conectar carteira':'Conectar e vincular carteira'}</button>}
  {info.items.length>0?<><h3>Para assinar ({info.items.length})</h3><ul className="sign-list">{info.items.map(p=><li key={p.id}><span><strong>{p.label}</strong><small>{[p.agreement,p.counterparty,p.amount].filter(Boolean).join(' · ')}</small></span><button className="secondary" disabled={busy||!account} onClick={()=>sign(p)}>Assinar na carteira</button></li>)}</ul></>:<p className="muted">Nada para assinar agora.</p>}
  {message&&<p className="success" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
  {real&&<p className="note">Atenção: transações na mainnet movem dinheiro real e não podem ser desfeitas. Confira o valor na sua carteira antes de aprovar.</p>}
 </section>;
}
