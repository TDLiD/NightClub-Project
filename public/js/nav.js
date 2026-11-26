/* nav.js — v83 모든 이동의 길찾기 보강 (혼자 걷기 · 파트너와 걷기 · 웨이터 에스코트 공통)
 *  문제: 손님 goTo·웨이터 walkTo 는 '구역 경유점'(통로·VIP 문 앞 등)만 정하고 그 사이는 직선으로 걸었음
 *        → 직선 위에 탁자·의자가 있으면 충돌에 밀려 제자리 걸음(헛걸음)을 하거나, 1.2초 뒤 그 경유점을 건너뛰며 엉뚱하게 감.
 *  해결:
 *   ① refine(): 경유점 사이 직선이 막혀 있으면(격자 시야 검사) 그 구간만 격자 A*(pathfind.js) 경로로 바꿔 끼움 → 탁자·의자·기둥을 돌아감
 *   ② unstick(): 걷는데 1초 동안 거의 못 나아가면 → 지금 위치에서 최종 목적지까지 A* 로 다시 찾음.
 *      두 번째부터는 진행 방향 옆(막히지 않은 쪽) 0.5m 로 한 걸음 비켜 선 뒤 다시 찾고, 네 번째면 가장 가까운 빈 자리로 살짝 옮겨 줌
 *   ③ 사람끼리는 crowd.js(비켜 가기·겹침 금지)가 맡음
 *  NC.Nav = { refine(from, pts), unstick(agent, dt), stats }
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const Nav = NC.Nav = { stats: { refined: 0, repath: 0, side: 0, snap: 0 } };
const PF = () => NC.Path;

/* 목적지가 탁자(의자 포함 반지름 2.3m)·벽 안이면 가장 가까운 빈 자리로 — 웨이터가 탁자 쪽 손님 자리로 가려다 탁자에 막혀 제자리 걸음하던 주원인 */
Nav.fixGoal = p => { const Pa = PF(); if (!Pa || !Pa.isBlocked || !p || !Pa.isBlocked(p.x, p.z)) return p; const f = Pa.free && Pa.free(p.x, p.z); if (f) { Nav.stats.goal = (Nav.stats.goal || 0) + 1; return { x: f.x, z: f.z }; } return p; };
Nav.refine = (from, pts) => {
  const Pa = PF(); if (!Pa || !Pa.find || !pts || !pts.length) return pts;
  pts = pts.slice(); pts[pts.length - 1] = Nav.fixGoal(pts[pts.length - 1]);
  const out = []; let a = { x: from.x, z: from.z };
  for (const p of pts) {
    if (Pa.los && !Pa.los(a, p)) { const sub = Pa.find(a, p, { exact: !(Pa.isBlocked && Pa.isBlocked(p.x, p.z)) }); if (sub && sub.length) { sub.forEach(q => out.push(q)); a = out[out.length - 1]; Nav.stats.refined++; continue; } }
    out.push(p); a = p;
  }
  return out;
};
/* 걷는 중 호출: 진행이 막혔으면 경로를 고쳐 줌 → true 를 돌려주면 '고쳤음' */
Nav.unstick = (o, dt) => {
  const s = o._nav || (o._nav = { t: 0, x: o.x, z: o.z, n: 0 });
  s.t += dt; if (s.t < 1.0) return false;
  const moved = Math.hypot(o.x - s.x, o.z - s.z); s.t = 0; s.x = o.x; s.z = o.z;
  if (moved > .18) { s.n = 0; return false; }
  const Pa = PF(), path = o.path; if (!Pa || !path || !path.length) return false;
  let goal = path[path.length - 1]; s.n++;
  { const g2 = Nav.fixGoal(goal); if (g2 !== goal) { goal = g2; path[path.length - 1] = g2; if (Math.hypot(o.x - g2.x, o.z - g2.z) < .7) { path.length = 0; return true; } } }   // 못 가는 곳이면 근처에서 도착 처리
  if (s.n >= 4) { const f = Pa.free && Pa.free(o.x, o.z); if (f) { o.x = f.x; o.z = f.z; Nav.stats.snap++; } s.n = 0; }
  else if (s.n >= 2) {   // 옆으로 한 걸음
    const nx = path[0].x - o.x, nz = path[0].z - o.z, l = Math.hypot(nx, nz) || 1, rx = -nz / l, rz = nx / l;
    for (const sd of [1, -1]) { const q = { x: o.x + rx * .5 * sd, z: o.z + rz * .5 * sd }; if (!(Pa.isBlocked && Pa.isBlocked(q.x, q.z))) { path.unshift(q); Nav.stats.side++; return true; } } }
  const np = Pa.find({ x: o.x, z: o.z }, goal, { exact: !(Pa.isBlocked && Pa.isBlocked(goal.x, goal.z)) });
  if (np && np.length) { o.path = np; Nav.stats.repath++; return true; }
  return false;
};
/* v84 자유의지: 옵션·부킹·안내가 끝났는데 아무도 '쥐고 있지 않은' 사람이 멈춰 서 있으면 다시 스스로 돌아다니게
 *  · 손님: 'idle'(도착 후 할 일 없음) 8초 · 'escort'(안내받던 중 손 놓음) 10초 넘게 멈춰 있으면 → 부킹 표시를 풀고 돌아다님
 *    (대화 중·블루스·같이 걷기·웨이터가 데려가는 중·노래방 룸 손님·이벤트 참가·앉아 있는 사람은 그대로)
 *  · 웨이터: 메뉴도 이동도 안내도 아닌데 '바쁨' 상태로 20초 넘게 서 있으면 → 바쁨을 풀어 자기 자리/순찰로 돌아감 */
function owned(n) {
  const D = NC.Dialog && NC.Dialog.cur, K = NC.Karaoke;
  return (D && D.n === n) || (K && K.BL && K.BL.n === n) || (NC.PairWalk && NC.PairWalk.n === n) || n._escortBy || n._dk || n._sd || n._bring || n.roomGuest
    || (K && K.inRoom && (K.guests || []).includes(n)) || (NC.Motel && NC.Motel.on && NC.Motel.n === n) || n.party || n.stay === 'smoke' || n.stay === 'outing' || n.stay === 'arrest';
}
let fwT = 0;
function freeWill(dt) {
  fwT += dt; if (fwT < .5) return; const step = fwT; fwT = 0;
  for (const n of NC.npcs || []) { const u = n.g && n.g.userData; if (!u || n.enabled === false) continue;
    const stuck = (n.state === 'idle' || (n.state === 'escort' && !u.moving)) && !u.seated && !owned(n);
    n._fw = stuck ? (n._fw || 0) + step : 0;
    if (n._fw > (n.state === 'escort' ? 10 : 8)) { n._fw = 0; if (!n.bookSeat) n.booked = false; if (n.stay === 'escortW') n.stay = null; n.state = 'wander'; n.pause = 1 + Math.random() * 3; n.wp = null; n.wpath = null; n.path = null; u.lookAt = null; Nav.stats.freed = (Nav.stats.freed || 0) + 1; } }
  const S = NC.Service, cur = S && S.cur;
  for (const o of (NC.Waiters && NC.Waiters.list) || []) { const idleBusy = o.busy && o.state !== 'path' && o.state !== 'lead' && !(cur && cur.o === o) && !(NC.ui && NC.ui.dlgOpen && NC.ui.dlgOpen());
    o._fw = idleBusy ? (o._fw || 0) + step : 0;
    if (o._fw > 20) { o._fw = 0; o.busy = false; o.state = 'idle'; o.g.userData.lookAt = null; if (S && !cur && S.unbusy) S.unbusy(); Nav.stats.waiterFreed = (Nav.stats.waiterFreed || 0) + 1; } }
}
(NC.tickers = NC.tickers || []).push(dt => { try { freeWill(Math.min(dt || .016, .2)); } catch (e) { console.warn('[nav freewill]', e); } });
console.info('[nav] v84 길찾기 보강 (A* 구간 보정 · 막힘 재탐색) · 자유의지(할 일 끝나면 다시 돌아다님)');
})();
