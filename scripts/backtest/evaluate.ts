import { History } from '../../lib/sim/history';
import { Model, type Params } from '../../lib/sim/model';
import { predict } from '../../lib/sim/predict';
import type { PastMatch } from '../../lib/sim/types';
import { actual, firstWon, fixtureOf, mean, seedOf, walk, type Period } from './common';

/** The simulator's prediction of each match of a period, beside what happened. */
export type Predicted = {
  id: string;
  season: number;
  shortened: boolean;
  firstWon: number | null;
  chance: number; // that the side batting first wins, as simulated
  total: number; // mean first-innings total
  actualTotal: number;
  quantiles: [number, number]; // 10th and 90th of the simulated totals
  crps: number; // distance between the spread of totals and the one seen
  players: { id: string; runs: number; wickets: number; actualRuns: number; actualWickets: number }[];
};

/** Continuous ranked probability score of the simulated totals (lower is better). */
function crps(totals: Int16Array, seen: number) {
  const sorted = Array.from(totals).sort((a, b) => a - b);
  const n = sorted.length;
  let apart = 0;
  let spread = 0;
  for (let i = 0; i < n; i++) {
    apart += Math.abs(sorted[i] - seen);
    spread += sorted[i] * (2 * i - n + 1);
  }
  return { score: apart / n - spread / (n * n), sorted };
}

export function evaluate(
  matches: PastMatch[],
  period: Period,
  settings: Params[],
  sims: number,
): Predicted[][] {
  const out: Predicted[][] = settings.map(() => []);
  walk(matches, period, (history: History, day) => {
    const models = settings.map((s) => new Model(history, day[0].season, s));
    for (const match of day) {
      const fixture = fixtureOf(match);
      // a few internationals list too few players to play a match with
      if (!fixture || fixture.first.length < 11 || fixture.second.length < 11) continue;
      const happened = actual(match);
      settings.forEach((params, i) => {
        const result = predict(history, params, fixture, {
          sims,
          seed: seedOf(match.id),
          model: models[i],
        });
        const { score, sorted } = crps(result.first.totals, happened.totals[0]);
        out[i].push({
          id: match.id,
          season: match.season,
          shortened: match.shortened,
          firstWon: firstWon(match),
          chance: result.firstWins,
          total: result.first.mean,
          actualTotal: happened.totals[0],
          quantiles: [sorted[Math.floor(sims * 0.1)], sorted[Math.floor(sims * 0.9)]],
          crps: score,
          players: result.players.flat().map((p) => ({
            id: p.id,
            runs: p.runs,
            wickets: p.wickets,
            actualRuns: happened.players.get(p.id)!.runs,
            actualWickets: happened.players.get(p.id)!.wickets,
          })),
        });
      });
    }
  });
  return out;
}

export const coverage = (rows: Predicted[]) =>
  mean(
    rows
      .filter((r) => !r.shortened)
      .map((r) => Number(r.actualTotal >= r.quantiles[0] && r.actualTotal <= r.quantiles[1])),
  );

// ---- turning simulated chances into stated ones ----------------------------

export type Calibration = { slope: number; shift: number };

const logit = (p: number) => {
  const q = Math.min(0.999, Math.max(0.001, p));
  return Math.log(q / (1 - q));
};

export const calibrate = (p: number, c: Calibration) =>
  1 / (1 + Math.exp(-(c.slope * logit(p) + c.shift)));

/**
 * Logistic correction, fitted on the tuning seasons: pulls overconfident chances
 * toward even, and allows for a lean toward one innings. It may flatten the
 * simulator's chances to nothing (slope 0: every match the same) but never turn
 * them round, which a fit to a few hundred matches can ask for by chance.
 */
export function fitCalibration(chances: number[], won: number[]): Calibration {
  const free = newton(chances, won);
  if (free.slope >= 0) return free;
  const share = won.reduce((a, b) => a + b, 0) / won.length;
  return { slope: 0, shift: logit(share) };
}

/** The best fit with nothing ruled out, by Newton's method. */
function newton(chances: number[], won: number[]): Calibration {
  let slope = 1;
  let shift = 0;
  for (let step = 0; step < 50; step++) {
    let g1 = 0;
    let g2 = 0;
    let h11 = 1e-9;
    let h12 = 0;
    let h22 = 1e-9;
    chances.forEach((chance, i) => {
      const x = logit(chance);
      const p = 1 / (1 + Math.exp(-(slope * x + shift)));
      g1 += (p - won[i]) * x;
      g2 += p - won[i];
      const w = p * (1 - p);
      h11 += w * x * x;
      h12 += w * x;
      h22 += w;
    });
    const det = h11 * h22 - h12 * h12;
    slope -= (h22 * g1 - h12 * g2) / det;
    shift -= (h11 * g2 - h12 * g1) / det;
  }
  return { slope, shift };
}
