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

/* 19금 드립 호감도: 친해지기 전엔 감점, 충분히 친하면 농담으로 받아 줌. 장난형은 관대, 수줍/시크형은 엄격.
 *  tier1(스킨십·플러팅): <40 −4 / <60 0 / 60↑ +3     tier2(직설·수위↑): <40 −10 / <60 −6 / <80 −3 / 80↑ +1
 *  불쾌형(신체 노골 언급·만지기 등, 감정 annoyed)은 −2 추가 + 가점 없음 */
const ADULT_TRAIT = { playful: 2, outgoing: 1, shy: -2, cool: -2 };
function adultDelta(tier, crude, aff, trait) {
  let d = tier === 1 ? (aff < 40 ? -4 : aff < 60 ? 0 : 3) : (aff < 40 ? -10 : aff < 60 ? -6 : aff < 80 ? -3 : 1);
  d += (ADULT_TRAIT[trait] || 0) * (tier === 1 ? .5 : 1);
  if (crude) d = Math.min(d - 2, 0);
  return Math.round(d);
}
function analyze(text, npc, ctx = {}) {
  const t = String(text || '').toLowerCase().trim(), P = npc.persona || {}, trait = npc.trait || 'outgoing', W = TRAIT_W[trait] || TRAIT_W.outgoing;
  const aff = npc.aff, tags = [], f = {}; let d = 0, topic = null, dislike = null;
  f.rude = has(t, KW.rude);
  // 19금 드립: 코퍼스의 x1_(가벼운 스킨십)·x2_(수위↑) 의도와 맞으면 '선넘기' 대신 호감도 단계별로 판정
  const am = NC.Conv && NC.Conv.match ? NC.Conv.match(text) : null;
  f.adult = am && /^x[12]_/.test(am.it.id) ? (am.it.id[1] === '1' ? 1 : 2) : 0; f.adultCrude = f.adult && am.it.e === 'annoyed';
  f.sexual = !f.adult && has(t, KW.sexual); f.pushy = f.sexual || (!f.adult && has(t, KW.pushy));
  f.compliment = has(t, KW.compliment); f.looks = f.compliment && has(t, KW.looks); f.joke = has(t, KW.joke);
  f.brag = has(t, KW.brag); f.cheesy = has(t, KW.cheesy); f.question = has(t, KW.askAbout);
  f.boring = t.length < 3 || KW.boringExact.includes(t.replace(/[.!~?]/g, ''));
  f.repeat = ctx.lastPlayer && ctx.lastPlayer.trim() === t;
  f.cheers = has(t, KW.cheers); f.dance = has(t, KW.dance); f.game = has(t, KW.game);
  (P.likes || []).forEach(l => { if (!topic && has(t, (l.kw || []).map(k => k.toLowerCase()))) topic = l.topic; });
  (P.dislikes || []).forEach(l => { if (!dislike && has(t, (l.kw || []).map(k => k.toLowerCase()))) dislike = l.topic; });
  if (f.rude) { d -= 15; tags.push('무례·비하'); }
  if (f.pushy) { d -= f.sexual ? 12 : 8; tags.push(f.sexual ? '성적 발언(선넘기)' : '선넘기(연락처/실제만남)'); }
  if (f.adult && !f.rude) { d += adultDelta(f.adult, f.adultCrude, aff, trait); tags.push(f.adult === 1 ? '19금 드립(가벼움)' : '19금 드립(수위↑)'); }
  if (!f.rude && !f.pushy && !f.adult) {
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
    [/몇\s*살|나이가|나이는/, () => `${def.age || '스물 몇'}살이에요. 그쪽은요? 비슷해 보이는데요?`, 'smile', 'age'],
    [/무슨\s*일|직업|뭐\s*하는\s*사람|어떤\s*일|회사/, () => `${def.job || '평범한 회사원'} 일 하고 있어요. ${likes[0] ? likes[0] + ' 좋아하는 게 일에도 도움이 많이 돼요.' : ''} 그쪽은 무슨 일 해요?`, 'smile', 'work'],
    [/이름/, () => `${name}${josa(name, '이에요', '예요')}. 그쪽 이름도 알려 줄래요?`, 'smile'],
    [/주말|쉬는\s*날|퇴근\s*후|시간\s*날\s*때|평소에/, () => likes.length > 1 ? `쉬는 날엔 ${likes[0]} 관련된 거 찾아보거나 ${likes[1]} 즐기면서 보내요. 그쪽은 주로 뭐 해요?` : '집에서 푹 쉬어요. 그쪽은요?', 'smile', 'hobby'],
    [/이상형|어떤\s*사람\s*좋아/, () => truths['이상형'] || '대화가 잘 통하는 사람이요. 지금처럼요?', 'shy', 'ideal'],
    [/뭐\s*좋아|취미|좋아하는\s*(거|것)|관심/, () => likes.length ? `${likes.slice(0, 2).join(', ')} 좋아해요. 특히 ${likes[0]} 얘기하면 시간 가는 줄 몰라요. 그쪽은요?` : '음악 듣는 거 좋아해요. 그쪽은요?', 'laugh', 'hobby'],
    [/(춤|댄스).*(잘|출|추)/, () => likes.some(l => /춤|댄스/.test(l)) ? '춤이요? 제 전공이죠 ㅎㅎ 이따 같이 스테이지 갈래요?' : '잘은 못 춰요… 그래도 리듬 타는 건 좋아해요.', 'laugh'],
  ];
  // "OO 좋아해요?" → 페르소나 관심사면 구체적으로 답함
  const topicQ = (P.likes || []).find(l => (l.kw || []).concat(l.topic).some(k => t.includes(k)));
  if (topicQ && /\?|좋아|어때/.test(t)) return { reply: pickOne([`네, ${topicQ.topic} 진짜 좋아해요! 어떻게 알았어요?`, `${topicQ.topic}${josa(topicQ.topic, '은', '는')} 제 최애 얘기예요. 그쪽도 좋아해요?`]), emotion: 'laugh', fu: 'hobby' };
  for (const [re, f, emo, fu] of R) if (re.test(t)) return { reply: f(), emotion: emo, fu: fu || null };
  return null;
}


/* ═══════════ 대화 코퍼스 엔진 (data/conversations.json · 대화쌍 1,100+) ═══════════
 * 매칭 점수 = 키워드 점수(긴 키워드일수록 가중) + 예문과의 글자 바이그램 유사도(Dice) × 4
 *  · 리액션류(네/아니요/와/ㅋㅋ…)는 짧은 말일 때만 강하게 매칭 → 긴 문장 속 '진짜' 같은 단어에 끌려가지 않음
 *  · 1글자 키워드는 그 단어 단독으로 말했을 때만 인정
 *  · NPC가 질문으로 끝냈으면 '후속 반응 뱅크'를 기억했다가, 다음 플레이어 답이 다른 의도와 안 맞으면 그 뱅크로 받아 줌
 *  · 같은 NPC가 같은 문장을 반복하지 않도록 사용한 문장 기록
 *  · 문장 안의 {like1} {like2} {name} {age} {job} {mbti} 는 NPC 데이터로 치환(받침에 맞춰 조사 자동 보정)
 */
const Conv = NC.Conv = { data: null };
const WEAK = new Set(['yes', 'no', 'really', 'wow', 'hmm', 'agree', 'laugh_react', 'thanks', 'sorry', 'why', 'you_first', 'disagree']);
const normT = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}?\s]/gu, ' ').replace(/\s+/g, ' ').trim();
// 어미·추임새처럼 어느 문장에나 나오는 바이그램은 유사도 계산에서 제외 (예: '좋아해요'만 같아서 엉뚱한 의도로 가는 것 방지)
const STOP2 = new Set(['해요', '세요', '에요', '예요', '어요', '아요', '나요', '네요', '까요', '아해', '좋아', '있어', '하세', '했어', '진짜', '정말', '그쪽', '저는', '오늘', '너무', '이에', '이요', '요ㅎ', '하는', '는데', '거예', '같아', '것같', '하고', '어서']);
const bigr = s => { s = s.replace(/[\s?]/g, ''); const o = new Set(); for (let i = 0; i < s.length - 1; i++) { const b = s.slice(i, i + 2); if (!STOP2.has(b)) o.add(b); } if (s.length === 1) o.add(s); return o; };
const dice = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; a.forEach(x => { if (b.has(x)) n++; }); return 2 * n / (a.size + b.size); };
fetch('data/conversations.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
  if (!d) return; d.intents.forEach(it => { it._ex = it.ex.map(e => bigr(normT(e))); }); Conv.data = d;
  console.info(`[conv] 의도 ${d.stats.intents} · 대화쌍 ${d.stats.pairs}`);
}).catch(() => { });

const TRAIT_MBTI = { outgoing: 'ENFP', shy: 'ISFJ', playful: 'ESFP', cool: 'INTJ' };
const PAIRS = [['이에요', '예요'], ['이랑', '랑'], ['은', '는'], ['을', '를'], ['과', '와'], ['이', '가']];
function convVars(npc) {
  const def = npc.def || {}, P = npc.persona || {}, likes = (P.likes || []).map(l => l.topic);
  const job = def.mbti ? def.job : String(def.job || '').split('·').pop().trim();
  return { name: npc.name, age: def.age || '스물 몇', job: job && job !== '직업' ? job : '회사원', mbti: def.mbti || TRAIT_MBTI[npc.trait] || 'ENFP',
           like1: likes[0] || '음악 듣기', like2: likes[1] || '여행', them: (def.gender || npc.gender) === 'm' ? '여자' : '남자' };
}
function convFill(s, v) {
  return s.replace(/\{(\w+)\}(이에요|예요|이랑|랑|은|는|을|를|과|와|이|가)?/g, (_, k, p) => {
    const w = String(v[k] ?? ''); if (!p) return w;
    const pair = PAIRS.find(x => x.includes(p)); const c = w.charCodeAt(w.length - 1);
    const bat = c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0;
    return w + (pair ? (bat ? pair[0] : pair[1]) : p);
  });
}
Conv.match = function (text) {
  const d = Conv.data; if (!d) return null;
  const t = normT(text), tb = bigr(t), compact = t.replace(/[\s?]/g, ''), short = compact.length <= 6, toks = t.split(' ');
  let best = null, bs = 0;
  for (const it of d.intents) {
    let kw = 0;
    for (const k of it.k) {
      if (k.length === 1) { if (compact === k || toks.includes(k)) kw += 1.6; }
      else if (t.includes(k)) kw += 1 + k.length * .6;
    }
    let sim = 0; for (const e of it._ex) sim = Math.max(sim, dice(tb, e));
    if (!kw && sim < .5) continue;                 // 키워드 없이 어설프게 비슷한 문장은 무시
    let sc = kw + sim * 4;
    if (WEAK.has(it.id) && !short) sc *= .35;
    if (sc > bs) { bs = sc; best = it; }
  }
  return bs >= 1.9 ? { it: best, score: bs } : null;
};
function pickFresh(npc, list) {
  const used = npc.convUsed || (npc.convUsed = new Set()); let pool = list.filter(x => !used.has(x)); if (!pool.length) pool = list;
  const s = pool[Math.floor(Math.random() * pool.length)]; used.add(s); if (used.size > 400) used.clear(); return s;
}
Conv.reply = function (npc, text) {
  const d = Conv.data; if (!d) return null;
  const tr = npc.trait in TRAIT_MBTI ? npc.trait : 'outgoing', v = convVars(npc);
  const m = Conv.match(text), isQ = /\?|요\?|까$|나요$|세요$/.test(String(text).trim());
  let src = null, emotion = 'smile', fu = null, id = null;
  // 직전 주제에 대한 '대답'으로 보이면 후속 반응을 우선 (같은 질문 반복·짧은 네/아니요 오해 방지)
  const pend = npc.pendingFu && d.followups[npc.pendingFu];
  const adult = m && /^x[12]_/.test(m.it.id);
  const useFu = pend && !adult && !isQ && (!m || WEAK.has(m.it.id) || m.it.id === npc.lastConvId || m.score < 3);
  if (useFu) { const b = d.followups[npc.pendingFu]; src = b.r[tr] || b.r.outgoing; id = 'fu:' + npc.pendingFu; emotion = 'smile'; }
  else if (m) { src = m.it.r[tr] || m.it.r.outgoing; emotion = m.it.e; fu = m.it.fu; id = m.it.id; }
  if (!src) return null;
  const reply = convFill(pickFresh(npc, src), v);
  npc.pendingFu = fu || null; npc.lastConvId = id;   // 주제 후속 반응은 다음 한 턴 동안 유효
  return { reply, emotion: emotion === 'neutral' ? 'smile' : emotion, id };
};

/* ── 로컬 대사 엔진 (LLM 미설정 시) ── */
function linesFor(npc, key) { const P = npc.persona || {}, own = P.lines && P.lines[key]; const fb = (NC.fallbackLines || {})[npc.trait || 'outgoing'] || {}; return (own && own.length ? own : fb[key]) || fb.generic || ['…그렇군요.']; }
function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? ''); }
function localReply(npc, an, ctx = {}) {
  const f = an.flags, v = { topic: an.topic || '', name: npc.name }, P = npc.persona || {};
  let key = 'generic', emotion = 'neutral', action = 'none';
  if (f.rude) { key = 'rude'; emotion = 'annoyed'; }
  else if (f.pushy) { key = 'pushy'; emotion = 'annoyed'; }
  else if (f.adult) { key = 'tease'; emotion = 'wink'; }
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
  // 우선순위: ① 무례·선넘기·밀당·싫은 주제 = 규칙 대사 유지  ② 페르소나 사실 질문(나이·직업·이상형…)  ③ 대화 코퍼스  ④ 성격별 기본 대사
  const ruleFirst = f.rude || f.pushy || f.tease || an.dislike || f.brag;
  let src = 'rule';
  if (f.adult && !f.rude) {   // 19금 드립은 코퍼스의 재치 있는 받아치기로 응답
    const cv = Conv.reply(npc, ctx.text || ''); if (cv) { reply = cv.reply; emotion = cv.emotion; src = cv.id; }
  } else if (!ruleFirst) {
    const ir = intentReply(npc, ctx.text || '');
    if (ir) { reply = ir.reply; emotion = ir.emotion; npc.pendingFu = ir.fu || null; src = 'persona'; }
    else if (!an.topic) { const cv = Conv.reply(npc, ctx.text || ''); if (cv) { reply = cv.reply; emotion = cv.emotion; src = cv.id; } }
  } else npc.pendingFu = null;
  if (f.dance && !f.rude) action = 'dance'; if (f.game && !f.rude) action = 'game';
  // 훅: 플레이어가 질문하지 않았고, 답에 이미 되묻기가 없을 때만 새 질문을 한 번 붙임 (같은 질문 반복 금지)
  const asked = npc.askedSet || (npc.askedSet = new Set());
  if (!f.rude && !f.pushy && !f.question && !/\?\s*$/.test(reply) && key !== 'cheers' && src === 'rule' && Math.random() < .45) {
    const asks = ((P.lines && P.lines.ask) || []).filter(q => !asked.has(q)); if (asks.length) { const q = U.pick(asks); asked.add(q); reply += ' ' + q; }
  }
  return { reply, emotion, action, src };
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
