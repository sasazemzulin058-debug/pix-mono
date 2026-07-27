#!/data/data/com.termux/files/usr/bin/sh
set -e

echo "=== Installing pix-mono (pix-core) for Termux/Android ARM64 ==="
AGENT_NPM="${HOME}/.pi/agent/npm"
mkdir -p "$AGENT_NPM"

cd "$AGENT_NPM"
npm install "https://github.com/sasazemzulin058-debug/pix-mono.git#main" --force --legacy-peer-deps

echo "✅ pix-mono successfully installed"
