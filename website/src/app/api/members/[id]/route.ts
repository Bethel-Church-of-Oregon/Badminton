import { NextRequest, NextResponse } from 'next/server';
import { sql, touchLastUpdated } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await req.json().catch(() => ({}));
  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const updates: Promise<unknown>[] = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    updates.push(sql`UPDATE members SET name = ${name} WHERE id = ${id}`);
  }
  if (body.bio !== undefined) {
    updates.push(sql`UPDATE members SET bio = ${String(body.bio)} WHERE id = ${id}`);
  }
  if (body.portrait !== undefined) {
    updates.push(sql`UPDATE members SET portrait = ${body.portrait} WHERE id = ${id}`);
  }

  await Promise.all(updates);
  await touchLastUpdated();
  return NextResponse.json({ message: 'Updated' });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const password = req.nextUrl.searchParams.get('password') ?? '';
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { rowCount } = await sql`DELETE FROM members WHERE id = ${id}`;

  if (!rowCount) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Member removed' });
}
