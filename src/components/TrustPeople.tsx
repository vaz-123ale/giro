import {Star} from 'lucide-react';
import type {State} from '../domain/models';
import {relationshipFacts} from '../domain/relationship';
import {commitmentId,commitmentType,financialLabels,financialStatus,matches} from '../domain/records';
import {money} from '../domain/finance';
import {memberSummary} from '../domain/team';
import {usePageSearch} from './PageSearch';
import {NegocioConfianca} from './Confianca';

/**
 * Página Confiança, organizada em blocos no mesmo padrão:
 * ★ Minha confiança (o histórico do negócio) → Fornecedores → Equipe.
 * Cada pessoa aparece com nome e números principais, sem precisar abrir nada; os detalhes ficam recolhidos.
 */
interface Person {id:string;name:string;agreements:State['commitments']}

function PersonCard({state,p,worker}:{state:State;p:Person;worker?:boolean}){
 const f=relationshipFacts(state,p.agreements);const s=worker?memberSummary(state,p.id):undefined;
 const nums:[string,number,boolean?][]=[['Aceitos',f.accepted],['Concluídos',f.completed],['No prazo',f.onTime],['Atrasados',f.overdue+f.late,true]];
 return <article className="trust-person">
  <div className="trust-person-head"><span className="initial" aria-hidden="true">{p.name.slice(0,1).toUpperCase()}</span><div><strong>{p.name}</strong><small>{worker?'Equipe':'Fornecedor(a)'} · {p.agreements.length} acordo{p.agreements.length===1?'':'s'}</small></div></div>
  <div className="trust-nums">{nums.map(([l,n,bad])=><div key={l} className={bad&&n>0?'bad':''}><span>{l}</span><strong>{n}</strong></div>)}</div>
  <p className="paid">{s?<>Gerado {money(s.generated)} · recebido em dinheiro {money(s.paid)} · a receber {money(s.receivable)}</>:<>Pago em dinheiro (confirmado) {money(f.cashPaid)} · digital {money(f.simulated)}</>}{f.refused>0&&<> · {f.refused} proposta(s) recusada(s)</>}{f.changes>0&&<> · {f.changes} pedido(s) de alteração</>}</p>
  {p.agreements.length>0&&<details><summary>Ver acordos ({p.agreements.length})</summary>{p.agreements.map(c=><p key={c.id} className="muted"><b>{commitmentId(c)}</b> · {money(c.paid)} de {money(c.original)} · {financialLabels[financialStatus(c.original,c.paid,c.due)]}</p>)}</details>}
 </article>;
}

export function TrustPeople({state}:{state:State}){
 const q=usePageSearch();
 const sup=state.commitments.filter(c=>!c.demo&&commitmentType(state,c)==='supplier');
 const col=state.commitments.filter(c=>!c.demo&&commitmentType(state,c)==='collaborator');
 const suppliers:Person[]=[...new Set(sup.map(c=>c.contactId??'name:'+c.supplier))].map(id=>({id,name:sup.find(c=>(c.contactId??'name:'+c.supplier)===id)!.supplier,agreements:sup.filter(c=>(c.contactId??'name:'+c.supplier)===id)}));
 const workers:Person[]=state.members.filter(m=>!m.demo).map(m=>({id:m.id,name:m.name,agreements:col.filter(c=>state.contacts?.some(p=>p.id===c.contactId&&(p.memberId===m.id||p.id===m.contactId)))}));
 const show=(list:Person[])=>list.filter(p=>matches(q,p.name,p.agreements.map(c=>commitmentId(c))));
 return <>
  <section className="panel"><h2 className="trust-section-title"><Star className="star" fill="#f2b705" size={24} aria-hidden="true"/> Minha confiança</h2>
   <p className="muted">O seu histórico de compromissos cumpridos, confirmado pelos dois lados. É isso que você mostra a um fornecedor novo.</p>
   <NegocioConfianca/></section>
  <section className="panel"><h2 className="trust-section-title">Confiança dos fornecedores</h2><p className="muted">Como cada fornecedor e você estão cumprindo os acordos. Sem nota nem ranking: só fatos.</p>
   {show(suppliers).length?<div className="trust-people">{show(suppliers).map(p=><PersonCard key={p.id} state={state} p={p}/>)}</div>:<p className="empty">Nenhum fornecedor com acordo ainda.</p>}</section>
  <section className="panel"><h2 className="trust-section-title">Confiança da equipe</h2><p className="muted">Ajudantes e trabalhadores: o que foi gerado, pago e combinado.</p>
   {show(workers).length?<div className="trust-people">{show(workers).map(p=><PersonCard key={p.id} state={state} p={p} worker/>)}</div>:<p className="empty">Nenhuma pessoa na equipe ainda.</p>}</section>
 </>;
}
