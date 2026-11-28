import { query } from '@/lib/db';
import { seasonRange } from '@/lib/ground';
import type { SeasonChoice } from '@/lib/matchup-types';
import {
  PERFORMERS_SHOWN,
  type FranchiseSpan,
  type Meeting,
  type Rivalry,
  type RunScorer,
  type Score,
  type Side,
  type Sides,
  type Tally,
  type WicketTaker,
} from '@/lib/rivalry-types';
import { battingFigures, bowlingFigures } from '@/lib/stats';
import type { VenueRef } from '@/lib/types';

/**
 * Meetings of two franchises, each known by its present name (team_aliases).
 * A super over or bowl-out settles who won; its balls count toward no score or
 * figure. A player counts for the side they played for in that match. Which
 * balls and wickets count is as in lib/stats.ts.
 */

/** Every franchise there has been, those of the latest season first. */
export const franchiseSpans = () =>
  query<FranchiseSpan>(
    `WITH sides AS (
       SELECT a.franchise AS team, extract(year FROM m.date)::int AS season
         FROM matches m
        CROSS JOIN LATERAL (VALUES (m.team1), (m.team2)) t(name)
         JOIN team_aliases a ON a.competition = m.competition AND a.team_name = t.name
        WHERE m.competition = 'ipl'
     )
     SELECT team, min(season) AS first_season, max(season) AS last_season,
            count(*)::int AS matches,
            max(season) = (SELECT max(season) FROM sides) AS current
       FROM sides GROUP BY team ORDER BY current DESC, team`,
  );

type Found = {
  match_id: string;
  date: string;
  venue_id: string;
  venue: string;
  city: string;
  winner: string | null; // franchise
  won_in_play: boolean;
  super_over: boolean;
  bowl_out: boolean;
  result_margin: string | null;
  result_method: string | null;
};

const meetingsOf = ([a, b]: Sides<string>, from: number) =>
  query<Found>(
    `SELECT m.match_id, m.date::text AS date, v.venue_id, v.name AS venue, v.city,
            won.franchise AS winner, m.winner IS NOT NULL AS won_in_play,
            m.eliminator IS NOT NULL AS super_over, m.bowl_out IS NOT NULL AS bowl_out,
            m.result_margin, m.result_method
       FROM matches m
       JOIN venues v ON v.venue_id = m.venue_id
       JOIN team_aliases one ON one.competition = m.competition AND one.team_name = m.team1
       JOIN team_aliases two ON two.competition = m.competition AND two.team_name = m.team2
       LEFT JOIN team_aliases won ON won.competition = m.competition
             AND won.team_name = coalesce(m.winner, m.eliminator, m.bowl_out)
      WHERE m.competition = 'ipl' AND m.date >= make_date($3::int, 1, 1)
        AND ((one.franchise = $1 AND two.franchise = $2)
          OR (one.franchise = $2 AND two.franchise = $1))
      ORDER BY m.date DESC, m.match_id DESC`,
    [a, b, from],
  );

const scoresOf = (matchIds: string[]) =>
  query<{
    match_id: string;
    team: string;
    runs: number;
    wickets: number;
    balls: number;
  }>(
    `SELECT d.match_id, a.franchise AS team,
            sum(d.runs_batter + d.extras)          AS runs,
            coalesce(sum(w.taken), 0)::int         AS wickets,
            count(*) FILTER (WHERE d.legal_ball)   AS balls
       FROM deliveries d
       JOIN team_aliases a ON a.competition = d.competition AND a.team_name = d.batting_team
      CROSS JOIN LATERAL (SELECT count(*) AS taken FROM wickets w
                           WHERE w.delivery_id = d.id AND w.dismissal) w
      WHERE d.match_id = ANY($1::text[])
      GROUP BY d.match_id, d.innings, a.franchise
      ORDER BY d.match_id, d.innings`,
    [matchIds],
  );

/** One player's batting in one innings, for one side. */
type Knock = {
  player_id: string;
  unique_name: string;
  team: string;
  runs: number;
  balls: number;
  outs: number;
};

const knocksOf = (matchIds: string[]) =>
  query<Knock>(
    `WITH balls AS (SELECT * FROM deliveries WHERE match_id = ANY($1::text[])),
     -- an innings: batted, ran as non-striker, or was dismissed without doing either
     appearances AS (
       SELECT batter_id AS player_id, match_id, innings, batting_team FROM balls
       UNION SELECT non_striker_id, match_id, innings, batting_team FROM balls
       UNION SELECT w.player_out_id, b.match_id, b.innings, b.batting_team
               FROM wickets w JOIN balls b ON b.id = w.delivery_id
     ),
     faced AS (
       SELECT batter_id AS player_id, match_id, innings, sum(runs_batter) AS runs,
              count(*) FILTER (WHERE ball_faced) AS balls
         FROM balls GROUP BY 1, 2, 3
     ),
     dismissed AS (
       SELECT w.player_out_id AS player_id, b.match_id, b.innings, count(*) AS outs
         FROM wickets w JOIN balls b ON b.id = w.delivery_id
        WHERE w.dismissal GROUP BY 1, 2, 3
     )
     SELECT x.player_id, p.unique_name, a.franchise AS team,
            coalesce(f.runs, 0) AS runs, coalesce(f.balls, 0) AS balls,
            coalesce(o.outs, 0) AS outs
       FROM appearances x
       LEFT JOIN faced f USING (player_id, match_id, innings)
       LEFT JOIN dismissed o USING (player_id, match_id, innings)
       JOIN players p ON p.player_id = x.player_id
       JOIN team_aliases a ON a.competition = 'ipl' AND a.team_name = x.batting_team`,
    [matchIds],
  );

/** One player's bowling in one innings, for one side. */
type Spell = {
  player_id: string;
  unique_name: string;
  team: string;
  balls: number;
  runs: number;
  wickets: number;
};

const spellsOf = (matchIds: string[]) =>
  query<Spell>(
    `SELECT d.bowler_id AS player_id, p.unique_name, a.franchise AS team,
            count(*) FILTER (WHERE d.legal_ball) AS balls,
            sum(d.bowler_runs)                   AS runs,
            sum(w.taken)                         AS wickets
       FROM deliveries d
       JOIN players p ON p.player_id = d.bowler_id
       JOIN team_aliases a ON a.competition = d.competition AND a.team_name = d.bowling_team
      CROSS JOIN LATERAL (SELECT count(*) AS taken FROM wickets w
                           WHERE w.delivery_id = d.id AND w.bowlers_wicket) w
      WHERE d.match_id = ANY($1::text[])
      GROUP BY d.bowler_id, p.unique_name, a.franchise, d.match_id, d.innings`,
    [matchIds],
  );

function meeting(found: Found, teams: Sides<string>, scores: Score[]): Meeting {
  const winner = found.winner === null ? null : ((found.winner === teams[0] ? 0 : 1) as Side);
  const margin = /^(\d+) (run|wicket)s?$/.exec(found.result_margin ?? '');
  const outcome: Meeting['outcome'] = found.won_in_play
    ? margin?.[2] === 'wicket'
      ? 'wickets'
      : 'runs'
    : found.super_over
      ? 'super over'
      : found.bowl_out
        ? 'bowl-out'
        : found.result_margin === 'tie'
          ? 'tie'
          : 'no result';
  return {
    match_id: found.match_id,
    date: found.date,
    venue: { venue_id: found.venue_id, name: found.venue, city: found.city },
    scores,
    winner,
    outcome,
    by: found.won_in_play && margin ? Number(margin[1]) : null,
    method: found.result_method,
  };
}

function tally(meetings: Meeting[]): Tally {
  const wins = ([0, 1] as const).map(
    (side) => meetings.filter((m) => m.winner === side).length,
  ) as Sides<number>;
  return { played: meetings.length, wins, other: meetings.length - wins[0] - wins[1] };
}

/** One side's rows, gathered by player. */
function playersOf<T extends { player_id: string; team: string }>(rows: T[], team: string) {
  const players = new Map<string, T[]>();
  for (const row of rows) {
    if (row.team !== team) continue;
    const theirs = players.get(row.player_id);
    if (theirs) theirs.push(row);
    else players.set(row.player_id, [row]);
  }
  return [...players.values()];
}

const sum = <T>(rows: T[], of: (row: T) => number) => rows.reduce((n, row) => n + of(row), 0);

/** The most runs first; ties go to the quicker. */
function runScorers(knocks: Knock[], team: string): RunScorer[] {
  return playersOf(knocks, team)
    .map((innings) => {
      const counts = {
        innings: innings.length,
        runs: sum(innings, (i) => i.runs),
        balls: sum(innings, (i) => i.balls),
        outs: sum(innings, (i) => i.outs),
      };
      const [best] = [...innings].sort(
        (a, b) => b.runs - a.runs || a.outs - b.outs || a.balls - b.balls,
      );
      return {
        player_id: best.player_id,
        unique_name: best.unique_name,
        innings: counts.innings,
        runs: counts.runs,
        balls: counts.balls,
        strike_rate: battingFigures({ ...counts, fours: 0, sixes: 0 }).strike_rate,
        best_runs: best.runs,
        best_balls: best.balls,
        best_not_out: best.outs === 0,
      };
    })
    .filter((p) => p.runs > 0)
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls || a.player_id.localeCompare(b.player_id))
    .slice(0, PERFORMERS_SHOWN);
}

/** The most wickets first; ties go to the more economical. */
function wicketTakers(spells: Spell[], team: string): WicketTaker[] {
  return playersOf(spells, team)
    .map((innings) => {
      const { runs_conceded, balls, wickets, economy } = bowlingFigures({
        runs: sum(innings, (i) => i.runs),
        balls: sum(innings, (i) => i.balls),
        wickets: sum(innings, (i) => i.wickets),
      });
      const [best] = [...innings].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs);
      return {
        player_id: best.player_id,
        unique_name: best.unique_name,
        innings: innings.length,
        balls,
        runs_conceded,
        wickets,
        economy,
        best_wickets: best.wickets,
        best_runs: best.runs,
      };
    })
    .filter((p) => p.wickets > 0)
    .sort(
      (a, b) =>
        b.wickets - a.wickets ||
        (a.economy ?? Infinity) - (b.economy ?? Infinity) ||
        a.player_id.localeCompare(b.player_id),
    )
    .slice(0, PERFORMERS_SHOWN);
}

export async function rivalry(
  teams: Sides<string>,
  venue: VenueRef | null,
  choice: SeasonChoice,
): Promise<Rivalry> {
  const { from, latest } = await seasonRange(choice);
  const found = await meetingsOf(teams, from);
  const chosen = venue ? found.filter((m) => m.venue_id === venue.venue_id) : found;
  const ids = chosen.map((m) => m.match_id);
  const [scores, knocks, spells] = await Promise.all([
    scoresOf(ids),
    knocksOf(ids),
    spellsOf(ids),
  ]);

  // scores are wanted only for the meetings listed
  const listed = chosen.map((m) =>
    meeting(
      m,
      teams,
      scores
        .filter((s) => s.match_id === m.match_id)
        .map(({ team, runs, wickets, balls }) => ({
          side: (team === teams[0] ? 0 : 1) as Side,
          runs,
          wickets,
          balls,
        })),
    ),
  );
  const every = found.map((m) => meeting(m, teams, []));

  const grounds = [...new Set(found.map((m) => m.venue_id))]
    .map((venueId) => {
      const there = every.filter((m) => m.venue.venue_id === venueId);
      return { ...there[0].venue, record: tally(there) };
    })
    .sort((a, b) => b.record.played - a.record.played || a.name.localeCompare(b.name));

  return {
    teams,
    seasons: { choice, from, to: latest },
    venue,
    overall: tally(every),
    here: venue ? tally(listed) : null,
    grounds,
    meetings: listed,
    batting: [runScorers(knocks, teams[0]), runScorers(knocks, teams[1])],
    bowling: [wicketTakers(spells, teams[0]), wicketTakers(spells, teams[1])],
  };
}
