"""Narração inglesa local de 180 segundos, sincronizada com o roteiro aprovado para demonstração."""
from pathlib import Path
import re, wave, json
import numpy as np
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT.parent / 'Entrega Colosseum' / 'gravacao-local'
OUT.mkdir(parents=True, exist_ok=True)
engine = Kokoro(str(ROOT / 'ferramentas/kokoro/kokoro-v1.0.onnx'), str(ROOT / 'ferramentas/kokoro/voices-v1.0.bin'))
SR = 24000
track = np.zeros(SR * 180, dtype=np.float32)
captions, scenes = [], []
def seconds(t):
    m, s = map(int, t.split(':')); return m * 60 + s
def stamp(t):
    ms = round(t * 1000); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'
for line in (ROOT / 'apresentacao/ROTEIRO-COLISEUM-3-MIN.md').read_text(encoding='utf-8').splitlines():
    if not re.match(r'\| \d\d:\d\d', line): continue
    timing, action, text = [x.strip() for x in line.split('|')[1:4]]
    start, end = map(seconds, timing.split('–'))
    phonemes = engine.tokenizer.phonemize(text, 'en-us')
    for original, replacement in {'dʒˈaɪɹoʊ':'ʒˈiːɹoʊ','dʒˈoʊoʊ':'ʒuˈaʊ','kɑːnfɪˈænsə':'koʊnfiˈɑːnsə'}.items():
        phonemes = phonemes.replace(original, replacement)
    speed = 1.0
    while True:
        clip, rate = engine.create(phonemes, voice='af_heart', speed=speed, is_phonemes=True)
        if rate != SR: raise RuntimeError(f'Taxa de áudio inesperada: {rate}')
        audible = np.flatnonzero(np.abs(clip) > 0.005)
        if len(audible): clip = clip[max(0,audible[0]-240):min(len(clip),audible[-1]+2400)]
        duration = len(clip) / SR
        if duration <= end-start-0.6: break
        speed += 0.05
        if speed > 1.5: raise RuntimeError(f'Reescreva a cena: {timing}')
    offset = start + 0.3
    track[round(offset*SR):round(offset*SR)+len(clip)] += clip
    scenes.append(dict(start=start,end=end,text=text,action=action,duration=duration,speed=round(speed,2)))
    captions.append(f'{len(captions)+1}\n{stamp(offset)} --> {stamp(offset+duration)}\n{text}\n')
    print(f'{timing}: {duration:.1f}s, velocidade {speed:.2f}', flush=True)
peak = max(float(np.max(np.abs(track))), 0.01)
with wave.open(str(OUT / 'narracao-en.wav'), 'wb') as audio:
    audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(SR)
    audio.writeframes((track / peak * 0.89 * 32767).astype(np.int16).tobytes())
(OUT / 'legendas-en.srt').write_text('\n'.join(captions), encoding='utf-8')
(OUT / 'cenas.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2),encoding='utf-8')
print(OUT, flush=True)
