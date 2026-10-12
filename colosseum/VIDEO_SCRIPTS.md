# Video scripts (English)

The pitch video runs 2–3 minutes and the demo video runs 3 minutes or less. Anyone who appears on screen (faces, names, photos) must give permission. Use the test accounts, or blur real names.

---

## Pitch video (~2:30)

**Animated version (recommended):** open `apresentacao/video-ideia/index.html` in Microsoft Edge, press F11, start recording (Win + Alt + R) and click *Começar*. It plays a ~2:45 illustrated story (Maria, João, Pedro) with English narration and captions. The text below is the earlier talking-head version.

**[0:00 – 0:20] Hook.** *(Market stall footage, or a photo of a notebook full of debts.)*
"This is how millions of small sellers in Brazil keep track of who they owe: a notebook. Every sale, part of the money belongs to the supplier who fronted the goods, part to the helper on commission. Nobody can prove what was agreed, and the seller who always pays has no credit history to show for it."

**[0:20 – 0:50] Solution.**
"GIRO turns that notebook into programmable revenue. The seller and her supplier agree once: twenty percent of each sale until three hundred reais are paid. Both sign with their own wallet. From then on, every sale settles itself on Solana. The customer pays with Solana Pay, and in that same transaction the supplier, the helper and the seller each get their share in a Brazilian-real stablecoin."

**[0:50 – 1:20] Why Solana.**
"This only works on Solana. A ten-real sale can carry its own split because fees are a fraction of a cent and confirmation is instant. The split is atomic, so the supplier doesn't need to trust anyone. And when an agreement is paid off, GIRO issues a Solana Attestation: proof that this seller keeps her word, which she owns and can take to any lender."

**[1:20 – 1:50] UX and traction.**
"Our users have never touched crypto, so GIRO hides it. The supplier gets a WhatsApp invite link, creates her account and connects a wallet on one screen, and signs everything with one tap. We are running it now with a real group, a seller, her suppliers and her helper, on Devnet."

**[1:50 – 2:20] Business.**
"Suppliers pay, vendors use GIRO for free. One supplier serves dozens of vendors and wants to be paid on time, so suppliers bring their vendors and offer better terms to those with a GIRO history. Our pilot: three suppliers and twelve of their vendors, in three markets."

**[2:20 – 2:30] Close.**
"GIRO: every sale already split, every promise kept on-chain. Small business credit, built one sale at a time."

---

## Demo video (≤ 3:00)

Before recording:
- Run `npm run publico`.
- Have two browsers ready: the seller (owner) and the supplier (Phantom on Devnet).
- Have a third wallet ready for the customer.
- Have the Solana Explorer (Devnet) open.

1. **[0:00 – 0:25] Owner dashboard.** Show "Início": money in, already committed, really free. Say "GIRO is in Portuguese for our users; I'll narrate in English."
2. **[0:25 – 0:55] Invite.** Go to Mais → Pessoas e perfis → Convidar pessoas → Fornecedor(a) → link + QR. In the second browser, open the link. The supplier picks a name, username, password and photo, then clicks Conectar minha carteira. Phantom signs the message and the wallet is auto-funded.
3. **[0:55 – 1:25] Agreement.** The owner creates the agreement (20% up to R$ 300, priority 1). The "1 assinatura pendente — Assinar tudo" banner appears; one Phantom approval. The supplier opens Minha conta, accepts and signs. Show the agreement account on the Explorer.
4. **[1:25 – 2:15] Sale.** Receber → R$ 10 → QR. The customer's wallet scans it or clicks "Pagar agora", and the transaction confirms. Open it on the Explorer: one transaction, three transfers (supplier R$ 2.00, helper, seller). The supplier's balance in Minha conta goes up.
5. **[2:15 – 2:40] Cash and trust.** Record a cash payment. The supplier confirms it with one tap. Open the public profile /p/… to show the trust score and the attestation.
6. **[2:40 – 3:00] Close.** Show the code briefly: `solana/programs/giro_acordos`, the parity tests and `npm test` passing.
