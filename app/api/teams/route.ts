import { NextResponse } from 'next/server';
import { findPlayers } from '@/lib/stats';
import { answer, checkedDraft, readBody } from '@/lib/team-api';
import { createTeam, listTeams } from '@/lib/team-store';

/**
 * GET  /api/teams    every saved team, with its players' names
 * POST /api/teams    { name, players? }   saves a new team
 *
 * players are IDs in batting order, at most eleven. Teams are men's IPL teams.
 */
export async function GET() {
  return answer(async () => {
    const teams = await listTeams();
    const players = await findPlayers([...new Set(teams.flatMap((t) => t.players))]);
    return NextResponse.json(
      teams.map((t) => ({
        ...t,
        // a later data load could drop an ID that was saved
        names: t.players.map((id) => players.get(id)?.unique_name ?? 'Unknown player'),
      })),
    );
  }, 'could not read the teams');
}

export async function POST(request: Request) {
  return answer(async () => {
    const draft = await checkedDraft(await readBody(request));
    return NextResponse.json(await createTeam(draft), { status: 201 });
  }, 'could not save the team');
}
