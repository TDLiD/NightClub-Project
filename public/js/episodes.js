/* episodes.js — v14 에피소드
 *  ① 모든 룸 부킹: 테이블·VIP 에 앉아 웨이터에게 「💃 부킹 부탁해요」 → 손님이 내 옆자리로 와서 앉음 (노래방은 karaoke.js)
 *  ② 테이블·VIP 손님 50%: 키스하는 커플 · 건배하는 커플 · 싸우는 커플 · 테이블 위에서 춤추는 손님 · VIP 술자리
 *  ③ 초청 밴드/가수: DJ 앞 무대에 등장해 라이브 → 무대에 올라가면 신청곡·듀엣·팁·기념사진, 팬들이 앞으로 몰려듦
 *  ④ 💸 돈 뿌리기(무대): 지폐가 흩날리면 손님들이 줍고 환호 → 여성 손님이 달려와 애교
 *  ⑤ 술 취해 토하는 손님(코믹): 허리 숙여 우웩 → 주변 손님 기겁 · 「🧻 휴지 건네주기」
 */
(() => {
'use strict';
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

/* ───── ② 테이블·VIP 손님 (50%) ───── */
const GROUPS = [];
const LINES = {
  drink: ['짠~! 🥂', '원샷! 원샷!', '오늘 끝까지 달려~', '여기 한 병 더요!'],
  fightA: ['너 아까 그 여자 쳐다봤지?!', '나 집에 갈래!', '진짜 실망이야…', '말 돌리지 마!'], fightB: ['아니 그게 아니라…', '자기야 오해야~', '내가 뭘 했다고!', '미안해… 진짜로'],
  kiss: ['💋', '💕', '…♡'], dance: ['꺄~ 테이블 위가 명당이지!', '다들 소리 질러~!!', '오늘 내가 주인공!'], cheer: ['언니 최고!!', '와아아~👏', '내려와 위험해 ㅋㅋ'],
};
function seatNpc(n, pos, tag) { n.stay = tag; n.state = 'seated'; n.enabled = true; n.g.visible = true; NC.NPC.sit(n, pos.x, pos.z, pos.ry, pos.h); }
function setupGroups() {
  if (online() || GROUPS.length) return;
  const crowd = (NC.npcs || []).filter(n => n.role === 'crowd' && !n.stay && n.enabled), F = crowd.filter(n => n.gender === 'f'), M = crowd.filter(n => n.gender === 'm');
  const take = arr => arr.shift();
  const T_ = NC.tables, TY = W.TY || 0;
  // 키스하는 커플 (테이블 0 옆에 서서 블루스 + 키스)
  { const m = take(M), f = take(F); if (m && f) { const t = T_[0], c = { x: t.x + 1.2, z: t.z + 1.2 }; [m, f].forEach(n => { n.stay = 'table'; n.state = 'blues'; n.g.userData.dance = 'blues'; });
    m.g.userData.bluesLead = true; f.g.userData.bluesLead = false; GROUPS.push({ kind: 'kiss', a: m, b: f, c, t: 0 }); } }
  // 건배 커플 (테이블 1)
  { const m = take(M), f = take(F); if (m && f) { seatNpc(m, NC.seatPos(1, 0), 'table'); seatNpc(f, NC.seatPos(1, 1), 'table'); NC.tableOcc[1][0] = NC.tableOcc[1][1] = 'npc'; GROUPS.push({ kind: 'drink', ns: [m, f], t: 2 }); } }
  // 싸우는 커플 (테이블 3)
  { const m = take(M), f = take(F); if (m && f) { seatNpc(m, NC.seatPos(3, 0), 'table'); seatNpc(f, NC.seatPos(3, 1), 'table'); NC.tableOcc[3][0] = NC.tableOcc[3][1] = 'npc'; GROUPS.push({ kind: 'fight', a: f, b: m, t: 4 }); } }
  // 테이블 위 댄서 + 응원 친구 (테이블 4)
  { const f = take(F), fr = take(F) || take(M); if (f) { const t = T_[4]; f.stay = 'table'; f.state = 'tableDance'; f.x = t.x; f.z = t.z; f.g.position.set(t.x, .82 + TY, t.z); f.g.userData.dance = 'stageDance'; f.g.userData.seated = false;
    if (fr) { seatNpc(fr, NC.seatPos(4, 0), 'table'); NC.tableOcc[4][0] = 'npc'; } NC.tableOcc[4][1] = 'npc'; GROUPS.push({ kind: 'tableDance', a: f, fr, ty: .82 + TY, t: 1 }); } }
  // VIP 3번 술자리 (2명)
  { const v = W.vip[2], m = take(M), f = take(F); if (v && m && f) { [m, f].forEach((n, i) => { seatNpc(n, v.seats[i], 'vip'); v.occ[i] = 'npc'; }); GROUPS.push({ kind: 'vip', ns: [m, f], t: 3 }); } }
  console.info('[episodes] 테이블·VIP 손님 그룹', GROUPS.length);
}
function tickGroups(dt) {
  GROUPS.forEach(g => {
    g.t -= dt;
    if (g.kind === 'kiss') { const a = g.a, b = g.b, now = performance.now() / 1000, d = .21 - .06 * Math.max(0, Math.sin(now * .5)), ang = Math.sin(now * .3) * .3;
      a.x = g.c.x - Math.cos(ang) * d; a.z = g.c.z - Math.sin(ang) * d; b.x = g.c.x + Math.cos(ang) * d; b.z = g.c.z + Math.sin(ang) * d;
      const ry = Math.atan2(b.x - a.x, b.z - a.z); a.g.rotation.y = ry; b.g.rotation.y = ry + Math.PI; const k = Math.max(0, Math.sin(now * .5)); a.g.userData.kissK = b.g.userData.kissK = k;
      a.g.position.set(a.x, NC.groundY(a.x, a.z), a.z); b.g.position.set(b.x, NC.groundY(b.x, b.z), b.z); if (g.t <= 0) { g.t = 9; if (k > .5) B(b.g, U.pick(LINES.kiss), 1.6); } }
    else if (g.kind === 'drink' || g.kind === 'vip') { if (g.t <= 0) { g.t = 6 + Math.random() * 5; g.ns.forEach((n, i) => setTimeout(() => Mo.play(n.g, Math.random() < .5 ? 'cheers' : 'drink'), i * 250)); B(g.ns[0].g, U.pick(LINES.drink)); } }
    else if (g.kind === 'fight') { if (g.t <= 0) { g.t = 7 + Math.random() * 4; B(g.a.g, U.pick(LINES.fightA), 2.4); Mo.play(g.a.g, Math.random() < .5 ? 'headshake' : 'crossArms');
      setTimeout(() => { B(g.b.g, U.pick(LINES.fightB), 2.2); Mo.play(g.b.g, 'bow'); }, 2400); } }
    else if (g.kind === 'tableDance') { const a = g.a; a.g.position.y = g.ty; if (g.t <= 0) { g.t = 8; B(a.g, U.pick(LINES.dance), 2); if (g.fr) { Mo.play(g.fr.g, 'clap'); setTimeout(() => B(g.fr.g, U.pick(LINES.cheer), 1.8), 900); } } }
  });
}
(function trySetup() { if ((NC.npcs || []).length && NC.player && NC.player.group) setupGroups(); else setTimeout(trySetup, 1500); })();

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
  const AU = NC.Audio; if (AU && AU.musicVol) { BAND.prevVol = AU.musicVol.gain.value; AU.musicVol.gain.setTargetAtTime(.05, AU.ctx.currentTime, .5); }
  NC.ui.toast(`🎧 DJ: "여러분~ 오늘의 스페셜 게스트! ${name} 입니다!! 👏"`); NC.ui.chatAdd && NC.ui.chatAdd('DJ 노스탤지어', `${name} 무대 시작합니다! 무대 앞으로 오세요~ 🎶`);
  NC.fireCO2 && NC.fireCO2();
  // 팬들이 무대 앞으로
  (NC.npcs || []).filter(avail).sort(() => Math.random() - .5).slice(0, 6).forEach((n, i) => { const x = -4 + i * 1.6 + (Math.random() - .5) * .4, z = FRONT + 1.0 + Math.random() * .8; NC.NPC.goTo(n, { x, z }, () => { n.state = 'wander'; n.pause = 40; n.wp = { x, z, act: 'dance' }; n.g.rotation.y = Math.PI; n.g.userData.dance = 'groove'; if (BAND.singer) n.g.userData.lookAt = BAND.singer.position; Mo.play(n.g, 'cheer'); }, 2.6); });
  BAND.queue = [U.pick(K.songs)]; BAND.left = 2; nextSong();
}
function nextSong() {
  if (!BAND.on) return; const song = BAND.queue.shift() || U.pick(K.songs); BAND.song = song; BAND.lyric = 0;
  K.playSong(song, 'band'); B(BAND.singer, `♪ ${song.title} ♪`, 3);
}
NC.on && NC.on('band:songEnd', () => { if (!BAND.on || !BAND.singer) return; BAND.members.forEach(g => Mo.play(g, 'bow')); (NC.npcs || []).forEach(n => { if (n.g.userData.lookAt === BAND.singer.position) Mo.play(n.g, 'clap'); });
  if (--BAND.left > 0 || BAND.queue.length) setTimeout(nextSong, 2500); else setTimeout(bandEnd, 2500); });
function bandEnd() {
  if (!BAND.on) return; BAND.on = false; K.stopSong && K.stopSong(); B(BAND.singer, '감사합니다~ 사랑해요 여러분!! 💕', 2.5);
  setTimeout(() => { BAND.members.forEach(g => NC.scene.remove(g)); BAND.members = []; BAND.props.visible = false; (NC.npcs || []).forEach(n => { if (BAND.singer && n.g.userData.lookAt === BAND.singer.position) n.g.userData.lookAt = null; }); BAND.singer = null;
    const AU = NC.Audio; if (AU && AU.musicVol && BAND.prevVol != null) AU.musicVol.gain.setTargetAtTime(BAND.prevVol, AU.ctx.currentTime, .8); }, 2600);
  BAND.nextAt = performance.now() + 240000 + Math.random() * 90000; NC.ui.toast('🎧 DJ: "게스트 무대에 큰 박수~! 다시 신나게 달려 볼까요!"');
}
function stageInvite() {          // 무대에 올라온 플레이어에게 가수가 말을 건다
  if (!BAND.on || BAND.asked) return; BAND.asked = true; B(BAND.singer, '무대 위 멋진 분~! 이리 와 봐요! 🎤', 2.6);
  setTimeout(() => {
    if (!BAND.on) return; P().busy = true;
    NC.ui.showDlg({ name: BAND.singer.userData.name, tag: '🎤 초청 무대', job: `🪙 ${NC.Wallet.get()}`, say: '오늘 분위기 최고네요! 신청곡 있으세요? 아니면 저랑 한 소절 같이 부를래요? 😉',
      opts: K.songs.slice(0, 4).map(s => ({ t: `🎵 신청곡: ${s.title} (${s.genre})`, run: () => { done(); BAND.queue.unshift(s); BAND.left = Math.max(BAND.left, 1); B(BAND.singer, `다음 곡은 신청곡! 「${s.title}」 갑니다~!`, 2.6); NC.ui.toast('🎶 신청곡이 다음 곡으로 예약됐어요'); } })).concat([
        { t: '🎤 같이 한 소절 불러요 (듀엣)', run: () => { done(); duet(); } },
        { t: '💵 팁 드릴게요 (🪙20)', run: () => { done(); if (!NC.Wallet.spend(20)) return NC.ui.toast('코인이 부족해요'); NC.Audio.sfx('coin'); B(BAND.singer, `${NC.settings.name}님 감사합니다~!! 이 노래 바칠게요 💕`, 3); Mo.play(BAND.singer, 'bow'); (NC.npcs || []).filter(n => n.gender === 'f' && n.enabled).forEach(n => n.aff = U.clamp((n.aff || 40) + 3, 0, 100)); NC.ui.toast('💗 클럽 여성 손님 호감도 +3'); } },
        { t: '📸 기념사진 찍어요', run: () => { done(); photoFlash(); B(BAND.singer, '찰칵~ 예쁘게 나왔죠? ✌', 2.2); Mo.play(BAND.singer, 'wave'); } },
        { t: '괜찮아요, 구경할게요', run: () => done() }]) });
    const done = () => { NC.ui.hideDlg(); P().busy = false; };
  }, 1500);
}
function duet() {
  const p = P(), s = BAND.singer; p.x = s.position.x + .9; p.z = s.position.z + .2; p.group.position.set(p.x, ST.y, p.z); p.ry = Math.PI * .1; p.group.rotation.y = p.ry; p.group.userData.dance = 'sing'; p.busy = true;
  B(s, '자~ 같이! 하나 둘 셋~! 🎶', 2.2); (NC.npcs || []).forEach(n => { if (n.g.userData.lookAt === s.position) setTimeout(() => Mo.play(n.g, 'cheer'), Math.random() * 1200); });
  setTimeout(() => { p.group.userData.dance = null; p.busy = false; NC.Wallet.add(15, '듀엣 무대'); B(s, '와~ 노래 진짜 잘하시네요!! 👏', 2.4); NC.ui.toast('🎤 듀엣 성공! 🪙+15 · 관객 환호'); }, 12000);
}
function photoFlash() { const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.9;z-index:99;pointer-events:none;transition:opacity .6s'; document.body.appendChild(f); requestAnimationFrame(() => { f.style.opacity = 0; }); setTimeout(() => f.remove(), 700); NC.Audio.sfx && NC.Audio.sfx('tick'); NC.ui.toast('📸 가수와 기념사진을 찍었어요!'); }
let lastZone = null;
NC.tickers.push(dt => {
  if (!P() || !P().group) return;
  if (!BAND.on && performance.now() > BAND.nextAt && P().zone && !['karaoke', 'restroom', 'wroom', 'smoke'].includes(P().zone)) bandStart();
  if (BAND.on) { BAND.members.forEach(g => Mo.update(g, dt, { near: true, speed: 1 })); if (P().zone === 'stage' && lastZone !== 'stage') stageInvite(); }
  lastZone = P().zone; tickGroups(dt);
});
NC.interactProviders.push(() => {         // DJ 부스: 게스트 무대 요청
  const p = P(), d = W.spots.dj, dist = Math.hypot(p.x - d.x, p.z - d.z); if (dist > 2.6 || BAND.on || NC.Dialog.cur || online()) return [];
  return [{ label: '🎤 DJ에게 초청 가수 무대 요청 (🪙30)', dist: dist + .2, run: () => { if (!NC.Wallet.spend(30)) return NC.ui.toast('🪙 코인이 부족해요 (30 필요)'); NC.Audio.sfx('coin'); bandStart(); } }];
});

/* ───── ④ 💸 돈 뿌리기 ───── */
const billTex = (() => { const cv = document.createElement('canvas'); cv.width = 96; cv.height = 48; const c = cv.getContext('2d'); c.fillStyle = '#4a9a5a'; c.fillRect(0, 0, 96, 48); c.strokeStyle = '#d8f0c8'; c.lineWidth = 3; c.strokeRect(4, 4, 88, 40); c.fillStyle = '#e8ffd8'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('₩10000', 48, 25); return new T.CanvasTexture(cv); })();
const bills = [];
function throwMoney() {
  const p = P(), cost = 50; if (!NC.Wallet.spend(cost)) return NC.ui.toast(`🪙 코인이 부족해요 (${cost} 필요)`);
  Mo.play(p.group, 'cheer'); NC.Audio.sfx('coin'); NC.ui.toast('💸 돈을 하늘 높이 뿌렸어요!! FLEX~');
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

NC.Episodes = { bookToSeat, bandStart, bandEnd, throwMoney, vomit, GROUPS, BAND };
console.info('[episodes] 모든 룸 부킹 · 테이블 손님 · 초청 밴드 · 돈 뿌리기 · 토하기 준비 완료');
})();
