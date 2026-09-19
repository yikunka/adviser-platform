#!/bin/zsh
# One-time GitHub CLI login — run in Cursor Terminal (Ctrl+`), not Agent chat.
set -e
echo "Logging into GitHub CLI..."
gh auth logout -h github.com -u skaiwong-ui 2>/dev/null || true
gh auth login -h github.com -p https -w
echo
gh auth status
echo
echo "Success — you can close this tab and tell the chat it worked."
