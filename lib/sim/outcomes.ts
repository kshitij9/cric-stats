/**
 * What one delivery can be. Every ball in the data is exactly one of these, and
 * the simulator draws one for each ball it bowls.
 */
export const DOT = 0;
export const ONE = 1;
export const TWO = 2;
export const THREE = 3;
export const FOUR = 4; // includes the rare five off the bat
export const SIX = 5;
export const WICKET = 6; // one the bowler is credited with
export const OTHER_OUT = 7; // run out and the like
export const BYE = 8; // byes or leg byes
export const WIDE = 9;
export const NO_BALL = 10;
export const OUTCOMES = 11;

/**
 * Outcomes that a player or ground is rated on, in groups. -1: not rated, so it
 * happens as often as it does on average. Batters are rated on the first
 * BATTER_GROUPS; bowlers and grounds on all of them.
 */
export const GROUP = [0, 1, 2, 2, 3, 4, 5, -1, -1, 6, 6];
export const GROUPS = 7;
export const BATTER_GROUPS = 6; // a batter has no say in wides and no-balls
export const WICKET_GROUP = 5;

export type DeliveryFacts = {
  runsBatter: number;
  wides: number;
  noballs: number;
  byes: number; // byes and leg byes together
  bowlerWicket: boolean;
  otherOut: boolean;
};

export function outcomeOf(d: DeliveryFacts): number {
  if (d.bowlerWicket) return WICKET;
  if (d.otherOut) return OTHER_OUT;
  if (d.wides > 0) return WIDE;
  if (d.noballs > 0) return NO_BALL;
  if (d.byes > 0) return BYE;
  return [DOT, ONE, TWO, THREE, FOUR, FOUR, SIX][Math.min(d.runsBatter, 6)];
}

/** Powerplay, middle or death, from the 0-based over. */
export const phaseOf = (over: number) => (over < 6 ? 0 : over < 15 ? 1 : 2);
export const PHASE_COUNT = 3;
