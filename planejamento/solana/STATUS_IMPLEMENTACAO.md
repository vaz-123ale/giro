# GIRO × Solana — andamento da implementação

Atualizado em 03/10/2026. Referência: [PLANO_IMPLEMENTACAO_SOLANA.txt](PLANO_IMPLEMENTACAO_SOLANA.txt).

Tudo continua **local**: validador só em 127.0.0.1 e token BRL-T **de teste**, sem valor. A rede é **opcional e vem desligada** (`GIRO_SOLANA_CLUSTER=disabled`); desligada, o GIRO funciona como antes. `npm run verificar` → **APROVADO** (285 testes e 34 telas).

## Autorizações

| Item | Situação |
|---|---|
| A1 — WSL2 + Ubuntu | ✅ Instalado. Foi preciso atualizar o WSL de 2.4.13 para **2.7.13** (a versão antiga dava `E_UNEXPECTED` neste Windows). Ubuntu 26.04 LTS. |
| A2 — Rust, Solana CLI, Anchor | ✅ Instalado: Rust **1.99.0**, Solana/Agave **4.1.2** (recomendada pelo Anchor; a 4.3.0 também ficou instalada), Anchor **1.2.0** (via avm). platform-tools **v1.57**, baixado com `curl` retomável porque o download embutido não completava com esta conexão. |
| A3 — pacotes npm | ✅ Instalado, versões exatas: @solana/kit 8.4.0, @solana-program/token 0.17.0, system 0.15.0, compute-budget 0.19.0, sas-lib 1.0.10, codama 1.11.0, @codama/nodes-from-anchor 1.5.6, @codama/renderers-js 2.5.0. |
| A4 — SAS | ✅ Compilado do repositório oficial, fixado no commit `3164299a` (o repositório não publica tags). ID `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG` conferido. |
| A5 — Devnet | ⛔ Não autorizado (precisa de autorização separada) |

## Como usar

No Ubuntu (WSL), uma vez por sessão:
```
bash "/mnt/c/Users/PGD SE7/Downloads/GIRO GIRO v1/GIRO/solana/scripts/validador-local.sh"
```
No Windows: `npm run dev:rede-local` (validador real) ou `npm run dev:rede` (rede simulada, sem validador).

| `GIRO_SOLANA_CLUSTER` | O que acontece |
|---|---|
| `disabled` (padrão) | Nada muda no GIRO. |
| `simulado` | Modelo de referência do programa e do SAS, gravado no SQLite. Não precisa de validador. |
| `localnet` | **Programa compilado + SAS reais** no `solana-test-validator` em 127.0.0.1. |

Atalho para comandos no Ubuntu a partir do Git Bash: `bash solana/scripts/wsl.sh 'anchor --version'`.

## Por fase

### Fase 0 — Ambiente ✅
- Versões fixadas em `solana/rust-toolchain.toml`, `solana/Anchor.toml` (`anchor_version`, `solana_version`), `solana/Cargo.lock` e `package.json` (versões exatas).
- Scripts: `fase0-instalar.sh`, `ambiente.sh`, `compilar-e-testar.sh`, `compilar-sas.sh`, `validador-local.sh` e `wsl.sh`.

### Fase 1 — Programa `giro_acordos` ✅
- Compilado com o Anchor 1.2.0 (`solana/target/deploy/giro_acordos.so`, 272 KB, mais o IDL). A primeira compilação teve só 2 erros, ambos de API nova do Anchor 1.x (`Context<'info, T>` e `CpiContext::new(program_id, …)`); corrigidos.
- `cargo test`: 6 testes, incluindo os **1.165 vetores de paridade** gerados do motor do GIRO. O Rust divide igual ao GIRO, centavo por centavo.
- **Testes negativos no programa compilado** (`tests/chain-localnet-seguranca.test.ts`). Todos recusados com o código exato e sem mover dinheiro:

  | Ataque | Código |
  |---|---|
  | Intruso aceitando no lugar do fornecedor | `Unauthorized` |
  | Fornecedor omitido da venda | `MissingAgreement` |
  | Conta de destino trocada | `WrongSupplierAccount` |
  | Prioridade invertida | `WrongOrder` |
  | Acordo repetido | `DuplicateAgreement` |
  | "Comissão" de 100% | `CapacityExceeded` |
  | Valor zero | `AmountZero` |
  | Conta falsa no lugar do acordo | recusado |
  | Dinheiro físico com só uma assinatura | `Unauthorized` |
  | Valor acima do restante | `ExceedsRemaining` |
  | Nonce repetido | recusado |

- Custo medido: `settle_sale` com 2 acordos e 1 comissão = **25.545 compute units** (limite pedido: 400.000).
- As 9 instruções foram executadas no validador real, incluindo mudança de acordo e recusa.
- **Diferença em relação ao plano:** os testes do programa compilado rodam no `solana-test-validator`, não no LiteSVM. O pacote `litesvm` não tem versão para Windows; o validador cobre o mesmo e ainda testa a integração com o servidor.

### Fase 2 — Cliente, adaptador e fila ✅
- Cliente TypeScript gerado pelo Codama (`npm run solana:cliente` → `solana/clients/giro/`, não editar).
- `server/chain/localnet.ts` envia as transações de verdade. `kit.ts` cuida da conexão, do token BRL-T e das contas de token.
- Jornada completa do documento no validador real (`tests/chain-api.test.ts`): o acordo na rede bate com o SQLite e a reconciliação dá "registrado".

### Fase 3 — Pagamento ✅
- **Solana Pay de verdade (transaction request)**:
  - `GET /api/solana-pay/:token` devolve o rótulo.
  - `POST /api/solana-pay/:token {account}` devolve a transação **não assinada** para a carteira do cliente assinar.
  - `POST …/verificar` acha o pagamento pela `reference` e só então registra no GIRO.
- Testado com uma carteira externa que assina e envia sozinha: o cliente paga com o próprio saldo, e o GIRO não assina nem guarda dinheiro.
- O programa aceita exatamente **uma** conta extra, somente leitura e sem uso: a `reference` do Solana Pay.
- Na página de cobrança, com a rede local ligada, aparece o QR "Pagar com carteira Solana".
- Aceite do plano conferido na rede local: R$ 100 → R$ 20 João, R$ 8 Pedro, R$ 72 Maria; acordo de 600 → 580.

### Fase 4 — Atestado ✅
- SAS real no validador: credencial "GIRO" → schema `giro-acordo-concluido-v1` → atestado.
- Formato no **layout oficial** do SAS `[13,13,8,10]`, 81 bytes. É idêntico, byte a byte, ao serializador do `sas-lib` (teste automático).
- Só atesta acordo que a rede vê como concluído. Um histórico com um centavo alterado não confere na rede.

### Fase 5 — Ensaio da demonstração ⏳
- Falta: roteiro e slides atualizados, prints novos com a rede local e um ensaio completo.
- Na banca, dizer que é rede **local** e token de **teste**, e que o servidor assina pelas partes com carteiras de teste (exceto no Solana Pay, em que a carteira do cliente assina).

## Ainda não feito / limitações
- **Celular**: não alcança 127.0.0.1. Pagar do celular exige túnel ou URL pública, ou seja, autorização separada.
- **Carteiras como Phantom/Solflare**: precisam ser configuradas para a rede local (RPC personalizado `http://127.0.0.1:8899`) e ter BRL-T de teste. O fluxo foi testado com uma carteira de teste automática.
- **Assinaturas das partes**: na fase local, o aceite e a confirmação do fornecedor ainda são assinados pelo servidor com a carteira de teste dele. Em produção, cada pessoa assina na própria carteira (Wallet Standard).
- A capacidade na rede considera só os acordos; a do GIRO, que inclui as comissões da equipe, continua sendo a mais rígida.
- Limite da v1: até 4 acordos ativos e 2 comissionados por venda (acima disso: Address Lookup Tables).
- O validador roda com `--reset`: ao reiniciá-lo, a rede local começa vazia. O GIRO recadastra os acordos existentes automaticamente.
- **Fora deste plano**: Devnet (A5), mainnet, auditoria externa, multisig da autoridade de upgrade e Pix/cartão (PSP).

## Arquivos

Novos:
- servidor: `server/chain/*`;
- domínio: `src/domain/attestation-model.ts`;
- tela: `src/components/ChainSeal.tsx`;
- Solana: `solana/` (programa, scripts, cliente gerado);
- scripts: `scripts/gerar-vetores-paridade.mjs`, `scripts/gerar-cliente-solana.mjs`;
- testes: `tests/chain-*.test.ts` e `tests/chain-parity-fixture.ts`.

Testes: **288** — inclui ensaio do modo carteira + login e o teste em grupo (pessoas e perfis).

---

## Saída do local (03/10/2026): Devnet → mainnet pequena

Decisões: Devnet primeiro; depois mainnet com valores pequenos; token **BRZ**; acesso externo por **túnel Cloudflare**, com o servidor sempre em 127.0.0.1. Devnet autorizada (A5). Mainnet **não** autorizada: exige `GIRO_AUTORIZACAO_MAINNET=sim` mais o seu OK e o seu SOL.

### Feito
- **Programa**:
  - `unit`: arredonda as divisões em centavos para o BRZ de 4 casas, com paridade conferida em 1.165 vendas × 100;
  - teto por venda (`max_sale`, `set_limits`);
  - dinheiro em dois passos: o vendedor registra, só o fornecedor confirma ou contesta, e só a confirmação baixa o saldo.
- **Não custodial**: nas redes públicas o servidor só **monta** as transações. Cada pessoa assina na **própria carteira** (Wallet Standard: Phantom, Solflare, Backpack), e o servidor confere na rede que a carteira certa assinou a instrução certa. As carteiras são vinculadas por assinatura de mensagem, como prova de posse.
- **Login obrigatório** para o acesso externo: senha da dona com hash scrypt, sessões `HttpOnly`/`Secure`/`SameSite=Strict` e bloqueio depois de 5 erros. Os links individuais continuam funcionando pelo token secreto deles.
- **Pessoas e perfis** (teste em grupo):
  - a dona cria as contas e recebe as senhas provisórias;
  - cada colega troca a senha, põe foto, vincula a carteira e vê os próprios acordos;
  - perfis com contratos e confiança, visíveis só para quem está logado.
- **Abastecer** (só nas redes de teste): o emissor do GIRO envia SOL de teste para as taxas e BRZ de teste para quem vai pagar.
- Ensaio completo do fluxo público no validador local (`GIRO_ASSINATURA=carteira`) e testes das pessoas. `npm run verificar`: **APROVADO** (288 testes, 34 telas).
- Scripts:
  - `solana/scripts/publicar-devnet.sh`
  - `npm run senha`
  - `npm run publico` (túnel + Devnet)
  - `npm run dev:devnet`
  - `ferramentas/cloudflared.exe` (portátil)

### Endereços (Devnet)
- Programa: `CVAQPvyjepuDP9j5df22ipp9E7XWVxej1T26rb4NvEMV` (ainda não publicado: falta SOL de teste)
- Carteira de implantação (autoridade de atualização): `AbQSbx9RQBGowtUi6beqstsDCnhm33ZcYYriwkj9VDy4`
- Emissor do GIRO: `5YxE4HM6dwyMh3aZHuqYASxhkEGUh2wmTfpQBP7WDWzv`
- SAS oficial já existe na Devnet: `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`

### Antes da mainnet (dinheiro real)
- Auditoria externa do programa.
- Autoridade de atualização numa multisig (ex.: Squads).
- Confirmar com advogado(a) as regras do BCB (Lei 14.478 e Resoluções 519, 520 e 521) para o uso de BRZ entre as partes.
- Endereço fixo, com túnel nomeado e domínio próprio, em vez do endereço `trycloudflare` que muda a cada reinício.
- Abastecer a carteira de implantação (cerca de 1,5–3 SOL reais) e a do emissor.
