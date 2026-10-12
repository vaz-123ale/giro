// Tira os prints da demonstração no Edge local (sem rede de fundo), a partir da base fictícia na porta 3019.
// Uso: node apresentacao/ferramentas/capturar-prints.mjs   (requer montar-demo.mjs rodando)
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const base='http://127.0.0.1:3019',out='apresentacao/prints',links=JSON.parse(readFileSync('apresentacao/dados-demo/links.json','utf8'));
mkdirSync(out,{recursive:true});const profile=join(tmpdir(),'giro-prints-'+Date.now());
const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--hide-scrollbars','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9350',`--user-data-dir=${profile}`,'--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--disable-domain-reliability','--disable-breakpad','about:blank']);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let targets;
for(let i=0;i<60&&!targets?.find(t=>t.type==='page');i++){try{targets=await (await fetch('http://127.0.0.1:9350/json')).json();}catch{}await sleep(250);}
const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const js=expression=>send('Runtime.evaluate',{expression:`(async()=>{${expression}})()`,awaitPromise:true});
await send('Page.navigate',{url:base+'/#inicio'});await sleep(2000);
await js(`localStorage.setItem('giro-ui-prefs',JSON.stringify({name:'Maria'}))`);
const typeIn=`const set=(el,v)=>{const p=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;p.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};const wait=ms=>new Promise(r=>setTimeout(r,ms));const click=t=>[...document.querySelectorAll('button,summary')].find(b=>b.textContent.trim().startsWith(t))?.click();`;
const shots=[
 ['01-inicio','/#inicio'],
 ['02-notificacoes','/#inicio',`document.querySelector('.notification-button').click();await wait(600);`],
 ['03-receber','/#receber'],
 ['04-para-onde-vai','/#receber',`await wait(800);document.querySelector('.sale-preview').scrollIntoView({block:'start'});window.scrollBy(0,-20);`],
 ['05-venda-dinheiro','/#receber/cash'],
 ['06-caixa','/#receber/caixa'],
 ['07-vendas','/#receber/vendas'],
 ['08-contas','/#organizar/contas'],
 ['09-metas-sugestao','/#organizar/metas',`document.querySelector('.pace-note')?.scrollIntoView({block:'center'});`],
 ['10-importar','/#organizar/adicionar',`const t=document.querySelector('.document-import textarea');set(t,'Fornecedor João — R$ 600 — vencimento em 08/10\\nAluguel R$ 900 10/10\\nEnergia;184,70;14/10\\nEnergia;190,10;14/11');await wait(200);click('Ler texto');await wait(500);document.querySelector('.import-review').scrollIntoView({block:'start'});window.scrollBy(0,-90);`],
 ['11-resumo','/#organizar/resumo'],
 ['12-compromissos','/#compromissos'],
 ['13-novo-compromisso','/#compromissos/novo'],
 ['14-convite-fornecedor','/convite/'+links.invitationAna,'',[1440,900]],
 ['15-equipe','/#equipe',`document.querySelector('.shift-tools')?.setAttribute('open','');`],
 ['16-checkin-trabalhador','/turno/'+links.carlaToken,'',[390,844]],
 ['17-confirmar-recebimento','/confirmar/'+links.receiptJoao,'',[390,844]],
 ['18-confianca','/#confianca'],
 ['19-contatos','/#mais/contatos'],
 ['20-acessibilidade','/#mais/acessibilidade'],
 ['21-celular-inicio','/#inicio','',[390,844]],
 ['22-celular-receber','/#receber','',[390,844]],
];
for(const [name,path,action='',[w,h]=[1440,900]] of shots){
 await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:w<700?2:1.25,mobile:w<700});
 await send('Page.navigate',{url:'about:blank'});await sleep(150);await send('Page.navigate',{url:base+path});await sleep(2600);
 if(action)await js(typeIn+action);await sleep(500);
 const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`${out}/${name}.png`,Buffer.from(shot.data,'base64'));console.log('✔',name);
}
ws.close();edge.kill();await sleep(500);try{rmSync(profile,{recursive:true,force:true});}catch{}process.exit(0);
