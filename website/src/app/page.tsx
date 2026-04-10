'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface Member {
  id: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  games_played: number;
  bio: string;
  portrait: string;
  rank: number;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface MatchEntry {
  id: string;
  played_at: string;
  won: boolean;
  elo_before: number;
  elo_after: number;
  elo_change: number;
  teammates: string[];
  opponents: string[];
}

// ---------------------------------------------------------------------------
// Tier system
// ---------------------------------------------------------------------------

interface Tier {
  label: string;
  color: string;
  bg: string;
}

function getTier(elo: number): Tier {
  if (elo >= 1300) return { label: 'Diamond',  color: '#8b5cf6', bg: '#ede9fe' };
  if (elo >= 1200) return { label: 'Platinum', color: '#0891b2', bg: '#e0f2fe' };
  if (elo >= 1100) return { label: 'Gold',     color: '#d97706', bg: '#fef3c7' };
  if (elo >= 1000) return { label: 'Silver',   color: '#64748b', bg: '#f1f5f9' };
  return                   { label: 'Bronze',  color: '#92400e', bg: '#fef3c7' };
}

// ---------------------------------------------------------------------------
// Avatar helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  '#0d9488', '#6366f1', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#8b5cf6',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

function Avatar({ name, portrait, size = 40 }: { name: string; portrait?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [portrait]);
  const src = portrait ? `/assets/portraits/${portrait}` : null;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700,
      fontSize: size * 0.38,
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {getInitials(name)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portraits
// ---------------------------------------------------------------------------

const ALL_PORTRAITS = [
  'missing-portrait.png',
  ...Array.from({ length: 251 }, (_, i) => `${String(i + 1).padStart(4, '0')}_Normal.png`),
];

function randomPortrait() {
  // skip index 0 (missing-portrait)
  return ALL_PORTRAITS[Math.floor(Math.random() * 251) + 1];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Home() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementBody, setNewAnnouncementBody] = useState('');

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchEntry[]>([]);
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(false);

  // Admin state
  const [adminOpen, setAdminOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberBio, setNewMemberBio] = useState('');
  const [newMemberPortrait, setNewMemberPortrait] = useState(randomPortrait);
  const [portraitPickerTarget, setPortraitPickerTarget] = useState<'new' | 'edit' | string | null>(null);

  // Edit member
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPortrait, setEditPortrait] = useState('missing-portrait.png');

  // Admin member menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState('');

  // Match form
  const [t1p1, setT1p1] = useState('');
  const [t1p2, setT1p2] = useState('');
  const [t2p1, setT2p1] = useState('');
  const [t2p2, setT2p2] = useState('');
  const [matchWinner, setMatchWinner] = useState<'1' | '2' | ''>('');

  // Toast
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null);
  const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'announcements'>('leaderboard');
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

  const loadAnnouncements = useCallback(async () => {
    const res = await fetch('/api/announcements');
    setAnnouncements(await res.json());
  }, []);

  useEffect(() => {
    loadMembers();
    loadAnnouncements();
    const interval = setInterval(() => { loadMembers(); loadAnnouncements(); }, 30_000);
    return () => clearInterval(interval);
  }, [loadMembers, loadAnnouncements]);

  // Keep selected member in sync after reload
  useEffect(() => {
    if (selectedMember) {
      const updated = members.find((m) => m.id === selectedMember.id);
      if (updated) setSelectedMember(updated);
    }
  }, [members]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch match history when a member is selected
  useEffect(() => {
    if (!selectedMember) { setMatchHistory([]); return; }
    setMatchHistoryLoading(true);
    fetch(`/api/members/${selectedMember.id}/matches`)
      .then((r) => r.json())
      .then((data) => { setMatchHistory(data); setMatchHistoryLoading(false); })
      .catch(() => setMatchHistoryLoading(false));
  }, [selectedMember?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      body: JSON.stringify({ name, bio: newMemberBio.trim(), portrait: newMemberPortrait, password }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error ?? 'Error adding member.', true);

    setNewMemberName('');
    setNewMemberBio('');
    setNewMemberPortrait(randomPortrait());
    showToast(`${name} added (ELO: 1000).`);
    await loadMembers();
  }

  async function removeMember(id: string) {
    const name = confirmRemove?.name ?? '';
    setConfirmRemove(null);
    const res = await fetch(
      `/api/members/${id}?password=${encodeURIComponent(password)}`,
      { method: 'DELETE' },
    );
    const data = await res.json();
    if (!res.ok) return showToast(data.error ?? 'Error removing member.', true);

    showToast(`${name} removed.`);
    await loadMembers();
  }

  async function patchMember(id: string, fields: Record<string, unknown>) {
    return fetch(`/api/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, password }),
    });
  }

  async function saveMemberEdit() {
    if (!editingMember) return;
    const name = editName.trim();
    if (!name) return showToast('Name cannot be empty.', true);

    const res = await patchMember(editingMember.id, { name, bio: editBio.trim(), portrait: editPortrait });
    const data = await res.json();
    if (!res.ok) return showToast(data.error ?? 'Error saving changes.', true);

    setEditingMember(null);
    showToast('Member updated.');
    await loadMembers();
  }

  async function updateMemberPortrait(id: string, portrait: string) {
    const res = await patchMember(id, { portrait });
    if (!res.ok) return showToast('Error updating portrait.', true);
    showToast('Portrait updated.');
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

  async function addAnnouncement() {
    const title = newAnnouncementTitle.trim();
    if (!title) return showToast('Title is required.', true);
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body: newAnnouncementBody.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error ?? 'Error posting announcement.', true);
    setNewAnnouncementTitle('');
    setNewAnnouncementBody('');
    showToast('Announcement posted.');
    await loadAnnouncements();
  }

  async function removeAnnouncement(id: string) {
    const res = await fetch(
      `/api/announcements/${id}?password=${encodeURIComponent(password)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) return showToast('Error deleting announcement.', true);
    showToast('Announcement deleted.');
    await loadAnnouncements();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function winRate(m: Member) {
    if (!m.games_played) return '—';
    return ((m.wins / m.games_played) * 100).toFixed(0) + '%';
  }

  const memberOptions = [...members]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => (
      <option key={m.id} value={m.id}>{m.name} ({m.elo})</option>
    ));

  const portraitMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.name, m.portrait])),
    [members],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>

        {/* Tabbed card: Leaderboard + Announcements */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '2rem',
          display: 'flex', flexDirection: 'column', minHeight: '780px', maxHeight: '85vh',
        }}>
          <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            {(['leaderboard', 'announcements'] as const).map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '0.6rem 1rem',
                  background: activeTab === tab ? 'var(--accent)' : 'var(--bg-header)',
                  color: activeTab === tab ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {tab === 'leaderboard' ? 'Leaderboard' : 'Announcements'}
              </button>
            ))}
          </div>

          {activeTab === 'leaderboard' && (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col />{/* About — takes remaining space */}
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg-header)' }}>
                    <th style={thStyle('center')}>Rank</th>
                    <th style={thStyle('left')}>Player</th>
                    <th style={thStyle('right')}>ELO</th>
                    <th style={thStyle('right')}>Win Rate</th>
                    <th style={thStyle('right')}>Games</th>
                    <th style={thStyle('left')}>About</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</td></tr>
                  ) : members.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No members yet. Add some via the admin panel.
                    </td></tr>
                  ) : members.map((m, idx) => {
                    const tier = getTier(m.elo);
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedMember(m)}
                        style={{
                          borderBottom: idx < members.length - 1 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-header)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{
                          textAlign: 'center', fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 600, fontSize: '0.85rem', padding: '0.45rem 0.75rem',
                          color: 'var(--text-muted)',
                        }}>{m.rank}</td>

                        <td style={{ padding: '0.45rem 0.75rem', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <Avatar name={m.name} portrait={m.portrait} size={40} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '15ch' }}>{m.name}</div>
                              <div style={{
                                display: 'inline-block', marginTop: '0.1rem',
                                fontSize: '0.62rem', fontWeight: 700,
                                color: tier.color, background: tier.bg,
                                padding: '0.05rem 0.4rem', borderRadius: '2rem',
                              }}>{tier.label}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{
                          padding: '0.45rem 0.75rem', textAlign: 'right',
                          fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                          fontSize: '0.85rem', color: 'var(--accent)',
                        }}>{m.elo}</td>

                        <td style={{
                          padding: '0.45rem 0.75rem', textAlign: 'right',
                          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem',
                          fontWeight: 600,
                        }}>{winRate(m)}</td>

                        <td style={{
                          padding: '0.45rem 0.75rem', textAlign: 'right',
                          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem',
                          color: 'var(--text-muted)',
                        }}>{m.games_played}</td>

                        <td style={{ padding: '0.45rem 0.75rem', overflow: 'hidden' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {m.bio || '—'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'announcements' && (
            announcements.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No announcements yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {announcements.map((a, idx) => (
                  <div key={a.id} style={{
                    padding: '0.9rem 1rem',
                    borderBottom: idx < announcements.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div
                      onClick={() => setExpandedAnnouncements((prev) => {
                        const next = new Set(prev);
                        next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                        return next;
                      })}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: a.body ? 'pointer' : 'default' }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{a.title}</div>
                      {a.body && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', userSelect: 'none' }}>
                          {expandedAnnouncements.has(a.id) ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                    {a.body && expandedAnnouncements.has(a.id) && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', marginTop: '0.4rem', marginBottom: '0.35rem' }}>{a.body}</div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
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
                <>
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
                    <Field label="Short intro (optional)">
                      <input
                        type="text"
                        value={newMemberBio}
                        onChange={(e) => setNewMemberBio(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addMember()}
                        placeholder="e.g. Smash specialist"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Portrait">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={newMemberName || '?'} portrait={newMemberPortrait} size={40} />
                        <button
                          onClick={() => setPortraitPickerTarget('new')}
                          style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left', width: 'auto', padding: '0.4rem 0.75rem' }}
                        >Choose…</button>
                      </div>
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
                          {[...members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
                            <div key={m.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.5rem 0.75rem',
                              background: 'var(--bg-header)', borderRadius: 6, fontSize: '0.9rem',
                              position: 'relative',
                            }}>
                              <span>{m.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({m.elo})</span></span>
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-muted)', fontSize: '1.1rem',
                                    padding: '0 0.25rem', lineHeight: 1, borderRadius: 4,
                                  }}
                                >⋮</button>
                                {openMenuId === m.id && (
                                  <>
                                    {/* Backdrop to close on outside click */}
                                    <div
                                      style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                      onClick={() => setOpenMenuId(null)}
                                    />
                                    <div style={{
                                      position: 'absolute', right: 0, top: '110%',
                                      background: 'var(--bg-card)',
                                      border: '1px solid var(--border)',
                                      borderRadius: 8, zIndex: 11,
                                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                      minWidth: 120, overflow: 'hidden',
                                    }}>
                                      <button
                                        onClick={() => { setOpenMenuId(null); setEditingMember(m); setEditName(m.name); setEditBio(m.bio); setEditPortrait(m.portrait); }}
                                        style={{
                                          width: '100%', padding: '0.6rem 1rem',
                                          background: 'none', border: 'none',
                                          textAlign: 'left', cursor: 'pointer',
                                          fontSize: '0.85rem', color: 'var(--text)',
                                          fontWeight: 500,
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-header)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                      >Edit</button>
                                      <button
                                        onClick={() => { setOpenMenuId(null); setConfirmRemove({ id: m.id, name: m.name }); setConfirmNameInput(''); }}
                                        style={{
                                          width: '100%', padding: '0.6rem 1rem',
                                          background: 'none', border: 'none',
                                          textAlign: 'left', cursor: 'pointer',
                                          fontSize: '0.85rem', color: 'var(--danger)',
                                          fontWeight: 500,
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                      >Remove</button>
                                    </div>
                                  </>
                                )}
                              </div>
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
                          <option value="">Player 1</option>{memberOptions}
                        </select>
                        <select value={t1p2} onChange={(e) => setT1p2(e.target.value)} style={selectStyle}>
                          <option value="">Player 2</option>{memberOptions}
                        </select>
                      </div>
                    </Field>

                    <Field label="Team 2">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select value={t2p1} onChange={(e) => setT2p1(e.target.value)} style={selectStyle}>
                          <option value="">Player 1</option>{memberOptions}
                        </select>
                        <select value={t2p2} onChange={(e) => setT2p2(e.target.value)} style={selectStyle}>
                          <option value="">Player 2</option>{memberOptions}
                        </select>
                      </div>
                    </Field>

                    <Field label="Winner">
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {(['1', '2'] as const).map((v) => (
                          <label key={v} style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            fontSize: '0.9rem', cursor: 'pointer', padding: '0.45rem 0.9rem',
                            border: `1px solid ${matchWinner === v ? 'var(--accent)' : 'var(--border)'}`,
                            background: matchWinner === v ? 'var(--accent-light)' : 'transparent',
                            borderRadius: 6,
                          }}>
                            <input
                              type="radio" name="winner" value={v}
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

                {/* Announcements */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                  <SectionTitle>Announcements</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <Field label="Title">
                        <input
                          type="text"
                          value={newAnnouncementTitle}
                          onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                          placeholder="Announcement title"
                          style={inputStyle}
                        />
                      </Field>
                      <Field label="Body (optional)">
                        <textarea
                          value={newAnnouncementBody}
                          onChange={(e) => setNewAnnouncementBody(e.target.value)}
                          placeholder="Details..."
                          rows={3}
                          style={{ ...inputStyle, resize: 'vertical' }}
                        />
                      </Field>
                      <button onClick={addAnnouncement} style={btnPrimary}>Post Announcement</button>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                        Posted Announcements
                      </label>
                      {announcements.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {announcements.map((a) => (
                            <div key={a.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              gap: '0.5rem', padding: '0.5rem 0.75rem',
                              background: 'var(--bg-header)', borderRadius: 6, fontSize: '0.85rem',
                            }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                              <button onClick={() => removeAnnouncement(a.id)} style={btnDanger}>Delete</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profile modal */}
      {selectedMember && (() => {
        const m = selectedMember;
        const tier = getTier(m.elo);
        return (
          <div
            onClick={() => setSelectedMember(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 200, padding: '1rem',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg-card)', borderRadius: 16,
                width: '100%', maxWidth: 720,
                boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
                overflow: 'hidden',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Top accent strip */}
              <div style={{ height: 6, background: tier.color, flexShrink: 0 }} />

              {/* Scrollable content */}
              <div style={{ overflowY: 'auto', padding: '1rem 1.5rem 1.5rem' }}>
                {/* Close button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <button
                    onClick={() => setSelectedMember(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1, padding: 0,
                    }}
                  >✕</button>
                </div>

                {/* Avatar + name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <Avatar name={m.name} portrait={m.portrait} size={72} />
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{m.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Rank #{m.rank}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        background: tier.bg, color: tier.color,
                        fontWeight: 700, fontSize: '0.72rem',
                        padding: '0.2rem 0.6rem', borderRadius: '2rem',
                        border: `1px solid ${tier.color}33`,
                      }}>{tier.label}</div>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)',
                      }}>{m.elo}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ELO</span>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Wins',     value: m.wins },
                    { label: 'Losses',   value: m.losses },
                    { label: 'Win Rate', value: winRate(m) },
                    { label: 'Games',    value: m.games_played },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: 'var(--bg-header)', borderRadius: 10,
                      padding: '0.7rem 0.4rem', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{value}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Match history */}
                <div>
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginBottom: '0.75rem', paddingBottom: '0.5rem',
                    borderBottom: '1px solid var(--border)',
                  }}>Match History</div>

                  {matchHistoryLoading ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</div>
                  ) : matchHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No matches recorded yet.</div>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '260px', overflowY: 'auto' }}>
                        {matchHistory.map((match) => {
                          const eloSign = match.elo_change >= 0 ? '+' : '';
                          const date = new Date(match.played_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                          });
                          return (
                            <div key={match.id} style={{
                              display: 'flex', alignItems: 'center', gap: '0.6rem',
                              padding: '0.4rem 0.6rem',
                              background: 'var(--bg-header)', borderRadius: 7,
                              flexWrap: 'nowrap', minWidth: 0,
                            }}>
                                <div style={{
                                width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: '0.7rem',
                                background: match.won ? '#dcfce7' : '#fee2e2',
                                color: match.won ? '#16a34a' : '#dc2626',
                              }}>{match.won ? 'W' : 'L'}</div>

                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, width: '52px' }}>{date}</span>

                                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                {match.teammates.length > 0 && (
                                  <div style={{ width: '130px', flexShrink: 0, overflow: 'hidden' }}>
                                    <PlayerRow label="with" names={match.teammates} portraitMap={portraitMap} />
                                  </div>
                                )}
                                <PlayerRow label="vs" names={match.opponents} muted portraitMap={portraitMap} />
                              </div>

                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', flexShrink: 0 }}>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{match.elo_before}</span>
                                <span style={{
                                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.78rem',
                                  color: match.elo_change >= 0 ? '#16a34a' : '#dc2626',
                                }}>{eloSign}{match.elo_change}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm remove modal */}
      {confirmRemove && (
        <div
          onClick={() => setConfirmRemove(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300, padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: '1.5rem',
              maxWidth: 320, width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>Remove member?</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Type <strong>{confirmRemove.name}</strong> to confirm removal.
            </div>
            <input
              type="text"
              value={confirmNameInput}
              onChange={(e) => setConfirmNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && confirmNameInput === confirmRemove.name)
                  removeMember(confirmRemove.id);
              }}
              placeholder={confirmRemove.name}
              style={{ ...inputStyle, marginBottom: '1rem' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setConfirmRemove(null); setConfirmNameInput(''); }}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  padding: '0.5rem 1rem', borderRadius: 6,
                  fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text)',
                }}
              >Cancel</button>
              <button
                onClick={() => removeMember(confirmRemove.id)}
                disabled={confirmNameInput !== confirmRemove.name}
                style={{
                  ...btnDanger,
                  opacity: confirmNameInput !== confirmRemove.name ? 0.4 : 1,
                  cursor: confirmNameInput !== confirmRemove.name ? 'not-allowed' : 'pointer',
                }}
              >Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit member modal */}
      {editingMember && (
        <div
          onClick={() => setEditingMember(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300, padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 14,
              width: '100%', maxWidth: 400,
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              background: 'var(--bg-header)', padding: '0.85rem 1.25rem',
              fontWeight: 700, fontSize: '0.95rem',
              borderBottom: '1px solid var(--border)',
            }}>
              Edit — {editingMember.name}
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Name">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveMemberEdit()}
                  style={inputStyle}
                  autoFocus
                />
              </Field>

              <Field label="Short intro">
                <input
                  type="text"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveMemberEdit()}
                  placeholder="e.g. Smash specialist"
                  style={inputStyle}
                />
              </Field>

              <Field label="Portrait">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar name={editName || '?'} portrait={editPortrait} size={44} />
                  <button
                    onClick={() => setPortraitPickerTarget('edit')}
                    style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left', width: 'auto', padding: '0.4rem 0.75rem' }}
                  >Change…</button>
                </div>
              </Field>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                <button
                  onClick={() => setEditingMember(null)}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    padding: '0.5rem 1rem', borderRadius: 6,
                    fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text)',
                  }}
                >Cancel</button>
                <button onClick={saveMemberEdit} style={btnPrimary}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portrait picker modal */}
      {portraitPickerTarget !== null && (
        <PortraitPicker
          current={
            portraitPickerTarget === 'new' ? newMemberPortrait
            : portraitPickerTarget === 'edit' ? editPortrait
            : (members.find(m => m.id === portraitPickerTarget)?.portrait ?? 'missing-portrait.png')
          }
          onSelect={(p) => {
            if (portraitPickerTarget === 'new') {
              setNewMemberPortrait(p);
            } else if (portraitPickerTarget === 'edit') {
              setEditPortrait(p);
            } else {
              updateMemberPortrait(portraitPickerTarget!, p);
            }
          }}
          onClose={() => setPortraitPickerTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: toast.error ? 'var(--danger)' : 'var(--text)',
          color: '#fff', padding: '0.7rem 1.2rem', borderRadius: 8,
          fontSize: '0.88rem', maxWidth: 280, zIndex: 300,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function thStyle(align: React.CSSProperties['textAlign'], width?: string): React.CSSProperties {
  return {
    padding: '0.4rem 0.75rem', textAlign: align,
    fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    borderBottom: '1px solid var(--border)',
    width,
  };
}

function PlayerRow({ label, names, muted, portraitMap }: { label: string; names: string[]; muted?: boolean; portraitMap?: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap', minWidth: 0 }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1 }}>{label}</span>
      {names.map((name) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0, flexShrink: 1 }}>
          <Avatar name={name} portrait={portraitMap?.[name]} size={20} />
          <span style={{
            fontSize: '0.82rem', fontWeight: muted ? 400 : 500,
            color: muted ? 'var(--text-muted)' : 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

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

// ---------------------------------------------------------------------------
// Portrait picker
// ---------------------------------------------------------------------------

function PortraitPicker({ current, onSelect, onClose }: {
  current: string;
  onSelect: (portrait: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 14,
          width: '100%', maxWidth: 520,
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border)',
          fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
        }}>Choose Portrait</div>

        <div style={{
          overflowY: 'auto', flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
          gap: '0.4rem', padding: '0.75rem',
        }}>
          {ALL_PORTRAITS.map((p) => (
            <img
              key={p}
              src={`/assets/portraits/${p}`}
              alt={p}
              title={p}
              onClick={() => { onSelect(p); onClose(); }}
              style={{
                width: 52, height: 52, objectFit: 'cover',
                borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${p === current ? 'var(--accent)' : 'transparent'}`,
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => { if (p !== current) e.currentTarget.style.borderColor = 'var(--border)'; }}
              onMouseLeave={(e) => { if (p !== current) e.currentTarget.style.borderColor = 'transparent'; }}
            />
          ))}
        </div>

        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border)',
              padding: '0.45rem 1rem', borderRadius: 6,
              fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text)',
            }}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}
