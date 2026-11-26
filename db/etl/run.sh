#!/usr/bin/env bash
# Populate the running Postgres container from Cricsheet data.
#
#   ./db/etl/run.sh                       # men's Tests + ODIs + T20Is
#   ./db/etl/run.sh https://cricsheet.org/downloads/ipl_json.zip ...
#
# Requires the "postgres" service from docker-compose.yml to be up.
set -euo pipefail

cd "$(dirname "$0")/../.."

OUT=db/etl/_etl
set -a; . ./.env; set +a
PGUSER="${POSTGRES_USER:-cricket}"
PGDB="${POSTGRES_DB:-cricket}"

psql() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDB" "$@"; }

echo "==> extracting Cricsheet data"
python3 db/etl/load_cricsheet.py --out "$OUT" "$@"

echo "==> ensuring schema is current"
psql < db/init/001-schema.sql

echo "==> loading matches + deliveries + player_career_stats"
psql -c 'TRUNCATE matches, deliveries, player_career_stats, era_averages RESTART IDENTITY;'
psql -c "\copy matches(match_id,date,format,venue,city,event,season,team_type,gender,team1,team2,toss_winner,toss_decision,winner,result_margin,player_of_match) FROM STDIN WITH (FORMAT csv, HEADER true)" < "$OUT/matches.csv"
psql -c "\copy deliveries(match_id,date,format,innings,over,ball,batter,non_striker,bowler,runs_batter,extras,extras_type,wicket_type,player_out,venue,batting_team,bowling_team,phase,gender) FROM STDIN WITH (FORMAT csv, HEADER true, FORCE_NOT_NULL (extras_type, wicket_type, player_out, venue, batting_team, bowling_team, phase, gender))" < "$OUT/deliveries.csv"
psql -c "\copy player_career_stats(player_name,format,season,innings_played,runs_scored,outs,balls_faced,fours,sixes) FROM STDIN WITH (FORMAT csv, HEADER true)" < "$OUT/player_career_stats.csv"

echo "==> deriving era_averages"
psql -c "
INSERT INTO era_averages (year, format, avg_strike_rate)
SELECT EXTRACT(YEAR FROM date)::int AS year,
       format,
       ROUND(SUM(runs_batter)::numeric * 100 / NULLIF(COUNT(*), 0), 2)
FROM deliveries
GROUP BY 1, 2
HAVING COUNT(*) > 0;"

echo "==> row counts"
psql -c "SELECT 'matches' t, count(*) FROM matches
         UNION ALL SELECT 'deliveries', count(*) FROM deliveries
         UNION ALL SELECT 'player_career_stats', count(*) FROM player_career_stats
         UNION ALL SELECT 'era_averages', count(*) FROM era_averages;"
echo "done."
