import {spawn} from 'node:child_process';
// --rede=simulado | --rede=localnet liga a camada Solana (padrão: desligada). Ex.: npm run dev:rede
const rede=process.argv.find(a=>a.startsWith('--rede='))?.slice(7);
// Devnet: autorização A5 concedida em 03/10/2026. Mainnet nunca por aqui (exige GIRO_AUTORIZACAO_MAINNET=sim à mão).
const env=rede?{...process.env,GIRO_SOLANA_CLUSTER:rede,...(rede==='devnet'?{GIRO_AUTORIZACAO_DEVNET:'sim'}:{})}:process.env;
if(rede)console.log(`Rede Solana: ${rede} (somente neste computador, token de TESTE).`);
const children=[spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{stdio:'inherit',env}),spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'})];
function stop(){for(const child of children)child.kill();}
process.on('SIGINT',()=>{stop();process.exit();});process.on('SIGTERM',()=>{stop();process.exit();});
for(const child of children)child.on('exit',code=>{stop();process.exit(code??0);});
