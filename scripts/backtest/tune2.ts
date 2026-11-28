import { PARAMS_V1 } from './frozen';
import type { Params } from '../../lib/sim/model';
import type { PastMatch } from '../../lib/sim/types';
import {
  eachPlayerAverage,
  groundAverage,
  tuneElo,
  type GroundParams,
  type PlayerParams,
} from './baselines';
import { actual, logLoss, mae, mean, rmse, type Period } from './common';
import { calibrate, coverage, evaluate, fitCalibration } from './evaluate';
import { CHOICES, ballLoss, tuneBalls, type Choices } from './tune';

/**
 * The second round (docs/simulator-improvement.md). Everything is chosen on the
 * IPL of 2013 to 2022, a span with several changes of scoring level; the matches
 * passed in must stop there.
 */
export const TUNE2: Period = { from: 2013, to: 2022 };
const SIMS = 1000;

const LEVELS = [15, 30, 60, 120, 240, Infinity];
const SPREADS = [0, 0.1, 0.15, 0.2, 0.25];

/** How well each setting's simulated first-innings totals fit what was seen. */
function totals(matches: PastMatch[], settings: Params[]) {
  return evaluate(matches, TUNE2, settings, SIMS).map((rows) => {
    const full = rows.filter((r) => !r.shortened);
    return {
      crps: mean(full.map((r) => r.crps)),
      bias: mean(full.map((r) => r.total - r.actualTotal)),
      mae: mae(full.map((r) => r.total - r.actualTotal)),
      coverage80: coverage(rows),
      rows,
    };
  });
}

function pick<K extends keyof Params>(matches: PastMatch[], base: Params, key: K, values: Params[K][]) {
  const results = totals(
    matches,
    values.map((v) => ({ ...base, [key]: v })),
  );
  console.log(`totals by ${key}:`);
  console.table(
    results.map(({ crps, bias, mae, coverage80 }, i) => ({
      value: String(values[i]),
      crps,
      bias,
      mae,
      coverage80,
    })),
  );
  const best = results.reduce((b, r, i) => (r.crps < results[b].crps ? i : b), 0);
  console.log(`  -> ${key} ${values[best]}`);
  return { ...base, [key]: values[best] };
}

function tuneGround(matches: PastMatch[]) {
  const full = matches.filter((m) => m.season >= TUNE2.from && !m.shortened);
  const all: GroundParams[] = [];
  for (const count of [5, 10, 20, 40, 80]) {
    for (const weight of [0, 1, 3, 10, 30]) {
      for (const league of [20, 40, 74]) all.push({ matches: count, league, weight });
      for (const level of [10, 20, 40, 80, 160]) {
        all.push({ matches: count, league: 0, weight, level });
      }
    }
  }
  const scored = all.map((params) => {
    const said = groundAverage(matches, TUNE2, params);
    const errors = full.map((m) => said.get(m.id)! - actual(m).totals[0]);
    return { params, mae: mae(errors), rmse: rmse(errors), bias: mean(errors) };
  });
  const least = { mae: Math.min(...scored.map((s) => s.mae)), rmse: Math.min(...scored.map((s) => s.rmse)) };
  const score = (s: (typeof scored)[number]) => s.mae / least.mae + s.rmse / least.rmse;
  const best = (list: typeof scored) => list.reduce((a, b) => (score(b) < score(a) ? b : a));
  return {
    tuned: best(scored),
    uncorrected: best(scored.filter((s) => s.params.level === undefined)),
  };
}

function tunePlayers(matches: PastMatch[]) {
  const all: PlayerParams[] = [];
  for (const count of [10, 20, 40]) {
    for (const weight of [2, 5, 10, 20, 40]) {
      all.push({ matches: count, weight });
      for (const level of [20, 40, 80, 160]) all.push({ matches: count, weight, level });
    }
  }
  const sums = all.map(() => ({ n: 0, runs: 0, runs2: 0, wickets: 0, wickets2: 0 }));
  const happened = new Map(
    matches.filter((m) => !m.shortened).map((m) => [m.id, actual(m).players]),
  );
  eachPlayerAverage(matches, TUNE2, all, (i, m, id, said) => {
    const seen = happened.get(m.id)?.get(id);
    if (!seen) return;
    const s = sums[i];
    s.n += 1;
    s.runs += Math.abs(said.runs - seen.runs);
    s.runs2 += (said.runs - seen.runs) ** 2;
    s.wickets += Math.abs(said.wickets - seen.wickets);
    s.wickets2 += (said.wickets - seen.wickets) ** 2;
  });
  const scored = sums.map((s, i) => ({
    params: all[i],
    runs: s.runs / s.n,
    runsRmse: Math.sqrt(s.runs2 / s.n),
    wickets: s.wickets / s.n,
    wicketsRmse: Math.sqrt(s.wickets2 / s.n),
  }));
  // one setting for all four errors: the smallest sum of each relative to its best
  const keys = ['runs', 'runsRmse', 'wickets', 'wicketsRmse'] as const;
  const least = keys.map((k) => Math.min(...scored.map((s) => s[k])));
  const score = (s: (typeof scored)[number]) => keys.reduce((sum, k, i) => sum + s[k] / least[i], 0);
  const best = (list: typeof scored) => list.reduce((a, b) => (score(b) < score(a) ? b : a));
  return {
    tuned: best(scored),
    uncorrected: best(scored.filter((s) => s.params.level === undefined)),
  };
}

export function tuneSecond(matches: PastMatch[]) {
  if (matches.some((m) => m.season > TUNE2.to)) throw new Error('later seasons must be left out');

  // the flaw found in step 1 is simply put right
  let params: Params = { ...PARAMS_V1, dayCentred: true };
  params = pick(matches, params, 'levelMatches', LEVELS);
  params = pick(matches, params, 'daySpread', SPREADS);

  // the rest, by single balls; step 3 is wicketsK
  const choices: Choices = [
    ['wicketsK', [Infinity, 0, 250, 1000, 4000]],
    // byInnings sets the level the first innings is played at, so totals choose it
    ...CHOICES.filter(
      ([key]) =>
        key !== 'byInnings' && !(key === 'leagueHalfLife' && isFinite(params.levelMatches)),
    ),
  ];
  const balls = tuneBalls(matches, { start: params, choices, period: TUNE2 });
  params = balls.params;
  const [without] = ballLoss(matches, [{ ...params, wicketsK: Infinity }], TUNE2).loss;
  console.log(`single balls: ${balls.loss.toFixed(6)}; without wickets in hand ${without.toFixed(6)}`);

  params = pick(matches, params, 'byInnings', [false, true]);
  params = pick(matches, params, 'levelMatches', LEVELS);
  params = pick(matches, params, 'daySpread', SPREADS);

  // what each change is worth on these seasons, one added at a time
  const stages: [string, Params][] = [
    ['first version', PARAMS_V1],
    ['day difference put right', { ...PARAMS_V1, dayCentred: true }],
    ['+ level follows matches', { ...PARAMS_V1, dayCentred: true, levelMatches: params.levelMatches, daySpread: params.daySpread }],
    ['+ wickets in hand', { ...PARAMS_V1, dayCentred: true, levelMatches: params.levelMatches, daySpread: params.daySpread, wicketsK: params.wicketsK }],
    ['new version (all re-chosen)', params],
  ];
  const results = totals(matches, stages.map(([, p]) => p));
  const loss = ballLoss(matches, stages.map(([, p]) => p), TUNE2).loss;
  const steps = stages.map(([version], i) => {
    const { crps, bias, mae, coverage80 } = results[i];
    return { version, bias, mae, crps, coverage80, ballLoss: loss[i] };
  });
  console.log('each change on 2013-2022:');
  console.table(steps);

  const decided = results.at(-1)!.rows.filter((r) => r.firstWon !== null);
  const calibration = fitCalibration(
    decided.map((r) => r.chance),
    decided.map((r) => r.firstWon!),
  );
  const winner = {
    raw: mean(decided.map((r) => logLoss(r.chance, r.firstWon!))),
    corrected: mean(decided.map((r) => logLoss(calibrate(r.chance, calibration), r.firstWon!))),
  };

  return {
    params,
    calibration,
    winner,
    steps,
    elo: tuneElo(matches, TUNE2),
    ground: tuneGround(matches),
    players: tunePlayers(matches),
  };
}
