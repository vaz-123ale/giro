# Caminhos das ferramentas Solana no WSL (usado por todos os scripts).
. "$HOME/.cargo/env" 2>/dev/null || true
export PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
