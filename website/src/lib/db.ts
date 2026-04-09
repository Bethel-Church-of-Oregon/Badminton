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
      created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  initialized = true;
}

export { sql };
