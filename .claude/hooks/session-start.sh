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
  GH_VERSION=$(curl -s https://api.github.com/repos/cli/cli/releases/latest \
    | grep '"tag_name"' \
    | sed 's/.*"v\([^"]*\)".*/\1/')
  curl -L "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
    | tar -xz -C /tmp
  mv "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh
  echo "GitHub CLI installed: $(gh --version)"
else
  echo "GitHub CLI already available: $(gh --version)"
fi
