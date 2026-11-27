#!/usr/bin/env python3
"""
Cricsheet -> Postgres ETL (stdlib only).

Reads Cricsheet ball-by-ball JSON bundles and the Cricsheet people register, and
writes one CSV per table that run.sh loads (see TABLES below), each matching
db/init/001-schema.sql, plus <out>/manifest.json recording the source files used
and the number of rows written to each CSV. run.sh checks the database against it.

player_career_stats and era_averages are not written here: db/etl/derive.sql
builds them from the loaded tables, so each counting rule exists only once.

Sources may be Cricsheet download URLs or local .zip paths. Default is the
three international bundles (Tests, ODIs, T20Is; men's and women's) and the
IPL. A club match from any other competition stops the load, so leagues are
never mixed by accident (see CLUB_COMPETITIONS). Downloads are cached under <out>/cache/. A cached file is replaced only when the server
has a newer one and the new download is complete and readable.

    python3 load_cricsheet.py --out ./_etl
    python3 load_cricsheet.py --out ./_etl https://cricsheet.org/downloads/ipl_json.zip  # IPL only
    python3 load_cricsheet.py --out ./_etl --offline      # cached files only
    python3 load_cricsheet.py --out ./_etl --fetch-only   # refresh the cache
    python3 load_cricsheet.py --out ./_etl --register DIR # people.csv, names.csv from DIR
"""

import argparse
import csv
import hashlib
import http.client
import io
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
import zipfile
import zlib
from collections import defaultdict

DEFAULT_SOURCES = [
    "https://cricsheet.org/downloads/tests_json.zip",
    "https://cricsheet.org/downloads/odis_json.zip",
    "https://cricsheet.org/downloads/t20s_json.zip",
    "https://cricsheet.org/downloads/ipl_json.zip",
]

REGISTER_URL = "https://cricsheet.org/register/"
# file name -> the columns it must start with
REGISTER_FILES = {
    "people.csv": ["identifier", "name", "unique_name"],
    "names.csv": ["identifier", "name"],
}

DEFAULT_VENUE_MERGES = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)),
                 "..", "venues", "venue_merges.csv"))
DEFAULT_FRANCHISES = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)),
                 "..", "teams", "franchises.csv"))

# event name of a club match -> competition. Internationals need no entry.
CLUB_COMPETITIONS = {"Indian Premier League": "ipl"}

# Cricsheet match_type -> the format strings the frontend filters on.
FORMAT_MAP = {
    "Test": "Test", "MDM": "Test",
    "ODI": "ODI", "ODM": "ODI",
    "T20": "T20", "IT20": "T20", "T20I": "T20",
}

# table -> CSV header. run.sh loads <out>/<table>.csv into the table of the same
# name, matching columns by these headers.
TABLES = {
    "matches": [
        "match_id", "date", "format", "competition", "venue", "city", "venue_id", "event",
        "season", "team_type", "gender", "team1", "team2", "toss_winner",
        "toss_decision", "winner", "result_margin", "result_method",
        "eliminator", "bowl_out", "player_of_match"],
    "deliveries": [
        "id", "match_id", "date", "format", "competition", "innings", "over", "ball",
        "batter", "batter_id", "non_striker", "non_striker_id", "bowler",
        "bowler_id", "runs_batter", "boundary", "extras", "wides", "noballs",
        "byes", "legbyes", "penalty", "venue", "venue_id", "batting_team",
        "bowling_team",
        "phase", "powerplay", "gender", "team_type"],
    "wickets": ["delivery_id", "wicket_no", "player_out_id", "player_out", "kind"],
    "match_players": ["match_id", "team", "player_id", "player_name"],
    "players": ["player_id", "name", "unique_name", "gender"],
    "player_aliases": ["player_id", "alias"],
    "venues": ["venue_id", "name", "city"],
    "venue_aliases": ["venue_name", "city", "venue_id"],
    "team_aliases": ["competition", "team_name", "franchise"],
    # the loader's own: IDs that derive.sql must split by gender
    "_player_splits": ["player_id", "gender", "new_player_id"],
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# fetching
# ---------------------------------------------------------------------------

def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def read_meta(path):
    """Download metadata for a cached file, or {} if it does not describe it."""
    try:
        with open(path + ".meta.json") as f:
            meta = json.load(f)
        return meta if meta.get("sha256") == sha256_of(path) else {}
    except (OSError, ValueError):
        return {}


def write_json(path, data):
    tmp = path + ".part"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def check_zip(path):
    """Raise ValueError unless `path` is an intact zip holding match files."""
    try:
        with zipfile.ZipFile(path) as zf:
            if not any(n.endswith(".json") for n in zf.namelist()):
                raise ValueError("zip holds no match files")
            bad = zf.testzip()
            if bad:
                raise ValueError(f"corrupt entry in zip: {bad}")
    except (zipfile.BadZipFile, zlib.error, EOFError) as e:
        raise ValueError(f"not a readable zip ({e})") from e


def check_register(columns):
    """A validator for a register CSV that must start with `columns`."""
    def check(path):
        try:
            with open(path, newline="", encoding="utf-8") as f:
                rows = csv.reader(f, strict=True)
                header = next(rows, [])
                if header[:len(columns)] != columns:
                    raise ValueError(f"unexpected columns: {header[:5]}")
                n = 0
                for n, row in enumerate(rows, 1):
                    if len(row) != len(header):
                        raise ValueError(f"row {n} has {len(row)} fields, not {len(header)}")
                if n == 0:
                    raise ValueError("no rows")
        except (csv.Error, UnicodeDecodeError) as e:
            raise ValueError(f"not a readable CSV ({e})") from e
    return check


def download(url, dest, check=check_zip):
    """Bring the cached copy of `url` at `dest` up to date."""
    have = os.path.isfile(dest) and os.path.getsize(dest) > 0
    headers = {"User-Agent": "cric-stats-etl"}
    # Ask for "newer than this" only when we know which version we hold.
    last_modified = read_meta(dest).get("last_modified") if have else None
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    part = dest + ".part"
    log(f"  GET     {url}")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as r, open(part, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
            expected = r.headers.get("Content-Length")
            served = r.headers.get("Last-Modified")
        size = os.path.getsize(part)
        if expected is not None and size != int(expected):
            raise ValueError(f"incomplete download: {size} of {expected} bytes")
        check(part)
        meta = {"url": url, "last_modified": served, "sha256": sha256_of(part)}
        os.replace(part, dest)
        write_json(dest + ".meta.json", meta)
        log(f"  saved   {dest} ({size / 1e6:.1f} MB, dated {served})")
    except urllib.error.HTTPError as e:
        if e.code == 304 and last_modified:
            log(f"  current {dest} (unchanged since {last_modified})")
            return
        sys.exit(f"download failed for {url}: HTTP {e.code}; cache left as it was")
    except (OSError, ValueError, http.client.HTTPException) as e:
        sys.exit(f"download failed for {url}: {e}; cache left as it was")
    finally:
        if os.path.exists(part):
            os.remove(part)


def fetch(source, cache_dir, offline=False, check=check_zip):
    """Return a local path for `source`, refreshing the cache if it is a URL."""
    if not source.startswith(("http://", "https://")):
        if not os.path.isfile(source):
            sys.exit(f"no such source file: {source}")
        return source
    os.makedirs(cache_dir, exist_ok=True)
    dest = os.path.join(cache_dir, os.path.basename(source))
    if not offline:
        download(source, dest, check)
    elif os.path.isfile(dest) and os.path.getsize(dest) > 0:
        log(f"  cached  {dest}")
    else:
        sys.exit(f"--offline: no cached copy of {source} at {dest}")
    return dest


def describe(source, path):
    """What the load record keeps about one source file."""
    return {
        "source": source,
        "file": os.path.basename(path),
        "bytes": os.path.getsize(path),
        "sha256": sha256_of(path),
        "last_modified": read_meta(path).get("last_modified"),
    }


# ---------------------------------------------------------------------------
# reading matches
# ---------------------------------------------------------------------------

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


def powerplay_spans(innings):
    """[(first, last, type)] with positions as (0-based over, 1-based delivery).

    The source writes a position as over.delivery, counting wides and no-balls,
    so 5.10 is the tenth delivery of the sixth over and differs from 5.1. The
    match must be parsed with parse_float=str to keep that distinction. An end
    of .6 is cricket notation for "end of the over", even if the over ran long.
    """
    def position(value):
        over, _, ball = str(value).partition(".")
        return int(over), int(ball or 0)

    spans = []
    for pp in innings.get("powerplays", []):
        first, (over, ball) = position(pp["from"]), position(pp["to"])
        spans.append((first, (over, 10_000 if ball == 6 else ball), pp["type"]))
    return spans


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
                yield match_id, json.load(io.TextIOWrapper(fh, "utf-8"), parse_float=str)


# ---------------------------------------------------------------------------
# venues
# ---------------------------------------------------------------------------

def venue_id(name, city):
    """A readable ID that stays the same from load to load."""
    plain = unicodedata.normalize("NFKD", f"{name} {city}").encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")[:60].rstrip("-")
    digest = hashlib.sha1(f"{name}\0{city}".encode()).hexdigest()[:6]
    return f"{slug}-{digest}"


def read_venue_merges(path):
    """{(venue, city): (canonical_venue, canonical_city)} for approved rows only."""
    merges = {}
    if not os.path.exists(path):
        return merges
    with open(path, newline="", encoding="utf-8-sig") as f:
        for line, row in enumerate(csv.DictReader(f), start=2):
            approve = (row.get("approve") or "").strip().lower()
            if approve in ("", "n", "no"):
                continue
            if approve not in ("y", "yes"):
                sys.exit(f"{path} line {line}: approve must be y, n or blank, not {approve!r}")
            try:
                alias = (row["venue"], row["city"])
                target = (row["canonical_venue"], row["canonical_city"])
            except KeyError as e:
                sys.exit(f"{path}: missing column {e}")
            if not target[0]:
                sys.exit(f"{path} line {line}: no canonical venue")
            if merges.get(alias, target) != target:
                sys.exit(f"{path} line {line}: {alias} is approved into two different venues")
            merges[alias] = target
    return merges


# ---------------------------------------------------------------------------
# competitions and teams
# ---------------------------------------------------------------------------

def competition_of(match_id, team_type, event_name):
    if team_type == "international":
        return "international"
    if team_type == "club" and event_name in CLUB_COMPETITIONS:
        return CLUB_COMPETITIONS[event_name]
    sys.exit(f"match {match_id}: no competition for {team_type!r} event {event_name!r}; "
             "add it to CLUB_COMPETITIONS")


def read_franchises(path):
    """{(competition, team name): franchise} for the renamed teams listed."""
    franchises = {}
    if not os.path.exists(path):
        return franchises
    with open(path, newline="", encoding="utf-8-sig") as f:
        for line, row in enumerate(csv.DictReader(f), start=2):
            try:
                key = (row["competition"], row["team"])
                franchise = row["franchise"]
            except KeyError as e:
                sys.exit(f"{path}: missing column {e}")
            if not all(key) or not franchise:
                sys.exit(f"{path} line {line}: every column is needed")
            if franchises.setdefault(key, franchise) != franchise:
                sys.exit(f"{path} line {line}: {key} is listed under two franchises")
    return franchises


# ---------------------------------------------------------------------------
# players
# ---------------------------------------------------------------------------

class Players:
    """Everyone seen in the matches, and what each was called."""

    def __init__(self):
        self.genders = defaultdict(dict)   # id -> {gender: first match date}
        self.names = defaultdict(dict)     # (id, gender) -> {scorecard name: latest date}

    def see(self, pid, name, gender, date):
        first = self.genders[pid].get(gender)
        if first is None or date < first:
            self.genders[pid][gender] = date
        used = self.names[(pid, gender)]
        if date > used.get(name, ""):
            used[name] = date

    def tables(self, people, aliases):
        """Rows for players, player_aliases and _player_splits."""
        players, alias_rows, splits = [], [], []
        for pid in sorted(self.genders):
            # The ID stays with the gender that used it first (stable as data
            # grows); any other gender is a different person.
            order = sorted(self.genders[pid], key=lambda g: (self.genders[pid][g], g))
            for gender in order:
                primary = gender == order[0]
                new_id = pid if primary else f"{pid}-{gender[:1]}"
                used = self.names[(pid, gender)]
                latest = max(used, key=lambda n: (used[n], n))
                registered = people.get(pid)
                if primary and registered:
                    name, unique = registered
                else:
                    name = latest
                    label = ("women" if gender == "female" else "men") if not primary else pid
                    unique = f"{latest} ({label})"
                players.append([new_id, name, unique, gender])
                others = set(used) | (aliases.get(pid, set()) if primary else set())
                alias_rows += [[new_id, a] for a in sorted(others - {name, ""})]
                if not primary:
                    splits.append([pid, gender, new_id])
        return players, alias_rows, splits


def read_register(people_csv, names_csv):
    with open(people_csv, newline="", encoding="utf-8") as f:
        people = {r["identifier"]: (r["name"], r["unique_name"] or r["name"])
                  for r in csv.DictReader(f)}
    aliases = defaultdict(set)
    with open(names_csv, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            aliases[r["identifier"]].add(r["name"])
    return people, aliases


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="output directory for the CSVs")
    ap.add_argument("sources", nargs="*", default=DEFAULT_SOURCES,
                    help="Cricsheet URLs or local .zip paths")
    ap.add_argument("--offline", action="store_true",
                    help="use cached downloads; do not contact the server")
    ap.add_argument("--fetch-only", action="store_true",
                    help="refresh the cache, write sources.json and stop")
    ap.add_argument("--register",
                    help="folder holding people.csv and names.csv (default: download)")
    ap.add_argument("--venue-merges", default=DEFAULT_VENUE_MERGES,
                    help="CSV of venue spellings; only rows marked approved are merged")
    ap.add_argument("--franchises", default=DEFAULT_FRANCHISES,
                    help="CSV of renamed teams and the franchise each now plays as")
    args = ap.parse_args()
    sources = args.sources or DEFAULT_SOURCES

    os.makedirs(args.out, exist_ok=True)
    cache_dir = os.path.join(args.out, "cache")
    manifest_json = os.path.join(args.out, "manifest.json")

    # Fetch everything before writing anything, so a failed download stops early.
    paths = []
    for source in sources:
        log(f"source: {source}")
        paths.append(fetch(source, cache_dir, args.offline))
    register, register_sources = {}, []
    for fname, columns in REGISTER_FILES.items():
        source = (os.path.join(args.register, fname) if args.register
                  else REGISTER_URL + fname)
        log(f"source: {source}")
        check = check_register(columns)
        register[fname] = fetch(source, cache_dir, args.offline, check)
        try:
            check(register[fname])
        except ValueError as e:
            sys.exit(f"{register[fname]}: {e}")
        register_sources.append((source, register[fname]))
    described = [describe(s, p) for s, p in [*zip(sources, paths), *register_sources]]

    if args.fetch_only:
        write_json(os.path.join(args.out, "sources.json"), described)
        return

    # a manifest exists only for a complete set of CSVs
    if os.path.exists(manifest_json):
        os.remove(manifest_json)

    people, aliases = read_register(register["people.csv"], register["names.csv"])
    merges = read_venue_merges(args.venue_merges)
    franchises = read_franchises(args.franchises)
    seen_teams = set()   # (competition, team name)
    players = Players()
    venues = {}          # venue_id -> (name, city)
    venue_aliases = {}   # (venue, city) -> venue_id

    counts = dict.fromkeys(TABLES, 0)
    handles = {t: open(os.path.join(args.out, f"{t}.csv"), "w", newline="", encoding="utf-8")
               for t in TABLES}
    writers = {t: csv.writer(h) for t, h in handles.items()}
    for table, header in TABLES.items():
        writers[table].writerow(header)

    def write(table, row):
        assert len(row) == len(TABLES[table]), table
        writers[table].writerow(row)
        counts[table] += 1

    n_skipped = 0

    for source, zip_path in zip(sources, paths):
        log(f"reading: {zip_path}")
        matches_before = counts["matches"]
        for match_id, match in iter_matches(zip_path):
            info = match.get("info", {})
            fmt = FORMAT_MAP.get(info.get("match_type", ""))
            dates = info.get("dates") or []
            if not fmt or not dates:
                n_skipped += 1
                continue
            date = dates[0]
            teams = info.get("teams") or []
            venue = info.get("venue", "") or ""
            city = info.get("city", "") or ""
            gender = info.get("gender", "") or ""
            team_type = info.get("team_type", "") or ""
            event = info.get("event")
            event_name = event.get("name", "") if isinstance(event, dict) else ""
            competition = competition_of(match_id, team_type, event_name)
            seen_teams.update((competition, t) for t in teams)
            outcome = info.get("outcome") or {}
            registry = (info.get("registry") or {}).get("people") or {}

            def person(name):
                """The ID of a player named in this match."""
                pid = registry.get(name)
                if not pid:
                    sys.exit(f"match {match_id}: no register ID for player {name!r}")
                players.see(pid, name, gender, date)
                return pid

            vid = ""
            if venue:
                vid = venue_aliases.get((venue, city))
                if vid is None:
                    canonical = merges.get((venue, city), (venue, city))
                    vid = venue_id(*canonical)
                    if venues.setdefault(vid, canonical) != canonical:
                        sys.exit(f"two venues share the ID {vid}")
                    venue_aliases[(venue, city)] = vid

            write("matches", [
                match_id, date, fmt, competition, venue, city, vid, event_name,
                info.get("season", ""), team_type, gender,
                teams[0] if len(teams) > 0 else "",
                teams[1] if len(teams) > 1 else "",
                (info.get("toss") or {}).get("winner", ""),
                (info.get("toss") or {}).get("decision", ""),
                outcome.get("winner", ""), result_margin(outcome),
                outcome.get("method", ""), outcome.get("eliminator", ""),
                outcome.get("bowl_out", ""),
                (info.get("player_of_match") or [""])[0],
            ])

            for team, squad in (info.get("players") or {}).items():
                for name in squad:
                    write("match_players", [match_id, team, person(name), name])

            for i, inn in enumerate(match.get("innings", []), start=1):
                if inn.get("super_over"):
                    continue
                overs = inn.get("overs")
                if not overs:
                    continue

                batting_team = inn.get("team", "")
                bowling_team = (next((t for t in teams if t != batting_team), "")
                                if len(teams) == 2 else "")
                spans = powerplay_spans(inn)

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

                        wickets = dl.get("wickets")
                        if wickets is None and "wicket" in dl:
                            wickets = [dl["wicket"]]
                        wickets = wickets or []

                        delivery_id = counts["deliveries"] + 1
                        boundary = runs_batter in (4, 6) and not runs.get("non_boundary")
                        powerplay = next((kind for lo, hi, kind in spans
                                          if lo <= (over_no, b) <= hi), "")
                        write("deliveries", [
                            delivery_id, match_id, date, fmt, competition, i, over_no, b,
                            batter, person(batter),
                            non_striker, person(non_striker),
                            bowler, person(bowler),
                            runs_batter, "t" if boundary else "f", extras_total,
                            *(extras.get(k, 0) for k in
                              ("wides", "noballs", "byes", "legbyes", "penalty")),
                            venue, vid,
                            batting_team, bowling_team, ph, powerplay, gender,
                            team_type,
                        ])
                        for n, wk in enumerate(wickets, start=1):
                            out = wk.get("player_out", "")
                            write("wickets", [delivery_id, n, person(out), out,
                                              wk.get("kind", "")])

            if counts["matches"] % 1000 == 0:
                log(f"  ...{counts['matches']} matches, {counts['deliveries']} deliveries")

        if counts["matches"] == matches_before:
            sys.exit(f"no usable matches in {source}")

    player_rows, alias_rows, split_rows = players.tables(people, aliases)
    for row in player_rows:
        write("players", row)
    for row in alias_rows:
        write("player_aliases", row)
    for row in split_rows:
        write("_player_splits", row)
    for vid, (name, city) in sorted(venues.items()):
        write("venues", [vid, name, city])
    for (name, city), vid in sorted(venue_aliases.items()):
        write("venue_aliases", [name, city, vid])
    for competition, team in sorted(seen_teams):
        write("team_aliases",
              [competition, team, franchises.get((competition, team), team)])
    for h in handles.values():
        h.close()

    unused = sorted(set(merges) - set(venue_aliases))
    if unused:
        log(f"note: {len(unused)} approved venue merges match nothing in these sources, "
            f"e.g. {unused[0]}")
    for pid, gender, new_id in split_rows:
        log(f"note: player ID {pid} appears in men's and women's matches; "
            f"{gender} matches recorded as {new_id}")

    write_json(manifest_json, {"sources": described, "row_counts": counts})
    log(f"done: {counts['matches']} matches loaded, {n_skipped} skipped, "
        f"{counts['deliveries']} deliveries, {counts['players']} players, "
        f"{counts['venues']} venues ({len(venue_aliases)} spellings)")


if __name__ == "__main__":
    main()
