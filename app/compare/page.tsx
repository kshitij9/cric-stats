'use client';
import { useState } from 'react';
import { useCricketStats } from '@/hooks/useCricketStats';
import NavTabs from '@/components/NavTabs';
import { BarChart3 } from 'lucide-react';

export default function ComparePage() {
  const [format, setFormat] = useState<string>('ODI');
  const [p1, setP1] = useState('V Kohli');
  const [p2, setP2] = useState('RG Sharma');
  const [p3, setP3] = useState('KS Williamson');
  const [p4, setP4] = useState('SPD Smith');

  const { data: c1 } = useCricketStats('career', p1);
  const { data: c2 } = useCricketStats('career', p2);
  const { data: c3 } = useCricketStats('career', p3);
  const { data: c4 } = useCricketStats('career', p4);

  const { data: e1 } = useCricketStats('era', p1);
  const { data: e2 } = useCricketStats('era', p2);
  const { data: e3 } = useCricketStats('era', p3);
  const { data: e4 } = useCricketStats('era', p4);

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      <header className="max-w-7xl mx-auto flex flex-col gap-4 mb-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
            <BarChart3 className="text-sky-400" /> Multi-Player Comparison
          </h1>
          <NavTabs />
        </div>
        <p className="text-sm text-zinc-500 max-w-2xl">
          Line up multiple greats in the same format and compare their raw career numbers
          plus average era index. Era index shows how a player&apos;s scoring rate compares
          to the average batter in the same era and format.
        </p>
      </header>

      <section className="max-w-7xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <CompareInput label="Player 1" value={p1} onChange={setP1} />
          <CompareInput label="Player 2" value={p2} onChange={setP2} />
          <CompareInput label="Player 3" value={p3} onChange={setP3} />
          <CompareInput label="Player 4" value={p4} onChange={setP4} />
        </div>

        <FormatPicker
          formats={['ODI', 'T20', 'Test']}
          value={format}
          onChange={setFormat}
        />

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-4 text-left font-semibold">Player</th>
                <th className="py-2 px-4 text-right font-semibold">Innings</th>
                <th className="py-2 px-4 text-right font-semibold">Runs</th>
                <th className="py-2 px-4 text-right font-semibold">Avg</th>
                <th className="py-2 px-4 text-right font-semibold">SR</th>
                <th className="py-2 pl-4 text-right font-semibold">Era Index (avg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              <CompareRow label={p1} career={c1} era={e1} format={format} />
              <CompareRow label={p2} career={c2} era={e2} format={format} />
              <CompareRow label={p3} career={c3} era={e3} format={format} />
              <CompareRow label={p4} career={c4} era={e4} format={format} />
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function CompareInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <input
        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FormatPicker({
  formats,
  value,
  onChange,
}: {
  formats: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center mt-2">
      <span className="text-xs text-zinc-500">Format:</span>
      {formats.map((f) => (
        <button
          key={f}
          className={[
            'px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors',
            f === value
              ? 'bg-sky-500/15 border-sky-500 text-sky-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-sky-500/70 hover:text-sky-200',
          ].join(' ')}
          onClick={() => onChange(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function CompareRow({
  label,
  career,
  era,
  format,
}: {
  label: string;
  career: any;
  era: any;
  format: string;
}) {
  const hasCareer = Array.isArray(career) && career.length > 0;
  const row = hasCareer ? career.find((r: any) => r?.format === format) ?? null : null;

  const eraAvg =
    Array.isArray(era) && era.length
      ? (() => {
          const rows = era.filter((r: any) => r?.format === format);
          return rows.length
            ? rows.reduce((s: number, x: any) => s + x.era_index, 0) / rows.length
            : null;
        })()
      : null;

  if (!hasCareer && eraAvg == null) {
    return null;
  }

  return (
    <tr>
      <td className="py-2 pr-4 font-semibold text-zinc-100">{label}</td>
      <td className="py-2 px-4 text-right">
        {row ? row.innings : <span className="text-zinc-600">–</span>}
      </td>
      <td className="py-2 px-4 text-right">
        {row ? row.runs : <span className="text-zinc-600">–</span>}
      </td>
      <td className="py-2 px-4 text-right">
        {row ? row.average : <span className="text-zinc-600">–</span>}
      </td>
      <td className="py-2 px-4 text-right">
        {row ? row.strike_rate : <span className="text-zinc-600">–</span>}
      </td>
      <td className="py-2 pl-4 text-right">
        {eraAvg != null ? (
          <span className="font-semibold text-emerald-400">
            {eraAvg.toFixed(2)}×
          </span>
        ) : (
          <span className="text-zinc-600">–</span>
        )}
      </td>
    </tr>
  );
}

