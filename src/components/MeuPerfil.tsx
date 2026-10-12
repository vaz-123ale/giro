import {useCallback,useEffect,useState} from 'react';
import {Camera,Copy,ExternalLink,LogOut,MessageCircle} from 'lucide-react';
import {toast} from './toast';
import {PERFIL_EVENT} from './ProfileMenu';

/** "Meu perfil" da barraca: foto, nome e perfil público para compartilhar, tudo no topo. */
async function resizePhoto(file:File){
 const img=await createImageBitmap(file);const size=256;const c=document.createElement('canvas');c.width=size;c.height=size;
 const s=Math.min(img.width,img.height);c.getContext('2d')!.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,size,size);
 return c.toDataURL('image/jpeg',0.85);
}
export function MeuPerfil(){
 const [b,setB]=useState<{name:string|null;slug:string}>();const [nome,setNome]=useState('');const [v,setV]=useState(0);const [error,setError]=useState('');const [temFoto,setTemFoto]=useState(true);
 const load=useCallback(()=>fetch('/api/pessoas').then(r=>r.json()).then(d=>{setB(d.business);setNome(d.business?.name??'');}).catch(()=>{}),[]);
 useEffect(()=>{void load();},[load]);
 if(!b)return null;
 const salvar=async(body:unknown,msg:string)=>{setError('');const r=await fetch('/api/negocio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok){setError((await r.json()).error??'Não foi possível salvar.');return;}toast(msg);setV(x=>x+1);setTemFoto(true);await load();window.dispatchEvent(new Event(PERFIL_EVENT));};
 const link=`${location.origin}/p/${b.slug}`;
 return <section className="panel my-profile-panel">
  <h2>Meu perfil</h2>
  <div className="my-profile">
   {temFoto?<img className="avatar" src={`/api/publico/${b.slug}/foto?v=${v}`} alt="Foto da barraca" onError={()=>setTemFoto(false)}/>:<span className="avatar-fallback" aria-hidden="true">{(b.name??'B').slice(0,1).toUpperCase()}</span>}
   <div style={{flex:1,minWidth:240}}>
    <form onSubmit={e=>{e.preventDefault();void salvar({name:nome},'Nome da barraca salvo!');}} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',margin:0}}>
     <label style={{flex:1,minWidth:200}}>Nome da barraca<input value={nome} onChange={e=>setNome(e.target.value)} maxLength={120} placeholder="Ex.: Banca da Maria"/></label>
     <button className="primary">Salvar nome</button></form>
    <div className="form-actions" style={{marginTop:12}}>
     <label className="secondary photo-button"><Camera size={18} aria-hidden="true"/> Trocar foto<input type="file" accept="image/*" hidden onChange={async e=>{const f=e.target.files?.[0];if(f)await salvar({photo:await resizePhoto(f)},'Foto atualizada!');}}/></label>
     <a className="primary" href={`/p/${b.slug}`} target="_blank" rel="noopener"><ExternalLink size={16} aria-hidden="true"/> Ver meu perfil público</a>
     <button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(link);toast('Link do perfil copiado!');}catch{toast(link);}}}><Copy size={16} aria-hidden="true"/> Copiar link</button>
     <button className="secondary" onClick={()=>{location.href=`whatsapp://send?text=${encodeURIComponent('Conheça meu histórico no GIRO: '+link)}`;}}><MessageCircle size={16} aria-hidden="true"/> WhatsApp</button>
     <button className="secondary" onClick={async()=>{await fetch('/api/sair',{method:'POST'});location.replace('/entrar');}}><LogOut size={16} aria-hidden="true"/> Sair</button>
    </div>
    {error&&<p className="error" role="alert">{error}</p>}
   </div>
  </div>
 </section>;
}
