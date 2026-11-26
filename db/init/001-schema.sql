-- Postgres auto-runs any *.sql placed here on first container start
-- (only when the data directory is empty). db/etl/run.sh also pipes this file
-- through psql before every load, so an existing volume picks up changes here
-- too -- every statement is written to be idempotent.

-- ---------------------------------------------------------------------------
-- matches: one row per match, the context the ball-by-ball feed hangs off.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
    match_id        TEXT PRIMARY KEY,
    date            DATE NOT NULL,
    format          TEXT NOT NULL,
    venue           TEXT,
    city            TEXT,
    event           TEXT,
    season          TEXT,
    team_type       TEXT,
    gender          TEXT,
    team1           TEXT,
    team2           TEXT,
    toss_winner     TEXT,
    toss_decision   TEXT,          -- 'bat' | 'field'
    winner          TEXT,          -- NULL for tie / no result / draw
    result_margin   TEXT,          -- '7 wickets', '45 runs', 'tie', ...
    player_of_match TEXT
);
CREATE INDEX IF NOT EXISTS idx_matches_venue  ON matches (venue);
CREATE INDEX IF NOT EXISTS idx_matches_format ON matches (format);

-- ---------------------------------------------------------------------------
-- deliveries: ball-by-ball. A handful of match/innings context columns are
-- denormalised on here so the hot-path stat queries never need a join.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliveries (
    id            BIGSERIAL PRIMARY KEY,
    match_id      TEXT      NOT NULL,
    date          DATE      NOT NULL,
    format        TEXT      NOT NULL,
    innings       SMALLINT  NOT NULL,
    over          SMALLINT  NOT NULL,
    ball          SMALLINT  NOT NULL,
    batter        TEXT      NOT NULL,
    non_striker   TEXT      NOT NULL,
    bowler        TEXT      NOT NULL,
    runs_batter   SMALLINT  NOT NULL DEFAULT 0,
    extras        SMALLINT  NOT NULL DEFAULT 0,
    extras_type   TEXT      NOT NULL DEFAULT '',
    wicket_type   TEXT      NOT NULL DEFAULT '',
    player_out    TEXT      NOT NULL DEFAULT '',    -- who was dismissed (striker OR non-striker on run-outs)
    venue         TEXT      NOT NULL DEFAULT '',
    batting_team  TEXT      NOT NULL DEFAULT '',
    bowling_team  TEXT      NOT NULL DEFAULT '',
    phase         TEXT      NOT NULL DEFAULT 'na',  -- powerplay | middle | death | na (Tests)
    gender        TEXT      NOT NULL DEFAULT ''     -- 'male' | 'female' (from matches)
);

-- pre-existing volumes: backfill the columns added after the first cut
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS player_out   TEXT NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS venue        TEXT NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS batting_team TEXT NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS bowling_team TEXT NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS phase        TEXT NOT NULL DEFAULT 'na';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS gender       TEXT NOT NULL DEFAULT '';

-- Every stats query filters deliveries by batter first, then aggregates.
CREATE INDEX IF NOT EXISTS idx_deliveries_batter        ON deliveries (batter);
CREATE INDEX IF NOT EXISTS idx_deliveries_batter_bowler ON deliveries (batter, bowler);
CREATE INDEX IF NOT EXISTS idx_deliveries_batter_venue  ON deliveries (batter, venue);
-- recommender discovery mode scans a whole (format, gender) slice
CREATE INDEX IF NOT EXISTS idx_deliveries_fmt_gender    ON deliveries (format, gender);

CREATE TABLE IF NOT EXISTS player_career_stats (
    player_name     TEXT    NOT NULL,
    format          TEXT    NOT NULL,
    season          INTEGER NOT NULL, -- grain assumption: one row per player/format/season; confirm against the future ETL
    innings_played  INTEGER NOT NULL DEFAULT 0,
    runs_scored     INTEGER NOT NULL DEFAULT 0,
    outs            INTEGER NOT NULL DEFAULT 0,
    balls_faced     INTEGER NOT NULL DEFAULT 0,
    fours           INTEGER NOT NULL DEFAULT 0,
    sixes           INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_name, format, season)
);
-- No separate composite index needed: the PK (player_name, format, season)
-- IS a btree on those columns, and Postgres can use its leftmost prefix
-- (player_name) or (player_name, format) for the app's WHERE/GROUP BY.

CREATE TABLE IF NOT EXISTS era_averages (
    year            INTEGER      NOT NULL,
    format          TEXT         NOT NULL,
    avg_strike_rate NUMERIC(6,2) NOT NULL,
    PRIMARY KEY (year, format)
);

-- player_stats intentionally NOT created: app/api/stats/[type]/route.ts's
-- "player" query type is dead code (never called from the frontend),
-- does SELECT *, and its real shape is unknown. GET /api/stats/player
-- will error until either the shape becomes known (add a migration) or
-- the dead "player" entry is removed from QUERIES.
