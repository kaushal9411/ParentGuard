#!/usr/bin/env bash
# Syncs the repo to the EC2 instance from 02-launch-ec2.sh and brings
# backend + admin_web up there: Postgres runs natively (matching local dev
# — this app has no docker-compose.yml), both apps run as plain Node
# processes managed by pm2, plus Soketi (the websocket server the repo
# already ships a config for, soketi.json) via pm2 too. Re-run this any
# time you want to push local changes; it's idempotent (keeps the same
# DB/JWT secrets across re-deploys).
#
# mobile_app/ (the actual primary product, per this repo's own README) is
# NOT synced or deployed here — Flutter builds/distributes separately, out
# of scope for this web-side test box.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
REPO_ROOT="$(cd ../.. && pwd)"   # -> ParentGuard/

# shellcheck source=config.env
source ./config.env
# shellcheck source=credentials.txt
source ./credentials.txt

# DB_PASSWORD is optional in config.env — generate one on first deploy and
# persist it to credentials.txt so re-deploys reuse the same password
# instead of locking themselves out of the existing database.
if [ -z "${DB_PASSWORD:-}" ]; then
  if grep -q '^DB_PASSWORD=' ./credentials.txt 2>/dev/null; then
    DB_PASSWORD=$(grep '^DB_PASSWORD=' ./credentials.txt | cut -d= -f2-)
  else
    DB_PASSWORD=$(openssl rand -base64 18)
    echo "DB_PASSWORD=$DB_PASSWORD" >> ./credentials.txt
    echo "Generated DB_PASSWORD, saved to credentials.txt."
  fi
fi

SSH_KEY="./${KEY_NAME}.pem"
REMOTE="ubuntu@${PUBLIC_IP}"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $REMOTE"

echo "Waiting for cloud-init (Postgres/Node/pm2 install) to finish on the instance..."
until $SSH 'test -f ~/cloud-init-done' 2>/dev/null; do sleep 5; done
echo "Cloud-init done."

echo "Syncing repo to ${REMOTE}:~/ParentGuard ..."
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude .next --exclude dist \
  --exclude mobile_app --exclude android_native \
  --exclude '.env' --exclude '.env.local' --exclude '.env.*.local' \
  --exclude '.env.development' --exclude '.env.production' --exclude '.env.test' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
  "$REPO_ROOT/" "$REMOTE:~/ParentGuard/"

echo "Running remote setup (this can take a few minutes — installs deps, builds both apps)..."
$SSH bash -s -- "$TEST_DOMAIN" "$DB_NAME" "$DB_USER" "$DB_PASSWORD" <<'REMOTE_SCRIPT'
set -euo pipefail
TEST_DOMAIN="$1"; DB_NAME="$2"; DB_USER="$3"; DB_PASSWORD="$4"

cd ~/ParentGuard
export PATH="$PATH:$(npm config get prefix)/bin"
export NODE_OPTIONS="--max-old-space-size=1536"

echo "-- ensuring Postgres role + database exist --"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}'"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"

echo "-- backend: npm install --"
cd ~/ParentGuard/backend
npm install

if [ ! -f .env ]; then
  echo "-- generating backend/.env (fresh secrets — first deploy) --"
  {
    echo "NODE_ENV=development"
    echo "PORT=3000"
    echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
    node ../infrastructure/testing-deploy/gen-secrets.js | grep -v '^DB_PASSWORD='
    echo "APP_URL=http://${TEST_DOMAIN}:3000"
    echo "FRONTEND_URL=http://${TEST_DOMAIN}:3001"
    # Placeholders — fill in manually after deploy, real payments/email
    # won't work until you do:
    echo "RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx"
    echo "RAZORPAY_KEY_SECRET=your_razorpay_key_secret"
    echo "RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret"
    echo "SMTP_HOST=smtp.gmail.com"
    echo "SMTP_PORT=587"
    echo "SMTP_USER=your_gmail@gmail.com"
    echo "SMTP_PASS=xxxx_xxxx_xxxx_xxxx"
    echo "SMTP_FROM=ParentGuard <no-reply@example.com>"
    # Soketi — matches soketi.json, started via pm2 below on this same box.
    echo "SOKETI_HOST=localhost"
    echo "SOKETI_PORT=6001"
    echo "SOKETI_APP_ID=parentguard"
    echo "SOKETI_APP_KEY=parentguard-key"
    echo "SOKETI_APP_SECRET=parentguard-secret"
  } > .env
else
  echo "-- backend/.env already exists — leaving secrets as-is, re-deploy keeps sessions valid --"
fi

echo "-- prisma generate + migrate deploy + seed --"
npx prisma generate
npx prisma migrate deploy
npm run db:seed || echo "(seed script reported an issue — check output above; safe to ignore if data already seeded)"

echo "-- backend: build (tsc) --"
npm run build

echo "-- admin_web: npm install + build --"
cd ~/ParentGuard/admin_web
npm install
echo "NEXT_PUBLIC_API_URL=http://${TEST_DOMAIN}:3000
NEXT_PUBLIC_SOKETI_HOST=${TEST_DOMAIN}
NEXT_PUBLIC_SOKETI_PORT=6001
NEXT_PUBLIC_SOKETI_APP_KEY=parentguard-key" > .env.local
npm run build

echo "-- (re)starting via pm2 --"
APP_ROOT="$HOME/ParentGuard"
pm2 delete parentguard-backend parentguard-admin parentguard-soketi >/dev/null 2>&1 || true
pm2 start "$APP_ROOT/backend/dist/index.js" --name parentguard-backend --cwd "$APP_ROOT/backend"
pm2 start npm --name parentguard-admin --cwd "$APP_ROOT/admin_web" -- start
pm2 start npx --name parentguard-soketi --cwd "$APP_ROOT" -- @soketi/soketi start --config=soketi.json
pm2 save
REMOTE_SCRIPT

echo ""
echo "== Deployed =="
echo "Backend API: http://${TEST_DOMAIN}:3000"
echo "Admin panel: http://${TEST_DOMAIN}:3001"
echo "SSH:         ssh -i ./${KEY_NAME}.pem ubuntu@${PUBLIC_IP}   (pm2 logs / pm2 status once inside)"
echo ""
echo "Remember: RAZORPAY_*, SMTP_* in backend/.env are placeholders — edit them on the"
echo "server (then 'pm2 restart parentguard-backend') before relying on real payments or email."
