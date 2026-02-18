import { NextResponse } from 'next/server';
import clickhouse from '@/lib/clickhouse';

// 1. Define your SQL Logic in a central object
const QUERIES: Record<string, (params: URLSearchParams) => string> = {
  player: (p) => `
    SELECT * FROM cricket.player_stats 
    WHERE player_name = '${p.get('name')}' 
    LIMIT 1`,
  
    matchup: (p) => `
      SELECT 
          bowler,
          count() as balls,
          sum(runs_batter) as runs,
          countIf(wicket_type != '') as dismissals,
          round(sum(runs_batter) * 100 / count(), 2) as strike_rate
      FROM cricket.deliveries
      WHERE batter = '${p.get('name')}'
      GROUP BY bowler
      HAVING balls > 15
      ORDER BY dismissals DESC, strike_rate ASC
      LIMIT 5
    `,
  
    era: (p) => `
    SELECT 
        p.year,
        p.format,
        round(p.sr / e.avg_strike_rate, 2) as era_index
    FROM (
        SELECT 
            toYear(date) as year, 
            format, 
            sum(runs_batter) * 100 / count() as sr
        FROM cricket.deliveries
        WHERE batter = '${p.get('name')}'
        GROUP BY year, format
    ) AS p
    JOIN cricket.era_averages AS e ON p.year = e.year AND p.format = e.format
    ORDER BY year ASC
  `,

  career: (p) => `
    SELECT 
        player_name,
        format,
        sum(innings_played) as innings,
        sum(runs_scored) as runs,
        round(sum(runs_scored) / IF(sum(outs) = 0, 1, sum(outs)), 2) as average,
        round(sum(runs_scored) * 100 / IF(sum(balls_faced) = 0, 1, sum(balls_faced)), 2) as strike_rate,
        sum(fours) as fours,
        sum(sixes) as sixes
    FROM cricket.player_career_stats
    WHERE player_name = '${p.get('name')}'
    GROUP BY player_name, format
  `,
  player_full_profile: (p) => `
    SELECT 
        player_name,
        format,
        round(sum(runs_scored) / IF(sum(outs) = 0, 1, sum(outs)), 2) as average,
        round(sum(runs_scored) * 100 / sum(balls_faced), 2) as strike_rate,
        round(sum(fours * 4 + sixes * 6) * 100 / sum(runs_scored), 1) as boundary_percent,
        round(sum(balls_faced) / IF(sum(outs) = 0, 1, sum(outs)), 1) as balls_per_dismissal,
        round((1 - (sum(outs) / sum(innings_played))) * 100, 1) as survival_rate
    FROM cricket.player_career_stats
    WHERE player_name = '${p.get('name')}'
    GROUP BY player_name, format
  `
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const searchParams = new URL(request.url).searchParams;

  if (!QUERIES[type]) return NextResponse.json({ error: 'Invalid type' }, { status: 404 });

  try {
    const query = QUERIES[type](searchParams);
    const resultSet = await clickhouse.query({ query, format: 'JSONEachRow' });
    const data = await resultSet.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}