/**
 * Two IPL franchises against each other: who has won, how recent meetings went,
 * and who did most in them. This is about the sides as they actually lined up in
 * each match, not teams made in the app. Safe to import from pages.
 */
import type { SeasonChoice } from '@/lib/matchup-types';
import type { VenueRef } from '@/lib/types';

export const RESULTS_SHOWN = 5;
export const PERFORMERS_SHOWN = 3;

export type FranchiseSpan = {
  team: string;
  first_season: number;
  last_season: number;
  matches: number;
  current: boolean; // played in the latest season
};

/** Two sides, in the order chosen. */
export type Side = 0 | 1;
export type Sides<T> = [T, T];

export type Score = { side: Side; runs: number; wickets: number; balls: number };

export type Meeting = {
  match_id: string;
  date: string; // YYYY-MM-DD
  venue: VenueRef;
  scores: Score[]; // in batting order; super overs are not included
  winner: Side | null;
  /** How it was decided. */
  outcome: 'runs' | 'wickets' | 'super over' | 'bowl-out' | 'tie' | 'no result';
  by: number | null; // runs or wickets
  method: string | null; // 'D/L' where the target was changed
};

/** `other`: matches with no winner. */
export type Tally = { played: number; wins: Sides<number>; other: number };

export type MetAt = VenueRef & { record: Tally };

export type RunScorer = {
  player_id: string;
  unique_name: string;
  innings: number;
  runs: number;
  balls: number;
  strike_rate: number | null;
  best_runs: number;
  best_balls: number;
  best_not_out: boolean;
};

export type WicketTaker = {
  player_id: string;
  unique_name: string;
  innings: number;
  balls: number;
  runs_conceded: number;
  wickets: number;
  economy: number | null;
  best_wickets: number;
  best_runs: number;
};

export type Rivalry = {
  teams: Sides<string>;
  seasons: { choice: SeasonChoice; from: number; to: number };
  venue: VenueRef | null;
  overall: Tally; // at every ground
  here: Tally | null; // at the chosen one
  grounds: MetAt[]; // everywhere they have met, the most often first
  /** Meetings at the chosen ground, or all of them; the latest first. */
  meetings: Meeting[];
  /** From those meetings, for each side. */
  batting: Sides<RunScorer[]>;
  bowling: Sides<WicketTaker[]>;
};

/** What happened, in a sentence. */
export function resultOf(meeting: Meeting, teams: Sides<string>): string {
  const name = meeting.winner === null ? '' : teams[meeting.winner];
  const note = meeting.method ? ` (${meeting.method})` : '';
  switch (meeting.outcome) {
    case 'runs':
    case 'wickets': {
      const unit = meeting.by === 1 ? meeting.outcome.slice(0, -1) : meeting.outcome;
      return `${name} won by ${meeting.by} ${unit}${note}`;
    }
    case 'super over':
      return `Tied: ${name} won the super over`;
    case 'bowl-out':
      return `Tied: ${name} won the bowl-out`;
    case 'tie':
      return `Tied${note}`;
    default:
      return 'No result';
  }
}

/** '19.2' for 116 balls. */
export const overs = (balls: number) =>
  balls % 6 ? `${Math.floor(balls / 6)}.${balls % 6}` : `${balls / 6}`;
