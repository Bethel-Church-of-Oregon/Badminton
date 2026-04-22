"""
Generates a beautiful HTML match schedule by running badminton-match.py
and parsing its output. Does NOT modify the original script.
"""
import sys
import re
import json
import urllib.request
import ssl
from io import StringIO
from pathlib import Path
import importlib.util

# ---------------------------------------------------------------------------
# Portrait configuration
# ---------------------------------------------------------------------------
# The script will try each URL in order and use the first that responds.
# Set WEBSITE_URLS to your deployed site or leave as-is for local dev.
WEBSITE_URLS = [
    "http://localhost:3000",
    "http://localhost:3001",
]

# Fallback portrait map: display_name -> filename (e.g. "0042_Normal.png").
# Used when the API is unreachable. Leave blank to show initials-only avatars.
PLAYER_PORTRAITS: dict[str, str] = {}

# ---------------------------------------------------------------------------
# Tier / skill configuration (mirrors badminton-match.py player lists)
# ---------------------------------------------------------------------------
# Keep in sync with the a/b/c/d/e lists in generate_tournament().
SKILL = {"a": 5, "b": 4, "c": 3, "d": 2, "e": 1}

PLAYER_TIERS: dict[str, str] = {
    # a (skill 5)
    "대한": "a", "창영": "a",
    # b (skill 4)
    "한준": "b", "지성": "b", "정훈": "b", "시영": "b",
    # c (skill 3)
    "건우": "c", "건수": "c", "우진": "c",
    # d (skill 2)
    "수빈": "d", "은혜": "d", "경록": "d", "민오": "d", "혜영": "d", "강형": "d",
    # e (skill 1)
    "재욱": "e",
}

_TIER_COLORS = {
    "a": ("#7c3aed", "#ede9fe"),  # purple
    "b": ("#0891b2", "#e0f2fe"),  # cyan
    "c": ("#d97706", "#fef3c7"),  # amber
    "d": ("#16a34a", "#dcfce7"),  # green
    "e": ("#64748b", "#f1f5f9"),  # slate
}

# Avatar colors — same order as the website's AVATAR_COLORS constant.
_AVATAR_COLORS = [
    "#0d9488", "#6366f1", "#ec4899", "#f59e0b",
    "#10b981", "#3b82f6", "#ef4444", "#8b5cf6",
]


def _avatar_color(name: str) -> str:
    h = 0
    for c in name:
        h = (h * 31 + ord(c)) & 0xFFFF
    return _AVATAR_COLORS[h % len(_AVATAR_COLORS)]


def fetch_portraits() -> tuple[dict[str, str], str]:
    """
    Try each WEBSITE_URL and return (name->portrait mapping, portrait_base_url).
    Returns (PLAYER_PORTRAITS, "") on failure so the caller still has a fallback.
    """
    ctx = ssl._create_unverified_context()
    for base in WEBSITE_URLS:
        try:
            req = urllib.request.urlopen(f"{base}/api/members", timeout=4, context=ctx)
            data = json.loads(req.read())
            portrait_map = {m["name"]: m.get("portrait", "") for m in data if m.get("name")}
            # Merge with manual overrides (PLAYER_PORTRAITS wins on conflict)
            merged = {**portrait_map, **PLAYER_PORTRAITS}
            print(f"[portraits] Fetched {len(portrait_map)} portraits from {base}")
            return merged, f"{base}/assets/portraits"
        except Exception as e:
            print(f"[portraits] {base} unavailable ({e})")
    print("[portraits] Using fallback portrait map (initials only for missing players).")
    return PLAYER_PORTRAITS, ""


def capture_tournament_output():
    """Run the tournament script and capture its printed output."""
    script_path = Path(__file__).parent / "badminton-match.py"
    spec = importlib.util.spec_from_file_location("badminton_match", script_path)
    module = importlib.util.module_from_spec(spec)
    old_stdout = sys.stdout
    sys.stdout = StringIO()
    try:
        spec.loader.exec_module(module)
        module.generate_tournament()
        return sys.stdout.getvalue()
    finally:
        sys.stdout = old_stdout


def parse_schedule(output: str):
    """Parse the text output into structured match data."""
    matches = []
    lines = output.strip().split('\n')

    for line in lines:
        # Skip separator lines
        if line.startswith('=') or line.startswith('-'):
            continue
        # Match pattern: "   1    |   TeamA vs   TeamB    |   TeamC vs   TeamD"
        parts = [p.strip() for p in line.split('|')]
        if len(parts) != 3:
            continue
        round_part, court1_part, court2_part = parts
        round_m = re.match(r'(\d+)', round_part)
        if not round_m:
            continue
        round_num = int(round_m.group(1))

        def parse_match(part):
            # "Team1 vs Team2" -> (team1, team2)
            idx = part.lower().find(' vs ')
            if idx < 0:
                return None, None
            left_s = part[:idx].strip()
            right_s = part[idx + 4:].strip()
            def parse_team(s):
                return [p.strip() for p in s.split(',') if p.strip()]
            return parse_team(left_s), parse_team(right_s)

        c1_t1, c1_t2 = parse_match(court1_part)
        c2_t1, c2_t2 = parse_match(court2_part)
        if c1_t1 and c1_t2 and c2_t1 and c2_t2:
            matches.append({
                'round': round_num,
                'court1': {'team1': c1_t1, 'team2': c1_t2},
                'court2': {'team1': c2_t1, 'team2': c2_t2},
            })
    return matches


def generate_html(matches, title="4월 배드민턴 대회 : 8라운드 전체 대진표",
                  portraits: dict | None = None, portrait_base: str = ""):
    """Generate a beautiful HTML match schedule."""
    return f'''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>배드민턴 대진표</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg: #f8fafc;
            --bg-card: #ffffff;
            --bg-header: #f1f5f9;
            --accent: #0d9488;
            --accent-light: #e6fffa;
            --text: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --vs-color: #dc2626;
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Noto Sans KR', -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 2rem;
            line-height: 1.6;
        }}

        .container {{
            max-width: 920px;
            margin: 0 auto;
        }}

        header {{
            text-align: center;
            margin-bottom: 2.5rem;
        }}

        .badge {{
            display: inline-block;
            background: var(--accent);
            color: white;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.15em;
            padding: 0.4rem 1rem;
            border-radius: 2rem;
            margin-bottom: 0.75rem;
            text-transform: uppercase;
        }}

        h1 {{
            font-size: 1.75rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: var(--text);
        }}

        .round-grid {{
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
        }}

        .round-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }}

        .round-header {{
            background: var(--bg-header);
            padding: 0.85rem 1.5rem;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}

        .round-num {{
            font-family: 'JetBrains Mono', monospace;
            background: var(--accent);
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
        }}

        .courts {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
        }}

        @media (max-width: 600px) {{
            .courts {{
                grid-template-columns: 1fr;
            }}
        }}

        .court {{
            padding: 1.25rem 1.5rem;
            border-right: 1px solid var(--border);
        }}

        .court:last-child {{
            border-right: none;
        }}

        @media (max-width: 600px) {{
            .court {{
                border-right: none;
                border-bottom: 1px solid var(--border);
            }}
            .court:last-child {{
                border-bottom: none;
            }}
        }}

        .court-label {{
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.12em;
            margin-bottom: 0.75rem;
        }}

        .match {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        }}

        .team {{
            display: flex;
            align-items: center;
            gap: 0.6rem;
            font-weight: 500;
        }}

        .player {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--bg-header);
            padding: 0.35rem 0.65rem 0.35rem 0.4rem;
            border-radius: 6px;
            border: 1px solid var(--border);
        }}

        .player-name {{
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--text);
            white-space: nowrap;
        }}

        .avatar {{
            width: 28px;
            height: 28px;
            border-radius: 50%;
            overflow: hidden;
            flex-shrink: 0;
            position: relative;
        }}

        .avatar img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }}

        .avatar-fallback {{
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 700;
            font-size: 0.7rem;
        }}

        .vs {{
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.7rem;
            font-weight: 700;
            color: var(--vs-color);
            flex-shrink: 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="badge">April Tournament</div>
            <h1>{title}</h1>
        </header>

        <div class="round-grid">
''' + '\n'.join(_render_round(m, portraits or {}, portrait_base) for m in matches) + '''
        </div>
    </div>
</body>
</html>'''


def _avatar_html(name: str, portrait_filename: str, portrait_base: str) -> str:
    color = _avatar_color(name)
    initial = name[0] if name else "?"
    if portrait_filename and portrait_filename != "missing-portrait.png" and portrait_base:
        src = f"{portrait_base}/{portrait_filename}"
        return (
            f'<div class="avatar">'
            f'<img src="{src}" alt="{name}" '
            f'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
            f'<div class="avatar-fallback" style="display:none;background:{color}">{initial}</div>'
            f'</div>'
        )
    return (
        f'<div class="avatar">'
        f'<div class="avatar-fallback" style="background:{color}">{initial}</div>'
        f'</div>'
    )


def _render_round(m, portraits: dict, portrait_base: str):
    def team_html(team):
        parts = []
        for p in team:
            portrait_file = portraits.get(p, "")
            av = _avatar_html(p, portrait_file, portrait_base)
            parts.append(
                f'<div class="player">{av}<span class="player-name">{p}</span></div>'
            )
        return ' '.join(parts)

    c1 = m['court1']
    c2 = m['court2']
    r = m['round']

    return f'''
            <article class="round-card">
                <div class="round-header">
                    <span class="round-num">{r}</span>
                    라운드
                </div>
                <div class="courts">
                    <div class="court">
                        <div class="court-label">코트 1</div>
                        <div class="match">
                            <div class="team">{team_html(c1['team1'])}</div>
                            <span class="vs">VS</span>
                            <div class="team">{team_html(c1['team2'])}</div>
                        </div>
                    </div>
                    <div class="court">
                        <div class="court-label">코트 2</div>
                        <div class="match">
                            <div class="team">{team_html(c2['team1'])}</div>
                            <span class="vs">VS</span>
                            <div class="team">{team_html(c2['team2'])}</div>
                        </div>
                    </div>
                </div>
            </article>'''


def _team_weight(team: list[str]) -> int:
    return sum(_player_weight(p) for p in team)


def _player_weight(name: str) -> int:
    return SKILL.get(PLAYER_TIERS.get(name, "?"), 0)


def _render_debug_round(m, portraits: dict, portrait_base: str) -> str:
    def player_card(name: str) -> str:
        w = _player_weight(name)
        av = _avatar_html(name, portraits.get(name, ""), portrait_base)
        return (
            f'<div style="display:flex;flex-direction:column;align-items:center;gap:0.2rem;">'
            f'<div class="player">{av}<span class="player-name">{name}</span></div>'
            f'<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;'
            f'font-weight:700;color:var(--text-muted);">⚡{w}</span>'
            f'</div>'
        )

    def team_block(team: list[str], weight: int) -> str:
        cards = ' '.join(player_card(p) for p in team)
        return (
            f'<div style="display:flex;flex-direction:column;align-items:flex-start;gap:0.35rem;">'
            f'<div class="team">{cards}</div>'
            f'<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;'
            f'font-weight:700;color:var(--text-muted);">⚡ {weight}</div>'
            f'</div>'
        )

    def court_block(court: dict, label: str) -> str:
        t1, t2 = court["team1"], court["team2"]
        w1, w2 = _team_weight(t1), _team_weight(t2)
        diff = abs(w1 - w2)
        diff_color = "#16a34a" if diff == 0 else "#d97706" if diff <= 1 else "#dc2626"
        balance_html = (
            f'<div style="display:flex;flex-direction:column;align-items:center;gap:0.2rem;flex-shrink:0;">'
            f'<span class="vs">VS</span>'
            f'<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;'
            f'font-weight:700;color:{diff_color};">△{diff}</span>'
            f'</div>'
        )
        return (
            f'<div class="court">'
            f'<div class="court-label">{label}</div>'
            f'<div class="match">'
            f'{team_block(t1, w1)}'
            f'{balance_html}'
            f'{team_block(t2, w2)}'
            f'</div>'
            f'</div>'
        )

    r = m["round"]
    return f'''
            <article class="round-card">
                <div class="round-header">
                    <span class="round-num">{r}</span>
                    라운드
                </div>
                <div class="courts">
                    {court_block(m["court1"], "코트 1")}
                    {court_block(m["court2"], "코트 2")}
                </div>
            </article>'''


def generate_debug_html(matches, title="4월 배드민턴 대회 : 디버그 대진표",
                        portraits: dict | None = None, portrait_base: str = ""):
    legend_items = "".join(
        f'<span style="display:inline-flex;align-items:center;gap:0.3rem;'
        f'font-size:0.75rem;font-weight:600;">'
        f'<span style="color:{fg};background:{bg};padding:0.1rem 0.45rem;'
        f'border-radius:2rem;border:1px solid {fg}33;">'
        f'{t.upper()}·{SKILL[t]}</span></span>'
        for t, (fg, bg) in _TIER_COLORS.items()
    )
    rounds_html = "\n".join(
        _render_debug_round(m, portraits or {}, portrait_base) for m in matches
    )
    return f'''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>배드민턴 대진표 (디버그)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg: #f8fafc; --bg-card: #ffffff; --bg-header: #f1f5f9;
            --accent: #0d9488; --text: #1e293b; --text-muted: #64748b;
            --border: #e2e8f0; --vs-color: #dc2626;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Noto Sans KR', -apple-system, sans-serif;
                background: var(--bg); color: var(--text);
                min-height: 100vh; padding: 2rem; line-height: 1.6; }}
        .container {{ max-width: 980px; margin: 0 auto; }}
        header {{ text-align: center; margin-bottom: 2rem; }}
        .badge {{ display: inline-block; background: #7c3aed; color: white;
                  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.15em;
                  padding: 0.4rem 1rem; border-radius: 2rem;
                  margin-bottom: 0.75rem; text-transform: uppercase; }}
        h1 {{ font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }}
        .legend {{ display: flex; gap: 0.5rem; justify-content: center;
                   flex-wrap: wrap; margin-top: 0.75rem; }}
        .round-grid {{ display: flex; flex-direction: column; gap: 1.25rem; }}
        .round-card {{ background: var(--bg-card); border: 1px solid var(--border);
                       border-radius: 10px; overflow: hidden;
                       box-shadow: 0 1px 3px rgba(0,0,0,0.06); }}
        .round-header {{ background: var(--bg-header); padding: 0.85rem 1.5rem;
                         font-size: 1rem; font-weight: 600; color: var(--text);
                         border-bottom: 1px solid var(--border);
                         display: flex; align-items: center; gap: 0.5rem; }}
        .round-num {{ font-family: 'JetBrains Mono', monospace;
                      background: var(--accent); color: white;
                      width: 32px; height: 32px; border-radius: 8px;
                      display: flex; align-items: center; justify-content: center;
                      font-size: 0.9rem; }}
        .courts {{ display: grid; grid-template-columns: 1fr 1fr; }}
        @media (max-width: 640px) {{ .courts {{ grid-template-columns: 1fr; }} }}
        .court {{ padding: 1.1rem 1.5rem; border-right: 1px solid var(--border); }}
        .court:last-child {{ border-right: none; }}
        .court-label {{ font-size: 0.75rem; font-weight: 600; color: var(--text-muted);
                        text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 0.6rem; }}
        .match {{ display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }}
        .team {{ display: flex; align-items: center; gap: 0.6rem; font-weight: 500; }}
        .player {{ display: flex; align-items: center; gap: 0.5rem;
                   background: var(--bg-header); padding: 0.35rem 0.65rem 0.35rem 0.4rem;
                   border-radius: 6px; border: 1px solid var(--border); }}
        .player-name {{ font-size: 0.95rem; font-weight: 500; color: var(--text); white-space: nowrap; }}
        .avatar {{ width: 28px; height: 28px; border-radius: 50%;
                   overflow: hidden; flex-shrink: 0; position: relative; }}
        .avatar img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
        .avatar-fallback {{ width: 100%; height: 100%; display: flex; align-items: center;
                            justify-content: center; color: #fff;
                            font-weight: 700; font-size: 0.7rem; }}
        .vs {{ font-family: 'JetBrains Mono', monospace; font-size: 0.7rem;
               font-weight: 700; color: var(--vs-color); flex-shrink: 0; }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="badge">Debug View</div>
            <h1>{title}</h1>
            <div class="legend">{legend_items}</div>
        </header>
        <div class="round-grid">
{rounds_html}
        </div>
    </div>
</body>
</html>'''


if __name__ == "__main__":
    portraits, portrait_base = fetch_portraits()
    output = capture_tournament_output()
    matches = parse_schedule(output)
    if not matches:
        print("Could not parse schedule. Raw output:", output[:500])
        sys.exit(1)

    html = generate_html(matches, portraits=portraits, portrait_base=portrait_base)
    with open("badminton-schedule.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Schedule saved to badminton-schedule.html")

    debug_html = generate_debug_html(matches, portraits=portraits, portrait_base=portrait_base)
    with open("badminton-schedule-debug.html", "w", encoding="utf-8") as f:
        f.write(debug_html)
    print("Debug schedule saved to badminton-schedule-debug.html")
