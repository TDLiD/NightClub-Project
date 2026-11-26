/* dance.js — v78 💃 신나게 춤추기 + 🎤 DJ 「댄싱 킹 / 퀸」 이벤트
 *  ■ 대화 칩(모든 장소: 홀·테이블·VIP·노래방 룸 — 대화창이 열리는 곳이면 어디든)
 *     · 💃 혼자 신나게 춤추기: 내가 현란하게 추고, 상대는 박수·환호하며 구경 → 끝나면 반응·호감도
 *     · 🕺💃 둘이 신나게 춤추기: 마주 서서 서로 주고받으며 춤(챌린지 배틀 느낌) → 끝나면 하이파이브
 *     · 춤 = 모션캡처 춤 중 강한 것(쿨·강렬·감성·익살)만 3~6초마다 바꿔 가며 박자에 맞춰 1.14배 빠르게(mocap 'showDance')
 *       + 턴(한 바퀴·두 바퀴 스핀)·작은 점프·좌우 몸 흔들기 — 모두 옷 입은 채로 하는 일반적인 클럽 댄스
 *     · 움직이면(WASD·클릭 이동) 바로 끝 · 앉아 있던 상대는 끝나면 제자리에 다시 앉음 · 같이 걷던 상대는 다시 함께 걷기
 *  ■ 댄싱 킹/퀸(DJ 이벤트): 4~7분 뒤 처음, 그다음 9~14분마다 무작위
 *     ① DJ 「댄싱 킹·퀸 시간이에요!!」 → 손님 20여 명이 무대 앞 댄스플로어에 둥글게 모임(무대 쪽은 열어 둠)
 *     ② 도전자 5~6명이 한 명씩 원 가운데로 나와 30초 동안 현란한 춤(스포트라이트가 따라감) — 관객은 환호·박수
 *     ③ 끝나면 관객 여럿이 「OO점!!」 소리쳐 평가 → 평균 점수 발표
 *     ④ 전원 끝나면 1등 발표 → 관객들이 1등을 들어 올려 세 번 헹가래 🎉
 *     · 화면 버튼: 👀 구경하기(원 바깥 자리로 걸어감) · 🙋 나도 참가(마지막 도전자로)
 *  NC.DanceShow = { solo(n), duo(n), stop() } · NC.DanceKing = { start(), stop(), S }
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.THREE) return;
const U = NC.util, P = () => NC.player;
let Mo = NC.Motion, W = NC.world;
const bubble = (g, t, s = 2.6) => NC.bubble && NC.bubble(g, t, s);
const play = (g, k) => { try { Mo = NC.Motion; Mo && Mo.play && Mo.play(g, k, { confetti: false }); } catch (e) { } };
const now = () => performance.now() / 1000;
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ═════ 1. 턴·점프·몸 흔들기(춤추는 사람의 몸 방향·높이에 얹음) ═════ */
const FL = new Map();
function flairOn(g, yaw, opt = {}) { FL.set(g, { yaw, t: Math.random() * 3, next: 1.2 + Math.random() * 2, sp: null, y0: g.position.y, drift: !!opt.drift, big: !!opt.big }); }
function flairOff(g) { const f = FL.get(g); if (!f) return; g.rotation.y = f.yaw; g.position.y = f.y0; FL.delete(g); }
function flairTick(dt) {
  for (const [g, f] of FL) {
    f.t += dt; let a = 0, hop = 0;
    if (!f.sp && f.t > f.next) f.sp = { t: 0, dur: .7 + Math.random() * .3, dir: Math.random() < .5 ? 1 : -1, turns: f.big && Math.random() < .35 ? 2 : 1 };
    if (f.sp) { f.sp.t += dt; const k = Math.min(1, f.sp.t / (f.sp.dur * f.sp.turns)), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      a = e * Math.PI * 2 * f.sp.turns * f.sp.dir; hop = Math.sin(k * Math.PI) * (f.big ? .09 : .05);
      if (k >= 1) { f.sp = null; f.next = f.t + (f.big ? 2.2 : 3) + Math.random() * 3.5; } }
    const base = f.drift ? f.yaw + Math.sin(f.t * .45) * 1.25 : f.yaw;   // 원 가운데에서는 관객 쪽을 돌아가며
    g.rotation.y = base + Math.sin(f.t * 1.9) * .3 + a; g.position.y = f.y0 + hop;
    if (hop > .02 && NC.Pose && NC.Pose.claim) NC.Pose.claim(g, 'dance-hop', 'custom', .25);
  }
}

/* ═════ 2. 신나게 춤추기 (대화 칩) ═════ */
const SD = NC.DanceShow = { on: null };
const SOLO_CHEER = ['와~ 오빠 춤 미쳤다!! 🔥', '오오오~ 리듬 탄다 ㅋㅋㅋ', '꺄~ 한 번 더 돌아요!!', '이거 요즘 챌린지 춤 아니에요? ㅋㅋ', '박자 완전 칼이다 👏'];
const DUO_LINES = ['따라올 수 있어요? ㅎㅎ 💃', '이거 요즘 유행하는 거예요~ 이렇게!', '오~ 제법인데요? 🔥', '한 바퀴 돌고~ 짠!', '우리 합 좀 맞는 듯? ㅋㅋ'];
const SOLO_END = [['오빠 완전 댄스 머신이네요!! 💗', 6], ['아 진짜 웃겨 ㅋㅋㅋ 근데 잘 춰요!', 4], ['다음엔 저도 같이 춰요~ 😊', 3]];
const DUO_END = ['하이파이브~! ✋ 우리 대박이었다 ㅋㅋ', '헉헉… 재밌다!! 한 곡 더 할래요? 💃', '오늘 제일 신났어요 🔥'];
function freeNpc(n) { return n && n.g && n.g.visible && n.state !== 'off' && !n._dk && !(NC.Karaoke && NC.Karaoke.BL && NC.Karaoke.BL.n === n) && !(NC.Motel && NC.Motel.on && NC.Motel.n === n); }
function grab(n) {   // 상대를 지금 하던 일에서 잠깐 빼냄(끝나면 그대로 돌려놓음)
  const u = n.g.userData, pw = NC.PairWalk && NC.PairWalk.n === n;
  const sv = { state: n.state === 'talk' ? (n._preTalk || 'wander') : n.state, seated: !!u.seated, x: n.x, z: n.z, ry: n.g.rotation.y, h: u.seatH, pw };
  if (pw) NC.PairWalk.stop(true);
  if (u.seated) { NC.unseatAvatar && NC.unseatAvatar(n.g, n.x, n.z); u.seated = false; }
  n.state = 'dshow'; n._sd = true; n.path = null; u.moving = false; u.holdGlass = false; return sv;
}
function giveBack(n, sv) {
  const u = n.g.userData; n._sd = false; u.dance = null; u.lookAt = null; flairOff(n.g);
  if (sv.seated && NC.seatAvatar) { n.x = sv.x; n.z = sv.z; NC.seatAvatar(n.g, sv.x, sv.z, sv.ry, sv.h || .5); n.state = 'seated'; return; }
  if (sv.pw && NC.PairWalk) { n.state = 'escort'; NC.PairWalk.start(n, null, true); return; }
  n.state = ['wander', 'idle', 'seated', 'escort'].includes(sv.state) ? sv.state : 'wander'; if (n.state === 'wander') { n.pause = 3 + Math.random() * 3; n.wp = null; }
  if (n.state === 'escort' && !(NC.PairWalk && NC.PairWalk.n === n)) n.state = 'wander';
}
function playerDance(on) {
  const p = P(), u = p.group && p.group.userData; if (!u) return;
  if (on) { if (p.seat && NC.requestStand) NC.requestStand(); u.dance = 'showDance'; p.danceUntil = performance.now() + 1500; flairOn(p.group, p.ry || 0, { big: true }); }
  else { flairOff(p.group); u.dance = null; p.danceUntil = 0; p.ry = p.group.rotation.y; }
}
function startShow(n, mode) {
  if (SD.on) SD.stop(true); if (!freeNpc(n)) return;
  const D = NC.Dialog; if (D && D.cur) D.close('bye');
  const p = P(), sv = grab(n), u = n.g.userData;
  playerDance(true);
  const yawP = p.ry || 0;
  if (mode === 'duo') {   // 내 앞 0.95m 에서 마주 보고
    let tx = p.x + Math.sin(yawP) * .95, tz = p.z + Math.cos(yawP) * .95; n.x = tx; n.z = tz; NC.collide && NC.collide(n, .3);
    n.g.position.set(n.x, NC.groundY ? NC.groundY(n.x, n.z) : n.g.position.y, n.z);
    const yawN = Math.atan2(p.x - n.x, p.z - n.z); n.g.rotation.y = yawN; u.dance = 'showDance'; flairOn(n.g, yawN, { big: true });
    p.group.rotation.y = p.ry = Math.atan2(n.x - p.x, n.z - p.z); flairOff(p.group); flairOn(p.group, p.ry, { big: true });
    bubble(n.g, pick(DUO_LINES), 2.6);
  } else { u.lookAt = p.group.position; n.g.rotation.y = Math.atan2(p.x - n.x, p.z - n.z); bubble(n.g, '오~ 보여 줘요!! 👏', 2.4); play(n.g, 'clap'); }
  SD.on = { n, mode, sv, t: 0, dur: mode === 'duo' ? 26 : 22, next: 3, x0: p.x, z0: p.z };
  NC.ui.toast(mode === 'duo' ? `🕺💃 ${n.name}님과 신나게 춤춰요! (움직이면 끝)` : `💃 혼자 신나게 춤춰요 — ${n.name}님이 구경해요 (움직이면 끝)`);
  if (NC.Features && NC.Features.borrowSpot) { try { NC.Features.borrowSpot('show', '#ffffff', 3, .4); SD.spot = true; } catch (e) { } }
}
SD.solo = n => startShow(n, 'solo');
SD.duo = n => startShow(n, 'duo');
SD.stop = quiet => {
  const o = SD.on; if (!o) return; SD.on = null; playerDance(false); const n = o.n;
  if (SD.spot && NC.Features) { NC.Features.releaseSpot('show'); SD.spot = false; }
  if (!quiet && n.g.visible) {
    if (o.mode === 'duo') { play(n.g, 'cheer'); play(P().group, 'cheer'); bubble(n.g, pick(DUO_END), 3); const d = o.t > 12 ? 6 : 2; n.aff = U.clamp((n.aff || 40) + d, 0, 100); NC.ui.toast(`💗 ${n.name} 호감도 +${d}`); }
    else { const [l, d0] = pick(SOLO_END), d = o.t > 10 ? d0 : 1; play(n.g, 'clap'); bubble(n.g, l, 3); n.aff = U.clamp((n.aff || 40) + d, 0, 100); NC.ui.toast(`💗 ${n.name} 호감도 +${d}`); }
  }
  giveBack(n, o.sv);
};
function showTick(dt) {
  const o = SD.on; if (!o) return; const p = P(), n = o.n, u = n.g.userData; o.t += dt;
  if (!n.g.visible || n.state !== 'dshow' || (NC.Dialog && NC.Dialog.cur)) return SD.stop(true);
  if (o.t < .8) { o.x0 = p.x; o.z0 = p.z; }   // 앉아 있다 일어서며 생긴 위치 변화는 '이동'으로 보지 않음
  if ((p.group.userData.moving && o.t > .6) || Math.hypot(p.x - o.x0, p.z - o.z0) > .6 || o.t > o.dur) return SD.stop(false);
  p.group.userData.dance = 'showDance'; p.danceUntil = performance.now() + 1500;
  if (o.mode === 'duo') u.dance = 'showDance';
  else { u.dance = null; u.lookAt = p.group.position; const yw = Math.atan2(p.x - n.x, p.z - n.z); n.g.rotation.y = U.lerpAngle(n.g.rotation.y, yw, Math.min(1, dt * 4)); }
  if (o.t > o.next) { o.next = o.t + 3.5 + Math.random() * 3; if (o.mode === 'duo') { if (Math.random() < .5) bubble(n.g, pick(DUO_LINES), 2.2); } else { play(n.g, Math.random() < .6 ? 'clap' : 'cheer'); if (Math.random() < .55) bubble(n.g, pick(SOLO_CHEER), 2.2); } }
  if (SD.spot && NC.Features && NC.Features.spotTarget) { const tg = NC.Features.spotTarget(), L = W && W.lights && W.lights.ball; if (tg) tg.position.set(p.x, 0, p.z); if (L) L.position.set(p.x + .4, 7.5, p.z + 1.2); }
}
(NC.dialogChips = NC.dialogChips || []).push((n, CHIP) => {
  if (!n || n.role === 'staff' || !freeNpc(n) || DK.phase || (NC.Motel && NC.Motel.on)) return;
  CHIP('💃 혼자 신나게 춤추기', () => SD.solo(n));
  CHIP('🕺💃 둘이 신나게 춤추기', () => {
    const D = NC.Dialog;
    if ((n.aff || 40) < 30) { D.npcSay(pick(['음… 저는 보는 게 더 좋아요 ㅎㅎ', '아직 좀 쑥스러워요~ 혼자 춰 봐요!']), 'shy'); return; }
    D.npcSay(pick(['좋아요!! 제대로 보여 줄게요 🔥', '이 노래 딱이다~ 가요!! 💃', '오~ 춤 배틀이에요? ㅋㅋ 콜!']), 'laugh');
    setTimeout(() => SD.duo(n), 800);
  });
});

/* ═════ 3. 🎤 댄싱 킹 / 퀸 ═════ */
const DK = NC.DanceKing = { phase: null, S: null, next: now() + 240 + Math.random() * 180, DUR: 30, ts: 1, log: [] };   // ts: 시험용 시간 배율
const C = { x: 0, z: -9.4 };   // 무대 앞 댄스플로어(world.js zones.dance) — 원 가운데
const AUD_SHOUT = ['와아아~!!', '미쳤다 미쳤어!! 🔥', '오오오오~!!', '한 바퀴 더!!', '대박!!', '꺄아~!! 👏', '리듬 봐 리듬!!'];
const btnBar = document.createElement('div'); btnBar.id = 'dkBar';
btnBar.style.cssText = 'position:fixed;left:50%;top:118px;transform:translateX(-50%);z-index:61;display:none;gap:8px';
btnBar.innerHTML = '<button data-a="watch" type="button">👀 구경하기</button><button data-a="join" type="button">🙋 나도 참가</button><button data-a="stop" type="button" title="댄싱 킹/퀸 이벤트를 지금 끝냄">⏹ 이벤트 끝내기</button>';   // v80 끝내기
[...btnBar.children].forEach(b => { b.style.cssText = (b.dataset.a === 'stop' ? 'background:#444a63!important;' : '') + 'padding:8px 16px;border:0;border-radius:999px;background:linear-gradient(90deg,#ff3d9a,#8a3dff);color:#fff;font:700 14px/1.2 inherit;box-shadow:0 4px 16px #0008;cursor:pointer'; });
document.body.appendChild(btnBar);
btnBar.onclick = e => { const a = e.target && e.target.dataset && e.target.dataset.a; if (!a || !DK.S) return; e.stopPropagation();
  if (a === 'stop') { djSay('오늘 댄싱 킹·퀸은 여기까지~!! 다들 수고하셨어요 👏'); announce('⏹ 댄싱 킹/퀸 이벤트 종료', 3, '#9aa3c7'); DK.stop(); NC.ui.toast('⏹ 댄싱 킹/퀸 이벤트를 끝냈어요'); return; }
  if (a === 'watch') watch(); else join(); };
const announce = (t, s, c) => { const F = NC.Features; if (F && F.announce) F.announce(t, s, c); else NC.ui.toast(t); };
const djSay = t => { if (NC.DJ) bubble(NC.DJ, t, 4); NC.ui.chatAdd && NC.ui.chatAdd('🎧 DJ 루나', t); };
function avail(n) {
  W = NC.world; const u = n.g && n.g.userData;
  return n.enabled !== false && u && n.g.visible && (n.state === 'wander' || n.state === 'idle') && !n.booked && !n.stay && !n._escortBy && !n.karaoke && !n.drunk && !n._sd && !u.wardrobe
    && !(NC.PairWalk && NC.PairWalk.n === n) && !(NC.Dialog && NC.Dialog.cur && NC.Dialog.cur.n === n) && !(W && W.extraZones && W.extraZones.some(e => e.test(n.x, n.z))) && (W && W.vipAt ? W.vipAt(n.x, n.z) < 0 : true);
}
function spots(cnt) {   // 원 둘레(무대 쪽 60°는 비움) — 16명 넘으면 바깥 줄
  const out = [], inner = Math.min(cnt, 16);
  for (let i = 0; i < cnt; i++) { const row = i < inner ? 0 : 1, k = row ? i - inner : i, m = row ? cnt - inner : inner, R = row ? 3.7 : 2.8;
    const th = (-150 + (m > 1 ? 300 * k / (m - 1) : 150) + (row ? 300 / Math.max(2, m) / 2 : 0)) * Math.PI / 180;
    out.push({ x: C.x + R * Math.sin(th), z: C.z + R * Math.cos(th) }); }
  return out;
}
DK.start = () => {
  if (DK.phase) return false; Mo = NC.Motion; W = NC.world;
  const pool = (NC.npcs || []).filter(avail); if (pool.length < 8) return false;
  pool.sort((a, b) => Math.hypot(a.x - C.x, a.z - C.z) - Math.hypot(b.x - C.x, b.z - C.z));
  const crowd = pool.slice(0, Math.min(24, pool.length));
  const nC = crowd.length >= 14 ? 6 : 5, fs = U.shuffle ? U.shuffle(crowd.filter(n => n.gender === 'f')) : crowd.filter(n => n.gender === 'f').sort(() => Math.random() - .5), ms = crowd.filter(n => n.gender !== 'f').sort(() => Math.random() - .5);
  const cont = []; while (cont.length < nC && (fs.length || ms.length)) { const a = cont.length % 2 ? ms : fs, b = a === fs ? ms : fs; cont.push((a.length ? a : b).shift()); }
  const sp = spots(crowd.length), order = crowd.slice().sort((a, b) => Math.atan2(a.x - C.x, a.z - C.z) - Math.atan2(b.x - C.x, b.z - C.z));
  const S = DK.S = { crowd, cont: cont.map(n => ({ n, score: 0, shouts: [] })), seat: new Map(), i: -1, t: 0, phT: 0, spot: false, player: null };
  order.forEach((n, i) => { const s = sp[i]; S.seat.set(n, s); n._dk = true; n.g.userData.dance = null; NC.NPC.goTo(n, s, () => { n.state = 'dk'; faceC(n); n.g.userData.dance = Math.random() < .45 ? 'groove' : null; }, 2.6); });
  DK.phase = 'gather'; S.phT = 0;
  djSay('🎤 자~ 여러분!! 댄싱 킹 · 퀸 시간이에요!!! 무대 앞으로 모여 주세요~!! 🔥');
  announce('👑 DANCING KING & QUEEN TIME!! 👑', 7, '#ffd23d');
  btnBar.style.display = 'flex'; btnBar.querySelector('[data-a=join]').style.display = '';
  console.info('[dance] 댄싱 킹/퀸 시작 — 관객', crowd.length, '도전자', cont.map(n => n.name).join(','));
  return true;
};
const faceC = n => { n.g.rotation.y = Math.atan2(C.x - n.x, C.z - n.z); };
function watch() {
  const S = DK.S, p = P(); if (!S || !NC.walkPlayer) return; const s = { x: C.x + Math.sin(.15) * 4.4, z: C.z + Math.cos(.15) * 4.4 };
  let path = [s]; try { if (NC.pathTo) path = NC.pathTo(p.x, p.z, s.x, s.z) || path; } catch (e) { }
  NC.walkPlayer(path, () => { p.ry = Math.atan2(C.x - p.x, C.z - p.z); p.group.rotation.y = p.ry; });
  NC.ui.toast('👀 원 바깥 자리로 가요');
}
function join() {
  const S = DK.S; if (!S || S.player || DK.phase === 'result' || DK.phase === 'toss') return;
  S.player = { n: null, me: true, score: 0, shouts: [] }; S.cont.push(S.player); btnBar.querySelector('[data-a=join]').style.display = 'none';
  NC.ui.toast('🙋 참가 신청 완료! 마지막 도전자로 무대에 나가요'); watch();
}
const nameOf = c => c.me ? ((NC.settings && NC.settings.name) || '나') : c.n.name;
const gOf = c => c.me ? P().group : c.n.g;
function perfEnter(c) {
  const g = gOf(c);
  if (c.me) { const p = P(); let path = [{ x: C.x, z: C.z }]; try { if (NC.pathTo) path = NC.pathTo(p.x, p.z, C.x, C.z) || path; } catch (e) { } NC.walkPlayer(path, () => { }); }
  else { const n = c.n; n.state = 'path'; NC.NPC.goTo(n, { x: C.x, z: C.z }, () => { n.state = 'dk'; }, 2.2); }
  announce(`🎤 ${DK.S.i + 1}번째 도전자 — ${nameOf(c)}!!`, 4, '#3de6ff'); djSay(`${DK.S.i + 1}번째 도전자~ ${nameOf(c)}!! 박수~!! 👏`);
  return g;
}
function perfStart(c) {
  const g = gOf(c), u = g.userData, yaw = Math.atan2(0, 1); u.dance = 'showDance'; u.lookAt = null; flairOn(g, yaw, { drift: true, big: true });
  if (c.me) P().danceUntil = performance.now() + 1500;
  const F = NC.Features; if (F && F.borrowSpot && !DK.S.spot) { try { F.borrowSpot('dk', '#ffffff', 4, .3); DK.S.spot = true; } catch (e) { } }
  const sk = c.me ? 80 + Math.random() * 16 : ({ outgoing: 86, playful: 82, cool: 84, shy: 74 }[u.trait] || 80) + (Math.random() - .3) * 16;
  c.skill = U.clamp(Math.round(sk), 62, 99);
}
function perfEnd(c) {
  const g = gOf(c); flairOff(g); g.userData.dance = null;
  if (c.me) { P().danceUntil = 0; P().ry = g.rotation.y; }
}
function shouts(c) {
  const S = DK.S, aud = S.crowd.filter(n => n !== c.n && n.g.visible).sort(() => Math.random() - .5).slice(0, 6);
  c.shouts = aud.map((n, i) => { const v = U.clamp(Math.round(c.skill + (Math.random() - .5) * 9), 50, 100); setTimeout(() => { if (!DK.S) return; bubble(n.g, `${v}점!!`, 2.6); play(n.g, v >= 90 ? 'cheer' : 'clap'); }, 250 + i * 380); return v; });
  c.score = c.shouts.length ? Math.round(c.shouts.reduce((a, b) => a + b, 0) / c.shouts.length * 10) / 10 : c.skill;
}
function back(c) {
  if (c.me) return; const n = c.n, s = DK.S.seat.get(n); if (!s) return; n.state = 'path'; NC.NPC.goTo(n, s, () => { n.state = 'dk'; faceC(n); }, 2.4);
}
function crowdTick(dt, perfG) {
  const S = DK.S; if (!perfG) return;
  for (const n of S.crowd) { if (n.state !== 'dk' || (S.cur && n === S.cur.n)) continue; const u = n.g.userData; u.lookAt = perfG.position;
    const yw = Math.atan2(perfG.position.x - n.x, perfG.position.z - n.z); n.g.rotation.y = U.lerpAngle(n.g.rotation.y, yw, Math.min(1, dt * 3));
    if (Math.random() < dt * .18) play(n.g, Math.random() < .55 ? 'clap' : 'cheer');
    if (Math.random() < dt * .03) bubble(n.g, pick(AUD_SHOUT), 1.8); }
}
function toss(S, dt) {   // 헹가래: 1등을 눕혀 들어 올려 세 번 위로
  const w = S.win, g = gOf(w), T0 = S.phT, u = g.userData;
  if (!S.lift) {
    const gx = g.position.x, gz = g.position.z, ls = S.crowd.filter(n => n !== w.n && n.g.visible).sort((a, b) => Math.hypot(a.x - gx, a.z - gz) - Math.hypot(b.x - gx, b.z - gz)).slice(0, 6);
    S.lift = ls; S.y0 = g.position.y; S.yaw = g.rotation.y; S.gx = gx; S.gz = gz; S.ord = g.rotation.order; g.rotation.order = 'YXZ';   // 몸 방향(Y) 먼저, 그다음 뒤로 눕힘(X) → 얼굴이 하늘을 봄
    ls.forEach((n, i) => { const a = i / ls.length * Math.PI * 2, x = gx + Math.sin(a) * .62, z = gz + Math.cos(a) * .62; n.state = 'dk'; n.x = x; n.z = z; n.g.position.x = x; n.g.position.z = z; n.g.rotation.y = Math.atan2(gx - x, gz - z); n.g.userData.dance = null; n.g.userData.lookAt = g.position; });
    u.dance = null; if (w.me) P().busy = true;
  }
  if (NC.Pose && NC.Pose.claim) NC.Pose.claim(g, 'dk-toss', 'custom', .4);   // pose.js 가 '임대 없는 몸 기울기·공중 부양'으로 보고 바로 세우지 않게
  const lieK = U.clamp(T0 / .6, 0, 1) * U.clamp((8.2 - T0) / .6, 0, 1), ph = U.clamp((T0 - .8) / 6.3, 0, 1) * 3, f = ph % 1, up = ph > 0 && ph < 3 ? Math.sin(f * Math.PI) : 0;
  g.rotation.set(-Math.PI / 2 * lieK, S.yaw, 0); g.position.y = S.y0 + lieK * (1.05 + up * 1.1);
  { const off = .85 * lieK; g.position.x = S.gx + Math.sin(S.yaw) * off; g.position.z = S.gz + Math.cos(S.yaw) * off; if (!w.me) { w.n.x = S.gx; w.n.z = S.gz; } }   // 발이 아니라 몸 가운데가 원 가운데 위에 오게
  const tossN = Math.floor(ph); if (tossN !== S.lastToss && ph > 0 && ph < 3) { S.lastToss = tossN; S.lift.forEach(n => play(n.g, 'cheer')); bubble(g, pick(['꺄아아~!! 😆', '우와아아~!!', '살려줘~ ㅋㅋㅋ']), 1.4); S.lift.slice(0, 2).forEach(n => bubble(n.g, `${['하나', '둘', '셋'][tossN]}~!!`, 1.2)); }
  return T0 > 8.4;
}
DK.stop = () => {
  const S = DK.S; if (!S) return; DK.phase = null; DK.S = null; btnBar.style.display = 'none';
  if (S.spot && NC.Features) NC.Features.releaseSpot('dk');
  if (S.win) { const g = gOf(S.win); g.rotation.x = 0; g.rotation.z = 0; if (S.ord) g.rotation.order = S.ord; if (S.y0 != null) g.position.y = S.y0; if (S.gx != null) { g.position.x = S.gx; g.position.z = S.gz; } }
  if (S.player) { flairOff(P().group); P().group.userData.dance = null; P().busy = false; P().danceUntil = 0; }
  for (const n of S.crowd) { flairOff(n.g); n._dk = false; const u = n.g.userData; u.dance = null; u.lookAt = null; if (n.state === 'dk' || n.state === 'path' || n.state === 'idle') { n.state = 'wander'; n.pause = 2 + Math.random() * 4; n.wp = null; n.path = null; } }
  DK.next = now() + 540 + Math.random() * 300;
};
function dkTick(dt) {
  { const on = !!DK.S && ['gather', 'enter', 'dance', 'score', 'next'].includes(DK.phase) && !(NC.Karaoke && NC.Karaoke.inRoom) && !(NC.Motel && NC.Motel.on), want = on ? 'flex' : 'none'; if (btnBar.style.display !== want) btnBar.style.display = want; }   // v79 이벤트가 끝나면(어떤 경로로 끝나든) 버튼을 반드시 숨김
  if (!DK.phase) {
    if (!NC.started || now() < DK.next) return;
    const p = P(), inRoom = (NC.Karaoke && NC.Karaoke.inRoom) || (NC.Motel && NC.Motel.on) || (NC.Outside && NC.Outside.on);
    if (inRoom || (NC.Features && NC.Features.mode) || SD.on || !DK.start()) DK.next = now() + 60; return;
  }
  const S = DK.S; if (!S) { DK.phase = null; return; } dt *= DK.ts || 1; S.t += dt; S.phT += dt;
  if (DK.phase === 'gather') {
    const here = S.crowd.filter(n => n.state === 'dk').length;
    if (S.phT > 16 || (here >= S.crowd.length * .85 && S.phT > 7)) { DK.phase = 'enter'; S.i = 0; S.phT = 0; S.cur = S.cont[0]; S.curG = perfEnter(S.cur); }
    return;
  }
  const c = S.cur, g = c && gOf(c);
  if (c && !c.me && (!c.n.g.visible || c.n.state === 'off')) { DK.phase = 'next'; S.phT = 0; }
  if (DK.phase === 'enter') {
    const d = Math.hypot(g.position.x - C.x, g.position.z - C.z);
    if (d < .35 || S.phT > 9) { if (!c.me) { const n = c.n; n.x = C.x; n.z = C.z; n.path = null; n.state = 'dk'; n.g.position.x = C.x; n.g.position.z = C.z; n.g.userData.moving = false; } else if (d > .6) { const p = P(); p.autoPath = null; p.x = C.x; p.z = C.z; } DK.phase = 'dance'; S.phT = 0; perfStart(c); if (!c.me) bubble(g, pick(['간다~!! 🔥', '잘 봐요~ 💃', '음악 크게!!']), 2); }
  } else if (DK.phase === 'dance') {
    if (c.me) { g.userData.dance = 'showDance'; P().danceUntil = performance.now() + 1500; }
    crowdTick(dt, g);
    if (S.spot && NC.Features && NC.Features.spotTarget) { const tg = NC.Features.spotTarget(), L = W && W.lights && W.lights.ball; if (tg) tg.position.set(g.position.x, 0, g.position.z); if (L) { L.position.set(g.position.x + .5, 8, g.position.z + 1.5); L.color && L.color.setHSL((S.t * .12) % 1, .6, .75); } }
    if (S.phT > 10 && S.phT - dt <= 10 && NC.DJ) bubble(NC.DJ, pick(['좋아요~!! 더 크게!! 🔥', '와 이거 레전드 각!!', '반응 미쳤다~!!']), 2.6);
    if (S.phT > DK.DUR) { perfEnd(c); DK.phase = 'score'; S.phT = 0; shouts(c); play(g, 'bow'); }
  } else if (DK.phase === 'score') {
    if (S.phT > 3.4 && !c.told) { c.told = true; announce(`📣 ${nameOf(c)} — 관객 「${c.shouts.slice(0, 4).map(v => v + '점').join('! ')}!」 → 평균 ${c.score}점`, 4, '#ffd23d'); DK.log.push([nameOf(c), c.score]); }
    if (S.phT > 5.2) { back(c); DK.phase = 'next'; S.phT = 0; }
  } else if (DK.phase === 'next') {
    S.i++; S.cur = S.cont[S.i];
    if (!S.cur) { DK.phase = 'result'; S.phT = 0; const done = S.cont.filter(x => x.told).sort((a, b) => b.score - a.score); S.win = done[0] || null;
      if (!S.win) return DK.stop();
      const wg = gOf(S.win), fem = S.win.me ? (P().group.userData.gender === 'f') : S.win.n.gender === 'f';
      announce(`👑 오늘의 댄싱 ${fem ? '퀸' : '킹'}은 ${nameOf(S.win)}!! (${S.win.score}점) 👑`, 7, '#ffd23d');
      (DK.winners = DK.winners || []).push({ name: nameOf(S.win), score: S.win.score, title: fem ? '퀸' : '킹', me: !!S.win.me, at: Date.now() });
      djSay(`오늘의 댄싱 ${fem ? '퀸' : '킹'}!! ${nameOf(S.win)}~!!! 헹가래 갑니다~!! 🎉`);
      if (NC.fx && NC.fx.confetti) NC.fx.confetti(wg.position.x, 2.2, wg.position.z, 120);
      btnBar.style.display = 'none';
      if (!S.win.me) { const n = S.win.n; n.state = 'path'; NC.NPC.goTo(n, { x: C.x, z: C.z }, () => { n.state = 'dk'; }, 2.4); }
      else { const p = P(); let path = [{ x: C.x, z: C.z }]; NC.walkPlayer && NC.walkPlayer(path, () => { }); }
      return; }
    DK.phase = 'enter'; S.phT = 0; S.curG = perfEnter(S.cur);
  } else if (DK.phase === 'result') {
    if (S.phT > 4) { DK.phase = 'toss'; S.phT = 0; if (S.win.me) { S.win.n = null; } else S.win.n.state = 'dk'; }
  } else if (DK.phase === 'toss') {
    if (toss(S, dt)) { const g2 = gOf(S.win); if (NC.Pose && NC.Pose.release) NC.Pose.release(g2, 'dk-toss'); g2.rotation.x = 0; g2.rotation.order = S.ord || 'XYZ'; g2.position.set(S.gx, S.y0, S.gz); if (S.win.me) P().busy = false; bubble(g2, pick(['감사합니다~!! 😭💗', '여러분 사랑해요~!! 🙌']), 3); DK.phase = 'end'; S.phT = 0; }
  } else if (DK.phase === 'end') { if (S.phT > 3) DK.stop(); }
}

/* ═════ 4. v80 무대 춤·디스코 타임: 손님마다 가끔 턴(한 바퀴·두 바퀴)·점프 — 다른 시스템이 정한 몸 방향에 '더해서' 돌기 때문에 끝나면 원래 방향 ═════ */
const SPN = new Map(); let spnT = 0;
function spinTick(dt) {
  spnT -= dt;
  if (spnT <= 0) { spnT = .6;
    const disco = NC.Party && NC.Party.mode === 'disco';
    for (const n of NC.npcs || []) { const g = n.g, u = g && g.userData; if (!u || !g.visible || u.moving || u.seated || SPN.has(g) || FL.has(g) || n._dk || n._sd) continue;
      const hard = u.dance === 'stageDance' || (disco && u.dance === 'groove'); if (!hard) continue;
      if (Math.random() > .085 || SPN.size >= 8) continue;   // 한 사람당 대략 7초에 한 번
      const big = Math.random() < .3; SPN.set(g, { t: 0, dur: big ? 1.1 : .7, turns: big ? 2 : 1, dir: Math.random() < .5 ? 1 : -1, last: 0, hop: Math.random() < .5 ? .07 : 0, y0: g.position.y }); } }
  for (const [g, s] of SPN) { s.t += dt; const k = Math.min(1, s.t / s.dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, a = e * Math.PI * 2 * s.turns * s.dir;
    g.rotation.y += a - s.last; s.last = a;
    if (s.hop) { g.position.y = s.y0 + Math.sin(k * Math.PI) * s.hop; if (NC.Pose && NC.Pose.claim) NC.Pose.claim(g, 'dance-spin', 'custom', .25); }
    if (k >= 1) { if (s.hop) g.position.y = s.y0; SPN.delete(g); } }
}
/* ═════ 5. v84 무대 위에서 5초 동안 아무것도 안 하면 → 내 캐릭터가 혼자 신나게 춤(강한 춤 + 턴·점프) · 움직이거나 무대를 벗어나면 멈춤 ═════ */
const STG = NC.StageSolo = { idle: 0, on: false };
function stageSoloTick(dt) {
  const p = P(); if (!p || !p.group) return; const u = p.group.userData;
  const ok = p.zone === 'stage' && !u.moving && !p.autoPath && !p.target && !p.seat && !p.busy && !(NC.Dialog && NC.Dialog.cur) && !SD.on && !DK.phase && !(NC.Karaoke && NC.Karaoke.BL && NC.Karaoke.BL.n) && !(NC.PairWalk && NC.PairWalk.n);
  if (!ok) { STG.idle = 0; if (STG.on) { STG.on = false; flairOff(p.group); if (u.dance === 'showDance') u.dance = p.zone === 'stage' ? 'stageDance' : null; p.danceUntil = 0; p.ry = p.group.rotation.y; } return; }
  if (!STG.on) { STG.idle += dt; if (STG.idle > 5) { STG.on = true; flairOn(p.group, p.ry || p.group.rotation.y, { big: true }); NC.ui.toast('💃 무대 위에서 신나게 혼자 춤춰요 — 움직이면 멈춰요'); } return; }
  u.dance = 'showDance'; p.danceUntil = performance.now() + 1500;
}
NC.tickers.push(dt => { if (!dt) return; dt = Math.min(dt, .1);
  try { stageSoloTick(dt); } catch (e) { console.warn('[dance] stage solo', e); }
  try { showTick(dt); } catch (e) { console.error('[dance] show', e); try { SD.stop(true); } catch (e2) { SD.on = null; } }
  try { dkTick(dt); if (DK.S && DK.S.t > 60 + DK.S.cont.length * (DK.DUR + 25)) { console.warn('[dance] 댄싱 킹/퀸 시간 초과 → 정리'); DK.stop(); } }
  catch (e) { console.error('[dance] dk', e); try { DK.stop(); } catch (e2) { DK.phase = null; DK.S = null; } btnBar.style.display = 'none'; }   // v79 오류가 나도 이벤트·버튼이 남지 않게
  try { flairTick(dt); } catch (e) { console.error('[dance] flair', e); }
  try { spinTick(dt); } catch (e) { console.error('[dance] spin', e); SPN.clear(); } });
console.info('[dance] v78 신나게 춤추기 · 댄싱 킹/퀸 이벤트');
})();
