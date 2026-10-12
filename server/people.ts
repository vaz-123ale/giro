import {randomBytes,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {State} from '../src/domain/models.ts';
import {createContact} from './invitation-service.ts';
import {createMember} from './team-service.ts';
import {issueCheckin} from './shift-request-service.ts';
import {changeMember} from './team-service.ts';
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
 try{db.exec('ALTER TABLE business_profile ADD COLUMN login TEXT');}catch{/* já existe */}
 // Convites: link/código para a pessoa criar a PRÓPRIA conta (sem a dona digitar senha de ninguém).
 db.exec(`CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, role TEXT NOT NULL, commission_bps INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, uses INTEGER NOT NULL DEFAULT 0, max_uses INTEGER NOT NULL DEFAULT 0, personal INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)`);
 try{db.exec('ALTER TABLE people ADD COLUMN invited_by TEXT');}catch{/* já existe */}
 try{db.exec('ALTER TABLE people ADD COLUMN job TEXT');}catch{/* já existe */}
 db.exec('CREATE TABLE IF NOT EXISTS vagas (id TEXT PRIMARY KEY, owner TEXT NOT NULL, owner_name TEXT NOT NULL, title TEXT NOT NULL, note TEXT, min_months INTEGER NOT NULL DEFAULT 0, min_days INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)');
 db.exec('CREATE TABLE IF NOT EXISTS vaga_interest (vaga_id TEXT NOT NULL, person_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (vaga_id, person_id))');
}
export interface Invite {code:string;role:PersonRole;commissionBps:number;createdBy:string;createdAt:string;uses:number;maxUses:number;personal:boolean;active:boolean}
type InviteRow={code:string;role:PersonRole;commission_bps:number;created_by:string;created_at:string;uses:number;max_uses:number;personal:number;active:number};
const inviteOf=(r:InviteRow):Invite=>({code:r.code,role:r.role,commissionBps:r.commission_bps,createdBy:r.created_by,createdAt:r.created_at,uses:r.uses,maxUses:r.max_uses,personal:!!r.personal,active:!!r.active});
/** Código fácil de ditar/digitar: GIRO-XXXXXX sem letras ambíguas. */
function inviteCode(){const a='ABCDEFGHJKMNPQRSTUVWXYZ23456789';return 'GIRO-'+[...randomBytes(6)].map(x=>a[x%a.length]).join('');}
export const roleNames:Record<PersonRole,string>={fornecedor:'Fornecedor(a)',ajudante:'Ajudante',cliente:'Cliente'};
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
 /** "Busco trabalho": a própria pessoa liga/desliga e escreve um resumo e um contato. */
 setJob(id:string,value:unknown){const v=inputRecord(value);
  if(v.seeking!==true){this.db.prepare('UPDATE people SET job=NULL WHERE id=?').run(id);return;}
  const note=String(v.note??'').trim(),contact=String(v.contact??'').trim();
  if(!note||note.length>400)throw Error('Escreva um resumo do que você procura (até 400 caracteres).');if(!contact||contact.length>60)throw Error('Informe um contato (WhatsApp ou telefone).');
  this.db.prepare('UPDATE people SET job=? WHERE id=?').run(JSON.stringify({note,contact,since:new Date().toISOString().slice(0,10)}),id);}
 job(id:string){const r=this.db.prepare('SELECT job FROM people WHERE id=?').get(id) as {job:string|null}|undefined;return r?.job?JSON.parse(r.job) as {note:string;contact:string;since:string}:null;}
 jobSeekers(){return (this.db.prepare("SELECT * FROM people WHERE job IS NOT NULL ORDER BY created_at").all() as Row[]).map(r=>({...person(r),job:JSON.parse((r as unknown as {job:string}).job) as {note:string;contact:string;since:string}}));}
 /** Vagas "Procuro ajudante": a barraca ou um fornecedor publica regras; quem tem interesse clica e o GIRO confere o histórico. */
 createVaga(owner:string,ownerName:string,value:unknown){const v=inputRecord(value);const title=String(v.title??'').trim();
  if(!title||title.length>80)throw Error('Dê um título à vaga (até 80 caracteres).');const note=String(v.note??'').trim().slice(0,400);
  const months=Number(v.minMonths??0),days=Number(v.minDays??0);if(!Number.isInteger(months)||months<0||months>120||!Number.isInteger(days)||days<0||days>2000)throw Error('Regras de experiência inválidas.');
  const id=randomBytes(6).toString('hex');this.db.prepare('INSERT INTO vagas (id,owner,owner_name,title,note,min_months,min_days,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id,owner,ownerName,title,note,months,days,new Date().toISOString());return id;}
 vagas(){return (this.db.prepare('SELECT * FROM vagas WHERE active=1 ORDER BY created_at DESC').all() as {id:string;owner:string;owner_name:string;title:string;note:string;min_months:number;min_days:number;created_at:string}[])
  .map(v=>({id:v.id,owner:v.owner,ownerName:v.owner_name,title:v.title,note:v.note,minMonths:v.min_months,minDays:v.min_days,createdAt:v.created_at,
   interested:(this.db.prepare('SELECT person_id FROM vaga_interest WHERE vaga_id=? ORDER BY created_at').all(v.id) as {person_id:string}[]).map(r=>r.person_id)}));}
 toggleInterest(vagaId:string,personId:string){const v=this.db.prepare('SELECT 1 FROM vagas WHERE id=? AND active=1').get(vagaId);if(!v)throw Error('Vaga não encontrada ou fechada.');
  if(this.db.prepare('SELECT 1 FROM vaga_interest WHERE vaga_id=? AND person_id=?').get(vagaId,personId)){this.db.prepare('DELETE FROM vaga_interest WHERE vaga_id=? AND person_id=?').run(vagaId,personId);return false;}
  this.db.prepare('INSERT INTO vaga_interest VALUES (?,?,?)').run(vagaId,personId,new Date().toISOString());return true;}
 closeVaga(vagaId:string,owner:string){const r=this.db.prepare('UPDATE vagas SET active=0 WHERE id=? AND owner=?').run(vagaId,owner);if(!r.changes)throw Error('Só quem publicou pode fechar a vaga.');}
 list(){return (this.db.prepare('SELECT * FROM people ORDER BY created_at').all() as Row[]).map(person);}
 byId(id:string){const r=this.db.prepare('SELECT * FROM people WHERE id=?').get(id) as Row|undefined;return r?person(r):undefined;}
 bySlug(slug:string){const r=this.db.prepare('SELECT * FROM people WHERE slug=?').get(slug) as Row|undefined;return r?person(r):undefined;}
 /** Cria a pessoa no GIRO (contato ou membro da equipe) e a conta de acesso. Devolve a senha provisória UMA vez. */
 create(state:State,value:unknown,opts:{password?:string;invitedBy?:string}={}){
  const input=inputRecord(value);const login=String(input.login??'').trim().toLowerCase();
  if(!LOGIN.test(login)||login===OWNER_LOGIN)throw Error('Usuário: 3 a 32 letras minúsculas, números, ponto ou traço (e não pode ser "dona").');
  if(this.db.prepare('SELECT 1 FROM people WHERE login=?').get(login)||this.business().login===login)throw Error('Este usuário já existe.');
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw Error('Informe o nome (até 120 caracteres).');
  const role=String(input.role) as PersonRole;if(!['fornecedor','ajudante','cliente'].includes(role))throw Error('Escolha o papel: fornecedor, ajudante ou cliente.');
  let contactId:string|undefined,memberId:string|undefined;const name=input.name.trim();
  if(role==='ajudante'){
   const bps=Number(input.commissionBps??0);
   const before=new Set(state.members.map(m=>m.id));createMember(state,{name,commissionBps:bps,compensation:bps>0?'commission':'none'});
   const m=state.members.find(m=>!before.has(m.id))!;memberId=m.id;issueCheckin(state,{id:m.id});
   contactId=createContact(state,{name,type:'collaborator',memberId:m.id}).id;
  }else if(role==='fornecedor'&&typeof input.contactId==='string'&&state.contacts?.some(c=>c.id===input.contactId&&c.type==='supplier')&&!this.db.prepare('SELECT 1 FROM people WHERE contact_id=?').get(input.contactId))contactId=input.contactId;
  else contactId=createContact(state,{name,type:role==='fornecedor'?'supplier':'other'}).id;
  if(opts.password!==undefined&&(typeof opts.password!=='string'||opts.password.length<10))throw Error('A senha precisa ter pelo menos 10 caracteres.');
  const password=opts.password??temporaryPassword();const salt=randomBytes(16);const id=randomUUID();const slug=randomBytes(5).toString('hex');
  this.db.prepare('INSERT INTO people (id,login,name,role,slug,contact_id,member_id,photo,salt,hash,must_change,created_at,invited_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
   .run(id,login,name,role,slug,contactId??null,memberId??null,null,salt.toString('hex'),hashOf(password,salt).toString('hex'),opts.password?0:1,new Date().toISOString(),opts.invitedBy??null);
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
 /**
  * Exclui a pessoa: conta, contato(s) com o mesmo nome sem acordos e o lugar na equipe.
  * Recusa se houver acordo ativo ou quitado (o histórico pertence às duas partes). Na equipe, com vendas
  * registradas, a pessoa é DESATIVADA (não conta mais nos 100%) em vez de apagada.
  */
 remove(state:State,id:string){
  const p=this.byId(id);if(!p)throw Error('Pessoa não encontrada.');
  const norm=(t:string)=>t.trim().normalize('NFKC').toLocaleLowerCase('pt-BR');
  const theirs=state.commitments.filter(c=>!c.demo&&c.contactId===p.contactId);
  if(theirs.some(c=>['active','accepted','completed'].includes(c.status)))throw Error(`${p.name} tem acordo ativo ou quitado. Para preservar o histórico, não dá para excluir.`);
  state.commitments=state.commitments.filter(c=>!theirs.includes(c));
  state.invitations=(state.invitations??[]).filter(i=>!theirs.some(c=>c.id===i.commitmentId));
  const used=new Set(state.commitments.map(c=>c.contactId).filter(Boolean));const others=new Set(this.list().filter(x=>x.id!==id).map(x=>x.contactId));
  state.contacts=(state.contacts??[]).filter(c=>!(c.id===p.contactId||(norm(c.name)===norm(p.name)&&!used.has(c.id)&&!others.has(c.id))));
  let member='';if(p.memberId&&state.members.some(m=>m.id===p.memberId)){try{changeMember(state,{id:p.memberId,action:'delete'});member='removida da equipe';}catch{changeMember(state,{id:p.memberId,action:'disable'});member='desativada na equipe (tinha vendas registradas)';}}
  this.db.prepare('DELETE FROM people WHERE id=?').run(id);
  return {name:p.name,removedAgreements:theirs.length,member};
 }
 // ---------------- Convites ----------------
 /** A dona cria um convite com papel definido (fornecedor, ajudante com %, cliente). maxUses 0 = ilimitado. */
 createInvite(value:unknown,createdBy='dona'){
  const input=inputRecord(value);const role=String(input.role) as PersonRole;if(!['fornecedor','ajudante','cliente'].includes(role))throw Error('Escolha o papel do convite.');
  const bps=role==='ajudante'?Number(input.commissionBps??0):0;if(!Number.isInteger(bps)||bps<0||bps>10000)throw Error('Comissão inválida.');
  const max=Number(input.maxUses??1);if(!Number.isInteger(max)||max<0||max>500)throw Error('Quantidade de usos inválida.');
  const code=inviteCode();this.db.prepare('INSERT INTO invites (code,role,commission_bps,created_by,created_at,max_uses,personal) VALUES (?,?,?,?,?,?,0)').run(code,role,bps,createdBy,new Date().toISOString(),max);
  return this.invite(code)!;
 }
 invite(code:string){const r=this.db.prepare('SELECT * FROM invites WHERE code=?').get(String(code).trim().toUpperCase()) as InviteRow|undefined;return r?inviteOf(r):undefined;}
 invites(){return (this.db.prepare('SELECT * FROM invites WHERE personal=0 ORDER BY created_at DESC').all() as InviteRow[]).map(inviteOf);}
 /** Código pessoal (dona ou colega) para indicar novas pessoas como CLIENTES; reaproveitado sempre. */
 personalCode(owner:string){
  const r=this.db.prepare('SELECT * FROM invites WHERE personal=1 AND created_by=?').get(owner) as InviteRow|undefined;if(r)return inviteOf(r);
  const code=inviteCode();this.db.prepare('INSERT INTO invites (code,role,commission_bps,created_by,created_at,max_uses,personal) VALUES (?,?,0,?,?,0,1)').run(code,'cliente',owner,new Date().toISOString());return this.invite(code)!;
 }
 cancelInvite(code:string){this.db.prepare('UPDATE invites SET active=0 WHERE code=? AND personal=0').run(code);}
 /** O que a página do convite mostra (sem login). */
 invitePublic(code:string){
  const i=this.invite(code);if(!i||!i.active||(i.maxUses>0&&i.uses>=i.maxUses))throw Error('Convite inválido ou já usado.');
  const b=this.business();const by=i.createdBy==='dona'?(b.name??'o negócio'):this.byId(i.createdBy)?.name;
  return {code:i.code,role:i.role,roleLabel:roleNames[i.role],commissionBps:i.commissionBps,business:b.name??'Negócio',businessPhoto:b.photo?`/api/publico/${b.slug}/foto`:null,invitedBy:by??'GIRO'};
 }
 /** A pessoa cria a PRÓPRIA conta pelo convite: escolhe usuário e senha; quem convidou fica registrado. */
 acceptInvite(state:State,code:string,value:unknown){
  const i=this.invite(code);if(!i||!i.active||(i.maxUses>0&&i.uses>=i.maxUses))throw Error('Convite inválido ou já usado.');
  const input=inputRecord(value);
  const created=this.create(state,{name:input.name,login:input.login,role:i.role,commissionBps:i.commissionBps},{password:typeof input.password==='string'?input.password:'',invitedBy:i.createdBy});
  this.db.prepare('UPDATE invites SET uses=uses+1 WHERE code=?').run(i.code);
  if(input.photo)this.setPhoto(created.person.id,input.photo);
  return this.byId(created.person.id)!;
 }
 /** Quem esta pessoa (ou a dona) trouxe para o GIRO. */
 referrals(owner:string){return (this.db.prepare('SELECT name,role,slug,created_at FROM people WHERE invited_by=? ORDER BY created_at').all(owner) as {name:string;role:PersonRole;slug:string;created_at:string}[]).map(r=>({name:r.name,roleLabel:roleNames[r.role],slug:r.slug,since:r.created_at}));}
 setPhoto(id:string,photo:unknown){this.db.prepare('UPDATE people SET photo=? WHERE id=?').run(validPhoto(photo),id);}
 business(){let r=this.db.prepare('SELECT * FROM business_profile WHERE id=1').get() as {name:string|null;photo:string|null;slug:string;login?:string|null}|undefined;
  if(!r){const slug=randomBytes(5).toString('hex');this.db.prepare('INSERT INTO business_profile (id,name,photo,slug) VALUES (1,NULL,NULL,?)').run(slug);r={name:null,photo:null,slug};}return r;}
 setBusiness(value:unknown){const input=inputRecord(value);this.business();
  if(input.name!==undefined){if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw Error('Nome inválido.');this.db.prepare('UPDATE business_profile SET name=? WHERE id=1').run(input.name.trim());}
  if(input.photo!==undefined)this.db.prepare('UPDATE business_profile SET photo=? WHERE id=1').run(validPhoto(input.photo));
  if(input.login!==undefined){const l=String(input.login).trim().toLowerCase();if(!LOGIN.test(l)||l===OWNER_LOGIN)throw Error('Usuário da barraca: 3 a 32 letras minúsculas, números, ponto ou traço.');
   if(this.db.prepare('SELECT 1 FROM people WHERE login=?').get(l))throw Error('Este usuário já é de outra pessoa.');this.db.prepare('UPDATE business_profile SET login=? WHERE id=1').run(l);}}
 /** O usuário digitado é o da barraca? ("dona" sempre vale.) */
 isOwnerLogin(user:string){return user===OWNER_LOGIN||(!!this.business().login&&this.business().login===user);}
}
