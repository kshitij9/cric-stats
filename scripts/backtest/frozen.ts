/**
 * The baselines' settings, chosen on 2019 to 2022 by `run.sh tune` on 27 November
 * 2026, like the simulator's own (lib/sim/params.ts). "Plain" is the recent
 * average with nothing mixed in.
 */
export const ELO = { k: 2, kept: 0.5, chasing: 35 };
export const GROUND = { matches: 40, league: 74, weight: 10 };
export const GROUND_PLAIN = { matches: 40, league: 20, weight: 0 };
export const PLAYER = { matches: 40, weight: 20 };
export const PLAYER_PLAIN = { matches: 40, weight: 0 };
