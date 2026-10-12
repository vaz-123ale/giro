# Recorta, das capturas reais da cena (apresentacao/prints/cena), só as partes usadas no slide 26.
# Nenhum pixel é desenhado: apenas recortes empilhados com espaço em branco entre eles.
import json, os
from PIL import Image
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'prints', 'cena'); S = 3  # escala do dispositivo
def load(n): return Image.open(os.path.join(D, n + '.png')).convert('RGB'), json.load(open(os.path.join(D, n + '.json')))
def crop(im, x, y, w, h, pad=4): return im.crop((int((x - pad) * S), int((y - pad) * S), int((x + w + pad) * S), int((y + h + pad) * S)))
def stack(parts, gap=10, name='x'):
    W = max(p.width for p in parts); H = sum(p.height for p in parts) + gap * S * (len(parts) - 1)
    out = Image.new('RGB', (W, H), 'white'); y = 0
    for p in parts: out.paste(p, (0, y)); y += p.height + gap * S
    out.save(os.path.join(D, f'recorte-{name}.png')); print(name, out.size)
# 1. Início: Livre para usar + Entrou hoje + Já tem destino
im, r = load('depois-inicio'); b, s = r['balance'], r['stats']
stack([crop(im, b['x'], b['y'], b['w'], s['y'] + s['h'] - b['y'])], name='1-inicio')
# 2. Compromisso com João (antes da venda): valores, vencimento + aceite, regra 20%, prioridade
im, r = load('antes-compromisso'); v, m, rg, pr = r['values'], r['meta'], r['regra'], r['prioridade']
row = v['h'] / 3
stack([crop(im, v['x'], v['y'], v['w'], row - 2), crop(im, v['x'], v['y'] + 2 * row, v['w'], row - 2), crop(im, m['x'], m['y'], m['w'], m['h']),
       crop(im, rg['x'], rg['y'], rg['w'], rg['h']), crop(im, pr['x'], pr['y'], pr['w'], pr['h'])], name='2-compromisso')
# 3. Venda de R$ 100: registro, divisão (sem a linha com código interno) e saldo do acordo depois
im, r = load('depois-recibo'); e, a, t = r['eyebrow'], r['amount'], r['title']
top = lambda k, h=78: crop(im, r[k]['x'], r[k]['y'], r[k]['w'], h, pad=2)
parts = [crop(im, e['x'], e['y'], e['w'], e['h']), crop(im, a['x'], a['y'], a['w'], a['h']), top('pedro'), top('joao'), top('livre', 50)]
im2, r2 = load('depois-compromisso'); v2 = r2['values']; row = v2['h'] / 3
parts += [crop(im2, v2['x'], v2['y'] + 2 * row, v2['w'], row - 2)]
stack(parts, gap=8, name='3-venda')
