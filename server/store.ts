import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { State } from '../src/domain/models.ts';
import { today } from '../src/domain/finance.ts';
import {migrateState} from './migration.ts';
const directory=process.env.GIRO_DATA_DIR??'data';
mkdirSync(directory,{recursive:true});
const db=new DatabaseSync(join(directory,'giro.sqlite'));
db.exec('CREATE TABLE IF NOT EXISTS local_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS local_state_backups (version INTEGER PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL)');
export function save(state:State){db.prepare('INSERT INTO local_state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(JSON.stringify(state));}
export function read():State {const row=db.prepare('SELECT payload FROM local_state WHERE id=1').get() as {payload:string}|undefined;return row?JSON.parse(row.payload):seed();}
/** Gancho chamado DENTRO da mesma transação (ex.: fila de envio da rede). Só existe com a rede ligada. */
export type UpdateHook=(before:State,after:State,database:DatabaseSync)=>void;
const hooks:UpdateHook[]=[];
export function addUpdateHook(hook:UpdateHook){hooks.push(hook);}
export const database=()=>db;
/** Venda, distribuição, conclusão e histórico são persistidos juntos. */
export function update(operation:(state:State)=>void):State {
 db.exec('BEGIN IMMEDIATE');
 try{const state=read();const before=hooks.length?structuredClone(state):undefined;operation(state);save(state);for(const hook of hooks)hook(before!,state,db);db.exec('COMMIT');return state;}
 catch(error){db.exec('ROLLBACK');throw error;}
}
function seed():State {const date=today();const state:State={demo:true,sales:[{id:'demo-sale',amount:85000,soldAt:date,paidAt:date,method:'cash',participant:null,commissionBps:0,rules:[]}],plans:[{id:'stock',name:'Reposição de estoque',amount:35000},{id:'reserve',name:'Reserva do negócio',amount:16000}],members:[{id:'pedro',name:'Pedro',commissionBps:800,active:false}],commitments:[{id:'joao',supplier:'Fornecedor João',original:60000,paid:22000,rateBps:2000,priority:1,createdAt:date,due:new Date(Date.now()+7*86400000).toISOString().slice(0,10),status:'accepted'}]};save(state);return state;}
// Backup da versão anterior no próprio SQLite, antes da migração incremental.
db.exec('BEGIN IMMEDIATE');
try{
 const old=read();
 if(old.schemaVersion!==4){
  db.prepare('INSERT OR IGNORE INTO local_state_backups VALUES(?,?,?)').run(old.schemaVersion??1,new Date().toISOString(),JSON.stringify(old));
  save(migrateState(old));
 }
 db.exec('COMMIT');
}catch(error){db.exec('ROLLBACK');throw error;}
