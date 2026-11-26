-- Replaces the published tables with the staged ones and records the load.
-- This is deliberately ONE statement: it either happens completely or not at
-- all, even if the process sending it dies. run.sh passes it with psql -c.
DO $publish$
DECLARE
    old_tables text[];
    t          text;
    wanted     text;    -- the table being locked
    deadline   timestamptz := clock_timestamp() + interval '30 seconds';
BEGIN
    -- largest first: it is the table queries hold longest
    SELECT array_agg(format('public.%I', s.tablename)
                     ORDER BY pg_total_relation_size(format('public.%I', s.tablename)::regclass) DESC)
      INTO old_tables
      FROM pg_tables s
      JOIN pg_tables p ON p.schemaname = 'public' AND p.tablename = s.tablename
     WHERE s.schemaname = 'etl_staging';

    -- Lock every old table without ever deadlocking a reader. A reader may lock
    -- the same tables in another order, so only the first lock (taken while
    -- holding none) may wait long. For the rest, give up well before Postgres's
    -- 1s deadlock check, release everything, and start again with the table that
    -- was busy in first place, which adapts to the order readers use.
    LOOP
        EXIT WHEN old_tables IS NULL;
        BEGIN
            FOREACH wanted IN ARRAY old_tables LOOP
                PERFORM set_config('lock_timeout',
                    CASE WHEN wanted = old_tables[1] THEN '5s' ELSE '200ms' END, true);
                EXECUTE 'LOCK TABLE ' || wanted || ' IN ACCESS EXCLUSIVE MODE';
            END LOOP;
            EXIT;
        EXCEPTION WHEN lock_not_available OR deadlock_detected THEN
            -- leaving this block has released the locks taken inside it
            IF clock_timestamp() > deadline THEN
                RAISE EXCEPTION 'tables stayed busy; nothing was published';
            END IF;
            old_tables := wanted || array_remove(old_tables, wanted);
            PERFORM pg_sleep(0.3);
        END;
    END LOOP;

    PERFORM set_config('lock_timeout', '5s', true);
    IF old_tables IS NOT NULL THEN
        -- no CASCADE: fail rather than silently drop anything that depends on them
        EXECUTE 'DROP TABLE ' || array_to_string(old_tables, ', ');
    END IF;

    -- tables whose names start with "_" are the loader's own and are discarded
    FOR t IN SELECT tablename FROM pg_tables
              WHERE schemaname = 'etl_staging' AND left(tablename, 1) <> '_'
              ORDER BY tablename
    LOOP
        EXECUTE format('ALTER TABLE etl_staging.%I SET SCHEMA public', t);
    END LOOP;

    INSERT INTO public.data_loads (code_version, sources, row_counts, latest_match_date)
    SELECT code_version,
           manifest->'sources',
           manifest->'row_counts'
               || jsonb_build_object('era_averages', (SELECT count(*) FROM public.era_averages)),
           (SELECT max(date) FROM public.matches)
      FROM etl_staging._load_manifest;

    DROP SCHEMA etl_staging CASCADE;
END
$publish$;
