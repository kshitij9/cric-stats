'use client';

import { useState } from 'react';
import MetricBars from '@/components/charts/MetricBars';
import ComparisonTable from '@/components/ComparisonTable';
import { Card, Empty } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import type { Loaded } from '@/hooks/useJson';
import { PLAYER_COLORS } from '@/lib/colors';
import { DEFAULT_FACTORS, type Factor } from '@/lib/factors';
import { scopeName } from '@/lib/scope';

/**
 * The compared players' careers, batting or bowling: a choice of figures, then a
 * table and bars of those chosen. `careers` is in the order of the players.
 */
export default function CareerComparison<T extends { may_be_incomplete: boolean }>({
  careers,
  factors,
}: {
  careers: Loaded<T[]>[];
  factors: Factor<T>[];
}) {
  const { scope, discipline, compared } = useApp();
  // batting and bowling are separate components, so each starts from its own defaults
  const [chosen, setChosen] = useState<string[]>(DEFAULT_FACTORS[discipline]);
  const shown = factors.filter((f) => chosen.includes(f.key));
  const label = scopeName(scope);

  const withData = compared.flatMap((p, i) => {
    const career = careers[i]?.data?.[0];
    return career
      ? [{ id: p.player_id, name: p.unique_name, color: PLAYER_COLORS[p.slot], career }]
      : [];
  });

  const toggle = (key: string) =>
    setChosen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <>
      <Card title="Figures to show">
        <div className="flex flex-wrap gap-2">
          {factors.map((f) => (
            <button
              key={f.key}
              type="button"
              title={f.help}
              aria-pressed={chosen.includes(f.key)}
              onClick={() => toggle(f.key)}
              className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-sky-500 aria-pressed:border-sky-500 aria-pressed:bg-sky-500/15 aria-pressed:text-sky-200"
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-4 text-xs font-semibold text-sky-400">
          <button type="button" onClick={() => setChosen(factors.map((f) => f.key))}>
            Show all
          </button>
          <button type="button" onClick={() => setChosen(DEFAULT_FACTORS[discipline])}>
            Reset
          </button>
        </div>
      </Card>

      {shown.length === 0 ? (
        <Empty>Choose at least one figure above.</Empty>
      ) : (
        <>
          <Card title={`${label} career ${discipline}`}>
            <ComparisonTable
              players={compared}
              careers={careers}
              factors={shown}
              noData={`No ${label} ${discipline} data`}
            />
          </Card>
          {withData.length > 1 && (
            <Card title="Side by side" hint="Each figure has its own scale, starting at zero.">
              <MetricBars players={withData} factors={shown} />
            </Card>
          )}
        </>
      )}
    </>
  );
}
