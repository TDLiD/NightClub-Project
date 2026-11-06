/* world.js — 클럽 3D 공간 (4구역) · 조명/셰이더 연출 · 충돌 · 좌석
 *  ① 메인 스테이지/DJ 부스 (북쪽, 높이 0.5m 무대 + 댄스플로어)
 *  ② 일반 테이블 (서·동쪽 6개, 동쪽 벽 바)
 *  ③ VIP 룸 3개 (남쪽, 유리 슬라이딩 도어 · 잠금 · 내부 소파 6석)
 *  ④ 웨이터/부킹 통로 (테이블존과 VIP 사이 레드카펫, 웨이터 스테이션)
 *  조명: 밝은 앰비언트+헤미스피어 베이스 위에 무빙 스팟·레이저·미러볼 반사점·헤이즈(연기)·LED 월·네온
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const T = NC.THREE, S = NC.scene, M = NC.mat, U = NC.util, col = NC.col;
const ROOM = { x: 24, z: 20, h: 11 };
const W = NC.world = { ROOM, rects: [], circles: [], vip: [], zones: {}, spots: {} };
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
const put = (m, x, y, z) => { m.position.set(x, y, z); S.add(m); return m; };

/* ── 구역 정의 ── */
const Z = W.zones = {
  stage: { x0: -11, x1: 11, z0: -20, z1: -13.2, y: .5 },
  dance: { x0: -8, x1: 8, z0: -12.6, z1: -3 },
  corridor: { x0: -24, x1: 24, z0: 4.8, z1: 9.1 },
  bar: { x0: 18.4, x1: 24, z0: -14, z1: 3 },
};
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/* ── 기본 조명 (밝게) ── */
S.background = col('#251a40');
S.fog = new T.FogExp2(col('#3a2a5e'), .0075);
S.add(new T.AmbientLight(col('#c9bcf0'), .52));
S.add(new T.HemisphereLight(col('#e2d6ff'), col('#5b4580'), .62));

/* ── 바닥 · 벽 · 천장 ── */
const floor = put(new T.Mesh(new T.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), M.std('#3a2f55', { roughness: .32, metalness: .12 })), 0, 0, 0); floor.rotation.x = -Math.PI / 2;
const ceil = put(new T.Mesh(new T.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), M.std('#2a2148')), 0, ROOM.h, 0); ceil.rotation.x = Math.PI / 2;
const wallMat = M.std('#5a4a8a', { roughness: .85 });
[[0, -ROOM.z, 0, ROOM.x * 2], [0, ROOM.z, Math.PI, ROOM.x * 2], [-ROOM.x, 0, Math.PI / 2, ROOM.z * 2], [ROOM.x, 0, -Math.PI / 2, ROOM.z * 2]].forEach(([x, z, r, len]) => { const w = put(new T.Mesh(new T.PlaneGeometry(len, ROOM.h), wallMat), x, ROOM.h / 2, z); w.rotation.y = r; });
// 벽 네온 띠 + 세로 네온 기둥
[[0, -ROOM.z + .05, ROOM.x * 2, 0], [-ROOM.x + .05, 0, ROOM.z * 2, Math.PI / 2], [ROOM.x - .05, 0, ROOM.z * 2, Math.PI / 2], [0, ROOM.z - .05, ROOM.x * 2, 0]].forEach(([x, z, len, r], i) => {
  [.35, ROOM.h - .4].forEach(y => { const m = put(new T.Mesh(box(len, .1, .1), M.emi(i % 2 ? '#3de6ff' : '#ff3d9a', 1.4)), x, y, z); m.rotation.y = r; });
});
for (let z = -14; z <= 2; z += 8) for (const s of [-1, 1]) put(new T.Mesh(box(.12, 7, .12), M.emi(s < 0 ? '#ff7ad1' : '#7ad7ff', 1.3)), s * (ROOM.x - .08), 4, z);

/* ═════ ① 메인 스테이지 / DJ 부스 ═════ */
const stg = Z.stage;
put(new T.Mesh(box(stg.x1 - stg.x0, .5, stg.z1 - stg.z0), M.std('#1c1530', { roughness: .25, metalness: .35 })), 0, .25, (stg.z0 + stg.z1) / 2);
put(new T.Mesh(box(stg.x1 - stg.x0, .06, .08), M.emi('#ffd23d', 1.6)), 0, .5, stg.z1);
for (let i = 0; i < 3; i++) put(new T.Mesh(box(6, .17 * (i + 1), .35), M.std('#2a2040', { roughness: .4 })), 0, .085 * (i + 1), stg.z1 + .55 - i * .35);
// 스테이지 바닥 조명 라인
for (let x = -9; x <= 9; x += 3) put(new T.Mesh(box(.06, .02, 6), M.emi('#ff3d9a', 1.2)), x, .51, -16.6);
// DJ 부스
put(new T.Mesh(box(7.6, 1.1, 1.4), M.std('#2b1d50', { roughness: .35, metalness: .3 })), 0, 1.05, -17.4);
put(new T.Mesh(box(7.6, .08, .1), M.emi('#3de6ff', 2)), 0, 1.6, -16.68);
[-2.2, -.7, .7, 2.2].forEach(x => put(new T.Mesh(new T.CylinderGeometry(.32, .32, .04, 24), M.emi('#ff3d9a', 1.1)), x, 1.62, -17.4));
W.rects.push([-4, -18.4, 4, -16.6]);
// 스피커 스택
for (const s of [-1, 1]) { put(new T.Mesh(box(1.8, 3.6, 1.6), M.std('#151020', { roughness: .5 })), s * 9.6, 2.3, -18.6); [1.2, 2.4, 3.4].forEach(y => put(new T.Mesh(new T.CircleGeometry(.5, 22), M.emi('#9b5cff', .9)), s * 9.6, y + .5, -17.79)); W.rects.push([s * 9.6 - 1, -19.6, s * 9.6 + 1, -17.6]); }
// 트러스
for (const z of [-15, -9]) put(new T.Mesh(box(22, .25, .25), M.std('#8888a0', { metalness: .8, roughness: .3 })), 0, 8.2, z);
// LED 월 (애니메이션 캔버스)
const ledCv = document.createElement('canvas'); ledCv.width = 512; ledCv.height = 160; const ledG = ledCv.getContext('2d'); const ledTex = NC.tex(ledCv);
put(new T.Mesh(new T.PlaneGeometry(19, 5.9), new T.MeshBasicMaterial({ map: ledTex })), 0, 4.3, -ROOM.z + .06);
put(new T.Mesh(box(19.6, 6.5, .1), M.std('#0e0b16')), 0, 4.3, -ROOM.z + .01);
const sign = NC.neonSign('추억의 나이트', 13, 2.6); put(sign, 0, 8.9, -ROOM.z + .08);
function drawLED(t, b) {
  const g = ledG; g.fillStyle = '#100820'; g.fillRect(0, 0, 512, 160);
  const n = 32, hue = (t * 20) % 360;
  for (let i = 0; i < n; i++) { const v = (.35 + .65 * Math.abs(Math.sin(i * .7 + t * 3 + Math.sin(i) * 2))) * (.55 + .45 * (1 - b.phase)); const h = v * 120; g.fillStyle = `hsl(${(hue + i * 9) % 360},90%,60%)`; g.fillRect(i * 16 + 2, 150 - h, 12, h); }
  g.font = '800 34px Arial'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = '#ff3d9a'; g.shadowBlur = 16;
  g.fillText(b.n % 16 < 8 ? '★ NIGHT FEVER 1998 ★' : 'DJ NOSTALGIA ♪ ' + Math.round(b.bpm) + ' BPM', 256 + Math.sin(t) * 20, 40); g.shadowBlur = 0;
  ledTex.needsUpdate = true;
}
W.spots.dj = { x: 0, z: -18.3, y: .5, ry: 0 };

/* 댄스플로어 (인스턴스 타일) */
const DF = Z.dance, TILE = 1.6, TX = 10, TZ = 6;
const tiles = new T.InstancedMesh(box(TILE - .07, .1, TILE - .07), new T.MeshBasicMaterial({ color: 0xffffff }), TX * TZ);
{ const o = new T.Object3D(); let k = 0; for (let i = 0; i < TX; i++) for (let j = 0; j < TZ; j++) { o.position.set(DF.x0 + (i + .5) * TILE, .05, DF.z0 + (j + .5) * TILE); o.updateMatrix(); tiles.setMatrixAt(k, o.matrix); tiles.setColorAt(k++, new T.Color(1, 1, 1)); } S.add(tiles); }
const tmpC = new T.Color();

/* 미러볼 + 반사점(빛 조각) */
const ball = put(new T.Mesh(new T.IcosahedronGeometry(1.1, 2), M.std('#e6e6f0', { metalness: 1, roughness: .1, flatShading: true, emissive: '#3a3a66' })), 0, 8.4, -7.8);
put(new T.Mesh(new T.CylinderGeometry(.03, .03, 2.2, 6), M.std('#999')), 0, 9.9, -7.8);
const SPECK = 200, speckDir = [], speckPos = new Float32Array(SPECK * 3), speckCol = new Float32Array(SPECK * 3);
for (let i = 0; i < SPECK; i++) { const y = -Math.random() * .85 + .1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - y * y); speckDir.push([Math.cos(a) * r, y, Math.sin(a) * r]); const c = new T.Color().setHSL(Math.random(), .5, .8); speckCol.set([c.r, c.g, c.b], i * 3); }
const speckGeo = new T.BufferGeometry(); speckGeo.setAttribute('position', new T.BufferAttribute(speckPos, 3)); speckGeo.setAttribute('color', new T.BufferAttribute(speckCol, 3));
S.add(new T.Points(speckGeo, new T.PointsMaterial({ size: .38, map: NC.softDot(), vertexColors: true, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false })));
function updateSpecks(yaw) {
  const B = ball.position, c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < SPECK; i++) {
    const d = speckDir[i], dx = d[0] * c - d[2] * s, dy = d[1], dz = d[0] * s + d[2] * c;
    let t = 1e9; if (dx) t = Math.min(t, ((dx > 0 ? ROOM.x : -ROOM.x) - B.x) / dx); if (dz) t = Math.min(t, ((dz > 0 ? ROOM.z : -ROOM.z) - B.z) / dz); if (dy < 0) t = Math.min(t, -B.y / dy);
    t *= .995; speckPos[i * 3] = B.x + dx * t; speckPos[i * 3 + 1] = Math.max(.03, B.y + dy * t); speckPos[i * 3 + 2] = B.z + dz * t;
  }
  speckGeo.attributes.position.needsUpdate = true;
}

/* 무빙 스팟 (빔 콘 포함) */
const spots = [];
[[-8, 8.1, -15, '#ff3d9a'], [8, 8.1, -15, '#3de6ff'], [-8, 8.1, -9, '#ffd23d'], [8, 8.1, -9, '#9b5cff']].forEach(([x, y, z, c], k) => {
  const L = new T.SpotLight(col(c), 2.4, 46, .36, .55, 1.1); L.position.set(x, y, z); const tg = new T.Object3D(); S.add(L, tg); L.target = tg;
  const geo = new T.CylinderGeometry(.05, 1.8, 11, 20, 1, true); geo.translate(0, -5.5, 0); geo.rotateX(-Math.PI / 2);
  const beam = put(new T.Mesh(geo, M.add(c, .075)), x, y, z); spots.push({ L, tg, beam, k });
  put(new T.Mesh(box(.5, .4, .6), M.std('#22222c', { metalness: .6 })), x, y + .3, z);
});
const glows = [new T.PointLight(col('#ff5cb0'), 1.25, 22), new T.PointLight(col('#5ce8ff'), 1.25, 22)]; glows[0].position.set(-5, 1.6, -8); glows[1].position.set(5, 1.6, -8); S.add(...glows);
const stageWash = new T.SpotLight(col('#fff1e6'), 1.5, 40, .75, .5, 1); stageWash.position.set(0, 9.5, -6); stageWash.target.position.set(0, 0, -16); S.add(stageWash, stageWash.target);

/* 레이저 */
const lasers = [];
{ const g = new T.CylinderGeometry(.016, .016, 1, 4, 1, true); g.translate(0, .5, 0); g.rotateX(Math.PI / 2);
  for (let i = 0; i < 12; i++) { const m = put(new T.Mesh(g, M.add('#33ff99', .5)), 0, 7.6, -18.9); m.scale.z = 38; lasers.push(m); } }
const lzTarget = new T.Vector3();

/* 헤이즈(연기) 스프라이트 */
const haze = [];
for (let i = 0; i < 30; i++) {
  const sp = new T.Sprite(new T.SpriteMaterial({ map: NC.softDot(), color: col(i % 3 ? '#b9a6ff' : '#ff9ad6'), transparent: true, opacity: .07, blending: T.AdditiveBlending, depthWrite: false }));
  const x = (Math.random() - .5) * 22, z = -18 + Math.random() * 16, y = .6 + Math.random() * 3; sp.position.set(x, y, z); sp.scale.setScalar(6 + Math.random() * 5); S.add(sp); haze.push({ sp, x, y, z, p: Math.random() * 6 });
}

/* ═════ ② 일반 테이블 · 바 ═════ */
const TABLES = [[-16, -10], [-16, -4], [-16, 2], [14, -10], [14, -4], [14, 2]].map(([x, z], i) => ({ id: i, x, z }));
const SEAT_R = 1.9;
NC.tables = TABLES; NC.tableOcc = TABLES.map(() => [null, null, null, null]);
NC.seatPos = (t, s) => { const b = TABLES[t], a = s * Math.PI / 2 + Math.PI / 4; const x = b.x + Math.cos(a) * SEAT_R, z = b.z + Math.sin(a) * SEAT_R; return { x, z, ry: Math.atan2(b.x - x, b.z - z), h: .5 }; };
NC.standPos = (t, s) => { const b = TABLES[t], a = s * Math.PI / 2 + Math.PI / 4; return { x: b.x + Math.cos(a) * 3.0, z: b.z + Math.sin(a) * 3.0 }; };
const tableTop = M.std('#5a3a9a', { roughness: .25, metalness: .45 }), stoolMat = M.std('#c42a6a', { roughness: .45 });
TABLES.forEach(tb => {
  put(new T.Mesh(new T.CylinderGeometry(1.15, 1.15, .1, 28), tableTop), tb.x, .85, tb.z);
  put(new T.Mesh(new T.CylinderGeometry(.12, .3, .85, 12), M.std('#222')), tb.x, .42, tb.z);
  put(new T.Mesh(new T.TorusGeometry(1.16, .03, 6, 40), M.emi('#ff9ad6', 1.5)), tb.x, .86, tb.z).rotation.x = Math.PI / 2;
  put(new T.Mesh(new T.SphereGeometry(.1, 10, 8), M.emi('#ffc36b', 2.2)), tb.x, 1.02, tb.z);
  for (let s = 0; s < 4; s++) { const p = NC.seatPos(tb.id, s); put(new T.Mesh(new T.CylinderGeometry(.5, .5, .5, 18), stoolMat), p.x, .25, p.z); }
  const tag = new T.Sprite(new T.SpriteMaterial({ map: NC.textTex('T' + (tb.id + 1), 128, 64, '800 44px Arial', '#ffffff', '#ff3d9a'), transparent: true, depthWrite: false })); tag.scale.set(1.2, .6, 1); tag.position.set(tb.x, 2.1, tb.z); S.add(tag);
  W.circles.push([tb.x, tb.z, 2.55]);
});
// 바
{ put(new T.Mesh(box(1.4, 1.3, 16), M.std('#6a3a9a', { roughness: .35, metalness: .2 })), 21.4, .65, -5.5);
  put(new T.Mesh(box(1.8, .12, 16.4), M.emi('#ff6fae', .8)), 21.3, 1.32, -5.5);
  put(new T.Mesh(box(.4, 3.4, 16), M.std('#3a2a5a')), 23.75, 2.2, -5.5);
  { const im = new T.InstancedMesh(new T.CylinderGeometry(.1, .13, .6, 8), new T.MeshBasicMaterial({ color: 0xffffff }), 16), o = new T.Object3D();
    for (let i = 0; i < 16; i++) { o.position.set(23.45, 2.6 + (i % 2) * .9, -12.5 + i * .95); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, col(['#ff3d9a', '#3de6ff', '#ffd23d', '#6dff8a'][i % 4])); } S.add(im); }
  for (let i = 0; i < 6; i++) { put(new T.Mesh(new T.CylinderGeometry(.28, .28, .08, 14), stoolMat), 20.1, .8, -12 + i * 2.6); put(new T.Mesh(new T.CylinderGeometry(.05, .05, .8, 6), M.std('#999', { metalness: .8 })), 20.1, .4, -12 + i * 2.6); }
  const lb = NC.neonSign('BAR · 칵테일 · 맥주 · 과일안주', 6, 1, { font: '700 74px "Malgun Gothic",sans-serif', color: '#ffe9a6', glow: '#ffb800' }); lb.position.set(23.9, 4.7, -5.5); lb.rotation.y = -Math.PI / 2; S.add(lb);
  const bl = new T.PointLight(col('#ffc890'), 1.1, 16); bl.position.set(20.5, 4, -5.5); S.add(bl);
  W.rects.push([20.6, -13.8, 24, 2.8]); W.spots.bartender = { x: 22.6, z: -5.5, ry: -Math.PI / 2 }; }

/* ═════ ④ 웨이터/부킹 통로 ═════ */
{ const cr = Z.corridor;
  const carpet = put(new T.Mesh(new T.PlaneGeometry(44, 2.4), M.std('#a3123e', { roughness: .9, emissive: '#3a0010' })), 0, .012, 6.95); carpet.rotation.x = -Math.PI / 2;
  { const pts = []; for (let x = -21; x <= 21; x += 1.5) for (const z of [5.6, 8.3]) pts.push([x, .02, z]);
    const im = new T.InstancedMesh(box(.18, .03, .18), M.glow('#ffe27a'), pts.length), o = new T.Object3D(); pts.forEach((p, i) => { o.position.set(...p); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); S.add(im); }
  put(new T.Mesh(box(1.4, 1.1, .8), M.std('#2a1d48', { roughness: .3, metalness: .4 })), 0, .55, 5.25);
  put(new T.Mesh(box(1.5, .06, .9), M.emi('#ffd23d', 1.2)), 0, 1.13, 5.25);
  const ws = NC.neonSign('🤵 WAITER', 1.6, .4, { font: '800 100px Arial', color: '#fff6c8', glow: '#ffb800', ph: 200 }); ws.position.set(0, 1.55, 5.66); S.add(ws);
  W.rects.push([-.75, 4.8, .75, 5.7]);
  W.spots.waiterStation = { x: 1.5, z: 5.3, ry: 0 };
  for (const s of [-1, 1]) { const bs = NC.neonSign('BOOKING ROAD · 부킹 통로', 7, 1.1, { font: '800 80px "Malgun Gothic",sans-serif', color: '#ffd1ea', glow: '#ff3d9a' }); bs.position.set(s * (ROOM.x - .1), 4.2, 6.95); bs.rotation.y = -s * Math.PI / 2; S.add(bs); }
  const cl = new T.PointLight(col('#ff9ad0'), .9, 26); cl.position.set(0, 4.5, 6.9); S.add(cl);
  W.corridorY = 6.95; }

/* ═════ ③ VIP 룸 ═════ */
const VIP_Z0 = 9.2, VIP_Z1 = ROOM.z, VIP_COL = ['#b07cff', '#ffc46b', '#ff6fae'];
const glassMat = new T.MeshStandardMaterial({ color: col('#c8a8ff'), transparent: true, opacity: .26, roughness: .08, metalness: .3, depthWrite: false, side: T.DoubleSide });
const frameMat = M.std('#2a1d48', { roughness: .4, metalness: .4 });
// 앞벽 아래 패널(전체 폭) — 문틈 제외하고 rect 등록
const vipCenters = [-15, 0, 15], HW = 6.5, DOOR_W = 2.4;
let wx = -ROOM.x;
vipCenters.forEach(cx => { W.rects.push([wx, VIP_Z0 - .15, cx - DOOR_W / 2, VIP_Z0 + .15]); wx = cx + DOOR_W / 2; }); W.rects.push([wx, VIP_Z0 - .15, ROOM.x, VIP_Z0 + .15]);
// 룸 사이 기둥 공간(진입 불가)
[[-ROOM.x, -21.5], [-8.5, -6.5], [6.5, 8.5], [21.5, ROOM.x]].forEach(([a, b]) => { W.rects.push([a, VIP_Z0, b, VIP_Z1]); put(new T.Mesh(box(b - a, 4.4, VIP_Z1 - VIP_Z0), M.std('#4a3a78', { roughness: .8 })), (a + b) / 2, 2.2, (VIP_Z0 + VIP_Z1) / 2); });
vipCenters.forEach((cx, i) => {
  const x0 = cx - HW, x1 = cx + HW, c = VIP_COL[i];
  // 앞 유리벽 + 프레임
  for (const [a, b] of [[x0, cx - DOOR_W / 2], [cx + DOOR_W / 2, x1]]) { put(new T.Mesh(box(b - a, 3.4, .06), glassMat), (a + b) / 2, 2.3, VIP_Z0); put(new T.Mesh(box(b - a, .6, .2), frameMat), (a + b) / 2, .3, VIP_Z0); }
  put(new T.Mesh(box(HW * 2, .4, .25), frameMat), cx, 4.2, VIP_Z0); put(new T.Mesh(box(HW * 2, .06, .06), M.emi(c, 2)), cx, 4.0, VIP_Z0 + .14);
  // 측벽 · 뒷벽
  for (const x of [x0, x1]) { put(new T.Mesh(box(.25, 4.4, VIP_Z1 - VIP_Z0), M.std('#3a2a66', { roughness: .8 })), x, 2.2, (VIP_Z0 + VIP_Z1) / 2); W.rects.push([x - .15, VIP_Z0, x + .15, VIP_Z1]); }
  put(new T.Mesh(box(HW * 2 - .3, .06, .06), M.emi(c, 1.6)), cx, 2.8, VIP_Z1 - .1);
  const fl = put(new T.Mesh(new T.PlaneGeometry(HW * 2, VIP_Z1 - VIP_Z0), M.std(i === 1 ? '#4a3418' : '#3a2050', { roughness: .85 })), cx, .014, (VIP_Z0 + VIP_Z1) / 2); fl.rotation.x = -Math.PI / 2;
  // U자 소파 + 테이블
  const sofa = M.std(i === 1 ? '#7a5a2a' : '#5a2a6a', { roughness: .55, metalness: .05 });
  put(new T.Mesh(box(11, .45, 1.3), sofa), cx, .225, 18.9); put(new T.Mesh(box(11, 1.0, .35), sofa), cx, .7, 19.7);
  for (const s of [-1, 1]) { put(new T.Mesh(box(1.3, .45, 5.4), sofa), cx + s * 5.4, .225, 15.4); put(new T.Mesh(box(.35, 1.0, 5.4), sofa), cx + s * 6.15, .7, 15.4); }
  put(new T.Mesh(box(4.2, .4, 1.8), M.std('#1a1424', { roughness: .15, metalness: .5 })), cx, .4, 16); put(new T.Mesh(box(4.25, .04, 1.85), M.emi(c, 1.4)), cx, .62, 16);
  W.rects.push([cx - 2.1, 15.1, cx + 2.1, 16.9], [x0, 18.2, x1, VIP_Z1], [x0, 12.6, x0 + 1.5, 18.2], [x1 - 1.5, 12.6, x1, 18.2]);
  // 샴페인 버킷(VIP 티어에서 표시)
  const champ = new T.Group(); champ.visible = false; champ.position.set(cx + 1.2, .62, 16);
  champ.add(new T.Mesh(new T.CylinderGeometry(.22, .17, .35, 16), M.std('#d8d8e0', { metalness: .9, roughness: .15 }))); champ.children[0].position.y = .17;
  const bt = new T.Mesh(new T.CylinderGeometry(.06, .08, .55, 10), M.std('#1a3a20', { metalness: .3, roughness: .2 })); bt.position.set(0, .45, 0); bt.rotation.z = .3; champ.add(bt); S.add(champ);
  // 조명 · 샹들리에 · 간판
  const L = new T.PointLight(col(c), 1.5, 15); L.position.set(cx, 3.6, 15); S.add(L);
  { const im = new T.InstancedMesh(new T.SphereGeometry(.07, 8, 6), M.glow(c), 7), o = new T.Object3D(); for (let k = 0; k < 7; k++) { o.position.set(cx + Math.cos(k) * .45, 3.9 - (k % 3) * .2, 15 + Math.sin(k) * .45); o.updateMatrix(); im.setMatrixAt(k, o.matrix); } S.add(im); }
  const sg = NC.neonSign(`VIP ${i + 1}`, 2.4, .8, { font: '900 150px Arial', color: '#fff', glow: c, ph: 256 }); sg.position.set(cx, 4.75, VIP_Z0 - .16); sg.rotation.y = Math.PI; S.add(sg);
  // 슬라이딩 도어 (유리 2장)
  const door = { cx, open: 0, panels: [] };
  for (const s of [-1, 1]) { const p = put(new T.Mesh(box(DOOR_W / 2, 3.3, .05), new T.MeshStandardMaterial({ color: col(c), transparent: true, opacity: .32, roughness: .1, metalness: .4, depthWrite: false })), cx + s * DOOR_W / 4, 1.7, VIP_Z0 - .06); p.userData.s = s; door.panels.push(p); }
  const doorLed = put(new T.Mesh(box(DOOR_W, .07, .07), M.emi('#6dff8a', 2)), cx, 3.45, VIP_Z0 - .1); door.led = doorLed;
  const tableC = { x: cx, z: 16 };
  const seats = [[cx - 2.2, 18.5], [cx, 18.5], [cx + 2.2, 18.5], [cx - 5.1, 15.2], [cx + 5.1, 15.2], [cx - 5.1, 13.2]].map(([x, z]) => ({ x, z, ry: Math.atan2(tableC.x - x, tableC.z - z), h: .45 }));
  W.vip.push({ id: i, cx, x0, x1, z0: VIP_Z0, z1: VIP_Z1, color: c, door, seats, occ: seats.map(() => null), light: L, champ, entry: { x: cx, z: VIP_Z0 + 2.2 }, front: { x: cx, z: 7 } });
});

/* ── 질의 함수 ── */
W.vipAt = (x, z) => { for (const v of W.vip) if (x > v.x0 + .1 && x < v.x1 - .1 && z > v.z0 + .1 && z < v.z1) return v.id; return -1; };
W.zoneAt = (x, z) => {
  const v = W.vipAt(x, z); if (v >= 0) return { name: 'vip', room: v };
  if (inR(Z.stage, x, z)) return { name: 'stage' }; if (inR(Z.dance, x, z)) return { name: 'dance' };
  if (inR(Z.corridor, x, z)) return { name: 'corridor' }; if (inR(Z.bar, x, z)) return { name: 'bar' }; if (Math.abs(x) < 9.5) return { name: 'hall' }; return { name: 'tables' };
};
W.zoneLabel = { hall: '메인 홀', stage: '메인 스테이지', dance: '댄스플로어', corridor: '부킹 통로', bar: '바', tables: '테이블존', vip: 'VIP 룸' };
NC.groundY = (x, z) => { if (x < stg.x0 || x > stg.x1) return 0; if (z <= stg.z1) return .5; if (z < stg.z1 + .9 && Math.abs(x) < 3) return .5 * (1 - (z - stg.z1) / .9); return 0; };
W.locked = i => (NC.roomLockedForMe ? NC.roomLockedForMe(i) : false);
NC.collide = W.collide = function (p, r = .4, opt = {}) {
  const rects = W.rects.slice();
  W.vip.forEach(v => { if (v.door.open < .75) rects.push([v.cx - DOOR_W / 2, VIP_Z0 - .15, v.cx + DOOR_W / 2, VIP_Z0 + .15]); });
  // 스테이지 옆면(계단 외)은 막기: 앞쪽 가장자리 바깥에서 올라오는 것 허용(낮은 무대) → 별도 처리 안 함
  for (const [x0, z0, x1, z1] of rects) {
    const cx = Math.max(x0, Math.min(p.x, x1)), cz = Math.max(z0, Math.min(p.z, z1)), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; } else { const l = p.x - x0, rr = x1 - p.x, t = p.z - z0, b = z1 - p.z, m = Math.min(l, rr, t, b); if (m === l) p.x = x0 - r; else if (m === rr) p.x = x1 + r; else if (m === t) p.z = z0 - r; else p.z = z1 + r; } }
  }
  for (const [x, z, rad] of W.circles) { const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz), R = rad + r - .4; if (d < R && d > 1e-6) { p.x = x + dx / d * R; p.z = z + dz / d * R; } }
  p.x = U.clamp(p.x, -ROOM.x + .8, ROOM.x - .8); p.z = U.clamp(p.z, -ROOM.z + .8, ROOM.z - .8);
};

/* ── 프레임 업데이트 ── */
let ledT = 0;
W.update = function (dt, t, agents) {
  const b = NC.Audio ? NC.Audio.beat() : { phase: (t * 118 / 60) % 1, n: Math.floor(t * 118 / 60), bpm: 118 };
  const kick = 1 - b.phase;
  ball.rotation.y += dt * .5; updateSpecks(ball.rotation.y);
  spots.forEach(s => { const a = t * .55 + s.k * 1.6; s.tg.position.set(Math.cos(a) * 7, 0, -8 + Math.sin(a * 1.3) * 5.5); s.beam.lookAt(s.tg.position); s.L.intensity = 2.0 + Math.sin(t * 3 + s.k) * .5 + kick * .4; });
  glows[0].intensity = 1.1 + Math.sin(t * 4) * .4; glows[1].intensity = 1.1 + Math.cos(t * 4) * .4;
  // 타일: 비트에 맞춰 물결
  for (let i = 0, k = 0; i < TX; i++) for (let j = 0; j < TZ; j++, k++) { const h = (t * .1 + (i + j) * .045) % 1, v = .35 + .4 * Math.max(0, Math.sin(t * 2 + (i * 2 + j * 3) * .6)) + kick * .25 * ((i + j + b.n) % 2); tmpC.setHSL(h, .85, v * .62); tiles.setColorAt(k, tmpC); }
  tiles.instanceColor.needsUpdate = true;
  // 레이저: 2마디마다 패턴 전환, 박자에 맞춰 깜빡임
  const pattern = Math.floor(b.n / 8) % 4, laserOn = pattern !== 3; const hue = (Math.floor(b.n / 4) * .17) % 1;
  lasers.forEach((m, i) => {
    m.visible = laserOn; if (!laserOn) return;
    const f = (i / (lasers.length - 1) - .5) * 1.8, a = pattern === 0 ? f + Math.sin(t * .9) * .5 : pattern === 1 ? f * Math.sin(t * 1.4) : f + (i % 2 ? 1 : -1) * Math.sin(t * 2) * .3;
    lzTarget.set(Math.sin(a) * 30, pattern === 2 ? 1 + Math.sin(t * 3 + i) * 2 : .4 + Math.abs(Math.sin(t * .7 + i * .3)) * 3, -18.9 + Math.cos(a) * 30); m.lookAt(lzTarget);
    m.material.color.setHSL((hue + i * .015) % 1, 1, .5).convertSRGBToLinear(); m.material.opacity = .25 + .45 * kick;
  });
  haze.forEach(h => { h.p += dt * .15; h.sp.position.set(h.x + Math.sin(h.p) * 1.5, h.y + Math.sin(h.p * 1.3) * .3, h.z + Math.cos(h.p * .8) * 1.2); h.sp.material.opacity = .055 + .02 * Math.sin(h.p * 2); });
  ledT += dt; if (ledT > 1 / 15) { ledT = 0; drawLED(t, b); }
  // 도어: 근처에 출입 가능한 사람이 있으면 열림
  W.vip.forEach(v => {
    const locked = W.locked(v.id); let want = false;
    for (const a of agents || []) if (Math.abs(a.x - v.cx) < 1.9 && Math.abs(a.z - VIP_Z0) < 2.2 && !(a.me && locked)) { want = true; break; }
    v.door.open = U.clamp(v.door.open + (want ? dt * 2.2 : -dt * 1.6), 0, 1);
    v.door.panels.forEach(p => { p.position.x = v.cx + p.userData.s * (DOOR_W / 4 + v.door.open * DOOR_W / 2.1); });
    v.door.led.material.emissive.copy(col(locked ? '#ff3355' : v.occ.some(Boolean) ? '#ffd23d' : '#6dff8a'));
    v.light.intensity = 1.3 + .25 * Math.sin(t * 1.5 + v.id);
  });
};
})();
