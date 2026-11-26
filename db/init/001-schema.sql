-- Tables. Postgres auto-runs the *.sql files here, in name order, on first
-- container start (empty data directory only). db/etl/run.sh also applies this
-- file to an empty staging schema on every load, then publishes those tables in
-- place of the old ones, so an existing volume picks up changes on its next load.
-- Keep names unqualified; every statement is written to be idempotent.
-- Secondary indexes are in 003-indexes.sql.
--
-- Players are identified by Cricsheet's ID. Names are kept beside the IDs but
-- are not unique: different people share them.

-- ---------------------------------------------------------------------------
-- venues: one row per ground. Source spellings map to a ground through
-- venue_aliases; spellings are merged only as listed (and approved) in
-- db/venues/venue_merges.csv.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venues (
    venue_id TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    city     TEXT NOT NULL DEFAULT ''
);

-- (venue name, city) together: "County Ground" alone is six different grounds.
CREATE TABLE IF NOT EXISTS venue_aliases (
    venue_name TEXT NOT NULL,
    city       TEXT NOT NULL DEFAULT '',
    venue_id   TEXT NOT NULL,
    PRIMARY KEY (venue_name, city)
);

-- ---------------------------------------------------------------------------
-- players: one row per person. An ID that the source uses in both men's and
-- women's matches is split in two (see db/etl/derive.sql).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
    player_id   TEXT PRIMARY KEY,
    name        TEXT NOT NULL,   -- scorecard name, e.g. 'V Kohli'
    unique_name TEXT NOT NULL,   -- tells namesakes apart, e.g. 'Rashid Khan (2)'
    gender      TEXT NOT NULL    -- 'male' | 'female'
);

-- other names to search by, e.g. 'Virat Kohli'; not every player has one
CREATE TABLE IF NOT EXISTS player_aliases (
    player_id TEXT NOT NULL,
    alias     TEXT NOT NULL,
    PRIMARY KEY (player_id, alias)
);

-- ---------------------------------------------------------------------------
-- matches: one row per match, the context the ball-by-ball feed hangs off.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
    match_id        TEXT PRIMARY KEY,
    date            DATE NOT NULL,
    format          TEXT NOT NULL,
    venue           TEXT,          -- as spelled in the source
    city            TEXT,
    venue_id        TEXT,
    event           TEXT,
    season          TEXT,
    team_type       TEXT,          -- 'international' | 'club'
    gender          TEXT,
    team1           TEXT,
    team2           TEXT,
    toss_winner     TEXT,
    toss_decision   TEXT,          -- 'bat' | 'field'
    winner          TEXT,          -- NULL for tie / no result / draw
    result_margin   TEXT,          -- '7 wickets', '45 runs', 'tie', ...
    result_method   TEXT,          -- e.g. 'D/L'; NULL when decided normally
    eliminator      TEXT,          -- super over winner of a tied match
    bowl_out        TEXT,          -- bowl-out winner of a tied match
    player_of_match TEXT
);

-- Who was named in each side. The team is part of the key because the source
-- gives one ID to a name that appears on both sides of the same match.
CREATE TABLE IF NOT EXISTS match_players (
    match_id    TEXT NOT NULL,
    team        TEXT NOT NULL,
    player_id   TEXT NOT NULL,
    player_name TEXT NOT NULL,     -- as spelled on this scorecard
    PRIMARY KEY (match_id, team, player_id)
);

-- ---------------------------------------------------------------------------
-- deliveries: ball-by-ball. A handful of match/innings context columns are
-- denormalised on here so the hot-path stat queries never need a join.
-- Super overs are not included.
--
-- ball_faced, legal_ball, bowler_runs (and dismissal, bowlers_wicket in wickets)
-- are computed here so that every query counts by the same rules. lib/stats.ts
-- turns the counts into rates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliveries (
    id             BIGINT    PRIMARY KEY,
    match_id       TEXT      NOT NULL,
    date           DATE      NOT NULL,
    format         TEXT      NOT NULL,
    innings        SMALLINT  NOT NULL,
    over           SMALLINT  NOT NULL,            -- 0-based
    ball           SMALLINT  NOT NULL,            -- 1-based, counting wides and no-balls
    batter         TEXT      NOT NULL,
    batter_id      TEXT      NOT NULL,
    non_striker    TEXT      NOT NULL,
    non_striker_id TEXT      NOT NULL,
    bowler         TEXT      NOT NULL,
    bowler_id      TEXT      NOT NULL,
    runs_batter    SMALLINT  NOT NULL DEFAULT 0,
    boundary       BOOLEAN   NOT NULL DEFAULT false, -- a 4 or 6 off the bat, not all-run
    extras         SMALLINT  NOT NULL DEFAULT 0,  -- total of the five below
    wides          SMALLINT  NOT NULL DEFAULT 0,
    noballs        SMALLINT  NOT NULL DEFAULT 0,
    byes           SMALLINT  NOT NULL DEFAULT 0,
    legbyes        SMALLINT  NOT NULL DEFAULT 0,
    penalty        SMALLINT  NOT NULL DEFAULT 0,
    ball_faced     BOOLEAN   GENERATED ALWAYS AS (wides = 0) STORED,
    legal_ball     BOOLEAN   GENERATED ALWAYS AS (wides = 0 AND noballs = 0) STORED,
    bowler_runs    SMALLINT  GENERATED ALWAYS AS (runs_batter + wides + noballs) STORED,
    venue          TEXT      NOT NULL DEFAULT '',
    venue_id       TEXT,
    batting_team   TEXT      NOT NULL DEFAULT '',
    bowling_team   TEXT      NOT NULL DEFAULT '',
    phase          TEXT      NOT NULL DEFAULT 'na', -- by over number: powerplay | middle | death | na (Tests)
    powerplay      TEXT      NOT NULL DEFAULT '',   -- from the source: mandatory | batting | fielding | ''
    gender         TEXT      NOT NULL DEFAULT '',   -- 'male' | 'female' (from matches)
    team_type      TEXT      NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------------
-- wickets: every dismissal event, including retirements. The player out may be
-- the striker, the non-striker or (retired out, timed out) neither.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wickets (
    delivery_id   BIGINT   NOT NULL,
    wicket_no     SMALLINT NOT NULL,   -- 1, 2, ... within the delivery
    player_out_id TEXT     NOT NULL,
    player_out    TEXT     NOT NULL,
    kind          TEXT     NOT NULL,
    dismissal     BOOLEAN  GENERATED ALWAYS AS (
                      kind NOT IN ('retired hurt', 'retired not out')) STORED,
    bowlers_wicket BOOLEAN GENERATED ALWAYS AS (
                      kind IN ('bowled', 'caught', 'caught and bowled', 'lbw',
                               'stumped', 'hit wicket')) STORED,
    PRIMARY KEY (delivery_id, wicket_no)
);

-- ---------------------------------------------------------------------------
-- Summaries, built from the tables above by db/etl/derive.sql.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_career_stats (
    player_id       TEXT    NOT NULL,
    player_name     TEXT    NOT NULL,
    format          TEXT    NOT NULL,
    season          INTEGER NOT NULL,  -- calendar year the match started
    innings_played  INTEGER NOT NULL DEFAULT 0,
    runs_scored     INTEGER NOT NULL DEFAULT 0,
    outs            INTEGER NOT NULL DEFAULT 0,
    balls_faced     INTEGER NOT NULL DEFAULT 0,
    fours           INTEGER NOT NULL DEFAULT 0,
    sixes           INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, format, season)
);

-- the scoring rate of an average batter, for the era index
CREATE TABLE IF NOT EXISTS era_averages (
    year            INTEGER      NOT NULL,
    format          TEXT         NOT NULL,
    gender          TEXT         NOT NULL,
    runs            INTEGER      NOT NULL,  -- off the bat
    balls           INTEGER      NOT NULL,  -- faced
    avg_strike_rate NUMERIC(6,2) NOT NULL,  -- runs per 100 balls faced
    PRIMARY KEY (year, format, gender)
);
