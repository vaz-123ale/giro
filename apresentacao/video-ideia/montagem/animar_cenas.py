"""Gera os clipes animados (Wan 2.2) de cada cena com personagens. Pula os que já existem.
Uso: python animar_cenas.py   (HF_TOKEN opcional para mais cota)"""
import os, subprocess, sys, time

BASE = "static camera, keep all signs, labels and text exactly unchanged, consistent 2D illustration style, same characters, "
CENAS = {
    '03': "the woman vendor writes in her notebook and scratches her head, the dog wags its tail, papers flutter gently",
    '08': "the woman looks from her notebook to her phone, puzzled, blinks, question marks float gently",
    '04': "the woman thinks with her hand on her chin, looks at the list, blinks, people walk behind her",
    '01': "busy street market, people walk and shop, vendors serve customers, awnings flutter in the breeze",
    '06': "the man scrolls his phone worried, the woman in the middle writes in her notebook, the woman on the right shuffles receipts",
    '07': "two people shake hands warmly and smile, golden sparkles glow and drift, people behind move naturally",
    '09': "the man smiles with his hand on his chest, the elderly woman points and talks through the megaphone, the supplier strokes his chin thoughtfully",
    '13': "the man carrying a crate walks and looks around, other vendors move naturally",
    '10': "the man gestures while talking, the woman listens with doubt and tilts her head",
    '11': "the man reads the paper and smiles, the digital interface glows and shimmers, papers float gently",
    '12': "the man points to the phone and smiles, the supplier strokes his beard and smiles",
    '20': "the man smiles with his hand on his chest, the glowing panel shimmers, sparkles drift",
    '15': "the man laughs with his hand on his chest, music notes float, the golden badge shines",
    '16': "the man shows his phone and talks, the supplier thinks and nods",
    '23': "the man points to the panel and smiles, the supplier strokes his beard and nods",
    '19': "the man thinks with his hand on his chin, looks puzzled, glowing cubes pulse softly",
    '18': "the man raises his fist in joy holding his phone, the supplier gives a thumbs up and smiles",
    '21': "four women laugh and chat around the laptop, one writes with a pen",
    '26': "four women raise their arms and celebrate, confetti falls, the audience cheers",
    '22': "the women show the laptop to the market vendors, gesturing and smiling, the vendors nod",
}
aqui = os.path.dirname(os.path.abspath(__file__))
for n, p in CENAS.items():
    saida = os.path.join(aqui, 'ia', f'{n}.mp4')
    if os.path.exists(saida):
        continue
    for tentativa in range(3):
        r = subprocess.run([sys.executable, os.path.join(aqui, '..', 'ferramentas', 'animar.py'), os.path.join(aqui, 'img', f'{n}.jpg'), BASE + p, saida, '5'],
                           capture_output=True, text=True, encoding='utf-8', errors='replace')
        if r.returncode == 0:
            print(n, 'ok', flush=True); break
        print(n, 'erro', r.stderr.strip().splitlines()[-1:] if r.stderr else '', flush=True)
        time.sleep(30)
print('fim')
