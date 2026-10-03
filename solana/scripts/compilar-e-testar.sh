#!/usr/bin/env bash
# Compila e testa o programa giro_acordos no Linux do WSL (compilar dentro de /mnt/c é muito lento).
# 1. copia solana/ para ~/giro-solana · 2. cargo test (regras + 1.165 vetores de paridade do GIRO)
# 3. anchor build (gera .so e IDL) · 4. copia .so e IDL de volta para solana/target/ no Windows.
set -euo pipefail

. "$(dirname "$0")/ambiente.sh"
ORIGEM="$(cd "$(dirname "$0")/.." && pwd)"
TRABALHO="$HOME/giro-solana"
mkdir -p "$TRABALHO"
rsync -a --delete --exclude target --exclude test-ledger --exclude Cargo.lock "$ORIGEM/" "$TRABALHO/"
[ -f "$ORIGEM/Cargo.lock" ] && cp "$ORIGEM/Cargo.lock" "$TRABALHO/Cargo.lock"
cd "$TRABALHO"
mkdir -p target/deploy && cp keys/giro_acordos-keypair.json target/deploy/giro_acordos-keypair.json
anchor keys list
cargo test -p giro_acordos --lib            # regras puras + paridade com o motor do GIRO
anchor build
mkdir -p "$ORIGEM/target/deploy" "$ORIGEM/target/idl"
cp target/deploy/giro_acordos.so "$ORIGEM/target/deploy/"
cp target/idl/giro_acordos.json "$ORIGEM/target/idl/"
cp Cargo.lock "$ORIGEM/Cargo.lock"   # trava as versões das dependências
echo "Compilado: solana/target/deploy/giro_acordos.so e solana/target/idl/giro_acordos.json"
