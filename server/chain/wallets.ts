import type {DatabaseSync} from 'node:sqlite';
import {isAddress,verifySignature,fromBase58} from './keys.ts';
import {readChainState,writeChainState} from './outbox.ts';
import type {WalletRegistry} from './localnet.ts';

/**
 * Carteiras REAIS vinculadas às pessoas do GIRO (redes públicas). Só endereços públicos — o GIRO nunca recebe
 * nem guarda a chave de ninguém. Para vincular, a pessoa assina na própria carteira uma mensagem com o endereço,
 * o escopo e a hora; o servidor confere a assinatura ed25519 (prova de que a carteira é dela).
 */
interface Saved {vendedor?:string;papeis:Record<string,string>}
const PROOF_WINDOW_MS=10*60*1000;
export const bindMessage=(address:string,scope:string,at:string)=>`GIRO: vincular esta carteira (${address}) a ${scope}. ${at}`;

export class StoredWalletRegistry implements WalletRegistry {
 private readonly db:DatabaseSync;
 constructor(db:DatabaseSync){this.db=db;}
 private get saved():Saved{return readChainState(this.db,'carteiras')??{papeis:{}};}
 seller(){return this.saved.vendedor;}
 role(role:string){return this.saved.papeis[role];}
 /**
  * Confere a prova e grava. `scope` é o que a mensagem precisa citar (ex.: "o negócio" ou "o acordo COMP-2026-000001").
  * Uma carteira já vinculada a um papel não pode ser trocada por este caminho (evita sequestro por link vazado).
  */
 bind(target:{kind:'vendedor'}|{kind:'papel';role:string},input:{address?:unknown;message?:unknown;signature?:unknown},scope:string,now=Date.now()){
  const {address,message,signature}=input;
  if(!isAddress(address))throw Error('Endereço de carteira inválido.');
  if(typeof message!=='string'||typeof signature!=='string')throw Error('Assine a mensagem na sua carteira para vincular.');
  const at=/\. (\d{4}-\d{2}-\d{2}T[\d:.]+Z)$/.exec(message)?.[1];
  if(!at||message!==bindMessage(address as string,scope,at))throw Error('Mensagem de vínculo diferente da esperada.');
  if(Math.abs(now-Date.parse(at))>PROOF_WINDOW_MS)throw Error('A assinatura expirou. Tente de novo.');
  let sig:Uint8Array;try{sig=fromBase58(signature);}catch{throw Error('Assinatura inválida.');}
  if(sig.length!==64||!verifySignature(address as string,new TextEncoder().encode(message),sig))throw Error('A assinatura não confere com a carteira.');
  const saved=this.saved;
  if(target.kind==='vendedor'){
   if(saved.vendedor&&saved.vendedor!==address)throw Error('O negócio já tem carteira vinculada. Trocar de carteira exige um novo cadastro.');
   saved.vendedor=address as string;
  }else{
   const current=saved.papeis[target.role];if(current&&current!==address)throw Error('Este acordo já tem uma carteira vinculada.');
   if(address===saved.vendedor)throw Error('A carteira do fornecedor não pode ser a mesma do negócio.');
   saved.papeis[target.role]=address as string;
  }
  writeChainState(this.db,'carteiras',saved);return address as string;
 }
}
