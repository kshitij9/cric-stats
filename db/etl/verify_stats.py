#!/usr/bin/env python3
"""
Check the app's statistics against figures counted from the Cricsheet files.

The rules are written out again here, from the source JSON, deliberately without
using the loader, the SQL or lib/stats.ts:

  database  every player's career row set, and every era baseline
  stats API for a sample of players: career figures, era index by year and over
            the career, and the top bowler matchups
  recommender  for the same players: batting and bowling baselines, that the
            batting baseline equals the career figures, and the sample counts
            behind each context factor

Needs a candidate app serving the database being checked:

    python3 db/etl/verify_stats.py --app http://127.0.0.1:3002
    python3 db/etl/verify_stats.py --app URL --db NAME a.zip b.zip

Exit status 0 means no differences. Standard library only.
"""

import argparse
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
from verify import DEFAULT_ZIPS, FORMATS, query  # noqa: E402  (shared, loader-free)

FORMAT = {"Test": "Test", "MDM": "Test", "ODI": "ODI", "ODM": "ODI",
          "T20": "T20", "IT20": "T20", "T20I": "T20"}
NOT_DISMISSALS = {"retired hurt", "retired not out"}
BOWLERS = {"bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket"}


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

        self.innings = defaultdict(set)                  # (player, fmt) -> {(match, innings)}
        self.bat = defaultdict(Counter)                  # (player, fmt)
        self.season = defaultdict(Counter)               # (player, fmt, year)
        self.bowl = defaultdict(Counter)                 # (player, fmt)
        self.era = defaultdict(Counter)                  # (year, fmt, gender)
        self.pairs = defaultdict(lambda: defaultdict(Counter))  # (batter, fmt)[bowler]
        # (role, player, fmt)[(phase, innings, team faced, opponent)] -> counts
        self.slices = defaultdict(lambda: defaultdict(lambda: [0, 0, 0]))
        self.gender = {}
        for mid, m in read_matches(paths):
            self._read(mid, m, alias)

    def count(self, role, pid, fmt, where, team, opponent, balls=0, dismissal=0, credit=0):
        row = self.slices[(role, pid, fmt)][(*where, team, sys.intern(opponent))]
        row[0] += balls
        row[1] += dismissal
        row[2] += credit

    def _read(self, mid, m, alias):
        info = m["info"]
        fmt, gender = FORMAT[info["match_type"]], info["gender"]
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
                        self.innings[(p, fmt)].add((mid, number))
                    c = self.bat[(striker, fmt)]
                    c.update(runs=runs, balls=faced, fours=hit == 4, sixes=hit == 6)
                    self.season[(striker, fmt, year)].update(runs=runs, balls=faced)
                    self.era[(year, fmt, gender)].update(runs=runs, balls=faced)
                    self.bowl[(bowler, fmt)].update(runs=conceded, balls=legal)
                    pair = self.pairs[(striker, fmt)][bowler]
                    pair.update(runs=runs, balls=faced)

                    where = (phase(fmt, o["over"]), number)
                    self.count("batter", striker, fmt, where, bowling, bowler, balls=faced)
                    self.count("bowler", bowler, fmt, where, batting, striker, balls=legal)

                    for w in d.get("wickets", []):
                        out = who(w["player_out"])
                        self.innings[(out, fmt)].add((mid, number))
                        dismissal = w["kind"] not in NOT_DISMISSALS
                        credit = w["kind"] in BOWLERS
                        if dismissal:
                            self.bat[(out, fmt)]["outs"] += 1
                            self.count("batter", out, fmt, where, bowling, bowler,
                                       dismissal=1, credit=int(credit))
                        if credit:
                            self.bowl[(bowler, fmt)]["wickets"] += 1
                            self.pairs[(out, fmt)][bowler]["dismissals"] += 1
                            self.count("bowler", bowler, fmt, where, batting, out,
                                       dismissal=1, credit=1)

    def career(self, key):
        c = self.bat.get(key, {})
        return {"innings": len(self.innings[key]), **{
            f: int(c.get(f, 0)) for f in ("runs", "balls", "outs", "fours", "sixes")}}

    def era_years(self, pid, fmt):
        """[(year, runs, expected runs)] for the years the player faced a ball."""
        rows = []
        for (p, f, year), c in self.season.items():
            if p == pid and f == fmt and c["balls"]:
                base = self.era[(year, fmt, self.gender[pid])]
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
    stored = {(r[0], r[1]): [int(v) for v in r[2:]] for r in query(args.db, """
        SELECT player_id, format, sum(innings_played), sum(runs_scored), sum(balls_faced),
               sum(outs), sum(fours), sum(sixes) FROM player_career_stats GROUP BY 1, 2""")}
    keys = {k for k, v in src.innings.items() if v}
    for k in sorted(keys | set(stored)):
        want = list(src.career(k).values()) if k in keys else None
        report.same("careers in the database (all players)", k, str(want), str(stored.get(k)))
    eras = {(int(r[0]), r[1], r[2]): (int(r[3]), int(r[4]), float(r[5])) for r in query(
        args.db, "SELECT year, format, gender, runs, balls, avg_strike_rate FROM era_averages")}
    for k in sorted(set(src.era) | set(eras)):
        c, e = src.era.get(k), eras.get(k, (None, None, None))
        report.same("era baselines", (*k, "runs"), c and c["runs"], e[0])
        report.same("era baselines", (*k, "balls"), c and c["balls"], e[1])
        report.same("era baselines", (*k, "rate"), c and ratio(c["runs"], c["balls"], 100), e[2], 0.0051)

    # ---- sample -------------------------------------------------------------
    sample = set()
    for fmt in ("Test", "ODI", "T20"):
        for gender in ("male", "female"):
            group = [k for k in keys if k[1] == fmt and src.gender[k[0]] == gender]
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
    for pid, fmt in sample:
        want = src.career((pid, fmt))
        rows = get("/api/stats/career", id=pid, format=fmt)
        got = rows[0] if len(rows) == 1 else {}
        careers[(pid, fmt)] = got
        for f, v in want.items():
            report.same("career counts (API)", (pid, fmt, f), v, got.get(f))
        for f, v, tol in (
                ("average", ratio(want["runs"], want["outs"]), 0.0051),
                ("strike_rate", ratio(want["runs"], want["balls"], 100), 0.0051),
                ("balls_per_dismissal", ratio(want["balls"], want["outs"]), 0.051),
                ("boundary_percent", ratio(4 * want["fours"] + 6 * want["sixes"], want["runs"], 100), 0.051),
                ("not_out_percent", ratio(want["innings"] - want["outs"], want["innings"], 100), 0.051)):
            report.same("career rates (API)", (pid, fmt, f), v, got.get(f), tol)
        report.same("profile equals career (API)", (pid, fmt),
                    json.dumps(rows, sort_keys=True),
                    json.dumps(get("/api/stats/player_full_profile", id=pid, format=fmt), sort_keys=True))

        years = src.era_years(pid, fmt)
        api_years = {r["year"]: r["era_index"] for r in get("/api/stats/era", id=pid, format=fmt)}
        report.same("era index years (API)", (pid, fmt),
                    str([y for y, _, _ in years]), str(sorted(api_years)))
        for year, runs, expected in years:
            report.same("era index by year (API)", (pid, fmt, year),
                        ratio(runs, expected), api_years.get(year), 0.0051)
        report.same("career era index (API)", (pid, fmt),
                    ratio(sum(r for _, r, _ in years), sum(e for _, _, e in years)),
                    got.get("era_index"), 0.0051)

        pairs = [(b, c) for b, c in src.pairs.get((pid, fmt), {}).items() if c["balls"] > 15]
        pairs.sort(key=lambda p: (-p[1]["dismissals"], p[1]["runs"] / p[1]["balls"], p[0]))
        want_top = [(b, c["balls"], c["runs"], c["dismissals"]) for b, c in pairs[:5]]
        got_top = [(r["bowler_id"], r["balls"], r["runs"], r["dismissals"])
                   for r in get("/api/stats/matchup", id=pid, format=fmt)]
        report.same("top matchups (API)", (pid, fmt), str(want_top), str(got_top))

    # ---- recommender --------------------------------------------------------
    for fmt in ("Test", "ODI", "T20"):
        ids = [p for p, f in sample if f == fmt]
        for role in ("batter", "bowler"):
            for i in range(0, len(ids), 20):
                answer = get("/api/recommend", role=role, format=fmt, players=",".join(ids[i:i + 20]))
                for p in answer["players"]:
                    pid = p["player_id"]
                    table = src.bat if role == "batter" else src.bowl
                    c = table.get((pid, fmt), Counter())
                    report.same("recommender: who has data", (role, pid, fmt),
                                str(c["balls"] > 0), str(p["data_available"]))
                    if not p["data_available"]:
                        continue
                    base = p["baseline"]
                    if role == "batter":
                        for f in ("runs", "balls", "outs"):
                            report.same("recommender batting baselines", (pid, fmt, f), c[f], base[f])
                        for f in ("runs", "balls", "outs", "average", "strike_rate", "balls_per_dismissal"):
                            report.same("recommender equals career", (pid, fmt, f),
                                        careers[(pid, fmt)].get(f), base[f])
                    else:
                        for f, g in (("runs", "runs_conceded"), ("balls", "balls"), ("wickets", "wickets")):
                            report.same("recommender bowling baselines", (pid, fmt, f), c[f], base[g])

    # context factors: each player against their most-faced opponent and in a slice
    cases = []
    for role, table in (("batter", src.bat), ("bowler", src.bowl)):
        cases += [(role, k) for k in sample if table.get(k, {}).get("balls", 0) > 200][:60]
    for role, (pid, fmt) in cases:
        records = src.slices.get((role, pid, fmt))
        if not records:
            continue
        faced, teams = Counter(), Counter()
        for (_, _, team, opp), (balls, _, _) in records.items():
            faced[opp] += balls
            teams[team] += balls
        opponent = max(faced, key=lambda k: (faced[k], k))
        team = max(teams, key=lambda k: (teams[k], k))
        which_phase = "death" if fmt != "Test" else ""
        answer = get("/api/recommend", role=role, format=fmt, players=pid, opponent=opponent,
                     opposition=team, phase=which_phase, innings=2)
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
            report.same("context factor balls", (role, pid, fmt, key), balls or None, got.get("sample_balls"))
            report.same("context factor events", (role, pid, fmt, key),
                        events if balls else None, got.get("sample_events"))

    sys.exit(1 if report.finish() else 0)


if __name__ == "__main__":
    main()
