#!/bin/sh
# Installs node_modules (kept in a Docker volume, Linux binaries) only when package-lock.json changes,
# then runs the given command.
set -e

hash=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ ! -f node_modules/.lock-hash ] || [ "$(cat node_modules/.lock-hash)" != "$hash" ]; then
  echo "→ npm ci (package-lock.json changed)"
  npm ci --no-audit --no-fund
  echo "$hash" > node_modules/.lock-hash
fi

exec "$@"
