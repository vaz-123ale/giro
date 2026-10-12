"""Monta o pitch do GIRO (180 s, 1920x1080, 30 fps, sem áudio) a partir das imagens e das cenas próprias.

Uso: python render.py [saida.mp4] [--previa]   (--previa: 960x540 e 12 fps, para conferir rápido)
Gera também roteiro-legendas.srt (narração com os tempos de cada cena) para sincronizar o áudio depois.
"""
import subprocess, sys
from PIL import Image
import imageio_ffmpeg

PREVIA = '--previa' in sys.argv
W, H = (960, 540) if PREVIA else (1920, 1080)
FPS = 12 if PREVIA else 30
TOTAL = 180.0
XF = 0.7           # duração da transição entre cenas (s)
XS = 0.35          # transição entre estados de uma mesma cena (s)

# (fonte ou lista de estados [(arquivo, início)], início, fim, movimento)
# movimento: (zoom_inicial, zoom_final, foco_x0, foco_y0, foco_x1, foco_y1) — foco em fração da imagem
Z_IN = (1.0, 1.07, .5, .5, .5, .5)
Z_OUT = (1.07, 1.0, .5, .5, .5, .5)
SOFT = (1.0, 1.035, .5, .5, .5, .5)
SEG = [
    ('img/02.jpg', 0, 8, (1.0, 1.08, .5, .42, .5, .36)),            # C01 Meet Maria
    ('img/03.jpg', 8, 12.5, Z_IN),                                   # C02 mesma conta
    ('img/08.jpg', 12.5, 16.5, Z_OUT),                               # C02 caderno
    ('img/04.jpg', 16.5, 20, (1.0, 1.06, .5, .5, .5, .55)),          # C02 recebido ≠ disponível
    ('img/01.jpg', 20, 24, (1.08, 1.0, .35, .5, .5, .5)),            # C03 não é só a Maria
    ('img/06.jpg', 24, 32, (1.06, 1.0, .5, .45, .5, .5)),            # C03 Sebrae 61/25/10
    ('img/07.jpg', 32, 37, (1.0, 1.08, .45, .6, .45, .62)),          # C04 confiança
    ('img/09.jpg', 37, 47, (1.0, 1.06, .4, .45, .6, .45)),           # C05 You can trust João
    ('img/13.jpg', 47, 53, Z_IN),                                    # C06 novo mercado
    ('img/10.jpg', 53, 59, (1.0, 1.07, .45, .5, .5, .5)),            # C06 como o fornecedor vê?
    ('img/11.jpg', 59, 67, (1.0, 1.08, .5, .5, .62, .45)),           # C07 Until GIRO
    ([('cenas/c08_1.png', 67), ('cenas/c08_2.png', 70.5), ('cenas/c08_3.png', 73.5), ('cenas/c08_4.png', 76.5)], 67, 80, SOFT),   # C08
    ([('cenas/c09_1.png', 80), ('cenas/c09_2.png', 84), ('cenas/c09_3.png', 88)], 80, 92, SOFT),                                   # C09
    ([('cenas/c10_1.png', 92), ('cenas/c10_2.png', 93.5), ('cenas/c10_3.png', 95), ('cenas/c10_4.png', 96.5), ('cenas/c10_5.png', 98)], 92, 100, SOFT),  # C10
    ('img/12.jpg', 100, 106, Z_IN),                                  # C10 documentado
    ('img/20.jpg', 106, 114, (1.0, 1.06, .55, .45, .6, .42)),        # C11 GIRO Confiança
    ('img/15.jpg', 114, 122, (1.05, 1.0, .6, .5, .5, .5)),           # C11 histórico
    ('img/16.jpg', 122, 128.5, Z_IN),                                # C12 com permissão
    ('img/23.jpg', 128.5, 135, (1.0, 1.05, .5, .45, .5, .45)),       # C12 verificado
    ('img/19.jpg', 135, 150, (1.0, 1.06, .35, .5, .62, .45)),        # C13 Why Solana
    ('img/18.jpg', 150, 160, (1.0, 1.05, .5, .45, .5, .5)),          # C14 divisão futura
    ([('cenas/c15a_1.png', 160), ('cenas/c15a_2.png', 161.3)], 160, 163.5, SOFT),                                                  # C15 equipe
    ('img/26.jpg', 163.5, 168, (1.0, 1.05, .5, .55, .5, .55)),       # C15 nomes e áreas
    ([('cenas/c15b_1.png', 168), ('cenas/c15b_2.png', 170), ('cenas/c15b_3.png', 172.3)], 168, 175, SOFT),                         # C15 piloto
    ('img/24.jpg', 175, 180, (1.0, 1.03, .5, .5, .5, .5)),           # C16 foto real + frase final
]

_cache = {}
def fonte(path):
    """Imagem preenchendo 16:9 e ampliada 1,25x sobre a saída, para o zoom não perder nitidez."""
    if path not in _cache:
        im = Image.open(path).convert('RGB')
        r = 16 / 9
        if im.width / im.height > r:
            nw = round(im.height * r); x = (im.width - nw) // 2; im = im.crop((x, 0, x + nw, im.height))
        elif im.width / im.height < r:
            nh = round(im.width / r); y = (im.height - nh) // 2; im = im.crop((0, y, im.width, y + nh))
        _cache[path] = im.resize((round(W * 1.25), round(H * 1.25)), Image.LANCZOS)
    return _cache[path]

def suave(p):
    p = min(max(p, 0.0), 1.0)
    return p * p * (3 - 2 * p)

def quadro(img, mov, p):
    z0, z1, fx0, fy0, fx1, fy1 = mov
    e = suave(p)
    z = z0 + (z1 - z0) * e
    fx, fy = fx0 + (fx1 - fx0) * e, fy0 + (fy1 - fy0) * e
    iw, ih = img.size
    cw, ch = iw / z, ih / z
    x = min(max(fx * iw - cw / 2, 0), iw - cw)
    y = min(max(fy * ih - ch / 2, 0), ih - ch)
    return img.resize((W, H), Image.BICUBIC, box=(x, y, x + cw, y + ch))

def cena(i, t):
    src, a, b, mov = SEG[i]
    p = (t - (a - XF / 2)) / ((b + XF / 2) - (a - XF / 2))
    if isinstance(src, str):
        return quadro(fonte(src), mov, p)
    # estados: troca suave entre eles, mesmo movimento de câmera
    idx = max(k for k, (_, s) in enumerate(src) if s <= max(t, a))
    atual = quadro(fonte(src[idx][0]), mov, p)
    if idx > 0 and t - src[idx][1] < XS:
        ant = quadro(fonte(src[idx - 1][0]), mov, p)
        return Image.blend(ant, atual, suave((t - src[idx][1]) / XS))
    return atual

def empurra(a, b, e):
    """Transição limpa: a nova cena entra pela direita empurrando a anterior (sem sobrepor textos)."""
    x = round(W * e)
    out = Image.new('RGB', (W, H))
    out.paste(a.crop((x, 0, W, H)), (0, 0))
    out.paste(b.crop((0, 0, x, H)), (W - x, 0)) if x > 0 else None
    return out

def frame(t):
    i = max(k for k, s in enumerate(SEG) if s[1] <= t) if t >= 0 else 0
    img = cena(i, t)
    if i + 1 < len(SEG) and SEG[i + 1][1] - t < XF / 2:          # entrando na próxima cena
        img = empurra(img, cena(i + 1, t), suave((t - (SEG[i + 1][1] - XF / 2)) / XF))
    elif i > 0 and t - SEG[i][1] < XF / 2:                        # saindo da anterior
        img = empurra(cena(i - 1, t), img, suave((t - (SEG[i][1] - XF / 2)) / XF))
    if t < 0.6:                                                   # abre do preto
        img = Image.blend(Image.new('RGB', (W, H)), img, suave(t / 0.6))
    if t > TOTAL - 0.5:                                           # fecha no preto
        img = Image.blend(img, Image.new('RGB', (W, H)), suave((t - (TOTAL - 0.5)) / 0.5))
    return img

def main():
    saida = next((a for a in sys.argv[1:] if not a.startswith('--')), 'GIRO-pitch-180s.mp4')
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', saida]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(TOTAL * FPS)
    for f in range(n):
        proc.stdin.write(frame(f / FPS).tobytes())
        if f % (FPS * 10) == 0:
            print(f'{f / FPS:5.0f}s', flush=True)
    proc.stdin.close(); proc.wait()
    print('ok', saida)

if __name__ == '__main__':
    main()
