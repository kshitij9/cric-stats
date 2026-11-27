-- Compares freshly loaded data with what the target database holds now, to catch
-- a missing or truncated source. Skipped on an empty database and by
-- run.sh --allow-shrink. Each row returned is a failure.
SELECT format('%s %s %s matches would fall from %s to %s',
              cur.gender, cur.competition, cur.format, cur.n, coalesce(new.n, 0))
FROM (-- data loaded before matches had a competition held internationals only
      SELECT format, coalesce(to_jsonb(m)->>'competition', 'international') AS competition,
             gender, count(*) AS n
        FROM public.matches m GROUP BY 1, 2, 3) cur
LEFT JOIN (SELECT format, competition, gender, count(*) AS n
             FROM etl_staging.matches GROUP BY 1, 2, 3) new
       ON new.format = cur.format AND new.competition = cur.competition
      AND new.gender IS NOT DISTINCT FROM cur.gender
WHERE coalesce(new.n, 0) < cur.n

UNION ALL
SELECT format('deliveries would fall from %s to %s', cur.n, new.n)
FROM (SELECT count(*) AS n FROM public.deliveries) cur,
     (SELECT count(*) AS n FROM etl_staging.deliveries) new
WHERE new.n < cur.n * 0.99

UNION ALL
SELECT format('latest match would move back from %s to %s', cur.d, new.d)
FROM (SELECT max(date) AS d FROM public.matches) cur,
     (SELECT max(date) AS d FROM etl_staging.matches) new
WHERE new.d < cur.d;
