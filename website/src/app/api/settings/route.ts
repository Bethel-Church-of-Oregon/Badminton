import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

export async function GET() {
  await initDB();
  const { rows } = await sql`SELECT key, value FROM settings`;
  const result = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { key, value } = body;
  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
  }

  await initDB();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  return NextResponse.json({ key, value });
}
