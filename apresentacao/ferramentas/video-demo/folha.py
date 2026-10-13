"""Folha de contato: 6 quadros por cena, para revisão rápida."""
import json, sys
from PIL import Image
rec = sys.argv[1]; cenas = json.load(open(f'{rec}/cenas-gravadas.json', encoding='utf-8'))
for grupo in range(0, len(cenas), 4):
    parte = cenas[grupo:grupo + 4]; tw, th = 384, 216
    out = Image.new('RGB', (tw * 6, th * len(parte)), 'white')
    for r, c in enumerate(parte):
        frames = [f for clip in c['clips'] for f in clip['frames']]
        for k in range(6):
            f = frames[min(len(frames) - 1, round(k * (len(frames) - 1) / 5))]['f']
            im = Image.open(f).convert('RGB'); im.thumbnail((tw, th)); out.paste(im, (k * tw, r * th))
    out.save(f'{rec}/folha-{grupo // 4 + 1}.jpg', quality=85)
print('ok')
