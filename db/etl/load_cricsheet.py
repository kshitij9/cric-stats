#!/usr/bin/env python3
"""
Cricsheet -> Postgres ETL (stdlib only).

Reads Cricsheet ball-by-ball JSON bundles and writes two CSV files that map
1:1 onto the tables in db/init/001-schema.sql:

    <out>/deliveries.csv          -> deliveries
    <out>/player_career_stats.csv -> player_career_stats

era_averages is derived from deliveries in SQL afterwards (see run.sh), so it
is not emitted here.

Sources may be Cricsheet download URLs or local .zip paths. Default is the
three men's international bundles (Tests, ODIs, T20Is). Downloads are cached
under <out>/cache/ and reused on re-runs.

    python3 load_cricsheet.py --out ./_etl
    python3 load_cricsheet.py --out ./_etl https://cricsheet.org/downloads/ipl_json.zip
"""

import argparse
import csv
import io
import json
import os
import sys
import urllib.request
import zipfile
from collections import defaultdict

DEFAULT_SOURCES = [
    "https://cricsheet.org/downloads/tests_json.zip",
    "https://cricsheet.org/downloads/odis_json.zip",
    "https://cricsheet.org/downloads/t20s_json.zip",
]

# Cricsheet match_type -> the format strings the frontend filters on.
FORMAT_MAP = {
    "Test": "Test", "MDM": "Test",
    "ODI": "ODI", "ODM": "ODI",
    "T20": "T20", "IT20": "T20", "T20I": "T20",
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def fetch(source, cache_dir):
    """Return a local path for `source`, downloading + caching if it is a URL."""
    if not source.startswith(("http://", "https://")):
        return source
    os.makedirs(cache_dir, exist_ok=True)
    dest = os.path.join(cache_dir, os.path.basename(source))
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        log(f"  cached  {dest}")
        return dest
    log(f"  GET     {source}")
    req = urllib.request.Request(source, headers={"User-Agent": "cric-stats-etl"})
    with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    log(f"  saved   {dest} ({os.path.getsize(dest) / 1e6:.1f} MB)")
    return dest


def dget(d, *keys):
    """First present key (handles Cricsheet's old batsman/wicket spellings)."""
    for k in keys:
        if k in d:
            return d[k]
    return None


def phase_of(fmt, over_no):
    """Innings phase from the (0-based) over number. Tests have no phases."""
    if fmt == "T20":
        return "powerplay" if over_no < 6 else "middle" if over_no < 15 else "death"
    if fmt == "ODI":
        return "powerplay" if over_no < 10 else "middle" if over_no < 40 else "death"
    return "na"


def result_margin(outcome):
    by = outcome.get("by")
    if by:
        if "innings" in by:
            return f'innings & {by.get("runs", "?")} runs'
        if "runs" in by:
            return f'{by["runs"]} runs'
        if "wickets" in by:
            return f'{by["wickets"]} wickets'
    return outcome.get("result", "")


def iter_matches(zip_path):
    with zipfile.ZipFile(zip_path) as zf:
        for name in zf.namelist():
            if not name.endswith(".json"):
                continue
            match_id = os.path.splitext(os.path.basename(name))[0]
            with zf.open(name) as fh:
                yield match_id, json.load(io.TextIOWrapper(fh, "utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="output directory for the CSVs")
    ap.add_argument("sources", nargs="*", default=DEFAULT_SOURCES,
                    help="Cricsheet URLs or local .zip paths")
    args = ap.parse_args()
    sources = args.sources or DEFAULT_SOURCES

    os.makedirs(args.out, exist_ok=True)
    cache_dir = os.path.join(args.out, "cache")
    deliveries_csv = os.path.join(args.out, "deliveries.csv")
    matches_csv = os.path.join(args.out, "matches.csv")
    career_csv = os.path.join(args.out, "player_career_stats.csv")

    # career[(player, format, season)] -> [innings, runs, outs, balls, 4s, 6s]
    career = defaultdict(lambda: [0, 0, 0, 0, 0, 0])

    n_matches = n_skipped = n_deliveries = 0

    with open(deliveries_csv, "w", newline="") as dfh, \
         open(matches_csv, "w", newline="") as mfh:
        w = csv.writer(dfh)
        w.writerow(["match_id", "date", "format", "innings", "over", "ball",
                    "batter", "non_striker", "bowler", "runs_batter",
                    "extras", "extras_type", "wicket_type", "player_out",
                    "venue", "batting_team", "bowling_team", "phase", "gender"])
        mw = csv.writer(mfh)
        mw.writerow(["match_id", "date", "format", "venue", "city", "event",
                     "season", "team_type", "gender", "team1", "team2",
                     "toss_winner", "toss_decision", "winner", "result_margin",
                     "player_of_match"])

        for source in sources:
            log(f"source: {source}")
            zip_path = fetch(source, cache_dir)
            for match_id, match in iter_matches(zip_path):
                info = match.get("info", {})
                fmt = FORMAT_MAP.get(info.get("match_type", ""))
                dates = info.get("dates") or []
                if not fmt or not dates:
                    n_skipped += 1
                    continue
                date = dates[0]
                season = int(date[:4])
                teams = info.get("teams") or []
                venue = info.get("venue", "") or ""
                gender = info.get("gender", "") or ""
                event = info.get("event")
                mw.writerow([
                    match_id, date, fmt, venue, info.get("city", ""),
                    event.get("name", "") if isinstance(event, dict) else "",
                    info.get("season", ""), info.get("team_type", ""),
                    info.get("gender", ""),
                    teams[0] if len(teams) > 0 else "",
                    teams[1] if len(teams) > 1 else "",
                    (info.get("toss") or {}).get("winner", ""),
                    (info.get("toss") or {}).get("decision", ""),
                    (info.get("outcome") or {}).get("winner", ""),
                    result_margin(info.get("outcome") or {}),
                    (info.get("player_of_match") or [""])[0],
                ])

                for i, inn in enumerate(match.get("innings", []), start=1):
                    if inn.get("super_over"):
                        continue
                    overs = inn.get("overs")
                    if not overs:
                        continue

                    batting_team = inn.get("team", "")
                    bowling_team = (next((t for t in teams if t != batting_team), "")
                                    if len(teams) == 2 else "")
                    batted = set()  # players who came to the crease this innings

                    for ov in overs:
                        over_no = ov.get("over", 0)
                        ph = phase_of(fmt, over_no)
                        for b, dl in enumerate(ov.get("deliveries", []), start=1):
                            batter = dget(dl, "batter", "batsman")
                            non_striker = dl.get("non_striker", "")
                            bowler = dl.get("bowler", "")
                            runs = dl.get("runs", {})
                            runs_batter = int(dget(runs, "batter", "batsman") or 0)
                            extras_total = int(runs.get("extras", 0) or 0)
                            extras = dl.get("extras", {}) or {}
                            extras_type = next(iter(extras), "")

                            wickets = dl.get("wickets")
                            if wickets is None and "wicket" in dl:
                                wickets = [dl["wicket"]]
                            wickets = wickets or []
                            wicket_type = wickets[0].get("kind", "") if wickets else ""
                            player_out = wickets[0].get("player_out", "") if wickets else ""

                            w.writerow([match_id, date, fmt, i, over_no, b,
                                        batter, non_striker, bowler, runs_batter,
                                        extras_total, extras_type, wicket_type,
                                        player_out, venue, batting_team,
                                        bowling_team, ph, gender])
                            n_deliveries += 1

                            if batter:
                                batted.add(batter)
                            if non_striker:
                                batted.add(non_striker)

                            c = career[(batter, fmt, season)]
                            c[1] += runs_batter                 # runs
                            if "wides" not in extras:
                                c[3] += 1                        # balls faced
                            if runs_batter == 4:
                                c[4] += 1
                            elif runs_batter == 6:
                                c[5] += 1

                            for wk in wickets:
                                out = wk.get("player_out")
                                if out:
                                    career[(out, fmt, season)][2] += 1  # outs

                    for p in batted:
                        career[(p, fmt, season)][0] += 1             # innings

                n_matches += 1
                if n_matches % 1000 == 0:
                    log(f"  ...{n_matches} matches, {n_deliveries} deliveries")

    with open(career_csv, "w", newline="") as cfh:
        w = csv.writer(cfh)
        w.writerow(["player_name", "format", "season", "innings_played",
                    "runs_scored", "outs", "balls_faced", "fours", "sixes"])
        for (player, fmt, season), (inns, runs, outs, balls, f4, f6) in sorted(career.items()):
            if not player:
                continue
            w.writerow([player, fmt, season, inns, runs, outs, balls, f4, f6])

    log(f"done: {n_matches} matches loaded, {n_skipped} skipped, "
        f"{n_deliveries} deliveries, {len(career)} career rows")
    log(f"  {deliveries_csv}")
    log(f"  {matches_csv}")
    log(f"  {career_csv}")


if __name__ == "__main__":
    main()
