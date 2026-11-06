/* minigames.js — 아이스브레이킹 미니게임 3종 (data/minigames.json)
 *  🎡 진실게임 룰렛 : 번갈아 룰렛을 돌려 질문/벌칙/패스. 내 차례엔 NPC가 답하고, NPC 차례엔 내가 답한다(답변도 호감도 분석)
 *  ⚖️ 밸런스 게임   : 5문항 동시 선택 → 일치하면 호감↑ 코인↑. NPC 선택은 페르소나 설정 > 성격 기본값
 *  💃 커플 댄스 챌린지: 음악 BPM에 맞춰 떨어지는 화살표를 판정선에서 입력(←↓↑→). 내 정확도+파트너 정확도 = 싱크로율
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, $ = NC.$, Mo = NC.Motion, AF = NC.Affinity;
let DATA = null;
const box = $('#game');
const G = NC.Games = { active: null };

function open(html) { box.innerHTML = `<div class="gbox">${html}</div>`; box.style.display = 'flex'; $('#talk').style.visibility = 'hidden'; }
function close() { box.style.display = 'none'; box.innerHTML = ''; G.active = null; $('#talk').style.visibility = ''; NC.Dialog.renderHead(); NC.Dialog.chips(); }
function reward(n, coins, aff, why) { if (coins) NC.Wallet.add(coins, why); if (aff) { n.aff = U.clamp(n.aff + aff, 0, 100); NC.Dialog.floatDelta(aff); } NC.Dialog.sys(`🎮 ${why}: 호감도 ${aff >= 0 ? '+' : ''}${aff} · 🪙+${coins}`); }

G.menu = async function (n) {
  if (!DATA) return NC.ui.toast('게임 데이터를 불러오는 중이에요');
  if (G.active) return;
  const r = await NC.ui.modal(`<h3>🎲 아이스브레이킹 미니게임</h3><p style="font-size:13px;color:#d9c9ff;margin:0">${U.esc(n.name)}님과 어떤 게임을 할까요?</p>`, [['🎡 진실게임 룰렛', 'roulette', true], ['⚖️ 밸런스 게임', 'balance', true], ['💃 커플 댄스', 'dance', true], ['취소', 0]]);
  if (!r.val || !NC.Dialog.cur) return;
  G.active = r.val; ({ roulette, balance, dance })[r.val](n);
};

/* ═════ 🎡 진실게임 룰렛 ═════ */
function roulette(n) {
  const R = DATA.roulette, secs = R.sectors, N = secs.length; let round = 1, ang = 0, spinning = false, total = 0;
  open(`<h3>🎡 진실게임 룰렛 <small id="rgRound"></small></h3><div class="wheelwrap"><canvas id="rg" width="300" height="300"></canvas><div class="pin">▼</div></div>
    <div id="rgMsg" class="gmsg"></div><div class="grow"><input id="rgIn" maxlength="120" placeholder="내 대답 입력…" style="display:none"><button id="rgBtn" class="pri">돌리기!</button><button id="rgX">그만하기</button></div>`);
  const cv = $('#rg'), g = cv.getContext('2d'), msg = $('#rgMsg'), btn = $('#rgBtn'), inp = $('#rgIn');
  const draw = () => { g.clearRect(0, 0, 300, 300); for (let i = 0; i < N; i++) { const a0 = ang + i * 2 * Math.PI / N - Math.PI / 2, a1 = a0 + 2 * Math.PI / N; g.beginPath(); g.moveTo(150, 150); g.arc(150, 150, 140, a0, a1); g.fillStyle = secs[i].color; g.fill(); g.strokeStyle = '#1a0d33'; g.lineWidth = 3; g.stroke();
    g.save(); g.translate(150, 150); g.rotate((a0 + a1) / 2); g.fillStyle = '#1a0d33'; g.font = '700 14px "Malgun Gothic",sans-serif'; g.textAlign = 'right'; g.fillText(secs[i].label, 130, 5); g.restore(); }
    g.beginPath(); g.arc(150, 150, 22, 0, 7); g.fillStyle = '#fff'; g.fill(); };
  const turnInfo = () => { $('#rgRound').textContent = `${round}/${R.rounds} · ${round % 2 ? '내 차례 (질문하기)' : n.name + ' 차례'}`; };
  draw(); turnInfo(); msg.textContent = `룰렛을 돌려 ${n.name}님에게 질문해 보세요!`;
  const spin = () => new Promise(res => {
    spinning = true; const start = ang, target = ang + Math.PI * 2 * (4 + Math.random() * 2), t0 = performance.now(), dur = 3200; let lastIdx = -1;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); ang = start + (target - start) * e; draw();
      const idx = ((Math.floor(((-ang % (2 * Math.PI)) + 4 * Math.PI) % (2 * Math.PI) / (2 * Math.PI / N))) % N); if (idx !== lastIdx) { lastIdx = idx; NC.Audio.sfx('tick'); }
      if (k < 1) requestAnimationFrame(step); else { spinning = false; res(secs[idx]); } };
    requestAnimationFrame(step);
  });
  const finishRound = () => { round++; if (round > R.rounds) { const aff = Math.round(DATA.rewards.roulette.aff + total); reward(n, DATA.rewards.roulette.coins, aff, '진실게임 완료'); Mo.trigger(n.g, 'game:win'); msg.textContent = '게임 끝! 서로 좀 더 알게 됐네요 💗'; btn.textContent = '닫기'; btn.onclick = close; inp.style.display = 'none'; return; } turnInfo(); btn.disabled = false; btn.textContent = round % 2 ? '돌리기!' : `${n.name} 차례 ▶`; inp.style.display = 'none'; };
  btn.onclick = async () => {
    if (spinning) return; btn.disabled = true; const s = await spin(); const mine = round % 2 === 1;
    if (s.type === 'pass') { msg.textContent = `🍀 패스권! ${mine ? n.name + '님' : '나'}의 차례가 그냥 넘어가요.`; NC.Audio.sfx('pop'); return setTimeout(finishRound, 1200); }
    if (s.type === 'penalty') { const who = mine ? n.g : NC.player.group; Mo.play(who, s.motion); msg.textContent = mine ? `${n.name}: ${R.penaltyLines[s.motion]}` : `벌칙은 나에게! ${R.penaltyLines[s.motion]}`; if (mine) NC.Dialog.npcSay(R.penaltyLines[s.motion], 'laugh'); total += 1; return setTimeout(finishRound, 2000); }
    if (mine) { const a = (n.persona && n.persona.truths && n.persona.truths[s.label]) || U.pick(AF.linesFor(n, 'question')); msg.innerHTML = `<b>[${U.esc(s.label)}]</b> 질문! → <b>${U.esc(n.name)}</b>: ${U.esc(a)}`; NC.Dialog.npcSay(a, 'shy'); Mo.play(n.g, 'shy'); total += 1; setTimeout(finishRound, 2200); }
    else { const q = U.pick(R.asks[s.label] || ['아무 얘기나 해 줘요!']); msg.innerHTML = `<b>[${U.esc(s.label)}]</b> ${U.esc(n.name)}: “${U.esc(q)}”`; NC.Dialog.npcSay(q, 'smile'); inp.style.display = ''; inp.value = ''; inp.focus(); btn.disabled = false; btn.textContent = '대답하기';
      btn.onclick = () => { const t = inp.value.trim(); if (!t) return; const an = AF.analyze(t, n, {}); const d = Math.round(an.delta * .5) + (t.length >= 8 ? 2 : 0); total += d; const react = an.flags.rude ? '…그건 좀 아니에요.' : d >= 3 ? U.pick(['오~ 솔직해서 좋다!', '헐 의외인데요? ㅎㅎ', '…인정. 좋은 대답.']) : U.pick(['그렇구나~', '흠, 더 궁금해지네요.', 'ㅎㅎ 알겠어요.']); NC.Dialog.npcSay(react, d >= 3 ? 'laugh' : 'smile'); msg.textContent = `${n.name}: ${react}`; btn.onclick = roulettePrimary; finishRound(); };
    }
  };
  const roulettePrimary = btn.onclick;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); e.stopPropagation(); });
  $('#rgX').onclick = close;
}

/* ═════ ⚖️ 밸런스 게임 ═════ */
function balance(n) {
  const B = DATA.balance, qs = B.questions.slice().sort(() => Math.random() - .5).slice(0, B.rounds); let i = 0, same = 0;
  open(`<h3>⚖️ 밸런스 게임 <small id="bgR"></small></h3><div id="bgQ" class="gmsg"></div><div class="bal"><button id="bgA"></button><span>VS</span><button id="bgB"></button></div><div id="bgRes" class="gmsg"></div><div class="grow"><button id="bgX">그만하기</button></div>`);
  const show = () => { const q = qs[i]; $('#bgR').textContent = `${i + 1}/${qs.length}`; $('#bgQ').textContent = '하나만 고르세요! 동시에 공개됩니다'; $('#bgA').textContent = q.a; $('#bgB').textContent = q.b; $('#bgA').disabled = $('#bgB').disabled = false; $('#bgRes').textContent = ''; };
  const pick = mine => {
    const q = qs[i], P = n.persona || {}; let np = (P.balance && P.balance[q.id]) || q.trait[n.trait] || 'a'; if (!(P.balance && P.balance[q.id]) && Math.random() < .15) np = np === 'a' ? 'b' : 'a';
    $('#bgA').disabled = $('#bgB').disabled = true; const ok = np === mine; if (ok) same++;
    const R = DATA.rewards.balance; n.aff = U.clamp(n.aff + (ok ? R.affPerMatch : R.affPerMiss), 0, 100); NC.Dialog.floatDelta(ok ? R.affPerMatch : R.affPerMiss);
    const line = U.pick(ok ? B.same : B.diff); $('#bgRes').innerHTML = `나: <b>${U.esc(q[mine])}</b> · ${U.esc(n.name)}: <b>${U.esc(q[np])}</b><br>${U.esc(line)}`;
    NC.Dialog.npcSay(line, ok ? 'laugh' : 'wink'); Mo.trigger(n.g, ok ? 'affinity:bigUp' : 'talk:think'); NC.Audio.sfx(ok ? 'hit' : 'miss');
    setTimeout(() => { i++; if (i < qs.length) show(); else { const pct = Math.round(same / qs.length * 100); $('#bgQ').textContent = `싱크로율 ${pct}% ${pct >= 80 ? '💞 천생연분?!' : pct >= 40 ? '😊 꽤 잘 맞네요' : '😅 정반대의 매력'}`; $('#bgRes').textContent = ''; reward(n, same * R.coinsPerMatch, 0, `밸런스 게임 ${same}/${qs.length} 일치`); if (pct >= 60) Mo.trigger(n.g, 'game:win'); $('#bgX').textContent = '닫기'; } }, 1700);
  };
  $('#bgA').onclick = () => pick('a'); $('#bgB').onclick = () => pick('b'); $('#bgX').onclick = close; show();
}

/* ═════ 💃 커플 댄스 챌린지 ═════ */
function dance(n) {
  const Dd = DATA.dance, A = NC.Audio; A.init(); if (!A.ctx) { NC.ui.toast('오디오를 사용할 수 없어 리듬 게임을 열 수 없어요'); return close(); }
  const KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'], SYM = ['←', '↓', '↑', '→'];
  const b0 = A.beat(), startBeat = b0.n + Dd.leadIn + 1, notes = [];
  for (let k = 0; k < Dd.beats / 4; k++) { const pat = U.pick(Dd.patterns); for (let j = 0; j < 8; j++) if (pat[j] === 'x') notes.push({ t: A.beatTime(startBeat + k * 4 + j * .5), lane: Math.floor(Math.random() * 4), hit: null }); }
  const endT = notes[notes.length - 1].t + 1.2; let score = 0, combo = 0, maxCombo = 0, judge = '', judgeT = 0;
  open(`<h3>💃 커플 댄스 챌린지 <small>${A.bpm} BPM</small></h3><canvas id="dg" width="360" height="400"></canvas><div class="dpad">${SYM.map((s, i) => `<button data-l="${i}">${s}</button>`).join('')}</div><div class="gmsg" id="dgMsg">방향키(← ↓ ↑ →)를 판정선에 맞춰 누르세요! 박자에 맞춰 시작합니다…</div>`);
  const cv = $('#dg'), g = cv.getContext('2d'), HIT = 350, SPEED = 260;
  const P = NC.player, pu = P.group.userData, nu = n.g.userData, prev = [pu.dance, nu.dance]; pu.dance = 'stageDance'; nu.dance = 'stageDance'; const wasSeated = [pu.seated, nu.seated]; pu.seated = nu.seated = false;   // 앉아 있었다면 잠깐 일어나서 춤
  const press = lane => { const now = A.ctx.currentTime; let best = null, bd = 1e9; for (const no of notes) if (!no.hit && no.lane === lane) { const d = Math.abs(no.t - now) * 1000; if (d < bd) { bd = d; best = no; } }
    if (best && bd <= Dd.window.good) { best.hit = bd <= Dd.window.perfect ? 'P' : 'G'; score += best.hit === 'P' ? 2 : 1; combo++; maxCombo = Math.max(maxCombo, combo); judge = best.hit === 'P' ? 'PERFECT!' : 'GOOD'; A.sfx('hit'); }
    else { combo = 0; judge = 'MISS'; A.sfx('miss'); } judgeT = 30; };
  const onKey = e => { const l = KEYS.indexOf(e.key); if (l >= 0) { press(l); e.preventDefault(); e.stopPropagation(); } };
  addEventListener('keydown', onKey, true);
  box.querySelectorAll('.dpad button').forEach(b => b.onpointerdown = e => { press(+b.dataset.l); e.preventDefault(); });
  let raf;
  const frame = () => {
    const now = A.ctx.currentTime; g.clearRect(0, 0, 360, 400);
    for (let l = 0; l < 4; l++) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(20 + l * 82, 0, 74, 400); g.fillStyle = 'rgba(255,255,255,.35)'; g.font = '700 26px Arial'; g.textAlign = 'center'; g.fillText(SYM[l], 57 + l * 82, HIT + 36); }
    g.fillStyle = '#ffd23d'; g.fillRect(20, HIT - 2, 320, 4);
    for (const no of notes) { if (no.hit) continue; const y = HIT - (no.t - now) * SPEED; if (y < -30 || y > 420) continue; if (y > HIT + 40 && !no.hit) { no.hit = 'M'; combo = 0; judge = 'MISS'; judgeT = 20; continue; }
      g.fillStyle = ['#ff5ca8', '#3de6ff', '#6dff8a', '#ffd23d'][no.lane]; g.beginPath(); g.roundRect ? g.roundRect(26 + no.lane * 82, y - 14, 62, 28, 10) : g.rect(26 + no.lane * 82, y - 14, 62, 28); g.fill(); g.fillStyle = '#1a0d33'; g.font = '800 20px Arial'; g.fillText(SYM[no.lane], 57 + no.lane * 82, y + 7); }
    if (judgeT > 0) { judgeT--; g.fillStyle = judge === 'MISS' ? '#ff6b8a' : '#fff'; g.font = '900 30px Arial'; g.fillText(judge, 180, 150); }
    g.fillStyle = '#fff'; g.font = '700 16px Arial'; g.textAlign = 'left'; g.fillText(`SCORE ${score}  COMBO ${combo}`, 24, 24);
    if (now < notes[0].t - .2) { g.textAlign = 'center'; g.font = '900 48px Arial'; g.fillText(String(Math.ceil((notes[0].t - now) / (60 / A.bpm))), 180, 220); }
    if (now > endT) return finish(); raf = requestAnimationFrame(frame);
  };
  const finish = () => {
    cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); pu.dance = prev[0]; nu.dance = prev[1]; pu.seated = wasSeated[0]; nu.seated = wasSeated[1];
    const acc = score / (notes.length * 2), skill = (Dd.partnerSkill[n.trait] || .8) * (.9 + Math.random() * .15), sync = Math.round(Math.min(1, (acc + skill) / 2) * 100);
    const R = DATA.rewards.dance, aff = Math.round(R.affMax * acc - (acc < .3 ? 3 : 0)), coins = Math.round(R.coinsMax * acc);
    $('#dgMsg').innerHTML = `내 정확도 ${Math.round(acc * 100)}% · 최대 콤보 ${maxCombo} · 커플 싱크로율 <b>${sync}%</b>`;
    const line = acc > .7 ? '와 우리 완전 합 좋은데요?! 💃🕺' : acc > .4 ? 'ㅎㅎ 나쁘지 않았어요! 한 번 더?' : '푸핫, 박자는… 다음에 같이 연습해요 ㅋㅋ';
    NC.Dialog.npcSay(line, acc > .4 ? 'laugh' : 'smile'); Mo.trigger(n.g, acc > .4 ? 'game:win' : 'game:lose');
    reward(n, coins, aff, `커플 댄스 싱크로율 ${sync}%`);
    box.querySelector('.gbox').insertAdjacentHTML('beforeend', '<div class="grow"><button class="pri" id="dgX">닫기</button></div>'); $('#dgX').onclick = close;
  };
  raf = requestAnimationFrame(frame);
  G.cancel = () => { cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); pu.dance = prev[0]; nu.dance = prev[1]; pu.seated = wasSeated[0]; nu.seated = wasSeated[1]; };
}

NC.Games.init = d => { DATA = d; };
NC.on('dialog:close', () => { if (G.active) { G.cancel && G.cancel(); close(); } });
})();
