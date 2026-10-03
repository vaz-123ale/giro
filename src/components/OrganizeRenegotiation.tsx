import {AreaIcon} from './AreaIcon';
import type {State} from '../domain/models';
import {money,remaining} from '../domain/finance';
import {commitmentId,commitmentType,financialLabels,financialStatus,searchCommitment} from '../domain/records';
import {CommitmentActions} from './Commitments';
import {usePageSearch} from './PageSearch';

export function OrganizeRenegotiation({state,busy,post,onError,onAgreement}:{state:State;busy:boolean;post:(path:string,input:unknown)=>Promise<boolean>;onError:(message:string)=>void;onAgreement:(id:string)=>void}){
 const query=usePageSearch();
 const active=state.commitments.filter(c=>!c.demo&&c.status==='active'&&remaining(c)>0);
 const rows=active.filter(c=>searchCommitment(state,c,query)).sort((a,b)=>a.due.localeCompare(b.due));
 return <>
  <section className="panel"><h2><AreaIcon name="renegociar"/>Renegociar</h2><p>Escolha um compromisso para propor um novo prazo, valor, percentual ou forma de pagamento.</p><p className="note">A proposta precisa do aceite da outra parte. Até lá, as condições atuais continuam valendo e o histórico é preservado.</p><p className="muted">Contas pessoais, sem acordo com outra parte, podem ser revistas na aba <a href="#organizar/contas">Contas</a>.</p></section>
  {!rows.length&&<section className="panel"><p>{active.length?'Nenhum compromisso encontrado para esta pesquisa.':'Não há compromissos ativos com saldo restante para renegociar.'}</p></section>}
  {rows.map(c=><section className="panel" key={c.id}><div className="section-title"><div><p className="eyebrow">{commitmentId(c)} · {commitmentType(state,c)==='collaborator'?'Colaborador':'Fornecedor'}</p><h2>{c.supplier}</h2></div><span className="pill">{financialLabels[financialStatus(c.original,c.paid,c.due)]}</span></div><div className="detail-grid"><p>Valor original<b>{money(c.original)}</b></p><p>Pago registrado<b>{money(c.paid)}</b></p><p>Saldo restante<b>{money(remaining(c))}</b></p><p>Vencimento atual<b>{c.due.split('-').reverse().join('/')}</b></p><p>Parte das vendas<b>{c.rateBps/100}%</b></p></div><CommitmentActions c={c} state={state} busy={busy} post={post} onError={onError}/><div className="form-actions"><button className="text-button" onClick={()=>onAgreement(c.id)}>Ver compromisso e histórico</button></div></section>)}
 </>;
}
