/* affinity.js — 호감도(0~100) 규칙 엔진 + 로컬 대사 엔진 + LLM 클라이언트
 *
 *  최종 Δ = (LLM 사용 시) round(0.6 × 규칙Δ + 0.4 × LLMΔ)   /  (미사용 시) 규칙Δ
 *  · 무례/선넘기는 규칙Δ가 상한(LLM이 관대해도 무시)  · 턴당 −15 ~ +12 클램프
 *  · 밀당: 호감도 55↑에서 연속 상승 중이면 pullPush 확률로 한 번 튕김(−2, '밀당' 태그)
 *  · 단계: 냉랭 0 / 경계 20 / 호기심 40 / 설렘 60 / 호감 80 / 최고조 95 (95↑ 가상 인스타 교환 엔딩, 10↓ 이탈)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util;
const STAGES = [[0, '냉랭', '#7a8aa8'], [20, '경계', '#9b8cff'], [40, '호기심', '#3de6ff'], [60, '설렘', '#ffd23d'], [80, '호감', '#ff7ab8'], [95, '최고조', '#ff3d9a']];
const stageOf = a => STAGES.filter(([t]) => a >= t).pop();
const has = (t, list) => list.some(k => t.includes(k));
const KW = {
  rude: ['씨발', '시발', 'ㅅㅂ', '병신', 'ㅂㅅ', '개새', '좆', '지랄', '꺼져', '닥쳐', '미친놈', '미친년', '못생', '뚱뚱', '돼지', '한심', '찐따', '멍청'],
  sexual: ['섹스', '성관계', '몸매', '가슴', '엉덩이', '야한', '벗어', '모텔'],
  pushy: ['번호', '전화번호', '연락처', '카톡 아이디', '카톡 알려', '우리 집', '우리집', '집에 가자', '호텔', '나가자', '2차 가', '실제로 만나', '만나자', '주소', '어디 살', '인스타 아이디'],
  compliment: ['예쁘', '이쁘', '멋있', '멋져', '잘생', '귀엽', '매력', '센스', '분위기 좋', '목소리 좋', '웃는 게', '근사', '아름다', '최고예'],
  looks: ['예쁘', '이쁘', '잘생', '귀엽', '얼굴', '외모'],
  joke: ['ㅋㅋ', 'ㅎㅎ', '농담', '드립', '장난', '웃기', '개그'],
  brag: ['연봉', '외제차', '내 차', '돈 많', '부자', '명품', '강남', '내가 좀'],
  cheesy: ['천사', '하늘에서', '운명', '첫눈에', '여신', '별처럼', '내 마음을'],
  boringExact: ['ㅇㅇ', 'ㅇㅋ', '응', '네', '넹', '그냥', '몰라', '음', 'ㅇ', '오', '아'],
  cheers: ['짠', '건배', '한잔', '한 잔'], dance: ['춤추', '춤 추', '스테이지', '추러'], game: ['게임', '룰렛', '밸런스', '진실'],
  askAbout: ['좋아해요', '좋아하세요', '좋아해?', '뭐 해요', '뭐해요', '어때요', '어떻게', '왜요', '왜 ', '어디', '언제', '무슨', '뭐예요', '뭐에요', '있어요?', '해요?', '세요?', '?'],
};
const TRAIT_W = {
  outgoing: { compliment: 4, looks: 3, joke: 4, question: 3, brag: -4, cheesy: -1, boring: -4 },
  shy: { compliment: 6, looks: 4, joke: 2, question: 4, brag: -3, cheesy: -2, boring: -1 },
  playful: { compliment: 2, looks: 1, joke: 6, question: 3, brag: -4, cheesy: -3, boring: -5 },
  cool: { compliment: 1, looks: -2, joke: 3, question: 5, brag: -7, cheesy: -6, boring: -3 },
};

function analyze(text, npc, ctx = {}) {
  const t = String(text || '').toLowerCase().trim(), P = npc.persona || {}, trait = npc.trait || 'outgoing', W = TRAIT_W[trait] || TRAIT_W.outgoing;
  const aff = npc.aff, tags = [], f = {}; let d = 0, topic = null, dislike = null;
  f.rude = has(t, KW.rude); f.sexual = has(t, KW.sexual); f.pushy = f.sexual || has(t, KW.pushy);
  f.compliment = has(t, KW.compliment); f.looks = f.compliment && has(t, KW.looks); f.joke = has(t, KW.joke);
  f.brag = has(t, KW.brag); f.cheesy = has(t, KW.cheesy); f.question = has(t, KW.askAbout);
  f.boring = t.length < 3 || KW.boringExact.includes(t.replace(/[.!~?]/g, ''));
  f.repeat = ctx.lastPlayer && ctx.lastPlayer.trim() === t;
  f.cheers = has(t, KW.cheers); f.dance = has(t, KW.dance); f.game = has(t, KW.game);
  (P.likes || []).forEach(l => { if (!topic && has(t, (l.kw || []).map(k => k.toLowerCase()))) topic = l.topic; });
  (P.dislikes || []).forEach(l => { if (!dislike && has(t, (l.kw || []).map(k => k.toLowerCase()))) dislike = l.topic; });
  if (f.rude) { d -= 15; tags.push('무례·비하'); }
  if (f.pushy) { d -= f.sexual ? 12 : 8; tags.push(f.sexual ? '성적 발언(선넘기)' : '선넘기(연락처/실제만남)'); }
  if (!f.rude && !f.pushy) {
    if (topic) { const n = (npc.topicHits[topic] = (npc.topicHits[topic] || 0) + 1); d += Math.round(7 * Math.pow(.5, n - 1)); tags.push('관심사:' + topic + (n > 1 ? `(반복${n})` : '')); }
    if (dislike) { d -= 6; tags.push('싫어하는 주제:' + dislike); }
    if (f.compliment) { let c = f.looks ? W.looks : W.compliment; if (aff < 40) c = Math.round(c / 2); d += c; tags.push(f.looks ? '외모 칭찬' : '칭찬'); }
    if (f.joke) { d += W.joke; tags.push('농담·유머'); }
    if (f.question && !topic) { d += W.question; tags.push('상대에 대한 질문'); }
    if (f.brag) { d += W.brag; tags.push('자랑'); }
    if (f.cheesy) { d += W.cheesy; tags.push('느끼한 멘트'); }
    if (f.boring) { d += W.boring; tags.push('성의 없는 답'); }
    if (t.length >= 15 && t.length <= 90) d += 1;
    if (!topic && !f.compliment && !f.joke && !f.question && !f.boring && !f.brag && !f.cheesy && !dislike) d += 1;
  }
  const op = (NC.openers || []).find(o => o.t.toLowerCase() === t); if (op && op.s) { d += (op.s[trait] || 0) * 2; tags.push('첫마디'); }
  if (f.repeat) { d -= 5; tags.push('같은 말 반복'); }
  // 밀당
  const rec = npc.recentDeltas || [];
  if (d > 0 && aff > 55 && rec.length >= 2 && rec.slice(-2).every(x => x > 0) && Math.random() < (P.pullPush ?? .4) * .45) { d = -2; f.tease = true; tags.push('밀당(튕김)'); }
  d = U.clamp(d, -15, 12);
  return { delta: d, tags, topic, dislike, flags: f };
}

/* ── 질문 의도 인식: 플레이어 질문에 '실제로 답하는' 로컬 응답 ── */
const josa = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b; };   // 받침 있으면 a
const pickOne = a => a[Math.floor(Math.random() * a.length)];
function intentReply(npc, text) {
  const t = text.replace(/\s+/g, ' ').trim(), P = npc.persona || {}, a = npc.aff, def = npc.def || {};
  const likes = (P.likes || []).map(l => l.topic), truths = P.truths || {}, name = npc.name;
  const R = [
    [/(저|나|날|나를|저를)\s*(어때|좋아|맘에|마음에|괜찮)/, () => a < 40 ? pickOne(['음… 아직은 잘 모르겠어요. 얘기를 좀 더 해 봐야 알 것 같은데요?', '벌써 그걸 물어봐요? 조금만 더 지켜볼게요 ㅎㅎ'])
      : a < 60 ? pickOne(['솔직히 나쁘진 않아요. 근데 지금 다 말하면 재미없잖아요 ㅎㅎ', '음~ 생각보다 괜찮은 사람 같아요. 아직은 여기까지!'])
      : a < 80 ? pickOne(['…좋은 쪽이에요. 너무 티 났어요?', '대화할수록 점점 좋아지는 중이에요 😊'])
      : pickOne(['그걸 꼭 말로 들어야 알아요? 좋아요 😊', '오늘 만난 사람 중엔 제일 좋아요. 됐죠?']), 'shy'],
    [/몇\s*살|나이/, () => `${def.age || '스물 몇'}살이에요. 그쪽은요? 비슷해 보이는데요?`, 'smile'],
    [/무슨\s*일|직업|뭐\s*하는\s*사람|어떤\s*일|회사/, () => `${def.job || '평범한 회사원'} 일 하고 있어요. ${likes[0] ? likes[0] + ' 좋아하는 게 일에도 도움이 많이 돼요.' : ''} 그쪽은 무슨 일 해요?`, 'smile'],
    [/이름/, () => `${name}${josa(name, '이에요', '예요')}. 그쪽 이름도 알려 줄래요?`, 'smile'],
    [/혼자|누구랑|친구랑/, () => pickOne(['친구들이랑 왔는데 다들 스테이지에 가 버렸어요 ㅎㅎ 그쪽은요?', '반은 혼자예요. 친구가 늦는대서요. 그쪽은 누구랑 왔어요?']), 'smile'],
    [/자주\s*와|처음\s*와|여기\s*처음|단골/, () => pickOne(['가끔 와요. 오늘은 음악이 좋다고 해서 왔어요.', '사실 오랜만에 왔어요. 분위기가 예전이랑 좀 달라졌네요.']), 'smile'],
    [/주말|쉬는\s*날|퇴근\s*후|시간\s*날\s*때|평소에/, () => likes.length > 1 ? `쉬는 날엔 ${likes[0]} 관련된 거 찾아보거나 ${likes[1]} 즐기면서 보내요. 그쪽은 주로 뭐 해요?` : '집에서 푹 쉬어요. 그쪽은요?', 'smile'],
    [/이상형|어떤\s*사람\s*좋아/, () => truths['이상형'] || '대화가 잘 통하는 사람이요. 지금처럼요?', 'shy'],
    [/뭐\s*좋아|취미|좋아하는\s*(거|것)|관심/, () => likes.length ? `${likes.slice(0, 2).join(', ')} 좋아해요. 특히 ${likes[0]} 얘기하면 시간 가는 줄 몰라요. 그쪽은요?` : '음악 듣는 거 좋아해요. 그쪽은요?', 'laugh'],
    [/(술|뭐|한\s*잔)\s*(마실|마셔|드실)/, () => pickOne(['가볍게 하이볼이요. 너무 세게 마시면 내일 출근 못 해요 ㅎㅎ', '맥주 한 잔이면 충분해요. 같이 짠 할래요?']), 'smile'],
    [/^(안녕|반가|처음\s*뵙)/, () => pickOne([`반가워요! ${name}${josa(name, '이에요', '예요')}.`, '안녕하세요~ 말 걸어 줘서 고마워요.']), 'smile'],
    [/고마워|감사/, () => pickOne(['에이, 별말씀을요 ㅎㅎ', '천만에요. 저도 즐거워요.']), 'smile'],
    [/(춤|댄스).*(잘|출|추)/, () => likes.some(l => /춤|댄스/.test(l)) ? '춤이요? 제 전공이죠 ㅎㅎ 이따 같이 스테이지 갈래요?' : '잘은 못 춰요… 그래도 리듬 타는 건 좋아해요.', 'laugh'],
  ];
  // "OO 좋아해요?" → 페르소나 관심사면 구체적으로 답함
  const topicQ = (P.likes || []).find(l => (l.kw || []).concat(l.topic).some(k => t.includes(k)));
  if (topicQ && /\?|좋아|어때/.test(t)) return { reply: pickOne([`네, ${topicQ.topic} 진짜 좋아해요! 어떻게 알았어요?`, `${topicQ.topic}${josa(topicQ.topic, '은', '는')} 제 최애 얘기예요. 그쪽도 좋아해요?`]), emotion: 'laugh' };
  for (const [re, f, emo] of R) if (re.test(t)) return { reply: f(), emotion: emo };
  return null;
}

/* ── 로컬 대사 엔진 (LLM 미설정 시) ── */
function linesFor(npc, key) { const P = npc.persona || {}, own = P.lines && P.lines[key]; const fb = (NC.fallbackLines || {})[npc.trait || 'outgoing'] || {}; return (own && own.length ? own : fb[key]) || fb.generic || ['…그렇군요.']; }
function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? ''); }
function localReply(npc, an, ctx = {}) {
  const f = an.flags, v = { topic: an.topic || '', name: npc.name }, P = npc.persona || {};
  let key = 'generic', emotion = 'neutral', action = 'none';
  if (f.rude) { key = 'rude'; emotion = 'annoyed'; }
  else if (f.pushy) { key = 'pushy'; emotion = 'annoyed'; }
  else if (f.tease) { key = 'tease'; emotion = 'wink'; }
  else if (an.dislike) { key = 'dislike'; emotion = 'sad'; }
  else if (f.brag || f.cheesy) { key = 'dislike'; emotion = 'annoyed'; }
  else if (an.topic) { key = 'like'; emotion = 'laugh'; }
  else if (f.compliment) { key = 'compliment'; emotion = 'shy'; }
  else if (f.joke) { key = 'joke'; emotion = 'laugh'; }
  else if (f.question) { key = 'question'; emotion = 'smile'; }
  else if (f.boring) { key = 'boring'; emotion = 'neutral'; }
  if (f.cheers) { key = 'cheers'; emotion = 'smile'; action = 'cheers'; }
  let reply = fill(U.pick(linesFor(npc, key)), v);
  // 질문 의도를 알아들으면 그 질문에 직접 답함 (무례·선넘기·밀당 상황 제외)
  const ir = !f.rude && !f.pushy && !f.tease && key !== 'cheers' ? intentReply(npc, ctx.text || '') : null;
  if (ir) { reply = ir.reply; emotion = ir.emotion; }
  if (f.dance && !f.rude) action = 'dance'; if (f.game && !f.rude) action = 'game';
  // 훅: 플레이어가 질문하지 않았고, 답에 이미 되묻기가 없을 때만 새 질문을 한 번 붙임 (같은 질문 반복 금지)
  const asked = npc.askedSet || (npc.askedSet = new Set());
  if (!f.rude && !f.pushy && !f.question && !/\?\s*$/.test(reply) && key !== 'cheers' && Math.random() < .45) {
    const asks = ((P.lines && P.lines.ask) || []).filter(q => !asked.has(q)); if (asks.length) { const q = U.pick(asks); asked.add(q); reply += ' ' + q; }
  }
  return { reply, emotion, action };
}

/* ── LLM 클라이언트 ── */
NC.LLM = {
  enabled: () => !!(NC.server && NC.config && NC.config.llm && NC.session),
  async reply(npc, text, ctx) {
    const an = analyze(text, npc, ctx);
    let out = null;
    if (this.enabled() && npc.id) {
      try {
        const r = await fetch('/api/npc-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session': NC.session.token }, body: JSON.stringify({ npcId: npc.id, text, history: (npc.history || []).slice(-10), affinity: npc.aff, tags: an.tags }) });
        const j = await r.json().catch(() => ({})); if (j.ok) out = j; else if (r.status === 429 && j.error) NC.ui.toast(j.error);
      } catch (e) { /* 네트워크 오류 → 로컬 */ }
    }
    const local = localReply(npc, an, Object.assign({ text }, ctx));
    let delta = an.delta, src = 'local', reply = local.reply, emotion = local.emotion, action = local.action;
    if (out) { src = 'llm'; reply = out.reply; emotion = out.emotion || emotion; action = out.action && out.action !== 'none' ? out.action : action; delta = Math.round(.6 * an.delta + .4 * out.delta); if (an.flags.rude || an.flags.pushy) delta = Math.min(delta, an.delta); }
    return { reply, emotion, action, delta: U.clamp(delta, -15, 12), an, source: src };
  },
};

NC.Affinity = { analyze, localReply, linesFor, fill, stageOf, STAGES, KW };
})();
