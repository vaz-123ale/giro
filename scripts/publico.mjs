// Abre o GIRO para fora do PC com o túnel Cloudflare (https) — o servidor continua só em 127.0.0.1.
// Uso: npm run publico            (rede Devnet, autorizada em 03/10/2026)
// Pré-requisitos: npm run senha · npm run build · cloudflared instalado.
// Mainnet NUNCA por este script: exige GIRO_AUTORIZACAO_MAINNET=sim definido à mão por quem decide.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
const port=process.env.GIRO_PORT??'3001';
if(!existsSync('data/acesso.json')){console.error('Defina a senha antes: npm run senha');process.exit(1);}
if(!existsSync('dist/index.html')){console.error('Gere a versão compilada antes: npm run build');process.exit(1);}
const exe=['ferramentas/cloudflared.exe','C:/Program Files (x86)/cloudflared/cloudflared.exe','C:/Program Files/cloudflared/cloudflared.exe'].find(existsSync)??'cloudflared';
const tunnel=spawn(exe,['tunnel','--no-autoupdate','--url',`http://127.0.0.1:${port}`],{stdio:['ignore','pipe','pipe']});
let server;const stop=()=>{tunnel.kill();server?.kill();};process.on('SIGINT',()=>{stop();process.exit();});
const onLine=d=>{const url=String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];if(!url||server)return;
 console.log(`\nGIRO acessível em: ${url}\n(o endereço muda cada vez que o túnel reinicia)\n`);
 server=spawn(process.execPath,['--experimental-strip-types','--no-warnings','server/index.ts'],{stdio:'inherit',env:{...process.env,GIRO_PORT:port,GIRO_PUBLIC_URL:url,GIRO_PUBLICO:'sim',
  GIRO_SOLANA_CLUSTER:process.env.GIRO_SOLANA_CLUSTER??'devnet',GIRO_AUTORIZACAO_DEVNET:'sim'}});
 server.on('exit',c=>{tunnel.kill();process.exit(c??0);});};
tunnel.stdout.on('data',onLine);tunnel.stderr.on('data',onLine);tunnel.on('exit',c=>{console.error('Túnel encerrado.');server?.kill();process.exit(c??1);});
