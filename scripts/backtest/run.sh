#!/usr/bin/env bash
# Compile and run a backtest step in Docker (the host's Node is too old).
#
#   ./scripts/backtest/run.sh STEP [options]      # see scripts/backtest/main.ts
#
# Reads the database named by BACKTEST_DB (default cricket_next) on the Compose
# network; nothing is written to it. Results go to scripts/backtest/out/.
# The first run, and any run after package.json changes, builds an image.
set -euo pipefail

cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
export DATABASE_URL="postgres://${POSTGRES_USER:-cricket}:${POSTGRES_PASSWORD}@postgres:5432/${BACKTEST_DB:-cricket_next}"
IMAGE=cric-stats-backtest

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build -q --target builder -t "$IMAGE" . >/dev/null
fi
mkdir -p scripts/backtest/out
docker run --rm --network "${COMPOSE_PROJECT_NAME:-cric-stats}_default" -e DATABASE_URL \
  -e HOST_USER="$(id -u):$(id -g)" \
  -v "$PWD/lib:/app/lib:ro" -v "$PWD/scripts:/app/scripts:ro" \
  -v "$PWD/scripts/backtest/out:/app/out" \
  "$IMAGE" sh -c 'npx tsc -p scripts/backtest/tsconfig.json &&
    node --max-old-space-size=3000 .simbuild/scripts/backtest/main.js "$@";
    status=$?; chown -R "$HOST_USER" /app/out; exit $status' sh "$@"
