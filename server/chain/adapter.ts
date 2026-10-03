import type {ChainStatus} from '../../src/domain/chain-model.ts';
import type {AttestationRecord} from '../../src/domain/attestation-model.ts';
import type {ChainEvent} from './events.ts';

/** Conta de acordo como a rede devolve (só o que está on-chain). */
export interface ChainAgreementView {agreementKey:string;supplier:string;original:number;paid:number;rateBps:number;priority:number;dueTs:number;status:ChainStatus;version:number;pendingChange:boolean}
export interface AttestTarget {agreementKey:string;recordFingerprint:string;completedAt:string;onTime:boolean}
export type SettleEvent=Extract<ChainEvent,{type:'settle_sale'}>;
export interface SalePreview {commissions:number[];agreements:Record<string,number>;seller:number}

/**
 * Mesma interface para a rede simulada (modelo do programa, sem validador) e para o
 * solana-test-validator local. O GIRO só conversa com isto.
 */
export interface ChainAdapter {
 readonly cluster:'simulado'|'localnet'|'devnet'|'mainnet';
 /** Executa um evento e devolve a assinatura da transação. */
 send(event:ChainEvent):Promise<string>;
 agreements():Promise<ChainAgreementView[]>;
 /** O que a rede faria AGORA com esta venda (simulação, nada muda). */
 previewSale(event:SettleEvent):Promise<SalePreview>;
 attest(target:AttestTarget):Promise<string>;
 findAttestation(agreementKey:string,recordFingerprint:string):Promise<AttestationRecord|undefined>;
 /** Saldo do token de teste (BRL-T, centavos) de um papel (vendedor, cliente, contato-…, membro-…). */
 balance(role:string):Promise<bigint>;
 address(role:string):string;
}

/** A rede recusou pela regra do programa: repetir não adianta. */
export class ChainRuleError extends Error{readonly code:string;constructor(code:string,message=code){super(message);this.code=code;this.name='ChainRuleError';}}
/** Sem conexão com a rede (validador desligado, ferramentas não instaladas): o item fica pendente. */
export class ChainTransportError extends Error{constructor(message:string){super(message);this.name='ChainTransportError';}}

export const samePreview=(a:SalePreview,b:SalePreview)=>JSON.stringify(a.commissions)===JSON.stringify(b.commissions)&&a.seller===b.seller&&
 JSON.stringify(Object.entries(a.agreements).filter(([,v])=>v>0).sort())===JSON.stringify(Object.entries(b.agreements).filter(([,v])=>v>0).sort());
