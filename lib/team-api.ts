import { NextResponse } from 'next/server';
import { findIplPlayers } from '@/lib/squad';
import { TeamError } from '@/lib/team-store';
import { parseDraft, type TeamDraft } from '@/lib/teams';

/** What the team addresses share. */

const MAX_BODY = 4096; // characters; a full team is a few hundred

export const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Runs a handler, turning what goes wrong into an answer. */
export async function answer(work: () => Promise<Response>, failure: string): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof TeamError) return refuse(err.status, err.message);
    console.error(err);
    return refuse(500, failure);
  }
}

/**
 * The body of a change. It must be declared as JSON: a page on another site can
 * post plain text here without the browser asking first, but not JSON.
 */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new TeamError(415, 'send the team as application/json');
  const text = await request.text();
  if (text.length > MAX_BODY) throw new TeamError(413, 'that is too much to be a team');
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // refused below
  }
  throw new TeamError(400, 'the team could not be read');
}

/** A draft that meets the rules, with only players who have played in the IPL. */
export async function checkedDraft(body: unknown): Promise<TeamDraft> {
  const draft = parseDraft(body);
  if ('error' in draft) throw new TeamError(400, draft.error);
  const found = await findIplPlayers(draft.players);
  const unknown = draft.players.filter((id) => !found.has(id));
  if (unknown.length) throw new TeamError(400, `no IPL player with ID ${unknown.join(', ')}`);
  return draft;
}

/** A whole number from 1 that fits a Postgres integer, else null. */
export const positive = (value: unknown) => {
  const text = String(value ?? '');
  return /^[1-9]\d{0,8}$/.test(text) ? Number(text) : null;
};
