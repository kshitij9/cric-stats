import { History } from './history';
import type { SideInput } from './types';

/**
 * A side's batting order and bowling habits from earlier matches only: nothing
 * about the match being predicted but who was named.
 */
export function sideFrom(history: History, players: string[], recentMatches: number): SideInput {
  return {
    order: usualOrder(history, players, recentMatches),
    bowling: players.map((id) => {
      const recent = history.recent(id, recentMatches);
      const byOver = new Array<number>(20).fill(0);
      for (const a of recent) for (const over of a.overs) if (over < 20) byOver[over] += 1;
      return {
        id,
        overs: history.oversAMatch(id, recentMatches),
        byOver: byOver.map((n) => (recent.length ? n / recent.length : 0)),
      };
    }),
  };
}

/** By where each usually bats; those who never have go last, as they were listed. */
export function usualOrder(history: History, players: string[], recentMatches: number) {
  return players
    .map((id, listed) => ({ id, listed, at: history.usualPosition(id, recentMatches) }))
    .sort((a, b) => a.at - b.at || a.listed - b.listed)
    .map((p) => p.id);
}
