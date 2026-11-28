#!/usr/bin/env python3
"""
Check the Matchup screen's figures against the Cricsheet IPL file.

The rules are written out again here, from the source JSON, deliberately without
using the loader, the SQL or the app's code:

  grounds   every IPL ground, over the last four seasons and over all of them:
            first-innings scores, runs and wickets by phase, matches won
            batting first, and the same for the other grounds in those seasons
  records   every IPL player's batting and bowling at every ground
  meetings  batter against bowler, between the sides matched up, at every
            ground and at the chosen one
  team v team  each side's batting and bowling by phase, at every ground and
            at the chosen one, over both choices of seasons

A "complete" first innings is one of 120 legal balls, or ten wickets.

It saves temporary teams (named "zz verify ...") to ask about, and removes them
again, so give it an app whose team database is a scratch one:

    python3 -B db/etl/verify_matchup.py --app http://127.0.0.1:3003

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
from verify import REPO, competition_of  # noqa: E402  (shared, loader-free)
from verify_stats import BOWLERS, NOT_DISMISSALS, Report, ratio  # noqa: E402

PHASES = ("powerplay", "middle", "death")
RECENT_SEASONS = 4
TEAM = 11


def merged_grounds():
    """{(venue, city): the (venue, city) it is approved to be the same as}."""
    with open(os.path.join(REPO, "db/venues/venue_merges.csv"), newline="",
              encoding="utf-8-sig") as f:
        return {(r["venue"], r["city"]): (r["canonical_venue"], r["canonical_city"])
                for r in csv.DictReader(f) if r["approve"].strip().lower() in ("y", "yes")}


class Source:
    def __init__(self, path):
        merges = merged_grounds()
        self.matches = []                    # one dict per match
        self.bat = defaultdict(Counter)      # (player, ground or None)
        self.bowl = defaultdict(Counter)     # (player, ground or None)
        self.batted = defaultdict(set)       # (player, ground) -> {(match, innings)}
        self.bowled = defaultdict(set)
        self.pairs = defaultdict(Counter)    # (batter, bowler)
        self.pairs_at = defaultdict(Counter)  # (batter, bowler, ground)
        # player -> {(season, ground, phase): counts}, for the team figures
        self.part = defaultdict(lambda: defaultdict(Counter))
        with zipfile.ZipFile(path) as zf:
            for name in sorted(zf.namelist()):
                if not name.endswith(".json"):
                    continue
                m = json.loads(zf.read(name))
                if competition_of(m["info"]) == "ipl":
                    self._read(name, m, merges)

    def _read(self, mid, m, merges):
        info = m["info"]
        reg = info["registry"]["people"]
        spelled = (info.get("venue", ""), info.get("city", ""))
        ground = merges.get(spelled, spelled)
        outcome = info.get("outcome", {})
        match = {
            "ground": ground, "season": int(info["dates"][0][:4]),
            "date": info["dates"][0], "first": None, "batted_first": None,
            "winner": outcome.get("winner") or outcome.get("eliminator") or outcome.get("bowl_out"),
        }
        self.matches.append(match)
        innings = [i for i in m.get("innings", []) if not i.get("super_over")]
        for number, inn in enumerate(innings, 1):
            phases = {p: Counter() for p in PHASES}
            for o in inn.get("overs", []):
                phase = "powerplay" if o["over"] < 6 else "middle" if o["over"] < 15 else "death"
                for d in o["deliveries"]:
                    striker, other, bowler = (reg[d[k]] for k in ("batter", "non_striker", "bowler"))
                    extras = d.get("extras", {})
                    runs = d["runs"]["batter"]
                    faced = "wides" not in extras
                    legal = faced and "noballs" not in extras
                    conceded = runs + extras.get("wides", 0) + extras.get("noballs", 0)
                    if number == 1:
                        match["batted_first"] = inn["team"]
                        phases[phase].update(runs=d["runs"]["total"], legal=int(legal))
                    when = (match["season"], ground, phase)
                    boundary = runs in (4, 6) and not d["runs"].get("non_boundary")
                    self.part[striker][when].update(
                        faced=int(faced), scored=runs, boundaries=int(boundary))
                    self.part[bowler][when].update(bowled=int(legal), conceded=conceded)
                    for p in (striker, other):
                        self.batted[(p, ground)].add((mid, number))
                    self.bowled[(bowler, ground)].add((mid, number))
                    for key in (ground, None):
                        self.bat[(striker, key)].update(runs=runs, balls=int(faced))
                        self.bowl[(bowler, key)].update(runs=conceded, balls=int(legal))
                    self.pairs[(striker, bowler)].update(runs=runs, balls=int(faced))
                    self.pairs_at[(striker, bowler, ground)].update(
                        runs=runs, balls=int(faced), seen=1)
                    for w in d.get("wickets", []):
                        out = reg[w["player_out"]]
                        self.batted[(out, ground)].add((mid, number))
                        if w["kind"] not in NOT_DISMISSALS:
                            if number == 1:
                                phases[phase]["wickets"] += 1
                            for key in (ground, None):
                                self.bat[(out, key)]["outs"] += 1
                            self.part[out][when]["outs"] += 1
                        if w["kind"] in BOWLERS:
                            for key in (ground, None):
                                self.bowl[(bowler, key)]["wickets"] += 1
                            self.part[bowler][when]["wickets"] += 1
                            self.pairs[(out, bowler)]["dismissals"] += 1
                            self.pairs_at[(out, bowler, ground)]["dismissals"] += 1
            if number == 1 and match["batted_first"]:
                total = sum(c["runs"] for c in phases.values())
                complete = (sum(c["legal"] for c in phases.values()) >= 120
                            or sum(c["wickets"] for c in phases.values()) >= 10)
                if complete:
                    match["first"] = {"total": total, "phases": phases}

    def team(self, players, since, ground, phase):
        """The counts of these players added up; ground or phase None: all of them."""
        total = Counter()
        for p in players:
            for (season, where, when), counts in self.part.get(p, {}).items():
                if season >= since and ground in (None, where) and phase in (None, when):
                    total.update(counts)
        return total

    def seasons(self):
        years = [m["season"] for m in self.matches]
        return min(years), max(years)

    def ground(self, ground, since):
        """What the profile of a ground should say, from the season `since` on."""
        window = [m for m in self.matches if m["season"] >= since]
        here = [m for m in window if m["ground"] == ground]
        rest = [m for m in window if m["ground"] != ground]
        complete = [m for m in here if m["first"]]
        decided = [m for m in here if m["winner"] and m["batted_first"]]

        def by_season(ours, theirs):
            """[(weight, the same season's matches elsewhere)]"""
            groups = []
            for season, weight in Counter(m["season"] for m in ours).items():
                same = [m for m in theirs if m["season"] == season]
                if same:
                    groups.append((weight, same))
            return groups

        def average(groups, of):
            return (sum(w * sum(map(of, ms)) / len(ms) for w, ms in groups)
                    / sum(w for w, _ in groups))

        def typical(innings, results):
            if not innings:
                return None
            phases = []
            for p in PHASES:
                runs, wickets, legal = (
                    average(innings, lambda m: m["first"]["phases"][p][k])
                    for k in ("runs", "wickets", "legal"))
                phases.append({"runs": runs, "wickets": wickets, "run_rate": ratio(runs, legal, 6)})
            wins = (average(results, lambda m: 100 * (m["winner"] == m["batted_first"]))
                    if results else None)
            return {"score": average(innings, lambda m: m["first"]["total"]),
                    "phases": phases, "bat_first_win_percent": wins}

        totals = [m["first"]["total"] for m in complete]
        return {
            "matches": len(here), "innings": len(complete),
            "lowest": min(totals, default=None), "highest": max(totals, default=None),
            "decided": len(decided),
            "bat_first_wins": sum(m["winner"] == m["batted_first"] for m in decided),
            "here": typical([(1, complete)] if complete else [],
                            [(1, decided)] if decided else []),
            "elsewhere": typical(
                by_season(complete, [m for m in rest if m["first"]]),
                by_season(decided, [m for m in rest if m["winner"] and m["batted_first"]])),
        }


def main():
    ap = argparse.ArgumentParser(description="check the Matchup figures against the source file")
    ap.add_argument("--app", required=True, help="base URL of an app with a scratch team database")
    ap.add_argument("--zip", default=os.path.join(REPO, "db/etl/_etl/cache/ipl_json.zip"))
    args = ap.parse_args()
    src = Source(args.zip)
    report = Report()

    def call(path, method="GET", body=None, **params):
        url = args.app + path + (f"?{urllib.parse.urlencode(params)}" if params else "")
        request = urllib.request.Request(url, method=method,
                                         data=body and json.dumps(body).encode(),
                                         headers={"content-type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=120) as r:
                text = r.read()
                return json.loads(text) if text else None
        except urllib.error.HTTPError as e:
            sys.exit(f"{method} {url} -> HTTP {e.code}: {e.read()[:200]!r}")

    first, latest = src.seasons()
    grounds = sorted({m["ground"] for m in src.matches})

    # ---- which ID the app gives each ground ----------------------------------
    ids = {}
    for name, city in grounds:
        # search needs two letters; the full name and city find the ground itself
        found = call("/api/venues", q=f"{name} {city}"[:120], competition="ipl")
        hit = [v for v in found if (v["name"], v["city"]) == (name, city)]
        report.same("grounds found under their name", (name, city), 1, len(hit))
        if hit:
            ids[(name, city)] = hit[0]["venue_id"]
            report.same("matches at each ground", name,
                        sum(m["ground"] == (name, city) for m in src.matches), hit[0]["matches"])

    this_season = Counter(m["ground"] for m in src.matches if m["season"] == latest)
    listed = call("/api/matchup/grounds")
    report.same("grounds of the latest season", "list",
                str(sorted((ids.get(g), n) for g, n in this_season.items())),
                str(sorted((g["venue_id"], g["matches"]) for g in listed)))

    # ---- ground profiles -----------------------------------------------------
    for ground, venue in ids.items():
        for choice, since in (("recent", latest - RECENT_SEASONS + 1), ("all", first)):
            app = call("/api/matchup/ground", venue=venue, seasons=choice)
            want = src.ground(ground, since)
            what = f"{ground[0]} ({choice})"
            report.same("ground: seasons", what, f"{since}-{latest}",
                        f"{app['seasons']['from']}-{app['seasons']['to']}")
            for field in ("matches", "innings", "lowest", "highest", "decided", "bat_first_wins"):
                report.same("ground: counts", f"{what} {field}", want[field], app[field])
            for side in ("here", "elsewhere"):
                w, a = want[side], app[side]
                report.same(f"ground: {side} present", what, int(w is not None), int(a is not None))
                if not w or not a:
                    continue
                report.same(f"ground: {side} score", what, w["score"], a["score"], 0.0501)
                report.same(f"ground: {side} won batting first", what,
                            w["bat_first_win_percent"], a["bat_first_win_percent"], 0.0501)
                for p, wp, ap_ in zip(PHASES, w["phases"], a["phases"]):
                    report.same(f"ground: {side} phase names", what, p, ap_["phase"])
                    for field, tolerance in (("runs", 0.0501), ("wickets", 0.0051),
                                             ("run_rate", 0.0051)):
                        report.same(f"ground: {side} phases", f"{what} {p} {field}",
                                    wp[field], ap_[field], tolerance)

    # ---- teams to ask about --------------------------------------------------
    everyone = sorted({p for p, g in src.batted if g} | {p for p, g in src.bowled if g})
    known = {}  # register ID -> the app's ID (a few are split by gender)
    for i in range(0, len(everyone), TEAM):
        chunk = everyone[i:i + TEAM]
        for p in call("/api/squad", ids=",".join(chunk)):
            known[p["player_id"]] = p["player_id"]
        for pid in chunk:
            if pid not in known:
                split = call("/api/squad", ids=f"{pid}-m")
                if split:
                    known[pid] = split[0]["player_id"]
    # players named but never on the field have no record to check
    report.same("players known to the app", "count", len(everyone), len(known))

    made = []

    def save(name, players):
        team = call("/api/teams", "POST", {"name": name, "players": players})
        made.append(team)
        return team

    try:
        sides = [save(f"zz verify {s['team']}"[:60],
                      call("/api/franchises", team=s["team"])["players"])
                 for s in call("/api/franchises")]
        order = sorted(known.values())
        random.Random(1).shuffle(order)
        others = [save(f"zz verify players {n}", order[i:i + TEAM])
                  for n, i in enumerate(range(0, len(order), TEAM))]
        if len(others) % 2:
            others.append(sides[0])

        def face_off(a, b, ground, choice):
            venue = ids.get(ground)
            since = latest - RECENT_SEASONS + 1 if choice == "recent" else first
            params = {"a": a["team_id"], "b": b["team_id"], "seasons": choice,
                      **({"venue": venue} if venue else {})}
            app = call("/api/matchup/faceoff", **params)
            report.same("team v team: seasons", choice, f"{since}-{latest}",
                        f"{app['seasons']['from']}-{app['seasons']['to']}")
            for team, side in zip((a, b), app["sides"]):
                players = [p.split("-")[0] for p in team["players"]]
                report.same("team v team: ground figures present", team["name"],
                            int(venue is not None), int(side["ground"] is not None))
                for scope, where in (("all", None), ("ground", ground)):
                    if scope == "ground" and not venue:
                        continue
                    for phase in (None, *PHASES):
                        c = src.team(players, since, where, phase)
                        bat = side[scope][phase or "all"]["batting"]
                        bowl = side[scope][phase or "all"]["bowling"]
                        what = f"{team['name']} {choice} {where and where[0]} {phase}"
                        for field, got, want, tolerance in (
                                ("faced", bat["balls"], c["faced"], 0),
                                ("runs", bat["runs"], c["scored"], 0),
                                ("strike rate", bat["strike_rate"],
                                 ratio(c["scored"], c["faced"], 100), 0.0051),
                                ("boundaries", bat["boundary_percent"],
                                 ratio(c["boundaries"], c["faced"], 100), 0.0501),
                                ("balls a dismissal", bat["balls_per_dismissal"],
                                 ratio(c["faced"], c["outs"]), 0.0501),
                                ("bowled", bowl["balls"], c["bowled"], 0),
                                ("conceded", bowl["runs_conceded"], c["conceded"], 0),
                                ("wickets", bowl["wickets"], c["wickets"], 0),
                                ("economy", bowl["economy"],
                                 ratio(c["conceded"], c["bowled"], 6), 0.0051),
                                ("balls a wicket", bowl["balls_per_wicket"],
                                 ratio(c["bowled"], c["wickets"]), 0.0501)):
                            report.same(f"team v team: {scope}", f"{what} {field}", want, got,
                                        tolerance)

        def check(a, b, ground):
            venue = ids.get(ground)
            params = {"a": a["team_id"], "b": b["team_id"], **({"venue": venue} if venue else {})}
            app = call("/api/matchup", **params)
            for team, side in zip((a, b), app["sides"]):
                report.same("matchup: players in order", team["name"], str(team["players"]),
                            str([p["player_id"] for p in side["players"]]))
                for p in side["players"]:
                    pid = p["player_id"].split("-")[0]
                    who = f"{p['unique_name']} at {ground and ground[0]}"
                    overall_bat, overall_bowl = src.bat[(pid, None)], src.bowl[(pid, None)]
                    report.same("overall strike rate", who,
                                ratio(overall_bat["runs"], overall_bat["balls"], 100),
                                p["batting"]["strike_rate"], 0.0051)
                    report.same("overall economy", who,
                                ratio(overall_bowl["runs"], overall_bowl["balls"], 6),
                                p["bowling"]["economy"], 0.0051)
                    if not ground:
                        report.same("no ground: no record", who, "None None",
                                    f"{p['at_ground']['batting']} {p['at_ground']['bowling']}")
                        continue
                    bat, c = p["at_ground"]["batting"], src.bat.get((pid, ground), Counter())
                    innings = len(src.batted.get((pid, ground), ()))
                    report.same("batting at ground: present", who, int(innings > 0),
                                int(bat is not None))
                    if bat and innings:
                        for field, want, tolerance in (
                                ("innings", innings, 0), ("runs", c["runs"], 0),
                                ("balls", c["balls"], 0), ("outs", c["outs"], 0),
                                ("average", ratio(c["runs"], c["outs"]), 0.0051),
                                ("strike_rate", ratio(c["runs"], c["balls"], 100), 0.0051)):
                            report.same("batting at ground", f"{who} {field}", want, bat[field],
                                        tolerance)
                    bowl, c = p["at_ground"]["bowling"], src.bowl.get((pid, ground), Counter())
                    innings = len(src.bowled.get((pid, ground), ()))
                    report.same("bowling at ground: present", who, int(innings > 0),
                                int(bowl is not None))
                    if bowl and innings:
                        for field, want, tolerance in (
                                ("innings", innings, 0), ("balls", c["balls"], 0),
                                ("runs_conceded", c["runs"], 0), ("wickets", c["wickets"], 0),
                                ("economy", ratio(c["runs"], c["balls"], 6), 0.0051)):
                            report.same("bowling at ground", f"{who} {field}", want, bowl[field],
                                        tolerance)
            for (batters, bowlers), pairs in zip(((a, b), (b, a)), app["pairs"]):
                want = {(x, y) for x in batters["players"] for y in bowlers["players"]
                        if (x.split("-")[0], y.split("-")[0]) in src.pairs}
                got = {(p["batter_id"], p["bowler_id"]): p for p in pairs}
                report.same("meetings: which pairs", f"{batters['name']} v {bowlers['name']}",
                            str(sorted(want)), str(sorted(got)))
                balls = [p["balls"] for p in pairs]
                report.same("meetings: longest first", batters["name"],
                            str(sorted(balls, reverse=True)), str(balls))
                for key in want & set(got):
                    reg = (key[0].split("-")[0], key[1].split("-")[0])
                    there = src.pairs_at.get((*reg, ground)) if ground else None
                    part = got[key]["at_ground"]
                    report.same("meetings at the ground: present", str(key),
                                int(there is not None), int(part is not None))
                    if there is not None and part is not None:
                        for field, value, tolerance in (
                                ("balls", there["balls"], 0), ("runs", there["runs"], 0),
                                ("dismissals", there["dismissals"], 0),
                                ("strike_rate", ratio(there["runs"], there["balls"], 100), 0.0051)):
                            report.same("meetings at the ground", f"{key} {field}", value,
                                        part[field], tolerance)
                    c = src.pairs[reg]
                    for field, value, tolerance in (
                            ("balls", c["balls"], 0), ("runs", c["runs"], 0),
                            ("dismissals", c["dismissals"], 0),
                            ("strike_rate", ratio(c["runs"], c["balls"], 100), 0.0051)):
                        report.same("meetings", f"{key} {field}", value, got[key][field], tolerance)

        # every player at every ground
        for i in range(0, len(others), 2):
            for n, ground in enumerate(ids):
                check(others[i], others[i + 1], ground)
                # the two choices of seasons in turn
                face_off(others[i], others[i + 1], ground, ("recent", "all")[n % 2])
        # every franchise against every other, with and without a ground
        for i, a in enumerate(sides):
            for b in sides[i + 1:]:
                check(a, b, None)
                for choice in ("recent", "all"):
                    face_off(a, b, None, choice)
    finally:
        for team in made:
            call(f"/api/teams/{team['team_id']}", "DELETE", version=team["version"])

    sys.exit(1 if report.finish() else 0)


if __name__ == "__main__":
    main()
