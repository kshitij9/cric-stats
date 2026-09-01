-- Postgres auto-runs any *.sql placed here on first container start
-- (only when the data directory is empty).

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
    wicket_type   TEXT      NOT NULL DEFAULT ''
);

-- Every stats query filters deliveries by batter first, then aggregates
-- (matchup groups by bowler, era groups by year/format) — one index covers both.
CREATE INDEX IF NOT EXISTS idx_deliveries_batter ON deliveries (batter);

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
