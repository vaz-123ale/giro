import {requireLocalEndpoint} from './solana.ts';
/**
 * Configuração única do ambiente.
 * Padrão: DESENVOLVIMENTO LOCAL (só 127.0.0.1, sem rede pública). Cada abertura exige autorização EXPLÍCITA
 * por variável de ambiente (decisão da responsável pelo projeto, 03/10/2026):
 *  - GIRO_SOLANA_CLUSTER=devnet  → exige GIRO_AUTORIZACAO_DEVNET=sim  (rede pública de TESTE)
 *  - GIRO_SOLANA_CLUSTER=mainnet → exige GIRO_AUTORIZACAO_MAINNET=sim (dinheiro REAL)
 *  - GIRO_PUBLIC_URL (túnel https) → exige GIRO_PUBLICO=sim e senha definida (npm run senha)
 * O servidor continua escutando só em 127.0.0.1; o acesso externo passa pelo túnel.
 */
const LOOPBACK=['127.0.0.1','localhost','::1'];
export type SolanaCluster='disabled'|'simulado'|'localnet'|'devnet'|'mainnet';
export interface LocalConfig {host:string;port:number;dataDir:string;allowedOrigins:string[];environment:'local';solanaRpc:string;solanaCluster:SolanaCluster;publicUrl?:string}
export const PUBLIC_RPC:Record<'devnet'|'mainnet',string>={devnet:'https://api.devnet.solana.com',mainnet:'https://api.mainnet-beta.solana.com'};

export function loadConfig(env:Record<string,string|undefined>=process.env):LocalConfig{
 const host=env.GIRO_HOST??'127.0.0.1';
 if(!LOOPBACK.includes(host))throw Error(`GIRO_HOST=${host} recusado: o servidor só escuta em 127.0.0.1 (acesso externo somente pelo túnel autorizado).`);
 const port=Number(env.GIRO_PORT??3001);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('GIRO_PORT inválida.');
 const environment=env.GIRO_ENV??'local';if(environment!=='local')throw Error(`GIRO_ENV=${environment} recusado: publicação exige autorização explícita.`);
 // disabled = sem rede (padrão) · simulado = modelo do programa neste PC · localnet = validador em 127.0.0.1 · devnet/mainnet = redes públicas (com autorização)
 const cluster=(env.GIRO_SOLANA_CLUSTER??'disabled') as SolanaCluster;
 if(!['disabled','simulado','localnet','devnet','mainnet'].includes(cluster))throw Error(`GIRO_SOLANA_CLUSTER=${cluster} recusado.`);
 if(cluster==='devnet'&&env.GIRO_AUTORIZACAO_DEVNET!=='sim')throw Error('GIRO_SOLANA_CLUSTER=devnet recusado: falta GIRO_AUTORIZACAO_DEVNET=sim (autorização explícita).');
 if(cluster==='mainnet'&&env.GIRO_AUTORIZACAO_MAINNET!=='sim')throw Error('GIRO_SOLANA_CLUSTER=mainnet recusado: dinheiro REAL exige GIRO_AUTORIZACAO_MAINNET=sim (autorização explícita).');
 let solanaRpc=env.GIRO_SOLANA_RPC??(cluster==='devnet'||cluster==='mainnet'?PUBLIC_RPC[cluster]:'http://127.0.0.1:8899');
 if(cluster==='devnet'||cluster==='mainnet'){if(new URL(solanaRpc).protocol!=='https:')throw Error('RPC de rede pública precisa ser https.');}
 else if(env.GIRO_SOLANA_RPC)requireLocalEndpoint(env.GIRO_SOLANA_RPC);
 solanaRpc=String(solanaRpc);
 for(const key of ['GIRO_DEPLOY','GIRO_REMOTE_DB'])if(env[key])throw Error(`${key} recusado: não publicar nem usar serviços externos sem autorização.`);
 let publicUrl:string|undefined;
 if(env.GIRO_PUBLIC_URL){
  if(env.GIRO_PUBLICO!=='sim')throw Error('GIRO_PUBLIC_URL recusado: falta GIRO_PUBLICO=sim (autorização explícita para acesso externo).');
  const u=new URL(env.GIRO_PUBLIC_URL);if(u.protocol!=='https:')throw Error('GIRO_PUBLIC_URL precisa ser https (túnel).');publicUrl=u.origin;
 }
 const allowedOrigins=[...new Set([5173,port].flatMap(p=>[`http://127.0.0.1:${p}`,`http://localhost:${p}`])),...(publicUrl?[publicUrl]:[])];
 return {host:host==='localhost'?'127.0.0.1':host,port,dataDir:env.GIRO_DATA_DIR??'data',allowedOrigins,environment:'local',solanaCluster:cluster,solanaRpc,...(publicUrl?{publicUrl}:{})};
}
