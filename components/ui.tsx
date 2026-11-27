import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const join = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export const BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-40 disabled:cursor-not-allowed';
export const PRIMARY = `${BUTTON} bg-sky-500 text-zinc-950 hover:bg-sky-400`;
export const SECONDARY = `${BUTTON} border border-zinc-700 text-zinc-200 hover:border-sky-500 hover:text-sky-300`;

/** The title of a screen, and what it is for. */
export function PageHeader({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="space-y-2">
      <h1 className="flex items-center gap-3 text-2xl md:text-3xl font-bold tracking-tight">
        <Icon className="text-sky-400 shrink-0" aria-hidden /> {title}
      </h1>
      <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">{children}</p>
    </header>
  );
}

export function Card({
  title,
  hint,
  actions,
  id,
  children,
  className,
}: {
  title?: string;
  hint?: ReactNode;
  actions?: ReactNode;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={join(
        'min-w-0 scroll-mt-40 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:p-6 space-y-4',
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {hint && <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** A row of choices of which one is selected. */
export function Segmented<T extends string>({
  label,
  hideLabel,
  options,
  value,
  onChange,
  allowClear,
}: {
  label: string;
  hideLabel?: boolean;
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (value: T | '') => void;
  allowClear?: boolean;
}) {
  return (
    <div role="group" aria-label={label}>
      {!hideLabel && <p className="mb-1.5 text-xs text-zinc-400">{label}</p>}
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(allowClear && active ? '' : o.value)}
              className={join(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-sky-400',
                active ? 'bg-sky-500 text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
      {children}
    </div>
  );
}

export function Loading({ height = 'h-40' }: { height?: string }) {
  return (
    <div role="status" aria-label="Loading" className={`${height} animate-pulse rounded-xl bg-zinc-800/60`} />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      {children}
    </p>
  );
}
