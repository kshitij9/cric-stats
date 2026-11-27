# CricIntell: plan for IPL and fantasy picking

Written 27 November 2026.

| Step | State |
|---|---|
| 0. Keep development apart | Done 27 November 2026 |
| 1. Load the IPL, kept separate | Done 27 November 2026 |
| 2. Fantasy data and points | Not started |
| 3. Screens | Redesign, competition switch and bowling done 27 November; combined T20 view not started |
| 4. Picks | Not started |

Notes from steps 0 and 1:

- The worktree is `cric-stats-ipl`. Run the scripts there with
  `COMPOSE_PROJECT_NAME=cric-stats`. Do not run `docker compose up` from it.
- Matches, balls, careers and era baselines carry a `competition`
  (`international` or `ipl`). The APIs take `competition`, defaulting to
  international; `ipl` needs format `T20`.
- A club match from any other competition stops the load.
- Renamed franchises are in `db/teams/franchises.csv`. Deccan Chargers and
  Sunrisers Hyderabad, Gujarat Lions and Gujarat Titans, and Pune Warriors and
  Rising Pune Supergiant are kept apart.
- `cricket_next` holds 11,325 matches (1,243 IPL). `verify.py` found no
  differences in 24,067 innings, and `verify_stats.py` none in 26,921 values.
- Before the ground approval below, international matches, balls, wickets,
  line-ups, careers, era baselines and players were identical to the live database from the same source files, and
  1,889 international API requests answered the same on the preview as live.
- The ten rows that left eight IPL grounds split were approved on 27 November,
  giving 398 grounds. Both checks passed again. At those grounds international
  matches are now grouped under the merged ground; this changed their ground ID
  and 4 of 125 venue searches. Everything else still matches live.
- **Going live:** the new app and the new data must arrive together. The old app
  on the new data would mix the IPL into T20 internationals, and the new app
  cannot read the old data. Load a second database and swap, as in the fixes.

Notes from step 3 (brought ahead of step 2):

- Screens are Home, Player, Compare and Picks, under one header with the
  IPL / International switch (IPL by default). The choice, the player and the
  comparison list are remembered in the browser. `/duel` leads to Compare.
- Compare takes up to six batters (colours checked for colour blindness). The
  radar charts were replaced by season charts and bars.
- Picks updates as choices change. Because that sends more searches, the app now
  sets three database options per connection (`lib/db.ts`): without them 32 of
  84 simultaneous searches failed, the database container having only 64 MB of
  shared memory. With them none failed.
- 63 browser checks passed (script outside the repository, `ui.mjs`).
- Player and Compare have a Batting / Bowling choice. Bowling figures are
  worked out from the balls when asked for, so no reload is needed; they are
  defined in `lib/stats.ts`. There is no bowling era index.
- `verify_stats.py` now checks bowling too: none of 62,188 values differed. A
  one-off run over every player who has bowled (8,689 player-and-format pairs,
  615,047 values) found no differences either. 85 browser checks passed.
- Still to do here: the combined T20 view, and an option to leave out retired
  players from Picks.

## Goal

Help pick a fantasy team: IPL first, with internationals (T20I, ODI, Test) still
available. It runs on the home server only for now.

## What the IPL data holds

From Cricsheet's `ipl_json.zip`, downloaded 27 November 2026.

| Item | Found |
|---|---|
| Matches | 1,243, from 18 April 2008 to 31 May 2026 |
| Players | 809 named in a line-up; 202 of them in 2026 |
| Link to internationals | Same player IDs. 126 of the 2026 players are in the T20I data; 76 are not |
| Fielders | Named on catches and stumpings, and on most run-outs (182 run-outs name none) |
| Impact players | 557 substitutions recorded, 2023 to 2026; line-ups then list 12 |
| Team names | Renamed sides appear under both names, e.g. Delhi Daredevils and Delhi Capitals |
| Grounds | 46 spellings, including renames such as Feroz Shah Kotla and Arun Jaitley Stadium |

## What the current code lacks

1. **IPL would mix with T20 internationals.** Both are format `T20`, so careers,
   era baselines, matchups and recommendations would pool them.
2. **Fielders are not stored**, so catches, stumpings and run-outs cannot score.
3. **Impact substitutions are not stored.**
4. **The default sources do not include IPL**, so the daily refresh skips it.

## What the data cannot give

Player roles (keeper, batter, all-rounder, bowler), fantasy prices, fixtures,
squads for the next season and announced line-ups. Start with files and screens
where these are entered by hand. Roles can be guessed from past matches and then
corrected.

## Steps

### 0. Keep development away from the live app

The daily refresh runs from whatever is in `cric-stats`, so half-finished loader
changes there would reach the live database.

- Leave `cric-stats` on `main` for the live app and the refresh.
- Work on branch `ipl` in a separate git worktree, with
  `COMPOSE_PROJECT_NAME=cric-stats` so it uses the same Postgres.
- Load into `cricket_next`; preview on port 3002.
- Do not push `main` until agreed: Vercel deploys it publicly.

### 1. Load the IPL and keep it separate

- Add a competition to matches and balls: `IPL`, or international.
- Key careers and era baselines by competition as well as format and gender.
- Count a season by calendar year (the source writes 2008 as `2007/08`).
- Map old team names to franchises.
- Propose and review the IPL venue merges.

Done when: IPL figures match the source files, and every international figure is
the same as in the live database for the same source files.

### 2. Store what fantasy scoring needs

- Fielders for each wicket, and impact substitutions.
- Scoring rules kept in one file, and points for every player in every match.

Done when: points for sample matches agree with the chosen game's scorecards.

### 3. Screens

- Competition choice on every screen, IPL first: IPL, T20I, ODI, Test, and a
  combined T20 view for recent form.
- Bowling beside batting; fantasy points by season, venue and opposition.

### 4. Picks

- Choose two sides and a ground; project each player's points; suggest a team
  with captain and vice-captain.
- Test on past seasons, using only matches before each one predicted.

Done when: it is measured against a simple baseline (average points over each
player's recent matches). If it does not beat that, say so and keep the baseline.

## To decide

1. Which fantasy game's scoring and team rules to follow.
2. Whether the combined T20 view is wanted.
