/* lifestyle.js — 나이트클럽 생활 기능 (v8)
 *  ■ 우측 🎛 클럽 설정 패널: 무대 조명 테마 6종 · 스테이지 음악 7종 · 📸 사진 찍기
 *  ■ 서비스: 테이블/VIP 에 앉으면 웨이터가 다가와 주문 받음 · 빈 VIP 룸에 들어가면 웨이터가 따라 들어와 안내
 *  ■ BAR: 바 의자 6석 · 바텐더 주문(칵테일·맥주·무알콜·물) · 바에 앉아 있는 손님에게 말 걸기 / 술 한 잔 사기
 *  ■ 생활 상태: 🍺 취기(마실수록↑, 시간이 지나면↓, 4 이상이면 술 대신 물) · 🚻 화장실 신호 · ✨ 매무새(첫인상 보너스)
 *  ■ 앉아 있을 때 하단 액션바: 웨이터 호출 · 마시기 · 건배 · 대화 · 술 권하기 · 팁 · 사진
 *  ■ DJ 부스: 신청곡 · DJ 팁 / 성능: 모든 갱신을 하나의 ticker 에서 0.2초 간격으로 처리
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world) return;
const T = NC.THREE, U = NC.util, W = NC.world, Mo = NC.Motion, S = NC.scene;
const P = () => NC.player;
const life = NC.Life = { tipsy: 0, bladder: 0, drink: null, sips: 0, charm: 0, warned: false };

/* ═════ 1. 우측 클럽 설정 패널 ═════ */
const panel = document.createElement('div'); panel.id = 'clubPanel'; panel.innerHTML = `
  <button id="cpToggle" title="클럽 설정">🎛</button>
  <div id="cpBody"><h4>🎨 무대 조명</h4><div id="cpTheme" class="cpGrid"></div><h4>🎵 스테이지 음악</h4><div id="cpMusic" class="cpGrid"></div>
  <div class="cpGrid"><button id="cpPhoto">📸 사진 찍기</button><button id="cpHelp">❔ 생활 기능</button></div></div>`;
document.body.appendChild(panel);
const $ = s => panel.querySelector(s);
function renderPanel() {
  const th = $('#cpTheme'), mu = $('#cpMusic'); th.innerHTML = ''; mu.innerHTML = '';
  Object.entries(W.THEMES || {}).forEach(([id, t]) => { const b = document.createElement('button'); b.textContent = t.name; b.className = W.themeId === id ? 'on' : ''; b.onclick = () => { W.setTheme(id); renderPanel(); NC.ui.toast('🎨 조명: ' + t.name); }; th.appendChild(b); });
  const A = NC.Audio; Object.entries(A.STYLES || {}).forEach(([id, m]) => { const b = document.createElement('button'); b.textContent = `${m.name} · ${m.bpm}`; b.className = A.style === id ? 'on' : ''; b.onclick = () => { if (!A.ctx) A.init(); A.setStyle(id); renderPanel(); NC.ui.toast('🎵 음악: ' + m.name); }; mu.appendChild(b); });
}
$('#cpToggle').onclick = () => { panel.classList.toggle('open'); renderPanel(); };
$('#cpPhoto').onclick = () => photo();
$('#cpHelp').onclick = () => NC.ui.modal(`<h3>🍸 나이트 생활 가이드</h3><ul style="text-align:left;line-height:1.7">
  <li>🪑 <b>테이블·VIP 소파·바 의자</b>에 다가가 E → 앉으면 웨이터/바텐더가 주문을 받아요</li><li>🛋 빈 <b>VIP 룸</b>에 들어가면 웨이터가 따라와 안내해요</li>
  <li>🍹 하단 액션바: 마시기 · 건배 · 옆자리 대화 · 술 한 잔 사기 · 팁</li><li>🚻 <b>화장실</b>(동쪽 화장실 동) · 🚬 <b>흡연실</b>(서쪽 동 북쪽) · 🎤 노래방(서쪽 노래방 동 입구)</li>
  <li>🎵 <b>DJ 부스</b> 앞에서 신청곡 · 🍺 취기가 오르면 물을 드세요</li></ul>`, [['알겠어요', 'ok', true]]);
NC.on('music:style', renderPanel); NC.on('theme', renderPanel);

function photo() {
  const R = NC.renderer; (NC.render || ((s, c) => R.render(s, c)))(NC.scene, NC.camera);
  try { const url = R.domElement.toDataURL('image/jpeg', .92), a = document.createElement('a'); a.href = url; a.download = `추억의나이트_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`; a.click(); NC.ui.toast('📸 찰칵! 사진이 저장됐어요'); NC.Audio.sfx('pop'); }
  catch (e) { NC.ui.toast('사진을 저장할 수 없어요'); }
}

/* ═════ 2. 생활 상태 HUD ═════ */
const hud = document.createElement('div'); hud.id = 'lifeHud'; document.body.appendChild(hud);
function hudUpdate() {
  const t = Math.round(life.tipsy), parts = [];
  if (life.tipsy >= .5) parts.push(`🍺 취기 ${'●'.repeat(t)}${'○'.repeat(Math.max(0, 5 - t))}`);
  if (life.bladder >= 3) parts.push('🚻 화장실 신호');
  if (life.drink) parts.push(`${life.drink.icon} ${life.drink.name} (${3 - life.sips}모금)`);
  if (life.charm) parts.push(`✨ 매무새 +${life.charm}`);
  hud.innerHTML = parts.join(' · '); hud.style.display = parts.length ? 'block' : 'none';
  if (NC.post && NC.post.uniforms.wobble) NC.post.uniforms.wobble.value = Math.max(0, life.tipsy - 1.5) * .6;
}

/* ═════ 3. 메뉴 · 주문 ═════ */
const MENU = {
  bar: [['highball', '하이볼', '🥃', 8, 1], ['mojito', '모히토', '🍹', 10, 1], ['sunrise', '데킬라 선라이즈', '🍹', 12, 1.2], ['whisky', '위스키 온더락', '🥃', 15, 1.5], ['beer', '생맥주', '🍺', 5, .8], ['mocktail', '무알콜 칵테일', '🧃', 6, 0], ['water', '시원한 물', '💧', 0, -.7]],
  table: [['beerset', '맥주 세트 (4병)', '🍻', 15, .8, 'beer'], ['soju', '소주 + 과일 안주', '🍶', 18, 1, 'soju'], ['fruit', '과일 안주', '🍉', 10, 0, 'fruit'], ['snack', '마른안주 · 나초', '🥨', 6, 0, 'snack'], ['cocktail', '칵테일', '🍹', 10, 1], ['water', '물 · 얼음', '💧', 0, -.7]],
  vip: [['whiskyset', '양주 세트 (17년산)', '🥃', 30, 1.5, 'whisky'], ['champ', '샴페인 서비스', '🍾', 40, 1, 'champ'], ['fruitL', '대형 과일 플래터', '🍇', 15, 0, 'fruit'], ['beerset', '맥주 세트 (4병)', '🍻', 15, .8, 'beer'], ['water', '물 · 얼음', '💧', 0, -.7]],
}; for (const k in MENU) MENU[k] = MENU[k].map(([id, name, icon, price, alc, prop]) => ({ id, name, icon, price, alc, prop }));

const props = []; const PG = {};
function prop(kind, x, y, z) {
  const g = new T.Group(), std = NC.mat.std; g.position.set(x, y, z);
  const glass = PG.glass || (PG.glass = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .03, transparent: true, opacity: .3, envMapIntensity: 2, depthWrite: false }));
  if (kind === 'beer') for (let i = 0; i < 4; i++) { const b = new T.Mesh(new T.CylinderGeometry(.035, .045, .3, 10), std('#6a3a10', { roughness: .08, metalness: .3 })); b.position.set(Math.cos(i * 1.6) * .12, .15, Math.sin(i * 1.6) * .12); g.add(b); }
  else if (kind === 'soju') { const b = new T.Mesh(new T.CylinderGeometry(.03, .04, .24, 10), std('#2a7a3a', { roughness: .06, metalness: .2 })); b.position.y = .12; g.add(b); [-.12, .12].forEach(dx => { const c = new T.Mesh(new T.CylinderGeometry(.022, .018, .05, 10, 1, true), glass); c.position.set(dx, .025, .08); g.add(c); }); kind = 'fruit'; }
  if (kind === 'fruit') { const pl = new T.Mesh(new T.CylinderGeometry(.18, .13, .03, 18), std('#f4f4f4', { roughness: .2 })); pl.position.set(.2, .015, -.05); g.add(pl); ['#ff3d5a', '#ffd23d', '#7bd33d', '#ff8a3d', '#b03dff', '#ff6a8a'].forEach((c, i) => { const f = new T.Mesh(new T.SphereGeometry(.04, 8, 6), std(c, { roughness: .35 })); f.position.set(.2 + Math.cos(i) * .08, .05, -.05 + Math.sin(i) * .08); g.add(f); }); }
  else if (kind === 'snack') { const bw = new T.Mesh(new T.CylinderGeometry(.14, .08, .07, 16, 1, true), std('#c0392b', { roughness: .5, side: T.DoubleSide })); bw.position.y = .035; g.add(bw); for (let i = 0; i < 8; i++) { const c = new T.Mesh(new T.ConeGeometry(.03, .01, 3), std('#e8b04a')); c.position.set((Math.random() - .5) * .14, .07, (Math.random() - .5) * .14); c.rotation.set(Math.random(), Math.random() * 3, 0); g.add(c); } }
  else if (kind === 'whisky') { const b = new T.Mesh(new T.BoxGeometry(.09, .28, .09), std('#7a4010', { roughness: .05, metalness: .3, transparent: true, opacity: .85 })); b.position.y = .14; g.add(b); const ice = new T.Mesh(new T.CylinderGeometry(.11, .09, .16, 16), std('#d8d8e0', { metalness: .9, roughness: .2 })); ice.position.set(.22, .08, 0); g.add(ice); }
  else if (kind === 'glass') { const c = new T.Mesh(new T.CylinderGeometry(.035, .03, .12, 12, 1, true), glass); c.position.y = .06; g.add(c); const liq = new T.Mesh(new T.CylinderGeometry(.031, .027, .07, 12), new T.MeshStandardMaterial({ color: 0xffb35a, emissive: 0x552200, transparent: true, opacity: .75 })); liq.position.y = .04; g.add(liq); }
  S.add(g); props.push(g); while (props.length > 14) { const o = props.shift(); S.remove(o); }
  return g;
}
function placeFor(ctx) {   // 주문한 소품을 놓을 위치
  const s = P().seat || ctx.seat;
  if (ctx.kind === 'bar') return { x: 20.95, y: 1.29, z: BAR_SEATS[ctx.s ?? (s && s.s) ?? 0].z };
  if (ctx.kind === 'table' && s && s.t != null) { const t = NC.tables[s.t]; return { x: t.x + (Math.random() - .5) * .6, y: .9 + (W.TY || 0), z: t.z + (Math.random() - .5) * .6 }; }
  if ((ctx.kind === 'vip' || ctx.kind === 'vipEnter') && ctx.room != null) { const v = W.vip[ctx.room]; return { x: v.cx - .9 + Math.random() * 1.2, y: .62, z: 16 + (Math.random() - .5) * .5 }; }
  return null;
}
function serve(item, ctx, server) {
  if (item.alc > 0 && life.tipsy >= 4) { NC.ui.chatAdd(server, '손님, 오늘은 조금 많이 드신 것 같아요. 시원한 물 한 잔 드릴게요 💧'); item = MENU.bar.find(m => m.id === 'water'); }
  if (item.price && NC.goldenFree && NC.goldenFree()) NC.ui.toast('🔔 골든벨 ALL PAY — 무료!');
  else if (item.price && !NC.Wallet.spend(item.price)) { NC.ui.toast(`🪙 코인이 부족해요 (${item.price} 필요)`); return false; }
  if (item.price) NC.Audio.sfx('coin');
  setTimeout(() => {
    const at = placeFor(ctx);
    if (item.prop === 'champ' && ctx.room != null) W.vip[ctx.room].champ.visible = true;
    else if (item.prop && at) prop(item.prop, at.x, at.y, at.z);
    if (at && ctx.kind === 'bar') prop('glass', at.x, at.y, at.z);
    life.drink = item; life.sips = 0; P().group.userData.holdGlass = true; NC.Audio.sfx('clink');
    NC.ui.toast(`${item.icon} ${item.name} 나왔습니다!${item.alc > 0 ? '' : ''}`); hudUpdate();
  }, 900);
  return true;
}
function sip() {
  const d = life.drink; if (!d) return NC.ui.toast('마실 게 없어요 · 주문부터 해 보세요');
  Mo.play(P().group, 'drink'); life.sips++; life.tipsy = U.clamp(life.tipsy + d.alc * .45, 0, 5); life.bladder += d.id === 'water' ? .6 : .45;
  if (life.sips >= 3) { life.drink = null; setTimeout(() => { P().group.userData.holdGlass = false; }, 2000); }
  if (life.bladder >= 3 && !life.warned) { life.warned = true; setTimeout(() => NC.ui.toast('🚻 화장실이 가고 싶어요 — 동쪽 벽 화장실 동(부킹 통로 옆)에 있어요'), 2200); }
  if (life.tipsy >= 4.5) NC.ui.toast('🥴 많이 취했어요… 물을 마시고 쉬어 가세요');
  hudUpdate();
}
let cheersCd = 0;
function cheers() {
  Mo.trigger(P().group, 'drink:cheers');
  const n = nearbyCompanion(3.2); if (n && cheersCd <= 0) { cheersCd = 25; setTimeout(() => Mo.trigger(n.g, 'drink:cheers', { silent: true }), 250); n.aff = U.clamp((n.aff ?? 40) + 1, 0, 100); NC.ui.chatAdd(n.name, U.pick(['짠~! 🥂', '오늘 밤을 위하여! 짠!', '건배~ ㅎㅎ', '원샷은 안 돼요 ㅋㅋ 짠!'])); }
}
function nearbyCompanion(r) {
  const p = P(); let best = null, bd = r;
  (NC.npcs || []).forEach(n => { if (!n.g.visible || !(n.state === 'seated' || n.stay)) return; const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = n; } });
  return best;
}

/* ═════ 4. 웨이터 서비스 ═════ */
function freeWaiter() { const p = P(); return (NC.Waiters ? NC.Waiters.list : []).filter(o => !o.busy).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; }
function menuDlg(name, tag, say, items, ctx, extra = [], onEnd) {
  const p = P(); p.busy = true;
  const end = msg => { NC.ui.hideDlg(); p.busy = false; if (msg) NC.ui.toast(msg); onEnd && onEnd(); };
  NC.ui.showDlg({ name, tag, job: `🪙 ${NC.Wallet.get()}`, say, opts: items.map(it => ({ t: `${it.icon} ${it.name}  ${it.price ? '🪙' + it.price : '무료'}`, run: () => { const ok = serve(it, ctx, name); end(ok ? null : undefined); } }))
    .concat(extra.map(e => ({ t: e.t, run: () => { NC.ui.hideDlg(); p.busy = false; e.run(); onEnd && onEnd(); } })))
    .concat([{ t: '괜찮아요, 나중에 할게요', run: () => end() }]) });
}
function dispatchWaiter(to, ctx, greet) {
  const o = freeWaiter(); if (!o) { NC.ui.toast('웨이터가 모두 바빠요. 잠시 후 다시 불러 주세요'); return; }
  o.busy = true; o.g.userData.lookAt = null;
  const route = NC.NPC.planPath(o, to), back = () => { o.busy = false; o.state = 'idle'; o.g.userData.lookAt = null; if (o.home) NC.Waiters.walk(o, NC.NPC.planPath(o, o.home)); };
  NC.Waiters.walk(o, route, () => {
    o.g.userData.lookAt = P(); Mo.play(o.g, 'bow');
    const items = MENU[ctx.kind === 'vipEnter' ? 'vip' : ctx.kind] || MENU.table;
    const extra = [{ t: '💃 부킹 부탁해요', run: () => { NC.ui.hideDlg(); P().busy = false; if (P().seat && NC.Episodes && NC.Episodes.bookToSeat(o)) back(); else { o.busy = false; NC.Waiters.runTree(o); } } }, /* v14: 테이블·VIP 자리로 부킹 */ { t: '🧾 팁 드릴게요 (🪙5)', run: () => { if (NC.Wallet.spend(5)) { NC.Audio.sfx('coin'); NC.ui.chatAdd(o.def.title, '감사합니다! 오늘 서비스 확실히 챙겨 드릴게요 😄'); } back(); } }];
    if (ctx.kind === 'vipEnter') extra.unshift({ t: '🛋 소파에 앉을게요', run: () => { const v = W.vip[ctx.room], i = v.occ.findIndex(x => !x); if (i >= 0) NC.ui.fade(() => { v.occ[i] = 'me'; NC.sitPlayer({ kind: 'vip', room: ctx.room, s: i }, v.seats[i]); }); back(); } });
    menuDlg(o.def.title, '🤵 서비스', greet, items, ctx, extra, () => { if (o.busy) setTimeout(back, 600); });
  }, 3.0);
}
// 착석 → 자동 웨이터
let seatTimer = null;
NC.on('seat', info => {
  clearTimeout(seatTimer); if (!info || !(info.kind === 'table' || info.kind === 'vip')) return;
  const sess = NC.VIP && NC.VIP.session && info.kind === 'vip' && NC.VIP.session.room === info.room;
  seatTimer = setTimeout(() => {
    const p = P(); if (!p.seat || p.seat !== info || p.busy) return;
    const s = info.kind === 'table' ? NC.seatPos(info.t, info.s) : W.vip[info.room].seats[info.s];
    const to = info.kind === 'table' ? NC.standPos(info.t, info.s) : { x: s.x + (s.x < W.vip[info.room].cx ? 1.1 : -1.1), z: Math.min(s.z, 17.4) };
    dispatchWaiter(to, { kind: info.kind, room: info.room, seat: info }, info.kind === 'vip' ? 'VIP 룸에 오신 걸 환영합니다! 무엇으로 세팅해 드릴까요? 🍾' : U.pick(['어서 오세요! 주문하시겠어요? 😊', '편하게 앉으셨어요? 오늘 뭐로 드릴까요?', '반갑습니다! 시원한 거 한잔 하실래요?']));
  }, sess ? 9000 : 2500);
});
// 빈 VIP 룸 입장 → 웨이터가 따라 들어와 안내
let lastRoom = -1, vipCd = {};
function vipWatch() {
  const p = P(); if (!p.group || p.seat || p.busy) { lastRoom = p.room ?? -1; return; }
  if (p.room >= 0 && p.room !== lastRoom) { const v = W.vip[p.room], empty = !v.occ.some(Boolean), now = performance.now();
    if (empty && !(NC.VIP && NC.VIP.session) && (now - (vipCd[p.room] || 0)) > 60000) { vipCd[p.room] = now; const room = p.room;
      setTimeout(() => { if (P().room !== room || P().seat || P().busy) return; dispatchWaiter({ x: v.cx + .9, z: v.z0 + 1.6 }, { kind: 'vipEnter', room }, `VIP ${room + 1}번 룸입니다! 편하게 앉으시면 바로 세팅해 드릴게요. 미리 주문하시겠어요? 🍾`); }, 1800); } }
  lastRoom = p.room ?? -1;
}

/* ═════ 5. BAR: 의자 · 바텐더 · 바 손님 ═════ */
const BAR_SEATS = [0, 1, 2, 3, 4, 5].map(i => ({ x: 20.1, z: -12 + i * 2.6, ry: Math.PI / 2, h: .86 }));
const barOcc = BAR_SEATS.map(() => null);
NC.standHandlers = NC.standHandlers || {};
NC.standHandlers.bar = s => { barOcc[s.s] = null; return { x: 19.72, z: BAR_SEATS[s.s].z + .4 }; };
const BARTENDER = '바텐더 J';
function barMenu() {
  const bt = NC.Bartender; if (bt) { bt.userData.lookAt = P().group.position; Mo.play(bt, 'wave'); }
  menuDlg(BARTENDER, '🍸 BAR', U.pick(['어서 오세요~ 오늘 기분엔 뭐가 좋을까요? 🍸', '시그니처는 모히토예요. 상큼하게 한 잔?', '오늘 좀 피곤해 보이시네요. 하이볼 어떠세요?']), MENU.bar, { kind: 'bar', s: (P().seat && P().seat.kind === 'bar') ? P().seat.s : nearestBarSeat() },
    [{ t: '🎩 칵테일 쇼 보여 주세요 (🪙3)', run: () => { if (!NC.Wallet.spend(3)) return NC.ui.toast('코인이 부족해요'); if (bt) { Mo.play(bt, 'cheer'); setTimeout(() => Mo.play(bt, 'clap'), 1500); } NC.fx && bt && NC.fx.confetti(bt.position.x, 2.6, bt.position.z, 30); NC.ui.chatAdd(BARTENDER, '🍸 짜잔~ 셰이커 3단 돌리기! 박수 주세요 ㅎㅎ'); } },
     { t: '💬 바텐더와 수다', run: () => NC.ui.chatAdd(BARTENDER, U.pick(['여기 단골들은 다 90년대 노래 나오면 스테이지로 뛰어가요 ㅋㅋ', '오늘 VIP 2번 룸 손님들 샴페인만 세 병째예요 🍾', '저쪽 손님 혼자 오셨던데… 한 잔 사 드려 보시는 건 어때요? 😉', '술 마시기 전에 물 한 잔! 제 철칙이에요.'])) }]);
}
function nearestBarSeat() { const p = P(); let b = 0, bd = 1e9; BAR_SEATS.forEach((s, i) => { const d = Math.abs(s.z - p.z); if (d < bd) { bd = d; b = i; } }); return b; }
// 바 손님 (여성 2명이 바에 앉아 있음)
const barGuests = [];
function initBarGuests() {
  const pool = (NC.npcs || []).filter(n => n.role === 'crowd' && n.gender === 'f' && n.enabled && !n.g.userData.vrm && n.state === 'wander');
  [1, 4].forEach((si, k) => { const n = pool[k]; if (!n) return; n.stay = 'bar'; n.booked = true; n.aff = n.aff ?? 40; const s = BAR_SEATS[si]; barOcc[si] = n; NC.NPC.sit(n, s.x, s.z, s.ry, s.h); n.g.userData.holdGlass = true; barGuests.push({ n, si }); });
}
function buyDrinkFor(n) {
  const p = P(); if (!NC.Wallet.spend(10)) return NC.ui.toast('🪙 코인이 부족해요 (10 필요)');
  NC.Audio.sfx('coin'); const bt = NC.Bartender; if (bt) Mo.play(bt, 'point');
  n.tipsy = n.tipsy || 0;
  setTimeout(() => {
    let line, d;
    if (n.tipsy >= 3) { line = '고마워요… 근데 저 오늘 많이 마셨어요. 물로 바꿔 주실래요? 😅'; d = 3; }
    else if ((n.aff ?? 40) < 28 && n.trait === 'cool') { line = '마음만 받을게요. 그래도 고마워요 😊'; d = 1; NC.Wallet.add(10, '환불'); }
    else { line = { outgoing: '와 진짜요?! 감사해요~ 그럼 우리 짠 해요! 🥂', shy: '아… 저한테요? 고, 고마워요… 잘 마실게요 ☺️', playful: '오~ 센스 있으시네? 이거 마시면 제가 한 잔 쏘는 거예요 ㅋㅋ', cool: '고마워요. 취향 잘 맞네요 🍸' }[n.trait] || '고마워요! 잘 마실게요 😊'; d = 4 + (n.trait === 'outgoing' ? 2 : 0); n.tipsy++; setTimeout(() => { Mo.trigger(n.g, 'drink:cheers', { silent: true }); Mo.trigger(p.group, 'drink:cheers'); }, 400); }
    n.aff = U.clamp((n.aff ?? 40) + d, 0, 100); NC.ui.chatAdd(n.name, line); NC.ui.toast(`💗 ${n.name} 호감도 +${d} (${n.aff})`); n.g.userData.say && n.g.userData.say(2);
  }, 1100);
}
function talkTo(n) { NC.Dialog.open(n, { intro: U.pick(['아, 안녕하세요~ 여기 자주 오세요?', '혼자 오셨어요? 저도 친구 기다리는 중이에요 ㅎㅎ', '여기 모히토 맛있어요. 드셔 보셨어요?', '음악 좋죠? 오늘 DJ 선곡 괜찮네요']) }); }
// 머무는 NPC(바·흡연실)는 대화가 끝나도 자리 유지
if (NC.VIP && NC.VIP.endSession) { const orig = NC.VIP.endSession; NC.VIP.endSession = (n, reason) => { if (n && n.stay) return; orig(n, reason); }; }
// 손 씻기·거울 → 다음 대화 첫인상 보너스
if (NC.Dialog && NC.Dialog.open) { const o = NC.Dialog.open.bind(NC.Dialog); NC.Dialog.open = (n, opt) => { if (life.charm && n) { n.aff = U.clamp((n.aff ?? 40) + life.charm, 0, 100); NC.ui.toast(`✨ 단정한 매무새 — ${n.name} 첫인상 +${life.charm}`); life.charm = 0; hudUpdate(); } return o(n, opt); }; }

/* ═════ 6. E 상호작용 후보 ═════ */
NC.interactProviders.push(() => {
  const p = P(), out = []; if (!p.group || p.seat || p.busy) return out;
  const atBar = p.x > 18.6 && p.x < 20.7 && p.z > -14 && p.z < 3;
  BAR_SEATS.forEach((s, i) => { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < 1.3 && !barOcc[i]) out.push({ label: '🍸 바 의자에 앉기 (E)', dist: d + .2, run: () => NC.ui.fade(() => { barOcc[i] = 'me'; NC.sitPlayer({ kind: 'bar', s: i }, s); setTimeout(barMenu, 900); }) }); });
  if (atBar) out.push({ label: `🍸 ${BARTENDER}에게 주문 (E)`, dist: 1.0, run: barMenu });
  barGuests.forEach(({ n }) => { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < 2.2) { out.push({ label: `💬 ${n.name}에게 말 걸기 (E)`, dist: d - .2, run: () => talkTo(n) }); } });
  const dj = W.spots.dj; if (dj) { const d = Math.hypot(p.x - dj.x, p.z - (dj.z + 2.2)); if (d < 2.4) out.push({ label: '🎵 DJ에게 신청곡 (E)', dist: d, run: djRequest }); }
  return out;
});
function djRequest() {
  const A = NC.Audio, p = P(); p.busy = true;
  NC.ui.showDlg({ name: 'DJ 노스탤지어', tag: '🎧 DJ 부스', say: '신청곡 받습니다! 어떤 분위기로 갈까요? 🎶 (신청곡 🪙2)', opts: Object.entries(A.STYLES).map(([id, m]) => ({ t: `${m.name} · ${m.bpm}BPM${A.style === id ? ' (재생 중)' : ''}`, run: () => { NC.ui.hideDlg(); p.busy = false; if (!NC.Wallet.spend(2)) return NC.ui.toast('코인이 부족해요'); if (!A.ctx) A.init(); A.setStyle(id); NC.DJ && Mo.play(NC.DJ, 'cheer'); NC.ui.chatAdd('DJ 노스탤지어', `🎧 신청곡 들어갑니다~ ${m.name}! 다 같이 손 머리 위로!`); renderPanel(); } }))
    .concat([{ t: '💵 DJ 팁 (🪙5)', run: () => { NC.ui.hideDlg(); p.busy = false; if (NC.Wallet.spend(5)) { NC.Audio.sfx('coin'); NC.DJ && Mo.play(NC.DJ, 'bow'); NC.ui.chatAdd('DJ 노스탤지어', '감사합니다! 다음 곡은 당신을 위해 🔥'); } } }, { t: '그냥 구경할게요', run: () => { NC.ui.hideDlg(); p.busy = false; } }]) });
}

/* ═════ 7. 앉아 있을 때 하단 액션바 ═════ */
const bar = document.createElement('div'); bar.id = 'seatBar'; document.body.appendChild(bar);
let barSig = '';
function seatBar() {
  const p = P(), s = p.seat, inRoom = NC.Karaoke && NC.Karaoke.inRoom;
  if (!s || p.busy || inRoom || s.kind === 'karaoke') { if (barSig) { bar.innerHTML = ''; bar.style.display = 'none'; barSig = ''; } return; }
  const btns = [];
  if (s.kind === 'bar') btns.push(['🍸 주문', barMenu]); else btns.push(['🔔 웨이터 호출', () => { const st = s.kind === 'table' ? NC.standPos(s.t, s.s) : { x: W.vip[s.room].seats[s.s].x + 1, z: Math.min(W.vip[s.room].seats[s.s].z, 17.4) }; dispatchWaiter(st, { kind: s.kind, room: s.room, seat: s }, '부르셨어요? 😊'); }]);
  if (life.drink) btns.push(['🍹 마시기', sip]); btns.push(['🥂 건배', cheers]);
  const n = nearbyCompanion(3.4); if (n && n !== p) { btns.push([`💬 ${n.name}`, () => n.stay ? talkTo(n) : NC.Dialog.open(n, {})]); if (s.kind === 'bar' || n.stay) btns.push([`🍸 ${n.name}에게 한 잔 (🪙10)`, () => buyDrinkFor(n)]); }
  btns.push(['📸', photo]);
  const sig = btns.map(b => b[0]).join('|'); if (sig === barSig) return; barSig = sig;
  bar.innerHTML = ''; btns.forEach(([t, f]) => { const b = document.createElement('button'); b.textContent = t; b.onclick = f; bar.appendChild(b); }); bar.style.display = 'flex';
}

/* ═════ 8. 주기 갱신 (0.2초 간격 · 가벼움) ═════ */
let acc = 0, inited = false;
NC.tickers.push(dt => {
  cheersCd -= dt; life.tipsy = Math.max(0, life.tipsy - dt / 90);
  acc += dt; if (acc < .2) return; acc = 0;
  if (!inited && NC.npcs && NC.npcs.length && NC.NPC && NC.NPC.sit) { inited = true; initBarGuests(); }
  vipWatch(); seatBar(); hudUpdate();
});
NC.on('stand', () => { clearTimeout(seatTimer); });
console.info('[life] 생활 기능: 조명 테마 ' + Object.keys(W.THEMES || {}).length + ' · 음악 ' + Object.keys(NC.Audio.STYLES || {}).length + ' · 바 의자 6 · 바 손님 2');
})();
