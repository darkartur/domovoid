#!/bin/bash
set -euo pipefail

# Only run in remote environments (Claude Code on the web)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Capture the OAuth token from its file descriptor and persist it for the session.
# This makes CLAUDE_CODE_OAUTH_TOKEN available to all subprocesses (e.g. playwright
# webservers, spawned `claude --print` instances) that can't inherit the fd directly.
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR:-}" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  token=$(cat /proc/$$/fd/"${CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR}" 2>/dev/null | tr -d '\n' || true)
  if [ -n "$token" ]; then
    echo "export CLAUDE_CODE_OAUTH_TOKEN='$token'" >> "$CLAUDE_ENV_FILE"
  fi
fi

# Install npm workspace dependencies
npm install

# Install Playwright browsers (needed for E2E tests)
npx playwright install --with-deps chromium 2>/dev/null || npx playwright install chromium

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
