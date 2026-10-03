import {AreaIcon} from './AreaIcon';
import {useState} from 'react';
import type {State} from '../domain/models';
import {MinimumPreference} from './MinimumPreference';
import {usePrefs} from './uiPrefs';
interface Props {state:State;busy:boolean;post:(path:string,input:unknown)=>Promise<boolean>;onError:(message:string)=>void}
function NamePreference(){
 const [prefs,update]=usePrefs();const [name,setName]=useState(prefs.name);const [saved,setSaved]=useState(false);
 return <section className="panel"><h2><AreaIcon name="contatos"/>Como devemos chamar você?</h2><p className="muted">Usado só na saudação do Início. Fica guardado neste navegador.</p><form className="name-form" onSubmit={e=>{e.preventDefault();update({name:name.trim()});setSaved(true);}}><label>Seu nome (opcional)<input value={name} maxLength={40} autoComplete="given-name" onChange={e=>{setName(e.target.value);setSaved(false);}} aria-describedby="name-status"/></label><div className="form-actions"><button className="primary">Salvar nome</button>{prefs.name&&<button className="secondary" type="button" onClick={()=>{setName('');update({name:''});setSaved(true);}}>Remover nome</button>}</div><p id="name-status" className="muted" role="status">{saved?(prefs.name?`Saudação atualizada: olá, ${prefs.name}!`:'Nome removido da saudação.'):''}</p></form></section>;
}
export function Preferences({state,busy,post,onError}:Props){return <><NamePreference/><section className="panel"><h2><AreaIcon name="preferencias"/>Preferências financeiras</h2><p className="muted">O mínimo semanal orienta sugestões; não reserva dinheiro nem altera acordos.</p><MinimumPreference value={state.settings?.minimumWeeklyFree??0} busy={busy} post={post} onError={onError}/><p className="note">Dados guardados neste computador. Pagamentos digitais e aceites são simulações locais.</p></section></>;}
