/**
 * What the Matchup screen shows: how a ground plays, and what two teams' players
 * have done there and against each other. Nothing here predicts anything. Safe
 * to import from pages.
 */
import type { SquadPlayer } from '@/lib/teams';
import type { VenueRef } from '@/lib/types';

/** "Recent": this many calendar years, up to the latest in the data. */
export const RECENT_SEASONS = 4;
/** A ground with fewer first innings than this says little. */
export const FEW_INNINGS = 10;
/** A player's record at a ground over fewer balls than this says little. */
export const FEW_BALLS = 60;
/** So does a head-to-head over fewer than this. */
export const FEW_PAIR_BALLS = 12;

export type SeasonChoice = 'recent' | 'all';
export type PlayingPhase = 'powerplay' | 'middle' | 'death';

/** What a first innings does in one phase, on average. */
export type PhaseFigures = {
  phase: PlayingPhase;
  runs: number;
  wickets: number;
  run_rate: number | null; // runs per six legal balls
};

export type Typical = {
  score: number; // average first-innings total
  phases: PhaseFigures[];
  bat_first_win_percent: number | null; // of matches with a winner
};

export type GroundProfile = {
  venue: VenueRef;
  seasons: { choice: SeasonChoice; from: number; to: number };
  matches: number; // all matches at the ground in those seasons
  innings: number; // first innings counted: 20 overs bowled, or all out
  lowest: number | null;
  highest: number | null;
  decided: number; // matches with a winner
  bat_first_wins: number;
  here: Typical | null; // null: nothing to count
  /** Every other ground, weighted to the same seasons as the matches here. */
  elsewhere: Typical | null;
};

/** A ground in use in the latest season. */
export type CurrentGround = VenueRef & { matches: number };

export type GroundBatting = {
  innings: number;
  runs: number;
  balls: number; // faced
  outs: number;
  average: number | null;
  strike_rate: number | null;
  /** The highest innings here: most runs, then not out, then fewest balls. */
  best_runs: number;
  best_balls: number;
  best_not_out: boolean;
};

export type GroundBowling = {
  innings: number; // bowled in
  balls: number; // legal
  runs_conceded: number;
  wickets: number;
  economy: number | null;
  /** The best innings here: most wickets, then fewest runs. */
  best_wickets: number;
  best_runs: number;
};

/** A player's whole IPL record, and their record at the chosen ground. */
export type MatchupPlayer = SquadPlayer & {
  at_ground: { batting: GroundBatting | null; bowling: GroundBowling | null };
};

export type Side = {
  team_id: number;
  name: string;
  players: MatchupPlayer[]; // in batting order
  missing: number; // saved players no longer in the match data
};

export type Meeting = {
  balls: number; // faced
  runs: number; // off the bat
  dismissals: number; // taken by this bowler
  strike_rate: number | null;
};

/** One batter against one bowler, over every IPL season and ground. */
export type Pair = Meeting & {
  batter_id: string;
  bowler_id: string;
  /** The part of it at the chosen ground; null if none was chosen or they never met there. */
  at_ground: Meeting | null;
};

export type Matchup = {
  venue: VenueRef | null;
  sides: [Side, Side];
  /** [first side batting against the second's players, and the reverse] */
  pairs: [Pair[], Pair[]];
};
