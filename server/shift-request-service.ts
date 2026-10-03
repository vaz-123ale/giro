import {randomBytes,randomUUID} from 'node:crypto';
import type {State} from '../src/domain/models.ts';
import {inputRecord} from './input.ts';
import {toggleShift} from './team-service.ts';

/** Escala semanal: só organiza quem costuma trabalhar em cada dia; o turno continua sendo iniciado explicitamente. */
export function setSchedule(state:State,value:unknown){
 const input=inputRecord(value);const m=state.members.find(m=>m.id===input.id&&!m.demo);if(!m)throw Error('Colaborador não encontrado.');
 if(!Array.isArray(input.days)||input.days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Escolha os dias da semana da escala.');
 m.schedule=[...new Set(input.days as number[])].sort();
}
/** Link local de check-in do trabalhador (mesma lógica dos convites: token aleatório, sem login real). */
export function issueCheckin(state:State,value:unknown){
 const input=inputRecord(value);const m=state.members.find(m=>m.id===input.id&&!m.demo);if(!m)throw Error('Colaborador não encontrado.');
 if(m.disabledAt)throw Error('Colaborador desativado.');m.checkinToken??=randomBytes(24).toString('hex');return m.checkinToken;
}
function byToken(state:State,token:unknown){const m=state.members.find(m=>typeof token==='string'&&m.checkinToken===token&&!m.disabledAt);if(!m)throw Error('Link de turno não encontrado ou desativado.');return m;}
export function checkinView(state:State,token:string){
 const m=byToken(state,token);const pending=state.shiftRequests?.find(r=>r.memberId===m.id&&r.state==='waiting');
 return {name:m.name,active:m.active,pending:pending?{type:pending.type,at:pending.at}:null,authentication:'local_simulation' as const};
}
export function requestShift(state:State,value:unknown){
 const input=inputRecord(value);const m=byToken(state,input.token);
 if(input.type!=='start'&&input.type!=='end')throw Error('Escolha iniciar ou encerrar o turno.');
 if(state.shiftRequests?.some(r=>r.memberId===m.id&&r.state==='waiting'))throw Error('Já existe um pedido aguardando o vendedor.');
 if(input.type==='start'&&m.active)throw Error('Seu turno já está ativo.');if(input.type==='end'&&!m.active)throw Error('Seu turno não está ativo.');
 const at=new Date().toISOString();(state.shiftRequests??=[]).unshift({id:randomUUID(),memberId:m.id,name:m.name,type:input.type,at,state:'waiting'});
 (state.notifications??=[]).unshift({id:randomUUID(),message:`${m.name} pediu para ${input.type==='start'?'iniciar':'encerrar'} o turno. Confirme em Equipe.`,type:'ACTION_REQUIRED',recipientId:'local-owner',createdAt:at});
}
/** O vendedor confirma: o turno passa a valer a partir do horário do pedido do trabalhador. */
export function decideShift(state:State,value:unknown){
 const input=inputRecord(value);const r=state.shiftRequests?.find(r=>r.id===input.id);if(!r)throw Error('Pedido de turno não encontrado.');
 if(r.state!=='waiting')throw Error('Este pedido já foi respondido.');if(input.decision!=='confirm'&&input.decision!=='refuse')throw Error('Resposta inválida.');
 if(input.decision==='confirm'){const m=state.members.find(m=>m.id===r.memberId);if(!m)throw Error('Colaborador não encontrado.');if((r.type==='start')===m.active)throw Error(r.type==='start'?'O turno já está ativo.':'O turno já foi encerrado.');toggleShift(state,{id:m.id,at:r.at});}
 r.state=input.decision==='confirm'?'confirmed':'refused';r.decidedAt=new Date().toISOString();
}
