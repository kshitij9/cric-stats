/** Shapes the APIs return. Safe to import from pages: types only. */

export type Format = 'Test' | 'ODI' | 'T20';
export type Competition = 'international' | 'ipl';

/** Which side of a player's game the Player and Compare screens show. */
export type Discipline = 'batting' | 'bowling';

/** What a figure is counted over: the IPL is T20 and never mixed with T20Is. */
export type Scope = { format: Format; competition: Competition };

/** Enough to name a player. unique_name tells namesakes apart. */
export type PlayerRef = { player_id: string; name: string; unique_name: string };

export type PlayerSummary = PlayerRef & {
  gender: string;
  full_name: string | null; // e.g. 'Virat Kohli', where the register has one
  teams: string[]; // most played for first
  matches: number;
  first_year: number | null;
  last_year: number | null;
};

export type VenueRef = { venue_id: string; name: string; city: string };
export type VenueSummary = VenueRef & { matches: number };

export type Career = PlayerRef & {
  player_name: string;
  format: Format;
  innings: number;
  runs: number;
  balls: number;
  outs: number;
  fours: number;
  sixes: number;
  average: number | null;
  strike_rate: number | null;
  balls_per_dismissal: number | null;
  boundary_percent: number | null;
  not_out_percent: number | null;
  era_index: number | null;
  first_match: string | null; // YYYY-MM-DD, first in the data
  last_match: string | null;
  may_be_incomplete: boolean;
};

export type EraYear = {
  year: number;
  format: Format;
  era_index: number | null;
  runs: number;
  balls: number;
  expected_runs: number;
};

export type Matchup = {
  bowler_id: string;
  bowler: string;
  unique_name: string;
  format: Format;
  balls: number;
  runs: number;
  dismissals: number;
  strike_rate: number | null;
};

export type BowlingFigures = {
  innings: number; // bowled in
  balls: number; // legal balls
  runs_conceded: number;
  wickets: number;
  economy: number | null; // runs per six legal balls
  average: number | null; // runs per wicket
  strike_rate: number | null; // balls per wicket
  dots: number;
  fours: number; // conceded, boundaries only
  sixes: number;
  dot_percent: number | null;
  balls_per_boundary: number | null;
  wickets_per_innings: number | null;
  three_wicket_innings: number; // three or more
  five_wicket_innings: number; // five or more
  best_wickets: number | null; // best innings
  best_runs: number | null;
};

export type BowlingCareer = PlayerRef &
  BowlingFigures & {
    player_name: string;
    format: Format;
    first_match: string | null; // YYYY-MM-DD, first in the data
    last_match: string | null;
    may_be_incomplete: boolean;
  };

export type BowlingYear = BowlingFigures & { year: number; format: Format };

export type BowlingMatchup = {
  batter_id: string;
  batter: string;
  unique_name: string;
  format: Format;
  balls: number; // legal balls
  runs: number; // conceded, wides and no-balls included
  dismissals: number;
  economy: number | null;
};

export type Coverage = {
  from: string;
  to: string;
  loaded_at: string | null;
  formats: { format: Format; gender: string; matches: number; from: string; to: string }[];
  teams: Record<string, string[]>; // by gender
};
