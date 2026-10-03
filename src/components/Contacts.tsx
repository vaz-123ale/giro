import {AreaIcon} from './AreaIcon';
import {usePageSearch} from './PageSearch';
import {matches,searchDate} from '../domain/records';
import {useState} from 'react';
import type {State} from '../domain/models';
type Post=(path:string,input:unknown)=>Promise<boolean>;
export function ContactForm({post,busy,onSaved,defaultType}:{post:Post;busy:boolean;onSaved:()=>void;defaultType?:'supplier'}){
 const [error,setError]=useState('');
 return <form onSubmit={async e=>{e.preventDefault();setError('');const form=e.currentTarget;const f=new FormData(form);if(await post('contacts',{type:f.get('type')||undefined,name:f.get('name'),phone:f.get('phone')||undefined,note:f.get('note')||undefined})){form.reset();onSaved();}else setError('Não foi possível salvar a pessoa. Revise o nome e os dados; seus campos foram mantidos.');}}><label>Nome<input name="name" required maxLength={120}/></label><label>Tipo (opcional)<select name="type" defaultValue={defaultType??''}><option value="">Sem tipo</option><option value="supplier">Fornecedor</option><option value="collaborator">Colaborador</option><option value="other">Outro</option></select></label><label>Celular (opcional)<input name="phone" type="tel" maxLength={30}/></label><label>Observação (opcional)<textarea name="note" maxLength={500}/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>Salvar pessoa</button></form>;
}
export function Contacts({state,post,busy}:{state:State;post:Post;busy:boolean}){
 const query=usePageSearch();const [adding,setAdding]=useState(false);
 return <section className="panel"><div className="section-title"><h2><AreaIcon name="contatos"/>Fornecedores e contatos</h2><button className="primary" onClick={()=>setAdding(!adding)}>Adicionar pessoa</button></div>{adding&&<ContactForm post={post} busy={busy} onSaved={()=>setAdding(false)}/>}<p className="muted">Dados locais. Celular é opcional e não envia mensagens nesta fase.</p>{state.contacts?.length?state.contacts.filter(c=>matches(query,c.name,c.id,c.phone,c.note,c.type,searchDate(c.createdAt))).map(c=><article className="sale-detail" key={c.id}><h3>{c.name}</h3>{c.phone&&<p>{c.phone}</p>}{c.note&&<p>{c.note}</p>}<small>Identificador interno: {c.id}</small></article>):<p>Nenhuma pessoa cadastrada. Fornecedores de acordos antigos permanecem no histórico; não inventamos cadastro ou identidade para eles.</p>}</section>;
}
