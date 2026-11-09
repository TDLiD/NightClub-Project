/* rooms.js — 부속 공간: 🚻 화장실 · 🚬 흡연실 (v8)
 *  ■ 화장실(통로 동쪽 끝 문): 칸 3개 · 소변기 2개 · 세면대 3개 · 대형 거울 · 핸드 드라이어
 *    칸 이용(볼일) → 🚻 화장실 신호 해소 · 취기 약간 감소 / 손 씻기·거울 → ✨ 매무새(다음 대화 첫인상 +)
 *  ■ 흡연실(서쪽 벽 무대 옆 문): 유리 부스 · 재떨이 테이블 · 환풍기 · 연기 · 흡연 중인 손님 2명(대화·라이터 빌려주기)
 *  ■ 성능: 방 안에 있을 때만 갱신 · 클럽 메시 숨김 · 클럽 광원을 빌려 써서 광원 수 불변
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world) return;
const T = NC.THREE, S = NC.scene, M = NC.mat, U = NC.util, W = NC.world, Mo = NC.Motion, col = NC.col;
const life = () => NC.Life || {};
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
let cur = null;                            // 현재 들어가 있는 방
const hidden = [], saved = {};

function makeRoom(id, label, cx, cz, hx, hz, h) {
  const G = new T.Group(); G.visible = false; S.add(G);
  const R = { id, label, cx, cz, hx, hz, h, G, rects: [], npcs: [], tick: null, spots: [], add(m, x, y, z) { m.position.set(cx + x, y, cz + z); G.add(m); return m; } };
  W.extraZones.push({ name: id, test: (x, z) => Math.abs(x - cx) < hx + 1 && Math.abs(z - cz) < hz + 1,
    collide(p, r) { W.collideRects(p, r, R.rects); p.x = U.clamp(p.x, cx - hx + r, cx + hx - r); p.z = U.clamp(p.z, cz - hz + r, cz + hz - r); } });
  W.zoneLabel[id] = label; return R;
}
function shell(R, floorMat, wallMat, ceilMat) {
  const { hx, hz, h } = R;
  const f = R.add(new T.Mesh(new T.PlaneGeometry(hx * 2, hz * 2), floorMat), 0, 0, 0); f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
  const c = R.add(new T.Mesh(new T.PlaneGeometry(hx * 2, hz * 2), ceilMat), 0, h, 0); c.rotation.x = Math.PI / 2;
  [[0, -hz, 0, hx * 2], [0, hz, Math.PI, hx * 2], [-hx, 0, Math.PI / 2, hz * 2], [hx, 0, -Math.PI / 2, hz * 2]].forEach(([x, z, r, len]) => { const w = R.add(new T.Mesh(new T.PlaneGeometry(len, h), wallMat), x, h / 2, z); w.rotation.y = r; });
}

/* ═════ 🚻 화장실 ═════ */
const RR = makeRoom('restroom', '🚻 화장실', 80, 30, 4.6, 3.4, 3.0);
{
  const tile = M.pbr('marble', { repeat: [4, 3], roughness: .7, env: 1.2, gen: { a: '#e8e6ea', b: '#9a96a6', tiles: 4 } }), wall = M.pbr('marble', { repeat: [5, 2], roughness: .8, gen: { a: '#f2f0f4', b: '#b8b4c4', tiles: 4 } });
  shell(RR, tile, wall, M.std('#f4f4f6', { roughness: .9 }));
  const porcelain = M.std('#fbfbfd', { roughness: .12, metalness: 0 }), chrome = M.std('#e8e8f0', { roughness: .08, metalness: 1 }), part = M.std('#3a4a6a', { roughness: .4, metalness: .2 }), wood = M.pbr('wood', { repeat: [1, 1], roughness: .5, gen: { a: '#2a1a10', b: '#5a3a22' } });
  // 천장 조명 패널
  for (let i = -1; i <= 1; i++) RR.add(new T.Mesh(new T.PlaneGeometry(1.4, .5), (() => { const m = M.glow('#f4f8ff'); m.color.multiplyScalar(3); return m; })()), i * 2.6, 2.99, 0).rotation.x = Math.PI / 2;
  // 칸 3개 (북쪽 벽) — 칸막이 · 문 · 변기
  RR.stalls = [];
  for (let k = 0; k < 3; k++) {
    const x = -3.4 + k * 1.5, z0 = -3.4, d = 1.6;
    RR.add(new T.Mesh(box(.05, 2.1, d), part), x - .72, 1.15, z0 + d / 2); if (k === 2) RR.add(new T.Mesh(box(.05, 2.1, d), part), x + .78, 1.15, z0 + d / 2);
    const door = RR.add(new T.Mesh(box(1.38, 1.9, .04), part), x + .03, 1.1, z0 + d); door.userData.x0 = door.position.x;
    RR.add(new T.Mesh(new T.CylinderGeometry(.02, .02, .08, 8), chrome), x + .5, 1.1, z0 + d + .04).rotation.x = Math.PI / 2;
    const bowl = RR.add(new T.Mesh(new T.CylinderGeometry(.2, .16, .4, 18), porcelain), x, .2, z0 + .45); bowl.scale.z = 1.3; RR.add(new T.Mesh(new T.TorusGeometry(.19, .035, 8, 20), porcelain), x, .42, z0 + .48).rotation.x = Math.PI / 2;
    RR.add(new T.Mesh(box(.42, .5, .18), porcelain), x, .65, z0 + .1); RR.add(new T.Mesh(new T.CylinderGeometry(.06, .06, .1, 12), M.std('#d8d8dc')), x + .45, .75, z0 + .2).rotation.z = Math.PI / 2;
    const sign = RR.add(new T.Mesh(new T.CircleGeometry(.05, 12), M.emi('#33dd66', 2)), x + .5, 1.6, z0 + d + .03); sign.userData.lamp = true;
    RR.stalls.push({ x, z: z0 + d + .55, door, sign, busy: false });
    RR.rects.push([x - .75, z0, x + .8, z0 + d]);
  }
  // 소변기 2개 (동쪽 벽)
  RR.urinals = [];
  for (let k = 0; k < 2; k++) { const z = -1.6 + k * 1.1; const u = RR.add(new T.Mesh(new T.SphereGeometry(.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * .6), porcelain), 4.45, .75, z); u.rotation.z = Math.PI / 2; u.scale.set(1.3, .8, 1); if (k === 0) RR.add(new T.Mesh(box(.5, 1.0, .04), part), 4.35, 1.0, z + .55); RR.urinals.push({ x: 3.8, z }); }
  RR.rects.push([4.2, -2.1, 4.6, 0.0]);
  // 세면대 3개 + 거울 (남쪽 벽) + 핸드 드라이어
  RR.add(new T.Mesh(box(4.2, .1, .6), M.pbr('marble', { repeat: [2, 1], roughness: .5, gen: { a: '#1a1820', b: '#6a6478' } })), -1.0, .88, 3.1); RR.add(new T.Mesh(box(4.2, .8, .55), wood), -1.0, .43, 3.12);
  RR.sinks = [];
  for (let k = 0; k < 3; k++) { const x = -2.4 + k * 1.4; RR.add(new T.Mesh(new T.CylinderGeometry(.22, .16, .1, 20), porcelain), x, .94, 3.05); RR.add(new T.Mesh(new T.CylinderGeometry(.015, .015, .22, 8), chrome), x, 1.04, 3.3); const sp = RR.add(new T.Mesh(new T.CylinderGeometry(.012, .012, .14, 8), chrome), x, 1.14, 3.23); sp.rotation.x = Math.PI / 2; RR.sinks.push({ x, z: 2.45 }); }
  const mirror = RR.add(new T.Mesh(new T.PlaneGeometry(4.0, 1.3), new T.MeshStandardMaterial({ color: 0xc8ccd8, roughness: .02, metalness: 1, envMapIntensity: 1.8 })), -1.0, 1.85, 3.38); mirror.rotation.y = Math.PI;
  RR.add(new T.Mesh(box(4.1, .04, .04), M.emi('#ffffff', 2.5)), -1.0, 2.55, 3.36);
  RR.add(new T.Mesh(box(.32, .4, .2), chrome), 2.2, 1.3, 3.3); RR.dryer = { x: 2.2, z: 2.7 };
  RR.rects.push([-3.1, 2.8, 1.1, 3.4]);
  // 사인 · 식물 · 문
  { const s = NC.neonSign('🚹 🚺 RESTROOM', 2.6, .5, { font: '900 90px Arial', color: '#ffffff', glow: '#3dd8ff', ph: 200 }); s.material.color.setScalar(1.8); s.rotation.y = -Math.PI / 2; RR.add(s, 4.55, 2.4, 1.6); }
  const pot = RR.add(new T.Mesh(new T.CylinderGeometry(.18, .14, .4, 14), M.std('#2a2a30', { roughness: .4 })), 4.2, .2, 2.9); void pot; for (let i = 0; i < 7; i++) { const lf = RR.add(new T.Mesh(new T.SphereGeometry(.16, 8, 6), M.std('#2f7a3a', { roughness: .7 })), 4.2 + Math.cos(i) * .12, .55 + i * .07, 2.9 + Math.sin(i) * .12); lf.scale.set(.6, 1.3, .3); lf.rotation.set(Math.random(), i, Math.random()); }
  RR.add(new T.Mesh(box(1.2, 2.3, .06), M.pbr('wood', { repeat: [1, 2], roughness: .5, gen: { a: '#1a100a', b: '#3e2616' } })), 3.5, 1.15, 3.37);
  RR.exit = { x: 3.5, z: 2.8 }; RR.entry = { x: 3.4, z: 2.4, ry: Math.PI };
}

/* ═════ 🚬 흡연실 ═════ */
const SM = makeRoom('smoke', '🚬 흡연실', 80, -30, 3.6, 3.0, 3.0);
{
  const floor = M.pbr('speckle', { repeat: [3, 3], roughness: 1, gen: { a: '#2a2a30' } });
  const glassW = new T.MeshStandardMaterial({ color: col('#c8d4dc'), roughness: .25, metalness: .2, transparent: true, opacity: .55, emissive: col('#3a4048'), envMapIntensity: 1.2 });
  shell(SM, floor, glassW, M.std('#1a1a20', { roughness: .8 }));
  const steel = M.std('#9aa0aa', { roughness: .35, metalness: .9 }), dark = M.std('#1a1a1e', { roughness: .5 });
  // 유리벽 프레임
  for (let x = -3.6; x <= 3.6; x += 1.2) { SM.add(new T.Mesh(box(.05, 3, .05), steel), x, 1.5, -2.98); SM.add(new T.Mesh(box(.05, 3, .05), steel), x, 1.5, 2.98); }
  // 재떨이 스탠드 테이블 3개
  SM.tables = [[-1.8, -.8], [1.6, -1.2], [0, 1.4]].map(([x, z]) => { SM.add(new T.Mesh(new T.CylinderGeometry(.05, .05, 1.0, 10), steel), x, .5, z); SM.add(new T.Mesh(new T.CylinderGeometry(.3, .3, .04, 20), dark), x, 1.02, z); SM.add(new T.Mesh(new T.CylinderGeometry(.11, .09, .05, 16), steel), x, 1.06, z); SM.add(new T.Mesh(new T.CylinderGeometry(.25, .3, .04, 18), steel), x, .02, z); SM.rects.push([x - .3, z - .3, x + .3, z + .3]); return { x, z }; });
  // 벤치 · 환풍기 · 공기청정기 · 경고문
  SM.add(new T.Mesh(box(2.6, .45, .5), M.pbr('leather', { repeat: [2, 1], color: '#3a3a42', roughness: 1 })), -1.2, .225, 2.65); SM.rects.push([-2.5, 2.4, .1, 3.0]);
  SM.fans = [-1.6, 1.6].map(x => { const hub = new T.Group(); hub.position.set(SM.cx + x, 2.95, SM.cz); for (let k = 0; k < 4; k++) { const b = new T.Mesh(box(.5, .01, .1), steel); b.position.x = .25; const arm = new T.Group(); arm.rotation.y = k * Math.PI / 2; arm.add(b); hub.add(arm); } hub.add(new T.Mesh(new T.CylinderGeometry(.08, .08, .06, 12), dark)); SM.G.add(hub); return hub; });
  SM.add(new T.Mesh(box(.5, 1.1, .35), M.std('#e8e8ec', { roughness: .4 })), 3.2, .55, -2.6); SM.add(new T.Mesh(new T.CircleGeometry(.04, 10), M.emi('#33aaff', 3)), 3.2, .95, -2.42);
  { const w = new T.Mesh(new T.PlaneGeometry(1.8, .7), new T.MeshBasicMaterial({ map: NC.textTex('흡연실 · 흡연은 건강에 해롭습니다', 512, 200, '800 30px "Malgun Gothic",sans-serif', '#ffffff', null, '#8a1a1a') })); w.rotation.y = -Math.PI / 2; SM.add(w, 3.55, 2.0, 1.2); }
  { const s = NC.neonSign('SMOKING AREA', 2.4, .45, { font: '900 90px Arial', color: '#fff3d6', glow: '#ffb03d', ph: 200 }); s.material.color.setScalar(1.8); SM.add(s, 0, 2.5, -2.95); }
  SM.add(new T.Mesh(box(1.1, 2.3, .06), steel), -3.0, 1.15, 2.97);
  // 연기
  const cloud = NC.TexLib ? NC.TexLib.texture('cloud', 'map') : NC.softDot();
  SM.smoke = []; for (let i = 0; i < 12; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: cloud, color: col('#d8d8dc'), transparent: true, opacity: .12, depthWrite: false })); sp.scale.setScalar(1.2 + Math.random()); SM.G.add(sp); SM.smoke.push({ sp, x: (Math.random() - .5) * 6, z: (Math.random() - .5) * 5, y: Math.random() * 2.8, v: .1 + Math.random() * .15 }); }
  SM.exit = { x: -3.0, z: 2.4 }; SM.entry = { x: -2.8, z: 2.0, ry: Math.PI * .9 };
}
// 연기 한 모금(퍼프) — 흡연 제스처 때 머리 앞에서 피어오름
const puffs = []; const puffTex = NC.TexLib ? NC.TexLib.texture('cloud', 'map') : NC.softDot();
function puff(g) { const head = g.position.clone(); head.y += (g.userData.look ? g.userData.look.height : 1.65) - .05; head.x += Math.sin(g.rotation.y) * .25; head.z += Math.cos(g.rotation.y) * .25;
  for (let i = 0; i < 3; i++) setTimeout(() => { const sp = new T.Sprite(new T.SpriteMaterial({ map: puffTex, color: col('#e8e8ec'), transparent: true, opacity: .5, depthWrite: false })); sp.position.copy(head); sp.scale.setScalar(.15); S.add(sp); puffs.push({ sp, t: 0 }); }, 1500 + i * 180); }

/* ═════ 공통: 입장 · 퇴장 ═════ */
function borrow(R, on) {
  const L = W.lights || {};
  const plan = { bar: [-R.hx * .5, R.h - .3, 0, R.id === 'restroom' ? '#f4f8ff' : '#ffd6a0', 1.3, 9], corridor: [R.hx * .5, R.h - .3, 0, R.id === 'restroom' ? '#e8f0ff' : '#ffb070', 1.1, 9] };
  Object.entries(plan).forEach(([k, [x, y, z, c, i, d]]) => { const l = L[k]; if (!l) return; if (on) { saved[k] = { p: l.position.clone(), c: l.color.clone(), i: l.intensity, d: l.distance }; l.position.set(R.cx + x, y, R.cz + z); l.color.copy(col(c)); l.intensity = i; l.distance = d; } else if (saved[k]) { l.position.copy(saved[k].p); l.color.copy(saved[k].c); l.intensity = saved[k].i; l.distance = saved[k].d; } });
  if (L.key) { if (on) { saved.key = { p: L.key.position.clone(), t: L.key.target.position.clone(), i: L.key.intensity, a: L.key.angle, d: L.key.distance, n: L.key.shadow.camera.near }; L.key.position.set(R.cx, R.h - .05, R.cz + .5); L.key.target.position.set(R.cx, 0, R.cz); L.key.intensity = R.id === 'restroom' ? .75 : .7; L.key.angle = 1.3; L.key.distance = 9; L.key.shadow.camera.near = .2; }
    else if (saved.key) { const s = saved.key; L.key.position.copy(s.p); L.key.target.position.copy(s.t); L.key.intensity = s.i; L.key.angle = s.a; L.key.distance = s.d; L.key.shadow.camera.near = s.n; } L.key.shadow.camera.updateProjectionMatrix(); }
}
function setClub(on, R) {
  if (!on) { hidden.length = 0; S.children.forEach(o => { if (o === R.G || o.isLight || o === NC.player.group || !o.visible || R.npcs.some(n => n.g === o)) return; if (o.userData && o.userData.remote) return; hidden.push(o); o.visible = false; }); R.npcs.forEach(n => { n.g.visible = true; }); }
  else { hidden.forEach(o => { o.visible = true; }); hidden.length = 0; R.npcs.forEach(n => { n.g.visible = false; }); }
}
function enter(R) {
  const P = NC.player; if (P.busy || cur) return;
  if (NC.Dialog && NC.Dialog.cur) NC.Dialog.close('bye');
  NC.ui.fade(() => { if (P.seat) NC.requestStand(); P.x = R.entry.x + R.cx; P.z = R.entry.z + R.cz; P.ry = R.entry.ry; P.target = null; P.autoPath = null; P.group.position.set(P.x, 0, P.z); P.group.rotation.y = P.ry;
    R.G.visible = true; setClub(false, R); borrow(R, true); cur = R; NC.ui.toast(`${R.label}에 들어왔어요`);
    if (R.id === 'wroom') { const lk = P.group.userData.look; if (lk && lk.gender === 'm') wrEpisode(); else setTimeout(() => NC.bubble && NC.bubble(WR.ladies[0].g, U.pick(['아까 골든벨 오빠 봤어? 완전 내 스타일 ㅋㅋ', '립 뭐 써요? 색 너무 예쁘다~', '오늘 부킹 몇 번 했어? 나 벌써 세 번 ㅋㅋ']), 3), 800); } });
}
function leave(R) {
  const P = NC.player; NC.ui.fade(() => { if (P.seat) NC.requestStand(); const d = R.id === 'restroom' ? W.spots.restroomDoor : R.id === 'wroom' ? W.spots.wroomDoor : W.spots.smokeDoor; P.x = d.x; P.z = d.z; P.ry = R.id === 'smoke' ? Math.PI / 2 : -Math.PI / 2; P.group.position.set(P.x, 0, P.z); P.group.rotation.y = P.ry;
    R.G.visible = false; setClub(true, R); borrow(R, false); cur = null; });
}
/* ═════ 🚺 여자 화장실 (v14) — 남자가 들어가면 코믹 소동극, 여자면 파우더룸 수다 ═════ */
const WR = makeRoom('wroom', '🚺 여자 화장실', 80, 60, 4.0, 3.2, 3.0);
RR.label = '🚹 남자 화장실'; W.zoneLabel.restroom = '🚹 남자 화장실';
{
  const tile = M.pbr('marble', { repeat: [4, 3], roughness: .5, env: 1.2, gen: { a: '#fbe8f0', b: '#d8a8c0', tiles: 4 } }), wall = M.pbr('marble', { repeat: [4, 2], roughness: .6, gen: { a: '#ffeef5', b: '#e8c0d4' } });
  shell(WR, tile, wall, M.std('#fff4f8', { roughness: .9 }));
  for (let i = -1; i <= 1; i += 2) WR.add(new T.Mesh(new T.PlaneGeometry(1.4, .5), (() => { const m = M.glow('#fff0f6'); m.color.multiplyScalar(3); return m; })()), i * 1.6, 2.99, 0).rotation.x = Math.PI / 2;
  const marble = M.pbr('marble', { repeat: [2, 1], roughness: .35, gen: { a: '#f4e8ee', b: '#b88aa0' } }), wood = M.std('#5a2a3a', { roughness: .5 });
  WR.add(new T.Mesh(box(4.4, .1, .6), marble), .2, .88, -2.9); WR.add(new T.Mesh(box(4.4, .8, .55), wood), .2, .43, -2.88);       // 세면대 카운터(북쪽)
  const mir = WR.add(new T.Mesh(new T.PlaneGeometry(4.2, 1.3), new T.MeshStandardMaterial({ color: 0xe8d8e0, roughness: .02, metalness: 1, envMapIntensity: 1.8 })), .2, 1.85, -3.18);
  const bulb = (() => { const m = new T.MeshBasicMaterial({ color: 0xfff0d8 }); m.color.multiplyScalar(2.6); return m; })(), bg = new T.SphereGeometry(.035, 10, 8);
  for (let k = 0; k < 12; k++) WR.add(new T.Mesh(bg, bulb), -1.85 + k * .37, 2.58, -3.14);
  const part = M.std('#d86a9a', { roughness: .4 });                                                                             // 칸 2개(남쪽)
  WR.stalls = [];
  for (let k = 0; k < 2; k++) { const x = 1.0 + k * 1.5; WR.add(new T.Mesh(box(.05, 2.1, 1.4), part), x - .72, 1.15, 2.5); if (k === 1) WR.add(new T.Mesh(box(.05, 2.1, 1.4), part), x + .78, 1.15, 2.5);
    const door = WR.add(new T.Mesh(box(1.38, 1.9, .04), part), x + .03, 1.1, 1.8); WR.stalls.push({ x, z: 1.2, door }); }
  const sofa = M.pbr('tufted', { repeat: [3, 1], roughness: .6, color: '#ff8ab8' });                                              // 파우더룸 소파(서쪽)
  WR.add(new T.Mesh(box(.7, .45, 2.2), sofa), -3.55, .23, -.6); WR.add(new T.Mesh(box(.2, .7, 2.2), sofa), -3.88, .6, -.6);
  { const s = NC.neonSign('💄 POWDER ROOM', 2.2, .42, { font: '900 80px Arial', color: '#fff4fb', glow: '#ff5fb0', ph: 200 }); s.material.color.setScalar(1.8); s.rotation.y = Math.PI / 2; WR.add(s, -3.95, 2.3, -.6); }
  WR.rects.push([-4.0, -1.7, -3.2, .5], [-2.0, -3.2, 2.4, -2.6]);
  WR.exit = { x: 3.4, z: -.6 }; WR.entry = { x: 3.2, z: -.6, ry: -Math.PI / 2 };
  // 여성 손님 3명(장식용 아바타) + 청소 아주머니(숨어 있다 등장)
  const glamLook = c => ({ gender: 'f', top: 'dress', mini: true, strapless: true, topColor: c, bottom: 'skirt', bottomColor: c });
  WR.ladies = [['수정', glamLook('#ff2d78'), [-.8, -2.3, Math.PI]], ['미나', glamLook('#141418'), [.9, -2.3, Math.PI]], ['카렌', glamLook('#ffffff'), [-3.3, -.2, Math.PI / 2]]].map(([nm, lk, [x, z, ry]], i) => {
    const g = NC.Avatar.create({ name: nm, look: lk, seed: U.hash('wr' + nm), expr: 'neutral' }); g.position.set(WR.cx + x, 0, WR.cz + z); g.rotation.y = ry; if (i === 2) NC.seatAvatar(g, WR.cx + x, WR.cz + z, ry, .46); WR.G.add(g); return { g, x, z, ry, nm };
  });
  WR.ajumma = NC.Avatar.create({ name: '청소 아주머니', look: { gender: 'f', hairStyle: 'bun', hairColor: '#8a8a90', top: 'shirt', topColor: '#7ab8a0', bottom: 'pants', bottomColor: '#3a3a42', mini: false, strapless: false, wings: false, height: 1.55, build: 1.15, curve: .2, face: { glasses: true, liner: 0, blush: 0 } }, seed: 77, expr: 'annoyed' });
  WR.ajumma.visible = false; WR.G.add(WR.ajumma);
  const mop = new T.Group(); mop.add(new T.Mesh(new T.CylinderGeometry(.015, .015, 1.4, 6), M.std('#c8a060'))); const head = new T.Mesh(box(.3, .06, .12), M.std('#e8e8ec', { roughness: 1 })); head.position.y = -.7; mop.add(head); mop.position.set(.12, -.1, .2); mop.rotation.x = .3;
  WR.ajumma.userData.rig.elR.children.find(c => c.isGroup).add(mop);
}
function throwItem(fromG, toG, emoji, delay) {
  setTimeout(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.font = '52px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(emoji, 32, 36);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false })); sp.scale.set(.3, .3, 1); WR.G.add(sp);
    const a = fromG.position.clone().setY(1.4), b = toG.position.clone().setY(1.5), t0 = performance.now();
    const step = () => { const e = Math.min(1, (performance.now() - t0) / 550); sp.position.lerpVectors(a, b, e); sp.position.y += Math.sin(e * Math.PI) * .6; sp.material.rotation = e * 8;
      if (e < 1) requestAnimationFrame(step); else { WR.G.remove(sp); NC.Audio.sfx && NC.Audio.sfx('slap'); Mo.play(toG, 'flinch'); } }; step();
  }, delay);
}
function scream() { const A = NC.Audio, C = A && A.ctx; if (!C) return; const t = C.currentTime; [0, .25].forEach((d, i) => { const o = C.createOscillator(), g = C.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900 + i * 150, t + d); o.frequency.linearRampToValueAtTime(1500 + i * 200, t + d + .35); o.frequency.linearRampToValueAtTime(1100, t + d + .8); g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.06, t + d + .05); g.gain.exponentialRampToValueAtTime(.0001, t + d + .9); o.connect(g); g.connect(A.master); o.start(t + d); o.stop(t + d + 1); }); }
let wrBusy = false;
function wrEpisode() {   // 남자가 여자 화장실에 들어갔을 때 — 코믹 소동극(랜덤 대사)
  const P = NC.player, B = NC.bubble || (() => {}), L = WR.ladies; if (wrBusy) return; wrBusy = true; P.busy = true;
  const pg = P.group; L.forEach(l => { l.g.userData.lookAt = pg.position; });
  setTimeout(() => { B(L[0].g, '……응?', 1.6); B(L[1].g, '……?!', 1.6); }, 900);
  setTimeout(() => { scream(); L.forEach((l, i) => { B(l.g, U.pick(['꺄아아악!!! 변태야!!', '여기 여자 화장실이거든요?!', '엄마야!! 나가요 나가!!', '뭐야 뭐야?! 경찰 불러!!', '어머머 미쳤나 봐!!']), 2.2); Mo.play(l.g, 'flinch'); });
    NC.camShake = 1.0; NC.ui.toast('😱 헉… 여기 여자 화장실이었다!'); }, 1900);
  ['👜', '🧻', '💄', '🪮', '👠'].forEach((e, i) => throwItem(L[i % 2].g, pg, e, 2600 + i * 320));
  setTimeout(() => { const a = WR.ajumma; a.visible = true; a.position.set(WR.cx + 2.5, 0, WR.cz + 1.4); a.rotation.y = Math.atan2(pg.position.x - a.position.x, pg.position.z - a.position.z); a.userData.lookAt = pg.position;
    B(a, U.pick(['아이고 이 총각이!! 여긴 여자 화장실이여!!', '어디서 남자가!! 빗자루 맛 좀 볼텨?!', '눈 감고 당장 나가!!']), 2.6); Mo.play(a, 'slap'); setTimeout(() => { NC.Audio.sfx && NC.Audio.sfx('slap'); Mo.play(pg, 'flinch'); }, 350); }, 4400);
  setTimeout(() => { B(pg, U.pick(['죄, 죄송합니다!!', '표지판을 잘못 봤어요!!', '저 아무것도 못 봤어요!!']), 1.8); }, 5300);
  setTimeout(() => { leave(WR); P.busy = false; wrBusy = false; setTimeout(() => { WR.ajumma.visible = false; L.forEach(l => l.g.userData.lookAt = null);
    NC.ui.toast('🚨 여자 화장실에서 쫓겨났어요! 클럽 여성 손님 호감도 -3');
    (NC.npcs || []).forEach(n => { if (n.gender === 'f') n.aff = U.clamp((n.aff ?? 40) - 3, 0, 100); });
    const near = (NC.npcs || []).filter(n => n.gender === 'f' && n.enabled && n.g.visible && Math.hypot(n.x - P.x, n.z - P.z) < 10).slice(0, 2);
    near.forEach((n, i) => setTimeout(() => { NC.bubble && NC.bubble(n.g, U.pick(['ㅋㅋㅋ 저 사람 여자 화장실 들어갔대', '어머 저 오빠 아까 그 변태 ㅋㅋ', '헐 진짜? 대박 ㅋㅋㅋ']), 2.6); Mo.play(n.g, 'laugh'); }, 700 + i * 600)); }, 500); }, 6600);
}
NC.tickers.push(dt => {
  if (NC.camShake > 0) { NC.camShake -= dt; const k = NC.camShake * .06; NC.camera.position.x += (Math.random() - .5) * k; NC.camera.position.y += (Math.random() - .5) * k; }
  if (cur !== WR) return; const near = true; [...WR.ladies.map(l => l.g), WR.ajumma].forEach(g => { if (g.visible) Mo.update(g, dt, { near, speed: 1 }); });
});
NC.on && NC.on('room:enter', () => {});
NC.Rooms = { restroom: RR, smoke: SM, wroom: WR, enter, leave, current: () => cur, wrEpisode };

/* 화장실 행동 */
function useToilet(kind, st) {
  const P = NC.player; P.busy = true;
  const ov = document.createElement('div'); ov.id = 'roomOverlay'; ov.innerHTML = `<div>${kind === 'stall' ? '🚽 볼일 보는 중…' : '🚹 볼일 보는 중…'}</div><div class="bar"><i></i></div>`; document.body.appendChild(ov);
  if (st) { st.busy = true; st.door.position.x = st.door.userData.x0; st.sign.material.emissive.copy(col('#ff3355')); }
  const dur = kind === 'stall' ? 3800 : 2400; requestAnimationFrame(() => { ov.querySelector('i').style.transition = `width ${dur}ms linear`; ov.querySelector('i').style.width = '100%'; });
  setTimeout(() => { const A = NC.Audio; if (A && A.ctx) { const t = A.ctx.currentTime; A.hit(t, 300, 1.4, .25, A.sfxBus); A.hit(t + .2, 900, 1.0, .12, A.sfxBus); }   // 물 내리는 소리
    ov.remove(); P.busy = false; const L = life(); L.bladder = 0; L.warned = false; L.tipsy = Math.max(0, (L.tipsy || 0) - .3);
    if (st) { st.busy = false; st.sign.material.emissive.copy(col('#33dd66')); }
    NC.ui.toast(U.pick(['😌 개운하다! 손 씻는 것도 잊지 마세요', '😌 살 것 같다~ 이제 다시 놀아 볼까?', '😌 휴~ 다음엔 손 씻기!'])); }, dur);
}
function wash() { const P = NC.player; P.busy = true; const A = NC.Audio; if (A && A.ctx) { const t = A.ctx.currentTime; A.hit(t, 2500, 2.0, .08, A.sfxBus); }
  Mo.play(P.group, 'clap'); setTimeout(() => { P.busy = false; const L = life(); L.charm = Math.min(3, (L.charm || 0) + 1); NC.ui.toast('🧼 손 씻기 완료! 깨끗해요 ✨ (다음 대화 첫인상 +)'); }, 2000); }
function mirror() { const P = NC.player; Mo.play(P.group, 'shy'); const L = life(); L.charm = Math.min(3, (L.charm || 0) + 1); NC.ui.toast(U.pick(['🪞 머리 정리 완료~ 오늘 좀 괜찮은데?', '🪞 옷매무새 체크! 자신감 +', '🪞 미소 연습… 😁 완벽해요'])); }
function dryer() { const A = NC.Audio; if (A && A.ctx) { const t = A.ctx.currentTime; A.hit(t, 600, 1.6, .2, A.sfxBus); } NC.ui.toast('💨 위잉~ 손이 보송보송'); }
function smoke() { const P = NC.player; Mo.play(P.group, 'smoke'); puff(P.group); setTimeout(() => { Mo.play(P.group, 'smoke'); puff(P.group); }, 3200); NC.ui.toast('🚬 후~ (흡연은 건강에 해롭습니다)'); }

/* 흡연실 손님 배치 */
let smokersInit = false;
function initSmokers() {
  const pool = (NC.npcs || []).filter(n => n.role === 'crowd' && n.enabled && !n.stay && !n.g.userData.vrm && n.state === 'wander');
  [pool.find(n => n.gender === 'm'), pool.find(n => n.gender === 'f' && n !== pool[0])].filter(Boolean).slice(0, 2).forEach((n, k) => {
    const t = SM.tables[k]; n.stay = 'smoke'; n.booked = true; n.state = 'stay'; n.aff = n.aff ?? 40; n.x = SM.cx + t.x + .55; n.z = SM.cz + t.z + .2; n.g.position.set(n.x, 0, n.z); n.g.rotation.y = -Math.PI / 2; n.g.visible = false; n.g.userData.lookAt = null; SM.npcs.push(n);
  });
}

/* E 상호작용 */
NC.interactProviders.push(() => {
  const P = NC.player, out = []; if (!P.group || P.seat || P.busy) return out;
  if (!cur) { [[W.spots.restroomDoor, RR, '🚹 남자 화장실 가기 (E)'], [W.spots.wroomDoor, WR, '🚺 여자 화장실 가기 (E)'], [W.spots.smokeDoor, SM, '🚬 흡연실 들어가기 (E)']].forEach(([d, R, lb]) => { if (!d) return; const dist = Math.hypot(P.x - d.x, P.z - d.z); if (dist < 2.3) out.push({ label: lb, dist, run: () => enter(R) }); }); return out; }
  const R = cur, lx = P.x - R.cx, lz = P.z - R.cz, near = (o, r = 1.1) => Math.hypot(lx - o.x, lz - o.z) < r;
  if (near(R.exit, 1.4)) out.push({ label: '🚪 클럽으로 돌아가기 (E)', dist: .5, run: () => leave(R) });
  if (R === RR) {
    RR.stalls.forEach((st, i) => { if (near(st, 1.0) && !st.busy) out.push({ label: `🚽 ${i + 1}번 칸 이용하기 (E)`, dist: .3, run: () => useToilet('stall', st) }); });
    if (P.group.userData.look && P.group.userData.look.gender === 'm') RR.urinals.forEach(u => { if (near(u, .9)) out.push({ label: '🚹 소변기 이용 (E)', dist: .3, run: () => useToilet('urinal') }); });
    RR.sinks.forEach(s => { if (near(s, .9)) { out.push({ label: '🧼 손 씻기 (E)', dist: .2, run: wash }); out.push({ label: '🪞 거울 보고 매무새 정리 (E)', dist: .35, run: mirror }); } });
    if (near(RR.dryer, .9)) out.push({ label: '💨 핸드 드라이어 (E)', dist: .3, run: dryer });
  } else if (R === WR) {
    if (!wrBusy) { WR.ladies.forEach(l => { const d = Math.hypot(lx - l.x, lz - l.z); if (d < 1.6) out.push({ label: `💬 ${l.nm}와 수다 떨기 (E)`, dist: d, run: () => { NC.bubble && NC.bubble(l.g, U.pick(['여기 거울 조명 진짜 잘 받죠?', '저 남자 화장실 줄 엄청 길던데 ㅋㅋ', '오늘 DJ 선곡 미쳤다~', '이따 같이 스테이지 나가요!']), 2.6); Mo.play(l.g, 'laugh'); } }); });
      if (Math.abs(lz + 2.6) < 1.0 && Math.abs(lx) < 2.2) out.push({ label: '💄 거울 보고 화장 고치기 (E)', dist: .4, run: mirror }); }
  } else {
    SM.tables.forEach(t => { if (near(t, 1.3)) out.push({ label: '🚬 담배 한 대 피우기 (E)', dist: .6, run: smoke }); });
    SM.npcs.forEach(n => { const d = Math.hypot(P.x - n.x, P.z - n.z); if (d < 2.0) {
      out.push({ label: `💬 ${n.name}와 대화 (E)`, dist: d - .3, run: () => NC.Dialog.open(n, { intro: U.pick(['아, 불 있으세요? …농담이에요 ㅎㅎ', '여기 공기 좀 답답하죠? 그래도 조용해서 좋아요', '스테이지 너무 시끄러워서 잠깐 피신 왔어요 ㅋㅋ']) }) });
      if (!n.lit) out.push({ label: `🔥 ${n.name}에게 라이터 빌려주기 (E)`, dist: d - .1, run: () => { n.lit = true; n.aff = U.clamp((n.aff ?? 40) + 3, 0, 100); Mo.play(n.g, 'bow'); NC.ui.chatAdd(n.name, U.pick(['어머, 고마워요! 라이터를 두고 왔지 뭐예요 😅', '오 감사합니다~ 센스 있으시네요 👍', '살았다… 고마워요! 이따 한 잔 살게요 ㅎㅎ'])); NC.ui.toast(`💗 ${n.name} 호감도 +3`); setTimeout(() => { Mo.play(n.g, 'smoke'); puff(n.g); }, 800); } });
    } });
  }
  return out;
});

/* 프레임: 방 안에서만 갱신 */
let npcT = 0;
NC.tickers.push((dt, t) => {
  if (!smokersInit && NC.npcs && NC.npcs.length > 4) { smokersInit = true; initSmokers(); }
  for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.t += dt; p.sp.position.y += dt * .25; p.sp.scale.setScalar(.15 + p.t * .5); p.sp.material.opacity = Math.max(0, .5 - p.t * .2); if (p.t > 2.5) { S.remove(p.sp); p.sp.material.dispose(); puffs.splice(i, 1); } }
  if (!cur) return;
  if (cur === SM) {
    SM.fans.forEach((f, i) => { f.rotation.y += dt * (5 + i); });
    SM.smoke.forEach(s => { s.y += s.v * dt; if (s.y > 2.9) s.y = .3; s.sp.position.set(SM.cx + s.x + Math.sin(t * .3 + s.z) * .3, s.y, SM.cz + s.z); s.sp.material.opacity = .1 * Math.min(1, (2.9 - s.y)); });
    npcT += dt; if (npcT > 7) { npcT = 0; const n = U.pick(SM.npcs); if (n && !(NC.Dialog && NC.Dialog.cur === n)) { Mo.play(n.g, 'smoke'); puff(n.g); } }
  }
});
console.info('[rooms] 🚻 화장실 · 🚬 흡연실 준비 완료');
})();
