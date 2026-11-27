import type { Career } from '@/lib/types';

/** The batting figures that can be shown side by side. */
export type Factor = {
  key: string;
  label: string;
  get: (career: Career) => number | null;
  show?: (value: number) => string;
  higherIsBetter?: boolean; // unset for plain counts of opportunity
  help?: string;
};

const percent = (v: number) => `${v}%`;
const count = (v: number) => v.toLocaleString('en-GB');

export const FACTORS: Factor[] = [
  { key: 'innings', label: 'Innings', get: (c) => c.innings, show: count },
  { key: 'runs', label: 'Runs', get: (c) => c.runs, show: count, higherIsBetter: true },
  { key: 'balls', label: 'Balls faced', get: (c) => c.balls, show: count },
  {
    key: 'average',
    label: 'Average',
    get: (c) => c.average,
    higherIsBetter: true,
    help: 'Runs per dismissal',
  },
  {
    key: 'strike_rate',
    label: 'Strike rate',
    get: (c) => c.strike_rate,
    higherIsBetter: true,
    help: 'Runs per 100 balls',
  },
  {
    key: 'era_index',
    label: 'Era index',
    get: (c) => c.era_index,
    show: (v) => `${v.toFixed(2)}×`,
    higherIsBetter: true,
    help: 'Scoring speed against the average batter of the same years (1.00 = average)',
  },
  { key: 'fours', label: 'Fours', get: (c) => c.fours, show: count, higherIsBetter: true },
  { key: 'sixes', label: 'Sixes', get: (c) => c.sixes, show: count, higherIsBetter: true },
  {
    key: 'boundary_percent',
    label: 'Boundary %',
    get: (c) => c.boundary_percent,
    show: percent,
    higherIsBetter: true,
    help: 'Share of runs scored in fours and sixes',
  },
  {
    key: 'balls_per_dismissal',
    label: 'Balls per dismissal',
    get: (c) => c.balls_per_dismissal,
    higherIsBetter: true,
    help: 'How long an innings lasts',
  },
  {
    key: 'not_out_percent',
    label: 'Not-out %',
    get: (c) => c.not_out_percent,
    show: percent,
    higherIsBetter: true,
    help: 'Share of innings that ended without a dismissal',
  },
];

export const DEFAULT_FACTORS = [
  'innings',
  'runs',
  'average',
  'strike_rate',
  'era_index',
  'boundary_percent',
];
