// Gera os vetores de paridade GIRO × programa para o `cargo test` do programa Rust.
// Fonte: tests/chain-parity-fixture.ts (motor do GIRO + modelo de referência, já conferidos entre si).
// Uso: npm run solana:vetores   (gera solana/programs/giro_acordos/src/paridade_vetores.rs)
import {writeFileSync} from 'node:fs';
import {parityVectors} from '../tests/chain-parity-fixture.ts';

const list=a=>`&[${a.join(', ')}]`;
const vectors=parityVectors(400).filter(v=>v.expected!==undefined);
const rows=vectors.map(v=>`    Vetor { amount: ${v.amount}, fixed: ${list(v.fixed)}, percent: ${list(v.percent)}, agreements: &[${v.agreements.map(([r,x])=>`(${r}, ${x})`).join(', ')}], expected: ${v.expected?`Some((${list(v.expected.fixed)}, ${list(v.expected.percent)}, ${list(v.expected.agreements)}, ${v.expected.seller}))`:'None'} },`);
const rust=`//! GERADO por scripts/gerar-vetores-paridade.mjs a partir do motor do GIRO — não editar à mão.
//! ${vectors.filter(v=>v.expected).length} vendas com divisão esperada + ${vectors.filter(v=>v.expected===null).length} vendas que a rede deve recusar.

pub struct Vetor {
    pub amount: u64,
    pub fixed: &'static [u64],
    pub percent: &'static [u16],
    pub agreements: &'static [(u16, u64)],
    /// (fixos, comissões %, acordos, vendedor); None = CapacityExceeded.
    pub expected: Option<(&'static [u64], &'static [u64], &'static [u64], u64)>,
}

pub const VETORES: &[Vetor] = &[
${rows.join('\n')}
];
`;
writeFileSync('solana/programs/giro_acordos/src/paridade_vetores.rs',rust);
console.log(`Gerado solana/programs/giro_acordos/src/paridade_vetores.rs (${vectors.length} vetores).`);
