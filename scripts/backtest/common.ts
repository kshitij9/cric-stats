import { History } from '../../lib/sim/history';
import type { PastMatch } from '../../lib/sim/types';

/** Settings are chosen on these seasons only ... */
export const TUNE = { from: 2019, to: 2022 };
/** ... and judged on these, which nothing is chosen from. */
export const TEST = { from: 2023, to: 2026 };
export type Period = { from: number; to: number };

/**
 * Goes through the matches in date order. `visit` sees each day's matches in the
 * period with a history of the days before it, and no more; the day is added
 * afterwards.
 */
export function walk(
  matches: PastMatch[],
  period: Period,
  visit: (history: History, day: PastMatch[]) => void,
) {
  const history = new History();
  for (let i = 0; i < matches.length; ) {
    let end = i;
    while (end < matches.length && matches[end].date === matches[i].date) end++;
    const day = matches.slice(i, end);
    const { season } = day[0];
    if (season > period.to) break;
    if (season >= period.from) visit(history, day);
    for (const match of day) history.add(match);
    i = end;
  }
}

export const seedOf = (text: string) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

export const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
export const logLoss = (p: number, won: number) => {
  const q = Math.min(0.999, Math.max(0.001, p));
  return -(won * Math.log(q) + (1 - won) * Math.log(1 - q));
};
export const rmse = (errors: number[]) => Math.sqrt(mean(errors.map((e) => e * e)));
export const mae = (errors: number[]) => mean(errors.map(Math.abs));

/** What happened in a match, for each named player. */
export function actual(match: PastMatch) {
  const players = new Map<string, { runs: number; wickets: number }>();
  for (const id of match.named.flat()) players.set(id, { runs: 0, wickets: 0 });
  const totals = [0, 0];
  for (const ball of match.balls) {
    totals[ball.innings - 1] += ball.runs;
    const batter = players.get(ball.batter);
    if (batter) batter.runs += ball.runsBatter;
    const bowler = players.get(ball.bowler);
    // outcome 7: a run out, which is not the bowler's
    if (bowler && ball.outcome !== 7) bowler.wickets += ball.out.length;
  }
  return { players, totals };
}

/** The side batting first, its players, and the other's; null if nobody batted. */
export function fixtureOf(match: PastMatch) {
  const first = match.battingFirst;
  if (first === null) return null;
  return {
    season: match.season,
    venueId: match.venueId,
    first: match.named[first],
    second: match.named[1 - first],
  };
}

/** 1 if the side batting first won, 0 if the other did, null with no result. */
export const firstWon = (match: PastMatch) =>
  match.winner === null || match.battingFirst === null
    ? null
    : Number(match.winner === match.battingFirst);
