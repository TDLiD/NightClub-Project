/* motel19.js — 🔥 19+ 프라이빗 익스피리언스 (v60) · 파라다이스 인 객실 전용 확장
 *  기존 motel.js 의 상태(S)·동의(consent/NEED)·연출(nSay·modal)·블루스(K.startBlues)·커플 IK(NC.Couple)를 그대로 씀 — 새 관계/애니메이션 시스템 없음
 *  · 표시 조건: 체크인한 객실 안 + 파트너 동석 (클럽·노래방·로비·복도에서는 보이지 않음)
 *  · 동의: 행위·단계마다 따로. 언제든 ⏸ 잠깐 / ⏹ 그만 → 중립 자세로 복귀
 *  · 많이 취하면(플레이어 취기 3.5↑ · 상대 주량 초과) 신체 접촉·탈의·함께 샤워 잠금 (관리자 🧪 모드에서도 유지)
 *  · 노출 표현 상한: 속옷 차림까지 + 그 이상은 수건·이불·김 서린 유리로 가림 · 성행위는 암전(🌙 둘만의 시간)으로 처리
 *  · 옷: 현재 GLB 모델은 옷이 메시에 구워져 있어 '의상 소품(캐미솔·박서·가운·잠옷·수건)'을 뼈에 붙여 갈아입음을 표현 */
(() => {
'use strict';
const NC = window.NC, S = NC && NC.Motel; if (!S || !S._x) { console.warn('[motel19] motel.js 가 없어요'); return; }
const X = S._x, { T, U, L, pick, BX, RHX, RHZ, RV, box, cyl, std, nSay, meSay, sys, say, wait, beep, modal, esc, tr, memOf, impaired, adminMax, attrs, save, NEED, consent, sitBoth, standBoth, standAct, endStanding, stopHand, startHand, applyMood, EVENTS, event, photo, roomService, checkout, renderPanel, panel, bar, placePartner, updBar } = X;
const K = NC.Karaoke, P = () => NC.player, CZ = 90, V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const toast = t => NC.ui.toast(t), clamp = U.clamp;

/* ═════════════ 0. 상태 ═════════════ */
const Z = { out: { me: 0, n: 0 }, wear: { me: '', n: '' }, wet: { me: 0, n: 0 }, drinks: { me: 0, n: 0 }, nonAlc: { me: false, n: false }, mood: 30, lim: {}, wins: { me: 0, n: 0 }, hist: [], pm: 0,
  touch: null, lie: null, pin: null, slide: null, shower: null, jac: { fill: 0, on: false, in: false, foam: false }, paused: false, open: U.store.get('nc_m19open', {}), games: 0 };
function resetZ() { Object.assign(Z, { out: { me: 0, n: 0 }, wear: { me: '', n: '' }, wet: { me: 0, n: 0 }, drinks: { me: 0, n: 0 }, nonAlc: { me: false, n: false }, mood: 30, lim: {}, wins: { me: 0, n: 0 }, hist: [], pm: 0, touch: null, lie: null, pin: null, slide: null, shower: null, paused: false, games: 0 }); Z.jac = { fill: 0, on: false, in: false, foam: false }; }
const adultOk = () => !!(U.store.get('nc_adult19', 0) || (NC.account && NC.account.adult));
function verifyAdult() { return modal(`<h3>🔞 ${L('성인 전용', 'Adults only')}</h3><p>${L('이 메뉴는 만 19세 이상 성인을 위한 콘텐츠예요.<br>등장인물은 모두 성인이며, 모든 행동은 서로 동의할 때만 진행돼요.', 'This menu is for adults (19+). All characters are adults and every action needs mutual consent.')}</p>`, [[L('네, 만 19세 이상이에요', 'Yes, I am 19+'), 1, true], [L('아니요', 'No'), 0]]).then(({ val }) => { if (val) { U.store.set('nc_adult19', 1); if (NC.account) NC.account.adult = true; } return !!val; }); }   // 실제 본인인증 API 는 여기서 연결
const gP = () => ((P().group.userData.look || {}).gender === 'f' ? 'f' : 'm'), gN = () => (S.n && S.n.gender === 'm' ? 'm' : 'f');
const gOf = w => (w === 'me' ? gP() : gN()), G = w => (w === 'me' ? P().group : S.n.g);
const nm = () => esc(S.n ? S.n.name : '');
const byT = o => { const v = o[S.n && S.n.trait] || o.outgoing || o._; return Array.isArray(v) ? pick(v) : v; };
const capN = () => ({ shy: 2, cool: 4, playful: 3, outgoing: 4 }[S.n && S.n.trait] || 3) + (U.hash(String(S.n && S.n.name)) % 2);
const drunkN = () => Z.drinks.n > capN();
const meDrunk = () => ((NC.Life && NC.Life.tipsy) || 0) >= 3.5;
const moodNow = () => adminMax() ? 100 : clamp(Z.mood + (/dim|neon/.test(S.mood) ? 10 : 0) + (S.music === 'blues' ? 8 : 0) + (S.comfort > 70 ? 6 : 0), 0, 100);
const trustNow = () => attrs(S.n).trust;
const bump = (m, c = 0) => { Z.mood = clamp(Z.mood + m, 0, 100); if (c) S.comfort = clamp(S.comfort + c, 0, 100); };
const inRoom = () => S.on && S.step === 'room' && S.n && !S.alone;
/* 착장 단계(벗은 개수) 0 외출복 · 1 겉옷 · 2 신발/액세서리 · 3 상의 · 4 하의(=속옷 차림) · 5 속옷(=수건·이불로 가림) */
const ITEM = { f: [L('외출복', 'Outfit'), L('재킷', 'Jacket'), L('구두·귀걸이', 'Heels & earrings'), L('블라우스', 'Blouse'), L('치마', 'Skirt'), L('속옷', 'Underwear')], m: [L('외출복', 'Outfit'), L('재킷', 'Jacket'), L('신발·시계', 'Shoes & watch'), L('셔츠', 'Shirt'), L('바지', 'Pants'), L('속옷', 'Underwear')] };
const STAGE = [L('외출복', 'Dressed'), L('재킷 벗음', 'No jacket'), L('편한 차림', 'Barefoot'), L('상의 벗음', 'Top off'), L('속옷 차림', 'Underwear'), L('수건·이불로 가림', 'Covered')];
const WEARN = { robe: L('호텔 가운', 'Hotel robe'), silk: L('실크 가운', 'Silk robe'), slip: L('새틴 슬립', 'Satin slip'), pajama: L('커플 잠옷', 'Couple pajamas'), towel: L('수건', 'Towel') };
const stateTxt = w => Z.wear[w] && Z.out[w] < 5 ? WEARN[Z.wear[w]] : STAGE[Z.out[w]];

/* ═════════════ 1. 의상 소품 — 뼈(실사 모델 뼈 우선, 없으면 절차적 rig)에 붙는 캐미솔·박서·가운·잠옷·수건 ═════════════ */
const SPEC = {   // top/hip: [시작, 끝] 비율(상체: 척추→목 · 하체: 엉덩이→무릎) · sat 새틴 광택 · flare 아래로 퍼짐 · fluffy 도톰
  under: { f: { col: '#7a1030', top: [.34, .98], hip: [-.2, .3], sat: 1 }, m: { col: '#22262e', top: [.06, .95], hip: [-.2, .38], sat: .4 } },
  underTop: { f: { col: '#7a1030', top: [.34, .98], sat: 1 }, m: { col: '#ecebe6', top: [.06, .95] } },
  slip: { f: { col: '#e8cfa8', top: [.34, .97], hip: [-.2, .62], flare: 1.25, sat: 1 }, m: { col: '#1a2a4a', top: [-.02, 1], hip: [-.2, .95], sat: 1 } },
  silk: { f: { col: '#9a1040', top: [-.04, 1.02], hip: [-.2, .85], flare: 1.15, sat: 1 }, m: { col: '#2a1a3a', top: [-.04, 1.02], hip: [-.2, .85], sat: 1 } },
  robe: { f: { col: '#f4f2ee', top: [-.04, 1.03], hip: [-.2, .9], flare: 1.15, fluffy: 1 }, m: { col: '#f4f2ee', top: [-.04, 1.03], hip: [-.2, .9], flare: 1.1, fluffy: 1 } },
  pajama: { f: { col: '#9ac0e8', top: [-.04, 1], hip: [-.2, 1] }, m: { col: '#9ac0e8', top: [-.04, 1], hip: [-.2, 1] } },
  towel: { f: { col: '#ffffff', top: [-.08, .95], hip: [-.2, .55], fluffy: 1 }, m: { col: '#ffffff', top: [.82, 1.02], hip: [-.2, .6], fluffy: 1 } },
  cover: { f: { col: '#ffffff', top: [-.08, .97], hip: [-.2, .62], fluffy: 1 }, m: { col: '#ffffff', top: [.8, 1.02], hip: [-.2, .62], fluffy: 1 } },
};
const visualOf = w => Z.out[w] >= 5 ? 'cover' : Z.wear[w] ? Z.wear[w] : Z.out[w] === 4 ? 'under' : Z.out[w] === 3 ? 'underTop' : '';
const MATS = {};
function matOf(sp) { const k = sp.col + (sp.sat ? 's' : '') + (sp.fluffy ? 'f' : ''); return MATS[k] || (MATS[k] = new T.MeshStandardMaterial({ color: new T.Color(sp.col), roughness: sp.sat ? .3 : sp.fluffy ? 1 : .85, metalness: sp.sat ? .08 : 0, side: T.DoubleSide })); }
function bonesOf(g) {
  const u = g.userData, r = u.real, Bn = r && !r.pending && r.Bn; if ((r && r.pending) || u.procHidden) return null;   // 실사 모델 로딩 중엔 기다림(허공에 옷만 뜨지 않게)
  if (Bn && Bn.hips && (Bn.spine || Bn.chest) && Bn.neck && Bn.uaL && Bn.uaR && Bn.ulL && Bn.ulR && Bn.llL && Bn.llR) return { real: r, hips: Bn.hips, spine: Bn.spine || Bn.chest, neck: Bn.neck, a: Bn.uaL, b: Bn.uaR, lgA: Bn.ulL, lgB: Bn.ulR, knA: Bn.llL, knB: Bn.llR };
  const R = u.rig; if (!R || !R.torso || !R.neck) return null;
  return { real: null, hips: R.hips, spine: R.torso, neck: R.neck, a: R.shL, b: R.shR, lgA: R.legL, lgB: R.legR, knA: R.knL, knB: R.knR };
}
const wp = o => o.getWorldPosition(V3());
function part(bone, a, b, right, from, to, rf, depth, mat) {   // a→b 축을 따라 회전체(Lathe) — 뼈 공간으로 옮겨 붙임(뼈 스케일 보정)
  const len = a.distanceTo(b); if (len < .05) return null; const pts = [];
  for (let i = 0; i <= 10; i++) { const t = from + (to - from) * i / 10; pts.push(new T.Vector2(rf(t), t * len)); }
  const geo = new T.LatheGeometry(pts, 22); geo.scale(1, 1, depth);
  const m = new T.Mesh(geo, mat); m.castShadow = true; m.userData.m19 = true;
  const Y = b.clone().sub(a).normalize(), Xv = right.clone().addScaledVector(Y, -right.dot(Y)).normalize(), Zv = V3().crossVectors(Xv, Y);
  const qw = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(Xv, Y, Zv)), qb = bone.getWorldQuaternion(new T.Quaternion()), ws = bone.getWorldScale(V3()).x || 1;
  m.quaternion.copy(qb.invert().multiply(qw)); m.position.copy(bone.worldToLocal(a.clone())); m.scale.setScalar(1 / ws); m.userData.s0 = 1 / ws;
  bone.add(m); return m;
}
function clearGarment(g) { const r = g && g.userData.m19; if (!r) return; r.parts.forEach(m => { if (m.parent) m.parent.remove(m); m.geometry.dispose(); }); g.userData.m19 = null; }
function buildGarment(g, kind, gender) {
  clearGarment(g); if (!kind) return; const sp = SPEC[kind] && SPEC[kind][gender]; if (!sp) return;
  const B = bonesOf(g); if (!B) return; g.updateMatrixWorld(true);
  const A = wp(B.spine), N = wp(B.neck), H = wp(B.hips), right = wp(B.a).sub(wp(B.b)), shW = right.length(), hipW = wp(B.lgA).distanceTo(wp(B.lgB)), Kn = wp(B.knA).add(wp(B.knB)).multiplyScalar(.5);
  const inf = 1.2 + (sp.fluffy ? .05 : 0), rT = clamp(shW * .5 * .9, .13, .24) * inf, rH = clamp(Math.max(hipW * .5 * 1.8, rT * .92), .13, .24) * inf, parts = [], mat = matOf(sp);
  if (sp.top) { const m = part(B.spine, A, N, right, sp.top[0], sp.top[1], t => rT * (t < .6 ? .84 + .16 * Math.sin(Math.PI * .5 * Math.max(0, t) / .6) : 1 - .3 * Math.pow((t - .6) / .4, 2)), .8, mat); if (m) parts.push(m); }
  if (sp.hip) { const fl = sp.flare || 1, m = part(B.hips, H, Kn, right, sp.hip[0], sp.hip[1], t => rH * (1 - .18 * Math.max(0, t)) * (1 + (fl - 1) * Math.max(0, t)) * (t < 0 ? 1 + t * .35 : 1), .82, mat); if (m) { m.userData.hip = true; parts.push(m); } }
  g.userData.m19 = { kind, gender, parts, real: B.real };
}
function refresh(w) { if (!S.n && w === 'n') return; const g = G(w), kind = visualOf(w), r = g.userData.m19, B = bonesOf(g);
  if (r && r.kind === kind && r.real === (B && B.real) && r.parts.every(m => isUnder(m, g))) return; if (!kind) return clearGarment(g); buildGarment(g, kind, gOf(w)); }
function isUnder(o, root) { for (let p = o.parent; p; p = p.parent) if (p === root) return true; return false; }
function refreshAll() { refresh('me'); if (S.n) refresh('n'); }
function garmentTick() { for (const g of [P().group, S.n && S.n.g]) { const r = g && g.userData.m19; if (!r) continue; const k = g.userData.seated ? .38 : 1; r.parts.forEach(m => { if (m.userData.hip) m.scale.y = m.userData.s0 * k; }); } }
/* 짧은 암전 — 갈아입는 순간(옷 떠다님·메시 늘어남·순간이동 없이) */
const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .22s;z-index:9989'; document.body.appendChild(ov);
async function blink(fn, txt) { ov.textContent = ''; ov.style.opacity = 1; await wait(240); try { fn && fn(); } catch (e) { console.warn(e); } if (txt) { ov.style.cssText += ';display:flex;align-items:center;justify-content:center;color:#fff;font:700 18px sans-serif'; ov.textContent = txt; await wait(900); } await wait(160); ov.style.opacity = 0; await wait(240); ov.textContent = ''; }
function setOut(w, v, wear) { Z.out[w] = clamp(v, 0, 5); if (wear !== undefined) Z.wear[w] = wear; refresh(w); }

/* ═════════════ 2. 자세 — 눕기 · 고정 · 미끄러지듯 이동 · 손 IK ═════════════ */
const QX = new T.Quaternion().setFromAxisAngle(V3(1, 0, 0), -Math.PI / 2), QZ = new T.Quaternion(), ZA = V3(0, 0, 1);
function bedTop() { return RV.round ? .6 : .62; }
function lie(spec) {   // spec: { me:{x, roll, prone}, n:{...}, sheet:bool } — 머리는 베개(북쪽) 쪽
  const p = P(), n = S.n; endStanding(); stopHand(); if (p.seat) NC.requestStand(); if (n.state === 'seated') NC.unseatAvatar(n.g); try { NC.Couple && (NC.Couple.ST.sofa = null); } catch (e) { }
  n.state = 'lying'; n.g.userData.moving = false; S.follow = false; Z.lie = spec; Z.pin = null; setSheet(!!spec.sheet);
}
function unlie() {
  if (!Z.lie) return false; const sp = Z.lie; Z.lie = null; setSheet(false);
  for (const w of ['me', 'n']) { if (!sp[w] || (w === 'n' && !S.n)) continue; const g = G(w); g.rotation.x = 0; g.rotation.z = 0; g.position.y = 0; }
  const p = P(), b = RV.seats.bed; p.x = BX + b[0].x; p.z = CZ + b[0].z + .5; p.group.position.set(p.x, 0, p.z);
  if (S.n) { placePartner(BX + b[1].x, CZ + b[1].z + .5, Math.PI); S.n.state = 'motel'; } S.follow = true; return true;
}
function lieTick() {
  const sp = Z.lie; if (!sp) return; const y0 = bedTop() + .11, headZ = -RHZ + .32;
  for (const w of ['me', 'n']) { const s = sp[w]; if (!s || (w === 'n' && !S.n)) continue; const g = G(w), h = (g.userData.look && g.userData.look.height) || 1.7, x = BX + s.x, z = CZ + headZ + h * (s.prone ? .98 : 1);
    if (w === 'me') { const p = P(); p.x = x; p.z = z; p.ry = 0; } else { S.n.x = x; S.n.z = z; }
    g.position.set(x, y0 + (s.roll ? .06 : 0), z);
    if (s.prone) g.rotation.set(-Math.PI / 2, Math.PI, 0); else { QZ.setFromAxisAngle(ZA, s.roll || 0); g.quaternion.copy(QZ).multiply(QX); }
    g.userData.moving = false; }
}
let sheetM = null;
function setSheet(on) { if (sheetM) { if (sheetM.parent) sheetM.parent.remove(sheetM); sheetM.geometry.dispose(); sheetM = null; } if (!on || !RV.G) return;
  const len = 1.25, side = Z.lie && ((Z.lie.me && Z.lie.me.roll) || (Z.lie.n && Z.lie.n.roll));
  sheetM = new T.Mesh(new T.BoxGeometry(1.75, .09, len, 6, 1, 6), std('#f4efe6', { roughness: .95 })); const pa = sheetM.geometry.attributes.position;   // 가장자리가 처지는 이불
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), zz = pa.getZ(i); pa.setY(i, pa.getY(i) - Math.pow(Math.abs(x) / .875, 3) * .14 - Math.pow(Math.max(0, zz / (len / 2)), 4) * .05 + Math.sin(x * 9 + zz * 7) * .008); } sheetM.geometry.computeVertexNormals();
  sheetM.position.set(BX, bedTop() + (side ? .33 : .25), CZ - RHZ + .32 + 1.72 - len / 2 + .12); sheetM.castShadow = true; RV.G.add(sheetM); }
function pinTick() { const pn = Z.pin; if (!pn) return; for (const w of ['me', 'n']) { const s = pn[w]; if (!s || (w === 'n' && !S.n)) continue; const g = G(w);
  if (w === 'me') { const p = P(); p.x = s.x; p.z = s.z; p.ry = s.ry; } else { S.n.x = s.x; S.n.z = s.z; S.n.state = s.state || 'motel'; } g.position.x = s.x; g.position.z = s.z; g.rotation.y = s.ry; g.userData.moving = false; } }
function slideTick(dt) { const s = Z.slide; if (!s || !S.n) return; s.t = Math.min(1, s.t + dt / s.dur); const k = s.t * s.t * (3 - 2 * s.t), n = S.n; n.x = s.x0 + (s.x1 - s.x0) * k; n.z = s.z0 + (s.z1 - s.z0) * k; n.g.position.x = n.x; n.g.position.z = n.z; n.g.rotation.y = U.lerpAngle(s.r0, s.r1, k); n.g.userData.moving = s.t < 1; if (s.t >= 1) { Z.slide = null; if (Z.pin && Z.pin.n) Object.assign(Z.pin.n, { x: n.x, z: n.z, ry: s.r1 }); } }
/* 플레이어 앞(face) 또는 앞에서 등지고(back) 서기 — 방 가운데로 걸어간 뒤 상대가 다가옴 */
function standPair(mode = 'face', dist = .46) {
  return new Promise(res => { unlie(); standBoth(); stopHand(); endStanding(); const c = RV.spots.center, p = P(), tx = BX + c.x, tz = CZ + c.z;
    const go = () => { p.ry = 0; p.group.rotation.y = 0; const n = S.n, x1 = p.x + Math.sin(p.ry) * dist, z1 = p.z + Math.cos(p.ry) * dist, r1 = mode === 'face' ? p.ry + Math.PI : p.ry;
      n.state = 'motel'; S.follow = false; Z.slide = { x0: n.x, z0: n.z, x1, z1, r0: n.g.rotation.y, r1, t: 0, dur: .7 };
      Z.pin = { me: { x: p.x, z: p.z, ry: p.ry }, n: { x: x1, z: z1, ry: r1 } }; setTimeout(res, 750); };
    let done = false; const go1 = () => { if (done) return; done = true; go(); };
    if (Math.hypot(p.x - tx, p.z - tz) > .4) { NC.walkPlayer([{ x: tx, z: tz }], go1); setTimeout(() => { if (done) return; P().autoPath = null; p.x = tx; p.z = tz; p.group.position.set(tx, 0, tz); go1(); }, 3500); } else go1(); });   // 길이 막히면 3.5초 뒤 바로 자리 잡기
}
function freePair() { Z.pin = null; Z.slide = null; Z.touch = null; if (S.n && S.n.state === 'lying') S.n.state = 'motel'; S.follow = true; }
/* 손 IK — 상대 몸 표면의 점(어깨·등·허리·입술·볼)으로 */
const PT = {
  shoulder: (B, s) => B.neck.clone().addScaledVector(B.tu, .045 * B.sc).addScaledVector(B.tr, s * B.rx * .8),
  upperArm: (B, s) => B.neck.clone().addScaledVector(B.tu, -.19 * B.sc).addScaledVector(B.tr, s * B.rx * 1.2),
  upperBack: (B, s) => B.chest.clone().addScaledVector(B.tu, .02 * B.sc).addScaledVector(B.tf, -B.rzB * 1.08).addScaledVector(B.tr, s * B.rx * .58),
  lowBack: (B, s) => B.hips.clone().addScaledVector(B.tu, .13 * B.sc).addScaledVector(B.tf, -B.rzB * 1.05).addScaledVector(B.tr, s * B.rx * .62),
  frontWaist: (B, s) => B.hips.clone().addScaledVector(B.tu, .1 * B.sc).addScaledVector(B.tf, B.rzF * 1.14).addScaledVector(B.tr, s * .06 * B.sc),
  frontChest: (B, s) => B.chest.clone().addScaledVector(B.tf, B.rzF * 1.18).addScaledVector(B.tr, s * .07 * B.sc),
  waistSide: (B, s) => B.hips.clone().addScaledVector(B.tu, .11 * B.sc).addScaledVector(B.tr, s * B.rx * 1.08).addScaledVector(B.tf, -.035 * B.sc),
  hipSide: (B, s) => B.hips.clone().addScaledVector(B.tu, -.06 * B.sc).addScaledVector(B.tr, s * B.rx * 1.12),
  lips: B => B.head.clone().addScaledVector(B.hf, B.rh * 1.05).addScaledVector(B.hu, -B.rh * .38),
  cheek: (B, s) => B.head.clone().addScaledVector(B.hr, s * B.rh * .98).addScaledVector(B.hf, B.rh * .3).addScaledVector(B.hu, -B.rh * .3),
  eyes: (B, s) => B.head.clone().addScaledVector(B.hf, B.rh * 1.02).addScaledVector(B.hu, B.rh * .12).addScaledVector(B.hr, s * B.rh * .3),
};
const TOUCH = {   // t: 진행(초) → { 1:+쪽 점, -1:-쪽 점 }
  massage: (B, t) => { const q = Math.sin(t * 5) * .012; return { 1: PT.shoulder(B, 1).addScaledVector(B.tu, q), '-1': PT.shoulder(B, -1).addScaledVector(B.tu, -q) }; },
  scrub: (B, t) => { const k = (Math.sin(t * 2.2) + 1) / 2; return { 1: PT.upperBack(B, 1).lerp(PT.lowBack(B, 1), k), '-1': PT.upperBack(B, -1).lerp(PT.lowBack(B, -1), 1 - k) }; },
  jacket: (B, t, d) => { const k = clamp(t / d, 0, 1); return { 1: PT.shoulder(B, 1).lerp(PT.upperArm(B, 1), k), '-1': PT.shoulder(B, -1).lerp(PT.upperArm(B, -1), k) }; },
  top: (B, t, d) => { const k = clamp(t / d, 0, 1); return { 1: PT.frontWaist(B, 1).lerp(PT.frontChest(B, 1), k), '-1': PT.frontWaist(B, -1).lerp(PT.frontChest(B, -1), k) }; },
  bottom: (B, t, d) => { const k = clamp(t / d, 0, 1); return { 1: PT.waistSide(B, 1).lerp(PT.hipSide(B, 1), k), '-1': PT.waistSide(B, -1).lerp(PT.hipSide(B, -1), k) }; },
  strap: (B, t, d) => { const k = clamp(t / d, 0, 1); return { 1: PT.shoulder(B, 1).lerp(PT.upperArm(B, 1), k * .6), '-1': PT.upperBack(B, -1) }; },
  drape: B => ({ 1: PT.shoulder(B, 1), '-1': PT.shoulder(B, -1) }),
  feed: B => ({ 1: PT.lips(B) }),
  face: B => ({ 1: PT.cheek(B, 1), '-1': PT.cheek(B, -1) }),
  eyes: B => ({ 1: PT.eyes(B, 1), '-1': PT.eyes(B, -1) }),
  ice: B => ({ 1: PT.shoulder(B, 1).addScaledVector(B.tu, .03) }),
};
function touch(kind, dur, actor = 'me', tgt = 'n') { Z.touch = { kind, t: 0, dur, actor, tgt }; }
function touchTick(dt) {
  const tc = Z.touch, C = NC.Couple; if (!tc || !C || !S.n) return; if (!Z.paused) tc.t += dt; if (tc.t > tc.dur) { Z.touch = null; const u = G(tc.actor).userData; u.handPose = null; return; }
  const ga = G(tc.actor), gb = G(tc.tgt); ga.updateMatrixWorld(true); gb.updateMatrixWorld(true); const A = C.bodyX(ga), B = C.bodyX(gb); if (!A || !B || !A.R) return;
  const tg = TOUCH[tc.kind](B, tc.t, tc.dur), w = Math.min(1, tc.t / .45, (tc.dur - tc.t) / .4), used = new Set();
  for (const s of Object.keys(tg)) { const p = tg[s]; if (!p) continue; let sd = A.R.shL.getWorldPosition(V3()).distanceTo(p) < A.R.shR.getWorldPosition(V3()).distanceTo(p) ? 'L' : 'R'; if (used.has(sd)) sd = sd === 'L' ? 'R' : 'L'; used.add(sd);
    const pl = A.R['sh' + sd].getWorldPosition(V3()).sub(A.chest); pl.y = 0; pl.normalize().add(V3(0, -1, 0)); if (A.fwd) pl.addScaledVector(A.fwd, -.35);
    try { C.ikArm(A.R, sd, p, w, pl, B); } catch (e) { } }
  ga.userData.handPose = { L: 'touch', R: 'touch' };
}

/* ═════════════ 3. 욕실 — 샤워부스 물줄기 · 김 · 서리 유리 · 젖은 바닥 · 물소리 ═════════════ */
const BATH = { x: -3.0, z: RHZ - 1.0, head: { x: -RHX + .12, y: 2.15, z: RHZ - 1.0 } };
let W19 = null;
function onBuild(Gr, cat) {
  RV.round = cat === 'rom'; RV.candles = null; const ad = (m, x, y, z) => { m.position.set(BX + x, y, CZ + z); Gr.add(m); return m; };
  const chrome = std('#d8dce4', { metalness: 1, roughness: .15 });
  ad(new T.Mesh(box(2.7, .05, 1.95), std('#f4f4f6', { roughness: .2 })), -3.0, .025, RHZ - 1.0);                           // 샤워 트레이
  ad(new T.Mesh(cyl(.02, .02, .3, 8), chrome), -RHX + .06, 2.2, RHZ - 1.0).rotation.z = Math.PI / 2;
  const hd = ad(new T.Mesh(cyl(.11, .07, .05, 18), chrome), -RHX + .2, 2.17, RHZ - 1.0); hd.rotation.z = -Math.PI / 2 + .5;
  ad(new T.Mesh(box(.03, .12, .3), chrome), -RHX + .03, 1.1, RHZ - .5);                                                    // 수전
  [['#ff7aa8', -.35], ['#7ad8ff', -.2], ['#ffe07a', -.05]].forEach(([c, dz]) => ad(new T.Mesh(cyl(.03, .03, .16, 10), std(c, { roughness: .3 })), -RHX + .08, 1.38, RHZ - .5 + dz));   // 샴푸 3종
  const fm = () => new T.MeshStandardMaterial({ color: 0xe6eef2, transparent: true, opacity: 0, roughness: 1, depthWrite: false, side: T.DoubleSide });
  const fA = ad(new T.Mesh(new T.PlaneGeometry(2.0, 2.4), fm()), -1.575, 1.2, RHZ - 1.0); fA.rotation.y = Math.PI / 2; const fB = ad(new T.Mesh(new T.PlaneGeometry(2.8, 2.4), fm()), -3.0, 1.2, RHZ - 2.03);
  const wet = ad(new T.Mesh(new T.PlaneGeometry(2.6, 1.9), new T.MeshStandardMaterial({ color: 0x8aa0b0, metalness: .7, roughness: .06, transparent: true, opacity: 0, depthWrite: false })), -3.0, .052, RHZ - 1.0); wet.rotation.x = -Math.PI / 2;
  const NW = 260, wg = new T.BufferGeometry(), wa = new Float32Array(NW * 3); for (let i = 0; i < NW; i++) { wa[i * 3] = Math.random() * 1.1; wa[i * 3 + 1] = Math.random() * 2.1; wa[i * 3 + 2] = (Math.random() - .5) * .5; } wg.setAttribute('position', new T.BufferAttribute(wa, 3));
  const water = new T.Points(wg, new T.PointsMaterial({ color: 0xcfeaff, size: .03, transparent: true, opacity: .75, depthWrite: false })); water.position.set(BX - RHX + .2, 0, CZ + RHZ - 1.0); water.visible = false; water.frustumCulled = false; Gr.add(water);
  const NS = 90, sg = new T.BufferGeometry(), sa = new Float32Array(NS * 3); for (let i = 0; i < NS; i++) { sa[i * 3] = (Math.random() - .5) * 2.6; sa[i * 3 + 1] = Math.random() * 2.4; sa[i * 3 + 2] = (Math.random() - .5) * 1.8; } sg.setAttribute('position', new T.BufferAttribute(sa, 3));
  const steamTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g2 = c.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); return t; })();
  const steam = new T.Points(sg, new T.PointsMaterial({ map: steamTex, size: .9, transparent: true, opacity: 0, depthWrite: false })); steam.position.set(BX - 3.0, 0, CZ + RHZ - 1.0); steam.frustumCulled = false; Gr.add(steam);
  /* 자쿠지 거품·꽃잎 */
  let foam = null, petals = null; if (RV.water) { foam = ad(new T.Mesh(new T.CircleGeometry(.86, 36), new T.MeshStandardMaterial({ color: 0xfff6fa, roughness: 1, transparent: true, opacity: 0, depthWrite: false })), 2.6, .53, 2.3); foam.rotation.x = -Math.PI / 2;
    petals = new T.Group(); const pm = std('#c0102a', { roughness: .5 }); for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * .75, pt = new T.Mesh(new T.CircleGeometry(.035, 6), pm); pt.rotation.x = -Math.PI / 2; pt.position.set(Math.cos(a) * r, .012, Math.sin(a) * r); petals.add(pt); } petals.position.set(BX + 2.6, .52, CZ + 2.3); petals.visible = false; Gr.add(petals); }
  W19 = { fA, fB, wet, water, steam, foam, petals, st: 0, fog: 0 };
  if (Z.jac.fill && RV.water) RV.water.position.y = .1 + .4 * Z.jac.fill;
}
let AC = null, wn = null;
function waterSound(on) { try { const C = (NC.Audio && NC.Audio.ctx) || AC || (AC = new (window.AudioContext || window.webkitAudioContext)()); if (on && !wn) { const len = C.sampleRate * 2, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (.6 + .4 * Math.sin(i / 900)); const s = C.createBufferSource(); s.buffer = buf; s.loop = true; const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600; const g = C.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(C.destination); s.start(); g.gain.linearRampToValueAtTime(.05, C.currentTime + .6); wn = { s, g }; }
  if (!on && wn) { const w = wn; wn = null; w.g.gain.linearRampToValueAtTime(0, C.currentTime + .5); setTimeout(() => { try { w.s.stop(); } catch (e) { } }, 700); } } catch (e) { } }
function bathTick(dt) {
  if (!W19) return; const on = !!Z.shower; W19.fog = clamp(W19.fog + dt * (on ? .35 : -.3), 0, 1); const f = W19.fog * (Z.shower && Z.shower.temp === 'cool' ? .45 : Z.shower && Z.shower.temp === 'hot' ? 1 : .8);
  W19.fA.material.opacity = W19.fB.material.opacity = .82 * Math.min(1, W19.fog * 1.4); W19.wet.material.opacity = Math.max(W19.wet.material.opacity - dt * .01, on ? .55 : 0); W19.steam.material.opacity = .5 * f; W19.water.visible = on;
  if (on) { const a = W19.water.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 5.5, x = a.getX(i) + dt * .5; if (y < 0) { y = 2.1; x = Math.random() * .5; } a.setY(i, y); a.setX(i, x); } a.needsUpdate = true; }
  if (f > .01) { const a = W19.steam.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * .25; if (y > 2.4) y = .2; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(performance.now() / 900 + i) * dt * .05); } a.needsUpdate = true; }
  if (RV.water && W19.foam) { W19.foam.material.opacity += ((Z.jac.foam ? .95 : 0) - W19.foam.material.opacity) * Math.min(1, dt * 1.5); W19.foam.position.y = RV.water.position.y + .025; if (W19.petals) W19.petals.position.y = RV.water.position.y + .03; }
}
const inBooth = (w, x, ry) => ({ x: BX + x, z: CZ + BATH.z + (w === 'n' ? .1 : -.1), ry });
async function enterBooth(who) {   // who: 'me' | 'n' | 'both'
  await blink(() => { unlie(); standBoth(); stopHand(); endStanding(); Z.pin = {};
    if (who !== 'n') { const s = who === 'both' ? inBooth('me', -3.35, Math.PI / 2) : inBooth('me', -3.1, Math.PI / 2); Z.pin.me = s; }
    if (who !== 'me') { const s = who === 'both' ? inBooth('n', -2.75, -Math.PI / 2) : inBooth('n', -3.1, Math.PI / 2); Z.pin.n = s; S.n.state = 'motel'; S.follow = false; }
    pinTick(); });
}
async function leaveBooth(wear) {
  await blink(() => { const c = RV.seats.bed, p = P(); const me = Z.pin && Z.pin.me, nn = Z.pin && Z.pin.n; Z.pin = null; Z.shower = null; waterSound(false);
    if (me) { p.x = BX + c[0].x; p.z = CZ + c[0].z + .6; p.group.position.set(p.x, 0, p.z); Z.wet.me = 1; if (wear.me !== undefined) Z.wear.me = wear.me; refresh('me'); }
    if (nn) { placePartner(BX + c[1].x, CZ + c[1].z + .6, Math.PI); Z.wet.n = 1; if (wear.n !== undefined) Z.wear.n = wear.n; refresh('n'); }
    S.follow = true; });
}

/* ═════════════ 4. 동의 — 행위·단계별 · 취기 잠금 · 신뢰/분위기 조건 · 압박 감지 ═════════════ */
Object.assign(NEED, { showerTogether: 72, underwear: 66, underDrink: 64, slip: 52, robe: 30, pajama: 36, rps: 50, rpsUnder: 72, rpsCover: 86, massage: 50, oil: 68, feed: 46, ice: 50, slowdance: 54, lieTogether: 62, lieKiss: 74, armpillow: 60, eyes: 44, undress1: 52, undress2: 48, undress3: 68, undress4: 76, undress5: 90, privateMoment: 88, jacTogether: 70, morningKiss: 56, dressYou: 30 });
const NOLINE = { shy: ['…미안해요, 그건 아직 싫어요.', '(고개를 저으며) 오늘은 거기까진 아니에요.'], cool: ['그건 패스할게요. 다른 거 해요.', '아니요. 그건 제 선 밖이에요.'], playful: ['에이~ 그건 안 되지 ㅋㅋ 다른 거!', '노노~ 그건 다음 생에 ㅋㅋ'], outgoing: ['음… 그건 싫어요! 대신 다른 거 해요.', '그건 안 할래요. 미안~'] };
const NOTYET = { shy: ['…조금만 더 천천히요. 아직 떨려요.', '음… 아직은 좀 이른 것 같아요.'], cool: ['조금 더 분위기 보고요.', '아직이요. 서두르지 말아요.'], playful: ['아직 레벨이 부족해요~ ㅋㅋ 조금 더!', '음~ 좀 더 꼬셔 봐요 ㅎㅎ'], outgoing: ['잠깐만요, 얘기 좀 더 하고요!', '아직은 아니에요~ 조금만 더요.'] };
async function ask(kind, o = {}) {
  const n = S.n, t = tr(n);
  if (drunkN() || n.drunk) { nSay(pick(['오늘은 많이 마셨어요… 이런 건 맨정신일 때 해요. 물 좀 마실래요 💧', '(볼이 빨개진 채) 지금은 판단이 잘 안 돼요. 그냥 쉬어요, 네?']), 'sad'); return 'no'; }
  if (meDrunk()) { nSay(pick(['많이 취했잖아요 ㅎㅎ 오늘은 물 마시고 쉬어요. 이런 건 맨정신일 때요.', '취한 상태로는 안 돼요. 정신 차리면 다시 물어봐 줘요 💧']), 'smile'); return 'no'; }
  if (!adminMax()) {
    if ((Z.lim[kind] || 0) >= 2) { nSay(pick(['…아까 싫다고 두 번이나 말했잖아요. 계속 물어보니까 불편해요.', '그만 물어봐 줄래요? 제 대답은 그대로예요.']), 'annoyed'); bump(-8, -10); memOf(n).trust = Math.max(0, memOf(n).trust - 3); save(); return 'no'; }
    if (o.trust && trustNow() < o.trust) { nSay(byT(NOTYET), 'shy'); Z.lim[kind] = (Z.lim[kind] || 0) + 1; return 'no'; }
    if (o.mood && moodNow() < o.mood) { nSay(o.moodLine || pick(['불 좀 줄이면… 조금 덜 부끄러울 것 같아요.', '분위기가 조금만 더 있으면 좋겠어요 ㅎㅎ']), 'shy'); return 'cond'; }
  }
  const r = consent(kind);
  if (r === 'pressure') { nSay(L('방금 아직이라고 했잖아요… 저 조금 불편해요.', 'I just said not yet… I’m uncomfortable.'), 'annoyed'); bump(-6, -8); Z.lim[kind] = (Z.lim[kind] || 0) + 1; return 'no'; }
  if (r === 'no') { nSay(byT(NOLINE), 'annoyed'); bump(-3, -4); Z.lim[kind] = (Z.lim[kind] || 0) + 1; S.lastNo = { k: kind, t: performance.now() }; return 'no'; }
  if (r === 'notyet') { nSay(byT(NOTYET), 'shy'); Z.lim[kind] = (Z.lim[kind] || 0) + 1; S.lastNo = { k: kind, t: performance.now() }; return 'no'; }
  if (o.yes !== false) nSay(r === 'soft' ? (o.soft || pick(['…천천히요 💗', '음… 좋아요. 대신 부드럽게요.'])) : (o.ok || byT({ shy: '…네 💗', cool: '좋아요.', playful: '콜! ㅎㅎ', outgoing: '좋아요~! 💗' })), r === 'soft' ? 'shy' : 'smile');
  bump(r === 'yes' ? 3 : 1, r === 'yes' ? 3 : 1); n.aff = Math.min(100, n.aff + 1); return r;
}
/* 마음이 바뀜 — 언제든 그만할 수 있음(존중하면 신뢰↑, 조르면 신뢰↓) */
async function secondThought(kind) {
  if (adminMax()) return false; const t = tr(S.n), p = t.bd * .12 + (moodNow() < 50 ? .08 : 0) - Math.min(.1, trustNow() / 1000); if (Math.random() > p) return false;
  nSay(pick(['…잠깐만요. 오늘은 여기까지만 할래요.', '(손을 살며시 잡으며) 미안해요, 마음이 좀 바뀌었어요. 잠깐 쉬어요.']), 'shy'); stopAll(true); Z.lim[kind] = (Z.lim[kind] || 0) + 1;
  const { val } = await modal(`<h3>✋ ${L('상대가 멈추고 싶어 해요', 'Your partner wants to stop')}</h3>`, [[L('응, 알겠어요. 고마워요 말해 줘서 (존중)', 'Of course — thanks for telling me'), 'ok', true], [L('…조금만 더? (조르기)', '…just a bit more? (push)'), 'push']]);
  if (val === 'push') { nSay('…지금 그 말 좀 실망이에요. 싫다고 했잖아요.', 'annoyed'); bump(-12, -12); memOf(S.n).trust = Math.max(0, memOf(S.n).trust - 4); }
  else { meSay('응, 알겠어요. 말해 줘서 고마워요.'); nSay('…고마워요. 그래서 더 편해요 💗', 'smile'); memOf(S.n).trust = Math.min(100, memOf(S.n).trust + 2); bump(2, 6); }
  save(); return true;
}
function exitBoothNow() { const pn = Z.pin; if (!pn) return; const inB = s => s && s.x < BX - 1.5 && s.z > CZ + RHZ - 2.1; if (!inB(pn.me) && !inB(pn.n)) return; const c = RV.seats.bed, p = P();
  if (inB(pn.me)) { p.x = BX + c[0].x; p.z = CZ + c[0].z + .6; p.group.position.set(p.x, 0, p.z); } if (inB(pn.n) && S.n) placePartner(BX + c[1].x, CZ + c[1].z + .6, Math.PI); }
function stopAll(silent) { let had = !!(Z.touch || Z.lie || Z.pin || Z.shower || Z.slide); exitBoothNow(); if (Z.jac.in) { Z.jac.in = false; if (P().seat) NC.requestStand(); if (S.n) { NC.unseatAvatar(S.n.g); placePartner(BX + RV.seats.bed[1].x, CZ + RV.seats.bed[1].z + .6, Math.PI); } had = true; } Z.touch = null; Z.slide = null; if (Z.shower) { Z.shower = null; waterSound(false); } const wasLie = unlie(); Z.pin = null; if (S.n && S.n.state === 'lying') S.n.state = 'motel'; S.follow = true; Z.paused = false; Z.running = false; return had || wasLie; }

/* ═════════════ 5. 활동 ═════════════ */
const sitBed = () => sitBoth('bed'), sitSofa = () => sitBoth('sofa');
const tryG = (g, name) => { try { NC.Motion.play(g, name); } catch (e) { } };
const expr = (g, e, d = 2.5) => { try { g.userData.setExpr && g.userData.setExpr(e, d); } catch (e2) { } };
/* 5-1 🚿 샤워 */
async function showerMe() {
  const { val, root } = await modal(`<h3>🚿 ${L('혼자 샤워', 'Private shower')}</h3>
    <div class="m19f"><b>${L('물 온도', 'Water')}</b><label><input type="radio" name="tp" value="cool">${L('미지근', 'Lukewarm')}</label><label><input type="radio" name="tp" value="warm" checked>${L('따뜻하게', 'Warm')}</label><label><input type="radio" name="tp" value="hot">${L('뜨겁게', 'Hot')}</label></div>
    <div class="m19f"><b>${L('샴푸', 'Shampoo')}</b><label><input type="radio" name="sh" value="rose" checked>🌹 ${L('로즈 시크릿', 'Rose Secret')}</label><label><input type="radio" name="sh" value="ocean">🌊 ${L('오션 쿨', 'Ocean Cool')}</label><label><input type="radio" name="sh" value="citrus">🍋 ${L('시트러스 90', 'Citrus 90')}</label></div>
    <div class="m19f"><b>${L('나와서 입을 것', 'Afterwards')}</b><label><input type="radio" name="wr" value="towel" checked>🧖 ${L('수건', 'Towel')}</label><label><input type="radio" name="wr" value="robe">👘 ${L('호텔 가운', 'Hotel robe')}</label><label><input type="radio" name="wr" value="silk">🧥 ${L('실크 가운', 'Silk robe')}</label></div>
    <div class="m19f"><label><input type="checkbox" name="mu" checked>🎵 ${L('욕실 라디오 틀기', 'Bathroom radio')}</label><label><input type="checkbox" name="ft">🫧 ${L('샤워 폼 듬뿍', 'Extra foam')}</label></div>`, [[L('🚿 씻으러 가기', '🚿 Go'), 1, true], [L('취소', 'Cancel'), 0]]);
  if (!val) return; const q = s => root.querySelector(s), temp = q('input[name=tp]:checked').value, sh = q('input[name=sh]:checked').value, wr = q('input[name=wr]:checked').value, mu = q('input[name=mu]').checked;
  nSay(byT({ shy: '천천히 씻고 와요 ㅎㅎ 저는 TV 보고 있을게요.', cool: '다녀와요. 수건은 선반에 있어요.', playful: '오래 걸리면 문 두드린다? ㅋㅋ', outgoing: '다녀와요~ 노래 크게 부르면 다 들려요 ㅋㅋ' }), 'smile');
  await enterBooth('me'); Z.shower = { who: 'me', temp }; waterSound(true); if (mu) try { NC.Audio.playPlaylist('blues'); S.music = 'blues'; } catch (e) { }
  sys(L(`🚿 샤워 중… (${{ cool: '미지근한 물', warm: '따뜻한 물', hot: '뜨거운 물' }[temp]} · ${{ rose: '로즈 향', ocean: '바다 향', citrus: '상큼한 시트러스 향' }[sh]})`, '🚿 Showering…'));
  if (q('input[name=ft]').checked) setTimeout(() => sys('🫧 거품이 몽글몽글…'), 2500);
  await wait(7500); if (!Z.shower) return; await leaveBooth({ me: wr }); tryG(P().group, 'towelDry');
  setTimeout(() => nSay(byT({ shy: { towel: '어… 수, 수건만…? (눈을 피하며) 빨리 옷 입어요 ㅎㅎ', robe: '가운 잘 어울려요 ㅎㅎ 향 좋다…', silk: '실크 가운…? 오늘 작정했네요 ㅎㅎ' }[wr], cool: { towel: '감기 걸려요. 머리부터 말려요.', robe: '개운해 보이네요.', silk: '…그 가운, 꽤 괜찮은데요.' }[wr], playful: { towel: '오~ 몸 좋은데? ㅋㅋㅋ 농담이에요!', robe: '목욕탕 아저씨 느낌 ㅋㅋㅋ 귀엽다', silk: '와 실크! 영화 주인공이야? ㅋㅋ' }[wr], outgoing: { towel: '헐 ㅋㅋ 수건 패션 대박!', robe: '가운 입으니까 호텔 온 것 같다~', silk: '와, 분위기 확 바뀌었다!' }[wr] }), wr === 'towel' ? 'shy' : 'laugh'), 900);
  bump(wr === 'silk' ? 8 : 4, 2); sh === 'rose' && setTimeout(() => nSay('근데… 장미 향 나요. 좋다 💗', 'shy'), 4500);
}
async function showerN() {
  const n = S.n; if (S.comfort < 40 && !adminMax()) { nSay('저는… 그냥 이따 집에 가서 씻을게요 ㅎㅎ', 'shy'); return; }
  nSay(byT({ shy: '그럼… 먼저 씻고 올게요. 엿보면 안 돼요! ㅎㅎ', cool: '그럼 먼저 씻을게요.', playful: '먼저 씻는다~ 엿보면 벌금! ㅋㅋ', outgoing: '고마워요! 금방 나올게요~' }), 'smile');
  await enterBooth('n'); Z.shower = { who: 'n', temp: 'warm' }; waterSound(true); sys(L(`🚿 ${n.name}님이 샤워 중… (서리 낀 유리 너머 실루엣만 보여요) — 그동안 조명·음악으로 분위기를 바꿀 수 있어요`, '🚿 Your partner is showering…'));
  const mood0 = S.mood, mus0 = S.music; await wait(9000); if (!Z.shower) return;
  const wr = byT({ shy: 'robe', cool: 'robe', playful: 'towel', outgoing: 'silk' }); await leaveBooth({ n: wr }); tryG(n.g, 'towelDry');
  const changed = S.mood !== mood0 || S.music !== mus0; setTimeout(() => nSay(changed ? pick(['…어? 조명 바꿨어요? 분위기 뭐야 ㅎㅎ 💗', '나왔더니 음악까지… 준비성 좋네요 💗']) : byT({ shy: '…가운이 좀 크네요 ㅎㅎ 쳐다보지 마요.', cool: '개운하다. 당신도 씻을래요?', playful: '짜잔~ 수건 패션! ㅋㅋ 놀랐죠?', outgoing: '아 개운해~ 이제 좀 살 것 같다!' }), changed ? 'shy' : 'laugh'), 900); bump(changed ? 12 : 4, changed ? 4 : 1);
}
async function showerTogether(npcAsk) {
  if (!npcAsk) { meSay(pick(['…같이 씻을래요?', '샤워… 같이 할래요? 싫으면 싫다고 해도 돼요.'])); await wait(900); const r = await ask('showerTogether', { trust: 60, mood: 55, moodLine: '…수건 두르고, 불 좀 줄이면요. ㅎㅎ', soft: '…수건은 두르고요. 그리고 김 많이 서리게요 ㅎㅎ' }); if (r === 'no' || r === 'cond') return; }
  await enterBooth('both'); Z.shower = { who: 'both', temp: 'warm' }; waterSound(true); if (!Z.wear.n && Z.out.n < 4) Z.wear.n = 'towel'; if (!Z.wear.me && Z.out.me < 4) Z.wear.me = 'towel'; refreshAll(); bump(10, 4);
  sys(L('🚿 함께 샤워 중 — 김 서린 유리 너머로 두 실루엣만 보여요', '🚿 Showering together — only silhouettes through the fogged glass'));
  for (let i = 0; i < 12 && Z.shower; i++) {
    const { val } = await modal(`<h3>🚿 ${L('함께 샤워', 'Shower together')}</h3><p style="opacity:.8">${L('물소리와 김… 무엇을 할까요?', 'Steam and running water… what next?')}</p>`, [[L('🫧 거품 장난', '🫧 Foam play'), 'foam', true], [L('🧽 등 밀어 주기', '🧽 Scrub back'), 'scrub'], [L('💋 샤워기 아래 키스', '💋 Kiss under the water'), 'kiss'], [L('💬 이야기', '💬 Talk'), 'talk'], [L('🌡 물 온도', '🌡 Temperature'), 'temp'], [L('🧖 수건 둘러 주고 나가기', '🧖 Wrap a towel & finish'), 'end']]);
    if (!Z.shower) break; if (!val || val === 'end') break;
    if (val === 'foam') { tryG(P().group, 'laugh'); tryG(S.n.g, 'laugh'); touch('drape', 2.2); nSay(byT({ shy: '꺅, 차가워! …아 거품이구나 ㅎㅎ', cool: '…진짜 유치하다. (거품을 되돌려 묻힌다) ㅎ', playful: '받아랏! 거품 폭탄!! ㅋㅋㅋ', outgoing: '아하하 코에 묻었어요 ㅋㅋㅋ' }), 'laugh'); bump(4, 3); await wait(2400); }
    else if (val === 'scrub') { if ((await ask('massage', { yes: false })) === 'no') continue; Z.pin.n.ry = Z.pin.me.ry; nSay('…살살요. 거기, 거기 좋다 ㅎㅎ', 'shy'); touch('scrub', 4.2); bump(5, 3); await wait(4300); if (await secondThought('scrub')) break; Z.pin.n.ry = Z.pin.me.ry + Math.PI; }
    else if (val === 'kiss') { if ((await ask('kiss', { yes: false })) === 'no') continue; const pn = Z.pin.n; Z.pin.n = null; await standAct('kiss'); await wait(3200); endStanding(); Z.pin.n = pn; expr(S.n.g, 'shy'); nSay(pick(['……물소리밖에 안 들려요 💗', '(이마를 맞대고 웃는다) 숨 막혀 ㅎㅎ']), 'shy'); bump(8, 3); }
    else if (val === 'talk') { nSay(pick(['이렇게 같이 있으니까… 이상하게 편하다.', '나중에 오늘 생각나면 웃을 것 같아요 ㅎㅎ', '김 때문에 얼굴이 잘 안 보여서 다행이다… 빨개졌거든요.']), 'smile'); bump(3, 3); await wait(1500); }
    else if (val === 'temp') { Z.shower.temp = Z.shower.temp === 'hot' ? 'cool' : Z.shower.temp === 'cool' ? 'warm' : 'hot'; nSay({ hot: '앗 뜨거! ㅋㅋ 김 엄청 난다', cool: '어우 시원해! 정신 번쩍 ㅋㅋ', warm: '딱 좋다~' }[Z.shower.temp], 'laugh'); await wait(1000); }
  }
  if (Z.pin) { touch('drape', 2, 'me', 'n'); await wait(1600); await leaveBooth({ me: 'robe', n: 'robe' }); nSay(byT({ shy: '…오늘 일은 둘만 아는 거예요 ㅎㅎ', cool: '…개운하다. 좋았어요.', playful: '다음엔 거품 목욕이다? ㅋㅋ', outgoing: '아 너무 좋았다~ 💗' }), 'shy'); bump(4, 4); }
}
async function lotion() { tryG(P().group, 'lotion'); meSay('(침대 끝에 앉아 로션을 바른다)'); setTimeout(() => nSay(byT({ shy: '향 좋다… 저도 조금만 써도 돼요?', cool: '그 로션 향 괜찮네요.', playful: '등은 내가 발라 줄까? ㅋㅋ 농담~', outgoing: '저도 발라 줘요! 손등만요 ㅎㅎ' }), 'smile'), 1500); bump(2, 1); }
/* 5-2 👙 속옷 · 나이트웨어 */
async function wearMenu() {
  const { val, root } = await modal(`<h3>👗 ${L('갈아입기', 'Change clothes')}</h3>
    <div class="m19f"><b>${L('누가', 'Who')}</b><label><input type="radio" name="w" value="me" checked>${L('나', 'Me')}</label><label><input type="radio" name="w" value="n">${nm()}</label><label><input type="radio" name="w" value="both">${L('둘 다', 'Both')}</label></div>
    <div class="m19f"><b>${L('무엇을', 'What')}</b><label><input type="radio" name="k" value="robe" checked>👘 ${WEARN.robe}</label><label><input type="radio" name="k" value="silk">🧥 ${WEARN.silk}</label><label><input type="radio" name="k" value="slip">🩱 ${L('새틴 슬립 / 실크 파자마', 'Satin slip / silk PJs')}</label><label><input type="radio" name="k" value="pajama">💑 ${WEARN.pajama}</label><label><input type="radio" name="k" value="under">👙 ${L('속옷만', 'Underwear only')}</label><label><input type="radio" name="k" value="normal">👔 ${L('원래 옷', 'Regular clothes')}</label></div>`, [[L('갈아입기', 'Change'), 1, true], [L('취소', 'Cancel'), 0]]);
  if (!val) return; const w = root.querySelector('input[name=w]:checked').value, k = root.querySelector('input[name=k]:checked').value; await changeTo(w, k);
}
async function changeTo(w, k) {
  const ws = w === 'both' ? ['me', 'n'] : [w];
  if (ws.includes('n')) { const need = k === 'under' ? 'underwear' : k === 'slip' ? 'slip' : k === 'pajama' ? 'pajama' : k === 'normal' ? null : 'robe';
    if (need) { meSay(k === 'under' ? '…편하게 속옷만 입고 있을래요?' : `${WEARN[k] || ''} 입어 볼래요?`); await wait(800); const r = await ask(need, { mood: k === 'under' ? 50 : 0, moodLine: '…불 좀 줄여 주면요 ㅎㅎ', ok: byT({ shy: '…네, 잠깐만요. 뒤돌아 있어요!', cool: '그래요, 갈아입고 올게요.', playful: '오케이~ 기대해도 좋아 ㅋㅋ', outgoing: '좋아요! 금방 와요~' }) });
      if (r === 'no' || r === 'cond') { if (k === 'under') { nSay('대신… 가운은 입을게요. 그건 편해요 ㅎㅎ', 'smile'); await blink(() => setOut('n', Z.out.n, 'robe'), '…'); } if (w === 'n') return; ws.splice(ws.indexOf('n'), 1); } } }
  if (!ws.length) return;
  await blink(() => { for (const x of ws) { if (k === 'normal') setOut(x, 0, ''); else if (k === 'under') setOut(x, Math.max(4, Math.min(4, Z.out[x])) , ''); else setOut(x, Math.min(Z.out[x], 4), k === 'slip' ? 'slip' : k); } }, L('…욕실에서 갈아입는 중', '…changing in the bathroom'));
  if (ws.includes('me') && !ws.includes('n')) setTimeout(() => nSay(k === 'under' ? byT({ shy: '……! (눈을 가리며) 미, 미리 말이라도 하지 ㅎㅎ', cool: '…대담하네요.', playful: '오~ 오늘 작정했구나? ㅋㅋ', outgoing: '헐 ㅋㅋㅋ 자신감 최고!' }) : k === 'normal' ? '다시 원래대로네요 ㅎㅎ' : byT({ shy: '잘 어울려요 ㅎㅎ', cool: '괜찮네요.', playful: '오 패션 피플~ ㅋㅋ', outgoing: '완전 잘 어울려요!' }), k === 'under' ? 'shy' : 'smile'), 600);
  if (ws.includes('n')) setTimeout(() => nSay(k === 'under' ? byT({ shy: '…너무 쳐다보지 마요. 부끄러워요.', cool: '…어때요. 솔직하게 말해도 돼요.', playful: '짜잔~ 심장 괜찮아요? ㅋㅋ', outgoing: '어때요? 이거 제일 아끼는 거예요 ㅎㅎ' }) : byT({ shy: '…어울려요?', cool: '편하네요, 이거.', playful: '어때 어때? 한 바퀴 돌까? ㅋㅋ', outgoing: '완전 편하다~ 고마워요!' }), 'shy'), 900);
  bump(k === 'under' ? 10 : k === 'silk' || k === 'slip' ? 7 : 3, 2);
}
async function surpriseNight() { meSay('(잠깐만요… 욕실 좀 다녀올게요)'); await blink(() => setOut('me', Math.min(Z.out.me, 4), 'silk'), L('…두근두근', '…'));
  nSay(byT({ shy: '……어? 그, 그거 언제 챙겨 왔어요? (얼굴이 빨개진다)', cool: '…서프라이즈네요. 나쁘지 않아요.', playful: '오~~ 이벤트야? ㅋㅋㅋ 박수!', outgoing: '와!! 완전 반칙이다 ㅋㅋ 멋있어요!' }), 'surprised'); tryG(S.n.g, S.n.trait === 'playful' ? 'clap' : 'shy'); bump(9, 3); }
function askOutfit() { meSay('뭐 입고 있으면 좋겠어요? 솔직하게요.'); setTimeout(() => nSay(byT({ shy: '음… 커플 잠옷이요. 귀엽잖아요 ㅎㅎ', cool: '실크 가운. 깔끔하고 분위기 있잖아요.', playful: '음~ 수건 한 장? ㅋㅋㅋ 농담! 가운이요!', outgoing: '새틴 슬립! 아니 파자마! 아 다 좋아요 ㅋㅋ' }), 'laugh'), 1100); bump(2, 2); }
function couplePhoto() { if (Z.out.me >= 4 || Z.out.n >= 4) { nSay('지금 차림으로는 사진은 안 돼요 ㅎㅎ 가운 입고 찍어요!', 'shy'); return; } photo(); bump(2); }
async function redressAll() { await blink(() => { setOut('me', 0, ''); setOut('n', 0, ''); Z.wet.me = Z.wet.n = 0; }, L('…옷을 다시 입는 중', '…getting dressed')); nSay('다시 원래대로 ㅎㅎ', 'smile'); }
/* 5-3 🥂 술자리 */
const DRINKS = { beer: [L('🍺 맥주', '🍺 Beer'), 4, .4], soju: [L('🍶 소주', '🍶 Soju'), 5, .6], wine: [L('🍷 와인', '🍷 Wine'), 9, .5], whisky: [L('🥃 양주', '🥃 Whisky'), 14, .75], soda: [L('🥤 무알콜 칵테일', '🥤 Mocktail'), 2, 0] };
async function drinkSession(underMode) {
  if (underMode && (Z.out.me < 4 || Z.out.n < 4)) {
    meSay('…우리 편하게 속옷만 입고 한잔할래요?'); await wait(900); const r = await ask('underDrink', { trust: 50, mood: 45, ok: byT({ shy: '…불 조금만 줄이고요. 그럼 좋아요.', cool: '…재밌겠네요. 좋아요.', playful: '오 그거 완전 90년대 영화 ㅋㅋ 콜!', outgoing: '좋아요! 대신 맛있는 거 꺼내요 ㅎㅎ' }) });
    if (r === 'no' || r === 'cond') { nSay('그냥 이대로 마셔요. 가운 정도는 괜찮아요 ㅎㅎ', 'smile'); if (Z.out.n < 4 && !Z.wear.n) await blink(() => setOut('n', Z.out.n, 'robe'), '…'); }
    else { if (!/dim|neon/.test(S.mood)) { S.mood = 'dim'; applyMood(); } await blink(() => { setOut('me', Math.max(Z.out.me, 4), ''); setOut('n', Math.max(Z.out.n, 4), ''); }, L('…각자 욕실에서 갈아입는 중', '…changing')); bump(10, 3); }
  }
  const { val: dk } = await modal(`<h3>🍾 ${L('미니바', 'Minibar')}</h3><p>${L('오늘 주량', 'Tonight')}: ${L('나', 'Me')} ${Z.drinks.me}${L('잔', '')} · ${nm()} ${Z.drinks.n}${L('잔', '')}</p>`, [...Object.entries(DRINKS).map(([k, d]) => [`${d[0]} 🪙${d[1]}`, k, k === 'wine']), [L('취소', 'Cancel'), 0]]);
  if (!dk) return; if (!NC.Wallet.spend(DRINKS[dk][1])) return toast(L('🪙 코인이 모자라요', '🪙 Not enough coins'));
  sitBoth(RV.seats.sofa ? 'sofa' : 'bed'); P().group.userData.holdGlass = true; S.n.g.userData.holdGlass = true; let kind = dk;
  nSay(byT({ shy: '저 술 잘 못 마셔요… 천천히요 ㅎㅎ', cool: '좋은 선택이네요.', playful: '오늘 누가 먼저 취하나 내기! ㅋㅋ', outgoing: '짠 하자 짠!' }), 'smile');
  const sip = (w, a) => { if (Z.nonAlc[w] || !a) return; Z.drinks[w]++; if (w === 'me') { NC.Life.tipsy = clamp((NC.Life.tipsy || 0) + a, 0, 5); } else if (drunkN()) { S.n.drunk = true; } };
  for (let i = 0; i < 14; i++) {
    const a = DRINKS[kind][2], rows = [[L('🍷 따라 주기', '🍷 Pour'), 'pour', true], [L('🥂 건배', '🥂 Toast'), 'toast'], [L('🥃 러브샷', '🥃 Love shot'), 'love'], [L('😄 취중 수다', '😄 Tipsy chat'), 'chat'], [L('💬 속 깊은 얘기', '💬 Deep talk'), 'deep'], [L('🎵 음악 바꾸기', '🎵 Music'), 'music'], [L('🥤 나는 무알콜로', '🥤 Non-alcoholic for me'), 'na'], [L('⏹ 그만 마시기', '⏹ Stop drinking'), 'end']];
    const { val } = await modal(`<h3>🥂 ${DRINKS[kind][0]}${underMode ? ' · ' + L('속옷 차림 술자리', 'in underwear') : ''}</h3><p>${L('나', 'Me')} ${Z.drinks.me}${L('잔', '')}${Z.nonAlc.me ? '(무알콜)' : ''} · ${nm()} ${Z.drinks.n}${L('잔', '')}${Z.nonAlc.n ? '(무알콜)' : ''}${S.n.drunk ? ' · 🥴' : ''}</p>`, rows);
    if (!val || val === 'end') break;
    if (val === 'pour') { tryG(P().group, 'pour'); nSay(pick(['어머, 따라 주는 거예요? 감동 ㅎㅎ', '딱 좋다~ 거품도 예술!']), 'smile'); bump(2, 1); await wait(2000); }
    else if (val === 'toast') { tryG(P().group, 'cheers'); tryG(S.n.g, 'cheers'); beep(2400, .08, 'sine', .05); meSay(pick(['우리의 오늘 밤을 위하여!', '90년대 감성을 위하여 ㅋㅋ'])); await wait(900); tryG(P().group, 'drink'); tryG(S.n.g, 'drink'); sip('me', a); sip('n', a); bump(3, 2); await wait(1800); }
    else if (val === 'love') { if ((await ask('hand', { yes: false })) === 'no') continue; try { NC.Couple.loveshot(S.n); } catch (e) { } nSay(pick(['러브샷은… 처음 해 봐요 ㅎㅎ', '팔 꼬이면 안 돼요 ㅋㅋ 하나 둘 셋!']), 'laugh'); sip('me', a); sip('n', a); bump(6, 3); await wait(3500); }
    else if (val === 'chat') { nSay(byT({ shy: ['…사실 오늘 노래방에서부터 계속 떨렸어요.', '저 원래 이런 사람 아닌데… 술 때문이에요 ㅎㅎ'], cool: ['솔직히 말하면, 오늘 꽤 즐거워요.', '술 들어가니까 말이 많아지네… 이상하다.'], playful: ['야, 아니 우리 지금 완전 영화 같지 않아? ㅋㅋㅋ', '아 웃겨 ㅋㅋ 아까 그 춤 다시 춰 봐!'], outgoing: ['오늘 진짜 최고다! 이 동네 최고의 밤!', '우리 다음에 또 와요! 약속!'] }), 'laugh'); tryG(S.n.g, 'laugh'); bump(3, 3); await wait(1500); }
    else if (val === 'deep') { event('e07', true); bump(4, 4); await wait(2500); }
    else if (val === 'music') { const nx = S.music === 'blues' ? 'euro' : 'blues'; try { NC.Audio.playPlaylist(nx); } catch (e) { } S.music = nx; await wait(500); }
    else if (val === 'na') { Z.nonAlc.me = true; kind = Z.nonAlc.n ? 'soda' : kind; meSay('난 이제 무알콜로 마실게요.'); nSay('좋아요, 무리하지 마요 ㅎㅎ', 'smile'); await wait(800); }
    if (!Z.nonAlc.n && Z.drinks.n >= capN() && !S.n.drunk) { Z.nonAlc.n = true; nSay(pick(['저는 여기까지! 이제 탄산수 마실래요 ㅎㅎ', '(잔을 내려놓으며) 더 마시면 내일 후회할 것 같아요. 물이요 💧']), 'smile'); }
    if (S.n.drunk) { nSay('(살짝 비틀) …저 좀 취했나 봐요. 오늘은 그냥 얘기만 해요.', 'sad'); toast(L('🥴 상대가 많이 취했어요 — 신체 접촉·탈의 메뉴가 잠겨요', '🥴 Partner is drunk — intimate actions locked')); }
    if (meDrunk()) { toast(L('🥴 많이 취했어요 — 신체 접촉·탈의 메뉴가 잠겨요', '🥴 You are drunk — intimate actions locked')); }
  }
  P().group.userData.holdGlass = false; if (S.n) S.n.g.userData.holdGlass = false;
}
/* 5-4 🎮 게임 — 가위바위보 옷 벗기 · 진실게임 · 주사위 · 바니바니 */
const RPS = { rock: ['✊', 'rock'], paper: ['✋', 'paper'], scissors: ['✌', 'scissors'] }, BEAT = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
function npcPick() { const t = tr(S.n), h = Z.hist.slice(-6); if (h.length >= 3 && Math.random() < .35) { const c = {}; h.forEach(x => { c[x] = (c[x] || 0) + 1; }); const fav = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; return Object.keys(BEAT).find(k => BEAT[k] === fav); }
  const w = { shy: [.3, .45, .25], cool: [.36, .3, .34], playful: [.25, .3, .45], outgoing: [.45, .3, .25] }[S.n.trait] || [.34, .33, .33], r = Math.random(); return r < w[0] ? 'rock' : r < w[0] + w[1] ? 'paper' : 'scissors'; }
const ALT = [['compliment', L('💬 칭찬하기', '💬 Compliment')], ['dance', L('🕺 막춤 추기', '🕺 Funny dance')], ['shot', L('🥤 무알콜 원샷', '🥤 Mocktail shot')], ['song', L('🎶 다음 노래 고르기', '🎶 Pick next song')], ['hug', L('🤗 꼭 안아 주기', '🤗 Hug')], ['peck', L('😚 볼 뽀뽀', '😚 Peck')]];
async function doAlt(who, k) {
  const g = G(who), s = who === 'me' ? meSay : t => nSay(t, 'laugh');
  if (k === 'compliment') s(who === 'me' ? pick(['웃는 거 진짜 예뻐요. 아니, 진심으로.', '오늘 처음 봤을 때부터 눈에 띄었어요.']) : byT({ shy: '…목소리가 좋아요. 계속 듣고 싶어요.', cool: '매너가 좋아요. 그게 제일 섹시해요.', playful: '눈썹이 잘생겼어 ㅋㅋ 진짜로!', outgoing: '당신 옆에 있으면 시간 가는 줄 몰라요!' }));
  else if (k === 'dance') { tryG(g, 'funnyDance'); s(who === 'me' ? '(어설픈 막춤) 보지 마요 ㅋㅋㅋ' : '(엉덩이를 씰룩씰룩) 이거 보고 웃으면 지는 거다? ㅋㅋㅋ'); await wait(2600); }
  else if (k === 'shot') { tryG(g, 'drink'); s('(꿀꺽꿀꺽) 캬~ 무알콜인데 취하는 느낌 ㅋㅋ'); await wait(1600); }
  else if (k === 'song') { const nx = S.music === 'blues' ? 'euro' : 'blues'; try { NC.Audio.playPlaylist(nx); } catch (e) { } S.music = nx; s(nx === 'blues' ? '이 노래로 할게요. 분위기 있게 💗' : '신나는 걸로! 유로 댄스 고고 ㅋㅋ'); }
  else if (k === 'hug') { if (who === 'me' && (await ask('hug', { yes: false })) === 'no') return; await standAct('hug'); await wait(2600); endStanding(); }
  else if (k === 'peck') { if (who === 'me' && (await ask('cheek', { yes: false })) === 'no') return; await standAct('cheek'); await wait(2600); endStanding(); }
  bump(3, 2);
}
async function rpsStrip() {
  const { val, root } = await modal(`<h3>✊✋✌ ${L('가위바위보 — 옷 벗기 게임', 'Rock-Paper-Scissors — strip game')}</h3><p style="opacity:.8">${L('진 사람이 바깥쪽 옷부터 하나씩 벗거나 대체 벌칙을 골라요. 언제든 그만할 수 있어요.', 'Loser removes one outer item or picks another penalty. Stop anytime.')}</p>
    <div class="m19f"><b>${L('판수', 'Rounds')}</b><label><input type="radio" name="bo" value="3">${L('3판', 'Bo3')}</label><label><input type="radio" name="bo" value="5" checked>${L('5판', 'Bo5')}</label><label><input type="radio" name="bo" value="7">${L('7판', 'Bo7')}</label><label><input type="radio" name="bo" value="sd">${L('랜덤 판수', 'Random')}</label></div>
    <div class="m19f"><b>${L('벌칙 상한', 'Limit')}</b><label><input type="radio" name="cap" value="2">${L('겉옷·신발까지', 'Outerwear only')}</label><label><input type="radio" name="cap" value="4" checked>${L('속옷 차림까지', 'Down to underwear')}</label><label><input type="radio" name="cap" value="5">${L('수건·이불로 가릴 때까지', 'Until covered')}</label></div>
    <div class="m19f"><label><input type="checkbox" name="alt" checked>${L('대체 벌칙 허용(칭찬·막춤·무알콜 원샷·노래·포옹·볼뽀뽀)', 'Allow alternative penalties')}</label></div>`, [[L('🎮 하자고 하기', '🎮 Propose'), 1, true], [L('취소', 'Cancel'), 0]]);
  if (!val) return; const bo0 = root.querySelector('input[name=bo]:checked').value, bo = bo0 === 'sd' ? pick([3, 5, 7, 9]) : +bo0; let cap = +root.querySelector('input[name=cap]:checked').value; const altOk = root.querySelector('input[name=alt]').checked;
  meSay(pick(['가위바위보 할래요? 지는 사람이… 하나씩 ㅎㅎ', '심심한데 게임 하나 해요. 옷 벗기 가위바위보!'])); await wait(900);
  const r = await ask(cap >= 5 ? 'rpsCover' : cap >= 4 ? 'rpsUnder' : 'rps', { trust: cap >= 5 ? 80 : cap >= 4 ? 55 : 0, mood: cap >= 4 ? 50 : 0, yes: false });
  if (r === 'no') { if (cap > 2 && !drunkN() && !meDrunk()) { nSay(byT({ shy: '…겉옷까지만이면 할게요 ㅎㅎ', cool: '겉옷까지만. 그 이상은 안 돼요.', playful: '음~ 겉옷까지만! 협상 끝 ㅋㅋ', outgoing: '그럼 신발이랑 겉옷까지만 해요!' }), 'shy'); cap = 2; } else return; }
  else if (r === 'cond') { nSay('불 좀 줄이고… 그럼 할게요 ㅎㅎ', 'shy'); S.mood = 'dim'; applyMood(); }
  else nSay(byT({ shy: '…져도 놀리면 안 돼요?', cool: '좋아요. 대신 봐주기 없기.', playful: '오 자신 있나 봐? 각오해 ㅋㅋㅋ', outgoing: '콜! 이건 내가 이긴다!' }), 'laugh');
  sitBoth('bed'); Z.games++; const need = Math.ceil(bo / 2); let me = 0, nn = 0, round = 0;
  while (me < need && nn < need && round < 15) { round++;
    const { val: c } = await modal(`<h3>✊✋✌ ${L('라운드', 'Round')} ${round} · ${L('나', 'Me')} ${me} : ${nn} ${nm()}</h3><p>${L('지금', 'Now')} — ${L('나', 'Me')}: ${stateTxt('me')} · ${nm()}: ${stateTxt('n')}</p>`, [[`✊ ${L('바위', 'Rock')}`, 'rock', true], [`✋ ${L('보', 'Paper')}`, 'paper'], [`✌ ${L('가위', 'Scissors')}`, 'scissors'], [L('⏹ 그만하기', '⏹ Stop'), 0]]);
    if (!c) { nSay('그래요, 여기까지 해요 ㅎㅎ 재밌었다!', 'smile'); break; }
    const np = npcPick(); Z.hist.push(c); const pu = P().group.userData, nu = S.n.g.userData; pu.handPose = { L: 'relaxed', R: 'rock' }; nu.handPose = { L: 'relaxed', R: 'rock' };
    tryG(P().group, 'rpsPump'); tryG(S.n.g, 'rpsPump'); meSay(L('가위… 바위…', 'Rock… paper…')); await wait(1300);
    pu.handPose = { L: 'relaxed', R: RPS[c][1] }; nu.handPose = { L: 'relaxed', R: RPS[np][1] }; tryG(P().group, 'rpsShow'); tryG(S.n.g, 'rpsShow'); beep(1200, .1, 'square', .04);
    say(P().group, RPS[c][0], 1.6); say(S.n.g, RPS[np][0], 1.6); await wait(1200); pu.handPose = nu.handPose = null;
    if (c === np) { nSay(pick(['비겼다! 다시! ㅋㅋ', '어? 통했다 ㅎㅎ 한 번 더!']), 'laugh'); continue; }
    const iWin = BEAT[c] === np; if (iWin) me++; else nn++; Z.wins[iWin ? 'me' : 'n']++;
    const loser = iWin ? 'n' : 'me';
    if (iWin) { expr(S.n.g, 'surprised'); nSay(byT({ shy: ['어떡해… 또 졌어 ㅠㅠ', '…일부러 그런 거 아니죠?'], cool: ['…운이 좋네요.', '흠. 다음 판은 안 져요.'], playful: ['악! 반칙이야 반칙 ㅋㅋㅋ', '봐준 거거든?! ㅋㅋ'], outgoing: ['아 진짜?! 한 판만 더!', '헐 대박 ㅋㅋ 졌다!'] }), 'laugh'); }
    else { tryG(S.n.g, 'cheer'); nSay(byT({ shy: '헤헤… 이겼다 ㅎㅎ', cool: '제가 이겼네요. 자, 벌칙.', playful: '예~~ 이겼다! 벗어 벗어 ㅋㅋㅋ 농담~ 골라요!', outgoing: '이겼다!! 자 벌칙 타임~!' }), 'laugh'); }
    await wait(900); await penalty(loser, cap, altOk);
    if (loser === 'n' && Z.out.n >= 3 && await secondThought('rps')) break;
  }
  if (me >= need || nn >= need) { const iw = me > nn; sys(L(`🏆 ${iw ? '내가' : S.n.name + '님이'} 이겼어요 (${me}:${nn})`, `🏆 ${iw ? 'You' : S.n.name} won (${me}:${nn})`)); nSay(iw ? byT({ shy: '…다음엔 꼭 이길 거예요.', cool: '리매치 요청합니다.', playful: '복수전이다! 두고 봐 ㅋㅋ', outgoing: '아 아깝다~ 다음 판 바로 가요!' }) : byT({ shy: '헤헤 제가 이겼다 ㅎㅎ', cool: '역시 제가 이기네요.', playful: '내가 가위바위보 여왕이다 ㅋㅋㅋ', outgoing: '이겼다~ 소원 하나 들어줘요!' }), 'laugh'); if (!iw) setTimeout(() => winnerWish(), 1800); }
  bump(6, 4);
  if (Z.out.me || Z.out.n) { const { val: rd } = await modal(`<h3>👗 ${L('게임 끝', 'Game over')}</h3>`, [[L('🧥 둘 다 다시 입기', '🧥 Both get dressed'), 'all', true], [L('👘 가운만 걸치기', '👘 Just robes'), 'robe'], [L('그대로 있기', 'Stay as is'), 0]]);
    if (rd === 'all') await redressAll(); else if (rd === 'robe') await blink(() => { setOut('me', Math.min(Z.out.me, 4), 'robe'); setOut('n', Math.min(Z.out.n, 4), 'robe'); }, '…'); }
}
async function penalty(loser, cap, altOk) {
  const can = Z.out[loser] < cap, next = ITEM[gOf(loser)][Z.out[loser] + 1];
  if (loser === 'me') {
    const rows = []; if (can) rows.push([`👕 ${next} ${L('벗기', 'off')}`, 'strip', true]); if (altOk || !can) ALT.forEach(([k, l]) => rows.push([l, k]));
    if (!rows.length) rows.push([L('💬 칭찬하기', '💬 Compliment'), 'compliment', true]);
    const { val } = await modal(`<h3>😅 ${L('졌어요 — 벌칙', 'You lost — penalty')}</h3><p>${can ? '' : L('벌칙 상한에 도달 — 대체 벌칙만 가능', 'Limit reached — alternatives only')}</p>`, rows);
    if (val === 'strip') { await stripOne('me', 'self'); nSay(byT({ shy: '……(손으로 눈을 가리다 슬쩍 본다)', cool: '…괜찮은데요.', playful: '오~~ ㅋㅋㅋ 휘파람 휘이~', outgoing: '와 ㅋㅋ 쿨하다!' }), 'shy'); }
    else await doAlt('me', val || 'compliment');
  } else {
    const t = tr(S.n), bold = t.cf > .6 || S.n.trait === 'outgoing', strip = can && !drunkN() && (adminMax() || (bold ? Math.random() < .75 : S.n.trait === 'shy' ? Math.random() < .3 : Math.random() < .5));
    if (strip) { nSay(Z.out.n >= 3 ? byT({ shy: '…불, 조금만 더 꺼 줘요.', cool: '…약속은 약속이니까.', playful: '자, 눈 감아! …뜬 거 다 보여 ㅋㅋ', outgoing: '좋아, 쿨하게 간다!' }) : byT({ shy: `…${next}부터요.`, cool: `${next}. 됐죠?`, playful: `${next}! 아직 여유 있다구~ ㅋㅋ`, outgoing: `${next} 벗을게요~` }), 'shy'); await stripOne('n', 'self'); }
    else { const k = altOk || !can ? pick(['compliment', 'dance', 'song', 'shot']) : 'compliment'; nSay(byT({ shy: '저는… 대체 벌칙 할래요 ㅎㅎ', cool: '이번엔 대체 벌칙으로 할게요.', playful: '흥, 벗을 줄 알았지? 대체 벌칙이다 ㅋㅋ', outgoing: '이번엔 다른 거 할게요!' }), 'laugh'); await wait(800); await doAlt('n', k); }
  }
}
async function winnerWish() { const { val } = await modal(`<h3>🏆 ${nm()}${L('의 소원', '’s wish')}</h3><p>${byT({ shy: '…소원은요, 꼭 안아 주는 거요.', cool: '다음 활동은 제가 고를게요. 슬로우댄스.', playful: '음~ 막춤 한 번 더! ㅋㅋㅋ', outgoing: '노래 한 곡 불러 줘요!' })}</p>`, [[L('들어주기', 'Grant'), 1, true], [L('나중에', 'Later'), 0]]);
  if (!val) return; const t = S.n.trait; if (t === 'shy') { await standAct('hug'); await wait(3000); endStanding(); } else if (t === 'cool') slowDance(true); else if (t === 'playful') { tryG(P().group, 'funnyDance'); meSay('(최선을 다한 막춤) ㅋㅋㅋ'); } else { tryG(P().group, 'cheer'); meSay('🎤 (노래를 한 소절 부른다)'); } bump(5, 4); }
async function stripOne(w, how) { const g = gOf(w), it = ITEM[g][Z.out[w] + 1]; if (!it) return; const kinds = ['', 'jacket', 'shoes', 'top', 'bottom', 'strap'], kind = kinds[Z.out[w] + 1];
  if (how === 'other' && TOUCH[kind]) { touch(kind, 2.2, w === 'n' ? 'me' : 'n', w); await wait(1300); } else if (kind === 'shoes') { tryG(G(w), 'pickup'); await wait(900); } else { tryG(G(w), 'shy'); await wait(600); }
  await blink(() => { Z.out[w] = Math.min(5, Z.out[w] + 1); if (Z.out[w] >= 3 && Z.wear[w] && Z.wear[w] !== 'towel') Z.wear[w] = ''; refresh(w); if (Z.out[w] >= 5 && !/dim/.test(S.mood)) { S.mood = 'dim'; applyMood(); } });
  sys(`👗 ${w === 'me' ? L('나', 'Me') : S.n.name}: ${it} — ${stateTxt(w)}`); bump(Z.out[w] >= 4 ? 6 : 3);
}
async function truthDare() {
  const Q = [['가벼움', ['첫사랑은 몇 살 때였어요?', '노래방 애창곡 진짜 1위는?', '오늘 제 첫인상 몇 점이었어요?']], ['설렘', ['오늘 언제 처음 설렜어요?', '저한테 반한 순간이 있다면?', '지금 제일 하고 싶은 건?']], ['19금 암시', ['가장 기억에 남는 키스는 어땠어요?', '오늘 밤에 대해 솔직하게 기대하는 게 있어요?', '제 어디가 제일 매력 있어요?']]];
  for (let i = 0; i < 6; i++) { const { val } = await modal(`<h3>❓ ${L('진실 혹은 도전', 'Truth or dare')}</h3>`, [[L('🗣 진실 (질문)', '🗣 Truth'), 't', true], [L('🎯 도전 (미션)', '🎯 Dare'), 'd'], [L('🔁 상대 차례', '🔁 Their turn'), 'n'], [L('그만', 'Stop'), 0]]); if (!val) break;
    if (val === 't') { const lv = moodNow() > 70 ? 2 : moodNow() > 45 ? 1 : 0, q = pick(Q[lv][1]); meSay(q); await wait(1200); nSay(lv === 2 ? byT({ shy: '…그런 걸 물어보면 어떡해요 ㅎㅎ 비밀이에요. …조금만 말하면, 지금 이 순간?', cool: '솔직히? 지금 눈앞에 있는 사람이요.', playful: '음~ 그건 직접 알아내 봐 ㅋㅋㅋ', outgoing: '아 그건 진짜 부끄러운데… 오늘이요! 됐죠? ㅋㅋ' }) : byT({ shy: '음… 고등학교 때요. 짝사랑이었어요 ㅎㅎ', cool: '생각보다 평범해요. 그게 답이에요.', playful: '그거 말하면 놀릴 거잖아 ㅋㅋ 그래도 말해 줌!', outgoing: '완전 솔직하게 말해 줄게요!' }), 'shy'); bump(lv * 2 + 2, 2); }
    else if (val === 'd') { const d = pick(['compliment', 'dance', 'hug', 'peck', 'song']); sys(`🎯 ${L('미션', 'Dare')}: ${ALT.find(a => a[0] === d)[1]}`); await doAlt('me', d); }
    else { const t = Math.random() < .5; nSay(t ? '진실! …뭐든 물어봐요.' : '도전! 미션 줘요 ㅋㅋ', 'laugh'); await wait(900); if (t) { meSay(pick(['오늘 저랑 온 거 후회 안 해요?', '저 어때요? 솔직하게.'])); await wait(1000); nSay(byT({ shy: '…후회 안 해요. 오히려 고마워요.', cool: '괜찮은 사람이에요. 진심으로.', playful: '음~ 85점! 나머지는 노력하기 ㅋㅋ', outgoing: '완전 좋아요! 최고!' }), 'smile'); } else await doAlt('n', pick(['dance', 'compliment', 'song'])); bump(3, 3); }
  }
}
async function diceMission() {
  const M = [[L('💬 칭찬 3개', '💬 3 compliments'), 'compliment'], [L('🤗 10초 포옹', '🤗 10s hug'), 'hug'], [L('😚 볼 뽀뽀', '😚 Peck'), 'peck'], [L('💆 1분 어깨 마사지', '💆 1-min massage'), 'massage'], [L('🎶 노래 한 소절', '🎶 Sing a line'), 'song'], [L('🕺 막춤', '🕺 Funny dance'), 'dance']];
  for (let i = 0; i < 4; i++) { const { val } = await modal(`<h3>🎲 ${L('커플 주사위', 'Couple dice')}</h3>`, [[L('🎲 굴리기', '🎲 Roll'), 1, true], [L('그만', 'Stop'), 0]]); if (!val) break;
    beep(600, .05, 'square', .04); setTimeout(() => beep(900, .05, 'square', .04), 120); const d = Math.random() * 6 | 0, who = Math.random() < .5 ? 'me' : 'n'; sys(`🎲 ${d + 1} → ${who === 'me' ? L('내가', 'Me') : S.n.name + L('님이', '')}: ${M[d][0]}`); await wait(700);
    if (M[d][1] === 'massage') { if (who === 'me') await massage(); else { nSay('제가 해 줄게요. 앉아 봐요 ㅎㅎ', 'smile'); await standPair('back', .38); Z.pin.me.ry = Z.pin.n.ry = 0; Z.pin.n.ry = Math.PI; touch('massage', 4.5, 'n', 'me'); await wait(4600); freePair(); meSay('와… 시원하다.'); } }
    else await doAlt(who, M[d][1]); }
}
async function bunny() { const { val } = await modal(`<h3>🐰 ${L('바니바니 게임', 'Bunny game')}</h3><p>${L('진 사람은 한 잔(또는 무알콜)!', 'Loser drinks (or a mocktail)!')}</p>`, [[L('시작', 'Start'), 1, true], [L('취소', 'Cancel'), 0]]); if (!val) return;
  for (let i = 0; i < 4; i++) { meSay('바니바니~ 바니바니~ 🐰'); await wait(900); const miss = Math.random() < (S.n.trait === 'playful' ? .45 : .3) + (Z.drinks.n * .05); if (miss) { nSay('당근당… 앗 틀렸다 ㅋㅋㅋ', 'laugh'); tryG(S.n.g, 'drink'); if (!Z.nonAlc.n) { Z.drinks.n++; if (drunkN()) S.n.drunk = true; } } else { nSay('당근당근! ㅋㅋ 이번엔 당신 차례!', 'laugh'); await wait(700); const { val: v } = await modal(`<h3>🐰</h3>`, [[L('당근당근!', 'Carrot carrot!'), 1, true], [L('바니바니!', 'Bunny bunny!'), 2]]); if (v === 2) { meSay('바니ㅂ… 앗!'); tryG(P().group, 'drink'); if (!Z.nonAlc.me) { Z.drinks.me++; NC.Life.tipsy = clamp((NC.Life.tipsy || 0) + .4, 0, 5); } } } await wait(900); }
  bump(5, 4); if (drunkN()) toast(L('🥴 상대가 많이 취했어요 — 신체 접촉·탈의 메뉴가 잠겨요', '🥴 Partner is drunk')); }
/* 5-5 👗 옷 벗겨 주기 · 입혀 주기 */
async function undressPartner() {
  const w = 'n', k = Z.out.n + 1; if (k > 5) { nSay('이제… 더 벗을 게 없어요 ㅎㅎ (이불을 끌어당긴다)', 'shy'); return; } const it = ITEM[gN()][k];
  meSay(k >= 5 ? '…마지막 것도, 벗겨 줘도 돼요? 싫으면 말해요.' : pick([`${it}… 벗겨 줘도 돼요?`, `${it}, 내가 도와줘도 될까요?`]));
  await wait(900);
  const o = k >= 5 ? { trust: 80, mood: 70, moodLine: '…불 꺼 줘요. 그리고 이불 먼저요.' } : k >= 3 ? { trust: 55, mood: 50, moodLine: pick(['…불 좀 끄고요.', '천천히요… 분위기 조금만 더요.']) } : {};
  const r = await ask('undress' + k, Object.assign(o, { ok: k >= 4 ? byT({ shy: '……네. 천천히요.', cool: '…좋아요.', playful: '…오늘은 봐줄게요 ㅎㅎ', outgoing: '응… 💗' }) : byT({ shy: '…네 ㅎㅎ', cool: '그래요.', playful: '서비스 좋네~ ㅋㅋ', outgoing: '고마워요~' }) }));
  if (r === 'cond') { if (/dim/.test(S.mood)) return; const { val } = await modal(`<h3>🕯</h3><p>${L('조명을 은은하게 바꿀까요?', 'Dim the lights?')}</p>`, [[L('🌙 은은하게', '🌙 Dim'), 1, true], [L('취소', 'Cancel'), 0]]); if (val) { S.mood = 'dim'; applyMood(); bump(10); nSay('…이제 좋아요. 다시 물어봐 줘요 ㅎㅎ', 'shy'); } return; }
  if (r === 'no') return;
  await standPair('face', .44); await stripOne(w, 'other'); freePair();
  if (k >= 5) await afterFinal();
  else if (await secondThought('undress' + k)) return;
  else if (k === 4) setTimeout(() => nSay(byT({ shy: '…너무 쳐다보지 마요.', cool: '…당신 차례예요.', playful: '자, 이제 공평하게 당신도? ㅋㅋ', outgoing: '이제 둘 다 맞춰야죠 ㅎㅎ' }), 'shy'), 800);
}
async function undressMe() { const k = Z.out.me + 1; if (k > 5) return; const it = ITEM[gP()][k];
  const { val } = await modal(`<h3>👕 ${L('내 옷', 'My clothes')}</h3><p>${L('다음', 'Next')}: ${it}</p>`, [[L('🙋 내가 직접 벗기', '🙋 Take it off myself'), 'self', true], [L(`🤲 ${S.n.name}님에게 부탁하기`, '🤲 Ask partner to help'), 'ask'], [L('취소', 'Cancel'), 0]]);
  if (!val) return;
  if (val === 'ask') { meSay(`${it}… 벗겨 줄래요?`); await wait(800); const r = await ask('dressYou', { yes: false }); if (r === 'no') return; nSay(k >= 4 ? byT({ shy: '…제가요? (떨리는 손으로)', cool: '…가만히 있어요.', playful: '오케이 ㅋㅋ 간지럼 타지 마!', outgoing: '내가 해 줄게요 💗' }) : '이리 와 봐요 ㅎㅎ', 'shy'); await standPair('face', .44); await stripOne('me', 'other'); freePair(); }
  else { await stripOne('me', 'self'); setTimeout(() => nSay(k >= 4 ? byT({ shy: '……! (눈을 피한다)', cool: '…대담하네요.', playful: '와우 ㅋㅋㅋ', outgoing: '헐 ㅋㅋ 자신감 좋아요!' }) : byT({ shy: '편하게 있어요 ㅎㅎ', cool: '편하게 해요.', playful: '오 몸풀기? ㅋㅋ', outgoing: '편하게 편하게~' }), 'shy'), 700); }
}
async function npcAsksUnzip() { if (Z.out.n >= 4) return; const it = ITEM[gN()][Z.out.n + 1];
  nSay(byT({ shy: `저기… ${it} 이거, 혼자 벗기가 좀 힘든데… 도와줄래요?`, cool: `${it} 좀 도와줄래요?`, playful: `이거 ${it}… 좀 풀어 줄래? 이상한 생각 하지 말고 ㅋㅋ`, outgoing: `${it} 좀 도와줘요~ 손이 안 닿아요!` }), 'shy');
  const { val } = await modal(`<h3>🤲 ${nm()}${L('님의 부탁', '’s request')}</h3>`, [[L('응, 도와줄게요', 'Sure, I’ll help'), 1, true], [L('괜찮아요, 그대로 있어요', 'It’s okay, stay as you are'), 0]]);
  if (!val) { meSay('지금도 좋아요. 편하게 있어요.'); nSay('…ㅎㅎ 매너 있네요.', 'smile'); bump(2, 4); return; } await standPair('face', .44); await stripOne('n', 'other'); freePair(); bump(6, 3); }
async function dressPartner() { if (!Z.out.n && !Z.wear.n) return nSay('지금 다 입고 있어요 ㅎㅎ', 'smile'); meSay('추울까 봐요. 가운 걸쳐 줄게요.'); await standPair('face', .5); touch('drape', 2, 'me', 'n'); await wait(1300); await blink(() => setOut('n', Math.min(Z.out.n, 4), 'robe')); freePair();
  nSay(byT({ shy: '…따뜻하다. 고마워요 💗', cool: '…이런 거 은근 감동이에요.', playful: '오 매너 손~ ㅋㅋ 고마워!', outgoing: '고마워요! 다정하다~' }), 'smile'); S.n.aff = Math.min(100, S.n.aff + 1); bump(3, 5); }
async function afterFinal() {
  if (!/dim/.test(S.mood)) { S.mood = 'dim'; applyMood(); } lie({ me: { x: -.33 }, n: { x: .33 }, sheet: true }); await wait(600);
  nSay(byT({ shy: '……이불 덮어 줘서 다행이다. 심장 소리 들릴 것 같아요.', cool: '…이제 우리 둘뿐이네요.', playful: '…이불 속은 반칙 금지 구역이다? ㅎㅎ', outgoing: '…따뜻하다. 이렇게 있으니까 좋다 💗' }), 'shy');
  const { val } = await modal(`<h3>🌙 ${L('이불 속', 'Under the covers')}</h3><p>${L('어떻게 할까요? 언제든 멈출 수 있어요.', 'What now? You can stop anytime.')}</p>`, [[L('🌙 둘만의 시간으로 (서로 동의)', '🌙 Private moment (mutual consent)'), 'pm', true], [L('🤗 그냥 안고 있기', '🤗 Just cuddle'), 'cuddle'], [L('💬 이야기하기', '💬 Talk'), 'talk'], [L('🧥 다시 입기', '🧥 Get dressed'), 'dress']]);
  if (val === 'pm') await privateMoment(); else if (val === 'cuddle') await lieCuddle(); else if (val === 'talk') { nSay(pick(['…오늘 처음 만났을 때, 이렇게 될 줄 알았어요?', '나 사실 되게 긴장했어요. 지금도요 ㅎㅎ']), 'shy'); bump(3, 4); } else if (val === 'dress') { unlie(); await redressAll(); }
}
/* 5-6 💆 마사지 · 스킨십 */
async function massage() { const r = await ask('massage'); if (r === 'no' || r === 'cond') return; await standPair('back', .38); nSay(byT({ shy: '아… 거기 뭉쳤어요. 살살요 ㅎㅎ', cool: '…잘하네요. 계속해요.', playful: '아야야! 아 시원해 ㅋㅋㅋ', outgoing: '와 대박 시원해요~' }), 'smile'); touch('massage', 6); bump(5, 4); await wait(6100); freePair(); await secondThought('massage'); }
async function oilMassage() { const r = await ask('oil', { trust: 55, mood: 45 }); if (r === 'no' || r === 'cond') return;
  await blink(() => { lie({ n: { x: .1, prone: true } }); const p = P(), x = BX - .62, z = CZ - RHZ + .32 + .7; Z.pin = { me: { x, z, ry: Math.PI / 2 } }; p.x = x; p.z = z; });
  nSay(byT({ shy: '…오일 차가워요 ㅎㅎ 천천히요.', cool: '…향 좋다. 이대로 잠들 것 같아요.', playful: '간지럼 태우면 발로 찬다? ㅋㅋ', outgoing: '아~ 천국이다 💗' }), 'shy'); touch('scrub', 7); bump(8, 4); await wait(7200); if (await secondThought('oil')) return; nSay('…고마워요. 몸이 다 풀렸어요 💗', 'smile'); await blink(() => { Z.pin = null; unlie(); }); }
async function feed() { const r = await ask('feed', { yes: false }); if (r === 'no') return; sitSofa(); await wait(500); meSay('아~ 해 봐요 🍓'); touch('feed', 2.6); await wait(1600); tryG(S.n.g, 'nod'); nSay(pick(['음~ 달다 ㅎㅎ 이번엔 내가 줄게요!', '(오물오물) …초콜릿 묻었어요? ㅋㅋ']), 'laugh'); bump(4, 3); await wait(1000); touch('feed', 2.4, 'n', 'me'); }
async function ice() { const r = await ask('ice', { yes: false }); if (r === 'no') return; await standPair('back', .4); touch('ice', 1.6); await wait(900); tryG(S.n.g, 'shiver'); nSay(pick(['꺅!! 차가워!! ㅋㅋㅋ 복수할 거야!', '히익! …진짜 반칙이다 ㅋㅋㅋ']), 'surprised'); await wait(1300); freePair(); bump(4, 3); }
async function slowDance(skipAsk) { if (!skipAsk) { const r = await ask('slowdance', { yes: false }); if (r === 'no') return; } unlie(); try { NC.Audio.playPlaylist('blues'); S.music = 'blues'; } catch (e) { } await standAct('waist'); nSay(Z.out.n >= 4 ? '…이렇게 추니까 체온이 느껴져요.' : '…이 노래 좋다 💗', 'shy'); bump(7, 4); }
async function lieTogether() { const r = await ask('lieTogether', { trust: 50 }); if (r === 'no' || r === 'cond') return; await blink(() => lie({ me: { x: -.36 }, n: { x: .36 }, sheet: Z.out.me >= 4 || Z.out.n >= 4 })); nSay(byT({ shy: '…천장 거울에 우리 비친다 ㅎㅎ', cool: '…이렇게 누워 있으니까 좋네요.', playful: '침대 반 갈라서 넘어오면 벌금! ㅋㅋ', outgoing: '아 푹신해~ 이대로 자고 싶다' }), 'smile'); bump(5, 3); }
async function lieCuddle() { const r = await ask('armpillow', { yes: false }); if (r === 'no') return; if (!Z.lie) await blink(() => lie({ me: { x: -.3, roll: -1.15 }, n: { x: .28, roll: 1.15 }, sheet: Z.out.me >= 4 || Z.out.n >= 4 })); else { Z.lie.me = { x: -.3, roll: -1.15 }; Z.lie.n = { x: .28, roll: 1.15 }; setSheet(!!sheetM); }
  nSay(pick(['…팔 안 저려요? ㅎㅎ', '심장 소리 들린다… 빨라요 ㅋㅋ']), 'shy'); expr(S.n.g, 'shy', 6); bump(6, 4); }
async function lieKiss() { const r = await ask('lieKiss', { trust: 60, mood: 55 }); if (r === 'no' || r === 'cond') return; const sh = Z.out.me >= 4 || Z.out.n >= 4 || !!sheetM; await blink(() => lie({ me: { x: -.2, roll: -1.25 }, n: { x: .18, roll: 1.25 }, sheet: sh }));
  expr(P().group, 'kiss', 3); expr(S.n.g, 'kiss', 3); await wait(2800); nSay(pick(['……하아. 이불 속이라 다행이다 ㅎㅎ', '(입술을 떼고 웃는다) …또 하고 싶다 💗']), 'shy'); bump(9, 4); await secondThought('lieKiss'); }
async function blindGuess() { const r = await ask('eyes', { yes: false }); if (r === 'no') return; await standPair('back', .36); touch('eyes', 3.2); meSay('누~구게? ㅎㅎ'); await wait(1200); nSay(byT({ shy: '…당신이잖아요 ㅎㅎ 손 따뜻하다.', cool: '여기 우리 둘밖에 없거든요 ㅎ', playful: '음… 룸서비스 아저씨? ㅋㅋㅋ', outgoing: '알지롱~ 손 냄새로 알았어요 ㅋㅋ' }), 'laugh'); await wait(2100); freePair(); bump(4, 3); }
function whisper() { standAct('whisper'); meSay(pick(['(귓가에) …오늘 너무 예뻐요.', '(작게) 아까부터 계속 생각했어요.'])); setTimeout(() => nSay(pick(['…간지러워요 ㅎㅎ 한 번 더 말해 줘요.', '(귀가 빨개지며) …나도요.']), 'shy'), 1600); bump(4, 2); }
function naughtyJoke() { meSay(pick(['이 방 거울… 왜 천장에 있는지 알아요? ㅎㅎ', '이 침대, 삐걱거리면 옆방에 다 들리겠다 ㅋㅋ'])); setTimeout(() => nSay(byT({ shy: '…! 그런 말 하지 마요 ㅎㅎ (베개로 얼굴을 가린다)', cool: '…그걸 지금 확인해 보자는 거예요? ㅎ', playful: 'ㅋㅋㅋㅋ 아 진짜 변태다~', outgoing: 'ㅋㅋㅋ 아 웃겨! 근데 은근 궁금하다?' }), 'laugh'), 1200); bump(3, 2); }
/* 5-7 🛁 자쿠지 */
const needJac = () => { if (RV.water) return false; modal(`<h3>🛁</h3><p>${L('자쿠지는 자쿠지 스위트에만 있어요. 업그레이드할까요?', 'Only the Jacuzzi Suite has one. Upgrade?')}</p>`, [[L('⬆ 업그레이드 보기', '⬆ See upgrade'), 1, true], [L('닫기', 'Close'), 0]]).then(({ val }) => { if (val) { const u = X.ACTS.etc.find(a => a[0] === 'upgrade'); u && u[2](); } }); return true; };
async function jacFill() { if (needJac()) return; if (Z.jac.fill >= 1) return toast(L('이미 물이 가득해요', 'Already full')); sys(L('🛁 자쿠지에 물을 받는 중…', '🛁 Filling the jacuzzi…')); waterSound(true); Z.jac.filling = performance.now() - Z.jac.fill * 18000; nSay('물 받는 소리 좋다~ 거품도 넣어요!', 'smile'); }
function jacFoam() { if (needJac()) return; Z.jac.foam = true; if (W19 && W19.petals) W19.petals.visible = true; nSay('꺅 거품 엄청 많다 ㅋㅋ 장미 꽃잎까지!', 'laugh'); bump(6, 2); }
async function jacIn() { if (needJac()) return; if (Z.jac.fill < .9) return toast(L('물을 먼저 받아요', 'Fill it first')); if (!Z.jac.foam) { Z.jac.foam = true; if (W19 && W19.petals) W19.petals.visible = true; }
  meSay('…같이 들어갈래요?'); await wait(800); const r = await ask('jacTogether', { trust: 55, mood: 50 }); if (r === 'no' || r === 'cond') return;
  await blink(() => { unlie(); standBoth(); stopHand(); endStanding(); Z.out.me = Math.max(Z.out.me, 4); Z.out.n = Math.max(Z.out.n, 4); Z.wear.me = Z.wear.n = ''; refreshAll(); const cx = BX + 2.6, cz = CZ + 2.3, p = P();
    NC.sitPlayer({ kind: 'motel', where: 'jac', x: cx - .38, z: cz, ry: Math.PI / 2 }, { x: cx - .38, z: cz, ry: Math.PI / 2, h: .3 }); p.group.position.set(cx - .38, 0, cz); NC.NPC.sit(S.n, cx + .38, cz, -Math.PI / 2, .3); S.n.g.userData.lookAt = p; S.follow = false; Z.jac.in = true; }, L('…거품 속으로', '…into the bubbles'));
  nSay(byT({ shy: '…거품 덕분에 다행이다 ㅎㅎ', cool: '…좋다. 하루가 다 녹는 느낌.', playful: '거품 수염! ㅋㅋㅋ 산타 같지?', outgoing: '아~ 천국이다 천국 💗' }), 'smile'); bump(10, 5);
  for (let i = 0; i < 6 && Z.jac.in; i++) { const { val } = await modal(`<h3>🛁 ${L('자쿠지', 'Jacuzzi')}</h3>`, [[L('😌 어깨 기대기', '😌 Lean on shoulder'), 'lean', true], [L('🍾 와인 한 잔 🪙9', '🍾 Glass of wine 🪙9'), 'wine'], [L('🌈 버블 조명 바꾸기', '🌈 Bubble lights'), 'light'], [L('💬 이야기', '💬 Talk'), 'talk'], [L('🚪 나와서 가운 입기', '🚪 Get out & robe up'), 'out']]); if (!val || val === 'out') break;
    if (val === 'lean') { try { NC.Couple.sofa(S.n, 10); } catch (e) { } nSay('…이대로 시간 멈췄으면 좋겠다.', 'shy'); bump(5, 3); }
    else if (val === 'wine') { if (!NC.Wallet.spend(9)) { toast(L('🪙 코인이 모자라요', '🪙 Not enough coins')); continue; } P().group.userData.holdGlass = S.n.g.userData.holdGlass = true; tryG(P().group, 'cheers'); tryG(S.n.g, 'cheers'); if (!Z.nonAlc.n) { Z.drinks.n++; if (drunkN()) S.n.drunk = true; } if (!Z.nonAlc.me) { Z.drinks.me++; NC.Life.tipsy = clamp((NC.Life.tipsy || 0) + .5, 0, 5); } nSay('자쿠지에서 와인이라니… 완전 영화다 ㅎㅎ', 'laugh'); await wait(2000); P().group.userData.holdGlass = S.n.g.userData.holdGlass = false; }
    else if (val === 'light') { if (RV.water) RV.water.material.emissive.copy(new T.Color(pick(['#5a2a9a', '#9a1a5a', '#1a6a9a', '#1a9a6a']))); nSay('색 바뀐다~ 예쁘다!', 'smile'); }
    else nSay(pick(['어릴 때 목욕탕 가면 냉탕에서 수영했었는데 ㅋㅋ', '이런 데 오면 진짜 어른 된 기분이에요 ㅎㅎ']), 'smile');
    await wait(900); }
  await blink(() => { Z.jac.in = false; if (P().seat) NC.requestStand(); NC.unseatAvatar(S.n.g); const c = RV.seats.bed; const p = P(); p.x = BX + c[0].x; p.z = CZ + c[0].z + .6; p.group.position.set(p.x, 0, p.z); placePartner(BX + c[1].x, CZ + c[1].z + .6, Math.PI); S.follow = true; setOut('me', Math.min(Z.out.me, 4), 'robe'); setOut('n', Math.min(Z.out.n, 4), 'robe'); Z.wet.me = Z.wet.n = 1; });
}
/* 5-8 🌙 둘만의 밤 */
async function privateMoment() {
  if (drunkN() || S.n.drunk || meDrunk()) { nSay('오늘은 둘 다 술을 마셨잖아요. 이런 건… 맨정신일 때 하고 싶어요. 그냥 안고 자요 💗', 'smile'); return; }
  const r = await ask('privateMoment', { trust: 80, mood: 70, yes: false, moodLine: '…조금만 더 천천히요. 아직은 이렇게 있는 게 좋아요.' }); if (r === 'no' || r === 'cond') return;
  const { val } = await modal(`<h3>🌙 ${L('둘만의 시간', 'A private moment')}</h3><p>${L(`${esc(S.n.name)}님도 원한다고 했어요.<br>장면은 암전으로 넘어가요. 정말 진행할까요?`, `${esc(S.n.name)} said yes too.<br>The scene fades to black. Continue?`)}</p>`, [[L('응, 함께', 'Yes, together'), 1, true], [L('아니, 오늘은 이대로', 'Not tonight'), 0]]);
  if (!val) { meSay('…오늘은 이렇게 있는 게 좋아요.'); nSay('…저도요. 고마워요 💗', 'smile'); bump(3, 6); memOf(S.n).trust = Math.min(100, memOf(S.n).trust + 2); save(); return; }
  nSay(byT({ shy: '……불, 꺼 줄래요?', cool: '…이리 와요.', playful: '…이번엔 장난 아니다? 💗', outgoing: '…응 💗' }), 'shy');
  S.busy = true; S.mood = 'dim'; applyMood(); if (RV.curtA) { RV.curtA.scale.z = RV.curtB.scale.z = 2.2; }
  const f = document.createElement('div'); f.className = 'motelNight'; f.innerHTML = `<div>${L('…불이 꺼졌다', '…the lights go out')}</div><small>${L('창밖의 빗소리, 오래된 라디오의 발라드', 'rain outside, an old ballad on the radio')}</small>`; document.body.appendChild(f); requestAnimationFrame(() => f.classList.add('on'));
  try { NC.Audio.playPlaylist('blues'); S.music = 'blues'; } catch (e) { } await wait(3200); f.innerHTML = `<div>${L('몇 시간 후', 'A few hours later')}</div>`; await wait(2000);
  Z.out.me = Z.out.n = 5; Z.wear.me = Z.wear.n = ''; refreshAll(); lie({ me: { x: -.3, roll: -1.1 }, n: { x: .28, roll: 1.1 }, sheet: true });
  S.clockMin = Math.min(S.clockMin + 90, S.endMin - 15); updBar(); Z.pm = 1; const m = memOf(S.n); m.pm = (m.pm || 0) + 1; m.trust = Math.min(100, m.trust + 5); save(); S.n.aff = Math.min(100, S.n.aff + 3);
  f.classList.remove('on'); setTimeout(() => f.remove(), 900); S.busy = false; await wait(1100);
  nSay(byT({ shy: ['……(이불을 코까지 덮고) 쳐다보지 마요. 지금 얼굴 엄청 빨개요.', '…나 이상하지 않았어요? …다행이다.'], cool: ['…생각보다 훨씬 좋았어요. 솔직히.', '(천장을 보며) …이 방 거울, 이제 이해했어요.'], playful: ['…와. 이건 리뷰 별 다섯 개다 ㅋㅋ', '(베개로 얼굴을 치며) 웃지 마! 나 지금 부끄럽다고 ㅋㅋ'], outgoing: ['…하아. 오늘 밤 진짜 잊지 못할 것 같아요 💗', '(팔에 기대며) 배고프다… 라면 시킬까요? ㅋㅋ'] }), 'shy');
}
async function closeCurtains() { if (RV.curtA) { const z = RV.curtA.scale.z > 1.5 ? 1 : 2.2; RV.curtA.scale.z = RV.curtB.scale.z = z; nSay(z > 1 ? '커튼 치니까 아늑하다…' : '야경 다시 보인다 ㅎㅎ', 'smile'); bump(z > 1 ? 4 : 0); } }
async function candle() { S.mood = 'dim'; applyMood(); try { NC.Audio.playPlaylist('blues'); S.music = 'blues'; } catch (e) { } if (RV.G && !RV.candles) { RV.candles = new T.Group(); const wax = std('#f4ecdc', { roughness: .8 }), fl = new T.MeshBasicMaterial({ color: 0xffb347 }); fl.color.multiplyScalar(2.2); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, c = new T.Mesh(cyl(.03, .03, .1, 10), wax), f = new T.Mesh(new T.SphereGeometry(.014, 8, 6), fl); c.position.set(Math.cos(a) * .4, .05, Math.sin(a) * .4); f.position.set(c.position.x, .12, c.position.z); f.scale.y = 1.8; RV.candles.add(c, f); } RV.candles.position.set(BX - RHX + 1.55, .45, CZ + .9); RV.G.add(RV.candles); }
  nSay(byT({ shy: '…촛불이다. 예쁘다 ㅎㅎ', cool: '분위기 좋네요.', playful: '오 생일이야? ㅋㅋ 농담~ 예쁘다', outgoing: '와 로맨틱하다~ 💗' }), 'shy'); bump(10, 3); }
function messages() { meSay('(폴라로이드 뒷면에 몰래 메시지를 써서 건넨다) 💌'); setTimeout(() => nSay(byT({ shy: '…이거 평생 간직할 거예요.', cool: '…글씨 예쁘네요. 고마워요.', playful: '뭐야 ㅋㅋ 오글거려! …근데 좋다', outgoing: '꺅 감동 ㅠㅠ 나도 써 줄게요!' }), 'shy'), 1500); bump(5, 4); }
function romanticDinner() { if (!NC.Wallet.spend(18)) return toast(L('🪙 코인이 모자라요', '🪙 Not enough coins')); sys(L('📞 프런트에 스테이크·와인 세트를 주문했어요 🪙18', '📞 Ordered a steak & wine set 🪙18')); setTimeout(() => event('e04', true, 'snack'), 5000); bump(6, 3); }

/* ═════════════ 6. 이벤트 e25~e35 (EVENTS 에 추가 — 기존 이벤트 엔진·쿨다운 그대로) ═════════════ */
const ok19 = () => inRoom() && !Z.lie && !Z.pin && !Z.shower && !document.querySelector('.modal') && adultOk();
Object.assign(EVENTS, {
  e25: { ok: () => ok19() && moodNow() > 62 && trustNow() >= 60 && !Z.wet.n && !drunkN() && !meDrunk() && tr(S.n).bd < .6, run: async () => { nSay(byT({ shy: '저기… 샤워, 같이 할래요? …싫으면 그냥 웃어 넘겨요 ㅎㅎ', cool: '…같이 씻을래요?', playful: '샤워 같이 할 사람~? ㅋㅋ 손!', outgoing: '우리 같이 씻을래요? 물 따뜻하대요!' }), 'shy');
    const { val } = await modal(`<h3>🚿 ${nm()}${L('님의 제안', '’s invitation')}</h3>`, [[L('❤️ 좋아요', '❤️ Yes'), 1, true], [L('😊 나중에요', '😊 Maybe later'), 0]]); if (val) showerTogether(true); else { meSay('지금은 괜찮아요. 먼저 씻어요 ㅎㅎ'); nSay('응, 알았어요 ㅎㅎ', 'smile'); bump(0, 2); } } },
  e26: { ok: () => ok19() && moodNow() > 55 && !Z.wear.n && Z.out.n < 3 && S.n.trait !== 'shy', run: async () => { nSay('잠깐만요! 욕실 좀… 눈 감고 기다려요 ㅎㅎ', 'wink'); await wait(1500); await blink(() => setOut('n', Z.out.n, gN() === 'f' ? 'slip' : 'silk'), L('…두근두근', '…')); nSay(byT({ cool: '…어때요. 아무 말 안 하면 서운해요.', playful: '짜잔~~ 서프라이즈! 심장 괜찮아? ㅋㅋ', outgoing: '어때요?! 이거 오늘 몰래 챙겨 왔어요 ㅎㅎ', _: '…어때요?' }), 'shy'); bump(10, 3); } },
  e27: { ok: () => ok19() && Z.drinks.n >= 1 && !drunkN() && !Z.nonAlc.n, run: async () => { nSay('…한 잔만 더 할래요? 미니바에 와인 있던데 ㅎㅎ', 'smile'); const near = Z.drinks.n + 1 >= capN(); const { val } = await modal(`<h3>🍷</h3>`, [[L('🍷 한 잔 더', '🍷 One more'), 1, true], [L(near ? '💧 오늘은 물 마셔요 (말리기)' : '😊 괜찮아요', near ? '💧 Water instead' : '😊 I’m fine'), 0]]);
    if (val) drinkSession(false); else { meSay(near ? '오늘은 많이 마셨어요. 물 마셔요 💧' : '지금은 괜찮아요 ㅎㅎ'); nSay(near ? '…맞아요. 챙겨 줘서 고마워요.' : '응 ㅎㅎ', 'smile'); if (near) { Z.nonAlc.n = true; bump(0, 4); } } } },
  e28: { ok: () => ok19() && Z.games > 0 && Z.wins.me > Z.wins.n, run: async () => { nSay(byT({ shy: '…아까 그 게임, 한 번만 더 해요. 이번엔 안 져요.', cool: '리매치. 거절은 안 받아요.', playful: '복수전이다!! 가위바위보 다시! ㅋㅋㅋ', outgoing: '한 판 더! 이번엔 진짜 이긴다!' }), 'laugh'); const { val } = await modal(`<h3>✊✋✌ ${L('리매치?', 'Rematch?')}</h3>`, [[L('콜!', 'Deal!'), 1, true], [L('다음에요', 'Later'), 0]]); if (val) rpsStrip(); } },
  e29: { ok: () => ok19(), run: async () => { const L2 = NC.world.lights || {}, l = L2.bar, i0 = l && l.intensity; sys(L('⚡ 정전! 비상등도 꺼졌어요… 프런트에서 촛불을 갖다 줬어요 🕯', '⚡ Blackout! The front desk brought candles 🕯')); if (l) l.intensity = .04; await wait(1200); candle(); setTimeout(() => { if (l && S.mood === 'dim') l.intensity = i0 * .45; }, 180000); nSay('…정전 덕분에 분위기 대박이다 ㅎㅎ', 'shy'); bump(15, 2); } },
  e30: { ok: () => ok19() && moodNow() > 50, run: async () => { sys(L('🔊 옆방에서 웃음소리가 크게 들려요…', '🔊 Loud laughter from next door…')); nSay(pick(['…ㅋㅋㅋ 분위기 깨졌다. 벽 진짜 얇다~', '옆방 너무 신났다 ㅋㅋㅋ 우리도 조용히 해야겠다']), 'laugh'); bump(-5, 1); setTimeout(() => nSay('그래도 덕분에 웃었다 ㅎㅎ', 'smile'), 3500); } },
  e31: { ok: () => ok19() && moodNow() > 68 && trustNow() >= 60 && Z.out.n < 3 && !drunkN(), run: () => npcAsksUnzip() },
  e32: { ok: () => ok19() && Z.out.n >= 3 && tr(S.n).bd > .45 && !adminMax(), run: async () => { nSay('…저기. 오늘은 여기까지만 하고 싶어요. 이상하게 생각하지 마요.', 'shy'); const { val } = await modal(`<h3>🙏 ${L('상대의 마음', 'Their feelings')}</h3>`, [[L('응, 고마워요 말해 줘서', 'Thanks for telling me'), 1, true], [L('…왜요? (서운해하기)', '…Why? (sulk)'), 0]]);
    if (val) { meSay('응, 알겠어요. 말해 줘서 고마워요.'); nSay('…그래서 당신이 좋아요 💗', 'smile'); memOf(S.n).trust = Math.min(100, memOf(S.n).trust + 5); bump(3, 8); await dressPartner(); } else { nSay('…그냥 그렇다고요. 서운해하면 저 더 불편해요.', 'sad'); bump(-10, -10); } save(); } },
  e34: { ok: () => ok19() && Z.pm && S.stay === 'night', run: async () => { await blink(() => { setOut('me', Math.min(Z.out.me, 4), 'robe'); setOut('n', Math.min(Z.out.n, 4), 'robe'); }); const s = RV.spots.window; NC.walkPlayer([{ x: BX + s.x + .2, z: CZ + s.z + .3 }], () => {}); placePartner(BX + s.x + .2, CZ + s.z - .3, -Math.PI / 2);
    nSay(byT({ shy: '…새벽이다. 우리, 내일도 연락하는 거죠?', cool: '이런 얘기 잘 안 하는데… 당신이랑은 계속 보고 싶어요.', playful: '새벽 감성 ON ㅋㅋ …근데 진심이야, 오늘 고마워.', outgoing: '해 뜨기 전 하늘 예쁘다… 우리 다음엔 바다 가요!' }), 'shy'); bump(4, 6); } },
  e35: { ok: () => ok19() && trustNow() < 40 && S.comfort < 50 && !adminMax(), run: () => event('e09', true) },
});
/* 아침(기존 e11 확장) — 같이 일어나기 · 커피 · 조식 · 어젯밤 이야기 · 아침 사진 · 모닝 샤워 · 옷 · 짐 · 연락처 · 연장 · 작별 · 체크아웃 */
EVENTS.e11 = { ok: () => false, run: async () => {
  const n = S.n; if (!n || S.alone) return; Z.drinks = { me: 0, n: 0 }; Z.nonAlc = { me: false, n: false }; n.drunk = false; if (NC.Life) NC.Life.tipsy = Math.max(0, (NC.Life.tipsy || 0) - 3);   // 자고 나면 술이 깸
  const apart = S.space; if (!apart) { lie({ me: { x: -.33 }, n: { x: .33 }, sheet: true }); } await wait(800);
  const wantLeave = !adminMax() && (trustNow() < 50 || (U.hash(n.name + new Date().toDateString()) % 4 === 0));
  nSay(Z.pm ? byT({ shy: '…좋은 아침. (이불을 끌어올리며) 어젯밤… 꿈 아니죠?', cool: '…일어났어요? 커피 마실래요?', playful: '굿모닝~ 머리 완전 폭탄이다 ㅋㅋㅋ', outgoing: '좋은 아침이에요 💗 잘 잤어요?' }) : pick(['잘 잤어요? 머리 엄청 뻗쳤다 ㅋㅋㅋ', '…좋은 아침이에요. 햇빛 들어오니까 기분 좋다.']), 'smile');
  if (wantLeave) setTimeout(() => nSay('저… 오전에 일이 있어서 조금 일찍 나가야 할 것 같아요.', 'sad'), 2500);
  let packed = false;
  for (let i = 0; i < 16; i++) {
    const { val } = await modal(`<h3>☀️ ${L('아침', 'Morning after')}</h3><p style="opacity:.8">${L('나', 'Me')}: ${stateTxt('me')} · ${nm()}: ${stateTxt('n')}</p>`, [[L('☀️ 기지개 켜고 일어나기', '☀️ Stretch & get up'), 'wake', true], [L('😚 모닝 키스', '😚 Morning kiss'), 'mkiss'], [L('☕ 모닝커피 🪙6', '☕ Coffee 🪙6'), 'coffee'], [L('🍳 아침 식사 🪙12', '🍳 Breakfast 🪙12'), 'bf'], [L('💬 어젯밤 이야기', '💬 About last night'), 'talk'], [L('📸 아침 사진', '📸 Morning photo'), 'photo'], [L('🚿 모닝 샤워', '🚿 Morning shower'), 'shower'], [L('👗 원래 옷으로', '👗 Get dressed'), 'dress'], [L('🧳 짐 챙기기', '🧳 Pack up'), 'pack'], [L('📱 연락처 교환', '📱 Swap numbers'), 'num'], [L('⏰ 더 있다 가자', '⏰ Stay longer'), 'ext'], [L('❤️ 작별 인사 · 체크아웃', '❤️ Goodbye & check out'), 'out'], [L('닫기 (자유롭게)', 'Close (free roam)'), 0]]);
    if (!val) break;
    if (val === 'wake') { unlie(); tryG(P().group, 'stretch'); tryG(n.g, 'stretch'); nSay('으~~ 잘 잤다!', 'smile'); }
    else if (val === 'mkiss') { const r = await ask('morningKiss', { yes: false }); if (r !== 'no') { unlie(); await standAct('cheek'); await wait(2400); endStanding(); nSay('…양치 먼저 하지 ㅎㅎ 그래도 좋다.', 'laugh'); } }
    else if (val === 'coffee') { if (!NC.Wallet.spend(6)) toast(L('🪙 코인이 모자라요', '🪙 Not enough coins')); else { sys(L('☕ 커피 두 잔 주문', '☕ Two coffees ordered')); await wait(1500); P().group.userData.holdGlass = n.g.userData.holdGlass = true; tryG(P().group, 'drink'); tryG(n.g, 'drink'); nSay('모텔 커피 믹스 맛 최고 ㅋㅋ', 'laugh'); setTimeout(() => { P().group.userData.holdGlass = n.g.userData.holdGlass = false; }, 2500); } }
    else if (val === 'bf') { unlie(); roomService('breakfast'); await wait(1500); }
    else if (val === 'talk') { meSay('어젯밤… 어땠어요?'); await wait(900); nSay(Z.pm ? byT({ shy: '…그걸 지금 물어보면 어떡해요 ㅎㅎ 좋았어요. 많이.', cool: '…또 이러자는 말로 들을게요.', playful: '별 다섯 개! …아니 여섯 개 ㅋㅋ', outgoing: '최고였어요! 다음 데이트는 언제예요?' }) : Z.games ? `가위바위보 진짜 웃겼어요 ㅋㅋ ${Z.wins.n > Z.wins.me ? '제가 이겼죠?' : '다음엔 꼭 이길 거예요!'}` : Object.keys(Z.lim).length ? '천천히 해 줘서 고마웠어요. 그래서 편했어요.' : '얘기 많이 해서 좋았어요. 이런 밤 처음이에요 ㅎㅎ', 'shy'); bump(2, 4); }
    else if (val === 'photo') couplePhoto();
    else if (val === 'shower') { unlie(); const { val: w } = await modal(`<h3>🚿</h3>`, [[L('혼자 씻기', 'Alone'), 'me', true], [L('같이 씻자고 하기', 'Together'), 'both'], [L('먼저 씻으라고 하기', 'You first'), 'n']]); if (w === 'me') await showerMe(); else if (w === 'both') await showerTogether(); else if (w === 'n') await showerN(); }
    else if (val === 'dress') { unlie(); await redressAll(); }
    else if (val === 'pack') { unlie(); packed = true; tryG(P().group, 'pickup'); tryG(n.g, 'pickup'); nSay('귀걸이 한 짝 어디 갔지… 아 찾았다 ㅎㅎ', 'smile'); }
    else if (val === 'num') { const m = memOf(n); if (m.num) nSay('이미 저장했잖아요 ㅎㅎ 연락할게요!', 'laugh'); else { m.num = true; save(); nSay(byT({ shy: '…제 번호예요. 먼저 연락해 줘요 ㅎㅎ', cool: '저장해 둘게요. 연락해요.', playful: '내 번호 외워! ㅋㅋ 시험 본다~', outgoing: '번호 줘요! 오늘 사진 보내 줄게요!' }), 'smile'); n.aff = Math.min(100, n.aff + 2); } }
    else if (val === 'ext') { if (wantLeave) { const stay = trustNow() >= 70 || adminMax(); nSay(stay ? '…음, 한 시간만이에요? 그럼 저도 좀 더 있을래요 ㅎㅎ' : '미안해요… 저는 정말 가 봐야 해요. 당신은 더 쉬다 가요 💗', stay ? 'smile' : 'sad'); if (!stay) { await wait(1500); return event('e09', true); } } if (!NC.Wallet.spend(15)) toast(L('🪙 코인이 모자라요', '🪙 Not enough coins')); else { S.endMin += 60; updBar(); sys(L('⏰ 1시간 연장했어요', '⏰ Extended 1 hour')); } }
    else if (val === 'out') { unlie(); if (Z.out.me || Z.out.n || Z.wear.me || Z.wear.n) await redressAll(); if (!packed) nSay('짐 다 챙겼죠? ㅎㅎ', 'smile'); await wait(800); meSay(pick(['오늘 정말 고마웠어요.', '조심히 가요. 연락할게요.'])); nSay(byT({ shy: '…저도요. 또 봐요 💗', cool: '좋은 밤이었어요. 또 봐요.', playful: '다음엔 내가 이긴다! 안녕~ ㅋㅋ', outgoing: '최고의 밤이었어요! 또 만나요 💗' }), 'smile'); await wait(1500); return checkout(); }
  }
} };

/* ═════════════ 7. UI — 「🔥 19+ 프라이빗」 접이식 섹션 ═════════════ */
const ok = () => '';   // 사용 가능
const lockBody = () => drunkN() || S.n.drunk ? L('🥴 상대가 많이 취했어요', '🥴 Partner is drunk') : meDrunk() ? L('🥴 내가 많이 취했어요', '🥴 You are drunk') : '';
const GROUPS = [
  ['shower', L('🚿 샤워 · 욕실', '🚿 Shower & bath'), [
    ['showerMe', L('🚿 혼자 샤워하기', '🚿 Take a shower'), showerMe, ok],
    ['showerN', L('🚿 먼저 씻으라고 권하기', '🚿 Offer them the shower'), showerN, ok],
    ['showerTo', L('💑 같이 샤워하자고 하기', '💑 Shower together'), () => showerTogether(), lockBody],
    ['lotion', L('🧴 바디로션 바르기', '🧴 Body lotion'), lotion, ok]]],
  ['wear', L('👙 속옷 · 나이트웨어', '👙 Underwear & nightwear'), [
    ['wearMenu', L('👗 갈아입기(가운·슬립·잠옷·속옷)', '👗 Change (robe/slip/PJs/underwear)'), wearMenu, ok],
    ['pjs', L('💑 커플 잠옷 맞춰 입기', '💑 Matching couple PJs'), () => changeTo('both', 'pajama'), ok],
    ['surprise', L('🎀 깜짝 나이트웨어', '🎀 Surprise nightwear'), surpriseNight, ok],
    ['askOutfit', L('💬 뭐 입을지 물어보기', '💬 Ask what to wear'), askOutfit, ok],
    ['cphoto', L('📸 가운 차림 커플 사진', '📸 Couple photo in robes'), couplePhoto, () => (Z.out.me >= 4 || Z.out.n >= 4) ? L('속옷 차림에선 사진 금지', 'No photos in underwear') : ''],
    ['redress', L('🧥 둘 다 원래 옷 입기', '🧥 Both get dressed'), redressAll, ok]]],
  ['drink', L('🥂 둘만의 술자리', '🥂 Drinks for two'), [
    ['drink', L('🍾 미니바 열고 한잔', '🍾 Open the minibar'), () => drinkSession(false), ok],
    ['underDrink', L('👙 속옷만 입고 둘이 술 마시기', '👙 Drinks in underwear'), () => drinkSession(true), ok],
    ['bunny', L('🐰 바니바니 술게임', '🐰 Bunny drinking game'), bunny, ok]]],
  ['game', L('🎮 커플 게임', '🎮 Couple games'), [
    ['rps', L('✊✋✌ 가위바위보 옷 벗기 게임', '✊✋✌ Strip rock-paper-scissors'), rpsStrip, lockBody],
    ['truth', L('❓ 진실 혹은 도전', '❓ Truth or dare'), truthDare, ok],
    ['dice', L('🎲 커플 주사위 미션', '🎲 Couple dice'), diceMission, ok]]],
  ['undress', L('👗 옷 벗기 · 입혀 주기 (단계마다 동의)', '👗 Undress / dress (consent each step)'), [
    ['undressN', () => Z.out.n >= 5 ? L('👗 (더 벗을 옷 없음)', '👗 (nothing left)') : L(`👗 ${S.n.name}님 ${ITEM[gN()][Z.out.n + 1]} 벗겨 주기`, `👗 Help remove their ${ITEM[gN()][Z.out.n + 1]}`), undressPartner, () => lockBody() || (Z.out.n >= 5 ? L('더 벗을 옷이 없어요', 'Nothing left') : '')],
    ['undressMe', () => Z.out.me >= 5 ? L('👕 (더 벗을 옷 없음)', '👕 (nothing left)') : L(`👕 내 ${ITEM[gP()][Z.out.me + 1]} 벗기`, `👕 Remove my ${ITEM[gP()][Z.out.me + 1]}`), undressMe, () => lockBody() || (Z.out.me >= 5 ? L('더 벗을 옷이 없어요', 'Nothing left') : '')],
    ['dressN', L('🧥 가운 걸쳐 주기', '🧥 Drape a robe on them'), dressPartner, ok]]],
  ['touch', L('💆 마사지 · 스킨십', '💆 Massage & touch'), [
    ['massage', L('💆 어깨 마사지', '💆 Shoulder massage'), massage, lockBody],
    ['oil', L('🧴 오일 등 마사지(엎드려)', '🧴 Oil back massage'), oilMassage, lockBody],
    ['feed', L('🍓 딸기 먹여 주기', '🍓 Feed strawberries'), feed, ok],
    ['ice', L('🧊 얼음 장난', '🧊 Ice-cube prank'), ice, lockBody],
    ['slow', L('💃 슬로우댄스', '💃 Slow dance'), () => slowDance(), lockBody],
    ['lie', L('🛏 침대에 함께 눕기', '🛏 Lie down together'), lieTogether, lockBody],
    ['armp', L('😌 팔베개 · 마주 보고 눕기', '😌 Arm pillow, face to face'), lieCuddle, lockBody],
    ['lkiss', L('💋 침대 위 키스', '💋 Kiss in bed'), lieKiss, lockBody],
    ['eyes', L('🙈 눈 가리고 누구게?', '🙈 Guess who'), blindGuess, lockBody],
    ['whisper', L('🤫 귓속말', '🤫 Whisper'), whisper, lockBody],
    ['joke', L('😏 야한 농담', '😏 Cheeky joke'), naughtyJoke, ok]]],
  ['jac', L('🛁 자쿠지 · 거품 목욕', '🛁 Jacuzzi & bubbles'), [
    ['jacFill', L('🛁 자쿠지 물 받기', '🛁 Fill the jacuzzi'), jacFill, ok],
    ['jacFoam', L('🫧 거품·장미 꽃잎 넣기', '🫧 Bubbles & petals'), jacFoam, ok],
    ['jacIn', L('💑 함께 들어가기', '💑 Get in together'), jacIn, lockBody]]],
  ['night', L('🌙 둘만의 밤', '🌙 Night for two'), [
    ['candle', L('🕯 촛불 켜기', '🕯 Light candles'), candle, ok],
    ['curtain', L('🌙 커튼 치기 / 걷기', '🌙 Curtains'), closeCurtains, ok],
    ['msg', L('💌 폴라로이드 메시지', '💌 Polaroid message'), messages, ok],
    ['dinner', L('🥂 로맨틱 디너 주문 🪙18', '🥂 Romantic dinner 🪙18'), romanticDinner, ok],
    ['pm', L('🌙 둘만의 시간 (서로 동의 · 암전)', '🌙 Private moment (mutual · fade)'), privateMoment, () => lockBody()]]],
];
const lab = it => typeof it[1] === 'function' ? it[1]() : it[1];
S.extActs = []; GROUPS.forEach(([, , list]) => list.forEach(it => S.extActs.push(['x19_' + it[0], '', async () => { if (Z.running) { toast(L('⏳ 지금 하는 걸 먼저 마쳐요 (⏹ 그만으로 멈출 수 있어요)', '⏳ Finish the current activity first')); return; } const why = it[3] && it[3](); if (why) { toast(why); nSay(why.includes('취') ? '오늘은 이런 건 안 할래요. 맨정신일 때 해요 💧' : '…지금은 안 돼요 ㅎㅎ', 'smile'); return; } Z.running = true; try { await it[2](); } catch (e) { console.error('[motel19]', it[0], e); } finally { Z.running = false; } renderIfOpen(); }])));
const renderIfOpen = () => { if (panel.style.display === 'flex') renderPanel(); };
S.extPanel = () => {
  if (S.step !== 'room' || !S.n) return ''; const chip = `<div class="m19c">${L('나', 'Me')}: ${stateTxt('me')} · ${esc(S.n.name)}: ${stateTxt('n')} · 🍷 ${Z.drinks.me}/${Z.drinks.n}${drunkN() || S.n.drunk ? ' 🥴' : ''} · 🔥 ${L('분위기', 'Mood')} ${moodNow()}</div>`;
  if (!adultOk()) return `<h4 class="m19h">🔥 19+ ${L('프라이빗', 'Private')}</h4><div class="g"><button data-a="x19adult">🔞 ${L('성인 확인 후 열기', 'Verify age to open')}</button></div>`;
  return `<details class="m19" ${Z.open._root ? 'open' : ''} data-k="_root"><summary>🔥 19+ ${L('프라이빗 익스피리언스', 'Private experience')} <small>${L('(행위마다 동의 · 언제든 ⏹)', '(consent each · stop anytime)')}</small></summary>${chip}
    ${GROUPS.map(([k, t, list]) => `<details class="m19s" ${Z.open[k] ? 'open' : ''} data-k="${k}"><summary>${t}</summary><div class="g">${list.map(it => { const why = it[3] && it[3](); return `<button data-a="x19_${it[0]}" class="${why ? 'off' : ''}" title="${esc(why || '')}">${esc(lab(it))}</button>`; }).join('')}</div></details>`).join('')}</details>`;
};
S.extClick = id => { if (/^x19_/.test(id) && Z.running) { toast(L('⏳ 지금 하는 걸 먼저 마치거나 ⏹ 그만을 눌러요', '⏳ Finish the current activity or press ⏹ Stop')); return true; } if (id === 'x19adult') { verifyAdult().then(okk => { if (okk) { Z.open._root = true; renderPanel(); } }); return true; } return false; };
panel.addEventListener('toggle', e => { const d = e.target; if (d.tagName === 'DETAILS' && d.dataset.k) { Z.open[d.dataset.k] = d.open; U.store.set('nc_m19open', Z.open); } }, true);
const css = document.createElement('style'); css.textContent = `
#motelPanel details.m19{border:1px solid rgba(255,80,120,.45);border-radius:12px;padding:6px 8px;background:linear-gradient(180deg,rgba(60,0,24,.55),rgba(20,4,16,.4))}
#motelPanel details.m19>summary{cursor:pointer;color:#ff7a9a;font-weight:800;list-style:none}#motelPanel details.m19>summary small{opacity:.7;font-weight:600}
#motelPanel details.m19s{margin:6px 0 2px;border-top:1px solid rgba(255,255,255,.08);padding-top:4px}#motelPanel details.m19s>summary{cursor:pointer;color:#ffc2d4;font-size:12.5px}
#motelPanel .g button.off{opacity:.45}#motelPanel .m19c{font-size:11.5px;opacity:.85;margin:4px 0}
.m19f{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:8px 0;font-size:13px;text-align:left}.m19f b{min-width:70px;color:#ffb3c8}.m19f label{display:flex;gap:4px;align-items:center;cursor:pointer}
`; document.head.appendChild(css);
/* ⏸ 잠깐 버튼 */
const pb = document.createElement('button'); pb.id = 'mPause'; pb.textContent = L('⏸ 잠깐', '⏸ Pause'); const ms = bar.querySelector('#mStop'); if (ms) bar.insertBefore(pb, ms);
pb.onclick = () => { if (!inRoom()) return; Z.paused = !Z.paused; pb.textContent = Z.paused ? L('▶ 계속', '▶ Resume') : L('⏸ 잠깐', '⏸ Pause'); nSay(Z.paused ? pick(['응, 잠깐 쉬어요 ㅎㅎ', '천천히 해요. 숨 좀 고르고 ㅎㅎ']) : '응 ㅎㅎ', 'smile'); if (Z.paused && Z.touch) Z.touch.dur = Math.min(Z.touch.dur, Z.touch.t + .5); };

/* ═════════════ 8. 수명 주기 · 매 프레임 ═════════════ */
S.onBuild = onBuild;
S.onRoom = () => { resetZ(); refreshAll(); };
S.onStop = silent => stopAll(silent);
S.onCheckout = () => { stopAll(true); if (S.n) { S.n.drunk = false; S.n.g.userData.handPose = null; clearGarment(S.n.g); S.n.g.rotation.x = S.n.g.rotation.z = 0; } clearGarment(P().group); P().group.rotation.x = P().group.rotation.z = 0; Z.jac = { fill: 0, on: false, in: false, foam: false }; Z.out = { me: 0, n: 0 }; Z.wear = { me: '', n: '' }; if (RV.candles) RV.candles = null; };
let acc = 0;
NC.tickers.push(dt => {
  if (!dt || !S.on) return; dt = Math.min(dt, .1);
  if (S.step === 'room' || S.step === 'morning') { slideTick(dt); pinTick(); lieTick(); touchTick(dt); bathTick(dt); garmentTick();
    if (Z.jac.filling && RV.water) { Z.jac.fill = Math.min(1, (performance.now() - Z.jac.filling) / 18000); RV.water.position.y = .1 + .4 * Z.jac.fill; if (Z.jac.fill >= 1) { Z.jac.filling = false; waterSound(false); sys(L('🛁 자쿠지에 물이 가득 찼어요', '🛁 The jacuzzi is full')); } }
    acc += dt; if (acc > .6) { acc = 0; refreshAll(); } }
  else if (S.step === 'leaving' && (P().group.userData.m19 || (S.n && S.n.g.userData.m19))) S.onCheckout();
});
S.x19 = { Z, ask, refreshAll, visualOf, stopAll, GROUPS, lie, unlie, buildGarment, clearGarment, bonesOf };   // 시험·확장용
console.info('[motel19] v60 🔥 19+ 프라이빗 익스피리언스 — 객실 전용');
})();
