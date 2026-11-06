/* multi.js — 멀티플레이(클라이언트): WebSocket 접속 · 아바타 동기화 · 테이블 초대 · 채팅
 * index.html 이 /api/health 로 서버를 감지하면 ops.js 다음에 로드됩니다.
 */
(() => {
  const NC = window.NC, T = NC.THREE, $ = s => document.querySelector(s);
  NC.mode = 'online'; NC.chatEnabled = true; NC.blocks = [];
  NC.setNpcsEnabled(false);                       // 온라인에서는 NPC 대신 실제 접속자와 부킹
  $('#chat').style.display = 'block'; $('#help').innerHTML = '이동 <b>WASD</b> · 사람 가까이 가서 <b>E</b>: 부킹 초대 · 👥: 접속자/신고/차단 · <b>Enter</b>: 채팅';

  let ws = null, myId = null, scope = 'all', lastSent = 0, lastPos = { x: 1e9, z: 1e9, r: 0 };
  const remotes = NC.remotes;                      // id → { name, g, tx, tz, tr }
  const net = NC.net = { send: o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } };
  let welcomeResolve, welcomeReject;

  /* 입장 전 단계: 서버 접속 + 심사(성인 토큰·입장 제한). 실패하면 시작 화면에 사유 표시 */
  NC.hooks.beforeStart.push(() => new Promise((resolve, reject) => {
    if (!NC.session) return reject(new Error('성인 인증이 필요합니다.'));
    welcomeResolve = resolve; welcomeReject = reject;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.onopen = () => net.send({ type: 'hello', token: NC.session.token, name: NC.settings.name, color: NC.settings.color });
    ws.onmessage = e => handle(JSON.parse(e.data));
    ws.onerror = () => welcomeReject && welcomeReject(new Error('서버에 연결할 수 없습니다.'));
    ws.onclose = ev => { if (welcomeReject) { welcomeReject(new Error('서버와의 연결이 종료되었습니다.')); welcomeReject = null; return; } if (myId) { NC.ui.toast('서버와 연결이 끊어졌어요. 새로고침해 주세요.'); } };
  }));

  function addRemote(p) {
    if (remotes.has(p.id) || p.id === myId) return;
    const g = NC.makeAvatar(p.color, p.name); g.position.set(p.x, 0, p.z); g.rotation.y = p.r; NC.scene.add(g);
    remotes.set(p.id, { id: p.id, name: p.name, g, tx: p.x, tz: p.z, tr: p.r }); NC.ui.refreshPeople && NC.ui.refreshPeople();
  }
  function removeRemote(id) { const r = remotes.get(id); if (!r) return; NC.scene.remove(r.g); remotes.delete(id); NC.ui.refreshPeople && NC.ui.refreshPeople(); }

  function applyTables(t) {
    // 점유 상태 반영 + 아바타 착석/기립
    const seatOf = {}; t.forEach((row, ti) => row.forEach((id, si) => { NC.tableOcc[ti][si] = id; if (id) seatOf[id] = { t: ti, s: si }; }));
    const P = NC.player;
    const me = seatOf[myId];
    if (me) { if (!P.seat || P.seat.t !== me.t || P.seat.s !== me.s) { NC.ui.fade(() => { P.seat = me; NC.seatAvatar(P.group, me.t, me.s); P.x = P.group.position.x; P.z = P.group.position.z; P.target = null; }); } }
    else if (P.seat) { NC.unseatAvatar(P.group); P.x = P.group.position.x; P.z = P.group.position.z; P.seat = null; }
    remotes.forEach((r, id) => { const s = seatOf[id]; if (s) { NC.seatAvatar(r.g, s.t, s.s); r.seated = true; } else if (r.seated) { NC.unseatAvatar(r.g); r.tx = r.g.position.x; r.tz = r.g.position.z; r.seated = false; } });
    if (NC.ui.updateSeatInfo) NC.ui.updateSeatInfo();
  }

  function handle(m) {
    switch (m.type) {
      case 'denied': { const f = welcomeReject; welcomeReject = welcomeResolve = null; if (m.code === 'auth') { try { sessionStorage.removeItem('nc_session'); } catch (e) { } } f && f(new Error(m.msg)); break; }
      case 'welcome': {
        myId = m.id; NC.reasons = m.reasons; NC.blocks = m.blocks || []; NC.myId = myId; const r = welcomeResolve; welcomeResolve = welcomeReject = null;
        NC.tickers.push(tick);
        NC.once_started = () => { m.players.forEach(addRemote); applyTables(m.tables); NC.ui.chatAdd('', `입장했어요. 현재 ${m.players.length + 1}/${m.max}명`, 'sys'); };
        NC.on('start', NC.once_started); r && r(); break;
      }
      case 'join': addRemote(m.p); break;
      case 'leave': case 'hide': removeRemote(m.id); break;
      case 'state': m.s.forEach(([id, x, z, r]) => { const o = remotes.get(id); if (o) { o.tx = x; o.tz = z; o.tr = r; } }); break;
      case 'tables': applyTables(m.t); break;
      case 'chat': NC.ui.chatAdd(m.name + (m.scope === 'table' ? ' (테이블)' : ''), m.text, m.scope === 'table' ? 'tbl' : ''); break;
      case 'notice': NC.ui.toast(m.msg); NC.ui.chatAdd('', m.msg, 'sys'); break;
      case 'blocks': NC.blocks = m.list; NC.ui.refreshPeople && NC.ui.refreshPeople(); break;
      case 'invite': NC.ui.modal(`<h3>💌 부킹 초대</h3><p><b>${m.name.replace(/[<>&]/g, '')}</b>님이 T${m.table + 1} 테이블로 초대했어요.<br>합석하시겠어요?</p>
          <p style="font-size:12px;color:#cdb7ff;margin:6px 0 0">불쾌한 초대는 👥 에서 신고·차단할 수 있어요.</p>`, [['거절', 0], ['합석하기 🥂', 1, true]]).then(a => net.send({ type: 'inviteReply', from: m.from, accept: !!a.val })); break;
      case 'kicked': NC.ui.toast(m.msg); NC.ui.chatAdd('', m.msg, 'sys'); myId = null; NC.myId = null; break;
    }
  }

  /* 로컬 → 서버 */
  NC.requestSit = t => { if (!NC.player.busy) net.send({ type: 'sit', table: t }); };
  NC.requestStand = () => net.send({ type: 'stand' });
  NC.interactProviders.push(() => {
    const P = NC.player, out = []; if (P.seat) return out;
    remotes.forEach(r => { const d = Math.hypot(r.g.position.x - P.x, r.g.position.z - P.z); if (d < 3.2 && !r.seated) out.push({ label: `💌 ${r.name}님에게 부킹 초대 (E)`, dist: d, run: () => { net.send({ type: 'invite', to: r.id }); } }); });
    return out;
  });

  function tick(dt) {
    const P = NC.player; if (!P.group || !myId) return;
    const now = performance.now();
    if (now - lastSent > 100 && !P.seat) { const x = +P.x.toFixed(2), z = +P.z.toFixed(2), r = +P.ry.toFixed(2); if (Math.abs(x - lastPos.x) + Math.abs(z - lastPos.z) > .03 || Math.abs(r - lastPos.r) > .05) { net.send({ type: 'move', x, z, r }); lastPos = { x, z, r }; } lastSent = now; }
    remotes.forEach(r => {
      const u = r.g.userData; if (!r.seated) {
        const dx = r.tx - r.g.position.x, dz = r.tz - r.g.position.z, d = Math.hypot(dx, dz);
        u.moving = d > .08; if (d > 6) { r.g.position.set(r.tx, 0, r.tz); } else { const k = Math.min(1, dt * 10); r.g.position.x += dx * k; r.g.position.z += dz * k; }
        let da = ((r.tr - r.g.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; r.g.rotation.y += da * Math.min(1, dt * 10);
      } else u.moving = false;
      animRemote(r.g, dt);
    });
  }
  // index.html 의 animAvatar 는 내부 함수라 간단한 동일 로직을 사용
  function animRemote(a, dt) {
    const u = a.userData, I = u.inner;
    if (u.seated) { u.legL.rotation.x = u.legR.rotation.x = -Math.PI / 2; I.position.y = -.3; u.armL.rotation.set(-.9, 0, -.1); u.armR.rotation.set(-.9, 0, .1); return; }
    I.position.y = 0;
    if (u.moving) { u.phase += dt * 9; const s = Math.sin(u.phase); u.legL.rotation.x = s * .7; u.legR.rotation.x = -s * .7; u.armL.rotation.set(-s * .6, 0, 0); u.armR.rotation.set(s * .6, 0, 0); }
    else { u.legL.rotation.x = u.legR.rotation.x = 0; u.armL.rotation.set(0, 0, 0); u.armR.rotation.set(0, 0, 0); }
  }

  /* 채팅 UI */
  const inp = $('#chatin'), scopeBtn = $('#chatscope');
  scopeBtn.onclick = () => { scope = scope === 'all' ? 'table' : 'all'; scopeBtn.textContent = scope === 'all' ? '전체' : '테이블'; };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const t = inp.value.trim(); if (t) net.send({ type: 'chat', text: t, scope }); inp.value = ''; inp.blur(); } else if (e.key === 'Escape') inp.blur(); e.stopPropagation(); });
})();
