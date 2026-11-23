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
const V = NC.VRMKit = { ok: OK, list: [], cache: {}, share: {} };
if (!OK) { console.warn('[vrm] GLTFLoader/three-vrm 없음 → 절차적 아바타만 사용'); V.attach = () => Promise.resolve(null); return; }
const { VRM, VRMUtils } = window.THREE_VRM;
const loader = new T.GLTFLoader();

// 우리 rig 관절 → VRM 휴머노이드 뼈 (rig 의 L 은 -X 쪽 = 아바타 기준 오른쪽)
const MAP = { torso: 'spine', neck: 'neck', head: 'head', shL: 'rightUpperArm', elL: 'rightLowerArm', shR: 'leftUpperArm', elR: 'leftLowerArm', legL: 'rightUpperLeg', knL: 'rightLowerLeg', legR: 'leftUpperLeg', knR: 'leftLowerLeg' };
const CHILD = { rightUpperArm: 'rightLowerArm', rightLowerArm: 'rightHand', leftUpperArm: 'leftLowerArm', leftLowerArm: 'leftHand', rightUpperLeg: 'rightLowerLeg', rightLowerLeg: 'rightFoot', leftUpperLeg: 'leftLowerLeg', leftLowerLeg: 'leftFoot' };
const DOWN = new T.Vector3(0, -1, 0), tmpE = new T.Euler(), tmpQ = new T.Quaternion(), tmpQ2 = new T.Quaternion(), tmpV = new T.Vector3(), box = new T.Box3();

/* v45 같은 VRM 파일을 여러 인물이 쓰므로 파일은 한 번만 내려받고(ArrayBuffer 캐시) 인물마다 따로 파싱 */
const BUF = {};
function load(url) {
  if (/^blob:/.test(url)) return new Promise((res, rej) => loader.load(url, res, undefined, rej));
  BUF[url] = BUF[url] || fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
  return BUF[url].then(buf => new Promise((res, rej) => loader.parse(buf, url.replace(/[^/]*$/, ''), res, rej)));
}
function tint(vrm, t) {
  if (!t) return;
  vrm.scene.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
    const n = (m.name || '').toLowerCase(), key = /hair/.test(n) ? 'hair' : /top|tops|shirt|jacket|onepiece|body_00_cloth/.test(n) ? 'top' : /bottom|skirt|pants/.test(n) ? 'bottom' : /shoe/.test(n) ? 'shoes' : null;
    if (!key || !t[key]) return; const c = new T.Color(t[key]);
    if (m.color && m.color.isVector4) { m.color.set(c.r, c.g, c.b, m.color.w); if (m.shadeColor && m.shadeColor.isVector4) m.shadeColor.set(c.r * .7, c.g * .6, c.b * .75, m.shadeColor.w); }   // v45 MToon(0.6)은 속성값을 매 프레임 uniform 으로 복사 → 속성을 바꿔야 함
    else if (m.color) m.color.copy(c);
  }); });
}

/* ═════ v45 인물별 스타일: 같은 VRM 한 벌로도 사람마다 얼굴·헤어·옷이 다르게 ═════
 *  ■ 피부 톤 · 눈동자 색 · 눈썹 색 · 머리/상의/하의/신발 색
 *  ■ 헤어: long/wavy 는 원래 머리 · bob/ponytail/highPony/bun/braids 는 뒷머리를 숨기고 단발 캡 + 꽁지/올림머리/땋은 머리를 붙임(흔들림 포함)
 *  ■ 옷 무늬: 시퀸 · 메탈릭 · 호피 · 스트라이프 · 도트 · 체크 · 니트 · 플로럴 · 그래픽(90년대 클럽 룩) — 원래 옷 텍스처 위에 합성
 *  ■ 평소 얼굴: 눈매(살짝 감은 고양이 눈·동그란 눈) · 입꼬리 · 눈썹 각도를 블렌드셰이프 기본값으로 */
const R01 = s0 => { let x = (s0 >>> 0) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
function matsByName(vrm) { const M = {}; vrm.scene.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { const k = (m.name || '').toLowerCase().replace(/\s*\(.*$/, '').trim(); (M[k] = M[k] || { mats: [], meshes: new Set() }).mats.push(m); M[k].meshes.add(o); }); }); return M; }
function mulColor(m, c, shadeK = 1) {
  if (m.color && m.color.isVector4) { m.color.x *= c.r; m.color.y *= c.g; m.color.z *= c.b; if (m.shadeColor && m.shadeColor.isVector4) { m.shadeColor.x *= c.r * shadeK; m.shadeColor.y *= c.g * shadeK; m.shadeColor.z *= c.b * shadeK; } }
  else if (m.color) m.color.multiply(c);
}
function patternTex(m, kind, col, rnd) {
  const tex = m.map; const img = tex && tex.image; if (!img || !img.width) return;
  const W = Math.min(1024, img.width), H = Math.min(1024, img.height), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.drawImage(img, 0, 0, W, H); const c2 = '#' + col.getHexString(), dark = 'rgba(20,14,24,.55)', S = W / 512;
  g.save();
  if (kind === 'stripe') { g.globalCompositeOperation = 'multiply'; g.fillStyle = dark; for (let x = -H; x < W; x += 34 * S) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 14 * S, 0); g.lineTo(x + 14 * S + H * .25, H); g.lineTo(x + H * .25, H); g.fill(); } }
  else if (kind === 'dots') { g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(255,255,255,.75)'; for (let y = 0; y < H; y += 26 * S) for (let x = (y / (26 * S)) % 2 ? 13 * S : 0; x < W; x += 26 * S) { g.beginPath(); g.arc(x, y, 5.5 * S, 0, 7); g.fill(); } }
  else if (kind === 'check') { g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(30,20,30,.35)'; const q = 40 * S; for (let y = 0; y < H; y += q) g.fillRect(0, y, W, q / 2); for (let x = 0; x < W; x += q) g.fillRect(x, 0, q / 2, H); }
  else if (kind === 'leopard') { g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(205,150,70,.9)'; g.fillRect(0, 0, W, H); for (let i = 0; i < 260 * S; i++) { const x = rnd() * W, y = rnd() * H, r = (5 + rnd() * 7) * S; g.fillStyle = 'rgba(25,15,10,.9)'; g.beginPath(); g.ellipse(x, y, r, r * .75, rnd() * 3, 0, 5.2); g.lineWidth = 3 * S; g.strokeStyle = 'rgba(25,15,10,.9)'; g.stroke(); g.fillStyle = 'rgba(120,70,30,.6)'; g.beginPath(); g.ellipse(x, y, r * .55, r * .4, 0, 0, 7); g.fill(); } }
  else if (kind === 'sequin' || kind === 'metal') { g.globalCompositeOperation = 'screen'; for (let i = 0; i < (kind === 'sequin' ? 2600 : 500) * S; i++) { const x = rnd() * W, y = rnd() * H, a = .25 + rnd() * .65; g.fillStyle = `rgba(255,255,255,${a})`; const r = (kind === 'sequin' ? 2.2 : 6) * S; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } if (kind === 'metal') { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,255,255,.0)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); } }
  else if (kind === 'knit') { g.globalCompositeOperation = 'multiply'; g.strokeStyle = 'rgba(40,30,30,.35)'; g.lineWidth = 2 * S; for (let y = 0; y < H; y += 9 * S) for (let x = 0; x < W; x += 9 * S) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4.5 * S, y + 7 * S); g.lineTo(x + 9 * S, y); g.stroke(); } }
  else if (kind === 'floral') { g.globalCompositeOperation = 'source-over'; for (let i = 0; i < 140 * S; i++) { const x = rnd() * W, y = rnd() * H, r = (6 + rnd() * 6) * S, hue = ['#ff9ab8', '#ffe07a', '#ffffff', '#ff6a5a'][i % 4]; g.globalAlpha = .8; g.fillStyle = hue; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * .62, 0, 7); g.fill(); } g.fillStyle = '#d08a20'; g.beginPath(); g.arc(x, y, r * .45, 0, 7); g.fill(); } g.globalAlpha = 1; }
  else if (kind === 'graphic') { g.globalCompositeOperation = 'source-over'; g.globalAlpha = .85; for (let i = 0; i < 40 * S; i++) { const x = rnd() * W, y = rnd() * H, r = (10 + rnd() * 22) * S; g.fillStyle = ['#ff3d8a', '#3de6ff', '#ffd23d', '#7a3dff'][i % 4]; g.save(); g.translate(x, y); g.rotate(rnd() * 3); if (i % 3 === 0) { g.beginPath(); g.moveTo(-r, r); g.lineTo(0, -r); g.lineTo(r, r); g.fill(); } else if (i % 3 === 1) g.fillRect(-r * .7, -r * .2, r * 1.4, r * .4); else { g.beginPath(); g.arc(0, 0, r * .6, 0, 7); g.lineWidth = 5 * S; g.strokeStyle = g.fillStyle; g.stroke(); } g.restore(); } g.globalAlpha = 1; }
  else if (kind === 'leather') { g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(70,64,72,1)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'screen'; const gr = g.createLinearGradient(0, 0, W * .3, H); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  g.restore(); void c2;
  const nt = new T.CanvasTexture(cv); nt.flipY = tex.flipY; nt.encoding = tex.encoding; nt.wrapS = tex.wrapS; nt.wrapT = tex.wrapT; nt.anisotropy = 4;
  if (m.shadeTexture === tex) m.shadeTexture = nt; m.map = nt; m.needsUpdate = true;
}
const HAIR_KEEP = new Set(['long', 'wavy', undefined, null, '']);
function style(vrm, root, holder, st) {
  const look = st.look || {}, face = look.face || {}, rnd = R01(st.seed || 7), M = matsByName(vrm), out = { base: {}, sway: [] };
  const each = (k, f) => (M[k] ? M[k].mats : []).forEach(m => { if (!/outline/i.test(m.name || '')) f(m); });
  /* 피부 톤: 샘플(밝은 피부) 대비 비율로 곱함 */
  if (look.skin) { const ref = new T.Color('#f8e2d4'), sc = new T.Color(look.skin), c = new T.Color(U.clamp(sc.r / ref.r, .42, 1.04), U.clamp(sc.g / ref.g, .32, 1.04), U.clamp(sc.b / ref.b, .26, 1.04)); ['face', 'body'].forEach(k => each(k, m => mulColor(m, c, 1))); }
  /* 눈동자 · 눈썹 */
  if (face.eyeColor) { const c = new T.Color(face.eyeColor).lerp(new T.Color('#ffffff'), .45); each('eyeiris', m => mulColor(m, c)); }
  { const hc = new T.Color(look.hairColor || '#2a1e18'), c = hc.clone().lerp(new T.Color('#ffffff'), .35); each('facebrow', m => mulColor(m, c)); }
  /* 옷 무늬 */
  const pat0 = look.sequin ? 'sequin' : look.metallic ? 'metal' : look.leather ? 'leather' : (look.pattern && look.pattern !== 'solid') ? look.pattern : null;
  const PAT90 = ['solid', 'solid', 'sequin', 'stripe', 'dots', 'check', 'leopard', 'metal', 'solid', 'graphic'];
  const topPat = pat0 || PAT90[Math.floor(rnd() * PAT90.length)], botPat = look.leather || look.bottom === 'leather' ? 'leather' : (rnd() < .3 ? ['check', 'stripe', 'leopard', 'metal'][Math.floor(rnd() * 4)] : 'solid');
  if (topPat && topPat !== 'solid') each('tops', m => patternTex(m, topPat, new T.Color(look.topColor || '#ffffff'), rnd));
  if (botPat === 'leather') each('bottoms', m => patternTex(m, botPat, new T.Color(look.bottomColor || '#333'), rnd));   // 하의 텍스처에 다리(스타킹)가 같이 있어 무늬는 레더만
  if (topPat === 'sequin' || topPat === 'metal') each('tops', m => { if (m.rimColor && m.rimColor.isVector4) { m.rimColor.set(.3, .3, .36, 1); m.rimFresnelPower = 3; } });
  /* 평소 얼굴(블렌드셰이프 기본값) — 성격 + 얼굴 설정 + 시드 */
  const B = out.base, tr = st.trait || '';
  if (tr === 'cool' || (face.eyeTilt || 0) > .1) { B.angry = .1 + rnd() * .06; B.blink = .14 + rnd() * .08; }       // 눈꼬리 올라간 시크한 눈매
  else if (tr === 'outgoing' || (face.eyeSize || 1) > 1.08) { B.fun = .06 + rnd() * .06; }                               // 입꼬리 올라간 밝은 얼굴
  else if (tr === 'shy' || tr === 'sweet') { B.sorrow = .08 + rnd() * .06; B.joy = .06; }                              // 순한 눈썹
  else { const k = Math.floor(rnd() * 4); if (k === 0) B.blink = .1 + rnd() * .1; else if (k === 1) B.fun = .05 + rnd() * .06; else if (k === 2) { B.sorrow = .07; B.fun = .05; } else B.angry = .07; }
  if ((st.age || 25) > 40) { B.blink = Math.max(B.blink || 0, .12); B.sorrow = Math.max(B.sorrow || 0, .05); }
  /* 헤어 */
  const hs = look.hairStyle;
  if (st.hairShapes && !HAIR_KEEP.has(hs) && M.hairback) {   // 실험 기능(기본 꺼짐): 덧붙인 툰 헤어가 VRoid 원래 머리보다 품질이 떨어져 기본은 원래 머리 + 색만 바꿈
    M.hairback.meshes.forEach(o => { o.visible = false; });
    /* 샘플 VRM 은 긴 머리 가닥이 'Hair' 재질 프리미티브에도 들어 있음 → 머리 관절보다 한참 아래로 내려오는 Hair 조각도 숨김 */
    vrm.scene.updateMatrixWorld(true); const hb0 = vrm.humanoid.getBoneNode('head'), hy = hb0 ? hb0.getWorldPosition(new T.Vector3()).y : 0, sc0 = holder.scale.y || 1;
    if (M.hair) [...M.hair.meshes].forEach(o => { const b = new T.Box3().setFromObject(o); if (b.min.y < hy - .1 * sc0) o.visible = false; });
    const hairM = M.hair && M.hair.mats[0], hc = new T.Color(look.hairColor || '#2a1e18'), hairMat = new T.MeshToonMaterial({ color: hc });
    if (hairM && hairM.color && hairM.color.isVector4) hairMat.color.setRGB(hairM.color.x, hairM.color.y, hairM.color.z);
    const headB = vrm.humanoid.getBoneNode('head'); if (!headB) return out;
    /* 머리 관절 기준(모델 단위, 샘플 VRM 비율) — 뒤통수 방향 bz */
    const bz = st.flip === false ? -1 : 1, HC = { y: .105, w: .19, h: .23, d: .215 };
    const put = (geo, x, y, z, rx = 0, rz = 0, par = headB) => { const m = new T.Mesh(geo, hairMat); m.position.set(x, y, z * bz); m.rotation.set(rx * bz, 0, rz); m.castShadow = true; par.add(m); return m; };
    const phi0 = bz > 0 ? -.6 : Math.PI - .6;
    // ① 정수리 돔(이마 헤어라인까지 360°) ② 뒤통수·옆을 덮는 캡(목덜미까지)
    const dome = put(new T.SphereGeometry(.5, 28, 12, 0, Math.PI * 2, 0, Math.PI * .34), 0, HC.y, .006); dome.scale.set(HC.w * 1.04, HC.h, HC.d * 1.02);
    const capLen = hs === 'bob' ? .68 : .6, cap = put(new T.SphereGeometry(.5, 28, 18, phi0, Math.PI + 1.2, 0, Math.PI * capLen), 0, HC.y, .006); cap.scale.set(HC.w * 1.05, HC.h * 1.02, HC.d * 1.04);
    if (hs === 'bob') { const hem = put(new T.CylinderGeometry(.5, .56, .2, 28, 1, true, bz > 0 ? -.6 - Math.PI / 2 + Math.PI : Math.PI / 2 - .6, Math.PI + 1.2), 0, HC.y - HC.h * .36, .006); hem.scale.set(HC.w * 1.08, HC.h * .5, HC.d * 1.06);
      [-1, 1].forEach(sx => { const f = put(new T.SphereGeometry(.5, 12, 10), sx * HC.w * .36, HC.y + HC.h * .2, -HC.d * .38); f.scale.set(HC.w * .45, HC.h * .22, HC.d * .2); f.rotation.z = sx * .5; }); }   // 앞머리(옆으로 넘긴 뱅)
    else { const f = put(new T.SphereGeometry(.5, 14, 10), 0, HC.y + HC.h * .26, -HC.d * .4); f.scale.set(HC.w * .9, HC.h * .2, HC.d * .22); }   // 이마 위 앞머리 볼륨
    const backZ = HC.d * .5;
    if (hs === 'ponytail' || hs === 'highPony') {
      const hi = hs === 'highPony', ty = HC.y + HC.h * (hi ? .36 : .08);
      put(new T.TorusGeometry(.022, .009, 6, 14), 0, ty, backZ + .005, Math.PI / 2 - .4);
      const tail = new T.CylinderGeometry(.036, .008, hi ? .36 : .3, 10, 4); tail.translate(0, -(hi ? .18 : .15), 0);
      const tm = put(tail, 0, ty, backZ + .01, -.35); out.sway.push({ m: tm, rx: tm.rotation.x, rz: tm.rotation.z, a: .1, f: 2.1, ph: rnd() * 6 });
    } else if (hs === 'bun') {
      put(new T.SphereGeometry(.06, 16, 12), 0, HC.y + HC.h * .34, backZ + .02);
      put(new T.TorusGeometry(.042, .008, 6, 16), 0, HC.y + HC.h * .3, backZ - .002, Math.PI / 2 + .5);
    } else if (hs === 'braids') {
      [-1, 1].forEach(sx => { const br = new T.Group(); for (let i = 0; i < 9; i++) { const b2 = new T.Mesh(new T.SphereGeometry(.024 - i * .0013, 8, 6), hairMat); b2.position.set((i % 2 ? .006 : -.006), -i * .036, 0); b2.scale.set(1, 1.25, 1); br.add(b2); }
        br.position.set(sx * HC.w * .42, HC.y - HC.h * .1, .02 * bz); br.rotation.set(.15 * bz, 0, sx * .12); headB.add(br); out.sway.push({ m: br, rx: br.rotation.x, rz: br.rotation.z, a: .06, f: 1.7, ph: rnd() * 6 }); });
    }
  }
  return out;
}

V.attach = async (root, url, opt = {}) => {
  const u = root.userData; if (!u || !u.rig) return null;
  let gltf; try { gltf = await load(url); } catch (e) { console.warn('[vrm] 로드 실패', url, e); NC.ui && NC.ui.toast && NC.ui.toast('3D 모델을 불러오지 못했어요: ' + url); return null; }
  VRMUtils.removeUnnecessaryJoints(gltf.scene);
  const vrm = await VRM.from(gltf); if (!root.parent && !opt.preview) return null;
  /* v45 같은 파일을 여러 명이 쓸 때 텍스처는 첫 인물의 것을 함께 씀 → GPU 텍스처 메모리 1벌분(인물마다 ~45MB 절약) */
  if (!/^blob:/.test(url)) { const SH = V.share[url] || (V.share[url] = { tex: {}, geo: {} });
    let gi = 0; vrm.scene.traverse(o => { if (!o.isMesh) return; const mats = Array.isArray(o.material) ? o.material : [o.material];
      void gi;   /* 지오메트리는 인물마다 따로 둠(텍스처만 공유) */
      mats.forEach(m => { for (const k of Object.keys(m)) { const t = m[k]; if (!t || !t.isTexture) continue; const key = m.name + '|' + k; if (SH.tex[key] && SH.tex[key] !== t) { t.dispose(); m[k] = SH.tex[key]; } else SH.tex[key] = t; } }); }); }
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
  let sty = null; if (opt.style) { try { sty = style(vrm, root, holder, Object.assign({ flip: facingNegZ }, opt.style)); } catch (e) { console.warn('[vrm] 스타일 적용 실패', e); } }
  vrm.scene.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (typeof m.shouldApplyUniforms === 'boolean') m.shouldApplyUniforms = true; }); });   // MToon 은 이 표시가 있어야 바뀐 색·텍스처를 uniform 에 반영
  // 월드(루트 기준) 리타깃: 뼈 목표 회전 = (절차적 관절의 루트기준 회전) × C,  C = (T포즈→팔 내림 보정) × 휴지 회전
  root.updateMatrixWorld(true); const rootInv = root.getWorldQuaternion(new T.Quaternion()).invert();
  const rq = o => o.getWorldQuaternion(new T.Quaternion()).premultiply(rootInv), rp = o => root.worldToLocal(o.getWorldPosition(new T.Vector3()));
  const J = [];
  ['torso', 'neck', 'head', 'shL', 'elL', 'shR', 'elR', 'legL', 'knL', 'legR', 'knR'].forEach(rk => { const bn = MAP[rk], b = bone(bn); if (!b) return;
    const rest = rq(b); let A = new T.Quaternion(); const cb = CHILD[bn] && bone(CHILD[bn]);
    if (cb) { const dir = rp(cb).sub(rp(b)).normalize(); A.setFromUnitVectors(dir, DOWN); }
    J.push({ rk, b, C: A.multiply(rest) }); });
  const hips = bone('hips'), hipsY0 = hips ? hips.position.y : 0;
  const rec = { root, u, vrm, holder, J, s, hips, hipsY0, flip: facingNegZ, blinkW: 0, url, base: sty ? sty.base : null, sway: sty ? sty.sway : null };
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
    if (r.base) for (const k in r.base) w[k] = Math.max(w[k] || 0, r.base[k] * (u.mouthOpen && k !== 'blink' && k !== 'angry' && k !== 'sorrow' ? .5 : 1));   // v45 인물마다 다른 '평소 얼굴'(눈매·입꼬리·눈썹)
    const tk = +u.mouthOpen || 0; if (tk) { const v = ['a', 'i', 'u', 'e', 'o'][(performance.now() / 110 | 0) % 5]; w[v] = Math.max(w[v], tk * .85); w.joy *= .5; w.fun *= .5; }
    r.blinkW += ((u.blink ? 1 : 0) - r.blinkW) * Math.min(1, dt * 30); if (r.blinkW > .02 && !(w.joy > .7 || w.fun > .7)) w.blink = Math.max(w.blink, r.blinkW);
    const g = u.gaze || [0, 0]; if (g[0] > .1) w.lookleft = Math.min(1, g[0]); else if (g[0] < -.1) w.lookright = Math.min(1, -g[0]); if (g[1] > .1) w.lookdown = Math.min(1, g[1]); else if (g[1] < -.1) w.lookup = Math.min(1, -g[1]);
    for (const n of NAMES) { try { bp.setValue(n, w[n]); } catch (e) { /* 없는 프리셋 무시 */ } }
  }
  // 순간이동(좌석·노래방 이동 등) 시 머리카락 물리 튐 방지
  const wp = root.getWorldPosition(tmpV); if (!r.last) r.last = wp.clone(); if (wp.distanceTo(r.last) > .6 && vrm.springBoneManager) vrm.springBoneManager.reset(); r.last.copy(wp);
  if (r.sway) { const t = performance.now() / 1000; r.sway.forEach(o => { o.m.rotation.x = o.rx + Math.sin(t * o.f + o.ph) * o.a; o.m.rotation.z = o.rz + Math.sin(t * o.f * .7 + o.ph) * o.a * .6; }); }   // v45 덧붙인 꽁지머리·땋은 머리 흔들림
  const steps = dt > .025 ? 2 : 1; for (let i = 0; i < steps; i++) vrm.update(dt / steps);
}
NC.tickers.push(dt => {
  for (let i = V.list.length - 1; i >= 0; i--) { const r = V.list[i]; if (!r.root.parent) { V.list.splice(i, 1); continue; } if (!r.root.visible) continue; applyRec(r, Math.min(dt, .05)); }
});

/* v45 여러 명에게 차례로 입힘(한꺼번에 파싱하면 화면이 멈춤) */
V.queue = []; V.busy = false;
V.enqueue = (root, url, opt) => { V.queue.push([root, url, opt]); if (!V.busy) V._next(); };
V._next = () => { const it = V.queue.shift(); if (!it) { V.busy = false; return; } V.busy = true; V.attach(...it).catch(e => console.warn('[vrm]', e)).finally(() => setTimeout(V._next, 250)); };

/* 플레이어: 내 VRM 파일 불러오기 (시작 화면) */
V.playerUrl = null;
V.pickFile = () => new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.vrm,.glb'; inp.onchange = () => { const f = inp.files[0]; if (!f) return res(null); if (V.playerUrl) URL.revokeObjectURL(V.playerUrl); V.playerUrl = URL.createObjectURL(f); V.playerName = f.name; res({ url: V.playerUrl, name: f.name }); }; inp.click(); });
console.info('[vrm] VRM 캐릭터 지원 켜짐 (three-vrm ' + (window.THREE_VRM.VRM ? '0.6' : '?') + ')');
})();
