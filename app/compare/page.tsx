'use client';

import { Scale, X } from 'lucide-react';
import { useState } from 'react';
import MetricBars from '@/components/charts/MetricBars';
import SeasonLines from '@/components/charts/SeasonLines';
import ComparisonTable from '@/components/ComparisonTable';
import PlayerSearch from '@/components/PlayerSearch';
import { Card, Empty, Loading, PageHeader } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import { useCricketStatsList } from '@/hooks/useCricketStats';
import { MAX_COMPARE, PLAYER_COLORS } from '@/lib/colors';
import { DEFAULT_FACTORS, FACTORS } from '@/lib/factors';
import { scopeName } from '@/lib/scope';
import type { Career, EraYear } from '@/lib/types';

export default function ComparePage() {
  const { scope, compared, addCompared, removeCompared } = useApp();
  const [chosen, setChosen] = useState<string[]>(DEFAULT_FACTORS);
  const ids = compared.map((p) => p.player_id);
  const careers = useCricketStatsList<Career[]>('career', ids, scope);
  const eras = useCricketStatsList<EraYear[]>('era', ids, scope);
  const factors = FACTORS.filter((f) => chosen.includes(f.key));
  const label = scopeName(scope);

  const withData = compared.flatMap((p, i) => {
    const career = careers[i]?.data?.[0];
    return career
      ? [{ id: p.player_id, name: p.unique_name, color: PLAYER_COLORS[p.slot], career }]
      : [];
  });
  const series = compared.map((p, i) => ({
    id: p.player_id,
    name: p.unique_name,
    color: PLAYER_COLORS[p.slot],
    years: eras[i]?.data ?? [],
  }));
  const seasonsReady = eras.every((e) => !e.loading);
  const hasSeasons = series.some((s) => s.years.length > 0);

  const toggle = (key: string) =>
    setChosen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <>
      <PageHeader icon={Scale} title="Compare">
        Put up to {MAX_COMPARE} batters side by side. Choose the figures that matter to you; the best
        in each is marked.
      </PageHeader>

      <Card title="Players">
        <ul className="flex flex-wrap gap-2">
          {compared.map((p) => (
            <li
              key={p.player_id}
              className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 py-1.5 pl-3 pr-1.5 text-sm font-semibold"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: PLAYER_COLORS[p.slot] }}
              />
              {p.unique_name}
              <button
                type="button"
                aria-label={`Remove ${p.unique_name}`}
                onClick={() => removeCompared(p.player_id)}
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        {compared.length < MAX_COMPARE ? (
          <div className="max-w-md">
            <PlayerSearch
              label="Add a player"
              selected={null}
              onSelect={(p) => p && addCompared(p)}
            />
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            That is the most that can be compared. Remove one to add another.
          </p>
        )}
      </Card>

      {compared.length === 0 ? (
        <Empty>Add a player to start comparing.</Empty>
      ) : (
        <>
          <Card title="Figures to show">
            <div className="flex flex-wrap gap-2">
              {FACTORS.map((f) => (
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
              <button type="button" onClick={() => setChosen(FACTORS.map((f) => f.key))}>
                Show all
              </button>
              <button type="button" onClick={() => setChosen(DEFAULT_FACTORS)}>
                Reset
              </button>
            </div>
          </Card>

          {factors.length === 0 ? (
            <Empty>Choose at least one figure above.</Empty>
          ) : (
            <>
              <Card title={`${label} career batting`}>
                <ComparisonTable
                  players={compared}
                  careers={careers}
                  factors={factors}
                  scopeLabel={label}
                />
              </Card>
              {withData.length > 1 && (
                <Card title="Side by side" hint="Each figure has its own scale, starting at zero.">
                  <MetricBars players={withData} factors={factors} />
                </Card>
              )}
            </>
          )}

          {!seasonsReady ? (
            <Loading height="h-72" />
          ) : (
            hasSeasons && (
              <div className="grid gap-6">
                <Card title="Runs by season">
                  <SeasonLines metric="runs" series={series} />
                </Card>
                <Card
                  title="Era index by season"
                  hint="Scoring speed against the average batter that year. The grey line, 1.00, is average. A season with only a few balls can swing widely."
                >
                  <SeasonLines metric="era_index" series={series} />
                </Card>
              </div>
            )
          )}
        </>
      )}
    </>
  );
}
