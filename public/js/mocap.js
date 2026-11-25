/* mocap.js — v54 모션캡처 레이어 (Microsoft Rocketbox 실측 모션캡처, MIT)
 *  ■ 실사 모델(humanglb)은 같은 Rocketbox 골격(Bip01)이라 모션캡처 회전을 그대로 씀(리타깃 오차 없음)
 *  ■ 상태 → 클립: 대기(변주) · 걷기(실제 이동 속도에 맞춰 재생 속도·클립 선택 → 발 미끄러짐 제거) · 취한 걸음 · 앉기/일어서기 · 앉아 대기 ·
 *    춤(개성별 스타일 + 실시간 BPM 위상 맞춤) · 박수/환호/손 흔들기 · 대화 손짓 · 잔 들고 서 있기
 *  ■ 골반: 무게중심의 상하·좌우 흔들림은 살리고 수평 이동은 제거(변환 단계) → 루트(rig)가 위치를 담당
 *  ■ 앉기: 골반 높이를 의자 높이(u.seatH)에 맞추고 두 관절 IK 로 발을 바닥에 붙임 / 서기: 발이 바닥을 뚫으면 IK 로 올림
 *  ■ 커플(부르스·키스·포옹·손잡기)·폴댄스·노래방·DJ·접촉 보정 중에는 기존 IK/절차 자세(v47)로 부드럽게 넘김 — 커플 모션캡처 자료가 없기 때문
 *  ■ 뼈별 가중치: 잔·마이크를 든 팔, 시선 처리 중인 목·머리, 다른 손짓(제스처) 중인 상체는 기존 자세를 유지
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return; const RH = NC.RealHuman; if (!RH || !RH.ok) return;
const T = NC.THREE, U = NC.util;
const MC = RH.MC = { on: !/[?&]nomocap\b/.test(location.search), clips: new Map(), meta: null, stats: { active: 0, loads: 0, frames: 0 } };
const BASE_URL = 'models/humans/anims/';
const loader = new T.GLTFLoader(); if (window.MeshoptDecoder && loader.setMeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);

/* ── 클립 불러오기(필요할 때만, 성별별) ── */
const PEL = 'Bip01_Pelvis';
const grp = n => /Finger/.test(n) ? 'fing' : /Thigh|Calf|Foot|Toe/.test(n) ? 'leg' : n === PEL ? 'pel' : /Neck|Head/.test(n) ? 'head' : /Clavicle|UpperArm|Forearm|Hand/.test(n) ? (/ L /.test(n.replace(/_/g, ' ')) ? 'armL' : 'armR') : 'spine';
function loadClip(name) {
  if (MC.clips.has(name)) return MC.clips.get(name);
  const p = new Promise(res => loader.load(BASE_URL + name + '.glb', g => {
    const a = g.animations && g.animations[0]; if (!a) return res(null);
    const tr = []; let pos = null;
    for (const t of a.tracks) { const i = t.name.lastIndexOf('.'), node = t.name.slice(0, i), prop = t.name.slice(i + 1);
      if (prop === 'quaternion') tr.push({ node, g: grp(node), ip: t.createInterpolant() });
      else if (prop === 'position' && node === PEL) pos = t.createInterpolant(); }
    const m = (MC.meta && MC.meta.clips[name]) || {}, c = { name, dur: a.duration, tr, pos, m, endXZ: null };
    if (pos && m.kind === 'xyz') { const e = pos.evaluate(/stand_up/.test(name) ? 0 : a.duration - 1e-4); c.endXZ = [e[0], e[2]]; }   // 앉기·일어서기: 앉은 순간의 골반을 루트(의자)에 맞춤
    MC.stats.loads++; res(c); MC.clips.set(name, c);
  }, undefined, () => res(null)));
  MC.clips.set(name, p); return p;
}
const ready = name => { const c = MC.clips.get(name); return c && !(c instanceof Promise) ? c : (c ? null : (loadClip(name), null)); };

/* ── 개성: 사람마다 고정된 선택(같은 사람은 늘 같은 춤 스타일·걸음) ── */
const H = (u, k) => { const s = String((u.seed || 0) * 9973 + k); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const pick = (arr, x) => arr[Math.min(arr.length - 1, Math.floor(x * arr.length))];
const LIB = {
  f: { idle: ['f_idle_neutral_01', 'f_idle_neutral_02', 'f_idle_neutral_03', 'f_idle_neutral_04', 'f_idle_neutral_05', 'f_idle_breathe_01', 'f_idle_waiting_01', 'f_idle_look_around_01', 'f_idle_touch_hair_01'],
    walk: { def: ['f_walk_neutral_01', 'f_walk_neutral_02', 'f_walk_stroll_01'], model: ['f_walk_self_assured'], swagger: ['f_walk_cool_01'], shy: ['f_walk_slow_01'], bouncy: ['f_walk_neutral_02'] },
    walkAll: ['f_walk_slow_01', 'f_walk_stroll_01', 'f_walk_cool_01', 'f_walk_self_assured', 'f_walk_neutral_01', 'f_walk_neutral_02', 'f_walk_fast_01', 'f_walk_fast_02', 'f_run_slow_01'],
    drunkWalk: 'f_walk_drunk', drunkIdle: 'f_idle_drunk_01', drink: 'f_drink_idle', sip: 'f_drink_drinking',
    sit: ['f_sit_chair_idle_neutral_01', 'f_sit_chair_idle_neutral_02', 'f_sit_chair_idle_relaxed_01', 'f_sit_chair_breathe_01', 'f_sit_chair_idle_look_around', 'f_sit_chair_idle_touch_hair', 'f_sit_chair_idle_waiting_01'],
    sitTalk: ['f_sit_chair_gestic_shrug_01', 'f_sit_chair_gestic_thoughtful', 'f_sit_chair_idle_neutral_02'],
    sitDown: 'f_sit_down_chair_01', standUp: 'f_sit_stand_up_chair_01',
    talk: ['f_gestic_talk_neutral_01', 'f_gestic_talk_neutral_02', 'f_gestic_talk_relaxed_01'], listen: ['f_gestic_listen_neutral_01'],
    dance: ['f_dancing_neutral', 'f_dancing_cool', 'f_dancing_affective', 'f_dancing_silly', 'f_dancing_aggressive'],
    stage: ['f_dancing_cool', 'f_dancing_aggressive', 'f_dancing_affective'],
    clap: 'f_claphands_01', cheer: ['f_cheer_01', 'f_cheer_02'], wave: 'f_wave_01', hair: 'f_idle_touch_hair_01', look: ['f_idle_look_around_01'] },
  m: { idle: ['m_idle_neutral_01', 'm_idle_neutral_02', 'm_idle_neutral_03', 'm_idle_neutral_04', 'm_idle_neutral_05', 'm_idle_breathe_01', 'm_idle_waiting_01', 'm_idle_look_around_01'],
    walk: { def: ['m_walk_neutral_01', 'm_walk_neutral_02', 'm_walk_stroll_01'], model: ['m_walk_cool_01'], swagger: ['m_walk_cool_01'], shy: ['m_walk_slow_01'], bouncy: ['m_walk_neutral_02'] },
    walkAll: ['m_walk_stroll_01', 'm_walk_slow_01', 'm_walk_neutral_01', 'm_walk_cool_01', 'm_walk_neutral_02', 'm_walk_fast_01', 'm_walk_fast_02', 'm_run_slow_01'],
    drunkWalk: 'm_walk_drunk', drunkIdle: 'm_idle_drunk_01', drink: 'm_drink_idle', sip: 'm_drink_drinking',
    sit: ['m_sit_chair_idle_neutral_01', 'm_sit_chair_idle_neutral_02', 'm_sit_chair_idle_relaxed_01', 'm_sit_chair_breathe_01', 'm_sit_chair_idle_look_around', 'm_sit_chair_idle_touch_hair', 'm_sit_chair_idle_waiting_01'],
    sitTalk: ['m_sit_chair_gestic_shrug_01', 'm_sit_chair_gestic_thoughtful', 'm_sit_chair_idle_neutral_02'],
    sitDown: 'm_sit_down_chair_01', standUp: 'm_sit_stand_up_chair_01',
    talk: ['m_gestic_talk_neutral_01', 'm_gestic_talk_neutral_02', 'm_gestic_talk_relaxed_01'], listen: ['m_idle_breathe_01', 'm_idle_neutral_02'],   // v66 남자 듣기 클립이 없어 '말하는' 손짓 클립을 쓰던 것 → 조용한 대기 + 끄덕임(social.js)
   
    dance: ['m_dancing_neutral', 'm_dancing_cool', 'm_dancing_silly', 'm_dancing_aggressive'],
    stage: ['m_dancing_cool', 'm_dancing_aggressive', 'm_dancing_neutral'],
    clap: 'm_claphands_01', cheer: ['m_cheer_01', 'm_cheer_03'], wave: 'm_wave_01', look: ['m_idle_look_around_01'] }
};
MC.LIB = LIB;
/* 기존 절차 제스처 → 모션캡처 대체(없는 것은 상체만 기존 제스처를 그대로 보여 줌) */
const GEST_CLIP = { clap: 'clap', cheer: 'cheer', wave: 'wave', cheers: 'cheer', drink: 'sip', hairTouch: 'hair', lookAround: 'look' };   // v66 머리 넘기기·둘러보기도 실제 모션캡처(없는 성별은 절차 제스처)
/* 모션캡처를 끄고 기존 IK/절차 자세에 맡기는 상태(커플·특수 동작) */
const OFF_BASE = new Set(['blues', 'pole', 'sing', 'djMix', 'djHype', 'crouch']);

/* ── 상태 선택 ── */
function decide(r, u, mc, g) {
  const L = LIB[g], base = u.mBase || 'idle', now = mc.now;
  /* v68 '지난 상호작용의 흔적' 때문에 모션캡처가 영영 꺼져 있던 원인 제거: ikLock 은 couple.js 가 매 프레임 새로 쓰는 표식 → 0.25초 넘게 갱신 없으면 끝난 것,
   *  cfix(접촉 보정 잔여)는 크기가 사실상 0이면 무시 — 전에는 블루스·포옹이 끝난 뒤에도 남아 있어서 대기·걷기가 실측 동작으로 돌아오지 않았음 */
  const pn = performance.now(), ikOn = u.ikLock && (pn - (u.ikLock.t || 0) < 250) && ((u.ikLock.L || 0) > .02 || (u.ikLock.R || 0) > .02);
  const cfOn = u.cfix && Object.values(u.cfix).some(v => Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]) > .02);
  if (u.bAct || u.kissK || ikOn || u.handTgt || cfOn || OFF_BASE.has(base) || u.polePhase != null && base === 'pole') { if (OFF_BASE.has(base) || u.bAct) mc.wasSeated = false; return null; }   // v56 앉아 있다가 블루스로 일어난 사람: 춤이 끝난 뒤 엉뚱하게 '일어서기' 동작이 나오지 않게
  if (base === 'sit' || base === 'sitTalk') {
    if (!mc.wasSeated) { mc.wasSeated = true; if (now - (mc.lastWalk || -9) < 1.5) mc.oneShot = { name: L.sitDown, until: now + 4.2, ts: 1.15 }; }   // 걸어와 앉을 때만 앉는 동작(처음부터 앉아 있던 사람은 바로 앉은 자세)
    if (mc.oneShot && mc.oneShot.name === L.sitDown && now < mc.oneShot.until) return { name: L.sitDown, once: true, ts: 1.15, seat: true };
    const talk = base === 'sitTalk', pool = talk ? L.sitTalk : L.sit;   // 앉아서 대화: 어깨 으쓱·생각하는 손짓(모션캡처)
    if (!mc.sitPick || mc.sitPick.talk !== talk || now > mc.sitPick.until) mc.sitPick = { talk, name: pick(pool, H(u, 7 + Math.floor(now / 40))), until: now + (talk ? 8 + 6 * H(u, 4) : 25 + 20 * H(u, 3)) };
    return { name: mc.sitPick.name, seat: true };
  }
  if (mc.wasSeated) { mc.wasSeated = false; if (!u.moving) mc.oneShot = { name: L.standUp, until: now + 2.6, ts: 1.1 }; }
  if (mc.oneShot && mc.oneShot.name === L.standUp && now < mc.oneShot.until && !u.moving) return { name: L.standUp, once: true, ts: 1.1, seat: true };
  if (base === 'walk' || base === 'drunkWalk') {
    mc.lastWalk = now;
    if (base === 'drunkWalk') return { name: L.drunkWalk, walk: true };
    const st = L.walk[u.walkStyle] || L.walk.def; let nm = mc.walkName && (st.includes(mc.walkName) || L.walkAll.includes(mc.walkName)) ? mc.walkName : pick(st, H(u, 11));
    // 속도 맞춤: 고른 걸음으로는 재생 속도가 0.7~1.4배를 벗어나면 속도가 가장 가까운 걸음으로 바꿈
    const v = mc.v, sp = n => (MC.meta.clips[n] || {}).speed || 1, ratio = n => v / (sp(n) * mc.L);
    const rr = ratio(nm); if (v > .15 && (rr < .7 || rr > 1.4)) { let best = nm, bd = 9; for (const n of L.walkAll) { const d = Math.abs(Math.log(Math.max(.05, ratio(n)))); if (d < bd) { bd = d; best = n; } } nm = best; }
    mc.walkName = nm; return { name: nm, walk: true };
  }
  if (base === 'groove' || base === 'stageDance' || base === 'showDance') {   // v78 showDance: 신나게 춤추기·댄싱 킹/퀸 — 강한 춤만 골라 빠르게 바꿔 가며
    /* v56 성격별 춤(손님): 수줍음 = 담백·감성 · 쿨 = 쿨 · 활발 = 강렬·쿨·감성 · 장난 = 익살·감성 — 느린 곡(BPM<100)이면 누구나 담백·감성 쪽으로
     *  + 자연스러운 쉬는 구간: 성격에 따라 20~70초마다 3~7초 동안 박자만 타며 숨 고르기(둘러보기·숨쉬기 대기 동작) */
    let pool = base === 'stageDance' ? L.stage : L.dance;
    if (base === 'showDance') { const hp = L.dance.filter(n => !/neutral/.test(n)); if (!mc.dancePick || mc.dancePick.base !== base || now > mc.dancePick.until) { const prev = mc.dancePick && mc.dancePick.name, c = hp.filter(n => n !== prev); mc.dancePick = { base, name: pick(c.length ? c : hp, H(u, 81 + Math.floor(now * 3))), until: now + 3.2 + 2.6 * H(u, 82 + Math.floor(now)) }; } return { name: mc.dancePick.name, dance: true, hype: true }; }
    if (base === 'groove') { const pre = g + '_dancing_', A = NC.Audio, slow = A && A.bpm && A.bpm < 100, tr = u.trait || ['outgoing', 'cool', 'playful', 'shy'][Math.floor(H(u, 61) * 4)];
      const want = slow ? ['neutral', 'affective'] : { shy: ['neutral', 'affective'], cool: ['cool', 'neutral'], outgoing: ['aggressive', 'cool', 'affective'], playful: ['silly', 'affective', 'cool'] }[tr] || null;
      if (want) { const p2 = pool.filter(n => want.some(w => n === pre + w)); if (p2.length) pool = p2; }
      const pz = mc.pz || (mc.pz = { next: now + 20 + 50 * H(u, 62), until: 0 }), gap = { shy: 22, cool: 40, outgoing: 60, playful: 45 }[tr] || 45;
      if (now > pz.next) { pz.until = now + 3 + 4 * H(u, 63 + Math.floor(now)); pz.next = pz.until + gap * (.7 + .6 * H(u, 64 + Math.floor(now))); }
      if (now < pz.until) { const ip = L.idle.filter(n => /breathe|look_around|neutral_0[12]/.test(n)); return { name: pick(ip.length ? ip : L.idle, H(u, 65)) }; } }
    if (!mc.dancePick || mc.dancePick.base !== base || now > mc.dancePick.until || !pool.includes(mc.dancePick.name)) mc.dancePick = { base, name: pick(pool, H(u, 21 + Math.floor(now / 60))), until: now + 45 + 40 * H(u, 5) };
    return { name: mc.dancePick.name, dance: true };
  }
  if (base === 'drunkIdle') return { name: L.drunkIdle };
  if (base !== 'idle') return null;   // 알 수 없는 특수 자세는 기존 방식
  if (u.holdGlass) return { name: L.drink, armsOff: true };
  if (L.look && u.lookClipUntil && performance.now() < u.lookClipUntil) return { name: pick(L.look, H(u, 71)), once: true };   // v66 둘러보기(실제 모션: 고개·상체·체중이 함께)
  /* v66 대화 차례: 말하는 동안만 말하기 손짓, 상대가 말할 땐 듣기(혼자 서서 허공에 말하던 'talk' 대기 포즈는 social.js 가 짝을 지어 줄 때만) */
  const tk = u.talkUntil && performance.now() < u.talkUntil;
  if (!tk && u.listenTo) { if (!mc.lisPick || now > mc.lisPick.until) mc.lisPick = { name: pick(L.listen, H(u, 33 + Math.floor(now / 25))), until: now + 15 + 10 * H(u, 8) }; return { name: mc.lisPick.name }; }
  if (tk || (u.idlePose === 'talk' && !NC.Social)) { if (!mc.talkPick || now > mc.talkPick.until) mc.talkPick = { name: pick(L.talk, H(u, 31 + Math.floor(now / 20))), until: now + 12 + 10 * H(u, 9) }; return { name: mc.talkPick.name }; }
  if (!mc.idlePick || now > mc.idlePick.until) mc.idlePick = { name: pick(L.idle, (H(u, 41) + now * .013 * (1 + H(u, 2))) % 1), until: now + 14 + 18 * H(u, 12 + Math.floor(now / 30)) };
  return { name: mc.idlePick.name };
}

/* ── 춤 템포: 클립의 골반 상하 주기(자기상관)로 클립 BPM 을 구해 두고, 실시간 추적 BPM·박자 위상에 맞춤 ── */
function clipTempo(c) {
  if (c.bpm !== undefined) return c.bpm; c.bpm = 0; if (!c.pos) return 0;
  const fs = 30, n = Math.floor(c.dur * fs), y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = c.pos.evaluate(i / fs)[1];
  let mean = 0; for (let i = 0; i < n; i++) mean += y[i]; mean /= n; for (let i = 0; i < n; i++) y[i] -= mean;
  let best = 0, bl = 0; for (let lag = Math.round(fs * 60 / 150); lag <= Math.round(fs * 60 / 70); lag++) { let s = 0; for (let i = 0; i + lag < n; i++) s += y[i] * y[i + lag]; s /= (n - lag); if (s > best) { best = s; bl = lag; } }
  if (bl) { c.bpm = 60 * fs / bl; let mn = 1e9, mt = 0; for (let i = 0; i < Math.min(n, bl * 2); i++) if (y[i] < mn) { mn = y[i]; mt = i / fs; } c.dip = mt; }   // 첫 골반 최저점 = 박자 기준점
  return c.bpm;
}

/* ── 레이어 섞기 ── */
const qT = new T.Quaternion(), qS = new T.Quaternion();
function sampleLayer(L, c) {
  const t = c.dur > 0 ? ((L.t % c.dur) + c.dur) % c.dur : 0, tt = L.once ? Math.min(L.t, c.dur - 1e-3) : t, out = L.out || (L.out = new Map());
  for (const k of c.tr) { const v = k.ip.evaluate(tt); let q = out.get(k.node); if (!q) out.set(k.node, q = new T.Quaternion()); q.set(v[0], v[1], v[2], v[3]); }
  if (c.pos) { const p = c.pos.evaluate(tt); L.p = L.p || [0, 0, 0]; L.p[0] = p[0] - (c.endXZ ? c.endXZ[0] : 0); L.p[1] = p[1]; L.p[2] = p[2] - (c.endXZ ? c.endXZ[1] : 0); }
}
MC.prep = (r, dt) => {
  if (!MC.on || !MC.meta) return null;
  const u = r.u, g = (r.gender || (RH.modelGender && RH.modelGender(r.url)) || (/\/m_/.test(r.url) ? 'm' : 'f'));
  if (!r.mc) { if (!r.model.getObjectByName(PEL)) { r.mc = { dead: true }; return null; }   // Rocketbox 골격이 아닌 모델은 기존 리타깃만
    const B = new Map(); r.model.traverse(o => { if (o.isBone || o.type === 'Bone' || /^Bip01/.test(o.name)) B.set(o.name, o); });
    r.mc = { B, layers: [], w: 0, now: 0, v: 0, lp: new T.Vector3(), lpOk: false, L: 1, g, q: new Map(), wb: new Map(), hy: 0, hx: 0, hz: 0, seat: 0, tOff: 7 * H(u, 99) }; }
  const mc = r.mc; if (mc.dead) return null;
  mc.now += dt;
  // 실제 이동 속도(루트, 지면 기준)
  r.root.getWorldPosition(_v); if (mc.lpOk && dt > 0) { const d = Math.hypot(_v.x - mc.lp.x, _v.z - mc.lp.z) / dt; mc.v += (Math.min(d, 6) - mc.v) * Math.min(1, dt * 7); } mc.lp.copy(_v); mc.lpOk = true;
  const pel = mc.B.get(PEL); pel.parent.getWorldScale(_v); mc.L = _v.y * 100;   // 골반 좌표 1단위(cm) → 미터
  let want = decide(r, u, mc, g); if (r.mcForce) want = Object.assign({}, r.mcForce);   // 시험용 강제 지정
  // 제스처(기존 시스템) → 모션캡처가 있으면 한 번 재생, 없으면 상체는 기존 제스처
  const mg = u.motion && u.motion.g, gc = mg && GEST_CLIP[mg], L0 = LIB[g];
  let gest = null; if (want && mg) { const gn = gc ? (Array.isArray(L0[gc]) ? pick(L0[gc], H(u, 51)) : L0[gc]) : null; gest = gn && !want.seat ? gn : 'UPPER_OFF'; }
  const target = want ? (gest && gest !== 'UPPER_OFF' ? gest : want.name) : null;
  mc.w += ((target ? 1 : 0) - mc.w) * Math.min(1, dt * (target ? 5 : 7));
  if (target) { const top = mc.layers[mc.layers.length - 1];
    if (!top || top.name !== target) { const once = !!(want.once || (gest && gest !== 'UPPER_OFF')); const c0 = ready(target); if (c0 || !top) { mc.layers.push({ name: target, t: once ? 0 : (mc.tOff + mc.now * .37) % 997, w: top ? 0 : 1, once, ts: want.ts || 1 }); if (mc.layers.length > 4) mc.layers.shift(); } } }
  if (mc.w < .002 && !target) { mc.layers.length = 0; return null; }
  // 레이어 시간·가중치
  const fade = Math.min(1, dt / .28); let any = null;
  for (let i = 0; i < mc.layers.length; i++) { const Ly = mc.layers[i], top = i === mc.layers.length - 1, c = ready(Ly.name);
    Ly.w += ((top ? 1 : 0) - Ly.w) * (top && !c ? 0 : fade); if (!c) continue;
    let ts = Ly.ts || 1;
    if (want && want.walk && top) ts = U.clamp(mc.v / Math.max(.2, (c.m.speed || 1) * mc.L), .55, 1.7);   // 발 미끄러짐 방지: 재생 속도 = 실제 속도 / 클립 속도
    if (want && want.walk && !u.moving) ts = .4;
    if (want && want.dance && top) { const A = NC.Audio, bpm = (A && A.bpm) || 118, cb = clipTempo(c); if (cb) { let k = bpm / cb; while (k > 1.45) k /= 2; while (k < .7) k *= 2;
        // 위상 맞춤: 클립의 골반 최저점이 박자에 오도록 재생 속도를 살짝 당기거나 늦춤
        const b = A && A.beat ? A.beat() : null; if (b && c.dip != null) { const per = 60 / cb, cp = (((Ly.t - c.dip) / per) % 1 + 1) % 1; let e = b.phase - cp; e -= Math.round(e); k *= 1 + U.clamp(e, -.5, .5) * .25; }
        ts = k * (A && A.energy != null ? .9 + .2 * U.clamp(A.energy, 0, 1) : 1); }
      if (want.hype) ts *= 1.14; }
    Ly.t += dt * ts; any = any || c; }
  if (r.mcForce && r.mcForce.t != null && mc.layers.length) { const top = mc.layers[mc.layers.length - 1]; top.t = r.mcForce.t; mc.layers.forEach(l => { l.w = l === top ? 1 : 0; }); }
  while (mc.layers.length > 1 && mc.layers[0].w < .01) mc.layers.shift();
  if (!any) return null;
  // 성능: 멀리 있는 경량(LOD) 인물은 2~3프레임에 한 번만 다시 계산(그 사이엔 직전 자세 재사용 — 시간은 계속 흐름)
  mc.fr = (mc.fr || 0) + 1; const cam = NC.camera; if (r.lod && cam && mc.q.size && !r.mcForce) { const dd = cam.position.distanceTo(r.root.position), every = NC.isMobile ? (dd > 8 ? 3 : 1) : (dd > 12 ? 2 : 1); if (every > 1 && mc.fr % every) return mc; }
  // 섞기(정규화 누적 slerp)
  const Q = mc.q; let acc = 0, py = 0, px = 0, pz = 0;
  for (const Ly of mc.layers) { const c = ready(Ly.name); if (!c || Ly.w < .001) continue; sampleLayer(Ly, c); const a = Ly.w / (acc + Ly.w);
    for (const [k, q] of Ly.out) { const d = Q.get(k); if (!d || acc === 0) { if (d) d.copy(q); else Q.set(k, q.clone()); } else d.slerp(q, a); }
    if (Ly.p) { px += (Ly.p[0] - px) * a; py += (Ly.p[1] - py) * a; pz += (Ly.p[2] - pz) * a; } acc += Ly.w; }
  // 뼈별 가중치(마스크)
  const W = mc.w, upOff = gest === 'UPPER_OFF' || (want && want.upper === 0), armsOff = !!(u.holdGlass || u.mic || (want && want.armsOff)), headOff = !!(u.lookAt && !u.moving);
  for (const k of Q.keys()) { const gp = grp(k); let w = W;
    if ((gp === 'armL' || gp === 'armR' || gp === 'fing') && (armsOff || upOff)) w = 0;
    else if ((gp === 'armL' && u.armOffL) || (gp === 'armR' && u.armOffR)) w = 0;   // v67 함께 걷기: 묶인 팔만 IK(pairwalk.js), 나머지는 실측 걸음
    else if (gp === 'head' && (headOff || upOff)) w = upOff ? 0 : W * .25;
    else if (gp === 'spine' && upOff) w = W * .35;
    mc.wb.set(k, w); }
  const PREF = (MC.meta.pref && MC.meta.pref[g]) || 91;
  const sr = any.m.sitRef, prog = sr ? U.clamp((PREF - py) / Math.max(5, PREF - sr), 0, 1) : 1, hk = any.m.kind === 'xyz' ? prog : 1;   // 앉기·일어서기: 수평 이동은 앉는 정도만큼만
  mc.prog = prog; mc.hy = py - PREF; mc.hx = px * hk; mc.hz = pz * hk; mc.seat = want && want.seat ? 1 : 0; mc.seatRef = any.m.sitRef; mc.isOnce = want && want.once;
  MC.stats.frames++;
  return mc;
};

/* ── 앉기 높이 맞춤 + 두 관절 IK(발 바닥 고정) ── */
const _tg = new T.Vector3(), _v = new T.Vector3(), _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _t = new T.Vector3(), _d = new T.Vector3(), _x0 = new T.Vector3(), _x1 = new T.Vector3();
const _q0 = new T.Quaternion(), _q1 = new T.Quaternion(), _q2 = new T.Quaternion(), _ga = new T.Quaternion(), _gb = new T.Quaternion(), _gi = new T.Quaternion();
const acl = x => Math.acos(U.clamp(x, -1, 1));
function ik2(A, B, C, target) {   // A=허벅지, B=종아리, C=발목 뼈 · 무릎 굽힘 방향은 현재 자세 유지(Holden 2017 해석해)
  A.getWorldPosition(_a); B.getWorldPosition(_b); C.getWorldPosition(_c);
  const lab = _b.distanceTo(_a), lcb = _b.distanceTo(_c), lat = U.clamp(target.distanceTo(_a), .01, lab + lcb - .002);
  const ac = _x0.copy(_c).sub(_a), ab = _x1.copy(_b).sub(_a), at = _d.copy(target).sub(_a);
  const ac_ab0 = acl(ac.clone().normalize().dot(ab.clone().normalize())), ba_bc0 = acl(_a.clone().sub(_b).normalize().dot(_c.clone().sub(_b).normalize())), ac_at0 = acl(ac.clone().normalize().dot(at.clone().normalize()));
  const ac_ab1 = acl((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat)), ba_bc1 = acl((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb));
  const ax0 = ac.clone().cross(ab).normalize(), ax1 = ac.clone().cross(at); if (ax0.lengthSq() < 1e-10) return; const l1 = ax1.length();
  A.getWorldQuaternion(_ga); B.getWorldQuaternion(_gb);
  const r0 = _q0.setFromAxisAngle(ax0, ac_ab1 - ac_ab0), r1 = _q1.setFromAxisAngle(ax0, ba_bc1 - ba_bc0), r2 = l1 > 1e-8 ? _q2.setFromAxisAngle(ax1.divideScalar(l1), ac_at0) : _q2.identity();
  // 지역 회전 갱신: L' = L · G⁻¹ · R · G
  _gi.copy(_ga).invert(); A.quaternion.multiply(_gi.clone().multiply(r0).multiply(_ga));
  _gi.copy(_gb).invert(); B.quaternion.multiply(_gi.clone().multiply(r1).multiply(_gb));
  _gi.copy(_ga).invert(); A.quaternion.multiply(_gi.clone().multiply(r2).multiply(_ga));
  A.updateMatrixWorld(true);
}
MC.ik2 = ik2;   // v56 커플 발 고정(humanglb.js coupleBody)에서도 사용
MC.post = (r, mc) => {
  if (!mc || mc.w < .5) return; const u = r.u, Bn = r.Bn; if (!Bn.ulL || !Bn.llL || !Bn.footL || !Bn.ulR || !Bn.llR || !Bn.footR) return;
  r.root.getWorldPosition(_v); const floorY = _v.y;
  if (!mc.rest) { mc.rest = { ank: .104 * (mc.L || 1) }; }   // 모션캡처 배우의 선 자세 발목 높이
  r.model.updateMatrixWorld(true);
  const pel = mc.B.get(PEL);
  if (mc.seat) {   // 골반 = 의자 높이 + 허벅지 두께
    pel.getWorldPosition(_t); const seatY = floorY + (u.seatH || .5) * (r.root.scale.y || 1), wantY = seatY + .1 * (mc.L || 1);
    const prog = mc.isOnce ? mc.prog : 1;
    const dy = (wantY - _t.y) * prog * mc.w; if (Math.abs(dy) > 1e-4) { pel.position.y += dy / (mc.L / 100); r.model.updateMatrixWorld(true); }
  }
  // 발: 앉았을 때는 바닥에 고정, 서 있을 때는 바닥 아래로 들어가면 올림
  const ank = mc.rest.ank;
  for (const [A, B, C] of [[Bn.ulL, Bn.llL, Bn.footL], [Bn.ulR, Bn.llR, Bn.footR]]) {
    C.getWorldPosition(_c); const wantY = floorY + ank, low = _c.y < wantY - .004;
    if (mc.seat ? Math.abs(_c.y - wantY) > .006 : low) { _tg.set(_c.x, wantY, _c.z); ik2(A, B, C, _tg); }
  }
  MC.stats.active++;
};

/* ── 메타(클립 목록·속도·기준 높이) ── */
fetch(BASE_URL + 'manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null).then(m => {
  if (!m) { MC.on = false; return; } MC.meta = m;
  // 자주 쓰는 클립 미리 받기(대기·걷기), 나머지는 필요할 때
  ['f', 'm'].forEach(g => { const L = LIB[g]; [L.idle[0], L.walk.def[0], L.sit[0]].forEach(loadClip); });
});
})();
