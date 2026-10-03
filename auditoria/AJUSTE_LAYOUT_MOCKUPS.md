# Ajuste de layout pelos mockups aprovados — 03/10/2026

Escopo: só aparência/organização visual de **Receber**, **Início**, **Organizar → Contas**, **Compromissos** e do painel de **Notificações**. Backend, banco, regras financeiras e rotas não foram alterados. Nada foi publicado; nenhum serviço externo foi usado.

## Arquivos

- Novo: `src/mockup.css` (importado por último; sobrepõe só aparência), `src/components/StructureOverview.tsx`.
- Alterados: `src/main.tsx`, `WalletHome.tsx`, `NotificationPanel.tsx`, `Planning.tsx`, `AccountDetail.tsx`, `PlanContribution.tsx`, `Commitments.tsx`, `PageSearch.tsx`.
- Cópia dos originais: `auditoria/historico/copias-antes-das-mudancas/ajuste-layout-mockups/` (para reverter, copie de volta e remova o import de `mockup.css`).

## O que mudou

- **Receber:** textos dos cartões iguais ao mockup e nova seção "Estrutura atualizada" (8 cartões; cada um abre a área descrita).
- **Início:** "Entrou hoje" e "Já tem destino" alinhados, com subtítulo e seta ("Entrou hoje" abre Pagamentos recebidos; "Já tem destino" continua expandindo o detalhamento). Ícone no atalho de caixa, legenda do gráfico alinhada à direita, "Como ler este resumo?" em faixa cinza.
- **Organizar → Contas:** ícone por conta, ícones nos três valores, linha Categoria | Recorrência | Competência com ícones, os três botões de ação na mesma linha, Editar/Pausar/Excluir ao lado da barra e menu ⋮ com as mesmas ações. A barra agora mostra o quanto da conta está coberto (pago + reservado), coerente com "Faltam".
- **Compromissos:** painel "Filtros de compromissos" com os 5 filtros em uma linha, "Limpar filtros" e "+ Novo compromisso" no painel; cartões com ícones, selo de status da proposta colorido e "Visualizar detalhes" ao lado da barra.
- **Notificações:** ícone, mensagem, selo (Ação pendente / Atenção / Concluído / Informação), data e "Ver todas". "Marcar como lida" foi mantido.

## Decisões (sem inventar requisito)

- Saudação continua "Bom dia!": não há nome de usuário no modelo de dados.
- "A pagar efetivamente" só aparece quando difere de Reservado + Falta cobrir (nos demais casos já está nos três valores).
- Busca do Início diz "Buscar transações ou compromissos..." porque ela não pesquisa contas.
- "Contas pagas" segue no gráfico quando existir (é dado real; o mockup tinha só 3 fatias).

## Acessibilidade aplicada

Aba ativa com `aria-current`, botões de abrir/fechar com `aria-expanded`, barras de progresso com rótulo falado, ícones decorativos ocultos do leitor de tela, títulos em ordem (h1 → h2 → h3), foco visível nos elementos novos, Esc fecha notificações. No celular: palavras sem quebra no meio, valores sem quebra, banner de crescimento depois do saldo e rótulos da barra inferior inteiros.

## Validação

- `npm test`: 244/244 aprovados (mesma quantidade de antes).
- `npm run build`: concluído.
- Conferência visual local com Edge headless (127.0.0.1, perfil temporário, rede de fundo desativada) em 1680/1855 px e 390 px.

---

# Segunda rodada — escala 100% e melhorias de acessibilidade (03/10/2026)

## Escala
- A interface inteira é reduzida proporcionalmente em telas de computador (`zoom` no `html`, `src/mockup.css`): 0,85 até 1299 px, 0,88 até 1699 px, 0,95 até 1999 px, 1 acima disso e no celular. Hierarquia única de tamanhos: página 30 · seção 22 · cartão 18 · texto 15 · auxiliar ≥ 13.
- Ações rápidas do Início passam a 2 colunas até 1499 px (sem quebra no meio de palavras).

## Melhorias implementadas
1. **Mais → Acessibilidade** (`Accessibility.tsx`): tamanho do texto (Padrão / Grande +15% / Muito grande +30%), alto contraste, reduzir animações, mostrar/ocultar "Estrutura atualizada". Guardado só no navegador (`uiPrefs.ts`, localStorage). Com texto ampliado, Início/filtros/estrutura reorganizam em menos colunas — verificado sem rolagem horizontal em 1366 px nas 5 telas principais.
2. **Datas DD/MM/AAAA** em Contas, Metas, previsão, resumo, confiança, equipe, histórico de alterações e notificações (`display.ts`). Campos de data dos formulários não mudaram.
3. **Notificações** sem o código longo do compromisso (o código continua pesquisável em Mais → Notificações) e botão **Marcar todas como lidas** (usa o endpoint local existente, uma a uma).
4. **Linguagem**: "Recorrência" → "Repete" (Toda semana / A cada 15 dias / Todo mês / Não repete); "Competência" → "Referente a".
5. **Saudação** por horário (Bom dia / Boa tarde / Boa noite) com nome opcional em Configurações → "Como devemos chamar você?" (guardado só no navegador; inicial aparece no avatar).
6. **"Estrutura atualizada"** com botão Ocultar; sempre disponível em Mais → Como o GIRO está organizado.
7. Textos auxiliares com mínimo de 13 px; menu ⋮ com 44 px no celular.
8. **Erros junto do formulário**: quando o erro vem de um formulário, a mensagem aparece dentro dele (abaixo do botão) com `role="alert"`; erros de botões fora de formulário continuam no topo.

Backend, banco e regras financeiras não foram alterados. Originais adicionais copiados para `auditoria/historico/copias-antes-das-mudancas/ajuste-layout-mockups/components/`.

Validação: `npm test` 244/244; `npm run build` concluído; conferência visual local em 1366, 1536 e 390 px, com tamanhos de texto e alto contraste.
