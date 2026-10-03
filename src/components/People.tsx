import {useCallback,useEffect,useState} from 'react';
import {ShieldCheck,UserPlus,Camera,LogOut,ExternalLink} from 'lucide-react';
import {money} from '../domain/finance';
import {connect,discoverWallets,signMessage} from './wallet';

/** Pessoas com login, perfis (contratos + confiança) e "Minha conta" de cada colega. */
async function api<T>(url:string,body?:unknown):Promise<T>{
 const r=await fetch(url,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(r.status===401){location.replace('/entrar');return new Promise(()=>{});}
 const v=await r.json();if(!r.ok)throw Error(v.error??'Não foi possível concluir.');return v;
}
/** Reduz a foto no próprio navegador (256 px, JPEG) antes de enviar. */
async function resizePhoto(file:File){
 const img=await createImageBitmap(file);const size=256;const c=document.createElement('canvas');c.width=size;c.height=size;
 const s=Math.min(img.width,img.height);c.getContext('2d')!.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,size,size);
 return c.toDataURL('image/jpeg',0.85);
}
const Avatar=({photo,name}:{photo?:string|null;name:string})=>photo?<img className="avatar" src={photo} alt={`Foto de ${name}`}/>:<span className="avatar avatar-empty" aria-hidden="true">{name.slice(0,1).toUpperCase()}</span>;
const Page=({children}:{children:React.ReactNode})=><main className="standalone people-page"><img className="logo" src="/logo_giro.png" alt="GIRO"/>{children}</main>;
const sair=async()=>{await fetch('/api/sair',{method:'POST'});location.replace('/entrar');};

interface Row {id:string;original:number;paid:number;remaining:number;rateBps:number;due:string;situation:string;onTime:boolean|null;chain:{registered:boolean;state:string;attested:boolean}|null;link?:string|null;waiting?:boolean;with?:string}
function AgreementList({rows}:{rows:Row[]}){
 if(!rows.length)return <p className="empty">Nenhum acordo ainda.</p>;
 return <ul className="profile-agreements">{rows.map(r=><li key={r.id}><div><strong>{r.id}</strong>{r.with&&<small> com {r.with}</small>}<small>{money(r.original)} · {r.rateBps/100}% das vendas · {r.situation}{r.onTime!==null&&(r.onTime?' · no prazo':' · após o prazo')}</small>
  <small>Pago {money(r.paid)} · falta {money(r.remaining)}</small>{r.chain&&<small className="chain-mark">{r.chain.registered?'Registrado na rede ✓':`Rede: ${r.chain.state}`}{r.chain.attested?' · comprovante atestado ✓':''}</small>}</div>
  {r.link&&<a className={r.waiting?'primary':'secondary'} href={r.link}>{r.waiting?'Ver e aceitar':'Abrir acordo'}</a>}</li>)}</ul>;
}
function TrustBox({p}:{p:{stats:{total:number;active:number;completed:number;onTime:number;settled:number};trust:{registered:number;attested:number};commissionsReceived?:number}}){
 return <dl className="trust-grid"><div><dt>Acordos</dt><dd>{p.stats.total}</dd></div><div><dt>Ativos</dt><dd>{p.stats.active}</dd></div><div><dt>Concluídos</dt><dd>{p.stats.completed}</dd></div>
  <div><dt>No prazo</dt><dd>{p.stats.onTime}</dd></div><div><dt>Total quitado</dt><dd>{money(p.stats.settled)}</dd></div><div><dt>Registrados na rede</dt><dd>{p.trust.registered}</dd></div>
  <div><dt>Atestados</dt><dd>{p.trust.attested}</dd></div>{p.commissionsReceived!==undefined&&<div><dt>Comissões recebidas</dt><dd>{money(p.commissionsReceived)}</dd></div>}</dl>;
}
interface Card {slug:string;name:string;roleLabel:string;photo:string|null}
function PeopleList(){
 const [list,setList]=useState<Card[]>([]);useEffect(()=>{api<Card[]>('/api/perfis').then(setList).catch(()=>setList([]));},[]);
 return <section className="panel"><h2>Perfis</h2><ul className="people-cards">{list.map(p=><li key={p.slug}><a href={`/p/${p.slug}`}><Avatar photo={p.photo} name={p.name}/><span><strong>{p.name}</strong><small>{p.roleLabel}</small></span></a></li>)}</ul></section>;
}

/** Perfil de uma pessoa (ou do negócio): contratos e confiança. Só para quem está logado. */
export function ProfilePage({slug}:{slug:string}){
 const [p,setP]=useState<Card&{stats:{total:number;active:number;completed:number;onTime:number;settled:number};trust:{registered:number;attested:number};commissionsReceived?:number;agreements:Row[]}>();const [error,setError]=useState('');
 useEffect(()=>{api<typeof p>(`/api/perfis/${slug}`).then(setP).catch(e=>setError((e as Error).message));},[slug]);
 return <Page>{error&&<p className="error" role="alert">{error}</p>}{p&&<><section className="panel profile-head"><Avatar photo={p.photo} name={p.name}/><div><h1>{p.name}</h1><p className="muted">{p.roleLabel}</p></div></section>
  <section className="panel"><h2><ShieldCheck size={20} aria-hidden="true"/> Confiança</h2><TrustBox p={p}/></section>
  <section className="panel"><h2>Contratos</h2><AgreementList rows={p.agreements}/></section></>}
  <p><a href="/eu">← Minha conta</a> · <a href="/">Painel do negócio</a></p></Page>;
}

/** "Minha conta" de cada colega: foto, senha, carteira, acordos, confirmações e perfis das outras. */
export function MyPage(){
 const [me,setMe]=useState<{person:{name:string;login:string;roleLabel:string;slug:string;photo:string|null;mustChange:boolean};agreements:Row[];receipts:{amount:number;paidAt:string;link:string}[];shift:{link:string;active:boolean;commissionBps:number}|null;commissionsReceived:number;wallet?:{walletMode:boolean;token:string;cluster:string};myWallet:string|null}>();
 const [msg,setMsg]=useState('');const [error,setError]=useState('');const [atual,setAtual]=useState('');const [nova,setNova]=useState('');
 const load=useCallback(()=>api<typeof me>('/api/eu').then(setMe).catch(e=>setError((e as Error).message)),[]);useEffect(()=>{void load();},[load]);
 const run=async(fn:()=>Promise<string>)=>{setError('');setMsg('');try{setMsg(await fn());await load();}catch(e){setError((e as Error).message);}};
 if(!me)return <Page>{error?<p className="error">{error}</p>:<p>Carregando…</p>}</Page>;
 const p=me.person;
 return <Page><section className="panel profile-head"><Avatar photo={p.photo} name={p.name}/><div><h1>{p.name}</h1><p className="muted">{p.roleLabel} · usuário <b>{p.login}</b></p>
   <label className="secondary photo-button"><Camera size={18} aria-hidden="true"/> Trocar foto<input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void run(async()=>{await api('/api/eu/foto',{photo:await resizePhoto(f)});return 'Foto atualizada.';});}}/></label>
   <a className="primary" href={`/p/${p.slug}`}><ExternalLink size={16} aria-hidden="true"/> Meu perfil público (compartilhar / NFC)</a> <button className="text-button" onClick={sair}><LogOut size={16} aria-hidden="true"/> Sair</button></div></section>
  {msg&&<p className="success" role="status">{msg}</p>}{error&&<p className="error" role="alert">{error}</p>}
  {p.mustChange&&<section className="panel note"><h2>Troque a senha provisória</h2><form onSubmit={e=>{e.preventDefault();void run(async()=>{await api('/api/eu/senha',{atual,nova});setAtual('');setNova('');return 'Senha trocada.';});}}>
   <label>Senha provisória<input type="password" value={atual} onChange={e=>setAtual(e.target.value)} autoComplete="current-password" required/></label>
   <label>Nova senha (mín. 10 caracteres)<input type="password" value={nova} onChange={e=>setNova(e.target.value)} autoComplete="new-password" minLength={10} required/></label><button className="primary">Trocar senha</button></form></section>}
  {me.wallet?.walletMode&&<section className="panel"><h2>Minha carteira</h2><p className="muted">Rede {me.wallet.cluster==='mainnet'?'Solana (dinheiro REAL)':'Solana Devnet (TESTE, sem valor)'} · token {me.wallet.token}</p>
   {me.myWallet?<p>Carteira vinculada: <code>{me.myWallet.slice(0,4)}…{me.myWallet.slice(-4)}</code></p>:<button className="primary" onClick={()=>run(async()=>{
    const w=discoverWallets()[0];if(!w)throw Error('Instale a carteira Phantom ou Solflare neste navegador e recarregue a página.');const a=await connect(w);
    const {message}=await api<{message:string}>(`/api/eu/carteira/mensagem?endereco=${a.address}`);await api('/api/eu/carteira',{address:a.address,message,signature:await signMessage(w,a,message)});return 'Carteira vinculada.';})}>Conectar minha carteira</button>}</section>}
  <section className="panel"><h2>Meus acordos</h2><AgreementList rows={me.agreements}/></section>
  {me.receipts.length>0&&<section className="panel"><h2>Confirmar pagamentos em dinheiro</h2><ul>{me.receipts.map(r=><li key={r.link}>{money(r.amount)} em {new Date(r.paidAt).toLocaleDateString('pt-BR')} — <a href={r.link}>confirmar</a></li>)}</ul></section>}
  {me.shift&&<section className="panel"><h2>Meu turno</h2><p>{me.shift.active?'Você está em turno.':'Fora de turno.'} Comissão: {me.shift.commissionBps/100}% · recebido até agora {money(me.commissionsReceived)}</p><a className="primary" href={me.shift.link}>{me.shift.active?'Encerrar turno':'Iniciar turno'}</a></section>}
  <PeopleList/></Page>;
}

/** Painel da dona: criar contas das colegas, senhas provisórias, foto/nome do negócio, abastecer carteiras de teste. */
export function PeopleAdmin(){
 const [data,setData]=useState<{business:{name:string|null;slug:string};people:{id:string;login:string;name:string;role:string;slug:string;hasPhoto:boolean;mustChange:boolean;wallet:string|null}[]}>();
 const [created,setCreated]=useState<{name:string;login:string;password:string;profile:string}[]>([]);const [msg,setMsg]=useState('');const [error,setError]=useState('');
 const [form,setForm]=useState({name:'',login:'',role:'fornecedor',commission:'10'});
 const load=useCallback(()=>api<typeof data>('/api/pessoas').then(setData).catch(e=>setError((e as Error).message)),[]);useEffect(()=>{void load();},[load]);
 const run=async(fn:()=>Promise<string>)=>{setError('');setMsg('');try{setMsg(await fn());await load();}catch(e){setError((e as Error).message);}};
 const origin=location.origin;
 return <><section className="panel"><h2><UserPlus size={20} aria-hidden="true"/> Pessoas e perfis</h2>
  <p className="muted">Crie a conta de cada colega. Você recebe o usuário e uma senha provisória para enviar; no primeiro acesso ela troca a senha e põe a foto. Depois crie o acordo com ela em Compromissos.</p>
  <form className="people-form" onSubmit={e=>{e.preventDefault();void run(async()=>{const r=await api<{name:string;login:string;password:string;profile:string}>('/api/pessoas',{name:form.name,login:form.login,role:form.role,commissionBps:Math.round(Number(form.commission.replace(',','.'))*100)||0});setCreated(c=>[r,...c.filter(x=>x.login!==r.login)]);setForm({...form,name:'',login:''});return `Conta de ${r.name} criada.`;});}}>
   <label>Nome<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required maxLength={120}/></label>
   <label>Usuário (login)<input value={form.login} onChange={e=>setForm({...form,login:e.target.value.toLowerCase()})} required pattern="[a-z0-9._-]{3,32}" placeholder="ex.: ana"/></label>
   <label>Papel<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="fornecedor">Fornecedor(a)</option><option value="ajudante">Ajudante (recebe comissão)</option><option value="cliente">Cliente</option></select></label>
   {form.role==='ajudante'&&<label>Comissão (%)<input value={form.commission} onChange={e=>setForm({...form,commission:e.target.value})} inputMode="decimal"/></label>}
   <button className="primary">Criar conta</button></form>
  {created.length>0&&<div className="note" role="status"><strong>Envie para cada pessoa (a senha só aparece agora; a anterior deixa de valer):</strong> <button type="button" className="text-button" onClick={()=>setCreated([])}>Limpar lista</button><ul>{created.map(c=><li key={c.login}><b>{c.name}</b> — endereço {origin}/entrar · usuário <code>{c.login}</code> · senha <code>{c.password}</code></li>)}</ul></div>}
  {msg&&<p className="success" role="status">{msg}</p>}{error&&<p className="error" role="alert">{error}</p>}</section>
  {data&&<section className="panel"><h2>Contas</h2><ul className="profile-agreements">{data.people.map(p=><li key={p.id}><div><strong>{p.name}</strong><small>{p.role} · usuário {p.login}{p.mustChange?' · ainda com senha provisória':''}{p.wallet?` · carteira ${p.wallet.slice(0,4)}…${p.wallet.slice(-4)}`:' · sem carteira'}</small></div>
   <span className="form-actions"><a className="secondary" href={`/p/${p.slug}`}>Perfil público</a>
    <button className="secondary" onClick={()=>run(async()=>{const r=await api<{login:string;password:string}>(`/api/pessoas/${p.id}/senha`,{});setCreated(c=>[{name:p.name,login:r.login,password:r.password,profile:`/perfil/${p.slug}`},...c.filter(x=>x.login!==r.login)]);return `Nova senha de ${p.name} gerada (a anterior não funciona mais).`;})}>Nova senha</button>
    {p.wallet&&<button className="secondary" onClick={()=>run(async()=>{const r=await api<{sol:number;token:number}>(`/api/pessoas/${p.id}/abastecer`,p.role==='cliente'?{cents:10000}:{});return `Enviado ${r.sol} SOL de teste${r.token?` e ${money(r.token)} em token de teste`:''} para ${p.name}.`;})}>Abastecer (teste)</button>}</span></li>)}</ul>
   <p><a className="primary" href={`/p/${data.business.slug}`}>Perfil público do negócio (compartilhar / NFC)</a> · <a href={`/perfil/${data.business.slug}`}>Perfil interno</a></p>
   <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{await api('/api/negocio',{name:String(f.get('nome'))});return 'Nome do negócio salvo.';});}}><label>Nome do negócio no perfil<input name="nome" defaultValue={data.business.name??''} required maxLength={120}/></label><button className="secondary">Salvar</button></form>
   <label className="secondary photo-button"><Camera size={18} aria-hidden="true"/> Foto do negócio<input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void run(async()=>{await api('/api/negocio',{photo:await resizePhoto(f)});return 'Foto do negócio salva.';});}}/></label></section>}</>;
}
