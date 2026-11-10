/* nightlife.js — v12 밤의 이벤트
 *  ① 스테이지에서 10초 가만히 있으면 여성 손님이 먼저 다가와 말을 건다(1분 쿨타임)
 *  ② 술 취한 아가씨: 가끔 한두 명이 비틀거리며 걷고 휘청임 · 가까이 가면 「🤝 부축해 주기」
 *  ③ 19금 대화: 여성이 먼저 거는 수위 있는 멘트 + 대화 칩 「😏 수위 높은 농담」(호감도에 따라 수위↑, 노골적 묘사 없음)
 *  ④ 골든벨(골드): DJ 부스 옆 금색 종 → 울리면 3분간 클럽 술값 ALL PAY(무료) + 여성 손님들이 대쉬
 */
(() => {
'use strict';
const NC = window.NC, T = window.THREE, U = NC.util, W = NC.world, Mo = NC.Motion;
const P = () => NC.player;
const female = n => n.gender === 'f' && (n.role === 'persona' || n.role === 'crowd');
const free = n => !n.booked && !n.karaoke && !n.stay && !n.drunkHelp && !['seated', 'talk', 'blues', 'karaoke'].includes(n.state) && n !== (NC.Karaoke && NC.Karaoke.BL && NC.Karaoke.BL.n);
const inClub = () => !(NC.Karaoke && NC.Karaoke.inRoom) && !['restroom', 'smoke', 'karaoke'].includes(P().zone);
function summon(n, x, z) {          // 온라인 모드에서 꺼져 있던 손님을 불러올 때
  if (n.state === 'off' || !n.enabled || !n.g.visible) { n.enabled = true; n.state = 'wander'; n.x = x; n.z = z; n.g.position.set(x, NC.groundY(x, z), z); n.g.visible = true; }
}

/* ── 머리 위 말풍선 (가벼운 스프라이트) ── */
function bubble(g, text, sec = 2.6) {
  const cv = document.createElement('canvas'), c = cv.getContext('2d'); cv.width = 512; cv.height = 128;
  c.font = 'bold 44px sans-serif'; const w = Math.min(500, c.measureText(text).width + 50);
  c.fillStyle = 'rgba(20,8,30,.82)'; c.strokeStyle = '#ff7ab8'; c.lineWidth = 5; const x0 = (512 - w) / 2;
  c.beginPath(); c.roundRect ? c.roundRect(x0, 14, w, 86, 30) : c.rect(x0, 14, w, 86); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 58);
  const tx = new T.CanvasTexture(cv), sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthTest: false }));
  sp.scale.set(1.3, .325, 1); sp.position.y = 2.15; sp.renderOrder = 20; g.add(sp);
  const t0 = performance.now(); const tk = () => { const e = (performance.now() - t0) / 1000; sp.position.y = 2.15 + e * .06; sp.material.opacity = Math.min(1, (sec - e) * 2); if (e < sec) requestAnimationFrame(tk); else { g.remove(sp); tx.dispose(); sp.material.dispose(); } }; tk();
}
NC.bubble = bubble;

/* ── ③ 19금 멘트 풀 ── */
const APPROACH = [
  '저기요… 아까부터 혼자 서 있길래요. 저랑 한 곡 출래요? 😏', '오빠 여기 처음이죠? 눈빛이 너무 순진해서 말 걸어 봤어요 ㅎㅎ',
  '그렇게 가만히 서 있으면 반칙이에요. 자꾸 쳐다보게 되잖아요 💋', '혹시 여자친구 있어요? …없으면 오늘 밤 저랑 놀아요',
  '향수 뭐 써요? 지나가다 냄새 맡고 홀린 듯 왔어요 ㅋㅋ', '심심해 보여서요. 제가 오늘 밤 책임져 줄까요? 😉',
  '춤 안 춰요? 저 춤추는 사람보다 가만히 있는 사람이 더 궁금하던데…', '이 노래 끝나기 전에 번호 안 물어보면 제가 먼저 물어볼 거예요 ㅎㅎ',
  '오늘 좀 취했는데… 기대도 되는 어깨 찾고 있었거든요 💗', '여기 너무 덥지 않아요? 저 땀나서 그런데… 같이 바람 쐬러 갈래요?',
];
const SPICY = {   // 호감도 구간별 (낮음 → 높음)
  lo: ['아직 우리 그런 농담 할 사이 아니거든요? ㅋㅋ 한 잔 더 하면 생각해 볼게요', '어머, 첫 만남에 그런 말 하는 사람 처음 봐요 ㅎㅎ 근데 싫진 않네요', '농담은 좋은데… 저 쉬운 여자 아니에요 😏'],
  mid: ['오빠 손 크네요… 손 큰 남자가 다른 것도 잘한다던데? 춤 말이에요, 춤 ㅋㅋㅋ', '저 술 마시면 좀 과감해지는 스타일이에요. 오늘 몇 잔 마셨게요? 💋',
    '키스 잘해요? 아니 그냥… 궁금해서요. 테스트해 볼까 하고 ㅎㅎ', '여기 조명 너무 어두워서 무슨 일 생겨도 아무도 모르겠다… 그쵸? 😉', '저 오늘 속옷 색깔 맞혀 보면 술 한 잔 살게요. 힌트는… 비밀 ㅋㅋ'],
  hi: ['오늘 집에 일찍 들어가기 싫은데… 오빠가 책임질 거예요? 💗', '이렇게 가까이 있으니까 심장 소리 들리죠? 다 오빠 때문이에요', '자꾸 그렇게 보면 저 진짜 못 참아요… 귀에 대고 말해 줄까요? 🔥',
    '나중에 둘만 있을 때 아까 부르스 2절 해요. 이번엔 조명 끄고 ㅎㅎ', '오빠는 키스할 때 눈 감는 스타일? 뜨는 스타일? …오늘 확인해 보면 되겠다 💋'],
};
const spicyLine = n => { const a = n.aff || 40; return U.pick(a >= 80 ? SPICY.hi : a >= 55 ? SPICY.mid : SPICY.lo); };
(NC.dialogChips = NC.dialogChips || []).push((n, CHIP) => {
  if (n.gender !== 'f' || n.role === 'staff') return;
  CHIP('😏 수위 높은 농담', () => { const D = NC.Dialog; D.sys('😏 은근한 농담을 던진다'); const d = (n.aff || 40) >= 50 ? 2 : -1; n.aff = U.clamp((n.aff || 40) + d, 0, 100); D.floatDelta && D.floatDelta(d); D.renderHead && D.renderHead();
    setTimeout(() => { if (D.cur && D.cur.n === n) { D.npcSay(spicyLine(n), n.aff >= 55 ? 'shy' : 'laugh'); Mo.play(n.g, n.aff >= 55 ? 'laugh' : 'headshake'); } }, 600); });
});

/* ── ① 스테이지 10초 대기 → 여성이 먼저 접근 ── */
let idleSince = 0, lastPos = null, coolUntil = performance.now() + 20000, approaching = null;   // 실제 시각(ms) 기준 — 프레임이 느려도 '10초'가 정확
function startApproach() {
  const p = P(), cands = (NC.npcs || []).filter(n => female(n) && free(n) && (n.cool || 0) <= 0);
  if (!cands.length) return; const n = cands.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[Math.floor(Math.random() * Math.min(3, cands.length))];
  summon(n, p.x + 5, p.z + 4); approaching = n; n.cool = 0;
  const ang = p.ry || 0, tx = p.x + Math.sin(ang) * .95, tz = p.z + Math.cos(ang) * .95;
  NC.ui.toast(`💃 ${n.name}이(가) 당신을 보며 다가와요…`);
  NC.NPC.goTo(n, { x: tx, z: tz }, () => {
    approaching = null; if (NC.Dialog.cur || P().busy) { NC.NPC.release(n); return; }
    n.aff = Math.max(n.aff || 40, 52); n.bl = n.bl || { kissed: false, warned: 0 };
    n.g.userData.lookAt = P().group.position; Mo.play(n.g, 'wave'); bubble(n.g, '저기요~ 💋');
    setTimeout(() => { if (!NC.Dialog.cur) NC.Dialog.open(n, { intro: U.pick(APPROACH) }); }, 700);
  }, 2.4);
}
NC.tickers.push(dt => {
  const p = P(); if (!p || !p.group) return;
  if (approaching) { const n = approaching; if (Math.hypot(n.x - p.x, n.z - p.z) > 9 || NC.Dialog.cur || p.zone !== 'stage') { approaching = null; if (!NC.Dialog.cur || NC.Dialog.cur.n !== n) NC.NPC.release(n); } return; }
  const moved = !lastPos || Math.hypot(p.x - lastPos.x, p.z - lastPos.z) > .05; lastPos = { x: p.x, z: p.z };
  const quiet = p.zone === 'stage' && !moved && !p.seat && !p.busy && !NC.Dialog.cur && !p.autoPath && !(NC.Karaoke && NC.Karaoke.BL && NC.Karaoke.BL.n);
  const now = performance.now(); if (!quiet) idleSince = now; else if (!idleSince) idleSince = now;
  if (quiet && now - idleSince > 10000 && now > coolUntil) { idleSince = now; coolUntil = now + 60000; startApproach(); }
});

/* ── ② 술 취한 아가씨 ── */
const drunks = new Set(); let drunkT = 12;
const HIC = ['히끅~ 🥴', '어지러워… ㅋㅋ', '나 안 취했어!', '한 잔만 더~', '오빠 누구야? ㅎㅎ', '바닥이 왜 움직여…'];
function makeDrunk(n, sec) { n.drunk = true; n.g.userData.drunk = true; n.drunkUntil = performance.now() + sec * 1000; n.nextHic = 3 + Math.random() * 4; drunks.add(n); bubble(n.g, '히끅~ 🥴'); }
function sober(n) { n.drunk = false; n.g.userData.drunk = false; n.drunkHelp = false; drunks.delete(n); }
NC.tickers.push(dt => {
  if ((drunkT -= dt) <= 0) { drunkT = 35 + Math.random() * 35;
    if (drunks.size < 2 && inClub()) { const c = (NC.npcs || []).filter(n => female(n) && free(n) && n.enabled && n.state === 'wander' && !n.drunk); if (c.length) makeDrunk(U.pick(c), 60 + Math.random() * 40); } }
  for (const n of drunks) {
    if (performance.now() > n.drunkUntil || !n.enabled) { sober(n); continue; }
    if ((n.nextHic -= dt) <= 0) { n.nextHic = 5 + Math.random() * 6;
      if (n.state === 'wander' && Math.random() < .55) { n.pause = 1.4; Mo.play(n.g, Math.random() < .5 ? 'flinch' : 'laugh'); }      // 휘청
      if (Math.hypot(n.x - P().x, n.z - P().z) < 9) bubble(n.g, U.pick(HIC)); }
  }
});
NC.interactProviders.push(() => {
  const p = P(), out = []; if (NC.Dialog.cur) return out;
  for (const n of drunks) { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < 2.2 && n.state !== 'talk')
    out.push({ label: `🤝 ${n.name} 부축해 주기 (E)`, dist: d - .2, run: () => {
      n.drunkHelp = true; n.state = 'talk'; n.pause = 0; n.aff = U.clamp((n.aff || 40) + 8, 0, 100); Mo.play(P().group, 'bow');
      bubble(n.g, '고마워요… 💗'); NC.ui.toast(`💗 ${n.name} 호감도 +8 — 부축해 줬어요`);
      setTimeout(() => { sober(n); NC.Dialog.open(n, { intro: U.pick(['아… 고마워요. 나 원래 이렇게 안 취하는데… 오빠 때문에 더 취한 것 같아요 ㅎㅎ 💗', '헤헤… 잡아 줘서 고마워요. 책임지고 물 한 잔 사 줄래요? 😉', '오빠 팔 단단하다… 조금만 더 기대 있어도 돼요?']) }); }, 500);
    } }); }
  return out;
});

/* ── ④ 골든벨 ── */
const BELL = { x: 7.2, z: -15.3 }, gold = NC.mat && NC.mat.std ? NC.mat.std('#ffcf3d', { metalness: 1, roughness: .18, emissive: '#5a3a00' }) : new T.MeshStandardMaterial({ color: 0xffcf3d, metalness: 1, roughness: .18 });
const bellG = new T.Group(), swing = new T.Group(); bellG.position.set(BELL.x, NC.groundY(BELL.x, BELL.z), BELL.z);
{ const dark = NC.mat && NC.mat.std ? NC.mat.std('#1a1220', { metalness: .6, roughness: .3 }) : new T.MeshStandardMaterial({ color: 0x1a1220 });
  const post = (x) => { const m = new T.Mesh(new T.CylinderGeometry(.035, .045, 1.9, 12), gold); m.position.set(x, .95, 0); bellG.add(m); }; post(-.42); post(.42);
  const bar = new T.Mesh(new T.CylinderGeometry(.03, .03, .92, 12), gold); bar.rotation.z = Math.PI / 2; bar.position.y = 1.88; bellG.add(bar);
  const base = new T.Mesh(new T.CylinderGeometry(.55, .62, .08, 28), dark); base.position.y = .04; bellG.add(base);
  swing.position.y = 1.86; bellG.add(swing);
  const prof = [[0, 0], [.07, -.01], [.11, -.06], [.14, -.18], [.17, -.32], [.24, -.44], [.27, -.48], [.25, -.5], [0, -.5]].map(([a, b]) => new T.Vector2(a, b));
  const bell = new T.Mesh(new T.LatheGeometry(prof, 36), gold); bell.castShadow = true; swing.add(bell);
  const clap = new T.Mesh(new T.SphereGeometry(.05, 14, 10), gold); clap.position.y = -.46; swing.add(clap);
  const lightB = new T.Mesh(new T.SphereGeometry(.03, 8, 6), new T.MeshBasicMaterial({ color: 0xfff2b0 })); lightB.position.y = .02; swing.add(lightB);
  // 간판
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d');
  const gr = c.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, '#b8860b'); gr.addColorStop(.5, '#ffe58a'); gr.addColorStop(1, '#b8860b');
  c.fillStyle = '#140a1c'; c.fillRect(0, 0, 512, 128); c.strokeStyle = gr; c.lineWidth = 8; c.strokeRect(6, 6, 500, 116);
  c.fillStyle = gr; c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🔔 GOLDEN BELL', 256, 66);
  const sign = new T.Mesh(new T.PlaneGeometry(.95, .24), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true })); sign.position.set(0, 2.12, .02); bellG.add(sign);
  const glow = new T.PointLight(0xffc840, .0, 4, 2); glow.position.y = 1.5; bellG.add(glow); bellG.userData.glow = glow;
  NC.scene.add(bellG); W.circles.push([BELL.x, BELL.z, .55]);
}
let ringT = 0, freeUntil = 0;
NC.goldenFree = () => performance.now() < freeUntil;
const guests = () => (NC.npcs || []).filter(n => n.enabled && n.g.visible && (n.role === 'persona' || n.role === 'crowd')).length;
const bellCost = () => 50 + guests() * 8;
function ringBell() {
  const cost = bellCost();
  NC.ui.modal(`<h3>🔔 골든벨을 울릴까요?</h3><p style="line-height:1.7">지금 클럽 손님 <b>${guests()}명</b>의 술값을 3분 동안 전부 내가 냅니다 (ALL PAY).<br>비용: <b style="color:#ffd23d">🪙${cost}</b> · 보유 🪙${NC.Wallet.get()}</p>`, [['🔔 울린다!', 'ok', true], ['취소', 0]]).then(r => {
    if (r.val !== 'ok') return; if (!NC.Wallet.spend(cost)) return NC.ui.toast(`🪙 코인이 부족해요 (${cost} 필요)`);
    ringT = 3.2; freeUntil = performance.now() + 180000; bellG.userData.glow.intensity = 2.5;
    
    NC.ui.toast(`🎧 DJ: "🔔 골든벨~!! 오늘 술값은 ${NC.settings.name}님이 쏩니다! ALL PAY 3분!"`);
    NC.ui.chatAdd && NC.ui.chatAdd('DJ 노스탤지어', `🔔 골든벨! ${NC.settings.name}님 ALL PAY! 3분간 모든 주문 무료~ 🥂`);
    if (NC.fx && NC.fx.confetti && NC.quality && NC.quality.level !== 'low') NC.fx.confetti(0, 3, -15, 80);
    (NC.npcs || []).forEach(n => { if (n.enabled && n.g.visible && n.state !== 'seated' && Math.random() < .8) setTimeout(() => Mo.play(n.g, 'cheer'), Math.random() * 900); });
    NC.DJ && Mo.play(NC.DJ, 'cheer');
    setTimeout(dash, 1800);
  });
}
function dash() {        // ⑯ 여성 손님들이 골든벨 울린 사람에게 대쉬
  const p = P(), pool = (NC.npcs || []).filter(n => female(n) && free(n)).sort(() => Math.random() - .5).slice(0, 4); if (!pool.length) return;
  const LINES = ['오빠 완전 멋있다~ 💗', '골든벨 오빠! 저랑 한 잔 해요!', '와 진짜 플렉스다… 반했어요 💋', '오빠 옆자리 비었죠? 😍', '저 오빠 팬 할래요!!'];
  pool.forEach((n, i) => {
    const a = (p.ry || 0) + (i - (pool.length - 1) / 2) * .7, tx = p.x + Math.sin(a) * 1.15, tz = p.z + Math.cos(a) * 1.15;
    summon(n, p.x + (Math.random() - .5) * 10, p.z + 6 + Math.random() * 3); n.cool = 0; n.state = 'path';
    setTimeout(() => NC.NPC.goTo(n, { x: tx, z: tz }, () => {
      n.aff = U.clamp((n.aff || 40) + 15, 0, 100); n.bl = n.bl || { kissed: false, warned: 0 }; n.g.userData.lookAt = p.group.position; n.state = 'wander'; n.pause = 6; n.wp = { x: n.x, z: n.z, act: 'stand' };
      Mo.play(n.g, i % 2 ? 'clap' : 'wave'); bubble(n.g, LINES[i % LINES.length], 3.2);       if (i === 0) setTimeout(() => { if (!NC.Dialog.cur) NC.Dialog.open(n, { intro: U.pick(['골든벨 울린 거 오빠죠? 와… 오늘 밤 오빠 옆에 딱 붙어 있을래요 💗', '오빠 진짜 멋있어요. 저 원래 먼저 말 안 거는데… 오늘은 예외예요 😘', '술 잘 마실게요 오빠~ 대신 제가 부르스 한 곡 쏠게요 💋']) }); }, 1200);
    }, 3.4 + Math.random() * .6), i * 250);
  });
  NC.ui.toast(`💘 여성 손님 ${pool.length}명이 당신에게 달려와요!`);
}
NC.tickers.push(dt => {
  if (ringT > 0) { ringT -= dt; swing.rotation.z = Math.sin(ringT * 12) * .5 * Math.min(1, ringT); }
  const gl = bellG.userData.glow; if (gl.intensity > 0 && !NC.goldenFree()) gl.intensity = Math.max(0, gl.intensity - dt);
  else if (NC.goldenFree()) gl.intensity = 1.6 + .6 * Math.sin(performance.now() / 200);
});
NC.interactProviders.push(() => {
  const p = P(), d = Math.hypot(p.x - BELL.x, p.z - BELL.z); if (d > 2.4 || NC.Dialog.cur) return [];
  return [{ label: NC.goldenFree() ? `🔔 골든벨 ALL PAY 진행 중 (${Math.ceil((freeUntil - performance.now()) / 1000)}초)` : `🔔 골든벨 울리기 (🪙${bellCost()})`, dist: d - .3, run: () => { if (NC.goldenFree()) return NC.ui.toast('🔔 이미 ALL PAY 진행 중이에요! 마음껏 주문하세요 🥂'); ringBell(); } }];
});
NC.Nightlife = { bubble, makeDrunk, startApproach, ringBell, dash, BELL, resetCool: () => { coolUntil = 0; } };
console.info('[nightlife] 골든벨 · 취한 손님 · 먼저 말 거는 손님 준비 완료');
})();
