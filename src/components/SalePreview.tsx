import {useEffect,useState} from 'react';
import type {State} from '../domain/models';
import {money} from '../domain/finance';
import {parseMoney} from '../domain/validation';
interface Part {kind:'commission'|'commitment'|'reserve'|'free';recipient:string;amount:number}
interface Preview {amount:number;parts:Part[];basis?:string;conflict?:string}
const labels:Record<Part['kind'],string>={commitment:'Acordo',commission:'Equipe no turno',reserve:'Reserva automática',free:'Fica com você'};
/**
 * Mostra, antes de vender, como uma venda seria dividida pelas regras de hoje.
 * Usa o mesmo motor da venda real no servidor, numa cópia dos dados: nada é registrado.
 */
export function SalePreview({state}:{state:State}){
 const [text,setText]=useState('100,00');const [preview,setPreview]=useState<Preview>();const [error,setError]=useState('');
 const signature=JSON.stringify([state.commitments.map(c=>[c.id,c.status,c.paid,c.rateBps]),state.members.map(m=>[m.id,m.active]),state.plans.map(p=>[p.id,p.amount,p.mode,p.rateBps,p.status])]);
 useEffect(()=>{let amount:number;try{amount=parseMoney(text);}catch{setPreview(undefined);return;}const timer=setTimeout(()=>{fetch('/api/sales/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setPreview(d);setError('');}).catch(e=>setError(e.message));},300);return()=>clearTimeout(timer);},[text,signature]);
 const pct=(v:number)=>preview?.amount?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(v/preview.amount*100)+'%':'0%';
 return <section className="panel sale-preview" aria-labelledby="sale-preview-title"><div className="section-title"><div><h2 id="sale-preview-title">Para onde vai cada venda</h2><p className="muted">Pelas regras de hoje: acordos aceitos, equipe em turno e reservas automáticas. Simulação — nada é registrado.</p></div><label className="preview-amount">Se eu vender (R$)<input inputMode="decimal" value={text} onChange={e=>setText(e.target.value)}/></label></div>
  {error&&<p className="error" role="alert">{error}</p>}{preview?.conflict&&<p className="note" role="status">{preview.conflict}</p>}
  {preview&&!preview.conflict&&<><div className="split-bar" aria-hidden="true">{preview.parts.filter(p=>p.amount>0).map((p,i)=><span key={i} className={`split-${p.kind}`} style={{flexGrow:p.amount}} title={`${p.recipient}: ${money(p.amount)}`}/>)}</div>
  <ul className="split-list" aria-live="polite">{preview.parts.map((p,i)=><li key={i}><i className={`split-dot split-${p.kind}`} aria-hidden="true"/><span><strong>{p.recipient}</strong><small>{labels[p.kind]}</small></span><b>{money(p.amount)}</b><span className="split-pct">{pct(p.amount)}</span></li>)}</ul>
  {preview.parts.some(p=>p.kind==='commitment')&&<p className="muted">Acordos param de receber quando a dívida é quitada: o GIRO nunca destina mais do que falta.</p>}</>}
 </section>;
}
