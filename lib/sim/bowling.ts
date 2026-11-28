import type { BowlerUsage } from './types';

/**
 * Who bowls each over. Each player is given a share of the twenty overs in line
 * with how much they have bowled lately (at most four, and a sliver for everyone
 * so that a side short of bowlers can still finish). Over by over, one is drawn
 * who has overs left and did not bowl the one before, favouring those who
 * usually bowl at that point and have most of their share to go.
 */
export const OVERS = 20;
export const MOST_OVERS = 4;
const SLIVER = 0.03;

/** Overs expected of each player: they add up to twenty where possible. */
export function shares(bowlers: BowlerUsage[]): number[] {
  const weight = bowlers.map((b) => b.overs + SLIVER);
  const share = (scale: number) => weight.map((w) => Math.min(MOST_OVERS, w * scale));
  const total = (scale: number) => share(scale).reduce((a, b) => a + b, 0);
  const wanted = Math.min(OVERS, MOST_OVERS * bowlers.length);
  let low = 0;
  let high = 1;
  while (total(high) < wanted - 1e-9 && high < 1e9) high *= 2;
  for (let i = 0; i < 50; i++) {
    const middle = (low + high) / 2;
    if (total(middle) < wanted) low = middle;
    else high = middle;
  }
  return share(high);
}

export class Attack {
  private readonly quota: number[];
  private readonly liking: Float64Array; // [bowler * OVERS + over]
  private readonly weight: Float64Array;
  readonly used: Uint8Array;

  constructor(bowlers: BowlerUsage[]) {
    // five must be able to share twenty overs
    if (bowlers.length * MOST_OVERS < OVERS) {
      throw new Error('a side needs at least five players to bowl twenty overs');
    }
    this.quota = shares(bowlers);
    this.liking = new Float64Array(bowlers.length * OVERS);
    this.weight = new Float64Array(bowlers.length);
    this.used = new Uint8Array(bowlers.length);
    bowlers.forEach((b, i) => {
      for (let over = 0; over < OVERS; over++) {
        const before = b.byOver[Math.max(0, over - 1)];
        const after = b.byOver[Math.min(OVERS - 1, over + 1)];
        this.liking[i * OVERS + over] = (before + 2 * b.byOver[over] + after) / 4 + 0.01;
      }
    });
  }

  reset() {
    this.used.fill(0);
  }

  /** The bowler of this over; `previous` bowled the last one (-1 at the start). */
  next(over: number, previous: number, random: () => number): number {
    let total = 0;
    for (let i = 0; i < this.used.length; i++) {
      const free = i !== previous && this.used[i] < MOST_OVERS;
      const left = Math.max(this.quota[i] - this.used[i], 0.01);
      this.weight[i] = free ? this.liking[i * OVERS + over] * left * left : 0;
      total += this.weight[i];
    }
    let draw = random() * total;
    let chosen = -1;
    for (let i = 0; i < this.weight.length; i++) {
      if (!this.weight[i]) continue;
      chosen = i;
      draw -= this.weight[i];
      if (draw < 0) break;
    }
    // with exactly five bowlers the rules can leave nobody but the last one
    if (chosen < 0) chosen = previous;
    this.used[chosen] += 1;
    return chosen;
  }
}
