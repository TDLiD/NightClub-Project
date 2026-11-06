'use strict';
/**
 * 운영 기능 모듈: 성인 인증 토큰 · 입장 제한 · 신고/차단 · 제재 · 채팅 필터
 *
 * ⚠ 운영 전 필수 확인
 *  - VERIFY_MODE=mock 은 "생년월일 자기신고"라서 법적 의미의 성인 인증이 아닙니다(개발·데모용).
 *    실서비스는 PASS/휴대폰 본인확인/아이핀 등 인증기관 연동으로 교체하세요(providers 참고).
 *  - 생년월일·CI 원문은 저장하지 않고, 성인 여부(bool)와 서비스용 해시 ID(uid)만 토큰에 담습니다.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.TOKEN_SECRET) console.warn('[ops] TOKEN_SECRET 미설정: 임시 키 사용(재시작 시 모든 인증 토큰 무효)');
const TOKEN_TTL_MS = (+process.env.TOKEN_TTL_HOURS || 12) * 3600e3;
const REPORT_BAN_COUNT = +process.env.REPORT_BAN_COUNT || 3;          // 서로 다른 신고자 N명이면 자동 임시 정지
const AUTO_BAN_MIN = +process.env.AUTO_BAN_MIN || 30;
const VERIFY_MODE = process.env.VERIFY_MODE || 'mock';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'ops.json');

/* ── 저장소(JSON 파일) ── */
let db = { bans: {}, ipBans: {}, blocks: {}, reports: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) { /* 최초 실행 */ }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DB_FILE + '.tmp', DB_FILE); } catch (e) { console.error('[ops] save', e.message); } }, 300);
}
function flush() { clearTimeout(saveTimer); try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (e) { } }

/* ── 토큰 ── */
const b64 = b => Buffer.from(b).toString('base64url');
const hmac = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function issueToken(uid) {
  const body = b64(JSON.stringify({ uid, adult: true, exp: Date.now() + TOKEN_TTL_MS }));
  return { token: body + '.' + hmac(body), exp: Date.now() + TOKEN_TTL_MS };
}
function verifyToken(t) {
  if (typeof t !== 'string' || t.length > 400) return null;
  const [body, sig] = t.split('.'); if (!body || !sig) return null;
  const good = hmac(body); const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); if (!p.adult || p.exp < Date.now()) return null; return p; } catch (e) { return null; }
}

/* ── 성인 판정 ──
 * 청소년 보호법상 '연 나이' 기준: 만 19세가 되는 해의 1월 1일부터 성인으로 취급(술·담배 등 청소년 유해 업소 기준).
 * (아래 계산: 올해 - 출생연도 >= 19)  → 서비스 정책에 맞게 조정하세요.
 */
function isAdultByYear(year, now = new Date()) { return now.getFullYear() - year >= 19; }
function validDate(y, m, d) { const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d; }

/* ── 인증 제공자 (교체 지점) ── */
const providers = {
  // 개발·데모: 생년월일 자기신고 (법적 효력 없음)
  mock: async (body) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(body.birth || ''));
    if (!m) throw httpErr(400, '생년월일 형식이 올바르지 않습니다.');
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (y < 1900 || !validDate(y, mo, d) || new Date(Date.UTC(y, mo - 1, d)) > new Date()) throw httpErr(400, '존재하지 않는 생년월일입니다.');
    if (!isAdultByYear(y)) throw httpErr(403, '미성년자는 입장할 수 없습니다.');
    return { stableKey: 'dev:' + String(body.deviceId || '').slice(0, 64) };
  },
  // 실서비스 예시: 인증기관이 돌려준 결과를 서버-서버로 재검증 (구현 필요)
  //   입력: 인증기관 결과 토큰 → 출력: { stableKey: CI 또는 CI 해시 }, 성인 아니면 403
  pass: async (/* body */) => { throw httpErr(501, '본인인증 기관 연동이 아직 구성되지 않았습니다. server-ops.js providers.pass 를 구현하세요.'); },
};
function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

async function verifyHandler(req, res) {
  try {
    const prov = providers[VERIFY_MODE]; if (!prov) throw httpErr(500, '인증 모드 설정 오류');
    const ipKey = 'v:' + req.ip; if (!rate(ipKey, 10, 60e3)) throw httpErr(429, '시도가 너무 많습니다. 잠시 후 다시 시도하세요.');
    const { stableKey } = await prov(req.body || {});
    const uid = crypto.createHmac('sha256', SECRET).update(stableKey).digest('hex').slice(0, 24);   // 원문 비저장 · 단방향 ID
    const b = banStatus(uid); if (b) throw httpErr(403, '이용이 제한된 계정입니다.' + (b.until ? ' (해제: ' + new Date(b.until).toLocaleString('ko-KR') + ')' : ''));
    const t = issueToken(uid); res.json({ ok: true, token: t.token, exp: t.exp });
  } catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message }); }
}

/* ── 레이트 리밋(슬라이딩 윈도) ── */
const hits = new Map();
function rate(key, max, windowMs) {
  const now = Date.now(); const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; } arr.push(now); hits.set(key, arr); return true;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) { const f = a.filter(t => now - t < 120e3); if (f.length) hits.set(k, f); else hits.delete(k); } }, 60e3).unref();

/* ── 제재 ── */
function banStatus(uid) { const b = db.bans[uid]; if (!b) return null; if (b.until && b.until < Date.now()) { delete db.bans[uid]; save(); return null; } return b; }
function ipBanStatus(ip) { const b = db.ipBans[ip]; if (!b) return null; if (b.until && b.until < Date.now()) { delete db.ipBans[ip]; save(); return null; } return b; }
function ban(uid, minutes, reason, by) { db.bans[uid] = { until: minutes ? Date.now() + minutes * 60e3 : 0, reason: String(reason || '').slice(0, 200), by: by || 'admin', at: Date.now() }; save(); }
function unban(uid) { delete db.bans[uid]; save(); }

/* ── 입장 제한 ── */
function canEnter({ uid, ip, online, perIp, max }) {
  const b = banStatus(uid); if (b) return { ok: false, code: 'banned', msg: '이용이 제한된 계정입니다.' + (b.until ? ' (해제: ' + new Date(b.until).toLocaleString('ko-KR') + ')' : ' (영구)') };
  if (ipBanStatus(ip)) return { ok: false, code: 'ipban', msg: '접속이 제한된 네트워크입니다.' };
  if (online.size >= max) return { ok: false, code: 'full', msg: `현재 만석입니다(${max}명). 잠시 후 다시 시도해 주세요.` };
  let same = 0, dup = false; for (const p of online.values()) { if (p.ip === ip) same++; if (p.uid === uid) dup = true; }
  if (dup) return { ok: false, code: 'dup', msg: '이미 다른 창/기기에서 접속 중입니다.' };
  if (same >= perIp) return { ok: false, code: 'ip', msg: `같은 네트워크에서 동시 접속은 ${perIp}명까지 가능합니다.` };
  return { ok: true };
}

/* ── 차단 ── */
const blockSet = uid => new Set(db.blocks[uid] || []);
function block(uid, target) { if (uid === target) return; const s = blockSet(uid); s.add(target); db.blocks[uid] = [...s].slice(-200); save(); }
function unblock(uid, target) { const s = blockSet(uid); s.delete(target); db.blocks[uid] = [...s]; save(); }
const isBlockedEither = (a, b) => blockSet(a).has(b) || blockSet(b).has(a);

/* ── 신고 ── */
const REASONS = ['욕설·비하', '성희롱·성적 언행', '스팸·홍보', '사칭·사기', '기타'];
function addReport({ reporter, target, reason, detail, evidence, targetName, reporterName }) {
  if (!REASONS.includes(reason)) reason = '기타';
  const r = { id: crypto.randomBytes(4).toString('hex'), at: Date.now(), reporter, target, reason, detail: String(detail || '').slice(0, 300), evidence: (evidence || []).slice(-10), targetName, reporterName, status: 'open' };
  db.reports.push(r); if (db.reports.length > 5000) db.reports.splice(0, db.reports.length - 5000);
  const dayAgo = Date.now() - 24 * 3600e3;
  const who = new Set(db.reports.filter(x => x.target === target && x.at > dayAgo && x.status !== 'dismissed').map(x => x.reporter));
  let autoBanned = false;
  if (who.size >= REPORT_BAN_COUNT && !banStatus(target)) { ban(target, AUTO_BAN_MIN, `자동 임시정지(신고 ${who.size}명)`, 'auto'); autoBanned = true; }
  save(); return { report: r, autoBanned };
}

/* ── 채팅 필터 ── */
const BAD = ['씨발', '시발', 'ㅅㅂ', '병신', 'ㅂㅅ', '개새끼', '좆', '지랄', '꺼져', '미친놈', '미친년', '창녀', '섹스', '성관계'];
const badRe = new RegExp(BAD.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
function filterText(s) {
  let t = String(s).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120); let flagged = false;
  t = t.replace(badRe, m => { flagged = true; return '*'.repeat(m.length); });
  t = t.replace(/(01[016789])[\s.\-]*\d{3,4}[\s.\-]*\d{4}/g, () => { flagged = true; return '[연락처 가림]'; });   // 외부 연락처 유도 차단
  t = t.replace(/https?:\/\/\S+|www\.\S+/gi, () => { flagged = true; return '[링크 가림]'; });
  return { text: t, flagged };
}
function validName(n) { if (typeof n !== 'string') return false; n = n.trim(); if (!/^[가-힣a-zA-Z0-9_ ]{2,10}$/.test(n)) return false; badRe.lastIndex = 0; const bad = badRe.test(n); badRe.lastIndex = 0; return !bad; }

/* ── 관리자 API ── */
function adminAuth(req, res, next) {
  const tok = process.env.ADMIN_TOKEN; if (!tok) return res.status(404).json({ ok: false, error: 'admin disabled (ADMIN_TOKEN 미설정)' });
  const got = String(req.get('x-admin-token') || ''); const a = Buffer.from(got), b = Buffer.from(tok);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ ok: false });
  next();
}
function mountAdmin(app, onBan) {
  app.get('/admin/reports', adminAuth, (req, res) => res.json({ ok: true, reports: db.reports.filter(r => req.query.all || r.status === 'open').slice(-200).reverse(), bans: db.bans }));
  app.post('/admin/ban', adminAuth, (req, res) => { const { uid, minutes = 0, reason = '' } = req.body || {}; if (!uid) return res.status(400).json({ ok: false }); ban(uid, +minutes, reason, 'admin'); onBan && onBan(uid, reason); res.json({ ok: true }); });
  app.post('/admin/unban', adminAuth, (req, res) => { unban((req.body || {}).uid); res.json({ ok: true }); });
  app.post('/admin/ban-ip', adminAuth, (req, res) => { const { ip, minutes = 0 } = req.body || {}; if (!ip) return res.status(400).json({ ok: false }); db.ipBans[ip] = { until: +minutes ? Date.now() + minutes * 60e3 : 0 }; save(); res.json({ ok: true }); });
  app.post('/admin/report-status', adminAuth, (req, res) => { const r = db.reports.find(x => x.id === (req.body || {}).id); if (r) { r.status = (req.body || {}).status === 'dismissed' ? 'dismissed' : 'resolved'; save(); } res.json({ ok: !!r }); });
}

module.exports = { verifyToken, verifyHandler, canEnter, rate, filterText, validName, block, unblock, blockSet, isBlockedEither, addReport, mountAdmin, banStatus, ban, REASONS, flush, isAdultByYear };
