#!/usr/bin/env bash

# Claude Code PostToolUse hook
# Runs Prettier and ESLint --fix on files Claude writes or edits.

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only act on Write/Edit tool calls
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
  exit 0
fi

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Must be inside the project
cd "$CLAUDE_PROJECT_DIR"

# Run Prettier on any file it understands
if [[ "$FILE_PATH" =~ \.(js|ts|tsx|jsx|mjs|cjs|json|md|yaml|yml)$ ]]; then
  npm exec -- prettier --write "$FILE_PATH"
fi

# Run ESLint --fix on JS/TS files
if [[ "$FILE_PATH" =~ \.(js|ts|tsx|jsx|mjs|cjs)$ ]]; then
  npm exec -- eslint --fix "$FILE_PATH" || true
fi

exit 0
