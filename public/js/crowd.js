/* crowd.js — v79 캐릭터끼리 부딪히지 않기 · 자연스럽게 비켜 가기
 *  문제: 손님·플레이어·웨이터의 이동은 벽·탁자(NC.collide)만 피했고 '다른 사람'은 몰랐음 → 서로 몸을 통과해 지나감.
 *  해결(매 프레임, 모든 이동이 끝난 뒤 · 렌더 직전, 모든 사람 쌍 검사 — 80명 ≈ 3,200쌍, 가벼움):
 *   ① 겹침 금지: 두 사람 몸통 반지름 합(약 0.5m)보다 가까우면 서로 밀어냄. 걷는 사람·서 있는 사람·플레이어 비율로 나눠 밀고,
 *      밀린 뒤에는 다시 벽·탁자 충돌을 적용 → 벽 속으로 밀려 들어가지 않음
 *   ② 비켜 가기: 걷는 사람은 진행 방향 앞 1.7m 안(좌우 0.75m 폭)에 있는 사람을 보고 미리 옆으로 비켜 감.
 *      마주 오는 두 사람은 둘 다 자기 오른쪽으로 비켜 자연스럽게 엇갈림 · 바로 앞에 서 있는 사람에게는 속도를 줄임
 *   ③ 일부러 붙어 있는 쌍은 제외: 블루스(플레이어·손님 커플), 같이 걷기, 웨이터 에스코트(손잡기), 둘이 춤추기, 헹가래, 모텔
 *   ④ 앉아 있는 사람·무대 위 공연·숨겨진 손님은 계산에서 뺌
 *  NC.Crowd = { on, stats, R } — ?nocrowd=1 이면 끔(비교 시험용)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.THREE) return;
const U = NC.util;
const C = NC.Crowd = { on: !/[?&]nocrowd=1/.test(location.search), R: .25, LOOK: 1.7, WIDE: .75, stats: { pairs: 0, push: 0, steer: 0, maxPen: 0 } };
const SKIP_ST = new Set(['off', 'seated', 'motel', 'stage', 'ep', 'kara', 'karaoke', 'bath']);
const A = [];   // 이번 프레임 사람 목록
function agents() {
  A.length = 0; const P = NC.player, K = NC.Karaoke, BL = K && K.BL, DK = NC.DanceKing, tossing = DK && DK.phase === 'toss';
  if (P && P.group && P.group.visible && !P.seat && !(NC.Motel && NC.Motel.on) && !(K && K.inRoom && P.busy))
    A.push({ o: P, g: P.group, me: true, mov: !!P.group.userData.moving || !!P.autoPath, w: .3, r: C.R });
  for (const n of NC.npcs || []) {
    const g = n.g, u = g && g.userData; if (!u || !g.visible || n.enabled === false || SKIP_ST.has(n.state) || u.seated) continue;
    if (tossing && n._dk) continue;
    const mov = !!u.moving && (n.state === 'wander' || n.state === 'path' || n.state === 'escort' || n.state === 'party');
    A.push({ o: n, g, n, mov, w: mov ? 1 : n.state === 'talk' || n.state === 'dk' || n.state === 'dshow' ? .35 : .7, r: C.R * (u.look && u.look.body === 'plus' ? 1.15 : 1) });
  }
  for (const w of (NC.Escort && NC.Escort.list) || []) { if (!w.g || !w.g.visible || w.state === 'idle') continue; A.push({ o: w, g: w.g, esc: w, mov: w.state !== 'greet' && w.state !== 'intro', w: .8, r: C.R }); }
  return { P, BL, pw: NC.PairWalk && NC.PairWalk.n, sd: NC.DanceShow && NC.DanceShow.on && NC.DanceShow.on.n, mo: NC.Motel && NC.Motel.on && NC.Motel.n };
}
/* 일부러 붙어 있는 쌍인가 */
function linked(a, b, X) {
  if (a.me || b.me) { const o = a.me ? b : a, n = o.n; if (!n) return !!(o.esc && false);
    return n === X.pw || n === (X.BL && X.BL.n) || n === X.sd || n === X.mo || n.state === 'escort' && X.pw === n; }
  if (a.esc || b.esc) { const w = a.esc || b.esc, o = a.esc ? b : a; return !!(o.n && (w.n === o.n || o.n._escortBy === w)); }
  const ua = a.g.userData, ub = b.g.userData;
  if (ua.dance === 'blues' && ub.dance === 'blues') return true;           // 파티 블루스 커플
  if (a.n.state === 'party' && b.n.state === 'party' && Math.hypot(a.o.x - b.o.x, a.o.z - b.o.z) < .7) return true;
  return false;
}
function place(ag) {   // 밀린 위치 반영 + 벽·탁자 충돌
  const o = ag.o; NC.collide && NC.collide(o, .34);
  ag.g.position.x = o.x; ag.g.position.z = o.z;
}
function tick(dt) {
  if (!C.on || !NC.started) return; dt = Math.min(dt || .016, .05);
  const X = agents(), N = A.length; let pairs = 0, push = 0, steer = 0, maxPen = 0;
  /* ② 비켜 가기(걷는 사람만) */
  for (let i = 0; i < N; i++) {
    const a = A[i]; if (!a.mov || a.me && !a.o.autoPath) continue;   // 플레이어는 클릭 이동(자동 경로)일 때만 비켜 감 — 키보드는 직접 조종
    const yaw = a.g.rotation.y, hx = Math.sin(yaw), hz = Math.cos(yaw), rx = hz, rz = -hx; let sx = 0, slow = 0;
    for (let j = 0; j < N; j++) { if (j === i) continue; const b = A[j], dx = b.o.x - a.o.x, dz = b.o.z - a.o.z, along = dx * hx + dz * hz; if (along <= 0 || along > C.LOOK) continue;
      const lat = dx * rx + dz * rz, wide = C.WIDE + b.r; if (Math.abs(lat) > wide || linked(a, b, X)) continue;
      const wA = (1 - along / C.LOOK) * (1 - Math.abs(lat) / wide);
      const byh = b.g.rotation.y, headOn = b.mov && (Math.sin(byh) * hx + Math.cos(byh) * hz) < -.5;
      const side = headOn ? -1 : Math.abs(lat) < .08 ? ((a.o.id || i) % 2 ? 1 : -1) : -Math.sign(lat);   // 마주 오면 둘 다 오른쪽(-right=왼쪽 반대) — 이 좌표계에선 -1 이 진행 방향 기준 오른쪽
      sx += side * wA; if (along < .9 && Math.abs(lat) < .5 && !(b.mov && (Math.sin(byh) * hx + Math.cos(byh) * hz) > .6)) slow = Math.max(slow, 1 - along / .9); }
    if (sx || slow) { const spd = a.me ? 2.2 : (a.o.speed || 1.4), k = U.clamp(sx, -1.4, 1.4) * spd * .55 * dt;
      a.o.x += rx * k - hx * slow * spd * .6 * dt; a.o.z += rz * k - hz * slow * spd * .6 * dt; place(a); steer++; }
  }
  /* ① 겹침 풀기(2회 반복이면 3~4명 뭉침도 풀림) */
  for (let it = 0; it < 2; it++) for (let i = 0; i < N; i++) { const a = A[i];
    for (let j = i + 1; j < N; j++) { const b = A[j], dx = b.o.x - a.o.x, dz = b.o.z - a.o.z, min = a.r + b.r; if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d2 = dx * dx + dz * dz; if (d2 >= min * min) continue; pairs++; if (linked(a, b, X)) continue;
      const d = Math.sqrt(d2) || 1e-4, pen = min - d, nx = d > 1e-4 ? dx / d : Math.cos(i * 2.39), nz = d > 1e-4 ? dz / d : Math.sin(i * 2.39), s = a.w + b.w, ka = a.w / s, kb = b.w / s;
      a.o.x -= nx * pen * ka; a.o.z -= nz * pen * ka; b.o.x += nx * pen * kb; b.o.z += nz * pen * kb; place(a); place(b); push++; if (pen > maxPen) maxPen = pen; } }
  C.stats.pairs = pairs; C.stats.push = push; C.stats.steer = steer; C.stats.maxPen = +maxPen.toFixed(3); C.stats.n = N;
}
NC.tickers.push(dt => { try { tick(dt); } catch (e) { console.error('[crowd]', e); C.on = false; } });
/* 측정용: 지금 서로 겹친(통과 중인) 쌍 수 */
C.overlaps = (lim = .4) => { const X = agents(); let c = 0; for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const a = A[i], b = A[j]; if (Math.hypot(a.o.x - b.o.x, a.o.z - b.o.z) < lim && !linked(a, b, X)) c++; } return c; };
console.info('[crowd] v79 사람끼리 충돌·비켜 가기');
})();
