import {CalendarClock} from 'lucide-react';
import type {Member,State} from '../domain/models';
import {today} from '../domain/finance';
import {LocalLink} from './Confirmations';
type Post=(path:string,input:unknown)=>Promise<boolean>;
const days=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],fullDays=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const weekday=()=>new Date(today()+'T12:00:00Z').getUTCDay();

/** Topo da Equipe: pedidos de check-in/check-out para confirmar e quem está na escala de hoje. */
export function TodayShifts({state,busy,post}:{state:State;busy:boolean;post:Post}){
 const requests=(state.shiftRequests??[]).filter(r=>r.state==='waiting');
 const scheduled=state.members.filter(m=>!m.demo&&!m.disabledAt&&m.schedule?.includes(weekday()));const toStart=scheduled.filter(m=>!m.active);
 if(!requests.length&&!scheduled.length)return null;
 return <section className="today-shifts" aria-labelledby="today-shifts-title"><h3 id="today-shifts-title"><CalendarClock size={20} aria-hidden="true"/> Turnos de hoje ({fullDays[weekday()]})</h3>
  {requests.map(r=><div className="shift-request" key={r.id} role="status"><span><strong>{r.name}</strong> pediu para {r.type==='start'?'iniciar':'encerrar'} o turno às {new Date(r.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}.</span><span className="form-actions"><button className="primary" disabled={busy} onClick={()=>post('shift/decision',{id:r.id,decision:'confirm'})}>Confirmar</button><button className="secondary" disabled={busy} onClick={()=>post('shift/decision',{id:r.id,decision:'refuse'})}>Recusar</button></span></div>)}
  {scheduled.length>0&&<p>Na escala de hoje: {scheduled.map(m=>`${m.name}${m.active?' (trabalhando)':''}`).join(', ')}.</p>}
  {toStart.length>0&&<button className="secondary" disabled={busy} onClick={async()=>{for(const m of toStart)if(!await post('shift',{id:m.id}))break;}}>Iniciar turno de quem está na escala ({toStart.length})</button>}
 </section>;
}
/** Dentro do cartão do colaborador: dias da escala e link de check-in do próprio trabalhador. */
export function MemberShiftTools({member,state,busy,post}:{member:Member;state:State;busy:boolean;post:Post}){
 if(member.disabledAt)return null;const schedule=member.schedule??[];
 return <details className="shift-tools"><summary>Escala e check-in</summary>
  <fieldset className="weekday-picker"><legend>Dias em que {member.name} costuma trabalhar</legend>{days.map((d,i)=><label key={d} className={schedule.includes(i)?'on':''}><input type="checkbox" checked={schedule.includes(i)} disabled={busy} onChange={e=>post('members/schedule',{id:member.id,days:e.target.checked?[...schedule,i]:schedule.filter(n=>n!==i)})}/><span aria-hidden="true">{d}</span><span className="sr-only">{fullDays[i]}</span></label>)}</fieldset>
  <p className="muted">A escala só organiza o dia: o turno começa quando você inicia ou confirma o check-in.</p>
  {member.checkinToken?<><p>Link de check-in de {member.name}: ele toca em “Iniciar meu turno” e você confirma aqui em Equipe.</p><LocalLink url={`${location.origin}/turno/${member.checkinToken}`} label={`Abrir como ${member.name}`}/></>
  :<button className="secondary" disabled={busy} onClick={()=>post('members/checkin-link',{id:member.id})}>Criar link de check-in para {member.name}</button>}
  {state.shiftRequests?.some(r=>r.memberId===member.id&&r.state!=='waiting')&&<p className="muted">Últimos pedidos: {state.shiftRequests.filter(r=>r.memberId===member.id&&r.state!=='waiting').slice(0,3).map(r=>`${r.type==='start'?'início':'fim'} ${new Date(r.at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} (${r.state==='confirmed'?'confirmado':'recusado'})`).join(' · ')}</p>}
 </details>;
}
