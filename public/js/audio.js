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
  karaoke: { lp: 260, gain: .1, wet: .02, bass: -6, bleed: .6 },
  restroom: { lp: 320, gain: .14, wet: .25, bass: -4, bleed: .5 },
  smoke: { lp: 480, gain: .2, wet: .05, bass: -2, bleed: .5 },   // 2차 노래방: 클럽 음악은 먼 벽 너머로만
};
const STAGE_SPK = { x: 0, y: 2.6, z: -17.6 };

const A = NC.Audio = {
  ctx: null, on: true, bpm: 128, step: 0, next: 0, t0: 0, zone: 'tables', ducking: 0, ZONE_FX,
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
    { const sv = NC.util.store.get('nc_music', ''); if (this.STYLES[sv]) { this.style = sv; this.bpm = this.STYLES[sv].bpm; } }
    this.next = this.t0 = C.currentTime + .1; this.timer = setInterval(() => this.sched(), 25);
    if ((this.STYLES[this.style] || {}).mp3) this.mp3Start();
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
    this.zoneLP.frequency.setTargetAtTime(this.djLP ? Math.min(z.lp, this.djLP) : z.lp, now, this.djLP ? .05 : tc);   // v18 DJ 필터 this.zoneGain.gain.setTargetAtTime(z.gain, now, tc);
    this.wet.gain.setTargetAtTime(z.wet, now, tc); this.bleedGain.gain.setTargetAtTime(z.bleed, now, tc);
    this.bassShelf.gain.setTargetAtTime(z.bass + near * 5 + (this.djBass || 0), now, tc);
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
  /* ── 스테이지 음악 스타일 (우측 패널 · DJ 신청곡으로 변경) ── */
  style: 'mp3',   // v19: 처음 접속하면 🎲 랜덤 유로 댄스(MP3)로 시작 (사용자가 고른 음악은 nc_music 에 저장돼 그것이 우선)
  STYLES: {
    euro:   { name: '90s 유로댄스', bpm: 128, roots: [55, 43.65, 65.41, 49] },
    disco:  { name: '디스코 펑크', bpm: 116, roots: [55, 61.74, 49, 41.2] },
    house:  { name: '딥 하우스', bpm: 122, roots: [43.65, 43.65, 49, 38.89] },
    hiphop: { name: '올드스쿨 힙합', bpm: 92, roots: [41.2, 41.2, 49, 36.71] },
    trot:   { name: '신나는 트로트', bpm: 136, roots: [55, 73.42, 82.41, 55] },
    lounge: { name: '칠 라운지', bpm: 86, roots: [49, 41.2, 55, 46.25] },
    synth:  { name: '레트로 신스팝', bpm: 110, roots: [55, 43.65, 49, 41.2] },
    ballad: { name: '블루스 발라드', bpm: 68, roots: [49, 41.2, 43.65, 55] },
    mp3:    { name: '🎲 랜덤 유로 댄스', bpm: 128, roots: [55, 49, 43.65, 41.2], mp3: true },   // v19: public/music/1~6.mp3 를 랜덤 재생
  },
  setStyle(id, noSave) { const S = this.STYLES[id]; if (!S) return; this.style = id; this.bpm = S.bpm; if (!noSave) NC.util.store.set('nc_music', id); if (this.ctx) { this.step = 0; this.next = this.t0 = this.ctx.currentTime + .08; if (S.mp3) this.mp3Start(); else this.mp3Stop(); } NC.emit('music:style', id); },
  /* ── v19 랜덤 유로 댄스(MP3): public/music/1.mp3 ~ 6.mp3 를 겹치지 않게 랜덤 연속 재생 ──
   *  같은 음악 버스로 흘려서 구역별 소리(VIP 먹먹함·노래방 차단·DJ 필터)와 음소거 버튼이 그대로 적용됨
   *  목록 바꾸기: NC.config.mp3List = ['music/a.mp3', …] (config.js) */
  mp3List() { return (NC.config && NC.config.mp3List) || [1, 2, 3, 4, 5, 6].map(i => `music/${i}.mp3`); },
  mp3Start() {
    if (!this.ctx) return; const C = this.ctx;
    if (!this.mp3El) { const el = this.mp3El = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous';
      try { this.mp3Src = C.createMediaElementSource(el); this.mp3Src.connect(this.musicBus); } catch (e) { console.warn('[audio] MP3 연결 실패', e); }
      el.addEventListener('ended', () => this.mp3Next());
      el.addEventListener('playing', () => { this.next = this.t0 = C.currentTime + .05; this.step = 0; this.mp3Err = 0; });   // 곡 시작에 박자 시계를 맞춤
      el.addEventListener('error', () => { this.mp3Err = (this.mp3Err || 0) + 1; if (this.mp3Err >= this.mp3List().length) { this.mp3Err = 0; NC.ui && NC.ui.toast('🎵 MP3 파일을 찾지 못했어요 — public/music 폴더에 1~6.mp3 를 넣어 주세요. 기본 음악으로 돌아가요'); this.setStyle('euro', true); } else this.mp3Next(); }); }
    this.mp3Next();
  },
  mp3Next() {
    if (!this.mp3El || !(this.STYLES[this.style] || {}).mp3) return; const L = this.mp3List(); let i; do { i = Math.floor(Math.random() * L.length); } while (L.length > 1 && i === this.mp3Idx); this.mp3Idx = i;
    this.mp3El.src = L[i]; const p = this.mp3El.play(); if (p && p.catch) p.catch(() => {}); NC.ui && NC.ui.toast(`🎲 랜덤 유로 댄스 — ${i + 1}번 곡`); NC.emit && NC.emit('music:track', i + 1);
  },
  mp3Stop() { if (this.mp3El) { this.mp3El.pause(); this.mp3El.removeAttribute('src'); this.mp3El.load(); } },
  kick(t, v = 1.1) { const C = this.ctx, o = C.createOscillator(), g = C.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .24); o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + .26); },
  play(s, t) {
    const S = this.STYLES[this.style] || this.STYLES.euro, bar = Math.floor(s / 16) % 4, root = S.roots[bar], b = s % 16;
    if (S.mp3) return;   // MP3 재생 중에는 신스 연주를 쉼(박자 시계·드롭 이벤트는 그대로 → 조명이 계속 박자를 탐)
    switch (this.style) {
      case 'disco':      // 4온더플로어 + 오픈 하이햇 + 옥타브 베이스 + 스트링 스탭
        if (s % 4 === 0) this.kick(t, 1); if (s % 8 === 4) this.hit(t, 1500, .14, .32); if (s % 4 === 2) this.hit(t, 6500, .16, .2); else this.hit(t, 9000, .02, .05);
        if (s % 2 === 0) this.tone(root * (s % 4 === 0 ? 1 : 2), t, .12, 'sawtooth', .3, 700);
        if (b === 2 || b === 10) [2, 2.52, 3].forEach(m => this.tone(root * 4 * m, t, .22, 'sawtooth', .045, 2200));
        if (b % 4 === 3) this.tone(root * 8 * [1, 1.5, 1.33, 1.2][bar], t, .08, 'square', .03, 3000); break;
      case 'house':      // 킥 + 오프비트 오르간 코드 + 셰이커
        if (s % 4 === 0) this.kick(t, 1.05); if (s % 8 === 4) this.hit(t, 1200, .1, .25); this.hit(t, 8000, .025, s % 2 ? .06 : .03);
        if (s % 4 === 2) [1, 1.19, 1.5, 1.78].forEach(m => this.tone(root * 4 * m, t, .14, 'square', .03, 1800));
        if (b === 0 || b === 7 || b === 10) this.tone(root * 2, t, .2, 'sine', .45, 300); break;
      case 'hiphop':     // 붐뱁: 스윙 킥·스네어, 로즈 코드
        if (b === 0 || b === 7 || b === 10) this.kick(t, 1.2); if (b === 4 || b === 12) { this.hit(t, 1100, .18, .42); this.hit(t, 3000, .08, .15); }
        if (s % 2 === 0) this.hit(t + (s % 4 === 2 ? .03 : 0), 7500, .03, .09);
        if (b === 0 || b === 8) [1, 1.19, 1.5, 1.89].forEach(m => this.tone(root * 4 * m, t, .9, 'triangle', .04, 1400));
        if (b === 0 || b === 10) this.tone(root, t, .4, 'sine', .5, 250); break;
      case 'trot':       // 쿵짝(뽕짝): 1·3 베이스, 2·4 스탭
        if (s % 8 === 0) { this.kick(t, 1); this.tone(root, t, .22, 'triangle', .5, 700); }
        if (s % 8 === 4) { this.hit(t, 1600, .1, .3); this.tone(root * 1.5, t, .22, 'triangle', .45, 700); [2, 2.52, 3].forEach(m => this.tone(root * 2 * m, t, .1, 'square', .05, 2400)); }
        if (s % 2 === 0) this.hit(t, 8000, .03, .06);
        if (s % 4 === 0) this.tone(root * 4 * [1, 1.12, 1.26, 1.5, 1.68, 1.5, 1.26, 1.12][(s / 4) % 8], t, .2, 'square', .05, 2600); break;
      case 'lounge':     // 브러시 드럼 + 일렉피아노 + 서브 베이스
        if (b === 0 || b === 10) this.kick(t, .6); if (b === 4 || b === 12) this.hit(t, 2500, .22, .1); if (s % 2 === 0) this.hit(t, 6000, .06, .04);
        if (b === 0) [1, 1.26, 1.5, 1.89].forEach(m => this.tone(root * 4 * m, t, 1.8, 'sine', .05, 1600));
        if (b === 8) [1.5, 1.89, 2.24].forEach(m => this.tone(root * 4 * m, t, 1.2, 'sine', .035, 1600));
        if (b === 0 || b === 6) this.tone(root, t, .8, 'sine', .45, 220); break;
      case 'synth':      // 80s 신스팝: 게이트 스네어 + 아르페지오 + 패드
        if (s % 4 === 0) this.kick(t, 1); if (s % 8 === 4) { this.hit(t, 900, .25, .38); this.hit(t, 2500, .3, .12); }
        if (s % 2 === 1) this.hit(t, 8000, .03, .05);
        this.tone(root * 4 * [1, 1.5, 2, 3, 2, 1.5, 1.26, 1.5][s % 8], t, .1, 'square', .035, 2800);
        if (s % 2 === 0) this.tone(root * 2, t, .1, 'sawtooth', .28, 500);
        if (b === 0) [1, 1.26, 1.5].forEach(m => this.tone(root * 2 * m, t, 2, 'sawtooth', .025, 1200)); break;
      case 'ballad':     // v15 블루스 타임: 느린 6/8 느낌 — 부드러운 킥 · 브러시 · 일렉피아노 코드 · 현악 패드 · 서브 베이스
        if (b === 0 || b === 8) this.kick(t, .55); if (b === 4 || b === 12) this.hit(t, 2200, .3, .08); if (s % 2 === 0) this.hit(t, 6500, .08, .03);
        if (b === 0) { [1, 1.26, 1.5, 1.89].forEach(m => this.tone(root * 4 * m, t, 3.2, 'sine', .055, 1500)); [1, 1.5, 2].forEach(m => this.tone(root * 2 * m, t, 3.6, 'sawtooth', .014, 900)); }
        if (b === 8) [1.5, 1.89, 2.24].forEach(m => this.tone(root * 4 * m, t, 2.2, 'sine', .04, 1500));
        if (b === 0 || b === 10) this.tone(root, t, 1.4, 'sine', .42, 200);
        if (b === 6 || b === 14) this.tone(root * 8 * [1.5, 1.26, 1.33, 1.12][bar], t, .9, 'triangle', .03, 2400); break;
      default: {         // euro (기본)
        if (s % 4 === 0) this.kick(t);
        if (s % 8 === 4) this.hit(t, 1400, .13, .35);
        if (s % 4 === 2) this.hit(t, 7000, .06, .22); else if (s % 2 === 1) this.hit(t, 8500, .03, .07);
        if (s % 4 === 2) this.tone(root * 2, t, .2, 'sawtooth', .28, 600);
        if (s % 4 === 0) this.tone(root, t, .16, 'sine', .4, 400);
        const arp = [1, 1.5, 2, 1.5, 2.5, 2, 1.5, 1][s % 8]; if (s % 2 === 0) this.tone(root * 4 * arp, t, .12, 'square', .045, 2500);
        if (s % 16 === 6 || s % 16 === 14) [1, 1.2, 1.5].forEach(m => this.tone(root * 4 * m, t, .3, 'sawtooth', .05, 1500)); }
    }
  },
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
      slap: () => { this.hit(t, 2600, .07, .4, b); this.tone(320, t, .06, 'triangle', .2, 2000, b); },
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
