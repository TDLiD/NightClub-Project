/* outside.js — v25 나이트 밖: 🚪 클럽 출입구 → 🌃 거리 → 🎤 별빛 노래방(별도 건물)
 *  ■ 클럽 출입구: 부킹 통로 동쪽 끝 벽(EXIT 네온) → 나이트 앞 거리
 *  ■ 거리: 나이트 건물 정문 · 맞은편 「별빛 노래방」 건물 · 가로등 · 주차된 차 · 밤하늘
 *  ■ 노래방 카운터(로비): 사장님 「미숙 이모」 — 💬 얘기하기(스토리) · 🔑 방 배정받기 · 🍺 술 주문하기 · 💬 함께 온 손님과 대화
 *     로비에 들어설 때마다 랜덤 에피소드(취객 아저씨 · 생일 파티 · 치킨 배달 · 커플 싸움)
 *  ■ 방: karaoke.js 프라이빗 룸을 '노래방 모드'로 — 웨이터(사장님) 호출 · 부킹 · 대화, 카운터에서 미리 주문한 술은 방으로 배달
 *  ■ 부킹 대화 칩 「🎤 노래방 갈래요?」: 상대가 승낙하면 함께 노래방 로비로 이동(같이 다니며 방에 함께 들어감)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world || !NC.Rooms || !NC.Rooms.make) return;
const T = NC.THREE, S = NC.scene, M = NC.mat, U = NC.util, col = NC.col, W = NC.world, Mo = NC.Motion, R_ = NC.Rooms;
const box = (w, h, d) => new T.BoxGeometry(w, h, d), P = () => NC.player;
const say = (g, t, s = 2.6) => NC.bubble && NC.bubble(g, t, s);

/* ═════ 1. 클럽 출입구 (부킹 통로 동쪽 끝 벽) ═════ */
const EX = { x: W.ROOM ? W.ROOM.x : 24, z: W.corridorY || 10.75 };
const ENT = { x: 22.4, z: EX.z, ry: -Math.PI / 2 };
{ const ex = 24 - .06;
  const frame = new T.Mesh(box(.2, 3.2, 2.6), M.std('#d9b056', { roughness: .22, metalness: 1 })); frame.position.set(ex, 1.6, EX.z); S.add(frame);
  const door = new T.Mesh(new T.PlaneGeometry(2.2, 2.9), M.std('#151018', { roughness: .3, metalness: .5 })); door.position.set(ex - .12, 1.45, EX.z); door.rotation.y = -Math.PI / 2; S.add(door);
  const bar = new T.Mesh(box(.06, .06, 1.6), M.std('#e8e8f0', { roughness: .1, metalness: 1 })); bar.position.set(ex - .2, 1.15, EX.z); S.add(bar);
  const sg = NC.neonSign('EXIT · 출입구', 2.6, .6, { font: '900 110px "Malgun Gothic",sans-serif', color: '#e9fff0', glow: '#3dff8a', ph: 200 }); sg.material.color.setScalar(2.2); sg.position.set(ex - .14, 3.55, EX.z); sg.rotation.y = -Math.PI / 2; S.add(sg);
  const ks = NC.neonSign('🎤 맞은편 별빛 노래방', 2.4, .45, { font: '800 90px "Malgun Gothic",sans-serif', color: '#fff2fb', glow: '#ff3dbb', ph: 160 }); ks.material.color.setScalar(2); ks.position.set(ex - .14, 3.05, EX.z); ks.rotation.y = -Math.PI / 2; S.add(ks);
  W.rects.push([ex - .1, EX.z - 1.3, 24, EX.z + 1.3]); }

/* ═════ 2. 거리 ═════ */
const ST = R_.make('street', '🌃 나이트 앞 거리', 200, 0, 14, 8, 9);
ST.enterMsg = '🌃 나이트 밖으로 나왔어요 — 길 건너 「🎤 별빛 노래방」 건물로 가 보세요';
{
  const asphalt = M.pbr ? M.pbr('speckle', { repeat: [8, 5], roughness: 1, gen: { a: '#1a1a1e' } }) : M.std('#1a1a1e');
  const sky = new T.MeshBasicMaterial({ color: 0x0a0c1e });
  const wallFar = M.std('#141220', { roughness: .9 });
  R_.shell(ST, asphalt, wallFar, sky);
  // 별
  { const pts = []; for (let i = 0; i < 160; i++) pts.push((Math.random() - .5) * 27, 8.9, (Math.random() - .5) * 15); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts.map((v, i) => i % 3 === 0 ? v + ST.cx : i % 3 === 2 ? v + ST.cz : v), 3));
    const st = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: .06, transparent: true, opacity: .8 })); ST.G.add(st); }
  // 보도(양쪽) + 중앙선
  const walk = M.std('#3a3640', { roughness: .85 });
  for (const s of [-1, 1]) { ST.add(new T.Mesh(box(28, .15, 3.2), walk), 0, .075, s * 6.4); ST.add(new T.Mesh(box(28, .16, .12), M.std('#8a8690', { roughness: .6 })), 0, .08, s * 4.8); }
  for (let x = -12; x <= 12; x += 3) ST.add(new T.Mesh(box(1.6, .01, .12), M.emi('#f2e6a0', 1.2)), x, .012, 0);
  // 나이트 건물 정면(북쪽 벽) — 정문 + 대형 네온
  const club = M.std('#1c1426', { roughness: .7 });
  ST.add(new T.Mesh(box(28, 8.6, .4), club), 0, 4.3, -7.8);
  const nb = NC.neonSign('추억의 나이트', 9, 1.8, { font: '900 160px "Malgun Gothic",sans-serif', color: '#ffe3f3', glow: '#ff3d9a', ph: 230 }); nb.material.color.setScalar(2.4); nb.position.set(ST.cx, 5.6, ST.cz - 7.55); ST.G.add(nb);
  ST.add(new T.Mesh(box(3.2, 3.4, .3), M.std('#d9b056', { roughness: .22, metalness: 1 })), 0, 1.7, -7.55);
  ST.add(new T.Mesh(new T.PlaneGeometry(2.6, 3.0), M.std('#0e0a12', { roughness: .2, metalness: .6 })), 0, 1.5, -7.38);
  for (let x = -12; x <= 12; x += 1.2) if (Math.abs(x) > 2) ST.add(new T.Mesh(new T.SphereGeometry(.06, 8, 6), M.glow('#ffd88a')), x, 3.9, -7.55);
  // 별빛 노래방 건물(남쪽) — 간판 · 유리문 · 창문 불빛
  const kb = M.std('#20182c', { roughness: .7 });
  ST.add(new T.Mesh(box(28, 8.6, .4), kb), 0, 4.3, 7.8);
  const ks = NC.neonSign('🎤 별빛 노래방', 8, 1.6, { font: '900 150px "Malgun Gothic",sans-serif', color: '#fff2fb', glow: '#ff3dbb', ph: 230 }); ks.material.color.setScalar(2.4); ks.position.set(ST.cx + 3, 5.8, ST.cz + 7.55); ks.rotation.y = Math.PI; ST.G.add(ks);
  const kd = NC.neonSign('24시 · 단체 환영 · 최신곡 완비', 5.4, .6, { font: '800 80px "Malgun Gothic",sans-serif', color: '#e8fbff', glow: '#3de6ff', ph: 160 }); kd.material.color.setScalar(2); kd.position.set(ST.cx + 3, 4.5, ST.cz + 7.55); kd.rotation.y = Math.PI; ST.G.add(kd);
  ST.add(new T.Mesh(box(2.8, 3.2, .3), M.std('#c8a0ff', { roughness: .2, metalness: .8 })), 3, 1.6, 7.55);
  ST.add(new T.Mesh(new T.PlaneGeometry(2.3, 2.8), new T.MeshStandardMaterial({ color: col('#ffb0e0'), emissive: col('#5a1a4a'), roughness: .05, metalness: .3, transparent: true, opacity: .55 })), 3, 1.4, 7.38).rotation.y = Math.PI;
  for (let i = 0; i < 10; i++) { const w = ST.add(new T.Mesh(new T.PlaneGeometry(1.4, .9), M.glow(i % 3 === 0 ? '#ff7ad1' : i % 3 === 1 ? '#ffd88a' : '#7ad7ff')), -11 + (i % 5) * 4.4 + (i % 5 > 1 ? 2.5 : 0), 6.2 + Math.floor(i / 5) * 1.5, 7.56); w.rotation.y = Math.PI; w.material.color.multiplyScalar(.9); }
  // 가로등
  for (const x of [-9, 9]) for (const z of [-5.6, 5.6]) { ST.add(new T.Mesh(new T.CylinderGeometry(.06, .08, 4.2, 10), M.std('#2a2a30', { metalness: .7, roughness: .4 })), x, 2.1, z); const lamp = ST.add(new T.Mesh(new T.SphereGeometry(.22, 12, 10), M.glow('#ffd9a0')), x, 4.3, z); lamp.material.color.multiplyScalar(3); }
  // 주차된 차
  const car = (x, z, c) => { const b = ST.add(new T.Mesh(box(3.8, .7, 1.7), M.std(c, { roughness: .25, metalness: .7 })), x, .55, z); ST.add(new T.Mesh(box(2.0, .55, 1.5), M.std('#121418', { roughness: .1, metalness: .4 })), x - .2, 1.15, z);
    for (const dx of [-1.2, 1.2]) for (const dz of [-.8, .8]) ST.add(new T.Mesh(new T.CylinderGeometry(.32, .32, .22, 16).rotateX(Math.PI / 2), M.std('#0c0c0e', { roughness: .8 })), x + dx, .32, z + dz);
    ST.add(new T.Mesh(box(.05, .14, .3), M.emi('#fff2c0', 3)), x + 1.92, .62, z - .55); ST.add(new T.Mesh(box(.05, .14, .3), M.emi('#fff2c0', 3)), x + 1.92, .62, z + .55); void b; ST.rects.push([ST.cx + x - 1.95, ST.cz + z - .9, ST.cx + x + 1.95, ST.cz + z + .9]); };
  car(-6.5, -2.4, '#7a1a22'); car(7.5, 2.6, '#1f3a5a'); car(-1, 3.0, '#d8d8dc');
  ST.entry = { x: 0, z: -6.2, ry: 0 }; ST.exit = { x: 0, z: -6.6 };
  ST.clubDoor = { x: 0, z: -6.6 }; ST.karaokeDoor = { x: 3, z: 6.6 };
}

/* ═════ 3. 별빛 노래방 로비(카운터) ═════ */
const KL = R_.make('klobby', '🎤 별빛 노래방 카운터', 200, 40, 6, 4.5, 3.2);
KL.enterMsg = '🎤 별빛 노래방에 들어왔어요 — 카운터의 사장님께 말을 걸어 보세요';
{
  const floor = M.pbr ? M.pbr('marble', { repeat: [3, 3], roughness: .5, env: 1.2, gen: { a: '#2a1a34', b: '#7a5a9a', tiles: 3 } }) : M.std('#2a1a34');
  const wall = M.pbr ? M.pbr('tufted', { repeat: [6, 2], color: '#3a1a4a', roughness: 1 }) : M.std('#3a1a4a');
  R_.shell(KL, floor, wall, M.std('#140c1c', { roughness: .9 }));
  // 카운터
  KL.add(new T.Mesh(box(3.6, 1.1, .7), M.pbr ? M.pbr('wood', { repeat: [2, 1], roughness: .5, gen: { a: '#2a1410', b: '#6a3a22' } }) : M.std('#4a2a1a')), -1.2, .55, -2.6);
  KL.add(new T.Mesh(box(3.7, .05, .8), M.std('#f0e8f4', { roughness: .15, metalness: .2 })), -1.2, 1.12, -2.6);
  KL.add(new T.Mesh(box(3.6, .04, .04), M.emi('#ff5fc8', 3.5)), -1.2, .95, -2.24);
  KL.rects.push([KL.cx - 3.0, KL.cz - 4.5, KL.cx + .6, KL.cz - 2.2]);
  // 계산기·마이크 바구니·사탕 그릇
  KL.add(new T.Mesh(box(.3, .06, .22), M.std('#20202a', { roughness: .4 })), -.5, 1.18, -2.6); KL.add(new T.Mesh(new T.CylinderGeometry(.14, .1, .1, 14), M.std('#f4f4f6', { roughness: .2 })), -2.2, 1.2, -2.55);
  // 요금표 네온 · 룸 안내
  const menu = NC.neonSign('일반룸 🪙10 · 파티룸 🪙25 · VIP룸 🪙40', 5, .55, { font: '800 80px "Malgun Gothic",sans-serif', color: '#fff6c8', glow: '#ffb800', ph: 160 }); menu.material.color.setScalar(2); menu.position.set(KL.cx - .5, 2.55, KL.cz - 4.45); KL.G.add(menu);
  const rs = NC.neonSign('ROOMS ▶', 1.8, .5, { font: '900 110px Arial', color: '#fff', glow: '#3de6ff', ph: 200 }); rs.material.color.setScalar(2.2); rs.position.set(KL.cx + 5.95, 2.5, KL.cz - 1.5); rs.rotation.y = -Math.PI / 2; KL.G.add(rs);
  KL.add(new T.Mesh(box(.1, 2.6, 1.6), M.std('#d9b056', { roughness: .22, metalness: 1 })), 5.95, 1.3, -1.5);
  // 대기 소파 · 미러볼 · 출입문
  KL.add(new T.Mesh(box(2.8, .45, .7), M.pbr ? M.pbr('leather', { repeat: [2, 1], color: '#7a1f3d', roughness: 1 }) : M.std('#7a1f3d')), -3.6, .23, 3.9); KL.add(new T.Mesh(box(2.8, .6, .2), M.std('#7a1f3d', { roughness: .7 })), -3.6, .7, 4.25); KL.rects.push([KL.cx - 5.0, KL.cz + 3.4, KL.cx - 2.2, KL.cz + 4.5]);
  const ball = KL.add(new T.Mesh(new T.IcosahedronGeometry(.32, 2), M.std('#f2f2fa', { metalness: 1, roughness: .05, flatShading: true })), 1.5, 2.7, .5); KL.ball = ball;
  KL.add(new T.Mesh(box(2.0, 2.8, .1), M.std('#c8a0ff', { roughness: .2, metalness: .8 })), 3, 1.4, 4.45);
  const ex = NC.neonSign('EXIT', 1.0, .35, { font: '900 110px Arial', color: '#e9fff0', glow: '#3dff8a', ph: 200 }); ex.material.color.setScalar(2.2); ex.position.set(KL.cx + 3, 3.0, KL.cz + 4.4); ex.rotation.y = Math.PI; KL.G.add(ex);
  // 포스터
  ['🎤 이달의 인기곡 TOP 10', '🎂 생일파티 케이크 무료!', '🍺 맥주 2+1'].forEach((t, i) => { const p = new T.Mesh(new T.PlaneGeometry(1.0, 1.3), new T.MeshBasicMaterial({ map: NC.textTex(t, 256, 330, '800 30px "Malgun Gothic",sans-serif', '#ffffff', ['#ff3d9a', '#3d9aff', '#ffb000'][i]) })); p.position.set(KL.cx - 5.95, 1.7, KL.cz - 2 + i * 1.5); p.rotation.y = Math.PI / 2; KL.G.add(p); });
  KL.entry = { x: 3, z: 3.6, ry: Math.PI }; KL.exit = { x: 3, z: 4.0 }; KL.counter = { x: -1.2, z: -1.6 }; KL.roomsDoor = { x: 5.3, z: -1.5 };
}
/* 사장님 아바타 */
let owner = null; const extras = [], walkers = [];
function spawnOwner() {
  if (owner) return; owner = NC.Avatar.create({ name: '사장님 미숙 이모', look: { gender: 'f', hairStyle: 'bob', hairColor: '#2a1a14', top: 'jacket', topColor: '#6a2a4a', inner: 'tee', innerColor: '#f2f0ea', bottom: 'pants', bottomColor: '#2a2430', height: 1.6, face: { lipColor: '#b84a5a', glasses: true } }, seed: U.hash('미숙 이모'), expr: 'smile', labelColor: '#ffb000' });
  owner.position.set(KL.cx - 1.2, 0, KL.cz - 3.2); owner.rotation.y = 0; S.add(owner);
}
function tempAvatar(name, look, x, z, color) { const g = NC.Avatar.create({ name, look, seed: U.hash(name + Date.now()), expr: 'smile', labelColor: color }); g.position.set(x, 0, z); S.add(g); extras.push(g); return g; }
function walk(g, pts, speed, done) { walkers.push({ g, pts: pts.slice(), speed, done }); }
function clearExtras() { extras.forEach(g => S.remove(g)); extras.length = 0; walkers.length = 0; }

/* ═════ 4. 노래방 스토리 · 대화 ═════ */
const KS = { visits: U.store.get('nc_kvisit', 0), talks: 0, orders: [], comp: null, roomNo: null, coupon: false };
const OWNER_TALK = [
  ['🏠 여기 오래 하셨어요?', ['아이고~ 98년에 문 열었으니까 벌써 30년 다 돼 가네. 그땐 이 동네가 전부 나이트 손님이었지 ㅎㅎ', '건너편 나이트 사장님이랑은 오래된 사이야. 거기서 놀다 2차로 다들 여기 오잖아~']],
  ['📈 요즘 장사는 어때요?', ['주말엔 방이 모자라~ 평일엔 회식 손님이랑 연인들이 많고. 오늘은 딱 좋네!', '요즘은 젊은 사람들이 옛날 노래를 더 좋아해. 신기하지? 덕분에 내가 살지 뭐 ㅋㅋ']],
  ['🎵 추천곡 있어요?', ['분위기 띄우려면 무조건 댄스곡 먼저! 발라드는 세 번째 곡쯤이 딱이야~', '같이 온 사람 마음 잡으려면… 듀엣곡이지! 내가 30년 봐 온 비법이야 ㅎㅎ']],
  ['🎁 단골 되면 뭐 줘요?', ['세 번만 와 봐~ 과일 안주 서비스 확실하게 줄게!', '단골은 시간도 서비스야. 이모가 다 기억해 둔다?']],
  ['😅 아까 나이트에서 있었던 일', ['어머 무슨 일? …아이고 담배 한 개비 때문에 싸움까지? 요즘 사람들 왜 그런대~', '나이트에서 부킹 실패했어? 괜찮아~ 노래 한 곡 시원하게 부르면 다 잊혀!']],
];
function ownerMenu() {
  const p = P(); p.busy = true; const done = () => { NC.ui.hideDlg(); p.busy = false; };
  const first = KS.visits <= 1 && !KS.greeted; KS.greeted = true;
  const greet = first ? '어서 와요~ 별빛 노래방이에요! 건너편 나이트에서 왔구나? 거기 손님은 이모가 특별히 잘해 줄게 😊'
    : KS.comp ? `어머 둘이 왔네~ 😍 ${KS.comp.name} 아가씨 너무 예쁘다! 방 줄까?` : U.pick(['또 왔네~ 오늘은 몇 번 방 줄까?', '어서 와요~ 오늘 목 상태는 어때? ㅎㅎ', '혼자 왔어? 혼자 부르는 노래가 제일 신나지~']);
  const opts = [
    { t: '🔑 방 배정받기', run: () => { done(); roomMenu(); } },
    { t: '🍺 술 주문하기', run: () => { done(); orderMenu(); } },
    { t: '💬 사장님과 얘기하기', run: () => { done(); talkMenu(); } },
  ];
  if (KS.comp) opts.push({ t: `💬 ${KS.comp.name}와 대화하기`, run: () => { done(); NC.Dialog.open(KS.comp, { intro: U.pick(['여기 노래방 분위기 좋다~ 몇 번 방이래요?', '저 사실 노래방 엄청 오랜만이에요 ㅎㅎ', '사장님 완전 친절하시다~ 우리 뭐 부를까요?']) }); } });
  opts.push({ t: '👋 나중에 올게요', run: done });
  NC.ui.showDlg({ name: '사장님 미숙 이모', tag: '🎤 별빛 노래방 카운터', job: `🪙 ${NC.Wallet.get()} · 방문 ${KS.visits}회`, say: greet, opts });
  if (owner) { Mo.play(owner, first ? 'bow' : 'wave'); owner.userData.lookAt = p.group.position; }
}
function talkMenu() {
  const p = P(); p.busy = true; const done = () => { NC.ui.hideDlg(); p.busy = false; };
  NC.ui.showDlg({ name: '사장님 미숙 이모', tag: '💬 수다', say: '응~ 뭐가 궁금해? 이모가 다 얘기해 줄게 ㅎㅎ', opts: OWNER_TALK.map(([q, ans]) => ({ t: q, run: () => {
    done(); say(p.group, q.replace(/^\S+\s/, ''), 2); setTimeout(() => { if (owner) { say(owner, U.pick(ans), 4.2); Mo.play(owner, U.pick(['laugh', 'nod', 'point'])); } KS.talks++;
      if (KS.talks === 3 && !KS.coupon) { KS.coupon = true; setTimeout(() => { if (owner) say(owner, '말이 잘 통하네~ 🍉 과일 안주 서비스 하나 넣어 줄게!', 3.2); NC.ui.toast('🎁 사장님 서비스: 과일 안주 쿠폰 (방에 들어가면 배달)'); KS.orders.push({ id: 'fruit', icon: '🍉', name: '서비스 과일 안주', price: 0, alc: 0, prop: 'fruit' }); }, 4400); }
    }, 1800); } })).concat([{ t: '← 돌아가기', run: () => { done(); ownerMenu(); } }]) });
}
const ROOMS = [
  { id: 'normal', name: '일반룸', price: 10, nos: [2, 3, 5], line: '{n}번방 비었네~ 마이크 두 개 다 잘 나와!' },
  { id: 'party', name: '파티룸', price: 25, nos: [7, 8], line: '{n}번 파티룸! 미러볼이랑 탬버린 풀세트야 ㅎㅎ' },
  { id: 'vip', name: 'VIP룸', price: 40, nos: [11], line: '오늘 기분 내는구나? {n}번 VIP룸, 양주 한 잔 서비스!' },
];
function roomMenu() {
  const p = P(); p.busy = true; const done = () => { NC.ui.hideDlg(); p.busy = false; };
  NC.ui.showDlg({ name: '사장님 미숙 이모', tag: '🔑 방 배정', job: `🪙 ${NC.Wallet.get()}`, say: KS.orders.length ? `주문한 거(${KS.orders.map(o => o.icon).join('')})는 방으로 바로 넣어 줄게~ 어떤 방으로 줄까?` : '어떤 방으로 줄까? 1시간 기준이야~',
    opts: ROOMS.map(r => ({ t: `${r.id === 'vip' ? '👑' : r.id === 'party' ? '🪩' : '🎤'} ${r.name}  🪙${r.price}`, run: () => {
      done(); if (!NC.Wallet.spend(r.price)) return NC.ui.toast(`🪙 코인이 부족해요 (${r.price} 필요)`);
      const no = U.pick(r.nos); KS.roomNo = no; if (r.id === 'vip') KS.orders.push({ id: 'whisky', icon: '🥃', name: '서비스 양주 한 잔', price: 0, alc: 2, prop: 'whisky' });
      if (owner) { say(owner, r.line.replace('{n}', no), 3); Mo.play(owner, 'point'); }
      NC.ui.toast(`🔑 ${no}번방(${r.name})을 배정받았어요`);
      setTimeout(() => enterRoom(no, r), 1600);
    } })).concat([{ t: '← 돌아가기', run: () => { done(); ownerMenu(); } }]) });
}
const ORDER = [
  { id: 'beer', icon: '🍺', name: '맥주 세트', price: 12, alc: 1, prop: 'beer' },
  { id: 'soju', icon: '🍶', name: '소주 한 병', price: 8, alc: 1, prop: 'beer' },
  { id: 'fruit', icon: '🍉', name: '모둠 과일 안주', price: 15, alc: 0, prop: 'fruit' },
  { id: 'soda', icon: '🥤', name: '음료수', price: 3, alc: 0, prop: 'soda' },
];
function orderMenu() {
  const p = P(); p.busy = true; const done = () => { NC.ui.hideDlg(); p.busy = false; };
  NC.ui.showDlg({ name: '사장님 미숙 이모', tag: '🍺 주문', job: `🪙 ${NC.Wallet.get()}`, say: '뭐 마실래? 방 들어가면 바로 넣어 줄게~', opts: ORDER.map(it => ({ t: `${it.icon} ${it.name}  🪙${it.price}`, run: () => {
    if (!NC.Wallet.spend(it.price)) return NC.ui.toast(`🪙 코인이 부족해요 (${it.price} 필요)`);
    KS.orders.push(it); NC.ui.toast(`${it.icon} ${it.name} 주문 완료 — 방으로 배달돼요`); if (owner) say(owner, U.pick(['오케이~ 시원~하게!', '잔은 두 개 줄게 ㅎㅎ', '안주는 서비스로 땅콩 조금 더~']), 2.2);
    if (KS.comp) { KS.comp.aff = U.clamp(KS.comp.aff + 1, 0, 100); }
  } })).concat([{ t: '✔ 주문 끝', run: () => { done(); ownerMenu(); } }]) });
}
function enterRoom(no, r) {
  const K = NC.Karaoke; if (!K) return; const comp = KS.comp;
  if (comp) { detachComp(false); }
  K.enter({ mode: 'karaoke', label: `별빛 노래방 ${no}번방${r.id === 'vip' ? ' (VIP)' : r.id === 'party' ? ' (파티룸)' : ''}`, comp: comp || null,
    exit: { x: KL.cx + KL.roomsDoor.x - .8, z: KL.cz + KL.roomsDoor.z, ry: -Math.PI / 2 },
    onLeave: () => { if (comp && comp.enabled && comp.state !== 'off' && !comp.leftRoom) attachComp(comp, true); else KS.comp = null; if (owner) setTimeout(() => say(owner, U.pick(['재밌게 놀았어? 또 와~', '목 괜찮아? 꿀물 한 잔 줄까? ㅎㅎ', '시간 딱 맞춰 나왔네~ 조심히 가!']), 3), 900); } });
  setTimeout(() => { const orders = KS.orders.splice(0); orders.forEach((it, i) => setTimeout(() => K.inRoom && K.serveItem(it), 1500 + i * 900)); }, 1200);
}

/* 함께 온 손님(부킹 상대) — 로비·거리에서 플레이어를 따라다님 */
function attachComp(n, silent) {
  KS.comp = n; n.stay = 'outing'; n.booked = true; n.state = 'escort';   /* escort: npc.js 가 걷기 상태를 건드리지 않음 */ n.karaoke = false; n.enabled = true; n.g.visible = true; n.g.userData.lookAt = P().group.position; n.g.userData.dance = null; if (n.g.userData.seated) NC.unseatAvatar(n.g, n.x, n.z);
  [ST, KL].forEach(R => { if (!R.npcs.includes(n)) R.npcs.push(n); });
  const p = P(); n.x = p.x - .9; n.z = p.z + .4; n.g.position.set(n.x, 0, n.z);
  if (!silent) NC.ui.toast(`💗 ${n.name}님이 함께 가요`);
}
function detachComp(release) {
  const n = KS.comp; if (!n) return; [ST, KL].forEach(R => { const i = R.npcs.indexOf(n); if (i >= 0) R.npcs.splice(i, 1); });
  if (release) { n.stay = null; n.booked = false; n.karaoke = false; n.state = 'wander'; n.x = ENT.x - 1.4; n.z = ENT.z + .6; n.g.position.set(n.x, 0, n.z); n.g.userData.lookAt = null; n.g.userData.moving = false; n.g.visible = true; KS.comp = null; }
}

/* 로비 랜덤 에피소드 */
const EPIS = [
  function drunk() {   // 취객 아저씨가 방에서 비틀대며 나와 한 곡만 더!
    const g = tempAvatar('취한 아저씨', { gender: 'm', hairStyle: 'short', hairColor: '#3a3a3a', top: 'shirt', topColor: '#e8e2d4', bottom: 'pants', bottomColor: '#2a2a30', face: { attractive: false, beard: 'stubble' } }, KL.cx + KL.roomsDoor.x, KL.cz + KL.roomsDoor.z, '#ff9a5a');
    g.userData.drunk = true; say(g, '이모~~ 한 곡만 더!! 딱 한 곡만~ 🎤', 2.6);
    walk(g, [{ x: KL.cx + .6, z: KL.cz - 1.4 }], .9, () => { if (owner) { say(owner, '아이고 김 사장님~ 벌써 세 시간째야! 택시 불러 줄게~', 3.2); Mo.play(owner, 'headshake'); }
      setTimeout(() => { say(g, '…이모 미워… 딸꾹 🥴', 2); walk(g, [{ x: KL.cx + KL.exit.x, z: KL.cz + KL.exit.z }], .8, () => { g.visible = false; }); }, 3400); });
  },
  function birthday() {   // 생일 파티 일행이 케이크 들고 지나가며 같이 노래 불러 달라고
    const g = tempAvatar('생일파티 일행', { gender: 'f', hairStyle: 'long', hairColor: '#4a2a1a', top: 'tee', topColor: '#ff8ab0', bottom: 'skirt', bottomColor: '#2a2430' }, KL.cx + KL.exit.x, KL.cz + KL.exit.z, '#ff8ab0');
    say(g, '🎂 저기요! 친구 생일인데 같이 생일 축하 노래 불러 주실래요?', 3);
    walk(g, [{ x: P().x + 1, z: P().z - .3 }], 1.2, () => { Mo.play(g, 'clap'); setTimeout(() => { say(P().group, '🎵 생일 축하합니다~ 생일 축하합니다~', 2.6); Mo.play(P().group, 'clap'); }, 1200);
      setTimeout(() => { say(g, '감사해요!! 케이크 한 조각 드세요 🍰', 2.4); NC.Wallet.add(5, '생일 축하 노래 답례'); walk(g, [{ x: KL.cx + KL.roomsDoor.x, z: KL.cz + KL.roomsDoor.z }], 1.2, () => { g.visible = false; }); }, 4200); });
  },
  function delivery() {   // 치킨 배달 기사
    const g = tempAvatar('배달 기사', { gender: 'm', hairStyle: 'short', hairColor: '#17110f', top: 'jacket', topColor: '#2a6a3a', bottom: 'pants', bottomColor: '#1a1a20', hat: 'newsboy', hatColor: '#1a3a2a' }, KL.cx + KL.exit.x, KL.cz + KL.exit.z, '#7bd33d');
    say(g, '🍗 치킨 배달 왔습니다~ 7번방 맞죠?', 2.4);
    walk(g, [{ x: KL.cx + .4, z: KL.cz - 1.6 }], 1.6, () => { if (owner) say(owner, '어 7번방! 저쪽으로 쭉 가요~ 수고해요!', 2.4); setTimeout(() => walk(g, [{ x: KL.cx + KL.roomsDoor.x, z: KL.cz + KL.roomsDoor.z }], 1.6, () => { g.visible = false; }), 2400); });
  },
  function couple() {   // 커플 말다툼
    const a = tempAvatar('커플(남)', { gender: 'm', hairStyle: 'comma', hairColor: '#17110f', top: 'tee', topColor: '#1a1a1d', bottom: 'pants', bottomColor: '#2c3e5c' }, KL.cx + 4.2, KL.cz - 1.0, '#9ab0ff');
    const b = tempAvatar('커플(여)', { gender: 'f', hairStyle: 'wavy', hairColor: '#3a2014', top: 'shirt', topColor: '#f2f0ea', bottom: 'skirt', bottomColor: '#2a2430' }, KL.cx + 3.6, KL.cz - .6, '#ff9ad5');
    a.rotation.y = -1.2; b.rotation.y = 1.9; say(b, '아까 그 노래 누구 생각하면서 부른 거야?!', 2.6); Mo.play(b, 'crossArms');
    setTimeout(() => { say(a, '아니 그냥 노래잖아… 😰', 2); Mo.play(a, 'bow'); }, 2600);
    setTimeout(() => { say(b, '흥! 나 먼저 갈 거야!', 1.8); walk(b, [{ x: KL.cx + KL.exit.x, z: KL.cz + KL.exit.z }], 1.8, () => { b.visible = false; }); }, 4700);
    setTimeout(() => { say(a, '자기야~ 같이 가!! 😭', 1.8); walk(a, [{ x: KL.cx + KL.exit.x, z: KL.cz + KL.exit.z }], 2.2, () => { a.visible = false; }); if (owner) setTimeout(() => say(owner, '아이고… 노래방에서 싸우는 커플 하루에 한 쌍은 꼭 있어 ㅋㅋ', 3), 1200); }, 6200);
  },
];
function lobbyEpisode() { if (Math.random() < .55) setTimeout(() => { if (R_.current() === KL && !(NC.Karaoke && NC.Karaoke.inRoom)) U.pick(EPIS)(); }, 2500); }

/* ═════ 5. 상호작용 ═════ */
function goStreet(spot) { R_.go(ST, spot || ST.entry); }
function goLobby() { KS.visits++; U.store.set('nc_kvisit', KS.visits); clearExtras(); R_.go(KL, KL.entry, () => { spawnOwner(); lobbyEpisode(); if (KS.visits === 1) setTimeout(() => owner && say(owner, '어서 와요~ 처음 왔죠? 이쪽 카운터로 와요! 😊', 3), 1200); }); }
function backToClub() { const n = KS.comp; clearExtras(); R_.go(null, ENT, () => { if (n) { detachComp(true); NC.ui.toast(`💗 ${n.name}님과 클럽으로 돌아왔어요`); } }); }
NC.interactProviders.push(() => {
  const p = P(), out = []; if (!p.group || p.seat || p.busy || (NC.Karaoke && NC.Karaoke.inRoom)) return out;
  const cur = R_.current();
  if (!cur) { const d = Math.hypot(p.x - ENT.x, p.z - ENT.z); if (d < 2.2) out.push({ label: '🚪 나이트 밖으로 나가기 (E) — 길 건너 노래방', dist: d - .2, run: () => { const n = KS.comp; if (n) attachComp(n, true); goStreet(); } }); return out; }
  const lx = p.x - cur.cx, lz = p.z - cur.cz, near = (o, r) => Math.hypot(lx - o.x, lz - o.z) < r;
  if (cur === ST) {
    if (near(ST.clubDoor, 2.0)) out.push({ label: '🚪 추억의 나이트로 들어가기 (E)', dist: .4, run: backToClub });
    if (near(ST.karaokeDoor, 2.2)) out.push({ label: '🎤 별빛 노래방 들어가기 (E)', dist: .3, run: goLobby });
  } else if (cur === KL) {
    if (near(KL.exit, 1.6)) out.push({ label: '🚪 거리로 나가기 (E)', dist: .5, run: () => { clearExtras(); goStreet({ x: ST.karaokeDoor.x, z: ST.karaokeDoor.z - .9, ry: Math.PI }); } });
    if (near(KL.counter, 1.9)) out.push({ label: '🛎 사장님께 말 걸기 (E) — 방 배정 · 주문 · 수다', dist: .2, run: ownerMenu });
    if (near(KL.roomsDoor, 1.6)) out.push({ label: KS.roomNo ? `🚪 ${KS.roomNo}번방으로 가기 (E)` : '🚪 룸 복도 (카운터에서 방을 먼저 배정받으세요)', dist: .3, run: () => { if (!KS.roomNo) { if (owner) say(owner, '손님~ 방 먼저 받아 가야지! 이쪽 카운터로 와요 ㅎㅎ', 2.6); return; } enterRoom(KS.roomNo, ROOMS.find(r => r.nos.includes(KS.roomNo)) || ROOMS[0]); } });
    if (KS.comp) { const d = Math.hypot(p.x - KS.comp.x, p.z - KS.comp.z); if (d < 1.8) out.push({ label: `💬 ${KS.comp.name}와 대화 (E)`, dist: d + .4, run: () => NC.Dialog.open(KS.comp, { intro: U.pick(['우리 몇 번 방이에요? 빨리 가요~', '사장님 재밌으시다 ㅎㅎ', '저 오늘 목 풀렸어요! 기대해요~']) }) }); }
  }
  return out;
});

/* ═════ 6. 부킹 대화 칩: 🎤 노래방 갈래요? ═════ */
(NC.dialogChips = NC.dialogChips || []).push((n, CHIP) => {
  if (n.gender !== 'f' || (NC.Karaoke && NC.Karaoke.inRoom) || R_.current() || KS.comp === n || P().seat) return;
  CHIP('🎤 노래방 갈래요?', () => {
    const D = NC.Dialog, ok = n.aff >= 65 || (n.aff >= 45 && Math.random() < .55);
    if (!ok) { n.aff = U.clamp(n.aff - 2, 0, 100); D.npcSay(U.pick(['노래방이요? 음… 아직은 좀 이른 것 같아요 ㅎㅎ', '오늘은 여기서 더 놀래요~ 다음에요!', '저 노래 진짜 못해서… 다음에 가요 ㅠㅠ']), 'shy'); D.floatDelta && D.floatDelta(-2); return; }
    D.npcSay(U.pick(['노래방이요? 완전 좋아요!! 마이크 제가 먼저 잡을래요 🎤', '좋아요~ 길 건너 별빛 노래방 알아요? 거기 가요!', '…가요! 대신 듀엣 한 곡은 꼭 해야 돼요 ㅎㅎ']), 'joy');
    setTimeout(() => { D.close('bye'); attachComp(n); NC.ui.toast(`💗 ${n.name}님과 길 건너 별빛 노래방으로 가요`); goLobbyWith(); }, 1600);
  });
});
function goLobbyWith() { KS.visits++; U.store.set('nc_kvisit', KS.visits); clearExtras(); R_.go(KL, KL.entry, () => { spawnOwner(); const n = KS.comp; if (n) { n.x = KL.cx + KL.entry.x - .9; n.z = KL.cz + KL.entry.z + .3; n.g.position.set(n.x, 0, n.z); n.g.visible = true; } setTimeout(() => owner && ownerGreetPair(), 1200); lobbyEpisode(); }); }
function ownerGreetPair() { if (!KS.comp) return; say(owner, `어머~ 둘이 왔네? 😍 예쁜 아가씨랑 왔구나! 좋은 방 줄게~`, 3.2); Mo.play(owner, 'clap'); }

/* ═════ 7. 프레임 ═════ */
if (NC.Audio && NC.Audio.ZONE_FX) Object.assign(NC.Audio.ZONE_FX, {   // 밖에서는 클럽 음악이 벽 너머로 먹먹하게
  street: { lp: 700, gain: .28, wet: .02, bass: 2, bleed: .6 }, klobby: { lp: 420, gain: .14, wet: .05, bass: -2, bleed: .6 } });
NC.tickers.push((dt, t) => {
  const cur = R_.current(), cam = NC.camera;
  for (let i = walkers.length - 1; i >= 0; i--) { const w = walkers[i], g = w.g, tg = w.pts[0], dx = tg.x - g.position.x, dz = tg.z - g.position.z, d = Math.hypot(dx, dz);
    if (d < .1) { w.pts.shift(); if (!w.pts.length) { g.userData.moving = false; walkers.splice(i, 1); w.done && w.done(); } continue; }
    const k = Math.min(1, w.speed * dt / d); g.position.x += dx * k; g.position.z += dz * k; g.userData.moving = true; g.rotation.y = Math.atan2(dx, dz); }
  if (cur === KL || cur === ST) {
    if (owner && cur === KL) { Mo.update(owner, dt, { near: true }); if (cam) NC.Avatar.fitLabel(owner, cam); }
    extras.forEach(g => { if (g.visible) { Mo.update(g, dt, { near: true, speed: 1 }); if (cam) NC.Avatar.fitLabel(g, cam); } });
    if (KL.ball) KL.ball.rotation.y += dt * .8;
    const n = KS.comp; if (n && n.stay === 'outing') {   // 따라다니기
      const p = P(), tx = p.x - Math.sin(p.ry) * .9 + Math.cos(p.ry) * .7, tz = p.z - Math.cos(p.ry) * .9 - Math.sin(p.ry) * .7, dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz), u = n.g.userData;
      if (d > .35) { const s = Math.min(d, (d > 2.5 ? 4 : 2.2) * dt); n.x += dx / d * s; n.z += dz / d * s; u.moving = true; n.g.rotation.y = Math.atan2(dx, dz); } else { u.moving = false; u.lookAt = p.group.position; }
      n.g.position.set(n.x, 0, n.z); n.g.visible = true; }
  }
});
NC.Outside = { street: ST, lobby: KL, KS, goStreet, goLobby, backToClub, attachComp, ownerMenu, episodes: EPIS };
console.info('[outside] 🚪 출입구 · 🌃 거리 · 🎤 별빛 노래방(사장님 스토리·방 배정·주문·에피소드) 준비 완료');
})();
