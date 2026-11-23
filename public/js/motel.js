/* motel.js — 🏨 모텔 가기 패키지 (v58 신규)
 *  ■ 노래방(2차 노래방 룸) 안에서만 보이는 「🏨 모텔」 메뉴 — 클럽·VIP·거리 등 다른 곳에는 버튼·초대·선택지가 전혀 나오지 않음
 *  ■ 흐름: 노래방 → 초대(8가지 말투, 남녀 누구나·NPC 도 먼저 제안) → 서로 동의 → 모텔 고르기(3곳) → 방 종류(5) · 대실/숙박 → 결제(6가지)
 *          → 이동(택시·모범택시·걷기·자가용) → 모텔 앞(네온·주차장·비) → 로비 카운터 체크인(열쇠) → 엘리베이터 → 복도(호실) → 객실
 *          → 객실 활동(일반 11 · 로맨틱 10 · 기타) · 랜덤 이벤트(24종) → 체크아웃(조기 퇴실 환불·연장·업그레이드) → 나이트 / 노래방 / 각자 귀가
 *  ■ 관계·결정 엔진: 호감도·신뢰·로맨틱 성향·기분·자신감·경계심·에너지·음주·지난 기록(방문·거절·재촉)으로 결정 — 무작위가 아님(같은 상황 = 같은 답)
 *     · 누구든 언제나 거절·보류·중단·퇴장 가능, 거절하면 그 초대는 즉시 끝 · 반복해서 조르면(재촉) 신뢰가 깎이고 상대가 자리를 뜸
 *     · 많이 취한 사람(본인·상대)은 모텔로 가지 않음(판단력 저하) — 물·택시로 귀가를 권함 · 성인(19+) 캐릭터만
 *     · 로맨틱 행동은 매번 동의 확인(편안함 수치) — 노골적인 표현 없음(수위: 손잡기·포옹·기대기·이마·볼·가벼운 키스까지, 밤은 페이드로 넘어감)
 *  ■ 공간: x=320 쪽 별도 구역 4곳(rooms.js 의 방 구조 재사용: 클럽 숨김·광원 빌려 쓰기 → 광원 수 불변, 끊김 없음) · 객실은 종류별로 다시 꾸밈
 *  ■ 캐릭터: 같이 걷기(옆 0.6m·속도 맞춤·눈맞춤) · 앉기(소파·침대) · 손잡기(2관절 IK) · 포옹/키스/이마/볼(커플 IK·얼굴 IK = couple.js·karaoke.js 블루스 시스템)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world || !NC.Rooms || !NC.Karaoke || !NC.THREE) return;
const T = NC.THREE, M = NC.mat, U = NC.util, W = NC.world, RM = NC.Rooms, K = NC.Karaoke, col = NC.col, $ = NC.$;
const EN = NC.lang === 'en', L = (ko, en) => (EN && en != null ? en : ko), pick = a => a[Math.random() * a.length | 0];
const P = () => NC.player;
const box = (w, h, d) => new T.BoxGeometry(w, h, d), cyl = (a, b, h, s = 16) => new T.CylinderGeometry(a, b, h, s);
const glow = (c, k = 2.4) => { const m = new T.MeshBasicMaterial({ color: col(c) }); m.color.multiplyScalar(k); return m; };
const std = (c, o) => M.std(c, o), pbr = (n, o) => (M.pbr ? M.pbr(n, o) : M.std((o && o.color) || '#888'));
const BX = 320;   // 거리(200,0)·노래방 카운터(200,40)·2층 라운지(200,-40)와 겹치지 않는 곳

/* ═════════════ 0. 기억(관계 기록) — localStorage ═════════════ */
const DB = U.store.get('nc_motel', null) || { npc: {}, me: { visits: 0, vip: false, spent: 0, coupon: true, log: [] } };
const save = () => { try { U.store.set('nc_motel', DB); } catch (e) { } };
const memOf = n => { const k = n.id || n.name; return DB.npc[k] || (DB.npc[k] = { trust: 25, visits: 0, rej: 0, asks: 0, lastAsk: 0, lastOut: '', postponed: 0, pressure: 0, gifts: 0, seen: [] }); };
const logMe = s => { DB.me.log.unshift(`${new Date().toLocaleString()} · ${s}`); DB.me.log.length = Math.min(DB.me.log.length, 30); save(); };

/* ═════════════ 1. 성격 · 결정 엔진 ═════════════ */
const TR = {   // ro 로맨틱 · cf 자신감 · bd 경계심 · pl 장난기 · room 선호 방 · pay 먼저 내려는 정도 · style 말투
  shy:      { ro: .5,  cf: .25, bd: .8,  pl: .3,  room: 'std', pay: .25, style: L('수줍고 조심스러운', 'shy and careful') },
  cool:     { ro: .55, cf: .8,  bd: .55, pl: .35, room: 'vip', pay: .65, style: L('성숙하고 세련된', 'mature and composed') },
  playful:  { ro: .62, cf: .7,  bd: .38, pl: .9,  room: 'jac', pay: .4,  style: L('장난스럽고 유쾌한', 'playful and funny') },
  outgoing: { ro: .6,  cf: .85, bd: .42, pl: .7,  room: 'rom', pay: .5,  style: L('밝고 적극적인', 'bright and outgoing') },
};
const tr = n => TR[n && n.trait] || TR.outgoing;
const noise = (n, salt) => ((U.hash(String(n.id || n.name) + ':' + salt) % 1000) / 1000 - .5);   // 같은 사람·같은 상황이면 같은 값(무작위 아님)
const adult = n => { const a = n && n.def && +n.def.age; return !a || a >= 19; };
function attrs(n) {
  const m = memOf(n), t = tr(n), life = NC.Life || {}, min = (performance.now() - (n._motelMet || performance.now())) / 60000;
  if (adminMax()) return { attraction: 100, trust: 100, romance: 100, mood: 1, confidence: 100, boundary: 0, energy: 100, alcohol: n.drunk ? 85 : 0, meAlcohol: Math.round((life.tipsy || 0) * 20), visits: m.visits, rejections: m.rej, admin: true };
  return {
    attraction: Math.round(n.aff), trust: Math.round(U.clamp(m.trust + Math.min(20, min * 2.5) + m.visits * 12 - m.rej * 6 - m.pressure * 8, 0, 100)),
    romance: Math.round(t.ro * 100), mood: n.mood || 0, confidence: Math.round(t.cf * 100), boundary: Math.round(t.bd * 100),
    energy: Math.round(U.clamp(100 - min * 1.1 - (S.clockMin || 0) * .12, 15, 100)), alcohol: n.drunk ? 85 : 0, meAlcohol: Math.round((life.tipsy || 0) * 20), visits: m.visits, rejections: m.rej,
  };
}
const impaired = n => !!(n && n.drunk) || ((NC.Life && NC.Life.tipsy) || 0) >= 3.5;
/* v59 👑 관리자 테스트 만점 모드 — admin 계정으로 로그인하면 기본 켜짐(상단 🧪 버튼으로 끄고 켬, 브라우저에 저장)
 *  · 모든 손님 호감도 100·기분 최고(2초마다 유지) → 블루스(부르스) 모든 동작·노래방 동반·부킹이 받아들여짐
 *  · 모텔: 호감·신뢰·로맨틱·자신감·에너지 100, 경계심 0, 객실 편안함 100 → 초대·로맨틱 동작 모두 수락
 *  · 음주(판단력) 규칙은 그대로 — 많이 취하면 테스트 중에도 모텔 이동이 막힘 */
const isAdmin = () => !!(NC.account && NC.account.role === 'admin');
const adminMax = () => isAdmin() && U.store.get('nc_admin_max', '1') !== '0';
NC.adminMax = adminMax;
const STYLES = [
  { id: 'suggest', t: L('🏨 모텔 가자고 제안하기', '🏨 Suggest going to a motel'), mod: () => -4, me: [L('우리… 여기서 나가서 모텔 갈래요?', 'Shall we… head to a motel from here?')] },
  { id: 'invite', t: L('💑 정식으로 초대하기', '💑 Invite properly'), mod: () => 0, me: [L('오늘 정말 즐거웠어요. 조용한 데서 둘이 더 얘기하고 싶은데… 같이 갈래요?', 'I had a great time. I’d love to keep talking somewhere quiet… will you come with me?')] },
  { id: 'getaway', t: L('❤️ 로맨틱한 하룻밤 제안', '❤️ Romantic getaway'), mod: n => tr(n).ro * 14 - 5, me: [L('오늘 밤은 좀 특별하게 보내고 싶어요. 예쁜 방 하나 잡을까요?', 'I want tonight to be special. Shall we get a nice room?')] },
  { id: 'continue', t: L('🌙 오늘 밤 더 같이 있고 싶어요', '🌙 Continue the night together'), mod: () => 4, me: [L('아직 헤어지기 싫어요. 오늘 밤 조금 더 같이 있을래요?', 'I don’t want to say goodbye yet. Stay a little longer tonight?')] },
  { id: 'private', t: L('🚕 둘만 있는 곳으로 가요', '🚕 Somewhere private'), mod: n => tr(n).bd > .6 ? -9 : 1, me: [L('여기 너무 시끄럽다… 둘만 있는 데로 갈까요?', 'It’s so loud here… shall we go somewhere just us?')] },
  { id: 'extend', t: L('🥂 데이트 연장하기', '🥂 Extend the date'), mod: () => 6, me: [L('노래방 끝나고 바로 헤어지긴 아쉽다… 데이트 연장할래요?', 'It’s a shame to end it here… extend our date?')] },
  { id: 'ask', t: L('💬 같이 있어도 되는지 물어보기', '💬 Ask about staying together'), mod: () => 8, me: [L('혹시… 오늘 밤 같이 있어도 괜찮아요? 싫으면 편하게 말해 줘요.', 'Would it be okay if we stayed together tonight? Just say if you’d rather not.')] },
  { id: 'surprise', t: L('🎲 깜짝 행선지', '🎲 Surprise destination'), mod: n => tr(n).pl * 15 - 7, me: [L('눈 감아 봐요… 깜짝 놀랄 데 데려갈게요 ㅎㅎ', 'Close your eyes… I’ll take you somewhere surprising.')] },
];
function inviteScore(n, style) {
  if (adminMax()) return 100;
  const a = attrs(n), m = memOf(n), recent = m.postponed && Date.now() - m.postponed < 15 * 60e3;
  return 10 + .5 * a.attraction + .22 * a.trust + (a.romance - 50) * .15 + a.mood * 6 + (style ? style.mod(n) : 0) - (a.boundary - 50) * .18 - m.pressure * 10 + m.visits * 4
    + noise(n, 'inv' + m.asks) * 10 + (recent && n.aff > (m.affAtPost || 0) + 3 ? 5 : 0) + (a.energy < 35 ? -6 : 0);
}
function decide(n, style) {
  const m = memOf(n); m.asks++;
  if (!adult(n)) return { out: 'reject', why: 'minor' };
  if (impaired(n)) return { out: 'impaired' };
  if (adminMax()) { n.aff = 100; m.lastOut = 'eager'; m.lastAsk = Date.now(); save(); return { out: 'eager', score: 100, admin: true }; }
  if (!adminMax() && m.lastOut && /decline|reject/.test(m.lastOut) && Date.now() - m.lastAsk < 90e3) { m.pressure++; m.lastAsk = Date.now(); save(); return { out: 'pressure' }; }
  let s = inviteScore(n, style); if (n.aff < 55) s = Math.min(s, 46);
  const out = s >= 76 ? 'eager' : s >= 64 ? 'accept' : s >= 57 ? 'discuss' : s >= 50 ? 'later' : s >= 40 ? 'decline' : 'reject';
  m.lastAsk = Date.now(); m.lastOut = out; save(); return { out, score: Math.round(s) };
}
/* 대사 — 성격·결과별(한국어/영어) */
const LINES = {
  eager: { shy: [['…네. 저도 사실 같은 생각했어요 💗', '…Yes. I was actually thinking the same 💗']], cool: [['좋아요. 그런 말 기다리고 있었어요.', 'Good. I was waiting for you to say that.']], playful: [['콜! 대신 방은 제가 고를래요 ㅋㅋ', 'Deal! But I get to pick the room, haha']], outgoing: [['완전 좋아요!! 지금 바로 가요 ㅎㅎ', 'I’d love that!! Let’s go right now!']] },
  accept: { shy: [['음… 조금 떨리지만… 좋아요.', 'Um… I’m a bit nervous, but… okay.']], cool: [['그래요. 같이 가요.', 'Alright. Let’s go together.']], playful: [['흐음~ 생각해 보니 나쁘지 않네? 가요!', 'Hmm~ actually, not a bad idea. Let’s go!']], outgoing: [['좋아요~ 오늘 끝까지 같이 놀아요!', 'Sure~ let’s hang out till the end tonight!']] },
  discuss: { shy: [['그냥… 얘기하고 쉬는 거 맞죠? 저 아직 좀 조심스러워서요.', 'We’d just… talk and rest, right? I’m still a bit cautious.']], cool: [['어떤 생각으로 하는 말인지 먼저 듣고 싶어요.', 'I’d like to hear what you have in mind first.']], playful: [['어머~ 무슨 꿍꿍이예요? 솔직하게 말해 봐요 ㅋㅋ', 'Ooh, what are you up to? Be honest, haha']], outgoing: [['갑자기요? 왜요~ 이유가 궁금하네 ㅎㅎ', 'All of a sudden? Why~? I’m curious, haha']] },
  later: { shy: [['조금만… 생각할 시간 줄래요?', 'Could you give me… a little time to think?']], cool: [['지금 바로 답하긴 어렵네요. 조금 있다가 다시 얘기해요.', 'Hard to answer right now. Let’s talk again in a bit.']], playful: [['음~ 노래 몇 곡 더 부르고 결정할래요!', 'Hmm~ let me sing a few more songs and decide!']], outgoing: [['헉 고민된다… 조금만 이따 다시 물어봐 줘요!', 'Ooh, tough one… ask me again in a bit!']] },
  decline: { shy: [['미안해요… 오늘은 여기까지가 좋을 것 같아요.', 'Sorry… I think tonight should end here.']], cool: [['고맙지만, 오늘은 아니에요.', 'Thanks, but not tonight.']], playful: [['에이~ 오늘은 노래만 하기로 해요 ㅎㅎ', 'Nah~ let’s just stick to singing tonight, haha']], outgoing: [['아 오늘은 좀 그래요~ 대신 노래 한 곡 더!', 'Not tonight~ but one more song instead!']] },
  reject: { shy: [['…그런 말 들으니까 좀 불편해요.', '…That makes me a little uncomfortable.']], cool: [['우리 그런 사이 아니잖아요.', 'We’re not like that.']], playful: [['헐… 너무 나갔다 ㅋㅋ 아니에요.', 'Whoa… that’s too far. No.']], outgoing: [['음… 그건 아닌 것 같아요.', 'Um… no, I don’t think so.']] },
  pressure: { _: [['방금 싫다고 했잖아요. 자꾸 그러면 저 불편해요.', 'I just said no. If you keep pushing, I’m uncomfortable.']] },
  impaired: { _: [['오늘은 둘 다 너무 많이 마셨어요. 이런 상태로 그런 결정 안 할래요. 물 마시고 택시 타요 💧', 'We’ve both had too much tonight. I won’t decide something like this in this state. Let’s get water and a taxi 💧']] },
};
const line = (kind, n) => { const g = LINES[kind] || {}, arr = g[n && n.trait] || g.outgoing || g._ || [['…', '…']]; const p = pick(arr); return L(p[0], p[1]); };

/* ═════════════ 2. 상태 ═════════════ */
const S = { on: false, n: null, area: null, hotel: null, cat: null, stay: 'rent', price: 0, paid: 0, payer: '', transport: '', roomNo: 0, comfort: 50, clockMin: 0, endMin: 120, act: null, actT: 0,
  events: new Set(), evNext: 0, follow: false, hand: null, weather: 'clear', mood: 'warm', tvOn: false, music: null, step: '', leaving: false, space: false, prevPl: null, photos: 0, encounter: null, inviteAt: 0, nInvited: false };
NC.Motel = S;   // 디버그·확장용

/* ═════════════ 3. 공간 — 모텔 앞 · 로비 · 복도 · 객실 ═════════════ */
const HOTELS = [
  { id: 'rose', name: L('로즈 모텔', 'Rose Motel'), sign: 'ROSE MOTEL', sub: '장미 ♥ 모텔', glow: '#ff3d7a', k: 1, desc: L('걸어서 3분 · 90년대 그대로의 네온 간판', '3 min walk · authentic 90s neon'), walk: true },
  { id: 'melati', name: L('호텔 멜라티', 'Hotel Melati'), sign: 'HOTEL MELATI', sub: 'MELATI ✿ INN', glow: '#3de6c0', k: 1.1, desc: L('택시 7분 · 자스민 정원과 열대 분위기(인도네시아풍)', '7 min by taxi · jasmine garden, tropical vibe'), walk: false },
  { id: 'paradise', name: L('파라다이스 인', 'Paradise Inn'), sign: 'PARADISE INN', sub: '★ 파라다이스 ★', glow: '#ffd23d', k: 1.3, desc: L('택시 12분 · 자쿠지 스위트가 유명한 고급 모텔', '12 min by taxi · famous for jacuzzi suites'), walk: false },
];
const CATS = [
  { id: 'std', name: L('스탠다드', 'Standard'), rent: 30, night: 60, desc: L('더블 침대 · 브라운관 TV · 비디오', 'Double bed · CRT TV · VCR') },
  { id: 'dlx', name: L('디럭스', 'Deluxe'), rent: 50, night: 95, desc: L('퀸 침대 · 소파 · 큰 창', 'Queen bed · sofa · big window') },
  { id: 'rom', name: L('로맨틱 스위트', 'Romantic Suite'), rent: 80, night: 150, desc: L('원형 침대 · 천장 거울 · 장미', 'Round bed · ceiling mirror · roses') },
  { id: 'vip', name: L('프리미엄 VIP 스위트', 'Premium VIP Suite'), rent: 120, night: 220, desc: L('킹 침대 · 미니 바 · 샴페인 · LED 천장', 'King bed · mini bar · champagne · LED ceiling') },
  { id: 'jac', name: L('럭셔리 자쿠지 스위트', 'Luxury Jacuzzi Suite'), rent: 160, night: 290, desc: L('자쿠지 욕조 · 야경 창 · 무드 조명', 'Jacuzzi · city-view window · mood lights') },
];
const catOf = id => CATS.find(c => c.id === id) || CATS[0];
/* 빈방 — 날짜·모텔마다 정해짐(다른 커플들이 쓰는 방) */
function avail(h) { const d = new Date(), seed = U.hash(d.toDateString() + h.id + (d.getHours() >> 1)); return CATS.map((c, i) => ((seed >>> (i * 4)) & 3) + (i < 2 ? 1 : 0)); }   // 0 = 만실(다른 커플들이 사용 중)

/* ── 3-1 모텔 앞 ── */
const EXT = RM.make('motelExt', L('🏨 모텔 앞', '🏨 Motel entrance'), BX, 0, 9, 7, 12);
EXT.entry = { x: -1.2, z: 4.6, ry: Math.PI }; EXT.enterMsg = L('🏨 모텔 앞에 도착했어요 — 입구로 걸어가 E', '🏨 Arrived at the motel — walk to the entrance and press E');
const EXTV = {};
{
  const G = EXT, ad = (m, x, y, z) => G.add(m, x, y, z);
  const asphalt = pbr('speckle', { repeat: [9, 7], roughness: .55, env: 1.4, gen: { a: '#15151b' } });
  const gnd = ad(new T.Mesh(new T.PlaneGeometry(18, 14), asphalt), 0, 0, 0); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true;
  const lineM = glow('#e8e0c0', 1.1); for (let i = -3; i <= 3; i++) { const l = ad(new T.Mesh(new T.PlaneGeometry(.08, 2.4), lineM), i * 2.2, .01, 1.2); l.rotation.x = -Math.PI / 2; }
  const walk = ad(new T.Mesh(box(18, .14, 1.6), std('#3a3640', { roughness: .9 })), 0, .07, -4.9);
  // 건물 정면
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320; const c = cv.getContext('2d'); c.fillStyle = '#2a2230'; c.fillRect(0, 0, 512, 320);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) { const lit = (U.hash('w' + r + k) % 10) > 3; c.fillStyle = lit ? (k % 3 ? '#ffcf8a' : '#ff8ab8') : '#14101c'; c.fillRect(20 + k * 61, 20 + r * 72, 40, 46); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(20 + k * 61, 40 + r * 72, 40, 4); }
  const ft = new T.CanvasTexture(cv); ft.encoding = T.sRGBEncoding;
  const fac = ad(new T.Mesh(box(17, 10, .6), new T.MeshStandardMaterial({ map: ft, emissive: 0xffffff, emissiveMap: ft, emissiveIntensity: .55, roughness: .9 })), 0, 5, -6.4);
  EXT.rects.push([-9, -7, 9, -5.75]);
  ad(new T.Mesh(box(4, 2.6, .1), new T.MeshStandardMaterial({ color: 0x223040, roughness: .05, metalness: .6, transparent: true, opacity: .55 })), 0, 1.3, -6.05);  // 유리문
  const canopy = ad(new T.Mesh(box(5.2, .25, 2.4), std('#5a1030', { roughness: .5 })), 0, 3.0, -5.0);
  for (const x of [-2.4, 2.4]) ad(new T.Mesh(cyl(.07, .07, 3, 10), std('#c8c8d0', { metalness: 1, roughness: .2 })), x, 1.5, -3.9);
  const strip = ad(new T.Mesh(box(5.2, .06, .06), glow('#ff3d7a', 3)), 0, 2.86, -3.8); EXTV.strip = strip;
  // 간판(텍스트는 모텔마다 다시 그림)
  EXTV.signCv = document.createElement('canvas'); EXTV.signCv.width = 1024; EXTV.signCv.height = 256; EXTV.signTex = new T.CanvasTexture(EXTV.signCv); EXTV.signTex.encoding = T.sRGBEncoding;
  EXTV.sign = ad(new T.Mesh(new T.PlaneGeometry(6, 1.5), new T.MeshBasicMaterial({ map: EXTV.signTex, transparent: true })), 0, 4.1, -6.08);
  EXTV.vcv = document.createElement('canvas'); EXTV.vcv.width = 128; EXTV.vcv.height = 512; EXTV.vtex = new T.CanvasTexture(EXTV.vcv); EXTV.vtex.encoding = T.sRGBEncoding;
  EXTV.vsign = ad(new T.Mesh(new T.PlaneGeometry(1, 4), new T.MeshBasicMaterial({ map: EXTV.vtex, transparent: true })), 6.2, 6.2, -6.05);
  // 가로등
  for (const x of [-7.5, 7.5]) { ad(new T.Mesh(cyl(.06, .09, 5, 8), std('#2a2a30', { metalness: .7, roughness: .4 })), x, 2.5, 5.6); ad(new T.Mesh(new T.SphereGeometry(.22, 12, 8), glow('#ffd9a0', 3)), x, 5.05, 5.6); EXT.rects.push([x - .15, 5.45, x + .15, 5.75]); }
  // 주차된 90년대 차(각진 세단)
  const car = (c, taxi) => { const g = new T.Group(), body = std(c, { roughness: .25, metalness: .55 }), glass = new T.MeshStandardMaterial({ color: 0x0c1018, roughness: .05, metalness: .8 });
    const b = new T.Mesh(box(1.75, .6, 4.3), body); b.position.y = .55; g.add(b); const t = new T.Mesh(box(1.55, .5, 2.2), body); t.position.set(0, 1.08, -.2); g.add(t);
    const w = new T.Mesh(box(1.56, .44, 2.1), glass); w.position.set(0, 1.08, -.2); w.scale.set(1.01, 1, .98); g.add(w);
    const tire = std('#111', { roughness: .9 }); for (const [x, z] of [[-.85, 1.35], [.85, 1.35], [-.85, -1.35], [.85, -1.35]]) { const wh = new T.Mesh(cyl(.32, .32, .22, 14), tire); wh.rotation.z = Math.PI / 2; wh.position.set(x, .32, z); g.add(wh); }
    for (const x of [-.6, .6]) { const hl = new T.Mesh(box(.32, .14, .04), glow('#fff6d8', 2.6)); hl.position.set(x, .62, 2.16); g.add(hl); const tl = new T.Mesh(box(.32, .12, .04), glow('#ff2030', 2)); tl.position.set(x, .62, -2.16); g.add(tl); }
    if (taxi) { const lamp = new T.Mesh(box(.5, .16, .22), glow(taxi === 'vip' ? '#ffd23d' : '#fff0c0', 2.2)); lamp.position.set(0, 1.42, -.2); g.add(lamp); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; };
  const c1 = car('#7a1a1a'); c1.position.set(BX - 5.5, 0, 1.4); G.G.add(c1); EXT.rects.push([-6.4, -.8, -4.6, 3.6]);
  const c2 = car('#c8c4b8'); c2.position.set(BX + 4.4, 0, 1.2); c2.rotation.y = .05; G.G.add(c2); EXT.rects.push([3.5, -1, 5.3, 3.4]);
  EXTV.car = car; EXTV.taxi = null;
  // 빗줄기
  const N = 900, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = BX + (Math.random() - .5) * 18; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = (Math.random() - .5) * 14; }
  const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(pos, 3));
  EXTV.rain = new T.Points(rg, new T.PointsMaterial({ color: 0xaab8d8, size: .05, transparent: true, opacity: .55, depthWrite: false })); EXTV.rain.visible = false; G.G.add(EXTV.rain);
  // 하늘 배경(도시 실루엣)
  const sk = document.createElement('canvas'); sk.width = 1024; sk.height = 256; const g2 = sk.getContext('2d'); const gr = g2.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#05030c'); gr.addColorStop(1, '#2a1438'); g2.fillStyle = gr; g2.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 40; i++) { const w = 20 + (U.hash('b' + i) % 60), h = 40 + (U.hash('h' + i) % 150), x = i * 27; g2.fillStyle = '#0b0812'; g2.fillRect(x, 256 - h, w, h); g2.fillStyle = 'rgba(255,200,120,.5)'; for (let k = 0; k < 6; k++) g2.fillRect(x + 4 + (k % 3) * 6, 256 - h + 8 + (k / 3 | 0) * 14, 3, 5); }
  const skt = new T.CanvasTexture(sk); skt.encoding = T.sRGBEncoding;
  for (const [x, z, r] of [[0, 7, Math.PI], [-9, 0, Math.PI / 2], [9, 0, -Math.PI / 2]]) { const m = ad(new T.Mesh(new T.PlaneGeometry(r === Math.PI ? 18 : 14, 9), new T.MeshBasicMaterial({ map: skt })), x, 4.5, z); m.rotation.y = r; }
  EXT.door = { x: 0, z: -4.3 };
}
function drawSigns(h) {
  const c = EXTV.signCv.getContext('2d'); c.clearRect(0, 0, 1024, 256); c.font = '900 120px "Malgun Gothic",Arial'; c.textAlign = 'center'; c.shadowColor = h.glow; c.shadowBlur = 40; c.fillStyle = '#fff6fb'; c.fillText(h.sign, 512, 140);
  c.font = '700 54px "Malgun Gothic",Arial'; c.fillStyle = h.glow; c.fillText(h.sub, 512, 222); EXTV.signTex.needsUpdate = true;
  const v = EXTV.vcv.getContext('2d'); v.clearRect(0, 0, 128, 512); v.font = '900 82px Arial'; v.textAlign = 'center'; v.shadowColor = h.glow; v.shadowBlur = 26; v.fillStyle = h.glow; 'MOTEL'.split('').forEach((ch, i) => v.fillText(ch, 64, 92 + i * 96)); EXTV.vtex.needsUpdate = true;
  EXTV.strip.material.color.copy(col(h.glow)).multiplyScalar(3);
}

/* ── 3-2 로비 ── */
const LOB = RM.make('motelLobby', L('🛎 모텔 로비', '🛎 Motel lobby'), BX, 30, 5, 4, 3.1);
LOB.entry = { x: 0, z: 3.2, ry: Math.PI }; LOB.enterMsg = L('🛎 로비 — 카운터에서 체크인(E)', '🛎 Lobby — check in at the counter (E)');
const LOBV = {};
{
  const ad = (m, x, y, z) => LOB.add(m, x, y, z);
  RM.shell(LOB, pbr('marble', { repeat: [5, 4], roughness: .3, env: 1.3, gen: { a: '#3a2a30', b: '#b8909a', tiles: 3 } }), pbr('wallpaper', { repeat: [5, 2], roughness: 1, gen: { a: '#3a1428', b: '#caa24c', c: '#ff7aa8' } }), std('#e8dcd0', { roughness: .95 }));
  const wood = pbr('wood', { repeat: [2, 1], roughness: .5, gen: { a: '#2a140c', b: '#5a3020' } });
  ad(new T.Mesh(box(3.6, 1.1, .7), wood), 2.2, .55, -2.6); ad(new T.Mesh(box(3.7, .06, .8), std('#d9c8a8', { roughness: .3 })), 2.2, 1.13, -2.6); LOB.rects.push([.4, -3.0, 4.1, -2.2]);
  ad(new T.Mesh(box(3.6, 1.5, .05), new T.MeshStandardMaterial({ color: 0x8fa8c0, transparent: true, opacity: .3, roughness: .05, metalness: .3 })), 2.2, 1.9, -2.3);   // 카운터 유리 칸막이(작은 창)
  ad(new T.Mesh(box(.8, .45, .05), std('#1a1418')), 2.2, 1.35, -2.27);   // 돈·열쇠 주고받는 작은 창 구멍 테두리
  const ph = ad(new T.Mesh(box(.24, .1, .18), std('#b01020', { roughness: .4 })), 3.4, 1.2, -2.7); ad(new T.Mesh(cyl(.035, .035, .26, 8), std('#b01020', { roughness: .4 })), 3.4, 1.29, -2.7).rotation.z = Math.PI / 2;   // 빨간 다이얼 전화기
  // 열쇠 보드(호실 번호)
  const kb = document.createElement('canvas'); kb.width = 512; kb.height = 256; const k2 = kb.getContext('2d'); k2.fillStyle = '#3a2418'; k2.fillRect(0, 0, 512, 256); k2.font = 'bold 26px Arial'; k2.textAlign = 'center';
  for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) { const x = 34 + i * 62, y = 30 + r * 78; k2.fillStyle = '#d9b056'; k2.fillText(`${r + 3}0${i + 1}`, x, y + 20); k2.fillStyle = '#b8b8c0'; k2.beginPath(); k2.arc(x, y + 44, 9, 0, 7); k2.fill(); k2.fillRect(x - 3, y + 50, 6, 16); }
  const kt = new T.CanvasTexture(kb); kt.encoding = T.sRGBEncoding; ad(new T.Mesh(new T.PlaneGeometry(2.4, 1.2), new T.MeshStandardMaterial({ map: kt, roughness: .7 })), 2.2, 2.1, -3.97);
  // 대기 소파 · 화분 · 어항
  const sofa = pbr('tufted', { repeat: [4, 1], color: '#6a1a3a', roughness: .8, gen: { leather: true, cells: 4 } });
  ad(new T.Mesh(box(2.4, .45, .8), sofa), -3.2, .23, 1.4).rotation.y = Math.PI / 2; ad(new T.Mesh(box(2.4, .7, .22), sofa), -4.6, .55, 1.4).rotation.y = Math.PI / 2; LOB.rects.push([-4.8, .2, -2.8, 2.6]);
  ad(new T.Mesh(cyl(.25, .2, .5, 12), std('#8a5a3a')), -4.4, .25, -3.4); ad(new T.Mesh(new T.SphereGeometry(.5, 10, 8), std('#2f6a2a', { roughness: .9 })), -4.4, .95, -3.4);
  const tank = ad(new T.Mesh(box(1.4, .7, .5), new T.MeshStandardMaterial({ color: 0x3aa8d8, emissive: 0x0a4060, roughness: .05, transparent: true, opacity: .6 })), -2.4, 1.15, -3.6); ad(new T.Mesh(box(1.45, .8, .55), std('#1a1a1a')), -2.4, .4, -3.6); LOB.rects.push([-3.2, -4, -1.6, -3.2]);
  // 엘리베이터(북쪽 벽 서쪽)
  const steel = std('#c8ccd4', { metalness: 1, roughness: .18 });
  ad(new T.Mesh(box(1.7, 2.5, .12), std('#2a2a30', { metalness: .6, roughness: .3 })), -.6, 1.25, -3.93);
  LOBV.dL = ad(new T.Mesh(box(.68, 2.2, .05), steel), -.94, 1.1, -3.86); LOBV.dR = ad(new T.Mesh(box(.68, 2.2, .05), steel), -.26, 1.1, -3.86);
  LOBV.btn = ad(new T.Mesh(new T.CircleGeometry(.05, 16), glow('#ffcf6a', 1)), .5, 1.2, -3.86);
  LOBV.ind = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 48; const t = new T.CanvasTexture(cv); const m = ad(new T.Mesh(new T.PlaneGeometry(.4, .15), new T.MeshBasicMaterial({ map: t })), -.6, 2.6, -3.86); return { cv, t, m }; })();
  // 접수원
  LOBV.clerk = null;
  const neon = NC.neonSign ? NC.neonSign('FRONT ♥ DESK', 1.8, .4, { font: '900 90px Arial', color: '#fff4fb', glow: '#ff3d9a', ph: 200 }) : null; if (neon) { neon.position.set(BX + 2.2, 2.7, 30 - 2.3); LOB.G.add(neon); }
  LOB.elev = { x: -.6, z: -3.2 }; LOB.desk = { x: 2.2, z: -1.75 };
}
function drawFloor(cv, t, s) { const c = cv.getContext('2d'); c.fillStyle = '#100808'; c.fillRect(0, 0, 128, 48); c.font = 'bold 34px monospace'; c.fillStyle = '#ff4030'; c.textAlign = 'center'; c.fillText(s, 64, 36); t.needsUpdate = true; }

/* ── 3-3 복도 ── */
const COR = RM.make('motelCorr', L('🚪 3층 복도', '🚪 3rd floor corridor'), BX, 60, 8, 1.6, 2.8);
COR.entry = { x: -6.8, z: 0, ry: Math.PI / 2 };
const CORV = { doors: [] };
{
  const ad = (m, x, y, z) => COR.add(m, x, y, z);
  RM.shell(COR, pbr('carpet', { repeat: [8, 2], roughness: 1, gen: { a: '#5a0e24', b: '#c8963a' } }), pbr('wallpaper', { repeat: [8, 1], roughness: 1, gen: { a: '#e8d8c0', b: '#b89a6a', c: '#c87a6a' } }), std('#f0e8dc', { roughness: .95 }));
  const steel = std('#c8ccd4', { metalness: 1, roughness: .18 });
  CORV.dL = ad(new T.Mesh(box(.05, 2.2, .68), steel), -7.93, 1.1, -.34); CORV.dR = ad(new T.Mesh(box(.05, 2.2, .68), steel), -7.93, 1.1, .34);
  const doorM = pbr('wood', { repeat: [1, 2], roughness: .5, gen: { a: '#3a1a10', b: '#6a3a22' } });
  for (let i = 0; i < 6; i++) { const north = i % 2 === 0, x = -4.6 + (i >> 1) * 4.2 + (north ? 0 : 1.6), z = north ? -1.57 : 1.57, no = 301 + i;
    const d = ad(new T.Mesh(box(1, 2.1, .06), doorM), x, 1.05, z);
    const pl = document.createElement('canvas'); pl.width = 128; pl.height = 64; const p2 = pl.getContext('2d'); p2.fillStyle = '#d9b056'; p2.fillRect(0, 0, 128, 64); p2.fillStyle = '#2a1408'; p2.font = 'bold 40px Arial'; p2.textAlign = 'center'; p2.fillText(no, 64, 46);
    const pt = new T.CanvasTexture(pl); pt.encoding = T.sRGBEncoding; const plate = ad(new T.Mesh(new T.PlaneGeometry(.3, .15), new T.MeshStandardMaterial({ map: pt, metalness: .6, roughness: .3 })), x, 1.75, z + (north ? .04 : -.04)); if (!north) { plate.rotation.y = Math.PI; d.rotation.y = Math.PI; }
    const led = ad(new T.Mesh(new T.CircleGeometry(.03, 10), glow('#30ff60', 1.5)), x + .38, 1.3, z + (north ? .04 : -.04)); if (!north) led.rotation.y = Math.PI;
    CORV.doors.push({ no, x, z, north, d, led }); }
  for (let i = 0; i < 5; i++) { const x = -6 + i * 3; for (const z of [-1.56, 1.56]) { const s = ad(new T.Mesh(new T.SphereGeometry(.1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), glow('#ffd8a0', 2.2)), x, 2.0, z); s.rotation.x = z < 0 ? Math.PI / 2 : -Math.PI / 2; } }
}

/* ── 3-4 객실(종류별로 다시 꾸밈) ── */
const RHX = 4.4, RHZ = 3.8, RH = 2.9;
const ROOM = RM.make('motelRoom', L('🛏 객실', '🛏 Guest room'), BX, 90, RHX, RHZ, RH);
ROOM.entry = { x: RHX - .9, z: RHZ - .7, ry: Math.PI };
const RV = { G: null, seats: {}, tv: null, tvCv: null, tvTex: null, win: null, winCv: null, lights: [], spots: {} };
function disposeG(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.map.isCanvasTexture) m.map.dispose(); m.dispose && !m._shared && m.dispose(); }); }); }
function buildRoom(cat) {
  if (RV.G) { ROOM.G.remove(RV.G); disposeG(RV.G); }
  const G = new T.Group(); ROOM.G.add(G); RV.G = G; ROOM.rects.length = 0; RV.lights = [];
  const ad = (m, x, y, z) => { m.position.set(BX + x, y, 90 + z); G.add(m); return m; };
  const th = {
    std: { floor: ['wood', { a: '#4a2a18', b: '#6a3a22' }], wall: ['wallpaper', { a: '#d8c8a8', b: '#a8885a', c: '#b87a5a' }], bed: '#c8b8a8', duvet: '#e8dcc8', accent: '#ffcf8a', size: [1.6, 2.05] },
    dlx: { floor: ['carpet', { a: '#3a2a4a', b: '#a08060' }], wall: ['wallpaper', { a: '#2a2a3a', b: '#8a7a5a', c: '#6a5a8a' }], bed: '#5a4a6a', duvet: '#f0eaf4', accent: '#c8a0ff', size: [1.8, 2.1] },
    rom: { floor: ['carpet', { a: '#5a0e24', b: '#ff7aa8' }], wall: ['wallpaper', { a: '#3a0a1e', b: '#ff5fa8', c: '#caa24c' }], bed: '#8a1030', duvet: '#ffd8e4', accent: '#ff3d7a', size: [2.2, 2.2], round: true, mirror: true },
    vip: { floor: ['marble', { a: '#1a1a20', b: '#8a7a6a', tiles: 3 }], wall: ['wallpaper', { a: '#0c0c14', b: '#d9b056', c: '#5a4a2a' }], bed: '#1a1418', duvet: '#f4efe6', accent: '#ffd23d', size: [2.0, 2.15], mirror: true, bar: true, led: true },
    jac: { floor: ['marble', { a: '#e8e0d8', b: '#9a8a7a', tiles: 3 }], wall: ['wallpaper', { a: '#101a24', b: '#3de6c0', c: '#2a5a6a' }], bed: '#2a3a4a', duvet: '#eef6f8', accent: '#3de6ff', size: [1.9, 2.1], jac: true, led: true },
  }[cat];
  const floor = ad(new T.Mesh(new T.PlaneGeometry(RHX * 2, RHZ * 2), pbr(th.floor[0], { repeat: [4, 4], roughness: th.floor[0] === 'marble' ? .25 : 1, env: 1.2, gen: th.floor[1] })), 0, 0, 0); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const ceil = ad(new T.Mesh(new T.PlaneGeometry(RHX * 2, RHZ * 2), std('#efe6dc', { roughness: .95 })), 0, RH, 0); ceil.rotation.x = Math.PI / 2;
  const wm = pbr(th.wall[0], { repeat: [4, 1.5], roughness: 1, gen: th.wall[1] });
  [[0, -RHZ, 0, RHX * 2], [0, RHZ, Math.PI, RHX * 2], [-RHX, 0, Math.PI / 2, RHZ * 2], [RHX, 0, -Math.PI / 2, RHZ * 2]].forEach(([x, z, r, len]) => { const w = ad(new T.Mesh(new T.PlaneGeometry(len, RH), wm), x, RH / 2, z); w.rotation.y = r; });
  const wood = pbr('wood', { repeat: [1, 1], roughness: .5, gen: { a: '#2a140c', b: '#4a2618' } }), fabric = std(th.bed, { roughness: .85 });
  // 침대(북쪽 벽 가운데)
  const [bw, bl] = th.size, bz = -RHZ + bl / 2 + .05;
  if (th.round) { ad(new T.Mesh(cyl(1.25, 1.25, .38, 40), fabric), 0, .19, bz + .1); ad(new T.Mesh(cyl(1.18, 1.18, .2, 40), std(th.duvet, { roughness: .9 })), 0, .48, bz + .1); ad(new T.Mesh(new T.TorusGeometry(1.26, .07, 10, 40), std('#d9b056', { metalness: .9, roughness: .25 })), 0, .4, bz + .1).rotation.x = Math.PI / 2; ROOM.rects.push([-1.25, -RHZ, 1.25, bz + 1.3]); }
  else { ad(new T.Mesh(box(bw + .1, .35, bl), wood), 0, .18, bz); ad(new T.Mesh(box(bw, .24, bl - .05), std('#f6f2ea', { roughness: .95 })), 0, .47, bz); ad(new T.Mesh(box(bw + .02, .08, bl * .62), std(th.duvet, { roughness: .9 })), 0, .62, bz + bl * .18); ROOM.rects.push([-bw / 2 - .05, -RHZ, bw / 2 + .05, bz + bl / 2]); }
  ad(new T.Mesh(box(Math.max(bw, 2.2) + .3, 1.2, .12), th.round ? std('#5a0a20', { roughness: .6 }) : pbr('tufted', { repeat: [4, 1], color: th.bed, roughness: .8, gen: { leather: true, cells: 5 } })), 0, .9, -RHZ + .07);
  for (const x of [-.45, .45]) ad(new T.Mesh(box(.6, .14, .36), std('#ffffff', { roughness: .95 })), x, .66, -RHZ + .35);
  for (const s of [-1, 1]) { const x = s * (Math.max(bw / 2, 1.25) + .45); ad(new T.Mesh(box(.5, .5, .45), wood), x, .25, -RHZ + .35); ad(new T.Mesh(cyl(.13, .1, .3, 12), glow(th.accent, 1.3)), x, .68, -RHZ + .35); ROOM.rects.push([x - .27, -RHZ, x + .27, -RHZ + .6]); }
  RV.seats.bed = [{ x: -.45, z: bz + bl / 2 + .2 + (th.round ? .25 : 0), ry: 0, h: .5 }, { x: .45, z: bz + bl / 2 + .2 + (th.round ? .25 : 0), ry: 0, h: .5 }];
  if (th.mirror) { const mr = ad(new T.Mesh(new T.CircleGeometry(1.1, 36), new T.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 1, roughness: .04 })), 0, RH - .01, bz + .1); mr.rotation.x = Math.PI / 2; }
  // 소파 + 테이블(서쪽)
  const sofaM = pbr('tufted', { repeat: [4, 1], color: cat === 'std' ? '#6a4a3a' : cat === 'vip' ? '#1a1418' : '#8a1f55', roughness: .8, gen: { leather: true, cells: 4 } });
  ad(new T.Mesh(box(.85, .44, 2.1), sofaM), -RHX + .5, .22, .9); ad(new T.Mesh(box(.22, .72, 2.1), sofaM), -RHX + .14, .55, .9); ROOM.rects.push([-RHX, -.2, -RHX + .95, 2.0]);
  ad(new T.Mesh(box(.7, .06, 1.1), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .3, roughness: .02, metalness: .2 })), -RHX + 1.55, .42, .9); ad(new T.Mesh(box(.6, .38, 1.0), std('#2a2024', { metalness: .3, roughness: .4 })), -RHX + 1.55, .2, .9); ROOM.rects.push([-RHX + 1.18, .32, -RHX + 1.92, 1.48]);
  RV.seats.sofa = [{ x: -RHX + .62, z: .45, ry: Math.PI / 2, h: .45 }, { x: -RHX + .62, z: 1.35, ry: Math.PI / 2, h: .45 }];
  RV.spots.table = { x: -RHX + 1.55, z: .9 };
  // TV(동쪽 벽) — 스탠다드는 브라운관 + 비디오
  RV.tvCv = document.createElement('canvas'); RV.tvCv.width = 256; RV.tvCv.height = 192; RV.tvTex = new T.CanvasTexture(RV.tvCv); RV.tvTex.encoding = T.sRGBEncoding;
  const crt = cat === 'std' || cat === 'dlx';
  if (crt) { ad(new T.Mesh(box(.9, .5, .55), wood), RHX - .35, .25, -.4); ad(new T.Mesh(box(.62, .55, .62), std('#1a1a1c', { roughness: .4 })), RHX - .38, .78, -.4); ad(new T.Mesh(box(.42, .08, .3), std('#2a2a2c')), RHX - .38, .54, -.4);
    RV.tv = ad(new T.Mesh(new T.PlaneGeometry(.5, .4), new T.MeshBasicMaterial({ map: RV.tvTex })), RHX - .7, .8, -.4); RV.tv.rotation.y = -Math.PI / 2; ROOM.rects.push([RHX - .8, -.75, RHX, -.05]); }
  else { ad(new T.Mesh(box(.08, .9, 1.6), std('#0c0c10', { roughness: .3 })), RHX - .06, 1.45, -.4); RV.tv = ad(new T.Mesh(new T.PlaneGeometry(1.5, .82), new T.MeshBasicMaterial({ map: RV.tvTex })), RHX - .11, 1.45, -.4); RV.tv.rotation.y = -Math.PI / 2;
    ad(new T.Mesh(box(.45, .5, 1.8), wood), RHX - .25, .25, -.4); ROOM.rects.push([RHX - .5, -1.3, RHX, .5]); }
  // 창(서쪽 벽 북쪽) — 밤 도시 풍경 + 비
  RV.winCv = document.createElement('canvas'); RV.winCv.width = 256; RV.winCv.height = 192; RV.winTex = new T.CanvasTexture(RV.winCv); RV.winTex.encoding = T.sRGBEncoding;
  RV.win = ad(new T.Mesh(new T.PlaneGeometry(cat === 'jac' ? 2.4 : 1.5, 1.2), new T.MeshBasicMaterial({ map: RV.winTex })), -RHX + .02, 1.55, -2.0); RV.win.rotation.y = Math.PI / 2;
  const curt = std(cat === 'rom' ? '#8a1030' : cat === 'vip' ? '#3a2a10' : '#6a5a7a', { roughness: 1, side: T.DoubleSide });
  for (const s of [-1, 1]) { const cu = ad(new T.Mesh(box(.06, 1.9, .5), curt), -RHX + .08, 1.5, -2.0 + s * (cat === 'jac' ? 1.45 : 1.0)); RV['curt' + (s < 0 ? 'A' : 'B')] = cu; }
  RV.spots.window = { x: -RHX + .8, z: -2.0 };
  // 욕실(남서쪽 유리 칸막이) · 자쿠지
  ad(new T.Mesh(box(.05, 2.4, 2.0), new T.MeshStandardMaterial({ color: 0xc0d8e8, transparent: true, opacity: .25, roughness: .1, metalness: .2 })), -1.6, 1.2, RHZ - 1.0); ad(new T.Mesh(box(2.8, 2.4, .05), new T.MeshStandardMaterial({ color: 0xc0d8e8, transparent: true, opacity: .25, roughness: .1 })), -3.0, 1.2, RHZ - 2.0);
  ROOM.rects.push([-RHX, RHZ - 2.05, -1.55, RHZ]);
  if (th.jac) { ad(new T.Mesh(cyl(.95, .95, .55, 36), std('#f4f4f6', { roughness: .2 })), 2.6, .28, 2.3); const wtr = ad(new T.Mesh(new T.CircleGeometry(.85, 36), new T.MeshStandardMaterial({ color: 0x5ad8ff, emissive: 0x0a6a8a, emissiveIntensity: .6, roughness: .05, transparent: true, opacity: .8 })), 2.6, .5, 2.3); wtr.rotation.x = -Math.PI / 2; RV.water = wtr; ROOM.rects.push([1.6, 1.3, 3.6, 3.3]); RV.spots.jac = { x: 1.4, z: 2.3 }; }
  else RV.water = null;
  // 소품: 미니 냉장고 · 장미 · 샴페인 · 바
  ad(new T.Mesh(box(.5, .6, .5), std('#e8e8ea', { roughness: .3 })), RHX - .3, .3, 1.4); RV.spots.fridge = { x: RHX - .9, z: 1.4 }; ROOM.rects.push([RHX - .56, 1.14, RHX, 1.66]);
  if (cat === 'rom' || cat === 'vip' || cat === 'jac') { const petal = std('#c0102a', { roughness: .5 }); for (let i = 0; i < 26; i++) { const p = ad(new T.Mesh(new T.CircleGeometry(.035, 6), petal), (Math.random() - .5) * 1.6, .6 + (th.round ? -.0 : .03), bz + (Math.random() - .3) * 1.2); p.rotation.x = -Math.PI / 2; p.position.y = th.round ? .59 : .67; } }
  if (th.bar) { ad(new T.Mesh(box(1.6, 1.0, .5), wood), 2.4, .5, 2.9); ROOM.rects.push([1.55, 2.6, 3.25, RHZ]); ad(new T.Mesh(cyl(.12, .1, .25, 14), std('#c8ccd4', { metalness: 1, roughness: .15 })), 2.1, 1.12, 2.9); ad(new T.Mesh(cyl(.035, .045, .34, 10), std('#1a3a1a', { roughness: .1 })), 2.1, 1.3, 2.9); }
  if (th.led) { const lm = glow(th.accent, 2.2); for (const [x, z, w, d] of [[0, -RHZ + .05, RHX * 2, .04], [0, RHZ - .05, RHX * 2, .04], [-RHX + .05, 0, .04, RHZ * 2], [RHX - .05, 0, .04, RHZ * 2]]) RV.lights.push(ad(new T.Mesh(box(w, .03, d), lm), x, RH - .05, z)); }
  // 문(남쪽 동쪽)
  ad(new T.Mesh(box(1, 2.1, .06), pbr('wood', { repeat: [1, 2], roughness: .5, gen: { a: '#3a1a10', b: '#6a3a22' } })), RHX - .9, 1.05, RHZ - .03);
  RV.spots.door = { x: RHX - .9, z: RHZ - .6 }; RV.spots.center = { x: .4, z: .9 };
  RV.accent = th.accent; drawWindow(0); drawTV(0);
  try { S.onBuild && S.onBuild(G, cat, th); } catch (e) { console.warn('[motel onBuild]', e); }   // v60 19+ 확장(욕실 물·김 등)
}
const tvShow = { ch: 0, t: 0 };
const TVCH = [L('가요 BEST 10', 'K-POP BEST 10'), L('심야 영화', 'Late Movie'), L('뉴스 속보', 'News'), L('뮤직 비디오', 'Music Video')];
function drawTV(t) {
  const cv = RV.tvCv; if (!cv) return; const c = cv.getContext('2d'), W2 = 256, H2 = 192;
  if (!S.tvOn) { c.fillStyle = '#0a0a0c'; c.fillRect(0, 0, W2, H2); c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(20, 20, 60, 30); RV.tvTex.needsUpdate = true; return; }
  const ch = tvShow.ch % 4; const g = c.createLinearGradient(0, 0, W2, H2); g.addColorStop(0, ['#2a0a4a', '#0a0a18', '#0a1a3a', '#3a0a2a'][ch]); g.addColorStop(1, ['#ff3d9a', '#3a2a1a', '#2a4a8a', '#3de6ff'][ch]); c.fillStyle = g; c.fillRect(0, 0, W2, H2);
  if (ch === 0 || ch === 3) for (let i = 0; i < 16; i++) { const h = 20 + Math.abs(Math.sin(t * 4 + i * .7)) * 90; c.fillStyle = `hsl(${(i * 22 + t * 60) % 360},90%,60%)`; c.fillRect(10 + i * 15, H2 - 30 - h, 10, h); }
  if (ch === 1) { c.fillStyle = 'rgba(255,220,180,.8)'; c.beginPath(); c.arc(128 + Math.sin(t * .4) * 40, 90, 34, 0, 7); c.fill(); }
  if (ch === 2) { c.fillStyle = '#ffffff'; c.fillRect(0, H2 - 40, W2, 22); c.fillStyle = '#c00'; c.font = 'bold 14px sans-serif'; c.fillText(L('◆ 오늘 밤 수도권 비 소식 ◆ 귀가길 조심하세요', '◆ Rain tonight ◆ travel safely'), W2 - (t * 60 % (W2 + 300)), H2 - 24); }
  c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H2; y += 3) c.fillRect(0, y, W2, 1);
  c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.fillText(TVCH[ch], 10, 22); RV.tvTex.needsUpdate = true;
}
function drawWindow(t) {
  const cv = RV.winCv; if (!cv) return; const c = cv.getContext('2d'), morning = S.step === 'morning';
  const g = c.createLinearGradient(0, 0, 0, 192); g.addColorStop(0, morning ? '#8ac8ff' : '#05030c'); g.addColorStop(1, morning ? '#ffe0b8' : '#2a1438'); c.fillStyle = g; c.fillRect(0, 0, 256, 192);
  for (let i = 0; i < 14; i++) { const w = 14 + (U.hash('wb' + i) % 22), h = 40 + (U.hash('wh' + i) % 100), x = i * 19; c.fillStyle = morning ? '#6a7a8a' : '#0b0812'; c.fillRect(x, 192 - h, w, h); if (!morning) { c.fillStyle = 'rgba(255,200,120,.6)'; for (let k = 0; k < 4; k++) if ((U.hash('l' + i + k) & 3) && Math.sin(t * .3 + i + k) > -.6) c.fillRect(x + 3 + (k % 2) * 6, 192 - h + 6 + (k >> 1) * 12, 3, 5); } }
  if (S.weather === 'rain') { c.strokeStyle = 'rgba(180,200,240,.35)'; for (let i = 0; i < 40; i++) { const x = (U.hash('r' + i) % 256 + t * 40) % 256, y = (U.hash('ry' + i) % 192 + t * 260) % 192; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 12); c.stroke(); } }
  RV.winTex.needsUpdate = true;
}

/* ═════════════ 4. 사람 — 접수원 · 룸서비스 · 우연히 만난 사람 ═════════════ */
function staffAvatar(name, look, id) {
  const g = NC.Avatar.create({ name, look: Object.assign({ gender: 'f', height: 1.62 }, look), seed: U.hash(name), expr: 'smile' });
  try { const RH = NC.RealHuman, m = RH && RH.modelOf && RH.modelOf(id); if (m && RH.ok) RH.pin(g, NC.isMobile ? (m.lodm || m.lod.replace(/_lod\.glb$/, '_lodm.glb')) : (m.lod || m.url)); } catch (e) { }
  return g;
}
function ensureClerk() {
  if (LOBV.clerk) return LOBV.clerk; const g = staffAvatar(L('카운터 이모', 'Front desk'), { gender: 'f', height: 1.6 }, 'f_17'); g.position.set(BX + 2.2, 0, 30 - 3.2); g.rotation.y = 0; LOB.G.add(g); LOBV.clerk = g; return g;
}
let roomSvc = null;
function ensureRoomSvc() { if (roomSvc) return roomSvc; const g = staffAvatar(L('룸서비스', 'Room service'), { gender: 'm', height: 1.74 }, 'm_14'); g.visible = false; ROOM.G.add(g); roomSvc = g; return g; }

/* ═════════════ 5. 공통 연출 도구 ═════════════ */
const say = (g, t, sec) => { try { NC.bubble && NC.bubble(g, t, sec || Math.min(5, 1.6 + t.length * .06)); } catch (e) { } };
const nSay = (t, emo) => { const n = S.n; if (!n) return; NC.ui.chatAdd(n.name, t); say(n.g, t); try { n.g.userData.setExpr && n.g.userData.setExpr(emo || 'smile', 3.5); } catch (e) { } };
const meSay = t => { NC.ui.chatAdd(L('나', 'Me'), t); say(P().group, t); };
const sys = t => NC.ui.chatAdd('🏨', t);
const wait = ms => new Promise(r => setTimeout(r, ms));
let AC = null; const beep = (f = 880, d = .12, type = 'sine', v = .08) => { try { const A = NC.Audio, C = (A && A.ctx) || AC || (AC = new (window.AudioContext || window.webkitAudioContext)()); const o = C.createOscillator(), g = C.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, C.currentTime); g.gain.exponentialRampToValueAtTime(.0001, C.currentTime + d); o.connect(g); g.connect(A && A.ctx ? (A.master || C.destination) : C.destination); o.start(); o.stop(C.currentTime + d + .02); } catch (e) { } };
const ding = () => { beep(1320, .5, 'sine', .06); setTimeout(() => beep(990, .7, 'sine', .05), 180); }, knock = () => { [0, 160, 320].forEach(t => setTimeout(() => beep(140, .08, 'square', .12), t)); };
const modal = (html, btns) => NC.ui.modal(html, btns);
const esc = s => U.esc ? U.esc(s) : String(s).replace(/[<>&]/g, '');
const areas = [EXT, LOB, COR, ROOM];
function partnerVisible(R) { const n = S.n; if (!n) return; areas.forEach(a => { const i = a.npcs.indexOf(n); if (i >= 0) a.npcs.splice(i, 1); }); if (R) R.npcs.push(n); }
function placePartner(x, z, ry) { const n = S.n; if (!n) return; if (n.state === 'seated') NC.unseatAvatar(n.g); n.state = 'motel'; n.x = x; n.z = z; n.g.position.set(x, 0, z); if (ry != null) n.g.rotation.y = ry; n.g.visible = true; n.g.userData.moving = false; }
/* 이동: rooms.js go() 로 페이드 전환 + 동반자도 같은 구역으로 */
function goArea(R, spot, after) {
  S.area = R; partnerVisible(R); stopHand(); endStanding(); S.follow = false;
  RM.go(R, spot, () => { const p = P(); if (S.n) { const rx = Math.cos(p.ry) * .7, rz = -Math.sin(p.ry) * .7; placePartner(p.x + rx, p.z + rz, p.ry); } S.follow = true; after && after(); });
}

/* ═════════════ 6. 같이 걷기 · 손잡기 ═════════════ */
function followTick(dt) {
  const n = S.n, p = P(); if (!n || !S.follow || n.state === 'seated' || n.state === 'blues' || S.space) return; const u = n.g.userData;
  const side = S.hand ? .5 : .62, rx = Math.cos(p.ry) * side, rz = -Math.sin(p.ry) * side, bx = Math.sin(p.ry) * -.08, bz = Math.cos(p.ry) * -.08;
  let tx = p.x + rx + bx, tz = p.z + rz + bz; const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz), moving = d > .28;
  if (moving) { const sp = U.clamp(d * 3.6, .8, 4.2); const k = Math.min(1, sp * dt / d); n.x += dx * k; n.z += dz * k; NC.collide && NC.collide(n, .3); n.state = 'escort'; u.moving = true; n.g.rotation.y = U.lerpAngle(n.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8)); }
  else { if (n.state === 'escort') n.state = 'motel'; u.moving = false; const yw = Math.atan2(p.x - n.x, p.z - n.z); n.g.rotation.y = U.lerpAngle(n.g.rotation.y, p.group.userData.moving ? p.ry : yw, Math.min(1, dt * 3)); }
  n.g.position.set(n.x, 0, n.z);
  S.lookT = (S.lookT || 0) - dt; if (S.lookT < 0 && !(u.lookAt && u.lookAt._sc)) { S.lookT = 2.5 + Math.random() * 4; u.lookAt = Math.random() < .55 ? p : null; }   // 가끔 눈맞춤
}
function startHand() { if (!NC.Couple || !S.n) return; S.hand = { t: 0 }; }
function stopHand() { S.hand = null; }
function handTick(dt) {
  const h = S.hand, n = S.n; if (!h || !n || !NC.Couple) return; h.t += dt; const C = NC.Couple, pg = P().group;
  pg.updateMatrixWorld(true); n.g.updateMatrixWorld(true); const A = C.bodyX(pg), B = C.bodyX(n.g); if (!A || !B) return;
  const side = (A.R.shL.getWorldPosition(new T.Vector3()).distanceTo(B.chest) < A.R.shR.getWorldPosition(new T.Vector3()).distanceTo(B.chest)) ? 'L' : 'R';
  const sideB = (B.R.shL.getWorldPosition(new T.Vector3()).distanceTo(A.chest) < B.R.shR.getWorldPosition(new T.Vector3()).distanceTo(A.chest)) ? 'L' : 'R';
  const seated = !!P().seat, mid = A.hips.clone().lerp(B.hips, .5); mid.y += seated ? .06 : -.05 * A.sc; if (seated) mid.addScaledVector(A.fwd, .22);
  const w = Math.min(1, h.t / .8), pole = (X, sd) => { const p = X.R['sh' + sd].getWorldPosition(new T.Vector3()).sub(X.chest); p.y = 0; p.normalize(); return p.add(new T.Vector3(0, -1, 0)).addScaledVector(X.fwd, -.3); };
  const RH = NC.RealHuman, gA = RH && RH.armGeo ? RH.armGeo(pg, side) : null, gB = RH && RH.armGeo ? RH.armGeo(n.g, sideB) : null;
  C.ikArm(A.R, side, mid.clone().addScaledVector(A.right, side === 'L' ? .015 : -.015), w, pole(A, side), B, gA ? { geo: gA } : null);
  C.ikArm(B.R, sideB, mid.clone().addScaledVector(B.right, sideB === 'L' ? .015 : -.015), w * .95, pole(B, sideB), A, gB ? { geo: gB } : null);
}

/* ═════════════ 7. 노래방 연결 — 「🏨 모텔」 버튼은 노래방(2차) 안에서만 ═════════════ */
const kBtn = document.createElement('button'); kBtn.id = 'kMotel'; kBtn.textContent = L('🏨 모텔', '🏨 Motel'); kBtn.style.display = 'none'; kBtn.title = L('함께 있는 상대와 모텔 가기(노래방 전용)', 'Go to a motel with your partner (karaoke only)');
(() => { const bar = document.getElementById('karaBar'); if (bar) bar.appendChild(kBtn); })();
function karaokePartners() {
  if (!K.inRoom || K.mode !== 'karaoke') return []; const set = new Set(); if (K.companion) set.add(K.companion); (K.guests || []).forEach(g => { if (!g.leftRoom && g.g.visible) set.add(g); }); if (K.BL && K.BL.n) set.add(K.BL.n);
  return [...set].filter(n => n && n.g && adult(n));
}
kBtn.onclick = () => openMenu();
async function choosePartner() {
  const ps = karaokePartners(); if (!ps.length) { NC.ui.toast(L('함께 노래방에 온 상대(동반·부킹)가 있어야 해요', 'You need someone with you in the karaoke room (companion or booking)')); return null; }
  if (ps.length === 1) return ps[0];
  const { val } = await modal(`<h3>${L('🏨 누구에게 물어볼까요?', '🏨 Who would you ask?')}</h3>`, ps.map((n, i) => [`${n.name} · ${L('호감도', 'affinity')} ${Math.round(n.aff)}`, i, i === 0]).concat([[L('취소', 'Cancel'), null]]));
  return val == null ? null : ps[val];
}
async function openMenu() {
  if (S.on || S.busy) return; const n = await choosePartner(); if (!n) return; n._motelMet = n._motelMet || performance.now();
  const a = attrs(n), m = memOf(n);
  const bars = [[L('호감', 'Attraction'), a.attraction], [L('신뢰', 'Trust'), a.trust], [L('로맨틱', 'Romance'), a.romance], [L('에너지', 'Energy'), a.energy], [L('경계심', 'Boundaries'), a.boundary]];
  const html = `<h3>🏨 MOTEL EXPERIENCE</h3><p style="opacity:.8">${esc(n.name)} · ${tr(n).style} ${L('성격', 'personality')}${m.visits ? ` · ${L('함께 간 적', 'visits')} ${m.visits}${L('번', '')}` : ''}${m.rej ? ` · ${L('거절', 'declined')} ${m.rej}${L('번', '')}` : ''}</p>
    <div style="display:grid;grid-template-columns:auto 1fr auto;gap:4px 8px;font-size:12px;margin:6px 0 10px">${bars.map(([k, v]) => `<span>${k}</span><span style="background:#ffffff18;border-radius:6px;overflow:hidden"><i style="display:block;height:8px;width:${v}%;background:linear-gradient(90deg,#ff5fa8,#ffd23d)"></i></span><span>${v}</span>`).join('')}</div>
    <p style="font-size:12px;opacity:.75">${L('상대는 언제든 거절할 수 있어요. 거절하면 초대는 바로 끝나요.', 'Your partner can always say no. A no ends the invitation immediately.')}</p>`;
  const { val } = await modal(html, STYLES.map(s => [s.t, s.id]).concat([[L('취소', 'Cancel'), null]]));
  if (!val) return; const st = STYLES.find(s => s.id === val); invite(n, st);
}
async function invite(n, st) {
  S.busy = true; meSay(pick(st.me)); await wait(1300);
  const r = decide(n, st), m = memOf(n);
  if (r.out === 'impaired') { nSay(line('impaired', n), 'sad'); sys(L('💧 둘 중 한 명이 많이 취해 있어요 — 판단력이 흐린 상태에서는 모텔 이동이 진행되지 않아요', '💧 Someone is too drunk — the motel option is unavailable while judgement is impaired')); S.busy = false; return; }
  if (r.out === 'pressure') { nSay(line('pressure', n), 'annoyed'); n.aff = Math.max(0, n.aff - 4); m.trust = Math.max(0, m.trust - 8); save(); NC.ui.toast(L('😣 재촉하면 신뢰가 떨어져요 (호감도 -4)', '😣 Pressuring lowers trust (affinity -4)')); if (m.pressure >= 2) partnerLeavesKaraoke(n); S.busy = false; return; }
  if (r.out === 'eager' || r.out === 'accept') { nSay(line(r.out, n), r.out === 'eager' ? 'laugh' : 'shy'); if (r.out === 'eager') n.aff = Math.min(100, n.aff + 2); m.trust = Math.min(100, m.trust + 3); save(); S.busy = false; return beginTrip(n, 'me', r.out === 'eager'); }
  if (r.out === 'discuss') {
    nSay(line('discuss', n), 'think'); await wait(900);
    const { val } = await modal(`<h3>💬 ${esc(n.name)}</h3><p>${line('discuss', n)}</p>`, [[L('솔직하게: 그냥 더 같이 있고 싶어서요. 싫으면 안 가도 돼요', 'Honestly: I just want more time with you. We don’t have to go'), 'honest', true], [L('편하게 쉬면서 얘기만 해요. 약속할게요', 'We’ll just relax and talk. I promise'), 'calm'], [L('(조르기) 에이 그냥 가요~', '(Push) Come on, let’s just go~'), 'push'], [L('아니에요, 없던 일로 해요', 'Never mind, forget it'), 'drop']]);
    if (val === 'honest' || val === 'calm') { const ok = inviteScore(n, st) + 9 >= 60; if (ok) { nSay(tr(n).bd > .6 ? L('…그렇게 말해 주니까 마음이 놓여요. 가요.', '…Hearing that puts me at ease. Let’s go.') : L('좋아요, 그럼 가요 ㅎㅎ', 'Alright, let’s go then!'), 'smile'); m.trust = Math.min(100, m.trust + 6); save(); S.busy = false; return beginTrip(n, 'me'); }
      nSay(L('솔직하게 말해 줘서 고마워요. 그래도 오늘은 아닌 것 같아요.', 'Thanks for being honest. Still, I don’t think tonight.'), 'shy'); m.lastOut = 'decline'; m.rej++; save(); S.busy = false; return; }
    if (val === 'push') { nSay(line('pressure', n), 'annoyed'); n.aff = Math.max(0, n.aff - 5); m.pressure++; m.rej++; m.lastOut = 'reject'; save(); S.busy = false; return; }
    nSay(L('네~ 노래나 해요 ㅎㅎ', 'Sure~ let’s sing, haha'), 'smile'); S.busy = false; return;
  }
  if (r.out === 'later') { nSay(line('later', n), 'shy'); m.postponed = Date.now(); m.affAtPost = n.aff; save(); NC.ui.toast(L('🤔 보류 — 조금 뒤(친해진 다음) 다시 물어볼 수 있어요', '🤔 Postponed — you can ask again later')); S.busy = false; return; }
  nSay(line(r.out, n), r.out === 'reject' ? 'annoyed' : 'shy'); m.rej++; if (r.out === 'reject') { n.aff = Math.max(0, n.aff - 4); m.trust = Math.max(0, m.trust - 5); } save();
  NC.ui.toast(r.out === 'reject' ? L('❌ 거절 — 초대가 끝났어요 (호감도 -4)', '❌ Rejected — invitation over (affinity -4)') : L('🙈 정중한 거절 — 초대가 끝났어요', '🙈 Politely declined — invitation over')); S.busy = false;
}
function partnerLeavesKaraoke(n) { nSay(L('저 먼저 갈게요. 오늘은 여기까지 해요.', 'I’m going to head out. Let’s end here tonight.'), 'sad'); setTimeout(() => { try { if (K.companion === n) K.companion = null; n.leftRoom = true; n.karaoke = false; NC.NPC.release(n); n.g.visible = false; n.state = 'off'; setTimeout(() => NC.NPC.show(n, true), 120e3); } catch (e) { } }, 1800); }
/* 상대가 먼저 제안 — 노래방에서 함께 2분 이상 · 상대의 마음(점수)이 충분할 때만, 한 번 */
async function npcInvites(n) {
  S.busy = true; S.nInvited = true; const t = tr(n);
  const lines = { shy: L('저기… 우리 여기서 나가서… 조용한 데 갈래요? 싫으면 괜찮아요.', 'Um… shall we leave and go somewhere quiet? It’s okay if not.'), cool: L('여기 나가서 둘이 조용히 있을래요? 근처에 괜찮은 모텔 있어요.', 'Want to leave and be somewhere quiet, just us? There’s a nice motel nearby.'), playful: L('우리 땡땡이칠래요? 근처 모텔 네온 간판 완전 레트로던데 ㅋㅋ', 'Wanna sneak off? The motel neon nearby looks so retro, haha'), outgoing: L('오늘 너무 재밌다~ 아직 헤어지기 싫은데, 모텔 가서 더 놀래요?', 'Tonight is so fun~ I don’t want to say bye yet. Motel and hang out more?') };
  nSay(lines[n.trait] || lines.outgoing, 'shy'); await wait(1200);
  const { val } = await modal(`<h3>💌 ${esc(n.name)}${L('님의 제안', '’s invitation')}</h3><p>${lines[n.trait] || lines.outgoing}</p>`, [
    [L('❤️ 좋아요, 가요', '❤️ Accept'), 'yes', true], [L('😊 완전 좋아요!', '😊 Accept with enthusiasm'), 'eager'], [L('🤔 조금만 생각해 볼게요', '🤔 Ask for more time'), 'time'], [L('💬 무슨 생각인지 얘기해 봐요', '💬 Discuss'), 'talk'],
    [L('🙈 미안해요, 오늘은 정중히 사양할게요', '🙈 Politely decline'), 'decline'], [L('❌ 아니요, 싫어요', '❌ Reject'), 'reject'], [L('👋 대화 그만하기', '👋 End the interaction'), 'end']]);
  const m = memOf(n); S.busy = false;
  if (val === 'yes' || val === 'eager') { meSay(val === 'eager' ? L('완전 좋아요! 가요 😊', 'I’d love to! Let’s go 😊') : L('좋아요, 같이 가요.', 'Sure, let’s go together.')); if (val === 'eager') n.aff = Math.min(100, n.aff + 3); return beginTrip(n, 'npc', val === 'eager'); }
  if (val === 'time') { meSay(L('조금만 생각할 시간 줘요.', 'Give me a moment to think.')); nSay(L('응, 천천히 생각해요. 부담 갖지 말고요 ㅎㅎ', 'Sure, take your time. No pressure.'), 'smile'); S.nInvited = false; S.inviteAt = performance.now() + 180e3; return; }
  if (val === 'talk') { meSay(L('어떤 생각으로 말한 거예요?', 'What do you have in mind?')); nSay(t.bd > .6 ? L('그냥… 더 같이 있고 싶어서요. 아무것도 안 해도 돼요. 얘기만 해도 좋아요.', 'Just… I want to be with you more. We don’t have to do anything. Talking is enough.') : L('오늘 너무 잘 맞아서요. 편하게 쉬면서 얘기하고 싶어요. 싫으면 진짜 괜찮아요!', 'We click so well tonight. I’d like to relax and talk. Really fine if not!'), 'shy'); await wait(1500); S.nInvited = false; return npcInvites2(n); }
  if (val === 'decline') { meSay(L('미안해요, 오늘은 정중히 사양할게요.', 'Sorry, I’ll politely pass tonight.')); nSay(L('아 그쳐, 괜찮아요! 말해 줘서 고마워요 ㅎㅎ', 'Oh, that’s fine! Thanks for telling me.'), 'smile'); m.myDecl = (m.myDecl || 0) + 1; save(); return; }
  if (val === 'reject') { meSay(L('아니요, 그런 건 싫어요.', 'No, I don’t want that.')); nSay(L('…아, 미안해요. 불편하게 했네요.', '…Oh, sorry. I made it awkward.'), 'sad'); n.aff = Math.max(0, n.aff - 3); save(); return; }
  nSay(L('…아 네. 노래나 해요!', '…Oh, okay. Let’s sing!'), 'shy');
}
async function npcInvites2(n) { const { val } = await modal(`<h3>💌 ${esc(n.name)}</h3><p>${L('그래서… 어때요?', 'So… what do you think?')}</p>`, [[L('❤️ 좋아요, 가요', '❤️ Accept'), 'yes', true], [L('🙈 오늘은 사양할게요', '🙈 Politely decline'), 'no']]);
  if (val === 'yes') { meSay(L('그럼 가요.', 'Let’s go then.')); return beginTrip(n, 'npc'); } nSay(L('응, 알겠어요. 오늘 즐거웠어요 ㅎㅎ', 'Okay, I get it. I had fun tonight.'), 'smile'); }
function karaokeTick(dt) {
  const ps = karaokePartners(), show = !S.on && ps.length > 0 && !(K.BL && K.BL.busy); if ((kBtn.style.display !== 'none') !== show) kBtn.style.display = show ? '' : 'none';
  if (!show || S.busy || S.nInvited || document.querySelector('.modal')) return;
  S.kT = (S.kT || 0) + dt; if (S.kT < 20) return; S.kT = 0;
  const n = ps.find(x => x === K.companion) || ps[0]; n._motelMet = n._motelMet || performance.now(); if (performance.now() - n._motelMet < 120e3 || performance.now() < S.inviteAt) return;
  if (impaired(n) || n.aff < 70 || K.playing) return; const s = inviteScore(n, STYLES[3]); if (s >= 70 && noise(n, 'npcInv' + Math.floor(Date.now() / 60e3)) > .1) npcInvites(n);
}

/* ═════════════ 8. 동의 후: 모텔 · 방 · 대실/숙박 · 결제 · 이동 ═════════════ */
async function beginTrip(n, by, eager) {
  S.n = n; S.by = by; S.comfort = U.clamp(inviteScore(n, STYLES[1]) - 18 + (eager ? 6 : 0), 40, 85); S.events.clear(); S.photos = 0;
  // ① 모텔 고르기
  const hs = HOTELS.map((h, i) => { const av = avail(h); return [`${h.name} — ${h.desc}${av.every(x => !x) ? L(' (만실)', ' (full)') : ''}`, i, i === 0]; });
  let { val: hv } = await modal(`<h3>${L('🗺 어느 모텔로 갈까요?', '🗺 Which motel?')}</h3><p style="font-size:12px;opacity:.75">${L('「깜짝 행선지」는 상대가 골라요', '“Surprise” lets your partner choose')}</p>`, hs.concat([[L('🎲 상대에게 맡기기', '🎲 Let partner choose'), 'surprise'], [L('취소', 'Cancel'), null]]));
  if (hv == null) return cancelTrip(L('마음이 바뀌었어요', 'Changed my mind'));
  if (hv === 'surprise') { hv = tr(n).pl > .6 ? 2 : tr(n).bd > .6 ? 0 : 1; nSay(L(`음~ ${HOTELS[hv].name} 어때요? 거기 분위기 좋대요 ㅎㅎ`, `Hmm~ how about ${HOTELS[hv].name}? I hear it’s nice.`), 'smile'); }
  S.hotel = HOTELS[hv]; const av = avail(S.hotel);
  if (av.every(x => !x)) { sys(L(`😢 ${S.hotel.name}은(는) 오늘 만실이에요 — 다른 곳을 골라요`, `😢 ${S.hotel.name} is full tonight — pick another`)); return beginTrip(n, by, eager); }
  // ② 방 종류(먼저 제안한 사람이 고르고, 상대는 수락하거나 다른 방 제안)
  const pickRoom = async () => { const { val } = await modal(`<h3>🛏 ${S.hotel.name} — ${L('방 고르기', 'Choose a room')}</h3><p style="font-size:12px">${L('🪙 내 코인', '🪙 My coins')}: ${NC.Wallet.get()}${DB.me.vip ? ' · 💎 VIP -20%' : ''}</p>`,
    CATS.map((c, i) => [`${c.name} · ${L('대실', '2h')} 🪙${Math.round(c.rent * S.hotel.k)} / ${L('숙박', 'night')} 🪙${Math.round(c.night * S.hotel.k)} — ${c.desc}${av[i] ? ` (${L('남은 방', 'left')} ${av[i]})` : L(' — 만실', ' — sold out')}`, i, i === 1]).concat([[L('취소', 'Cancel'), null]])); return val; };
  let ci = by === 'npc' ? CATS.findIndex(c => c.id === tr(n).room) : await pickRoom(); if (ci == null) return cancelTrip(L('방 고르다 그만뒀어요', 'Stopped choosing'));
  if (by === 'npc') nSay(L(`${CATS[ci].name} 어때요? 제가 고른 방이에요 ㅎㅎ`, `How about the ${CATS[ci].name}? I picked it!`), 'smile');
  while (!av[ci]) { sys(L(`🚫 ${CATS[ci].name}은(는) 만실이에요 — 다른 방을 골라요`, `🚫 ${CATS[ci].name} is sold out — pick another`)); ci = await pickRoom(); if (ci == null) return cancelTrip(L('방이 없어서 그만뒀어요', 'No rooms, cancelled')); }
  const pref = CATS.findIndex(c => c.id === tr(n).room);
  if (by === 'me' && pref !== ci && av[pref] && Math.abs(pref - ci) >= 1 && noise(n, 'room' + ci) > -.1) {
    nSay(pref > ci ? L(`음… ${CATS[pref].name}은 어때요? 거기가 더 예쁘대요!`, `Hmm… how about the ${CATS[pref].name}? It’s prettier!`) : L(`${CATS[pref].name}도 충분할 것 같아요. 너무 비싼 데 말고요 ㅎㅎ`, `The ${CATS[pref].name} is plenty. Nothing too pricey!`), 'smile');
    const { val } = await modal(`<h3>💬 ${esc(n.name)}${L('의 제안', ' suggests')}</h3><p>${CATS[pref].name} — ${CATS[pref].desc}</p>`, [[L(`그래요, ${CATS[pref].name}로`, `Okay, ${CATS[pref].name}`), 'theirs', true], [L(`원래대로 ${CATS[ci].name}`, `Keep ${CATS[ci].name}`), 'mine']]);
    if (val === 'theirs') { ci = pref; nSay(L('헤헤 고마워요~', 'Hehe, thank you~'), 'laugh'); } else nSay(L('좋아요, 그 방도 좋아요!', 'Okay, that one’s good too!'), 'smile');
  }
  S.cat = CATS[ci].id;
  // ③ 대실 / 숙박
  const c = CATS[ci], { val: stay } = await modal(`<h3>⏰ ${c.name}</h3><p>${L('체크인', 'Check-in')} ${new Date().toTimeString().slice(0, 5)}</p>`, [[`${L('대실 2시간', '2-hour stay')} · 🪙${Math.round(c.rent * S.hotel.k)}`, 'rent', true], [`${L('숙박(아침까지)', 'Overnight (till morning)')} · 🪙${Math.round(c.night * S.hotel.k)}`, 'night'], [L('취소', 'Cancel'), null]]);
  if (!stay) return cancelTrip(L('예약 취소', 'Reservation cancelled'));
  S.stay = stay; S.price = Math.round((stay === 'rent' ? c.rent : c.night) * S.hotel.k);
  // ④ 결제
  const paid = await payment(n); if (!paid) return cancelTrip(L('결제를 마치지 못했어요', 'Payment not completed'));
  // ⑤ 이동 수단
  const drank = ((NC.Life && NC.Life.tipsy) || 0) > .3 || !!n.drunk || !!(NC.Life && NC.Life.sips > 0);
  const opts = [[`${L('🚕 택시', '🚕 Taxi')} · 🪙8`, 'taxi', true], [`${L('🚘 모범택시(VIP 차량)', '🚘 VIP car service')} · 🪙25`, 'vip']];
  if (S.hotel.walk) opts.push([L('🚶 걸어가기(3분)', '🚶 Walk (3 min)'), 'walk']);
  opts.push([drank ? L('🚗 자가용 — 술을 마셔서 운전 불가', '🚗 Own car — can’t drive after drinking') : L('🚗 자가용', '🚗 Private car'), drank ? 'nodrive' : 'car']);
  let tv = null; for (;;) { ({ val: tv } = await modal(`<h3>${L('🚦 어떻게 갈까요?', '🚦 How do we get there?')}</h3>`, opts)); if (tv !== 'nodrive') break; sys(L('🚫 음주 운전은 안 돼요 — 다른 수단을 골라요', '🚫 No drunk driving — choose another way')); }
  const fare = tv === 'taxi' ? 8 : tv === 'vip' ? 25 : 0; if (fare && !NC.Wallet.spend(fare)) { sys(L('🪙 택시비가 모자라 걸어가요', '🪙 Not enough for the fare — walking')); tv = S.hotel.walk ? 'walk' : 'taxi'; }
  S.transport = tv || 'taxi'; S.weather = (U.hash(new Date().toDateString() + S.hotel.id + new Date().getHours()) % 10) < 4 ? 'rain' : 'clear';
  return depart();
}
async function payment(n) {
  const t = tr(n), price0 = S.price, vip = DB.me.vip, price = vip ? Math.round(price0 * .8) : price0, coupon = DB.me.coupon && S.stay === 'rent' && S.cat === 'std';
  const opts = [[`${L('💳 내가 낼게요', '💳 I’ll pay')} · 🪙${price}`, 'me', true], [L('🙏 상대가 내 주기(부탁)', '🙏 Partner pays (ask)'), 'them'], [`${L('➗ 반반', '➗ Split')} · 🪙${Math.ceil(price / 2)}`, 'split'], [`${L('👛 커플 지갑', '👛 Shared wallet')}${memOf(n).shared ? ` (🪙${memOf(n).shared})` : ''}`, 'shared']];
  if (vip) opts.push([L('💎 VIP 예약(-20% 적용됨)', '💎 VIP reservation (-20% applied)'), 'me']); else opts.push([L('💎 VIP 멤버십 가입 🪙200 (모든 방 -20%)', '💎 Join VIP 🪙200 (-20% on all rooms)'), 'joinvip']);
  if (coupon) opts.push([L('🎟 첫 방문 무료 대실 쿠폰 사용', '🎟 First-visit free room coupon'), 'coupon']);
  opts.push([L('취소', 'Cancel'), null]);
  for (;;) {
    const { val } = await modal(`<h3>💰 ${L('결제', 'Payment')} — ${catOf(S.cat).name} ${S.stay === 'rent' ? L('대실', '2h') : L('숙박', 'overnight')}</h3><p>${L('금액', 'Price')} 🪙${price}${vip ? ` (${L('정가', 'list')} ${price0})` : ''} · ${L('내 코인', 'My coins')} 🪙${NC.Wallet.get()}</p>`, opts);
    if (!val) return false;
    if (val === 'coupon') { DB.me.coupon = false; save(); S.paid = 0; S.payer = 'promo'; sys(L('🎟 프로모션 — 이번 대실은 무료예요!', '🎟 Promotion — this stay is free!')); return true; }
    if (val === 'joinvip') { if (!NC.Wallet.spend(200)) { sys(L('🪙 코인이 부족해 VIP 가입을 못 했어요', '🪙 Not enough coins for VIP')); continue; } DB.me.vip = true; save(); sys(L('💎 VIP 멤버가 됐어요 — 앞으로 모든 방 20% 할인', '💎 You’re a VIP — 20% off all rooms')); return payment(n); }
    if (val === 'them') { const ok = n.aff >= 78 && t.pay + noise(n, 'pay') * .3 > .42; if (ok) { nSay(L('오늘은 제가 낼게요. 다음엔 맛있는 거 사 줘요 ㅎㅎ', 'I’ll pay tonight. Treat me to something nice next time!'), 'smile'); S.paid = 0; S.payer = 'partner'; return true; } nSay(L('음… 오늘은 반반 어때요? ㅎㅎ', 'Hmm… how about we split it?'), 'shy'); continue; }
    if (val === 'split') { const half = Math.ceil(price / 2); if (!NC.Wallet.spend(half)) { sys(L('💸 결제 실패 — 코인이 모자라요', '💸 Payment failed — not enough coins')); continue; } nSay(L('좋아요, 반반이 깔끔하죠!', 'Good, splitting is fair!'), 'smile'); S.paid = half; S.payer = 'split'; return true; }
    if (val === 'shared') { const m = memOf(n); m.shared = m.shared || 0; const need = Math.max(0, price - m.shared), mine = Math.ceil(need / 2); if (!NC.Wallet.spend(mine)) { sys(L('💸 커플 지갑을 채우지 못했어요 — 코인이 모자라요', '💸 Couldn’t fund the shared wallet')); continue; } m.shared = Math.max(0, m.shared + mine * 2 - price); save(); S.paid = mine; S.payer = 'shared'; sys(L(`👛 커플 지갑에서 결제했어요 (각자 🪙${mine} 충전 · 남은 잔액 🪙${m.shared})`, `👛 Paid from the shared wallet (each added 🪙${mine} · balance 🪙${m.shared})`)); return true; }
    if (val === 'me') { if (!NC.Wallet.spend(price)) { sys(L('💸 결제 실패 — 코인이 모자라요. 더 싼 방·반반·상대 결제 중에 골라요', '💸 Payment failed — choose a cheaper room, split, or ask your partner')); continue; } S.paid = price; S.payer = 'me'; nSay(L('고마워요 💗', 'Thank you 💗'), 'shy'); return true; }
  }
}
function cancelTrip(why) { sys(`↩ ${why}`); S.n = null; S.busy = false; }
/* 출발 — 노래방을 나와(동반자 데리고) 차 안 장면 → 모텔 앞 도착 */
const ov = document.createElement('div'); ov.id = 'motelRide'; ov.style.display = 'none'; document.body.appendChild(ov);
async function depart() {
  const n = S.n; S.on = true; S.busy = true; S.step = 'ride'; const p = P();
  meSay(L('가요!', 'Let’s go!')); await wait(700);
  const kind = S.transport, label = { taxi: L('🚕 택시를 타고 이동 중…', '🚕 Riding a taxi…'), vip: L('🚘 모범택시로 이동 중…', '🚘 VIP car on the way…'), walk: L('🚶 네온 골목을 걸어가는 중…', '🚶 Walking down the neon alley…'), car: L('🚗 자가용으로 이동 중…', '🚗 Driving…') }[kind];
  ov.innerHTML = `<div class="mrSky"></div><div class="mrCity"></div><div class="mrRoad"></div><div class="mrCar ${kind}">${kind === 'walk' ? '🚶‍♂️🚶‍♀️' : kind === 'vip' ? '🚘' : kind === 'car' ? '🚗' : '🚕'}</div>${S.weather === 'rain' ? '<div class="mrRain"></div>' : ''}<div class="mrTxt">${label}<small>${S.hotel.name} · ${catOf(S.cat).name}</small></div>`;
  ov.style.display = 'block'; requestAnimationFrame(() => ov.classList.add('on'));
  // 노래방 정리(동반자는 놓아 주지 않고 데려감)
  const prevCb = K.onLeave; K.onLeave = () => { try { prevCb && prevCb(); } catch (e) { } };
  try { if (K.BL && K.BL.n) K.endBlues('leave'); } catch (e) { }
  K.leave();
  await wait(700);
  const pool = { taxi: [[L('기사님, 조금만 천천히 가 주세요 ㅎㅎ', 'Driver, a bit slower please')], [L('창밖에 네온 너무 예쁘다…', 'The neon outside is so pretty…')]], vip: [[L('와 차 완전 좋다… 오늘 무슨 날이에요? ㅋㅋ', 'Wow, nice car… what’s the occasion?')]], walk: [[L('밤공기 시원하다~', 'The night air feels nice~')], [S.weather === 'rain' ? L('비 온다! 우산 같이 써요 ☔', 'It’s raining! Share the umbrella ☔') : L('별 보인다, 저기!', 'Look, stars!')]], car: [[L('운전하는 모습 멋있는데요? ㅎㅎ', 'You look cool driving, haha')]] }[kind];
  try { n.karaoke = false; n.booked = true; n.motel = true; n.state = 'motel'; n.leftRoom = false; } catch (e) { }
  for (const [t] of pool) { NC.ui.chatAdd(n.name, t); await wait(1500); }
  await wait(600);
  arriveExterior();
  setTimeout(() => { ov.classList.remove('on'); setTimeout(() => { ov.style.display = 'none'; }, 600); }, 450);
}
function arriveExterior() {
  drawSigns(S.hotel); EXTV.rain.visible = S.weather === 'rain'; S.step = 'ext';
  goArea(EXT, EXT.entry, () => {
    const taxi = S.transport !== 'walk' ? EXTV.car(S.transport === 'vip' ? '#0c0c10' : S.transport === 'car' ? '#2a3a5a' : '#e8a020', S.transport === 'car' ? null : S.transport) : null;
    if (taxi) { taxi.position.set(BX - 2.6, 0, 5.6); taxi.rotation.y = Math.PI / 2; EXT.G.add(taxi); EXTV.taxi = { g: taxi, t: 0 }; }
    S.busy = false; P().busy = false;
    nSay(S.weather === 'rain' ? L('비 오는 날 네온은 진짜 영화 같다… 얼른 들어가요 ☔', 'Neon on a rainy night feels like a movie… let’s go in ☔') : L(`여기가 ${S.hotel.name}이구나… 간판 완전 90년대다 ㅎㅎ`, `So this is ${S.hotel.name}… the sign is so 90s!`), 'smile');
    NC.ui.toast(L('🚪 입구(유리문)로 걸어가 E 를 눌러요 — 상대가 옆에서 같이 걸어요', '🚪 Walk to the glass door and press E — your partner walks beside you'));
  });
}

/* ═════════════ 9. 로비 — 체크인 · 우연한 만남 · 엘리베이터 ═════════════ */
async function enterLobby() {
  ensureClerk(); S.step = 'lobby'; maybeEncounter();
  goArea(LOB, LOB.entry, () => { ding(); say(LOBV.clerk, L('어서 오세요~', 'Welcome~')); NC.ui.toast(L('🛎 카운터로 가서 E — 체크인', '🛎 Go to the counter and press E — check in')); });
}
let encounterG = null;
function maybeEncounter() {
  if (encounterG) { LOB.G.remove(encounterG); encounterG = null; } S.encounter = null;
  const others = (NC.NPC ? NC.NPC.personas() : []).filter(o => o !== S.n && o.enabled); if (!others.length || noise(S.n, 'enc' + DB.me.visits) < .22) return;
  const o = others[U.hash(String(DB.me.visits)) % others.length]; S.encounter = o;
  const g = NC.Avatar.create({ name: o.name, look: o.g.userData.look || {}, seed: U.hash(o.name + ':m'), expr: 'surprised' });
  try { const RH = NC.RealHuman, id = RH && RH.modelIdFor && RH.modelIdFor(o), m = id && RH.modelOf(id); if (m) RH.pin(g, NC.isMobile ? (m.lodm || m.lod.replace(/_lod\.glb$/, '_lodm.glb')) : m.lod); } catch (e) { }
  NC.seatAvatar(g, BX - 3.3, 30 + 1.0, Math.PI / 2, .45); LOB.G.add(g); encounterG = g;
}
async function checkIn() {
  if (S.step !== 'lobby' || S.busy) return; S.busy = true; const c = catOf(S.cat), clerk = LOBV.clerk;
  if (S.encounter && !S.events.has('e12')) { S.events.add('e12'); const o = S.encounter;
    say(encounterG, L(`어?! ${S.n.name}…? 여기서 보네? ㅎㅎ`, `Huh?! ${S.n.name}…? Fancy seeing you here!`), 3.5); NC.ui.chatAdd(o.name, L(`어?! ${S.n.name}…? 여기서 보네? ㅎㅎ`, `Huh?! ${S.n.name}…? Fancy seeing you here!`)); await wait(1600);
    const { val } = await modal(`<h3>😳 ${L('뜻밖의 만남', 'Unexpected encounter')}</h3><p>${L(`클럽에서 본 ${esc(o.name)}님이 로비 소파에 있어요.`, `${esc(o.name)} from the club is sitting in the lobby.`)}</p>`, [[L('😊 자연스럽게 인사하기', '😊 Say hi casually'), 'hi', true], [L('🤫 못 본 척 지나가기', '🤫 Pretend not to see'), 'skip'], [L('😂 웃으며 농담하기', '😂 Laugh it off with a joke'), 'joke']]);
    if (val === 'hi') { meSay(L('아 안녕하세요~ 좋은 밤 보내세요 ㅎㅎ', 'Oh hi~ have a good night!')); nSay(L('(작게) 아는 사람이에요? 깜짝 놀랐네 ㅎㅎ', '(quietly) You know them? That surprised me.'), 'shy'); }
    else if (val === 'joke') { meSay(L('세상 진짜 좁다~ 비밀이에요? ㅋㅋ', 'Small world~ our secret, okay? Haha')); say(encounterG, L('ㅋㅋㅋ 서로 비밀!', 'Haha, mutual secret!')); S.comfort += 3; }
    else { S.comfort -= 2; nSay(L('…방금 그 사람 아는 사람 아니에요? ㅋㅋ', '…wasn’t that someone you know? Haha'), 'laugh'); }
    await wait(900); }
  say(clerk, L('대실이세요, 숙박이세요?', 'A short stay or overnight?')); await wait(900); meSay(S.stay === 'rent' ? L('대실이요.', 'Short stay, please.') : L('숙박이요.', 'Overnight, please.'));
  // 방금 방이 나감(빈방 없음) — 업그레이드·다른 방·기다리기·취소
  if (noise(S.n, 'gone' + DB.me.visits + S.cat) > .38) {
    await wait(700); say(clerk, L(`어머, ${c.name}이 방금 마지막 방이 나갔네… 미안해서 어쩌나.`, `Oh dear, the last ${c.name} just went… I’m sorry.`), 3.6);
    const up = CATS[Math.min(4, CATS.findIndex(x => x.id === S.cat) + 1)], dn = CATS[Math.max(0, CATS.findIndex(x => x.id === S.cat) - 1)];
    const { val } = await modal(`<h3>🚫 ${L('빈방 없음', 'Room unavailable')}</h3><p>${L('카운터에서 대안을 알려 줬어요.', 'The desk offers alternatives.')}</p>`, [[L(`⬆ 같은 값에 ${up.name}로 업그레이드`, `⬆ Upgrade to ${up.name} at same price`), 'up', true], [L(`⬇ ${dn.name}로 바꾸고 차액 환불`, `⬇ Switch to ${dn.name}, refund difference`), 'down'], [L('⏳ 청소 끝날 때까지 기다리기', '⏳ Wait for cleaning'), 'wait'], [L('↩ 취소하고 환불받기', '↩ Cancel and refund'), 'cancel']]);
    if (val === 'up') { S.cat = up.id; nSay(L('와 대박! 업그레이드라니 ㅎㅎ', 'Wow! An upgrade!'), 'laugh'); S.comfort += 4; }
    else if (val === 'down') { const diff = Math.max(0, Math.round(((S.stay === 'rent' ? c.rent - dn.rent : c.night - dn.night)) * S.hotel.k * (S.payer === 'split' ? .5 : S.payer === 'me' ? 1 : 0))); if (diff) NC.Wallet.add(diff, L('차액 환불', 'difference refund')); S.cat = dn.id; }
    else if (val === 'wait') { sys(L('⏳ 로비 소파에서 잠깐 기다려요…', '⏳ Waiting on the lobby sofa…')); await wait(2500); say(clerk, L('청소 끝났어요~ 올라가세요!', 'Cleaning’s done~ go on up!')); }
    else { if (S.paid) NC.Wallet.add(S.paid, L('예약 취소 환불', 'cancellation refund')); S.busy = false; return checkoutReturn(L('예약을 취소했어요', 'Reservation cancelled')); }
  }
  S.roomNo = 301 + (U.hash(S.cat + DB.me.visits + S.hotel.id) % 6);
  await wait(800); say(clerk, L(`${S.roomNo}호예요. 엘리베이터 타고 3층이요~ 열쇠 여기 있어요.`, `Room ${S.roomNo}. Elevator to the 3rd floor~ here’s your key.`), 3.6);
  await wait(900); sys(L(`🔑 ${S.roomNo}호 열쇠를 받았어요 · ${catOf(S.cat).name} · ${S.stay === 'rent' ? L('대실 2시간', '2h stay') : L('숙박', 'overnight')} · ${L('체크인', 'check-in')} ${new Date().toTimeString().slice(0, 5)}`, `🔑 Got the key for room ${S.roomNo}`));
  memOf(S.n).visits++; DB.me.visits++; DB.me.spent += S.paid; logMe(`${S.hotel.name} ${catOf(S.cat).name} · ${S.n.name} · ${S.payer}`); save();
  S.step = 'elev'; S.busy = false; NC.ui.toast(L('🛗 엘리베이터 앞으로 가서 E', '🛗 Go to the elevator and press E'));
}
async function rideElevator() {
  if (S.step !== 'elev' || S.busy) return; S.busy = true; LOBV.btn.material.color.copy(col('#ffcf6a')).multiplyScalar(3); beep(660, .1);
  for (let f = 1; f <= 1; f++) drawFloor(LOBV.ind.cv, LOBV.ind.t, '1'); await wait(700); ding(); await doors(LOBV, true);
  nSay(pick([L('엘리베이터 거울 보니까 좀 떨린다 ㅎㅎ', 'Seeing us in the elevator mirror makes me nervous, haha'), L('3층이죠? 제가 누를게요!', '3rd floor, right? I’ll press it!'), L('…(살짝 손을 잡는다)', '…(lightly holds your hand)')]), 'shy');
  await wait(900); S.step = 'corr'; S.busy = false;
  goArea(COR, COR.entry, async () => { ding(); doorsAnim(CORV, true); const d = CORV.doors.find(x => x.no === S.roomNo); CORV.doors.forEach(x => x.led.material.color.copy(col(x.no === S.roomNo ? '#30ff60' : (U.hash(x.no + S.hotel.id) & 1) ? '#ff3040' : '#30ff60')).multiplyScalar(1.6));
    NC.ui.toast(L(`🚪 ${S.roomNo}호 문 앞으로 가서 E`, `🚪 Go to room ${S.roomNo} and press E`)); setTimeout(() => doorsAnim(CORV, false), 2500);
    otherCouple(); });
  LOBV.btn.material.color.copy(col('#ffcf6a')); setTimeout(() => doors(LOBV, false), 600);
}
function doors(V, open) { return new Promise(res => { V._anim = { t: 0, open, res }; }); }
function doorsAnim(V, open) { V._anim = { t: 0, open, res: null }; }
function doorTick(V, dt, axis) { const a = V._anim; if (!a) return; a.t = Math.min(1, a.t + dt / .9); const k = a.open ? a.t : 1 - a.t, e = k * k * (3 - 2 * k);
  if (axis === 'x') { V.dL.position.x = BX - .94 - e * .62; V.dR.position.x = BX - .26 + e * .62; } else { V.dL.position.z = 60 - .34 - e * .62; V.dR.position.z = 60 + .34 + e * .62; }
  if (a.t >= 1) { V._anim = null; a.res && a.res(); } }
/* 다른 커플(동시에 여러 방 이용) — 복도 반대편 끝에서 방으로 들어가는 두 사람 */
let oc = null;
function otherCouple() {
  if (oc) { oc.forEach(g => COR.G.remove(g)); oc = null; } if (noise(S.n, 'oc' + DB.me.visits) < -.15) return;
  const a = NC.Avatar.create({ name: L('다른 손님', 'Guest'), look: { gender: 'm', height: 1.76 }, seed: 77 + DB.me.visits }), b = NC.Avatar.create({ name: L('다른 손님', 'Guest'), look: { gender: 'f', height: 1.62 }, seed: 91 + DB.me.visits });
  [a, b].forEach((g, i) => { g.userData.hideLabel = true; g.position.set(BX + 6.5, 0, 60 + (i ? .35 : -.35)); g.rotation.y = -Math.PI / 2; COR.G.add(g); g.userData.moving = true; });
  oc = [a, b]; oc.t = 0;
}

/* ═════════════ 10. 객실 ═════════════ */
async function enterRoom() {
  if (S.step !== 'corr' || S.busy) return; S.busy = true; buildRoom(S.cat); S.step = 'room'; S.clockMin = 0; S.endMin = S.stay === 'rent' ? 120 : 600; S.evNext = 40; S.mood = 'warm'; S.tvOn = false; S.space = false;
  knockAt(); await wait(300);
  goArea(ROOM, ROOM.entry, () => { S.busy = false; applyMood(); bar.style.display = 'flex'; updBar(); try { S.onRoom && S.onRoom(); } catch (e) { console.warn(e); }
    nSay(roomLine(), 'smile'); sys(L('🛋 아래 「🧭 할 일」에서 활동을 골라요 · 로맨틱한 행동은 매번 상대의 동의를 확인해요 · 언제든 ⏹ 그만', '🛋 Pick activities from “🧭 Activities” · romantic actions always check consent · ⏹ Stop anytime'));
    if (tr(S.n).bd > .6 && !S.events.has('e02')) { S.events.add('e02'); setTimeout(() => nSay(L('저… 이런 데 처음이라 좀 어색해요. 천천히 얘기부터 해요, 네?', 'I… this is my first time somewhere like this. Let’s just talk slowly first, okay?'), 'shy'), 4500); }
  });
}
function knockAt() { beep(500, .05, 'square', .04); }
const roomLine = () => ({ std: L('아담하고 좋다~ 브라운관 TV 완전 옛날 거네 ㅋㅋ', 'Cozy~ that CRT TV is so old school!'), dlx: L('오 생각보다 넓다! 창밖 야경 봐요.', 'Oh, bigger than I thought! Look at the view.'), rom: L('헐… 원형 침대에 천장 거울… 완전 90년대 모텔이다 ㅋㅋㅋ', 'Whoa… round bed and a ceiling mirror… so 90s, haha'), vip: L('여기 샴페인도 있어요! 오늘 완전 VIP네 ㅎㅎ', 'There’s champagne! We’re total VIPs tonight!'), jac: L('자쿠지다!! 물 색깔 예쁘다… 창밖 야경도 미쳤어요.', 'A jacuzzi!! The water’s so pretty… and that view!') })[S.cat];
const MOODS = { bright: ['#fff4e8', 1.5, L('💡 밝게', '💡 Bright')], warm: ['#ffb070', 1.1, L('🕯 따뜻하게', '🕯 Warm')], neon: ['#ff3d9a', 1.0, L('💗 핑크 네온', '💗 Pink neon')], dim: ['#6a5aff', .45, L('🌙 은은하게', '🌙 Dim')], morning: ['#ffe8c8', 1.7, '☀'] };
function applyMood() { const L2 = W.lights || {}, [c, i] = MOODS[S.mood] || MOODS.warm; ['bar', 'corridor'].forEach(k => { const l = L2[k]; if (l) { l.color.copy(col(c)); l.intensity = i * (k === 'bar' ? 1.2 : 1); } }); if (L2.key) L2.key.intensity = .5 * i; RV.lights.forEach(m => m.material.color.copy(col(S.mood === 'neon' ? '#ff3d9a' : RV.accent)).multiplyScalar(S.mood === 'dim' ? 1 : 2.2)); }
/* 앉기·서기 */
NC.standHandlers = NC.standHandlers || {}; NC.standHandlers.motel = s => ({ x: s.x + Math.sin(s.ry) * .75, z: s.z + Math.cos(s.ry) * .75 });
function sitBoth(where) {
  const seats = RV.seats[where]; if (!seats) return; const [a, b] = seats, p = P(), n = S.n; endStanding(); stopHand();
  const ax = BX + a.x, az = 90 + a.z, bx = BX + b.x, bz = 90 + b.z;
  NC.sitPlayer({ kind: 'motel', where, x: ax, z: az, ry: a.ry }, { x: ax, z: az, ry: a.ry, h: a.h }); p.group.position.set(ax, 0, az); p.group.rotation.y = a.ry;
  if (!S.space) { NC.NPC.sit(n, bx, bz, b.ry, b.h); n.g.userData.lookAt = p; } S.follow = false; S.seat = where;
}
function standBoth() { const p = P(); if (p.seat) NC.requestStand(); const n = S.n; if (n && n.state === 'seated') { NC.unseatAvatar(n.g, n.x + .6, n.z); n.state = 'motel'; } S.follow = true; S.seat = null; try { NC.Couple && (NC.Couple.ST.sofa = null); } catch (e) { } }
function endStanding() { try { if (K.BL && K.BL.n === S.n) K.endBlues('leave'); } catch (e) { } if (S.n && S.n.state === 'blues') S.n.state = 'motel'; }   // 'leave' = 블루스가 상대를 클럽 배회 상태로 돌려놓지 않음

/* 동의 확인 — 편안함(comfort) · 경계심 · 반복 요청 */
const NEED = { hand: 42, close: 45, cuddle: 58, hug: 55, cheek: 60, forehead: 64, kiss: 70, whisper: 48, sleep: 50, jac: 62 };
function consent(kind) {
  const n = S.n, t = tr(n), m = memOf(n), last = S.lastNo && S.lastNo.k === kind && performance.now() - S.lastNo.t < 60e3;
  if (impaired(n)) return 'no';
  if (adminMax()) return 'yes';
  if (last) { S.pressure = (S.pressure || 0) + 1; return 'pressure'; }
  const v = S.comfort + n.aff * .2 - (NEED[kind] || 50) - (t.bd - .5) * 18 + noise(n, kind + S.clockMin / 15 | 0) * 8 + m.visits * 2;
  return v >= 8 ? 'yes' : v >= 0 ? 'soft' : v >= -8 ? 'notyet' : 'no';
}
async function romantic(kind, run) {
  const r = consent(kind), n = S.n;
  if (r === 'pressure') { nSay(L('방금 아직이라고 했잖아요… 저 조금 불편해요.', 'I just said not yet… I’m a bit uncomfortable.'), 'annoyed'); S.comfort -= 8; if ((S.pressure || 0) >= 2) return awkward(true); return; }
  if (r === 'no') { nSay(pick([L('미안해요, 그건 싫어요.', 'Sorry, I don’t want that.'), L('…아니에요. 우리 그냥 얘기해요.', '…No. Let’s just talk.')]), 'annoyed'); S.comfort -= 5; S.lastNo = { k: kind, t: performance.now() }; return; }
  if (r === 'notyet') { nSay(pick([L('음… 아직은 조금 이른 것 같아요. 천천히요.', 'Hmm… it’s a little early. Slowly.'), L('잠깐만요… 조금만 더 얘기해요 ㅎㅎ', 'Wait… let’s talk a little more.')]), 'shy'); S.comfort -= 1; S.lastNo = { k: kind, t: performance.now() }; return; }
  if (r === 'soft') nSay(pick([L('…천천히요 💗', '…slowly 💗'), L('음… 좋아요.', 'Mm… okay.')]), 'shy');
  else nSay(pick([L('좋아요 💗', 'Okay 💗'), L('헤헤… 저도요.', 'Hehe… me too.')]), 'shy');
  S.comfort = Math.min(100, S.comfort + (r === 'yes' ? 4 : 2)); n.aff = Math.min(100, n.aff + 1); await run(r);
}
/* 서서 하는 로맨틱 동작 — 블루스(커플 IK·얼굴 IK) 시스템 재사용 */
async function standAct(kind) {
  const p = P(), n = S.n; if (p.seat || n.state === 'seated') standBoth(); stopHand();
  await wait(300);
  if (!(K.BL && K.BL.n === n)) { try { K.startBlues(n); } catch (e) { console.warn(e); return; } await wait(1500); }
  try { K.bluesAct(kind, { out: 'accept', d: 0, e: 'smile', line: '…', kiss: kind === 'kiss' ? 2.4 : 0 }); } catch (e) { console.warn(e); }
  S.act = { k: kind, t: 0 };
}
/* 활동 목록 */
const ACTS = {
  general: [
    ['tv', L('📺 같이 TV 보기', '📺 Watch TV together'), () => { sitBoth(RV.seats.sofa ? 'sofa' : 'bed'); S.tvOn = true; tvShow.ch = (tvShow.ch + 1) % 4; nSay(pick([L('어 이거 가요 프로다! 이 노래 기억나요?', 'Oh, a music show! Remember this song?'), L('심야 영화 하네~ 이불 덮고 보면 딱인데 ㅎㅎ', 'A late movie~ perfect under a blanket!'), L('뉴스에서 비 온대요. 우리 잘 들어왔다 ㅎㅎ', 'News says rain. Good thing we’re inside!')]), 'smile'); S.comfort += 2; }],
    ['music', L('🎵 90년대 음악 듣기', '🎵 Listen to 90s music'), () => { try { NC.Audio.playPlaylist('euro'); } catch (e) { } S.music = 'euro'; nSay(L('이 비트 완전 그때 그 감성… 터보 같지 않아요? ㅋㅋ', 'This beat is so that era… doesn’t it sound like Turbo?'), 'laugh'); S.comfort += 2; if (!S.events.has('e05')) setTimeout(() => event('e05'), 6000); }],
    ['talk', L('🛋 소파에서 이야기하기', '🛋 Talk on the sofa'), () => { sitBoth('sofa'); talkTopic(); }],
    ['service', L('🍜 룸서비스 주문 🪙10', '🍜 Order room service 🪙10'), () => roomService('snack')],
    ['drink', L('🥤 음료 나눠 마시기(무알콜)', '🥤 Share drinks (non-alcoholic)'), () => { const n = S.n; P().group.userData.holdGlass = true; n.g.userData.holdGlass = true; try { NC.Motion.play(P().group, 'cheers'); NC.Motion.play(n.g, 'cheers'); } catch (e) { } nSay(L('냉장고에 탄산수랑 주스밖에 없네요 ㅎㅎ 짠!', 'Only soda and juice in the fridge, haha. Cheers!'), 'laugh'); S.comfort += 2; setTimeout(() => { P().group.userData.holdGlass = false; n.g.userData.holdGlass = false; }, 9000); }],
    ['window', L('🌃 창밖 보기', '🌃 Look out the window'), () => { standBoth(); const s = RV.spots.window; NC.walkPlayer([{ x: BX + s.x + .2, z: 90 + s.z + .3 }], () => { P().ry = -Math.PI / 2; P().group.rotation.y = P().ry; nSay(S.weather === 'rain' ? L('빗소리 좋다… 이런 날은 괜히 옛날 생각나요.', 'I love the sound of rain… makes me nostalgic.') : L('야경 진짜 예쁘다. 저 불빛 하나하나에 다 사람들이 있겠죠?', 'The city lights are beautiful. Each light is someone’s night.'), 'smile'); S.comfort += 3; }); }],
    ['light', L('💡 조명 바꾸기', '💡 Adjust lighting'), () => { const ks = ['bright', 'warm', 'neon', 'dim']; S.mood = ks[(ks.indexOf(S.mood) + 1) % 4]; applyMood(); sys(`${MOODS[S.mood][2]}`); if (S.mood === 'dim' && S.comfort < 55) nSay(L('조금 어두운 것 같은데… 따뜻하게 해 줄래요?', 'Isn’t it a bit dark…? Could we make it warmer?'), 'shy'); }],
    ['change', L('🔀 음악 바꾸기', '🔀 Change music'), () => { const nx = S.music === 'euro' ? 'blues' : 'euro'; try { NC.Audio.playPlaylist(nx); } catch (e) { } S.music = nx; sys(nx === 'blues' ? L('💕 발라드로', '💕 Ballads') : L('🕺 유로 댄스로', '🕺 Euro dance')); }],
    ['photo', L('📸 같이 사진 찍기', '📸 Take a photo together'), () => photo()],
    ['chat', L('😄 편하게 수다 떨기', '😄 Relax and chat'), () => talkTopic(true)],
    ['bed', L('🛏 침대에 나란히 앉기', '🛏 Sit together on the bed'), () => { if (S.comfort < 48) { nSay(L('저는 소파가 편할 것 같아요 ㅎㅎ', 'I think I’d be comfier on the sofa'), 'shy'); return sitBoth('sofa'); } sitBoth('bed'); nSay(L('침대 푹신하다~ ㅎㅎ', 'The bed is so soft~'), 'smile'); S.comfort += 1; }],
  ],
  romance: [
    ['hand', L('🤝 손잡기', '🤝 Hold hands'), () => romantic('hand', async () => { startHand(); })],
    ['hug', L('🤗 안아 주기', '🤗 Hug'), () => romantic('hug', async () => standAct('hug'))],
    ['cuddle', L('😌 기대어 앉기(커들)', '😌 Cuddle'), () => romantic('cuddle', async () => { sitBoth(S.seat || 'bed'); await wait(400); try { NC.Couple.sofa(S.n, 22); } catch (e) { } startHand(); })],
    ['close', L('💞 가까이 붙어 앉기', '💞 Sit close together'), () => romantic('close', async () => { sitBoth(S.seat || 'sofa'); try { NC.Couple.sofa(S.n, 12); } catch (e) { } })],
    ['forehead', L('🥰 이마 맞대기', '🥰 Forehead to forehead'), () => romantic('forehead', async () => standAct('forehead'))],
    ['cheek', L('😚 볼에 뽀뽀', '😚 Kiss on the cheek'), () => romantic('cheek', async () => standAct('cheek'))],
    ['kiss', L('💋 키스(동의 확인)', '💋 Kiss (asks consent)'), () => romantic('kiss', async () => standAct('kiss'))],
    ['words', L('💌 로맨틱한 말 건네기', '💌 Romantic words'), () => { const t = tr(S.n); meSay(pick([L('오늘 같이 있어서 진짜 좋아요.', 'I’m really glad to be with you tonight.'), L('웃을 때 정말 예뻐요.', 'You look wonderful when you smile.'), L('노래방에서 노래할 때 반했어요.', 'I fell for you when you sang.')])); setTimeout(() => nSay(t.bd > .6 ? L('…그런 말 하면 얼굴 빨개지잖아요 ㅎㅎ', '…you’re making me blush, haha') : L('저도요. 오늘 밤 오래 기억할 것 같아요 💗', 'Me too. I’ll remember tonight for a long time 💗'), 'shy'), 1400); S.comfort += 3; S.n.aff = Math.min(100, S.n.aff + 1); }],
    ['gift', L('🎁 작은 선물 주기', '🎁 Give a small gift'), () => { if (!NC.Wallet.spend(5)) return NC.ui.toast(L('🪙 코인이 모자라요', '🪙 Not enough coins')); standBoth(); setTimeout(() => { try { NC.Couple.handoff(S.n, 'rose', () => { nSay(L('장미…? 언제 준비했어요? 감동이다 ㅠㅠ', 'A rose…? When did you get this? I’m touched!'), 'laugh'); }); } catch (e) { nSay(L('선물이요? 고마워요!', 'A gift? Thank you!'), 'laugh'); } S.comfort += 5; S.n.aff = Math.min(100, S.n.aff + 3); memOf(S.n).gifts++; save(); }, 500); }],
    ['romusic', L('🎶 로맨틱한 음악 틀기', '🎶 Play romantic music'), () => { try { NC.Audio.playPlaylist('blues'); } catch (e) { } S.music = 'blues'; nSay(L('분위기 좋다…', 'Nice mood…'), 'shy'); S.comfort += 2; }],
    ['mood', L('🕯 분위기 만들기', '🕯 Set the mood'), () => { S.mood = 'neon'; applyMood(); try { NC.Audio.playPlaylist('blues'); } catch (e) { } S.music = 'blues'; nSay(S.comfort > 60 ? L('…분위기 진짜 좋다 💗', '…the mood is perfect 💗') : L('어… 조금 부끄럽다 ㅎㅎ', 'Oh… this is a bit embarrassing, haha'), 'shy'); S.comfort += S.comfort > 60 ? 3 : -1; }],
    ['private', L('🤫 속 깊은 이야기', '🤫 Private conversation'), () => { sitBoth(S.seat || 'sofa'); event('e07', true); }],
    ['jac', L('🛁 자쿠지에 발 담그기(스위트)', '🛁 Dip feet in the jacuzzi (suite)'), () => { if (!RV.water) return NC.ui.toast(L('자쿠지 스위트에만 있어요', 'Only in the Jacuzzi Suite')); romantic('jac', async () => { standBoth(); const s = RV.spots.jac; NC.walkPlayer([{ x: BX + s.x, z: 90 + s.z }], () => { nSay(L('물 따뜻하다~ 발만 담가도 피로가 풀려요 ㅎㅎ', 'The water’s warm~ just my feet and I feel so relaxed'), 'smile'); }); }); }],
  ],
  etc: [
    ['space', L('🙏 잠깐 거리 두기(각자 앉기)', '🙏 Ask for personal space'), () => { S.space = true; standBoth(); sitPlayerOnly('sofa'); placePartner(BX + RV.seats.bed[1].x, 90 + RV.seats.bed[1].z); NC.NPC.sit(S.n, BX + RV.seats.bed[1].x, 90 + RV.seats.bed[1].z, 0, .5); nSay(L('응, 편하게 있어요. 저도 잠깐 쉴게요.', 'Sure, make yourself comfortable. I’ll rest too.'), 'smile'); setTimeout(() => { S.space = false; }, 30000); }],
    ['extend', L('⏰ 연장하기(+1시간 🪙15)', '⏰ Extend (+1h 🪙15)'), () => extendStay()],
    ['upgrade', L('⬆ 방 업그레이드', '⬆ Upgrade room'), () => upgradeRoom()],
    ['sleep', L('🌙 잠자기(숙박: 아침으로)', '🌙 Sleep (overnight: to morning)'), () => sleepNight()],
    ['leave', L('🚪 체크아웃하고 나가기', '🚪 Check out and leave'), () => checkout()],
  ],
};
function sitPlayerOnly(where) { const a = RV.seats[where][0], p = P(); NC.sitPlayer({ kind: 'motel', where, x: BX + a.x, z: 90 + a.z, ry: a.ry }, { x: BX + a.x, z: 90 + a.z, ry: a.ry, h: a.h }); p.group.position.set(BX + a.x, 0, 90 + a.z); }
const TOPICS = [
  [L('어릴 때 꿈이 뭐였어요?', 'What was your childhood dream?'), { shy: L('사서요… 조용한 데서 책 읽는 게 좋았거든요.', 'A librarian… I loved reading somewhere quiet.'), cool: L('건축가요. 지금도 멋진 건물 보면 멈춰 서요.', 'An architect. I still stop to look at great buildings.'), playful: L('개그우먼! 진짜로요 ㅋㅋ', 'A comedian! Seriously, haha'), outgoing: L('가수요! 그래서 노래방만 가면 신나요 ㅎㅎ', 'A singer! That’s why I love karaoke!') }],
  [L('90년대 노래 중에 제일 좋아하는 거?', 'Favorite 90s song?'), { shy: L('발라드요. 비 오는 날 들으면 딱이에요.', 'Ballads. Perfect on rainy days.'), cool: L('R&B요. 그 시절 그루브가 좋아요.', 'R&B. I love that era’s groove.'), playful: L('신나는 댄스곡! 지금 틀어 줘요 ㅋㅋ', 'Dance tracks! Play one now!'), outgoing: L('다 좋아요! 떼창 되는 노래면 최고!', 'All of them! Sing-alongs are the best!') }],
  [L('주말엔 보통 뭐 해요?', 'What do you do on weekends?'), { shy: L('집에서 영화 보거나 강아지 산책해요.', 'Movies at home or walking my dog.'), cool: L('전시 보러 가요. 혼자 다니는 것도 좋아하고요.', 'Exhibitions. I like going alone too.'), playful: L('맛집 탐방이요! 떡볶이 지도 있어요 ㅋㅋ', 'Food hunting! I have a tteokbokki map, haha'), outgoing: L('친구들이랑 무조건 나가요. 집에 못 있어요 ㅎㅎ', 'Always out with friends. I can’t stay home!') }],
  [L('연애할 때 제일 중요한 게 뭐예요?', 'What matters most in a relationship?'), { shy: L('믿음이요. 천천히 쌓이는 거요.', 'Trust. The kind that builds slowly.'), cool: L('서로 존중하는 거. 선을 지켜 주는 거요.', 'Respect. Honoring each other’s boundaries.'), playful: L('웃음 코드! 같이 웃을 수 있어야죠 ㅋㅋ', 'A shared sense of humor!'), outgoing: L('표현이요! 좋으면 좋다고 말해 주는 거.', 'Expression! Saying it when you feel it.') }],
];
function talkTopic(light) {
  const n = S.n, likes = (n.persona && n.persona.likes) || []; let q, a;
  if (!light && likes.length && !S.events.has('e03')) { S.events.add('e03'); const lk = likes[U.hash(n.name + S.clockMin) % likes.length]; q = L(`${lk.topic} 좋아해요?`, `Do you like ${lk.topic}?`); a = L(`헐 완전요!! 저 ${lk.topic} 얘기 나오면 밤새 할 수 있어요 ㅎㅎ 우리 통하는 거 많다!`, `Totally!! I could talk about ${lk.topic} all night. We have so much in common!`); S.comfort += 5; }
  else { const T2 = TOPICS[(S.topicI = ((S.topicI ?? -1) + 1)) % TOPICS.length]; q = T2[0]; a = T2[1][n.trait] || T2[1].outgoing; S.comfort += 3; }
  meSay(q); setTimeout(() => { nSay(a, 'smile'); try { NC.Motion.play(n.g, light ? 'laugh' : 'nod'); } catch (e) { } }, 1300);
}
async function roomService(kind) {
  const price = kind === 'breakfast' ? 12 : 10; if (!NC.Wallet.spend(price)) return NC.ui.toast(L('🪙 코인이 모자라요', '🪙 Not enough coins'));
  sys(L(`📞 프런트에 ${kind === 'breakfast' ? '아침 식사' : '라면·과일·음료 세트'}를 주문했어요`, `📞 Ordered ${kind === 'breakfast' ? 'breakfast' : 'snacks'} from the front desk`)); await wait(6000); event('e04', true, kind);
}
async function deliver(kind) {
  const g = ensureRoomSvc(), d = RV.spots.door; knock(); nSay(L('누구 왔나 봐요! 룸서비스인가?', 'Someone’s at the door! Room service?'), 'surprised'); await wait(1200);
  g.visible = true; g.position.set(BX + d.x, 0, 90 + d.z + .3); g.rotation.y = Math.PI; g.userData.moving = true; const t0 = performance.now(), tgt = RV.spots.table;
  await new Promise(res => { const step = () => { const k = Math.min(1, (performance.now() - t0) / 2400); g.position.x = BX + d.x + (tgt.x + .6 - d.x) * k; g.position.z = 90 + d.z + .3 + (tgt.z - d.z - .3) * k; if (k < 1) requestAnimationFrame(step); else res(); }; step(); });
  g.userData.moving = false; say(g, kind === 'breakfast' ? L('아침 식사 왔습니다~ 맛있게 드세요!', 'Breakfast is served~ enjoy!') : L('주문하신 거 나왔습니다~', 'Here’s your order~')); try { NC.Motion.play(g, 'bow'); } catch (e) { }
  const tray = new T.Group(); tray.add(new T.Mesh(box(.5, .03, .35), std('#c8ccd4', { metalness: .9, roughness: .2 }))); const bowl = new T.Mesh(cyl(.09, .06, .07, 14), std('#e8e0d0')); bowl.position.set(-.12, .05, 0); tray.add(bowl); const cup = new T.Mesh(cyl(.035, .03, .1, 10), std(kind === 'breakfast' ? '#6a3a1a' : '#ff8a3a')); cup.position.set(.14, .06, .05); tray.add(cup);
  tray.position.set(BX + tgt.x, .47, 90 + tgt.z); RV.G.add(tray);
  await wait(1800); const t1 = performance.now(); g.userData.moving = true; g.rotation.y = 0;
  await new Promise(res => { const sx = g.position.x, sz = g.position.z, step = () => { const k = Math.min(1, (performance.now() - t1) / 2200); g.position.x = sx + (BX + d.x - sx) * k; g.position.z = sz + (90 + d.z + .3 - sz) * k; if (k < 1) requestAnimationFrame(step); else res(); }; step(); });
  g.visible = false; g.userData.moving = false; nSay(kind === 'breakfast' ? L('아침부터 이렇게 먹으니까 여행 온 것 같아요 ㅎㅎ', 'Breakfast like this feels like a trip!') : L('모텔 라면은 왜 이렇게 맛있을까요 ㅋㅋ', 'Why is motel ramen always so good? Haha'), 'laugh'); S.comfort += 3;
}
function photo() {
  const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:9998;opacity:.95;transition:opacity .6s;pointer-events:none'; document.body.appendChild(f); requestAnimationFrame(() => { f.style.opacity = 0; setTimeout(() => f.remove(), 700); }); beep(2000, .05, 'square', .05);
  S.photos++; const pf = new T.Group(); pf.add(new T.Mesh(box(.12, .005, .15), std('#f8f8f4'))); const ph = new T.Mesh(box(.1, .006, .1), std(['#ff7ab8', '#3de6ff', '#ffd23d'][S.photos % 3], { emissive: '#331122' })); ph.position.z = -.015; pf.add(ph); pf.position.set(BX + RV.spots.table.x + (S.photos * .07 - .2), .46, 90 + RV.spots.table.z - .2); pf.rotation.y = S.photos * .4; RV.G.add(pf);
  nSay(pick([L('잠깐! 다시 찍어요, 눈 감았어요 ㅋㅋ', 'Wait! Again, I blinked, haha'), L('폴라로이드 감성 최고… 이거 제가 가질래요!', 'Polaroid vibes… I’m keeping this one!'), L('우리 잘 나왔다 ㅎㅎ', 'We look good!')]), 'laugh'); S.comfort += 2;
}

/* ═════════════ 11. 이벤트(24종) ═════════════ */
const EVENTS = {
  e01: { ok: () => S.comfort > 72 && S.n.aff > 80, run: () => { S.mood = 'neon'; applyMood(); nSay(L('오늘 밤… 정말 영화 같아요. 이 순간 오래 기억하고 싶어요 💗', 'Tonight… feels like a movie. I want to remember this 💗'), 'shy'); S.comfort += 3; } },
  e03: { ok: () => true, run: () => talkTopic() },
  e04: { ok: () => false, run: (kind) => deliver(kind || 'snack') },
  e05: { ok: () => S.music === 'euro', run: () => { nSay(L('이 노래 나올 때 고등학교 축제 생각나요… 그때 다들 이 춤 췄는데 ㅋㅋ (같이 따라 춤춘다)', 'This song reminds me of a school festival… everyone did this dance! (dances along)'), 'laugh'); try { NC.Motion.play(S.n.g, 'cheer'); } catch (e) { } S.comfort += 3; } },
  e06: { ok: () => S.n.aff > 78 && !memOf(S.n).gaveGift, run: () => { memOf(S.n).gaveGift = true; save(); nSay(L('사실… 이거 아까 노래방에서 몰래 챙긴 거예요. 탬버린 스티커 ㅋㅋ 기념으로 줄게요!', 'Actually… I snuck this from the karaoke room. A tambourine sticker, haha. A keepsake!'), 'laugh'); sys(L('🎁 선물을 받았어요 — 호감도 +2', '🎁 You got a gift — affinity +2')); S.n.aff = Math.min(100, S.n.aff + 2); } },
  e07: { ok: () => S.comfort > 55, run: () => { const sec = S.n.persona && S.n.persona.secrets && S.n.persona.secrets[0]; nSay(sec ? L(`사실요… ${sec.text}. 이런 얘기 잘 안 하는데, 오늘은 하고 싶었어요.`, `Actually… ${sec.text}. I don’t usually share this, but tonight I wanted to.`) : L('요즘 좀 외로웠는데… 오늘 덕분에 많이 웃었어요. 고마워요.', 'I’ve been lonely lately… you made me laugh a lot tonight. Thank you.'), 'sad'); S.comfort += 4; memOf(S.n).trust += 4; save(); } },
  e08: { ok: () => S.comfort < 45, run: () => awkward(false) },
  e09: { ok: () => S.comfort < 35 || attrs(S.n).energy < 25, run: () => lateDeparture() },
  e10: { ok: () => S.stay === 'rent' && S.endMin - S.clockMin < 25 && S.comfort > 55, run: () => { nSay(L('벌써 시간 다 됐어요? 아쉽다… 연장할까요?', 'Time’s almost up already? Shame… extend?'), 'shy'); setTimeout(extendStay, 1200); } },
  e13: { ok: () => S.endMin - S.clockMin < 12, run: () => { beep(880, .3, 'triangle', .06); setTimeout(() => beep(880, .3, 'triangle', .06), 500); sys(L('☎ 프런트: "손님~ 10분 남았어요. 연장하실 거예요?"', '☎ Front desk: “10 minutes left. Extending?”')); } },
  e14: { ok: () => true, run: () => { const L2 = W.lights || {}, l = L2.bar, i0 = l && l.intensity; sys(L('⚡ 순간 정전! 90년대 모텔답게 전기가 깜빡여요', '⚡ Power flicker! Classic 90s motel')); if (l) { l.intensity = .05; setTimeout(() => { l.intensity = i0; }, 900); setTimeout(() => { l.intensity = .1; }, 1200); setTimeout(() => applyMood(), 1700); } nSay(L('꺅! 깜짝이야 ㅋㅋㅋ 손 좀 잡아 줘요!', 'Eek! That scared me, haha. Hold my hand!'), 'surprised'); if (S.comfort > 50) startHand(); } },
  e15: { ok: () => S.weather !== 'rain', run: () => { S.weather = 'rain'; sys(L('🌧 창밖에 비가 내리기 시작했어요', '🌧 It started raining outside')); nSay(L('비 온다… 우산 없는데 잘됐다, 더 있다 가요 ㅎㅎ', 'It’s raining… no umbrella, guess we stay longer, haha'), 'smile'); } },
  e16: { ok: () => S.tvOn, run: () => { tvShow.ch = 0; nSay(L('어 이 노래!! (TV 따라 흥얼흥얼) 같이 불러요 ㅋㅋ', 'Oh, this song!! (hums along) Sing with me!'), 'laugh'); try { NC.Motion.play(S.n.g, 'clap'); } catch (e) { } S.comfort += 2; } },
  e17: { ok: () => true, run: () => { sys(L('🔊 옆방에서 TV 소리가 크게 들려요… 노래 자랑 프로그램인 듯', '🔊 The TV next door is loud… a singing contest show'), ); nSay(L('ㅋㅋㅋ 옆방도 노래방 갔다 왔나 봐요. 벽 진짜 얇다~', 'Haha, next door must’ve been to karaoke too. Thin walls~'), 'laugh'); } },
  e18: { ok: () => !!RV.water, run: () => { nSay(L('자쿠지 버블 켜 볼까요? 색이 바뀐다! 보라색 예쁘다~', 'Turn on the jacuzzi bubbles? It changes color! Purple’s pretty~'), 'smile'); if (RV.water) RV.water.material.emissive.copy(col('#5a2a9a')); } },
  e19: { ok: () => S.photos > 0, run: () => { nSay(L('아까 찍은 사진 벽에 붙여 놓을까요? 우리 흔적 ㅋㅋ', 'Shall we stick the photo on the wall? Our little mark!'), 'laugh'); } },
  e20: { ok: () => tr(S.n).pl > .6, run: () => { nSay(L('베개 싸움 할래요?! 받아랏! ㅋㅋㅋ', 'Pillow fight?! Take this! Haha'), 'laugh'); try { NC.Motion.play(S.n.g, 'push'); NC.Motion.play(P().group, 'flinch'); } catch (e) { } S.comfort += 3; } },
  e21: { ok: () => true, run: async () => { const { val } = await modal(`<h3>💘 ${L('밸런스 게임', 'Balance game')}</h3><p>${esc(S.n.name)}: ${L('"평생 여름 vs 평생 겨울?"', '“Endless summer vs endless winter?”')}</p>`, [[L('☀ 여름', '☀ Summer'), 's', true], [L('❄ 겨울', '❄ Winter'), 'w']]); const same = (U.hash(S.n.name) & 1) === (val === 's' ? 1 : 0); nSay(same ? L('헐 저도요!! 우리 진짜 잘 맞는다 ㅎㅎ', 'Me too!! We really match!') : L('에이~ 겨울엔 붕어빵이 있잖아요 ㅋㅋ', 'Aw~ winter has fish-shaped pastries though!'), 'laugh'); S.comfort += same ? 4 : 2; } },
  e22: { ok: () => S.seat && S.comfort > 62 && attrs(S.n).energy < 70, run: () => { nSay(L('(하품) …잠깐만 어깨 좀 빌려도 돼요?', '(yawns) …can I borrow your shoulder for a bit?'), 'shy'); try { NC.Couple.sofa(S.n, 16); } catch (e) { } } },
  e23: { ok: () => true, run: () => { nSay(L('창밖에 별 보여요? 서울에서 별 보기 힘든데… 오늘은 운이 좋네요.', 'See the stars outside? Rare in the city… lucky tonight.'), 'smile'); S.comfort += 2; } },
  e24: { ok: () => true, run: () => { nSay(L('우리 처음 말 건 거 기억나요? 그때 진짜 떨렸는데 ㅋㅋ', 'Remember when we first talked? I was so nervous, haha'), 'laugh'); S.comfort += 3; } },
};
function event(id, force, arg) { const e = EVENTS[id]; if (!e || (!force && S.events.has(id))) return; S.events.add(id); try { e.run(arg); } catch (err) { console.warn('[motel ev]', id, err); } }
function eventTick() {
  if (S.step !== 'room' || S.busy || document.querySelector('.modal') || (K.BL && K.BL.busy)) return;
  const ids = Object.keys(EVENTS).filter(k => !S.events.has(k) && EVENTS[k].ok());
  // 우선순위: 불편 → 떠남 → 시간 경고 → 나머지(정해진 순서 없이 상황에 맞는 것)
  const pr = ['e09', 'e08', 'e13', 'e10'].find(k => ids.includes(k)); const id = pr || ids[U.hash(S.n.name + S.clockMin) % Math.max(1, ids.length)]; if (id) event(id);
}
async function awkward(pressured) {
  S.events.add('e08'); nSay(pressured ? L('…잠깐만요. 지금 좀 부담스러워요.', '…Wait. This feels like a lot right now.') : L('(창밖을 보며) …음, 갑자기 조금 어색하다 ㅎㅎ', '(looks out the window) …um, suddenly a bit awkward, haha'), 'sad');
  standBoth(); stopHand(); await wait(1000);
  const { val } = await modal(`<h3>😶 ${L('어색한 순간', 'Awkward moment')}</h3><p>${L('상대가 조금 불편해 보여요. 어떻게 할까요?', 'Your partner seems uncomfortable. What now?')}</p>`, [[L('🙏 미안해요, 천천히 해요(사과하고 쉬기)', '🙏 Sorry — let’s slow down'), 'sorry', true], [L('📺 TV 보면서 분위기 바꾸기', '📺 Change the mood with TV'), 'tv'], [L('🛋 각자 편하게 앉기(거리 두기)', '🛋 Sit separately'), 'space'], [L('🚪 오늘은 여기까지 — 나가기', '🚪 Call it a night — leave'), 'leave']]);
  if (val === 'sorry') { meSay(L('미안해요. 불편하게 할 생각 없었어요. 천천히 해요.', 'I’m sorry. I didn’t mean to make you uncomfortable.')); nSay(L('…말해 줘서 고마워요. 그냥 얘기해요 ㅎㅎ', '…thanks for saying that. Let’s just talk.'), 'smile'); S.comfort += 8; S.pressure = 0; }
  else if (val === 'tv') { ACTS.general[0][2](); S.comfort += 4; }
  else if (val === 'space') { ACTS.etc[0][2](); S.comfort += 5; }
  else checkout(true);
}
async function lateDeparture() {
  S.events.add('e09'); nSay(attrs(S.n).energy < 25 ? L('저 너무 졸려서… 오늘은 먼저 들어가 볼게요. 즐거웠어요!', 'I’m so sleepy… I’ll head home first tonight. I had fun!') : L('저… 오늘은 먼저 가 볼게요. 미안해요.', 'I… think I’ll head out first tonight. Sorry.'), 'sad');
  standBoth(); await wait(900);
  const { val } = await modal(`<h3>🌙 ${L('늦은 밤의 이별', 'Late-night departure')}</h3><p>${L(`${esc(S.n.name)}님이 먼저 돌아가려고 해요.`, `${esc(S.n.name)} wants to leave first.`)}</p>`, [[L('🚕 택시 잡아 줄게요(같이 나가기)', '🚕 I’ll get you a taxi (leave together)'), 'together', true], [L('👋 조심히 가요(혼자 남기)', '👋 Get home safe (stay)'), 'alone']]);
  if (val === 'together') return checkout(true);
  nSay(L('응, 오늘 고마웠어요. 연락해요 💗', 'Thanks for tonight. Text me 💗'), 'smile'); const n = S.n, d = RV.spots.door; S.follow = false; n.state = 'escort'; n.g.userData.moving = true; const t0 = performance.now(), sx = n.x, sz = n.z;
  const step = () => { const k = Math.min(1, (performance.now() - t0) / 2200); n.x = sx + (BX + d.x - sx) * k; n.z = sz + (90 + d.z - sz) * k; n.g.rotation.y = Math.atan2(BX + d.x - sx, 90 + d.z - sz); if (k < 1) requestAnimationFrame(step); else { n.g.visible = false; n.g.userData.moving = false; S.alone = true; sys(L('🚪 상대가 먼저 돌아갔어요 — 언제든 체크아웃할 수 있어요', '🚪 Your partner left — check out anytime')); } }; step();
}
async function extendStay() {
  if (S.stay !== 'rent') return NC.ui.toast(L('숙박은 아침까지예요', 'Overnight lasts till morning'));
  const { val } = await modal(`<h3>⏰ ${L('연장', 'Extend')}</h3><p>${L('남은 시간', 'Time left')} ${Math.max(0, Math.round(S.endMin - S.clockMin))}${L('분', ' min')}</p>`, [[`+1${L('시간', 'h')} 🪙15`, 1, true], [`${L('숙박으로 변경', 'Switch to overnight')} 🪙${Math.round((catOf(S.cat).night - catOf(S.cat).rent) * S.hotel.k)}`, 'night'], [L('괜찮아요', 'No thanks'), null]]);
  if (val === 1) { if (!NC.Wallet.spend(15)) return NC.ui.toast(L('🪙 코인이 모자라요', '🪙 Not enough coins')); S.endMin += 60; S.events.delete('e13'); sys(L('⏰ 1시간 연장했어요', '⏰ Extended 1 hour')); nSay(L('ㅎㅎ 더 있을 수 있다~', 'Hehe, more time~'), 'laugh'); }
  if (val === 'night') { const d = Math.round((catOf(S.cat).night - catOf(S.cat).rent) * S.hotel.k); if (!NC.Wallet.spend(d)) return NC.ui.toast(L('🪙 코인이 모자라요', '🪙 Not enough coins')); S.stay = 'night'; S.endMin = 600; S.events.delete('e13'); sys(L('🌙 숙박으로 바꿨어요 — 아침까지', '🌙 Switched to overnight')); event('e10', true); }
  updBar();
}
async function upgradeRoom() {
  const i = CATS.findIndex(c => c.id === S.cat); if (i >= 4) return NC.ui.toast(L('이미 최고급 방이에요', 'Already the best room'));
  const up = CATS[i + 1], d = Math.round(((S.stay === 'rent' ? up.rent - CATS[i].rent : up.night - CATS[i].night)) * S.hotel.k * (DB.me.vip ? .8 : 1));
  const { val } = await modal(`<h3>⬆ ${up.name}</h3><p>${up.desc} · ${L('차액', 'difference')} 🪙${d}</p>`, [[L('업그레이드', 'Upgrade'), 'y', true], [L('취소', 'Cancel'), null]]);
  if (!val) return; if (!NC.Wallet.spend(d)) return NC.ui.toast(L('🪙 코인이 모자라요', '🪙 Not enough coins'));
  S.cat = up.id; S.paid += d; standBoth(); NC.ui.fade(() => { buildRoom(S.cat); const e = ROOM.entry, p = P(); p.x = BX + e.x; p.z = 90 + e.z; p.group.position.set(p.x, 0, p.z); placePartner(p.x - .7, p.z, Math.PI); applyMood(); });
  setTimeout(() => nSay(roomLine(), 'laugh'), 800);
}
async function sleepNight() {
  if (S.stay !== 'night') return NC.ui.toast(L('숙박일 때만 아침까지 잘 수 있어요 (⏰ 연장에서 숙박으로 바꾸기)', 'Only for overnight stays (switch via ⏰ Extend)'));
  const r = consent('sleep'); let apart = r === 'no' || r === 'notyet' || r === 'pressure';
  nSay(apart ? L('저는 소파에서 잘게요. 침대 편하게 써요 ㅎㅎ', 'I’ll sleep on the sofa. You take the bed.') : L('응… 오늘 정말 고마웠어요. 잘 자요 🌙', 'Mm… thank you for tonight. Good night 🌙'), 'shy');
  await wait(1400); standBoth(); stopHand(); S.busy = true;
  const f = document.createElement('div'); f.className = 'motelNight'; f.innerHTML = `<div>${L('…밤이 깊어 간다', '…the night deepens')}</div><small>${apart ? L('각자 편하게 잠들었다', 'they slept separately, comfortably') : L('나란히 누워 이야기하다 잠들었다', 'they talked side by side until they fell asleep')}</small>`; document.body.appendChild(f);
  requestAnimationFrame(() => f.classList.add('on')); await wait(3200);
  S.step = 'morning'; S.mood = 'morning'; applyMood(); S.clockMin = S.endMin - 60; drawWindow(0);
  sitBoth(apart ? 'sofa' : 'bed'); if (apart) { S.space = true; } f.classList.remove('on'); setTimeout(() => f.remove(), 900); S.busy = false; S.step = 'room';
  await wait(900); event('e11', true);
}
EVENTS.e11 = { ok: () => false, run: async () => { nSay(pick([L('잘 잤어요? 머리 엄청 뻗쳤다 ㅋㅋㅋ', 'Sleep well? Your hair’s sticking out, haha'), L('…좋은 아침이에요. 햇빛 들어오니까 기분 좋다.', '…Good morning. The sunlight feels nice.')]), 'smile');
  const { val } = await modal(`<h3>☀ ${L('아침', 'Morning after')}</h3>`, [[L('🍳 아침 식사 주문 🪙12', '🍳 Order breakfast 🪙12'), 'bf', true], [L('☕ 그냥 얘기 좀 하다 나가기', '☕ Chat a bit, then leave'), 'chat'], [L('🚪 바로 체크아웃', '🚪 Check out now'), 'out']]);
  if (val === 'bf') roomService('breakfast'); else if (val === 'chat') talkTopic(true); else checkout(); } };

/* ═════════════ 12. 체크아웃 · 돌아가기 ═════════════ */
async function checkout(quick) {
  if (S.step === 'leaving') return; try { S.onCheckout && S.onCheckout(); } catch (e) { console.warn(e); } S.step = 'leaving'; S.busy = true; standBoth(); stopHand(); endStanding(); bar.style.display = 'none'; panel.style.display = 'none';
  const used = S.clockMin, early = S.stay === 'rent' && used < 20 && S.paid > 0, refund = early ? Math.floor(S.paid * .5) : 0;
  if (!quick && !S.alone) nSay(pick([L('벌써 가요? 시간 진짜 빨리 갔다…', 'Leaving already? Time flew…'), L('오늘 정말 즐거웠어요 💗', 'Tonight was really fun 💗')]), 'smile');
  await wait(900);
  goArea(LOB, { x: -.6, z: -2.4, ry: Math.PI }, async () => { ensureClerk(); ding();
    say(LOBV.clerk, L('열쇠 받았어요~ 또 오세요!', 'Got the key~ come again!'));
    if (refund) NC.Wallet.add(refund, L('조기 퇴실 50% 환불', 'early checkout 50% refund'));
    sys(L(`🧾 체크아웃 · ${S.hotel.name} ${S.roomNo}호 · 이용 ${Math.round(used)}분${refund ? ` · 환불 🪙${refund}` : ''}`, `🧾 Checked out · ${S.hotel.name} room ${S.roomNo} · ${Math.round(used)} min${refund ? ` · refund 🪙${refund}` : ''}`));
    if (S.n && !S.alone) { const m = memOf(S.n); m.trust = Math.min(100, m.trust + Math.round((S.comfort - 50) / 5)); S.n.aff = U.clamp(S.n.aff + (S.comfort > 60 ? 3 : S.comfort < 40 ? -3 : 0), 0, 100); save(); }
    await wait(1200);
    const opts = S.alone ? [[L('🌃 나이트로 돌아가기', '🌃 Back to the nightclub'), 'club', true]] : [[L('🌃 둘이 나이트로 돌아가기', '🌃 Back to the club together'), 'club', true], [L('🎤 노래방으로 다시 가기', '🎤 Back to karaoke'), 'kara'], [L('🏠 각자 집으로(택시 태워 보내기)', '🏠 Head home separately'), 'home']];
    const { val } = await modal(`<h3>🌙 ${L('어디로 갈까요?', 'Where to next?')}</h3>`, opts);
    checkoutReturn(null, val || 'club');
  });
}
function checkoutReturn(msg, where = 'club') {
  if (msg) sys(msg); const n = S.n; S.busy = true; S.follow = false; stopHand();
  const finish = () => { if (n) { try { n.motel = false; n.booked = false; n.state = 'wander'; NC.NPC.release(n); } catch (e) { } } Object.assign(S, { on: false, n: null, area: null, step: '', busy: false, alone: false, space: false, act: null, hand: null }); P().busy = false; bar.style.display = 'none'; };
  partnerVisible(null);
  if (where === 'kara' && n) { RM.go(null, { x: -6, z: W.corridorY || 10.75, ry: 0 }, () => { finish(); setTimeout(() => { try { K.enter({ mode: 'karaoke', label: L('노래방', 'Karaoke'), comp: n }); } catch (e) { } }, 500); }); return; }
  RM.go(null, { x: -6, z: W.corridorY || 10.75, ry: 0 }, () => { finish();
    if (n && where === 'club') { NC.NPC.show(n, true); n.x = -5.2; n.z = (W.corridorY || 10.75) + .6; n.g.position.set(n.x, 0, n.z); n.pause = 20; NC.ui.chatAdd(n.name, L('다시 나이트다~ 한 잔 더 할래요? ㅎㅎ', 'Back at the club~ one more drink?')); }
    if (n && where === 'home') { NC.NPC.show(n, false); setTimeout(() => NC.NPC.show(n, true), 180e3); sys(L(`🚕 ${n.name}님을 택시 태워 보냈어요`, `🚕 Put ${n.name} in a taxi home`)); }
  });
}

/* ═════════════ 13. UI — 객실 하단 바 · 활동 패널 ═════════════ */
const css = document.createElement('style'); css.textContent = `
#kMotel{background:linear-gradient(135deg,#ff3d7a,#b0207a)!important;color:#fff!important}
#motelBar{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);display:none;gap:8px;align-items:center;z-index:60;background:rgba(18,8,28,.82);border:1px solid rgba(255,120,190,.35);border-radius:16px;padding:7px 10px;backdrop-filter:blur(8px);font:600 13px sans-serif;color:#fff}
#motelBar button{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:11px;padding:7px 11px;font:600 13px sans-serif;cursor:pointer}
#motelBar button.pri{background:linear-gradient(135deg,#ff3d9a,#8a2be2);border:none}
#motelBar .mclk{font:700 13px monospace;color:#ffd23d;min-width:92px;text-align:center}
#motelPanel{position:fixed;left:50%;bottom:calc(70px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(560px,94vw);max-height:56vh;overflow:auto;display:none;flex-direction:column;gap:8px;z-index:61;background:rgba(18,8,28,.94);border:1px solid rgba(255,120,190,.4);border-radius:16px;padding:12px;color:#fff;font:600 13px sans-serif}
#motelPanel h4{margin:4px 0 2px;color:#ff9ad0;font-size:13px}
#motelPanel .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#motelPanel .g button{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:8px;text-align:left;font:600 12.5px sans-serif;cursor:pointer}
#motelPanel .g button:hover{background:rgba(255,95,168,.25)}
#motelPanel .cm{height:6px;border-radius:4px;background:#ffffff18;overflow:hidden}#motelPanel .cm i{display:block;height:100%;background:linear-gradient(90deg,#3de6ff,#ff5fa8)}
#motelRide{position:fixed;inset:0;z-index:9990;overflow:hidden;background:#05030c;opacity:0;transition:opacity .5s;font-family:sans-serif}#motelRide.on{opacity:1}
#motelRide .mrSky{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 120%,#3a1448,#05030c 70%)}
#motelRide .mrCity{position:absolute;left:0;right:0;bottom:30%;height:38%;background:repeating-linear-gradient(90deg,#0b0812 0 46px,#120c1c 46px 70px,#0b0812 70px 120px);animation:mrPan 6s linear infinite;box-shadow:inset 0 0 80px #ff3d9a55}
#motelRide .mrCity::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,#ffcf8a 1.4px,transparent 2px) 0 0/22px 26px;opacity:.55}
#motelRide .mrRoad{position:absolute;left:0;right:0;bottom:0;height:30%;background:#121218;border-top:3px solid #2a2a34}
#motelRide .mrRoad::after{content:'';position:absolute;left:0;right:0;top:45%;height:6px;background:repeating-linear-gradient(90deg,#e8e0c0 0 60px,transparent 60px 120px);animation:mrPan .6s linear infinite}
#motelRide .mrCar{position:absolute;bottom:17%;left:50%;transform:translateX(-50%) scaleX(-1);font-size:84px;animation:mrBob .4s ease-in-out infinite alternate;filter:drop-shadow(0 0 18px #ffd23d88)}
#motelRide .mrCar.walk{font-size:64px;transform:translateX(-50%)}
#motelRide .mrRain{position:absolute;inset:0;background:repeating-linear-gradient(105deg,transparent 0 9px,rgba(170,190,230,.25) 9px 10px);animation:mrRain .35s linear infinite}
#motelRide .mrTxt{position:absolute;left:0;right:0;top:16%;text-align:center;color:#fff;font:800 22px sans-serif;text-shadow:0 0 18px #ff3d9a}#motelRide .mrTxt small{display:block;font:600 14px sans-serif;opacity:.8;margin-top:6px}
@keyframes mrPan{to{background-position:-240px 0}}@keyframes mrBob{to{margin-bottom:5px}}@keyframes mrRain{to{background-position:-20px 60px}}
.motelNight{position:fixed;inset:0;z-index:9991;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .9s;font:700 22px sans-serif}.motelNight.on{opacity:1}.motelNight small{opacity:.7;font-size:14px;margin-top:8px}
`; document.head.appendChild(css);
const bar = document.createElement('div'); bar.id = 'motelBar'; bar.innerHTML = `<span class="mclk" id="mClk">--:--</span><button class="pri" id="mActs">${L('🧭 할 일', '🧭 Activities')}</button><button id="mStop">${L('⏹ 그만', '⏹ Stop')}</button><button id="mOut">${L('🚪 체크아웃', '🚪 Check out')}</button>`; document.body.appendChild(bar);
const panel = document.createElement('div'); panel.id = 'motelPanel'; document.body.appendChild(panel);
function renderPanel() {
  const n = S.n, a = n ? attrs(n) : {}; const sec = (title, list) => `<h4>${title}</h4><div class="g">${list.map(([id, t]) => `<button data-a="${id}">${t}</button>`).join('')}</div>`;
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b>🏨 ${S.hotel ? S.hotel.name : ''} ${S.roomNo}${L('호', '')} · ${catOf(S.cat).name}</b><button data-a="_close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer">✕</button></div>
    ${n && !S.alone ? `<div style="font-size:12px;opacity:.85">${esc(n.name)} · ${L('편안함', 'Comfort')} ${Math.round(S.comfort)} · ${L('호감', 'Attraction')} ${a.attraction} · ${L('신뢰', 'Trust')} ${a.trust}</div><div class="cm"><i style="width:${U.clamp(S.comfort, 0, 100)}%"></i></div>` : `<div style="font-size:12px;opacity:.8">${L('혼자 남았어요', 'You’re alone now')}</div>`}
    ${S.alone ? '' : sec(L('일반 활동', 'General'), ACTS.general) + sec(L('💗 로맨틱(매번 동의 확인)', '💗 Romantic (consent each time)'), ACTS.romance)}${!S.alone && S.extPanel ? S.extPanel() : ''}${sec(L('기타', 'Other'), S.alone ? ACTS.etc.filter(x => x[0] === 'leave') : ACTS.etc)}`;
}
panel.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.dataset.a; if (id === '_close') { panel.style.display = 'none'; return; }
  if (S.extClick && S.extClick(id, b)) return;
  const all = [...ACTS.general, ...ACTS.romance, ...ACTS.etc, ...(S.extActs || [])], it = all.find(x => x[0] === id); if (!it || S.busy) return; panel.style.display = 'none'; stopCurrent(true); try { it[2](); } catch (err) { console.error('[motel act]', err); } });
$('#mActs').onclick = () => { if (panel.style.display === 'flex') { panel.style.display = 'none'; return; } renderPanel(); panel.style.display = 'flex'; };
$('#mStop').onclick = () => stopCurrent();
$('#mOut').onclick = () => checkout();
function stopCurrent(silent) { const had = S.hand || (K.BL && K.BL.n === S.n) || (NC.Couple && NC.Couple.ST.sofa); stopHand(); endStanding(); try { NC.Couple && (NC.Couple.ST.sofa = null); } catch (e) { } S.act = null; let had2 = false; try { had2 = !!(S.onStop && S.onStop(silent)); } catch (e) { } if (!silent && (had || had2) && S.n && !S.alone) nSay(pick([L('응 ㅎㅎ', 'Okay, haha'), L('잠깐 쉬어요~', 'Let’s take a break~')]), 'smile'); }
function updBar() { const el = $('#mClk'); if (!el || !S.on) return; const base = S.checkIn || (S.checkIn = new Date()), t = new Date(base.getTime() + S.clockMin * 60e3), left = Math.max(0, Math.round(S.endMin - S.clockMin)); el.textContent = `${t.toTimeString().slice(0, 5)} · ${S.stay === 'rent' ? `${left}${L('분', 'm')}` : L('숙박', 'night')}`; }

/* ═════════════ 14. E 상호작용 ═════════════ */
NC.interactProviders && NC.interactProviders.push(() => {
  const p = P(), out = []; if (!S.on || !p.group || S.busy) return out; const d = (x, z) => Math.hypot(p.x - x, p.z - z);
  if (S.area === EXT && S.step === 'ext') { const dd = d(BX + EXT.door.x, EXT.door.z); if (dd < 2.2) out.push({ label: L('🚪 모텔 들어가기 (E)', '🚪 Enter the motel (E)'), dist: dd, run: enterLobby }); }
  if (S.area === LOB) { const dd = d(BX + LOB.desk.x, 30 + LOB.desk.z); if (S.step === 'lobby' && dd < 1.8) out.push({ label: L('🛎 체크인 (E)', '🛎 Check in (E)'), dist: dd, run: checkIn });
    const de = d(BX + LOB.elev.x, 30 + LOB.elev.z); if (S.step === 'elev' && de < 1.8) out.push({ label: L('🛗 엘리베이터 타기 (E)', '🛗 Take the elevator (E)'), dist: de, run: rideElevator }); }
  if (S.area === COR && S.step === 'corr') { const dr = CORV.doors.find(x => x.no === S.roomNo); if (dr) { const dd = d(BX + dr.x, 60 + dr.z); if (dd < 1.5) out.push({ label: L(`🔑 ${S.roomNo}호 들어가기 (E)`, `🔑 Enter room ${S.roomNo} (E)`), dist: dd, run: enterRoom }); } }
  if (S.area === ROOM && S.step === 'room') { const s = RV.spots;
    const dd = d(BX + s.door.x, 90 + s.door.z); if (dd < 1.3) out.push({ label: L('🚪 체크아웃하고 나가기 (E)', '🚪 Check out (E)'), dist: dd, run: () => checkout() });
    const db = d(BX + RV.seats.bed[0].x, 90 + RV.seats.bed[0].z); if (db < 1.4 && !p.seat) out.push({ label: L('🛏 침대에 앉기 (E)', '🛏 Sit on the bed (E)'), dist: db, run: () => ACTS.general[10][2]() });
    const ds = d(BX + RV.seats.sofa[0].x, 90 + RV.seats.sofa[0].z); if (ds < 1.4 && !p.seat) out.push({ label: L('🛋 소파에 앉기 (E)', '🛋 Sit on the sofa (E)'), dist: ds, run: () => sitBoth('sofa') });
    const dw = d(BX + s.window.x, 90 + s.window.z); if (dw < 1.4) out.push({ label: L('🌃 창밖 보기 (E)', '🌃 Look outside (E)'), dist: dw, run: () => ACTS.general[5][2]() }); }
  return out;
});

/* ═════════════ 15. 매 프레임 ═════════════ */
let tvAcc = 0, evAcc = 0;
NC.tickers.push(dt => {
  if (!dt) return; const dtF = Math.min(dt, .25); dt = Math.min(dt, .1);
  try { karaokeTick(dt); } catch (e) { }
  if (!S.on) return;
  if (S.n && !S.alone && /^(wander|path|idle|talk|off)$/.test(S.n.state)) { S.n.state = 'motel'; S.n.g.visible = true; }   // 블루스가 끝나며(곡 끝 등) 상대를 클럽 배회로 돌려놓아도 모텔에선 곁에 남음
  try { followTick(dtF); handTick(dt); } catch (e) { }
  doorTick(LOBV, dt, 'x'); doorTick(CORV, dt, 'z');
  if (EXTV.rain.visible) { const a = EXTV.rain.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 9; if (y < 0) y += 9; a.setY(i, y); } a.needsUpdate = true; }
  if (EXTV.taxi) { const tx = EXTV.taxi; tx.t += dt; if (tx.t > 2.5) { tx.g.position.x += dt * Math.min(9, (tx.t - 2.5) * 6); if (tx.g.position.x > BX + 12) { EXT.G.remove(tx.g); EXTV.taxi = null; } } }
  if (oc && S.area === COR) { oc.t += dt; oc.forEach((g, i) => { if (oc.t < 3.2) g.position.x -= dt * 1.1; else if (oc.t < 3.6) { g.userData.moving = false; g.rotation.y = Math.PI; } else if (oc.t > 4.4) g.visible = false; }); }
  if (S.area === ROOM && S.step === 'room') {
    tvAcc += dt; if (tvAcc > .15) { tvShow.t += tvAcc; drawTV(tvShow.t); if ((tvShow.t * 2 | 0) % 4 === 0) drawWindow(tvShow.t); tvAcc = 0; }
    if (!S.busy) { S.clockMin += dt * (S.stay === 'rent' ? 1 : 1.5); updBar(); if (S.clockMin >= S.endMin) { sys(L('⏰ 이용 시간이 끝났어요 — 체크아웃합니다', '⏰ Time’s up — checking out')); checkout(true); } }
    if (!S.alone) { S.comfort = adminMax() ? 100 : U.clamp(S.comfort + dt * .015, 0, 100); evAcc += dt; if (evAcc > S.evNext) { evAcc = 0; S.evNext = 38 + (U.hash(S.n.name + S.clockMin) % 30); eventTick(); } }
    if (RV.water) RV.water.position.y = .5 + Math.sin(performance.now() / 600) * .008;
  }
});
/* v60 확장 모듈(motel19.js)용 내부 핸들 — 같은 상태·동의·연출 함수를 그대로 씀(중복 시스템 X) */
S._x = { T, U, M, L, pick, col, BX, RHX, RHZ, RH, RV, ROOM, box, cyl, std, glow, nSay, meSay, sys, say, wait, beep, ding, knock, modal, esc, tr, memOf, impaired, adminMax, attrs, save, DB, NEED, consent, romantic, sitBoth, standBoth, standAct, endStanding, stopHand, startHand, stopCurrent, applyMood, MOODS, EVENTS, event, ACTS, photo, roomService, extendStay, checkout, sleepNight, renderPanel, panel, bar, placePartner, updBar, tvShow };
S.api = { decide, inviteScore, attrs, consent, invite: (n, id) => invite(n, STYLES.find(x => x.id === id) || STYLES[1]), npcInvites, checkout, event, avail, memOf };   // 시험·확장용
/* 👑 관리자 만점 유지 + 🧪 토글 버튼 */
let admAcc = 0;
NC.tickers.push(dt => { admAcc += dt || 0; if (admAcc < 2) return; admAcc = 0;
  const btn = document.getElementById('btnAdmMax'), tb = document.getElementById('topbtns');
  if (isAdmin() && !btn && tb) { const b = document.createElement('button'); b.id = 'btnAdmMax'; b.className = 'ibtn'; b.title = L('관리자 테스트 만점 모드(호감도·모텔 점수 100) 켜기/끄기', 'Admin test mode (max scores) on/off');
    b.onclick = () => { const on = !adminMax(); U.store.set('nc_admin_max', on ? '1' : '0'); upd(); NC.ui.toast(on ? L('🧪 테스트 만점 모드 켜짐 — 모든 손님 호감도 100 · 모텔 점수 만점', '🧪 Test mode ON — all affinity 100, motel scores max') : L('🧪 테스트 만점 모드 꺼짐 — 원래 점수 규칙으로', '🧪 Test mode OFF — normal rules')); };
    const upd = () => { b.textContent = adminMax() ? '🧪' : '⚗'; b.style.boxShadow = adminMax() ? '0 0 10px #3dff8a' : ''; }; b._upd = upd; upd(); tb.insertBefore(b, tb.firstChild);
    if (adminMax()) NC.ui.toast(L('🧪 관리자 테스트 만점 모드 — 블루스·모텔 등 모든 점수 100 (상단 🧪 로 끄기)', '🧪 Admin test mode — all scores 100 (toggle with 🧪)')); }
  else if (!isAdmin() && btn) btn.remove();
  else if (btn && btn._upd) btn._upd();
  if (!adminMax() || !NC.NPC) return;
  (NC.NPC.list || []).forEach(n => { if (n.aff < 100) n.aff = 100; n.mood = 1; n.rejectedAt = 0; n.cool = 0; const m = DB.npc[n.id || n.name]; if (m && (m.pressure || m.lastOut)) { m.pressure = 0; m.lastOut = ''; } });
  if (S.on && !S.alone) S.comfort = 100;
});
console.info('[motel] v58 🏨 모텔 가기 패키지 — 노래방 전용 메뉴 · 관계/동의 엔진 · 모텔 3곳 · 방 5종 · 결제 6가지 · 이동 4가지 · 로비/엘리베이터/복도/객실 · 활동 26 · 이벤트 24');
})();
