import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import type {IncomingMessage} from 'node:http';
import {OWNER_LOGIN,type People} from './people.ts';

/**
 * Acesso com senha — obrigatório quando o GIRO fica acessível fora do PC (GIRO_PUBLIC_URL).
 * Senha guardada só como hash scrypt em <dados>/acesso.json (nunca o texto). Sessão em memória, cookie HttpOnly.
 * Links individuais (convite, confirmação, check-in, cobrança, carteira do fornecedor) continuam funcionando
 * pelo token secreto do próprio link, sem dar acesso ao resto do negócio.
 */
const COOKIE='giro_sessao';const TTL_MS=12*60*60*1000;const MAX_FAILS=5;const LOCK_MS=60*1000;
export const passwordFile=(dataDir:string)=>join(dataDir,'acesso.json');
export function setPassword(dataDir:string,password:string){
 if(password.length<10)throw Error('Use uma senha com pelo menos 10 caracteres.');
 const salt=randomBytes(16);const hash=scryptSync(password,salt,32,{N:16384,r:8,p:1});
 mkdirSync(dataDir,{recursive:true});writeFileSync(passwordFile(dataDir),JSON.stringify({salt:salt.toString('hex'),hash:hash.toString('hex'),N:16384}),{mode:0o600});
}
export const hasPassword=(dataDir:string)=>existsSync(passwordFile(dataDir));

/** Rotas abertas: só as que já são protegidas pelo token secreto de cada link. */
const OPEN:[string,RegExp][]=[
 ['GET',/^\/api\/(invitations|receipts|checkin|payments)\/[a-f0-9]{48}$/],
 ['POST',/^\/api\/(invitations\/decision|invitations\/supplier-change|receipts\/decision|checkin\/request|payments\/confirm)$/],
 ['GET',/^\/api\/solana-pay\/[a-f0-9]{48}$/],['POST',/^\/api\/solana-pay\/[a-f0-9]{48}(\/verificar)?$/],
 ['GET',/^\/api\/rede\/[a-f0-9]{48}(\/mensagem)?$/],['POST',/^\/api\/rede\/[a-f0-9]{48}\/(carteira|\d+\/(transacao|assinada))$/],
 ['GET',/^\/api\/publico\/[a-f0-9]{10}(\/foto)?$/],['GET',/^\/api\/chain\/status$/],['POST',/^\/api\/login$/],['GET',/^\/api\/sessao$/],['POST',/^\/api\/sair$/],
];
/** O que uma COLEGA logada pode acessar além dos links: o próprio painel e os perfis. Nada do resto do negócio. */
const PERSON:[string,RegExp][]=[
 ['GET',/^\/api\/eu(\/carteira\/mensagem)?$/],['POST',/^\/api\/eu\/(senha|foto|carteira)$/],
 ['GET',/^\/api\/perfis(\/[a-f0-9]{10})?$/],['GET',/^\/api\/fotos\/[a-f0-9]{10}$/],
];
export type Subject={kind:'dona'}|{kind:'pessoa';id:string};
export class AccessControl {
 readonly enabled:boolean;private readonly dataDir:string;private readonly sessions=new Map<string,{exp:number;who:Subject}>();people?:People;private readonly fails=new Map<string,{n:number;until:number}>();
 constructor(dataDir:string,enabled:boolean){
  this.dataDir=dataDir;this.enabled=enabled;
  if(enabled&&!hasPassword(dataDir))throw Error('Acesso externo exige senha: rode "npm run senha" antes de ligar GIRO_PUBLIC_URL.');
 }
 isOpen(method:string,pathname:string){return !pathname.startsWith('/api/')||OPEN.some(([m,re])=>m===method&&re.test(pathname));}
 private token(req:IncomingMessage){return /(?:^|;\s*)giro_sessao=([a-f0-9]{64})/.exec(req.headers.cookie??'')?.[1];}
 /** Quem está pedindo: colega logada, dona logada, ou (acesso só local, sem túnel) a dona por padrão. */
 subject(req:IncomingMessage):Subject|undefined{
  const t=this.token(req);const s=t?this.sessions.get(t):undefined;
  if(s&&s.exp>=Date.now())return s.who;if(t&&s)this.sessions.delete(t);
  return this.enabled?undefined:{kind:'dona'};
 }
 authenticated(req:IncomingMessage){return !!this.subject(req);}
 /** Rota permitida para este sujeito (dona: tudo; colega: só o próprio painel, perfis e links). */
 allowed(req:IncomingMessage,method:string,pathname:string){
  if(this.isOpen(method,pathname))return true;const who=this.subject(req);if(!who)return false;
  return who.kind==='dona'||PERSON.some(([m,re])=>m===method&&re.test(pathname));
 }
 private who(req:IncomingMessage){return String(req.headers['cf-connecting-ip']??req.socket.remoteAddress??'?');}
 /** Confere a senha (tempo constante); bloqueia por 1 minuto depois de 5 erros. Devolve o cabeçalho Set-Cookie. */
 /** Usuário "dona" (ou vazio) = senha do negócio (npm run senha); outro usuário = conta de colega. */
 login(req:IncomingMessage,login:unknown,password:unknown){
  const ip=this.who(req);const f=this.fails.get(ip);if(f&&f.until>Date.now())throw Error('Muitas tentativas. Espere 1 minuto.');
  const user=typeof login==='string'&&login.trim()?login.trim().toLowerCase():OWNER_LOGIN;const pass=typeof password==='string'?password:'';
  let who:Subject|undefined;
  if(user===OWNER_LOGIN){
   if(hasPassword(this.dataDir)){const saved=JSON.parse(readFileSync(passwordFile(this.dataDir),'utf8')) as {salt:string;hash:string;N:number};
    if(timingSafeEqual(scryptSync(pass,Buffer.from(saved.salt,'hex'),32,{N:saved.N,r:8,p:1}),Buffer.from(saved.hash,'hex')))who={kind:'dona'};}
  }else{const p=this.people?.check(user,pass);if(p)who={kind:'pessoa',id:p.id};}
  if(!who){const n=(f?.n??0)+1;this.fails.set(ip,{n,until:n>=MAX_FAILS?Date.now()+LOCK_MS:0});throw Error('Usuário ou senha incorretos.');}
  this.fails.delete(ip);const t=randomBytes(32).toString('hex');this.sessions.set(t,{exp:Date.now()+TTL_MS,who});
  return {cookie:`${COOKIE}=${t}; HttpOnly; ${this.enabled?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=${TTL_MS/1000}`,who};
 }
 logout(req:IncomingMessage){const t=this.token(req);if(t)this.sessions.delete(t);return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;}
}
