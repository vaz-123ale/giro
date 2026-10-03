import type {Commitment,State} from './models.ts';
import {commitmentId} from './records.ts';
import {remaining} from './finance.ts';
import {completedAgreements,completionRecord,fingerprint} from './proof.ts';

/**
 * CONTRATOS DE INTEGRAÇÃO (preparação, sem execução).
 * Nesta fase tudo roda localmente. Estas funções apenas descrevem, a partir do estado local,
 * o MÍNIMO que um dia poderia ir para a infraestrutura pública — quando houver autorização explícita.
 * Nada aqui envia dados. Regra 13: nenhum nome, telefone, CPF, observação ou dado do negócio.
 */
export type IntegrationId='agreement_ledger'|'attestation'|'payments'|'identity'|'documents'|'storage';
export interface IntegrationPoint {id:IntegrationId;title:string;today:string;module:string;future:string;authorization:string}
export const integrationPoints:IntegrationPoint[]=[
 {id:'agreement_ledger',title:'Execução dos acordos',today:'Motor local: divisão da venda, limite do restante e conclusão (SQLite).',module:'src/domain/finance.ts (calculateDistribution) · server/financial-service.ts · server/chain/service.ts · solana/programs/giro_acordos/src/lib.rs',future:'Programa Anchor giro_acordos compilado e rodando no solana-test-validator local (paridade 100% com o motor; testes de segurança no programa compilado). Próximo: Devnet.',authorization:'Rede local feita (A1–A4). Devnet exige autorização separada (A5).'},
 {id:'attestation',title:'Prova de conclusão',today:'Código SHA-256 do registro mínimo, arquivo de histórico e verificação local.',module:'src/domain/proof.ts · src/domain/attestation-model.ts',future:'Atestado no SAS oficial carregado no validador local (layout oficial, só chave do acordo + impressão digital). Próximo: Devnet.',authorization:'Rede local primeiro; Devnet só com autorização separada.'},
 {id:'payments',title:'Recebimento da venda',today:'QR de cobrança simulado neste computador; dinheiro confirmado manualmente.',module:'server/payment-service.ts · src/domain/qr.ts · server/chain/service.ts',future:'Com a rede ligada, a cobrança executa na rede primeiro (token BRL-T de teste) e só então o GIRO registra. Solana Pay (transaction request) para carteira funcionando na rede local; celular exige URL pública e Pix/cartão exige parceiro (ambos com autorização).',authorization:'Carteira/token locais; parceiro externo exige autorização.'},
 {id:'identity',title:'Aceite e confirmação da outra parte',today:'Links locais com token aleatório (convite, confirmação de recebimento, check-in). Sem login.',module:'server/invitation-service.ts · server/receipt-service.ts · server/shift-request-service.ts',future:'Assinatura da carteira de cada parte ou autenticação real.',authorization:'Depende da escolha de carteira/autenticação.'},
 {id:'documents',title:'Importação de documentos',today:'CSV/TXT/texto colado lido no navegador, com revisão.',module:'src/domain/import.ts',future:'Leitura de PDF/imagem (OCR) e planilhas.',authorization:'Bibliotecas/modelos externos exigem autorização.'},
 {id:'storage',title:'Armazenamento',today:'SQLite local com transações atômicas e backup antes de migrações.',module:'server/store.ts',future:'PostgreSQL ou outro banco, mantendo o mesmo formato de estado.',authorization:'Migração para nuvem não pode ser automática.'},
];

/** Chave pública do acordo: hash do código interno; não revela nome nem valores. */
export async function agreementKey(c:Commitment){const bytes=new TextEncoder().encode('giro-acordo:'+commitmentId(c));const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export interface LedgerEntry {agreementKey:string;original:number;paid:number;remaining:number;rateBps:number;priority:number;status:'awaiting'|'active'|'completed'|'cancelled';version:number}
const ledgerStatus=(c:Commitment):LedgerEntry['status']=>c.status==='completed'?'completed':c.status==='cancelled'?'cancelled':['active','accepted'].includes(c.status)?'active':'awaiting';
/** O que o programa guardaria por acordo (documento: "valor original, valor já quitado, saldo restante e situação"). Rascunhos não entram. */
export async function ledgerSnapshot(state:State):Promise<LedgerEntry[]>{
 return Promise.all(state.commitments.filter(c=>!c.demo&&c.status!=='draft').map(async c=>({agreementKey:await agreementKey(c),original:c.original,paid:c.paid,remaining:remaining(c),rateBps:c.rateBps,priority:c.priority,status:ledgerStatus(c),version:c.version??1})));
}
export interface AttestationPayload {agreementKey:string;recordFingerprint:string;completedAt:string;onTime:boolean}
/** O que seria atestado na conclusão: só chave, impressão digital, data e se foi no prazo. */
export async function attestationPayloads(state:State):Promise<AttestationPayload[]>{
 return Promise.all(completedAgreements(state).map(async c=>{const r=completionRecord(state,c);return {agreementKey:await agreementKey(c),recordFingerprint:await fingerprint(r),completedAt:r.completedAt,onTime:r.onTime};}));
}
/** Campos que NUNCA saem do computador (conferido em teste). */
export const localOnlyFields=['supplier','counterparty','name','phone','note','contactId','recipient','participant','description','category'] as const;
