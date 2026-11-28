import { History, positionGroup } from '../../lib/sim/history';
import type { PastMatch } from '../../lib/sim/types';
import { actual, firstWon, logLoss, mean, walk, type Period } from './common';

/**
 * The things the simulator has to beat. Their settings are chosen on the tuning
 * seasons too, so that each is as good as it can fairly be.
 */

// ---- the winner: team ratings (Elo) ----------------------------------------

export type EloParams = {
  k: number; // how far one result moves a rating
  kept: number; // share of a rating's distance from average kept into a new season
  chasing: number; // rating points added to the side batting second
};

/** Chance for the side batting first, for every match of the period with a result. */
export function elo(matches: PastMatch[], period: Period, p: EloParams) {
  const ratings = new Map<string, number>();
  const chances = new Map<string, number>();
  let season = 0;
  let day: { winner: string; loser: string; change: number }[] = [];
  let date = '';
  const settle = () => {
    for (const r of day) {
      ratings.set(r.winner, (ratings.get(r.winner) ?? 1500) + r.change);
      ratings.set(r.loser, (ratings.get(r.loser) ?? 1500) - r.change);
    }
    day = [];
  };
  for (const m of matches) {
    if (m.season > period.to) break;
    // as in the simulator, a day's results are known only afterwards
    if (m.date !== date) {
      settle();
      date = m.date;
    }
    if (m.season !== season) {
      season = m.season;
      for (const [team, r] of ratings) ratings.set(team, 1500 + (r - 1500) * p.kept);
    }
    const won = firstWon(m);
    if (won === null) continue;
    const first = m.teams[m.battingFirst!];
    const second = m.teams[1 - m.battingFirst!];
    const gap = (ratings.get(second) ?? 1500) + p.chasing - (ratings.get(first) ?? 1500);
    const expected = 1 / (1 + 10 ** (gap / 400));
    if (m.season >= period.from) chances.set(m.id, expected);
    const change = p.k * Math.abs(won - expected);
    day.push(
      won ? { winner: first, loser: second, change } : { winner: second, loser: first, change },
    );
  }
  return chances;
}

export function tuneElo(matches: PastMatch[], period: Period) {
  let best = { loss: Infinity, params: { k: 0, kept: 0, chasing: 0 } };
  for (const k of [2, 4, 8, 12, 16, 24, 32, 48]) {
    for (const kept of [0, 0.25, 0.5, 0.75, 1]) {
      for (const chasing of [-20, 0, 10, 20, 35, 50, 70]) {
        const params = { k, kept, chasing };
        const chances = elo(matches, period, params);
        const loss = mean(
          matches.filter((m) => chances.has(m.id)).map((m) => logLoss(chances.get(m.id)!, firstWon(m)!)),
        );
        if (loss < best.loss) best = { loss, params };
      }
    }
  }
  return best;
}

// ---- the first-innings total: the ground's recent average ------------------

export type GroundParams = {
  matches: number; // the ground's latest completed first innings
  league: number; // the league's latest, for what is usual now
  weight: number; // innings' worth of the usual mixed in (0: the plain average)
  /**
   * The same correction for the scoring level that the simulator may use: the
   * league's recent average, each match counting half as much for every `level`
   * played since, plus how far the ground's innings were above the level of
   * their day. Left out: no correction.
   */
  level?: number;
};

/** A running average in which each addition counts for less as more follow. */
class Fading {
  private sum = 0;
  private weight = 0;
  private readonly keep: number;
  constructor(halfLife: number) {
    this.keep = 0.5 ** (1 / halfLife);
  }
  add(values: number[]) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    this.sum = this.sum * this.keep + mean;
    this.weight = this.weight * this.keep + 1;
  }
  get value() {
    return this.weight ? this.sum / this.weight : null;
  }
}

export function groundAverage(matches: PastMatch[], period: Period, p: GroundParams) {
  const here = new Map<string, { total: number; then: number }[]>();
  const all: number[] = [];
  const fading = p.level === undefined ? null : new Fading(p.level);
  const out = new Map<string, number>();
  let date = '';
  let day: { venue: string; total: number }[] = [];
  for (const m of matches) {
    if (m.season > period.to) break;
    if (m.date !== date) {
      const then = fading?.value;
      for (const d of day) {
        all.push(d.total);
        here.set(d.venue, [
          ...(here.get(d.venue) ?? []),
          { total: d.total, then: then ?? d.total },
        ]);
      }
      for (const d of day) fading?.add([d.total]);
      day = [];
      date = m.date;
    }
    if (m.season >= period.from && all.length) {
      const seen = (here.get(m.venueId) ?? []).slice(-p.matches);
      if (fading) {
        const above = seen.reduce((a, s) => a + s.total - s.then, 0);
        const count = seen.length + p.weight;
        out.set(m.id, fading.value! + (count ? above / count : 0));
      } else {
        const usual = mean(all.slice(-p.league));
        const weight = seen.length ? p.weight : 1;
        out.set(
          m.id,
          (seen.reduce((a, s) => a + s.total, 0) + weight * usual) / (seen.length + weight),
        );
      }
    }
    if (!m.shortened) day.push({ venue: m.venueId, total: actual(m).totals[0] });
  }
  return out;
}

// ---- a player's runs and wickets: their recent average ---------------------

export type PlayerParams = {
  matches: number; // their latest matches
  weight: number; // matches' worth of what is usual for such a player (0: plain)
  /**
   * The same correction for the scoring level: what they did relative to the
   * league's runs (and wickets) a player at the time, times that figure now.
   */
  level?: number;
};

type Usual = { runs: number; wickets: number; runsLevel: number; wicketsLevel: number; n: number };
type Past = { runs: number; wickets: number; runsLevel: number; wicketsLevel: number };
export type Average = { runs: number; wickets: number };

/**
 * Per player and match, for each setting: recent average runs and wickets.
 * "Usual" is the average over everyone in the same part of the order (for runs)
 * or with the same amount of bowling (for wickets), this season and last.
 */
export function eachPlayerAverage(
  matches: PastMatch[],
  period: Period,
  settings: PlayerParams[],
  visit: (setting: number, match: PastMatch, id: string, average: Average) => void,
) {
  const usual = new Map<string, Map<number, Usual>>(); // level and group -> season
  const own = new Map<string, Past[]>(); // level and player -> latest matches
  const levels = [...new Set(settings.map((s) => s.level))].map((halfLife) => ({
    halfLife,
    runs: halfLife === undefined ? null : new Fading(halfLife),
    wickets: halfLife === undefined ? null : new Fading(halfLife),
  }));
  const bucket = (history: History, id: string) => ({
    bat: `bat ${positionGroup(history.usualPosition(id, 20))}`,
    bowl: `bowl ${Math.round(Math.min(4, history.oversAMatch(id, 20)))}`,
  });
  walk(matches, { from: matches[0].season, to: period.to }, (history, day) => {
    // the level before this day's matches; 1 where there is no correction
    const now = new Map(
      levels.map((l) => [
        l.halfLife,
        { runs: l.runs?.value || 1, wickets: l.wickets?.value || 1 },
      ]),
    );
    for (const m of day) {
      if (m.season < period.from) continue;
      for (const id of m.named.flat()) {
        const groups = bucket(history, id);
        settings.forEach((p, i) => {
          const level = now.get(p.level)!;
          const of = (group: string) => {
            const seasons = usual.get(`${p.level} ${group}`);
            const sum = { runs: 0, wickets: 0, runsLevel: 0, wicketsLevel: 0, n: 0 };
            for (const season of [m.season - 1, m.season]) {
              const s = seasons?.get(season);
              if (!s) continue;
              sum.runs += s.runs;
              sum.wickets += s.wickets;
              sum.runsLevel += s.runsLevel;
              sum.wicketsLevel += s.wicketsLevel;
              sum.n += s.n;
            }
            const n = sum.n || 1;
            return {
              runs: sum.runs / n,
              wickets: sum.wickets / n,
              runsLevel: sum.n ? sum.runsLevel / n : level.runs,
              wicketsLevel: sum.n ? sum.wicketsLevel / n : level.wickets,
            };
          };
          const seen = (own.get(`${p.level} ${id}`) ?? []).slice(-p.matches);
          const weight = seen.length ? p.weight : 1;
          const bat = of(groups.bat);
          const bowl = of(groups.bowl);
          const total = (key: keyof Past) => seen.reduce((n, a) => n + a[key], 0);
          visit(i, m, id, {
            runs:
              (level.runs * (total('runs') + weight * bat.runs)) /
              (total('runsLevel') + weight * bat.runsLevel || 1),
            wickets:
              (level.wickets * (total('wickets') + weight * bowl.wickets)) /
              (total('wicketsLevel') + weight * bowl.wicketsLevel || 1),
          });
        });
      }
    }
    for (const m of day) {
      const happened = actual(m).players;
      const named = m.named.flat();
      if (!named.length) continue;
      for (const l of levels) {
        const level = now.get(l.halfLife)!;
        for (const id of named) {
          const groups = bucket(history, id);
          const a = happened.get(id)!;
          const record = {
            runs: a.runs,
            wickets: a.wickets,
            runsLevel: level.runs,
            wicketsLevel: level.wickets,
          };
          const key = `${l.halfLife} ${id}`;
          const list = own.get(key) ?? [];
          list.push(record);
          if (list.length > 40) list.shift();
          own.set(key, list);
          for (const group of [groups.bat, groups.bowl]) {
            const name = `${l.halfLife} ${group}`;
            const seasons = usual.get(name) ?? new Map<number, Usual>();
            const s =
              seasons.get(m.season) ??
              { runs: 0, wickets: 0, runsLevel: 0, wicketsLevel: 0, n: 0 };
            s.runs += record.runs;
            s.wickets += record.wickets;
            s.runsLevel += record.runsLevel;
            s.wicketsLevel += record.wicketsLevel;
            s.n += 1;
            seasons.set(m.season, s);
            usual.set(name, seasons);
          }
        }
        l.runs?.add(named.map((id) => happened.get(id)!.runs));
        l.wickets?.add(named.map((id) => happened.get(id)!.wickets));
      }
    }
  });
}

export function playerAverages(matches: PastMatch[], period: Period, settings: PlayerParams[]) {
  const out = settings.map(() => new Map<string, Average>());
  eachPlayerAverage(matches, period, settings, (i, m, id, average) => {
    out[i].set(`${m.id} ${id}`, average);
  });
  return out;
}
