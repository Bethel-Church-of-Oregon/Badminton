import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
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

  await initDB();

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

  // Apply ELO updates and collect before/after for each player
  const eloBefore: Record<string, number> = {};
  const eloAfter: Record<string, number> = {};

  for (let i = 0; i < winners.length; i++) {
    eloBefore[winners[i].id] = winners[i].elo;
    eloAfter[winners[i].id] = newWinnerRatings[i];
    await sql`
      UPDATE members
      SET elo = ${newWinnerRatings[i]}, wins = wins + 1, games_played = games_played + 1
      WHERE id = ${winners[i].id}
    `;
  }
  for (let i = 0; i < losers.length; i++) {
    eloBefore[losers[i].id] = losers[i].elo;
    eloAfter[losers[i].id] = newLoserRatings[i];
    await sql`
      UPDATE members
      SET elo = ${newLoserRatings[i]}, losses = losses + 1, games_played = games_played + 1
      WHERE id = ${losers[i].id}
    `;
  }

  // Record the match
  const matchId = crypto.randomUUID();
  await sql`INSERT INTO matches (id, winner) VALUES (${matchId}, ${winner})`;

  for (const id of team1) {
    await sql`
      INSERT INTO match_players (match_id, player_id, team, elo_before, elo_after)
      VALUES (${matchId}, ${id}, 1, ${eloBefore[id]}, ${eloAfter[id]})
    `;
  }
  for (const id of team2) {
    await sql`
      INSERT INTO match_players (match_id, player_id, team, elo_before, elo_after)
      VALUES (${matchId}, ${id}, 2, ${eloBefore[id]}, ${eloAfter[id]})
    `;
  }

  // Update last_updated only when the stored date differs from today's date
  const nowISO = new Date().toISOString();
  const todayDate = nowISO.slice(0, 10); // YYYY-MM-DD
  await sql`
    INSERT INTO settings (key, value) VALUES ('last_updated', ${nowISO})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE LEFT(settings.value, 10) IS DISTINCT FROM ${todayDate}
  `;

  return NextResponse.json({ message: 'Match recorded successfully' });
}
