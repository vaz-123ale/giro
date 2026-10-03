/**
 * MODELO do Solana Attestation Service (SAS) para a fase sem validador.
 * Mesma hierarquia do programa oficial (22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG):
 *   Credential (emissor + assinantes autorizados) → Schema (formato) → Attestation (registro com nonce).
 * O GIRO atesta SÓ: chave do acordo (hash), impressão digital do comprovante, data e se foi no prazo.
 * Quando o SAS for compilado e carregado no validador local (autorização A4), o adaptador "localnet"
 * substitui este modelo; o formato dos dados é o mesmo (encodeAttestationData).
 */
export const SAS_PROGRAM_ID='22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG';
export const GIRO_CREDENTIAL='GIRO';
export const GIRO_SCHEMA={name:'giro-acordo-concluido-v1',version:1,description:'Acordo GIRO concluído: hash do acordo, impressão digital do comprovante, data e prazo. Sem nomes nem valores.',
 fieldNames:['agreement_key','record_hash','completed_at','on_time'] as const,
 /** Códigos de tipo do SAS (sas-lib compactLayoutMapping): 13 = Vec<u8>, 8 = i64, 10 = bool. */ layout:[13,13,8,10] as const} as const;

export interface AttestationData {agreementKey:string;recordHash:string;completedAt:bigint;onTime:boolean}
export interface AttestationRecord extends AttestationData {nonce:string;credential:string;schema:string;signer:string;expiry:bigint;createdTs:bigint}

const hexBytes=(hex:string)=>{if(!/^[0-9a-f]{64}$/.test(hex))throw Error('Hash de 32 bytes esperado.');return Uint8Array.from(hex.match(/../g)!.map(b=>parseInt(b,16)));};
const toHex=(b:Uint8Array)=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
/** Bytes do atestado, em Borsh no layout oficial do schema: Vec<u8>(32) chave do acordo · Vec<u8>(32) hash do comprovante · i64 LE data (s) · bool no prazo = 81 bytes. */
export function encodeAttestationData(d:AttestationData){
 const out=new Uint8Array(81),view=new DataView(out.buffer);
 view.setUint32(0,32,true);out.set(hexBytes(d.agreementKey),4);view.setUint32(36,32,true);out.set(hexBytes(d.recordHash),40);
 view.setBigInt64(72,d.completedAt,true);out[80]=d.onTime?1:0;return out;
}
export function decodeAttestationData(b:Uint8Array):AttestationData{
 const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length!==81||view.getUint32(0,true)!==32||view.getUint32(36,true)!==32||b[80]>1)throw Error('Atestado com formato inesperado.');
 return {agreementKey:toHex(b.subarray(4,36)),recordHash:toHex(b.subarray(40,72)),completedAt:view.getBigInt64(72,true),onTime:b[80]===1};
}

export class AttestationError extends Error{readonly code:'Unauthorized'|'AlreadyExists'|'MissingCredential'|'MissingSchema';constructor(code:AttestationError['code']){super(code);this.code=code;this.name='AttestationError';}}

export class AttestationModel {
 readonly credentials=new Map<string,{authority:string;signers:string[]}>();
 readonly schemas=new Map<string,{credential:string;version:number;fieldNames:readonly string[]}>();
 readonly attestations=new Map<string,AttestationRecord>();
 createCredential(authority:string,name:string,signers:string[]){if(this.credentials.has(name))throw new AttestationError('AlreadyExists');this.credentials.set(name,{authority,signers:[...signers]});}
 createSchema(authority:string,credential:string,name:string,version:number,fieldNames:readonly string[]){
  const c=this.credentials.get(credential);if(!c)throw new AttestationError('MissingCredential');if(c.authority!==authority)throw new AttestationError('Unauthorized');
  const id=`${credential}/${name}/${version}`;if(this.schemas.has(id))throw new AttestationError('AlreadyExists');this.schemas.set(id,{credential,version,fieldNames});return id;
 }
 /** Só um assinante autorizado da credencial atesta; o nonce é único (mesmo nonce = mesma conta = falha). */
 attest(signer:string,schemaId:string,nonce:string,data:Uint8Array,now:bigint,expiry=0n){
  const schema=this.schemas.get(schemaId);if(!schema)throw new AttestationError('MissingSchema');
  if(!this.credentials.get(schema.credential)!.signers.includes(signer))throw new AttestationError('Unauthorized');
  if(this.attestations.has(nonce))throw new AttestationError('AlreadyExists');
  const rec:AttestationRecord={...decodeAttestationData(data),nonce,credential:schema.credential,schema:schemaId,signer,expiry,createdTs:now};this.attestations.set(nonce,rec);return rec;
 }
 get(nonce:string,now?:bigint){const a=this.attestations.get(nonce);return a&&(a.expiry===0n||now===undefined||a.expiry>now)?a:undefined;}
 snapshot(){return JSON.parse(JSON.stringify({credentials:[...this.credentials],schemas:[...this.schemas],attestations:[...this.attestations]},(_k,v)=>typeof v==='bigint'?`${v}n`:v));}
 static restore(s:{credentials:[string,{authority:string;signers:string[]}][];schemas:[string,{credential:string;version:number;fieldNames:string[]}][];attestations:[string,Record<string,unknown>][]}){
  const m=new AttestationModel();for(const [k,v] of s.credentials)m.credentials.set(k,v);for(const [k,v] of s.schemas)m.schemas.set(k,v);
  const big=(v:unknown)=>BigInt(String(v).replace(/n$/,''));
  for(const [k,v] of s.attestations)m.attestations.set(k,{...(v as unknown as AttestationRecord),completedAt:big(v.completedAt),expiry:big(v.expiry),createdTs:big(v.createdTs)});return m;
 }
}
