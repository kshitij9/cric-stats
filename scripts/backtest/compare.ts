import { CALIBRATION, PARAMS } from '../../lib/sim/params';
import type { PastMatch } from '../../lib/sim/types';
import { elo, groundAverage, playerAverages } from './baselines';
import { TEST } from './common';
import { evaluate } from './evaluate';
import {
  CALIBRATION_V1,
  ELO_V2,
  GROUND_PLAIN,
  GROUND_V2,
  PARAMS_V1,
  PLAYER_PLAIN,
  PLAYER_V2,
} from './frozen';
import { report } from './report';

/**
 * The first and new versions side by side on matches neither was chosen from,
 * against the same baselines, with the targets and the stop rule of
 * docs/simulator-improvement.md applied.
 */
export function compare(matches: PastMatch[], sims: number) {
  const [first, second] = [PARAMS_V1, PARAMS].map(
    (params) => evaluate(matches, TEST, [params], sims)[0],
  );
  const players = playerAverages(matches, TEST, [PLAYER_PLAIN, PLAYER_V2]);
  const baselines = {
    elo: elo(matches, TEST, ELO_V2),
    ground: [
      { name: 'ground, plain', totals: groundAverage(matches, TEST, GROUND_PLAIN) },
      { name: 'ground, corrected', totals: groundAverage(matches, TEST, GROUND_V2) },
    ],
    player: [
      { name: 'player, plain', values: players[0] },
      { name: 'player, corrected', values: players[1] },
    ],
  };
  return [
    { version: 'first', rows: first, result: report(first, CALIBRATION_V1, baselines) },
    { version: 'new', rows: second, result: report(second, CALIBRATION, baselines) },
  ];
}

type Result = ReturnType<typeof report>;

const players = (r: Result, figure: 'runs' | 'wickets') =>
  r.players.find((p) => p.figure === figure && p.against === 'player, corrected')!;

/** Each target, as met or not. */
export function targets(r: Result) {
  const total = r.total.find((t) => t.against === 'ground, corrected')!;
  const runs = players(r, 'runs');
  const wickets = players(r, 'wickets');
  return {
    'score bias within 3 runs': Math.abs(total.bias.sim) <= 3,
    '75-85% of scores inside the range': r.coverage80 >= 0.75 && r.coverage80 <= 0.85,
    'first innings beats corrected ground average': total.mae.verdict === 'BEATEN',
    'player runs beat corrected average, both errors':
      runs.mae.verdict === 'BEATEN' && runs.rmse.verdict === 'BEATEN',
    'player wickets beat corrected average, both errors':
      wickets.mae.verdict === 'BEATEN' && wickets.rmse.verdict === 'BEATEN',
    'win chance beats 50/50 and team ratings':
      r.correction.slope > 0 && r.winner.every((w) => w.verdict === 'BEATEN'),
  };
}

/** Carry on only if both beat on the fresh check, and the IPL shows neither worse. */
export function carryOn(fresh: Result, ipl: Result) {
  const t = targets(fresh);
  const total = ipl.total.find((x) => x.against === 'ground, corrected')!;
  const runs = players(ipl, 'runs');
  return (
    t['first innings beats corrected ground average'] &&
    t['player runs beat corrected average, both errors'] &&
    [total.mae, runs.mae, runs.rmse].every((m) => m.verdict !== 'WORSE')
  );
}
