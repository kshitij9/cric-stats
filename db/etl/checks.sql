-- Sanity checks on freshly loaded data, run by run.sh before it is published.
-- Each row returned is a failure; no rows means the load may go ahead.
-- (db/etl/verify.py compares the loaded data with the source files themselves.)
SET search_path = etl_staging;

WITH expected AS (
    SELECT key AS table_name, value::bigint AS n
    FROM _load_manifest, jsonb_each_text(manifest->'row_counts')
),
actual AS (
    SELECT 'matches' AS table_name, count(*) AS n FROM matches
    UNION ALL SELECT 'deliveries',     count(*) FROM deliveries
    UNION ALL SELECT 'wickets',        count(*) FROM wickets
    UNION ALL SELECT 'match_players',  count(*) FROM match_players
    UNION ALL SELECT 'players',        count(*) FROM players
    UNION ALL SELECT 'player_aliases', count(*) FROM player_aliases
    UNION ALL SELECT 'venues',         count(*) FROM venues
    UNION ALL SELECT 'venue_aliases',  count(*) FROM venue_aliases
    UNION ALL SELECT 'team_aliases',   count(*) FROM team_aliases
    UNION ALL SELECT '_player_splits', count(*) FROM _player_splits
)
SELECT format('%s: %s rows loaded, %s expected from the source files',
              a.table_name, a.n, coalesce(e.n::text, 'an unknown number'))
FROM actual a
LEFT JOIN expected e USING (table_name)
WHERE a.n IS DISTINCT FROM e.n
   -- these may legitimately be empty
   OR (a.n = 0 AND a.table_name NOT IN ('wickets', 'player_aliases', '_player_splits'))

UNION ALL
SELECT format('%s deliveries belong to no match', count(*))
FROM deliveries d
WHERE NOT EXISTS (SELECT 1 FROM matches m WHERE m.match_id = d.match_id)
HAVING count(*) > 0

UNION ALL
SELECT format('%s wickets belong to no delivery', count(*))
FROM wickets w
WHERE NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.id = w.delivery_id)
HAVING count(*) > 0

UNION ALL
SELECT format('%s player references have no row in players', count(*))
FROM (SELECT batter_id AS player_id FROM deliveries
      UNION SELECT non_striker_id FROM deliveries
      UNION SELECT bowler_id FROM deliveries
      UNION SELECT player_out_id FROM wickets
      UNION SELECT player_id FROM match_players
      UNION SELECT player_id FROM player_aliases) used
WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.player_id = used.player_id)
HAVING count(*) > 0

UNION ALL
SELECT format('%s players appear in both men''s and women''s matches', count(*))
FROM (SELECT p.player_id
        FROM match_players p JOIN matches m USING (match_id)
       GROUP BY p.player_id HAVING count(DISTINCT m.gender) > 1) mixed
HAVING count(*) > 0

UNION ALL
SELECT format('%s matches with a venue have no venue ID', count(*))
FROM matches m
WHERE coalesce(m.venue, '') <> ''
  AND NOT EXISTS (SELECT 1 FROM venues v WHERE v.venue_id = m.venue_id)
HAVING count(*) > 0

UNION ALL
SELECT format('%s deliveries have a venue ID that differs from their match', count(*))
FROM deliveries d JOIN matches m USING (match_id)
WHERE d.venue_id IS DISTINCT FROM m.venue_id
HAVING count(*) > 0

UNION ALL
SELECT format('%s deliveries differ from their match in format or competition', count(*))
FROM deliveries d JOIN matches m USING (match_id)
WHERE d.format <> m.format OR d.competition <> m.competition
HAVING count(*) > 0

UNION ALL
SELECT format('%s sides have no row in team_aliases', count(*))
FROM (SELECT DISTINCT m.competition, t.team
        FROM matches m CROSS JOIN LATERAL (VALUES (m.team1), (m.team2)) t(team)) used
WHERE NOT EXISTS (SELECT 1 FROM team_aliases a
                   WHERE a.competition = used.competition
                     AND a.team_name = coalesce(used.team, ''))
  AND coalesce(used.team, '') <> ''
HAVING count(*) > 0

UNION ALL
SELECT format('%s deliveries have extras that do not add up', count(*))
FROM deliveries
WHERE extras <> wides + noballs + byes + legbyes + penalty
HAVING count(*) > 0

UNION ALL
SELECT format('batter runs differ: %s in career table, %s in deliveries', c.runs, d.runs)
FROM (SELECT sum(runs_scored) AS runs FROM player_career_stats) c,
     (SELECT sum(runs_batter) AS runs FROM deliveries) d
WHERE c.runs IS DISTINCT FROM d.runs

UNION ALL
SELECT format('dismissals differ: %s in career table, %s in wickets', c.n, w.n)
FROM (SELECT coalesce(sum(outs), 0) AS n FROM player_career_stats) c,
     (SELECT count(*) AS n FROM wickets WHERE dismissal) w
WHERE c.n <> w.n

UNION ALL
SELECT format('no era average for %s %s %s %s', d.gender, d.competition, d.format, d.year)
FROM (SELECT DISTINCT extract(year FROM date)::int AS year, format, competition, gender
      FROM deliveries WHERE ball_faced) d
WHERE NOT EXISTS (SELECT 1 FROM era_averages e
                  WHERE e.year = d.year AND e.format = d.format
                    AND e.competition = d.competition AND e.gender = d.gender)

UNION ALL
SELECT format('latest match is dated in the future: %s', max(date))
FROM matches
HAVING max(date) > current_date + 1;
