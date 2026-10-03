// Envia SOL de TESTE (Devnet) da carteira de implantação para uma carteira. Só Devnet.
// Uso: node --experimental-strip-types scripts/enviar-sol-teste.mjs <endereço> <SOL>
import {mkdtempSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getTransferSolInstruction} from '@solana-program/system';
import {address} from '@solana/kit';
import {LocalChain} from '../server/chain/kit.ts';
import {TestWallets} from '../server/chain/keys.ts';
const [to,sol]=process.argv.slice(2);const lamports=BigInt(Math.round(Number(sol)*1e9));
if(!to||!(lamports>0n)||lamports>2_000_000_000n)throw Error('Uso: <endereço> <SOL até 2>');
const dir=mkdtempSync(join(tmpdir(),'giro-impl-'));copyFileSync('solana/keys/implantador.json',join(dir,'implantador.json'));
const chain=new LocalChain('https://api.devnet.solana.com',new TestWallets(dir));const from=await chain.signer('implantador');
const sig=await chain.send(from,[getTransferSolInstruction({source:from,destination:address(to),amount:lamports})]);
const {value}=await chain.rpc.getBalance(address(to)).send();console.log(`Enviado ${sol} SOL de teste. Saldo agora: ${Number(value)/1e9} SOL. Transação ${sig}`);process.exit(0);
