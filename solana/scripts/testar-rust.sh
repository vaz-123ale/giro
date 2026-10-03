#!/usr/bin/env bash
# Só os testes Rust (regras + paridade), sem compilar para a Solana. Rápido.
set -euo pipefail
. "$(dirname "$0")/ambiente.sh"
ORIGEM="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$HOME/giro-solana"
rsync -a --delete --exclude target --exclude test-ledger --exclude Cargo.lock "$ORIGEM/" "$HOME/giro-solana/"
[ -f "$ORIGEM/Cargo.lock" ] && cp "$ORIGEM/Cargo.lock" "$HOME/giro-solana/Cargo.lock"
cd "$HOME/giro-solana" && cargo test -p giro_acordos --lib 2>&1 | grep -E "^error|^warning: unused|^test |test result|^\s+-->|^\s+\|" | head -60
