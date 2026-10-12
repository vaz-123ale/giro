// Cena fictícia para o slide "GIRO funcionando na prática": João R$ 600 a 20%, Pedro 8% em turno,
// depois UMA venda de R$ 100 registrada pelo sistema. Captura telas reais ANTES e DEPOIS (Edge local).
// Base própria em apresentacao/dados-cena, porta 3020. Dados reais não são tocados. Nada sai do PC.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir='apresentacao/dados-cena',port='3020',base=`http://127.0.0.1:${port}`,out='apresentacao/prints/cena';
rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});mkdirSync(out,{recursive:true});
const db=new DatabaseSync(`${dir}/giro.sqlite`);db.exec('CREATE TABLE local_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)');
db.prepare('INSERT INTO local_state VALUES(1,?)').run(JSON.stringify({schemaVersion:4,demo:false,sales:[],commitments:[],plans:[],members:[]}));db.close();
const api=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:dir,GIRO_PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise(ok=>api.stdout.once('data',ok));
const post=async(path,body)=>{const r=await fetch(`${base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(`${path}: ${d.error}`);return d;};
const day=n=>new Date(Date.now()-3*3600000+n*86400000).toISOString().slice(0,10);

let s=await post('contacts',{name:'João',type:'supplier'});const joao=s.contacts[0];
s=await post('invitations/send',{contactId:joao.id,debtAmount:60000,rateBps:2000,priority:1,due:day(7),acknowledged:true});
await post('invitations/decision',{token:s.invitations[0].token,decision:'accept',acknowledged:true});
s=await post('members',{name:'Pedro',compensation:'commission',commissionBps:800,participationMode:'automatic'});
await post('shift',{id:s.members[0].id});

// --- navegador
const profile=join(tmpdir(),'giro-cena-'+Date.now());
const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--hide-scrollbars','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9370',`--user-data-dir=${profile}`,'--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--disable-domain-reliability','--disable-breakpad','about:blank']);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let t;
for(let i=0;i<60&&!t?.find(x=>x.type==='page');i++){try{t=await (await fetch('http://127.0.0.1:9370/json')).json();}catch{}await sleep(250);}
const ws=new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const js=async expr=>(await send('Runtime.evaluate',{expression:`(async()=>{${expr}})()`,awaitPromise:true,returnByValue:true})).result?.value;
await send('Emulation.setDeviceMetricsOverride',{width:430,height:1800,deviceScaleFactor:3,mobile:true});
await send('Page.navigate',{url:base+'/#inicio'});await sleep(1500);await js(`localStorage.setItem('giro-ui-prefs',JSON.stringify({name:'Maria'}))`);
// Captura a tela inteira e devolve os retângulos (px CSS da janela) dos seletores pedidos.
async function capture(name,path,prep,selectors){
 await send('Page.navigate',{url:'about:blank'});await sleep(150);await send('Page.navigate',{url:base+path});await sleep(2500);
 if(prep)await js(prep);await sleep(600);
 const rects=await js(`return JSON.stringify(Object.fromEntries(${JSON.stringify(selectors)}.map(([k,sel])=>{const [q,n=0]=Array.isArray(sel)?sel:[sel,0];const el=document.querySelectorAll(q)[n];const r=el?.getBoundingClientRect();return [k,r?{x:r.x,y:r.y,w:r.width,h:r.height}:null];})))`);
 const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`${out}/${name}.png`,Buffer.from(shot.data,'base64'));
 writeFileSync(`${out}/${name}.json`,rects);console.log('✔',name,rects);
}
const openJoao=`const card=[...document.querySelectorAll('.obligation-card')].find(c=>c.querySelector('h3')?.textContent==='João');card.querySelector('.details-toggle').click();await new Promise(r=>setTimeout(r,500));card.scrollIntoView({block:'start'});window.scrollBy(0,-16);`;
await capture('antes-compromisso','/#compromissos',openJoao,[['values','.obligation-card .obligation-values'],['meta','.obligation-card .obligation-meta p'],['pill','.obligation-card .proposal-pill'],['regra',['.obligation-card .detail-grid > p',2]],['vencimento',['.obligation-card .detail-grid > p',3]],['prioridade',['.obligation-card .detail-grid > p',4]]]);

// --- a venda de R$ 100, registrada pelo sistema
s=await post('sales',{amount:10000,method:'digital',soldAt:day(0),paidAt:day(0)});const sale=s.sales[0];
await capture('depois-inicio','/#inicio','',[['balance','.reference-home .balance'],['stats','.reference-home .stats']]);
await capture('depois-recibo','/#receber/vendas/'+sale.id,`document.querySelector('.sale-receipt')?.scrollIntoView({block:'start'});window.scrollBy(0,-16);`,[['amount','.sale-receipt .receipt-amount'],['eyebrow','.sale-receipt .receipt-heading .eyebrow'],['title','.sale-receipt .receipt-distribution h4'],['pedro',['.sale-receipt .receipt-destination',0]],['joao',['.sale-receipt .receipt-destination',1]],['joaoId',['.sale-receipt .receipt-destination:nth-of-type(2) p',2]],['livre',['.sale-receipt .receipt-destination',2]]]);
await capture('depois-compromisso','/#compromissos',openJoao,[['values','.obligation-card .obligation-values']]);

ws.close();edge.kill();api.kill();await sleep(600);try{rmSync(profile,{recursive:true,force:true});}catch{}
writeFileSync(`${out}/venda.json`,JSON.stringify({saleId:sale.id,distribution:sale.distribution.map(e=>({kind:e.kind,recipient:e.recipient,amount:e.amount,remainingAfter:e.remainingAfter}))},null,1));
console.log('Venda registrada:',JSON.stringify(sale.distribution.map(e=>[e.recipient,e.amount/100,e.remainingAfter!==undefined?e.remainingAfter/100:''])));
process.exit(0);
