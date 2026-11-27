import { query, queryWholeFormat } from '@/lib/db';
import {
  RECENT_SEASONS,
  type CurrentGround,
  type GroundProfile,
  type PlayingPhase,
  type SeasonChoice,
  type Typical,
} from '@/lib/matchup-types';
import { round } from '@/lib/stats';
import type { VenueRef } from '@/lib/types';

/**
 * How an IPL ground plays.
 *
 * Scores come from first innings that ran their course: 20 overs of legal balls
 * bowled, or ten wickets down. Rain-shortened ones would drag the average down,
 * and second innings stop at the target. A total is every run off a delivery,
 * extras included. Wickets are dismissals of any kind.
 *
 * Scoring has risen over the years, so a ground is compared with the others in
 * the same seasons: each season elsewhere counts in proportion to the innings
 * played here that season.
 */

const PHASES: PlayingPhase[] = ['powerplay', 'middle', 'death'];

/** The ground, if the IPL has been played there. */
export async function findGround(venueId: string): Promise<VenueRef | null> {
  const [venue] = await query<VenueRef>(
    `SELECT venue_id, name, city FROM venues v
      WHERE venue_id = $1 AND EXISTS (
            SELECT 1 FROM matches m WHERE m.venue_id = v.venue_id AND m.competition = 'ipl')`,
    [venueId],
  );
  return venue ?? null;
}

/** The grounds of the latest season, the most used first. */
export const currentGrounds = () =>
  query<CurrentGround>(
    `SELECT v.venue_id, v.name, v.city, count(*)::int AS matches
       FROM matches m JOIN venues v ON v.venue_id = m.venue_id
      WHERE m.competition = 'ipl'
        AND extract(year FROM m.date) =
            (SELECT extract(year FROM max(date)) FROM matches WHERE competition = 'ipl')
      GROUP BY v.venue_id, v.name, v.city
      ORDER BY matches DESC, v.name`,
  );

type Count = { runs: number; legal: number; wickets: number };
type Innings = {
  here: boolean;
  season: number;
  total: number;
  complete: boolean;
  phases: Record<PlayingPhase, Count>;
};

async function firstInnings(venueId: string, from: number): Promise<Innings[]> {
  const rows = await queryWholeFormat<
    Count & { match_id: string; venue_id: string; season: number; phase: PlayingPhase }
  >(
    `SELECT d.match_id, d.venue_id, extract(year FROM d.date)::int AS season, d.phase,
            count(*) FILTER (WHERE d.legal_ball) AS legal,
            sum(d.runs_batter + d.extras)        AS runs,
            coalesce(sum(w.taken), 0)::int       AS wickets
       FROM deliveries d
       LEFT JOIN (SELECT delivery_id, count(*) AS taken FROM wickets
                   WHERE dismissal GROUP BY 1) w ON w.delivery_id = d.id
      WHERE d.format = 'T20' AND d.competition = 'ipl' AND d.innings = 1
        AND d.date >= make_date($1::int, 1, 1)
      GROUP BY 1, 2, 3, 4`,
    [from],
  );
  const matches = new Map<string, Innings>();
  for (const r of rows) {
    let innings = matches.get(r.match_id);
    if (!innings) {
      const none = () => ({ runs: 0, legal: 0, wickets: 0 });
      innings = {
        here: r.venue_id === venueId,
        season: r.season,
        total: 0,
        complete: false,
        phases: { powerplay: none(), middle: none(), death: none() },
      };
      matches.set(r.match_id, innings);
    }
    innings.phases[r.phase] = { runs: r.runs, legal: r.legal, wickets: r.wickets };
    innings.total += r.runs;
  }
  for (const innings of matches.values()) {
    const counts = Object.values(innings.phases);
    const sum = (key: keyof Count) => counts.reduce((total, c) => total + c[key], 0);
    innings.complete = sum('legal') >= 120 || sum('wickets') >= 10;
  }
  return [...matches.values()];
}

const mean = <T>(items: T[], of: (item: T) => number) =>
  items.reduce((total, item) => total + of(item), 0) / items.length;

/** Groups of items, each counting for its weight. */
type Weighted<T> = { weight: number; items: T[] }[];

const weighted = <T>(groups: Weighted<T>, of: (item: T) => number) => {
  const all = groups.reduce((total, g) => total + g.weight, 0);
  return groups.reduce((total, g) => total + g.weight * mean(g.items, of), 0) / all;
};

/** For each season played here, the same season's items from elsewhere. */
function sameSeasons<T extends { season: number }>(here: T[], elsewhere: T[]): Weighted<T> {
  return [...new Set(here.map((i) => i.season))].flatMap((season) => {
    const items = elsewhere.filter((i) => i.season === season);
    const weight = here.filter((i) => i.season === season).length;
    return items.length ? [{ weight, items }] : [];
  });
}

function typical(
  innings: Weighted<Innings>,
  results: Weighted<{ batting_first_won: boolean }>,
): Typical | null {
  if (!innings.length) return null;
  return {
    score: round(weighted(innings, (i) => i.total), 1),
    phases: PHASES.map((phase) => {
      const of = (key: keyof Count) => weighted(innings, (i) => i.phases[phase][key]);
      const runs = of('runs');
      const legal = of('legal');
      return {
        phase,
        runs: round(runs, 1),
        wickets: round(of('wickets'), 2),
        run_rate: legal > 0 ? round((runs * 6) / legal, 2) : null,
      };
    }),
    bat_first_win_percent: results.length
      ? round(100 * weighted(results, (r) => Number(r.batting_first_won)), 1)
      : null,
  };
}

export async function groundProfile(
  venue: VenueRef,
  choice: SeasonChoice,
): Promise<GroundProfile> {
  const [{ first, latest }] = await query<{ first: number; latest: number }>(
    `SELECT extract(year FROM min(date))::int AS first, extract(year FROM max(date))::int AS latest
       FROM matches WHERE competition = 'ipl'`,
  );
  const from = choice === 'all' ? first : latest - RECENT_SEASONS + 1;

  const [innings, matches] = await Promise.all([
    firstInnings(venue.venue_id, from),
    // winner is NULL for a tie, which a super over or bowl-out may have settled
    query<{ here: boolean; season: number; winner: string | null; batted_first: string | null }>(
      `SELECT m.venue_id = $1 AS here, extract(year FROM m.date)::int AS season,
              coalesce(m.winner, m.eliminator, m.bowl_out) AS winner,
              (SELECT d.batting_team FROM deliveries d
                WHERE d.match_id = m.match_id AND d.innings = 1 LIMIT 1) AS batted_first
         FROM matches m
        WHERE m.competition = 'ipl' AND m.date >= make_date($2::int, 1, 1)`,
      [venue.venue_id, from],
    ),
  ]);

  const complete = innings.filter((i) => i.complete);
  const here = complete.filter((i) => i.here);
  const results = matches.flatMap((m) =>
    m.winner && m.batted_first
      ? [{ here: m.here, season: m.season, batting_first_won: m.winner === m.batted_first }]
      : [],
  );
  const resultsHere = results.filter((r) => r.here);
  const totals = here.map((i) => i.total);

  return {
    venue,
    seasons: { choice, from, to: latest },
    matches: matches.filter((m) => m.here).length,
    innings: here.length,
    lowest: totals.length ? Math.min(...totals) : null,
    highest: totals.length ? Math.max(...totals) : null,
    decided: resultsHere.length,
    bat_first_wins: resultsHere.filter((r) => r.batting_first_won).length,
    here: typical(
      here.length ? [{ weight: 1, items: here }] : [],
      resultsHere.length ? [{ weight: 1, items: resultsHere }] : [],
    ),
    elsewhere: typical(
      sameSeasons(here, complete.filter((i) => !i.here)),
      sameSeasons(resultsHere, results.filter((r) => !r.here)),
    ),
  };
}
