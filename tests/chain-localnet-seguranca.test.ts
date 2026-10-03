import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {type Address,type Instruction,AccountRole} from '@solana/kit';
import {TOKEN_PROGRAM_ADDRESS} from '@solana-program/token';
import {findAgreementPda,findPaymentPda,findSellerStatePda,getAcceptInstruction,getConfirmOffchainPaymentInstruction,getProposeInstructionAsync,getRecordOffchainPaymentInstructionAsync,getRegisterSellerInstructionAsync,getSettleSaleInstructionAsync} from '../solana/clients/giro/index.ts';
import {LocalChain} from '../server/chain/kit.ts';
import {TestWallets} from '../server/chain/keys.ts';
import {classify} from '../server/chain/localnet.ts';
import {ChainRuleError} from '../server/chain/adapter.ts';

/**
 * Fase 1 — testes NEGATIVOS de segurança contra o programa COMPILADO no solana-test-validator local.
 * Cada ataque precisa ser recusado pela rede, sem alterar nada. Pulado se o validador estiver desligado.
 */
const RPC='http://127.0.0.1:8899';
const up=async()=>{try{const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getHealth'}),signal:AbortSignal.timeout(5000)});return (await r.json()).result==='ok';}catch{return false;}};

test('Programa compilado recusa ataques e mede o custo da venda',{timeout:300000,skip:!await up()&&'validador local desligado'},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'giro-seguranca-'));const chain=new LocalChain(RPC,new TestWallets(dir));
 const refused=async(p:Promise<unknown>,code:string)=>{try{await p;}catch(e){const c=classify(e);assert.ok(c instanceof ChainRuleError,`${code}: ${c.message}`);if(code!=='*')assert.equal((c as ChainRuleError).code,code,c.message);return;}assert.fail(`ataque aceito pela rede (esperado ${code})`);};
 try{
  for(const r of ['emissor','vendedor','cliente','joao','ana','intruso'])await chain.fund(r);
  await chain.ensureMint();const mint=chain.address('mint-brl-t');
  const seller=await chain.signer('vendedor'),joao=await chain.signer('joao'),ana=await chain.signer('ana'),intruso=await chain.signer('intruso'),cliente=await chain.signer('cliente');
  await chain.send(seller,[await getRegisterSellerInstructionAsync({seller,unit:1n,maxSale:0n})]);
  const [sellerState]=await findSellerStatePda({seller:seller.address});
  const key=(n:number)=>Uint8Array.from({length:32},(_,i)=>i===0?n:0);
  const propose=async(n:number,supplier:Address,rateBps:number,priority:number)=>chain.send(seller,[await getProposeInstructionAsync({seller,supplier,mint,agreementKey:key(n),terms:{original:60000n,rateBps,priority,dueTs:4102444800n},paidBefore:0n,createdTs:1767225600n})]);
  const pda=async(n:number)=>(await findAgreementPda({seller:seller.address,agreementKey:key(n)}))[0];
  await propose(1,joao.address,2000,1);await propose(2,ana.address,1000,2);
  // 1. Só o fornecedor aceita: intruso tentando aceitar no lugar de João.
  await refused(chain.send(intruso,[getAcceptInstruction({supplier:intruso,agreement:await pda(1),sellerState})]),'Unauthorized');
  await chain.send(joao,[getAcceptInstruction({supplier:joao,agreement:await pda(1),sellerState})]);
  await chain.send(ana,[getAcceptInstruction({supplier:ana,agreement:await pda(2),sellerState})]);
  await chain.ensureTokenAccounts(['vendedor','joao','ana','intruso','cliente']);await chain.mintTo('cliente',1_000_000n);
  const ata=(r:string)=>chain.ata(chain.address(r));
  const settle=async(amount:bigint,agreements:[number,string][],percent:[string,number][]=[])=>{
   const ix=await getSettleSaleInstructionAsync({payer:cliente,seller:seller.address,mint,payerToken:await ata('cliente'),sellerToken:await ata('vendedor'),tokenProgram:TOKEN_PROGRAM_ADDRESS,amount,agreementsCount:agreements.length,fixed:[],percentBps:percent.map(p=>p[1])});
   const extra=[];for(const [n,dest] of agreements)extra.push({address:await pda(n),role:AccountRole.WRITABLE},{address:await ata(dest),role:AccountRole.WRITABLE});
   for(const [r] of percent)extra.push({address:await ata(r),role:AccountRole.WRITABLE});
   return chain.send(cliente,[{...ix,accounts:[...ix.accounts,...extra]} as Instruction],400_000);
  };
  const before=[await chain.tokenBalance('joao'),await chain.tokenBalance('ana'),await chain.tokenBalance('cliente')];
  // 2. Omitir um fornecedor da venda.
  await refused(settle(10000n,[[1,'joao']]),'MissingAgreement');
  // 3. Trocar a conta de destino de João pela do intruso.
  await refused(settle(10000n,[[1,'intruso'],[2,'ana']]),'WrongSupplierAccount');
  // 4. Inverter a prioridade.
  await refused(settle(10000n,[[2,'ana'],[1,'joao']]),'WrongOrder');
  // 5. Repetir o mesmo acordo.
  await refused(settle(10000n,[[1,'joao'],[1,'joao']]),'DuplicateAgreement');
  // 6. "Comissão" de 100% para o intruso, que zeraria os fornecedores.
  await refused(settle(10000n,[[1,'joao'],[2,'ana']],[['intruso',10000]]),'CapacityExceeded');
  // 7. Venda de valor zero.
  await refused(settle(0n,[[1,'joao'],[2,'ana']]),'AmountZero');
  // 8. Passar uma conta de token no lugar do acordo (conta falsa).
  {const ix=await getSettleSaleInstructionAsync({payer:cliente,seller:seller.address,mint,payerToken:await ata('cliente'),sellerToken:await ata('vendedor'),tokenProgram:TOKEN_PROGRAM_ADDRESS,amount:10000n,agreementsCount:2,fixed:[],percentBps:[]});
   const fake=[{address:await ata('intruso'),role:AccountRole.WRITABLE},{address:await ata('intruso'),role:AccountRole.WRITABLE},{address:await pda(2),role:AccountRole.WRITABLE},{address:await ata('ana'),role:AccountRole.WRITABLE}];
   await refused(chain.send(cliente,[{...ix,accounts:[...ix.accounts,...fake]} as Instruction],400_000),'*');}
  assert.deepEqual([await chain.tokenBalance('joao'),await chain.tokenBalance('ana'),await chain.tokenBalance('cliente')],before,'nenhum ataque moveu dinheiro');
  // Venda legítima: R$ 100 com Pedro (aqui "intruso" como comissionado legítimo de 8%) → 8 / 20 / 10 / 62; mede compute units.
  const sig=await settle(10000n,[[1,'joao'],[2,'ana']],[['intruso',800]]);
  assert.deepEqual([await chain.tokenBalance('joao')-before[0],await chain.tokenBalance('ana')-before[1],await chain.tokenBalance('intruso'),await chain.tokenBalance('vendedor')],[2000n,1000n,800n,6200n]);
  const tx=await chain.rpc.getTransaction(sig,{maxSupportedTransactionVersion:0,commitment:'confirmed',encoding:'json'}).send();
  const units=Number(tx?.meta?.computeUnitsConsumed??0);console.log(`settle_sale (2 acordos + 1 comissão): ${units} compute units`);assert.ok(units>0&&units<400_000);
  // 9. Dinheiro físico em dois passos: só o vendedor registra; só o fornecedor confirma; nonce único.
  const nonce=randomBytes(16);const [payment]=await findPaymentPda({agreement:await pda(1),nonce});
  await refused(chain.send(intruso,[await getRecordOffchainPaymentInstructionAsync({seller:intruso,agreement:await pda(1),amount:1000n,nonce})]),'*');
  await refused(chain.send(seller,[await getRecordOffchainPaymentInstructionAsync({seller,agreement:await pda(1),amount:59000n,nonce})]),'ExceedsRemaining');
  await chain.send(seller,[await getRecordOffchainPaymentInstructionAsync({seller,agreement:await pda(1),amount:1000n,nonce})]);
  await refused(chain.send(seller,[await getRecordOffchainPaymentInstructionAsync({seller,agreement:await pda(1),amount:1000n,nonce})]),'*');
  await refused(chain.send(intruso,[getConfirmOffchainPaymentInstruction({supplier:intruso,agreement:await pda(1),sellerState,payment})]),'Unauthorized');
  await refused(chain.send(seller,[getConfirmOffchainPaymentInstruction({supplier:seller,agreement:await pda(1),sellerState,payment})]),'Unauthorized');
  await chain.send(joao,[getConfirmOffchainPaymentInstruction({supplier:joao,agreement:await pda(1),sellerState,payment})]);
  await refused(chain.send(joao,[getConfirmOffchainPaymentInstruction({supplier:joao,agreement:await pda(1),sellerState,payment})]),'InvalidStatus');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
