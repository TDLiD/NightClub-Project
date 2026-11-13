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
const loader = new T.GLTFLoader();

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
function load(url) { if (!RH.cache.has(url)) { RH.stats.loads++; RH.cache.set(url, new Promise((res, rej) => loader.load(url, res, undefined, rej))); } return RH.cache.get(url); }
const DOWN = new T.Vector3(0, -1, 0), V1 = new T.Vector3(), V2 = new T.Vector3(), qA = new T.Quaternion(), qB = new T.Quaternion(), qR = new T.Quaternion(), qI = new T.Quaternion(), qC = new T.Quaternion(), box = new T.Box3();
const FIT = ['torso', 'neck', 'head', 'shL', 'elL', 'shR', 'elR', 'legL', 'knL', 'legR', 'knR'];

RH.attach = async (root, url, opt = {}) => {
  const u = root.userData; if (!u || !u.rig || u.vrm || u.real) return null;
  u.real = { pending: true, url }; let gltf;
  try { gltf = await load(url); } catch (e) { console.warn('[real] 로드 실패', url, e); u.real = null; RH.cache.delete(url); return null; }
  if (!u.real || u.real.url !== url || (!root.parent && !opt.pinned)) { if (u.real && u.real.pending && u.real.url === url) u.real = null; return null; }
  const model = cloneSkinned(gltf.scene); model.updateMatrixWorld(true);
  const Bn = findBones(model);
  if (!Bn.hips || !Bn.uaL || !Bn.uaR || !Bn.ulL || !Bn.ulR) { console.warn('[real] 휴머노이드 뼈를 못 찾음', url); u.real = null; return null; }
  // 방향: 모델의 왼팔(LeftArm)이 +X 쪽이면 -Z 를 보는 모델 → 180° (rig 는 +Z 를 봄; rig L(−X) = 아바타의 오른쪽)
  const holder = new T.Group(), facingNegZ = Bn.uaL.getWorldPosition(V1).x < Bn.uaR.getWorldPosition(V2).x;   // 앞(+Z)을 보는 모델은 오른팔이 −X
  holder.add(model); if (facingNegZ) model.rotation.y = Math.PI;
  // 키: 뼈 높이로 잼(Mixamo 처럼 cm 단위 아마추어·스케일 노드가 섞여 있어도 정확) — 맨 위 뼈(HeadTop_End/머리) ~ 맨 아래 뼈(발끝)
  holder.updateMatrixWorld(true); let yT = -Infinity, yB = Infinity, top = null; model.traverse(o => { if (o.isBone || o.type === 'Bone') { const y = o.getWorldPosition(V1).y; if (y > yT) { yT = y; top = o; } yB = Math.min(yB, y); } });
  const hb = yT - yB, h0 = hb > 1e-6 ? hb * (top && /top|end/i.test(top.name) ? 1.02 : 1.08) : 1.7;   // 정수리 끝 뼈가 없으면 머리 뼈 → 정수리 보정
  const s = (u.look && u.look.height ? u.look.height : 1.7) / h0 * (opt.scale || 1);
  holder.scale.setScalar(s); holder.position.y = -yB * s + .012; root.add(holder);
  // 리타깃 준비: 목표(루트 기준) = rig 관절 회전 × C,  C = (뼈 방향 → rig 아래방향) × 휴지 회전
  root.updateMatrixWorld(true); const rInv = root.getWorldQuaternion(new T.Quaternion()).invert();
  const rq = o => o.getWorldQuaternion(new T.Quaternion()).premultiply(rInv), rp = o => root.worldToLocal(o.getWorldPosition(new T.Vector3()));
  const R = u.rig, J = [];
  const link = (src, b, child) => { if (!src || !b) return; const C = new T.Quaternion(); if (child) { const d = rp(child).sub(rp(b)); if (d.lengthSq() > 1e-8) C.setFromUnitVectors(d.normalize(), DOWN); } C.multiply(rq(b)); J.push({ src, b, C }); };
  // rig L(−X 쪽) = 아바타의 오른쪽 = 모델 Right*
  link(R.hips, Bn.hips, null); link(R.torso, Bn.spine || Bn.chest, null); link(R.neck, Bn.neck, null); link(R.head, Bn.head, null);
  for (const [rs, ms] of [['L', 'R'], ['R', 'L']]) {
    if (Bn['clav' + ms]) J.push({ clav: true, b: Bn['clav' + ms], arm: R['sh' + rs], rest: Bn['clav' + ms].quaternion.clone() });
    link(R['sh' + rs], Bn['ua' + ms], Bn['la' + ms]); link(R['el' + rs], Bn['la' + ms], Bn['hand' + ms]);
    const hand = u.hands && u.hands[rs]; if (hand) { link(hand, Bn['hand' + ms], Bn[`f${ms}1_1`] || null);
      const F = hand.userData.fingers || [], th = hand.userData.thumb;   // rig 손가락 0(검지)…3(새끼) — 좌우 대칭 배치(fx 부호)라 순서 그대로
      FING.forEach((_, i) => { const f = F[i]; if (!f) return; link(f.k1, Bn[`f${ms}${i}_1`], Bn[`f${ms}${i}_2`]); link(f.k2, Bn[`f${ms}${i}_2`], Bn[`f${ms}${i}_3`]); link(f.k2, Bn[`f${ms}${i}_3`], null); });
      if (th) { link(th, Bn[`t${ms}_1`], Bn[`t${ms}_2`]); link(th, Bn[`t${ms}_2`], Bn[`t${ms}_3`]); } }
    link(R['leg' + rs], Bn['ul' + ms], Bn['ll' + ms]); link(R['kn' + rs], Bn['ll' + ms], Bn['foot' + ms]); link(R['kn' + rs], Bn['foot' + ms], null);
  }
  // 부모가 먼저 오도록 정렬(깊이)
  const depth = o => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; }; J.sort((a, b) => depth(a.b) - depth(b.b));
  // 재질: 피부에 클럽 조명용 피하산란(SSS) 셰이더 · 그림자
  const skinNames = (opt.skin || []).map(x => x.toLowerCase());
  const matSet = new Set(); model.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && matSet.add(m)); }); const multi = matSet.size > 1;   // 재질이 하나뿐(옷+피부 한 텍스처)인 모델은 피부 셰이더를 옷에 씌우지 않음
  model.traverse(o => { if (!o.isMesh) return; o.frustumCulled = false; if (Q.shadows) o.castShadow = true;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m) return; const n = ((m.name || '') + ' ' + (o.name || '')).toLowerCase();
      if (NC.Avatar && NC.Avatar.skinCompile && m.isMeshStandardMaterial && (skinNames.some(k => n.includes(k)) || /skin/.test(n) || (multi && /body|head|face/.test(n))) && !/hair|cloth|shirt|pant|shoe|eye|lash|brow|teeth|tongue/.test(n)) { m.onBeforeCompile = NC.Avatar.skinCompile; m.customProgramCacheKey = () => 'realSkin'; m.needsUpdate = true; }
      if (m.envMapIntensity != null) m.envMapIntensity = Math.min(m.envMapIntensity, 1); }); });
  // 절차적 메시 숨김(잔·마이크·이름표 유지)
  const keep = new Set(); [u.glass, u.mic].forEach(g => g && g.traverse(o => keep.add(o)));
  const hidden = []; R.body.traverse(o => { if ((o.isMesh || o.isSprite) && o.visible && !keep.has(o)) { hidden.push(o); o.visible = false; } });
  const hipsY0 = Bn.hips.position.y, rec = { root, u, model, holder, J, Bn, baseY: holder.position.y, s, hipsY0, hidden, url, face: faceRig(model), pinned: !!opt.pinned, blinkW: 0, redraw0: u.redraw };
  u.real = rec; u.redraw = () => { u.faceDirty = false; };
  RH.list.push(rec); RH.stats.attached = RH.list.length; return rec;
};
RH.detach = root => {
  const u = root.userData, r = u && u.real; if (!r) return; if (r.pending) { u.real = null; return; }
  r.holder.parent && r.holder.parent.remove(r.holder); r.hidden.forEach(o => { o.visible = true; }); u.redraw = r.redraw0; u.faceDirty = true; u.real = null;
  const i = RH.list.indexOf(r); if (i >= 0) RH.list.splice(i, 1); RH.stats.attached = RH.list.length;
};

/* ── 매 프레임: 뼈 리타깃 + 쇄골 + 얼굴 ── */
function apply(r, dt) {
  const { u, J, root } = r, R = u.rig;
  root.getWorldQuaternion(qR).invert();
  for (const j of J) {
    if (j.clav) {   // 쇄골: 팔 회전(몸통 기준, 루트 좌표)의 25% 만큼 같이 → 팔을 들면 어깨도 함께 올라감
      j.arm.getWorldQuaternion(qA).premultiply(qR); R.torso.getWorldQuaternion(qB).premultiply(qR).invert(); qA.multiply(qB); qI.identity().slerp(qA, .25);
      j.b.parent.getWorldQuaternion(qB).premultiply(qR); qC.copy(qB).multiply(j.rest).premultiply(qI); j.b.quaternion.copy(qB.invert().multiply(qC)); continue; }
    j.src.getWorldQuaternion(qA).premultiply(qR).multiply(j.C);
    j.b.parent.getWorldQuaternion(qB).premultiply(qR).invert();
    j.b.quaternion.copy(qB.multiply(qA));
  }
  r.Bn.hips.position.y = r.hipsY0 + (R.hips.position.y - u.hipH) * u.figScale / r.s;
  r.holder.position.set(R.body.position.x * u.figScale, r.baseY + R.body.position.y * u.figScale, R.body.position.z * u.figScale);
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

/* ── 거리 기반 LOD: 가까운 N명만 실사 ── */
let acc = 0;
function lod() {
  const C = RH.cfg; if (!C || !C.models || !C.models.length) return;
  const cam = NC.camera; if (!cam) return; const cp = cam.position, near = C.near || 6, max = NC.isMobile ? (C.maxMobile ?? 1) : Q.level === 'low' ? Math.min(1, C.max ?? 4) : (C.max ?? 4);
  const cand = [];
  (NC.npcs || []).forEach(n => { const g = n.g; if (!g || !g.parent || !g.visible || !g.userData.rig || g.userData.vrm) return; if (g.userData.real && g.userData.real.pinned) return;
    const pool = C.models.filter(m => !m.gender || m.gender === g.userData.gender); if (!pool.length) return;
    const d = g.getWorldPosition(V1).distanceTo(cp); if (d < near) cand.push({ g, d, pool, n }); });
  cand.sort((a, b) => a.d - b.d); const want = new Set(cand.slice(0, max).map(c => c.g));
  RH.list.slice().forEach(r => { if (!r.pinned && !want.has(r.root)) RH.detach(r.root); });
  cand.slice(0, max).forEach(c => { if (c.g.userData.real) return; const m = c.pool[(U.hash(c.n.name || c.n.id || 'x') >>> 0) % c.pool.length]; RH.attach(c.g, m.url, { skin: m.skin, scale: m.scale }); });
}
NC.tickers.push(dt => {
  acc += dt; if (acc > .35) { acc = 0; try { lod(); } catch (e) { console.warn('[real] lod', e); } }
  for (let i = RH.list.length - 1; i >= 0; i--) { const r = RH.list[i]; if (!r.root.parent) { RH.list.splice(i, 1); continue; } if (!r.root.visible) continue; apply(r, Math.min(dt, .05)); }
});
RH.pin = (root, url, opt = {}) => RH.attach(root, url, Object.assign({ pinned: true }, opt));
/* 설정 불러오기(없으면 꺼짐) */
fetch('models/humans/manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => { if (!j) return; RH.cfg = j; console.info('[real] 실사 모델 ' + (j.models || []).length + '개 · 근거리 ' + (j.near || 6) + 'm · 최대 ' + (j.max ?? 4) + '명'); }).catch(() => {});
})();
