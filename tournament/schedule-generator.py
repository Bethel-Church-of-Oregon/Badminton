"""
Generates a beautiful HTML match schedule by running badminton-match.py
and parsing its output. Does NOT modify the original script.
"""
import sys
import re
from io import StringIO
from pathlib import Path
import importlib.util


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


def generate_html(matches, title="3월 배드민턴 대회 : 8라운드 전체 대진표"):
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
            gap: 0.35rem;
            font-weight: 500;
            font-size: 1.05rem;
        }}

        .team span {{
            background: var(--bg-header);
            color: var(--text);
            padding: 0.4rem 0.75rem;
            border-radius: 6px;
            border: 1px solid var(--border);
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
            <div class="badge">March Tournament</div>
            <h1>{title}</h1>
        </header>

        <div class="round-grid">
''' + '\n'.join(_render_round(m) for m in matches) + '''
        </div>
    </div>
</body>
</html>'''


def _render_round(m):
    def team_html(team):
        return ' '.join(f'<span>{p}</span>' for p in team)

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


if __name__ == "__main__":
    output = capture_tournament_output()
    matches = parse_schedule(output)
    if not matches:
        print("Could not parse schedule. Raw output:", output[:500])
        sys.exit(1)
    html = generate_html(matches)
    out_path = "badminton-schedule.html"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Schedule saved to {out_path}")
