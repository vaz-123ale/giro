import {randomUUID} from 'node:crypto';
import type {State,CommissionRule,Member} from '../src/domain/models.ts';
import {requireDistributionCapacity} from '../src/domain/capacity.ts';
import {inputRecord} from './input.ts';
import {validDate,requireAmount} from '../src/domain/validation.ts';
export function createMember(state:State,value:unknown){
 const input=inputRecord(value);
 if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120)throw Error('Informe o nome do colaborador (até 120 caracteres).');
 if(typeof input.commissionBps!=='number'||!Number.isInteger(input.commissionBps)||input.commissionBps<0||input.commissionBps>10000)throw Error('A comissão deve estar entre 0% e 100%.');
 if(input.compensation!==undefined&&!['commission','fixed_sale','daily','none'].includes(String(input.compensation)))throw Error('Tipo de pagamento inválido.');
 if(input.participationMode!==undefined&&!['automatic','specific'].includes(String(input.participationMode)))throw Error('Modo de participação inválido.');
 if(input.compensation==='fixed_sale'){requireAmount(input.fixedAmount);if(input.commissionBps!==0)throw Error('Valor fixo não usa percentual.');}
 if(input.compensation==='none'&&input.commissionBps!==0)throw Error('Sem remuneração automática não usa percentual.');
 if(input.contactId&&(state.members.some(m=>m.contactId===input.contactId)||state.contacts?.some(c=>c.id===input.contactId&&c.memberId)||!state.contacts?.some(c=>c.id===input.contactId)))throw Error('Pessoa não encontrada.');
 if(input.compensation==='daily'){requireAmount(input.dailyAmount);if(input.commissionBps!==0)throw Error('Diária não usa comissão.');}
 const member:Member={id:randomUUID(),name:input.name.trim(),commissionBps:input.commissionBps,active:false,demo:false};
 if(input.compensation)member.compensation=input.compensation as Member['compensation'];
 if(input.compensation==='daily')member.dailyAmount=Number(input.dailyAmount);
 if(input.compensation==='fixed_sale')member.fixedAmount=Number(input.fixedAmount);
 if(input.participationMode)member.participationMode=input.participationMode as Member['participationMode'];
 member.createdAt=new Date().toISOString();
 if(input.contactId)member.contactId=String(input.contactId);
 requireDistributionCapacity({...state,members:[...state.members,member]});state.members.push(member);if(member.contactId)state.contacts!.find(c=>c.id===member.contactId)!.memberId=member.id;return member;
}
function instant(value:unknown){
 if(value===undefined)return new Date().toISOString();
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{3})?Z$/.test(value)||!validDate(value.slice(0,10))||!Number.isFinite(Date.parse(value))||Date.parse(value)>Date.now())throw Error('Informe uma data e horário válidos, sem horário futuro.');
 return new Date(value).toISOString();
}
export function toggleShift(state:State,value:unknown){
 const input=inputRecord(value);const member=state.members.find(m=>m.id===input.id);if(!member)throw Error('Participante não encontrado.');
 if(member.disabledAt)throw Error('Colaborador desativado não inicia turno.');
 const at=instant(input.at);const shifts=state.shifts??[];const open=shifts.find(s=>s.memberId===member.id&&!s.endedAt);
 if(member.active){
  if(open&&at<open.startedAt)throw Error('O fim do turno não pode ser anterior ao início.');
  if(open)open.endedAt=at; // Flag antiga sem horário conhecido: não inventar turno anterior.
  member.active=false;state.shifts=shifts;return;
 }
 const last=shifts.filter(s=>s.memberId===member.id).map(s=>s.endedAt??s.startedAt).sort().at(-1);if(last&&at<last)throw Error('O novo turno não pode sobrepor um turno desta pessoa.');
 requireDistributionCapacity(state);
 shifts.push({id:randomUUID(),memberId:member.id,name:member.name,rateBps:member.commissionBps,startedAt:at,compensation:member.compensation,fixedAmount:member.fixedAmount,participationMode:member.participationMode});state.shifts=shifts;member.active=true;
}
export function saleCommissions(state:State,soldAt:string,time:unknown,selected?:unknown){
 let candidates:{memberId:string;name:string;rateBps:number;shiftId?:string;compensation?:Member['compensation'];fixedAmount?:number;participationMode?:Member['participationMode']}[];
 let basis='Turnos ativos no momento do registro (horário da venda não informado)';
 if(time===undefined||time==='')candidates=state.members.filter(m=>m.active&&!m.disabledAt).map(m=>({memberId:m.id,name:m.name,rateBps:m.commissionBps,shiftId:state.shifts?.find(s=>s.memberId===m.id&&!s.endedAt)?.id,compensation:m.compensation,fixedAmount:m.fixedAmount,participationMode:m.participationMode}));
 else{
 if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time))throw Error('Informe o horário da venda.');
 const at=new Date(`${soldAt}T${time.length===5?time+':00':time}-03:00`).toISOString();
 if(Date.parse(at)>Date.now())throw Error('O horário da venda não pode estar no futuro.');
 const eligible=(state.shifts??[]).filter(s=>!state.members.find(m=>m.id===s.memberId)?.disabledAt&&s.startedAt<=at&&(!s.endedAt||at<s.endedAt));
 candidates=eligible.map(s=>({memberId:s.memberId,name:s.name,rateBps:s.rateBps,shiftId:s.id,compensation:s.compensation,fixedAmount:s.fixedAmount,participationMode:s.participationMode}));basis=`Turnos registrados no horário da venda: ${soldAt} ${time} (Brasília)`;
 }
 if(selected!==undefined&&(!Array.isArray(selected)||selected.some(id=>typeof id!=='string'||!candidates.some(c=>c.memberId===id))))throw Error('Participante específico precisa ter turno elegível conhecido.');
 const applicable=candidates.filter(c=>c.participationMode!=='specific'||(selected as string[]|undefined)?.includes(c.memberId));
 const participants=applicable.map(c=>({memberId:c.memberId,name:c.name,shiftId:c.shiftId,basis:c.participationMode==='specific'?'specific' as const:'automatic' as const}));
 const commissions:CommissionRule[]=applicable.filter(c=>!['daily','none'].includes(c.compensation??'commission')).map(c=>({memberId:c.memberId,name:c.name,rateBps:c.compensation==='fixed_sale'?0:c.rateBps,shiftId:c.shiftId,compensation:c.compensation,fixedAmount:c.fixedAmount}));
 return {commissions,participants,basis};
}
export function memberHasHistory(state:State,id:string){const m=state.members.find(m=>m.id===id);return !!(state.sales.some(s=>s.participants?.some(p=>p.memberId===id)||s.commissions?.some(c=>c.memberId===id)||s.participant===m?.name)||(state.dailyWages??[]).some(w=>w.memberId===id)||(state.dailySchedules??[]).some(w=>w.memberId===id)||(state.cashPayments??[]).some(p=>p.recipientId===id)||(state.shifts??[]).some(s=>s.memberId===id)||(state.cashDestinations??[]).some(d=>d.recipientId===id)||state.commitments.some(c=>c.contactId===m?.contactId&&!!m?.contactId));}
export function changeMember(state:State,value:unknown){
 const v=inputRecord(value),m=state.members.find(m=>m.id===v.id&&!m.demo);if(!m)throw Error('Colaborador não encontrado.');const previous=structuredClone(m),at=new Date().toISOString();
 if(v.action==='delete'){if(memberHasHistory(state,m.id))throw Error('Há histórico vinculado. Desative o colaborador para preservar os registros.');state.members=state.members.filter(n=>n.id!==m.id);for(const c of state.contacts??[])if(c.memberId===m.id)delete c.memberId;}
 else if(v.action==='disable'){if(m.disabledAt)throw Error('Colaborador já desativado.');m.disabledAt=at;m.active=false;for(const s of state.shifts??[])if(s.memberId===m.id&&!s.endedAt)s.endedAt=at;}
 else if(v.action==='enable'){delete m.disabledAt;m.active=false;}
 else if(v.action==='edit'){if(m.active)throw Error('Encerre o turno antes de editar a regra. As vendas antigas manterão as condições capturadas.');const temporary:State={...state,members:state.members.filter(n=>n.id!==m.id),contacts:[]};const candidate=createMember(temporary,{...v,contactId:undefined});Object.assign(m,{...candidate,id:m.id,createdAt:m.createdAt,contactId:m.contactId,disabledAt:m.disabledAt});if(m.contactId){const c=state.contacts?.find(c=>c.id===m.contactId);if(c)c.name=m.name;}}
 else throw Error('Ação inválida.');(state.memberEvents??=[]).push({id:randomUUID(),memberId:m.id,name:m.name,type:({edit:'edited',disable:'disabled',enable:'enabled',delete:'deleted'} as const)[v.action as 'edit'|'disable'|'enable'|'delete'],at,previous,next:v.action==='delete'?undefined:structuredClone(m)});
}
