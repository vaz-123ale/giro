import {useEffect,useState} from 'react';
import {Briefcase,MessageCircle,ShieldCheck} from 'lucide-react';
import {toast} from './toast';
import {RoleHeading,RoleEmpty} from './RoleUI';

/** "Busco trabalho": a pessoa da equipe se candidata com um resumo e um contato. */
export function BuscoTrabalho({job,onSaved}:{job:{note:string;contact:string;since:string}|null;onSaved:()=>void}){
 const [note,setNote]=useState(job?.note??'');const [contact,setContact]=useState(job?.contact??'');const [error,setError]=useState('');
 const save=async(seeking:boolean)=>{setError('');const r=await fetch('/api/eu/trabalho',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seeking,note,contact})});
  const v=await r.json();if(!r.ok){setError(v.error);return;}toast(seeking?'Candidatura publicada! Barracas e fornecedores já podem ver seu perfil.':'Você saiu da lista de quem busca trabalho.');onSaved();};
 return <section className="panel job-card"><RoleHeading icon={Briefcase}>Busco trabalho</RoleHeading>
  <p className="muted">Apareça para barracas e fornecedores que precisam de ajudante. Eles veem seu resumo, seu contato e o seu histórico de confiança no GIRO.</p>
  {job&&<p className="success">Você está na lista desde {job.since.split('-').reverse().join('/')}.</p>}
  <label>O que você procura e o que sabe fazer<textarea rows={3} maxLength={400} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex.: Ajudante de feira, sábados e domingos. Experiência com frutas e caixa."/></label>
  <label>Contato (WhatsApp)<input value={contact} onChange={e=>setContact(e.target.value)} maxLength={60} placeholder="(11) 90000-0000"/></label>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="form-actions"><button className="primary" onClick={()=>save(true)}>{job?'Atualizar candidatura':'Quero aparecer na lista'}</button>{job&&<button className="secondary" onClick={()=>save(false)}>Sair da lista</button>}</div>
 </section>;
}

/** Lista para a barraca e fornecedores: quem busca trabalho, com perfil de confiança e contato. */
export function QuemBuscaTrabalho(){
 const [list,setList]=useState<{name:string;roleLabel:string;slug:string;photo:string|null;note:string;contact:string;since:string}[]>();
 useEffect(()=>{fetch('/api/trabalho').then(r=>r.ok?r.json():[]).then(setList).catch(()=>setList([]));},[]);
 if(!list)return null;
 const zap=(c:string)=>c.replace(/\D/g,'');
 return <section className="panel"><RoleHeading icon={Briefcase}>Pessoas buscando trabalho</RoleHeading>
  <p className="muted">Ajudantes que se candidataram pelo GIRO. Veja o histórico de confiança antes de contratar.</p>
  {list.length?<div className="trust-people">{list.map(p=><article className="trust-person" key={p.slug}>
   <div className="trust-person-head">{p.photo?<img src={p.photo} alt="" className="initial" style={{objectFit:'cover'}}/>:<span className="initial" aria-hidden="true">{p.name.slice(0,1).toUpperCase()}</span>}<div><strong>{p.name}</strong><small>Buscando trabalho desde {p.since.split('-').reverse().join('/')}</small></div></div>
   <p>{p.note}</p>
   <div className="form-actions"><a className="secondary" href={`/p/${p.slug}`} target="_blank" rel="noopener"><ShieldCheck size={16} aria-hidden="true"/> Ver confiança</a>
    <a className="primary" href={`whatsapp://send?phone=55${zap(p.contact).replace(/^55/,'')}`} target="_blank" rel="noopener"><MessageCircle size={16} aria-hidden="true"/> Contatar</a></div>
  </article>)}</div>:<RoleEmpty icon={Briefcase}>Ninguém na lista ainda. Pessoas com conta de equipe ou de comprador podem se candidatar pela conta delas.</RoleEmpty>}
 </section>;
}
