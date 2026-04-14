import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

export async function GET() {
  await initDB();
  const { rows } = await sql`
    SELECT id, name, elo, wins, losses, games_played, bio, portrait
    FROM members
    ORDER BY elo DESC
  `;
  let rank = 1;
  const ranked = rows.map((m, i) => {
    if (i > 0 && m.elo < rows[i - 1].elo) rank = i + 1;
    return { ...m, rank };
  });
  return NextResponse.json(ranked);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const name = (body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const bio = (body.bio ?? '').trim();
  const portrait = (body.portrait ?? 'missing-portrait.png').trim();

  await initDB();

  try {
    const id = crypto.randomUUID();
    const { rows } = await sql`
      INSERT INTO members (id, name, bio, portrait)
      VALUES (${id}, ${name}, ${bio}, ${portrait})
      RETURNING id, name, elo, wins, losses, games_played, bio, portrait
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: `'${name}' already exists` }, { status: 409 });
    }
    throw err;
  }
}
