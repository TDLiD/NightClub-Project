/* stage.js — v24 무대 연출
 *  ① 원통형 포디움 2개(world.js W.podiums) 위에서 무대 댄서 2명씩 화려한 군무 — 4박마다 안무 전환, 같은 포디움 2명은 같은 안무
 *  ② DJ 루나에게 팁 주기 → DJ가 부스에서 내려와 무대 앞 가운데에서 스포트라이트 받으며 댄스 공연 → 끝나면 부스로 복귀
 *     (팁 🪙10 = 12초 · 🪙30 = 20초 · 🪙50 = 30초 + 꽃가루)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const W = NC.world, U = NC.util, Mo = NC.Motion, P = () => NC.player, pk = a => a[Math.floor(Math.random() * a.length)];
const MOVES = ['breaking', 'robot', 'disco', 'techno', 'pump', 'vogue', 'runMan', 'hairFlip'];
const beat = () => (NC.Audio && NC.Audio.beat ? NC.Audio.beat() : { n: Math.floor(performance.now() / 469), phase: (performance.now() / 469) % 1 });
const FXo = () => NC.Features || {};

/* ═════ ① 포디움 무대 댄서 ═════ */
const DANCER_LOOKS = [
  ['폴댄서 아라', { gender: 'f', realModel: 'f_15', height: 1.7, idol: true, hairStyle: 'highPony', hairColor: '#120c10', hair2: '#ff3d9a', top: 'crop', topColor: '#ff2d8a', bottom: 'shorts', mini: true, bottomColor: '#141016', shoes: 'boots', shoeColor: '#141016', pattern: 'solid', hat: null, curve: .42, choker: true, face: { lipColor: '#c4475a', shadow: '#d070a0', liner: .9, earring: true } }],   // v28 폴 피트니스 의상(스포츠 크롭 + 숏츠)
  ['폴댄서 미오', { gender: 'f', realModel: 'f_16', height: 1.7, idol: true, hairStyle: 'long', hairColor: '#d8c8e8', top: 'crop', topColor: '#22d3ff', bottom: 'shorts', mini: true, bottomColor: '#141016', shoes: 'boots', shoeColor: '#141016', pattern: 'solid', hat: null, curve: .42, face: { lipColor: '#d0566a', shadow: '#6a8ad8', liner: .9, earring: true } }],
  ['댄서 레이', { gender: 'f', realModel: 'f_09', height: 1.7, idol: true, hairStyle: 'highPony', hairColor: '#c8c4d8', hair2: '#3de6ff', top: 'stageJacket', topColor: '#1a7ad4', inner: 'tee', innerColor: '#f4f2ee', bottom: 'cargo', bottomColor: '#141016', shoes: 'boots', chain: true, pattern: 'solid', hat: null, curve: .4, face: { lipColor: '#d0566a', shadow: '#6a8ad8', attractive: true } }],
  ['댄서 제이', { gender: 'f', realModel: 'f_03', height: 1.7, idol: true, hairStyle: 'long', hairColor: '#160e12', top: 'crop', topColor: '#d8dce6', metallic: true, bottom: 'shorts', mini: true, bottomColor: '#141016', shoes: 'boots', shoeColor: '#141016', pattern: 'solid', hat: null, curve: .42, choker: true, face: { lipColor: '#c0384e', attractive: true } }],
];
const dancers = [];
function spawnDancers() {
  if (dancers.length || !W.podiums) return;
  W.podiums.forEach((pd, i) => {
    const ry = Math.atan2(0 - pd.x, -2 - pd.z);   // 홀 가운데를 바라봄
    (i === 0 ? [-.62, .62] : [-.48, .48]).forEach((off, k) => {
      const [name, look] = DANCER_LOOKS[i * 2 + k];
      const g = NC.Avatar.create({ name, look, seed: U.hash(name), expr: 'smile', hiRes: true, labelColor: '#ff9ad5' });
      const x = pd.x + Math.cos(ry) * off, z = pd.z - Math.sin(ry) * off;
      g.position.set(x, pd.y, z); g.rotation.y = ry; NC.scene.add(g);
      const u = g.userData; u.dance = 'stageDance'; u.danceStyle = MOVES[i % MOVES.length];
      const d = { g, pd: i, ry };
      if (i === 0) {   // v28 왼쪽 원형 무대 = 폴 댄스: 각자 크롬 폴 하나씩, 폴 주위를 돌며 걷기·회전·매달리기·바디 웨이브
        const px = x, pz = z, pole = new NC.THREE.Mesh(new NC.THREE.CylinderGeometry(.026, .026, 3.4, 14), NC.mat.std('#e8e8f0', { roughness: .12, metalness: 1 }));
        pole.position.set(px, pd.y + 1.7, pz); NC.scene.add(pole); u.dance = 'pole'; Object.assign(d, { pole: { x: px, z: pz }, th: k * Math.PI, y: pd.y, lift: 0 });
      }
      dancers.push(d);
    });
  });
}
let lastBeat = -1;
/* v28 폴 댄스 동작 순서(32박 주기): 걷기 8 → 회전 8 → 바디 웨이브 8 → 회전 4 → 매달리기 4 */
const POLE_SEQ = [[8, 'walk'], [8, 'spin'], [8, 'wave'], [4, 'spin'], [4, 'climb']], POLE_R = .32;
function poleTick(d, dt, b) {
  const u = d.g.userData, n = (b.n + (d.th > 1 ? 16 : 0)) % 32; let acc = 0, ph = 'walk'; for (const [len, name] of POLE_SEQ) { if (n < acc + len) { ph = name; break; } acc += len; }
  u.polePhase = ph; const w = ph === 'walk' ? .75 : ph === 'spin' ? 2.6 : ph === 'climb' ? 1.6 : .15;
  d.th += w * dt; d.lift += ((ph === 'climb' ? .5 : 0) - d.lift) * Math.min(1, dt * 3);
  const ox = Math.sin(d.th) * POLE_R, oz = Math.cos(d.th) * POLE_R; d.g.position.set(d.pole.x + ox, d.y + d.lift, d.pole.z + oz); d.g.rotation.y = d.th + Math.PI / 2;
}
/* v56 오른쪽 원형 무대 안무: 두 댄서가 무대(반지름 1.3m) 안쪽 0.5m 원 위에서 16박마다 자리를 바꾸며(2박 동안 걸어서) 관객 쪽을 보고 춤,
 *  12박째엔 한 바퀴 턴(1.5박), 그 사이엔 박자에 맞춰 몸을 좌우로 살짝 틀어 줌 · 항상 서로 반대편(겹치지 않음) · 가장자리 0.45m 안쪽만(떨어지지 않음) */
function routineTick(d, dt, b) {
  const pd = W.podiums[d.pd]; if (!pd) return; const k = dancers.filter(o => o.pd === d.pd).indexOf(d), t = b.n + b.phase, cyc = Math.floor(t / 16), lb = t - cyc * 16;
  const slot = (c) => (c + k) % 2 ? 1 : -1, s0 = slot(cyc), s1 = slot(cyc + 1), mv = lb > 14 ? (lb - 14) / 2 : 0, e = mv * mv * (3 - 2 * mv);
  const side = s0 + (s1 - s0) * e, R = Math.min(.5, pd.r - .45), ang = d.ry + Math.PI / 2, arc = Math.sin(Math.PI * e) * .28 * (k ? 1 : -1);
  const x = pd.x + Math.cos(ang) * 0 + Math.sin(ang) * side * R + Math.sin(d.ry) * arc, z = pd.z + Math.cos(ang) * side * R + Math.cos(d.ry) * arc;
  const g = d.g; g.position.x += (x - g.position.x) * Math.min(1, dt * 8); g.position.z += (z - g.position.z) * Math.min(1, dt * 8); g.position.y = pd.y;
  const spin = lb >= 12 && lb < 13.5 ? (lb - 12) / 1.5 : lb >= 13.5 ? 1 : 0, se = spin * spin * (3 - 2 * spin);
  const sway = Math.sin((t + k * .5) * Math.PI) * .35 * (1 - (mv > 0 ? 1 : 0)), face = d.ry + sway + (k ? -.25 : .25) + se * Math.PI * 2 * (k ? -1 : 1);
  g.rotation.y = face; g.userData.moving = mv > 0 && mv < 1;
}
function tickDancers(dt) {
  if (!dancers.length) return; const b = beat(), cam = NC.camera;
  if (b.n !== lastBeat) { lastBeat = b.n;
    if (b.n % 4 === 0) dancers.filter(d => d.pd === 1).forEach((d, k) => { d.g.userData.danceStyle = MOVES[(Math.floor(b.n / 4) + k * 3) % MOVES.length]; });   // v56 같은 무대 두 사람도 서로 다른 안무(동시에 똑같이 움직이지 않음)
    dancers.forEach((d, k) => { const u = d.g.userData, lb = (b.n + k * 5) % 16;
      if (!d.pole && lb === 8) Mo.play(d.g, pk(['cheer', 'point', 'wave', 'cheer']));                                                     // 관객에게 포인트 동작
      if (lb === 4 && Math.random() < .55) { u.setExpr && u.setExpr(pk(['wink', 'joy', 'laugh', 'smile']), 1.6); }                     // 표정: 윙크·환한 웃음
      if (lb === 10 && Math.random() < .5) { const p = P(); if (p && p.group) { u.lookAt = p.group.position; setTimeout(() => { if (u.lookAt === p.group.position) u.lookAt = null; }, 1800); } }   // 관객(나)과 눈맞춤
    });
  }
  dancers.forEach(d => { if (d.pole) poleTick(d, dt, b); else routineTick(d, dt, b); Mo.update(d.g, dt, { near: !cam || cam.position.distanceTo(d.g.position) < 22, speed: 1 }); if (cam && NC.Avatar.fitLabel) NC.Avatar.fitLabel(d.g, cam); });
}

/* ═════ ② DJ 팁 → 무대 앞 댄스 선물 ═════ */
const SHOW = { on: false, phase: null, t: 0, dur: 0, path: [], lastBeat: -1, big: false };
const STAGE_FRONT = { x: 0, z: -14.3 };
function djPathOut() { const d = W.zones.dj, s = W.spots.dj; return [{ x: d.x1 - .35, z: d.z0 + .9 }, { x: d.x1 + 1.35, z: d.z0 + .9 }, { x: STAGE_FRONT.x - 1.5, z: STAGE_FRONT.z - .4 }, STAGE_FRONT]; }
function djPathBack() { const d = W.zones.dj, s = W.spots.dj; return [{ x: d.x1 + 1.35, z: d.z0 + .9 }, { x: d.x1 - .35, z: d.z0 + .9 }, { x: s.x, z: s.z }]; }
function tipDialog() {
  const p = P(); if (SHOW.on) return NC.ui.toast('💃 DJ 루나가 지금 무대에서 공연 중이에요!');
  p.busy = true; const done = () => { NC.ui.hideDlg(); p.busy = false; };
  const tip = (coin, sec, line) => () => { done(); if (!NC.Wallet.spend(coin)) return NC.ui.toast('🪙 코인이 부족해요'); showStart(sec, coin >= 50, line); };
  NC.ui.showDlg({ name: 'DJ 루나', tag: '🎧 DJ 부스', job: `🪙 ${NC.Wallet.get()}`, say: '어머, 팁이요? 😍 고마워요~ 팁 주시면 제가 무대 앞에서 특별 공연 선물할게요! 💃',
    opts: [
      { t: '💵 팁 🪙10 — 짧은 댄스 (12초)', run: tip(10, 12, '고마워요~ 잠깐 내려가서 한 곡 출게요! 🎶') },
      { t: '💵 팁 🪙30 — 스페셜 댄스 (20초)', run: tip(30, 20, '와~ 통 크시다! 제대로 보여 드릴게요!! 🔥') },
      { t: '💰 팁 🪙50 — 꽃가루 쇼 + 풀 퍼포먼스 (30초)', run: tip(50, 30, '오늘의 VIP!! 꽃가루 준비해 주세요~!! ✨') },
      { t: '그냥 인사만 할게요', run: () => { done(); NC.bubble && NC.bubble(NC.DJ, '즐거운 밤 보내요~ 😘', 2.2); Mo.play(NC.DJ, 'wave'); } },
    ] });
}
function showStart(sec, big, line) {
  const dj = NC.DJ; if (!dj || SHOW.on) return;
  Object.assign(SHOW, { on: true, phase: 'out', t: 0, dur: sec, path: djPathOut(), lastBeat: -1, big });
  NC.bubble && NC.bubble(dj, line, 2.6); Mo.play(dj, 'bow'); dj.userData.dance = null;
  const F = FXo(); F.announce && F.announce(`💃 ${(NC.settings && NC.settings.name) || '손님'} 님의 팁! DJ 루나 무대 앞 스페셜 공연!!`, 5, '#ff3d9a');
  if (W.ledMessage) W.ledMessage('💃 DJ LUNA SPECIAL SHOW', 4, '#ff3d9a');
  NC.ui.chatAdd && NC.ui.chatAdd('DJ 루나', `💕 ${(NC.settings && NC.settings.name) || '손님'} 님 팁 감사합니다~! 무대 앞으로 나갈게요!`);
}
function walkStep(g, dt, speed) {
  const tgt = SHOW.path[0]; if (!tgt) return true; const u = g.userData, dx = tgt.x - g.position.x, dz = tgt.z - g.position.z, d = Math.hypot(dx, dz);
  if (d < .08) { SHOW.path.shift(); return !SHOW.path.length; }
  const k = Math.min(1, speed * dt / d); g.position.x += dx * k; g.position.z += dz * k; u.moving = true;
  const ry = Math.atan2(dx, dz), rel = ((ry - g.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; g.rotation.y += rel * Math.min(1, dt * 10);
  return false;
}
function tickShow(dt) {
  if (!SHOW.on) return; const dj = NC.DJ, u = dj.userData, F = FXo(); SHOW.t += dt;
  const gy = NC.groundY(dj.position.x, dj.position.z); dj.position.y += (gy - dj.position.y) * Math.min(1, dt * 8);   // 계단을 부드럽게
  if (SHOW.phase === 'out') {
    if (walkStep(dj, dt, 1.8)) { u.moving = false; SHOW.phase = 'dance'; SHOW.t = 0; dj.rotation.y = 0; u.dance = 'stageDance'; u.danceStyle = pk(MOVES);
      if (F.borrowSpot) F.borrowSpot('djshow', '#ff9ad5', 4.5, .26);
      (NC.npcs || []).filter(n => n.enabled && n.g.visible && Math.hypot(n.x - dj.position.x, n.z - dj.position.z) < 16).forEach((n, i) => setTimeout(() => { if (n.state === 'wander' || n.state === 'seated' || n.state === 'party') { n.g.userData.lookAt = dj.position; Mo.play(n.g, pk(['cheer', 'clap'])); } }, i * 70)); }
  } else if (SHOW.phase === 'dance') {
    const b = beat(), L = W.lights && W.lights.ball, tg = F.spotTarget && F.spotTarget();
    if (L && tg) { tg.position.set(dj.position.x, dj.position.y, dj.position.z); L.position.set(dj.position.x + .4, dj.position.y + 8, dj.position.z + 2); L.color.setHSL((SHOW.t * .12 + b.n * .04) % 1, .7, .72); L.intensity = 3.5 + 2.5 * (1 - b.phase); }
    if (b.n !== SHOW.lastBeat) { SHOW.lastBeat = b.n;
      if (b.n % 4 === 0) u.danceStyle = pk(MOVES);
      if (b.n % 8 === 0) { Mo.play(dj, pk(['cheer', 'point', 'wave'])); F.fx && F.fx.burst && F.fx.burst(dj.position.x, dj.position.y + 2.2, dj.position.z, { n: SHOW.big ? 140 : 60, colors: ['#ff3d9a', '#3de6ff', '#ffd23d', '#ffffff'], up: SHOW.big ? 3.2 : 2.2, spread: SHOW.big ? 3 : 1.6, life: 1.6, size: .06 }); }
      if (b.n % 2 === 0 && F.fx && F.fx.floatEmoji) F.fx.floatEmoji(dj.position.x, dj.position.y + 2.4, dj.position.z, pk(['💃', '🔥', '✨', '💖']));
      if (SHOW.big && b.n % 16 === 0 && NC.fireCO2) NC.fireCO2(); }
    if (SHOW.t >= SHOW.dur) { SHOW.phase = 'back'; SHOW.path = djPathBack(); u.dance = null; Mo.play(dj, 'bow'); NC.bubble && NC.bubble(dj, '감사합니다~!! 💕 다시 음악 달릴게요!', 2.4); if (F.releaseSpot) F.releaseSpot('djshow');
      (NC.npcs || []).forEach(n => { if (n.g.userData.lookAt === dj.position) n.g.userData.lookAt = null; }); }
  } else if (SHOW.phase === 'back') {
    if (walkStep(dj, dt, 1.8)) { u.moving = false; const s = W.spots.dj; dj.position.set(s.x, s.y, s.z); dj.rotation.y = s.ry || 0; u.dance = 'djHype'; SHOW.on = false; SHOW.phase = null; }
  }
}

/* E 상호작용: DJ 부스 앞에서 팁 주기 */
NC.interactProviders.push(() => {
  const p = P(), out = []; if (!p.group || p.seat || p.busy || !NC.DJ || SHOW.on) return out;
  const s = W.spots.dj, fx = s.x + Math.sin(s.ry || 0) * 2.6, fz = s.z + Math.cos(s.ry || 0) * 2.6, d = Math.hypot(p.x - fx, p.z - fz);
  if (d < 2.4) out.push({ label: '💵 DJ 루나에게 팁 주기 (E)', dist: d - .1, run: tipDialog });
  return out;
});

NC.tickers.push(dt => { tickDancers(dt); tickShow(dt); });
const begin = () => { if ('requestIdleCallback' in window) requestIdleCallback(spawnDancers, { timeout: 1500 }); else setTimeout(spawnDancers, 300); };
NC.on && NC.on('start', begin);

NC.Stage = { tip: tipDialog, show: showStart, dancers, SHOW };
console.info('[stage] 포디움 댄서 4명 · DJ 루나 팁 공연 준비 완료');
})();
