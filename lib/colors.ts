/**
 * One colour per compared player, in fixed order. Checked for colour-blind
 * separation and contrast against the card background (#18181b).
 */
export const PLAYER_COLORS = [
  '#338ced',
  '#e76624',
  '#00a888',
  '#d28e05',
  '#e24d8b',
  '#0aac23',
] as const;

export const MAX_COMPARE = PLAYER_COLORS.length;

/** The two sides of a matchup, first and second. */
export const TEAM_COLORS = [PLAYER_COLORS[0], PLAYER_COLORS[1]] as const;
