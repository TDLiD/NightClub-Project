/* behavior.js — v62 자율 행동 지능 (Autonomous Behavior Intelligence)
 *  손님 한 명 한 명이 '명령을 기다리는 마네킹'이 아니라 스스로 행동하게:
 *   · 개인 성향(행동 정체성): 이름 해시 + 성격 → 템포(얼마나 자주 움직이나), 차분함/산만함, 자세(구부정·꼿꼿), 체중 이동 습관, 주로 하는 몸짓
 *   · 상황 판단(유틸리티 점수): 장소(댄스플로어·바·테이블), 주변 사람 수, 음악 박자, 앉음/서 있음, 잔을 들었는지, 최근 했던 행동(반복 금지)
 *   · 행동: 둘러보기 · 사람 쳐다보기(눈 마주치면 미소) · 머리 만지기 · 휴대폰 보기(폰 소품) · 옷매무새 · 목 풀기 · 시계 보기 · 한 모금 · 웃음 · 발 까딱
 *   · 상시 미세 움직임: 서 있을 때 6~14초마다 체중을 한쪽 다리로 옮김(골반·허리 반대 방향, 쉬는 다리 무릎 살짝) + 개인 자세
 *   · 다가옴 인식: 플레이어가 다가오면 고개를 돌려 쳐다보고 호감·성격에 따라 미소/수줍음/손 인사
 *  소유권 규칙: 다른 시스템이 시선(lookAt)·제스처·블루스·대화를 잡고 있으면 손대지 않음 — 덧붙이는 자세는 기본 자세 레이어 위에 그 프레임만(motion.js v61) */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.THREE || /[?&]nobh=1/.test(location.search)) return;   // ?nobh=1: 비교 시험용으로 끄기
const T = NC.THREE, U = NC.util, W = NC.world || {};
const now = () => performance.now() / 1000;
const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const STATS = {};
/* ── 개인 행동 정체성 ── */
function profile(n) {
  if (n._bp) return n._bp; const r = k => hash(n.name + ':' + k), tr = n.trait || 'outgoing';
  const T0 = { shy: { tempo: .75, fidget: .7, slouch: .05, chin: .06, glance: .5, hair: 1.4, phone: 1.3, laugh: .5 }, cool: { tempo: .6, fidget: .3, slouch: -.02, chin: -.03, glance: .7, hair: .6, phone: 1, laugh: .4 },
    playful: { tempo: 1.3, fidget: 1.3, slouch: 0, chin: 0, glance: 1.2, hair: 1, phone: .6, laugh: 1.5 }, outgoing: { tempo: 1.15, fidget: 1, slouch: -.015, chin: -.01, glance: 1.4, hair: .8, phone: .7, laugh: 1.3 } }[tr] || {};
  return (n._bp = { tempo: (T0.tempo || 1) * (.8 + .4 * r(1)), fidget: (T0.fidget || 1) * (.7 + .6 * r(2)), slouch: (T0.slouch || 0) + (r(3) - .5) * .04, chin: (T0.chin || 0) + (r(4) - .5) * .05,
    glance: T0.glance || 1, hair: (T0.hair || 1) * (n.gender === 'f' ? 1 : .25), phone: T0.phone || 1, laugh: T0.laugh || 1, wsAmp: .035 + .03 * r(5), wsPer: 6 + 8 * r(6), side: r(7) < .5 ? -1 : 1, hist: [], next: now() + 1 + r(8) * 6, ws: 0, wsT: 0, wsTo: 0 });
}
/* ── 행동 목록: 점수(상황) · 실행 ── */
const nearOf = (n, R) => { const out = []; const P = NC.player; if (P && Math.hypot(P.x - n.x, P.z - n.z) < R) out.push({ x: P.x, z: P.z, g: P.group, p: true });
  for (const m of NC.npcs || []) { if (m === n || !m.g.visible || m.state === 'off') continue; const d = Math.hypot(m.x - n.x, m.z - n.z); if (d < R) out.push({ x: m.x, z: m.z, g: m.g, n: m }); } return out; };
const zoneOf = n => { const Z = W.zones || {}; for (const k of ['dance', 'bar', 'stage']) { const z = Z[k]; if (z && n.x > z.x0 && n.x < z.x1 && n.z > z.z0 && n.z < z.z1) return k; } return 'floor'; };
function lookFor(n, tgt, dur, tag, force) { const u = n.g.userData; if (u.lookAt && !(u.lookAt._bh) && !force) return false; const L = tgt.g ? Object.assign(Object.create(null), { x: tgt.x, z: tgt.z, _bh: tag, g: tgt.g }) : Object.assign({ _bh: tag }, tgt); u.lookAt = L; n._bl = { L, until: now() + dur }; return true; }
let PHONE = null;
function phoneProp(n, on) { const u = n.g.userData, r = u.real, hand = r && !r.pending && r.Bn && (r.Bn.handR || r.Bn.handL) || (u.rig && u.rig.elR);
  if (!on) { if (n._phone) { n._phone.parent && n._phone.parent.remove(n._phone); n._phone = null; } return; } if (!hand || n._phone) return;
  if (!PHONE) { PHONE = { geo: new T.BoxGeometry(.068, .14, .009), body: new T.MeshStandardMaterial({ color: 0x15161a, roughness: .35, metalness: .4 }), scr: new T.MeshBasicMaterial({ color: 0x9fd4ff }) }; }
  const g = new T.Group(), b = new T.Mesh(PHONE.geo, PHONE.body), s = new T.Mesh(new T.PlaneGeometry(.06, .12), PHONE.scr); s.position.z = .0052; g.add(b, s);
  const ws = hand.getWorldScale(new T.Vector3()).x || 1; g.scale.setScalar(1 / ws); g.position.set(0, .06 / ws, .03 / ws); g.rotation.set(-1.2, 0, 0); hand.add(g); n._phone = g; }
const ACTS = {
  lookAround: { s: (n, c) => .9 + (c.zone === 'floor' ? .3 : 0), run: (n, c) => { const a = n.g.rotation.y + (Math.random() - .5) * 2.4, d = 3 + Math.random() * 5; return lookFor(n, { x: n.x + Math.sin(a) * d, z: n.z + Math.cos(a) * d }, 1.6 + Math.random() * 1.6, 'around'); } },
  glance: { s: (n, c, p) => c.near.length ? 1.3 * p.glance : 0, run: (n, c) => { const t = c.near[Math.random() * c.near.length | 0]; if (!lookFor(n, t, 1.4 + Math.random() * 2, 'glance')) return false;
      const u = n.g.userData; if (u.setExpr && !u.exprUntil && Math.random() < .55) setTimeout(() => u.setExpr(n.trait === 'shy' ? 'shy' : 'smile', 1.6), 450); return true; } },
  hair: { s: (n, c, p) => .55 * p.hair * p.fidget, g: 'hairTouch' },
  phone: { s: (n, c, p) => (c.near.length < 2 ? .7 : .25) * p.phone * (c.seated ? 1.3 : 1), g: 'phone', on: n => phoneProp(n, true), off: n => phoneProp(n, false), dur: 4.5 },
  adjust: { s: (n, c, p) => .35 * p.fidget * (c.seated ? .3 : 1), g: 'adjust' },
  neck: { s: (n, c, p) => .25 * p.fidget, g: 'neckRoll' },
  watch: { s: (n, c, p) => .2 * (n.gender === 'm' ? 1.3 : .7), g: 'watch' },
  sip: { s: (n, c) => c.glass ? 1.4 : 0, g: 'drink' },
  laugh: { s: (n, c, p) => c.near.length >= 2 ? .5 * p.laugh : 0, g: 'laugh' },
  tap: { s: (n, c, p) => c.beat ? .7 * p.fidget : 0, run: n => { n._tap = { until: now() + 3 + Math.random() * 3, leg: Math.random() < .5 ? 'L' : 'R' }; return true; } },
};
function idleOK(n) { const u = n.g.userData, BL = NC.Karaoke && NC.Karaoke.BL;
  return n.g.visible && u.rig && !u.moving && !u.dance && n.state !== 'talk' && n.state !== 'off' && n.state !== 'lying' && n.state !== 'motel' && n.state !== 'escort' && !(BL && n === BL.n) && !n.party && !u.bAct && !(u.motion && u.motion.g) && !(NC.Motel && NC.Motel.on && NC.Motel.n === n); }
function decide(n, p) {
  const u = n.g.userData, b = NC.Audio && NC.Audio.beat ? NC.Audio.beat() : null, c = { near: nearOf(n, 4), zone: zoneOf(n), seated: !!u.seated, glass: !!u.holdGlass, beat: !!b };
  const cand = []; for (const k in ACTS) { let s = ACTS[k].s(n, c, p); if (!s) continue; const i = p.hist.lastIndexOf(k); if (i >= 0) s *= i === p.hist.length - 1 ? .05 : .35; cand.push([k, s * (.7 + Math.random() * .6)]); }   // 반복 억제 + 무작위성
  cand.sort((a, b2) => b2[1] - a[1]); for (const [k] of cand.slice(0, 3)) { const A = ACTS[k]; let ok;
    if (A.g) { NC.Motion.play(n.g, A.g, A.dur ? { dur: A.dur } : {}); ok = true; if (A.on) { A.on(n); setTimeout(() => A.off(n), (A.dur || 3) * 1000 + 200); } } else ok = A.run(n, c);
    if (ok) { p.hist.push(k); if (p.hist.length > 4) p.hist.shift(); STATS[k] = (STATS[k] || 0) + 1; return k; } }
  return null;
}
/* ── 다가옴 인식 ── */
function notice(n, t) { const P = NC.player, u = n.g.userData; if (!P || P.seat) return; const dx = n.x - P.x, dz = n.z - P.z, d = Math.hypot(dx, dz); if (d > 3 || d < .3) return;
  const fx = Math.sin(P.ry || 0), fz = Math.cos(P.ry || 0), facing = (fx * dx + fz * dz) / d; if (facing < .7 || (n._ntc && t < n._ntc)) return;
  if (!lookFor(n, { x: P.x, z: P.z, g: P.group }, 2.2 + Math.random() * 1.5, 'notice', true)) return;   // 다가오는 사람은 배경 시선(가끔 힐끗)보다 우선 n._ntc = t + 12 + Math.random() * 8; STATS.notice = (STATS.notice || 0) + 1;
  const aff = n.aff || 0; if (u.setExpr) u.setExpr(n.trait === 'shy' ? 'shy' : aff > 60 ? 'joy' : 'smile', 2); if (aff > 72 && !u.seated && !(u.motion && u.motion.g) && Math.random() < .5) NC.Motion.play(n.g, 'wave'); }
/* ── 매 프레임: 결정(희소) + 미세 움직임 오버레이(기본 자세 위, 그 프레임만) ── */
let acc = 0;
NC.tickers.push(dt => {
  if (!dt) return; dt = Math.min(dt, .1); const t = now(), list = NC.npcs || [], P = NC.player; acc += dt; const decideNow = acc > .25; if (decideNow) acc = 0;
  const b = NC.Audio && NC.Audio.beat ? NC.Audio.beat() : null;
  for (let i = 0; i < list.length; i++) { const n = list[i]; if (!n.g || !n.g.visible) continue; const u = n.g.userData, R = u.rig; if (!R) continue;
    if (n._bl && (t > n._bl.until || u.lookAt !== n._bl.L)) { if (u.lookAt === n._bl.L) u.lookAt = null; n._bl = null; }   // 내 시선만 내가 풂
    if (!idleOK(n)) { if (n._phone && !(u.motion && u.motion.g === 'phone')) phoneProp(n, false); continue; }
    if (P && Math.hypot(n.x - P.x, n.z - P.z) > 30) continue;   // 먼 손님은 계산 생략(LOD)
    const p = profile(n);
    if (decideNow) { notice(n, t); if (t > p.next) { decide(n, p); p.next = t + (3 + Math.random() * 6) / p.tempo; } }
    /* 자세(개인) */ R.torso.rotation.x += p.slouch; R.head.rotation.x += p.chin;
    /* 체중 이동 — 서 있을 때만: 한쪽 다리로 천천히(1.2초) 옮겨 몇 초 머묾 */
    if (!u.seated) { if (t > p.wsT) { p.wsTo = p.wsTo ? 0 : p.side * (Math.random() < .25 ? -1 : 1); p.wsT = t + p.wsPer * (.7 + Math.random() * .6); }
      p.ws += (p.wsTo - p.ws) * Math.min(1, dt * 1.6); const w = p.ws * p.wsAmp;
      R.hips.rotation.z += w; R.torso.rotation.z -= w * .7; R.head.rotation.z -= w * .25; const free = w > 0 ? R.knL : R.knR; if (free) free.rotation.x += Math.abs(w) * 2.2; }
    /* 발 까딱(박자) */ if (n._tap) { if (t > n._tap.until || !b) n._tap = null; else { const k = Math.max(0, Math.sin(b.phase * Math.PI * 2)), kn = n._tap.leg === 'L' ? R.knL : R.knR, lg = n._tap.leg === 'L' ? R.legL : R.legR; if (kn) kn.rotation.x += k * .16; if (lg) lg.rotation.x -= k * .05; } }
  }
  /* 플레이어도 오래 서 있으면 체중 이동(조작 중엔 없음) */
  if (P && P.group && P.group.userData.rig) { const u = P.group.userData, R = u.rig, pp = P._bp || (P._bp = { idle: 0, ws: 0, wsTo: 0, wsT: 0 }); pp.idle = u.moving || u.dance || u.seated || u.bAct ? 0 : pp.idle + dt;
    if (pp.idle > 3) { if (t > pp.wsT) { pp.wsTo = pp.wsTo ? 0 : (Math.random() < .5 ? -1 : 1); pp.wsT = t + 7 + Math.random() * 6; } } else pp.wsTo = 0;
    pp.ws += (pp.wsTo - pp.ws) * Math.min(1, dt * 1.6); const w = pp.ws * .04; if (Math.abs(w) > .001) { R.hips.rotation.z += w; R.torso.rotation.z -= w * .7; const free = w > 0 ? R.knL : R.knR; if (free) free.rotation.x += Math.abs(w) * 2.2; } }
});
NC.Behavior = { STATS, profile, decide, ACTS, notice };
console.info('[behavior] v62 자율 행동 — 성향·상황 기반 몸짓, 체중 이동, 다가옴 인식');
})();
