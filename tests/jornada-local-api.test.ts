import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {State} from '../src/domain/models.ts';
import {today} from '../src/domain/finance.ts';
import {shiftDate} from '../src/domain/intelligence.ts';
import {verifyReport,trustReport} from '../src/domain/proof.ts';
import {attestationPayloads,ledgerSnapshot} from '../src/domain/integration.ts';

/** Jornada do documento, ponta a ponta pela API local, com banco temporário (os dados reais não são tocados). */
test('Jornada completa local: acordo aceito → vendas → pagamento confirmado pelas duas partes → comprovante verificável',{timeout:30000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'giro-jornada-'));const port='3017';
 const child=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:directory,GIRO_PORT:port},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise<void>((ok,fail)=>{child.stdout.on('data',()=>ok());child.on('error',fail);child.on('exit',code=>fail(Error(`API encerrou: ${code}`)));});
  const call=async(path:string,body?:unknown)=>{const r=await fetch(`http://127.0.0.1:${port}/api/`+path,body?{method:'POST',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:JSON.stringify(body)}:undefined);return {status:r.status,data:await r.json()};};
  const ok=async(path:string,body?:unknown)=>{const r=await call(path,body);assert.equal(r.status,200,`${path}: ${JSON.stringify(r.data)}`);return r.data;};

  // 1. Maria cadastra o fornecedor João e propõe: 20% das vendas até quitar R$ 600.
  const contact=(await ok('contacts',{name:'João',type:'supplier'})).contacts[0];
  const sent:State=await ok('invitations/send',{contactId:contact.id,debtAmount:60000,rateBps:2000,priority:1,due:shiftDate(today(),7),acknowledged:true});
  const invitation=sent.invitations![0];
  // 2. João abre o link local e aceita; sem aceite, nada é destinado.
  assert.equal((await ok(`invitations/${invitation.token}`)).recipient,'João');
  await ok('invitations/decision',{token:invitation.token,decision:'accept',acknowledged:true});
  let state:State=await ok('state');const c=state.commitments.find(x=>x.id===invitation.commitmentId)!;assert.ok(['active','accepted'].includes(c.status));
  // 3. Pedro entra no turno pelo próprio link; vale só após Maria confirmar.
  const pedro=(await ok('members',{name:'Pedro',commissionBps:800,compensation:'commission'})).members.find((m:{name:string})=>m.name==='Pedro');
  await ok('members/schedule',{id:pedro.id,days:[0,1,2,3,4,5,6]});
  const token=(await ok('members/checkin-link',{id:pedro.id})).members.find((m:{id:string})=>m.id===pedro.id).checkinToken;
  await ok('checkin/request',{token,type:'start'});state=await ok('state');assert.equal(state.members.find(m=>m.id===pedro.id)!.active,false);
  await ok('shift/decision',{id:state.shiftRequests![0].id,decision:'confirm'});
  // 4. Prévia antes de vender: de R$ 100, R$ 20 João, R$ 8 Pedro, R$ 72 livre — e nada é gravado.
  const before=JSON.stringify(await ok('state'));const preview=await ok('sales/preview',{amount:10000});
  assert.deepEqual(preview.parts.map((p:{kind:string;amount:number})=>[p.kind,p.amount]),[['commission',800],['commitment',2000],['free',7200]]);
  assert.equal(JSON.stringify(await ok('state')),before);
  // 5. Venda em dinheiro de R$ 3.000: o GIRO separa R$ 600 (limite do restante), nunca mais.
  await ok('cash/open',{opening:0});await ok('sales/cash',{amount:300000,method:'cash',soldAt:today(),paidAt:today()});
  state=await ok('state');assert.equal(state.cashDestinations!.filter(d=>d.kind==='supplier').reduce((a,d)=>a+d.amount,0),60000);
  // 6. Maria entrega o dinheiro; a dívida só baixa após confirmar a entrega. João confirma pelo link.
  state=await ok('cash/pay',{kind:'supplier',recipientId:c.id,amount:60000,requestId:'jornada-pagamento'});
  const done=state.commitments.find(x=>x.id===c.id)!;assert.equal(done.status,'completed');assert.equal(done.paid,60000);
  const payment=state.cashPayments![0];const receipt=(await ok('receipts/request',{paymentId:payment.id})).receiptConfirmations[0];
  const view=await ok(`receipts/${receipt.token}`);assert.equal(view.amount,60000);assert.equal('sales' in view,false,'link mostra só este pagamento');
  await ok('receipts/decision',{token:receipt.token,decision:'confirm'});
  // 7. Comprovante e histórico: verificável, e o que iria para a rede não tem dados pessoais.
  state=await ok('state');const report=await trustReport(state,false);
  assert.equal(report.summary.completed,1);assert.equal(report.summary.cashPaymentsConfirmedByBoth,1);
  assert.equal((await verifyReport(JSON.parse(JSON.stringify(report)))).valid,true);
  const network=JSON.stringify([await ledgerSnapshot(state),await attestationPayloads(state)]);
  for(const word of ['João','Pedro',contact.id])assert.equal(network.includes(word),false,`"${word}" não pode ir para a rede`);
  // 8. Links inválidos e origens externas são recusados.
  assert.equal((await call('receipts/'+'0'.repeat(48))).status,400);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/state`,{headers:{Origin:'https://example.com'}})).status,403);
 }finally{
  const ended=new Promise<void>(ok=>child.once('exit',()=>ok()));child.kill();await ended;await rm(directory,{recursive:true,force:true});
 }
});
