import { NextResponse } from 'next/server';
import { answer, checkedDraft, positive, readBody, refuse } from '@/lib/team-api';
import { deleteTeam, getTeam, updateTeam } from '@/lib/team-store';

/**
 * GET    /api/teams/{id}
 * PUT    /api/teams/{id}              { name, players, version }
 * DELETE /api/teams/{id}?version=
 *
 * version is the one last read. A team changed since then is left alone (409).
 */

type Context = { params: Promise<{ id: string }> };

const NO_TEAM = 'that team no longer exists';
const NO_VERSION = 'version must be given';

export async function GET(_request: Request, { params }: Context) {
  const id = positive((await params).id);
  if (!id) return refuse(404, NO_TEAM);
  return answer(async () => NextResponse.json(await getTeam(id)), 'could not read the team');
}

export async function PUT(request: Request, { params }: Context) {
  const id = positive((await params).id);
  if (!id) return refuse(404, NO_TEAM);
  return answer(async () => {
    const body = await readBody(request);
    const version = positive(body.version);
    if (!version) return refuse(400, NO_VERSION);
    const draft = await checkedDraft(body);
    return NextResponse.json(await updateTeam(id, version, draft));
  }, 'could not save the team');
}

export async function DELETE(request: Request, { params }: Context) {
  const id = positive((await params).id);
  if (!id) return refuse(404, NO_TEAM);
  const version = positive(new URL(request.url).searchParams.get('version'));
  if (!version) return refuse(400, NO_VERSION);
  return answer(async () => {
    await deleteTeam(id, version);
    return new NextResponse(null, { status: 204 });
  }, 'could not delete the team');
}
