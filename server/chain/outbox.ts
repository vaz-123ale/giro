import type {DatabaseSync} from 'node:sqlite';
import type {ChainEvent} from './events.ts';

/**
 * Fila local de envio para a rede (outbox). Cada evento entra na MESMA transação SQLite da operação
 * do GIRO; o envio acontece depois, em ordem. Estados: pendente → confirmado | falhou.
 * "falhou" = a rede recusou pela regra (não adianta repetir; aparece na reconciliação).
 * Falha de conexão não muda o estado: o item continua pendente e é reenviado depois.
 */
export type OutboxStatus='pendente'|'confirmado'|'falhou';
export interface OutboxItem {id:number;createdAt:string;event:ChainEvent;status:OutboxStatus;attempts:number;error:string|null;signature:string|null;updatedAt:string}

export function ensureChainTables(db:DatabaseSync){
 db.exec(`CREATE TABLE IF NOT EXISTS chain_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', attempts INTEGER NOT NULL DEFAULT 0, error TEXT, signature TEXT, updated_at TEXT NOT NULL)`);
 db.exec('CREATE TABLE IF NOT EXISTS chain_state (name TEXT PRIMARY KEY, payload TEXT NOT NULL)');
}
export function enqueue(db:DatabaseSync,events:ChainEvent[]){
 const at=new Date().toISOString();const insert=db.prepare('INSERT INTO chain_outbox (created_at,kind,payload,updated_at) VALUES (?,?,?,?)');
 for(const e of events)insert.run(at,e.type,JSON.stringify(e),at);
}
type Row={id:number;created_at:string;payload:string;status:OutboxStatus;attempts:number;error:string|null;signature:string|null;updated_at:string};
const item=(r:Row):OutboxItem=>({id:r.id,createdAt:r.created_at,event:JSON.parse(r.payload),status:r.status,attempts:r.attempts,error:r.error,signature:r.signature,updatedAt:r.updated_at});
export const pendingItems=(db:DatabaseSync)=>(db.prepare("SELECT * FROM chain_outbox WHERE status='pendente' ORDER BY id").all() as Row[]).map(item);
export const listItems=(db:DatabaseSync,limit=200)=>(db.prepare('SELECT * FROM chain_outbox ORDER BY id DESC LIMIT ?').all(limit) as Row[]).map(item);
export const itemsFor=(db:DatabaseSync,agreementKey:string)=>(db.prepare('SELECT * FROM chain_outbox WHERE payload LIKE ? ORDER BY id').all(`%${agreementKey}%`) as Row[]).map(item);
/** Vendas já enviadas (evita mandar a mesma venda duas vezes). */
export const settledSaleRefs=(db:DatabaseSync)=>new Set((db.prepare("SELECT payload FROM chain_outbox WHERE kind='settle_sale'").all() as {payload:string}[]).map(r=>JSON.parse(r.payload).saleRef as string));
export function counts(db:DatabaseSync){
 const rows=db.prepare('SELECT status, COUNT(*) AS n FROM chain_outbox GROUP BY status').all() as {status:OutboxStatus;n:number}[];
 return {pendente:0,confirmado:0,falhou:0,...Object.fromEntries(rows.map(r=>[r.status,r.n]))} as Record<OutboxStatus,number>;
}
export function markItem(db:DatabaseSync,id:number,status:OutboxStatus,detail:{signature?:string;error?:string}={}){
 db.prepare('UPDATE chain_outbox SET status=?, attempts=attempts+1, signature=COALESCE(?,signature), error=?, updated_at=? WHERE id=?').run(status,detail.signature??null,detail.error??null,new Date().toISOString(),id);
}
export function noteAttempt(db:DatabaseSync,id:number,error:string){db.prepare('UPDATE chain_outbox SET attempts=attempts+1, error=?, updated_at=? WHERE id=?').run(error,new Date().toISOString(),id);}
export const readChainState=(db:DatabaseSync,name:string)=>{const r=db.prepare('SELECT payload FROM chain_state WHERE name=?').get(name) as {payload:string}|undefined;return r?JSON.parse(r.payload):undefined;};
export function writeChainState(db:DatabaseSync,name:string,value:unknown){db.prepare('INSERT INTO chain_state VALUES(?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload').run(name,JSON.stringify(value));}
