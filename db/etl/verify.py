#!/usr/bin/env python3
"""
Compare a loaded database with the Cricsheet files it was loaded from.

The figures are counted here directly from the source JSON, deliberately without
using load_cricsheet.py, so a mistake in the loader shows up as a difference.
For every match and innings it compares: deliveries, runs off the bat, total
runs, each kind of extra, boundary fours and sixes, and every wicket (ball, kind
and player out). It also compares the set of matches, each match's competition
and the line-up sizes.

    python3 db/etl/verify.py                       # cricket_next vs the cache
    python3 db/etl/verify.py --db NAME a.zip b.zip

Exit status 0 means no differences. Standard library only; needs the "postgres"
service from docker-compose.yml.
"""

import argparse
import csv
import hashlib
import io
import json
import os
import subprocess
import sys
import zipfile
from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_ZIPS = [os.path.join(REPO, "db/etl/_etl/cache", f"{n}_json.zip")
                for n in ("tests", "odis", "t20s", "ipl")]
FORMATS = {"Test", "MDM", "ODI", "ODM", "T20", "IT20", "T20I"}
FIGURES = ["deliveries", "batter runs", "total runs", "wides", "no-balls",
           "byes", "leg byes", "penalty", "fours", "sixes"]


def competition_of(info):
    """'international', 'ipl', or None for anything the app does not cover."""
    if info.get("team_type") == "international":
        return "international"
    event = info.get("event") or {}
    return "ipl" if event.get("name") == "Indian Premier League" else None


def from_source(paths):
    """(innings figures, wickets, line-up sizes, {match id: competition}) from the zips."""
    innings, wickets, lineups, matches = {}, Counter(), {}, {}
    for path in paths:
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                if not name.endswith(".json"):
                    continue
                match = json.loads(zf.read(name))
                info = match["info"]
                if info.get("match_type") not in FORMATS or not info.get("dates"):
                    continue
                mid = os.path.basename(name)[:-5]
                matches[mid] = competition_of(info)
                for team, squad in info.get("players", {}).items():
                    lineups[(mid, team)] = len(set(squad))
                for number, inn in enumerate(match.get("innings", []), 1):
                    if inn.get("super_over"):
                        continue
                    for over in inn.get("overs", []):
                        for ball, d in enumerate(over["deliveries"], 1):
                            runs, extras = d["runs"], d.get("extras", {})
                            bat = runs.get("batter", runs.get("batsman", 0))
                            hit = 0 if runs.get("non_boundary") else bat
                            row = innings.setdefault((mid, number), [0] * len(FIGURES))
                            for i, value in enumerate((
                                    1, bat, runs["total"],
                                    extras.get("wides", 0), extras.get("noballs", 0),
                                    extras.get("byes", 0), extras.get("legbyes", 0),
                                    extras.get("penalty", 0),
                                    hit == 4, hit == 6)):
                                row[i] += value
                            for w in d.get("wickets", []):
                                wickets[(mid, number, over["over"], ball,
                                         w["kind"], w["player_out"])] += 1
    return innings, wickets, lineups, matches


def query(db, sql):
    command = ["docker", "compose", "exec", "-T", "postgres", "sh", "-c",
               'psql -X -q --csv -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"',
               "psql", db]
    result = subprocess.run(command, input=sql, cwd=REPO, capture_output=True, text=True)
    if result.returncode:
        sys.exit(f"query on {db} failed: {result.stderr.strip()}")
    return list(csv.reader(io.StringIO(result.stdout)))


def from_database(db):
    innings = {(r[0], int(r[1])): [int(v) for v in r[2:]] for r in query(db, """
        SELECT match_id, innings, count(*), sum(runs_batter), sum(runs_batter + extras),
               sum(wides), sum(noballs), sum(byes), sum(legbyes), sum(penalty),
               count(*) FILTER (WHERE boundary AND runs_batter = 4),
               count(*) FILTER (WHERE boundary AND runs_batter = 6)
          FROM deliveries GROUP BY 1, 2""")}
    wickets = Counter(
        (r[0], int(r[1]), int(r[2]), int(r[3]), r[4], r[5]) for r in query(db, """
        SELECT d.match_id, d.innings, d.over, d.ball, w.kind, w.player_out
          FROM wickets w JOIN deliveries d ON d.id = w.delivery_id"""))
    lineups = {(r[0], r[1]): int(r[2]) for r in query(db, """
        SELECT match_id, team, count(*) FROM match_players GROUP BY 1, 2""")}
    # data loaded before matches had a competition held internationals only
    matches = dict(query(db, """
        SELECT match_id, coalesce(to_jsonb(m)->>'competition', 'international')
          FROM matches m"""))
    return innings, wickets, lineups, matches


def report(title, differences, show=5):
    print(f"{'ok  ' if not differences else 'DIFF'}  {title}"
          + (f": {len(differences)} differences" if differences else ""))
    for line in differences[:show]:
        print("        " + line)
    return len(differences)


def main():
    ap = argparse.ArgumentParser(description="compare a database with its source files")
    ap.add_argument("--db", default="cricket_next")
    ap.add_argument("zips", nargs="*", default=DEFAULT_ZIPS)
    args = ap.parse_args()
    zips = args.zips or DEFAULT_ZIPS

    # make sure these are the files the database was loaded from
    loaded = query(args.db, """
        SELECT s->>'sha256' FROM (SELECT sources FROM data_loads
          ORDER BY load_id DESC LIMIT 1) l, jsonb_array_elements(l.sources) s
         WHERE s->>'file' LIKE '%.zip'""")
    ours = []
    for path in zips:
        with open(path, "rb") as f:
            ours.append(hashlib.file_digest(f, "sha256").hexdigest())
    if sorted(r[0] for r in loaded) != sorted(ours):
        sys.exit(f"these are not the files {args.db} was last loaded from")

    src_innings, src_wickets, src_lineups, src_matches = from_source(zips)
    db_innings, db_wickets, db_lineups, db_matches = from_database(args.db)

    total = report(f"{len(src_matches)} matches present", [
        f"match {m} only in {'source' if m in src_matches else 'database'}"
        for m in sorted(src_matches.keys() ^ db_matches.keys())])
    split = Counter(src_matches.values())
    total += report(
        "competition of each match (" +
        ", ".join(f"{n:,} {c}" for c, n in sorted(split.items(), key=str)) + ")",
        [f"match {m}: source {src_matches[m]}, database {db_matches[m]}"
         for m in sorted(src_matches.keys() & db_matches.keys())
         if src_matches[m] != db_matches[m]])

    zero = [0] * len(FIGURES)
    for i, figure in enumerate(FIGURES):
        differences = []
        for key in sorted(src_innings.keys() | db_innings.keys()):
            a, b = src_innings.get(key, zero)[i], db_innings.get(key, zero)[i]
            if a != b:
                differences.append(f"match {key[0]} innings {key[1]}: source {a}, database {b}")
        overall = sum(v[i] for v in src_innings.values())
        total += report(f"{figure} per innings ({overall:,} in all)", differences)

    total += report(f"wickets: ball, kind and player out ({sum(src_wickets.values()):,})", [
        f"{'missing from database' if k in src_wickets - db_wickets else 'only in database'}: {k}"
        for k in sorted((src_wickets - db_wickets) + (db_wickets - src_wickets))])

    total += report(f"line-up sizes ({sum(src_lineups.values()):,} places)", [
        f"match {k[0]} {k[1]}: source {src_lineups.get(k, 0)}, database {db_lineups.get(k, 0)}"
        for k in sorted(src_lineups.keys() | db_lineups.keys())
        if src_lineups.get(k, 0) != db_lineups.get(k, 0)])

    print(f"{len(src_innings):,} innings compared; {total} differences")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
