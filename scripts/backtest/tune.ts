import { OUTCOMES, phaseOf } from '../../lib/sim/outcomes';
import { pressureBand } from '../../lib/sim/history';
import { Model, type Params } from '../../lib/sim/model';
import type { PastMatch } from '../../lib/sim/types';
import { TUNE, walk } from './common';

/**
 * The simulator's settings are chosen by how well they predict single balls of
 * the tuning seasons (the average of -log of the chance given to what happened).
 * There are some sixty thousand balls a season, so this tells settings apart far
 * better than a few hundred match results could.
 */

export const START: Params = {
  halfLife: 2,
  leagueHalfLife: 1,
  batterRunsK: 250,
  batterWicketK: 400,
  bowlerRunsK: 250,
  bowlerWicketK: 600,
  groundK: 3000,
  pairK: Infinity,
  byInnings: false,
  pressureK: Infinity,
  recentMatches: 20,
  daySpread: 0,
};

export function ballLoss(matches: PastMatch[], settings: Params[]) {
  const loss = settings.map(() => 0);
  let balls = 0;
  const p = new Float64Array(OUTCOMES);
  walk(matches, TUNE, (history, day) => {
    const models = settings.map((s) => new Model(history, day[0].season, s));
    for (const match of day) {
      let innings = 0;
      let scored = 0;
      let legal = 0;
      let target = 0;
      for (const ball of match.balls) {
        if (ball.innings !== innings) {
          if (innings === 1) target = scored + 1;
          innings = ball.innings;
          scored = 0;
          legal = 0;
        }
        const band = innings === 2 && target ? pressureBand(target - scored, 120 - legal) : -1;
        models.forEach((model, i) => {
          model.chances(p, ball.batter, ball.bowler, match.venueId, phaseOf(ball.over), innings, band);
          loss[i] -= Math.log(Math.max(p[ball.outcome], 1e-9));
        });
        balls += 1;
        scored += ball.runs;
        if (ball.legal) legal += 1;
      }
    }
  });
  return { balls, loss: loss.map((l) => l / balls) };
}

const CHOICES: [keyof Params, (number | boolean)[]][] = [
  ['leagueHalfLife', [0.25, 0.5, 1, 2, 4]],
  ['halfLife', [0.75, 1, 1.5, 2, 3, 5, 10]],
  ['batterRunsK', [60, 120, 250, 500, 1000, 2000]],
  ['batterWicketK', [100, 200, 400, 800, 1600, 3200]],
  ['bowlerRunsK', [60, 120, 250, 500, 1000, 2000]],
  ['bowlerWicketK', [150, 300, 600, 1200, 2400, 4800]],
  ['groundK', [300, 1000, 3000, 10000, 30000, Infinity]],
  ['recentMatches', [10, 20, 40]],
  ['byInnings', [false, true]],
  ['pressureK', [Infinity, 0, 500, 2000, 8000]],
  ['pairK', [Infinity, 100, 300, 1000, 3000]],
];

/** One setting at a time, keeping the best, until a round changes nothing. */
export function tuneBalls(matches: PastMatch[]) {
  let best = { ...START };
  let bestLoss = ballLoss(matches, [best]).loss[0];
  console.log(`start: ${bestLoss.toFixed(6)}`);
  const trials: Record<string, [string, number][]> = {};
  for (let round = 1; round <= 3; round++) {
    let changed = false;
    for (const [key, values] of CHOICES) {
      const settings = values.map((v) => ({ ...best, [key]: v }) as Params);
      const { loss } = ballLoss(matches, settings);
      trials[key] = values.map((v, i) => [String(v), loss[i]]);
      const i = loss.indexOf(Math.min(...loss));
      if (loss[i] < bestLoss - 1e-6) {
        changed ||= best[key] !== values[i];
        best = settings[i];
        bestLoss = loss[i];
      }
      console.log(
        `round ${round} ${key}: ${values.map((v, j) => `${v}=${loss[j].toFixed(6)}`).join('  ')}  -> ${best[key]}`,
      );
    }
    if (!changed) break;
  }
  return { params: best, loss: bestLoss, trials };
}
