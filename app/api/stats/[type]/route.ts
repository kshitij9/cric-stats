import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// 1. Define your SQL Logic in a central object
const QUERIES: Record<string, (params: URLSearchParams) => { query: string; values: any[] }> = {
  player: (p) => ({
    query: `
      SELECT * FROM player_stats
      WHERE player_name = $1
      LIMIT 1`,
    values: [p.get('name')],
  }),

  matchup: (p) => ({
    query: `
      SELECT
          bowler,
          COUNT(*) AS balls,
          SUM(runs_batter) AS runs,
          COUNT(*) FILTER (WHERE wicket_type != '') AS dismissals,
          ROUND((SUM(runs_batter)::numeric * 100 / NULLIF(COUNT(*), 0)), 2) AS strike_rate
      FROM deliveries
      WHERE batter = $1
      GROUP BY bowler
      HAVING COUNT(*) > 15
      ORDER BY dismissals DESC, strike_rate ASC
      LIMIT 5
    `,
    values: [p.get('name')],
  }),

  era: (p) => ({
    query: `
      SELECT
          p.year,
          p.format,
          ROUND((p.sr / e.avg_strike_rate)::numeric, 2) AS era_index
      FROM (
          SELECT
              EXTRACT(YEAR FROM date)::int AS year,
              format,
              (SUM(runs_batter)::numeric * 100 / NULLIF(COUNT(*), 0)) AS sr
          FROM deliveries
          WHERE batter = $1
          GROUP BY year, format
      ) AS p
      JOIN era_averages AS e ON p.year = e.year AND p.format = e.format
      ORDER BY year ASC
    `,
    values: [p.get('name')],
  }),

  career: (p) => ({
    query: `
      SELECT
          player_name,
          format,
          SUM(innings_played) AS innings,
          SUM(runs_scored) AS runs,
          ROUND(SUM(runs_scored)::numeric / NULLIF(SUM(outs), 0), 2) AS average,
          ROUND(SUM(runs_scored)::numeric * 100 / NULLIF(SUM(balls_faced), 0), 2) AS strike_rate,
          SUM(fours) AS fours,
          SUM(sixes) AS sixes
      FROM player_career_stats
      WHERE player_name = $1
      GROUP BY player_name, format
    `,
    values: [p.get('name')],
  }),

  player_full_profile: (p) => ({
    query: `
      SELECT
          player_name,
          format,
          ROUND(SUM(runs_scored)::numeric / NULLIF(SUM(outs), 0), 2) AS average,
          ROUND(SUM(runs_scored)::numeric * 100 / NULLIF(SUM(balls_faced), 0), 2) AS strike_rate,
          ROUND(SUM(fours * 4 + sixes * 6)::numeric * 100 / NULLIF(SUM(runs_scored), 0), 1) AS boundary_percent,
          ROUND(SUM(balls_faced)::numeric / NULLIF(SUM(outs), 0), 1) AS balls_per_dismissal,
          ROUND((1 - (SUM(outs)::numeric / NULLIF(SUM(innings_played), 0))) * 100, 1) AS survival_rate
      FROM player_career_stats
      WHERE player_name = $1
      GROUP BY player_name, format
    `,
    values: [p.get('name')],
  }),
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const searchParams = new URL(request.url).searchParams;

  if (!QUERIES[type]) return NextResponse.json({ error: 'Invalid type' }, { status: 404 });

  try {
    const { query: sql, values } = QUERIES[type](searchParams);
    const data = await query(sql, values);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
