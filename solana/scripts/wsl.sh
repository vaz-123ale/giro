#!/usr/bin/env bash
# Atalho (lado Windows/Git Bash) para rodar comandos no Ubuntu do WSL com as ferramentas Solana no PATH.
# Uso: bash solana/scripts/wsl.sh 'anchor --version'
MSYS_NO_PATHCONV=1 exec wsl.exe -d Ubuntu -u root --cd /root --exec bash -c ". '/mnt/c/Users/PGD SE7/Downloads/GIRO GIRO v1/GIRO/solana/scripts/ambiente.sh'; $1"
