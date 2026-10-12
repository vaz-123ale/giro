import {useCallback,useEffect,useState} from 'react';
import {BadgeCheck,Briefcase,MessageCircle,ShieldCheck,XCircle} from 'lucide-react';
import {money} from '../domain/finance';
import {toast} from './toast';

/**
 * Vagas "Procuro ajudante". A barraca ou o fornecedor define as regras (experiência mínima em meses e dias trabalhados);
 * quem tem interesse clica, e o GIRO confere sozinho no histórico de comissões recebidas.
 */
interface Exp {name:string;slug:string;roleLabel:string;contact:string|null;days:number;months:number;since:string|null;commissions:number}
interface Vaga {id:string;title:string;note:string;ownerName:string;minMonths:number;minDays:number;createdAt:string;mine:boolean;count:number;candidates?:(Exp&{eligible:boolean})[];interested?:boolean;eligible?:boolean}
const regra=(v:Vaga)=>v.minMonths||v.minDays?`Exige ${v.minMonths?`${v.minMonths} ${v.minMonths===1?'mês':'meses'} de experiência`:''}${v.minMonths&&v.minDays?' e ':''}${v.minDays?`${v.minDays} dias trabalhados`:''} como ajudante no GIRO`:'Sem exigência de experiência';
const expTxt=(e:Exp)=>e.days?`${e.days} dia${e.days===1?'':'s'} trabalhado${e.days===1?'':'s'} · ${e.months} ${e.months===1?'mês':'meses'} de experiência · ${money(e.commissions)} em comissões`:'Ainda sem histórico de comissões no GIRO';

function useVagas(){
 const [d,setD]=useState<{me:Exp|null;vagas:Vaga[]}>();
 const load=useCallback(()=>fetch('/api/vagas').then(r=>r.ok?r.json():null).then(v=>v&&setD(v)).catch(()=>{}),[]);
 useEffect(()=>{void load();},[load]);return {d,load};
}
const post=async(url:string,body:unknown={})=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(v.error);return v;};

/** Para a barraca e o fornecedor: publicar a vaga e ver quem se interessou (com a experiência conferida). */
export function ProcuroAjudante(){
 const {d,load}=useVagas();const [f,setF]=useState({title:'Ajudante de barraca',note:'',minMonths:'0',minDays:'0'});const [error,setError]=useState('');const [open,setOpen]=useState(false);
 const minhas=d?.vagas.filter(v=>v.mine)??[];
 return <section className="panel vagas-panel"><div className="section-title"><h2><Briefcase size={22} aria-hidden="true"/> Procuro ajudante</h2><button className="primary" onClick={()=>setOpen(!open)}>{open?'Fechar':'Publicar vaga'}</button></div>
  <p className="muted">Publique uma vaga com as suas regras. As pessoas clicam em “Tenho interesse” e o GIRO confere a experiência delas pelo histórico de comissões recebidas.</p>
  {open&&<form className="vaga-form" onSubmit={async e=>{e.preventDefault();setError('');try{await post('/api/vagas',{title:f.title,note:f.note,minMonths:Number(f.minMonths)||0,minDays:Number(f.minDays)||0});toast('Vaga publicada!');setOpen(false);await load();}catch(err){setError((err as Error).message);}}}>
   <label>Título<input value={f.title} onChange={e=>setF({...f,title:e.target.value})} maxLength={80} required/></label>
   <label>Descrição (dias, horário, o que vai fazer)<textarea rows={2} maxLength={400} value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></label>
   <div className="vaga-rules"><label>Experiência mínima (meses)<input inputMode="numeric" value={f.minMonths} onChange={e=>setF({...f,minMonths:e.target.value.replace(/\D/g,'')})}/></label>
    <label>Dias trabalhados no mínimo<input inputMode="numeric" value={f.minDays} onChange={e=>setF({...f,minDays:e.target.value.replace(/\D/g,'')})}/></label></div>
   {error&&<p className="error" role="alert">{error}</p>}<button className="primary">Publicar</button></form>}
  {minhas.length?minhas.map(v=><article className="vaga" key={v.id}>
   <div className="vaga-top"><div><strong>{v.title}</strong><small>{regra(v)}</small></div><button className="secondary" onClick={async()=>{await post(`/api/vagas/${v.id}/fechar`);toast('Vaga fechada.');await load();}}>Fechar vaga</button></div>
   {v.note&&<p>{v.note}</p>}
   <h3>Interessados ({v.candidates?.length??0})</h3>
   {v.candidates?.length?<ul className="candidates">{[...v.candidates].sort((a,b)=>Number(b.eligible)-Number(a.eligible)).map(c=><li key={c.slug} className={c.eligible?'ok':'no'}>
    <div><strong>{c.name}</strong> <span className={`elig ${c.eligible?'ok':'no'}`}>{c.eligible?<><BadgeCheck size={15}/> Atende às regras</>:<><XCircle size={15}/> Ainda não atende</>}</span><small>{expTxt(c)}</small></div>
    <div className="form-actions"><a className="secondary" href={`/p/${c.slug}`} target="_blank" rel="noopener"><ShieldCheck size={16}/> Confiança</a>{c.contact&&<a className="primary" href={`whatsapp://send?phone=55${c.contact.replace(/\D/g,'').replace(/^55/,'')}`} target="_blank" rel="noopener"><MessageCircle size={16}/> Contatar</a>}</div></li>)}</ul>:<p className="empty">Ninguém demonstrou interesse ainda.</p>}
  </article>):!open&&<p className="empty">Você não tem vagas abertas.</p>}
 </section>;
}

/** Para quem é da equipe ou comprador: ver as vagas, comparar com a própria experiência e demonstrar interesse. */
export function VagasAbertas(){
 const {d,load}=useVagas();if(!d)return null;
 const vagas=d.vagas.filter(v=>!v.mine);
 return <section className="panel vagas-panel"><h2><Briefcase size={22} aria-hidden="true"/> Vagas de ajudante</h2>
  <p className="muted">Barracas e fornecedores procurando ajudante. Sua experiência é conferida pelo GIRO: <b>{d.me?expTxt(d.me):'—'}</b>.</p>
  {vagas.length?vagas.map(v=><article className="vaga" key={v.id}><div className="vaga-top"><div><strong>{v.title}</strong><small>{v.ownerName} · {regra(v)}</small></div>
   <button className={v.interested?'secondary':'primary'} onClick={async()=>{try{const r=await post(`/api/vagas/${v.id}/interesse`);toast(r.interested?'Interesse enviado! Seu perfil foi salvo para quem publicou.':'Interesse retirado.');await load();}catch(e){toast((e as Error).message);}}}>{v.interested?'Retirar interesse':'Tenho interesse'}</button></div>
   {v.note&&<p>{v.note}</p>}<span className={`elig ${v.eligible?'ok':'no'}`}>{v.eligible?<><BadgeCheck size={15}/> Seu histórico atende às regras</>:<><XCircle size={15}/> Seu histórico ainda não atende às regras (você pode demonstrar interesse mesmo assim)</>}</span>
  </article>):<p className="empty">Nenhuma vaga aberta no momento.</p>}
 </section>;
}
