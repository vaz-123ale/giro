import {getLang,setLang} from '../i18n';

/** Troca de idioma (Português / English). Fica no topo, na tela de entrar e nas Configurações. */
export function LangSwitch({big}:{big?:boolean}){
 const l=getLang();
 return <div className={`lang-switch${big?' big':''}`} role="group" aria-label="Idioma / Language" data-no-translate>
  <button className={l==='pt'?'on':''} aria-pressed={l==='pt'} onClick={()=>l!=='pt'&&setLang('pt')}>🇧🇷 PT</button>
  <button className={l==='en'?'on':''} aria-pressed={l==='en'} onClick={()=>l!=='en'&&setLang('en')}>🇺🇸 EN</button>
 </div>;
}
