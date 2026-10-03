// Envia BRZ de TESTE (Devnet, sem valor) para uma carteira — o emissor do GIRO é a autoridade do token de teste.
// Uso: node --experimental-strip-types scripts/enviar-brz-teste.mjs <endereço> <reais>
import {address} from '@solana/kit';
import {getMintToInstruction} from '@solana-program/token';
import {LocalChain} from '../server/chain/kit.ts';
import {TestWallets} from '../server/chain/keys.ts';
const [to,reais]=process.argv.slice(2);const cents=Math.round(Number(reais)*100);
if(!to||!(cents>0)||cents>1_000_000)throw Error('Uso: <endereço> <reais até 10000>');
const chain=new LocalChain('https://api.devnet.solana.com',new TestWallets('data/carteiras-teste'));chain.useMint(chain.address('mint-brz-teste'));
const issuer=await chain.signer('emissor');await chain.ensureTokenAccountsFor([address(to)]);
await chain.send(issuer,[getMintToInstruction({mint:chain.mint,token:await chain.ata(address(to)),mintAuthority:issuer,amount:BigInt(cents)*100n})]);
console.log(`Enviado R$ ${(cents/100).toFixed(2)} em BRZ de teste. Saldo: R$ ${(Number(await chain.tokenBalanceOf(address(to)))/10000).toFixed(2)}`);process.exit(0);
