'use strict';
/**
 * 부킹 NPC 대화 엔진 (LLM 연동)
 *  - 페르소나는 클라이언트를 믿지 않고 서버의 public/data/npcs.json 에서 읽습니다.
 *  - 시스템 프롬프트: prompts/booking-npc.system.txt ({{placeholder}} 치환)
 *  - 제공자: LLM_PROVIDER=anthropic | openai | none  (키가 없으면 none → 클라이언트 로컬 대사 엔진으로 폴백)
 *  - 출력은 JSON 하나로 강제하고, 서버에서 다시 검증·클램프합니다(프롬프트 인젝션으로 호감도 조작 방지).
 */
const fs = require('fs');
const path = require('path');

const NPC_FILE = path.join(__dirname, 'public', 'data', 'npcs.json');
const PROMPT_FILE = path.join(__dirname, 'prompts', 'booking-npc.system.txt');
const PROVIDER = process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : 'none');
const MODEL = process.env.LLM_MODEL || (PROVIDER === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-5-5');   // 운영 시 최신 모델명으로 지정하세요
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');
const TIMEOUT_MS = +process.env.LLM_TIMEOUT_MS || 12000;

const STAGES = [[0, '냉랭'], [20, '경계'], [40, '호기심'], [60, '설렘'], [80, '호감'], [95, '최고조']];
const stageOf = a => STAGES.filter(([t]) => a >= t).pop()[1];
const EMOTIONS = ['neutral', 'smile', 'laugh', 'shy', 'surprised', 'sad', 'annoyed', 'wink'];
const ACTIONS = ['none', 'cheers', 'drink', 'dance', 'game', 'move_seat', 'leave'];

/* ── 파일 캐시(수정되면 자동 재로딩) ── */
const cache = {};
function readCached(file, parse) {
  try { const st = fs.statSync(file); const c = cache[file]; if (c && c.mtime === st.mtimeMs) return c.v; const v = parse(fs.readFileSync(file, 'utf8')); cache[file] = { mtime: st.mtimeMs, v }; return v; }
  catch (e) { console.error('[llm] read', file, e.message); return cache[file] ? cache[file].v : null; }
}
const personas = () => readCached(NPC_FILE, s => { const j = JSON.parse(s); const m = {}; [...(j.personas || []), ...(j.npcs || [])].forEach(p => { if (p && p.id) m[p.id] = p; }); return m; }) || {};
const template = () => readCached(PROMPT_FILE, s => s) || '';
const getPersona = id => personas()[String(id || '')] || null;

const list = v => (Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x : x && (x.topic || x.text) || '')).filter(Boolean).join(', ') : String(v || '-'));
function buildSystemPrompt(p, affinity) {
  const secrets = (p.secrets || []).filter(s => affinity >= (s.at || 0)).map(s => s.text);
  const vars = {
    name: p.name, age: p.age || '20대', gender: p.gender === 'm' ? '남성' : '여성', job: p.job || '비공개', mbti: p.mbti || '-', trait: p.trait || '-',
    tagline: p.tagline || '-', appearance: p.appearance || '-', personality: p.personality || '-', speech: p.speech || '자연스러운 존댓말',
    likes: list(p.likes), dislikes: list(p.dislikes), catchphrases: list(p.catchphrases), pullPush: p.pullPush ?? 0.4,
    secrets: secrets.length ? secrets.join(' / ') : '(아직 없음 — 호감도가 더 오르면 생김)',
  };
  return template().replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>]/g, '').trim().slice(0, max);
function buildUserMessage(p, { text, history, affinity, tags }) {
  const log = history.map(h => (h.role === 'npc' ? `${p.name}: ` : '플레이어: ') + h.text).join('\n') || '(첫 대화)';
  return `[대화 기록]\n${log}\n\n[게임 상태]\n현재 호감도: ${affinity}/100 (${stageOf(affinity)})\n규칙 엔진이 감지한 발언 특징: ${tags.length ? tags.join(', ') : '특이사항 없음'}\n\n<player_message>\n${text}\n</player_message>\n\n위 플레이어의 말에 '${p.name}' 캐릭터로서 답하고, 지정된 JSON 한 개만 출력해.`;
}

/* ── 제공자 호출 ── */
async function callAnthropic(system, user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 350, temperature: 0.9, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error('anthropic ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json(); return (j.content || []).map(c => c.text || '').join('');
}
async function callOpenAI(system, user) {
  const r = await fetch(OPENAI_BASE + '/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
    body: JSON.stringify({ model: MODEL, temperature: 0.9, max_tokens: 350, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error('openai ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json(); return j.choices?.[0]?.message?.content || '';
}

/* ── 응답 검증 ── */
function parseReply(raw) {
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}'); if (a < 0 || b <= a) throw new Error('no json');
  const o = JSON.parse(raw.slice(a, b + 1));
  let reply = clean(o.reply, 240)
    .replace(/(01[016789])[\s.\-]*\d{3,4}[\s.\-]*\d{4}/g, '[연락처 가림]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[링크 가림]')
    .replace(/@[a-zA-Z0-9_.]{3,}/g, '@(가상계정)');
  if (!reply) throw new Error('empty reply');
  return {
    reply,
    emotion: EMOTIONS.includes(o.emotion) ? o.emotion : 'neutral',
    delta: Math.max(-10, Math.min(10, Math.round(+o.affinity_delta || 0))),
    action: ACTIONS.includes(o.action) ? o.action : 'none',
  };
}

const enabled = () => PROVIDER === 'anthropic' ? !!process.env.ANTHROPIC_API_KEY : PROVIDER === 'openai' ? !!process.env.OPENAI_API_KEY : false;

async function chat(body) {
  const p = getPersona(body.npcId); if (!p) { const e = new Error('unknown npc'); e.status = 404; throw e; }
  if (!enabled()) { const e = new Error('LLM 미설정'); e.status = 503; e.fallback = true; throw e; }
  const text = clean(body.text, 200); if (!text) { const e = new Error('empty'); e.status = 400; throw e; }
  const history = (Array.isArray(body.history) ? body.history : []).slice(-10).map(h => ({ role: h && h.role === 'npc' ? 'npc' : 'user', text: clean(h && h.text, 240) })).filter(h => h.text);
  const affinity = Math.max(0, Math.min(100, Math.round(+body.affinity || 40)));
  const tags = (Array.isArray(body.tags) ? body.tags : []).slice(0, 8).map(t => clean(t, 20)).filter(Boolean);
  const lang = body.lang === 'en' ? 'en' : 'ko';   // v43 영어 화면이면 영어로 답변(JSON 키·감정 값은 그대로)
  const system = buildSystemPrompt(p, affinity) + (lang === 'en' ? '\n\n[LANGUAGE] The player is using the English interface. Write the "reply" text in natural, casual English (keep the same persona, tone and JSON format; keep emotion/action values unchanged).' : ''), user = buildUserMessage(p, { text, history, affinity, tags });
  const raw = PROVIDER === 'openai' ? await callOpenAI(system, user) : await callAnthropic(system, user);
  return Object.assign(parseReply(raw), { source: 'llm' });
}

async function handler(req, res, { verifyToken, rate }) {
  try {
    const tk = verifyToken(String(req.get('x-session') || '')); if (!tk) return res.status(401).json({ ok: false, error: '성인 인증이 필요합니다.' });
    if (!rate('llm:' + tk.uid, 20, 60e3)) return res.status(429).json({ ok: false, error: '대화가 너무 빨라요. 잠시 후 다시 말 걸어 주세요.', fallback: true });
    if (!rate('llmd:' + tk.uid, 500, 86400e3)) return res.status(429).json({ ok: false, error: '오늘 AI 대화 한도를 다 썼어요.', fallback: true });
    const out = await chat(req.body || {}); res.json(Object.assign({ ok: true }, out));
  } catch (e) {
    if (!e.fallback && e.status !== 404 && e.status !== 400) console.error('[llm]', e.message);
    res.status(e.status || 502).json({ ok: false, error: e.message, fallback: true });
  }
}

module.exports = { handler, enabled, buildSystemPrompt, getPersona, stageOf, PROVIDER, MODEL };
