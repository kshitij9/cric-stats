/** How a player's record is worded in a short list. Safe to import from pages. */
import { FEW_BALLS } from '@/lib/matchup-types';

const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

export const battingLine = (p: {
  player_id: string;
  unique_name: string;
  innings: number;
  runs: number;
  balls: number;
  strike_rate: number | null;
  best_runs: number;
  best_balls: number;
  best_not_out: boolean;
}) => ({
  id: p.player_id,
  name: p.unique_name,
  thin: p.balls < FEW_BALLS,
  record: `${count(p.runs, 'run')}, strike rate ${p.strike_rate?.toFixed(1) ?? '–'}, from ${count(p.innings, 'innings', 'innings')}`,
  best: `Best: ${p.best_runs}${p.best_not_out ? ' not out' : ''} from ${count(p.best_balls, 'ball')}`,
});

export const bowlingLine = (p: {
  player_id: string;
  unique_name: string;
  balls: number;
  wickets: number;
  economy: number | null;
  best_wickets: number;
  best_runs: number;
}) => ({
  id: p.player_id,
  name: p.unique_name,
  thin: p.balls < FEW_BALLS,
  record: `${count(p.wickets, 'wicket')}, economy ${p.economy?.toFixed(2) ?? '–'}, from ${count(p.balls, 'ball')}`,
  best: `Best: ${p.best_wickets} for ${p.best_runs}`,
});
