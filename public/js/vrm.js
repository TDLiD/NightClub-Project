/* vrm.js — 고품질 3D 캐릭터(VRM) 연동 (v7)
 *  ■ VRoid Studio(무료) 등에서 만든 VRM 모델을 인물에 입힘. 기존 절차적 아바타의 관절(rig)은 보이지 않게 그대로 두고,
 *    VRM 뼈대가 매 프레임 그 회전을 따라감 → 춤·앉기·대화·노래방·제스처가 코드 수정 없이 그대로 동작
 *  ■ 표정: 웃음(joy/fun)·슬픔·화남·놀람·윙크·눈 깜빡임·말할 때 입모양(아/이/우/에/오)·시선 → VRM 블렌드셰이프
 *  ■ 머리카락·치마 흔들림: VRM 스프링 본 물리
 *  ■ 사용: npcs.json 페르소나에 "model": "models/파일.vrm" + (선택) "tint": { "hair":"#hex", "top":"#hex", "bottom":"#hex" }
 *          플레이어: 시작 화면 「🧍 내 VRM 불러오기」로 내 PC 의 .vrm 파일 선택 (이번 접속 동안 적용)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const T = NC.THREE, U = NC.util, Q = NC.quality || {};
const OK = !!(T.GLTFLoader && window.THREE_VRM);
const V = NC.VRMKit = { ok: OK, list: [], cache: {} };
if (!OK) { console.warn('[vrm] GLTFLoader/three-vrm 없음 → 절차적 아바타만 사용'); V.attach = () => Promise.resolve(null); return; }
const { VRM, VRMUtils } = window.THREE_VRM;
const loader = new T.GLTFLoader();

// 우리 rig 관절 → VRM 휴머노이드 뼈 (rig 의 L 은 -X 쪽 = 아바타 기준 오른쪽)
const MAP = { torso: 'spine', neck: 'neck', head: 'head', shL: 'rightUpperArm', elL: 'rightLowerArm', shR: 'leftUpperArm', elR: 'leftLowerArm', legL: 'rightUpperLeg', knL: 'rightLowerLeg', legR: 'leftUpperLeg', knR: 'leftLowerLeg' };
const CHILD = { rightUpperArm: 'rightLowerArm', rightLowerArm: 'rightHand', leftUpperArm: 'leftLowerArm', leftLowerArm: 'leftHand', rightUpperLeg: 'rightLowerLeg', rightLowerLeg: 'rightFoot', leftUpperLeg: 'leftLowerLeg', leftLowerLeg: 'leftFoot' };
const DOWN = new T.Vector3(0, -1, 0), tmpE = new T.Euler(), tmpQ = new T.Quaternion(), tmpQ2 = new T.Quaternion(), tmpV = new T.Vector3(), box = new T.Box3();

function load(url) { return new Promise((res, rej) => loader.load(url, res, undefined, rej)); }
function tint(vrm, t) {
  if (!t) return;
  vrm.scene.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
    const n = (m.name || '').toLowerCase(), key = /hair/.test(n) ? 'hair' : /top|tops|shirt|jacket|onepiece|body_00_cloth/.test(n) ? 'top' : /bottom|skirt|pants/.test(n) ? 'bottom' : /shoe/.test(n) ? 'shoes' : null;
    if (!key || !t[key]) return; const c = new T.Color(t[key]);
    if (m.uniforms && m.uniforms.color) { const cv = m.uniforms.color.value; cv.x = c.r; cv.y = c.g; cv.z = c.b; if (m.uniforms.shadeColor) m.uniforms.shadeColor.value.set(c.r * .7, c.g * .6, c.b * .75); }
    else if (m.color) m.color.copy(c);
  }); });
}

V.attach = async (root, url, opt = {}) => {
  const u = root.userData; if (!u || !u.rig) return null;
  let gltf; try { gltf = await load(url); } catch (e) { console.warn('[vrm] 로드 실패', url, e); NC.ui && NC.ui.toast && NC.ui.toast('3D 모델을 불러오지 못했어요: ' + url); return null; }
  VRMUtils.removeUnnecessaryJoints(gltf.scene);
  const vrm = await VRM.from(gltf); if (!root.parent && !opt.preview) return null;
  const H = vrm.humanoid, bone = n => H.getBoneNode(n);
  // 방향: VRM0 은 -Z 를 바라봄 → π 회전 + 회전값 좌표 변환
  vrm.scene.updateMatrixWorld(true);
  const la = bone('leftUpperArm'), facingNegZ = la ? la.getWorldPosition(tmpV).x < 0 : true;
  const holder = new T.Group(); holder.add(vrm.scene); if (facingNegZ) vrm.scene.rotation.y = Math.PI;
  // 크기: 키에 맞춤
  box.setFromObject(vrm.scene); const h0 = box.max.y - box.min.y || 1.5, s = (u.look && u.look.height ? u.look.height : 1.65) / h0; holder.scale.setScalar(s);
  root.add(holder);
  // 절차적 메시 숨기기(관절은 계속 움직임). 잔·마이크는 유지
  const keep = new Set(); [u.glass, u.mic].forEach(g => g && g.traverse(o => keep.add(o)));
  u.rig.body.traverse(o => { if ((o.isMesh || o.isSprite) && !keep.has(o)) o.visible = false; });
  vrm.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (Q.shadows) o.castShadow = true; } });
  tint(vrm, opt.tint);
  // 월드(루트 기준) 리타깃: 뼈 목표 회전 = (절차적 관절의 루트기준 회전) × C,  C = (T포즈→팔 내림 보정) × 휴지 회전
  root.updateMatrixWorld(true); const rootInv = root.getWorldQuaternion(new T.Quaternion()).invert();
  const rq = o => o.getWorldQuaternion(new T.Quaternion()).premultiply(rootInv), rp = o => root.worldToLocal(o.getWorldPosition(new T.Vector3()));
  const J = [];
  ['torso', 'neck', 'head', 'shL', 'elL', 'shR', 'elR', 'legL', 'knL', 'legR', 'knR'].forEach(rk => { const bn = MAP[rk], b = bone(bn); if (!b) return;
    const rest = rq(b); let A = new T.Quaternion(); const cb = CHILD[bn] && bone(CHILD[bn]);
    if (cb) { const dir = rp(cb).sub(rp(b)).normalize(); A.setFromUnitVectors(dir, DOWN); }
    J.push({ rk, b, C: A.multiply(rest) }); });
  const hips = bone('hips'), hipsY0 = hips ? hips.position.y : 0;
  const rec = { root, u, vrm, holder, J, s, hips, hipsY0, flip: facingNegZ, blinkW: 0, url };
  u.vrm = rec; u.redraw = () => { u.faceDirty = false; };      // 얼굴 캔버스 대신 블렌드셰이프 사용
  if (vrm.springBoneManager) vrm.springBoneManager.reset();
  V.list.push(rec); return rec;
};

const EXPR_W = { smile: { joy: .55 }, laugh: { fun: .9, joy: .3 }, joy: { joy: 1 }, shy: { joy: .35 }, sad: { sorrow: .85 }, annoyed: { angry: .75 }, surprised: { o: .7 }, wink: { joy: .35, blink_r: 1 }, kiss: { blink: 1, u: .55, joy: .15 }, neutral: {} };
const NAMES = ['joy', 'fun', 'sorrow', 'angry', 'a', 'i', 'u', 'e', 'o', 'blink', 'blink_l', 'blink_r', 'lookleft', 'lookright', 'lookup', 'lookdown'];
const qA = new T.Quaternion(), qB = new T.Quaternion(), qR = new T.Quaternion();
function applyRec(r, dt) {
  const { u, J, vrm, root } = r, R = u.rig;
  root.getWorldQuaternion(qR).invert();
  for (const j of J) {    // 부모가 먼저 오도록 정렬돼 있음
    R[j.rk].getWorldQuaternion(qA).premultiply(qR).multiply(j.C);          // 목표(루트 기준)
    j.b.parent.getWorldQuaternion(qB).premultiply(qR).invert();             // 부모(루트 기준)의 역
    j.b.quaternion.copy(qB.multiply(qA));
  }
  if (r.hips) r.hips.position.y = r.hipsY0 + (R.hips.position.y - u.hipH) * u.figScale / r.s;
  r.holder.position.set(R.body.position.x * u.figScale, R.body.position.y * u.figScale, 0);
  // 표정
  const bp = vrm.blendShapeProxy; if (bp) {
    const w = {}; NAMES.forEach(n => w[n] = 0); Object.assign(w, EXPR_W[u.expr] || {});
    const tk = +u.mouthOpen || 0; if (tk) { const v = ['a', 'i', 'u', 'e', 'o'][(performance.now() / 110 | 0) % 5]; w[v] = Math.max(w[v], tk * .85); w.joy *= .5; w.fun *= .5; }
    r.blinkW += ((u.blink ? 1 : 0) - r.blinkW) * Math.min(1, dt * 30); if (r.blinkW > .02 && !(w.joy > .7 || w.fun > .7)) w.blink = Math.max(w.blink, r.blinkW);
    const g = u.gaze || [0, 0]; if (g[0] > .1) w.lookleft = Math.min(1, g[0]); else if (g[0] < -.1) w.lookright = Math.min(1, -g[0]); if (g[1] > .1) w.lookdown = Math.min(1, g[1]); else if (g[1] < -.1) w.lookup = Math.min(1, -g[1]);
    for (const n of NAMES) { try { bp.setValue(n, w[n]); } catch (e) { /* 없는 프리셋 무시 */ } }
  }
  // 순간이동(좌석·노래방 이동 등) 시 머리카락 물리 튐 방지
  const wp = root.getWorldPosition(tmpV); if (!r.last) r.last = wp.clone(); if (wp.distanceTo(r.last) > .6 && vrm.springBoneManager) vrm.springBoneManager.reset(); r.last.copy(wp);
  const steps = dt > .025 ? 2 : 1; for (let i = 0; i < steps; i++) vrm.update(dt / steps);
}
NC.tickers.push(dt => {
  for (let i = V.list.length - 1; i >= 0; i--) { const r = V.list[i]; if (!r.root.parent) { V.list.splice(i, 1); continue; } if (!r.root.visible) continue; applyRec(r, Math.min(dt, .05)); }
});

/* 플레이어: 내 VRM 파일 불러오기 (시작 화면) */
V.playerUrl = null;
V.pickFile = () => new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.vrm,.glb'; inp.onchange = () => { const f = inp.files[0]; if (!f) return res(null); if (V.playerUrl) URL.revokeObjectURL(V.playerUrl); V.playerUrl = URL.createObjectURL(f); V.playerName = f.name; res({ url: V.playerUrl, name: f.name }); }; inp.click(); });
console.info('[vrm] VRM 캐릭터 지원 켜짐 (three-vrm ' + (window.THREE_VRM.VRM ? '0.6' : '?') + ')');
})();
