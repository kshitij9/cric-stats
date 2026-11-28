/**
 * Two sides compared by what their players have done: team figures by phase, and
 * which batters and bowlers have had the better of each other. Records of past
 * balls only; nothing here predicts a result. Safe to import from pages.
 */
import {
  FEW_PAIR_BALLS,
  type GroundBatting,
  type GroundBowling,
  type MatchupPlayer,
  type Pair,
  type PlayingPhase,
  type SeasonChoice,
} from '@/lib/matchup-types';
import type { VenueRef } from '@/lib/types';

/** A side's figure over fewer balls than this is not compared. */
export const FEW_TEAM_BALLS = 120;
/** Once is chance: a bowler has troubled a batter from this many dismissals. */
export const BATTLE_DISMISSALS = 2;
export const BATTLES_SHOWN = 3;
export const STARS_SHOWN = 3;

export type PhaseKey = 'all' | PlayingPhase;

export type TeamBatting = {
  balls: number; // faced
  runs: number; // off the bat
  strike_rate: number | null;
  boundary_percent: number | null; // balls hit for four or six, in a hundred
  balls_per_dismissal: number | null;
};

export type TeamBowling = {
  balls: number; // legal
  runs_conceded: number;
  wickets: number;
  economy: number | null;
  balls_per_wicket: number | null;
};

export type TeamFigures = { batting: TeamBatting; bowling: TeamBowling };
export type ByPhase = Record<PhaseKey, TeamFigures>;

export type FaceOff = {
  venue: VenueRef | null;
  seasons: { choice: SeasonChoice; from: number; to: number };
  teams: [{ team_id: number; name: string }, { team_id: number; name: string }];
  /** For each team: its players' figures at every ground, and at the chosen one. */
  sides: [{ all: ByPhase; ground: ByPhase | null }, { all: ByPhase; ground: ByPhase | null }];
  /** Both teams at each ground of the latest season, and at the chosen one. */
  grounds: AtGround[];
};

export type AtGround = VenueRef & { sides: [TeamFigures, TeamFigures] };

export type Measure = {
  key: string;
  label: string;
  better: 'higher' | 'lower';
  dp: number;
  suffix?: string;
  of: (figures: TeamFigures) => { value: number | null; balls: number };
};

export const BATTING_MEASURES: Measure[] = [
  {
    key: 'strike_rate',
    label: 'Strike rate',
    better: 'higher',
    dp: 1,
    of: ({ batting: b }) => ({ value: b.strike_rate, balls: b.balls }),
  },
  {
    key: 'boundary_percent',
    label: 'Balls hit for four or six',
    better: 'higher',
    dp: 1,
    suffix: '%',
    of: ({ batting: b }) => ({ value: b.boundary_percent, balls: b.balls }),
  },
  {
    key: 'balls_per_dismissal',
    label: 'Balls per dismissal',
    better: 'higher',
    dp: 1,
    of: ({ batting: b }) => ({ value: b.balls_per_dismissal, balls: b.balls }),
  },
];

export const BOWLING_MEASURES: Measure[] = [
  {
    key: 'economy',
    label: 'Economy (runs per over)',
    better: 'lower',
    dp: 2,
    of: ({ bowling: b }) => ({ value: b.economy, balls: b.balls }),
  },
  {
    key: 'balls_per_wicket',
    label: 'Balls per wicket',
    better: 'lower',
    dp: 1,
    of: ({ bowling: b }) => ({ value: b.balls_per_wicket, balls: b.balls }),
  },
];

/**
 * Which of two sides is ahead on a measure: 0, 1, or null where there is too
 * little to compare, or nothing between them as shown.
 */
export function leader(measure: Measure, a: TeamFigures, b: TeamFigures): 0 | 1 | null {
  const [x, y] = [measure.of(a), measure.of(b)];
  if (x.value === null || y.value === null) return null;
  if (x.balls < FEW_TEAM_BALLS || y.balls < FEW_TEAM_BALLS) return null;
  if (x.value.toFixed(measure.dp) === y.value.toFixed(measure.dp)) return null;
  return x.value > y.value === (measure.better === 'higher') ? 0 : 1;
}

const steady = (a: Pair, b: Pair) =>
  a.batter_id.localeCompare(b.batter_id) || a.bowler_id.localeCompare(b.bowler_id);

/** The bowlers who have got a batter out most often, the quickest work first. */
export const gotOutMost = (pairs: Pair[]) =>
  pairs
    .filter((p) => p.dismissals >= BATTLE_DISMISSALS)
    .sort(
      (a, b) =>
        b.dismissals - a.dismissals || a.balls - b.balls || a.runs - b.runs || steady(a, b),
    )
    .slice(0, BATTLES_SHOWN);

/** The batters who have scored fastest off a bowler, over enough balls to count. */
export const scoredFastest = (pairs: Pair[]) =>
  pairs
    .filter((p) => p.balls >= FEW_PAIR_BALLS)
    .sort(
      (a, b) => (b.strike_rate ?? 0) - (a.strike_rate ?? 0) || b.balls - a.balls || steady(a, b),
    )
    .slice(0, BATTLES_SHOWN);

export type Star<T> = { player: MatchupPlayer; here: T };

/** Who has made the most runs at the chosen ground; ties go to the quicker. */
export const topRunScorers = (players: MatchupPlayer[]): Star<GroundBatting>[] =>
  players
    .flatMap((player) => {
      const here = player.at_ground.batting;
      return here && here.runs > 0 ? [{ player, here }] : [];
    })
    .sort(
      (a, b) =>
        b.here.runs - a.here.runs ||
        a.here.balls - b.here.balls ||
        a.player.player_id.localeCompare(b.player.player_id),
    )
    .slice(0, STARS_SHOWN);

/** Who has taken the most wickets there; ties go to the more economical. */
export const topWicketTakers = (players: MatchupPlayer[]): Star<GroundBowling>[] =>
  players
    .flatMap((player) => {
      const here = player.at_ground.bowling;
      return here && here.wickets > 0 ? [{ player, here }] : [];
    })
    .sort(
      (a, b) =>
        b.here.wickets - a.here.wickets ||
        (a.here.economy ?? Infinity) - (b.here.economy ?? Infinity) ||
        a.player.player_id.localeCompare(b.player.player_id),
    )
    .slice(0, STARS_SHOWN);
