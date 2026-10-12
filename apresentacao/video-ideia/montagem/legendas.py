"""Gera roteiro-legendas.srt: a narração do roteiro final, encaixada na janela de cada cena (para gravar/alinhar o áudio)."""
CENAS = [
    (0, 8, ["Meet Maria. She sells all day.", "Customers come, and payment notifications keep ringing."]),
    (8, 20, ["Except her business money shares an account with groceries and supplier bills.",
             "Some sales go into a notebook; others vanish in the rush.", "What can she actually spend?"]),
    (20, 32, ["Sebrae reports that 61% pay business expenses with personal accounts,",
              "25% use notebooks, and 10% don't track finances at all."]),
    (32, 37, ["But there's another invisible asset: trust."]),
    (37, 47, ["João buys supplies and agrees to pay later.", "His neighbor interrupts:", "NEIGHBOR: You can trust João!"]),
    (47, 59, ["Around here, everyone knows him.", "But in a new market, he's a stranger.",
              "How can the next supplier see the commitments he honored?"]),
    (59, 67, ["His relationships mattered. But their history didn't travel.", "Until GIRO."]),
    (67, 80, ["GIRO organizes recorded income, reserves, and obligations.",
              "Maria registers a thousand reais.", "Four hundred are reserved; six hundred remain available based on her records."]),
    (80, 92, ["Planning is her own decision.",
              "A shared commitment is different: João and his supplier review and accept the same commercial terms."]),
    (92, 106, ["They agree the supplier is owed twenty percent of registered sales.",
               "Later, evidence and appropriate confirmations document whether the obligation was fulfilled.",
               "João cannot certify it alone."]),
    (106, 122, ["Now GIRO Confiança shows commitments fulfilled on time, completed after renegotiation, active, and finalized.",
                "Not a credit score. Not a guarantee of honesty.", "A history with traceable records."]),
    (122, 135, ["In a new market, João shares selected entries.",
                "JOÃO: Don't just take my word. Check the agreements I fulfilled.",
                "These records can be verified beyond GIRO."]),
    (135, 150, ["JOÃO: But what if GIRO changes my history?", "That's why Solana matters.",
                "Minimal proofs of accepted agreements and confirmed outcomes can be checked independently,",
                "while private contracts stay off-chain."]),
    (150, 160, ["Solana supports low-cost transactions and programmable payment rules.",
                "Future compatible payments could be split automatically.", "It verifies records—not fruit deliveries."]),
    (160, 175, ["We're four Brazilian women across mathematics, software development, marketing, and graphic design.",
                "Our pilot: three suppliers and twelve of their vendors, in three markets.",
                "Free for vendors, with better terms for those with a GIRO history."]),
    (175, 180, ["Money organized today, trust for tomorrow.", "That's GIRO."]),
]

def ts(t):
    ms = round(t * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

def main():
    out, n = [], 1
    for a, b, falas in CENAS:
        a2, b2 = a + 0.3, b - 0.3
        pesos = [len(f.split()) + 2 for f in falas]
        t = a2
        for f, p in zip(falas, pesos):
            d = (b2 - a2) * p / sum(pesos)
            out.append(f"{n}\n{ts(t)} --> {ts(t + d - 0.05)}\n{f}\n")
            t += d; n += 1
    open('roteiro-legendas.srt', 'w', encoding='utf-8').write("\n".join(out))
    print(n - 1, 'legendas')

if __name__ == '__main__':
    main()
