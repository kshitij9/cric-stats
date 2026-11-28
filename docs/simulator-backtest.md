# CricIntell: how the match simulator did

Run on 27 November 2026, data to 25 November 2026.

## Verdict

**Show no win percentage.** On the IPL seasons 2023 to 2026 the simulator's
chances were no better than a coin flip. Its scores ran 18 runs low. Only its
player wickets beat the recent average on the measure the plan set, and by
little.

## How it was tested

- 293 matches of 2023 to 2026, in date order. Each is predicted from matches on
  earlier days only.
- Known to it: the players named, which side batted first, and the ground. Not
  known: batting order and who bowled when, which come from earlier matches.
- Every setting, the simulator's and the baselines', was chosen on 2019 to 2022.
  They were then frozen (`lib/sim/params.ts`, `scripts/backtest/frozen.ts`) and
  2023 to 2026 was scored with them. Running it again gives the same output.
- A measure counts as **beaten** only if the simulator's error is lower and the
  95% range of the difference, from resampling matches, excludes zero.
- Two baselines for scores and players: the plain recent average the plan named,
  and a tuned one that mixes in the league average.

## Results

Lower is better in every column of errors.

### Winner (288 matches with a result)

| | Log loss | Against the simulator |
|---|---|---|
| Simulator, stated chance | 0.6937 | |
| Always 50/50 | 0.6931 | not better |
| Team ratings (Elo) | 0.6935 | not better |
| Simulator, uncorrected chance | 0.7145 | worse than 50/50 |

The stated chance is the same for every match: 45% to the side batting first. On
2019 to 2022 the simulated chances bore no relation to who won, so the fitted
correction removed them entirely. Uncorrected, on 2023 to 2026, they picked the
winner 46% of the time.

The team ratings did no better than 50/50 either. Neither method found anything
in past IPL matches that says who will win.

### First-innings total (283 full matches)

| | Mean error | Root mean square | Average miss |
|---|---|---|---|
| Simulator | 31.7 | 39.3 | 17.9 low |
| Ground's recent average | 31.7 (not shown) | 39.4 (not shown) | 16.8 low |
| The same, tuned | 30.5 (simulator worse) | 37.8 (worse) | 13.0 low |

The simulated 10th to 90th percentile range held the real score 69% of the time;
it should be 80%.

### Players (6,773 named player-matches)

| Runs | Mean error | Root mean square |
|---|---|---|
| Simulator | 11.72 | 18.27 |
| Recent average | 11.74 (not shown) | 18.31 (not shown) |
| The same, tuned | 11.85 (beaten) | 18.15 (simulator worse) |

| Wickets | Mean error | Root mean square |
|---|---|---|
| Simulator | 0.413 | 0.725 |
| Recent average | 0.430 (beaten) | 0.749 (beaten) |
| The same, tuned | 0.419 (beaten) | 0.725 (not shown) |

Runs: no better than a player's recent average. Wickets: 4% better than the
plain average and 2% better than the tuned one on mean error, with nothing
between it and the tuned one on the other measure.

## Is the machinery right?

`scripts/backtest/run.sh checks`, all passing:

- Balls faced and runs of all 741 batters match the database, and each of
  295,557 deliveries is counted once.
- 48,000 simulated innings kept the rules: 120 balls, ten wickets, four overs a
  bowler, nobody twice running, a chase stopping at the target.
- 12 predictions were identical with the match and everything later removed, and
  all 12 changed once their own match was added.

Also seen on 2019 to 2022, with a one-off script that was not kept (and no
day-to-day pitch difference): a deliberately strong side beat a weak one more than
99.9% of the time, identical sides came out near even, and the chances given to
single balls were close to what happened (runs a ball 1.335 against 1.347 in
first innings). So the weak result is not an obvious fault in the machinery.

One matchup, 10,000 simulations: about 0.5 s, after about 3 s to read and count
the history once.

## Why it falls short

These are likely reasons, not tested ones.

- **Winners:** differences between IPL sides seem small beside the luck of one
  match. The ratings baseline found nothing either.
- **Scores:** IPL scoring jumped in 2023, and league rates that still weigh
  earlier seasons trail behind (17 to 20 runs low in each season). Not all of it
  is the era: on 2019 to 2022 the totals were already 6 runs low, 4 without the
  day-to-day pitch difference. Balls are drawn without regard to wickets in hand,
  which may account for some.

## What was chosen on 2019 to 2022

| Setting | Value |
|---|---|
| Weight on older seasons, players and grounds | halves every 3 years |
| The same, league rates | every 2 years |
| Imaginary balls pulling a record toward usual: batting, batting wickets | 250, 400 |
| Bowling, bowling wickets | 250, 2,400 |
| Ground | 1,000 balls |
| Head-to-head | on, 300 balls |
| Separate rates for the second innings, and chase pressure | on |
| Matches that set batting position and bowling use | latest 10 |
| Difference between one day's pitch and another's | 0.2 |

## Where this differs from the plan

- Settings were chosen by how well single balls are predicted, not by match
  results, which are too few to tell settings apart.
- Head-to-head and chase pressure are in because they improved that measure
  (slightly: by 0.00015 and 0.0014 in log loss). They were not judged on the
  match measures above.
- A difference between one day's pitch and another's was added, its size chosen
  by how well the spread of totals fitted 2019 to 2022.
- The correction was barred from reversing the simulated chances. This was
  decided after seeing 2019 to 2022 and before scoring 2023 to 2026.
- "Beaten" requires the 95% range to exclude zero, which the plan did not say.
- From 2023 the named players include the impact substitute, chosen during the
  match, so the test knows slightly more than anyone could beforehand.

## Using 2023 to 2026 again

These seasons have now been looked at. A change made because of the results above
can still be tried on them, but they no longer give a fair test of it. The next
untouched evidence is the 2027 season.

## Running it

```bash
export COMPOSE_PROJECT_NAME=cric-stats
./scripts/backtest/run.sh checks
./scripts/backtest/run.sh tune     # several minutes
./scripts/backtest/run.sh test     # about 2.5 minutes
./scripts/backtest/run.sh speed
```

It reads `cricket_next` (set `BACKTEST_DB` for another) and writes only to
`scripts/backtest/out/`.
