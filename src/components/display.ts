import type {Notification,State} from '../domain/models';
import {commitmentId} from '../domain/records';
/** Converte AAAA-MM-DD (ou ISO com horário) para DD/MM/AAAA. */
export const brDate=(value?:string|null)=>value?value.slice(0,10).split('-').reverse().join('/'):'';
export const recurrenceLabel=(frequency?:string)=>frequency?({weekly:'Toda semana',fortnightly:'A cada 15 dias',monthly:'Todo mês'} as Record<string,string>)[frequency]??frequency:'Não repete';
/** Texto da notificação para leitura: sem o código longo do compromisso e com datas no formato brasileiro. */
export function friendlyMessage(state:State,n:Notification){
 let text=n.message;const c=n.commitmentId?state.commitments.find(c=>c.id===n.commitmentId):undefined;
 if(c)text=text.replace(`${commitmentId(c)} · `,'');
 return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,'$3/$2/$1');
}
