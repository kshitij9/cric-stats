-- Tables for what people create in the app. They live in their own database
-- (cricintell_app), apart from the match data: loads replace the match tables
-- and a release may swap whole databases, but nothing here can be downloaded
-- again. db/app/setup.sh applies this file; every statement is idempotent.

CREATE TABLE IF NOT EXISTS teams (
    team_id     INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    competition TEXT        NOT NULL CHECK (competition IN ('ipl', 'international')),
    gender      TEXT        NOT NULL CHECK (gender IN ('male', 'female')),
    -- player IDs of the match data, in batting order
    players     TEXT[]      NOT NULL DEFAULT '{}' CHECK (cardinality(players) <= 11),
    -- goes up with every change, so that one device cannot overwrite another's
    version     INTEGER     NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_name ON teams (competition, gender, lower(name));
