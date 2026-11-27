import { query } from '@/lib/db';
import type { Competition, Coverage, Format, Scope } from '@/lib/types';

/**
 * What the data covers, and which careers it may only hold in part.
 *
 * The source holds the IPL from its first season. Its early years of
 * international cricket are thin: a career whose first match in the data falls
 * before these dates may have started earlier, or be missing matches:
 *   men     Tests from late 2001 and ODIs from mid-2002, filling in by 2004.
 *           T20 internationals are covered from the first one, in 2005.
 *   women   far fewer matches a year before 2018 than from then on.
 */
const FULLER_FROM: Record<string, Partial<Record<Format, string>>> = {
  male: { Test: '2004-01-01', ODI: '2004-07-01' },
  female: { Test: '2018-01-01', ODI: '2018-01-01', T20: '2018-01-01' },
};

export type Span = { first_match: string; last_match: string; may_be_incomplete: boolean };

/** First and last match in the data for each of these players, in one scope. */
export async function careerSpans(
  ids: string[],
  { format, competition }: Scope,
): Promise<Map<string, Span>> {
  const rows = await query<{ player_id: string; gender: string; first_match: string; last_match: string }>(
    `SELECT mp.player_id, p.gender,
            min(m.date)::text AS first_match, max(m.date)::text AS last_match
       FROM match_players mp
       JOIN matches m ON m.match_id = mp.match_id
       JOIN players p ON p.player_id = mp.player_id
      WHERE mp.player_id = ANY($1::text[]) AND m.format = $2 AND m.competition = $3
      GROUP BY 1, 2`,
    [ids, format, competition],
  );
  return new Map(
    rows.map((r) => {
      const fuller =
        competition === 'international' ? FULLER_FROM[r.gender]?.[format] : undefined;
      return [
        r.player_id,
        {
          first_match: r.first_match,
          last_match: r.last_match,
          may_be_incomplete: fuller !== undefined && r.first_match < fuller,
        },
      ];
    }),
  );
}

export async function coverage(competition: Competition): Promise<Coverage> {
  const formats = await query<Coverage['formats'][number]>(
    `SELECT format, gender, count(*)::int AS matches,
            min(date)::text AS "from", max(date)::text AS "to"
       FROM matches WHERE competition = $1 GROUP BY 1, 2 ORDER BY 1, 2`,
    [competition],
  );
  const teams = await query<{ gender: string; teams: string[] }>(
    `SELECT m.gender, array_agg(DISTINCT a.franchise ORDER BY a.franchise) AS teams
       FROM matches m
      CROSS JOIN LATERAL (VALUES (m.team1), (m.team2)) t(team)
       JOIN team_aliases a ON a.competition = m.competition AND a.team_name = t.team
      WHERE m.competition = $1
      GROUP BY 1`,
    [competition],
  );
  const [load] = await query<{ loaded_at: Date }>(
    `SELECT loaded_at FROM data_loads ORDER BY load_id DESC LIMIT 1`,
  );
  return {
    from: formats.map((f) => f.from).sort()[0],
    to: formats.map((f) => f.to).sort().at(-1)!,
    loaded_at: load?.loaded_at.toISOString() ?? null,
    formats,
    teams: Object.fromEntries(teams.map((t) => [t.gender, t.teams])),
  };
}
