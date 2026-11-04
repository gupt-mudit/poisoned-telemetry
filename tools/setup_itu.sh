#!/usr/bin/env bash
# Add ITU's reference KB code as a pinned submodule (MIT licence, keeps its history intact).
set -euo pipefail
cd "$(dirname "$0")/.."
ITU_COMMIT=84010da9e9c443afcceeccb86d1700a662223395
if ! { [ -d kb/ITUAIReadiness/.git ] || [ -f kb/ITUAIReadiness/.git ]; }; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git submodule add https://github.com/CrashingGuru/ITUAIReadiness kb/ITUAIReadiness
  else   # project folder is not a git repo yet: a plain pinned clone works the same
    git clone https://github.com/CrashingGuru/ITUAIReadiness kb/ITUAIReadiness
  fi
fi
git -C kb/ITUAIReadiness fetch --quiet origin && git -C kb/ITUAIReadiness checkout --quiet "$ITU_COMMIT"
echo "ITU reference code pinned at $ITU_COMMIT"
echo "Next: install Ollama, then: ollama pull nomic-embed-text"
