# Prontidão para integração — 03/10/2026, 01:25:04

Situação: **tudo local**. Este relatório só descreve; nada foi enviado. Cada integração exige autorização explícita.

## Pontos de integração

| Área | Hoje (local) | Módulo | Depois (com autorização) | Pré-requisito |
|---|---|---|---|---|
| Execução dos acordos | Motor local: divisão da venda, limite do restante e conclusão (SQLite). | `src/domain/finance.ts (calculateDistribution) · server/financial-service.ts` | Programa Anchor com uma conta (PDA) por acordo guardando ledgerSnapshot(); primeiro no solana-test-validator. | Instalar Rust/Solana/Anchor (download) e usar validator local. |
| Prova de conclusão | Código SHA-256 do registro mínimo, arquivo de histórico e verificação local. | `src/domain/proof.ts` | Registrar attestationPayloads() (só a impressão digital) no Solana Attestation Service. | Rede local primeiro; Devnet só com autorização separada. |
| Recebimento da venda | QR de cobrança simulado neste computador; dinheiro confirmado manualmente. | `server/payment-service.ts · src/domain/qr.ts` | Solana Pay com token de demonstração; depois conector Pix/cartão via parceiro. | Carteira/token locais; parceiro externo exige autorização. |
| Aceite e confirmação da outra parte | Links locais com token aleatório (convite, confirmação de recebimento, check-in). Sem login. | `server/invitation-service.ts · server/receipt-service.ts · server/shift-request-service.ts` | Assinatura da carteira de cada parte ou autenticação real. | Depende da escolha de carteira/autenticação. |
| Importação de documentos | CSV/TXT/texto colado lido no navegador, com revisão. | `src/domain/import.ts` | Leitura de PDF/imagem (OCR) e planilhas. | Bibliotecas/modelos externos exigem autorização. |
| Armazenamento | SQLite local com transações atômicas e backup antes de migrações. | `server/store.ts` | PostgreSQL ou outro banco, mantendo o mesmo formato de estado. | Migração para nuvem não pode ser automática. |

## O que iria para a rede (prévia calculada dos dados atuais)

- Acordos que teriam conta própria no programa: **5** (1 ativos, 3 concluídos).
- Comprovantes de conclusão que seriam atestados: **3** (2 no prazo).
- Campos pessoais encontrados nesses dados: **nenhum ✅**.

Exemplo de conta de acordo (chave é hash; sem nome):

```json
{
 "agreementKey": "b1e368e1829ff576bb05942b6f6188f94472ac0ef1c588c0b809d788c2b647f0",
 "original": 700000,
 "paid": 30000,
 "remaining": 670000,
 "rateBps": 2500,
 "priority": 1,
 "status": "cancelled",
 "version": 1
}
```

Exemplo de comprovante a atestar:

```json
{
 "agreementKey": "281775af62d07bf5c758e453cecdb0a000b2e31a138be2340d68b79648faedf4",
 "recordFingerprint": "6803342417fd8497f700c24ff7d9741c9309294371c46c01e5f11a1a8bda5529",
 "completedAt": "2026-10-02",
 "onTime": true
}
```

## Permanece só neste computador

`supplier`, `counterparty`, `name`, `phone`, `note`, `contactId`, `recipient`, `participant`, `description`, `category`, telefones, observações, caixa físico, equipe e histórico detalhado.

Total ainda em aberto nos acordos ativos: R$ 1.993,75.
