# GIRO — Colosseum Crypto World's Fair submission

**Track:** Solana · **Repository:** https://github.com/vaz-123ale/giro · **Live demo:** https://giro-demo-oyy1.onrender.com (user `dona`, password `giro-demo-2026`; fictional data, simulated chain; first load may take ~1 min)

## One-liner

GIRO lets small businesses split every sale automatically among suppliers, helpers and themselves on Solana, and turns each agreement they keep into verifiable trust.

## Short description (≤ 280 characters)

Street-market sellers owe part of each sale to suppliers and helpers. GIRO lets them agree once on the split, and then every Solana Pay sale settles atomically to each party in a BRL stablecoin, with on-chain attestations as their credit history.

## Problem

Brazil has more than 15 million registered micro-entrepreneurs (MEIs), plus millions of informal street-market sellers. Many of them buy goods on credit from suppliers and pay helpers on commission. Who gets what from each sale is tracked in notebooks and WhatsApp messages. That causes three problems:

1. **Disputes.** Nobody can show what was agreed or what was already paid.
2. **No credit history.** A seller who always pays their supplier has nothing to prove it, so credit stays expensive or unavailable.
3. **Cash-flow blindness.** The seller sees R$ 100 come in but doesn't know how much of it is really hers.

## Solution

- The seller and each partner **agree once** on a rule ("20% of each sale until R$ 300 is paid", "8% commission while on shift"). Both sides sign it with their own wallet; changes need both signatures.
- The customer pays with **Solana Pay**. In the same transaction the program `giro_acordos` **splits the payment** by priority and caps (fixed fees → commissions → agreements by priority → seller). It never pays more than is owed, and the shares never go over 100%.
- **Cash sales** are recorded by the seller and confirmed (or disputed) by the supplier on-chain, so informal payments count too.
- When an agreement is fully paid, GIRO issues a **Solana Attestation Service** record. It is a portable, privacy-preserving proof that the seller keeps their word.
- The app shows the seller what is **really free** after every obligation.

## Why it needs Solana

Per-sale splits of R$ 5–50 only work with sub-cent fees and sub-second finality. Atomic multi-party settlement removes the trust problem: the supplier doesn't have to trust that the seller will pay later, because the money arrives with the sale. SAS attestations and Wallet Standard make the trust history portable and self-custodial.

## UX for people who have never used crypto

- **Join by invite link:** the person sets their own username, password and photo, then connects a wallet on the same screen. On Devnet the wallet is auto-funded with test SOL and test BRZ.
- **"Sign everything" banner:** all pending signatures are batched into one wallet approval.
- **Balances, personal invite codes with referrals, and a public trust profile** (link, QR, WhatsApp, NFC).
- **Fully in Portuguese**, with large text and high-contrast modes. Personal data never goes on-chain.

## Technical highlights

- Anchor 1.2 program with PDAs for seller, agreement and cash records. `settle_sale` uses remaining accounts and an optional Solana Pay reference.
- 1,165 parity vectors generated from the TypeScript split engine and checked in `cargo test`, so the app's preview and the chain always agree to the cent.
- Transactional outbox: every change in the app's SQLite is mirrored to the chain with per-agreement ordering, retries and signature batching (up to 4 instructions per transaction).
- Codama-generated client, @solana/kit, sas-lib, Wallet Standard and a Solana Pay transaction-request endpoint.
- 288 automated tests, including the full wallet-signing flow run against real Devnet.

## Business model and go-to-market

- **Two sides, different value.** The supplier gets the most direct benefit: paid on time without chasing, plus evidence of who honors commitments. The vendor gets value on day one, even alone: knowing what money is really available. Over time, the vendor's history can turn into better terms: longer payment periods, higher limits, better prices, or the trust of a new supplier.
- **Suppliers distribute, vendors build the habit.** One supplier serves dozens of vendors, so convincing one supplier brings many users at once, and the supplier is the one who invites ("use GIRO with me"). Vendors stay because the money-organization features are useful without the supplier.
- **Who pays:** the supplier (subscription or a fee per tracked agreement), because the supplier is the one who cuts late payments and collection costs. GIRO is free for vendors. Suppliers offer a concrete perk to vendors who use GIRO, such as a few extra days to pay, a higher limit or a small discount.
- **Planned pilot (next step, not yet run; 2 months, 3 markets):** 3 suppliers and 12 of the vendors they serve (4 each), free during the pilot, with hands-on support. We will measure, for suppliers: average delay before and after, time spent collecting, whether they would extend better terms based on GIRO history, and what they would pay. For vendors: weekly use without the supplier asking, whether they can say what they can spend, whether they got better terms, and referrals.
- **Key hypothesis:** a supplier improves commercial terms based on a GIRO history. If that holds, the model sustains itself: the supplier pays for the value it gets, and the vendor gains access to better terms.
- **Later:** partnerships with street-market associations and microcredit cooperatives; attestations as an entry point for lenders who value verified repayment history.
- **Next technical steps:** a small capped mainnet pilot with BRZ, a security audit and multisig upgrade authority, a regulatory review of Brazil's Central Bank (BCB) payment rules, and PIX on/off-ramp partners.

## Prior work disclosure

- **Before the Contest Period:** the GIRO concept and an off-chain bookkeeping app (React UI in Portuguese, SQLite, the split engine for planning).
- **During the Contest Period (Sep 14 – Oct 12, 2026), all of the Solana work:** the Anchor program `giro_acordos` and its parity tests, the TypeScript chain model, the transactional outbox and Solana adapter, wallet signing and batch signing, Solana Pay checkout with the atomic split, cash confirm/dispute, SAS attestations, Devnet deployment and a role-play test with colleagues (fictitious business IDs, own wallets, no real money), logins and profiles for partners, onboarding by invite link with auto-funded wallets, PDF import and the public demo. The Git history starts on Oct 3, 2026.

## Team

| Name | Role | Registered on colosseum.com |
|---|---|---|
| *[name]* | Founder, product and development | ☐ |

*(Every team member must register individually on colosseum.com before Oct 12, 2026, 11:59pm PT.)*
