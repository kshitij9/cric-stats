import type { Competition, Format, Scope } from '@/lib/types';

export const FORMATS: readonly Format[] = ['Test', 'ODI', 'T20'];
export const COMPETITIONS: readonly Competition[] = ['international', 'ipl'];

export const isFormat = (value: string): value is Format =>
  (FORMATS as readonly string[]).includes(value);

export const isCompetition = (value: string): value is Competition =>
  (COMPETITIONS as readonly string[]).includes(value);

/** How a message names a scope: 'Test', 'ODI', 'T20' (internationals) or 'IPL'. */
export const scopeName = ({ format, competition }: Scope) =>
  competition === 'ipl' ? 'IPL' : format;

/** The competition asked for; none given means internationals. */
export function parseCompetition(value: unknown): Competition | { error: string } {
  const competition = String(value ?? '').trim() || 'international';
  return isCompetition(competition)
    ? competition
    : { error: `competition must be one of ${COMPETITIONS.join(', ')}` };
}

export function parseScope(format: unknown, competition: unknown): Scope | { error: string } {
  const f = String(format ?? '').trim();
  if (!isFormat(f)) return { error: `format must be one of ${FORMATS.join(', ')}` };
  const c = parseCompetition(competition);
  if (typeof c !== 'string') return c;
  if (c === 'ipl' && f !== 'T20') return { error: 'the IPL is played as T20 only' };
  return { format: f, competition: c };
}
