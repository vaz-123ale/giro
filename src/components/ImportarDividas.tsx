import {useState} from 'react';
import {Download,FileUp,HelpCircle,Trash2} from 'lucide-react';
import {parseDateText,parseMoneyText} from '../domain/import';
import {money,today} from '../domain/finance';
import {pdfText} from './pdfText';
import {toast} from './toast';

/**
 * Importar dívidas com fornecedores e ajudantes a partir de PDF, Excel ou CSV.
 * O GIRO lê o arquivo, mostra uma tabela para revisar e, ao confirmar, cadastra cada pessoa e propõe o acordo
 * (que fica aguardando o aceite dela, como qualquer acordo).
 */
type Tipo='fornecedor'|'ajudante';
interface Linha {id:number;incluir:boolean;name:string;type:Tipo;amount:number;due:string;rate:string}
const plus30=()=>{const d=new Date(today()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+30);return d.toISOString().slice(0,10);};
const norm=(s:unknown)=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const AJUDANTE=/ajudante|funcion|colaborador|diarista|trabalhador|auxiliar/;
const defaultRate=(t:Tipo)=>t==='ajudante'?'10':'20';

function cents(v:unknown){if(typeof v==='number')return Math.round(v*100);return parseMoneyText(String(v??''))??(/^\d+$/.test(String(v).trim())?Number(v)*100:0);}
function isoDate(v:unknown){if(v instanceof Date&&!isNaN(+v))return v.toISOString().slice(0,10);return parseDateText(String(v??''),today())??'';}
function pct(v:unknown){const m=String(v??'').match(/(\d+(?:[.,]\d+)?)/);if(!m)return '';let n=Number(m[1].replace(',','.'));if(typeof v==='number'&&v<=1)n=v*100;return String(Math.round(n*100)/100);}

/** Planilha/CSV: usa o cabeçalho quando existe; senão, adivinha pelas células. */
function deTabela(rows:unknown[][]):Omit<Linha,'id'|'incluir'>[]{
 const hi=rows.findIndex(r=>r.some(c=>/nome|fornecedor|pessoa|credor/.test(norm(c)))&&r.some(c=>/valor|divida|total|saldo/.test(norm(c))));
 const out:Omit<Linha,'id'|'incluir'>[]=[];
 if(hi>=0){
  const h=rows[hi].map(norm);const col=(re:RegExp)=>h.findIndex(c=>re.test(c));
  const cN=col(/nome|fornecedor|pessoa|credor/),cT=col(/tipo|categoria|papel/),cV=col(/valor|divida|total|saldo/),cD=col(/venc|prazo|data|ate/),cP=col(/%|percent|porcent/);
  for(const r of rows.slice(hi+1)){const name=String(r[cN]??'').trim();const amount=cents(r[cV]);if(!name||!amount)continue;
   const type:Tipo=AJUDANTE.test(norm(cT>=0?r[cT]:'')+' '+norm(name))?'ajudante':'fornecedor';
   out.push({name,type,amount,due:cD>=0?isoDate(r[cD]):'',rate:cP>=0?pct(r[cP]):''});}
 }else for(const r of rows){const t=r.map(c=>String(c??'')).join(' ');const l=deLinha(t);if(l)out.push(l);}
 return out;
}
/** Texto solto (PDF): uma dívida por linha. */
function deLinha(line:string):Omit<Linha,'id'|'incluir'>|null{
 const amount=parseMoneyText(line);if(!amount)return null;
 const rate=(line.match(/(\d+(?:[.,]\d+)?)\s*%/)?.[1]??'').replace(',','.');
 const due=parseDateText(line,today())??'';
 const type:Tipo=AJUDANTE.test(norm(line))?'ajudante':'fornecedor';
 const name=line.replace(/R\$\s*[\d.,]+|\d{1,2}\/\d{1,2}(\/\d{2,4})?|\d{4}-\d{2}-\d{2}|\d+(?:[.,]\d+)?\s*%|\b(fornecedor|ajudante|vencimento|venc\.?|valor|divida|dívida|ate|até|de|das vendas)\b|[;:|\t—–-]+/gi,' ').replace(/\s+/g,' ').trim();
 return name?{name:name.slice(0,120),type,amount,due,rate}:null;
}

export function ImportarDividas({onDone}:{onDone:()=>void}){
 const [linhas,setLinhas]=useState<Linha[]|null>(null);const [nota,setNota]=useState('');const [busy,setBusy]=useState(false);
 const [res,setRes]=useState<{name:string;ok:boolean;error?:string;link?:string|null}[]>();
 const ler=async(f:File)=>{setNota('Lendo o arquivo…');setRes(undefined);try{
  let itens:Omit<Linha,'id'|'incluir'>[]=[];
  if(/\.(xlsx|xls|ods)$/i.test(f.name)){const XLSX=await import('xlsx');const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});
   const ws=wb.Sheets[wb.SheetNames[0]];itens=deTabela(XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,raw:true,defval:''}));}
  else if(/\.pdf$/i.test(f.name)||f.type==='application/pdf'){const t=await pdfText(f);itens=t.split(/\n/).map(deLinha).filter((x):x is NonNullable<typeof x>=>!!x);}
  else{const t=await f.text();const sep=t.includes(';')?';':t.includes('\t')?'\t':',';itens=deTabela(t.split(/\r?\n/).filter(Boolean).map(l=>l.split(sep)));}
  if(!itens.length){setNota('Não encontrei dívidas neste arquivo. Veja “Como fazer?” e use o modelo.');setLinhas(null);return;}
  setLinhas(itens.map((x,i)=>({...x,id:i,incluir:true,due:x.due||plus30(),rate:x.rate||defaultRate(x.type)})));
  setNota(`${itens.length} dívida(s) encontrada(s) em ${f.name}. Revise e corrija o que precisar antes de cadastrar.`);toast(`Arquivo lido: ${f.name}`);
 }catch{setNota('Não consegui ler este arquivo. Tente salvar a planilha como .xlsx ou .csv.');}};
 const upd=(id:number,patch:Partial<Linha>)=>setLinhas(ls=>ls!.map(l=>l.id===id?{...l,...patch}:l));
 const cadastrar=async()=>{setBusy(true);try{
  const items=linhas!.filter(l=>l.incluir).map((l,i)=>({name:l.name,type:l.type,amount:l.amount,due:l.due,rateBps:Math.round(Number(l.rate.replace(',','.'))*100),priority:i+1}));
  const r=await fetch('/api/dividas/importar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});const v=await r.json();if(!r.ok)throw Error(v.error);
  setRes(v.results);const ok=v.results.filter((x:{ok:boolean})=>x.ok).length;toast(`${ok} dívida(s) cadastrada(s)!`);if(ok)setLinhas(null);setNota('');onDone();
 }catch(e){setNota((e as Error).message);}finally{setBusy(false);}};
 const modelo=()=>{const csv='﻿Nome;Tipo;Valor;Vencimento;% das vendas\nDistribuidora Sol;Fornecedor;600,00;30/11/2026;20\nPedro;Ajudante;200,00;15/11/2026;10\n';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='modelo-dividas-giro.csv';a.click();};
 return <section className="panel import-debts">
  <div className="section-title"><h2><FileUp size={22} aria-hidden="true"/> Importar dívidas (PDF ou Excel)</h2></div>
  <p className="muted">Suba uma planilha ou PDF com o que você deve a fornecedores e ajudantes. O GIRO cadastra cada pessoa e propõe o acordo para ela aceitar.</p>
  <details className="help-box"><summary><HelpCircle size={16} aria-hidden="true"/> Como fazer?</summary>
   <ol><li>Baixe o <b>modelo</b> (abre no Excel) ou use a sua planilha. Uma dívida por linha, com as colunas <b>Nome</b>, <b>Tipo</b> (Fornecedor ou Ajudante), <b>Valor</b>, <b>Vencimento</b> e <b>% das vendas</b>.</li>
    <li>Pode ser também um PDF (boleto, nota, relatório) com uma dívida por linha, por exemplo: <i>“Distribuidora Sol R$ 600,00 vencimento 30/11 20%”</i>.</li>
    <li>Clique em <b>Escolher arquivo</b>. O GIRO mostra uma tabela: confira nomes, valores, datas e a porcentagem de cada venda que vai para a pessoa.</li>
    <li>Clique em <b>Cadastrar tudo</b>. Cada pessoa recebe um link para aceitar o acordo; até o aceite, nada sai das suas vendas.</li></ol>
   <p className="muted">Se a % das vendas não vier no arquivo, o GIRO sugere 20% para fornecedor e 10% para ajudante. A soma de todos os acordos não pode passar de 100%.</p></details>
  <div className="form-actions"><label className="primary photo-button"><FileUp size={18} aria-hidden="true"/> Escolher arquivo<input type="file" hidden accept=".pdf,.xlsx,.xls,.ods,.csv,.txt,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f)void ler(f);e.currentTarget.value='';}}/></label>
   <button className="secondary" onClick={modelo}><Download size={18} aria-hidden="true"/> Baixar modelo (Excel)</button></div>
  {nota&&<p className="note" role="status">{nota}</p>}
  {linhas&&<><div className="debt-table-wrap"><table className="debt-table"><thead><tr><th>Cadastrar</th><th>Nome</th><th>Tipo</th><th>Valor (R$)</th><th>Vencimento</th><th>% das vendas</th><th/></tr></thead>
   <tbody>{linhas.map(l=><tr key={l.id} className={l.incluir?'':'off'}>
    <td><input type="checkbox" checked={l.incluir} onChange={e=>upd(l.id,{incluir:e.target.checked})} aria-label={`Cadastrar ${l.name}`}/></td>
    <td><input value={l.name} onChange={e=>upd(l.id,{name:e.target.value})} aria-label="Nome"/></td>
    <td><select value={l.type} onChange={e=>{const t=e.target.value as Tipo;upd(l.id,{type:t,rate:l.rate===defaultRate(l.type)?defaultRate(t):l.rate});}} aria-label="Tipo"><option value="fornecedor">Fornecedor</option><option value="ajudante">Ajudante</option></select></td>
    <td><input inputMode="decimal" defaultValue={(l.amount/100).toFixed(2).replace('.',',')} onBlur={e=>upd(l.id,{amount:parseMoneyText(e.target.value)??l.amount})} aria-label="Valor"/></td>
    <td><input type="date" value={l.due} onChange={e=>upd(l.id,{due:e.target.value})} aria-label="Vencimento"/></td>
    <td><input inputMode="decimal" value={l.rate} onChange={e=>upd(l.id,{rate:e.target.value})} aria-label="% das vendas" style={{width:80}}/></td>
    <td><button className="text-button" onClick={()=>setLinhas(ls=>ls!.filter(x=>x.id!==l.id))} aria-label={`Remover ${l.name}`}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
   <p className="muted">Total: {money(linhas.filter(l=>l.incluir).reduce((a,l)=>a+l.amount,0))} em {linhas.filter(l=>l.incluir).length} dívida(s) · soma das %: {linhas.filter(l=>l.incluir).reduce((a,l)=>a+(Number(l.rate.replace(',','.'))||0),0)}%</p>
   <div className="form-actions"><button className="primary big-action" disabled={busy||!linhas.some(l=>l.incluir)} onClick={cadastrar}>{busy?'Cadastrando…':'Cadastrar tudo'}</button><button className="secondary" onClick={()=>{setLinhas(null);setNota('');}}>Cancelar</button></div></>}
  {res&&<ul className="debt-results">{res.map((r,i)=><li key={i} className={r.ok?'ok':'erro'}>{r.ok?'✓':'✗'} <b>{r.name}</b> {r.ok?<>cadastrado · acordo enviado para aceite{r.link&&<> · <a href={r.link} target="_blank" rel="noopener">link do acordo</a></>}</>:<>não cadastrado: {r.error}</>}</li>)}</ul>}
 </section>;
}
