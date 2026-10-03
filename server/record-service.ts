import type {Commitment,State} from '../src/domain/models.ts';
import {commitmentId} from '../src/domain/records.ts';
import {inputRecord} from './input.ts';
import {invitationView} from './invitation-service.ts';
import {requestRenegotiation,terms} from './agreement-service.ts';
export function nextCommitmentId(state:State,year:string){const values=state.commitments.map(c=>c.publicId?.match(new RegExp(`^COMP-${year}-(\\d+)$`))?.[1]).map(n=>Number(n)||0);const next=Math.max(state.commitmentSequence?.[year]??0,0,...values)+1;(state.commitmentSequence??={})[year]=next;return `COMP-${year}-${String(next).padStart(6,'0')}`;}
export function consultCommitment(state:State,value:unknown){
 const v=inputRecord(value),c=state.commitments.find(c=>!c.demo&&c.status!=='draft'&&commitmentId(c).toUpperCase()===String(v.id).trim().toUpperCase());
 if(!c)throw Error('Compromisso não encontrado. Confira o ID informado.');
 if(v.token){const invite=state.invitations?.find(i=>i.token===v.token&&i.commitmentId===c.id);if(!invite)throw Error('Código de acesso inválido.');return {...invitationView(state,invite.token),original:c.original,due:c.due};}
 // Projeção local por ID: nunca retorna tokens, outros cadastros ou o caixa do negócio.
 return {publicId:commitmentId(c),recipient:c.supplier,original:c.original,paid:c.paid,remaining:c.original-c.paid,due:c.due,currentTerms:terms(c),history:c.timeline??[],changes:c.renegotiations??[],status:c.status,canRequestChange:['active','accepted'].includes(c.status)&&!c.renegotiations?.some(r=>r.status==='pending')};
}
export function requestConsultChange(state:State,value:unknown){const v=inputRecord(value),view=consultCommitment(state,{id:v.id});if(!view.canRequestChange)throw Error('Este compromisso não permite uma nova proposta agora.');const c=state.commitments.find(c=>commitmentId(c)===view.publicId)!;if(v.acknowledged!==true)throw Error('Revise e confirme as condições propostas.');requestRenegotiation(state,{...v,id:c.id,actor:'supplier'});return consultCommitment(state,{id:v.id});}
export function documentFields(value:unknown):State['sales'][number]['supportingDocument']{
 if(value===undefined)return undefined;const v=inputRecord(value);if(typeof v.name!=='string'||v.name.length>180||!['application/pdf','image/png','image/jpeg','text/plain'].includes(String(v.type))||!Number.isInteger(v.size)||Number(v.size)<=0||Number(v.size)>2*1024*1024)throw Error('Documento: PDF, PNG, JPEG ou TXT de até 2 MB.');
 if(typeof v.content!=='string'||!v.content.startsWith(`data:${v.type};base64,`))throw Error('Arquivo inválido.');const bytes=Buffer.from(v.content.slice(v.content.indexOf(',')+1),'base64');if(bytes.length!==v.size)throw Error('Tamanho do arquivo inconsistente.');
 if(v.type==='application/pdf'&&bytes.subarray(0,5).toString()!=='%PDF-'||v.type==='image/png'&&bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||v.type==='image/jpeg'&&bytes.subarray(0,3).toString('hex')!=='ffd8ff')throw Error('Conteúdo não corresponde ao tipo informado.');
 for(const key of ['operation','parties','conditions'])if(typeof v[key]!=='string'||!String(v[key]).trim()||String(v[key]).length>1000)throw Error('Preencha identificação da operação, partes e condições do documento.');if(v.commitmentId!==undefined&&(typeof v.commitmentId!=='string'||v.commitmentId.length>160))throw Error('ID do compromisso inválido.');
 return {name:v.name,type:String(v.type),size:Number(v.size),content:v.content,operation:String(v.operation).trim(),parties:String(v.parties).trim(),conditions:String(v.conditions).trim(),commitmentId:v.commitmentId as string|undefined};
}

