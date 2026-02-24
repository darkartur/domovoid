#!/bin/bash
set -euo pipefail

# Only run in remote environments (Claude Code on the web)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install npm workspace dependencies
npm install

# Install GitHub CLI if not already present
if ! command -v gh &>/dev/null; then
  echo "Installing GitHub CLI..."
  mkdir -p -m 755 /etc/apt/keyrings
  wget -qO /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    https://cli.github.com/packages/githubcli-archive-keyring.gpg
  chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update -qq
  apt-get install -y -qq gh
  echo "GitHub CLI installed: $(gh --version)"
else
  echo "GitHub CLI already available: $(gh --version)"
fi
