import type { PlayerRef } from '@/lib/types';

const player = (player_id: string, name: string): PlayerRef => ({
  player_id,
  name,
  unique_name: name,
});

/** The players the screens open with (Cricsheet IDs). */
export const KOHLI = player('ba607b88', 'V Kohli');
export const SHARMA = player('740742ef', 'RG Sharma');
export const WILLIAMSON = player('d027ba9f', 'KS Williamson');
export const SMITH = player('30a45b23', 'SPD Smith');

export const BUMRAH = player('462411b3', 'JJ Bumrah');
export const NARINE = player('9d430b40', 'SP Narine');
export const ASHWIN = player('495d42a5', 'R Ashwin');
export const STARC = player('3fb19989', 'MA Starc');

export const QUICK_PICKS = {
  batting: [KOHLI, SHARMA, WILLIAMSON, SMITH],
  bowling: [BUMRAH, NARINE, ASHWIN, STARC],
};
