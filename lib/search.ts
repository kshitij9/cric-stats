import { query } from '@/lib/db';
import type { Competition, PlayerSummary, VenueSummary } from '@/lib/types';

/**
 * Finding players and grounds by name. Every word typed must begin some word of
 * one of the names on record, so "virat k", "kohli" and "V Kohli" all find the
 * same player, and punctuation does not matter. Only players and grounds with a
 * match in the competition are found, and their teams, years and match counts
 * are for that competition.
 */

// become spaces; the apostrophe, having no counterpart, is removed
const PUNCTUATION = "-.,'";
const KEY = (column: string) => `translate(lower(${column}), $2, '   ')`;

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[\s.,-]+/)
    .filter(Boolean)
    .slice(0, 6);

/** LIKE patterns, one per word; null if there is too little to search for. */
function patterns(text: string): string[] | null {
  const found = words(text);
  if (found.join('').length < 2) return null;
  return found.map((w) => `% ${w.replace(/[\\%_]/g, '\\$&')}%`);
}

const allWordsMatch = (column: string) => `
  NOT EXISTS (SELECT 1 FROM unnest($1::text[]) w(pattern)
               WHERE ' ' || ${KEY(column)} NOT LIKE w.pattern)`;

export async function searchPlayers(
  text: string,
  competition: Competition,
  gender = '',
): Promise<PlayerSummary[]> {
  const like = patterns(text);
  if (!like) return [];
  return query<PlayerSummary>(
    `WITH names AS (
       SELECT player_id, name AS s FROM players
       UNION ALL SELECT player_id, unique_name FROM players
       UNION ALL SELECT player_id, alias FROM player_aliases
     ),
     hits AS (
       SELECT player_id, bool_or(${KEY('s')} = $3) AS exact
         FROM names
        WHERE ${allWordsMatch('s')}
        GROUP BY player_id
     ),
     sides AS (
       SELECT mp.player_id, a.franchise AS team, count(*) AS n,
              min(m.date) AS first, max(m.date) AS last
         FROM match_players mp
         JOIN matches m ON m.match_id = mp.match_id
         JOIN team_aliases a ON a.competition = m.competition AND a.team_name = mp.team
        WHERE mp.player_id IN (SELECT player_id FROM hits) AND m.competition = $5
        GROUP BY 1, 2
     ),
     records AS (
       SELECT player_id, sum(n)::int AS matches,
              (array_agg(team ORDER BY n DESC, team))[1:3] AS teams,
              extract(year FROM min(first))::int AS first_year,
              extract(year FROM max(last))::int AS last_year
         FROM sides GROUP BY 1
     )
     SELECT p.player_id, p.name, p.unique_name, p.gender,
            (SELECT a.alias FROM player_aliases a
              WHERE a.player_id = p.player_id AND a.alias ~ '^[A-Z][a-z]+ '
                AND a.alias NOT IN (p.name, p.unique_name) AND a.alias !~ '[(]'
              ORDER BY ${KEY('a.alias')} = $3 DESC, length(a.alias), a.alias
              LIMIT 1) AS full_name,
            r.teams, r.matches, r.first_year, r.last_year
       FROM hits h
       JOIN players p ON p.player_id = h.player_id
       JOIN records r ON r.player_id = h.player_id
      WHERE $4 = '' OR p.gender = $4
      ORDER BY h.exact DESC, r.matches DESC, p.unique_name
      LIMIT 12`,
    [like, PUNCTUATION, words(text).join(' '), gender, competition],
  );
}

export async function searchVenues(
  text: string,
  competition: Competition,
): Promise<VenueSummary[]> {
  const like = patterns(text);
  if (!like) return [];
  return query<VenueSummary>(
    `WITH hits AS (
       SELECT DISTINCT venue_id
         FROM (SELECT venue_id, name || ' ' || city AS s FROM venues
               UNION ALL
               SELECT venue_id, venue_name || ' ' || city FROM venue_aliases) names
        WHERE ${allWordsMatch('s')}
     )
     SELECT v.venue_id, v.name, v.city, count(m.match_id)::int AS matches
       FROM hits h
       JOIN venues v ON v.venue_id = h.venue_id
       JOIN matches m ON m.venue_id = v.venue_id AND m.competition = $3
      GROUP BY v.venue_id, v.name, v.city
      -- grounds whose own name matches come before those matching through the city
      ORDER BY (${allWordsMatch('v.name')}) DESC, matches DESC, v.name, v.city
      LIMIT 12`,
    [like, PUNCTUATION, competition],
  );
}
