/* features.js — v18 신규 인터랙션 5종
 *  ① 무아지경 시그니처 댄스 (Stage Breakdown Dance): 무대 또는 테이블 위에서 E → 비트에 맞춰 춤 스타일이 바뀌는 화려한 모션,
 *     머리 위 스팟 조명이 따라오고 주변 손님들이 환호 이모지(🔥👏😍🙌💯)를 띄움. 8박마다 피니시 포즈 + 조명 플래시
 *  ② 샴페인 폭죽 쇼 (Champagne Celebration): VIP 룸에서 E → 전광판·상단 배너 알림 → 웨이터 3명이 스파클러 병을 들고
 *     계단을 올라 행진 → 테이블에서 샴페인 터뜨리기 파티클 + 샴페인 샤워 → 룸 손님 환호
 *  ③ 가상 DJ 믹싱 (DJ Booth Takeover): DJ 부스 앞에서 E → DJ 단 위로 올라가 믹싱 모션, 패널로 필터(로우패스)·베이스·
 *     조명 색 파형·음악 스타일·드롭·스크래치를 직접 제어
 *  ④ 파우더룸 칭찬·소품 공유 (Powder Room Compliment): 여자 화장실 파우더룸 손님 2명에게 칭찬(하트 이펙트)·소품 주고받기(포물선 애니메이션)
 *  ⑤ 바닥 수색 (Floor Item Search): 오른쪽 아래 🔦 → 쪼그려 앉아 휴대폰 플래시로 바닥을 비추며 숨겨진 한정판 아이템 3개를 40초 안에 찾기
 *  조명은 새로 만들지 않고 미러볼 스팟을 잠시 빌려 씀(광원 추가 = 셰이더 재컴파일 = 프레임 끊김 방지)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world) return;
const T = NC.THREE, U = NC.util, W = NC.world, Mo = NC.Motion, P = () => NC.player;
const pk = a => a[Math.floor(Math.random() * a.length)];
const B = (g, t, s) => NC.bubble && NC.bubble(g, t, s);
const online = () => NC.isOnline && NC.isOnline();
const A = () => NC.Audio;

/* ── 공용: 이모지 스프라이트 · 파티클 · 스팟 빌리기 · 배너 ── */
const emoTex = {};
function emojiSprite(e, size = .45) {
  if (!emoTex[e]) { const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d'); c.font = '76px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 48, 54); emoTex[e] = new T.CanvasTexture(cv); }
  const sp = new T.Sprite(new T.SpriteMaterial({ map: emoTex[e], transparent: true, depthWrite: false })); sp.scale.set(size, size, 1); return sp;
}
const floaters = [];
function floatEmoji(x, y, z, e, life = 1.8) { const sp = emojiSprite(e, .38 + Math.random() * .2); sp.position.set(x + (Math.random() - .5) * .4, y, z + (Math.random() - .5) * .4); NC.scene.add(sp); floaters.push({ sp, t: 0, life, vx: (Math.random() - .5) * .3 }); }
const bursts = [];
function burst(x, y, z, o = {}) {   // 파티클 폭발/분사: Points + 속도·중력
  const n = o.n || 120, pos = new Float32Array(n * 3), colr = new Float32Array(n * 3), vel = [], c = new T.Color();
  const cols = o.colors || ['#fff6d0', '#ffd23d', '#ffffff'];
  for (let i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; const a = Math.random() * Math.PI * 2, up = (o.up || 3) * (.5 + Math.random()), sp = (o.spread || 1.2) * Math.random();
    vel.push([Math.cos(a) * sp, up, Math.sin(a) * sp]); c.set(pk(cols)).multiplyScalar(1.6); colr[i * 3] = c.r; colr[i * 3 + 1] = c.g; colr[i * 3 + 2] = c.b; }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(colr, 3));
  const pts = new T.Points(geo, new T.PointsMaterial({ size: o.size || .07, map: NC.softDot ? NC.softDot() : null, vertexColors: true, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false }));
  NC.scene.add(pts); bursts.push({ pts, vel, t: 0, life: o.life || 2.4, g: o.g == null ? 3.2 : o.g, rain: o.rain ? { x, y, z, r: o.rain } : null });
}
const SPOT = { owner: null };
function borrowSpot(owner, color = '#ffffff', intensity = 3, angle = .32) {
  const L = W.lights && W.lights.ball; if (!L) return null; if (!SPOT.owner) Object.assign(SPOT, { color: L.color.clone(), intensity: L.intensity, angle: L.angle, distance: L.distance, pos: L.position.clone(), target: L.target, penumbra: L.penumbra });
  SPOT.owner = owner; L.color.set(color); L.intensity = intensity; L.angle = angle; L.distance = 30; L.penumbra = .45;
  if (!SPOT.tg) { SPOT.tg = new T.Object3D(); NC.scene.add(SPOT.tg); } L.target = SPOT.tg; return L;
}
function releaseSpot(owner) { const L = W.lights && W.lights.ball; if (!L || SPOT.owner !== owner) return; L.color.copy(SPOT.color); L.intensity = SPOT.intensity; L.angle = SPOT.angle; L.distance = SPOT.distance; L.penumbra = SPOT.penumbra; L.position.copy(SPOT.pos); L.target = SPOT.target; SPOT.owner = null; }
W.spotBorrowed = () => !!SPOT.owner;   // world.js 가 매 프레임 미러볼 스팟 세기를 덮어쓰지 않도록
const banner = document.createElement('div'); banner.id = 'fxBanner'; document.body.appendChild(banner);
function announce(text, sec = 6, color = '#ffd23d') { banner.textContent = text; banner.style.setProperty('--c', color); banner.classList.remove('on'); void banner.offsetWidth; banner.classList.add('on'); clearTimeout(announce.t); announce.t = setTimeout(() => banner.classList.remove('on'), sec * 1000); W.ledMessage && W.ledMessage(text, sec, color); }
const sfx = (f, d, v) => { const a = A(); if (a && a.ctx && a.hit) a.hit(a.ctx.currentTime, f, d, v, a.sfxBus); };
const nearCrowd = (x, z, r) => (NC.npcs || []).filter(n => n.g.visible && n.state !== 'off' && Math.hypot(n.x - x, n.z - z) < r);
const busyNow = () => { const p = P(); return !p.group || p.busy || (NC.Dialog && NC.Dialog.cur) || FX.mode; };
const FX = NC.Features = { mode: null };

/* ═════ ① 무아지경 시그니처 댄스 ═════ */
const STYLES = ['breaking', 'robot', 'disco', 'techno', 'hipSway', 'pump', 'vogue', 'runMan', 'bodyRoll', 'hairFlip'];
const SIG = { t: 0, dur: 16, lastBeat: -1, table: null, saved: null };
function sigStart(table) {
  const p = P(), u = p.group.userData; if (p.seat) NC.requestStand && NC.requestStand();
  FX.mode = 'sig'; p.busy = true; p.target = null; p.autoPath = null; SIG.t = 0; SIG.lastBeat = -1; SIG.table = table; SIG.saved = { ds: u.danceStyle, dance: u.dance };
  if (table != null) { const t = NC.tables[table]; p.x = t.x; p.z = t.z; NC.groundOverride = () => .82; }
  u.dance = 'stageDance'; u.danceStyle = pk(STYLES); borrowSpot('sig', '#ffffff', 4, .28);
  if (NC.cam) { SIG.cam = Object.assign({}, NC.cam); Object.assign(NC.cam, { yaw: 0, pitch: .42, dist: 7.5 }); }   // 관객석(남쪽)에서 무대를 바라보는 앵글
  announce(table != null ? `🔥 T${table + 1} 테이블 위 무아지경 댄스!!` : '🔥 무대 위 무아지경 시그니처 댄스!!', 5, '#ff3d9a');
  nearCrowd(p.x, p.z, 14).forEach((n, i) => setTimeout(() => { if (n.state === 'seated' || n.state === 'wander' || n.state === 'party') { n.g.userData.lookAt = p.group.position; Mo.play(n.g, pk(['cheer', 'clap'])); } }, i * 90));
}
function sigTick(dt) {
  const p = P(), u = p.group.userData, L = W.lights.ball, b = A() && A().beat ? A().beat() : { n: Math.floor(SIG.t * 2), phase: (SIG.t * 2) % 1 };
  SIG.t += dt; SPOT.tg.position.set(p.x, p.y, p.z); L.position.set(p.x + .5, p.y + 8, p.z + 1.5); L.color.setHSL((SIG.t * .15 + b.n * .05) % 1, .7, .7); L.intensity = 3.5 + 2.5 * (1 - b.phase);
  if (b.n !== SIG.lastBeat) { SIG.lastBeat = b.n;
    if (b.n % 4 === 0) u.danceStyle = pk(STYLES);                                                   // 4박마다 춤 스타일 전환
    if (b.n % 8 === 0) { Mo.play(p.group, pk(['cheer', 'point'])); burst(p.x, p.y + 2.2, p.z, { n: 60, colors: ['#ff3d9a', '#3de6ff', '#ffd23d', '#ffffff'], up: 2.2, spread: 1.6, life: 1.4, size: .06 }); }   // 피니시 포즈 + 반짝임
    const crowd = nearCrowd(p.x, p.z, 13); if (crowd.length) for (let k = 0; k < 2; k++) { const n = pk(crowd); floatEmoji(n.x, n.g.position.y + 2.3, n.z, pk(['🔥', '👏', '😍', '🙌', '💯', '😱', '✨'])); if (Math.random() < .3) Mo.play(n.g, pk(['cheer', 'clap'])); }
    if (b.n % 2 === 0) floatEmoji(p.x, p.y + 2.4, p.z, pk(['🔥', '💥', '⭐'])); }
  if (SIG.t >= SIG.dur) sigEnd();
}
function sigEnd() {
  const p = P(), u = p.group.userData; if (NC.cam && SIG.cam) Object.assign(NC.cam, SIG.cam); u.danceStyle = SIG.saved.ds; u.dance = SIG.saved.dance || null; releaseSpot('sig'); NC.groundOverride = null;
  if (SIG.table != null) { const sp = NC.standPos(SIG.table, 0); p.x = sp.x; p.z = sp.z; }
  p.busy = false; FX.mode = null; NC.Wallet.add(15, '무아지경 댄스 환호'); Mo.play(p.group, 'bow');
  nearCrowd(p.x, p.z, 14).forEach(n => { if (n.g.userData.lookAt === p.group.position) n.g.userData.lookAt = null; });
}

/* ═════ ② 샴페인 폭죽 쇼 ═════ */
const CH = { ws: [], phase: null, room: -1, t: 0 };
const waiterLook = k => ({ gender: k === 1 ? 'f' : 'm', top: 'vest', topColor: '#121018', bottom: 'pants', bottomColor: '#121018', hairStyle: k === 1 ? 'highPony' : 'slick', hairColor: '#17110f', shoes: 'boots' });
function chWaiters() {
  if (!CH.ws.length) for (let k = 0; k < 3; k++) { const g = NC.Avatar.create({ name: ['웨이터 「번개」', '웨이터 「반짝」', '웨이터 「쾌남」'][k], look: waiterLook(k), seed: 900 + k, labelColor: '#ffd23d' }); g.visible = false; NC.scene.add(g);
    const sp = emojiSprite('🍾', .32); sp.position.set(0, 2.15, 0); g.add(sp); const fl = emojiSprite('✨', .5); fl.position.set(.12, 2.5, 0); g.add(fl); g.userData.spark = fl; CH.ws.push({ g, path: null }); }
  return CH.ws;
}
function chStart() {
  const p = P(), room = p.room; if (room < 0) return NC.ui.toast('VIP 룸 안에서만 할 수 있어요');
  if (CH.phase) return NC.ui.toast('지금 샴페인 쇼가 진행 중이에요'); if (!NC.Wallet.spend(80)) return NC.ui.toast('🪙 80 코인이 필요해요');
  const v = W.vip[room], ws = chWaiters(), start = { x: -20.5, z: W.corridorY || 10.75 };
  CH.room = room; CH.phase = 'march'; CH.t = 0; announce(`🍾 VIP ${room + 1} 룸 샴페인 폭죽 쇼!! 🎉`, 8, '#ffd23d');
  ws.forEach((w, i) => { w.g.visible = true; w.g.position.set(start.x - i * 1.1, 0, start.z); const dest = { x: v.cx - 1.2 + i * 1.2, z: v.z0 + .9 }; w.path = NC.Path ? (NC.Path.find({ x: start.x - i * 1.1, z: start.z }, dest, { exact: true }) || [dest]) : [dest]; w.delay = i * .9; w.done = false; });
  sfx(880, .25, .2); setTimeout(() => sfx(1320, .25, .2), 250);
}
function chTick(dt) {
  CH.t += dt; const v = W.vip[CH.room];
  if (CH.phase === 'march') {
    let all = true; CH.ws.forEach(w => { if (w.done) return; if ((w.delay -= dt) > 0) { all = false; return; } const p = w.path[0]; if (!p) { w.done = true; w.g.userData.moving = false; w.g.rotation.y = Math.atan2(v.table.x - w.g.position.x, v.table.z - w.g.position.z); return; }
      all = false; const dx = p.x - w.g.position.x, dz = p.z - w.g.position.z, d = Math.hypot(dx, dz); if (d < .25) { w.path.shift(); return; } const k = Math.min(1, 1.9 * dt / d);
      w.g.position.x += dx * k; w.g.position.z += dz * k; w.g.position.y = NC.groundY(w.g.position.x, w.g.position.z); w.g.rotation.y = U.lerpAngle(w.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8)); w.g.userData.moving = true;
      if (Math.random() < dt * 6) { const s = w.g.userData.spark; s.material.rotation += .6; s.scale.setScalar(.35 + Math.random() * .3); } });
    if (all || CH.t > 40) { CH.phase = 'pop'; CH.t = 0; CH.ws.forEach(w => Mo.play(w.g, 'bow')); }
  } else if (CH.phase === 'pop' && CH.t > 1.2) {
    const y = v.y + .7; v.champ.visible = true; sfx(180, .3, .5); setTimeout(() => sfx(2400, .5, .15), 60);
    burst(v.table.x + 1.2, y + .3, v.table.z, { n: 220, colors: ['#fff6d0', '#ffe9a0', '#ffffff', '#ffd23d'], up: 5.5, spread: 1.6, life: 2.6, size: .08 });              // 뻥! 폭죽처럼 솟는 샴페인
    burst(v.table.x, y + 3.4, v.table.z, { n: 260, colors: ['#fff8e0', '#ffffff', '#ffeeb0'], up: .2, spread: 2.2, life: 4.2, size: .05, g: 1.4, rain: 2.6 });   // 샴페인 샤워
    (NC.npcs || []).filter(n => W.vipAt(n.x, n.z) === CH.room).concat([]).forEach((n, i) => setTimeout(() => { Mo.play(n.g, 'cheer'); B(n.g, pk(['꺄아~ 🍾', '샴페인 샤워!!', '최고야!! 🎉']), 1.8); }, 200 + i * 180));
    Mo.play(P().group, 'cheer'); CH.ws.forEach((w, i) => setTimeout(() => { Mo.play(w.g, 'cheer'); B(w.g, pk(['축하드립니다!! 🎉', '오늘의 VIP!! 👑', '샴페인 샤워~ 🥂']), 2); }, i * 300));
    CH.phase = 'party'; CH.t = 0;
  } else if (CH.phase === 'party' && CH.t > 6) {
    CH.phase = 'leave'; CH.t = 0; const back = { x: -20.5, z: W.corridorY || 10.75 }; CH.ws.forEach((w, i) => { w.path = NC.Path ? (NC.Path.find({ x: w.g.position.x, z: w.g.position.z }, back) || [back]) : [back]; w.done = false; w.delay = i * .5; });
    NC.Wallet.add(0, ''); NC.ui.toast('🍾 샴페인 쇼 완료! VIP 의 밤 ✨');
  } else if (CH.phase === 'leave') {
    let all = true; CH.ws.forEach(w => { if (w.done) return; if ((w.delay -= dt) > 0) { all = false; return; } const p = w.path[0]; if (!p) { w.done = true; w.g.visible = false; return; } all = false;
      const dx = p.x - w.g.position.x, dz = p.z - w.g.position.z, d = Math.hypot(dx, dz); if (d < .25) { w.path.shift(); return; } const k = Math.min(1, 2.4 * dt / d); w.g.position.x += dx * k; w.g.position.z += dz * k; w.g.position.y = NC.groundY(w.g.position.x, w.g.position.z); w.g.rotation.y = Math.atan2(dx, dz); w.g.userData.moving = true; });
    if (all || CH.t > 40) { CH.ws.forEach(w => { w.g.visible = false; }); CH.phase = null; }
  }
  CH.ws.forEach(w => { if (w.g.visible) { Mo.update(w.g, dt, { near: true, speed: 1 }); NC.Avatar.fitLabel(w.g, NC.camera); } });
}

/* ═════ ③ 가상 DJ 믹싱 (DJ Booth Takeover) ═════ */
const DJ = { saved: null };
const djPanel = document.createElement('div'); djPanel.id = 'djPanel'; djPanel.style.display = 'none';
djPanel.innerHTML = `<div class="djh"><b>🎧 DJ 부스 테이크오버</b><button id="djExit" class="mClose" title="내려가기">✕</button></div>
  <label>🎛 필터 (로우패스) <span id="djLPv"></span><input id="djLP" type="range" min="0" max="100" value="100"></label>
  <label>🔊 베이스 부스트 <span id="djBassv"></span><input id="djBass" type="range" min="-6" max="12" value="0"></label>
  <label>🌈 조명 색 <span id="djHuev"></span><input id="djHue" type="range" min="0" max="360" value="300"></label>
  <div class="djrow"><button id="djWave" class="on">〰 컬러 파형</button><button id="djDrop">💥 드롭!</button><button id="djScratch">💿 스크래치</button></div>
  <div class="djrow" id="djStyles"></div><p class="djn">슬라이더를 움직이면 클럽 전체 음악 필터·베이스와 조명 색이 바로 바뀌어요</p>`;
document.body.appendChild(djPanel);
const dq = s => djPanel.querySelector(s);
function djStart() {
  const p = P(), u = p.group.userData, d = W.spots.dj; FX.mode = 'dj'; p.busy = true; p.target = null; p.autoPath = null;
  DJ.saved = { x: p.x, z: p.z, dance: u.dance, djPos: NC.DJ ? NC.DJ.position.clone() : null };
  p.x = d.x + .9; p.z = d.z; p.ry = 0; p.group.rotation.y = 0; u.dance = 'djMix';
  if (NC.cam) { DJ.cam = Object.assign({}, NC.cam); Object.assign(NC.cam, { yaw: 0, pitch: .32, dist: 6.5 }); }
  if (NC.DJ) { NC.DJ.position.x = d.x - 2.6; B(NC.DJ, '오~ 부스 넘겨 줄게! 🎧', 2); }
  const a = A(); if (a && !a.ctx) a.init();
  dq('#djStyles').innerHTML = Object.entries((a && a.STYLES) || {}).map(([id, m]) => `<button data-st="${id}" class="${a.style === id ? 'on' : ''}">${m.name}</button>`).join('');
  W.djHue = +dq('#djHue').value / 360; W.djWave = dq('#djWave').classList.contains('on'); djPanel.style.display = ''; djUpd();
  announce(`🎧 ${(NC.settings && NC.settings.name) || '손님'} 님이 DJ 부스를 장악했다!!`, 6, '#3de6ff');
}
function djUpd() {
  const a = A(), lp = +dq('#djLP').value, f = lp >= 100 ? 0 : Math.round(200 * Math.pow(100, lp / 100)); if (a) { a.djLP = f || null; a.djBass = +dq('#djBass').value; }
  dq('#djLPv').textContent = f ? `${f >= 1000 ? (f / 1000).toFixed(1) + 'k' : f}Hz` : '열림'; dq('#djBassv').textContent = `${dq('#djBass').value > 0 ? '+' : ''}${dq('#djBass').value}dB`;
  W.djHue = +dq('#djHue').value / 360; dq('#djHuev').style.background = `hsl(${dq('#djHue').value},90%,55%)`;
}
['#djLP', '#djBass', '#djHue'].forEach(s => dq(s).addEventListener('input', () => { djUpd(); if (Math.random() < .3) Mo.play(P().group, 'point'); }));
dq('#djWave').onclick = e => { e.target.classList.toggle('on'); W.djWave = e.target.classList.contains('on'); };
dq('#djDrop').onclick = () => { const p = P(); if (NC.fireCO2) NC.fireCO2(); sfx(60, .6, .6); burst(0, 4, -12, { n: 200, colors: ['#ff3d9a', '#3de6ff', '#ffd23d', '#9b5cff', '#ffffff'], up: 4, spread: 3, life: 2.2 }); Mo.play(p.group, 'cheer');
  announce('💥 DROP!!! 💥', 2.5, '#ff3d9a'); (NC.npcs || []).filter(n => n.g.visible && n.state !== 'seated').slice(0, 30).forEach((n, i) => setTimeout(() => { Mo.play(n.g, 'cheer'); if (i % 3 === 0) floatEmoji(n.x, n.g.position.y + 2.3, n.z, pk(['🔥', '🙌', '💥'])); }, i * 40)); };
dq('#djScratch').onclick = () => { const a = A(); if (a && a.ctx) { const t = a.ctx.currentTime; for (let k = 0; k < 6; k++) a.hit(t + k * .07, 300 + (k % 2) * 900, .06, .25, a.sfxBus); } Mo.play(P().group, 'point'); };
dq('#djStyles').onclick = e => { const b = e.target.closest('button[data-st]'); if (!b) return; A().setStyle(b.dataset.st); dq('#djStyles').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); NC.ui.toast('🎵 ' + b.textContent); };
dq('#djExit').onclick = () => djEnd();
djPanel.addEventListener('keydown', e => e.stopPropagation());
function djEnd() {
  const p = P(), u = p.group.userData, a = A(); if (a) { a.djLP = null; a.djBass = 0; } if (NC.cam && DJ.cam) Object.assign(NC.cam, DJ.cam); W.djHue = null; W.djWave = false;
  u.dance = DJ.saved.dance || null; p.x = 0; p.z = -15.5; p.ry = Math.PI; if (NC.DJ && DJ.saved.djPos) NC.DJ.position.copy(DJ.saved.djPos);
  djPanel.style.display = 'none'; p.busy = false; FX.mode = null; NC.Wallet.add(10, 'DJ 테이크오버'); if (NC.DJ) B(NC.DJ, '실력 좋던데? 👍', 2);
}

/* ═════ ④ 파우더룸 칭찬·소품 공유 ═════ */
const PR = { girls: [], built: false };
const COMPLIMENTS = ['오늘 메이크업 진짜 예뻐요! 💄', '그 립 컬러 어디 거예요? 너무 잘 어울려요', '머리 스타일 완전 아이돌 같아요 ✨', '향수 냄새 너무 좋아요 🌸', '오늘 의상 센스 최고예요!', '피부 진짜 광나요… 비결이 뭐예요?'];
const REPLIES = ['어머 진짜요? 고마워요 💕', '헤헤 언니도 너무 예뻐요!', '오늘 처음 들어보는 칭찬이에요 ㅠㅠ 감동', '같이 셀카 찍을래요? 📸'];
const ITEMS = [['💄', '립스틱'], ['🌸', '향수'], ['🎀', '헤어핀'], ['🪞', '손거울'], ['✨', '쿠션 팩트'], ['💅', '네일 스티커']];
function prBuild() {
  const R = NC.Rooms && NC.Rooms.wroom; if (!R || PR.built) return; PR.built = true;
  [['세린', 'hime', '#17110f', -1.1], ['유라', 'spaceBuns', '#c8c4d8', .9]].forEach(([nm, hs, hc, dx], i) => {
    const g = NC.Avatar.create({ name: nm, look: { gender: 'f', hairStyle: hs, hairColor: hc, top: i ? 'halter' : 'blazerCrop', topColor: '#141016', bottom: i ? 'leather' : 'tutu', bottomColor: '#0d0b10', shoes: 'boots', idol: true, choker: true, face: { stage: true, liner: .9, earring: true } }, seed: 700 + i, expr: 'smile' });
    g.position.set(R.cx + dx, 0, R.cz + 1.4); g.rotation.y = Math.PI; NC.scene.add(g); g.visible = false; PR.girls.push({ g, name: nm }); });
}
function prOpen() {
  prBuild(); if (!PR.girls.length) return;
  const html = `<h3>💄 파우더룸</h3><p style="font-size:13px;margin:4px 0 8px">거울 앞에서 화장을 고치는 손님들에게 칭찬하거나 소품을 주고받아요</p>
    <div class="prRow"><b>누구에게?</b>${PR.girls.map((q, i) => `<button class="prT${i ? '' : ' on'}" data-i="${i}">${q.name}</button>`).join('')}</div>
    <div class="prRow"><b>💬 칭찬</b>${COMPLIMENTS.map((c, i) => `<button class="prC" data-i="${i}">${c}</button>`).join('')}</div>
    <div class="prRow"><b>🎁 소품 주기</b>${ITEMS.map(([e, n], i) => `<button class="prG" data-i="${i}">${e} ${n}</button>`).join('')}</div>
    <div class="prRow"><b>🙋 빌리기</b>${ITEMS.slice(0, 4).map(([e, n], i) => `<button class="prB" data-i="${i}">${e} ${n} 빌려줘요</button>`).join('')}</div>`;
  NC.ui.modal(html, [['닫기', 0]]); let tgt = 0; const root = [...document.querySelectorAll('.modal')].pop();
  root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const i = +b.dataset.i;
    if (b.classList.contains('prT')) { tgt = i; root.querySelectorAll('.prT').forEach(x => x.classList.toggle('on', x === b)); }
    else if (b.classList.contains('prC')) compliment(PR.girls[tgt], COMPLIMENTS[i]);
    else if (b.classList.contains('prG')) giveItem(PR.girls[tgt], ITEMS[i], true);
    else if (b.classList.contains('prB')) giveItem(PR.girls[tgt], ITEMS[i], false); });
}
function compliment(q, text) {
  const p = P(); p.group.rotation.y = Math.atan2(q.g.position.x - p.x, q.g.position.z - p.z); q.g.rotation.y = Math.atan2(p.x - q.g.position.x, p.z - q.g.position.z);
  B(p.group, text, 2.4); Mo.play(p.group, 'point');
  setTimeout(() => { Mo.play(q.g, 'shy'); q.g.userData.setExpr && q.g.userData.setExpr('shy', 2.5); B(q.g, pk(REPLIES), 2.4); for (let k = 0; k < 9; k++) setTimeout(() => floatEmoji(q.g.position.x, 2.1, q.g.position.z, pk(['💕', '💖', '❤️'])), k * 110);
    burst(q.g.position.x, 2.0, q.g.position.z, { n: 50, colors: ['#ff5fa8', '#ff9ad0', '#ffffff'], up: 1.2, spread: .8, life: 1.4, size: .05, g: .6 }); NC.Wallet.add(2, '파우더룸 칭찬'); }, 900);
}
function giveItem(q, [e, n], give) {
  const p = P(), a = give ? p.group : q.g, b = give ? q.g : p.group, sp = emojiSprite(e, .3); NC.scene.add(sp);
  Mo.play(a, 'wave'); const t0 = performance.now(), from = a.position.clone().add(new T.Vector3(0, 1.3, 0)), to = b.position.clone().add(new T.Vector3(0, 1.3, 0));
  const tick = () => { const k = Math.min(1, (performance.now() - t0) / 900); sp.position.lerpVectors(from, to, k); sp.position.y += Math.sin(k * Math.PI) * .55; sp.material.rotation = k * 6;
    if (k < 1) requestAnimationFrame(tick); else { NC.scene.remove(sp); Mo.play(b, 'pickup'); B(q.g, give ? pk([`${n} 고마워요!! 💕`, `와 ${n} 딱 필요했는데 ㅠㅠ`, `이거 나 가져도 돼요? 😍`]) : pk([`여기요~ ${n} 써요!`, `${n} 빌려줄게요 ㅎㅎ`]), 2.2);
      for (let k2 = 0; k2 < 6; k2++) setTimeout(() => floatEmoji(q.g.position.x, 2.1, q.g.position.z, pk(['💕', '✨'])), k2 * 120); } };
  requestAnimationFrame(tick); B(p.group, give ? `이거 써 보세요! ${e}` : `${n} 잠깐 빌려줄래요? ${e}`, 1.8);
}

/* ═════ ⑤ 바닥 수색 (휴대폰 플래시 + 미니게임) ═════ */
const FIND = ['💎 한정판 미러볼 키링', '👑 금장 VIP 팔찌', '🎫 1998 나이트 입장권', '💍 은반지', '🔑 BMW 스마트키', '📿 진주 목걸이', '🕶 명품 선글라스'];
const FS = { items: [], t: 0, dur: 40, found: 0 };
const fsBtn = document.createElement('button'); fsBtn.id = 'btnSearch'; fsBtn.title = '바닥 수색 (휴대폰 플래시)'; fsBtn.textContent = '🔦'; fsBtn.style.display = 'none'; document.body.appendChild(fsBtn);
const fsHud = document.createElement('div'); fsHud.id = 'fsHud'; fsHud.style.display = 'none'; document.body.appendChild(fsHud);
NC.on && NC.on('start', () => { fsBtn.style.display = ''; });
fsBtn.onclick = () => FX.mode === 'search' ? fsEnd(false) : fsStart();
function fsStart() {
  const p = P(); if (busyNow()) return NC.ui.toast('지금은 수색할 수 없어요'); const zn = p.zone;
  if (!['tables', 'hall', 'dance', 'corridor', 'bar'].includes(zn)) return NC.ui.toast('클럽 홀 바닥에서만 수색할 수 있어요');
  if (p.seat && NC.requestStand) NC.requestStand();
  FX.mode = 'search'; FS.t = 0; FS.found = 0; FS.items = []; FS.speed = p.speed; p.speed = 1.6; p.group.userData.dance = 'crouch';
  for (let k = 0; k < 3; k++) { let q = null; for (let tries = 0; tries < 40 && !q; tries++) { const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 5, c = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r }; const c2 = { x: c.x, z: c.z }; NC.collide(c2, .4); if (Math.hypot(c2.x - c.x, c2.z - c.z) < .05 && W.vipAt(c.x, c.z) < 0 && NC.groundY(c.x, c.z) < .1) q = c; }
    if (!q) continue; const sp = emojiSprite(FIND[(Math.random() * FIND.length) | 0].split(' ')[0], .28); sp.position.set(q.x, .16, q.z); sp.visible = false; NC.scene.add(sp); FS.items.push({ x: q.x, z: q.z, sp, name: pk(FIND), got: false }); }
  borrowSpot('search', '#f4f8ff', 3.2, .42); fsBtn.classList.add('on'); fsHud.style.display = ''; NC.ui.toast('🔦 휴대폰 플래시 ON — 쪼그려 앉아 바닥을 비춰 보세요! (WASD 로 천천히 이동)');
}
function fsTick(dt) {
  const p = P(), L = W.lights.ball, u = p.group.userData; FS.t += dt; u.dance = 'crouch';
  const fx = p.x + Math.sin(p.ry) * 1.7, fz = p.z + Math.cos(p.ry) * 1.7;   // 플래시는 몸 앞 1.7m 바닥을 비춤
  L.position.set(p.x + Math.sin(p.ry) * .3, p.y + .9, p.z + Math.cos(p.ry) * .3); SPOT.tg.position.set(fx, 0, fz); L.intensity = 3.2 + Math.sin(FS.t * 30) * .08;
  let nearest = 99;
  FS.items.forEach(it => { if (it.got) return; const dLight = Math.hypot(it.x - fx, it.z - fz), dMe = Math.hypot(it.x - p.x, it.z - p.z); nearest = Math.min(nearest, dMe);
    it.sp.visible = dLight < 1.25; if (it.sp.visible) { it.sp.material.rotation = Math.sin(FS.t * 6) * .3; it.sp.scale.setScalar(.26 + Math.sin(FS.t * 10) * .04); }
    if (it.sp.visible && dMe < 1.3) { it.got = true; FS.found++; NC.scene.remove(it.sp); Mo.play(p.group, 'pickup'); sfx(1500, .18, .2); setTimeout(() => sfx(2200, .2, .15), 120);
      burst(it.x, .4, it.z, { n: 40, colors: ['#ffd23d', '#ffffff'], up: 1.6, spread: .6, life: 1, size: .05 }); NC.Wallet.add(20, `${it.name} 발견!`); floatEmoji(p.x, p.y + 2.2, p.z, '🎉'); } });
  const hint = nearest < 1.8 ? '🔥🔥 바로 앞이에요!' : nearest < 3.5 ? '🔥 뜨거워요' : nearest < 6 ? '🌡 미지근' : '❄ 차가워요';
  fsHud.innerHTML = `<b>🔦 바닥 수색</b> 찾은 아이템 <b>${FS.found}/${FS.items.length}</b> · ⏱ ${Math.max(0, Math.ceil(FS.dur - FS.t))}초<br><span>${FS.found >= FS.items.length ? '🎉 모두 찾았어요!' : hint}</span>`;
  if (FS.found >= FS.items.length || FS.t >= FS.dur) fsEnd(true);
}
function fsEnd(auto) {
  const p = P(); FS.items.forEach(it => { if (!it.got) NC.scene.remove(it.sp); }); releaseSpot('search'); p.speed = FS.speed || 5; p.group.userData.dance = null; FX.mode = null; fsBtn.classList.remove('on');
  fsHud.style.display = 'none'; if (auto) NC.ui.toast(FS.found >= FS.items.length ? `🎉 한정판 아이템 ${FS.found}개 모두 찾았어요! 보너스 🪙+30` : `⏱ 시간 종료 — ${FS.found}개 찾았어요`); if (auto && FS.found >= FS.items.length && FS.items.length) NC.Wallet.add(30, '바닥 수색 완주');
}

/* ── E 상호작용 등록 ── */
NC.interactProviders.push(() => {
  const p = P(), out = []; if (busyNow() || online() && false) return out;
  if (p.zone === 'stage') out.push({ label: '💥 무아지경 시그니처 댄스 (E)', dist: 1.9, run: () => sigStart(null) });
  if (!p.seat && ['tables'].includes(p.zone)) { const ts = NC.tables || []; let best = -1, bd = 3.3; ts.forEach((t, i) => { const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd && !NC.tableOcc[i].some(Boolean)) { bd = d; best = i; } }); if (best >= 0) out.push({ label: `🕺 T${best + 1} 테이블 위 시그니처 댄스 (E)`, dist: bd + .6, run: () => sigStart(best) }); }
  if (p.room >= 0 && !CH.phase) out.push({ label: '🍾 샴페인 폭죽 쇼 (🪙80)', dist: 1.5, run: chStart });
  { const d = W.spots.dj, dd = Math.hypot(p.x - d.x, p.z - d.z); if (dd < 3.2 && p.zone === 'stage') out.push({ label: '🎧 DJ 부스 테이크오버 (E)', dist: dd - .5, run: djStart }); }
  if (p.zone === 'wroom') out.push({ label: '💄 파우더룸 — 칭찬·소품 나누기 (E)', dist: 1, run: prOpen });
  return out;
});

/* ── 매 프레임 ── */
NC.tickers.push(dt => {
  for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt; f.sp.position.y += dt * .8; f.sp.position.x += f.vx * dt; f.sp.material.opacity = Math.max(0, 1 - f.t / f.life); if (f.t >= f.life) { NC.scene.remove(f.sp); f.sp.material.dispose(); floaters.splice(i, 1); } }
  for (let i = bursts.length - 1; i >= 0; i--) { const b = bursts[i]; b.t += dt; const a = b.pts.geometry.attributes.position, arr = a.array;
    for (let k = 0; k < b.vel.length; k++) { const v = b.vel[k]; v[1] -= b.g * dt; arr[k * 3] += v[0] * dt; arr[k * 3 + 1] += v[1] * dt; arr[k * 3 + 2] += v[2] * dt;
      if (b.rain && arr[k * 3 + 1] < b.rain.y - 3.6) { const an = Math.random() * 6.28, r = Math.random() * b.rain.r; arr[k * 3] = b.rain.x + Math.cos(an) * r; arr[k * 3 + 1] = b.rain.y; arr[k * 3 + 2] = b.rain.z + Math.sin(an) * r; v[1] = -.3; } }
    a.needsUpdate = true; b.pts.material.opacity = Math.max(0, 1 - Math.max(0, b.t - b.life * .6) / (b.life * .4)); if (b.t >= b.life) { NC.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); } }
  try {
    if (FX.mode === 'sig') sigTick(dt); else if (FX.mode === 'search') fsTick(dt);
    if (FX.mode === 'dj') { const p = P(), d = W.spots.dj; p.x = d.x + .9; p.z = d.z; p.group.userData.dance = 'djMix'; }
    if (CH.phase) chTick(dt);
  } catch (e) { console.warn('[features]', e); if (FX.mode === 'sig') sigEnd(); else if (FX.mode === 'search') fsEnd(false); }
  const inWr = P().zone === 'wroom'; PR.girls.forEach((q, i) => { q.g.visible = inWr; if (inWr) { q.g.userData.dance = i ? 'idle' : null; Mo.update(q.g, dt, { near: true, speed: 1 }); NC.Avatar.fitLabel(q.g, NC.camera); } });
  if (inWr && !PR.built) prBuild();
});
Object.assign(FX, { sigStart, chStart, djStart, prOpen, fsStart, announce, fx: { burst, floatEmoji, emojiSprite } });
console.info('[features] 시그니처 댄스 · 샴페인 쇼 · DJ 테이크오버 · 파우더룸 · 바닥 수색 준비 완료');
})();
