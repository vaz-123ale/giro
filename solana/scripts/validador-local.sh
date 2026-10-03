#!/usr/bin/env bash
# Sobe o solana-test-validator SÓ em 127.0.0.1 com o programa do GIRO (e o SAS, se já compilado — A4).
# O Windows alcança http://127.0.0.1:8899 pelo encaminhamento de localhost do WSL2.
set -euo pipefail
. "$(dirname "$0")/ambiente.sh"
ORIGEM="$(cd "$(dirname "$0")/.." && pwd)"
GIRO_ID="CVAQPvyjepuDP9j5df22ipp9E7XWVxej1T26rb4NvEMV"
SAS_ID="22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG"
ARGS=(--reset --bind-address 127.0.0.1 --rpc-port 8899 --ledger "$HOME/giro-ledger"
      --bpf-program "$GIRO_ID" "$ORIGEM/target/deploy/giro_acordos.so")
if [ -f "$ORIGEM/target/deploy/sas.so" ]; then ARGS+=(--bpf-program "$SAS_ID" "$ORIGEM/target/deploy/sas.so"); else echo "SAS ainda não compilado (A4): atestados ficam pendentes."; fi
exec solana-test-validator "${ARGS[@]}"
