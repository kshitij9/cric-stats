'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Overview' },
  { href: '/player', label: 'Player Profile' },
  { href: '/duel', label: 'Era Duel' },
  { href: '/compare', label: 'Multi-Player Compare' },
];

export default function NavTabs() {
  const pathname = usePathname() || '/';

  return (
    <nav className="flex flex-wrap gap-2 text-xs">
      {TABS.map((tab) => {
        const active =
          tab.href === '/'
            ? pathname === '/'
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              'px-3 py-1.5 rounded-full border font-semibold transition-colors',
              active
                ? 'bg-blue-500/15 border-blue-500 text-blue-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-blue-500/70 hover:text-blue-200',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

