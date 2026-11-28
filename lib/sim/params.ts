import type { Params } from './model';

/**
 * Chosen on the IPL seasons 2019 to 2022 by `scripts/backtest/run.sh tune`, run
 * on 27 November 2026. See docs/simulator-backtest.md before using the results.
 */
export const PARAMS: Params = {
  halfLife: 3,
  leagueHalfLife: 2,
  batterRunsK: 250,
  batterWicketK: 400,
  bowlerRunsK: 250,
  bowlerWicketK: 2400,
  groundK: 1000,
  pairK: 300,
  byInnings: true,
  pressureK: 0,
  recentMatches: 10,
  daySpread: 0.2,
};

/** How a simulated chance is turned into a stated one (scripts/backtest/evaluate.ts). */
// A slope of 0 gives every match the same chance (45% to the side batting first):
// on the tuning seasons the simulated chances told nothing about who won. The app
// must not show it as a prediction.
export const CALIBRATION = { slope: 0, shift: -0.214254 };
