import { simulate } from '../../lib/sim/engine';
import { History, type League } from '../../lib/sim/history';
import { Model, type Params } from '../../lib/sim/model';
import { OUTCOMES, SIX, WICKET, phaseOf } from '../../lib/sim/outcomes';
import { sideFrom } from '../../lib/sim/sides';
import type { PastMatch, SideInput } from '../../lib/sim/types';
import { actual, fixtureOf, mean, seedOf, walk, type Period } from './common';

/**
 * Where do the missing runs go? The first innings of each match, simulated with
 * one thing after another replaced by what really happened. Those versions know
 * things no prediction could, and are only for explaining.
 */

/** The sides as they really lined up: batting order, and who bowled each over. */
function asPlayed(side: SideInput, match: PastMatch, battingInnings: number): SideInput {
  const batted: string[] = [];
  const overs: (string | undefined)[] = new Array(20).fill(undefined);
  for (const ball of match.balls) {
    if (ball.innings === battingInnings) {
      for (const id of [ball.batter, ball.nonStriker]) {
        if (side.order.includes(id) && !batted.includes(id)) batted.push(id);
      }
    } else if (side.order.includes(ball.bowler)) {
      overs[ball.over] ??= ball.bowler;
    }
  }
  return { ...side, order: [...batted, ...side.order.filter((id) => !batted.includes(id))], overs };
}

export function diagnose(matches: PastMatch[], period: Period, params: Params, sims: number) {
  // each season's own scoring, whole: known only once it is over
  const wholeSeason = new Map<number, League>();
  const all = new History();
  for (const m of matches) all.add(m);
  for (const [season, league] of all.league) wholeSeason.set(season, league);

  const versions = [
    'as tested',
    'no difference between days',
    'real batting order and bowlers',
    'real scoring level of the season',
    'real level, order and bowlers',
  ];
  const misses = versions.map(() => [] as number[]);
  const wickets = versions.map(() => [] as number[]);
  const seen = { total: [] as number[], wickets: [] as number[] };
  const singleBalls: number[] = [];

  walk(matches, period, (history, day) => {
    const model = new Model(history, day[0].season, params);
    const still = new Model(history, day[0].season, { ...params, daySpread: 0 });
    const level = new Model(history, day[0].season, { ...params, daySpread: 0 }, wholeSeason.get(day[0].season));
    for (const match of day) {
      const fixture = fixtureOf(match);
      if (!fixture || match.shortened) continue;
      const happened = actual(match).totals[0];
      seen.total.push(happened);
      seen.wickets.push(
        match.balls.filter((b) => b.innings === 1).reduce((n, b) => n + b.out.length, 0),
      );

      // the chances given to the balls actually bowled, added up
      let expected = 0;
      const p = new Float64Array(OUTCOMES);
      for (const ball of match.balls) {
        if (ball.innings !== 1) continue;
        const phase = phaseOf(ball.over);
        still.chances(p, ball.batter, ball.bowler, match.venueId, phase, 1);
        for (let o = 0; o < OUTCOMES; o++) {
          expected += p[o] * (o <= SIX ? [0, 1, 2, 3, 4, 6][o] : o === WICKET ? 0 : still.runs[phase * OUTCOMES + o]);
        }
      }
      singleBalls.push(expected - happened);

      const first = sideFrom(history, fixture.first, params.recentMatches);
      const second = sideFrom(history, fixture.second, params.recentMatches);
      const real = [asPlayed(first, match, 1), asPlayed(second, match, 2)] as const;
      const runs: [Model, SideInput, SideInput][] = [
        [model, first, second],
        [still, first, second],
        [still, real[0], real[1]],
        [level, first, second],
        [level, real[0], real[1]],
      ];
      runs.forEach(([m, a, b], i) => {
        let out = 0;
        let innings = 0;
        const result = simulate(m, a, b, fixture.venueId, {
          sims,
          seed: seedOf(match.id),
          trace: (t) => {
            if (innings++ % 2 === 0) out += t.wickets;
          },
        });
        misses[i].push(result.first.mean - happened);
        wickets[i].push(out / sims);
      });
    }
  });

  console.log(
    `\nIPL ${period.from}-${period.to}: ${seen.total.length} full first innings, average ${mean(seen.total).toFixed(1)} for ${mean(seen.wickets).toFixed(2)} wickets`,
  );
  console.table(
    versions.map((version, i) => ({
      version,
      'runs too many': Number(mean(misses[i]).toFixed(1)),
      wickets: Number(mean(wickets[i]).toFixed(2)),
    })),
  );
  console.log(
    `chances of the balls actually bowled, added up: ${mean(singleBalls).toFixed(1)} runs too many`,
  );
}
