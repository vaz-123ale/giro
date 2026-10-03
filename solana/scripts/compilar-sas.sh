#!/usr/bin/env bash
# A4 — baixa e compila o Solana Attestation Service (SAS) oficial, para carregar no validador LOCAL.
# Versão fixada por commit (o repositório não publica tags). Conferido em 03/10/2026.
set -euo pipefail

. "$(dirname "$0")/ambiente.sh"
SAS_COMMIT="${SAS_COMMIT:-3164299aac2c74c4925aada8643cb4531b5dbb55}"
SAS_ID="22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG"
ORIGEM="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$HOME/sas"
if [ ! -d "$DIR/.git" ]; then git clone https://github.com/solana-foundation/solana-attestation-service.git "$DIR"; fi
cd "$DIR" && git fetch --quiet origin && git checkout --quiet "$SAS_COMMIT"
grep -q "declare_id!(\"$SAS_ID\")" program/src/lib.rs || { echo "ID do SAS diferente do esperado"; exit 1; }
(cd program && cargo-build-sbf --tools-version "${SBF_TOOLS:-v1.57}")   # reaproveita as platform-tools já baixadas
SO="$(ls target/deploy/*.so 2>/dev/null | head -1)"
mkdir -p "$ORIGEM/target/deploy" && cp "$SO" "$ORIGEM/target/deploy/sas.so"
echo "SAS ($SAS_COMMIT) compilado: solana/target/deploy/sas.so"
