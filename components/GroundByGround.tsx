'use client';

import { ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Card, Segmented } from '@/components/ui';
import { TEAM_COLORS } from '@/lib/colors';
import {
  BATTING_MEASURES,
  BOWLING_MEASURES,
  FEW_TEAM_BALLS,
  leader,
  type FaceOff,
} from '@/lib/faceoff-types';

type Choice = 'strike_rate' | 'economy';

const MEASURES = {
  strike_rate: BATTING_MEASURES.find((m) => m.key === 'strike_rate')!,
  economy: BOWLING_MEASURES.find((m) => m.key === 'economy')!,
};

/** The same two sides at one ground after another. */
export default function GroundByGround({
  data,
  onGround,
}: {
  data: FaceOff;
  onGround: (venueId: string) => void;
}) {
  const [choice, setChoice] = useState<Choice>('strike_rate');
  const measure = MEASURES[choice];
  const { from, to } = data.seasons;

  return (
    <Card
      title="Ground by ground"
      hint={`Each side’s present players at the grounds of the latest season, IPL ${
        from === to ? to : `${from} to ${to}`
      }. Choose a ground to see it in full.`}
      actions={
        <Segmented<Choice>
          label="Figure compared"
          hideLabel
          options={[
            { value: 'strike_rate', label: 'Batting strike rate' },
            { value: 'economy', label: 'Bowling economy' },
          ]}
          value={choice}
          onChange={(v) => v && setChoice(v)}
        />
      }
    >
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-400">
            <th className="py-2 pr-2 text-left font-semibold">
              Ground
              <span className="block font-normal text-zinc-500">{measure.better} is better</span>
            </th>
            {data.teams.map((t, i) => (
              <th key={t.team_id} className="w-1/4 px-1 py-2 text-right font-semibold sm:px-3">
                <span
                  aria-hidden
                  className="mr-1 inline-block size-2.5 rounded-sm"
                  style={{ background: TEAM_COLORS[i] }}
                />
                {t.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 tabular-nums">
          {data.grounds.map((g) => {
            const chosen = g.venue_id === data.venue?.venue_id;
            const ahead = leader(measure, g.sides[0], g.sides[1]);
            return (
              <tr key={g.venue_id} data-ground={g.venue_id} className={chosen ? 'bg-sky-500/10' : ''}>
                <th scope="row" className="py-1.5 pr-2 text-left">
                  <button
                    type="button"
                    aria-current={chosen || undefined}
                    onClick={() => onGround(g.venue_id)}
                    className="rounded text-left font-semibold underline-offset-2 hover:text-sky-300 hover:underline focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    {g.name}
                  </button>
                </th>
                {([0, 1] as const).map((i) => {
                  const { value, balls } = measure.of(g.sides[i]);
                  const thin = balls < FEW_TEAM_BALLS;
                  return (
                    <td
                      key={i}
                      data-side={i}
                      data-leader={ahead === i || undefined}
                      data-thin={thin || undefined}
                      className={`px-1 py-1.5 text-right sm:px-3 ${thin ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`flex items-center justify-end gap-0.5 ${
                          ahead === i ? 'font-bold text-zinc-50' : 'text-zinc-400'
                        }`}
                      >
                        {ahead === i && <ChevronUp size={14} strokeWidth={3} aria-hidden />}
                        {value === null ? '–' : value.toFixed(measure.dp)}
                        {ahead === i && <span className="sr-only">, ahead</span>}
                      </span>
                      <span className="block text-[10px] text-zinc-500">
                        {balls.toLocaleString('en-GB')} {balls === 1 ? 'ball' : 'balls'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs leading-relaxed text-zinc-500">
        Marked only where both sides have {FEW_TEAM_BALLS} balls or more; fewer are faint.
      </p>
    </Card>
  );
}
