'use client';

import SeasonLines from '@/components/charts/SeasonLines';
import CareerComparison from '@/components/CareerComparison';
import { Card, Loading } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import { useCricketStatsList } from '@/hooks/useCricketStats';
import { PLAYER_COLORS } from '@/lib/colors';
import { BATTING_FACTORS } from '@/lib/factors';
import type { Career, EraYear } from '@/lib/types';

export default function BattingComparison() {
  const { scope, compared } = useApp();
  const ids = compared.map((p) => p.player_id);
  const careers = useCricketStatsList<Career[]>('career', ids, scope);
  const eras = useCricketStatsList<EraYear[]>('era', ids, scope);
  const series = compared.map((p, i) => ({
    id: p.player_id,
    name: p.unique_name,
    color: PLAYER_COLORS[p.slot],
    years: eras[i]?.data ?? [],
  }));

  return (
    <>
      <CareerComparison careers={careers} factors={BATTING_FACTORS} />
      {!eras.every((e) => !e.loading) ? (
        <Loading height="h-72" />
      ) : (
        series.some((s) => s.years.length > 0) && (
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
  );
}
