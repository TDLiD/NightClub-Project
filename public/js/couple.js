/* couple.js — v39 커플 인터랙션(Partner Interaction) 시스템
 *
 *  기존(v9~v26): 표준 체형으로 미리 구한 관절 각도를 재생 + contact.js 가 관통을 사후에 밀어냄
 *  v39: 매 프레임 '상대의 실제 몸 위치'를 기준으로 목표점을 계산하고 2관절 IK 로 손을 정확히 그 자리에 놓는다.
 *   ■ 팔 IK(어깨·팔꿈치 해석해) — 팔꿈치는 바깥·아래로(폴 벡터), 팔 길이를 넘는 목표는 닿을 수 있는 곳까지
 *   ■ 손 목표점: 상대 허리 옆 · 허리 뒤 · 등 위 · 어깨 위 · 목 뒤 · 위팔 · 볼 · 앞 허리(백허그) · 맞잡은 손(턴)
 *     목표점은 상대 몸통 표면(타원 기둥)에서 1~2cm 바깥 → 관통 없음 (남은 미세 관통은 contact.js 가 마저 처리)
 *   ■ 고개 정렬: 키스·이마·볼·귓속말은 상대 입술/이마/볼/귀를 향해 목·머리를 나눠 돌리고, 키스는 서로 반대로 기울임
 *   ■ 키 차이 보정: 큰 사람은 상체를 숙이고 무릎을 살짝 굽힘, 작은 사람은 까치발(몸 전체 2~5cm)
 *   ■ 단계: Approach → Alignment → Contact → Interaction → Release → Recovery (모든 가중치는 smoothstep)
 *   ■ 블루스 시작은 순간이동 없이 1.4초 동안 걸어와 자리 잡음 · 동작 중 다른 동작/취소로 바로 전환
 *   ■ 손에서 손으로: 💐 장미 꽃다발 · 💌 손편지 · 💍 커플링(실제 3D 소품을 들고 건네고, 반지는 상대 손가락에 남음)
 *   ■ 소파에 기대기(머리를 어깨에 · 팔로 어깨 감싸기) · 러브샷(팔을 걸고 마시기)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.THREE) return;
const T = NC.THREE, U = NC.util, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z), UP = V(0, 1, 0);
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const env = (e, a, b, c, d) => Math.min(sm(a, b, e), 1 - sm(c, d, e));
const KK = () => NC.Karaoke, BLs = () => NC.Karaoke && NC.Karaoke.BL;

/* ═════ 2관절 IK ═════ */
const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler();
function chain(R, sd) {
  const S = R['sh' + sd], E = R['el' + sd], H = E.children.find(c => c.userData.isHand || (c.isGroup && !c.userData.bridge));
  return { S, E, H, L1: Math.abs(E.position.y) || .28, L2: (H ? Math.abs(H.position.y) : .27) + .035 };
}
/* target: 월드 좌표 · w: 0~1 · poleW: 팔꿈치가 향할 방향(월드) · obs: 상대 몸(관통 검사용, 없으면 생략)
 *  ① 목표가 상대 몸 안쪽이면 표면 바깥으로 밀어냄  ② 팔꿈치 회전각(스위블)을 여러 개 시험해 위팔·팔꿈치·아래팔이 상대 몸을 덜 뚫는 자세를 고름 */
const SWIVEL = [0, .35, -.35, .7, -.7, 1.05, -1.05, 1.45, -1.45];
const _ax = V(), _tmp = V();
/* v45 사람처럼: ① 손 목표점은 임계 감쇠 스프링으로 따라감(순간이동·튐 없음) ② 팔꿈치는 145°까지만 굽힘
 *  ③ 팔이 다 펴지는 거리에서는 '소프트 IK'(완전히 펴지 않고 살짝 굽힌 채 멈춤) ④ 팔꿈치 회전각(스위블)은 이전 프레임 값에서 천천히 이동 */
const EL_MAX = 2.53, SOFT = .06;
function ikArm(R, sd, target, w, poleW, obs, opt) {
  if (!target || w <= .001) return null;
  const ch0 = chain(R, sd), { S, E, H: HH } = ch0, par = S.parent; par.updateMatrixWorld(true);
  /* v47 실사 모델이 입혀져 있으면 모델의 실제 어깨 위치·팔 길이로 계산(rig 와 비율이 달라도 모델 손이 정확히 목표에 닿음) */
  const geo = opt && opt.geo, L1 = geo ? geo.L1 : ch0.L1, L2 = geo ? geo.L2 : ch0.L2, S0 = geo ? par.worldToLocal(geo.S.clone()) : S.position.clone();
  const st = S.userData._ik || (S.userData._ik = { p: target.clone(), v: V(), sw: 0, t: performance.now() }), now = performance.now(), dt = Math.min(.05, Math.max(.001, (now - st.t) / 1000)); st.t = now;
  if (!(opt && opt.raw)) {
    if (now - (st.seen || 0) > 400) { st.p.copy(HH ? HH.getWorldPosition(V()) : target); st.v.set(0, 0, 0); }   // 오랜만의 호출은 지금 손 위치에서 출발(순간이동 없음)
    else { const om = (opt && opt.omega) || 9, a = target.clone().sub(st.p).multiplyScalar(om * om).addScaledVector(st.v, -2 * om); st.v.addScaledVector(a, dt); st.p.addScaledVector(st.v, dt); }
    st.seen = now; target = st.p.clone();
  }
  const N = obs && obs.realN ? obs.realN : NC.Contact && NC.Contact.norm;   // v47 상대가 실사 모델이면 실제 뼈 캡슐로 관통 검사
  if (obs && N) { const n0 = N(target, obs); if (n0 < 1.05) { const c = obs.hips.clone().lerp(obs.neck, U.clamp((target.y - obs.hips.y) / Math.max(.01, obs.neck.y - obs.hips.y), 0, 1)); const r = target.clone().sub(c); r.y = 0; if (r.lengthSq() > 1e-6) target = c.clone().add(r.multiplyScalar(1.07 / Math.max(.2, n0))).setY(target.y); } }
  const Lm = L1 + L2, dMin = Math.sqrt(L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos(Math.PI - EL_MAX)), k0 = Lm * (1 - SOFT), pq = par.getWorldQuaternion(new T.Quaternion()).invert();
  /* 주어진 손 목표(월드)에 대해 팔꿈치 회전각 후보를 시험해 가장 덜 뚫는 자세를 찾음 */
  const solve = (tgW, swList) => {
    const v = par.worldToLocal(tgW.clone()).sub(S0), d = v.length(); if (d < 1e-4) return null;
    let dc = Math.max(d, dMin); if (dc > k0) dc = k0 + Lm * SOFT * .93 * (1 - Math.exp(-(dc - k0) / (Lm * SOFT)));   // 소프트 IK: 끝까지 펴지지 않음
    const dir = v.clone().divideScalar(d), A = Math.acos(U.clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1)), bend = Math.PI - Math.acos(U.clamp((L1 * L1 + L2 * L2 - dc * dc) / (2 * L1 * L2), -1, 1));
    const o = (poleW || V(0, -1, 0)).clone().applyQuaternion(pq);   // 폴 방향(월드) → 몸통 로컬
    let pl0 = o.sub(dir.clone().multiplyScalar(o.dot(dir))); if (pl0.lengthSq() < 1e-6) pl0 = V(0, -1, 0).sub(dir.clone().multiplyScalar(-dir.y)); pl0.normalize();
    let best = null;
    for (const sw of swList) {
      const pl = pl0.clone().applyAxisAngle(dir, sw), a1 = dir.clone().multiplyScalar(Math.cos(A)).addScaledVector(pl, Math.sin(A)).normalize();
      let cost = Math.abs(sw) * .02 + Math.abs(sw - st.sw) * .06;   // v45 이전 각도에서 멀수록 비용 → 팔꿈치가 갑자기 뒤집히지 않음
      if (obs && N) { const sp = S0, el = sp.clone().addScaledVector(a1, L1), hd = sp.clone().addScaledVector(dir, dc);
        for (const [pt, k] of [[sp.clone().lerp(el, .5), 1.2], [el, 1.5], [el.clone().lerp(hd, .3), 1.4], [el.clone().lerp(hd, .6), 1.4], [el.clone().lerp(hd, .85), 1]]) { const nn = N(par.localToWorld(pt), obs); if (nn < 1.08) cost += (1.08 - nn) * k * 3; } }
      if (!best || cost < best.cost - 1e-4) best = { cost, sw };
      if (best.cost < .001) break;
    }
    return { cost: best.cost, sw: best.sw, d, dc, dir, A, bend, pl0 };
  };
  const SWL = obs && N ? SWIVEL.map(x => x + st.sw * .5).concat([st.sw]) : [0];
  /* v45 감싸 안기(등 뒤·앞 허리)에서 아래팔이 상대 몸을 뚫으면 손 목표를 팔 쪽 옆구리 방향으로 조금씩 미끄러뜨려 봄(사람 팔이 옆구리를 돌아 감싸듯) */
  let side = null; if (obs && N) { const c = obs.hips.clone().lerp(obs.neck, .6), sh = S.getWorldPosition(V()), rt = (obs.tr || obs.right).clone(); rt.y = 0; rt.normalize(); side = rt.multiplyScalar(Math.sign(sh.sub(c).dot(rt)) || 1); }   // 상대 몸의 좌우축 방향(팔이 있는 쪽)으로만
  st.slide = st.slide || 0; let pick = solve(side ? target.clone().addScaledVector(side, st.slide) : target, SWL), pickS = st.slide;
  if (pick && side && (pick.cost > .015 || st.slide > 0)) for (const sl of [0, .04, .08, .12, .16, st.slide - .03, st.slide + .03]) { if (sl < 0 || sl > .18) continue; const r = solve(target.clone().addScaledVector(side, sl), SWL); if (r && r.cost + sl * .35 < pick.cost + pickS * .35 - 1e-4) { pick = r; pickS = sl; } }
  if (!pick) return null;
  st.slide += U.clamp(pickS - st.slide, -dt * .35, dt * .35);   // 미끄러짐도 천천히
  const fin = side && Math.abs(pickS - st.slide) > 1e-3 ? solve(target.clone().addScaledVector(side, st.slide), [pick.sw]) || pick : pick;
  const best = { sw: pick.sw }, { d, dc, dir, A, bend, pl0 } = fin;
  { const want = best.sw != null ? best.sw : 0, mx = dt * 2.6; st.sw += U.clamp(want - st.sw, -mx, mx); }   // 스위블은 초당 2.6rad 이하로만 이동
  const pl = pl0.clone().applyAxisAngle(dir, st.sw), a1 = dir.clone().multiplyScalar(Math.cos(A)).addScaledVector(pl, Math.sin(A)).normalize(), a2 = dir.clone().multiplyScalar(dc).addScaledVector(a1, -L1).normalize();
  const Y = a1.clone().negate(); let Z = a2.clone().addScaledVector(a1, -a2.dot(a1)); if (Z.lengthSq() < 1e-6) Z = pl.clone(); Z.normalize(); const X = V().crossVectors(Y, Z).normalize();
  _m.makeBasis(X, Y, Z); _q.setFromRotationMatrix(_m); S.quaternion.slerp(_q, w);
  E.rotation.x += (-Math.min(EL_MAX, bend) - E.rotation.x) * w; E.rotation.y *= 1 - w; E.rotation.z *= 1 - w;
  return d - dc;   // 닿지 못한 거리(0 이면 정확히 도달)
}
/* 고개: 목·머리를 나눠 목표점을 향함 · tilt = 좌우 기울임 */
function aimHead(R, target, w, tilt = 0) {
  if (!target || w <= .001) return; const par = R.neck.parent; par.updateMatrixWorld(true);
  const hp = R.head.getWorldPosition(V()).add(V(0, .06, 0)), a = par.worldToLocal(target.clone()), b = par.worldToLocal(hp), d = a.sub(b);
  const yaw = U.clamp(Math.atan2(d.x, d.z), -1.0, 1.0), pitch = U.clamp(Math.atan2(-d.y, Math.hypot(d.x, d.z)), -.45, .75);
  const N = R.neck.rotation, H = R.head.rotation;
  N.x += (pitch * .35 - N.x) * w; N.y += (yaw * .4 - N.y) * w;
  H.x += (pitch * .65 - H.x) * w; H.y += (yaw * .6 - H.y) * w; H.z += (tilt - H.z) * w;
}

/* ═════ 상대 몸의 접촉점 (월드) ═════ */
const _c = [V(), V(), V()];
/* 몸 모델 + 실제 상체·머리 방향(딥처럼 상체가 젖혀져도 등·어깨·볼 위치가 맞게) */
const body = g => { const B = NC.Contact && NC.Contact.body ? NC.Contact.body(g) : null; if (!B) return null; B.g = g;
  const RH = NC.RealHuman; if (RH && RH.body && RH.body(g)) B.realN = p => RH.norm(g, p, ['torso', 'neck', 'head']);   // v47
  const ax = (o, k) => { o.matrixWorld.extractBasis(_c[0], _c[1], _c[2]); return _c[k].clone().normalize(); };
  B.tr = ax(B.R.torso, 0); B.tu = ax(B.R.torso, 1); B.tf = ax(B.R.torso, 2); B.hr = ax(B.R.head, 0); B.hu = ax(B.R.head, 1); B.hf = ax(B.R.head, 2); return B; };
const P = {   // 몸통 점은 상체 축(tr·tu·tf), 얼굴 점은 머리 축(hr·hu·hf) 기준 — 표면에서 1~3cm 바깥
  waistSide: (B, s) => B.hips.clone().addScaledVector(B.tu, .11 * B.sc).addScaledVector(B.tr, s * B.rx * 1.08).addScaledVector(B.tf, -.035 * B.sc),
  lowBack: (B, s) => B.hips.clone().addScaledVector(B.tu, .13 * B.sc).addScaledVector(B.tf, -B.rzB * 1.05).addScaledVector(B.tr, s * B.rx * .62),
  upperBack: (B, s) => B.chest.clone().addScaledVector(B.tu, .02 * B.sc).addScaledVector(B.tf, -B.rzB * 1.08).addScaledVector(B.tr, s * B.rx * .58),
  shoulderTop: (B, s) => B.neck.clone().addScaledVector(B.tu, .045 * B.sc).addScaledVector(B.tr, s * B.rx * .8),
  neckBack: (B, s) => B.neck.clone().addScaledVector(B.tf, -.08 * B.sc).addScaledVector(B.tr, s * .045 * B.sc).addScaledVector(B.tu, .035 * B.sc),
  upperArm: (B, s) => B.neck.clone().addScaledVector(B.tu, -.19 * B.sc).addScaledVector(B.tr, s * B.rx * 1.2),
  frontWaist: (B, s) => B.hips.clone().addScaledVector(B.tu, .1 * B.sc).addScaledVector(B.tf, B.rzF * 1.14).addScaledVector(B.tr, s * .055 * B.sc),
  cheek: (B, s) => B.head.clone().addScaledVector(B.hr, s * B.rh * .95).addScaledVector(B.hf, B.rh * .3).addScaledVector(B.hu, -B.rh * .3),
  lips: B => B.head.clone().addScaledVector(B.hf, B.rh * .95).addScaledVector(B.hu, -B.rh * .38),
  brow: B => B.head.clone().addScaledVector(B.hf, B.rh * .9).addScaledVector(B.hu, B.rh * .3),
  ear: (B, s) => B.head.clone().addScaledVector(B.hr, s * B.rh * 1.04),
};
/* 팔 sd('L'|'R')의 어깨가 상대의 어느 쪽(+1/-1, 상대 right 기준)에 있나 */
const sideOf = (A, sd, B) => { const p = A.R['sh' + sd].getWorldPosition(V()).sub(B.chest); return Math.sign(p.dot(B.tr || B.right)) || 1; };
const pole = (A, sd, k = 1) => { const p = A.R['sh' + sd].getWorldPosition(V()).sub(A.chest); p.y = 0; p.normalize(); return p.multiplyScalar(k).add(V(0, -1, 0)).addScaledVector(A.fwd, -.35); };   // 팔꿈치: 바깥·아래·살짝 뒤

/* ═════ 동작별 목표 ═════ */
const HEAD_ACTS = new Set(['kiss', 'deepkiss', 'forehead', 'cheek', 'whisper']);
function plan(A, B, lead, act, e) {
  // A = 이 사람, B = 상대. 반환: { L, R (손 목표), head, tilt, lean(상체 숙임), toe(까치발), wArm, wHead }
  const sL = sideOf(A, 'L', B), sR = sideOf(A, 'R', B), o = { wArm: 1, wHead: .55 };
  const base = () => { if (lead) { o.L = P.waistSide(B, sL); o.R = P.waistSide(B, sR); } else { o.L = P.shoulderTop(B, sL); o.R = P.shoulderTop(B, sR); } o.head = P.lips(B).addScaledVector(UP, .05); };
  base(); if (!act) return o;
  const k = act.k, acc = act.out === 'accept', D = act.dur, H = act.hit || 1;
  o.w = env(e, 0, Math.min(.9, H), D - .8, D);   // 동작 가중치(접근·정렬 → 접촉 → 해제·복귀)
  const near = (sideA, sideB) => sideA * sideB;   void near;
  if (k === 'hug') { if (lead) { o.L = P.upperBack(B, sL); o.R = P.upperBack(B, sR); } else if (acc) { o.L = P.neckBack(B, sL); o.R = P.upperBack(B, sR); } o.head = null; }
  else if (k === 'waist') { if (lead) { o.L = P.lowBack(B, sL); o.R = P.lowBack(B, sR); } else if (acc) { o.L = P.neckBack(B, sL); o.R = P.neckBack(B, sR); } }
  else if (k === 'whisper') { if (lead) { o.R = P.upperArm(B, sR); o.head = P.ear(B, sR); o.wHead = 1; } else { o.head = acc ? P.lips(B) : null; o.tilt = acc ? -.28 * sR : 0; } }
  else if (k === 'spin') { const top = A.head.clone().lerp(B.head, .5).addScaledVector(UP, .3); if (lead) { o.L = top; o.R = P.waistSide(B, sR); o.hp = { L: 'grip' }; } else { o.R = top; o.L = null; o.hp = { R: 'grip' }; } o.head = null; }
  else if (k === 'dip') { if (lead) { o.R = P.upperBack(B, sR); o.L = P.waistSide(B, sL); o.head = P.lips(B); o.wHead = .8; } else if (acc) { o.L = P.neckBack(B, sL); o.R = null; o.head = P.lips(B); o.wHead = .5; } }
  else if (k === 'forehead') { o.head = P.brow(B); o.wHead = 1; }
  else if (k === 'cheek') { if (lead) { o.L = P.shoulderTop(B, sL); o.head = P.cheek(B, sR); o.wHead = 1; } else if (acc) { o.head = P.lips(B).addScaledVector(B.right, -sR * .1); o.wHead = .5; } }
  else if (k === 'backhug') { if (lead) { o.L = P.frontWaist(B, sL); o.R = P.frontWaist(B, sR); o.head = P.ear(B, sR).addScaledVector(UP, -.05); o.wHead = .7; } else if (acc) { const hL = B.R.elL.children.find(c => c.userData.isHand || (c.isGroup && !c.userData.bridge)), hR = B.R.elR.children.find(c => c.userData.isHand || (c.isGroup && !c.userData.bridge)); o.L = hL && hL.getWorldPosition(V()).addScaledVector(UP, .03); o.R = hR && hR.getWorldPosition(V()).addScaledVector(UP, .03); o.head = null; } }
  else if (k === 'kiss' || k === 'deepkiss') { const deep = k === 'deepkiss';
    if (lead) { o.R = P.cheek(B, sR); o.L = deep ? P.cheek(B, sL) : P.lowBack(B, sL); o.hp = { R: 'cup', L: deep ? 'cup' : 'touch' }; } else if (acc) { o.L = P.neckBack(B, sL); o.R = deep ? P.neckBack(B, sR) : P.upperBack(B, sR); }
    o.head = P.lips(B); o.wHead = 1; o.tilt = (lead ? .24 : -.24); }
  if (!acc && !lead) { o.L = o.R = null; }                                  // 거절: 상대는 손을 뻗지 않음
  if (!acc && lead) o.w *= Math.max(0, 1 - sm(H, H + .35, e)) * .8 + .05;    // 거절당하면 리드의 손이 중간에서 거둬짐
  if (HEAD_ACTS.has(k) && acc) { const dh = A.head.y - B.head.y; o.lean = U.clamp(dh * 1.1, 0, .32) + (k === 'whisper' ? 0 : .06); o.toe = U.clamp(-dh * .45, 0, .05); }   // 큰 사람은 숙이고, 작은 사람은 까치발
  return o;
}

/* ═════ 매 프레임: 블루스 · 소파 · 러브샷 · 건네기 ═════ */
const ST = { sofa: null, love: null, hand: null, stats: { frames: 0, maxMiss: 0 } };
/* v45 순서: ① 몸(숙임·까치발·고개) → ② 슬로댄스 체중 이동·호흡(life) → ③ 마지막에 팔 IK
 *  (v44 까지는 팔을 먼저 놓고 나중에 상체를 숙여서 손이 목표에서 10~25cm 벗어났고, contact.js 가 그걸 관절 각도로 억지로 끌어와 팔이 꺾였음) */
function applyBody(A, o, w) {
  const R = A.R, ww = (o.w ?? 1) * w;
  const hp = o.hp || {}; A.u.handPose = { L: o.L && ww > .5 ? (hp.L || 'touch') : 'relaxed', R: o.R && ww > .5 ? (hp.R || 'touch') : 'relaxed' };   // v40 손 모양: 닿을 땐 손가락을 펴서 표면을 따라, 볼은 감싸듯, 턴은 맞잡기
  if (o.head) aimHead(R, o.head, ww * (o.wHead ?? .5), (o.tilt || 0)); else if (o.tilt) R.head.rotation.z += (o.tilt - R.head.rotation.z) * ww;
  if (o.lean) { R.torso.rotation.x += o.lean * ww; R.knL.rotation.x += o.lean * .4 * ww; R.knR.rotation.x += o.lean * .4 * ww; }
  if (o.toe) R.body.position.y += o.toe * ww;
}
/* 팔: 해석적 2관절 IK(+스프링·소프트 IK·스위블 연속)로 직접 놓고, contact.js 는 남은 관통만 아주 조금 보정 */
function applyArms(A, o, w, Bobs, tgtFn) {
  const R = A.R, ww = (o.w ?? 1) * w, now = performance.now(), aw = A.u._aw || (A.u._aw = { L: { w: 0, p: null }, R: { w: 0, p: null }, t: now }), dt = Math.min(.05, Math.max(0, (now - aw.t) / 1000)); aw.t = now;
  A.u.handTgt = null; A.u.ikLock = { t: now, L: 0, R: 0 };
  A.g.updateMatrixWorld(true);
  for (const sd of ['L', 'R']) {
    const tg = tgtFn ? tgtFn(sd) : o[sd], s2 = aw[sd], want = tg ? ww * (o.wArm ?? 1) : 0; if (tg) s2.p = tg.clone();
    s2.w += (want - s2.w) * Math.min(1, dt * 4.5); if (s2.w < .004 || !s2.p) { s2.w = Math.max(0, s2.w); continue; }
    /* v47 접촉점: 상대가 실사 모델이면 목표를 실제 몸 표면(+손 두께)으로 옮기고 표면 법선을 구함 */
    const RH = NC.RealHuman, hold = o.hp && o.hp[sd] === 'grip', face = o.hp && o.hp[sd] === 'cup', real = Bobs && Bobs.g && RH && RH.project && RH.body && RH.body(Bobs.g);
    const pr = !hold && real ? RH.project(Bobs.g, s2.p, .022, face ? ['head', 'neck'] : ['torso', 'neck']) : null;   // 얼굴 감싸기만 머리에, 나머지는 몸통·목에(목 뒤로 감은 팔이 뒤통수를 뚫지 않게)
    let tgt = pr ? pr.p : s2.p;
    if (hold && real && RH.norm(Bobs.g, tgt, ['head', 'neck']) < 1.35) { const hb = RH.body(Bobs.g); tgt = tgt.clone(); tgt.y = Math.max(tgt.y, hb.hd.y + .17); }   // 턴: 맞잡은 손은 상대 머리 위로 지나가게
    const geo = RH && RH.armGeo ? RH.armGeo(A.g, sd) : null;
    ikArm(R, sd, tgt, s2.w, pole(A, sd), Bobs, geo ? { geo } : null); A.u.ikLock[sd] = s2.w;
    handOrient(R, sd, pr && s2.w > .2 ? pr.n : null, s2.w, dt);
    (A.u.armDbg || (A.u.armDbg = {}))[sd] = { tgt: tgt.clone(), n: pr ? pr.n.clone() : null, w: s2.w };
  }
  for (const sd of ['L', 'R']) if (aw[sd].w < .004) handOrient(R, sd, null, 0, dt);
}
/* v47 손 방향(HandPose): 닿는 손은 손바닥이 상대 몸 쪽(표면 법선 반대), 손가락은 아래팔 방향을 표면에 눕힌 쪽으로.
 *  rig 손 축: 손가락 = -Y, 손바닥 = -Z. 손목 한계(굽힘 65°·비틀림 45°)는 실사 모델 쪽(humanglb.js)에서 최종 강제 */
const _hq = new T.Quaternion(), _hq2 = new T.Quaternion(), _hm = new T.Matrix4();
function handOrient(R, sd, n, w, dt) {
  const E = R['el' + sd], H = E.children.find(c => c.userData.isHand); if (!H) return;
  const st = H.userData._ho || (H.userData._ho = { k: 0 }); st.k += ((n ? w : 0) - st.k) * Math.min(1, dt * 6);
  if (st.k < .005) { if (H.quaternion.w < .99999) H.quaternion.slerp(_hq.identity(), Math.min(1, dt * 6)); return; }
  if (n) { E.updateMatrixWorld(true); const eq = E.getWorldQuaternion(_hq2), fd = V(0, -1, 0).applyQuaternion(eq);   // 아래팔 방향
    let f = fd.clone().addScaledVector(n, -fd.dot(n)); if (f.lengthSq() < 1e-4) f = V(0, -1, 0).addScaledVector(n, n.y); f.normalize();
    const Y = f.clone().negate(), Z = n.clone(), X = V().crossVectors(Y, Z).normalize(); Z.crossVectors(X, Y).normalize();
    _hm.makeBasis(X, Y, Z); st.q = (st.q || new T.Quaternion()).setFromRotationMatrix(_hm).premultiply(eq.clone().invert()); }
  if (st.q) H.quaternion.slerp(st.q, Math.min(1, st.k));
}
const applyPlan = (A, o, w, Bobs) => { applyBody(A, o, w); applyArms(A, o, w, Bobs); };
function tickBlues() {
  const BL = BLs(); if (!BL || !BL.n) return; const n = BL.n, pg = NC.player.group; if (!pg || !n.g.visible) return;
  pg.updateMatrixWorld(true); n.g.updateMatrixWorld(true);
  const A = body(pg), B = body(n.g); if (!A || !B) return;
  const act = BL.act, ua = pg.userData, e = act ? (performance.now() - act.t0) / 1000 : 0;
  const start = sm(0, 1.4, BL.t);                                            // 시작: 손이 천천히 자리 잡음
  const leadA = !!ua.bluesLead;
  const oa = plan(A, B, leadA, act ? { k: act.k, out: ua.bAct ? ua.bAct.out : 'accept', dur: act.dur, hit: act.hit } : null, e);
  const eB = Math.max(0, e - (act && act.vr ? act.vr.lag : LAG));   // v40 상대는 늦게 반응(완벽히 동기화된 움직임 = 인형) · v55 지연을 매번 0.13~0.24초로 다르게
  const ob = plan(B, A, !leadA, act ? { k: act.k, out: n.g.userData.bAct ? n.g.userData.bAct.out : (ua.bAct ? ua.bAct.out : 'accept'), dur: act.dur, hit: act.hit } : null, eB);
  // 동작 중엔 동작 목표, 아니면 기본 블루스 홀드(허리·어깨) — 둘 사이는 o.w 로 섞임
  const mix = (o, isLead) => { if (!act) return o; const bse = plan(isLead ? A : B, isLead ? B : A, isLead, null, 0), w = o.w ?? 1; return { ...o, w: 1, L: blendPt(bse.L, o.L, w), R: blendPt(bse.R, o.R, w), head: blendPt(bse.head, o.head, w), wHead: U.lerp(bse.wHead, o.wHead ?? .55, w), tilt: (o.tilt || 0) * w, lean: (o.lean || 0) * w, toe: (o.toe || 0) * w }; };
  const ma = mix(oa, leadA), mb = mix(ob, !leadA);
  applyBody(A, ma, start); applyBody(B, mb, start);
  life(A, B, act, e, start, 0, leadA); life(B, A, act, eB, start, 1, !leadA);
  /* 몸이 다 움직인 뒤 상대 몸의 접촉점을 다시 구해 팔을 놓음(상대가 숙이거나 젖혀진 최종 위치 기준) */
  pg.updateMatrixWorld(true); n.g.updateMatrixWorld(true); const A2 = body(pg), B2 = body(n.g);
  const ra = plan(A2, B2, leadA, act ? { k: act.k, out: ua.bAct ? ua.bAct.out : 'accept', dur: act.dur, hit: act.hit } : null, e), rb = plan(B2, A2, !leadA, act ? { k: act.k, out: n.g.userData.bAct ? n.g.userData.bAct.out : (ua.bAct ? ua.bAct.out : 'accept'), dur: act.dur, hit: act.hit } : null, eB);
  const fa = mixArms(ra, leadA, A2, B2, act), fb = mixArms(rb, !leadA, B2, A2, act);
  applyArms(A2, { ...ma, L: fa.L, R: fa.R }, start, B2); applyArms(B2, { ...mb, L: fb.L, R: fb.R }, start, A2);
  if (NC.Motion.bridges) { NC.Motion.bridges(ua); NC.Motion.bridges(n.g.userData); }
  ST.stats.frames++;
}
/* v40 살아 있는 몸: ① 박자에 맞춘 슬로댄스 체중 이동(2박에 한 번 좌우, 상대는 거울처럼 · 반 박자 늦게) ② 호흡(가까운 동작일수록 깊게)
 *  ③ 접촉 순간 반응(받는 사람은 숨을 살짝 들이쉬며 상체가 0.5초 동안 미세하게 젖혀졌다 돌아옴) ④ 다가가며 앞쪽 무릎에 체중 */
const LAG = .18, imp = new WeakMap();
function life(A, B, act, e, start, who, lead) {
  const R = A.R, t = performance.now() / 1000, b = NC.Audio && NC.Audio.beat ? NC.Audio.beat() : { phase: (t * 118 / 60) % 1, n: Math.floor(t * 118 / 60) };
  const intimate = act && HEAD_ACTS.has(act.k) ? 1 : act ? .5 : 0, holdW = act ? 1 - (act ? Math.min(1, env(e, 0, .6, act.dur - .6, act.dur)) : 0) : 1;
  const ph = (((b.n % 2) + b.phase) / 2 + (who ? .06 : 0)) * Math.PI * 2, sway = Math.sin(ph) * .032 * holdW * start * (who ? -1 : 1);   // 2박 주기 좌우
  R.hips.rotation.z += sway; R.torso.rotation.z -= sway * .55; R.knL.rotation.x += Math.max(0, Math.sin(ph)) * .07 * holdW * start; R.knR.rotation.x += Math.max(0, -Math.sin(ph)) * .07 * holdW * start;
  const br = Math.sin(t * Math.PI * 2 * (.24 + who * .03) + who * 1.7) * (.008 + .012 * intimate);   // 호흡: 상체·어깨가 아주 조금 오르내림
  R.torso.rotation.x += br; R.neck.rotation.x -= br * .5;
  /* v55 미세 움직임: 고개가 완전히 고정된 마네킹처럼 보이지 않게 아주 느리고 작은 머리 흔들림(서로 다른 주기의 사인 합 = 불규칙하지만 부드러움)
   *  · 얼굴이 맞닿는 동작(키스·이마·볼·귓속말)의 접촉 구간에서는 거의 0 으로 → 얼굴이 서로를 뚫지 않음 · 체중이 실린 쪽 무릎이 아주 살짝 더 굽음(균형 보정) */
  { const cw = act && HEAD_ACTS.has(act.k) ? 1 - env(e, act.hit * .6, act.hit, act.dur - .9, act.dur - .3) : 1, s1 = who ? 1.9 : 0;
    R.head.rotation.y += (Math.sin(t * .41 + s1) * .6 + Math.sin(t * 1.07 + s1 * 2) * .4) * .022 * cw * start;
    R.head.rotation.x += (Math.sin(t * .53 + s1 * 3) * .6 + Math.sin(t * 1.31 + s1) * .4) * .014 * cw * start;
    R.torso.rotation.y += Math.sin(t * .29 + s1 * 1.3) * .012 * start; }
  if (act) {
    let m = imp.get(A.u); const key = act.t0 + ':' + act.k;
    if (!lead && e >= act.hit && (!m || m.key !== key)) { m = { key, t0: t }; imp.set(A.u, m); }
    if (m && m.key === key) { const tt = t - m.t0, k2 = Math.exp(-tt * 6) * Math.sin(Math.min(tt * 9, Math.PI)); R.torso.rotation.x -= .035 * k2; R.neck.rotation.x -= .04 * k2; R.head.rotation.x -= .03 * k2; }
    if (lead) { const w2 = env(e, 0, act.hit, act.dur - .8, act.dur); R.torso.rotation.x += .04 * w2; R.knL.rotation.x += .05 * w2; }   // 리드: 다가가며 상체를 살짝 기울이고 앞 무릎에 체중
  }
}
function mixArms(o, isLead, X, Y, act) { if (!act) return o; const bse = plan(X, Y, isLead, null, 0), w = o.w ?? 1; return { L: blendPt(bse.L, o.L, w), R: blendPt(bse.R, o.R, w) }; }
const blendPt = (a, b, w) => (!a && !b) ? null : !a ? (w > .02 ? b : null) : !b ? (w < .98 ? a : null) : a.clone().lerp(b, w);

/* 소파에 기대기: 상대는 머리를 내 어깨에 기대고, 나는 가까운 팔로 상대의 먼 어깨를 감쌈 */
function tickSofa(dt) {
  const s = ST.sofa; if (!s) return; s.t += dt; const n = s.n, pg = NC.player.group;
  if (s.t > s.dur || !n.g.visible || !NC.player.seat) { ST.sofa = null; return; }
  pg.updateMatrixWorld(true); n.g.updateMatrixWorld(true); const A = body(pg), B = body(n.g); if (!A || !B) return;
  const w = env(s.t, .3, 1.6, s.dur - 1.2, s.dur);
  const toA = A.neck.clone().sub(B.neck); const side = Math.sign(toA.x * B.right.x + toA.z * B.right.z) || 1;
  const R = B.R; R.torso.rotation.z += (side * -.22 - R.torso.rotation.z) * w * .9;   // 상대 상체가 내 쪽으로 기울어짐
  aimHead(R, A.neck.clone().addScaledVector(UP, .02), w * .6, side * -.35);
  const sdA = A.R.shL.getWorldPosition(V()).distanceTo(B.chest) < A.R.shR.getWorldPosition(V()).distanceTo(B.chest) ? 'L' : 'R';   // 상대와 가까운 쪽 팔
  ikArm(A.R, sdA, P.shoulderTop(B, -side), w * .9, pole(A, sdA).addScaledVector(UP, 1.2), B);                                            // → 상대의 먼 어깨를 감쌈
  aimHead(A.R, B.head, w * .3, 0);
}
/* 러브샷: 서로 가까운 손(잔)을 상대 팔에 걸고 각자 입으로 */
function tickLove(dt) {
  const s = ST.love; if (!s) return; s.t += dt; const n = s.n, pg = NC.player.group; if (s.t > s.dur) { ST.love = null; pg.userData.holdGlass = s.g0; n.g.userData.holdGlass = s.g1; return; }
  pg.updateMatrixWorld(true); n.g.updateMatrixWorld(true); const A = body(pg), B = body(n.g); if (!A || !B) return;
  const w = env(s.t, 0, .9, s.dur - .7, s.dur);
  for (const [X, Y] of [[A, B], [B, A]]) {
    const sd = X.R.shL.getWorldPosition(V()).distanceTo(Y.chest) < X.R.shR.getWorldPosition(V()).distanceTo(Y.chest) ? 'L' : 'R';   // 상대 쪽 팔(잔)
    const mouth = P.lips(X).addScaledVector(X.fwd, .05).addScaledVector(UP, -.02);
    ikArm(X.R, sd, mouth, w, Y.chest.clone().sub(X.chest).setY(0).normalize().add(V(0, -.6, 0)));   // 팔꿈치를 상대 쪽으로 → 서로 팔이 걸림
    aimHead(X.R, mouth.clone().addScaledVector(X.fwd, .3), w * .4, 0);
  }
}

/* ═════ 손에서 손으로 건네는 소품 ═════ */
const M = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: new T.Color(c), roughness: .55 }, o));
function makeProp(kind) {
  const g = new T.Group();
  if (kind === 'rose') {
    const wrap = new T.Mesh(new T.ConeGeometry(.07, .26, 14, 1, true), M('#f2e8dc', { side: T.DoubleSide, roughness: .8 })); wrap.rotation.x = Math.PI; wrap.position.y = .02; g.add(wrap);
    const stem = new T.Mesh(new T.CylinderGeometry(.012, .012, .2, 6), M('#2f6a2a')); stem.position.y = -.08; g.add(stem);
    const petal = M('#b0102a', { roughness: .45 }), leaf = M('#2f7a3a');
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = i ? .04 : 0; const b = new T.Mesh(new T.SphereGeometry(.026, 10, 8), petal); b.position.set(Math.cos(a) * r, .15 + (i ? 0 : .012), Math.sin(a) * r); b.scale.set(1, .8, 1); g.add(b); }
    for (let i = 0; i < 4; i++) { const l = new T.Mesh(new T.SphereGeometry(.03, 6, 4), leaf); const a = i * 1.6; l.position.set(Math.cos(a) * .055, .12, Math.sin(a) * .055); l.scale.set(.5, .25, 1); l.rotation.y = a; g.add(l); }
    const rib = new T.Mesh(new T.TorusGeometry(.024, .006, 6, 16), M('#ff5fa8')); rib.rotation.x = Math.PI / 2; rib.position.y = -.07; g.add(rib);
  } else if (kind === 'letter') {
    g.add(new T.Mesh(new T.BoxGeometry(.13, .085, .004), M('#f6f0e6', { roughness: .9 })));
    const flap = new T.Mesh(new T.ConeGeometry(.066, .04, 4), M('#ece2d2', { roughness: .9 })); flap.rotation.set(Math.PI / 2, Math.PI / 4, 0); flap.scale.set(1.4, .1, 1); flap.position.set(0, .02, .003); g.add(flap);
    const seal = new T.Mesh(new T.CylinderGeometry(.011, .011, .004, 14), M('#c0203a', { roughness: .3 })); seal.rotation.x = Math.PI / 2; seal.position.z = .005; g.add(seal);
  } else if (kind === 'ring') {
    const box = new T.Mesh(new T.BoxGeometry(.05, .03, .05), M('#5a0e2a', { roughness: .9 })); g.add(box);
    const lid = new T.Mesh(new T.BoxGeometry(.05, .012, .05), M('#5a0e2a', { roughness: .9 })); lid.position.set(0, .03, -.024); lid.rotation.x = -1.1; g.add(lid);
    const ring = new T.Mesh(new T.TorusGeometry(.012, .0028, 8, 22), M('#e8c56a', { metalness: 1, roughness: .18 })); ring.position.y = .022; ring.userData.ring = true; g.add(ring);
    const gem = new T.Mesh(new T.OctahedronGeometry(.005), M('#ffffff', { metalness: .2, roughness: .02, emissive: new T.Color('#aaccff'), emissiveIntensity: .4 })); gem.position.y = .036; g.add(gem);
  }
  return g;
}
const handOf = (R, sd) => R['el' + sd].children.find(c => c.userData.isHand || (c.isGroup && !c.userData.bridge));
/* 건네기: 0~1.1 리드가 손을 내밀어 두 사람 사이로 · .7~1.5 상대가 손을 뻗어 받음 · 1.5 소품이 상대 손으로 넘어감 · 1.5~2.6 상대가 가슴께로 가져가고 리드 손은 돌아감 */
function handoff(n, kind, onGiven) {
  if (ST.hand) return; const pg = NC.player.group, prop = makeProp(kind), A = pg.userData.rig;
  const sdA = 'R', h = handOf(A, sdA); if (!h) return onGiven && onGiven();
  prop.position.set(0, -.07, .03); h.add(prop);
  ST.hand = { n, kind, prop, t: 0, given: false, onGiven, sdA, sdB: 'L' };
}
function tickHand(dt) {
  const s = ST.hand; if (!s) return; s.t += dt; const n = s.n, pg = NC.player.group;
  pg.updateMatrixWorld(true); n.g.updateMatrixWorld(true); const A = body(pg), B = body(n.g); if (!A || !B) { cleanupHand(); return; }
  const mid = A.chest.clone().lerp(B.chest, .5).addScaledVector(UP, -.05 * A.sc);
  const sdB = A.R['sh' + s.sdA].getWorldPosition(V()).distanceTo(B.R.shL.getWorldPosition(V())) < A.R['sh' + s.sdA].getWorldPosition(V()).distanceTo(B.R.shR.getWorldPosition(V())) ? 'L' : 'R'; s.sdB = s.sdB || sdB;
  const wA = env(s.t, 0, 1.0, 1.6, 2.5), wB = env(s.t, .6, 1.35, s.kind === 'ring' ? 9 : 6.5, s.kind === 'ring' ? 10 : 7.5);
  ikArm(A.R, s.sdA, mid.clone().addScaledVector(A.fwd, -.02), wA, pole(A, s.sdA), B);
  const holdB = s.t < 1.5 ? mid.clone().addScaledVector(B.fwd, -.03) : (s.kind === 'ring' ? mid.clone().addScaledVector(UP, .1).addScaledVector(B.fwd, -.06) : B.chest.clone().addScaledVector(B.fwd, B.rzF + .09).addScaledVector(UP, .02));
  ikArm(B.R, sdB, holdB, wB, pole(B, sdB), A);
  aimHead(A.R, s.t < 1.6 ? mid : B.head, env(s.t, 0, .6, 2.2, 2.8) * .6); aimHead(B.R, s.t < 1.5 ? mid : (s.kind === 'ring' ? holdB : A.head), env(s.t, .4, .9, 5, 6.5) * .7);
  if (!s.given && s.t > 1.5) {   // 손에서 손으로 넘김(월드 위치 유지)
    s.given = true; const hb = handOf(B.R, sdB); if (hb) { hb.attach(s.prop); }
    if (s.kind === 'ring') {   // 반지: 상자는 리드가 다시 가져가고, 반지는 상대 손가락에 남음
      const ring = s.prop.children.find(c => c.userData.ring); if (ring && hb) { const r2 = ring.clone(); r2.position.set(-.012, -.088, .016); r2.rotation.set(Math.PI / 2, 0, 0); r2.scale.setScalar(.8); hb.add(r2); n.g.userData.coupleRing = r2; }
      s.prop.visible = false; }
    s.onGiven && s.onGiven();
  }
  if (s.t > (s.kind === 'ring' ? 10.2 : 7.8)) cleanupHand();
}
function cleanupHand() { const s = ST.hand; if (!s) return; if (s.prop.parent) s.prop.parent.remove(s.prop); s.prop.traverse(o => { if (o.geometry) o.geometry.dispose(); }); ST.hand = null; }

/* ═════ 틱: 모든 포즈가 정해진 뒤 · contact.js(관통 보정) 바로 앞에서 실행 ═════ */
function TICK(dt) { try { tickBlues(); tickSofa(dt); tickLove(dt); tickHand(dt); } catch (e) { console.error('[couple]', e); } }
{ const L = NC.tickers, i = NC.Contact ? L.indexOf(NC.Contact.tick) : -1; if (i >= 0) L.splice(i + 1, 0, TICK); else L.push(TICK); }   // v45 contact.js(몸 간격 조정) 뒤에 실행 → 최종 몸 위치 기준으로 손을 놓음

NC.Couple = {
  ST, ikArm, aimHead, plan, handoff, makeProp, bodyX: body,
  sofa(n, dur = 14) { ST.sofa = { n, t: 0, dur }; },
  loveshot(n, dur = 3.4) { const pg = NC.player.group; ST.love = { n, t: 0, dur, g0: pg.userData.holdGlass, g1: n.g.userData.holdGlass }; pg.userData.holdGlass = n.g.userData.holdGlass = true; },
};
console.info('[couple] v45 스프링 IK · 소프트 IK · 팔꿈치 한계 / v39 커플 인터랙션: 2관절 IK 손 배치 · 고개 정렬 · 키 차이 보정 · 손에서 손으로 소품 전달');
})();
