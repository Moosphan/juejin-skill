#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_REPO="${1:-$(pwd)}"
RUNTIME_DIR="${TARGET_REPO}/.juejin-skill"
COMMANDS_DIR="${TARGET_REPO}/.claude/commands"

echo "Installing Claude Code assets into: ${TARGET_REPO}"
mkdir -p "${COMMANDS_DIR}"
rm -rf "${RUNTIME_DIR}"
mkdir -p "${RUNTIME_DIR}"

cp -R "${PACKAGE_ROOT}/bin" "${RUNTIME_DIR}/bin"
cp -R "${PACKAGE_ROOT}/src" "${RUNTIME_DIR}/src"
cp "${PACKAGE_ROOT}/package.json" "${RUNTIME_DIR}/package.json"
if [ -f "${PACKAGE_ROOT}/package-lock.json" ]; then
  cp "${PACKAGE_ROOT}/package-lock.json" "${RUNTIME_DIR}/package-lock.json"
fi
cp -R "${PACKAGE_ROOT}/.claude/commands/." "${COMMANDS_DIR}/"

cd "${RUNTIME_DIR}"

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

echo "Claude Code commands installed."
echo "Available commands:"
echo "  /juejin-hot"
echo "  /juejin-login"
echo "  /juejin-publish"
echo "  /juejin-download"
