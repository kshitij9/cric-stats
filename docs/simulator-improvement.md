# CricIntell: improving the match simulator

Rules written on 28 November 2026, before any result of this round. The first
round is in `simulator-backtest.md`; its version is commit `7bb30f4`.

## Steps

0. Commit the first version.
1. Find where the 17.9 missing runs come from, by switching parts on and off.
2. Make the scoring level follow recent matches more closely.
3. Let scoring depend on wickets in hand.

## Rules

| Matches | Use |
|---|---|
| IPL up to 2022 (settings scored on 2013 to 2022) | Design and choose everything |
| Men's T20 internationals, 2023 to 2026 | Fresh check. Settings come unchanged from the IPL; nothing is chosen from it. First and new versions scored once |
| IPL 2023 to 2026 | Already seen. Shown, but it can only count against the simulator, never for it |
| IPL 2027 | Final test, with the version frozen before the season and predictions saved before each match |

- The scoring level and the spread between pitches are chosen by how well the
  simulated first-innings totals fit; other settings by how well single balls
  are predicted.
- Changed during tuning, before anything later than 2022 was scored: whether the
  two innings have separate scoring rates is part of the scoring level, so totals
  choose it. Chosen by single balls, it left first innings 8 runs low on 2013 to
  2022.
- Baselines get the same treatment: the ground average and the player averages
  may use the same kind of recent-level correction, chosen on the same seasons.
- **Beaten** means a lower error with a 95% range of the difference, from
  resampling matches, that excludes zero.
- Step 1 may look at 2023 to 2026, since it only explains the first result.
  That makes those seasons even less of a test of what follows.

## Targets

| Measure | First version, IPL 2023 to 2026 | Target |
|---|---|---|
| Average score bias | 17.9 runs low | within 3 runs |
| Real score inside the simulated 10th to 90th percentile | 69% | 75 to 85% |
| First-innings mean error | not better than the ground average | beats the corrected ground average |
| Player runs and wickets | mixed | beat the tuned average on mean and root mean square error |
| Win chance | no better than 50/50 | shown only if it beats 50/50 and team ratings |

## When to stop

Carry on with the simulator only if, on the T20 international check, **both** the
first-innings total and player runs beat their corrected averages, and IPL 2023
to 2026 shows neither of them worse. Otherwise stop, and build fantasy
projections from recent averages.

## Results (28 November 2026)

**Stop.** The new version fails the stop rule on both counts: on the T20
internationals its player runs did worse than the tuned average on root mean
square error, and on the IPL of 2023 to 2026 its first-innings totals did worse
than the corrected ground average.

### Step 1: where the 17.9 missing runs came from

First innings simulated with one thing at a time replaced by what really
happened (`run.sh diagnose`):

| Cause | Runs, IPL 2023 to 2026 |
|---|---|
| Scoring level trailing behind | about 12 |
| Day-to-day pitch differences applied so as to lose runs (a flaw) | about 2 |
| Something in the simulation itself, also seen on 2019 to 2022 | 3 to 4 |
| Guessing the batting order and bowlers | about none |

### Steps 2 and 3: what each change did on 2013 to 2022

| Version | Average miss | Mean error |
|---|---|---|
| First version | 6.7 low | 23.35 |
| Pitch flaw put right | 5.6 low | 23.15 |
| + league level follows the latest matches (half as much per 60 matches) | 4.3 low | 22.94 |
| + wickets in hand | 4.2 low | 22.84 |
| New version, all settings chosen again | 4.2 low | 22.82 |
| Tuned ground average, for comparison | 1.1 low | 22.34 |

Wickets in hand made next to no difference. Set against batters from the same
part of the order, most states of an innings are within a few percent of normal,
and the tuning damped the effect almost away.

### The comparison

IPL 2023 to 2026: 283 full first innings. Internationals: 1,884. Lower errors
are better. "Average" is the tuned baseline.

| IPL, already seen | First | New | Average |
|---|---|---|---|
| Score miss, runs low | 17.9 | 11.8 | 7.0 |
| Scores inside the 80% range | 69% | 74% | |
| First innings, mean error | 31.7 | 29.8 | 28.5 |
| Player runs, mean error | 11.72 | 11.81 | 11.88 |
| Player runs, root mean square | 18.27 | 18.31 | 18.17 |
| Player wickets, mean error | 0.413 | 0.411 | 0.420 |
| Winner, log loss (50/50 is 0.693) | 0.694 | 0.694 | 0.696 |

| T20 internationals, fresh | First | New | Average |
|---|---|---|---|
| Score miss, runs low | 6.7 | 5.6 | 0.2 |
| Scores inside the 80% range | 66% | 66% | |
| First innings, mean error | 33.0 | 33.1 | 36.5 |
| Player runs, mean error | 10.38 | 10.41 | 10.51 |
| Player runs, root mean square | 15.75 | 15.82 | 15.78 |
| Player wickets, mean error | 0.525 | 0.526 | 0.541 |
| Winner, log loss, stated chance | 0.696 | 0.688 | 0.665 |

Targets met by the new version: none on the IPL. On the internationals, two:
first innings beat the ground average, and player wickets beat the tuned average
on both errors.

### What it means

- **The changes did not carry over.** On the IPL seasons that suggested them,
  scores improved by 1.8 runs of mean error. On the fresh matches scores were no
  better than the first version's, and player runs, player wickets and winners
  (before correction) were slightly worse. Player runs were worse on the IPL
  too.
- **Beating the ground average abroad is an easy bar.** It knows nothing of who
  is playing, which matters far more between uneven national sides than in the
  IPL.
- **Wickets are the one steady gain:** 2 to 3% under the tuned average on mean
  error in both sets, and 0.3% or less on root mean square.
- **Not covered by the rules:** before correction, both versions picked the
  winner of about 66% of internationals, against 59% for the team ratings. Those ratings used settings chosen on the IPL, and an earlier,
  separate check of ratings on T20 internationals since 2023 reached 63 to 65%,
  so the real margin is likely small. The IPL correction then flattened the
  simulator's chances. Testing this properly needs matches not yet looked at.

The first version still reproduces exactly (`run.sh test`). `lib/sim/params.ts`
holds the new settings; the app uses neither.
