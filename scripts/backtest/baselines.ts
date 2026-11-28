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
};

export function groundAverage(matches: PastMatch[], period: Period, p: GroundParams) {
  const here = new Map<string, number[]>();
  const all: number[] = [];
  const out = new Map<string, number>();
  let date = '';
  let day: { venue: string; total: number }[] = [];
  for (const m of matches) {
    if (m.season > period.to) break;
    if (m.date !== date) {
      for (const d of day) {
        all.push(d.total);
        here.set(d.venue, [...(here.get(d.venue) ?? []), d.total]);
      }
      day = [];
      date = m.date;
    }
    if (m.season >= period.from && all.length) {
      const usual = mean(all.slice(-p.league));
      const seen = (here.get(m.venueId) ?? []).slice(-p.matches);
      const weight = seen.length ? p.weight : 1;
      out.set(m.id, (seen.reduce((a, b) => a + b, 0) + weight * usual) / (seen.length + weight));
    }
    if (!m.shortened) day.push({ venue: m.venueId, total: actual(m).totals[0] });
  }
  return out;
}

// ---- a player's runs and wickets: their recent average ---------------------

export type PlayerParams = {
  matches: number; // their latest matches
  weight: number; // matches' worth of what is usual for such a player (0: plain)
};

type Usual = { runs: number; wickets: number; n: number };

/**
 * Per player and match: recent average runs and wickets. "Usual" is the average
 * over everyone in the same part of the order (for runs) or with the same amount
 * of bowling (for wickets), this season and last.
 */
export function playerAverages(matches: PastMatch[], period: Period, settings: PlayerParams[]) {
  const out = settings.map(() => new Map<string, { runs: number; wickets: number }>());
  const usual = new Map<string, Map<number, Usual>>(); // group -> season
  const bucket = (history: History, id: string) => ({
    bat: `bat ${positionGroup(history.usualPosition(id, 20))}`,
    bowl: `bowl ${Math.round(Math.min(4, history.oversAMatch(id, 20)))}`,
  });
  walk(matches, { from: period.from - 2, to: period.to }, (history, day) => {
    for (const m of day) {
      const of = (group: string) => {
        const seasons = usual.get(group);
        const sum = { runs: 0, wickets: 0, n: 0 };
        for (const season of [m.season - 1, m.season]) {
          const s = seasons?.get(season);
          if (!s) continue;
          sum.runs += s.runs;
          sum.wickets += s.wickets;
          sum.n += s.n;
        }
        return { runs: sum.n ? sum.runs / sum.n : 0, wickets: sum.n ? sum.wickets / sum.n : 0 };
      };
      if (m.season < period.from) continue;
      for (const id of m.named.flat()) {
        const groups = bucket(history, id);
        settings.forEach((p, i) => {
          const seen = history.recent(id, p.matches);
          const weight = seen.length ? p.weight : 1;
          out[i].set(`${m.id} ${id}`, {
            runs:
              (seen.reduce((n, a) => n + a.runs, 0) + weight * of(groups.bat).runs) /
              (seen.length + weight),
            wickets:
              (seen.reduce((n, a) => n + a.wickets, 0) + weight * of(groups.bowl).wickets) /
              (seen.length + weight),
          });
        });
      }
    }
    for (const m of day) {
      const happened = actual(m).players;
      for (const id of m.named.flat()) {
        const groups = bucket(history, id);
        const a = happened.get(id)!;
        for (const group of [groups.bat, groups.bowl]) {
          const seasons = usual.get(group) ?? new Map<number, Usual>();
          const s = seasons.get(m.season) ?? { runs: 0, wickets: 0, n: 0 };
          s.runs += a.runs;
          s.wickets += a.wickets;
          s.n += 1;
          seasons.set(m.season, s);
          usual.set(group, seasons);
        }
      }
    }
  });
  return out;
}
