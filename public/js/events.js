/* events.js — v79 🎉 나이트 이벤트 매니저 + 상단 버튼(🎉 이벤트 · 📸 사진)
 *  ■ 실제 나이트에서 흔한 이벤트를 골라 넣음 — 한 번에 하나씩, 3~5분 뒤 처음, 그다음 6~10분마다 돌아가며(같은 이벤트 연속 없음)
 *     · 👑 댄싱 킹/퀸 (dance.js) — 이 매니저가 시작 시점을 정함
 *     · 🍾 샴페인 쇼 — 웨이터들이 불꽃(스파클러) 꽂은 샴페인을 들고 줄지어 테이블로 → 테이블 손님 환호 · 꽃가루
 *     · 🎂 생일 축하 — DJ가 오늘 생일인 손님을 부르고, 그 테이블에 촛불 케이크 · 핑크 조명 · 주변 손님 박수 → 촛불 끄기
 *       (가까이 가면 「🎂 생일 축하해 주기 (E)」 → 그 손님 호감도 +)
 *     · 🎁 럭키 드로우 — 화면에 손님 이름이 빠르게 돌아가다 멈춤 → 당첨자 스포트라이트. 내가 뽑히면 🪙 +100
 *     · 이벤트 중엔 디스코/블루스 타임과 겹치지 않음 · 내가 노래방 룸·모텔에 있으면 미룸
 *  ■ 상단 오른쪽 아이콘 버튼(⚙ 🔊 ❓ 옆)
 *     · 🎉 이벤트(진행 중이면 분홍 점): 진행 중 이벤트(👀 구경 가기) · 다음 이벤트까지 남은 시간 · 오늘 기록(댄싱 킹/퀸·럭키 드로우 당첨자) · 관리자는 ▶ 바로 시작
 *     · 📸 사진: 지금 화면을 '추억의 나이트' 프레임(날짜·장소)과 함께 찍어 미리 보기 → 💾 저장(PNG)
 *  NC.Events = { start(k), cur, next, log }
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.THREE) return;
const T = NC.THREE, U = NC.util, P = () => NC.player;
const now = () => performance.now() / 1000, pick = a => a[Math.floor(Math.random() * a.length)];
const bubble = (g, t, s = 2.6) => NC.bubble && NC.bubble(g, t, s);
const play = (g, k) => { try { NC.Motion && NC.Motion.play(g, k, { confetti: false }); } catch (e) { } };
const announce = (t, s, c) => { const F = NC.Features; if (F && F.announce) F.announce(t, s, c); else NC.ui.toast(t); };
const djSay = t => { if (NC.DJ) bubble(NC.DJ, t, 4); };
const confetti = (x, y, z, n) => { if (NC.fx && NC.fx.confetti) NC.fx.confetti(x, y, z, n); };
const isAdmin = () => !!(NC.account && NC.account.role === 'admin');
const TOP_Y = .9;   // 테이블 상판 높이(world.js)

const EV = NC.Events = { cur: null, next: now() + 180 + Math.random() * 120, log: [], deck: [] };
const KINDS = {
  dk: { icon: '👑', name: '댄싱 킹/퀸', desc: '무대 앞 원 가운데로 한 명씩 나와 30초 댄스 → 관객 점수 → 1등 헹가래' },
  champ: { icon: '🍾', name: '샴페인 쇼', desc: '웨이터들이 불꽃 샴페인을 들고 줄지어 테이블로' },
  bday: { icon: '🎂', name: '생일 축하', desc: '오늘 생일인 손님 테이블에 촛불 케이크 · 다 같이 축하' },
  lucky: { icon: '🎁', name: '럭키 드로우', desc: '손님 중 한 명 추첨 — 내가 뽑히면 🪙 +100' },
};

/* ── 공통: 손님이 앉아 있는 테이블 고르기 ── */
function seatedAt(t) { return (NC.npcs || []).filter(n => n.g && n.g.visible && (n.state === 'seated' || n.g.userData.seated) && Math.hypot(n.x - t.x, n.z - t.z) < 2.4); }
function pickTable() { const ts = (NC.tables || []).map(t => ({ t, ns: seatedAt(t) })).filter(o => o.ns.length); return ts.length ? pick(ts) : null; }
function sideOf(t, R = 1.55, k = 0) { const a = Math.atan2(0 - t.x, -4 - t.z) + k; return { x: t.x + Math.sin(a) * R, z: t.z + Math.cos(a) * R }; }   // 홀 가운데 쪽 통로에서 테이블로 접근

/* ── 소품: 스파클러(불꽃) ── */
const DOT = NC.softDot ? NC.softDot() : null;
function sparkler() {
  const N = 70, geo = new T.BufferGeometry(), pos = new Float32Array(N * 3); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  const m = new T.PointsMaterial({ size: .09, map: DOT, color: '#ffd98a', transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false });
  const p = new T.Points(geo, m); p.frustumCulled = false; p.userData.tick = () => { for (let i = 0; i < N; i++) { const r = Math.random() * .22, a = Math.random() * 6.283, y = Math.random() * .28; pos[i * 3] = Math.cos(a) * r * (1 - y * 2); pos[i * 3 + 1] = y + Math.random() * .04; pos[i * 3 + 2] = Math.sin(a) * r * (1 - y * 2); } geo.attributes.position.needsUpdate = true; m.size = .07 + Math.random() * .06; };
  return p;
}
function bottle() {
  const g = new T.Group();
  const glass = new T.MeshStandardMaterial({ color: '#0f3d22', roughness: .15, metalness: .3 }), gold = new T.MeshStandardMaterial({ color: '#d8b04a', roughness: .3, metalness: .9 });
  const b = new T.Mesh(new T.CylinderGeometry(.045, .05, .22, 14), glass); b.position.y = .11; g.add(b);
  const nk = new T.Mesh(new T.CylinderGeometry(.016, .04, .1, 12), glass); nk.position.y = .27; g.add(nk);
  const lb = new T.Mesh(new T.CylinderGeometry(.0505, .0505, .07, 14, 1, true), gold); lb.position.y = .1; g.add(lb);
  const fl = new T.Mesh(new T.CylinderGeometry(.018, .018, .05, 10), gold); fl.position.y = .33; g.add(fl);
  const sp = sparkler(); sp.position.y = .36; g.add(sp); g.userData.sp = sp; NC.scene.add(g); return g;
}
function cake() {
  const g = new T.Group(), cream = new T.MeshStandardMaterial({ color: '#fff4f6', roughness: .6 }), pink = new T.MeshStandardMaterial({ color: '#ff9cc7', roughness: .5 }), wax = new T.MeshStandardMaterial({ color: '#8fd3ff' });
  const plate = new T.Mesh(new T.CylinderGeometry(.24, .24, .012, 28), new T.MeshStandardMaterial({ color: '#f2f2f2', metalness: .4, roughness: .3 })); plate.position.y = .006; g.add(plate);
  const l1 = new T.Mesh(new T.CylinderGeometry(.19, .19, .11, 28), cream); l1.position.y = .067; g.add(l1);
  const r1 = new T.Mesh(new T.TorusGeometry(.19, .014, 8, 28), pink); r1.rotation.x = Math.PI / 2; r1.position.y = .12; g.add(r1);
  const l2 = new T.Mesh(new T.CylinderGeometry(.12, .12, .08, 24), pink); l2.position.y = .16; g.add(l2);
  const flames = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283, c = new T.Mesh(new T.CylinderGeometry(.007, .007, .07, 6), wax); c.position.set(Math.cos(a) * .075, .235, Math.sin(a) * .075); g.add(c);
    const f = new T.Mesh(new T.SphereGeometry(.013, 8, 6), new T.MeshBasicMaterial({ color: '#ffc45a', transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false })); f.position.set(c.position.x, .285, c.position.z); f.scale.y = 1.7; g.add(f); flames.push(f); }
  g.userData.flames = flames; NC.scene.add(g); return g;
}
const kill = o => { if (!o) return; NC.scene.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); };
const LATER = [];   // [t, fn] — 이벤트가 끝난 뒤 소품 치우기
const later = (sec, fn) => LATER.push([now() + sec, fn]);

/* ═════ 🍾 샴페인 쇼 ═════ */
function startChamp() {
  const ES = NC.Escort, TB = pickTable(); if (!ES || !ES.walkTo || !TB) return false;
  const ws = ES.list.filter(o => o.state === 'idle' && !o.n && o.g.visible).slice(0, 3); if (!ws.length) return false;
  const t = TB.t, E = EV.cur = { k: 'champ', t, ns: TB.ns, ws, T: 0, ph: 'go', at: { x: t.x, z: t.z } };
  ws.forEach((o, i) => { o.state = 'show'; o.n = null; o.dst = sideOf(t, 1.6, (i - (ws.length - 1) / 2) * .62); ES.walkTo(o, o.dst, 1.45); o.btl = bottle(); o.arrived = false; o.g.userData.hideLabel = false; });
  announce(`🍾 T${t.id + 1} 테이블 샴페인 쇼!! 🎆`, 6, '#ffd23d'); djSay(`T${t.id + 1} 테이블에서 샴페인 쇼 들어갑니다~!! 박수~!! 🍾🎆`);
  return true;
}
const _hv = new T.Vector3();
function handPos(o) { const r = o.g.userData.real, h = r && r.Bn && (r.Bn.handR || r.Bn.handL); if (h) { h.getWorldPosition(_hv); return _hv; } const y = o.g.rotation.y; return _hv.set(o.g.position.x + Math.sin(y) * .3 - Math.cos(y) * .2, 1.05, o.g.position.z + Math.cos(y) * .3 + Math.sin(y) * .2); }
function tickChamp(E, dt) {
  const ES = NC.Escort; let all = true;
  for (const o of E.ws) {
    if (o.btl) { o.btl.userData.sp.userData.tick(); if (!o.placed) { const h = handPos(o); o.btl.position.set(h.x, h.y - .02, h.z); } }
    if (E.ph === 'go') { if (o.state !== 'show') continue;
      if (!o.arrived) { if (ES.step(o, dt) || E.T > 40) { o.arrived = true; o.g.userData.moving = false; o.g.rotation.y = Math.atan2(E.t.x - o.x, E.t.z - o.z); play(o.g, 'cheer'); } else all = false; } }
  }
  if (E.ph === 'go' && all) { E.ph = 'show'; E.T2 = 0; confetti(E.t.x, 2.2, E.t.z, 110); E.ns.forEach((n, i) => setTimeout(() => { play(n.g, 'cheer'); bubble(n.g, pick(['와아~!! 🍾', '대박!! 🎆', '오늘 달린다~!!', '꺄~ 예쁘다!!']), 2.6); }, i * 300));
    (NC.npcs || []).filter(n => n.g.visible && n.state === 'wander' && Math.hypot(n.x - E.t.x, n.z - E.t.z) < 7).slice(0, 6).forEach(n => { n.g.rotation.y = Math.atan2(E.t.x - n.x, E.t.z - n.z); play(n.g, 'clap'); });
    if (NC.Features && NC.Features.borrowSpot) { try { NC.Features.borrowSpot('champ', '#ffe7a8', 4, .4); E.spot = true; } catch (e) { } } }
  if (E.ph === 'show') { E.T2 += dt;
    if (E.spot && NC.Features.spotTarget) { const tg = NC.Features.spotTarget(); if (tg) tg.position.set(E.t.x, 0, E.t.z); }
    if (E.T2 > 1.2 && E.T2 - dt <= 1.2) E.ws.forEach(o => play(o.g, 'cheer'));
    if (E.T2 > 4.5 && !E.put) { E.put = true; E.ws.forEach((o, i) => { o.placed = true; const a = i / Math.max(1, E.ws.length) * 6.283 + .4; o.btl.position.set(E.t.x + Math.cos(a) * .32, TOP_Y, E.t.z + Math.sin(a) * .32); }); }   // 테이블 위에 내려놓음(불꽃은 계속)
    if (E.T2 > 6) { E.ws.forEach(o => { ES.walkTo(o, o.home || { x: o.x, z: o.z + 3 }, 1.9); o.state = 'back'; const b = o.btl; o.btl = null; let tt = 0; const id = setInterval(() => { tt += .05; if (b.parent) b.userData.sp.userData.tick(); if (tt > 9) { clearInterval(id); b.userData.sp.visible = false; } }, 50); later(40, () => kill(b)); });
      if (E.spot) NC.Features.releaseSpot('champ'); return true; } }
  return false;
}
function stopChamp(E) { const ES = NC.Escort; E.ws.forEach(o => { if (o.btl) { kill(o.btl); o.btl = null; } if (o.state === 'show') { ES.walkTo(o, o.home || { x: o.x, z: o.z }, 1.9); o.state = 'back'; } }); if (E.spot) NC.Features.releaseSpot('champ'); }

/* ═════ 🎂 생일 축하 ═════ */
function startBday() {
  const TB = pickTable(); if (!TB) return false; const t = TB.t, n = pick(TB.ns);
  const c = cake(); c.position.set(t.x + (n.x - t.x) * .25, TOP_Y, t.z + (n.z - t.z) * .25);
  EV.cur = { k: 'bday', t, n, ns: TB.ns, cake: c, T: 0, at: { x: t.x, z: t.z }, wished: false };
  announce(`🎂 오늘 T${t.id + 1} 테이블 ${n.name}님 생일이에요!! 다 같이 축하해 주세요~ 🎉`, 7, '#ff8fd0');
  djSay(`오늘 생일이신 ${n.name}님~!! 생일 축하드려요~!! 🎂🎉 박수~!!`);
  if (NC.Features && NC.Features.borrowSpot) { try { NC.Features.borrowSpot('bday', '#ff7ac8', 4, .45); EV.cur.spot = true; } catch (e) { } }
  return true;
}
function tickBday(E, dt) {
  const n = E.n, fl = E.cake.userData.flames;
  if (E.spot && NC.Features.spotTarget) { const tg = NC.Features.spotTarget(); if (tg) tg.position.set(E.t.x, 0, E.t.z); }
  if (!E.blown) fl.forEach((f, i) => { f.scale.set(1 + Math.random() * .25, 1.5 + Math.random() * .5, 1); f.material.opacity = .75 + Math.random() * .25; });
  const at = (s) => E.T > s && E.T - dt <= s;
  if (at(1.5)) { E.ns.forEach((m, i) => { if (m !== n) setTimeout(() => { play(m.g, 'clap'); bubble(m.g, pick(['생일 축하해~!! 🎂', '축하축하~ 🎉', '오늘 주인공이다~!!']), 2.6); }, i * 280); }); bubble(n.g, '꺄~ 고마워요!! 😭💗', 3); }
  if (E.T > 3 && E.T < 10 && Math.random() < dt * 1.2) { const m = pick((NC.npcs || []).filter(x => x.g.visible && x.state === 'wander' && Math.hypot(x.x - E.t.x, x.z - E.t.z) < 8)); if (m) { m.g.rotation.y = Math.atan2(E.t.x - m.x, E.t.z - m.z); play(m.g, 'clap'); if (Math.random() < .4) bubble(m.g, pick(['생일 축하해요~ 🎉', '해피 버스데이~!!', '축하해요!! 👏']), 2); } }
  if (at(8.5)) { bubble(n.g, '소원 빌고~ 후우~~ 🎂', 2.4); }
  if (at(10)) { E.blown = true; fl.forEach(f => { f.visible = false; }); confetti(E.t.x, 2.1, E.t.z, 130); play(n.g, 'cheer'); E.ns.forEach(m => m !== n && play(m.g, 'cheer')); announce(`🎉 ${n.name}님 생일 축하합니다~!! 🎂`, 4, '#ff8fd0'); }
  if (E.T > 14) { if (E.spot) NC.Features.releaseSpot('bday'); const c = E.cake; later(45, () => kill(c)); return true; }
  return false;
}
function stopBday(E) { if (E.spot) NC.Features.releaseSpot('bday'); kill(E.cake); }
(NC.interactProviders = NC.interactProviders || []).push(() => {   // 가까이 가면 축하 건네기
  const E = EV.cur, p = P(); if (!E || E.k !== 'bday' || E.wished || !p) return [];
  const d = Math.hypot(E.n.x - p.x, E.n.z - p.z); if (d > 3.2) return [];
  return [{ label: `🎂 ${E.n.name}님 생일 축하해 주기 (E)`, dist: d - .5, run: () => { E.wished = true; play(p.group, 'clap'); bubble(E.n.g, pick(['어머 고마워요~!! 💗', '헤헤 감동이다 ㅠㅠ 고마워요!']), 3); E.n.aff = U.clamp((E.n.aff || 40) + 8, 0, 100); NC.ui.toast(`💗 ${E.n.name} 호감도 +8`); } }];
});

/* ═════ 🎁 럭키 드로우 ═════ */
const roll = document.createElement('div'); roll.id = 'evRoll';
roll.style.cssText = 'position:fixed;left:50%;top:34%;transform:translate(-50%,-50%);z-index:62;display:none;padding:14px 30px;border-radius:18px;background:rgba(18,10,34,.88);border:2px solid #ffd23d;color:#fff;font:800 30px/1.2 inherit;text-align:center;box-shadow:0 0 30px #ffd23d66;min-width:260px';
document.body.appendChild(roll);
function startLucky() {
  const pool = (NC.npcs || []).filter(n => n.g && n.g.visible && n.role !== 'staff' && n.enabled !== false); if (pool.length < 5) return false;
  const p = P(), meOK = p && p.group && !p.busy, win = meOK && Math.random() < .35 ? { me: true, name: (NC.settings && NC.settings.name) || '나', g: p.group } : (() => { const n = pick(pool); return { n, name: n.name, g: n.g }; })();
  EV.cur = { k: 'lucky', pool, win, T: 0, next: 0, at: { x: win.g.position.x, z: win.g.position.z } };
  announce('🎁 럭키 드로우!! 오늘의 행운의 주인공은~?', 4, '#ffd23d'); djSay('자~ 럭키 드로우 시간!! 두구두구두구~ 🥁');
  roll.style.display = 'block'; return true;
}
function tickLucky(E, dt) {
  if (E.T < 4.2) { E.next -= dt; if (E.next <= 0) { E.next = .07 + E.T * .045; roll.innerHTML = `🎁 <span style="color:#ffd23d">${pick(E.pool).name}</span>`; } return false; }
  if (!E.done) { E.done = true; const w = E.win; roll.innerHTML = `🎉 당첨!! <span style="color:#ffd23d">${w.name}</span>${w.me ? '<br><span style="font-size:18px">🪙 +100 코인!</span>' : ''}`;
    announce(`🎁 럭키 드로우 당첨 — ${w.name}!! 축하합니다~ 🎉`, 5, '#ffd23d'); djSay(`당첨~!! ${w.name}님 축하드려요~!! 🎉`);
    const x = w.g.position.x, z = w.g.position.z; confetti(x, 2.2, z, 120); play(w.g, 'cheer'); EV.cur.at = { x, z };
    if (w.me) { NC.Wallet && NC.Wallet.add(100, '럭키 드로우 당첨'); } else bubble(w.g, pick(['헐 대박!! 저요?? 😆', '오예~!! 🎉', '꺄~ 오늘 운 좋다!!']), 3);
    (NC.npcs || []).filter(n => n.g.visible && n !== w.n && n.state === 'wander' && Math.hypot(n.x - x, n.z - z) < 6).slice(0, 5).forEach(n => { n.g.rotation.y = Math.atan2(x - n.x, z - n.z); play(n.g, 'clap'); });
    if (NC.Features && NC.Features.borrowSpot) { try { NC.Features.borrowSpot('lucky', '#ffffff', 3, .35); E.spot = true; } catch (e) { } } }
  if (E.spot && NC.Features.spotTarget) { const tg = NC.Features.spotTarget(); if (tg) tg.position.set(E.win.g.position.x, 0, E.win.g.position.z); }
  if (E.T > 9.5) { roll.style.display = 'none'; if (E.spot) NC.Features.releaseSpot('lucky'); EV.log.push({ k: 'lucky', name: E.win.name, me: !!E.win.me, at: Date.now() }); return true; }
  return false;
}
function stopLucky(E) { roll.style.display = 'none'; if (E.spot) NC.Features.releaseSpot('lucky'); }

/* ═════ 매니저 ═════ */
const ST = { champ: [startChamp, tickChamp, stopChamp], bday: [startBday, tickBday, stopBday], lucky: [startLucky, tickLucky, stopLucky] };
function busy() { const p = P(); return (NC.Party && NC.Party.mode) || (NC.DanceKing && NC.DanceKing.phase) || (NC.Karaoke && NC.Karaoke.inRoom) || (NC.Motel && NC.Motel.on) || (NC.Features && NC.Features.mode) || (NC.DanceShow && NC.DanceShow.on) || !p || !p.group; }
EV.start = (k, force) => {
  if (EV.cur || (NC.DanceKing && NC.DanceKing.phase)) return false; if (!force && busy()) return false;
  let ok = false;
  if (k === 'dk') ok = !!(NC.DanceKing && NC.DanceKing.start());
  else if (ST[k]) ok = ST[k][0]();
  if (ok) { if (k === 'dk') EV.cur = { k: 'dk', T: 0, at: { x: 0, z: -9.4 } }; EV.cur.k = k; EV.last = k; EV.log.push({ k, at: Date.now(), start: true }); console.info('[events] 시작', k); draw(); }
  return ok;
};
EV.stop = () => { const E = EV.cur; if (!E) return; if (E.k === 'dk') { NC.DanceKing && NC.DanceKing.stop(); } else if (ST[E.k]) ST[E.k][2](E); EV.cur = null; EV.next = now() + 360 + Math.random() * 240; draw(); };
function nextKind() { if (!EV.deck.length) EV.deck = Object.keys(KINDS).sort(() => Math.random() - .5); let k = EV.deck.shift(); if (k === EV.last && EV.deck.length) { EV.deck.push(k); k = EV.deck.shift(); } return k; }
function tick(dt) {
  dt = Math.min(dt || .016, .1);
  for (let i = LATER.length - 1; i >= 0; i--) if (now() > LATER[i][0]) { try { LATER[i][1](); } catch (e) { } LATER.splice(i, 1); }
  if (NC.DanceKing) NC.DanceKing.next = Infinity;   // 댄싱 킹/퀸 시작도 이 매니저가 정함
  const E = EV.cur;
  if (E) { dt *= EV.ts || 1; E.T += dt;   // EV.ts: 시험용 시간 배율
    if (E.k === 'dk') { if (!NC.DanceKing.phase) { EV.cur = null; EV.next = now() + 360 + Math.random() * 240; draw(); } return; }
    let done = false; try { done = ST[E.k][1](E, dt); } catch (e) { console.error('[events]', e); done = true; try { ST[E.k][2](E); } catch (e2) { } }
    if (done || E.T > 90) { EV.cur = null; EV.next = now() + 360 + Math.random() * 240; draw(); }
    return; }
  if (!NC.started || now() < EV.next) return;
  if (busy()) { EV.next = now() + 45; return; }
  const k = nextKind(); if (!EV.start(k)) { EV.next = now() + 30; }
}
NC.tickers.push(dt => { try { tick(dt); } catch (e) { console.error('[events]', e); } });

/* ═════ 상단 버튼 + 패널 ═════ */
/* 상단 오른쪽 아이콘 줄(⚙ 🔊 ❓ 옆)에 둠 — 가운데 디스코/블루스/웨이터 줄은 이미 넓어서 더 늘리면 오른쪽 아이콘을 가림 */
const mk = (id, txt, title) => { const b = document.createElement('button'); b.id = id; b.className = 'ibtn'; b.textContent = txt; b.title = title; b.style.position = 'relative'; return b; };
const bEv = mk('pbEvents', '🎉', '🎉 나이트 이벤트 — 진행 중·다음 이벤트·오늘 기록'), bPh = mk('pbPhoto', '📸', '📸 기념사진 — 지금 화면을 사진으로 저장');
const dot = document.createElement('span'); dot.style.cssText = 'position:absolute;right:3px;top:3px;width:9px;height:9px;border-radius:50%;background:#ff3d9a;box-shadow:0 0 8px #ff3d9a;display:none'; bEv.appendChild(dot);
function mount() { const tb = document.getElementById('topbtns'); if (!tb) return false; if (!bEv.parentNode) { tb.insertBefore(bPh, tb.firstChild); tb.insertBefore(bEv, tb.firstChild); } return true; }
if (!mount()) { const id = setInterval(() => { if (mount()) clearInterval(id); }, 500); }
const pane = document.createElement('div'); pane.id = 'evPane';
pane.style.cssText = 'position:fixed;right:14px;top:62px;z-index:70;display:none;width:300px;max-height:72vh;overflow:auto;padding:12px 14px;border-radius:14px;background:rgba(16,10,30,.94);border:1px solid rgba(255,93,170,.5);color:#fff;font:13px/1.45 inherit;box-shadow:0 8px 30px #000a';
document.body.appendChild(pane);
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function draw() {
  dot.style.display = EV.cur ? '' : 'none'; bEv.title = EV.cur ? `🎉 ${KINDS[EV.cur.k].name} 진행 중 — 눌러서 구경 가기` : '🎉 나이트 이벤트 — 진행 중·다음 이벤트·오늘 기록';
  if (pane.style.display === 'none') return;
  const A = isAdmin(), DK = NC.DanceKing, wins = ((DK && DK.winners) || []).slice(-5).reverse(), lucky = EV.log.filter(l => l.k === 'lucky' && l.name).slice(-5).reverse();
  const cur = EV.cur ? `<div style="margin:6px 0;padding:8px;border-radius:10px;background:rgba(255,93,170,.18)"><b>${KINDS[EV.cur.k].icon} ${KINDS[EV.cur.k].name}</b> 진행 중<br><button data-a="go" style="margin-top:6px">👀 구경 가기</button>${A ? ' <button data-a="stop">⏹ 끝내기</button>' : ''}</div>`
    : `<div style="margin:6px 0;opacity:.85">다음 이벤트까지 약 <b>${mmss(EV.next - now())}</b></div>`;
  pane.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px">🎉 나이트 이벤트</b><button data-a="x">✕</button></div>${cur}
    <div style="margin-top:8px;font-weight:700">이벤트 종류</div>${Object.entries(KINDS).map(([k, v]) => `<div style="margin:5px 0;padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.06)">${v.icon} <b>${v.name}</b>${A && !EV.cur ? ` <button data-a="run" data-k="${k}" style="float:right">▶ 시작</button>` : ''}<br><span style="opacity:.75;font-size:12px">${v.desc}</span></div>`).join('')}
    <div style="margin-top:8px;font-weight:700">오늘 기록</div>
    <div style="font-size:12px;opacity:.9">${wins.length ? wins.map(w => `👑 댄싱 ${w.title} ${w.name}${w.me ? ' (나)' : ''} · ${w.score}점`).join('<br>') : '👑 아직 댄싱 킹/퀸 없음'}<br>${lucky.length ? lucky.map(l => `🎁 럭키 드로우 ${l.name}${l.me ? ' (나)' : ''}`).join('<br>') : '🎁 아직 당첨자 없음'}</div>
    ${A ? '<div style="margin-top:8px;font-size:11px;opacity:.6">관리자: ▶ 로 바로 시작할 수 있어요</div>' : ''}`;
  pane.querySelectorAll('button').forEach(b => { b.style.cssText = (b.style.cssText || '') + ';border:0;border-radius:8px;padding:3px 9px;background:#ff3d9a;color:#fff;font:700 12px inherit;cursor:pointer'; });
}
bEv.onclick = e => { e.stopPropagation(); pane.style.display = pane.style.display === 'none' ? 'block' : 'none'; draw(); };
pane.onclick = e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); const a = b.dataset.a;
  if (a === 'x') { pane.style.display = 'none'; return; }
  if (a === 'run') { if (!EV.start(b.dataset.k, true)) NC.ui.toast('지금은 시작할 수 없어요 (다른 이벤트·룸 안·손님 부족)'); }
  if (a === 'stop') EV.stop();
  if (a === 'go' && EV.cur) goWatch();
  draw(); };
function goWatch() {
  const E = EV.cur, p = P(); if (!E || !p || !NC.walkPlayer) return; const at = E.at || { x: 0, z: -9.4 };
  const dx = p.x - at.x, dz = p.z - at.z, d = Math.hypot(dx, dz) || 1, R = E.k === 'dk' ? 4.4 : 2.6, s = { x: at.x + dx / d * R, z: at.z + dz / d * R };
  let path = [s]; try { if (NC.Path && NC.Path.find) path = NC.Path.find({ x: p.x, z: p.z }, s) || path; } catch (e) { }
  NC.walkPlayer(path, () => { p.ry = Math.atan2(at.x - p.x, at.z - p.z); p.group.rotation.y = p.ry; }); pane.style.display = 'none'; NC.ui.toast('👀 이벤트 구경하러 가요');
}
setInterval(draw, 1000);

/* ═════ 📸 사진 ═════ */
function snap() {
  const R = NC.renderer; if (!R) return;
  (NC.render || ((s, c) => R.render(s, c)))(NC.scene, NC.camera);   // 같은 틱에 읽어야 빈 화면이 안 나옴(preserveDrawingBuffer 없이)
  const src = R.domElement, c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const k = c.height / 720, d = new Date(), zone = (document.getElementById('zone') || {}).textContent || '';
  const gr = x.createLinearGradient(0, c.height - 80 * k, 0, c.height); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.65)'); x.fillStyle = gr; x.fillRect(0, c.height - 80 * k, c.width, 80 * k);
  x.font = `800 ${26 * k}px sans-serif`; x.fillStyle = '#ff7ac8'; x.shadowColor = '#ff3d9a'; x.shadowBlur = 12 * k; x.fillText('🪩 추억의 나이트', 18 * k, c.height - 22 * k);
  x.shadowBlur = 0; x.font = `600 ${16 * k}px sans-serif`; x.fillStyle = '#fff'; x.textAlign = 'right'; x.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}  ${zone}`, c.width - 18 * k, c.height - 24 * k);
  const url = c.toDataURL('image/png'), fn = `night_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}.png`;
  const m = document.createElement('div'); m.id = 'photoModal'; m.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px';
  m.innerHTML = `<img src="${url}" style="max-width:86vw;max-height:72vh;border-radius:12px;border:3px solid #fff;box-shadow:0 10px 40px #000"><div style="display:flex;gap:10px"><a download="${fn}" href="${url}" style="padding:9px 20px;border-radius:999px;background:linear-gradient(90deg,#ff3d9a,#8a3dff);color:#fff;font-weight:800;text-decoration:none">💾 저장</a><button type="button" style="padding:9px 20px;border:0;border-radius:999px;background:#444a63;color:#fff;font-weight:800;cursor:pointer">닫기</button></div>`;
  m.querySelector('button').onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); }; document.body.appendChild(m);
  const fl = document.createElement('div'); fl.style.cssText = 'position:fixed;inset:0;z-index:89;background:#fff;opacity:.85;transition:opacity .35s;pointer-events:none'; document.body.appendChild(fl); requestAnimationFrame(() => { fl.style.opacity = '0'; setTimeout(() => fl.remove(), 400); });
  EV.lastPhoto = { w: c.width, h: c.height, bytes: url.length };
}
bPh.onclick = e => { e.stopPropagation(); snap(); };
NC.snapPhoto = snap;
console.info('[events] v79 나이트 이벤트 매니저 · 🎉 이벤트 · 📸 사진');
})();
