import type { BowlingCareer, Career } from '@/lib/types';

/** A figure that can be shown side by side. */
export type Factor<T> = {
  key: string;
  label: string;
  get: (career: T) => number | null;
  show?: (value: number) => string;
  better?: 'higher' | 'lower'; // unset for plain counts of opportunity
  help?: string;
};

const percent = (v: number) => `${v}%`;
const count = (v: number) => v.toLocaleString('en-GB');

export const BATTING_FACTORS: Factor<Career>[] = [
  { key: 'innings', label: 'Innings', get: (c) => c.innings, show: count },
  { key: 'runs', label: 'Runs', get: (c) => c.runs, show: count, better: 'higher' },
  { key: 'balls', label: 'Balls faced', get: (c) => c.balls, show: count },
  {
    key: 'average',
    label: 'Average',
    get: (c) => c.average,
    better: 'higher',
    help: 'Runs per dismissal',
  },
  {
    key: 'strike_rate',
    label: 'Strike rate',
    get: (c) => c.strike_rate,
    better: 'higher',
    help: 'Runs per 100 balls',
  },
  {
    key: 'era_index',
    label: 'Era index',
    get: (c) => c.era_index,
    show: (v) => `${v.toFixed(2)}×`,
    better: 'higher',
    help: 'Scoring speed against the average batter of the same years (1.00 = average)',
  },
  { key: 'fours', label: 'Fours', get: (c) => c.fours, show: count, better: 'higher' },
  { key: 'sixes', label: 'Sixes', get: (c) => c.sixes, show: count, better: 'higher' },
  {
    key: 'boundary_percent',
    label: 'Boundary %',
    get: (c) => c.boundary_percent,
    show: percent,
    better: 'higher',
    help: 'Share of runs scored in fours and sixes',
  },
  {
    key: 'balls_per_dismissal',
    label: 'Balls per dismissal',
    get: (c) => c.balls_per_dismissal,
    better: 'higher',
    help: 'How long an innings lasts',
  },
  {
    key: 'not_out_percent',
    label: 'Not-out %',
    get: (c) => c.not_out_percent,
    show: percent,
    better: 'higher',
    help: 'Share of innings that ended without a dismissal',
  },
];

export const BOWLING_FACTORS: Factor<BowlingCareer>[] = [
  { key: 'innings', label: 'Innings', get: (c) => c.innings, show: count },
  { key: 'wickets', label: 'Wickets', get: (c) => c.wickets, show: count, better: 'higher' },
  { key: 'balls', label: 'Balls bowled', get: (c) => c.balls, show: count },
  { key: 'runs_conceded', label: 'Runs conceded', get: (c) => c.runs_conceded, show: count },
  {
    key: 'economy',
    label: 'Economy',
    get: (c) => c.economy,
    better: 'lower',
    help: 'Runs conceded per over (lower is better)',
  },
  {
    key: 'average',
    label: 'Average',
    get: (c) => c.average,
    better: 'lower',
    help: 'Runs conceded per wicket (lower is better)',
  },
  {
    key: 'strike_rate',
    label: 'Strike rate',
    get: (c) => c.strike_rate,
    better: 'lower',
    help: 'Balls per wicket (lower is better)',
  },
  {
    key: 'wickets_per_innings',
    label: 'Wickets per innings',
    get: (c) => c.wickets_per_innings,
    better: 'higher',
    help: 'Wickets for each innings bowled in',
  },
  {
    key: 'dot_percent',
    label: 'Dot ball %',
    get: (c) => c.dot_percent,
    show: percent,
    better: 'higher',
    help: 'Share of legal balls with nothing off the bat',
  },
  {
    key: 'balls_per_boundary',
    label: 'Balls per boundary',
    get: (c) => c.balls_per_boundary,
    better: 'higher',
    help: 'Balls bowled for each four or six conceded',
  },
  {
    key: 'three_wicket_innings',
    label: '3+ wicket innings',
    get: (c) => c.three_wicket_innings,
    show: count,
    better: 'higher',
    help: 'Innings with three wickets or more',
  },
  {
    key: 'five_wicket_innings',
    label: '5+ wicket innings',
    get: (c) => c.five_wicket_innings,
    show: count,
    better: 'higher',
    help: 'Innings with five wickets or more',
  },
];

export const DEFAULT_FACTORS = {
  batting: ['innings', 'runs', 'average', 'strike_rate', 'era_index', 'boundary_percent'],
  bowling: ['innings', 'wickets', 'economy', 'average', 'strike_rate', 'dot_percent'],
};
