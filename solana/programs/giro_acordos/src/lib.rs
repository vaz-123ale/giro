//! Programa "giro_acordos" — acordos de receita entre vendedor e fornecedor (GIRO).
//!
//! Na rede ficam SÓ: o acordo aceito pelas duas carteiras, a execução das vendas pagas com token,
//! os pagamentos em dinheiro confirmados pelas duas partes e a situação. Nenhum nome, telefone,
//! observação ou valor de caixa físico. O programa não guarda dinheiro: na venda, cada parte sai
//! direto da conta do cliente para a conta de destino (transfer_checked), na mesma transação.
//!
//! Espelho exato de `src/domain/chain-model.ts` (modelo de referência, testado contra o GIRO).
//! Redes: validador local (BRL-T de teste) e Devnet (token de teste no formato do BRZ). Mainnet só com autorização.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

pub mod logic;
#[cfg(test)]
mod paridade_vetores;

use logic::RuleError;

declare_id!("CVAQPvyjepuDP9j5df22ipp9E7XWVxej1T26rb4NvEMV");

pub const SELLER_SEED: &[u8] = b"seller";
pub const AGREEMENT_SEED: &[u8] = b"agreement";
pub const CASH_SEED: &[u8] = b"cash";
/// Limites da v1 (tamanho da transação). Acima disso: Address Lookup Tables (v2).
pub const MAX_AGREEMENTS_PER_SALE: usize = 4;
pub const MAX_COMMISSIONS_PER_SALE: usize = 2;

#[program]
pub mod giro_acordos {
    use super::*;

    /// Cria o estado do vendedor (capacidade comprometida). Assina: vendedor.
    /// `unit`: menor fração usada nas divisões, em unidades do token (BRZ tem 4 casas → 100 = 1 centavo,
    /// igual ao GIRO). `max_sale`: teto por venda em unidades do token (0 = sem teto) — proteção na mainnet.
    pub fn register_seller(ctx: Context<RegisterSeller>, unit: u64, max_sale: u64) -> Result<()> {
        require!(unit >= 1, GiroError::InvalidTerms);
        let s = &mut ctx.accounts.seller_state;
        s.unit = unit;
        s.max_sale = max_sale;
        s.seller = ctx.accounts.seller.key();
        s.committed_bps = 0;
        s.active_count = 0;
        s.next_seq = 0;
        s.bump = ctx.bumps.seller_state;
        Ok(())
    }

    /// Vendedor muda o teto por venda (0 = sem teto).
    pub fn set_limits(ctx: Context<SetLimits>, max_sale: u64) -> Result<()> {
        ctx.accounts.seller_state.max_sale = max_sale;
        Ok(())
    }

    /// Proposta do vendedor. A capacidade (≤ 100%) já é reservada aqui. Assina: vendedor.
    /// `created_ts` = data de criação no GIRO (ordem de liquidação igual à do motor local).
    pub fn propose(ctx: Context<Propose>, agreement_key: [u8; 32], terms: Terms, paid_before: u64, created_ts: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require_keys_neq!(ctx.accounts.seller.key(), ctx.accounts.supplier.key(), GiroError::InvalidTerms);
        terms.validate()?;
        require!(paid_before <= terms.original, GiroError::InvalidTerms);
        let unit = ctx.accounts.seller_state.unit;
        require!(terms.original % unit == 0 && paid_before % unit == 0, GiroError::InvalidUnit);
        require!(created_ts <= now, GiroError::InvalidTerms);

        let s = &mut ctx.accounts.seller_state;
        s.committed_bps = logic::reserve(s.committed_bps, terms.rate_bps).map_err(rule)?;
        let seq = s.next_seq;
        s.next_seq = seq.checked_add(1).ok_or(GiroError::Overflow)?;

        ctx.accounts.agreement.set_inner(Agreement {
            seller: ctx.accounts.seller.key(),
            supplier: ctx.accounts.supplier.key(),
            mint: ctx.accounts.mint.key(),
            agreement_key,
            original: terms.original,
            paid: paid_before,
            rate_bps: terms.rate_bps,
            priority: terms.priority,
            due_ts: terms.due_ts,
            status: Status::Proposed,
            version: 1,
            seq,
            created_ts,
            completed_ts: 0,
            pending_change: None,
            bump: ctx.bumps.agreement,
        });
        emit!(AgreementProposed { agreement_key });
        Ok(())
    }

    /// Aceite do fornecedor. Saldo já zerado conclui sem passar por vendas. Assina: fornecedor.
    pub fn accept(ctx: Context<SupplierDecision>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = &mut ctx.accounts.agreement;
        let s = &mut ctx.accounts.seller_state;
        require!(a.status == Status::Proposed, GiroError::InvalidStatus);
        a.status = Status::Active;
        s.active_count = s.active_count.checked_add(1).ok_or(GiroError::Overflow)?;
        emit!(AgreementAccepted { agreement_key: a.agreement_key });
        if a.remaining()? == 0 {
            complete(a, s, now)?;
        }
        Ok(())
    }

    /// Recusa do fornecedor; libera a capacidade reservada. A conta fica como registro (Rejected).
    pub fn reject(ctx: Context<SupplierDecision>) -> Result<()> {
        let a = &mut ctx.accounts.agreement;
        let s = &mut ctx.accounts.seller_state;
        require!(a.status == Status::Proposed, GiroError::InvalidStatus);
        a.status = Status::Rejected;
        s.committed_bps = logic::release(s.committed_bps, a.rate_bps).map_err(rule)?;
        emit!(AgreementRejected { agreement_key: a.agreement_key });
        Ok(())
    }

    /// Vendedor desiste antes do aceite.
    pub fn cancel_proposal(ctx: Context<SellerAction>) -> Result<()> {
        let a = &mut ctx.accounts.agreement;
        let s = &mut ctx.accounts.seller_state;
        require!(a.status == Status::Proposed, GiroError::InvalidStatus);
        a.status = Status::Cancelled;
        s.committed_bps = logic::release(s.committed_bps, a.rate_bps).map_err(rule)?;
        emit!(ProposalCancelled { agreement_key: a.agreement_key });
        Ok(())
    }

    /// Pedido de mudança por QUALQUER parte. Não pode fabricar quitação (novo valor > já pago).
    /// Um aumento de % fica reservado enquanto a outra parte não decide.
    pub fn propose_change(ctx: Context<ChangeAction>, terms: Terms) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let a = &mut ctx.accounts.agreement;
        let s = &mut ctx.accounts.seller_state;
        require!(signer == a.seller || signer == a.supplier, GiroError::Unauthorized);
        require!(a.status == Status::Active, GiroError::InvalidStatus);
        require!(a.pending_change.is_none(), GiroError::ChangePending);
        terms.validate()?;
        require!(terms.original > a.paid, GiroError::InvalidTerms);
        require!(terms.original % s.unit == 0, GiroError::InvalidUnit);
        let extra = terms.rate_bps.saturating_sub(a.rate_bps);
        s.committed_bps = logic::reserve(s.committed_bps, extra).map_err(rule)?;
        a.pending_change = Some(PendingChange { terms, proposer: signer, reserved_bps: extra });
        emit!(ChangeProposed { agreement_key: a.agreement_key, version: a.version });
        Ok(())
    }

    /// Decisão da OUTRA parte. Aceite aplica os termos e incrementa a versão.
    pub fn decide_change(ctx: Context<ChangeAction>, accept: bool) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let a = &mut ctx.accounts.agreement;
        let s = &mut ctx.accounts.seller_state;
        let change = a.pending_change.ok_or(GiroError::NoPendingChange)?;
        let other = if change.proposer == a.seller { a.supplier } else { a.seller };
        require_keys_eq!(signer, other, GiroError::Unauthorized);
        require!(a.status == Status::Active, GiroError::InvalidStatus);
        if accept {
            let held = a.rate_bps.checked_add(change.reserved_bps).ok_or(GiroError::Overflow)?;
            s.committed_bps = logic::release(s.committed_bps, held).map_err(rule)?;
            s.committed_bps = logic::reserve(s.committed_bps, change.terms.rate_bps).map_err(rule)?;
            a.original = change.terms.original;
            a.rate_bps = change.terms.rate_bps;
            a.priority = change.terms.priority;
            a.due_ts = change.terms.due_ts;
            a.version = a.version.checked_add(1).ok_or(GiroError::Overflow)?;
        } else {
            s.committed_bps = logic::release(s.committed_bps, change.reserved_bps).map_err(rule)?;
        }
        a.pending_change = None;
        emit!(ChangeDecided { agreement_key: a.agreement_key, accepted: accept, version: a.version });
        Ok(())
    }

    /// Venda paga com token. Assina: cliente (dono da conta de origem). UMA transação divide o valor:
    /// 1. fixos por venda; 2. comissões %; 3. acordos ativos por prioridade; 4. resto ao vendedor.
    ///
    /// remaining_accounts, nesta ordem:
    ///   [acordo (PDA, gravável), conta de token do fornecedor (gravável)] × agreements_count
    ///   [conta de token do destino de cada fixo] × fixed.len()
    ///   [conta de token do destino de cada comissão %] × percent_bps.len()
    ///   [reference do Solana Pay] (opcional; somente leitura, não usada)
    /// TODOS os acordos ativos do vendedor precisam vir (impede omitir um fornecedor), em ordem
    /// não decrescente de (prioridade, data de criação).
    pub fn settle_sale<'info>(
        ctx: Context<'info, SettleSale<'info>>,
        amount: u64,
        agreements_count: u8,
        fixed: Vec<u64>,
        percent_bps: Vec<u16>,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let n = agreements_count as usize;
        require!(amount > 0, GiroError::AmountZero);
        let unit = ctx.accounts.seller_state.unit;
        let max_sale = ctx.accounts.seller_state.max_sale;
        require!(amount % unit == 0, GiroError::InvalidUnit);
        require!(max_sale == 0 || amount <= max_sale, GiroError::SaleLimit);
        require!(n <= MAX_AGREEMENTS_PER_SALE && fixed.len() + percent_bps.len() <= MAX_COMMISSIONS_PER_SALE, GiroError::TooManyAccounts);
        let expected = n * 2 + fixed.len() + percent_bps.len();
        // Solana Pay: uma conta extra opcional no fim, a "reference" (somente leitura, nunca usada) para achar o pagamento.
        let all = ctx.remaining_accounts;
        require!(all.len() == expected || (all.len() == expected + 1 && !all[expected].is_writable && !all[expected].is_signer), GiroError::AccountsMismatch);
        let rem = &all[..expected];
        require!(n == ctx.accounts.seller_state.active_count as usize, GiroError::MissingAgreement);

        let seller = ctx.accounts.seller.key();
        let mint = ctx.accounts.mint.key();
        let token_program = ctx.accounts.token_program.key();

        // 1. Carrega e valida cada acordo e a conta de destino do fornecedor.
        let mut loaded: Vec<Account<'info, Agreement>> = Vec::with_capacity(n);
        for k in 0..n {
            let info = &rem[2 * k];
            let dest = &rem[2 * k + 1];
            require!(info.is_writable && dest.is_writable, GiroError::AccountsMismatch);
            let a: Account<'info, Agreement> = Account::try_from(info)?;
            let expected = Pubkey::create_program_address(
                &[AGREEMENT_SEED, a.seller.as_ref(), a.agreement_key.as_ref(), &[a.bump]],
                &crate::ID,
            )
            .map_err(|_| error!(GiroError::MissingAgreement))?;
            require_keys_eq!(expected, info.key(), GiroError::MissingAgreement);
            require_keys_eq!(a.seller, seller, GiroError::WrongSeller);
            require_keys_eq!(a.mint, mint, GiroError::WrongMint);
            require!(a.status == Status::Active, GiroError::InvalidStatus);
            require!(loaded.iter().all(|p| p.key() != info.key()), GiroError::DuplicateAgreement);
            if let Some(prev) = loaded.last() {
                require!(logic::in_order((prev.priority, prev.created_ts), (a.priority, a.created_ts)), GiroError::WrongOrder);
            }
            check_destination(dest, &mint, &token_program, Some(&a.supplier))?;
            loaded.push(a);
        }
        let commission_dests = &rem[n * 2..];
        for dest in commission_dests {
            require!(dest.is_writable, GiroError::AccountsMismatch);
            check_destination(dest, &mint, &token_program, None)?;
        }

        // 2. Calcula a divisão inteira antes de mover qualquer coisa.
        let mut inputs = Vec::with_capacity(n);
        for a in loaded.iter() {
            inputs.push((a.rate_bps, a.remaining()?));
        }
        require!(fixed.iter().all(|f| f % unit == 0), GiroError::InvalidUnit);
        let split = logic::split_units(amount, &fixed, &percent_bps, &inputs, unit).map_err(rule)?;

        // 3. Transferências: cada parte sai direto da conta do cliente (não custodial).
        for (k, part) in split.agreements.iter().enumerate() {
            pay(&ctx.accounts, rem[2 * k + 1].clone(), *part)?;
        }
        for (j, part) in split.fixed.iter().chain(split.percent.iter()).enumerate() {
            pay(&ctx.accounts, commission_dests[j].clone(), *part)?;
        }
        pay(&ctx.accounts, ctx.accounts.seller_token.to_account_info(), split.seller)?;

        // 4. Atualiza os acordos e grava.
        let s = &mut ctx.accounts.seller_state;
        for (a, part) in loaded.iter_mut().zip(split.agreements.iter()) {
            if *part == 0 {
                continue;
            }
            a.paid = a.paid.checked_add(*part).ok_or(GiroError::Overflow)?;
            if a.remaining()? == 0 {
                complete(a, s, now)?;
            }
            a.exit(&crate::ID)?;
        }
        emit!(SaleSettled { seller, amount, to_seller: split.seller });
        Ok(())
    }

    /// Pagamento em DINHEIRO, passo 1: o vendedor registra que entregou (assina só o vendedor).
    /// Não muda o saldo do acordo: só vale depois que o fornecedor confirma (passo 2).
    /// `nonce` único por pagamento (PDA ["cash", acordo, nonce]); repetir o nonce falha.
    pub fn record_offchain_payment(ctx: Context<RecordOffchainPayment>, amount: u64, nonce: [u8; 16]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = &ctx.accounts.agreement;
        require!(a.status == Status::Active, GiroError::InvalidStatus);
        require!(amount > 0, GiroError::AmountZero);
        require!(amount % ctx.accounts.seller_state.unit == 0, GiroError::InvalidUnit);
        require!(amount <= a.remaining()?, GiroError::ExceedsRemaining);
        let agreement_key = a.agreement_key;
        let agreement = a.key();
        ctx.accounts.payment.set_inner(OffchainPayment {
            agreement,
            nonce,
            amount,
            paid_ts: now,
            status: CashStatus::Pending,
            decided_ts: 0,
            bump: ctx.bumps.payment,
        });
        emit!(OffchainPaymentRecorded { agreement_key, amount });
        Ok(())
    }

    /// Pagamento em DINHEIRO, passo 2: o fornecedor confirma que recebeu (assina só o fornecedor).
    /// Só aqui o saldo do acordo baixa. Nunca acima do restante.
    pub fn confirm_offchain_payment(ctx: Context<DecideOffchainPayment>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.payment;
        let a = &mut ctx.accounts.agreement;
        let s = &mut ctx.accounts.seller_state;
        require!(p.status == CashStatus::Pending, GiroError::InvalidStatus);
        require!(a.status == Status::Active, GiroError::InvalidStatus);
        require!(p.amount <= a.remaining()?, GiroError::ExceedsRemaining);
        p.status = CashStatus::Confirmed;
        p.decided_ts = now;
        a.paid = a.paid.checked_add(p.amount).ok_or(GiroError::Overflow)?;
        emit!(OffchainPaymentConfirmed { agreement_key: a.agreement_key, amount: p.amount });
        if a.remaining()? == 0 {
            complete(a, s, now)?;
        }
        Ok(())
    }

    /// Fornecedor informa que NÃO recebeu o dinheiro registrado: nada muda no saldo.
    pub fn dispute_offchain_payment(ctx: Context<DecideOffchainPayment>) -> Result<()> {
        let p = &mut ctx.accounts.payment;
        require!(p.status == CashStatus::Pending, GiroError::InvalidStatus);
        p.status = CashStatus::Disputed;
        p.decided_ts = Clock::get()?.unix_timestamp;
        emit!(OffchainPaymentDisputed { agreement_key: ctx.accounts.agreement.agreement_key, amount: p.amount });
        Ok(())
    }
}

// ---------------------------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------------------------

fn rule(e: RuleError) -> Error {
    match e {
        RuleError::Overflow => error!(GiroError::Overflow),
        RuleError::InvalidTerms => error!(GiroError::InvalidTerms),
        RuleError::CapacityExceeded => error!(GiroError::CapacityExceeded),
    }
}

fn complete(a: &mut Agreement, s: &mut SellerState, now: i64) -> Result<()> {
    a.status = Status::Completed;
    a.completed_ts = now;
    let reserved = a.pending_change.map(|c| c.reserved_bps).unwrap_or(0);
    let held = a.rate_bps.checked_add(reserved).ok_or(GiroError::Overflow)?;
    s.committed_bps = logic::release(s.committed_bps, held).map_err(rule)?;
    a.pending_change = None;
    s.active_count = s.active_count.checked_sub(1).ok_or(GiroError::Overflow)?;
    emit!(AgreementCompleted { agreement_key: a.agreement_key, completed_ts: now });
    Ok(())
}

/// Conta de destino: do programa de token usado, do mesmo mint e (se informado) do dono esperado.
fn check_destination(info: &AccountInfo, mint: &Pubkey, token_program: &Pubkey, owner: Option<&Pubkey>) -> Result<()> {
    require_keys_eq!(*info.owner, *token_program, GiroError::WrongSupplierAccount);
    let data = info.try_borrow_data()?;
    let account = TokenAccount::try_deserialize(&mut &data[..]).map_err(|_| error!(GiroError::WrongSupplierAccount))?;
    require_keys_eq!(account.mint, *mint, GiroError::WrongMint);
    if let Some(expected) = owner {
        require_keys_eq!(account.owner, *expected, GiroError::WrongSupplierAccount);
    }
    Ok(())
}

fn pay<'info>(accounts: &SettleSale<'info>, to: AccountInfo<'info>, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token_interface::transfer_checked(
        CpiContext::new(
            accounts.token_program.key(),
            TransferChecked {
                from: accounts.payer_token.to_account_info(),
                mint: accounts.mint.to_account_info(),
                to,
                authority: accounts.payer.to_account_info(),
            },
        ),
        amount,
        accounts.mint.decimals,
    )
}

// ---------------------------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Status {
    Proposed,
    Active,
    Completed,
    Rejected,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub struct Terms {
    /// Valor total do acordo, em centavos (BRL-T tem 2 casas: 1 unidade = 1 centavo).
    pub original: u64,
    pub rate_bps: u16,
    pub priority: u16,
    pub due_ts: i64,
}

impl Terms {
    pub fn validate(&self) -> Result<()> {
        require!(logic::valid_terms(self.original, self.rate_bps, self.priority), GiroError::InvalidTerms);
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub struct PendingChange {
    pub terms: Terms,
    pub proposer: Pubkey,
    pub reserved_bps: u16,
}

/// PDA ["seller", vendedor]
#[account]
#[derive(InitSpace)]
pub struct SellerState {
    pub seller: Pubkey,
    /// Soma dos % propostos + ativos (+ aumentos pendentes). Nunca > 10000.
    pub committed_bps: u16,
    pub active_count: u8,
    pub next_seq: u64,
    /// Menor fração das divisões (unidades do token). BRZ: 100 = 1 centavo.
    pub unit: u64,
    /// Teto por venda (unidades do token); 0 = sem teto.
    pub max_sale: u64,
    pub bump: u8,
}

/// PDA ["agreement", vendedor, agreement_key]. agreement_key = SHA-256 do código do acordo (sem nome).
#[account]
#[derive(InitSpace)]
pub struct Agreement {
    pub seller: Pubkey,
    pub supplier: Pubkey,
    pub mint: Pubkey,
    pub agreement_key: [u8; 32],
    pub original: u64,
    pub paid: u64,
    pub rate_bps: u16,
    pub priority: u16,
    pub due_ts: i64,
    pub status: Status,
    pub version: u32,
    pub seq: u64,
    pub created_ts: i64,
    pub completed_ts: i64,
    pub pending_change: Option<PendingChange>,
    pub bump: u8,
}

impl Agreement {
    pub fn remaining(&self) -> Result<u64> {
        self.original.checked_sub(self.paid).ok_or_else(|| error!(GiroError::Overflow))
    }
}

/// PDA ["cash", acordo, nonce] — pagamento em dinheiro assinado pelas duas partes.
#[account]
#[derive(InitSpace)]
pub struct OffchainPayment {
    pub agreement: Pubkey,
    pub nonce: [u8; 16],
    pub amount: u64,
    pub paid_ts: i64,
    pub status: CashStatus,
    pub decided_ts: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum CashStatus {
    Pending,
    Confirmed,
    Disputed,
}

#[derive(Accounts)]
pub struct RegisterSeller<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(init, payer = seller, space = 8 + SellerState::INIT_SPACE, seeds = [SELLER_SEED, seller.key().as_ref()], bump)]
    pub seller_state: Account<'info, SellerState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agreement_key: [u8; 32])]
pub struct Propose<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    /// CHECK: só a chave pública do fornecedor é gravada; ele mesmo assina accept/reject.
    pub supplier: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [SELLER_SEED, seller.key().as_ref()], bump = seller_state.bump, has_one = seller @ GiroError::Unauthorized)]
    pub seller_state: Account<'info, SellerState>,
    #[account(init, payer = seller, space = 8 + Agreement::INIT_SPACE, seeds = [AGREEMENT_SEED, seller.key().as_ref(), agreement_key.as_ref()], bump)]
    pub agreement: Account<'info, Agreement>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SupplierDecision<'info> {
    pub supplier: Signer<'info>,
    #[account(mut, seeds = [AGREEMENT_SEED, agreement.seller.as_ref(), agreement.agreement_key.as_ref()], bump = agreement.bump, has_one = supplier @ GiroError::Unauthorized)]
    pub agreement: Account<'info, Agreement>,
    #[account(mut, seeds = [SELLER_SEED, agreement.seller.as_ref()], bump = seller_state.bump)]
    pub seller_state: Account<'info, SellerState>,
}

#[derive(Accounts)]
pub struct SellerAction<'info> {
    pub seller: Signer<'info>,
    #[account(mut, seeds = [AGREEMENT_SEED, seller.key().as_ref(), agreement.agreement_key.as_ref()], bump = agreement.bump, has_one = seller @ GiroError::Unauthorized)]
    pub agreement: Account<'info, Agreement>,
    #[account(mut, seeds = [SELLER_SEED, seller.key().as_ref()], bump = seller_state.bump)]
    pub seller_state: Account<'info, SellerState>,
}

#[derive(Accounts)]
pub struct ChangeAction<'info> {
    /// Vendedor ou fornecedor (conferido na instrução).
    pub signer: Signer<'info>,
    #[account(mut, seeds = [AGREEMENT_SEED, agreement.seller.as_ref(), agreement.agreement_key.as_ref()], bump = agreement.bump)]
    pub agreement: Account<'info, Agreement>,
    #[account(mut, seeds = [SELLER_SEED, agreement.seller.as_ref()], bump = seller_state.bump)]
    pub seller_state: Account<'info, SellerState>,
}

#[derive(Accounts)]
pub struct SettleSale<'info> {
    pub payer: Signer<'info>,
    /// CHECK: vendedor (não assina a venda; recebe o restante). Validado por seller_state e seller_token.
    pub seller: UncheckedAccount<'info>,
    #[account(mut, seeds = [SELLER_SEED, seller.key().as_ref()], bump = seller_state.bump, has_one = seller @ GiroError::WrongSeller)]
    pub seller_state: Account<'info, SellerState>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = payer, token::token_program = token_program)]
    pub payer_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = seller, token::token_program = token_program)]
    pub seller_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(amount: u64, nonce: [u8; 16])]
pub struct RecordOffchainPayment<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(seeds = [AGREEMENT_SEED, seller.key().as_ref(), agreement.agreement_key.as_ref()], bump = agreement.bump, has_one = seller @ GiroError::Unauthorized)]
    pub agreement: Account<'info, Agreement>,
    #[account(seeds = [SELLER_SEED, seller.key().as_ref()], bump = seller_state.bump)]
    pub seller_state: Account<'info, SellerState>,
    #[account(init, payer = seller, space = 8 + OffchainPayment::INIT_SPACE, seeds = [CASH_SEED, agreement.key().as_ref(), nonce.as_ref()], bump)]
    pub payment: Account<'info, OffchainPayment>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DecideOffchainPayment<'info> {
    pub supplier: Signer<'info>,
    #[account(mut, seeds = [AGREEMENT_SEED, agreement.seller.as_ref(), agreement.agreement_key.as_ref()], bump = agreement.bump, has_one = supplier @ GiroError::Unauthorized)]
    pub agreement: Account<'info, Agreement>,
    #[account(mut, seeds = [SELLER_SEED, agreement.seller.as_ref()], bump = seller_state.bump)]
    pub seller_state: Account<'info, SellerState>,
    #[account(mut, seeds = [CASH_SEED, agreement.key().as_ref(), payment.nonce.as_ref()], bump = payment.bump, constraint = payment.agreement == agreement.key() @ GiroError::MissingAgreement)]
    pub payment: Account<'info, OffchainPayment>,
}

#[derive(Accounts)]
pub struct SetLimits<'info> {
    pub seller: Signer<'info>,
    #[account(mut, seeds = [SELLER_SEED, seller.key().as_ref()], bump = seller_state.bump, has_one = seller @ GiroError::Unauthorized)]
    pub seller_state: Account<'info, SellerState>,
}

// ---------------------------------------------------------------------------------------------
// Eventos e erros (mesmos códigos de src/domain/chain-model.ts)
// ---------------------------------------------------------------------------------------------

#[event]
pub struct AgreementProposed { pub agreement_key: [u8; 32] }
#[event]
pub struct AgreementAccepted { pub agreement_key: [u8; 32] }
#[event]
pub struct AgreementRejected { pub agreement_key: [u8; 32] }
#[event]
pub struct ProposalCancelled { pub agreement_key: [u8; 32] }
#[event]
pub struct ChangeProposed { pub agreement_key: [u8; 32], pub version: u32 }
#[event]
pub struct ChangeDecided { pub agreement_key: [u8; 32], pub accepted: bool, pub version: u32 }
#[event]
pub struct SaleSettled { pub seller: Pubkey, pub amount: u64, pub to_seller: u64 }
#[event]
pub struct OffchainPaymentRecorded { pub agreement_key: [u8; 32], pub amount: u64 }
#[event]
pub struct OffchainPaymentConfirmed { pub agreement_key: [u8; 32], pub amount: u64 }
#[event]
pub struct OffchainPaymentDisputed { pub agreement_key: [u8; 32], pub amount: u64 }
#[event]
pub struct AgreementCompleted { pub agreement_key: [u8; 32], pub completed_ts: i64 }

#[error_code]
pub enum GiroError {
    #[msg("Assinatura de quem não é parte do acordo")]
    Unauthorized,
    #[msg("Situação do acordo não permite esta ação")]
    InvalidStatus,
    #[msg("Termos inválidos")]
    InvalidTerms,
    #[msg("Soma dos percentuais passaria de 100% ou a venda não cobre a parte de um acordo")]
    CapacityExceeded,
    #[msg("Acordos ou comissões demais nesta venda (v1)")]
    TooManyAccounts,
    #[msg("Valor zero")]
    AmountZero,
    #[msg("Estouro aritmético")]
    Overflow,
    #[msg("Pagamento acima do restante")]
    ExceedsRemaining,
    #[msg("Acordo ativo ausente ou conta que não é acordo deste programa")]
    MissingAgreement,
    #[msg("Acordos fora da ordem de prioridade")]
    WrongOrder,
    #[msg("Token diferente do acordo")]
    WrongMint,
    #[msg("Acordo de outro vendedor")]
    WrongSeller,
    #[msg("Conta de destino não pertence ao fornecedor")]
    WrongSupplierAccount,
    #[msg("Acordo repetido na venda")]
    DuplicateAgreement,
    #[msg("Já existe um pedido de mudança aguardando decisão")]
    ChangePending,
    #[msg("Não há pedido de mudança")]
    NoPendingChange,
    #[msg("Número de contas não confere com a venda")]
    AccountsMismatch,
    #[msg("Venda acima do teto configurado pelo vendedor")]
    SaleLimit,
    #[msg("Valor fora da menor fração (centavo) do token")]
    InvalidUnit,
}
