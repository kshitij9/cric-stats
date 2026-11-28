import { query } from '@/lib/db';
import type { ByPhase, FaceOff, PhaseKey, TeamFigures } from '@/lib/faceoff-types';
import { currentGrounds, seasonRange } from '@/lib/ground';
import type { SeasonChoice } from '@/lib/matchup-types';
import { battingFigures, bowlingFigures, round } from '@/lib/stats';
import type { Team } from '@/lib/teams';
import type { VenueRef } from '@/lib/types';

/**
 * The figures of a team: every IPL ball its present players have faced and
 * bowled in the seasons chosen, for whichever side they were then playing, added
 * together. So those who have played more count for more. Which balls and
 * wickets count is as in lib/stats.ts; phases are by over number.
 */

type Counts = {
  faced: number;
  scored: number;
  boundaries: number;
  outs: number;
  bowled: number;
  conceded: number;
  wickets: number;
};

type Row = { player_id: string; phase: string; venue_id: string | null } & Partial<Counts>;

const PHASES: PhaseKey[] = ['all', 'powerplay', 'middle', 'death'];

// $1 players, $2 the first season counted
const THEIRS = (player: string) => `
  ${player} = ANY($1::text[]) AND d.format = 'T20' AND d.competition = 'ipl'
  AND d.date >= make_date($2::int, 1, 1)`;

/** What each player did, by phase and ground. */
async function counts(ids: string[], from: number): Promise<Row[]> {
  const values = [ids, from];
  const found = await Promise.all([
    query<Row>(
      `SELECT d.batter_id AS player_id, d.phase, d.venue_id,
              count(*) FILTER (WHERE d.ball_faced) AS faced,
              sum(d.runs_batter) AS scored,
              count(*) FILTER (WHERE d.boundary AND d.runs_batter IN (4, 6)) AS boundaries
         FROM deliveries d WHERE ${THEIRS('d.batter_id')}
        GROUP BY 1, 2, 3`,
      values,
    ),
    // a dismissal counts for the player out, at either end
    query<Row>(
      `SELECT w.player_out_id AS player_id, d.phase, d.venue_id, count(*) AS outs
         FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
        WHERE w.dismissal AND ${THEIRS('w.player_out_id')}
        GROUP BY 1, 2, 3`,
      values,
    ),
    query<Row>(
      `SELECT d.bowler_id AS player_id, d.phase, d.venue_id,
              count(*) FILTER (WHERE d.legal_ball) AS bowled,
              sum(d.bowler_runs) AS conceded,
              sum(w.taken) AS wickets
         FROM deliveries d
        CROSS JOIN LATERAL (SELECT count(*) AS taken FROM wickets w
                             WHERE w.delivery_id = d.id AND w.bowlers_wicket) w
        WHERE ${THEIRS('d.bowler_id')}
        GROUP BY 1, 2, 3`,
      values,
    ),
  ]);
  return found.flat();
}

function figures(rows: Row[]): TeamFigures {
  const sum = (key: keyof Counts) => rows.reduce((total, r) => total + (r[key] ?? 0), 0);
  const balls = sum('faced');
  const runs = sum('scored');
  const batting = battingFigures({
    innings: 0,
    runs,
    balls,
    outs: sum('outs'),
    fours: 0,
    sixes: 0,
  });
  const bowling = bowlingFigures({
    runs: sum('conceded'),
    balls: sum('bowled'),
    wickets: sum('wickets'),
  });
  return {
    batting: {
      balls,
      runs,
      strike_rate: batting.strike_rate,
      boundary_percent: balls > 0 ? round((sum('boundaries') * 100) / balls, 1) : null,
      balls_per_dismissal: batting.balls_per_dismissal,
    },
    bowling: {
      balls: bowling.balls,
      runs_conceded: bowling.runs_conceded,
      wickets: bowling.wickets,
      economy: bowling.economy,
      balls_per_wicket: bowling.strike_rate,
    },
  };
}

const byPhase = (rows: Row[]) =>
  Object.fromEntries(
    PHASES.map((phase) => [
      phase,
      figures(phase === 'all' ? rows : rows.filter((r) => r.phase === phase)),
    ]),
  ) as ByPhase;

export async function faceOff(
  teams: [Team, Team],
  venue: VenueRef | null,
  choice: SeasonChoice,
): Promise<FaceOff> {
  const { from, latest } = await seasonRange(choice);
  const ids = [...new Set(teams.flatMap((t) => t.players))];
  const [rows, current] = await Promise.all([counts(ids, from), currentGrounds()]);

  const of = (team: Team) => {
    const players = new Set(team.players);
    return rows.filter((r) => players.has(r.player_id));
  };
  const theirs = [of(teams[0]), of(teams[1])];
  const at = (side: Row[], venueId: string) => side.filter((r) => r.venue_id === venueId);
  const side = (i: 0 | 1) => ({
    all: byPhase(theirs[i]),
    ground: venue ? byPhase(at(theirs[i], venue.venue_id)) : null,
  });
  const listed: VenueRef[] = current.map(({ venue_id, name, city }) => ({ venue_id, name, city }));
  if (venue && !listed.some((g) => g.venue_id === venue.venue_id)) listed.push(venue);
  const named = ({ team_id, name }: Team) => ({ team_id, name });

  return {
    venue,
    seasons: { choice, from, to: latest },
    teams: [named(teams[0]), named(teams[1])],
    sides: [side(0), side(1)],
    grounds: listed.map((g) => ({
      ...g,
      sides: [figures(at(theirs[0], g.venue_id)), figures(at(theirs[1], g.venue_id))],
    })),
  };
}
