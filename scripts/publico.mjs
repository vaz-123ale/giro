// Abre o GIRO para fora do PC por https — o servidor continua só em 127.0.0.1.
// Endereço FIXO com Tailscale Funnel (se instalado e logado); senão, túnel Cloudflare (endereço muda a cada início).
// Uso: npm run publico            (rede Devnet, autorizada em 03/10/2026)
// Pré-requisitos: npm run senha · npm run build · cloudflared instalado.
// Mainnet NUNCA por este script: exige GIRO_AUTORIZACAO_MAINNET=sim definido à mão por quem decide.
import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const port=process.env.GIRO_PORT??'3001';
if(!existsSync('data/acesso.json')){console.error('Defina a senha antes: npm run senha');process.exit(1);}
if(!existsSync('dist/index.html')){console.error('Gere a versão compilada antes: npm run build');process.exit(1);}
const startServer=url=>{
 const server=spawn(process.execPath,['--experimental-strip-types','--no-warnings','server/index.ts'],{stdio:'inherit',env:{...process.env,GIRO_PORT:port,GIRO_PUBLIC_URL:url,GIRO_PUBLICO:'sim',
  GIRO_SOLANA_CLUSTER:process.env.GIRO_SOLANA_CLUSTER??'devnet',GIRO_AUTORIZACAO_DEVNET:'sim'}});return server;};

// 1. Tailscale Funnel: https://<pc>.<rede>.ts.net, sempre o mesmo.
const ts=['C:/Program Files/Tailscale/tailscale.exe','/usr/bin/tailscale'].find(existsSync);
const tsRun=args=>spawnSync(ts,args,{encoding:'utf8',timeout:30000});
const fixed=(()=>{if(!ts||process.env.GIRO_TUNEL==='cloudflare')return;
 let st;try{st=JSON.parse(tsRun(['status','--json']).stdout);}catch{return;}
 if(st.BackendState!=='Running'||!st.Self?.DNSName){console.log('Tailscale instalado mas não conectado (abra o Tailscale e entre na conta). Usando Cloudflare.');return;}
 const r=tsRun(['funnel','--bg',`http://127.0.0.1:${port}`]);const out=`${r.stdout}${r.stderr}`;
 if(r.status!==0||/enable|not allowed|login\.tailscale/i.test(out)){console.log(`Funnel ainda não liberado na conta Tailscale:
${out.trim()}
Usando Cloudflare por enquanto.`);return;}
 return `https://${st.Self.DNSName.replace(/\.$/,'')}`;})();
if(fixed){
 console.log(`
GIRO acessível em: ${fixed}
(endereço FIXO — Tailscale Funnel)
`);
 const server=startServer(fixed);process.on('SIGINT',()=>{server.kill();process.exit();});server.on('exit',c=>process.exit(c??0));
}else{
// 2. Cloudflare quick tunnel (endereço muda a cada início).
const exe=['ferramentas/cloudflared.exe','C:/Program Files (x86)/cloudflared/cloudflared.exe','C:/Program Files/cloudflared/cloudflared.exe'].find(existsSync)??'cloudflared';
const tunnel=spawn(exe,['tunnel','--no-autoupdate','--url',`http://127.0.0.1:${port}`],{stdio:['ignore','pipe','pipe']});
let server;const stop=()=>{tunnel.kill();server?.kill();};process.on('SIGINT',()=>{stop();process.exit();});
const onLine=d=>{const url=String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];if(!url||server)return;
 console.log(`
GIRO acessível em: ${url}
(o endereço muda cada vez que o túnel reinicia)
`);
 server=startServer(url);server.on('exit',c=>{tunnel.kill();process.exit(c??0);});};
tunnel.stdout.on('data',onLine);tunnel.stderr.on('data',onLine);tunnel.on('exit',c=>{console.error('Túnel encerrado.');server?.kill();process.exit(c??1);});
}
