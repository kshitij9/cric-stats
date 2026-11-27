#!/usr/bin/env python3
"""
Propose which venue spellings are the same ground, for a person to review.

Reads every (venue, city) pair from a loaded database and writes
db/venues/venue_merges.csv, one row per spelling that might belong with others.
Nothing is merged until a row's "approve" column says y; the next load applies
only those rows. Rerunning keeps the answers already given, and a group with answers
keeps the canonical name it was answered under, even if newer matches would now
suggest another. An answered row stays in the file when the source stops using that
spelling (its match count becomes 0), because older files still use it. Groups are
numbered afresh on each run, so look up numbers in the latest file.

    python3 db/venues/propose_merges.py                    # from cricket_next
    python3 db/venues/propose_merges.py --approve A        # mark every tier A row y
    python3 db/venues/propose_merges.py --approve A,B --groups 3,17

Tiers, from safest to least certain:
    A  same ground name and same city (ignoring punctuation, a city added to the
       name, or an old spelling of the city)
    B  same ground name, city written differently (island, suburb, region)
    C  different name: a rename or alternative name taken from RENAMES below,
       which is general knowledge and not in the source data
"""

import argparse
import csv
import io
import os
import re
import subprocess
import sys
import unicodedata
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUTPUT = os.path.join(HERE, "venue_merges.csv")
COLUMNS = ["group", "tier", "approve", "venue", "city", "canonical_venue",
           "canonical_city", "matches", "first_year", "last_year",
           "most_frequent_team", "why"]

# old or variant spellings of a place -> one spelling, for comparison only
PLACE_SPELLINGS = {
    "bangalore": "bengaluru",
    "chittagong": "chattogram",
    "port elizabeth": "gqeberha",
    "dharmasala": "dharamsala",
    "poona": "pune",
    "derry": "londonderry",
}

# places that one ground is listed under, where the source never links them
SAME_PLACE = {
    "maple leaf north west ground": {"king city", "toronto"},
    "pallekele international cricket stadium": {"kandy", "pallekele"},
}

# a comma part of a venue name that denotes a different ground, not a location
SEPARATE_GROUND = re.compile(r"\b(academy ground|(oval|ground|no) ?\d+)\b")

# (names as normalised by plain()) alternative -> the name to group under
RENAMES = {
    "feroz shah kotla": ("arun jaitley stadium", "renamed 2019"),
    "sardar patel stadium": ("narendra modi stadium", "rebuilt on the same site and renamed"),
    "sardar patel gujarat stadium": ("narendra modi stadium", "rebuilt on the same site and renamed"),
    "sheikh zayed stadium": ("zayed cricket stadium", "alternative name"),
    "darren sammy national cricket stadium": ("daren sammy national cricket stadium", "spelling"),
    "beausejour stadium": ("daren sammy national cricket stadium", "renamed 2016"),
    "subrata roy sahara stadium": ("maharashtra cricket association stadium", "former sponsor name"),
    "indian petrochemicals corporation limited sports complex ground":
        ("reliance stadium", "renamed after a change of owner"),
    "westpac stadium": ("sky stadium", "sponsor rename"),
    "western australia cricket association ground": ("w a c a ground", "full name of the WACA"),
    "the cooper associates county ground": ("county ground", "sponsor name"),
    "the royal and sun alliance county ground": ("county ground", "sponsor name"),
    "new wanderers stadium": ("the wanderers stadium", "alternative name"),
    "boland bank park": ("boland park", "sponsor name"),
    "de beers diamond oval": ("diamond oval", "sponsor name"),
    "goodyear park": ("mangaung oval", "Springbok Park under an earlier name"),
    "chevrolet park": ("mangaung oval", "Springbok Park under an earlier name"),
    "outsurance oval": ("mangaung oval", "Springbok Park under an earlier name"),
    "sedgars park": ("senwes park", "earlier name"),
    "north west cricket stadium": ("senwes park", "alternative name"),
    "jade stadium": ("ami stadium", "Lancaster Park under an earlier name"),
    "khettarama stadium": ("r premadasa stadium", "local name"),
    "p saravanamuttu stadium": ("p sara oval", "full name"),
    "sinhalese sports club": ("sinhalese sports club ground", "shortened name"),
    "sher e bangla national cricket stadium": ("shere bangla national stadium", "spelling"),
    "zohur ahmed chowdhury stadium": ("zahur ahmed chowdhury stadium", "spelling"),
    "chittagong divisional stadium": ("zahur ahmed chowdhury stadium", "earlier name; please confirm"),
    "bir sreshtho flight lieutenant matiur rahman stadium":
        ("zahur ahmed chowdhury stadium", "recent rename; UNCERTAIN, please confirm"),
    "punjab cricket association stadium": ("punjab cricket association is bindra stadium", "renamed 2015"),
    "bharat ratna shri atal bihari vajpai ekana cricket stadium":
        ("bharat ratna shri atal bihari vajpayee ekana cricket stadium", "spelling"),
    "vidarbha c a ground": ("vidarbha cricket association ground", "shortened name"),
    "andhra cricket association visakhapatnam district cricket association stadium":
        ("dr y s rajasekhara reddy aca vdca cricket stadium", "earlier name"),
    "maharani usharaje trust cricket ground": ("holkar cricket stadium", "renamed 2010"),
    "saurashtra cricket association stadium": ("niranjan shah stadium", "renamed 2024"),
    "sharjah cricket association stadium": ("sharjah cricket stadium", "alternative name"),
    "icc global cricket academy": ("icc academy", "alternative name; please confirm"),
    "dubai sports city cricket stadium": ("dubai international cricket stadium", "alternative name"),
    "grange cricket club": ("grange cricket club ground", "shortened name"),
    "wanderers": ("wanderers cricket ground", "shortened name"),
    "vra cricket ground": ("vra ground", "alternative name"),
    "choice moosa stadium": ("moosa cricket stadium", "alternative name"),
    "ysd ukm cricket oval": ("ukm ysd cricket oval", "word order"),
    "national sports academy": ("vassil levski national sports academy", "shortened name"),
    "gahanga international cricket stadium rwanda":
        ("gahanga international cricket stadium", "punctuation"),
    "tafawa balewa square tbs cricket oval": ("tafawa balewa square cricket oval", "abbreviation"),
    "bready": ("bready cricket club", "shortened name"),
    "queens park new": ("national cricket stadium", "earlier name of the Grenada stadium; please confirm"),
    "marrara cricket ground": ("marrara stadium", "alternative name"),
    "bundaberg rum stadium": ("cazalys stadium", "former sponsor name"),
    "simonds stadium": ("gmhba stadium", "sponsor rename"),
    "malahide": ("the village", "The Village is the ground at Malahide"),
    "clontarf cricket club ground": ("castle avenue", "Clontarf's ground is Castle Avenue"),
    "bermuda national stadium": ("national stadium", "alternative name"),
    "narayanganj osmani stadium": ("khan shaheb osman ali stadium", "alternative name; please confirm"),
    "sylhet stadium": ("sylhet international cricket stadium", "earlier name; please confirm"),
}


def plain(text):
    """Lower case, no accents or punctuation, for comparing names."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = text.lower().replace("&", " and ").replace("'", "")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


def place(text):
    text = plain(text)
    return PLACE_SPELLINGS.get(text, text)


def split_venue(venue):
    """(ground name as written, [location parts]) from a source venue string."""
    first, *rest = [p.strip() for p in venue.split(",")]
    ground = [first] + [p for p in rest if SEPARATE_GROUND.search(plain(p))]
    return ", ".join(ground), [p for p in rest if p not in ground]


def entry(row):
    venue, city, matches, first, last, team = row
    ground, locations = split_venue(venue)
    name = plain(ground)
    target, why = RENAMES.get(name, (name, ""))
    places = {place(p) for p in [city, *locations] if p}
    if name == "malahide":
        # the source also writes "The Village, Malahide": a ground and its location
        places.add("malahide")
    return {"venue": venue, "city": city, "matches": int(matches), "first": first,
            "last": last, "team": team, "ground": ground, "name": name,
            "target": target, "why": why, "places": places}


def clusters(entries):
    """Split entries sharing a ground name into one list per location."""
    groups = []          # [places, entries]
    unplaced = []
    for e in entries:
        if not e["places"]:
            unplaced.append(e)
            continue
        places = set(e["places"])
        links = SAME_PLACE.get(e["target"], set())
        if places & links:
            places |= links
        joined = [g for g in groups if g[0] & places]
        for g in joined:
            groups.remove(g)
        groups.append([places.union(*(g[0] for g in joined)),
                       [e] + [x for g in joined for x in g[1]]])
    # a spelling with no city joins only if there is a single candidate
    if len(groups) == 1:
        groups[0][1] += unplaced
    elif not groups and unplaced:
        groups.append([set(), unplaced])
    return [g[1] for g in groups]


def propose(pairs):
    by_name = defaultdict(list)
    for row in pairs:
        e = entry(row)
        by_name[e["target"]].append(e)

    proposals = []
    for target in sorted(by_name):
        for members in clusters(by_name[target]):
            if len(members) < 2:
                continue
            # the canonical spelling: current name, most recently used
            current = [e for e in members if e["name"] == target] or members
            best = max(current, key=lambda e: (e["last"], bool(e["city"]), e["matches"]))
            city = best["city"] or max(
                (e for e in members if e["city"]),
                key=lambda e: (e["last"], e["matches"]), default=best)["city"]
            rows = []
            for e in sorted(members, key=lambda e: (e["venue"], e["city"])):
                if e["name"] != plain(best["ground"]):
                    tier, why = "C", e["why"] or "different name"
                    if e["name"] == target:
                        why = "current name differs from the one most used here"
                elif not e["city"] or place(e["city"]) == place(city):
                    tier = "A"
                    why = "no city given" if not e["city"] else "same name and city"
                else:
                    tier, why = "B", f"same name; city given as {e['city']}"
                rows.append({"tier": tier, "venue": e["venue"], "city": e["city"],
                             "canonical_venue": best["ground"], "canonical_city": city,
                             "matches": e["matches"], "first_year": e["first"],
                             "last_year": e["last"], "most_frequent_team": e["team"],
                             "why": why})
            proposals.append(rows)

    proposals.sort(key=lambda rows: (rows[0]["canonical_venue"].lower(),
                                     rows[0]["canonical_city"]))
    return [{"group": n, **row} for n, rows in enumerate(proposals, 1) for row in rows]


def read_pairs(db):
    sql = """
    WITH teams AS (
        SELECT venue, coalesce(city, '') AS city, team, count(*) AS n
          FROM matches CROSS JOIN LATERAL (VALUES (team1), (team2)) t(team)
         GROUP BY 1, 2, 3),
    top AS (SELECT venue, city, (array_agg(team ORDER BY n DESC, team))[1] AS team
              FROM teams GROUP BY 1, 2)
    SELECT m.venue, coalesce(m.city, ''), count(*), extract(year FROM min(m.date)),
           extract(year FROM max(m.date)), top.team
      FROM matches m
      JOIN top ON top.venue = m.venue AND top.city = coalesce(m.city, '')
     WHERE m.venue IS NOT NULL
     GROUP BY m.venue, coalesce(m.city, ''), top.team ORDER BY 1, 2;
    """
    command = ["docker", "compose", "exec", "-T", "postgres", "sh", "-c",
               'psql -X -q --csv -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"',
               "psql", db]
    result = subprocess.run(command, input=sql, cwd=REPO, capture_output=True, text=True)
    if result.returncode:
        sys.exit(f"query on {db} failed: {result.stderr.strip()}")
    return list(csv.reader(io.StringIO(result.stdout)))


def carry_forward(rows, previous):
    """Apply earlier answers to freshly proposed rows; returns those left over."""
    answered = {(r["venue"], r["city"]): r for r in previous if r["approve"].strip()}
    settled = {}   # group -> the canonical name its answers refer to
    for row in rows:
        old = answered.get((row["venue"], row["city"]))
        if old:
            settled.setdefault(row["group"], (old["canonical_venue"], old["canonical_city"]))
    for row in rows:
        row["approve"] = ""
        if row["group"] in settled:
            row["canonical_venue"], row["canonical_city"] = settled[row["group"]]
        old = answered.get((row["venue"], row["city"]))
        # an answer holds only for the same target
        if old and (old["canonical_venue"], old["canonical_city"]) == (
                row["canonical_venue"], row["canonical_city"]):
            row["approve"] = answered.pop((row["venue"], row["city"]))["approve"]
    return list(answered.values())


def keep_answers(rows, left_over, matches):
    """Rows to write: the proposals, plus every earlier answer none of them took.

    An answer left over replaces any new proposal for the same spelling. One group
    is the rows that share a canonical ground.
    """
    spellings = {(r["venue"], r["city"]) for r in left_over}
    kept = [r for r in rows if (r["venue"], r["city"]) not in spellings]
    kept += [{**r, "matches": matches.get((r["venue"], r["city"]), 0)} for r in left_over]

    def target(row):
        return (row["canonical_venue"].lower(), row["canonical_city"], row["canonical_venue"])

    kept.sort(key=lambda r: (*target(r), r["venue"], r["city"]))
    numbers = {t: n for n, t in enumerate(sorted({target(r) for r in kept}), 1)}
    return [{**r, "group": numbers[target(r)]} for r in kept]


def main():
    ap = argparse.ArgumentParser(description="propose venue merges for review")
    ap.add_argument("--db", default="cricket_next")
    ap.add_argument("--out", default=OUTPUT)
    ap.add_argument("--approve", help="mark rows of these tiers y, e.g. A or A,B")
    ap.add_argument("--groups", help="limit --approve to these group numbers")
    args = ap.parse_args()

    previous = []
    if os.path.exists(args.out):
        with open(args.out, newline="", encoding="utf-8-sig") as f:
            previous = list(csv.DictReader(f))

    pairs = read_pairs(args.db)
    matches = Counter()
    for venue, city, n, *_ in pairs:
        matches[(venue, city)] += int(n)
    proposed = propose(pairs)
    left_over = carry_forward(proposed, previous)
    rows = keep_answers(proposed, left_over, matches)
    tiers = set(args.approve.upper().split(",")) if args.approve else set()
    groups = {int(g) for g in args.groups.split(",")} if args.groups else None
    for row in rows:
        wanted = row["tier"] in tiers and (groups is None or row["group"] in groups)
        if wanted and not row["approve"]:
            row["approve"] = "y"
    # never lose an answer silently: stop before overwriting the file
    def answers(table):
        return {(r["venue"], r["city"], r["canonical_venue"], r["canonical_city"],
                 r["approve"].strip()) for r in table if r["approve"].strip()}

    lost = answers(previous) - answers(rows)
    if lost:
        sys.exit("these answers would be lost; nothing was written:\n" +
                 "\n".join(f"  {a}: {v!r} ({c}) -> {t!r}" for v, c, t, _, a in sorted(lost)))

    tmp = args.out + ".part"
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    os.replace(tmp, args.out)

    print(f"{args.out}: {len(rows)} spellings in {rows[-1]['group'] if rows else 0} groups")
    for tier in "ABC":
        chosen = [r for r in rows if r["tier"] == tier]
        approved = sum(r["approve"].strip().lower() in ("y", "yes") for r in chosen)
        waiting = sum(not r["approve"].strip() for r in chosen)
        print(f"  tier {tier}: {len(chosen):4} rows, {approved} approved, {waiting} unanswered")
    unused = sum((r["venue"], r["city"]) not in matches for r in rows)
    print(f"  {unused} answered rows are for spellings these matches no longer use")


if __name__ == "__main__":
    main()
