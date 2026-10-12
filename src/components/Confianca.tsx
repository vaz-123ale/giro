import {useEffect,useState} from 'react';
import {BadgeCheck,CalendarCheck,CheckCircle2,Clock3,ShieldCheck} from 'lucide-react';
import {money} from '../domain/finance';

/** Cartão "GIRO Confiança": o histórico de compromissos cumpridos, em destaque (o maior valor do GIRO). */
export interface TrustStats {total:number;active:number;completed:number;onTime:number;settled:number}
export interface TrustRow {id:string;original:number;paid:number;remaining:number;due:string;situation:string;onTime:boolean|null;with?:string;chain:{registered:boolean;attested:boolean}|null}

export function ConfiancaCard({name,stats,rows=[],attested=0,compact,anon}:{name:string;stats:TrustStats;rows?:TrustRow[];attested?:number;compact?:boolean;anon?:boolean}){
 const pct=(n:number)=>stats.total?Math.round(n/stats.total*100):0;
 const tiles=[
  {icon:<CalendarCheck size={22} aria-hidden="true"/>,label:'Cumpridos no prazo',value:String(stats.onTime),bar:pct(stats.onTime),tone:'green'},
  {icon:<CheckCircle2 size={22} aria-hidden="true"/>,label:'Concluídos',value:String(stats.completed),bar:pct(stats.completed),tone:'gold'},
  {icon:<Clock3 size={22} aria-hidden="true"/>,label:'Ativos',value:String(stats.active),bar:pct(stats.active),tone:'blue'},
  {icon:<BadgeCheck size={22} aria-hidden="true"/>,label:'Total quitado',value:money(stats.settled),bar:100,tone:'gray'},
 ];
 const recent=[...rows].sort((a,b)=>b.due.localeCompare(a.due)).slice(0,5);
 return <section className={`confianca-card${compact?' compact':''}`} aria-label={`GIRO Confiança de ${name}`}>
  <header className="confianca-head">
   <img src="/logo_giro.png" alt="" className="confianca-logo"/>
   <div><h2 data-no-translate>GIRO <span>Confiança</span></h2><p>Histórico verificável de acordos de {name}</p></div>
   <span className="confianca-seal" aria-hidden="true"><ShieldCheck size={30}/></span>
  </header>
  <div className="confianca-tiles">{tiles.map(t=><div key={t.label} className={`confianca-tile tone-${t.tone}`}><span className="tile-icon">{t.icon}</span><small>{t.label}</small><strong>{t.value}</strong><i style={{width:`${Math.max(6,t.bar)}%`}}/></div>)}</div>
  {!compact&&recent.length>0&&<ol className="confianca-timeline">{recent.map(r=><li key={r.id} className={r.remaining===0?'done':''}>
   <span className="dot" aria-hidden="true">{r.remaining===0?'✓':''}</span>
   <strong>{anon?`Acordo ${r.id.slice(-3)}`:r.with??r.id}</strong><small>{money(r.paid)} de {money(r.original)} · {r.situation}{r.onTime===true?' · no prazo':''}</small>
   {r.chain?.attested?<em>atestado na Solana ✓</em>:r.chain?.registered?<em>registrado na rede ✓</em>:null}
  </li>)}</ol>}
  <footer className="confianca-foot"><CheckCircle2 size={18} aria-hidden="true"/> Cada acordo vira um registro confirmado pelos dois lados.{attested>0&&<> {attested} com prova na Solana.</>}<b>Mais confiança, mais oportunidades.</b></footer>
 </section>;
}

/** GIRO Confiança do negócio (busca o perfil do negócio; serve para a dona e para quem tem login). */
export function NegocioConfianca({compact,anon}:{compact?:boolean;anon?:boolean}){
 const [p,setP]=useState<{name:string;stats:TrustStats;trust:{attested:number};agreements:TrustRow[]}>();
 useEffect(()=>{(async()=>{try{const list=await (await fetch('/api/perfis')).json() as {slug:string;role:string}[];const b=list.find(x=>x.role==='dona');if(!b)return;
  const r=await fetch(`/api/perfis/${b.slug}`);if(r.ok)setP(await r.json());}catch{/* sem perfil */}})();},[]);
 if(!p)return null;
 return <ConfiancaCard name={p.name} stats={p.stats} rows={p.agreements} attested={p.trust.attested} compact={compact} anon={anon}/>;
}
