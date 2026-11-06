'use strict';
/**
 * 추억의 나이트 · 멀티플레이 서버
 *   node server.js            (기본 포트 3000)
 * 환경변수: PORT, MAX_PLAYERS, MAX_PER_IP, TRUST_PROXY, TOKEN_SECRET, ADMIN_TOKEN, VERIFY_MODE ... (README 참고)
 */
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');
const ops = require('./server-ops');

const PORT = +process.env.PORT || 3000;
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 50;
const MAX_PER_IP = +process.env.MAX_PER_IP || 3;
const TABLE_COUNT = 6, SEATS = 4;
const BOUNDS = { x: 19.2, z: 15.2 };

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
app.use(express.json({ limit: '2kb' }));
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'no-referrer'); next(); });
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const online = new Map();                    // id → player
let nextId = 1;
const tables = Array.from({ length: TABLE_COUNT }, () => Array(SEATS).fill(null));   // 좌석 → player id
const invites = new Map();                   // `${from}>${to}` → {at, table}

app.get('/api/health', (req, res) => res.json({ ok: true, online: online.size, max: MAX_PLAYERS }));
app.post('/api/verify', ops.verifyHandler);
ops.mountAdmin(app, (uid, reason) => { for (const p of online.values()) if (p.uid === uid) kick(p, '운영 정책에 따라 이용이 제한되었습니다. ' + reason); });

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });

/* ── 전송 도우미 ── */
const send = (p, o) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(o)); };
const pub = p => ({ id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, r: p.r });
const visible = (a, b) => a.id !== b.id && !ops.isBlockedEither(a.uid, b.uid);      // 차단 관계는 서로 보이지 않음
function broadcast(o, except) { for (const p of online.values()) if (p !== except) send(p, o); }
function broadcastVisible(from, o) { for (const p of online.values()) if (p !== from && visible(from, p)) send(p, o); }
function sendTables() { const t = tables; for (const p of online.values()) send(p, { type: 'tables', t }); }
function kick(p, msg) { send(p, { type: 'kicked', msg }); try { p.ws.close(4001, 'kicked'); } catch (e) { } }
function seatOf(p) { for (let t = 0; t < TABLE_COUNT; t++) { const s = tables[t].indexOf(p.id); if (s >= 0) return { t, s }; } return null; }
function leaveSeat(p) { const st = seatOf(p); if (st) { tables[st.t][st.s] = null; return true; } return false; }
function sitAt(p, t) { leaveSeat(p); const s = tables[t].indexOf(null); if (s < 0) return false; tables[t][s] = p.id; return true; }
function blocklistFor(p) { return [...ops.blockSet(p.uid)].map(uid => { const o = [...online.values()].find(x => x.uid === uid); return { uid, name: o ? o.name : '(오프라인)' }; }); }
const notice = (p, msg) => send(p, { type: 'notice', msg });

/* ── 연결 ── */
wss.on('connection', (ws, req) => {
  const ip = (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress;
  let me = null; ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  const helloTimer = setTimeout(() => ws.close(4000, 'hello timeout'), 8000);
  const deny = (code, msg) => { try { ws.send(JSON.stringify({ type: 'denied', code, msg })); } catch (e) { } ws.close(4003, code); };

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; } if (!m || typeof m.type !== 'string') return;

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
      me = { id: 'p' + (nextId++), ws, uid: tk.uid, ip, name, color, x: (Math.random() - .5) * 6, z: 12, r: Math.PI, lastMove: 0, ring: [], chatB: [], joinedAt: Date.now(), muteUntil: 0 };
      online.set(me.id, me);
      send(me, { type: 'welcome', id: me.id, max: MAX_PLAYERS, tables, players: [...online.values()].filter(p => visible(me, p)).map(pub), blocks: blocklistFor(me), reasons: ops.REASONS });
      broadcastVisible(me, { type: 'join', p: pub(me) }); broadcastVisible(me, { type: 'notice', msg: `${me.name}님이 입장했어요 🪩` }); return;
    }

    switch (m.type) {
      case 'move': {
        const x = +m.x, z = +m.z, r = +m.r; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        if (seatOf(me)) return;
        me.x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, x)); me.z = Math.max(-BOUNDS.z, Math.min(BOUNDS.z, z)); me.r = Number.isFinite(r) ? r : me.r; break;
      }
      case 'chat': {
        const now = Date.now(); if (me.muteUntil > now) return notice(me, '도배로 인해 잠시 채팅이 제한되었어요.');
        if (!ops.rate('c:' + me.id, 6, 10e3)) { me.muteUntil = now + 30e3; return notice(me, '메시지를 너무 빠르게 보내고 있어요. 30초간 채팅 제한.'); }
        const f = ops.filterText(m.text); if (!f.text) return;
        const scope = m.scope === 'table' && seatOf(me) ? 'table' : 'all'; const st = seatOf(me);
        me.ring.push({ at: now, scope, text: f.text }); if (me.ring.length > 10) me.ring.shift();      // 신고 증거용 최근 대화
        const msg = { type: 'chat', id: me.id, name: me.name, text: f.text, scope };
        for (const p of online.values()) { if (!visible(me, p) && p !== me) continue; if (scope === 'table') { const o = seatOf(p); if (!o || !st || o.t !== st.t) continue; } send(p, msg); }
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
    if (leaveSeat(me)) sendTables(); broadcast({ type: 'leave', id: me.id });
    for (const k of invites.keys()) if (k.includes(me.id)) invites.delete(k);
  });
  ws.on('error', () => { });
});
function leaveSeatIfShared(a, b) { const x = seatOf(a), y = seatOf(b); if (x && y && x.t === y.t) { leaveSeat(b); sendTables(); } }

/* 위치 브로드캐스트(10Hz): 차단 관계는 제외 */
setInterval(() => {
  const all = [...online.values()]; if (all.length < 2) return;
  for (const p of all) { const list = []; for (const o of all) if (visible(p, o)) list.push([o.id, +o.x.toFixed(2), +o.z.toFixed(2), +o.r.toFixed(2)]); send(p, { type: 'state', s: list }); }
}, 100);
/* 죽은 연결 정리 + 만료 초대 정리 */
setInterval(() => { for (const ws of wss.clients) { if (ws.isAlive === false) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } const now = Date.now(); for (const [k, v] of invites) if (now - v.at > 60e3) invites.delete(k); }, 30e3).unref();

process.on('SIGINT', () => { ops.flush(); process.exit(0); }); process.on('SIGTERM', () => { ops.flush(); process.exit(0); });
server.listen(PORT, () => console.log(`🪩 추억의 나이트 서버: http://localhost:${PORT}  (최대 ${MAX_PLAYERS}명, IP당 ${MAX_PER_IP}명, 인증모드=${process.env.VERIFY_MODE || 'mock'})`));
module.exports = { server, wss };
