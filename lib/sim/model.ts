import { History, SITUATIONS, positionGroup, situation, type Seasons } from './history';
import {
  BATTER_GROUPS,
  GROUP,
  GROUPS,
  OUTCOMES,
  PHASE_COUNT,
  WICKET_GROUP,
  WIDE,
} from './outcomes';

/**
 * The chance of each outcome for one delivery:
 *
 *   the league's chance in this phase (and innings)
 *     × how the batter differs from average
 *     × how the bowler differs from average
 *     × how the ground differs from average
 *     (× this pair, and the pressure of a chase, where switched on)
 *
 * and then scaled to add up to one. "Differs from average" is what happened over
 * what the league would have done from the same balls in the same seasons, so a
 * high-scoring year does not flatter anyone. A thin record is pulled toward what
 * is usual for that part of the batting order (or kind of bowler) by adding K
 * imaginary balls of it. Older seasons count for less: half as much for every
 * `halfLife` years.
 */

export type Params = {
  halfLife: number; // seasons, for players and grounds
  leagueHalfLife: number; // seasons, for the league's own rates
  batterRunsK: number; // balls
  batterWicketK: number;
  bowlerRunsK: number;
  bowlerWicketK: number;
  groundK: number; // Infinity: grounds make no difference
  pairK: number; // Infinity: head-to-heads make no difference
  byInnings: boolean; // second innings has its own league rates
  pressureK: number; // Infinity: a chase is batted like any innings
  recentMatches: number; // for batting position and bowling use
  daySpread: number; // how much one match's pitch can differ from another's
};

type Rates = {
  /** [situation * GROUPS + group]: share of deliveries */
  all: Float64Array;
  faced: Float64Array; // share of balls faced, so without wides
};

export class Model {
  private readonly seasonRates = new Map<number, Rates>();
  private readonly now = new Float64Array(SITUATIONS * OUTCOMES);
  private readonly typical = new Float64Array(GROUPS); // for turning K into events
  private readonly typicalFaced = new Float64Array(GROUPS);
  /** Mean runs, and runs off the bat, by phase * OUTCOMES + outcome. */
  readonly runs = new Float64Array(PHASE_COUNT * OUTCOMES);
  readonly batRuns = new Float64Array(PHASE_COUNT * OUTCOMES);

  private readonly batterCache = new Map<string, Float64Array>();
  private readonly bowlerCache = new Map<string, Float64Array>();
  private readonly groundCache = new Map<string, Float64Array>();
  private readonly pressureCache = new Map<number, Float64Array>();

  /** `season`: that of the match being predicted. */
  constructor(
    readonly history: History,
    readonly season: number,
    readonly params: Params,
  ) {
    const counts = new Float64Array(SITUATIONS * OUTCOMES);
    const runs = new Float64Array(PHASE_COUNT * OUTCOMES);
    const batRuns = new Float64Array(PHASE_COUNT * OUTCOMES);
    for (const [past, league] of history.league) {
      this.seasonRates.set(past, this.rates(league.counts));
      const w = 0.5 ** ((season - past) / params.leagueHalfLife);
      for (let i = 0; i < counts.length; i++) counts[i] += w * league.counts[i];
      for (let i = 0; i < runs.length; i++) {
        runs[i] += w * league.runs[i];
        batRuns[i] += w * league.batRuns[i];
      }
    }
    if (!history.league.size) throw new Error('there is no earlier match to learn from');
    this.pool(counts);

    for (let at = 0; at < SITUATIONS; at++) {
      let total = 0;
      for (let o = 0; o < OUTCOMES; o++) total += counts[at * OUTCOMES + o];
      for (let o = 0; o < OUTCOMES; o++) {
        this.now[at * OUTCOMES + o] = total ? counts[at * OUTCOMES + o] / total : 0;
      }
    }
    const everything = new Float64Array(OUTCOMES);
    for (let i = 0; i < counts.length; i++) everything[i % OUTCOMES] += counts[i];
    let deliveries = 0;
    for (const n of everything) deliveries += n;
    for (let o = 0; o < OUTCOMES; o++) {
      const g = GROUP[o];
      if (g < 0) continue;
      this.typical[g] += everything[o] / deliveries;
      if (o !== WIDE) this.typicalFaced[g] += everything[o] / (deliveries - everything[WIDE]);
    }

    for (let phase = 0; phase < PHASE_COUNT; phase++) {
      for (let o = 0; o < OUTCOMES; o++) {
        let n = 0;
        for (let innings = 1; innings <= 2; innings++) {
          n += counts[situation(phase, innings) * OUTCOMES + o];
        }
        const i = phase * OUTCOMES + o;
        this.runs[i] = n ? runs[i] / n : 0;
        this.batRuns[i] = n ? batRuns[i] / n : 0;
      }
    }
  }

  /** Without separate innings rates, both innings share their pooled counts. */
  private pool(counts: Float64Array) {
    if (this.params.byInnings) return;
    for (let phase = 0; phase < PHASE_COUNT; phase++) {
      for (let o = 0; o < OUTCOMES; o++) {
        const a = situation(phase, 1) * OUTCOMES + o;
        const b = situation(phase, 2) * OUTCOMES + o;
        counts[a] = counts[b] = counts[a] + counts[b];
      }
    }
  }

  private rates(original: Float64Array): Rates {
    const counts = original.slice();
    this.pool(counts);
    const all = new Float64Array(SITUATIONS * GROUPS);
    const faced = new Float64Array(SITUATIONS * GROUPS);
    for (let at = 0; at < SITUATIONS; at++) {
      let total = 0;
      for (let o = 0; o < OUTCOMES; o++) total += counts[at * OUTCOMES + o];
      const without = total - counts[at * OUTCOMES + WIDE];
      for (let o = 0; o < OUTCOMES; o++) {
        const g = GROUP[o];
        if (g < 0 || !total) continue;
        all[at * GROUPS + g] += counts[at * OUTCOMES + o] / total;
        if (o !== WIDE && without) faced[at * GROUPS + g] += counts[at * OUTCOMES + o] / without;
      }
    }
    return { all, faced };
  }

  /** What happened, and what an average would have done, weighted by recency. */
  private compare(seasons: Seasons | undefined, faced: boolean) {
    const observed = new Float64Array(GROUPS);
    const expected = new Float64Array(GROUPS);
    for (const [past, tally] of seasons ?? []) {
      const w = 0.5 ** ((this.season - past) / this.params.halfLife);
      const rates = this.seasonRates.get(past)!;
      const table = faced ? rates.faced : rates.all;
      for (let o = 0; o < OUTCOMES; o++) {
        if (GROUP[o] >= 0) observed[GROUP[o]] += w * tally.outcomes[o];
      }
      for (let at = 0; at < SITUATIONS; at++) {
        const balls = w * tally.balls[at];
        if (!balls) continue;
        for (let g = 0; g < GROUPS; g++) expected[g] += balls * table[at * GROUPS + g];
      }
    }
    return { observed, expected };
  }

  /** observed over expected, after adding K balls at the usual ratio. */
  private shrunk(
    seasons: Seasons | undefined,
    faced: boolean,
    usual: Float64Array | null,
    k: (group: number) => number,
    groups: number,
  ) {
    const ratio = new Float64Array(GROUPS).fill(1);
    const { observed, expected } = this.compare(seasons, faced);
    const typical = faced ? this.typicalFaced : this.typical;
    for (let g = 0; g < groups; g++) {
      const prior = usual ? usual[g] : 1;
      const added = k(g) * typical[g];
      const under = expected[g] + added;
      ratio[g] = !isFinite(added) ? prior : under > 0 ? (observed[g] + added * prior) / under : prior;
    }
    return ratio;
  }

  private usual(seasons: Seasons | undefined, faced: boolean) {
    const { observed, expected } = this.compare(seasons, faced);
    return observed.map((n, g) => (expected[g] > 0 ? n / expected[g] : 1));
  }

  private cached<K>(cache: Map<K, Float64Array>, key: K, work: () => Float64Array) {
    let found = cache.get(key);
    if (!found) cache.set(key, (found = work()));
    return found;
  }

  batter(id: string) {
    return this.cached(this.batterCache, id, () => {
      const group = positionGroup(this.history.usualPosition(id, this.params.recentMatches));
      return this.shrunk(
        this.history.batters.get(id),
        true,
        this.usual(this.history.positions.get(group), true),
        (g) => (g === WICKET_GROUP ? this.params.batterWicketK : this.params.batterRunsK),
        BATTER_GROUPS,
      );
    });
  }

  bowler(id: string) {
    return this.cached(this.bowlerCache, id, () => {
      const kind = this.history.oversAMatch(id, this.params.recentMatches) >= 2 ? 1 : 0;
      return this.shrunk(
        this.history.bowlers.get(id),
        false,
        this.usual(this.history.bowlerKinds.get(kind), false),
        (g) => (g === WICKET_GROUP ? this.params.bowlerWicketK : this.params.bowlerRunsK),
        GROUPS,
      );
    });
  }

  ground(venueId: string) {
    return this.cached(this.groundCache, venueId, () =>
      isFinite(this.params.groundK)
        ? this.shrunk(
            this.history.grounds.get(venueId),
            false,
            null,
            () => this.params.groundK,
            GROUPS,
          )
        : new Float64Array(GROUPS).fill(1),
    );
  }

  private chase(band: number) {
    return this.cached(this.pressureCache, band, () =>
      this.usual(this.history.pressure.get(band), false),
    );
  }

  /** Whether the chance of an outcome depends on how the chase is going. */
  get usesPressure() {
    return isFinite(this.params.pressureK);
  }

  /**
   * Writes the chance of each outcome into `out`. `band` is the chase's required
   * rate (lib/sim/history.ts) or -1.
   */
  chances(
    out: Float64Array,
    batter: string,
    bowler: string,
    venueId: string,
    phase: number,
    innings: number,
    band = -1,
  ) {
    const bat = this.batter(batter);
    const bowl = this.bowler(bowler);
    const ground = this.ground(venueId);
    const at = situation(phase, innings);

    // what these two have done to each other, beyond what the rest would predict
    let pair: Float64Array | null = null;
    if (isFinite(this.params.pairK)) {
      const met = this.history.pairs.get(`${batter} ${bowler}`);
      if (met) {
        const usual = bat.map((r, g) => r * bowl[g]);
        pair = this.shrunk(met, false, usual, () => this.params.pairK, BATTER_GROUPS);
        for (let g = 0; g < BATTER_GROUPS; g++) pair[g] /= usual[g] || 1;
        pair[GROUPS - 1] = 1;
      }
    }
    // damped by K, as a share of all that pressure seems to do
    const chase = band >= 0 && this.usesPressure ? this.chase(band) : null;
    const strength = chase ? 1000 / (1000 + this.params.pressureK) : 0;

    let total = 0;
    for (let o = 0; o < OUTCOMES; o++) {
      let p = this.now[at * OUTCOMES + o];
      const g = GROUP[o];
      if (g >= 0) {
        p *= bat[g] * bowl[g] * ground[g];
        if (pair) p *= pair[g];
        if (chase) p *= chase[g] ** strength;
      }
      out[o] = p;
      total += p;
    }
    for (let o = 0; o < OUTCOMES; o++) out[o] /= total;
  }
}
