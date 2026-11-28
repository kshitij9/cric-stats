/**
 * The baselines' settings, chosen on 2019 to 2022 by `run.sh tune` on 27 November
 * 2026, like the simulator's own (lib/sim/params.ts). "Plain" is the recent
 * average with nothing mixed in.
 */
import type { Params } from '../../lib/sim/model';

/** The first version of the simulator (commit 7bb30f4), with the new switches off. */
export const PARAMS_V1: Params = {
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
  dayCentred: false,
  levelMatches: Infinity,
  wicketsK: Infinity,
};
export const CALIBRATION_V1 = { slope: 0, shift: -0.214254 };

export const ELO = { k: 2, kept: 0.5, chasing: 35 };
export const GROUND = { matches: 40, league: 74, weight: 10 };
export const GROUND_PLAIN = { matches: 40, league: 20, weight: 0 };
export const PLAYER = { matches: 40, weight: 20 };
export const PLAYER_PLAIN = { matches: 40, weight: 0 };

// The second round's baselines, chosen on 2013 to 2022 by `run.sh tune2` on
// 28 November 2026. The ground average took the level correction; the player
// averages did best without it.
export const ELO_V2 = { k: 8, kept: 0.75, chasing: 35 };
export const GROUND_V2 = { matches: 5, league: 0, weight: 10, level: 80 };
export const PLAYER_V2 = { matches: 20, weight: 20 };
