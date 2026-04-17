import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';
const ELO_PENALTY = 20;
const ELO_FLOOR = 800;

function prevMonthWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end };
}

async function getInactiveMembers() {
  const { start, end } = prevMonthWindow();
  const { rows } = await sql`
    SELECT m.id, m.name, m.elo
    FROM members m
    WHERE NOT EXISTS (
      SELECT 1
      FROM match_players mp
      JOIN matches mt ON mp.match_id = mt.id
      WHERE mp.player_id = m.id
        AND mt.played_at >= ${start.toISOString()}
        AND mt.played_at <  ${end.toISOString()}
    )
    ORDER BY m.name
  `;
  return rows;
}

// Preview: returns list of members who would be penalized
export async function GET(req: NextRequest) {
  const pw = req.nextUrl.searchParams.get('password') ?? '';
  if (pw !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const inactive = await getInactiveMembers();
  const applicable = inactive.filter((m) => m.elo > ELO_FLOOR);
  return NextResponse.json({ members: applicable.map((m) => ({ id: m.id, name: m.name, elo: m.elo })) });
}

// Apply penalty
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const inactive = await getInactiveMembers();
  const penalized: { id: string; name: string; oldElo: number; newElo: number }[] = [];

  for (const member of inactive) {
    const newElo = Math.max(ELO_FLOOR, member.elo - ELO_PENALTY);
    if (newElo === member.elo) continue;
    await sql`UPDATE members SET elo = ${newElo} WHERE id = ${member.id}`;
    const penaltyId = crypto.randomUUID();
    await sql`
      INSERT INTO inactivity_penalties (id, player_id, elo_before, elo_after)
      VALUES (${penaltyId}, ${member.id}, ${member.elo}, ${newElo})
    `;
    penalized.push({ id: member.id, name: member.name, oldElo: member.elo, newElo });
  }

  return NextResponse.json({ penalized, total: penalized.length });
}
