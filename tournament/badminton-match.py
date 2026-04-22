import random
from collections import defaultdict

# -----------------------------------------------------------------------------
# Tournament rules (hard constraints + soft preferences)
# -----------------------------------------------------------------------------
#
# HARD — teammate / pair legality (_valid_doubles_pair, _allowed_teammates):
#   - No A+A on the same team (A players meet only as opponents across the net).
#   - No A+B or A+C on the same team.
#   - No B+B on the same team.
#   - No E+E on the same team.
#   - No F+F (two (f) players cannot be partners — mixed doubles only).
#   - No repeat partners: pairs in played_together cannot team again.
#
# HARD — who can be in the playing eight each round (pick_playing_eight):
#   - Gender: among the 8, female count ≤ 4 so legal mixed pairs exist.
#   - Pool must admit a full legal 4-team split (backtracking feasibility).
#
# STRUCTURE:
#   - 16 players total; 8 rounds; 8 players on court per round (2 courts × 2 doubles).
#   - Each player plays exactly 4 rounds (fairness checked at end).
#   - Selection favors those with fewer games so far (min play_count first).
#
# TIERS / SKILL weights (for balance only): a=5 > b=4 > c=3 > d=2 > e=1
#
# SOFT — matchup choice (balanced_teams_and_matchups, _best_order_from_teams):
#   - Prefer fewer past cross-net meetings (opponent_counts).
#   - Prefer lower max repeat vs same opponent on a court.
#   - Prefer similar total team strength per court (|sum skill left − right|).
#   - Tie-break: prefer more A-vs-A edges across the net.
# -----------------------------------------------------------------------------

# Skill weights for balancing: a > b > c > d > e
SKILL = {"a": 5, "b": 4, "c": 3, "d": 2, "e": 1}


def get_visual_width(text):
    """한글 2칸, 영문 1칸으로 계산한 시각적 너비 반환"""
    width = 0
    for char in text:
        if ord("가") <= ord(char) <= ord("힣"):
            width += 2
        else:
            width += 1
    return width


def fill_space(text, target_width):
    """목표 너비에 맞게 뒤에 공백을 채움"""
    return text + " " * (target_width - get_visual_width(text))


def display_name(name):
    """스케줄 출력용: (m)/(f) 제거"""
    if "(m)" in name:
        return name.replace("(m)", "").strip()
    if "(f)" in name:
        return name.replace("(f)", "").strip()
    return name


def is_female(name):
    """이름에 (f)가 포함되면 여성"""
    return "(f)" in name


def _allowed_teammates(p1, p2, tiers):
    """
    A조끼리는 같은 팀 불가 → A는 A를 파트너로만 두지 않고, 네트 건너 상대로만 만남.
    a는 b·c와 같은 팀 불가. b끼리 같은 팀 불가.
    """
    t1, t2 = tiers[p1], tiers[p2]
    if t1 == "a" and t2 == "a":
        return False
    if "a" in (t1, t2) and ("b" in (t1, t2) or "c" in (t1, t2)):
        return False
    if t1 == "b" and t2 == "b":
        return False
    return True


def tier_map_from_lists(a, b, c, d, e):
    """이름 -> 'a'|'b'|'c'|'d'|'e'"""
    m = {}
    for p in a:
        m[p] = "a"
    for p in b:
        m[p] = "b"
    for p in c:
        m[p] = "c"
    for p in d:
        m[p] = "d"
    for p in e:
        m[p] = "e"
    return m


def _pool_gender_ok_for_play(pool):
    """f+f 없이 짝 지으려면 여성 수 ≤ 남성 수(8명 중 여성 최대 4)."""
    return sum(1 for p in pool if is_female(p)) <= 4


def _pool_structurally_feasible(pool, tiers, played_together):
    """a–b/c·a+a·e+e·f+f·과거 파트너 제약 하에 4팀을 만들 수 있는지."""
    return _pairing_backtrack(list(pool), tiers, played_together) is not None


def _tier_a_cross_net_edge_count(order, tiers):
    """코트 배치 order에서 네트 건너 (A, A)인 쌍의 수 — A끼리는 이렇게만 맞붙도록 선호."""
    n = 0
    for i, j in ((0, 2), (0, 3), (1, 2), (1, 3), (4, 6), (4, 7), (5, 6), (5, 7)):
        if tiers[order[i]] == "a" and tiers[order[j]] == "a":
            n += 1
    return n


def pick_playing_eight(all_players, play_count, played_together, tiers, games_per_player=4):
    """
    출전 8명: 출전 횟수가 적은 사람 우선, 성별 OK, 그리고 티어·파트너 제약으로
    복식 4팀을 실제로 짤 수 있는 조합만 채택(백트래킹 검사).
    """
    eligible = [p for p in all_players if play_count[p] < games_per_player]
    if len(eligible) < 8:
        raise RuntimeError(
            f"출전 가능 인원이 8명 미만입니다 ({len(eligible)}명). play_count를 확인하세요."
        )

    if len(eligible) == 8:
        pool = list(eligible)
        if not _pool_gender_ok_for_play(pool):
            raise RuntimeError(
                "마지막 라운드 출전 8명 중 여성이 남성보다 많아 f+f 없이 짝을 짤 수 없습니다."
            )
        if not _pool_structurally_feasible(pool, tiers, played_together):
            raise RuntimeError(
                "마지막 라운드: 남은 8명으로 티어·파트너 제약을 만족하는 팀을 짤 수 없습니다."
            )
        return pool

    min_c = min(play_count[p] for p in eligible)
    primary = [p for p in eligible if play_count[p] == min_c]
    secondary = [p for p in eligible if play_count[p] > min_c]
    random.shuffle(primary)
    random.shuffle(secondary)

    if len(primary) >= 8:
        for _ in range(2000):
            pool = random.sample(primary, 8)
            if _pool_gender_ok_for_play(pool) and _pool_structurally_feasible(
                pool, tiers, played_together
            ):
                return pool
    else:
        need = 8 - len(primary)
        if need > len(secondary):
            raise RuntimeError("출전 인원 조합 오류(1차·2차 그룹).")
        for _ in range(2000):
            pool = primary + random.sample(secondary, need)
            if _pool_gender_ok_for_play(pool) and _pool_structurally_feasible(
                pool, tiers, played_together
            ):
                return pool

    for _ in range(3000):
        pool = random.sample(eligible, 8)
        if _pool_gender_ok_for_play(pool) and _pool_structurally_feasible(
            pool, tiers, played_together
        ):
            return pool
    raise RuntimeError(
        "이번 라운드 출전 8명을 고를 수 없습니다. (성별·티어·파트너 제약)"
    )


def team_strength(pair, tiers):
    return SKILL[tiers[pair[0]]] + SKILL[tiers[pair[1]]]


def _cross_net_opponent_score(team_left, team_right, opponent_counts):
    """이미 맞붙은 적 있는 상대 쌍의 가중 합 (낮을수록 새로운 만남 선호)."""
    s = 0
    for pa in team_left:
        for pb in team_right:
            s += opponent_counts[frozenset({pa, pb})]
    return s


def _cross_net_max_repeat(team_left, team_right, opponent_counts):
    """이 경기에서 양 팀 간 상대 쌍 중 과거 만남 횟수 최대값."""
    m = 0
    for pa in team_left:
        for pb in team_right:
            m = max(m, opponent_counts[frozenset({pa, pb})])
    return m


MAX_TEAM_WEIGHT_DIFF = 2  # hard cap: |team_left_strength - team_right_strength| <= this


def _best_order_from_teams(teams, opponent_counts, tiers):
    """
    teams: 길이 4의 (p1,p2) 튜플 리스트.
    4팀을 2경기로 나누는 3가지 중에서 (1) 과거 상대 횟수 합 최소 (2) 최대 반복 상대 최소
    (3) 코트별 팀 가중합 차 최소 (4) A끼리 네트 맞대결(A–A 엣지) 최대화.
    팀 가중합 차가 MAX_TEAM_WEIGHT_DIFF 초과인 코트 배치는 제외 (하드 제약).
    반환: (order, opponent_score, max_repeat, matchup_balance) 또는 None
    """
    best_order = None
    best_key = None
    # 3가지 대진: (0,1)(2,3), (0,2)(1,3), (0,3)(1,2)
    for (i, j), (k, el) in (((0, 1), (2, 3)), ((0, 2), (1, 3)), ((0, 3), (1, 2))):
        ta, tb = teams[i], teams[j]
        tc, td = teams[k], teams[el]
        sa, sb = team_strength(ta, tiers), team_strength(tb, tiers)
        sc, sd = team_strength(tc, tiers), team_strength(td, tiers)
        if abs(sa - sb) > MAX_TEAM_WEIGHT_DIFF or abs(sc - sd) > MAX_TEAM_WEIGHT_DIFF:
            continue
        balance = abs(sa - sb) + abs(sc - sd)
        oscore = _cross_net_opponent_score(ta, tb, opponent_counts) + _cross_net_opponent_score(
            tc, td, opponent_counts
        )
        max_rep = max(
            _cross_net_max_repeat(ta, tb, opponent_counts),
            _cross_net_max_repeat(tc, td, opponent_counts),
        )
        order = [ta[0], ta[1], tb[0], tb[1], tc[0], tc[1], td[0], td[1]]
        a_net = _tier_a_cross_net_edge_count(order, tiers)
        key = (oscore, max_rep, balance, -a_net)
        if best_key is None or key < best_key or (key == best_key and random.random() < 0.5):
            best_key = key
            best_order = order
    if best_order is None:
        return None
    return best_order, best_key[0], best_key[1], best_key[2]


def _skill_spread(teams, tiers):
    sts = [team_strength(t, tiers) for t in teams]
    return max(sts) - min(sts)


def _valid_doubles_pair(p, q, tiers, played_together):
    """복식 한 팀으로 가능한지 (f+f, e+e, a+a·a–b/c는 _allowed_teammates, 과거 파트너 제외)."""
    if is_female(p) and is_female(q):
        return False
    if tiers[p] == "e" and tiers[q] == "e":
        return False
    if not _allowed_teammates(p, q, tiers):
        return False
    if frozenset({p, q}) in played_together:
        return False
    return True


def _pairing_backtrack(players, tiers, played_together):
    """8명을 제약을 만족하는 4쌍으로 나누거나 None (탐색)."""
    ps = list(players)
    if len(ps) != 8:
        return None

    def dfs(rem, acc):
        if not rem:
            return acc
        p = rem[0]
        for i in range(1, len(rem)):
            q = rem[i]
            if _valid_doubles_pair(p, q, tiers, played_together):
                nxt = [rem[j] for j in range(1, len(rem)) if j != i]
                r = dfs(nxt, acc + [(p, q)])
                if r is not None:
                    return r
        return None

    return dfs(ps, [])


def _greedy_four_teams(players, tiers, played_together):
    """빠른 휴리스틱. 실패 시 None."""
    teams = []
    f_players = [p for p in players if is_female(p)]
    m_players = [p for p in players if not is_female(p)]
    used_m = set()

    random.shuffle(f_players)
    for f_p in f_players:
        candidates = [
            p
            for p in m_players
            if p not in used_m
            and frozenset({f_p, p}) not in played_together
            and _allowed_teammates(f_p, p, tiers)
        ]
        if not candidates:
            return None
        # 약한(보통 e에 가까운) 남성 우선 → 여성이 강한 남만 쓰면 남는 남성이 전부 e가 되어 e+비e 짝이 불가능해질 수 있음
        candidates.sort(key=lambda p: SKILL[tiers[p]])
        partner = candidates[0]
        used_m.add(partner)
        teams.append((f_p, partner))

    remaining = [p for p in m_players if p not in used_m]
    e_players = [p for p in remaining if tiers[p] == "e"]
    ne_players = [p for p in remaining if tiers[p] != "e"]
    used_ne = set()

    random.shuffle(e_players)
    for e_p in e_players:
        candidates = [
            p
            for p in ne_players
            if p not in used_ne
            and frozenset({e_p, p}) not in played_together
            and _allowed_teammates(e_p, p, tiers)
        ]
        if not candidates:
            return None
        candidates.sort(key=lambda p: SKILL[tiers[p]], reverse=True)
        partner = candidates[0]
        used_ne.add(partner)
        teams.append((e_p, partner))

    remaining = [p for p in ne_players if p not in used_ne]
    while len(remaining) >= 2:
        remaining.sort(key=lambda p: SKILL[tiers[p]], reverse=True)
        hi = remaining.pop(0)
        valid = [
            p
            for p in remaining
            if frozenset({hi, p}) not in played_together
            and _allowed_teammates(hi, p, tiers)
        ]
        if not valid:
            return None
        valid.sort(key=lambda p: SKILL[tiers[p]])
        lo = valid[0]
        remaining.remove(lo)
        teams.append((hi, lo))

    if len(teams) != 4:
        return None
    return teams


def _build_four_teams(players, tiers, played_together):
    """a+a·e+e 금지, a는 b·c와 팀 불가. 그리디 후 필요 시 백트래킹."""
    players = list(players)
    g = _greedy_four_teams(players, tiers, played_together)
    if g is not None:
        return g
    return _pairing_backtrack(players, tiers, played_together)


def balanced_teams_and_matchups(
    pool, tiers, played_together, opponent_counts, attempts=384
):
    """
    8명 -> 4개 팀(2인조), 코트 2개.
    a끼리 같은 팀 금지(a+a 금지) → A는 A를 파트너로 두지 않고 상대로만 맞붙음.
    e끼리 같은 팀 금지(e+e 금지), f+f 금지, a는 b·c와 같은 팀 불가.
    이전 라운드에서 같은 팀(한쪽)이었던 두 사람은 다시 짝이 되지 않음 — played_together에
    들어 있는 두 명은 새 팀을 만들 때 제외함.
    가능한 한 **새로운 상대**를 만나도록 (과거 상대 횟수 합·최대 반복 최소화), 코트별 팀 가중합도 비슷하게,
    동점이면 A–A 네트 맞대결을 더 많이 쓰는 대진을 고름.
    """
    best_order = None
    best_key = None  # (oscore, max_rep, mbal, spread, -a_net) 낮을수록 좋음

    for _ in range(attempts):
        players = list(pool)
        random.shuffle(players)
        teams = _build_four_teams(players, tiers, played_together)
        if not teams:
            continue
        result = _best_order_from_teams(teams, opponent_counts, tiers)
        if result is None:
            continue
        order, oscore, max_rep, mbal = result
        spread = _skill_spread(teams, tiers)
        a_net = _tier_a_cross_net_edge_count(order, tiers)
        key = (oscore, max_rep, mbal, spread, -a_net)
        if best_key is None or key < best_key or (key == best_key and random.random() < 0.5):
            best_key = key
            best_order = order

    return best_order


def record_round_opponents(order, opponent_counts):
    """한 라운드에서 네트 건너 상대였던 쌍의 카운트를 +1."""
    for a, b in ((0, 2), (0, 3), (1, 2), (1, 3)):
        opponent_counts[frozenset({order[a], order[b]})] += 1
    for a, b in ((4, 6), (4, 7), (5, 6), (5, 7)):
        opponent_counts[frozenset({order[a], order[b]})] += 1


def generate_tournament():
    # ---------------------------------------------------------
    # 1. 플레이어 명단 (2글자 한글 이름 직접 수정)
    # ---------------------------------------------------------
    a = ["대한(m)", "창영(m)", "한준(m)"]
    b = ["지성(m)", "정훈(m)", "시영(m)"]
    c = ["건우(m)", "건수(m)", "우진(m)"]
    d = ["수빈(f)", "은혜(f)", "경록(m)", "민오(m)", "혜영(f)", "강형(m)"]
    e = ["재욱(m)"]
    # ---------------------------------------------------------

    all_players = a + b + c + d + e
    if len(all_players) != 16:
        print(f"\n[오류] 인원 부족 ({len(all_players)}/16)")
        return

    tiers = tier_map_from_lists(a, b, c, d, e)

    # 구분선 설정
    line = "=" * 90
    sub_line = "-" * 90

    print(line)
    print(f"{'4월 배드민턴 대회 : 8라운드 전체 대진표':^84}")
    print(line)
    # 헤더 정렬 (수동 간격 조정)
    print(f" 라운드 |               코트 1               |               코트 2")
    print("=" * 90)

    # 3. 8라운드 — 매 라운드 16명 중 8명 출전. 풀 A/B 고정 분리 없음.
    #    출전조는 성별·티어·파트너 제약으로 짝이 될 수 있는지 먼저 검사.
    played_together = set()
    opponent_counts = defaultdict(int)
    play_count = {p: 0 for p in all_players}
    appear = defaultdict(int)
    for r in range(1, 9):
        p = None
        current_pool = None
        for _ in range(4000):
            try:
                current_pool = pick_playing_eight(
                    all_players, play_count, played_together, tiers
                )
            except RuntimeError:
                current_pool = None
            if current_pool is None:
                continue
            p = balanced_teams_and_matchups(
                current_pool, tiers, played_together, opponent_counts
            )
            if p is not None:
                for pl in current_pool:
                    play_count[pl] += 1
                    appear[pl] += 1
                break
        if p is None:
            print(f"\n[오류] 라운드 {r}: 출전조·대진을 만들 수 없습니다.")
            return
        for i in range(0, 8, 2):
            played_together.add(frozenset({p[i], p[i + 1]}))
        record_round_opponents(p, opponent_counts)

        t1 = f"{display_name(p[0])}, {display_name(p[1])}"
        t2 = f"{display_name(p[2])}, {display_name(p[3])}"
        t3 = f"{display_name(p[4])}, {display_name(p[5])}"
        t4 = f"{display_name(p[6])}, {display_name(p[7])}"
        c1_left = fill_space(t1, 13)
        c1_right = fill_space(t2, 13)
        c2_left = fill_space(t3, 13)
        c2_right = fill_space(t4, 13)
        row = f"   {r}    |   {c1_left} vs   {c1_right} |   {c2_left} vs   {c2_right}"
        print(row)
        print(sub_line)

    uneven = [pl for pl in all_players if appear[pl] != 4]
    if uneven:
        print("\n[경고] 출전 횟수가 4회가 아닌 사람:")
        for pl in uneven:
            print(f"   {display_name(pl)}: {appear[pl]}회 (내부키: {pl})")
    else:
        print("\n(출전 확인: 전원 4라운드씩 출전)")


if __name__ == "__main__":
    generate_tournament()
