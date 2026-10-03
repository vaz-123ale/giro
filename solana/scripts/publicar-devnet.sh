#!/usr/bin/env bash
# Publica o programa giro_acordos na DEVNET (rede pública de TESTE, sem dinheiro real).
# Autorização A5 (Devnet) concedida em 03/10/2026. Mainnet NÃO: exige autorização separada.
# Pré-requisito: ~3,1 SOL de TESTE na carteira de implantação (faucet: https://faucet.solana.com).
set -euo pipefail
. "$(dirname "$0")/ambiente.sh"
cd "$(dirname "$0")/.."
IMPLANTADOR=keys/implantador.json
echo "Carteira de implantação: $(solana-keygen pubkey $IMPLANTADOR)"
echo "Saldo: $(solana balance $IMPLANTADOR --url devnet)"
solana program deploy target/deploy/giro_acordos.so \
  --program-id keys/giro_acordos-keypair.json \
  --keypair $IMPLANTADOR --upgrade-authority $IMPLANTADOR \
  --url devnet --max-sign-attempts 30 --with-compute-unit-price 1000
solana program show CVAQPvyjepuDP9j5df22ipp9E7XWVxej1T26rb4NvEMV --url devnet --keypair $IMPLANTADOR
