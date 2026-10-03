#!/usr/bin/env bash
# FASE 0 — instala Rust, Solana CLI (Agave) e Anchor (via AVM) DENTRO do Ubuntu/WSL.
# >>> SÓ EXECUTAR COM A AUTORIZAÇÃO A2 REGISTRADA (são downloads de ferramentas). <<<
# Nada do GIRO é enviado para fora: só baixa as ferramentas.
# Uso (no Ubuntu):  bash "/mnt/c/Users/PGD SE7/Downloads/GIRO GIRO v1/GIRO/solana/scripts/fase0-instalar.sh"
set -euo pipefail
ANCHOR_VERSION="${ANCHOR_VERSION:-1.2.0}"   # conferir antes (o ecossistema muda rápido)

sudo apt-get update
sudo apt-get install -y build-essential pkg-config libssl-dev libudev-dev llvm libclang-dev protobuf-compiler curl git rsync

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cargo install --git https://github.com/otter-sec/anchor avm --force
avm install "$ANCHOR_VERSION" && avm use "$ANCHOR_VERSION"

solana config set --url http://127.0.0.1:8899   # SOMENTE validador local
echo
echo "Versões instaladas:"; rustc --version; cargo --version; solana --version; anchor --version
echo "Fase 0 ok. Próximo: bash solana/scripts/compilar-e-testar.sh"
