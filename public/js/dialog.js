/* dialog.js — 부킹 대화 패널 (자유 대화 · 음성 입력/출력 · 호감도 미터 · 퀵칩)
 *  흐름: E로 말 걸기 → 인사(로컬) → 플레이어 입력(텍스트/🎤) → NC.LLM.reply(LLM 또는 로컬 엔진)
 *        → 호감도 반영 · 표정/모션 트리거 · 속얘기 해금(60/80) · 행동(짠/춤/게임/자리이동/이탈) → 95↑ 엔딩
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, $ = NC.$, Mo = NC.Motion, AF = NC.Affinity;
const el = { panel: $('#talk'), face: $('#tFace'), name: $('#tName'), tag: $('#tTag'), job: $('#tJob'), aff: $('#tAff'), stage: $('#tStage'), num: $('#tNum'), log: $('#tLog'), chips: $('#tChips'), inp: $('#tIn'), send: $('#tSend'), mic: $('#tMic'), tts: $('#tTts'), src: $('#tSrc'), close: $('#tClose') };
const D = NC.Dialog = { cur: null };
const mask = s => String(s).replace(/(01[016789])[\s.\-]*\d{3,4}[\s.\-]*\d{4}/g, '[연락처 가림]').replace(/https?:\/\/\S+|www\.\S+/gi, '[링크 가림]');

function line(who, text, cls) { const d = document.createElement('div'); d.className = 'ln ' + (cls || ''); if (who) { const b = document.createElement('b'); b.textContent = who; d.appendChild(b); } const s = document.createElement('span'); s.textContent = text; d.appendChild(s); el.log.appendChild(d); el.log.scrollTop = 1e9; return d; }
function renderHead() {
  const c = D.cur; if (!c) return; const n = c.n, st = AF.stageOf(n.aff);
  el.name.textContent = n.name; el.tag.textContent = n.tag || ''; el.job.textContent = n.job || '';
  el.aff.style.width = n.aff + '%'; el.aff.style.background = `linear-gradient(90deg,#9b5cff,${st[2]})`; el.stage.textContent = `💗 ${st[1]}`; el.num.textContent = n.aff;
  el.src.textContent = NC.LLM.enabled() ? `AI 대화: ${NC.config.llmModel || 'LLM'} 연결됨` : 'AI 대화: 로컬 대사 엔진 (서버에 LLM 키를 설정하면 자유 대화)';
}
function floatDelta(d) { if (!d) return; const f = document.createElement('div'); f.className = 'fdelta ' + (d > 0 ? 'up' : 'down'); f.textContent = (d > 0 ? '+' : '') + d + (d > 0 ? ' 💗' : ' 💔'); el.panel.appendChild(f); setTimeout(() => f.remove(), 1400); }

function npcSay(text, emotion) {
  const c = D.cur; if (!c) return; const n = c.n, u = n.g.userData;
  line(n.name, text, 'npc'); n.history.push({ role: 'npc', text }); if (n.history.length > 30) n.history.splice(0, n.history.length - 30);
  if (emotion) u.setExpr(emotion, 3.5);
  const dur = NC.Audio.speak(text, (n.persona && n.persona.voice) || {}); u.say(Math.max(1.2, dur || text.length * .09));
}
function sys(text) { line('', text, 'sys'); }

D.open = function (n, opt = {}) {
  const P = NC.player; if (D.cur) D.close('switch');
  D.cur = { n, opt, busy: false, lastPlayer: '', cheersAt: 0, danceAt: 0 };
  n.state = n.state === 'seated' ? 'seated' : 'talk'; P.busy = true; P.target = null; P.autoPath = null;
  P.group.userData.lookAt = n.g.position; n.g.userData.lookAt = P; P.group.userData.hideLabel = n.g.userData.hideLabel = true;
  el.panel.style.display = 'flex'; el.log.innerHTML = ''; NC.Avatar.preview(el.face, n.g.userData.look, 'smile'); renderHead();
  if (n.history.length) { n.history.slice(-8).forEach(h => line(h.role === 'npc' ? n.name : '나', h.text, h.role === 'npc' ? 'npc' : 'me')); sys('— 다시 대화를 이어갑니다 —'); }
  if (opt.intro) npcSay(opt.intro, 'smile');
  else if (!n.history.length) { npcSay(U.pick(AF.linesFor(n, 'greet')), 'smile'); Mo.trigger(n.g, 'social:greet', { silent: true }); }
  chips(); if (!matchMedia('(pointer:coarse)').matches) setTimeout(() => el.inp.focus(), 50);
  NC.emit('dialog:open', n);
};
D.close = function (reason) {
  const c = D.cur; if (!c) return; const n = c.n, P = NC.player; D.cur = null;
  el.panel.style.display = 'none'; P.busy = false; P.group.userData.lookAt = null; n.g.userData.lookAt = null; n.g.userData.talk = false; P.group.userData.hideLabel = n.g.userData.hideLabel = false;
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (n.state === 'seated' || P.seat) { if (NC.VIP) NC.VIP.endSession(n, reason); }
  else { n.state = 'wander'; n.pause = 1.5; n.wp = null; }
  if (reason === 'left') n.cool = 60; else if (reason !== 'switch') n.cool = Math.max(n.cool, 8);
  NC.emit('dialog:close', n, reason);
};

async function send(text) {
  const c = D.cur; text = mask(String(text || '').trim()).slice(0, 200); if (!c || !text || c.busy) return;
  const n = c.n; c.busy = true; el.inp.value = '';
  line('나', text, 'me'); const ctx = { lastPlayer: c.lastPlayer }; c.lastPlayer = text;
  n.history.push({ role: 'user', text }); NC.player.group.userData.say(Math.min(2.5, text.length * .07));
  const typing = line(n.name, '…', 'npc typing'); n.g.userData.talk = true;
  let r; try { r = await NC.LLM.reply(n, text, ctx); } catch (e) { r = null; }
  typing.remove(); c.busy = false; if (D.cur !== c || !r) return;
  apply(r);
}
function apply(r) {
  const c = D.cur, n = c.n, before = n.aff, stBefore = AF.stageOf(before)[1];
  n.aff = U.clamp(Math.round(n.aff + r.delta), 0, 100); n.recentDeltas.push(r.delta); if (n.recentDeltas.length > 5) n.recentDeltas.shift();
  npcSay(r.reply, r.emotion);
  floatDelta(n.aff - before);
  const f = r.an.flags;
  if (f.rude) Mo.trigger(n.g, 'affinity:rude'); else if (r.delta >= 8) Mo.trigger(n.g, 'affinity:bigUp');
  else if (Mo.EMOTION_TRIGGER[r.emotion]) Mo.trigger(n.g, Mo.EMOTION_TRIGGER[r.emotion]); else if (r.delta >= 3) Mo.trigger(n.g, 'affinity:up'); else if (r.delta <= -4) Mo.trigger(n.g, 'affinity:down');
  const st = AF.stageOf(n.aff)[1]; if (st !== stBefore) { sys(n.aff > before ? `💗 호감도 단계 상승: ${st}` : `💔 호감도 단계 하락: ${st}`); NC.Audio.sfx(n.aff > before ? 'heart' : 'lose'); }
  // 속얘기 해금 (로컬 엔진일 때 명시적으로 보여줌. LLM은 프롬프트에 포함되어 자연스럽게 말함)
  ((n.persona && n.persona.secrets) || []).forEach(s => { if (n.aff >= s.at && !n.secretsShown[s.at]) { n.secretsShown[s.at] = true; if (r.source === 'local') setTimeout(() => D.cur && sys(`🤫 ${n.name}의 속얘기: “${s.text}”`), 900); } });
  // 행동
  if (r.action === 'cheers') doCheers(true);
  else if (r.action === 'drink') Mo.play(n.g, 'drink');
  else if (r.action === 'dance') Mo.play(n.g, 'cheer');
  else if (r.action === 'game') setTimeout(() => D.cur && NC.Games && NC.Games.menu(n), 900);
  if (n.aff >= 95 && !n.ended) { n.ended = true; setTimeout(() => { if (!D.cur) return; npcSay(U.pick(AF.linesFor(n, 'ending')), 'shy'); Mo.trigger(n.g, 'talk:compliment'); chips(); }, 1200); }
  if (n.aff < 10 || r.action === 'leave' && n.aff < 35) { setTimeout(() => { if (!D.cur) return; npcSay(U.pick(AF.linesFor(n, 'leave')), 'sad'); setTimeout(() => D.close('left'), 1800); }, 1100); }
  renderHead(); chips();
}

function doCheers(fromNpc) {
  const c = D.cur; if (!c) return; const n = c.n, now = Date.now();
  Mo.trigger(n.g, 'drink:cheers', { silent: true }); Mo.trigger(NC.player.group, 'drink:cheers'); NC.net && NC.net.send({ type: 'emote', name: 'cheers' });
  if (!fromNpc) { if (now - c.cheersAt > 30e3) { c.cheersAt = now; n.aff = Math.min(100, n.aff + 3); floatDelta(3); } npcSay(U.pick(AF.linesFor(n, 'cheers')), 'smile'); }
  renderHead();
}
const CHIP = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; el.chips.appendChild(b); };
function chips() {
  const c = D.cur; el.chips.innerHTML = ''; if (!c) return; const n = c.n, P = NC.player;
  if (NC.dialogChipsOverride) { try { if (NC.dialogChipsOverride(n, CHIP, c)) return; } catch (e) { console.error(e); } }   // v9: 부르스 등 특수 상황 전용 칩
  if (n.ended) CHIP('💌 가상 인스타 교환 (엔딩)', () => { NC.Wallet.add(50, `${n.name}님과 엔딩`); Mo.trigger(n.g, 'game:win'); Mo.trigger(P.group, 'game:win', { silent: true }); sys(`🎉 ${n.name}님과 가상 인스타 교환 성공! (게임 내 엔딩 · 실제 연락처 아님)`); n.aff = 100; renderHead(); setTimeout(() => D.close('ending'), 2600); }, 'pri');
  if (n.history.length <= 1) (NC.openers || []).forEach(o => CHIP('🗨 ' + o.t, () => send(o.t)));
  const likes = ((n.persona && n.persona.likes) || []).slice().sort(() => Math.random() - .5).slice(0, 2);
  likes.forEach(l => CHIP(`💬 ${l.topic} 좋아해요?`, () => send(`${l.topic} 좋아해요?`)));
  CHIP('🥂 짠!', () => doCheers(false));
  CHIP('🍸 한 잔 살게요 🪙5', () => { if (!NC.Wallet.spend(5)) return NC.ui.toast('코인이 부족해요'); Mo.trigger(n.g, 'drink:order'); n.aff = Math.min(100, n.aff + 4); floatDelta(4); npcSay(U.pick(['오 센스~ 고마워요!', '잘 마실게요 ㅎㅎ', '…이런 건 점수 드려야죠.']), 'smile'); renderHead(); });
  CHIP('🎲 미니게임', () => NC.Games && NC.Games.menu(n));
  CHIP('💃 같이 춤춰요', () => { const now = Date.now(); Mo.play(n.g, 'cheer'); Mo.play(P.group, 'cheer'); NC.net && NC.net.send({ type: 'emote', name: 'cheer' }); if (now - c.danceAt > 60e3) { c.danceAt = now; const d = n.trait === 'shy' ? 1 : 3; n.aff = Math.min(100, n.aff + d); floatDelta(d); } npcSay(n.trait === 'shy' ? '아… 저 춤 잘 못 추는데… 헤헤' : '오 좋아요! 리듬 타 리듬~', 'laugh'); renderHead(); });
  if (!P.seat && n.state !== 'seated' && n.aff >= 50 && NC.VIP) CHIP('🚪 VIP 룸으로 갈래요?', () => NC.VIP.moveWith(n));
  (NC.dialogChips || []).forEach(f => { try { f(n, CHIP, c); } catch (e) { console.error(e); } });
  CHIP('👋 일어날게요', () => D.close('bye'));
}

/* 입력 · 음성 */
el.send.onclick = () => send(el.inp.value);
el.inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { send(el.inp.value); e.preventDefault(); } else if (e.key === 'Escape') { el.inp.blur(); } e.stopPropagation(); });
el.close.onclick = () => D.close('bye');
el.tts.onclick = () => { NC.Audio.tts = !NC.Audio.tts; el.tts.textContent = NC.Audio.tts ? '🔊' : '🔈'; el.tts.title = NC.Audio.tts ? 'NPC 음성 켜짐' : 'NPC 음성 꺼짐'; if (!window.speechSynthesis) NC.ui.toast('이 브라우저는 음성 합성을 지원하지 않아요'); };
const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null;
el.mic.onclick = () => {
  if (!SR) return NC.ui.toast('이 브라우저는 음성 인식을 지원하지 않아요 (Chrome/Edge 권장)');
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = true; rec.maxAlternatives = 1; el.mic.classList.add('on'); NC.Audio.speaking(true);
  rec.onresult = e => { const r = e.results[e.results.length - 1]; el.inp.value = r[0].transcript; if (r.isFinal) send(r[0].transcript); };
  rec.onend = rec.onerror = () => { el.mic.classList.remove('on'); NC.Audio.speaking(false); rec = null; };
  rec.start();
};
D.send = send; D.npcSay = npcSay; D.sys = sys; D.renderHead = renderHead; D.chips = chips; D.floatDelta = floatDelta;

/* 카메라 프레이밍: 두 사람이 화면에 같이 잡히게 */
D.focus = function (camera) {
  const c = D.cur; if (!c) return null; const n = c.n, P = NC.player;
  const ax = P.group.position.x, az = P.group.position.z, bx = n.g.position.x, bz = n.g.position.z, mx = (ax + bx) / 2, mz = (az + bz) / 2;
  if (P.seat && P.seat.kind === 'vip') { const v = NC.world.vip[P.seat.room]; return { tx: mx, ty: 1.0, tz: mz, cx: mx + .4, cy: 2.7, cz: mz - (v ? 4.6 : 4.2) }; }
  let vx = bx - ax, vz = bz - az; const l = Math.hypot(vx, vz) || 1; vx /= l; vz /= l; let px = -vz, pz = vx;
  if ((camera.position.x - mx) * px + (camera.position.z - mz) * pz < 0) { px = -px; pz = -pz; }
  return { tx: mx, ty: 1.4, tz: mz, cx: mx + px * 3.6, cy: 2.3, cz: mz + pz * 3.6 };
};

/* E 상호작용: 근처 NPC에게 말 걸기 */
NC.interactProviders.push(() => {
  const P = NC.player, out = []; if (P.seat || P.busy) return out;
  (NC.npcs || []).forEach(n => { if (!n.enabled || n.state !== 'wander' || !n.g.visible) return; const d = Math.hypot(n.x - P.x, n.z - P.z); if (d < 3) out.push({ label: `💬 ${n.name}에게 부킹 말 걸기 (E)`, dist: d, run: () => { if (n.cool > 0) return NC.ui.toast(`${n.name}님은 잠시 쉬는 중이에요 😅 (${Math.ceil(n.cool)}초)`); D.open(n); } }); });
  return out;
});
})();
