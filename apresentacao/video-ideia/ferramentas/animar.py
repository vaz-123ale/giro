"""Anima uma foto com IA aberta (Wan 2.2 no Hugging Face) e gera uma folha de quadros para conferir.

Uso: python animar.py FOTO "instrução em inglês" SAIDA.mp4 [segundos]
Token opcional (mais cota): variável HF_TOKEN.
"""
import os, shutil, subprocess, sys
from gradio_client import Client, handle_file
import imageio_ffmpeg

NEG = ("static, frozen, blurry, low quality, distorted face, deformed hands, extra fingers, fused fingers, "
       "extra limbs, warped text, subtitles, watermark, oversaturated, cartoon, morphing")

def quadros(video, folha, n=6):
    """Extrai n quadros espaçados e junta numa imagem só (para revisar o movimento)."""
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    filtro = f"fps={n}/4,scale=480:-1,tile={n}x1"
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", video, "-vf", filtro, "-frames:v", "1", folha], check=True)

def main():
    foto, prompt, saida = sys.argv[1], sys.argv[2], sys.argv[3]
    dur = float(sys.argv[4]) if len(sys.argv) > 4 else 4.0
    client = Client("zerogpu-aoti/wan2-2-fp8da-aoti-faster", token=os.environ.get("HF_TOKEN"), verbose=False)
    video, seed = client.predict(handle_file(foto), prompt, 6, NEG, dur, 1, 1, 42, True, api_name="/generate_video")
    caminho = video["video"] if isinstance(video, dict) else video
    shutil.copy(caminho, saida)
    quadros(saida, os.path.splitext(saida)[0] + "-quadros.jpg")
    print(f"ok {saida} seed={seed}")

if __name__ == "__main__":
    main()
