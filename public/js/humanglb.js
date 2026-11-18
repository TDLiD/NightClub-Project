/* humanglb.js — v41 실사 디지털 휴먼(GLB) 하이브리드 연동
 *  ■ 가까이 있는 사람(카메라 근거리 N명)만 전문 리깅된 실사 GLB 모델로 바꿔 입히고, 멀어지면 다시 스킨드 절차적 몸으로 돌아감.
 *    → 근거리: 실사 얼굴·손가락·피부 / 중·원거리: 가벼운 절차적 몸(군중 성능 유지)
 *  ■ 기존 rig(관절 Group)는 그대로 움직이고 GLB 뼈가 매 프레임 그 회전을 따라감(리타깃) → 춤·앉기·커플 동작·노래방이 코드 수정 없이 동작
 *  ■ 지원 뼈 이름: Mixamo(mixamorig*), Ready Player Me, Character Creator(CC_Base_*), Unreal/MetaHuman 내보내기(upperarm_l…), Blender Rigify(DEF-*)
 *  ■ 손가락: 검지~새끼 3마디 + 엄지 → rig 손가락(v40 손 모양) 그대로 따라감 · 쇄골: 팔 들면 25% 같이 올라감
 *  ■ 얼굴: ARKit 블렌드셰이프(eyeBlinkLeft, jawOpen, mouthSmileLeft …) 또는 RPM viseme_* 가 있으면 표정·깜빡임·말하기·시선 자동 연결
 *  ■ 설정: public/models/humans/manifest.json (없으면 조용히 꺼짐 — 기존 동작 그대로)
 *     { "near": 6, "max": 4, "maxMobile": 1,
 *       "models": [ { "url": "models/humans/m_01.glb", "gender": "m", "label": "남성 01" },
 *                   { "url": "models/humans/f_01.glb", "gender": "f", "skin": ["Body","Head"] } ] }
 *     페르소나 고정: npcs.json 의 인물에 "realModel": "models/humans/f_02.glb" (거리와 무관하게 항상 실사)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const T = NC.THREE, U = NC.util, Q = NC.quality || {};
const RH = NC.RealHuman = { ok: !!T.GLTFLoader, list: [], cfg: null, cache: new Map(), stats: { attached: 0, loads: 0 } };
if (!RH.ok) { RH.attach = () => Promise.resolve(null); return; }
const loader = new T.GLTFLoader(); if (window.MeshoptDecoder && loader.setMeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);   // v46 압축 GLB

/* ── 뼈 이름 정규화 + 후보 ── */
const norm = n => String(n || '').toLowerCase().replace(/^(mixamorig\d*[:_]?|cc_base_|rig[:_]|def[-_]|armature[|:_]|bip0?1[ _]?|b_|j_bip_c_|j_)/, '').replace(/[\s_.:-]/g, '');
const SIDE = { R: ['right', 'r'], L: ['left', 'l'] };
function cands(base, side) {   // side: 'R'|'L'|null
  if (!side) return base;
  const o = []; for (const b of base) for (const s of SIDE[side]) { o.push(s + b, b + s); } return o;
}
const HB = {   // 휴머노이드 키 → 이름 후보(정규화 후 비교)
  hips: () => ['hips', 'pelvis', 'hip', 'root'],
  spine: () => ['spine', 'spine01', 'spine1', 'waist', 'spinelower'],
  chest: () => ['spine2', 'spine02', 'chest', 'spine03', 'upperchest', 'spineupper'],
  neck: () => ['neck', 'neck01', 'neck1'],
  head: () => ['head'],
  clav: s => cands(['shoulder', 'clavicle', 'collar', 'clavicle'], s),
  ua: s => cands(['arm', 'upperarm', 'uparm'], s),
  la: s => cands(['forearm', 'lowerarm', 'elbow'], s),
  hand: s => cands(['hand', 'wrist'], s),
  ul: s => cands(['upleg', 'thigh', 'upperleg'], s),
  ll: s => cands(['leg', 'calf', 'lowerleg', 'shin', 'knee'], s),
  foot: s => cands(['foot', 'ankle'], s),
};
const FING = ['index', 'middle', 'ring', 'pinky'];
function findBones(root) {
  const all = []; root.traverse(o => { if (o.isBone || o.type === 'Bone') all.push(o); });
  const by = new Map(); all.forEach(b => { const k = norm(b.name); if (!by.has(k)) by.set(k, b); });
  const get = list => { for (const n of list) { const b = by.get(n); if (b) return b; } return null; };
  const B = { hips: get(HB.hips()), spine: get(HB.spine()), chest: get(HB.chest()), neck: get(HB.neck()), head: get(HB.head()) };
  for (const s of ['R', 'L']) {
    B['clav' + s] = get(HB.clav(s)); B['ua' + s] = get(HB.ua(s)); B['la' + s] = get(HB.la(s)); B['hand' + s] = get(HB.hand(s));
    B['ul' + s] = get(HB.ul(s)); B['ll' + s] = get(HB.ll(s)); B['foot' + s] = get(HB.foot(s));
    FING.forEach((fn, i) => { for (let k = 1; k <= 3; k++) B[`f${s}${i}_${k}`] = get(cands([`hand${fn}${k}`, `${fn}${k}`, `${fn}0${k}`, `finger${fn}${k}`, `${fn}finger${k}`], s)); });
    for (let k = 1; k <= 3; k++) B[`t${s}_${k}`] = get(cands([`handthumb${k}`, `thumb${k}`, `thumb0${k}`, `fingerthumb${k}`], s));
    /* v46 3ds Max Biped(Rocketbox): Finger0=엄지, Finger1~4=검지~새끼, 마디는 FingerN · FingerN1 · FingerN2 */
    FING.forEach((fn, i) => { const n = i + 1; if (!B[`f${s}${i}_1`]) B[`f${s}${i}_1`] = get(cands([`finger${n}`], s)); if (!B[`f${s}${i}_2`]) B[`f${s}${i}_2`] = get(cands([`finger${n}1`], s)); if (!B[`f${s}${i}_3`]) B[`f${s}${i}_3`] = get(cands([`finger${n}2`], s)); });
    if (!B[`t${s}_1`]) { B[`t${s}_1`] = get(cands(['finger0'], s)); B[`t${s}_2`] = get(cands(['finger01'], s)); B[`t${s}_3`] = get(cands(['finger02'], s)); }
    B['eye' + s] = get(cands(['eye'], s));
  }
  // 'arm' 후보가 forearm 을 먼저 잡는 것 방지 / 'leg' 가 upleg 를 잡는 것 방지
  for (const s of ['R', 'L']) { if (B['ua' + s] && B['ua' + s] === B['la' + s]) B['la' + s] = null; if (B['ul' + s] && B['ul' + s] === B['ll' + s]) B['ll' + s] = null; }
  return B;
}

/* ── SkinnedMesh 안전 복제(SkeletonUtils.clone 과 같은 방식) ── */
function par(a, b, cb) { cb(a, b); for (let i = 0; i < a.children.length; i++) par(a.children[i], b.children[i], cb); }
function cloneSkinned(src) {
  const sL = new Map(), cL = new Map(), c = src.clone();
  par(src, c, (s, d) => { sL.set(d, s); cL.set(s, d); });
  c.traverse(n => { if (!n.isSkinnedMesh) return; const s = sL.get(n); n.skeleton = s.skeleton.clone(); n.bindMatrix.copy(s.bindMatrix); n.skeleton.bones = s.skeleton.bones.map(b => cL.get(b)); n.bind(n.skeleton, n.bindMatrix); });
  return c;
}

/* ── ARKit / viseme 얼굴 ── */
const AK = {
  smile: { mouthSmileLeft: .6, mouthSmileRight: .6, cheekSquintLeft: .25, cheekSquintRight: .25 },
  laugh: { mouthSmileLeft: .95, mouthSmileRight: .95, jawOpen: .32, cheekSquintLeft: .55, cheekSquintRight: .55, eyeSquintLeft: .4, eyeSquintRight: .4 },
  joy: { mouthSmileLeft: .85, mouthSmileRight: .85, cheekSquintLeft: .4, cheekSquintRight: .4 },
  shy: { mouthSmileLeft: .35, mouthSmileRight: .35, eyeLookDownLeft: .35, eyeLookDownRight: .35 },
  sad: { mouthFrownLeft: .6, mouthFrownRight: .6, browInnerUp: .7, mouthPucker: .1 },
  annoyed: { browDownLeft: .7, browDownRight: .7, mouthPressLeft: .5, mouthPressRight: .5, noseSneerLeft: .2, noseSneerRight: .2 },
  angry: { browDownLeft: .9, browDownRight: .9, mouthPressLeft: .6, mouthPressRight: .6, noseSneerLeft: .45, noseSneerRight: .45, jawForward: .2 },
  surprised: { jawOpen: .38, browInnerUp: .85, browOuterUpLeft: .7, browOuterUpRight: .7, eyeWideLeft: .65, eyeWideRight: .65 },
  wink: { eyeBlinkRight: 1, mouthSmileLeft: .45, mouthSmileRight: .3 },
  kiss: { mouthPucker: .8, mouthFunnel: .25, eyeBlinkLeft: .6, eyeBlinkRight: .6 },
  neutral: {},
};
function faceRig(root) {
  const M = []; root.traverse(o => { if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) M.push(o); });
  if (!M.length) return null;
  const keys = new Set(); M.forEach(m => Object.keys(m.morphTargetDictionary).forEach(k => keys.add(k)));
  const lower = new Map(); keys.forEach(k => lower.set(k.toLowerCase().replace(/^(blendshape\d*\.|arkit_?)/, ''), k));
  const find = n => lower.get(n.toLowerCase());
  return { M, find, has: n => !!find(n), cur: new Map() };
}
function setMorph(F, name, w) { const k = F.find(name); if (!k) return; F.cur.set(k, w); }
function flushMorph(F, dt) {
  const a = 1 - Math.exp(-dt * 14);
  for (const m of F.M) { const d = m.morphTargetDictionary, inf = m.morphTargetInfluences; for (const k in d) { const t = F.cur.get(k) || 0; inf[d[k]] += (t - inf[d[k]]) * a; } }
  F.cur.clear();
}

/* ── 로드 · 부착 ── */
const LOADED = new Set();
function load(url) { if (!RH.cache.has(url)) { RH.stats.loads++; RH.cache.set(url, new Promise((res, rej) => loader.load(url, g => { LOADED.add(url); res(g); }, undefined, rej))); } return RH.cache.get(url); }
const DOWN = new T.Vector3(0, -1, 0), V1 = new T.Vector3(), V2 = new T.Vector3(), qA = new T.Quaternion(), qB = new T.Quaternion(), qR = new T.Quaternion(), qI = new T.Quaternion(), qC = new T.Quaternion(), box = new T.Box3();
const FIT = ['torso', 'neck', 'head', 'shL', 'elL', 'shR', 'elR', 'legL', 'knL', 'legR', 'knR'];

/* ═════ v47 손 컨트롤러(HandPoseController) ═════
 *  v41~v46 은 rig 손 회전을 '뼈 방향'만 맞춰 복사해서, rig 손바닥(-Z)과 모델 손바닥(T포즈에서 아래)이 90° 어긋나 손목이 비틀려 보였음.
 *  → 모델 손의 실제 축(손가락 방향·손바닥 방향)을 쟀다가 rig 손의 같은 두 축에 맞춰 회전을 만들고,
 *    아래팔 기준 손목 한계(굽힘·젖힘 65°, 비틀림 45°)를 쿼터니언 스윙-트위스트로 강제함.
 *  손가락: 모델 손가락마다 '손바닥 쪽으로 접히는 축'을 구해 rig 손가락 굽힘량(마디별)을 그 축으로만 적용 → 옆으로 꺾이거나 뒤로 젖혀지지 않음. */
const _m4 = new T.Matrix4(), _x = new T.Vector3(), _y = new T.Vector3(), _z = new T.Vector3();
function basisQ(f, p, out) {   // f = 손가락 방향, p = 손바닥 방향 → 직교 기저 쿼터니언
  _x.copy(f).normalize(); _y.copy(p).addScaledVector(_x, -p.dot(_x)).normalize(); _z.crossVectors(_x, _y);
  _m4.makeBasis(_x, _y, _z); return out.setFromRotationMatrix(_m4);
}
const WR = { twist: .78, swing: 1.13 };   // 손목 한계(rad): 비틀림 45° · 굽힘/젖힘 65°
function handCtl(hand, Bn, ms, rs) {
  const H = Bn['hand' + ms], LA = Bn['la' + ms], mid = Bn[`f${ms}1_1`], idx = Bn[`f${ms}0_1`], pin = Bn[`f${ms}3_1`];
  if (!H || !LA || !mid || !idx || !pin || H.parent !== LA && !LA.children.includes(H.parent)) return null;
  H.updateMatrixWorld(true);
  const wp = o => o.getWorldPosition(new T.Vector3()), hq = H.getWorldQuaternion(new T.Quaternion()), hqi = hq.clone().invert();
  const fL = wp(mid).sub(wp(H)).applyQuaternion(hqi).normalize();                       // 손 로컬: 손가락 방향
  const pL = new T.Vector3(0, -1, 0).applyQuaternion(hqi); pL.addScaledVector(fL, -pL.dot(fL)).normalize();   // T포즈 손바닥 = 아래
  const bq = basisQ(fL, pL, new T.Quaternion()).invert();
  const fing = [];
  for (let i = 0; i < 4; i++) for (let k = 1; k <= 3; k++) { const b = Bn[`f${ms}${i}_${k}`]; if (!b) continue; const nx = Bn[`f${ms}${i}_${k + 1}`] || (k < 3 ? null : null);
    const bqi = b.getWorldQuaternion(new T.Quaternion()).invert(), dir = (nx ? wp(nx).sub(wp(b)) : wp(b).sub(wp(b.parent))).applyQuaternion(bqi).normalize(), pal = new T.Vector3(0, -1, 0).applyQuaternion(bqi);
    const ax = new T.Vector3().crossVectors(dir, pal); if (ax.lengthSq() < 1e-6) continue; fing.push({ b, i, k, rest: b.quaternion.clone(), ax: ax.normalize() }); }
  const th = []; for (let k = 1; k <= 3; k++) { const b = Bn[`t${ms}_${k}`]; if (!b) continue; const nx = Bn[`t${ms}_${k + 1}`];
    const bqi = b.getWorldQuaternion(new T.Quaternion()).invert(), dir = (nx ? wp(nx).sub(wp(b)) : wp(b).sub(wp(b.parent))).applyQuaternion(bqi).normalize(), pal = new T.Vector3(0, -1, 0).applyQuaternion(bqi), ax = new T.Vector3().crossVectors(dir, pal);
    if (ax.lengthSq() > 1e-6) th.push({ b, k, rest: b.quaternion.clone(), ax: ax.normalize() }); }
  return { rig: hand, rs, ms, H, LA, fL, pL, bq, rest: H.quaternion.clone(), restI: H.quaternion.clone().invert(), fing, th, q: new T.Quaternion(), init: false };
}
const _q1 = new T.Quaternion(), _q2 = new T.Quaternion(), _q3 = new T.Quaternion(), _v1 = new T.Vector3(), _v2 = new T.Vector3(), _ax = new T.Vector3();
function clampTwistSwing(q, axis, tMax, sMax) {   // q 를 axis 둘레 비틀림 + 나머지 스윙으로 나눠 각각 한계 적용
  const d = q.x * axis.x + q.y * axis.y + q.z * axis.z; _q1.set(axis.x * d, axis.y * d, axis.z * d, q.w); if (_q1.lengthSq() < 1e-9) _q1.identity(); else _q1.normalize();
  _q2.copy(_q1).invert().premultiply(q);   // swing = q * twist^-1
  const lim = (qq, m) => { if (qq.w < 0) { qq.x = -qq.x; qq.y = -qq.y; qq.z = -qq.z; qq.w = -qq.w; } const a = 2 * Math.acos(Math.min(1, qq.w)); if (a > m) { const k = Math.sin(m / 2) / Math.max(1e-6, Math.sin(a / 2)); qq.x *= k; qq.y *= k; qq.z *= k; qq.w = Math.cos(m / 2); } };
  lim(_q1, tMax); lim(_q2, sMax); return q.copy(_q2).multiply(_q1);
}
function applyHand(c, R, dt) {
  const rq = c.rig.getWorldQuaternion(_q3);
  _v1.set(0, -1, 0).applyQuaternion(rq); _v2.set(0, 0, -1).applyQuaternion(rq);                 // rig 손: 손가락 = -Y, 손바닥 = -Z
  const want = basisQ(_v1, _v2, new T.Quaternion()).multiply(c.bq);                            // 모델 손의 월드 회전
  const lw = c.H.parent.getWorldQuaternion(_q1.clone()).invert().multiply(want);              // 부모(아래팔) 기준
  const delta = c.restI.clone().multiply(lw); clampTwistSwing(delta, c.fL, WR.twist, WR.swing);   // 손목 한계
  const tgt = c.rest.clone().multiply(delta);
  if (!c.init) { c.q.copy(tgt); c.init = true; } else c.q.slerp(tgt, 1 - Math.exp(-dt * 22));   // 아주 짧은 감쇠(떨림 방지)
  c.H.quaternion.copy(c.q);
  const F = c.rig.userData.fingers || [], th = c.rig.userData.thumb;
  for (const f of c.fing) { const rf = F[f.i]; if (!rf) continue; const curl = f.k === 1 ? Math.max(0, rf.k1.rotation.x - .05) : f.k === 2 ? Math.max(0, rf.k2.rotation.x) : Math.max(0, rf.k2.rotation.x * .7);
    f.b.quaternion.copy(f.rest).multiply(_q2.setFromAxisAngle(f.ax, Math.min(1.45, curl))); }
  if (th) { const c0 = Math.max(0, th.rotation.x - .3); for (const t of c.th) t.b.quaternion.copy(t.rest).multiply(_q2.setFromAxisAngle(t.ax, t.k === 1 ? .22 + c0 * .35 : .12 + c0 * .5)); }
}
/* ═════ v47 몸 충돌체(BodyCollisionSystem) — 실사 모델의 실제 뼈 위치로 매 프레임 갱신하는 캡슐 ═════
 *  몸통(좌우 2줄 · 아래는 골반 폭, 위는 어깨 폭) · 목 · 머리 · 위팔 · 아래팔 · 허벅지. norm(p) < 1 이면 안쪽(관통) */
function capsules(r) {
  const B = r.Bn, w = o => o ? o.getWorldPosition(new T.Vector3()) : null, k = r.sc;
  const hp = w(B.hips), sp = w(B.spine || B.chest), ch = w(B.chest || B.spine), nk = w(B.neck), hd = w(B.head);
  if (!hp || !ch || !nk || !hd) return null;
  const uL = w(B.uaL), uR = w(B.uaR), tL = w(B.ulL), tR = w(B.ulR), rt = (uL && uR ? uL.clone().sub(uR) : new T.Vector3(1, 0, 0)), sw = rt.length(); rt.normalize();
  const hw = tL && tR ? tL.distanceTo(tR) : sw * .55, up = hd.clone().sub(nk).normalize(), fw = new T.Vector3().crossVectors(rt, up).normalize();
  const C = [], cap = (a, b, ra, rb, tag) => a && b && C.push({ a, b, ra, rb, tag });
  const chF = ch.clone().addScaledVector(fw, .012 * k), hpF = hp.clone().addScaledVector(fw, .005 * k);
  for (const sgn of [-1, 1]) { cap(hpF.clone().addScaledVector(rt, sgn * hw * .22), chF.clone().addScaledVector(rt, sgn * sw * .16), .1 * k, .095 * k, 'torso');
    cap(chF.clone().addScaledVector(rt, sgn * sw * .16), nk.clone().addScaledVector(rt, sgn * sw * .14).addScaledVector(up, -.03 * k), .092 * k, .07 * k, 'torso'); }
  cap(nk, hd, .052 * k, .055 * k, 'neck');
  const hc = hd.clone().addScaledVector(up, .085 * k).addScaledVector(fw, .015 * k); cap(hc, hc.clone().addScaledVector(up, .001), .098 * k, .098 * k, 'head');
  for (const ms of ['L', 'R']) { cap(w(B['ua' + ms]), w(B['la' + ms]), .046 * k, .04 * k, 'arm'); cap(w(B['la' + ms]), w(B['hand' + ms]), .038 * k, .03 * k, 'arm'); cap(w(B['ul' + ms]), w(B['ll' + ms]), .075 * k, .055 * k, 'leg'); }
  return { C, rt, up, fw, hd: hc };
}
const _cp = new T.Vector3();
function segPt(c, p, out) { const ab = _v1.copy(c.b).sub(c.a), l2 = ab.lengthSq(); const t = l2 < 1e-9 ? 0 : U.clamp(_v2.copy(p).sub(c.a).dot(ab) / l2, 0, 1); out.copy(c.a).addScaledVector(ab, t); return t; }
RH.frame = 0;
RH.body = root => { const r = root && root.userData && root.userData.real; if (!r || r.pending) return null; if (r.bodyF !== RH.frame) { r.body = capsules(r); r.bodyF = RH.frame; } return r.body; };
/* 정규화 거리(1 = 표면) — couple.js 의 팔 IK·접촉 검사가 이걸로 실제 몸을 피함 */
RH.norm = (root, p, tags) => { const b = RH.body(root); if (!b) return 9; let m = 9; for (const c of b.C) { if (tags && !tags.includes(c.tag)) continue; const t = segPt(c, p, _cp), r0 = c.ra + (c.rb - c.ra) * t, d = _cp.distanceTo(p) / r0; if (d < m) m = d; } return m; };
/* 접촉점 투영(ContactAnchorSystem): 목표 점을 실제 몸 표면 + 손 두께만큼 바깥으로 옮기고 표면 법선을 돌려줌 */
RH.project = (root, p, off = .022, tags = ['torso', 'neck', 'head']) => {
  const b = RH.body(root); if (!b) return null; let best = null;
  for (const c of b.C) { if (!tags.includes(c.tag)) continue; const t = segPt(c, p, _cp), r0 = c.ra + (c.rb - c.ra) * t, d = _cp.distanceTo(p) - r0; if (!best || d < best.d) best = { d, c: _cp.clone(), r0 }; }
  if (!best || best.d > .25) return null; const n = p.clone().sub(best.c); if (n.lengthSq() < 1e-8) n.copy(b.fw); n.normalize();
  return { p: best.c.clone().addScaledVector(n, best.r0 + off), n };
};
/* 실제 팔 길이·어깨 위치(couple.js IK 가 rig 대신 모델 치수로 계산하도록) — rs: rig 쪽(L = 아바타 오른쪽) */
RH.armGeo = (root, rs) => { const r = root && root.userData && root.userData.real; if (!r || r.pending) return null; const ms = rs === 'L' ? 'R' : 'L', B = r.Bn, a = B['ua' + ms], e = B['la' + ms], h = B['hand' + ms]; if (!a || !e || !h) return null;
  const pa = a.getWorldPosition(new T.Vector3()), pe = e.getWorldPosition(new T.Vector3()), ph = h.getWorldPosition(new T.Vector3()); return { S: pa, L1: pa.distanceTo(pe), L2: pe.distanceTo(ph) + .055 * r.sc }; };

const attach0 = async (root, url, opt = {}) => {
  const u = root.userData; if (!u || !u.rig || u.vrm || u.real) return null;
  u.real = { pending: true, url, t0: performance.now() }; let gltf;
  try { gltf = await load(url); } catch (e) { console.warn('[real] 로드 실패', url, e); u.real = null; u.realFail = (u.realFail || 0) + 1; (u.realBad || (u.realBad = new Set())).add(url); RH.cache.delete(url); return null; }
  if (!u.real || u.real.url !== url || (!root.parent && !opt.pinned)) { if (u.real && u.real.pending && u.real.url === url) u.real = null; return null; }
  const model = cloneSkinned(gltf.scene); model.updateMatrixWorld(true);
  const Bn = findBones(model);
  if (!Bn.hips || !Bn.uaL || !Bn.uaR || !Bn.ulL || !Bn.ulR) { console.warn('[real] 휴머노이드 뼈를 못 찾음', url); u.real = null; (u.realBad || (u.realBad = new Set())).add(url); return null; }
  // 방향: 모델의 왼팔(LeftArm)이 +X 쪽이면 -Z 를 보는 모델 → 180° (rig 는 +Z 를 봄; rig L(−X) = 아바타의 오른쪽)
  const holder = new T.Group(); holder.userData.realHolder = true; const facingNegZ = Bn.uaL.getWorldPosition(V1).x < Bn.uaR.getWorldPosition(V2).x;   // 앞(+Z)을 보는 모델은 오른팔이 −X
  holder.add(model); if (facingNegZ) model.rotation.y = Math.PI;
  // 키: 뼈 높이로 잼(Mixamo 처럼 cm 단위 아마추어·스케일 노드가 섞여 있어도 정확) — 맨 위 뼈(HeadTop_End/머리) ~ 맨 아래 뼈(발끝)
  holder.updateMatrixWorld(true); let yT = -Infinity, yB = Infinity, top = null; model.traverse(o => { if ((o.isBone || o.type === 'Bone') && !/_end/i.test(o.name)) { const y = o.getWorldPosition(V1).y; if (y > yT) { yT = y; top = o; } yB = Math.min(yB, y); } });   // v56 FBX→glTF 변환이 만든 가짜 끝 뼈(HeadEnd_end_end…·ToeEnd_end…, 머리 위 35cm·발 아래 17cm)는 제외 — 한국인(VALID) 모델이 키의 77%로 작게 그려지던 원인
  const hb = yT - yB, h0 = hb > 1e-6 ? hb * (top && /top|end/i.test(top.name) ? 1.02 : 1.08) : 1.7;   // 정수리 끝 뼈가 없으면 머리 뼈 → 정수리 보정
  const s = (u.look && u.look.height ? u.look.height : 1.7) / h0 * (opt.scale || 1);
  holder.scale.setScalar(s); holder.position.y = -yB * s + .012; root.add(holder);
  // 리타깃 준비: 목표(루트 기준) = rig 관절 회전 × C,  C = (뼈 방향 → rig 아래방향) × 휴지 회전
  root.updateMatrixWorld(true); const rInv = root.getWorldQuaternion(new T.Quaternion()).invert();
  const rq = o => o.getWorldQuaternion(new T.Quaternion()).premultiply(rInv), rp = o => root.worldToLocal(o.getWorldPosition(new T.Vector3()));
  const R = u.rig, J = [], HC = [];
  const link = (src, b, child) => { if (!src || !b) return; const C = new T.Quaternion(); if (child) { const d = rp(child).sub(rp(b)); if (d.lengthSq() > 1e-8) C.setFromUnitVectors(d.normalize(), DOWN); } C.multiply(rq(b)); J.push({ src, b, C }); };
  // rig L(−X 쪽) = 아바타의 오른쪽 = 모델 Right*
  link(R.hips, Bn.hips, null); link(R.torso, Bn.spine || Bn.chest, null); link(R.neck, Bn.neck, null); link(R.head, Bn.head, null);
  for (const [rs, ms] of [['L', 'R'], ['R', 'L']]) {
    if (Bn['clav' + ms]) J.push({ clav: true, b: Bn['clav' + ms], arm: R['sh' + rs], rest: Bn['clav' + ms].quaternion.clone() });
    link(R['sh' + rs], Bn['ua' + ms], Bn['la' + ms]); link(R['el' + rs], Bn['la' + ms], Bn['hand' + ms]);
    const hand = u.hands && u.hands[rs]; if (hand) { const hc = handCtl(hand, Bn, ms, rs); if (hc) HC.push(hc); else { link(hand, Bn['hand' + ms], Bn[`f${ms}1_1`] || null);
      const F = hand.userData.fingers || [], th = hand.userData.thumb;   // (예비) 손 컨트롤러를 못 만든 모델은 v41 방식
      FING.forEach((_, i) => { const f = F[i]; if (!f) return; link(f.k1, Bn[`f${ms}${i}_1`], Bn[`f${ms}${i}_2`]); link(f.k2, Bn[`f${ms}${i}_2`], Bn[`f${ms}${i}_3`]); link(f.k2, Bn[`f${ms}${i}_3`], null); });
      if (th) { link(th, Bn[`t${ms}_1`], Bn[`t${ms}_2`]); link(th, Bn[`t${ms}_2`], Bn[`t${ms}_3`]); } } }
    link(R['leg' + rs], Bn['ul' + ms], Bn['ll' + ms]); link(R['kn' + rs], Bn['ll' + ms], Bn['foot' + ms]); link(R['kn' + rs], Bn['foot' + ms], null);
  }
  // 부모가 먼저 오도록 정렬(깊이)
  const depth = o => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; }; J.sort((a, b) => depth(a.b) - depth(b.b));
  // 재질: 피부에 클럽 조명용 피하산란(SSS) 셰이더 · 그림자
  const skinNames = (opt.skin || []).map(x => x.toLowerCase()), noSkin = (opt.noSkin || []).map(x => x.toLowerCase());
  const matSet = new Set(); model.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && matSet.add(m)); }); const multi = matSet.size > 1;   // 재질이 하나뿐(옷+피부 한 텍스처)인 모델은 피부 셰이더를 옷에 씌우지 않음
  model.traverse(o => { if (!o.isMesh) return; o.frustumCulled = false; if (Q.shadows) o.castShadow = true;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m) return; const n = ((m.name || '') + ' ' + (o.name || '')).toLowerCase();
      if (NC.Avatar && NC.Avatar.skinCompile && m.isMeshStandardMaterial && !noSkin.some(k => n.includes(k)) && (skinNames.some(k => n.includes(k)) || /skin/.test(n) || (multi && /body|head|face/.test(n))) && !/hair|cloth|shirt|pant|shoe|eye|lash|brow|teeth|tongue/.test(n)) { m.onBeforeCompile = NC.Avatar.skinCompile; m.customProgramCacheKey = () => 'realSkin'; m.needsUpdate = true; }
      if (m.envMapIntensity != null) m.envMapIntensity = Math.min(m.envMapIntensity, 1);
      if (/opacity|hair|lash/.test(n) && m.map) { m.transparent = false; m.alphaTest = .42; m.alphaToCoverage = true; m.side = T.DoubleSide; m.depthWrite = true; m.roughness = .48; }   // v46 머리카락·속눈썹 카드: 알파 테스트 + 커버리지(정렬 문제 없이 가는 머리결)
      if (opt.lod) { m.normalScale && m.normalScale.set(.7, .7); } }); });
  // 절차적 메시 숨김(잔·마이크·이름표 유지)
  const keep = new Set(); [u.glass, u.mic].forEach(g => g && g.traverse(o => keep.add(o)));
  const hidden = []; R.body.traverse(o => { if ((o.isMesh || o.isSprite) && o.visible && !keep.has(o)) { hidden.push(o); o.visible = false; } });
  if (u.procHidden) { u.procHidden.forEach(o => { if (keep.has(o)) o.visible = true; else if (!hidden.includes(o)) hidden.push(o); }); u.procHidden = null; }   // v53 잔·마이크는 다시 보이게   // v50 미리 숨겨 둔 절차적 메시도 함께 관리
  /* v47 척추 분산: rig 는 몸통 관절이 하나 → 모델의 척추 뼈 2~3개(Spine·Spine1·Spine2)에 45·30·25% 로 나눠 휘게(한 덩어리로 꺾이지 않음) */
  const SP = []; { let b = Bn.spine; for (let i = 0; i < 3 && b; i++) { SP.push({ b, rest: b.quaternion.clone() }); b = b.children.find(c => /spine/i.test(c.name) && (c.isBone || c.type === 'Bone')); } }
  let hfL = null, huL = null; if (Bn.head) { root.updateMatrixWorld(true); const qh = Bn.head.getWorldQuaternion(new T.Quaternion()).invert(), qr = root.getWorldQuaternion(new T.Quaternion()); hfL = new T.Vector3(0, 0, 1).applyQuaternion(qr).applyQuaternion(qh).normalize(); huL = new T.Vector3(0, 1, 0).applyQuaternion(qr).applyQuaternion(qh).normalize(); }
  let ank0 = null; if (Bn.footL && Bn.footR) { root.updateMatrixWorld(true); const ry = root.getWorldPosition(new T.Vector3()).y; ank0 = (Math.min(Bn.footL.getWorldPosition(new T.Vector3()).y, Bn.footR.getWorldPosition(new T.Vector3()).y) - ry) / (root.scale.y || 1); }   // v56 선 자세 발목 높이(발 고정 기준)   // v56 머리 뼈 기준 얼굴 앞·위 방향(입술·이마 위치 계산용)
  const hipsY0 = Bn.hips.position.y, rec = { lod: !!opt.lod, k: 0, SP, root, u, model, holder, J, HC, Bn, sc: (u.look && u.look.height || 1.7) / 1.7, sep: new T.Vector3(), baseY: holder.position.y, s, hipsY0, hidden, url, face: faceRig(model), hfL, huL, ank0, pinned: !!opt.pinned, blinkW: 0, redraw0: u.redraw };
  u.real = rec; u.redraw = () => { u.faceDirty = false; };
  RH.list.push(rec); RH.stats.attached = RH.list.length; return rec;
};
/* v51 장착 중 오류가 나도 '대기 중' 상태로 멈추지 않게 정리하고, 그 파일은 이 사람에게 다시 쓰지 않음(다른 모델로 대체) */
RH.attach = async (root, url, opt = {}) => {
  try { return await attach0(root, url, opt); }
  catch (e) { console.warn('[real] 장착 오류 → 다른 모델로 대체', url, e); const u = root.userData;
    if (u) { (u.realBad || (u.realBad = new Set())).add(url); const keepH = u.real && u.real.holder; root.children.filter(c => c.userData && c.userData.realHolder && c !== keepH).forEach(c => root.remove(c)); if (u.real && !u.real.holder) u.real = null; }
    return null; }
};
RH.detach = root => {
  const u = root.userData, r = u && u.real; if (!r) return; if (r.pending) { u.real = null; return; }
  r.holder.parent && r.holder.parent.remove(r.holder); r.hidden.forEach(o => { o.visible = true; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { const f = m && m.userData && m.userData.texPending; if (f && NC.Face && NC.Face.queue) { m.userData.texPending = null; NC.Face.queue.push(f); } }); });   /* v48 미뤄 둔 얼굴 텍스처 생성 */ u.redraw = r.redraw0; u.faceDirty = true; u.real = null;
  const i = RH.list.indexOf(r); if (i >= 0) RH.list.splice(i, 1); RH.stats.attached = RH.list.length;
};

/* ── 매 프레임: 뼈 리타깃 + 쇄골 + 얼굴 ── */
function apply(r, dt) {
  const { u, J, root } = r, R = u.rig;
  let M = null; if (RH.MC && RH.MC.prep) { try { M = RH.MC.prep(r, dt); } catch (e) { M = null; if (!RH._mcErr) { RH._mcErr = 1; console.warn('[mocap]', e); } } }   // v54 모션캡처 레이어(대기·걷기·앉기·춤)
  const mq = M ? M.q : null, mw = M ? M.wb : null, mb = (b, w0) => { const w = mw.get(b.name); if (w > 0) { const q = mq.get(b.name); if (q) b.quaternion.slerp(q, w); } };
  root.getWorldQuaternion(qR).invert();
  for (const j of J) {
    if (j.clav) {   // 쇄골: 팔 회전(몸통 기준, 루트 좌표)의 25% 만큼 같이 → 팔을 들면 어깨도 함께 올라감
      j.arm.getWorldQuaternion(qA).premultiply(qR); R.torso.getWorldQuaternion(qB).premultiply(qR).invert(); qA.multiply(qB); qI.identity().slerp(qA, .25);
      j.b.parent.getWorldQuaternion(qB).premultiply(qR); qC.copy(qB).multiply(j.rest).premultiply(qI); j.b.quaternion.copy(qB.invert().multiply(qC)); if (M) mb(j.b); continue; }
    j.src.getWorldQuaternion(qA).premultiply(qR).multiply(j.C);
    j.b.parent.getWorldQuaternion(qB).premultiply(qR).invert();
    j.b.quaternion.copy(qB.multiply(qA));
    if (r.SP && r.SP.length > 1 && j.b === r.SP[0].b) { const s0 = r.SP[0], full = _q1.copy(s0.rest).invert().multiply(s0.b.quaternion), W = r.SP.length === 3 ? [.45, .3, .25] : [.55, .45];   // 척추 분산(자식 관절보다 먼저)
      r.SP.forEach((x, i) => { x.b.quaternion.copy(x.rest).multiply(_q2.identity().slerp(full, W[i])); if (M) mb(x.b); }); }
    else if (M) mb(j.b);
  }
  r.Bn.hips.position.y = r.hipsY0 + (R.hips.position.y - u.hipH) * u.figScale / r.s;
  if (M) { const w = M.w, h = r.Bn.hips; if (r.hipsX0 == null) { r.hipsX0 = h.position.x; r.hipsZ0 = h.position.z; } h.position.y += (r.hipsY0 + M.hy - h.position.y) * w; h.position.x = r.hipsX0 + M.hx * w; h.position.z = r.hipsZ0 + M.hz * w; }
  else if (r.hipsX0 != null) { r.Bn.hips.position.x = r.hipsX0; r.Bn.hips.position.z = r.hipsZ0; }
  if (r.HC.length) { r.model.updateMatrixWorld(true); for (const c of r.HC) applyHand(c, R, dt); }
  if (M) { if (!r.mcDone) { r.mcDone = new Set(); J.forEach(j => r.mcDone.add(j.b.name)); (r.SP || []).forEach(x => r.mcDone.add(x.b.name)); }   // 리타깃 목록에 없는 뼈(손가락·발가락·척추 위쪽)
    for (const [k, q] of mq) { if (r.mcDone.has(k) && !/Finger/.test(k)) continue; const w = mw.get(k); if (!(w > 0)) continue; const b = M.B.get(k); if (b) b.quaternion.slerp(q, w); }
  }
  r.holder.position.set(R.body.position.x * u.figScale + r.sep.x, r.baseY + R.body.position.y * u.figScale, R.body.position.z * u.figScale + r.sep.z);   // v47 sep: 커플 몸통 관통 보정(보이는 모델만 살짝 띄움)
  if (M) { r.holder.position.x -= R.body.position.x * u.figScale * M.w; r.holder.position.y -= R.body.position.y * u.figScale * M.w; r.holder.position.z -= R.body.position.z * u.figScale * M.w;   // v54 절차 몸 흔들림은 모션캡처가 대신
    try { RH.MC.post(r, M); } catch (e) { if (!RH._mcErr2) { RH._mcErr2 = 1; console.warn('[mocap ik]', e); } } }
  coupleBody(r, u, dt);
  const F = r.face; if (F) {
    const W = AK[u.expr] || AK.neutral; for (const k in W) setMorph(F, k, W[k]);
    r.blinkW += ((u.blink ? 1 : 0) - r.blinkW) * Math.min(1, dt * 30); if (r.blinkW > .02) { setMorph(F, 'eyeBlinkLeft', Math.max(W.eyeBlinkLeft || 0, r.blinkW)); setMorph(F, 'eyeBlinkRight', Math.max(W.eyeBlinkRight || 0, r.blinkW)); setMorph(F, 'eyesClosed', r.blinkW); }
    if (u.mouthOpen || (u.talkUntil && performance.now() < u.talkUntil)) { const t = performance.now() / 1000, o = .18 + .22 * Math.abs(Math.sin(t * 11)) * (.6 + .4 * Math.sin(t * 3.7));
      setMorph(F, 'jawOpen', Math.max(W.jawOpen || 0, o)); setMorph(F, 'mouthFunnel', .15 * Math.abs(Math.sin(t * 7))); setMorph(F, 'viseme_aa', o * 1.6); setMorph(F, 'viseme_O', .4 * Math.abs(Math.sin(t * 5))); }
    const g = u.gaze || [0, 0], gx = U.clamp(g[0], -1, 1), gy = U.clamp(g[1], -1, 1);
    if (gx > 0) { setMorph(F, 'eyeLookOutLeft', gx * .6); setMorph(F, 'eyeLookInRight', gx * .6); } else { setMorph(F, 'eyeLookInLeft', -gx * .6); setMorph(F, 'eyeLookOutRight', -gx * .6); }
    if (gy > 0) { setMorph(F, 'eyeLookDownLeft', gy * .6); setMorph(F, 'eyeLookDownRight', gy * .6); } else { setMorph(F, 'eyeLookUpLeft', -gy * .6); setMorph(F, 'eyeLookUpRight', -gy * .6); }
    flushMorph(F, dt);
  }
  for (const s of ['L', 'R']) { const e = r.Bn['eye' + s]; if (e && u.gaze) { e.rotation.y = U.clamp(u.gaze[0], -1, 1) * .35; e.rotation.x = U.clamp(u.gaze[1], -1, 1) * .25; } }
}

/* ── v56 커플 몸: ① 엉덩이 좌우 이동(u.swayOff, 루트 기준 m) ② 키 차이 보정(큰 사람 무릎 굽혀 낮춤 drop · 작은 사람 까치발 toe)
 *  ③ 발 고정(Foot Locking): 몸이 움직여도 발은 바닥에 붙어 있고, 발이 자연 위치에서 9cm 넘게 벌어지면 0.32초에 걸쳐 들었다 다시 디딤(한 번에 한 발)
 *     → 다리 2관절 IK(mocap.js ik2)로 무릎이 저절로 굽음  ④ 호흡: 가슴 1% 부피 변화(2.5초 주기)  · 블루스 중(u.footPlant 가 0.2초 안에 갱신)에만 ①~③ */
const _fp = new T.Vector3(), _fq = new T.Quaternion(), _fa = new T.Vector3(), _fb = new T.Vector3();
function coupleBody(r, u, dt) { coupleBody0(r, u, dt); try { faceIK(r, u); } catch (e) { if (!RH._fErr) { RH._fErr = 1; console.warn('[faceIK]', e); } } }
function coupleBody0(r, u, dt) {
  const now = performance.now(), F = u.footPlant && now - u.footPlant.t < 200 ? u.footPlant : null, Bn = r.Bn;
  const lockOK = F && !u.moving && !u.seated;   // v56 걸어오는 중·앉아 있는 중에는 발을 고정하지 않음(고정된 발을 끌고 걸어 무릎이 굽고 구부정해지던 원인)
  if (u.moving || u.seated) r.fp = null;
  r.fpW = (r.fpW || 0) + ((lockOK ? (F.w ?? 1) : 0) - (r.fpW || 0)) * Math.min(1, dt * 4); const w = r.fpW;
  /* 호흡: 가슴 뼈를 뼈 방향에 수직인 두 축으로만 ±1% (2.5초 주기, 사람마다 위상 다름) */
  const ch = Bn.chest || Bn.spine; if (ch && !r.lod) { if (!r.br) { const c = ch.children.find(x => x.isBone), d = c ? c.position.clone().normalize() : new T.Vector3(0, 1, 0), ax = [Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)]; r.br = { along: ax.indexOf(Math.max(...ax)), s0: ch.scale.clone(), ph: Math.random() * 6.28 }; }
    const k = 1 + .01 * Math.sin(now / 1000 * Math.PI * 2 / 2.5 + r.br.ph), s0 = r.br.s0; ch.scale.set(s0.x * (r.br.along === 0 ? 1 : k), s0.y * (r.br.along === 1 ? 1 : k), s0.z * (r.br.along === 2 ? 1 : k)); }
  if (w < .004) { r.fp = null; return; }
  const so = u.swayOff || { x: 0, z: 0 }, drop = F ? (F.drop || 0) : 0, toe = F ? (F.toe || 0) : 0, sc = (r.root.scale.y || 1);
  r.holder.position.x += (so.x || 0) * w / sc; r.holder.position.z += (so.z || 0) * w / sc; r.holder.position.y += (toe - drop) * w / sc;
  const ik2 = RH.MC && RH.MC.ik2; if (!ik2 || !Bn.ulL || !Bn.llL || !Bn.footL || !Bn.ulR || !Bn.llR || !Bn.footR) return;
  r.model.updateMatrixWorld(true); r.root.getWorldPosition(_fp); const floorY = _fp.y;
  const fp = r.fp || (r.fp = { L: null, R: null, step: null });
  for (const sd of ['L', 'R']) {
    const A = Bn['ul' + sd], B = Bn['ll' + sd], C = Bn['foot' + sd]; const nat = C.getWorldPosition(new T.Vector3());
    let st = fp[sd]; const a0 = r.ank0 != null ? Math.max(.03, r.ank0 * sc) : null; if (!st) { st = fp[sd] = { p: nat.clone(), y0: a0 ?? Math.max(.03, Math.min(.16, nat.y - floorY - (toe - drop) * w)), from: null, t: 0 }; }
    if (!st.from && Math.hypot(nat.x - st.p.x, nat.z - st.p.z) > .3) { st.p.copy(nat); }   // 너무 벌어지면(밀림·순간 이동) 다리를 늘이지 말고 그 자리에 다시 디딤
    const restY = floorY + Math.max(.02, st.y0) + toe * w * .8;                              // 발목 높이(까치발이면 그만큼 위)
    if (st.from) { st.t += dt / .32; const q = Math.min(1, st.t), e = q * q * (3 - 2 * q); st.p.copy(st.from).lerp(nat, e); st.p.y = restY + Math.sin(Math.PI * q) * .035; if (q >= 1) { st.from = null; fp.step = null; } }
    else { const dx = nat.x - st.p.x, dz = nat.z - st.p.z; st.p.y = restY; if (Math.hypot(dx, dz) > .09 && !fp.step) { st.from = st.p.clone(); st.t = 0; fp.step = sd; } }
    const tg = nat.clone().lerp(st.p, w); ik2(A, B, C, tg);
    if (toe > .002) { /* 까치발: 발끝을 아래로(발바닥 굽힘) — 발목→발끝 방향을 바닥 쪽으로 기울임 */
      const toeB = C.children.find(x => x.isBone); if (toeB) { C.updateMatrixWorld(true); C.getWorldPosition(_fa); toeB.getWorldPosition(_fb); const d = _fb.sub(_fa); const len = d.length(); if (len > 1e-4) { d.divideScalar(len);
        const axis = new T.Vector3().crossVectors(d, new T.Vector3(0, -1, 0)); if (axis.lengthSq() > 1e-6) { axis.normalize(); const ang = Math.min(.45, Math.asin(Math.min(.9, toe * w * 1.6 / Math.max(.08, len * 1.4))));
          const qw = C.getWorldQuaternion(new T.Quaternion()), dq = _fq.setFromAxisAngle(axis, ang), pq = C.parent.getWorldQuaternion(new T.Quaternion()).invert(); C.quaternion.copy(pq.multiply(dq.multiply(qw))); } } } }
  }
}

/* v56 얼굴 접촉 IK(키스·이마·볼): 보이는 모델의 가슴·목·머리 3관절 CCD 로 내 입술(이마)을 두 사람 사이의 만나는 점까지 옮기고, 코가 부딪치지 않게 서로 반대로 고개를 기울임
 *  · 만나는 점 = 두 사람의 'IK 전' 입술 위치의 중간(키 큰 사람이 더 많이 숙이고 작은 사람은 고개를 듦) — 입술 사이 1.2cm 를 남김
 *  · 관절 한계: 가슴 0.32 · 목 0.5 · 머리 0.55 rad (원래 자세 기준) · 가중치 w 로 부드럽게 들어가고 빠짐 */
const FACE_LIM = [.42, .36, .12];   // 머리 · 목 · 가슴(원래 자세 기준 최대 회전) — 가슴은 조금만(허리를 꺾어 들이받는 자세 방지)
function facePt(r, mode, side) {
  const H = r.Bn.head; if (!H || !r.hfL) return null; const q = H.getWorldQuaternion(new T.Quaternion()), k = r.sc * (r.root.scale.y || 1), f = r.hfL.clone().applyQuaternion(q), up = r.huL.clone().applyQuaternion(q), p = H.getWorldPosition(new T.Vector3()), rt = new T.Vector3().crossVectors(up, f).normalize();
  if (mode === 'brow') return p.addScaledVector(f, .095 * k).addScaledVector(up, .085 * k);
  if (mode === 'cheek') return p.addScaledVector(f, .065 * k).addScaledVector(up, .02 * k).addScaledVector(rt, (side || 1) * .055 * k);
  if (mode === 'ear') return p.addScaledVector(up, .03 * k).addScaledVector(rt, (side || 1) * .075 * k);
  return p.addScaledVector(f, .1 * k).addScaledVector(up, -.008 * k);   // 입술
}
RH.facePt = facePt;
function faceIK(r, u) {
  const F = RH.noFace ? null : u.faceTgt, now = performance.now(), on = F && now - F.t < 200 && F.partner && F.partner.userData.real && !F.partner.userData.real.pending;
  r.fW = (r.fW || 0) + ((on ? F.w : 0) - (r.fW || 0)) * .25; if (!on) { r.fRaw = null; return; }
  const me = F.mode === 'cheek' || F.mode === 'ear' ? 'lips' : F.mode;   // 볼·귀: 내 입술 → 상대 볼/귀
  const p0 = facePt(r, me); if (!p0) return; r.fRaw = { lips: facePt(r, 'lips'), brow: facePt(r, 'brow') };
  const R2 = F.partner.userData.real, other = F.mode === 'cheek' || F.mode === 'ear' ? facePt(R2, F.mode, F.side) : (R2.fRaw && R2.fRaw[me]) || facePt(R2, me); if (!other) return;
  const w = Math.min(1, r.fW); if (w < .01) return;
  const share = F.share ?? .5, dir = other.clone().sub(p0), dist = dir.length(); if (dist < 1e-4) return; dir.divideScalar(dist);
  const gap = F.gap ?? .012, tgt = p0.clone().addScaledVector(dir, Math.max(0, (dist - gap) * share));
  const chain = [r.Bn.head, r.Bn.neck, r.Bn.chest || r.Bn.spine].filter(Boolean); const q0 = chain.map(b => b.quaternion.clone());
  const cur = () => facePt(r, me), qa = new T.Quaternion(), qb = new T.Quaternion(), va = new T.Vector3(), vb = new T.Vector3(), jp = new T.Vector3();
  for (let it = 0; it < 4; it++) for (let i = 0; i < chain.length; i++) { if (i === 2 && it < 2) continue;   /* 머리·목으로 먼저 맞추고, 모자라면 가슴을 조금 */ const J = chain[i]; J.updateMatrixWorld(true); J.getWorldPosition(jp); const c = cur(); va.copy(c).sub(jp); vb.copy(tgt).sub(jp); if (va.lengthSq() < 1e-8 || vb.lengthSq() < 1e-8) continue;
    qa.setFromUnitVectors(va.normalize(), vb.normalize()); qa.slerp(qb.identity(), .35);   // 감쇠
    const wq = J.getWorldQuaternion(new T.Quaternion()), pq = J.parent.getWorldQuaternion(new T.Quaternion()).invert(); J.quaternion.copy(pq.multiply(qa.multiply(wq)));
    const ang = q0[i].angleTo(J.quaternion), lim = FACE_LIM[i]; if (ang > lim) J.quaternion.copy(q0[i]).slerp(J.quaternion.clone(), lim / ang); J.updateMatrixWorld(true); }
  /* 고개 기울임: 상대를 향한 축으로 회전(코가 엇갈림) */
  if (F.tilt && r.Bn.head) { const H = r.Bn.head; H.updateMatrixWorld(true); const ax = other.clone().sub(H.getWorldPosition(new T.Vector3())).normalize(), wq = H.getWorldQuaternion(new T.Quaternion()), pq = H.parent.getWorldQuaternion(new T.Quaternion()).invert();
    H.quaternion.copy(pq.multiply(new T.Quaternion().setFromAxisAngle(ax, F.tilt).multiply(wq))); }
  if (w < .999) chain.forEach((b, i) => b.quaternion.copy(q0[i].clone().slerp(b.quaternion.clone(), w)));
  chain[chain.length - 1].updateMatrixWorld(true);
}

/* ── v46 거리 기반 3단계: 근거리 N명 = 고해상도(표정·손가락) · 중거리 = 경량 LOD 모델 · 원거리 = 기존 절차적 몸 ──
 *  인물 → 모델은 manifest.assign(npcs.json id)로 고정(같은 사람은 항상 같은 얼굴), 직원·댄서는 staff 목록에서 */
let acc = 0;
const staffKey = new WeakMap(); let staffN = { f: 0, m: 0 };
/* v50 모든 사람(절차적 Avatar.create 로 만들어진 모든 캐릭터: 추가 웨이터·무대 댄서·화장실·야외·임시 인물 등)을 등록 → 전부 실사 모델 */
const AV = new Set(); let rootsCache = null, rootsT = 0;
if (NC.Avatar && NC.Avatar.create && !NC.Avatar._rhWrapped) { const oc = NC.Avatar.create; NC.Avatar.create = function (o) { const g = oc.apply(this, arguments); if (g && !(o && o.name === 'preview')) { AV.add(g); rootsCache = null; const u = g.userData, ps = new Set(); u && u.rig && u.rig.body.traverse(x => { if (x.isMesh || x.isSprite) ps.add(x); }); if (u) u.procSet = ps; } return g; }; NC.Avatar._rhWrapped = true; }   // v51 procSet = 만들 때의 절차적 몸 메시 목록(나중에 손에 드는 소품은 숨기지 않으려고)
function rootsAll() {
  const out = [];
  (NC.npcs || []).forEach(n => n.g && out.push({ g: n.g, id: n.def && (n.def.id || n.def.name) || n.id || n.name, gender: n.gender || (n.g.userData.look || {}).gender }));
  (NC.Waiters ? NC.Waiters.list : []).forEach((o, i) => o.g && out.push({ g: o.g, id: 'staff:w' + i, gender: (o.g.userData.look || {}).gender || 'm', staff: true }));
  [['dj', NC.DJ], ['bar', NC.Bartender]].forEach(([k, g]) => g && g.userData && g.userData.rig && out.push({ g, id: 'staff:' + k, gender: (g.userData.look || {}).gender || 'f', staff: true }));
  (NC.Stage && NC.Stage.dancers || []).forEach((d, i) => d.g && out.push({ g: d.g, id: 'staff:d' + i, gender: (d.g.userData.look || {}).gender || 'f', staff: true }));
  const P = NC.player && NC.player.group; if (P && P.userData && P.userData.rig && !P.userData.customModel) out.push({ g: P, id: 'player', gender: (P.userData.look || {}).gender || 'm', staff: true, me: true });   // 내 캐릭터
  (NC.remotes || new Map()).forEach((r, k) => r && r.g && r.g.userData && r.g.userData.rig && out.push({ g: r.g, id: 'remote:' + k, gender: (r.g.userData.look || {}).gender || 'm', staff: true }));
  const seen = new Set(out.map(o => o.g));
  AV.forEach(g => { if (seen.has(g)) return; const u = g.userData; if (!u || !u.rig || u.customModel || u.vrm) return; if (!g.parent) { const now = performance.now(); u._rhOff = u._rhOff || now; if (now - u._rhOff > 60000) AV.delete(g); return; } u._rhOff = 0;   // v53 장면에서 1분 넘게 빠진 임시 인물은 목록에서 제거(메모리 누수 방지)
    out.push({ g, id: 'av:' + g.uuid, gender: (u.look || {}).gender === 'f' ? 'f' : 'm', staff: true }); });
  return out;
}
let modelFor = function (C, r) {
  const M = C._byId || (C._byId = Object.fromEntries((C.models || []).map(m => [m.id, m])));
  const lk = r.g.userData && r.g.userData.look, own = lk && lk.realModel && M[lk.realModel] && M[lk.realModel].gender === (r.gender === 'f' ? 'f' : 'm') ? lk.realModel : null;   // v48 내 캐릭터·다른 접속자: 고른 실사 모델
  const a = own || (C.assign && C.assign[r.id]) || (r.me && C.player && C.player[r.gender === 'f' ? 'f' : 'm']); if (a && M[a]) return M[a];
  const gk = r.gender === 'm' ? 'm' : 'f';
  if (!staffKey.has(r.g)) { const pool = (C.staff && C.staff[gk] && C.staff[gk].length ? C.staff[gk] : (C.models || []).filter(m => m.gender === gk).map(m => m.id)); staffKey.set(r.g, pool[(staffN[gk]++) % pool.length]); }
  return M[staffKey.get(r.g)] || null;
}
const modelFor0 = modelFor;
modelFor = (C, r) => {   // v51 이 사람에게 실패한 모델이면 같은 성별의 다른 모델로
  const m = modelFor0(C, r), bad = r.g.userData && r.g.userData.realBad; if (!m || !bad || !(bad.has(m.url) || bad.has(m.lod))) return m;
  const gk = (m.gender || r.gender) === 'm' ? 'm' : 'f', alt = (C.models || []).filter(x => x.gender === gk && !bad.has(x.url) && !bad.has(x.lod));
  return alt.length ? alt[(U32(r.g.uuid) % alt.length)] : m;
};
function U32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
let budget = 0;   // 한 번(0.35초)에 새로 입히는 인원 제한 → 시작할 때 수십 명을 한꺼번에 파싱해 멈추는 것 방지
function want(r, url, opt) {   // 같은 사람의 모델 교체: 새 파일을 먼저 받아 둔 뒤 한 번에 바꿈(깜빡임 최소)
  const u = r.g.userData, cur = u.real; if (cur && (cur.url === url || cur.next === url)) return;
  if (cur && cur.pending) return; if (budget <= 0) return; budget--;
  if (!cur) { RH.attach(r.g, url, opt); return; }
  cur.next = url; load(url).then(() => { if (u.real !== cur) return; RH.detach(r.g); RH.attach(r.g, url, opt); }).catch(() => { cur.next = null; });
}
function lod(force, from) {
  const C = RH.cfg; if (!C || !C.models || !C.models.length) return;
  const cam = NC.camera; if (!cam && !from) return; const cp = from || cam.position, mob = NC.isMobile, low = Q.level === 'low';
  const near = C.near || 7, mid = C.mid || 45, maxN = mob ? (C.maxMobile ?? 2) : low ? Math.min(2, C.max ?? 6) : (C.max ?? 6), maxM = mob || low ? (C.maxMidMobile ?? 8) : (C.maxMid ?? 60);
  const cand = [], BLn = NC.Karaoke && NC.Karaoke.BL && NC.Karaoke.BL.n, Dn = NC.Dialog && NC.Dialog.cur && NC.Dialog.cur.n;
  const pri = new Set([BLn && BLn.g, Dn && Dn.g].filter(Boolean));   // v48.1 블루스 상대·대화 상대는 항상 고해상도(가장 가까운 것으로 취급)
  rootsAll().forEach(r => { const g = r.g; if (!g.parent || !g.userData.rig || g.userData.vrm) return; if (g.userData.real && g.userData.real.pinned) return;
    const m = modelFor(C, r); if (!m) return; let vis = g.visible; for (let p = g.parent; vis && p; p = p.parent) vis = p.visible;
    const d = r.me || pri.has(g) ? 0 : g.getWorldPosition(V1).distanceTo(cp); cand.push({ r, m, d: vis ? d : 1e9 }); });
  cand.sort((a, b) => a.d - b.d);
  let nN = 0, nM = 0; budget = force ? 999 : NC.isMobile ? 2 : 3; const acts = [];   // v53 모바일 1→2 · PC 2→3 명씩(0.35초마다)
  const LO = { noSkin: ['_body'], skin: ['_head'], lod: true }, HI = { noSkin: ['_body'], skin: ['_head'] };
  cand.forEach(c => {
    if (c.d < near && nN < maxN) { nN++; acts.push([c, c.m.url, HI]); }
    else if (c.m.lod) { nM++; acts.push([c, c.m.lod, LO]); }   // v50 거리·인원 한도 없이 모든 사람에게 실사 모델(옛 절차적 캐릭터로 돌아가지 않음)
    else if (c.m.url) acts.push([c, c.m.url, HI]);
  });
  /* v48.1 처리 순서: 아직 실사 모델이 없는 사람(옛 캐릭터로 보이는 중) → 가까운 순 → 고해상도/LOD 교체는 그다음 */
  acts.sort((a, b) => (a[0].r.g.userData.real ? 1 : 0) - (b[0].r.g.userData.real ? 1 : 0) || a[0].d - b[0].d).forEach(([c, url, o]) => want(c.r, url, o));
  RH.stats.near = nN; RH.stats.mid = nM;
}
/* v47 커플 몸통·머리 관통 보정: 두 실사 모델의 몸통/머리 캡슐이 1cm 넘게 겹치면 보이는 모델만 서로 반씩 밀어냄(부드럽게) */
function sepCouple(dt) {
  const BL = NC.Karaoke && NC.Karaoke.BL, P = NC.player && NC.player.group, n = BL && BL.n;
  const pairs = n && P ? [[P, n.g]] : []; const live = new Set();
  for (const [ga, gb] of pairs) { const ra = ga.userData.real, rb = gb.userData.real; if (!ra || !rb || ra.pending || rb.pending) continue; live.add(ra); live.add(rb);
    const A = RH.body(ga), B = RH.body(gb); if (!A || !B) continue; let best = 0, dir = null;
    const fa = [ga, gb].some(g => g.userData.faceTgt && performance.now() - g.userData.faceTgt.t < 200);   // v56 얼굴 접촉 중엔 머리끼리 밀어내지 않음(얼굴 IK 가 1cm 앞에서 멈춤) — 코끝 겹침으로 입술이 10cm 떨어져 멈추던 원인
    for (const ca of A.C) { if (ca.tag !== 'torso' && ca.tag !== 'head') continue; for (const cb of B.C) { if (cb.tag !== 'torso' && cb.tag !== 'head') continue; if (fa && (ca.tag === 'head' || cb.tag === 'head')) continue;
      for (let i = 0; i <= 4; i++) { const pa = ca.a.clone().lerp(ca.b, i / 4), ta = ca.ra + (ca.rb - ca.ra) * i / 4, t = segPt(cb, pa, _cp), rb2 = cb.ra + (cb.rb - cb.ra) * t, d = _cp.distanceTo(pa), pen = ta + rb2 - .012 - d;
        if (pen > best) { best = pen; dir = pa.clone().sub(_cp); } } } }
    const want = new T.Vector3(); if (dir) { dir.y = 0; if (dir.lengthSq() > 1e-8) want.copy(dir.normalize()).multiplyScalar(Math.min(.12, best) * .5); }
    const k = 1 - Math.exp(-dt * 8), toLocal = (g, v, sg) => { const q = g.getWorldQuaternion(new T.Quaternion()).invert(); return v.clone().multiplyScalar(sg).applyQuaternion(q).divideScalar(g.scale.x || 1); };
    ra.sep.lerp(toLocal(ga, want, 1), k); rb.sep.lerp(toLocal(gb, want, -1), k); RH.stats.pen = best; }
  RH.list.forEach(r => { if (!live.has(r) && r.sep.lengthSq() > 1e-8) r.sep.multiplyScalar(Math.exp(-dt * 6)); });
}
/* v50 실사 모델이 붙기 전에는 절차적 몸(옛 캐릭터)을 숨김 — 새로 생긴 사람도 옛 모습이 보이지 않음 */
let phF = 0;
function procHide() {
  if (!RH.active || !RH.active()) return; const C = RH.cfg, now = performance.now(), full = (++phF % 8) === 0;
  const keepOf = u => { const k = new Set(); [u.glass, u.mic].forEach(g => g && g.traverse(o => k.add(o))); return k; };
  const now2 = performance.now(); if (!rootsCache || now2 - rootsT > 350) { rootsCache = rootsAll(); rootsT = now2; }   // v52 사람 목록은 0.35초마다만 새로 만듦(매 프레임 할당 X)
  rootsCache.forEach(r => { const u = r.g.userData; if (!u || !u.rig || u.vrm || u.customModel) return;
    if (u.real && !u.real.pending) {   // v51 장착 뒤에 다른 기능이 절차적 몸 메시를 다시 켜면 숨김(8프레임마다 점검)
      if (!full) return; const H = u.real.hidden, PS = u.procSet; if (!H || !PS) return; let keep = null;
      PS.forEach(o => { if (o.visible) { keep = keep || keepOf(u); if (!keep.has(o)) { o.visible = false; H.push(o); } } }); return; }
    if (!modelFor(C, r)) return;
    const keep = keepOf(u), H = u.procHidden || (u.procHidden = []), PS = u.procSet;
    (PS || []).forEach(o => { if (o.visible) { o.visible = false; H.push(o); } });   // v53 몸이 숨겨진 동안에는 손에 든 잔·마이크도 숨김(허공에 뜬 잔 방지)
    keep.forEach(o => { if ((o.isMesh || o.isSprite) && o.visible) { o.visible = false; H.push(o); } });
    if (!PS) u.rig.body.traverse(o => { if ((o.isMesh || o.isSprite) && o.visible && !keep.has(o)) { o.visible = false; H.push(o); } }); });   // 실사 모델이 붙을 때까지 옛 몸은 보이지 않음
}
RH._apply = apply;   // v54 시험용(고정 dt 로 자세 계산)
RH.procHide = procHide; RH.allRoots = () => rootsAll().map(r => r.g);
const TICK = dt => {
  try { procHide(); } catch (e) { }
  RH.frame++; acc += dt; if (acc > .35) { acc = 0; try { lod(); } catch (e) { console.warn('[real] lod', e); } }
  for (let i = RH.list.length - 1; i >= 0; i--) { const r = RH.list[i]; if (!r.root.parent) { RH.list.splice(i, 1); continue; } if (!r.root.visible) continue; apply(r, Math.min(dt, .05)); }
  try { sepCouple(Math.min(dt, .05)); } catch (e) { }
};
/* v47 실행 순서: 모든 스크립트(couple.js IK 등)가 등록된 뒤 맨 끝에서 → 이번 프레임의 최종 rig 자세를 모델에 반영 */
addEventListener('load', () => NC.tickers.push(TICK));
RH.pin = (root, url, opt = {}) => RH.attach(root, url, Object.assign({ pinned: true }, opt));
/* 설정 불러오기(없으면 꺼짐) */
RH.off = /[?&](noreal|procedural)\b/.test(location.search);
let readyRes; RH.ready = new Promise(r => { readyRes = r; }); setTimeout(() => readyRes(RH.cfg), 6000);   // v48 매니페스트 확인 전에는 NPC 를 만들지 않음(얼굴 텍스처 낭비·옛 캐릭터 노출 방지)
RH.active = () => !!(RH.cfg && RH.cfg.models && RH.cfg.models.length && RH.ok);
RH.modelOf = id => RH.cfg && RH.cfg.models && RH.cfg.models.find(m => m.id === id) || null;
RH.modelIdFor = n => { const C = RH.cfg; if (!C) return null; const id = n && (n.def && (n.def.id || n.def.name) || n.id || n.name); return (C.assign && C.assign[id]) || null; };
/* v48 시작 화면에서 미리 받기: NPC·직원의 중거리 모델 + 내 캐릭터 고해상도 모델을 한가할 때 하나씩 내려받아 파싱(입장 순간 멈춤 제거) */
RH.prestart = async () => {
  if (!RH.active() || RH._pre) return; RH._pre = true; const C = RH.cfg, mob = NC.isMobile || Q.level === 'low', urls = [];
  const lk = NC.entry && NC.entry.buildLook ? NC.entry.buildLook() : null, me = lk && lk.realModel && RH.modelOf(lk.realModel); if (me) urls.push(me.url);
  const ids = new Set(Object.values(C.assign || {})); ['f', 'm'].forEach(g => (C.staff && C.staff[g] || []).forEach(i => ids.add(i)));
  ids.forEach(i => { const m = RH.modelOf(i); if (m && m.lod) urls.push(m.lod); });
  const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 400 }) : setTimeout(r, 30)));
  for (const u of urls) { if (NC.started && RH._warmed) break; await idle(); try { await load(u); } catch (e) { } }
  RH.stats.preloaded = urls.length;
};
RH.preload = urls => urls.reduce((p, u) => p.then(() => load(u).catch(() => null)), Promise.resolve());
/* v48 입장 직후 워밍업: 현재 카메라 기준으로 모든 대상에 모델을 즉시 입히고(예산 무제한) 셰이더·텍스처를 미리 GPU 에 올림 */
RH.warm = async (onProg, maxMs = 1200) => {   // v55 입장 대기 단축(최대 ~9초 → 보통 1~2초): 카메라 근처(14m) 사람 + 내 캐릭터만 기다리고, 나머지는 옛 몸을 숨긴 채 뒤에서 이어서 장착
  if (!RH.active()) return; { const tg = performance.now(); while (NC.guestsReady && !NC.guestsReady() && performance.now() - tg < 500) await new Promise(r => setTimeout(r, 50)); }   // 테이블 손님 생성 대기(최대 0.5초)
  const t0 = performance.now(), P = NC.player && NC.player.group, me = P ? P.getWorldPosition(new T.Vector3()) : null, from = me ? me.clone().add(new T.Vector3(0, 2.5, 4)) : null; try { lod(false, from); }   /* v55 가까운 사람부터 3명씩 차례로(전원 동시 요청 → 파싱이 몰려 가까운 사람도 늦던 문제) */ catch (e) { console.warn(e); }
  /* 기다릴 대상: 내 주변 8m 안에서 가장 가까운 10명만(입장 직후 화면 앞쪽) — 나머지는 공개 뒤 옛 몸을 숨긴 채 이어서 장착 */
  const d2 = r => { if (!me) return 0; const p = r.g.position; return (p.x - me.x) ** 2 + (p.z - me.z) ** 2; };
  const watch = new Set(rootsAll().filter(r => r.g.userData.real && d2(r) < 64).sort((a, b) => d2(a) - d2(b)).slice(0, 10));
  const pend = () => { let k = 0; watch.forEach(r => { if (r.g.userData.real && r.g.userData.real.pending) k++; }); return k; };
  const tot = Math.max(1, pend());
  while (pend() && performance.now() - t0 < maxMs) { onProg && onProg(.85 * (1 - pend() / tot)); await new Promise(r => setTimeout(r, 50)); try { lod(false, from); } catch (e) { } }
  { const pu = P && P.userData; while (pu && pu.real && pu.real.pending && performance.now() - t0 < maxMs + 1500) await new Promise(r => setTimeout(r, 50)); }   // 내 캐릭터는 꼭 실사로 시작
  const rd = NC.renderer; if (!rd) return;
  try { rd.compile(NC.scene, NC.camera); } catch (e) { }
  /* 텍스처 미리 올리기는 가까운 사람만, 0.4초 예산 — 나머지는 처음 보일 때 올라감 */
  const texs = new Set(), roots = [P, ...[...watch].map(r => r.g)].filter(g => g && !(g.userData.real && g.userData.real.pending));   // 내 캐릭터 + 이미 입혀진 가까운 사람만(큰 텍스처 수십 장을 한꺼번에 올리느라 수 초 멈추던 원인)
  roots.forEach(g => g.traverse(o => { if (!o.isMesh || !o.visible) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m) return; for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap']) m[k] && m[k].isTexture && texs.add(m[k]); }); }));
  const t1 = performance.now(); let i = 0; for (const t of texs) { if (performance.now() - t1 > 300) break; try { rd.initTexture && rd.initTexture(t); } catch (e) { } if (++i % 8 === 0) { onProg && onProg(.85 + .15 * i / texs.size); await new Promise(r => setTimeout(r, 0)); } }   // 화면 그리기를 기다리지 않고 0.3초 예산 안에서만
};
if (RH.off) readyRes(null); else fetch('models/humans/manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null).then(j => { if (!j) { readyRes(null); return; } RH.cfg = j; readyRes(j); console.info('[real] 실사 모델 ' + (j.models || []).length + '개 · 근거리 ' + (j.near || 6) + 'm · 최대 ' + (j.max ?? 4) + '명'); }).catch(() => {});
})();
