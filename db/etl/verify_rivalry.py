#!/usr/bin/env python3
"""
Check the Rivalry screen's figures against the Cricsheet IPL file.

The rules are written out again here, from the source JSON, deliberately without
using the loader, the SQL or the app's code. Every pair of franchises, over all
seasons and the last four, at every ground and at each one where they have met:
the record, each meeting's result and scores, the grounds, and the leading run
scorers and wicket takers of each side.

It only reads, so any app serving this data will do:

    python3 -B db/etl/verify_rivalry.py --app http://127.0.0.1:3002

Exit status 0 means no differences. Standard library only.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from itertools import combinations

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from verify import REPO, competition_of  # noqa: E402  (shared, loader-free)
from verify_matchup import RECENT_SEASONS, merged_grounds  # noqa: E402
from verify_stats import BOWLERS, NOT_DISMISSALS, Report, franchises, ratio  # noqa: E402

SHOWN = 3


class Source:
    def __init__(self, path):
        merges, renamed = merged_grounds(), franchises()
        self.matches = []
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                if name.endswith(".json"):
                    m = json.loads(zf.read(name))
                    if competition_of(m["info"]) == "ipl":
                        self.matches.append(self._read(os.path.basename(name)[:-5], m,
                                                       merges, renamed))
        # latest first
        self.matches.sort(key=lambda m: (m["date"], m["id"]), reverse=True)

    def _read(self, mid, m, merges, renamed):
        info = m["info"]
        reg = info["registry"]["people"]

        def side(team):
            return renamed.get(("ipl", team), team)

        spelled = (info.get("venue", ""), info.get("city", ""))
        o = info.get("outcome", {})
        by = o.get("by", {})
        if "winner" in o:
            how = "wickets" if "wickets" in by else "runs"
            winner, margin = o["winner"], by.get("wickets", by.get("runs"))
        else:
            margin = None
            winner = o.get("eliminator") or o.get("bowl_out")
            how = ("super over" if "eliminator" in o else "bowl-out" if "bowl_out" in o
                   else "tie" if o.get("result") == "tie" else "no result")
        match = {
            "id": mid, "date": info["dates"][0], "season": int(info["dates"][0][:4]),
            "ground": merges.get(spelled, spelled),
            "teams": [side(t) for t in info["teams"]],
            "winner": winner and side(winner), "how": how, "by": margin,
            "method": o.get("method"), "scores": [],
            # (player, side) -> counts, one entry for this match's innings
            "bat": defaultdict(Counter), "bowl": defaultdict(Counter),
        }
        innings = [i for i in m.get("innings", []) if not i.get("super_over")]
        for number, inn in enumerate(innings, 1):
            batting = side(inn["team"])
            bowling = next(t for t in match["teams"] if t != batting)
            total = Counter()
            for over in inn.get("overs", []):
                for d in over["deliveries"]:
                    striker, other, bowler = (reg[d[k]] for k in ("batter", "non_striker", "bowler"))
                    extras = d.get("extras", {})
                    runs = d["runs"]["batter"]
                    faced = "wides" not in extras
                    legal = faced and "noballs" not in extras
                    total.update(runs=d["runs"]["total"], balls=int(legal), seen=1)
                    for p in (striker, other):
                        match["bat"][(p, batting, number)]["there"] = 1
                    match["bat"][(striker, batting, number)].update(runs=runs, balls=int(faced))
                    spell = match["bowl"][(bowler, bowling, number)]
                    spell.update(runs=runs + extras.get("wides", 0) + extras.get("noballs", 0),
                                 balls=int(legal), there=1)
                    for w in d.get("wickets", []):
                        out = reg[w["player_out"]]
                        match["bat"][(out, batting, number)]["there"] = 1
                        if w["kind"] not in NOT_DISMISSALS:
                            total["wickets"] += 1
                            match["bat"][(out, batting, number)]["outs"] += 1
                        if w["kind"] in BOWLERS:
                            spell["wickets"] += 1
            if total["seen"]:
                match["scores"].append((batting, total["runs"], total["wickets"], total["balls"]))
        return match


def tally(meetings, teams):
    wins = [sum(m["winner"] == t for m in meetings) for t in teams]
    return {"played": len(meetings), "wins": wins, "other": len(meetings) - sum(wins)}


def gathered(meetings, kind, team):
    """player -> their innings for this side."""
    players = defaultdict(list)
    for m in meetings:
        for (player, side, _), counts in m[kind].items():
            if side == team:
                players[player].append(counts)
    return players


def run_scorers(meetings, team):
    rows = []
    for player, innings in gathered(meetings, "bat", team).items():
        runs, balls = (sum(i[k] for i in innings) for k in ("runs", "balls"))
        if runs:
            best = min(innings, key=lambda c: (-c["runs"], c["outs"], c["balls"]))
            rows.append({
                "player": player, "innings": len(innings), "runs": runs, "balls": balls,
                "strike_rate": ratio(runs, balls, 100), "best_runs": best["runs"],
                "best_balls": best["balls"], "best_not_out": not best["outs"]})
    rows.sort(key=lambda r: (-r["runs"], r["balls"], r["player"]))
    return rows[:SHOWN]


def wicket_takers(meetings, team):
    rows = []
    for player, innings in gathered(meetings, "bowl", team).items():
        runs, balls, wickets = (sum(i[k] for i in innings) for k in ("runs", "balls", "wickets"))
        if wickets:
            best = min(innings, key=lambda c: (-c["wickets"], c["runs"]))
            rows.append({
                "player": player, "innings": len(innings), "balls": balls,
                "runs_conceded": runs, "wickets": wickets, "economy": ratio(runs, balls, 6),
                "best_wickets": best["wickets"], "best_runs": best["runs"]})
    rows.sort(key=lambda r: (-r["wickets"], r["runs_conceded"] / max(r["balls"], 1), r["player"]))
    return rows[:SHOWN]


def main():
    ap = argparse.ArgumentParser(description="check the Rivalry figures against the source file")
    ap.add_argument("--app", required=True, help="base URL of an app serving this data")
    ap.add_argument("--zip", default=os.path.join(REPO, "db/etl/_etl/cache/ipl_json.zip"))
    args = ap.parse_args()
    src = Source(args.zip)
    report = Report()

    def call(path, **params):
        url = args.app + path + (f"?{urllib.parse.urlencode(params)}" if params else "")
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            sys.exit(f"{url} -> HTTP {e.code}: {e.read()[:200]!r}")

    first, latest = (f(m["season"] for m in src.matches) for f in (min, max))
    sides = defaultdict(list)
    for m in src.matches:
        for t in m["teams"]:
            sides[t].append(m["season"])
    listed = call("/api/rivalry/franchises")
    report.same("franchises", "list",
                str(sorted((t, min(s), max(s), len(s), max(s) == latest) for t, s in sides.items())),
                str(sorted((f["team"], f["first_season"], f["last_season"], f["matches"],
                            f["current"]) for f in listed)))
    report.same("franchises: current ones first", "order",
                str([f["current"] for f in listed]),
                str(sorted((f["current"] for f in listed), reverse=True)))

    venue_ids = {}

    def ground_of(entry):
        """The source's ground for one the app names, remembering its ID."""
        key = (entry["name"], entry["city"])
        venue_ids[key] = entry["venue_id"]
        return key

    for pair in combinations(sorted(sides), 2):
        for choice, since in (("all", first), ("recent", latest - RECENT_SEASONS + 1)):
            met = [m for m in src.matches
                   if set(m["teams"]) == set(pair) and m["season"] >= since]
            grounds = [None]  # then each ground, once the app has given its ID
            for ground in grounds:
                if ground is not None and ground not in venue_ids:
                    report.same("grounds known", str(ground), "listed", "missing")
                    continue
                params = {"a": pair[0], "b": pair[1], "seasons": choice,
                          **({"venue": venue_ids[ground]} if ground else {})}
                app = call("/api/rivalry", **params)
                what = f"{pair[0]} v {pair[1]} {choice} {ground and ground[0]}"
                here = [m for m in met if m["ground"] == ground] if ground else met
                report.same("seasons", what, f"{since}-{latest}",
                            f"{app['seasons']['from']}-{app['seasons']['to']}")
                report.same("record: all grounds", what, str(tally(met, pair)), str(app["overall"]))
                report.same("record: chosen ground", what,
                            str(tally(here, pair) if ground else None), str(app["here"]))
                if ground is None:
                    got = {ground_of(g): g["record"] for g in app["grounds"]}
                    want = {g: tally([m for m in met if m["ground"] == g], pair)
                            for g in {m["ground"] for m in met}}
                    report.same("grounds: which", what, str(sorted(want)), str(sorted(got)))
                    report.same("grounds: records", what, str(sorted(want.items())),
                                str(sorted(got.items())))
                    played = [g["record"]["played"] for g in app["grounds"]]
                    report.same("grounds: most often first", what,
                                str(sorted(played, reverse=True)), str(played))
                    grounds.extend(sorted(g for g in want if g in venue_ids))
                report.same("meetings: which, latest first", what,
                            str([m["id"] for m in here]),
                            str([m["match_id"] for m in app["meetings"]]))
                for m, a in zip(here, app["meetings"]):
                    winner = None if a["winner"] is None else pair[a["winner"]]
                    report.same("meetings: result", f"{what} {m['id']}",
                                str((m["date"], m["ground"], m["winner"], m["how"], m["by"],
                                     m["method"])),
                                str((a["date"], (a["venue"]["name"], a["venue"]["city"]), winner,
                                     a["outcome"], a["by"], a["method"])))
                    report.same("meetings: scores", f"{what} {m['id']}", str(m["scores"]),
                                str([(pair[s["side"]], s["runs"], s["wickets"], s["balls"])
                                     for s in a["scores"]]))
                for i, team in enumerate(pair):
                    for field, rows, theirs, tolerance in (
                            ("run scorers", run_scorers(here, team), app["batting"][i],
                             {"strike_rate": 0.0051}),
                            ("wicket takers", wicket_takers(here, team), app["bowling"][i],
                             {"economy": 0.0051})):
                        # a few IDs are split by gender; the source has no suffix
                        report.same(f"{field}: who, in order", f"{what} {team}",
                                    str([r["player"] for r in rows]),
                                    str([p["player_id"].split("-")[0] for p in theirs]))
                        for r, p in zip(rows, theirs):
                            for key, value in r.items():
                                if key != "player":
                                    report.same(field, f"{what} {team} {r['player']} {key}",
                                                value, p[key], tolerance.get(key, 0))

    sys.exit(1 if report.finish() else 0)


if __name__ == "__main__":
    main()
