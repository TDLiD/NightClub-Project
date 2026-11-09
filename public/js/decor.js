/* decor.js — v12 공간 실사화 디테일 (조명 추가 없이 발광 재질 + 블룸으로 표현 → CPU/GPU 부담 최소)
 *  스테이지: 바닥 모니터 스피커 4 · 마이크 스탠드 · 무대 앞 LED 엣지 · 바닥 연무 · CO₂ 분사기(골든벨/주기적 분사)
 *  VIP 룸: 벽 아트 액자 · 러그 · 소파 하부 LED 라인        노래방: 미러볼 · 흡음 패널 · 탬버린·리모컨·책 · 네온 사인
 *  화장실: 벽 타일 · 거울 전구 · 페이퍼타월 디스펜서 · 휴지통
 */
(() => {
'use strict';
const NC = window.NC, T = window.THREE, W = NC.world, U = NC.util, S = NC.scene;
const std = (c, o = {}) => NC.mat && NC.mat.std ? NC.mat.std(c, o) : new T.MeshStandardMaterial(Object.assign({ color: c }, o));
const pbr = (n, o) => NC.mat && NC.mat.pbr ? NC.mat.pbr(n, o) : std(o.color || '#888');
const emi = (c, k = 2) => { const m = new T.MeshBasicMaterial({ color: c }); m.color.multiplyScalar(k); return m; };
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
const clubG = new T.Group(); clubG.name = 'decor'; S.add(clubG);
const put = (g, m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };

/* ── 스테이지 ── */
const Z = W.zones.stage, SY = Z.y, FRONT = Z.z1;
const grill = pbr('grill', { repeat: [2, 1], roughness: .6, metalness: .3, color: '#3a3a42' }), black = std('#121216', { roughness: .45, metalness: .25 }), chrome = std('#d8dce4', { roughness: .15, metalness: 1 });
[-7, -2.6, 2.6, 7].forEach(x => {                        // 바닥 모니터(웨지) 스피커
  const w = new T.Group(); const body = new T.Mesh(box(.62, .34, .48), black); body.rotation.x = -.45; w.add(body);
  const face = new T.Mesh(new T.PlaneGeometry(.56, .3), grill); face.position.set(0, .03, .2); face.rotation.x = -.45 - Math.PI * 0; face.rotation.x = -.45 + 0; face.lookAt(0, .6, 2); w.add(face);
  put(clubG, w, x, SY + .17, FRONT - .45, Math.PI);
});
{ const mic = new T.Group(); mic.add(new T.Mesh(new T.CylinderGeometry(.16, .18, .03, 20), black));            // 마이크 스탠드
  const pole = new T.Mesh(new T.CylinderGeometry(.012, .012, 1.45, 8), chrome); pole.position.y = .72; mic.add(pole);
  const boom = new T.Mesh(new T.CylinderGeometry(.009, .009, .45, 8), chrome); boom.position.set(0, 1.45, .16); boom.rotation.x = 1.1; mic.add(boom);
  const head = new T.Mesh(new T.SphereGeometry(.035, 12, 8), grill); head.position.set(0, 1.55, .36); mic.add(head);
  put(clubG, mic, 0, SY, FRONT - 1.0, Math.PI); W.circles.push([0, FRONT - 1.0, .18]); }
const edge = new T.Mesh(box(Z.x1 - Z.x0, .035, .035), emi('#ff3d9a', 2.2)); put(clubG, edge, 0, SY - .02, FRONT + .02);   // 무대 앞 LED 엣지
const edgeMat = edge.material;
// 바닥 연무 (저공 스모그 — 무대 위로 낮게 깔리는 반투명 스프라이트)
const hazeTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); return new T.CanvasTexture(cv); })();
const haze = []; for (let i = 0; i < 12; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: hazeTex, color: 0xd8c8ff, transparent: true, opacity: .16, depthWrite: false, blending: T.AdditiveBlending }));
  sp.scale.set(3.4, 1.0, 1); sp.userData.ph = Math.random() * 10; sp.userData.x0 = Z.x0 + 1 + Math.random() * (Z.x1 - Z.x0 - 2); sp.position.set(sp.userData.x0, SY + .25, Z.z0 + 1.5 + Math.random() * (Z.z1 - Z.z0 - 2)); clubG.add(sp); haze.push(sp); }
// CO₂ 분사기 (무대 양 끝)
const jets = [-10.3, 10.3].map(x => { const j = new T.Mesh(new T.CylinderGeometry(.09, .12, .5, 14), black); put(clubG, j, x, SY + .25, FRONT - .5); const nz = new T.Mesh(new T.CylinderGeometry(.05, .07, .08, 12), chrome); put(clubG, nz, x, SY + .54, FRONT - .5);
  const plume = []; for (let k = 0; k < 7; k++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: hazeTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); sp.position.set(x, SY + .6, FRONT - .5); clubG.add(sp); plume.push(sp); }
  return { x, plume, t: 0 }; });
let jetT = 0; const fireCO2 = () => { jets.forEach(j => j.t = 1.6); if (NC.Audio && NC.Audio.ctx) { const C = NC.Audio.ctx, t = C.currentTime, n = C.createBufferSource(), b = C.createBuffer(1, C.sampleRate * 1.2, C.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); n.buffer = b; const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800; const g = C.createGain(); g.gain.value = .12; n.connect(f); f.connect(g); g.connect(NC.Audio.master); n.start(t); } };
NC.fireCO2 = fireCO2;
if (NC.Nightlife && NC.Nightlife.ringBell) { const orig = NC.Nightlife.dash; NC.Nightlife.dash = (...a) => { fireCO2(); return orig(...a); }; }

/* ── VIP 룸 ── */
const artTex = seed => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const c = cv.getContext('2d'), r = U.rng ? U.rng(seed) : Math.random;
  const g = c.createLinearGradient(0, 0, 256, 160); g.addColorStop(0, `hsl(${seed * 77 % 360},55%,18%)`); g.addColorStop(1, `hsl(${(seed * 77 + 60) % 360},65%,32%)`); c.fillStyle = g; c.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 14; i++) { c.globalAlpha = .35 + r() * .5; c.fillStyle = `hsl(${(seed * 50 + i * 40) % 360},80%,${50 + r() * 25}%)`; c.beginPath(); c.arc(r() * 256, r() * 160, 8 + r() * 46, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1; c.strokeStyle = 'rgba(255,230,170,.7)'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(0, r() * 160); c.bezierCurveTo(80, r() * 160, 170, r() * 160, 256, r() * 160); c.stroke(); }
  const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; return t; };
const gold = std('#d8b060', { roughness: .25, metalness: 1 });
W.vip.forEach((v, i) => {
  const zb = v.z1 - .06;
  const fr = new T.Mesh(box(1.9, 1.25, .05), gold); put(clubG, fr, v.cx - 1.6, 2.35, zb - .02);
  const art = new T.Mesh(new T.PlaneGeometry(1.75, 1.1), new T.MeshStandardMaterial({ map: artTex(i * 7 + 3), roughness: .6 })); put(clubG, art, v.cx - 1.6, 2.35, zb - .05, Math.PI);
  const fr2 = new T.Mesh(box(1.0, 1.4, .05), gold); put(clubG, fr2, v.cx + 2.3, 2.3, zb - .02);
  const art2 = new T.Mesh(new T.PlaneGeometry(.88, 1.28), new T.MeshStandardMaterial({ map: artTex(i * 11 + 5), roughness: .6 })); put(clubG, art2, v.cx + 2.3, 2.3, zb - .05, Math.PI);
  const rug = new T.Mesh(new T.PlaneGeometry(4.2, 2.8), pbr('carpet', { repeat: [3, 2], roughness: 1, color: ['#4a2a6a', '#5a3a1a', '#5a1a3a'][i % 3] })); rug.rotation.x = -Math.PI / 2; put(clubG, rug, v.cx, .012, (v.z0 + v.z1) / 2 + .6);
  const led = new T.Mesh(box(v.x1 - v.x0 - .6, .025, .025), emi(v.color || '#b07cff', 1.8)); put(clubG, led, v.cx, .05, zb - .5);
});

/* ── 노래방 ── */
const K = NC.Karaoke;
if (K && K.G && K.dims) { const { KX, KZ, HX, HZ, H } = K.dims, G = K.G, kp = (m, x, y, z, ry = 0) => put(G, m, KX + x, y, KZ + z, ry);
  // 미러볼
  const facet = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = 150 + Math.random() * 105; c.fillStyle = `rgb(${v},${v},${v + 10})`; c.fillRect(x * 8, y * 8, 7, 7); } const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 2); return t; })();
  const ball = new T.Mesh(new T.SphereGeometry(.24, 24, 16), new T.MeshStandardMaterial({ map: facet, roughness: .05, metalness: 1, envMapIntensity: 2.5, emissive: 0x332244, emissiveMap: facet }));
  kp(ball, .4, H - .5, .2); const rod = new T.Mesh(new T.CylinderGeometry(.008, .008, .26, 6), chrome); kp(rod, .4, H - .13, .2); K.ball = ball;
  // 흡음 패널(패브릭)
  const fab = pbr('fabric', { repeat: [1, 1], roughness: 1, color: '#3a1a4a' }), fab2 = pbr('fabric', { repeat: [1, 1], roughness: 1, color: '#1a2a4a' });
  for (let k = 0; k < 3; k++) { kp(new T.Mesh(box(.06, 1.1, .8), k % 2 ? fab2 : fab), HX - .04, 1.7, -2 + k * 1.3); kp(new T.Mesh(box(.06, 1.1, .8), k % 2 ? fab : fab2), -HX + .04, 1.7, -2 + k * 1.3); }
  // 탬버린 · 리모컨 · 노래책
  const tam = new T.Group(); tam.add(new T.Mesh(new T.TorusGeometry(.1, .018, 8, 20), std('#d22a3a', { roughness: .4 }))); for (let k = 0; k < 5; k++) { const j = new T.Mesh(new T.CylinderGeometry(.018, .018, .006, 10), gold); j.position.set(Math.cos(k * 1.256) * .1, Math.sin(k * 1.256) * .1, 0); j.rotation.x = Math.PI / 2; tam.add(j); }
  tam.rotation.x = -Math.PI / 2; kp(tam, -1.2, .51, .85);
  kp(new T.Mesh(box(.05, .02, .17), std('#1c1c22', { roughness: .4 })), -1.6, .5, .45, .4);
  const book = new T.Mesh(box(.24, .035, .32), std('#c8102e', { roughness: .5 })); kp(book, -2.6, .51, .7, -.25);
  const bt = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 170; const c = cv.getContext('2d'); c.fillStyle = '#c8102e'; c.fillRect(0, 0, 128, 170); c.fillStyle = '#ffd23d'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('노래책', 64, 70); c.font = '15px sans-serif'; c.fillText('최신 인기곡', 64, 100); return new T.CanvasTexture(cv); })();
  const cover = new T.Mesh(new T.PlaneGeometry(.23, .31), new T.MeshBasicMaterial({ map: bt })); cover.rotation.x = -Math.PI / 2; kp(cover, -2.6, .53, .7, 0); cover.rotation.z = .25;
  if (NC.neonSign) { const s = NC.neonSign('♪ SING! SING! ♪', 2.2, .42, { font: '900 90px Arial', color: '#fff4fb', glow: '#ff3d9a', ph: 200 }); s.rotation.y = -Math.PI / 2; kp(s, HX - .08, 2.6, 1.6); }
}

/* ── 화장실 ── */
const RR = NC.Rooms && NC.Rooms.restroom;
if (RR) { const tile = pbr('marble', { repeat: [6, 2], roughness: .25, gen: { a: '#e8e6ee', b: '#b8b4c4', tiles: 6 } });
  const wall = new T.Mesh(new T.PlaneGeometry(RR.hx * 2 - .1, 1.3), tile); RR.add(wall, 0, .66, -RR.hz + .03);                    // 하단 타일 벽(뒷벽)
  const w2 = new T.Mesh(new T.PlaneGeometry(RR.hz * 2 - .1, 1.3), tile); w2.rotation.y = -Math.PI / 2; RR.add(w2, RR.hx - .03, .66, 0);
  const bulb = emi('#fff2d0', 2.6), bg = new T.SphereGeometry(.035, 10, 8);
  for (let k = 0; k < 12; k++) RR.add(new T.Mesh(bg, bulb), -2.85 + k * .335, 2.6, 3.34);                                 // 거울 전구(분장실 스타일)
  for (let k = 0; k < 4; k++) { RR.add(new T.Mesh(bg, bulb), -3.05, 1.3 + k * .33, 3.34); RR.add(new T.Mesh(bg, bulb), 1.05, 1.3 + k * .33, 3.34); }
  RR.add(new T.Mesh(box(.3, .38, .12), chrome), 1.45, 1.35, 3.33);                                                           // 페이퍼타월 디스펜서
  RR.add(new T.Mesh(box(.18, .02, .06), std('#f4f4f4')), 1.45, 1.15, 3.28);
  RR.add(new T.Mesh(new T.CylinderGeometry(.16, .13, .42, 16, 1, true), std('#2a2a30', { roughness: .3, metalness: .6, side: T.DoubleSide })), 1.0, .21, 2.95);   // 휴지통
}

/* ── 애니메이션 (가벼운 1틱) ── */
NC.tickers.push(dt => {
  const t = performance.now() / 1000;
  if (clubG.visible) {
    haze.forEach(sp => { const ph = sp.userData.ph; sp.position.x = sp.userData.x0 + Math.sin(t * .15 + ph) * 1.2; sp.material.opacity = .1 + .06 * Math.sin(t * .4 + ph); });
    const th = W.THEMES && W.themeId && W.THEMES[W.themeId], gc = th && th.glow ? th.glow[Math.floor(t * .5) % th.glow.length] : '#ff3d9a'; edgeMat.color.set(gc).multiplyScalar(2.2);
    if ((jetT -= dt) <= 0) { jetT = 38 + Math.random() * 25; if (NC.player && NC.player.zone === 'stage' || Math.random() < .5) fireCO2(); }
    jets.forEach(j => { if (j.t > 0) j.t -= dt; j.plume.forEach((sp, k) => { const e = 1.6 - j.t, a = j.t > 0 ? Math.min(1, j.t * 2) : 0, hgt = (e * 3.2 + k * .38) % 3.4; sp.position.y = SY + .6 + hgt; sp.position.x = j.x + Math.sin(k * 2.1 + t) * .08 * hgt; const sc = .3 + hgt * .45; sp.scale.set(sc, sc, 1); sp.material.opacity = a * .55 * (1 - hgt / 3.4); }); });
  }
  if (K && K.ball && K.inRoom) K.ball.rotation.y += dt * .6;
});
console.info('[decor] 공간 디테일: 스테이지 모니터·연무·CO₂ · VIP 아트·러그 · 노래방 미러볼·패널 · 화장실 타일·거울 전구');
})();
