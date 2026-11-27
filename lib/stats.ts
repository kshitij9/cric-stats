import { careerSpans } from '@/lib/coverage';
import { query } from '@/lib/db';
import type { Scope } from '@/lib/types';

/**
 * What each statistic means. Every screen and the recommender use these.
 *
 * Which balls and wickets count is decided once, by columns the database
 * computes from the raw data (db/init/001-schema.sql):
 *
 *   deliveries.ball_faced    any delivery that is not a wide
 *   deliveries.legal_ball    not a wide or a no-ball
 *   deliveries.bowler_runs   runs off the bat + wides + no-balls
 *   deliveries.boundary      a four or six that reached or cleared the rope
 *   wickets.dismissal        any kind except retired hurt and retired not out;
 *                            counted for the player out, at either end
 *   wickets.bowlers_wicket   bowled, caught, caught and bowled, lbw, stumped,
 *                            hit wicket
 *
 * This file turns counts of those into rates. A rate with nothing to divide by
 * is null.
 *
 * Bowling innings: an innings in which the player bowled any delivery. A dot
 * ball is a legal ball with nothing off the bat (byes and leg byes may have been
 * run). Boundaries conceded are the batter's boundaries, no-balls included. Best
 * figures are the most wickets in an innings, then the fewest runs.
 *
 * Every figure is for one scope: a format in one competition (internationals, or
 * the IPL). Years are calendar years.
 *
 * Era index: a batter's runs divided by the runs an average batter of the same
 * gender would have scored from the same balls, year by year (era_averages is
 * runs per 100 balls faced for a year, format, competition and gender). Over
 * several years it is total runs over total expected runs, so each year weighs
 * by its balls.
 */

/** A Cricsheet ID, with a suffix where one ID had to be split by gender. */
export const isPlayerId = (value: string) => /^[0-9a-f]{8}(-[mf])?$/.test(value);

export const round = (value: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
};

const per = (amount: number, count: number, dp: number, scale = 1) =>
  count > 0 ? round((amount * scale) / count, dp) : null;

export const eraIndex = (runs: number, expectedRuns: number) => per(runs, expectedRuns, 2);

export type BattingCounts = {
  innings: number;
  runs: number;
  balls: number; // balls faced
  outs: number;
  fours: number; // boundaries only
  sixes: number;
};

export function battingFigures(c: BattingCounts) {
  return {
    ...c,
    average: per(c.runs, c.outs, 2),
    strike_rate: per(c.runs, c.balls, 2, 100),
    balls_per_dismissal: per(c.balls, c.outs, 1),
    boundary_percent: per(c.fours * 4 + c.sixes * 6, c.runs, 1, 100),
    not_out_percent: per(c.innings - c.outs, c.innings, 1, 100),
  };
}

export type BowlingCounts = {
  runs: number; // runs conceded
  balls: number; // legal balls
  wickets: number; // bowler's wickets
};

export function bowlingFigures(c: BowlingCounts) {
  return {
    runs_conceded: c.runs,
    balls: c.balls,
    wickets: c.wickets,
    economy: per(c.runs, c.balls, 2, 6),
    strike_rate: per(c.balls, c.wickets, 1),
    average: per(c.runs, c.wickets, 2),
  };
}

/** One innings bowled, or several added together. */
export type SpellCounts = BowlingCounts & { dots: number; fours: number; sixes: number };

export function spellFigures(spells: SpellCounts[]) {
  const sum = (key: keyof SpellCounts) => spells.reduce((total, s) => total + s[key], 0);
  const c = { runs: sum('runs'), balls: sum('balls'), wickets: sum('wickets') };
  const dots = sum('dots');
  const fours = sum('fours');
  const sixes = sum('sixes');
  const [best] = [...spells].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs);
  return {
    innings: spells.length,
    ...bowlingFigures(c),
    dots,
    fours,
    sixes,
    dot_percent: per(dots, c.balls, 1, 100),
    balls_per_boundary: per(c.balls, fours + sixes, 1),
    wickets_per_innings: per(c.wickets, spells.length, 2),
    three_wicket_innings: spells.filter((s) => s.wickets >= 3).length,
    five_wicket_innings: spells.filter((s) => s.wickets >= 5).length,
    best_wickets: best?.wickets ?? null,
    best_runs: best?.runs ?? null,
  };
}

// ---------------------------------------------------------------------------
// one player in one scope
// ---------------------------------------------------------------------------

export type Player = {
  player_id: string;
  name: string;
  unique_name: string;
  gender: string;
};

export async function findPlayers(ids: string[]): Promise<Map<string, Player>> {
  const rows = await query<Player>(
    `SELECT player_id, name, unique_name, gender FROM players WHERE player_id = ANY($1::text[])`,
    [ids],
  );
  return new Map(rows.map((r) => [r.player_id, r]));
}

type EraYear = { year: number; runs: number; balls: number; expected_runs: number };

const eraYears = (playerId: string, { format, competition }: Scope) =>
  query<EraYear>(
    `WITH years AS (
       SELECT extract(year FROM date)::int AS year, gender,
              sum(runs_batter)                   AS runs,
              count(*) FILTER (WHERE ball_faced) AS balls
         FROM deliveries
        WHERE batter_id = $1 AND format = $2 AND competition = $3
        GROUP BY 1, 2
     )
     SELECT y.year, y.runs, y.balls,
            y.balls * e.runs::numeric / e.balls AS expected_runs
       FROM years y
       JOIN era_averages e
         ON e.year = y.year AND e.format = $2 AND e.competition = $3
        AND e.gender = y.gender
      WHERE y.balls > 0
      ORDER BY y.year`,
    [playerId, format, competition],
  );

const total = (rows: EraYear[], key: 'runs' | 'expected_runs') =>
  rows.reduce((sum, r) => sum + r[key], 0);

/** Era index for each year the player faced a ball. */
export async function eraByYear(player: Player, scope: Scope) {
  const rows = await eraYears(player.player_id, scope);
  return rows.map((r) => ({
    year: r.year,
    format: scope.format,
    era_index: eraIndex(r.runs, r.expected_runs),
    runs: r.runs,
    balls: r.balls,
    expected_runs: round(r.expected_runs, 1),
  }));
}

/** Career batting; null if the player has no innings in the scope. */
export async function career(player: Player, scope: Scope) {
  const { format, competition } = scope;
  const [counts] = await query<BattingCounts>(
    `SELECT sum(innings_played) AS innings, sum(runs_scored) AS runs,
            sum(balls_faced) AS balls, sum(outs) AS outs,
            sum(fours) AS fours, sum(sixes) AS sixes
       FROM player_career_stats
      WHERE player_id = $1 AND format = $2 AND competition = $3
     HAVING count(*) > 0`,
    [player.player_id, format, competition],
  );
  if (!counts) return null;
  const [years, spans] = await Promise.all([
    eraYears(player.player_id, scope),
    careerSpans([player.player_id], scope),
  ]);
  const span = spans.get(player.player_id);
  return {
    player_id: player.player_id,
    name: player.name,
    player_name: player.name,
    unique_name: player.unique_name,
    format,
    ...battingFigures(counts),
    era_index: eraIndex(total(years, 'runs'), total(years, 'expected_runs')),
    first_match: span?.first_match ?? null,
    last_match: span?.last_match ?? null,
    may_be_incomplete: span?.may_be_incomplete ?? false,
  };
}

/** The bowlers who have dismissed this batter most, in one scope. */
export async function matchups(player: Player, scope: Scope) {
  const { format, competition } = scope;
  const rows = await query<{
    bowler_id: string;
    bowler: string;
    unique_name: string;
    balls: number;
    runs: number;
    dismissals: number;
  }>(
    `WITH faced AS (
       SELECT bowler_id,
              count(*) FILTER (WHERE ball_faced) AS balls,
              sum(runs_batter)                   AS runs
         FROM deliveries
        WHERE batter_id = $1 AND format = $2 AND competition = $3
        GROUP BY 1
     ),
     taken AS (
       SELECT d.bowler_id, count(*) AS dismissals
         FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
        WHERE w.player_out_id = $1 AND w.bowlers_wicket
          AND d.format = $2 AND d.competition = $3
        GROUP BY 1
     )
     SELECT f.bowler_id, p.name AS bowler, p.unique_name, f.balls, f.runs,
            coalesce(t.dismissals, 0) AS dismissals
       FROM faced f
       JOIN players p ON p.player_id = f.bowler_id
       LEFT JOIN taken t ON t.bowler_id = f.bowler_id
      WHERE f.balls > 15
      ORDER BY dismissals DESC, f.runs::numeric / f.balls, f.bowler_id
      LIMIT 5`,
    [player.player_id, format, competition],
  );
  return rows.map((r) => ({ ...r, format, strike_rate: per(r.runs, r.balls, 2, 100) }));
}

// ---------------------------------------------------------------------------
// one player's bowling in one scope
// ---------------------------------------------------------------------------

type Spell = SpellCounts & { year: number };

/** Every innings the player bowled in, oldest first. */
const spells = (playerId: string, { format, competition }: Scope) =>
  query<Spell>(
    `SELECT extract(year FROM d.date)::int AS year,
            count(*) FILTER (WHERE d.legal_ball)                       AS balls,
            sum(d.bowler_runs)                                         AS runs,
            sum(w.taken)::int                                          AS wickets,
            count(*) FILTER (WHERE d.legal_ball AND d.runs_batter = 0) AS dots,
            count(*) FILTER (WHERE d.boundary AND d.runs_batter = 4)   AS fours,
            count(*) FILTER (WHERE d.boundary AND d.runs_batter = 6)   AS sixes
       FROM deliveries d
      CROSS JOIN LATERAL (SELECT count(*) AS taken FROM wickets w
                           WHERE w.delivery_id = d.id AND w.bowlers_wicket) w
      WHERE d.bowler_id = $1 AND d.format = $2 AND d.competition = $3
      GROUP BY d.match_id, d.innings, 1
      ORDER BY min(d.date), d.match_id, d.innings`,
    [playerId, format, competition],
  );

/** Career bowling; null if the player has not bowled in the scope. */
export async function bowlingCareer(player: Player, scope: Scope) {
  const [rows, spans] = await Promise.all([
    spells(player.player_id, scope),
    careerSpans([player.player_id], scope),
  ]);
  if (rows.length === 0) return null;
  const span = spans.get(player.player_id);
  return {
    player_id: player.player_id,
    name: player.name,
    player_name: player.name,
    unique_name: player.unique_name,
    format: scope.format,
    ...spellFigures(rows),
    first_match: span?.first_match ?? null,
    last_match: span?.last_match ?? null,
    may_be_incomplete: span?.may_be_incomplete ?? false,
  };
}

/** Bowling figures for each year the player bowled. */
export async function bowlingByYear(player: Player, scope: Scope) {
  const rows = await spells(player.player_id, scope);
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  return years.map((year) => ({
    year,
    format: scope.format,
    ...spellFigures(rows.filter((r) => r.year === year)),
  }));
}

/** The batters this bowler has dismissed most, in one scope. */
export async function bowlingMatchups(player: Player, scope: Scope) {
  const { format, competition } = scope;
  const rows = await query<{
    batter_id: string;
    batter: string;
    unique_name: string;
    balls: number;
    runs: number;
    dismissals: number;
  }>(
    `WITH bowled AS (
       SELECT batter_id,
              count(*) FILTER (WHERE legal_ball) AS balls,
              sum(bowler_runs)                   AS runs
         FROM deliveries
        WHERE bowler_id = $1 AND format = $2 AND competition = $3
        GROUP BY 1
     ),
     taken AS (
       SELECT w.player_out_id AS batter_id, count(*) AS dismissals
         FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
        WHERE d.bowler_id = $1 AND w.bowlers_wicket
          AND d.format = $2 AND d.competition = $3
        GROUP BY 1
     )
     SELECT b.batter_id, p.name AS batter, p.unique_name, b.balls, b.runs,
            coalesce(t.dismissals, 0) AS dismissals
       FROM bowled b
       JOIN players p ON p.player_id = b.batter_id
       LEFT JOIN taken t ON t.batter_id = b.batter_id
      WHERE b.balls > 15
      ORDER BY dismissals DESC, b.runs::numeric / b.balls, b.batter_id
      LIMIT 5`,
    [player.player_id, format, competition],
  );
  return rows.map((r) => ({ ...r, format, economy: per(r.runs, r.balls, 2, 6) }));
}
