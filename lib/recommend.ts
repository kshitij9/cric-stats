import { query } from '@/lib/db';
import {
  battingFigures,
  bowlingFigures,
  round,
  type Player,
} from '@/lib/stats';

/**
 * Matchup recommender — batting and bowling, shortlist and discovery.
 *
 * Model (mirrored for both roles): take a player's format-long baseline and
 * multiply it by one factor per requested context slice (venue / opposition /
 * phase / innings / the specific opponent). Each factor is the player's ratio
 * in that slice vs their own baseline, shrunk toward "no effect":
 *
 *   rate factor (strike rate | economy):
 *       1 + (slice_rate / base_rate - 1) * balls / (balls + K)
 *
 *   event factor (dismissal | wicket), rare events so shrink the RATE with a
 *   Beta prior worth K_OUT balls, then take the ratio to baseline:
 *       p_slice = (events + K_OUT * p0) / (balls + K_OUT)
 *       batter:  p0 / p_slice   (>1 => harder to dismiss here)
 *       bowler:  p_slice / p0   (>1 => strikes more often here)
 *
 * Which balls, runs and wickets count, and how baselines become rates, are the
 * definitions in lib/stats.ts, so a baseline here equals the player's career
 * figures. A dismissal counts for the player out, at either end. Against a named
 * opponent only the bowler's own wickets count, and they are compared with the
 * rate of bowler's wickets in the baseline.
 *
 * Batters rank by expected runs per dismissal (higher = better).
 * Bowlers rank by expected runs per wicket i.e. average (lower = better).
 *
 * Discovery mode (no shortlist) only considers players with a real career
 * baseline AND enough balls in every requested slice, so the ranking actually
 * reflects the context rather than career reputation.
 */

// strike-rate / economy prior strength, in balls, by slice
const K: Record<string, number> = {
  venue: 100,
  opposition: 120,
  phase: 150,
  innings: 200,
  matchup: 40, // vs the one named opponent — always a small sample
};
// dismissal / wicket rate prior strength, in balls (rare events => generous)
const K_OUT = 150;

// discovery: min balls a player needs in a slice for it to gate them in
const MATCHUP_FLOOR = 10;
const BASELINE_FLOOR = 300; // min career balls (faced / legal bowled) in discovery

export type Role = 'batter' | 'bowler';
export type Ctx = {
  venue: string; // venue ID
  opponent: string; // player ID. batter role: bowler faced | bowler role: batter faced
  opposition: string; // opposing team
  phase: string;
  innings: number;
  gender: string; // 'male' | 'female' | '' (both)
};

type SliceKey = 'venue' | 'matchup' | 'opposition' | 'phase' | 'innings';

const num = (v: unknown) => (v == null ? 0 : Number(v));
const shrink = (ratio: number, n: number, k: number) =>
  !isFinite(ratio) || n <= 0 ? 1 : 1 + (ratio - 1) * (n / (n + k));

const confidenceFor = (n: number) =>
  n <= 0 ? 'none' : n < 40 ? 'low' : n < 200 ? 'medium' : 'high';

// which slices the caller actually constrained, in narrowest-first order
function activeSlices(ctx: Ctx): SliceKey[] {
  const out: SliceKey[] = [];
  if (ctx.opponent) out.push('matchup');
  if (ctx.venue) out.push('venue');
  if (ctx.opposition) out.push('opposition');
  if (ctx.phase) out.push('phase');
  if (ctx.innings) out.push('innings');
  return out;
}

function sliceFloor(key: SliceKey, minSample: number) {
  return key === 'matchup' ? MATCHUP_FLOOR : minSample;
}

// ---------------------------------------------------------------------------
// SQL — balls and runs come from deliveries, dismissals and wickets from the
// wickets table, each totalled overall and per requested slice. They are
// totalled apart because one delivery can carry two wickets, and a batter can be
// out on a ball someone else faced. The two queries run side by side, as each
// reads the whole format. $2 NULL => every player (discovery).
//
// $1 format  $2 player IDs  $3 venue  $4 opponent  $5 opposition  $6 phase
// $7 innings  $8 gender  $9 minimum career balls (first query only)
// ---------------------------------------------------------------------------

const slicePredicates = (role: Role): Record<SliceKey, string> => ({
  venue: `$3 <> '' AND d.venue_id = $3`,
  matchup: `$4 <> '' AND d.${role === 'batter' ? 'bowler_id' : 'batter_id'} = $4`,
  opposition: `$5 <> '' AND lower(d.${role === 'batter' ? 'bowling_team' : 'batting_team'}) = lower($5)`,
  phase: `$6 <> '' AND d.phase = $6`,
  innings: `$7 > 0 AND d.innings = $7`,
});

const MATCHES = `d.format = $1 AND ($8 = '' OR d.gender = $8)`;

function sliceSql(role: Role) {
  const batting = role === 'batter';
  const self = batting ? 'd.batter_id' : 'd.bowler_id';
  const runs = batting ? 'd.runs_batter' : 'd.bowler_runs';
  const counted = batting ? 'd.ball_faced' : 'd.legal_ball';
  // whose wicket it is: the batter out, or the bowler who took it
  const owner = batting ? 'w.player_out_id' : 'd.bowler_id';
  const event = batting ? 'w.dismissal' : 'w.bowlers_wicket';
  const slices = Object.entries(slicePredicates(role)) as [SliceKey, string][];

  const ballColumns = slices.map(
    ([k, pred]) => `
      COALESCE(SUM(${runs}) FILTER (WHERE ${pred}), 0) AS runs_${k},
      COUNT(*) FILTER (WHERE ${pred} AND ${counted})   AS balls_${k}`,
  );
  const eventColumns = slices.map(([k, pred]) => {
    const which = k === 'matchup' ? 'w.bowlers_wicket' : event;
    return `COUNT(*) FILTER (WHERE ${pred} AND ${which}) AS evt_${k}`;
  });

  const balls = `
    WITH balls AS (
      SELECT ${self} AS player_id,
        SUM(${runs})                       AS runs_all,
        COUNT(*) FILTER (WHERE ${counted}) AS balls_all,
        ${ballColumns.join(',')}
      FROM deliveries d
      WHERE ${MATCHES} AND ($2::text[] IS NULL OR ${self} = ANY($2::text[]))
      GROUP BY 1
      HAVING COUNT(*) FILTER (WHERE ${counted}) >= $9
    )
    SELECT * FROM balls JOIN players USING (player_id)
  `;
  const events = `
    SELECT ${owner} AS player_id,
      COUNT(*) FILTER (WHERE ${event})          AS evt_all,
      COUNT(*) FILTER (WHERE w.bowlers_wicket)  AS credited_all,
      ${eventColumns.join(',\n      ')}
    FROM wickets w JOIN deliveries d ON d.id = w.delivery_id
    WHERE ${MATCHES} AND ($2::text[] IS NULL OR ${owner} = ANY($2::text[]))
    GROUP BY 1
  `;
  return { balls, events };
}

type Row = Record<string, unknown>;
type Triple = { runs: number; balls: number; evt: number };

const triple = (r: Row, suffix: string): Triple => ({
  runs: num(r[`runs_${suffix}`]),
  balls: num(r[`balls_${suffix}`]),
  evt: num(r[`evt_${suffix}`]),
});

const identity = (r: Row) => ({
  player_id: r.player_id as string,
  player: r.name as string,
  unique_name: r.unique_name as string,
});

// ---------------------------------------------------------------------------

function scoreBatter(r: Row, keys: SliceKey[]) {
  const all = triple(r, 'all');
  if (all.balls === 0) return { ...identity(r), data_available: false as const };

  const baseSr = (all.runs * 100) / all.balls;
  const baseBpd = all.evt > 0 ? all.balls / all.evt : all.balls;
  // against one bowler only bowler's wickets can be counted, so compare like with like
  const credited = num(r.credited_all);
  const creditedRate = credited > 0 ? credited / all.balls : 1 / all.balls;

  const factors: Partial<Record<SliceKey, unknown>> = {};
  const missing: SliceKey[] = [];
  let srMult = 1;
  let bpdMult = 1;

  for (const k of keys) {
    const s = triple(r, k);
    if (s.balls === 0) {
      missing.push(k);
      continue;
    }
    const sSr = (s.runs * 100) / s.balls;
    const srF = baseSr > 0 ? shrink(sSr / baseSr, s.balls, K[k]) : 1;
    const p0 = k === 'matchup' ? creditedRate : 1 / baseBpd;
    const pSlice = (s.evt + K_OUT * p0) / (s.balls + K_OUT);
    const bpdF = p0 / pSlice;
    srMult *= srF;
    bpdMult *= bpdF;
    factors[k] = {
      sample_balls: s.balls,
      sample_events: s.evt,
      observed: round(sSr, 1),
      rate_factor: round(srF, 3),
      event_factor: round(bpdF, 3),
    };
  }

  const predSr = baseSr * srMult;
  const predBpd = baseBpd * bpdMult;
  const narrow = keys.map((k) => triple(r, k)).find((s) => s.balls > 0) ?? all;
  const figures = battingFigures({
    innings: 0, // not totalled here; see /api/stats/career
    runs: all.runs,
    balls: all.balls,
    outs: all.evt,
    fours: 0,
    sixes: 0,
  });

  return {
    ...identity(r),
    data_available: true as const,
    score: (predBpd * predSr) / 100, // higher = better
    predicted: {
      strike_rate: round(predSr, 1),
      balls_per_dismissal: round(predBpd, 1),
      expected_runs_per_dismissal: round((predBpd * predSr) / 100, 1),
    },
    baseline: {
      runs: figures.runs,
      balls: figures.balls,
      outs: figures.outs,
      average: figures.average,
      strike_rate: figures.strike_rate,
      balls_per_dismissal: figures.balls_per_dismissal,
      expected_runs_per_dismissal: figures.average,
      volume: all.balls,
    },
    factors,
    missing_context: missing,
    sample_balls: narrow.balls,
    confidence: confidenceFor(narrow.balls),
  };
}

function scoreBowler(r: Row, keys: SliceKey[]) {
  const all = triple(r, 'all');
  if (all.balls === 0) return { ...identity(r), data_available: false as const };

  const baseRpb = all.runs / all.balls;
  const baseWr = all.evt > 0 ? all.evt / all.balls : 0.5 / all.balls; // wicketless => tiny rate, sinks

  const factors: Partial<Record<SliceKey, unknown>> = {};
  const missing: SliceKey[] = [];
  let ecoMult = 1;
  let wktMult = 1;

  for (const k of keys) {
    const s = triple(r, k);
    if (s.balls === 0) {
      missing.push(k);
      continue;
    }
    const sRpb = s.runs / s.balls;
    const ecoF = baseRpb > 0 ? shrink(sRpb / baseRpb, s.balls, K[k]) : 1;
    const p0 = baseWr;
    const pSlice = (s.evt + K_OUT * p0) / (s.balls + K_OUT);
    const wktF = pSlice / p0;
    ecoMult *= ecoF;
    wktMult *= wktF;
    factors[k] = {
      sample_balls: s.balls,
      sample_events: s.evt,
      observed: round(sRpb * 6, 2),
      rate_factor: round(ecoF, 3), // <1 => more economical here
      event_factor: round(wktF, 3), // >1 => more wickets here
    };
  }

  const predRpb = baseRpb * ecoMult;
  const predWr = baseWr * wktMult;
  const predAvg = predRpb / predWr;
  const narrow = keys.map((k) => triple(r, k)).find((s) => s.balls > 0) ?? all;
  const figures = bowlingFigures({ runs: all.runs, balls: all.balls, wickets: all.evt });

  return {
    ...identity(r),
    data_available: true as const,
    score: -predAvg, // higher = better (so lower average wins)
    predicted: {
      economy: round(predRpb * 6, 2),
      strike_rate: round(1 / predWr, 1),
      expected_runs_per_wicket: round(predAvg, 1),
    },
    baseline: {
      ...figures,
      expected_runs_per_wicket: figures.average,
      volume: all.balls,
    },
    factors,
    missing_context: missing,
    sample_balls: narrow.balls,
    confidence: confidenceFor(narrow.balls),
  };
}

// ---------------------------------------------------------------------------

export async function recommend(opts: {
  role: Role;
  format: string;
  players: Player[] | null; // null => discovery
  ctx: Ctx;
  limit: number;
  minSample: number;
}) {
  const { role, format, players, ctx, limit, minSample } = opts;
  const keys = activeSlices(ctx);
  const discovery = players === null;

  const baselineFloor = discovery ? BASELINE_FLOOR : 1;
  const sql = sliceSql(role);
  const params = [
    format,
    players?.map((p) => p.player_id) ?? null,
    ctx.venue,
    ctx.opponent,
    ctx.opposition,
    ctx.phase,
    ctx.innings,
    ctx.gender,
  ];
  const [ballRows, eventRows] = await Promise.all([
    query(sql.balls, [...params, baselineFloor]),
    query(sql.events, params),
  ]);
  // a player with no wickets simply has no event row
  const events = new Map(eventRows.map((r) => [r.player_id as string, r]));
  const rows = ballRows.map((r) => ({ ...r, ...events.get(r.player_id as string) }));

  const scorer = role === 'batter' ? scoreBatter : scoreBowler;
  let scored = rows.map((r) => scorer(r as Row, keys));

  // shortlist mode: players with no matching deliveries never come back from SQL,
  // so add them explicitly as unavailable rather than silently dropping them
  if (players) {
    const seen = new Set(scored.map((p) => p.player_id));
    for (const p of players) {
      if (!seen.has(p.player_id)) {
        scored.push({
          player_id: p.player_id,
          player: p.name,
          unique_name: p.unique_name,
          data_available: false as const,
        });
      }
    }
  }

  if (discovery) {
    scored = scored.filter((p) => {
      if (!p.data_available) return false;
      // must clear the sample floor in every requested slice
      return keys.every((k) => {
        const f = (p.factors as Record<string, { sample_balls: number }>)[k];
        return f && f.sample_balls >= sliceFloor(k, minSample);
      });
    });
  }

  const ranked = scored
    .filter((p): p is Extract<typeof p, { data_available: true }> => p.data_available)
    .sort((a, b) => b.score - a.score);

  const shown = discovery ? ranked.slice(0, limit) : ranked;
  shown.forEach((p, i) => ((p as Record<string, unknown>).rank = i + 1));

  const unavailable = scored.filter((p) => !p.data_available).map((p) => p.unique_name);

  const caveats: string[] = [];
  const top = shown[0] as (typeof shown)[number] & { rank: number };
  if (top) {
    if (top.confidence === 'low' || top.confidence === 'none') {
      caveats.push(
        `thin evidence: only ${top.sample_balls} balls in the requested context — ranking leans on career baselines`,
      );
    }
    if (!discovery && top.missing_context.length) {
      caveats.push(
        `no ${top.missing_context.join('/')} history for ${top.player}; that factor was left neutral`,
      );
    }
  }
  if (discovery && keys.length && shown.length < limit) {
    caveats.push(
      `only ${shown.length} ${role}s have ≥ ${minSample} balls (≥ ${MATCHUP_FLOOR} vs a named opponent) in every requested slice`,
    );
  }
  if (!discovery && unavailable.length) {
    caveats.push(`no ${format} data for: ${unavailable.join(', ')}`);
  }

  // strip internal score before returning
  const clean = (p: Record<string, unknown>) => {
    const { score, ...rest } = p;
    void score;
    return rest;
  };

  return {
    role,
    format,
    mode: discovery ? 'discovery' : 'shortlist',
    context: ctx,
    recommendation: top?.player ?? null,
    recommendation_id: top?.player_id ?? null,
    caveats,
    players: [...shown.map(clean), ...scored.filter((p) => !p.data_available)],
  };
}
