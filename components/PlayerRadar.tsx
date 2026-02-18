'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

type RadarMetric = {
  metric: string;
  score: number; // normalized 0-100 for shape
  raw: number | null;
  unit: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function maxesForFormat(format: string) {
  switch (format) {
    case 'T20':
      return {
        strike_rate: 200,
        boundary_percent: 80,
        survival_rate: 40,
        balls_per_dismissal: 45,
        era_index: 1.8,
      };
    case 'Test':
      return {
        strike_rate: 85,
        boundary_percent: 65,
        survival_rate: 40,
        balls_per_dismissal: 140,
        era_index: 1.6,
      };
    case 'ODI':
    default:
      return {
        strike_rate: 150,
        boundary_percent: 75,
        survival_rate: 40,
        balls_per_dismissal: 90,
        era_index: 1.7,
      };
  }
}

function toScore(raw: number | null | undefined, max: number) {
  if (raw == null || Number.isNaN(raw)) return 0;
  return clamp((raw / max) * 100, 0, 100);
}

export default function PlayerRadar({
  format,
  profile,
  eraIndexAvg,
}: {
  format: string;
  profile: any | null;
  eraIndexAvg: number | null;
}) {
  if (!profile) {
    return (
      <div className="h-[320px] flex items-center justify-center text-zinc-500 italic">
        No profile data available for this player...
      </div>
    );
  }

  const maxes = maxesForFormat(format);

  const boundaryPercent =
    profile.boundary_percent != null ? Number(profile.boundary_percent) : null;
  const strikeRate = profile.strike_rate != null ? Number(profile.strike_rate) : null;
  const survivalRate =
    profile.survival_rate != null ? Number(profile.survival_rate) : null;
  const ballsPerDismissal =
    profile.balls_per_dismissal != null ? Number(profile.balls_per_dismissal) : null;

  const metrics: RadarMetric[] = [
    {
      metric: 'Boundary %',
      score: toScore(boundaryPercent, maxes.boundary_percent),
      raw: boundaryPercent,
      unit: '%',
    },
    {
      metric: 'Strike Rate',
      score: toScore(strikeRate, maxes.strike_rate),
      raw: strikeRate,
      unit: '',
    },
    {
      metric: 'Survival Rate',
      score: toScore(survivalRate, maxes.survival_rate),
      raw: survivalRate,
      unit: '%',
    },
    {
      metric: 'Balls / Dismissal',
      score: toScore(ballsPerDismissal, maxes.balls_per_dismissal),
      raw: ballsPerDismissal,
      unit: '',
    },
    {
      metric: 'Era Index (avg)',
      score: toScore(eraIndexAvg, maxes.era_index),
      raw: eraIndexAvg,
      unit: '×',
    },
  ];

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={metrics} outerRadius="72%">
          <PolarGrid stroke="#27272a" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            axisLine={false}
            tick={{ fill: '#71717a', fontSize: 10 }}
            tickCount={6}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#09090b',
              border: '1px solid #27272a',
              borderRadius: '12px',
            }}
            formatter={(value: any, _name: any, ctx: any) => {
              const raw = ctx?.payload?.raw;
              const unit = ctx?.payload?.unit ?? '';
              if (raw == null) return ['–', ''];
              const display =
                unit === '×' ? `${Number(raw).toFixed(2)}×` : `${Number(raw).toFixed(1)}${unit}`;
              return [display, ctx?.payload?.metric ?? ''];
            }}
            labelFormatter={() => ''}
          />
          <Radar
            dataKey="score"
            stroke="#38bdf8"
            fill="#38bdf8"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

