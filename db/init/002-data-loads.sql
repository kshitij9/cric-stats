-- One row per successful data load, written by db/etl/run.sh in the same
-- statement that publishes the new data. Kept apart from 001-schema.sql because
-- the loader rebuilds those tables on every run and this history must survive.
CREATE TABLE IF NOT EXISTS public.data_loads (
    load_id           BIGSERIAL   PRIMARY KEY,
    loaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    code_version      TEXT        NOT NULL,  -- hash of the loader and schema files
    sources           JSONB       NOT NULL,  -- file, size, sha256, server date
    row_counts        JSONB       NOT NULL,
    latest_match_date DATE        NOT NULL
);
