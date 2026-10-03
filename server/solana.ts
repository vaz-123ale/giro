// Apenas interface nesta fase. Nenhuma conexão ou execução financeira é feita.
export interface AgreementExecutor { executeSale(saleId:string):Promise<{receipt:string}> }
export function requireLocalEndpoint(endpoint:string) {
 const url=new URL(endpoint);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!['http:','https:'].includes(url.protocol)) throw new Error('Somente validator local é permitido.');
 return url;
}
export class UnconfiguredLocalExecutor implements AgreementExecutor {
 async executeSale(_saleId:string):Promise<{receipt:string}>{throw new Error('Execução local ainda não configurada.');}
}
