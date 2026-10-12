# GIRO — Programmable revenue and verifiable trust for small businesses

*Português: [LEIAME.md](LEIAME.md)* · **Full project document (English): [docs/GIRO-project-document-EN.md](docs/GIRO-project-document-EN.md)**

**Live demo:** https://giro-demo-oyy1.onrender.com (user `dona`, password `giro-demo-2026`) — fictional data, simulated Solana program; the login screen shows the demo credentials. The free host sleeps when idle, so the first visit can take about a minute.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/vaz-123ale/giro)

GIRO turns a small business's revenue into **programmable rules** and every commitment kept into **verifiable trust**.

A street-market seller in Brazil sells R$ 10 of cheese. Part of that money already belongs to the supplier who fronted the goods, part to the helper on commission, and the rest is hers. Today this split lives in a notebook and on trust. With GIRO, the seller and each partner agree once on the split (e.g. "20% of each sale until R$ 300 is paid"), both sign the agreement with their own wallet, and **every sale settles itself on Solana**: the customer pays with Solana Pay and, in the same transaction, the supplier, the helper and the seller each receive their share in a BRL stablecoin. Every agreement fulfilled becomes an on-chain attestation the seller can show to get more credit next time.

## Why Solana

- **Atomic split per sale.** One `settle_sale` instruction distributes a single payment to up to N parties by priority and caps (fixed fees → commissions → agreements by priority → seller), never paying more than is owed and never exceeding 100%.
- **Cents-level fees.** A R$ 10 sale can carry its own split; that only makes sense on a network with sub-cent fees and sub-second confirmation.
- **Solana Pay** for the customer (QR / wallet link with a reference to find the payment), **Wallet Standard** for every party signing their own agreements, **Solana Attestation Service (SAS)** for portable trust records.
- **BRL stablecoin (BRZ)** so nobody is exposed to volatility.

## What is on-chain vs off-chain

| On-chain (program `giro_acordos`, Anchor) | Off-chain (GIRO app, SQLite) |
|---|---|
| Seller account with per-sale cap | Names, photos, phone numbers (never on-chain) |
| Agreement PDAs: proposal → accept/reject, changes only with both signatures | Planning, goals, team shifts, receipts |
| `settle_sale`: atomic multi-party split of each payment | Notifications, invites, profiles |
| Cash payments recorded by seller, confirmed or disputed by supplier | Transactional outbox mirroring every change to the chain |
| SAS attestation when an agreement is completed | |

Program ID (Devnet): `CVAQPvyjepuDP9j5df22ipp9E7XWVxej1T26rb4NvEMV`

## Easy for non-crypto people

- **Join by invite link** — the owner sends `…/participar/GIRO-XXXXXX` on WhatsApp; the person picks their own username, password and photo and connects a wallet in the same screen. Nobody types passwords for others.
- **"Sign everything" banner** — all pending signatures (proposals, accepts, cash confirmations) batched into one wallet approval.
- **Balances inside the app**, **personal invite code** with referrals, **public trust profile** shareable by link, QR, WhatsApp or NFC.
- Portuguese interface, large text and high-contrast options.

## Run it

Requirements: Node.js ≥ 24.15. Dependencies are vendored in `node_modules`.

```bash
npm run dev            # app on http://127.0.0.1:5173 (API on 127.0.0.1:3001), chain disabled
npm run dev:rede       # same, with the simulated chain (TypeScript model of the program)
npm test               # 288 automated tests (6 need the local validator)
npm run demo           # fictional demo data on http://127.0.0.1:3019
npm run publico        # Devnet + https tunnel for group testing (requires `npm run senha` and `npm run build`)
```

Solana program (WSL/Linux): `solana/scripts/compilar-e-testar.sh` builds and runs `cargo test` (including 1,165 parity vectors generated from the TypeScript split engine) and the localnet integration tests. Devnet deployment: `solana/scripts/publicar-devnet.sh`.

## Repository map

```
src/            React UI and business rules (src/domain: split engine, capacity, chain model)
server/         Node API + SQLite; server/chain: outbox, Solana adapter, Solana Pay, SAS, wallets
solana/         Anchor program giro_acordos, Codama client, build scripts
tests/          automated tests (domain, API, chain parity, wallet-signing flow on Devnet)
colosseum/      hackathon submission material (English)
```

## Safety

- Mainnet is disabled unless explicitly authorized (`GIRO_AUTORIZACAO_MAINNET=sim`) and capped per sale.
- No personal data on-chain; on-chain records use opaque keys.
- The server listens only on 127.0.0.1; external access is via an https tunnel with login, HttpOnly/SameSite=Strict sessions and scrypt passwords.
- Each party signs with their own wallet; GIRO never holds user keys in wallet mode.

## License

[MIT](LICENSE)
