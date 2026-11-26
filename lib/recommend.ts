import { query } from '@/lib/db';

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

const BOWLER_WKT = `wicket_type IN ('caught','bowled','lbw','caught and bowled','stumped','hit wicket')`;

export type Role = 'batter' | 'bowler';
export type Ctx = {
  venue: string;
  opponent: string; // batter role: bowler faced | bowler role: batter faced
  opposition: string; // opposing team
  phase: string;
  innings: number;
  gender: string; // 'male' | 'female' | '' (both)
};

type SliceKey = 'venue' | 'matchup' | 'opposition' | 'phase' | 'innings';

const num = (v: unknown) => (v == null ? 0 : Number(v));
const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
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
// SQL — one GROUP BY over the format's deliveries, conditional aggregates per
// slice. $2 NULL => every player (discovery); otherwise just the shortlist.
// ---------------------------------------------------------------------------

const batterSlice = (k: string, pred: string) => `
  COALESCE(SUM(runs_batter) FILTER (WHERE ${pred}), 0)                     AS runs_${k},
  COUNT(*) FILTER (WHERE ${pred} AND extras_type <> 'wides')              AS balls_${k},
  COUNT(*) FILTER (WHERE ${pred} AND player_out = batter)                AS evt_${k}`;

const BATTER_SQL = `
  WITH d AS (
    SELECT runs_batter, extras_type, batter, bowler, venue, phase, innings,
           bowling_team, player_out
    FROM deliveries
    WHERE format = $1 AND ($9 = '' OR gender = $9)
      AND ($2::text[] IS NULL OR batter = ANY($2::text[]))
  )
  SELECT batter AS player,
    COALESCE(SUM(runs_batter), 0)                          AS runs_all,
    COUNT(*) FILTER (WHERE extras_type <> 'wides')         AS balls_all,
    COUNT(*) FILTER (WHERE player_out = batter)            AS evt_all,
    ${batterSlice('venue', `$3 <> '' AND lower(venue) = lower($3)`)},
    ${batterSlice('matchup', `$4 <> '' AND lower(bowler) = lower($4)`)},
    ${batterSlice('opposition', `$5 <> '' AND lower(bowling_team) = lower($5)`)},
    ${batterSlice('phase', `$6 <> '' AND phase = $6`)},
    ${batterSlice('innings', `$7 > 0 AND innings = $7`)}
  FROM d
  GROUP BY batter
  HAVING COUNT(*) FILTER (WHERE extras_type <> 'wides') >= $8
`;

const bowlerSlice = (k: string, pred: string) => `
  COALESCE(SUM(runs_batter) FILTER (WHERE ${pred}), 0)
    + COALESCE(SUM(extras) FILTER (WHERE ${pred} AND extras_type IN ('wides','noballs')), 0)  AS runs_${k},
  COUNT(*) FILTER (WHERE ${pred} AND extras_type NOT IN ('wides','noballs'))                  AS balls_${k},
  COUNT(*) FILTER (WHERE ${pred} AND ${BOWLER_WKT})                                           AS evt_${k}`;

const BOWLER_SQL = `
  WITH d AS (
    SELECT runs_batter, extras, extras_type, batter, bowler, venue, phase, innings,
           batting_team, wicket_type
    FROM deliveries
    WHERE format = $1 AND ($9 = '' OR gender = $9)
      AND ($2::text[] IS NULL OR bowler = ANY($2::text[]))
  )
  SELECT bowler AS player,
    COALESCE(SUM(runs_batter), 0)
      + COALESCE(SUM(extras) FILTER (WHERE extras_type IN ('wides','noballs')), 0)  AS runs_all,
    COUNT(*) FILTER (WHERE extras_type NOT IN ('wides','noballs'))                  AS balls_all,
    COUNT(*) FILTER (WHERE ${BOWLER_WKT})                                          AS evt_all,
    ${bowlerSlice('venue', `$3 <> '' AND lower(venue) = lower($3)`)},
    ${bowlerSlice('matchup', `$4 <> '' AND lower(batter) = lower($4)`)},
    ${bowlerSlice('opposition', `$5 <> '' AND lower(batting_team) = lower($5)`)},
    ${bowlerSlice('phase', `$6 <> '' AND phase = $6`)},
    ${bowlerSlice('innings', `$7 > 0 AND innings = $7`)}
  FROM d
  GROUP BY bowler
  HAVING COUNT(*) FILTER (WHERE extras_type NOT IN ('wides','noballs')) >= $8
`;

type Row = Record<string, unknown>;
type Triple = { runs: number; balls: number; evt: number };

const triple = (r: Row, suffix: string): Triple => ({
  runs: num(r[`runs_${suffix}`]),
  balls: num(r[`balls_${suffix}`]),
  evt: num(r[`evt_${suffix}`]),
});

// ---------------------------------------------------------------------------

function scoreBatter(r: Row, keys: SliceKey[]) {
  const all = triple(r, 'all');
  if (all.balls === 0) return { player: r.player as string, data_available: false as const };

  const baseSr = (all.runs * 100) / all.balls;
  const baseBpd = all.evt > 0 ? all.balls / all.evt : all.balls;

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
    const srF = shrink(sSr / baseSr, s.balls, K[k]);
    const p0 = 1 / baseBpd;
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

  return {
    player: r.player as string,
    data_available: true as const,
    score: (predBpd * predSr) / 100, // higher = better
    predicted: {
      strike_rate: round(predSr, 1),
      balls_per_dismissal: round(predBpd, 1),
      expected_runs_per_dismissal: round((predBpd * predSr) / 100, 1),
    },
    baseline: {
      strike_rate: round(baseSr, 1),
      balls_per_dismissal: round(baseBpd, 1),
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
  if (all.balls === 0) return { player: r.player as string, data_available: false as const };

  const baseRpb = all.runs / all.balls;
  const baseWr = all.evt > 0 ? all.evt / all.balls : 0.5 / all.balls; // wicketless => tiny rate, sinks
  const baseSr = 1 / baseWr;
  const baseEcon = baseRpb * 6;
  const baseAvg = baseRpb / baseWr;

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
    const ecoF = shrink(sRpb / baseRpb, s.balls, K[k]);
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

  return {
    player: r.player as string,
    data_available: true as const,
    score: -predAvg, // higher = better (so lower average wins)
    predicted: {
      economy: round(predRpb * 6, 2),
      strike_rate: round(1 / predWr, 1),
      expected_runs_per_wicket: round(predAvg, 1),
    },
    baseline: {
      economy: round(baseEcon, 2),
      strike_rate: round(baseSr, 1),
      expected_runs_per_wicket: round(baseAvg, 1),
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
  players: string[] | null; // null => discovery
  ctx: Ctx;
  limit: number;
  minSample: number;
}) {
  const { role, format, players, ctx, limit, minSample } = opts;
  const keys = activeSlices(ctx);
  const discovery = players === null;

  const sql = role === 'batter' ? BATTER_SQL : BOWLER_SQL;
  const baselineFloor = discovery ? BASELINE_FLOOR : 1;
  const rows = await query(sql, [
    format,
    players,
    ctx.venue,
    ctx.opponent,
    ctx.opposition,
    ctx.phase,
    ctx.innings,
    baselineFloor,
    ctx.gender,
  ]);

  const scorer = role === 'batter' ? scoreBatter : scoreBowler;
  let scored = rows.map((r) => scorer(r as Row, keys));

  // shortlist mode: names with no matching deliveries never come back from SQL,
  // so add them explicitly as unavailable rather than silently dropping them
  if (players) {
    const seen = new Set(scored.map((p) => p.player));
    for (const name of players) {
      if (!seen.has(name)) scored.push({ player: name, data_available: false as const });
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

  const unavailable = scored.filter((p) => !p.data_available).map((p) => p.player);

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
    caveats.push(`no data for: ${unavailable.join(', ')} (check the spelling)`);
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
    caveats,
    players: [...shown.map(clean), ...scored.filter((p) => !p.data_available)],
  };
}
