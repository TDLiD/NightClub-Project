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
  if (obs && N) { const n0 = N(target, obs); if (n0 < 1.07) {   /* v63 문턱값(1.05)과 밀어낸 위치(1.07) 사이에 틈이 있어 경계에서 손 목표가 매 프레임 튀었음 → 1.07 에서 이어지게 */ const c = obs.hips.clone().lerp(obs.neck, U.clamp((target.y - obs.hips.y) / Math.max(.01, obs.neck.y - obs.hips.y), 0, 1)); const r = target.clone().sub(c); r.y = 0; if (r.lengthSq() > 1e-6) target = c.clone().add(r.multiplyScalar(1.07 / Math.max(.2, n0))).setY(target.y); } }
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
  let side = null; if (obs && N) { const c = obs.hips.clone().lerp(obs.neck, .6), sh = S.getWorldPosition(V()), rt = (obs.tr || obs.right).clone(); rt.y = 0; rt.normalize(); const dd = sh.sub(c).dot(rt); if (Math.abs(dd) > .04 || !st.sg) st.sg = Math.sign(dd) || 1; side = rt.multiplyScalar(st.sg); }   // 상대 몸의 좌우축 방향(팔이 있는 쪽)으로만 · v68 히스테리시스(±4cm): 어깨가 상대 몸 가운데 근처에서 부호가 매 프레임 뒤집혀 손 목표가 몸 양쪽으로 최대 18cm씩 번갈아 튀던(볼 뽀뽀·귓속말 중 손 떨림) 원인
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
function aimHead(R, target, w, tilt = 0, origin = null, fwdHint = null) {   // v56 origin: 보이는(실사) 머리 중심 — rig 머리는 7~15cm 높아 키 작은 사람이 상대 입술을 '내려다보던' 원인
  if (!target || w <= .001) return; const par = R.neck.parent; par.updateMatrixWorld(true);
  /* v56 얼굴이 아주 가까우면(수평 30cm 안) '상대 입술' 방향이 머리 중심 바로 옆·아래가 되어 고개가 좌우로 튀고(±57°) 푹 숙여졌음 → 몸 정면 방향으로 30cm 앞의 같은 높이 차를 봄 */
  if (origin && fwdHint) { const v = target.clone().sub(origin), h = Math.hypot(v.x, v.z); if (h < .45) { const k = U.clamp((.45 - h) / .2, 0, 1), dy = U.clamp(v.y, -.16, .12); const fx = fwdHint.x * .3, fz = fwdHint.z * .3; v.x = v.x * (1 - k) + fx * k; v.z = v.z * (1 - k) + fz * k; v.y = v.y * (1 - k) + dy * k; target = origin.clone().add(v); } }
  const hp = origin ? origin.clone() : R.head.getWorldPosition(V()).add(V(0, .06, 0)), a = par.worldToLocal(target.clone()), b = par.worldToLocal(hp), d = a.sub(b);
  const yaw = U.clamp(Math.atan2(d.x, d.z), -1.0, 1.0), pitch = U.clamp(Math.atan2(-d.y, Math.hypot(d.x, d.z)), -.45, .75);
  const N = R.neck.rotation, H = R.head.rotation;
  N.x += (pitch * .35 - N.x) * w; N.y += (yaw * .4 - N.y) * w;
  H.x += (pitch * .65 - H.x) * w; H.y += (yaw * .6 - H.y) * w; H.z += (tilt - H.z) * w;
}

/* ═════ 상대 몸의 접촉점 (월드) ═════ */
const _c = [V(), V(), V()];
/* 몸 모델 + 실제 상체·머리 방향(딥처럼 상체가 젖혀져도 등·어깨·볼 위치가 맞게) */
const body = g => { const B = NC.Contact && NC.Contact.body ? NC.Contact.body(g) : null; if (!B) return null; B.g = g;
  const RH = NC.RealHuman, rb = RH && RH.body && RH.body(g); if (rb) B.realN = p => RH.norm(g, p, ['torso', 'neck', 'head']);   // v47
  /* v56 실사 모델이 입혀져 있으면 엉덩이·가슴·목·머리 위치를 '보이는 몸'의 뼈에서 잼 — 절차적 rig 는 모델과 비율이 달라 목이 7~15cm(한국인 모델은 30cm) 높았고,
   *  그래서 키 큰 사람이 작은 상대의 어깨가 아니라 머리 위 허공으로 손을 뻗었음 */
  const r = rb && g.userData.real, Bn = r && r.Bn; if (Bn && Bn.hips && Bn.neck && Bn.head) { const w = o => o.getWorldPosition(V());
    B.hips = w(Bn.hips); B.neck = w(Bn.neck); B.head = rb.hd.clone(); B.chest = w(Bn.chest || Bn.spine || Bn.hips).lerp(B.neck, .45); B.real = true;
    const ul = Bn.uaL && w(Bn.uaL), ur = Bn.uaR && w(Bn.uaR); if (ul && ur) B.rx = Math.max(B.rx * .8, Math.min(B.rx * 1.15, ul.distanceTo(ur) * .5 + .02)); }
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
  /* v69 동작 전용 접촉점(모두 옷 위 바깥 표면) */
  chestFront: (B, s) => B.chest.clone().addScaledVector(B.tu, -.035 * B.sc).addScaledVector(B.tf, B.rzF * 1.1).addScaledVector(B.tr, s * B.rx * .42),
  buttock: (B, s) => B.hips.clone().addScaledVector(B.tu, -.07 * B.sc).addScaledVector(B.tf, -B.rzB * 1.12).addScaledVector(B.tr, s * B.rx * .48),
  waistband: (B, s) => B.hips.clone().addScaledVector(B.tu, .045 * B.sc).addScaledVector(B.tf, B.rzF * 1.08).addScaledVector(B.tr, s * B.rx * .5),
  palmChest: (B, s) => B.chest.clone().addScaledVector(B.tu, .01 * B.sc).addScaledVector(B.tf, B.rzF * 1.12).addScaledVector(B.tr, s * B.rx * .35),
};
/* v69 내 몸 기준 점(손을 내린 휴식 자세·딥에서 뻗은 팔) — self 표시로 상대 몸에 투영하지 않음 */
const SELF = {
  rest: (A, sd) => { const ss = sideOf(A, sd, A); return A.hips.clone().addScaledVector(A.tr, ss * A.rx * 1.32).addScaledVector(A.tu, -.07 * A.sc).addScaledVector(A.tf, .035 * A.sc); },
  reach: (A, sd) => { const ss = sideOf(A, sd, A); return A.neck.clone().addScaledVector(A.tr, ss * .52 * A.sc).addScaledVector(A.tu, -.12 * A.sc).addScaledVector(A.tf, -.06 * A.sc); },
};
/* 팔 sd('L'|'R')의 어깨가 상대의 어느 쪽(+1/-1, 상대 right 기준)에 있나 */
/* v68 히스테리시스: 어깨가 상대 몸 가운데 축 근처(±3cm)면 이전 판단 유지 — 부호가 프레임마다 뒤집혀 손 목표가 상대 몸 반대편으로 순간이동하던(볼 뽀뽀 중 손 16cm 떨림) 원인 */
const sideOf = (A, sd, B) => { const p = A.R['sh' + sd].getWorldPosition(V()).sub(B.chest), d = p.dot(B.tr || B.right), M = A.u._sideM || (A.u._sideM = {}), key = sd + (B.g ? B.g.uuid : ''); if (Math.abs(d) > .03 || M[key] == null) M[key] = Math.sign(d) || 1; return M[key]; };
const pole = (A, sd, k = 1) => { const p = A.R['sh' + sd].getWorldPosition(V()).sub(A.chest); p.y = 0; p.normalize(); return p.multiplyScalar(k).add(V(0, -1, 0)).addScaledVector(A.fwd, -.35); };   // 팔꿈치: 바깥·아래·살짝 뒤

/* ═════ 동작별 목표 ═════ */
const HEAD_ACTS = new Set(['kiss', 'deepkiss', 'forehead', 'cheek', 'whisper']);
function plan(A, B, lead, act, e) {
  // A = 이 사람, B = 상대. 반환: { L, R (손 목표), head, tilt, lean(상체 숙임), toe(까치발), wArm, wHead }
  const sL = sideOf(A, 'L', B), sR = sideOf(A, 'R', B), o = { wArm: 1, wHead: .55 };
  /* v56 키 차이(머리 높이 차 dh) 보정 — 홀드 자세를 키에 맞게 다시 계산(Motion Warping):
   *  · 손을 어깨에 얹는 사람이 상대보다 크면(dh>0) 손을 어깨 위 → 어깨 앞·위팔 쪽으로 낮춤(팔꿈치가 들리지 않게), 많이 작으면(dh<-0.15) 역시 위팔 쪽으로
   *  · 큰 사람: 무릎을 굽혀 몸을 낮춤(10cm 차이 ≈ 1.8cm, 무릎 약 5°) + 상체를 살짝 숙임 · 작은 사람: 앞꿈치로 서서(10cm 차이 ≈ 1.8cm) 몸을 올림 */
  /* v68 되먹임 제거: 키 차이는 '선 자세 머리 높이'로 잼 — 보정된(숙이고·까치발 든) 지금 머리로 재면 보정이 다음 프레임 보정을 바꿔 1cm씩 위아래로 떨렸음 */
  const RHr = NC.RealHuman, hA = RHr && RHr.restHead && RHr.restHead(A.g), hB = RHr && RHr.restHead && RHr.restHead(B.g);
  const dh = (hA != null && hB != null) ? hA - hB : A.head.y - B.head.y; o.dh = dh;
  const base = () => {
    if (lead) { o.L = P.waistSide(B, sL); o.R = P.waistSide(B, sR); }
    else { const kq = U.clamp((dh - .03) / .14, 0, .75) + U.clamp((-dh - .15) / .15, 0, .6); o.L = P.shoulderTop(B, sL).lerp(P.upperArm(B, sL), kq); o.R = P.shoulderTop(B, sR).lerp(P.upperArm(B, sR), kq); }
    o.head = P.brow(B).lerp(P.lips(B), .5); o.wHead = .45; o.hp = { L: 'hold', R: 'hold' };   // 눈맞춤: 상대 얼굴(눈 높이)을 봄 — 머리를 관통해 먼 곳을 보지 않음
    o.drop = U.clamp(dh * .18, 0, .03); o.lean = U.clamp((dh - .04) * .28, 0, .04); o.toe = dh < -.05 ? U.clamp(-dh * .18, 0, .028) : 0; };
  base(); if (!act) return o;
  const k = act.k, acc = act.out === 'accept', D = act.dur, H = act.hit || 1;
  o.w = env(e, 0, Math.min(.9, H), D - .8, D);   // 동작 가중치(접근·정렬 → 접촉 → 해제·복귀)
  const near = (sideA, sideB) => sideA * sideB;   void near;
  if (k === 'hug') { const ht = (act.vr && act.vr.hug) || 'warm';
    /* v56 포옹 3가지(호감도): 친구 = 가슴 사이 간격을 두고 등 위쪽을 가볍게(손바닥) · 따뜻한 = 등 위·아래를 감싸 안음 · 연인 = 상대 목에 팔을 두르고 머리를 어깨에 기댐 */
    if (lead) { if (ht === 'friend') { o.L = P.upperBack(B, sL); o.R = P.upperBack(B, sR); } else if (ht === 'warm') { o.L = P.upperBack(B, sL); o.R = P.lowBack(B, sR); } else { o.L = P.lowBack(B, sL); o.R = P.upperBack(B, sR); } }
    else if (acc) { if (ht === 'romantic') { o.L = P.neckBack(B, sL); o.R = P.neckBack(B, sR); } else if (ht === 'warm') { o.L = P.neckBack(B, sL); o.R = P.upperBack(B, sR); } else { o.L = P.upperBack(B, sL); o.R = P.upperBack(B, sR); } }
    o.head = ht === 'romantic' && !lead ? P.shoulderTop(B, sR).addScaledVector(UP, .02) : null; o.wHead = .5; o.hp = { L: 'touch', R: 'touch' }; }
  else if (k === 'waist') { if (lead) { o.L = P.lowBack(B, sL); o.R = P.lowBack(B, sR); } else if (acc) { o.L = P.palmChest(B, sL); o.R = P.palmChest(B, sR); o.hp = { L: 'touch', R: 'touch' }; } }   // v69 끌려온 상대: 두 손바닥을 리드 가슴에(목에 감던 홀드와 다른 모양)
  else if (k === 'whisper') { if (lead) { o.R = P.upperArm(B, sR); o.head = P.ear(B, sR); o.wHead = 1; o.L = A.neck.clone().addScaledVector(A.tu, .085 * A.sc).addScaledVector(A.tf, .13 * A.sc).addScaledVector(A.tr, sR * .06 * A.sc); o.hp = { L: 'cup', R: 'touch' }; o.selfL = true; }   // v69 입가 손: 머리(얼굴 IK 로 계속 움직임) 대신 목·상체 축 기준 → 손이 머리 움직임을 따라 떨리지 않음   /* v62 반대손으로 입가를 살짝 가림(상대 귀 쪽) */
    else if (acc) { o.head = P.lips(B); o.tilt = -.28 * sR; o.L = P.palmChest(B, sL); o.R = SELF.rest(A, 'R'); o.selfR = true; o.hp = { L: 'touch' }; }   /* v69 듣는 사람: 고개를 기울이고 한 손은 리드 가슴에, 다른 손은 내림(홀드 팔 해제) */
    else { o.head = null; o.L = o.R = null; } }
  else if (k === 'spin') { const top = A.head.clone().lerp(B.head, .5).addScaledVector(UP, .3); if (lead) { o.L = top; o.R = SELF.rest(A, 'R'); o.selfR = true; o.hp = { L: 'grip' }; } else { o.R = top; o.L = SELF.rest(A, 'L'); o.selfL = true; o.hp = { R: 'grip' }; } o.head = null; }   // v69 잡은 손만 머리 위로, 반대 팔은 몸 옆으로(홀드 해제 → 회전이 한눈에 보임)
  else if (k === 'dip') { if (lead) { o.R = P.upperBack(B, sR); o.L = P.waistSide(B, sL); o.head = P.lips(B); o.wHead = .8; } else if (acc) { o.L = P.neckBack(B, sL); o.R = SELF.reach(A, 'R'); o.selfR = true; o.head = P.lips(B); o.wHead = .35; } }   // v69 젖혀지는 사람: 한 팔은 리드 목에, 다른 팔은 옆으로 우아하게 뻗음
  else if (k === 'forehead') { o.head = P.brow(B); o.wHead = 1; if (lead) { o.L = P.upperArm(B, sL); o.R = P.upperArm(B, sR); o.hp = { L: 'touch', R: 'touch' }; } else if (acc) { o.L = P.palmChest(B, sL); o.R = P.palmChest(B, sR); o.hp = { L: 'touch', R: 'touch' }; } }   // v69 이마 맞대기: 리드는 두 손으로 위팔을 감싸고, 상대는 두 손을 리드 가슴에
  else if (k === 'cheek') { if (lead) { o.L = P.shoulderTop(B, sL); o.R = SELF.rest(A, 'R'); o.selfR = true; o.head = P.cheek(B, sR); o.wHead = 1; } else if (acc) { o.head = P.lips(B).addScaledVector(B.right, -sR * .1); o.wHead = .5; o.L = P.upperArm(B, sL); o.R = SELF.rest(A, 'R'); o.selfR = true; } }   // v69 볼 뽀뽀: 리드 한 손은 어깨, 한 손은 내림 · 상대는 리드 팔에 손을 얹음
  else if (k === 'backhug') { if (lead) { o.L = P.frontWaist(B, sL); o.R = P.frontWaist(B, sR); o.head = P.ear(B, sR).addScaledVector(UP, -.05); o.wHead = .7; } else if (acc) { const hL = B.R.elL.children.find(c => c.userData.isHand || (c.isGroup && !c.userData.bridge)), hR = B.R.elR.children.find(c => c.userData.isHand || (c.isGroup && !c.userData.bridge)); o.L = hL && hL.getWorldPosition(V()).addScaledVector(UP, .03); o.R = hR && hR.getWorldPosition(V()).addScaledVector(UP, .03);
      /* v56 실사 모델이면 '보이는' 상대 손 위에 손을 얹음(rig 손은 실제 손과 10cm 가까이 어긋나 손이 허공에 떠 있었음) — 내 왼·오른 어깨에 가까운 손끼리 짝 */
      const RB = B.g.userData.real && B.g.userData.real.Bn; if (RB && RB.handL && RB.handR && A.R.shL) { const h1 = RB.handL.getWorldPosition(V()), h2 = RB.handR.getWorldPosition(V()), sl = A.R.shL.getWorldPosition(V());
        const near1 = h1.distanceTo(sl) < h2.distanceTo(sl); o.L = (near1 ? h1 : h2).addScaledVector(UP, .035); o.R = (near1 ? h2 : h1).addScaledVector(UP, .035); }
      o.head = B.head.clone().lerp(A.head, .2); o.wHead = .35; } }   // 고개를 살짝 돌려 뒤의 상대 쪽을 봄
  else if (k === 'kiss' || k === 'deepkiss') { const deep = k === 'deepkiss';
    if (lead) { o.R = P.cheek(B, sR); o.L = deep ? P.cheek(B, sL) : P.lowBack(B, sL); o.hp = { R: 'cup', L: deep ? 'cup' : 'touch' }; } else if (acc) { o.L = P.neckBack(B, sL); o.R = deep ? P.neckBack(B, sR) : P.upperBack(B, sR); }
    o.head = P.lips(B); o.wHead = 1; o.tilt = (lead ? .24 : -.24); }
  /* v69 신체 접촉 3종: 손이 실제 접촉점(옷 위)으로 감 — 전에는 손 목표가 없어 홀드 자세(허리) 그대로였음 */
  else if (k === 'butt') { if (lead) { o.R = P.buttock(B, sR); o.L = SELF.rest(A, 'L'); o.selfL = true; o.hp = { R: 'touch' }; o.head = P.lips(B); o.wHead = .4; } else if (acc) { o.L = P.palmChest(B, sL); o.R = P.shoulderTop(B, sR); o.head = P.buttock(A, sR).lerp(A.hips, .3); o.wHead = .35; o.lean = .05; } }   // v69 한 손만 엉덩이(다른 손은 내림) · 상대는 고개를 살짝 돌려 그 손을 보며 리드 가슴·어깨에 손
  else if (k === 'chest') { if (lead) { o.R = P.chestFront(B, sR); o.L = P.waistSide(B, sL); o.hp = { R: 'touch' }; } else if (acc) { o.R = P.upperArm(B, sR); o.L = SELF.rest(A, 'L'); o.selfL = true; } }
  else if (k === 'undress') { if (lead) { o.L = P.waistband(B, sL); o.R = P.waistband(B, sR); o.hp = { L: 'grip', R: 'grip' }; } else if (acc) { o.L = SELF.rest(A, 'L'); o.R = SELF.rest(A, 'R'); o.selfL = o.selfR = true; o.head = P.lips(B); o.wHead = .3; } else { const ss = s0 => sideOf(A, s0, A), wb = s0 => A.hips.clone().addScaledVector(A.tu, .06 * A.sc).addScaledVector(A.tf, A.rzF * 1.08 + .035).addScaledVector(A.tr, ss(s0) * A.rx * .5); o.L = wb('L'); o.R = wb('R'); o.selfL = o.selfR = true; o.hp = { L: 'grip', R: 'grip' }; } }   // 옷 정리/속옷: 리드 두 손이 허리춤 앞을 잡고, 상대는 그 손등 위로 손목을 붙잡아 막음(거절이어도 손을 뻗음)
  if (!acc && !lead && k !== 'undress') { o.L = o.R = null; }                // 거절: 상대는 손을 뻗지 않음
  if (!acc && lead && !(k === 'undress' && act.out === 'stop')) o.w *= Math.max(0, 1 - sm(H, H + .35, e)) * .8 + .05;    // 거절당하면 리드의 손이 중간에서 거둬짐 · v69 옷 정리(속옷)는 '제지'여도 상대가 손목을 붙잡은 채로 유지(손이 허리춤에 남음)
  o.hp = o.hp && o.hp.L === 'hold' ? null : o.hp;
  /* v56 얼굴 접촉 동작의 키 맞춤: 상체를 크게 숙이지 않음(실제 사람은 고개·목으로 맞춤) — 큰 사람은 살짝(최대 0.13rad) 숙이고 무릎을 굽히고, 작은 사람은 앞꿈치로 섬. 나머지 높이는 얼굴 IK(목·머리)가 맞춤 */
  if (HEAD_ACTS.has(k) && acc) { o.lean = U.clamp(dh * .55, 0, .11) + (k === 'whisper' ? .02 : .025); o.toe = U.clamp(-dh * .35, 0, .035); o.drop = U.clamp(dh * .25, 0, .04); }   // 큰 사람은 숙이고, 작은 사람은 까치발
  return o;
}

/* ═════ 매 프레임: 블루스 · 소파 · 러브샷 · 건네기 ═════ */
const ST = { sofa: null, love: null, hand: null, stats: { frames: 0, maxMiss: 0 } };
/* v45 순서: ① 몸(숙임·까치발·고개) → ② 슬로댄스 체중 이동·호흡(life) → ③ 마지막에 팔 IK
 *  (v44 까지는 팔을 먼저 놓고 나중에 상체를 숙여서 손이 목표에서 10~25cm 벗어났고, contact.js 가 그걸 관절 각도로 억지로 끌어와 팔이 꺾였음) */
function applyBody(A, o, w) {
  const R = A.R, ww = (o.w ?? 1) * w;
  const hp = o.hp || {}; A.u.handPose = { L: o.L && ww > .5 ? (hp.L || 'touch') : 'relaxed', R: o.R && ww > .5 ? (hp.R || 'touch') : 'relaxed' };   // v40 손 모양: 닿을 땐 손가락을 펴서 표면을 따라, 볼은 감싸듯, 턴은 맞잡기
  /* v68 서로를 보는 두 머리의 되먹임 차단: 시선 목표(상대 귀·입술·눈)는 상대 머리가 움직인 결과라, 그대로 쓰면 두 사람이 한 프레임씩 늦게 서로를 쫓으며 왕복함
   *  → 목표점을 사람마다 임계 감쇠 스프링(약 0.12초)으로 따라가게 함(실제 사람도 시선·고개는 상대 움직임을 살짝 늦게 따라감) */
  if (o.head) { const now = performance.now(), hs = A.u._headS || (A.u._headS = { p: o.head.clone(), v: V(), t: now }), hdt = Math.min(.05, Math.max(0, (now - hs.t) / 1000)); hs.t = now;
    if (hs.p.distanceTo(o.head) > .6 || hdt === 0) { hs.p.copy(o.head); hs.v.set(0, 0, 0); } else { const om = 16, ac = o.head.clone().sub(hs.p).multiplyScalar(om * om).addScaledVector(hs.v, -2 * om); hs.v.addScaledVector(ac, hdt); hs.p.addScaledVector(hs.v, hdt); }
    o.head = hs.p.clone(); }
  if (o.head) aimHead(R, o.head, ww * (o.wHead ?? .5), (o.tilt || 0), A.real ? A.head.clone().addScaledVector(UP, -.07) : null, A.fwd);   // 기준점 = 눈~입 높이 else if (o.tilt) R.head.rotation.z += (o.tilt - R.head.rotation.z) * ww;
  if (o.lean) { R.torso.rotation.x += o.lean * ww; if (!A.real) { R.knL.rotation.x += o.lean * .4 * ww; R.knR.rotation.x += o.lean * .4 * ww; } }   // 실사 모델은 무릎을 발 고정 IK 가 굽힘
  /* v56 키 맞춤 높이: 실사 모델은 coupleBody(humanglb)가 몸을 낮추거나(drop)·올리고(toe) 발을 바닥에 고정한 채 다리 IK 로 무릎·발목을 맞춤 */
  const fp = A.u.footPlant || (A.u.footPlant = {}); fp.t = performance.now(); fp.w = w * w * w; fp.drop = (o.drop || 0) * w; fp.toe = (o.toe || 0) * w;
  if (o.toe && !A.real) R.body.position.y += o.toe * ww * .35;
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
    const pr = !hold && !o['self' + sd] && real ? RH.project(Bobs.g, s2.p, .022, face ? ['head', 'neck'] : ['torso', 'neck']) : null;   // v68 내 몸(내 입가)을 가리키는 손은 상대 몸 표면으로 투영하지 않음 — 귓속말 중 입가를 가린 손이 상대 머리 캡슐 경계에서 투영됐다 안 됐다 하며 10~16cm 튀던 원인   // 얼굴 감싸기만 머리에, 나머지는 몸통·목에(목 뒤로 감은 팔이 뒤통수를 뚫지 않게)
    let tgt = pr ? pr.p : s2.p;
    if (hold && real && RH.norm(Bobs.g, tgt, ['head', 'neck']) < 1.35) { const hb = RH.body(Bobs.g); tgt = tgt.clone(); tgt.y = Math.max(tgt.y, hb.hd.y + .17); }   // 턴: 맞잡은 손은 상대 머리 위로 지나가게
    const geo = RH && RH.armGeo ? RH.armGeo(A.g, sd) : null;
    const self = !!o['self' + sd];   // v68 내 얼굴을 가리키는 손: 상대 몸 회피 탐색(이산 스위블 후보) 없이 — 상대 머리 바로 옆이라 후보 선택이 프레임마다 바뀌며 팔꿈치가 뒤집혔음
    ikArm(R, sd, tgt, s2.w, pole(A, sd), self ? null : Bobs, Object.assign(geo ? { geo } : {}, self ? { omega: 6 } : {})); A.u.ikLock[sd] = s2.w;
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
  const mix = (o, isLead) => { if (!act) return o; const bse = plan(isLead ? A : B, isLead ? B : A, isLead, null, 0), w = o.w ?? 1; return { ...o, w: 1, L: blendPt(bse.L, o.L, w), R: blendPt(bse.R, o.R, w), head: blendPt(bse.head, o.head, w), wHead: U.lerp(bse.wHead, o.wHead ?? .55, w), tilt: (o.tilt || 0) * w, lean: U.lerp(bse.lean || 0, o.lean || 0, w), toe: U.lerp(bse.toe || 0, o.toe || 0, w), drop: U.lerp(bse.drop || 0, o.drop || 0, w), hp: w > .5 ? o.hp : bse.hp }; };
  const ma = mix(oa, leadA), mb = mix(ob, !leadA);
  /* v56 얼굴 접촉(실사 모델 머리·목·가슴 CCD, humanglb faceIK): 키스는 입술끼리 가운데서 만나고 서로 반대로 고개 기울임 · 이마는 이마끼리 · 볼 키스는 리드 입술 → 상대 볼 · 귓속말은 리드 입 → 상대 귀 */
  { const acc = !act ? false : (ua.bAct ? ua.bAct.out : 'accept') === 'accept', now = performance.now();
    const set = (g, partner, ee, isLead) => { const u = g.userData; if (!act || !acc || !HEAD_ACTS.has(act.k)) { u.faceTgt = null; return; }
      const hh = (g.userData.look && g.userData.look.height || 1.7) - (partner.userData.look && partner.userData.look.height || 1.7), sh = U.clamp(.5 + hh * 1.6, .3, .7);   // 키 큰 사람이 더 많이 숙이고 작은 사람은 덜 듦(목이 과하게 젖혀지지 않게)
      const k = act.k, w = env(ee, act.hit * .5, act.hit + .1, act.dur - .9, act.dur - .25); let o = null;
      if (k === 'kiss' || k === 'deepkiss') o = { mode: 'lips', share: sh, tilt: (isLead ? 1 : -1) * (k === 'deepkiss' ? .12 : .08) * ((act.vr && act.vr.amp) || 1), gap: k === 'deepkiss' ? .004 : .01 };
      else if (k === 'forehead') o = { mode: 'brow', share: sh, tilt: 0, gap: .006 };
      else if (k === 'cheek') o = isLead ? { mode: 'cheek', side: 1, share: .85, tilt: .12, gap: .008 } : { mode: 'lips', share: 0, tilt: -.1, gap: .05 };
      else if (k === 'whisper') o = isLead ? { mode: 'ear', side: 1, share: .85, tilt: .08, gap: .03 } : null;
      u.faceTgt = o ? Object.assign(o, { t: now, w, partner }) : null; };
    set(pg, n.g, e, leadA); set(n.g, pg, eB, !leadA); }
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
  if (NC.Couple && NC.Couple.noLife) return;   // 시험용 끄기
  const R = A.R, t = performance.now() / 1000, b = NC.Audio && NC.Audio.beat ? NC.Audio.beat() : { phase: (t * 118 / 60) % 1, n: Math.floor(t * 118 / 60) };
  const intimate = act && HEAD_ACTS.has(act.k) ? 1 : act ? .5 : 0, holdW = act ? 1 - (act ? Math.min(1, env(e, 0, .6, act.dur - .6, act.dur)) : 0) : 1;
  /* v56 사람마다 ±10% 다른 리듬(진폭·위상·반응) — 매번 똑같이 반복되는 루프 = 로봇 */
  const pz = A.u._pz || (A.u._pz = { amp: .9 + Math.random() * .2, tw: .85 + Math.random() * .3, ph: (Math.random() - .5) * .08, mNext: t + 3 + Math.random() * 2, m: null });
  const ph = (((b.n % 2) + b.phase) / 2 + (who ? .06 : 0) + pz.ph) * Math.PI * 2, sn = Math.sin(ph), sg = who ? -1 : 1, sway = sn * .032 * holdW * start * sg * pz.amp;   // 2박 주기 좌우
  /* 체중 이동: 엉덩이가 디딤발 쪽으로 좌우 3~4cm(왕복 6~8cm) 이동 — 발은 coupleBody 의 발 고정 IK 가 바닥에 붙잡아 둠(미끄러짐 없음)
   *  척추 S자: 엉덩이 기울기 → 허리는 반대로 → 목은 다시 같은 쪽(3관절 보정으로 머리는 수평 유지) · 상체 비틀림은 반 박자 늦게 */
  R.hips.rotation.z += sway; R.torso.rotation.z -= sway * .62; R.neck.rotation.z += sway * .28; R.torso.rotation.y += Math.sin(ph - .9) * .045 * holdW * start * sg * pz.tw;
  if (!A.real) { R.knL.rotation.x += Math.max(0, sn) * .07 * holdW * start; R.knR.rotation.x += Math.max(0, -sn) * .07 * holdW * start; }
  /* 미세 조정: 3~5초마다 한 번, 1.6초 동안 무게중심을 한쪽으로 살짝 옮기고 고개를 갸웃(정해진 순서 없음) */
  if (t > pz.mNext) { pz.m = { t0: t, sx: (Math.random() - .5) * .03, tilt: (Math.random() - .5) * .12 }; pz.mNext = t + 3 + Math.random() * 2; }
  const mk = pz.m ? Math.sin(Math.PI * U.clamp((t - pz.m.t0) / 1.6, 0, 1)) : 0;
  A.u.swayOff = { x: (sn * .035 * pz.amp * holdW * sg + (pz.m ? pz.m.sx * mk : 0)) * start, z: 0 };
  if (pz.m) { R.head.rotation.z += pz.m.tilt * mk * start * (act && HEAD_ACTS.has(act.k) ? .2 : 1); }
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
/* v56 디버그 보기(주소에 ?ikdebug 또는 NC.Couple.debug(true)): 충돌 캡슐(청록) · 손 IK 목표(노랑 십자, 굵기 = 가중치) · 고정된 발(분홍 원) · 무게중심(흰 선) */
let DBG = /[?&]ikdebug\b/.test(location.search), dbgObj = null;
function dbgDraw() {
  const BL = BLs(), on = DBG && BL && BL.n; if (!on) { if (dbgObj) dbgObj.visible = false; return; }
  const P = [], C = [], push = (a, b, c) => { P.push(a.x, a.y, a.z, b.x, b.y, b.z); C.push(c[0], c[1], c[2], c[0], c[1], c[2]); };
  const ring = (c, r, col, up = UP) => { const t1 = Math.abs(up.y) > .9 ? V(1, 0, 0) : V(0, 1, 0), a1 = V().crossVectors(up, t1).normalize(), a2 = V().crossVectors(up, a1); let pr = null; for (let i = 0; i <= 12; i++) { const an = i / 12 * Math.PI * 2, q = c.clone().addScaledVector(a1, Math.cos(an) * r).addScaledVector(a2, Math.sin(an) * r); if (pr) push(pr, q, col); pr = q; } };
  for (const g of [NC.player.group, BL.n.g]) { const RH = NC.RealHuman, b = RH && RH.body && RH.body(g); const u = g.userData;
    if (b) for (const c of b.C) { const col = c.tag === 'arm' ? [.2, .8, 1] : c.tag === 'leg' ? [.3, .6, 1] : [0, 1, .8], ax = c.b.clone().sub(c.a), l = ax.length(), up = l > 1e-4 ? ax.divideScalar(l) : UP; ring(c.a, c.ra, col, up); ring(c.b, c.rb, col, up); const s1 = V().crossVectors(up, V(0, 1, 0)).lengthSq() > 1e-4 ? V().crossVectors(up, V(0, 1, 0)).normalize() : V(1, 0, 0); push(c.a.clone().addScaledVector(s1, c.ra), c.b.clone().addScaledVector(s1, c.rb), col); push(c.a.clone().addScaledVector(s1, -c.ra), c.b.clone().addScaledVector(s1, -c.rb), col); }
    const D = u.armDbg || {}; for (const sd of ['L', 'R']) { const d = D[sd]; if (!d || d.w < .05) continue; const s = .04 * (.4 + d.w); for (const a of [V(s, 0, 0), V(0, s, 0), V(0, 0, s)]) push(d.tgt.clone().sub(a), d.tgt.clone().add(a), [1, .9, .1]); }
    const r = u.real; if (r && r.fp) for (const sd of ['L', 'R']) { const st = r.fp[sd]; if (st) ring(V(st.p.x, NC.groundY ? NC.groundY(st.p.x, st.p.z) + .005 : st.p.y, st.p.z), .07, st.from ? [1, .6, .2] : [1, .3, .7]); }
    if (r && r.Bn && r.Bn.hips) { const h = r.Bn.hips.getWorldPosition(V()); push(h, V(h.x, NC.groundY ? NC.groundY(h.x, h.z) : 0, h.z), [1, 1, 1]); } }
  if (!dbgObj) { const m = new T.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: .95 }); dbgObj = new T.LineSegments(new T.BufferGeometry(), m); dbgObj.renderOrder = 999; dbgObj.frustumCulled = false; NC.scene.add(dbgObj); }
  dbgObj.visible = true; dbgObj.geometry.setAttribute('position', new T.Float32BufferAttribute(P, 3)); dbgObj.geometry.setAttribute('color', new T.Float32BufferAttribute(C, 3));
}
function TICK(dt) { try { tickBlues(); tickSofa(dt); tickLove(dt); tickHand(dt); dbgDraw(); } catch (e) { console.error('[couple]', e); } }
{ const L = NC.tickers, i = NC.Contact ? L.indexOf(NC.Contact.tick) : -1; if (i >= 0) L.splice(i + 1, 0, TICK); else L.push(TICK); }   // v45 contact.js(몸 간격 조정) 뒤에 실행 → 최종 몸 위치 기준으로 손을 놓음

NC.Couple = {
  ST, ikArm, aimHead, plan, handoff, makeProp, bodyX: body, debug(on = true) { DBG = !!on; },
  sofa(n, dur = 14) { ST.sofa = { n, t: 0, dur }; },
  loveshot(n, dur = 3.4) { const pg = NC.player.group; ST.love = { n, t: 0, dur, g0: pg.userData.holdGlass, g1: n.g.userData.holdGlass }; pg.userData.holdGlass = n.g.userData.holdGlass = true; },
};
console.info('[couple] v45 스프링 IK · 소프트 IK · 팔꿈치 한계 / v39 커플 인터랙션: 2관절 IK 손 배치 · 고개 정렬 · 키 차이 보정 · 손에서 손으로 소품 전달');
})();
