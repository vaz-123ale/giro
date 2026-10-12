# Gera apresentacao/GIRO-demonstracao.pptx (editável) a partir dos textos da demonstração e dos prints locais.
# Python puro (zipfile + PIL), sem bibliotecas externas de PowerPoint e sem rede. Uso: python apresentacao/ferramentas/gerar-pptx.py
import os, zipfile, datetime
from xml.sax.saxutils import escape
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # pasta apresentacao/
OUT = os.environ.get('GIRO_PPTX', os.path.join(HERE, 'GIRO-demonstracao.pptx'))
EMU = 914400
W, H = 13.333, 7.5
FONT = 'Calibri'
INK, MUTED, GREEN, DEEP, MINT = '0F1A33', '4D5A6E', '0B7A43', '063D29', 'E6F6EC'
ROSE, AMBER, VIOLET, BLUE, LINE, SOFT = 'FDE7EA', 'FFF1D6', 'EFE9FC', 'E6EFFC', 'E3E8EF', 'F6FAF8'

def e(v): return int(round(v * EMU))

class Slide:
    def __init__(self, bg='FFFFFF'):
        self.shapes, self.images, self.nid, self.bg = [], [], 2, bg
    def _id(self):
        self.nid += 1; return self.nid

    # ---------- texto ----------
    @staticmethod
    def runs_xml(runs, size, color, bold=False, italic=False):
        out = []
        for r in runs:
            if isinstance(r, str): r = (r, {})
            text, o = r
            sz = int(o.get('size', size) * 100); c = o.get('color', color)
            b = ' b="1"' if o.get('bold', bold) else ''; i = ' i="1"' if o.get('italic', italic) else ''
            out.append(f'<a:r><a:rPr lang="pt-BR" sz="{sz}"{b}{i} dirty="0"><a:solidFill><a:srgbClr val="{c}"/></a:solidFill>'
                       f'<a:latin typeface="{FONT}"/><a:cs typeface="{FONT}"/></a:rPr><a:t xml:space="preserve">{escape(text)}</a:t></a:r>')
        return ''.join(out)

    def para_xml(self, p, size, color, align, bold, spacing):
        if isinstance(p, (str, tuple)): p = {'runs': [p]}
        runs = p.get('runs') or [p.get('text', '')]
        bullet = p.get('bullet', False); al = p.get('align', align)
        sa = int(p.get('after', spacing) * 100)
        ppr = f'<a:pPr algn="{al}"' + (' marL="285750" indent="-285750"' if bullet else ' marL="0" indent="0"') + '>'
        ppr += f'<a:spcAft><a:spcPts val="{sa}"/></a:spcAft>'
        ppr += (f'<a:buClr><a:srgbClr val="{GREEN}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/>' if bullet else '<a:buNone/>') + '</a:pPr>'
        sz = int(p.get('size', size) * 100)
        return f'<a:p>{ppr}{self.runs_xml(runs, p.get("size", size), p.get("color", color), p.get("bold", bold))}<a:endParaRPr lang="pt-BR" sz="{sz}"/></a:p>'

    def text(self, x, y, w, h, paras, size=16, color=INK, align='l', bold=False, anchor='t', fill=None, radius=None,
             inset=0.0, spacing=4, name='Texto', line=None):
        if not isinstance(paras, list): paras = [paras]
        sid = self._id()
        geom = 'roundRect' if radius else 'rect'
        av = f'<a:avLst><a:gd name="adj" fmla="val {radius}"/></a:avLst>' if radius else '<a:avLst/>'
        fillx = f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>' if fill else '<a:noFill/>'
        ln = f'<a:ln w="9525"><a:solidFill><a:srgbClr val="{line}"/></a:solidFill></a:ln>' if line else '<a:ln><a:noFill/></a:ln>'
        ins = e(inset)
        body = ''.join(self.para_xml(p, size, color, align, bold, spacing) for p in paras)
        self.shapes.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{sid}" name="{escape(name)} {sid}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(w)}" cy="{e(h)}"/></a:xfrm><a:prstGeom prst="{geom}">{av}</a:prstGeom>{fillx}{ln}</p:spPr>'
            f'<p:txBody><a:bodyPr wrap="square" lIns="{ins}" tIns="{ins}" rIns="{ins}" bIns="{ins}" anchor="{anchor}" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>{body}</p:txBody></p:sp>')

    def box(self, x, y, w, h, fill, radius=8000, line=None, name='Forma', shape=None):
        sid = self._id(); geom = shape or ('roundRect' if radius else 'rect')
        av = f'<a:avLst><a:gd name="adj" fmla="val {radius}"/></a:avLst>' if geom == 'roundRect' else '<a:avLst/>'
        ln = f'<a:ln w="9525"><a:solidFill><a:srgbClr val="{line}"/></a:solidFill></a:ln>' if line else '<a:ln><a:noFill/></a:ln>'
        self.shapes.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{sid}" name="{name} {sid}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(w)}" cy="{e(h)}"/></a:xfrm><a:prstGeom prst="{geom}">{av}</a:prstGeom>'
            f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>{ln}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="pt-BR"/></a:p></p:txBody></p:sp>')

    def card(self, x, y, w, h, title, body, fill='FFFFFF', line=LINE, tsize=17, bsize=14):
        self.text(x, y, w, h, [{'runs': [(title, {'bold': True, 'color': INK, 'size': tsize})], 'after': 6}] +
                  [{'runs': body if isinstance(body, list) else [body], 'size': bsize, 'color': MUTED, 'after': 4}],
                  fill=fill, radius=7000, line=line, inset=0.2, name='Cartão')

    def image(self, path, x, y, w, h, descr, shadow=True, align='c'):
        iw, ih = Image.open(path).size
        k = min(w / iw, h / ih); dw, dh = iw * k, ih * k
        dx = x + (w - dw) / 2 if align == 'c' else (x if align == 'l' else x + w - dw)
        dy = y + (h - dh) / 2
        sid = self._id(); rid = f'rId{len(self.images) + 2}'; self.images.append((rid, path))
        eff = ('<a:effectLst><a:outerShdw blurRad="190500" dist="63500" dir="5400000" algn="t" rotWithShape="0">'
               '<a:srgbClr val="0F1A33"><a:alpha val="18000"/></a:srgbClr></a:outerShdw></a:effectLst>') if shadow else ''
        self.shapes.append(
            f'<p:pic><p:nvPicPr><p:cNvPr id="{sid}" name="Print {sid}" descr="{escape(descr)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
            f'<p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
            f'<p:spPr><a:xfrm><a:off x="{e(dx)}" y="{e(dy)}"/><a:ext cx="{e(dw)}" cy="{e(dh)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 2500"/></a:avLst></a:prstGeom>'
            f'<a:ln w="9525"><a:solidFill><a:srgbClr val="{LINE}"/></a:solidFill></a:ln>{eff}</p:spPr></p:pic>')
        return dx, dy, dw, dh

    def table(self, x, y, colw, rows, size=12, header_fill=SOFT, row_h=0.42):
        sid = self._id()
        grid = ''.join(f'<a:gridCol w="{e(c)}"/>' for c in colw)
        trs = []
        for ri, row in enumerate(rows):
            tcs = []
            for ci, cell in enumerate(row):
                hdr = ri == 0; bold = hdr or ci == 0
                color = INK if bold else MUTED
                runs = self.runs_xml([cell], size, color, bold)
                fill = f'<a:solidFill><a:srgbClr val="{header_fill}"/></a:solidFill>' if hdr else '<a:noFill/>'
                tcs.append(f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="l"/>{runs}</a:p></a:txBody>'
                           f'<a:tcPr marL="91440" marR="91440" marT="60960" marB="60960">'
                           f'<a:lnL w="0"><a:noFill/></a:lnL><a:lnR w="0"><a:noFill/></a:lnR><a:lnT w="0"><a:noFill/></a:lnT>'
                           f'<a:lnB w="9525"><a:solidFill><a:srgbClr val="{LINE}"/></a:solidFill></a:lnB>{fill}</a:tcPr></a:tc>')
            trs.append(f'<a:tr h="{e(row_h)}">{"".join(tcs)}</a:tr>')
        self.shapes.append(
            f'<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="{sid}" name="Tabela {sid}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>'
            f'<p:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(sum(colw))}" cy="{e(row_h * len(rows))}"/></p:xfrm>'
            f'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid>{grid}</a:tblGrid>{"".join(trs)}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>')

    def xml(self):
        bg = f'<p:bg><p:bgPr><a:solidFill><a:srgbClr val="{self.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
                f'<p:cSld>{bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>{"".join(self.shapes)}</p:spTree></p:cSld>'
                '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>')

# ----------------------------------------------------------------- conteúdo
P = lambda n: os.path.join(HERE, 'prints', n + '.png')
LOGO = os.path.join(HERE, 'logo_giro.png')
slides = []

def base(eyebrow, title, n_total_placeholder=True, bg='FFFFFF', title_size=32):
    s = Slide(bg)
    s.text(0.6, 0.42, 9, 0.35, {'runs': [(eyebrow.upper(), {'bold': True, 'color': GREEN, 'size': 12})]}, name='Sobretítulo')
    s.text(0.6, 0.72, 12.1, 0.8, {'runs': [(title, {'bold': True, 'size': title_size})]}, anchor='t', name='Título')
    slides.append(s); return s

def footer(s, i, total):
    s.text(0.6, 7.02, 2, 0.3, {'runs': [(f'{i} / {total}', {'size': 10, 'color': '7A8799'})]}, name='Número')
    s.image(LOGO, 9.35, 6.98, 0.9, 0.34, 'GIRO', shadow=False, align='r')
    s.text(10.3, 7.0, 2.5, 0.32, {'runs': [('Demonstração local · dados fictícios', {'size': 10, 'color': '7A8799'})]}, name='Rodapé')

# 1 Capa
s = Slide(MINT); slides.append(s)
s.image(LOGO, 0.8, 1.0, 3.2, 1.0, 'GIRO — Carteira inteligente', shadow=False, align='l')
s.text(0.8, 2.25, 11, 1.9, {'runs': [('Receitas programáveis e confiança comercial para pequenos negócios', {'bold': True, 'size': 42})]})
s.text(0.8, 4.25, 10.5, 0.9, {'runs': [('Defina as regras uma vez — cada venda já nasce organizada, e cada compromisso cumprido vira histórico verificável.', {'size': 20, 'color': MUTED})]})
for k, t in enumerate(['Demonstração do protótipo', 'Tudo rodando localmente', 'Dados fictícios']):
    s.text(0.8 + k * 3.05, 5.45, 2.85, 0.45, {'runs': [(t, {'bold': True, 'size': 13, 'color': DEEP})], 'align': 'ctr'}, fill='FFFFFF', radius=50000, anchor='ctr')

# 2 Problema
s = base('O problema', 'Vender não significa ter o dinheiro livre')
for k, (n, t) in enumerate([('61%', 'usam a conta pessoal para pagar a empresa'), ('30%', 'controlam em planilhas'), ('25%', 'ainda anotam em caderno'), ('10%', 'não têm controle algum')]):
    s.text(0.6 + k * 3.07, 1.75, 2.87, 1.75, [{'runs': [(n, {'bold': True, 'size': 44, 'color': DEEP})], 'after': 2}, {'runs': [(t, {'size': 14, 'color': MUTED})]}], fill='FFFFFF', line=LINE, radius=7000, inset=0.22)
s.text(0.6, 3.62, 12, 0.35, {'runs': [('Fonte: Sebrae, Hábitos Financeiros dos Pequenos Negócios (2026), citado no documento do projeto.', {'size': 11, 'color': '7A8799'})]})
s.card(0.6, 4.2, 5.95, 2.4, 'Dinheiro confuso', 'R$ 2.000 na conta, mas parte já é do fornecedor, do ajudante e do próximo estoque.', fill=ROSE, line='F6CFD5', bsize=16)
s.card(6.75, 4.2, 5.95, 2.4, 'Confiança que não viaja', '“Pode vender para ela, ela sempre paga.” — anos de bom histórico que não acompanham o vendedor para um novo fornecedor.', fill=AMBER, line='F3DFB2', bsize=16)

# 3 Proposta de valor
s = base('Proposta de valor', 'Uma carteira inteligente, não um ERP')
for k, (t, b, f, l) in enumerate([('1. Saber quanto está livre', 'Quanto entrou, quanto já tem destino e quanto realmente é seu — em linguagem simples.', MINT, 'CFE9DA'),
                                   ('2. Acordos que se cumprem', 'Fornecedor e vendedor aceitam uma regra (ex.: 20% das vendas até quitar R$ 600). Cada venda amortiza sozinha e nunca passa do que falta.', BLUE, 'CDDCF6'),
                                   ('3. Confiança verificável', 'Cada acordo concluído gera um comprovante. O histórico positivo passa a pertencer ao vendedor.', VIOLET, 'DDD1F7')]):
    s.card(0.6 + k * 4.1, 1.75, 3.9, 2.55, t, b, fill=f, line=l, tsize=18, bsize=15)
s.card(0.6, 4.55, 5.95, 2.0, 'Organizar ≠ Comprometer', [('Planejamento', {'bold': True, 'color': INK}), ' é pessoal: editável, pausável. ', ('Compromisso', {'bold': True, 'color': INK}), ' é bilateral: só muda com aceite da outra parte.'], bsize=15)
s.card(6.75, 4.55, 5.95, 2.0, 'Sem jargão', 'O vendedor não vê token, blockchain, PDA ou hash. Vê “Livre para usar”, “Já tem destino” e “Acordos concluídos”.', bsize=15)

# 4 Como funciona
s = base('Como funciona', 'Receita → regras → distribuição → saldo livre → confiança')
steps = [('Venda', 'dinheiro ou digital'), ('Regras', 'acordos, equipe, metas'), ('Distribuição', 'automática e limitada'), ('Obrigações', 'quanto falta pagar'), ('Livre', 'o que é seu hoje'), ('Confiança', 'acordos cumpridos')]
for k, (t, sub) in enumerate(steps):
    x = 0.6 + k * 2.05
    s.text(x, 1.8, 1.8, 1.15, [{'runs': [(t, {'bold': True, 'size': 17, 'color': DEEP})], 'align': 'ctr', 'after': 2}, {'runs': [(sub, {'size': 12, 'color': MUTED})], 'align': 'ctr'}], fill=MINT, radius=12000, anchor='ctr', inset=0.08)
    if k < 5: s.text(x + 1.8, 2.15, 0.25, 0.4, {'runs': [('→', {'bold': True, 'size': 18, 'color': GREEN})], 'align': 'ctr'}, anchor='ctr')
s.text(0.6, 3.35, 12, 0.5, {'runs': [('Exemplo da demonstração: venda de R$ 100', {'bold': True, 'size': 20})]})
segs = [(8, '8B6BD6', '8'), (20, 'E06A74', '20'), (10, '5FBF8C', '10'), (62, '0B8A46', 'R$ 62 livres')]
xx = 0.6
for v, c, t in segs:
    ww = 12.1 * v / 100
    s.text(xx, 4.0, ww, 0.6, {'runs': [(t, {'bold': True, 'size': 15, 'color': 'FFFFFF'})], 'align': 'ctr'}, fill=c, anchor='ctr', name='Parte da venda')
    xx += ww
for k, (c, who, t) in enumerate([('8B6BD6', 'Pedro', '8% — comissão do turno ativo'), ('E06A74', 'João', '20% — acordo aceito, até quitar'), ('2F9E6A', 'Estoque', '10% — reserva automática'), ('0B8A46', 'Maria', 'o restante é livre')]):
    s.text(0.6 + k * 3.07, 4.85, 2.9, 1.0, {'runs': [('● ' + who + ' ', {'bold': True, 'color': c}), t], 'size': 15, 'color': MUTED})
s.text(0.6, 5.95, 12.1, 0.8, {'runs': [('Um acordo nunca recebe mais do que falta: quando a dívida é quitada, a parte dele volta a ser livre.', {'size': 16, 'color': MUTED, 'italic': True})]})

# 5 Mapa do site
s = base('Mapa do site', 'Sete áreas, uma ideia cada')
s.table(0.6, 1.65, [2.2, 3.9, 6.0], [
    ['Área', 'Para quê', 'Principais telas'],
    ['Início', 'Resumo: livre, entrou hoje, já tem destino', 'Meu dinheiro, ações rápidas, próximos compromissos, atividades'],
    ['Receber', 'Registrar ou receber dinheiro', 'Registrar venda, venda em dinheiro, para onde vai cada venda, vendas, a receber, caixa'],
    ['Organizar', 'Decidir para onde vai o próprio dinheiro', 'Contas, metas, sugestões, renegociar, adicionar/importar, resumo'],
    ['Compromissos', 'Acordos com outras pessoas', 'Filtros, fornecedores e colaboradores, novo compromisso, detalhes'],
    ['Equipe', 'Quem trabalha e quanto tem a receber', 'Turnos de hoje, escala, check-in, pagamentos, comprovantes'],
    ['Confiança', 'Histórico de compromissos cumpridos', 'Comprovantes, baixar/verificar histórico, fornecedor e trabalhador'],
    ['Mais', 'O restante, sem poluir', 'Contatos, notificações, histórico, acessibilidade, configurações'],
    ['Links da outra parte', 'Fornecedor e trabalhador participam', 'Convite (aceitar/recusar), confirmar recebimento, meu turno'],
], size=13, row_h=0.55)

# 6 Plano de demonstração
s = base('Plano de demonstração · cerca de 10 minutos', 'A história de Maria, João e Pedro')
plan = ['Início — quanto está livre hoje (30 s)', 'Notificações — o que precisa de atenção (20 s)', 'Cadastrar fornecedor e criar compromisso (1 min)', 'João aceita pelo convite (40 s)',
        'Equipe — escala, check-in, turno (1 min)', 'Para onde vai cada venda (40 s)', 'Venda em dinheiro e caixa (1 min)', 'Vendas e a receber — venda ≠ pagamento (30 s)',
        'Organizar — contas, metas e sugestão de % (1 min)', 'Importar documento com revisão (40 s)', 'Compromissos — filtros e situação (40 s)', 'Pagamento confirmado pelas duas partes (40 s)',
        'Confiança — comprovante e histórico verificável (1 min)', 'Acessibilidade e celular (30 s)']
for k, t in enumerate(plan):
    col, row = k // 7, k % 7
    x, y = 0.6 + col * 6.15, 1.7 + row * 0.73
    s.text(x, y, 0.5, 0.5, {'runs': [(str(k + 1), {'bold': True, 'size': 15, 'color': DEEP})], 'align': 'ctr'}, fill=MINT, radius=50000, anchor='ctr', name='Número do passo')
    name, _, rest = t.partition(' — ') if ' — ' in t else (t, '', '')
    s.text(x + 0.65, y + 0.02, 5.3, 0.5, {'runs': [(name, {'bold': True, 'color': INK}), ((' — ' + rest) if rest else '', {'color': MUTED})], 'size': 15}, anchor='ctr')

# 7 Cadastros
s = base('Cadastros', 'Como os cadastros funcionam')
s.table(0.6, 1.6, [2.0, 3.3, 3.5, 3.3], [
    ['Cadastro', 'Onde', 'O que pede', 'Regra importante'],
    ['Pessoa / fornecedor', 'Mais → Fornecedores e contatos, ou dentro do novo compromisso', 'Nome; tipo, celular e observação opcionais', 'Dados ficam só no computador'],
    ['Compromisso', 'Compromissos → + Novo compromisso (5 etapas)', 'Com quem → valor → % das vendas → prazo e prioridade → revisar', 'Só vale depois do aceite da outra parte'],
    ['Colaborador', 'Equipe → Cadastrar colaborador', 'Nome e remuneração: %, valor fixo, diária ou nenhuma', 'Comissão só com turno ativo; escala e check-in opcionais'],
    ['Conta / meta', 'Organizar → Adicionar', 'Nome, valor, vencimento ou data-meta, repetição, modo de reserva', 'Regra pessoal: editar, pausar ou excluir'],
    ['Venda', 'Receber → Registrar venda / Venda em dinheiro', 'Valor, meio, data da venda, data do pagamento', 'Distribui no pagamento, sem passar do que falta'],
    ['Importação', 'Organizar → Adicionar; Novo compromisso', 'Arquivo CSV/TXT ou texto colado', 'Nada é salvo sem revisão'],
], size=12, row_h=0.72)

# Passos com prints
def step(n, eyebrow, title, bullets, say, shots, phone=None):
    s = Slide(); slides.append(s)
    s.text(0.6, 0.45, 4.6, 0.35, {'runs': [(eyebrow.upper(), {'bold': True, 'color': GREEN, 'size': 12})]}, name='Sobretítulo')
    tx = 0.6
    if n:
        s.text(0.6, 0.86, 0.55, 0.55, {'runs': [(str(n), {'bold': True, 'size': 17, 'color': 'FFFFFF'})], 'align': 'ctr'}, fill=GREEN, radius=50000, anchor='ctr', name='Número do passo')
        tx = 1.3
    s.text(tx, 0.78, 5.2 - (tx - 0.6), 1.3, {'runs': [(title, {'bold': True, 'size': 26})]}, name='Título')
    s.text(0.6, 2.2, 4.6, 3.3, [{'runs': b if isinstance(b, list) else [b], 'bullet': True, 'size': 15, 'color': MUTED, 'after': 7} for b in bullets], name='Pontos')
    s.text(0.6, 5.55, 4.6, 1.2, {'runs': say, 'size': 15, 'color': 'FFFFFF'}, fill=DEEP, radius=12000, anchor='ctr', inset=0.2, name='O que falar')
    X, Y, WW, HH = 5.55, 0.55, 7.2, 6.25
    imgs = [(P(a), d) for a, d in shots]
    if len(imgs) == 1:
        s.image(imgs[0][0], X, Y, WW, HH, imgs[0][1])
    elif phone:  # paisagem + celular(es)
        land, phones = imgs[0], imgs[1:]
        pw = 1.95 * len(phones) + 0.2 * (len(phones) - 1)
        s.image(land[0], X, Y, WW - pw - 0.25, HH, land[1])
        for k, (pth, d) in enumerate(phones):
            s.image(pth, X + WW - pw + k * 2.15, Y, 1.95, HH, d)
    else:  # duas paisagens empilhadas
        s.image(imgs[0][0], X, Y, WW, 3.0, imgs[0][1]); s.image(imgs[1][0], X, Y + 3.2, WW, 3.0, imgs[1][1])
    return s

B = lambda t: (t, {'bold': True, 'color': INK})
G = lambda t: (t, {'bold': True, 'color': '9BE7BF'})
step(1, 'Passo 1 · Início', 'Quanto é meu hoje?', [[B('Livre para usar: '), 'R$ 315,40'], [B('Entrou hoje: '), 'R$ 670,00 (abre os pagamentos)'], [B('Já tem destino: '), 'R$ 354,60 (toque para detalhar)'], [B('Meu dinheiro: '), 'livre, planejado e de terceiros'], 'Ações rápidas e próximo compromisso'],
     ['“Maria vendeu R$ 670 hoje, mas ', G('R$ 315 são realmente dela'), '. O resto já tem destino.”'], [('01-inicio', 'Tela Início com saldo livre, entrou hoje, já tem destino e gráfico Meu dinheiro')])
step(2, 'Passo 2 · Notificações', 'O que precisa de atenção', ['Vencimentos próximos e atrasos', 'Respostas de convites e confirmações', 'Previsão: quando o ritmo de vendas não basta', '“Marcar todas como lidas” e “Ver todas”'],
     ['“O GIRO ', G('avisa antes'), ' do vencimento — não inventa dinheiro nem muda acordos sozinho.”'], [('02-notificacoes', 'Painel de notificações aberto')])
step(3, 'Passo 3 · Cadastro', 'Fornecedor e compromisso', ['Cadastrar a pessoa (só o nome é obrigatório)', 'Assistente em 5 etapas: com quem, quanto, % das vendas, prazo e prioridade, revisão', 'Bloqueia regras acima de 100% das vendas', ['Ao final, gera um ', B('convite local'), ' para a outra parte']],
     ['“Maria propõe: ', G('20% das vendas até quitar R$ 600'), ' com João.”'], [('19-contatos', 'Fornecedores e contatos cadastrados'), ('13-novo-compromisso', 'Assistente de novo compromisso')])
step(4, 'Passo 4 · A outra parte', 'O fornecedor aceita', ['O convite mostra só a proposta — nenhum outro dado do negócio', 'Aceitar ou recusar; a resposta vira notificação', ['Mudanças futuras são ', B('pedidos'), ': a outra parte decide'], 'Na demonstração, Ana Embalagens ainda está decidindo'],
     ['“', G('Ninguém altera o acordo sozinho.'), ' É isso que dá valor ao histórico.”'], [('14-convite-fornecedor', 'Página do convite vista pelo fornecedor')])
step(5, 'Passo 5 · Equipe', 'Turno, escala e check-in', ['Pedro: 8% enquanto o turno está ativo, sem escolher o nome a cada venda', [B('Escala: '), 'dias de trabalho e “Turnos de hoje”'], [B('Check-in: '), 'o trabalhador toca “Iniciar meu turno” e Maria confirma'], 'Diárias, valor fixo e comprovantes'],
     ['“Fica registrado ', G('por que'), ' cada valor foi para cada pessoa.”'], [('15-equipe', 'Equipe com turnos de hoje, escala e link de check-in'), ('16-checkin-trabalhador', 'Celular do trabalhador com o botão Iniciar meu turno')], phone=True)
step(6, 'Passo 6 · Receber', 'Para onde vai cada venda', ['Digite um valor e veja a divisão antes de vender', ['Usa o ', B('mesmo motor'), ' da venda real, numa simulação'], 'Respeita turnos, acordos aceitos, prioridades e reservas automáticas', 'Acordo quitado para de receber'],
     ['“De R$ 100: ', G('R$ 20 João, R$ 8 Pedro, R$ 10 estoque, R$ 62 livres'), '.”'], [('04-para-onde-vai', 'Simulação Para onde vai cada venda')])
step(7, 'Passo 7 · Dinheiro físico', 'Venda em dinheiro e caixa', ['Botão grande “Venda em dinheiro”: valor e pronto', ['O GIRO calcula quanto ', B('separar'), ' para cada um'], 'Caixa: esperado, comprometido e livre em espécie', 'A dívida só baixa quando a entrega é confirmada'],
     ['“Blockchain não resolve dinheiro físico — ', G('o GIRO organiza'), ' e registra a entrega.”'], [('05-venda-dinheiro', 'Formulário de venda em dinheiro'), ('06-caixa', 'Caixa em dinheiro')])
step(8, 'Passo 8 · Histórico de vendas', 'Venda hoje, pagamento depois', ['Data da venda ≠ data do pagamento', 'Venda pendente aparece em “A receber”', 'Quando o cliente paga, a comissão continua com quem vendeu', 'Comprovante de cada venda'],
     ['“Pedro vendeu terça, o cliente pagou quinta: ', G('a comissão é do Pedro'), '.”'], [('07-vendas', 'Histórico de vendas recebidas e pendentes')])
step(9, 'Passo 9 · Organizar', 'Contas pessoais', ['Pago, reservado e falta cobrir', 'Repete: todo mês, a cada 15 dias, toda semana', 'Pagar com saldo, registrar pagamento, adicionar à reserva', 'Resumo consolidado de tudo'],
     ['“Reservar não é pagar: ', G('o GIRO separa os dois'), '.”'], [('08-contas', 'Contas com pago, reservado e falta cobrir'), ('11-resumo', 'Resumo consolidado')])
step(None, 'Passo 9 · Metas', 'Sugestão que o vendedor aceita', ['Meta de estoque com reserva automática de 10%', 'No ritmo dos últimos 7 dias, seriam ~32,5%', 'Um toque: “Usar 32,5% nas próximas vendas”', 'Se nem 100% bastar, ele diz claramente'],
     ['“Regra pessoal: ', G('Maria muda quando quiser'), '. Acordo com João só com aceite dele.”'], [('09-metas-sugestao', 'Meta com sugestão de percentual')])
step(10, 'Passo 10 · Importação', 'Importar documento', ['CSV, TXT ou texto colado de boleto/PDF', '“Foram encontrados 4 itens”: editar, marcar, desmarcar', 'Detecta contas que se repetem e sugere “todo mês”', 'Nada é salvo sem revisão'],
     ['“O GIRO ', G('automatiza a digitação'), ', não a decisão.”'], [('10-importar', 'Revisão dos itens encontrados no documento')])
step(11, 'Passo 11 · Compromissos', 'Todos os acordos', ['Filtros por tipo, situação, proposta e período', 'Fornecedores e colaboradores separados', 'Original, pago e saldo restante; selo da proposta', 'Detalhes: histórico, pedidos de mudança, pagamentos'],
     ['“Ana ', G('aguardando aceite'), ', Sol ', G('concluída'), ', João ', G('parcialmente pago'), '.”'], [('12-compromissos', 'Lista de compromissos com filtros')])
step(12, 'Passo 12 · Prova do dinheiro físico', 'Confirmado pelas duas partes', ['Maria registra a entrega em dinheiro', 'Envia o link: “Você recebeu R$ 94,00?”', ['João responde ', B('Recebi'), ' ou ', B('Não recebi'), ', uma vez só'], 'Se não recebeu, Maria é avisada para rever o caixa'],
     ['“Dinheiro físico ganha ', G('o mesmo nível de verificação'), ' quando as duas partes confirmam.”'], [('17-confirmar-recebimento', 'Celular do fornecedor confirmando o recebimento')])
step(13, 'Passo 13 · GIRO Confiança', 'Histórico que acompanha o vendedor', ['Fatos, não notas: concluídos, no prazo, parceiros, recorrentes', ['Cada acordo concluído tem um ', B('código de comprovante')], '“Baixar meu histórico” (pode ocultar nomes) e imprimir', '“Verificar histórico recebido” detecta qualquer alteração'],
     ['“Hoje a confiança fica na memória de quem conhece você. ', G('No GIRO, ela vai junto.'), '”'], [('18-confianca', 'Tela Confiança com comprovantes e histórico')])
step(14, 'Passo 14 · Para todos', 'Acessível e no celular', ['Tamanho do texto: padrão, grande, muito grande', 'Alto contraste e reduzir animações', 'Funciona no celular com barra inferior', 'Leitor de tela: rótulos, foco visível, títulos em ordem'],
     ['“Baixa carga cognitiva — ', G('para qualquer idade'), '.”'], [('20-acessibilidade', 'Página de acessibilidade'), ('21-celular-inicio', 'Início no celular'), ('22-celular-receber', 'Receber no celular')], phone=True)

# 23 Transparência
s = base('Transparência', 'O que já funciona e o que vem depois')
s.card(0.6, 1.75, 3.9, 3.6, 'Funciona hoje (local)', ['Motor de distribuição, acordos com aceite, turnos e escala, caixa físico, contas e metas, importação, comprovantes e verificação do histórico. ', ('258 testes', {'bold': True, 'color': INK}), ' e ', ('34 telas', {'bold': True, 'color': INK}), ' verificadas automaticamente.'], fill=MINT, line='CFE9DA', bsize=15)
s.card(4.7, 1.75, 3.9, 3.6, 'Simulado', 'Pagamento digital e QR, sem dinheiro real. Os links da outra parte abrem neste computador, sem login nem assinatura.', fill=AMBER, line='F3DFB2', bsize=15)
s.card(8.8, 1.75, 3.9, 3.6, 'Próximas etapas', 'Programa Solana no validador local → prova registrada (attestation) → Solana Pay. Depois: Pix/cartão por parceiro, leitura de PDF/imagem e app. Cada etapa com autorização.', fill=BLUE, line='CDDCF6', bsize=15)
s.text(0.6, 5.65, 12.1, 1.0, {'runs': ['Privacidade: na rede iria só o necessário — chave do acordo (hash), valores, situação e código do comprovante. ', ('Nenhum nome, telefone ou CPF', {'bold': True, 'color': INK}), ' (verificado em teste).'], 'size': 16, 'color': MUTED})

# 24 Por que Solana
s = base('Por que blockchain, e só onde faz sentido', 'A planilha de Maria não precisa de blockchain')
s.text(0.6, 1.75, 12.1, 1.8, {'runs': ['Ela passa a ter valor quando Maria e João precisam compartilhar ', ('uma regra', {'color': GREEN}), ' e ', ('uma prova', {'color': GREEN}), ' sem depender da palavra de um deles — nem do próprio GIRO.'], 'size': 28, 'bold': True})
for k, (t, b) in enumerate([('Regra compartilhada', 'Ninguém altera o acordo unilateralmente.'), ('Execução automática', 'Cada venda amortiza a dívida numa única transação.'), ('Prova verificável', 'Compromisso cumprido vira evidência que pertence ao vendedor.')]):
    s.card(0.6 + k * 4.1, 4.2, 3.9, 1.9, t, b, bsize=15)

# 25 Encerramento
s = Slide(MINT); slides.append(s)
s.image(LOGO, 0.8, 0.9, 3.0, 0.95, 'GIRO', shadow=False, align='l')
s.text(0.8, 2.2, 11.7, 2.3, {'runs': ['Hoje o pequeno vendedor recebe primeiro e tenta organizar o dinheiro depois. ', ('No GIRO, ele define as regras uma vez e cada venda já nasce organizada.', {'color': GREEN})], 'size': 30, 'bold': True})
s.text(0.8, 4.75, 11.2, 1.3, {'runs': ['Cada compromisso cumprido ajuda a construir um histórico verificável que acompanha o vendedor para a próxima negociação.'], 'size': 22, 'color': INK})

total = len(slides)
for i, s in enumerate(slides, 1):
    if i not in (1, total): footer(s, i, total)

# ----------------------------------------------------------------- pacote
NS_P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
def rels(items): return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(f'<Relationship Id="{i}" Type="{t}" Target="{g}"/>' for i, t, g in items) + '</Relationships>'

THEME = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="GIRO"><a:themeElements>
<a:clrScheme name="GIRO"><a:dk1><a:srgbClr val="{INK}"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="{DEEP}"/></a:dk2><a:lt2><a:srgbClr val="{MINT}"/></a:lt2>
<a:accent1><a:srgbClr val="{GREEN}"/></a:accent1><a:accent2><a:srgbClr val="E06A74"/></a:accent2><a:accent3><a:srgbClr val="8B6BD6"/></a:accent3><a:accent4><a:srgbClr val="5FBF8C"/></a:accent4><a:accent5><a:srgbClr val="1F5FC4"/></a:accent5><a:accent6><a:srgbClr val="DB9400"/></a:accent6>
<a:hlink><a:srgbClr val="1B5FC0"/></a:hlink><a:folHlink><a:srgbClr val="6D3FB0"/></a:folHlink></a:clrScheme>
<a:fontScheme name="GIRO"><a:majorFont><a:latin typeface="{FONT}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="{FONT}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="GIRO"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="28575"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'''
EMPTY_TREE = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>'
MASTER = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster {NS_P}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>{EMPTY_TREE}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200" b="1"><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1600"><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1600"><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>'
LAYOUT = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout {NS_P} type="blank" preserve="1"><p:cSld name="Em branco GIRO">{EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'

if os.path.exists(OUT): os.remove(OUT)
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    media, ct_slides, pres_rels, sld_ids = {}, [], [], []
    for i, s in enumerate(slides, 1):
        items = [('rId1', REL + '/slideLayout', '../slideLayouts/slideLayout1.xml')]
        for rid, path in s.images:
            if path not in media:
                media[path] = f'image{len(media) + 1}.png'; z.write(path, 'ppt/media/' + media[path])
            items.append((rid, REL + '/image', '../media/' + media[path]))
        z.writestr(f'ppt/slides/slide{i}.xml', s.xml()); z.writestr(f'ppt/slides/_rels/slide{i}.xml.rels', rels(items))
        ct_slides.append(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>')
        pres_rels.append((f'rId{i + 10}', REL + '/slide', f'slides/slide{i}.xml')); sld_ids.append(f'<p:sldId id="{255 + i}" r:id="rId{i + 10}"/>')
    z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
               '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
               '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>'
               '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' + ''.join(ct_slides) + '</Types>')
    z.writestr('_rels/.rels', rels([('rId1', REL + '/officeDocument', 'ppt/presentation.xml'), ('rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'), ('rId3', REL + '/extended-properties', 'docProps/app.xml')]))
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    z.writestr('docProps/core.xml', f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>GIRO — Demonstração</dc:title><dc:creator>GIRO</dc:creator><dc:language>pt-BR</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified></cp:coreProperties>')
    z.writestr('docProps/app.xml', f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>GIRO</Application><Slides>{total}</Slides></Properties>')
    z.writestr('ppt/presentation.xml', f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation {NS_P} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>{"".join(sld_ids)}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:lvl1pPr><a:defRPr lang="pt-BR"/></a:lvl1pPr></p:defaultTextStyle></p:presentation>')
    z.writestr('ppt/_rels/presentation.xml.rels', rels([('rId1', REL + '/slideMaster', 'slideMasters/slideMaster1.xml'), ('rId2', REL + '/theme', 'theme/theme1.xml'), ('rId3', REL + '/presProps', 'presProps.xml'), ('rId4', REL + '/viewProps', 'viewProps.xml'), ('rId5', REL + '/tableStyles', 'tableStyles.xml')] + pres_rels))
    z.writestr('ppt/slideMasters/slideMaster1.xml', MASTER)
    z.writestr('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([('rId1', REL + '/slideLayout', '../slideLayouts/slideLayout1.xml'), ('rId2', REL + '/theme', '../theme/theme1.xml')]))
    z.writestr('ppt/slideLayouts/slideLayout1.xml', LAYOUT)
    z.writestr('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([('rId1', REL + '/slideMaster', '../slideMasters/slideMaster1.xml')]))
    z.writestr('ppt/theme/theme1.xml', THEME)
    z.writestr('ppt/presProps.xml', f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr {NS_P}/>')
    z.writestr('ppt/viewProps.xml', f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr {NS_P}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>')
    z.writestr('ppt/tableStyles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>')
print(f'{total} slides -> {OUT}')
