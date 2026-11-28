import { OTHER_OUT, OUTCOMES, PHASE_COUNT, phaseOf } from './outcomes';
import type { PastMatch } from './types';

/**
 * Everything counted from the matches added so far. Matches must be added in
 * date order; a prediction made between two additions can then only draw on what
 * came before it.
 */

/** Balls are counted apart by phase and innings: this many "situations". */
export const SITUATIONS = PHASE_COUNT * 2;
export const situation = (phase: number, innings: number) => phase * 2 + (innings - 1);

export type Tally = {
  outcomes: Float64Array; // how often each outcome happened
  balls: Float64Array; // deliveries in each situation
};

/** One season's tally, per season. */
export type Seasons = Map<number, Tally>;

const tally = (): Tally => ({
  outcomes: new Float64Array(OUTCOMES),
  balls: new Float64Array(SITUATIONS),
});

function of<K>(map: Map<K, Seasons>, key: K): Seasons {
  let seasons = map.get(key);
  if (!seasons) map.set(key, (seasons = new Map()));
  return seasons;
}

function inSeason(seasons: Seasons, season: number): Tally {
  let t = seasons.get(season);
  if (!t) seasons.set(season, (t = tally()));
  return t;
}

function add(seasons: Seasons, season: number, at: number, outcome: number) {
  const t = inSeason(seasons, season);
  t.outcomes[outcome] += 1;
  t.balls[at] += 1;
}

/** The league as a whole: outcomes by situation, and the runs they bring. */
export type League = {
  /** [situation * OUTCOMES + outcome] */
  counts: Float64Array;
  runs: Float64Array; // all runs, by phase * OUTCOMES + outcome
  batRuns: Float64Array;
};

const league = (): League => ({
  counts: new Float64Array(SITUATIONS * OUTCOMES),
  runs: new Float64Array(PHASE_COUNT * OUTCOMES),
  batRuns: new Float64Array(PHASE_COUNT * OUTCOMES),
});

export type Appearance = {
  position: number | null; // where they came in to bat, 1 for an opener
  overs: number[]; // the overs they bowled, 0-based
  runs: number;
  wickets: number;
};

const KEPT = 40; // appearances remembered for each player
/** Where a batter with no innings yet is taken to bat. */
export const UNKNOWN_POSITION = 11.5;
export const POSITION_GROUPS = 5;
export const positionGroup = (position: number) =>
  Math.min(POSITION_GROUPS - 1, Math.max(0, Math.ceil(position / 2) - 1));
/** From this many overs a match, lately, a player counts as a regular bowler. */
const REGULAR_OVERS = 2;

/** Required runs an over in a chase, in bands. */
export const PRESSURE_BANDS = 6;
export const pressureBand = (needed: number, ballsLeft: number) => {
  const rate = (needed * 6) / Math.max(1, ballsLeft);
  return rate < 6 ? 0 : rate < 8 ? 1 : rate < 10 ? 2 : rate < 12 ? 3 : rate < 15 ? 4 : 5;
};

export class History {
  readonly league = new Map<number, League>();
  /** Balls faced (so not wides). */
  readonly batters = new Map<string, Seasons>();
  readonly bowlers = new Map<string, Seasons>();
  readonly grounds = new Map<string, Seasons>();
  readonly pairs = new Map<string, Seasons>();
  /** What is usual for a batter in each part of the order. */
  readonly positions = new Map<number, Seasons>();
  /** And for a bowler: 1 regular, 0 occasional. */
  readonly bowlerKinds = new Map<number, Seasons>();
  readonly pressure = new Map<number, Seasons>();
  readonly appearances = new Map<string, Appearance[]>();
  latest = ''; // date of the last match added

  /** The player's latest appearances, oldest first. */
  recent(id: string, matches: number): Appearance[] {
    return this.appearances.get(id)?.slice(-matches) ?? [];
  }

  /** The middle of where they have batted lately. */
  usualPosition(id: string, matches: number): number {
    const seen = this.recent(id, matches)
      .flatMap((a) => (a.position === null ? [] : [a.position]))
      .sort((a, b) => a - b);
    if (!seen.length) return UNKNOWN_POSITION;
    const middle = seen.length >> 1;
    return seen.length % 2 ? seen[middle] : (seen[middle - 1] + seen[middle]) / 2;
  }

  oversAMatch(id: string, matches: number): number {
    const seen = this.recent(id, matches);
    return seen.length ? seen.reduce((n, a) => n + a.overs.length, 0) / seen.length : 0;
  }

  add(match: PastMatch) {
    if (match.date < this.latest) throw new Error(`match ${match.id} added out of order`);
    this.latest = match.date;
    const { season } = match;
    let totals = this.league.get(season);
    if (!totals) this.league.set(season, (totals = league()));

    // who they were before this match decides which usual figures it counts toward
    const kinds = new Map<string, number>();
    const kind = (id: string) => {
      let k = kinds.get(id);
      if (k === undefined) {
        kinds.set(id, (k = this.oversAMatch(id, 20) >= REGULAR_OVERS ? 1 : 0));
      }
      return k;
    };

    const seen = new Map<string, Appearance>();
    for (const id of match.named.flat()) {
      seen.set(id, { position: null, overs: [], runs: 0, wickets: 0 });
    }
    const player = (id: string) => {
      let a = seen.get(id);
      if (!a) seen.set(id, (a = { position: null, overs: [], runs: 0, wickets: 0 }));
      return a;
    };

    const order = [0, 0]; // batters seen in each innings
    for (const ball of match.balls) {
      for (const id of [ball.batter, ball.nonStriker]) {
        const a = player(id);
        if (a.position === null) a.position = ++order[ball.innings - 1];
      }
    }

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
      const phase = phaseOf(ball.over);
      const at = situation(phase, ball.innings);
      const o = ball.outcome;
      totals.counts[at * OUTCOMES + o] += 1;
      totals.runs[phase * OUTCOMES + o] += ball.runs;
      totals.batRuns[phase * OUTCOMES + o] += ball.runsBatter;

      const batter = player(ball.batter);
      batter.runs += ball.runsBatter;
      const bowler = player(ball.bowler);
      if (!bowler.overs.includes(ball.over)) bowler.overs.push(ball.over);
      // a run out is no credit to the bowler
      if (o !== OTHER_OUT) bowler.wickets += ball.out.length;

      if (ball.faced) {
        add(of(this.batters, ball.batter), season, at, o);
        add(of(this.positions, positionGroup(batter.position!)), season, at, o);
      }
      add(of(this.bowlers, ball.bowler), season, at, o);
      add(of(this.bowlerKinds, kind(ball.bowler)), season, at, o);
      add(of(this.grounds, match.venueId), season, at, o);
      add(of(this.pairs, `${ball.batter} ${ball.bowler}`), season, at, o);
      if (ball.innings === 2 && target > 0) {
        add(of(this.pressure, pressureBand(target - scored, 120 - legal)), season, at, o);
      }
      scored += ball.runs;
      if (ball.legal) legal += 1;
    }

    for (const [id, appearance] of seen) {
      const list = this.appearances.get(id) ?? [];
      list.push(appearance);
      if (list.length > KEPT) list.shift();
      this.appearances.set(id, list);
    }
  }
}
