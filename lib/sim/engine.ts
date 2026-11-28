import { Attack, OVERS } from './bowling';
import { PRESSURE_BANDS, WICKET_BANDS, pressureBand, wicketState } from './history';
import { Model } from './model';
import {
  BYE,
  NO_BALL,
  OTHER_OUT,
  OUTCOMES,
  PHASE_COUNT,
  SIX,
  WICKET,
  WIDE,
  FOUR,
  phaseOf,
} from './outcomes';
import { normal, seeded } from './rng';
import type { SideInput } from './types';

/**
 * Plays a match ball by ball, many times. An innings ends at ten wickets (or the
 * last pair out), twenty overs, or the target. A tie counts half to each side.
 * Free hits, fielding changes and tactics are not modelled.
 */

export type PlayerLine = {
  id: string;
  runs: number; // per match, averaged over every simulation
  balls: number;
  out: number; // share of matches
  overs: number;
  conceded: number;
  wickets: number;
};

export type InningsSummary = {
  totals: Int16Array; // each simulation's, in the order played
  mean: number;
};

export type Simulation = {
  sims: number;
  firstWins: number; // chance the side batting first wins
  first: InningsSummary;
  second: InningsSummary;
  players: [PlayerLine[], PlayerLine[]]; // the side batting first, then the other
};

const OFF_THE_BAT = [0, 1, 2, 3, 4, 6]; // runs of the outcomes up to a six

/** Counts checked by the tests; filled only when asked for. */
export type Trace = (innings: {
  balls: number;
  wickets: number;
  total: number;
  batterRuns: number;
  extras: number;
  overs: number[]; // bowled by each player
  consecutive: boolean; // someone bowled two overs running
}) => void;

type Tallies = {
  runs: Float64Array;
  balls: Float64Array;
  out: Float64Array;
  overs: Float64Array;
  conceded: Float64Array;
  wickets: Float64Array;
};

const tallies = (n: number): Tallies => ({
  runs: new Float64Array(n),
  balls: new Float64Array(n),
  out: new Float64Array(n),
  overs: new Float64Array(n),
  conceded: new Float64Array(n),
  wickets: new Float64Array(n),
});

export function simulate(
  model: Model,
  first: SideInput,
  second: SideInput,
  venueId: string,
  options: { sims: number; seed: number; trace?: Trace },
): Simulation {
  const { sims, seed, trace } = options;
  const random = seeded(seed);
  const sides = [first, second];
  const tally = sides.map((s) => tallies(s.order.length));
  // players are numbered by batting order; bowlers are listed in the same numbers
  const attacks = sides.map(
    (s) => new Attack(s.order.map((id) => s.bowling.find((b) => b.id === id)!)),
  );

  const bands = model.usesPressure ? PRESSURE_BANDS + 1 : 1;
  const states = model.usesWickets ? WICKET_BANDS : 1;
  // chances already worked out: [innings][batter][bowler][phase][band][wickets]
  const known = sides.map((batting, i) => {
    const bowling = sides[1 - i];
    return new Array<Float64Array | undefined>(
      batting.order.length * bowling.order.length * PHASE_COUNT * bands * states,
    );
  });
  const chances = (
    i: number,
    batter: number,
    bowler: number,
    phase: number,
    band: number,
    lost: number,
  ) => {
    const bowlers = sides[1 - i].order.length;
    const slot = bands > 1 ? band + 1 : 0; // the first is for no chase
    const state = states > 1 ? wicketState(0, lost) : 0;
    const key = (((batter * bowlers + bowler) * PHASE_COUNT + phase) * bands + slot) * states + state;
    let found = known[i][key];
    if (!found) {
      found = known[i][key] = new Float64Array(OUTCOMES);
      model.chances(
        found,
        sides[i].order[batter],
        sides[1 - i].order[bowler],
        venueId,
        phase,
        i + 1,
        band,
        lost,
      );
    }
    return found;
  };

  const spread = model.params.daySpread;
  const whole = (value: number) => {
    const floor = Math.floor(value);
    return floor + (random() < value - floor ? 1 : 0);
  };

  // above 1: a good day for batting; and what it does to the chance of a wicket
  let day = 1;
  let wicketScale = 1;
  const innings = (i: number, target: number) => {
    const batters = sides[i].order.length;
    const lastWicket = Math.min(10, batters - 1);
    const batting = tally[i];
    const bowling = tally[1 - i];
    const attack = attacks[1 - i];
    attack.reset();
    const fixed = sides[1 - i].overs?.map((id) => (id ? sides[1 - i].order.indexOf(id) : -1));
    let striker = 0;
    let other = 1;
    let next = 2;
    let wickets = 0;
    let total = 0;
    let legal = 0;
    let previous = -1;
    let batterRuns = 0;
    let consecutive = false;

    for (let over = 0; over < OVERS; over++) {
      let bowler = fixed?.[over] ?? -1;
      if (bowler < 0) bowler = attack.next(over, previous, random);
      else attack.used[bowler] += 1;
      if (bowler === previous) consecutive = true;
      previous = bowler;
      bowling.overs[bowler] += 1;
      const phase = phaseOf(over);

      for (let balls = 0; balls < 6; ) {
        const band = target && bands > 1 ? pressureBand(target - total, 120 - legal) : -1;
        const p = chances(i, striker, bowler, phase, band, wickets);

        // on a good day for batting, more boundaries and fewer wickets
        let draw = random();
        if (day !== 1) draw *= 1 + (day - 1) * (p[FOUR] + p[SIX]) + (wicketScale - 1) * p[WICKET];
        let o = 0;
        for (; o < OUTCOMES - 1; o++) {
          draw -= p[o] * (o === FOUR || o === SIX ? day : o === WICKET ? wicketScale : 1);
          if (draw < 0) break;
        }

        const at = phase * OUTCOMES + o;
        // outcomes up to six have fixed runs; the rest are as the league averages
        const runs = o <= SIX ? OFF_THE_BAT[o] : o === WICKET ? 0 : whole(model.runs[at]);
        const offBat =
          o <= SIX
            ? runs
            : o === NO_BALL || o === OTHER_OUT
              ? Math.min(runs, whole(model.batRuns[at]))
              : 0;
        total += runs;
        batterRuns += offBat;
        batting.runs[striker] += offBat;
        if (o !== WIDE) batting.balls[striker] += 1;
        // byes are not the bowler's; of a run out ball, only what came off the bat
        if (o !== BYE) bowling.conceded[bowler] += o === OTHER_OUT ? offBat : runs;
        if (o !== WIDE && o !== NO_BALL) {
          balls += 1;
          legal += 1;
        }

        // batters cross on odd runs; the penalty run of a wide or no-ball is not run
        const ran = o === WIDE || o === NO_BALL ? runs - 1 : o === FOUR || o === SIX ? 0 : runs;

        if (o === WICKET || o === OTHER_OUT) {
          // a run out takes either batter
          const gone = o === OTHER_OUT && random() < 0.45 ? other : striker;
          batting.out[gone] += 1;
          if (o === WICKET) bowling.wickets[bowler] += 1;
          wickets += 1;
          if (wickets >= lastWicket || (target && total >= target)) break;
          if (gone === striker) striker = next++;
          else other = next++;
        } else if (ran % 2 === 1) {
          [striker, other] = [other, striker];
        }
        if (target && total >= target) break;
      }

      if (wickets >= lastWicket || (target && total >= target)) break;
      [striker, other] = [other, striker];
    }

    trace?.({
      balls: legal,
      wickets,
      total,
      batterRuns,
      extras: total - batterRuns,
      overs: [...attack.used],
      consecutive,
    });
    return total;
  };

  const totals = [new Int16Array(sims), new Int16Array(sims)];
  let wins = 0;
  for (let n = 0; n < sims; n++) {
    if (spread > 0) {
      const swing = spread * normal(random);
      const middle = (spread * spread) / 2;
      day = Math.exp(swing - middle);
      // 1 / day averages above one, so loses runs; centred, both average one
      wicketScale = model.params.dayCentred ? Math.exp(-swing - middle) : 1 / day;
    }
    const a = innings(0, 0);
    const b = innings(1, a + 1);
    totals[0][n] = a;
    totals[1][n] = b;
    wins += a > b ? 1 : a === b ? 0.5 : 0;
  }

  const summary = (t: Int16Array): InningsSummary => ({
    totals: t,
    mean: t.reduce((sum, x) => sum + x, 0) / sims,
  });
  const lines = (i: number): PlayerLine[] =>
    sides[i].order.map((id, p) => ({
      id,
      runs: tally[i].runs[p] / sims,
      balls: tally[i].balls[p] / sims,
      out: tally[i].out[p] / sims,
      overs: tally[i].overs[p] / sims,
      conceded: tally[i].conceded[p] / sims,
      wickets: tally[i].wickets[p] / sims,
    }));

  return {
    sims,
    firstWins: wins / sims,
    first: summary(totals[0]),
    second: summary(totals[1]),
    players: [lines(0), lines(1)],
  };
}
