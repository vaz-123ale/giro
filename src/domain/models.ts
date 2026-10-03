export type Method = 'cash' | 'digital';
export interface Plan { kind?:'account'|'goal' }
export type Compensation='commission'|'fixed_sale'|'daily'|'none';
export interface Member { compensation?:Compensation; dailyAmount?:number; fixedAmount?:number; participationMode?:'automatic'|'specific'; contactId?:string }
export interface Shift { compensation?:Compensation; fixedAmount?:number; participationMode?:'automatic'|'specific' }
export interface CommissionRule { compensation?:Compensation; fixedAmount?:number }
export interface Movement { compensation?:Compensation }
export interface Sale { participants?:{memberId:string;name:string;shiftId?:string;basis:'automatic'|'specific'}[]; capacityChecked?:true }
export interface Plan { category?:string; accountPaid?:number; accountStatus?:'created'|'planned'|'partial'|'paid'; paidAt?:string; recurrenceId?:string; occurrenceDate?:string; archivedAt?:string }
export type Recurrence='once'|'weekly'|'fortnightly'|'monthly';
export interface RecurringAccount { id:string; name:string; category:string; amount:number; frequency:Exclude<Recurrence,'once'>; anchorDate:string; active:boolean; createdAt:string }
export interface AccountPayment {id:string;requestId:string;planId:string;name:string;amount:number;date:string;origin:'cash'|'digital_simulated';at:string;cashMovementId?:string;confirmedBy:'local_operator'}
export interface DailySchedule {id:string;memberId:string;name:string;date:string;amount:number;status:'scheduled'|'generated'|'cancelled';wageId?:string}
export interface DailyPayment {id:string;wageId:string;amount:number;date:string;requestId:string;cashMovementId:string}
export interface State { recurringAccounts?:RecurringAccount[];accountPayments?:AccountPayment[];dailySchedules?:DailySchedule[];dailyPayments?:DailyPayment[] }
export interface Contact { type?:'supplier'|'collaborator'|'other'; memberId?:string }
export interface Invitation { senderId?:string;recipientId?:string }
export interface DailyWage { id:string; memberId:string; name:string; date:string; amount:number; paid:number }
export interface PaymentRequest { id:string; token:string; requestId:string; saleId?:string; createdAt:string; /** Assinatura da transação na rede local (só com a rede ligada). */ chainSignature?:string; /** Solana Pay: chave de referência pública (aleatória) para achar o pagamento. */ chainReference?:string }
export interface State { dailyWages?:DailyWage[]; paymentRequests?:PaymentRequest[] }
export interface Contact { id:string; name:string; phone?:string; note?:string; createdAt:string; wallet?:string }
export interface Invitation { id:string; token:string; commitmentId:string; contactId?:string; recipient:string; kind:'agreement'|'change'; proposalId?:string; version:number; terms:AgreementTerms; previous?:AgreementTerms; state:'waiting'|'accepted'|'refused'; createdAt:string; decidedAt?:string; disclosure:string; sellerAcknowledgedAt:string; recipientAcknowledgedAt?:string; authentication:'local_simulation' }
export interface Notification { id:string; commitmentId?:string; invitationId?:string; message:string; createdAt:string; readAt?:string; type?:'ACTION_REQUIRED'|'WARNING'|'SUCCESS'|'INFO'; recipientId?:string; planId?:string; dedupeKey?:string }
export interface State { contacts?:Contact[]; invitations?:Invitation[]; notifications?:Notification[] }
export interface Invitation { acceptedDisclosure?:string }
export interface Commitment { contactId?:string }
export interface CommissionRule { memberId:string; name:string; rateBps:number; shiftId?:string }
export interface CommitmentRule { commitmentId:string; supplier:string; rateBps:number; priority:number; createdAt:string; version?:number }
export interface Movement { kind:'commission'|'commitment'|'seller'; recipientId:string; recipient:string; amount:number; rateBps:number|null; mode:'to_separate'|'simulated'|'available'; remainingAfter?:number; allocationRemainingAfter?:number }
export interface PlanSuggestion { planId:string; name:string; amount:number; rateBps:number; status:'pending'|'reserved'|'dismissed'; reservedAmount?:number }
export interface Sale { id:string; amount:number; soldAt:string; paidAt:string|null; method:Method; participant:string|null; commissionBps:number; rules:string[]; demo?:boolean; commissions?:CommissionRule[]; commitmentRules?:CommitmentRule[]; distribution?:Movement[]; settledAt?:string; recordedAt?:string; legacy?:boolean; planningSuggestions?:PlanSuggestion[]; cashAccounting?:true }
export type Actor='seller'|'supplier';
export interface AgreementTerms { paymentMethod?:string; original:number; rateBps:number; priority:number; due:string }
export interface AgreementEvent { id:string; type:'created'|'submitted'|'accepted'|'refused'|'activated'|'amortized'|'completed'|'renegotiation_requested'|'renegotiation_accepted'|'renegotiation_refused'|'renegotiation_closed'|'legacy_imported'|'draft_edited'|'cash_paid'; at:string; actor:Actor|'system'; saleId?:string; amount?:number; previous?:AgreementTerms; next?:AgreementTerms; reason?:string; sellerAcceptedAt?:string; supplierAcceptedAt?:string }
export interface Renegotiation { id:string; requester:Actor; previous:AgreementTerms; next:AgreementTerms; version:number; status:'pending'|'accepted'|'refused'|'obsolete'; requestedAt:string; decidedAt?:string; reason?:string; sellerAcceptedAt?:string; supplierAcceptedAt?:string }
export interface Commitment { id:string; supplier:string; original:number; paid:number; rateBps:number; priority:number; createdAt:string; due:string; status:'draft'|'awaiting_acceptance'|'active'|'completed'|'cancelled'|'accepted'|'pending'; demo?:boolean; simulation?:boolean; completedAt?:string; completionSaleId?:string; originalDue?:string; finalDue?:string; version?:number; sellerAcceptedAt?:string; supplierAcceptedAt?:string; activatedAt?:string; timeline?:AgreementEvent[]; renegotiations?:Renegotiation[]; legacyAcceptance?:boolean; completionTerms?:AgreementTerms; cashPending?:number; simulatedPaid?:number; completionPaymentId?:string; legacyCashReclassification?:{paidBefore:number;statusBefore:string;completedAt?:string;completionSaleId?:string;at:string} }
export interface Plan { id:string; name:string; amount:number; demo?:boolean; target?:number; priority?:number; targetDate?:string|null; rateBps?:number; mode?:'manual'|'suggested'|'automatic'; status?:'active'|'paused'|'completed'; createdAt?:string }
export interface Member { disabledAt?:string; createdAt?:string }
export interface Commitment { publicId?:string; counterpartyType?:'supplier'|'collaborator'|'other' }
export interface State { commitmentSequence?:Record<string,number>; memberEvents?:{id:string;memberId:string;name:string;type:'edited'|'disabled'|'enabled'|'deleted';at:string;previous?:Member;next?:Member}[] }
export interface Sale { supportingDocument?:{name:string;type:string;size:number;content:string;operation:string;parties:string;conditions:string;commitmentId?:string} }
export interface CashSession { responsible?:string; closedBy?:string }
export interface AccountPayment { useFreeBalance?:boolean }
export interface AccountPayment { remainingAfter?:number;targetAtPayment?:number }
export interface DailyWage { recordedAt?:string }
export interface State { archivedPlans?:Plan[] }
export interface CommitmentRule { publicId?:string }
export interface Movement { commitmentPublicId?:string }
export interface PlanEvent { targetAfter?:number;paidAfter?:number;kind?:'account'|'goal' }
export interface Invitation { publicId?:string }
export interface Member { id:string; name:string; commissionBps:number; active:boolean; demo?:boolean }
export interface Shift { id:string; memberId:string; name:string; rateBps:number; startedAt:string; endedAt?:string }
export interface PlanEvent { id:string; planId:string; name:string; type:'created'|'edited'|'paused'|'resumed'|'deleted'|'reserved'; at:string; before:number; after:number; saleId?:string }
export interface CashDestination { id:string; saleId:string; kind:'supplier'|'commission'; recipientId:string; recipient:string; amount:number; separated:number; paid:number; origin:'cash'|'digital_simulated'; at:string; legacy?:boolean }
export interface CashMovement { id:string; type:'OPENING'|'CASH_SALE'|'SUPPLIER_PAYMENT'|'COMMISSION_PAYMENT'|'MANUAL_OUTFLOW'|'ADJUSTMENT'; amount:number; at:string; origin:string; sessionId?:string; reference?:string; description:string; confirmedBy?:'local_operator' }
export interface CashSession { id:string; date:string; opening:number; openedAt:string; closedAt?:string; closure?:{entries:number; outflows:number; expected:number; counted:number; difference:number; committed:number; free:number} }
export interface CashPayment { id:string; requestId:string; kind:'supplier'|'commission'; recipientId:string; recipient:string; amount:number; at:string; sessionId:string; origin:'cash'; confirmedBy:'local_operator'; allocations:{destinationId:string;amount:number}[] }
export interface CashAction { id:string; type:'separated'|'paid'; destinationId:string; amount:number; at:string; confirmedBy:'local_operator'; paymentId?:string }
export interface State { sales:Sale[]; commitments:Commitment[]; plans:Plan[]; members:Member[]; shifts?:Shift[]; planEvents?:PlanEvent[]; cashSessions?:CashSession[]; cashMovements?:CashMovement[]; cashDestinations?:CashDestination[]; cashPayments?:CashPayment[]; cashActions?:CashAction[]; demo:boolean; schemaVersion?:number; settings?:{minimumWeeklyFree:number} }

export interface Commitment { paymentMethod?:string }

/** Confirmação, pela pessoa que recebeu, de um pagamento em dinheiro registrado pelo vendedor (link local). */
export interface ReceiptConfirmation { id:string; token:string; paymentId:string; kind:'supplier'|'commission'; recipientId:string; recipient:string; amount:number; paidAt:string; createdAt:string; state:'waiting'|'confirmed'|'disputed'; decidedAt?:string }
/** Pedido de início/fim de turno feito pelo próprio trabalhador; só vale após confirmação do vendedor. */
export interface ShiftRequest { id:string; memberId:string; name:string; type:'start'|'end'; at:string; state:'waiting'|'confirmed'|'refused'; decidedAt?:string }
/** Escala: dias da semana (0=domingo … 6=sábado). checkinToken: link local de check-in do trabalhador. */
export interface Member { schedule?:number[]; checkinToken?:string }
export interface State { receiptConfirmations?:ReceiptConfirmation[]; shiftRequests?:ShiftRequest[] }
