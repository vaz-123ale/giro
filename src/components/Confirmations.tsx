import {ChainWallet} from './ChainWallet';
import {useEffect,useState,type ReactNode} from 'react';
import type {State} from '../domain/models';
import {money} from '../domain/finance';
import {brDate} from './display';
type Post=(path:string,input:unknown)=>Promise<boolean>;

/** Link local (este computador): abrir em nova aba como a outra pessoa ou copiar. */
export function LocalLink({url,label}:{url:string;label:string}){
 const [message,setMessage]=useState('');
 return <span className="local-link"><a className="secondary" href={url} target="_blank" rel="noopener">{label}</a><button className="text-button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setMessage('Link copiado.');}catch{setMessage(url);}}}>Copiar link</button><span role="status" className="muted">{message}</span></span>;
}
const receiptLabel={waiting:'Aguardando confirmação de quem recebeu',confirmed:'Confirmado pelas duas partes',disputed:'Quem recebeu informou que NÃO recebeu'};
export function ReceiptRequest({state,paymentId,recipient,busy,post}:{state:State;paymentId:string;recipient:string;busy:boolean;post:Post}){
 const r=state.receiptConfirmations?.find(r=>r.paymentId===paymentId);
 if(!r)return <button className="text-button receipt-ask" disabled={busy} onClick={()=>post('receipts/request',{paymentId})}>Pedir confirmação a {recipient}</button>;
 return <span className={`receipt-state receipt-${r.state}`}><b>{receiptLabel[r.state]}</b>{r.state==='waiting'&&<LocalLink url={`${location.origin}/confirmar/${r.token}`} label={`Abrir como ${recipient}`}/>}</span>;
}
async function call<T>(path:string,body?:unknown):Promise<T>{const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
function Standalone({eyebrow,children}:{eyebrow:string;children:ReactNode}){return <main className="standalone confirm-page"><img className="logo" src="/logo_giro.png" alt="GIRO"/><section className="panel"><p className="eyebrow">{eyebrow}</p>{children}<p className="muted">Confirmação local simulada neste computador: não há login nem assinatura digital.</p></section></main>;}

interface ReceiptView {recipient:string;amount:number;paidAt:string;state:'waiting'|'confirmed'|'disputed';decidedAt?:string;kind:'supplier'|'commission'}
export function ReceiptConfirmPage({token}:{token:string}){
 const [view,setView]=useState<ReceiptView>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{call<ReceiptView>(`/api/receipts/${encodeURIComponent(token)}`).then(setView).catch(e=>setError(e.message));},[token]);
 const decide=async(decision:'confirm'|'dispute')=>{setBusy(true);setError('');try{setView(await call<ReceiptView>('/api/receipts/decision',{token,decision}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <Standalone eyebrow={`CONFIRMAÇÃO DE RECEBIMENTO · ${view?.recipient??''}`}>{error&&<p className="error" role="alert">{error}</p>}{view&&<><h1>Você recebeu {money(view.amount)} em dinheiro?</h1><p>O vendedor registrou que entregou <b>{money(view.amount)}</b> a <b>{view.recipient}</b> em {brDate(view.paidAt)}{view.kind==='commission'?' (comissão)':''}.</p>
  {view.state==='waiting'?<><p>Sua confirmação deixa este pagamento verificado pelas duas partes no histórico de confiança. Se não recebeu, avise: o vendedor será notificado.</p><div className="form-actions"><button className="primary" disabled={busy} onClick={()=>decide('confirm')}>Sim, recebi {money(view.amount)}</button><button className="secondary" disabled={busy} onClick={()=>decide('dispute')}>Não recebi</button></div></>
  :<p className="success" role="status">{view.state==='confirmed'?'Recebimento confirmado. Obrigado!':'Registrado: você informou que não recebeu. O vendedor foi avisado.'}</p>}</>}<ChainWallet token={token}/></Standalone>;
}
interface CheckinView {name:string;active:boolean;pending:{type:'start'|'end';at:string}|null}
export function CheckinPage({token}:{token:string}){
 const [view,setView]=useState<CheckinView>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const load=()=>call<CheckinView>(`/api/checkin/${encodeURIComponent(token)}`).then(setView).catch(e=>setError(e.message));
 useEffect(()=>{load();const t=setInterval(load,5000);return()=>clearInterval(t);},[token]);
 const ask=async(type:'start'|'end')=>{setBusy(true);setError('');try{setView(await call<CheckinView>('/api/checkin/request',{token,type}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <Standalone eyebrow={`MEU TURNO · ${view?.name??''}`}>{error&&<p className="error" role="alert">{error}</p>}{view&&<><h1>{view.active?'Seu turno está ativo':'Você está fora do turno'}</h1>
  {view.pending?<p className="note" role="status">Pedido para {view.pending.type==='start'?'iniciar':'encerrar'} o turno enviado às {new Date(view.pending.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}. Aguardando o vendedor confirmar.</p>
  :<><p>{view.active?'Ao encerrar, suas comissões deixam de valer para as próximas vendas.':'Ao iniciar, suas comissões passam a valer para as vendas deste turno, depois que o vendedor confirmar.'}</p><button className="primary big-action" disabled={busy} onClick={()=>ask(view.active?'end':'start')}>{view.active?'Encerrar meu turno':'Iniciar meu turno'}</button></>}</>}<ChainWallet token={token}/></Standalone>;
}
