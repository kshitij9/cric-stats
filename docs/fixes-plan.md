# CricIntell: plan for the data and stats fixes

Written 26 November 2026.

## Status

| Step | State |
|---|---|
| 0. Protect what exists | Done 26 November 2026 |
| 1. Safe, repeatable loading | Done 26 November 2026 |
| 2. Store the data correctly | Done 26 November 2026; tier A venue merges approved, B and C not yet reviewed |
| 3 to 6 | Not started |

Notes from step 2:

- `cricket_next` holds the September data in the new tables. `verify.py` found no
  differences from the source files in any of 20,949 innings.
- Tier A venue merges are approved. To accept B or C rows later, mark them `y` in
  `db/venues/venue_merges.csv` (or use
  `db/venues/propose_merges.py --approve B,C --groups N`), then run
  `./db/etl/run.sh --offline`.
- **The source withholds every Afghanistan men's match** and the Afghanistan
  Premier League, a decision Cricsheet explains at
  <https://cricsheet.org/withheld-matches>. Step 4's coverage note must say so,
  and the predictor cannot rate Afghanistan from this source.
- For step 3: `deliveries.extras_type`, `wicket_type` and `player_out` are kept so
  the current queries still work. Move the queries to the new columns and the
  `wickets` table, then drop them. Career rows already use the new counting rules.
  `era_averages` still uses the old definition.
- For step 4: only some players have a full first name to search by (about 4 in
  10, counting names that already include one).
- `players.name` comes from Cricsheet's register and can be a former name (e.g.
  `NR Sciver`); scorecard spellings are in `player_aliases`.
- Source limits: four player IDs were used for both men and women and are split
  in two; one 2020 match gives the same ID to a "J Butler" in each side.

Notes from step 1:

- `./db/etl/run.sh` now loads into `cricket_next` by default. Loading the live
  database needs `--db cricket --live`; step 6's cron job must pass both.
- `cricket_next` holds the September data and matched `cricket` row for row
  after step 1.
- A pinned, read-only copy of the September downloads is in
  `db/etl/_etl/snapshot-2026-09-02/`. An online run replaces the files in
  `db/etl/_etl/cache/`, so use the snapshot paths for step 5's September checks.
- The sanity checks are in `db/etl/checks.sql` and
  `checks-against-current.sql`. Step 5's comparison with the source files is
  still to be written.
- Stopping a run during the final publish statement leaves either the old data or
  the complete new data, since the statement may finish inside the container.

Restore points from step 0:

- Code: commit `8329fe7` on `homelab-postgres-migration`
- Database: `/home/kshit/server/backups/pre-stat-fixes-20261126/cricket.dump`
  (custom format; load with `pg_restore` into an empty database)
- App image: `cric-stats-app:pre-fixes`

## Goal

Every number in the app is correct for a named player, format and period, and
the data refreshes safely. The comparison arena, leagues and match predictor
build on this and are out of scope here.

## Ground rules

- The live app (port 3001, database `cricket`) is untouched until step 6.
- New data is built in a second database, `cricket_next`, in the same Postgres
  container. A candidate app runs against it on port 3002.
- Work happens on a new branch, `stat-fixes`.
- Builds and checks run in Docker. The host has Node 18, which is too old for
  Next.js 16.
- Steps 1 to 5 are first run on the cached 2 September downloads, so any change
  in a number comes from the code. Fresh data is loaded after that.

## What gets fixed

Counts come from the cached source files (9,769 matches).

| # | Problem | Fixed in |
|---|---|---|
| 1 | 66 names are shared by two or more people | steps 2, 4 |
| 2 | Era baseline pools men and women and counts wides | step 3 |
| 3 | Career era index is a plain mean of yearly values, so a short season weighs as much as a full one | step 3 |
| 4 | Matchups mix formats, count wides as balls faced, and credit run-outs to the bowler | step 3 |
| 5 | Retired hurt / retired not out counted as dismissals (236) | steps 2, 3 |
| 6 | Dismissals of the non-striker (about 5,700) are ignored by the recommender and pinned on the striker-bowler pair in matchups | steps 2, 3 |
| 7 | Only the first wicket on a ball is stored in `deliveries` (9 balls affected) | step 2 |
| 8 | Only the first extras type is stored, hiding 466 wides or no-balls and charging some byes to bowlers | step 2 |
| 9 | All-run fours and sixes counted as boundaries (661) | steps 2, 3 |
| 10 | "Survival Rate" is really not-out percentage | step 4 |
| 11 | Same ground under several spellings | step 2 |
| 12 | Players found only by exact scorecard name | step 4 |
| 13 | Coverage starts in December 2001 and the app does not say so | step 4 |
| 14 | A failed load can leave tables empty; the app also sees partial data while loading | step 1 |
| 15 | Cached downloads are never refreshed | step 1 |

## Step 0: Protect what exists

1. Add `__pycache__/` and `db/etl/_etl.log` to `.gitignore`. `.env` is already ignored.
2. Commit the uncommitted work (recommender, loader, schema changes) and push it.
3. Create `stat-fixes` from that commit.
4. Dump the `cricket` database to `/home/kshit/server/backups/` and tag the
   running app image `pre-fixes`.

Done when: the loader and recommender exist on GitHub and the dump restores into
an empty database.

## Step 1: Make loading safe and repeatable

Files: `db/etl/run.sh`, `db/etl/load_cricsheet.py`

1. Take the target database as an argument, defaulting to `cricket_next` during
   this work.
2. Load into a staging schema, run the step 5 sanity checks, then swap it in
   within one transaction. A failure leaves the current data in place.
3. Re-download a bundle only when the server's `Last-Modified` is newer. Save to
   a temporary file, test the zip, then rename it.
4. Record each load in a `data_loads` table: time, source dates, row counts,
   latest match date.
5. Add an offline flag that uses the cached files.

Done when: killing a load halfway changes nothing in the target database.

## Step 2: Store the data correctly

Files: `db/init/001-schema.sql`, `db/etl/load_cricsheet.py`

All schema changes land together so the data is reloaded once.

| Table | Change |
|---|---|
| `players` (new) | Cricsheet ID, scorecard name, unique name (e.g. "Rashid Khan (2)") |
| `player_aliases` (new) | Full and alternate names from Cricsheet's `names.csv`, e.g. "Virat Kohli" |
| `deliveries` | Add batter, non-striker and bowler IDs; separate columns for wides, no-balls, byes, leg byes and penalty; a boundary flag that excludes all-run fours and sixes; a powerplay flag from the source; team type |
| `wickets` (new) | One row per dismissal: delivery, player out ID, kind |
| `matches` | Add result method (e.g. D/L) and eliminator winner |
| `match_players` (new) | Line-ups for each match, needed later by the predictor |
| `venues`, `venue_aliases` (new) | One ID per ground |

Venue merging: a script proposes merges (for example "Eden Gardens" with
"Eden Gardens, Kolkata"). The approved list is kept in the repo as a CSV. Only
reviewed merges are applied, and unlisted spellings stay separate.

`player_career_stats` and `era_averages` become SQL built from `deliveries` and
`wickets`, replacing the second set of counting rules in Python.

Done when: runs, extras and wickets per match equal those in the source files for
every match.

## Step 3: Define each stat once

Files: new `lib/stats.ts`; `app/api/stats/[type]/route.ts`; `lib/recommend.ts`

| Term | Definition |
|---|---|
| Ball faced | Any delivery that is not a wide |
| Legal ball (bowler) | Not a wide or no-ball |
| Runs conceded | Batter runs + wides + no-balls |
| Dismissal | Any wicket except retired hurt and retired not out; counted for the player out |
| Bowler's wicket | Bowled, caught, caught and bowled, lbw, stumped, hit wicket |
| Boundary | Four or six that reached or cleared the rope |
| Era baseline | Runs per 100 balls faced, by year, format and gender |
| Era index | Player's runs divided by the runs an average batter would score from the same balls, year by year; career value is therefore weighted by balls |

1. Rewrite the stats queries and the recommender to use these definitions.
2. Require a player ID and format on every stats request. Matchups return runs,
   balls, strike rate and dismissals for that format.
3. Remove the unused `player` query, which reads a table that does not exist.

Done when: the app and the recommender return the same career figures for the
same player.

## Step 4: Update the screens

Files: `app/**/page.tsx`, `components/*`, `hooks/useCricketStats.ts`

1. A shared player search with suggestions, matching full names and showing team
   to tell namesakes apart. Pages pass IDs.
2. Replace the per-page mean of era values with the value from the API.
3. Rename "Survival Rate" to "Not-out %" and fix the text that explains it.
4. Show format, runs, strike rate and balls in the matchup table.
5. Show the coverage period and latest match date on every page. Mark careers
   that may have started before coverage.

Done when: all five pages work with searched players, including two namesakes.

## Step 5: Verify

A script, `db/etl/verify.py`, computes figures directly from the source files,
separately from the loader, and compares them with the database and API.

- Totals per match: runs, extras, wickets.
- Career batting and bowling for a sample of at least 50 players across formats
  and genders, including namesakes.
- No player ID appears in both men's and women's matches.
- On the September data: Kohli against Hazlewood gives ODI 67 runs from 106
  balls, 5 dismissals; T20 43 from 30, 1; Test 173 from 367, 5.
- On the September data: the men's 2024 T20 baseline is 112.44.
- A list of the largest changes between old and new figures, each traced to a
  row in "What gets fixed".

Then load fresh data into `cricket_next` and rerun the checks that do not depend
on the September figures.

## Step 6: Switch over (needs your approval)

1. You review the candidate app on port 3002.
2. Rename `cricket` to `cricket_old` and `cricket_next` to `cricket`, then
   rebuild and restart the app. Expect a short outage.
3. Roll back if needed: reverse the renames and start the `pre-fixes` image.
4. Add a daily cron job for `run.sh`, logging to a file. It does nothing when the
   source is unchanged.
5. Drop `cricket_old` after a week without problems.

Done when: the live app shows the latest source data and one scheduled run has
succeeded.

## Order and review points

Steps run in order. Pause for review after step 2 (venue merge list), after
step 5 (changed figures) and before step 6.
