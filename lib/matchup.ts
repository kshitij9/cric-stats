import { query } from '@/lib/db';
import type {
  GroundBatting,
  GroundBowling,
  Matchup,
  Meeting,
  Pair,
  Side,
} from '@/lib/matchup-types';
import { squad } from '@/lib/squad';
import { battingFigures, bowlingFigures, round } from '@/lib/stats';
import type { Team } from '@/lib/teams';
import type { VenueRef } from '@/lib/types';

/**
 * What the players of two teams have done, at a ground and against each other.
 * IPL only, all seasons; which balls and wickets count is as in lib/stats.ts.
 */

// every ball of the IPL matches played at a ground
const AT_GROUND = `
  WITH balls AS (
    SELECT * FROM deliveries
     WHERE match_id IN (SELECT match_id FROM matches
                         WHERE venue_id = $2 AND competition = 'ipl')
  )`;

/** Rows of one innings each, gathered by player. */
function byPlayer<T extends { player_id: string }>(rows: T[]) {
  const players = new Map<string, T[]>();
  for (const row of rows) {
    const theirs = players.get(row.player_id);
    if (theirs) theirs.push(row);
    else players.set(row.player_id, [row]);
  }
  return players;
}

const total = <T>(rows: T[], of: (row: T) => number) =>
  rows.reduce((sum, row) => sum + of(row), 0);

async function battingAt(ids: string[], venueId: string) {
  const rows = await query<{
    player_id: string;
    runs: number;
    balls: number;
    outs: number;
  }>(
    `${AT_GROUND},
     -- an innings: batted, ran as non-striker, or was dismissed without doing either
     appearances AS (
       SELECT batter_id AS player_id, match_id, innings FROM balls
       UNION SELECT non_striker_id, match_id, innings FROM balls
       UNION SELECT w.player_out_id, b.match_id, b.innings
               FROM wickets w JOIN balls b ON b.id = w.delivery_id
     ),
     faced AS (
       SELECT batter_id AS player_id, match_id, innings, sum(runs_batter) AS runs,
              count(*) FILTER (WHERE ball_faced) AS balls
         FROM balls WHERE batter_id = ANY($1::text[]) GROUP BY 1, 2, 3
     ),
     dismissed AS (
       SELECT w.player_out_id AS player_id, b.match_id, b.innings, count(*) AS outs
         FROM wickets w JOIN balls b ON b.id = w.delivery_id
        WHERE w.dismissal AND w.player_out_id = ANY($1::text[]) GROUP BY 1, 2, 3
     )
     SELECT player_id, coalesce(runs, 0) AS runs, coalesce(balls, 0) AS balls,
            coalesce(outs, 0) AS outs
       FROM appearances
       LEFT JOIN faced USING (player_id, match_id, innings)
       LEFT JOIN dismissed USING (player_id, match_id, innings)
      WHERE player_id = ANY($1::text[])`,
    [ids, venueId],
  );
  return new Map<string, GroundBatting>(
    [...byPlayer(rows)].map(([player_id, innings]) => {
      const counts = {
        innings: innings.length,
        runs: total(innings, (i) => i.runs),
        balls: total(innings, (i) => i.balls),
        outs: total(innings, (i) => i.outs),
      };
      const [best] = [...innings].sort(
        (a, b) => b.runs - a.runs || a.outs - b.outs || a.balls - b.balls,
      );
      const { average, strike_rate } = battingFigures({ ...counts, fours: 0, sixes: 0 });
      return [
        player_id,
        {
          ...counts,
          average,
          strike_rate,
          best_runs: best.runs,
          best_balls: best.balls,
          best_not_out: best.outs === 0,
        },
      ];
    }),
  );
}

async function bowlingAt(ids: string[], venueId: string) {
  const rows = await query<{
    player_id: string;
    balls: number;
    runs: number;
    wickets: number;
  }>(
    `${AT_GROUND}
     SELECT b.bowler_id AS player_id,
            count(*) FILTER (WHERE b.legal_ball) AS balls,
            sum(b.bowler_runs)                   AS runs,
            sum(w.taken)                         AS wickets
       FROM balls b
      CROSS JOIN LATERAL (SELECT count(*) AS taken FROM wickets w
                           WHERE w.delivery_id = b.id AND w.bowlers_wicket) w
      WHERE b.bowler_id = ANY($1::text[])
      GROUP BY b.bowler_id, b.match_id, b.innings`,
    [ids, venueId],
  );
  return new Map<string, GroundBowling>(
    [...byPlayer(rows)].map(([player_id, innings]) => {
      const { runs_conceded, balls, wickets, economy } = bowlingFigures({
        runs: total(innings, (i) => i.runs),
        balls: total(innings, (i) => i.balls),
        wickets: total(innings, (i) => i.wickets),
      });
      const [best] = [...innings].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs);
      return [
        player_id,
        {
          innings: innings.length,
          balls,
          runs_conceded,
          wickets,
          economy,
          best_wickets: best.wickets,
          best_runs: best.runs,
        },
      ];
    }),
  );
}

/** Every batter and bowler among these players who have met. */
async function meetings(ids: string[], venueId: string | null): Promise<Pair[]> {
  const [faced, taken] = await Promise.all([
    query<{
      batter_id: string;
      bowler_id: string;
      balls: number;
      runs: number;
      there: number; // deliveries at the ground, wides among them
      balls_there: number;
      runs_there: number;
    }>(
      `SELECT batter_id, bowler_id, count(*) FILTER (WHERE ball_faced) AS balls,
              sum(runs_batter) AS runs,
              count(*) FILTER (WHERE venue_id = $2) AS there,
              count(*) FILTER (WHERE ball_faced AND venue_id = $2) AS balls_there,
              coalesce(sum(runs_batter) FILTER (WHERE venue_id = $2), 0) AS runs_there
         FROM deliveries
        WHERE batter_id = ANY($1::text[]) AND bowler_id = ANY($1::text[])
          AND format = 'T20' AND competition = 'ipl'
        GROUP BY 1, 2`,
      [ids, venueId],
    ),
    query<{ batter_id: string; bowler_id: string; dismissals: number; there: number }>(
      `SELECT w.player_out_id AS batter_id, d.bowler_id, count(*) AS dismissals,
              count(*) FILTER (WHERE d.venue_id = $2) AS there
         FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
        WHERE w.player_out_id = ANY($1::text[]) AND d.bowler_id = ANY($1::text[])
          AND w.bowlers_wicket AND d.format = 'T20' AND d.competition = 'ipl'
        GROUP BY 1, 2`,
      [ids, venueId],
    ),
  ]);
  const out = new Map(taken.map((t) => [`${t.batter_id} ${t.bowler_id}`, t]));
  const meeting = (balls: number, runs: number, dismissals: number): Meeting => ({
    balls,
    runs,
    dismissals,
    strike_rate: balls > 0 ? round((runs * 100) / balls, 2) : null,
  });
  return faced.map((f) => {
    const dismissed = out.get(`${f.batter_id} ${f.bowler_id}`);
    return {
      batter_id: f.batter_id,
      bowler_id: f.bowler_id,
      ...meeting(f.balls, f.runs, dismissed?.dismissals ?? 0),
      at_ground:
        f.there > 0 ? meeting(f.balls_there, f.runs_there, dismissed?.there ?? 0) : null,
    };
  });
}

export async function matchup(teams: [Team, Team], venue: VenueRef | null): Promise<Matchup> {
  const ids = [...new Set(teams.flatMap((t) => t.players))];
  const none = new Map<string, never>();
  const [squads, batting, bowling, pairs] = await Promise.all([
    Promise.all(teams.map((t) => squad(t.players))),
    venue ? battingAt(ids, venue.venue_id) : none,
    venue ? bowlingAt(ids, venue.venue_id) : none,
    meetings(ids, venue?.venue_id ?? null),
  ]);

  const side = (i: 0 | 1): Side => ({
    team_id: teams[i].team_id,
    name: teams[i].name,
    players: squads[i].map((p) => ({
      ...p,
      at_ground: {
        batting: batting.get(p.player_id) ?? null,
        bowling: bowling.get(p.player_id) ?? null,
      },
    })),
    missing: teams[i].players.length - squads[i].length,
  });

  /** The first side's batters against the second side's bowlers. */
  const against = (batters: Team, bowlers: Team) => {
    const facing = new Set(batters.players);
    const bowling = new Set(bowlers.players);
    return (
      pairs
        .filter((p) => facing.has(p.batter_id) && bowling.has(p.bowler_id))
        // the longest contests first; the rest of the order only keeps it steady
        .sort(
          (a, b) =>
            b.balls - a.balls ||
            b.dismissals - a.dismissals ||
            a.batter_id.localeCompare(b.batter_id) ||
            a.bowler_id.localeCompare(b.bowler_id),
        )
    );
  };

  return {
    venue,
    sides: [side(0), side(1)],
    pairs: [against(teams[0], teams[1]), against(teams[1], teams[0])],
  };
}
