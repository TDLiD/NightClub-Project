/* audio.js — v21 배경 음악 = public/music/1.mp3 ~ 7.mp3 만 재생
 *
 *  · 신스 음악(유로댄스·디스코·하우스 등 7종), 효과음(건배·코인·문·박수 등), NPC TTS 음성, 노래방/밴드/블루스 반주는 모두 삭제.
 *  · 소리가 나는 것은 MP3 배경 음악과 (켰을 때만) 근거리 음성 채팅뿐.
 *
 *  신호 흐름
 *    [MP3] → mp3Gain → musicBus ─┬→ panner(스테이지 스피커 위치) → bassShelf ─┐
 *                                └→ bleedLP → bleedGain ─────────────────────┴→ zoneLP → zoneGain → musicVol → duck → master → comp → out
 *    [음성 채팅] → voiceBus → master
 *
 *  · VIP 룸·화장실·노래방 안에서는 벽 너머처럼 먹먹하게(구역별 로우패스) — 기존 공간감 유지
 *  · 파일 위치는 자동으로 찾음: public/music/N.mp3 → 없으면 public/music/music/N.mp3
 *  · 박자 시계(beat)는 128BPM 으로 계속 돌아 조명·LED·NPC 춤은 그대로 박자를 탐
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const ZONE_FX = {      // lp(Hz) · gain · wet(리버브) · bass(dB) · bleed
  stage: { lp: 20000, gain: 1.0, wet: .16, bass: 7, bleed: .25 },
  dance: { lp: 18000, gain: .95, wet: .15, bass: 4, bleed: .3 },
  hall: { lp: 12000, gain: .85, wet: .14, bass: 2, bleed: .32 },
  tables: { lp: 9000, gain: .78, wet: .12, bass: 1, bleed: .35 },
  bar: { lp: 7000, gain: .72, wet: .1, bass: 0, bleed: .35 },
  corridor: { lp: 4200, gain: .62, wet: .1, bass: 0, bleed: .4 },
  vip: { lp: 520, gain: .3, wet: .04, bass: -2, bleed: .55 },
  vipOpen: { lp: 1800, gain: .5, wet: .06, bass: 0, bleed: .5 },
  karaoke: { lp: 260, gain: .1, wet: .02, bass: -6, bleed: .6 },
  restroom: { lp: 320, gain: .14, wet: .25, bass: -4, bleed: .5 },
  smoke: { lp: 480, gain: .2, wet: .05, bass: -2, bleed: .5 },
};
const STAGE_SPK = { x: 0, y: 2.6, z: -17.6 };
const VOL = .5;          // 배경 음악 기본 볼륨

const A = NC.Audio = {
  ctx: null, on: true, bpm: 128, step: 0, next: 0, t0: 0, zone: 'tables', ducking: 0, ZONE_FX,
  init() {
    if (this.ctx) { this.wake(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const C = this.ctx = new AC();
    const g = v => { const n = C.createGain(); n.gain.value = v; return n; }, f = (type, fr) => { const n = C.createBiquadFilter(); n.type = type; n.frequency.value = fr; return n; };
    this.master = g(.9); const comp = C.createDynamicsCompressor(); this.master.connect(comp); comp.connect(C.destination);
    this.musicVol = g(this.on ? VOL : 0); this.duck = g(1); this.musicVol.connect(this.duck); this.duck.connect(this.master);
    this.musicBus = g(1);
    this.panner = C.createPanner(); Object.assign(this.panner, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 7, rolloffFactor: 1.1, maxDistance: 60 });
    this.setPos(this.panner, STAGE_SPK.x, STAGE_SPK.y, STAGE_SPK.z);
    this.bassShelf = f('lowshelf', 120); this.bleedLP = f('lowpass', 350); this.bleedGain = g(.35);
    this.zoneLP = f('lowpass', 9000); this.zoneLP.Q.value = .5; this.zoneGain = g(.8);
    this.musicBus.connect(this.panner); this.panner.connect(this.bassShelf); this.bassShelf.connect(this.zoneLP);
    this.musicBus.connect(this.bleedLP); this.bleedLP.connect(this.bleedGain); this.bleedGain.connect(this.zoneLP);
    this.zoneLP.connect(this.zoneGain); this.zoneGain.connect(this.musicVol);
    this.reverb = C.createConvolver(); this.reverb.buffer = this.impulse(2.2); this.wet = g(.12); this.zoneLP.connect(this.reverb); this.reverb.connect(this.wet); this.wet.connect(this.musicVol);
    this.voiceBus = g(1); this.voiceBus.connect(this.master);          // 근거리 음성 채팅(사용자가 켰을 때만)
    this.sfxBus = g(0);                                                // 효과음 삭제: 어디에도 연결되지 않은 무음 노드(옛 코드 호환용)
    this.silent = this.sfxBus;
    const n = C.sampleRate * .5, buf = C.createBuffer(1, n, C.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    this.next = this.t0 = C.currentTime + .1; this.timer = setInterval(() => this.sched(), 50);
    C.addEventListener && C.addEventListener('statechange', () => NC.emit('music:state'));
    this.mp3Start();
  },
  wake() { if (!this.ctx) return this.init(); if (this.ctx.state !== 'running') { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); } },
  impulse(sec) { const C = this.ctx, n = C.sampleRate * sec, b = C.createBuffer(2, n, C.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); } return b; },
  setPos(node, x, y, z) { if (node.positionX) { node.positionX.value = x; node.positionY.value = y; node.positionZ.value = z; } else node.setPosition(x, y, z); },
  /* 매 프레임: 청취자 위치·방향과 현재 구역으로 공간음/댐핑 갱신 */
  update(pos, yaw, zoneName, doorOpen) {
    const C = this.ctx; if (!C) return; const L = C.listener, fx = -Math.sin(yaw), fz = -Math.cos(yaw), now = C.currentTime;
    if (L.positionX) { L.positionX.value = pos.x; L.positionY.value = 1.6; L.positionZ.value = pos.z; L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(pos.x, 1.6, pos.z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
    const key = zoneName === 'vip' && doorOpen > .5 ? 'vipOpen' : zoneName; this.zone = zoneName;
    const z = ZONE_FX[key] || ZONE_FX.tables, near = Math.max(0, 1 - Math.hypot(pos.x - STAGE_SPK.x, pos.z - STAGE_SPK.z) / 22), tc = .25;
    this.zoneLP.frequency.setTargetAtTime(this.djLP ? Math.min(z.lp, this.djLP) : z.lp, now, this.djLP ? .05 : tc);   // DJ 테이크오버 필터
    this.zoneGain.gain.setTargetAtTime(z.gain, now, tc);
    this.wet.gain.setTargetAtTime(z.wet, now, tc); this.bleedGain.gain.setTargetAtTime(z.bleed, now, tc);
    this.bassShelf.gain.setTargetAtTime(z.bass + near * 5 + (this.djBass || 0), now, tc);
    this.duck.gain.setTargetAtTime(this.ducking > 0 || this.voiceDuck ? .55 : 1, now, .12);   // 음성 채팅으로 누가 말하면 음악을 살짝 줄임
  },
  speaking(on) { this.ducking = Math.max(0, this.ducking + (on ? 1 : -1)); },
  /* 박자 시계 (조명·LED·NPC 춤·리듬 게임용) — 소리는 내지 않음 */
  beat() { if (!this.ctx) { const b = performance.now() / 1000 * this.bpm / 60; return { phase: b % 1, n: Math.floor(b), bpm: this.bpm, time: performance.now() / 1000 }; } const b = Math.max(0, this.ctx.currentTime - this.t0) * this.bpm / 60; return { phase: b % 1, n: Math.floor(b), bpm: this.bpm, time: this.ctx.currentTime }; },
  beatTime(n) { return this.t0 + n * 60 / this.bpm; },
  sched() { const C = this.ctx; while (this.next < C.currentTime + .15) { if (this.step % 64 === 0) { const d = (this.next - C.currentTime) * 1000; setTimeout(() => NC.emit('music:drop'), Math.max(0, d)); } this.next += 60 / this.bpm / 4; this.step = (this.step + 1) % 64; } },

  /* ── 배경 음악: 1~7.mp3 ── */
  style: 'mp3',
  STYLES: { mp3: { name: '🎲 랜덤 연속 재생 (1~7)', bpm: 128, mp3: true } },
  setStyle() { this.userMusic(); this.mp3Mode = 'random'; this.mp3Start(); NC.emit('music:style', 'mp3'); },   // 옛 코드 호환: 어떤 스타일을 요청해도 MP3 랜덤 재생
  paused: false, mp3Mode: 'random', mp3Idx: -1,
  MP3_COUNT: 7, MP3_DIRS: ['music/', 'music/music/'],
  mp3List() { if (NC.config && NC.config.mp3List) return NC.config.mp3List; const d = this.mp3Dir || this.MP3_DIRS[0]; return Array.from({ length: this.MP3_COUNT }, (_, i) => `${d}${i + 1}.mp3`); },
  mp3Probe() {
    if (this._probe) return this._probe; if (NC.config && NC.config.mp3List) return (this._probe = Promise.resolve());
    const tryDir = k => k >= this.MP3_DIRS.length ? Promise.resolve(null) : fetch(this.MP3_DIRS[k] + '1.mp3', { method: 'HEAD', cache: 'no-store' }).then(r => r.ok && !/text\/html/i.test(r.headers.get('content-type') || '') ? this.MP3_DIRS[k] : tryDir(k + 1)).catch(() => tryDir(k + 1));
    return (this._probe = tryDir(0).then(d => { this.mp3Dir = d || this.MP3_DIRS[0]; if (d) console.info('[audio] MP3 폴더:', d); else console.warn('[audio] MP3 를 찾지 못함 — public/music/1.mp3 ~ 7.mp3'); }));
  },
  mp3Ensure() {
    if (this.mp3El) return this.mp3El; const C = this.ctx, el = this.mp3El = new Audio(); el.preload = 'auto';
    try { this.mp3Src = C.createMediaElementSource(el); this.mp3Gain = C.createGain(); this.mp3Gain.gain.value = 1; this.mp3Src.connect(this.mp3Gain); this.mp3Gain.connect(this.musicBus); } catch (e) { console.warn('[audio] MP3 연결 실패', e); }
    el.addEventListener('ended', () => { if (this.mp3Mode === 'random') this.mp3Play(-1); });   // 개별 곡은 loop=true
    el.addEventListener('playing', () => { this.next = this.t0 = C.currentTime + .05; this.step = 0; this.mp3Err = 0; NC.emit('music:state'); });
    el.addEventListener('pause', () => NC.emit('music:state'));
    el.addEventListener('error', () => {
      if (!el.getAttribute('src')) return; const L = this.mp3List();
      if (this.mp3Mode === 'single') { NC.ui && NC.ui.toast(`🎵 ${this.mp3Idx + 1}.mp3 를 찾지 못했어요 — 랜덤 재생으로 바꿔요`); this.mp3Mode = 'random'; el.loop = false; }
      this.mp3Err = (this.mp3Err || 0) + 1;
      if (this.mp3Err >= L.length) { this.mp3Err = 0; this.paused = true; NC.emit('music:state'); NC.ui && NC.ui.toast('🎵 MP3 파일을 찾지 못했어요 — public/music 폴더에 1.mp3 ~ 7.mp3 를 넣어 주세요'); }
      else this.mp3Play(-1); });
    return el;
  },
  mp3Start() { if (!this.ctx) return; this.paused = false; this.mp3Ensure(); this.mp3Probe().then(() => { if (!this.paused) this.mp3Play(this.mp3Mode === 'single' ? this.mp3Idx : -1); }); },
  mp3Next() { this.mp3Play(-1); },
  /* idx: 0부터(-1 이면 랜덤 — 직전 곡과 겹치지 않게) */
  mp3Play(idx) {
    const el = this.mp3El; if (!el) return; const L = this.mp3List(); let i = idx;
    if (i < 0 || i >= L.length) { do { i = Math.floor(Math.random() * L.length); } while (L.length > 1 && i === this.mp3Idx); }
    this.mp3Idx = i; el.loop = this.mp3Mode === 'single'; el.src = L[i]; this.wake();
    const p = el.play(); if (p && p.catch) p.catch(e => { if (e && e.name === 'NotAllowedError') NC.ui && NC.ui.toast('🔇 브라우저가 소리를 막았어요 — 화면을 한 번 클릭한 뒤 ▶ 재생을 눌러 주세요'); });
    NC.ui && NC.ui.toast(this.mp3Mode === 'single' ? `🎵 ${i + 1}번 곡 재생 (반복)` : `🎲 랜덤 재생 — ${i + 1}번 곡`); NC.emit('music:track', i + 1); NC.emit('music:state');
  },
  /* 사용자가 음악 버튼을 누르면 정상 볼륨으로 되돌림 */
  userMusic() { this.wake(); NC.emit('music:user'); if (this.musicVol && this.ctx) { this.musicVol.gain.cancelScheduledValues(this.ctx.currentTime); this.musicVol.gain.setValueAtTime(this.on ? VOL : 0, this.ctx.currentTime); } },
  playRandom() { this.userMusic(); if (!this.ctx) return; this.mp3Mode = 'random'; this.mp3Start(); NC.emit('music:style', 'mp3'); },
  playTrack(n) { this.userMusic(); if (!this.ctx) return; this.paused = false; this.mp3Mode = 'single'; this.mp3Idx = n - 1; this.mp3Ensure(); this.mp3Probe().then(() => this.mp3Play(n - 1)); NC.emit('music:style', 'mp3'); },
  stop() { this.paused = true; if (this.mp3El) this.mp3El.pause(); NC.emit('music:state'); },
  resume() { this.userMusic(); if (!this.ctx) return; this.paused = false; const el = this.mp3El;
    if (el && el.src && !el.ended && el.currentTime > 0) { const p = el.play(); if (p && p.catch) p.catch(() => this.mp3Play(-1)); } else this.mp3Start(); NC.emit('music:state'); },
  togglePlay() { if (this.paused) this.resume(); else this.stop(); return !this.paused; },
  mp3Stop() { this.stop(); },
  nowText() {
    if (!this.ctx) return '🔈 입장하면 음악이 시작돼요'; if (this.ctx.state !== 'running') return '🔇 브라우저가 소리를 멈췄어요 — ▶ 재생을 눌러 주세요';
    if (this.paused) return '⏸ 정지됨'; const el = this.mp3El, n = this.mp3Idx + 1, f = x => isFinite(x) ? `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}` : '--:--';
    if (!el || n < 1) return '⏳ MP3 불러오는 중…'; if (el.readyState < 2 && !el.paused) return `⏳ ${n}번 곡 불러오는 중…`;
    return `▶ ${this.mp3Mode === 'single' ? n + '번 곡 반복' : '랜덤 · ' + n + '번 곡'} ${f(el.currentTime)} / ${f(el.duration)}`;
  },
  /* 🔊 버튼: 배경 음악 음소거/해제 */
  toggle() { if (!this.ctx) this.init(); this.on = !this.on; if (this.musicVol && this.ctx) { this.musicVol.gain.cancelScheduledValues(this.ctx.currentTime); this.musicVol.gain.setValueAtTime(this.on ? VOL : 0, this.ctx.currentTime); } return this.on; },

  /* ── 삭제된 소리: 다른 파일의 호출이 오류 없이 지나가도록 빈 함수만 남김 ── */
  sfx() {}, tone() {}, hit() {}, kick() {},
  tts: false,
  speak(text, voice, onEnd) { onEnd && onEnd(); return 0; },   // NPC TTS 음성 삭제
};
})();
