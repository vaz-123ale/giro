# GIRO — demonstração de três minutos

Gravação na demonstração pública do Render. Dados fictícios, pagamentos simulados, sem dinheiro real. O piloto ainda não aconteceu. Não apresentar saldo de caixa como saldo bancário ou lucro.

## Preparar

O Render recria o cenário fictício de `apresentacao/ferramentas/preparar-gravacao.mjs` a cada início (`scripts/nuvem.mjs`, `GIRO_DEMO_CENARIO=gravacao`, padrão temporário). Abrir `https://giro-demo-oyy1.onrender.com/entrar?lang=en` e esperar o primeiro carregamento antes de gravar. Contas `dona`, `joao` e `lia`, senha de demonstração `giro-demo-2026`, cada uma com seu tipo correspondente. Para voltar à base curta do documento, usar `GIRO_DEMO_CENARIO=historia`.

Gravar apenas a aba da demonstração, em inglês, sem abas pessoais ou notificações. Mostrar digitação nos três logins, com cortes curtos. Não gravar tempo de espera. Usar a narração local Kokoro (`apresentacao/ferramentas/narrar-gravacao.py`), as legendas e os tempos abaixo. Uma faixa discreta deve identificar “Simulated demonstration · fictional data”.

## Roteiro de imagem e voz

| Tempo | Imagem e ação | Narração em inglês |
|---|---|---|
| 00:00–00:13 | Entrar: selecionar barraca, preencher dona e senha; abrir Início. | Selling more does not always mean having more money available. For a market vendor, suppliers, helpers, and tomorrow's stock all share today's revenue. GIRO makes those commitments clear. |
| 00:13–00:26 | Início: destacar receita, terceiros, reservado e livre. | Meet Maria and João, a vendor and a supplier who already know each other. Maria sees what came in, what is committed, and what remains available, without mixing business obligations with personal goals. |
| 00:26–00:41 | Receber → QR fixo: mostrar QR, impressão e visão do cliente. | Maria prints one permanent QR code. Customers scan it, enter the amount, and pay. She does not need to open the platform for every sale. The agreed rules follow the payment automatically. |
| 00:41–00:56 | Compromissos → Importar dívidas: mostrar baixar modelo, escolher PDF/Excel e revisão. | Getting started should not mean typing every debt. Upload a PDF or spreadsheet, or download the template and fill it in. Review the extracted names, amounts, and deadlines before sending agreement proposals. |
| 00:56–01:11 | Compromissos: mostrar acordo, percentual, vencimento, aceite e filtros. | Each agreement records who receives, how much, by when, and what share of sales applies. Both sides review the terms. Maria sets the rule once; changing an active agreement requires the other side's acceptance. |
| 01:11–01:23 | Organizar → Metas: viagem em família e reserva. | Organization also creates room for tomorrow: restocking, an emergency reserve, or a family trip. Personal goals can be paused and resumed, while commercial agreements keep their own accepted conditions. |
| 01:23–01:39 | Confiança: concluídos, no prazo, histórico e perfil público. | GIRO Confiança turns commitments kept into a history people can show. Completed agreements, deadlines, and payment records help a new partner understand that relationship. Public profiles share trust without exposing private contracts. |
| 01:39–01:52 | Sair → Entrar fornecedor: preencher joao e senha; Painel e Acordos. | Now João signs in as a supplier. His own app shows receivables, completed agreements, and pending actions. He can review proposals and confirm cash received, with access limited to his own information. |
| 01:52–02:04 | João → Minha confiança, Conta e Ajudantes. | João can share his trust profile, invite other partners, and publish helper vacancies. Applicants bring a work history, so the conversation starts with more than a name and a promise. |
| 02:04–02:20 | Sair → Entrar equipe: preencher lia e senha; Vagas, regras e Tenho interesse. | Lia enters through the team and buyer account. She sees vacancies and their requirements, expresses interest, and can announce that she is looking for work. GIRO checks experience against the recorded commission history. |
| 02:20–02:35 | Lia → Meu trabalho: barraca, localização, escala, horas e comissão. | In My Work, Lia sees her stall, location, weekly schedule, and shift history. Hours and commissions make her workload visible. Starting or ending a shift still follows the vendor's confirmation process. |
| 02:35–02:46 | Lia → Minhas compras: histórico e total; Conta: perfil e convite. | As a customer, Lia also sees purchases made through the stall's QR code. Her account brings together purchase history, her public profile, and an invitation code for friends. |
| 02:46–03:00 | Voltar a GIRO Confiança e fechar com logo e aviso de simulação. | This demonstration uses fictional data and simulated payments. Tests involved colleagues playing the roles, with no real money; the pilot is the next step. GIRO: organize today's revenue, and build tomorrow's trust. |

## Limites de afirmação

- Não dizer que o piloto já aconteceu, que esta gravação prova transações reais, ou que todos os acordos têm atestação Solana. Mostrar apenas os selos que o sistema efetivamente informa.
- O QR pode ser impresso uma vez; acordos têm prazo e aceite próprio. A pausa e retomada demonstradas são de metas pessoais, não uma promessa de reativação automática de contratos.
- A versão atual organiza o trabalho na barraca deste negócio; não apresentar uma rede de múltiplas barracas empregadoras como funcionalidade já implementada.
- O local da Lia é fictício neste cenário; a gravação não divulga localização de pessoas reais.

## Encerrar

O cenário volta ao estado inicial quando o serviço do Render reinicia. Não apagar `data/` nem interromper a porta 3001 do grupo.
