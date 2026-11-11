/* contact.js — v26 두 캐릭터 접촉 사실화 (껴안기 · 이마 맞대기 · 키스 · 백허그 · 부르스 · 딥 …)
 *
 *  문제: 부르스/스킨십 자세는 '표준 체형·표준 거리'로 미리 구한 관절 각도라, 키·체격이 다른 두 사람이 붙으면
 *        팔이 상대 배·등을 관통하고, 이마·가슴이 서로 파고들었다.
 *  해결(매 프레임, 모든 포즈가 정해진 뒤 · 렌더 직전):
 *   ① 몸통 간격: 두 사람의 가슴·골반·머리 실제 위치로 '필요한 최소 거리'를 재서 모자라면 두 사람을 살짝 벌림
 *      → 가슴은 맞닿고(약간 눌림 허용) 이마는 딱 붙는 거리
 *   ② 팔 관통: 상대 몸통(타원 기둥)·머리(구)를 장애물로 보고, 위팔·팔꿈치·아래팔·손 점이 안으로 들어가면
 *      어깨·팔꿈치 각도를 조금씩 바꿔(수치 경사) 바깥으로 빼냄 — 보정값은 u.cfix 에 저장돼 motion.js 가 다음 프레임 목표 자세에 더함
 *   ③ 손 밀착: 안기·허리 감기 같은 '감싸는' 동작이면 손이 상대 몸 표면에서 떠 있지 않게 살짝 끌어당김
 *   ④ 보정이 필요 없어지면 보정값이 천천히 0 으로 돌아가 원래 안무 자세로 복귀
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.THREE) return;
const T = NC.THREE, V = () => new T.Vector3();
const tmp = { a: V(), b: V(), c: V(), d: V(), e: V(), s: V(), h: V() };
const ARMS = [['shL', 'elL'], ['shR', 'elR']];
const EMBRACE = new Set(['hug', 'waist', 'kiss', 'deepkiss', 'backhug', 'dip', 'neck']);

/* 몸 모델(월드 좌표) */
function body(g) {
  const u = g.userData, R = u.rig; if (!R) return null;
  const hips = R.hips.getWorldPosition(V()), neck = R.neck.getWorldPosition(V()), head = R.head.localToWorld(new T.Vector3(0, .095, .012)), chest = R.torso.getWorldPosition(V());   // 머리 = 두개골 중심(관절 위 9.5cm)
  R.torso.getWorldScale(tmp.s); const sc = tmp.s.x, fem = u.look && u.look.gender === 'f';
  const ry = g.rotation.y, fwd = new T.Vector3(Math.sin(ry), 0, Math.cos(ry)), right = new T.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  chest.lerp(neck, .55);   // 가슴 높이
  return { g, u, R, hips, neck, head, chest, fwd, right, sc, fem,
    rx: .165 * sc, rzF: (.112 + (fem ? .028 : 0)) * sc, rzB: .1 * sc, rh: .118 * sc * 1.1 };
}
/* 점 p 가 상대 몸 b 안쪽으로 얼마나 들어갔나: 정규화 거리(1 = 표면, <1 = 안쪽) */
function norm(p, b) {
  let best = 9;
  const y0 = b.hips.y - .06, y1 = b.neck.y + .02;
  if (p.y > y0 && p.y < y1) {
    const t = (p.y - b.hips.y) / Math.max(.01, b.neck.y - b.hips.y), cx = b.hips.x + (b.neck.x - b.hips.x) * t, cz = b.hips.z + (b.neck.z - b.hips.z) * t;
    const vx = p.x - cx, vz = p.z - cz, lx = vx * b.right.x + vz * b.right.z, lz = vx * b.fwd.x + vz * b.fwd.z;
    const taper = .82 + .18 * Math.min(1, Math.max(0, t));   // 허리는 가슴보다 가늘게
    const rz = lz > 0 ? b.rzF * (t > .45 ? 1 : .9) : b.rzB; best = Math.hypot(lx / (b.rx * taper), lz / rz);
  }
  if (p.y > b.head.y - .03) { const hx = p.x - b.head.x, hy = p.y - (b.head.y + .02), hz = p.z - b.head.z, dh = Math.hypot(hx, hy * 1.25, hz) / (b.rh * .86); if (dh < best) best = dh; }   // 목을 감는 팔(머리 아래)은 머리 장애물에서 제외   // 팔 검사용 머리: 약간 작고 위로 — 목을 감는 팔이 머리 위로 밀려 올라가지 않게
  return best;
}
/* 팔 한쪽의 점들(위팔 중간 · 팔꿈치 · 아래팔 중간 · 손) */
function armPts(R, sh, el) {
  const S = R[sh], E = R[el], H = E.children.find(c => c.isGroup) || E;
  S.updateMatrixWorld(true);
  const ps = S.getWorldPosition(tmp.a), pe = E.getWorldPosition(tmp.b), ph = H.getWorldPosition(tmp.c);
  return [ps.clone().lerp(pe, .5), pe.clone(), pe.clone().lerp(ph, .5), ph.clone()];
}
function armCost(R, sh, el, B, hug) {
  const pts = armPts(R, sh, el); let c = 0;
  for (let i = 0; i < pts.length; i++) { const n = norm(pts[i], B), m = i === 3 ? 1.04 : 1.08; if (n < m) c += (m - n) * (i === 3 ? 1 : 1.4); }
  if (hug) { const n = norm(pts[3], B); if (n > 1.06 && n < 1.9) c += .35 * (n - 1.06); }   // 감싸는 동작: 손을 몸 표면에 붙임
  return c;
}
const PARAMS = [['sh', 0], ['sh', 1], ['sh', 2], ['el', 0]], PW = [.25, 1, 1, 1.2];   // 팔을 '들어 올려' 빼기보다 옆·뒤로 돌려 감싸도록 가중
function solveArm(A, B, side, dt, hug) {
  const R = A.R, [sh, el] = ARMS[side], u = A.u;
  let c0 = armCost(R, sh, el, B, hug); if (c0 <= 1e-4) return 0;
  u.cfix = u.cfix || {}; const fx = u.cfix;
  for (let it = 0; it < 4 && c0 > 1e-4; it++) {
    const grad = [0, 0, 0, 0], d = .035;
    PARAMS.forEach(([j, ax], i) => { const J = j === 'sh' ? R[sh] : R[el], key = ['x', 'y', 'z'][ax]; J.rotation[key] += d; grad[i] = (armCost(R, sh, el, B, hug) - c0) / d; J.rotation[key] -= d; });
    for (let i = 0; i < 4; i++) grad[i] *= PW[i]; const gn = Math.hypot(...grad); if (gn < 1e-5) break;
    const step = Math.min(.09, .04 + c0 * .6);
    PARAMS.forEach(([j, ax], i) => { const J = j === 'sh' ? R[sh] : R[el], key = ['x', 'y', 'z'][ax], dv = -grad[i] / gn * step; J.rotation[key] += dv;
      const jn = j === 'sh' ? sh : el; fx[jn] = fx[jn] || [0, 0, 0]; fx[jn][ax] = Math.max(-.75, Math.min(.75, fx[jn][ax] + dv)); });
    if (R[el].rotation.x > 0) { const over = R[el].rotation.x; R[el].rotation.x = 0; fx[el][0] -= over; }   // 팔꿈치는 앞으로만 굽음
    c0 = armCost(R, sh, el, B, hug);
  }
  return 1;
}
/* 몸통 간격: 가슴·골반·머리 */
function spacing(A, B) {
  const dx = B.g.position.x - A.g.position.x, dz = B.g.position.z - A.g.position.z, dist = Math.hypot(dx, dz) || 1e-3, ux = dx / dist, uz = dz / dist;
  const half = (b, dirx, dirz) => { const lz = dirx * b.fwd.x + dirz * b.fwd.z, lx = dirx * b.right.x + dirz * b.right.z, rz = lz > 0 ? b.rzF : b.rzB; return 1 / Math.hypot(lx / b.rx, lz / rz); };
  let need = 0, room = 9;   // need: 벌려야 할 거리 · room: 더 다가가도 되는 여유(가슴·골반이 닿기 전까지)
  const pairs = [[A.chest, B.chest, half(A, ux, uz) + half(B, -ux, -uz) - .025], [A.hips, B.hips, (half(A, ux, uz) + half(B, -ux, -uz)) * .88 - .02], [A.head, B.head, A.rh + B.rh - .012]];
  pairs.forEach(([pa, pb, req3], i) => {
    const dy = Math.abs(pa.y - pb.y); if (dy >= req3) return; const req = Math.sqrt(req3 * req3 - dy * dy);   // 높이 차를 뺀 수평 필요 거리
    const along = (pb.x - pa.x) * ux + (pb.z - pa.z) * uz, perp = Math.hypot(pb.x - pa.x - along * ux, pb.z - pa.z - along * uz);
    if (perp > req) return; const r = Math.sqrt(Math.max(0, req * req - perp * perp)); if (along < r) need = Math.max(need, r - along); else room = Math.min(room, along - r);
  });
  const headGap = A.head.distanceTo(B.head) - (A.rh + B.rh) * .99;
  return { need: Math.min(need, .25), room, headGap, ux, uz };
}
/* 붙는 동작: 이마·입술은 머리가 닿을 때까지, 안기는 가슴이 닿을 때까지 두 사람을 살짝 당김 (동작 시작·끝에서 부드럽게) */
const SIDE_K = new Set(['hug', 'backhug']), HEAD_K = new Set(['forehead', 'kiss', 'deepkiss', 'cheek', 'neck', 'whisper']), BODY_K = new Set(['hug', 'waist', 'backhug', 'dip']);
const PULL = new Map(), touchedPairs = new Set(), pairKey = (a, b) => a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function pullTarget(ua, ub, s) {
  const act = ua.bAct || ub.bAct; if (!act || act.out === 'refuse') return 0;
  const e = (performance.now() - act.t0) / 1000, w = Math.min(sm(0, .9, e), 1 - sm(act.dur - .8, act.dur, e)); if (w <= 0) return 0;
  if (HEAD_K.has(act.k)) return Math.max(0, Math.min(s.headGap, s.room + .03)) * w;
  if (BODY_K.has(act.k)) return Math.max(0, s.room + .015) * w;
  return 0;
}
function decay(u, dt) { const fx = u.cfix; if (!fx) return; let any = false; const k = Math.exp(-dt * 1.6); for (const j in fx) { const v = fx[j]; v[0] *= k; v[1] *= k; v[2] *= k; if (Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]) > .003) any = true; } if (!any) u.cfix = null; }
const contactMode = u => u.dance === 'blues' || !!u.bAct || !!u.contact || (u.motion && u.motion.g && /hug|kiss|cheers|slap|push/.test(u.motion.g));

const STAT = { pairs: 0, fixes: 0, off: false };
const TICK = dt => {
  if (STAT.off) { [NC.player && NC.player.group].concat((NC.npcs || []).map(n => n.g)).forEach(g => { if (g) g.userData.cfix = null; }); return; }
  const cam = NC.camera, list = [];
  const add = g => { if (g && g.visible && g.userData.rig && (!cam || cam.position.distanceTo(g.position) < 26)) list.push(g); };
  add(NC.player && NC.player.group); (NC.npcs || []).forEach(n => add(n.g)); if (NC.DJ) add(NC.DJ); (NC.Stage && NC.Stage.dancers || []).forEach(d => add(d.g));
  const touched = new Set(); touchedPairs.clear(); STAT.pairs = 0; STAT.fixes = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], d = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z); if (d > .78 || Math.abs(a.position.y - b.position.y) > .6) continue;
    if (a.userData.seated && b.userData.seated && d > .45) continue;
    STAT.pairs++; a.updateMatrixWorld(true); b.updateMatrixWorld(true);
    const A = body(a), B = body(b); if (!A || !B) continue;
    // ① 몸통 간격 (앉아 있으면 위치를 못 움직이므로 팔만)
    if (!a.userData.seated && !b.userData.seated) {
      { const act = a.userData.bAct || b.userData.bAct; if (act && SIDE_K.has(act.k) && act.out !== 'refuse') {   // 안기: 머리를 서로 어깨 너머로(볼 맞대기) — 몸을 옆으로 살짝 엇갈림
          const e = (performance.now() - act.t0) / 1000, w = Math.min(sm(0, .9, e), 1 - sm(act.dur - .8, act.dur, e)), off = .085 * w;
          a.position.x -= A.right.x * off; a.position.z -= A.right.z * off; b.position.x += A.right.x * off; b.position.z += A.right.z * off; a.updateMatrixWorld(true); b.updateMatrixWorld(true); Object.assign(A, body(a)); Object.assign(B, body(b)); } }
      const s = spacing(A, B), pr = pullTarget(a.userData, b.userData, s), key = pairKey(a, b);
      const cur = PULL.get(key) || 0, nx = cur + (pr - cur) * Math.min(1, dt * 5); PULL.set(key, nx); touchedPairs.add(key);
      const k = s.need > .002 ? s.need : -Math.min(nx, s.room + .03);   // 양수 = 벌림 · 음수 = 다가감(닿을 때까지만)
      const move = kk => { a.position.x -= s.ux * kk * .5; a.position.z -= s.uz * kk * .5; b.position.x += s.ux * kk * .5; b.position.z += s.uz * kk * .5; a.updateMatrixWorld(true); b.updateMatrixWorld(true); Object.assign(A, body(a)); Object.assign(B, body(b)); };
      if (Math.abs(k) > .002) { move(k); const s2 = spacing(A, B); if (s2.need > .002) move(s2.need); } }   // 2차 보정으로 수렴
    // ② ③ 팔
    if (contactMode(a.userData) || contactMode(b.userData) || d < .5) {
      const hugA = !!(a.userData.bAct && EMBRACE.has(a.userData.bAct.k)) || (a.userData.dance === 'blues'), hugB = !!(b.userData.bAct && EMBRACE.has(b.userData.bAct.k)) || (b.userData.dance === 'blues');
      for (const side of [0, 1]) { STAT.fixes += solveArm(A, B, side, dt, hugA); STAT.fixes += solveArm(B, A, side, dt, hugB); }
      touched.add(a); touched.add(b);
    }
  }
  list.forEach(g => { if (!touched.has(g)) decay(g.userData, dt); });
  for (const k of PULL.keys()) if (!touchedPairs.has(k)) PULL.delete(k);
};
NC.tickers.push(TICK);
NC.Contact = { STAT, body, norm, spacing, tick: TICK };
console.info('[contact] 두 캐릭터 접촉 보정(몸통 간격 · 팔 관통 방지 · 손 밀착) 켜짐');
})();
