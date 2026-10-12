# Acrescenta ao FINAL do .pptx existente o slide "GIRO funcionando na prática", com recortes reais da cena
# (apresentacao/prints/cena/recorte-*.png). Não reescreve nenhum slide anterior: só adiciona partes novas
# e registra o slide no pacote. Faz cópia de segurança antes. Uso: python apresentacao/ferramentas/adicionar-slide-26.py
import os, re, shutil, zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # pasta apresentacao/
DECK = os.environ.get('GIRO_PPTX', os.path.join(HERE, 'GIRO-demonstracao.pptx'))
BACKUP = DECK.replace('.pptx', '-antes-slide26.pptx')
TITLE = 'GIRO funcionando na prática'
NARRACAO = ('Aqui a gente vê o GIRO funcionando. Primeiro, Maria acompanha quanto entrou, quanto já tem destino e quanto realmente está livre. '
            'Ela tem um compromisso de seiscentos reais com João, com 20% das vendas destinados a esse acordo. Quando entra uma venda de cem reais, '
            'o sistema aplica as regras: registra oito reais para Pedro, vinte para João e atualiza automaticamente o saldo do compromisso. '
            'E, se o ritmo das vendas não for suficiente para o prazo, o GIRO avisa e permite propor uma renegociação.')

# Reaproveita os mesmos utilitários de desenho do gerador original (só a parte de definições, nada é gerado).
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gerar-pptx.py'), encoding='utf8').read()
exec(src.split('# ----------------------------------------------------------------- conteúdo')[0])
exec(src.split('# ----------------------------------------------------------------- pacote')[1].split('if os.path.exists(OUT)')[0])

AMBER_STRONG, AMBER_SOFT, AMBER_TEXT = 'F2B53A', 'FFF4DC', '6B4500'
CUT = lambda n: os.path.join(HERE, 'prints', 'cena', f'recorte-{n}.png')

s = Slide('FFFFFF')
s.text(0.6, 0.42, 9, 0.35, {'runs': [('NA PRÁTICA', {'bold': True, 'color': GREEN, 'size': 12})]}, name='Sobretítulo')
s.text(0.6, 0.72, 12.1, 0.8, {'runs': [(TITLE, {'bold': True, 'size': 32})]}, name='Título')
cards = [('1', 'Home', CUT('1-inicio'), 'Quanto está realmente livre', 'Início: Livre para usar R$ 72,00, Entrou hoje R$ 100,00, Já tem destino R$ 28,00'),
         ('2', 'Compromisso com João', CUT('2-compromisso'), 'Regra aceita entre as partes', 'Compromisso com João: valor original R$ 600,00, saldo restante R$ 600,00, vencimento 10/10/2026, ativo e aceito, regra 20% do valor bruto, prioridade alta'),
         ('3', 'Venda + resultado', CUT('3-venda'), 'Cada venda atualiza automaticamente o acordo', 'Registro de recebimento de R$ 100,00: Pedro R$ 8,00 (8%), João R$ 20,00 (20%), livre para o titular R$ 72,00; saldo restante do acordo com João R$ 580,00')]
CW, GAP, Y0, CH = 3.75, 0.45, 1.5, 4.55
for k, (num, label, img, caption, alt) in enumerate(cards):
    x = 0.6 + k * (CW + GAP)
    s.box(x, Y0, CW, CH, 'FFFFFF', radius=6000, line=LINE, name='Cartão')
    s.text(x + 0.22, Y0 + 0.2, 0.42, 0.42, {'runs': [(num, {'bold': True, 'size': 14, 'color': 'FFFFFF'})], 'align': 'ctr'}, fill=DEEP, radius=50000, anchor='ctr', name='Número')
    s.text(x + 0.74, Y0 + 0.2, CW - 0.9, 0.42, {'runs': [(label, {'bold': True, 'size': 15, 'color': DEEP})]}, anchor='ctr', name='Rótulo')
    s.image(img, x + 0.2, Y0 + 0.78, CW - 0.4, 2.8, alt, shadow=False)
    s.text(x + 0.2, Y0 + 3.68, CW - 0.4, 0.7, {'runs': [(caption, {'bold': True, 'size': 15, 'color': DEEP})], 'align': 'ctr'}, fill=MINT, radius=50000, anchor='ctr', name='Legenda')
    if k < 2:  # seta discreta entre os recortes
        s.box(x + CW + 0.09, Y0 + CH / 2 - 0.16, 0.27, 0.32, AMBER_STRONG, radius=None, shape='rightArrow', name='Seta')
s.text(0.6, 6.25, 12.1, 0.55, {'runs': [('⚠  ', {'color': AMBER_STRONG, 'bold': True}), 'Se o ritmo das vendas não for suficiente para o prazo, ', ('o GIRO avisa e permite propor uma renegociação.', {'bold': True, 'color': AMBER_TEXT})], 'size': 16, 'color': INK},
       fill=AMBER_SOFT, radius=50000, anchor='ctr', inset=0.15, line='F3DFB2', name='Aviso de ritmo')

# ------------------------------------------------------------------ inserção no pacote existente
if not os.path.exists(BACKUP): shutil.copy2(DECK, BACKUP)
with zipfile.ZipFile(DECK) as z: parts = {n: z.read(n) for n in z.namelist()}
if any(TITLE.encode('utf8') in v for k, v in parts.items() if re.match(r'ppt/slides/slide\d+\.xml$', k)):
    raise SystemExit('O slide "GIRO funcionando na prática" já existe no arquivo. Nada foi alterado.')
n = max(int(m.group(1)) for k in parts if (m := re.match(r'ppt/slides/slide(\d+)\.xml$', k))) + 1
s.text(0.6, 7.02, 2, 0.3, {'runs': [(str(n), {'size': 10, 'color': '7A8799'})]}, name='Número')
s.image(os.path.join(HERE, 'logo_giro.png'), 9.35, 6.98, 0.9, 0.34, 'GIRO', shadow=False, align='r')
s.text(10.3, 7.0, 2.5, 0.32, {'runs': [('Demonstração local · dados fictícios', {'size': 10, 'color': '7A8799'})]}, name='Rodapé')

pres = parts['ppt/presentation.xml'].decode('utf8'); prels = parts['ppt/_rels/presentation.xml.rels'].decode('utf8'); ct = parts['[Content_Types].xml'].decode('utf8')
rid_n = max(int(x) for x in re.findall(r'Id="rId(\d+)"', prels)) + 1
sid = max(int(x) for x in re.findall(r'<p:sldId id="(\d+)"', pres)) + 1
media_n = max([int(m.group(1)) for k in parts if (m := re.match(r'ppt/media/image(\d+)\.\w+$', k))] + [0])
slide_rels = [('rId1', REL + '/slideLayout', '../slideLayouts/slideLayout1.xml')]
for rid, path in s.images:
    media_n += 1; name = f'image{media_n}.png'; parts['ppt/media/' + name] = open(path, 'rb').read()
    slide_rels.append((rid, REL + '/image', '../media/' + name))

# Notas do apresentador (narração de ~30 s). Cria o modelo de anotações só se o arquivo ainda não tiver.
if 'ppt/notesMasters/notesMaster1.xml' not in parts:
    parts['ppt/theme/theme2.xml'] = THEME.encode('utf8')
    parts['ppt/notesMasters/notesMaster1.xml'] = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notesMaster {NS_P}><p:cSld>{EMPTY_TREE}</p:cSld>'
        '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:notesMaster>').encode('utf8')
    parts['ppt/notesMasters/_rels/notesMaster1.xml.rels'] = rels([('rId1', REL + '/theme', '../theme/theme2.xml')]).encode('utf8')
    nm_rid = f'rId{rid_n}'; rid_n += 1
    prels = prels.replace('</Relationships>', f'<Relationship Id="{nm_rid}" Type="{REL}/notesMaster" Target="notesMasters/notesMaster1.xml"/></Relationships>')
    pres = pres.replace('</p:sldMasterIdLst>', f'</p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="{nm_rid}"/></p:notesMasterIdLst>', 1)
    ct = ct.replace('</Types>', '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
                    '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/></Types>')
notes = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes {NS_P}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>'
         '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Imagem do slide"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>'
         '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Anotações"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>'
         f'<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR" dirty="0"/><a:t>{escape("Narração (~30 s): " + NARRACAO)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>')
parts[f'ppt/notesSlides/notesSlide{n}.xml'] = notes.encode('utf8')
parts[f'ppt/notesSlides/_rels/notesSlide{n}.xml.rels'] = rels([('rId1', REL + '/notesMaster', '../notesMasters/notesMaster1.xml'), ('rId2', REL + '/slide', f'../slides/slide{n}.xml')]).encode('utf8')
slide_rels.append((f'rId{len(s.images) + 2}', REL + '/notesSlide', f'../notesSlides/notesSlide{n}.xml'))

parts[f'ppt/slides/slide{n}.xml'] = s.xml().encode('utf8')
parts[f'ppt/slides/_rels/slide{n}.xml.rels'] = rels(slide_rels).encode('utf8')
prels = prels.replace('</Relationships>', f'<Relationship Id="rId{rid_n}" Type="{REL}/slide" Target="slides/slide{n}.xml"/></Relationships>')
pres = pres.replace('</p:sldIdLst>', f'<p:sldId id="{sid}" r:id="rId{rid_n}"/></p:sldIdLst>')
ct = ct.replace('</Types>', f'<Override PartName="/ppt/slides/slide{n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
                f'<Override PartName="/ppt/notesSlides/notesSlide{n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/></Types>')
parts['ppt/presentation.xml'] = pres.encode('utf8'); parts['ppt/_rels/presentation.xml.rels'] = prels.encode('utf8'); parts['[Content_Types].xml'] = ct.encode('utf8')
if 'docProps/app.xml' in parts: parts['docProps/app.xml'] = re.sub(rb'<Slides>\d+</Slides>', f'<Slides>{n}</Slides>'.encode(), parts['docProps/app.xml'])

tmp = DECK + '.tmp'
with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
    order = ['[Content_Types].xml'] + [k for k in parts if k != '[Content_Types].xml']
    for k in order: z.writestr(k, parts[k])
os.replace(tmp, DECK)
print(f'Slide {n} adicionado ao final. Cópia de segurança: {os.path.basename(BACKUP)}')
