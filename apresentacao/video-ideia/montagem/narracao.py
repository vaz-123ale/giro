"""Gera a narração do roteiro com o Kokoro (voz neural aberta, roda no PC) encaixada nos tempos de cada cena.
Saídas: audio/narracao.wav (180 s) e roteiro-legendas.srt com os tempos reais de cada fala."""
import asyncio, os, subprocess, wave
import numpy as np
import imageio_ffmpeg
from kokoro_onnx import Kokoro
from legendas import CENAS, ts

VOZ = {'N': 'af_heart', 'JOÃO': 'am_michael', 'NEIGHBOR': 'af_bella'}
K = Kokoro('../../../ferramentas/kokoro/kokoro-v1.0.onnx', '../../../ferramentas/kokoro/voices-v1.0.bin')
# pronúncia em português dos nomes (fonemas)
PRON = {'dʒˈoʊoʊ': 'ʒuˈaʊ', 'dʒˈaɪɹoʊ': 'ʒˈiːɹoʊ', 'kɑːnfɪˈænsə': 'koʊnfiˈɑːnsə', 'sˈɛbɹiː': 'sɛbɹˈaɪ', 'ɹˈiːiz': 'hɛˈaɪs'}
SR, TOTAL, GAP = 24000, 180.0, 0.22
FF = imageio_ffmpeg.get_ffmpeg_exe()
os.makedirs('audio/falas', exist_ok=True)

def quem(f):
    for k in ('JOÃO', 'NEIGHBOR'):
        if f.startswith(k + ':'):
            return k, f[len(k) + 1:].strip()
    return 'N', f

async def falar(texto, voz, _pitch, rate, arq):
    fon = K.tokenizer.phonemize(texto, 'en-us')
    for a, b in PRON.items():
        fon = fon.replace(a, b)
    audio, _ = K.create(fon, voice=voz, speed=1.0 + rate / 100, is_phonemes=True)
    return (np.asarray(audio, np.float32) * 32767)

def aparar(x, lim=200):
    """Tira silêncio do começo e do fim de cada fala."""
    i = np.where(np.abs(x) > lim)[0]
    return x[max(i[0] - 240, 0):i[-1] + 2400] if len(i) else x

async def main():
    trilha = np.zeros(int(SR * TOTAL), np.float32)
    srt, n = [], 1
    for c, (a, b, falas) in enumerate(CENAS):
        janela = (b - a) - 0.5 - GAP * (len(falas) - 1)
        rate = 0
        while True:
            clipes = []
            for k, f in enumerate(falas):
                who, txt = quem(f)
                voz, pitch = VOZ[who], None
                clipes.append((who, txt, aparar(await falar(txt, voz, pitch, rate, f'audio/falas/{c:02d}_{k}'))))
            dur = sum(len(x) for *_, x in clipes) / SR
            if dur <= janela or rate >= 30:
                break
            rate += 5                                   # acelera só o necessário para caber na cena
        t = a + 0.3 + max(0.0, (janela - dur) / 2) * 0.3
        for who, txt, x in clipes:
            i = int(t * SR); trilha[i:i + len(x)] += x[:len(trilha) - i]
            fim = t + len(x) / SR
            srt.append(f"{n}\n{ts(t)} --> {ts(fim)}\n{(who + ': ' if who != 'N' else '') + txt}\n"); n += 1
            t = fim + GAP
        print(f'cena {c + 1:2d}: {dur:5.1f}s de fala em {b - a:4.1f}s (velocidade {rate:+d}%)')
    pico = np.max(np.abs(trilha)) or 1
    trilha = (trilha / pico * 0.89 * 32767).astype(np.int16)
    with wave.open('audio/narracao.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(trilha.tobytes())
    open('roteiro-legendas.srt', 'w', encoding='utf-8').write('\n'.join(srt))
    print('ok audio/narracao.wav')

asyncio.run(main())
