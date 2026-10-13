// Edge headless controlado por CDP: navegação, JS, capturas e screencast.
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function browser({port=9381,width=1440,height=810,scale=4/3}={}){
 const profile=mkdtempSync(join(tmpdir(),'giro-rec-'));
 const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--hide-scrollbars','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--disable-breakpad','--lang=en-US',`--window-size=${width},${height}`,'about:blank']);
 let t;for(let i=0;i<80&&!t?.find(x=>x.type==='page');i++){try{t=await (await fetch(`http://127.0.0.1:${port}/json`)).json();}catch{}await sleep(250);}
 const ws=new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let id=0;const pend=new Map(),listeners=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.error?{error:m.error}:m.result);pend.delete(m.id);}else if(m.method)for(const l of listeners)l(m);};
 const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
 await send('Page.enable');await send('Network.enable');if(process.env.ORIGEM)await send('Network.setExtraHTTPHeaders',{headers:{Origin:process.env.ORIGEM}});await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:scale,mobile:false});
 const js=async expr=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${expr}})()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const go=async(url,wait=2500)=>{await send('Page.navigate',{url});await sleep(wait);};
 const shot=async(file,fmt='png')=>{const {writeFileSync}=await import('node:fs');const s=await send('Page.captureScreenshot',{format:fmt,quality:fmt==='jpeg'?92:undefined});writeFileSync(file,Buffer.from(s.data,'base64'));};
 const close=async()=>{ws.close();edge.kill();await sleep(600);try{rmSync(profile,{recursive:true,force:true});}catch{}};
 return {send,js,go,shot,close,on:f=>listeners.push(f),off:f=>listeners.splice(listeners.indexOf(f),1)};
}
