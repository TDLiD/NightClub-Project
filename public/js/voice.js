/* voice.js — WebRTC 근거리 음성 (온라인 모드)
 *  · 🎙 버튼으로 마이크 켜기(동의 필수). 둘 다 켠 상태 + 거리 NEAR_RADIUS 이내(또는 같은 VIP 룸)일 때만 P2P 연결
 *  · Perfect Negotiation 패턴(polite = id가 큰 쪽)으로 동시 offer 충돌 처리, 시그널링은 서버 WS 'rtc' 릴레이
 *  · 수신 음성은 WebAudio PannerNode(HRTF)로 상대 아바타 위치에 배치 → 가까울수록 크게/방향감
 *  · VIP 룸 안: 룸 멤버끼리만 연결(밖과 차단), 음악은 audio.js 가 댐핑
 *  · 말소리 감지(Analyser RMS) 시 음악 덕킹
 *  · 운영: 대칭 NAT 환경은 TURN 서버 필요 → 서버 환경변수 ICE_SERVERS 로 주입 (docs/10 참고)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const W = NC.world;
const V = NC.Voice = { on: false, stream: null, peers: new Map(), speakingAny: false };
const radius = () => (NC.config && NC.config.nearRadius) || 8;
const ice = () => (NC.config && NC.config.iceServers) || [{ urls: 'stun:stun.l.google.com:19302' }];
const send = (to, data) => NC.net && NC.net.send({ type: 'rtc', to, data });

V.enable = async function () {
  if (V.on) return;
  if (!navigator.mediaDevices || !window.RTCPeerConnection) return NC.ui.toast('이 브라우저는 음성 채팅을 지원하지 않아요');
  try { V.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { return NC.ui.toast('마이크 권한이 필요해요 (HTTPS 또는 localhost 에서만 동작)'); }
  NC.Audio.init(); V.on = true; NC.ui.toast(`🎙 근거리 음성 ON — 반경 ${radius()}m 안의 음성 사용자와 연결돼요`); NC.emit('voice', true);
};
V.disable = function () { V.on = false; V.peers.forEach((_, id) => close(id, true)); if (V.stream) V.stream.getTracks().forEach(t => t.stop()); V.stream = null; NC.emit('voice', false); };
V.toggle = () => (V.on ? V.disable() : V.enable());

function peer(id) {
  if (V.peers.has(id)) return V.peers.get(id);
  const pc = new RTCPeerConnection({ iceServers: ice() });
  const p = { id, pc, polite: String(NC.myId) > String(id), makingOffer: false, ignoreOffer: false, audio: null, panner: null, an: null, buf: null };
  V.peers.set(id, p);
  if (V.stream) V.stream.getTracks().forEach(t => pc.addTrack(t, V.stream));
  pc.onnegotiationneeded = async () => { try { p.makingOffer = true; await pc.setLocalDescription(); send(id, { sdp: pc.localDescription }); } catch (e) { console.warn('[voice] offer', e); } finally { p.makingOffer = false; } };
  pc.onicecandidate = e => { if (e.candidate) send(id, { ice: e.candidate }); };
  pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) close(id, false); };
  pc.ontrack = e => {
    const st = e.streams[0]; if (!st || p.audio) return; const C = NC.Audio.ctx;
    p.audio = new Audio(); p.audio.srcObject = st; p.audio.muted = true; p.audio.play().catch(() => { });      // Chrome: 원격 스트림은 미디어 요소에 붙어 있어야 WebAudio로 흐름
    const src = C.createMediaStreamSource(st); p.panner = C.createPanner(); Object.assign(p.panner, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1.5, rolloffFactor: 1.3, maxDistance: 30 });
    p.an = C.createAnalyser(); p.an.fftSize = 512; p.buf = new Uint8Array(p.an.fftSize);
    src.connect(p.an); src.connect(p.panner); p.panner.connect(NC.Audio.voiceBus);
    const r = NC.remotes.get(id); NC.ui.chatAdd('', `🎙 ${r ? r.name : '상대'}님과 음성 연결`, 'sys');
  };
  return p;
}
function close(id, notify) { const p = V.peers.get(id); if (!p) return; V.peers.delete(id); try { p.pc.close(); } catch (e) { } if (p.audio) { p.audio.srcObject = null; } if (p.panner) p.panner.disconnect(); if (notify) send(id, { bye: 1 }); }

V.onSignal = async function (from, data) {
  if (data.bye) return close(from, false);
  if (!V.on) return;                                   // 내가 음성을 켜지 않았으면 응답하지 않음(동의 기반)
  const p = peer(from), pc = p.pc;
  try {
    if (data.sdp) {
      const collision = data.sdp.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
      p.ignoreOffer = !p.polite && collision; if (p.ignoreOffer) return;
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === 'offer') { await pc.setLocalDescription(); send(from, { sdp: pc.localDescription }); }
    } else if (data.ice) { try { await pc.addIceCandidate(data.ice); } catch (e) { if (!p.ignoreOffer) throw e; } }
  } catch (e) { console.warn('[voice] signal', e); }
};

/* 근접 판정 + 위치 갱신 */
let acc = 0;
NC.tickers.push(dt => {
  if (NC.mode !== 'online') return; const P = NC.player; if (!P.group) return;
  const roomOf = (x, z) => W.vipAt(x, z);
  acc += dt; const check = acc > .5; if (check) acc = 0;
  let speaking = false;
  NC.remotes.forEach((r, id) => {
    const x = r.g.position.x, z = r.g.position.z, d = Math.hypot(x - P.x, z - P.z), rr = roomOf(x, z);
    const same = P.room >= 0 || rr >= 0 ? P.room === rr : true;
    if (check && V.on) { if (same && d <= radius() && !V.peers.has(id)) peer(id); else if (V.peers.has(id) && (!same || d > radius() + 3)) close(id, true); }
    const p = V.peers.get(id);
    if (p && p.panner) { NC.Audio.setPos(p.panner, x, 1.6, z); if (p.an) { p.an.getByteTimeDomainData(p.buf); let s = 0; for (let i = 0; i < p.buf.length; i += 4) { const v = (p.buf[i] - 128) / 128; s += v * v; } if (Math.sqrt(s / (p.buf.length / 4)) > .04) speaking = true; } }
  });
  V.speakingAny = speaking; NC.Audio.voiceDuck = speaking;
});
NC.on('room', () => { if (V.on) V.peers.forEach((_, id) => { const r = NC.remotes.get(id); if (!r || W.vipAt(r.g.position.x, r.g.position.z) !== NC.player.room) close(id, true); }); });
})();
