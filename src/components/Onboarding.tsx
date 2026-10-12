import {useCallback,useEffect,useState} from 'react';
import {Copy,MessageCircle,PenLine,Share2,UserPlus,Wallet} from 'lucide-react';
import {invitationQR} from '../domain/qr';
import {connect,discoverWallets,signAndSendMany,signMessage} from './wallet';

/**
 * Entrada simples no GIRO: convite (link/código) → conta própria → carteira conectada, numa tela só.
 * E assinatura em lote ("Assinar tudo") para a dona e para cada colega.
 */
async function call<T>(url:string,body?:unknown):Promise<T>{
 const r=await fetch(url,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const v=await r.json().catch(()=>({}));if(!r.ok)throw Error((v as {error?:string}).error??'Não foi possível concluir.');return v as T;
}
async function resizePhoto(file:File){const img=await createImageBitmap(file);const c=document.createElement('canvas');c.width=256;c.height=256;const s=Math.min(img.width,img.height);c.getContext('2d')!.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,256,256);return c.toDataURL('image/jpeg',0.85);}
const joinUrl=(code:string)=>`${location.origin}/participar/${code}`;

function MiniQR({url}:{url:string}){
 let m:boolean[][];try{m=invitationQR(url);}catch{return null;}
 return <svg className="mini-qr" viewBox="0 0 45 45" role="img" aria-label="QR do convite"><rect width="45" height="45" fill="white"/>{m.flatMap((row,y)=>row.map((on,x)=>on?<rect key={`${x}-${y}`} x={x+4} y={y+4} width="1" height="1" fill="#002718"/>:null))}</svg>;
}
/** Cartão de compartilhar um convite: QR, copiar, WhatsApp e compartilhar do celular. */
export function ShareInvite({code,title,text}:{code:string;title:string;text:string}){
 const url=joinUrl(code);const [msg,setMsg]=useState('');
 const copy=async()=>{try{await navigator.clipboard.writeText(url);setMsg('Link copiado!');}catch{setMsg(url);}};
 const share=async()=>{try{if(navigator.share)await navigator.share({title,text,url});else await copy();}catch{/* cancelado */}};
 return <div className="invite-share"><MiniQR url={url}/><div className="invite-share-body"><strong className="invite-code">{code}</strong><code className="invite-link">{url.replace(/^https?:\/\//,'')}</code>
  <div className="form-actions"><button className="secondary" onClick={copy}><Copy size={16} aria-hidden="true"/> Copiar link</button>
   <button className="secondary" onClick={()=>{location.href=`whatsapp://send?text=${encodeURIComponent(`${text} ${url}`)}`;}}><MessageCircle size={16} aria-hidden="true"/> WhatsApp</button>
   <button className="secondary" onClick={share}><Share2 size={16} aria-hidden="true"/> Compartilhar</button></div>{msg&&<small role="status">{msg}</small>}</div></div>;
}

/** Conecta a carteira (Phantom/Solflare) e prova que é sua, em um passo. */
async function connectAndBind(messageUrl:string,bindUrl:string){
 const w=discoverWallets()[0];if(!w)throw Error('Instale a carteira Phantom neste navegador (no celular, abra este link pelo navegador do app Phantom) e ative a rede de teste (Devnet).');
 const a=await connect(w);const {message}=await call<{message:string}>(`${messageUrl}?endereco=${a.address}`);
 await call(bindUrl,{address:a.address,message,signature:await signMessage(w,a,message)});return a.address;
}

/** Página do convite: cria a conta da própria pessoa e conecta a carteira — sem a dona digitar nada. */
export function JoinPage({code}:{code:string}){
 const [info,setInfo]=useState<{roleLabel:string;business:string;businessPhoto:string|null;invitedBy:string;commissionBps:number}>();
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [step,setStep]=useState<'conta'|'carteira'|'pronto'>('conta');
 const [form,setForm]=useState({name:'',login:'',password:''});const [photo,setPhoto]=useState<string>();
 useEffect(()=>{call<typeof info>(`/api/convite/${code}`).then(setInfo).catch(e=>setError((e as Error).message));},[code]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <main className="standalone join-page"><img className="logo" src="/logo_giro.png" alt="GIRO"/>
  <section className="panel">
   {info?<><div className="join-head">{info.businessPhoto?<img className="avatar" src={info.businessPhoto} alt=""/>:<span className="avatar avatar-empty" aria-hidden="true">{info.business.slice(0,1)}</span>}
    <div><h1>Você foi convidada(o) para o GIRO</h1><p className="muted">{info.invitedBy} te convidou para <b>{info.business}</b> como <b>{info.roleLabel}</b>{info.commissionBps?` (${info.commissionBps/100}% de comissão)`:''}.</p></div></div>
    <ol className="join-steps"><li className={step==='conta'?'on':'done'}>Sua conta</li><li className={step==='carteira'?'on':step==='pronto'?'done':''}>Sua carteira</li><li className={step==='pronto'?'on':''}>Pronto</li></ol></>:!error&&<p>Carregando convite…</p>}
   {error&&<p className="error" role="alert">{error}</p>}
   {info&&step==='conta'&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{await call(`/api/convite/${code}`,{...form,login:form.login.toLowerCase(),photo});setStep('carteira');});}}>
    <label>Seu nome<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required maxLength={120} autoComplete="name"/></label>
    <label>Escolha um usuário (para entrar)<input value={form.login} onChange={e=>setForm({...form,login:e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g,'')})} required minLength={3} maxLength={32} autoComplete="username" placeholder="ex.: maria"/></label>
    <label>Crie uma senha (mín. 10 caracteres)<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required minLength={10} autoComplete="new-password"/></label>
    <label className="secondary photo-button">{photo?'Foto escolhida ✓':'Sua foto (opcional)'}<input type="file" accept="image/*" hidden onChange={async e=>{const f=e.target.files?.[0];if(f)setPhoto(await resizePhoto(f));}}/></label>
    <button className="primary big-action" disabled={busy}>{busy?'Criando…':'Criar minha conta'}</button></form>}
   {step==='carteira'&&<div className="join-wallet"><h2><Wallet size={22} aria-hidden="true"/> Conecte sua carteira</h2>
    <p>É nela que você assina seus acordos e recebe sua parte das vendas. O GIRO nunca vê sua chave.</p>
    <p className="muted">Use a <b>Phantom</b> com a rede de teste ligada (Configurações → Configurações de desenvolvedor → Modo de teste → Solana Devnet). No celular, abra este link pelo navegador do app Phantom.</p>
    <button className="primary big-action" disabled={busy} onClick={()=>run(async()=>{await connectAndBind('/api/eu/carteira/mensagem','/api/eu/carteira');setStep('pronto');})}>{busy?'Aguardando a carteira…':'Conectar minha carteira'}</button>
    <button className="text-button" onClick={()=>setStep('pronto')}>Fazer isso depois</button></div>}
   {step==='pronto'&&<div className="join-done"><h2>Tudo pronto! 🎉</h2><p>Sua conta foi criada{''}. Na rede de teste, sua carteira recebe saldo de teste automaticamente para as taxas e para pagar.</p><a className="primary big-action" href="/eu">Ir para minha conta</a></div>}
  </section></main>;
}

/** Faixa "Assinar tudo": uma aprovação na carteira para tudo o que está pendente (dona ou colega). */
export function SignAllBanner({scope}:{scope:'dona'|'eu'}){
 const listUrl=scope==='dona'?'/api/chain/assinaturas':'/api/eu/assinaturas';const lotUrl=scope==='dona'?'/api/chain/assinaturas/lote':'/api/eu/assinaturas/lote';
 const [n,setN]=useState(0);const [chain,setChain]=useState('solana:devnet');const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');const [error,setError]=useState('');
 const load=useCallback(async()=>{try{const v=await call<{items:unknown[];chain?:string;wallet?:{chain?:string;walletMode?:boolean};walletMode?:boolean}>(listUrl);
  const mode=v.walletMode??v.wallet?.walletMode;setN(mode===false?0:v.items.length);setChain(v.chain??v.wallet?.chain??'solana:devnet');}catch{setN(0);}},[listUrl]);
 useEffect(()=>{void load();const t=setInterval(load,10000);return()=>clearInterval(t);},[load]);
 if(!n&&!msg)return null;
 const signAll=async()=>{setBusy(true);setError('');setMsg('');try{
  const w=discoverWallets()[0];if(!w)throw Error('Instale a Phantom (rede de teste Devnet) neste navegador.');const a=await connect(w);
  const {lotes}=await call<{lotes:{ids:number[];transaction:string}[]}>(`${lotUrl}/transacao`,{account:a.address});
  const sigs=await signAndSendMany(w,a,lotes.map(l=>l.transaction),chain);
  const r=await call<{confirmed:number}>(`${lotUrl}/assinada`,{lotes:lotes.map((l,i)=>({ids:l.ids,signature:sigs[i]}))});
  setMsg(r.confirmed?`${r.confirmed} assinatura(s) registrada(s) na rede ✓`:'Enviado; a rede ainda está confirmando.');await load();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="sign-banner" role="status">{n>0&&<><PenLine size={22} aria-hidden="true"/><span><strong>{n} assinatura{n>1?'s':''} pendente{n>1?'s':''}</strong><small>Aprove tudo de uma vez na sua carteira.</small></span>
  <button className="primary" disabled={busy} onClick={signAll}>{busy?'Aguardando a carteira…':'Assinar tudo'}</button></>}
  {msg&&<span className="success">{msg}</span>}{error&&<span className="error">{error}</span>}</section>;
}

/** Convites da dona: gerar link por papel e acompanhar quem entrou. */
export function InviteAdmin(){
 const [data,setData]=useState<{invites:{code:string;role:string;commissionBps:number;uses:number;maxUses:number;active:boolean}[];personal:{code:string};referrals:{name:string;roleLabel:string;slug:string}[]}>();
 const [role,setRole]=useState('fornecedor');const [commission,setCommission]=useState('10');const [latest,setLatest]=useState<string>();const [error,setError]=useState('');
 const load=useCallback(()=>call<typeof data>('/api/convites').then(setData).catch(e=>setError((e as Error).message)),[]);useEffect(()=>{void load();},[load]);
 const labels:Record<string,string>={fornecedor:'Fornecedor(a)',ajudante:'Ajudante',cliente:'Cliente'};
 return <section className="panel"><h2><UserPlus size={20} aria-hidden="true"/> Convidar pessoas (o jeito fácil)</h2>
  <p className="muted">Gere um link e mande para a pessoa. Ela cria a própria conta (usuário, senha e foto) e conecta a carteira — você não precisa digitar nem enviar senha.</p>
  <form className="people-form" onSubmit={async e=>{e.preventDefault();setError('');try{const i=await call<{code:string}>('/api/convites',{role,commissionBps:Math.round(Number(commission.replace(',','.'))*100)||0,maxUses:1});setLatest(i.code);await load();}catch(err){setError((err as Error).message);}}}>
   <label>Papel<select value={role} onChange={e=>setRole(e.target.value)}><option value="fornecedor">Fornecedor(a)</option><option value="ajudante">Ajudante (comissão)</option><option value="cliente">Cliente</option></select></label>
   {role==='ajudante'&&<label>Comissão (%)<input value={commission} onChange={e=>setCommission(e.target.value)} inputMode="decimal"/></label>}
   <button className="primary">Gerar link de convite</button></form>
  {error&&<p className="error" role="alert">{error}</p>}
  {latest&&<ShareInvite code={latest} title="Convite GIRO" text={`Oi! Te convidei para o GIRO como ${labels[role]}. Crie sua conta por aqui:`}/>}
  {data&&<><h3>Seu código pessoal</h3><p className="muted">Para indicar clientes. Pode ser usado várias vezes.</p><ShareInvite code={data.personal.code} title="GIRO" text="Conheça o GIRO e crie sua conta:"/>
   {data.invites.length>0&&<><h3>Convites enviados</h3><ul className="profile-agreements">{data.invites.map(i=><li key={i.code}><div><strong>{i.code}</strong><small>{labels[i.role]}{i.commissionBps?` · ${i.commissionBps/100}%`:''} · {i.uses>0?'usado ✓':i.active?'aguardando':'cancelado'}</small></div>
    {i.active&&i.uses===0&&<span className="form-actions"><button className="secondary" onClick={()=>setLatest(i.code)}>Mostrar</button><button className="secondary" onClick={async()=>{await call(`/api/convites/${i.code}/cancelar`,{});await load();}}>Cancelar</button></span>}</li>)}</ul></>}
   {data.referrals.length>0&&<><h3>Quem entrou pelos seus convites</h3><ul className="people-cards">{data.referrals.map(r=><li key={r.slug}><a href={`/p/${r.slug}`}><span><strong>{r.name}</strong><small>{r.roleLabel}</small></span></a></li>)}</ul></>}</>}
 </section>;
}
