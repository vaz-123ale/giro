import {randomBytes,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {State} from '../src/domain/models.ts';
import {createContact} from './invitation-service.ts';
import {createMember} from './team-service.ts';
import {issueCheckin} from './shift-request-service.ts';
import {inputRecord} from './input.ts';

/**
 * Pessoas com login (teste em grupo): a dona do negócio cria as contas das colegas e cada uma entra com
 * usuário e senha, põe foto e vê os próprios acordos e os perfis das outras.
 * Contas ficam numa tabela SEPARADA do estado do negócio: hash de senha nunca aparece na API.
 */
export type PersonRole='fornecedor'|'ajudante'|'cliente';
export interface Person {id:string;login:string;name:string;role:PersonRole;slug:string;contactId?:string;memberId?:string;photo?:string;mustChange:boolean;createdAt:string}
type Row={id:string;login:string;name:string;role:PersonRole;slug:string;contact_id:string|null;member_id:string|null;photo:string|null;salt:string;hash:string;must_change:number;created_at:string};
const hashOf=(password:string,salt:Buffer)=>scryptSync(password,salt,32,{N:16384,r:8,p:1});
const LOGIN=/^[a-z0-9._-]{3,32}$/;
export const OWNER_LOGIN='dona';
const MAX_PHOTO=300_000;

export function ensurePeopleTables(db:DatabaseSync){
 db.exec(`CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  contact_id TEXT, member_id TEXT, photo TEXT, salt TEXT NOT NULL, hash TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`);
 db.exec('CREATE TABLE IF NOT EXISTS business_profile (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT, photo TEXT, slug TEXT NOT NULL)');
}
const person=(r:Row):Person=>({id:r.id,login:r.login,name:r.name,role:r.role,slug:r.slug,contactId:r.contact_id??undefined,memberId:r.member_id??undefined,photo:r.photo??undefined,mustChange:!!r.must_change,createdAt:r.created_at});
/** Senha provisória fácil de ditar: 3 grupos de 4 letras/números sem caracteres ambíguos. */
function temporaryPassword(){const a='abcdefghjkmnpqrstuvwxyz23456789';const b=randomBytes(12);return [0,4,8].map(i=>[...b.subarray(i,i+4)].map(x=>a[x%a.length]).join('')).join('-');}
export function validPhoto(photo:unknown){
 if(typeof photo!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))throw Error('Foto inválida (use JPG, PNG ou WebP).');
 if(photo.length>MAX_PHOTO)throw Error('Foto muito grande.');return photo;
}

export class People {
 private readonly db:DatabaseSync;
 constructor(db:DatabaseSync){this.db=db;ensurePeopleTables(db);}
 list(){return (this.db.prepare('SELECT * FROM people ORDER BY created_at').all() as Row[]).map(person);}
 byId(id:string){const r=this.db.prepare('SELECT * FROM people WHERE id=?').get(id) as Row|undefined;return r?person(r):undefined;}
 bySlug(slug:string){const r=this.db.prepare('SELECT * FROM people WHERE slug=?').get(slug) as Row|undefined;return r?person(r):undefined;}
 /** Cria a pessoa no GIRO (contato ou membro da equipe) e a conta de acesso. Devolve a senha provisória UMA vez. */
 create(state:State,value:unknown){
  const input=inputRecord(value);const login=String(input.login??'').trim().toLowerCase();
  if(!LOGIN.test(login)||login===OWNER_LOGIN)throw Error('Usuário: 3 a 32 letras minúsculas, números, ponto ou traço (e não pode ser "dona").');
  if(this.db.prepare('SELECT 1 FROM people WHERE login=?').get(login))throw Error('Este usuário já existe.');
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw Error('Informe o nome (até 120 caracteres).');
  const role=String(input.role) as PersonRole;if(!['fornecedor','ajudante','cliente'].includes(role))throw Error('Escolha o papel: fornecedor, ajudante ou cliente.');
  let contactId:string|undefined,memberId:string|undefined;const name=input.name.trim();
  if(role==='ajudante'){
   const bps=Number(input.commissionBps??0);
   const before=new Set(state.members.map(m=>m.id));createMember(state,{name,commissionBps:bps,compensation:bps>0?'commission':'none'});
   const m=state.members.find(m=>!before.has(m.id))!;memberId=m.id;issueCheckin(state,{id:m.id});
   contactId=createContact(state,{name,type:'collaborator',memberId:m.id}).id;
  }else contactId=createContact(state,{name,type:role==='fornecedor'?'supplier':'other'}).id;
  const password=temporaryPassword();const salt=randomBytes(16);const id=randomUUID();const slug=randomBytes(5).toString('hex');
  this.db.prepare('INSERT INTO people VALUES (?,?,?,?,?,?,?,?,?,?,1,?)').run(id,login,name,role,slug,contactId??null,memberId??null,null,salt.toString('hex'),hashOf(password,salt).toString('hex'),new Date().toISOString());
  return {person:this.byId(id)!,password};
 }
 /** Confere usuário e senha (tempo constante). */
 check(login:string,password:string){
  const r=this.db.prepare('SELECT * FROM people WHERE login=?').get(login.trim().toLowerCase()) as Row|undefined;
  const salt=r?Buffer.from(r.salt,'hex'):randomBytes(16);const got=hashOf(password,salt);
  return r&&timingSafeEqual(got,Buffer.from(r.hash,'hex'))?person(r):undefined;
 }
 changePassword(id:string,current:unknown,next:unknown){
  const p=this.byId(id);if(!p||typeof current!=='string'||!this.check(p.login,current))throw Error('Senha atual incorreta.');
  if(typeof next!=='string'||next.length<10)throw Error('A nova senha precisa ter pelo menos 10 caracteres.');
  const salt=randomBytes(16);this.db.prepare('UPDATE people SET salt=?, hash=?, must_change=0 WHERE id=?').run(salt.toString('hex'),hashOf(next,salt).toString('hex'),id);
 }
 resetPassword(id:string){const p=this.byId(id);if(!p)throw Error('Pessoa não encontrada.');const password=temporaryPassword();const salt=randomBytes(16);
  this.db.prepare('UPDATE people SET salt=?, hash=?, must_change=1 WHERE id=?').run(salt.toString('hex'),hashOf(password,salt).toString('hex'),id);return {login:p.login,password};}
 setPhoto(id:string,photo:unknown){this.db.prepare('UPDATE people SET photo=? WHERE id=?').run(validPhoto(photo),id);}
 business(){let r=this.db.prepare('SELECT * FROM business_profile WHERE id=1').get() as {name:string|null;photo:string|null;slug:string}|undefined;
  if(!r){const slug=randomBytes(5).toString('hex');this.db.prepare('INSERT INTO business_profile VALUES (1,NULL,NULL,?)').run(slug);r={name:null,photo:null,slug};}return r;}
 setBusiness(value:unknown){const input=inputRecord(value);this.business();
  if(input.name!==undefined){if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw Error('Nome inválido.');this.db.prepare('UPDATE business_profile SET name=? WHERE id=1').run(input.name.trim());}
  if(input.photo!==undefined)this.db.prepare('UPDATE business_profile SET photo=? WHERE id=1').run(validPhoto(input.photo));}
}
