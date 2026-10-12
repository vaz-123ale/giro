import {EN,EN_PATTERNS} from './en';
import {EN2} from './en2';
import {EN3} from './en3';

/**
 * Idioma do site (pt ou en), guardado no navegador. Em inglês, os textos da tela são trocados na hora
 * por um tradutor que observa a página; "GIRO" e "GIRO Confiança" ficam em português.
 */
export type Lang='pt'|'en';
export function getLang():Lang{try{const q=new URLSearchParams(location.search).get('lang');if(q==='en'||q==='pt')localStorage.setItem('giro-lang',q);return localStorage.getItem('giro-lang')==='en'?'en':'pt';}catch{return new URLSearchParams(typeof location!=='undefined'?location.search:'').get('lang')==='en'?'en':'pt';}}
export function setLang(l:Lang){try{localStorage.setItem('giro-lang',l);}catch{/* sem storage */}const u=new URL(location.href);u.searchParams.set('lang',l);location.replace(u.toString());}

const DICT:Record<string,string>={...EN3,...EN2,...EN};
const norm=(s:string)=>s.replace(/\s+/g,' ').trim();
const KEYS=Object.keys(DICT).map(norm);const MAP=new Map(Object.entries(DICT).map(([k,v])=>[norm(k),v]));
// trechos (≥ 2 palavras) para textos que vêm montados com valores no meio
const FRAG=KEYS.filter(k=>k.split(' ').length>=3&&k.length>=14).sort((a,b)=>b.length-a.length);
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const FRAG_RE=FRAG.length?new RegExp('(?<![\\wÀ-ú])('+FRAG.map(esc).join('|')+')(?![\\wÀ-ú])','g'):null;

export function translate(text:string):string{
 const t=norm(text);if(!t||!/[A-Za-zÀ-ú]/.test(t))return text;
 const exact=MAP.get(t);if(exact!==undefined)return keepSpaces(text,exact);
 for(const [re,to] of EN_PATTERNS){if(re.test(t))return keepSpaces(text,typeof to==='string'?t.replace(re,to):t.replace(re,to as (...m:string[])=>string));}
 // frase com prefixo/sufixo (ex.: "Até 19/10/2026", "Restante: R$ 466,00")
 const m=t.match(/^(.*?)([:·]\s*)?([\d/.,R$\s%-]+)$/);if(m&&MAP.has(norm(m[1])))return keepSpaces(text,MAP.get(norm(m[1]))+(m[2]??' ')+m[3].trim());
 if(t.includes('·')&&t.length>3){const parts=t.split(/\s*·\s*/);const tp=parts.map(x=>translate(x));if(tp.some((x,i)=>x!==parts[i]))return keepSpaces(text,tp.join(' · '));}
 if(t.includes(': ')){const i=t.indexOf(': ');const a=t.slice(0,i),b=t.slice(i+2);const ta=MAP.get(a)??MAP.get(a+':')?.replace(/:$/,'');if(ta)return keepSpaces(text,ta+': '+translate(b));}
 if(FRAG_RE){const r=t.replace(FRAG_RE,f=>MAP.get(f)??f);if(r!==t)return keepSpaces(text,r);}
 return text;
}
const keepSpaces=(orig:string,tr:string)=>(orig.match(/^\s*/)![0])+tr+(orig.match(/\s*$/)![0]);

const ATTRS=['placeholder','aria-label','title','alt'];
const done=new WeakMap<Node,string>();
function walk(root:Node){
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
 for(let n:Node|null=root;n;n=w.nextNode()){
  if(n.nodeType===3){const p=n.parentElement;if(!p||p.closest('script,style,code,textarea,[data-no-translate]'))continue;
   const v=n.nodeValue??'';if(done.get(n)===v)continue;const tr=translate(v);if(tr!==v)n.nodeValue=tr;done.set(n,n.nodeValue??'');}
  else if(n.nodeType===1){const el=n as Element;
   // frase montada em vários pedaços de texto (ex.: "Mostrando " + 3 + " de " + 3): traduz o conjunto
   const kids=Array.from(el.childNodes);if(kids.length>1&&!el.closest('script,style,code,textarea,[data-no-translate]')&&kids.every(k=>k.nodeType===3)){
    const joined=kids.map(k=>k.nodeValue??'').join('');const tr=translate(joined);
    if(tr!==joined){(kids[0] as Text).nodeValue=tr;for(let i=1;i<kids.length;i++)(kids[i] as Text).nodeValue='';for(const k of kids)done.set(k,k.nodeValue??'');}}for(const a of ATTRS){const v=el.getAttribute(a);if(v){const tr=translate(v);if(tr!==v)el.setAttribute(a,tr);}}
   if(el instanceof HTMLInputElement&&(el.type==='button'||el.type==='submit')&&el.value){const tr=translate(el.value);if(tr!==el.value)el.value=tr;}}
 }
}
/** Liga o tradutor quando o idioma é inglês (chamado uma vez ao abrir o site). */
export function startI18n(){
 if(getLang()!=='en')return;
 document.documentElement.lang='en';
 const run=()=>{walk(document.body);const t=translate(document.title);if(t!==document.title)document.title=t;};run();
 setInterval(()=>{const t=translate(document.title);if(t!==document.title)document.title=t;},1500);
 new MutationObserver(ms=>{for(const m of ms){if(m.type==='childList')m.addedNodes.forEach(n=>walk(n.nodeType===3?n.parentNode??n:n));else walk(m.target.nodeType===3?(m.target.parentNode??m.target):m.target);}})
  .observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
 const nativeAlert=window.alert.bind(window),nativeConfirm=window.confirm.bind(window);
 window.alert=(m?:unknown)=>nativeAlert(translate(String(m??'')));window.confirm=(m?:string)=>nativeConfirm(translate(String(m??'')));
}
