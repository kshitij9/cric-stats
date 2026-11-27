'use client';

import { House, ListOrdered, Scale, UserRound, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Segmented } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import { FORMATS, scopeName } from '@/lib/scope';
import type { Competition, Format } from '@/lib/types';

export const SCREENS = [
  { href: '/', label: 'Home', icon: House },
  { href: '/player', label: 'Player', icon: UserRound },
  { href: '/compare', label: 'Compare', icon: Scale },
  { href: '/recommend', label: 'Picks', icon: ListOrdered },
  { href: '/teams', label: 'Teams', icon: Users },
];

const COMPETITIONS: { value: Competition; label: string }[] = [
  { value: 'ipl', label: 'IPL' },
  { value: 'international', label: 'International' },
];

/** The screens, and the competition they all show. */
export default function AppHeader() {
  const pathname = usePathname();
  const { competition, scope, setCompetition, setFormat } = useApp();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-xl font-black italic uppercase tracking-tighter">
          Cric<span className="text-sky-400">Intell</span>
        </Link>

        <nav aria-label="Screens" className="order-3 w-full md:order-none md:w-auto">
          <ul className="grid grid-cols-5 gap-1 md:flex">
            {SCREENS.map(({ href, label, icon: Icon }) => {
              // a screen's own pages count as it: /teams/3 is Teams
              const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors md:flex-row md:gap-2 md:px-4 md:py-2 md:text-sm ${
                      active
                        ? 'bg-zinc-800 text-sky-300'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                    }`}
                  >
                    <Icon size={16} aria-hidden /> {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented
            label="Competition"
            hideLabel
            options={COMPETITIONS}
            value={competition}
            onChange={(v) => v && setCompetition(v)}
          />
          {competition === 'international' && (
            <Segmented<Format>
              label="Format"
              hideLabel
              options={FORMATS.map((format) => ({
                value: format,
                label: scopeName({ format, competition }),
              }))}
              value={scope.format}
              onChange={(v) => v && setFormat(v)}
            />
          )}
        </div>
      </div>
    </header>
  );
}
