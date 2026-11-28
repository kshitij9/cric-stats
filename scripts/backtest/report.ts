import { seeded } from '../../lib/sim/rng';
import { logLoss, mean } from './common';
import { calibrate, coverage, type Calibration, type Predicted } from './evaluate';

/**
 * The comparison, with the rules written down before the test seasons were
 * scored:
 *
 *   A measure is BEATEN only if the simulator's error is lower than the
 *   baseline's and the 95% range of the difference, from resampling matches,
 *   lies wholly below zero. Lower, with a range that includes zero, is
 *   "not shown": it could be chance.
 *
 *   winner         log loss, against 50/50 and against team ratings
 *   total, player  mean absolute error (the plan's measure), against the recent
 *                  average, both plain and with its settings tuned. Root mean
 *                  square error is shown beside it.
 */

const RESAMPLES = 10000;

/** Per match: [error summed, how many] for each of two methods. */
type Pairs = { a: [number, number][]; b: [number, number][] };

function difference({ a, b }: Pairs, finish: (x: number) => number) {
  const score = (list: [number, number][], picks: number[]) => {
    let sum = 0;
    let n = 0;
    for (const i of picks) {
      sum += list[i][0];
      n += list[i][1];
    }
    return finish(sum / n);
  };
  const everything = a.map((_, i) => i);
  const random = seeded(12345);
  const found = new Float64Array(RESAMPLES);
  for (let r = 0; r < RESAMPLES; r++) {
    const picks = everything.map(() => Math.floor(random() * a.length));
    found[r] = score(a, picks) - score(b, picks);
  }
  found.sort();
  const sim = score(a, everything);
  const base = score(b, everything);
  const low = found[Math.floor(RESAMPLES * 0.025)];
  const high = found[Math.floor(RESAMPLES * 0.975)];
  const verdict = high < 0 ? 'BEATEN' : sim < base ? 'not shown' : low > 0 ? 'WORSE' : 'not better';
  return { sim, base, difference: sim - base, low, high, verdict };
}

export type Baselines = {
  elo: Map<string, number>;
  ground: { name: string; totals: Map<string, number> }[];
  player: { name: string; values: Map<string, { runs: number; wickets: number }> }[];
};

export function report(rows: Predicted[], calibration: Calibration, baselines: Baselines) {
  const decided = rows.filter((r) => r.firstWon !== null);
  const full = rows.filter((r) => !r.shortened);
  const stated = decided.map((r) => calibrate(r.chance, calibration));
  const loss = (chances: number[]) =>
    chances.map((p, i): [number, number] => [logLoss(p, decided[i].firstWon!), 1]);
  const accuracy = (chances: number[]) =>
    mean(chances.map((p, i) => (p === 0.5 ? 0.5 : Number(p > 0.5 === (decided[i].firstWon === 1)))));
  const brier = (chances: number[]) =>
    mean(chances.map((p, i) => (p - decided[i].firstWon!) ** 2));
  const ratings = decided.map((r) => baselines.elo.get(r.id)!);
  const even = decided.map(() => 0.5);

  const winner = [
    { against: '50/50', chances: even },
    { against: 'team ratings', chances: ratings },
  ].map(({ against, chances }) => ({
    against,
    accuracy: accuracy(chances),
    brier: brier(chances),
    ...difference({ a: loss(stated), b: loss(chances) }, (x) => x),
  }));

  // the simulator's own chances, before the correction
  const simulated = decided.map((r) => r.chance);
  const uncorrected = [
    { against: '50/50', chances: even },
    { against: 'team ratings', chances: ratings },
  ].map(({ against, chances }) => ({
    against,
    ...difference({ a: loss(simulated), b: loss(chances) }, (x) => x),
  }));

  const absolute = (x: number) => x;
  const total = baselines.ground.map(({ name, totals }) => {
    const errors = (of: (r: Predicted) => number, power: number) =>
      full.map((r): [number, number] => [Math.abs(of(r) - r.actualTotal) ** power, 1]);
    const sim = (r: Predicted) => r.total;
    const base = (r: Predicted) => totals.get(r.id)!;
    return {
      against: name,
      mae: difference({ a: errors(sim, 1), b: errors(base, 1) }, absolute),
      rmse: difference({ a: errors(sim, 2), b: errors(base, 2) }, Math.sqrt),
      bias: { sim: mean(full.map((r) => sim(r) - r.actualTotal)), base: mean(full.map((r) => base(r) - r.actualTotal)) },
    };
  });

  const players = (['runs', 'wickets'] as const).flatMap((figure) =>
    baselines.player.map(({ name, values }) => {
      const errors = (fromSim: boolean, power: number) =>
        full.map((r): [number, number] => [
          r.players.reduce((sum, p) => {
            const said = fromSim ? p[figure] : values.get(`${r.id} ${p.id}`)![figure];
            const seen = figure === 'runs' ? p.actualRuns : p.actualWickets;
            return sum + Math.abs(said - seen) ** power;
          }, 0),
          r.players.length,
        ]);
      return {
        figure,
        against: name,
        mae: difference({ a: errors(true, 1), b: errors(false, 1) }, absolute),
        rmse: difference({ a: errors(true, 2), b: errors(false, 2) }, Math.sqrt),
        bias: mean(
          full.flatMap((r) =>
            r.players.map((p) => p[figure] - (figure === 'runs' ? p.actualRuns : p.actualWickets)),
          ),
        ),
      };
    }),
  );

  // do sides given 60% win about 60% of the time? Seen from the favourite's side
  const bands = [0.5, 0.55, 0.6, 0.65, 0.7, 1.01];
  const calibrationTable = bands.slice(0, -1).map((low, i) => {
    const inBand = stated.flatMap((p, j) => {
      const favourite = Math.max(p, 1 - p);
      if (favourite < low || favourite >= bands[i + 1]) return [];
      const won = p >= 0.5 ? decided[j].firstWon! : 1 - decided[j].firstWon!;
      return [{ favourite, won }];
    });
    return {
      band: `${Math.round(low * 100)}-${Math.min(100, Math.round(bands[i + 1] * 100))}%`,
      matches: inBand.length,
      said: inBand.length ? mean(inBand.map((x) => x.favourite)) : null,
      happened: inBand.length ? mean(inBand.map((x) => x.won)) : null,
    };
  });

  const seasons = [...new Set(rows.map((r) => r.season))].map((season) => {
    const d = decided.map((r, i) => ({ r, i })).filter((x) => x.r.season === season);
    const f = full.filter((r) => r.season === season);
    return {
      season,
      matches: d.length,
      logLoss: mean(d.map((x) => logLoss(stated[x.i], x.r.firstWon!))),
      ratingsLogLoss: mean(d.map((x) => logLoss(ratings[x.i], x.r.firstWon!))),
      totalBias: mean(f.map((r) => r.total - r.actualTotal)),
    };
  });

  return {
    counts: { predicted: rows.length, withResult: decided.length, fullLength: full.length },
    winner,
    // with a slope of 0 every match is given the same chance: no prediction at all
    correction: calibration,
    uncorrected: { accuracy: accuracy(simulated), brier: brier(simulated), winner: uncorrected },
    accuracy: accuracy(stated),
    brier: brier(stated),
    total,
    players,
    calibration: calibrationTable,
    coverage80: coverage(rows),
    spreadOfStatedChances: [Math.min(...stated), Math.max(...stated)],
    seasons,
  };
}
