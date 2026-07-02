#!/usr/bin/env bash
#
# Pubster — server-side deploy script.
#
# Run this ON THE VPS after `git pull`, with a valid `services/api/.env` in place.
# It is the ONLY sanctioned way to update the running backend.
# NEVER edit source files directly on the VPS (see CLAUDE.md §2).
#
# Steps mirror docs/BACKEND.md §Deploy.
set -euo pipefail

# Resolve repo root (this script lives in <repo>/scripts).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo "==> Installing dependencies (frozen lockfile)"
pnpm install --frozen-lockfile

echo "==> Generating Prisma client"
pnpm --filter @pubster/api exec prisma generate

echo "==> Applying database migrations"
pnpm --filter @pubster/api exec prisma migrate deploy

echo "==> Building @pubster/api"
pnpm --filter @pubster/api build

echo "==> Reloading PM2 process: pubster-api"
pm2 reload ecosystem.config.js --only pubster-api

echo "==> Deploy complete."
