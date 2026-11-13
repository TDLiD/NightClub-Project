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
  const bus = g(.8), comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; bus.connect(comp); comp.connect(AC.silent || AC.master);   // v21 노래방 엔진 소리 삭제(무음 노드로)
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
  /* v21 반주 삭제: 배경 음악은 1~7.mp3 만 — 노래방·밴드·블루스 반주를 연주하지 않음 */
  if (singer === 'me') NC.ui.toast('🎤 노래방 반주는 꺼져 있어요 — 배경 음악은 1~7.mp3 만 나와요'); return;
  const AU = audio(); if (!AU) return NC.ui.toast('오디오를 시작할 수 없어요');
  stop(true);
  const cmp = compose(song, K.keyShift), sd = 60 / song.bpm / 4, t0 = AU.C.currentTime + .35;
  const st = K.playing = { song, cmp, sd, t0, next: 0, singer, ticks: 0, voiced: 0, hit: 0, taps: [], goodTaps: 0, beats: 0, cheer: 0, detected: -1, done: false };
  AU.lead.gain.setTargetAtTime(singer === 'me' ? (K.guide ? .55 : 0) : singer === 'blues' ? .3 : singer === 'band' ? .75 : .9, AU.C.currentTime, .05);
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
  lyricEl.style.display = singer === 'blues' || singer === 'band' ? 'none' : 'block'; panelState(); NC.emit('karaoke:start', song, singer);
}
function stop(silent) {
  if (timer) clearInterval(timer); timer = null; const st = K.playing; K.playing = null;
  if (A) A.lead.gain.setTargetAtTime(0, A.C.currentTime, .02);
  if (st) { if (st.singer === 'me') { singPose(NC.player.group, false); NC.player.busy = false; } else if (st.singer === 'blues') { if (BL.n) setTimeout(() => endBlues('stop'), 0); } else if (st.singer === 'band') { } else if (K.companion) { singPose(K.companion.g, false); seatCompanion(); } }
  lyricEl.style.display = 'none'; if (!silent) screen.mode = 'menu'; panelState();
}
function finish() {
  const st = K.playing; if (!st || st.done) return; st.done = true; let score, how;
  if (st.singer === 'band') { stop(true); NC.emit('band:songEnd', st.song); return; }
  if (st.singer === 'blues') { if (BL.n) { const nx = st.song === SONGS[2] ? SONGS[4] : SONGS[2]; K.playing = null; play(nx, 'blues'); if (NC.Dialog.cur) NC.Dialog.npcSay(U.pick(['한 곡 더 출까요? ㅎㅎ', '이 노래도 좋다… 계속 춰요']), 'smile'); return; } stop(true); return; }
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
  const singerG = st.singer === 'me' ? NC.player.group : st.singer === 'npc' && K.companion && K.companion.g;
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
    g.textAlign = 'right'; g.fillText(st.singer === 'me' ? (K.mic ? '🎙 MIC 채점' : '🪘 탬버린 채점') : st.singer === 'blues' ? '🕺 부르스 타임 💗' : `🎤 ${K.companion ? K.companion.name : ''} 열창 중`, w - 24, 40);
    if (pos < INTRO * 16) { g.textAlign = 'center'; const a = U.clamp(1 - (pos - 40) / 20, 0, 1); g.globalAlpha = a; g.font = '900 96px "Malgun Gothic",sans-serif'; g.fillStyle = '#fff'; g.fillText(st.song.title, w / 2, 220); g.font = '800 40px "Malgun Gothic",sans-serif'; g.fillStyle = '#ffd6f0'; g.fillText(`노래 ${st.song.artist}`, w / 2, 300); g.font = '600 26px "Malgun Gothic",sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(`${st.song.genre} · ${st.song.bpm} BPM · 작사/작곡 추억의나이트`, w / 2, 350); g.globalAlpha = 1; }
    // 음정 가이드 바
    if (st.singer === 'me' && K.mic) { const y0 = 70, hh = 110, lo = Math.min(...st.cmp.notes.map(n => n.midi)) - 3, hi = Math.max(...st.cmp.notes.map(n => n.midi)) + 3, Y = m => y0 + hh - (m - lo) / (hi - lo) * hh, X = s => 200 + (s - pos) * 14;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y0, w, hh); st.cmp.notes.forEach(n => { const x = X(n.step); if (x > w || x + n.dur * 14 < 0) return; g.fillStyle = pos >= n.step && pos < n.step + n.dur ? '#ffe03d' : 'rgba(120,200,255,.8)'; g.fillRect(x, Y(n.midi) - 5, n.dur * 14 - 2, 10); });
      g.fillStyle = '#fff'; g.fillRect(199, y0, 2, hh); if (st.detected > 0) { let m = st.detected; while (m < lo) m += 12; while (m > hi) m -= 12; g.fillStyle = '#ff4fa8'; g.beginPath(); g.arc(200, Y(m), 9, 0, 7); g.fill(); } }
    g.save(); g.translate(0, h * .58); lyricsDraw(g, w, h * .4, st, pos); g.restore();
  } else {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 80px "Malgun Gothic",sans-serif'; g.fillStyle = '#fff'; g.shadowColor = '#ff3dbb'; g.shadowBlur = 30; g.fillText(K.mode === 'vip' ? `✨ ${K.label || 'VIP ROOM'} ✨` : (K.label ? `🎤 ${K.label}` : '추억의 노래방'), w / 2, 90); g.shadowBlur = 0;
    g.font = '700 26px "Malgun Gothic",sans-serif'; g.fillStyle = '#ffd6f0'; g.fillText(K.mode === 'vip' ? '🔔 웨이터 호출로 주문·부킹 · 💬 소파에서 대화' : '🎵 노래 고르기 버튼을 눌러 곡을 선택하세요', w / 2, 150);
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
const bar = document.createElement('div'); bar.id = 'karaBar'; bar.style.display = 'none'; bar.innerHTML = '<button id="kOpen">🎵 노래 고르기</button><button id="kCall">🙋 웨이터 호출</button><button id="kTap2">🪘 탬버린</button><button id="kStop2">⏹</button>'; document.body.appendChild(bar);
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
/* v25 enter(opts): 같은 프라이빗 룸을 'VIP 룸'(클럽 안 VIP 4~13)과 '노래방 룸'(밖 노래방 건물)으로 함께 사용
 *  opts = { mode: 'vip' | 'karaoke', label, exit: { x, z, ry, y }, comp: 함께 온 손님, inviteAsk: true(기존 2차 초대 창) } */
async function enter(opts = {}) {
  const P = NC.player; if (P.busy || K.inRoom) return;
  if (NC.Dialog && NC.Dialog.cur) NC.Dialog.close('bye');
  const comp = opts.comp !== undefined ? opts.comp : (opts.inviteAsk ? await inviteCompanion() : null);
  K.mode = opts.mode || 'karaoke'; K.label = opts.label || ''; K.exit = opts.exit || null; K.onLeave = opts.onLeave || null;
  W.zoneLabel.karaoke = K.mode === 'vip' ? `✨ ${K.label}` : `🎤 ${K.label || '노래방'}`;
  NC.ui.fade(() => {
    if (P.seat) NC.requestStand();
    P.x = ENTRY.x; P.z = ENTRY.z; P.ry = Math.PI * 1.15; P.target = null; P.autoPath = null; P.group.position.set(P.x, 0, P.z); P.y = 0; P.group.rotation.y = P.ry;
    K.companion = comp; if (comp) { comp.karaoke = true; comp.booked = true; seatCompanion(); }
    G.visible = true; setClubVisible(false); borrowLights(true); K.inRoom = true; bar.style.display = 'flex'; screen.mode = 'menu';
    NC.ui.toast(K.mode === 'vip' ? `✨ ${K.label}에 들어왔어요 — 🔔 웨이터 호출로 주문·부킹, 소파에 앉아 대화해 보세요` : `🎤 ${K.label || '노래방'}에 들어왔어요! 🔔 웨이터 호출로 술·안주 주문, 「🎵 노래 고르기」로 곡 선택`); panelState();
    NC.emit && NC.emit('room:enter', K.mode);
  });
}
/* 퇴장 후 손님을 내려놓을 클럽 안 위치(밖 건물·2층 라운지에서 나와도 손님은 클럽 통로로) */
const clubDrop = () => { const e = K.exit; return e && e.club ? e : { x: -6, z: W.corridorY || 10.75 }; };
function leave() {
  const P = NC.player; stop(true);
  NC.ui.fade(() => {
    if (P.seat) NC.requestStand();
    const e = K.exit || { x: W.spots.karaokeDoor.x + .6, z: W.spots.karaokeDoor.z, ry: Math.PI / 2, club: true }, d = clubDrop(); P.x = e.x; P.z = e.z; P.ry = e.ry != null ? e.ry : Math.PI / 2; P.y = e.y || 0; P.group.position.set(P.x, P.y, P.z); P.group.rotation.y = P.ry;
    const n = K.companion; if (n) { occ.forEach((o, k) => { if (o === n) occ[k] = null; }); n.karaoke = false; n.x = d.x + 1.6; n.z = d.z + .8; NC.NPC.release(n); n.booked = false; n.g.position.set(n.x, 0, n.z); n.g.visible = n.state !== 'off'; }
    K.guests.forEach((g, k) => { if (g === n || g.leftRoom) return; occ.forEach((o, i) => { if (o === g) occ[i] = null; }); g.karaoke = false; g.x = d.x + 1.6 + k * .7; g.z = d.z - .8; NC.NPC.release(g); g.booked = false; g.g.position.set(g.x, 0, g.z); g.g.visible = g.state !== 'off'; });
    K.guests.length = 0; if (BL.n) endBlues('leave'); if (kw) { const o = kw.o; o.x = kw.x; o.z = kw.z; o.g.position.set(o.x, 0, o.z); o.busy = false; o.state = 'idle'; o.done = null; o.path = []; kw = null; }
    K.companion = null; G.visible = false; setClubVisible(true); borrowLights(false); K.inRoom = false; bar.style.display = 'none'; panel.style.display = 'none'; lyricEl.style.display = 'none';
    const cb = K.onLeave; K.onLeave = null; K.mode = null; if (cb) try { cb(); } catch (err) { console.error(err); } NC.emit && NC.emit('room:leave');
  });
}
K.serveItem = it => serveK(it, '사장님');   // v25 노래방 건물 카운터에서 미리 주문한 술·안주를 방에 들여옴
K.isGuest = n => isGuest(n);
K.stand = s => { occ[s.s] = null; const seat = SEATS[s.s]; return { x: seat.x + Math.sin(seat.ry) * .9, z: seat.z + Math.cos(seat.ry) * .9 }; };
K.enter = enter; K.leave = leave; K.play = play; K.stop = stop; K.box = { cx: KX, cz: KZ, hx: HX, hz: HZ, h: H };   // v28 카메라가 방 벽 밖으로 나가지 않게
NC.on && NC.on('music:user', () => { const st = K.playing; if (st && !K.inRoom && (st.singer === 'band' || st.singer === 'blues')) stop(true); BL.prevVol = null; });   // v20.1 사용자가 고른 스테이지 음악이 우선

/* ═════════ v9: 🙋 웨이터 호출 · 💃 부킹 · 🕺 부르스 ═════════
 *  ■ 웨이터 호출: 클럽 웨이터 한 명이 노래방 문으로 들어와 테이블 옆에서 주문(맥주·과일·양주·음료) / 부킹 / 팁
 *  ■ 부킹: 스타일 선택 → 팁(🪙10 기본 · 🪙30 확실) → 7초 뒤 노크와 함께 여성 손님이 들어와 소파에 앉고 인사
 *  ■ 부르스: 부킹 손님(또는 동반 손님) 대화 칩 「🕺 부르스 출래요?」 → 발라드·R&B 반주, 둘이 마주 보고 슬로댄스
 *     세부 행동은 '상대 동의(호감도)'에 따라 반응이 갈린다 — 호감이 충분하면 받아 주고, 아니면 거절·밀침·뺨·퇴장
 *     (노출 표현은 없음: 옷 벗기기는 항상 거절되거나 농담으로 넘어감)
 */
K.guests = [];
const WDOOR = { x: KX + 3.4, z: KZ + 2.55 }, WSTAND = { x: KX + .15, z: KZ + 1.95 };
let kw = null, tipBonus = 0;
const KMENU = [
  { id: 'beer', icon: '🍺', name: '맥주 세트', price: 12, alc: 1, prop: 'beer' },
  { id: 'fruit', icon: '🍉', name: '모둠 과일 안주', price: 15, alc: 0, prop: 'fruit' },
  { id: 'whisky', icon: '🥃', name: '양주 세트', price: 40, alc: 2, prop: 'whisky' },
  { id: 'soda', icon: '🥤', name: '음료수', price: 3, alc: 0, prop: 'soda' },
];
const kProps = [];
function kProp(kind) {
  const g = new T.Group(), x = -2.0 + (Math.random() - .5) * 1.4, z = .6 + (Math.random() - .5) * .5;
  const bottle = (c, h = .3) => { const b = new T.Mesh(new T.CylinderGeometry(.035, .045, h, 10), M.std(c, { roughness: .06, metalness: .3 })); b.position.y = h / 2; return b; };
  if (kind === 'beer') for (let i = 0; i < 4; i++) { const b = bottle('#6a3a10'); b.position.x = Math.cos(i * 1.6) * .12; b.position.z = Math.sin(i * 1.6) * .12; g.add(b); }
  else if (kind === 'whisky') { const b = new T.Mesh(box(.09, .28, .09), M.std('#7a4010', { roughness: .05, metalness: .3, transparent: true, opacity: .85 })); b.position.y = .14; g.add(b); const ice = new T.Mesh(new T.CylinderGeometry(.1, .08, .15, 14), MT.chrome); ice.position.set(.2, .075, 0); g.add(ice); }
  else if (kind === 'fruit') { const pl = new T.Mesh(new T.CylinderGeometry(.2, .14, .04, 18), M.std('#f4f4f4', { roughness: .2 })); pl.position.y = .02; g.add(pl); ['#ff3d5a', '#ffd23d', '#7bd33d', '#ff8a3d', '#b03dff', '#ff6a8a', '#ffe0a0'].forEach((c, i) => { const f = new T.Mesh(new T.SphereGeometry(.045, 8, 6), M.std(c, { roughness: .35 })); f.position.set(Math.cos(i) * .09, .06, Math.sin(i) * .09); g.add(f); }); }
  else { const c = new T.Mesh(new T.CylinderGeometry(.04, .04, .12, 12), M.std('#e8333a', { roughness: .3, metalness: .6 })); c.position.y = .06; g.add(c); }
  add(g, x, .48, z); kProps.push(g); while (kProps.length > 8) G.remove(kProps.shift());
}
const isGuest = n => !!n && (n === K.companion || K.guests.includes(n));
const say = (who, line) => { NC.ui.chatAdd(who, line); };
function callWaiter() {
  const P = NC.player; if (!K.inRoom) return; if (kw) return NC.ui.toast('웨이터가 이미 오고 있어요');
  if (NC.Dialog.cur) NC.Dialog.close('bye');
  const o = (NC.Waiters ? NC.Waiters.list : []).filter(w => !w.busy)[0]; if (!o) return NC.ui.toast('웨이터가 모두 바빠요. 잠시 후 다시 불러 주세요');
  kw = { o, x: o.x, z: o.z }; o.busy = true; o.g.userData.lookAt = null;
  NC.ui.toast('🔔 호출 벨을 눌렀어요 — 웨이터가 곧 들어와요'); void P;
  setTimeout(() => { if (!K.inRoom || !kw) return; o.x = WDOOR.x; o.z = WDOOR.z + .5; o.g.position.set(o.x, 0, o.z); o.g.visible = true;
    NC.Waiters.walk(o, [WDOOR, WSTAND], () => { o.g.userData.lookAt = NC.player.group.position; NC.Motion.play(o.g, 'bow'); waiterMenu(o); }, 2.4); }, 1300);
}
function waiterOut() {
  const w = kw; if (!w) return; const o = w.o; o.g.userData.lookAt = null;
  NC.Waiters.walk(o, [WDOOR, { x: WDOOR.x, z: KZ + HZ - .3 }], () => { o.x = w.x; o.z = w.z; o.g.position.set(o.x, 0, o.z); o.g.visible = !K.inRoom; o.busy = false; o.state = 'idle'; kw = null; }, 2.6);
}
function waiterMenu(o) {
  const P = NC.player; P.busy = true; const name = o.def.title, done = () => { NC.ui.hideDlg(); P.busy = false; };
  const order = it => { if (NC.goldenFree && NC.goldenFree()) NC.ui.toast('🔔 골든벨 ALL PAY — 무료!'); else if (!NC.Wallet.spend(it.price)) return NC.ui.toast(`🪙 코인이 부족해요 (${it.price} 필요)`); done(); serveK(it, name); waiterOut(); };
  NC.ui.showDlg({ name, tag: '🤵 노래방 서비스', job: `🪙 ${NC.Wallet.get()}`, say: K.guests.length ? '네 손님~ 더 필요하신 거 있으세요? 😊' : '부르셨어요? 주문이든 부킹이든 말씀만 하세요! 😄',
    opts: KMENU.map(it => ({ t: `${it.icon} ${it.name}  🪙${it.price}`, run: () => order(it) })).concat([
      { t: '👥 손님 리스트에서 골라 부킹', run: () => { NC.ui.hideDlg(); P.busy = false; NC.Service && NC.Service.pickBooking(n => bookSpecific(n, o), () => waiterOut()); } },
      { t: '💃 부킹 부탁해요 (웨이터 추천)', run: () => bookStyle(o) },
      { t: '🧾 팁 드릴게요 (🪙5)', run: () => { if (NC.Wallet.spend(5)) { tipBonus = Math.min(.15, tipBonus + .05); say(name, '감사합니다! 부킹 들어오면 제일 먼저 챙겨 드릴게요 😄'); } else NC.ui.toast('코인이 부족해요'); done(); waiterOut(); } },
      { t: '괜찮아요, 그냥 불렀어요', run: () => { done(); waiterOut(); } }]) });
}
function serveK(it, name) {
  setTimeout(() => {
    kProp(it.prop); NC.ui.toast(`${it.icon} ${it.name} 나왔습니다!`);
    const L = NC.Life; if (L && it.id !== 'fruit') { L.drink = { id: it.id, name: it.name, icon: it.icon, alc: it.alc, price: it.price }; L.sips = 0; NC.player.group.userData.holdGlass = true; }
    const gs = K.guests.length ? K.guests : K.companion ? [K.companion] : [];
    gs.forEach(g => { const d = it.price >= 40 ? 4 : it.price >= 12 ? 2 : 1; g.aff = U.clamp(g.aff + d, 0, 100); setTimeout(() => { NC.Motion.play(g.g, it.alc ? 'cheers' : 'clap'); say(g.name, it.id === 'whisky' ? '와 양주요? 오늘 제대로 노네요 ㅎㅎ' : it.id === 'fruit' ? '과일 좋아요~ 센스 있으시다!' : '짠~ 시원하게 한 잔 해요!'); }, 600); });
    if (gs.length) NC.ui.toast(`💗 ${gs.map(g => g.name).join(', ')} 호감도 상승`);
  }, 900); void name;
}
/* 부킹 */
function bookStyle(o) {
  const P = NC.player, name = o.def.title;
  NC.ui.showDlg({ name, tag: '🤵 부킹', job: `🪙 ${NC.Wallet.get()}`, say: '어떤 스타일로 모셔 올까요? 팁에 따라 성공률이 달라져요 😉', opts: [
    { t: '🌸 상냥하고 귀여운 스타일', run: () => bookTip(o, ['shy', 'outgoing']) }, { t: '😎 시크한 스타일', run: () => bookTip(o, ['cool']) },
    { t: '🎉 흥 많은 스타일', run: () => bookTip(o, ['playful', 'outgoing']) }, { t: '🎲 아무나 좋아요', run: () => bookTip(o, null) },
    { t: '다음에 할게요', run: () => { NC.ui.hideDlg(); P.busy = false; waiterOut(); } }] });
}
function bookTip(o, traits) {
  const P = NC.player, name = o.def.title;
  NC.ui.showDlg({ name, tag: '🤵 부킹', job: `🪙 ${NC.Wallet.get()}`, say: K.guests.length >= 2 ? '방이 벌써 꽤 북적이네요 ㅎㅎ 한 분 더 모셔 볼게요!' : '팁은 어느 정도로 하시겠어요?', opts: [
    { t: '🪙10 기본 팁 (성공률 보통)', run: () => book(o, traits, 10, .6) }, { t: '🪙30 확실하게 부탁해요 (성공률 높음)', run: () => book(o, traits, 30, .9) },
    { t: '← 스타일 다시 고를래요', run: () => bookStyle(o) }] }); void P;
}
function candidates(traits) {
  // v11 버그 수정: 온라인 모드(로컬 서버)에서는 AI 손님이 꺼져 있어(state 'off') 후보가 0명 → 부킹이 항상 실패했음.
  //   꺼진 손님도 웨이터가 '불러오는' 것으로 처리하고, 퇴장 시 NPC.release 가 원래 상태(off)로 되돌린다.
  const ok = (n, strict) => n.gender === 'f' && (n.role === 'persona' || n.role === 'crowd') && !n.booked && !n.karaoke && !n.stay && !isGuest(n) && n !== BL.n
    && !['seated', 'talk', 'karaoke', 'blues', 'path'].includes(n.state) && (!strict || (n.cool || 0) <= 0);
  let pool = (NC.npcs || []).filter(n => ok(n, true)); if (!pool.length) pool = (NC.npcs || []).filter(n => ok(n, false));
  return pool.map(n => ({ n, s: (traits && traits.includes(n.trait) ? 40 : 0) + (n.role === 'persona' ? 10 : 0) + (n.mood || 0) * 5 + Math.random() * 20 })).sort((a, b) => b.s - a.s).map(x => x.n);
}
function book(o, traits, tip, p) {
  const P = NC.player, name = o.def.title; NC.ui.hideDlg(); P.busy = false;
  if (K.guests.length >= 3) { say(name, '이 방은 이미 꽉 찼어요 ㅎㅎ 지금 분들이랑 즐기세요!'); return waiterOut(); }
  if (!NC.Wallet.spend(tip)) { NC.ui.toast(`🪙 코인이 부족해요 (${tip} 필요)`); return waiterOut(); }
  say(name, U.pick(['네! 잠시만요, 괜찮은 분 모셔 오겠습니다 😄', '맡겨 주세요~ 금방 다녀올게요!', '오늘 분위기 좋은 테이블 있어요. 바로 모셔 올게요!'])); waiterOut();
  const pool = candidates(traits);
  setTimeout(() => {
    if (!K.inRoom) { NC.Wallet.add(tip, '부킹 취소 환불'); return; }
    const n = pool.find(x => !x.booked && !x.karaoke && x.state !== 'talk') || candidates(traits)[0];
    if (!n || Math.random() > p + tipBonus) { NC.Wallet.add(Math.floor(tip / 2), '부킹 실패 반환'); NC.ui.toast('🤵 웨이터: "죄송해요, 지금은 다들 일행이 있으시네요… 팁 절반 돌려드릴게요 🙇"'); return; }
    guestEnter(n, tip);
  }, 7000);
}
/* v27 지목 부킹: 리스트에서 고른 손님을 웨이터가 어디서든 데려옴(성공률 = 호감·팁) */
function bookSpecific(n, o) {
  const P = NC.player, name = o ? o.def.title : '웨이터';
  if (!K.inRoom) return; if (isGuest(n)) { NC.ui.toast(`${n.name}님은 이미 이 방에 있어요`); return o && waiterOut(); }
  if (K.guests.length >= 3) { say(name, '이 방은 이미 꽉 찼어요 ㅎㅎ'); return o && waiterOut(); }
  const tip = 15; if (!NC.Wallet.spend(tip)) { NC.ui.toast(`🪙 코인이 부족해요 (${tip} 필요)`); return o && waiterOut(); }
  say(name, `${n.name} 님이요? 알겠습니다! ${NC.Service ? NC.Service.whereOf(n) : ''}에서 모셔 올게요 😄`); if (o) waiterOut();
  setTimeout(() => {
    if (!K.inRoom) { NC.Wallet.add(tip, '부킹 취소 환불'); return; }
    const ok = NC.Service ? NC.Service.willCome(n, tip) : Math.random() < .7;
    if (!ok) { NC.Wallet.add(Math.floor(tip / 2), '부킹 거절 반환'); NC.ui.toast(`🤵 웨이터: "${n.name} 님이 지금은 어렵다고 하시네요… 팁 절반 돌려드릴게요 🙇"`); return; }
    if (NC.Service) NC.Service.detach(n); guestEnter(n, tip + 15);
  }, 6500);
}
K.bookSpecific = (n, o) => bookSpecific(n, o || null);
K.callWaiter = () => callWaiter();
function seatGuest(n) {
  occ.forEach((o, k) => { if (o === n) occ[k] = null; });
  let i = occ.findIndex((o, k) => !o && k >= 1); if (i < 0) i = occ.findIndex(o => !o); if (i < 0) i = 3;
  occ[i] = n; const s = SEATS[i]; n.x = s.x; n.z = s.z; NC.NPC.sit(n, s.x, s.z, s.ry, s.h); n.g.visible = true; n.g.userData.lookAt = NC.player.group.position;
}
function guestEnter(n, tip) {
  NC.ui.toast('🚪 똑똑 — 부킹 손님이 들어와요!');
  n.enabled = true; n.cool = 0; n.booked = true; n.karaoke = true; n.leftRoom = false; n.aff = U.clamp(Math.max(n.aff, 42) + (tip >= 30 ? 6 : 3), 0, 100); n.bl = { kissed: false, warned: 0 };
  K.guests.push(n); if (!K.companion) K.companion = n;
  NC.unseatAvatar(n.g, WDOOR.x, WDOOR.z + .4); n.x = WDOOR.x; n.z = WDOOR.z + .4; n.g.position.set(n.x, 0, n.z); n.g.visible = true; n.g.userData.dance = null;
  NC.NPC.goTo(n, { x: KX + 1.4, z: KZ + 1.9 }, () => {
    seatGuest(n); NC.Motion.play(n.g, 'wave'); panelState();
    const hi = { shy: '아, 안녕하세요… 웨이터분이 꼭 가 보라고 해서요 ㅎㅎ', cool: '안녕하세요. 노래 잘 하시는 분 있다길래 와 봤어요.', playful: '짜잔~ 부킹 왔습니다! 탬버린 제가 맡을게요 ㅋㅋ', outgoing: '안녕하세요~! 여기 분위기 제일 좋다고 해서 왔어요!' }[n.trait] || '안녕하세요~ 같이 놀아요!';
    setTimeout(() => { if (isGuest(n) && K.inRoom) NC.Dialog.open(n, { intro: hi }); }, 700);
  }, 2.2);
}
function guestLeave(n, line) {
  if (BL.n === n) endBlues('leave');
  if (NC.Dialog.cur && NC.Dialog.cur.n === n) { NC.Dialog.npcSay(line, 'annoyed'); setTimeout(() => NC.Dialog.cur && NC.Dialog.cur.n === n && NC.Dialog.close('left'), 1600); } else say(n.name, line);
  setTimeout(() => {
    occ.forEach((o, k) => { if (o === n) occ[k] = null; }); NC.unseatAvatar(n.g, n.x, n.z); n.state = 'karaoke';
    NC.NPC.goTo(n, { x: WDOOR.x, z: KZ + HZ - .3 }, () => {
      n.leftRoom = true; n.karaoke = false; const i = K.guests.indexOf(n); if (i >= 0) K.guests.splice(i, 1); if (K.companion === n) K.companion = K.guests[0] || null;
      const d = clubDrop(); n.x = d.x + 1.8; n.z = d.z + .5; n.g.position.set(n.x, 0, n.z); NC.NPC.release(n); n.cool = 180; n.rejectedAt = Date.now(); n.g.visible = !K.inRoom && n.state !== 'off'; panelState();
    }, 2.6);
  }, 1900);
}
/* 부르스 — v11: 노래방 + 클럽 스테이지·댄스플로어 어디서든 */
const BL = { n: null, c: { x: KX + .9, z: KZ - .1 }, where: 'karaoke', t: 0, kiss: 0, kissDur: 2.3 };
const aff = (n, d) => { n.aff = U.clamp(n.aff + d, 0, 100); if (NC.Dialog.cur && NC.Dialog.cur.n === n) { NC.Dialog.floatDelta(d); NC.Dialog.renderHead(); } };
const CLUB_ZONES = ['stage', 'dance'];
function clubMood(on) {                                  // 클럽: DJ 블루스 타임 — 음악 줄이고 조명 어둡게, 끝나면 원래대로
  const AU = NC.Audio;
  if (on) { BL.prevTheme = W.themeId; if (W.setTheme && W.THEMES && W.THEMES.dim) W.setTheme('dim'); NC.ui.toast('🎧 DJ: "자~ 블루스 타임입니다. 조명 낮춥니다 💗"'); }
  else { if (BL.prevTheme && W.setTheme) W.setTheme(BL.prevTheme); BL.prevVol = null; }
}
function startBlues(n) {
  const D = NC.Dialog, P = NC.player; if (BL.n) return;
  n.bl = n.bl || { kissed: false, warned: 0 };
  if (n.aff < 45) { D.npcSay(U.pick(['부르스요? 음… 아직 좀 어색해요. 조금 더 얘기해요 ㅎㅎ', '헉 벌써요? 조금만 더 친해지고요~', '…부르스는 좀. 짠부터 해요.']), 'shy'); NC.Motion.play(n.g, 'headshake'); aff(n, -1); return; }
  /* v28 어느 장소에서나: 노래방 룸 · 스테이지/댄스플로어(DJ 블루스 타임 연출) · 그 밖의 곳(테이블·VIP·바·통로·흡연실·라운지·거리·로비 등)은 두 사람 사이 빈자리에서 */
  BL.where = K.inRoom ? 'karaoke' : CLUB_ZONES.includes(P.zone) ? 'club' : 'any';
  if (BL.where === 'karaoke') BL.c = { x: KX + .9, z: KZ - .1 };
  else if (BL.where === 'club') { const Z = W.zones, st = P.zone === 'stage' ? Z.stage : Z.dance; BL.c = { x: U.clamp((P.x + n.x) / 2, st.x0 + 1.5, st.x1 - 1.5), z: U.clamp((P.z + n.z) / 2, st.z0 + 1.6, st.z1 - 1.2) }; }
  else { const sa = P.seat && P.seat.kind === 'table' && NC.standPos ? NC.standPos(P.seat.t, P.seat.s) : null; const bx = sa || { x: (P.x + n.x) / 2, z: (P.z + n.z) / 2 }; BL.c = { x: bx.x, z: bx.z }; }
  n.bl.reseat = (BL.where !== 'karaoke' && n.state === 'seated' && n._seatArgs) ? n._seatArgs.slice() : null;
  BL.music = null; if (BL.where !== 'karaoke' && NC.Audio && NC.Audio.pl !== 'blues' && NC.Audio.playPlaylist) { BL.music = NC.Audio.pl || 'euro'; NC.Audio.playPlaylist('blues'); }   // 블루스 곡으로 전환, 끝나면 원래 곡으로
  if (K.playing) stop(true);
  if (P.seat) { const s = P.seat; if (s.kind === 'karaoke') { occ[s.s] = null; NC.unseatAvatar(P.group, BL.c.x, BL.c.z); P.seat = null; } else NC.standLocal(); }
  occ.forEach((o, k) => { if (o === n) occ[k] = null; }); NC.unseatAvatar(n.g, BL.c.x, BL.c.z);
  BL.s0 = { px: P.x, pz: P.z, nx: n.x, nz: n.z };   // v39 Approach: 순간이동 없이 지금 자리에서 걸어와 자리 잡음
  BL.n = n; BL.t = 0; BL.t0 = performance.now(); BL.kiss = 0; n.state = 'blues'; n.g.userData.lookAt = null; P.group.userData.lookAt = null;
  BL.glass = [P.group.userData.holdGlass, n.g.userData.holdGlass]; P.group.userData.holdGlass = n.g.userData.holdGlass = false;
  P.group.userData.dance = 'blues'; P.group.userData.bluesLead = true; n.g.userData.dance = 'blues'; n.g.userData.bluesLead = false; P.group.userData.hideLabel = n.g.userData.hideLabel = true;
  D.npcSay(n.aff >= 75 ? U.pick(['좋아요… 천천히 리드해 줘요 💗', '이 노래 너무 좋다… 가까이 와요']) : U.pick(['음… 한 곡만이에요? ㅎㅎ', '부르스 진짜 오랜만이다 ㅋㅋ 발 밟지 마요!']), 'shy');
  if (!n.bl.danced) { n.bl.danced = true; aff(n, 3); }
  if (BL.where === 'club') clubMood(true);
  D.chips();   // v21 블루스 반주 삭제 — 지금 나오는 MP3 에 맞춰 춤
}
function endBlues(reason) {
  const n = BL.n; if (!n) return; BL.n = null; const P = NC.player;
  if (K.playing && K.playing.singer === 'blues') stop(true);
  if (BL.glass) { P.group.userData.holdGlass = BL.glass[0]; n.g.userData.holdGlass = BL.glass[1]; }
  BL.busy = false; BL.act = null; P.group.userData.bAct = null; n.g.userData.bAct = null; P.group.userData.dance = null; P.group.userData.kissK = 0; n.g.userData.dance = null; n.g.userData.kissK = 0; P.group.userData.hideLabel = n.g.userData.hideLabel = !!NC.Dialog.cur;
  if (n.g.userData.undressed) setTimeout(() => NC.Avatar.undress(n.g, false), 400);   // 부르스가 끝나면 다시 입음
  const talking = NC.Dialog.cur && NC.Dialog.cur.n === n;
  if (BL.where === 'karaoke') {
    P.x = BL.c.x + 1; P.z = BL.c.z + .4;
    if (reason !== 'leave') { seatGuest(n); n.state = 'seated'; }
  } else {
    if (BL.where === 'club') clubMood(false); P.x = BL.c.x - .55; P.z = BL.c.z + .25; n.x = BL.c.x + .55; n.z = BL.c.z - .1;
    if (BL.music && NC.Audio && NC.Audio.pl === 'blues') NC.Audio.playPlaylist(BL.music); BL.music = null;
    const rs = n.bl && n.bl.reseat; if (n.bl) n.bl.reseat = null;
    if (reason !== 'leave') { if (rs) { if (talking) NC.NPC.sit(n, rs[0], rs[1], rs[2], rs[3]); else NC.NPC.goTo(n, { x: rs[0] + Math.sin(rs[2]) * 1.1, z: rs[1] + Math.cos(rs[2]) * 1.1 }, () => NC.NPC.sit(n, rs[0], rs[1], rs[2], rs[3]), 2.4); }
      else { n.state = talking ? 'talk' : 'wander'; n.pause = 2; n.wp = null; } }
  }
  if (talking && reason !== 'leave') { P.group.userData.lookAt = n.g.position; n.g.userData.lookAt = P.group.position; }
  if (reason === 'song' && NC.Dialog.cur) NC.Dialog.npcSay(U.pick(['노래 끝났다… 생각보다 설렜어요 ㅎㅎ', '부르스 잘 추시네요? 다음엔 신나는 거 해요!']), 'smile');
  if (NC.Dialog.cur) NC.Dialog.chips();
}
function clubLeave(n, line) {                           // 클럽: 기분 상한 손님은 자리를 떠남
  if (BL.n === n) endBlues('leave');
  if (NC.Dialog.cur && NC.Dialog.cur.n === n) { NC.Dialog.npcSay(line, 'annoyed'); setTimeout(() => NC.Dialog.cur && NC.Dialog.cur.n === n && NC.Dialog.close('left'), 1600); }
  setTimeout(() => { n.cool = 180; n.rejectedAt = Date.now(); NC.NPC.goTo(n, { x: (Math.random() - .5) * 14, z: -6 + Math.random() * 3 }, () => { n.state = 'wander'; }); }, 1900);
}
const can = (n, need, kissed) => n.aff >= need && (!kissed || n.bl.kissed);
const P_ = s => U.pick(s);
const REACT = {      // out: accept(받아 줌) · stop(손을 잡아 제지) · refuse(뿌리침/외면) — 기준은 상대 호감도(=동의)
  whisper: n => can(n, 40) ? { out: 'accept', d: 2, e: 'laugh', line: P_(['ㅋㅋㅋ 간지러워요~ 뭐라고요? 한 번 더 말해 줘요', '(귀가 빨개지며) …진짜요? 나도요 ㅎㅎ']) } : { out: 'refuse', d: -1, e: 'shy', line: '음악 때문에 잘 안 들려요 ㅎㅎ' },
  waist: n => can(n, 50) ? { out: 'accept', d: 2, e: 'shy', line: P_(['어머… 가까워요 ㅎㅎ 그래도 좋아요', '(살짝 기대며) 이 정도면 딱 좋아요']) } : { out: 'refuse', d: -2, e: 'annoyed', g: 'push', line: '조금만 떨어져서 춰요.' },
  spin: n => ({ out: 'accept', d: n.aff >= 50 ? 2 : 1, e: 'laugh', line: P_(['꺄~ 어지러워요 ㅋㅋㅋ', '오 리드 좀 하시는데요? ㅎㅎ']) }),
  dip: n => can(n, 70) ? { out: 'accept', d: 3, e: 'laugh', line: P_(['꺅! 떨어뜨리면 안 돼요 ㅋㅋ 영화 같다…', '(목에 팔을 감으며) 이런 건 어디서 배웠어요? 💗']) } : { out: 'refuse', d: -1, e: 'surprised', line: '어어 무서워요 ㅋㅋ 그건 다음에요!' },
  forehead: n => can(n, 60) ? { out: 'accept', d: 2, e: 'shy', line: P_(['…이러고 있으니까 심장 소리 들릴 것 같아요', '(눈을 감고 미소 짓는다)']) } : { out: 'refuse', d: -1, e: 'shy', line: '앗, 쑥스러워요 ㅎㅎ' },
  cheek: n => can(n, 65) ? { out: 'accept', d: 3, e: 'shy', line: P_(['(볼을 만지며) …방금 뭐예요 ㅎㅎ 반칙이에요', '헤헤… 한 번 더 해도 돼요']) }
    : n.aff >= 50 ? { out: 'refuse', d: -1, e: 'shy', line: '앗… (고개를 살짝 피한다) 아직이요 ㅎㅎ' } : { out: 'refuse', d: -4, e: 'annoyed', g: 'push', line: '잠깐만요, 그건 좀 아니에요.' },
  dress: n => ({ out: 'accept', d: 2, e: 'smile', redress: true, line: U.pick(['헤헤… 매너 있네요. 그래서 더 좋아요 💗', '고마워요. 오늘 밤은 여기까지만 ㅎㅎ']) }),
  hug: n => can(n, 55) ? { out: 'accept', d: 2, e: 'shy', line: P_(['…따뜻하다. 좀 더 이러고 있어요', '헤헤, 갑자기 왜요 ㅎㅎ 좋아요']) } : { out: 'refuse', d: -1, e: 'shy', g: 'headshake', line: '앗, 너무 가까워요 ㅎㅎ 천천히요~' },
  backhug: n => can(n, 75) ? { out: 'accept', d: 3, e: 'shy', line: P_(['(손을 포개며) …이대로 노래 끝날 때까지 있어요', '뒤에서 안으니까 더 설레요… 💗']) } : { out: 'refuse', d: -2, e: 'shy', line: '(살짝 빠져나오며) 아직 거기까진 아니에요 ㅎㅎ' },
  kiss: n => {
    if (n.aff >= 80 && performance.now() - BL.t0 > 4000) return { out: 'accept', d: n.bl.kissed ? 2 : 5, e: 'kiss', kiss: 2.6, line: n.bl.kissed ? P_(['…또요? ㅎㅎ 좋아요', '오늘 밤 진짜 이상하다… 좋은 쪽으로요 💗']) : P_(['……. (살짝 웃으며 눈을 감는다) 💋', '이러면 반칙인데… 그래도 좋아요 💗']) };
    if (n.aff >= 60) return { out: 'refuse', d: -1, e: 'shy', line: P_(['앗… 아직은 좀 이른 것 같아요 ㅎㅎ (고개를 살짝 돌린다)', '음~ 그건 조금 더 친해지고요!']) };
    return { out: 'refuse', d: -6, e: 'annoyed', g: 'push', stop: true, line: P_(['어머, 왜 이래요! 천천히 해요.', '잠깐만요, 이건 아니죠.']) };
  },
  deepkiss: n => can(n, 92, true) ? { out: 'accept', d: 4, e: 'kiss', kiss: 3.8, line: P_(['……하아. (한참 뒤에 떨어지며) 숨 막히는 줄 알았어요 💗', '(목에 팔을 감고 놓아주지 않는다) …조금만 더요']) }
    : n.aff >= 80 ? { out: 'refuse', d: -1, e: 'shy', line: '(입술을 손가락으로 막으며) 천천히요~ 우리 아직 첫 키스도 안 했잖아요 ㅎㅎ' } : { out: 'refuse', d: -6, e: 'annoyed', g: 'push', stop: true, line: '갑자기 왜 이래요! 너무 나갔어요.' },
  neck: n => can(n, 88, true) ? { out: 'accept', d: 3, e: 'kiss', line: P_(['……. (어깨를 움츠리며 숨을 고른다) 거기 약한데…', '(작게 웃으며) 간지러워… 하지 마요… 아니, 해요 💗']) }
    : n.aff >= 70 ? { out: 'refuse', d: -2, e: 'shy', line: '꺅 간지러워요 ㅋㅋ 거긴 안 돼요!' } : { out: 'refuse', d: -6, e: 'annoyed', g: 'push', stop: true, line: '뭐 하는 거예요? 기분 이상해요.' },
  butt: n => can(n, 90, true) ? { out: 'stop', d: -2, e: 'shy', line: '(손을 잡아 허리로 옮기며) 손은 여기요 ㅎㅎ 매너 있는 사람이 더 좋아요~' }
    : { out: 'refuse', d: -10, e: 'annoyed', slap: true, stop: true, line: P_(['지금 뭐 하는 거예요?! 손 치워요!', '와… 진짜 실망이에요.']) },
  chest: n => can(n, 92, true) ? { out: 'stop', d: -4, e: 'annoyed', line: '(손목을 탁 잡으며) 거기까지예요. 분위기 깨지 마요.' }
    : { out: 'refuse', d: -15, e: 'annoyed', slap: true, stop: true, line: P_(['미쳤어요?! 동의 없이 만지는 건 진짜 아니에요!', '선 넘었어요. 저 기분 너무 나빠요.']) },
  undress: n => n.g.userData.undressed ? { out: 'stop', d: -2, e: 'laugh', line: '(손목을 잡으며) 여기까지만이에요 ㅋㅋ 더는 안 돼요~' }
    : can(n, 95, true) && !n.g.userData.vrm ? { out: 'accept', d: 2, e: 'shy', strip: true, line: U.pick(['…진짜 못 말려. (두 팔을 들어 준다) 겉옷만이에요? 💗', '(작게 웃으며 팔을 든다) 다른 사람들 보면 어떡해요… ㅎㅎ']) }
    : can(n, 90, true) ? { out: 'stop', d: -3, e: 'laugh', line: '(두 손으로 손목을 붙잡으며) 여기서요? ㅋㅋㅋ 선 넘지 마요~ 대신 한 곡 더 춰 줄게요' }
    : { out: 'refuse', d: -15, e: 'annoyed', slap: true, stop: true, line: P_(['지금 제 옷에 손대신 거예요?! 진짜 어이없네요.', '하… 저 그런 사람 아니에요.']) },
};
const ACT = {   // v40 실제 사람 타이밍으로 조정(다가가는 시간·닿는 순간·머무는 시간) · 동작 길이(초) · 반응 시점(초) · 서로 더 붙는 정도(m) · flip: 상대가 돌아섬(백허그) · spin: 상대 회전
  whisper: { dur: 3.4, hit: 1.1, close: .07, desc: '👂 귀에 입술을 가까이 대고 속삭인다' },
  waist: { dur: 3.4, hit: .9, close: .09, desc: '🤲 허리를 감싼 손으로 몸을 바짝 끌어당긴다' },
  spin: { dur: 3.0, hit: 1.7, close: 0, spin: true, desc: '💫 손을 들어 올려 한 바퀴 돌린다' },
  dip: { dur: 4.2, hit: 1.5, close: .08, desc: '💃 허리를 받치고 뒤로 천천히 눕힌다' },
  forehead: { dur: 4.0, hit: 1.3, close: .11, desc: '💗 이마를 살며시 맞댄다' },
  cheek: { dur: 3.0, hit: 1.0, close: .07, desc: '😚 볼에 가볍게 입을 맞춘다' },
  hug: { dur: 4.0, hit: .9, close: .08, desc: '🤗 두 팔로 꼭 끌어안는다' },
  backhug: { dur: 4.6, hit: 1.5, close: .11, flip: true, desc: '🫂 살짝 돌려 세우고 뒤에서 끌어안는다' },
  kiss: { dur: 4.0, hit: 1.25, close: .07, desc: '💋 한 손으로 볼을 감싸며 입을 맞추려 한다' },
  deepkiss: { dur: 5.0, hit: 1.0, close: .06, desc: '🔥 두 손으로 얼굴을 감싸고 깊게 입을 맞추려 한다' },
  neck: { dur: 3.6, hit: 1.1, close: .08, desc: '💋 고개를 숙여 목덜미에 입술을 댄다' },
  butt: { dur: 2.8, hit: 1.15, close: .09, desc: '🍑 허리에 있던 손을 등을 따라 엉덩이로 내린다' },
  chest: { dur: 2.8, hit: 1.15, close: 0, desc: '🫳 손을 옆구리를 따라 가슴 쪽으로 올린다' },
  undress: { dur: 3.4, hit: 1.25, close: 0, desc: '👚 옷자락을 잡고 위로 천천히 올린다' },
  dress: { dur: 2.4, hit: .9, close: 0, desc: '👕 벗겨진 겉옷을 다시 입혀 준다' },
};
function bluesCancel() {   // v39 동작 중 취소/전환: 진행 중인 반응·종료 타이머를 지우고 자세는 부드럽게 블루스 홀드로 복귀
  (BL.tm || []).forEach(clearTimeout); BL.tm = []; const P = NC.player; BL.busy = false; BL.act = null; if (P.group) P.group.userData.bAct = null; if (BL.n) BL.n.g.userData.bAct = null; BL.kiss = 0;
}
function bluesAct(kind, forced) {
  if (BL.busy) bluesCancel();
  const n = BL.n; if (!n) return; const D = NC.Dialog, P = NC.player, r = forced || REACT[kind](n), a = ACT[kind], t0 = performance.now(); BL.tm = BL.tm || [];
  const dur = r.kiss ? Math.max(a.dur, r.kiss + a.hit + .6) : a.dur;
  BL.busy = true; BL.act = { k: kind, t0, dur, close: r.out === 'refuse' && !r.kiss ? Math.min(a.close, .03) : a.close, flip: a.flip && r.out === 'accept', spin: a.spin, hit: a.hit };
  P.group.userData.bAct = { k: kind, t0, dur, out: r.out, hit: a.hit }; n.g.userData.bAct = { k: kind, t0, dur, out: r.out, hit: a.hit };
  D.sys(a.desc); D.chips();
  BL.tm.push(setTimeout(() => {                                    // 상대 반응
    if (BL.n !== n) return;
    if (r.kiss) { BL.kiss = r.kiss; BL.kissDur = r.kiss; BL.deep = kind === 'deepkiss'; n.bl.kissed = true; }
    if (r.strip && NC.Avatar.undress(n.g, true)) { NC.ui.toast(`👚 ${n.name}의 겉옷이 벗겨졌어요 — 부르스가 끝나면 다시 입어요`); }
    if (r.redress) NC.Avatar.undress(n.g, false);
    if (r.slap) { n.g.userData.bAct = null; NC.Motion.play(n.g, 'slap'); setTimeout(() => { NC.Motion.play(P.group, 'flinch'); P.group.userData.setExpr && P.group.userData.setExpr('sad', 2); }, 330); }
    else if (r.g) { n.g.userData.bAct = null; NC.Motion.play(n.g, r.g); }
    if (r.out === 'accept') { n.g.userData.setExpr && n.g.userData.setExpr(r.e === 'kiss' ? 'kiss' : r.e, (dur - a.hit) + .5); P.group.userData.setExpr && P.group.userData.setExpr(r.e === 'kiss' ? 'kiss' : 'smile', (dur - a.hit) + .3); }
    aff(n, r.d); D.npcSay(r.line, r.e === 'kiss' ? 'shy' : r.e); if (r.slap) { n.bl.warned++; NC.ui.toast(`💔 ${n.name}: 호감도 ${r.d} — 상대가 원하지 않는 스킨십은 역효과예요`); }
  }, a.hit * 1000));
  BL.tm.push(setTimeout(() => {                                    // 동작 종료
    BL.busy = false; BL.act = null; P.group.userData.bAct = null; n.g.userData.bAct = null; if (BL.n !== n) return;
    if (r.stop) { const w = BL.where; endBlues('refuse'); if (n.aff < 25 || n.bl.warned >= 2) (w === 'karaoke' ? guestLeave : clubLeave)(n, U.pick(['저 먼저 갈게요. 즐거우세요.', '저 친구들한테 갈게요.'])); }
    else D.chips();
  }, (r.slap ? a.hit + 1.0 : dur) * 1000));
}
/* ───── v19 회원 전용 프리미엄 로맨스 (노래방 블루스 중, 각 🪙500 · 상대가 항상 받아 줌) ─────
 *  로맨틱 딥 & 키스 · 이마 키스 · 백허그 슬로댄스 · 달콤한 키스 · 소파에 기대 쉬기 · 러브샷 · 장미 꽃다발 · 손편지 고백 · 커플링 · 커플 사진
 *  손님(비로그인)은 🔒 표시 + 회원가입 안내 */
const PREMIUM_COST = 500;
const PREMIUM = [['로맨틱 딥 & 키스', 'dipKiss'], ['이마 키스', 'foreKiss'], ['백허그 슬로댄스', 'backhugLong'], ['달콤한 키스', 'sweetKiss'], ['소파에 기대 쉬기', 'sofa'],
  ['러브샷', 'loveshot'], ['장미 꽃다발', 'rose'], ['손편지 고백', 'letter'], ['커플링 맞추기', 'ring'], ['커플 사진', 'photo']];
const hearts = (g, n = 10, emo = ['💕', '💖', '❤️', '💗']) => { const F = NC.Features && NC.Features.fx; if (!F) return; const p = g.position; for (let k = 0; k < n; k++) setTimeout(() => F.floatEmoji(p.x, p.y + 2.1, p.z, U.pick(emo)), k * 110);
  F.burst(p.x, p.y + 1.9, p.z, { n: 60, colors: ['#ff5fa8', '#ff9ad0', '#ffffff', '#ffd23d'], up: 1.3, spread: .9, life: 1.6, size: .05, g: .6 }); };
const toss = (from, to, emo, done) => { const F = NC.Features && NC.Features.fx; if (!F) return done && done(); const sp = F.emojiSprite(emo, .32); NC.scene.add(sp); const a = from.position.clone(), b = to.position.clone(); a.y += 1.35; b.y += 1.35; const t0 = performance.now();
  const tick = () => { const k = Math.min(1, (performance.now() - t0) / 850); sp.position.lerpVectors(a, b, k); sp.position.y += Math.sin(k * Math.PI) * .45; if (k < 1) requestAnimationFrame(tick); else { NC.scene.remove(sp); done && done(); } }; requestAnimationFrame(tick); };
const give = (n, kind, emo, done) => NC.Couple ? NC.Couple.handoff(n, kind, done) : toss(NC.player.group, n.g, emo, done);   // v39 실제 3D 소품을 손에서 손으로
const yes = (line, e = 'shy', d = 4, extra = {}) => Object.assign({ out: 'accept', d, e, line }, extra);
function premium(kind) {
  const n = BL.n, P = NC.player, D = NC.Dialog; if (!n || BL.busy) return;
  if (!NC.account) return NC.ui.modal('<h3>🔒 회원 전용 프리미엄 로맨스</h3><p style="font-size:13px;line-height:1.6">로그인한 회원만 이용할 수 있어요.<br>처음 화면의 <b>회원가입</b> 탭에서 1분이면 가입돼요 — 코인도 회원 정보에 저장돼요.</p>', [['확인', 0]]);
  if (!(K.inRoom || BL.where === 'karaoke')) return NC.ui.toast('🎤 노래방 안에서만 쓸 수 있어요');
  if (!NC.Wallet.spend(PREMIUM_COST)) return NC.ui.toast(`🪙 ${PREMIUM_COST} 코인이 필요해요 (지금 ${NC.Wallet.get()})`);
  NC.ui.toast(`💎 프리미엄 로맨스 · 🪙-${PREMIUM_COST}`);
  const after = (ms, f) => setTimeout(() => { if (BL.n === n || kind === 'sofa') f(); }, ms);
  switch (kind) {
    case 'dipKiss': bluesAct('dip', yes(U.pick(['꺅… (목에 팔을 감으며) 이대로 멈춰 줘요 💗', '(눈을 감고 기대며) 놓치면 안 돼요…']), 'laugh', 4));
      after(ACT.dip.dur * 1000 + 200, () => { bluesAct('kiss', yes(U.pick(['……💋 영화 속 한 장면 같아요', '(수줍게 웃으며) 오늘 밤 잊지 못할 것 같아요 💗']), 'kiss', 5, { kiss: 3 })); after(1400, () => hearts(n.g, 12)); }); break;
    case 'foreKiss': bluesAct('forehead', yes(U.pick(['(눈을 감고 미소 짓는다) …이마 키스가 제일 설레요', '헤헤… 소중히 대해 주는 느낌이에요 💗']), 'shy', 4)); after(1200, () => hearts(n.g, 8)); break;
    case 'backhugLong': bluesAct('backhug', yes(U.pick(['(손을 포개며) 노래 끝날 때까지 이대로 있어요…', '뒤에서 안아 주니까 세상에 둘만 있는 것 같아요 💗']), 'shy', 5)); after(1600, () => hearts(n.g, 8)); break;
    case 'sweetKiss': bluesAct('kiss', yes(U.pick(['……💋 (볼이 빨개진다)', '(살짝 웃으며 한 번 더 다가온다) 💗']), 'kiss', 5, { kiss: 3.2 })); after(1300, () => hearts(n.g, 12)); break;
    case 'sofa': {   // 블루스를 마치고 소파에 나란히 앉아 그녀가 어깨에 기댐
      endBlues('stop'); NC.ui.fade(() => { const si = 1, sj = 2; occ.forEach((o, k) => { if (o === n || o === 'me') occ[k] = null; }); occ[si] = 'me'; occ[sj] = n;
        NC.sitPlayer({ kind: 'karaoke', s: si }, SEATS[si]); const s2 = SEATS[sj]; n.x = s2.x; n.z = s2.z; NC.NPC.sit(n, s2.x, s2.z, s2.ry, s2.h); n.g.userData.lookAt = P.group.position;
        if (NC.Couple) NC.Couple.sofa(n, 14); else { const fig = n.g.userData.fig; if (fig) { fig.rotation.z = .16; setTimeout(() => { fig.rotation.z = 0; }, 14000); } }   // v39 머리를 어깨에 기대고 팔로 어깨 감싸기
        n.aff = U.clamp(n.aff + 4, 0, 100); setTimeout(() => { if (!D.cur) D.open(n, { intro: U.pick(['(어깨에 머리를 기대며) …잠깐만 이러고 있어도 돼요?', '여기 앉으니까 노래 소리가 멀게 들려요… 좋다 💗']) }); hearts(n.g, 8); }, 700); }); break; }
    case 'loveshot': D.sys('🥂 팔을 걸고 러브샷!'); if (NC.Couple) NC.Couple.loveshot(n, 3.4); else { NC.Motion.play(P.group, 'cheers'); NC.Motion.play(n.g, 'cheers'); after(900, () => { NC.Motion.play(P.group, 'drink'); NC.Motion.play(n.g, 'drink'); }); } after(2200, () => { aff(n, 4); D.npcSay(U.pick(['ㅋㅋㅋ 러브샷 진짜 오랜만이에요!', '(얼굴이 빨개지며) 술 때문이에요… 아마도 💗']), 'laugh'); hearts(n.g, 6, ['🥂', '💕', '✨']); }); break;
    case 'rose': D.sys('🌹 등 뒤에 숨겼던 장미 꽃다발을 건넨다'); NC.Motion.play(P.group, 'bow');
      give(n, 'rose', '💐', () => { NC.Motion.play(n.g, 'shy'); aff(n, 4); D.npcSay(U.pick(['어머… 꽃이요? 진짜 감동이에요 ㅠㅠ 💗', '(꽃다발에 얼굴을 묻으며) 향기 너무 좋다…']), 'shy'); hearts(n.g, 12, ['🌹', '💕', '💖']); }); break;
    case 'letter': NC.ui.modal('<h3>💌 손편지 쓰기</h3><textarea id="loveLetter" rows="4" style="width:100%;box-sizing:border-box;border-radius:10px;padding:8px;background:#241148;color:#fff;border:1px solid #6b4bc0" maxlength="200" placeholder="오늘 처음 봤는데…"></textarea>', [['💌 건네기', 'ok', true], ['취소', 0]])
      .then(r => { const t = r.root && r.root.querySelector('#loveLetter'), txt = (t && t.value.trim()) || '오늘 당신을 만나서 행복했어요.'; if (r.val !== 'ok') { NC.Wallet.add(PREMIUM_COST, '손편지 취소 환불'); return; }
        D.sys(`💌 "${txt.slice(0, 80)}${txt.length > 80 ? '…' : ''}"`); give(n, 'letter', '💌', () => { NC.Motion.play(n.g, 'think'); after(1500, () => { NC.Motion.play(n.g, 'shy'); aff(n, 5); D.npcSay(U.pick(['(편지를 꼭 쥐며) …이거 집에 가서 몇 번이고 읽을 거예요', '손편지라니… 반칙이에요 ㅠㅠ 💗']), 'shy'); hearts(n.g, 10); }); }); }); break;
    case 'ring': D.sys('💍 작은 상자를 열어 커플링을 끼워 준다'); give(n, 'ring', '💍', () => { NC.Motion.play(n.g, 'cheer'); NC.Motion.play(P.group, 'cheer'); aff(n, 6);
      D.npcSay(U.pick(['꺄… 커플링이요?! 오늘부터 1일이에요? 💍💗', '(손가락을 들어 반짝이는 반지를 본다) …예쁘다']), 'laugh'); hearts(n.g, 14, ['💍', '💖', '✨']); }); break;
    case 'photo': D.sys('📸 볼을 맞대고 커플 사진 찰칵!'); bluesAct('cheek', yes('김치~ 📸 (볼을 맞대고 브이)', 'laugh', 3));
      after(1300, () => { const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.9;z-index:80;transition:opacity .5s;pointer-events:none'; document.body.appendChild(f); setTimeout(() => { f.style.opacity = 0; setTimeout(() => f.remove(), 500); }, 80);
        const b = document.getElementById('cpPhoto'); if (b) setTimeout(() => b.click(), 300); hearts(n.g, 6, ['📸', '💕']); }); break;
  }
}
const CHIPS = [['👂 귓속말', 'whisper'], ['🤲 허리 끌어당기기', 'waist'], ['💫 한 바퀴 돌리기', 'spin'], ['💃 뒤로 눕히기(딥)', 'dip'], ['💗 이마 맞대기', 'forehead'], ['😚 볼 뽀뽀', 'cheek'],
  ['🤗 꼭 안아 주기', 'hug'], ['🫂 백허그', 'backhug'], ['💋 키스하기', 'kiss']];   // v19: 신체 접촉·탈의 옵션은 제거
NC.dialogChipsOverride = (n, CHIP) => {
  if (BL.n !== n) return false;
  if (BL.busy) CHIP('⏹ 지금 동작 멈추기', () => { bluesCancel(); NC.Dialog.chips(); });   // v39 동작 중에도 다른 동작으로 바로 전환 가능
  CHIPS.forEach(([l, k]) => CHIP(l, () => bluesAct(k), k === 'kiss' ? 'pri' : ''));
  if (n.g.userData.undressed) CHIP('👕 옷 다시 입혀 주기', () => bluesAct('dress'));
  if (BL.where === 'karaoke' || K.inRoom) PREMIUM.forEach(([l, k]) => CHIP(`${NC.account ? '💎' : '🔒'} ${l} 🪙${PREMIUM_COST}`, () => premium(k)));
  CHIP('⏹ 브루스 그만', () => endBlues('stop'));
  return true;
};
(NC.dialogChips = NC.dialogChips || []).push((n, CHIP) => {
  if (BL.n) return; const P = NC.player;
  if (K.inRoom) { if (!isGuest(n)) return;
    CHIP('🕺 브루스 추실래요?', () => startBlues(n), 'pri');
    CHIP('🎤 한 곡 불러 줄래요?', () => { NC.Dialog.close('bye'); K.companion = n; npcSing(); });
    CHIP('🙋 웨이터 부르기', () => callWaiter()); return; }
  if (n.role === 'persona' || n.role === 'crowd' || n.role === 'guest' || n.booked) CHIP('🕺 브루스 추실래요?', () => startBlues(n), 'pri');   // v28 어느 장소에서나(앉아 있어도 함께 일어나서)
});
NC.on('dialog:close', n => { if (BL.n && BL.n === n) endBlues('stop'); });
const sm = (a, b, x) => U.clamp((x - a) / (b - a), 0, 1);
NC.tickers.push(dt => {
  if (!BL.n) return; const n = BL.n, P = NC.player; BL.t += dt; if (BL.kiss > 0) BL.kiss -= dt;
  const kd = BL.kissDur, k = BL.kiss > 0 ? Math.min(1, (kd - BL.kiss) / .55, BL.kiss / .55) : 0, A = BL.act, ae = A ? (performance.now() - A.t0) / 1000 : 0,
    cl = A ? A.close * Math.min(1, ae / .7, Math.max(0, (A.dur - ae) / .7)) : 0, a = .28 * Math.sin(BL.t * .35) * (A ? .3 : 1), d = .215 - .05 * k - cl, c = BL.c;
  P.group.userData.kissK = n.g.userData.kissK = k; P.group.userData.kissDeep = n.g.userData.kissDeep = BL.deep && k > 0;
  P.x = c.x - Math.cos(a) * d; P.z = c.z - Math.sin(a) * d; n.x = c.x + Math.cos(a) * d; n.z = c.z + Math.sin(a) * d;
  if (BL.s0 && BL.t < 1.4) { const q = BL.t / 1.4, k2 = q * q * (3 - 2 * q), S0 = BL.s0; P.x = U.lerp(S0.px, P.x, k2); P.z = U.lerp(S0.pz, P.z, k2); n.x = U.lerp(S0.nx, n.x, k2); n.z = U.lerp(S0.nz, n.z, k2); P.group.userData.moving = n.g.userData.moving = q < .85; } else if (BL.s0) { BL.s0 = null; P.group.userData.moving = n.g.userData.moving = false; }
  P.ry = Math.atan2(n.x - P.x, n.z - P.z); P.group.rotation.y = P.ry;
  let ny = P.ry + Math.PI;
  if (A && A.flip) ny += Math.PI * sm(.3, 1.1, ae) * (1 - sm(A.dur - .9, A.dur - .1, ae));           // 백허그: 상대가 돌아섰다가 다시 마주 봄
  if (A && A.spin) ny += Math.PI * 2 * sm(.5, A.hit + .2, ae) * (ae < A.hit + .2 ? 1 : 1);          // 턴: 한 바퀴
  n.g.rotation.y = ny;
  P.group.position.set(P.x, NC.groundY(P.x, P.z), P.z); n.g.position.set(n.x, NC.groundY(n.x, n.z), n.z);
});
$('#kCall').onclick = () => callWaiter();
K.G = G; K.dims = { KX, KZ, HX, HZ, H }; K.playSong = (song, mode) => play(song, mode); K.stopSong = () => stop(true); K.callWaiter = callWaiter; K.startBlues = startBlues; K.endBlues = endBlues; K.BL = BL; K.ACT = ACT; K.bluesAct = (k, f) => bluesAct(k, f);

/* 상호작용 후보 */
NC.interactProviders.push(() => {
  const P = NC.player, out = []; if (!P.group) return out;
  if (!K.inRoom) return out;   // v25 클럽 안 노래방 입구 없음(VIP 문은 viprooms.js · 노래방은 밖 건물)
  const de = Math.hypot(P.x - EXIT.x, P.z - EXIT.z); if (de < 1.6) out.push({ label: K.mode === 'vip' ? `🚪 ${K.label} 나가기 (E)` : '🚪 방에서 나가기 (E)', dist: de, run: leave });
  const dt = Math.hypot(P.x - KX, P.z - (KZ - 2.6)); if (dt < 2.2 && !K.playing) out.push({ label: '🎵 노래 고르기 (E)', dist: dt + .2, run: () => { renderList(); panelState(); panel.style.display = 'flex'; } });
  SEATS.forEach((s, i) => { const d = Math.hypot(P.x - s.x, P.z - s.z); if (d < 1.3 && !occ[i] && !K.playing) out.push({ label: '🛋 소파에 앉기 (E)', dist: d + .3, run: () => NC.ui.fade(() => { occ[i] = 'me'; NC.sitPlayer({ kind: 'karaoke', s: i }, s); }) }); });
  const n = K.companion; if (n && n.state === 'seated') { const d = Math.hypot(P.x - n.x, P.z - n.z); if (d < 2.4) out.push({ label: `💬 ${n.name}와 대화 (E)`, dist: d + .1, run: () => NC.Dialog.open(n, { intro: U.pick(['여기 분위기 너무 좋다~ 다음 곡 뭐 할래요?', '노래방 오니까 신나요 ㅎㅎ', '목 좀 풀었어요? 저 다음에 부를래요!']) }) }); }
  K.guests.forEach(g => { if (g === n || g.state !== 'seated') return; const d = Math.hypot(P.x - g.x, P.z - g.z); if (d < 2.4) out.push({ label: `💬 ${g.name}와 대화 (E)`, dist: d + .1, run: () => NC.Dialog.open(g, { intro: U.pick(['노래 한 곡 하실래요? 아니면 저랑 얘기해요 ㅎㅎ', '여기 맥주 시원하다~ 짠 할래요?', '부킹으로 노래방은 처음이에요 ㅋㅋ 재밌네요']) }) }); });
  return out;
});

/* 카메라: 노래 중엔 시네마틱 2컷 교차 */
NC.camOverride = () => {
  if (BL.n) { const c = BL.c, a = Math.sin(performance.now() / 7000) * .3, gy = NC.groundY(c.x, c.z), A = BL.act, far = A && (A.k === 'dip' || A.k === 'spin') ? 2.7 : 2.2; return { cx: c.x + Math.sin(a) * far - .5, cy: gy + 1.65, cz: c.z + Math.cos(a) * far, tx: c.x - .5, ty: gy + 1.25, tz: c.z }; }
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
