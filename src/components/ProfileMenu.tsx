import {useCallback,useEffect,useRef,useState} from 'react';
import {ChevronDown,ExternalLink,LogOut,UserPen} from 'lucide-react';

/** Botão "Meu perfil" do topo: mostra a foto da barraca e abre um menu com "Alterar perfil". */
export const PERFIL_EVENT='giro-perfil-atualizado';
export function ProfileMenu({onEdit}:{onEdit:()=>void}){
 const [b,setB]=useState<{name:string|null;slug:string}>();const [v,setV]=useState(0);const [foto,setFoto]=useState(true);const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 const load=useCallback(()=>{fetch('/api/pessoas').then(r=>r.ok?r.json():null).then(d=>{if(d?.business)setB(d.business);}).catch(()=>{});setV(x=>x+1);setFoto(true);},[]);
 useEffect(()=>{load();window.addEventListener(PERFIL_EVENT,load);return()=>window.removeEventListener(PERFIL_EVENT,load);},[load]);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[open]);
 const nome=b?.name??'Minha barraca';const inicial=nome.slice(0,1).toUpperCase();
 const img=(cls:string)=>b&&foto?<img className={cls} src={`/api/publico/${b.slug}/foto?v=${v}`} alt="" onError={()=>setFoto(false)}/>:null;
 return <div className="profile-menu-wrap" ref={ref}>
  <button className="profile-button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}>
   {img('profile-photo')??<span className="profile-avatar" aria-hidden="true">{inicial}</span>}<span>Meu perfil</span><ChevronDown size={17}/></button>
  {open&&<div className="profile-menu" role="menu">
   <div className="profile-menu-head">{img('')??<span className="pm-initial" aria-hidden="true">{inicial}</span>}<div><strong>{nome}</strong><small>Conta da barraca</small></div></div>
   <button className="primary" role="menuitem" onClick={()=>{setOpen(false);onEdit();}}><UserPen size={18} aria-hidden="true"/> Alterar perfil</button>
   {b&&<a className="secondary" role="menuitem" href={`/p/${b.slug}`} target="_blank" rel="noopener"><ExternalLink size={16} aria-hidden="true"/> Ver perfil público</a>}
   <button className="secondary" role="menuitem" onClick={async()=>{await fetch('/api/sair',{method:'POST'});location.replace('/entrar');}}><LogOut size={16} aria-hidden="true"/> Sair</button>
  </div>}
 </div>;
}
