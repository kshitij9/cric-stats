-- Sanity checks on freshly loaded data, run by run.sh before it is published.
-- Each row returned is a failure; no rows means the load may go ahead.
WITH expected AS (
    SELECT key AS table_name, value::bigint AS n
    FROM etl_staging._load_manifest, jsonb_each_text(manifest->'row_counts')
),
actual AS (
    SELECT 'matches' AS table_name, count(*) AS n FROM etl_staging.matches
    UNION ALL SELECT 'deliveries', count(*) FROM etl_staging.deliveries
    UNION ALL SELECT 'player_career_stats', count(*) FROM etl_staging.player_career_stats
)
SELECT format('%s: %s rows loaded, %s expected from the source files',
              a.table_name, a.n, coalesce(e.n::text, 'an unknown number'))
FROM actual a
LEFT JOIN expected e USING (table_name)
WHERE a.n IS DISTINCT FROM e.n OR a.n = 0

UNION ALL
SELECT format('%s deliveries belong to no match', count(*))
FROM etl_staging.deliveries d
WHERE NOT EXISTS (SELECT 1 FROM etl_staging.matches m WHERE m.match_id = d.match_id)
HAVING count(*) > 0

UNION ALL
SELECT format('batter runs differ: %s in career table, %s in deliveries', c.runs, d.runs)
FROM (SELECT sum(runs_scored) AS runs FROM etl_staging.player_career_stats) c,
     (SELECT sum(runs_batter) AS runs FROM etl_staging.deliveries) d
WHERE c.runs IS DISTINCT FROM d.runs

UNION ALL
SELECT format('no era average for %s %s', d.format, d.year)
FROM (SELECT DISTINCT extract(year FROM date)::int AS year, format
      FROM etl_staging.deliveries) d
WHERE NOT EXISTS (SELECT 1 FROM etl_staging.era_averages e
                  WHERE e.year = d.year AND e.format = d.format)

UNION ALL
SELECT format('latest match is dated in the future: %s', max(date))
FROM etl_staging.matches
HAVING max(date) > current_date + 1;
