/** One delivery, as the simulator learns from it. */
export type Ball = {
  innings: number; // 1 or 2; super overs are not included
  over: number; // 0-based
  batter: string;
  nonStriker: string;
  bowler: string;
  runsBatter: number;
  runs: number; // all runs off the delivery
  outcome: number; // lib/sim/outcomes.ts
  // kept apart from the outcome: a stumping off a wide is a wicket, but no ball faced
  faced: boolean; // not a wide
  legal: boolean; // neither a wide nor a no-ball
  out: string[]; // players dismissed on it
};

export type PastMatch = {
  id: string;
  date: string; // YYYY-MM-DD
  season: number; // calendar year
  venueId: string;
  teams: [string, string]; // franchises
  named: [string[], string[]]; // player IDs, in the same order as teams
  battingFirst: 0 | 1 | null;
  winner: 0 | 1 | null; // a super over's winner counts
  shortened: boolean; // overs lost, or a first innings that did not run its course
  balls: Ball[]; // in the order bowled
};

/** What a side brings to a simulated match. */
export type SideInput = {
  order: string[]; // batting order
  bowling: BowlerUsage[]; // the same players
  /** Who bowls each over, where known; otherwise drawn from their habits. */
  overs?: (string | undefined)[];
};

export type BowlerUsage = {
  id: string;
  overs: number; // a match, lately
  byOver: number[]; // share of matches in which they bowled each of the 20 overs
};
