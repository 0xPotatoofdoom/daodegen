#!/usr/bin/env bash
# scan-secrets.sh -- Scan for leaked secrets in staged files (pre-commit) or all tracked files (CI).
# Exit 1 if any match is found.
set -euo pipefail

# In CI (no stdin tty) or when explicitly asked, scan all tracked files.
# Otherwise scan only staged files (pre-commit hook usage).
if [ -t 0 ] && [ -z "${CI:-}" ]; then
  FILES=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
else
  FILES=$(git ls-files 2>/dev/null || true)
fi

if [ -z "$FILES" ]; then
  echo "scan-secrets: no files to scan"
  exit 0
fi

FOUND=0

# 64-char hex strings (private keys) -- exclude common non-secret patterns
if echo "$FILES" | xargs grep -nE '(0x)?[0-9a-fA-F]{64}' \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    --include='*.sol' --include='*.json' --include='*.env*' --include='*.yml' \
    --include='*.yaml' --include='*.toml' --include='*.sh' 2>/dev/null \
  | grep -viE '(selector|bytes32|keccak256|uint256|0x0{64}|address\(0x)' \
  | grep -viE '(\.gas-snapshot|foundry\.toml|package-lock|node_modules)' \
  | grep -viE '\.env\.example' \
  | grep -viE '\.env\..*\.bak' \
  | grep -viE '\.test\.(ts|tsx|js|jsx):' \
  | grep -viE '(e2e/fixtures/|transferTopic|TX_HASH|deadbeef|0xac0974bec|0x(aa|bb|cc){32})' \
  | grep -viE '(1234567890abcdef|mvp-prayer-test)' \
  | grep -viE '(scan-secrets\.sh|agent\.json|agent_log\.json)'; then
  echo ""
  echo "[!] Potential private key detected (64-char hex)"
  FOUND=1
fi

# API key patterns -- exclude this script itself and test files
if echo "$FILES" | xargs grep -nE '(sk-ant-|sk_live_|sk-proj-|sk_test_)' 2>/dev/null \
  | grep -viE '(scan-secrets\.sh|\.test\.(ts|tsx|js|jsx):)'; then
  echo ""
  echo "[!] API key pattern detected"
  FOUND=1
fi

# RPC URLs with embedded keys
if echo "$FILES" | xargs grep -nE '(g\.alchemy\.com/v2/[a-zA-Z0-9_-]+|infura\.io/v3/[a-zA-Z0-9]+)' 2>/dev/null \
  | grep -v '\.env\.example'; then
  echo ""
  echo "[!] RPC URL with embedded key detected"
  FOUND=1
fi

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "scan-secrets: FAILED -- potential secrets found above"
  exit 1
fi

echo "scan-secrets: OK -- no secrets detected"
exit 0
