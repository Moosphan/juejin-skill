#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_DIR="${1:-$HOME/.codex/skills/juejin-skill}"

echo "Installing Codex skill to: ${TARGET_DIR}"
rm -rf "${TARGET_DIR}"
mkdir -p "$(dirname "${TARGET_DIR}")"
cp -R "${PACKAGE_ROOT}" "${TARGET_DIR}"

cd "${TARGET_DIR}"

if [ "${JUEJIN_SKILL_SKIP_DEPS:-0}" = "1" ]; then
  echo "Skipping npm and Playwright installation because JUEJIN_SKILL_SKIP_DEPS=1."
else
  if command -v npm >/dev/null 2>&1; then
    npm install
  else
    echo "npm not found. Please install Node.js 20.11+ and rerun."
    exit 1
  fi

  if command -v npx >/dev/null 2>&1; then
    npx playwright install chromium
  else
    echo "npx not found. Please install Node.js 20.11+ and rerun."
    exit 1
  fi
fi

echo "Codex skill installed. Restart Codex to load ~/.codex/skills/juejin-skill."
