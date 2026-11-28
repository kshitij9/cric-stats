import { History } from '../../lib/sim/history';
import { Model, type Params } from '../../lib/sim/model';
import { predict } from '../../lib/sim/predict';
import { sideFrom } from '../../lib/sim/sides';
import { simulate } from '../../lib/sim/engine';
import { loadMatches, type Query } from '../../lib/sim/data';
import type { PastMatch } from '../../lib/sim/types';
import { TEST, fixtureOf, seedOf, walk } from './common';

/**
 * Is the machinery right? Counts against the database, the rules of the game in
 * every simulated innings, and that no prediction can see its own match or any
 * later one.
 */
export async function checks(matches: PastMatch[], query: Query, params: Params) {
  let failed = 0;
  let passed = 0;
  const check = (name: string, ok: boolean, detail = '') => {
    if (ok) passed++;
    else failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail && !ok ? `: ${detail}` : ''}`);
  };

  // ---- the counts learnt from, against the database's own summaries --------
  const history = new History();
  for (const m of matches) history.add(m);
  const careers = await query<{ player_id: string; runs: string; balls: string }>(
    `SELECT player_id, sum(runs_scored) AS runs, sum(balls_faced) AS balls
       FROM player_career_stats WHERE competition = 'ipl' GROUP BY 1`,
  );
  const runs = new Map<string, number>();
  for (const m of matches) {
    for (const b of m.balls) runs.set(b.batter, (runs.get(b.batter) ?? 0) + b.runsBatter);
  }
  let wrong = 0;
  for (const c of careers) {
    let faced = 0;
    for (const t of history.batters.get(c.player_id)?.values() ?? []) {
      for (const n of t.balls) faced += n;
    }
    if (faced !== Number(c.balls) || (runs.get(c.player_id) ?? 0) !== Number(c.runs)) wrong++;
  }
  check(`balls faced and runs of ${careers.length} batters match the database`, wrong === 0, `${wrong} differ`);
  const [{ n }] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM deliveries WHERE competition = 'ipl' AND innings <= 2`,
  );
  const counted = [...history.league.values()].reduce(
    (sum, l) => sum + l.counts.reduce((a, b) => a + b, 0),
    0,
  );
  check(`every delivery counted once (${counted})`, counted === Number(n), `database ${n}`);

  // ---- the internationals used as a fresh check ----------------------------
  const abroad = await loadMatches(query, 'international');
  const [db] = await query<{ matches: string; balls: string; runs: string; out: string }>(
    `WITH m AS (SELECT match_id FROM matches
                 WHERE competition = 'international' AND format = 'T20' AND gender = 'male')
     SELECT (SELECT count(*) FROM m) AS matches,
            count(*) AS balls, sum(d.runs_batter + d.extras) AS runs,
            (SELECT count(*) FROM wickets w JOIN deliveries x ON x.id = w.delivery_id
              WHERE x.match_id IN (SELECT match_id FROM m) AND w.dismissal
                AND x.innings <= 2) AS out
       FROM deliveries d WHERE d.match_id IN (SELECT match_id FROM m) AND d.innings <= 2`,
  );
  const sum = (of: (m: PastMatch) => number) => abroad.reduce((n, m) => n + of(m), 0);
  const mine = [
    abroad.length,
    sum((m) => m.balls.length),
    sum((m) => m.balls.reduce((n, b) => n + b.runs, 0)),
    sum((m) => m.balls.reduce((n, b) => n + b.out.length, 0)),
  ];
  const theirs = [db.matches, db.balls, db.runs, db.out].map(Number);
  check(
    `internationals: ${mine[0]} matches, ${mine[1]} balls, runs and wickets match the database`,
    mine.every((v, i) => v === theirs[i]),
    `loaded ${mine.join(' ')}, database ${theirs.join(' ')}`,
  );

  // ---- every simulated innings obeys the rules -----------------------------
  const sample = matches.filter((m) => m.season >= TEST.from && m.battingFirst !== null);
  const chosen = sample.filter((_, i) => i % Math.floor(sample.length / 12) === 0).slice(0, 12);
  const wanted = new Set(chosen.map((m) => m.id));
  const results = new Map<string, string>();
  let innings = 0;
  const broken: Record<string, number> = {};
  const rule = (name: string, ok: boolean) => {
    if (!ok) broken[name] = (broken[name] ?? 0) + 1;
  };
  const stripped = (r: ReturnType<typeof predict>) =>
    JSON.stringify([r.firstWins, Array.from(r.first.totals), Array.from(r.second.totals), r.players]);

  walk(matches, TEST, (past, day) => {
    for (const match of day) {
      if (!wanted.has(match.id)) continue;
      const fixture = fixtureOf(match)!;
      const seed = seedOf(match.id);
      results.set(match.id, stripped(predict(past, params, fixture, { sims: 500, seed })));
      let target = 0;
      let turn = 0;
      const model = new Model(past, match.season, params);
      const a = sideFrom(past, fixture.first, params.recentMatches);
      const b = sideFrom(past, fixture.second, params.recentMatches);
      const out = simulate(model, a, b, fixture.venueId, {
        sims: 2000,
        seed,
        trace: (i) => {
          innings++;
          const chasing = turn++ % 2 === 1;
          rule('at most 120 legal balls', i.balls <= 120);
          rule('at most 10 wickets', i.wickets <= 10);
          rule('at most 4 overs a bowler', i.overs.every((o) => o <= 4));
          rule('nobody bowls two overs running', !i.consecutive);
          rule('extras are not negative', i.extras >= 0);
          rule(
            'ends only all out, after 20 overs, or at the target',
            i.balls === 120 || i.wickets >= Math.min(10, (chasing ? b : a).order.length - 1) || (chasing && i.total >= target),
          );
          if (chasing) rule('a chase stops at the target', i.total <= target + 6);
          else target = i.total + 1;
        },
      });
      const lines = out.players[0].reduce((s, p) => s + p.runs, 0);
      rule('batters’ runs do not exceed the total', lines <= out.first.mean + 1e-9);
      const wickets = out.players[1].reduce((s, p) => s + p.wickets, 0);
      rule('bowlers’ wickets do not exceed wickets', wickets <= 10);
    }
  });
  check(
    `${innings} simulated innings obey the rules`,
    Object.keys(broken).length === 0,
    JSON.stringify(broken),
  );

  // ---- no sight of the match itself, or of anything later ------------------
  let same = 0;
  let moved = 0;
  for (const match of chosen) {
    // a history made without them, and the match with nothing of what happened
    const earlier = new History();
    for (const m of matches) if (m.date < match.date) earlier.add(m);
    const blind: PastMatch = { ...match, balls: [], winner: null };
    const fixture = fixtureOf(blind)!;
    const again = stripped(predict(earlier, params, fixture, { sims: 500, seed: seedOf(match.id) }));
    if (again === results.get(match.id)) same++;
    // and the same history does change the answer once the match is in it
    earlier.add(match);
    const after = stripped(predict(earlier, params, fixture, { sims: 500, seed: seedOf(match.id) }));
    if (after !== again) moved++;
  }
  check(`${chosen.length} predictions identical without the match or anything later`, same === chosen.length, `${same} identical`);
  check('and each would change if its own match were seen', moved === chosen.length, `${moved} changed`);
  console.log(`${passed} checks passed, ${failed} failed`);
  return failed === 0;
}
