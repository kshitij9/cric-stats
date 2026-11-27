'use client';

import SeasonLines from '@/components/charts/SeasonLines';
import CareerComparison from '@/components/CareerComparison';
import { Card, Loading } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import { useCricketStatsList } from '@/hooks/useCricketStats';
import { PLAYER_COLORS } from '@/lib/colors';
import { BOWLING_FACTORS } from '@/lib/factors';
import type { BowlingCareer, BowlingYear } from '@/lib/types';

export default function BowlingComparison() {
  const { scope, compared } = useApp();
  const ids = compared.map((p) => p.player_id);
  const careers = useCricketStatsList<BowlingCareer[]>('bowling', ids, scope);
  const seasons = useCricketStatsList<BowlingYear[]>('bowling_seasons', ids, scope);
  const series = compared.map((p, i) => ({
    id: p.player_id,
    name: p.unique_name,
    color: PLAYER_COLORS[p.slot],
    years: seasons[i]?.data ?? [],
  }));

  return (
    <>
      <CareerComparison careers={careers} factors={BOWLING_FACTORS} />
      {!seasons.every((s) => !s.loading) ? (
        <Loading height="h-72" />
      ) : (
        series.some((s) => s.years.length > 0) && (
          <div className="grid gap-6">
            <Card title="Wickets by season">
              <SeasonLines metric="wickets" series={series} />
            </Card>
            <Card
              title="Economy by season"
              hint="Runs conceded per over; lower is better. A season with only a few balls can swing widely."
            >
              <SeasonLines metric="economy" series={series} />
            </Card>
          </div>
        )
      )}
    </>
  );
}
