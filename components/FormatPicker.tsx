import type { Format } from '@/lib/types';

const FORMATS: Format[] = ['ODI', 'T20', 'Test'];

const ACCENTS = {
  blue: {
    on: 'bg-blue-500/15 border-blue-500 text-blue-300',
    off: 'hover:border-blue-500/70 hover:text-blue-200',
  },
  sky: {
    on: 'bg-sky-500/15 border-sky-500 text-sky-300',
    off: 'hover:border-sky-500/70 hover:text-sky-200',
  },
  emerald: {
    on: 'bg-emerald-500/15 border-emerald-500 text-emerald-300',
    off: 'hover:border-emerald-500/70 hover:text-emerald-200',
  },
};

export default function FormatPicker({
  value,
  onChange,
  accent = 'blue',
}: {
  value: Format;
  onChange: (format: Format) => void;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs text-zinc-500">Format:</span>
      {FORMATS.map((f) => (
        <button
          key={f}
          aria-pressed={f === value}
          className={[
            'px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors',
            f === value
              ? ACCENTS[accent].on
              : `bg-zinc-900 border-zinc-800 text-zinc-300 ${ACCENTS[accent].off}`,
          ].join(' ')}
          onClick={() => onChange(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
