"""Gera cenas-pt.html (versão em português das cenas próprias do vídeo)."""
s = open('cenas.html', encoding='utf-8').read()
T = [('lang="en"', 'lang="pt-BR"'), ('Supply agreement · 20% of registered sales', 'Acordo de fornecimento · 20% das vendas registradas'),
     ('Maria · today', 'Maria · hoje'), ('>Registered income<', '>Receita registrada<'), ('R$ 1,000', 'R$ 1.000'),
     ('Reserved · stock', 'Reservado · estoque'), ('Reserved · commitment', 'Reservado · compromisso'), ('Available to spend', 'Disponível para usar'),
     ('Registered <b>R$1,000</b> • Reserved <b>R$400</b> • Available <b>R$600</b>', 'Registrado <b>R$ 1.000</b> • Reservado <b>R$ 400</b> • Disponível <b>R$ 600</b>'),
     ('Personal planning <b>≠</b> Mutual agreement', 'Planejamento pessoal <b>≠</b> Acordo mútuo'),
     ('>Personal planning<', '>Planejamento pessoal<'), ('Maria decides on her own', 'A Maria decide sozinha'), ('Stock reserve', 'Reserva de estoque'),
     ('✓ Her decision', '✓ Decisão dela'), ('>Mutual agreement<', '>Acordo mútuo<'), ('João and his supplier', 'João e o fornecedor'),
     ('20% of registered sales', '20% das vendas registradas'), ('>to supplier<', '>→ fornecedor<'),
     ('✓ João accepted', '✓ João aceitou'), ('✓ Supplier accepted', '✓ Fornecedor aceitou'),
     ('>Proposed<div class="sub">terms sent', '>Proposto<div class="sub">termos enviados'), ('>Accepted<div class="sub">two confirmations', '>Aceito<div class="sub">duas confirmações'),
     ('>Tracked<div class="sub">obligations followed', '>Acompanhado<div class="sub">obrigações seguidas'), ('>Evidence<div class="sub">receipts attached', '>Evidência<div class="sub">comprovantes anexados'),
     ('>Confirmed<div class="sub">outcome', '>Confirmado<div class="sub">resultado'), ('João cannot certify it alone.', 'O João não pode certificar sozinho.'),
     ('20% agreement • Evidence • <b>Confirmed outcome</b>', 'Acordo de 20% • Evidência • <b>Resultado confirmado</b>'),
     ('4 Brazilian women • <b>Mathematics</b> • <b>Software Development</b> • <b>Marketing</b> • <b>Graphic Design</b>', '4 brasileiras • <b>Matemática</b> • <b>Desenvolvimento de Sistemas</b> • <b>Marketing</b> • <b>Design Gráfico</b>'),
     ("'3 markets · 4 vendors each'", "'3 feiras · 4 feirantes cada'"), ("'12 pilot users'", "'12 participantes do piloto'"), ("'2 free months'", "'2 meses grátis'"),
     ("'Hands-on support'", "'Acompanhamento de perto'"), ("'Referrals'", "'Indicações'"), ("'Affordable pricing'", "'Preço acessível'")]
T += [('.row .v{margin-left:auto;', '.row .v{white-space:nowrap;margin-left:auto;'), ('.row{display:flex;', '.row{white-space:nowrap;display:flex;'),
      ('style="right:60px;top:80px;width:720px"', 'style="right:50px;top:80px;width:780px"')]
for a, b in T:
    assert a in s, a
    s = s.replace(a, b)
open('cenas-pt.html', 'w', encoding='utf-8').write(s)
print('ok')
