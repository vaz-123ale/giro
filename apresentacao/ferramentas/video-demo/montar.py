"""Monta o vídeo de 180 s: gravação das 13 cenas encaixada nas janelas do roteiro, narração Kokoro,
legendas em inglês queimadas, faixa de simulação e cartão final.
Uso: python montar.py PASTA_GRAVACAO PASTA_NARRACAO LOGO SAIDA.mp4"""
import json, re, subprocess, sys
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

rec, narr, logo_path, saida = sys.argv[1:5]
W, H, FPS, TOTAL, FIM = 1920, 1080, 30, 180.0, 7.0
cenas = json.load(open(f'{narr}/cenas.json', encoding='utf-8'))
gravadas = {c['n']: c for c in json.load(open(f'{rec}/cenas-gravadas.json', encoding='utf-8'))}
F = lambda n, s: ImageFont.truetype(f'C:/Windows/Fonts/{n}', s)
f_leg, f_band = F('seguisb.ttf', 40), F('seguisb.ttf', 21)

# ---------- linha do tempo: cada cena gravada é esticada/comprimida para a sua janela ----------
segs = []
for i, c in enumerate(cenas, 1):
    g = gravadas[i]; a, b = c['start'], c['end'] - (FIM if i == len(cenas) else 0)
    L = sum(k['t1'] - k['t0'] for k in g['clips']); segs.append((a, b, g, L))
    print(f'cena {i}: {L:.1f}s gravados -> {b - a:.1f}s ({(b - a) / L:.2f}x)')

def quadro(t):
    for a, b, g, L in segs:
        if a <= t < b:
            u = (t - a) / (b - a) * L
            for k in g['clips']:
                d = k['t1'] - k['t0']
                if u <= d or k is g['clips'][-1]:
                    alvo = k['t0'] + min(u, d); f = k['frames'][0]['f']
                    for fr in k['frames']:
                        if fr['t'] <= alvo: f = fr['f']
                        else: break
                    return f, k['kind']
                u -= d
    return None, None

@lru_cache(maxsize=8)
def fundo_celular():
    bg = Image.new('RGB', (W, H)); d = ImageDraw.Draw(bg)
    for y in range(H): d.line([(0, y), (W, y)], fill=(6 + y * 6 // H, 76 - y * 20 // H, 60 - y * 14 // H))
    d.text((150, 420), 'What the customer sees', font=F('seguibl.ttf', 58), fill='white')
    d.text((150, 500), 'Scan the fixed QR code, type the amount, pay.', font=F('segoeui.ttf', 34), fill=(200, 235, 222))
    return bg

@lru_cache(maxsize=4)
def carregar(f, kind):
    im = Image.open(f).convert('RGB')
    if kind != 'phone': return im if im.size == (W, H) else im.resize((W, H), Image.LANCZOS)
    tela = im.resize((428, 926), Image.LANCZOS); out = fundo_celular().copy()
    x, y = 1180, (H - 926) // 2; d = ImageDraw.Draw(out)
    sombra = Image.new('L', (W, H), 0); ImageDraw.Draw(sombra).rounded_rectangle([x - 26, y - 6, x + 454, y + 950], 64, fill=150)
    out.paste((0, 0, 0), (0, 18), sombra.filter(ImageFilter.GaussianBlur(28)))
    d.rounded_rectangle([x - 18, y - 18, x + 446, y + 944], 62, fill=(18, 22, 24))
    m = Image.new('L', tela.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, *tela.size], 46, fill=255)
    out.paste(tela, (x, y), m); return out

# ---------- legendas: frases curtas, tempo proporcional ao tamanho ----------
def pedacos(texto):
    out = []
    for s in re.split(r'(?<=[.;!?])\s+', texto):
        while len(s) > 95:
            cortes = [m.end() for m in re.finditer(r', ', s) if 30 < m.end() < len(s) - 20]
            if not cortes: break
            k = min(cortes, key=lambda p: abs(p - len(s) / 2)); out.append(s[:k].strip()); s = s[k:]
        out.append(s.strip())
    return [p for p in out if p]
legendas = []
for c in cenas:
    t0 = c['start'] + 0.3; ps = pedacos(c['text']); tot = sum(len(p) + 8 for p in ps)
    for p in ps:
        d = c['duration'] * (len(p) + 8) / tot; legendas.append((t0, t0 + d, p)); t0 += d

def quebra(txt, fonte, larg):
    linhas, l = [], ''
    for w in txt.split():
        if fonte.getlength(l + ' ' + w) > larg and l: linhas.append(l); l = w
        else: l = (l + ' ' + w).strip()
    return linhas + [l]

@lru_cache(maxsize=64)
def camada_legenda(txt):
    ls = quebra(txt, f_leg, 1400); lh = 54; w = max(f_leg.getlength(x) for x in ls) + 64; h = lh * len(ls) + 30
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im); x0, y0 = (W - w) / 2, H - 56 - h
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], 20, fill=(9, 24, 19, 205))
    for k, x in enumerate(ls): d.text((W / 2, y0 + 15 + k * lh + lh / 2), x, font=f_leg, fill='white', anchor='mm')
    return im

def faixa():
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im); t = 'Simulated demonstration · fictional data'
    w = f_band.getlength(t) + 40; d.rounded_rectangle([(W - w) / 2, 6, (W + w) / 2, 40], 17, fill=(10, 20, 16, 165))
    d.text((W / 2, 23), t, font=f_band, fill=(255, 255, 255, 235), anchor='mm'); return im
FAIXA = faixa()

def cartao_final():
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
    for y in range(H): d.line([(0, y), (W, y)], fill=(244 - y * 14 // H, 250 - y * 8 // H, 246 - y * 12 // H))
    lg = Image.open(logo_path).convert('RGBA'); lg.thumbnail((560, 260)); im.paste(lg, ((W - lg.width) // 2, 250), lg)
    d.text((W / 2, 610), "Organize today's revenue. Build tomorrow's trust.", font=F('seguisb.ttf', 52), fill=(6, 76, 60), anchor='mm')
    d.text((W / 2, 700), 'Simulated demonstration · fictional data · simulated payments · no real money', font=F('segoeui.ttf', 30), fill=(70, 95, 88), anchor='mm')
    d.text((W / 2, 750), 'Tested with colleagues playing the roles. The pilot is the next step.', font=F('segoeui.ttf', 30), fill=(70, 95, 88), anchor='mm')
    return im
FINAL = cartao_final()

FF = imageio_ffmpeg.get_ffmpeg_exe()
p = subprocess.Popen([FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-i', f'{narr}/narracao-en.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
                      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', saida], stdin=subprocess.PIPE)
inicio_fim = TOTAL - FIM; ultimo = None
for n in range(int(TOTAL * FPS)):
    t = n / FPS
    if t < inicio_fim:
        f, kind = quadro(t); im = carregar(f, kind) if f else ultimo; ultimo = im
    else:
        k = min(1, (t - inicio_fim) / 0.8); im = Image.blend(ultimo, FINAL, k) if k < 1 else FINAL
    im = im.convert('RGBA')
    if t < inicio_fim: im.alpha_composite(FAIXA)
    for a, b, txt in legendas:
        if a <= t < b: im.alpha_composite(camada_legenda(txt)); break
    im = im.convert('RGB')
    if t < 0.5: im = Image.blend(Image.new('RGB', (W, H)), im, t / 0.5)
    if t > TOTAL - 0.6: im = Image.blend(im, Image.new('RGB', (W, H)), (t - TOTAL + 0.6) / 0.6)
    p.stdin.write(im.tobytes())
p.stdin.close(); p.wait()
ts = lambda s: f'{int(s // 3600):02d}:{int(s // 60 % 60):02d}:{int(s % 60):02d},{int(s * 1000 % 1000):03d}'
open(saida[:-4] + '.srt', 'w', encoding='utf-8').write('\n'.join(f'{i + 1}\n{ts(a)} --> {ts(b)}\n{x}\n' for i, (a, b, x) in enumerate(legendas)))
print('pronto', saida)
