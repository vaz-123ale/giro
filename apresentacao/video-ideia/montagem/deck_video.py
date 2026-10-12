"""Vídeo do pitch em slides (180 s): narração em inglês (Kokoro) + slides exportados do PowerPoint.
Uso: python deck_video.py PASTA_DOS_SLIDES SAIDA.mp4
Os slides são s1.png ... s10.png (1920x1080). Cada slide fica na tela o tempo da sua fala; a sobra vira pausas."""
import os, subprocess, sys, wave
import numpy as np
from PIL import Image
import imageio_ffmpeg
from kokoro_onnx import Kokoro

FALAS = [
    "GIRO turns small-business revenue into programmable rules, and commitments kept into verifiable trust.",
    "Meet Maria. She sells fruit all day, and Pix notifications keep ringing. But at night she can't answer a simple question: how much of this money is actually mine? Part belongs to her supplier, part to her helper, and it all sits in the same account she uses at home. She's not alone: Sebrae says sixty-one percent of small businesses pay business expenses from personal accounts, a quarter still use notebooks, and one in ten has no control at all. And there's a second pain. Maria's supplier knows she always pays. But in a new market, a new supplier asks: how would I know that? Years of honesty, and no proof.",
    "GIRO is a smart wallet for small businesses. It records what comes in, separates what's already committed, follows each agreement, and shows what's truly free to spend.",
    "Say Maria owes six hundred reais to João, her supplier, at twenty percent of each sale. A hundred-real sale comes in: twenty go to João, eight to her helper, seventy-two are free, and her debt drops to five hundred and eighty. No math, no notebook.",
    "And here's our biggest value: GIRO Confiança. Every agreement Maria keeps becomes part of a history she owns: paid on time, paid after renegotiation, still active, finished. Both sides confirm each step, even cash payments, so nobody can fake it alone. When Maria meets a new supplier, she shares that history with a link or a QR code. It's not a credit score. It's proof that she keeps her word.",
    "So why Solana? Because proof only matters if nobody can change it, not even us. Each agreement is signed by both sides with their own wallets, and completed agreements get an attestation on Solana. So a new supplier doesn't have to trust GIRO: they can check it themselves. Fees are a fraction of a cent, so it works for ten-real sales, and payments can even split automatically in a Brazilian-real stablecoin. Private details stay off-chain.",
    "And it already works on Solana Devnet: the app, the agreement program, Solana Pay checkout, one-tap signing, cash confirmations and attestations, with 288 automated tests, and a full test with colleagues playing every role.",
    "Payment apps show money coming in. Spreadsheets get abandoned. Credit scores use data vendors don't own. GIRO tracks the agreement itself.",
    "Suppliers feel late payments the most, so they bring their vendors and pay for GIRO, while vendors use it for free. Next, we'll run a two-month pilot with three suppliers and twelve of their vendors in three street markets, measuring late payments, collection time, weekly use and better terms.",
    "We're four Brazilian women. I'm Alessandra, I created GIRO and lead product and development. Talita leads design, Ana Clara reviews and tests the system, and Melissa leads our pitch and marketing. Money organized today, trust for tomorrow. We won first place at WoHackathon, and we're building on Solana. This is GIRO.",
]
TOTAL, SR, FPS, W, H = 180.0, 24000, 30, 1920, 1080
FF = imageio_ffmpeg.get_ffmpeg_exe()
K = Kokoro('../../../ferramentas/kokoro/kokoro-v1.0.onnx', '../../../ferramentas/kokoro/voices-v1.0.bin')
PRON = {'dʒˈoʊoʊ': 'ʒuˈaʊ', 'dʒˈaɪɹoʊ': 'ʒˈiːɹoʊ', 'kɑːnfɪˈænsə': 'koʊnfiˈɑːnsə', 'sˈɛbɹiː': 'sɛbɹˈaɪ', 'ɹˈiːiz': 'hɛˈaɪs'}

def falar(texto, speed):
    fon = K.tokenizer.phonemize(texto.replace('WoHackathon', 'Woh Hackathon'), 'en-us')
    for a, b in PRON.items():
        fon = fon.replace(a, b)
    audio, _ = K.create(fon, voice='af_heart', speed=speed, is_phonemes=True)
    x = np.asarray(audio, np.float32)
    i = np.where(np.abs(x) > 0.006)[0]
    return x[max(i[0] - 240, 0):i[-1] + 2400]

def main():
    pasta, saida = sys.argv[1], sys.argv[2]
    speed = 1.0
    while True:
        clips = [falar(t, speed) for t in FALAS]
        fala = sum(len(c) for c in clips) / SR
        if fala <= TOTAL - 0.55 * len(FALAS) - 1.5 or speed >= 1.15:
            break
        speed += 0.03
    folga = (TOTAL - fala) / len(FALAS)            # pausa distribuída igualmente por slide
    trilha = np.zeros(int(SR * TOTAL), np.float32)
    inicio, t, srt = [], 0.0, []
    for k, c in enumerate(clips):
        inicio.append(t)
        a = t + folga * 0.45
        i = int(a * SR); trilha[i:i + len(c)] += c[:len(trilha) - i]
        fim = a + len(c) / SR
        srt.append((a, fim, FALAS[k]))
        t = fim + folga * 0.55
    print(f'fala {fala:.1f}s, velocidade {speed:.2f}, pausa por slide {folga:.2f}s')
    trilha = (trilha / np.max(np.abs(trilha)) * 0.89 * 32767).astype(np.int16)
    base = os.path.splitext(saida)[0]
    with wave.open(base + '.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(trilha.tobytes())
    ts = lambda s: f"{int(s // 3600):02d}:{int(s // 60 % 60):02d}:{int(s % 60):02d},{int(s * 1000 % 1000):03d}"
    open(base + '.srt', 'w', encoding='utf-8').write('\n'.join(f"{n + 1}\n{ts(a)} --> {ts(b)}\n{x}\n" for n, (a, b, x) in enumerate(srt)))
    slides = [Image.open(os.path.join(pasta, f's{k + 1}.png')).convert('RGB').resize((W, H)) for k in range(len(FALAS))]
    branco = Image.new('RGB', (W, H), 'white')
    cmd = [FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', base + '.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
           '-shortest', '-movflags', '+faststart', saida]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    D = 0.22                                        # transição limpa: esmaece para branco e volta (sem sobrepor textos)
    for f in range(int(TOTAL * FPS)):
        tt = f / FPS
        k = max(j for j, s in enumerate(inicio) if s <= tt)
        img = slides[k]
        prox = inicio[k + 1] if k + 1 < len(inicio) else None
        if prox is not None and prox - tt < D:
            img = Image.blend(img, branco, 1 - (prox - tt) / D)
        elif k > 0 and tt - inicio[k] < D:
            img = Image.blend(branco, img, (tt - inicio[k]) / D)
        if tt < 0.5:
            img = Image.blend(Image.new('RGB', (W, H)), img, tt / 0.5)
        if tt > TOTAL - 0.6:
            img = Image.blend(img, Image.new('RGB', (W, H)), (tt - (TOTAL - 0.6)) / 0.6)
        p.stdin.write(img.tobytes())
    p.stdin.close(); p.wait()
    print('ok', saida, [round(x, 1) for x in inicio])

if __name__ == '__main__':
    main()
