import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {loadConfig} from '../server/config.ts';
import {integrationPoints} from '../src/domain/integration.ts';

/** Regra do projeto: desenvolvimento privado e local. Estes testes falham se algo tentar sair do computador. */
const files=(dir:string):string[]=>readdirSync(dir).flatMap(n=>{const p=join(dir,n);return statSync(p).isDirectory()?files(p):[p];});
const code=[...files('src'),...files('server'),'index.html','vite.config.ts'].filter(f=>/\.(tsx?|html|css|mjs)$/.test(f));

test('Configuração recusa host público, rede Solana pública e publicação SEM autorização explícita', ()=>{
 assert.equal(loadConfig({}).host,'127.0.0.1');assert.equal(loadConfig({}).solanaCluster,'disabled');
 assert.equal(loadConfig({GIRO_SOLANA_CLUSTER:'localnet'}).solanaCluster,'localnet');
 for(const env of [{GIRO_HOST:'0.0.0.0'},{GIRO_HOST:'192.168.0.10'},{GIRO_ENV:'production'},{GIRO_SOLANA_CLUSTER:'devnet'},{GIRO_SOLANA_CLUSTER:'mainnet'},{GIRO_SOLANA_CLUSTER:'mainnet',GIRO_AUTORIZACAO_DEVNET:'sim'},{GIRO_SOLANA_CLUSTER:'mainnet-beta'},{GIRO_PUBLIC_URL:'https://giro.app'},{GIRO_PUBLIC_URL:'http://x.trycloudflare.com',GIRO_PUBLICO:'sim'},{GIRO_SOLANA_CLUSTER:'devnet',GIRO_AUTORIZACAO_DEVNET:'sim',GIRO_SOLANA_RPC:'http://rpc.exemplo'},{GIRO_SOLANA_CLUSTER:'localnet',GIRO_SOLANA_RPC:'https://api.devnet.solana.com'},{GIRO_DEPLOY:'vercel'},{GIRO_REMOTE_DB:'postgres://x'}])
  assert.throws(()=>loadConfig(env),/recusado|https|Somente validator local/,JSON.stringify(env));
 assert.deepEqual(loadConfig({GIRO_PORT:'3009'}).allowedOrigins.every(o=>o.startsWith('http://127.0.0.1:')||o.startsWith('http://localhost:')),true);
 // Com autorização explícita (decisão de 03/10/2026): Devnet e túnel https; o servidor continua só em 127.0.0.1.
 const d=loadConfig({GIRO_SOLANA_CLUSTER:'devnet',GIRO_AUTORIZACAO_DEVNET:'sim',GIRO_PUBLIC_URL:'https://abc.trycloudflare.com',GIRO_PUBLICO:'sim'});
 assert.deepEqual([d.solanaCluster,d.host,d.publicUrl,d.solanaRpc],['devnet','127.0.0.1','https://abc.trycloudflare.com','https://api.devnet.solana.com']);
 assert.ok(d.allowedOrigins.includes('https://abc.trycloudflare.com'));
});
/** Únicos endereços externos permitidos no código: os RPCs públicos oficiais da Solana (usados só com autorização). */
const ALLOWED_EXTERNAL=/^https:\/\/api\.(devnet|mainnet-beta)\.solana\.com$/;
test('Código não referencia endereços externos (exceto RPC oficial da Solana, só com autorização)', ()=>{
 for(const f of code){const found=(readFileSync(f,'utf8').match(/https?:\/\/[a-z0-9.-]+/gi)??[]).filter(u=>!/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(u)&&!/w3\.org/i.test(u)&&!ALLOWED_EXTERNAL.test(u));assert.deepEqual(found,[],f);}
});
test('Servidores escutam só em 127.0.0.1 e a página só conversa com a própria origem', ()=>{
 assert.match(readFileSync('vite.config.ts','utf8'),/host:'127\.0\.0\.1'/);
 const index=readFileSync('server/index.ts','utf8');assert.match(index,/server\.listen\(config\.port,config\.host/);assert.match(index,/connect-src 'self'/);
});
test('Sem scripts de publicação, deploy ou repositório remoto', ()=>{
 const scripts=JSON.stringify(JSON.parse(readFileSync('package.json','utf8')).scripts);
 for(const word of ['deploy','publish','vercel','netlify','firebase','gh ','git push','mainnet'])assert.equal(scripts.includes(word),false,word);
 // Código publicado no GitHub com autorização (03/10/2026): só remoto do github.com; dados e chaves ficam fora (.gitignore).
 if(existsSync('.git/config'))for(const url of readFileSync('.git/config','utf8').match(/url = .+/g)??[])assert.match(url,/github\.com/,url);
 for(const secret of ['data/','backups/','solana/keys/','auditoria/historico/','*.sqlite'])assert.ok(readFileSync('.gitignore','utf8').includes(secret),`.gitignore precisa conter ${secret}`);
});
test('Mapa de integrações: cada ponto futuro aponta para um módulo local existente e exige autorização', ()=>{
 for(const p of integrationPoints){assert.ok(p.authorization.length>0,p.id);for(const m of p.module.split('·').map(s=>s.trim().split(' ')[0]))assert.ok(existsSync(m),`${p.id}: ${m}`);}
});
