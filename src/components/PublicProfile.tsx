import {useEffect,useState} from 'react';
import {ArrowLeft,BadgeCheck,Copy,FileText,Handshake,History,Lock,MessageCircle,Nfc,Share2,ShieldCheck,TrendingUp} from 'lucide-react';
import {money} from '../domain/finance';
import {invitationQR} from '../domain/qr';

/**
 * PERFIL PÚBLICO de confiança (sem login): link para fornecedores, WhatsApp, QR e NFC.
 * Só fatos do GIRO e da rede — nenhum número inventado. Índice explicado na própria página.
 */
interface Partner {slug:string;name:string;role:string;photo:string|null;completed:number;active:number;registered:number}
interface Pub {slug:string;name:string;role:string;photo:string|null;since:string|null;score:number|null;scoreParts:{punctual:number;settled:number;registered:number;history:number};
 stats:{agreements:number;active:number;completed:number;onTime:number;settled:number;overdue:number};chain:{network:string|null;registered:number;attested:number};commissionsReceived?:number;partners:Partner[]}
const PROGRAM='CVAQPvyjepuDP9j5df22ipp9E7XWVxej1T26rb4NvEMV';
const since=(iso:string|null)=>{if(!iso)return 'novo no GIRO';const d=Math.max(0,Math.round((Date.now()-Date.parse(iso))/86400000));return d<31?`ativo há ${d} dia${d===1?'':'s'}`:d<365?`ativo há ${Math.round(d/30)} meses`:`ativo há ${(d/365).toFixed(1).replace('.',',')} anos`;};
const Face=({p,size=44}:{p:{photo:string|null;name:string};size?:number})=>p.photo?<img className="pp-face" style={{width:size,height:size}} src={p.photo} alt={`Foto de ${p.name}`}/>:<span className="pp-face pp-face-empty" style={{width:size,height:size}} aria-hidden="true">{p.name.slice(0,1).toUpperCase()}</span>;

function QRBox({url}:{url:string}){
 let matrix:boolean[][]|null=null;try{matrix=invitationQR(url);}catch{matrix=null;}
 if(!matrix)return null;
 return <svg className="pp-qr" viewBox="0 0 45 45" role="img" aria-label="QR do perfil público"><rect width="45" height="45" fill="white"/>{matrix.flatMap((row,y)=>row.map((on,x)=>on?<rect key={`${x}-${y}`} x={x+4} y={y+4} width="1" height="1" fill="#002718"/>:null))}</svg>;
}

export function PublicProfile({slug}:{slug:string}){
 const [p,setP]=useState<Pub>();const [error,setError]=useState('');const [toast,setToast]=useState('');
 useEffect(()=>{fetch(`/api/publico/${slug}`).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);setP(v);document.title=`${v.name} · Perfil de confiança GIRO`;}).catch(e=>setError((e as Error).message));},[slug]);
 const url=`${location.origin}/p/${slug}`;
 const say=(m:string)=>{setToast(m);setTimeout(()=>setToast(''),2800);};
 const text=p?`Perfil de confiança de ${p.name} no GIRO: ${p.stats.completed} acordo(s) quitado(s), ${p.stats.onTime} no prazo, ${p.chain.registered} registrado(s) na rede Solana. Veja: ${url}`:url;
 const copy=async()=>{try{await navigator.clipboard.writeText(url);say('Link do perfil copiado!');}catch{say(url);}};
 const share=async()=>{try{if(navigator.share){await navigator.share({title:'Perfil de confiança GIRO',text,url});}else{await copy();}}catch{/* cancelado */}};
 const whatsapp=()=>{location.href=`whatsapp://send?text=${encodeURIComponent(text)}`;};
 /** NFC: grava o link do perfil numa etiqueta (Chrome no Android). Encostar o celular na etiqueta abre o perfil. */
 const nfc=async()=>{
  const W=window as unknown as {NDEFReader?:new()=>{write:(m:{records:{recordType:string;data:string}[]})=>Promise<void>}};
  if(!W.NDEFReader){say('NFC: abra esta página no Chrome do Android. Aqui, use Compartilhar.');await share();return;}
  try{say('Encoste a etiqueta NFC atrás do celular…');await new W.NDEFReader().write({records:[{recordType:'url',data:url}]});say('Perfil gravado na etiqueta NFC ✓');}
  catch(e){say(`NFC: ${(e as Error).message}`);}
 };
 if(error)return <main className="pp"><p className="error" role="alert">{error}</p></main>;
 if(!p)return <main className="pp"><p>Carregando…</p></main>;
 const pct=p.stats.completed?Math.round(p.stats.onTime/p.stats.completed*100):null;
 const level=p.score===null?'Novo na rede':p.score>=90?'Nível máximo':p.score>=70?'Confiável':p.score>=50?'Em formação':'Atenção';
 return <main className="pp">
  <header className="pp-top"><button className="pp-round" aria-label="Voltar" onClick={()=>history.length>1?history.back():location.assign('/')}><ArrowLeft size={20}/></button>
   <span className="pp-pill"><BadgeCheck size={16} aria-hidden="true"/> Rede GIRO • Perfil de confiança</span>
   <button className="pp-send" onClick={share}><Share2 size={18} aria-hidden="true"/> Enviar</button></header>

  <section className="pp-hero">
   <div className="pp-hero-head"><div><span className="pp-badge"><ShieldCheck size={14} aria-hidden="true"/> {p.chain.registered>0?'Registrado na rede Solana':'Perfil GIRO'}</span>
    <h1>{p.name}</h1><p>{p.role}</p></div><Face p={p} size={64}/></div>
   <p className="pp-since"><History size={16} aria-hidden="true"/> {since(p.since)} • {p.stats.agreements?`${Math.round(p.stats.completed/p.stats.agreements*100)}% dos acordos quitados`:'sem acordos ainda'}</p>
   <div className="pp-score"><div><span className="pp-cap">Índice de confiança GIRO</span>
     <div className="pp-score-line"><strong>{p.score??'—'}</strong>{p.score!==null&&<span>/100</span>}<em>{level}</em></div></div>
    <svg viewBox="0 0 36 36" className="pp-ring" aria-hidden="true"><path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3.5"/>
     <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="#6bff8f" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${p.score??0}, 100`}/></svg></div>
   <div className="pp-grid"><div><span className="pp-cap">Total quitado</span><strong>{money(p.stats.settled)}</strong><small><TrendingUp size={13} aria-hidden="true"/> divisão automática</small></div>
    <div><span className="pp-cap">Pontualidade</span><strong className="pp-green">{pct===null?'—':`${pct}%`}</strong><small>{p.stats.completed} quitado(s) · {p.stats.active} ativo(s)</small></div>
    {p.commissionsReceived!==undefined&&<div><span className="pp-cap">Comissões recebidas</span><strong>{money(p.commissionsReceived)}</strong><small>como ajudante</small></div>}
    <div><span className="pp-cap">Na rede</span><strong>{p.chain.registered}</strong><small>{p.chain.attested} comprovante(s) atestado(s)</small></div></div>
  </section>

  <section className="pp-card"><h2><Handshake size={20} aria-hidden="true"/> {p.partners.length>1?'Parceiras com acordo ativo':'Parceria'}</h2>
   {p.partners.length?<ul className="pp-partners">{p.partners.map(x=><li key={x.slug}><a href={`/p/${x.slug}`}><Face p={x}/><span><strong>{x.name} {x.registered>0&&<BadgeCheck size={15} className="pp-green" aria-label="registrado na rede"/>}</strong><small>{x.role}</small></span>
    <em>{x.completed} quitado(s) · {x.active} ativo(s)</em></a></li>)}</ul>:<p className="muted">Ainda sem parcerias registradas.</p>}</section>

  <section className="pp-card pp-share"><h2>Compartilhar este perfil</h2><p className="muted">Mostre o QR, encoste o celular numa etiqueta NFC ou envie o link.</p>
   <div className="pp-qr-wrap"><QRBox url={url}/></div>
   <div className="pp-link"><code>{url.replace(/^https?:\/\//,'')}</code><button onClick={copy}><Copy size={15} aria-hidden="true"/> Copiar</button></div>
   <div className="pp-actions"><button className="pp-main" onClick={whatsapp}><MessageCircle size={22} aria-hidden="true"/> Enviar perfil pelo WhatsApp</button>
    <button className="pp-soft" onClick={nfc}><Nfc size={20} aria-hidden="true"/> Gravar perfil em etiqueta NFC</button>
    <button className="pp-soft" onClick={share}><Share2 size={20} aria-hidden="true"/> Compartilhar (celular)</button>
    <button className="pp-soft" onClick={()=>window.print()}><FileText size={20} aria-hidden="true"/> Carta de idoneidade comercial (PDF)</button></div></section>

  <section className="pp-card pp-ledger"><h3><Lock size={16} aria-hidden="true"/> Histórico auditado</h3>
   <p className="muted">Os acordos registrados são assinados pelas duas carteiras no programa GIRO na rede Solana{p.chain.network==='devnet'?' (Devnet — rede de teste)':''}. Os comprovantes atestados podem ser conferidos em "Verificar histórico".</p>
   <div className="pp-mono"><span>Programa: {PROGRAM.slice(0,6)}…{PROGRAM.slice(-4)}</span><b>{p.chain.registered} registrado(s) · {p.chain.attested} atestado(s)</b></div>
   <details><summary>Como o índice é calculado</summary><p className="muted">45% pontualidade ({p.scoreParts.punctual}%) + 25% acordos quitados ({p.scoreParts.settled}%) + 20% registrados na rede ({p.scoreParts.registered}%) + 10% histórico ({p.scoreParts.history} de 5 acordos). Atraso em aberto reduz a pontualidade pela metade. Sem acordos: "Novo na rede".</p></details></section>

  <p className="pp-print-note">Carta gerada pelo GIRO em {new Date().toLocaleString('pt-BR')} a partir dos registros do sistema. Link: {url}</p>
  {toast&&<div className="pp-toast" role="status">{toast}</div>}
 </main>;
}
