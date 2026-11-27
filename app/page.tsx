'use client';

import { ArrowRight, ListOrdered, Scale, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PlayerSearch from '@/components/PlayerSearch';
import { Card, SECONDARY } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import { useJson } from '@/hooks/useJson';
import { KOHLI, SHARMA } from '@/lib/defaults';
import { scopeName } from '@/lib/scope';
import type { Coverage } from '@/lib/types';

const FEATURES = [
  {
    href: '/player',
    icon: UserRound,
    title: 'Player profile',
    question: 'How good is a batter?',
    points: [
      'Runs, average, strike rate and more',
      'Season by season, against the average batter',
      'The bowlers who get them out most',
    ],
    action: 'Open a profile',
  },
  {
    href: '/compare',
    icon: Scale,
    title: 'Compare',
    question: 'Who is the better batter?',
    points: [
      'Up to six players side by side',
      'Choose which figures to show',
      'See how each has changed over the seasons',
    ],
    action: 'Compare players',
  },
  {
    href: '/recommend',
    icon: ListOrdered,
    title: 'Picks',
    question: 'Who should I pick for this match?',
    points: [
      'Rank batters or bowlers',
      'For a ground, opposition, phase or head-to-head',
      'Search everyone, or just your shortlist',
    ],
    action: 'Find picks',
  },
];

export default function Home() {
  const router = useRouter();
  const { competition, scope, setPlayer, replaceCompared } = useApp();
  const coverage = useJson<Coverage>(`/api/coverage?competition=${competition}`);
  const matches = coverage.data?.formats
    .filter((f) => f.format === scope.format)
    .reduce((sum, f) => sum + f.matches, 0);
  const label = scopeName(scope);

  return (
    <>
      <section className="space-y-3 py-2">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          What do you want to find out?
        </h1>
        <p className="text-sm text-zinc-400">
          Showing <span className="font-semibold text-zinc-100">{label}</span> cricket
          {matches ? ` from ${matches.toLocaleString('en-GB')} matches` : ''}. Switch between the IPL
          and internationals at the top of any screen.
        </p>
        <div className="max-w-xl pt-1">
          <PlayerSearch
            selected={null}
            placeholder="Search for a player to open their profile"
            onSelect={(player) => {
              if (!player) return;
              setPlayer(player);
              router.push('/player');
            }}
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {FEATURES.map(({ href, icon: Icon, title, question, points, action }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-sky-500 focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <Icon size={28} className="text-sky-400" aria-hidden />
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-sm text-zinc-300">{question}</p>
            </div>
            <ul className="flex-1 list-disc space-y-1.5 pl-4 text-sm text-zinc-400">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <span className="flex items-center gap-2 text-sm font-semibold text-sky-400">
              {action}
              <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>

      <Card title="Try one of these">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SECONDARY}
            onClick={() => {
              replaceCompared([KOHLI, SHARMA]);
              router.push('/compare');
            }}
          >
            Compare Kohli and Rohit Sharma
          </button>
          <button
            type="button"
            className={SECONDARY}
            onClick={() => {
              setPlayer(KOHLI);
              router.push('/player#matchups');
            }}
          >
            Who gets Kohli out?
          </button>
          {scope.format !== 'Test' && (
            <>
              <Link className={SECONDARY} href="/recommend?role=bowler&phase=death">
                Best bowlers at the death
              </Link>
              <Link className={SECONDARY} href="/recommend?role=batter&phase=powerplay">
                Best powerplay batters
              </Link>
            </>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Fantasy points and team suggestions are not built yet.
        </p>
      </Card>
    </>
  );
}
