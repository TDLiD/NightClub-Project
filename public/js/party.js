/* party.js — v15 디스코 타임 · 블루스 타임 (상단 단축 버튼)
 *  ■ 버튼을 누르면 전체 AI 손님의 80% 이상(대화·부킹·노래방 중인 손님만 빼고 전원)이 플로어로 나온다.
 *    테이블·VIP에 앉아 있던 손님도 일어나 나오고, 타임이 끝나면 원래 자리로 돌아가 다시 앉는다.
 *  ■ 디스코 타임(90초): 디스코 음악 + 네온 조명. 손님들이 플로어·무대 앞을 옮겨 다니며 춤추고, 남자 손님이 여자 손님에게 헌팅을 시도(성공/거절 말풍선).
 *    플레이어는 돌아다니며 이성 손님에게 E 「💘 헌팅하기」 → 작업 멘트 · 같이 추기 · (게임 속) 번호 교환.
 *  ■ 블루스 타임(80초): 발라드 + 웜 조명(반짝임 없음). 남녀가 짝을 지어 마주 보고 슬로댄스, 짝 없는 손님은 플로어 가장자리에서 리듬.
 *    짝 없는 이성에게 E 「💕 블루스 신청」 → 기존 부르스(대화 칩·동작) 그대로 이어짐.
 *  ■ 끝나면 이전 조명·음악으로 복원. 다시 누르면 즉시 종료.
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world) return;
const U = NC.util, W = NC.world, Mo = NC.Motion;
const DUR = { disco: 90, blues: 80 };
const PT = NC.Party = { mode: null, left: 0, members: [], pairs: [] };
const P = () => NC.player, D = () => NC.Dialog, K = () => NC.Karaoke;
const say = (n, text, sec) => NC.bubble && NC.bubble(n.g || n, text, sec);
const myGender = () => (NC.settings && NC.settings.look && NC.settings.look.gender) || 'm';

/* ── 상단 버튼 ── */
const bar = document.createElement('div'); bar.id = 'partyBar'; bar.style.display = 'none';
bar.innerHTML = '<button id="pbDisco" title="손님 80% 이상이 플로어로! 돌아다니며 이성에게 헌팅">🪩 디스코 타임</button><button id="pbBlues" title="남녀가 짝지어 슬로댄스">💕 블루스 타임</button>';
(document.getElementById('topbar') || document.body).appendChild(bar);
const bD = bar.querySelector('#pbDisco'), bB = bar.querySelector('#pbBlues');
bD.onclick = () => PT.mode === 'disco' ? stop('user') : start('disco');
bB.onclick = () => PT.mode === 'blues' ? stop('user') : start('blues');
NC.on && NC.on('start', () => { bar.style.display = ''; });
function renderBar() {
  bD.classList.toggle('on', PT.mode === 'disco'); bB.classList.toggle('on', PT.mode === 'blues');
  bD.textContent = PT.mode === 'disco' ? `🪩 디스코 ${Math.ceil(PT.left)}초 · 끄기` : '🪩 디스코 타임';
  bB.textContent = PT.mode === 'blues' ? `💕 블루스 ${Math.ceil(PT.left)}초 · 끄기` : '💕 블루스 타임';
}

/* ── 플로어 자리 고르기 (서로 겹치지 않게) ── */
function floorSpots(count, minD, stageShare) {
  const Z = W.zones, F = Z.dance, ST = Z.stage, out = [];
  const tryPick = (fn) => { for (let k = 0; k < 60; k++) { const p = fn(); if (out.every(q => Math.hypot(q.x - p.x, q.z - p.z) >= minD)) return p; } return fn(); };
  for (let i = 0; i < count; i++) {
    const onStage = Math.random() < stageShare;
    out.push(tryPick(onStage
      ? () => { const x = (Math.random() < .5 ? -1 : 1) * (5.8 + Math.random() * 3.6), z = ST.z1 - .7 - Math.random() * 2.2; return { x, z, stage: true }; }   // 가수 무대 양옆(DJ 단 피해서)
      : () => ({ x: F.x0 + .9 + Math.random() * (F.x1 - F.x0 - 1.8), z: F.z0 + .9 + Math.random() * (F.z1 - F.z0 - 1.8) })));
  }
  return out;
}
const edgeSpot = () => { const F = W.zones.dance, side = Math.random(); return side < .5 ? { x: (Math.random() < .5 ? F.x0 - .9 : F.x1 + .9), z: F.z0 + 1 + Math.random() * (F.z1 - F.z0 - 2) } : { x: F.x0 + 1 + Math.random() * (F.x1 - F.x0 - 2), z: F.z1 + .9 }; };

/* ── 누가 나오나: 대화·부킹·노래방·플레이어와 부르스 중인 손님만 제외 ── */
function eligible() {
  const k = K(), busy = new Set([D() && D().cur && D().cur.n, k && k.BL && k.BL.n].concat((k && k.guests) || []).filter(Boolean));
  return (NC.npcs || []).filter(n => !busy.has(n) && !n.booked && n.state !== 'talk' && n.state !== 'escort' && (n.role === 'crowd' || n.role === 'persona'));
}

function start(mode) {
  const k = K(); if (k && k.inRoom) return NC.ui.toast('노래방 안에서는 쓸 수 없어요 — 클럽 홀로 나와 주세요');
  const prev = PT.mode, all = (NC.npcs || []).filter(n => n.role === 'crowd' || n.role === 'persona');
  // 디스코 ↔ 블루스 바로 전환: 손님을 자리로 돌려보내지 않고 짝·동작만 다시 배정 (원래 자리 기록은 유지)
  if (prev) PT.members.forEach(n => { n._pair = null; n.huntWith = null; const u = n.g.userData; u.kissK = 0; u.hideLabel = false; u.bluesLead = false; });
  const list = Array.from(new Set(eligible().concat(prev ? PT.members.filter(n => n.party && n.state !== 'talk' && n.state !== 'blues') : [])));
  if (!list.length) return NC.ui.toast('지금은 나올 손님이 없어요');
  if (prev) PT.members.filter(n => !list.includes(n)).forEach(n => { n.party = false; });
  PT.mode = mode; PT.left = DUR[mode]; PT.members = list; PT.pairs = []; PT.huntT = 4; PT.roamT = 6;
  // 조명 · 음악 (처음 시작할 때의 것을 기억해 두었다가 끝나면 복원)
  const A = NC.Audio; if (!prev) { PT.prevTheme = W.themeId || 'neon'; PT.prevMusic = A && A.style; }
  if (W.setTheme) W.setTheme(mode === 'disco' ? 'neon' : 'warm');
  // 손님 출동
  list.forEach(n => {
    const u = n.g.userData;
    if (!n._party) n._party = { state: n.state, x: n.x, z: n.z, ry: n.g.rotation.y, seat: n.state === 'seated' ? n._seatArgs : null, dance: u.dance, lead: u.bluesLead, off: n.state === 'off' || !n.g.visible, kissK: u.kissK || 0 };
    n.party = true; u.kissK = 0; u.lookAt = null; u.holdGlass = false;
    if (n.state === 'off' || !n.g.visible) { NC.NPC.show(n, true); const e = edgeSpot(); n.x = e.x + (Math.random() - .5) * 6; n.z = 2 + Math.random() * 6; n.g.position.set(n.x, 0, n.z); }
    if (n.state === 'seated') { NC.unseatAvatar(n.g, n.x, n.z); }
  });
  if (mode === 'disco') {
    const spots = floorSpots(list.length, 1.15, .15);
    list.forEach((n, i) => sendTo(n, spots[i], () => partyDance(n)));
  } else {
    const M = list.filter(n => n.gender === 'm'), F = list.filter(n => n.gender !== 'm'), np = Math.min(M.length, F.length), cs = floorSpots(np, 1.9, 0);
    for (let i = 0; i < np; i++) { const pr = { m: M[i], f: F[i], c: cs[i], ready: 0, ph: Math.random() * 6 }; PT.pairs.push(pr); M[i]._pair = F[i]._pair = pr;
      sendTo(M[i], { x: cs[i].x - .5, z: cs[i].z }, () => pairReady(pr)); sendTo(F[i], { x: cs[i].x + .5, z: cs[i].z }, () => pairReady(pr)); }
    list.filter(n => !n._pair).forEach(n => sendTo(n, edgeSpot(), () => partyDance(n, 'groove')));
  }
  const pct = Math.round(list.length / Math.max(1, all.length) * 100);
  NC.ui.toast(mode === 'disco' ? `🪩 DJ: "디스코 타임~!! 다 같이 나와요!" — 손님 ${list.length}명(${pct}%) 플로어로! 이성에게 E 💘 헌팅` : `💕 DJ: "블루스 타임입니다~ 짝 지어 나와 주세요" — ${PT.pairs.length}쌍 슬로댄스 · 짝 없는 이성에게 E 💕`);
  if (NC.DJ) say(NC.DJ, mode === 'disco' ? '디스코 타임!! 🪩 다 나와~!' : '블루스 타임… 💕 조명 낮춥니다', 3);
  if (mode === 'disco' && NC.fireCO2) setTimeout(() => NC.fireCO2(), 600);
  renderBar(); NC.emit && NC.emit('party:start', mode);
}
function sendTo(n, to, done) { n.state = 'wander'; NC.NPC.goTo(n, to, () => { if (!n.party) { if (n.state === 'idle') { n.state = 'wander'; n.pause = 1; n.wp = null; } return; } done && done(n); }, 3.0); n.speed = 2.8 + Math.random() * .6; }
function partyDance(n, force) {
  const u = n.g.userData; n.state = 'party'; u.moving = false; u.seated = false;
  u.dance = force || (Math.random() < .55 ? 'stageDance' : 'groove');
  const F = W.zones.dance; n.g.rotation.y = Math.atan2((F.x0 + F.x1) / 2 - n.x, -15 - n.z) + (Math.random() - .5) * 1.2;   // 대체로 무대 쪽을 보며
  n.roamAt = (PT.clock || 0) + 7 + Math.random() * 10;
}
function pairReady(pr) {
  if (++pr.ready < 2 || !PT.mode) return;
  [pr.m, pr.f].forEach(n => { n.state = 'party'; const u = n.g.userData; u.dance = 'blues'; u.bluesLead = n === pr.m; u.hideLabel = true; });
  pr.on = true;
}

function stop(reason) {
  if (!PT.mode) return; const mode = PT.mode; PT.mode = null; PT.left = 0;
  const A = NC.Audio, k = K();
  if (W.setTheme && PT.prevTheme) W.setTheme(PT.prevTheme);
  if (k && k.BL && k.BL.n && k.BL.prevTheme) k.BL.prevTheme = PT.prevTheme;   // 플레이어가 부르스 중이면 끝날 때 돌아갈 조명도 원래 것으로
  PT.members.forEach(n => {
    const s = n._party, u = n.g.userData; n.party = false; n._pair = null; u.hideLabel = false; u.kissK = 0; u.bluesLead = s ? s.lead : u.bluesLead;
    if (!s) return; n._party = null;
    if (D() && D().cur && D().cur.n === n) return;                                      // 지금 플레이어와 대화 중 → 대화가 끝나면 평소대로
    if (k && k.BL && k.BL.n === n) return;
    if (s.off) { NC.NPC.show(n, false); return; }
    if ((s.state === 'seated' || n.stay) && (s.seat || n._seatArgs)) { const [x, z, ry, h] = s.seat || n._seatArgs; NC.NPC.goTo(n, { x: x + Math.sin(ry) * 1.2, z: z + Math.cos(ry) * 1.2 }, () => NC.NPC.sit(n, x, z, ry, h), 3); return; }
    if (s.state === 'blues' || s.state === 'tableDance') { NC.NPC.goTo(n, { x: s.x, z: s.z }, () => { n.x = s.x; n.z = s.z; n.state = s.state; u.dance = s.dance; n.g.rotation.y = s.ry; u.kissK = s.kissK; }, 3); return; }
    n.state = 'wander'; n.pause = 1 + Math.random() * 3; n.wp = null; u.dance = null;
  });
  PT.members = []; PT.pairs = [];
  NC.ui.toast(mode === 'disco' ? '🪩 디스코 타임 끝! 손님들이 자리로 돌아가요' : '💕 블루스 타임 끝~ 다들 자리로');
  renderBar(); NC.emit && NC.emit('party:end', mode, reason);
}
PT.start = start; PT.stop = stop;

/* ── 헌팅 (디스코 타임 · 플레이어) ── */
const PICKUP = ['저기요, 혹시 아까부터 저 쳐다보신 거 맞죠? ㅎㅎ', '춤 진짜 잘 추시네요. 저도 좀 알려 주실래요?', '오늘 이 조명 아래서 제일 빛나는 분 같아서 왔어요 ✨', '몇 번 테이블이세요? 저희 쪽으로 놀러 오실래요?', '이 노래 끝나기 전에 이름만 알려 주세요!', '친구들이 가서 말 걸어 보래서요… 아니 사실 제가 걸고 싶었어요'];
const OK = { outgoing: ['ㅋㅋ 멘트 좋다! 같이 춰요~', '오~ 용기 있으시네? 좋아요!'], shy: ['아… 저요? ㅎㅎ 고마워요…', '(수줍) 조금만 같이 춰요'], cool: ['…나쁘지 않네요.', '흠, 한 곡 정도는요.'] };
const NO = { outgoing: ['ㅋㅋ 친구랑 온 거라서요~ 다음에!', '음~ 그 멘트는 좀 아니다 ㅋㅋ'], shy: ['아… 죄송해요 😅', '저 그냥 춤만 출게요…'], cool: ['관심 없어요.', '다른 분 찾아보세요~'] };
const trait = n => (OK[n.trait] ? n.trait : 'outgoing');
function huntOpen(n) {
  if (n.cool > 0) return NC.ui.toast(`${n.name}님은 잠깐 쉬는 중이에요 (${Math.ceil(n.cool)}초)`);
  const intro = n.aff >= 55 ? U.pick(['어? 아까 그분이다 ㅎㅎ', '또 오셨네요? 춤추러 왔어요?']) : U.pick(['…네? 저요?', '안녕하세요~ 무슨 일이세요?', '와 디스코 타임 신난다! 무슨 일이에요?']);
  D().open(n, { intro, hunt: true });
}
(NC.dialogChips = NC.dialogChips || []).push((n, CHIP, c) => {
  if (!(PT.mode === 'disco' && n.party) && !(c && c.opt && c.opt.hunt)) return; const Dl = D();
  const hit = (d) => { n.aff = U.clamp(n.aff + d, 0, 100); Dl.floatDelta(d); Dl.renderHead(); };
  CHIP('😎 작업 멘트 날리기', () => {
    if (c.huntLines >= 3) return Dl.npcSay('ㅋㅋ 멘트는 이제 그만~ 춤이나 춰요!', 'smile');
    c.huntLines = (c.huntLines || 0) + 1; const line = U.pick(PICKUP); Dl.send ? Dl.send(line) : null;
  }, 'pri');
  CHIP('💃 마주 보고 같이 춰요', () => {
    const ok = n.aff >= 40 || Math.random() < .55, tr = trait(n);
    if (ok) { Dl.npcSay(U.pick(OK[tr]), 'smile'); Mo.play(n.g, 'cheer'); Mo.play(P().group, 'cheer'); if (!c.huntDance) { c.huntDance = true; hit(n.trait === 'shy' ? 2 : 4); } }
    else { Dl.npcSay(U.pick(NO[tr]), 'annoyed'); Mo.play(n.g, 'headshake'); hit(-2); }
  });
  CHIP('📱 번호 물어보기 (게임 속)', () => {
    if (c.askedNum) return Dl.npcSay('아까 물어봤잖아요 ㅋㅋ', 'smile');
    c.askedNum = true; const ok = n.aff >= 60 || (n.aff >= 45 && Math.random() < .5);
    if (ok) { Dl.npcSay(U.pick(['좋아요~ 여기요 📱 (가상 번호 교환)', '…연락 기다릴게요 ㅎㅎ']), 'shy'); hit(3); NC.Wallet && NC.Wallet.add(10, `${n.name}님과 번호 교환(게임 속)`); Dl.sys('📱 게임 속 가상 번호 교환 성공! (실제 연락처 아님) +🪙10'); }
    else { Dl.npcSay(U.pick(['아직은 좀 이른 것 같아요 ㅎㅎ', '번호는… 다음에 또 보면요!', '음… 그건 패스할게요']), 'annoyed'); hit(-1); }
  });
});
NC.on && NC.on('dialog:close', n => { if (!n || !n.party || !PT.mode) return; if (n._pair && n._pair.on) { n.state = 'party'; n.g.userData.dance = 'blues'; } else partyDance(n, PT.mode === 'blues' ? 'groove' : null); });

/* E 상호작용: 디스코 → 💘 헌팅 · 블루스 → 짝 없는 이성에게 💕 신청 */
NC.interactProviders.push(() => {
  const p = P(), out = []; if (!PT.mode || !p.group || p.seat || p.busy) return out; const g = myGender();
  PT.members.forEach(n => {
    if (!n.party || !['party', 'path', 'wander'].includes(n.state) || n.gender === g || !n.g.visible || (PT.mode === 'blues' && n._pair)) return; const d = Math.hypot(n.x - p.x, n.z - p.z); if (d > 2.3) return;
    if (PT.mode === 'disco') out.push({ label: `💘 ${n.name}에게 헌팅하기 (E)`, dist: d - .2, run: () => huntOpen(n) });
    else if (!n._pair) out.push({ label: `💕 ${n.name}에게 블루스 신청 (E)`, dist: d - .2, run: () => { D().open(n, { intro: U.pick(['어… 저랑요? ㅎㅎ', '블루스요? 음…']) }); const k = K(); if (k && k.startBlues) setTimeout(() => { if (D().cur && D().cur.n === n) k.startBlues(n); }, 900); } });
  });
  return out;
});

/* ── 매 프레임: 블루스 커플 배치 · 디스코 이동/헌팅 · 이탈 손님 복귀 · 타이머 ── */
let watchT = 0;
NC.tickers.push(dt => {
  if (!PT.mode) return;
  PT.left -= dt; PT.clock = (PT.clock || 0) + dt; if (PT.left <= 0) { stop('time'); return; }
  if ((PT.barT = (PT.barT || 0) - dt) <= 0) { PT.barT = .5; renderBar(); }
  const now = performance.now() / 1000;
  // 블루스: 커플이 마주 보고 천천히 돌며 흔들기 (가끔 살짝 기댐)
  PT.pairs.forEach(pr => { if (!pr.on) return; const a = pr.m, b = pr.f; if (a.state !== 'party' || b.state !== 'party') return;
    const ang = pr.ph + now * .18, d = .22, cx = pr.c.x + Math.sin(now * .21 + pr.ph) * .35, cz = pr.c.z + Math.cos(now * .17 + pr.ph) * .25;
    a.x = cx - Math.cos(ang) * d; a.z = cz - Math.sin(ang) * d; b.x = cx + Math.cos(ang) * d; b.z = cz + Math.sin(ang) * d;
    const ry = Math.atan2(b.x - a.x, b.z - a.z); a.g.rotation.y = ry; b.g.rotation.y = ry + Math.PI;
    const k = Math.max(0, Math.sin(now * .35 + pr.ph * 2)) * .5; a.g.userData.kissK = b.g.userData.kissK = k;
    a.g.position.set(a.x, NC.groundY(a.x, a.z), a.z); b.g.position.set(b.x, NC.groundY(b.x, b.z), b.z); });
  if (PT.mode === 'disco') {
    // 돌아다니기: 일정 시간마다 플로어의 다른 자리로
    PT.members.forEach(n => { if (n.party && n.state === 'party' && n.roamAt && PT.clock > n.roamAt && !n.huntWith) { const [s] = floorSpots(1, 0, .12); sendTo(n, s, () => partyDance(n)); } });
    // NPC 끼리 헌팅: 남자 손님이 근처 여자 손님에게 다가가 말 걸기 → 성공하면 마주 보고 춤 / 거절이면 고개 젓기
    if ((PT.huntT -= dt) <= 0) { PT.huntT = 5 + Math.random() * 5;
      const ms = PT.members.filter(n => n.party && n.state === 'party' && n.gender === 'm' && !n.huntWith), fs = PT.members.filter(n => n.party && n.state === 'party' && n.gender !== 'm' && !n.huntWith);
      const m = ms.length && U.pick(ms), f = m && fs.sort((x, y) => Math.hypot(x.x - m.x, x.z - m.z) - Math.hypot(y.x - m.x, y.z - m.z))[0];
      if (m && f) { m.huntWith = f; f.huntWith = m;
        sendTo(m, { x: f.x + Math.sin(f.g.rotation.y) * .9, z: f.z + Math.cos(f.g.rotation.y) * .9 }, () => {
          partyDance(m); m.g.rotation.y = Math.atan2(f.x - m.x, f.z - m.z); f.g.rotation.y = Math.atan2(m.x - f.x, m.z - f.z); say(m, U.pick(PICKUP), 2.4);
          const ok = Math.random() < .6;
          setTimeout(() => { if (!PT.mode) return; say(f, U.pick((ok ? OK : NO)[trait(f)]), 2.2); Mo.play(f.g, ok ? 'laugh' : 'headshake'); if (!ok) { Mo.play(m.g, 'flinch'); m.huntWith = f.huntWith = null; m.roamAt = (PT.clock || 0) + 1.5; }
            else { m.g.userData.dance = f.g.userData.dance = 'stageDance'; setTimeout(() => { m.huntWith = f.huntWith = null; }, 14000); } }, 2300); }); } }
  }
  // 대화·부르스가 끝나 'wander' 로 풀린 손님은 다시 플로어로
  if ((watchT -= dt) <= 0) { watchT = 1; PT.members.forEach(n => { if (!n.party || n.state !== 'wander') return; if (n._pair && n._pair.on) { sendTo(n, { x: n._pair.c.x + (n === n._pair.m ? -.5 : .5), z: n._pair.c.z }, () => { n.state = 'party'; n.g.userData.dance = 'blues'; }); return; } const [s] = PT.mode === 'blues' ? [edgeSpot()] : floorSpots(1, 0, .1); sendTo(n, s, () => partyDance(n, PT.mode === 'blues' ? 'groove' : null)); }); }
});
console.info('[party] 디스코 타임 · 블루스 타임 준비 완료');
})();
