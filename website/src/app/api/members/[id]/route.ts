import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

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
