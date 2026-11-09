/* audio.js — Web Audio 신스 디스코 + 공간 음향(Spatial Audio) + 구역별 사운드 댐핑 + 효과음 + TTS
 *
 * 신호 흐름
 *   [신스] → musicBus ─┬→ panner(HRTF, 스테이지 스피커 위치) → bassShelf ─┐
 *                     └→ bleedLP(350Hz) → bleedGain ────────────────────┴→ zoneLP → zoneGain ─┬→ duck → master → comp → out
 *                                                                                           └→ reverb(wet) ┘
 *   [WebRTC 음성/NPC] → voiceBus → master          [효과음] → sfxBus → master
 *
 *  · 스테이지에 가까울수록: panner 거리감쇠↓ + bassShelf 저음 부스트↑ (쿵쿵)
 *  · VIP 룸 안: zoneLP 520Hz, zoneGain 0.3 (벽 너머로 웅웅거리는 저음만), 리버브↓ → 대화가 또렷
 *  · 도어가 열리면 댐핑이 절반 풀림 · 누군가 말하면(음성 감지/TTS) 음악 덕킹 -5dB
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
  karaoke: { lp: 260, gain: .1, wet: .02, bass: -6, bleed: .6 },   // 2차 노래방: 클럽 음악은 먼 벽 너머로만
};
const STAGE_SPK = { x: 0, y: 2.6, z: -17.6 };

const A = NC.Audio = {
  ctx: null, on: true, bpm: 118, step: 0, next: 0, t0: 0, zone: 'tables', ducking: 0, ZONE_FX,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const C = this.ctx = new AC();
    const g = v => { const n = C.createGain(); n.gain.value = v; return n; }, f = (type, fr) => { const n = C.createBiquadFilter(); n.type = type; n.frequency.value = fr; return n; };
    this.master = g(.9); const comp = C.createDynamicsCompressor(); this.master.connect(comp); comp.connect(C.destination);
    this.musicVol = g(.34); this.duck = g(1); this.musicVol.connect(this.duck); this.duck.connect(this.master);
    this.musicBus = g(1);
    this.panner = C.createPanner(); Object.assign(this.panner, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 7, rolloffFactor: 1.1, maxDistance: 60 });
    this.setPos(this.panner, STAGE_SPK.x, STAGE_SPK.y, STAGE_SPK.z);
    this.bassShelf = f('lowshelf', 120); this.bleedLP = f('lowpass', 350); this.bleedGain = g(.35);
    this.zoneLP = f('lowpass', 9000); this.zoneLP.Q.value = .5; this.zoneGain = g(.8);
    this.musicBus.connect(this.panner); this.panner.connect(this.bassShelf); this.bassShelf.connect(this.zoneLP);
    this.musicBus.connect(this.bleedLP); this.bleedLP.connect(this.bleedGain); this.bleedGain.connect(this.zoneLP);
    this.zoneLP.connect(this.zoneGain); this.zoneGain.connect(this.musicVol);
    this.reverb = C.createConvolver(); this.reverb.buffer = this.impulse(2.2); this.wet = g(.12); this.zoneLP.connect(this.reverb); this.reverb.connect(this.wet); this.wet.connect(this.musicVol);
    this.voiceBus = g(1); this.voiceBus.connect(this.master);
    this.sfxBus = g(.5); this.sfxBus.connect(this.master);
    const n = C.sampleRate * .5, buf = C.createBuffer(1, n, C.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    this.next = this.t0 = C.currentTime + .1; this.timer = setInterval(() => this.sched(), 25);
  },
  impulse(sec) { const C = this.ctx, n = C.sampleRate * sec, b = C.createBuffer(2, n, C.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); } return b; },
  setPos(node, x, y, z) { if (node.positionX) { node.positionX.value = x; node.positionY.value = y; node.positionZ.value = z; } else node.setPosition(x, y, z); },
  /* 매 프레임: 청취자(플레이어 귀) 위치·방향과 현재 구역으로 공간음/댐핑 갱신 */
  update(pos, yaw, zoneName, doorOpen) {
    const C = this.ctx; if (!C) return; const L = C.listener, fx = -Math.sin(yaw), fz = -Math.cos(yaw), now = C.currentTime;
    if (L.positionX) { L.positionX.value = pos.x; L.positionY.value = 1.6; L.positionZ.value = pos.z; L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(pos.x, 1.6, pos.z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
    const key = zoneName === 'vip' && doorOpen > .5 ? 'vipOpen' : zoneName; this.zone = zoneName;
    const z = ZONE_FX[key] || ZONE_FX.tables;
    const dStage = Math.hypot(pos.x - STAGE_SPK.x, pos.z - STAGE_SPK.z), near = Math.max(0, 1 - dStage / 22);
    const tc = .25;
    this.zoneLP.frequency.setTargetAtTime(z.lp, now, tc); this.zoneGain.gain.setTargetAtTime(z.gain, now, tc);
    this.wet.gain.setTargetAtTime(z.wet, now, tc); this.bleedGain.gain.setTargetAtTime(z.bleed, now, tc);
    this.bassShelf.gain.setTargetAtTime(z.bass + near * 5, now, tc);
    this.duck.gain.setTargetAtTime(this.ducking > 0 || this.voiceDuck ? .55 : 1, now, .12);
  },
  speaking(on) { this.ducking = Math.max(0, this.ducking + (on ? 1 : -1)); },
  beat() { if (!this.ctx) { const b = performance.now() / 1000 * this.bpm / 60; return { phase: b % 1, n: Math.floor(b), bpm: this.bpm, time: performance.now() / 1000 }; } const b = Math.max(0, this.ctx.currentTime - this.t0) * this.bpm / 60; return { phase: b % 1, n: Math.floor(b), bpm: this.bpm, time: this.ctx.currentTime }; },
  beatTime(n) { return this.t0 + n * 60 / this.bpm; },
  /* ── 신스 디스코 (16스텝 x 4마디 루프) ── */
  sched() { const C = this.ctx; while (this.next < C.currentTime + .15) { this.play(this.step, this.next); if (this.step % 64 === 0) { const d = (this.next - C.currentTime) * 1000; setTimeout(() => NC.emit('music:drop'), Math.max(0, d)); } this.next += 60 / this.bpm / 4; this.step = (this.step + 1) % 64; } },
  tone(f, t, dur, type, vol, lp, bus) { const C = this.ctx, o = C.createOscillator(), g = C.createGain(), fl = C.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lp || 1800;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0008, t + dur); o.connect(fl); fl.connect(g); g.connect(bus || this.musicBus); o.start(t); o.stop(t + dur + .02); },
  hit(t, hp, dur, vol, bus) { const C = this.ctx, s = C.createBufferSource(), g = C.createGain(), f = C.createBiquadFilter(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = hp; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(bus || this.musicBus); s.start(t); s.stop(t + dur + .02); },
  play(s, t) { const C = this.ctx, bar = Math.floor(s / 16) % 4, root = [55, 43.65, 65.41, 49][bar];
    if (s % 4 === 0) { const o = C.createOscillator(), g = C.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(1.1, t); g.gain.exponentialRampToValueAtTime(.001, t + .24); o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + .26); }
    if (s % 8 === 4) this.hit(t, 1400, .13, .35);
    if (s % 4 === 2) this.hit(t, 7000, .06, .22); else if (s % 2 === 1) this.hit(t, 8500, .03, .07);
    if (s % 4 === 2) this.tone(root * 2, t, .2, 'sawtooth', .28, 600);
    if (s % 4 === 0) this.tone(root, t, .16, 'sine', .4, 400);
    const arp = [1, 1.5, 2, 1.5, 2.5, 2, 1.5, 1][s % 8]; if (s % 2 === 0) this.tone(root * 4 * arp, t, .12, 'square', .045, 2500);
    if (s % 16 === 6 || s % 16 === 14) [1, 1.2, 1.5].forEach(m => this.tone(root * 4 * m, t, .3, 'sawtooth', .05, 1500)); },
  /* ── 효과음 (공간 처리 없이 바로 들림) ── */
  sfx(name) {
    const C = this.ctx; if (!C) return; const t = C.currentTime, b = this.sfxBus;
    const P = { clink: () => { [2637, 3520, 4186].forEach((f, i) => this.tone(f, t + i * .015, .5, 'sine', .18, 9000, b)); },
      coin: () => { this.tone(988, t, .08, 'square', .12, 6000, b); this.tone(1319, t + .08, .25, 'square', .12, 6000, b); },
      tick: () => this.tone(1800, t, .03, 'square', .08, 5000, b),
      win: () => [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * .09, .25, 'triangle', .2, 6000, b)),
      lose: () => [392, 330, 262].forEach((f, i) => this.tone(f, t + i * .12, .3, 'triangle', .18, 3000, b)),
      door: () => this.hit(t, 400, .5, .15, b),
      hit: () => this.tone(1320, t, .09, 'triangle', .22, 8000, b),
      miss: () => this.tone(180, t, .12, 'sawtooth', .12, 800, b),
      pop: () => { this.tone(660, t, .06, 'sine', .2, 5000, b); this.tone(990, t + .05, .1, 'sine', .15, 5000, b); },
      heart: () => [784, 988].forEach((f, i) => this.tone(f, t + i * .1, .2, 'sine', .16, 5000, b)) };
    (P[name] || P.pop)();
  },
  toggle() { if (!this.ctx) this.init(); this.on = !this.on; if (this.musicVol) this.musicVol.gain.value = this.on ? .34 : 0; return this.on; },
  /* ── NPC 음성 (브라우저 TTS) — 공간 처리는 불가하므로 말하는 동안 음악을 덕킹 ── */
  tts: false,
  speak(text, voice = {}, onEnd) {
    if (!this.tts || !window.speechSynthesis) { onEnd && onEnd(); return 0; }
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '')); u.lang = 'ko-KR'; u.pitch = voice.pitch || 1; u.rate = voice.rate || 1.05;
    const vs = speechSynthesis.getVoices().filter(v => /ko/i.test(v.lang)); if (vs.length) u.voice = vs[(voice.index || 0) % vs.length];
    this.speaking(true); u.onend = u.onerror = () => { this.speaking(false); onEnd && onEnd(); };
    speechSynthesis.cancel(); speechSynthesis.speak(u); return text.length * .11;
  },
};
})();
