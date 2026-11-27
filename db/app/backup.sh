#!/usr/bin/env bash
# Save a copy of the saved teams. Keeps 30 days of copies.
#
#   ./db/app/backup.sh DIRECTORY [--db NAME]     # default: cricintell_app
#
# Restore into an empty database:
#   docker compose exec -T postgres pg_restore -U cricket -d NAME < FILE
set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }

DIR="" TARGET=cricintell_app
while [ $# -gt 0 ]; do
  case "$1" in
    --db) [ $# -ge 2 ] || die "--db needs a name"; TARGET="$2"; shift ;;
    -*)   die "unknown option: $1" ;;
    *)    [ -z "$DIR" ] || die "one directory only"; DIR="$(realpath -m -- "$1")" ;;
  esac
  shift
done
[ -n "$DIR" ] || die "usage: $0 DIRECTORY [--db NAME]"

cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
PGUSER="${POSTGRES_USER:-cricket}"
[[ "$TARGET" =~ ^cricintell_app[a-z0-9_]*$ ]] || die "the name must start with cricintell_app"

mkdir -p "$DIR"
file="$DIR/$TARGET-$(date -u +%Y%m%d-%H%M%S).dump"
# written under another name first, so a failed run leaves nothing that looks complete
trap 'rm -f -- "$file.partial"' EXIT
docker compose exec -T postgres pg_dump -U "$PGUSER" -Fc "$TARGET" </dev/null > "$file.partial"
mv "$file.partial" "$file"
find "$DIR" -maxdepth 1 -name "$TARGET-*.dump" -mtime +30 -delete
echo "saved $file"
