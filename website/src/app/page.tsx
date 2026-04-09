'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Member {
  id: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  games_played: number;
  rank: number;
}

export default function Home() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin state
  const [adminOpen, setAdminOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [newMemberName, setNewMemberName] = useState('');

  // Match form
  const [t1p1, setT1p1] = useState('');
  const [t1p2, setT1p2] = useState('');
  const [t2p1, setT2p1] = useState('');
  const [t2p2, setT2p2] = useState('');
  const [matchWinner, setMatchWinner] = useState<'1' | '2' | ''>('');

  // Toast
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadMembers = useCallback(async () => {
    const res = await fetch('/api/members');
    const data = await res.json();
    setMembers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMembers();
    const interval = setInterval(loadMembers, 30_000);
    return () => clearInterval(interval);
  }, [loadMembers]);

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  function showToast(msg: string, error = false) {
    setToast({ msg, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // ---------------------------------------------------------------------------
  // Admin actions
  // ---------------------------------------------------------------------------

  function unlock() {
    if (!password) return showToast('Enter the admin password.', true);
    setUnlocked(true);
  }

  async function addMember() {
    const name = newMemberName.trim();
    if (!name) return showToast('Enter a name.', true);

    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error ?? 'Error adding member.', true);

    setNewMemberName('');
    showToast(`${name} added (ELO: 1000).`);
    await loadMembers();
  }

  async function removeMember(id: string, name: string) {
    if (!confirm(`Remove ${name} from the leaderboard?`)) return;

    const res = await fetch(
      `/api/members/${id}?password=${encodeURIComponent(password)}`,
      { method: 'DELETE' },
    );
    const data = await res.json();
    if (!res.ok) return showToast(data.error ?? 'Error removing member.', true);

    showToast(`${name} removed.`);
    await loadMembers();
  }

  async function recordMatch() {
    const team1 = [t1p1, t1p2].filter(Boolean);
    const team2 = [t2p1, t2p2].filter(Boolean);

    if (!team1.length || !team2.length)
      return showToast('Select at least one player per team.', true);
    if (!matchWinner) return showToast('Select a winner.', true);

    const all = [...team1, ...team2];
    if (new Set(all).size !== all.length)
      return showToast('A player cannot appear more than once.', true);

    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team1, team2, winner: Number(matchWinner), password }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error ?? 'Error recording match.', true);

    setT1p1(''); setT1p2(''); setT2p1(''); setT2p2(''); setMatchWinner('');
    showToast('Match recorded. ELO updated.');
    await loadMembers();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function rankBadge(rank: number) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  }

  function winRate(m: Member) {
    if (!m.games_played) return '—';
    return ((m.wins / m.games_played) * 100).toFixed(0) + '%';
  }

  const memberOptions = members.map((m) => (
    <option key={m.id} value={m.id}>{m.name} ({m.elo})</option>
  ));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-block', background: 'var(--accent)', color: '#fff',
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em',
            padding: '0.35rem 0.9rem', borderRadius: '2rem', marginBottom: '0.6rem',
            textTransform: 'uppercase',
          }}>
            BCO Badminton Club
          </div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            ELO Leaderboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Rankings updated after every recorded match
          </p>
        </header>

        {/* Leaderboard */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '2rem',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-header)' }}>
                {['#', 'Name', 'ELO', 'W', 'L', 'Win Rate'].map((h, i) => (
                  <th key={h} style={{
                    padding: '0.75rem 1.25rem',
                    textAlign: i === 0 || i >= 3 ? 'center' : i === 2 || i === 5 ? 'right' : 'left',
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No members yet. Add some via the admin panel.
                </td></tr>
              ) : members.map((m, idx) => (
                <tr key={m.id} style={{
                  borderBottom: idx < members.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <td style={{
                    textAlign: 'center', fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700, fontSize: '0.9rem', padding: '0.85rem 1.25rem',
                    color: m.rank === 1 ? 'var(--gold)' : m.rank === 2 ? 'var(--silver)' : m.rank === 3 ? 'var(--bronze)' : 'var(--text)',
                  }}>{rankBadge(m.rank)}</td>
                  <td style={{ padding: '0.85rem 1.25rem', fontWeight: 500 }}>{m.name}</td>
                  <td style={{
                    padding: '0.85rem 1.25rem', textAlign: 'right',
                    fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                    fontSize: '1rem', color: 'var(--accent)',
                  }}>{m.elo}</td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>{m.wins}</td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>{m.losses}</td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{winRate(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Admin toggle */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <button onClick={() => setAdminOpen((o) => !o)} style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '0.5rem 1.2rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
          }}>
            {adminOpen ? 'Close Admin Panel' : 'Admin Panel'}
          </button>
        </div>

        {/* Admin panel */}
        {adminOpen && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '2rem',
          }}>
            <div style={{
              background: 'var(--bg-header)', padding: '0.85rem 1.5rem',
              fontWeight: 600, fontSize: '0.95rem',
              borderBottom: '1px solid var(--border)',
            }}>
              🔒 Admin
            </div>

            <div style={{ padding: '1.5rem' }}>
              {/* Password gate */}
              {!unlocked ? (
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                    Enter admin password
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', maxWidth: 380 }}>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && unlock()}
                      placeholder="Password"
                      style={inputStyle}
                    />
                    <button onClick={unlock} style={btnPrimary}>Unlock</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  {/* Add / Remove Member */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <SectionTitle>Add Member</SectionTitle>
                    <Field label="Name">
                      <input
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addMember()}
                        placeholder="e.g. 대한"
                        style={inputStyle}
                      />
                    </Field>
                    <button onClick={addMember} style={btnPrimary}>Add Member</button>

                    <div style={{ marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                        Current Members
                      </label>
                      {members.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No members yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {members.map((m) => (
                            <div key={m.id} style={{
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.75rem',
                              background: 'var(--bg-header)', borderRadius: 6, fontSize: '0.9rem',
                            }}>
                              <span>{m.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({m.elo})</span></span>
                              <button onClick={() => removeMember(m.id, m.name)} style={btnDanger}>
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Record Match */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <SectionTitle>Record Match Result</SectionTitle>

                    <Field label="Team 1">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select value={t1p1} onChange={(e) => setT1p1(e.target.value)} style={selectStyle}>
                          <option value="">Player 1</option>
                          {memberOptions}
                        </select>
                        <select value={t1p2} onChange={(e) => setT1p2(e.target.value)} style={selectStyle}>
                          <option value="">Player 2</option>
                          {memberOptions}
                        </select>
                      </div>
                    </Field>

                    <Field label="Team 2">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select value={t2p1} onChange={(e) => setT2p1(e.target.value)} style={selectStyle}>
                          <option value="">Player 1</option>
                          {memberOptions}
                        </select>
                        <select value={t2p2} onChange={(e) => setT2p2(e.target.value)} style={selectStyle}>
                          <option value="">Player 2</option>
                          {memberOptions}
                        </select>
                      </div>
                    </Field>

                    <Field label="Winner">
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {(['1', '2'] as const).map((v) => (
                          <label key={v} style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            fontSize: '0.9rem', cursor: 'pointer',
                            padding: '0.45rem 0.9rem',
                            border: `1px solid ${matchWinner === v ? 'var(--accent)' : 'var(--border)'}`,
                            background: matchWinner === v ? 'var(--accent-light)' : 'transparent',
                            borderRadius: 6,
                          }}>
                            <input
                              type="radio"
                              name="winner"
                              value={v}
                              checked={matchWinner === v}
                              onChange={() => setMatchWinner(v)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            Team {v}
                          </label>
                        ))}
                      </div>
                    </Field>

                    <button onClick={recordMatch} style={btnPrimary}>Record Match</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: toast.error ? 'var(--danger)' : 'var(--text)',
          color: '#fff', padding: '0.7rem 1.2rem', borderRadius: 8,
          fontSize: '0.88rem', maxWidth: 280, zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </h3>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// Shared style objects
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.75rem',
  border: '1px solid var(--border)', borderRadius: 6,
  fontSize: '0.9rem', background: 'var(--bg)', color: 'var(--text)',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, flex: 1, appearance: 'none',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none',
  padding: '0.55rem 1.2rem', borderRadius: 6,
  fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnDanger: React.CSSProperties = {
  background: 'var(--danger)', color: '#fff', border: 'none',
  padding: '0.35rem 0.65rem', borderRadius: 6,
  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
};
