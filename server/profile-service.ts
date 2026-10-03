import type {Commitment,State} from '../src/domain/models.ts';
import {commitmentId} from '../src/domain/records.ts';
import {remaining} from '../src/domain/finance.ts';
import type {People,Person} from './people.ts';

/**
 * Painel de cada colega e perfis (contratos + confiança). Visível só para quem está logado no GIRO.
 * Mostra o que já é fato no GIRO (e, com a rede ligada, se está registrado/atestado na rede).
 */
export type ChainMarks=Record<string,{state:string;attested:boolean}>;
const roleLabel:Record<string,string>={fornecedor:'Fornecedor(a)',ajudante:'Ajudante',cliente:'Cliente',dona:'Dona do negócio'};
const situation=(c:Commitment)=>({draft:'Rascunho',awaiting_acceptance:'Aguardando aceite',active:'Ativo',accepted:'Ativo',completed:'Concluído',cancelled:'Recusado/cancelado',pending:'Pendente'}[c.status]);
const onTime=(c:Commitment)=>!!c.completedAt&&c.completedAt<=(c.completionTerms?.due??c.finalDue??c.due);
const photoUrl=(slug:string,photo?:string|null)=>photo?`/api/fotos/${slug}`:null;

function agreementsOf(state:State,p:Person){return state.commitments.filter(c=>!c.demo&&c.status!=='draft'&&!!p.contactId&&c.contactId===p.contactId);}
function agreementRow(c:Commitment,marks:ChainMarks){
 const m=marks[c.id];
 return {id:commitmentId(c),original:c.original,paid:c.paid,remaining:remaining(c),rateBps:c.rateBps,due:c.due,situation:situation(c),onTime:c.status==='completed'?onTime(c):null,
  chain:m?{registered:m.state==='registrado',state:m.state,attested:m.attested}:null};
}
function stats(list:Commitment[]){
 const done=list.filter(c=>c.status==='completed');
 return {total:list.length,active:list.filter(c=>['active','accepted'].includes(c.status)).length,completed:done.length,onTime:done.filter(onTime).length,settled:done.reduce((a,c)=>a+c.original,0)};
}
/** Comissões recebidas por uma ajudante (vendas já recebidas). */
function commissionsOf(state:State,p:Person){
 if(!p.memberId)return 0;return state.sales.filter(s=>!s.demo&&s.paidAt).flatMap(s=>s.distribution??[]).filter(e=>e.kind==='commission'&&e.recipientId===p.memberId).reduce((a,e)=>a+e.amount,0);
}

/** Painel da colega: seus acordos (com o link para aceitar/assinar), confirmações pendentes e turno. */
export function myView(state:State,p:Person,marks:ChainMarks){
 const list=agreementsOf(state,p);
 const links=list.map(c=>{const inv=[...(state.invitations??[])].filter(i=>i.commitmentId===c.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];return {...agreementRow(c,marks),link:inv?`/convite/${inv.token}`:null,waiting:inv?.state==='waiting'};});
 const receipts=(state.receiptConfirmations??[]).filter(r=>r.kind==='supplier'&&list.some(c=>c.id===r.recipientId)&&r.state==='waiting').map(r=>({amount:r.amount,paidAt:r.paidAt,link:`/confirmar/${r.token}`}));
 const member=p.memberId?state.members.find(m=>m.id===p.memberId):undefined;
 return {person:{name:p.name,login:p.login,role:p.role,roleLabel:roleLabel[p.role],slug:p.slug,photo:photoUrl(p.slug,p.photo),mustChange:p.mustChange},
  agreements:links,receipts,shift:member?.checkinToken?{link:`/turno/${member.checkinToken}`,active:member.active,commissionBps:member.commissionBps}:null,
  commissionsReceived:commissionsOf(state,p)};
}

/** Lista de perfis (para todas as pessoas logadas). */
export function profiles(people:People){
 const b=people.business();
 return [{slug:b.slug,name:b.name??'Negócio',role:'dona',roleLabel:roleLabel.dona,photo:photoUrl(b.slug,b.photo)},...people.list().map(p=>({slug:p.slug,name:p.name,role:p.role,roleLabel:roleLabel[p.role],photo:photoUrl(p.slug,p.photo)}))];
}
/** Perfil: contratos e confiança. Da colega: acordos dela com o negócio. Do negócio: o histórico de todos os acordos. */
export function profile(state:State,people:People,slug:string,marks:ChainMarks){
 const b=people.business();
 if(slug===b.slug){
  const list=state.commitments.filter(c=>!c.demo&&c.status!=='draft');const s=stats(list);
  const ppl=people.list();const nameOf=(c:Commitment)=>ppl.find(p=>p.contactId&&p.contactId===c.contactId)?.name??c.supplier;
  return {slug,name:b.name??'Negócio',role:'dona',roleLabel:roleLabel.dona,photo:photoUrl(slug,b.photo),stats:s,
   trust:{completed:s.completed,onTime:s.onTime,counterparties:new Set(list.filter(c=>c.status==='completed').map(c=>c.contactId??c.supplier)).size,registered:list.filter(c=>marks[c.id]?.state==='registrado').length,attested:list.filter(c=>marks[c.id]?.attested).length},
   agreements:list.map(c=>({...agreementRow(c,marks),with:nameOf(c)}))};
 }
 const p=people.bySlug(slug);if(!p)throw Error('Perfil não encontrado.');
 const list=agreementsOf(state,p);const s=stats(list);
 return {slug,name:p.name,role:p.role,roleLabel:roleLabel[p.role],photo:photoUrl(slug,p.photo),stats:s,commissionsReceived:commissionsOf(state,p),
  trust:{completed:s.completed,onTime:s.onTime,counterparties:s.total?1:0,registered:list.filter(c=>marks[c.id]?.state==='registrado').length,attested:list.filter(c=>marks[c.id]?.attested).length},
  agreements:list.map(c=>({...agreementRow(c,marks),with:b.name??'Negócio'}))};
}
export function photoOf(people:People,slug:string){
 const b=people.business();const photo=slug===b.slug?b.photo:people.bySlug(slug)?.photo;if(!photo)return undefined;
 const m=/^data:(image\/[a-z]+);base64,(.+)$/.exec(photo)!;return {type:m[1],data:Buffer.from(m[2],'base64')};
}

/**
 * PERFIL PÚBLICO (link para compartilhar com fornecedores, WhatsApp, NFC). Só fatos de confiança:
 * nada de telefone, observação, caixa ou valores de cada acordo. O índice é calculado de forma transparente.
 */
export function publicProfile(state:State,people:People,slug:string,marks:ChainMarks,cluster?:string){
 const b=people.business();const isBusiness=slug===b.slug;const p=isBusiness?undefined:people.bySlug(slug);
 if(!isBusiness&&!p)throw Error('Perfil não encontrado.');
 const list=isBusiness?state.commitments.filter(c=>!c.demo&&c.status!=='draft'&&c.status!=='cancelled'):agreementsOf(state,p!).filter(c=>c.status!=='cancelled');
 const s=stats(list);const registered=list.filter(c=>marks[c.id]?.state==='registrado').length;const attested=list.filter(c=>marks[c.id]?.attested).length;
 const today=new Date().toISOString().slice(0,10);const overdue=list.filter(c=>['active','accepted'].includes(c.status)&&c.due<today).length;
 // Índice GIRO (0–100): 45% pontualidade + 25% quitação + 20% registro na rede + 10% histórico (até 5 acordos). Sem acordos: "novo".
 const punctual=s.completed?s.onTime/s.completed:overdue?0:1;const settledRate=s.total?s.completed/s.total:0;
 const score=s.total?Math.round(100*(0.45*punctual*(overdue?0.5:1)+0.25*settledRate+0.2*(registered/s.total)+0.1*Math.min(1,s.total/5))):null;
 const ppl=people.list();
 const partners=isBusiness?ppl.filter(x=>x.contactId&&list.some(c=>c.contactId===x.contactId)).map(x=>{const mine=list.filter(c=>c.contactId===x.contactId);return {slug:x.slug,name:x.name,role:roleLabel[x.role],photo:x.photo?`/api/publico/${x.slug}/foto`:null,completed:mine.filter(c=>c.status==='completed').length,active:mine.filter(c=>['active','accepted'].includes(c.status)).length,registered:mine.filter(c=>marks[c.id]?.state==='registrado').length};})
  :[{slug:b.slug,name:b.name??'Negócio',role:roleLabel.dona,photo:b.photo?`/api/publico/${b.slug}/foto`:null,completed:s.completed,active:s.active,registered}];
 const since=[...list.map(c=>c.createdAt)].sort()[0]??null;
 return {slug,name:isBusiness?(b.name??'Negócio'):p!.name,role:isBusiness?roleLabel.dona:roleLabel[p!.role],photo:(isBusiness?b.photo:p!.photo)?`/api/publico/${slug}/foto`:null,
  since,score,scoreParts:{punctual:Math.round(punctual*100),settled:Math.round(settledRate*100),registered:s.total?Math.round(registered/s.total*100):0,history:Math.min(s.total,5)},
  stats:{agreements:s.total,active:s.active,completed:s.completed,onTime:s.onTime,settled:s.settled,overdue},chain:{network:cluster??null,registered,attested},
  commissionsReceived:p?.memberId?commissionsOf(state,p):undefined,partners};
}
