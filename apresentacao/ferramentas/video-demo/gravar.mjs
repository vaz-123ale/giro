// Grava a demonstração do GIRO seguindo o roteiro de 13 cenas. Esperas de rede ficam fora da gravação (pausa).
// Uso: node gravar.mjs BASE_URL PASTA_SAIDA [cenas, ex.: 1,2,3]
import {browser,sleep} from './cdp.mjs';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
const base=process.argv[2],out=resolve(process.argv[3]??'rec'),only=process.argv[4]?.split(',').map(Number);
const W=1440,H=810,SCALE=4/3,senha='giro-demo-2026';
mkdirSync(out,{recursive:true});
const b=await browser({width:W,height:H,scale:SCALE});
const desktop=()=>b.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:SCALE,mobile:false});
const phone=()=>b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await b.send('Page.setInterceptFileChooserDialog',{enabled:true});

// ---------- ajudas dentro da página: cursor, clique, destaque, digitação ----------
const INJECT=`if(!window.__d){
 const css=document.createElement('style');css.textContent=\`
 #__cur{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;transition:transform .7s cubic-bezier(.45,0,.2,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
 .__rip{position:fixed;z-index:2147483646;pointer-events:none;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #f5a524;animation:__r .55s ease-out forwards}
 @keyframes __r{to{transform:scale(3.4);opacity:0}}
 #__hl{position:fixed;z-index:2147483645;pointer-events:none;border:3px solid #f5a524;border-radius:18px;box-shadow:0 0 0 6px rgba(245,165,36,.22),0 0 0 200vmax rgba(8,30,24,.30);transition:opacity .35s ease;opacity:0}
 html{scroll-behavior:auto!important}\`;document.head.append(css);
 const c=document.createElement('div');c.id='__cur';c.innerHTML='<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 11-6.5 1.2L16.5 21l-3 1.4-3.8-6.8L4 20z" fill="#0b2b22" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';document.body.append(c);
 const p=JSON.parse(sessionStorage.getItem('__cur')||'[720,520]');c.style.transition='none';c.style.transform='translate('+p[0]+'px,'+p[1]+'px)';c.offsetWidth;c.style.transition='';
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const Z=()=>parseFloat(getComputedStyle(document.documentElement).zoom)||1;
 const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
 const q=([s,t,i=0,up=0])=>{let els=[...document.querySelectorAll(s)].filter(vis);if(t){const x=t.toLowerCase();els=els.filter(e=>e.textContent.toLowerCase().includes(x)).sort((a,b)=>a.textContent.length-b.textContent.length);}
  let e=els[i];if(!e)throw Error('Não achei '+s+' '+(t||''));if(up){let k=e;while(k&&k!==document.body&&!(card(k)&&k.getBoundingClientRect().height>=up))k=k.parentElement;if(k&&k!==document.body)e=k;}return e;};
 const card=e=>{const st=getComputedStyle(e);const bg=st.backgroundColor;return (bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')||st.backgroundImage!=='none'||parseFloat(st.borderTopWidth)>0||st.boxShadow!=='none';};
 const to=(x,y)=>{x/=Z();y/=Z();c.style.transform='translate('+x+'px,'+y+'px)';sessionStorage.setItem('__cur',JSON.stringify([x,y]));};
 window.confirm=()=>true;
 window.__d={q,wait,
  move:async(f,ms=750)=>{const r=q(f).getBoundingClientRect();to(r.left+Math.min(r.width/2,90),r.top+r.height/2);await wait(ms);},
  click:async(f)=>{await __d.move(f);const r=c.getBoundingClientRect(),z=Z();const k=document.createElement('div');k.className='__rip';k.style.left=r.left/z+5+'px';k.style.top=r.top/z+4+'px';document.body.append(k);setTimeout(()=>k.remove(),700);await wait(160);const e=q(f);e.focus?.();e.click();await wait(250);},
  type:async(f,v,ms=95)=>{await __d.click(f);const e=q(f);const set=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value').set;for(let i=1;i<=v.length;i++){set.call(e,v.slice(0,i));e.dispatchEvent(new Event('input',{bubbles:true}));await wait(ms);}},
  select:async(f,idx)=>{await __d.move(f);let e=q(f);if(e.tagName!=='SELECT')e=e.querySelector('select')||e.parentElement.querySelector('select');const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(e,e.options[idx].value);e.dispatchEvent(new Event('change',{bubbles:true}));await wait(500);},
  scroll:async(f,off=110,ms=1000)=>{const e=q(f);const y=e.getBoundingClientRect().top+scrollY-off;__d.smooth(y,ms*0.8);await wait(ms);},
  scrollY:async(y,ms=1000)=>{__d.smooth(y,ms*0.8);await wait(ms);},
  smooth:(y,dur)=>{const y0=scrollY,t0=performance.now();const step=t=>{const k=Math.min(1,(t-t0)/dur),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;scrollTo(0,y0+(y-y0)*e);if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);},
  hl:async(f,ms=900,pad=8)=>{let h=document.getElementById('__hl');if(!h){h=document.createElement('div');h.id='__hl';document.body.append(h);}
   __d.target=q(f);__d.pad=pad;if(!__d.loop){__d.loop=true;const tick=()=>{const h=document.getElementById('__hl');if(h&&__d.target&&__d.target.isConnected){const r=__d.target.getBoundingClientRect(),p=__d.pad;
     const z=Z(),top=Math.max(r.top-p,4),bot=Math.min(r.bottom+p,innerHeight*z-4);Object.assign(h.style,{left:(r.left-p)/z+'px',top:top/z+'px',width:(r.width+2*p)/z+'px',height:Math.max(0,bot-top)/z+'px'});}requestAnimationFrame(tick);};requestAnimationFrame(tick);}
   h.style.opacity=1;await wait(ms);},
  unhl:async(ms=400)=>{const h=document.getElementById('__hl');if(h)h.style.opacity=0;await wait(ms);__d.target=null;},
 };
}`;
const inject=()=>b.js(INJECT);
let nchk=0;mkdirSync(`${out}/conferir`,{recursive:true});
const d=async(fn,...args)=>{const r=await b.js(`return await __d.${fn}(...${JSON.stringify(args)})`);if(fn==='hl'){const s=await b.send('Page.captureScreenshot',{format:'jpeg',quality:70});writeFileSync(`${out}/conferir/${String(cur?.n??0).padStart(2,'0')}-${String(++nchk).padStart(3,'0')}.jpg`,Buffer.from(s.data,'base64'));}return r;};
const F=(s,t,i=0,up=0)=>[s,t??null,i,up];
const hold=ms=>sleep(ms);
// espera um seletor/texto aparecer (fora da gravação)
async function ready(test,timeout=90000){const t0=Date.now();for(;;){try{if(await b.js(`return !!(${test})`))break;}catch{}if(Date.now()-t0>timeout)throw Error('Tempo esgotado: '+test);await sleep(300);}await sleep(900);await inject();}
const has=t=>`document.body&&document.body.innerText.includes(${JSON.stringify(t)})`;
async function open(url,test){await b.go(url,600);await ready(test);}

// ---------- gravação: quadros do screencast; pausa corta as esperas ----------
const scenes=[];let cur=null,clip=null;
b.on(m=>{if(m.method!=='Page.screencastFrame')return;b.send('Page.screencastFrameAck',{sessionId:m.params.sessionId});
 if(!clip)return;const f=`${out}/s${String(cur.n).padStart(2,'0')}-c${cur.clips.length}-${String(clip.frames.length).padStart(5,'0')}.jpg`;
 writeFileSync(f,Buffer.from(m.params.data,'base64'));clip.frames.push({f,t:Date.now()/1000});});
async function resume(kind='desktop'){
 clip={kind,frames:[],t0:Date.now()/1000};const [mw,mh]=kind==='phone'?[780,1688]:[1920,1080];
 const s=await b.send('Page.captureScreenshot',{format:'jpeg',quality:90});const f=`${out}/s${String(cur.n).padStart(2,'0')}-c${cur.clips.length}-first.jpg`;writeFileSync(f,Buffer.from(s.data,'base64'));clip.frames.push({f,t:clip.t0});
 await b.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:mw,maxHeight:mh,everyNthFrame:1});}
async function pause(){await sleep(60);await b.send('Page.stopScreencast');clip.t1=Date.now()/1000;cur.clips.push(clip);clip=null;}
async function login(kindIdx,user){
 await open(base+'/entrar?lang=en',has('Which account'));
 await resume();await hold(500);
 await d('scroll',F('h2','Which account'),40,900);
 await d('click',F('.login-choice button',null,kindIdx));
 await d('type',F('input[autocomplete=username]'),user,90);
 await d('type',F('input[type=password]'),senha,55);
 await d('click',F('form button.primary'));
 await pause();
}
async function logout(){await b.js(`await fetch('/api/sair',{method:'POST'});`);}

const SCENES={
 1:async()=>{await login(0,'dona');await ready(has('Free to use'));await resume();await hold(5200);},
 2:async()=>{await resume();
  await d('move',F('.reference-home .balance'));await d('hl',F('.reference-home .balance'),2200);
  await d('move',F('.stat.mint'));await d('hl',F('.stat.mint'),1900);
  await d('move',F('.stat.destination'));await d('hl',F('.stat.destination'),2100);
  await d('move',F('.money-overview'));await d('hl',F('.money-overview'),2600);await d('unhl',600);await pause();},
 3:async()=>{await resume();
  await d('click',F('aside button, aside a','Receive'));await hold(900);await inject();
  await d('scroll',F('h2','Fixed stall QR code'),24,1100);await d('hl',F('*','Fixed stall QR code',0,300),2200);await d('unhl',200);
  await d('move',F('button','Print QR'));await d('hl',F('button','Print QR'),1200);await d('move',F('a','customer'));await d('hl',F('a','customer'),1200);await pause();
  await phone();await open(base+'/barraca?lang=en',has('How much'));await resume('phone');await hold(700);
  await d('type',F('input'),'18,50',180);await hold(500);await d('hl',F('button',null,4,0),1600);await hold(900);await pause();
  await desktop();await open(base+'/#compromissos',has('Showing'));},
 4:async()=>{await resume();await hold(500);
  await d('click',F('button','Import debts'));await hold(500);await inject();
  await d('scroll',F('.import-debts h2'),90,900);await d('click',F('.import-debts summary'));await hold(1300);
  await d('move',F('.import-debts button','template'));await d('hl',F('.import-debts button','template'),1300);
  await d('move',F('.import-debts label','file'));await d('hl',F('.import-debts label','file'),900);await d('unhl',200);
  const {root}=await b.send('DOM.getDocument',{depth:-1});const {nodeId}=await b.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.import-debts input[type=file]'});
  await b.send('DOM.setFileInputFiles',{nodeId,files:[resolve('dividas-exemplo.csv')]});await hold(1200);
  await d('scroll',F('.import-debts table'),180,1000);await d('hl',F('.import-debts table'),3200);await d('unhl',300);await pause();
  await open(base+'/#compromissos',has('Showing'));},
 5:async()=>{await resume();await hold(400);
  await d('scroll',F('h2','Commitments with suppliers'),20,1000);
  await d('hl',F('.obligation-card'),2000);await d('unhl',200);
  await d('click',F('.obligation-card .details-toggle'));await hold(600);await inject();
  await d('scroll',F('.obligation-card .detail-grid'),180,900);await d('hl',F('.obligation-card .detail-grid'),2600);await d('unhl',200);
  await d('scrollY',0,900);await d('select',F('label, div','Financial status',0,60),2);await d('hl',F('*','Showing',0,0),1800);await d('unhl',300);await pause();},
 6:async()=>{await resume();
  await d('click',F('aside button, aside a','Organize'));await hold(700);await inject();await d('click',F('.tabs button, .tabs a','Goals'));await hold(800);
  await d('hl',F('*','Family trip',0,120),2000);await d('unhl',200);
  await d('click',F('button','Pause'));await hold(900);await d('hl',F('*','Family trip',0,120),1200);await d('unhl',200);
  await d('click',F('button','Resume'));await hold(600);
  await d('hl',F('*','Emergency reserve',0,120),2000);await d('unhl',300);await pause();},
 7:async()=>{await resume();
  await d('click',F('aside button, aside a','Trust'));await hold(900);await inject();
  await d('hl',F('*','Verifiable agreement history',0,560),3200);await d('unhl',200);
  await d('scroll',F('h2','Supplier trust'),30,1000);await d('hl',F('*','Supplier trust',0,320),2000);await d('unhl',200);
  await d('scrollY',0,700);await d('click',F('.profile-button'));await hold(500);await inject();const href=await b.js(`return __d.q(${JSON.stringify(F('.profile-menu a','public profile'))}).href`);await d('move',F('.profile-menu a','public profile'));await d('hl',F('.profile-menu a','public profile'),700);await pause();
  await open(href,has('Share this profile'));await resume();await hold(1500);await d('scrollY',420,1500);await hold(1500);await pause();},
 8:async()=>{await logout();await login(1,'joao');await ready(has('Needs your attention'));await resume();
  await hold(500);await d('hl',F('.supplier-hero dl'),1700);await d('unhl',200);
  await d('scroll',F('h2','Needs your attention'),320,900);await d('hl',F('.supplier-todo'),1500);await d('unhl',200);
  await d('click',F('nav button, nav a','Agreements'));await hold(500);await inject();await d('scroll',F('.supplier-agreements'),300,700);await d('hl',F('.supplier-agreements li'),1300);await d('unhl',200);await pause();},
 9:async()=>{await resume();
  await d('click',F('nav button, nav a','My trust'));await hold(500);await inject();await d('hl',F('*','Verifiable agreement history',0,500),2200);await d('unhl',200);
  await d('click',F('nav button, nav a','Account'));await hold(500);await inject();await d('scroll',F('h2','invite code'),350,800);await d('hl',F('*','My invite code',0,200),1500);await d('unhl',200);
  await d('click',F('nav button, nav a','Helpers'));await hold(500);await inject();await d('hl',F('*','Looking for a helper',0,200),1600);await d('unhl',200);
  await d('scroll',F('*','Interested (',0,0),450,900);await d('hl',F('*','Interested (',0,120),1600);await d('unhl',200);await pause();},
 10:async()=>{await logout();await login(2,'lia');await ready(has('Helper jobs'));await resume();
  await hold(400);await d('scroll',F('h2','Helper jobs'),270,900);await d('hl',F('*','Your experience is checked',0,0),2000);await d('unhl',200);
  await d('hl',F('*','Requires',0,0),1500);await d('hl',F('*','meets the rules',0,0),1300);await d('unhl',200);
  await d('click',F('button','interested'));await hold(900);
  await d('scroll',F('h2','Looking for work'),270,1100);await d('hl',F('*','Looking for work',0,260),2000);await d('unhl',300);await pause();},
 11:async()=>{await resume();
  await d('click',F('nav button, nav a','My work'));await hold(600);await inject();
  await d('hl',F('.supplier-hero, .people-hero, section','Hi, Lia',0,0),1600);await d('unhl',200);
  await d('scroll',F('h2','Where I work'),270,900);await d('hl',F('*','Where I work',0,200),3200);await d('unhl',200);
  await d('scroll',F('*','Shift history',0,0),270,900);await d('hl',F('*','Completed shifts',0,90),2400);await d('unhl',200);
  await d('scrollY',99999,1200);await hold(800);await pause();},
 12:async()=>{await resume();
  await d('click',F('nav button, nav a','My purchases'));await hold(600);await inject();
  await d('hl',F('*','Total spent',0,0),1800);await d('unhl',200);
  await d('scroll',F('*','Purchase history',0,0),270,1100);await hold(900);
  await d('click',F('nav button, nav a','Account'));await hold(500);await inject();await d('hl',F('.profile-head'),1500);await d('unhl',200);
  await d('scroll',F('h2','invite code'),350,800);await d('hl',F('*','My invite code',0,200),1500);await d('unhl',200);await pause();},
 13:async()=>{await resume();await d('scrollY',0,600);await d('click',F('a','public profile'));await pause();
  await ready(has('Share this profile'));await resume();await hold(1200);await d('scrollY',360,1600);await hold(3200);await pause();},
};
writeFileSync('dividas-exemplo.csv','﻿Nome;Tipo;Valor;Vencimento;% das vendas\nDistribuidora Sol;Fornecedor;600,00;30/11/2026;5\nAna Embalagens;Fornecedor;350,00;20/11/2026;3\nFrutas do Vale;Fornecedor;900,00;15/12/2026;5\nPedro Alves;Ajudante;200,00;15/11/2026;2\n');
await open(base+'/entrar?lang=en',has('Which account'));
for(let n=1;n<=13;n++){
 if(only&&!only.includes(n))continue;
 cur={n,clips:[]};scenes.push(cur);const t=Date.now();
 if(only&&n!==1&&n!==8&&n!==10&&!(only.includes(n-1))){/* cena isolada: entra na conta certa */
  const [k,u,url,test]=n<8?[0,'dona',n===4||n===5?'/#compromissos':'/#inicio',n===4||n===5?'Showing':'Free to use']:n===9?[1,'joao','/eu#painel','Needs your attention']:[2,'lia','/eu#vagas','Helper jobs'];
  await logout();await open(base+'/entrar?lang=en',has('Which account'));await b.js(`await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:'${u}',senha:'${senha}',tipo:'${['barraca','fornecedor','equipe'][k]}'})});`);
  await open(base+url,has(test));}
 try{await SCENES[n]();if(clip)await pause();}catch(e){console.error('cena',n,e.message);if(clip)await pause();await b.shot(`${out}/erro-${n}.png`);}
 const len=cur.clips.reduce((a,c)=>a+c.t1-c.t0,0);console.log(`cena ${n}: ${len.toFixed(1)}s gravados em ${cur.clips.length} trecho(s) (${((Date.now()-t)/1000).toFixed(0)}s reais)`);
}
writeFileSync(`${out}/cenas-gravadas.json`,JSON.stringify(scenes,null,1));
await b.close();process.exit(0);
