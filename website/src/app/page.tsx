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
  last_played: string | null;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface MatchEntry {
  id: string;
  type?: 'match' | 'penalty';
  played_at: string;
  won?: boolean;
  elo_before: number;
  elo_after: number;
  elo_change: number;
  teammates?: string[];
  opponents?: string[];
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
  if (elo >= 1600) return { label: 'Diamond',  color: '#8b5cf6', bg: '#ede9fe' };
  if (elo >= 1400) return { label: 'Platinum', color: '#0891b2', bg: '#e0f2fe' };
  if (elo >= 1200) return { label: 'Gold',     color: '#d97706', bg: '#fef3c7' };
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
  '0493_Normal.png',
];

function randomPortrait() {
  // skip index 0 (missing-portrait)
  return ALL_PORTRAITS[Math.floor(Math.random() * (ALL_PORTRAITS.length - 1)) + 1];
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
  const [headerText, setHeaderText] = useState('벧엘 배드민턴 클럽 홈페이지에 오신걸 환영합니다. (5월 3일)은 본당에서 (오후 5시)에 모이겠습니다!!!');
  const [editHeaderText, setEditHeaderText] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchEntry[]>([]);
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(false);
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState<string | null>(null);

  // Admin state
  const [adminOpen, setAdminOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [inactiveMembers, setInactiveMembers] = useState<{ id: string; name: string; elo: number }[] | null>(null);
  const [inactiveMembersLoading, setInactiveMembersLoading] = useState(false);
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

  // Theme
  const [theme, setTheme] = useState<'default' | 'colorful'>('default');
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'default' | 'colorful' | null;
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toast
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null);
  const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'announcements' | 'hallofame' | 'contact'>('leaderboard');
  const pics = ['/pics/april-group-1.jpg', '/pics/march-group-1.jpg'];
  const [picIndex, setPicIndex] = useState(0);
  const [showPics, setShowPics] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const [sortCol, setSortCol] = useState<'rank' | 'name' | 'elo' | 'winrate' | 'games' | 'bio' | 'last_played'>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
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

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.header_text) {
      setHeaderText(data.header_text);
      setEditHeaderText(data.header_text);
    }
    if (data.last_updated) setLastUpdated(data.last_updated);
  }, []);

  useEffect(() => {
    loadMembers();
    loadAnnouncements();
    loadSettings();
    const interval = setInterval(() => { loadMembers(); loadAnnouncements(); }, 30_000);
    return () => clearInterval(interval);
  }, [loadMembers, loadAnnouncements, loadSettings]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    document.body.style.overflow = selectedMember ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedMember]);

  // Keep selected member in sync after reload
  useEffect(() => {
    if (selectedMember) {
      const updated = members.find((m) => m.id === selectedMember.id);
      if (updated) setSelectedMember(updated);
    }
  }, [members]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch match history when a member is selected
  useEffect(() => {
    if (!selectedMember) { setMatchHistory([]); setSelectedHistoryMonth(null); return; }
    setMatchHistoryLoading(true);
    setSelectedHistoryMonth(null);
    fetch(`/api/members/${selectedMember.id}/matches`)
      .then((r) => r.json())
      .then((data) => {
        setMatchHistory(data);
        setMatchHistoryLoading(false);
        if (data.length > 0) setSelectedHistoryMonth(data[0].played_at.slice(0, 7));
      })
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

  async function unlock() {
    if (!password) return showToast('Enter the admin password.', true);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return showToast('Incorrect password.', true);
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
    await Promise.all([loadMembers(), loadSettings()]);
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
    await Promise.all([loadMembers(), loadSettings()]);
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
    await Promise.all([loadMembers(), loadSettings()]);
  }

  async function loadInactiveMembers() {
    setInactiveMembersLoading(true);
    const res = await fetch(`/api/admin/inactivity?password=${encodeURIComponent(password)}`);
    const data = await res.json();
    setInactiveMembersLoading(false);
    if (!res.ok) return showToast(data.error ?? 'Error loading inactive members.', true);
    setInactiveMembers(data.members);
  }

  async function applyInactivityPenalty() {
    const res = await fetch('/api/admin/inactivity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error ?? 'Error applying penalty.', true);
    if (data.total === 0) return showToast('No inactive members to penalize.');
    showToast(`Penalty applied to ${data.total} member${data.total > 1 ? 's' : ''}.`);
    setInactiveMembers(null);
    await Promise.all([loadMembers(), loadSettings()]);
  }

  async function saveHeaderText() {
    const value = editHeaderText.trim();
    if (!value) return showToast('Header text cannot be empty.', true);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'header_text', value, password }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error ?? 'Error saving header.', true);
    setHeaderText(value);
    showToast('Header updated.');
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

  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));

  const displayMembers = [...members].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'rank')    cmp = a.rank - b.rank;
    if (sortCol === 'name')    cmp = a.name.localeCompare(b.name);
    if (sortCol === 'elo')     cmp = a.elo - b.elo;
    if (sortCol === 'winrate') cmp = (a.games_played ? a.wins / a.games_played : 0) - (b.games_played ? b.wins / b.games_played : 0);
    if (sortCol === 'games')   cmp = a.games_played - b.games_played;
    if (sortCol === 'bio')     cmp = a.bio.localeCompare(b.bio);
    if (sortCol === 'last_played') {
      const aT = a.last_played ? new Date(a.last_played).getTime() : 0;
      const bT = b.last_played ? new Date(b.last_played).getTime() : 0;
      cmp = aT - bT;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function matchOptions(exclude: string[]) {
    return sortedMembers.map((m) => (
      <option key={m.id} value={m.id} disabled={exclude.includes(m.id)}>
        {m.name} ({m.elo})
      </option>
    ));
  }

  const portraitMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.name, m.portrait])),
    [members],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Hero header */}
      <div style={{
        background: 'var(--header-bg)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '1.5rem 0 0.75rem',
        position: 'relative',
      }}>
        <div className="marquee-outer">
          <div className="marquee-track" style={{
            fontSize: '2.5rem', fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}>
            <span>{headerText}</span>
            <span>{headerText}</span>
            <span>{headerText}</span>
            <span>{headerText}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* Photo carousel */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button
            onClick={() => setShowPics((v) => !v)}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)',
              padding: '0.35rem 1.1rem', borderRadius: 980, cursor: 'pointer', fontSize: '0.78rem',
              fontWeight: 500, letterSpacing: '-0.01em',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {showPics ? 'Hide Photos' : 'Show Photos'}
          </button>
          <button
            onClick={() => setTheme((t) => t === 'default' ? 'colorful' : 'default')}
            style={{
              background: theme === 'colorful' ? 'linear-gradient(135deg,#a855f7,#ec4899)' : 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: theme === 'colorful' ? '#fff' : 'var(--text-muted)',
              padding: '0.35rem 1.1rem', borderRadius: 980, cursor: 'pointer', fontSize: '0.78rem',
              fontWeight: 500, letterSpacing: '-0.01em',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {theme === 'colorful' ? 'Colorful Theme' : 'Default Theme'}
          </button>
        </div>

        {showPics && <div
          style={{ marginBottom: '2rem', textAlign: 'center' }}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 40) setPicIndex((i) => dx < 0 ? (i + 1) % pics.length : (i - 1 + pics.length) % pics.length);
            touchStartX.current = null;
          }}
        >
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={pics[picIndex]}
              alt={`Photo ${picIndex + 1}`}
              className="carousel-img"
              style={{ borderRadius: 18, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', display: 'block' }}
            />
            {(() => {
              const leftDisabled  = pics.length === 1 || picIndex === 0;
              const rightDisabled = pics.length === 1 || picIndex === pics.length - 1;
              const btnStyle = (disabled: boolean, side: 'left' | 'right'): React.CSSProperties => ({
                position: 'absolute', [side]: 8, top: '50%', transform: 'translateY(-50%)',
                background: disabled ? 'rgba(180,180,180,0.18)' : 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                color: disabled ? 'rgba(180,180,180,0.5)' : 'rgba(255,255,255,0.9)', border: 'none',
                borderRadius: '50%', width: 36, height: 36,
                cursor: disabled ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              });
              return (<>
                <button
                  onClick={() => !leftDisabled && setPicIndex((picIndex - 1 + pics.length) % pics.length)}
                  style={btnStyle(leftDisabled, 'left')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  onClick={() => !rightDisabled && setPicIndex((picIndex + 1) % pics.length)}
                  style={btnStyle(rightDisabled, 'right')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>);
            })()}
          </div>
          <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            {picIndex + 1} / {pics.length}
          </div>
        </div>}

        {/* Segmented tab control */}
        <div className="tab-bar" style={{ marginBottom: '1.25rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'rgba(0,0,0,0.06)', borderRadius: 980,
            padding: '3px', gap: '2px',
            width: '100%', minWidth: 'max-content',
          }}>
            {(['leaderboard', 'announcements', 'hallofame', 'contact'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const label = tab === 'leaderboard' ? 'Leaderboard' : tab === 'announcements' ? 'Announcements' : tab === 'hallofame' ? 'Hall of Fame' : 'Contact';
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '0.45rem 1rem',
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? 'var(--text)' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: 980,
                    cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: isActive ? 600 : 500,
                    letterSpacing: '-0.01em',
                    transition: 'background 0.18s, color 0.18s',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
          marginBottom: '2rem',
          display: 'flex', flexDirection: 'column', minHeight: '780px', maxHeight: '85vh',
          overflow: 'hidden',
        }}>

          {activeTab === 'leaderboard' && (
            <div className="leaderboard-scroll" style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '6%' }} />
                  <col className="col-player" />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col />{/* About — takes remaining space */}
                  <col style={{ width: '12%' }} />{/* Last Played */}
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg-header)' }}>
                    {([
                      { col: 'rank',        label: 'Rank',            align: 'center' },
                      { col: 'name',        label: 'Player',          align: 'left'   },
                      { col: 'elo',         label: 'ELO',             align: 'center' },
                      { col: 'winrate',     label: 'Win Rate',        align: 'center' },
                      { col: 'games',       label: 'Games',           align: 'center' },
                      { col: 'bio',         label: 'To My Opponents', align: 'center' },
                      { col: 'last_played', label: 'Last Played',     align: 'center' },
                    ] as const).map(({ col, label, align }) => (
                      <th key={col} style={{ ...thStyle(align), cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(col)}>
                        {label}{sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</td></tr>
                  ) : members.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No members yet. Add some via the admin panel.
                    </td></tr>
                  ) : displayMembers.map((m, idx) => {
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
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, maxWidth: '100%' }}>
                            <Avatar name={m.name} portrait={m.portrait} size={36} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
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
                          padding: '0.45rem 0.75rem', textAlign: 'center',
                          fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                          fontSize: '0.85rem', color: 'var(--accent)',
                        }}>{m.elo}</td>

                        <td style={{
                          padding: '0.45rem 0.75rem', textAlign: 'center',
                          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem',
                          fontWeight: 600,
                        }}>{winRate(m)}</td>

                        <td style={{
                          padding: '0.45rem 0.75rem', textAlign: 'center',
                          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem',
                          color: 'var(--text-muted)',
                        }}>{m.games_played}</td>

                        <td style={{ padding: '0.45rem 0.75rem', overflow: 'hidden' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {m.bio || '—'}
                          </div>
                        </td>

                        <td style={{
                          padding: '0.45rem 0.75rem', textAlign: 'center',
                          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                        }}>
                          {m.last_played
                            ? (() => {
                                const d = new Date(m.last_played);
                                return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
                              })()
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{
                padding: '0.5rem 0.75rem',
                textAlign: 'left',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border)',
              }}>
                Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </div>
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
                      <div className="ann-title" style={{ fontWeight: 600 }}>{a.title}</div>
                      {a.body && (
                        <span className="ann-chevron" style={{ color: 'var(--text-muted)', userSelect: 'none' }}>
                          {expandedAnnouncements.has(a.id) ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                    {a.body && expandedAnnouncements.has(a.id) && (
                      <div className="ann-body" style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', marginTop: '0.4rem', marginBottom: '0.35rem' }}>{a.body}</div>
                    )}
                    <div className="ann-date" style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'hallofame' && (
            <div style={{ padding: '1rem 1.5rem' }}>
              <div style={{ overflowX: 'auto', paddingBottom: '0.25rem' }}>
                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '1.5rem', minWidth: 'max-content' }}>

                  {/* Men's row */}
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                      Men's Champions
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      {/* May 2026 */}
                      <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '1.25rem 1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                        width: 180,
                      }}>
                        <Avatar name="?" portrait="missing-portrait.png" size={56} />
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>May 2026</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>TBD</div>
                      </div>

                      {/* April 2026 */}
                      {(() => {
                        const m = members.find((m) => m.name === '한준');
                        return (
                          <div style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 12, padding: '1.25rem 1.5rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                            width: 180,
                          }}>
                            <Avatar name="한준" portrait={m?.portrait} size={56} />
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>April 2026</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>한준</div>
                          </div>
                        );
                      })()}

                      {/* March 2026 */}
                      {(() => {
                        const m = members.find((m) => m.name === '용재');
                        return (
                          <div style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 12, padding: '1.25rem 1.5rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                            width: 180,
                          }}>
                            <Avatar name="용재" portrait={m?.portrait} size={56} />
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>March 2026</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>용재</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Women's row */}
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                      Women's Champions
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      {/* May 2026 */}
                      <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '1.25rem 1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                        width: 180,
                      }}>
                        <Avatar name="?" portrait="missing-portrait.png" size={56} />
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>May 2026</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>TBD</div>
                      </div>

                      {/* April 2026 */}
                      {(() => {
                        const m = members.find((m) => m.name === '수빈');
                        return (
                          <div style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 12, padding: '1.25rem 1.5rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                            width: 180,
                          }}>
                            <Avatar name="수빈" portrait={m?.portrait} size={56} />
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>April 2026</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>수빈</div>
                          </div>
                        );
                      })()}

                      {/* March 2026 */}
                      <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '1.25rem 1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                        width: 180,
                      }}>
                        <Avatar name="?" portrait="missing-portrait.png" size={56} />
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>March 2026</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-muted)' }}>N/A</div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}


          {activeTab === 'contact' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem' }}>💬</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0ea5e9' }}>참여문의</div>
              <div style={{ fontSize: '0.95rem' }}>KakaoTalk ID: <strong style={{ color: 'var(--text)', letterSpacing: '0.03em' }}>iankim0712</strong></div>
            </div>
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
                {/* Header text editor */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <SectionTitle>Header Text</SectionTitle>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input
                      type="text"
                      value={editHeaderText}
                      onChange={(e) => setEditHeaderText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveHeaderText()}
                      placeholder="Header marquee text"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button onClick={saveHeaderText} style={btnPrimary}>Save</button>
                  </div>
                </div>
                <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
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
                    <Field label="To My Opponents (optional)">
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
                  </div>

                  {/* Current Members */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <SectionTitle>Current Members</SectionTitle>
                    {members.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No members yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '24rem', overflowY: 'auto' }}>
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

                  {/* Record Match */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <SectionTitle>Record Match Result</SectionTitle>

                    <Field label="Team 1">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select value={t1p1} onChange={(e) => setT1p1(e.target.value)} style={selectStyle}>
                          <option value="">Player 1</option>{matchOptions([t1p2, t2p1, t2p2].filter(Boolean))}
                        </select>
                        <select value={t1p2} onChange={(e) => setT1p2(e.target.value)} style={selectStyle}>
                          <option value="">Player 2</option>{matchOptions([t1p1, t2p1, t2p2].filter(Boolean))}
                        </select>
                      </div>
                    </Field>

                    <Field label="Team 2">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select value={t2p1} onChange={(e) => setT2p1(e.target.value)} style={selectStyle}>
                          <option value="">Player 1</option>{matchOptions([t1p1, t1p2, t2p2].filter(Boolean))}
                        </select>
                        <select value={t2p2} onChange={(e) => setT2p2(e.target.value)} style={selectStyle}>
                          <option value="">Player 2</option>{matchOptions([t1p1, t1p2, t2p1].filter(Boolean))}
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

                  {/* Inactivity Penalty */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <SectionTitle>Inactivity Penalty</SectionTitle>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      −20 ELO (floor 800) for members with no matches last month.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={loadInactiveMembers} style={btnPrimary} disabled={inactiveMembersLoading}>
                        {inactiveMembersLoading ? 'Loading…' : 'Preview'}
                      </button>
                      <button
                        onClick={applyInactivityPenalty}
                        style={{ ...btnPrimary, background: '#d97706' }}
                        disabled={inactiveMembers !== null && inactiveMembers.length === 0}
                      >
                        Apply
                      </button>
                    </div>
                    {inactiveMembers !== null && (
                      inactiveMembers.length === 0 ? (
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No inactive members.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '24rem', overflowY: 'auto' }}>
                          {inactiveMembers.map((m) => (
                            <div key={m.id} style={{
                              display: 'flex', justifyContent: 'space-between',
                              padding: '0.4rem 0.75rem',
                              background: 'var(--bg-header)', borderRadius: 6, fontSize: '0.85rem',
                            }}>
                              <span>{m.name}</span>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#d97706' }}>
                                {m.elo} → {Math.max(800, m.elo - 20)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    )}
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
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{m.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Rank #{m.rank}</div>
                    </div>
                    {m.bio && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>"{m.bio}"</div>}
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
                  ) : (() => {
                    const months = Array.from(new Set(matchHistory.map(m => m.played_at.slice(0, 7)))).sort((a, b) => b.localeCompare(a));
                    const filteredHistory = (selectedHistoryMonth && selectedHistoryMonth !== 'graph')
                      ? matchHistory.filter(m => m.played_at.slice(0, 7) === selectedHistoryMonth)
                      : matchHistory;
                    const tabs: string[] = ['graph', ...months];
                    return (
                      <>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                          {tabs.map((tab) => {
                            const isGraph = tab === 'graph';
                            const label = isGraph ? 'Graph' : new Date(tab + '-02').toLocaleDateString('en-US', { month: 'short' });
                            const count = isGraph ? null : matchHistory.filter(x => x.played_at.slice(0, 7) === tab).length;
                            const active = selectedHistoryMonth === tab;
                            return (
                              <button key={tab} onClick={() => setSelectedHistoryMonth(tab)}
                                style={{
                                  padding: '0.2rem 0.6rem', borderRadius: 99, border: '1px solid var(--border)',
                                  background: active ? 'var(--accent, #6366f1)' : 'var(--bg-header)',
                                  color: active ? '#fff' : 'var(--text-muted)',
                                  fontSize: '0.72rem', fontWeight: active ? 700 : 400,
                                  cursor: 'pointer', transition: 'background 0.15s',
                                }}>{label}{count !== null && <span style={{ opacity: 0.7 }}> ({count})</span>}</button>
                            );
                          })}
                        </div>

                        {selectedHistoryMonth === 'graph' ? (() => {
                          const chrono = [...matchHistory].reverse();
                          const pts = [
                            { elo: chrono[0].elo_before, won: null as boolean | null, isPenalty: false },
                            ...chrono.map(m => ({ elo: m.elo_before + m.elo_change, won: m.won, isPenalty: m.type === 'penalty' })),
                          ];
                          const elos = pts.map(p => p.elo);
                          const minE = Math.min(...elos) - 15;
                          const maxE = Math.max(...elos) + 15;
                          const W = 340, H = 120, xO = 44, yO = 8;
                          const sx = (i: number) => xO + (pts.length < 2 ? W / 2 : (i / (pts.length - 1)) * W);
                          const sy = (e: number) => yO + H - ((e - minE) / (maxE - minE)) * H;
                          const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i).toFixed(1)} ${sy(p.elo).toFixed(1)}`).join(' ');
                          const gridElos = [Math.round(minE + 20), Math.round((minE + maxE) / 2), Math.round(maxE - 20)];
                          const vW = xO + W + 12, vH = yO + H + 20;
                          return (
                            <svg viewBox={`0 0 ${vW} ${vH}`} style={{ width: '100%', display: 'block' }}>
                              <rect x={xO} y={yO} width={W} height={H} rx={8} fill="rgba(99,102,241,0.05)" />
                              {gridElos.map(e => (
                                <g key={e}>
                                  <line x1={xO} x2={xO + W} y1={sy(e)} y2={sy(e)} stroke="rgba(148,163,184,0.18)" strokeWidth={1} strokeDasharray="3 5" />
                                  <text x={xO - 5} y={sy(e) + 4} textAnchor="end" fontSize={9} fill="rgba(148,163,184,0.75)" fontFamily="JetBrains Mono, monospace">{e}</text>
                                </g>
                              ))}
                              <path d={linePath} fill="none" stroke="#818cf8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              {pts.map((p, i) => {
                                if (i === 0) return null;
                                const cx = sx(i), cy = sy(p.elo);
                                const col = p.isPenalty ? '#fbbf24' : (p.won ? '#4ade80' : '#f87171');
                                return (
                                  <g key={i}>
                                    <circle cx={cx} cy={cy} r={5} fill={col} opacity={0.18} />
                                    <circle cx={cx} cy={cy} r={3} fill={col} stroke="rgba(255,255,255,0.85)" strokeWidth={1.2} />
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        })() : (
                      <div style={{ overflowX: 'auto' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '420px' }}>
                        {filteredHistory.map((match, idx) => {
                          const eloSign = match.elo_change >= 0 ? '+' : '';
                          const date = new Date(match.played_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                          });
                          const prevDate = idx > 0 ? new Date(filteredHistory[idx - 1].played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
                          const isNewDate = prevDate !== null && date !== prevDate;
                          const isPenalty = match.type === 'penalty';
                          return (
                            <div key={match.id} style={{ borderRadius: 7 }}>
                            {isNewDate && <div style={{ height: 1, background: 'var(--border)', margin: '0.3rem 0' }} />}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '0.6rem',
                              padding: '0.4rem 0.6rem',
                              background: 'var(--bg-header)', borderRadius: 7,
                              flexWrap: 'nowrap',
                            }}>
                                <div style={{
                                width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: '0.7rem',
                                background: isPenalty ? '#fef3c7' : (match.won ? '#dcfce7' : '#fee2e2'),
                                color: isPenalty ? '#d97706' : (match.won ? '#16a34a' : '#dc2626'),
                              }}>{isPenalty ? 'P' : (match.won ? 'W' : 'L')}</div>

                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, width: '52px' }}>{date}</span>

                                {isPenalty ? (
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>Inactivity penalty</span>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  {(match.teammates?.length ?? 0) > 0 && (
                                    <div style={{ minWidth: '130px', flexShrink: 0 }}>
                                      <PlayerRow label="with" names={match.teammates!} portraitMap={portraitMap} />
                                    </div>
                                  )}
                                  <div style={{ minWidth: '130px', flexShrink: 0 }}>
                                    <PlayerRow label="vs" names={match.opponents!} muted portraitMap={portraitMap} />
                                  </div>
                                </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', flexShrink: 0 }}>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{match.elo_before}</span>
                                <span style={{
                                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.78rem',
                                  color: match.elo_change >= 0 ? '#16a34a' : '#dc2626',
                                }}>{eloSign}{match.elo_change}</span>
                              </div>
                            </div>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                        )}
                      </>
                    );
                  })()}
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

              <Field label="To My Opponents">
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
    background: 'var(--bg-header)',
    position: 'sticky', top: 0, zIndex: 1,
    width,
  };
}

function PlayerRow({ label, names, muted, portraitMap }: { label: string; names: string[]; muted?: boolean; portraitMap?: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap' }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1 }}>{label}</span>
      {names.map((name) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
          <Avatar name={name} portrait={portraitMap?.[name]} size={20} />
          <span style={{
            fontSize: '0.82rem', fontWeight: muted ? 400 : 500,
            color: muted ? 'var(--text-muted)' : 'var(--text)',
            whiteSpace: 'nowrap',
          }}>{name.slice(0, 2)}</span>
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
