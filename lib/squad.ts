import { query } from '@/lib/db';
import { battingFigures, bowlingFigures, findPlayers, type Player } from '@/lib/stats';
import { RECENT_MATCHES, TEAM_SIZE, type Franchise, type LineUp, type SquadPlayer } from '@/lib/teams';

/**
 * What the match data says about the players of a team. Teams are IPL teams, so
 * everything here is IPL only. Figures follow the definitions in lib/stats.ts.
 */

/** Those of these players who have been named in an IPL line-up. */
export async function findIplPlayers(ids: string[]): Promise<Map<string, Player>> {
  if (!ids.length) return new Map();
  const rows = await query<{ player_id: string }>(
    `SELECT DISTINCT mp.player_id
       FROM match_players mp JOIN matches m ON m.match_id = mp.match_id
      WHERE mp.player_id = ANY($1::text[]) AND m.competition = 'ipl'`,
    [ids],
  );
  return findPlayers(rows.map((r) => r.player_id));
}

/** In the order asked for; anyone without an IPL match is left out. */
export async function squad(ids: string[]): Promise<SquadPlayer[]> {
  if (!ids.length) return [];
  const [players, records, batting, bowling, recent] = await Promise.all([
    findPlayers(ids),
    query<{ player_id: string; matches: number; last_match: string; teams: string[] }>(
      `WITH sides AS (
         SELECT mp.player_id, a.franchise AS team, count(*) AS n, max(m.date) AS last
           FROM match_players mp
           JOIN matches m ON m.match_id = mp.match_id
           JOIN team_aliases a ON a.competition = m.competition AND a.team_name = mp.team
          WHERE mp.player_id = ANY($1::text[]) AND m.competition = 'ipl'
          GROUP BY 1, 2
       )
       SELECT player_id, sum(n)::int AS matches, max(last)::text AS last_match,
              (array_agg(team ORDER BY last DESC, team))[1:3] AS teams
         FROM sides GROUP BY 1`,
      [ids],
    ),
    query<{ player_id: string; runs: number; balls: number; outs: number }>(
      `SELECT player_id, sum(runs_scored) AS runs, sum(balls_faced) AS balls, sum(outs) AS outs
         FROM player_career_stats
        WHERE player_id = ANY($1::text[]) AND format = 'T20' AND competition = 'ipl'
        GROUP BY 1`,
      [ids],
    ),
    query<{ player_id: string; balls: number; runs: number; wickets: number }>(
      `SELECT d.bowler_id AS player_id,
              count(*) FILTER (WHERE d.legal_ball) AS balls,
              sum(d.bowler_runs)                   AS runs,
              sum(w.taken)                         AS wickets
         FROM deliveries d
        CROSS JOIN LATERAL (SELECT count(*) AS taken FROM wickets w
                             WHERE w.delivery_id = d.id AND w.bowlers_wicket) w
        WHERE d.bowler_id = ANY($1::text[]) AND d.format = 'T20' AND d.competition = 'ipl'
        GROUP BY 1`,
      [ids],
    ),
    query<{ player_id: string; matches: number; bowled: number }>(
      `WITH latest AS (
         SELECT mp.player_id, m.match_id,
                row_number() OVER (PARTITION BY mp.player_id
                                   ORDER BY m.date DESC, m.match_id DESC) AS nth
           FROM match_players mp JOIN matches m ON m.match_id = mp.match_id
          WHERE mp.player_id = ANY($1::text[]) AND m.competition = 'ipl'
       )
       SELECT player_id, count(*)::int AS matches,
              (count(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM deliveries d
                  WHERE d.match_id = latest.match_id AND d.bowler_id = latest.player_id)))::int
                AS bowled
         FROM latest WHERE nth <= $2
        GROUP BY 1`,
      [ids, RECENT_MATCHES],
    ),
  ]);

  const by = <T extends { player_id: string }>(rows: T[]) =>
    new Map(rows.map((r) => [r.player_id, r]));
  const record = by(records);
  const bat = by(batting);
  const bowl = by(bowling);
  const form = by(recent);

  return ids.flatMap((id) => {
    const player = players.get(id);
    const played = record.get(id);
    if (!player || !played) return [];
    const b = bat.get(id) ?? { runs: 0, balls: 0, outs: 0 };
    const w = bowl.get(id) ?? { balls: 0, runs: 0, wickets: 0 };
    const { average, strike_rate } = battingFigures({ ...b, innings: 0, fours: 0, sixes: 0 });
    const { economy } = bowlingFigures(w);
    const latest = form.get(id) ?? { matches: 0, bowled: 0 };
    return [
      {
        player_id: id,
        name: player.name,
        unique_name: player.unique_name,
        teams: played.teams,
        matches: played.matches,
        last_match: played.last_match,
        batting: { runs: b.runs, average, strike_rate },
        bowling: { balls: w.balls, wickets: w.wickets, economy },
        recent_matches: latest.matches,
        recent_bowled: latest.bowled,
        bowls_regularly: latest.bowled > 0 && latest.bowled * 2 >= latest.matches,
      },
    ];
  });
}

// every side of every IPL match, under the franchise's present name
const SIDES = `
  SELECT m.match_id, m.date, t.team, a.franchise
    FROM matches m
   CROSS JOIN LATERAL (VALUES (m.team1), (m.team2)) t(team)
    JOIN team_aliases a ON a.competition = m.competition AND a.team_name = t.team
   WHERE m.competition = 'ipl'`;

/** The franchises that played in the latest season in the data. */
export const franchises = () =>
  query<Franchise>(
    `WITH sides AS (${SIDES})
     SELECT franchise AS team, max(date)::text AS last_match
       FROM sides
      WHERE extract(year FROM date) = (SELECT extract(year FROM max(date)) FROM sides)
      GROUP BY 1 ORDER BY 1`,
  );

// how many of the side's latest matches decide who is left out of twelve
const REGULAR_OVER = 20;

/**
 * The players named in a franchise's latest match; null for an unknown name.
 * Those who batted come in the order they came in, then the rest by where they
 * usually bat. Where twelve were named (the impact player rule), the one who
 * has featured least in the side's last few matches is left out.
 */
export async function lineUp(name: string): Promise<LineUp | null> {
  const [latest] = await query<{ match_id: string; team: string; franchise: string; date: string }>(
    `WITH sides AS (${SIDES})
     SELECT match_id, team, franchise, date::text AS date FROM sides
      WHERE franchise = $1 ORDER BY date DESC, match_id DESC LIMIT 1`,
    [name],
  );
  if (!latest) return null;

  const named = await query<{
    player_id: string;
    unique_name: string;
    came_in: number | null;
    usual: number | null;
    regular: number;
    involved: number;
  }>(
    `WITH named AS (
       SELECT player_id FROM match_players WHERE match_id = $1 AND team = $2
     ),
     recent_side AS (
       SELECT match_id, team FROM (${SIDES}) s
        WHERE franchise = $3 ORDER BY date DESC, match_id DESC LIMIT $4
     ),
     -- the latest matches in which each of them played
     latest AS (
       SELECT match_id FROM (
         SELECT mp.match_id,
                row_number() OVER (PARTITION BY mp.player_id
                                   ORDER BY m.date DESC, m.match_id DESC) AS nth
           FROM match_players mp JOIN matches m ON m.match_id = mp.match_id
          WHERE mp.player_id IN (SELECT player_id FROM named) AND m.competition = 'ipl'
       ) x WHERE nth <= $5
     ),
     -- ball ids run in the order bowled; the striker comes before the other end
     seen AS (
       SELECT d.match_id, d.innings, e.player_id, min(d.id * 2 + e.end_no) AS first
         FROM deliveries d
        CROSS JOIN LATERAL (VALUES (d.batter_id, 0), (d.non_striker_id, 1)) e(player_id, end_no)
        WHERE d.match_id IN (SELECT match_id FROM latest)
        GROUP BY 1, 2, 3
     ),
     positions AS (
       SELECT match_id, player_id,
              rank() OVER (PARTITION BY match_id, innings ORDER BY first)::int AS position
         FROM seen
     ),
     usual AS (
       SELECT player_id,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY position) AS position
         FROM positions p
        WHERE player_id IN (SELECT player_id FROM named)
          AND EXISTS (SELECT 1 FROM match_players mp
                       WHERE mp.match_id = p.match_id AND mp.player_id = p.player_id)
        GROUP BY 1
     )
     SELECT n.player_id, pl.unique_name,
            (SELECT min(position) FROM positions p
              WHERE p.match_id = $1 AND p.player_id = n.player_id) AS came_in,
            u.position AS usual,
            (SELECT count(*)::int FROM match_players mp JOIN recent_side r
                 ON r.match_id = mp.match_id AND r.team = mp.team
              WHERE mp.player_id = n.player_id) AS regular,
            (SELECT count(*)::int FROM deliveries d
              WHERE d.match_id = $1
                AND (d.batter_id = n.player_id OR d.bowler_id = n.player_id)) AS involved
       FROM named n
       JOIN players pl ON pl.player_id = n.player_id
       LEFT JOIN usual u ON u.player_id = n.player_id`,
    [latest.match_id, latest.team, latest.franchise, REGULAR_OVER, RECENT_MATCHES],
  );

  const least = [...named].sort(
    (a, b) =>
      a.regular - b.regular || a.involved - b.involved || a.player_id.localeCompare(b.player_id),
  );
  const out = new Set(least.slice(0, Math.max(0, named.length - TEAM_SIZE)).map((p) => p.player_id));
  const last = Number.MAX_SAFE_INTEGER;
  const ordered = [...named].sort(
    (a, b) =>
      (a.came_in ?? last) - (b.came_in ?? last) ||
      (a.usual ?? last) - (b.usual ?? last) ||
      a.unique_name.localeCompare(b.unique_name),
  );

  return {
    team: latest.franchise,
    last_match: latest.date,
    players: ordered.filter((p) => !out.has(p.player_id)).map((p) => p.player_id),
    left_out: ordered
      .filter((p) => out.has(p.player_id))
      .map(({ player_id, unique_name }) => ({ player_id, unique_name })),
  };
}
