// Verificação completa NESTE computador: tipos, testes, build e navegador (Edge local, sem rede de fundo).
// Usa uma CÓPIA do banco em pasta temporária: os dados reais não são alterados. Nada é publicado.
// Uso: npm run verificar   (resultado em auditoria/verificacao-local.md e .json)
import {spawn,spawnSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const report={at:new Date().toISOString(),steps:[],pages:[],ok:true};
const step=(name,ok,detail='')=>{report.steps.push({name,ok,detail});if(!ok)report.ok=false;console.log(`${ok?'✔':'✖'} ${name}${detail?' — '+detail:''}`);};
const run=(name,cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',shell:process.platform==='win32',stdio:['ignore','pipe','pipe']});const out=(r.stdout??'')+(r.stderr??'');const summary=out.match(/ℹ pass \d+[\s\S]*?ℹ fail \d+/)?.[0].replace(/\s+/g,' ')??'';const failed=[...out.matchAll(/^✖ (.+?)(?: \([\d.]+ms\))?$/gm)].map(m=>m[1]).filter((v,i,l)=>l.indexOf(v)===i);step(name,r.status===0,(summary||(r.status===0?'':out.slice(-600)))+(failed.length?' — falhou: '+failed.join('; '):''));return r.status===0;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

run('Tipos (tsc)','npx',['tsc','--noEmit']);
run('Testes automáticos','npm',['test']);
run('Build','npx',['vite','build']);

const edgePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const temp=mkdtempSync(join(tmpdir(),'giro-verificacao-'));const port='3018';
if(existsSync('data/giro.sqlite'))copyFileSync('data/giro.sqlite',join(temp,'giro.sqlite'));
const api=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:temp,GIRO_PORT:port},stdio:['ignore','pipe','pipe']});
let edge;
try{
 await new Promise((ok,fail)=>{api.stdout.on('data',ok);api.on('exit',c=>fail(Error('API encerrou '+c)));setTimeout(()=>fail(Error('API não iniciou')),15000);});
 step('API local na cópia dos dados',true,`http://127.0.0.1:${port}`);
 if(!edgePath){step('Navegador',true,'Edge não encontrado: verificação visual pulada');}
 else{
  edge=spawn(edgePath,['--headless=new','--disable-gpu','--hide-scrollbars','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9340',`--user-data-dir=${join(temp,'edge')}`,'--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--disable-domain-reliability','--disable-breakpad','about:blank']);
  let targets;for(let i=0;i<60&&!targets?.find(t=>t.type==='page');i++){try{targets=await (await fetch('http://127.0.0.1:9340/json')).json();}catch{}await sleep(250);}
  const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0,errors=[];const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]??'exceção');if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(String(m.params.args?.[0]?.value??'erro no console'));};
  const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
  await send('Runtime.enable');
  const routes=['inicio','receber','receber/vendas','receber/caixa','organizar/contas','organizar/metas','organizar/sugestoes','organizar/adicionar','organizar/resumo','compromissos','equipe','confianca','mais','mais/notificacoes','mais/acessibilidade','mais/preferencias'];
  const probe=`(()=>{const name=e=>(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')&&document.getElementById(e.getAttribute('aria-labelledby'))?.textContent||e.textContent||e.title||'').trim();
   return JSON.stringify({rendered:(document.getElementById('root')?.innerText.length??0)>50,overflow:document.documentElement.scrollWidth>innerWidth+1,
   unnamedButtons:[...document.querySelectorAll('button,a[href],summary')].filter(e=>e.offsetParent&&!name(e)).length,
   unlabeledFields:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e=>e.offsetParent&&!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).length,
   imagesWithoutAlt:[...document.images].filter(i=>!i.hasAttribute('alt')).length,h1:document.querySelectorAll('h1').length})})()`;
  for(const [width,height] of [[1366,768],[390,844]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
   for(const route of routes){errors=[];await send('Page.navigate',{url:`http://127.0.0.1:${port}/#${route}`});await sleep(route==='inicio'&&width===1366?3500:1500);
    const r=JSON.parse((await send('Runtime.evaluate',{expression:probe})).result.value);const problems=[!r.rendered&&'não renderizou',r.overflow&&'rolagem horizontal',r.unnamedButtons&&`${r.unnamedButtons} botão(ões) sem nome`,r.unlabeledFields&&`${r.unlabeledFields} campo(s) sem rótulo`,r.imagesWithoutAlt&&`${r.imagesWithoutAlt} imagem(ns) sem alt`,r.h1!==1&&`${r.h1} títulos h1`,...errors.map(e=>'erro: '+e)].filter(Boolean);
    report.pages.push({route,width,ok:!problems.length,problems});if(problems.length)report.ok=false;}
  }
  for(const path of ['/confirmar/'+'0'.repeat(48),'/turno/'+'0'.repeat(48)]){errors=[];await send('Page.navigate',{url:`http://127.0.0.1:${port}${path}`});await sleep(1500);const text=(await send('Runtime.evaluate',{expression:"document.body.innerText"})).result.value;const ok=/não encontrado/i.test(text)&&!errors.length;report.pages.push({route:path,width:390,ok,problems:ok?[]:['link inválido não mostrou mensagem clara']});if(!ok)report.ok=false;}
  const bad=report.pages.filter(p=>!p.ok);step(`Navegador: ${report.pages.length} telas (computador 1366 px e celular 390 px)`,!bad.length,bad.length?bad.map(p=>`${p.route}@${p.width}: ${p.problems.join(', ')}`).join(' | '):'sem erros, sem rolagem horizontal, botões e campos com nome');
  ws.close();
 }
}catch(e){step('Verificação no navegador',false,e.message);}
finally{edge?.kill();api.kill();await sleep(800);try{rmSync(temp,{recursive:true,force:true});}catch{}}

const md=[`# Verificação local — ${new Date(report.at).toLocaleString('pt-BR')}`,'',`**Resultado: ${report.ok?'APROVADO':'COM PENDÊNCIAS'}.** Tudo executado neste computador, numa cópia dos dados. Nada foi publicado.`,'',...report.steps.map(s=>`- ${s.ok?'✅':'❌'} ${s.name}${s.detail?` — ${s.detail}`:''}`),'','## Telas verificadas','',...report.pages.map(p=>`- ${p.ok?'✅':'❌'} \`${p.route}\` @ ${p.width}px${p.problems.length?' — '+p.problems.join(', '):''}`)].join('\n');
writeFileSync('auditoria/verificacao-local.json',JSON.stringify(report,null,1));writeFileSync('auditoria/verificacao-local.md',md+'\n');
console.log(`\n${report.ok?'APROVADO':'COM PENDÊNCIAS'} — detalhes em auditoria/verificacao-local.md`);process.exit(report.ok?0:1);
