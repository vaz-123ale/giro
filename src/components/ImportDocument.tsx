import {useState} from 'react';
import {FileUp} from 'lucide-react';
import {parseDocument,type ImportedItem} from '../domain/import';
import {money,today} from '../domain/finance';
import {parseMoney} from '../domain/validation';
import {brDate} from './display';
type Post=(path:string,input:unknown)=>Promise<boolean>;
const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();

/**
 * Importar documento: o arquivo é lido só neste navegador (CSV ou TXT) ou o texto é colado.
 * O GIRO mostra o que encontrou e só cadastra o que o usuário revisar e marcar.
 */
export function ImportDocument({busy=false,post}:{busy?:boolean;post?:Post}){
 const [text,setText]=useState('');const [items,setItems]=useState<(ImportedItem&{selected:boolean;repeat:boolean})[]|null>(null);const [message,setMessage]=useState('');const [fileNote,setFileNote]=useState('');
 const read=(content:string)=>{const found=parseDocument(content,today());const seen=new Set<string>();
  setItems(found.map(i=>{const first=!seen.has(norm(i.name));seen.add(norm(i.name));return {...i,repeat:i.recurring&&first,selected:!i.recurring||first};}));setMessage('');};
 const update=(id:string,patch:Partial<ImportedItem&{selected:boolean;repeat:boolean}>)=>setItems(items!.map(i=>i.id===id?{...i,...patch}:i));
 const save=async()=>{if(!post||!items)return;let ok=0;for(const i of items.filter(i=>i.selected)){if(await post('plans',{kind:'account',name:i.name,target:i.amount,amount:0,category:'Importado',recurrence:i.repeat?'monthly':'once',priority:null,targetDate:i.due,mode:'manual',rateBps:0}))ok++;else break;}
  setMessage(`${ok} conta${ok===1?'':'s'} adicionada${ok===1?'':'s'} em Organizar → Contas.`);if(ok)setItems(null);};
 return <section className="document-import" aria-labelledby="import-title"><h3 id="import-title"><FileUp size={21} aria-hidden="true"/> Importar documento</h3>
  <p className="muted">Envie um arquivo CSV ou TXT (planilha salva como CSV, extrato, relatório) ou cole o texto de um boleto/PDF. A leitura acontece neste computador; nada é cadastrado sem sua revisão.</p>
  <label>Arquivo (.csv ou .txt)<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(/\.(pdf|png|jpe?g|xlsx?)$/i.test(f.name)){setFileNote('PDF, imagem e Excel ainda não são lidos automaticamente. Abra o documento, copie o texto (Ctrl+C) e cole abaixo, ou salve a planilha como CSV.');return;}setFileNote('');const content=await f.text();setText(content);read(content);}}/></label>
  {fileNote&&<p className="note" role="status">{fileNote}</p>}
  <label>Ou cole o texto aqui<textarea rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder={'Ex.: Fornecedor João — R$ 600 — vencimento em 08/10\nAluguel R$ 900 10/10'}/></label>
  <button className="secondary" type="button" disabled={!text.trim()} onClick={()=>read(text)}>Ler texto</button>
  {items&&(items.length?<div className="import-review"><p role="status"><strong>Foram encontrados {items.length} {items.length===1?'item':'itens'} neste documento.</strong> Revise antes de adicionar:</p>
   <ul>{items.map(i=><li key={i.id}><label className="check"><input type="checkbox" checked={i.selected} onChange={e=>update(i.id,{selected:e.target.checked})}/><span className="sr-only">Adicionar {i.name}</span></label>
    <input aria-label="Nome" value={i.name} maxLength={120} onChange={e=>update(i.id,{name:e.target.value})}/>
    <input aria-label="Valor (R$)" inputMode="decimal" defaultValue={(i.amount/100).toFixed(2).replace('.',',')} onBlur={e=>{try{update(i.id,{amount:parseMoney(e.target.value)});}catch{e.target.value=(i.amount/100).toFixed(2).replace('.',',');}}}/>
    <input aria-label="Vencimento" type="date" value={i.due} onChange={e=>update(i.id,{due:e.target.value})}/>
    <span className="import-meta">{money(i.amount)} · {brDate(i.due)}{i.recurring&&<label className="check"><input type="checkbox" checked={i.repeat} onChange={e=>update(i.id,{repeat:e.target.checked})}/>Aparece com frequência: repetir todo mês</label>}</span></li>)}</ul>
   {post?<div className="form-actions"><button className="primary" type="button" disabled={busy||!items.some(i=>i.selected)} onClick={save}>Adicionar {items.filter(i=>i.selected).length} como contas</button><button className="secondary" type="button" onClick={()=>setItems(null)}>Descartar</button></div>:null}
   <p className="muted">Contas ficam em Organizar (planejamento pessoal). Um acordo com fornecedor que deve receber parte das vendas é criado em “Novo compromisso”, pois precisa do aceite dele.</p></div>
   :<p className="note" role="status">Nenhuma linha com valor e data foi encontrada. Confira se o texto tem valores (ex.: 184,70) e datas (ex.: 14/10).</p>)}
  {message&&<p className="success" role="status">{message}</p>}
 </section>;
}
