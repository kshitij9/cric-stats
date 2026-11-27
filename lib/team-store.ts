import type { Pool } from 'pg';
import { appDb } from '@/lib/app-db';
import { MAX_TEAMS, type Team, type TeamDraft } from '@/lib/teams';

/** Saved teams. Which players exist is checked by the caller (lib/squad.ts). */

/** Something the person asking can be told, with the status to answer with. */
export class TeamError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const COLUMNS = `team_id, name, competition, gender, players, version, updated_at`;

type Row = Omit<Team, 'updated_at'> & { updated_at: Date };
const team = (r: Row): Team => ({ ...r, updated_at: r.updated_at.toISOString() });

function database(): Pool {
  const db = appDb();
  if (!db) throw new TeamError(503, 'saving teams is not set up on this server');
  return db;
}

/** Turns what Postgres reports into something worth telling. */
function explain(err: unknown): unknown {
  const code = (err as { code?: string }).code;
  if (code === '23505') return new TeamError(409, 'there is already a team with that name');
  // no such database, or no such table: db/app/setup.sh has not been run
  if (code === '3D000' || code === '42P01') {
    return new TeamError(503, 'saving teams is not set up on this server');
  }
  return err;
}

async function run<T>(work: (db: Pool) => Promise<T>): Promise<T> {
  try {
    return await work(database());
  } catch (err) {
    throw explain(err);
  }
}

export const listTeams = () =>
  run(async (db) => {
    const { rows } = await db.query<Row>(
      `SELECT ${COLUMNS} FROM teams WHERE competition = 'ipl'
        ORDER BY lower(name), team_id`,
    );
    return rows.map(team);
  });

export const getTeam = (id: number) =>
  run(async (db) => {
    const { rows } = await db.query<Row>(`SELECT ${COLUMNS} FROM teams WHERE team_id = $1`, [id]);
    if (!rows[0]) throw new TeamError(404, 'that team no longer exists');
    return team(rows[0]);
  });

export const createTeam = ({ name, players }: TeamDraft) =>
  run(async (db) => {
    const client = await db.connect();
    let failed = true;
    try {
      await client.query('BEGIN');
      // one creation at a time, so the limit cannot be passed
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('teams'))`);
      const { rows: held } = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM teams`,
      );
      if (held[0].n >= MAX_TEAMS) {
        throw new TeamError(409, `there is room for ${MAX_TEAMS} teams; delete one first`);
      }
      const { rows } = await client.query<Row>(
        `INSERT INTO teams (name, competition, gender, players)
         VALUES ($1, 'ipl', 'male', $2) RETURNING ${COLUMNS}`,
        [name, players],
      );
      await client.query('COMMIT');
      failed = false;
      return team(rows[0]);
    } finally {
      // a connection left in a failed transaction is thrown away
      client.release(failed);
    }
  });

const changedElsewhere = 'this team was changed somewhere else; reload it and try again';

/** Replaces a team, provided it is still at the version the change began from. */
export const updateTeam = (id: number, version: number, { name, players }: TeamDraft) =>
  run(async (db) => {
    const { rows } = await db.query<Row>(
      `UPDATE teams SET name = $3, players = $4, version = version + 1, updated_at = now()
        WHERE team_id = $1 AND version = $2 RETURNING ${COLUMNS}`,
      [id, version, name, players],
    );
    if (rows[0]) return team(rows[0]);
    await getTeam(id); // 404 if it has gone
    throw new TeamError(409, changedElsewhere);
  });

export const deleteTeam = (id: number, version: number) =>
  run(async (db) => {
    const { rowCount } = await db.query(`DELETE FROM teams WHERE team_id = $1 AND version = $2`, [
      id,
      version,
    ]);
    if (rowCount) return;
    await getTeam(id);
    throw new TeamError(409, changedElsewhere);
  });
