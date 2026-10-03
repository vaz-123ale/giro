//! Regras puras da divisão de uma venda, sem Anchor e sem contas.
//! IDÊNTICAS a `src/domain/chain-model.ts` (modelo de referência) e a `calculateDistribution()`
//! do GIRO; a igualdade é conferida pelos vetores gerados de `tests/chain-parity-fixture.ts`.

pub const BPS_DENOMINATOR: u128 = 10_000;
pub const MAX_BPS: u16 = 10_000;
pub const MAX_PRIORITY: u16 = 999;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuleError {
    Overflow,
    InvalidTerms,
    CapacityExceeded,
}

/// floor(valor × bps / 10000), com intermediário u128 (nunca perde precisão nem estoura).
pub fn share(amount: u64, rate_bps: u16) -> Result<u64, RuleError> {
    if rate_bps > MAX_BPS {
        return Err(RuleError::InvalidTerms);
    }
    let wide = (amount as u128)
        .checked_mul(rate_bps as u128)
        .ok_or(RuleError::Overflow)?
        / BPS_DENOMINATOR;
    u64::try_from(wide).map_err(|_| RuleError::Overflow)
}

/// Resultado da divisão, na mesma ordem das contas da transação.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Split {
    pub fixed: Vec<u64>,
    pub percent: Vec<u64>,
    /// Uma parte por acordo, na ordem recebida (0 = acordo não recebe nesta venda).
    pub agreements: Vec<u64>,
    pub seller: u64,
}

/// Ordem da regra: 1. fixos por venda; 2. comissões %; 3. acordos (já ordenados); 4. resto ao vendedor.
/// Cada acordo recebe min(parte, restante) INTEIRO; se não couber, a venda é recusada.
/// `agreements`: (bps, restante do acordo) em ordem de liquidação.
pub fn split(
    amount: u64,
    fixed: &[u64],
    percent_bps: &[u16],
    agreements: &[(u16, u64)],
) -> Result<Split, RuleError> {
    let mut available = amount;
    let mut out = Split::default();
    for f in fixed {
        let part = (*f).min(available);
        available -= part;
        out.fixed.push(part);
    }
    for bps in percent_bps {
        let part = share(amount, *bps)?.min(available);
        available -= part;
        out.percent.push(part);
    }
    for (rate, remaining) in agreements {
        let part = share(amount, *rate)?.min(*remaining);
        if part > available {
            return Err(RuleError::CapacityExceeded);
        }
        available -= part;
        out.agreements.push(part);
    }
    out.seller = available;
    Ok(out)
}

/// Igual a `split`, mas cada parte percentual é arredondada para baixo ao múltiplo de `unit`
/// (ex.: BRZ com 4 casas → unit = 100 = 1 centavo). Com valores em múltiplos de `unit`, o resultado é
/// exatamente o do GIRO em centavos × unit.
pub fn split_units(
    amount: u64,
    fixed: &[u64],
    percent_bps: &[u16],
    agreements: &[(u16, u64)],
    unit: u64,
) -> Result<Split, RuleError> {
    if unit == 0 {
        return Err(RuleError::InvalidTerms);
    }
    let round = |v: u64| (v / unit) * unit;
    let mut available = amount;
    let mut out = Split::default();
    for f in fixed {
        let part = (*f).min(available);
        available -= part;
        out.fixed.push(part);
    }
    for bps in percent_bps {
        let part = round(share(amount, *bps)?).min(available);
        available -= part;
        out.percent.push(part);
    }
    for (rate, remaining) in agreements {
        let part = round(share(amount, *rate)?).min(*remaining);
        if part > available {
            return Err(RuleError::CapacityExceeded);
        }
        available -= part;
        out.agreements.push(part);
    }
    out.seller = available;
    Ok(out)
}

/// Ordem exigida: prioridade e depois data de criação, não decrescentes (empates na ordem enviada).
pub fn in_order(prev: (u16, i64), next: (u16, i64)) -> bool {
    prev <= next
}

/// Termos válidos: valor > 0, 0 < bps ≤ 100%, prioridade 1..=999.
pub fn valid_terms(original: u64, rate_bps: u16, priority: u16) -> bool {
    original > 0 && rate_bps > 0 && rate_bps <= MAX_BPS && (1..=MAX_PRIORITY).contains(&priority)
}

/// Capacidade do vendedor: soma dos bps reservados nunca passa de 100%.
pub fn reserve(committed: u16, bps: u16) -> Result<u16, RuleError> {
    let total = committed.checked_add(bps).ok_or(RuleError::Overflow)?;
    if total > MAX_BPS {
        return Err(RuleError::CapacityExceeded);
    }
    Ok(total)
}

pub fn release(committed: u16, bps: u16) -> Result<u16, RuleError> {
    committed.checked_sub(bps).ok_or(RuleError::Overflow)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documento_100_reais() {
        // R$ 100: Pedro 8%, João 20% (faltam R$ 600) → 8 / 20 / 72.
        let s = split(10_000, &[], &[800], &[(2_000, 60_000)]).unwrap();
        assert_eq!(s.percent, vec![800]);
        assert_eq!(s.agreements, vec![2_000]);
        assert_eq!(s.seller, 7_200);
    }

    #[test]
    fn nunca_acima_do_restante() {
        let s = split(10_000, &[], &[], &[(2_000, 300)]).unwrap();
        assert_eq!(s.agreements, vec![300]);
        assert_eq!(s.seller, 9_700);
    }

    #[test]
    fn comissao_que_zeraria_fornecedor_e_recusada() {
        assert_eq!(split(10_000, &[], &[10_000], &[(2_000, 60_000)]), Err(RuleError::CapacityExceeded));
        assert_eq!(split(10_000, &[9_000], &[], &[(2_000, 60_000)]), Err(RuleError::CapacityExceeded));
    }

    #[test]
    fn share_sem_perda() {
        assert_eq!(share(9_999, 3_333), Ok(3_332));
        assert_eq!(share(u64::MAX, 10_000), Ok(u64::MAX));
        assert_eq!(share(1, 9_999), Ok(0));
        assert_eq!(share(1, 10_001), Err(RuleError::InvalidTerms));
    }

    #[test]
    fn ordem_e_capacidade() {
        assert!(in_order((1, 10), (1, 10)));
        assert!(in_order((1, 10), (2, 0)));
        assert!(!in_order((2, 0), (1, 10)));
        assert_eq!(reserve(8_000, 2_000), Ok(10_000));
        assert_eq!(reserve(8_000, 2_001), Err(RuleError::CapacityExceeded));
        assert_eq!(release(100, 101), Err(RuleError::Overflow));
        assert!(!valid_terms(0, 1, 1) && !valid_terms(1, 0, 1) && !valid_terms(1, 1, 0) && !valid_terms(1, 1, 1000));
    }

    /// Vetores gerados do motor do GIRO (npm run solana:vetores). Igualdade centavo por centavo.
    #[test]
    fn paridade_com_o_giro() {
        let mut compared = 0;
        for (i, v) in crate::paridade_vetores::VETORES.iter().enumerate() {
            let got = split(v.amount, v.fixed, v.percent, v.agreements);
            match v.expected {
                Some((fixed, percent, agreements, seller)) => {
                    let s = got.unwrap_or_else(|e| panic!("vetor {i}: {e:?}"));
                    assert_eq!((s.fixed.as_slice(), s.percent.as_slice(), s.agreements.as_slice(), s.seller), (fixed, percent, agreements, seller), "vetor {i}");
                    compared += 1;
                }
                None => assert_eq!(got, Err(RuleError::CapacityExceeded), "vetor {i}"),
            }
        }
        assert!(compared >= 800, "vendas comparadas: {compared}");
    }

    /// Mesmos vetores com BRZ (4 casas, unit = 100): resultado = GIRO em centavos × 100, centavo por centavo.
    #[test]
    fn paridade_em_unidades_do_brz() {
        let u = 100u64;
        for (i, v) in crate::paridade_vetores::VETORES.iter().enumerate() {
            let fixed: Vec<u64> = v.fixed.iter().map(|x| x * u).collect();
            let agreements: Vec<(u16, u64)> = v.agreements.iter().map(|(r, x)| (*r, x * u)).collect();
            let got = split_units(v.amount * u, &fixed, v.percent, &agreements, u);
            match v.expected {
                Some((f, p, a, s)) => {
                    let s2 = got.unwrap_or_else(|e| panic!("vetor {i}: {e:?}"));
                    let x = |v: &[u64]| v.iter().map(|y| y * u).collect::<Vec<_>>();
                    assert_eq!((s2.fixed, s2.percent, s2.agreements, s2.seller), (x(f), x(p), x(a), s * u), "vetor {i}");
                }
                None => assert_eq!(got, Err(RuleError::CapacityExceeded), "vetor {i}"),
            }
        }
    }
}
