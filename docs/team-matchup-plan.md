# CricIntell: plan for custom teams and matchups

Written 27 November 2026. The suggestions under "To decide" were accepted the
same day.

| Stage | State |
|---|---|
| 1. Team builder | Live since 27 November 2026 |
| 2. Matchup facts | Live since 27 November 2026 |
| 3. Simulator and its test | Not started |
| 4. Matchup results | Not started |

Notes from stage 1:

- Teams are in `cricintell_app` (preview: `cricintell_app_dev`), made by
  `db/app/setup.sh`. Without it the Teams screen says saving is not set up and
  the rest of the app works.
- Every change is saved at once. A team changed on another device is not
  overwritten.
- A team may be saved with fewer than 11. At most 100 teams.
- Overs by bowler are not set yet; they move to stage 3 with the bowling order.
  For now a player "bowls" if they bowled in half of their last 20 IPL matches.
- Copying a franchise: a match that listed 12 drops whoever played least in the
  side's last 20. The source records the actual substitution, but it is not
  loaded yet.
- `db/app/backup.sh` saves a copy; its nightly cron entry is not installed.

Stage 1 went live with `db/app/setup.sh --db cricintell_app`, an app rebuild
and the nightly backup entry.

Notes from stage 2:

- The Matchup screen is reached from Teams (`/matchup`); the choices are in its
  address.
- A first innings counts if it had 120 legal balls or ten wickets. "Elsewhere"
  weights each season by the innings played at the ground that season.
- Seasons: the last four (default) or all. Player records at the ground and
  head-to-heads always cover every season.
- Faint rows: under 60 balls at the ground, or under 12 in a head-to-head.
- Added to the plan: matches won by the side batting first, and buttons for the
  latest season's grounds.
- `db/etl/verify_matchup.py` found no differences in 258,777 values. It saves
  and removes temporary teams, so it needs an app with a scratch team database.
- No loader change. Released with only an app rebuild.

## Goal

Create teams by adding players, set one against another, and see how the contest
changes from ground to ground.

## Proposed scope

| In the first version | Left for later |
|---|---|
| Men's IPL | T20 internationals (next), then ODI; Test |
| Teams of 11 with a batting order and bowlers' overs | Impact player |
| Your own teams, and copies of a franchise's recent XI | Tournaments between many teams |
| Win chance, projected scores and key players | Fantasy points |
| One ground, or several side by side | Pitch, weather, dew |

## What the data supports

Measured on 27 November 2026, data to 25 November.

| Question | Found | So |
|---|---|---|
| How often has a 2026 IPL player batted 60 balls at one of the 10 busiest recent grounds? (players with 100+ IPL balls) | 34% of player-and-ground pairs; 13% never batted there | A player's own record at a ground is usually too thin to lead |
| The same for bowling | 35%; 21% never bowled there | As above |
| How often have a 2026 batter and bowler met? (11,128 pairs, 100+ balls each) | 48% never in the IPL; 4.4% for 30+ balls (6.4% counting all T20 here) | Head-to-head can only adjust slightly |
| Has IPL scoring changed? | 8.05 runs an over in 2021, 9.88 in 2026 | Compare a ground with the same seasons, and weight recent play |
| Do grounds differ? | Middle overs since 2023: 7.74 at Chepauk, 9.36 at Wankhede | Grounds are worth modelling |
| Enough matches per ground? | IPL: 22 grounds with 10+, 13 with 30+. Women's T20Is: 12 with 30+ | Pull thin grounds toward the average and say so |

The data has no player roles, wicketkeepers, nationality, squads or prices.
Overseas limits and "needs a keeper" cannot be checked automatically.

## How it would work

### Teams

- Name, competition, gender, 11 players in batting order.
- Bowlers and their overs by phase are suggested from past matches and can be
  changed: 20 overs, at most 4 each, none back to back.
- Warn, without blocking, when fewer than five players have bowled regularly.
- Start empty, or copy a franchise's latest line-up.
- A player may appear in both sides of a matchup, with a note.

### Where teams are saved

A separate database, `cricintell_app`, in the same Postgres.

- The daily load only replaces the match tables, but a release like the IPL one
  swaps whole databases. Teams kept in `cricket` would be left behind.
- The preview uses its own `cricintell_app_dev`, so testing cannot change real
  teams.
- Add a nightly `pg_dump`. Unlike match data, teams cannot be downloaded again.
- These are the app's first writes. There is no login, so keep it on the home
  network or behind Cloudflare Access. Validate input and cap the number of
  teams.

### The matchup

Simulate the match ball by ball, several thousand times.

1. Each ball's outcome (0, 1, 2, 3, 4, 6, wicket, wide, no-ball) starts from the
   average for that phase of the innings.
2. It is adjusted for how this batter and this bowler differ from average, and
   for how the ground differs.
3. Thin records are pulled toward an average for a similar batting position, so a
   tail-ender with 10 balls is not rated as an average batter.
4. Recent seasons count for more.
5. The innings ends at 10 wickets, 20 overs or the target.

Output: win chance, spread of scores, each player's likely runs and wickets, and
the battles that matter, each with the number of balls behind it. Toss: choose
who bats first, or average both. The same random seed is used for every ground,
so differences come from the ground and not from chance.

Head-to-head and chasing behaviour are added only if they improve the test
below.

Limits: a ground's figures partly reflect its home side; changes of field and
tactics are not modelled.

No loader change is needed at first. Rates are queried when asked for, with an
"as of" date, and cached. The daily refresh is left alone.

## Stages

Each is usable or checkable on its own.

### 1. Team builder

Teams screen: create, edit, reorder, copy, delete.

- `lib/app-db.ts`, `lib/teams.ts`, `app/api/teams/`, `app/teams/page.tsx`
- Reuse `PlayerSearch`; add Teams to `AppHeader`.
- `APP_DATABASE_URL` in `docker-compose.yml` and the preview script.

Done when: teams survive a reload, a data load and an app rebuild; bad input is
refused; browser checks pass.

### 2. Matchup facts

Pick two teams and a ground. No prediction yet.

- Ground profile: typical first-innings score, runs and wickets by phase, against
  the same seasons elsewhere.
- Each player's record there and the head-to-heads, with ball counts.
- `lib/ground.ts`, `app/api/matchup/`, `app/matchup/page.tsx`; reuse
  `VenueSearch`.

Done when: every figure matches an independent count from the source, as
`verify_stats.py` does now.

### 3. Simulator and its test

- `lib/sim/`: rates, bowling order, engine. Seeded.
- Backtest script using the same code: predict each IPL match from 2023 to 2026
  (about 290) from earlier matches only, with the sides that were named and no
  knowledge of who bowled when.

Compare with:

| Measure | Must beat |
|---|---|
| Winner (log loss) | 50/50, and a team-rating (Elo) baseline |
| First-innings total (mean error) | Recent average at that ground |
| Player runs and wickets (mean error) | The player's recent average |

Also check calibration (sides given 60% should win about 60% of the time) and
speed (aim: under 2 seconds for one ground).

**Decision point.** IPL results are close to even, and with about 290 matches an
accuracy figure is only good to about 3 points either way. If the simulator does
not beat the baselines, show projections labelled as illustration and no win
percentage.

### 4. Matchup results

Win chance and projections on the Matchup screen; up to five grounds side by
side; change a player or the batting order and run again.

Done when: the same inputs give the same answer, thin evidence is marked, and
browser checks pass.

### Later

T20 internationals, round-robin between your teams, impact player, fantasy points from the same
simulation (this feeds step 4 of `ipl-fantasy-plan.md`; catches need fielders
from step 2), one combined T20 record per player, ODI.

## Decided

| Question | Accepted |
|---|---|
| Simulated win chance, or stats side by side only? | Simulation, shown only if it passes the test |
| Franchise XIs as opponents? | Yes, copied into a team you can edit |
| Save teams on the server or in the browser? | Server, so every device sees them |
| IPL only at first? | Yes; T20 internationals next |
| Mix IPL and international players in one team? | Not at first: players without IPL balls would be rated as average |
