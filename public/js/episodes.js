/* episodes.js — v14 에피소드 (v16: ② 테이블·VIP 장면을 대본형으로 확장)
 *  ① 모든 룸 부킹: 테이블·VIP 에 앉아 웨이터에게 「💃 부킹 부탁해요」 → 손님이 내 옆자리로 와서 앉음 (노래방은 karaoke.js)
 *  ② 테이블·VIP 손님 50%: 키스하는 커플 · 건배하는 커플 · 싸우는 커플 · 테이블 위에서 춤추는 손님 · VIP 술자리
 *  ③ 초청 밴드/가수: DJ 앞 무대에 등장해 라이브 → 무대에 올라가면 신청곡·듀엣·팁·기념사진, 팬들이 앞으로 몰려듦
 *  ④ 💸 돈 뿌리기(무대): 지폐가 흩날리면 손님들이 줍고 환호 → 여성 손님이 달려와 애교
 *  ⑤ 술 취해 토하는 손님(코믹): 허리 숙여 우웩 → 주변 손님 기겁 · 「🧻 휴지 건네주기」
 */
(() => {
'use strict';

/* v28 카메라 플래시: 조명을 추가·삭제하면 모든 재질 셰이더가 재컴파일돼 모바일에서 끊김·메모리 급증 → 상주 조명 1개를 켰다 끄기 (저사양은 생략) */
let _flash = null; const flashLight = () => { if (NC.quality && NC.quality.level === 'low') return null; if (!_flash) { _flash = new NC.THREE.PointLight(0xffffff, 0, 6); NC.scene.add(_flash); } return _flash; };
const NC = window.NC, T = window.THREE, U = NC.util, W = NC.world, Mo = NC.Motion, K = NC.Karaoke;
const P = () => NC.player, B = (g, t, s) => NC.bubble && NC.bubble(g, t, s);
const online = () => NC.isOnline && NC.isOnline();
const avail = n => n.enabled && n.g.visible && !n.stay && !n.booked && !n.karaoke && !n.drunkHelp && !['seated', 'talk', 'blues', 'karaoke', 'path'].includes(n.state) && n !== (K && K.BL && K.BL.n);
const sprite = (emoji, sz = .3) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.font = '52px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(emoji, 32, 36); const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), transparent: true })); sp.scale.set(sz, sz, 1); return sp; };

/* ───── ① 모든 룸 부킹 (테이블·VIP 자리로) ───── */
function freeSeatNear() {
  const s = P().seat; if (!s) return null;
  if (s.kind === 'table') { const occ = NC.tableOcc[s.t], i = [1, 3, 2, 0].map(d => (s.s + d) % 4).find(k => !occ[k]); return i == null ? null : { kind: 'table', t: s.t, s: i, pos: NC.seatPos(s.t, i), mark: v => { occ[i] = v; } }; }
  if (s.kind === 'vip') { const v = W.vip[s.room], i = v.occ.findIndex((o, k) => !o && k !== s.s); return i < 0 ? null : { kind: 'vip', room: s.room, s: i, pos: v.seats[i], mark: x => { v.occ[i] = x; } }; }
  return null;
}
function bookToSeat(waiter) {
  const seat = freeSeatNear(); if (!seat) { NC.ui.toast('옆자리가 꽉 찼어요. 자리를 비운 뒤 다시 부탁해 주세요'); return false; }
  const pool = (NC.npcs || []).filter(n => n.gender === 'f' && (n.role === 'persona' || n.role === 'crowd') && !n.stay && !n.booked && !n.karaoke && !['seated', 'talk', 'blues'].includes(n.state));
  if (!pool.length) { NC.ui.toast('🤵 지금은 모실 분이 없네요… 잠시 후 다시 불러 주세요'); return false; }
  const n = U.pick(pool.slice(0, 6)); seat.mark('npc');
  if (n.state === 'off' || !n.enabled) { n.enabled = true; n.state = 'wander'; n.x = seat.pos.x + 4; n.z = seat.pos.z + 2; n.g.visible = true; }
  n.booked = true; n.cool = 0; NC.ui.chatAdd(waiter ? waiter.def.title : '웨이터', `손님 테이블로 ${n.name} 님 모셔 올게요! 😄`);
  NC.NPC.goTo(n, { x: seat.pos.x, z: seat.pos.z }, () => {
    NC.NPC.sit(n, seat.pos.x, seat.pos.z, seat.pos.ry, seat.pos.h); n.g.userData.lookAt = P().group.position; n.aff = Math.max(n.aff || 40, 48); n.bookSeat = seat;
    Mo.play(n.g, 'wave'); B(n.g, '안녕하세요~ 💕');
    setTimeout(() => { if (!NC.Dialog.cur) NC.Dialog.open(n, { intro: U.pick(['웨이터분이 여기 멋진 분 있다고 해서요 ㅎㅎ 앉아도 되죠?', '안녕하세요~ 부킹 오래 기다리셨어요? 한 잔 따라 드릴게요', '어머 생각보다 훨씬 괜찮으신데요? ㅋㅋ']) }); }, 800);
  }, 2.6);
  return true;
}
NC.on && NC.on('dialog:close', n => { if (n && n.bookSeat && !P().seat) { n.bookSeat.mark(null); n.bookSeat = null; NC.NPC.release(n); } });

/* ───── ② v16 테이블·VIP 에피소드 — 테이블 50% 이상 · VIP 3개 중 2개 손님 ─────
 *  손님 그룹마다 '대본(script)'이 돌아간다: [대기 초, 동작] 단계를 순서대로 반복하고, 2~3분마다 다른 장면으로 바뀐다.
 *  장면: 키스 커플 · 사랑싸움(따귀·물 끼얹기→화해) · 단체 건배 · 일어나 커플 댄스 · 테이블 위 댄스 · 팔씨름 · 술 취해 졸기 · 가위바위보 벌주
 *        · 장미 고백(성공/차임) · 남자들 몸싸움(친구가 말림→화해 건배) · 셀카
 *  VIP: 샴페인 파티(일어나 춤) · 단체 패싸움(잔 깨짐→진정→건배) · 사장님 플렉스
 *  디스코/블루스 타임(party.js)에 플로어로 나가면 대본이 멈췄다가, 돌아와 앉으면 처음부터 다시 시작 */
const GROUPS = [];
const pk = a => a[Math.floor(Math.random() * a.length)];
const L = {
  drink: ['짠~! 🥂', '원샷! 원샷!', '오늘 끝까지 달려~', '여기 한 병 더요!', '위하여~!!', '건배! 🍻'],
  fightA: ['너 아까 그 여자 쳐다봤지?!', '나 집에 갈래!', '진짜 실망이야…', '말 돌리지 마!', '그 문자 누구야?!'], fightB: ['아니 그게 아니라…', '자기야 오해야~', '내가 뭘 했다고!', '미안해… 진짜로'],
  makeup: ['…한 번만 봐준다', '다음엔 진짜 끝이야 💢', '…알았어 ㅎ 짠 하자'], kiss: ['💋', '💕', '…♡', '(쪽)'],
  dance: ['꺄~ 테이블 위가 명당이지!', '다들 소리 질러~!!', '오늘 내가 주인공!'], cheer: ['언니 최고!!', '와아아~👏', '내려와 위험해 ㅋㅋ', '한 번 더!!'],
  arm: ['으라차차!!', '끄으으응…', '아직 안 끝났어!!'], armWin: ['내가 이겼다! 💪', '술 마셔 ㅋㅋ'], armLose: ['아 손목 삐었어…', '한 판 더!!'],
  sleep: ['Zzz… 💤', '…쿨…', '음냐… 한 잔 더…'], poke: ['야 일어나 ㅋㅋ', '얘 또 잔다 🤣'], wake: ['어?! 나 안 잤어!!', '…여기 어디야?'],
  rps: ['가위! 바위! 보!!', '안 내면 진다~ 가위바위보!'], rpsLose: ['아 또 나야?! 🍺', '벌주는 원샷이다~'],
  rose: ['🌹 저… 저랑 사귀어 주세요!', '🌹 첫눈에 반했어요!'], yes: ['…좋아요 💕', '어머 ㅎㅎ 감동이야~'], no: ['…우리 친구 하자 😅', '장미는 고마운데요… ㅎㅎ'], noReact: ['(털썩)', '…괜찮아, 나 원래 이래'],
  brawl: ['너 지금 뭐라 그랬어?!', '나와 나와!!', '어디서 반말이야!'], stop: ['그만해 그만해!!', '여기서 이러지 마~', '둘 다 앉아!!'], peace: ['…미안하다 친구야', '그래 한 잔 하자 🍻'],
  selfie: ['📸 찰칵!', '하나 둘 셋 김치~', '이거 인스타 각 ✨'],
  vipParty: ['샴페인 터뜨려~ 🍾', '오늘은 VIP답게!!', '음악 볼륨 올려~'], vipBrawlA: ['너 이 자식!!', '내 술을 쏟아?!', '사과해!!'], vipBrawlB: ['형님 진정하세요!!', '오빠 그만해!!', '아 왜 나한테 그래!'], vipCrash: ['💥 쨍그랑!', '💥 우당탕!'],
  boss: ['오늘 내가 쏜다!! 💸', '사장님 최고~!!', '여기 제일 비싼 걸로!'],
};
const seatOf = n => n._seatArgs;
function sitBack(n) { const s = seatOf(n); if (!s) return; NC.NPC.sit(n, s[0], s[1], s[2], s[3]); n.state = 'seated'; n.g.userData.dance = null; n.g.userData.kissK = 0; }
function standAt(n, x, z, face) { NC.unseatAvatar(n.g, x, z); n.state = 'ep'; n.x = x; n.z = z; const u = n.g.userData; u.dance = null; u.seated = false; if (face) n.g.rotation.y = Math.atan2(face.x - x, face.z - z); }
const faceEach = (a, b) => { a.g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); b.g.rotation.y = Math.atan2(a.x - b.x, a.z - b.z); };
const G_ = (n, name) => Mo.play(n.g, name), say = (n, t, s = 2.2) => B(n.g, t, s);
// 테이블/룸에서 일어설 자리: 테이블 의자 바깥쪽 또는 VIP 룸 앞쪽 빈 공간
function outside(g, n, k = 0) {
  if (g.vip != null) { const v = W.vip[g.vip]; return { x: v.cx - 1.6 + (k % 4) * 1.05, z: v.z0 + .95 + Math.floor(k / 4) * .2 }; }
  const t = NC.tables[g.t], s = seatOf(n), ax = s ? s[0] - t.x : 1, az = s ? s[1] - t.z : 1, d = Math.hypot(ax, az) || 1; return { x: t.x + ax / d * 2.9, z: t.z + az / d * 2.9 };
}
const ctr = g => g.vip != null ? { x: W.vip[g.vip].table.x, z: W.vip[g.vip].table.z } : NC.tables[g.t];

/* 장면 정의: need = 필요한 인원/성별, script(g) = [[대기초, 동작], …] */
const KINDS = {
  kiss: { need: ['m', 'f'], script: g => { const [a, b] = g.ns; return [
    [2, () => { const p = outside(g, a); g.c = p; standAt(a, p.x - .2, p.z); standAt(b, p.x + .2, p.z); [a, b].forEach(n => { n.g.userData.dance = 'blues'; }); a.g.userData.bluesLead = true; b.g.userData.bluesLead = false; g.frame = 'pair'; }],
    [9, () => say(b, pk(L.kiss), 1.6)], [9, () => say(a, pk(L.kiss), 1.6)], [8, () => { g.frame = null; sitBack(a); sitBack(b); G_(a, 'drink'); }], [6, () => { G_(b, 'shy'); say(b, '…또 춰요? ㅎㅎ'); }]]; } },
  fight: { need: ['f', 'm'], script: g => { const [f, m] = g.ns; return [
    [3, () => { say(f, pk(L.fightA), 2.4); G_(f, 'crossArms'); }], [2.6, () => { say(m, pk(L.fightB)); G_(m, 'bow'); }], [3, () => { say(f, pk(L.fightA), 2.4); G_(f, 'headshake'); }],
    [3, () => { G_(f, 'slap'); setTimeout(() => { G_(m, 'flinch'); say(m, '아야!! 😵', 1.6); }, 380); }], [3, () => { say(f, '💦 촥!! (물 끼얹기)', 2); G_(f, 'push'); setTimeout(() => G_(m, 'flinch'), 300); }],
    [4, () => { say(m, '…내가 다 잘못했어 🙏', 2.4); G_(m, 'bow'); }], [3, () => { say(f, pk(L.makeup), 2.4); G_(f, 'shy'); }], [3, () => { G_(f, 'cheers'); G_(m, 'cheers'); say(m, '짠… 🥂'); }]]; } },
  toast: { need: ['*', '*', '*'], script: g => [
    [3, () => { g.ns.forEach((n, i) => setTimeout(() => G_(n, i % 2 ? 'cheers' : 'drink'), i * 220)); say(g.ns[0], pk(L.drink)); }],
    [4, () => { const n = pk(g.ns); G_(n, 'laugh'); say(n, pk(['ㅋㅋㅋㅋ 미쳤다', '아 배 아파 ㅋㅋ', '그래서 걔가 뭐래?'])); }],
    [4, () => { const n = g.ns[g.ns.length - 1]; const p = outside(g, n); standAt(n, p.x, p.z, ctr(g)); G_(n, 'cheer'); say(n, '자 다들 일어나!! 위하여~!!', 2.4); g.ns.forEach(o => o !== n && setTimeout(() => G_(o, 'cheers'), 400)); }],
    [4, () => { sitBack(g.ns[g.ns.length - 1]); }]] },
  standDance: { need: ['m', 'f'], script: g => { const [a, b] = g.ns; return [
    [3, () => { say(b, '이 노래 나와! 나가서 춰요!!', 2); }], [1.5, () => { const p = outside(g, a); standAt(a, p.x - .55, p.z); standAt(b, p.x + .55, p.z); faceEach(a, b); a.g.userData.dance = b.g.userData.dance = 'stageDance'; g.ns.slice(2).forEach(o => G_(o, 'clap')); }],
    [10, () => { say(a, pk(['오~ 춤 좀 추는데?', '리듬 타 리듬~'])); faceEach(a, b); }], [8, () => { G_(b, 'laugh'); say(b, '아 숨차 ㅋㅋ'); }], [2, () => { sitBack(a); sitBack(b); }], [8, () => {}]]; } },
  tableDance: { need: ['f', '*'], script: g => { const [f] = g.ns, fr = g.ns.slice(1); return [
    [2, () => { const t = ctr(g); standAt(f, t.x, t.z); f.g.userData.dance = 'stageDance'; g.frame = 'onTable'; }],
    [6, () => { say(f, pk(L.dance)); fr.forEach((o, i) => setTimeout(() => { G_(o, 'clap'); say(o, pk(L.cheer), 1.8); }, 500 + i * 400)); }], [8, () => say(f, pk(L.dance))],
    [8, () => { g.frame = null; sitBack(f); say(f, '헉헉 ㅋㅋ 한 잔 줘!'); fr.forEach(o => G_(o, 'cheers')); }], [8, () => {}]]; } },
  armWrestle: { need: ['m', 'm', '*'], script: g => { const [a, b] = g.ns, rest = g.ns.slice(2); return [
    [3, () => { say(a, '팔씨름 한 판? 지는 사람 원샷!', 2.4); }], [2.5, () => { say(b, pk(L.arm)); G_(a, 'flinch'); G_(b, 'flinch'); rest.forEach(o => { G_(o, 'clap'); say(o, '힘내!! 💪', 1.4); }); }],
    [2.5, () => { say(a, pk(L.arm)); G_(a, 'flinch'); G_(b, 'flinch'); }], [2.5, () => { const w = Math.random() < .5 ? a : b, l = w === a ? b : a; G_(w, 'cheer'); say(w, pk(L.armWin)); setTimeout(() => { G_(l, 'drink'); say(l, pk(L.armLose)); }, 900); }], [8, () => {}]]; } },
  sleep: { need: ['m', '*'], script: g => { const [z, fr] = g.ns; return [
    [2, () => { G_(z, 'bow'); say(z, pk(L.sleep), 3); }], [4, () => { G_(z, 'bow'); say(z, pk(L.sleep), 3); }], [3, () => { G_(fr, 'push'); say(fr, pk(L.poke)); }],
    [1.2, () => { G_(z, 'flinch'); say(z, pk(L.wake), 2); g.ns.slice(1).forEach(o => setTimeout(() => G_(o, 'laugh'), 500)); }], [6, () => { G_(z, 'drink'); }], [5, () => { G_(z, 'bow'); say(z, pk(L.sleep), 3); }]]; } },
  rps: { need: ['*', '*', '*'], script: g => [
    [3, () => { say(g.ns[0], pk(L.rps), 2); }], [1.6, () => { const h = ['✊', '✌️', '🖐']; g.ns.forEach(n => { say(n, pk(h), 1.6); G_(n, 'point'); }); }],
    [2, () => { const l = pk(g.ns); G_(l, 'drink'); say(l, pk(L.rpsLose)); g.ns.forEach(o => o !== l && G_(o, 'laugh')); }], [6, () => {}]] },
  rose: { need: ['m', 'f', '*'], script: g => { const [m, f] = g.ns, rest = g.ns.slice(2); return [
    [4, () => { const p = outside(g, f); standAt(m, p.x, p.z, f); G_(m, 'bow'); say(m, pk(L.rose), 2.6); }],
    [3, () => { if (Math.random() < .55) { G_(f, 'aegyo'); say(f, pk(L.yes)); rest.forEach(o => { G_(o, 'clap'); say(o, '꺄~ 축하해!!', 1.6); }); }
      else { G_(f, 'headshake'); say(f, pk(L.no)); setTimeout(() => { G_(m, 'flinch'); say(m, pk(L.noReact)); rest.forEach(o => G_(o, 'laugh')); }, 1500); } }],
    [5, () => sitBack(m)], [10, () => {}]]; } },
  brawl: { need: ['m', 'm', '*'], script: g => { const [a, b] = g.ns, ref = g.ns[2]; return [
    [3, () => { say(a, pk(L.brawl)); G_(a, 'point'); }], [2, () => { const p = outside(g, a), q = outside(g, b); standAt(a, p.x, p.z); standAt(b, (p.x + q.x) / 2 + .6, (p.z + q.z) / 2); faceEach(a, b); say(b, pk(L.brawl)); }],
    [1.8, () => { G_(a, 'push'); setTimeout(() => G_(b, 'flinch'), 300); }], [1.8, () => { G_(b, 'slap'); setTimeout(() => { G_(a, 'flinch'); say(a, '야!!! 😡', 1.4); }, 350); }],
    [1.6, () => { if (ref) { standAt(ref, (a.x + b.x) / 2, (a.z + b.z) / 2 + .3); G_(ref, 'headshake'); say(ref, pk(L.stop), 2); } }],
    [3, () => { say(a, pk(L.peace)); G_(a, 'bow'); setTimeout(() => { say(b, pk(L.peace)); G_(b, 'nod'); }, 1200); }],
    [3, () => { g.ns.forEach(sitBack); g.ns.forEach((n, i) => setTimeout(() => G_(n, 'cheers'), 300 + i * 200)); }], [9, () => {}]]; } },
  selfie: { need: ['f', 'f'], script: g => [
    [3, () => { const [a] = g.ns; G_(a, 'aegyo'); say(a, pk(L.selfie), 1.8); g.flash = 1; g.ns.slice(1).forEach(o => G_(o, 'aegyo')); }], [5, () => { G_(g.ns[1], 'laugh'); say(g.ns[1], '나 눈 감았어 다시!!'); }], [6, () => {}]] },
  cheersStand: { need: ['m', 'f'], script: g => { const [a, b] = g.ns; return [   // v18 커플이 일어나 마주 보고 건배
    [2.5, () => { const p = outside(g, a); standAt(a, p.x - .4, p.z); standAt(b, p.x + .4, p.z); faceEach(a, b); say(a, '우리 일어나서 건배하자!'); }],
    [2, () => { G_(a, 'cheers'); G_(b, 'cheers'); say(b, pk(L.drink)); }], [2.5, () => { G_(a, 'drink'); G_(b, 'drink'); }], [2.5, () => { G_(b, 'laugh'); G_(a, 'cheer'); say(a, '한 잔 더~!!'); }],
    [3, () => { sitBack(a); sitBack(b); }], [7, () => {}]]; } },
  tableDuo: { need: ['*', '*'], script: g => { const [a, b] = g.ns; return [   // v18 둘이 테이블 위로 올라가 춤
    [2.5, () => { const t = ctr(g); standAt(a, t.x - .35, t.z); standAt(b, t.x + .35, t.z); faceEach(a, b); a.g.userData.dance = b.g.userData.dance = 'stageDance'; g.frame = 'onTable2'; say(a, '올라와 올라와~!! 🔥', 2); }],
    [7, () => { say(b, pk(L.dance)); faceEach(a, b); }], [7, () => { G_(a, 'cheer'); }], [3, () => { g.frame = null; sitBack(a); sitBack(b); say(b, '헉헉 ㅋㅋ 다리 후들'); }], [8, () => {}]]; } },
  // ── VIP ──
  vipParty: { need: ['m', 'f', '*'], vip: true, script: g => [
    [2, () => { W.vip[g.vip].champ.visible = true; say(g.ns[0], pk(L.vipParty), 2.4); g.ns.forEach((n, i) => setTimeout(() => G_(n, 'cheers'), i * 200)); }],
    [4, () => { g.ns.forEach((n, i) => { const p = outside(g, n, i); standAt(n, p.x, p.z); n.g.userData.dance = 'stageDance'; n.g.rotation.y = Math.PI; }); say(g.ns[1], '꺄~ 이 노래 좋아!!'); }],
    [10, () => { const n = pk(g.ns); G_(n, 'cheer'); say(n, pk(L.vipParty)); }], [8, () => { g.ns.forEach(sitBack); g.ns.forEach(n => G_(n, 'drink')); }], [10, () => {}]] },
  vipBrawl: { need: ['m', 'm', 'f'], vip: true, script: g => { const [a, b, c, d] = g.ns; return [
    [3, () => { G_(a, 'cheers'); G_(b, 'cheers'); say(a, '자 형님 한 잔 받으세요~'); }], [3, () => { say(b, '💦 앗… 쏟았다', 1.6); setTimeout(() => { say(a, pk(L.vipBrawlA)); G_(a, 'point'); }, 1200); }],
    [2.4, () => { g.ns.forEach((n, i) => { const p = outside(g, n, i); standAt(n, p.x, p.z); }); faceEach(a, b); }],
    [1.6, () => { G_(a, 'push'); setTimeout(() => G_(b, 'flinch'), 300); say(b, pk(L.vipBrawlB)); }], [1.6, () => { G_(b, 'slap'); setTimeout(() => G_(a, 'flinch'), 350); if (d) { G_(d, 'push'); setTimeout(() => G_(a, 'flinch'), 500); } }],
    [1.4, () => { say(c, pk(L.vipBrawlB), 2); G_(c, 'headshake'); B(W.vip[g.vip].champ, pk(L.vipCrash), 1.6); }], [1.8, () => { g.ns.forEach(n => G_(n, 'flinch')); say(d || c, '다들 그만!!! 😱', 2); }],
    [3, () => { say(a, '…휴, 내가 흥분했다', 2.2); G_(a, 'bow'); }], [3, () => { g.ns.forEach(sitBack); say(b, pk(L.peace)); g.ns.forEach((n, i) => setTimeout(() => G_(n, 'cheers'), i * 250)); }], [12, () => {}]]; } },
  vipBoss: { need: ['m', 'f', 'f'], vip: true, script: g => { const [boss, ...fs] = g.ns; return [
    [3, () => { G_(boss, 'cheer'); say(boss, pk(L.boss), 2.4); fs.forEach((f, i) => setTimeout(() => { G_(f, 'clap'); say(f, '사장님 최고~!! 💕', 1.6); }, 600 + i * 300)); }],
    [6, () => { G_(boss, 'drink'); fs.forEach(f => G_(f, 'cheers')); }], [6, () => { G_(fs[0], 'aegyo'); say(fs[0], '한 병 더 시켜요~ ㅎㅎ'); }], [8, () => {}]]; } },
};
const TABLE_KINDS = ['kiss', 'fight', 'toast', 'standDance', 'tableDance', 'armWrestle', 'sleep', 'rps', 'rose', 'brawl', 'selfie', 'cheersStand', 'tableDuo'];
const SEATED_ONLY = ['armWrestle', 'sleep', 'rps', 'selfie', 'fight'];   // 앉아서만 하는 장면 → 끝에 '일어나 춤' 막간을 붙여 늘 움직임이 보이게
const fits = (kind, ns) => { const need = KINDS[kind].need; if (need.length > ns.length) return false; const pool = ns.slice(); return need.every(gd => { const i = pool.findIndex(n => gd === '*' || n.gender === gd); if (i < 0) return false; pool.splice(i, 1); return true; }); };
const order = (kind, ns) => { const need = KINDS[kind].need, pool = ns.slice(), out = []; need.forEach(gd => { const i = pool.findIndex(n => gd === '*' || n.gender === gd); out.push(pool.splice(i, 1)[0]); }); return out.concat(pool); };
function setKind(g, kind) {
  g.ns.forEach(n => { if (n.state !== 'seated') sitBack(n); }); g.frame = null; if (g.vip != null) W.vip[g.vip].champ.visible = false;
  g.kind = kind; g.ns = order(kind, g.ns); g.steps = KINDS[kind].script(g); g.si = 0; g.wait = 1 + Math.random() * 2; g.reroll = 90 + Math.random() * 60;
  if (g.vip == null && SEATED_ONLY.includes(kind) && g.ns.length >= 2) { const [a, b] = g.ns; g.steps = g.steps.concat([
    [2, () => { const p = outside(g, a); standAt(a, p.x - .5, p.z); standAt(b, p.x + .5, p.z); faceEach(a, b); a.g.userData.dance = b.g.userData.dance = pk(['stageDance', 'groove']); say(b, pk(['이 노래 좋다! 잠깐 춰요~', '일어나 일어나 🕺'])); }],
    [8, () => { faceEach(a, b); G_(a, 'cheer'); }], [3, () => { sitBack(a); sitBack(b); }]]); }
}
const NAMES_F = ['보라', '하늘', '예슬', '미나', '세라', '다인', '채원', '소율', '가은', '나연', '루나', '제니', '윤아', '슬기', '혜원', '은비'];
const NAMES_M = ['상철', '동훈', '현우', '준혁', '성민', '태호', '민규', '재원', '우진', '건우', '형준', '대성', '진호', '석진', '영훈', '광수'];
const TOPS_F = ['#ff5c8a', '#ffd23d', '#9b5cff', '#3de6ff', '#ff8a3d', '#ffffff', '#e0245e', '#7ae6b0'], TOPS_M = ['#2a2a35', '#ffffff', '#3d6aff', '#8a1a2a', '#1a5a3a', '#c0a060', '#5a5a6a'];
function makeGuests(nF, nM, off = 0) {    // 자리 채우기용 손님 생성 (npcs.json 의 기본 손님은 플로어를 돌아다니게 남겨 둠)
  const out = [], hair = ['#1a120c', '#3b2417', '#5a3a22', '#2a1a10', '#8a5a2a', '#c8a070'];
  for (let i = 0; i < nF + nM; i++) { const f = i < nF, j = i + off, nm = f ? NAMES_F[j % NAMES_F.length] : NAMES_M[j % NAMES_M.length];
    const n = NC.NPC.spawn({ id: `guest_${j}`, name: nm, gender: f ? 'f' : 'm', color: pk(f ? TOPS_F : TOPS_M), hair: pk(hair), trait: pk(['outgoing', 'shy', 'cool']), tag: '🍸 테이블 손님', job: '손님' }, 'crowd'); n.guest = true; out.push(n); }
  return out;
}
function setupGroups() {
  if (online() || GROUPS.length) return;
  const low = NC.quality && NC.quality.level === 'low', nTables = low ? 8 : 10;
  if (low && !makeGuests.done) {   // 저사양(모바일): 손님을 한 명씩 나눠 만든 뒤 자리 배치 (한꺼번에 만들면 입장 직후 수 초 멈춤)
    makeGuests.done = 'pending'; let k = 0; const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 250 }) : f => setTimeout(f, 30);
    const NG = NC.isMobile ? 8 : 16;   // v34 모바일: 테이블 손님 8명
    const step = () => { if (k < NG) { makeGuests(k < NG / 2 ? 1 : 0, k < NG / 2 ? 0 : 1, k); k++; idle(step); } else { makeGuests.done = true; setupGroups(); } }; idle(step); return; }
  if (low && makeGuests.done !== true) return;
  if (!low) makeGuests(16, 16);
  const crowd = (NC.npcs || []).filter(n => n.role === 'crowd' && !n.stay && n.enabled), guests = crowd.filter(n => n.guest), rest = crowd.filter(n => !n.guest);
  const pool = guests.concat(rest.slice(0, 6)), F = pool.filter(n => n.gender === 'f'), M = pool.filter(n => n.gender === 'm');
  const take = gd => (gd === 'f' ? F : gd === 'm' ? M : (F.length > M.length ? F : M)).shift();
  // VIP 2·3번 룸 (VIP 1번은 플레이어 예약용으로 비워 둠)
  [[1, 'vipParty', ['m', 'f', 'm', 'f']], [2, 'vipBrawl', ['m', 'm', 'f', 'f']]].forEach(([vi, kind, gs]) => { const v = W.vip[vi]; if (!v) return; const ns = (low ? gs.slice(0, 3) : gs).map(take).filter(Boolean); if (ns.length < 3) return;
    ns.forEach((n, i) => { n.stay = 'vip'; n.enabled = true; n.g.visible = true; NC.NPC.sit(n, v.seats[i].x, v.seats[i].z, v.seats[i].ry, v.seats[i].h); v.occ[i] = 'npc'; });
    const g = { vip: vi, ns, kinds: ['vipParty', 'vipBrawl', 'vipBoss'] }; const k2 = fits(kind, ns) ? kind : g.kinds.find(k => fits(k, ns)); if (k2) { GROUPS.push(g); setKind(g, k2); } });
  // 테이블: 앞줄·플로어 옆을 우선, 장면이 겹치지 않게 골고루
  const tOrder = [0, 1, 2, 3, 12, 14, 6, 7, 13, 15, 4, 5, 8, 9, 10, 11].slice(0, nTables), kinds = TABLE_KINDS.slice().sort(() => Math.random() - .5);
  const comp = [['m', 'f'], ['f', 'm', '*'], ['*', '*', '*'], ['m', 'f'], ['f', 'f', 'm'], ['m', 'm', '*'], ['m', 'f', '*'], ['*', '*', '*', '*'], ['m', 'f', 'f'], ['m', 'm', 'f'], ['f', 'f']];
  tOrder.forEach((ti, k) => {
    const want = low ? comp[k % comp.length].slice(0, 2) : comp[k % comp.length], ns = want.map(take).filter(Boolean); if (ns.length < 2) return;
    ns.forEach((n, s) => { n.stay = 'table'; n.enabled = true; n.g.visible = true; const p = NC.seatPos(ti, s); NC.NPC.sit(n, p.x, p.z, p.ry, p.h); NC.tableOcc[ti][s] = 'npc'; });
    const g = { t: ti, ns, kinds: TABLE_KINDS }; GROUPS.push(g);
    const first = kinds.find(kd => fits(kd, ns)) || TABLE_KINDS.find(kd => fits(kd, ns)); if (first) { kinds.splice(kinds.indexOf(first), 1); kinds.push(first); setKind(g, first); }
  });
  console.info('[episodes] 테이블·VIP 손님 그룹', GROUPS.length, GROUPS.map(g => (g.vip != null ? 'VIP' + (g.vip + 1) : 'T' + (g.t + 1)) + ':' + g.kind).join(' '));
}
/* ───── v18 웨이터 부킹 에스코트: 웨이터가 부킹녀 손을 잡고 테이블 사이로 데려가 남자 손님 테이블에 앉힘 ───── */
const ESC = { g: null, girl: null, path: null, phase: 'idle', t: 25, seat: null, stay: 0 };
function escWaiter() {
  if (ESC.g) return ESC.g;
  ESC.g = NC.Avatar.create({ name: '웨이터 「번개」', look: { gender: 'm', top: 'vest', topColor: '#121018', bottom: 'pants', bottomColor: '#121018', hairStyle: 'slick', hairColor: '#17110f', shoes: 'boots' }, seed: 4242, labelColor: '#ffd23d' });
  ESC.g.visible = false; NC.scene.add(ESC.g); return ESC.g;
}
function escStart() {
  const girls = (NC.npcs || []).filter(n => n.gender === 'f' && n.role === 'crowd' && !n.guest && avail(n) && n.state === 'wander' && !n.party);
  const tgt = GROUPS.filter(g => g.t != null && g.ns.some(n => n.gender === 'm') && NC.tableOcc[g.t].some(o => !o) && !g.ns.some(n => n.party));
  if (!girls.length || !tgt.length) return false;
  const girl = pk(girls), gr = pk(tgt), si = NC.tableOcc[gr.t].findIndex(o => !o); if (si < 0) return false;
  const w = escWaiter(), st = W.spots.waiterStation || { x: -10, z: 10.2 };
  w.position.set(st.x, 0, st.z); w.visible = true; NC.tableOcc[gr.t][si] = 'npc';
  Object.assign(ESC, { girl, grp: gr, seat: { t: gr.t, s: si }, phase: 'toGirl', path: NC.Path ? NC.Path.find({ x: st.x, z: st.z }, { x: girl.x, z: girl.z }) : [{ x: girl.x, z: girl.z }] });
  girl.state = 'escort'; girl.stay = 'escort'; girl.g.userData.dance = null; return true;
}
function escStep(dt, speed) {
  const w = ESC.g, p = ESC.path && ESC.path[0]; if (!p) return true;
  const dx = p.x - w.position.x, dz = p.z - w.position.z, d = Math.hypot(dx, dz);
  if (d < .3) { ESC.path.shift(); return !ESC.path.length; }
  const k = Math.min(1, speed * dt / d); w.position.x += dx * k; w.position.z += dz * k; w.position.y = NC.groundY(w.position.x, w.position.z);
  w.rotation.y = U.lerpAngle(w.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8)); w.userData.moving = true; return false;
}
function tickEscort(dt) {
  const w = ESC.g;
  if (ESC.phase === 'idle') { ESC.t -= dt; if (ESC.t <= 0) { ESC.t = 40 + Math.random() * 25; if (!online() && P() && P().group && GROUPS.length) escStart(); } }
  else if (ESC.phase === 'toGirl') { const girl = ESC.girl; if (Math.hypot(girl.x - w.position.x, girl.z - w.position.z) < 1.1 || escStep(dt, 2.2)) {
      ESC.phase = 'greet'; ESC.stay = 2.2; w.userData.moving = false; girl.g.rotation.y = Math.atan2(w.position.x - girl.x, w.position.z - girl.z); Mo.play(w, 'bow'); B(w, pk(['손님~ 좋은 자리 있어요! 저 따라오세요 😉', '이쪽 테이블에서 찾으세요~ 🤵']), 2.2); setTimeout(() => B(girl.g, pk(['어머 진짜요? ㅎㅎ', '…잘생겼어요? ㅋㅋ']), 1.8), 1200); } }
  else if (ESC.phase === 'greet') { ESC.stay -= dt; if (ESC.stay <= 0) { const sp = NC.standPos(ESC.seat.t, ESC.seat.s); ESC.path = NC.Path ? NC.Path.find({ x: w.position.x, z: w.position.z }, sp) || [sp] : [sp]; ESC.phase = 'lead'; B(w, '손 꼭 잡으세요~ 🤝', 1.6); } }
  else if (ESC.phase === 'lead') {   // 손 잡고 걷기: 부킹녀가 웨이터 오른쪽 뒤에서 나란히
    const done = escStep(dt, 1.5), girl = ESC.girl, ry = w.rotation.y, ox = Math.cos(ry) * .48 - Math.sin(ry) * .28, oz = -Math.sin(ry) * .48 - Math.cos(ry) * .28;
    girl.x = w.position.x + ox; girl.z = w.position.z + oz; girl.g.position.set(girl.x, NC.groundY(girl.x, girl.z), girl.z); girl.g.rotation.y = ry; girl.g.userData.moving = true; girl.g.userData.lookAt = null;
    if (done) { ESC.phase = 'seat'; w.userData.moving = false; girl.g.userData.moving = false; const pos = NC.seatPos(ESC.seat.t, ESC.seat.s); NC.NPC.sit(girl, pos.x, pos.z, pos.ry, pos.h); girl.state = 'seated';
      const man = ESC.grp.ns.find(n => n.gender === 'm'); Mo.play(w, 'point'); B(w, '자 이분이에요~ 즐거운 시간 되세요! 🍾', 2.2); if (man) setTimeout(() => { Mo.play(man.g, 'wave'); B(man.g, pk(['오~ 반가워요! 😍', '여기 앉으세요~ 한 잔 하실래요?']), 2); }, 1400);
      setTimeout(() => { Mo.play(girl.g, 'shy'); B(girl.g, pk(['안녕하세요 ㅎㅎ', '…반가워요 💕']), 1.8); }, 2600); ESC.stay = 30 + Math.random() * 20; ESC.path = NC.Path ? NC.Path.find({ x: w.position.x, z: w.position.z }, W.spots.waiterStation || { x: -10, z: 10.2 }) : null; } }
  else if (ESC.phase === 'seat') { if (ESC.path && ESC.path.length) escStep(dt, 2.2); else if (w) { w.visible = false; w.userData.moving = false; }
    ESC.stay -= dt; const girl = ESC.girl; if (ESC.stay > 0 && Math.random() < dt / 9) { Mo.play(girl.g, pk(['cheers', 'laugh', 'drink'])); }
    if (ESC.stay <= 0) { NC.tableOcc[ESC.seat.t][ESC.seat.s] = null; girl.stay = false; NC.NPC.release(girl); B(girl.g, pk(['저 친구한테 가 볼게요~ 👋', '즐거웠어요! 😘']), 1.8); ESC.phase = 'idle'; if (w) w.visible = false; } }
  if (w && w.visible) { Mo.update(w, dt, { near: true, speed: 1 }); NC.Avatar.fitLabel(w, NC.camera); }
}
NC.Episodes_escort = ESC;
function tickGroups(dt) {
  try { tickEscort(dt); } catch (e) { console.warn('[escort]', e); ESC.phase = 'idle'; }
  const now = performance.now() / 1000;
  GROUPS.forEach(g => {
    if (!g.kind) return;
    if (g.ns.some(n => n.party || n.booked || n.state === 'talk')) { g.paused = true; return; }   // 디스코/블루스 타임·플레이어와 대화 중
    if (g.paused) { if (g.ns.some(n => n.state === 'path' || n.state === 'wander')) return; g.paused = false; setKind(g, g.kind); return; }   // 다 자리로 돌아온 뒤 처음부터
    // 프레임 연출: 커플 블루스(키스) · 테이블 위 댄서
    if (g.frame === 'pair') { const [a, b] = g.ns, d = .21 - .06 * Math.max(0, Math.sin(now * .5)), ang = Math.sin(now * .3) * .3 + (g.ph || (g.ph = Math.random() * 6));
      a.x = g.c.x - Math.cos(ang) * d; a.z = g.c.z - Math.sin(ang) * d; b.x = g.c.x + Math.cos(ang) * d; b.z = g.c.z + Math.sin(ang) * d;
      const ry = Math.atan2(b.x - a.x, b.z - a.z); a.g.rotation.y = ry; b.g.rotation.y = ry + Math.PI; a.g.userData.kissK = b.g.userData.kissK = Math.max(0, Math.sin(now * .5));
      a.g.position.set(a.x, NC.groundY(a.x, a.z), a.z); b.g.position.set(b.x, NC.groundY(b.x, b.z), b.z); }
    else if (g.frame === 'onTable') { const f = g.ns[0]; f.g.position.y = NC.groundY(f.x, f.z) + .82; }
    else if (g.frame === 'onTable2') { g.ns.slice(0, 2).forEach(f => { f.g.position.y = NC.groundY(f.x, f.z) + .82; }); }
    if (g.flash) { g.flash = 0; const t = ctr(g); if (NC.camera && Math.hypot(t.x - P().x, t.z - P().z) < 14) { const L_ = flashLight(); if (L_) { L_.position.set(t.x, 2.2 + (g.vip != null ? W.vip[g.vip].y : 0), t.z); L_.intensity = 3; setTimeout(() => { L_.intensity = 0; }, 120); } } }
    // 대본 진행 + 2~3분마다 다른 장면으로
    g.reroll -= dt; g.wait -= dt;
    if (g.wait > 0) return;
    if (g.reroll <= 0 && g.si === 0) { const opts = g.kinds.filter(k => k !== g.kind && fits(k, g.ns)); if (opts.length) { setKind(g, pk(opts)); return; } g.reroll = 120; }
    const st = g.steps[g.si]; try { st[1](); } catch (e) { console.warn('[episodes]', g.kind, e); }
    g.si = (g.si + 1) % g.steps.length; g.wait = g.steps[g.si][0] * (.6 + Math.random() * .25);   // v18: 템포를 빠르게
  });
}
(function trySetup() { if ((NC.npcs || []).length && NC.NPC.ready && NC.player && NC.player.group) setupGroups(); else setTimeout(trySetup, 1500); })();

/* ───── ③ 초청 밴드/가수 ───── */
const ST = W.zones.stage, FRONT = ST.z1;
const BAND = { on: false, members: [], props: new T.Group(), queue: [], asked: false, nextAt: performance.now() + 75000, song: null };
NC.scene.add(BAND.props); BAND.props.visible = false;
{ const dark = new T.MeshStandardMaterial({ color: 0x141418, roughness: .4, metalness: .4 }), red = new T.MeshStandardMaterial({ color: 0xb01020, roughness: .25, metalness: .3 });
  const keys = new T.Group(); const kb = new T.Mesh(new T.BoxGeometry(1.1, .08, .32), dark); kb.position.y = .9; keys.add(kb); const wk = new T.Mesh(new T.BoxGeometry(1.0, .02, .12), new T.MeshStandardMaterial({ color: 0xf4f4f4 })); wk.position.set(0, .95, .08); keys.add(wk);
  [-.45, .45].forEach(x => { const l = new T.Mesh(new T.CylinderGeometry(.02, .02, .9, 6), dark); l.position.set(x, .45, 0); keys.add(l); }); keys.position.set(2.3, ST.y, FRONT - 1.9); keys.rotation.y = Math.PI; BAND.props.add(keys);
  const amp = new T.Mesh(new T.BoxGeometry(.7, .7, .4), dark); amp.position.set(-3.2, ST.y + .35, FRONT - 2.4); BAND.props.add(amp);
  BAND.guitar = (() => { const g = new T.Group(); const body = new T.Mesh(new T.CylinderGeometry(.17, .17, .06, 18), red); body.rotation.x = Math.PI / 2; g.add(body); const neck = new T.Mesh(new T.BoxGeometry(.05, .55, .03), dark); neck.position.y = .32; g.add(neck); g.rotation.z = -1.1; g.position.set(.05, -.12, .14); return g; })();
  BAND.mic = (() => { const m = new T.Mesh(new T.SphereGeometry(.035, 10, 8), new T.MeshStandardMaterial({ color: 0x333338, metalness: .8, roughness: .3 })); m.position.set(0, .05, .06); return m; })(); }
const BAND_NAMES = ['🎸 밴드 「네온 코스모스」', '🎤 초청가수 「미러볼 디바」', '🎷 밴드 「청담 블루스」', '🎤 초청가수 「골든 보이스」'];
function bandStart() {
  if (BAND.on || online() || !K || !K.playSong || (K && K.inRoom)) return;
  BAND.on = true; BAND.asked = false; BAND.props.visible = true; const name = U.pick(BAND_NAMES), diva = /디바|보이스/.test(name);
  const mk = (nm, look, x, z) => { const g = NC.Avatar.create({ name: nm, look, seed: U.hash(nm + Date.now()), expr: 'smile', hiRes: true }); g.position.set(x, ST.y, z); g.rotation.y = 0; NC.scene.add(g); BAND.members.push(g); return g; };
  BAND.singer = mk(diva ? '디바 세라' : '보컬 제이', diva ? { gender: 'f', top: 'dress', mini: true, strapless: true, topColor: '#e8b84a', bottom: 'skirt', bottomColor: '#e8b84a', wings: null, hairStyle: 'wavy', hairColor: '#c9a060' } : { gender: 'm', top: 'jacket', topColor: '#141418', hairStyle: 'spiky', face: { attractive: true, sunglasses: true } }, 0, FRONT - 1.35);
  const gt = mk('기타 강산', { gender: 'm', top: 'tee', topColor: '#3a3a42', hairStyle: 'curly', muscle: .4, face: { attractive: false } }, -2.2, FRONT - 1.9);
  const kb = mk('키보드 나래', { gender: 'f', top: 'crop', strapless: true, topColor: '#9b5cff', bottom: 'skirt', mini: true, bottomColor: '#141418' }, 2.3, FRONT - 2.4);
  gt.userData.rig.elR.children.find(c => c.isGroup).add(BAND.guitar); BAND.singer.userData.rig.elR.children.find(c => c.isGroup).add(BAND.mic);
  BAND.singer.userData.dance = 'sing'; gt.userData.dance = 'groove'; kb.userData.dance = 'groove';
  BAND.prevVol = null;   // v20.1 밴드는 지금 나오는 스테이지 음악(MP3 등)에 맞춰 공연 — 음악을 줄이거나 다른 노래로 바꾸지 않음
  NC.ui.toast(`🎧 DJ: "여러분~ 오늘의 스페셜 게스트! ${name} 입니다!! 👏"`); NC.ui.chatAdd && NC.ui.chatAdd('DJ 루나', `${name} 무대 시작합니다! 무대 앞으로 오세요~ 🎶`);
  NC.fireCO2 && NC.fireCO2();
  // 팬들이 무대 앞으로
  (NC.npcs || []).filter(avail).sort(() => Math.random() - .5).slice(0, 6).forEach((n, i) => { const x = -4 + i * 1.6 + (Math.random() - .5) * .4, z = FRONT + 1.0 + Math.random() * .8; NC.NPC.goTo(n, { x, z }, () => { n.state = 'wander'; n.pause = 40; n.wp = { x, z, act: 'dance' }; n.g.rotation.y = Math.PI; n.g.userData.dance = 'groove'; if (BAND.singer) n.g.userData.lookAt = BAND.singer.position; Mo.play(n.g, 'cheer'); }, 2.6); });
  BAND.queue = []; BAND.left = 0; B(BAND.singer, '♪ 오늘 밤 신나게 달려 볼까요~! ♪', 3);
  clearTimeout(BAND.endT); BAND.endT = setTimeout(() => { if (!K.playing || K.playing.singer !== 'band') bandEnd(); }, 90000);   // 90초 공연(신청곡을 부르는 중이면 그 곡이 끝날 때 퇴장)
}
function nextSong() {
  if (!BAND.on) return; const song = BAND.queue.shift() || U.pick(K.songs); BAND.song = song; BAND.lyric = 0;
  K.playSong(song, 'band'); B(BAND.singer, `♪ ${song.title} ♪`, 3);
}
NC.on && NC.on('band:songEnd', () => { if (!BAND.on || !BAND.singer) return; BAND.members.forEach(g => Mo.play(g, 'bow')); (NC.npcs || []).forEach(n => { if (n.g.userData.lookAt === BAND.singer.position) Mo.play(n.g, 'clap'); });
  const AU = NC.Audio; if (AU && AU.musicVol && BAND.prevVol != null) { AU.musicVol.gain.setTargetAtTime(AU.on ? .34 : 0, AU.ctx.currentTime, .8); BAND.prevVol = null; }
  if (BAND.queue.length) setTimeout(nextSong, 2500); else setTimeout(bandEnd, 2500); });
NC.on && NC.on('music:user', () => { BAND.prevVol = null; });   // v20.1 사용자가 음악을 고르면 밴드 신청곡보다 우선
function bandEnd() {
  if (!BAND.on) return; BAND.on = false; clearTimeout(BAND.endT); K.stopSong && K.stopSong(); B(BAND.singer, '감사합니다~ 사랑해요 여러분!! 💕', 2.5);
  setTimeout(() => { BAND.members.forEach(g => NC.scene.remove(g)); BAND.members = []; BAND.props.visible = false; (NC.npcs || []).forEach(n => { if (BAND.singer && n.g.userData.lookAt === BAND.singer.position) n.g.userData.lookAt = null; }); BAND.singer = null;
    const AU = NC.Audio; if (AU && AU.musicVol && BAND.prevVol != null) AU.musicVol.gain.setTargetAtTime(AU.on ? .34 : 0, AU.ctx.currentTime, .8); }, 2600);
  BAND.nextAt = performance.now() + 240000 + Math.random() * 90000; NC.ui.toast('🎧 DJ: "게스트 무대에 큰 박수~! 다시 신나게 달려 볼까요!"');
}
function stageInvite() {          // 무대에 올라온 플레이어에게 가수가 말을 건다
  if (!BAND.on || BAND.asked) return; BAND.asked = true; B(BAND.singer, '무대 위 멋진 분~! 이리 와 봐요! 🎤', 2.6);
  setTimeout(() => {
    if (!BAND.on) return; P().busy = true;
    NC.ui.showDlg({ name: BAND.singer.userData.name, tag: '🎤 초청 무대', job: `🪙 ${NC.Wallet.get()}`, say: '오늘 분위기 최고네요! 저랑 무대에서 같이 놀아요~ 😉',
      opts: [
        { t: '💃 무대에서 같이 춰요 (듀엣)', run: () => { done(); duet(); } },
        { t: '💵 팁 드릴게요 (🪙20)', run: () => { done(); if (!NC.Wallet.spend(20)) return NC.ui.toast('코인이 부족해요'); B(BAND.singer, `${NC.settings.name}님 감사합니다~!! 이 노래 바칠게요 💕`, 3); Mo.play(BAND.singer, 'bow'); (NC.npcs || []).filter(n => n.gender === 'f' && n.enabled).forEach(n => n.aff = U.clamp((n.aff || 40) + 3, 0, 100)); NC.ui.toast('💗 클럽 여성 손님 호감도 +3'); } },
        { t: '📸 기념사진 찍어요', run: () => { done(); photoFlash(); B(BAND.singer, '찰칵~ 예쁘게 나왔죠? ✌', 2.2); Mo.play(BAND.singer, 'wave'); } },
        { t: '괜찮아요, 구경할게요', run: () => done() }] });
    const done = () => { NC.ui.hideDlg(); P().busy = false; };
  }, 1500);
}
function duet() {
  const p = P(), s = BAND.singer; p.x = s.position.x + .9; p.z = s.position.z + .2; p.group.position.set(p.x, ST.y, p.z); p.ry = Math.PI * .1; p.group.rotation.y = p.ry; p.group.userData.dance = 'sing'; p.busy = true;
  B(s, '자~ 같이! 하나 둘 셋~! 🎶', 2.2); (NC.npcs || []).forEach(n => { if (n.g.userData.lookAt === s.position) setTimeout(() => Mo.play(n.g, 'cheer'), Math.random() * 1200); });
  setTimeout(() => { p.group.userData.dance = null; p.busy = false; NC.Wallet.add(15, '듀엣 무대'); B(s, '와~ 노래 진짜 잘하시네요!! 👏', 2.4); NC.ui.toast('🎤 듀엣 성공! 🪙+15 · 관객 환호'); }, 12000);
}
function photoFlash() { const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.9;z-index:99;pointer-events:none;transition:opacity .6s'; document.body.appendChild(f); requestAnimationFrame(() => { f.style.opacity = 0; }); setTimeout(() => f.remove(), 700); NC.ui.toast('📸 가수와 기념사진을 찍었어요!'); }
let lastZone = null;
NC.tickers.push(dt => {
  if (!P() || !P().group) return;
  if (!BAND.on && performance.now() > BAND.nextAt && P().zone && !['karaoke', 'restroom', 'wroom', 'smoke'].includes(P().zone)) bandStart();
  if (BAND.on) { BAND.members.forEach(g => Mo.update(g, dt, { near: true, speed: 1 })); if (P().zone === 'stage' && lastZone !== 'stage') stageInvite(); }
  lastZone = P().zone; tickGroups(dt);
});
NC.interactProviders.push(() => {         // DJ 부스: 게스트 무대 요청
  const p = P(), d = W.spots.dj, dist = Math.hypot(p.x - d.x, p.z - d.z); if (dist > 2.6 || BAND.on || NC.Dialog.cur || online()) return [];
  return [{ label: '🎤 DJ에게 초청 가수 무대 요청 (🪙30)', dist: dist + .2, run: () => { if (!NC.Wallet.spend(30)) return NC.ui.toast('🪙 코인이 부족해요 (30 필요)'); bandStart(); } }];
});

/* ───── ④ 💸 돈 뿌리기 ───── */
const billTex = (() => { const cv = document.createElement('canvas'); cv.width = 96; cv.height = 48; const c = cv.getContext('2d'); c.fillStyle = '#4a9a5a'; c.fillRect(0, 0, 96, 48); c.strokeStyle = '#d8f0c8'; c.lineWidth = 3; c.strokeRect(4, 4, 88, 40); c.fillStyle = '#e8ffd8'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('₩10000', 48, 25); return new T.CanvasTexture(cv); })();
const bills = [];
function throwMoney() {
  const p = P(), cost = 50; if (!NC.Wallet.spend(cost)) return NC.ui.toast(`🪙 코인이 부족해요 (${cost} 필요)`);
  Mo.play(p.group, 'cheer'); NC.ui.toast('💸 돈을 하늘 높이 뿌렸어요!! FLEX~');
  for (let i = 0; i < 36; i++) { const m = new T.Mesh(new T.PlaneGeometry(.22, .11), new T.MeshBasicMaterial({ map: billTex, side: T.DoubleSide, transparent: true }));
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4, tx = U.clamp(p.x + Math.cos(a) * r, ST.x0 + .5, ST.x1 - .5), tz = U.clamp(p.z + Math.sin(a) * r, ST.z0 + 1, ST.z1 + 2.5);
    m.position.set(p.x, NC.groundY(p.x, p.z) + 1.8, p.z); NC.scene.add(m); bills.push({ m, t: 0, from: m.position.clone(), to: new T.Vector3(tx, NC.groundY(tx, tz) + .01, tz), up: 2.5 + Math.random() * 2, dur: 2.2 + Math.random() * 1.6, spin: (Math.random() - .5) * 8, landed: false }); }
  // 손님들이 몰려와 줍고 환호 → 여성 손님 애교
  const near = (NC.npcs || []).filter(avail).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, 7);
  near.forEach((n, i) => { if (n.state === 'off' || !n.enabled) return; setTimeout(() => {
    const b = bills[bills.length - 1 - i * 3] || bills[0]; if (!b) return;
    NC.NPC.goTo(n, { x: b.to.x, z: b.to.z }, () => { Mo.play(n.g, 'pickup'); b.taken = true; setTimeout(() => { B(n.g, U.pick(['돈이다~!! 🤑', '오빠 최고~!!', '꺄~ 부자다!!', '대박 대박!!']), 2); Mo.play(n.g, 'cheer');
      if (n.gender === 'f') setTimeout(() => NC.NPC.goTo(n, { x: p.x + Math.sin(i * 1.3) * 1.0, z: p.z + Math.cos(i * 1.3) * 1.0 }, () => { n.g.userData.lookAt = p.group.position; Mo.play(n.g, 'aegyo'); B(n.g, U.pick(['오빠~♡ 나도 나도!', '오빠 오늘 나랑 놀자~ 💕', '오빠 멋있어~ 사랑해요♡', '헤헤 오빠 한 장만 더~']), 2.6); n.aff = U.clamp((n.aff || 40) + 6, 0, 100); n.state = 'wander'; n.pause = 6; n.wp = { x: n.x, z: n.z, act: 'stand' }; }, 3), 1400);
      else { n.state = 'wander'; n.pause = 3; } }, 1100); }, 3.2);
  }, 500 + i * 180); });
}
NC.tickers.push(dt => {
  for (let i = bills.length - 1; i >= 0; i--) { const b = bills[i]; b.t += dt;
    if (!b.landed) { const e = Math.min(1, b.t / b.dur); b.m.position.lerpVectors(b.from, b.to, e); b.m.position.y = U.lerp(b.from.y, b.to.y, e) + Math.sin(e * Math.PI) * b.up + Math.sin(b.t * 6 + i) * .05 * (1 - e);
      b.m.rotation.set(b.t * b.spin, b.t * b.spin * .7, Math.sin(b.t * 5) * .6); if (e >= 1) { b.landed = true; b.m.rotation.set(-Math.PI / 2, 0, Math.random() * 6); } }
    else if (b.taken || b.t > 25) { b.m.material.opacity -= dt * 2; if (b.m.material.opacity <= 0) { NC.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); bills.splice(i, 1); } } }
});
NC.interactProviders.push(() => { const p = P(); if (p.zone !== 'stage' || NC.Dialog.cur || p.busy) return []; return [{ label: '💸 무대에서 돈 뿌리기 (🪙50)', dist: 3.9, run: throwMoney }]; });

/* ───── ⑤ 술 취해 토하는 손님 (코믹) ───── */
const puddles = []; let vomitT = 30, drinkT = 20;
function vomit(n) {
  n.pause = 4; n.vomited = (n.vomited || 0) + 1; Mo.play(n.g, 'vomit'); B(n.g, U.pick(['우욱… 🤢', '으… 속이…', '나 괜찮아… 우웩']), 2.4);
  setTimeout(() => {
    const fx = new T.Group(); NC.scene.add(fx); const ry = n.g.rotation.y, hx = n.x + Math.sin(ry) * .35, hz = n.z + Math.cos(ry) * .35, gy = NC.groundY(n.x, n.z);
    for (let k = 0; k < 10; k++) { const d = new T.Mesh(new T.SphereGeometry(.025, 6, 4), new T.MeshStandardMaterial({ color: 0x9aa84a, roughness: .3 })); d.position.set(hx, gy + 1.0, hz); d.userData.v = new T.Vector3((Math.random() - .5) * .4, Math.random() * .3, (Math.random() - .5) * .4); fx.add(d); }
    const pd = new T.Mesh(new T.CircleGeometry(.28, 18), new T.MeshStandardMaterial({ color: 0x8a9a3a, roughness: .15, transparent: true, opacity: .85 })); pd.rotation.x = -Math.PI / 2; pd.position.set(hx, gy + .012, hz); pd.scale.setScalar(.1); NC.scene.add(pd);
    puddles.push({ fx, pd, t: 0, n });
    (NC.npcs || []).filter(o => o !== n && o.enabled && o.g.visible && Math.hypot(o.x - n.x, o.z - n.z) < 3.5).slice(0, 3).forEach((o, i) => setTimeout(() => { B(o.g, U.pick(['으악!! 🤮', '어머 더러워!!', '야 괜찮아?!', '헐 대박 ㅋㅋㅋ']), 1.8); Mo.play(o.g, 'flinch'); }, 300 + i * 300));
  }, 1100);
}
NC.tickers.push(dt => {
  if ((drinkT -= dt) <= 0) { drinkT = 40 + Math.random() * 30; const c = (NC.npcs || []).filter(n => avail(n) && n.g.userData.habit === 'drinker' && !n.drunk && n.state === 'wander'); if (c.length && NC.Nightlife) NC.Nightlife.makeDrunk(U.pick(c), 70); }
  if ((vomitT -= dt) <= 0) { vomitT = 22 + Math.random() * 20; const c = (NC.npcs || []).filter(n => n.drunk && n.enabled && n.g.visible && n.state === 'wander' && (n.vomited || 0) < 2); if (c.length) vomit(U.pick(c)); }
  for (let i = puddles.length - 1; i >= 0; i--) { const q = puddles[i]; q.t += dt;
    q.fx.children.forEach(d => { d.userData.v.y -= 9.8 * dt * .5; d.position.addScaledVector(d.userData.v, dt * 2); if (d.position.y < q.pd.position.y) d.visible = false; });
    q.pd.scale.setScalar(Math.min(1, .1 + q.t * .8)); if (q.t > 2) q.fx.visible = false; if (q.t > 25) { q.pd.material.opacity -= dt * .5; if (q.pd.material.opacity <= 0) { NC.scene.remove(q.pd); NC.scene.remove(q.fx); puddles.splice(i, 1); } } }
});
NC.interactProviders.push(() => { const p = P(), out = []; puddles.forEach(q => { const n = q.n, d = Math.hypot(n.x - p.x, n.z - p.z); if (q.t < 15 && !q.helped && d < 2.2 && !NC.Dialog.cur) out.push({ label: `🧻 ${n.name}에게 휴지 건네주기 (E)`, dist: d - .3, run: () => { q.helped = true; n.aff = U.clamp((n.aff || 40) + 5, 0, 100); Mo.play(p.group, 'bow'); B(n.g, U.pick(['고, 고마워요… 창피하다 ㅠㅠ', '헤헤… 오빠 착하다… 물 한 잔만…', '이 은혜는 꼭 갚을게요… 우웁']), 2.6); NC.ui.toast(`💗 ${n.name} 호감도 +5`); } }); }); return out; });

NC.Episodes = { bookToSeat, freeSeatNear, bandStart, bandEnd, throwMoney, vomit, GROUPS, BAND };
console.info('[episodes] 모든 룸 부킹 · 테이블 손님 · 초청 밴드 · 돈 뿌리기 · 토하기 준비 완료');
})();
