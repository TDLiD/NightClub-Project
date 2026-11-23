/* fight.js — v35 무대(스테이지·댄스플로어)에서 남성 손님과 「😤 시비 걸기」 → 말다툼 → 몸싸움(실랑이) → 가드가 말림
 *  ─ 부킹 대화창 칩으로 시작. 말다툼 3단계 동안 언제든 「🙏 사과」로 물러날 수 있음
 *  ─ 몸싸움은 멱살 잡기·밀치기·헛손질 위주의 과장된 실랑이(부상 묘사 없음) → 가드가 와서 떼어 놓음
 *  ─ 결과: 호감도 크게 하락 · 벌금 🪙10 · 그 손님은 3분간 말 걸기 불가 · 주변 손님들이 구경·박수
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, Mo = NC.Motion, D = NC.Dialog;
const P = () => NC.player;
const ARGUE = [
  ['저기요, 아까부터 제 자리 계속 밀치시던데요?', '뭐요? 제가 언제요? 춤추다 보면 그럴 수도 있지.'],
  ['그럴 수도 있다뇨, 사과 한마디면 되는 거잖아요.', '아니 무대에서 그 정도 갖고 왜 이렇게 예민해요?'],
  ['예민? 말 다 했어요?', '다 했으면 어쩔 건데요! 비켜요!'],
];
const NPC_RAGE = ['야, 너 지금 뭐라 그랬냐?!', '어디서 시비야!!', '한번 해 보자는 거지?!'];
const ME_RAGE = ['너 먼저 밀었잖아!', '말로 하자고 했지!', '이거 놔!'];
const CROWD = ['어머 싸움 났나 봐!', '야야 말려 말려!', '가드 불러!', '무대에서 왜 저래…', '헐 대박…'];

const onStage = () => { const z = P().zone; return z === 'stage' || z === 'dance'; };
let busy = false;

/* 대화 칩 추가: 상대가 남성이고 내가 무대/댄스플로어에 있을 때만 */
(NC.dialogChips = NC.dialogChips || []).push((n, CHIP, c) => {
  if (n.gender !== 'm' || !onStage() || busy || n._fightCool > Date.now()) return;
  CHIP('😤 시비 걸기', () => argue(n, 0));
});

function argue(n, step) {
  if (!D.cur || D.cur.n !== n) return; busy = true;
  const [me, him] = ARGUE[step];
  D.meSay(me); Mo.play(P().group, step ? 'angry' : 'point');
  setTimeout(() => {
    if (!D.cur || D.cur.n !== n) { busy = false; return; }
    D.npcSay(him, step >= 1 ? 'angry' : 'annoyed'); Mo.play(n.g, step >= 1 ? 'angry' : 'crossArms'); n.g.userData.setExpr && n.g.userData.setExpr('angry', 6);
    n.aff = Math.max(0, n.aff - 6); D.floatDelta && D.floatDelta(-6); D.renderHead && D.renderHead();
    const els = document.getElementById('tChips'); if (!els) return; els.innerHTML = '';
    const B = (t, fn, pri) => { const b = document.createElement('button'); b.textContent = t; if (pri) b.className = 'pri'; b.onclick = fn; els.appendChild(b); };
    if (step < ARGUE.length - 1) { B('😠 계속 따진다', () => argue(n, step + 1), true); B('🙏 미안해요, 제가 오해했네요', () => apologize(n)); }
    else { B('🤜 몸싸움 한다', () => brawl(n), true); B('🙏 그만하자, 미안해요', () => apologize(n)); }
  }, 900);
}

function apologize(n) {
  busy = false; if (!D.cur) return;
  D.meSay('아… 제가 좀 예민했네요. 미안해요.');
  setTimeout(() => { if (!D.cur) return; D.npcSay(U.pick(['…됐어요, 저도 좀 그랬네요.', '흠, 알았어요. 즐거운 밤 보내요.', '쳇, 다음부턴 조심해요.']), 'annoyed'); Mo.play(n.g, 'headshake'); n.aff = Math.min(100, n.aff + 3); D.floatDelta && D.floatDelta(3); D.renderHead && D.renderHead(); D.chips && D.chips(); }, 700);
}

function brawl(n) {
  const p = P(); if (!D.cur) return;
  D.close('fight'); p.busy = true; n.state = 'fight'; const u = n.g.userData; u.dance = null; u.moving = false;
  // 서로 마주 보게 1m 거리
  const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz) || 1; n.x = p.x + dx / d * 1.0; n.z = p.z + dz / d * 1.0; n.g.position.set(n.x, n.g.position.y, n.z);
  const face = () => { p.ry = Math.atan2(n.x - p.x, n.z - p.z); p.group.rotation.y = p.ry; n.g.rotation.y = Math.atan2(p.x - n.x, p.z - n.z); };
  face(); u.lookAt = p.group.position; p.group.userData.lookAt = n.g.position;
  const say = (g, t, s = 1.8) => NC.bubble && NC.bubble(g, t, s);
  NC.ui.toast(`🥊 ${n.name}님과 몸싸움이 벌어졌어요!`);
  NC.Audio && NC.Audio.sfx && NC.Audio.sfx('clink');
  const steps = [
    [0, () => { Mo.play(n.g, 'push'); say(n.g, U.pick(NPC_RAGE)); }],
    [900, () => { Mo.play(p.group, 'stagger'); say(p.group, '야!!'); }],
    [1700, () => { Mo.play(p.group, 'push'); say(p.group, U.pick(ME_RAGE)); }],
    [2500, () => { Mo.play(n.g, 'stagger'); }],
    [3200, () => { face(); Mo.play(n.g, 'brawl'); Mo.play(p.group, 'brawl'); shake(1.6); crowdReact(n); }],
    [5600, () => { face(); Mo.play(n.g, 'brawl'); Mo.play(p.group, 'brawl'); say(n.g, '이거 놔!!'); shake(1.2); }],
    [8000, () => separate(n)],
  ];
  steps.forEach(([t, f]) => setTimeout(() => { try { f(); } catch (e) { console.error(e); } }, t));
}

/* 화면 흔들림 (카메라 각도를 잠깐 흔듦) */
function shake(sec) { const c = NC.cam; if (!c) return; const y0 = c.yaw, p0 = c.pitch, t0 = performance.now();
  const step = () => { const t = (performance.now() - t0) / 1000; if (t > sec) { c.yaw = y0; c.pitch = p0; return; } const k = (1 - t / sec) * .025; c.yaw = y0 + Math.sin(t * 47) * k; c.pitch = p0 + Math.sin(t * 61) * k * .6; requestAnimationFrame(step); }; step(); }

function crowdReact(n) {
  const p = P(); (NC.npcs || []).filter(m => m !== n && m.enabled && m.g.visible && m.state === 'wander' && Math.hypot(m.x - p.x, m.z - p.z) < 7).slice(0, 5).forEach((m, i) => {
    setTimeout(() => { m.g.userData.lookAt = p.group.position; Mo.play(m.g, i % 2 ? 'clap' : 'lookAround'); if (i < 3) NC.bubble && NC.bubble(m.g, U.pick(CROWD), 2); }, 300 + i * 350); });
}

/* 가드 등장 → 떼어 놓기 → 결과 */
function separate(n) {
  const p = P(), u = n.g.userData;
  NC.ui.toast('🚨 가드가 달려와서 두 사람을 떼어 놓았어요');
  NC.bubble && NC.bubble(n.g, U.pick(['…오늘 운 좋은 줄 알아!', '에이 기분 잡쳤네.', '다신 마주치지 말자.']), 2.4);
  Mo.play(n.g, 'crossArms'); Mo.play(p.group, 'headshake');
  const win = Math.random() < .5;
  n.aff = Math.max(0, n.aff - 25); n._fightCool = Date.now() + 180000; n.cool = 180;
  const paid = NC.Wallet && NC.Wallet.spend ? NC.Wallet.spend(10) : false;
  setTimeout(() => {
    u.lookAt = null; p.group.userData.lookAt = null; n.state = 'wander'; n.wp = null; n.pause = .5; p.busy = false; busy = false;
    // 상대는 반대편으로 걸어감
    n.x += (n.x - p.x) * .8; n.z += (n.z - p.z) * .8;
    NC.ui.modal(`<h3>🥊 몸싸움 결과</h3><p style="font-size:13px;line-height:1.7">${win ? `${n.name}님이 먼저 물러났어요. 그래도 싸움은 싸움이에요…` : `${n.name}님 기세에 밀렸어요. 다음엔 말로 해요 😅`}<br>💔 ${n.name}님 호감도 -25 · ⏳ 3분간 말 걸기 불가<br>${paid ? '🪙 가드 벌금 10코인' : '🪙 벌금을 낼 코인이 없어 경고만 받았어요'}</p>`, [['확인', 1, true]]);
  }, 1600);
}
})();
