import {useEffect,useState} from 'react';
import {Download,FileCheck2,Printer} from 'lucide-react';
import type {State} from '../domain/models';
import {money} from '../domain/finance';
import {completedAgreements,completionRecord,fingerprint,shortCode,trustReport,verifyReport,type VerifyResult} from '../domain/proof';
import {brDate} from './display';
import {ChainSeal,useChainStatus} from './ChainSeal';

/** Comprovantes de conclusão + histórico que o vendedor leva para um novo fornecedor (arquivo local, sem página pública). */
export function TrustShare({state}:{state:State}){
 const agreements=completedAgreements(state);const [codes,setCodes]=useState<Record<string,string>>({});const [anonymize,setAnonymize]=useState(false);const [verify,setVerify]=useState<VerifyResult>();const chain=useChainStatus();const [onChain,setOnChain]=useState<{agreement:string;attested:boolean}[]>();const [busy,setBusy]=useState(false);
 const key=agreements.map(c=>c.id+c.paid).join()+(state.receiptConfirmations??[]).map(r=>r.state).join();
 useEffect(()=>{let live=true;Promise.all(agreements.map(async c=>[c.id,shortCode(await fingerprint(completionRecord(state,c)))] as const)).then(rows=>{if(live)setCodes(Object.fromEntries(rows));});return()=>{live=false;};},[key]);
 const confirmed=(state.receiptConfirmations??[]).filter(r=>r.state==='confirmed').length,cash=(state.cashPayments??[]).length;
 const download=async()=>{setBusy(true);try{const report=await trustReport(state,anonymize);const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`giro-historico-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);}finally{setBusy(false);}};
 return <section className="panel trust-share" aria-labelledby="trust-share-title"><h2 id="trust-share-title"><FileCheck2 aria-hidden="true" size={24}/> Comprovantes e histórico para mostrar</h2>
  <p className="muted">Cada acordo concluído gera um código de comprovante (impressão digital do registro). Leve o arquivo do histórico a um novo fornecedor: ele confere aqui mesmo, em “Verificar histórico recebido”, se nada foi alterado.</p>
  <div className="trust-facts"><div><span>Acordos concluídos</span><strong>{agreements.length}</strong></div><div><span>Pagamentos em dinheiro confirmados pelas duas partes</span><strong>{confirmed} de {cash}</strong></div></div>
  {agreements.length?<ul className="proof-list">{agreements.map(c=>{const r=completionRecord(state,c);return <li key={c.id}><span><strong>{c.supplier}</strong><small>{money(c.original)} · concluído em {brDate(c.completedAt)} · {r.onTime?'no prazo':'após o prazo'}</small><ChainSeal commitmentId={c.id}/></span><code aria-label={`Código do comprovante ${codes[c.id]??''}`}>{codes[c.id]??'…'}</code></li>;})}</ul>:<p className="empty">Ainda não há acordo concluído. O primeiro comprovante aparece aqui quando um acordo for quitado.</p>}
  <div className="form-actions"><label className="check"><input type="checkbox" checked={anonymize} onChange={e=>setAnonymize(e.target.checked)}/>Ocultar nomes dos parceiros no arquivo</label></div>
  <div className="form-actions"><button className="primary" disabled={busy||!agreements.length} onClick={download}><Download size={19} aria-hidden="true"/>Baixar meu histórico</button><button className="secondary" onClick={()=>window.print()}><Printer size={19} aria-hidden="true"/>Imprimir / salvar PDF</button></div>
  <details className="verify-box"><summary>Verificar histórico recebido</summary><label>Arquivo de histórico GIRO (.json)<input type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setOnChain(undefined);try{const data=JSON.parse(await file.text());setVerify(await verifyReport(data));if(chain?.enabled){const r=await fetch('/api/chain/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(r.ok)setOnChain(await r.json());}}catch{setVerify({valid:false,summaryMatches:false,items:[],error:'Não foi possível ler o arquivo.'});}}}/></label>
   {verify&&<div className={verify.valid?'success':'error'} role="status"><strong>{verify.error??(verify.valid?'Histórico íntegro: os registros batem com seus códigos.':'Atenção: o arquivo foi alterado depois de gerado.')}</strong>{verify.items.length>0&&<ul>{verify.items.map((i,n)=><li key={n}>{i.agreement}: {i.valid?'confere':'NÃO confere'}{onChain?.[n]&&(onChain[n].attested?' · atestado na rede local ✓':' · sem registro na rede local')}</li>)}</ul>}{!verify.error&&!verify.summaryMatches&&<p>O resumo não corresponde aos registros.</p>}</div>}
   <p className="muted">O código prova que o arquivo não mudou depois de gerado. A garantia independente vem dos pagamentos confirmados pela outra parte e, na próxima etapa, do registro do código na Solana — sem publicar nomes nem valores.</p></details>
 </section>;
}
