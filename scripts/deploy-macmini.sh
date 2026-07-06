#!/usr/bin/env bash
set -euo pipefail

SERVED_REPO="${KINGMAKERBG_DEPLOY_REPO:-/Volumes/SSD/CODEX/Project2/KingmakerBG}"
TARGET_SHA="${GITHUB_SHA:-origin/main}"
PNPM_BIN="${PNPM_BIN:-pnpm}"
USER_ID="$(id -u)"

export PATH="/Users/lby/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

echo "[deploy] repo: ${SERVED_REPO}"
echo "[deploy] target: ${TARGET_SHA}"

cd "${SERVED_REPO}"

git fetch --prune origin
git checkout main
git reset --hard "${TARGET_SHA}"

find . -name '._*' -type f -delete

tmp_env="$(mktemp)"
{
  echo "SERVER_PORT=3211"
  echo "CORS_ORIGIN=https://kluon.app,https://www.kluon.app,http://192.168.0.90:3210"
  echo "VITE_BASE_PATH=/km/"
  echo "VITE_SERVER_URL=https://kluon.app"
  echo "VITE_SOCKET_PATH=/km/socket.io"
} > "${tmp_env}"
mv "${tmp_env}" .env

"${PNPM_BIN}" install --frozen-lockfile

rm -rf packages/engine/dist packages/data/dist apps/server/dist apps/client/dist
"${PNPM_BIN}" build

find . -name '._*' -type f -delete

restart_service() {
  local label="$1"
  echo "[deploy] restart ${label}"
  launchctl kickstart -k "gui/${USER_ID}/${label}"
}

restart_service com.kluon.kingmakerbg.server
restart_service com.kluon.kingmakerbg.client
restart_service com.kluon.kingmakerbg.proxy

echo "[deploy] smoke checks"
sleep 3
curl -fsS http://127.0.0.1:3211/health
curl -fsS http://127.0.0.1:3220/km/ >/dev/null
curl -fsS 'http://127.0.0.1:3220/km/socket.io/?EIO=4&transport=polling' -H 'Origin: https://kluon.app' >/dev/null
curl -fsS https://kluon.app/api/health >/dev/null
curl -fsS https://kluon.app/km/ >/dev/null

echo "[deploy] complete"
