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
-- player_career_stats: one row per player, format, competition and calendar year.
--   innings   batted, ran as non-striker, or was dismissed without doing either
--   balls     balls faced
--   outs      dismissals
--   fours/sixes  boundaries only; all-run fours and sixes are runs, not these
-- (what is a ball faced or a dismissal is defined in db/init/001-schema.sql)
-- ---------------------------------------------------------------------------
WITH appearances AS (
    SELECT batter_id AS player_id, match_id, innings, format, competition, date FROM deliveries
    UNION
    SELECT non_striker_id, match_id, innings, format, competition, date FROM deliveries
    UNION
    SELECT w.player_out_id, d.match_id, d.innings, d.format, d.competition, d.date
      FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
),
innings AS (
    SELECT player_id, format, competition, extract(year FROM date)::int AS season,
           count(*) AS n
      FROM appearances GROUP BY 1, 2, 3, 4
),
batting AS (
    SELECT batter_id AS player_id, format, competition,
           extract(year FROM date)::int AS season,
           sum(runs_batter)                                     AS runs,
           count(*) FILTER (WHERE ball_faced)                   AS balls,
           count(*) FILTER (WHERE boundary AND runs_batter = 4) AS fours,
           count(*) FILTER (WHERE boundary AND runs_batter = 6) AS sixes
      FROM deliveries GROUP BY 1, 2, 3, 4
),
dismissals AS (
    SELECT w.player_out_id AS player_id, d.format, d.competition,
           extract(year FROM d.date)::int AS season, count(*) AS outs
      FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
     WHERE w.dismissal
     GROUP BY 1, 2, 3, 4
)
INSERT INTO player_career_stats (player_id, player_name, format, competition, season,
    innings_played, runs_scored, outs, balls_faced, fours, sixes)
SELECT i.player_id, p.name, i.format, i.competition, i.season, i.n,
       coalesce(b.runs, 0), coalesce(o.outs, 0), coalesce(b.balls, 0),
       coalesce(b.fours, 0), coalesce(b.sixes, 0)
  FROM innings i
  JOIN players p USING (player_id)
  LEFT JOIN batting b    USING (player_id, format, competition, season)
  LEFT JOIN dismissals o USING (player_id, format, competition, season);

-- ---------------------------------------------------------------------------
-- era_averages: runs off the bat per 100 balls faced, by year, format,
-- competition and gender.
-- ---------------------------------------------------------------------------
INSERT INTO era_averages (year, format, competition, gender, runs, balls, avg_strike_rate)
SELECT extract(year FROM date)::int, format, competition, gender,
       sum(runs_batter),
       count(*) FILTER (WHERE ball_faced),
       round(sum(runs_batter)::numeric * 100 / count(*) FILTER (WHERE ball_faced), 2)
  FROM deliveries
 GROUP BY 1, 2, 3, 4
HAVING count(*) FILTER (WHERE ball_faced) > 0;

ANALYZE venues;
ANALYZE venue_aliases;
ANALYZE team_aliases;
ANALYZE players;
ANALYZE player_aliases;
ANALYZE matches;
ANALYZE match_players;
ANALYZE deliveries;
ANALYZE wickets;
ANALYZE player_career_stats;
ANALYZE era_averages;
