# Roteiro de demonstração do GIRO

Tudo roda **neste computador**, com **dados fictícios** em `apresentacao/dados-demo` (os dados reais em `data/` não são usados). Nada é publicado.

## Antes de apresentar (5 min)

1. Abrir um terminal na pasta do projeto e rodar `npm run demo`.
   Isso gera a versão final, cria a história de demonstração e deixa o site em **http://127.0.0.1:3019**.
2. Abrir **http://127.0.0.1:3019** no navegador, em tela cheia (F11), com zoom do navegador em 100%.
3. Em **Configurações → Como devemos chamar você?**, digitar **Maria** (a saudação fica “Bom dia, Maria!”).
4. Deixar aberta uma segunda aba com os slides: `apresentacao/GIRO-demonstracao.html` (setas do teclado; **F** = tela cheia). Há também `GIRO-demonstracao.pdf`.
5. Os links das outras pessoas (convite, confirmação, check-in) ficam em `apresentacao/dados-demo/links.json` (gerado pelo `npm run demo`). Monte as URLs assim:
   - Convite da Ana: `http://127.0.0.1:3019/convite/<invitationAna>`
   - João confirmando recebimento: `http://127.0.0.1:3019/confirmar/<receiptJoao>`
   - Check-in da Carla: `http://127.0.0.1:3019/turno/<carlaToken>`

> Para recomeçar a demonstração do zero: feche o processo `node` da porta 3019 (Gerenciador de Tarefas) e rode `npm run demo` de novo.

## A história (o que já está na base)

- **Maria** tem um pequeno comércio. Hoje vendeu **R$ 670,00**.
- **João** (hortifrúti): acordo aceito de **20% das vendas até quitar R$ 600**. Já recebeu parte; o último pagamento em dinheiro aguarda a confirmação dele.
- **Distribuidora Sol**: acordo de R$ 100 **quitado** e confirmado pelas duas partes. Gera o primeiro comprovante.
- **Ana Embalagens**: proposta enviada, **aguardando aceite**.
- **Pedro**: ajudante, 8% por venda, **em turno** (fez check-in e Maria confirmou). **Carla**: diarista, na escala de hoje.
- Organização: meta **Reposição de estoque** (reserva automática de 10%), conta **Energia** (todo mês), meta **Reserva do negócio**.

## Passo a passo (cerca de 10 minutos)

| # | Tela (onde clicar) | O que mostrar | Frase-chave |
|---|---|---|---|
| 1 | **Início** | Livre para usar R$ 315,40 · Entrou hoje R$ 670,00 · Já tem destino R$ 354,60 (tocar para abrir o detalhe) · gráfico Meu dinheiro | “Vendeu R$ 670, mas R$ 315 são realmente dela.” |
| 2 | **Sino** (canto superior) | Avisos de vencimento, respostas e previsão; “Ver todas” | “O GIRO avisa antes; não muda acordos sozinho.” |
| 3 | **Mais → Fornecedores e contatos**, depois **Compromissos → + Novo compromisso** | Cadastro só com nome. Assistente: com quem → valor → % das vendas → prazo e prioridade → revisar → enviar convite | “Maria propõe 20% das vendas até quitar R$ 600.” |
| 4 | Aba com o **convite da Ana** | A outra parte vê só a proposta; aceita ou recusa. (Pode aceitar ao vivo e voltar a Compromissos.) | “Ninguém altera o acordo sozinho.” |
| 5 | **Equipe** | Turnos de hoje; Pedro trabalhando; abrir **Escala e check-in**; abrir o link da Carla, tocar **Iniciar meu turno**, voltar e **Confirmar** | “Fica registrado por que cada valor foi para cada pessoa.” |
| 6 | **Receber** → bloco **Para onde vai cada venda** | Digitar 100: João R$ 20, Pedro R$ 8, Estoque R$ 10, livre R$ 62. Trocar para 1.000 e mostrar o limite | “É uma simulação com o mesmo motor da venda real.” |
| 7 | **Receber → Venda em dinheiro** e **Caixa em dinheiro** | Registrar R$ 35 (só o valor). No caixa: esperado, comprometido, livre em espécie | “O GIRO organiza o dinheiro físico e registra a entrega.” |
| 8 | **Receber → Vendas** | Venda pendente (A receber): data da venda ≠ data do pagamento | “Pedro vendeu terça, o cliente pagou quinta: a comissão é do Pedro.” |
| 9 | **Organizar → Contas**, **Metas** e **Resumo** | Pago × reservado × falta cobrir; “Repete: Todo mês”; na meta de estoque, o botão **Usar 32,5% nas próximas vendas** | “Regra pessoal ela muda quando quiser.” |
| 10 | **Organizar → Adicionar → Importar documento** | Colar: `Fornecedor João — R$ 600 — vencimento em 08/10` e `Energia;184,70;14/10`. Clicar **Ler texto**, revisar, **Adicionar** | “Automatiza a digitação, não a decisão.” |
| 11 | **Compromissos** | Filtros; Ana aguardando, Sol concluída, João parcialmente pago; **Visualizar detalhes** | “Saldo restante sempre claro.” |
| 12 | Aba **João confirmando** | “Você recebeu R$ 94,00?” → **Sim, recebi**. Voltar e ver a notificação | “Dinheiro físico confirmado pelas duas partes.” |
| 13 | **Confiança** | Comprovantes com código; **Baixar meu histórico** (marcar “Ocultar nomes”); em **Verificar histórico recebido**, abrir o arquivo baixado → “íntegro” | “A confiança passa a acompanhar o vendedor.” |
| 14 | **Mais → Acessibilidade** e celular (F12 → modo celular) | Tamanho do texto, alto contraste; barra inferior no celular | “Baixa carga cognitiva para qualquer idade.” |

Fechar com os slides 23 a 25 (o que é real hoje, por que Solana, frases finais) e o **slide 26** ("GIRO funcionando na prática", narração de ~30 s nas notas do apresentador).

## Perguntas prováveis da banca (respostas curtas)

- **E se o vencimento chegar e não der para pagar?** O GIRO calcula o percentual necessário, avisa o risco e, se for acordo, sugere pedir mudança. A outra parte aceita ou recusa. Se nem 100% das vendas bastar, ele diz isso claramente.
- **O GIRO garante lucro?** Não. Ele mostra **saldo livre projetado**; lucro exigiria custos de mercadoria e despesas.
- **Como o cliente paga?** No protótipo, o pagamento digital é simulado com QR local. O próximo passo é Solana Pay com token de demonstração; Pix e cartão só por um parceiro, mais adiante.
- **E o dinheiro em espécie?** É registrado como venda em dinheiro, o GIRO calcula quanto separar e a dívida só baixa quando a entrega é confirmada, de preferência pelas duas partes.
- **Por que blockchain?** Não para a planilha de Maria. Ela serve para que Maria e João compartilhem uma regra e uma prova que não dependem da palavra de um deles nem do GIRO. Na rede iria só o hash do acordo, os valores, a situação e o código do comprovante — sem nomes ou CPF.
- **É uma nota de crédito?** Não. São fatos verificáveis de compromissos cumpridos, sem ranking e sem lista de inadimplentes.

## O que é simulado (dizer com transparência)

- Pagamento digital e QR não movimentam dinheiro real.
- Links da outra parte abrem neste computador, sem login nem assinatura.
- Solana, Pix/cartão e leitura de PDF/imagem são próximas etapas, cada uma com autorização.

## Arquivos

- `GIRO-demonstracao.pptx` — apresentação principal (26 slides; o 26 é "GIRO funcionando na prática", com a narração nas notas do apresentador)
- `GIRO-demonstracao.pdf` — os mesmos 26 slides em PDF (exportado do .pptx)
- `GIRO-demonstracao.html` — versão para navegador (setas para navegar; F para tela cheia)
- `prints/` — capturas usadas nos slides; `prints/cena/` — recortes reais do slide 26
- `ferramentas/` — scripts para refazer tudo:
  - `montar-demo.mjs` — cria a base fictícia e sobe o site na porta 3019 (`npm run demo`); a base fica em `apresentacao/dados-demo` (criada na hora)
  - `capturar-prints.mjs` — refaz as capturas (`npm run demo:prints`, com a demonstração rodando)
  - `gerar-pptx.py` — gera os slides 1 a 25 do .pptx
  - `cena-pratica.mjs` + `recortar-cena.py` — refazem os recortes reais do slide 26
  - `adicionar-slide-26.py` — acrescenta o slide 26 ao final do .pptx
