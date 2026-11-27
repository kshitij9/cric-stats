'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS, GRID, TOOLTIP } from '@/components/charts/theme';

export type Series<T> = { id: string; name: string; color: string; years: T[] };

/** The figures that can be drawn by season. */
export type Metric = 'era_index' | 'runs' | 'wickets' | 'economy';

/** One figure by year, a line per player. A year a player missed is a gap. */
export default function SeasonLines<K extends Metric>({
  series,
  metric,
}: {
  series: Series<{ year: number } & Record<K, number | null>>[];
  metric: K;
}) {
  const years = [...new Set(series.flatMap((s) => s.years.map((y) => y.year)))].sort();
  const first = years[0];
  const last = years.at(-1);
  if (first === undefined || last === undefined) return null;
  // every year between, so that a missed season shows as a break in the line
  const rows = Array.from({ length: last - first + 1 }, (_, i) => {
    const year = first + i;
    const row: Record<string, number | null> = { year };
    for (const s of series) row[s.id] = s.years.find((y) => y.year === year)?.[metric] ?? null;
    return row;
  });
  const era = metric === 'era_index';
  const economy = metric === 'economy';
  // the era index axis steps in halves and always shows 0.5 to 1.5
  const values = series.flatMap((s) => s.years.flatMap((y) => y[metric] ?? []));
  const low = Math.floor(Math.min(0.5, ...values) * 2) / 2;
  const high = Math.ceil(Math.max(1.5, ...values) * 2) / 2;
  const halves = Array.from({ length: Math.round((high - low) * 2) + 1 }, (_, i) => low + i / 2);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="year" {...AXIS} />
          <YAxis
            {...AXIS}
            allowDecimals={era || economy}
            // totals start at zero; an economy rate is read against the other lines
            domain={era ? [low, high] : economy ? ['auto', 'auto'] : [0, 'auto']}
            ticks={era ? halves : undefined}
          />
          <Tooltip
            {...TOOLTIP}
            formatter={(value, name) => [
              era ? `${Number(value).toFixed(2)}×` : economy ? Number(value).toFixed(2) : String(value),
              name,
            ]}
          />
          {series.length > 1 && (
            <Legend
              itemSorter={null} // keep the order the players were given in
              formatter={(value) => <span className="text-xs text-zinc-300">{String(value)}</span>}
            />
          )}
          {/* 1.0 is the average batter that year; the card explains the line */}
          {era && <ReferenceLine y={1} stroke="#a1a1aa" />}
          {/* a player with no seasons has no line, and no place in the legend */}
          {series.filter((s) => s.years.length > 0).map((s) => (
            <Line
              key={s.id}
              dataKey={s.id}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 4, fill: s.color, stroke: '#18181b', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
