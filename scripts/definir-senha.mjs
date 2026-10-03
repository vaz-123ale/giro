// Define a senha de acesso do GIRO (obrigatória para abrir o acesso externo pelo túnel).
// Uso: npm run senha   (digite a senha no terminal; ela não aparece e não fica gravada em texto)
import {createInterface} from 'node:readline';
import {setPassword} from '../server/auth.ts';
const rl=createInterface({input:process.stdin,output:process.stdout,terminal:true});
const ask=q=>new Promise(ok=>{process.stdout.write(q);let value='';const onData=c=>{const ch=c.toString();if(ch==='\r'||ch==='\n'){process.stdin.off('data',onData);process.stdout.write('\n');ok(value);}else if(ch==='\u0003'){process.exit(1);}else if(ch==='\u007f'||ch==='\b'){value=value.slice(0,-1);}else value+=ch;};process.stdin.setRawMode?.(true);process.stdin.on('data',onData);});
const a=await ask('Nova senha do GIRO (mín. 10 caracteres): ');const b=await ask('Repita a senha: ');rl.close();
if(a!==b){console.error('As senhas não conferem.');process.exit(1);}
setPassword(process.env.GIRO_DATA_DIR??'data',a);console.log('Senha definida (guardada só como hash em data/acesso.json).');process.exit(0);
