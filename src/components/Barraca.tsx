import {useEffect,useState} from 'react';
import {Printer,QrCode,Store} from 'lucide-react';
import {invitationQR} from '../domain/qr';
import {LangSwitch} from './LangSwitch';
import {money} from '../domain/finance';
import {parseMoney} from '../domain/validation';

/**
 * QR fixo da barraca: um só QR impresso na banca. O comprador aponta a câmera, digita o valor e paga.
 * A cobrança criada é igual às outras: as regras de divisão (fornecedores, comissões) valem do mesmo jeito.
 */
interface Info {name:string;photo:string|null;maxCents:number;chain:string|null}
const stallUrl=()=>`${location.origin}/barraca`;

function BigQR({url,label}:{url:string;label:string}){
 let m:boolean[][];try{m=invitationQR(url);}catch{return <p className="note">Endereço longo demais para o QR.</p>;}
 return <svg className="stall-qr" viewBox="0 0 45 45" role="img" aria-label={label}><rect width="45" height="45" fill="white"/>{m.flatMap((row,y)=>row.map((on,x)=>on?<rect key={`${x}-${y}`} x={x+4} y={y+4} width="1" height="1" fill="#064c3c"/>:null))}</svg>;
}

/** Página que o comprador abre ao ler o QR da barraca. */
export function BarracaPage(){
 const [info,setInfo]=useState<Info>();const [valor,setValor]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{fetch('/api/barraca').then(r=>r.json()).then(setInfo).catch(()=>setError('Não foi possível abrir esta barraca.'));},[]);
 let cents=0;try{cents=parseMoney(valor);}catch{cents=0;}
 const pagar=async()=>{setBusy(true);setError('');try{
  const r=await fetch('/api/barraca/venda',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:cents})});const v=await r.json();if(!r.ok)throw Error(v.error);
  location.href=`/pagar/${v.token}`;
 }catch(e){setError((e as Error).message);setBusy(false);}};
 return <main className="stall-page">
  <div className="stall-lang"><LangSwitch/></div><header className="stall-hero">
   {info?.photo?<img className="stall-photo" src={info.photo} alt=""/>:<span className="stall-photo stall-photo-empty"><Store size={34} aria-hidden="true"/></span>}
   <div><small>Pagando para</small><h1>{info?.name??'Carregando…'}</h1></div>
  </header>
  <section className="stall-card">
   <label htmlFor="valor">Quanto você vai pagar?</label>
   <div className="stall-amount"><span>R$</span><input id="valor" inputMode="decimal" autoFocus placeholder="0,00" value={valor} onChange={e=>setValor(e.target.value.replace(/[^\d,.]/g,''))}/></div>
   <div className="stall-chips">{[5,10,20,50].map(v=><button key={v} type="button" className="secondary" onClick={()=>setValor(`${v},00`)}>R$ {v}</button>)}</div>
   {error&&<p className="error" role="alert">{error}</p>}
   <button className="primary big-action" disabled={busy||cents<50} onClick={pagar}>{busy?'Preparando…':cents>=50?`Pagar ${money(cents)}`:'Digite o valor'}</button>
   <p className="muted stall-note">{info?.chain==='mainnet'?'Pagamento em reais digitais (stablecoin) pela sua carteira.':info?.chain?'Rede de teste: o pagamento usa token de teste, sem valor real.':'Demonstração: o pagamento é simulado, sem transferência real.'} O valor é dividido automaticamente conforme os acordos da barraca.</p>
  </section>
  <footer className="stall-foot"><img src="/logo_giro.png" alt="GIRO"/><span>Pagamento organizado pelo GIRO</span></footer>
 </main>;
}

/** Cartão do QR da barraca, para a feirante imprimir e deixar na banca. */
export function BarracaQRCard(){
 const url=stallUrl();const [name,setName]=useState<string|null>(null);
 useEffect(()=>{fetch('/api/barraca').then(r=>r.json()).then((v:Info)=>setName(v.name)).catch(()=>{});},[]);
 return <section className="panel stall-qr-card">
  <div className="stall-qr-head"><QrCode size={22} aria-hidden="true"/><div><h2>QR fixo da barraca</h2><p className="muted">Imprima uma vez e deixe na banca. O cliente aponta a câmera, digita o valor e paga, sem você gerar código a cada venda. As regras de divisão continuam valendo.</p></div></div>
  <div className="stall-print" id="stall-print">
   <img src="/logo_giro.png" alt="GIRO" className="stall-print-logo"/>
   <BigQR url={url} label="QR para pagar nesta barraca"/>
   <strong>{name??'Minha barraca'}</strong><span>Aponte a câmera e pague aqui</span>
  </div>
  <div className="form-actions"><button className="primary" onClick={()=>window.print()}><Printer size={18} aria-hidden="true"/> Imprimir QR</button><a className="secondary" href="/barraca" target="_blank" rel="noopener">Ver como o cliente vê</a></div>
 </section>;
}
