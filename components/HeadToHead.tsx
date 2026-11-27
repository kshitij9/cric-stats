'use client';

import { useState } from 'react';
import FactTable from '@/components/FactTable';
import { Card, Empty, SECONDARY } from '@/components/ui';
import { FEW_PAIR_BALLS, type Pair, type Side } from '@/lib/matchup-types';

const FIRST = 8; // pairs shown before asking for the rest

function Direction({ batting, bowling, pairs }: { batting: Side; bowling: Side; pairs: Pair[] }) {
  const [all, setAll] = useState(false);
  const names = new Map(
    [...batting.players, ...bowling.players].map((p) => [p.player_id, p.unique_name]),
  );
  const enough = pairs.filter((p) => p.balls >= FEW_PAIR_BALLS).length;

  return (
    <div className="min-w-0 space-y-3">
      <h3 className="break-words font-semibold">
        <span className="text-sky-300">{batting.name}</span> batting against{' '}
        <span className="text-sky-300">{bowling.name}</span>
      </h3>
      {pairs.length === 0 ? (
        <Empty>None of these batters has faced any of these bowlers in the IPL.</Empty>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            {pairs.length} {pairs.length === 1 ? 'pair has' : 'pairs have'} met, {enough} over{' '}
            {FEW_PAIR_BALLS} balls or more. Longest first.
          </p>
          <FactTable
            first="Batter v bowler"
            columns={[
              { label: 'Balls' },
              { label: 'Runs' },
              { label: 'Outs', help: 'Times this bowler got this batter out' },
              { label: 'SR', help: 'Strike rate' },
            ]}
            rows={(all ? pairs : pairs.slice(0, FIRST)).map((p) => ({
              key: `${p.batter_id} ${p.bowler_id}`,
              name: (
                <>
                  {names.get(p.batter_id)}
                  <span
                    className={`block text-xs font-normal ${p.balls < FEW_PAIR_BALLS ? '' : 'text-zinc-400'}`}
                  >
                    v {names.get(p.bowler_id)}
                  </span>
                </>
              ),
              thin: p.balls < FEW_PAIR_BALLS,
              cells: [p.balls, p.runs, p.dismissals, p.strike_rate ?? '–'],
            }))}
          />
          {pairs.length > FIRST && (
            <button type="button" className={SECONDARY} onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show all ${pairs.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Who among the two teams has met whom. */
export default function HeadToHead({
  sides: [a, b],
  pairs,
}: {
  sides: [Side, Side];
  pairs: [Pair[], Pair[]];
}) {
  return (
    <Card
      title="Head to head"
      hint={`Every IPL season and ground. Rows under ${FEW_PAIR_BALLS} balls are faint, and even the longer ones are small samples.`}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Direction key={`${a.team_id}-${b.team_id}`} batting={a} bowling={b} pairs={pairs[0]} />
        <Direction key={`${b.team_id}-${a.team_id}`} batting={b} bowling={a} pairs={pairs[1]} />
      </div>
    </Card>
  );
}
