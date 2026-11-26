-- Run by run.sh on the staging tables, after loading and indexing them: finishes
-- player identities, then builds the summary tables from the ball-by-ball data.
SET search_path = etl_staging;

-- ---------------------------------------------------------------------------
-- An ID the source uses for both men's and women's matches is two people. Move
-- the listed gender's rows to the new ID.
-- ---------------------------------------------------------------------------
UPDATE deliveries d SET batter_id = s.new_player_id
  FROM _player_splits s WHERE d.batter_id = s.player_id AND d.gender = s.gender;
UPDATE deliveries d SET non_striker_id = s.new_player_id
  FROM _player_splits s WHERE d.non_striker_id = s.player_id AND d.gender = s.gender;
UPDATE deliveries d SET bowler_id = s.new_player_id
  FROM _player_splits s WHERE d.bowler_id = s.player_id AND d.gender = s.gender;
UPDATE wickets w SET player_out_id = s.new_player_id
  FROM _player_splits s, deliveries d
 WHERE w.player_out_id = s.player_id AND d.id = w.delivery_id AND d.gender = s.gender;
UPDATE match_players p SET player_id = s.new_player_id
  FROM _player_splits s, matches m
 WHERE p.player_id = s.player_id AND m.match_id = p.match_id AND m.gender = s.gender;

-- ---------------------------------------------------------------------------
-- player_career_stats: one row per player, format and calendar year.
--   innings   batted, ran as non-striker, or was dismissed without doing either
--   balls     deliveries faced, not counting wides
--   outs      every wicket kind except retired hurt and retired not out
--   fours/sixes  boundaries only; all-run fours and sixes are runs, not these
-- ---------------------------------------------------------------------------
WITH appearances AS (
    SELECT batter_id AS player_id, match_id, innings, format, date FROM deliveries
    UNION
    SELECT non_striker_id, match_id, innings, format, date FROM deliveries
    UNION
    SELECT w.player_out_id, d.match_id, d.innings, d.format, d.date
      FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
),
innings AS (
    SELECT player_id, format, extract(year FROM date)::int AS season, count(*) AS n
      FROM appearances GROUP BY 1, 2, 3
),
batting AS (
    SELECT batter_id AS player_id, format, extract(year FROM date)::int AS season,
           sum(runs_batter)                                     AS runs,
           count(*) FILTER (WHERE wides = 0)                    AS balls,
           count(*) FILTER (WHERE boundary AND runs_batter = 4) AS fours,
           count(*) FILTER (WHERE boundary AND runs_batter = 6) AS sixes
      FROM deliveries GROUP BY 1, 2, 3
),
dismissals AS (
    SELECT w.player_out_id AS player_id, d.format,
           extract(year FROM d.date)::int AS season, count(*) AS outs
      FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
     WHERE w.kind NOT IN ('retired hurt', 'retired not out')
     GROUP BY 1, 2, 3
)
INSERT INTO player_career_stats (player_id, player_name, format, season,
    innings_played, runs_scored, outs, balls_faced, fours, sixes)
SELECT i.player_id, p.name, i.format, i.season, i.n,
       coalesce(b.runs, 0), coalesce(o.outs, 0), coalesce(b.balls, 0),
       coalesce(b.fours, 0), coalesce(b.sixes, 0)
  FROM innings i
  JOIN players p USING (player_id)
  LEFT JOIN batting b    USING (player_id, format, season)
  LEFT JOIN dismissals o USING (player_id, format, season);

-- ---------------------------------------------------------------------------
-- era_averages: runs off the bat per 100 deliveries, by year and format.
-- ---------------------------------------------------------------------------
INSERT INTO era_averages (year, format, avg_strike_rate)
SELECT extract(year FROM date)::int, format,
       round(sum(runs_batter)::numeric * 100 / nullif(count(*), 0), 2)
  FROM deliveries
 GROUP BY 1, 2
HAVING count(*) > 0;

ANALYZE venues;
ANALYZE venue_aliases;
ANALYZE players;
ANALYZE player_aliases;
ANALYZE matches;
ANALYZE match_players;
ANALYZE deliveries;
ANALYZE wickets;
ANALYZE player_career_stats;
ANALYZE era_averages;
