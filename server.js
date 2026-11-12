'use strict';
/**
 * 추억의 나이트 v2 · 멀티플레이 서버
 *   node server.js            (기본 포트 3000)
 * 환경변수: PORT, MAX_PLAYERS, MAX_PER_IP, TRUST_PROXY, TOKEN_SECRET, ADMIN_TOKEN, VERIFY_MODE,
 *          ANTHROPIC_API_KEY | OPENAI_API_KEY, LLM_PROVIDER, LLM_MODEL, ICE_SERVERS ... (README 참고)
 *
 * 채널 구조
 *   all   : 전체 채팅
 *   near  : 근거리(NEAR_RADIUS m 이내) — VIP 룸 안에 있으면 자동으로 룸 채널로 제한
 *   table : 같은 테이블
 *   room  : 같은 VIP 룸 (비밀 대화방). 잠긴 룸은 주인만 입장 가능
 *   rtc   : WebRTC 시그널링 릴레이 (근거리 음성)
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { WebSocketServer } = require('ws');
const ops = require('./server-ops');
const llm = require('./server-llm');
const { sanitizeLook } = require('./server-look');

const PORT = +process.env.PORT || 3000;
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 50;
const MAX_PER_IP = +process.env.MAX_PER_IP || 3;
const NEAR_RADIUS = +process.env.NEAR_RADIUS || 8;
const TABLE_COUNT = 6, SEATS = 4, VIP_COUNT = 3;
const BOUNDS = { x: 23.2, z: 19.2 };
const EMOTES = ['wave', 'bow', 'cheers', 'drink', 'clap', 'cheer', 'shy', 'laugh', 'stageDance', 'groove'];
let ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
try { if (process.env.ICE_SERVERS) ICE = JSON.parse(process.env.ICE_SERVERS); } catch (e) { console.warn('[server] ICE_SERVERS JSON 파싱 실패 → 기본 STUN 사용'); }

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'no-referrer'); next(); });
/* v33 프로필 사진 목록: public/profile/boy|girl 폴더를 그대로 읽어 줌(새 사진을 넣으면 자동 반영) */
app.get('/api/profiles', (req, res) => {
  const out = {}; const IMG = /\.(jpe?g|jfif|png|webp|avif|gif)$/i;
  for (const g of ['boy', 'girl']) { try { out[g] = fs.readdirSync(path.join(__dirname, 'public', 'profile', g)).filter(f => IMG.test(f)).sort(); } catch (e) { out[g] = []; } }
  res.set('Cache-Control', 'no-cache').json(out);
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], setHeaders: (res, p) => { if (/\.jfif$/i.test(p)) res.setHeader('Content-Type', 'image/jpeg'); else if (/\.avif$/i.test(p)) res.setHeader('Content-Type', 'image/avif'); } }));
// three.js 로컬 사본 (CDN 차단·오프라인 대비 폴백)
const THREE_DIR = path.join(__dirname, 'node_modules', 'three', 'build');
if (fs.existsSync(THREE_DIR)) app.use('/vendor', express.static(THREE_DIR, { maxAge: '7d' }));

const online = new Map();                    // id → player
let nextId = 1;
const tables = Array.from({ length: TABLE_COUNT }, () => Array(SEATS).fill(null));
const roomOwners = Array(VIP_COUNT).fill(null);   // VIP 룸 잠금(부킹으로 예약한 사람 id)
const invites = new Map();

app.get('/api/health', (req, res) => res.json({ ok: true, online: online.size, max: MAX_PLAYERS }));
app.get('/api/config', (req, res) => res.json({ ok: true, iceServers: ICE, llm: llm.enabled(), llmModel: llm.enabled() ? llm.MODEL : null, nearRadius: NEAR_RADIUS }));
app.post('/api/verify', express.json({ limit: '2kb' }), ops.verifyHandler);
app.post('/api/npc-chat', express.json({ limit: '24kb' }), (req, res) => llm.handler(req, res, ops));
app.use('/admin', express.json({ limit: '2kb' }));
ops.mountAdmin(app, (uid, reason) => { for (const p of online.values()) if (p.uid === uid) kick(p, '운영 정책에 따라 이용이 제한되었습니다. ' + reason); });

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

/* ── 전송 도우미 ── */
const send = (p, o) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(o)); };
const pub = p => ({ id: p.id, name: p.name, color: p.color, look: p.look, x: p.x, z: p.z, r: p.r });
const visible = (a, b) => a.id !== b.id && !ops.isBlockedEither(a.uid, b.uid);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function broadcast(o, except) { for (const p of online.values()) if (p !== except) send(p, o); }
function broadcastVisible(from, o) { for (const p of online.values()) if (p !== from && visible(from, p)) send(p, o); }
function sendTables() { for (const p of online.values()) send(p, { type: 'tables', t: tables }); }
function sendRooms() { for (const p of online.values()) send(p, { type: 'rooms', owners: roomOwners }); }
function kick(p, msg) { send(p, { type: 'kicked', msg }); try { p.ws.close(4001, 'kicked'); } catch (e) { } }
function seatOf(p) { for (let t = 0; t < TABLE_COUNT; t++) { const s = tables[t].indexOf(p.id); if (s >= 0) return { t, s }; } return null; }
function leaveSeat(p) { const st = seatOf(p); if (st) { tables[st.t][st.s] = null; return true; } return false; }
function sitAt(p, t) { leaveSeat(p); const s = tables[t].indexOf(null); if (s < 0) return false; tables[t][s] = p.id; return true; }
function blocklistFor(p) { return [...ops.blockSet(p.uid)].map(uid => { const o = [...online.values()].find(x => x.uid === uid); return { uid, name: o ? o.name : '(오프라인)' }; }); }
const notice = (p, msg) => send(p, { type: 'notice', msg });
function releaseRooms(p) { let ch = false; roomOwners.forEach((o, i) => { if (o === p.id) { roomOwners[i] = null; ch = true; } }); if (ch) sendRooms(); }
function canHear(from, to, scope) {             // 채팅 수신 범위 판정
  if (scope === 'all') return true;
  if (scope === 'room') return from.room >= 0 && to.room === from.room;
  if (scope === 'table') { const a = seatOf(from), b = seatOf(to); return !!(a && b && a.t === b.t); }
  /* near */ if (from.room >= 0 || to.room >= 0) return from.room === to.room;   // 룸 안팎은 소리가 섞이지 않음
  return dist(from, to) <= NEAR_RADIUS;
}

/* ── 연결 ── */
wss.on('connection', (ws, req) => {
  const ip = (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress;
  let me = null; ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  const helloTimer = setTimeout(() => ws.close(4000, 'hello timeout'), 8000);
  const deny = (code, msg) => { try { ws.send(JSON.stringify({ type: 'denied', code, msg })); } catch (e) { } ws.close(4003, code); };

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; } if (!m || typeof m.type !== 'string') return;
    if (m.type !== 'rtc' && raw.length > 4096) return;                // SDP 외의 메시지는 작게

    if (!me) {                                                       // ── 입장 심사 ──
      if (m.type !== 'hello') return; clearTimeout(helloTimer);
      const tk = ops.verifyToken(m.token);
      if (!tk) return deny('auth', '성인 인증이 필요하거나 만료되었습니다. 다시 인증해 주세요.');
      const name = String(m.name || '').trim();
      if (!ops.validName(name)) return deny('name', '사용할 수 없는 닉네임입니다. (2~10자 한글·영문·숫자)');
      if ([...online.values()].some(p => p.name.toLowerCase() === name.toLowerCase())) return deny('name', '이미 사용 중인 닉네임입니다.');
      const chk = ops.canEnter({ uid: tk.uid, ip, online, perIp: MAX_PER_IP, max: MAX_PLAYERS });
      if (!chk.ok) return deny(chk.code, chk.msg);
      const color = Number.isInteger(m.color) && m.color >= 0 && m.color <= 0xffffff ? m.color : 0xff3d9a;
      me = { id: 'p' + (nextId++), ws, uid: tk.uid, ip, name, color, look: sanitizeLook(m.look, color), x: (Math.random() - .5) * 6, z: 6.9, r: Math.PI, room: -1, ring: [], joinedAt: Date.now(), muteUntil: 0 };
      online.set(me.id, me);
      send(me, { type: 'welcome', id: me.id, max: MAX_PLAYERS, tables, rooms: roomOwners, nearRadius: NEAR_RADIUS, players: [...online.values()].filter(p => visible(me, p)).map(pub), blocks: blocklistFor(me), reasons: ops.REASONS });
      broadcastVisible(me, { type: 'join', p: pub(me) }); broadcastVisible(me, { type: 'notice', msg: `${me.name}님이 입장했어요 🪩` }); return;
    }

    switch (m.type) {
      case 'move': {
        const x = +m.x, z = +m.z, r = +m.r; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        if (seatOf(me)) return;
        me.x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, x)); me.z = Math.max(-BOUNDS.z, Math.min(BOUNDS.z, z)); me.r = Number.isFinite(r) ? r : me.r; break;
      }
      case 'zone': {                                                 // VIP 룸 입장/퇴장 (비밀 대화방 채널)
        const room = Number.isInteger(m.room) && m.room >= 0 && m.room < VIP_COUNT ? m.room : -1;
        if (room >= 0 && roomOwners[room] && roomOwners[room] !== me.id) { me.room = -1; return notice(me, `VIP ${room + 1} 룸은 예약된 방이에요.`); }
        me.room = room; break;
      }
      case 'roomClaim': {
        const r = m.room | 0; if (r < 0 || r >= VIP_COUNT) return;
        const busy = (roomOwners[r] && roomOwners[r] !== me.id) || [...online.values()].some(p => p !== me && p.room === r);
        if (busy) return send(me, { type: 'roomClaim', room: r, ok: false });
        releaseRooms(me); roomOwners[r] = me.id; send(me, { type: 'roomClaim', room: r, ok: true }); sendRooms(); break;
      }
      case 'roomRelease': releaseRooms(me); break;
      case 'emote': {
        if (!EMOTES.includes(m.name) || !ops.rate('e:' + me.id, 12, 10e3)) return;
        broadcastVisible(me, { type: 'emote', id: me.id, name: m.name }); break;
      }
      case 'rtc': {                                                  // WebRTC 시그널링 릴레이 (offer/answer/ice)
        const to = online.get(m.to); if (!to || !visible(me, to) || !m.data || typeof m.data !== 'object') return;
        if (!ops.rate('rtc:' + me.id, 120, 10e3)) return;
        if (!(canHear(me, to, 'near') || dist(me, to) <= NEAR_RADIUS + 4)) return;   // 근거리에서만 음성 연결
        send(to, { type: 'rtc', from: me.id, data: m.data }); break;
      }
      case 'chat': {
        const now = Date.now(); if (me.muteUntil > now) return notice(me, '도배로 인해 잠시 채팅이 제한되었어요.');
        if (!ops.rate('c:' + me.id, 6, 10e3)) { me.muteUntil = now + 30e3; return notice(me, '메시지를 너무 빠르게 보내고 있어요. 30초간 채팅 제한.'); }
        const f = ops.filterText(m.text); if (!f.text) return;
        let scope = ['all', 'near', 'table', 'room'].includes(m.scope) ? m.scope : 'near';
        if (scope === 'table' && !seatOf(me)) scope = 'near';
        if (scope === 'room' && me.room < 0) scope = 'near';
        if (scope === 'all' && me.room >= 0) scope = 'room';            // 비밀 대화방 안에서는 전체 방송 금지
        me.ring.push({ at: now, scope, text: f.text }); if (me.ring.length > 10) me.ring.shift();
        const msg = { type: 'chat', id: me.id, name: me.name, text: f.text, scope };
        for (const p of online.values()) { if (p !== me && (!visible(me, p) || !canHear(me, p, scope))) continue; send(p, msg); }
        if (f.flagged) notice(me, '일부 표현/연락처가 가려졌어요.'); break;
      }
      case 'sit': { const t = m.table | 0; if (t < 0 || t >= TABLE_COUNT) return; if (!sitAt(me, t)) return notice(me, '빈자리가 없어요.'); sendTables(); break; }
      case 'stand': { if (leaveSeat(me)) sendTables(); break; }
      case 'invite': {
        const to = online.get(m.to); if (!to || !visible(me, to)) return;
        if (!ops.rate('i:' + me.id, 6, 60e3)) return notice(me, '초대는 1분에 6번까지 보낼 수 있어요.');
        let st = seatOf(me);
        if (!st) { const t = tables.findIndex(r => r.every(v => v == null)); if (t < 0) return notice(me, '빈 테이블이 없어요.'); sitAt(me, t); sendTables(); st = seatOf(me); }
        const st2 = seatOf(to); if (st2 && st2.t === st.t) return notice(me, '이미 같은 테이블이에요.');
        if (!tables[st.t].includes(null)) return notice(me, '테이블이 가득 찼어요.');
        invites.set(me.id + '>' + to.id, { at: Date.now(), table: st.t }); send(to, { type: 'invite', from: me.id, name: me.name, table: st.t }); notice(me, `${to.name}님에게 부킹 초대를 보냈어요 💌`); break;
      }
      case 'inviteReply': {
        const from = online.get(m.from), key = m.from + '>' + me.id, inv = invites.get(key); invites.delete(key);
        if (!from || !inv || Date.now() - inv.at > 30e3) return notice(me, '만료된 초대예요.');
        if (!m.accept) return notice(from, `${me.name}님이 정중히 거절했어요.`);
        if (ops.isBlockedEither(me.uid, from.uid)) return;
        const st = seatOf(from); if (!st || st.t !== inv.table) return notice(me, '초대한 분이 자리를 떠났어요.');
        leaveSeat(me); const s = tables[inv.table].indexOf(null); if (s < 0) return notice(me, '자리가 가득 찼어요.'); tables[inv.table][s] = me.id; sendTables();
        notice(from, `${me.name}님이 합석했어요! 🥂`); break;
      }
      case 'report': {
        const t = online.get(m.target); if (!t || t.id === me.id) return; if (!ops.rate('r:' + me.id, 5, 3600e3)) return notice(me, '신고는 1시간에 5건까지 접수할 수 있어요.');
        const r = ops.addReport({ reporter: me.uid, reporterName: me.name, target: t.uid, targetName: t.name, reason: m.reason, detail: m.detail, evidence: t.ring });
        send(me, { type: 'reported' }); notice(me, '신고가 접수되었어요. 운영팀이 확인합니다.');
        if (r.autoBanned) kick(t, '여러 건의 신고가 접수되어 일시적으로 이용이 제한되었습니다.'); break;
      }
      case 'block': {
        const t = online.get(m.target); if (!t || t.id === me.id) return; ops.block(me.uid, t.uid); leaveSeatIfShared(me, t);
        send(me, { type: 'hide', id: t.id }); send(t, { type: 'hide', id: me.id }); send(me, { type: 'blocks', list: blocklistFor(me) }); notice(me, `${t.name}님을 차단했어요.`); break;
      }
      case 'unblock': { ops.unblock(me.uid, String(m.uid)); send(me, { type: 'blocks', list: blocklistFor(me) }); notice(me, '차단을 해제했어요. 다시 입장하면 서로 보여요.'); break; }
    }
  });

  ws.on('close', () => {
    clearTimeout(helloTimer); if (!me) return; online.delete(me.id);
    if (leaveSeat(me)) sendTables(); releaseRooms(me); broadcast({ type: 'leave', id: me.id });
    for (const k of invites.keys()) if (k.split('>').includes(me.id)) invites.delete(k);
  });
  ws.on('error', () => { });
});
function leaveSeatIfShared(a, b) { const x = seatOf(a), y = seatOf(b); if (x && y && x.t === y.t) { leaveSeat(b); sendTables(); } }

/* 위치 브로드캐스트(10Hz): 차단 관계 제외 */
setInterval(() => {
  const all = [...online.values()]; if (all.length < 2) return;
  for (const p of all) { const list = []; for (const o of all) if (visible(p, o)) list.push([o.id, +o.x.toFixed(2), +o.z.toFixed(2), +o.r.toFixed(2)]); send(p, { type: 'state', s: list }); }
}, 100);
setInterval(() => { for (const ws of wss.clients) { if (ws.isAlive === false) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } const now = Date.now(); for (const [k, v] of invites) if (now - v.at > 60e3) invites.delete(k); }, 30e3).unref();

process.on('SIGINT', () => { ops.flush(); process.exit(0); }); process.on('SIGTERM', () => { ops.flush(); process.exit(0); });
if (require.main === module) server.listen(PORT, () => console.log(`🪩 추억의 나이트 v2: http://localhost:${PORT}  (최대 ${MAX_PLAYERS}명, IP당 ${MAX_PER_IP}명, 인증=${process.env.VERIFY_MODE || 'mock'}, LLM=${llm.enabled() ? llm.PROVIDER + ':' + llm.MODEL : '미설정(로컬 대사 엔진)'})`));
module.exports = { server, wss, app };
