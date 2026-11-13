/* face.js — v42 새 3D 얼굴 생성 시스템 (예전 "구 + 그려 넣은 얼굴 텍스처" 를 완전히 대체)
 *
 *  ■ 지오메트리: 얼굴 쪽에 정점을 몰아 둔 자체 파라메트릭 격자(눈·코·입 주변 고밀도)를 해부학 변위장으로 조각
 *     두개골·이마 경사·관자놀이·눈썹뼈·안와(눈구멍)·콧대/코끝/콧방울/콧구멍·인중·윗입술/아랫입술·입꼬리·광대·볼살·팔자주름·
 *     눈밑 골·턱끝·턱각·나이에 따른 처짐(볼·턱선) · 좌우 비대칭
 *  ■ 입: 격자를 입술선에서 실제로 끊어(위/아래 정점 분리) 턱이 벌어지면 진짜로 열림 → 안쪽 구강·윗니·아랫니·혀
 *  ■ 눈: 진짜 안구(공막·홍채 섬유·동공 텍스처) + 각막(클리어코트 반사) + 위/아래 눈꺼풀 메시(깜빡임·찡그림·놀람) + 속눈썹
 *  ■ 털: 눈썹 = 한 올씩 카드(안쪽은 위로, 바깥은 옆으로 결) · 수염 = 짧은 털 카드(콧수염·염소수염·턱수염) · 면도 자국은 피부 텍스처
 *  ■ 표정 리그: 모프 타깃(턱 벌림·미소 좌/우·찌푸림·입 오므림·입 벌려 당김·눈썹 올림/안쪽 올림/내림·볼 올림·코 찡그림)
 *     눈썹·수염 카드도 같은 모프로 함께 움직임(턱 벌리면 턱수염도 내려감)
 *  ■ 피부: 얼굴마다 생성하는 알베도(혈색·색소·입술·면도자국·주근깨/점/검버섯) + 노멀(모공·나이 주름: 이마·미간·눈가·팔자·입술 세로주름)
 *     + 부위별 거칠기(T존 번들·볼 매트·입술 촉촉) + 기존 피하산란(SSS) 셰이더
 *  ■ 정체성: look.face(캐릭터 생성기 값) + 인종 범위 + 나이 + 시드 → 40여 개 얼굴 파라미터. 이미 보이는 얼굴과 너무 비슷하면 다시 뽑음(중복 방지)
 *  ■ 애니메이션: 시선 대상(대화 상대·춤 파트너·근처 사람·무대·두리번) 고정 + 도약안구운동(사카드) + 깜빡임 + 표정 + 말하기 입모양 + 미세표정
 *  ■ LOD: 근거리 고해상(격자 150×116 · 텍스처 1024) / 기본(108×84 · 512) / 모바일·저사양(72×56 · 256) · 멀면 애니메이션 간헐 갱신
 *  ?legacyface 로 예전 얼굴 비교 가능
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const T = NC.THREE, U = NC.util;
const ON = !/[?&]legacyface/.test(location.search);
const LOWQ = !!(NC.isMobile || (NC.quality && NC.quality.level === 'low'));
const PI = Math.PI, gau = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (s * s)), E2 = (a, b, a0, b0, sa, sb) => Math.exp(-(((a - a0) / sa) ** 2) - (((b - b0) / sb) ** 2));
const sst = (e0, e1, x) => { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const gR = r => Math.max(-2.2, Math.min(2.2, (r() + r() + r() + r() - 2) * 1.73));
const Face = NC.Face = { on: ON, list: [], stats: { built: 0, ms: 0, reroll: 0 } };

/* ═════ 1. 얼굴 정체성(Identity) ═════ */
const LIVE = [];   // 최근 만든 얼굴 벡터(중복 방지)
const VK = ['fw', 'fl', 'jaw', 'jawS', 'chin', 'chinW', 'cheek', 'cheekF', 'ridge', 'socket', 'eyeS', 'eyeGap', 'tilt', 'noseL', 'noseW', 'bridge', 'tipUp', 'noseProj', 'mouthW', 'lipU', 'lipL', 'philtrum', 'fh'];
function identity(look, bump = 0) {
  const F = look.face || {}, f = look.gender === 'f';
  const seed = (U.hash([look.ethnic, look.gender, look.age, F.eyeSize, F.nose, F.faceW, F.jaw, F.lipFull, F.bridge, F.noseW, look.skin, look.hairStyle].join('|')) + ((F.fid || 0) + bump) * 7919) >>> 0;
  const r = U.rng(seed), g = () => gR(r);
  const age = U.clamp(look.age || 28, 18, 78), A = U.clamp((age - 25) / 35, 0, 1);
  const soft = look.body === 'plus' || look.body === 'soft';
  const P = {
    f, age, A, seed,
    fw: (F.faceW || 1) * (1 + .028 * g()), fl: 1 + .035 * g() + (f ? -.012 : .014),
    jaw: (F.jaw || 1) * (1 + .035 * g()), jawS: U.clamp(.5 + .24 * g() + (f ? -.22 : .16), 0, 1),
    chin: (F.chin || 1) * (1 + .09 * g()), chinW: 1 + .1 * g() + (f ? -.07 : .07), chinL: 1 + .09 * g(),
    cheek: (F.cheek || 1) * (1 + .06 * g()), cheekF: U.clamp(1 + .16 * g() - .28 * A + (soft ? .22 : 0), .5, 1.5),
    fh: 1 + .06 * g(), fslope: U.clamp(.5 + .25 * g() + (f ? .15 : -.12), 0, 1),
    ridge: (F.ridge || 1) * (1 + .08 * g()) * (f ? .8 : 1), socket: (F.socket || 1) * (1 + .06 * g()),
    eyeS: U.clamp((F.eyeSize || 1) * (1 + .03 * g()), .85, 1.15), eyeGap: (F.eyeGap || 0) * .5 + .005 * g(), tilt: U.clamp((F.eyeTilt || 0) + .02 * g(), -.12, .14),
    fold: F.lid ? 1 : 0, epi: F.epi || 0, eyeOpen: U.clamp(F.eyeOpen || 1, .7, 1.15), hood: U.clamp(.18 + .18 * g() + .55 * A + (F.lid ? 0 : .15), 0, 1),
    noseL: (F.nose || 1) * (1 + .05 * g()), noseW: (F.noseW || 1) * (1 + .04 * g()), bridge: (F.bridge || 1) * (1 + .06 * g()), tipUp: U.clamp(.25 * g() + (f ? .15 : -.05), -.5, .6),
    noseProj: U.clamp((F.nose || 1) * (.75 + .25 * (F.bridge || 1)) * (1 + .05 * g()), .7, 1.4), alar: 1 + .1 * g(), hump: U.clamp(.15 * g() + (f ? -.08 : .05), -.2, .35),
    mouthW: (F.lipW || 1) * (1 + .03 * g()), lipU: (F.lipFull || 1) * (1 + .08 * g()) * (1 - .28 * A), lipL: (F.lipFull || 1) * (1 + .08 * g()) * (1 - .2 * A), lipP: F.prog || 1, philtrum: 1 + .2 * g(), bow: U.clamp(.5 + .25 * g(), 0, 1),
    earS: 1 + .07 * g(), earA: .12 * g(), brow: { thick: F.browThick || 1, tilt: F.browTilt || 0, arch: F.browArch ?? .5, gap: .01 * g() },
    asym: { eyeY: (F.asym && F.asym.eyeY) || 0, eyeS: (F.asym && F.asym.eyeS) || 0, browY: (F.asym && F.asym.browY) || 0, mouth: (F.asym && F.asym.mouth) || 0, nose: (F.asym && F.asym.nose) || 0, jaw: (F.asym && F.asym.jaw) || 0 },
    beard: F.beard || null, shadow: !f && r() < .45, freckles: !!F.freckles, mole: F.mole, eyeColor: F.eyeColor || '#3a2416', lipColor: F.lipColor, lipstick: f ? U.clamp((F.liner || 0) * .55 + (F.stage ? .4 : 0), 0, .8) : 0,
    skin: look.skin || '#e8c0a0', blush: F.blush || 0, liner: f ? (F.liner || 0) : 0, hairColor: look.hairColor || '#241812', eth: look.ethnic || 'east', spots: A > .55 ? r() * A : 0, rough: r(),
  };
  return P;
}
function vec(P) { return VK.map(k => P[k]); }
function uniqueIdentity(look) {
  const F = look.face || (look.face = {});
  let P = identity(look), tries = 0;
  const near = v => LIVE.some(w => { let d = 0; for (let i = 0; i < v.length; i++) d += (v[i] - w[i]) ** 2; return Math.sqrt(d) < .055; });
  while (near(vec(P)) && tries < 4) { tries++; Face.stats.reroll++; P = identity(look, tries); }
  if (tries) F.fid = (F.fid || 0) + tries;   // 같은 캐릭터는 다음에도 같은 얼굴
  LIVE.push(vec(P)); if (LIVE.length > 400) LIVE.shift();
  return P;
}
Face.identity = identity;

/* ═════ 2. 랜드마크 · 변위장 ═════ */
function marks(P) {
  const tipB = .222 + .034 * (P.noseL - 1) - .012 * P.tipUp, mouthB = tipB + .2 + .018 * (P.fl - 1);
  return { EX: .3 + P.eyeGap, EY: .052, tipB, mouthB, mw: .185 * P.mouthW, chinB: .835 + .045 * (P.chinL - 1), nw: P.noseW };
}
/* 반지름 비율 변위 d (a=방위각 0=정면, b=아래로 + 고도) */
function field(a, b, P, L) {
  const ca = Math.cos(a), front = Math.max(0, ca), aa = Math.abs(a), s = a >= 0 ? 1 : -1, { EX, EY, tipB, mouthB, mw, chinB, nw } = L;
  let d = 0;
  if (aa > 1.9) return -.045 * gau(aa, PI, .65) * (1 - front) - .024 * gau(aa, .95, .17) * gau(b, -.36, .22);   // 뒤통수: 얼굴 항목 계산 생략(빠르게)
  // 두개골 · 이마
  d -= .016 * (1 - P.fslope) * gau(b, -.6, .25) * front * front;
  d -= .045 * gau(aa, PI, .65) * (1 - front);                                                          // 뒤통수 정리
  d -= .024 * gau(aa, .95, .17) * gau(b, -.36, .22);                                                   // 관자놀이
  d += .03 * P.ridge * gau(b, -.205, .072) * gau(a, 0, .55) * front;                                   // 눈썹뼈
  d += .008 * P.ridge * gau(a, 0, .1) * gau(b, -.14, .05);                                             // 미간
  d -= .012 * gau(a, 0, .1) * gau(b, -.095, .045) * (1.4 - P.bridge * .4);                            // 코뿌리(나시온)
  // 안와(눈구멍) + 쌍꺼풀 주름 + 처진 눈두덩 + 몽고주름
  for (const sd of [-1, 1]) { const ey = EY + sd * P.asym.eyeY, k = 1 + sd * P.asym.eyeS, ex = sd * EX;
    d -= .035 * P.socket * k * E2(a, b, ex, ey + .005, .16 * P.eyeS, .1 * P.eyeS);
    d -= .006 * P.fold * E2(a, b, ex, ey - .075 * P.eyeS, .11, .011);
    d += .007 * P.hood * E2(a, b, ex + sd * .03, ey - .088, .13, .028);
    d += .006 * P.epi * E2(a, b, sd * (EX - .115), ey + .006, .03, .03);
    d -= (.004 + .009 * P.A) * E2(a, b, ex - sd * .02, ey + .118, .12, .026);                      // 눈밑 골
    d += .007 * P.A * E2(a, b, ex, ey + .095, .1, .02); }                                             // 눈밑 지방
  // 코
  const ns = P.asym.nose * .6, an = a - ns;
  d += .07 * P.bridge * gau(an, 0, .07) * sst(-.11, .03, b) * (1 - sst(tipB - .02, tipB + .05, b));   // 콧대
  d += .012 * P.hump * gau(an, 0, .06) * gau(b, .06, .05);                                             // 콧등 굴곡(매부리)
  d += .16 * P.noseProj * gau(an, 0, .046 + .024 * nw) * sst(-.05, tipB, b) * (1 - sst(tipB, tipB + .07, b));   // 코 돌출(코끝 쪽으로 높아짐)
  d += .03 * nw * gau(an, 0, .052 * nw) * gau(b, tipB, .038);                                           // 코끝 볼
  for (const sd of [-1, 1]) { d += .03 * P.alar * gau(an, sd * .088 * nw, .043) * gau(b, tipB + .035, .034);   // 콧방울
    d -= .011 * gau(an, sd * .14 * nw, .02) * gau(b, tipB + .028, .05);                                // 콧방울 고랑
    d -= .024 * gau(an, sd * .042 * nw, .02) * gau(b, tipB + .058, .015); }                            // 콧구멍
  // 인중
  d -= .006 * P.philtrum * gau(a, 0, .02) * gau(b, tipB + .11, .045);
  for (const sd of [-1, 1]) d += .0035 * P.philtrum * gau(a, sd * .035, .012) * gau(b, tipB + .11, .045);
  // 입술
  const mb = mouthB + P.asym.mouth * a * 2, Lw = Math.max(0, 1 - (a / mw) ** 2), Lw2 = Math.sqrt(Lw);
  d += .024 * P.lipU * P.lipP * Lw2 * gau(b, mb - .019, .015) * (1 + .25 * P.bow * gau(a, 0, .06));
  d += .028 * P.lipL * P.lipP * Lw2 * gau(b, mb + .026, .019);
  d -= .007 * Math.max(0, 1 - (a / (mw * 1.05)) ** 2) * gau(b, mb, .006);                              // 입술 사이 골
  for (const sd of [-1, 1]) d -= .011 * gau(a, sd * mw, .028) * gau(b, mb, .03);                       // 입꼬리
  d -= .013 * gau(b, mb + .12, .03) * gau(a, 0, .2);                                                    // 아랫입술 아래 골
  // 턱끝 · 턱각
  d += .046 * P.chin * gau(a, 0, .17 * P.chinW) * gau(b, chinB, .09);
  for (const sd of [-1, 1]) d += .022 * P.jawS * (1 + sd * P.asym.jaw) * gau(a, sd * 1.05, .18) * gau(b, .74, .1);
  // 광대 · 볼
  for (const sd of [-1, 1]) { d += .025 * P.cheek * gau(a, sd * .6, .2) * gau(b, .15, .11);
    d -= .024 * (1.35 - P.cheekF) * gau(a, sd * .66, .18) * gau(b, .5, .14);
    d += .011 * P.cheekF * gau(a, sd * .44, .2) * gau(b, .36, .14);
    d += .013 * P.A * gau(a, sd * .56, .14) * gau(b, .77, .08); }                                     // 처진 볼(나이)
  // 팔자 주름 (콧방울 옆 → 입꼬리 바깥)
  { const ax = .12 * nw + .03, bx = tipB + .035, cx = mw * 1.06, cy = mb + .03; const nl = .004 + .013 * P.A + .005 * P.cheekF;
    for (const sd of [-1, 1]) { const px = sd * a, t = U.clamp(((px - ax) * (cx - ax) + (b - bx) * (cy - bx)) / ((cx - ax) ** 2 + (cy - bx) ** 2), 0, 1), dx = px - (ax + (cx - ax) * t), dy = b - (bx + (cy - bx) * t), dist = Math.hypot(dx, dy);
      if (px > 0) { d -= nl * gau(dist, 0, .016); d += .005 * (P.cheekF + P.A) * gau(dist, .03, .022) * (dx > 0 ? 1 : 0); } } }
  return d;
}

/* ═════ 3. 자체 격자(얼굴 고밀도) ═════ */
function samples(n, lo, hi, dens) { const M = 2000, cdf = [0]; for (let i = 1; i <= M; i++) { const x = lo + (hi - lo) * (i - .5) / M; cdf.push(cdf[i - 1] + dens(x)); } const tot = cdf[M], o = [];
  for (let k = 0; k < n; k++) { const tgt = tot * k / (n - 1); let j = 0; while (j < M && cdf[j + 1] < tgt) j++; const f = cdf[j + 1] > cdf[j] ? (tgt - cdf[j]) / (cdf[j + 1] - cdf[j]) : 0; o.push(lo + (hi - lo) * (j + f) / M); } o[0] = lo; o[n - 1] = hi; return o; }
const RES = { hi: [150, 116], mid: [108, 84], low: [72, 56] };

/* 모프(표정) 변위 — 모두 두개골 좌표(정면 +Z, 위 +Y, 아바타 왼쪽 +X) */
const MORPHS = ['jawOpen', 'smileL', 'smileR', 'frown', 'pucker', 'stretch', 'browUp', 'browInner', 'browDown', 'cheekUp', 'sneer'];
function morphDelta(k, p, a, b, P, L, r, out) {
  out.set(0, 0, 0); if (Math.abs(a) > 1.45 || b < -.75 || b > 1.5) return out;   // 표정은 얼굴 앞쪽만
  const { EX, EY, tipB, mouthB, mw, nw } = L; const sc = r / .115;
  switch (k) {
    case 0: { const m = sst(mouthB - .002, mouthB + .014, b) * (1 - sst(1.0, 1.32, Math.abs(a))) * (1 - .55 * sst(1.05, 1.5, b)); if (m <= 0) return out;   // 턱 경첩(귀 앞) 기준 회전
      const th = .3, hy = -.012 * sc, hz = -.01 * sc, y = p.y - hy, z = p.z - hz, c = Math.cos(th), s = Math.sin(th); out.set(0, (y * c - z * s - y) * m, (y * s + z * c - z) * m * .55); return out; }
    case 1: case 2: { const sd = k === 1 ? 1 : -1, w = E2(a, b, sd * mw, mouthB, .075, .055), w2 = E2(a, b, sd * .45, .3, .17, .13), w3 = E2(a, b, sd * EX, EY + .1, .12, .04);
      out.set(sd * .0036 * w, .0046 * w + .0032 * w2 + .0016 * w3, -.0014 * w + .0022 * w2 + .001 * w3).multiplyScalar(sc); return out; }
    case 3: { let w = 0; for (const sd of [-1, 1]) w += E2(a, b, sd * mw, mouthB + .012, .065, .05); const w2 = E2(a, b, 0, .78, .15, .08); out.set(0, -.0042 * w + .0022 * w2, -.001 * w + .0022 * w2).multiplyScalar(sc); return out; }
    case 4: { const w = E2(a, b, 0, mouthB, mw * .95, .06); out.set(-p.x * .32 * w, 0, .0065 * w * sc); return out; }
    case 5: { const w = Math.max(E2(a, b, mw, mouthB, .07, .045), E2(a, b, -mw, mouthB, .07, .045)); out.set(Math.sign(a) * .0042 * w * sc, -.0008 * w * sc, -.0012 * w * sc); return out; }
    case 6: { let w = 0; for (const sd of [-1, 1]) w += E2(a, b, sd * .32, -.24, .3, .1); w += .5 * gau(b, -.45, .2) * gau(a, 0, .5); out.set(0, .0062 * w * sc, .0004 * w * sc); return out; }
    case 7: { let w = 0; for (const sd of [-1, 1]) w += E2(a, b, sd * .13, -.22, .12, .08); out.set(-p.x * .04 * w, .0062 * w * sc, .0008 * w * sc); return out; }
    case 8: { let w = 0; for (const sd of [-1, 1]) w += E2(a, b, sd * .18, -.2, .22, .08); out.set(-p.x * .07 * w, -.0052 * w * sc, .0018 * w * sc); return out; }
    case 9: { let w = 0; for (const sd of [-1, 1]) w += E2(a, b, sd * .43, .2, .18, .12) + .6 * E2(a, b, sd * EX, EY + .095, .12, .035); out.set(0, .0042 * w * sc, .0018 * w * sc); return out; }
    case 10: { let w = 0; for (const sd of [-1, 1]) w += E2(a, b, sd * .088 * nw, tipB + .03, .07, .05); w += .4 * E2(a, b, 0, -.1, .12, .06); out.set(0, .0032 * w * sc, .0006 * w * sc); return out; }
  }
  return out;
}

/* 안구 중심: 눈구멍을 파기 전의 매끈한 얼굴 표면에서 안구 반지름만큼 안쪽(머리 공간, 두개골 비균등 스케일 반영) */
function eyeCenters(P, L, r, SS) {
  const re = .0122 * P.eyeS, o = [];
  for (const sd of [-1, 1]) { const a = sd * L.EX, b = L.EY + sd * P.asym.eyeY, cb = Math.cos(b), n = new T.Vector3(Math.sin(a) * cb, -Math.sin(b), Math.cos(a) * cb);
    const d = field(a, b, P, L) + .035 * P.socket, p = n.clone().multiplyScalar(r * (1 + d)), ph = new T.Vector3(p.x * SS.x, p.y * SS.y, p.z * SS.z), nh = new T.Vector3(n.x / SS.x, n.y / SS.y, n.z / SS.z).normalize();
    const C = ph.addScaledVector(nh, -re * 1.32), tl = sd * P.tilt * .9;
    o.push({ sd, a, b, C, re, wa: .108 * P.eyeS * (1 + .06 * (P.eyeOpen - 1)), wb: .052 * P.eyeS * P.eyeOpen, c: Math.cos(tl), s: Math.sin(-tl) }); }
  return o;
}
function buildHead(P, L, r, lod, hairCol) {
  const [NA, NB] = RES[lod], t0 = performance.now();
  const As = samples(NA, -PI, PI, x => 1 + 2.8 * gau(x, 0, .52) + 1.2 * gau(Math.abs(x), 1.45, .2));   // 정면·귀 쪽 고밀도
  const Bs = samples(NB, -PI / 2, PI / 2, x => .55 + 2.6 * gau(x, .3, .5) + 3.2 * gau(x, L.mouthB, .05) + 1.2 * gau(x, L.EY, .08));
  // 입술선: 가장 가까운 행을 정확히 입술선으로 맞춤
  let jm = 0; for (let j = 1; j < NB; j++) if (Math.abs(Bs[j] - L.mouthB) < Math.abs(Bs[jm] - L.mouthB)) jm = j; Bs[jm] = L.mouthB;
  const pos = [], uv = [], AB = [], idx = [], V = new T.Vector3(), N = new T.Vector3(), id = (i, j) => j * NA + i, V1h = new T.Vector3();
  const SS = new T.Vector3(.86 * P.fw, 1.03 * P.fl, .98), EYE = eyeCenters(P, L, r, SS);
  for (let j = 0; j < NB; j++) for (let i = 0; i < NA; i++) {
    const a = As[i], b = Bs[j], cb = Math.cos(b); N.set(Math.sin(a) * cb, -Math.sin(b), Math.cos(a) * cb);
    let d = field(a, b, P, L); V.copy(N).multiplyScalar(r * (1 + d));
    if (b > .3) V.x *= 1 - (P.f ? .2 : .14) * (2.2 - 1.2 * P.jaw) * sst(.3, 1.1, b) * (.4 + .6 * Math.max(0, Math.cos(a)));   // 턱선(각진 ↔ 갸름)
    if (b > -.05 && b < .45) V.x *= 1 + .05 * (P.cheek - 1) * Math.max(0, Math.cos(a)) * gau(b, .2, .2);
    if (b > .35) V.z += r * .03 * Math.max(0, Math.cos(a)) * sst(.35, .85, b);
    if (b > 1.18) V.multiplyScalar(1 - .22 * sst(1.18, 1.57, b));                                     // 아래는 목 안으로
    for (const E of EYE) { const da = a - E.a, db = b - E.b, ra = da * E.c + db * E.s, rb = -da * E.s + db * E.c, q = Math.hypot(ra / E.wa, rb / E.wb); if (q > 1.6) continue;   // 눈구멍: 안구를 감싸고, 눈 틈 안쪽 피부는 안구 뒤로 숨김
      const Vh = V1h.set(V.x * SS.x, V.y * SS.y, V.z * SS.z).sub(E.C), dl = Vh.length(), want = q < 1 ? E.re * .78 : E.re * (1.1 + .5 * sst(1, 1.6, q) * 0), t = q < 1 ? 1 : 1 - sst(1.0, 1.6, q);
      if (q >= 1 && dl > want && t < 1e-3) continue; const nl = q < 1 ? want : Math.max(dl, want) * t + dl * (1 - t); Vh.multiplyScalar(nl / (dl || 1)).add(E.C); V.set(Vh.x / SS.x, Vh.y / SS.y, Vh.z / SS.z); }
    pos.push(V.x, V.y, V.z); uv.push((a + PI) / (2 * PI), 1 - (b + PI / 2) / PI); AB.push(a, b);
  }
  // 입 절개: 입술선 행에서 |a|<mw 인 정점을 복제(아래쪽 면이 복제본 사용)
  const dup = new Map(); for (let i = 0; i < NA; i++) { const a = As[i]; if (Math.abs(a) < L.mw * .97) { const k = pos.length / 3; pos.push(pos[id(i, jm) * 3], pos[id(i, jm) * 3 + 1], pos[id(i, jm) * 3 + 2]); uv.push(uv[id(i, jm) * 2], uv[id(i, jm) * 2 + 1]); AB.push(a, L.mouthB + 1e-4); dup.set(i, k); } }
  for (let j = 0; j < NB - 1; j++) for (let i = 0; i < NA - 1; i++) {
    let a0 = id(i, j), a1 = id(i + 1, j); const b0 = id(i, j + 1), b1 = id(i + 1, j + 1);
    if (j === jm) { if (dup.has(i)) a0 = dup.get(i); if (dup.has(i + 1)) a1 = dup.get(i + 1); }
    idx.push(a0, b0, a1, a1, b0, b1);
  }
  const nSkin = pos.length / 3;
  // 입술 안쪽 말림: 절개선의 위·아래 정점을 살짝 안으로
  for (let i = 0; i < NA; i++) if (dup.has(i)) { const lip = 1 - (As[i] / L.mw) ** 2; for (const k of [id(i, jm), dup.get(i)]) { V.fromArray(pos, k * 3); V.multiplyScalar(1 - .004 * lip); V.toArray(pos, k * 3); } }
  /* 털 카드(눈썹 · 수염) — 피부 표면 위에 뿌리, 같은 모프 사용 */
  const cards = [], cardRoot = [];   // cardRoot: 카드 정점마다 [a,b, rootIndex]
  const surf = (a, b) => { const cb = Math.cos(b); N.set(Math.sin(a) * cb, -Math.sin(b), Math.cos(a) * cb); const d = field(a, b, P, L); const p = N.clone().multiplyScalar(r * (1 + d));
    if (b > .3) p.x *= 1 - (P.f ? .2 : .14) * (2.2 - 1.2 * P.jaw) * sst(.3, 1.1, b) * (.4 + .6 * Math.max(0, Math.cos(a))); if (b > -.05 && b < .45) p.x *= 1 + .05 * (P.cheek - 1) * Math.max(0, Math.cos(a)) * gau(b, .2, .2); if (b > .35) p.z += r * .03 * Math.max(0, Math.cos(a)) * sst(.35, .85, b); return { p, n: N.clone() }; };
  const rr = U.rng(P.seed ^ 0x5bd1);
  const card = (a, b, dirA, dirB, len, w, lift, grp) => {   // dir: (a,b) 공간에서 털 결 방향
    const S0 = surf(a, b), S1 = surf(a + dirA * .01, b + dirB * .01), tg = S1.p.clone().sub(S0.p).normalize(), nm = S0.p.clone().normalize(), sd = new T.Vector3().crossVectors(nm, tg).normalize();
    const R = S0.p.clone().addScaledVector(nm, .0005), tip = R.clone().addScaledVector(tg, len).addScaledVector(nm, len * lift), k = pos.length / 3;
    [R.clone().addScaledVector(sd, w / 2), R.clone().addScaledVector(sd, -w / 2), tip.clone().addScaledVector(sd, w * .15), tip.clone().addScaledVector(sd, -w * .15)].forEach(q => { pos.push(q.x, q.y, q.z); uv.push(0, 0); AB.push(a, b); });
    cards.push(grp, k, k + 2, k + 1, k + 1, k + 2, k + 3);
  };
  // 눈썹: 안쪽(머리)은 위로, 몸통·꼬리는 바깥 옆으로 눕는 결 · 두께는 꼬리로 갈수록 가늘게
  const nBrow = Math.round((P.f ? 70 : 110) * (lod === 'low' ? .45 : lod === 'mid' ? .8 : 1) * U.clamp(P.brow.thick, .6, 1.6));
  for (const sd of [-1, 1]) for (let h = 0; h < nBrow; h++) { const t = rr(), ex = L.EX, a = sd * (ex - .12 + P.brow.gap + .29 * t), arch = (.5 + P.brow.arch) * .028 * Math.sin(PI * Math.min(1, t * 1.15)),
      bc = L.EY - .158 - arch + (P.brow.tilt + P.asym.browY * 4) * (t - .4) * .05 + sd * P.asym.browY, th = (P.f ? .011 : .017) * U.clamp(P.brow.thick, .6, 1.7) * (1 - .55 * t * t), b = bc + (rr() - .5) * th * 2;
    const up = t < .14 ? 1 - t / .14 : 0, dA = sd * (1 - up * .8), dB = -(.35 + up * .9) + (b - bc) / th * .25; card(a, b, dA, dB, (P.f ? .006 : .0085) * (.75 + rr() * .5), P.f ? .0009 : .0011, .18, 1); }
  // 수염
  const bt = P.beard, isBeard = !P.f && (bt === 'full' || bt === 'goatee' || bt === 'mustache');
  if (isBeard) { const nB = Math.round((bt === 'full' ? 950 : bt === 'goatee' ? 420 : 240) * (lod === 'low' ? .35 : lod === 'mid' ? .7 : 1)), { tipB, mouthB, mw } = L;
    const inMask = (a, b) => { const aa = Math.abs(a), lips = Math.abs(b - mouthB) < .055 && aa < mw * 1.02, must = b > tipB + .065 && b < mouthB - .03 && aa < mw * 1.15, chin = b > mouthB + .06 && b < 1.0 && aa < .32, jawl = b > mouthB - .12 && b < 1.12 && aa < 1.25 && !(b < .35 && aa < .5);
      if (lips) return false; return bt === 'mustache' ? must : bt === 'goatee' ? (must || (chin && aa < .24) || (aa > mw * .8 && aa < mw * 1.2 && b > mouthB - .03 && b < mouthB + .08)) : (must || chin || jawl); };
    let made = 0, guard = 0; while (made < nB && guard++ < nB * 12) { const a = (rr() - .5) * 2.6, b = .15 + rr() * 1.0; if (!inMask(a, b)) continue;
      const must = b < L.mouthB; card(a, b, must ? Math.sign(a) * .55 : Math.sign(a) * .15, must ? .85 : 1, (bt === 'full' ? .007 : .0055) * (.7 + rr() * .6), .0012, .32, 2); made++; } }
  // 지오메트리
  const g = new T.BufferGeometry(); const all = idx.concat(); const cardIdx = [[], [], []]; for (let i = 0; i < cards.length; i += 7) cardIdx[cards[i]].push(cards[i + 1], cards[i + 2], cards[i + 3], cards[i + 4], cards[i + 5], cards[i + 6]);
  const iSkin = all.length; all.push(...cardIdx[1]); const iBrow = all.length; all.push(...cardIdx[2]); const iBeard = all.length;
  g.setIndex(all); g.addGroup(0, iSkin, 0); g.addGroup(iSkin, iBrow - iSkin, 1); if (iBeard > iBrow) g.addGroup(iBrow, iBeard - iBrow, 2);
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  // 털 카드 정점은 뿌리(a,b)의 모프 변위를 그대로 → 피부와 함께 움직임
  const nV = pos.length / 3, D = new T.Vector3(), Pp = new T.Vector3(), cache = new Map();
  g.morphAttributes.position = MORPHS.map((name, k) => { const arr = new Float32Array(nV * 3);
    for (let v = 0; v < nV; v++) { const a = AB[v * 2], b = AB[v * 2 + 1]; let key = null; if (v >= nSkin) { key = k + ':' + a.toFixed(5) + ':' + b.toFixed(5); const c = cache.get(key); if (c) { arr[v * 3] = c[0]; arr[v * 3 + 1] = c[1]; arr[v * 3 + 2] = c[2]; continue; } Pp.copy(surf(a, b).p); } else Pp.fromArray(pos, v * 3);
      morphDelta(k, Pp, a, b, P, L, r, D); arr[v * 3] = D.x; arr[v * 3 + 1] = D.y; arr[v * 3 + 2] = D.z; if (key) cache.set(key, [D.x, D.y, D.z]); }
    const at = new T.Float32BufferAttribute(arr, 3); at.name = name; return at; });
  g.morphTargetsRelative = true;   // 모프는 '변위'(r128 기본값은 절대 위치 → 얼굴이 쪼그라들던 원인)
  g.computeBoundingSphere(); g.boundingSphere.radius *= 1.15;
  Face.stats.ms += performance.now() - t0;
  return { g, surf, nSkin, jm, EYE };
}

/* ═════ 4. 피부 텍스처(알베도 · 노멀 · 거칠기) — 얼굴마다 1회 생성, 정체성 캐시 ═════ */
const TEX = new Map(), TQ = [];
Face.queue = TQ;
function hexRGB(h) { const c = new T.Color(h); return [c.r, c.g, c.b]; }
function vnoise(seed) { const r = U.rng(seed), G = 64, tab = new Float32Array(G * G); for (let i = 0; i < tab.length; i++) tab[i] = r();
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t * t * (3 - 2 * t), at = (i, j) => tab[((j & (G - 1)) * G) + (i & (G - 1))];
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1); return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf); }; }
function skinTextures(P, L, W) {
  const key = P.seed + ':' + W; if (TEX.has(key)) return TEX.get(key);
  const H = W / 2, n1 = vnoise(P.seed), n2 = vnoise(P.seed + 17), n3 = vnoise(P.seed + 33), rr = U.rng(P.seed + 99);
  const base = hexRGB(NC.Avatar && NC.Avatar.realSkin ? NC.Avatar.realSkin(P.skin) : P.skin), lum = base[0] * .3 + base[1] * .59 + base[2] * .11, DK = lum < .42;
  const lipN = [base[0] * .86, base[1] * .54, base[2] * .55].map((v, i) => P.lipColor ? v * .7 + hexRGB(P.lipColor)[i] * .3 : v), hairC = hexRGB(P.hairColor);
  const alb = new Uint8ClampedArray(W * H * 4), hgt = new Float32Array(W * H), rgh = new Uint8ClampedArray(W * H * 4);
  const { EX, EY, tipB, mouthB, mw } = L, freck = P.freckles ? Array.from({ length: 70 }, () => [(rr() - .5) * .9, .05 + rr() * .3, .004 + rr() * .006]) : [];
  const spots = P.spots > .2 ? Array.from({ length: Math.round(P.spots * 14) }, () => [(rr() - .5) * 1.6, -.6 + rr() * 1.2, .01 + rr() * .015]) : [];
  for (let py = 0; py < H; py++) { const b = (py / H) * PI - PI / 2;
    for (let px = 0; px < W; px++) { const a = (px / W) * 2 * PI - PI, o = py * W + px, aa = Math.abs(a);
      let R = base[0], G = base[1], B = base[2], h = 0, ro = .56;
      const mot = (n1(px / W * 40, py / H * 20) - .5) * .07 + (n2(px / W * 140, py / H * 70) - .5) * .035;
      R *= 1 + mot; G *= 1 + mot * 1.1; B *= 1 + mot * 1.15;
      if (aa < 1.4 && b > -1.0 && b < 1.3) {
        // 혈색: 볼 · 코끝 · 귀 · 턱끝
        const red = .14 * (gau(aa, .48, .18) * gau(b, .28, .14)) + .16 * E2(a, b, 0, tipB, .07, .06) + .08 * gau(aa, 1.48, .12) * gau(b, .06, .2) + .05 * E2(a, b, 0, .84, .15, .08) + P.blush * .25 * gau(aa, .5, .17) * gau(b, .26, .12);
        R += red * (DK ? .04 : .2); G -= red * (DK ? .05 : .1); B -= red * (DK ? .04 : .08);
        // 눈밑 · 눈두덩 그늘
        for (const sd of [-1, 1]) { const ue = E2(a, b, sd * L.EX, L.EY + .1, .12, .035) * (.06 + .1 * P.A), lid = E2(a, b, sd * L.EX, L.EY - .05, .13, .04) * .05; R -= ue * .5 + lid * .3; G -= ue * .6 + lid * .4; B -= ue * .3 + lid * .1;
          if (P.liner > .3) { const sh = E2(a, b, sd * (L.EX + .02), L.EY - .055, .12, .03) * P.liner * .18; R -= sh * .4; G -= sh * .5; B -= sh * .2; } }
        // 입술(입술 경계 · 큐피드 활 · 촉촉한 거칠기)
        const lw = Math.max(0, 1 - (a / (mw * 1.02)) ** 2), up = lw > 0 ? sst(.006, 0, Math.abs(b - (mouthB - .018)) - .016 * Math.sqrt(lw) * (1 + .3 * P.bow * gau(a, 0, .05))) : 0, lo = lw > 0 ? sst(.006, 0, Math.abs(b - (mouthB + .024)) - .022 * Math.sqrt(lw)) : 0, lip = Math.max(up * (b < mouthB ? 1 : 0), lo * (b >= mouthB ? 1 : 0));
        if (lip > 0) { const lc = P.lipstick > 0 ? lipN.map((c, i) => c * (1 - P.lipstick * .4) + [.62, .14, .2][i] * P.lipstick * .4) : lipN; R += (lc[0] - R) * lip * .85; G += (lc[1] - G) * lip * .85; B += (lc[2] - B) * lip * .85; ro = ro + (.34 - ro) * lip; h -= .25 * lip * Math.abs(Math.sin(a * 260)) * (.3 + .7 * P.A); }
        // 콧구멍 · 입 속(절개선)
        for (const sd of [-1, 1]) { const ns = E2(a, b, sd * .042 * L.nw, tipB + .058, .022, .013); R *= 1 - .6 * ns; G *= 1 - .65 * ns; B *= 1 - .6 * ns; }
        const ms = Math.max(0, 1 - (a / mw) ** 2) * gau(b, mouthB, .0035); R *= 1 - .5 * ms; G *= 1 - .6 * ms; B *= 1 - .55 * ms;
        // 면도 자국 · 수염 그늘(남성)
        if (!P.f) { const bm = sst(tipB + .02, tipB + .11, b) * sst(1.2, 1.0, b) * sst(1.25, .95, aa) * (1 - Math.max(0, 1 - (a / (mw * 1.05)) ** 2) * gau(b, mouthB + .005, .05)) * (b < .45 ? sst(tipB + .03, tipB + .12, b) * (aa < .32 ? 1 : sst(.55, .25, aa)) : 1) * sst(1.25, .85, aa) * sst(1.2, 1.0, b);
          const st = bm * (P.beard === 'stubble' ? .4 : P.beard ? .3 : P.shadow ? .15 : .05) * (.6 + .4 * n3(px / W * 300, py / H * 150));
          R += (hairC[0] * .6 + .02 - R) * st * .55; G += (hairC[1] * .6 + .04 - G) * st * .55; B += (hairC[2] * .6 + .08 - B) * st * .5; }
        // 눈썹 밑바탕(털 카드 사이가 비어 보이지 않게)
        for (const sd of [-1, 1]) { const bw = gau(a, sd * (L.EX + .02), .14) * gau(b, L.EY - .165, (P.f ? .009 : .014) * P.brow.thick) * .35; R += (hairC[0] - R) * bw; G += (hairC[1] - G) * bw; B += (hairC[2] - B) * bw; }
        for (const [fa, fb, fr] of freck) { const w = E2(a, b, fa, fb, fr, fr); R -= w * .12; G -= w * .16; B -= w * .14; }
        for (const [fa, fb, fr] of spots) { const w = E2(a, b, fa, fb, fr, fr * .8); R -= w * .07; G -= w * .1; B -= w * .12; }
        if (P.mole) { const w = E2(a, b, P.mole[0] * .9, P.mole[1] * .9 + .1, .006, .006); R -= w * .4; G -= w * .45; B -= w * .4; }
        // 높이(노멀용): 모공(코·볼 크게) + 나이 주름
        const pore = n2(px / W * 900, py / H * 450) - .5, pk = .5 + .9 * E2(a, b, 0, tipB - .04, .12, .14) + .5 * gau(aa, .45, .25) * gau(b, .25, .2);
        h += pore * .5 * pk;
        const A = P.A, fore = gau(b, -.55, .15) * gau(a, 0, .7) * A, glab = E2(a, b, 0, -.16, .05, .05) * A, crow = (gau(aa, L.EX + .17, .05) * gau(b, L.EY, .07)) * A;
        h -= fore * .9 * Math.max(0, Math.sin(b * 70 + n1(px / W * 8, 0) * 3)); h -= glab * .8 * Math.max(0, Math.sin(a * 110)); h -= crow * .7 * Math.max(0, Math.sin(Math.atan2(b - L.EY, aa - L.EX - .14) * 14));
        // 거칠기: T존 번들 · 볼 매트 · 턱
        ro -= .1 * gau(a, 0, .2) * gau(b, -.45, .3) + .12 * E2(a, b, 0, tipB - .05, .06, .14) + .04 * E2(a, b, 0, .84, .15, .1); ro += .05 * gau(aa, .55, .2) * gau(b, .3, .2) + (P.rough - .5) * .06;
      }
      alb[o * 4] = U.clamp(R, 0, 1) * 255; alb[o * 4 + 1] = U.clamp(G, 0, 1) * 255; alb[o * 4 + 2] = U.clamp(B, 0, 1) * 255; alb[o * 4 + 3] = 255;
      hgt[o] = h; const rv = U.clamp(ro, .2, .95) * 255; rgh[o * 4] = rv; rgh[o * 4 + 1] = rv; rgh[o * 4 + 2] = rv; rgh[o * 4 + 3] = 255; } }
  const cv = (data) => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0); return c; };
  const nrm = new Uint8ClampedArray(W * H * 4), S = W / 512 * .8;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = y * W + x, l = hgt[y * W + ((x - 1 + W) % W)], rr2 = hgt[y * W + ((x + 1) % W)], u = hgt[Math.max(0, y - 1) * W + x], d = hgt[Math.min(H - 1, y + 1) * W + x];
    let nx = (l - rr2) * S, ny = (d - u) * S, nz = 1; const len = Math.hypot(nx, ny, nz); nrm[o * 4] = (nx / len * .5 + .5) * 255; nrm[o * 4 + 1] = (ny / len * .5 + .5) * 255; nrm[o * 4 + 2] = (nz / len * .5 + .5) * 255; nrm[o * 4 + 3] = 255; }
  const mk = (c, srgb) => { const t = NC.tex ? NC.tex(c) : new T.CanvasTexture(c); if (!srgb && t.encoding !== undefined) t.encoding = T.LinearEncoding; t.anisotropy = 4; return t; };
  const out = { map: mk(cv(alb), true), normalMap: mk(cv(nrm)), roughnessMap: mk(cv(rgh)) };
  TEX.set(key, out); if (TEX.size > 160) { const k0 = TEX.keys().next().value; TEX.delete(k0); }
  return out;
}

/* ═════ 5. 눈(안구 · 각막 · 눈꺼풀 · 속눈썹) ═════ */
const EYE_TEX = new Map();
function eyeTex(color, hi) {
  const key = color + (hi ? 'h' : 'l'); if (EYE_TEX.has(key)) return EYE_TEX.get(key);
  const W = hi ? 256 : 128, H = W / 2, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = U.rng(U.hash(key));
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#d9cfc8'); gr.addColorStop(.25, '#f4efe9'); gr.addColorStop(.5, '#d6c9c2'); gr.addColorStop(.75, '#c9b8b0'); gr.addColorStop(1, '#d9cfc8'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(170,40,40,.35)'; g.lineWidth = W / 512; for (let i = 0; i < 26; i++) { const sx = W * .25 + (r() < .5 ? -1 : 1) * W * (.09 + r() * .1), sy = H * (.3 + r() * .4); g.beginPath(); g.moveTo(sx, sy); for (let k = 0; k < 4; k++) g.lineTo(sx + (r() - .5) * W * .05 * (k + 1), sy + (r() - .5) * H * .06 * (k + 1)); g.stroke(); }   // 실핏줄
  const cx = W * .25, cy = H * .5, ri = W * .085, base = new T.Color(color), lite = base.clone().lerp(new T.Color('#c8a070'), .35), dark = base.clone().multiplyScalar(.45);
  const ig = g.createRadialGradient(cx, cy, ri * .2, cx, cy, ri); ig.addColorStop(0, '#' + lite.getHexString()); ig.addColorStop(.55, '#' + base.getHexString()); ig.addColorStop(.88, '#' + dark.getHexString()); ig.addColorStop(1, 'rgba(20,14,10,.95)');
  g.fillStyle = ig; g.beginPath(); g.ellipse(cx, cy, ri, ri, 0, 0, 7); g.fill();
  for (let i = 0; i < 90; i++) { const t = r() * 7, l0 = ri * (.3 + r() * .1), l1 = ri * (.75 + r() * .2); g.strokeStyle = r() < .5 ? 'rgba(255,230,190,.18)' : 'rgba(0,0,0,.18)'; g.lineWidth = W / 700; g.beginPath(); g.moveTo(cx + Math.cos(t) * l0, cy + Math.sin(t) * l0); g.lineTo(cx + Math.cos(t + (r() - .5) * .2) * l1, cy + Math.sin(t) * l1); g.stroke(); }   // 홍채 섬유
  g.fillStyle = '#050304'; g.beginPath(); g.ellipse(cx, cy, ri * .36, ri * .36, 0, 0, 7); g.fill();
  const t = NC.tex ? NC.tex(c) : new T.CanvasTexture(c); EYE_TEX.set(key, t); return t;
}
const CORNEA = () => new T.MeshPhysicalMaterial({ color: 0x000000, roughness: .03, metalness: 0, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
const SH = {};
function shared(k, f) { return SH[k] || (SH[k] = f()); }

/* ═════ 6. 조립 ═════ */
Face.build = (o) => {
  const { look, skull, head, r, lod: LOD0, mSkin } = o; if (!ON) return null;
  const lod = LOD0 || (LOWQ ? 'low' : 'mid'), P = uniqueIdentity(look), L = marks(P), hi = lod === 'hi';
  skull.scale.set(.86 * P.fw, 1.03 * P.fl, .98);
  const H = buildHead(P, L, r, lod, P.hairColor), TW = hi ? 1024 : lod === 'low' ? 256 : 512;
  const skinM = new T.MeshStandardMaterial({ color: new T.Color(NC.Avatar && NC.Avatar.realSkin ? NC.Avatar.realSkin(P.skin) : P.skin), roughness: .55, metalness: 0, morphTargets: true });
  const applyTex = () => { const TX = skinTextures(P, L, TW); skinM.map = TX.map; skinM.normalMap = TX.normalMap; skinM.roughnessMap = TX.roughnessMap; skinM.roughness = 1; skinM.color.setRGB(1, 1, 1); skinM.needsUpdate = true; };
  if (hi || TEX.has(P.seed + ':' + TW)) applyTex(); else TQ.push(applyTex);   // 피부 텍스처는 프레임마다 하나씩(생성 순간 끊김 방지)
  skinM.normalScale.set(.4, .4); skinM.emissive = new T.Color(P.skin).multiplyScalar(.01);
  if (NC.Avatar && NC.Avatar.skinCompile) { skinM.onBeforeCompile = NC.Avatar.skinCompile; skinM.customProgramCacheKey = () => 'face42'; }
  const hairM = new T.MeshStandardMaterial({ color: new T.Color(P.hairColor).multiplyScalar(.85), roughness: .75, metalness: 0, side: T.DoubleSide, morphTargets: true });
  const beardM = new T.MeshStandardMaterial({ color: new T.Color(P.hairColor).multiplyScalar(.9), roughness: .8, metalness: 0, side: T.DoubleSide, morphTargets: true });
  const mesh = new T.Mesh(H.g, [skinM, hairM, beardM]); mesh.userData.noMerge = true; mesh.name = 'face42'; skull.add(mesh);
  // 귀 — 귓바퀴 테두리 · 오목한 귓속(콘카) · 귓불
  const earG = shared('ear' + lod, () => { const g = new T.SphereGeometry(1, lod === 'low' ? 14 : 22, lod === 'low' ? 10 : 16), p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const q = Math.hypot(v.y, v.z * 1.1); if (v.x > 0) v.x *= .3 + .7 * sst(.35, .82, q) + .35 * gau(q, .86, .09); else v.x *= .55; if (v.y < -.55) { v.z *= 1.1; v.x *= 1.15; } p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; });
  const ears = [];
  for (const sd of [-1, 1]) { const S0 = H.surf(sd * 1.47, .07), e = new T.Mesh(earG, mSkin); e.position.copy(S0.p).multiplyScalar(.985); const es = P.earS;
    e.scale.set(sd * .0075 * es / skull.scale.x, .025 * es / skull.scale.y, .016 * es / skull.scale.z); e.rotation.set(-.12 - P.earA, sd * -.25, 0); e.userData.noMerge = true; skull.add(e); ears.push(e); }
  // 눈 — head 공간(두개골 비균등 스케일의 영향 없이 둥근 안구)
  const re = .0122 * P.eyeS, eyes = [], eTex = eyeTex(P.eyeColor, lod !== 'low');
  const lidM = new T.MeshStandardMaterial({ color: new T.Color(NC.Avatar && NC.Avatar.realSkin ? NC.Avatar.realSkin(P.skin) : P.skin).multiplyScalar(.93), roughness: .55, metalness: 0 }); if (NC.Avatar && NC.Avatar.skinCompile) { lidM.onBeforeCompile = NC.Avatar.skinCompile; lidM.customProgramCacheKey = () => 'lid42'; }
  if (P.liner > .45) lidM.color.lerp(new T.Color('#5a3a4a'), (P.liner - .45) * .25);
  const eyeM = new T.MeshStandardMaterial({ map: eTex, roughness: .32, metalness: 0 }), seg = lod === 'low' ? [16, 12] : [26, 18];
  const ballG = shared('eb' + lod, () => new T.SphereGeometry(1, seg[0], seg[1])), cornG = shared('co' + lod, () => { const g = new T.SphereGeometry(1, seg[0], 10, 0, PI * 2, 0, .95); g.rotateX(PI / 2); return g; });
  const upG = shared('lu' + lod, () => new T.SphereGeometry(1, seg[0], 10, 0, PI * 2, 0, 1.18)), loG = shared('ll' + lod, () => { const g = new T.SphereGeometry(1, seg[0], 8, 0, PI * 2, 0, 1.02); g.rotateX(PI); return g; });
  const lashM = shared('lashM', () => new T.MeshBasicMaterial({ color: 0x0b0708, side: T.DoubleSide }));
  const lashG = shared('lash' + (P.f ? 'f' : 'm') + lod, () => { const gs = [], n = lod === 'low' ? 10 : P.f ? 22 : 15, len = P.f ? .0095 : .0065;   // 윗눈꺼풀 가장자리(각도 1.18) 앞쪽 반원에 한 올씩
    for (let i = 0; i < n; i++) { const ph = PI * (.12 + .76 * i / (n - 1)), th = 1.18, x = Math.sin(th) * Math.cos(ph), z = Math.sin(th) * Math.sin(ph), y = Math.cos(th); const b = new T.PlaneGeometry(.0006, len); b.translate(0, len / 2, 0); b.rotateX(-1.25 - Math.abs(i / (n - 1) - .5) * .4);
      const m = new T.Matrix4().makeRotationY(-ph + PI / 2); b.applyMatrix4(m); b.translate(x * 1.075, y * 1.075, z * 1.075); gs.push(b); }
    const out = new T.BufferGeometry(); let pos = [], ix = [], off = 0; gs.forEach(g => { const p = g.attributes.position.array; pos.push(...p); g.index.array.forEach(k => ix.push(k + off)); off += p.length / 3; }); out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setIndex(ix); out.computeVertexNormals(); return out; });
  for (const sd of [-1, 1]) {
    const ctr = H.EYE[sd < 0 ? 0 : 1].C.clone().add(skull.position);
    const grp = new T.Group(); grp.position.copy(ctr); grp.rotation.z = sd * P.tilt * .9; head.add(grp);
    const globe = new T.Group(); grp.add(globe); const ball = new T.Mesh(ballG, eyeM); ball.scale.setScalar(re); globe.add(ball);   // 구 UV 의 u=.25 가 +Z(정면) → 홍채가 정면
    const corn = new T.Mesh(cornG, shared('cornM', CORNEA)); corn.scale.setScalar(re * 1.035); corn.renderOrder = 2; globe.add(corn);
    const up = new T.Mesh(upG, lidM); up.scale.setScalar(re * 1.075); grp.add(up); const lash = new T.Mesh(lashG, lashM); lash.scale.setScalar(re); up.add(lash); lash.scale.setScalar(1 / 1.075);
    const lo = new T.Mesh(loG, lidM); lo.scale.setScalar(re * 1.07); grp.add(lo);
    [ball, corn, up, lo, lash].forEach(m => { m.userData.noMerge = true; });
    eyes.push({ grp, globe, up, lo, sd, ctr });
  }
  // 입 속 — 구강 · 윗니 · (턱과 함께) 아랫니 · 혀
  const Ms = H.surf(0, L.mouthB), inn = Ms.n.clone().multiplyScalar(-1), mouth = new T.Group(); skull.add(mouth);
  const cav = new T.Mesh(shared('cav', () => new T.SphereGeometry(1, 14, 10)), shared('cavM', () => new T.MeshStandardMaterial({ color: 0x2a0a0d, roughness: .6 })));
  cav.position.copy(Ms.p).addScaledVector(inn, .042 * r / .115); cav.scale.set(.026 / skull.scale.x, .016 / skull.scale.y, .022); mouth.add(cav);
  const toothM = shared('toothM', () => new T.MeshStandardMaterial({ color: 0xece4d6, roughness: .3, metalness: 0 })), rt = L.mw * r * .92;
  const teethG = shared('teeth' + Math.round(rt * 1000), () => new T.CylinderGeometry(rt, rt * .96, .0075, 18, 1, true, -1.05, 2.1));
  const upT = new T.Mesh(teethG, toothM); upT.position.copy(Ms.p).addScaledVector(inn, .0055 + rt * .98); upT.position.y += .0042; upT.scale.set(1 / skull.scale.x, 1, 1); mouth.add(upT);
  const jaw = new T.Group(), hy = -.012 * r / .115, hz = -.01 * r / .115; jaw.position.set(0, hy, hz); mouth.add(jaw);
  const loT = new T.Mesh(teethG, toothM); loT.position.copy(upT.position).sub(jaw.position); loT.position.y -= .0085; loT.position.addScaledVector(inn, .0015); loT.scale.set(.97 / skull.scale.x, 1, .97); jaw.add(loT);
  const tongue = new T.Mesh(shared('tng', () => new T.SphereGeometry(1, 12, 8)), shared('tngM', () => new T.MeshStandardMaterial({ color: 0xb4545a, roughness: .45 })));
  tongue.position.copy(Ms.p).addScaledVector(inn, .02).sub(jaw.position); tongue.position.y -= .009; tongue.scale.set(.018 / skull.scale.x, .006, .022); jaw.add(tongue);
  [cav, upT, loT, tongue].forEach(m => { m.userData.noMerge = true; });
  mesh.updateMorphTargets();
  const rec = { P, L, mesh, eyes, jaw, ears, mouth, root: null, w: new Float32Array(MORPHS.length), tgt: new Float32Array(MORPHS.length), lidU: 0, lidL: 0, gz: [0, 0], gzT: [0, 0], gazeT: 0, sacT: 0, target: null, tgtKind: '', micro: { t: 2 + Math.random() * 5, k: -1, w: 0 }, vis: 0, frame: Math.floor(Math.random() * 4), restU: .3 - .25 * (P.eyeOpen - 1) + .08 * P.hood, restL: .28 };
  Face.stats.built++;
  return rec;
};

/* ═════ 7. 애니메이션 ═════ */
const EXW = {   // 표정 → 모프 가중치 [jawOpen, smileL, smileR, frown, pucker, stretch, browUp, browInner, browDown, cheekUp, sneer] + 눈꺼풀(위 닫힘 +, 아래 올림 +)
  neutral: { w: [], lu: 0, ll: 0 },
  smile: { w: [0, .55, .55, 0, 0, 0, .1, 0, 0, .35], lu: .04, ll: .12 },
  laugh: { w: [.34, .95, .95, 0, 0, .15, .2, 0, 0, .8], lu: .2, ll: .32 },
  joy: { w: [.14, .85, .85, 0, 0, .1, .25, 0, 0, .65], lu: .12, ll: .25 },
  shy: { w: [0, .28, .22, 0, 0, 0, 0, .35, 0, .2], lu: .18, ll: .08, look: [0, .38] },
  surprised: { w: [.42, 0, 0, 0, .15, 0, .95, .3, 0, 0], lu: -.22, ll: -.04 },
  sad: { w: [0, 0, 0, .6, 0, 0, 0, .85, 0, 0], lu: .22, ll: 0 },
  annoyed: { w: [0, 0, 0, .25, 0, 0, 0, 0, .6, 0, .15], lu: .2, ll: .08 },
  angry: { w: [.05, 0, 0, .4, 0, .1, 0, 0, 1, 0, .35], lu: .05, ll: .15 },
  wink: { w: [0, .25, .5, 0, 0, 0, .1, 0, 0, .3], lu: 0, ll: .08, winkR: true },
  kiss: { w: [0, 0, 0, 0, .85, 0, .1, .2, 0, 0], lu: 1, ll: .1 },
};
const V1 = new T.Vector3(), V2 = new T.Vector3(), Q1 = new T.Quaternion();
function pickTarget(rec, u, root) {
  const r = Math.random(), wp = root.position;
  if (u.lookAt && r < .72) { rec.tgtKind = 'partner'; return u.lookAt; }
  if (r < .5) { let best = null, bd = 3.6; const fwd = V2.set(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
    const cand = (NC.npcs || []).map(n => n.g).concat(NC.player && NC.player.group ? [NC.player.group] : []);
    for (let i = 0; i < 14 && cand.length; i++) { const g = cand[(Math.random() * cand.length) | 0]; if (!g || g === root || !g.visible) continue; const d = g.position.distanceTo(wp); if (d < bd && V1.copy(g.position).sub(wp).normalize().dot(fwd) > .1) { bd = d; best = g; } }
    if (best) { rec.tgtKind = 'person'; return best.position; } }
  if (r < .7 && NC.W && NC.W.stage) { rec.tgtKind = 'stage'; return NC.W.stage; }
  rec.tgtKind = 'around'; const yaw = root.rotation.y + (Math.random() - .5) * 2.2; return new T.Vector3(wp.x + Math.sin(yaw) * 4, 1.2 + Math.random() * 1.2, wp.z + Math.cos(yaw) * 4);
}
function update(rec, dt, now) {
  const u = rec.u, root = rec.root, m = rec.mesh, inf = m.morphTargetInfluences; if (!inf) return;
  const ex = EXW[u.expr] || EXW.neutral, tg = rec.tgt; tg.fill(0); ex.w.forEach((v, i) => { tg[i] = v || 0; });
  if (u.dance && u.expr === 'neutral') { tg[1] = Math.max(tg[1], .22); tg[2] = Math.max(tg[2], .18); }
  // 말하기: 음절마다 다른 입모양(아·이·우·에·오) — 턱 + 오므림/당김
  const talk = +u.mouthOpen || 0; if (talk > 0) { const syl = Math.floor(now * 9.5 + rec.P.seed % 7), v = syl % 5, o = .18 + .3 * talk;
    tg[0] = Math.max(tg[0], v === 0 ? o : v === 3 ? o * .7 : v === 4 ? o * .6 : o * .35); if (v === 2 || v === 4) tg[4] = Math.max(tg[4], .45); if (v === 1 || v === 3) tg[5] = Math.max(tg[5], .4); if (syl % 11 === 0) tg[6] = Math.max(tg[6], .3); }
  // 미세 표정: 가끔 눈썹 살짝 · 비대칭 미소 · 입술 다물기
  const mc = rec.micro; mc.t -= dt; if (mc.t < 0) { mc.k = [6, 1, 2, 3, 7][(Math.random() * 5) | 0]; mc.w = .12 + Math.random() * .18; mc.d = .5 + Math.random() * .7; mc.t = 3 + Math.random() * 7; }
  if (mc.k >= 0 && mc.d > 0) { mc.d -= dt; tg[mc.k] = Math.max(tg[mc.k], mc.w * Math.sin(Math.min(1, mc.d) * PI)); }
  tg[10] = Math.max(tg[10], .04 + .03 * Math.sin(now * 1.6 + rec.P.seed));   // 숨 쉴 때 콧방울
  const k = 1 - Math.exp(-dt * 13), w = rec.w; for (let i = 0; i < w.length; i++) { w[i] += (tg[i] - w[i]) * k; inf[i] = w[i]; }
  rec.jaw.rotation.x = w[0] * .3;
  // 시선: 대상 고정 → 1.2~4초마다 바꿈 · 짧은 도약안구운동 · 미세 떨림
  rec.gazeT -= dt; if (rec.gazeT < 0 || !rec.target) { rec.target = pickTarget(rec, u, root); rec.gazeT = (rec.tgtKind === 'partner' ? 2.2 : 1.2) + Math.random() * 2.8; }
  let tx = rec.target, gy = 0, gx = 0; if (tx) { const tp = tx.isVector3 ? V1.copy(tx) : V1.set(tx.x, 0, tx.z); if (!tx.isVector3 || tx.y < .3) tp.y = 1.5;
    const e0 = rec.eyes[0].grp; e0.getWorldPosition(V2); tp.sub(V2); rec.eyes[0].grp.parent.getWorldQuaternion(Q1).invert(); tp.applyQuaternion(Q1);
    if (tp.z > .05) { gx = Math.atan2(tp.x, tp.z); gy = Math.atan2(-tp.y, Math.hypot(tp.x, tp.z)); } }
  if (ex.look) { gx += ex.look[0]; gy += ex.look[1]; }
  rec.sacT -= dt; if (rec.sacT < 0) { rec.sacT = .25 + Math.random() * .9; rec.gzT[0] = U.clamp(gx + (Math.random() - .5) * .05, -.55, .55); rec.gzT[1] = U.clamp(gy + (Math.random() - .5) * .04, -.38, .42); }
  const ks = 1 - Math.exp(-dt * 30); rec.gz[0] += (rec.gzT[0] - rec.gz[0]) * ks; rec.gz[1] += (rec.gzT[1] - rec.gz[1]) * ks; u.gaze = [rec.gz[0] / .55, rec.gz[1] / .4];
  // 눈꺼풀: 기본 + 표정 + 깜빡임 + 시선 따라감(아래를 보면 윗눈꺼풀도 내려감)
  const blink = u.blink ? 1 : 0; rec.lidU += ((blink ? 1 : U.clamp(ex.lu + Math.max(0, rec.gz[1]) * .6 + w[9] * .1, -.3, 1)) - rec.lidU) * (1 - Math.exp(-dt * (blink ? 45 : 14)));
  rec.lidL += ((ex.ll + w[9] * .15) - rec.lidL) * (1 - Math.exp(-dt * 12));
  for (const e of rec.eyes) { e.globe.rotation.set(rec.gz[1], rec.gz[0], 0, 'YXZ');
    const cl = e.sd < 0 && ex.winkR ? 1 : rec.lidU; e.up.rotation.x = rec.restU + cl * .52; e.lo.rotation.x = -(rec.restL + rec.lidL * .3); }
}
/* ═════ 8. 머리카락 가닥 카드(헬멧 머리 → 결이 보이는 머리) ═════
 *  두피에서 뿌리를 뽑아 스타일별 결(흐름장)을 따라 머리 형태를 감싸며 자라는 리본 카드(알파 가닥 텍스처).
 *  기존 볼륨 껍질은 두피·속머리 층으로 두고, 덩어리처럼 보이던 앞머리 껍질은 가닥 앞머리로 교체. 자연스러운 헤어라인·구레나룻·M자 탈모(나이). */
const STRAND = {};
function strandTex(curly) { const k = curly ? 'c' : 's'; if (STRAND[k]) return STRAND[k];
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = U.rng(curly ? 5 : 7);
  for (let i = 0; i < 110; i++) { const x0 = r() * W, w = .6 + r() * 1.6, a = .35 + r() * .65, len = H * (.65 + r() * .35); g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.beginPath(); g.moveTo(x0, 0);
    for (let y = 0; y <= len; y += 8) g.lineTo(x0 + Math.sin(y / (curly ? 9 : 40) + i) * (curly ? 5 : 2.2), y); g.stroke(); }
  const t = NC.tex ? NC.tex(c) : new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; STRAND[k] = t; return t; }
const LONG = { long: .36, wavy: .34, hime: .4, spaceBuns: .3, bob: .17, wolf: .14 }, GATHER = { ponytail: 1, highPony: 1, bun: 1, twin: 1, twinHigh: 1, braids: 1 }, CURLY = { afro: 1, curly: 1 };
Face.hairCards = (skull, look, r, mHair, lodName) => {
  if (!ON) return null; const hs = look.hairStyle || 'short', f = look.gender === 'f', rr = U.rng(U.hash((look.hairColor || '') + hs + (look.face && look.face.fid || 0) + (look.age || 0)));
  if (hs === 'buzz') return null;   // 버즈컷은 텍스처 두피로 충분
  const curly = !!CURLY[hs], Lmax = LONG[hs] || 0, gather = !!GATHER[hs], lowF = lodName === 'low' ? .4 : lodName === 'hi' ? 1.15 : .8;
  const N = Math.round((Lmax > .2 ? 700 : Lmax > 0 ? 560 : curly ? 480 : 420) * lowF);
  const recede = !f && (look.age || 28) > 44 && rr() < .55 ? .1 + rr() * .14 : 0, fringe = ['long', 'wavy', 'bob', 'hime', 'twin', 'braids', 'spaceBuns', 'wolf', 'twinHigh', 'highPony', 'comma', 'twoblock'].includes(hs) && !look.hat;
  const R0 = r * 1.06, pos = [], uv = [], idx = [], V = new T.Vector3(), D = new T.Vector3(), G0 = new T.Vector3(0, -1, 0), tmp = new T.Vector3();
  const hairline = (a) => { const aa = Math.abs(a); return aa < 1.15 ? -.43 - recede * (1 - .4 * gau(a, 0, .25)) : aa < 1.55 ? -.43 + (aa - 1.15) * 1.2 - recede * .5 : .28; };   // b 가 이 값보다 작아야(위쪽) 머리가 남
  const wrap = p => { const l = p.length(); if (l < R0) p.multiplyScalar(R0 / l); const fz = p.z > r * .15 && Math.abs(p.x) < r * .9 && p.y < r * .3 && p.y > -r * 1.6; if (fz && !(isF && p.y > r * .1)) p.x = Math.sign(p.x || 1) * r * .9; return p; };   // 얼굴 앞은 절대 덮지 않음(앞머리는 눈썹 위까지만)   // 두개골 밖 · 얼굴 앞은 비켜서
  let made = 0, guard = 0, isF = false;
  while (made < N && guard++ < N * 8) {
    const a = (rr() - .5) * 2 * Math.PI, b = -Math.PI / 2 + rr() * (Math.PI / 2 + .3); if (b > hairline(a)) continue;
    const cb = Math.cos(b), n = new T.Vector3(Math.sin(a) * cb, -Math.sin(b), Math.cos(a) * cb), front = Math.cos(a) > .2 && b > -1.0;
    const isFringe = fringe && front && Math.abs(a) < .9 && b > -1.05; isF = isFringe;
    let L = Lmax > 0 ? Lmax * (.75 + rr() * .4) : curly ? .03 + rr() * .02 : hs === 'spiky' ? .06 + rr() * .03 : hs === 'fade' ? .025 + rr() * .015 : .045 + rr() * .035;
    if (isFringe) L = .07 + rr() * .03; if (gather) L = .08 + rr() * .05;
    // 첫 방향: 스타일별 결
    D.set(0, 0, -1); if (hs === 'spiky') D.copy(n).add(tmp.set(0, .6, -.3)); else if (hs === 'slick') D.set(0, -.2, -1); else if (hs === 'side' || hs === 'comma') D.set(a < .3 ? -1 : -.3, -.2, -.6); else if (hs === 'curtain') D.set(Math.sign(a || 1), -.6, .2);
    else if (gather) D.set(-n.x, (.62 - n.y) * .5, -1 - n.z); else if (curly) D.set(rr() - .5, rr() - .5, rr() - .5); else if (Lmax > 0) D.set(n.x * .6, -1, n.z * .4);
    if (isFringe) D.set(Math.sign(a) * .25 + (rr() - .5) * .3, -1, .35); else if (Lmax > 0 && front) D.set(Math.sign(a || 1) * 1.2, -.35, -.5);   // 앞쪽 뿌리의 긴 머리는 옆·뒤로 넘김
    D.addScaledVector(n, -D.dot(n)).normalize();
    const K = Lmax > .2 ? 9 : Lmax > 0 ? 6 : 3, step = L / K, w = (Lmax > 0 ? .03 : curly ? .02 : .02) * (.8 + rr() * .5), P0 = n.clone().multiplyScalar(R0 * (1 + rr() * .05)), pts = [P0.clone()];
    for (let k = 0; k < K; k++) { const p = pts[pts.length - 1], nn = V.copy(p).normalize(), below = p.y < -r * .1;
      const grav = tmp.copy(G0); if (!below || Lmax === 0) grav.addScaledVector(nn, -grav.dot(nn));
      const mix = Lmax > 0 ? (below ? .85 : .45) : curly ? .1 : hs === 'spiky' ? 0 : .3; D.multiplyScalar(1 - mix).addScaledVector(grav.normalize(), mix);
      if (curly) D.add(tmp.set(Math.sin(k * 2.1 + a * 9), Math.cos(k * 1.7 + b * 7), Math.sin(k * 1.3)).multiplyScalar(.6));
      if (isFringe && p.y < -r * .1) D.y *= .2;   // 앞머리 끝은 눈썹 위에서 멈춤
      if (hs === 'wavy') D.x += Math.sin(k * 1.4 + a * 3) * .35; D.normalize();
      const q = p.clone().addScaledVector(D, step); if (!(below && Lmax > 0)) { wrap(q); } else { const l = Math.hypot(q.x, q.z); if (l < R0 * .95) { q.x *= R0 * .95 / l; q.z *= R0 * .95 / l; } }
      if (isFringe && q.y < r * .1 && q.z > 0) q.y = Math.max(q.y, r * .12 + (rr() - .5) * r * .04);
      pts.push(q); }
    // 리본(카메라 무관, 두피 법선을 기준으로 옆 방향)
    const base = pos.length / 3;
    pts.forEach((p, k) => { const t = k / (pts.length - 1), nn = V.copy(p).normalize(), dir = k < pts.length - 1 ? tmp.copy(pts[k + 1]).sub(p) : tmp.copy(p).sub(pts[k - 1]), sd = new T.Vector3().crossVectors(dir, nn).normalize(), ww = w * (1 - .55 * t) * .5;
      pos.push(p.x + sd.x * ww, p.y + sd.y * ww, p.z + sd.z * ww, p.x - sd.x * ww, p.y - sd.y * ww, p.z - sd.z * ww); const u0 = rr() * .8; uv.push(u0, 1 - t, u0 + .2, 1 - t); });
    for (let k = 0; k < pts.length - 1; k++) { const i0 = base + k * 2; idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3); }
    made++;
  }
  if (!made) return null;
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const col = (mHair && mHair.color ? mHair.color.clone() : new T.Color(look.hairColor || '#241812'));
  const m = new T.MeshStandardMaterial({ color: col, map: strandTex(curly), alphaTest: .34, side: T.DoubleSide, roughness: .45, metalness: .04 });
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', '{ vec3 vd = normalize(vViewPosition); float rim = pow(1.0 - abs(dot(normal, vd)), 3.0); gl_FragColor.rgb += diffuseColor.rgb * rim * 0.35; }\n#include <tonemapping_fragment>'); };   // 가닥 가장자리 역광 하이라이트
  const mesh = new T.Mesh(g, m); mesh.userData.noMerge = true; mesh.name = 'hair42'; skull.add(mesh);
  if (fringe) skull.children.forEach(c => { if (c.userData && c.userData.hairPart === 'bangs') c.visible = false; });   // 덩어리 앞머리 껍질 → 가닥 앞머리
  if (recede) skull.children.forEach(c => { if (c.userData && c.userData.hairPart === 'cap') c.scale.set(1, 1, 1); });
  return mesh;
};
Face.MORPHS = MORPHS;
Face.attach = (rec, root) => { rec.root = root; rec.u = root.userData; Face.list.push(rec); };
let acc = 0;
NC.tickers.push(dt => {
  const now = performance.now() / 1000, cam = NC.camera; acc++;
  if (TQ.length) { const t0 = performance.now(); do { const f = TQ.shift(); try { f(); } catch (e) { console.warn('[face] tex', e); } } while (TQ.length && performance.now() - t0 < 6); }
  for (let i = Face.list.length - 1; i >= 0; i--) { const rec = Face.list[i], root = rec.root; if (!root.parent && !root.userData.keepFace) { if (rec.dead === undefined) rec.dead = now; if (now - rec.dead > 5) Face.list.splice(i, 1); continue; } rec.dead = undefined;
    if (!root.visible || !rec.mesh.visible) continue;
    const d = cam ? root.position.distanceTo(cam.position) : 5, step = d < 9 ? 1 : d < 18 ? 3 : d < 30 ? 6 : 0; if (!step) continue;   // 멀수록 표정 갱신을 띄엄띄엄(눈에 안 띔)
    if ((acc + rec.frame) % step) continue; try { update(rec, Math.min(dt * step, .12), now); } catch (e) { console.warn('[face]', e); Face.list.splice(i, 1); } }
});
console.info('[face] v42 3D 얼굴 시스템 ' + (ON ? '켜짐' : '꺼짐(?legacyface)'));
})();
