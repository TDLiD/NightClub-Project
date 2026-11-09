/* karaoke.js — 2차 노래방 (v3 신규)
 *  ■ 공간: 클럽 통로 서쪽 끝 '🎤 2차 노래방' 문 → 별도 룸(9.6×7.6m)으로 이동. 레트로 벽지·LED 코브·미러볼·대형 TV·U자 가죽 소파·
 *          유리 테이블(마이크·탬버린·맥주·과일안주). 클럽 광원 5개를 빌려 와 배치(광원 수 불변 → 끊김 없음)
 *  ■ 반주: WebAudio 신스 밴드(드럼·베이스·패드/EP/파워코드·가이드 멜로디) — 장르 6종(댄스·트로트·발라드·록·R&B·파티)
 *  ■ 곡: 전곡 자작 가사(저작권 무관). 멜로디는 가사 음절 수로 자동 작곡(코드톤 스냅) → 음절 단위 가사 와이프
 *  ■ 채점: 🎙 마이크(자기상관 음정 검출로 가이드 음과 비교) / 마이크 없으면 🪘 탬버린(Space) 박자 채점 / 둘 다 없으면 '기계 점수'
 *  ■ 동반: 호감도 55↑ 페르소나에게 "2차 같이 가요" → 함께 입장, 소파에서 호응(박수·환호), 차례가 되면 직접 노래, 점수에 따라 호감도 상승
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world) return;
const T = NC.THREE, S = NC.scene, M = NC.mat, U = NC.util, col = NC.col, W = NC.world, $ = NC.$;
const KX = 80, KZ = 0, HX = 4.8, HZ = 3.8, H = 3.2;
const G = new T.Group(); G.visible = false; S.add(G);
const add = (m, x, y, z) => { m.position.set(KX + x, y, KZ + z); G.add(m); return m; };
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
const pbr = (n, o) => M.pbr(n, o);

/* ═════════ 공간 ═════════ */
const MT = {
  floor: pbr('speckle', { repeat: [5, 4], roughness: 1, gen: { a: '#2b1a3c' } }),
  wall: pbr('wallpaper', { repeat: [5, 2], roughness: 1, gen: { a: '#1d1033', b: '#caa24c', c: '#ff5fa8' } }),
  sofa: pbr('tufted', { repeat: [6, 1], color: '#8a1f55', roughness: 1, gen: { leather: true, cells: 4 }, env: .9 }),
  ceil: pbr('ceiling', { repeat: [4, 3], roughness: 1 }),
  wood: pbr('wood', { repeat: [2, 1], roughness: .7, gen: { a: '#1a0f0a', b: '#40261a' } }),
  grill: pbr('grill', { repeat: [1, 3], roughness: 1 }),
  black: M.std('#0b0a10', { roughness: .18, metalness: .4 }),
  chrome: M.std('#e8e8f0', { roughness: .08, metalness: 1 }),
  gold: M.std('#d9b056', { roughness: .22, metalness: 1 }),
  glass: new T.MeshStandardMaterial({ color: 0xffffff, roughness: .02, metalness: .1, transparent: true, opacity: .25, envMapIntensity: 2.2, depthWrite: false }),
};
{ const f = add(new T.Mesh(new T.PlaneGeometry(HX * 2, HZ * 2), MT.floor), 0, 0, 0); f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
  const c = add(new T.Mesh(new T.PlaneGeometry(HX * 2, HZ * 2), MT.ceil), 0, H, 0); c.rotation.x = Math.PI / 2;
  [[0, -HZ, 0, HX * 2], [0, HZ, Math.PI, HX * 2], [-HX, 0, Math.PI / 2, HZ * 2], [HX, 0, -Math.PI / 2, HZ * 2]].forEach(([x, z, r, len]) => { const w = add(new T.Mesh(new T.PlaneGeometry(len, H), MT.wall), x, H / 2, z); w.rotation.y = r; w.receiveShadow = true;
    const b = add(new T.Mesh(box(len, .12, .04), MT.gold), x, .06, z); b.rotation.y = r; }); }
// LED 코브(천장 가장자리) — 색 순환
const cove = new T.MeshStandardMaterial({ color: 0x000000, emissive: col('#ff3dbb'), emissiveIntensity: 3 });
[[0, -HZ + .06, HX * 2, 0], [0, HZ - .06, HX * 2, 0], [-HX + .06, 0, HZ * 2, Math.PI / 2], [HX - .06, 0, HZ * 2, Math.PI / 2]].forEach(([x, z, len, r]) => { const m = add(new T.Mesh(box(len, .04, .04), cove), x, H - .12, z); m.rotation.y = r; });
// 천장 별빛
{ const n = 70, im = new T.InstancedMesh(new T.CircleGeometry(.025, 6).rotateX(Math.PI / 2), M.glow('#fff4d6'), n), o = new T.Object3D(), r = U.rng(5); im.material.color.multiplyScalar(4);
  for (let i = 0; i < n; i++) { o.position.set(KX + (r() - .5) * HX * 1.8, H - .005, KZ + (r() - .5) * HZ * 1.8); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } G.add(im); }
// TV + 캐비닛 + 스피커
const scrCv = document.createElement('canvas'); scrCv.width = 1024; scrCv.height = 576; const sg = scrCv.getContext('2d'); const scrTex = NC.tex(scrCv);
const scrMat = new T.MeshBasicMaterial({ map: scrTex }); scrMat.color.setScalar(1.35);
add(new T.Mesh(box(3.8, 2.15, .1), MT.black), 0, 1.75, -HZ + .06);
add(new T.Mesh(new T.PlaneGeometry(3.6, 2.02), scrMat), 0, 1.75, -HZ + .115);
add(new T.Mesh(box(4.0, .55, .55), MT.wood), 0, .275, -HZ + .3);
const machine = add(new T.Mesh(box(1.1, .16, .45), MT.black), -.9, .63, -HZ + .32);
const segCv = document.createElement('canvas'); segCv.width = 256; segCv.height = 64; const segTex = NC.tex(segCv); const segMat = new T.MeshBasicMaterial({ map: segTex }); segMat.color.setScalar(2.2);
add(new T.Mesh(new T.PlaneGeometry(.5, .11), segMat), -.9, .63, -HZ + .551); void machine;
for (const s of [-1, 1]) { add(new T.Mesh(box(.55, 1.7, .45), MT.black), s * 2.45, .85, -HZ + .3); add(new T.Mesh(new T.PlaneGeometry(.48, 1.6), MT.grill), s * 2.45, .85, -HZ + .526); }
// 소파(서쪽·남쪽 U자) + 쿠션
add(new T.Mesh(box(.85, .45, 5.0), MT.sofa), -HX + .45, .225, .1); add(new T.Mesh(box(.3, .95, 5.0), MT.sofa), -HX + .15, .55, .1);
add(new T.Mesh(box(6.4, .45, .85), MT.sofa), -1.6, .225, HZ - .45); add(new T.Mesh(box(6.4, .95, .3), MT.sofa), -1.6, .55, HZ - .15);
[['#ffd23d', -HX + .45, .55, -1.6], ['#3de6ff', -HX + .45, .55, 1.4], ['#ff8a3d', -3.5, .55, HZ - .45], ['#b07cff', 0, .55, HZ - .45]].forEach(([c, x, y, z]) => { const cu = add(new T.Mesh(new T.SphereGeometry(.22, 16, 12), pbr('fabric', { color: c, repeat: [3, 3], roughness: 1 })), x, y, z); cu.scale.set(1, .7, .45); cu.rotation.y = x < -3 ? Math.PI / 2 : 0; });
// 유리 테이블 + 소품
add(new T.Mesh(box(2.4, .04, 1.1), MT.glass), -2.0, .46, .6); add(new T.Mesh(box(2.3, .02, 1.0), MT.black), -2.0, .1, .6);
[[-3.1, .1], [-.9, .1], [-3.1, 1.1], [-.9, 1.1]].forEach(([x, z]) => add(new T.Mesh(new T.CylinderGeometry(.02, .02, .44, 8), MT.chrome), x, .23, z));
const micMesh = () => { const g = new T.Group(); const b = new T.Mesh(new T.CylinderGeometry(.018, .013, .2, 12), MT.black); g.add(b); const h = new T.Mesh(new T.SphereGeometry(.03, 14, 10), M.std('#c8c8d0', { metalness: .9, roughness: .45 })); h.position.y = .115; g.add(h); const ring = new T.Mesh(new T.TorusGeometry(.02, .004, 6, 16), M.emi('#ff3dbb', 3)); ring.rotation.x = Math.PI / 2; ring.position.y = .085; g.add(ring); return g; };
const tableMics = [micMesh(), micMesh()]; tableMics.forEach((m, i) => { m.rotation.z = Math.PI / 2; add(m, -2.6 + i * .25, .5, .45); });
{ const tb = new T.Group(); tb.add(new T.Mesh(new T.TorusGeometry(.11, .02, 8, 24), M.std('#c0392b', { roughness: .5 }))); for (let k = 0; k < 6; k++) { const d = new T.Mesh(new T.CylinderGeometry(.022, .022, .006, 10), MT.gold); const a = k / 6 * Math.PI * 2; d.position.set(Math.cos(a) * .11, Math.sin(a) * .11, 0); d.rotation.x = Math.PI / 2; tb.add(d); } tb.rotation.x = -Math.PI / 2; add(tb, -1.5, .5, .85); }
[['#2a5a1c', -1.1, .35], ['#2a5a1c', -1.0, .5], ['#6a3a10', -2.9, .9]].forEach(([c, x, z]) => add(new T.Mesh(new T.CylinderGeometry(.035, .045, .3, 10), M.std(c, { roughness: .06, metalness: .3 })), x, .63, z));
[[-1.8, .3], [-2.3, .95], [-1.3, .55]].forEach(([x, z]) => add(new T.Mesh(new T.CylinderGeometry(.04, .032, .12, 12, 1, true), MT.glass), x, .54, z));
{ add(new T.Mesh(new T.CylinderGeometry(.2, .14, .05, 20), M.std('#f0f0f0', { roughness: .2 })), -2.1, .5, .75); [['#ff3d5a', 0, 0], ['#ffd23d', .08, .05], ['#7bd33d', -.06, .07], ['#ff8a3d', .03, -.08], ['#b03dff', -.08, -.03]].forEach(([c, dx, dz]) => add(new T.Mesh(new T.SphereGeometry(.045, 10, 8), M.std(c, { roughness: .35 })), -2.1 + dx, .56, .75 + dz)); }
{ const bk = add(new T.Mesh(box(.32, .04, .44), M.std('#c0392b', { roughness: .6 })), -2.7, .5, .95); bk.rotation.y = .3; const bt = add(new T.Mesh(new T.PlaneGeometry(.26, .36), new T.MeshBasicMaterial({ map: NC.textTex('노래책', 128, 176, '900 34px "Malgun Gothic",sans-serif', '#ffe28a', null, '#7a1010') })), -2.7, .525, .95); bt.rotation.set(-Math.PI / 2, 0, .3); }
// 미러볼 + 반사점
const ball = add(new T.Mesh(new T.IcosahedronGeometry(.24, 2), M.std('#f4f4fa', { metalness: 1, roughness: .04, flatShading: true })), 0, H - .4, .3); ball.material.envMapIntensity = 2.4;
add(new T.Mesh(new T.CylinderGeometry(.006, .006, .3, 4), MT.chrome), 0, H - .15, .3);
const SPK = 140, spDir = [], spPos = new Float32Array(SPK * 3), spCol = new Float32Array(SPK * 3);
for (let i = 0; i < SPK; i++) { const y = -Math.random() * .9 + .25, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - y * y); spDir.push([Math.cos(a) * r, y, Math.sin(a) * r]); const c = new T.Color().setHSL(Math.random(), .6, .7).multiplyScalar(2.5); spCol.set([c.r, c.g, c.b], i * 3); }
const spGeo = new T.BufferGeometry(); spGeo.setAttribute('position', new T.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new T.BufferAttribute(spCol, 3));
G.add(new T.Points(spGeo, new T.PointsMaterial({ size: .13, map: NC.softDot(), vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false })));
// 문(남동쪽) + 동쪽 벽 네온
add(new T.Mesh(box(1.3, 2.3, .08), pbr('tufted', { repeat: [2, 3], color: '#5a1a3a', gen: { leather: true, cells: 3 } })), 3.4, 1.15, HZ - .04);
add(new T.Mesh(box(1.45, .06, .1), MT.gold), 3.4, 2.32, HZ - .05); add(new T.Mesh(new T.SphereGeometry(.03, 8, 6), MT.gold), 2.9, 1.1, HZ - .1);
{ const ex = NC.neonSign('EXIT · 클럽으로', 1.4, .3, { font: '900 90px "Malgun Gothic",sans-serif', color: '#d8ffe0', glow: '#33ff77', ph: 200 }); ex.material.color.setScalar(2); ex.rotation.y = Math.PI; add(ex, 3.4, 2.55, HZ - .07); }
{ const ns = NC.neonSign('추억의 노래방 ★', 3.4, .8, { font: '900 120px "Malgun Gothic",sans-serif', color: '#fff0fa', glow: '#ff3dbb', ph: 256 }); ns.material.color.setScalar(2.4); ns.rotation.y = -Math.PI / 2; add(ns, HX - .07, 2.3, -.6); }
{ const menu = add(new T.Mesh(new T.PlaneGeometry(1.4, .9), new T.MeshBasicMaterial({ map: NC.textTex('🍺 맥주 · 🍉 과일안주 · 🎤 1시간 서비스', 640, 400, '800 34px "Malgun Gothic",sans-serif', '#ffe9b0', '#ff9a3d', '#1a0f24') })), HX - .07, 1.25, 1.6); menu.rotation.y = -Math.PI / 2; }

/* 좌석 · 충돌 · 위치 */
const SEATS = [[-HX + .55, -1.8, Math.PI / 2], [-HX + .55, -.6, Math.PI / 2], [-HX + .55, .6, Math.PI / 2], [-HX + .55, 1.8, Math.PI / 2], [-3.4, HZ - .55, Math.PI], [-2.2, HZ - .55, Math.PI], [-1.0, HZ - .55, Math.PI], [.2, HZ - .55, Math.PI]]
  .map(([x, z, ry]) => ({ x: KX + x, z: KZ + z, ry, h: .45 }));
const occ = SEATS.map(() => null);
const SING = { x: KX, z: KZ - 1.5, ry: Math.PI }, ENTRY = { x: KX + 3.4, z: KZ + 2.9 }, EXIT = { x: KX + 3.4, z: KZ + 3.2 };
const RECTS = [[KX - HX, KZ - 2.45, KX - HX + .9, KZ + 2.65], [KX - HX, KZ + HZ - .9, KX + 1.6, KZ + HZ], [KX - 3.25, KZ + .02, KX - .75, KZ + 1.18], [KX - 2.75, KZ - HZ, KX + 2.75, KZ - HZ + .6]];
W.extraZones.push({ name: 'karaoke', test: (x, z) => x > KX - HX - 1 && x < KX + HX + 1 && Math.abs(z - KZ) < HZ + 1,
  collide(p, r) { W.collideRects(p, r, RECTS); p.x = U.clamp(p.x, KX - HX + r, KX + HX - r); p.z = U.clamp(p.z, KZ - HZ + r, KZ + HZ - r); } });
W.zoneLabel.karaoke = '🎤 2차 노래방';

/* ═════════ 곡 목록 (전곡 자작) ═════════ */
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const SONGS = [
  { no: 19981, title: '밤의 열기', artist: '네온보이즈', genre: '댄스', style: 'dance', bpm: 124, key: 57, scale: 'minor', prog: [0, 5, 6, 0], split: 4,
    lines: ['오늘 밤 조명 아래 너를 봤어', '반짝이는 미러볼 속 너의 미소', '심장이 쿵쿵 베이스처럼 뛰어', '한 걸음 다가가 볼까 망설여', '밤의 열기 속으로 함께 가', '손을 잡고 스테이지로 날아가', '시간이 멈춰 버린 이 순간', '너와 나 오늘 밤의 주인공', '라라라 라라라 밤새 춤을 춰', '라라라 라라라 멈추지 마'] },
  { no: 19982, title: '부킹의 정석', artist: '웨이터 김씨와 친구들', genre: '트로트', style: 'trot', bpm: 132, key: 57, scale: 'minor', prog: [0, 3, 4, 0], split: 4,
    lines: ['웨이터 손에 이끌려 온 자리', '수줍게 웃던 그대 눈빛이', '첫눈에 반해 버린 이 내 마음', '어쩌면 좋아 어쩌면 좋아', '부킹 부킹 사랑의 부킹', '오늘 밤 우리 인연 맺어 봐요', '한 잔 두 잔 건배를 하고', '그대와 나 밤새 웃어 봐요', '얼씨구 좋다 사랑의 부킹', '절씨구 좋다 우리 둘이서'] },
  { no: 19983, title: '마지막 버스', artist: '류하늘', genre: '발라드', style: 'ballad', bpm: 74, key: 60, scale: 'major', prog: [0, 4, 5, 3], split: 4,
    lines: ['마지막 버스가 떠나간 거리', '혼자 남겨진 정류장 불빛', '너의 이름을 불러 보지만', '대답 없는 밤바람만 불어', '사랑했던 날들이 떠올라', '아직 너를 보내지 못했어', '다시 돌아올 수 있다면', '이번엔 너의 손 놓지 않을게'] },
  { no: 19984, title: '질주 1999', artist: '블랙스톰', genre: '록', style: 'rock', bpm: 142, key: 52, scale: 'minor', prog: [0, 5, 2, 6], split: 4,
    lines: ['엔진 소리 가득한 고속도로', '바람을 가르며 달려 나가', '어제의 나는 이제 안녕', '두려움 따윈 뒤로 던져', '달려 달려 끝없는 밤으로', '소리쳐 소리쳐 하늘 높이', '우리의 청춘은 멈추지 않아', '질주 질주 천구백구십구', '달려 달려 끝없는 밤으로', '우리의 청춘은 지금부터야'] },
  { no: 19985, title: '별빛 고백', artist: '소다크림', genre: 'R&B', style: 'rnb', bpm: 94, key: 62, scale: 'major', prog: [3, 4, 2, 5], split: 4,
    lines: ['별빛이 쏟아지는 창가에서', '너에게 보낼 말을 적어 봐', '지웠다 썼다 백 번을 해도', '결국엔 하나뿐인 그 말', '좋아해 이 말이 어려워서', '오늘도 너를 바라만 봐', '용기를 내 볼게 이 밤이 가기 전', '별빛에 실어 너에게 고백해'] },
  { no: 19986, title: '아싸 노래방', artist: '흥부자', genre: '파티', style: 'party', bpm: 128, key: 60, scale: 'major', prog: [0, 4, 5, 3], split: 4,
    lines: ['마이크 잡고 일어나 봐', '탬버린 흔들며 소리 질러', '오늘만큼은 내가 가수', '박수 한 번 크게 쳐 줘요', '아싸 아싸 신나는 노래방', '다 같이 뛰어 하나 둘 셋', '점수는 몰라 그냥 즐겨', '백 점 받으면 한 곡 더', '아싸 아싸 신나는 노래방', '오늘 밤 끝까지 달려 봐'] },
];
const INTRO = 4, GAP = 2, OUTRO = 2;     // 마디
/* 가사 음절 → 멜로디 자동 작곡 */
function compose(song, keyShift = 0) {
  const sc = SCALES[song.scale], r = U.rng(U.hash(song.title)), notes = [], lines = [];
  const deg2midi = d => song.key + keyShift + 12 + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  let bar = INTRO, deg = 2;
  song.lines.forEach((txt, li) => {
    if (li === song.split) bar += GAP;
    const chorus = li >= song.split, syl = [...txt].map((c, i) => ({ c, i })).filter(o => /[가-힣A-Za-z0-9]/.test(o.c)), n = syl.length;
    const start = bar * 16 + (r() < .4 ? 2 : 0), Tot = 28 - (start % 16), last = Math.max(4, Math.min(8, Tot - n * 2 + 2));
    const avail = Tot - last, dur = []; let rem = avail; for (let k = 0; k < n - 1; k++) { const left = n - 1 - k, d = Math.max(1, Math.min(4, Math.round(rem / left + (r() - .5) * (rem / left > 1.6 ? 1.2 : 0)))); dur.push(d); rem -= d; } dur.push(last + rem);
    let st = start; const line = { li, txt, start, end: 0, notes: [] };
    syl.forEach((o, k) => {
      const barIdx = Math.floor(st / 16), chord = song.prog[barIdx % song.prog.length], strong = st % 4 === 0;
      deg += Math.round((r() - .5) * 3.2); const lo = chorus ? 3 : 0, hi = chorus ? 10 : 8; deg = U.clamp(deg, lo, hi);
      if (strong || k === n - 1) { const tones = [chord, chord + 2, chord + 4, chord + 7, chord + 9]; deg = tones.reduce((b, t) => Math.abs(t - deg) < Math.abs(b - deg) ? t : b, tones[0]); }
      if (k === n - 1) deg = chord + (r() < .5 ? 7 : 2) > hi ? chord : chord + (r() < .5 ? 7 : 2);
      const nt = { step: st, dur: dur[k], midi: deg2midi(deg), li, ch: o.i }; notes.push(nt); line.notes.push(nt); st += dur[k];
    });
    line.end = st; lines.push(line); bar += 2;
  });
  const totalBars = bar + OUTRO;
  return { song, notes, lines, totalBars, totalSteps: totalBars * 16, chordAt: step => song.prog[Math.floor(step / 16) % song.prog.length], deg2midi, sc, keyShift };
}

/* ═════════ 반주 신스 ═════════ */
const K = NC.Karaoke = { songs: SONGS, inRoom: false, playing: null, guide: true, keyShift: 0, mic: null, echo: false, best: U.store.get('nc_kara_best', {}), companion: null };
let A = null;     // { C, bus, rev, lead, ... }
function audio() {
  const AC = NC.Audio; if (!AC) return null; if (!AC.ctx) AC.init(); const C = AC.ctx; if (!C) return null;
  if (A && A.C === C) return A;
  const g = v => { const n = C.createGain(); n.gain.value = v; return n; };
  const bus = g(.8), comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; bus.connect(comp); comp.connect(AC.master);
  const rev = C.createConvolver(); rev.buffer = AC.impulse(1.6); const wet = g(.18); rev.connect(wet); wet.connect(bus);
  const lead = g(.0); lead.connect(bus); lead.connect(rev);
  const noise = AC.noise; const dist = C.createWaveShaper(); { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * 4); } dist.curve = c; }
  A = { C, bus, rev, lead, noise, dist, g }; return A;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function env(gn, t, a, peak, d, sus = 0) { gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(peak, t + a); gn.gain.exponentialRampToValueAtTime(Math.max(1e-4, sus || 1e-4), t + a + d); }
function osc(type, f, t, dur, out, vol, a = .005, d) { const C = A.C, o = C.createOscillator(), gn = C.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); env(gn, t, a, vol, d || dur); o.connect(gn); gn.connect(out); o.start(t); o.stop(t + a + (d || dur) + .05); return o; }
function nz(t, dur, out, vol, type, f, q = 1) { const C = A.C, s = C.createBufferSource(), fl = C.createBiquadFilter(), gn = C.createGain(); s.buffer = A.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(gn, t, .002, vol, dur); s.connect(fl); fl.connect(gn); gn.connect(out); s.start(t, Math.random() * .3); s.stop(t + dur + .05); }
const DR = {
  kick(t, v = 1) { const C = A.C, o = C.createOscillator(), gn = C.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); env(gn, t, .002, .9 * v, .32); o.connect(gn); gn.connect(A.bus); o.start(t); o.stop(t + .4); },
  snare(t, v = 1) { nz(t, .16, A.bus, .45 * v, 'highpass', 1400); osc('triangle', 190, t, .1, A.bus, .25 * v); nz(t, .2, A.rev, .2 * v, 'highpass', 2000); },
  clap(t, v = 1) { [0, .012, .026].forEach(d => nz(t + d, .09, A.bus, .32 * v, 'bandpass', 1300, 1.5)); nz(t, .25, A.rev, .2 * v, 'bandpass', 1400); },
  hat(t, v = 1, open) { nz(t, open ? .22 : .045, A.bus, .16 * v, 'highpass', 7500); },
  rim(t, v = 1) { osc('square', 420, t, .03, A.bus, .12 * v); },
  crash(t) { nz(t, 1.4, A.bus, .16, 'highpass', 4500); },
  shaker(t, v = 1) { nz(t, .06, A.bus, .08 * v, 'bandpass', 6000, 2); },
};
function bassNote(t, m, dur, type = 'sawtooth', cut = 700, vol = .32) { const C = A.C, o = C.createOscillator(), f = C.createBiquadFilter(), gn = C.createGain(); o.type = type; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.setValueAtTime(cut * 2.2, t); f.frequency.exponentialRampToValueAtTime(cut, t + .12); env(gn, t, .005, vol, dur * .95, vol * .5); gn.gain.setTargetAtTime(0, t + dur * .9, .03); o.connect(f); f.connect(gn); gn.connect(A.bus); o.start(t); o.stop(t + dur + .2); }
function pad(t, ms, dur, vol = .05, cut = 1800) { const C = A.C, f = C.createBiquadFilter(), gn = C.createGain(); f.type = 'lowpass'; f.frequency.value = cut; gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + .12); gn.gain.setTargetAtTime(0, t + dur - .1, .12); f.connect(gn); gn.connect(A.bus); gn.connect(A.rev);
  ms.forEach(m => [-6, 6].forEach(dt => { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + .6); })); }
function ep(t, ms, dur, vol = .09) { ms.forEach(m => { osc('sine', mtof(m), t, dur, A.bus, vol, .005, dur * 1.4); osc('triangle', mtof(m) * 2, t, .3, A.bus, vol * .25, .003, .35); }); }
function stab(t, ms, dur, vol = .07) { ms.forEach(m => { const C = A.C, o = C.createOscillator(), f = C.createBiquadFilter(), gn = C.createGain(); o.type = 'square'; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.value = 2600; env(gn, t, .004, vol, dur); o.connect(f); f.connect(gn); gn.connect(A.bus); gn.connect(A.rev); o.start(t); o.stop(t + dur + .1); }); }
function power(t, m, dur, vol = .07) { const C = A.C, f = C.createBiquadFilter(), gn = C.createGain(), sh = C.createWaveShaper(); sh.curve = A.dist.curve; f.type = 'lowpass'; f.frequency.value = 2800; env(gn, t, .004, vol, dur * .9, vol * .6); gn.gain.setTargetAtTime(0, t + dur * .85, .02);
  [m, m + 7, m + 12].forEach(n => { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.connect(sh); o.start(t); o.stop(t + dur + .1); }); sh.connect(f); f.connect(gn); gn.connect(A.bus); }
function leadNote(t, m, dur, vol, voice) { const C = A.C, o = C.createOscillator(), o2 = C.createOscillator(), lfo = C.createOscillator(), lg = C.createGain(), gn = C.createGain(), f = C.createBiquadFilter();
  o.type = voice ? 'sawtooth' : 'triangle'; o2.type = 'square'; o.frequency.value = o2.frequency.value = mtof(m); o2.detune.value = 5; lfo.frequency.value = 5.5; lg.gain.value = 0; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(m) * .012, t + Math.min(.4, dur * .6));
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency); f.type = voice ? 'bandpass' : 'lowpass'; f.frequency.value = voice ? 1100 : 2400; f.Q.value = voice ? 1.2 : .7;
  const g2 = C.createGain(); g2.gain.value = voice ? .5 : .25; o2.connect(g2); g2.connect(f); o.connect(f); f.connect(gn); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + .025); gn.gain.setValueAtTime(vol, t + Math.max(.03, dur - .06)); gn.gain.linearRampToValueAtTime(0, t + dur); gn.connect(A.lead);
  [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + .05); }); }
const triad = (cmp, d) => [d, d + 2, d + 4].map(x => cmp.deg2midi(x) - 12);
const STYLE = {
  dance(t, s, cmp, sd) { const b = s % 16, root = cmp.deg2midi(cmp.chordAt(s)) - 24; if (b % 4 === 0) DR.kick(t); if (b % 8 === 4) DR.clap(t); if (b % 4 === 2) DR.hat(t, 1, true); else DR.hat(t, .5);
    if (b % 2 === 0) bassNote(t, root + (b % 4 === 2 ? 12 : 0), sd * 1.8, 'sawtooth', 600); if (b === 0) pad(t, triad(cmp, cmp.chordAt(s)), sd * 16, .045); if (b % 8 === 6) stab(t, triad(cmp, cmp.chordAt(s)).map(m => m + 12), sd * 1.5, .05); },
  party(t, s, cmp, sd) { STYLE.dance(t, s, cmp, sd); if (s % 16 === 0 && Math.floor(s / 16) % 4 === 0) DR.crash(t); if (s % 2 === 1) DR.shaker(t); },
  trot(t, s, cmp, sd) { const b = s % 16, ch = cmp.chordAt(s), root = cmp.deg2midi(ch) - 24; if (b % 8 === 0) { DR.kick(t); bassNote(t, root, sd * 3, 'triangle', 900, .4); } if (b % 8 === 4) { DR.snare(t, .8); stab(t, triad(cmp, ch), sd * 1.2, .06); bassNote(t, root + 7, sd * 3, 'triangle', 900, .34); }
    if (b % 2 === 0) DR.hat(t, .6); if (b % 8 === 6) stab(t, triad(cmp, ch), sd, .045); if (b === 0) pad(t, triad(cmp, ch).map(m => m + 12), sd * 16, .025, 2400); },
  ballad(t, s, cmp, sd) { const b = s % 16, ch = cmp.chordAt(s), tr = triad(cmp, ch), root = cmp.deg2midi(ch) - 24; if (b === 0) { DR.kick(t, .55); bassNote(t, root, sd * 15, 'sine', 400, .4); pad(t, tr, sd * 16, .03, 1200); } if (b === 8) DR.rim(t, .8); if (b === 10) DR.kick(t, .35);
    if (b % 2 === 0) { const arp = [tr[0], tr[1], tr[2], tr[1] + 12, tr[2], tr[1], tr[0] + 12, tr[2]][b / 2]; ep(t, [arp + 12], sd * 2.5, .07); } if (b % 4 === 2) DR.hat(t, .25); },
  rock(t, s, cmp, sd) { const b = s % 16, ch = cmp.chordAt(s), root = cmp.deg2midi(ch) - 24; if (b === 0 || b === 6 || b === 10) DR.kick(t); if (b % 8 === 4) DR.snare(t, 1.1); if (b % 2 === 0) DR.hat(t, .7, b % 4 === 2); if (b === 0 && Math.floor(s / 16) % 2 === 0) DR.crash(t);
    if (b % 2 === 0) { bassNote(t, root, sd * 1.9, 'square', 500, .26); power(t, root + 12, sd * 1.9, .06); } },
  rnb(t, s, cmp, sd) { const b = s % 16, ch = cmp.chordAt(s), tr = triad(cmp, ch), root = cmp.deg2midi(ch) - 24; if (b === 0 || b === 7 || b === 10) DR.kick(t, .8); if (b % 8 === 4) DR.snare(t, .7); DR.hat(t, b % 2 ? .25 : .4);
    if (b === 0 || b === 6) ep(t, [...tr, tr[0] + 11], sd * 5, .05); if (b === 0 || b === 10) bassNote(t, root, sd * (b ? 6 : 9), 'sine', 500, .45); },
};

/* ═════════ 재생 · 채점 ═════════ */
let timer = null;
function play(song, singer = 'me') {
  const AU = audio(); if (!AU) return NC.ui.toast('오디오를 시작할 수 없어요');
  stop(true);
  const cmp = compose(song, K.keyShift), sd = 60 / song.bpm / 4, t0 = AU.C.currentTime + .35;
  const st = K.playing = { song, cmp, sd, t0, next: 0, singer, ticks: 0, voiced: 0, hit: 0, taps: [], goodTaps: 0, beats: 0, cheer: 0, detected: -1, done: false };
  AU.lead.gain.setTargetAtTime(singer === 'me' ? (K.guide ? .55 : 0) : .9, AU.C.currentTime, .05);
  timer = setInterval(() => {
    const now = AU.C.currentTime;
    while (st.next < st.cmp.totalSteps && st.t0 + st.next * sd < now + .18) {
      const s = st.next, t = Math.max(now, st.t0 + s * sd);
      STYLE[song.style](t, s, cmp, sd);
      if (s < 16 && s % 4 === 0) DR.rim(t, .6);                                   // 카운트인
      cmp.notes.forEach(n => { if (n.step === s) leadNote(t, n.midi, n.dur * sd * .98, .22, singer !== 'me'); });
      st.next++;
    }
    if (now > st.t0 + cmp.totalSteps * sd + .3) finish();
  }, 25);
  if (singer === 'me') {
    const P = NC.player; if (P.seat) NC.requestStand();
    singPose(P.group, true); P.busy = true; P.target = null; P.autoPath = null;
    NC.ui.fade(() => { P.x = SING.x; P.z = SING.z; P.ry = SING.ry; P.group.position.set(P.x, 0, P.z); P.group.rotation.y = P.ry; });
    if (K.companion) NC.Motion.play(K.companion.g, 'cheer');
  }
  lyricEl.style.display = 'block'; panelState(); NC.emit('karaoke:start', song, singer);
}
function stop(silent) {
  if (timer) clearInterval(timer); timer = null; const st = K.playing; K.playing = null;
  if (A) A.lead.gain.setTargetAtTime(0, A.C.currentTime, .02);
  if (st) { if (st.singer === 'me') { singPose(NC.player.group, false); NC.player.busy = false; } else if (K.companion) { singPose(K.companion.g, false); seatCompanion(); } }
  lyricEl.style.display = 'none'; if (!silent) screen.mode = 'menu'; panelState();
}
function finish() {
  const st = K.playing; if (!st || st.done) return; st.done = true; let score, how;
  if (st.singer !== 'me') { const n = K.companion; score = Math.round(U.clamp(74 + Math.random() * 22 + (n && n.trait === 'outgoing' ? 4 : 0), 60, 100)); how = 'npc'; }
  else if (K.mic && st.ticks > 20) { const acc = st.hit / st.ticks, pres = st.voiced / st.ticks; score = Math.round(U.clamp(52 + 48 * (.35 * Math.min(1, pres * 1.2) + .65 * Math.min(1, acc * 1.35)), 0, 100)); how = 'mic'; }
  else if (st.taps.length >= 6) { const exp = Math.max(8, st.beats * .5); score = Math.round(U.clamp(60 + 40 * Math.min(1, st.goodTaps / exp), 0, 100)); how = 'tap'; }
  else { score = 70 + Math.floor(Math.random() * 31); how = 'machine'; }
  stop(true); showScore(score, st, how);
}
function showScore(score, st, how) {
  screen.mode = 'score'; screen.score = { v: score, t0: performance.now(), song: st.song, how, singer: st.singer };
  if (score >= 90 && NC.fx) setTimeout(() => { NC.fx.confetti(KX, H - .3, KZ - 1.2, 90); NC.fx.confetti(KX - 2, H - .3, KZ + 1, 60); }, 1150);
  const AU = audio(); if (AU) { const t = AU.C.currentTime; for (let i = 0; i < 16; i++) DR.snare(t + i * .07, .4 + i * .03); setTimeout(() => { const t2 = AU.C.currentTime; (score >= 90 ? [72, 76, 79, 84] : [67, 72, 76]).forEach((m, i) => leadNote(t2 + i * .16, m, .5 + (i === 3 ? .6 : 0), .3, false)); AU.lead.gain.setTargetAtTime(.6, t2, .02); setTimeout(() => AU.lead.gain.setTargetAtTime(0, AU.C.currentTime, .1), 1600); }, 1150); }
  setTimeout(() => {
    const n = K.companion, me = st.singer === 'me';
    if (me) { const key = st.song.no; if (!K.best[key] || score > K.best[key]) { K.best[key] = score; U.store.set('nc_kara_best', K.best); }
      NC.Wallet.add(score >= 100 ? 30 : score >= 90 ? 15 : score >= 80 ? 8 : 3, `노래방 ${score}점`); NC.Motion.trigger(NC.player.group, score >= 85 ? 'game:win' : 'social:greet', { silent: true }); }
    if (n) {
      let d, line;
      if (me) { d = score >= 95 ? 6 : score >= 85 ? 4 : score >= 70 ? 2 : 1; line = score >= 95 ? `와… ${score}점?! 진짜 가수 아니에요? 완전 반했어요 😳` : score >= 85 ? `${score}점! 목소리 진짜 좋다~ 한 곡 더 해요!` : score >= 70 ? `ㅋㅋ ${score}점! 분위기 최고였어요!` : `점수가 뭐가 중요해요 ㅋㅋ 흥은 100점!`; NC.Motion.trigger(n.g, score >= 85 ? 'game:win' : 'talk:joke', { silent: true }); }
      else { const cheer = st.cheer; d = cheer >= 12 ? 5 : cheer >= 5 ? 3 : 1; line = cheer >= 12 ? `호응 해 줘서 너무 신났어요!! ${score}점 받은 거 다 그쪽 덕분 💗` : cheer >= 5 ? `${score}점! 탬버린 쳐 줘서 고마워요 ㅎㅎ` : `${score}점… 호응 좀 해 주지 ㅋㅋ 다음엔 탬버린 부탁해요!`; }
      n.aff = U.clamp(n.aff + d, 0, 100); n.g.userData.say(2.4); NC.ui.chatAdd(n.name, line); NC.ui.toast(`💗 ${n.name} 호감도 +${d} (${n.aff})`); if (NC.speakNpc) NC.speakNpc(n, line);
    }
  }, 2600);
  setTimeout(() => { if (screen.mode === 'score') screen.mode = 'menu'; }, 7000);
}
function tap() {
  const st = K.playing; if (!NC.player.seat) NC.Motion.play(NC.player.group, 'clap');
  const AU = audio(); if (!AU) return; const t = AU.C.currentTime; nz(t, .12, AU.bus, .22, 'highpass', 6000); [0, .03].forEach(d => nz(t + d, .08, AU.bus, .12, 'bandpass', 8000, 3));
  if (!st) return; const beatLen = st.sd * 4, pos = (t - st.t0) / beatLen, err = Math.abs(pos - Math.round(pos)) * beatLen;
  st.taps.push(t); if (err < .1) { st.goodTaps++; if (st.singer !== 'me') st.cheer++; }
}
// 마이크
K.toggleMic = async () => {
  if (K.mic) { K.mic.stream.getTracks().forEach(t => t.stop()); K.mic = null; panelState(); return; }
  const AU = audio(); if (!AU) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    const src = AU.C.createMediaStreamSource(stream), an = AU.C.createAnalyser(); an.fftSize = 2048; src.connect(an);
    const dl = AU.C.createDelay(1), fb = AU.g(.32), eg = AU.g(0); dl.delayTime.value = .13; src.connect(eg); eg.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(AU.bus); eg.connect(AU.rev);
    K.mic = { stream, an, buf: new Float32Array(2048), echoGain: eg }; eg.gain.value = K.echo ? .7 : 0;
    NC.ui.toast('🎙 마이크 채점 켜짐 — 이어폰을 쓰면 반주가 덜 섞여 더 정확해요');
  } catch (e) { NC.ui.toast('마이크를 쓸 수 없어요 · 탬버린(Space) 박자 채점으로 진행합니다'); }
  panelState();
};
function detectPitch(buf, sr) {
  const N = 1024; let rms = 0; for (let i = 0; i < N; i++) rms += buf[i] * buf[i]; rms = Math.sqrt(rms / N); if (rms < .012) return -1;
  const c = new Float32Array(N / 2); for (let lag = 0; lag < N / 2; lag++) { let s = 0; for (let i = 0; i < N / 2; i++) s += buf[i] * buf[i + lag]; c[lag] = s; }
  let d = 0; while (d < N / 2 - 1 && c[d] > c[d + 1]) d++; let mv = -1, mp = -1; for (let i = d; i < N / 2; i++) if (c[i] > mv) { mv = c[i]; mp = i; }
  if (mp <= 0 || mv < c[0] * .3) return -1; const x1 = c[mp - 1] || 0, x2 = c[mp], x3 = c[mp + 1] || 0, a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2; const T0 = a ? mp - b / (2 * a) : mp;
  return sr / T0;
}
let micT = 0;
function scoreTick(dt) {
  const st = K.playing; if (!st || !A) return; const now = A.C.currentTime, pos = (now - st.t0) / st.sd;
  st.beats = Math.max(0, Math.floor(pos / 4) - INTRO);
  const cur = st.cmp.notes.find(n => pos >= n.step && pos < n.step + n.dur);
  // 노래하는 사람 입 모양
  const singerG = st.singer === 'me' ? NC.player.group : K.companion && K.companion.g;
  if (cur && singerG) singerG.userData.talkUntil = performance.now() + 120;
  if (!K.mic || st.singer !== 'me') return; micT += dt; if (micT < .05) return; micT = 0;
  K.mic.an.getFloatTimeDomainData(K.mic.buf); const f = detectPitch(K.mic.buf, A.C.sampleRate); st.detected = f > 70 && f < 1100 ? 69 + 12 * Math.log2(f / 440) : -1;
  if (cur) { st.ticks++; if (st.detected > 0) { st.voiced++; let d = ((st.detected - cur.midi) % 12 + 18) % 12 - 6; d = Math.abs(d); st.hit += d <= 1 ? 1 : d <= 2 ? .5 : 0; } }
}
function singPose(g, on) { const u = g.userData; u.dance = on ? 'sing' : null; u.hideLabel = on; if (!u.mic) { u.mic = micMesh(); u.mic.position.set(0, -.08, .03); u.mic.rotation.x = -.4; (u.glass ? u.glass.parent : g).add(u.mic); } u.mic.visible = on; tableMics[g === NC.player.group ? 0 : 1].visible = !on; }

/* ═════════ TV 화면 ═════════ */
const screen = K.screen = { mode: 'menu', sel: 0, score: null };
function lyricsDraw(g, w, h, st, pos) {
  const L = st.cmp.lines; let cur = L.findIndex(l => pos < l.end + 2); if (cur < 0) cur = L.length - 1;
  const fs = Math.round(h * .3); g.font = `900 ${fs}px "Malgun Gothic","Apple SD Gothic Neo",sans-serif`; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const slots = [[w * .06, h * .3, 'left'], [w * .94, h * .74, 'right']];
  [cur, cur + 1].forEach(li => { const ln = L[li]; if (!ln) return; const [x0, y, al] = slots[li % 2], tw = g.measureText(ln.txt).width, x = al === 'left' ? x0 : x0 - tw;
    g.lineWidth = fs * .16; g.strokeStyle = 'rgba(10,6,20,.95)'; g.strokeText(ln.txt, x, y); g.fillStyle = '#ffffff'; g.fillText(ln.txt, x, y);
    // 음절 와이프
    let px = 0; const nts = ln.notes; let k = nts.findIndex(n => pos < n.step + n.dur);
    if (pos >= ln.end) px = tw; else if (k >= 0 && pos >= nts[0].step) { const n = nts[k], f = U.clamp((pos - n.step) / n.dur, 0, 1); const a = g.measureText(ln.txt.slice(0, n.ch)).width, b = g.measureText(ln.txt.slice(0, n.ch + 1)).width; px = a + (b - a) * f; }
    if (px > 0) { g.save(); g.beginPath(); g.rect(x - fs * .1, y - fs, px + fs * .1, fs * 2); g.clip(); g.strokeStyle = '#fff'; g.lineWidth = fs * .16; g.strokeText(ln.txt, x, y); const gr = g.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); gr.addColorStop(0, '#46e0ff'); gr.addColorStop(1, '#3a5bff'); g.fillStyle = li === cur && st.singer !== 'me' ? '#ff4fa8' : gr; g.fillText(ln.txt, x, y); g.restore(); }
    // 카운트 점
    if (li === cur && pos < ln.start && ln.start - pos < 16) { const dots = Math.ceil((ln.start - pos) / 4); g.fillStyle = '#ff4fa8'; for (let d = 0; d < dots; d++) { g.beginPath(); g.arc(x + d * fs * .5 + fs * .2, y - fs * .85, fs * .14, 0, 7); g.fill(); } }
  });
}
function drawScreen(t) {
  const g = sg, w = 1024, h = 576, st = K.playing; g.setTransform(1, 0, 0, 1, 0, 0);
  const hue = (t * 12) % 360, style = st ? st.song.style : 'idle';
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, `hsl(${hue},55%,${style === 'ballad' ? 10 : 14}%)`); bg.addColorStop(1, `hsl(${(hue + 70) % 360},60%,${style === 'ballad' ? 6 : 9}%)`); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // 배경 영상(장르별)
  g.globalCompositeOperation = 'lighter';
  if (style === 'dance' || style === 'party' || style === 'idle') { g.strokeStyle = `hsla(${(hue + 180) % 360},90%,60%,.35)`; g.lineWidth = 2; for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(w / 2 + i * 12, h * .45); g.lineTo(w / 2 + i * 110, h); g.stroke(); } for (let j = 0; j < 10; j++) { const y = h * .45 + Math.pow((j + (t * 2) % 1) / 10, 2) * h * .55; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i < 26; i++) { const bw = 30 + (i * 37) % 50, bh = 60 + (i * 53) % 140; g.fillRect(i * 40, h * .45 - bh, bw, bh); } }
  if (style === 'ballad' || style === 'rnb') { for (let i = 0; i < 40; i++) { const x = (i * 263 + t * (10 + i % 5) * 4) % w, y = (i * 151 + Math.sin(t * .3 + i) * 40) % h, r = 10 + (i * 7) % 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `hsla(${(hue + i * 9) % 360},80%,70%,.25)`); gr.addColorStop(1, 'hsla(0,0%,0%,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }
  if (style === 'trot') { g.save(); g.translate(w / 2, h * .42); g.rotate(t * .3); for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.fillStyle = i % 2 ? 'rgba(255,200,60,.16)' : 'rgba(255,80,120,.12)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(900, -110); g.lineTo(900, 110); g.fill(); } g.restore(); }
  if (style === 'rock') { for (let i = 0; i < 60; i++) { const y = (i * 97) % h, x = (i * 331 - t * 900) % (w + 300); g.fillStyle = `rgba(255,${80 + i % 100},40,.25)`; g.fillRect((x + w + 300) % (w + 300) - 300, y, 260, 2); } }
  if (style === 'party') { for (let i = 0; i < 70; i++) { const x = (i * 131) % w, y = (i * 71 + t * (60 + i % 40)) % h; g.fillStyle = `hsla(${i * 37 % 360},90%,60%,.7)`; g.save(); g.translate(x, y); g.rotate(t * 3 + i); g.fillRect(-5, -2, 10, 4); g.restore(); } }
  g.globalCompositeOperation = 'source-over';
  if (screen.mode === 'score' && screen.score) {
    const s = screen.score, k = U.clamp((performance.now() - s.t0) / 1100, 0, 1), v = Math.round(s.v * (k < 1 ? Math.min(.98, k) : 1));
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 54px "Malgun Gothic",sans-serif'; g.fillStyle = '#ffe28a'; g.fillText(s.singer === 'me' ? '당신의 점수는' : `${K.companion ? K.companion.name : 'NPC'}님의 점수는`, w / 2, 120);
    g.font = '900 230px Arial'; g.lineWidth = 14; g.strokeStyle = '#2a0a3a'; g.strokeText(v, w / 2, 300); const gr = g.createLinearGradient(0, 200, 0, 400); gr.addColorStop(0, '#fff6a0'); gr.addColorStop(1, '#ff4fa8'); g.fillStyle = gr; g.fillText(v, w / 2, 300);
    if (k >= 1) { g.font = '900 46px "Malgun Gothic",sans-serif'; g.fillStyle = '#fff'; g.fillText(s.v >= 100 ? '🎉 축하합니다! 100점! 한 곡 더 서비스~' : s.v >= 90 ? '가수 데뷔하셔도 되겠어요!' : s.v >= 80 ? '노래 실력이 수준급이에요 👏' : s.v >= 70 ? '분위기 메이커 인정!' : '흥은 100점! 다시 도전~', w / 2, 470);
      g.font = '700 24px "Malgun Gothic",sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText({ mic: '🎙 마이크 음정 채점', tap: '🪘 탬버린 박자 채점', machine: '🎲 기계 채점 (마이크·탬버린 없이)', npc: '🎤 NPC 열창' }[s.how], w / 2, 530); }
  } else if (st) {
    const pos = (A.C.currentTime - st.t0) / st.sd;
    g.textAlign = 'left'; g.font = '800 26px "Malgun Gothic",sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(`${st.song.no}  ${st.song.title} - ${st.song.artist}`, 24, 40);
    g.textAlign = 'right'; g.fillText(st.singer === 'me' ? (K.mic ? '🎙 MIC 채점' : '🪘 탬버린 채점') : `🎤 ${K.companion ? K.companion.name : ''} 열창 중`, w - 24, 40);
    if (pos < INTRO * 16) { g.textAlign = 'center'; const a = U.clamp(1 - (pos - 40) / 20, 0, 1); g.globalAlpha = a; g.font = '900 96px "Malgun Gothic",sans-serif'; g.fillStyle = '#fff'; g.fillText(st.song.title, w / 2, 220); g.font = '800 40px "Malgun Gothic",sans-serif'; g.fillStyle = '#ffd6f0'; g.fillText(`노래 ${st.song.artist}`, w / 2, 300); g.font = '600 26px "Malgun Gothic",sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(`${st.song.genre} · ${st.song.bpm} BPM · 작사/작곡 추억의나이트`, w / 2, 350); g.globalAlpha = 1; }
    // 음정 가이드 바
    if (st.singer === 'me' && K.mic) { const y0 = 70, hh = 110, lo = Math.min(...st.cmp.notes.map(n => n.midi)) - 3, hi = Math.max(...st.cmp.notes.map(n => n.midi)) + 3, Y = m => y0 + hh - (m - lo) / (hi - lo) * hh, X = s => 200 + (s - pos) * 14;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y0, w, hh); st.cmp.notes.forEach(n => { const x = X(n.step); if (x > w || x + n.dur * 14 < 0) return; g.fillStyle = pos >= n.step && pos < n.step + n.dur ? '#ffe03d' : 'rgba(120,200,255,.8)'; g.fillRect(x, Y(n.midi) - 5, n.dur * 14 - 2, 10); });
      g.fillStyle = '#fff'; g.fillRect(199, y0, 2, hh); if (st.detected > 0) { let m = st.detected; while (m < lo) m += 12; while (m > hi) m -= 12; g.fillStyle = '#ff4fa8'; g.beginPath(); g.arc(200, Y(m), 9, 0, 7); g.fill(); } }
    g.save(); g.translate(0, h * .58); lyricsDraw(g, w, h * .4, st, pos); g.restore();
  } else {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 80px "Malgun Gothic",sans-serif'; g.fillStyle = '#fff'; g.shadowColor = '#ff3dbb'; g.shadowBlur = 30; g.fillText('추억의 노래방', w / 2, 90); g.shadowBlur = 0;
    g.font = '700 26px "Malgun Gothic",sans-serif'; g.fillStyle = '#ffd6f0'; g.fillText('🎵 노래 고르기 버튼을 눌러 곡을 선택하세요', w / 2, 150);
    SONGS.forEach((s, i) => { const y = 205 + i * 56, on = i === screen.sel; g.fillStyle = on ? 'rgba(255,79,168,.45)' : 'rgba(0,0,0,.35)'; g.fillRect(110, y - 24, w - 220, 48);
      g.textAlign = 'left'; g.font = '800 28px "Malgun Gothic",sans-serif'; g.fillStyle = '#ffe28a'; g.fillText(s.no, 130, y); g.fillStyle = '#fff'; g.fillText(s.title, 260, y); g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 24px "Malgun Gothic",sans-serif'; g.fillText(s.artist, 520, y);
      g.textAlign = 'right'; g.fillText(`${s.genre}${K.best[s.no] ? ' · 최고 ' + K.best[s.no] + '점' : ''}`, w - 130, y); });
  }
  scrTex.needsUpdate = true;
  // 노래방 기계 7세그먼트
  const s2 = segCv.getContext('2d'); s2.fillStyle = '#100404'; s2.fillRect(0, 0, 256, 64); s2.font = '700 44px "Courier New",monospace'; s2.textAlign = 'center'; s2.textBaseline = 'middle'; s2.fillStyle = '#ff3a2a'; s2.shadowColor = '#ff3a2a'; s2.shadowBlur = 12;
  s2.fillText(st ? String(st.song.no) : (screen.mode === 'score' && screen.score ? String(screen.score.v).padStart(5, ' ') : '- - - -'), 128, 34); s2.shadowBlur = 0; segTex.needsUpdate = true;
}

/* ═════════ DOM: 패널 · 가사 오버레이 ═════════ */
const panel = document.createElement('div'); panel.id = 'kara'; panel.style.display = 'none';
panel.innerHTML = `<div class="kh"><b>🎤 추억의 노래방</b><span id="kSt"></span><button id="kClose" title="닫기">✕</button></div>
  <div id="kList"></div>
  <div class="krow"><button id="kStop">⏹ 취소</button><button id="kGuide">🎼 가이드</button><button id="kMic">🎙 마이크 채점</button><button id="kEcho">🔊 에코</button>
  <button id="kKeyD">♭</button><span id="kKey">키 0</span><button id="kKeyU">♯</button><button id="kTap">🪘 탬버린 (Space)</button><button id="kNpc" style="display:none"></button></div>`;
document.body.appendChild(panel);
const bar = document.createElement('div'); bar.id = 'karaBar'; bar.style.display = 'none'; bar.innerHTML = '<button id="kOpen">🎵 노래 고르기</button><button id="kTap2">🪘 탬버린</button><button id="kStop2">⏹</button>'; document.body.appendChild(bar);
const lyricEl = document.createElement('canvas'); lyricEl.id = 'karaLyrics'; lyricEl.width = 1400; lyricEl.height = 220; lyricEl.style.display = 'none'; document.body.appendChild(lyricEl);
const lg = lyricEl.getContext('2d');
function renderList() {
  const el = $('#kList'); el.innerHTML = '';
  SONGS.forEach((s, i) => { const b = document.createElement('button'); b.className = 'ksong'; b.innerHTML = `<span class="kn">${s.no}</span><span class="kt">${s.title}</span><span class="ka">${s.artist}</span><span class="kg">${s.genre} · ${s.bpm}${K.best[s.no] ? ` · 🏆${K.best[s.no]}` : ''}</span>`;
    b.onmouseenter = () => { screen.sel = i; }; b.onclick = () => { screen.sel = i; panel.style.display = 'none'; play(s, 'me'); }; el.appendChild(b); });
}
function panelState() {
  $('#kGuide').classList.toggle('on', K.guide); $('#kMic').classList.toggle('on', !!K.mic); $('#kEcho').classList.toggle('on', K.echo); $('#kKey').textContent = '키 ' + (K.keyShift > 0 ? '+' : '') + K.keyShift;
  $('#kSt').textContent = K.playing ? `♪ ${K.playing.song.title}` : '';
  const n = K.companion, nb = $('#kNpc'); nb.style.display = n ? '' : 'none'; if (n) nb.textContent = `🎤 ${n.name}에게 한 곡 부탁`;
  $('#kStop2').style.display = K.playing ? '' : 'none';
}
$('#kClose').onclick = () => { panel.style.display = 'none'; };
$('#kOpen').onclick = () => { renderList(); panelState(); panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'; };
$('#kStop').onclick = $('#kStop2').onclick = () => stop();
$('#kGuide').onclick = () => { K.guide = !K.guide; if (K.playing && K.playing.singer === 'me' && A) A.lead.gain.setTargetAtTime(K.guide ? .55 : 0, A.C.currentTime, .05); panelState(); };
$('#kMic').onclick = () => K.toggleMic();
$('#kEcho').onclick = () => { K.echo = !K.echo; if (K.mic) K.mic.echoGain.gain.value = K.echo ? .7 : 0; if (K.echo && !K.mic) NC.ui.toast('에코는 마이크를 켜야 들려요'); panelState(); };
$('#kKeyD').onclick = () => { K.keyShift = Math.max(-6, K.keyShift - 1); panelState(); };
$('#kKeyU').onclick = () => { K.keyShift = Math.min(6, K.keyShift + 1); panelState(); };
$('#kTap').onclick = $('#kTap2').onclick = () => tap();
$('#kNpc').onclick = () => { panel.style.display = 'none'; npcSing(); };
addEventListener('keydown', e => { if (!K.inRoom || NC.ui.typing()) return; if (e.code === 'Space') { tap(); e.preventDefault(); } if (e.key === 'Escape') { if (K.playing) stop(); else panel.style.display = 'none'; } });

/* ═════════ 동반 NPC ═════════ */
function seatCompanion() { const n = K.companion; if (!n) return; let i = occ.findIndex((o, k) => !o && k >= 1); if (i < 0) i = 2; occ.forEach((o, k) => { if (o === n) occ[k] = null; }); occ[i] = n; const s = SEATS[i]; n.x = s.x; n.z = s.z; NC.NPC.sit(n, s.x, s.z, s.ry, s.h); n.g.visible = true; n.g.userData.lookAt = NC.player.group.position; }
function npcSing() {
  const n = K.companion; if (!n) return; if (K.playing) stop(true);
  const pick = n.trait === 'shy' ? SONGS[2] : n.trait === 'cool' ? SONGS[4] : n.trait === 'playful' ? SONGS[5] : U.pick([SONGS[0], SONGS[1], SONGS[3]]);
  occ.forEach((o, k) => { if (o === n) occ[k] = null; }); NC.unseatAvatar(n.g, SING.x, SING.z); n.state = 'karaoke'; n.x = SING.x; n.z = SING.z; n.g.rotation.y = SING.ry; n.g.userData.lookAt = null;
  singPose(n.g, true); NC.ui.chatAdd(n.name, U.pick(['그럼 제 18번 갑니다~ 탬버린 부탁해요!', '헉 저요? …알겠어요, 웃지 마요 ㅎㅎ', '좋아요! 호응 안 하면 삐질 거예요 ㅋㅋ']));
  play(pick, 'npc');
}
function inviteCompanion() {
  const cand = (NC.NPC ? NC.NPC.personas() : []).filter(n => n.enabled && n.aff >= 55 && n.state !== 'off').sort((a, b) => b.aff - a.aff)[0];
  if (!cand) return Promise.resolve(null);
  return NC.ui.modal(`<h3>💗 ${U.esc(cand.name)}님 (호감도 ${cand.aff})</h3><p>"2차로 노래방 같이 갈래요?" 라고 물어볼까요?</p>`, [['같이 가자고 하기', 'yes', true], ['혼자 갈래요', 'no']]).then(({ val }) => {
    if (val !== 'yes') return null;
    const ok = cand.aff >= 70 || Math.random() < .7;
    if (!ok) { cand.aff = Math.max(0, cand.aff - 2); NC.ui.chatAdd(cand.name, '음… 오늘은 여기까지만 놀래요. 다음에 꼭 가요!'); NC.ui.toast(`${cand.name}님이 정중히 거절했어요 (호감도 -2)`); return null; }
    NC.ui.chatAdd(cand.name, U.pick(['노래방이요? 완전 좋아요!! 마이크 제가 먼저 잡을래요 🎤', '좋아요~ 제 18번 들려 드릴게요 ㅎㅎ', '…가요. 근데 저 노래 시키면 안 돼요? 농담이에요 ㅋㅋ'])); return cand;
  });
}
if (NC.VIP && NC.VIP.endSession) { const orig = NC.VIP.endSession.bind(NC.VIP); NC.VIP.endSession = (n, reason) => { if (n && n.karaoke) { if (NC.player.seat) NC.requestStand(); return; } orig(n, reason); }; }

/* ═════════ 입장 · 퇴장 ═════════ */
const hidden = []; const saved = {};
function borrowLights(on) {
  const L = W.lights || {};
  const plan = { bar: [-3, 2.7, -1, '#ff3dbb', 1.6, 9], corridor: [3, 2.7, 1.2, '#3de6ff', 1.4, 9], kdoor: [0, 1.6, -2.9, '#8fb4ff', 1.1, 7] };
  Object.entries(plan).forEach(([k, [x, y, z, c, i, d]]) => { const l = L[k]; if (!l) return; if (on) { saved[k] = { p: l.position.clone(), c: l.color.clone(), i: l.intensity, d: l.distance }; l.position.set(KX + x, y, KZ + z); l.color.copy(col(c)); l.intensity = i; l.distance = d; } else if (saved[k]) { l.position.copy(saved[k].p); l.color.copy(saved[k].c); l.intensity = saved[k].i; l.distance = saved[k].d; } });
  if (L.key) { if (on) { saved.key = { p: L.key.position.clone(), t: L.key.target.position.clone(), i: L.key.intensity, a: L.key.angle, d: L.key.distance, n: L.key.shadow.camera.near }; L.key.position.set(KX + .5, H - .05, KZ + 1); L.key.target.position.set(KX - .5, 0, KZ - .5); L.key.intensity = .9; L.key.angle = 1.25; L.key.distance = 9; L.key.shadow.camera.near = .2; }
    else if (saved.key) { const s = saved.key; L.key.position.copy(s.p); L.key.target.position.copy(s.t); L.key.intensity = s.i; L.key.angle = s.a; L.key.distance = s.d; L.key.shadow.camera.near = s.n; } L.key.shadow.camera.updateProjectionMatrix(); }
  if (L.ball) { if (on) { saved.ball = { p: L.ball.position.clone(), t: L.ball.target, i: L.ball.intensity, d: L.ball.distance }; L.ball.position.set(KX + 2, H - .1, KZ + 2.5); L.ball.target = ball; L.ball.intensity = 1.8; L.ball.distance = 8; } else if (saved.ball) { L.ball.position.copy(saved.ball.p); L.ball.target = saved.ball.t; L.ball.intensity = saved.ball.i; L.ball.distance = saved.ball.d; } }
}
function setClubVisible(on) {
  if (!on) { hidden.length = 0; S.children.forEach(o => { if (o === G || o.isLight || o === NC.player.group || (K.companion && o === K.companion.g) || !o.visible) return; if (o.userData && o.userData.remote) return; hidden.push(o); o.visible = false; }); }
  else { hidden.forEach(o => { o.visible = true; }); hidden.length = 0; }
}
async function enter() {
  const P = NC.player; if (P.busy) return;
  if (NC.Dialog && NC.Dialog.cur) NC.Dialog.close('bye');
  const comp = await inviteCompanion();
  NC.ui.fade(() => {
    if (P.seat) NC.requestStand();
    P.x = ENTRY.x; P.z = ENTRY.z; P.ry = Math.PI * 1.15; P.target = null; P.autoPath = null; P.group.position.set(P.x, 0, P.z); P.group.rotation.y = P.ry;
    K.companion = comp; if (comp) { comp.karaoke = true; comp.booked = true; seatCompanion(); }
    G.visible = true; setClubVisible(false); borrowLights(true); K.inRoom = true; bar.style.display = 'flex'; screen.mode = 'menu';
    NC.ui.toast('🎤 2차 노래방에 오신 걸 환영해요! 「🎵 노래 고르기」로 곡을 골라 보세요'); panelState();
  });
}
function leave() {
  const P = NC.player; stop(true);
  NC.ui.fade(() => {
    if (P.seat) NC.requestStand();
    const d = W.spots.karaokeDoor; P.x = d.x + .6; P.z = d.z; P.ry = Math.PI / 2; P.group.position.set(P.x, 0, P.z); P.group.rotation.y = P.ry;
    const n = K.companion; if (n) { occ.forEach((o, k) => { if (o === n) occ[k] = null; }); n.karaoke = false; n.x = d.x + 1.6; n.z = d.z + .8; NC.NPC.release(n); n.booked = false; n.g.position.set(n.x, 0, n.z); n.g.visible = true; }
    K.companion = null; G.visible = false; setClubVisible(true); borrowLights(false); K.inRoom = false; bar.style.display = 'none'; panel.style.display = 'none'; lyricEl.style.display = 'none';
  });
}
K.stand = s => { occ[s.s] = null; const seat = SEATS[s.s]; return { x: seat.x + Math.sin(seat.ry) * .9, z: seat.z + Math.cos(seat.ry) * .9 }; };
K.enter = enter; K.leave = leave; K.play = play; K.stop = stop;

/* 상호작용 후보 */
NC.interactProviders.push(() => {
  const P = NC.player, out = []; if (!P.group) return out;
  if (!K.inRoom) { const d = W.spots.karaokeDoor; if (d) { const dist = Math.hypot(P.x - d.x, P.z - d.z); if (dist < 2.4) out.push({ label: '🎤 2차 노래방 가기 (E)', dist, run: enter }); } return out; }
  const de = Math.hypot(P.x - EXIT.x, P.z - EXIT.z); if (de < 1.6) out.push({ label: '🚪 클럽으로 돌아가기 (E)', dist: de, run: leave });
  const dt = Math.hypot(P.x - KX, P.z - (KZ - 2.6)); if (dt < 2.2 && !K.playing) out.push({ label: '🎵 노래 고르기 (E)', dist: dt + .2, run: () => { renderList(); panelState(); panel.style.display = 'flex'; } });
  SEATS.forEach((s, i) => { const d = Math.hypot(P.x - s.x, P.z - s.z); if (d < 1.3 && !occ[i] && !K.playing) out.push({ label: '🛋 소파에 앉기 (E)', dist: d + .3, run: () => NC.ui.fade(() => { occ[i] = 'me'; NC.sitPlayer({ kind: 'karaoke', s: i }, s); }) }); });
  const n = K.companion; if (n && n.state === 'seated') { const d = Math.hypot(P.x - n.x, P.z - n.z); if (d < 2.4) out.push({ label: `💬 ${n.name}와 대화 (E)`, dist: d + .1, run: () => NC.Dialog.open(n, { intro: U.pick(['여기 분위기 너무 좋다~ 다음 곡 뭐 할래요?', '노래방 오니까 신나요 ㅎㅎ', '목 좀 풀었어요? 저 다음에 부를래요!']) }) }); }
  return out;
});

/* 카메라: 노래 중엔 시네마틱 2컷 교차 */
NC.camOverride = () => {
  if (!K.inRoom) return null; const st = K.playing; const dlgOpen = NC.Dialog && NC.Dialog.cur;
  if (!st && !dlgOpen) return null;
  if (dlgOpen && !st) return { cx: KX + 1.8, cy: 1.7, cz: KZ + 1.4, tx: KX - 2.6, ty: 1.0, tz: KZ + .6 };
  const g = st.singer === 'me' ? NC.player.group : K.companion && K.companion.g; if (!g) return null;
  const bar16 = A ? Math.floor((A.C.currentTime - st.t0) / st.sd / 64) : 0, p = g.position;
  if (bar16 % 2 === 0) return { cx: p.x + 1.2, cy: 1.65, cz: p.z - 1.9, tx: p.x - .1, ty: 1.45, tz: p.z };            // 정면(TV 쪽에서 가수 얼굴)
  return { cx: KX + 3.6, cy: 2.3, cz: KZ + 2.6, tx: KX - .4, ty: 1.4, tz: KZ - 2.6 };                                  // 방 전체 + TV
};

/* 프레임 */
let scrT = 0;
NC.tickers.push((dt, t) => {
  if (!K.inRoom) return;
  scoreTick(dt);
  scrT += dt; if (scrT > 1 / 30) { scrT = 0; drawScreen(t); if (K.playing) { lg.clearRect(0, 0, 1400, 220); lyricsDraw(lg, 1400, 220, K.playing, (A.C.currentTime - K.playing.t0) / K.playing.sd); } }
  cove.emissive.setHSL((t * .06) % 1, 1, .5).convertSRGBToLinear();
  ball.rotation.y += dt * .6; const c = Math.cos(ball.rotation.y), s = Math.sin(ball.rotation.y), B = ball.position;
  for (let i = 0; i < SPK; i++) { const d = spDir[i], dx = d[0] * c - d[2] * s, dy = d[1], dz = d[0] * s + d[2] * c; let tt = 1e9; if (dx) tt = Math.min(tt, ((dx > 0 ? KX + HX : KX - HX) - B.x) / dx); if (dz) tt = Math.min(tt, ((dz > 0 ? KZ + HZ : KZ - HZ) - B.z) / dz); if (dy < 0) tt = Math.min(tt, -B.y / dy); else if (dy > 0) tt = Math.min(tt, (H - B.y) / dy); tt *= .99; spPos[i * 3] = B.x + dx * tt; spPos[i * 3 + 1] = B.y + dy * tt; spPos[i * 3 + 2] = B.z + dz * tt; }
  spGeo.attributes.position.needsUpdate = true;
  const L = W.lights || {}, b = K.playing && A ? ((A.C.currentTime - K.playing.t0) / K.playing.sd / 4) % 1 : (t * 2) % 1;
  if (L.bar) L.bar.intensity = 1.2 + (K.playing ? (1 - b) * .9 : .3 * Math.sin(t)); if (L.corridor) L.corridor.intensity = 1.1 + (K.playing ? b * .8 : .3 * Math.cos(t));
  if (L.kdoor) L.kdoor.color.setHSL((t * .05 + .6) % 1, .6, .6);
  // 동반 NPC 호응
  const n = K.companion; if (n && K.playing && K.playing.singer === 'me' && n.state === 'seated' && Math.random() < dt * .25) NC.Motion.play(n.g, U.pick(['clap', 'clap', 'cheer', 'laugh']));
});
// 노래 끝나기 전에 방을 나가면 정리
NC.on('karaoke:start', () => { panel.style.display = 'none'; });
renderList(); panelState();
console.info('[karaoke] 곡 ' + SONGS.length + '개 · 장르 ' + new Set(SONGS.map(s => s.style)).size + '종');
})();
