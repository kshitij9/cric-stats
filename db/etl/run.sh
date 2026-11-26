#!/usr/bin/env bash
# Load Cricsheet data into the Postgres container.
#
#   ./db/etl/run.sh [options] [source ...]
#
#   source          Cricsheet download URL or local .zip. Default: Tests, ODIs and
#                   T20Is. The sources given replace the whole data set.
#   --db NAME       target database, created if missing (default: cricket_next)
#   --live          required when the target is the database the app reads
#   --offline       use cached downloads; do not contact cricsheet.org
#   --force         load even if the sources and loader have not changed
#   --allow-shrink  accept fewer matches, or an older latest match, than now held
#   --work DIR      where downloads and CSVs are kept (default: db/etl/_etl)
#   --register DIR  use people.csv and names.csv from DIR instead of downloading
#
# Venue spellings are merged only where db/venues/venue_merges.csv approves it.
#
# New data is built in a staging schema, checked, and then published in a single
# statement. A run that fails or is stopped leaves the existing data as it was.
#
# Requires the "postgres" service from docker-compose.yml to be up.
set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }
usage() { sed -n '2,/^set -euo/{/^#/s/^# \{0,1\}//p}' "$0"; }

TARGET=cricket_next
LIVE=0 FORCE=0 ALLOW_SHRINK=0
WORK=""
FETCH_FLAGS=()
LOADER_FLAGS=()
SOURCES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --db)           [ $# -ge 2 ] || die "--db needs a name"; TARGET="$2"; shift ;;
    --work)         [ $# -ge 2 ] || die "--work needs a directory"; WORK="$(realpath -m -- "$2")"; shift ;;
    --register)     [ $# -ge 2 ] || die "--register needs a directory"
                    LOADER_FLAGS+=(--register "$(realpath -m -- "$2")"); shift ;;
    --live)         LIVE=1 ;;
    --offline)      FETCH_FLAGS+=(--offline) ;;
    --force)        FORCE=1 ;;
    --allow-shrink) ALLOW_SHRINK=1 ;;
    -h|--help)      usage; exit 0 ;;
    -*)             die "unknown option: $1" ;;
    http://*|https://*) SOURCES+=("$1") ;;
    *)              SOURCES+=("$(realpath -m -- "$1")") ;;  # before we cd
  esac
  shift
done

cd "$(dirname "$0")/../.."
OUT="${WORK:-db/etl/_etl}"
set -a; . ./.env; set +a
PGUSER="${POSTGRES_USER:-cricket}"
APP_DB="${POSTGRES_DB:-cricket}"

[[ "$TARGET" =~ ^[a-z_][a-z0-9_]*$ ]] || die "invalid database name: $TARGET"
case "$TARGET" in postgres|template0|template1) die "refusing to load into $TARGET" ;; esac
if [ "$TARGET" = "$APP_DB" ] && [ "$LIVE" -ne 1 ]; then
  die "$TARGET is the database the app reads; add --live to load into it"
fi

pg()   { docker compose exec -T -e PGOPTIONS='-c client_min_messages=warning' postgres "$@"; }
psql() { pg psql -X -q -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$TARGET" "$@"; }
# a query whose result we capture: bare values, no headers
ask()  { psql -At "$@"; }

# one load at a time
mkdir -p db/etl/_etl
exec 9> db/etl/_etl/.lock
flock -n 9 || die "another load is already running"

STAGING=0 PUBLISHING=0 PUBLISHED=0
finish() {
  status=$?
  [ "$status" -eq 0 ] && return
  if [ "$PUBLISHED" -eq 1 ]; then
    echo "load published to $TARGET, but a later step failed" >&2
    return
  fi
  if [ "$PUBLISHING" -eq 1 ]; then
    # the publish statement is all-or-nothing, but may still finish in the container
    echo "load stopped while publishing: $TARGET holds either the old data or the" >&2
    echo "complete new data; the latest row of data_loads shows which" >&2
    return
  fi
  if [ "$STAGING" -eq 1 ]; then
    psql -c "SET lock_timeout = '10s'" -c 'DROP SCHEMA IF EXISTS etl_staging CASCADE' \
      </dev/null >/dev/null 2>&1 || true
  fi
  echo "load FAILED; data in $TARGET is unchanged" >&2
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "==> checking sources"
python3 -I db/etl/load_cricsheet.py --out "$OUT" --fetch-only "${FETCH_FLAGS[@]}" "${LOADER_FLAGS[@]}" "${SOURCES[@]}"

echo "==> preparing database $TARGET"
exists="$(pg psql -X -At -U "$PGUSER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$TARGET'" </dev/null)"
if [ -z "$exists" ]; then
  pg createdb -U "$PGUSER" "$TARGET" </dev/null
  echo "    created"
fi
psql < db/init/002-data-loads.sql

# everything besides the source files that decides what gets loaded
CODE_FILES=(db/etl/run.sh db/etl/load_cricsheet.py db/etl/derive.sql db/etl/checks.sql
  db/etl/checks-against-current.sql db/etl/publish.sql
  db/init/001-schema.sql db/init/003-indexes.sql)
[ ! -f db/venues/venue_merges.csv ] || CODE_FILES+=(db/venues/venue_merges.csv)
CODE_VERSION="$(cat "${CODE_FILES[@]}" | sha256sum | cut -d' ' -f1)"

if [ "$FORCE" -ne 1 ]; then
  unchanged="$(ask -v sources="$(cat "$OUT/sources.json")" -v code="$CODE_VERSION" <<'SQL'
SELECT 'load ' || load_id || ' of ' || to_char(loaded_at, 'YYYY-MM-DD HH24:MI TZ')
FROM (SELECT * FROM public.data_loads ORDER BY load_id DESC LIMIT 1) last
WHERE code_version = :'code'
  AND (SELECT jsonb_agg(s->>'sha256' ORDER BY s->>'sha256') FROM jsonb_array_elements(sources) s)
    = (SELECT jsonb_agg(s->>'sha256' ORDER BY s->>'sha256') FROM jsonb_array_elements(:'sources'::jsonb) s);
SQL
)"
  if [ -n "$unchanged" ]; then
    echo "nothing to do: sources and loader are unchanged since $unchanged (--force to reload)"
    exit 0
  fi
fi

echo "==> extracting Cricsheet data"
# --offline: use exactly the files checked above
python3 -I db/etl/load_cricsheet.py --out "$OUT" --offline "${LOADER_FLAGS[@]}" "${SOURCES[@]}"

echo "==> building staging tables"
STAGING=1
psql -c 'DROP SCHEMA IF EXISTS etl_staging CASCADE' -c 'CREATE SCHEMA etl_staging' </dev/null
{ echo 'SET search_path = etl_staging;'
  cat db/init/001-schema.sql; } | psql

echo "==> loading tables"
psql -c 'CREATE TABLE etl_staging._player_splits (player_id text, gender text, new_player_id text)' </dev/null
# table -> text columns where an empty CSV field means '' rather than NULL
declare -A KEEP_EMPTY=(
  [matches]=''
  [deliveries]='extras_type, wicket_type, player_out, venue, batting_team, bowling_team, phase, powerplay, gender, team_type'
  [wickets]='player_out, kind'
  [match_players]='team'
  [players]='gender'
  [player_aliases]=''
  [venues]='city'
  [venue_aliases]='city'
  [_player_splits]=''
)
for table in matches deliveries wickets match_players players player_aliases \
             venues venue_aliases _player_splits; do
  columns="$(head -n 1 "$OUT/$table.csv" | tr -d '\r')"
  options="FORMAT csv, HEADER match"
  [ -z "${KEEP_EMPTY[$table]}" ] || options+=", FORCE_NOT_NULL (${KEEP_EMPTY[$table]})"
  psql -c "\copy etl_staging.$table($columns) FROM STDIN WITH ($options)" < "$OUT/$table.csv"
done

echo "==> indexing"
{ echo 'SET search_path = etl_staging;'
  cat db/init/003-indexes.sql; } | psql

echo "==> building player identities and summary tables"
psql < db/etl/derive.sql

echo "==> checking the new data"
psql -v manifest="$(cat "$OUT/manifest.json")" -v code="$CODE_VERSION" <<'SQL'
CREATE TABLE etl_staging._load_manifest AS
SELECT :'manifest'::jsonb AS manifest, :'code'::text AS code_version;
SQL
failures="$(ask < db/etl/checks.sql)"
has_data="$(ask -c "SELECT 1 WHERE to_regclass('public.matches') IS NOT NULL" </dev/null)"
if [ -n "$has_data" ] && [ "$ALLOW_SHRINK" -ne 1 ]; then
  shrunk="$(ask < db/etl/checks-against-current.sql)"
  if [ -n "$shrunk" ]; then
    failures+="${failures:+$'\n'}$shrunk"$'\n'"(if this is intended, rerun with --allow-shrink)"
  fi
fi
if [ -n "$failures" ]; then
  printf 'check failed:\n%s\n' "$failures" >&2
  exit 1
fi
echo "    passed"

echo "==> publishing"
PUBLISH_SQL="$(cat db/etl/publish.sql)"
for attempt in 1 2 3; do
  PUBLISHING=1
  if psql -c "$PUBLISH_SQL" </dev/null; then PUBLISHED=1; break; fi
  PUBLISHING=0    # the server rejected it, so nothing changed
  [ "$attempt" -lt 3 ] || die "could not publish after $attempt attempts"
  echo "    retrying in 10s"; sleep 10
done

echo "==> load record"
psql -P pager=off -c "SELECT load_id, loaded_at, latest_match_date, row_counts
         FROM public.data_loads ORDER BY load_id DESC LIMIT 1" </dev/null
echo "done."
