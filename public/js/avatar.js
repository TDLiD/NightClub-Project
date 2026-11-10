/* avatar.js — 사람형 아바타 생성기 (관절 리그 + 절차적 얼굴 텍스처)
 *  - 관절: hips › torso › neck › head / shL·elL·shR·elR / legL·knL·legR·knR  (motion.js 가 회전값을 구동)
 *  - 얼굴: 머리 구(球)에 등장방형(equirect) 캔버스 텍스처로 눈·눈썹·코·입·볼터치·수염을 그림
 *          캔버스 좌표계를 '라디안' 단위로 변환해 그리므로 얼굴 비율이 머리 크기와 무관하게 유지됨
 *  - 얼굴 파라미터(face)·헤어·의상 조합으로 모든 인물의 얼굴이 다르게 생성됨 (seed 기반 랜덤 + 페르소나 지정값)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const T = NC.THREE, U = NC.util, std = NC.mat.std;

const SKINS = ['#f7dcc8', '#f1c9a5', '#ecc0a0', '#e3b08a', '#d39b72', '#fae3d3', '#c88e66'];
const HAIRC = ['#17110f', '#241812', '#3b2417', '#4e3020', '#6e4425', '#93653a', '#c4a070', '#2c2a36', '#6b2e3a', '#5a4a7a', '#b8b0a8'];
const EYEC = ['#3a2416', '#4a2e1a', '#2a1a10', '#5a3a20', '#30251c', '#3d3326'];
const LIPS_F = ['#d0566a', '#c4475a', '#e07a7a', '#b8485e', '#d96f6f', '#a83e52', '#e0857c'];
const LIPS_M = ['#c08a80', '#b87a72', '#c89488', '#ad7a70'];
const SHADOWS = ['#b06aa0', '#c88a6a', '#8a6ad0', '#d07a8a', '#a07050'];
const HAIR_F = ['long', 'bob', 'ponytail', 'bun', 'wavy', 'twin', 'braids', 'long', 'bob', 'twin'];
const HAIR_M = ['short', 'twoblock', 'slick', 'curly', 'spiky', 'side', 'twoblock', 'spiky'];
const TOPS_F = ['dress', 'tee', 'shirt', 'jacket', 'dress', 'crop', 'overshirt', 'crop'];
const PATTERNS = ['solid', 'solid', 'plaid', 'stripe', 'leopard', 'graphic', 'solid'];
const HATS = [null, null, null, null, 'cap', 'beanie', 'fedora', 'cap'];
const VIVID_HAIR = ['#e8c35a', '#ff8fb8', '#9be15d', '#c9572f', '#7a8cff', '#f2f2f2'];
const TOPS_M = ['shirt', 'jacket', 'tee', 'overshirt', 'jacket', 'overshirt'];
const hsl = (h, s, l) => '#' + new T.Color().setHSL(h, s, l).getHexString();

function randomLook(seed, gender) {
  const r = U.rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const g = gender || (r() < .5 ? 'f' : 'm'), f = g === 'f';
  const top = pick(f ? TOPS_F : TOPS_M);
  const o = {
    gender: g, height: f ? 1.6 + r() * .12 : 1.72 + r() * .12, build: .92 + r() * .2,
    skin: pick(SKINS), hairStyle: pick(f ? HAIR_F : HAIR_M), hairColor: r() < .22 ? pick(VIVID_HAIR) : pick(HAIRC),
    pattern: pick(PATTERNS), hat: pick(HATS), hatColor: hsl(r(), .5, .3 + r() * .3), shoeColor: r() < .6 ? '#f4f4f6' : hsl(r(), .6, .5),
    top, topColor: hsl(r(), .55 + r() * .35, .42 + r() * .2),
    bottom: top === 'dress' ? 'skirt' : top === 'crop' ? (r() < .5 ? 'shorts' : 'skirt') : (f && r() < .4 ? 'skirt' : !f && r() < .15 ? 'shorts' : 'pants'), bottomColor: hsl(r(), .2 + r() * .3, .12 + r() * .14),
    innerColor: r() < .5 ? '#f6f6f6' : r() < .5 ? '#1c1c20' : hsl(r(), .5, .6), setup: top === 'jacket' && r() < .35,
    inner: r() < .35 ? 'turtle' : 'tee', fit: r() < .3 ? 'wide' : r() < .45 ? 'ripped' : 'skinny', set: r() < .18, oversize: r() < .3, necklace: r() < .3, shoes: f && r() < .3 ? 'boots' : 'sneakers',
    face: {
      eyeColor: pick(EYEC), eyeSize: .85 + r() * .35, eyeTilt: (r() - .5) * .28, eyeGap: (r() - .5) * .05, lid: r() < .6 ? 1 : 0,
      browThick: f ? .55 + r() * .45 : .95 + r() * .6, browTilt: (r() - .5) * .3, browArch: r(),
      lipColor: pick(f ? LIPS_F : LIPS_M), lipW: .85 + r() * .3, lipFull: f ? 1.0 + r() * .45 : .8 + r() * .4, nose: .82 + r() * .4,
      faceW: .9 + r() * .14, jaw: .92 + r() * .18, blush: f ? .25 + r() * .4 : r() * .12, liner: f ? .55 + r() * .45 : 0,
      shadow: f && r() < .8 ? pick(SHADOWS) : null, freckles: r() < .15, mole: r() < .25 ? [(r() - .5) * .9, .15 + r() * .5] : null,
      beard: !f && r() < .25 ? (r() < .6 ? 'stubble' : 'goatee') : null, glasses: r() < .2, sunglasses: r() < .14, earring: f && r() < .55,
    },
  };
  // v14 ① 인종 다양화: 동양 40% · 서양 30% · 흑인 30% (피부톤·헤어·이목구비)
  const eth = r() < .4 ? 'east' : r() < .5 ? 'west' : 'black'; o.ethnic = eth;
  if (eth === 'west') { o.skin = pick(['#f6dccb', '#f2d0bc', '#ecc6a8', '#f8e4d6']); if (r() < .55) o.hairColor = pick(['#e8c35a', '#c9a060', '#a8743a', '#d8b878', '#8a5a30']); o.face.eyeColor = pick(['#3d5a7a', '#4a6a3a', '#5a4a30', '#2f4f6f']); o.face.nose *= 1.08; o.face.lid = 1; }
  else if (eth === 'black') { o.skin = pick(['#8d5a3b', '#7a4a2e', '#6b4026', '#5a3420', '#9e6a48']); o.hairColor = pick(['#120c0a', '#1c1410', '#2a1c14']); o.face.lipFull = Math.max(o.face.lipFull, 1.25); o.face.nose *= 1.05;
    o.hairStyle = f ? pick(['braids', 'wavy', 'bun', 'long', 'curly' === 'x' ? 'long' : 'ponytail']) : pick(['buzz', 'curly', 'twoblock', 'short']); o.face.lipColor = f ? pick(['#8a2a3a', '#a83e52', '#b85a6a']) : '#7a4a42'; }
  else { o.skin = pick(['#f7dcc8', '#f1c9a5', '#fae3d3', '#ecc0a0', '#e3b08a']); }
  if (!f) {   // ③ 남성: 미남 50% · 개성파 50% · 근육질 30%
    const hand = r() < .5; o.face.attractive = hand;
    if (hand) Object.assign(o.face, { eyeSize: 1.0 + r() * .1, browThick: 1.1 + r() * .3, browTilt: .05, jaw: 1.0 + r() * .06, faceW: .92 + r() * .04, nose: .88 + r() * .1, mole: null, freckles: false });
    else Object.assign(o.face, { eyeSize: .74 + r() * .12, browThick: .7 + r() * 1.0, browTilt: (r() - .5) * .5, jaw: 1.08 + r() * .1, faceW: 1.02 + r() * .06, nose: 1.15 + r() * .2, eyeGap: .03 + r() * .03, mole: r() < .6 ? [(r() - .5) * .9, .2 + r() * .4] : null });
    o.muscle = r() < .3 ? .6 + r() * .4 : r() * .25;
  }
  // v17 K-pop 스테이지 룩: 여성 45% · 남성 35% 손님이 아이돌 무대 스타일(블랙 스테이지 패션 · 아이돌 헤어 · 무대 메이크업)
  if (r() < (f ? .45 : .35)) applyIdol(o, r, f);
  return o;
}
const IDOL_F = [   // [상의, 하의, 신발, 모자] — 블랙 톤 무대 의상 조합
  ['blazerCrop', 'tutu', 'thigh', null], ['halter', 'leather', 'thigh', null], ['meshCrop', 'leather', 'boots', null],
  ['blazerCrop', 'cargo', 'boots', 'newsboy'], ['halter', 'tutu', 'thigh', null], ['meshCrop', 'cargo', 'boots', 'beret'], ['blazerCrop', 'leather', 'thigh', 'beret']];
function applyIdol(o, r, f) {
  const pick = a => a[Math.floor(r() * a.length)];
  o.idol = true; o.pattern = 'solid'; o.set = false; o.setup = false; o.wings = null;
  if (f) {
    const [top, bottom, shoes, hat] = pick(IDOL_F);
    Object.assign(o, { top, bottom, shoes, hat, hatColor: '#121016', topColor: top === 'meshCrop' ? pick(['#6a3a9a', '#5a2a7a', '#3a2a5a']) : '#141016', bottomColor: '#0d0b10',
      curve: .42, height: 1.64 + r() * .08, build: .9 + r() * .08, mini: true, choker: r() < .6, chain: r() < .45, belt: bottom !== 'tutu' || r() < .5, gloves: top === 'halter' && r() < .6,
      hairStyle: pick(['twinHigh', 'spaceBuns', 'hime', 'highPony', 'long', 'hime', 'twinHigh']), hairColor: r() < .72 ? pick(['#0e0b0e', '#17110f', '#1e1418', '#241812']) : pick(['#c8c4d8', '#b7a6d9', '#e9e4ee', '#d8c8e8']),
      hair2: r() < .45 ? pick(['#b06aff', '#ff5fa8', '#cfd2ff', '#7a4cff', '#ff8ad0']) : null });
    if (top === 'meshCrop') o.pattern = 'monogram'; if (bottom === 'cargo') o.cargoPrint = true;
    Object.assign(o.face, { stage: true, liner: .95, eyeSize: 1.06 + r() * .1, lid: 1, shadow: pick(['#9a6ad8', '#d070a0', '#6a5aa0', '#b05a8a']), lipColor: pick(['#c4475a', '#a83e52', '#d0566a', '#b8485e']), blush: .3 + r() * .15, earring: true, glasses: false, sunglasses: false, freckles: false });
  } else {
    Object.assign(o, { top: pick(['stageJacket', 'stageJacket', 'jacket']), topColor: pick(['#121014', '#16141a', '#1a1218']), inner: 'tee', innerColor: pick(['#141016', '#f4f2ee']), bottom: 'pants', fit: 'skinny', bottomColor: '#0e0c10', shoes: 'boots', chain: r() < .7,
      hat: r() < .15 ? 'beanie' : null, hatColor: '#141016', height: 1.78 + r() * .08, hairStyle: pick(['comma', 'wolf', 'comma', 'twoblock', 'side']), hairColor: r() < .75 ? pick(['#0e0b0e', '#17110f', '#241812']) : pick(['#c8c4d8', '#9aa0b8', '#d8d0c0']) });
    Object.assign(o.face, { attractive: true, eyeSize: 1.02 + r() * .08, browThick: 1.15 + r() * .2, browTilt: .05, jaw: 1.0, faceW: .92, nose: .9, mole: null, beard: null, glasses: false, earring: r() < .5 });
    o.muscle = Math.min(o.muscle || 0, .45);
  }
}
/* 오리지널 유지 가드: 특정 원작 이미지의 캐릭터 조합(헤어색+헤어스타일+의상 패턴+소품)이 그대로 나오지 않도록 비틀기 */
function originalize(o) {
  const F = o.face || {};
  if ((o.hairStyle === 'twin' || o.hairStyle === 'braids') && o.hairColor === '#9be15d') o.hairColor = '#7a8cff';
  if (o.pattern === 'leopard') F.sunglasses = false;
  if (o.hairStyle === 'braids' && o.hairColor === '#c9572f' && o.pattern === 'plaid') o.pattern = 'stripe';
  if (o.hairColor === '#ff8fb8' && o.pattern === 'graphic') o.pattern = 'solid';
  if (o.hairColor === '#e8c35a' && F.glasses && o.pattern === 'plaid') F.glasses = false;
  if (o.top === 'jacket' && o.setup && /^#f[0-9a-f]f/i.test(o.topColor || '') && F.glasses) F.glasses = false;
  if (o.setup) { o.bottom = 'pants'; o.bottomColor = o.topColor; o.pattern = 'solid'; }
  return o;
}
function mergeLook(seed, gender, look) {
  const base = randomLook(seed, (look && look.gender) || gender);
  const o = Object.assign({}, base, look || {});
  const plain = { freckles: false, mole: null, beard: null, glasses: false, sunglasses: false, earring: false, shadow: null };   // 지정 얼굴은 랜덤 소품을 섞지 않음
  o.face = Object.assign({}, base.face, look && look.face ? plain : {}, (look && look.face) || {});
  if (o.gender === 'm' && look && look.face && typeof look.face.attractive === 'boolean') Object.assign(o.face, look.face.attractive   // v14: 지정한 미남/개성파 얼굴형
    ? { eyeSize: 1.06, browThick: 1.25, browTilt: .05, jaw: 1.03, faceW: .93, nose: .92, eyeGap: 0 } : { eyeSize: .78, browThick: 1.4, browTilt: .2, jaw: 1.14, faceW: 1.06, nose: 1.28, eyeGap: .05 }, look.face);
  return originalize(o);
}

/* ───────── 스타일라이즈드(v4) 비율 ─────────
 * 큰 두상·큰 눈·작은 코/입·가는 목·긴 다리의 3D 캐릭터 스타일. TOON=false 로 바꾸면 v3 실사 비율로 돌아감 */
const TOON = true, HEAD_S = TOON ? 1.15 : 1, EYE_K = TOON ? 1.5 : 1.3;   // v17: 아이돌 비율 — 두상 1.32→1.15 · 다리 6% 길게 (8등신에 가깝게)   // v12: 실사형 글래머 비율(두상 1.8→1.32 · 눈 1.85→1.5)
/* ───────── 얼굴 텍스처 ───────── */
const FW = 1024, FH = 512, K = FW / (Math.PI * 2);
const EXPR = {
  neutral: { eyes: 'open', mouth: 'neutral', brow: 0, browIn: 0, blush: 0 },
  smile: { eyes: 'open', mouth: 'smile', brow: .25, browIn: -.15, blush: .1 },
  laugh: { eyes: 'happy', mouth: 'laugh', brow: .45, browIn: -.25, blush: .2 },
  shy: { eyes: 'down', mouth: 'small', brow: .15, browIn: -.6, blush: .8 },
  surprised: { eyes: 'wide', mouth: 'o', brow: 1, browIn: -.2, blush: 0 },
  sad: { eyes: 'half', mouth: 'sad', brow: .2, browIn: -.9, blush: 0 },
  annoyed: { eyes: 'half', mouth: 'flat', brow: -.35, browIn: .9, blush: 0 },
  wink: { eyes: 'wink', mouth: 'smirk', brow: .3, browIn: 0, blush: .15 },
  joy: { eyes: 'happy', mouth: 'grin', brow: .55, browIn: -.25, blush: .4 },
  kiss: { eyes: 'closed', mouth: 'small', brow: .12, browIn: -.45, blush: 1 },     // v11: 눈 감고 입 오므림
};
const MOUTHS = {
  neutral: { cuL: 0, cuR: 0, open: 0, ws: 1, line: .01 },
  smile: { cuL: .03, cuR: .03, open: .25, ws: 1.06, line: .045 },
  laugh: { cuL: .035, cuR: .035, open: 1, ws: 1.12, line: .04 },
  small: { cuL: .015, cuR: .015, open: 0, ws: .85, line: .025 },
  o: { cuL: -.008, cuR: -.008, open: .85, ws: .5, line: 0 },
  sad: { cuL: -.028, cuR: -.028, open: 0, ws: .95, line: -.012 },
  flat: { cuL: -.008, cuR: -.008, open: 0, ws: .9, line: 0 },
  smirk: { cuL: 0, cuR: .04, open: 0, ws: 1, line: .018 },
  grin: { cuL: .045, cuR: .045, open: 1.5, ws: 1.3, line: .05 },
};
const rgba = (hex, a) => { const c = new T.Color(hex); return `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`; };
const shade = (hex, l) => { const c = new T.Color(hex); const h = {}; c.getHSL(h); return '#' + c.setHSL(h.h, h.s, U.clamp(h.l + l, 0, 1)).getHexString(); };

/* 피부 베이스 레이어(표정과 무관한 부분)는 한 번만 그려 캐시 → 깜빡임·입모양 갱신이 가벼움 */
const baseCache = new WeakMap();
let noiseCv = null;
function skinNoise() { if (noiseCv) return noiseCv; noiseCv = document.createElement('canvas'); noiseCv.width = noiseCv.height = 256; const g = noiseCv.getContext('2d'), im = g.createImageData(256, 256), d = im.data, r = U.rng(77);
  for (let i = 0; i < 256 * 256; i++) { const v = r(); d[i * 4] = 120 + v * 60; d[i * 4 + 1] = 70 + v * 40; d[i * 4 + 2] = 60 + v * 30; d[i * 4 + 3] = v < .55 ? 0 : (v - .55) * 120; } g.putImageData(im, 0, 0); return noiseCv; }
/* 저장 데이터에 색 값이 빠졌거나 잘못돼도(예전 버전·null 등) 기본 색으로 채워 그림 — 캔버스 오류로 화면이 멈추는 것 방지 */
const isCol = v => typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(v.trim());
function safeLook(look) {   // 같은 객체를 그대로 고쳐 씀(캐시·슬라이더 미리보기 유지)
  look = look || {}; const F = look.face = look.face || {}, f = look.gender === 'f';
  if (!isCol(F.eyeColor)) F.eyeColor = EYEC[0];
  if (!isCol(F.lipColor)) F.lipColor = (f ? LIPS_F : LIPS_M)[0];
  if (F.shadow != null && !isCol(F.shadow)) F.shadow = null;
  if (!isCol(look.skin)) look.skin = '#f1c9a5';
  if (!isCol(look.hairColor)) look.hairColor = '#17110f';
  return look;
}
function skinBase(look, FW, FH) {
  const key = baseCache.get(look); if (key && key.width === FW) return key;
  const cv = document.createElement('canvas'); cv.width = FW; cv.height = FH; const g = cv.getContext('2d'), F = look.face, K = FW / (Math.PI * 2);
  g.fillStyle = look.skin; g.fillRect(0, 0, FW, FH);
  g.globalAlpha = TOON ? .1 : .5; g.drawImage(skinNoise(), 0, 0, FW, FH); g.globalAlpha = 1;
  g.setTransform(K, 0, 0, K, FW * .25, FH * .5);
  const rad = (x, y, r0, r1, c0, c1) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r1, 0, 7); g.fill(); };
  let gr = g.createRadialGradient(0, .15, .35, 0, .2, 1.35); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(70,25,15,.26)'); g.fillStyle = gr; g.fillRect(-1.6, -1.6, 3.2, 3.2);
  rad(0, -.42, 0, .42, 'rgba(255,240,225,.16)', 'rgba(255,240,225,0)');                 // 이마 하이라이트
  rad(0, .18, 0, .1, 'rgba(255,240,230,.18)', 'rgba(255,240,230,0)');                    // 콧대 하이라이트
  for (const s of [-1, 1]) {
    rad(s * .31, .14, 0, .14, 'rgba(90,40,50,.12)', 'rgba(90,40,50,0)');                  // 눈 밑 그늘
    rad(s * .31, -.07, 0, .16, 'rgba(100,45,40,.12)', 'rgba(100,45,40,0)');              // 눈두덩 쌍꺼풀 그늘
    rad(s * .62, .42, 0, .3, 'rgba(80,30,25,.14)', 'rgba(80,30,25,0)');                  // 광대 아래 음영
    rad(s * .5, .22, 0, .16, 'rgba(255,235,220,.12)', 'rgba(255,235,220,0)');            // 광대 하이라이트
    rad(s * .1, .35, 0, .08, 'rgba(200,90,80,.12)', 'rgba(200,90,80,0)');                // 콧망울 혈색
  }
  rad(0, .78, 0, .16, 'rgba(255,235,220,.12)', 'rgba(255,235,220,0)');                   // 턱끝 하이라이트
  rad(0, 1.02, 0, .35, 'rgba(60,20,15,.18)', 'rgba(60,20,15,0)');                        // 턱 아래 그늘
  const bl = U.clamp((F.blush || 0) + (TOON ? .25 : 0), 0, 1);
  if (bl > .02) for (const s of [-1, 1]) rad(s * .46, TOON ? .36 : .3, 0, TOON ? .2 : .22, `rgba(255,105,130,${.5 * bl})`, 'rgba(255,105,130,0)');
  if (F.freckles) { const r = U.rng(U.hash(look.skin + look.hairColor)); g.fillStyle = 'rgba(140,80,50,.35)'; for (let i = 0; i < 34; i++) { const s = r() < .5 ? -1 : 1; g.beginPath(); g.arc(s * (.1 + r() * .34), .14 + r() * .22, .006 + r() * .006, 0, 7); g.fill(); } }
  if (F.mole) { g.fillStyle = 'rgba(60,30,20,.75)'; g.beginPath(); g.arc(F.mole[0], F.mole[1], .011, 0, 7); g.fill(); }
  if (F.beard) {   // 수염: 개별 점(모근)으로 그려 실사 느낌
    const r = U.rng(U.hash(look.hairColor + 'b')), dens = F.beard === 'stubble' ? 900 : 1300;
    g.fillStyle = rgba(look.hairColor, F.beard === 'stubble' ? .35 : .6);
    for (let i = 0; i < dens; i++) { const x = (r() - .5) * 1.15, y = .3 + r() * .85;
      const inBeard = F.beard === 'stubble' ? (y > .4 + Math.abs(x) * .15 && Math.abs(x) < .58 - (y - .3) * .1 && !(Math.abs(x) < .2 && y > .45 && y < .62 && y > .5)) : (Math.hypot(x, (y - .76) * 1.1) < .19 || (y > .4 && y < .47 && Math.abs(x) < .2));
      if (inBeard) { g.beginPath(); g.arc(x, y, .0045 + r() * .003, 0, 7); g.fill(); } }
  }
  baseCache.set(look, cv); return cv;
}

function drawFace(cv, look, exName, st = {}) {
  look = safeLook(look);
  const FW = cv.width, FH = cv.height, K = FW / (Math.PI * 2);
  const g = cv.getContext('2d'), F = look.face, fem = look.gender === 'f', e = EXPR[exName] || EXPR.neutral;
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(skinBase(look, FW, FH), 0, 0);
  g.setTransform(K, 0, 0, K, FW * .25, FH * .5);          // 이후 단위: 라디안 (정면 중앙 = 0,0 / +y = 아래)
  let gr;
  // 표정 볼터치(부끄러움 등)
  const bl = U.clamp(e.blush || 0, 0, 1);
  if (bl > .02) for (const s of [-1, 1]) { gr = g.createRadialGradient(s * .44, .3, 0, s * .44, .3, .24); gr.addColorStop(0, `rgba(255,90,115,${.5 * bl})`); gr.addColorStop(1, 'rgba(255,90,115,0)'); g.fillStyle = gr; g.beginPath(); g.arc(s * .44, .3, .24, 0, 7); g.fill(); }
  const gz = st.gaze || [0, 0];
  // 눈
  const ex = (TOON ? .33 : .31) + (F.eyeGap || 0), es = (F.eyeSize || 1) * EYE_K, EY = TOON ? .1 : .05;
  for (const s of [-1, 1]) {
    let mode = e.eyes; if (mode === 'wink') mode = s > 0 ? 'happy' : 'open'; if (st.blink && mode !== 'happy') mode = 'closed';
    g.save(); g.translate(s * ex, EY); g.rotate(-s * (F.eyeTilt || 0)); if (s < 0) g.scale(-1, 1);   // 항상 +x = 바깥 눈꼬리
    const w = (TOON ? .1 : .11) * es, open = { open: 1, wide: 1.3, half: .55, down: .62 }[mode] || 0, h = (TOON ? .066 : .05) * es * Math.max(open, .01);
    if (F.shadow) { gr = g.createRadialGradient(.01, -.05, 0, .01, -.05, .17); gr.addColorStop(0, rgba(F.shadow, .5)); gr.addColorStop(1, rgba(F.shadow, 0)); g.fillStyle = gr; g.beginPath(); g.arc(.01, -.05, .17, 0, 7); g.fill(); }
    if (F.stage) {   // v17 무대 메이크업: 애교살 하이라이트 + 눈두덩 글리터
      gr = g.createRadialGradient(0, h * 1.3 + .012, 0, 0, h * 1.3 + .012, w * 1.05); gr.addColorStop(0, 'rgba(255,236,232,.45)'); gr.addColorStop(1, 'rgba(255,236,232,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, h * 1.3 + .012, w * 1.05, .032, 0, 0, 7); g.fill();
      const rg = U.rng(U.hash(look.skin + 'gl' + s)); g.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 16; k++) { const gx = -w * .9 + rg() * w * 1.9, gy = -h * 1.5 - rg() * .045; g.fillRect(gx, gy, .0045, .0045); } }
    g.strokeStyle = '#1b1210'; g.lineCap = 'round'; g.lineJoin = 'round';
    if (open > 0) {
      const upper = () => { g.moveTo(-w, .006); g.bezierCurveTo(-w * .5, -h * 1.3, w * .45, -h * 1.35, w, -.008 - (fem ? .006 : 0)); };
      g.beginPath(); upper(); g.bezierCurveTo(w * .5, h * .95, -w * .45, h * .95, -w, .006); g.closePath(); g.fillStyle = '#fbf6f1'; g.fill();
      g.save(); g.clip();
      g.fillStyle = 'rgba(200,120,120,.12)'; g.fillRect(-w, -h, w * .35, h * 2); g.fillRect(w * .65, -h, w * .35, h * 2);   // 흰자 가장자리 혈색
      const ir = (TOON ? .068 : .052) * es, ix = -.006 + gz[0] * s * w * .3, iy = (mode === 'down' ? h * .45 : TOON ? h * .05 : -h * .1) + gz[1] * h * .4;
      if (TOON) { gr = g.createLinearGradient(0, iy - ir, 0, iy + ir); gr.addColorStop(0, shade(F.eyeColor, -.12)); gr.addColorStop(.55, F.eyeColor); gr.addColorStop(1, shade(F.eyeColor, .32)); }
      else { gr = g.createRadialGradient(ix, iy, ir * .2, ix, iy, ir); gr.addColorStop(0, shade(F.eyeColor, .2)); gr.addColorStop(.62, F.eyeColor); gr.addColorStop(.9, shade(F.eyeColor, -.08)); gr.addColorStop(1, '#0d0704'); }
      g.fillStyle = gr; g.beginPath(); g.arc(ix, iy, ir, 0, 7); g.fill(); if (TOON) { g.lineWidth = .006; g.strokeStyle = shade(F.eyeColor, -.25); g.stroke(); }
      g.strokeStyle = rgba(shade(F.eyeColor, .3), .35); g.lineWidth = .0022; for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2; g.beginPath(); g.moveTo(ix + Math.cos(a) * ir * .5, iy + Math.sin(a) * ir * .5); g.lineTo(ix + Math.cos(a + .1) * ir * .92, iy + Math.sin(a + .1) * ir * .92); g.stroke(); }
      g.fillStyle = '#050302'; g.beginPath(); g.arc(ix, iy, ir * .42, 0, 7); g.fill();
      if (TOON) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ix - ir * .38, iy - ir * .38, ir * .3, ir * .24, -.5, 0, 7); g.fill(); g.beginPath(); g.arc(ix + ir * .42, iy + ir * .4, ir * .12, 0, 7); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = .005; g.beginPath(); g.arc(ix, iy, ir * .72, .4, 1.3); g.stroke(); }
      else { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(ix - .016, iy - .017, ir * .2, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(ix + .014, iy + .012, ir * .09, 0, 7); g.fill(); }
      gr = g.createLinearGradient(0, -h * 1.4, 0, -h * .2); gr.addColorStop(0, 'rgba(60,30,25,.45)'); gr.addColorStop(1, 'rgba(60,30,25,0)'); g.fillStyle = gr; g.fillRect(-w, -h * 1.5, w * 2, h * 1.3);
      g.restore();
      g.beginPath(); upper(); g.lineWidth = (TOON ? .02 : .013) + (F.liner || 0) * .012; g.stroke();
      if (TOON) { g.beginPath(); g.moveTo(-w * .7, h * .7); g.bezierCurveTo(-w * .2, h * 1.05, w * .4, h * 1.0, w * .85, h * .45); g.lineWidth = .006; g.strokeStyle = 'rgba(60,30,25,.5)'; g.stroke(); g.strokeStyle = '#1b1210'; }
      if ((F.liner || 0) > .3 || (TOON && fem)) { const lnr = Math.max(F.liner || 0, .6); g.beginPath(); g.moveTo(w * .85, -.012); g.lineTo(w + .04 * lnr, -.036 * lnr - .006); g.lineWidth = .014; g.stroke(); }
      { const n = TOON ? (fem ? 5 : 0) : (fem ? 11 : 6); g.strokeStyle = '#120c0a'; g.lineWidth = TOON ? .009 : fem ? .0042 : .003; for (let k = 0; k < n; k++) { const q = .12 + k / (n - 1) * .86, x = -w + q * 2 * w, y = -h * 1.3 * Math.sin(q * Math.PI) * .95 - .002, L = (TOON ? .03 * (q > .55 ? 1.3 : .7) : fem ? .02 : .01) * (.6 + q * .7);
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L * .3, y - L * .8, x + L * (.4 + q * .6), y - L); g.stroke(); } g.strokeStyle = '#1b1210'; }
      g.beginPath(); g.moveTo(-w * .8, .014); g.bezierCurveTo(-w * .3, h * 1.0, w * .4, h * .95, w * .95, -.002); g.lineWidth = .005; g.strokeStyle = 'rgba(60,30,25,.35)'; g.stroke();
      if (F.lid) { g.beginPath(); g.moveTo(-w * .55, -h * 1.25); g.bezierCurveTo(-w * .2, -h * 2.0, w * .4, -h * 2.0, w * .95, -h * .9); g.lineWidth = .006; g.strokeStyle = 'rgba(90,45,35,.45)'; g.stroke(); }
    } else if (mode === 'happy') {
      g.beginPath(); g.moveTo(-w, .02); g.quadraticCurveTo(0, -.075 * es, w, .012); g.lineWidth = TOON ? .026 : .018; g.stroke();
    } else {
      g.beginPath(); g.moveTo(-w, -.002); g.quadraticCurveTo(0, .04 * es, w, -.006); g.lineWidth = .015; g.stroke();
    }
    g.restore();
  }
  // 눈썹
  const bt = (F.browThick || 1) * (TOON ? .75 : 1), by = (TOON ? -.15 - (es - 1.3) * .06 : -.16) - (e.brow || 0) * .045;
  g.strokeStyle = shade(look.hairColor, -.05); g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.save(); g.translate(s * ex, 0); if (s < 0) g.scale(-1, 1);
    const iy = by + (e.browIn || 0) * .035 + .008, oy = by - (F.browTilt || 0) * .12 + .02;
    const cy = by - .035 - (F.browArch || .5) * .03, P = q => { const a = 1 - q; return [a * a * -.14 + 2 * a * q * 0 + q * q * .16, a * a * iy + 2 * a * q * cy + q * q * oy]; };
    g.globalAlpha = .35; g.beginPath(); g.moveTo(-.14, iy); g.quadraticCurveTo(.0, cy, .16, oy); g.lineWidth = .024 * bt; g.stroke(); g.globalAlpha = 1;
    const rr = U.rng(U.hash(look.hairColor + s)), n = Math.round((TOON ? 18 : 46) * bt); g.lineWidth = .0035; if (TOON) { g.globalAlpha = .9; g.beginPath(); g.moveTo(-.14, iy); g.quadraticCurveTo(.0, cy, .16, oy); g.lineWidth = .02 * bt; g.stroke(); g.globalAlpha = 1; g.lineWidth = .0035; }
    for (let k = 0; k < n; k++) { const q = rr(), [x, y] = P(q), th = (1 - q * .55) * .03 * bt, off = (rr() - .5) * th, ang = q < .25 ? -1.2 : -.35 - q * .2, L = .022 + rr() * .012;
      g.beginPath(); g.moveTo(x, y + off + th * .3); g.lineTo(x + Math.cos(ang) * L * (q < .25 ? .4 : 1), y + off + th * .3 + Math.sin(ang) * L * .5); g.stroke(); }
    g.restore();
  }
  // 코 (입체는 메시, 텍스처는 콧망울 음영)
  const nz = (F.nose || 1) * (TOON ? .65 : 1);
  gr = g.createRadialGradient(0, .36, 0, 0, .36, .1 * nz); gr.addColorStop(0, 'rgba(110,50,35,.2)'); gr.addColorStop(1, 'rgba(110,50,35,0)'); g.fillStyle = gr; g.fillRect(-.2, .2, .4, .3);
  g.fillStyle = `rgba(100,45,35,${TOON ? .3 : .42})`; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * .04 * nz, TOON ? .36 : .335, .02 * (TOON ? .7 : 1), .011, s * .3, 0, 7); g.fill(); }
  // 입
  const M = MOUTHS[e.mouth] || MOUTHS.neutral, my = TOON ? .52 : .53, mw = (TOON ? .155 : .21) * (F.lipW || 1) * M.ws, lf = (F.lipFull || 1) * (fem ? 1.15 : .8) * (TOON ? .9 : 1);
  const lip = fem ? F.lipColor : F.lipColor || '#c08a80';
  const L = [-mw, my - M.cuL], R = [mw, my - M.cuR], midTop = my + M.line;
  const opn = M.open * (TOON ? .085 : .07) + (+st.talk || 0) * .042;
  if (opn > 0) {
    g.beginPath(); g.moveTo(...L); g.quadraticCurveTo(0, midTop - .006, ...R); g.quadraticCurveTo(0, midTop + opn * 2, ...L); g.fillStyle = '#4a1820'; g.fill();
    g.save(); g.clip(); g.fillStyle = '#f7f3ee'; g.fillRect(-mw, midTop - .02, mw * 2, .04); if (TOON && opn > .04) { g.fillStyle = '#e8707e'; g.beginPath(); g.ellipse(0, midTop + opn * 1.7, mw * .55, opn * .7, 0, 0, 7); g.fill(); } g.restore();
  }
  g.fillStyle = lip; g.beginPath(); g.moveTo(...L);
  g.bezierCurveTo(-mw * .6, my - .035 * lf - M.cuL * .5, -mw * .2, my - .045 * lf, 0, my - .028 * lf);
  g.bezierCurveTo(mw * .2, my - .045 * lf, mw * .6, my - .035 * lf - M.cuR * .5, ...R);
  g.quadraticCurveTo(0, midTop + .006, ...L); g.fill();
  const lt = midTop + opn * 1.8;
  g.fillStyle = shade(lip, .04); g.beginPath(); g.moveTo(...L); g.quadraticCurveTo(0, lt, ...R); g.quadraticCurveTo(0, lt + .07 * lf + Math.max(0, (M.cuL + M.cuR) / 2) * .4, ...L); g.fill();
  g.fillStyle = `rgba(255,255,255,${fem ? .32 : .16})`; g.beginPath(); g.ellipse(-mw * .12, lt + .026 * lf, mw * .26, .009, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(90,30,40,.18)'; g.lineWidth = .0025; for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(k * mw * .17, lt + .006); g.lineTo(k * mw * .19, lt + .05 * lf); g.stroke(); }
  if (F.stage) { gr = g.createRadialGradient(0, midTop + .004, 0, 0, midTop + .004, mw * .75); gr.addColorStop(0, rgba(shade(lip, -.28), .55)); gr.addColorStop(1, rgba(shade(lip, -.28), 0)); g.fillStyle = gr; g.beginPath(); g.ellipse(0, midTop + .004, mw * .8, .045 * lf, 0, 0, 7); g.fill();   // 그라데이션 틴트 립
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(mw * .18, lt + .03 * lf, mw * .14, .007, 0, 0, 7); g.fill(); }
  if (opn <= 0) { g.beginPath(); g.moveTo(...L); g.quadraticCurveTo(0, midTop + .008, ...R); g.lineWidth = .008; g.strokeStyle = 'rgba(70,20,25,.6)'; g.stroke(); }
  // 인중 · 턱 음영
  g.fillStyle = 'rgba(120,60,45,.08)'; g.beginPath(); g.ellipse(0, .4, .03, .05, 0, 0, 7); g.fill();
}

/* ───────── 메시 도우미 ───────── */
const geo = {}; const G = (k, f) => geo[k] || (geo[k] = f());
const sph = () => G('sph', () => new T.SphereGeometry(1, 14, 10));
const cyl = (a, b, h, s = 10) => G(`c${a}_${b}_${h}_${s}`, () => new T.CylinderGeometry(a, b, h, s));
const M_PROF = [[0, -.12], [.12, -.11], [.148, -.04], [.16, .06], [.15, .16], [.16, .27], [.185, .38], [.2, .45], [.17, .5], [.1, .53], [.05, .56]];
const F_PROF = [[0, -.12], [.13, -.11], [.16, -.04], [.162, .04], [.128, .15], [.138, .25], [.152, .33], [.148, .4], [.155, .45], [.13, .5], [.08, .53], [.045, .56]];
/* 조각된 두상: 구의 정점을 얼굴 해부학대로 변위 (UV 유지 → 얼굴 텍스처 정렬 그대로) */
function sculptHead(r, fem) {
  const g = new T.SphereGeometry(r, 72, 54), p = g.attributes.position, v = new T.Vector3();
  const B = (a, b, a0, b0, sa, sb) => Math.exp(-((a - a0) * (a - a0) / (sa * sa) + (b - b0) * (b - b0) / (sb * sb)));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize(), a = Math.atan2(n.x, n.z), b = Math.asin(U.clamp(-n.y, -1, 1)), front = Math.max(0, Math.cos(a));
    let d = .03 * B(a, b, 0, -.2, .6, .1) * front * (fem ? .6 : 1);                 // 눈썹뼈
    d += .045 * B(a, b, 0, .14, .07, .2);                                             // 콧대
    d += .028 * B(a, b, 0, .55, .2, .09);                                             // 입술 돌출
    d += .04 * B(a, b, 0, .84, .2, .11);                                              // 턱끝
    for (const s of [-1, 1]) { d -= .032 * B(a, b, s * .31, .04, .14, .09); d += .028 * B(a, b, s * .55, .23, .2, .13); d -= .03 * B(a, b, s * .72, .55, .2, .22); d -= .02 * B(a, b, s * .2, .42, .08, .08); }
    d -= .05 * B(a, b, Math.PI, .2, .6, .5) * (1 - front);                            // 뒤통수 정리
    if (TOON) { d *= .4; for (const s of [-1, 1]) d += .03 * B(a, b, s * .55, .4, .28, .22); }
    let k = 1 + d; v.multiplyScalar(k);
    if (b > .2) v.x *= 1 - (TOON ? (fem ? .14 : .1) : (fem ? .2 : .14)) * Math.min(1, (b - .2) / .8) * (.4 + .6 * front);   // 턱선 V
    if (b > .35) v.z += r * .03 * front * Math.min(1, (b - .35) / .5);                // 아래턱 앞으로
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
const TL = NC.TexLib;
const rimInject = (rgb, k) => sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', `{ vec3 vd = normalize(vViewPosition); float rim = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 2.6); gl_FragColor.rgb += vec3(${rgb}) * rim * ${k} * diffuseColor.rgb; }\n#include <tonemapping_fragment>`); };
function skinMat(skin, map) {
  const m = new T.MeshStandardMaterial({ roughness: .5, metalness: 0 });
  if (map) m.map = map; else { m.color = NC.col(skin); if (TL) { m.normalMap = TL.texture('skin', 'normal', {}, [5, 5]); m.normalScale.set(.3, .3); } }
  m.emissive = NC.col(skin).multiplyScalar(.018);        // 피하 산란(따뜻한 자체광 약간)
  m.onBeforeCompile = rimInject('1.0,0.45,0.35', '0.22'); return m;
}
/* 찢어진 데님: 무릎(허벅지 아래쪽) 부분에 흰 실밥 줄 */
function ripTex(color) {
  const key = 'rip' + color; if (patCache[key]) return patCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  const r = U.rng(31); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${r() * .08})`; g.fillRect(r() * 128, r() * 128, 1, 6); }
  g.fillStyle = 'rgba(240,236,228,.95)'; for (let k = 0; k < 7; k++) { const y = 102 + k * 3.2, x0 = 30 + r() * 14, w = 30 + r() * 30; g.fillRect(x0, y, w, 1.6); } g.fillStyle = 'rgba(200,170,150,.9)'; g.fillRect(44, 104, 26, 14);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return patCache[key] = t;
}
/* 의상 패턴(체크·스트라이프·호피·그래픽 티) — 색상별 캐시 */
const patCache = {};
function patternTex(kind, color) {
  const key = kind + color; if (patCache[key]) return patCache[key];
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), base = new T.Color(color), dark = '#' + base.clone().multiplyScalar(.45).getHexString(), lite = '#' + base.clone().lerp(new T.Color('#ffffff'), .55).getHexString();
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  if (kind === 'plaid') { g.globalAlpha = .55; g.fillStyle = dark; for (let i = 0; i < 4; i++) { g.fillRect(i * 64 + 8, 0, 26, S); g.fillRect(0, i * 64 + 8, S, 26); } g.globalAlpha = .8; g.fillStyle = '#111'; for (let i = 0; i < 4; i++) { g.fillRect(i * 64 + 18, 0, 6, S); g.fillRect(0, i * 64 + 18, S, 6); }
    g.globalAlpha = .6; g.fillStyle = lite; for (let i = 0; i < 4; i++) { g.fillRect(i * 64 + 48, 0, 2, S); g.fillRect(0, i * 64 + 48, S, 2); } g.globalAlpha = 1; }
  else if (kind === 'stripe') { g.fillStyle = '#f6f4f0'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 32, S, 16); }
  else if (kind === 'leopard') { g.fillStyle = '#d9a35a'; g.fillRect(0, 0, S, S); const r = U.rng(9); for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S, rr = 8 + r() * 8; g.fillStyle = '#7a4a1e'; g.beginPath(); g.ellipse(x, y, rr, rr * .8, r() * 3, 0, 7); g.fill(); g.strokeStyle = '#1a120c'; g.lineWidth = 3.5; for (let k = 0; k < 4; k++) { const a0 = k * 1.6 + r(); g.beginPath(); g.arc(x, y, rr + 1.5, a0, a0 + 1.0); g.stroke(); } } }
  else if (kind === 'graphic') { const words = ['1998', 'NIGHT', 'DJ', '★', 'LOVE', 'DISCO'], w = words[U.hash(color) % words.length], shapeK = U.hash(color + 's') % 3;
    const draw = cx => { g.save(); g.translate(cx, S * .42); g.fillStyle = lite; g.beginPath(); if (shapeK === 0) g.arc(0, 0, 50, 0, 7); else if (shapeK === 1) { for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? 26 : 56; g[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); } else g.rect(-52, -34, 104, 68); g.fill();
      g.fillStyle = dark; g.font = `900 ${w.length > 4 ? 24 : 34}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(w, 0, 2); g.restore(); }; draw(0); draw(S); }
  else if (kind === 'monogram') {   // 마름모 격자 + 작은 문양 (보랏빛 패턴 크롭 티)
    g.strokeStyle = lite; g.globalAlpha = .55; g.lineWidth = 2; for (let i = -S; i < S * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); g.beginPath(); g.moveTo(i + S, 0); g.lineTo(i, S); g.stroke(); }
    g.globalAlpha = .8; g.fillStyle = '#e8d8ff'; g.font = '700 14px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let y = 16; y < S; y += 32) for (let x = (y / 32 % 2) * 16; x < S; x += 32) g.fillText('◆', x, y); g.globalAlpha = 1; }
  else if (kind === 'graffiti') {   // 카고 바지 한쪽 다리 그래피티 프린트
    const r = U.rng(77); g.fillStyle = color; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) { g.strokeStyle = ['#ff5fa8', '#ffffff', '#c8a0ff', '#ff3d6a'][i % 4]; g.lineWidth = 5 + r() * 9; g.lineCap = 'round'; g.globalAlpha = .75; g.beginPath(); g.moveTo(r() * S, r() * S); g.bezierCurveTo(r() * S, r() * S, r() * S, r() * S, r() * S, r() * S); g.stroke(); }
    g.globalAlpha = .95; g.fillStyle = '#ffffff'; g.font = 'italic 900 46px Arial'; g.textAlign = 'center'; g.save(); g.translate(S / 2, S / 2); g.rotate(-.3); g.fillText('WILD', 0, -8); g.fillStyle = '#ff5fa8'; g.fillText('ONE', 10, 40); g.restore(); g.globalAlpha = 1; }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 4;
  if (kind === 'monogram') t.repeat.set(3, 3);
  if (kind === 'plaid' || kind === 'leopard') t.repeat.set(4, 2); else if (kind === 'stripe') t.repeat.set(1, 3); return patCache[key] = t;
}
/* v17 무대 의상 재질: 광택 가죽/비닐(클리어코트) · 튤(반투명 망사) */
function leatherMat(color, plain) {
  const low = NC.quality && NC.quality.level === 'low';
  const m = low ? new T.MeshStandardMaterial({ color: NC.col(color), roughness: .3, metalness: .12 }) : new T.MeshPhysicalMaterial({ color: NC.col(color), roughness: .34, metalness: .08, clearcoat: .9, clearcoatRoughness: .18, envMapIntensity: 1.5 });
  if (plain) { m.envMapIntensity = .55; if (m.clearcoat != null) { m.clearcoat = .35; m.clearcoatRoughness = .4; } m.roughness = .42; }   // 부츠·장갑: 주변 격자 반사가 망사처럼 보이지 않게 은은하게
  if (TL && !plain) { m.normalMap = TL.texture('leather', 'normal', {}, [3, 3]); m.normalScale.set(.18, .18); }
  m.onBeforeCompile = rimInject('1.0,1.0,1.0', '0.3'); return m;
}
const tulleMat = () => G('tulleM', () => new T.MeshStandardMaterial({ color: 0x0c0a10, roughness: .85, transparent: true, opacity: .72, side: T.DoubleSide, depthWrite: false }));
function clothMat(color, kind, o = {}) {
  const { pattern: _pt, ...so } = o; const m = NC.mat.std(color, so); if (!TL) return m;
  if (o.pattern && o.pattern !== 'solid') { m.map = patternTex(o.pattern, color); m.color.setRGB(1, 1, 1); m.normalMap = TL.texture('fabric', 'normal', {}, [9, 9]); m.normalScale.set(.5, .5); m.onBeforeCompile = rimInject('1.0,1.0,1.0', '0.25'); return m; }
  if (kind === 'sequin') { m.normalMap = TL.texture('sequin', 'normal', {}, [10, 10]); m.normalScale.set(.9, .9); m.metalness = .55; m.roughness = .3; m.envMapIntensity = 1.6; }
  else { m.map = TL.texture('fabric', 'map', {}, [kind === 'denim' ? 6 : 9, kind === 'denim' ? 6 : 9]); m.normalMap = TL.texture('fabric', 'normal', {}, [9, 9]); m.normalScale.set(.6, .6); }
  m.onBeforeCompile = rimInject('1.0,1.0,1.0', '0.25'); return m;
}
function mesh(g, m, x = 0, y = 0, z = 0, sx, sy, sz) { const o = new T.Mesh(g, m); o.position.set(x, y, z); if (sx != null) o.scale.set(sx, sy, sz); return o; }

function makeLabel(text, color) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = 'rgba(25,12,52,.78)'; g.strokeStyle = color || '#ff3d9a'; g.lineWidth = 3;
  g.beginPath(); g.roundRect ? g.roundRect(4, 8, 312, 60, 24) : g.rect(4, 8, 312, 60); g.fill(); g.stroke();
  g.font = '700 32px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(text, 160, 40);
  const s = new T.Sprite(new T.SpriteMaterial({ map: NC.tex(c), transparent: true, depthWrite: false })); s.scale.set(1.9, .48, 1); s.renderOrder = 10; return s;
}

function buildHair(skull, look, mHair, r, mHair2) {
  const hs = look.hairStyle, add = m => { skull.add(m); return m; };
  const cap = (rr, len, tilt) => { const m = new T.Mesh(G(`cap${rr}_${len}`, () => new T.SphereGeometry(rr, 30, 16, 0, Math.PI * 2, 0, Math.PI * len)), mHair); m.rotation.x = -tilt; return add(m); };
  const backFall = (L, rb, ts = Math.PI / 2, tl = Math.PI) => { const g = G(`bf${L}_${rb}_${ts}_${tl}`, () => { const c = new T.CylinderGeometry(r * 1.04, r * rb, L, 24, 1, true, ts, tl); c.translate(0, -L / 2 + r * .05, 0); return c; }); return add(new T.Mesh(g, mHair)); };
  const bangs = (ps, pl, th0, tl) => add(new T.Mesh(G(`bg${ps}_${pl}_${th0}_${tl}`, () => new T.SphereGeometry(r * 1.09, 20, 6, ps, pl, th0, tl)), mHair));
  const blob = (x, y, z, s, sy = s, sz = s) => add(mesh(sph(), mHair, x * r, y * r, z * r, s * r, sy * r, sz * r));
  const front = Math.PI / 2;
  switch (hs) {
    case 'long': case 'wavy':
      cap(r * 1.07, .5, .45); backFall(r * (hs === 'wavy' ? 2.6 : 2.9), hs === 'wavy' ? 1.32 : 1.14, Math.PI / 2 - .32, Math.PI + .64);
      bangs(front - .95, 1.9, Math.PI / 2 - .5, .26);
      break;
    case 'bob': cap(r * 1.08, .5, .42); backFall(r * 1.3, 1.16, Math.PI / 2 - .35, Math.PI + .7); bangs(front - .8, 1.6, Math.PI / 2 - .5, .3); break;
    case 'ponytail': cap(r * 1.06, .5, .5); blob(0, .35, -.98, .32); { const t = mesh(cyl(r * .32, r * .08, r * 2.6), mHair, 0, -r * .9, -r * 1.25); t.rotation.x = .25; skull.add(t); } bangs(front - .7, 1.4, Math.PI / 2 - .55, .2); break;
    case 'bun': cap(r * 1.06, .5, .5); blob(0, .78, -.72, .46); bangs(front - .6, 1.2, Math.PI / 2 - .55, .18); break;
    case 'curly': cap(r * 1.08, .5, .42); { const rr = U.rng(U.hash(look.hairColor + 'c')); for (let i = 0; i < 22; i++) { const a = rr() * Math.PI * 2, el = .25 + rr() * 1.2; if (Math.cos(a - front) > .55 && el < .55) continue; blob(Math.cos(a) * Math.cos(el) * 1.05, Math.sin(el) * 1.05, Math.sin(a) * Math.cos(el) * -1.05, .3); } } break;
    case 'buzz': cap(r * 1.03, .5, .5); break;
    case 'twin': cap(r * 1.07, .5, .45); bangs(front - .9, 1.8, Math.PI / 2 - .5, .26);
      for (const s of [-1, 1]) { blob(s * .95, .35, -.25, .3); const t = mesh(cyl(r * .3, r * .1, r * 2.6), mHair, s * r * 1.25, -r * .8, -r * .3); t.rotation.z = s * .32; skull.add(t); const tie = mesh(G('tie', () => new T.TorusGeometry(r * .2, r * .06, 6, 14)), G('tieM', () => std('#ff4f9a', { roughness: .4 })), s * r * 1.02, r * .22, -r * .25); tie.rotation.y = Math.PI / 2; tie.rotation.x = s * .3; skull.add(tie); } break;
    case 'braids': cap(r * 1.07, .5, .45); bangs(front - .9, 1.8, Math.PI / 2 - .5, .24);
      for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const sc = .26 - k * .022; blob(s * (.88 + k * .02), -.35 - k * .34, .05 + Math.min(k, 3) * .05, sc, sc * 1.25, sc); } break;
    case 'spiky': cap(r * 1.06, .5, .5); { const rr = U.rng(U.hash(look.hairColor + 'sp')); for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, el = .55 + rr() * .5; const cn = mesh(G('spk', () => new T.ConeGeometry(1, 1, 7)), mHair, Math.cos(a) * Math.cos(el) * r * .8, Math.sin(el) * r * .95, Math.sin(a) * Math.cos(el) * -r * .8 + r * .1, r * .22, r * .55, r * .22); cn.lookAt(cn.position.clone().multiplyScalar(3).add(new T.Vector3(0, r * .5, -r * .3))); cn.rotateX(Math.PI / 2); skull.add(cn); } } bangs(front - .7, 1.4, Math.PI / 2 - .6, .22); break;
    case 'slick': cap(r * 1.09, .5, .55); blob(0, .72, .42, .62, .32, .6); break;
    case 'side': cap(r * 1.08, .5, .45); { const b = bangs(front - .2, 1.3, Math.PI / 2 - .62, .28); b.rotation.z = -.12; } break;
    case 'twoblock': cap(r * 1.04, .5, .5); blob(0, .62, .05, 1.0, .52, 1.0); bangs(front - .75, 1.5, Math.PI / 2 - .6, .24); break;
    // ── v17 아이돌 헤어 ──
    case 'hime':   // 긴 생머리 + 일자 앞머리 + 얼굴 옆 사이드락
      cap(r * 1.08, .5, .42); backFall(r * 3.3, 1.12, Math.PI / 2 - .3, Math.PI + .6); bangs(front - 1.05, 2.1, Math.PI / 2 - .62, .42);
      for (const sd of [-1, 1]) { const sl = mesh(G('slock', () => new T.BoxGeometry(1, 1, 1)), mHair2 || mHair, sd * r * .93, -r * .95, r * .42, r * .2, r * 2.0, r * .13); sl.rotation.set(-.08, sd * .35, sd * .05); skull.add(sl); }
      break;
    case 'twinHigh':   // 하이 트윈테일 (정수리 양옆에서 길게)
      cap(r * 1.07, .5, .45); bangs(front - .95, 1.9, Math.PI / 2 - .55, .34);
      for (const sd of [-1, 1]) { blob(sd * .78, .8, -.38, .3); const t1 = mesh(cyl(r * .3, r * .2, r * 1.6), mHair, sd * r * 1.25, r * .2, -r * .5); t1.rotation.z = sd * .55; skull.add(t1);
        const t2 = mesh(cyl(r * .2, r * .06, r * 2.6), mHair2 || mHair, sd * r * 1.62, -r * 1.65, -r * .55); t2.rotation.z = sd * .12; skull.add(t2);
        const tie = mesh(G('tie', () => new T.TorusGeometry(r * .2, r * .06, 6, 14)), G('tieBk', () => std('#0c0a0e', { roughness: .4 })), sd * r * .9, r * .78, -r * .38); tie.rotation.set(sd * .3, Math.PI / 2, sd * .5); skull.add(tie); }
      break;
    case 'spaceBuns':   // 양쪽 똥머리 + 뒤로 내린 긴 머리
      cap(r * 1.07, .5, .45); backFall(r * 2.6, 1.1, Math.PI / 2 - .3, Math.PI + .6); bangs(front - .9, 1.8, Math.PI / 2 - .55, .3);
      for (const sd of [-1, 1]) { blob(sd * .62, .98, -.25, .36); const bn = mesh(G('bunT', () => new T.TorusGeometry(r * .3, r * .08, 6, 16)), mHair, sd * r * .62, r * .98, -r * .25); bn.rotation.set(Math.PI / 2 - .4, sd * .3, 0); skull.add(bn); }
      break;
    case 'highPony':   // 정수리 하이 포니테일
      cap(r * 1.06, .5, .5); blob(0, .92, -.62, .34); bangs(front - .8, 1.6, Math.PI / 2 - .58, .28);
      { const t = mesh(cyl(r * .3, r * .07, r * 3.4), mHair, 0, -r * .4, -r * 1.35); t.rotation.x = .32; skull.add(t); const tie = mesh(G('tie', () => new T.TorusGeometry(r * .2, r * .06, 6, 14)), G('tieBk', () => std('#0c0a0e', { roughness: .4 })), 0, r * .9, -r * .7); tie.rotation.x = 1.0; skull.add(tie); }
      break;
    case 'comma':   // 남자 아이돌 콤마 헤어 (앞머리를 쉼표처럼 넘김)
      cap(r * 1.06, .5, .5); blob(0, .58, .2, .98, .5, .98); { const b = bangs(front - .55, 1.1, Math.PI / 2 - .7, .36); b.rotation.z = .12; } blob(.42, .3, .88, .2, .32, .14); break;
    case 'wolf':   // 울프컷: 정수리 볼륨 + 목덜미로 내려오는 레이어
      cap(r * 1.08, .5, .45); blob(0, .62, -.05, 1.02, .5, 1.02); backFall(r * 1.5, 1.08, Math.PI / 2 - .2, Math.PI + .4); bangs(front - .8, 1.6, Math.PI / 2 - .58, .3); break;
    default: cap(r * 1.07, .5, .45);
  }
  if (mHair2 && ['long', 'wavy', 'highPony', 'spaceBuns'].includes(hs)) for (const sd of [-1, 1]) { const st = mesh(G('slock', () => new T.BoxGeometry(1, 1, 1)), mHair2, sd * r * .95, -r * .8, r * .3, r * .14, r * 1.7, r * .1); st.rotation.set(-.05, sd * .4, sd * .06); skull.add(st); }
  if (TOON && !['buzz', 'slick', 'spiky', 'comma'].includes(hs)) {   // 앞머리·옆머리 덩어리감 (스타일라이즈드 볼륨)
    const rr = U.rng(U.hash(look.hairColor + hs)), long = ['long', 'wavy', 'bob', 'twin', 'braids', 'spaceBuns'].includes(hs);
    const hatted = !!look.hat; for (let k = -2; k <= 2; k++) { const a = k * .26 + (rr() - .5) * .06, m = mesh(sph(), mHair, Math.sin(a) * r * 1.02, r * ((hatted ? .1 : .5) - Math.abs(k) * .04), Math.cos(a) * r * (hatted ? .95 : .98), r * .17, r * (hatted ? .22 : .36 + rr() * .08), r * .12); m.rotation.set(-.35, a, k * -.18); skull.add(m); }
    if (long) for (const s of [-1, 1]) { const m = mesh(sph(), mHair, s * r * .9, -r * .25, r * .45, r * .16, r * .62, r * .12); m.rotation.set(-.1, s * .5, s * .08); skull.add(m); }
  }
}


/* ── 드로우콜 절감: 같은 관절(그룹) 안에서 같은 머티리얼을 쓰는 정적 메시를 하나로 병합 ── */
function mergeGeos(list) {
  let V = 0, I = 0; list.forEach(g => { V += g.attributes.position.count; I += g.index ? g.index.count : g.attributes.position.count; });
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2), idx = new Uint32Array(I); let vo = 0, io = 0;
  list.forEach(g => { const n = g.attributes.position.count; pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) for (let k = 0; k < g.index.count; k++) idx[io++] = g.index.array[k] + vo; else for (let k = 0; k < n; k++) idx[io++] = k + vo; vo += n; });
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('uv', new T.BufferAttribute(uv, 2)); out.setIndex(new T.BufferAttribute(idx, 1)); out.computeBoundingSphere(); return out;
}
function mergeStatic(root) {
  const groups = []; root.traverse(o => { if (o.isGroup || o === root) groups.push(o); });
  groups.forEach(gr => {
    const byMat = new Map();
    gr.children.forEach(c => { if (c.isMesh && !c.userData.noMerge && c.children.length === 0) { const k = c.material.uuid; if (!byMat.has(k)) byMat.set(k, []); byMat.get(k).push(c); } });
    byMat.forEach(list => { if (list.length < 2) return; const geos = list.map(m => { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
      const merged = new T.Mesh(mergeGeos(geos), list[0].material); list.forEach(m => gr.remove(m)); geos.forEach(g => g.dispose()); gr.add(merged); });
  });
}

/* v12 겉옷 벗기기: 상의(겉옷) 재질을 쓰는 메시를 찾아 → 몸통은 실크 캐미솔, 팔은 맨살, 오버셔츠 겉감은 숨김. off 로 원래대로.
 *  (정적 메시는 재질별로 병합되어 있어 '재질 교체' 방식으로 처리 — 노출 표현 없음: 캐미솔/슬립 이너가 남는다) */
function undress(g, on) {
  const u = g.userData; if (!u || !u.mats || !u.fig) return false;
  if (!on) { if (u.undressed) { u.undressed.forEach((st, o) => { o.material = st.m; o.visible = st.v; }); u.undressed = null; } return true; }
  if (u.undressed) return true;
  const { top, sleeve, skin, kind, inner } = u.mats, R = u.rig, arms = new Set([R.shL, R.elL, R.shR, R.elR]);
  const cami = std(kind === 'dress' ? '#1a0b14' : (inner && inner !== '#f6f6f6' ? inner : '#5a0f24'), { roughness: .2, metalness: .18 });
  u.undressed = new Map();
  u.fig.traverse(o => { if (!o.isMesh || (o.material !== top && o.material !== sleeve)) return;
    u.undressed.set(o, { m: o.material, v: o.visible });
    if (arms.has(o.parent)) o.material = skin; else if (kind === 'overshirt' && o.material === top) o.visible = false; else o.material = cami; });
  return true;
}
/* ───────── 아바타 생성 ───────── */
function create(o = {}) {
  const look = safeLook(mergeLook(o.seed != null ? o.seed : U.hash(o.name || String(Math.random())), o.gender, o.look));
  const f = look.gender === 'f', B = (look.build || 1) * (TOON ? .88 : 1), LIMB = TOON ? .9 : 1, CV = look.curve != null ? look.curve : (f ? .6 : .5), MU = f ? 0 : U.clamp(look.muscle || 0, 0, 1);   // MU: 남성 근육량   // CV: 여성 글래머 / 남성 어깨
  const root = new T.Group(), fig = new T.Group(); root.add(fig);
  const figScale = look.height / (TOON ? 1.86 : 1.75); fig.scale.setScalar(figScale);
  const body = new T.Group(); fig.add(body);
  const hipH = TOON ? 1.06 : .965, hips = new T.Group(); hips.position.y = hipH; body.add(hips);
  const torso = new T.Group(); hips.add(torso);
  const shiny = look.top === 'dress' ? { roughness: .32, metalness: .28 } : look.top === 'jacket' ? { roughness: .45, metalness: .1 } : { roughness: .6 };
  const pat = look.top === 'dress' ? (look.pattern === 'leopard' ? 'leopard' : 'solid') : look.pattern;
  const LEATHER_TOP = look.top === 'halter' || look.top === 'stageJacket';
  const mSkin = skinMat(look.skin), mTop = LEATHER_TOP ? leatherMat(look.topColor) : clothMat(look.topColor, look.top === 'dress' ? 'sequin' : 'fabric', Object.assign({ pattern: pat }, shiny)), mBot = look.bottom === 'cargo' ? clothMat(look.bottomColor, 'fabric', { roughness: .85 }) : clothMat(look.bottomColor, 'denim', { roughness: .8 }),
    mShoe = std(TOON ? (look.shoeColor || '#f4f4f6') : '#141018', { roughness: TOON ? .5 : .22, metalness: TOON ? 0 : .3 }), mHair = std(look.hairColor, { roughness: TOON ? .34 : .42, metalness: .05, side: T.DoubleSide }),
    mSleeve = look.top === 'vest' ? std('#f4f2ee') : mTop;
  if (look.set && look.pattern && look.pattern !== 'solid' && look.bottom !== 'skirt') { mBot.map = patternTex(look.pattern, look.topColor); mBot.color.setRGB(1, 1, 1); }   // 상하 같은 패턴 셋업
  const mRip = look.fit === 'ripped' ? (() => { const m = clothMat(look.bottomColor, 'denim', { roughness: .85 }); m.map = ripTex(look.bottomColor); m.color.setRGB(1, 1, 1); return m; })() : null;
  // 몸통
  const curveK = y => f ? (y > .28 && y < .44 ? 1 + .07 * CV : y > .1 && y < .2 ? 1 - .07 * CV : y > -.08 && y < .06 ? 1 + .09 * CV : 1) : (y > .36 ? 1 + .1 * (CV - .5) + .16 * MU : y > .22 ? 1 + .13 * MU : y > .08 && y < .2 ? 1 - .02 * MU : 1);
  const prof = (f ? F_PROF : M_PROF).map(([rr, y]) => new T.Vector2(rr * B * curveK(y), y)), PK = look.gender + B.toFixed(2) + CV.toFixed(2) + MU.toFixed(2);
  const crop = ['crop', 'halter', 'blazerCrop', 'meshCrop'].includes(look.top), over = look.top === 'overshirt', strap = !!look.strapless && (look.top === 'dress' || crop);   // v14: 스트랩리스 드레스 / 튜브탑
  const tor = mesh(G('tor' + PK, () => new T.LatheGeometry(prof, 22)), crop || strap ? mSkin : over ? clothMat(look.innerColor || '#f6f6f6', 'fabric') : mTop); tor.scale.z = .68; torso.add(tor);
  if (strap && !crop) { const sd = mesh(G('strap' + PK, () => new T.LatheGeometry(prof.filter(v => v.y <= .4).map(v => new T.Vector2(v.x * 1.03, v.y)), 22)), mTop); sd.scale.z = .7; torso.add(sd); }
  if (crop) { const up = mesh(G((strap ? 'tube' : 'crop') + PK, () => new T.LatheGeometry(prof.filter(v => strap ? v.y >= .2 && v.y <= .4 : v.y >= .14).map(v => new T.Vector2(v.x * 1.04, v.y)), 22)), mTop); up.scale.z = .7; torso.add(up);
    const hem = mesh(G('hem' + B.toFixed(2), () => new T.TorusGeometry(1, .06, 5, 22)), mTop, 0, .15, 0, (f ? .132 : .155) * B, (f ? .132 : .155) * B, (f ? .132 : .155) * B); hem.rotation.x = Math.PI / 2; hem.scale.y = .7 * (f ? .132 : .155) * B; torso.add(hem); }
  if (look.top === 'halter') { const hn = mesh(cyl(.044, .052, .09), mTop, 0, .555, .004); torso.add(hn); }   // v17 홀터: 목까지 감싸는 하이넥
  if (look.top === 'blazerCrop') {   // v17 크롭 블레이저: 라펠 + 금장 단추 + 안쪽 블랙 탑
    const lm = std('#0a080c', { roughness: .5 }); for (const sd of [-1, 1]) { const lp = mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), lm, sd * .04, .44, .105 * B, .026, .15, .006); lp.rotation.set(-.32, sd * .25, sd * .28); torso.add(lp); }
    const bm = G('btnM', () => std('#e8c56a', { metalness: .95, roughness: .2 })); for (const y of [.2, .27]) torso.add(mesh(sph(), bm, .03, y, .128 * B, .009, .009, .006)); }
  if (look.top === 'stageJacket') {   // v17 남성 무대 재킷: 라이더 지퍼 + 은색 체인 장식
    const zm = G('zipM', () => std('#d8d8e0', { metalness: 1, roughness: .2 })); const zp = mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), zm, .03, .3, .118 * B * 1.06, .006, .42, .006); zp.rotation.z = .12; torso.add(zp);
    for (const sd of [-1, 1]) { const ch = mesh(G('chainT', () => new T.TorusGeometry(.09, .004, 5, 26, Math.PI)), zm, sd * .06, .42, .1 * B, 1, 1, 1); ch.rotation.set(-.15, 0, Math.PI + sd * .4); torso.add(ch); } }
  if (look.choker) { const ck = mesh(G('choker', () => new T.TorusGeometry(.043, .007, 6, 24)), G('chokM', () => std('#0c0a0e', { roughness: .4 })), 0, .585, .004); ck.rotation.x = Math.PI / 2; torso.add(ck);
    torso.add(mesh(sph(), G('neckM', () => std('#e8c56a', { metalness: .95, roughness: .2 })), 0, .575, .048, .006, .008, .004)); }
  if (look.chain) { const cm = G('chainM', () => std('#dcdce6', { metalness: 1, roughness: .18 })); const c1 = mesh(G('chain1', () => new T.TorusGeometry(.085, .0035, 5, 30)), cm, 0, .47, .04); c1.rotation.x = Math.PI / 2 - .55; c1.scale.set(1, 1.2, 1); torso.add(c1);
    torso.add(mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), cm, 0, .395, .1 * B, .016, .022, .005)); }
  if ((look.top === 'jacket' || over) && look.inner === 'turtle') { const tn = mesh(cyl(.05, .056, .1), clothMat(look.innerColor || '#2a2a2e', 'fabric'), 0, .56, .004); torso.add(tn); }
  if (look.necklace) { const nk = mesh(G('neck', () => new T.TorusGeometry(.068, .004, 6, 28)), G('neckM', () => std('#e8c56a', { metalness: .95, roughness: .2 })), 0, .5, .028); nk.rotation.x = Math.PI / 2 - .5; nk.scale.set(1, 1.15, 1); torso.add(nk); }
  if (over) { const shell = mesh(G('over' + PK, () => new T.LatheGeometry(prof.filter(v => v.y >= -.12).map(v => new T.Vector2(v.x * 1.06, v.y)), 22, Math.PI * .14, Math.PI * 1.72)), mTop); shell.scale.z = .7; shell.material.side = T.DoubleSide; torso.add(shell);
    const col2 = mesh(G('collar', () => new T.TorusGeometry(.06, .014, 6, 14)), mTop, 0, .54, -.005, 1.15, .8, 1); col2.rotation.x = Math.PI / 2; torso.add(col2); }
  if (look.top === 'jacket' || look.top === 'vest' || look.top === 'stageJacket') {   // V넥 안쪽 셔츠
    const vg = G('vneck', () => { const sh = new T.Shape(); sh.moveTo(-.07, .17); sh.lineTo(.07, .17); sh.lineTo(0, -.06); sh.closePath(); return new T.ShapeGeometry(sh); });
    const inner = mesh(vg, std(look.top === 'vest' ? '#f4f2ee' : look.top === 'stageJacket' ? (look.innerColor || '#141016') : (f ? '#f2e6ee' : '#f4f2ee')), 0, .36, .112); inner.rotation.x = -.22; torso.add(inner); }
  if (look.top === 'vest') { const bt = std('#0d0b10'); for (const s of [-1, 1]) { const w = mesh(G('cone', () => new T.ConeGeometry(1, 1, 4)), bt, s * .028, .5, .12, .022, .04, .012); w.rotation.z = s * Math.PI / 2; w.position.y = .505; w.position.z = .118; torso.add(w); } }
  if (look.top === 'shirt') { const col = mesh(G('collar', () => new T.TorusGeometry(.06, .014, 6, 14)), mTop, 0, .54, .01, 1, .75, 1); col.rotation.x = Math.PI / 2; torso.add(col); }
  if (f) {   // v12: 여성 실루엣 — 가슴 볼륨(의상 재질), 크기는 CV(글래머)
    const bm = LEATHER_TOP ? G('bustMatte' + look.topColor, () => std(look.topColor, { roughness: .62 })) : crop ? mTop : over ? clothMat(look.innerColor || '#f6f6f6', 'fabric') : mTop, bk = (.78 + .5 * CV) * B * (look.idol ? .9 : 1);
    for (const sd of [-1, 1]) { const bu = mesh(sph(), bm, sd * .056 * B, .352, .068 * B, .064 * bk, .06 * bk, .052 * bk); bu.rotation.x = .25; torso.add(bu); }
  }
  if (look.wings) {   // v14: 패션쇼 느낌의 깃털 날개 액세서리 (등)
    const wm = G('wingM' + look.wings, () => new T.MeshStandardMaterial({ color: look.wings === 'pink' ? 0xffc8e0 : look.wings === 'black' ? 0x1a1420 : 0xfaf6ff, roughness: .55, metalness: .05, side: T.DoubleSide, emissive: look.wings === 'black' ? 0x000000 : 0x302830 }));
    const wg = G('wingG', () => { const sh2 = new T.Shape(); sh2.moveTo(0, 0); sh2.bezierCurveTo(.12, .28, .36, .46, .5, .5); sh2.bezierCurveTo(.46, .3, .4, .1, .44, -.12); sh2.bezierCurveTo(.32, -.06, .2, -.2, .14, -.34); sh2.bezierCurveTo(.08, -.18, .04, -.08, 0, 0); return new T.ShapeGeometry(sh2, 14); });
    for (const sd of [-1, 1]) { const w = mesh(wg, wm, sd * .05, .36, -.11, sd, 1, 1); w.scale.x = sd; w.rotation.y = -sd * .45; w.userData.noMerge = true; torso.add(w); }
  }
  const mSkirtL = look.bottom === 'leather' ? leatherMat(look.bottomColor) : null;
  const hip = mesh(cyl(.172 * B * (f ? 1 + .1 * CV : 1), .158 * B * (f ? 1 + .12 * CV : 1), .18, 18), look.bottom === 'pants' || look.bottom === 'shorts' || look.bottom === 'cargo' ? mBot : look.bottom === 'leather' ? mSkirtL : look.bottom === 'tutu' ? std('#0d0b10', { roughness: .6 }) : (look.top === 'dress' ? mTop : std(look.bottomColor, { roughness: .6 })), 0, -.05, 0); hip.scale.z = .7; hips.add(hip);
  if (look.bottom === 'pants') { const belt = mesh(G('belt', () => new T.TorusGeometry(1, .08, 5, 22)), std('#18141c', { metalness: .4, roughness: .35 }), 0, .03, 0, .163 * B, .163 * B, .163 * B); belt.rotation.x = Math.PI / 2; belt.scale.y = .7 * .163 * B; hips.add(belt); }
  let skirt = null;
  if (look.belt || look.bottom === 'cargo') { const bt = mesh(G('beltW', () => new T.TorusGeometry(1, .16, 5, 24)), G('beltWM', () => std('#0c0a0e', { roughness: .35, metalness: .2 })), 0, .045, 0, .17 * B * (f ? 1 + .1 * CV : 1), .17 * B, .17 * B); bt.rotation.x = Math.PI / 2; bt.scale.y = .7 * .17 * B; hips.add(bt);
    hips.add(mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), G('chainM', () => std('#dcdce6', { metalness: 1, roughness: .18 })), 0, .045, .125 * B, .04, .03, .008)); }
  if (look.bottom === 'tutu') {   // v17 튤 스커트: 망사 3겹 + 안감
    skirt = new T.Group(); hips.add(skirt);
    [[.3, .24, 0], [.33, .22, .015], [.36, .2, .03]].forEach(([fl, len, dy], k) => { const m = mesh(G('tutu' + k + B.toFixed(2), () => new T.LatheGeometry([[.17 * B, .04 - dy], [.22 * B, -.04 - dy], [fl * B, -len - dy]].map(([a, b]) => new T.Vector2(a, b)), 26)), tulleMat()); m.scale.z = .82; m.userData.noMerge = true; skirt.add(m); });
    const lin = mesh(G('tutuL' + B.toFixed(2), () => new T.LatheGeometry([[.172 * B, .05], [.2 * B, -.06], [.22 * B, -.14]].map(([a, b]) => new T.Vector2(a, b)), 22)), std('#0d0b10', { roughness: .6, side: T.DoubleSide })); lin.scale.z = .8; lin.userData.noMerge = true; skirt.add(lin); }
  if (look.bottom === 'leather') { skirt = mesh(G('skL' + B.toFixed(2), () => new T.LatheGeometry([[.172 * B, .05], [.2 * B, -.08], [.235 * B, -.2], [.24 * B, -.22]].map(([a, b]) => new T.Vector2(a, b)), 22)), mSkirtL); skirt.material.side = T.DoubleSide; skirt.scale.z = .8; skirt.userData.noMerge = true; hips.add(skirt); }
  if (look.bottom === 'skirt') { const len = look.top === 'dress' ? (look.mini ? .27 : .44) : (look.mini ? .23 : .34); skirt = mesh(G('sk' + len + B.toFixed(2), () => new T.LatheGeometry([[.172 * B, .05], [.2 * B, -.1], [.25 * B, -len + .04], [.262 * B, -len]].map(([a, b]) => new T.Vector2(a, b)), 22)), look.top === 'dress' ? mTop : std(look.bottomColor, { roughness: .5, side: T.DoubleSide })); skirt.material.side = T.DoubleSide; skirt.scale.z = .8; skirt.userData.noMerge = true; hips.add(skirt); }
  // 목 · 머리
  const neck = new T.Group(); neck.position.y = .55; torso.add(neck);
  neck.add(TOON ? mesh(cyl(f ? .036 : .044 * (1 + .3 * MU), f ? .046 : .054 * (1 + .3 * MU), .15), mSkin, 0, .05, .005) : mesh(cyl(.046, .054, .12), mSkin, 0, .04, .005));
  const head = new T.Group(); head.position.y = TOON ? .1 : .075; head.scale.setScalar(HEAD_S); neck.add(head);
  const F = look.face, r = .115, sx = .86 * (F.faceW || 1), sy = 1.03 * (F.jaw || 1), sz = .98;
  const skull = new T.Group(); skull.position.set(0, .095, .012); skull.scale.set(sx, sy, sz); head.add(skull);
  const hi = o.hiRes && !(NC.quality && NC.quality.level === 'low');
  const lowQ = NC.quality && NC.quality.level === 'low', fcv = document.createElement('canvas'); fcv.width = hi ? FW * 2 : lowQ && !o.hiRes ? FW / 2 : FW; fcv.height = hi ? FH * 2 : lowQ && !o.hiRes ? FH / 2 : FH;   // v17: 저사양은 얼굴 텍스처 절반 크기(그리기 CPU ¼)
  const ftex = NC.tex(fcv); ftex.anisotropy = 8;
  const headMat = skinMat(look.skin, ftex); headMat.color.setRGB(1, 1, 1);
  const headMesh = new T.Mesh(G('head' + look.gender, () => sculptHead(r, f)), headMat); headMesh.userData.noMerge = true; skull.add(headMesh);
  const onHead = (a, b, k = 1) => new T.Vector3(r * k * Math.sin(a) * Math.cos(b), -r * k * Math.sin(b), r * k * Math.cos(a) * Math.cos(b));
  const nose = mesh(sph(), mSkin); nose.position.copy(onHead(0, .24, .975)); nose.position.copy(onHead(0, .27, .955)); const nk = TOON ? (f ? .6 : .74) : 1; if (!f) nose.position.copy(onHead(0, .25, .935)); nose.scale.set((f ? .0105 : .0118) * F.nose * nk / sx, (f ? .016 : .018) * F.nose * nk / sy, (f ? .0135 : .0082) * F.nose * nk);   // v14: 남성 코 — 덜 튀어나오고 넓게 (피노키오 느낌 제거) nose.rotation.x = -.5; skull.add(nose);
  for (const s of [-1, 1]) { const ear = mesh(sph(), mSkin); ear.position.copy(onHead(s * 1.48, .06)); ear.scale.set(.009 / sx, .026 / sy, .018); skull.add(ear);
    if (F.earring) { const er = mesh(sph(), std('#f2d27a', { metalness: .9, roughness: .2 })); er.position.copy(onHead(s * 1.48, .3, 1.02)); er.scale.set(.008 / sx, .008 / sy, .008); skull.add(er); } }
  const EXL = (TOON ? .33 : .31) + (F.eyeGap || 0), EYL = TOON ? .1 : .05;
  const corneaMat = G('cornea', () => new T.MeshStandardMaterial({ color: 0x000000, roughness: .04, metalness: 0, envMapIntensity: 1.4, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  const corneaGeo = mergeGeos([-1, 1].map(s => { const c = mesh(sph(), corneaMat); c.position.copy(onHead(s * EXL, EYL - .005, .955)); const es = (F.eyeSize || 1) * EYE_K / 1.3; c.scale.set(.017 * es / sx, .012 * es * (TOON ? 1.3 : 1) / sy, .009); c.updateMatrix(); const g = sph().clone(); g.applyMatrix4(c.matrix); return g; }));
  const corneaMesh = new T.Mesh(corneaGeo, corneaMat); corneaMesh.userData.noMerge = true; skull.add(corneaMesh); const corneas = [corneaMesh];
  const mHair2 = look.hair2 ? std(look.hair2, { roughness: .32, metalness: .05, side: T.DoubleSide }) : null;   // v17 투톤(브릿지) 헤어
  buildHair(skull, look, mHair, r, mHair2);
  if (F.glasses) {
    const gm = std('#141418', { metalness: .6, roughness: .3 }), gl = new T.Group(); head.add(gl); gl.position.set(0, .095, .012);
    const ex = EXL, ls = TOON ? 1.45 : 1;
    for (const s of [-1, 1]) { const p = onHead(s * ex, EYL, 1); const ring = mesh(G('lens', () => new T.TorusGeometry(.024, .0028, 6, 22)), gm, p.x * sx, p.y * sy, p.z * sz + .012); ring.scale.set(1.15 * ls, .85 * ls, 1); gl.add(ring);
      const arm = mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), gm, s * .052, .004, -.03, .003, .004, .1); gl.add(arm); }
    gl.add(mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), gm, 0, .006, r * sz + .01, .022, .003, .003));
  }
  if (F.sunglasses && !F.glasses) {   // 선글라스: 광택 렌즈 + 브릿지
    const gl = new T.Group(); head.add(gl); gl.position.set(0, .095, .012); const lm = std('#0c0c12', { roughness: .05, metalness: .7 }), fm = std('#1a1a1a', { roughness: .4 });
    for (const s of [-1, 1]) { const p = onHead(s * EXL, EYL, 1.0); const lens = mesh(sph(), lm, p.x * sx, p.y * sy, p.z * sz + .012, .027, .017, .005); gl.add(lens); gl.add(mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), fm, s * .08, p.y * sy + .01, -.01, .004, .005, .1)); }
    gl.add(mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), fm, 0, onHead(0, EYL).y * sy + .012, r * sz + .014, .03, .005, .004));
  }
  if (look.hat && TOON) {   // 모자 (두개골 그룹 안 → 머리 비율 그대로)
    const hm = std(look.hatColor || '#222', { roughness: .75 }), hg = new T.Group(); skull.add(hg);
    if (look.hat === 'cap') { hg.add(mesh(G('capd', () => new T.SphereGeometry(r * 1.14, 28, 14, 0, Math.PI * 2, 0, Math.PI * .5)), hm)); const brim = mesh(G('capb', () => new T.CylinderGeometry(r * .78, r * .78, r * .06, 24, 1, false, -Math.PI / 2, Math.PI)), hm, 0, r * .1, r * .72); brim.scale.set(1, 1, 1.15); brim.rotation.x = .32; hg.add(brim); hg.rotation.x = -.18; hg.position.y = r * .08; hg.add(mesh(sph(), hm, 0, r * 1.12, 0, r * .07, r * .05, r * .07)); }
    else if (look.hat === 'beanie') { const d = mesh(G('bean', () => new T.SphereGeometry(r * 1.15, 26, 14, 0, Math.PI * 2, 0, Math.PI * .55)), hm); d.scale.y = 1.15; hg.add(d); const band = mesh(G('beanb', () => new T.TorusGeometry(r * 1.1, r * .1, 8, 30)), hm, 0, r * .08, 0); band.rotation.x = Math.PI / 2; hg.add(band); hg.add(mesh(sph(), hm, 0, r * 1.38, 0, r * .16, r * .16, r * .16)); hg.position.y = r * .05; }
    else if (look.hat === 'beret') { const b = mesh(G('beret', () => new T.SphereGeometry(r * 1.22, 26, 12)), hm, r * .1, r * .62, -r * .05, 1, .38, 1); b.rotation.z = -.2; hg.add(b); hg.add(mesh(sph(), hm, r * .12, r * 1.08, 0, r * .06, r * .06, r * .06)); }
    else if (look.hat === 'newsboy') { const c = mesh(G('newsC', () => new T.SphereGeometry(r * 1.2, 26, 12, 0, Math.PI * 2, 0, Math.PI * .5)), hm, 0, r * .05, -r * .04, 1, .78, 1.05); hg.add(c); const br = mesh(G('capb', () => new T.CylinderGeometry(r * .78, r * .78, r * .06, 24, 1, false, -Math.PI / 2, Math.PI)), hm, 0, r * .12, r * .8); br.scale.set(.9, 1, .7); br.rotation.x = .25; hg.add(br); hg.add(mesh(sph(), hm, 0, r * .98, 0, r * .07, r * .04, r * .07)); hg.rotation.x = -.12; }
    else if (look.hat === 'fedora') { hg.add(mesh(G('fedc', () => new T.CylinderGeometry(r * .82, r * 1.0, r * .75, 24)), hm, 0, r * .88, 0)); hg.add(mesh(G('fedb', () => new T.CylinderGeometry(r * 1.75, r * 1.75, r * .04, 32)), hm, 0, r * .52, 0)); hg.add(mesh(G('fedr', () => new T.CylinderGeometry(r * 1.005, r * 1.005, r * .14, 24, 1, true)), std('#141014', { roughness: .5 }), 0, r * .6, 0)); hg.rotation.x = -.1; hg.position.y = r * .02; }
  }
  // 팔
  const bare = ['tee', 'dress', 'crop', 'halter', 'meshCrop'].includes(look.top);
  const arm = s => {
    const sh = new T.Group(); sh.position.set(s * (f ? .172 : .198 * (1 + .12 * (CV - .5) + .1 * MU)) * B * (TOON ? 1.02 : 1), .45, 0); torso.add(sh);
    sh.add(mesh(sph(), look.top === 'dress' || look.top === 'halter' || strap ? mSkin : mSleeve, 0, -.01, 0, .052 * B * (1 + .4 * MU), .052, .052));
    sh.add(mesh(cyl(.05 * B * LIMB * (1 + .5 * MU), .042 * LIMB * (1 + .35 * MU), .28), bare ? mSkin : mSleeve, 0, -.14, 0));
    if (look.oversize && !bare) sh.add(mesh(cyl(.07 * B, .072, .2), mSleeve, 0, -.1, 0));
    if (look.top === 'tee' || look.top === 'crop' || look.top === 'meshCrop') sh.add(mesh(cyl(.06 * B, .054, .13), mTop, 0, -.055, 0));
    const el = new T.Group(); el.position.y = -.28; sh.add(el);
    el.add(mesh(cyl(.042 * LIMB * (1 + .35 * MU), .033 * LIMB * (1 + .2 * MU), .25), bare || look.top === 'overshirt' ? mSkin : mSleeve, 0, -.125, 0));
    if (look.top === 'overshirt') el.add(mesh(cyl(.05, .048, .05), mSleeve, 0, -.01, 0));
    const hand = new T.Group(); hand.position.y = -.27; el.add(hand);
    const mHand = look.gloves ? G('gloveM', () => leatherMat('#0c0a0e', true)) : mSkin;
    if (look.gloves) el.add(mesh(cyl(.036, .036, .06), mHand, 0, -.235, 0));
    const hk = TOON ? 1.12 : 1; hand.scale.setScalar(hk); hand.add(mesh(G('palm', () => new T.SphereGeometry(1, 12, 8)), mHand, 0, -.035, .004, .03, .045, .016));
    for (let k = 0; k < 4; k++) { const fl = [.052, .058, .055, .045][k], fx = (k - 1.5) * .0135 * -s; const fg = mesh(G('fing', () => new T.CylinderGeometry(.0065, .006, 1, 6)), mHand, fx, -.075 - fl / 2 * .9, .012, 1, fl, 1); fg.rotation.x = .35; hand.add(fg); }
    { const th = mesh(G('fing', () => new T.CylinderGeometry(.0065, .006, 1, 6)), mHand, s * -.024, -.045, .016, 1.15, .045, 1.15); th.rotation.set(.5, 0, s * -.6); hand.add(th); }
    return { sh, el, hand };
  };
  const AL = arm(-1), AR = arm(1);
  // 다리
  const leg = s => {
    const lg = new T.Group(); lg.position.set(s * .09 * B * (f ? 1 + .08 * CV : 1), -.04, 0); hips.add(lg);
    const PANTS = look.bottom === 'pants' || look.bottom === 'cargo', legMat = PANTS ? (look.bottom === 'cargo' && s > 0 && look.cargoPrint ? G('cargoP' + look.bottomColor, () => { const m = clothMat(look.bottomColor, 'fabric', { pattern: 'graffiti', roughness: .85 }); return m; }) : mBot) : mSkin;
    if (look.bottom === 'shorts') lg.add(mesh(cyl(.088 * B, .08 * B, look.mini ? .1 : .2), mBot, 0, look.mini ? -.04 : -.09, 0));
    const TL1 = TOON ? .5 : .44, TL2 = TOON ? .49 : .43;
    const wide = (look.bottom === 'pants' && look.fit === 'wide') || look.bottom === 'cargo', thighMat = look.bottom === 'pants' && look.fit === 'ripped' ? mRip : legMat;
    lg.add(mesh(cyl((wide ? .086 : .078 * LIMB * (f ? 1 + .1 * CV : 1)) * B, wide ? .08 : .06 * LIMB, TL1), thighMat, 0, -TL1 / 2, 0));
    const kn = new T.Group(); kn.position.y = -TL1; lg.add(kn);
    if (look.bottom === 'cargo') { const pk = mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), mBot, s * .085, -TL1 * .55, .01, .03, .12, .1); lg.add(pk); }   // 카고 포켓
    const bootM = G('bootM2', () => leatherMat('#0c0a0e', true));
    if (look.shoes === 'thigh' && !PANTS) { lg.add(mesh(cyl(.07 * LIMB, .06 * LIMB, TL1 * .42), bootM, 0, -TL1 * .79, 0)); kn.add(mesh(cyl(.062 * LIMB, .05 * LIMB, TL2), bootM, 0, -TL2 / 2, 0)); }   // v17 사이하이 부츠
    kn.add(mesh(cyl(wide ? .08 : .058 * LIMB, wide ? .1 : .044 * LIMB, TL2), legMat, 0, -TL2 / 2, 0));
    if (look.shoes === 'boots' && !PANTS) kn.add(mesh(cyl(.054, .05, .3), bootM, 0, -TL2 + .12, .005));
    const BOOT = look.shoes === 'boots' || look.shoes === 'thigh';
    if (TOON && BOOT) {   // v17 부츠: 광택 블랙 + 굽 있는 밑창
      kn.add(mesh(sph(), bootM, 0, -TL2 - .005, .045, f ? .05 : .06, .05, f ? .115 : .135));
      kn.add(mesh(G('bsole' + look.gender, () => new T.BoxGeometry(f ? .095 : .115, .04, f ? .24 : .28)), G('bsoleM', () => std('#08070a', { roughness: .5 })), 0, -TL2 - .045, .045));
      if (f) kn.add(mesh(G('heel', () => new T.BoxGeometry(.045, .07, .05)), G('bsoleM', () => std('#08070a', { roughness: .5 })), 0, -TL2 - .03, -.045));
    } else if (TOON) {   // 청키 스니커즈: 컬러 어퍼 + 흰 밑창 + 끈
      kn.add(mesh(sph(), mShoe, 0, -TL2 - .005, .05, f ? .05 : .058, .045, f ? .12 : .135));
      kn.add(mesh(G('sole' + look.gender, () => new T.BoxGeometry(f ? .1 : .115, .035, f ? .25 : .28)), G('soleM', () => std('#f8f8f8', { roughness: .6 })), 0, -TL2 - .04, .05));
      kn.add(mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), G('laceM', () => std('#2a2a2a', { roughness: .8 })), 0, -TL2 + .02, .1, .05, .008, .05));
    } else kn.add(mesh(G('foot' + look.gender, () => new T.BoxGeometry(f ? .075 : .095, .07, f ? .21 : .25)), mShoe, 0, -.45, .045));
    return { lg, kn };
  };
  const LL = leg(-1), LR = leg(1);
  // 소품: 술잔
  const glass = new T.Group(); glass.visible = false; AR.hand.add(glass); glass.position.set(0, -.02, .035);
  glass.add(mesh(G('glass', () => new T.CylinderGeometry(.032, .024, .11, 12, 1, true)), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .35, roughness: .05, metalness: .2, side: T.DoubleSide })));
  glass.add(mesh(G('liq', () => new T.CylinderGeometry(.028, .022, .06, 12)), NC.mat.std('#ffb340', { roughness: .2, emissive: '#5a2a00' }), 0, -.02, 0));
  if (TL) { mHair.map = TL.texture('hair', 'map', {}, [3, 1]); mHair.normalMap = TL.texture('hair', 'normal', {}, [3, 1]); mHair.normalScale.set(.7, .7); mHair.onBeforeCompile = rimInject('1.0,0.95,0.9', '0.6'); }
  mergeStatic(fig);
  if (NC.contactShadow) root.add(NC.contactShadow(.85, .65));
  if (NC.shadow) NC.shadow(fig, true, false);
  // 이름표
  const label = makeLabel(o.name || '', o.labelColor || look.topColor); if (NC.LABEL_LAYER) label.layers.set(NC.LABEL_LAYER); label.position.y = look.height + (TOON ? .36 : .32); root.add(label);

  const u = root.userData = { gender: look.gender, look, mats: { top: mTop, sleeve: mSleeve, skin: mSkin, kind: look.top, inner: look.innerColor },
    name: o.name, look, label, fig, figScale, hipH, skirt, glass, face: { cv: fcv, tex: ftex },
    rig: { body, hips, torso, neck, head, shL: AL.sh, elL: AL.el, shR: AR.sh, elR: AR.el, legL: LL.lg, knL: LL.kn, legR: LR.lg, knR: LR.kn },
    seed: (U.hash(o.name || 'x') % 1000) / 1000, seated: false, moving: false, dance: null, talk: false, walkPh: 0,
    expr: o.expr || 'neutral', baseExpr: o.expr || 'neutral', exprUntil: 0, blink: false, blinkT: 1 + Math.random() * 3, blinkEnd: 0, talkUntil: 0, mouthT: 0, mouthOpen: false,
    motion: { t: 0, g: null, gT: 0, gDur: 0 }, faceDirty: true, seatH: .5,
  };
  u.gaze = [0, 0]; u.gazeT = 1;
  u.redraw = () => { drawFace(fcv, look, u.expr, { blink: u.blink, talk: u.mouthOpen, gaze: u.gaze }); ftex.needsUpdate = true; u.faceDirty = false;
    const em = (EXPR[u.expr] || EXPR.neutral).eyes; corneaMesh.visible = !u.blink && em !== 'happy' && em !== 'wink'; void corneas; };
  u.setExpr = (name, dur = 0) => { if (!EXPR[name]) name = 'neutral'; u.expr = name; u.exprUntil = dur ? performance.now() + dur * 1000 : 0; if (!dur) u.baseExpr = name; u.faceDirty = true; };
  u.say = sec => { u.talkUntil = performance.now() + sec * 1000; };
  u.setName = n => { root.remove(u.label); u.label = makeLabel(n, look.topColor); if (NC.LABEL_LAYER) u.label.layers.set(NC.LABEL_LAYER); u.label.position.y = look.height + (TOON ? .36 : .32); root.add(u.label); };
  u.redraw();
  return root;
}

/* 이름표 크기: 가까우면 작게(얼굴 가림 방지), 대화 상대는 숨김 */
function fitLabel(g, cam) { const l = g.userData.label; if (!l) return; const d = cam.position.distanceTo(g.position), k = U.clamp(d / 10, .32, 1); l.scale.set(1.9 * k, .48 * k, 1); l.visible = !g.userData.hideLabel; }
NC.Avatar = { create, undress, randomLook, mergeLook, drawFace, fitLabel, EXPR, FACE_SIZE: [FW, FH],
  /* 시작 화면 미리보기용: 얼굴 정면만 잘라서 작은 캔버스에 그림 */
  preview(cv, look, expr = 'smile') { const big = document.createElement('canvas'); big.width = FW; big.height = FH; drawFace(big, look, expr); const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.save(); g.beginPath(); g.ellipse(cv.width / 2, cv.height / 2, cv.width * .42, cv.height * .48, 0, 0, 7); g.clip(); g.drawImage(big, FW * .25 - 200, FH * .5 - 230, 400, 460, 0, 0, cv.width, cv.height); g.restore(); },
};
})();
