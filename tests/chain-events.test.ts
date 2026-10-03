import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {State} from '../src/domain/models.ts';
import {createCommitment,createSale} from '../server/financial-service.ts';
import {decideAgreement,decideRenegotiation,requestRenegotiation} from '../server/agreement-service.ts';
import {today} from '../src/domain/finance.ts';
import {chainEvents,agreementKeyOf} from '../server/chain/events.ts';
import {ensureChainTables} from '../server/chain/outbox.ts';
import {SimulatedAdapter} from '../server/chain/simulated.ts';
import {LocalnetAdapter} from '../server/chain/localnet.ts';
const validatorUp=async()=>{try{const r=await fetch('http://127.0.0.1:8899',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getHealth'}),signal:AbortSignal.timeout(5000)});return (await r.json()).result==='ok';}catch{return false;}};
const localSkip=!await validatorUp()&&'validador local desligado';
import {TestWallets,base58,fromBase58,generateKeypair,isAddress,keypairFromSecret,signMessage,verifySignature} from '../server/chain/keys.ts';
import {ChainRuleError} from '../server/chain/adapter.ts';
import {AttestationModel,GIRO_SCHEMA,encodeAttestationData,decodeAttestationData} from '../src/domain/attestation-model.ts';
import {serializeAttestationData,deserializeAttestationData} from 'sas-lib';

/** Fase 2: eventos derivados do antes/depois de cada operação, aplicados na rede simulada. */
function harness(kind:'simulado'|'localnet'='simulado'){
 const dir=mkdtempSync(join(tmpdir(),'giro-eventos-'));const db=new DatabaseSync(':memory:');ensureChainTables(db);
 const wallets=new TestWallets(join(dir,'carteiras'));const net=kind==='simulado'?new SimulatedAdapter(db,wallets):new LocalnetAdapter('http://127.0.0.1:8899',wallets);let state:State={schemaVersion:4,demo:false,sales:[],plans:[],commitments:[],members:[]};
 const step=async(op:(s:State)=>void)=>{const before=structuredClone(state);op(state);const events=chainEvents(before,state);for(const e of events)await net.send(e);return events.map(e=>e.type);};
 return {net,get state(){return state;},step,done:()=>{db.close();rmSync(dir,{recursive:true,force:true});}};
}

const lifecycle=(kind:'simulado'|'localnet')=>async()=>{
 const h=harness(kind);try{
  let id='';assert.deepEqual(await h.step(s=>{id=createCommitment(s,{supplier:'Fornecedor X',original:50000,rateBps:1500,priority:1,due:'2099-12-31'}).id;}),['propose']);
  assert.deepEqual(await h.step(s=>decideAgreement(s,{id,actor:'supplier',decision:'accept'})),['accept']);
  assert.deepEqual(await h.step(s=>requestRenegotiation(s,{id,actor:'supplier',original:50000,rateBps:2500,priority:1,due:'2099-12-31'})),['propose_change']);
  const proposal=h.state.commitments[0].renegotiations![0].id;
  assert.deepEqual(await h.step(s=>decideRenegotiation(s,{id,proposalId:proposal,actor:'seller',decision:'accept'})),['decide_change']);
  const a=(await h.net.agreements()).find(x=>x.agreementKey===agreementKeyOf(h.state.commitments[0]))!;
  assert.deepEqual([a.rateBps,a.version,a.status,a.pendingChange],[2500,2,'active',false]);
 }finally{h.done();}
};
test('Ciclo de vida: proposta → aceite → mudança pedida pelo fornecedor → decisão do vendedor → nova versão na rede',lifecycle('simulado'));
test('REDE LOCAL — ciclo de vida com mudança de acordo no programa compilado',{timeout:120000,skip:localSkip},lifecycle('localnet'));
const refusal=(kind:'simulado'|'localnet')=>async()=>{
 const h=harness(kind);try{
  let id='';await h.step(s=>{id=createCommitment(s,{supplier:'Y',original:1000,rateBps:9000,priority:1,due:'2099-12-31'}).id;});
  assert.deepEqual(await h.step(s=>decideAgreement(s,{id,actor:'supplier',decision:'refuse'})),['reject']);
  assert.deepEqual(await h.step(s=>{createCommitment(s,{supplier:'Z',original:1000,rateBps:9000,priority:1,due:'2099-12-31',status:'draft'});}),[]);
  let other='';await h.step(s=>{other=createCommitment(s,{supplier:'W',original:100000,rateBps:9000,priority:1,due:'2099-12-31'}).id;});
  assert.deepEqual(await h.step(s=>decideAgreement(s,{id:other,actor:'supplier',decision:'accept'})),['accept'],'capacidade da recusa foi liberada');
  assert.deepEqual(await h.step(s=>{createSale(s,{amount:5000,method:'cash',soldAt:today(),paidAt:today()});}),[]);
  assert.deepEqual(await h.step(s=>{createSale(s,{amount:5000,method:'digital',soldAt:today(),paidAt:today()});}),['settle_sale']);
  assert.equal((await h.net.agreements()).find(a=>a.status==='active')!.paid,4500);
 }finally{h.done();}
};
test('Recusa do fornecedor libera a capacidade; rascunho não vai para a rede; venda em dinheiro não vai para a rede',refusal('simulado'));
test('REDE LOCAL — recusa libera capacidade e venda digital executa no programa compilado',{timeout:120000,skip:localSkip},refusal('localnet'));
test('Rede simulada recusa venda cuja divisão não bate com a do GIRO (nada é alterado)',async()=>{
 const h=harness();try{
  let id='';await h.step(s=>{id=createCommitment(s,{supplier:'X',original:50000,rateBps:2000,priority:1,due:'2099-12-31'}).id;});await h.step(s=>decideAgreement(s,{id,actor:'supplier',decision:'accept'}));
  const before=JSON.stringify(await h.net.agreements());
  await assert.rejects(h.net.send({type:'settle_sale',saleRef:'x',amount:10000,fixed:[],percent:[],agreements:[agreementKeyOf(h.state.commitments[0])],expected:{commissions:[],agreements:{},seller:10000}}),(e:unknown)=>e instanceof ChainRuleError&&e.code==='Divergente');
  assert.equal(JSON.stringify(await h.net.agreements()),before);
  await assert.rejects(h.net.send({type:'accept',agreementKey:agreementKeyOf(h.state.commitments[0])}),(e:unknown)=>e instanceof ChainRuleError&&e.code==='InvalidStatus');
 }finally{h.done();}
});
test('Carteiras de teste: formato solana-keygen, assinatura ed25519 e base58 conferidos',()=>{
 const kp=generateKeypair();assert.equal(kp.secret.length,64);assert.ok(isAddress(kp.address));assert.equal(base58(fromBase58(kp.address)),kp.address);
 assert.equal(keypairFromSecret(kp.secret).address,kp.address);const msg=new TextEncoder().encode('GIRO');assert.ok(verifySignature(kp.address,msg,signMessage(kp,msg)));
 assert.equal(verifySignature(generateKeypair().address,msg,signMessage(kp,msg)),false);assert.equal(isAddress('0OIl'),false);
 const bad=Uint8Array.from(kp.secret);bad[40]^=1;assert.throws(()=>keypairFromSecret(bad),/corrompida/);
});
test('Atestado (modelo SAS): só assinante da credencial atesta; nonce único; dados sem nomes (81 bytes, layout oficial)',()=>{
 const sas=new AttestationModel();sas.createCredential('emissor','GIRO',['emissor']);const schema=sas.createSchema('emissor','GIRO','giro-acordo-concluido-v1',1,['a']);
 const data={agreementKey:'ab'.repeat(32),recordHash:'cd'.repeat(32),completedAt:1790000000n,onTime:true};const bytes=encodeAttestationData(data);
 assert.equal(bytes.length,81);assert.deepEqual(decodeAttestationData(bytes),data);
 assert.throws(()=>sas.createSchema('intruso','GIRO','x',1,[]),/Unauthorized/);assert.throws(()=>sas.attest('intruso',schema,'n1',bytes,1n),/Unauthorized/);
 sas.attest('emissor',schema,'n1',bytes,1n);assert.throws(()=>sas.attest('emissor',schema,'n1',bytes,1n),/AlreadyExists/);
 assert.equal(AttestationModel.restore(sas.snapshot()).get('n1')?.completedAt,1790000000n);
});
test('Formato do atestado é idêntico ao serializador oficial do SAS (sas-lib)',()=>{
 const enc=new TextEncoder();const names=GIRO_SCHEMA.fieldNames.flatMap(n=>{const b=enc.encode(n);return [b.length,0,0,0,...b];});
 const schema={layout:new Uint8Array(GIRO_SCHEMA.layout),fieldNames:new Uint8Array(names)} as unknown as Parameters<typeof serializeAttestationData>[0];
 const key='12'.repeat(32),hash='ef'.repeat(32);
 const official=serializeAttestationData(schema,{agreement_key:[...Buffer.from(key,'hex')],record_hash:[...Buffer.from(hash,'hex')],completed_at:1790000000n,on_time:true});
 const ours=encodeAttestationData({agreementKey:key,recordHash:hash,completedAt:1790000000n,onTime:true});
 assert.deepEqual([...ours],[...official]);
 const back=deserializeAttestationData<{completed_at:bigint;on_time:boolean}>(schema,ours);assert.equal(BigInt(back.completed_at),1790000000n);assert.equal(back.on_time,true);
});
