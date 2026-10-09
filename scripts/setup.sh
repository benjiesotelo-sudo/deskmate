#!/usr/bin/env bash
# One-time setup for Deskmate: pulls the local models and seeds the sample office.
# Safe to run again at any time.
set -euo pipefail
cd "$(dirname "$0")/.."

CHAT_MODEL="${DESKMATE_CHAT_MODEL:-qwen3:4b}"
EMBED_MODEL="${DESKMATE_EMBED_MODEL:-nomic-embed-text}"
OLLAMA_URL="${OLLAMA_HOST:-http://127.0.0.1:11434}"

say() { printf '\n== %s\n' "$1"; }

say "Checking Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node 22.13 or newer from https://nodejs.org and run this again."
  exit 1
fi
node -e '
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node ${process.versions.node} is too old. Deskmate needs Node 22.13 or newer (it uses the built-in SQLite).`);
  process.exit(1);
}
console.log(`Node ${process.versions.node} is fine.`);
'

say "Checking Ollama"
if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed. Install it from https://ollama.com/download and run this again."
  exit 1
fi
if ! curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  echo "Ollama is installed but not running. Starting it in the background."
  (ollama serve >/dev/null 2>&1 &)
  for _ in $(seq 1 20); do
    curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1 && break
    sleep 1
  done
fi
if ! curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  echo "Could not reach Ollama at $OLLAMA_URL. Open the Ollama app, then run this again."
  exit 1
fi
echo "Ollama is running."

say "Pulling the local models (about 2.8 GB the first time)"
ollama pull "$CHAT_MODEL"
ollama pull "$EMBED_MODEL"

say "Installing packages"
if [ ! -d node_modules ]; then
  npm install
else
  echo "Packages are already installed."
fi

say "Seeding the sample office and building Tams' index"
npm run --silent seed

say "Done"
echo "Start Deskmate with: npm run dev"
echo "Then open http://localhost:4747 and sign in as marisol with the password deskmate."
