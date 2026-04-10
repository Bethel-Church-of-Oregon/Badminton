import { sql } from '@vercel/postgres';

let initialized = false;

/** Ensures the members table exists. Runs once per serverless instance. */
export async function initDB() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS members (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE,
      elo          INTEGER NOT NULL DEFAULT 1000,
      wins         INTEGER NOT NULL DEFAULT 0,
      losses       INTEGER NOT NULL DEFAULT 0,
      games_played INTEGER NOT NULL DEFAULT 0,
      bio          TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS portrait TEXT NOT NULL DEFAULT 'missing-portrait.png'`;
  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id        TEXT PRIMARY KEY,
      played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      winner    INTEGER NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS match_players (
      match_id   TEXT NOT NULL,
      player_id  TEXT NOT NULL,
      team       INTEGER NOT NULL,
      elo_before INTEGER NOT NULL,
      elo_after  INTEGER NOT NULL,
      PRIMARY KEY (match_id, player_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS announcements (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  initialized = true;
}

export { sql };
