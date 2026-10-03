# Incorporação do documento — 03/10/2026

Tudo local (127.0.0.1, SQLite). Nada publicado, nenhum serviço externo, Git não usado. Backup do banco antes do reinício da API: `data/backups/pre-incorporacao-20261003-010543.sqlite`. Originais alterados: `auditoria/historico/copias-antes-das-mudancas/incorporacao-documento/`.

## Implementado
| Item do documento | Onde | Como |
|---|---|---|
| "Mostra a porcentagem que vai para cada um" | Receber e Organizar → Resumo | `POST /api/sales/preview` simula a venda numa cópia do estado com o mesmo motor real (`createSale`): turnos, acordos aceitos, prioridades, limite do restante e reservas automáticas. Nada é gravado. |
| Regra interna: aceitar sugestão e aumentar o % | Organizar → Contas/Metas | `src/domain/pace.ts` (mesma janela de 7 dias das previsões). Botão "Usar X%". Se nem 100% bastaria, avisa. Acordos com terceiros continuam só por pedido de mudança. |
| Pagamento em dinheiro confirmado pelas duas partes | Compromisso → histórico de pagamentos; página `/confirmar/:token` | `server/receipt-service.ts`. A outra parte responde "recebi"/"não recebi"; resposta única; vendedor é notificado. Não altera valores do acordo. |
| Prova verificável de conclusão | Confiança → Comprovantes | `src/domain/proof.ts`: registro mínimo (sem telefone/CPF) + SHA-256. Código curto por acordo. |
| Levar o histórico a um novo fornecedor | Confiança → Baixar meu histórico / Imprimir / Verificar histórico recebido | Arquivo JSON local (opção de ocultar nomes). A verificação recalcula os códigos e detecta alteração. |
| Importação inteligente de documentos | Organizar → Adicionar; Novo compromisso → Importar documento | `src/domain/import.ts`: CSV/TXT ou texto colado; tela "Foram encontrados N itens", edição, marcação; sugere "repetir todo mês" quando o mesmo nome aparece em meses diferentes. Cria contas só após revisão. |
| Escalas cadastradas | Equipe → cartão → Escala e check-in; topo "Turnos de hoje" | Dias da semana por pessoa; botão "Iniciar turno de quem está na escala". |
| Check-in/check-out do trabalhador confirmado pelo vendedor | Página `/turno/:token`; Equipe → Turnos de hoje | `server/shift-request-service.ts`. O turno só vale após confirmação e começa no horário do pedido. |

Testes novos: `tests/incorporacao.test.ts` (8). Total: 252/252.

## Limites honestos (para a defesa)
- Links de convite, confirmação e check-in são locais e sem login/assinatura: simulam a outra parte neste computador.
- O código do comprovante prova que o arquivo não mudou depois de gerado; a garantia independente vem das confirmações da outra parte e, na etapa Solana, do registro do código (attestation) — só o código, sem nomes ou valores.
- PDF, imagem e Excel não são lidos automaticamente (exigiriam bibliotecas/modelos externos): o usuário cola o texto ou salva como CSV.

## Pendente de autorização
- **Solana** (programa Anchor, PDAs, token de demonstração, Solana Pay, attestation): Rust, Solana CLI e Anchor não estão instalados; instalar exige download. Pela regra, primeiro `solana-test-validator` local; Devnet só com autorização separada.
- Pix/cartão via PSP (serviço externo), custo/margem/lucro e aplicativo nativo (o documento trata como evolução).

---

# Validação local e preparação para integração — 03/10/2026

Regras relidas (arquivo inalterado desde 02/10). Nada publicado; registros só locais.

- `server/config.ts`: único ponto de configuração. Recusa `GIRO_HOST` fora do loopback, `GIRO_ENV` diferente de `local`, `GIRO_SOLANA_CLUSTER` diferente de `disabled`/`localnet`, e qualquer `GIRO_PUBLIC_URL`, `GIRO_DEPLOY` ou `GIRO_REMOTE_DB`. Origens permitidas derivadas da porta local.
- `src/domain/integration.ts`: contratos das integrações futuras — `integrationPoints` (hoje local → depois, com autorização), `ledgerSnapshot()` (o que um programa guardaria por acordo: chave-hash, valores, situação), `attestationPayloads()` (só impressão digital, data, no prazo) e `localOnlyFields`.
- Testes novos: `tests/somente-local.test.ts` (5: configuração, nenhuma URL externa no código, loopback/CSP, sem scripts de publicação/remoto, mapa de integração aponta para módulos existentes) e `tests/jornada-local-api.test.ts` (jornada do documento ponta a ponta pela API com banco temporário, incluindo verificação de que nada que iria para a rede contém nomes).
- `npm run verificar` → `auditoria/verificacao-local.md`: tsc, 258 testes, build e 34 telas (1366 e 390 px) no Edge local sobre cópia dos dados: sem erros de execução, sem rolagem horizontal, botões/campos com nome, um h1 por tela, links inválidos com mensagem clara. **Aprovado.**
- `npm run relatorio:integracao` → `auditoria/PRONTIDAO_INTEGRACAO.md` (somente leitura do banco).
