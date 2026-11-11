/* service.js — v27 어디서나 웨이터 · 지목 부킹 · 부킹 상대 프로필 카드
 *  ① 상단 「🔔 웨이터」 버튼: 홀·무대·댄스플로어·테이블·VIP·노래방/VIP 룸·흡연실·화장실·라운지·거리·노래방 로비 어디서나
 *     - 노래방/VIP 룸 안: 룸 담당 웨이터가 문으로 들어옴(기존 룸 서비스)
 *     - 클럽 홀: 가장 가까운 웨이터가 실제로 걸어와서 메뉴
 *     - 그 밖의 방: 웨이터가 방 입구로 들어와 메뉴
 *     메뉴: 🍺 주문 · 👥 손님 리스트에서 골라 부킹 · 💃 추천 부킹 · 💵 팁
 *  ② 지목 부킹: 왼쪽 손님 리스트에서 손님을 누르면, 웨이터가 그 손님이 어디 있든(테이블·VIP·흡연실·노래방·플로어) 데려옴
 *     - 둘 다 홀에 있으면 웨이터가 손님에게 걸어가 안내 → 손님이 플레이어에게 걸어옴(앉아 있으면 옆자리로)
 *     - 방 안이면 잠시 뒤 문으로 들어옴 · 수락 여부는 호감도 · 팁(🪙15) · 성격 · 지금 일행 여부로 결정
 *  ③ 부킹 상대와 대화 중이면 그 사람 오른쪽에 네모난 프로필 말풍선(나이·직업·결혼 여부·취미·특기·섹시 포인트·주량·이상형 …)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world) return;
const W = NC.world, U = NC.util, Mo = NC.Motion, P = () => NC.player, T = NC.THREE;
const say = (g, t, s = 2.6) => NC.bubble && NC.bubble(g, t, s);
const K = () => NC.Karaoke, R = () => (NC.Rooms && NC.Rooms.current && NC.Rooms.current()) || null;
const TIP = 15;

/* ═════ 공통: 손님 위치·수락 여부·현재 자리에서 빼내기 ═════ */
const whereOf = n => (NC.whereGuest ? NC.whereGuest(n) : '클럽');
function willCome(n, tip) {
  if (n.stay === 'arrest' || n.gone) return false;
  let p = .45 + (n.aff - 40) / 100 + (tip >= 15 ? .15 : 0) + ({ outgoing: .1, playful: .08, shy: -.08, cool: -.05 }[n.trait] || 0);
  if (n.booked || n.karaoke || n.stay) p -= .15;   // 지금 다른 일행과 있으면 조금 어렵다
  if (n.rejectedAt && performance.now() - n.rejectedAt < 60000) p -= .3;
  return Math.random() < Math.max(.12, Math.min(.95, p));
}
/* 지금 있는 자리(흡연실·노래방 동행·다른 테이블·VIP)에서 빼내 자유 상태로 */
function detach(n) {
  const Kk = K();
  if (Kk && (Kk.guests || []).includes(n) && !Kk.inRoom) { const i = Kk.guests.indexOf(n); if (i >= 0) Kk.guests.splice(i, 1); }
  if (n.stay === 'smoke' && NC.Rooms) { const SM = NC.Rooms.smoke, i = SM.npcs.indexOf(n); if (i >= 0) SM.npcs.splice(i, 1); }
  if (n.stay === 'outing' && NC.Outside && NC.Outside.KS.comp === n) NC.Outside.KS.comp = null;
  if (n.bookSeat) { n.bookSeat.mark(null); n.bookSeat = null; }
  (NC.tableOcc || []).forEach(o => o.forEach((v, k) => { if (v === n || v === n.id) o[k] = null; }));
  (W.vip || []).forEach(v => (v.occ || []).forEach((o, k) => { if (o === n || o === n.id) v.occ[k] = null; }));
  if (n.g.userData.seated) NC.unseatAvatar(n.g, n.x, n.z);
  if (n.party && NC.Party) n.party = null;
  n.stay = null; n.karaoke = false; n.booked = false; n.enabled = true; n.cool = 0; n.state = 'wander'; n.g.userData.dance = null; n.g.userData.lookAt = null;
}
const inHall = () => !R() && !(K() && K().inRoom);
const hallNpc = n => !n.stay && !n.karaoke && n.x > -30 && n.x < 30 && n.z > -25 && n.z < 25;

/* ═════ 웨이터 아바타 (방 안용 임시) ═════ */
let tw = null;
function tempWaiter(x, z) {
  const g = NC.Avatar.create({ name: '🤵 웨이터', look: { gender: 'm', hairStyle: 'comma', hairColor: '#17110f', top: 'vest', topColor: '#121018', inner: 'tee', innerColor: '#f4f2ee', bottom: 'pants', bottomColor: '#121018', shoes: 'sneakers', shoeColor: '#0e0c0c' }, seed: U.hash('웨이터임시'), expr: 'smile', labelColor: '#ffd23d' });
  g.position.set(x, 0, z); NC.scene.add(g); return g;
}
const walkers = [];
function walkG(g, pts, speed, done, n) { walkers.push({ g, pts: pts.slice(), speed, done, n }); }   // n: NPC 면 n.x/n.z 로 움직임(npc.js 가 매 프레임 위치를 다시 씀)

/* ═════ ① 웨이터 부르기 ═════ */
let busy = false, cur = null;   // cur = { kind: 'hall' | 'room', o(웨이터 NPC) | g(임시) }
function call() {
  const p = P(); if (!p.group) return;
  if (NC.Dialog && NC.Dialog.cur) NC.Dialog.close('bye');
  if (K() && K().inRoom) return K().callWaiter();
  if (busy) return NC.ui.toast('🤵 웨이터가 이미 오고 있어요');
  const room = R();
  if (room) {   // 방 안: 입구로 들어옴
    const ex = room.exit || room.entry || { x: 0, z: 0 }, x0 = room.cx + ex.x, z0 = room.cz + ex.z; busy = true;
    const g = tempWaiter(x0, z0); tw = g; if (room.npcs && !room.npcs.includes(g)) { /* 임시 아바타는 방 숨김 대상이 아님 */ }
    NC.ui.toast('🔔 웨이터를 불렀어요'); say(g, '네~ 손님! 부르셨어요? 😄', 2);
    walkG(g, [{ x: p.x + Math.sin(p.ry + .9) * 1.1, z: p.z + Math.cos(p.ry + .9) * 1.1 }], 2.6, () => { g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z); Mo.play(g, 'bow'); cur = { kind: 'room', g, room }; menu(); });
    return;
  }
  // 클럽 홀(무대·플로어·테이블·VIP 1~3 포함): 실제 웨이터가 걸어옴
  const list = (NC.Waiters ? NC.Waiters.list : []).filter(w => !w.busy); if (!list.length) return NC.ui.toast('🤵 웨이터가 모두 바빠요. 잠시 후 다시 불러 주세요');
  const o = list.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; busy = true; o.busy = true;
  const to = standNear(p), route = (NC.Path && NC.Path.find({ x: o.x, z: o.z }, to)) || [to];
  NC.ui.toast(`🔔 웨이터를 불렀어요 — ${o.def.title} 가 가는 중`); if (NC.TableLife && p.seat && p.seat.kind === 'table') NC.TableLife.waveLamp(p.seat.t);
  NC.Waiters.walk(o, route, () => {
    if (!inHall() || Math.hypot(p.x - to.x, p.z - to.z) > 5) { release(); return; }
    o.g.userData.lookAt = p.group.position; Mo.play(o.g, 'bow'); cur = { kind: 'hall', o }; menu();
  }, 3.2);
}
function standNear(p) {
  const base = p.seat && p.seat.kind === 'table' ? NC.tables[p.seat.t] : null;
  const ang = base ? Math.atan2(p.x - base.x, p.z - base.z) : p.ry + .9, r = base ? 2.1 : 1.1, ox = base ? base.x : p.x, oz = base ? base.z : p.z;
  let x = ox + Math.sin(ang) * r, z = oz + Math.cos(ang) * r; const c = NC.collide ? NC.collide({ x, z }) : null; if (c) { x = c.x; z = c.z; } return { x, z };
}
function release() {
  const c = cur; cur = null; busy = false;
  if (c && c.kind === 'hall') { const o = c.o; o.g.userData.lookAt = null; o.busy = false; o.state = 'idle'; }
  else if (c && c.kind === 'room' || tw) { const g = (c && c.g) || tw, room = c && c.room; if (!g) return; const ex = room ? { x: room.cx + (room.exit || room.entry).x, z: room.cz + (room.exit || room.entry).z } : { x: g.position.x, z: g.position.z + 3 };
    walkG(g, [ex], 2.8, () => { NC.scene.remove(g); if (tw === g) tw = null; }); }
}
function wname() { return cur && cur.kind === 'hall' ? cur.o.def.title : '웨이터'; }
function wg() { return cur && (cur.kind === 'hall' ? cur.o.g : cur.g); }
const ORDER = [
  { id: 'beer', icon: '🍺', name: '맥주 한 병', price: 6 }, { id: 'soju', icon: '🍶', name: '소주 한 병', price: 8 },
  { id: 'cocktail', icon: '🍸', name: '칵테일', price: 10 }, { id: 'fruit', icon: '🍉', name: '과일 안주', price: 15 }, { id: 'soda', icon: '🥤', name: '음료수', price: 3 },
];
function menu() {
  const p = P(); p.busy = true; const done = () => { NC.ui.hideDlg(); p.busy = false; };
  const where = R() ? R().label : (NC.world.zoneAt(p.x, p.z).name === 'vip' ? 'VIP 룸' : '테이블');
  NC.ui.showDlg({ name: wname(), tag: `🤵 ${where} 서비스`, job: `🪙 ${NC.Wallet.get()}`, say: U.pick(['네 손님~ 뭘 도와드릴까요? 😄', '부르셨어요? 주문이든 부킹이든 말씀만 하세요!', '오늘 물 좋습니다 손님~ 부킹 한번 가시죠? 😉']),
    opts: [
      { t: '👥 손님 리스트에서 골라 부킹 (🪙15)', run: () => { done(); pickBooking(n => fetchGuest(n), () => { say(wg(), '천천히 고르세요~ 언제든 불러 주세요!', 2); release(); }); } },
      { t: '💃 추천 부킹 부탁해요 (🪙10)', run: () => { done(); recommend(); } },
      { t: '🍺 주문할게요', run: () => { done(); orderMenu(); } },
      { t: '💵 팁 드릴게요 (🪙5)', run: () => { done(); if (NC.Wallet.spend(5)) { say(wg(), '감사합니다 손님! 오늘 부킹은 제가 책임질게요 😎', 2.4); (NC.npcs || []).forEach(n => { if (n.gender === 'f') n.aff = Math.min(100, n.aff + .5); }); } release(); } },
      { t: '괜찮아요, 수고하세요', run: () => { done(); release(); } },
    ] });
}
function orderMenu() {
  const p = P(); p.busy = true; const done = () => { NC.ui.hideDlg(); p.busy = false; };
  NC.ui.showDlg({ name: wname(), tag: '🍺 주문', job: `🪙 ${NC.Wallet.get()}`, say: '뭘로 드릴까요?', opts: ORDER.map(it => ({ t: `${it.icon} ${it.name}  🪙${it.price}`, run: () => {
    done(); if (!(NC.goldenFree && NC.goldenFree()) && !NC.Wallet.spend(it.price)) { NC.ui.toast(`🪙 코인이 부족해요 (${it.price} 필요)`); return release(); }
    say(wg(), '네~ 바로 갖다 드릴게요!', 1.6);
    setTimeout(() => { NC.ui.toast(`${it.icon} ${it.name} 나왔습니다! (🥂 마시기 버튼)`); if (NC.Life && it.id !== 'fruit') { NC.Life.drink = { id: it.id, icon: it.icon, name: it.name, alc: it.id === 'soda' ? 0 : it.id === 'soju' ? 2 : 1 }; NC.Life.sips = 0; P().group.userData.holdGlass = true; } Mo.play(P().group, 'cheers'); release(); }, 1600);
  } })).concat([{ t: '← 돌아가기', run: () => { done(); menu(); } }]) });
}
function recommend() {
  const pool = (NC.npcs || []).filter(n => n.gender === 'f' && (n.role === 'crowd' || n.role === 'persona') && n.enabled !== false && n.state !== 'off' && !n.gone && n.stay !== 'arrest' && !(K() && (K().guests || []).includes(n)) && n !== (NC.Dialog && NC.Dialog.cur && NC.Dialog.cur.n));
  const n = pool.sort((a, b) => (b.aff + Math.random() * 20) - (a.aff + Math.random() * 20))[0];
  if (!n) { say(wg(), '죄송해요, 지금은 모실 분이 없네요…', 2.4); return release(); }
  fetchGuest(n, 10, true);
}

/* ═════ ② 지목 부킹: 리스트에서 고른 손님 데려오기 ═════ */
function pickBooking(cb, onCancel) { if (NC.GuestList && NC.GuestList.startPick) NC.GuestList.startPick(cb, onCancel); }
function fetchGuest(n, tip = TIP, rec) {
  const p = P(), name = wname(), g = wg();
  if (NC.Dialog && NC.Dialog.cur && NC.Dialog.cur.n === n) { NC.ui.toast(`${n.name}님과 이미 대화 중이에요`); return release(); }
  if (!NC.Wallet.spend(tip)) { NC.ui.toast(`🪙 코인이 부족해요 (${tip} 필요)`); return release(); }
  const from = whereOf(n); say(g, rec ? `오늘 ${n.name} 님 분위기 좋더라고요! ${from}에서 모셔 올게요 😉` : `${n.name} 님이요? ${from}에 계시네요. 금방 모셔 올게요! 😄`, 2.8);
  NC.ui.chatAdd(name, `💃 ${n.name} 님 부킹 들어갑니다 — ${from}`);
  const ok = willCome(n, tip);
  const fail = () => { NC.Wallet.add(Math.floor(tip / 2), '부킹 거절 반환'); n.rejectedAt = performance.now(); NC.ui.toast(`🤵 ${name}: "${n.name} 님이 지금은 일행이랑 있겠대요… 팁 절반 돌려드려요 🙇"`); };
  const c = cur;
  // 둘 다 홀이고 손님도 홀에 있으면: 웨이터가 손님에게 걸어가 데려옴
  if (c && c.kind === 'hall' && inHall() && hallNpc(n)) {
    const o = c.o; cur = null; o.g.userData.lookAt = null;
    const r1 = (NC.Path && NC.Path.find({ x: o.x, z: o.z }, { x: n.x + .9, z: n.z + .3 })) || [{ x: n.x + .9, z: n.z + .3 }];
    NC.Waiters.walk(o, r1, () => {
      o.g.userData.lookAt = n.g.position; Mo.play(o.g, 'point'); say(o.g, `${n.name} 님~ 저쪽 손님이 꼭 모시고 싶대요 😉`, 2.4);
      setTimeout(() => {
        if (!ok) { say(n.g, U.pick(['아… 지금은 친구들이랑 있어서요 😅', '오늘은 그냥 놀래요~ 죄송해요!']), 2.2); Mo.play(n.g, 'headshake'); fail(); o.busy = false; busy = false; o.state = 'idle'; return; }
        say(n.g, U.pick(['어머 저요? ㅎㅎ 가 볼까요?', '음… 한번 가 볼게요 💕', '진짜요? 어디요어디요?']), 2); detach(n); n.booked = true;
        bringTo(n, () => { o.busy = false; busy = false; o.state = 'idle'; });
      }, 2400);
    }, 3.2);
    return;
  }
  // 그 밖(방 안 · 손님이 방에 있음): 웨이터가 다녀온 뒤 문으로 들어옴
  release(); busy = true;
  setTimeout(() => {
    busy = false;
    if (!ok) return fail();
    detach(n); n.booked = true;
    if (K() && K().inRoom) { n.booked = false; NC.Wallet.add(tip, '부킹 취소 환불'); NC.ui.toast('🤵 그새 룸에 들어가셨네요 — 룸 안의 🔔 웨이터 호출로 다시 부탁해 주세요'); return; }
    const room = R();
    if (room) { const ex = room.exit || room.entry; n.x = room.cx + ex.x; n.z = room.cz + ex.z; n.g.position.set(n.x, 0, n.z); n.g.visible = true; if (room.npcs && !room.npcs.includes(n)) room.npcs.push(n); n.roomGuest = room; NC.ui.toast(`🚪 ${n.name}님이 들어와요!`); bringTo(n); return; }
    // 플레이어는 홀, 손님은 방 안이었음 → 홀 입구 쪽에서 나타나 걸어옴
    const from = n.stay === 'smoke' ? W.spots.smokeDoor : { x: -6, z: W.corridorY || 10.75 }; n.x = from.x + .8; n.z = from.z; n.g.position.set(n.x, 0, n.z); n.g.visible = true; NC.ui.toast(`💃 ${n.name}님이 오고 있어요!`); bringTo(n);
  }, rec ? 5000 : 6500);
}
/* 손님을 플레이어 곁으로: 앉아 있으면 옆자리, 서 있으면 앞 */
function bringTo(n, after) {
  const p = P(), seat = inHall() && p.seat && NC.Episodes && NC.Episodes.freeSeatNear ? NC.Episodes.freeSeatNear() : null;
  if (seat) { seat.mark('npc');
    NC.NPC.goTo(n, { x: seat.pos.x, z: seat.pos.z }, () => { NC.NPC.sit(n, seat.pos.x, seat.pos.z, seat.pos.ry, seat.pos.h); n.bookSeat = seat; arrive(n); after && after(); }, 2.6); return; }
  const tx = p.x + Math.sin(p.ry) * 1.25, tz = p.z + Math.cos(p.ry) * 1.25;
  const fin = () => { if (!n._bring) return; n._bring = null; arrive(n); after && after(); };
  n._bring = { t0: performance.now(), fin, seat: false };   // 도착 감시: 플레이어 1.7m 안이면 도착 처리(몸끼리 밀려 목표점에 못 닿는 경우)
  if (inHall()) NC.NPC.goTo(n, { x: tx, z: tz }, fin, 2.6);
  else { n.state = 'escort'; walkG(n.g, [{ x: tx, z: tz }], 2.2, fin, n); }
}
function arrive(n) {
  const p = P(); n.g.userData.lookAt = p.group.position; n.aff = Math.max(n.aff || 40, 46); Mo.play(n.g, 'wave'); say(n.g, '안녕하세요~ 💕', 1.6);
  if (!inHall()) { n.state = 'escort'; n.g.userData.moving = false; }
  setTimeout(() => { if (!(NC.Dialog && NC.Dialog.cur)) NC.Dialog.open(n, { intro: U.pick(['웨이터분이 꼭 가 보라고 해서 왔어요 ㅎㅎ', '저 찾으셨다면서요? 반가워요~', '부킹 들어왔다길래 누군가 했어요 ㅎㅎ 앉아도 돼요?']) }); }, 700);
}
// 방에 불려 온 손님: 대화가 끝나면 방을 나가 클럽으로 돌아감
NC.on && NC.on('dialog:close', n => { if (!n || !n.roomGuest) return; const room = n.roomGuest; setTimeout(() => { if (NC.Dialog && NC.Dialog.cur && NC.Dialog.cur.n === n) return; const i = room.npcs.indexOf(n); if (i >= 0) room.npcs.splice(i, 1); n.roomGuest = null; n.booked = false; n.g.visible = R() !== room ? n.g.visible : false; n.x = -6; n.z = W.corridorY || 10.75; n.g.position.set(n.x, 0, n.z); n.state = 'wander'; n.g.userData.lookAt = null; }, 1500); });

/* ═════ 상단 버튼 ═════ */
const btn = document.createElement('button'); btn.id = 'pbWaiter'; btn.title = '어디서나 웨이터 부르기 — 주문 · 손님 리스트에서 골라 부킹'; btn.textContent = '🔔 웨이터';
const attach = () => { const bar = document.getElementById('partyBar'); if (bar) { bar.appendChild(btn); return true; } return false; };
if (!attach()) setTimeout(attach, 500);
btn.onclick = () => call();

/* ═════ ③ 부킹 상대 프로필 카드 ═════ */
const card = document.createElement('div'); card.id = 'profCard'; card.style.display = 'none'; document.body.appendChild(card);
const PICK = (h, a) => a[h % a.length];
const HOBBY = ['필라테스', '맛집 탐방', '캠핑', '골프', '넷플릭스 정주행', '여행 브이로그', '와인 공부', '러닝 크루', '사진 찍기', '홈카페', '보드게임', '등산', '클라이밍', '전시회 관람', '노래방'];
const SKILL = ['요리', '노래', '춤', '운전', '외국어', '피아노', '수영', '그림', '메이크업', '기타 연주', '술자리 게임', '분위기 메이커', '타로 보기', '드럼', '농구'];
const SEXY_F = ['눈웃음', '허스키한 목소리', '긴 생머리', '보조개', '쇄골 라인', '웃을 때 휘어지는 눈', '은은한 향수', '도톰한 입술', '자신감 있는 걸음걸이', '가는 손목'];
const SEXY_M = ['넓은 어깨', '낮은 목소리', '손이 예쁨', '정장 핏', '웃을 때 보조개', '깊은 눈매', '잘 정리된 수염', '팔뚝 핏줄', '다정한 말투', '키 큰 뒷모습'];
const IDEAL = ['유머 있는 사람', '대화가 잘 통하는 사람', '키 큰 사람', '자기 일 열심히 하는 사람', '다정한 사람', '술 잘 맞는 사람', '춤 잘 추는 사람', '듬직한 사람', '센스 있는 사람'];
const DRINK = ['소주 반 병', '소주 1병', '소주 2병', '맥주 3잔', '와인 반 병', '칵테일 두 잔', '말술 🍶'];
function profile(n) {
  if (n.profile) return n.profile; const h = U.hash(String(n.id || n.name)), d = n.def || {}, rr = k => U.hash(n.name + k);
  const job = String(d.job || n.job || '').replace(/^\d+\s*·\s*/, '').split('·')[0].trim() || PICK(rr('job'), ['회사원', '디자이너', '마케터', '간호사', '개발자', '자영업', '승무원', '교사']);
  const age = d.age || (+String(n.job || '').match(/^(\d+)/)?.[1]) || 24 + h % 12;
  const married = age >= 33 && h % 7 === 0 ? '돌싱' : h % 13 === 0 ? '비밀 🤫' : '미혼';
  const likes = Array.isArray(d.likes) && d.likes.length ? d.likes.slice(0, 2).map(l => (l && typeof l === 'object') ? (l.topic || '') : l).filter(Boolean).join(' · ') : `${PICK(rr('h1'), HOBBY)} · ${PICK(rr('h2'), HOBBY)}`;
  return (n.profile = { name: n.name, age, job, mbti: d.mbti || PICK(rr('m'), ['ENFP', 'ISFJ', 'ESTP', 'INFJ', 'ENTP', 'ISTJ', 'ESFP', 'INTP']), married, hobby: likes, skill: PICK(rr('s'), SKILL),
    sexy: PICK(rr('x'), n.gender === 'f' ? SEXY_F : SEXY_M), drink: PICK(rr('d'), DRINK), ideal: PICK(rr('i'), IDEAL), height: n.gender === 'f' ? 158 + h % 14 : 170 + h % 16, tag: n.tag || '' });
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let cardFor = null; const v3 = new T.Vector3();
function fillCard(n) {
  const f = profile(n), aff = Math.round(n.aff || 0);
  card.innerHTML = `<div class="pcHead"><b>${esc(f.name)}</b> <span>${n.gender === 'f' ? '♀' : '♂'} ${f.age}세</span>${f.tag ? `<i>${esc(f.tag)}</i>` : ''}</div>
    <div class="pcRow"><em>💼 직업</em>${esc(f.job)} · ${esc(f.mbti)}</div>
    <div class="pcRow"><em>💍 결혼</em>${esc(f.married)}</div>
    <div class="pcRow"><em>🎯 취미</em>${esc(f.hobby)}</div>
    <div class="pcRow"><em>⭐ 특기</em>${esc(f.skill)}</div>
    <div class="pcRow"><em>💋 섹시 포인트</em>${esc(f.sexy)}</div>
    <div class="pcRow"><em>🍶 주량</em>${esc(f.drink)}</div>
    <div class="pcRow"><em>💘 이상형</em>${esc(f.ideal)}</div>
    <div class="pcRow"><em>📏 키</em>${f.height}cm · 📍 ${esc(whereOf(n))}</div>
    <div class="pcAff"><span style="width:${aff}%"></span><small>호감 ${aff}</small></div>`;
}
let fillT = 0;
NC.tickers.push(dt => {
  // 임시 아바타 걷기(방 안 웨이터·불려 온 손님)
  for (let i = walkers.length - 1; i >= 0; i--) { const w = walkers[i], g = w.g, tg = w.pts[0], dx = tg.x - g.position.x, dz = tg.z - g.position.z, d = Math.hypot(dx, dz);
    if (d < .1) { w.pts.shift(); if (!w.pts.length) { g.userData.moving = false; walkers.splice(i, 1); w.done && w.done(); } continue; }
    const k = Math.min(1, w.speed * dt / d); g.position.x += dx * k; g.position.z += dz * k; if (w.n) { w.n.x = g.position.x; w.n.z = g.position.z; } g.userData.moving = true; g.rotation.y = Math.atan2(dx, dz); }
  if (tw) { Mo.update(tw, dt, { near: true }); if (NC.camera) NC.Avatar.fitLabel(tw, NC.camera); }
  (NC.npcs || []).forEach(n => { const b = n._bring; if (!b) return; const p = P(), d = Math.hypot(n.x - p.x, n.z - p.z), age = performance.now() - b.t0;
    if (d < 1.7 && age > 600) { if (n.state === 'path') { n.path = null; n.state = 'wander'; } b.fin(); }
    else if (age > 25000) { n.x = p.x + Math.sin(p.ry) * 1.2; n.z = p.z + Math.cos(p.ry) * 1.2; n.g.position.set(n.x, n.g.position.y, n.z); n.path = null; b.fin(); } });
  // 프로필 카드: 대화 중인 상대의 머리 오른쪽에
  const D = NC.Dialog, n = D && D.cur && D.cur.n;
  if (!n || !n.g || !n.def) { if (cardFor) { card.style.display = 'none'; cardFor = null; } return; }
  if (cardFor !== n) { cardFor = n; fillCard(n); card.style.display = ''; fillT = 0; }
  fillT -= dt; if (fillT < 0) { fillT = 1; fillCard(n); }
  const cam = NC.camera; if (!cam) return; v3.set(n.g.position.x, n.g.position.y + 1.75, n.g.position.z).project(cam);
  if (v3.z > 1) { card.style.opacity = '0'; return; }
  const sw = innerWidth, sh = innerHeight, talk = document.getElementById('talk'), lim = talk && talk.offsetParent ? talk.getBoundingClientRect().left - 8 : sw - 8;
  const cw = card.offsetWidth || 190, ch = card.offsetHeight || 220; let x = (v3.x * .5 + .5) * sw + 34, y = (-v3.y * .5 + .5) * sh - ch * .35;
  if (x + cw > lim) x = Math.max(8, Math.min(lim - cw, (v3.x * .5 + .5) * sw - cw - 34)); y = Math.max(54, Math.min(sh - ch - 70, y));
  card.style.transform = `translate(${x | 0}px, ${y | 0}px)`; card.style.opacity = '1';
});

/* 스타일 */
{ const st = document.createElement('style'); st.textContent = `
#pbWaiter{background:linear-gradient(135deg,#ffcf4a,#ff8a3d)!important;color:#2a1400!important;font-weight:800}
#profCard{position:fixed;left:0;top:0;z-index:30;width:212px;padding:8px 10px 9px;border-radius:10px;background:rgba(22,12,40,.9);border:1px solid rgba(255,140,210,.55);box-shadow:0 6px 20px rgba(0,0,0,.5);color:#fff;font-size:11px;line-height:1.38;pointer-events:none;transition:opacity .2s;backdrop-filter:blur(4px)}
#profCard:before{content:'';position:absolute;left:-7px;top:34%;border:7px solid transparent;border-left:0;border-right-color:rgba(255,140,210,.55)}
#profCard .pcHead{font-size:12.5px;margin-bottom:4px;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px}#profCard .pcHead span{color:#ffb3df}#profCard .pcHead i{font-style:normal;font-size:10px;color:#ffe08a}
#profCard .pcRow{display:flex;gap:5px}#profCard .pcRow em{flex:0 0 80px;color:#c9b6ff;font-style:normal;white-space:nowrap}
#profCard .pcAff{position:relative;margin-top:5px;height:12px;border-radius:6px;background:rgba(255,255,255,.14);overflow:hidden}#profCard .pcAff span{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ff5fa8,#ffcf4a)}#profCard .pcAff small{position:relative;display:block;text-align:center;font-size:9.5px;line-height:12px}
#glPick{display:flex;align-items:center;gap:6px;margin:4px 6px;padding:6px 8px;border-radius:8px;background:linear-gradient(135deg,#ff3d9a,#ff8a3d);font-size:11.5px}#glPick b{flex:1}#glPick button{border:0;border-radius:6px;padding:3px 8px;background:#2a1030;color:#fff;cursor:pointer}
#guestList.picking .glRow{cursor:pointer;outline:1px dashed rgba(255,140,210,.4)}#guestList.picking .glRow:hover{background:rgba(255,61,154,.35)}
@media (max-width:640px){#profCard{width:160px;font-size:10px}#profCard .pcRow em{flex-basis:56px}}`; document.head.appendChild(st); }

NC.Service = { call, pickBooking, fetchGuest, willCome, detach, whereOf, profile };
console.info('[service] 🔔 어디서나 웨이터 · 👥 지목 부킹 · 💳 프로필 카드 준비 완료');
})();
