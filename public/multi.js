/* multi.js — 멀티플레이(클라이언트) v2: WebSocket · 아바타/외형 동기화 · 이모트 · 테이블 초대
 *            · 채팅 범위(근처/전체/테이블/룸) · VIP 룸 잠금(roomClaim) · WebRTC 시그널링 연결
 * 서버가 감지되면 ops.js · js/voice.js 다음에 로드됩니다. 시작 화면에서 '솔로'를 고르면 접속하지 않습니다.
 */
(() => {
  const NC = window.NC, $ = s => document.querySelector(s), U = NC.util, Mo = NC.Motion, W = NC.world;
  let ws = null, myId = null, scope = 'near', lastSent = 0, lastPos = { x: 1e9, z: 1e9, r: 0 };
  const remotes = NC.remotes;
  const net = NC.net = { send: o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } };
  let welcomeResolve, welcomeReject, claimWait = null;
  NC.roomOwners = [null, null, null];
  NC.roomLockedForMe = i => !!(NC.mode === 'online' && NC.roomOwners[i] && NC.roomOwners[i] !== myId);
  NC.claimRoom = i => NC.mode !== 'online' ? Promise.resolve(true) : new Promise(res => { claimWait = { i, res }; net.send({ type: 'roomClaim', room: i }); setTimeout(() => { if (claimWait && claimWait.i === i) { claimWait = null; res(false); } }, 3000); });
  NC.releaseRoom = () => { if (NC.mode === 'online') net.send({ type: 'roomRelease' }); };

  /* 입장 전: 온라인 모드면 서버 접속 + 심사 */
  NC.hooks.beforeStart.push(() => new Promise((resolve, reject) => {
    if (NC.settings.playMode !== 'online') return resolve();               // 솔로 모드
    if (!NC.session) return reject(new Error('성인 인증이 필요합니다.'));
    welcomeResolve = resolve; welcomeReject = reject;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.onopen = () => net.send({ type: 'hello', token: NC.session.token, name: NC.settings.name, color: NC.settings.color, look: NC.settings.look });
    ws.onmessage = e => handle(JSON.parse(e.data));
    ws.onerror = () => welcomeReject && welcomeReject(new Error('서버에 연결할 수 없습니다.'));
    ws.onclose = () => { if (welcomeReject) { welcomeReject(new Error('서버와의 연결이 종료되었습니다.')); welcomeReject = null; return; } if (myId) { NC.ui.toast('서버와 연결이 끊어졌어요. 새로고침해 주세요.'); myId = null; } };
  }));

  function enterOnline() {
    NC.mode = 'online'; NC.chatEnabled = true; NC.setNpcsEnabled(false);
    $('#chat').style.display = 'block';
    $('#help').innerHTML = '이동 <b>WASD</b> · 사람 근처 <b>E</b>: 부킹 초대 · 🤵 웨이터: AI 부킹 · 👥 신고/차단 · <b>Enter</b> 채팅 · 🎙 근거리 음성';
  }

  function addRemote(p) {
    if (remotes.has(p.id) || p.id === myId) return;
    const g = NC.Avatar.create({ name: p.name, look: p.look, seed: U.hash(p.id + p.name) }); g.position.set(p.x, NC.groundY(p.x, p.z), p.z); g.rotation.y = p.r; NC.scene.add(g);
    remotes.set(p.id, { id: p.id, name: p.name, g, tx: p.x, tz: p.z, tr: p.r, danceUntil: 0 }); NC.ui.refreshPeople && NC.ui.refreshPeople();
  }
  function removeRemote(id) { const r = remotes.get(id); if (!r) return; NC.scene.remove(r.g); remotes.delete(id); NC.Voice && NC.Voice.peers.has(id) && NC.Voice.onSignal(id, { bye: 1 }); NC.ui.refreshPeople && NC.ui.refreshPeople(); }

  function applyTables(t) {
    const seatOf = {}; t.forEach((row, ti) => row.forEach((id, si) => { NC.tableOcc[ti][si] = id; if (id) seatOf[id] = { t: ti, s: si }; }));
    const P = NC.player, me = seatOf[myId];
    if (me) { if (!P.seat || P.seat.kind !== 'table' || P.seat.t !== me.t || P.seat.s !== me.s) NC.ui.fade(() => NC.sitPlayer({ kind: 'table', t: me.t, s: me.s }, NC.seatPos(me.t, me.s))); }
    else if (P.seat && P.seat.kind === 'table') NC.standLocal();
    remotes.forEach((r, id) => { const s = seatOf[id]; if (s) { const p = NC.seatPos(s.t, s.s); NC.seatAvatar(r.g, p.x, p.z, p.ry, .5); r.seated = true; } else if (r.seated) { NC.unseatAvatar(r.g); r.tx = r.g.position.x; r.tz = r.g.position.z; r.seated = false; } });
  }

  function handle(m) {
    switch (m.type) {
      case 'denied': { const f = welcomeReject; welcomeReject = welcomeResolve = null; if (m.code === 'auth') { try { sessionStorage.removeItem('nc_session'); } catch (e) { } } f && f(new Error(m.msg)); break; }
      case 'welcome': {
        myId = m.id; NC.myId = myId; NC.reasons = m.reasons; NC.blocks = m.blocks || []; NC.roomOwners = m.rooms || NC.roomOwners;
        if (m.nearRadius) NC.config.nearRadius = m.nearRadius;
        const r = welcomeResolve; welcomeResolve = welcomeReject = null;
        enterOnline(); NC.tickers.push(tick);
        NC.on('start', () => { m.players.forEach(addRemote); applyTables(m.tables); NC.ui.chatAdd('', `입장했어요. 현재 ${m.players.length + 1}/${m.max}명 · 채팅 기본 범위: 근처 ${NC.config.nearRadius || 8}m`, 'sys'); });
        r && r(); break;
      }
      case 'join': addRemote(m.p); break;
      case 'leave': case 'hide': removeRemote(m.id); break;
      case 'state': m.s.forEach(([id, x, z, r]) => { const o = remotes.get(id); if (o) { o.tx = x; o.tz = z; o.tr = r; } }); break;
      case 'tables': applyTables(m.t); break;
      case 'rooms': NC.roomOwners = m.owners; break;
      case 'roomClaim': if (claimWait && claimWait.i === m.room) { const w = claimWait; claimWait = null; w.res(!!m.ok); } break;
      case 'emote': { const r = remotes.get(m.id); if (!r) break; if (m.name === 'stageDance' || m.name === 'groove') { r.g.userData.dance = m.name; r.danceUntil = performance.now() + 8000; } else Mo.play(r.g, m.name); break; }
      case 'rtc': NC.Voice && NC.Voice.onSignal(m.from, m.data); break;
      case 'chat': { const cls = { table: 'tbl', room: 'room', near: 'near' }[m.scope] || ''; const tag = { table: ' (테이블)', room: ' (룸)', near: '', all: ' (전체)' }[m.scope] ?? ''; NC.ui.chatAdd(m.name + tag, m.text, cls); const r = remotes.get(m.id); if (r) r.g.userData.say(Math.min(3, m.text.length * .08)); break; }
      case 'notice': NC.ui.toast(m.msg); NC.ui.chatAdd('', m.msg, 'sys'); break;
      case 'blocks': NC.blocks = m.list; NC.ui.refreshPeople && NC.ui.refreshPeople(); break;
      case 'invite': NC.ui.modal(`<h3>💌 부킹 초대</h3><p><b>${U.esc(m.name)}</b>님이 T${m.table + 1} 테이블로 초대했어요.<br>합석하시겠어요?</p>
          <p style="font-size:12px;color:#d6c6ff;margin:6px 0 0">불쾌한 초대는 👥 에서 신고·차단할 수 있어요.</p>`, [['거절', 0], ['합석하기 🥂', 1, true]]).then(a => net.send({ type: 'inviteReply', from: m.from, accept: !!a.val })); break;
      case 'kicked': NC.ui.toast(m.msg); NC.ui.chatAdd('', m.msg, 'sys'); myId = null; NC.myId = null; break;
    }
  }

  /* 로컬 → 서버 */
  NC.on('room', room => net.send({ type: 'zone', room }));
  NC.interactProviders.push(() => {
    const P = NC.player, out = []; if (P.seat || NC.mode !== 'online') return out;
    remotes.forEach(r => { const d = Math.hypot(r.g.position.x - P.x, r.g.position.z - P.z); if (d < 3.2 && !r.seated) out.push({ label: `💌 ${r.name}님에게 부킹 초대 (E)`, dist: d, run: () => net.send({ type: 'invite', to: r.id }) }); });
    return out;
  });

  function tick(dt) {
    const P = NC.player; if (!P.group || !myId) return;
    const now = performance.now();
    if (now - lastSent > 100 && !P.seat) { const x = +P.x.toFixed(2), z = +P.z.toFixed(2), r = +P.ry.toFixed(2); if (Math.abs(x - lastPos.x) + Math.abs(z - lastPos.z) > .03 || Math.abs(r - lastPos.r) > .05) { net.send({ type: 'move', x, z, r }); lastPos = { x, z, r }; } lastSent = now; }
    remotes.forEach(r => {
      const u = r.g.userData;
      if (!r.seated) {
        const dx = r.tx - r.g.position.x, dz = r.tz - r.g.position.z, d = Math.hypot(dx, dz);
        u.moving = d > .08; if (d > 6) r.g.position.set(r.tx, 0, r.tz); else { const k = Math.min(1, dt * 10); r.g.position.x += dx * k; r.g.position.z += dz * k; }
        r.g.position.y = NC.groundY(r.g.position.x, r.g.position.z);
        r.g.rotation.y = U.lerpAngle(r.g.rotation.y, r.tr, Math.min(1, dt * 10));
        if (!u.moving && now > r.danceUntil) { const z = W.zoneAt(r.g.position.x, r.g.position.z).name; u.dance = z === 'stage' ? 'stageDance' : z === 'dance' ? 'groove' : null; }
      }
      Mo.update(r.g, dt, { near: NC.camera.position.distanceTo(r.g.position) < 16 }); NC.Avatar.fitLabel(r.g, NC.camera);
    });
  }

  /* 채팅 UI */
  const inp = $('#chatin'), scopeBtn = $('#chatscope'), SCOPES = ['near', 'all', 'table', 'room'], LABEL = { near: '근처', all: '전체', table: '테이블', room: '룸' };
  scopeBtn.onclick = () => { scope = SCOPES[(SCOPES.indexOf(scope) + 1) % SCOPES.length]; scopeBtn.textContent = LABEL[scope]; };
  NC.on('room', room => { if (room >= 0) { scope = 'room'; scopeBtn.textContent = LABEL.room; NC.ui.chatAdd('', `🔒 VIP ${room + 1} 비밀 대화방: 룸 안 사람에게만 채팅·음성이 전달돼요`, 'sys'); } else if (scope === 'room') { scope = 'near'; scopeBtn.textContent = LABEL.near; } });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { const t = inp.value.trim(); if (t) net.send({ type: 'chat', text: t, scope }); inp.value = ''; inp.blur(); } else if (e.key === 'Escape') inp.blur(); e.stopPropagation(); });
  const vb = $('#btnVoice'); vb.onclick = () => NC.Voice && NC.Voice.toggle(); NC.on('voice', on => vb.classList.toggle('on', on));
})();
