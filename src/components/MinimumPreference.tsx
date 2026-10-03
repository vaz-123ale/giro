import {useEffect,useState} from 'react';
import {money} from '../domain/finance';
import {parseMoney} from '../domain/validation';
interface Props {value:number;busy:boolean;post:(path:string,input:unknown)=>Promise<boolean>;onError:(message:string)=>void}
export function MinimumPreference({value,busy,post,onError}:Props){
 const [amount,setAmount]=useState(String(value/100));const [saved,setSaved]=useState(false);
 useEffect(()=>{setAmount(String(value/100));},[value]);
 async function save(e:React.FormEvent){e.preventDefault();setSaved(false);try{if(await post('settings',{minimumWeeklyFree:parseMoney(amount)}))setSaved(true);}catch(e){onError((e as Error).message);}}
 return <form onSubmit={save}><label>Mínimo livre desejado por semana (R$)<input inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setSaved(false);}} required/></label><button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar mínimo desejado'}</button><p className={saved?'success':'muted'} role={saved?'status':undefined}>{saved?'Mínimo salvo. ':''}Valor registrado: {money(value)} por semana.</p></form>;
}