import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { applyElo } from '@/lib/elo';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { team1, team2, winner } = body as {
    team1: string[];
    team2: string[];
    winner: number;
  };

  if (![1, 2].includes(winner)) {
    return NextResponse.json({ error: 'Winner must be 1 or 2' }, { status: 400 });
  }
  if (!team1?.length || !team2?.length) {
    return NextResponse.json({ error: 'Both teams are required' }, { status: 400 });
  }
  if (team1.some((id) => team2.includes(id))) {
    return NextResponse.json({ error: 'A player cannot be on both teams' }, { status: 400 });
  }

  // Fetch all involved members
  const { rows: allMembers } = await sql`SELECT id, elo FROM members`;
  const byId = Object.fromEntries(allMembers.map((m) => [m.id, m]));

  const allIds = [...team1, ...team2];
  const missing = allIds.filter((id) => !byId[id]);
  if (missing.length) {
    return NextResponse.json({ error: 'One or more members not found' }, { status: 404 });
  }

  const t1 = team1.map((id) => byId[id]);
  const t2 = team2.map((id) => byId[id]);
  const [winners, losers] = winner === 1 ? [t1, t2] : [t2, t1];

  const { newWinnerRatings, newLoserRatings } = applyElo(
    winners.map((m) => m.elo),
    losers.map((m) => m.elo),
  );

  // Apply updates
  for (let i = 0; i < winners.length; i++) {
    await sql`
      UPDATE members
      SET elo = ${newWinnerRatings[i]}, wins = wins + 1, games_played = games_played + 1
      WHERE id = ${winners[i].id}
    `;
  }
  for (let i = 0; i < losers.length; i++) {
    await sql`
      UPDATE members
      SET elo = ${newLoserRatings[i]}, losses = losses + 1, games_played = games_played + 1
      WHERE id = ${losers[i].id}
    `;
  }

  return NextResponse.json({ message: 'Match recorded successfully' });
}
