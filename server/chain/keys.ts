import {createPrivateKey,createPublicKey,generateKeyPairSync,sign,verify,createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

/**
 * Chaves ed25519 no formato da Solana, só com o Node (sem pacotes externos).
 * Arquivo de carteira = JSON com 64 números (32 da semente + 32 da chave pública), igual ao solana-keygen,
 * então as mesmas carteiras de TESTE funcionam depois com a Solana CLI no validador local.
 */
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58(bytes:Uint8Array){
 let n=0n;for(const b of bytes)n=n*256n+BigInt(b);let out='';while(n>0n){out=ALPHABET[Number(n%58n)]+out;n/=58n;}
 for(const b of bytes){if(b!==0)break;out='1'+out;}return out;
}
export function fromBase58(text:string){
 let n=0n;for(const ch of text){const i=ALPHABET.indexOf(ch);if(i<0)throw Error('Endereço inválido.');n=n*58n+BigInt(i);}
 const bytes:number[]=[];while(n>0n){bytes.unshift(Number(n%256n));n/=256n;}for(const ch of text){if(ch!=='1')break;bytes.unshift(0);}
 return Uint8Array.from(bytes);
}
export const isAddress=(text:unknown)=>{try{return typeof text==='string'&&fromBase58(text).length===32;}catch{return false;}};

export interface Keypair {address:string;secret:Uint8Array}
const PKCS8_PREFIX=Buffer.from('302e020100300506032b657004220420','hex');
const privateKey=(secret:Uint8Array)=>createPrivateKey({key:Buffer.concat([PKCS8_PREFIX,Buffer.from(secret.subarray(0,32))]),format:'der',type:'pkcs8'});

export function generateKeypair():Keypair{
 const {privateKey:priv,publicKey:pub}=generateKeyPairSync('ed25519');
 const seed=Buffer.from(priv.export({format:'jwk'}).d!,'base64url'),pk=Buffer.from(pub.export({format:'jwk'}).x!,'base64url');
 return {address:base58(pk),secret:Uint8Array.from([...seed,...pk])};
}
export function keypairFromSecret(secret:Uint8Array):Keypair{
 if(secret.length!==64)throw Error('Carteira inválida.');
 const pk=Buffer.from(createPublicKey(privateKey(secret)).export({format:'jwk'}).x!,'base64url');
 if(!pk.equals(Buffer.from(secret.subarray(32))))throw Error('Carteira corrompida: chave pública não confere.');
 return {address:base58(pk),secret};
}
export const signMessage=(kp:Keypair,message:Uint8Array)=>new Uint8Array(sign(null,message,privateKey(kp.secret)));
export const verifySignature=(address:string,message:Uint8Array,signature:Uint8Array)=>verify(null,message,{key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(fromBase58(address))]),format:'der',type:'spki'},signature);

export function writeKeypairFile(path:string,kp:Keypair){writeFileSync(path,JSON.stringify([...kp.secret]),{mode:0o600});}
export const readKeypairFile=(path:string)=>keypairFromSecret(Uint8Array.from(JSON.parse(readFileSync(path,'utf8'))));

/**
 * Carteiras de TESTE da fase local (Maria, João, Pedro, cliente…), uma por papel, numa pasta só deste PC.
 * Nunca guardar chave de pessoa real aqui: em produção cada pessoa assina na própria carteira.
 */
export class TestWallets {
 private readonly directory:string;
 constructor(directory:string){this.directory=directory;}
 private file(role:string){if(!/^[a-z0-9-]{1,64}$/.test(role))throw Error('Papel de carteira inválido.');return join(this.directory,`${role}.json`);}
 get(role:string):Keypair{
  mkdirSync(this.directory,{recursive:true});const path=this.file(role);
  if(existsSync(path))return readKeypairFile(path);const kp=generateKeypair();writeKeypairFile(path,kp);return kp;
 }
 has(role:string){return existsSync(this.file(role));}
 /** Papel dono de um endereço (para saber qual carteira de teste assina pelo fornecedor de um acordo). */
 roleOf(address:string){
  if(!existsSync(this.directory))return undefined;
  for(const name of readdirSync(this.directory))if(name.endsWith('.json')&&readKeypairFile(join(this.directory,name)).address===address)return name.slice(0,-5);
  return undefined;
 }
}
/** Identificador estável e sem dados pessoais para o papel de uma pessoa (o nome nunca vira papel). */
export const roleFor=(kind:'contato'|'membro'|'acordo',id:string)=>`${kind}-${createHash('sha256').update(id).digest('hex').slice(0,24)}`;
