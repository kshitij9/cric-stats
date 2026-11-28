/**
 * The simulator's backtest.
 *
 *   ./scripts/backtest/run.sh tune     choose settings on 2019-2022 (about 10 min)
 *   ./scripts/backtest/run.sh checks   is the machinery right?
 *   ./scripts/backtest/run.sh test     score 2023-2026 with the frozen settings
 *   ./scripts/backtest/run.sh speed    how long one matchup takes
 *
 * `tune` only prints and saves what it chooses. To use it, copy it into
 * lib/sim/params.ts and scripts/backtest/frozen.ts, and run `test` afterwards.
 * Do not change either in the light of a test result: the test then no longer
 * measures how the simulator does on matches it has not been fitted to.
 */
import { writeFileSync } from 'node:fs';
import { Pool, types } from 'pg';
import { loadMatches, type Query } from '../../lib/sim/data';
import { History } from '../../lib/sim/history';
import { CALIBRATION, PARAMS } from '../../lib/sim/params';
import { predict } from '../../lib/sim/predict';
import { elo, groundAverage, playerAverages, tuneElo, type GroundParams, type PlayerParams } from './baselines';
import { checks } from './checks';
import { TEST, TUNE, firstWon, fixtureOf, logLoss, mae, mean, rmse, actual, type Period } from './common';
import { calibrate, coverage, evaluate, fitCalibration } from './evaluate';
import { ELO, GROUND, GROUND_PLAIN, PLAYER, PLAYER_PLAIN } from './frozen';
import { report } from './report';
import { tuneBalls } from './tune';
import type { PastMatch } from '../../lib/sim/types';

types.setTypeParser(20, Number);

const json = (value: unknown) =>
  JSON.stringify(value, (_, v) => (v === Infinity ? 'Infinity' : v), 1);

function tuneGround(matches: PastMatch[], period: Period) {
  const full = matches.filter((m) => m.season >= period.from && m.season <= period.to && !m.shortened);
  const score = (p: GroundParams) => {
    const totals = groundAverage(matches, period, p);
    const errors = full.map((m) => totals.get(m.id)! - actual(m).totals[0]);
    return { mae: mae(errors), rmse: rmse(errors) };
  };
  const all: GroundParams[] = [];
  for (const m of [5, 10, 20, 40, 80]) {
    for (const league of [20, 40, 74]) {
      for (const weight of [0, 1, 3, 10, 30]) all.push({ matches: m, league, weight });
    }
  }
  const scored = all.map((params) => ({ params, ...score(params) }));
  const best = (list: typeof scored) => list.reduce((a, b) => (b.mae < a.mae ? b : a));
  return { tuned: best(scored), plain: best(scored.filter((s) => s.params.weight === 0)) };
}

function tunePlayers(matches: PastMatch[], period: Period) {
  const all: PlayerParams[] = [];
  for (const m of [5, 10, 20, 40]) {
    for (const weight of [0, 1, 2, 5, 10, 20]) all.push({ matches: m, weight });
  }
  const values = playerAverages(matches, period, all);
  const full = matches.filter((m) => m.season >= period.from && m.season <= period.to && !m.shortened);
  const scored = all.map((params, i) => {
    const runs: number[] = [];
    const wickets: number[] = [];
    for (const m of full) {
      const happened = actual(m).players;
      for (const id of m.named.flat()) {
        const said = values[i].get(`${m.id} ${id}`)!;
        runs.push(said.runs - happened.get(id)!.runs);
        wickets.push(said.wickets - happened.get(id)!.wickets);
      }
    }
    return { params, runs: mae(runs), wickets: mae(wickets), runsRmse: rmse(runs), wicketsRmse: rmse(wickets) };
  });
  // one setting for both: the smallest errors relative to the best of each
  const least = {
    runs: Math.min(...scored.map((s) => s.runs)),
    wickets: Math.min(...scored.map((s) => s.wickets)),
  };
  const best = (list: typeof scored) =>
    list.reduce((a, b) =>
      b.runs / least.runs + b.wickets / least.wickets < a.runs / least.runs + a.wickets / least.wickets ? b : a,
    );
  return { tuned: best(scored), plain: best(scored.filter((s) => s.params.weight === 0)) };
}

async function main() {
  const step = process.argv[2];
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const query: Query = async <T>(sql: string) => (await pool.query(sql)).rows as T[];
  const started = Date.now();
  const matches = await loadMatches(query);
  const loaded = Date.now() - started;
  console.log(`${matches.length} matches loaded in ${(loaded / 1000).toFixed(1)} s`);

  if (step === 'tune') {
    // the test seasons are taken out altogether, so nothing here can see them
    const seen = matches.filter((m) => m.season <= TUNE.to);
    const balls = tuneBalls(seen);
    console.log('chosen on single balls:', json(balls.params));
    const spreads = [0, 0.05, 0.1, 0.15, 0.2, 0.3];
    const settings = spreads.map((daySpread) => ({ ...balls.params, daySpread }));
    const runs = evaluate(seen, TUNE, settings, 2000);
    const scored = runs.map((rows, i) => {
      const full = rows.filter((r) => !r.shortened);
      const decided = rows.filter((r) => r.firstWon !== null);
      const c = fitCalibration(decided.map((r) => r.chance), decided.map((r) => r.firstWon!));
      return {
        daySpread: spreads[i],
        crps: mean(full.map((r) => r.crps)),
        coverage80: coverage(rows),
        totalBias: mean(full.map((r) => r.total - r.actualTotal)),
        rawLogLoss: mean(decided.map((r) => logLoss(r.chance, r.firstWon!))),
        calibration: c,
        calibratedLogLoss: mean(decided.map((r) => logLoss(calibrate(r.chance, c), r.firstWon!))),
      };
    });
    console.table(scored.map(({ calibration, ...s }) => ({ ...s, ...calibration })));
    // the spread whose range of totals sits closest to what was seen
    const chosen = scored.reduce((a, b) => (b.crps < a.crps ? b : a));
    const ratings = tuneElo(seen, TUNE);
    const ground = tuneGround(seen, TUNE);
    const players = tunePlayers(seen, TUNE);
    const tuned = {
      params: { ...balls.params, daySpread: chosen.daySpread },
      calibration: chosen.calibration,
      elo: ratings,
      ground,
      players,
      simulator: chosen,
      ballTrials: balls.trials,
      ballLoss: balls.loss,
    };
    writeFileSync('out/tuned.json', json(tuned));
    console.log(json({ ...tuned, ballTrials: undefined }));
  } else if (step === 'checks') {
    if (!(await checks(matches, query, PARAMS))) process.exitCode = 1;
  } else if (step === 'test') {
    const [rows] = evaluate(matches, TEST, [PARAMS], 10000);
    const plain = playerAverages(matches, TEST, [PLAYER_PLAIN, PLAYER]);
    const result = report(rows, CALIBRATION, {
      elo: elo(matches, TEST, ELO),
      ground: [
        { name: 'ground’s recent average', totals: groundAverage(matches, TEST, GROUND_PLAIN) },
        { name: 'the same, tuned', totals: groundAverage(matches, TEST, GROUND) },
      ],
      player: [
        { name: 'player’s recent average', values: plain[0] },
        { name: 'the same, tuned', values: plain[1] },
      ],
    });
    writeFileSync('out/test.json', json({ result, rows }));
    console.log(json(result));
  } else if (step === 'speed') {
    const history = new History();
    const built = Date.now();
    for (const m of matches) history.add(m);
    console.log(`history built in ${Date.now() - built} ms`);
    const last = matches.filter((m) => fixtureOf(m) && firstWon(m) !== null).at(-1)!;
    for (const sims of [2000, 5000, 10000]) {
      const times = [0, 1, 2, 3].map((seed) => {
        const t = Date.now();
        predict(history, PARAMS, fixtureOf(last)!, { sims, seed });
        return Date.now() - t;
      });
      console.log(`${sims} simulations: ${times.join(', ')} ms`);
    }
  } else {
    console.error('usage: run.sh tune | checks | test | speed');
    process.exitCode = 1;
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
