'use client';

import { ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Card, ErrorNote, Loading, Segmented } from '@/components/ui';
import type { Loaded } from '@/hooks/useJson';
import { TEAM_COLORS } from '@/lib/colors';
import {
  BATTING_MEASURES,
  BOWLING_MEASURES,
  FEW_TEAM_BALLS,
  leader,
  type FaceOff as Data,
  type Measure,
  type PhaseKey,
  type TeamFigures,
} from '@/lib/faceoff-types';

const PHASES: { value: PhaseKey; label: string }[] = [
  { value: 'all', label: 'All overs' },
  { value: 'powerplay', label: 'Powerplay' },
  { value: 'middle', label: 'Middle' },
  { value: 'death', label: 'Death' },
];

const show = (measure: Measure, value: number | null) =>
  value === null ? '–' : `${value.toFixed(measure.dp)}${measure.suffix ?? ''}`;

const balls = (n: number) => `${n.toLocaleString('en-GB')} ${n === 1 ? 'ball' : 'balls'}`;

/** Two bars back to back, one a side, on a scale that starts at nothing. */
function Bars({
  where,
  measure,
  names,
  sides,
}: {
  where: string;
  measure: Measure;
  names: [string, string];
  sides: [TeamFigures, TeamFigures];
}) {
  const ahead = leader(measure, sides[0], sides[1]);
  const read = sides.map((s) => measure.of(s));
  const top = Math.max(read[0].value ?? 0, read[1].value ?? 0);
  const thin = read.some((r) => r.balls < FEW_TEAM_BALLS);

  const figure = (i: 0 | 1) => (
    <div className={`min-w-0 ${i === 0 ? 'text-right' : 'text-left'}`}>
      <p
        data-side={i}
        data-leader={ahead === i || undefined}
        className={`flex items-center gap-0.5 text-sm tabular-nums ${
          i === 0 ? 'justify-end' : ''
        } ${ahead === i ? 'font-bold text-zinc-50' : 'text-zinc-400'}`}
      >
        {ahead === i && <ChevronUp size={14} strokeWidth={3} aria-hidden />}
        {show(measure, read[i].value)}
        {ahead === i && <span className="sr-only">, ahead</span>}
      </p>
      <p className="text-[10px] tabular-nums text-zinc-500">{balls(read[i].balls)}</p>
    </div>
  );
  const bar = (i: 0 | 1) => {
    const value = read[i].value;
    return (
      <span
        className={`flex h-3 ${i === 0 ? 'justify-end' : ''}`}
        title={`${names[i]}, ${where.toLowerCase()}: ${show(measure, value)} from ${balls(read[i].balls)}`}
      >
        <span
          className={`block h-full ${i === 0 ? 'rounded-l' : 'rounded-r'}`}
          style={{
            width: top > 0 && value !== null ? `${(value / top) * 100}%` : 0,
            background: TEAM_COLORS[i],
          }}
        />
      </span>
    );
  };

  return (
    <div data-where={where} data-thin={thin || undefined}>
      <p className="mb-0.5 text-center text-[11px] text-zinc-500">
        {where}
        {thin && ': too few balls to compare'}
      </p>
      <div
        className={`grid grid-cols-[4.5rem_1fr_1fr_4.5rem] items-center gap-x-0.5 ${thin ? 'opacity-50' : ''}`}
      >
        <div className="pr-1.5">{figure(0)}</div>
        {bar(0)}
        {bar(1)}
        <div className="pl-1.5">{figure(1)}</div>
      </div>
    </div>
  );
}

function Table({ data, phase, ground }: { data: Data; phase: PhaseKey; ground: string | null }) {
  const scopes = [
    { label: 'all grounds', of: (i: 0 | 1) => data.sides[i].all[phase] },
    ...(ground ? [{ label: ground, of: (i: 0 | 1) => data.sides[i].ground![phase] }] : []),
  ];
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-sky-400">Show these figures as a table</summary>
      <div className="relative overflow-x-auto">
        <table className="mt-3 w-full text-xs tabular-nums">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-1.5 pr-3 text-left font-semibold">Figure</th>
              {scopes.flatMap((s) =>
                data.teams.map((t) => (
                  <th key={`${s.label} ${t.team_id}`} className="px-2 py-1.5 text-right font-semibold">
                    {t.name}, {s.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {[...BATTING_MEASURES, ...BOWLING_MEASURES].map((m) => (
              <tr key={m.key} className="border-b border-zinc-900">
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold">
                  {m.label}
                </th>
                {scopes.flatMap((s) =>
                  ([0, 1] as const).map((i) => (
                    <td key={`${s.label} ${i}`} className="px-2 py-1.5 text-right">
                      {show(m, m.of(s.of(i)).value)}
                    </td>
                  )),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** The two sides' players, batting and bowling, side against side. */
export default function FaceOff({ faceOff }: { faceOff: Loaded<Data> }) {
  const [phase, setPhase] = useState<PhaseKey>('all');
  const { data, error } = faceOff;
  const ground = data?.venue?.name ?? null;

  return (
    <Card
      title="Team v team"
      hint={
        data &&
        `Each side’s present players added together, IPL ${
          data.seasons.from === data.seasons.to
            ? data.seasons.to
            : `${data.seasons.from} to ${data.seasons.to}`
        }, whoever they played for then. This is what has happened, not a prediction.`
      }
      actions={
        <Segmented<PhaseKey>
          label="Overs"
          hideLabel
          options={PHASES}
          value={phase}
          onChange={(v) => v && setPhase(v)}
        />
      }
    >
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 text-sm font-semibold" aria-label="Teams">
            {data.teams.map((t, i) => (
              <li
                key={t.team_id}
                className={`flex min-w-0 items-center gap-2 ${i === 0 ? 'justify-end text-right' : 'flex-row-reverse justify-end'}`}
              >
                <span className="min-w-0 break-words">{t.name}</span>
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-sm"
                  style={{ background: TEAM_COLORS[i] }}
                />
              </li>
            ))}
          </ul>
          <div className="grid gap-8 lg:grid-cols-2">
            {[
              { title: 'Batting', measures: BATTING_MEASURES },
              { title: 'Bowling', measures: BOWLING_MEASURES },
            ].map(({ title, measures }) => (
              <div key={title} className="min-w-0 space-y-5">
                <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
                {measures.map((m) => (
                  <figure key={m.key} data-measure={m.key} className="space-y-1.5">
                    <figcaption className="text-center">
                      <span className="text-sm font-semibold">{m.label}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {m.better === 'higher' ? 'higher is better' : 'lower is better'}
                      </span>
                    </figcaption>
                    <Bars
                      where="All grounds"
                      measure={m}
                      names={[data.teams[0].name, data.teams[1].name]}
                      sides={[data.sides[0].all[phase], data.sides[1].all[phase]]}
                    />
                    {ground && (
                      <Bars
                        where="At this ground"
                        measure={m}
                        names={[data.teams[0].name, data.teams[1].name]}
                        sides={[data.sides[0].ground![phase], data.sides[1].ground![phase]]}
                      />
                    )}
                  </figure>
                ))}
              </div>
            ))}
          </div>
          <Table data={data} phase={phase} ground={ground} />
          <p className="text-xs leading-relaxed text-zinc-500">
            <ChevronUp size={12} strokeWidth={3} className="inline" aria-hidden /> marks the side
            ahead, where both have {FEW_TEAM_BALLS} balls or more. Players who have played more count
            for more. {ground && `“This ground” is ${ground}.`}
          </p>
        </>
      )}
    </Card>
  );
}
