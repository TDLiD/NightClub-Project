/* digitalhuman.js — v87 디지털 휴먼 1단계 (MetaHuman 을 기준으로 삼되, 현재 three.js r128 + Rocketbox/VALID GLB 구조 안에서)
 *  ① 얼굴 개성(Identity): 같은 바탕 모델을 여러 사람이 써도 얼굴 골격이 달라 보이게 — 사람마다 고정된 값으로
 *     광대(높이·폭) · 턱(길이·앞뒤·폭) · 눈썹(높이·기울기) · 입(폭) · 입술(두께) · 좌우 비대칭을 얼굴 뼈로 조정
 *  ② 경량(LOD) 모델 얼굴 연기: 블렌드셰이프가 없는 거리용 모델도 얼굴 뼈로 눈 깜빡임 · 말할 때 턱 · 웃음 · 놀람 · 미세 표정
 *     (가까운 고화질 모델은 기존 ARKit 블렌드셰이프 그대로 + ① 만 더함)
 *  ③ 피부: 피부 영역(색 기반 마스크)에만 모공 디테일 노멀 · 거칠기 변화(avatar.js realBodyMat 에 주입)
 *  ④ 눈: VALID 모델의 안구 메시는 각막 광택(젖은 눈)
 *  뼈를 '쉬는 자세 + 이번 프레임 변화'로 매 프레임 다시 씀 → 누적·떨림 없음. 다른 코드가 같은 뼈를 바꿨으면 그 값을 새 기준으로 삼음.
 *  NC.DigitalHuman.off = true 로 끌 수 있음(시험·비교용)
 */
(() => {
'use strict';
const NC = window.NC, RH = NC && NC.RealHuman; if (!RH || !RH.ok) return;
const T = NC.THREE, U = NC.util;
const DH = NC.DigitalHuman = { off: false, stats: { rigs: 0, idRigs: 0, lodFace: 0, eyeMats: 0 }, range: 16 };

/* 얼굴 뼈 이름(정규화: 소문자, 'bip01' 과 공백 제거) */
const FB = { jaw: 'mjaw', tL: 'leyeblinktop', tR: 'reyeblinktop', bL: 'leyeblinkbottom', bR: 'reyeblinkbottom', chL: 'lcheek', chR: 'rcheek',
  biL: 'linnereyebrow', biR: 'rinnereyebrow', boL: 'loutereyebrow', boR: 'routereyebrow', bm: 'mmiddleeyebrow', mcL: 'lmouthcorner', mcR: 'rmouthcorner',
  ulL: 'lupperlip', ulR: 'rupperlip', ulM: 'mupperlip', llM: 'mbottomlip', llL: 'lmouthbottom', llR: 'rmouthbottom' };
const EYE = { L: ['leye', 'lefteye'], R: ['reye', 'righteye'] };
const nrm = s => String(s || '').toLowerCase().replace(/^bip0?1/, '').replace(/[\s_.:-]/g, '');
function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const sr = r => (r() * 2 - 1);

function keyOf(g) {
  const P = NC.player; if (P && g === P.group) return 'me:' + ((NC.account && NC.account.uid) || 'local');
  const n = (NC.npcs || []).find(x => x.g === g); if (n) return 'npc:' + (n.id || n.name);
  for (const k in (NC.remotes || {})) { const r = NC.remotes[k]; if (r && r.group === g) return 'remote:' + k; }
  return 'g:' + g.uuid;
}
/* 사람마다 고정된 얼굴 개성 — 단위: 눈 사이 거리(IPD, 약 6.2cm)의 비율. 과장 없이 '다른 사람'으로 보일 만큼만 */
function identity(g) {
  const r = rng(hash(keyOf(g) + '|face87')), fem = ((g.userData.look || {}).gender || '') === 'f';
  const asym = () => sr(r) * .012;
  return {
    cheekUp: sr(r) * .05, cheekOut: sr(r) * .05 + (fem ? -.01 : .01),
    jawDown: sr(r) * .05 + (fem ? -.012 : .012), jawFwd: sr(r) * .035, jawW: 1 + sr(r) * .06 + (fem ? -.02 : .02),
    browUp: sr(r) * .05, browTilt: sr(r) * .035, mouthW: sr(r) * .06, lipU: sr(r) * .028 + (fem ? .01 : 0), lipL: sr(r) * .03 + (fem ? .01 : 0),
    aL: [asym(), asym(), asym()], aR: [asym(), asym(), asym()],
    blinkRate: .75 + r() * .6, browLive: .6 + r() * .8, smileBias: sr(r) * .12,
  };
}

/* ── 리그 준비 ── */
function setup(g, r) {
  const B = {}, by = new Map(); r.model.traverse(o => { if (o.isBone || o.type === 'Bone' || /bip01|eye/i.test(o.name || '')) { const k = nrm(o.name); if (!by.has(k)) by.set(k, o); } });
  for (const k in FB) { const b = by.get(FB[k]); if (b) B[k] = b; }
  const eL = EYE.L.map(k => by.get(k)).find(Boolean), eR = EYE.R.map(k => by.get(k)).find(Boolean), head = r.Bn && r.Bn.head;
  const morph = !!(r.face && r.face.M && r.face.M.length), keys = r.face && r.face.keys;
  const hasBlinkM = !!(keys && (keys.has ? keys.has('eyeBlinkLeft') : true) && morph);
  const st = { g, r, B, eL, eR, head, morph, hasBlinkM, id: identity(g), n: Object.keys(B).length, base: new Map(), frame: null, t: Math.random() * 100, blink: 0, live: { bi: 0, bo: 0, sm: 0, tB: 0, tS: 0 } };
  if (st.n) DH.stats.idRigs++;
  /* ④ 각막 광택 — 별도 안구 메시(VALID: h_L_eye/h_R_eye) */
  r.model.traverse(o => { if (!o.isMesh || !/(^|_)(l|r)_eye$|eyeball|cornea/i.test(o.name || '')) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m || m.userData.dhEye) return; m.userData.dhEye = true; if (m.roughness != null) m.roughness = .12; if (m.metalness != null) m.metalness = 0; m.needsUpdate = true; DH.stats.eyeMats++; }); });
  DH.stats.rigs++; return st;
}
/* 머리 좌표계(오른쪽·위·앞, 월드) — 처음 한 번 눈 위치와 몸 방향으로 정해 머리 뼈 기준으로 저장, 이후엔 머리 회전을 따라감 */
const _q = new T.Quaternion(), _v = new T.Vector3(), _a = new T.Vector3(), _b = new T.Vector3();
function frame(st) {
  const { head, eL, eR, r } = st; if (!head || !eL || !eR) return null;
  head.getWorldQuaternion(_q);
  if (!st.frame) { const pL = eL.getWorldPosition(new T.Vector3()), pR = eR.getWorldPosition(new T.Vector3()); const ipd = pL.distanceTo(pR); if (ipd < 1e-3) return null;
    const rq = r.root.getWorldQuaternion(new T.Quaternion()), up = new T.Vector3(0, 1, 0).applyQuaternion(rq), fw0 = new T.Vector3(0, 0, 1).applyQuaternion(rq);
    const right = pL.clone().sub(pR).normalize(); up.addScaledVector(right, -up.dot(right)).normalize(); let fw = new T.Vector3().crossVectors(right, up); if (fw.dot(fw0) < 0) { right.negate(); fw.negate(); }
    const iq = _q.clone().invert(); st.frame = { R: right.applyQuaternion(iq), U: up.applyQuaternion(iq), F: fw.applyQuaternion(iq), ipd: ipd / (r.root.getWorldScale(_v).y || 1) }; }
  const f = st.frame, s = r.root.getWorldScale(_v).y || 1;
  return { R: f.R.clone().applyQuaternion(_q), U: f.U.clone().applyQuaternion(_q), F: f.F.clone().applyQuaternion(_q), u: f.ipd * s };
}
/* 뼈 하나: 기준(쉬는 자세 또는 남이 바꾼 값) + 월드 변위 d · 월드 축 회전(ax, ang) · 국소 배율 sc */
function put(st, b, d, ax, ang, sc) {
  if (!b) return; let s = st.base.get(b);
  if (!s) { s = { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone(), wp: null, wq: null, ws: null }; st.base.set(b, s); }
  else { if (s.wp && !b.position.equals(s.wp)) s.p.copy(b.position); if (s.wq && !b.quaternion.equals(s.wq)) s.q.copy(b.quaternion); if (s.ws && !b.scale.equals(s.ws)) s.s.copy(b.scale); }
  b.position.copy(s.p); b.quaternion.copy(s.q); b.scale.copy(s.s);
  const par = b.parent;
  if (d && par && d.lengthSq() > 1e-12) { b.updateMatrixWorld(); const w = b.getWorldPosition(_a).add(d); par.worldToLocal(w); b.position.copy(w); }
  if (ax && ang && par) { par.getWorldQuaternion(_q); const pinv = _q.clone().invert(), wq = _q.clone().multiply(b.quaternion); b.quaternion.copy(pinv.multiply(new T.Quaternion().setFromAxisAngle(ax, ang).multiply(wq))); }
  if (sc) b.scale.multiply(sc);
  s.wp = b.position.clone(); s.wq = b.quaternion.clone(); s.ws = b.scale.clone();
}
/* 표정 → 뼈 목표(경량 모델용). 값: smile, open, brow(+올림/-찡그림), squint, sad */
const EX = { neutral: [0, 0, 0, 0, 0], smile: [.75, .04, .1, .25, 0], happy: [.75, .04, .1, .25, 0], laugh: [1, .3, .2, .5, 0], shy: [.4, 0, .15, .2, 0], surprised: [0, .35, 1, 0, 0], sad: [-.4, 0, .3, 0, 1], angry: [-.3, 0, -.8, .3, 0], annoyed: [-.25, 0, -.5, .2, 0], kiss: [-.2, 0, .1, .5, 0], wink: [.4, 0, 0, 0, 0], sleepy: [0, .05, -.1, .6, 0] };
const V = (x, y, z) => new T.Vector3(x, y, z);
function tick(st, dt) {
  const { B, r, id } = st, g = st.g, u = g.userData; if (!st.n) return;
  const f = frame(st); if (!f) return; const S = f.u;   // S: 눈 사이 거리(월드)
  const W = (k, x, y, z) => f.R.clone().multiplyScalar(x * S).addScaledVector(f.U, y * S).addScaledVector(f.F, z * S);
  st.t += dt; const lod = !st.morph;
  /* 표정(경량 모델만 뼈로) */
  let sm = 0, op = 0, br = 0, sq = 0, sd = 0;
  if (lod) { const e = EX[u.expr] || EX.neutral; [sm, op, br, sq, sd] = e;
    if (u.mouthOpen || (u.talkUntil && performance.now() < u.talkUntil)) { const t = performance.now() / 1000; op = Math.max(op, .16 + .2 * Math.abs(Math.sin(t * 11)) * (.6 + .4 * Math.sin(t * 3.7))); }
    st.blink += ((u.blink ? 1 : 0) - st.blink) * Math.min(1, dt * 30);
    DH.stats.lodFace = (DH.stats.lodFace || 0); }
  /* 살아 있는 얼굴: 아주 작은 눈썹·입꼬리 움직임(사람마다 빈도·크기 다름) — 모든 모델 */
  const L = st.live; L.tB -= dt; L.tS -= dt;
  if (L.tB < 0) { L.tB = 2 + Math.random() * 6 / id.browLive; L.biT = (Math.random() < .3 ? .05 + Math.random() * .06 : 0) * id.browLive; }
  if (L.tS < 0) { L.tS = 3 + Math.random() * 6; L.smT = Math.random() < .35 ? .08 + Math.random() * .1 : 0; }
  L.bi += ((L.biT || 0) - L.bi) * Math.min(1, dt * 4); L.sm += ((L.smT || 0) - L.sm) * Math.min(1, dt * 2.5);
  const smile = sm + L.sm + id.smileBias * .3, brow = br + L.bi;
  /* 개성 + 표정 → 뼈 */
  for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1, a = s === 'L' ? id.aL : id.aR;
    put(st, B['ch' + s], W(0, sg * (id.cheekOut + a[0]), id.cheekUp + a[1] + .05 * Math.max(0, smile) + .02 * sq, .01 * Math.max(0, smile)));
    put(st, B['bi' + s], W(0, sg * a[2] * .5, id.browUp + id.browTilt * -.5 + a[1] + .07 * brow - .02 * sd * -1, 0));
    put(st, B['bo' + s], W(0, sg * .004, id.browUp + id.browTilt + a[0] + .05 * brow - .03 * sd, 0));
    put(st, B['mc' + s], W(0, sg * (id.mouthW + a[2] + .06 * Math.max(0, smile)), .09 * smile - .03 * sd - .5 * op * .1, -.01 * Math.max(0, smile)));
    put(st, B['ul' + s], W(0, 0, .01 * Math.max(0, smile), id.lipU * .8));
    put(st, B['ll' + s], W(0, 0, 0, id.lipL * .8));
    if (lod) { const bk = Math.max(st.blink, sq * .35);
      put(st, B['t' + s], W(0, 0, -.26 * bk, .02 * bk)); put(st, B['b' + s], W(0, 0, .08 * bk, 0)); } }
  put(st, B.bm, W(0, 0, id.browUp + .05 * brow, 0));
  put(st, B.ulM, W(0, 0, 0, id.lipU)); put(st, B.llM, W(0, 0, 0, id.lipL));
  /* 턱: 개성(길이·앞뒤·폭) + 말할 때 벌림(경량 모델) — 회전 방향은 처음 한 번 아랫입술이 내려가는 쪽으로 정함 */
  if (B.jaw) {
    if (st.jawSg == null && B.llM) { put(st, B.jaw, null); B.jaw.updateMatrixWorld(true); const y0 = B.llM.getWorldPosition(_b).dot(f.U); put(st, B.jaw, null, f.R, .2); B.jaw.updateMatrixWorld(true); const y1 = B.llM.getWorldPosition(_b).dot(f.U); st.jawSg = y1 < y0 ? 1 : -1; }
    put(st, B.jaw, W(0, 0, -id.jawDown, id.jawFwd), lod && op > 0 ? f.R : null, (st.jawSg || 1) * op * .32, V(id.jawW, 1, id.jawW));
  }
}

/* ── 프레임: humanglb 이후(같은 'load' 이후에 등록 → 리타깃·블렌드셰이프 다음에 실행) ── */
const RIG = new WeakMap(); DH.rigOf = g => RIG.get(g);
function roots() { const out = []; const P = NC.player; if (P && P.group) out.push(P.group); for (const n of NC.npcs || []) if (n.g && n.g.visible) out.push(n.g); for (const g of (NC.NPC && NC.NPC.staff) || []) out.push(g); for (const k in (NC.remotes || {})) { const r = NC.remotes[k]; if (r && r.group) out.push(r.group); } return out; }
function TICK(dt) {
  if (DH.off || !dt) return; dt = Math.min(dt, .1); const cam = NC.camera; if (!cam) return; const cp = cam.position;
  for (const g of roots()) { const r = g.userData && g.userData.real; if (!r || r.pending || !r.model) continue;
    let st = RIG.get(g); if (!st || st.r !== r) { st = setup(g, r); RIG.set(g, st); }
    const d = g.getWorldPosition(_v).distanceTo(cp); if (d > DH.range && st.done) continue;   // 멀면 개성만 한 번 적용해 두고 매 프레임 계산은 생략
    try { tick(st, dt); st.done = true; } catch (e) { if (!DH._err) { DH._err = 1; console.warn('[digitalhuman]', e); } } }
}
addEventListener('load', () => { (NC.tickers = NC.tickers || []).push(dt => TICK(dt)); });

/* ③ 피부 디테일 — realBodyMat 셰이더에 모공 노멀 · 거칠기 변화(피부 마스크 gSkin 영역에만) */
const A = NC.Avatar, TL = NC.TexLib;
if (A && A.realBodyMat && TL) {
  let DET = null, RGH = null; try { DET = TL.texture('skin', 'normal', {}, [1, 1]); RGH = TL.texture('skin', 'rough', {}, [1, 1]); } catch (e) { }
  if (DET) { [DET, RGH].forEach(t => { if (t) { t.wrapS = t.wrapT = T.RepeatWrapping; t.needsUpdate = true; } });
    const rb0 = A.realBodyMat;
    A.realBodyMat = function (m) { const cu = rb0(m), prev = m.onBeforeCompile;
      cu.uDetN = { value: DET }; cu.uDetR = { value: RGH || DET }; cu.uDetRep = { value: 46 }; cu.uDetK = { value: NC.isMobile ? .4 : .55 };
      m.onBeforeCompile = (sh, rr) => { prev(sh, rr); if (DH.noSkinDetail) return; sh.uniforms.uDetN = cu.uDetN; sh.uniforms.uDetR = cu.uDetR; sh.uniforms.uDetRep = cu.uDetRep; sh.uniforms.uDetK = cu.uDetK;
        if (!/#include <normal_fragment_maps>/.test(sh.fragmentShader) || !/gSkin/.test(sh.fragmentShader)) return;
        sh.fragmentShader = 'uniform sampler2D uDetN; uniform sampler2D uDetR; uniform float uDetRep; uniform float uDetK;\n' + sh.fragmentShader
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          #if defined( USE_NORMALMAP ) && defined( USE_UV ) && ! defined( USE_TANGENT )
          if (uDetK > 0.0 && gSkin > 0.02) { vec3 dN = texture2D(uDetN, vUv * uDetRep).xyz * 2.0 - 1.0; dN.xy *= uDetK * gSkin; normal = perturbNormal2Arb(-vViewPosition, normal, normalize(dN), faceDirection); }
          #endif`)
          .replace('#include <lights_physical_fragment>', `{ float rr = texture2D(uDetR, vUv * uDetRep * .37).g; roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor * (0.82 + 0.36 * rr), 0.32, 0.95), gSkin); }
          #include <lights_physical_fragment>`); };
      m.customProgramCacheKey = () => 'realBody87'; m.needsUpdate = true; return cu; };
    DH.skinDetail = true; }
}
console.info('[digitalhuman] v87 얼굴 개성(뼈) · 경량 모델 얼굴 연기 · 피부 모공 디테일 · 각막 광택');
})();
