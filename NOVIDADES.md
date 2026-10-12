# GIRO — Novidades e funcionalidades

Registro organizado do que o GIRO faz, separado por quem usa. Atualizado a cada versão nova.

---

## 🧺 Conta da barraca (quem vende)

**Entrar**
- Na tela de entrada, escolha **"Minha barraca"** e digite só a senha da barraca.

**O que só a barraca vê:** o painel completo (vendas, caixa, organização, todos os acordos, equipe, confiança de todos), o QR da barraca, convites e importação de dívidas.

**Meu perfil** (canto superior direito, com a foto da barraca)
- Clicar abre um menu com a foto e o nome da barraca e as opções **Alterar perfil**, **Ver perfil público** e **Sair**.
- **Alterar perfil** abre a página com foto (trocar), nome da barraca, perfil público (abrir, copiar link, WhatsApp) e **Sair**.
- A foto do canto **muda na hora** quando é trocada no perfil. Confirmação bem visível ao salvar.
- Clicar no logo **GIRO** volta para o Início.

**Importar dívidas por PDF ou Excel** (*Compromissos → Importar dívidas*)
- Sobe uma planilha (.xlsx, .xls, .csv) ou um PDF com as dívidas de **fornecedores e ajudantes**.
- O GIRO monta uma tabela para revisar (nome, tipo, valor, vencimento, % das vendas), com tudo editável.
- **Cadastrar tudo**: cria cada pessoa (o ajudante entra na equipe) e propõe o acordo, que fica aguardando o aceite dela.
- Ajuda **"Como fazer?"** e botão **Baixar modelo (Excel)**. Se faltar a %, sugere 20% para fornecedor e 10% para ajudante.

**QR fixo da barraca** (*Receber → QR fixo da barraca*)
- Um único QR impresso na banca. **A feirante não precisa entrar no sistema a cada venda.**
- O comprador aponta a câmera, **digita o valor e paga**. O pagamento segue as mesmas regras de divisão (fornecedores, comissões, reservas).
- Botões **Imprimir QR** e **Ver como o cliente vê**.
- Proteções: valor mínimo de R$ 0,50, máximo de R$ 1.000 (ou o teto da rede), no máximo 10 tentativas por minuto.

**Painel completo**
- Início, Receber, Organizar, Compromissos, Equipe e Confiança, com cartões delimitados e letras maiores.
- Ícones novos no menu lateral.
- Botão **← Voltar** no topo das subpáginas.
- **Compromissos:** filtros com "Mostrando X de Y", etiquetas dos filtros ativos (com × para remover) e seções vazias escondidas quando há filtro.
- **Assinar tudo:** uma aprovação na carteira para todas as assinaturas pendentes.
- **Convidar pessoas por link** (fornecedor, ajudante com %, cliente), com QR e WhatsApp.
- **Importar documento** (PDF, CSV, texto), sempre com revisão e confirmação visível.

**Confiança** (organizada em blocos)
1. **★ Minha confiança:** o histórico da barraca, que é o que ela mostra a um fornecedor novo (cumpridos no prazo, concluídos, ativos, total quitado e a linha do tempo dos acordos).
2. **Confiança dos fornecedores:** um cartão por fornecedor, com nome e números visíveis (aceitos, concluídos, no prazo, atrasados) sem precisar clicar.
3. **Confiança da equipe:** um cartão por ajudante (gerado, recebido, a receber).
4. **Comprovantes e histórico** para baixar e mostrar.

---

## 🚚 Conta do fornecedor

**Entrar**
- Na tela de entrada, escolha **"Fornecedor(a)"** e use o usuário e a senha criados pelo convite.

**O que o fornecedor vê:** só os acordos dele com a barraca (não vê vendas, caixa, outros fornecedores nem a equipe).

**Painel do fornecedor** (*Minha conta*)
- **A receber**, **já recebido** e **acordos ativos**, logo no topo.
- **Precisa de você:** acordos novos para aceitar e pagamentos em dinheiro para confirmar.
- **Meus acordos** com barra de progresso (pago de quanto, % das vendas, vencimento, registrado na Solana).
- **Confiança de quem compra de você:** o GIRO Confiança da barraca, sem mostrar os outros fornecedores.
- Carteira, saldo, **Assinar tudo** e código de convite pessoal.

---

## 👥 Conta da equipe ou cliente

- Na tela de entrada, escolha **"Equipe ou cliente"**.
- **O que vê:** só os próprios dados.
- **Ajudante:** turno (iniciar/encerrar), comissão e quanto já recebeu.
- **Cliente:** perfil, convites e histórico.

---

## 🛒 Quem compra na barraca (sem conta)

- Aponta a câmera para o **QR fixo da barraca** → página **"Pagando para [barraca]"** → digita o valor (ou toca em R$ 5, 10, 20 ou 50) → paga pela carteira.
- Não precisa criar conta.

---

## 🔗 Na blockchain (Solana)

- Acordo assinado pelos dois lados, cada um com a própria carteira. Mudanças só com o aceite dos dois.
- Venda paga com Solana Pay é **dividida automaticamente** na mesma transação, em stablecoin de real.
- Pagamento em dinheiro: a barraca registra e o fornecedor confirma ou contesta.
- Acordo concluído recebe uma **atestação** (Solana Attestation Service) que qualquer pessoa pode verificar.
- Dados pessoais e contratos privados **ficam fora da blockchain**.

---

## 📋 Situação atual

- Testado na rede de teste (Devnet) por colegas simulando os papéis, com CNPJs fictícios e sem dinheiro real.
- **Projeto piloto (próxima etapa):** 3 fornecedores e 12 feirantes clientes deles, em 3 feiras, por 2 meses.
- **Demonstração pública:** <https://giro-demo-oyy1.onrender.com> (dados fictícios).

---

## 🌎 Site em inglês

- Botão **🇧🇷 PT / 🇺🇸 EN** no topo de todas as páginas, na tela de entrar, na página da barraca e em **Configurações → Idioma**.
- Link direto em inglês: acrescente **`?lang=en`** ao endereço (ex.: `https://giro-demo-oyy1.onrender.com/entrar?lang=en`).
- Valores em inglês aparecem no formato R$1,000.00. Os nomes **GIRO** e **GIRO Confiança** ficam em português.

## 🧑‍🤝‍🧑 Contas diferentes por tipo

- **Entrar:** três opções — *Minha barraca* (usuário próprio da barraca ou "dona"), *Fornecedor(a)* e *Equipe ou comprador*.
- **Usuário da barraca:** definido em *Meu perfil → Usuário da barraca*.
- **Equipe ou comprador:** dentro da conta, escolhe a área **Equipe e trabalho** (turno, comissão, vagas, "Busco trabalho") ou **Minhas compras** (histórico de compras pagas pelo QR da barraca com a conta aberta, total gasto, confiança das barracas).
- **Fornecedor:** painel próprio, **Minha confiança como fornecedor** (acordos que cumpriu), confiança das barracas, **Perfis de confiança** e **Procuro ajudante**.
- Cada tipo de conta tem cor e selo próprios no topo (verde fornecedor, laranja equipe, roxo comprador).

## 💼 Vagas e emprego para ajudantes

- **Procuro ajudante** (barraca em *Equipe* e fornecedor em *Minha conta*): publica a vaga com regras — **experiência mínima em meses** e **dias trabalhados no mínimo**.
- Quem é da equipe ou comprador vê as **Vagas de ajudante** e clica **Tenho interesse**; o perfil fica salvo para quem publicou.
- **O GIRO confere sozinho a experiência** pelo histórico de comissões recebidas (dias trabalhados, meses, total recebido) e mostra **"Atende às regras"** ou **"Ainda não atende"**.
- **Busco trabalho:** a pessoa também pode se colocar numa lista com resumo e contato; barraca e fornecedores veem, com o link do perfil de confiança e botão de WhatsApp.
