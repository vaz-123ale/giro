# GIRO — Programmable revenue and commercial trust for small businesses

*Project document · English version (October 2026). Portuguese original: [Documentacao/](../Documentacao/).*

> **GIRO turns revenue into programmable rules, and commitments kept into verifiable trust.**

---

## 1. Introduction and context

For many small entrepreneurs, the financial challenge does not start with a lack of sales. It starts with not knowing how much of the money coming in is actually available. Revenue, profit and free balance are not the same thing: a sale can raise the account balance while also creating or carrying obligations to suppliers, restocking, helpers, transport and other business expenses. When those obligations are not clearly organized, an entrepreneur can sell a lot and still not know how much they can actually use.

This is a real problem in Brazil. Sebrae's survey *Hábitos Financeiros dos Pequenos Negócios* (released in January 2026) found that **61%** of Brazilian entrepreneurs use their personal account to pay business expenses. Financial control is fragile: only **30%** use spreadsheets, **25%** still keep notes in a notebook and **10%** say they have no form of control at all. Sebrae itself stresses that mixing personal and business money makes it hard to understand the business's real situation, its profitability and its ability to pay.

In practice, selling does not mean having that money available. A vendor can receive R$ 2,000 in a week and see that amount in the account, while part of it is already owed for goods bought earlier, for the next stock or for other commitments. The challenge is not receiving money; it is understanding what came in, what is already committed and what is really free.

At the same time, much of the relationship between small vendors and suppliers is not built on formal credit. Studies of traditional Brazilian markets describe sales on credit based on trust, relationship history and referrals between vendors. In Belém's Ver-o-Peso market, for example, researchers observed credit sales with no formal documentation, sustained by years of relationship or by another vendor's recommendation.

This model has real social value: workers build trust through their own behavior. But that trust stays limited to the people they already deal with. A supplier who has worked with a vendor for years knows their history and may sell on credit. When the vendor looks for a new supplier, moves to another region or starts working in another market, they cannot prove their history of payments and kept commitments. Even after years of successful relationships, they must earn trust again from every new partner.

**GIRO** is a platform to organize revenue, execute commercial commitments and build verifiable trust for small businesses. It lets the entrepreneur record obligations, set priorities and see, simply, how much they received, how much they still owe, how much is already committed and how much is truly available.

Beyond organizing the present, GIRO makes the positive history built through work valuable in the future. When an agreement between a vendor and a supplier is fulfilled, that event can produce a verifiable proof of completion. Over time, the vendor builds their own history of fulfilled agreements, recurring suppliers and settled obligations.

GIRO is not a new bank, does not replace Pix and does not assign an arbitrary credit score. It turns two things that are usually informal, financial commitments and the trust built in commercial relationships, into something clear, programmable and verifiable: helping small entrepreneurs know how much of today's money is really theirs, and letting the commitments they keep build tomorrow's trust.

## 2. How the system works

The vendor registers obligations in GIRO: who should receive, the total amount, the deadline and the priority. For example:

- supplier João: R$ 600 to pay off;
- Pedro, helper: R$ 200;
- restocking: goal of R$ 500;
- savings: goal of R$ 300.

GIRO automatically shows what share of incoming money goes to each.

### Commitment mode (agreements with someone else)

There is a real agreement with another person. Example: Maria owes R$ 600 to supplier João, and both accepted that **20% of GIRO sales go to João until R$ 600 is paid**. When an eligible sale happens, the split is applied automatically; Maria does not decide again at every sale, because she accepted that commitment. **This mode feeds GIRO Confiança.**

### Planning mode (the vendor's own decisions)

There is no third party. Maria just wants to organize: R$ 500 stock, R$ 300 trip, R$ 200 savings, R$ 150 electricity bill. The money stays in Maria's own wallet; GIRO shows *total R$ 2,000 · planned R$ 1,150 · free R$ 850*, and can suggest payments that Maria executes whenever she wants.

**Core idea:** agreements with third parties can be executable; personal planning stays under the vendor's control.
*Commitments* = rules accepted between parties. *Planning* = personal rules the user can change at any time.

### Helpers and commissions

Commissions can be tied to each person's shift. At the start of the day, the owner marks who is active; while Pedro is active, his 8% commission applies automatically to sales in that period, without selecting his name at each sale. Shifts can also come from schedules or from the worker's own check-in and check-out, confirmed by the owner.

## 3. The role of Solana

Solana is not used just to record payments: it is the infrastructure that executes the programmable financial agreements.

When a supplier and a vendor create a commitment in GIRO, the accepted terms are represented by a Solana program. The agreement's state records the original amount, the amount already paid, the remaining balance and the status. When a sale happens, a single transaction can split the payment and update the obligation's balance.

This means **neither party can change what was agreed on their own**. GIRO also does not need to hold users' money: funds move directly between the wallets involved, following the agreed rules.

Personal data (names, tax IDs, phone numbers), detailed amounts and sensitive commercial information are not published on-chain. The network keeps only what is needed to verify that commitments exist and were completed.

## 4. GIRO Confiança — our biggest value

The second part of the project is a direct consequence of the first. When a vendor completes an agreement through GIRO, there is objective evidence that the commitment was fulfilled. That event produces a verifiable proof of completion using the **Solana Attestation Service**.

Over time, the vendor builds a history such as: 18 agreements completed · 4 different suppliers · R$ 8,200 in settled commitments · 16 completed on time · 2 recurring suppliers.

GIRO Confiança shows commitments **fulfilled on time, completed after renegotiation, active and finalized**. Both sides confirm each step, including cash payments, so **no one can certify a commitment alone**. The vendor chooses what to share, by link or QR code.

It is **not a credit score**, not a guarantee of honesty and not a public list of defaulters. GIRO records mainly positive evidence of commitments actually kept, so a vendor can show a new supplier real experience honoring commercial agreements. Today that trust travels informally ("You can sell to her, she always pays"). With GIRO, part of that reputation becomes provable, and a new supplier does not have to trust GIRO: they can verify the record themselves.

## 5. Where we want to go

GIRO is not another digital bank, another Pix system or a full ERP. It is simple infrastructure for programmable revenue for small businesses, answering questions that are hard today:

- How much did I receive?
- How much do I still need to pay?
- How much of my money is already committed?
- How much is really available?
- Which obligations are due first?
- How much is left to pay my supplier?
- Which commitments have I already kept?

Short term: demonstrate a supplier–vendor agreement paid down automatically by sales. Medium term: the same mechanism for self-employed workers, manicurists, home bakers, street sellers, artisans, small salons, drivers and other workers with fragmented income who need to split it across commitments.

## 6. Social value

GIRO's main social value is not making a transfer easier. It is giving more financial autonomy and making visible an economic reputation that usually stays informal. Small vendors can move money and keep commitments for years without turning that behavior into a history they own.

**work → sales → commitments kept → verifiable history → more trust in future deals**

This can reduce the dependence on personal relationships alone to show reliability, and helps entrepreneurs tell money received apart from money actually available. GIRO does not promise automatic credit or replace a supplier's judgment: the decision to sell on credit stays with the parties. GIRO provides verifiable information so that decision can be made with more evidence.

## 7. Who benefits, who adopts and who pays

GIRO has two sides, and each gets something different.

- **The supplier** gets the most direct benefit: paid on time, without chasing, and evidence of who keeps commitments. The supplier is the one who feels the pain of late payments and defaults.
- **The vendor** gets organization from day one, even alone: what came in, what is already committed and what is really free. Over time, they also get a history that can turn into better terms: longer payment periods, higher limits, better prices or the trust of a new supplier.

**Go-to-market: suppliers distribute, vendors build the habit.**

- One supplier serves dozens of vendors. Convincing one supplier brings many users at once, and the supplier invites them: "use GIRO with me".
- Vendors stay because the organization features are useful without the supplier.
- The supplier offers a concrete perk to vendors who use GIRO, such as a few extra days to pay, a higher limit or a small discount.
- **The supplier pays** (a subscription or a fee per tracked agreement), because the supplier is the one who cuts late payments and collection costs. **GIRO is free for vendors.** Later: a fee on payments split on Solana, and paid access for lenders and cooperatives to vendor-shared, verified repayment histories.

## 8. Pilot (next step)

The pilot **has not happened yet**; it is our next step.

- Duration: 2 months, in 3 street markets.
- Participants: 3 suppliers and 12 of their vendors (4 per supplier).
- Offer: free during the pilot, with hands-on support; each supplier offers better terms to vendors who use GIRO.
- What we will measure with suppliers: average delay before and after, time spent collecting, whether they would extend terms or limits based on a GIRO history, and what they would pay.
- What we will measure with vendors: weekly use without the supplier asking, whether they can say how much they can spend, whether they got better terms, and referrals.
- **Key hypothesis:** a supplier improves commercial terms based on a GIRO history. If it holds, the model sustains itself: the supplier pays for the value it gets, and the vendor gains access to better terms.

So far, the team tested the system with **colleagues playing the roles** of vendor, suppliers, helper and customer, using **fictitious business IDs (CNPJs)** created for the test and their own wallets on Solana Devnet. **No real money was used.**

## 9. Why now

- **Pix** made digital payments normal for most Brazilians, including small vendors. The money is digital; the organization and the trust are not.
- **Stablecoins pegged to the real** (such as BRZ) allow on-chain settlement without exposing vendors to crypto volatility.
- **Solana** made the missing pieces practical: sub-cent fees for small sales, programmable payments, Solana Pay, and the Solana Attestation Service for portable proofs.
- **Suppliers** are under pressure from late payments and want better ways to decide whom to trust.

## 10. Competition and what current solutions miss

- **Payment apps and digital accounts** for small businesses (e.g. Mercado Pago, InfinitePay, Nubank PJ) are excellent at receiving money, but show money in, not money already committed to suppliers.
- **Spreadsheets and bookkeeping apps** require extra work that vendors abandon, with no benefit from the other side of the deal.
- **Credit scores** use data the vendor does not see, own or carry. On-chain credit scores depend on wallet and DeFi activity that street vendors do not have.

GIRO treats the supplier–vendor agreement as the product: accepted by both sides, tracked against real sales, confirmed with evidence, and turned into a history the vendor controls and chooses to share.

## 11. Current status (October 2026)

Working prototype, pre-revenue. **GIRO won 1st place at WoHackathon**, where the first version was created. During the Colosseum (Crypto World's Fair, Solana track) we built all of the Solana integration:

- web app in Portuguese and English (PT/EN switch) with a phone-friendly layout (no native app yet);
- Anchor program (Rust) on Solana Devnet: agreements accepted by both sides, changes only with mutual approval, automatic sale splitting, and confirmation or dispute of cash payments;
- Solana Pay checkout with an atomic split in a BRL stablecoin (BRZ; test mint on Devnet);
- each person signs with their own wallet (Phantom, Solflare), with a one-approval "sign all";
- Solana Attestation Service attestations for completed agreements;
- onboarding by WhatsApp invite link, with test wallets funded automatically on Devnet;
- document import (PDF, CSV and text), always reviewed before saving;
- 288 automated tests and 1,165 parity vectors that guarantee the app's split rule and the on-chain program agree to the cent.

**Live demo:** <https://giro-demo-oyy1.onrender.com> (fictional data, simulated chain; test accounts in section 12).
**Open source (MIT):** <https://github.com/vaz-123ale/giro>

## 12. October 2026 updates

Everything below was added after the stall QR code and the split by account type. It was tested only with fictional data (colleagues role-playing suppliers, made-up company IDs, no real money). The pilot is still the next step.

### Three account types, each with its own app

On the sign-in screen, the person chooses which account to enter with. GIRO checks that the account really is of that type; if not, it says which option to choose (e.g. *"This account belongs to a supplier. Choose Supplier to sign in"*). Each account only sees what belongs to it.

| Account | Who | Color | Menu |
|---|---|---|---|
| **My stall** | the vendor | green | Home, Receive, Organize, Commitments, Team, Trust |
| **Supplier** | sells goods to the stall | amber | Dashboard, Agreements, My trust, Stalls, Helpers, Account |
| **Team or buyer** | helper or customer | blue | Jobs, My work, My purchases, Account |

### Test accounts (public demo)

Demo: <https://giro-demo-oyy1.onrender.com>. Fictional data (vendor Maria, supplier João, helper Lia), simulated Solana, reset on every restart. The sign-in screen lists the three accounts with a **Fill in** button.

| Choose on sign-in | Username | Password | What opens |
|---|---|---|---|
| My stall | `dona` | `giro-demo-2026` | Stall app (green) |
| Supplier | `joao` | `giro-demo-2026` | Supplier app (amber), with the R$ 600 agreement at 20% of sales |
| Team or buyer | `lia` | `giro-demo-2026` | Team/buyer app (blue): jobs, work and purchases |

### Stall (vendor)

- **Fixed stall QR code:** printed once and left at the stall. The buyer points the camera, types the amount and pays, with no new code per sale. The agreed split with suppliers and helpers still applies; there is a per-purchase limit and an attempt limit against abuse. If the buyer is signed in, the purchase goes to their history.
- **Debt import:** from **PDF, Excel (.xlsx) or CSV**, with a review table before saving, a help box and a CSV template. Each imported debt creates the contact and sends the agreement invitation.
- **Stall username:** the stall can have its own username, set in *My profile*.
- **Profile menu at the top:** photo, *Edit profile*, *View public profile* and *Log out*.
- **Visual refresh:** clearly separated cards, larger text, new icons, a visible *Back* button, clear confirmations, filters in *Commitments*, and the GIRO logo returning to *Home*.

### Supplier (own app)

- **Dashboard:** receivable, already received, active agreements, *Needs you* (agreements to accept, cash payments to confirm) and recent agreements.
- **Agreements:** every agreement with a progress bar, % of sales, due date and a "registered on Solana" badge.
- **My trust:** the supplier's own GIRO Confiança card (agreements kept, confirmed by both sides) with a share button.
- **Stalls:** the stalls' trust before selling on credit, plus trust profiles.
- **Helpers:** post a job (*Looking for a helper*) and see who is looking for work.
- **Account:** photo, public profile, password, Solana wallet and an invite code for other stalls.

### Team or buyer (own app)

- **Jobs (home screen):** helper jobs with the person's experience checked by GIRO, *I'm interested* and *Looking for work*.
- **My work:** shift (start/end), commission, amount received, cash payments to confirm and agreements.
- **My purchases:** purchases paid through the stall QR while signed in, total spent and the stalls' trust.
- **Account:** photo, public profile, password, wallet and an invite for friends.

### Helper jobs with verified experience

Stalls and suppliers post *Looking for a helper* with rules: minimum **months** of experience and minimum **days worked**. People click *I'm interested*. GIRO checks their experience from the **commissions they actually received** (days worked, months, total) and shows *"Meets the rules"* or *"Does not meet the rules yet"*. Experience is not self-declared: it comes from the history. There is also a *Looking for work* list with summary, contact, trust profile link and a WhatsApp button.

### Site in English

PT / EN switch at the top of every screen and on sign-in (saved in the browser), or add `?lang=en` to the address. "GIRO" and "GIRO Confiança" stay in Portuguese, and amounts use the US format in English.

### Addresses

| Address | Purpose | Note |
|---|---|---|
| <https://giro-demo-oyy1.onrender.com> | Public demo | Always online; fictional data |
| <https://desktop-jg2rfmg.tail00f1d9.ts.net> | Group's fixed link | Needs the team computer running |
| <https://github.com/vaz-123ale/giro> | Source code | MIT license |

## 13. Design decisions and open questions

**What if a due date is close and the debt isn't paid?** GIRO cannot create money or change an accepted agreement. It detects the risk early and shows what must happen. Example: R$ 600 left, due in 5 days, recent revenue R$ 200/day (R$ 1,000 projected): about 60% of projected revenue would be needed. If it is the vendor's own rule, they can raise the percentage. If it is an agreement with the supplier, GIRO proposes a change ("from 30% to 60%") that the supplier accepts or rejects. If even 100% would not be enough, GIRO says so clearly and suggests renegotiating the date.

**Can GIRO suggest how much to set aside?** Yes, considering priorities and a minimum the vendor wants to keep. GIRO talks about **projected free balance**, not profit: profit requires knowing the cost of goods, expenses and losses.

**How does the customer pay?** In the prototype: QR code → Solana Pay → SPL token/stablecoin → GIRO rule. Pix and cards are not native Solana Pay; in the future they can connect through a payment provider, with the split depending on that partner's capabilities. MVP: native Solana/stablecoin payments. Next: Pix and card connectors.

**What about cash sales?** Blockchain does not move physical cash. GIRO has a large "+ Cash sale" button, records the sale (amount, shift, time) and computes how much of the cash belongs to each obligation, showing at closing: *expected cash R$ 420 · committed R$ 170 · free R$ 250*. It also stores **sale date ≠ payment date**, so a helper's commission follows the original sale. On-chain payments generate proofs automatically; cash payments require confirmation by both parties to reach the same level of verification.

**Why GIRO and not a regular bank or finance app?** Parts of GIRO could run on a regular database. The difference appears when there are economically independent parties (Maria, supplier João, helper Pedro and GIRO itself). With a single database, everyone must trust that GIRO will not change the agreement, will compute correctly, will not alter the history and will keep existing. With Solana, the shared execution of the rule and the proofs live on infrastructure that no single party owns, and the Solana Attestation Service was designed for verifiable claims such as reputation. *A bank shows how much you have. GIRO shows how much is really free, executes commitments between independent parties and turns kept commitments into verifiable trust.*

**Interface.** Very low cognitive load. The home screen shows *came in today · already committed · free for you*, with simple actions. Users never need to see tokens, blockchain, PDAs, attestations or transaction hashes. The product areas are **GIRO Receive** (record or receive the sale), **GIRO Organize** (obligations, priorities, planning and what is really free), **GIRO Commit** (programmable agreements with third parties) and **GIRO Confiança** (fed only by verifiable agreements).

**Smart document import.** Users can send documents they already have (PDFs, images, statements, bills, reports, spreadsheets). GIRO reads them and identifies amounts due, due dates, recurring suppliers and fixed bills, but **never saves anything without the user's review**. Example: "3 commitments found: supplier João, R$ 600, due 10/08; rent, R$ 900, due 10/10; electricity, R$ 184.70, due 10/14. Review and add?" It can also suggest recurring commitments. Import automates data entry; it never makes financial decisions alone.

## 14. Technologies

- **Blockchain:** Solana (Devnet), Anchor/Rust, SPL Token (BRZ), Solana Pay, Wallet Standard, Solana Attestation Service, @solana/kit, Codama.
- **Application:** Node.js, TypeScript, React, Vite, SQLite.
- **Development tools:** WSL/Ubuntu, Git/GitHub, Render (public demo), Tailscale (group test).
- **AI tools:** Claude Code as a coding assistant, an image-generation tool for the pitch illustrations, and Kokoro (open-source text-to-speech) for the video narration.

## 15. Team

Four Brazilian women:

- **Alessandra Vaz** — created the idea and the project; product and development; background in mathematics.
- **Talita** — graphic design.
- **Ana Clara Teixeira** — system review and testing.
- **Melissa Gameleira** — pitch, slides and marketing.

We currently work on GIRO part-time, alongside our studies and jobs, and plan to go full-time if funded.

## 16. Prior work disclosure

The concept and the first version of the app (without blockchain) came from **WoHackathon**, where GIRO won 1st place. All Solana work was built during the Colosseum period (September 14 – October 12, 2026).

## What we will defend

> Today, a small vendor receives money first and tries to organize it later. With GIRO, they set the rules once and every sale is born organized.
>
> Today, commercial trust lives in the memory of whoever knows you. With GIRO, every commitment kept builds a verifiable history that follows the vendor into their next deal.

We are not creating another crypto wallet, simply putting payments on a blockchain, launching our own token, or replacing banks and lending. We use specific Solana capabilities so that two independent parties can set a financial rule, execute it automatically as sales happen, and produce verifiable evidence when the commitment is fulfilled. **The payment is the start of the process, not the whole product.**
