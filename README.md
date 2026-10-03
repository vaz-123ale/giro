# GIRO — Carteira inteligente

Receitas programáveis e confiança comercial para pequenos negócios. O vendedor define as regras uma vez, cada venda já nasce organizada e cada compromisso cumprido vira histórico verificável.

**Fase atual: teste em grupo na Solana Devnet** (rede pública de teste, token sem valor real). O servidor escuta só em 127.0.0.1; o acesso externo é feito por túnel https com login. Mainnet (dinheiro real) exige autorização explícita (`GIRO_AUTORIZACAO_MAINNET=sim`).

## Como testar (pelo link)

1. Peça à dona do negócio o **endereço** (`https://….trycloudflare.com`), seu **usuário** e a **senha provisória**.
2. Entre, troque a senha e ponha sua foto em **Minha conta**.
3. Instale a carteira **Phantom** e ative *Configurações → Configurações de desenvolvedor → Modo de teste → Solana Devnet*. Clique em **Conectar minha carteira**.
4. **Fornecedora:** em *Meus acordos* abra o acordo, aceite e clique em **Assinar na carteira**.
   **Cliente:** pague a venda pelo botão/QR **Pagar com carteira Solana**.
5. Veja os perfis de confiança em **Perfis** e o seu perfil público (link, QR, WhatsApp e NFC) em **Meu perfil público**.

## Como rodar

Requisito: Node.js 24.15 ou superior. As dependências já estão em `node_modules` (não precisa de internet).

```powershell
npm run dev          # site em http://127.0.0.1:5173 (API em http://127.0.0.1:3001)
```

Versão compilada: `npm run build` e depois `npm start` → http://127.0.0.1:3001.

| Comando | O que faz |
|---|---|
| `npm test` | 288 testes automáticos (alguns só rodam com o validador local ligado) |
| `npm run verificar` | tipos + testes + build + 34 telas no navegador, numa cópia dos dados → `auditoria/verificacao-local.md` |
| `npm run relatorio:integracao` | o que um dia iria para a rede (sem dados pessoais) → `auditoria/PRONTIDAO_INTEGRACAO.md` |
| `npm run dev:rede` | igual ao `dev`, com a rede Solana **simulada** ligada (modelo do programa, neste PC) |
| `npm run dev:rede-local` | igual ao `dev`, usando o validador Solana **local** (suba antes no WSL: `solana/scripts/validador-local.sh`) |
| `npm run solana:cliente` | gera o cliente TypeScript do programa a partir do IDL (Codama) |
| `npm run senha` | define a senha da dona (usuário `dona`) |
| `npm run publico` | abre o GIRO pelo túnel https na Devnet (exige senha e `npm run build`) |
| `npm run solana:vetores` | gera os vetores de paridade GIRO × programa para o `cargo test` |
| `npm run demo` | base de demonstração fictícia em http://127.0.0.1:3019 (não usa os dados reais) |
| `npm run demo:prints` | refaz os prints da demonstração |

## O que o sistema faz

- **Início:** quanto entrou, quanto já tem destino e quanto está realmente livre.
- **Receber:** venda (pagar depois), venda em dinheiro, “para onde vai cada venda”, vendas, a receber, caixa físico.
- **Organizar:** contas e metas pessoais, sugestões de percentual, renegociar, importar documento (CSV/texto), resumo.
- **Compromissos:** acordos com fornecedores e colaboradores, aceitos pela outra parte por link local; mudanças só com aceite.
- **Equipe:** turnos, escala, check-in do trabalhador confirmado pelo vendedor, comissões, diárias, comprovantes.
- **Confiança:** comprovantes de conclusão (código SHA-256), baixar e verificar histórico; pagamentos em dinheiro confirmados pelas duas partes.
- **Mais:** contatos, notificações, histórico, acessibilidade (tamanho do texto, alto contraste), configurações.

Regras financeiras: valores em centavos; ordem da divisão = fixos por venda → comissões → acordos por prioridade → restante do vendedor; nunca destina mais do que falta; soma dos percentuais ≤ 100%. Digital e aceites são simulados localmente; dinheiro é confirmado manualmente.

## Estrutura das pastas

```
Documentação/        documento de referência do projeto
Referencias/         mockups e imagens de referência do layout
src/                 interface (React) e regras de negócio (src/domain)
server/              API local (Node + SQLite); config.ts = trava "só local"
tests/               testes automáticos
scripts/             dev, verificação local e relatório de integração
public/              imagens e ícones usados pelo site
data/                banco local (giro.sqlite) e backups — dados reais, ficam só no PC
apresentacao/        slides (.pptx, .pdf, .html), roteiro, prints e ferramentas
planejamento/solana/ plano e andamento da integração com Solana
solana/              programa Anchor giro_acordos (Rust) e scripts do WSL
auditoria/           entregas atuais, verificação e histórico das fases anteriores
node_modules/        dependências (necessárias para rodar sem internet)
```

## Solana (em andamento)

Plano: [PLANO_IMPLEMENTACAO_SOLANA.txt](planejamento/solana/PLANO_IMPLEMENTACAO_SOLANA.txt) · andamento e o que falta: [STATUS_IMPLEMENTACAO.md](planejamento/solana/STATUS_IMPLEMENTACAO.md).

A rede é opcional e vem desligada (`GIRO_SOLANA_CLUSTER=disabled`). `simulado` roda o modelo do programa neste PC; `localnet` usa o programa compilado e o SAS no `solana-test-validator` em 127.0.0.1, com Solana Pay para carteira (token BRL-T de teste). Programa Anchor em `solana/`, camada do servidor em `server/chain/`. Devnet só com autorização separada.

## Documentos de referência

- [Roteiro da demonstração](apresentacao/ROTEIRO_DEMONSTRACAO.md)
- [Incorporação do documento e validação local](auditoria/ENTREGA_INCORPORACAO_DOCUMENTO.md)
- [Ajuste de layout pelos mockups](auditoria/AJUSTE_LAYOUT_MOCKUPS.md)
- [Índice da auditoria e do histórico](auditoria/LEIA-ME.md)
