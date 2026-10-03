import {useEffect,useState} from 'react';
/** Preferências de exibição guardadas só neste navegador (não vão para o banco nem para a rede). */
export type UiPrefs={textSize:'normal'|'large'|'xlarge';contrast:'normal'|'high';motion:'normal'|'reduce';name:string;hideStructure:boolean};
const KEY='giro-ui-prefs',EVENT='giro-ui-prefs';
export const defaultPrefs:UiPrefs={textSize:'normal',contrast:'normal',motion:'normal',name:'',hideStructure:false};
export function loadPrefs():UiPrefs{try{return {...defaultPrefs,...JSON.parse(localStorage.getItem(KEY)??'{}')};}catch{return defaultPrefs;}}
export function applyPrefs(p=loadPrefs()){const root=document.documentElement;root.dataset.textSize=p.textSize;root.dataset.contrast=p.contrast;root.dataset.motion=p.motion;}
export function savePrefs(patch:Partial<UiPrefs>){const next={...loadPrefs(),...patch};try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* armazenamento indisponível: vale só nesta sessão */}applyPrefs(next);window.dispatchEvent(new CustomEvent(EVENT,{detail:next}));return next;}
export function usePrefs():[UiPrefs,(patch:Partial<UiPrefs>)=>void]{
 const [prefs,setPrefs]=useState(loadPrefs);
 useEffect(()=>{const listener=(e:Event)=>setPrefs((e as CustomEvent<UiPrefs>).detail??loadPrefs());window.addEventListener(EVENT,listener);return()=>window.removeEventListener(EVENT,listener);},[]);
 return [prefs,patch=>setPrefs(savePrefs(patch))];
}
export function greeting(date=new Date()){const h=date.getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';}
