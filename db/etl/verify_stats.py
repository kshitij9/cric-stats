#!/usr/bin/env python3
"""
Check the app's statistics against figures counted from the Cricsheet files.

The rules are written out again here, from the source JSON, deliberately without
using the loader, the SQL or lib/stats.ts:

  database  every player's career row set, and every era baseline
  stats API for a sample of players: batting career figures, era index by year
            and over the career, and the top bowler matchups; bowling career
            figures, figures by year, and the top batter matchups
  recommender  for the same players: batting and bowling baselines, that the
            batting baseline equals the career figures, and the sample counts
            behind each context factor

A "scope" is a (format, competition) pair: the three international formats, and
the IPL. Opposition teams in the IPL are franchises (db/teams/franchises.csv).

Needs a candidate app serving the database being checked:

    python3 db/etl/verify_stats.py --app http://127.0.0.1:3002
    python3 db/etl/verify_stats.py --app URL --db NAME a.zip b.zip

Exit status 0 means no differences. Standard library only.
"""

import argparse
import csv
import json
import os
import random
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from verify import (  # noqa: E402  (shared, loader-free)
    DEFAULT_ZIPS, FORMATS, REPO, competition_of, query)

FORMAT = {"Test": "Test", "MDM": "Test", "ODI": "ODI", "ODM": "ODI",
          "T20": "T20", "IT20": "T20", "T20I": "T20"}
NOT_DISMISSALS = {"retired hurt", "retired not out"}
BOWLERS = {"bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket"}


SCOPES = [("Test", "international"), ("ODI", "international"),
          ("T20", "international"), ("T20", "ipl")]


def franchises():
    """{(competition, team): franchise} for renamed teams."""
    with open(os.path.join(REPO, "db/teams/franchises.csv"), newline="", encoding="utf-8") as f:
        return {(r["competition"], r["team"]): r["franchise"] for r in csv.DictReader(f)}


def phase(fmt, over):
    first, last = {"T20": (6, 15), "ODI": (10, 40)}.get(fmt, (None, None))
    if first is None:
        return "na"
    return "powerplay" if over < first else "middle" if over < last else "death"


def read_matches(paths):
    """(match id, match) for every match the app covers, one at a time."""
    for path in paths:
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                if not name.endswith(".json"):
                    continue
                m = json.loads(zf.read(name))
                if m["info"].get("match_type") in FORMATS and m["info"].get("dates"):
                    yield os.path.basename(name)[:-5], m


class Source:
    def __init__(self, paths):
        genders = defaultdict(dict)  # register id -> {gender: first date}
        for _, m in read_matches(paths):
            info = m["info"]
            reg = info["registry"]["people"]
            named = {p for s in info.get("players", {}).values() for p in s}
            for inn in m.get("innings", []):
                for o in inn.get("overs", []):
                    for d in o["deliveries"]:
                        named |= {d["batter"], d["non_striker"], d["bowler"]}
                        named |= {w["player_out"] for w in d.get("wickets", [])}
            for p in named:
                g, date = info["gender"], info["dates"][0]
                seen = genders[reg[p]]
                seen[g] = min(date, seen.get(g, date))
        # an ID used for two genders: the one that appeared first keeps it
        alias = {}
        for pid, seen in genders.items():
            order = sorted(seen, key=lambda g: (seen[g], g))
            for g in order:
                alias[(pid, g)] = pid if g == order[0] else f"{pid}-{g[0]}"

        self.franchise = franchises()
        self.innings = defaultdict(set)                  # (player, scope) -> {(match, innings)}
        self.bat = defaultdict(Counter)                  # (player, scope)
        self.season = defaultdict(Counter)               # (player, scope, year)
        self.bowl = defaultdict(Counter)                 # (player, scope)
        self.era = defaultdict(Counter)                  # (year, scope, gender)
        self.pairs = defaultdict(lambda: defaultdict(Counter))  # (batter, scope)[bowler]
        # (bowler, scope)[(match, innings, year)] -> figures for that innings
        self.spells = defaultdict(lambda: defaultdict(Counter))
        self.bowled_at = defaultdict(lambda: defaultdict(Counter))  # (bowler, scope)[batter]
        # (role, player, scope)[(phase, innings, team faced, opponent)] -> counts
        self.slices = defaultdict(lambda: defaultdict(lambda: [0, 0, 0]))
        self.gender = {}
        for mid, m in read_matches(paths):
            self._read(mid, m, alias)

    def count(self, role, pid, scope, where, team, opponent, balls=0, dismissal=0, credit=0):
        row = self.slices[(role, pid, scope)][(*where, team, sys.intern(opponent))]
        row[0] += balls
        row[1] += dismissal
        row[2] += credit

    def _read(self, mid, m, alias):
        info = m["info"]
        fmt, gender = FORMAT[info["match_type"]], info["gender"]
        competition = competition_of(info)
        scope = (fmt, competition)
        year = int(info["dates"][0][:4])
        reg = info["registry"]["people"]
        teams = info["teams"]

        def who(name):
            pid = sys.intern(alias[(reg[name], gender)])
            self.gender[pid] = gender
            return pid

        for number, inn in enumerate(m.get("innings", []), 1):
            if inn.get("super_over"):
                continue
            batting = inn.get("team", "")
            bowling = next((t for t in teams if t != batting), "")
            # the app filters opposition by franchise
            batting, bowling = (self.franchise.get((competition, t), t)
                                for t in (batting, bowling))
            for o in inn.get("overs", []):
                for d in o["deliveries"]:
                    striker, other, bowler = who(d["batter"]), who(d["non_striker"]), who(d["bowler"])
                    extras = d.get("extras", {})
                    runs = d["runs"]["batter"]
                    faced = "wides" not in extras
                    legal = faced and "noballs" not in extras
                    conceded = runs + extras.get("wides", 0) + extras.get("noballs", 0)
                    hit = 0 if d["runs"].get("non_boundary") else runs

                    for p in (striker, other):
                        self.innings[(p, scope)].add((mid, number))
                    c = self.bat[(striker, scope)]
                    c.update(runs=runs, balls=faced, fours=hit == 4, sixes=hit == 6)
                    self.season[(striker, scope, year)].update(runs=runs, balls=faced)
                    self.era[(year, scope, gender)].update(runs=runs, balls=faced)
                    self.bowl[(bowler, scope)].update(runs=conceded, balls=legal)
                    pair = self.pairs[(striker, scope)][bowler]
                    pair.update(runs=runs, balls=faced)
                    spell = self.spells[(bowler, scope)][(mid, number, year)]
                    spell.update(runs=conceded, balls=legal, dots=legal and runs == 0,
                                 fours=hit == 4, sixes=hit == 6)
                    self.bowled_at[(bowler, scope)][striker].update(runs=conceded, balls=legal)

                    where = (phase(fmt, o["over"]), number)
                    self.count("batter", striker, scope, where, bowling, bowler, balls=faced)
                    self.count("bowler", bowler, scope, where, batting, striker, balls=legal)

                    for w in d.get("wickets", []):
                        out = who(w["player_out"])
                        self.innings[(out, scope)].add((mid, number))
                        dismissal = w["kind"] not in NOT_DISMISSALS
                        credit = w["kind"] in BOWLERS
                        if dismissal:
                            self.bat[(out, scope)]["outs"] += 1
                            self.count("batter", out, scope, where, bowling, bowler,
                                       dismissal=1, credit=int(credit))
                        if credit:
                            self.bowl[(bowler, scope)]["wickets"] += 1
                            self.pairs[(out, scope)][bowler]["dismissals"] += 1
                            spell["wickets"] += 1
                            self.bowled_at[(bowler, scope)][out]["dismissals"] += 1
                            self.count("bowler", bowler, scope, where, batting, out,
                                       dismissal=1, credit=1)

    def career(self, key):
        c = self.bat.get(key, {})
        return {"innings": len(self.innings[key]), **{
            f: int(c.get(f, 0)) for f in ("runs", "balls", "outs", "fours", "sixes")}}

    def era_years(self, pid, scope):
        """[(year, runs, expected runs)] for the years the player faced a ball."""
        rows = []
        for (p, s, year), c in self.season.items():
            if p == pid and s == scope and c["balls"]:
                base = self.era[(year, scope, self.gender[pid])]
                rows.append((year, c["runs"], c["balls"] * base["runs"] / base["balls"]))
        return sorted(rows)


class Report:
    def __init__(self):
        self.checked, self.wrong = Counter(), defaultdict(list)

    def same(self, group, what, expected, actual, tolerance=0):
        self.checked[group] += 1
        if expected is None or actual is None:
            ok = expected is None and actual is None
        elif isinstance(expected, str):
            ok = expected == actual
        else:
            ok = abs(expected - actual) <= tolerance + 1e-9
        if not ok:
            self.wrong[group].append(f"{what}: source {expected}, app {actual}")

    def finish(self):
        total = 0
        for group, n in self.checked.items():
            bad = self.wrong[group]
            total += len(bad)
            print(f"{'ok  ' if not bad else 'DIFF'}  {group}: {n:,} values"
                  + (f", {len(bad)} differ" if bad else ""))
            for line in bad[:5]:
                print("        " + line)
        print(f"{sum(self.checked.values()):,} values checked; {total} differences")
        return total


def ratio(a, b, scale=1):
    return a * scale / b if b else None


def bowling_figures(spells):
    """[(field, expected, tolerance)] for innings added together."""
    total = Counter()
    for s in spells:
        total.update(s)
    n, balls, runs, wickets = len(spells), total["balls"], total["runs"], total["wickets"]
    best = min(spells, key=lambda s: (-s["wickets"], s["runs"]))
    return [
        ("innings", n, 0), ("balls", balls, 0), ("runs_conceded", runs, 0),
        ("wickets", wickets, 0), ("dots", total["dots"], 0),
        ("fours", total["fours"], 0), ("sixes", total["sixes"], 0),
        ("three_wicket_innings", sum(s["wickets"] >= 3 for s in spells), 0),
        ("five_wicket_innings", sum(s["wickets"] >= 5 for s in spells), 0),
        ("best_wickets", best["wickets"], 0), ("best_runs", best["runs"], 0),
        ("economy", ratio(runs, balls, 6), 0.0051),
        ("average", ratio(runs, wickets), 0.0051),
        ("strike_rate", ratio(balls, wickets), 0.051),
        ("dot_percent", ratio(total["dots"], balls, 100), 0.051),
        ("balls_per_boundary", ratio(balls, total["fours"] + total["sixes"]), 0.051),
        ("wickets_per_innings", ratio(wickets, n), 0.0051),
    ]


def main():
    ap = argparse.ArgumentParser(description="check app statistics against source files")
    ap.add_argument("--app", required=True, help="base URL of a candidate app")
    ap.add_argument("--db", default="cricket_next")
    ap.add_argument("--sample", type=int, default=150, help="random players added to the sample")
    ap.add_argument("zips", nargs="*", default=DEFAULT_ZIPS)
    args = ap.parse_args()
    src = Source(args.zips or DEFAULT_ZIPS)
    report = Report()

    def get(path, **params):
        url = f"{args.app}{path}?{urllib.parse.urlencode(params)}"
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            sys.exit(f"{url} -> HTTP {e.code}: {e.read()[:200]!r}")

    # ---- database: every career and every era baseline ----------------------
    stored = {(r[0], (r[1], r[2])): [int(v) for v in r[3:]] for r in query(args.db, """
        SELECT player_id, format, competition, sum(innings_played), sum(runs_scored),
               sum(balls_faced), sum(outs), sum(fours), sum(sixes)
          FROM player_career_stats GROUP BY 1, 2, 3""")}
    keys = {k for k, v in src.innings.items() if v}
    for k in sorted(keys | set(stored)):
        want = list(src.career(k).values()) if k in keys else None
        report.same("careers in the database (all players)", k, str(want), str(stored.get(k)))
    eras = {(int(r[0]), (r[1], r[2]), r[3]): (int(r[4]), int(r[5]), float(r[6]))
            for r in query(args.db, """
        SELECT year, format, competition, gender, runs, balls, avg_strike_rate
          FROM era_averages""")}
    for k in sorted(set(src.era) | set(eras)):
        c, e = src.era.get(k), eras.get(k, (None, None, None))
        report.same("era baselines", (*k, "runs"), c and c["runs"], e[0])
        report.same("era baselines", (*k, "balls"), c and c["balls"], e[1])
        report.same("era baselines", (*k, "rate"), c and ratio(c["runs"], c["balls"], 100), e[2], 0.0051)

    # ---- sample -------------------------------------------------------------
    sample = set()
    for scope in SCOPES:
        for gender in ("male", "female"):
            group = [k for k in keys if k[1] == scope and src.gender[k[0]] == gender]
            sample.update(sorted(group, key=lambda k: -src.bat[k]["runs"])[:12])
            sample.update(sorted(group, key=lambda k: -src.bowl[k]["wickets"])[:8])
    names = query(args.db, """
        SELECT player_id FROM players WHERE name IN
          (SELECT name FROM players GROUP BY name HAVING count(*) > 1)
           OR player_id LIKE '%-_' OR name IN ('V Kohli', 'JR Hazlewood', 'SR Tendulkar')""")
    special = {r[0] for r in names}
    namesakes = sorted(k for k in keys if k[0] in special)
    rng = random.Random(1)
    sample.update(rng.sample(namesakes, min(60, len(namesakes))))
    sample.update(k for k in namesakes if k[0] in ("ba607b88", "03806cf8"))
    sample.update(rng.sample(sorted(keys), min(args.sample, len(keys))))
    sample = sorted(sample)
    print(f"checking the APIs for {len(sample)} player-and-format pairs", file=sys.stderr)

    # ---- stats API ----------------------------------------------------------
    careers = {}
    for pid, scope in sample:
        fmt, competition = scope
        which = {"id": pid, "format": fmt, "competition": competition}
        want = src.career((pid, scope))
        rows = get("/api/stats/career", **which)
        got = rows[0] if len(rows) == 1 else {}
        careers[(pid, scope)] = got
        for f, v in want.items():
            report.same("career counts (API)", (pid, scope, f), v, got.get(f))
        for f, v, tol in (
                ("average", ratio(want["runs"], want["outs"]), 0.0051),
                ("strike_rate", ratio(want["runs"], want["balls"], 100), 0.0051),
                ("balls_per_dismissal", ratio(want["balls"], want["outs"]), 0.051),
                ("boundary_percent", ratio(4 * want["fours"] + 6 * want["sixes"], want["runs"], 100), 0.051),
                ("not_out_percent", ratio(want["innings"] - want["outs"], want["innings"], 100), 0.051)):
            report.same("career rates (API)", (pid, scope, f), v, got.get(f), tol)
        report.same("profile equals career (API)", (pid, scope),
                    json.dumps(rows, sort_keys=True),
                    json.dumps(get("/api/stats/player_full_profile", **which), sort_keys=True))

        years = src.era_years(pid, scope)
        api_years = {r["year"]: r["era_index"] for r in get("/api/stats/era", **which)}
        report.same("era index years (API)", (pid, scope),
                    str([y for y, _, _ in years]), str(sorted(api_years)))
        for year, runs, expected in years:
            report.same("era index by year (API)", (pid, scope, year),
                        ratio(runs, expected), api_years.get(year), 0.0051)
        report.same("career era index (API)", (pid, scope),
                    ratio(sum(r for _, r, _ in years), sum(e for _, _, e in years)),
                    got.get("era_index"), 0.0051)

        pairs = [(b, c) for b, c in src.pairs.get((pid, scope), {}).items() if c["balls"] > 15]
        pairs.sort(key=lambda p: (-p[1]["dismissals"], p[1]["runs"] / p[1]["balls"], p[0]))
        want_top = [(b, c["balls"], c["runs"], c["dismissals"]) for b, c in pairs[:5]]
        got_top = [(r["bowler_id"], r["balls"], r["runs"], r["dismissals"])
                   for r in get("/api/stats/matchup", **which)]
        report.same("top matchups (API)", (pid, scope), str(want_top), str(got_top))

    # ---- bowling API --------------------------------------------------------
    for pid, scope in sample:
        fmt, competition = scope
        which = {"id": pid, "format": fmt, "competition": competition}
        spells = src.spells.get((pid, scope), {})
        rows = get("/api/stats/bowling", **which)
        years = get("/api/stats/bowling_seasons", **which)
        report.same("bowling: who has bowled (API)", (pid, scope),
                    str((int(bool(spells)), sorted({k[2] for k in spells}))),
                    str((len(rows), [r["year"] for r in years])))
        if spells and rows:
            for f, v, tol in bowling_figures(list(spells.values())):
                report.same("bowling career (API)", (pid, scope, f), v, rows[0].get(f), tol)
        for row in years:
            chosen = [s for k, s in spells.items() if k[2] == row["year"]]
            if chosen:
                for f, v, tol in bowling_figures(chosen):
                    report.same("bowling by year (API)", (pid, scope, row["year"], f),
                                v, row.get(f), tol)

        pairs = [(b, c) for b, c in src.bowled_at.get((pid, scope), {}).items()
                 if c["balls"] > 15]
        pairs.sort(key=lambda p: (-p[1]["dismissals"], p[1]["runs"] / p[1]["balls"], p[0]))
        want_top = [(b, c["balls"], c["runs"], c["dismissals"]) for b, c in pairs[:5]]
        got = get("/api/stats/bowling_matchup", **which)
        report.same("top batter matchups (API)", (pid, scope), str(want_top),
                    str([(r["batter_id"], r["balls"], r["runs"], r["dismissals"]) for r in got]))
        for r in got:
            report.same("batter matchup economy (API)", (pid, scope, r["batter_id"]),
                        ratio(r["runs"], r["balls"], 6), r["economy"], 0.0051)

    # ---- recommender --------------------------------------------------------
    for scope in SCOPES:
        fmt, competition = scope
        ids = [p for p, s in sample if s == scope]
        for role in ("batter", "bowler"):
            for i in range(0, len(ids), 20):
                answer = get("/api/recommend", role=role, format=fmt, competition=competition,
                             players=",".join(ids[i:i + 20]))
                for p in answer["players"]:
                    pid = p["player_id"]
                    table = src.bat if role == "batter" else src.bowl
                    c = table.get((pid, scope), Counter())
                    report.same("recommender: who has data", (role, pid, scope),
                                str(c["balls"] > 0), str(p["data_available"]))
                    if not p["data_available"]:
                        continue
                    base = p["baseline"]
                    if role == "batter":
                        for f in ("runs", "balls", "outs"):
                            report.same("recommender batting baselines", (pid, scope, f), c[f], base[f])
                        for f in ("runs", "balls", "outs", "average", "strike_rate", "balls_per_dismissal"):
                            report.same("recommender equals career", (pid, scope, f),
                                        careers[(pid, scope)].get(f), base[f])
                    else:
                        for f, g in (("runs", "runs_conceded"), ("balls", "balls"), ("wickets", "wickets")):
                            report.same("recommender bowling baselines", (pid, scope, f), c[f], base[g])

    # context factors: each player against their most-faced opponent and in a slice
    cases = []
    for role, table in (("batter", src.bat), ("bowler", src.bowl)):
        busy = [k for k in sample if table.get(k, {}).get("balls", 0) > 200]
        for scope in SCOPES:
            cases += [(role, k) for k in busy if k[1] == scope][:20]
    for role, (pid, scope) in cases:
        fmt, competition = scope
        records = src.slices.get((role, pid, scope))
        if not records:
            continue
        faced, teams = Counter(), Counter()
        for (_, _, team, opp), (balls, _, _) in records.items():
            faced[opp] += balls
            teams[team] += balls
        opponent = max(faced, key=lambda k: (faced[k], k))
        team = max(teams, key=lambda k: (teams[k], k))
        which_phase = "death" if fmt != "Test" else ""
        answer = get("/api/recommend", role=role, format=fmt, competition=competition,
                     players=pid, opponent=opponent, opposition=team, phase=which_phase, innings=2)
        factors = answer["players"][0].get("factors", {})
        tests = {"matchup": lambda k: k[3] == opponent, "opposition": lambda k: k[2] == team,
                 "innings": lambda k: k[1] == 2}
        if which_phase:
            tests["phase"] = lambda k: k[0] == which_phase
        for key, test in tests.items():
            chosen = [v for k, v in records.items() if test(k)]
            balls = sum(v[0] for v in chosen)
            # against one opponent a batter's events are the bowler's own wickets
            events = sum(v[2 if key == "matchup" else 1] for v in chosen)
            got = factors.get(key, {})
            report.same("context factor balls", (role, pid, scope, key), balls or None, got.get("sample_balls"))
            report.same("context factor events", (role, pid, scope, key),
                        events if balls else None, got.get("sample_events"))

    sys.exit(1 if report.finish() else 0)


if __name__ == "__main__":
    main()
