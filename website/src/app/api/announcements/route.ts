import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

export async function GET() {
  await initDB();
  const { rows } = await sql`
    SELECT id, title, body, created_at
    FROM announcements
    ORDER BY created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const title = (body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const text = (body.body ?? '').trim();
  const id = crypto.randomUUID();

  await initDB();
  const { rows } = await sql`
    INSERT INTO announcements (id, title, body)
    VALUES (${id}, ${title}, ${text})
    RETURNING id, title, body, created_at
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
