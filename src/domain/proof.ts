import type {Commitment,State} from './models.ts';
import {commitmentId} from './records.ts';

/**
 * Comprovante de conclusão: registro mínimo de um acordo concluído (sem telefone, CPF ou dados do negócio)
 * e sua impressão digital SHA-256. Hoje serve para conferir que o arquivo não foi alterado depois de gerado;
 * na etapa Solana, só esta impressão digital é registrada na rede (attestation), preservando a privacidade.
 */
export interface ProofPayment {amount:number;date:string;origin:'dinheiro'|'digital_simulado';confirmedByRecipient:boolean}
export interface CompletionRecord {format:'giro-comprovante/1';agreement:string;counterparty:string;original:number;rateBps:number;due:string;completedAt:string;onTime:boolean;paidBeforeGiro:number;payments:ProofPayment[]}
export interface TrustSummary {completed:number;onTime:number;counterparties:number;recurring:number;totalCompleted:number;cashPayments:number;cashPaymentsConfirmedByBoth:number}
export interface TrustReport {format:'giro-historico/1';generatedAt:string;anonymized:boolean;summary:TrustSummary;agreements:{record:CompletionRecord;fingerprint:string}[];notice:string}

export function completionRecord(state:State,c:Commitment):CompletionRecord{
 const cash=(state.cashPayments??[]).filter(p=>p.kind==='supplier'&&p.recipientId===c.id).map(p=>({amount:p.amount,date:p.at.slice(0,10),origin:'dinheiro' as const,confirmedByRecipient:state.receiptConfirmations?.find(r=>r.paymentId===p.id)?.state==='confirmed'}));
 const digital=state.sales.filter(s=>s.method!=='cash'&&s.paidAt).flatMap(s=>(s.distribution??[]).filter(e=>e.kind==='commitment'&&e.recipientId===c.id&&e.amount>0).map(e=>({amount:e.amount,date:s.paidAt!,origin:'digital_simulado' as const,confirmedByRecipient:false})));
 const payments=[...cash,...digital].sort((a,b)=>a.date.localeCompare(b.date)||a.amount-b.amount);
 const due=c.completionTerms?.due??c.finalDue??c.due,completedAt=c.completedAt??'';
 return {format:'giro-comprovante/1',agreement:commitmentId(c),counterparty:c.supplier,original:c.original,rateBps:c.completionTerms?.rateBps??c.rateBps,due,completedAt,onTime:!!completedAt&&completedAt<=due,paidBeforeGiro:Math.max(0,c.original-payments.reduce((a,p)=>a+p.amount,0)),payments};
}
/** JSON com ordem de campos fixa: o mesmo registro sempre gera a mesma impressão digital. */
export async function fingerprint(record:CompletionRecord){
 const bytes=new TextEncoder().encode(JSON.stringify(record));const hash=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export const shortCode=(hex:string)=>hex.slice(0,16).toUpperCase().match(/.{4}/g)!.join('-');
export function summarize(records:CompletionRecord[]):TrustSummary{
 const names=records.map(r=>r.counterparty);const cash=records.flatMap(r=>r.payments.filter(p=>p.origin==='dinheiro'));
 return {completed:records.length,onTime:records.filter(r=>r.onTime).length,counterparties:new Set(names).size,recurring:[...new Set(names)].filter(n=>names.filter(m=>m===n).length>=2).length,totalCompleted:records.reduce((a,r)=>a+r.original,0),cashPayments:cash.length,cashPaymentsConfirmedByBoth:cash.filter(p=>p.confirmedByRecipient).length};
}
export const completedAgreements=(state:State)=>state.commitments.filter(c=>!c.demo&&c.status==='completed'&&(c.counterpartyType??'supplier')!=='collaborator');
export async function trustReport(state:State,anonymize:boolean,at=new Date().toISOString()):Promise<TrustReport>{
 const alias=new Map<string,string>();
 const records=completedAgreements(state).map(c=>completionRecord(state,c)).map(r=>{if(!anonymize)return r;if(!alias.has(r.counterparty))alias.set(r.counterparty,`Parceiro ${alias.size+1}`);return {...r,counterparty:alias.get(r.counterparty)!};});
 const agreements=await Promise.all(records.map(async record=>({record,fingerprint:await fingerprint(record)})));
 return {format:'giro-historico/1',generatedAt:at,anonymized:anonymize,summary:summarize(records),agreements,notice:'Gerado localmente pelo GIRO. A impressão digital confere que cada registro não foi alterado depois de gerado. Pagamentos "digital_simulado" não movimentaram dinheiro real. Confirmação independente: pagamentos em dinheiro marcados como confirmados pela pessoa que recebeu.'};
}
export interface VerifyResult {valid:boolean;summaryMatches:boolean;items:{agreement:string;valid:boolean}[];error?:string}
export async function verifyReport(data:unknown):Promise<VerifyResult>{
 const report=data as TrustReport;
 if(!report||report.format!=='giro-historico/1'||!Array.isArray(report.agreements))return {valid:false,summaryMatches:false,items:[],error:'Arquivo não é um histórico GIRO.'};
 const items=await Promise.all(report.agreements.map(async a=>({agreement:String(a?.record?.agreement??'?'),valid:!!a?.record&&await fingerprint(a.record)===a.fingerprint})));
 const summaryMatches=JSON.stringify(summarize(report.agreements.map(a=>a.record)))===JSON.stringify(report.summary);
 return {valid:items.every(i=>i.valid)&&summaryMatches,summaryMatches,items};
}
