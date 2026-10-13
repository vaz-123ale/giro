import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const {dir,port}=JSON.parse(readFileSync('apresentacao/dados-demo/gravacao-atual.json','utf8'));
// Login normal, mas escuta só no loopback. Nenhum Funnel ou proxy público.
const child=spawn(process.execPath,['--experimental-strip-types','--no-warnings','server/index.ts'],{stdio:'inherit',env:{...process.env,GIRO_DATA_DIR:dir,GIRO_PORT:String(port),GIRO_PUBLIC_URL:`https://localhost:${port}`,GIRO_PUBLICO:'sim',GIRO_SOLANA_CLUSTER:'simulado',GIRO_DEMO_PUBLICA:'sim'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());
child.on('exit',c=>process.exit(c??0));
