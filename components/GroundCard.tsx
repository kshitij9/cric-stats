import { AlertTriangle } from 'lucide-react';
import { Card, Empty, ErrorNote, Loading, Segmented } from '@/components/ui';
import type { Loaded } from '@/hooks/useJson';
import { FEW_INNINGS, type GroundProfile, type SeasonChoice } from '@/lib/matchup-types';

const PHASES = {
  powerplay: { label: 'Powerplay', overs: 'overs 1–6' },
  middle: { label: 'Middle', overs: 'overs 7–15' },
  death: { label: 'Death', overs: 'overs 16–20' },
};

const show = (value: number | null | undefined, dp: number, suffix = '') =>
  value === null || value === undefined ? '–' : `${value.toFixed(dp)}${suffix}`;

/** A figure for this ground, with the same figure elsewhere under it. */
function Versus({
  here,
  elsewhere,
  dp,
  suffix,
  large,
}: {
  here: number | null | undefined;
  elsewhere: number | null | undefined;
  dp: number;
  suffix?: string;
  large?: boolean;
}) {
  return (
    <>
      <span className={`block font-bold tabular-nums ${large ? 'text-3xl' : 'text-base'}`}>
        {show(here, dp, suffix)}
      </span>
      <span className="block text-[11px] tabular-nums text-zinc-500">
        elsewhere {show(elsewhere, dp, suffix)}
      </span>
    </>
  );
}

/** How the chosen ground plays. */
export default function GroundCard({
  profile,
  choice,
  onChoice,
}: {
  profile: Loaded<GroundProfile>;
  choice: SeasonChoice;
  onChoice: (choice: SeasonChoice) => void;
}) {
  const { data, error } = profile;
  const here = data?.here;
  const elsewhere = data?.elsewhere;

  return (
    <Card
      title={data ? `How ${data.venue.name} plays` : 'How the ground plays'}
      hint={
        data &&
        (data.seasons.from === data.seasons.to
          ? `IPL ${data.seasons.to}.`
          : `IPL ${data.seasons.from} to ${data.seasons.to}.`) +
          ' “Elsewhere” is every other ground in the same seasons.'
      }
      actions={
        <Segmented<SeasonChoice>
          label="Seasons"
          hideLabel
          options={[
            { value: 'recent', label: 'Last 4 seasons' },
            { value: 'all', label: 'All seasons' },
          ]}
          value={choice}
          onChange={(v) => v && onChoice(v)}
        />
      }
    >
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !data ? (
        <Loading />
      ) : !here ? (
        <Empty>
          No first innings here ran its course in these seasons.
          {data.seasons.choice === 'recent' && ' Try all seasons.'}
        </Empty>
      ) : (
        <>
          {data.innings < FEW_INNINGS && (
            <p className="flex items-start gap-2 text-sm text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              Only {data.innings} innings to go on. Treat these
              figures with care.
            </p>
          )}
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <dt className="text-xs text-zinc-400">Average first-innings score</dt>
              <dd>
                <Versus large here={here.score} elsewhere={elsewhere?.score} dp={1} />
                <span className="mt-2 block text-[11px] text-zinc-500">
                  From {data.innings} innings, lowest {data.lowest}, highest {data.highest}
                </span>
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <dt className="text-xs text-zinc-400">Matches won by the side batting first</dt>
              <dd>
                <Versus
                  large
                  here={here.bat_first_win_percent}
                  elsewhere={elsewhere?.bat_first_win_percent}
                  dp={0}
                  suffix="%"
                />
                <span className="mt-2 block text-[11px] text-zinc-500">
                  {data.bat_first_wins} of {data.decided} with a winner
                </span>
              </dd>
            </div>
          </dl>

          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="pb-1 text-left text-xs text-zinc-400">
                The average first innings, phase by phase
              </caption>
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="py-2 pr-2 text-left font-semibold">Phase</th>
                  <th className="px-2 py-2 text-right font-semibold">Runs</th>
                  <th className="px-2 py-2 text-right font-semibold">Wickets</th>
                  <th className="py-2 pl-2 text-right font-semibold">Runs per over</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {here.phases.map((p, i) => {
                  const other = elsewhere?.phases[i];
                  return (
                    <tr key={p.phase}>
                      <th scope="row" className="py-2.5 pr-2 text-left">
                        {PHASES[p.phase].label}
                        <span className="block text-[11px] font-normal text-zinc-500">
                          {PHASES[p.phase].overs}
                        </span>
                      </th>
                      <td className="px-2 py-2.5 text-right">
                        <Versus here={p.runs} elsewhere={other?.runs} dp={1} />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <Versus here={p.wickets} elsewhere={other?.wickets} dp={2} />
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <Versus here={p.run_rate} elsewhere={other?.run_rate} dp={2} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            Scores count first innings of 20 overs, or all out, so rain-shortened ones are left out.
            A ground&rsquo;s figures also reflect the side that plays there most.
          </p>
        </>
      )}
    </Card>
  );
}
