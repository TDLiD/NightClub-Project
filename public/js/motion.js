/* motion.js — 절차적 애니메이션 + 인터랙션 트리거
 *  ■ 베이스 루프: idle · walk · groove(리듬 타기) · stageDance(스테이지 댄스) · sit · sitTalk
 *  ■ 제스처(1회성, 상체 오버레이): drink · cheers(짠) · shy(쑥스러움) · laugh · wave · clap · cheer(만세) · bow(꾸벅)
 *                                 nod · headshake · think · point · lookAround · crossArms
 *  ■ 트리거: NC.Motion.trigger(avatar, 'drink:cheers') 처럼 이벤트 이름으로 모션+표정+효과음을 한 번에 실행
 *  포즈 = { 관절: [x,y,z] } 를 매 프레임 계산 → 제스처 가중치로 블렌드 → 지수 감쇠로 부드럽게 적용
 *  groove/stageDance 는 audio.js 의 박자(beat phase)에 동기화됩니다.
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, PI = Math.PI;
const JOINTS = ['torso', 'neck', 'head', 'shL', 'elL', 'shR', 'elR', 'legL', 'knL', 'legR', 'knR'];
const REST = { shL: [0, 0, -.12], shR: [0, 0, .12], elL: [-.12, 0, 0], elR: [-.12, 0, 0] };
const beatInfo = () => (NC.Audio && NC.Audio.beat ? NC.Audio.beat() : (() => { const b = performance.now() / 1000 * 118 / 60; return { phase: b % 1, n: Math.floor(b), bpm: 118 }; })());

/* v10 부르스 행동 오버레이: u.bAct = { k, t0, dur, out } — 시간 구간별 목표 자세를 기본 부르스 자세 위에 섞는다
 *  k: hug · kiss · butt · chest · undress   out: 'accept' | 'stop'(손 제지) | 'refuse'(뿌리침)  */
const ss = (a, b, x) => U.clamp((x - a) / (b - a), 0, 1);
const sm2 = (a, b, x) => { const t = ss(a, b, x); return t * t * (3 - 2 * t); };
const lerp3 = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)];
const env3 = (e, a, b, c, d) => Math.min(ss(a, b, e), 1 - ss(c, d, e));          // a→b 올라가고 c→d 내려감
function mixJ(p, j, tg, w) { if (w <= 0) return; const a0 = p[j] || REST[j] || [0, 0, 0]; p[j] = [U.lerp(a0[0], tg[0], w), U.lerp(a0[1], tg[1], w), U.lerp(a0[2], tg[2], w)]; }
function BLUES_ACT(p, u) {
  const A = u.bAct; if (!A) return; const e = (performance.now() - A.t0) / 1000;
  if (e > A.dur) { u.bAct = null; return; }
  const lead = u.bluesLead, D = A.dur, acc = A.out === 'accept', H = A.hit || 1;
  const J = (j, v, w) => mixJ(p, j, v, w), arms = (L, eL, R, eR, w) => { J('shL', L, w); J('elL', [eL, 0, 0], w); J('shR', R, w); J('elR', [eR, 0, 0], w); };
  // IK 자세 모음 (브라우저 안 역운동학으로 구함)
  const HUG_LEAD = () => [[-.3, 1.02, -.95], -1.01, [-.46, -1.4, .85], -.81], HUG_PART = () => [[-.58, 1.03, -1.25], -1.4, [-.52, -1.01, 1.31], -1.37];
  const WAIST_LEAD = () => [[-.01, .87, -1.4], -1.49, [-.09, -1.21, 1.34], -1.34], CHEEK_LEAD = () => [[-1.13, 0, .05], -2.1, [-1.13, 0, -.05], -2.1];
  const BACK_LEAD = () => [[-.19, -.28, .4], -1.31, [-.19, .28, -.4], -1.31];
  const k = A.k;
  if (k === 'hug') {                                     // 꼭 안기: 리드는 등 뒤로 팔을 감고 살짝 끌어안는 압박(호흡처럼), 상대는 목에 팔을 두르고 어깨에 기댐
    const w = env3(e, 0, .7, D - .7, D), sq = .04 * Math.sin(e * 3.2) * w;
    if (lead) { const [a, b, c, d] = HUG_LEAD(); arms(a, b, c, d, w); J('head', [.12, .55, .1], w); J('torso', [.1 + sq, 0, 0], w); }
    else if (acc) { const [a, b, c, d] = HUG_PART(); arms(a, b, c, d, w); J('head', [.18, .55, -.15], w); J('torso', [.1 + sq, 0, 0], w); p.bodyY = (p.bodyY || 0) + .02 * w; }
    else { const r = env3(e, .5, .8, D - .5, D); arms([-1.3, 0, .25], -.5, [-1.3, 0, -.25], -.5, r); J('torso', [-.12, 0, 0], r); }
  } else if (k === 'waist') {                            // 허리 끌어당기기: 두 손으로 허리를 감아 당김 → 상대가 목에 팔을 걸며 기댐
    const w = env3(e, 0, .6, D - .6, D);
    if (lead) { const [a, b, c, d] = WAIST_LEAD(); arms(a, b, c, d, w); J('torso', [.06, 0, 0], w); }
    else if (acc) { const r = env3(e, H, H + .5, D - .6, D), [a, b, c, d] = HUG_PART(); arms(a, b, c, d, r * .75); J('torso', [.12, 0, 0], r); J('head', [.1, 0, 0], r); }
  } else if (k === 'whisper') {                          // 귓속말: 리드가 고개를 숙여 상대 귀 쪽으로 → 상대가 간지러워 어깨를 움츠리며 웃음
    const w = env3(e, 0, .8, D - .6, D);
    if (lead) { J('head', [.3, .72, .12], w); J('neck', [.1, .3, 0], w); J('torso', [.14, .18, 0], w); }
    else if (acc) { const r = env3(e, H, H + .3, D - .5, D); J('head', [.12, -.3, .3], r); J('torso', [.05, .1, .08 * Math.sin(e * 14)], r); p.bodyY = (p.bodyY || 0) + .012 * r * Math.abs(Math.sin(e * 14)); }
    else { const r = env3(e, H - .2, H + .2, D - .5, D); J('head', [-.05, -.6, 0], r); }
  } else if (k === 'spin') {                             // 턴: 리드 왼손과 상대 오른손을 머리 위로 들어 올리고 상대가 그 아래에서 한 바퀴 (회전은 karaoke.js 틱커)
    const w = env3(e, 0, .5, D - .5, D);
    if (lead) { J('shL', [-2.75, 0, .2], w); J('elL', [-.25, 0, 0], w); J('torso', [-.03, .15, 0], w); }
    else { J('shR', [-2.75, 0, -.15], w); J('elR', [-.25, 0, 0], w); J('shL', [-.6, 0, -.6], w); J('elL', [-.4, 0, 0], w); p.bodyY = (p.bodyY || 0) + .025 * w; }
  } else if (k === 'dip') {                              // 딥: 리드가 오른팔로 등을 받치고 상체를 숙임 → 상대가 뒤로 젖혀 눕고 한쪽 팔을 우아하게 뻗음
    const w = env3(e, .2, H, D - .9, D - .1);
    if (lead) { const [, , c, d] = HUG_LEAD(); J('shR', c, w); J('elR', [d, 0, 0], w); J('torso', [.32, 0, 0], w); J('head', [.28, 0, 0], w); J('knL', [.3, 0, 0], w); J('knR', [.3, 0, 0], w); p.hipsY = U.lerp(p.hipsY, u.hipH - .06, w); }
    else if (acc) { J('torso', [-.62, 0, 0], w); J('neck', [-.25, 0, 0], w); J('head', [-.4, .2, 0], w); J('shR', [-.4, 0, -1.35], w); J('elR', [-.15, 0, 0], w); J('legL', [.35, 0, -.05], w); J('knL', [.6, 0, 0], w); J('legR', [-.15, 0, .05], w); p.hipsY = U.lerp(p.hipsY, u.hipH - .05, w); }
    else { const r = env3(e, .6, .9, D - .5, D); J('torso', [-.1, 0, 0], r); arms([-1.2, 0, .3], -.4, [-1.2, 0, -.3], -.4, r); }
  } else if (k === 'forehead') {                         // 이마 맞대기: 서로 고개를 숙여 이마를 붙이고 눈을 감음
    const w = env3(e, 0, .9, D - .7, D), r = acc ? 1 : env3(e, 0, .5, H, H + .3);
    J('head', [.36, 0, 0], w * r); J('neck', [.12, 0, 0], w * r); J('torso', [.08, 0, 0], w * r);
    if (!lead && !acc) { const t = env3(e, H, H + .3, D - .4, D); J('head', [.15, -.5, 0], t); }
  } else if (k === 'cheek') {                            // 볼 뽀뽀: 리드가 고개를 돌려 볼로 → 받아 주면 상대가 볼을 내밀고 수줍게 웃음
    const w = env3(e, .1, H, H + .4, D);
    if (lead) { J('head', [.22, .5, .18], w); J('torso', [.16, .14, 0], w); }
    else if (acc) { const r = env3(e, .5, H, D - .6, D); J('head', [.05, -.4, -.18], r); }
    else { const r = env3(e, .6, H, D - .4, D); J('head', [-.08, -.95, .1], r); J('torso', [-.1, -.2, 0], r); }
  } else if (k === 'backhug') {                          // 백허그: 상대가 돌아선 뒤(틱커) 리드가 뒤에서 허리를 감싸 안고 어깨에 턱을 기댐 · 상대는 손을 포개고 고개를 기울임
    const w = env3(e, H - .3, H + .3, D - 1.0, D - .3);
    if (lead) { const [a, b, c, d] = BACK_LEAD(); arms(a, b, c, d, w); J('head', [.3, .35, .1], w); J('torso', [.1, 0, 0], w); }
    else if (acc) { arms([-.75, 0, .45], -1.25, [-.75, 0, -.45], -1.25, w); J('head', [-.12, -.45, .2], w); J('torso', [-.05, 0, 0], w); }
  } else if (k === 'kiss' || k === 'deepkiss') {         // 키스: 다가가며(0~H) 한 손(진한 키스는 두 손)으로 볼을 감쌈 → 받아 주면 상대가 목에 팔을 두르고 발끝을 들며 고개를 기울임
    const deep = k === 'deepkiss', w = env3(e, 0, H, D - .7, D), hand = env3(e, H * .5, H + .2, D - .8, D);
    if (lead) { const [a, b, c, d] = WAIST_LEAD(), [ca, cb, cc, cd] = CHEEK_LEAD(); arms(a, b, c, d, w);
      if (acc || deep) { J('shR', cc, hand); J('elR', [cd, 0, 0], hand); if (deep) { J('shL', ca, hand); J('elL', [cb, 0, 0], hand); } } }
    else if (acc) { const r = env3(e, H, H + .5, D - .7, D), [a, b, c, d] = HUG_PART(); arms(a, b, c, d, r * (deep ? 1 : .8)); p.bodyY = (p.bodyY || 0) + .03 * r; J('legL', [-.05, 0, 0], r); }
    else { const r = env3(e, .7, 1.0, D - .5, D); J('head', [-.05, -1.0, .1], r); J('neck', [0, -.45, 0], r); J('torso', [-.1, -.2, 0], r); }
  } else if (k === 'neck') {                             // 목덜미 키스: 리드가 고개를 숙여 상대 목 옆으로 → 받아 주면 상대가 고개를 반대로 젖히고 어깨를 움츠림
    const w = env3(e, .1, H, D - .6, D);
    if (lead) { const [a, b, c, d] = WAIST_LEAD(); arms(a, b, c, d, w); J('head', [.5, .6, .15], w); J('neck', [.2, .25, 0], w); J('torso', [.2, .15, 0], w); }
    else if (acc) { const r = env3(e, H - .2, H + .3, D - .6, D); J('head', [-.2, -.4, -.38], r); J('neck', [-.1, -.2, 0], r); J('torso', [-.04, -.08, 0], r); const [a, b, c, d] = HUG_PART(); arms(a, b, c, d, r * .6); }
    else { const r = env3(e, H - .2, H + .1, D - .5, D); J('head', [-.05, -.4, .3], r); J('torso', [.1, .15, 0], r); }
  } else if (k === 'butt' || k === 'chest') {            // 리드 오른손: 허리 → (등 아래 | 옆구리) → 엉덩이 옆 뒤 | 가슴 앞 — 경로를 따라 미끄러지듯 이동 → 상대가 굳었다가 반응
    const ref = A.out === 'refuse', back = env3(e, 0, .1, ref ? H + .3 : D - .7, ref ? H + .55 : D - .2), m1 = sm2(.05, .55, e), m2 = sm2(.55, H, e);
    if (lead) {
      if (k === 'butt') { const mid = [[-.69, .01, -.2], -.85], end = [[-.75, 0, -.08], -.05], base = [p.shR || [0, 0, 0], (p.elR || [0])[0]];
        const sh = lerp3(lerp3(base[0], mid[0][0] !== undefined ? mid[0] : base[0], m1), end[0], m2), el = U.lerp(U.lerp(base[1], mid[1], m1), end[1], m2); J('shR', sh, back); J('elR', [el, 0, 0], back); J('torso', [.06, -.08, 0], back * m2); }
      else { const mid = [[-.95, -.45, .1], -1.25], end = [[-.58, -.78, .25], -1.43], base = [p.shR || [0, 0, 0], (p.elR || [0])[0]];
        const sh = lerp3(lerp3(base[0], mid[0], m1), end[0], m2), el = U.lerp(U.lerp(base[1], mid[1], m1), end[1], m2); J('shR', sh, back); J('elR', [el, 0, 0], back); J('torso', [.05, -.06, 0], back * m2); }
      if (ref) { const f = env3(e, H + .3, H + .45, D - .4, D); J('head', [-.1, -.7, .2], f); J('torso', [-.15, -.3, 0], f); }
    } else {
      const stiff = env3(e, H - .35, H - .15, D - .5, D); J('torso', [-.12, 0, 0], stiff * .7); J('head', [-.12, .35, 0], stiff * .7); p.bodyY = (p.bodyY || 0) + .012 * stiff;   // 순간 굳으며 리드를 돌아봄
      if (A.out === 'stop') { const g = env3(e, H, H + .35, D - .8, D - .3);
        if (k === 'butt') { J('shL', [.85, .01, .12], g); J('elL', [-1.17, 0, 0], g); } else { J('shR', [.26, -.4, -.15], g); J('elR', [-2.32, 0, 0], g); } }
    }
  } else if (k === 'undress') {                          // 리드: 두 손으로 상대 옷자락(허리 앞)을 잡고 → 위로 올리려 함 · 상대: 두 손으로 손목을 붙잡아 내림
    if (lead) { const grab = env3(e, .1, .7, D - .6, D), lift = ss(.7, 1.3, e) * (1 - ss(1.3, 1.7, e) * (A.out === 'refuse' ? 1 : .85));
      J('shL', [-.46 - .15 * lift, -.04, .1 + .07 * lift], grab); J('elL', [-.82 - .94 * lift, 0, 0], grab);
      J('shR', [-.6, -.2 + .23 * lift, -.2 + .03 * lift], grab); J('elR', [-.64 - 1.12 * lift, 0, 0], grab); }
    else { const hold = env3(e, 1.0, 1.25, D - .6, D); arms([-.7, 0, .3], -.8, [-.7, 0, -.3], -.8, hold); J('torso', [-.08, 0, 0], hold); }
  }
}

/* ── 베이스 루프 ── */
const BASE = {
  idle(p, t, u) { const s = Math.sin(t * 1.7 + u.seed * 9), w = Math.sin(t * .42 + u.seed * 7); p.bodyX = .022 * w; p.legL = [0, 0, -.03 + .03 * w]; p.legR = [0, 0, .03 + .03 * w]; p.knL = [Math.max(0, w) * .12, 0, 0]; p.knR = [Math.max(0, -w) * .12, 0, 0]; p.hipsY = u.hipH - .008 * Math.abs(w); p.torso = [.02 * s, 0, -.02 * w]; p.head = [.03 * Math.sin(t * .9 + u.seed * 5), .22 * Math.sin(t * .23 + u.seed * 13), 0]; p.shL = [.03 * s, 0, -.12]; p.shR = [-.03 * s, 0, .12]; },
  walk(p, t, u) {
    const ph = u.walkPh, s = Math.sin(ph), c = Math.cos(ph);
    p.legL = [s * .5, 0, -.02]; p.legR = [-s * .5, 0, .02]; p.knL = [Math.max(0, -c) * .9 + .05, 0, 0]; p.knR = [Math.max(0, c) * .9 + .05, 0, 0];
    p.shL = [-s * .42, 0, -.1]; p.shR = [s * .42, 0, .1]; p.elL = [-.35 - Math.max(0, -s) * .3, 0, 0]; p.elR = [-.35 - Math.max(0, s) * .3, 0, 0];
    p.torso = [.04, s * .07, 0]; p.head = [-.03, -s * .05, 0]; p.bodyY = (Math.abs(c) - .5) * .04;
  },
  groove(p, t, u, b) {
    const dip = (1 + Math.cos(b.phase * 2 * PI)) / 2, sw = Math.sin((b.n % 2 + b.phase) * PI) * (b.n % 4 < 2 ? 1 : -1);
    p.hipsY = u.hipH - .045 * dip; p.legL = [-.12 * dip, 0, -.04]; p.legR = [-.12 * dip, 0, .04]; p.knL = [.28 * dip, 0, 0]; p.knR = [.28 * dip, 0, 0];
    p.torso = [.06 * dip, .15 * sw, .05 * sw]; p.head = [.12 * dip, -.1 * sw, 0];
    p.shL = [-.45 - .15 * dip, .1 * sw, -.25]; p.elL = [-1.5 + .2 * dip, 0, 0]; p.shR = [-.45 - .15 * dip, .1 * sw, .25]; p.elR = [-1.5 + .2 * dip, 0, 0];
  },
  // 노래방: 마이크를 입가에, 박자에 맞춰 몸을 흔들며 왼손은 감정 표현
  sing(p, t, u, b) {
    const dip = (1 + Math.cos(b.phase * 2 * PI)) / 2, sw = Math.sin((b.n % 2 + b.phase) * PI) * (b.n % 4 < 2 ? 1 : -1), big = Math.floor(b.n / 8 + u.seed * 3) % 3;
    p.hipsY = u.hipH - .02 * dip; p.knL = [.12 * dip, 0, 0]; p.knR = [.12 * dip, 0, 0]; p.legL = [-.05 * dip, 0, -.05]; p.legR = [-.05 * dip, 0, .05];
    p.torso = [.03 + .03 * dip, .12 * sw, .03 * sw]; p.head = [-.08 + .06 * dip, -.08 * sw, .05 * sw]; p.bodyX = .03 * sw;
    p.shR = [-.72, 0, -.32]; p.elR = [-2.2, 0, 0];
    if (big === 0) { p.shL = [-.4 - .25 * Math.max(0, sw), 0, -.35]; p.elL = [-.8, 0, 0]; } else if (big === 1) { p.shL = [-1.6, 0, -.5 + .2 * sw]; p.elL = [-.25, 0, 0]; } else { p.shL = [-.2, 0, -1.2 - .3 * dip]; p.elL = [-.4, 0, 0]; }
  },
  stageDance(p, t, u, b) {
    BASE.groove(p, t, u, b);
    const dip = (1 + Math.cos(b.phase * 2 * PI)) / 2, sw = Math.sin((b.n % 2 + b.phase) * PI) * (b.n % 4 < 2 ? 1 : -1), move = Math.floor(b.n / 8 + u.seed * 4) % 4;
    p.bodyY = .07 * Math.sin(b.phase * PI);
    if (move === 0) { p.shR = [-.2, 0, 2.6 - .5 * dip]; p.elR = [-.3 * dip, 0, 0]; p.shL = [-.6, 0, -.3]; p.elL = [-1.4, 0, 0]; }
    else if (move === 1) { if (b.n % 2 === 0) p.shR = [-.3, 0, 2.5]; else p.shR = [-.7, 0, -.35]; p.elR = [-.1, 0, 0]; p.shL = [.2, 0, -.55]; p.elL = [-1.6, 0, .3]; p.torso = [.04, .3 * sw, 0]; }
    else if (move === 2) { p.shL = [0, 0, -2.6 + .3 * sw]; p.shR = [0, 0, 2.6 + .3 * sw]; p.elL = [-.3, 0, 0]; p.elR = [-.3, 0, 0]; p.torso = [0, 0, .12 * sw]; p.bodyX = .05 * sw; }
    else { p.bodyX = .18 * sw; p.legL = [-.12 * dip, 0, -.15 * Math.max(0, sw)]; p.legR = [-.12 * dip, 0, .15 * Math.max(0, -sw)]; p.shL = [-.6 * sw - .3, 0, -.2]; p.shR = [.6 * sw - .3, 0, .2]; p.elL = [-.8, 0, 0]; p.elR = [-.8, 0, 0]; }
  },
  // v9 부르스(블루스): 마주 보고 천천히 좌우로 흔들기. 리드는 손을 상대 허리에, 상대는 어깨에. u.kissK(0~1) 로 서로 기울임
  blues(p, t, u) {
    const s = Math.sin(t * 1.55), w = Math.sin(t * .77), k = u.kissK || 0;
    p.bodyX = .035 * s; p.hipsY = u.hipH - .012 * Math.abs(s); p.legL = [.06 * s, 0, -.04]; p.legR = [-.06 * s, 0, .04]; p.knL = [Math.max(0, s) * .14, 0, 0]; p.knR = [Math.max(0, -s) * .14, 0, 0];
    const tl = u.kissDeep ? .34 + .06 * Math.sin(t * 1.3) : .22; p.torso = [.07 + .12 * k, .05 * w, -.04 * s]; p.head = [.1 + .12 * k, .12 * w * (1 - k) + (u.kissDeep ? .1 * Math.sin(t * .9) * k : 0), (u.bluesLead ? tl : -tl) * k + .05 * s * (1 - k)];
    if (u.bluesLead) { p.shL = [-.59, .02, -.19]; p.elL = [-1.08, 0, 0]; p.shR = [-.59, -.02, .19]; p.elR = [-1.08, 0, 0]; }     // 손: 상대 허리 옆 (IK)
    else { p.shL = [-1.24, -.04, -.05]; p.elL = [-1.08, 0, 0]; p.shR = [-1.29, -.01, .1]; p.elR = [-.94, 0, 0]; }                  // 손: 상대 어깨 위 (IK)
    BLUES_ACT(p, u);
  },
  sit(p, t, u) {
    const s = Math.sin(t * 1.5 + u.seed * 7);
    p.hipsY = (u.seatH + .03) / u.figScale; p.legL = [-1.5, 0, -.06]; p.legR = [-1.5, 0, .06]; p.knL = [1.45, 0, 0]; p.knR = [1.45, 0, 0];
    p.torso = [.04 + .015 * s, 0, 0]; p.shL = [-.55, 0, -.06]; p.elL = [-.7, 0, 0]; p.shR = [-.55, 0, .06]; p.elR = [-.7, 0, 0]; p.head = [.02, .15 * Math.sin(t * .3 + u.seed), 0];
  },
  sitTalk(p, t, u) { BASE.sit(p, t, u); p.shR = [-.7 + .15 * Math.sin(t * 3.1), 0, .15]; p.elR = [-1.3 + .35 * Math.sin(t * 4.3), 0, 0]; p.head = [.05 * Math.sin(t * 2.3), .1 * Math.sin(t * 1.1), 0]; },
};

/* ── 제스처 (dur 초, 기본 표정) ── */
const GEST = {
  drink: { dur: 2.2, f(p, t) { const k = U.clamp((t - .6) / .4, 0, 1) * U.clamp((1.6 - t) / .3, 0, 1); p.shR = [-.55, 0, -.38]; p.elR = [-2.35, 0, 0]; p.head = [-.22 * k, 0, 0]; }, glass: true },
  smoke: { dur: 3.0, f(p, t) { const k = U.clamp((t - .5) / .4, 0, 1) * U.clamp((2.3 - t) / .4, 0, 1); p.shR = [-.55, 0, -.38]; p.elR = [-2.35, 0, 0]; p.head = [-.22 * k, 0, 0]; } },
  cheers: { dur: 1.8, expr: 'smile', f(p, t) { const bump = Math.exp(-Math.pow((t - .8) * 8, 2)); p.shR = [-1.35 - .14 * bump, 0, -.15]; p.elR = [-.45, 0, 0]; p.torso = [.08, 0, 0]; }, glass: true },
  shy: { dur: 2.6, expr: 'shy', f(p, t) { p.head = [.35, 0, .2]; p.neck = [.1, 0, 0]; p.torso = [.12, .08 * Math.sin(t * 2), 0]; p.shR = [-.85, 0, -.4]; p.elR = [-2.3, 0, 0]; p.shL = [-.2, 0, .1]; p.elL = [-1.2, 0, .2]; } },
  laugh: { dur: 1.8, expr: 'laugh', f(p, t) { const q = Math.sin(t * 16); p.torso = [.18 + .06 * q, 0, 0]; p.head = [-.15 + .06 * q, 0, 0]; p.shL = [-.45, 0, .15]; p.elL = [-1.7, 0, 0]; p.shR = [-.45, 0, -.15]; p.elR = [-1.7, 0, 0]; p.bodyY = .01 * q; } },
  wave: { dur: 2.0, expr: 'smile', f(p, t) { p.shR = [-.1, 0, 2.5]; p.elR = [0, 0, .5 * Math.sin(t * 10)]; p.head = [0, 0, -.12]; } },
  clap: { dur: 2.0, expr: 'smile', f(p, t) { const q = Math.max(0, Math.sin(t * 13)); p.shL = [-1.05, 0, .38 - .12 * q]; p.shR = [-1.05, 0, -.38 + .12 * q]; p.elL = [-.95, 0, 0]; p.elR = [-.95, 0, 0]; } },
  cheer: { dur: 2.0, expr: 'laugh', f(p, t) { p.shL = [0, 0, -2.85]; p.shR = [0, 0, 2.85]; p.elL = [-.2, 0, 0]; p.elR = [-.2, 0, 0]; p.bodyY = .08 * Math.abs(Math.sin(t * 7)); } },
  bow: { dur: 1.4, expr: 'smile', f(p, t, d) { const k = Math.sin(U.clamp(t / d, 0, 1) * PI); p.torso = [.75 * k, 0, 0]; p.head = [.25 * k, 0, 0]; p.shL = [.15 * k, 0, -.05]; p.shR = [.15 * k, 0, .05]; } },
  nod: { dur: 1.1, f(p, t) { p.head = [.22 * Math.max(0, Math.sin(t * 9)), 0, 0]; } },
  headshake: { dur: 1.2, f(p, t) { p.head = [0, .35 * Math.sin(t * 11), 0]; } },
  think: { dur: 2.5, f(p) { p.shR = [-1.0, 0, -.45]; p.elR = [-2.1, 0, 0]; p.shL = [-.5, 0, .45]; p.elL = [-1.6, 0, 0]; p.head = [.05, 0, .15]; } },
  point: { dur: 2.2, expr: 'smile', f(p) { p.shR = [-1.45, 0, .55]; p.elR = [-.05, 0, 0]; p.head = [0, .3, 0]; } },
  lookAround: { dur: 3.0, f(p, t) { p.head = [0, .7 * Math.sin(t * 1.6), 0]; } },
  slap: { dur: 1.3, expr: 'annoyed', f(p, t) { const k = t < .3 ? t / .3 : Math.max(0, 1 - (t - .3) / .7), sw = t < .3 ? 0 : Math.min(1, (t - .3) / .12); p.shR = [-1.35 * k, 0, .9 - 1.5 * sw * k]; p.elR = [-.25, 0, 0]; p.torso = [-.05, -.45 * sw * k, 0]; p.head = [-.08, .2 * k, 0]; } },
  push: { dur: 1.1, expr: 'annoyed', f(p, t) { const k = Math.sin(U.clamp(t / .9, 0, 1) * PI); p.shL = [-1.45 * k, 0, .3]; p.shR = [-1.45 * k, 0, -.3]; p.elL = [-.2, 0, 0]; p.elR = [-.2, 0, 0]; p.torso = [-.15 * k, 0, 0]; p.head = [-.15 * k, 0, 0]; } },
  flinch: { dur: 1.0, expr: 'sad', f(p, t) { const k = Math.exp(-t * 3); p.head = [-.1, -.6 * k, .15 * k]; p.torso = [-.1 * k, -.25 * k, 0]; p.bodyX = -.06 * k; } },
  crossArms: { dur: 2.5, expr: 'annoyed', f(p) { p.shL = [-.55, 0, .5]; p.elL = [-1.95, 0, 0]; p.shR = [-.55, 0, -.5]; p.elR = [-1.95, 0, 0]; p.head = [-.05, 0, 0]; } },
};

/* ── 인터랙션 트리거 표 (이벤트 → 모션/표정/효과음) — docs/03 과 동일 ── */
const TRIGGERS = {
  'zone:stage': { base: 'stageDance' }, 'zone:dance': { base: 'groove' }, 'zone:other': { base: null },
  'music:drop': { gesture: 'cheer', chance: .35 },
  'social:greet': { gesture: 'wave', expr: 'smile' }, 'social:bow': { gesture: 'bow', expr: 'smile' },
  'drink:order': { gesture: 'drink' }, 'drink:cheers': { gesture: 'cheers', expr: 'smile', sfx: 'clink' },
  'talk:compliment': { gesture: 'shy', expr: 'shy' }, 'talk:joke': { gesture: 'laugh', expr: 'laugh' }, 'talk:tease': { expr: 'wink' }, 'talk:think': { gesture: 'think' },
  'affinity:up': { gesture: 'nod', expr: 'smile' }, 'affinity:bigUp': { gesture: 'laugh', expr: 'laugh' },
  'affinity:down': { gesture: 'headshake', expr: 'sad' }, 'affinity:rude': { gesture: 'crossArms', expr: 'annoyed' },
  'game:win': { gesture: 'cheer', expr: 'laugh', sfx: 'win' }, 'game:lose': { gesture: 'shy', expr: 'sad' },
  'idle:long': { gesture: 'lookAround' }, 'waiter:guide': { gesture: 'point', expr: 'smile' },
};
/* LLM emotion → 트리거 */
const EMOTION_TRIGGER = { smile: 'affinity:up', laugh: 'talk:joke', shy: 'talk:compliment', annoyed: 'affinity:rude', sad: 'affinity:down', wink: 'talk:tease' };

function play(a, name, opt = {}) {
  const u = a && a.userData, g = GEST[name]; if (!u || !u.motion || !g) return;
  const m = u.motion; m.g = name; m.gT = 0; m.gDur = opt.dur || g.dur;
  const ex = opt.expr || g.expr; if (ex) u.setExpr(name === 'cheer' ? 'joy' : ex, m.gDur + .6);
  if (name === 'cheer' && NC.fx && opt.confetti !== false) NC.fx.confetti(a.position.x, a.position.y + 1.9, a.position.z, 40);
}
function trigger(a, ev, opt = {}) {
  if (a && a.userData && a.userData.dance === 'blues' && (ev === 'music:drop' || String(ev).startsWith('zone:'))) return;   // v10: 부르스 중엔 음악 드롭·구역 모션 무시
  const tr = TRIGGERS[ev]; if (!tr || !a) return;
  if (tr.chance && Math.random() > tr.chance) return;
  const u = a.userData;
  if ('base' in tr) u.dance = tr.base;
  if (tr.gesture) play(a, tr.gesture, { expr: tr.expr });
  else if (tr.expr) u.setExpr(tr.expr, opt.dur || 2.5);
  if (tr.sfx && NC.Audio && !opt.silent) NC.Audio.sfx(tr.sfx);
  NC.emit('motion', a, ev);
}

const ZERO = [0, 0, 0];
function update(a, dt, opt = {}) {
  const u = a.userData, m = u.motion, R = u.rig; if (!R) return;
  m.t += dt; const b = beatInfo();
  if (u.moving) u.walkPh += dt * (opt.speed || 1) * 9;
  const baseName = u.seated ? (u.talk ? 'sitTalk' : 'sit') : u.moving ? 'walk' : (u.dance && !u.seated ? u.dance : 'idle');
  const p = {}; BASE[baseName](p, m.t, u, b);
  let glass = !!u.holdGlass;
  if (m.g) {
    m.gT += dt; const G = GEST[m.g], w = U.clamp(Math.min(m.gT / .25, (m.gDur - m.gT) / .3), 0, 1);
    const gp = {}; G.f(gp, m.gT, m.gDur);
    for (const k in gp) { if (Array.isArray(gp[k])) { const a0 = p[k] || REST[k] || ZERO; p[k] = [U.lerp(a0[0], gp[k][0], w), U.lerp(a0[1], gp[k][1], w), U.lerp(a0[2], gp[k][2], w)]; } else p[k] = U.lerp(p[k] || 0, gp[k], w); }
    if (G.glass) glass = true;
    if (m.gT >= m.gDur) m.g = null;
  }
  // 시선(lookAt): 걷는 중이 아니면 머리를 대상 쪽으로
  if (u.lookAt && !u.moving) {
    const yw = Math.atan2(u.lookAt.x - a.position.x, u.lookAt.z - a.position.z);
    const rel = U.clamp(((yw - a.rotation.y + PI) % (PI * 2) + PI * 2) % (PI * 2) - PI, -1.1, 1.1);
    const h = p.head || [0, 0, 0]; p.head = [h[0], h[1] * .3 + rel * .6, h[2]]; const n = p.neck || [0, 0, 0]; p.neck = [n[0], rel * .35, n[2]];
  }
  const k = 1 - Math.exp(-dt * 14);
  for (const j of JOINTS) { const tg = p[j] || REST[j] || ZERO, r = R[j].rotation; r.x += (tg[0] - r.x) * k; r.y += (tg[1] - r.y) * k; r.z += (tg[2] - r.z) * k; }
  R.hips.position.y += ((p.hipsY != null ? p.hipsY : u.hipH) - R.hips.position.y) * k;
  R.body.position.y += ((p.bodyY || 0) - R.body.position.y) * k; R.body.position.x += ((p.bodyX || 0) - R.body.position.x) * k;
  // 호흡: 어깨가 아주 미세하게 오르내림
  { const br = Math.sin(m.t * 1.45 + u.seed * 6); if (u.shY == null) { u.shY = R.shL.position.y; } R.shL.position.y = R.shR.position.y = u.shY + .0045 * br; R.torso.rotation.x += .008 * br * k; }
  if (u.skirt) u.skirt.scale.y += ((u.seated ? .45 : 1) - u.skirt.scale.y) * k;
  if (u.glass) u.glass.visible = glass;
  // 얼굴: 표정 만료 · 깜빡임 · 말할 때 입 움직임
  const now = performance.now();
  if (u.exprUntil && now > u.exprUntil) { u.exprUntil = 0; u.expr = u.baseExpr; u.faceDirty = true; }
  u.blinkT -= dt; if (u.blinkT < 0) { u.blink = true; u.blinkEnd = .13; u.blinkT = 2.4 + Math.random() * 3.6; u.faceDirty = true; }
  if (u.blink) { u.blinkEnd -= dt; if (u.blinkEnd < 0) { u.blink = false; u.faceDirty = true; } }
  const talking = now < u.talkUntil;
  if (talking) { u.mouthT -= dt; if (u.mouthT < 0) { u.mouthT = .07 + Math.random() * .08; u.mouthOpen = Math.random() < .2 ? 0 : .25 + Math.random() * .75; u.faceDirty = true; } } else if (u.mouthOpen) { u.mouthOpen = 0; u.faceDirty = true; }
  // 시선 도약(사카드): 1~4초마다 눈동자가 살짝 이동, 바라보는 대상이 있으면 그쪽으로
  if (u.gaze && opt.near !== false) { u.gazeT -= dt; if (u.gazeT < 0) { u.gazeT = 1 + Math.random() * 3;
      if (u.lookAt && !u.moving) { const yw = Math.atan2(u.lookAt.x - a.position.x, u.lookAt.z - a.position.z), rel = ((yw - a.rotation.y + PI) % (PI * 2) + PI * 2) % (PI * 2) - PI; u.gaze = [U.clamp(rel * .5, -.8, .8) + (Math.random() - .5) * .2, (Math.random() - .5) * .3]; }
      else u.gaze = [(Math.random() - .5) * 1.1, (Math.random() - .5) * .5]; u.faceDirty = true; } }
  if (u.faceDirty && (opt.near !== false || talking)) u.redraw();
}

NC.Motion = { update, play, trigger, TRIGGERS, EMOTION_TRIGGER, GEST: Object.keys(GEST), BASE: Object.keys(BASE) };
// 기존 API 호환
NC.seatAvatar = (a, x, z, ry, h = .5) => { a.position.set(x, 0, z); a.rotation.y = ry; const u = a.userData; u.seated = true; u.moving = false; u.dance = null; u.seatH = h; };
NC.unseatAvatar = (a, x, z) => { const u = a.userData; u.seated = false; u.talk = false; if (x != null) a.position.set(x, 0, z); };
})();
