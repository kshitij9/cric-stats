import { query } from '@/lib/db';

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
 * Era index: a batter's runs divided by the runs an average batter of the same
 * gender would have scored from the same balls, year by year (era_averages is
 * runs per 100 balls faced for a year, format and gender). Over several years it
 * is total runs over total expected runs, so each year weighs by its balls.
 */

export const FORMATS = ['Test', 'ODI', 'T20'] as const;
export type Format = (typeof FORMATS)[number];

export const isFormat = (value: string): value is Format =>
  (FORMATS as readonly string[]).includes(value);

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

// ---------------------------------------------------------------------------
// one player in one format
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

const eraYears = (playerId: string, format: Format) =>
  query<EraYear>(
    `WITH years AS (
       SELECT extract(year FROM date)::int AS year, gender,
              sum(runs_batter)                   AS runs,
              count(*) FILTER (WHERE ball_faced) AS balls
         FROM deliveries
        WHERE batter_id = $1 AND format = $2
        GROUP BY 1, 2
     )
     SELECT y.year, y.runs, y.balls,
            y.balls * e.runs::numeric / e.balls AS expected_runs
       FROM years y
       JOIN era_averages e
         ON e.year = y.year AND e.format = $2 AND e.gender = y.gender
      WHERE y.balls > 0
      ORDER BY y.year`,
    [playerId, format],
  );

const total = (rows: EraYear[], key: 'runs' | 'expected_runs') =>
  rows.reduce((sum, r) => sum + r[key], 0);

/** Era index for each year the player faced a ball. */
export async function eraByYear(player: Player, format: Format) {
  const rows = await eraYears(player.player_id, format);
  return rows.map((r) => ({
    year: r.year,
    format,
    era_index: eraIndex(r.runs, r.expected_runs),
    runs: r.runs,
    balls: r.balls,
    expected_runs: round(r.expected_runs, 1),
  }));
}

/** Career batting; null if the player has no innings in the format. */
export async function career(player: Player, format: Format) {
  const [counts] = await query<BattingCounts>(
    `SELECT sum(innings_played) AS innings, sum(runs_scored) AS runs,
            sum(balls_faced) AS balls, sum(outs) AS outs,
            sum(fours) AS fours, sum(sixes) AS sixes
       FROM player_career_stats
      WHERE player_id = $1 AND format = $2
     HAVING count(*) > 0`,
    [player.player_id, format],
  );
  if (!counts) return null;
  const years = await eraYears(player.player_id, format);
  return {
    player_id: player.player_id,
    player_name: player.name,
    unique_name: player.unique_name,
    format,
    ...battingFigures(counts),
    era_index: eraIndex(total(years, 'runs'), total(years, 'expected_runs')),
  };
}

/** The bowlers who have dismissed this batter most, in one format. */
export async function matchups(player: Player, format: Format) {
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
        WHERE batter_id = $1 AND format = $2
        GROUP BY 1
     ),
     taken AS (
       SELECT d.bowler_id, count(*) AS dismissals
         FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
        WHERE w.player_out_id = $1 AND w.bowlers_wicket AND d.format = $2
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
    [player.player_id, format],
  );
  return rows.map((r) => ({ ...r, format, strike_rate: per(r.runs, r.balls, 2, 100) }));
}
