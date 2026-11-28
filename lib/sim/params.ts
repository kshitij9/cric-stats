import type { Params } from './model';

/**
 * The second version: chosen on the IPL of 2013 to 2022 by
 * `scripts/backtest/run.sh tune2`, 28 November 2026. The first version's
 * settings are in scripts/backtest/frozen.ts.
 *
 * It did not pass, and was no better than the first on matches fresh to both:
 * read docs/simulator-improvement.md before using any result.
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
  recentMatches: 20,
  daySpread: 0.2,
  dayCentred: true,
  levelMatches: 60,
  wicketsK: 4000,
};

/**
 * How a simulated chance is turned into a stated one (scripts/backtest/evaluate.ts).
 * A slope near 0 gives nearly every match the same chance: on the tuning seasons
 * the simulated chances told next to nothing about who won. The app must not show
 * it as a prediction.
 */
export const CALIBRATION = { slope: 0.052053, shift: -0.223146 };
