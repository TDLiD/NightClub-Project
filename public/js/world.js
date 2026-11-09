/* world.js — 클럽 3D 공간 v3 (실사화)
 *  ① 메인 스테이지/DJ 부스 (북쪽, 0.5m 무대 · 벨벳 커튼 · 라인어레이 스피커 · 삼각 트러스 · 무빙헤드)
 *  ② 일반 테이블 (대리석 상판·가죽 스툴·캔들·아이스버킷) · 동쪽 벽 바 (백라이트 선반·거울·펜던트 조명·맥주 탭)
 *  ③ VIP 룸 3개 (남쪽, 유리 슬라이딩 도어 · 터프팅 가죽 소파 · 크리스털 샹들리에)
 *  ④ 웨이터/부킹 통로 (아르데코 카펫 · 풋라이트 · 서쪽 끝 '2차 노래방' 입구)
 *  재질: gfx.js 의 절차적 PBR 텍스처 + 환경맵 반사. 조명: 무빙헤드 볼륨 빔 · 레이저 · 미러볼 반사점 · 연기 · LED 월
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const T = NC.THREE, S = NC.scene, M = NC.mat, U = NC.util, col = NC.col, Q = NC.quality || {};
const ROOM = { x: 24, z: 20, h: 11 };
const W = NC.world = { ROOM, rects: [], circles: [], vip: [], zones: {}, spots: {} };
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
const put = (m, x, y, z) => { m.position.set(x, y, z); S.add(m); return m; };
const pbr = (n, o) => M.pbr(n, o);

/* ── 구역 정의 ── */
const Z = W.zones = {
  stage: { x0: -11, x1: 11, z0: -20, z1: -13.2, y: .5 },
  dance: { x0: -8, x1: 8, z0: -12.6, z1: -3 },
  corridor: { x0: -24, x1: 24, z0: 4.8, z1: 9.1 },
  bar: { x0: 18.4, x1: 24, z0: -14, z1: 3 },
};
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
/* v4: 양옆 테이블존을 0.42m 높인 라운지 테라스로 (계단 3곳 · 유리 난간) → 층이 생겨 공간이 입체적으로 */
const TY = .42, TER = { inner: 11.2, z0: -14, z1: 4, westX: -ROOM.x, eastX: 19.2, steps: [-10, -4, 2], stepW: 2.2, band: .8 };
W.TY = TY; W.terrace = TER;

/* ── 공용 재질 ── */
const MAT = {
  floor: pbr('marble', { repeat: [12, 10], roughness: 1, metalness: .05, env: 1.3, gen: { a: '#1d1826', b: '#6f6488' } }),
  stageFloor: pbr('wood', { repeat: [6, 2], roughness: .55, env: 1.2, gen: { a: '#120c0a', b: '#3a2418' } }),
  wood: pbr('wood', { repeat: [2, 1], roughness: .8, gen: { a: '#2c1a10', b: '#6a4026' } }),
  woodWall: pbr('wood', { repeat: [24, 1], roughness: .9, gen: { a: '#1e120c', b: '#4a2c1a' } }),
  velvet: pbr('tufted', { repeat: [24, 3], color: '#5b3a8c', roughness: 1, normalScale: 1.2 }),
  velvetSide: pbr('tufted', { repeat: [20, 3], color: '#4d3482', roughness: 1, normalScale: 1.2 }),
  leather: pbr('tufted', { repeat: [5, 1], color: '#7a1f3d', roughness: 1, gen: { leather: true, cells: 4 }, env: .8 }),
  leatherPlain: pbr('leather', { repeat: [2, 2], color: '#8a2446', roughness: 1, env: .9 }),
  leatherGold: pbr('tufted', { repeat: [5, 1], color: '#8a6a3a', roughness: 1, gen: { leather: true, cells: 4 }, env: .9 }),
  marbleTop: pbr('marble', { repeat: [1, 1], roughness: .9, env: 1.4, gen: { a: '#e8e2ec', b: '#6b6276' } }),
  marbleDark: pbr('marble', { repeat: [2, 1], roughness: .8, env: 1.4, gen: { a: '#15121b', b: '#8a7c9a' } }),
  carpet: pbr('carpet', { repeat: [22, 1.2], roughness: 1, gen: { a: '#6e0b27', b: '#d4a24a' } }),
  ceiling: pbr('ceiling', { repeat: [16, 13], roughness: 1 }),
  grill: pbr('grill', { repeat: [2, 3], roughness: 1, metalness: .3 }),
  brushed: pbr('brushed', { repeat: [4, 1], color: '#b8bcc8', roughness: 1, metalness: .9, env: 1.2 }),
  chrome: M.std('#e8e8f0', { roughness: .08, metalness: 1 }),
  gold: M.std('#d9b056', { roughness: .22, metalness: 1 }),
  black: M.std('#0d0b12', { roughness: .35, metalness: .2 }),
  matte: M.std('#141119', { roughness: .85 }),
};

/* ── 기본 조명 ── */
S.background = col('#120c1e');
S.fog = new T.FogExp2(col('#2a1f44'), .0085);
S.add(new T.AmbientLight(col('#bfb0ea'), .34));
S.add(new T.HemisphereLight(col('#d8ccff'), col('#3d2c5c'), .5));
if (NC.buildEnv) { S.environment = NC.buildEnv(); }
// 그림자용 키 라이트 (홀 전체를 덮는 천장 워시)
const key = new T.SpotLight(col('#ffe9d8'), .75, 60, 1.05, .6, 1.2); key.position.set(0, 10.6, -2); key.target.position.set(0, 0, -5); S.add(key, key.target);
if (Q.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .03; key.shadow.camera.near = 2; key.shadow.camera.far = 30; }

/* ── 바닥 · 벽 · 천장 ── */
const floor = put(new T.Mesh(new T.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), MAT.floor), 0, 0, 0); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = !!Q.shadows;
const ceil = put(new T.Mesh(new T.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), MAT.ceiling), 0, ROOM.h, 0); ceil.rotation.x = Math.PI / 2;
const refl = NC.reflector && NC.reflector(ROOM.x * 2, ROOM.z * 2, { strength: .34 }); if (refl) { refl.userData.dyn = true; S.add(refl); }
// 벽: 아래 원목 웨인스코팅(1.3m) + 위 벨벳 터프팅 패널
[[0, -ROOM.z, 0, ROOM.x * 2, MAT.velvet], [0, ROOM.z, Math.PI, ROOM.x * 2, MAT.velvet], [-ROOM.x, 0, Math.PI / 2, ROOM.z * 2, MAT.velvetSide], [ROOM.x, 0, -Math.PI / 2, ROOM.z * 2, MAT.velvetSide]].forEach(([x, z, r, len, vm]) => {
  const up = put(new T.Mesh(new T.PlaneGeometry(len, ROOM.h - 1.3), vm), x, 1.3 + (ROOM.h - 1.3) / 2, z); up.rotation.y = r;
  const lo = put(new T.Mesh(new T.PlaneGeometry(len, 1.3), MAT.woodWall), x, .65, z); lo.rotation.y = r;
  const rail = put(new T.Mesh(box(len, .06, .08), MAT.gold), x, 1.32, z); rail.rotation.y = r;
});
// 벽 네온 띠 + 세로 네온 기둥
[[0, -ROOM.z + .05, ROOM.x * 2, 0], [-ROOM.x + .05, 0, ROOM.z * 2, Math.PI / 2], [ROOM.x - .05, 0, ROOM.z * 2, Math.PI / 2], [0, ROOM.z - .05, ROOM.x * 2, 0]].forEach(([x, z, len, r], i) => {
  const m = put(new T.Mesh(box(len, .07, .07), M.emi(i % 2 ? '#3de6ff' : '#ff3d9a', 3)), x, ROOM.h - .4, z); m.rotation.y = r;
});
for (let z = -14; z <= 2; z += 8) for (const s of [-1, 1]) { put(new T.Mesh(box(.5, ROOM.h, .5), MAT.marbleDark), s * (ROOM.x - .25), ROOM.h / 2, z); put(new T.Mesh(box(.06, 7, .06), M.emi(s < 0 ? '#ff7ad1' : '#7ad7ff', 3.2)), s * (ROOM.x - .52), 4.6, z); }
// 천장 다운라이트(별빛처럼) — 인스턴스
{ const pts = []; for (let x = -21; x <= 21; x += 3) for (let z = -11; z <= 18; z += 3) if (!(Math.abs(x) < 9 && z < -2)) pts.push([x, z]);
  const g = new T.CircleGeometry(.09, 12); g.rotateX(Math.PI / 2); const im = new T.InstancedMesh(g, M.glow('#ffe2b8'), pts.length), o = new T.Object3D();
  im.material.color.multiplyScalar(4); pts.forEach(([x, z], i) => { o.position.set(x, ROOM.h - .01, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); S.add(im); }

/* v4: 격자 코퍼 천장 (깊이감) */
{ const beamM = M.std('#120c1a', { roughness: .45, metalness: .3 }), n = [], step = 4;
  for (let x = -20; x <= 20; x += step) n.push([x, 0, 1, ROOM.z * 2 - 2, 'z']);
  for (let z = -16; z <= 18; z += step) n.push([0, z, ROOM.x * 2 - 2, 1, 'x']);
  const bg = new T.BoxGeometry(1, .5, 1), im = new T.InstancedMesh(bg, beamM, n.length), trim = new T.InstancedMesh(new T.BoxGeometry(1, .03, 1), M.emi('#b98cff', 1.6), n.length * 2), o = new T.Object3D(); let k = 0;
  n.forEach(([x, z, w, d, ax], i) => { o.position.set(x, ROOM.h - .25, z); o.scale.set(ax === 'z' ? .32 : w, 1, ax === 'z' ? d : .32); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    for (const s of [-1, 1]) { o.position.set(x + (ax === 'z' ? s * .17 : 0), ROOM.h - .48, z + (ax === 'x' ? s * .17 : 0)); o.scale.set(ax === 'z' ? .02 : w, 1, ax === 'z' ? d : .02); o.updateMatrix(); trim.setMatrixAt(k++, o.matrix); } });
  S.add(im, trim); }
/* v4: 프로시니엄 아치 (무대 액자) + 마키 전구 */
{ const pz = -13.15, velvetCol = pbr('tufted', { repeat: [1, 8], color: '#6a1030', roughness: 1 });
  for (const s of [-1, 1]) { put(new T.Mesh(box(1.2, 10.2, 1.0), velvetCol), s * 11.9, 5.1, pz); put(new T.Mesh(box(1.3, .12, 1.1), MAT.gold), s * 11.9, .06, pz); put(new T.Mesh(box(.06, 10.2, .06), MAT.gold), s * 11.3, 5.1, pz + .5); W.rects.push([s * 11.9 - .6, pz - .5, s * 11.9 + .6, pz + .5]); }
  put(new T.Mesh(box(25, 1.3, 1.0), velvetCol), 0, 10.35, pz); put(new T.Mesh(box(25, .08, 1.05), MAT.gold), 0, 9.68, pz);
  const bulbs = [], bulbG = new T.SphereGeometry(.07, 10, 8);
  for (let x = -11.2; x <= 11.2; x += .55) bulbs.push([x, 9.55, pz + .52]);
  for (const s of [-1, 1]) for (let y = .6; y < 9.4; y += .55) bulbs.push([s * 11.25, y, pz + .52]);
  const bm = new T.InstancedMesh(bulbG, new T.MeshBasicMaterial({ color: 0xffffff }), bulbs.length), o = new T.Object3D(); bulbs.forEach((p, i) => { o.position.set(...p); o.updateMatrix(); bm.setMatrixAt(i, o.matrix); bm.setColorAt(i, new T.Color(3, 2.2, 1.2)); }); S.add(bm); W.marquee = bm; W.marqueeN = bulbs.length; }
/* v4: 벽·바닥 접합부 AO(부드러운 음영) — 구석이 어두워져 깊이감이 살아남 */
{ const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.65)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  const ao = new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false });
  [[0, -ROOM.z, 0, ROOM.x * 2], [0, ROOM.z, Math.PI, ROOM.x * 2], [-ROOM.x, 0, Math.PI / 2, ROOM.z * 2], [ROOM.x, 0, -Math.PI / 2, ROOM.z * 2]].forEach(([x, z, r, len]) => {
    const wv = put(new T.Mesh(new T.PlaneGeometry(len, .9), ao), x + Math.sin(r) * .02, .45, z + Math.cos(r) * .02); wv.rotation.y = r;                               // 벽 아래
    const fl = put(new T.Mesh(new T.PlaneGeometry(len, 1.2), ao), x + Math.sin(r) * .6, .008, z + Math.cos(r) * .6); fl.rotation.set(-Math.PI / 2, 0, r + Math.PI); }); // 바닥 가장자리
  const blobs = [[-16, -10, 3.6], [-16, -4, 3.6], [-16, 2, 3.6], [14, -10, 3.6], [14, -4, 3.6], [14, 2, 3.6]];
  blobs.forEach(([x, z, r]) => { const b = NC.contactShadow(r, r); b.position.set(x, TY + .012, z); S.add(b); });
  [[0, -17.4, 8.5, 2.2], [-9.6, -18.6, 2.6, 2.2], [9.6, -18.6, 2.6, 2.2], [21.4, -5.5, 2.4, 17]].forEach(([x, z, w, d]) => { const b = NC.contactShadow(w, d); b.position.set(x, x === 0 || Math.abs(x) > 9 && z < -18 ? .512 : .012, z); S.add(b); }); }
/* ═════ ① 메인 스테이지 / DJ 부스 ═════ */
const stg = Z.stage;
put(new T.Mesh(box(stg.x1 - stg.x0, .5, stg.z1 - stg.z0), MAT.stageFloor), 0, .25, (stg.z0 + stg.z1) / 2).receiveShadow = !!Q.shadows;
put(new T.Mesh(box(stg.x1 - stg.x0 + .1, .5, .06), MAT.black), 0, .25, stg.z1 + .02);
put(new T.Mesh(box(stg.x1 - stg.x0, .035, .04), M.emi('#ffd23d', 3.5)), 0, .48, stg.z1 + .06);
for (let i = 0; i < 3; i++) { put(new T.Mesh(box(6, .17 * (i + 1), .35), MAT.stageFloor), 0, .085 * (i + 1), stg.z1 + .55 - i * .35); put(new T.Mesh(box(6, .015, .02), M.emi('#ffffff', 2)), 0, .17 * (i + 1) + .005, stg.z1 + .72 - i * .35); }
for (let x = -9; x <= 9; x += 3) put(new T.Mesh(box(.04, .02, 6), M.emi('#ff3d9a', 2.2)), x, .51, -16.6);
// 벨벳 커튼 (주름 = 사인 변위)
{ const cg = new T.PlaneGeometry(4.2, 9.6, 60, 1), p = cg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 9) * .14 + Math.sin(x * 23) * .03); } cg.computeVertexNormals();
  const cm = pbr('leather', { repeat: [6, 8], color: '#7a0c22', roughness: 1, normalScale: .4, side: T.DoubleSide }); cm.emissive = col('#1a0006');
  for (const s of [-1, 1]) { put(new T.Mesh(cg, cm), s * 11.6, 4.8 + .5, -ROOM.z + .5); }
  put(new T.Mesh(new T.PlaneGeometry(27, 1.2, 80, 1).translate(0, 0, 0), cm), 0, 10.3, -ROOM.z + .6); }
// DJ 부스: 원목 전면 + 브러시드 메탈 상판 + CDJ·믹서
put(new T.Mesh(box(7.6, 1.1, 1.4), MAT.wood), 0, 1.05, -17.4);
put(new T.Mesh(box(7.8, .06, 1.55), MAT.brushed), 0, 1.63, -17.4);
put(new T.Mesh(box(7.6, .06, .05), M.emi('#3de6ff', 4)), 0, 1.0, -16.68);
{ const logo = NC.neonSign('DJ NOSTALGIA', 3.2, .55, { font: '900 120px Arial', color: '#e8fbff', glow: '#3de6ff', ph: 200 }); logo.position.set(0, 1.25, -16.68); S.add(logo); }
[-2.4, -.9, .9, 2.4].forEach((x, i) => { if (i === 1 || i === 2) return; put(new T.Mesh(box(1.1, .1, .9), MAT.black), x, 1.71, -17.4); put(new T.Mesh(new T.CylinderGeometry(.34, .34, .03, 32), M.std('#22222a', { roughness: .3, metalness: .6 })), x, 1.78, -17.35); put(new T.Mesh(box(.5, .01, .2), M.emi('#4fc3ff', 2.4)), x, 1.765, -17.75); });
put(new T.Mesh(box(1.4, .12, .9), MAT.black), 0, 1.72, -17.4);
{ const knobs = new T.InstancedMesh(new T.CylinderGeometry(.03, .03, .04, 10), M.emi('#ff3d9a', 1.6), 24), o = new T.Object3D(); for (let i = 0; i < 24; i++) { o.position.set(-.5 + (i % 6) * .2, 1.8, -17.7 + Math.floor(i / 6) * .18); o.updateMatrix(); knobs.setMatrixAt(i, o.matrix); } S.add(knobs); }
W.rects.push([-4, -18.4, 4, -16.6]);
// 라인어레이(천장 매달림) + 서브우퍼(바닥)
for (const s of [-1, 1]) {
  for (let k = 0; k < 6; k++) { const cab = put(new T.Mesh(box(1.3, .42, .8), MAT.matte), s * 9.2, 8.6 - k * .44, -14.6 + k * .03); cab.rotation.x = k * .05; const gr = put(new T.Mesh(new T.PlaneGeometry(1.2, .34), MAT.grill), s * 9.2, 8.6 - k * .44, -14.19 + k * .03); gr.rotation.x = k * .05; }
  put(new T.Mesh(box(1.9, 1.3, 1.5), MAT.matte), s * 9.6, 1.15, -18.6); put(new T.Mesh(new T.PlaneGeometry(1.8, 1.2), MAT.grill), s * 9.6, 1.15, -17.84);
  put(new T.Mesh(box(1.9, 1.3, 1.5), MAT.matte), s * 9.6, 2.45, -18.6); put(new T.Mesh(new T.PlaneGeometry(1.8, 1.2), MAT.grill), s * 9.6, 2.45, -17.84);
  W.rects.push([s * 9.6 - 1, -19.6, s * 9.6 + 1, -17.6]);
}
// 삼각 트러스 (인스턴스 파이프)
{ const tube = new T.CylinderGeometry(.035, .035, 1, 6), pipes = [];
  const seg = (a, b) => pipes.push([a, b]);
  for (const z of [-15, -9]) { const y = 8.2, L = 22, x0 = -11; const C = [[0, .22, 0], [0, -.12, -.2], [0, -.12, .2]];
    C.forEach(c => seg([x0, y + c[1], z + c[2]], [x0 + L, y + c[1], z + c[2]]));
    for (let x = x0; x < x0 + L; x += .55) { for (let k = 0; k < 3; k++) { const a = C[k], b = C[(k + 1) % 3]; seg([x, y + a[1], z + a[2]], [x + .55, y + b[1], z + b[2]]); } } }
  for (const x of [-11, 11]) for (const z of [-15, -9]) seg([x, .5, z], [x, 8.2, z]);
  const im = new T.InstancedMesh(tube, MAT.chrome, pipes.length), o = new T.Object3D(), va = new T.Vector3(), vb = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  pipes.forEach(([a, b], i) => { va.set(...a); vb.set(...b); const d = vb.clone().sub(va), L = d.length(); o.position.copy(va).add(vb).multiplyScalar(.5); o.quaternion.setFromUnitVectors(up, d.normalize()); o.scale.set(1, L, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); S.add(im); }
// LED 월 (픽셀 그리드가 보이는 고해상도 캔버스)
const ledCv = document.createElement('canvas'); ledCv.width = 1024; ledCv.height = 320; const ledG = ledCv.getContext('2d'); const ledTex = NC.tex(ledCv);
const ledMask = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 320; const g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.55)'; for (let x = 0; x < 1024; x += 4) g.fillRect(x, 0, 1, 320); for (let y = 0; y < 320; y += 4) g.fillRect(0, y, 1024, 1); return c; })();
const ledMat = new T.MeshBasicMaterial({ map: ledTex }); ledMat.color.setScalar(1.6);
put(new T.Mesh(new T.PlaneGeometry(19, 5.9), ledMat), 0, 4.3, -ROOM.z + .06);
put(new T.Mesh(box(19.6, 6.5, .1), MAT.black), 0, 4.3, -ROOM.z + .01);
const sign = NC.neonSign('추억의 나이트', 13, 2.6); sign.material.color.setScalar(2.2); put(sign, 0, 8.9, -ROOM.z + .08);
function drawLED(t, b) {
  const g = ledG; g.fillStyle = '#07030f'; g.fillRect(0, 0, 1024, 320);
  const hue = (t * 20) % 360, gr = g.createLinearGradient(0, 0, 1024, 320); gr.addColorStop(0, `hsla(${hue},80%,25%,.9)`); gr.addColorStop(1, `hsla(${(hue + 120) % 360},80%,20%,.9)`); g.fillStyle = gr; g.fillRect(0, 0, 1024, 320);
  for (let i = 0; i < 48; i++) { const v = (.35 + .65 * Math.abs(Math.sin(i * .7 + t * 3 + Math.sin(i) * 2))) * (.55 + .45 * (1 - b.phase)); const h = v * 230; g.fillStyle = `hsl(${(hue + i * 7) % 360},95%,62%)`; g.fillRect(i * 21.3 + 2, 305 - h, 16, h); }
  g.font = '900 64px Arial'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = '#ff3d9a'; g.shadowBlur = 26;
  g.fillText(b.n % 16 < 8 ? '★ NIGHT FEVER 1998 ★' : 'DJ NOSTALGIA ♪ ' + Math.round(b.bpm) + ' BPM', 512 + Math.sin(t) * 40, 80); g.shadowBlur = 0;
  g.drawImage(ledMask, 0, 0); ledTex.needsUpdate = true;
}
W.spots.dj = { x: 0, z: -18.3, y: .5, ry: 0 };

/* 댄스플로어: LED 타일 + 위에 얹은 강화유리(반사) */
const DF = Z.dance, TILE = 1.6, TX = 10, TZ = 6;
const tiles = new T.InstancedMesh(box(TILE - .06, .1, TILE - .06), new T.MeshBasicMaterial({ color: 0xffffff }), TX * TZ);
{ const o = new T.Object3D(); let k = 0; for (let i = 0; i < TX; i++) for (let j = 0; j < TZ; j++) { o.position.set(DF.x0 + (i + .5) * TILE, .05, DF.z0 + (j + .5) * TILE); o.updateMatrix(); tiles.setMatrixAt(k, o.matrix); tiles.setColorAt(k++, new T.Color(1, 1, 1)); } S.add(tiles); }
{ const gl = put(new T.Mesh(new T.PlaneGeometry(DF.x1 - DF.x0, DF.z1 - DF.z0), new T.MeshStandardMaterial({ color: 0x050308, roughness: .04, metalness: .2, transparent: true, opacity: .42, envMapIntensity: 1.6 })), (DF.x0 + DF.x1) / 2, .106, (DF.z0 + DF.z1) / 2); gl.rotation.x = -Math.PI / 2; gl.receiveShadow = !!Q.shadows;
  put(new T.Mesh(box(DF.x1 - DF.x0 + .2, .12, .1), MAT.chrome), (DF.x0 + DF.x1) / 2, .06, DF.z0 - .05); put(new T.Mesh(box(DF.x1 - DF.x0 + .2, .12, .1), MAT.chrome), (DF.x0 + DF.x1) / 2, .06, DF.z1 + .05); }
const tmpC = new T.Color();

/* 미러볼 + 반사점 */
const ball = put(new T.Mesh(new T.IcosahedronGeometry(1.1, 3), M.std('#f2f2fa', { metalness: 1, roughness: .04, flatShading: true })), 0, 8.4, -7.8); ball.material.envMapIntensity = 2.2;
put(new T.Mesh(new T.CylinderGeometry(.02, .02, 2.2, 6), MAT.chrome), 0, 9.9, -7.8);
const ballSpot = new T.SpotLight(col('#ffffff'), 1.2, 14, .12, .3, 1); ballSpot.position.set(0, ROOM.h - .3, -2); ballSpot.target = ball; S.add(ballSpot);
const SPECK = 260, speckDir = [], speckPos = new Float32Array(SPECK * 3), speckCol = new Float32Array(SPECK * 3);
for (let i = 0; i < SPECK; i++) { const y = -Math.random() * .85 + .1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - y * y); speckDir.push([Math.cos(a) * r, y, Math.sin(a) * r]); const c = new T.Color().setHSL(Math.random(), .35, .8).multiplyScalar(1.25); speckCol.set([c.r, c.g, c.b], i * 3); }
const speckGeo = new T.BufferGeometry(); speckGeo.setAttribute('position', new T.BufferAttribute(speckPos, 3)); speckGeo.setAttribute('color', new T.BufferAttribute(speckCol, 3));
S.add(new T.Points(speckGeo, new T.PointsMaterial({ size: .2, map: NC.softDot(), vertexColors: true, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false })));
function updateSpecks(yaw) {
  const B = ball.position, c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < SPECK; i++) {
    const d = speckDir[i], dx = d[0] * c - d[2] * s, dy = d[1], dz = d[0] * s + d[2] * c;
    let t = 1e9; if (dx) t = Math.min(t, ((dx > 0 ? ROOM.x : -ROOM.x) - B.x) / dx); if (dz) t = Math.min(t, ((dz > 0 ? ROOM.z : -ROOM.z) - B.z) / dz); if (dy < 0) t = Math.min(t, -B.y / dy);
    t *= .995; speckPos[i * 3] = B.x + dx * t; speckPos[i * 3 + 1] = Math.max(.03, B.y + dy * t); speckPos[i * 3 + 2] = B.z + dz * t;
  }
  speckGeo.attributes.position.needsUpdate = true;
}

/* 무빙헤드 (요크 + 헤드 + 렌즈 + 볼륨 빔) */
const spots = [];
[[-8, 7.85, -15, '#ff3d9a'], [8, 7.85, -15, '#3de6ff'], [-8, 7.85, -9, '#ffd23d'], [8, 7.85, -9, '#9b5cff'], [-3, 7.85, -15, '#ffffff'], [3, 7.85, -9, '#ff6a3d']].forEach(([x, y, z, c], k) => {
  const real = k < 4;      // 실제 광원은 4개(성능), 나머지는 빔만
  let L = null, tg = new T.Object3D(); S.add(tg);
  if (real) { L = new T.SpotLight(col(c), 2.6, 46, .3, .5, 1.1); L.position.set(x, y - .3, z); S.add(L); L.target = tg; }
  const base = put(new T.Mesh(box(.42, .14, .42), MAT.matte), x, y + .2, z);
  const yoke = new T.Group(); yoke.position.set(x, y, z); S.add(yoke);
  yoke.add(new T.Mesh(box(.5, .06, .12), MAT.matte)); [-.23, .23].forEach(dx => { const a = new T.Mesh(box(.05, .32, .12), MAT.matte); a.position.set(dx, -.16, 0); yoke.add(a); });
  const head = new T.Group(); head.position.y = -.3; yoke.add(head);
  const hc = new T.Mesh(new T.CylinderGeometry(.16, .2, .42, 18), MAT.matte); hc.rotation.x = Math.PI / 2; head.add(hc);
  const lens = new T.Mesh(new T.CircleGeometry(.15, 20), M.glow(c)); lens.material.color.multiplyScalar(6); lens.position.z = .22; head.add(lens);
  const geo = new T.CylinderGeometry(.12, 2.1, 12, 28, 1, true); geo.translate(0, -6, 0); geo.rotateX(-Math.PI / 2);
  const beam = new T.Mesh(geo, M.beam(c, real ? .55 : .45)); head.add(beam); beam.position.z = .2;
  spots.push({ L, tg, yoke, head, beam, k, pos: new T.Vector3(x, y - .3, z) }); void base;
});
const glows = [new T.PointLight(col('#ff5cb0'), 1.3, 20), new T.PointLight(col('#5ce8ff'), 1.3, 20)]; glows[0].position.set(-5, 1.6, -8); glows[1].position.set(5, 1.6, -8); S.add(...glows);
const stageWash = new T.SpotLight(col('#fff1e6'), 1.6, 40, .75, .5, 1); stageWash.position.set(0, 9.5, -6); stageWash.target.position.set(0, 0, -16); S.add(stageWash, stageWash.target);

/* 레이저 */
const lasers = [];
{ const g = new T.CylinderGeometry(.012, .012, 1, 4, 1, true); g.translate(0, .5, 0); g.rotateX(Math.PI / 2);
  for (let i = 0; i < 14; i++) { const m = put(new T.Mesh(g, M.add('#33ff99', .6)), 0, 7.6, -18.9); m.scale.z = 38; m.userData.dyn = true; lasers.push(m); } }
const lzTarget = new T.Vector3();

/* 연기(헤이즈): fBm 구름 스프라이트 */
const haze = [], cloudTex = NC.TexLib ? NC.TexLib.texture('cloud', 'map') : NC.softDot();
for (let i = 0; i < 26; i++) {
  const sp = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, color: col(['#b9a6ff', '#ff9ad6', '#8fe8ff'][i % 3]), transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false }));
  const x = (Math.random() - .5) * 26, z = -18 + Math.random() * 20, y = .8 + Math.random() * 4.5; sp.position.set(x, y, z); sp.scale.setScalar(7 + Math.random() * 6); sp.material.rotation = Math.random() * 6; S.add(sp); haze.push({ sp, x, y, z, p: Math.random() * 6, r: (Math.random() - .5) * .05 });
}

/* ═════ ② 일반 테이블 · 바 ═════ */
const TABLES = [[-16, -10], [-16, -4], [-16, 2], [14, -10], [14, -4], [14, 2]].map(([x, z], i) => ({ id: i, x, z }));
const tblStart = S.children.length;
const SEAT_R = 1.9;
NC.tables = TABLES; NC.tableOcc = TABLES.map(() => [null, null, null, null]);
NC.seatPos = (t, s) => { const b = TABLES[t], a = s * Math.PI / 2 + Math.PI / 4; const x = b.x + Math.cos(a) * SEAT_R, z = b.z + Math.sin(a) * SEAT_R; return { x, z, ry: Math.atan2(b.x - x, b.z - z), h: .5 + TY }; };
NC.standPos = (t, s) => { const b = TABLES[t], a = s * Math.PI / 2 + Math.PI / 4; return { x: b.x + Math.cos(a) * 3.0, z: b.z + Math.sin(a) * 3.0 }; };
const glassMat = new T.MeshStandardMaterial({ color: col('#ffffff'), roughness: .03, metalness: .1, transparent: true, opacity: .28, envMapIntensity: 2, side: T.DoubleSide, depthWrite: false });
const candles = [];
TABLES.forEach(tb => {
  put(new T.Mesh(new T.CylinderGeometry(1.15, 1.15, .07, 40), MAT.marbleTop), tb.x, .86, tb.z);
  put(new T.Mesh(new T.TorusGeometry(1.15, .025, 8, 48), MAT.gold), tb.x, .86, tb.z).rotation.x = Math.PI / 2;
  put(new T.Mesh(new T.CylinderGeometry(.07, .07, .8, 12), MAT.chrome), tb.x, .43, tb.z);
  put(new T.Mesh(new T.CylinderGeometry(.5, .55, .04, 24), MAT.chrome), tb.x, .02, tb.z);
  // 캔들 · 아이스버킷 · 잔
  const cg = put(new T.Mesh(new T.CylinderGeometry(.07, .06, .14, 14, 1, true), glassMat), tb.x - .3, .97, tb.z + .2);
  const fl = put(new T.Mesh(new T.SphereGeometry(.028, 8, 6), M.glow('#ffb35a')), tb.x - .3, .99, tb.z + .2); fl.material = fl.material.clone(); fl.scale.y = 1.6; candles.push(fl); void cg;
  put(new T.Mesh(new T.CylinderGeometry(.16, .12, .26, 18), MAT.chrome), tb.x + .25, 1.02, tb.z - .15);
  [[-.04, '#1f4a28'], [.06, '#4a2a10']].forEach(([dx, c]) => { const b = put(new T.Mesh(new T.CylinderGeometry(.04, .05, .34, 10), M.std(c, { roughness: .08, metalness: .3 })), tb.x + .25 + dx, 1.2, tb.z - .15); b.rotation.z = dx * 3; });
  [[.45, .45], [-.55, -.3], [.1, -.6]].forEach(([dx, dz]) => put(new T.Mesh(new T.CylinderGeometry(.035, .028, .11, 12, 1, true), glassMat), tb.x + dx, .95, tb.z + dz));
  for (let s = 0; s < 4; s++) { const p = NC.seatPos(tb.id, s); put(new T.Mesh(new T.CylinderGeometry(.46, .42, .14, 24), MAT.leatherPlain), p.x, .47, p.z); put(new T.Mesh(new T.CylinderGeometry(.05, .05, .4, 8), MAT.chrome), p.x, .2, p.z); put(new T.Mesh(new T.TorusGeometry(.3, .015, 6, 24), MAT.gold), p.x, .16, p.z).rotation.x = Math.PI / 2; }
  const tag = new T.Sprite(new T.SpriteMaterial({ map: NC.textTex('T' + (tb.id + 1), 128, 64, '800 44px Arial', '#ffffff', '#ff3d9a'), transparent: true, depthWrite: false })); tag.scale.set(1.0, .5, 1); tag.position.set(tb.x, 2.2, tb.z); S.add(tag);
  // 테이블 위 작은 펜던트(빛 웅덩이)
  put(new T.Mesh(new T.CylinderGeometry(.005, .005, 6.5, 4), MAT.black), tb.x, 7.75, tb.z);
  const shade = put(new T.Mesh(new T.ConeGeometry(.32, .3, 24, 1, true), M.std('#1a1410', { roughness: .4, metalness: .6, side: T.DoubleSide })), tb.x, 4.4, tb.z);
  put(new T.Mesh(new T.SphereGeometry(.09, 12, 8), M.glow('#ffd29a')), tb.x, 4.3, tb.z).material.color.multiplyScalar(5); void shade;
  W.circles.push([tb.x, tb.z, 2.55]);
});
for (let i = tblStart; i < S.children.length; i++) S.children[i].position.y += TY;
/* 테라스 바닥 · 라이저 · 계단 · 유리 난간 */
{ const deck = pbr('wood', { repeat: [6, 9], roughness: .6, env: 1.2, gen: { a: '#1a0f0b', b: '#4a2c1a' } }), riser = pbr('marble', { repeat: [8, 1], roughness: .9, gen: { a: '#120e18', b: '#5a4a6a' } });
  const glassR = new T.MeshStandardMaterial({ color: col('#8a7ab8'), transparent: true, opacity: .07, roughness: .02, metalness: .5, envMapIntensity: .8, depthWrite: false, side: T.DoubleSide });
  for (const side of [-1, 1]) {
    const xa = side < 0 ? TER.westX : TER.inner, xb = side < 0 ? -TER.inner : TER.eastX, cx = (xa + xb) / 2, w = xb - xa, d = TER.z1 - TER.z0, cz = (TER.z0 + TER.z1) / 2;
    const top = put(new T.Mesh(box(w, TY, d), deck), cx, TY / 2, cz); top.receiveShadow = !!Q.shadows;
    const edgeX = side < 0 ? -TER.inner : TER.inner;
    put(new T.Mesh(box(.04, TY - .02, d), riser), edgeX + side * -.02 * -1, TY / 2, cz);
    put(new T.Mesh(box(.05, .03, d), M.emi('#ffcf7a', 3)), edgeX, TY + .005, cz);
    put(new T.Mesh(box(w, .03, .05), M.emi('#ffcf7a', 2.4)), cx, TY + .005, TER.z1);
    // 계단 (2단, 디딤판 LED)
    TER.steps.forEach(sz => { for (let k = 0; k < 2; k++) { const hx = edgeX - side * (TER.band * (k + .5) / 2) - side * 0 , h = TY * (2 - k) / 2; const st = put(new T.Mesh(box(TER.band / 2, h, TER.stepW), deck), edgeX - side * (TER.band / 4 + k * TER.band / 2), h / 2, sz); st.receiveShadow = !!Q.shadows; put(new T.Mesh(box(.03, .02, TER.stepW), M.emi('#ffffff', 2.2)), edgeX - side * (k * TER.band / 2) - side * .015, h + .01, sz); void hx; } });
    // 난간: 계단 구간을 뺀 나머지
    const gaps = TER.steps.map(z => [z - TER.stepW / 2, z + TER.stepW / 2]).sort((a, b) => a[0] - b[0]); let z0 = TER.z0;
    const segs = []; gaps.forEach(([a, b]) => { segs.push([z0, a]); z0 = b; }); segs.push([z0, TER.z1]);
    segs.forEach(([a, b]) => { if (b - a < .3) return; const L = b - a, mz = (a + b) / 2;
      put(new T.Mesh(box(.03, .9, L), glassR), edgeX, TY + .48, mz);
      put(new T.Mesh(new T.CylinderGeometry(.03, .03, L, 10).rotateX(Math.PI / 2), MAT.gold), edgeX, TY + .95, mz);
      for (let z = a + .05; z <= b; z += Math.max(.6, L / Math.ceil(L / 1.6))) put(new T.Mesh(new T.CylinderGeometry(.02, .02, .95, 8), MAT.chrome), edgeX, TY + .475, z);
      W.rects.push([edgeX - .08, a, edgeX + .08, b]); });
    // 바 쪽(동쪽 바깥) 가장자리: 계단 1곳(z -5.5) + 난간
    if (side > 0) { const ex = TER.eastX; [[TER.z0, -6.6], [-4.4, TER.z1]].forEach(([a, b]) => { put(new T.Mesh(box(.03, .9, b - a), glassR), ex, TY + .48, (a + b) / 2); put(new T.Mesh(new T.CylinderGeometry(.03, .03, b - a, 10).rotateX(Math.PI / 2), MAT.gold), ex, TY + .95, (a + b) / 2); W.rects.push([ex - .08, a, ex + .08, b]); });
      for (let k = 0; k < 2; k++) { const h = TY * (2 - k) / 2; put(new T.Mesh(box(.4, h, 2.2), deck), ex + .2 + k * .4, h / 2, -5.5); } put(new T.Mesh(box(w + .02, TY, .04), riser), cx, TY / 2, TER.z1 + .02); }
    else put(new T.Mesh(box(w + .02, TY, .04), riser), cx, TY / 2, TER.z1 + .02);
    put(new T.Mesh(box(w, TY, .04), riser), cx, TY / 2, TER.z0 - .02);
  }
  W.rects.push([TER.westX, TER.z1 - .06, -TER.inner, TER.z1 + .06], [TER.inner, TER.z1 - .06, TER.eastX, TER.z1 + .06]);
  // 남쪽 가장자리는 통로로 내려가는 단(난간 없음, 단차 0.42 — 계단으로 보완)
  W.rects.pop(); W.rects.pop();
  for (const side of [-1, 1]) { const xa = side < 0 ? TER.westX + .2 : TER.inner + .2, xb = side < 0 ? -TER.inner - .2 : TER.eastX - .2; for (let k = 0; k < 2; k++) { const h = TY * (2 - k) / 2; put(new T.Mesh(box(xb - xa, h, .4), pbr('wood', { repeat: [6, 1], roughness: .6, gen: { a: '#1a0f0b', b: '#4a2c1a' } })), (xa + xb) / 2, h / 2, TER.z1 + .2 + k * .4); } put(new T.Mesh(box(xb - xa, .02, .03), M.emi('#ffffff', 2)), (xa + xb) / 2, TY + .01, TER.z1 + .02); }
}
// 바
{ put(new T.Mesh(box(1.4, 1.2, 16), MAT.leatherGold), 21.4, .6, -5.5);
  put(new T.Mesh(box(1.8, .08, 16.4), MAT.marbleDark), 21.3, 1.24, -5.5);
  put(new T.Mesh(box(.05, .05, 16), M.emi('#ffb35a', 3)), 20.66, 1.12, -5.5);
  put(new T.Mesh(new T.CylinderGeometry(.025, .025, 16, 8), MAT.gold), 20.35, .25, -5.5).rotation.x = Math.PI / 2;
  // 백바: 거울 + 백라이트 선반 + 병
  put(new T.Mesh(box(.3, 4.2, 16), MAT.wood), 23.85, 2.4, -5.5);
  const mirror = put(new T.Mesh(new T.PlaneGeometry(15.6, 2.4), new T.MeshStandardMaterial({ color: 0x9aa0b0, roughness: .02, metalness: 1, envMapIntensity: 1.6 })), 23.69, 2.7, -5.5); mirror.rotation.y = -Math.PI / 2;
  for (const y of [1.7, 2.55, 3.4]) { put(new T.Mesh(box(.45, .04, 15.6), glassMat), 23.45, y, -5.5); put(new T.Mesh(box(.02, .02, 15.6), M.emi('#ffd2a0', 4)), 23.22, y - .03, -5.5); }
  { const n = 72, im = new T.InstancedMesh(new T.CylinderGeometry(.055, .07, .38, 10), new T.MeshStandardMaterial({ roughness: .06, metalness: .2, transparent: true, opacity: .85, envMapIntensity: 1.8 }), n), o = new T.Object3D(), r = U.rng(7);
    const pal = ['#1f5a2c', '#6a2a10', '#d9b056', '#3a1a6a', '#b0d8f0', '#7a0c22', '#e8e0c8', '#2a2a2a'];
    for (let i = 0; i < n; i++) { const row = i % 3; o.position.set(23.45, [1.92, 2.77, 3.62][row], -12.8 + Math.floor(i / 3) * .62 + (r() - .5) * .1); o.scale.set(1, .8 + r() * .5, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, col(pal[(r() * pal.length) | 0])); } S.add(im); }
  // 맥주 탭 · 펜던트
  for (let i = 0; i < 4; i++) { put(new T.Mesh(new T.CylinderGeometry(.03, .03, .42, 10), MAT.chrome), 21.8, 1.48, -3 - i * .3); put(new T.Mesh(box(.06, .14, .06), MAT.black), 21.8, 1.75, -3 - i * .3); }
  for (let i = 0; i < 5; i++) { const z = -12 + i * 3.2; put(new T.Mesh(new T.CylinderGeometry(.006, .006, 7, 4), MAT.black), 21.3, 7.5, z); put(new T.Mesh(new T.SphereGeometry(.17, 18, 12), new T.MeshStandardMaterial({ color: 0x000000, emissive: col('#ffc27a'), emissiveIntensity: 3.2, roughness: .3 })), 21.3, 3.95, z); put(new T.Mesh(new T.CylinderGeometry(.06, .06, .1, 12), MAT.gold), 21.3, 4.14, z); }
  for (let i = 0; i < 6; i++) { put(new T.Mesh(new T.CylinderGeometry(.27, .25, .1, 20), MAT.leatherPlain), 20.1, .82, -12 + i * 2.6); put(new T.Mesh(new T.CylinderGeometry(.035, .035, .78, 8), MAT.chrome), 20.1, .4, -12 + i * 2.6); put(new T.Mesh(new T.TorusGeometry(.2, .012, 6, 20), MAT.chrome), 20.1, .3, -12 + i * 2.6).rotation.x = Math.PI / 2; }
  const lb = NC.neonSign('BAR · 칵테일 · 맥주 · 과일안주', 6, 1, { font: '700 74px "Malgun Gothic",sans-serif', color: '#ffe9a6', glow: '#ffb800' }); lb.material.color.setScalar(2); lb.position.set(23.68, 4.95, -5.5); lb.rotation.y = -Math.PI / 2; S.add(lb);
  const bl = new T.PointLight(col('#ffc890'), 1.3, 14); bl.position.set(20.5, 3.6, -5.5); S.add(bl);
  W.rects.push([20.6, -13.8, 24, 2.8]); W.spots.bartender = { x: 22.6, z: -5.5, ry: -Math.PI / 2 }; }

/* ═════ ④ 웨이터/부킹 통로 ═════ */
{ const carpet = put(new T.Mesh(new T.PlaneGeometry(44, 2.4), MAT.carpet), 0, .012, 6.95); carpet.rotation.x = -Math.PI / 2; carpet.receiveShadow = !!Q.shadows;
  { const pts = []; for (let x = -21; x <= 21; x += 1.5) for (const z of [5.6, 8.3]) pts.push([x, .02, z]);
    const im = new T.InstancedMesh(new T.CylinderGeometry(.06, .06, .03, 12), M.glow('#ffe27a'), pts.length), o = new T.Object3D(); im.material.color.multiplyScalar(3); pts.forEach((p, i) => { o.position.set(...p); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); S.add(im); }
  put(new T.Mesh(box(1.4, 1.1, .8), MAT.wood), 0, .55, 5.25);
  put(new T.Mesh(box(1.5, .05, .9), MAT.marbleDark), 0, 1.12, 5.25); put(new T.Mesh(box(1.5, .03, .03), M.emi('#ffd23d', 3)), 0, 1.08, 5.7);
  const ws = NC.neonSign('🤵 WAITER', 1.6, .4, { font: '800 100px Arial', color: '#fff6c8', glow: '#ffb800', ph: 200 }); ws.material.color.setScalar(1.8); ws.position.set(0, 1.55, 5.66); S.add(ws);
  W.rects.push([-.75, 4.8, .75, 5.7]);
  W.spots.waiterStation = { x: 1.5, z: 5.3, ry: 0 };
  { const bs = NC.neonSign('BOOKING ROAD · 부킹 통로', 7, 1.1, { font: '800 80px "Malgun Gothic",sans-serif', color: '#ffd1ea', glow: '#ff3d9a' }); bs.material.color.setScalar(2); bs.position.set(ROOM.x - .1, 4.2, 6.95); bs.rotation.y = -Math.PI / 2; S.add(bs); }
  const cl = new T.PointLight(col('#ff9ad0'), .9, 24); cl.position.set(0, 4.5, 6.9); S.add(cl);
  W.corridorY = 6.95;
  // ★ 2차 노래방 입구 (통로 서쪽 끝)
  const dx = -ROOM.x + .06, dz = 6.95;
  put(new T.Mesh(box(.2, 3.0, 2.4), MAT.gold), dx, 1.5, dz);
  const door = put(new T.Mesh(new T.PlaneGeometry(2.0, 2.7), pbr('tufted', { repeat: [2, 3], color: '#8a1a4a', gen: { leather: true, cells: 3 } })), dx + .12, 1.35, dz); door.rotation.y = Math.PI / 2;
  put(new T.Mesh(box(.05, .05, 2.2), M.emi('#ff5fa8', 4)), dx + .15, 2.8, dz);
  const ks = NC.neonSign('🎤 2차 노래방', 3.2, .9, { font: '900 120px "Malgun Gothic",sans-serif', color: '#fff2fb', glow: '#ff3dbb', ph: 256 }); ks.material.color.setScalar(2.4); ks.position.set(dx + .14, 3.45, dz); ks.rotation.y = Math.PI / 2; S.add(ks);
  const kl = new T.PointLight(col('#ff5fc8'), 1.1, 7); kl.position.set(dx + 1.2, 2.6, dz); S.add(kl);
  W.spots.karaokeDoor = { x: dx + 1.1, z: dz };
}

/* ═════ ③ VIP 룸 ═════ */
const VIP_Z0 = 9.2, VIP_Z1 = ROOM.z, VIP_COL = ['#b07cff', '#ffc46b', '#ff6fae'];
const vipGlass = new T.MeshStandardMaterial({ color: col('#c8a8ff'), transparent: true, opacity: .2, roughness: .03, metalness: .4, envMapIntensity: 1.8, depthWrite: false, side: T.DoubleSide });
const frameMat = MAT.gold;
const vipCenters = [-15, 0, 15], HW = 6.5, DOOR_W = 2.4;
let wx = -ROOM.x;
vipCenters.forEach(cx => { W.rects.push([wx, VIP_Z0 - .15, cx - DOOR_W / 2, VIP_Z0 + .15]); wx = cx + DOOR_W / 2; }); W.rects.push([wx, VIP_Z0 - .15, ROOM.x, VIP_Z0 + .15]);
[[-ROOM.x, -21.5], [-8.5, -6.5], [6.5, 8.5], [21.5, ROOM.x]].forEach(([a, b]) => { W.rects.push([a, VIP_Z0, b, VIP_Z1]); put(new T.Mesh(box(b - a, 4.4, VIP_Z1 - VIP_Z0), MAT.marbleDark), (a + b) / 2, 2.2, (VIP_Z0 + VIP_Z1) / 2); });
const crystal = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .02, metalness: .6, envMapIntensity: 2.6, emissive: col('#ffeedd'), emissiveIntensity: .25, flatShading: true });
vipCenters.forEach((cx, i) => {
  const x0 = cx - HW, x1 = cx + HW, c = VIP_COL[i];
  for (const [a, b] of [[x0, cx - DOOR_W / 2], [cx + DOOR_W / 2, x1]]) { put(new T.Mesh(box(b - a, 3.4, .05), vipGlass), (a + b) / 2, 2.3, VIP_Z0); put(new T.Mesh(box(b - a, .6, .2), MAT.wood), (a + b) / 2, .3, VIP_Z0); put(new T.Mesh(box(b - a, .04, .22), frameMat), (a + b) / 2, .62, VIP_Z0); }
  put(new T.Mesh(box(HW * 2, .4, .25), MAT.wood), cx, 4.2, VIP_Z0); put(new T.Mesh(box(HW * 2, .04, .04), M.emi(c, 4)), cx, 4.0, VIP_Z0 + .14);
  const wallV = pbr('tufted', { repeat: [5, 3], color: i === 1 ? '#5a4220' : '#3a2266', roughness: 1 });
  for (const x of [x0, x1]) { put(new T.Mesh(box(.25, 4.4, VIP_Z1 - VIP_Z0), wallV), x, 2.2, (VIP_Z0 + VIP_Z1) / 2); W.rects.push([x - .15, VIP_Z0, x + .15, VIP_Z1]); }
  put(new T.Mesh(box(HW * 2 - .3, .04, .04), M.emi(c, 3.2)), cx, 3.0, VIP_Z1 - .1);
  const fl = put(new T.Mesh(new T.PlaneGeometry(HW * 2, VIP_Z1 - VIP_Z0), pbr('carpet', { repeat: [4, 3], gen: i === 1 ? { a: '#3a2a10', b: '#c99a3a' } : { a: '#2a1040', b: '#b07cff' } })), cx, .014, (VIP_Z0 + VIP_Z1) / 2); fl.rotation.x = -Math.PI / 2;
  // U자 터프팅 가죽 소파 + 대리석 테이블
  const sofa = i === 1 ? MAT.leatherGold : MAT.leather;
  put(new T.Mesh(box(11, .45, 1.3), sofa), cx, .225, 18.9); put(new T.Mesh(box(11, 1.0, .35), sofa), cx, .7, 19.7);
  for (const s of [-1, 1]) { put(new T.Mesh(box(1.3, .45, 5.4), sofa), cx + s * 5.4, .225, 15.4); put(new T.Mesh(box(.35, 1.0, 5.4), sofa), cx + s * 6.15, .7, 15.4); }
  put(new T.Mesh(box(4.2, .08, 1.8), MAT.marbleTop), cx, .58, 16); put(new T.Mesh(box(3.8, .52, 1.4), MAT.black), cx, .28, 16); put(new T.Mesh(box(4.25, .025, 1.85), frameMat), cx, .535, 16);
  W.rects.push([cx - 2.1, 15.1, cx + 2.1, 16.9], [x0, 18.2, x1, VIP_Z1], [x0, 12.6, x0 + 1.5, 18.2], [x1 - 1.5, 12.6, x1, 18.2]);
  const champ = new T.Group(); champ.visible = false; champ.position.set(cx + 1.2, .62, 16);
  champ.add(new T.Mesh(new T.CylinderGeometry(.22, .17, .35, 20), MAT.chrome)); champ.children[0].position.y = .17;
  const bt = new T.Mesh(new T.CylinderGeometry(.06, .08, .55, 12), M.std('#123a1a', { metalness: .3, roughness: .08 })); bt.position.set(0, .45, 0); bt.rotation.z = .3; champ.add(bt);
  const foil = new T.Mesh(new T.CylinderGeometry(.03, .06, .12, 10), MAT.gold); foil.position.set(.08, .74, 0); foil.rotation.z = .3; champ.add(foil); S.add(champ);
  // 조명 · 크리스털 샹들리에 · 간판
  const L = new T.PointLight(col(c), 1.5, 14); L.position.set(cx, 3.4, 15); S.add(L);
  { const n = 46, im = new T.InstancedMesh(new T.OctahedronGeometry(.06, 0), crystal, n), o = new T.Object3D();
    for (let k = 0; k < n; k++) { const ring = k % 3, a = k / n * Math.PI * 2 * 3; o.position.set(cx + Math.cos(a) * (.25 + ring * .22), 3.95 - ring * .18 - (k % 2) * .08, 15 + Math.sin(a) * (.25 + ring * .22)); o.scale.set(1, 1.8, 1); o.updateMatrix(); im.setMatrixAt(k, o.matrix); } S.add(im);
    put(new T.Mesh(new T.TorusGeometry(.7, .015, 6, 40), frameMat), cx, 3.9, 15).rotation.x = Math.PI / 2; put(new T.Mesh(new T.SphereGeometry(.12, 12, 10), M.glow('#fff4e0')), cx, 3.85, 15).material.color.multiplyScalar(5); }
  const sg = NC.neonSign(`VIP ${i + 1}`, 2.4, .8, { font: '900 150px Arial', color: '#fff', glow: c, ph: 256 }); sg.material.color.setScalar(2.2); sg.position.set(cx, 4.75, VIP_Z0 - .16); sg.rotation.y = Math.PI; S.add(sg);
  const door = { cx, open: 0, panels: [] };
  for (const s of [-1, 1]) { const p = put(new T.Mesh(box(DOOR_W / 2, 3.3, .04), new T.MeshStandardMaterial({ color: col(c), transparent: true, opacity: .26, roughness: .04, metalness: .5, envMapIntensity: 1.8, depthWrite: false })), cx + s * DOOR_W / 4, 1.7, VIP_Z0 - .06); p.userData.s = s; p.userData.dyn = true; door.panels.push(p); }
  const doorLed = put(new T.Mesh(box(DOOR_W, .05, .05), M.emi('#6dff8a', 3)), cx, 3.45, VIP_Z0 - .1); door.led = doorLed; doorLed.userData.dyn = true; doorLed.material = doorLed.material.clone();
  const tableC = { x: cx, z: 16 };
  const seats = [[cx - 2.2, 18.5], [cx, 18.5], [cx + 2.2, 18.5], [cx - 5.1, 15.2], [cx + 5.1, 15.2], [cx - 5.1, 13.2]].map(([x, z]) => ({ x, z, ry: Math.atan2(tableC.x - x, tableC.z - z), h: .45 }));
  W.vip.push({ id: i, cx, x0, x1, z0: VIP_Z0, z1: VIP_Z1, color: c, door, seats, occ: seats.map(() => null), light: L, champ, entry: { x: cx, z: VIP_Z0 + 2.2 }, front: { x: cx, z: 7 } });
});

/* 다른 공간(노래방)이 들어갈 때 빌려 쓰는 광원 — 광원 개수를 늘리지 않아 셰이더 재컴파일·프레임 저하가 없음 */
W.lights = { key, ball: ballSpot };
S.children.forEach(o => { if (o.isPointLight && !W.lights.bar && Math.abs(o.position.x - 20.5) < .01) W.lights.bar = o; if (o.isPointLight && Math.abs(o.position.z - 6.9) < .01 && o.position.y === 4.5) W.lights.corridor = o; if (o.isPointLight && o.position.x < -20 && Math.abs(o.position.z - 6.95) < .01) W.lights.kdoor = o; });
/* ── 질의 함수 ── */
W.extraZones = [];      // karaoke.js 등 별도 공간이 { test(x,z), name, collide(p,r), label } 로 등록
W.terraceVia = (from, to) => {
  const up = p => terraceY(p.x, p.z) > TY * .9, a = up(from), b = up(to); if (a === b) return [];
  const p = a ? from : to, side = p.x < 0 ? -1 : 1, sz = TER.steps.reduce((best, z) => Math.abs(z - p.z) < Math.abs(best - p.z) ? z : best, TER.steps[0]);
  const top = { x: side * (TER.inner + .7), z: sz }, bot = { x: side * (TER.inner - TER.band - .7), z: sz };
  return a ? [top, bot] : [bot, top];
};
W.vipAt = (x, z) => { for (const v of W.vip) if (x > v.x0 + .1 && x < v.x1 - .1 && z > v.z0 + .1 && z < v.z1) return v.id; return -1; };
W.zoneAt = (x, z) => {
  for (const e of W.extraZones) if (e.test(x, z)) return { name: e.name };
  const v = W.vipAt(x, z); if (v >= 0) return { name: 'vip', room: v };
  if (inR(Z.stage, x, z)) return { name: 'stage' }; if (inR(Z.dance, x, z)) return { name: 'dance' };
  if (inR(Z.corridor, x, z)) return { name: 'corridor' }; if (inR(Z.bar, x, z)) return { name: 'bar' }; if (Math.abs(x) < 9.5) return { name: 'hall' }; return { name: 'tables' };
};
W.zoneLabel = { hall: '메인 홀', stage: '메인 스테이지', dance: '댄스플로어', corridor: '부킹 통로', bar: '바', tables: '테이블존', vip: 'VIP 룸' };
const terraceY = (x, z) => {
  const ax = Math.abs(x), onX = x < 0 ? (x >= TER.westX && ax >= TER.inner) : (x <= TER.eastX && ax >= TER.inner);
  if (z >= TER.z0 && z <= TER.z1 && onX) return TY;
  if (z >= TER.z0 && z <= TER.z1 && ax > TER.inner - TER.band && ax < TER.inner && TER.steps.some(sz => Math.abs(z - sz) <= TER.stepW / 2)) return TY * (ax - (TER.inner - TER.band)) / TER.band;   // 안쪽 계단
  if (x > TER.eastX && x < TER.eastX + .8 && Math.abs(z + 5.5) <= 1.1) return TY * (1 - (x - TER.eastX) / .8);                                                    // 바 쪽 계단
  if (z > TER.z1 && z < TER.z1 + .8 && ((x < 0 && x > TER.westX && ax > TER.inner) || (x > 0 && x < TER.eastX && ax > TER.inner))) return TY * (1 - (z - TER.z1) / .8); // 통로 쪽 단
  return -1;
};
W.terraceY = terraceY;
NC.groundY = (x, z) => { const ty = terraceY(x, z); if (ty >= 0) return ty; if (x < stg.x0 || x > stg.x1 || z < -ROOM.z || z > ROOM.z) return 0; if (z <= stg.z1) return .5; if (z < stg.z1 + .9 && Math.abs(x) < 3) return .5 * (1 - (z - stg.z1) / .9); return 0; };
W.locked = i => (NC.roomLockedForMe ? NC.roomLockedForMe(i) : false);
function collideRects(p, r, rects) {
  for (const [x0, z0, x1, z1] of rects) {
    const cx = Math.max(x0, Math.min(p.x, x1)), cz = Math.max(z0, Math.min(p.z, z1)), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; } else { const l = p.x - x0, rr = x1 - p.x, t = p.z - z0, b = z1 - p.z, m = Math.min(l, rr, t, b); if (m === l) p.x = x0 - r; else if (m === rr) p.x = x1 + r; else if (m === t) p.z = z0 - r; else p.z = z1 + r; } }
  }
}
W.collideRects = collideRects;
NC.collide = W.collide = function (p, r = .4, opt = {}) {
  for (const e of W.extraZones) if (e.test(p.x, p.z)) return e.collide(p, r);
  const rects = W.rects.slice();
  W.vip.forEach(v => { if (v.door.open < .75) rects.push([v.cx - DOOR_W / 2, VIP_Z0 - .15, v.cx + DOOR_W / 2, VIP_Z0 + .15]); });
  collideRects(p, r, rects);
  for (const [x, z, rad] of W.circles) { const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz), R = rad + r - .4; if (d < R && d > 1e-6) { p.x = x + dx / d * R; p.z = z + dz / d * R; } }
  p.x = U.clamp(p.x, -ROOM.x + .8, ROOM.x - .8); p.z = U.clamp(p.z, -ROOM.z + .8, ROOM.z - .8);
};

/* ── 프레임 업데이트 ── */
let ledT = 0;
W.tickers = [];
W.update = function (dt, t, agents) {
  const b = NC.Audio ? NC.Audio.beat() : { phase: (t * 118 / 60) % 1, n: Math.floor(t * 118 / 60), bpm: 118 };
  const kick = 1 - b.phase;
  ball.rotation.y += dt * .5; updateSpecks(ball.rotation.y);
  spots.forEach(s => { const a = t * .55 + s.k * 1.6; s.tg.position.set(Math.cos(a) * 7, 0, -8 + Math.sin(a * 1.3) * 5.5);
    const dx = s.tg.position.x - s.pos.x, dy = s.tg.position.y - s.pos.y, dz = s.tg.position.z - s.pos.z;
    s.yoke.rotation.y = Math.atan2(dx, dz); s.head.rotation.x = -Math.atan2(-dy, Math.hypot(dx, dz)) + 0; s.head.rotation.x = Math.atan2(-dy, Math.hypot(dx, dz));
    if (s.L) s.L.intensity = 2.2 + Math.sin(t * 3 + s.k) * .5 + kick * .5; s.beam.material.uniforms.time.value = t; s.beam.material.uniforms.intensity.value = (s.L ? .26 : .2) + kick * .1; });
  glows[0].intensity = 1.1 + Math.sin(t * 4) * .4; glows[1].intensity = 1.1 + Math.cos(t * 4) * .4;
  for (let i = 0, k = 0; i < TX; i++) for (let j = 0; j < TZ; j++, k++) { const h = (t * .1 + (i + j) * .045) % 1, v = .35 + .4 * Math.max(0, Math.sin(t * 2 + (i * 2 + j * 3) * .6)) + kick * .25 * ((i + j + b.n) % 2); tmpC.setHSL(h, .9, v * .36); tiles.setColorAt(k, tmpC); }
  tiles.instanceColor.needsUpdate = true;
  const pattern = Math.floor(b.n / 8) % 4, laserOn = pattern !== 3; const hue = (Math.floor(b.n / 4) * .17) % 1;
  lasers.forEach((m, i) => {
    m.visible = laserOn; if (!laserOn) return;
    const f = (i / (lasers.length - 1) - .5) * 1.8, a = pattern === 0 ? f + Math.sin(t * .9) * .5 : pattern === 1 ? f * Math.sin(t * 1.4) : f + (i % 2 ? 1 : -1) * Math.sin(t * 2) * .3;
    lzTarget.set(Math.sin(a) * 30, pattern === 2 ? 1 + Math.sin(t * 3 + i) * 2 : .4 + Math.abs(Math.sin(t * .7 + i * .3)) * 3, -18.9 + Math.cos(a) * 30); m.lookAt(lzTarget);
    m.material.color.setHSL((hue + i * .015) % 1, 1, .5).convertSRGBToLinear().multiplyScalar(1.5); m.material.opacity = .18 + .3 * kick;
  });
  haze.forEach(h => { h.p += dt * .12; h.sp.position.set(h.x + Math.sin(h.p) * 1.5, h.y + Math.sin(h.p * 1.3) * .3, h.z + Math.cos(h.p * .8) * 1.2); h.sp.material.rotation += h.r * dt; h.sp.material.opacity = .05 + .02 * Math.sin(h.p * 2) + kick * .01; });
  candles.forEach((c, i) => { const f = .8 + .2 * Math.sin(t * 13 + i * 3) * Math.sin(t * 7.3 + i); c.material.color.setRGB(4 * f, 2.2 * f, .7 * f); c.scale.y = 1.4 + .3 * f; });
  ledT += dt; if (ledT > 1 / 15) { ledT = 0; drawLED(t, b); }
  W.vip.forEach(v => {
    const locked = W.locked(v.id); let want = false;
    for (const a of agents || []) if (Math.abs(a.x - v.cx) < 1.9 && Math.abs(a.z - VIP_Z0) < 2.2 && !(a.me && locked)) { want = true; break; }
    v.door.open = U.clamp(v.door.open + (want ? dt * 2.2 : -dt * 1.6), 0, 1);
    v.door.panels.forEach(p => { p.position.x = v.cx + p.userData.s * (DOOR_W / 4 + v.door.open * DOOR_W / 2.1); });
    v.door.led.material.emissive.copy(col(locked ? '#ff3355' : v.occ.some(Boolean) ? '#ffd23d' : '#6dff8a'));
    v.light.intensity = 1.3 + .25 * Math.sin(t * 1.5 + v.id);
  });
  if (W.marquee) { for (let i = 0; i < W.marqueeN; i++) { const on = ((i + Math.floor(t * 6)) % 3) === 0; tmpC.setRGB(on ? 3.2 : .9, on ? 2.4 : .6, on ? 1.3 : .3); W.marquee.setColorAt(i, tmpC); } W.marquee.instanceColor.needsUpdate = true; }
  W.tickers.forEach(f => f(dt, t, b));
};
ball.userData.dyn = true; floor.userData.dyn = true;
/* 드로우콜 절감: 움직이지 않는 불투명 메시를 머티리얼별로 하나로 병합 (수백 → 수십 콜) */
(function mergeWorld() {
  const byMat = new Map();
  S.children.forEach(o => { if (!o.isMesh || o.isInstancedMesh || o.userData.dyn || o.material.transparent || o.children.length) return; const k = o.material.uuid; if (!byMat.has(k)) byMat.set(k, []); byMat.get(k).push(o); });
  let before = 0, after = 0;
  byMat.forEach(list => { before += list.length; if (list.length < 2) { after++; return; }
    let V = 0, I = 0; const geos = list.map(m => { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); V += g.attributes.position.count; I += g.index ? g.index.count : g.attributes.position.count; return g; });
    const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2), idx = new Uint32Array(I); let vo = 0, io = 0;
    geos.forEach(g => { const n = g.attributes.position.count; pos.set(g.attributes.position.array, vo * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
      if (g.index) for (let k = 0; k < g.index.count; k++) idx[io++] = g.index.array[k] + vo; else for (let k = 0; k < n; k++) idx[io++] = k + vo; vo += n; g.dispose(); });
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('uv', new T.BufferAttribute(uv, 2)); out.setIndex(new T.BufferAttribute(idx, 1)); out.computeBoundingSphere();
    const mm = new T.Mesh(out, list[0].material); list.forEach(m => S.remove(m)); S.add(mm); after++; });
  console.info(`[world] 정적 메시 병합 ${before} → ${after}`);
})();
// 그림자: 바닥·무대는 받기, 큰 가구는 드리우기
if (Q.shadows) S.children.forEach(o => { if (o.isMesh && !o.material.transparent && !o.isInstancedMesh && o !== floor && !o.userData.dyn) { o.castShadow = true; o.receiveShadow = true; } });
})();
