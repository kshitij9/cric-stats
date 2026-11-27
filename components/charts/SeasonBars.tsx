'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, GRID, TOOLTIP } from '@/components/charts/theme';
import { PLAYER_COLORS } from '@/lib/colors';

/** A total for each year a player batted or bowled, e.g. runs from so many balls. */
export default function SeasonBars<T extends { year: number; balls: number }>({
  data,
  metric,
  label,
}: {
  data: T[];
  metric: keyof T & string;
  label: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="year" {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip
            {...TOOLTIP}
            cursor={{ fill: '#ffffff0d' }}
            formatter={(value, _name, item) => [
              `${value} from ${(item?.payload as T).balls} balls`,
              label,
            ]}
          />
          <Bar dataKey={metric} fill={PLAYER_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
