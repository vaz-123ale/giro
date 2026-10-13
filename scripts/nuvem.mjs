// Demonstração PÚBLICA na nuvem (ex.: Render), para quem avalia o projeto abrir a qualquer hora.
// - Dados FICTÍCIOS recriados a cada início. GIRO_DEMO_CENARIO=gravacao (padrão, temporário para o vídeo do Colosseum):
//   cenário rico de preparar-gravacao.mjs; GIRO_DEMO_CENARIO=historia: base curta do documento (Maria, João, Pedro).
// - Rede Solana SIMULADA (modelo do programa): nenhuma chave, nenhum dinheiro, nada de dados reais.
// - O GIRO continua escutando só em 127.0.0.1; um proxy mínimo recebe a porta pública da plataforma.
// Uso: node --experimental-strip-types --no-warnings scripts/nuvem.mjs   (PORT e RENDER_EXTERNAL_URL vêm da plataforma)
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {request,createServer} from 'node:http';
import {setPassword} from '../server/auth.ts';

const cenario=process.env.GIRO_DEMO_CENARIO??'gravacao';
const dir=cenario==='gravacao'?'apresentacao/dados-demo/nuvem-gravacao':'apresentacao/dados-demo',inner=process.env.GIRO_DEMO_INTERNA??'3001',port=Number(process.env.PORT??10000);
const url=process.env.RENDER_EXTERNAL_URL??process.env.GIRO_PUBLIC_URL;if(!url)throw Error('Defina GIRO_PUBLIC_URL (https) do serviço.');
const senha=process.env.GIRO_DEMO_SENHA??'giro-demo-2026';
const seedEnv={...process.env,GIRO_DEMO_ENCERRAR:'sim'};for(const k of ['PORT','GIRO_PUBLIC_URL','RENDER_EXTERNAL_URL','GIRO_PUBLICO'])delete seedEnv[k];
const node=args=>spawn(process.execPath,['--experimental-strip-types','--no-warnings',...args],{stdio:'inherit',env:{...seedEnv,GIRO_GRAVACAO_DIR:dir}});

// 1. Base fictícia (o cenário de gravação já cria as contas joao e lia, o convite e o demo.json).
await new Promise((ok,fail)=>node([cenario==='gravacao'?'apresentacao/ferramentas/preparar-gravacao.mjs':'apresentacao/ferramentas/montar-demo.mjs']).on('exit',c=>c===0?ok():fail(Error(`demo: ${c}`))));
setPassword(dir,senha);

// 2. GIRO em 127.0.0.1, com login.
const giro=spawn(process.execPath,['--experimental-strip-types','--no-warnings','server/index.ts'],{stdio:['ignore','pipe','inherit'],
 env:{...process.env,GIRO_DATA_DIR:dir,GIRO_PORT:inner,GIRO_PUBLIC_URL:url,GIRO_PUBLICO:'sim',GIRO_SOLANA_CLUSTER:'simulado',GIRO_DEMO_PUBLICA:'sim'}});
giro.on('exit',c=>process.exit(c??1));
await new Promise(ok=>giro.stdout.once('data',ok));giro.stdout.pipe(process.stdout);

// 3. Convite de teste (várias pessoas podem usar) para experimentar a entrada por link.
if(cenario!=='gravacao'){
const base=`http://127.0.0.1:${inner}/api/`,headers={'Content-Type':'application/json',Origin:url};
const login=await fetch(base+'login',{method:'POST',headers,body:JSON.stringify({usuario:'dona',senha})});
const cookie=String(login.headers.get('set-cookie')).split(';')[0];
const invite=await (await fetch(base+'convites',{method:'POST',headers:{...headers,Cookie:cookie},body:JSON.stringify({role:'fornecedor',maxUses:0})})).json();
// Contas de teste dos outros tipos (cada uma abre um app diferente): fornecedor João (com os acordos da história) e ajudante Lia.
const state=await (await fetch(base+'state',{headers:{...headers,Cookie:cookie}})).json();
const conta=async(body,nova)=>{const c=await (await fetch(base+'pessoas',{method:'POST',headers:{...headers,Cookie:cookie},body:JSON.stringify(body)})).json();
 const l=await fetch(base+'login',{method:'POST',headers,body:JSON.stringify({usuario:c.login,senha:c.password})});
 await fetch(base+'eu/senha',{method:'POST',headers:{...headers,Cookie:String(l.headers.get('set-cookie')).split(';')[0]},body:JSON.stringify({atual:c.password,nova})});return c.login;};
const contas=[{tipo:'barraca',usuario:'dona',senha},
 {tipo:'fornecedor',usuario:await conta({name:'João',login:'joao',role:'fornecedor',contactId:state.contacts.find(c=>c.name==='João')?.id},senha),senha},
 {tipo:'equipe',usuario:await conta({name:'Lia Santos',login:'lia',role:'ajudante',commissionBps:1000},senha),senha}];
writeFileSync(`${dir}/demo.json`,JSON.stringify({usuario:'dona',senha,convite:invite.code,contas}));
}

// 4. Porta pública → GIRO (o IP real segue no X-Forwarded-For, para o limite de tentativas de senha).
createServer((req,res)=>{
 const ip=String(req.headers['x-forwarded-for']??'').split(',')[0].trim()||req.socket.remoteAddress||'?';
 const up=request({host:'127.0.0.1',port:inner,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-for':ip}},r=>{res.writeHead(r.statusCode??502,r.headers);r.pipe(res);});
 up.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.pipe(up);
}).listen(port,'0.0.0.0',()=>console.log(`Demonstração pública: ${url} (porta ${port})`));
