#!/usr/bin/env bash
# "Option B" — git-based redeploy. Sibling to 06-redeploy-code.sh: pulls the
# latest main directly on the server instead of rsync-ing a local checkout.
# Useful when deploying from a machine that doesn't have a local clone of
# this repo, just SSH access — this script only needs the SSH key.
#
# One-time setup required on the server before the first run (~/ParentGuard
# there was populated by 03-deploy-app.sh's rsync, which never creates a
# .git — turn it into a real repo once):
#   ssh -i ./<key>.pem ubuntu@<ip>
#   cd ~/ParentGuard && git init && git remote add origin <your-repo-url> \
#     && git fetch origin main && git reset --hard origin/main
#
# Same tail as 06 otherwise (install/migrate/build/restart), domain/SSL
# config untouched.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# shellcheck source=config.env
source ./config.env
# shellcheck source=credentials.txt
source ./credentials.txt

SSH_KEY="./${KEY_NAME}.pem"
REMOTE="ubuntu@${PUBLIC_IP}"

echo "Pulling latest main directly on ${REMOTE}..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$REMOTE" bash -s <<'REMOTE_SCRIPT'
set -euo pipefail
cd ~/ParentGuard
export PATH="$PATH:$(npm config get prefix)/bin"
export NODE_OPTIONS="--max-old-space-size=1536"

echo "-- git fetch + reset --hard origin/main --"
git fetch origin main
git reset --hard origin/main

echo "-- backend: npm install --"
cd ~/ParentGuard/backend
npm install

echo "-- prisma generate + migrate deploy (no-op if nothing changed) --"
npx prisma generate
npx prisma migrate deploy

echo "-- backend: build (tsc) --"
npm run build

echo "-- admin_web: npm install + build --"
cd ~/ParentGuard/admin_web
npm install
npm run build

echo "-- restarting via pm2 --"
pm2 restart parentguard-backend parentguard-admin
pm2 save
REMOTE_SCRIPT

echo ""
echo "== Redeploy done (via git) — domain/SSL config untouched =="
