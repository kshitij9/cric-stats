import { outcomeOf } from './outcomes';
import type { Ball, PastMatch } from './types';

/** Reads every IPL match, in date order, from the match database. */
export type Query = <T>(sql: string) => Promise<T[]>;

export async function loadMatches(query: Query): Promise<PastMatch[]> {
  const matches = await query<{
    match_id: string;
    date: string;
    venue_id: string;
    team1: string;
    team2: string;
    winner: string | null;
    result_method: string | null;
  }>(
    `SELECT match_id, date::text AS date, venue_id, team1, team2,
            coalesce(winner, eliminator, bowl_out) AS winner, result_method
       FROM matches WHERE competition = 'ipl' ORDER BY date, match_id`,
  );
  const franchise = new Map(
    (
      await query<{ team_name: string; franchise: string }>(
        `SELECT team_name, franchise FROM team_aliases WHERE competition = 'ipl'`,
      )
    ).map((r) => [r.team_name, r.franchise]),
  );
  const players = await query<{ match_id: string; team: string; player_id: string }>(
    `SELECT mp.match_id, mp.team, mp.player_id
       FROM match_players mp JOIN matches m ON m.match_id = mp.match_id
      WHERE m.competition = 'ipl' ORDER BY mp.match_id, mp.team, mp.player_id`,
  );
  const wickets = await query<{
    delivery_id: string | number;
    player_out_id: string;
    dismissal: boolean;
    bowlers_wicket: boolean;
  }>(
    `SELECT w.delivery_id, w.player_out_id, w.dismissal, w.bowlers_wicket
       FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
      WHERE d.competition = 'ipl' AND d.format = 'T20' AND w.dismissal`,
  );
  const out = new Map<number, { ids: string[]; bowler: boolean }>();
  for (const w of wickets) {
    const key = Number(w.delivery_id);
    const entry = out.get(key) ?? { ids: [], bowler: false };
    entry.ids.push(w.player_out_id);
    entry.bowler ||= w.bowlers_wicket;
    out.set(key, entry);
  }
  const deliveries = await query<{
    id: string | number;
    match_id: string;
    innings: number;
    over: number;
    batter_id: string;
    non_striker_id: string;
    bowler_id: string;
    runs_batter: number;
    extras: number;
    wides: number;
    noballs: number;
    byes: number;
    batting_team: string;
  }>(
    `SELECT id, match_id, innings, over, batter_id, non_striker_id, bowler_id, runs_batter,
            extras, wides, noballs, byes + legbyes AS byes, batting_team
       FROM deliveries WHERE competition = 'ipl' AND format = 'T20' ORDER BY id`,
  );

  const balls = new Map<string, Ball[]>();
  const battedFirst = new Map<string, string>();
  for (const d of deliveries) {
    if (d.innings > 2) continue;
    const wicket = out.get(Number(d.id));
    let list = balls.get(d.match_id);
    if (!list) balls.set(d.match_id, (list = []));
    if (d.innings === 1) battedFirst.set(d.match_id, d.batting_team);
    list.push({
      innings: d.innings,
      over: d.over,
      batter: d.batter_id,
      nonStriker: d.non_striker_id,
      bowler: d.bowler_id,
      runsBatter: d.runs_batter,
      runs: d.runs_batter + d.extras,
      faced: d.wides === 0,
      legal: d.wides === 0 && d.noballs === 0,
      outcome: outcomeOf({
        runsBatter: d.runs_batter,
        wides: d.wides,
        noballs: d.noballs,
        byes: d.byes,
        bowlerWicket: wicket?.bowler ?? false,
        otherOut: wicket !== undefined && !wicket.bowler,
      }),
      out: wicket?.ids ?? [],
    });
  }

  const named = new Map<string, string[]>();
  for (const p of players) {
    const key = `${p.match_id} ${p.team}`;
    let list = named.get(key);
    if (!list) named.set(key, (list = []));
    list.push(p.player_id);
  }

  return matches.map((m) => {
    const teams = [m.team1, m.team2];
    const played = balls.get(m.match_id) ?? [];
    const first = played.filter((b) => b.innings === 1);
    const legal = first.filter((b) => b.legal).length;
    const lost = first.reduce((n, b) => n + b.out.length, 0);
    const index = (team: string | null | undefined) =>
      team === m.team1 ? 0 : team === m.team2 ? 1 : null;
    return {
      id: m.match_id,
      date: m.date,
      season: Number(m.date.slice(0, 4)),
      venueId: m.venue_id,
      teams: teams.map((t) => franchise.get(t) ?? t) as [string, string],
      named: teams.map((t) => named.get(`${m.match_id} ${t}`) ?? []) as [string[], string[]],
      battingFirst: index(battedFirst.get(m.match_id)),
      winner: index(m.winner),
      shortened: m.result_method !== null || (legal < 120 && lost < 10),
      balls: played,
    };
  });
}
