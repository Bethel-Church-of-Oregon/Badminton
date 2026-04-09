import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fetch all rows for this player's matches, joining with other participants
  const { rows } = await sql`
    SELECT
      m.id          AS match_id,
      m.played_at,
      m.winner,
      mp.team       AS my_team,
      mp.elo_before,
      mp.elo_after,
      mp2.player_id AS other_id,
      mp2.team      AS other_team,
      mem.name      AS other_name
    FROM matches m
    JOIN match_players mp  ON m.id = mp.match_id  AND mp.player_id  = ${id}
    JOIN match_players mp2 ON m.id = mp2.match_id AND mp2.player_id != ${id}
    JOIN members mem        ON mp2.player_id = mem.id
    ORDER BY m.played_at DESC
    LIMIT 50
  `;

  // Group rows by match_id
  const matchMap = new Map<string, {
    id: string;
    played_at: string;
    won: boolean;
    elo_before: number;
    elo_after: number;
    elo_change: number;
    teammates: string[];
    opponents: string[];
  }>();

  for (const row of rows) {
    if (!matchMap.has(row.match_id)) {
      matchMap.set(row.match_id, {
        id: row.match_id,
        played_at: row.played_at,
        won: Number(row.my_team) === Number(row.winner),
        elo_before: row.elo_before,
        elo_after: row.elo_after,
        elo_change: row.elo_after - row.elo_before,
        teammates: [],
        opponents: [],
      });
    }
    const match = matchMap.get(row.match_id)!;
    if (Number(row.other_team) === Number(row.my_team)) {
      match.teammates.push(row.other_name);
    } else {
      match.opponents.push(row.other_name);
    }
  }

  return NextResponse.json(Array.from(matchMap.values()));
}
