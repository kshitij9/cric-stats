'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { Career, Format } from '@/lib/types';

type DuelRadarMetric = {
  metric: string;
  scoreA: number;
  scoreB: number;
  rawA: number | null;
  rawB: number | null;
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
        not_out_percent: 40,
        balls_per_dismissal: 45,
        era_index: 1.8,
      };
    case 'Test':
      return {
        strike_rate: 85,
        boundary_percent: 65,
        not_out_percent: 40,
        balls_per_dismissal: 140,
        era_index: 1.6,
      };
    case 'ODI':
    default:
      return {
        strike_rate: 150,
        boundary_percent: 75,
        not_out_percent: 40,
        balls_per_dismissal: 90,
        era_index: 1.7,
      };
  }
}

function toScore(raw: number | null | undefined, max: number) {
  if (raw == null || Number.isNaN(raw)) return 0;
  return clamp((raw / max) * 100, 0, 100);
}

function extractProfile(profile: Career | null) {
  return {
    boundaryPercent: profile?.boundary_percent ?? null,
    strikeRate: profile?.strike_rate ?? null,
    notOutPercent: profile?.not_out_percent ?? null,
    ballsPerDismissal: profile?.balls_per_dismissal ?? null,
    eraIndex: profile?.era_index ?? null,
  };
}

export default function DuelRadar({
  format,
  labelA,
  labelB,
  profileA,
  profileB,
}: {
  format: Format;
  labelA: string;
  labelB: string;
  profileA: Career | null;
  profileB: Career | null;
}) {
  if (!profileA && !profileB) {
    return (
      <div className="h-[320px] flex items-center justify-center text-zinc-500 italic">
        No batting data for these players in {format}.
      </div>
    );
  }

  const maxes = maxesForFormat(format);
  const a = extractProfile(profileA);
  const b = extractProfile(profileB);

  const metrics: DuelRadarMetric[] = [
    {
      metric: 'Boundary %',
      scoreA: toScore(a.boundaryPercent, maxes.boundary_percent),
      scoreB: toScore(b.boundaryPercent, maxes.boundary_percent),
      rawA: a.boundaryPercent,
      rawB: b.boundaryPercent,
      unit: '%',
    },
    {
      metric: 'Strike Rate',
      scoreA: toScore(a.strikeRate, maxes.strike_rate),
      scoreB: toScore(b.strikeRate, maxes.strike_rate),
      rawA: a.strikeRate,
      rawB: b.strikeRate,
      unit: '',
    },
    {
      metric: 'Not-out %',
      scoreA: toScore(a.notOutPercent, maxes.not_out_percent),
      scoreB: toScore(b.notOutPercent, maxes.not_out_percent),
      rawA: a.notOutPercent,
      rawB: b.notOutPercent,
      unit: '%',
    },
    {
      metric: 'Balls / Dismissal',
      scoreA: toScore(a.ballsPerDismissal, maxes.balls_per_dismissal),
      scoreB: toScore(b.ballsPerDismissal, maxes.balls_per_dismissal),
      rawA: a.ballsPerDismissal,
      rawB: b.ballsPerDismissal,
      unit: '',
    },
    {
      metric: 'Era Index',
      scoreA: toScore(a.eraIndex, maxes.era_index),
      scoreB: toScore(b.eraIndex, maxes.era_index),
      rawA: a.eraIndex,
      rawB: b.eraIndex,
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
            formatter={(_value, _name, ctx) => {
              const rawA = ctx?.payload?.rawA;
              const rawB = ctx?.payload?.rawB;
              const unit = ctx?.payload?.unit ?? '';

              const fmt = (raw: number | null) => {
                if (raw == null) return '–';
                if (unit === '×') return `${Number(raw).toFixed(2)}×`;
                return `${Number(raw).toFixed(1)}${unit}`;
              };

              return [
                `${labelA}: ${fmt(rawA)}  |  ${labelB}: ${fmt(rawB)}`,
                ctx?.payload?.metric ?? '',
              ];
            }}
            labelFormatter={() => ''}
          />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-zinc-300">{value as string}</span>
            )}
          />
          <Radar
            name={labelA}
            dataKey="scoreA"
            stroke="#38bdf8"
            fill="#38bdf8"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar
            name={labelB}
            dataKey="scoreB"
            stroke="#f97316"
            fill="#f97316"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

