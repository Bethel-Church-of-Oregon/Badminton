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
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
  await sql`
    INSERT INTO settings (key, value)
    VALUES ('header_text', '벧엘 배드민턴 클럽 홈페이지에 오신걸 환영합니다. (4월 19일)은 본당에서 (오후 5시)에 모이겠습니다!!!')
    ON CONFLICT (key) DO NOTHING
  `;
  await sql`
    INSERT INTO settings (key, value)
    VALUES ('last_updated', '')
    ON CONFLICT (key) DO NOTHING
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS inactivity_penalties (
      id         TEXT PRIMARY KEY,
      player_id  TEXT NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      elo_before INTEGER NOT NULL,
      elo_after  INTEGER NOT NULL
    )
  `;
  initialized = true;
}

export async function touchLastUpdated() {
  const nowISO = new Date().toISOString();
  await sql`
    INSERT INTO settings (key, value) VALUES ('last_updated', ${nowISO})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export { sql };
