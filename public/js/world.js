/* world.js — 클럽 3D 공간 v3 (실사화)
 *  ① 메인 스테이지/DJ 부스 (북쪽, 0.5m 무대 · 벨벳 커튼 · 라인어레이 스피커 · 삼각 트러스 · 무빙헤드)
 *  ② 일반 테이블 (대리석 상판·가죽 스툴·캔들·아이스버킷) · 동쪽 벽 바 (백라이트 선반·거울·펜던트 조명·맥주 탭)
 *  ③ VIP 룸 3개 (남쪽, 유리 슬라이딩 도어 · 터프팅 가죽 소파 · 크리스털 샹들리에)
 *  ④ 웨이터/부킹 통로 (아르데코 카펫 · 풋라이트 · 서쪽 끝 '2차 노래방' 입구)
 *  v15 국빈관식 배치: 북쪽 DJ 단(한 층 더 높게) → 초청가수 무대 → 댄스·블루스 플로어 → 뒤쪽 홀 전체 테이블 16개
 *      ㄷ자 외곽 = 서쪽 노래방 동(+흡연실) · 남쪽 VIP 룸 3개 · 동쪽 바 + 화장실 동
 *  v16: VIP 룸을 2층(4.6m)으로 — 양 끝 계단 → 앞쪽 발코니 복도(유리 난간) → 룸. 1층 그 자리는 「VIP LOUNGE」 파사드
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
  corridor: { x0: -24, x1: 24, z0: 9.6, z1: 11.9 },
  dj: { x0: -10.9, x1: -6.5, z0: -17.4, z1: -14.0, y: .5 + .8 },   // v24 DJ 단을 무대 왼쪽 앞으로 → 뒤 LED 벽 전체가 보이게
  bar: { x0: 18.4, x1: 24, z0: -14, z1: 3 },
};
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
/* v4: 양옆 테이블존을 0.42m 높인 라운지 테라스로 (계단 3곳 · 유리 난간) → 층이 생겨 공간이 입체적으로 */
const TY = 0, TER = { inner: 99, z0: 0, z1: 0, westX: 0, eastX: 0, steps: [], stepW: 0, band: 0 };   // v15: 테라스 제거(평지 홀 + 테이블 16개)
const RISE = .8;   // v15: DJ 단은 가수 무대보다 0.8m 더 높게
const DJX = -8.6, DJZ = -15.5, DJR = .35;   // v24 DJ 부스 위치(무대 왼쪽 앞) · 홀 가운데를 향해 비스듬히
const TABLE_POS = [[-3.2, .6], [3.2, .6], [-8.9, .6], [8.9, .6], [-14.2, .6], [14.2, .6], [-3.2, 6.2], [3.2, 6.2], [-8.9, 6.2], [8.9, 6.2], [-14.2, 6.2], [14.2, 6.2], [-14.2, -10.6], [-14.2, -5], [14.2, -10.6], [14.2, -5]];
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
  const blobs = TABLE_POS.map(([x, z]) => [x, z, 3.4]);
  blobs.forEach(([x, z, r]) => { const b = NC.contactShadow(r, r); b.position.set(x, TY + .012, z); S.add(b); });
  [[-8.7, -15.7, 4.4, 3.4, .512 + RISE], [-9.6, -18.6, 2.6, 2.2, .512], [9.6, -18.6, 2.6, 2.2, .512], [21.4, -5.5, 2.4, 17, .012]].forEach(([x, z, w, d, y]) => { const b = NC.contactShadow(w, d); b.position.set(x, y, z); S.add(b); }); }
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
const djFrom = S.children.length;
// DJ 부스: 원목 전면 + 브러시드 메탈 상판 + CDJ·믹서
put(new T.Mesh(box(3.6, 1.1, 1.4), MAT.wood), 0, 1.05, -17.4);
put(new T.Mesh(box(3.8, .06, 1.55), MAT.brushed), 0, 1.63, -17.4);
put(new T.Mesh(box(3.6, .06, .05), M.emi('#3de6ff', 4)), 0, 1.0, -16.68);
{ const logo = NC.neonSign('DJ NOSTALGIA', 2.7, .46, { font: '900 120px Arial', color: '#e8fbff', glow: '#3de6ff', ph: 200 }); logo.position.set(0, 1.25, -16.68); S.add(logo); }
[-1.2, -.9, .9, 1.2].forEach((x, i) => { if (i === 1 || i === 2) return; put(new T.Mesh(box(1.1, .1, .9), MAT.black), x, 1.71, -17.4); put(new T.Mesh(new T.CylinderGeometry(.34, .34, .03, 32), M.std('#22222a', { roughness: .3, metalness: .6 })), x, 1.78, -17.35); put(new T.Mesh(box(.5, .01, .2), M.emi('#4fc3ff', 2.4)), x, 1.765, -17.75); });
put(new T.Mesh(box(1.4, .12, .9), MAT.black), 0, 1.72, -17.4);
{ const knobs = new T.InstancedMesh(new T.CylinderGeometry(.03, .03, .04, 10), M.emi('#ff3d9a', 1.6), 24), o = new T.Object3D(); for (let i = 0; i < 24; i++) { o.position.set(-.5 + (i % 6) * .2, 1.8, -17.7 + Math.floor(i / 6) * .18); o.updateMatrix(); knobs.setMatrixAt(i, o.matrix); } S.add(knobs); }
{ const bg = new T.Group(); bg.position.set(DJX, RISE, DJZ); bg.rotation.y = DJR;   // v24 부스를 묶어 무대 왼쪽 앞으로 옮기고 홀 가운데를 향하게
  const parts = S.children.slice(djFrom); parts.forEach(o => { S.remove(o); o.position.z -= -17.4; bg.add(o); }); S.add(bg); }
/* v24 DJ 단: 무대 왼쪽 앞 4.4×3.4m · 높이 1.3m — 오른쪽(홀 가운데 쪽) 계단 · 전면 LED 라인 · 크롬 난간 */
{ const d = Z.dj, w = d.x1 - d.x0, dp = d.z1 - d.z0, cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
  put(new T.Mesh(box(w, RISE, dp), MAT.stageFloor), cx, .5 + RISE / 2, cz).receiveShadow = !!Q.shadows;
  put(new T.Mesh(box(w + .06, RISE, .05), MAT.black), cx, .5 + RISE / 2, d.z1 + .02);
  for (const y of [.62, .92, 1.22]) put(new T.Mesh(box(w, .025, .03), M.emi('#3de6ff', 3)), cx, y, d.z1 + .06);
  for (let k = 0; k < 3; k++) { const h = RISE * (3 - k) / 3; put(new T.Mesh(box(.42, h, 1.3), MAT.stageFloor), d.x1 + .21 + k * .42, .5 + h / 2, d.z0 + .9); }
  put(new T.Mesh(new T.CylinderGeometry(.025, .025, dp - .2, 8).rotateX(Math.PI / 2), MAT.chrome), d.x0 + .1, .5 + RISE + .95, cz);
  for (const z of [d.z0 + .3, cz, d.z1 - .2]) put(new T.Mesh(new T.CylinderGeometry(.02, .02, .95, 8), MAT.chrome), d.x0 + .1, .5 + RISE + .47, z);
  const ds = NC.neonSign('♪ DJ BOOTH', 2.0, .38, { font: '800 100px Arial', color: '#e8fbff', glow: '#3de6ff', ph: 200 }); ds.position.set(cx - .6, .5 + RISE * .55, d.z1 + .09); S.add(ds);
  W.rects.push([d.x0, d.z0, d.x1, d.z1]); }
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
/* ── v20 LED 배경 영상: public/music/music/background.mp4 (또는 public/music/background.mp4 · public/video/background.mp4)를
 *  DJ 뒤 LED 전광판 전체에 와이드로 꽉 차게 반복 재생. 소리는 끔(음악은 스테이지 음악이 담당).
 *  경로 바꾸기: NC.config.ledVideo = 'video/my.mp4' · 늘려서 채우기: NC.config.ledVideoFit = 'stretch' */
const LV = (() => {
  const CAND = (NC.config && NC.config.ledVideo) ? [NC.config.ledVideo] : ['music/background.mp4', 'music/music/background.mp4', 'video/background.mp4'];
  let vid = null, want = U.store.get('nc_ledVideo2', true) !== false, st = 'off', started = false;
  const emit = () => NC.emit && NC.emit('led:video', st);
  const find = k => k >= CAND.length ? Promise.resolve(null) : fetch(CAND[k], { method: 'HEAD', cache: 'no-store' }).then(r => r.ok && !/text\/html/i.test(r.headers.get('content-type') || '') ? CAND[k] : find(k + 1)).catch(() => find(k + 1));
  function load() {
    if (vid) { st = 'loading'; emit(); const p = vid.play(); if (p && p.catch) p.catch(() => {}); return; }
    st = 'loading'; emit();
    find(0).then(url => {
      if (!url) { st = 'missing'; console.warn('[LED] 배경 영상을 찾지 못함:', CAND.join(' · ')); emit(); return; }
      vid = document.createElement('video'); Object.assign(vid, { muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
      vid.setAttribute('muted', ''); vid.setAttribute('playsinline', ''); vid.setAttribute('webkit-playsinline', '');
      vid.addEventListener('playing', () => { if (want) { st = 'on'; emit(); } });
      vid.addEventListener('error', () => { st = 'missing'; emit(); console.warn('[LED] 영상 재생 실패', url, vid.error); });
      vid.src = url; console.info('[LED] 배경 영상:', url);
      if (want) { const p = vid.play(); if (p && p.catch) p.catch(() => { st = 'off'; emit(); }); }
    });
  }
  /* 첫 클릭 전엔 자동재생이 막힐 수 있어 클릭/입장 때 한 번 더 재생 시도 */
  const kick = () => { if (want && vid && vid.paused) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); } };
  ['pointerdown', 'touchend', 'keydown'].forEach(e => addEventListener(e, kick, { passive: true }));
  const begin = () => { if (started) return; started = true; if (want) load(); };
  NC.on && NC.on('start', begin);
  return {
    active: () => want && vid && st === 'on' && vid.readyState >= 2 && !vid.paused,
    showing: () => !!(want && vid && st === 'on' && vid.videoWidth),   // 반복 재생 이음새에서 잠깐 readyState 가 떨어져도 화면이 깜박이지 않게
    el: () => vid, state: () => want ? st : (st === 'missing' ? 'missing' : 'off'),
    toggle() { if (st === 'missing') { want = true; vid = null; load(); } else { want = !want; if (want) load(); else { if (vid) vid.pause(); st = 'off'; emit(); } } U.store.set('nc_ledVideo2', want); started = true; return want; },
  };
})();
W.ledVideo = LV;
/* v22 영상은 LED 캔버스에 그리지 않고 전용 판(VideoTexture)에 직접 재생:
 *  · 화면 비율을 그대로 유지해 뮤비 전체가 보이게(위아래 잘림 없음) — 남는 좌우는 LED 연출이 은은하게 이어짐
 *  · 렌더 프레임마다 브라우저가 디코딩한 영상 프레임을 바로 올려 30fps 캔버스 복사로 생기던 끊김이 없음 */
const LED_W = 19, LED_H = 5.9;
const vidMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); vidMat.visible = false;
const vidMesh = put(new T.Mesh(new T.PlaneGeometry(1, 1), vidMat), 0, 4.3, -ROOM.z + .085); vidMesh.renderOrder = 2; vidMesh.userData.dyn = true;
let vidTex = null, vidAspect = 0;
function vidTick() {
  const on = LV.showing() && !(W.ledMsg && performance.now() < W.ledMsg.until); if (!on)   // 전광판 알림(샴페인 쇼 등) 동안엔 알림을 보여 줌
  { if (vidMat.visible) { vidMat.visible = false; } return; }
  const v = LV.el();
  if (!vidTex || vidTex.image !== v) { if (vidTex) vidTex.dispose(); vidTex = new T.VideoTexture(v); vidTex.encoding = T.sRGBEncoding; vidTex.minFilter = vidTex.magFilter = T.LinearFilter; vidTex.generateMipmaps = false; vidMat.map = vidTex; vidMat.needsUpdate = true; vidAspect = 0; }
  const a = (v.videoWidth || 16) / (v.videoHeight || 9);
  if (Math.abs(a - vidAspect) > .001) { vidAspect = a; const fit = (NC.config && NC.config.ledVideoFit) || 'stretch';   // v23 기본 = 벽면 전체에 와이드로 꽉 채움 · 비율 유지가 필요하면 'contain'
    let w = LED_W, h = LED_H; if (fit === 'contain') { if (a > LED_W / LED_H) h = LED_W / a; else w = LED_H * a; }   // 'stretch' 면 꽉 채움
    vidMesh.scale.set(w, h, 1); }
  vidMat.visible = true;
}
put(new T.Mesh(new T.PlaneGeometry(19, 5.9), ledMat), 0, 4.3, -ROOM.z + .06);
put(new T.Mesh(box(19.6, 6.5, .1), MAT.black), 0, 4.3, -ROOM.z + .01);
const sign = NC.neonSign('추억의 나이트', 13, 2.6); sign.material.color.setScalar(2.2); put(sign, 0, 8.9, -ROOM.z + .08);
/* ── 무대 조명 테마 (우측 패널) ── h0/h1: 색상 범위(0~1), sat/lit: 채도·밝기, spots: 무빙라이트 색, laser: 레이저, beam: 빔 세기, speed: 움직임 속도 */
const THEMES = W.THEMES = {
  neon:   { name: '네온 파티', h0: 0, h1: 1, sat: .9, lit: .36, spots: ['#ff3d9a', '#3de6ff', '#ffd23d', '#9b5cff', '#ffffff', '#ff6a3d'], laser: true, beam: 1, speed: 1, led: [null, null], text: '★ NIGHT FEVER 1998 ★', haze: ['#b9a6ff', '#ff9ad6', '#8fe8ff'], fog: '#2a1f44', glow: ['#ff5cb0', '#5ce8ff'] },
  gold:   { name: '클래식 골드', h0: .06, h1: .12, sat: .75, lit: .26, spots: ['#ffcf7a', '#ffb35a', '#ffe2b0', '#ff9a5a', '#fff1d6', '#ffc070'], laser: false, beam: .7, speed: .5, led: [30, 48], text: '♛ GOLDEN NIGHT ♛', haze: ['#ffd9a0', '#ffc27a', '#fff0d0'], fog: '#2e2216', glow: ['#ffb35a', '#ffd88a'] },
  blue:   { name: '블루 라운지', h0: .55, h1: .72, sat: .75, lit: .24, spots: ['#5a7bff', '#7a5cff', '#3dc8ff', '#9a8cff', '#c8d8ff', '#4a6aff'], laser: false, beam: .75, speed: .4, led: [200, 260], text: '~ BLUE MOON LOUNGE ~', haze: ['#8fa8ff', '#a08cff', '#8fe0ff'], fog: '#161c3a', glow: ['#5a7bff', '#3dc8ff'] },
  mono:   { name: '모노 시크', h0: 0, h1: 0, sat: 0, lit: .16, spots: ['#ffffff', '#e6e6f2', '#ffffff', '#d8d8e8', '#ffffff', '#ececf6'], laser: false, beam: .5, speed: .6, led: [0, 0], ledSat: 0, text: 'NOSTALGIA CLUB', haze: ['#d8d8e0', '#c8c8d4', '#e8e8f0'], fog: '#1c1c22', glow: ['#e8e8f0', '#c8c8d8'] },
  sunset: { name: '선셋 레트로', h0: .9, h1: 1.08, sat: .9, lit: .32, spots: ['#ff6a3d', '#ff3d9a', '#ffb03d', '#c23dff', '#ffd0a0', '#ff4f6a'], laser: true, laserHue: [.9, 1.05], beam: .9, speed: .8, led: [330, 400], text: '☀ SUNSET DRIVE 1986 ☀', haze: ['#ffb0a0', '#ff9ad6', '#ffc890'], fog: '#3a1a2a', glow: ['#ff6a3d', '#ff3d9a'] },
  dim:    { name: '다크 바 (조명 최소)', h0: .75, h1: .85, sat: .5, lit: .08, spots: ['#6a4a8a', '#4a3a6a', '#6a4a8a', '#4a3a6a', '#5a4a7a', '#4a3a6a'], laser: false, beam: .15, speed: .25, led: [270, 290], ledDim: .35, text: 'late night', haze: ['#6a5a8a', '#5a4a7a', '#6a5a8a'], fog: '#120c1a', glow: ['#5a3a7a', '#3a2a5a'], spotK: .4 },
  /* v15 추가 테마 5종 — sparkle:false 는 미러볼 반사점·레이저·깜빡임·비트 펄스가 모두 꺼진 '반짝임 없는' 조명 */
  cabaret: { name: '레드 카바레', h0: .97, h1: 1.03, sat: .85, lit: .26, spots: ['#ff2a3d', '#ffb35a', '#ff5a6a', '#ffd27a', '#ff3d5a', '#ffe0b0'], laser: false, beam: .85, speed: .55, led: [350, 372], text: '♠ CABARET ROUGE ♠', haze: ['#ff8a8a', '#ffb07a', '#ff9aa8'], fog: '#2e1016', glow: ['#ff2a3d', '#ffb35a'] },
  aurora:  { name: '오로라 웨이브', h0: .38, h1: .78, sat: .8, lit: .3, spots: ['#3dffb0', '#3dd8ff', '#9b5cff', '#5affd8', '#c08aff', '#3d9aff'], laser: true, laserHue: [.38, .78], beam: .95, speed: .7, led: [140, 280], text: '✧ AURORA NIGHT ✧', haze: ['#8affd8', '#8ad8ff', '#c0a0ff'], fog: '#0e2228', glow: ['#3dffb0', '#9b5cff'] },
  warm:    { name: '웜 라운지 (반짝임 없음)', h0: .07, h1: .1, sat: .6, lit: .2, spots: ['#ffc890', '#ffb878', '#ffd8a8', '#ffbf80', '#ffe2c0', '#ffc890'], laser: false, beam: .35, speed: .12, led: [28, 38], ledDim: .55, text: 'WARM LOUNGE', haze: ['#ffd0a0', '#ffc090', '#ffe0c0'], fog: '#241a12', glow: ['#ffb070', '#ffcf90'], sparkle: false, spotK: .7 },
  pastel:  { name: '파스텔 드림 (반짝임 없음)', h0: .78, h1: .95, sat: .45, lit: .3, spots: ['#ffb0d8', '#c8b0ff', '#b0d8ff', '#ffc8e0', '#d8c8ff', '#b0e8ff'], laser: false, beam: .45, speed: .15, led: [280, 330], ledSat: 55, ledDim: .7, text: '~ pastel dream ~', haze: ['#ffc8e8', '#d8c8ff', '#c8e0ff'], fog: '#221c2e', glow: ['#ffb0d8', '#b0c8ff'], sparkle: false, spotK: .8 },
  house:   { name: '💡 전등만 (무대 조명 끔)', h0: .1, h1: .1, sat: .05, lit: .18, spots: ['#fff4e6', '#fff4e6', '#fff4e6', '#fff4e6', '#fff4e6', '#fff4e6'], laser: false, beam: 0, speed: 0, led: [35, 35], ledSat: 10, ledDim: .45, text: '추억의 나이트', haze: ['#f0ece6', '#f0ece6', '#f0ece6'], fog: '#1c1a1e', glow: ['#fff1e0', '#fff1e0'], sparkle: false, nostage: true, spotK: 0, keyK: 1.9 },   // v16: 무빙라이트·빔·레이저·헤이즈·미러볼 전부 끄고 실내등만
  white:   { name: '화이트 스포트라이트 (반짝임 없음)', h0: .1, h1: .12, sat: .08, lit: .34, spots: ['#ffffff', '#fff6ea', '#ffffff', '#f4f0ff', '#ffffff', '#fff6ea'], laser: false, beam: .55, speed: 0, led: [40, 40], ledSat: 10, ledDim: .8, text: 'NOSTALGIA · SPOTLIGHT', haze: ['#f0f0f8', '#e8e8f0', '#ffffff'], fog: '#1e1c24', glow: ['#ffffff', '#f0ecff'], sparkle: false, spotK: 1.15, keyK: 1.6 },
};
let TH = THEMES.neon;
W.ledMessage = (text, sec = 8, color) => { W.ledMsg = { text, until: performance.now() + sec * 1000, color }; };
W.setTheme = id => { const th = THEMES[id]; if (!th) return; TH = th; W.themeId = id; U.store.set('nc_theme2', id);
  spots.forEach((sp, i) => { const c = col(th.spots[i % th.spots.length]); if (sp.L) sp.L.color.copy(c); sp.beam.material.uniforms.color.value.copy(c); sp.head.children[1] && sp.head.children[1].material && sp.head.children[1].material.color.copy(c).multiplyScalar(6); });
  haze.forEach((h, i) => h.sp.material.color.copy(col(th.haze[i % 3]))); S.fog.color.copy(col(th.fog)); glows[0].color.copy(col(th.glow[0])); glows[1].color.copy(col(th.glow[1]));
  key.intensity = .75 * (th.keyK || 1); W.stageOff = !!th.nostage; NC.emit && NC.emit('theme', id); };
/* v16 LED 월: 10초마다 10가지 영상 중 하나로 랜덤 전환 (이퀄라이저 · 댄서 실루엣 · 신스웨이브 · 파형 · 별빛 터널 · 하트 펄스 · 만화경 · 전광판 · 불꽃놀이 · 체커+미러볼) */
const LED_MODES = ['이퀄라이저', '댄서 실루엣', '신스웨이브 선셋', '오실로스코프', '별빛 터널', '하트 펄스', '만화경', '전광판 메시지', '불꽃놀이', '디스코 체커'];
let ledMode = 0, ledNext = 10, ledFade = 1; const fw = [];
W.ledMode = () => LED_MODES[ledMode];
function dancerFig(g, x, y, s, ph, style) {   // 막대 인형 실루엣 댄서 (머리·몸통·팔·다리 — 박자에 맞춰 포즈)
  const sw = Math.sin(ph), cw = Math.cos(ph * .5), hip = [x + sw * 6 * s, y], neck = [x + sw * 3 * s, y - 62 * s];
  const L = (p, q) => { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); };
  g.lineWidth = 11 * s; g.lineCap = 'round';
  L(hip, neck);
  const arm = (side, a1, a2) => { const el = [neck[0] + Math.cos(a1) * 30 * s * side, neck[1] + 6 * s + Math.sin(a1) * 30 * s], hd = [el[0] + Math.cos(a2) * 26 * s * side, el[1] + Math.sin(a2) * 26 * s]; L([neck[0], neck[1] + 6 * s], el); L(el, hd); };
  if (style === 0) { arm(1, -1.2 + sw * .6, -1.6 + cw); arm(-1, -1.2 - sw * .6, -1.6 - cw); }          // 디스코 포인트
  else if (style === 1) { arm(1, .3 + sw, 1.2); arm(-1, .3 - sw, 1.2); }                            // 흔들기
  else { arm(1, -.4 + Math.abs(sw), -.9); arm(-1, -.4 + Math.abs(cw), -.9); }                      // 박수·웨이브
  const leg = (side, k) => { const kn = [hip[0] + side * 12 * s + k * 8 * s, hip[1] + 32 * s], ft = [kn[0] + side * 6 * s - k * 10 * s, hip[1] + 64 * s]; L(hip, kn); L(kn, ft); };
  leg(1, Math.max(0, sw)); leg(-1, Math.max(0, -sw));
  g.beginPath(); g.arc(neck[0], neck[1] - 16 * s, 13 * s, 0, 7); g.fill();
}
function drawLED(t, b) {
  const g = ledG, SPK = TH.sparkle !== false, kick = SPK ? 1 - b.phase : .3;
  ledMat.color.setScalar(LV.showing() ? .55 : 1.6);   // v22 영상 재생 중엔 좌우 LED 연출을 은은하게

  ledNext -= 1 / 15; if (ledNext <= 0) { ledNext = 10; let m; do { m = Math.floor(Math.random() * LED_MODES.length); } while (m === ledMode); ledMode = m; ledFade = 0; }
  ledFade = Math.min(1, ledFade + .08);
  g.fillStyle = '#07030f'; g.fillRect(0, 0, 1024, 320);
  const L0 = TH.led[0], L1 = TH.led[1], ls = TH.ledSat ?? 80, hue = L0 == null ? (t * 20) % 360 : L0 + (L1 - L0) * (.5 + .5 * Math.sin(t * .3)), dimK = TH.ledDim || 1, gr = g.createLinearGradient(0, 0, 1024, 320); gr.addColorStop(0, `hsla(${hue},${ls}%,${25 * dimK}%,.9)`); gr.addColorStop(1, `hsla(${L0 == null ? (hue + 120) % 360 : L1},${ls}%,${20 * dimK}%,.9)`); g.fillStyle = gr; g.fillRect(0, 0, 1024, 320);
  const H = i => L0 == null ? (hue + i) % 360 : L0 + (L1 - L0) * ((i % 360) / 360), C = (i, l = 60, a = 1) => `hsla(${H(i)},${ls}%,${l}%,${a * dimK})`;
  g.save(); g.globalAlpha = ledFade;
  switch (ledMode) {
    case 0: {
  for (let i = 0; i < 48; i++) { const v = (.35 + .65 * Math.abs(Math.sin(i * .7 + t * 3 + Math.sin(i) * 2))) * (.55 + .45 * (1 - b.phase)); const h = v * 230 * dimK; g.fillStyle = `hsl(${L0 == null ? (hue + i * 7) % 360 : L0 + (L1 - L0) * (i / 48)},${TH.ledSat ?? 95}%,${62 * (dimK < 1 ? .6 : 1)}%)`; g.fillRect(i * 21.3 + 2, 305 - h, 16, h); }
      break; }
    case 1: { // 댄서 실루엣: 뒤에서 빛나는 조명 + 5명 군무
      const sp = g.createRadialGradient(512, 340, 20, 512, 300, 520); sp.addColorStop(0, C(0, 55, .9)); sp.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sp; g.fillRect(0, 0, 1024, 320);
      g.fillStyle = g.strokeStyle = '#05020a'; const bt = (b.n + b.phase) * Math.PI;
      for (let k = 0; k < 5; k++) dancerFig(g, 150 + k * 180, 250, k === 2 ? 1.5 : 1.15, bt + k * .8, (Math.floor(b.n / 8) + k) % 3);
      break; }
    case 2: { // 신스웨이브 선셋: 줄무늬 태양 + 원근 그리드
      const sky = g.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, C(260, 18)); sky.addColorStop(1, C(330, 45)); g.fillStyle = sky; g.fillRect(0, 0, 1024, 200);
      const sun = g.createLinearGradient(0, 40, 0, 200); sun.addColorStop(0, `rgba(255,220,90,${dimK})`); sun.addColorStop(1, `rgba(255,60,150,${dimK})`); g.fillStyle = sun; g.beginPath(); g.arc(512, 190, 110, Math.PI, 0); g.fill();
      g.fillStyle = '#07030f'; for (let k = 0; k < 6; k++) g.fillRect(380, 120 + k * 14 + (t * 12 % 14), 264, 3 + k);
      g.fillStyle = '#12051e'; g.fillRect(0, 196, 1024, 124); g.strokeStyle = C(300, 62); g.lineWidth = 2;
      for (let k = -14; k <= 14; k++) { g.beginPath(); g.moveTo(512 + k * 18, 198); g.lineTo(512 + k * 140, 320); g.stroke(); }
      for (let k = 0; k < 8; k++) { const y = 198 + Math.pow(((k + t * .8) % 8) / 8, 2) * 122; g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
      break; }
    case 3: { // 오실로스코프: 겹친 사인 파형
      g.lineWidth = 4; for (let w = 0; w < 4; w++) { g.strokeStyle = C(w * 50, 62); g.beginPath();
        for (let x = 0; x <= 1024; x += 8) { const y = 160 + Math.sin(x * .012 * (w + 1) + t * (2 + w)) * (40 + kick * 50) * Math.sin(x / 1024 * Math.PI) + Math.sin(x * .05 + t * 7) * 6; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      break; }
    case 4: { // 별빛 터널: 중심에서 퍼지는 점
      for (let k = 0; k < 160; k++) { const a = k * 2.399, d = ((k * 37 + t * 140) % 600), r = d * d / 600; const x = 512 + Math.cos(a) * r * 1.6, y = 160 + Math.sin(a) * r * .55; g.fillStyle = C(k * 3, 55 + d / 12); g.fillRect(x, y, 1 + d / 120, 1 + d / 120); }
      g.strokeStyle = C(0, 60, .5); g.lineWidth = 3; for (let k = 0; k < 4; k++) { const r = ((t * 60 + k * 80) % 320); g.beginPath(); g.ellipse(512, 160, r * 1.6, r * .55, 0, 0, 7); g.stroke(); }
      break; }
    case 5: { // 하트 펄스: 박자에 맞춰 커지는 하트들
      const heart = (x, y, sz) => { g.beginPath(); g.moveTo(x, y + sz * .3); g.bezierCurveTo(x, y, x - sz * .5, y, x - sz * .5, y + sz * .3); g.bezierCurveTo(x - sz * .5, y + sz * .6, x, y + sz * .8, x, y + sz); g.bezierCurveTo(x, y + sz * .8, x + sz * .5, y + sz * .6, x + sz * .5, y + sz * .3); g.bezierCurveTo(x + sz * .5, y, x, y, x, y + sz * .3); g.fill(); };
      for (let k = 0; k < 7; k++) { g.fillStyle = C(330 + k * 6, 58, .85); heart(90 + k * 140, 70 + Math.sin(t * 2 + k) * 20, 110 + kick * 40 * (k % 2 ? 1 : .6)); }
      break; }
    case 6: { // 만화경: 회전하는 삼각형 대칭 무늬
      g.translate(512, 160); for (let k = 0; k < 12; k++) { g.rotate(Math.PI / 6); for (let j = 0; j < 4; j++) { g.fillStyle = C(k * 30 + j * 20, 50 + j * 6, .6); const r = 40 + j * 45 + Math.sin(t * 1.5 + j) * 15; g.beginPath(); g.moveTo(0, 0); g.lineTo(r, Math.sin(t + j) * 30); g.lineTo(r * .8, 40 + kick * 20); g.closePath(); g.fill(); } }
      g.setTransform(1, 0, 0, 1, 0, 0);
      break; }
    case 7: { // 전광판: 흐르는 메시지
      g.fillStyle = C(0, 20); g.fillRect(0, 0, 1024, 320); g.font = '900 120px "Malgun Gothic",sans-serif'; g.textBaseline = 'middle'; g.fillStyle = C(40, 70);
      const msg = '★ 추억의 나이트 ★ 오늘 밤 주인공은 바로 당신! ★ 디스코 타임 · 블루스 타임 ★ 부킹 환영 ★ ', wTxt = g.measureText(msg).width, off = (t * 160) % wTxt;
      g.fillText(msg, -off, 170); g.fillText(msg, wTxt - off, 170);
      break; }
    case 8: { // 불꽃놀이
      if (fw.length < 6 && Math.random() < .12) fw.push({ x: 120 + Math.random() * 780, y: 60 + Math.random() * 120, t: 0, h: Math.random() * 360 });
      for (let i = fw.length - 1; i >= 0; i--) { const f = fw[i]; f.t += 1 / 15; if (f.t > 2) { fw.splice(i, 1); continue; } const r = f.t * 90, a = Math.max(0, 1 - f.t / 2);
        for (let k = 0; k < 28; k++) { const an = k / 28 * 6.283; g.fillStyle = `hsla(${L0 == null ? f.h : H(f.h)},90%,${60 + k % 3 * 8}%,${a * dimK})`; g.fillRect(f.x + Math.cos(an) * r, f.y + Math.sin(an) * r + f.t * f.t * 18, 4, 4); } }
      break; }
    case 9: { // 디스코 체커 + 미러볼
      for (let i = 0; i < 16; i++) for (let j = 0; j < 5; j++) { g.fillStyle = C((i + j) * 20 + t * 30, (i + j + b.n) % 2 ? 50 : 22, (i + j + b.n) % 2 ? .9 : .5); g.fillRect(i * 64, j * 64, 62, 62); }
      const bg = g.createRadialGradient(492, 130, 10, 512, 150, 90); bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#556'); g.fillStyle = bg; g.beginPath(); g.arc(512, 150, 90, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; for (let k = -4; k <= 4; k++) { g.beginPath(); g.ellipse(512, 150, Math.abs(Math.cos(k / 4 * 1.4 + t)) * 90, 90, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(422, 150 + k * 20); g.lineTo(602, 150 + k * 20); g.stroke(); }
      break; }
  }
  g.restore();
  if (W.ledMsg && performance.now() < W.ledMsg.until) {   // v18 전광판 알림(샴페인 쇼·DJ 테이크오버 등): 영상 위에 크게
    const m = W.ledMsg, k = .5 + .5 * Math.sin(t * 6); g.fillStyle = `rgba(10,4,20,${.72})`; g.fillRect(0, 90, 1024, 140);
    g.font = '900 78px "Malgun Gothic",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = m.color || '#ffd23d'; g.shadowBlur = 20 + 20 * k; g.fillStyle = '#fff';
    g.fillText(m.text, 512, 162); g.shadowBlur = 0; g.textAlign = 'left'; g.drawImage(ledMask, 0, 0); ledTex.needsUpdate = true; return; }
  if (ledMode === 0 || ledMode === 3) { g.font = '900 64px Arial'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = '#ff3d9a'; g.shadowBlur = 26;
    g.globalAlpha = dimK; g.fillText(b.n % 16 < 8 ? TH.text : 'DJ NOSTALGIA ♪ ' + Math.round(b.bpm) + ' BPM', 512 + Math.sin(t) * 40, 80); g.shadowBlur = 0; g.globalAlpha = 1; }
  g.textAlign = 'left';
  g.drawImage(ledMask, 0, 0); ledTex.needsUpdate = true;
}
W.spots.dj = { x: DJX - Math.sin(DJR) * .95, z: DJZ - Math.cos(DJR) * .95, y: .5 + RISE, ry: DJR };   // 부스 뒤에서 홀을 향해

/* v24 원통형 댄서 무대(포디움) 2개 — 댄스플로어 좌우 가장자리 · 높이 0.9m · 지름 2.6m · 크롬 테두리 + LED 링
 *  위에서 무대 댄서 2명씩 춤 (stage.js) — 뒤 LED 벽을 가리지 않는 위치 */
const PODIUM_H = .9, PODIUM_R = 1.3;
W.podiums = [-10.4, 10.4].map(px => {
  const pz = -8.0;
  put(new T.Mesh(new T.CylinderGeometry(PODIUM_R, PODIUM_R + .08, PODIUM_H, 48), MAT.black), px, PODIUM_H / 2, pz);
  put(new T.Mesh(new T.CylinderGeometry(PODIUM_R + .02, PODIUM_R + .02, .05, 48), MAT.chrome), px, PODIUM_H - .02, pz);
  put(new T.Mesh(new T.CylinderGeometry(PODIUM_R - .04, PODIUM_R - .04, .02, 48), M.pbr ? MAT.marbleDark : MAT.black), px, PODIUM_H + .005, pz);
  const rings = [.2, .5].map(y => put(new T.Mesh(new T.TorusGeometry(PODIUM_R + .06, .025, 8, 64).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0xff3d9a, toneMapped: false })), px, y, pz));
  rings.forEach(r => { r.userData.dyn = true; });
  W.circles.push([px, pz, PODIUM_R + .25]);
  return { x: px, z: pz, y: PODIUM_H + .015, r: PODIUM_R, rings };
});
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
const speckPts = new T.Points(speckGeo, new T.PointsMaterial({ size: .2, map: NC.softDot(), vertexColors: true, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false })); S.add(speckPts);
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
const TABLES = TABLE_POS.map(([x, z], i) => ({ id: i, x, z }));   // v15: 홀 뒤쪽 2줄 × 6 + 플로어 양옆 4
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
  [[.45, .45], [-.55, -.3]].forEach(([dx, dz]) => put(new T.Mesh(new T.CylinderGeometry(.035, .028, .11, 12, 1, true), glassMat), tb.x + dx, .95, tb.z + dz));
  for (let s = 0; s < 4; s++) { const p = NC.seatPos(tb.id, s); put(new T.Mesh(new T.CylinderGeometry(.46, .42, .14, 24), MAT.leatherPlain), p.x, .47, p.z); put(new T.Mesh(new T.CylinderGeometry(.05, .05, .4, 8), MAT.chrome), p.x, .2, p.z); put(new T.Mesh(new T.TorusGeometry(.3, .015, 6, 24), MAT.gold), p.x, .16, p.z).rotation.x = Math.PI / 2; }
  const tag = new T.Sprite(new T.SpriteMaterial({ map: NC.textTex('T' + (tb.id + 1), 128, 64, '800 44px Arial', '#ffffff', '#ff3d9a'), transparent: true, depthWrite: false })); tag.scale.set(1.0, .5, 1); tag.position.set(tb.x, 2.2, tb.z); S.add(tag);
  // 테이블 위 작은 펜던트(빛 웅덩이)
  put(new T.Mesh(new T.CylinderGeometry(.005, .005, 6.5, 4), MAT.black), tb.x, 7.75, tb.z);
  const shade = put(new T.Mesh(new T.ConeGeometry(.32, .3, 24, 1, true), M.std('#1a1410', { roughness: .4, metalness: .6, side: T.DoubleSide })), tb.x, 4.4, tb.z);
  put(new T.Mesh(new T.SphereGeometry(.09, 12, 8), M.glow('#ffd29a')), tb.x, 4.3, tb.z).material.color.multiplyScalar(5); void shade;
  W.circles.push([tb.x, tb.z, 2.3]);
});
for (let i = tblStart; i < S.children.length; i++) S.children[i].position.y += TY;
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

/* ═════ ④ v15 ㄷ자 외곽 동(棟) + VIP 앞 웨이터·부킹 통로 ═════
 *  서쪽 동: 노래방(룸 1~4호 · 메인 입구) + 흡연실 · 동쪽 동: 바(북쪽) + 화장실(남쪽) + 창고 · 남쪽: VIP 룸 3개
 *  각 동은 높이 4.6m 매스 + 대리석 파사드(원목 웨인스코팅 · 금색 몰딩 · 상단 네온) */
const WING = W.wing = { west: -17.85, east: 17.85, z0: -ROOM.z, z1: 9.5 }, WING_H = 4.6;   // v16: 남쪽 끝을 9.5로 줄여 부킹 통로가 양쪽 벽(2층 계단 입구)까지 이어짐
let corridorLight = null, kdoorLight = null;
{ const CZ = 10.75, WH = 4.6;
  const carpet = put(new T.Mesh(new T.PlaneGeometry(ROOM.x * 2, 2.2), MAT.carpet), 0, .012, CZ); carpet.rotation.x = -Math.PI / 2; carpet.receiveShadow = !!Q.shadows;
  { const pts = []; for (let x = -23; x <= 23; x += 1.5) for (const z of [CZ - 1.0, CZ + 1.0]) pts.push([x, .02, z]);
    const im = new T.InstancedMesh(new T.CylinderGeometry(.06, .06, .03, 12), M.glow('#ffe27a'), pts.length), o = new T.Object3D(); im.material.color.multiplyScalar(3); pts.forEach((p, i) => { o.position.set(...p); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); S.add(im); }
  // 매스(동) 하나 = 박스 + 파사드 마감. face: +1 = 동쪽(+x)을 바라봄, -1 = 서쪽
  const mass = (x0, x1, z0, z1, face, glow) => {
    put(new T.Mesh(box(x1 - x0, WH, z1 - z0), MAT.marbleDark), (x0 + x1) / 2, WH / 2, (z0 + z1) / 2);
    const fx = face > 0 ? x1 + .03 : x0 - .03, L = z1 - z0, cz = (z0 + z1) / 2;
    put(new T.Mesh(box(.06, 1.2, L), MAT.wood), fx, .6, cz); put(new T.Mesh(box(.08, .05, L), MAT.gold), fx, 1.22, cz);
    put(new T.Mesh(box(.08, .07, L), M.emi(glow, 3)), fx, WH - .12, cz); put(new T.Mesh(box(.1, .14, L + .1), MAT.gold), fx, WH, cz);
    for (let z = z0 + 1.6; z < z1 - .8; z += 3.2) put(new T.Mesh(box(.12, WH - 1.3, .22), MAT.marbleTop), fx, 1.3 + (WH - 1.3) / 2, z);   // 파사드 기둥
    W.rects.push([x0, z0, x1, z1]); };
  mass(-ROOM.x, WING.west, -ROOM.z, WING.z1, +1, '#ff5fc8');          // 서쪽: 노래방 동
  mass(WING.east, ROOM.x, 2.9, WING.z1, -1, '#3dd8ff');               // 동쪽: 화장실 동
  mass(18.4, ROOM.x, -ROOM.z, -14.2, -1, '#ffb35a');                  // 동북: 바 창고
  // 서쪽 동 간판
  { const big = NC.neonSign('🎤 노래방 KARAOKE', 8, 1.3, { font: '900 110px "Malgun Gothic",sans-serif', color: '#fff2fb', glow: '#ff3dbb', ph: 180 }); big.material.color.setScalar(2.2); big.position.set(WING.west + .1, WH + .9, -1); big.rotation.y = Math.PI / 2; S.add(big); }
  // 웨이터 스테이션 (통로 가운데 서쪽, VIP 라운지 파사드 앞 — 북쪽을 바라봄)
  { const wx = -10, wz = 11.5;
    put(new T.Mesh(box(1.4, 1.1, .8), MAT.wood), wx, .55, wz); put(new T.Mesh(box(1.5, .05, .9), MAT.marbleDark), wx, 1.12, wz); put(new T.Mesh(box(1.5, .03, .03), M.emi('#ffd23d', 3)), wx, 1.08, wz - .45);
    const ws = NC.neonSign('🤵 WAITER', 1.6, .4, { font: '800 100px Arial', color: '#fff6c8', glow: '#ffb800', ph: 200 }); ws.material.color.setScalar(1.8); ws.position.set(wx, 1.55, wz - .42); ws.rotation.y = Math.PI; S.add(ws);
    W.rects.push([wx - .7, wz - .4, wx + .7, 11.95]); W.spots.waiterStation = { x: wx, z: wz - 1.3, ry: Math.PI }; }
  { const bs = NC.neonSign('BOOKING ROAD · 부킹 통로', 7, 1.1, { font: '800 80px "Malgun Gothic",sans-serif', color: '#ffd1ea', glow: '#ff3d9a' }); bs.material.color.setScalar(2); bs.position.set(0, 3.75, 11.9); bs.rotation.y = Math.PI; S.add(bs); }   // v16: VIP 라운지 파사드 위쪽에 부착(2층 유리를 가리지 않게)
  corridorLight = new T.PointLight(col('#ff9ad0'), .9, 24); corridorLight.position.set(0, 4.5, CZ); S.add(corridorLight);
  W.corridorY = CZ;
  // ★ 노래방 메인 입구 (서쪽 동 가운데)
  const dx = WING.west + .06, dz = -1;
  put(new T.Mesh(box(.2, 3.0, 2.4), MAT.gold), dx, 1.5, dz);
  const door = put(new T.Mesh(new T.PlaneGeometry(2.0, 2.7), pbr('tufted', { repeat: [2, 3], color: '#8a1a4a', gen: { leather: true, cells: 3 } })), dx + .12, 1.35, dz); door.rotation.y = Math.PI / 2;
  put(new T.Mesh(box(.05, .05, 2.2), M.emi('#ff5fa8', 4)), dx + .15, 2.8, dz);
  const ks = NC.neonSign('🎤 노래방 입구', 3.2, .9, { font: '900 120px "Malgun Gothic",sans-serif', color: '#fff2fb', glow: '#ff3dbb', ph: 256 }); ks.material.color.setScalar(2.4); ks.position.set(dx + .14, 3.45, dz); ks.rotation.y = Math.PI / 2; S.add(ks);
  kdoorLight = new T.PointLight(col('#ff5fc8'), 1.1, 7); kdoorLight.position.set(dx + 1.2, 2.6, dz); S.add(kdoorLight);
  W.spots.karaokeDoor = { x: dx + 1.1, z: dz };
  // 노래방 룸 문 (장식 · 번호 네온) — 실제 입장은 메인 입구에서 카운터 안내
  const roomDoor = (z, no) => { put(new T.Mesh(box(.14, 2.5, 1.4), MAT.gold), dx, 1.25, z); const d = put(new T.Mesh(new T.PlaneGeometry(1.15, 2.3), pbr('wood', { repeat: [1, 2], roughness: .5, gen: { a: '#2a0f1e', b: '#5a1e3a' } })), dx + .09, 1.15, z); d.rotation.y = Math.PI / 2;
    put(new T.Mesh(box(.04, .3, .3), M.std('#141018', { roughness: .1, metalness: .5, transparent: true, opacity: .7 })), dx + .1, 1.65, z);   // 작은 유리창
    const n = NC.neonSign(`${no}호`, .9, .4, { font: '900 120px Arial', color: '#fff', glow: '#ff6fd8', ph: 160 }); n.material.color.setScalar(2); n.position.set(dx + .12, 2.65, z); n.rotation.y = Math.PI / 2; S.add(n); };
  [[-6.5, 1], [3.6, 2], [7.4, 3], [-13.5, 5]].forEach(([z, no]) => roomDoor(z, no));
  // ★ 화장실 (동쪽 동) · 흡연실 (서쪽 동 북쪽)
  const doorAt = (x, z, ry, label, glow) => { put(new T.Mesh(box(.2, 2.8, 1.8), MAT.gold), x, 1.4, z).rotation.y = ry; const dp = put(new T.Mesh(new T.PlaneGeometry(1.5, 2.5), pbr('wood', { repeat: [1, 2], roughness: .5, gen: { a: '#1a100a', b: '#3e2616' } })), x + Math.sin(ry) * .12, 1.25, z + Math.cos(ry) * .12); dp.rotation.y = ry;
    const sg = NC.neonSign(label, 2.4, .6, { font: '900 110px "Malgun Gothic",sans-serif', color: '#ffffff', glow, ph: 220 }); sg.material.color.setScalar(2.2); sg.position.set(x + Math.sin(ry) * .14, 3.05, z + Math.cos(ry) * .14); sg.rotation.y = ry; S.add(sg); };
  doorAt(WING.east - .06, 5.2, -Math.PI / 2, '🚹 남자', '#3dd8ff'); W.spots.restroomDoor = { x: WING.east - 1.1, z: 5.2 };
  doorAt(WING.east - .06, 8.6, -Math.PI / 2, '🚺 여자', '#ff5fb0'); W.spots.wroomDoor = { x: WING.east - 1.1, z: 8.6 };
  doorAt(WING.west + .06, -10, Math.PI / 2, '🚬 흡연실', '#ffb03d'); W.spots.smokeDoor = { x: WING.west + 1.1, z: -10 };
  { const rs = NC.neonSign('RESTROOM · 화장실', 4.2, .8, { font: '800 90px "Malgun Gothic",sans-serif', color: '#e8fbff', glow: '#3dd8ff', ph: 200 }); rs.material.color.setScalar(2); rs.position.set(WING.east - .1, WH + .7, 7); rs.rotation.y = -Math.PI / 2; S.add(rs); }
}

/* ═════ ③ VIP 룸 ═════ */
const VY = 4.6, BAL_Z = 12, STAIR_RUN = 5, LAND = 1.0;   // v16: VIP 2층 바닥 높이 · 발코니 시작선 · 계단 길이
const vipFrom = S.children.length;
const VIP_Z0 = 13.6, VIP_Z1 = ROOM.z, VIP_COL = ['#b07cff', '#ffc46b', '#ff6fae'];
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
  const TZ = 16.4;   // 테이블 중심
  for (const s of [-1, 1]) { put(new T.Mesh(box(1.3, .45, 3.8), sofa), cx + s * 5.4, .225, 16.2); put(new T.Mesh(box(.35, 1.0, 3.8), sofa), cx + s * 6.15, .7, 16.2); }
  put(new T.Mesh(box(4.2, .08, 1.8), MAT.marbleTop), cx, .58, TZ); put(new T.Mesh(box(3.8, .52, 1.4), MAT.black), cx, .28, TZ); put(new T.Mesh(box(4.25, .025, 1.85), frameMat), cx, .535, TZ);
  W.rects.push([cx - 2.1, TZ - .9, cx + 2.1, TZ + .9], [x0, 18.2, x1, VIP_Z1], [x0, 14.2, x0 + 1.5, 18.2], [x1 - 1.5, 14.2, x1, 18.2]);
  const champ = new T.Group(); champ.visible = false; champ.position.set(cx + 1.2, .62, TZ);
  champ.add(new T.Mesh(new T.CylinderGeometry(.22, .17, .35, 20), MAT.chrome)); champ.children[0].position.y = .17;
  const bt = new T.Mesh(new T.CylinderGeometry(.06, .08, .55, 12), M.std('#123a1a', { metalness: .3, roughness: .08 })); bt.position.set(0, .45, 0); bt.rotation.z = .3; champ.add(bt);
  const foil = new T.Mesh(new T.CylinderGeometry(.03, .06, .12, 10), MAT.gold); foil.position.set(.08, .74, 0); foil.rotation.z = .3; champ.add(foil); S.add(champ);
  // 조명 · 크리스털 샹들리에 · 간판
  const L = new T.PointLight(col(c), 1.5, 14); L.position.set(cx, 3.4, TZ); S.add(L);
  { const n = 46, im = new T.InstancedMesh(new T.OctahedronGeometry(.06, 0), crystal, n), o = new T.Object3D();
    for (let k = 0; k < n; k++) { const ring = k % 3, a = k / n * Math.PI * 2 * 3; o.position.set(cx + Math.cos(a) * (.25 + ring * .22), 3.95 - ring * .18 - (k % 2) * .08, TZ + Math.sin(a) * (.25 + ring * .22)); o.scale.set(1, 1.8, 1); o.updateMatrix(); im.setMatrixAt(k, o.matrix); } S.add(im);
    put(new T.Mesh(new T.TorusGeometry(.7, .015, 6, 40), frameMat), cx, 3.9, TZ).rotation.x = Math.PI / 2; put(new T.Mesh(new T.SphereGeometry(.12, 12, 10), M.glow('#fff4e0')), cx, 3.85, TZ).material.color.multiplyScalar(5); }
  const sg = NC.neonSign(`VIP ${i + 1}`, 2.4, .8, { font: '900 150px Arial', color: '#fff', glow: c, ph: 256 }); sg.material.color.setScalar(2.2); sg.position.set(cx, 4.75, VIP_Z0 - .16); sg.rotation.y = Math.PI; S.add(sg);
  const door = { cx, open: 0, panels: [] };
  for (const s of [-1, 1]) { const p = put(new T.Mesh(box(DOOR_W / 2, 3.3, .04), new T.MeshStandardMaterial({ color: col(c), transparent: true, opacity: .26, roughness: .04, metalness: .5, envMapIntensity: 1.8, depthWrite: false })), cx + s * DOOR_W / 4, 1.7, VIP_Z0 - .06); p.userData.s = s; p.userData.dyn = true; door.panels.push(p); }
  const doorLed = put(new T.Mesh(box(DOOR_W, .05, .05), M.emi('#6dff8a', 3)), cx, 3.45, VIP_Z0 - .1); door.led = doorLed; doorLed.userData.dyn = true; doorLed.material = doorLed.material.clone();
  const tableC = { x: cx, z: TZ };
  const seats = [[cx - 2.2, 18.5], [cx, 18.5], [cx + 2.2, 18.5], [cx - 5.1, 16.9], [cx + 5.1, 16.9], [cx - 5.1, 15.0]].map(([x, z]) => ({ x, z, ry: Math.atan2(tableC.x - x, tableC.z - z), h: .45 }));
  W.vip.push({ id: i, cx, x0, x1, z0: VIP_Z0, z1: VIP_Z1, color: c, door, seats, occ: seats.map(() => null), light: L, champ, y: VY, table: tableC, entry: { x: cx, z: VIP_Z0 + 1.0 }, front: { x: cx, z: VIP_Z0 - .85 } });
});
for (let i = vipFrom; i < S.children.length; i++) S.children[i].position.y += VY;   // v16: VIP 룸 전체를 2층으로

/* ═════ v16 VIP 2층 구조: 1층 라운지 파사드 · 발코니(유리 난간) · 양 끝 계단 ═════
 *  2D 판정: z 12~13.6 = 발코니(높이 4.6) · 그 양 끝 x ±19~24 = 계단(벽 쪽 바닥 0 → 안쪽 4.6) · z 13.6~20 = 룸
 *  1층에서는 x ±22.6~24 구간(계단 첫 단)으로만 올라갈 수 있게 나머지 경계에 난간(벽)을 둔다 */
{ const SX = ROOM.x - STAIR_RUN, BZ1 = VIP_Z0, BD = BZ1 - BAL_Z, bcz = (BAL_Z + BZ1) / 2;
  put(new T.Mesh(box(SX * 2, VY, BD), MAT.marbleDark), 0, VY / 2, bcz);                                        // 발코니 아래 매스
  put(new T.Mesh(box(ROOM.x * 2, VY, VIP_Z1 - BZ1), MAT.marbleDark), 0, VY / 2, (BZ1 + VIP_Z1) / 2);             // 룸 아래 매스
  put(new T.Mesh(box(SX * 2 + .1, .06, BD + .05), MAT.stageFloor), 0, VY + .005, bcz).receiveShadow = !!Q.shadows;   // 발코니 바닥
  // 1층 파사드: 원목 웨인스코팅 · 금색 몰딩 · 벽등 · 「VIP LOUNGE 2F」 간판 · 발코니 아래 LED
  put(new T.Mesh(box(SX * 2, 1.2, .06), MAT.wood), 0, .6, BAL_Z - .03); put(new T.Mesh(box(SX * 2, .05, .08), MAT.gold), 0, 1.22, BAL_Z - .04);
  put(new T.Mesh(box(SX * 2 + .2, .12, .14), MAT.gold), 0, VY - .02, BAL_Z - .05); put(new T.Mesh(box(SX * 2, .05, .05), M.emi('#ffb35a', 3.5)), 0, VY - .14, BAL_Z - .1);
  for (let x = -16; x <= 16; x += 4) { if (Math.abs(x) < 5) continue; put(new T.Mesh(box(.24, .34, .1), MAT.gold), x, 2.5, BAL_Z - .06); put(new T.Mesh(new T.SphereGeometry(.09, 10, 8), M.glow('#ffd8a0')), x, 2.72, BAL_Z - .14).material.color.multiplyScalar(3); }
  { const sg = NC.neonSign('VIP LOUNGE · 2F ▲', 6, 1, { font: '900 100px Arial', color: '#fff3d6', glow: '#ffb35a', ph: 200 }); sg.material.color.setScalar(2.2); sg.position.set(0, 2.15, BAL_Z - .08); sg.rotation.y = Math.PI; S.add(sg); }
  // 발코니 유리 난간 (문 앞은 통로라 막지 않음 — 2층에서 아래로 떨어지지 않게 2D 경계는 아래 rects)
  const railG = new T.MeshStandardMaterial({ color: col('#d8c8ff'), transparent: true, opacity: .18, roughness: .03, metalness: .3, depthWrite: false, side: T.DoubleSide });
  put(new T.Mesh(box(SX * 2, 1.0, .04), railG), 0, VY + .55, BAL_Z + .04); put(new T.Mesh(new T.CylinderGeometry(.035, .035, SX * 2, 10).rotateZ(Math.PI / 2), MAT.chrome), 0, VY + 1.08, BAL_Z + .04);
  for (let x = -SX; x <= SX + .01; x += 2.6) put(new T.Mesh(new T.CylinderGeometry(.025, .025, 1.05, 8), MAT.chrome), x, VY + .53, BAL_Z + .04);
  put(new T.Mesh(box(SX * 2, .03, .03), M.emi('#b07cff', 3)), 0, VY + .06, BAL_Z + .07);
  // 계단 (양 끝, 벽 쪽이 1층) — 12단 + 측면 난간
  const N = 12, sw = (STAIR_RUN - LAND) / N;   // 벽 쪽 1m 는 1층 높이 착지대
  for (const sd of [-1, 1]) {
    for (let k = 0; k < N; k++) { const h = VY * (k + 1) / N, x = sd * (ROOM.x - LAND - (k + .5) * sw); put(new T.Mesh(box(sw + .01, h, BD), MAT.stageFloor), x, h / 2, bcz); put(new T.Mesh(box(sw, .02, .04), M.emi('#ffd27a', 2.2)), x, h + .012, BAL_Z + .05); }
    const rl = new T.Mesh(new T.CylinderGeometry(.03, .03, Math.hypot(STAIR_RUN - LAND, VY), 8), MAT.chrome); rl.rotation.z = sd * -(Math.PI / 2 - Math.atan2(VY, STAIR_RUN - LAND)); put(rl, sd * (ROOM.x - LAND - (STAIR_RUN - LAND) / 2), VY / 2 + 1, BAL_Z + .05);
    const st = NC.neonSign('▲ VIP 2F', 1.8, .5, { font: '900 100px Arial', color: '#fff', glow: '#b07cff', ph: 200 }); st.material.color.setScalar(2); st.position.set(sd * (ROOM.x - .9), 2.4, BAL_Z - .1); st.rotation.y = Math.PI; S.add(st);
  }
  // 2D 경계: 발코니·계단 위쪽(통로 쪽) 난간 — 벽 쪽 2m(착지대 + 첫 단)만 열어 둠
  W.rects.push([-(ROOM.x - 2.0), BAL_Z - .08, ROOM.x - 2.0, BAL_Z]);
  W.vipFloor = { y: VY, z0: BAL_Z, z1: BZ1, stairX: SX };
}

/* 다른 공간(노래방)이 들어갈 때 빌려 쓰는 광원 — 광원 개수를 늘리지 않아 셰이더 재컴파일·프레임 저하가 없음 */
W.lights = { key, ball: ballSpot };
W.lights.corridor = corridorLight; W.lights.kdoor = kdoorLight;
S.children.forEach(o => { if (o.isPointLight && !W.lights.bar && Math.abs(o.position.x - 20.5) < .01) W.lights.bar = o; });
/* ── 질의 함수 ── */
W.extraZones = [];      // karaoke.js 등 별도 공간이 { test(x,z), name, collide(p,r), label } 로 등록
W.terraceVia = () => [];   // v15: 테라스 없음(평지)
W.vipAt = (x, z) => { for (const v of W.vip) if (x > v.x0 + .1 && x < v.x1 - .1 && z > v.z0 + .1 && z < v.z1) return v.id; return -1; };
W.zoneAt = (x, z) => {
  for (const e of W.extraZones) if (e.test(x, z)) return { name: e.name };
  const v = W.vipAt(x, z); if (v >= 0) return { name: 'vip', room: v };
  if (z >= BAL_Z && z < VIP_Z0) return { name: Math.abs(x) > ROOM.x - STAIR_RUN ? 'stairs' : 'balcony' };
  if (inR(Z.stage, x, z)) return { name: 'stage' }; if (inR(Z.dance, x, z)) return { name: 'dance' };
  if (inR(Z.corridor, x, z)) return { name: 'corridor' }; if (inR(Z.bar, x, z)) return { name: 'bar' }; if (z > -2.6 || Math.abs(x) > 9.5) return { name: 'tables' }; return { name: 'hall' };
};
W.zoneLabel = { hall: '메인 홀', stage: '메인 스테이지', dance: '댄스플로어', corridor: '부킹 통로', bar: '바', tables: '테이블존', vip: 'VIP 룸 (2층)', dj: 'DJ 부스', balcony: 'VIP 2층 복도', stairs: 'VIP 계단' };
const terraceY = () => -1;   // v15: 테라스 없음
W.terraceY = terraceY;
const vipFloorY = (x, z) => { if (z < BAL_Z || z > ROOM.z) return -1; const ax = Math.abs(x), sx = ROOM.x - STAIR_RUN; if (z < VIP_Z0 && ax > sx) return VY * U.clamp((ROOM.x - LAND - ax) / (STAIR_RUN - LAND), 0, 1); return VY; };
W.vipFloorY = vipFloorY;
const DANCE_Y = .108;   // v24 댄스플로어 LED 타일(0.1m)+강화유리 위를 걷도록 — 발목이 바닥에 잠기던 문제
NC.groundY = (x, z) => { const vy = vipFloorY(x, z); if (vy >= 0) return vy; if (inR(Z.dj, x, z)) return Z.dj.y; if (x < stg.x0 || x > stg.x1 || z < -ROOM.z || z > ROOM.z) return 0; if (z <= stg.z1) return .5; if (z < stg.z1 + .9 && Math.abs(x) < 3) return .5 * (1 - (z - stg.z1) / .9); return inR(Z.dance, x, z) ? DANCE_Y : 0; };
W.locked = i => (NC.roomLockedForMe ? NC.roomLockedForMe(i) : false);
/* v18 카메라 벽 회피: 플레이어(t)→카메라(p) 사이에 벽(서쪽·동쪽 동, VIP 2층 아래 매스, 바깥 벽)이 있으면 카메라를 그 앞까지 당김
 *  → 무대 쪽을 바라봐도 뒤쪽 벽이 화면을 가리지 않고 홀 전경이 보임 */
W.camHull = (x, y, z, up) => {
  if (Math.abs(x) > ROOM.x - .6 || z < -ROOM.z + .4 || z > ROOM.z - .4 || y > ROOM.h - .4 || y < .3) return false;
  if (y < WING_H + .3) { if (x < WING.west + .15 && z < WING.z1 + .15) return false; if (x > WING.east - .15 && ((z > 2.75 && z < WING.z1 + .15) || z < -14.05)) return false; }
  if (!up && z > BAL_Z - .25 && y < VY + 4.8) return false;          // 1층에서는 VIP 라운지 매스·2층 룸 안으로 카메라가 들어가지 않게
  if (up && z > VIP_Z0 - .1 && W.vipAt(x, z) < 0 && y < VY + 4.6) return false;
  return true;
};
W.clampCam = (t, p, up) => {
  const N = 28; let ok = 0; for (let i = 1; i <= N; i++) { const k = i / N; if (!W.camHull(t.x + (p.x - t.x) * k, t.y + (p.y - t.y) * k, t.z + (p.z - t.z) * k, up)) break; ok = k; }
  if (ok >= 1) return;
  // 막혔으면 위에서 내려다보지 않고, 낮게 깔아 플레이어 바로 뒤로 당김 → 플레이어 너머로 무대·홀 전경이 앞에 펼쳐짐
  const hx = p.x - t.x, hz = p.z - t.z; let ok2 = 0;
  for (let i = 1; i <= N; i++) { const k = i / N, y = t.y + .8 + 1.4 * k; if (!W.camHull(t.x + hx * k, y, t.z + hz * k, up)) break; ok2 = k; }
  const k = Math.max(ok2 - .04, .14); p.set(t.x + hx * k, t.y + .8 + 1.4 * k, t.z + hz * k);
};
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
  const SPK = TH.sparkle !== false, kick = SPK ? 1 - b.phase : .35;   // v15: 반짝임 없는 테마 = 비트 펄스·반사점·깜빡임 정지
  speckPts.visible = SPK; if (!(W.spotBorrowed && W.spotBorrowed())) ballSpot.intensity = SPK ? 1.2 : 0;   // v18: features.js 가 스팟을 빌린 동안은 건드리지 않음 if (SPK) { ball.rotation.y += dt * .5; updateSpecks(ball.rotation.y); }
  const sp = TH.speed, spK = TH.spotK ?? 1, OFF = !!TH.nostage;
  spots.forEach(s => { const a = t * .55 * sp + s.k * 1.6; s.tg.position.set(Math.cos(a) * 7, 0, -8 + Math.sin(a * 1.3) * 5.5);
    const dx = s.tg.position.x - s.pos.x, dy = s.tg.position.y - s.pos.y, dz = s.tg.position.z - s.pos.z;
    s.yoke.rotation.y = Math.atan2(dx, dz); s.head.rotation.x = -Math.atan2(-dy, Math.hypot(dx, dz)) + 0; s.head.rotation.x = Math.atan2(-dy, Math.hypot(dx, dz));
    if (s.L) s.L.intensity = (SPK ? 2.2 + Math.sin(t * 3 * sp + s.k) * .5 + kick * .5 * sp : 2.1) * spK; s.beam.visible = !OFF && TH.beam > 0; s.beam.material.uniforms.time.value = t; s.beam.material.uniforms.intensity.value = ((s.L ? .26 : .2) + kick * .1 * sp) * TH.beam; });
  glows[0].intensity = OFF ? 0 : SPK ? 1.1 + Math.sin(t * 4) * .4 : 1; glows[1].intensity = OFF ? 0 : SPK ? 1.1 + Math.cos(t * 4) * .4 : 1;
  for (let i = 0, k = 0; i < TX; i++) for (let j = 0; j < TZ; j++, k++) { const f = (t * .1 * sp + (i + j) * .045) % 1, h = (TH.h0 + (TH.h1 - TH.h0) * (TH.h1 - TH.h0 >= .99 ? f : .5 + .5 * Math.sin(f * 6.283))) % 1, v = SPK ? .35 + .4 * Math.max(0, Math.sin(t * 2 * sp + (i * 2 + j * 3) * .6)) + kick * .25 * sp * ((i + j + b.n) % 2) : .5 + .08 * Math.sin(t * .3 + (i + j) * .25); tmpC.setHSL(h, TH.sat, v * TH.lit); tiles.setColorAt(k, tmpC); }
  if (W.djHue != null) for (let i = 0, k = 0; i < TX; i++) for (let j = 0; j < TZ; j++, k++) { const w = W.djWave ? Math.sin(t * 4 + i * .7 - j * .5) : 0; tiles.setColorAt(k, tmpC.setHSL((W.djHue + w * .08 + 1) % 1, .95, .38 + .2 * Math.max(0, w) + kick * .12)); }   // v18 DJ 테이크오버: 플레이어가 고른 색 파형
  tiles.instanceColor.needsUpdate = true;
  if (W.djHue != null) spots.forEach((s, i) => { if (s.L) s.L.color.setHSL((W.djHue + i * .04 + (W.djWave ? Math.sin(t * 2 + i) * .06 : 0) + 1) % 1, 1, .55); });
  const pattern = Math.floor(b.n / 8) % 4, laserOn = TH.laser && pattern !== 3; const hue = (Math.floor(b.n / 4) * .17) % 1;
  lasers.forEach((m, i) => {
    m.visible = laserOn; if (!laserOn) return;
    const f = (i / (lasers.length - 1) - .5) * 1.8, a = pattern === 0 ? f + Math.sin(t * .9) * .5 : pattern === 1 ? f * Math.sin(t * 1.4) : f + (i % 2 ? 1 : -1) * Math.sin(t * 2) * .3;
    lzTarget.set(Math.sin(a) * 30, pattern === 2 ? 1 + Math.sin(t * 3 + i) * 2 : .4 + Math.abs(Math.sin(t * .7 + i * .3)) * 3, -18.9 + Math.cos(a) * 30); m.lookAt(lzTarget);
    m.material.color.setHSL(TH.laserHue ? (TH.laserHue[0] + (TH.laserHue[1] - TH.laserHue[0]) * ((hue + i * .05) % 1)) % 1 : (hue + i * .015) % 1, 1, .5).convertSRGBToLinear().multiplyScalar(1.5); m.material.opacity = .18 + .3 * kick;
  });
  haze.forEach(h => { h.sp.visible = !OFF; h.p += dt * .12; h.sp.position.set(h.x + Math.sin(h.p) * 1.5, h.y + Math.sin(h.p * 1.3) * .3, h.z + Math.cos(h.p * .8) * 1.2); h.sp.material.rotation += h.r * dt; h.sp.material.opacity = .05 + .02 * Math.sin(h.p * 2) + kick * .01; });
  candles.forEach((c, i) => { const f = .8 + .2 * Math.sin(t * 13 + i * 3) * Math.sin(t * 7.3 + i); c.material.color.setRGB(4 * f, 2.2 * f, .7 * f); c.scale.y = 1.4 + .3 * f; });
  W.podiums.forEach((p, i) => p.rings.forEach((r, k) => r.material.color.setHSL(((t * .12 + i * .5 + k * .25) % 1), 1, .55).multiplyScalar(1.4 + .8 * (1 - b.phase)))); vidTick(); ledT += dt; if (ledT > (Q.level === 'low' ? 1 / 8 : 1 / 15)) { ledT = 0; drawLED(t, b); }
  W.vip.forEach(v => {
    const locked = W.locked(v.id); let want = false;
    for (const a of agents || []) if (Math.abs(a.x - v.cx) < 1.9 && Math.abs(a.z - VIP_Z0) < 2.2 && !(a.me && locked)) { want = true; break; }
    v.door.open = U.clamp(v.door.open + (want ? dt * 2.2 : -dt * 1.6), 0, 1);
    v.door.panels.forEach(p => { p.position.x = v.cx + p.userData.s * (DOOR_W / 4 + v.door.open * DOOR_W / 2.1); });
    v.door.led.material.emissive.copy(col(locked ? '#ff3355' : v.occ.some(Boolean) ? '#ffd23d' : '#6dff8a'));
    v.light.intensity = 1.3 + .25 * Math.sin(t * 1.5 + v.id);
  });
  if (W.marquee) { for (let i = 0; i < W.marqueeN; i++) { const on = SPK ? ((i + Math.floor(t * 6)) % 3) === 0 : true; tmpC.setRGB(on ? 3.2 : .9, on ? 2.4 : .6, on ? 1.3 : .3); W.marquee.setColorAt(i, tmpC); } W.marquee.instanceColor.needsUpdate = true; }
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
W.setTheme(THEMES[U.store.get('nc_theme2', 'house')] ? U.store.get('nc_theme2', 'house') : 'house');   // v22 기본 = 💡 전등만(무대 조명 끔)
// 그림자: 바닥·무대는 받기, 큰 가구는 드리우기
if (Q.shadows) S.children.forEach(o => { if (o.isMesh && !o.material.transparent && !o.isInstancedMesh && o !== floor && !o.userData.dyn) { o.castShadow = true; o.receiveShadow = true; } });
})();
