/** Shared chart styling: quiet axes and grid, text in neutral ink. */
export const AXIS = {
  axisLine: false,
  tickLine: false,
  tick: { fill: '#a1a1aa', fontSize: 12 },
} as const;

export const GRID = '#303036';

export const TOOLTIP = {
  contentStyle: {
    backgroundColor: '#09090b',
    border: '1px solid #3f3f46',
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: '#f4f4f5', fontWeight: 600 },
  itemStyle: { color: '#d4d4d8' },
} as const;
