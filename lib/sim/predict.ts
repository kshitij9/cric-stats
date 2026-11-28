import { simulate, type Simulation } from './engine';
import { History } from './history';
import { Model, type Params } from './model';
import { sideFrom } from './sides';

/** A match to be played: who is named, which side bats first, and where. */
export type Fixture = {
  season: number;
  venueId: string;
  first: string[]; // player IDs of the side batting first
  second: string[];
};

/** Simulates a fixture from the matches in `history` and nothing else. */
export function predict(
  history: History,
  params: Params,
  fixture: Fixture,
  options: { sims: number; seed: number; model?: Model },
): Simulation {
  const model = options.model ?? new Model(history, fixture.season, params);
  return simulate(
    model,
    sideFrom(history, fixture.first, params.recentMatches),
    sideFrom(history, fixture.second, params.recentMatches),
    fixture.venueId,
    options,
  );
}
