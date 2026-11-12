/* main.js — 플레이어 · 카메라 · 입력 · 이모트 · 구역 판정 · 메인 루프 · 시작 화면(아바타 커스터마이즈) · 서버 감지 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const T = NC.THREE, U = NC.util, W = NC.world, Mo = NC.Motion, $ = NC.$, camera = NC.camera;

/* ───────── 플레이어 ───────── */
const P = NC.player = { group: null, x: 0, z: -1, ry: Math.PI, target: null, autoPath: null, onAuto: null, autoStuck: 0, seat: null, busy: false, speed: 5, zone: 'corridor', room: -1, stageT: 0, stageCoins: 0, danceUntil: 0, y: 0 };
const cam = NC.cam = { yaw: 0, pitch: .9, dist: 11 };
const keys = {}, joy = { x: 0, y: 0 };

NC.sitPlayer = (info, pos) => { P.seat = info; P.target = null; P.autoPath = null; NC.seatAvatar(P.group, pos.x, pos.z, pos.ry, pos.h); P.x = pos.x; P.z = pos.z; P.ry = pos.ry; NC.emit('seat', info); };
function standLocal() {
  if (!P.seat) return; const s = P.seat; let sp;
  if (s.kind === 'table') { NC.tableOcc[s.t][s.s] = null; sp = NC.standPos(s.t, s.s); }
  else if (s.kind === 'karaoke' && NC.Karaoke) sp = NC.Karaoke.stand(s);
  else if (s.kind && NC.standHandlers && NC.standHandlers[s.kind]) sp = NC.standHandlers[s.kind](s);
  else { const v = W.vip[s.room]; v.occ[s.s] = null; const seat = v.seats[s.s]; sp = { x: seat.x + Math.sin(seat.ry) * 1.3, z: seat.z + Math.cos(seat.ry) * 1.3 }; }
  NC.unseatAvatar(P.group, sp.x, sp.z); P.x = sp.x; P.z = sp.z; P.seat = null; if (!NC.Dialog.cur) P.busy = false; NC.emit('stand');
}
NC.standLocal = standLocal;
NC.requestStand = () => { if (P.seat && P.seat.kind === 'table' && NC.net && NC.mode === 'online') NC.net.send({ type: 'stand' }); else standLocal(); };
NC.requestSit = t => { if (P.busy) return; if (NC.mode === 'online' && NC.net) return NC.net.send({ type: 'sit', table: t }); const free = NC.tableOcc[t].findIndex(v => v == null); if (free >= 0) NC.ui.fade(() => { NC.tableOcc[t][free] = 'me'; NC.sitPlayer({ kind: 'table', t, s: free }, NC.seatPos(t, free)); }); };
NC.walkPlayer = (path, done) => { if (P.seat) standLocal(); P.autoPath = path.slice(); P.onAuto = done; P.target = null; P.autoStuck = 0; P.autoSpeed = 0; };

/* ───────── 입력 ───────── */
const typing = NC.ui.typing;
const EMOTE_KEYS = { z: 'stageDance', x: 'groove', c: 'cheers', v: 'drink', b: 'wave', n: 'clap', m: 'bow' };
function emote(name) {
  if (!P.group) return; if (NC.memberGate && !NC.memberGate('이모트 · 춤')) return;
  if (name === 'stageDance' || name === 'groove') { P.group.userData.dance = name; P.danceUntil = performance.now() + 8000; }
  else Mo.play(P.group, name);
  NC.net && NC.mode === 'online' && NC.net.send({ type: 'emote', name });
}
NC.emote = emote;
addEventListener('keydown', e => {
  if (typing() || !P.group) return; if (NC.Games && NC.Games.active) return;
  const k = (e.key || '').toLowerCase(); keys[k] = true;
  if (k === 'e' || (k === 'enter' && !NC.chatEnabled)) { runAct(curAct); e.preventDefault(); }
  if (k === 'enter' && NC.chatEnabled) { if (NC.memberGate && !NC.memberGate('채팅')) return; $('#chatin').focus(); e.preventDefault(); }
  if (EMOTE_KEYS[k] && !NC.ui.dlgOpen() && !NC.Dialog.cur) emote(EMOTE_KEYS[k]);
  if (k === 'escape' && NC.Dialog.cur) NC.Dialog.close('bye');
});
addEventListener('keyup', e => { keys[(e.key || '').toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('wheel', e => { if (e.target === NC.canvas) cam.dist = U.clamp(cam.dist + e.deltaY * .01, 3, 18); }, { passive: true });
/* v18 오른쪽 아래 ＋/－ 화면 확대·축소 (카메라 거리 3~18m) + 왼쪽 위 버전 표기 */
{ const z = document.createElement('div'); z.id = 'zoomBar'; z.innerHTML = '<button id="zIn" title="확대">＋</button><span id="zVal"></span><button id="zOut" title="축소">－</button>'; document.body.appendChild(z);
  const show = () => { $('#zVal').textContent = Math.round((18 - cam.dist) / 15 * 100) + '%'; };
  const step = d => { cam.dist = U.clamp(cam.dist + d, 3, 18); show(); };
  const hold = (el, d) => { let t = null; const go = () => { step(d); t = setTimeout(go, 120); }; el.addEventListener('pointerdown', e => { e.preventDefault(); step(d); t = setTimeout(go, 380); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => el.addEventListener(k, () => clearTimeout(t))); };
  hold($('#zIn'), -1.2); hold($('#zOut'), 1.2); show(); addEventListener('wheel', show, { passive: true });
  addEventListener('keydown', e => { if (NC.ui.typing()) return; if (e.key === '+' || e.key === '=') step(-1.2); else if (e.key === '-' || e.key === '_') step(1.2); });
  const ver = document.createElement('span'); ver.id = 'verTag'; ver.textContent = NC.VERSION || ''; ver.title = '패키지 버전'; const tt = $('#title'); if (tt) tt.appendChild(ver); }
const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), pt = { down: false, moved: 0, id: null, x: 0, y: 0 };
NC.canvas.addEventListener('pointerdown', e => { pt.down = true; pt.moved = 0; pt.id = e.pointerId; pt.x = e.clientX; pt.y = e.clientY; });
addEventListener('pointermove', e => { if (!pt.down || e.pointerId !== pt.id || NC._pinch) return; const dx = e.clientX - pt.x, dy = e.clientY - pt.y; pt.moved += Math.abs(dx) + Math.abs(dy); pt.x = e.clientX; pt.y = e.clientY; cam.yaw -= dx * .006; cam.pitch = U.clamp(cam.pitch + dy * .003, .35, 1.3); });
addEventListener('pointerup', e => {
  if (!pt.down || e.pointerId !== pt.id) return; pt.down = false;
  if (pt.moved < (NC.isMobile ? 16 : 8) && !NC._pinchEnd && P.group && !P.busy && e.target === NC.canvas) {
    ray.setFromCamera(new T.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    const v = new T.Vector3(); if (ray.ray.intersectPlane(plane, v)) clickMove(v, ray.ray);
  }
});
/* v9: 클릭 이동 = 길찾기. 유리벽·VIP 간판을 눌러도 그 방 입구로, 바 카운터를 누르면 빈 바 의자로 걸어간다 */
const marker = new T.Mesh(new T.RingGeometry(.22, .3, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xff5fd2, transparent: true, opacity: 0, depthWrite: false }));
marker.renderOrder = 5; NC.scene.add(marker);
NC.clickMove = (v, r) => clickMove(v, r);
function clickMove(v, r) {
  let to = { x: v.x, z: v.z }, sitAfter = false;
  const inExtra = W.extraZones.some(e => e.test(P.x, P.z));
  if (!inExtra && W.vipAt(to.x, to.z) < 0 && P.z < W.vip[0].z0 && r.direction.z > 0) {        // 앞 유리벽·문·간판을 클릭했는지: 광선이 VIP 정면(z0)을 사람 키 높이로 통과?
    const z0 = W.vip[0].z0, t = (z0 - r.origin.z) / r.direction.z, y = r.origin.y + r.direction.y * t, x = r.origin.x + r.direction.x * t;
    const vy0 = W.vip[0].y || 0; if (t > 0 && y > vy0 - .1 && y < vy0 + 5.2) { const vv = W.vip.find(q => x > q.x0 && x < q.x1); if (vv) to = { x: vv.entry.x, z: vv.entry.z }; }
  }
  const room = inExtra ? -1 : W.vipAt(to.x, to.z);
  if (room >= 0 && room !== P.room && W.locked(room)) { NC.ui.toast(`🔒 VIP ${room + 1} 룸은 지금 다른 손님이 사용 중이에요`); return; }
  if (P.seat) NC.requestStand();
  const path = !inExtra && NC.Path ? NC.Path.find(P, to) : null;
  if (path) { sitAfter = path.snapped; const end = path[path.length - 1];
    NC.walkPlayer(path, () => { if (!sitAfter) return; const a = computeAct(x => /앉기/.test(x.label)); if (a && !(NC.isGuest && NC.isGuest())) a.run(); });
    P.autoSpeed = P.speed; marker.position.set(end.x, NC.groundY(end.x, end.z) + .03, end.z); marker.material.opacity = .9; }
  else { P.autoPath = null; P.target = to; marker.position.set(to.x, .03, to.z); marker.material.opacity = .9; }
}
NC.tickers.push(dt => { if (marker.material.opacity > 0) { marker.material.opacity = Math.max(0, marker.material.opacity - dt * (P.autoPath || P.target ? .25 : 2)); marker.scale.setScalar(1 + .15 * Math.sin(performance.now() / 120)); } });
if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) {
  const jb = $('#joy'), jk = jb.firstElementChild; let jid = null;
  NC.on('start', () => { jb.style.display = 'block'; });
  const setJ = e => { const r = jb.getBoundingClientRect(); let dx = (e.clientX - r.left - 60) / 50, dy = (e.clientY - r.top - 60) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = dx; joy.y = -dy; jk.style.transform = `translate(${dx * 36}px,${dy * 36}px)`; };
  jb.addEventListener('pointerdown', e => { jid = e.pointerId; jb.setPointerCapture(jid); setJ(e); e.stopPropagation(); });
  jb.addEventListener('pointermove', e => { if (e.pointerId === jid) setJ(e); });
  const end = e => { if (e.pointerId === jid) { jid = null; joy.x = joy.y = 0; jk.style.transform = ''; } };
  jb.addEventListener('pointerup', end); jb.addEventListener('pointercancel', end);
}
// 이모트 바
$('#emotes').addEventListener('click', e => { const b = e.target.closest('button[data-e]'); if (b) emote(b.dataset.e); });

/* ───────── 상호작용 후보 ───────── */
let curAct = null; const actBtn = $('#act');
function computeAct(filter) {
  if (!P.group || P.busy || P.autoPath) return null; const c = [];
  if (P.seat) c.push({ label: '🚪 자리에서 일어나기 (E)', dist: 0, run: NC.requestStand });
  else {
    NC.tables.forEach(t => { const d = Math.hypot(t.x - P.x, t.z - P.z); if (d < 3.7 && NC.tableOcc[t.id].some(v => v == null)) c.push({ label: `🪑 T${t.id + 1} 테이블에 앉기 (E)`, dist: d + .5, run: () => NC.requestSit(t.id) }); });
    if (P.room >= 0) { const v = W.vip[P.room]; v.seats.forEach((s, i) => { const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < 2.2 && !v.occ[i]) c.push({ label: `🛋 VIP ${v.id + 1} 소파에 앉기 (E)`, dist: d + .4, run: () => NC.ui.fade(() => { v.occ[i] = 'me'; NC.sitPlayer({ kind: 'vip', room: v.id, s: i }, s); }) }); }); }
    NC.interactProviders.forEach(f => { try { (f() || []).forEach(x => c.push(x)); } catch (e) { console.error(e); } });
  }
  c.sort((a, b) => a.dist - b.dist); return (filter ? c.filter(filter) : c)[0] || null;
}
/* v32 손님 모드: 상호작용은 회원 전용 → 버튼엔 🔒 표시, 누르면 가입 팝업 */
function runAct(a) { if (!a) return; if (NC.memberGate && !NC.memberGate(a.label.replace(/\s*\(E\)\s*/, '').replace(/^\S+\s/, ''))) return; a.run(); }
actBtn.onclick = () => runAct(curAct);

/* ───────── 구역 판정 (모션 트리거 · 사운드 댐핑 · 코인) ───────── */
const zoneEl = $('#zone');
function updateZone(dt, moving) {
  const z = W.zoneAt(P.x, P.z), name = z.name, room = z.name === 'vip' ? z.room : -1;
  if (name !== P.zone || room !== P.room) {
    P.zone = name; const prevRoom = P.room; P.room = room;
    zoneEl.textContent = (name === 'vip' ? `🔒 VIP ${room + 1} 룸 · 비밀 대화방` : '📍 ' + W.zoneLabel[name]); zoneEl.classList.remove('pulse'); void zoneEl.offsetWidth; zoneEl.classList.add('pulse');
    Mo.trigger(P.group, name === 'stage' ? 'zone:stage' : name === 'dance' ? 'zone:dance' : 'zone:other', { silent: true });
    if (prevRoom !== room) NC.emit('room', room, prevRoom);
  }
  if (performance.now() > P.danceUntil && P.danceUntil) { P.danceUntil = 0; P.group.userData.dance = P.zone === 'stage' ? 'stageDance' : P.zone === 'dance' ? 'groove' : null; }
  if (name === 'stage' && !moving && !P.seat && P.stageCoins < 60) { P.stageT += dt; if (P.stageT > 8) { P.stageT = 0; P.stageCoins++; NC.Wallet.add(1); if (P.stageCoins % 5 === 0) NC.ui.toast(`💃 스테이지 열정 보상 누적 🪙${P.stageCoins}`); } }
}
const coinEl = $('#coins'); const showCoins = v => { coinEl.textContent = '🪙 ' + v; }; NC.on('coins', showCoins); showCoins(NC.Wallet.get());

/* ───────── 메인 루프 ───────── */
const clock = new T.Clock(); let tAcc = 0; const camTarget = new T.Vector3(), camPos = new T.Vector3();
/* v17 시작(로그인) 화면 동안: 3D 클럽은 배경일 뿐이라 거의 쉬게 함
 *  · 모바일/저사양: 배경을 처음 두 번만 그리고 멈춤(NPC·조명·LED 계산도 생략) → 입력·로그인 반응이 바로바로
 *  · PC: 초당 20프레임으로 제한   · 탭이 안 보이면 브라우저가 알아서 멈춤 */
const startEl = $('#start'), LITE_START = (NC.quality && NC.quality.level === 'low') || matchMedia('(pointer:coarse)').matches;
let idleAcc = 1;
function frame() {
  requestAnimationFrame(frame);
  if (!P.group && startEl && startEl.style.display !== 'none') {
    const d = clock.getDelta(); idleAcc += d; if (idleAcc < (LITE_START ? 1 : 1 / 20)) return; if (LITE_START && (NC._idleShots = (NC._idleShots || 0) + 1) > 2) return;   // 모바일: 배경은 처음 두 번만 그리고 멈춤(입장 화면이 거의 가림)
    const dt0 = Math.min(idleAcc, .05); idleAcc = 0; tAcc += dt0;
    const a = tAcc * .12; camera.position.set(Math.sin(a) * 18, 7.5, -4 + Math.cos(a) * 12); camera.lookAt(0, 2, -9);
    if (!LITE_START) W.update(dt0, tAcc, []);
    (NC.render || ((s, c) => NC.renderer.render(s, c)))(NC.scene, camera); return;
  }
  const dt = Math.min(clock.getDelta(), .05); tAcc += dt; const t = tAcc;
  const agents = []; if (P.group) agents.push({ x: P.x, z: P.z, me: true });
  (NC.npcs || []).forEach(n => { if (n.g.visible) agents.push(n); }); (NC.Waiters ? NC.Waiters.list : []).forEach(o => agents.push(o)); NC.remotes.forEach(r => agents.push({ x: r.g.position.x, z: r.g.position.z }));
  W.update(dt, t, agents);
  NC.NPC.update(dt, camera); NC.Waiters && NC.Waiters.update(dt, camera);
  if (P.group) {
    let kx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0), ky = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0);
    if (NC.Games && NC.Games.active) kx = ky = 0;
    kx += joy.x; ky += joy.y; const kl = Math.hypot(kx, ky); let moving = false;
    if (kl > .1 && !P.busy) { if (P.seat) NC.requestStand(); P.target = null; P.autoPath = null; }
    if (!P.seat) {
      let mx = 0, mz = 0, sp = P.speed;
      if (kl > .1 && !P.busy) { const l = Math.min(1, kl), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw); mx = ((kx / kl) * cy + (ky / kl) * -sy) * l; mz = ((kx / kl) * -sy + (ky / kl) * -cy) * l; moving = true; }
      else if (P.autoPath) { const p = P.autoPath[0]; if (!p) { const f = P.onAuto; P.autoPath = null; P.onAuto = null; f && f(); } else { const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz); if (d < .35 || P.autoStuck > 1.2) { if (P.autoStuck > 1.2 && NC.Path && !P.replanned) { const last = P.autoPath[P.autoPath.length - 1], np = NC.Path.find(P, last); P.replanned = true; if (np) P.autoPath = np; else P.autoPath.shift(); } else P.autoPath.shift(); P.autoStuck = 0; if (!P.autoPath.length) P.replanned = false; } else { mx = dx / d; mz = dz / d; moving = true; sp = P.autoSpeed || 4.2; } } }
      else if (P.target && !P.busy) { const dx = P.target.x - P.x, dz = P.target.z - P.z, d = Math.hypot(dx, dz); if (d < .25) P.target = null; else { mx = dx / d; mz = dz / d; moving = true; } }
      if (moving) { const px = P.x, pz = P.z; P.x += mx * sp * dt; P.z += mz * sp * dt; NC.collide(P, .4); const moved = Math.hypot(P.x - px, P.z - pz); if (moved < sp * dt * .25) { P.autoStuck += dt; if (P.target) P.target = null; } P.ry = U.lerpAngle(P.ry, Math.atan2(mx, mz), Math.min(1, dt * 12)); P.group.rotation.y = P.ry; }
      const gy = NC.groundOverride ? NC.groundOverride(P.x, P.z) : null; P.y += ((gy != null ? gy : NC.groundY(P.x, P.z)) - P.y) * Math.min(1, dt * 12);   // v18: 테이블 위 등 임시 바닥
      P.group.position.set(P.x, P.y, P.z); P.group.userData.moving = moving;
    }
    if (NC.Dialog.cur && P.seat) P.group.userData.talk = true; else if (P.seat) P.group.userData.talk = false;
    Mo.update(P.group, dt, { near: true, speed: moving && P.autoPath ? .85 : 1.1 }); NC.Avatar.fitLabel(P.group, camera);
    updateZone(dt, moving);
    // 카메라: 대화 중이면 두 사람을 프레이밍
    const f = (NC.camOverride && NC.camOverride()) || NC.Dialog.focus(camera);
    if (f) { camTarget.set(f.tx, f.ty, f.tz); camPos.set(f.cx, f.cy, f.cz);
      if (innerWidth > 800) { let dx = f.tx - f.cx, dz = f.tz - f.cz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; camTarget.x += -dz * .95; camTarget.z += dx * .95; camPos.x += -dz * .95; camPos.z += dx * .95; } }   // 오른쪽 대화 패널을 피해 인물을 왼쪽에 배치
    else { const tx = P.group.position.x, tz = P.group.position.z, ty = 1.4 + P.y, inner = P.room >= 0 || P.zone === 'karaoke', dist = ['karaoke', 'restroom', 'smoke'].includes(P.zone) ? Math.min(cam.dist, 4.2) : P.room >= 0 ? Math.min(cam.dist, 8) : cam.dist;
      camTarget.set(tx, ty, tz); camPos.set(tx + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist, ty + Math.sin(cam.pitch) * dist, tz + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist); camPos.y = Math.min(camPos.y, ['karaoke', 'restroom', 'smoke'].includes(P.zone) ? 2.75 : W.ROOM.h - .5); void inner;
      if (W.clampCam && !W.extraZones.some(e => e.test(P.x, P.z))) W.clampCam(camTarget, camPos, P.y > 3);
      /* v28 실내(노래방·VIP·흡연실·화장실·로비 등): 카메라를 방 상자 안으로 → 벽에 막혀 캐릭터가 안 보이던 문제(특히 세로 화면) */
      const K = NC.Karaoke, ez = K && K.inRoom ? null : W.extraZones.find(e => e.box && e.test(P.x, P.z)), bx = K && K.inRoom ? K.box : ez && ez.box;
      if (bx) { const m = .32; camPos.x = U.clamp(camPos.x, bx.cx - bx.hx + m, bx.cx + bx.hx - m); camPos.z = U.clamp(camPos.z, bx.cz - bx.hz + m, bx.cz + bx.hz - m); camPos.y = Math.min(camPos.y, (bx.h || 3.2) - .22);
        /* 벽에 막혀 카메라가 너무 붙으면(드래그 중이 아닐 때) 방 가운데 쪽으로 시점을 천천히 돌림 */
        const hd = Math.hypot(camPos.x - tx, camPos.z - tz), want = Math.cos(cam.pitch) * dist;
        if (!pt.down && hd < want * .6) cam.yaw = U.lerpAngle(cam.yaw, Math.atan2(bx.cx - tx, bx.cz - tz), Math.min(1, dt * 1.6)); } }
    camera.position.lerp(camPos, Math.min(1, dt * (f ? 3 : 6))); NC._look = NC._look || camTarget.clone(); NC._look.lerp(camTarget, Math.min(1, dt * 6)); camera.lookAt(NC._look);
    const doorOpen = P.room >= 0 ? W.vip[P.room].door.open : 0;
    NC.Audio.update(P, Math.atan2(camera.position.x - P.x, camera.position.z - P.z), P.zone, doorOpen);
    curAct = computeAct(); if (curAct) { actBtn.style.display = 'block'; const lb = (NC.isGuest && NC.isGuest() ? '🔒 ' : '') + curAct.label; if (actBtn.textContent !== lb) actBtn.textContent = lb; } else actBtn.style.display = 'none';
  } else { const a = t * .12; camera.position.set(Math.sin(a) * 18, 7.5, -4 + Math.cos(a) * 12); camera.lookAt(0, 2, -9); }
  NC.tickers.forEach(fn => { try { fn(dt, t); } catch (e) { console.error(e); } });
  (NC.render || ((s, c) => NC.renderer.render(s, c)))(NC.scene, camera);
}

/* ───────── 데이터 로딩 ───────── */
const getJSON = async url => { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); };
NC.dataReady = (async () => {
  const [nd, dd, wd, gd] = await Promise.all(['data/npcs.json', 'data/dialogs.json', 'data/waiter.json', 'data/minigames.json'].map(getJSON));
  NC.fallbackLines = dd.fallback || {}; NC.openers = dd.open || [];
  NC.NPC.init(nd); NC.Waiters.init(wd); NC.Games.init(gd);
})();
NC.dataReady.catch(e => { console.error(e); $('#err').textContent = '데이터 파일(data/*.json)을 읽지 못했습니다. 파일을 더블클릭하지 말고 서버(npm start)로 여세요.'; $('#go').disabled = true; });

/* ───────── 시작 화면: 아바타 커스터마이즈 ───────── */
const COLORS = ['#ff3d9a', '#3de6ff', '#ffd23d', '#9b5cff', '#4cd964', '#ff8a3d', '#ffffff', '#1d1d2e'];
const saved = U.store.get('nc_look', null) || {};
const cfg = { gender: saved.gender || 'f', hairStyle: saved.hairStyle || '', top: saved.top || '', topColor: saved.topColor || COLORS[0], seed: saved.seed || (Math.random() * 1e9 | 0), full: saved.full || null, styleName: saved.styleName || '' };
const HAIRS = { f: [['long', '긴 생머리'], ['wavy', '웨이브'], ['bob', '단발'], ['ponytail', '포니테일'], ['bun', '똥머리']], m: [['short', '짧은 머리'], ['twoblock', '투블럭'], ['slick', '올백'], ['side', '가르마'], ['curly', '곱슬'], ['buzz', '삭발']] };
const TOPS = { f: [['dress', '원피스'], ['tee', '티셔츠'], ['shirt', '블라우스'], ['jacket', '재킷']], m: [['shirt', '셔츠'], ['jacket', '재킷'], ['tee', '티셔츠']] };
function buildLook() {
  if (cfg.full) {   // 예전 버전에 저장된 캐릭터에 빠진 항목(얼굴 색 등)은 기본값으로 채움
    const full = JSON.parse(JSON.stringify(cfg.full)), g = cfg.gender = full.gender || cfg.gender, base = NC.Avatar.randomLook(cfg.seed, g);
    const l = Object.assign(base, full, { gender: g }); l.face = Object.assign(base.face, full.face || {}); return l; }   // v12: 스타일 프리셋 / 내 캐릭터
  const base = NC.Avatar.randomLook(cfg.seed, cfg.gender);
  if (!HAIRS[cfg.gender].some(h => h[0] === cfg.hairStyle)) cfg.hairStyle = base.hairStyle;
  if (!TOPS[cfg.gender].some(h => h[0] === cfg.top)) cfg.top = base.top;
  const l = Object.assign(base, { hairStyle: cfg.hairStyle, top: cfg.top, topColor: cfg.topColor });
  l.bottom = l.top === 'dress' ? 'skirt' : l.bottom; if (l.top === 'dress') l.bottomColor = l.topColor; return l;
}
function renderCustom() {
  const sel = (id, list, v) => { const s = $(id); s.innerHTML = list.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join(''); };
  const l = buildLook(); sel('#cHair', HAIRS[cfg.gender], l.hairStyle); sel('#cTop', TOPS[cfg.gender], l.top);
  document.querySelectorAll('#cGender button').forEach(b => b.classList.toggle('on', b.dataset.g === cfg.gender));
  document.querySelectorAll('#sws .sw').forEach(s => s.classList.toggle('on', s.dataset.c === cfg.topColor));
  if (NC.entry && NC.entry.preview) NC.entry.preview(l); else NC.Avatar.preview($('#facePrev'), l, 'smile');
}
NC.entry = Object.assign(NC.entry || {}, { cfg, buildLook, renderCustom, HAIRS, TOPS });
COLORS.forEach(c => { const s = document.createElement('div'); s.className = 'sw'; s.dataset.c = c; s.style.background = c; s.onclick = () => { cfg.topColor = c; if (cfg.full) cfg.full.topColor = c; renderCustom(); }; $('#sws').appendChild(s); });
$('#cGender').onclick = e => { const b = e.target.closest('button'); if (b) { cfg.gender = b.dataset.g; if (cfg.full && cfg.full.gender !== cfg.gender) { cfg.full = null; cfg.styleName = ''; } renderCustom(); } };
$('#cHair').onchange = e => { cfg.hairStyle = e.target.value; if (cfg.full) cfg.full.hairStyle = e.target.value; renderCustom(); };
$('#cTop').onchange = e => { cfg.top = e.target.value; if (cfg.full) { cfg.full.top = e.target.value; if (e.target.value === 'dress') cfg.full.bottom = 'skirt'; } renderCustom(); };
$('#cFace').onclick = () => NC.entry && NC.entry.openStyles ? NC.entry.openStyles() : (cfg.seed = Math.random() * 1e9 | 0, renderCustom());
renderCustom();
try { $('#nick').value = localStorage.getItem('nc_nick') || ''; } catch (e) { }
$('#modeSel').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (!b) return; NC.settings.playMode = b.dataset.m; document.querySelectorAll('#modeSel button').forEach(x => x.classList.toggle('on', x === b)); });

NC.begin = function () {
  const look = NC.settings.look;
  P.group = NC.Avatar.create({ name: NC.settings.name + ' (나)', look, seed: cfg.seed, expr: 'smile', hiRes: true });
  if (NC.VRMKit && NC.VRMKit.playerUrl) NC.VRMKit.attach(P.group, NC.VRMKit.playerUrl); P.group.position.set(P.x, 0, P.z); P.group.rotation.y = P.ry; NC.scene.add(P.group);
  cam.yaw = 0; $('#start').style.display = 'none'; $('#hud').style.display = ''; $('#emotes').style.display = '';
  NC.Audio.init(); NC.emit('start');
  NC.ui.toast(NC.mode === 'online' ? '입장했어요! 🪩 근처 사람에게 E로 부킹 초대 · 🤵 웨이터에게 AI 부킹' : '입장했어요! 🪩 손님 근처에서 E로 말 걸기 · 🤵 웨이터에게 팁 부킹');
};
// v13: 게임 중 내 캐릭터 교체(설정 → 캐릭터 변경). 위치·방향 유지, VRM 이 있으면 다시 연결
NC.rebuildPlayer = look => {
  const old = P.group; if (!old) return; NC.settings.look = look;
  const g = NC.Avatar.create({ name: NC.settings.name + ' (나)', look, seed: cfg.seed, expr: 'smile', hiRes: true });
  if (NC.VRMKit && NC.VRMKit.playerUrl) NC.VRMKit.attach(g, NC.VRMKit.playerUrl);
  g.position.copy(old.position); g.rotation.y = old.rotation.y; NC.scene.add(g); NC.scene.remove(old); P.group = g;
  NC.emit('player:look', look);
};
$('#go').onclick = async () => {
  const nm = $('#nick').value.trim(); $('#err').textContent = '';
  if (!/^[가-힣a-zA-Z0-9_ ]{2,10}$/.test(nm)) { $('#err').textContent = '닉네임은 2~10자(한글·영문·숫자)로 입력해 주세요.'; return; }
  const look = buildLook(); NC.settings.name = nm; NC.settings.look = look; NC.settings.color = U.hexNum(look.topColor, 0xff3d9a);
  U.store.set('nc_look', cfg); try { localStorage.setItem('nc_nick', nm); } catch (e) { }
  $('#go').disabled = true;
  try { await NC.dataReady; } catch (e) { return; }
  try { for (const h of NC.hooks.beforeStart) await h(); } catch (e) { $('#err').textContent = e.message || String(e); $('#go').disabled = false; return; }
  NC.begin(); $('#go').disabled = false;
};
$('#nick').addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); });
{ const qm = document.createElement('div'); qm.id = 'qmenu'; const Lv = [['high', '🎬 고화질 (그림자·블룸·필름)'], ['mid', '✨ 중간 (블룸)'], ['low', '⚡ 저사양 (모바일)']];
  { const x = document.createElement('button'); x.className = 'qClose'; x.textContent = '✕ 닫기'; x.onclick = () => { qm.style.display = 'none'; }; qm.appendChild(x); }   // v16
  Lv.forEach(([k, t]) => { const b = document.createElement('button'); b.textContent = t; if (NC.quality && NC.quality.level === k) b.className = 'on'; b.onclick = () => NC.setQuality(k); qm.appendChild(b); }); document.body.appendChild(qm);
  $('#btnQuality').onclick = () => { qm.style.display = qm.style.display === 'flex' ? 'none' : 'flex'; }; }
{ const vb = document.getElementById('vrmPick'); if (vb) vb.onclick = async () => { if (!NC.VRMKit || !NC.VRMKit.ok) return NC.ui.toast('이 브라우저에서는 VRM을 쓸 수 없어요'); const f = await NC.VRMKit.pickFile(); if (f) { vb.textContent = '✅ ' + f.name; NC.ui.toast('입장하면 내 캐릭터가 ' + f.name + ' 모델로 바뀌어요'); } }; }
$('#btnMusic').onclick = () => { const on = NC.Audio.toggle(); $('#btnMusic').textContent = on ? '🔊' : '🔇'; };
$('#btnHelp').onclick = () => NC.ui.modal(`<h3>❓ 조작법</h3><div style="font-size:13px;line-height:1.8;color:#eadfff">
  이동 <b>WASD/방향키</b> · 바닥 클릭 이동 · 드래그 시점 · 휠 줌<br><b>E</b> 상호작용(말 걸기·앉기·웨이터) · <b>Esc</b> 대화 종료<br>
  이모트 <b>Z</b> 스테이지 댄스 · <b>X</b> 리듬 · <b>C</b> 짠 · <b>V</b> 마시기 · <b>B</b> 인사 · <b>N</b> 박수 · <b>M</b> 꾸벅<br>
  🤵 웨이터에게 팁(🪙)을 주면 원하는 스타일의 손님이 있는 VIP 룸으로 안내해요<br>💃 스테이지에서 춤추면 코인이 쌓여요 · 🎲 대화 중 미니게임</div>`, [['닫기', 1, true]]);
frame();

/* ───────── 서버 감지 (있으면 운영·멀티·음성 모듈 로드) ───────── */
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.body.appendChild(s); });
(async () => {
  const qs = new URLSearchParams(location.search);
  if (qs.get('mode') === 'demo' || !/^https?:$/.test(location.protocol)) return;
  try {
    const r = await fetch('/api/health', { cache: 'no-store' }); if (!r.ok) return; const h = await r.json(); if (!h || !h.ok) return;
    NC.server = true; try { NC.config = await (await fetch('/api/config', { cache: 'no-store' })).json(); } catch (e) { }
    await loadScript('ops.js'); await loadScript('js/voice.js'); await loadScript('multi.js');
    $('#modeSel').style.display = ''; NC.settings.playMode = 'online'; document.querySelector('#modeSel [data-m=online]').classList.add('on');
    if (NC.entry && NC.entry.onlineCount) NC.entry.onlineCount(h.online || 0);
    $('#badge').textContent = NC.config.llm ? 'SERVER · AI' : 'SERVER';
  } catch (e) { console.warn('서버 없음 → 데모 모드', e); }
})();
})();
