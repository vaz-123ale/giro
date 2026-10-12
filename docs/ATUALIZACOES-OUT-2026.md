# GIRO — Atualizações de outubro de 2026

Tudo o que entrou desde o QR fixo da barraca e a divisão por tipo de conta. Testado apenas com dados fictícios (colegas simulando fornecedores, CNPJs inventados, sem dinheiro real). O projeto piloto ainda é o próximo passo.

## 1. Três tipos de conta, cada um com o seu app

Na tela **Entrar**, a pessoa escolhe com qual conta vai entrar. O GIRO confere se a conta é mesmo daquele tipo. Se não for, avisa qual opção escolher (por exemplo: "Esta conta é de fornecedor(a). Escolha Fornecedor(a) para entrar").

| Conta | Quem é | Cor | Menu |
|---|---|---|---|
| **Minha barraca** | quem vende (feirante) | verde | Início, Receber, Organizar, Compromissos, Equipe, Confiança |
| **Fornecedor(a)** | quem vende para a barraca | âmbar | Painel, Acordos, Minha confiança, Barracas, Ajudantes, Conta |
| **Equipe ou comprador** | ajudante ou cliente | azul | Vagas, Meu trabalho, Minhas compras, Conta |

Cada conta vê só o que é dela. O fornecedor não vê vendas, caixa, outros fornecedores nem a equipe. A equipe e o comprador veem só os próprios dados.

- **Usuário da barraca:** a barraca pode ter um usuário próprio, definido em *Meu perfil*. O usuário "dona" continua funcionando.

## 2. Barraca (quem vende)

### QR fixo da barraca
- Um QR impresso uma vez fica na barraca. Quem compra aponta a câmera, digita o valor e paga, sem gerar um código novo a cada venda.
- A divisão combinada (fornecedores, ajudantes) vale normalmente.
- Há um limite de valor por compra e um limite de tentativas contra abuso.
- Se o comprador estiver com a conta aberta, a compra vai para o histórico dele.

### Importar dívidas
- Por **PDF, Excel (.xlsx) ou CSV**, com uma tabela para revisar antes de salvar.
- Tem uma caixa de ajuda e um modelo CSV para baixar.
- Cada dívida importada cria o contato e já envia o convite de acordo.

### Visual
- Cartões delimitados, letras maiores e ícones novos no menu.
- Botão **Voltar** sempre visível e confirmações bem visíveis.
- Filtros mais claros em *Compromissos*.
- Clicar no logo GIRO leva ao Início.

### Meu perfil
- O menu no topo tem a foto, *Alterar perfil*, *Ver perfil público* e *Sair*.
- A foto atualiza na hora.

### Confiança
- A página é organizada em blocos: ★ *Minha confiança* no topo, depois os fornecedores e a equipe.

### Procuro ajudante
- Fica em *Equipe*.

## 3. Fornecedor (app próprio)

- **Painel:** a receber, já recebido e acordos ativos. O bloco *Precisa de você* reúne os acordos para aceitar e os pagamentos em dinheiro para confirmar. Mostra também os 3 acordos mais recentes.
- **Acordos:** todos os acordos, com barra de progresso (pago de quanto, % das vendas, vencimento, selo "registrado na Solana").
- **Minha confiança:** o cartão GIRO Confiança do próprio fornecedor (acordos cumpridos, confirmados pelos dois lados) e um botão para compartilhar o perfil.
- **Barracas:** a confiança das barracas antes de vender a prazo e os *Perfis de confiança*.
- **Ajudantes:** publicar vaga em *Procuro ajudante* e ver quem está buscando trabalho.
- **Conta:** foto, perfil público, senha, carteira Solana e código de convite (para outras barracas que compram dele).

## 4. Equipe ou comprador (app próprio)

- **Vagas** (tela inicial): vagas de ajudante com a experiência da pessoa conferida pelo GIRO, *Tenho interesse* e *Busco trabalho*.
- **Meu trabalho:** turno (iniciar ou encerrar), comissão, quanto já recebeu, pagamentos em dinheiro para confirmar e acordos. Quem ainda não trabalha em barraca vê o botão *Ver vagas*.
- **Minhas compras:** compras pagas pelo QR da barraca, total gasto e confiança das barracas.
- **Conta:** foto, perfil público, senha, carteira e convite para amigos.

## 5. Vagas de ajudante com experiência verificada

- **Quem publica:** a barraca e o fornecedor publicam *Procuro ajudante*.
- **Regras da vaga:** experiência mínima em **meses** e mínimo de **dias trabalhados**.
- **Como a pessoa se candidata:** clica em **Tenho interesse**. O perfil dela fica salvo para quem publicou.
- **Verificação automática:** o GIRO confere a experiência pelo **histórico de comissões recebidas** (dias trabalhados, meses e total recebido) e mostra **"Atende às regras"** ou **"Ainda não atende"**. A experiência não é declarada pela pessoa: vem do histórico.
- **Busco trabalho:** a pessoa entra numa lista com resumo e contato. Barracas e fornecedores veem essa lista, com o link para o perfil de confiança e um botão de WhatsApp.

## 6. Site em inglês

- Tem um seletor **PT / EN** no topo de todas as telas e na entrada. A escolha fica salva no navegador.
- **Link direto em inglês:** basta adicionar `?lang=en` ao endereço.
- "GIRO" e "GIRO Confiança" ficam sempre em português (são nomes).
- Os valores aparecem no formato americano quando o site está em inglês.

## 7. Demonstração pública (Render)

- **Dados:** são fictícios (Maria, fornecedor João, ajudante Pedro) e são recriados a cada início.
- **Rede:** a Solana é simulada.
- **Contas de teste:** a tela de entrada mostra uma conta de cada tipo, com o botão **Preencher**.

| Tipo | Usuário | Senha |
|---|---|---|
| Minha barraca | `dona` | `giro-demo-2026` |
| Fornecedor(a) | `joao` | `giro-demo-2026` |
| Equipe ou comprador | `lia` | `giro-demo-2026` |

- A conta do fornecedor João já vem com o acordo de R$ 600 a 20% das vendas.

## 8. Endereços

- **Demonstração pública (fica no ar sem o computador ligado):** https://giro-demo-oyy1.onrender.com
- **Link fixo do grupo (precisa do computador ligado com `npm run publico`):** https://desktop-jg2rfmg.tail00f1d9.ts.net
