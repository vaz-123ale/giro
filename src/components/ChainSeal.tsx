import {useEffect,useState} from 'react';

/**
 * Selo discreto do registro na rede (regra 14: sem jargão). Só aparece com a rede ligada.
 * Uma única consulta compartilhada; com a rede desligada a consulta para na primeira resposta.
 */
export interface ChainStatus {enabled:boolean;cluster?:string;available?:boolean;items?:Record<string,{state:string;attested:boolean}>}
let cache:ChainStatus|undefined;let timer:number|undefined;const listeners=new Set<(s:ChainStatus)=>void>();
async function load(){
 try{const r=await fetch('/api/chain/status');if(!r.ok)return;cache=await r.json() as ChainStatus;for(const l of listeners)l(cache);
  if(!cache.enabled&&timer!==undefined){window.clearInterval(timer);timer=undefined;}}catch{/* rede é opcional: sem status, sem selo */}
}
export function useChainStatus(){
 const [status,setStatus]=useState(cache);
 useEffect(()=>{listeners.add(setStatus);if(timer===undefined&&cache?.enabled!==false){void load();timer=window.setInterval(load,5000);}
  return()=>{listeners.delete(setStatus);if(!listeners.size&&timer!==undefined){window.clearInterval(timer);timer=undefined;}};},[]);
 return status;
}
const labels:Record<string,[string,string]>={
 registrado:['Registrado ✓','Acordo registrado na rede local de teste, com as duas partes.'],
 pendente:['Registrando…','Aguardando a rede local confirmar.'],
 'aguardando-confirmacao':['Aguardando confirmação','Pagamento em dinheiro aguardando a confirmação de quem recebeu.'],
 divergente:['Registro a conferir','O registro na rede está diferente do GIRO.'],
 falhou:['Registro a conferir','A rede recusou um registro deste acordo.'],
};
export function ChainSeal({commitmentId}:{commitmentId:string}){
 const status=useChainStatus();const item=status?.enabled?status.items?.[commitmentId]:undefined;
 if(!item||!labels[item.state])return null;const [text,title]=labels[item.state];
 return <span className={`chain-seal chain-${item.state}`} title={title+(item.attested?' Comprovante atestado.':'')}>{text}{item.attested?' · comprovante atestado':''}</span>;
}

/** Página "Carteira e assinaturas" quando a rede pública não está ligada. */
export function ChainWalletOff(){
 const status=useChainStatus();if(status?.enabled&&(status.cluster==='devnet'||status.cluster==='mainnet'))return null;
 return <section className="panel"><h2>Carteira e assinaturas</h2><p className="muted">A carteira do negócio só é usada quando o GIRO está ligado a uma rede Solana pública (Devnet ou mainnet). {status?.enabled?`Agora: rede ${status.cluster}, com carteiras de teste deste computador.`:'Agora a rede está desligada.'}</p></section>;
}
