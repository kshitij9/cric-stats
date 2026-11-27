#!/usr/bin/env bash
# Create the database for saved teams, or bring its tables up to date. Safe to
# run again: it never drops or empties anything.
#
#   ./db/app/setup.sh --db cricintell_app         # the live app
#   ./db/app/setup.sh --db cricintell_app_dev     # the preview
#
# Requires the "postgres" service from docker-compose.yml to be up.
set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }

[ $# -eq 2 ] && [ "$1" = --db ] || die "usage: $0 --db NAME"
TARGET="$2"

cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
PGUSER="${POSTGRES_USER:-cricket}"

[[ "$TARGET" =~ ^cricintell_app[a-z0-9_]*$ ]] || die "the name must start with cricintell_app"

pg() { docker compose exec -T -e PGOPTIONS='-c client_min_messages=warning' postgres "$@"; }

exists="$(pg psql -X -At -U "$PGUSER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$TARGET'" </dev/null)"
if [ -z "$exists" ]; then
  pg createdb -U "$PGUSER" "$TARGET" </dev/null
  echo "created database $TARGET"
fi
pg psql -X -q -v ON_ERROR_STOP=1 -1 -U "$PGUSER" -d "$TARGET" < db/app/001-teams.sql
echo "tables in $TARGET are up to date"
