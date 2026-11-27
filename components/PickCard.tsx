import IncompleteMark from '@/components/IncompleteMark';

export type Role = 'batter' | 'bowler';

export type FactorDetail = {
  sample_balls: number;
  sample_events: number;
  observed: number;
  rate_factor: number;
  event_factor: number;
};

export const SITUATIONS = ['venue', 'matchup', 'opposition', 'phase', 'innings'] as const;

export type Ranked = {
  player_id: string;
  player: string;
  unique_name: string;
  data_available: true;
  rank: number;
  may_be_incomplete: boolean;
  predicted: Record<string, number>;
  baseline: Record<string, number | null>;
  factors: Partial<Record<(typeof SITUATIONS)[number], FactorDetail>>;
  missing_context: string[];
  sample_balls: number;
  confidence: 'none' | 'low' | 'medium' | 'high';
};

/** What each role is ranked on, and which way round is good. */
export const VIEW = {
  batter: {
    headline: { key: 'expected_runs_per_dismissal', label: 'Runs per dismissal' },
    others: [
      { key: 'strike_rate', label: 'Strike rate' },
      { key: 'balls_per_dismissal', label: 'Balls per dismissal' },
    ],
    higherIsBetter: true,
    rate: { label: 'Scoring rate', goodWhen: 'up' as const },
    event: { label: 'Staying in', goodWhen: 'up' as const },
    wicket: 'out',
  },
  bowler: {
    headline: { key: 'expected_runs_per_wicket', label: 'Runs per wicket' },
    others: [
      { key: 'economy', label: 'Economy' },
      { key: 'strike_rate', label: 'Balls per wicket' },
    ],
    higherIsBetter: false,
    rate: { label: 'Economy', goodWhen: 'down' as const },
    event: { label: 'Wickets', goodWhen: 'up' as const },
    wicket: 'wickets',
  },
};

const CONFIDENCE: Record<Ranked['confidence'], string> = {
  high: 'border-emerald-500/60 text-emerald-300',
  medium: 'border-sky-500/60 text-sky-300',
  low: 'border-amber-500/60 text-amber-300',
  none: 'border-zinc-700 text-zinc-400',
};

const NAMES: Record<(typeof SITUATIONS)[number], string> = {
  venue: 'At this ground',
  matchup: 'Against this player',
  opposition: 'Against this team',
  phase: 'In this phase',
  innings: 'In this innings',
};

/** One player in the ranking: projected figures and what moved them. */
export default function PickCard({
  p,
  role,
  best,
}: {
  p: Ranked;
  role: Role;
  best: number; // the leader's headline figure, for the bar
}) {
  const view = VIEW[role];
  const headline = p.predicted[view.headline.key];
  const share = best > 0 ? (view.higherIsBetter ? headline / best : best / headline) : 0;
  const top = p.rank === 1;
  const used = SITUATIONS.filter((k) => p.factors[k]);

  return (
    <li
      className={`rounded-2xl border p-4 ${top ? 'border-sky-500 bg-sky-500/10' : 'border-zinc-800 bg-zinc-900'}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${top ? 'bg-sky-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}
        >
          {p.rank}
        </span>
        <h3 className="mr-auto text-lg font-bold">
          {p.unique_name}
          <IncompleteMark show={p.may_be_incomplete} />
        </h3>
        <span
          title="How much evidence there is for this situation"
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${CONFIDENCE[p.confidence]}`}
        >
          {p.confidence} confidence · {p.sample_balls} balls
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3">
        {[view.headline, ...view.others].map((figure, i) => (
          <div key={figure.key}>
            <dt className="text-[11px] text-zinc-500">{figure.label}</dt>
            <dd className={`font-bold tabular-nums ${i === 0 ? 'text-2xl text-sky-300' : 'text-xl'}`}>
              {p.predicted[figure.key]}
            </dd>
            {p.baseline[figure.key] != null && (
              <dd className="text-[11px] text-zinc-500">usually {p.baseline[figure.key]}</dd>
            )}
          </div>
        ))}
      </dl>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
        <div
          className={`h-full ${top ? 'bg-sky-400' : 'bg-zinc-500'}`}
          style={{ width: `${Math.max(4, Math.min(100, share * 100))}%` }}
        />
      </div>

      {used.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {used.map((k) => {
            const f = p.factors[k]!;
            return (
              <li key={k} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-[11px]">
                <p className="font-semibold text-zinc-300">
                  {NAMES[k]}
                  <span className="font-normal text-zinc-500">
                    {' '}· {f.sample_balls} balls, {f.sample_events} {view.wicket}
                  </span>
                </p>
                <p className="mt-1 flex gap-3">
                  <Change factor={f.rate_factor} {...view.rate} />
                  <Change factor={f.event_factor} {...view.event} />
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/** How much a situation moved a figure; the arrow and word carry it, not only colour. */
function Change({ label, factor, goodWhen }: { label: string; factor: number; goodWhen: 'up' | 'down' }) {
  const percent = Math.round((factor - 1) * 100);
  const good = goodWhen === 'up' ? percent > 0 : percent < 0;
  const color = percent === 0 ? 'text-zinc-500' : good ? 'text-emerald-400' : 'text-red-400';
  return (
    <span className="tabular-nums">
      <span className="text-zinc-500">{label} </span>
      <span className={color}>
        {percent > 0 ? '▲ +' : percent < 0 ? '▼ ' : ''}
        {percent}%
      </span>
    </span>
  );
}
