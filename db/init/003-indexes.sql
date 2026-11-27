-- Secondary indexes, apart from the tables so db/etl/run.sh can build them after
-- the data is in. Names are unqualified, as in 001-schema.sql.

CREATE INDEX IF NOT EXISTS idx_matches_format   ON matches (format);
CREATE INDEX IF NOT EXISTS idx_matches_venue_id ON matches (venue_id);

CREATE INDEX IF NOT EXISTS idx_players_name       ON players (name);
CREATE INDEX IF NOT EXISTS idx_player_aliases_low ON player_aliases (lower(alias));
CREATE INDEX IF NOT EXISTS idx_match_players_player ON match_players (player_id);

-- recommender discovery mode scans a whole (format, competition, gender) slice
CREATE INDEX IF NOT EXISTS idx_deliveries_fmt_comp      ON deliveries (format, competition, gender);
-- one player's record
CREATE INDEX IF NOT EXISTS idx_deliveries_batter_id ON deliveries (batter_id, format);
CREATE INDEX IF NOT EXISTS idx_deliveries_bowler_id ON deliveries (bowler_id, format);
CREATE INDEX IF NOT EXISTS idx_deliveries_match     ON deliveries (match_id);

CREATE INDEX IF NOT EXISTS idx_wickets_player ON wickets (player_out_id);
