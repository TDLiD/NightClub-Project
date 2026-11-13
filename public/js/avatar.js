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

/* ═════ v38 인종·외모 다양성 ═════
 *  각 인종은 피부톤(언더톤)·모발·눈동자색뿐 아니라 얼굴 골격(콧대 높이·코볼 너비·광대·눈썹뼈·눈두덩 깊이·입술 두께와 돌출·턱)과
 *  눈 모양(쌍꺼풀 유무·몽고주름·눈 높이)이 다르고, 같은 인종 안에서도 범위 안에서 사람마다 다르게 뽑음 → 같은 얼굴에 피부색만 바꾼 복제 없음 */
const gauss = r => Math.max(-2.2, Math.min(2.2, (r() + r() + r() + r() - 2) * 1.73));
const ETH_ALIAS = { west: 'white', jp: 'east', kr: 'east', cn: 'east', asian: 'east' };
const ETH = {
  black: { skin: ['#9a6648', '#8d5a3b', '#7a4a2e', '#6b4228', '#5a3825', '#4a2e20', '#3f2a1f'], hair: ['#0e0a09', '#16100d', '#1f1612', '#2a1c14', '#0e0a09', '#5a3a22'], eye: ['#2a1a10', '#3a2416', '#1e140c'],
    hf: ['afro', 'braids', 'wavy', 'bun', 'curly', 'ponytail', 'bob', 'afro', 'braids'], hm: ['buzz', 'afro', 'curly', 'fade', 'buzz', 'fade', 'short'],
    m: { noseW: [1.26, 1.5], bridge: [.66, .86], lipFull: [1.3, 1.62], lipW: [1.04, 1.16], cheek: [1.0, 1.18], jaw: [.98, 1.1], faceW: [.94, 1.04], eyeOpen: [.98, 1.1], epi: [0, 0], lid: .85, ridge: [.95, 1.15], socket: [.9, 1.1], prog: [1.15, 1.4], tilt: [-.04, .05], brow: [.95, 1.2] } },
  white: { skin: ['#f6e0d2', '#f3d6c4', '#efcfb8', '#e8c0a4', '#e2b496', '#d6a684', '#f0d2c0'], hair: ['#e8c35a', '#d8b878', '#c9a060', '#a8743a', '#8a5a30', '#5a3a22', '#3b2417', '#7a3a20', '#b05a2a', '#17110f'], eye: ['#3d5a7a', '#4a6a3a', '#6a5a3a', '#2f4f6f', '#5a3a20', '#7a6a4a', '#4a3a2a'],
    hf: ['long', 'wavy', 'bob', 'ponytail', 'bun', 'wavy', 'long'], hm: ['side', 'slick', 'curtain', 'short', 'curly', 'wolf', 'fade'],
    m: { noseW: [.86, 1.02], bridge: [1.12, 1.4], lipFull: [.76, 1.1], lipW: [.92, 1.05], cheek: [.88, 1.04], jaw: [.95, 1.14], faceW: [.86, .96], eyeOpen: [.96, 1.1], epi: [0, 0], lid: 1, ridge: [1.1, 1.38], socket: [1.12, 1.38], prog: [.85, 1.0], tilt: [-.06, .03], brow: [.9, 1.15] } },
  east: { skin: ['#f5dcc5', '#f2d3b8', '#ecc7a6', '#e8c09c', '#dfb592', '#d8ab88'], hair: ['#0e0b0e', '#17110f', '#241812', '#17110f', '#3b2417', '#4e3020', '#6e4425'], eye: ['#2a1a10', '#3a2416', '#30251c', '#4a2e1a'],
    hf: ['long', 'bob', 'ponytail', 'wavy', 'bun', 'long', 'bob'], hm: ['curtain', 'twoblock', 'side', 'slick', 'short', 'spiky', 'curtain'],
    m: { noseW: [.98, 1.14], bridge: [.62, .84], lipFull: [.92, 1.2], lipW: [.92, 1.04], cheek: [1.05, 1.22], jaw: [.96, 1.08], faceW: [.98, 1.08], eyeOpen: [.74, .92], epi: [.45, 1], lid: .45, ridge: [.68, .86], socket: [.58, .8], prog: [.95, 1.08], tilt: [0, .09], brow: [.85, 1.05] } },
  sea: { skin: ['#d4a27a', '#c8946a', '#c08a5e', '#b88358', '#a9744e', '#9c6a46'], hair: ['#0e0b0e', '#17110f', '#241812', '#3b2417', '#17110f'], eye: ['#2a1a10', '#3a2416', '#1e140c'],
    hf: ['long', 'wavy', 'ponytail', 'bob', 'bun', 'long'], hm: ['short', 'side', 'curtain', 'spiky', 'slick', 'curly', 'fade'],
    m: { noseW: [1.12, 1.3], bridge: [.64, .86], lipFull: [1.08, 1.35], lipW: [.98, 1.1], cheek: [1.0, 1.15], jaw: [.96, 1.06], faceW: [.96, 1.05], eyeOpen: [.86, 1.0], epi: [.15, .55], lid: .7, ridge: [.8, .98], socket: [.75, .95], prog: [1.02, 1.18], tilt: [-.02, .06], brow: [.9, 1.1] } },
  south: { skin: ['#c48d63', '#b98058', '#a8714c', '#93613f', '#7e5236', '#6e4630'], hair: ['#0e0b0e', '#17110f', '#241812', '#2c1c12', '#0e0b0e'], eye: ['#2a1a10', '#3a2416', '#1e140c', '#4a3a20'],
    hf: ['long', 'braids', 'wavy', 'bun', 'ponytail', 'long'], hm: ['side', 'short', 'slick', 'curly', 'wolf', 'side'],
    m: { noseW: [1.0, 1.16], bridge: [1.0, 1.24], lipFull: [1.02, 1.25], lipW: [.98, 1.08], cheek: [.98, 1.1], jaw: [.95, 1.08], faceW: [.9, 1.0], eyeOpen: [1.0, 1.12], epi: [0, .1], lid: 1, ridge: [1.0, 1.18], socket: [1.0, 1.22], prog: [.98, 1.1], tilt: [-.05, .03], brow: [1.15, 1.45] } },
};
ETH.mixed = { skin: ['#e0b896', '#d6a985', '#c99a76', '#b88a66', '#b07a55', '#a06a4a'], hair: ['#17110f', '#3b2417', '#5a3a22', '#8a5a30', '#241812'], eye: ['#5a3a20', '#6a5a3a', '#3a2416', '#4a6a3a', '#7a6a4a'],
  hf: ['wavy', 'curly', 'long', 'afro', 'ponytail', 'braids', 'bob'], hm: ['curly', 'fade', 'side', 'short', 'curtain', 'buzz'], m: null };
const ETH_KEYS = ['east', 'east', 'white', 'white', 'black', 'black', 'sea', 'sea', 'south', 'mixed', 'mixed', 'east', 'white', 'black', 'sea', 'south', 'mixed', 'south'];
const ETH_LABEL = { east: '동아시아', white: '유럽계', black: '아프리카계', sea: '동남아시아', south: '남아시아', mixed: '혼혈·다문화' };
function pickEth(r) { return ETH_KEYS[Math.floor(r() * ETH_KEYS.length)]; }
function applyEthnic(o, eth, r, f) {
  const E = ETH[eth] || ETH.east, pick = a => a[Math.floor(r() * a.length)], F = o.face, rng = ([a, b]) => a + (b - a) * r();
  let M = E.m;
  if (!M) { const ks = ['black', 'white', 'east', 'sea', 'south'], a = ETH[pick(ks)].m, b = ETH[pick(ks)].m, k = .3 + r() * .4; M = {}; for (const key in a) M[key] = Array.isArray(a[key]) ? [a[key][0] * k + b[key][0] * (1 - k), a[key][1] * k + b[key][1] * (1 - k)] : a[key] * k + b[key] * (1 - k); }
  o.skin = pick(E.skin); o.hairColor = pick(E.hair); o.hairStyle = pick(f ? E.hf : E.hm); F.eyeColor = pick(E.eye);
  Object.assign(F, { noseW: rng(M.noseW), bridge: rng(M.bridge), lipFull: rng(M.lipFull) * (f ? 1 : .88), lipW: rng(M.lipW), cheek: rng(M.cheek), jaw: rng(M.jaw) * (f ? .97 : 1.03), faceW: rng(M.faceW) * (f ? .98 : 1.02),
    eyeOpen: rng(M.eyeOpen), epi: rng(M.epi), lid: r() < M.lid ? 1 : 0, ridge: rng(M.ridge) * (f ? .8 : 1), socket: rng(M.socket), prog: rng(M.prog), eyeTilt: rng(M.tilt) + (r() - .5) * .04,
    eyeSize: .92 + r() * .14, nose: .9 + r() * .2, browThick: (f ? .55 + r() * .3 : .9 + r() * .45) * rng(M.brow), chin: .85 + r() * .3 });
  // 사람마다 다른 좌우 비대칭(아주 조금) — 완벽한 대칭의 인형 얼굴 방지
  F.asym = { eyeY: (r() - .5) * .014, eyeS: (r() - .5) * .07, browY: (r() - .5) * .018, mouth: (r() - .5) * .012, nose: (r() - .5) * .016, jaw: (r() - .5) * .05 };
  const lum = (() => { const c = new T.Color(o.skin); return c.r * .3 + c.g * .59 + c.b * .11; })(); F.skinLum = lum;
  const lipBase = new T.Color(o.skin).lerp(new T.Color(f ? '#a8404c' : '#8a4840'), f ? .5 : .32); if (lum < .35) lipBase.multiplyScalar(.82);
  F.lipColor = '#' + lipBase.getHexString(); F.blush = (f ? .08 + r() * .16 : r() * .05) * (lum < .4 ? .35 : 1);
  // 90년대 수염: 콧수염·염소수염·턱수염·면도 자국 (동아시아·동남아시아는 적게)
  if (!f) { const fac = eth === 'east' || eth === 'sea' ? .55 : 1, x = r(); F.beard = x < .32 * fac ? 'stubble' : x < .46 * fac ? 'goatee' : x < .56 * fac ? 'mustache' : x < .66 * fac ? 'full' : null; }
  if (eth === 'white' && r() < .18) F.freckles = true;
}
function randomLook(seed, gender, ethForce) {
  const r = U.rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const g = gender || (r() < .5 ? 'f' : 'm'), f = g === 'f';
  const top = pick(f ? TOPS_F : TOPS_M);
  const o = {
    gender: g, height: f ? 1.62 + gauss(r) * .065 : 1.75 + gauss(r) * .07, build: .94 + r() * .14, age: (ra => { const x = ra(); return x < .42 ? 20 + Math.floor(ra() * 10) : x < .72 ? 30 + Math.floor(ra() * 10) : x < .9 ? 40 + Math.floor(ra() * 10) : 50 + Math.floor(ra() * 15); })(U.rng((seed ^ 0x9e37) >>> 0)),   // v42 20대~60대 성인(별도 난수 → 옷·외모 등 기존 생성 결과는 그대로)   // v38 키: 실제 성인 분포(여 1.49~1.75 · 남 1.61~1.89)
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
  // v38 ① 인종·외모 다양성 6분류 — 피부색만이 아니라 얼굴 골격(콧대·코볼·광대·눈꺼풀·입술·눈썹뼈)·눈 모양·모발까지 다르게
  const eth = ETH_ALIAS[ethForce] || ethForce || pickEth(r); o.ethnic = eth;
  applyEthnic(o, eth, r, f);
  if (!f) {   // ③ 남성: 미남 50% · 개성파 50% · 근육질 30%
    const hand = r() < .5; o.face.attractive = hand;
    if (hand) Object.assign(o.face, { eyeSize: o.face.eyeSize * (1.0 + r() * .06), browThick: o.face.browThick * (1.05 + r() * .15), jaw: o.face.jaw * (1.0 + r() * .04), mole: null, freckles: false });   // v38 인종 골격은 유지하고 미세 조정만
    else Object.assign(o.face, { eyeSize: o.face.eyeSize * (.9 + r() * .08), browThick: o.face.browThick * (.8 + r() * .5), browTilt: (r() - .5) * .4, jaw: o.face.jaw * (1.04 + r() * .08), faceW: o.face.faceW * (1.02 + r() * .05), nose: o.face.nose * (1.06 + r() * .14), eyeGap: .02 + r() * .03, mole: r() < .5 ? [(r() - .5) * .9, .2 + r() * .4] : null });
    o.muscle = r() < .3 ? .6 + r() * .4 : r() * .25;
  }
  if (!f) {   // v38 남성 90년대 나이트 의상: 가죽 재킷 · 실크 셔츠(오픈 칼라) · 오버사이즈 셔츠 · 블랙 피티드 셔츠 · 클래식 수트 · 청청(빈티지 데님) · 90s 스트리트
    const OUTFITS = [
      { top: 'jacket', leather: true, tops: ['#141214', '#2a1c14', '#3a2418', '#1c1a1e'], inner: 'tee', inners: ['#f2f0ea', '#1c1c20', '#7a1c24', '#d9d4c8'], bots: ['#2c3e5c', '#3a5070', '#1d2533', '#141418'], fit: 'skinny', shoes: ['#141018', '#3a2418'], boots: .55 },
      { top: 'shirt', satin: true, open: true, tops: ['#7a1c2c', '#1c2a4a', '#3a1c4a', '#b89a5a', '#141418', '#e8e0d0', '#2a4a3a'], bots: ['#141418', '#2b2d33', '#3a3028', '#1d2533'], fit: 'wide', shoes: ['#120e0c', '#2a1c14'] },
      { top: 'shirt', oversize: true, pats: ['solid', 'stripe', 'plaid', 'solid'], tops: ['#cfd8e6', '#e8d8c8', '#b8c8a8', '#f0e8d8', '#8aa0c0', '#d8c0d0'], bots: ['#3a5070', '#2c3e5c', '#5a7a9a'], fit: 'wide', shoes: ['#f2f2f2', '#141018'] },
      { top: 'shirt', tops: ['#0e0c10', '#141218'], bots: ['#141418', '#2c3e5c', '#2b2d33'], fit: 'skinny', shoes: ['#120e0c'], boots: .3 },
      { top: 'jacket', setup: true, tops: ['#1b2236', '#26282e', '#3a3c42', '#4a3b2c', '#2a2a30'], inner: 'tee', inners: ['#f4f2ee', '#141016', '#c8b8a0'], bots: null, shoes: ['#120e0c', '#2a1c14'] },
      { top: 'jacket', denimTop: true, tops: ['#4a6a8a', '#3a5070', '#5a7a9a', '#2c3e5c'], inner: 'tee', inners: ['#f4f2ee', '#c8b8a0', '#1c1c20'], bots: ['#2c3e5c', '#3a5070', '#141418'], fit: 'wide', shoes: ['#f2f2f2', '#3a2418'] },
      { top: 'tee', oversize: true, pats: ['solid', 'graphic', 'solid', 'stripe'], tops: ['#f4f4f2', '#1a1a1d', '#2a4a7a', '#7a2e33', '#4a5a3a'], bots: ['#3a5070', '#2c3e5c', '#5b5f66'], fit: 'wide', shoes: ['#f2f2f2', '#1a1a1d'], cap: .45 },
    ];
    const ot = pick(OUTFITS); o.top = ot.top; o.topColor = pick(ot.tops); o.inner = ot.inner || o.inner; if (ot.inners) o.innerColor = pick(ot.inners);
    o.setup = !!ot.setup; o.leather = !!ot.leather; o.satin = !!ot.satin; o.open = !!ot.open; o.denimTop = !!ot.denimTop;
    o.bottom = 'pants'; o.bottomColor = ot.bots ? pick(ot.bots) : o.topColor; o.fit = ot.fit || (r() < .6 ? 'skinny' : 'wide'); o.oversize = !!ot.oversize; o.set = false; o.pattern = ot.pats ? pick(ot.pats) : 'solid';
    o.shoes = r() < (ot.boots || 0) ? 'boots' : 'sneakers'; o.shoeColor = pick(ot.shoes); o.hat = ot.cap && r() < ot.cap ? pick(['cap', 'cap', 'bucket']) : null; o.hatColor = pick(['#1a1a1d', '#2b2d33', '#4a3b2c', '#2a4a7a']);
    o.necklace = r() < .25; o.chain = !o.necklace && r() < .12; o.watch = r() < .55; o.belt = o.top !== 'jacket' && r() < .5; o.realWear = true;
  }
  if (f) {   // v38 여성 90년대 나이트 의상: 미니 원피스 · 바디콘(벨벳) · 크롭탑+하이웨이스트 진 · 가죽 스커트 · 새틴 슬립 원피스 · 빈티지 블라우스 · 엘레강스 클럽웨어
    const OUTFITS_F = [
      { top: 'dress', mini: true, tops: ['#141016', '#7a1c2c', '#c8203c', '#e8e0d0', '#2a1c4a', '#0e2a3a'], shoes: ['#141018', '#1a1412'], boots: .5 },
      { top: 'dress', mini: true, velvet: .6, curve: .15, tops: ['#1a0e1a', '#4a0e2a', '#0e1a3a', '#3a0e0e', '#141016'], shoes: ['#141018'], boots: .35 },
      { top: 'crop', bottom: 'pants', tops: ['#f4f4f2', '#141016', '#c8a0a8', '#7a8aa0', '#d8c8b0', '#8a1c2c'], bots: ['#3a5070', '#2c3e5c', '#5a7a9a', '#1d2533'], fit: 'skinny', shoes: ['#f2f2f2', '#141018'], platform: .45 },
      { top: 'tee', bottom: 'leather', mini: true, tops: ['#f4f4f2', '#141016', '#c8b8a0', '#3a3a40'], bots: ['#0e0c10', '#2a1410', '#3a1c14'], shoes: ['#141018'], boots: .7 },
      { top: 'dress', satin: true, tops: ['#d8c098', '#b8a0c8', '#c88a8a', '#1c1c20', '#8a6a5a', '#e8d8d0'], shoes: ['#141018', '#c8a070'] },
      { top: 'shirt', bottom: 'pants', pats: ['solid', 'solid', 'stripe'], tops: ['#f4efe6', '#e8d9c8', '#cfd8e6', '#f2e2e6', '#2d2a30'], bots: ['#3a5070', '#2c3e5c', '#c2b29a'], fit: 'wide', shoes: ['#3a2418', '#141018'] },
      { top: 'jacket', bottom: 'skirt', mini: true, tops: ['#141016', '#7a1c2c', '#2a1c4a', '#c8b49a'], inner: 'tee', inners: ['#141016', '#f4f2ee'], bots: ['#141016', '#2b2d33'], shoes: ['#141018'], boots: .5 },
    ];
    const ot = pick(OUTFITS_F); o.top = ot.top; o.topColor = pick(ot.tops); o.inner = ot.inner || o.inner; if (ot.inners) o.innerColor = pick(ot.inners);
    o.bottom = ot.top === 'dress' ? 'skirt' : ot.bottom || 'skirt'; o.bottomColor = ot.top === 'dress' ? o.topColor : pick(ot.bots || ['#1d2533']); if (ot.fit) o.fit = ot.fit; o.oversize = false;
    o.satin = !!ot.satin; o.velvet = ot.velvet ? r() < ot.velvet : false; o.mini = !!ot.mini; if (ot.curve) o.curve = .5 + ot.curve;
    o.setup = false; o.set = false; o.pattern = ot.pats ? pick(ot.pats) : 'solid';
    o.shoes = ot.platform && r() < ot.platform ? 'platform' : r() < (ot.boots || .3) ? 'boots' : 'sneakers'; o.shoeColor = pick(ot.shoes); o.hat = r() < .06 ? pick(['beret', 'bucket']) : null; o.hatColor = pick(['#1a1a1d', '#c8b49a', '#4a3b2c']);
    o.choker = r() < .35; o.necklace = !o.choker && r() < .4; o.watch = r() < .25; o.belt = o.bottom === 'pants' && r() < .5; o.realWear = true;
    Object.assign(o.face, { liner: .15 + r() * .45, blush: o.face.blush, earring: r() < .75, hoop: r() < .5 });
  }
  // v17 K-pop 스테이지 룩 (v28: 여성 45%→15% · 남성 35%→12% — 나머지는 실사 일상복)
  if (r() < (f ? .02 : .02)) applyIdol(o, r, f);   // v38 90년대 실제 나이트 분위기 → 현대 K-pop 무대 룩은 거의 안 나옴
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
/* v38 지정 캐릭터(주요 인물·데이터)에 인종이 없으면 피부톤으로 추정 → 그 인종의 얼굴 골격을 사용 */
function inferEth(look) {
  if (!look) return null; if (look.ethnic) return ETH_ALIAS[look.ethnic] || look.ethnic; if (!look.skin || !isCol(look.skin)) return null;
  const c = new T.Color(look.skin), l = c.r * .3 + c.g * .59 + c.b * .11; return l < .42 ? 'black' : l < .58 ? 'south' : l < .68 ? 'sea' : 'east';
}
function mergeLook(seed, gender, look) {
  const base = randomLook(seed, (look && look.gender) || gender, inferEth(look));
  const o = Object.assign({}, base, look || {});
  const plain = { freckles: false, mole: null, beard: null, glasses: false, sunglasses: false, earring: false, shadow: null };   // 지정 얼굴은 랜덤 소품을 섞지 않음
  o.face = Object.assign({}, base.face, look && look.face ? plain : {}, (look && look.face) || {});
  if (o.gender === 'm' && look && look.face && typeof look.face.attractive === 'boolean') Object.assign(o.face, look.face.attractive   // v14: 지정한 미남/개성파 얼굴형
    ? { eyeSize: 1.06, browThick: 1.25, browTilt: .05, jaw: 1.03, faceW: .93, nose: .92, eyeGap: 0 } : { eyeSize: .78, browThick: 1.4, browTilt: .2, jaw: 1.14, faceW: 1.06, nose: 1.28, eyeGap: .05 }, look.face);
  if (o.gender === 'm' && !o.idol && look && (look.topColor || look.bottomColor)) {   // v25 지정 색상도 남성(비아이돌)은 실제 옷감 색으로 차분하게(채도↓)
    const tame = (hex, maxS = .42, lo = .14, hi = .82) => { if (!hex || typeof hex !== 'string') return hex; const c = new NC.THREE.Color(hex), h = {}; c.getHSL(h); return '#' + c.setHSL(h.h, Math.min(h.s, maxS), Math.max(lo, Math.min(hi, h.l))).getHexString(); };
    o.topColor = tame(o.topColor); o.bottomColor = tame(o.bottomColor, .35, .1, .7); o.realWear = true; if (o.pattern === 'leopard' || o.pattern === 'graphic') o.pattern = 'solid'; }
  if (!o.body && !o.idol && !(look && look.build)) {   // v32 실제 클럽 손님처럼 체형 다양화 (지정 없을 때 시드 기반)
    const r = U.rng(U.hash(String(seed) + 'body')), x = r();
    o.body = o.gender === 'f' ? (x < .22 ? 'slim' : x < .5 ? 'average' : x < .66 ? 'curvy' : x < .78 ? 'soft' : x < .88 ? 'athletic' : 'plus') : (x < .16 ? 'slim' : x < .42 ? 'average' : x < .58 ? 'athletic' : x < .7 ? 'muscular' : x < .82 ? 'soft' : x < .91 ? 'stocky' : 'plus'); }   // v38 근육질·플러스 사이즈 추가
  return originalize(o);
}

/* ───────── 스타일라이즈드(v4) 비율 ─────────
 * 큰 두상·큰 눈·작은 코/입·가는 목·긴 다리의 3D 캐릭터 스타일. TOON=false 로 바꾸면 v3 실사 비율로 돌아감 */
const TOON = false, HEAD_S = TOON ? 1.15 : .92,   /* v32 실제 인체 비율 1:7.7~8 (v31 .97) */ EYE_K = TOON ? 1.5 : 1.06;   /* v38 눈 1.3→1.06: 인형처럼 큰 눈 → 실제 사람 비율 */   // v17: 아이돌 비율 — 두상 1.32→1.15 · 다리 6% 길게 (8등신에 가깝게)   // v12: 실사형 글래머 비율(두상 1.8→1.32 · 눈 1.85→1.5)
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
  kiss: { eyes: 'closed', mouth: 'small', brow: .12, browIn: -.45, blush: 1 },
  angry: { eyes: 'open', mouth: 'flat', brow: -.6, browIn: 1.2, blush: .25 },   // v35 말다툼·몸싸움     // v11: 눈 감고 입 오므림
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
/* v38 피부결: 저주파 얼룩(혈색·색소 불균일) + 고주파 모공·잔털 그림자 (한 번만 만들어 모든 얼굴이 공유 — 메모리 절약) */
let mottleCv = null, poreCv = null;
function skinMottle() { if (mottleCv) return mottleCv; mottleCv = document.createElement('canvas'); mottleCv.width = 128; mottleCv.height = 64; const g = mottleCv.getContext('2d'), r = U.rng(911);
  for (let i = 0; i < 260; i++) { const x = r() * 128, y = r() * 64, rr = 3 + r() * 9, red = r() < .55, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, red ? 'rgba(190,80,70,.22)' : 'rgba(120,80,50,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } return mottleCv; }
function skinPores() { if (poreCv) return poreCv; const W = 1024, H = 512; poreCv = document.createElement('canvas'); poreCv.width = W; poreCv.height = H; const g = poreCv.getContext('2d'), im = g.createImageData(W, H), d = im.data, r = U.rng(4242);
  for (let i = 0; i < W * H; i++) { const v = r(); if (v < .045) { d[i * 4] = 70; d[i * 4 + 1] = 35; d[i * 4 + 2] = 25; d[i * 4 + 3] = 30 + v * 1400; } else if (v > .985) { d[i * 4] = 255; d[i * 4 + 1] = 240; d[i * 4 + 2] = 225; d[i * 4 + 3] = 22; } }
  g.putImageData(im, 0, 0); return poreCv; }
function gr0(g, x, y, rr, c) { const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }
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
  const SL = F.skinLum ?? (() => { const c = new T.Color(look.skin); return c.r * .3 + c.g * .59 + c.b * .11; })(), DK = SL < .45;   // v38 어두운 피부는 하이라이트를 금빛·약하게, 그늘은 더 깊게(잿빛 화장 느낌 방지)
  g.globalAlpha = TOON ? .1 : .5; g.drawImage(skinNoise(), 0, 0, FW, FH); g.globalAlpha = 1;
  if (!TOON) { g.globalAlpha = DK ? .55 : .4; g.drawImage(skinMottle(), 0, 0, FW, FH); g.globalAlpha = DK ? .35 : .5; g.drawImage(skinPores(), 0, 0, FW, FH); g.globalAlpha = 1; }   // v38 피부 얼룩(혈색·색소) + 모공
  g.setTransform(K, 0, 0, K, FW * .25, FH * .5);
  const rad = (x, y, r0, r1, c0, c1) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r1, 0, 7); g.fill(); };
  let gr = g.createRadialGradient(0, .15, .35, 0, .2, 1.35); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(70,25,15,.26)'); g.fillStyle = gr; g.fillRect(-1.6, -1.6, 3.2, 3.2);
  const HL = (a) => DK ? `rgba(255,214,170,${a * .7})` : `rgba(255,240,228,${a})`;
  rad(0, -.42, 0, .42, HL(.16), HL(0));                 // 이마 하이라이트 (T존 유분)
  rad(0, .18, 0, .1, HL(.2), HL(0));                    // 콧대 하이라이트
  for (const s of [-1, 1]) {
    rad(s * .31, .14, 0, .14, 'rgba(90,40,50,.12)', 'rgba(90,40,50,0)');                  // 눈 밑 그늘
    rad(s * .31, -.07, 0, .16, 'rgba(100,45,40,.12)', 'rgba(100,45,40,0)');              // 눈두덩 쌍꺼풀 그늘
    rad(s * .62, .42, 0, .3, 'rgba(80,30,25,.14)', 'rgba(80,30,25,0)');                  // 광대 아래 음영
    rad(s * .5, .22, 0, .16, HL(.12), HL(0));            // 광대 하이라이트
    rad(s * .1, .35, 0, .08, `rgba(200,90,80,${DK ? .05 : .12})`, 'rgba(200,90,80,0)');                // 콧망울 혈색
    rad(s * .4, .3, 0, .2, `rgba(205,95,85,${DK ? .03 : .07})`, 'rgba(205,95,85,0)');                   // v38 볼 혈색(자연스러운 홍조)
  }
  rad(0, .78, 0, .16, HL(.12), HL(0));                   // 턱끝 하이라이트
  { /* v38 나이·표정 주름: 팔자 주름(누구나 약하게) · 눈가 · 이마 (30대 이상 점점) */
    const age = look.age || 26, ak = U.clamp((age - 26) / 18, 0, 1), sh = DK ? 'rgba(30,12,6,' : 'rgba(110,55,40,';
    g.lineCap = 'round';
    for (const s of [-1, 1]) { g.strokeStyle = sh + (.07 + .1 * ak) + ')'; g.lineWidth = .012; g.beginPath(); g.moveTo(s * .12, .36); g.quadraticCurveTo(s * .2, .47, s * .22 * (F.lipW || 1), .6); g.stroke();
      if (ak > .1) { g.strokeStyle = sh + (.1 * ak) + ')'; g.lineWidth = .004; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(s * .46, .0 + k * .035 - .03); g.lineTo(s * .52, -.01 + k * .045 - .04); g.stroke(); } } }
    if (ak > .2) { g.strokeStyle = sh + (.09 * ak) + ')'; g.lineWidth = .0045; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-.28, -.47 + k * .05); g.quadraticCurveTo(0, -.5 + k * .05, .28, -.47 + k * .05); g.stroke(); } }
    g.strokeStyle = sh + (.05 + .05 * ak) + ')'; g.lineWidth = .006; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * .2, .1); g.quadraticCurveTo(s * .31, .16, s * .42, .11); g.stroke(); }   // 눈 밑 주름(애교살 아래)
  }
  rad(0, 1.02, 0, .35, 'rgba(60,20,15,.18)', 'rgba(60,20,15,0)');                        // 턱 아래 그늘
  const bl = U.clamp((F.blush || 0) + (TOON ? .25 : 0), 0, 1);
  if (bl > .02) for (const s of [-1, 1]) rad(s * .46, TOON ? .36 : .3, 0, TOON ? .2 : .22, `rgba(255,105,130,${.5 * bl})`, 'rgba(255,105,130,0)');
  if (F.freckles) { const r = U.rng(U.hash(look.skin + look.hairColor)); g.fillStyle = 'rgba(140,80,50,.35)'; for (let i = 0; i < 34; i++) { const s = r() < .5 ? -1 : 1; g.beginPath(); g.arc(s * (.1 + r() * .34), .14 + r() * .22, .006 + r() * .006, 0, 7); g.fill(); } }
  if (F.mole) { g.fillStyle = 'rgba(60,30,20,.75)'; g.beginPath(); g.arc(F.mole[0], F.mole[1], .011, 0, 7); g.fill(); }
  if (F.beard) {   // 수염: 개별 점(모근)으로 그려 실사 느낌
    const r = U.rng(U.hash(look.hairColor + 'b')), dens = F.beard === 'stubble' ? 1400 : F.beard === 'full' ? 3200 : F.beard === 'mustache' ? 700 : 1500;
    if (F.beard === 'full' || F.beard === 'stubble') { gr0(g, 0, .62, .5, rgba(shade(look.hairColor, .05), F.beard === 'full' ? .28 : .1)); }   // v38 수염 자리 푸르스름한 그늘
    g.fillStyle = rgba(look.hairColor, F.beard === 'stubble' ? .3 : .62);
    for (let i = 0; i < dens; i++) { const x = (r() - .5) * 1.15, y = .3 + r() * .85;
      const lipZone = Math.abs(x) < .21 && y > .48 && y < .6, mus = y > .4 && y < .475 && Math.abs(x) < .21 - (y - .4) * .3;
      const inBeard = F.beard === 'stubble' || F.beard === 'full' ? (y > .4 + Math.abs(x) * .15 && Math.abs(x) < .58 - (y - .3) * .1 && !lipZone) : F.beard === 'mustache' ? mus : (Math.hypot(x, (y - .76) * 1.1) < .19 || mus);
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
  const AS = F.asym || {};
  for (const s of [-1, 1]) {
    let mode = e.eyes; if (mode === 'wink') mode = s > 0 ? 'happy' : 'open'; if (st.blink && mode !== 'happy') mode = 'closed';
    const esS = es * (1 + s * (AS.eyeS || 0));   // v38 좌우 눈 크기·높이 미세 차이
    g.save(); g.translate(s * ex, EY + s * (AS.eyeY || 0)); g.rotate(-s * (F.eyeTilt || 0)); if (s < 0) g.scale(-1, 1);   // 항상 +x = 바깥 눈꼬리
    const w = (TOON ? .1 : .11) * esS, open = { open: 1, wide: 1.3, half: .55, down: .62 }[mode] || 0, h = (TOON ? .066 : .05) * esS * Math.max(open, .01) * (TOON ? 1 : (F.eyeOpen || 1));
    if (F.shadow) { gr = g.createRadialGradient(.01, -.05, 0, .01, -.05, .17); gr.addColorStop(0, rgba(F.shadow, .5)); gr.addColorStop(1, rgba(F.shadow, 0)); g.fillStyle = gr; g.beginPath(); g.arc(.01, -.05, .17, 0, 7); g.fill(); }
    if (F.stage) {   // v17 무대 메이크업: 애교살 하이라이트 + 눈두덩 글리터
      gr = g.createRadialGradient(0, h * 1.3 + .012, 0, 0, h * 1.3 + .012, w * 1.05); gr.addColorStop(0, 'rgba(255,236,232,.45)'); gr.addColorStop(1, 'rgba(255,236,232,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, h * 1.3 + .012, w * 1.05, .032, 0, 0, 7); g.fill();
      const rg = U.rng(U.hash(look.skin + 'gl' + s)); g.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 16; k++) { const gx = -w * .9 + rg() * w * 1.9, gy = -h * 1.5 - rg() * .045; g.fillRect(gx, gy, .0045, .0045); } }
    g.strokeStyle = '#1b1210'; g.lineCap = 'round'; g.lineJoin = 'round';
    if (open > 0) {
      const upper = () => { g.moveTo(-w, .006); g.bezierCurveTo(-w * .5, -h * 1.3, w * .45, -h * 1.35, w, -.008 - (fem ? .006 : 0)); };
      g.beginPath(); upper(); g.bezierCurveTo(w * .5, h * .95, -w * .45, h * .95, -w, .006); g.closePath(); g.fillStyle = TOON ? '#fbf6f1' : '#ddd2c6'; g.fill();   // v38 흰자는 순백이 아닌 살짝 따뜻한 톤
      g.save(); g.clip();
      g.fillStyle = 'rgba(200,120,120,.12)'; g.fillRect(-w, -h, w * .35, h * 2); g.fillRect(w * .65, -h, w * .35, h * 2);   // 흰자 가장자리 혈색
      const ir = (TOON ? .068 : .047) * esS, ix = -.006 + gz[0] * s * w * .3, iy = (mode === 'down' ? h * .45 : TOON ? h * .05 : -h * .1) + gz[1] * h * .4;
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
      if (!TOON) { g.fillStyle = 'rgba(214,120,120,.55)'; g.beginPath(); g.ellipse(-w * .9, .004, w * .09, h * .35, 0, 0, 7); g.fill(); }   // v38 눈물샘(눈 안쪽 분홍 살)
      g.restore();
      g.beginPath(); upper(); g.lineWidth = (TOON ? .02 : .0105) + (F.liner || 0) * .012; g.stroke();
      if (!TOON && (F.epi || 0) > .05) {   // v38 몽고주름(동아시아·동남아시아계): 위 눈꺼풀 피부가 눈 안쪽 구석을 살짝 덮음
        g.save(); g.globalAlpha = Math.min(1, F.epi * 1.1); g.fillStyle = look.skin; g.beginPath(); g.moveTo(-w * 1.12, .016); g.quadraticCurveTo(-w * .78, -h * .35, -w * .3, -h * 1.12); g.lineTo(-w * .3, -h * 2.2); g.lineTo(-w * 1.15, -h * 2.2); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(95,50,40,.35)'; g.lineWidth = .004; g.beginPath(); g.moveTo(-w * 1.08, .014); g.quadraticCurveTo(-w * .78, -h * .3, -w * .3, -h * 1.1); g.stroke(); g.restore(); g.strokeStyle = '#1b1210'; }
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
    const bA = s * (AS.browY || 0), iy = by + bA + (e.browIn || 0) * .035 + .008, oy = by + bA - (F.browTilt || 0) * .12 + .02;   // v38 좌우 눈썹 높이 차이
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
  const L = [-mw, my - M.cuL + (AS.mouth || 0)], R = [mw, my - M.cuR - (AS.mouth || 0)], midTop = my + M.line;   // v38 입꼬리 높이 좌우 차이
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
/* v37 밑창 색: 신발 색보다 어둡게(흰 신발은 회갈색 고무) — 흰 스펀지처럼 보이지 않게 */
function soleTone(c) { const col = new T.Color(c || '#1a1a1d'), l = col.r * .3 + col.g * .59 + col.b * .11; if (l > .62) return '#7d756c'; col.multiplyScalar(.45); return '#' + col.getHexString(); }
const cyl = (a, b, h, s = 10) => G(`c${a}_${b}_${h}_${s}`, () => new T.CylinderGeometry(a, b, h, s));
/* v32 해부학 팔다리: 원통 대신 근육 볼륨이 있는 회전체 (삼각근·이두 / 전완 근육 / 무릎 잘록 / 종아리 / 가는 발목)
 *  t=0 위(관절 쪽) → t=1 아래. 반지름 = lerp(rt, rb, t) × k. 양 끝은 닫아서 관절이 꺾여도 구멍이 안 보임 */
const LIMB_PROF = {
  ua:  [[0, .98], [.1, 1.05], [.32, 1.09], [.55, 1.02], [.8, .94], [1, .93]],                 // 위팔(맨살)
  fa:  [[0, .97], [.14, 1.1], [.32, 1.07], [.62, .95], [.88, .86], [1, .88]],                 // 아래팔
  th:  [[0, 1], [.2, 1.01], [.5, .96], [.82, .88], [1, .9]],                                   // 허벅지
  sh:  [[0, .97], [.07, .94], [.24, 1.13], [.4, 1.09], [.66, .86], [.88, .72], [1, .76]],      // 정강이·종아리
  uaC: [[0, 1], [.3, 1.04], [.7, 1.0], [1, .97]], faC: [[0, 1], [.25, 1.03], [.8, .96], [1, .95]],   // 소매(옷이라 근육이 덜 드러남)
  thC: [[0, 1], [.5, .98], [1, .94]], shC: [[0, .98], [.3, 1.02], [.8, .96], [1, .97]],           // 슬림 바지
};
const LITE_DETAIL = NC.isMobile || (NC.quality && NC.quality.level === 'low');   // v34 모바일: 옷 주름 링·작은 뼈 돌출 생략(메시 수↓)
const LIMB_SEG = (NC.isMobile || (NC.quality && NC.quality.level === 'low')) ? 9 : 14;   // v34 모바일은 팔다리 둘레 분할 9
const limb = (kind, rt, rb, h, sz = .92) => G(`L${kind}${rt.toFixed(3)}_${rb.toFixed(3)}_${h}_${sz}`, () => {
  const P = LIMB_PROF[kind], pts = [new T.Vector2(0, -h / 2)];
  for (let i = P.length - 1; i >= 0; i--) { const [t, k] = P[i]; pts.push(new T.Vector2((rt + (rb - rt) * t) * k, h / 2 - t * h)); }
  pts.push(new T.Vector2(0, h / 2)); const g = new T.LatheGeometry(pts, LIMB_SEG); g.scale(1, 1, sz); return g; });   // sz: 앞뒤로 살짝 납작(실제 팔다리 단면은 타원)
/* v32 체형 프리셋 — look.body 가 있으면 build/muscle 대신 사용 */
const BODY = {
  slim:     { b: .86, limb: .86, mu: 0,   belly: 0,   hip: .95 },   // 마른 체형
  average:  { b: 1,   limb: 1,   mu: .12, belly: .2,  hip: 1 },     // 보통
  soft:     { b: 1.12, limb: 1.1, mu: 0,  belly: .9,  hip: 1.08 },  // 약간 통통 · 뱃살
  athletic: { b: 1.03, limb: 1.05, mu: .75, belly: 0, hip: .97 },   // 운동으로 탄탄
  stocky:   { b: 1.15, limb: 1.12, mu: .45, belly: .55, hip: 1.04 }, // 다부진 · 굵은 뼈대
  curvy:    { b: 1.04, limb: 1.04, mu: 0,  belly: .25, hip: 1.12 },  // 볼륨 있는 여성
  muscular: { b: 1.08, limb: 1.12, mu: 1,   belly: 0,   hip: .98 },   // v38 근육질(넓은 어깨·굵은 팔)
  plus:     { b: 1.27, limb: 1.24, mu: .1,  belly: 1.2, hip: 1.17 },  // v38 플러스 사이즈(통통·큰 체형)
};
const M_PROF = [[0, -.12], [.12, -.11], [.148, -.04], [.16, .06], [.15, .16], [.16, .27], [.185, .38], [.2, .45], [.17, .5], [.1, .53], [.05, .56]];
const F_PROF = [[0, -.12], [.13, -.11], [.16, -.04], [.162, .04], [.128, .15], [.138, .25], [.152, .33], [.148, .4], [.155, .45], [.13, .5], [.08, .53], [.045, .56]];
/* 조각된 두상: 구의 정점을 얼굴 해부학대로 변위 (UV 유지 → 얼굴 텍스처 정렬 그대로) */
function sculptHead(r, fem, H = {}) {   // v38 H: 개인별 골격(콧대·눈썹뼈·눈두덩·광대·입 돌출·턱끝·턱 너비·비대칭)
  const seg = NC.isMobile ? [52, 40] : [72, 54], g = new T.SphereGeometry(r, seg[0], seg[1]), p = g.attributes.position, v = new T.Vector3();
  const BR = H.bridge ?? 1, RD = H.ridge ?? 1, SK = H.socket ?? 1, CH = H.cheek ?? 1, PG = H.prog ?? 1, CN = H.chin ?? 1, JW = H.jaw ?? 1, AS = H.asym || 0;
  const B = (a, b, a0, b0, sa, sb) => Math.exp(-((a - a0) * (a - a0) / (sa * sa) + (b - b0) * (b - b0) / (sb * sb)));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize(), a = Math.atan2(n.x, n.z), b = Math.asin(U.clamp(-n.y, -1, 1)), front = Math.max(0, Math.cos(a));
    let d = .03 * RD * B(a, b, 0, -.2, .6, .1) * front * (fem ? .6 : 1);            // 눈썹뼈 (유럽·남아시아계 ↑ · 동아시아계 ↓)
    d += .045 * BR * B(a, b, 0, .14, .07, .2);                                        // 콧대 높이
    d += .028 * PG * B(a, b, 0, .55, .2 * (.8 + .2 * PG), .09);                       // 입·윗턱 돌출
    d += .04 * CN * B(a, b, 0, .84, .2, .11);                                         // 턱끝
    for (const s of [-1, 1]) { const k = 1 + s * AS; d -= .032 * SK * k * B(a, b, s * .31, .04, .14, .09); d += .028 * CH * k * B(a, b, s * .55, .23, .2, .13); d -= .03 * (2 - CH) * B(a, b, s * .72, .55, .2, .22); d -= .02 * B(a, b, s * .2, .42, .08, .08); }
    if (BR < .85) d -= .012 * (.85 - BR) / .25 * B(a, b, 0, .05, .25, .15);                               // 낮은 콧대 → 미간·눈 사이가 평평
    d -= .05 * B(a, b, Math.PI, .2, .6, .5) * (1 - front);                            // 뒤통수 정리
    if (TOON) { d *= .4; for (const s of [-1, 1]) d += .03 * B(a, b, s * .55, .4, .28, .22); }
    let k = 1 + d; v.multiplyScalar(k);
    if (b > .2) v.x *= 1 - (TOON ? (fem ? .14 : .1) : (fem ? .2 : .14) * (2.2 - 1.2 * JW)) * Math.min(1, (b - .2) / .8) * (.4 + .6 * front);   // 턱선 (v38 각진 턱 ↔ 갸름한 턱)
    if (b > -.05 && b < .45) v.x *= 1 + .05 * (CH - 1) * front * Math.exp(-((b - .2) * (b - .2)) / .04);                                 // 광대 너비
    if (b > .35) v.z += r * .03 * front * Math.min(1, (b - .35) / .5);                // 아래턱 앞으로
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
const TL = NC.TexLib;
const rimInject = (rgb, k) => sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', `{ vec3 vd = normalize(vViewPosition); float rim = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 2.6); gl_FragColor.rgb += vec3(${rgb}) * rim * ${k} * diffuseColor.rgb; }\n#include <tonemapping_fragment>`); };
/* v31 M_Realistic_Skin: 피하 산란(SSS) 근사 — 빛이 닿는 경계가 붉게 번지는 wrap 확산광 + 모공 노멀 + 피지(T존) 광택 + 은은한 붉은 림
 *  three r128 물리 조명 청크의 직접광 확산 항만 교체 (반사광은 그대로) → 모든 화질에서 동작, 텍스처 추가 없음 */
const SSS_CHUNK = (() => { const c = T.ShaderChunk.lights_physical_pars_fragment, a = 'reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );';
  return c && c.includes(a) ? c.replace(a, `{ float wNL = clamp((dot(geometry.normal, directLight.direction) + 0.5) / 1.5, 0.0, 1.0); vec3 sssI = directLight.color * (wNL * wNL) * vec3(1.0, 0.42, 0.3) * 0.55;
    #ifndef PHYSICALLY_CORRECT_LIGHTS
      sssI *= PI;
    #endif
    reflectedLight.directDiffuse += (irradiance * 0.78 + sssI) * BRDF_Diffuse_Lambert( material.diffuseColor ); }`) : null; })();
const skinCompile = sh => { if (SSS_CHUNK) sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', SSS_CHUNK); rimInject('1.0,0.45,0.35', '0.16')(sh); };
/* v42 실제 피부 반사율: 팔레트의 아주 밝고 채도 낮은 색(인형·마네킹처럼 보이던 원인)을 실제 피부 알베도 범위로 — 명도 ↓ · 채도 ↑ (어두운 피부는 거의 그대로) */
function realSkin(hex) { const c = new T.Color(hex), h = {}; c.getHSL(h); const l2 = h.l > .5 ? h.l - (h.l - .5) * .42 : h.l, s2 = Math.min(.62, h.s * (h.l > .5 ? 1.35 : 1.1) + .04); return '#' + c.setHSL(h.h, s2, l2).getHexString(); }
function skinMat(skin, map) {
  const m = new T.MeshStandardMaterial({ roughness: .56, metalness: 0 });
  if (map) m.map = map; else m.color = NC.col(NC.Face && NC.Face.on ? realSkin(skin) : skin);
  if (TL) { const nm = TL.texture('skin', 'normal', {}, map ? [16, 16] : [12, 12]); if (nm) { m.normalMap = nm; m.normalScale.set(map ? .06 : .1, map ? .06 : .1); } const rm = TL.texture('skin', 'rough', {}, [4, 4]); if (rm) m.roughnessMap = rm; }   // 모공·피지 광택 변화
  m.emissive = NC.col(skin).multiplyScalar(.012);
  m.onBeforeCompile = skinCompile; m.customProgramCacheKey = () => 'skinSSS'; return m;
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
  else if (kind === 'floral') {   // v30 잔꽃무늬(네이비 바탕 + 분홍·파랑 꽃 + 잎)
    const r = U.rng(41); g.fillStyle = color; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { const x = r() * S, y = r() * S, k = r(); g.fillStyle = k < .62 ? ['#e86a9a', '#f08ab0', '#d8508a'][i % 3] : k < .82 ? '#5a8ad8' : '#f4d8e4';
      for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.6, 0, 7); g.fill(); } g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill();
      g.fillStyle = '#4a8a5a'; g.beginPath(); g.ellipse(x + 7, y + 4, 3.5, 1.5, .6, 0, 7); g.fill(); } }
  else if (kind === 'cord') { g.fillStyle = color; g.fillRect(0, 0, S, S); for (let x = 0; x < S; x += 8) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x, 0, 3, S); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 4, 0, 2, S); } }   // 코듀로이 골
  else if (kind === 'knit') { g.fillStyle = color; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 10) for (let x = 0; x < S; x += 10) { g.fillStyle = 'rgba(0,0,0,.07)'; g.beginPath(); g.ellipse(x + 3, y + 5, 2.4, 4.4, .5, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 7, y + 5, 2.4, 4.4, -.5, 0, 7); g.fill(); } }   // 니트 짜임
  else if (kind === 'paisley') { g.fillStyle = color; g.fillRect(0, 0, S, S); g.strokeStyle = '#f4f2ee'; g.fillStyle = '#f4f2ee'; g.lineWidth = 2.2;   // 페이즐리 반다나
    for (let y = 0; y < S; y += 64) for (let x = (y / 64 % 2) * 32; x < S; x += 64) { g.beginPath(); g.ellipse(x + 20, y + 26, 9, 15, .6, 0, 7); g.stroke(); g.beginPath(); g.arc(x + 14, y + 36, 3, 0, 7); g.fill(); for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + 44 + Math.cos(k) * 7, y + 48 + Math.sin(k) * 7, 1.6, 0, 7); g.fill(); } }
    g.lineWidth = 4; g.strokeRect(4, 4, S - 8, S - 8); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 4;
  if (kind === 'monogram') t.repeat.set(3, 3); if (kind === 'floral') t.repeat.set(5, 4); if (kind === 'cord') t.repeat.set(5, 1); if (kind === 'knit') t.repeat.set(5, 5); if (kind === 'paisley') t.repeat.set(1.5, 1.5);
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
/* v31 M_Cloth_Fabric: 원단별 노멀 — 면(잔 노이즈) · 데님(능직 사선) · 니트(V 스티치) + 중력 방향 세로 드레이프 주름과 가로 구김을 한 장에 굽기 */
const fabCache = {};
function fabricNormal(type) {
  if (fabCache[type]) return fabCache[type]; if (NC.quality && NC.quality.level === 'low') return null;
  const S = 512, h = new Float32Array(S * S), r = U.rng(U.hash('fab' + type));
  const folds = []; for (let i = 0; i < 7; i++) folds.push([r() * S, 18 + r() * 40, .5 + r() * .8, r() * 6]);
  const creases = []; for (let i = 0; i < 4; i++) creases.push([r() * S, 6 + r() * 10, .25 + r() * .3]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0; for (const [cx, w, a, ph] of folds) { const dx = ((x - cx + S * 1.5) % S) - S / 2; v += a * Math.exp(-(dx * dx) / (w * w)) * (.7 + .3 * Math.sin(y / S * 6.283 * 2 + ph)); }
    for (const [cy, w, a] of creases) { const dy = ((y - cy + S * 1.5) % S) - S / 2; v -= a * Math.exp(-(dy * dy) / (w * w)) * (.6 + .4 * Math.sin(x / 40)); }
    let wv; if (type === 'denim') wv = ((x + y) % 6 < 3 ? .12 : 0) + (x % 2) * .03; else if (type === 'knit') { const cx = x % 10, cy = y % 12; wv = .16 * Math.exp(-(((cx < 5 ? cx - (cy * .35) : (10 - cx) - (cy * .35)) - 1.5) ** 2) / 1.6); } else wv = (r() - .5) * .07 + ((x % 3 === 0) ? .025 : 0);
    h[y * S + x] = v * .55 + wv;
  }
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data, str = type === 'knit' ? 3.2 : 2.4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const L = h[y * S + (x - 1 + S) % S], R = h[y * S + (x + 1) % S], Up = h[((y - 1 + S) % S) * S + x], D = h[((y + 1) % S) * S + x];
    let nx = (L - R) * str, ny = (Up - D) * str; const k = 1 / Math.hypot(nx, ny, 1), i = (y * S + x) * 4; d[i] = (nx * k * .5 + .5) * 255; d[i + 1] = (ny * k * .5 + .5) * 255; d[i + 2] = (k * .5 + .5) * 255; d[i + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1.5, 1.5); t.anisotropy = 4; return fabCache[type] = t;
}
function clothMat(color, kind, o = {}) {
  const { pattern: _pt, ...so } = o; const m = NC.mat.std(color, so); if (!TL) return m;
  if (o.pattern && o.pattern !== 'solid') { m.map = patternTex(o.pattern, color); m.color.setRGB(1, 1, 1); { const fn = fabricNormal(o.pattern === 'knit' ? 'knit' : kind === 'denim' ? 'denim' : 'cotton'); m.normalMap = fn || TL.texture('fabric', 'normal', {}, [9, 9]); m.normalScale.set(fn ? .9 : .5, fn ? .9 : .5); } m.onBeforeCompile = rimInject('1.0,1.0,1.0', '0.25'); return m; }
  if (kind === 'sequin') { m.normalMap = TL.texture('sequin', 'normal', {}, [10, 10]); m.normalScale.set(.9, .9); m.metalness = .55; m.roughness = .3; m.envMapIntensity = 1.6; }
  else if (kind === 'satin') {   // v38 실크·새틴: 매끈한 광택 + 흐르는 드레이프 주름(잔 원단결 없음)
    const fn = fabricNormal('cotton'); if (fn) { m.normalMap = fn; m.normalScale.set(.55, .55); } m.roughness = .26; m.metalness = .14; m.envMapIntensity = 1.35; m.onBeforeCompile = rimInject('1.0,0.98,0.95', '0.35'); return m; }
  else if (kind === 'velvet') {   // v38 벨벳: 빛을 흡수하는 깊은 색 + 가장자리에서 밝게 빛나는 결(시인)
    const v = new T.MeshPhysicalMaterial({ color: NC.col(color), roughness: .92, metalness: 0 }); if ('sheen' in v) v.sheen = NC.col(color).lerp(new T.Color('#ffffff'), .45);
    const fn = fabricNormal('cotton'); if (fn) { v.normalMap = fn; v.normalScale.set(.7, .7); } v.onBeforeCompile = rimInject('1.0,0.92,0.95', '0.9'); return v; }
  else { m.map = TL.texture('fabric', 'map', {}, [kind === 'denim' ? 6 : 9, kind === 'denim' ? 6 : 9]); const fn = fabricNormal(kind === 'denim' ? 'denim' : 'cotton'); m.normalMap = fn || TL.texture('fabric', 'normal', {}, [9, 9]); m.normalScale.set(fn ? .9 : .6, fn ? .9 : .6); m.roughness = Math.max(m.roughness, kind === 'denim' ? .78 : .7); }
  m.onBeforeCompile = rimInject('1.0,1.0,1.0', '0.12'); return m;
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
  const cap = (rr, len, tilt) => { const m = new T.Mesh(G(`cap${rr}_${len}`, () => new T.SphereGeometry(rr, 30, 16, 0, Math.PI * 2, 0, Math.PI * len)), mHair); m.rotation.x = -tilt; m.userData.hairPart = 'cap'; return add(m); };
  const backFall = (L, rb, ts = Math.PI / 2, tl = Math.PI) => { const g = G(`bf${L}_${rb}_${ts}_${tl}`, () => { const c = new T.CylinderGeometry(r * 1.04, r * rb, L, 24, 1, true, ts, tl); c.translate(0, -L / 2 + r * .05, 0); return c; }); return add(new T.Mesh(g, mHair)); };
  const bangs = (ps, pl, th0, tl) => { const m = add(new T.Mesh(G(`bg${ps}_${pl}_${th0}_${tl}`, () => new T.SphereGeometry(r * 1.09, 20, 6, ps, pl, th0, tl)), mHair)); m.userData.hairPart = 'bangs'; return m; };
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
    case 'fade': cap(r * 1.025, .5, .52); blob(0, .66, .02, .9, .36, .9); break;   // v38 페이드(옆·뒤는 짧게, 윗머리만 살짝)
    case 'afro': { cap(r * 1.08, .5, .42); blob(0, .5, -.3, 1.36, 1.18, 1.26);   // v38 아프로: 둥근 큰 볼륨 + 곱슬 결(표면 작은 덩어리)
      const rr = U.rng(U.hash(look.hairColor + 'afro')); for (let i = 0; i < 26; i++) { const a = rr() * Math.PI * 2, el = -.1 + rr() * 1.4; if (-Math.sin(a) > .5 && el < .75) continue; blob(Math.cos(a) * Math.cos(el) * 1.32, .5 + Math.sin(el) * 1.08, -.3 - Math.sin(a) * Math.cos(el) * 1.2, .26); } } break;
    case 'curtain': cap(r * 1.07, .5, .45); bangs(front - 1.02, .86, Math.PI / 2 - .52, .32); bangs(front + .16, .86, Math.PI / 2 - .52, .32); blob(0, .6, -.1, .98, .45, .98); break;   // v38 90년대 가운데 가르마 커튼 헤어
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
  if (u.skinBody && u.skMats) {   // v41 스킨드 몸: 재질 배열에서 겉옷 칸만 교체(팔 소매 → 피부, 몸통 → 캐미솔, 오버셔츠 겉판 → 숨김)
    const sb = u.skinBody, S = u.skMats, sT = S.get(top), sS = S.get(sleeve), sK = S.get(skin), hid = new T.MeshBasicMaterial({ visible: false }), cm = cami.clone(); cm.skinning = true;
    u.undressed.set(sb, { m: sb.material, v: sb.visible }); sb.material = sb.material.map(m => m === sS && sS !== sT ? sK : m === sT ? (kind === 'overshirt' ? hid : cm) : m); }
  u.fig.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || (o.material !== top && o.material !== sleeve)) return;
    u.undressed.set(o, { m: o.material, v: o.visible });
    if (arms.has(o.parent)) o.material = skin; else if (kind === 'overshirt' && o.material === top) o.visible = false; else o.material = cami; });
  return true;
}
/* ═════ v41 이어진 스킨드 몸(SkinnedMesh) ═════
 *  예전: 몸통·목·위팔·아래팔·허벅지·정강이가 각각 따로 된 단단한 통 → 관절마다 이음매(호두까기 인형 느낌)
 *  지금: 몸통+목, 팔 2, 다리 2 를 이음매 없는 피부 한 장(SkinnedMesh)으로 만들고, 기존 rig Group 마다 Bone 을 붙여 rig 회전 = 뼈 회전.
 *        → motion·couple·contact·karaoke 등 애니메이션 코드는 손대지 않아도 그대로 동작.
 *  관절: 위뼈 · 절반 회전 이음뼈(v40 bridge) · 아래뼈 3개를 섞어(가우스 가중치) 접혀도 부피가 꺼지지 않음(교정 블렌드셰이프 역할).
 *  해부학 단면: 대흉근·견갑골·척추 고랑·둔근·승모근 경사·이두/삼두·주두(팔꿈치뼈)·슬개골·비복근(종아리)·납작한 손목/발목.
 *  ?legacybody 로 예전 몸 확인 가능. */
const SKIN_BODY = !/[?&]legacybody/.test(location.search);
const SKQ = NC.isMobile || (NC.quality && NC.quality.level === 'low') ? { ts: 16, ls: 10, dy: .02 } : { ts: 28, ls: 16, dy: .012 };
const gau = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (s * s));
const sstep = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smax = (a, b, k) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;
function mono(P) {   // 단조 3차 보간(Fritsch–Carlson): 프로파일 키 사이를 출렁임 없이 매끈하게
  const n = P.length, x = P.map(p => p[0]), y = P.map(p => p[1]), d = [], m = new Array(n).fill(0);
  if (n < 2) return () => y[0];
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2]; for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b; if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
  return X => { if (X <= x[0]) return y[0]; if (X >= x[n - 1]) return y[n - 1]; let i = 0; while (X > x[i + 1]) i++; const h = x[i + 1] - x[i], t = (X - x[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h * m[i + 1]; };
}
const PF = {}; for (const k in LIMB_PROF) PF[k] = mono(LIMB_PROF[k]);
function wNorm(list) { const a = list.filter(w => w[1] > 1e-3).sort((p, q) => q[1] - p[1]).slice(0, 4), s = a.reduce((t, w) => t + w[1], 0) || 1; return a.map(w => [w[0], w[1] / s]); }
/* 링(단면 고리)을 위→아래 순서로 쌓아 띠(strip)를 만들고, 띠마다 재질 슬롯을 붙여 한 지오메트리로 합침 */
function SkinGeo() {
  const P = [], UV = [], SI = [], SW = [], strips = [];
  return {
    strip(rings, seg, slot, o = {}) {
      if (rings.length < 2) return; const base = P.length / 3, n = seg + 1, idx = [];
      for (const rg of rings) for (let i = 0; i <= seg; i++) { const p = rg.pts[i]; P.push(p[0], p[1], p[2]); UV.push(i / seg, rg.v); for (let k = 0; k < 4; k++) { const w = rg.w[k]; SI.push(w ? w[0] : 0); SW.push(w ? w[1] : 0); } }
      for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < seg; i++) { const a = base + j * n + i, b = a + 1, c = a + n, d = c + 1; if (o.flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
      strips.push({ slot, idx, base, rings: rings.length, n, open: !!o.open });
    },
    build() {
      const slots = [], g = new T.BufferGeometry(), idx = [];
      strips.forEach(s => { if (!slots.includes(s.slot)) slots.push(s.slot); });
      slots.forEach((sl, k) => { const st = idx.length; strips.forEach(s => { if (s.slot === sl) for (let i = 0; i < s.idx.length; i++) idx.push(s.idx[i]); }); g.addGroup(st, idx.length - st, k); });
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2));
      g.setAttribute('skinIndex', new T.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(SW, 4));
      g.setIndex(idx); g.computeVertexNormals();
      const N = g.attributes.normal;   // 둘레 이음선(θ=0/2π) 노멀 평균 → 세로 줄무늬 없음
      strips.forEach(s => { if (s.open) return; for (let j = 0; j < s.rings; j++) { const a = s.base + j * s.n, b = a + s.n - 1, x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1; N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l); } });
      g.computeBoundingSphere(); g.boundingSphere.radius *= 1.45;   // 앉기·춤으로 팔다리가 벌어져도 화면 가장자리에서 잘리지 않게
      return { g, slots };
    } };
}
/* 수직 튜브 링: c=중심, yList 위→아래, sec(y,θ)→[x,z] (중심 기준), wf(y)→가중치, v(y) */
function tubeRings(c, yList, seg, sec, wf, vf, th0 = 0, th1 = Math.PI * 2) {
  return yList.map(y => { const pts = []; for (let i = 0; i <= seg; i++) { const th = th0 + (th1 - th0) * i / seg, q = sec(y, th); pts.push([c.x + q[0], c.y + y, c.z + q[1]]); } return { pts, w: wf(y), v: vf(y) }; });
}
function ys(a, b, dy) { const n = Math.max(1, Math.ceil(Math.abs(a - b) / dy)), o = []; for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; }   // a(위)→b(아래)
/* 단을 잇는 납작한 고리(소매 끝·밑단·목선): 바깥 반경 rkO → 안쪽 rkI, up=true 면 위를 향함 */
function hemRing(c, y, seg, sec, rkO, rkI, wf, up) {
  const mk = rk => { const pts = []; for (let i = 0; i <= seg; i++) { const th = Math.PI * 2 * i / seg, q = sec(y, th); pts.push([c.x + q[0] * rk, c.y + y, c.z + q[1] * rk]); } return { pts, w: wf(y), v: 0 }; };
  return up ? [mk(rkI), mk(rkO)] : [mk(rkO), mk(rkI)];
}
const SKGEO = new Map();   // 같은 체형·옷 구성은 지오메트리 공유(군중 메모리↓)
/* ───────── 아바타 생성 ───────── */
function create(o = {}) {
  const look = safeLook(mergeLook(o.seed != null ? o.seed : U.hash(o.name || String(Math.random())), o.gender, o.look));
  if (look.top === 'polo') { look.top = 'tee'; look.polo = true; }   // v32 폴로셔츠 = 반팔 티 + 카라 + 플래킷
  const BT = BODY[look.body] || null;
  const f = look.gender === 'f', B = BT ? BT.b * (look.build || 1) : (look.build || 1) * (TOON ? .88 : 1), LIMB = BT ? BT.limb : TOON ? .9 : 1, CV = look.curve != null ? look.curve : (f ? (BT ? .45 : .6) : .5),
    MU = f ? 0 : U.clamp(look.muscle != null ? look.muscle : BT ? BT.mu : 0, 0, 1), BELLY = BT ? (look.belly != null ? look.belly : BT.belly) : 0, HIPK = BT ? BT.hip : 1, TONE = f && look.body === 'athletic';   // MU: 남성 근육량   // CV: 여성 글래머 / 남성 어깨
  const root = new T.Group(), fig = new T.Group(); root.add(fig);
  const SKIN = SKIN_BODY && !o.legacyBody;   // v41 이어진 스킨드 몸
  const figScale = look.height / (TOON ? 1.86 : 1.75); fig.scale.setScalar(figScale);
  const body = new T.Group(); fig.add(body);
  const hipH = TOON ? 1.06 : .965, hips = new T.Group(); hips.position.y = hipH; body.add(hips);
  const torso = new T.Group(); hips.add(torso);
  const shiny = look.realWear ? { roughness: .82, metalness: 0 } : look.top === 'dress' ? { roughness: .32, metalness: .28 } : look.top === 'jacket' ? { roughness: .45, metalness: .1 } : { roughness: .6 };   // v25 남성 실사 의상 = 무광 울·면
  const pat = look.top === 'dress' ? (['leopard', 'floral'].includes(look.pattern) ? look.pattern : 'solid') : look.pattern;
  const LEATHER_TOP = look.top === 'halter' || look.top === 'stageJacket' || !!look.leather;   // v32 look.leather = 가죽 재킷
  const mSkin = skinMat(look.skin), mTop = LEATHER_TOP ? leatherMat(look.topColor) : look.metallic ? std(look.topColor, { metalness: .78, roughness: .26, envMapIntensity: 1.5 }) : look.satin ? clothMat(look.topColor, 'satin') : look.velvet ? clothMat(look.topColor, 'velvet') : look.denimTop ? clothMat(look.topColor, 'denim', { roughness: .8 }) : clothMat(look.topColor, look.top === 'dress' || look.sequin ? 'sequin' : 'fabric', Object.assign({ pattern: pat }, shiny)), mBot = look.bottom === 'cargo' ? clothMat(look.bottomColor, 'fabric', { roughness: .85 }) : clothMat(look.bottomColor, 'denim', { roughness: .8 }),
    mShoe = std(look.shoeColor || (TOON ? '#f4f4f6' : '#141018'), { roughness: look.shoes === 'sandals' ? .25 : .5, metalness: look.shoes === 'sandals' ? .8 : 0 }), mHair = std(look.hairColor, { roughness: TOON ? .34 : .42, metalness: .05, side: T.DoubleSide }),
    mSleeve = look.top === 'vest' ? std('#f4f2ee') : mTop;
  if (look.set && look.pattern && look.pattern !== 'solid' && look.bottom !== 'skirt') { mBot.map = patternTex(look.pattern, look.topColor); mBot.color.setRGB(1, 1, 1); }   // 상하 같은 패턴 셋업
  if (look.bottomPattern) { mBot.map = patternTex(look.bottomPattern, look.bottomColor); mBot.color.setRGB(1, 1, 1); }   // v30 하의 패턴(코듀로이 등)
  const mRip = look.fit === 'ripped' ? (() => { const m = clothMat(look.bottomColor, 'denim', { roughness: .85 }); m.map = ripTex(look.bottomColor); m.color.setRGB(1, 1, 1); return m; })() : null;
  // 몸통
  const curveK = y => f ? (y > .28 && y < .44 ? 1 + .07 * CV : y > .1 && y < .2 ? 1 - .07 * CV : y > -.08 && y < .06 ? 1 + .09 * CV : 1) : (y > .36 ? 1 + .1 * (CV - .5) + .16 * MU : y > .22 ? 1 + .13 * MU : y > .08 && y < .2 ? 1 - .02 * MU : 1);
  const prof = (f ? F_PROF : M_PROF).map(([rr, y]) => new T.Vector2(rr * B * curveK(y), y)), PK = look.gender + B.toFixed(2) + CV.toFixed(2) + MU.toFixed(2);
  const crop = ['crop', 'halter', 'blazerCrop', 'meshCrop'].includes(look.top), over = look.top === 'overshirt', strap = !!look.strapless && (look.top === 'dress' || crop);   // v14: 스트랩리스 드레스 / 튜브탑
  const tor = mesh(G('tor' + PK, () => new T.LatheGeometry(prof, 22)), crop || strap ? mSkin : over ? clothMat(look.innerColor || '#f6f6f6', 'fabric') : mTop); tor.scale.z = .68; if (!SKIN) torso.add(tor);
  if (strap && !crop && !SKIN) { const sd = mesh(G('strap' + PK, () => new T.LatheGeometry(prof.filter(v => v.y <= .4).map(v => new T.Vector2(v.x * 1.03, v.y)), 22)), mTop); sd.scale.z = .7; torso.add(sd); }
  if (crop && !SKIN) { const up = mesh(G((strap ? 'tube' : 'crop') + PK, () => new T.LatheGeometry(prof.filter(v => strap ? v.y >= .2 && v.y <= .4 : v.y >= .14).map(v => new T.Vector2(v.x * 1.04, v.y)), 22)), mTop); up.scale.z = .7; torso.add(up);
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
  if (look.bandana) {   // v30 반다나(목에 묶은 삼각 스카프) — 매듭 + 양쪽 끝자락
    const bm = clothMat(look.bandana.color || '#1f2a44', 'fabric', { pattern: look.bandana.pattern || 'paisley', roughness: .8 });
    const ring = mesh(G('bandR', () => new T.TorusGeometry(.058, .016, 8, 26)), bm, 0, .545, .006, 1.05, 1, .9); ring.rotation.x = Math.PI / 2 - .12; torso.add(ring);
    torso.add(mesh(sph(), bm, 0, .53, .07, .024, .02, .018));
    for (const sd of [-1, 1]) { const tl = mesh(G('bandT', () => { const sh = new T.Shape(); sh.moveTo(-.022, 0); sh.lineTo(.022, 0); sh.lineTo(0, -.07); sh.closePath(); return new T.ShapeGeometry(sh); }), bm, sd * .022, .525, .084); tl.rotation.set(-.25, 0, sd * .55); tl.material.side = T.DoubleSide; torso.add(tl); } }
  if (look.sailor && (look.top === 'jacket' || look.top === 'shirt')) {   // v30 세일러 칼라: 뒤판 사각 칼라 + 앞 V 라펠 + 트림 라인
    const tm = std(look.sailor.trim || '#e8a6c4', { roughness: .6 }), cm = mTop, box = G('box', () => new T.BoxGeometry(1, 1, 1));
    const back = mesh(box, cm, 0, .47, -.098 * B, .25 * B, .15, .008); back.rotation.x = .28; torso.add(back);
    const bt = mesh(box, tm, 0, .4, -.118 * B, .22 * B, .006, .009); bt.rotation.x = .28; torso.add(bt);
    for (const sd of [-1, 1]) { const lp = mesh(box, cm, sd * .06, .45, .108 * B, .05, .19, .008); lp.rotation.set(-.3, sd * .3, sd * .5); torso.add(lp);
      const tr = mesh(box, tm, sd * .072, .445, .118 * B, .006, .19, .009); tr.rotation.set(-.3, sd * .3, sd * .5); torso.add(tr); } }
  if (look.bag) {   // v30 크로스백: 대각선 가죽 끈(앞·뒤) + 반대쪽 골반의 작은 가방
    const lm = std(look.bag.color || '#8a5a2e', { roughness: .55 }), box = G('box', () => new T.BoxGeometry(1, 1, 1));
    for (const zz of [1, -1]) { const st = mesh(box, lm, 0, .27, zz * .122 * B, .016, .62, .006); st.rotation.z = zz * -.62; torso.add(st); }
    torso.add(mesh(box, lm, -.19 * B, .03, .03, .035, .13, .1)); }
  if (look.necklace) { const nk = mesh(G('neck', () => new T.TorusGeometry(.068, .004, 6, 28)), G('neckM', () => std('#e8c56a', { metalness: .95, roughness: .2 })), 0, .5, .028); nk.rotation.x = Math.PI / 2 - .5; nk.scale.set(1, 1.15, 1); torso.add(nk); }
  if (over) { if (!SKIN) { const shell = mesh(G('over' + PK, () => new T.LatheGeometry(prof.filter(v => v.y >= -.12).map(v => new T.Vector2(v.x * 1.06, v.y)), 22, Math.PI * .14, Math.PI * 1.72)), mTop); shell.scale.z = .7; shell.material.side = T.DoubleSide; torso.add(shell); }
    const col2 = mesh(G('collar', () => new T.TorusGeometry(.06, .014, 6, 14)), mTop, 0, .54, -.005, 1.15, .8, 1); col2.rotation.x = Math.PI / 2; torso.add(col2); }
  if (look.top === 'jacket' || look.top === 'vest' || look.top === 'stageJacket') {   // V넥 안쪽 셔츠
    const vg = G('vneck', () => { const sh = new T.Shape(); sh.moveTo(-.07, .17); sh.lineTo(.07, .17); sh.lineTo(0, -.06); sh.closePath(); return new T.ShapeGeometry(sh); });
    const inner = mesh(vg, look.sailor ? mSkin : std(look.top === 'vest' ? '#f4f2ee' : look.top === 'stageJacket' ? (look.innerColor || '#141016') : (f ? '#f2e6ee' : '#f4f2ee')), 0, .36, .112); inner.rotation.x = -.22; torso.add(inner); }
  if (look.top === 'vest') { const bt = std('#0d0b10'); for (const s of [-1, 1]) { const w = mesh(G('cone', () => new T.ConeGeometry(1, 1, 4)), bt, s * .028, .5, .12, .022, .04, .012); w.rotation.z = s * Math.PI / 2; w.position.y = .505; w.position.z = .118; torso.add(w); } }
  if (look.top === 'shirt' && look.open) { const vg = G('vneck', () => { const sh = new T.Shape(); sh.moveTo(-.07, .17); sh.lineTo(.07, .17); sh.lineTo(0, -.06); sh.closePath(); return new T.ShapeGeometry(sh); }); const vv = mesh(vg, mSkin, 0, .43, .114 * B, .75, .62, 1); vv.rotation.x = -.22; torso.add(vv); }   // v38 오픈 칼라(단추 2개 풀린 실크 셔츠)
  if (look.top === 'shirt') { const col = mesh(G('collar', () => new T.TorusGeometry(.06, .014, 6, 14)), mTop, 0, .54, .01, 1, .75, 1); col.rotation.x = Math.PI / 2; torso.add(col); }
  if (f && !SKIN) {   // v12: 여성 실루엣 — 가슴 볼륨(의상 재질), 크기는 CV(글래머)
    const bm = LEATHER_TOP ? G('bustMatte' + look.topColor, () => std(look.topColor, { roughness: .62 })) : crop ? mTop : over ? clothMat(look.innerColor || '#f6f6f6', 'fabric') : mTop, bk = (.78 + .5 * CV) * B * (look.idol ? .9 : 1);
    for (const sd of [-1, 1]) { const bu = mesh(sph(), bm, sd * .058 * B, .35, .062 * B, .07 * bk, .056 * bk, .042 * bk); bu.rotation.x = .38; torso.add(bu); }   // v38 몸통에 자연스럽게 이어지는 완만한 볼륨
  }
  if (look.wings) {   // v14: 패션쇼 느낌의 깃털 날개 액세서리 (등)
    const wm = G('wingM' + look.wings, () => new T.MeshStandardMaterial({ color: look.wings === 'pink' ? 0xffc8e0 : look.wings === 'black' ? 0x1a1420 : 0xfaf6ff, roughness: .55, metalness: .05, side: T.DoubleSide, emissive: look.wings === 'black' ? 0x000000 : 0x302830 }));
    const wg = G('wingG', () => { const sh2 = new T.Shape(); sh2.moveTo(0, 0); sh2.bezierCurveTo(.12, .28, .36, .46, .5, .5); sh2.bezierCurveTo(.46, .3, .4, .1, .44, -.12); sh2.bezierCurveTo(.32, -.06, .2, -.2, .14, -.34); sh2.bezierCurveTo(.08, -.18, .04, -.08, 0, 0); return new T.ShapeGeometry(sh2, 14); });
    for (const sd of [-1, 1]) { const w = mesh(wg, wm, sd * .05, .36, -.11, sd, 1, 1); w.scale.x = sd; w.rotation.y = -sd * .45; w.userData.noMerge = true; torso.add(w); }
  }
  const mSkirtL = look.bottom === 'leather' ? leatherMat(look.bottomColor) : null;
  const hip = mesh(cyl(.172 * B * HIPK * (f ? 1 + .1 * CV : 1), .158 * B * HIPK * (f ? 1 + .12 * CV : 1), .18, 18), look.bottom === 'pants' || look.bottom === 'shorts' || look.bottom === 'cargo' ? mBot : look.bottom === 'leather' ? mSkirtL : look.bottom === 'tutu' ? std('#0d0b10', { roughness: .6 }) : (look.top === 'dress' ? mTop : std(look.bottomColor, { roughness: .6 })), 0, -.05, 0); hip.scale.z = .7; if (!SKIN) hips.add(hip);
  if (look.bottom === 'pants') { const belt = mesh(G('belt', () => new T.TorusGeometry(1, .08, 5, 22)), std('#18141c', { metalness: .4, roughness: .35 }), 0, .03, 0, .163 * B, .163 * B, .163 * B); belt.rotation.x = Math.PI / 2; belt.scale.y = .7 * .163 * B; hips.add(belt); }
  let skirt = null;
  if (look.belt || look.bottom === 'cargo') { const bt = mesh(G('beltW', () => new T.TorusGeometry(1, .16, 5, 24)), G('beltWM', () => std('#0c0a0e', { roughness: .35, metalness: .2 })), 0, .045, 0, .17 * B * (f ? 1 + .1 * CV : 1), .17 * B, .17 * B); bt.rotation.x = Math.PI / 2; bt.scale.y = .7 * .17 * B; hips.add(bt);
    hips.add(mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), G('chainM', () => std('#dcdce6', { metalness: 1, roughness: .18 })), 0, .045, .125 * B, .04, .03, .008)); }
  if (look.bottom === 'tutu') {   // v17 튤 스커트: 망사 3겹 + 안감
    skirt = new T.Group(); hips.add(skirt);
    [[.3, .24, 0], [.33, .22, .015], [.36, .2, .03]].forEach(([fl, len, dy], k) => { const m = mesh(G('tutu' + k + B.toFixed(2), () => new T.LatheGeometry([[.17 * B, .04 - dy], [.22 * B, -.04 - dy], [fl * B, -len - dy]].map(([a, b]) => new T.Vector2(a, b)), 26)), tulleMat()); m.scale.z = .82; m.userData.noMerge = true; skirt.add(m); });
    const lin = mesh(G('tutuL' + B.toFixed(2), () => new T.LatheGeometry([[.172 * B, .05], [.2 * B, -.06], [.22 * B, -.14]].map(([a, b]) => new T.Vector2(a, b)), 22)), std('#0d0b10', { roughness: .6, side: T.DoubleSide })); lin.scale.z = .8; lin.userData.noMerge = true; skirt.add(lin); }
  if (look.bottom === 'leather') { skirt = mesh(G('skL' + B.toFixed(2), () => new T.LatheGeometry([[.172 * B, .05], [.2 * B, -.08], [.235 * B, -.2], [.24 * B, -.22]].map(([a, b]) => new T.Vector2(a, b)), 22)), mSkirtL); skirt.material.side = T.DoubleSide; skirt.scale.z = .8; skirt.userData.noMerge = true; hips.add(skirt); }
  if (look.bottom === 'skirt') { const len = look.top === 'dress' ? (look.maxi ? .7 : look.mini ? .27 : .44) : (look.mini ? .23 : look.maxi ? .6 : .34); skirt = mesh(G('sk' + len + B.toFixed(2), () => new T.LatheGeometry([[.172 * B, .05], [.2 * B, -.1], [(len > .5 ? .29 : .25) * B, -len + .04], [(len > .5 ? .305 : .262) * B, -len]].map(([a, b]) => new T.Vector2(a, b)), 22)), look.top === 'dress' ? mTop : std(look.bottomColor, { roughness: .5, side: T.DoubleSide })); skirt.material.side = T.DoubleSide; skirt.scale.z = .8; skirt.userData.noMerge = true; hips.add(skirt); }
  if (BELLY > .05 && !SKIN) {   // v32 뱃살: 아랫배 볼륨(옷 재질 그대로 — 셔츠가 배에 걸쳐 당김)
    const bm2 = crop && !(look.top === 'halter') ? mSkin : look.top === 'dress' || strap ? mTop : over ? clothMat(look.innerColor || '#f6f6f6', 'fabric') : mTop;
    const bl = mesh(sph(), bm2, 0, .1 - .01 * BELLY, .052 * B, .125 * B, .1 + .015 * BELLY, .05 + .045 * BELLY); torso.add(bl);
    if (!f && BELLY > .4) torso.add(mesh(sph(), bm2, 0, .035, .045 * B, .14 * B, .055, .05 + .028 * BELLY));                            // 벨트 위로 살짝 넘치는 라인
  }
  if (look.polo) {   // v32 폴로: 카라 + 단추 플래킷
    const col = mesh(G('collar', () => new T.TorusGeometry(.06, .014, 6, 14)), mTop, 0, .54, .01, 1.05, .8, 1.05); col.rotation.x = Math.PI / 2 - .08; torso.add(col);
    const pl = mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), mTop, 0, .47, .108 * B, .028, .1, .006); pl.rotation.x = -.18; torso.add(pl);
    const bm3 = G('poloBtn', () => std('#f4f2ec', { roughness: .3 })); for (const y of [.5, .455]) torso.add(mesh(sph(), bm3, 0, y, .113 * B, .006, .006, .003)); }
  // 목 · 머리
  const neck = new T.Group(); neck.position.y = .55; torso.add(neck);
  if (!SKIN) neck.add(TOON ? mesh(cyl(f ? .036 : .044 * (1 + .3 * MU), f ? .046 : .054 * (1 + .3 * MU), .15), mSkin, 0, .05, .005) : mesh(cyl(f ? .047 : .056 * (1 + .25 * MU), f ? .056 : .066 * (1 + .25 * MU), .085), mSkin, 0, .022, .005));   // v31 목: 짧고 굵게(실제 비율)
  const head = new T.Group(); head.position.y = TOON ? .1 : .044;   /* v38 목이 길어 보이던 문제 → 머리를 1.4cm 낮춤 */ head.scale.setScalar(HEAD_S); neck.add(head);
  const F = look.face, r = .115, sx = .86 * (F.faceW || 1), sy = 1.03 * (F.jaw || 1), sz = .98;
  const skull = new T.Group(); skull.position.set(0, .095, .012); skull.scale.set(sx, sy, sz); head.add(skull);
  const FC = NC.Face && NC.Face.on && !o.legacyFace && !TOON ? NC.Face.build({ look, skull, head, r, mSkin, lod: o.hiRes && !(NC.quality && NC.quality.level === 'low') && !NC.isMobile ? 'hi' : undefined }) : null;   // v42 새 3D 얼굴(예전 구+그린 얼굴 대체)
  const hi = o.hiRes && !(NC.quality && NC.quality.level === 'low');
  const lowQ = NC.quality && NC.quality.level === 'low', fcv = document.createElement('canvas'), half = (lowQ && !o.hiRes) || NC.isMobile; if (FC) fcv.width = fcv.height = 4;   // v34 모바일은 얼굴 텍스처 512×256 (갱신 때마다 GPU 업로드 ¼)
  if (!FC) fcv.width = hi && !NC.isMobile ? FW * 2 : half ? FW / 2 : FW; if (!FC) fcv.height = hi && !NC.isMobile ? FH * 2 : half ? FH / 2 : FH;   // v17: 저사양은 얼굴 텍스처 절반 크기(그리기 CPU ¼)
  const ftex = NC.tex(fcv); ftex.anisotropy = 8;
  const headMat = skinMat(look.skin, ftex); headMat.color.setRGB(1, 1, 1);
  const q = v => Math.round((v ?? 1) * 20) / 20, HM = { bridge: q(F.bridge), ridge: q(F.ridge), socket: q(F.socket), cheek: q(F.cheek), prog: q(F.prog), chin: q(F.chin), jaw: q(F.jaw), asym: Math.round(((F.asym && F.asym.jaw) || 0) * 40) / 40 };
  const headMesh = new T.Mesh(G('head' + look.gender + JSON.stringify(HM), () => sculptHead(r, f, HM)), headMat); headMesh.userData.noMerge = true; if (!FC) skull.add(headMesh);   // v38 사람마다 다른 두상(같은 얼굴 재사용 금지)
  const onHead = (a, b, k = 1) => new T.Vector3(r * k * Math.sin(a) * Math.cos(b), -r * k * Math.sin(b), r * k * Math.cos(a) * Math.cos(b));
  const nose = mesh(sph(), mSkin); nose.position.copy(onHead(0, .24, .975)); nose.position.copy(onHead(0, .27, .955)); const nk = TOON ? (f ? .6 : .74) : 1; if (!f) nose.position.copy(onHead(0, .25, .935)); nose.scale.set((f ? .0105 : .0118) * F.nose * nk * (F.noseW || 1) / sx, (f ? .016 : .018) * F.nose * nk / sy, (f ? .0135 : .0082) * F.nose * nk * (.55 + .45 * (F.bridge || 1))); if (F.asym) nose.position.x += F.asym.nose * .01;
  if (!FC) for (const s2 of [-1, 1]) { const al = mesh(sph(), mSkin); al.position.copy(onHead(s2 * .085 * (F.noseW || 1), .3, .955)); al.scale.set(.0085 * (F.noseW || 1) / sx, .0068 / sy, .0075); skull.add(al); }   // v38 콧망울(코볼) — 인종별 코 너비
  if (!TOON && !FC) { nose.scale.z *= .62; nose.rotation.x = -.5; skull.add(nose); }   // v38 코끝 복구(예전엔 주석 안에 있어 빠져 있었음 — 돌출은 낮게)
  for (const s of [-1, 1]) { const ear = mesh(sph(), mSkin); ear.position.copy(onHead(s * 1.48, .06)); ear.scale.set(.009 / sx, .026 / sy, .018); if (!FC) skull.add(ear);
    if (F.earring && F.hoop) { const hr = mesh(G('hoop', () => new T.TorusGeometry(.016, .0018, 6, 22)), G('hoopM', () => std('#e8c56a', { metalness: .95, roughness: .2 }))); hr.position.copy(onHead(s * 1.48, .42, 1.03)); hr.scale.set(1 / sx, 1 / sy, 1); hr.rotation.y = Math.PI / 2; skull.add(hr); }   // v38 90년대 링 귀걸이
    else if (F.earring) { const er = mesh(sph(), std('#f2d27a', { metalness: .9, roughness: .2 })); er.position.copy(onHead(s * 1.48, .3, 1.02)); er.scale.set(.008 / sx, .008 / sy, .008); skull.add(er); } }
  const EXL = (TOON ? .33 : .31) + (F.eyeGap || 0), EYL = TOON ? .1 : .05;
  const corneaMat = G('cornea', () => new T.MeshPhysicalMaterial({ color: 0x000000, roughness: .02, metalness: 0, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.2, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));   // v31 M_Realistic_Eye: 각막 — 환경(HDRI) 반사 + 클리어코트 하이라이트
  const corneaGeo = mergeGeos([-1, 1].map(s => { const c = mesh(sph(), corneaMat); c.position.copy(onHead(s * EXL, EYL - .005, .955)); const es = (F.eyeSize || 1) * EYE_K / 1.3; c.scale.set(.017 * es / sx, .012 * es * (TOON ? 1.3 : 1) / sy, .009); c.updateMatrix(); const g = sph().clone(); g.applyMatrix4(c.matrix); return g; }));
  const corneaMesh = new T.Mesh(corneaGeo, corneaMat); corneaMesh.userData.noMerge = true; if (!FC) skull.add(corneaMesh); const corneas = [corneaMesh];
  if (!FC) { /* v31 속눈썹: 위 눈꺼풀 가장자리에 가는 가닥 카드(여성은 길고 촘촘하게) */ const lm = G('lashM', () => new T.MeshBasicMaterial({ color: 0x0c0809, side: T.DoubleSide })), n = f ? 14 : 9, len = f ? .011 : .007, es = (F.eyeSize || 1) * EYE_K / 1.3;
    const lg = G('lashG' + n + len, () => { const gs = []; for (let i = 0; i < n; i++) { const t = i / (n - 1) - .5, b = new T.PlaneGeometry(.0009, len); b.translate(0, len / 2, 0); b.rotateX(-.9 - Math.abs(t) * .3); b.rotateZ(-t * 1.1); b.translate(t * .034, -Math.abs(t) * .006, 0); gs.push(b); } return mergeGeos(gs); });
    for (const s of [-1, 1]) { const p = onHead(s * EXL, EYL + .07 * es, .985); const l = new T.Mesh(lg, lm); l.position.set(p.x, p.y, p.z); l.scale.set(es / sx, 1 / sy, 1); l.rotation.y = s * EXL * .9; l.userData.noMerge = true; skull.add(l); } }
  const mHair2 = look.hair2 ? std(look.hair2, { roughness: .32, metalness: .05, side: T.DoubleSide }) : null;   // v17 투톤(브릿지) 헤어
  buildHair(skull, look, mHair, r, mHair2);
  if (FC && NC.Face.hairCards) NC.Face.hairCards(skull, look, r, mHair, o.hiRes ? 'hi' : (NC.isMobile || lowQ) ? 'low' : 'mid');   // v42 가닥 머리카락
  if (F.glasses) {
    const gm = std(F.glassesColor || '#141418', { metalness: F.glassesColor ? .1 : .6, roughness: .3 }), gl = new T.Group(); head.add(gl); gl.position.set(0, .095, .012);
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
  if (look.hat) {   // 모자 (v30: 실사 비율에서도 표시) (두개골 그룹 안 → 머리 비율 그대로)
    const hm = std(look.hatColor || '#222', { roughness: .75 }), hg = new T.Group(); skull.add(hg);
    if (look.hat === 'cap') { hg.add(mesh(G('capd', () => new T.SphereGeometry(r * 1.14, 28, 14, 0, Math.PI * 2, 0, Math.PI * .5)), hm)); const brim = mesh(G('capb', () => new T.CylinderGeometry(r * .78, r * .78, r * .06, 24, 1, false, -Math.PI / 2, Math.PI)), hm, 0, r * .1, r * .72); brim.scale.set(1, 1, 1.15); brim.rotation.x = .32; hg.add(brim); hg.rotation.x = -.18; hg.position.y = r * .08; hg.add(mesh(sph(), hm, 0, r * 1.12, 0, r * .07, r * .05, r * .07)); }
    else if (look.hat === 'bucket') {   // v30 버킷햇: 원통 크라운 + 아래로 처진 챙
      hg.add(mesh(G('bkC', () => new T.CylinderGeometry(r * .9, r * 1.13, r * .78, 26)), hm, 0, r * .58, -r * .02)); hg.add(mesh(sph(), hm, 0, r * .97, -r * .02, r * .9, r * .12, r * .9));
      const br = mesh(G('bkB', () => new T.CylinderGeometry(r * 1.12, r * 1.6, r * .42, 30, 1, true)), hm, 0, r * .05, 0); br.material.side = T.DoubleSide; hg.add(br); hg.rotation.x = -.06; }
    else if (look.hat === 'visor') {   // v30 선 바이저: 머리띠 + 앞챙 (로고 없음)
      const band = mesh(G('vsB', () => new T.CylinderGeometry(r * 1.1, r * 1.12, r * .3, 28, 1, true)), hm, 0, r * .42, 0); band.material.side = T.DoubleSide; hg.add(band);
      const brim = mesh(G('capb', () => new T.CylinderGeometry(r * .78, r * .78, r * .06, 24, 1, false, -Math.PI / 2, Math.PI)), hm, 0, r * .32, r * .74); brim.scale.set(1.05, 1, 1.2); brim.rotation.x = .3; hg.add(brim); }
    else if (look.hat === 'beanie') { const d = mesh(G('bean', () => new T.SphereGeometry(r * 1.15, 26, 14, 0, Math.PI * 2, 0, Math.PI * .55)), hm); d.scale.y = 1.15; hg.add(d); const band = mesh(G('beanb', () => new T.TorusGeometry(r * 1.1, r * .1, 8, 30)), hm, 0, r * .08, 0); band.rotation.x = Math.PI / 2; hg.add(band); hg.add(mesh(sph(), hm, 0, r * 1.38, 0, r * .16, r * .16, r * .16)); hg.position.y = r * .05; }
    else if (look.hat === 'beret') { const b = mesh(G('beret', () => new T.SphereGeometry(r * 1.22, 26, 12)), hm, r * .1, r * .62, -r * .05, 1, .38, 1); b.rotation.z = -.2; hg.add(b); hg.add(mesh(sph(), hm, r * .12, r * 1.08, 0, r * .06, r * .06, r * .06)); }
    else if (look.hat === 'newsboy') { const c = mesh(G('newsC', () => new T.SphereGeometry(r * 1.2, 26, 12, 0, Math.PI * 2, 0, Math.PI * .5)), hm, 0, r * .05, -r * .04, 1, .78, 1.05); hg.add(c); const br = mesh(G('capb', () => new T.CylinderGeometry(r * .78, r * .78, r * .06, 24, 1, false, -Math.PI / 2, Math.PI)), hm, 0, r * .12, r * .8); br.scale.set(.9, 1, .7); br.rotation.x = .25; hg.add(br); hg.add(mesh(sph(), hm, 0, r * .98, 0, r * .07, r * .04, r * .07)); hg.rotation.x = -.12; }
    else if (look.hat === 'fedora') { hg.add(mesh(G('fedc', () => new T.CylinderGeometry(r * .82, r * 1.0, r * .75, 24)), hm, 0, r * .88, 0)); hg.add(mesh(G('fedb', () => new T.CylinderGeometry(r * 1.75, r * 1.75, r * .04, 32)), hm, 0, r * .52, 0)); hg.add(mesh(G('fedr', () => new T.CylinderGeometry(r * 1.005, r * 1.005, r * .14, 24, 1, true)), std('#141014', { roughness: .5 }), 0, r * .6, 0)); hg.rotation.x = -.1; hg.position.y = r * .02; }
  }
  // 팔
  const bare = ['tee', 'dress', 'crop', 'halter', 'meshCrop'].includes(look.top) && !look.longSleeve;   // v30 긴소매 티·니트
  const BR = [];   // v40 관절 이음살 목록(매 프레임 부모 관절 회전의 절반만큼 반대로 돌려 접힌 부위를 메움)
  const arm = s => {
    let DG = null, EG = null;
    const sh = new T.Group(); sh.position.set(s * (f ? .172 : .198 * (1 + .12 * (CV - .5) + .1 * MU)) * B * (TOON ? 1.02 : 1), .45, 0); torso.add(sh);
    { const shM = look.top === 'dress' || look.top === 'halter' || strap ? mSkin : mSleeve, dg = new T.Group(); dg.userData.bridge = true; sh.add(dg);   // v40 삼각근 이음살: 팔을 들어도 어깨가 공처럼 튀지 않게 어깨 회전의 절반만 따라 돎
      if (!SKIN) dg.add(mesh(sph(), shM, 0, -.012, 0, .05 * B * (1 + .4 * MU), .058, .049)); BR.push({ g: dg, src: sh, q: true }); DG = dg; }
    const uaT = .05 * B * LIMB * (1 + .5 * MU) * (TONE ? 1.04 : 1), uaB = .042 * LIMB * (1 + .35 * MU);
    if (!SKIN) sh.add(mesh(limb(bare ? 'ua' : 'uaC', uaT, uaB, .28), bare ? mSkin : mSleeve, 0, -.14, 0));
    if (look.oversize && !bare && !SKIN) sh.add(mesh(cyl(.07 * B, .072, .2), mSleeve, 0, -.1, 0));
    if (!SKIN && (look.top === 'tee' || look.top === 'crop' || look.top === 'meshCrop')) sh.add(mesh(cyl(.06 * B, .054, .13), mTop, 0, -.055, 0));
    const el = new T.Group(); el.position.y = -.28; sh.add(el);
    const faBare = bare || look.top === 'overshirt', faT = .042 * LIMB * (1 + .35 * MU), faB = .033 * LIMB * (1 + .2 * MU);
    if (!SKIN) el.add(mesh(limb(faBare ? 'fa' : 'faC', faT, faB, .25), faBare ? mSkin : mSleeve, 0, -.125, 0));
    { const er = Math.max(faT, uaB) * .97, eg = new T.Group(); eg.userData.bridge = true; el.add(eg); if (!SKIN) eg.add(mesh(G('jsph', () => new T.SphereGeometry(1, 20, 14)), faBare ? mSkin : mSleeve, 0, 0, 0, er, er, er)); BR.push({ g: eg, src: el, x: true }); EG = eg; }   // v40 팔꿈치: 위·아래팔 중 굵은 쪽 반지름에 맞춘 이음 — 팔 통의 열린 끝이 고리처럼 드러나던 이음매 제거
    if (faBare && !LITE_DETAIL) { if (!SKIN) el.add(mesh(sph(), mSkin, 0, -.006, -faT * .6, faT * .24, faT * .3, faT * .2)); }                   // 팔꿈치 뼈 돌출(뒤)
    else if (!LITE_DETAIL && !look.leather && !['vest', 'stageJacket'].includes(look.top)) {                                       // 소매 주름: 팔꿈치 안쪽 · 손목 뭉침
      if (!SKIN) for (const [y, k] of [[-.03, 1.06], [.012, 1.04]]) { const rg = mesh(G('fold', () => new T.TorusGeometry(1, .07, 4, 18)), mSleeve, 0, y, .004, faT * k, faT * k, faT * k * .9); rg.rotation.x = Math.PI / 2 + .25; el.add(rg); }
      if (!SKIN) for (const y of [-.2, -.225]) { const rg = mesh(G('fold', () => new T.TorusGeometry(1, .07, 4, 18)), mSleeve, 0, y, 0, faB * 1.0, faB * 1.0, faB * .94); rg.rotation.x = Math.PI / 2; el.add(rg); } }
    if (look.top === 'overshirt' && !SKIN) el.add(mesh(cyl(.05, .048, .05), mSleeve, 0, -.01, 0));
    const hand = new T.Group(); hand.position.y = -.27; hand.userData.isHand = true; el.add(hand);   // v40 손 표시(팔꿈치 이음살 그룹과 구분)
    if (look.watch && s < 0) { const wm = G('watchM' + (f ? 'g' : 's'), () => std(f ? '#d8b860' : '#c8ccd4', { metalness: .95, roughness: .22 })); const wb = mesh(cyl(1, 1, 1, 14), wm, 0, -.228, 0, faB * (SKIN ? 1.0 : 1.12), .02, faB * (SKIN ? .8 : 1.06)); el.add(wb);
      el.add(mesh(cyl(1, 1, 1, 14), G('watchF', () => std('#101418', { roughness: .1, metalness: .3 })), 0, -.228, faB * (SKIN ? .82 : 1.02), .013, .006, .013).rotateX(Math.PI / 2)); }   // v38 손목시계
    if (look.sailor) { const cf = mesh(G('cuffT', () => new T.TorusGeometry(.036, .004, 5, 18)), std(look.sailor.trim || '#e8a6c4', { roughness: .6 }), 0, -.225, 0); cf.rotation.x = Math.PI / 2; el.add(cf); }
    const mHand = look.gloves ? G('gloveM', () => leatherMat('#0c0a0e', true)) : mSkin;
    if (look.gloves) el.add(mesh(cyl(.036, .036, .06), mHand, 0, -.235, 0));
    const hk = TOON ? 1.12 : 1; hand.scale.setScalar(hk); hand.add(mesh(G('palm', () => new T.SphereGeometry(1, 12, 8)), mHand, 0, -.035, .004, SKIN ? .032 : .03, .045, SKIN ? .019 : .016));
    /* v40 손가락: 마디 2개(첫마디·끝마디) — 손 모양(편안/닿기/감싸기/쥐기)에 따라 새끼손가락 쪽이 더 굽는 자연스러운 계단 굽힘 */
    const fingers = [], fG = G('fing', () => new T.CylinderGeometry(.0065, .006, 1, 6)), nm = look.gloves ? null : G('nailM' + (f ? 'f' : 'm'), () => std(f ? '#f0b8b8' : '#e8c4b4', { roughness: .18, metalness: 0 })), ng = G('nailG', () => new T.SphereGeometry(1, 8, 6));
    for (let k = 0; k < 4; k++) { const fl = [.052, .058, .055, .045][k], fx = (k - 1.5) * .0135 * -s;
      const k1 = new T.Group(); k1.position.set(fx, -.072, .012); hand.add(k1); k1.add(mesh(fG, mHand, 0, -fl * .28, 0, 1, fl * .56, 1));
      const k2 = new T.Group(); k2.position.y = -fl * .56; k1.add(k2); k2.add(mesh(fG, mHand, 0, -fl * .21, 0, .92, fl * .42, .92));
      if (nm) k2.add(mesh(ng, nm, 0, -fl * .36, .0045, .0052, .0075, .0018));
      fingers.push({ k1, k2, w: [.85, 1, 1.08, 1.18][k], sp: (k - 1.5) * -s }); }
    const thG = new T.Group(); thG.position.set(s * -.022, -.04, .014); hand.add(thG); thG.add(mesh(fG, mHand, 0, -.022, 0, 1.15, .045, 1.15)); thG.rotation.set(.5, 0, s * -.6);
    hand.userData.fingers = fingers; hand.userData.thumb = thG; hand.userData.side = s;
    return { sh, el, hand, p: { uaT, uaB, faT, faB, bare, faBare, dg: DG, eg: EG } };
  };
  const AL = arm(-1), AR = arm(1);
  // 다리
  const leg = s => {
    let HG = null, KG = null;
    const lg = new T.Group(); lg.position.set(s * .09 * B * (f ? 1 + .08 * CV : 1), -.04, 0); hips.add(lg);
    const PANTS = look.bottom === 'pants' || look.bottom === 'cargo', legMat = PANTS ? (look.bottom === 'cargo' && s > 0 && look.cargoPrint ? G('cargoP' + look.bottomColor, () => { const m = clothMat(look.bottomColor, 'fabric', { pattern: 'graffiti', roughness: .85 }); return m; }) : mBot) : mSkin;
    if (look.bottom === 'shorts') lg.add(mesh(cyl(.088 * B, .08 * B, look.mini ? .1 : .2), mBot, 0, look.mini ? -.04 : -.09, 0));
    const TL1 = TOON ? .5 : .44, TL2 = TOON ? .49 : .43;
    const wide = (look.bottom === 'pants' && look.fit === 'wide') || look.bottom === 'cargo', thighMat = look.bottom === 'pants' && look.fit === 'ripped' ? mRip : legMat;
    const thT = (wide ? .086 : .078 * LIMB * (f ? 1 + .1 * CV : 1) * (HIPK > 1 ? 1 + (HIPK - 1) * .8 : 1)) * B, thB = wide ? .08 : .06 * LIMB;
    if (!SKIN) lg.add(mesh(wide ? cyl(thT, thB, TL1) : limb(PANTS ? 'thC' : 'th', thT, thB, TL1), thighMat, 0, -TL1 / 2, 0));
    if (!wide || SKIN) { const hg = new T.Group(); hg.userData.bridge = true; lg.add(hg); if (!SKIN) hg.add(mesh(sph(), thighMat, 0, -.01, 0, thT * 1.0, thT * 1.15, thT * .95)); BR.push({ g: hg, src: lg, q: true }); HG = hg; }   // v40 고관절 이음살(다리를 들어도 허벅지 윗부분이 끊겨 보이지 않게)
    const kn = new T.Group(); kn.position.y = -TL1; lg.add(kn);
    if (look.bottom === 'cargo') { const pk = mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), mBot, s * .085, -TL1 * .55, .01, .03, .12, .1); lg.add(pk); }   // 카고 포켓
    const bootM = G('bootM2', () => leatherMat('#0c0a0e', true));
    if (look.shoes === 'thigh' && !PANTS) { lg.add(mesh(cyl(.07 * LIMB, .06 * LIMB, TL1 * .42), bootM, 0, -TL1 * .79, 0)); kn.add(mesh(cyl(.062 * LIMB, .05 * LIMB, TL2), bootM, 0, -TL2 / 2, 0)); }   // v17 사이하이 부츠
    const snT = wide ? .08 : .058 * LIMB, snB = wide ? .1 : .044 * LIMB;
    if (!SKIN) kn.add(mesh(wide ? cyl(snT, snB, TL2) : limb(PANTS ? 'shC' : 'sh', snT, snB, TL2), legMat, 0, -TL2 / 2, 0));
    { const kr = Math.max(snT, thB) * .97, kg = new T.Group(); kg.userData.bridge = true; kn.add(kg); if (!SKIN) kg.add(mesh(G('jsph', () => new T.SphereGeometry(1, 20, 14)), legMat, 0, 0, 0, kr, kr, kr)); BR.push({ g: kg, src: kn, x: true }); KG = kg; }   // v40 무릎: 허벅지·정강이 중 굵은 쪽 반지름에 맞춘 이음(고리 모양 이음매 제거)
    if (!SKIN && !LITE_DETAIL && !PANTS && look.shoes !== 'thigh') kn.add(mesh(sph(), mSkin, 0, -.014, snT * .5, snT * .34, snT * .42, snT * .24));   // 슬개골(무릎뼈)
    if (PANTS && !LITE_DETAIL) {                                                                                                     // 바지 주름: 무릎 뒤 · 밑단이 신발 위에서 접힘(브레이크)
      const fm = legMat, fg = G('fold', () => new T.TorusGeometry(1, .07, 4, 18));
      if (!SKIN) { const rg = mesh(fg, fm, 0, .01, -.006, snT * 1.04, snT * 1.04, snT * .96); rg.rotation.x = Math.PI / 2 - .3; kn.add(rg); }
      for (const [y, k] of (wide ? [[-TL2 + .03, .99]] : [[-TL2 + .07, .99], [-TL2 + .04, 1.0], [-TL2 + .015, 1.01]])) { const rr = snB * k * (wide ? 1.0 : .97) * 1.03; const rg = mesh(fg, fm, 0, y, .004, rr, rr, rr * .95); rg.rotation.x = Math.PI / 2 + (y > -TL2 + .05 ? .12 : -.1); kn.add(rg); } }
    if (look.shoes === 'boots' && !PANTS) kn.add(mesh(cyl(.054, .05, .3), bootM, 0, -TL2 + .12, .005));
    const BOOT = look.shoes === 'boots' || look.shoes === 'thigh';
    if (look.shoes === 'sandals') {   // v30 샌들: 맨발 + 금색 얇은 밑창·스트랩
      kn.add(mesh(sph(), mSkin, 0, -TL2 - .005, .045, .04, .03, .105)); kn.add(mesh(G('sdS', () => new T.BoxGeometry(.085, .014, .23)), mShoe, 0, -TL2 - .035, .045));
      for (const zz of [.02, .085]) kn.add(mesh(G('sdT', () => new T.BoxGeometry(.09, .008, .012)), mShoe, 0, -TL2 - .008, zz)); kn.add(mesh(G('sdA', () => new T.TorusGeometry(.036, .004, 5, 16)), mShoe, 0, -TL2 + .02, -.01));
    } else if (look.shoes === 'platform') {   // v32 90년대 플랫폼 슈즈: 두꺼운 통굽(6~7cm)
      const pm = mShoe, sm = G('platSole' + (look.soleColor || ''), () => std(look.soleColor || '#0c0a0e', { roughness: .45 }));
      kn.add(mesh(sph(), pm, 0, -TL2 - .005, .045, f ? .048 : .058, .042, f ? .115 : .132));
      kn.add(mesh(G('nsole', () => new T.CylinderGeometry(1, 1, 1, 20)), sm, 0, -TL2 - .07, .045, f ? .05 : .058, .072, f ? .122 : .138));   // v37 둥근 통굽
      kn.add(mesh(G('nsole', () => new T.CylinderGeometry(1, 1, 1, 20)), G('platLine2', () => std('#4a4440', { roughness: .6 })), 0, -TL2 - .03, .045, f ? .052 : .06, .01, f ? .124 : .14));   // v37 흰 줄 → 어두운 라인
    } else if (look.shoes === 'flats') {   // v30 플랫 슈즈
      kn.add(mesh(sph(), mShoe, 0, -TL2 - .012, .045, .045, .03, .115)); kn.add(mesh(G('nsole', () => new T.CylinderGeometry(1, 1, 1, 20)), G('bsoleM', () => std('#08070a', { roughness: .5 })), 0, -TL2 - .038, .045, .046, .012, .115));
    } else if (BOOT) {   // v17 부츠: 광택 블랙 + 굽 있는 밑창
      kn.add(mesh(sph(), bootM, 0, -TL2 - .005, .045, f ? .05 : .06, .05, f ? .115 : .135));
      kn.add(mesh(G('nsole', () => new T.CylinderGeometry(1, 1, 1, 20)), G('bsoleM', () => std('#08070a', { roughness: .5 })), 0, -TL2 - .048, .045, f ? .05 : .06, .026, f ? .122 : .142));   // v37 둥근 부츠 밑창
      if (f) kn.add(mesh(G('heel', () => new T.BoxGeometry(.045, .07, .05)), G('bsoleM', () => std('#08070a', { roughness: .5 })), 0, -TL2 - .03, -.045));
    } else if (look.shoes === 'sneakers' || TOON) {   // v37 자연스러운 운동화: 발 모양 어퍼(발등·앞코·뒤꿈치) + 얇고 둥근 고무 밑창 — 예전 두꺼운 흰 사각 밑창(스펀지처럼 보임) 제거
      const sc = soleTone(look.shoeColor), w = f ? .045 : .053, L = f ? .116 : .13;
      kn.add(mesh(sph(), mShoe, 0, -TL2 - .014, .05, w, .036, L));              // 발등
      kn.add(mesh(sph(), mShoe, 0, -TL2 - .024, .118, w * .9, .026, L * .46));   // 앞코(살짝 납작)
      kn.add(mesh(sph(), mShoe, 0, -TL2 - .01, -.022, w * .94, .038, L * .36));  // 뒤꿈치
      kn.add(mesh(G('nsole', () => new T.CylinderGeometry(1, 1, 1, 20)), G('nsoleM' + sc, () => std(sc, { roughness: .9 })), 0, -TL2 - .049, .048, w * 1.06, .016, L * 1.04));   // 고무 밑창 1.6cm
      kn.add(mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), G('laceM', () => std('#2a2a2a', { roughness: .8 })), 0, -TL2 + .012, .085, .04, .006, .045));
    } else kn.add(mesh(G('foot' + look.gender, () => new T.BoxGeometry(f ? .075 : .095, .07, f ? .21 : .25)), mShoe, 0, -.45, .045));
    return { lg, kn, p: { thT, thB, snT, snB, TL1, TL2, wide, PANTS, mat: PANTS && thighMat !== legMat ? thighMat : legMat, hg: HG, kg: KG } };
  };
  const LL = leg(-1), LR = leg(1);
  let skinBody = null, skMats = null;
  if (SKIN) {   // ── v41 이어진 스킨드 몸 생성 ──
    const SG = SKQ, NL = .525, WY = .03;
    const teeLike = bare && ['tee', 'crop', 'meshCrop'].includes(look.top) && !strap, sleeveless = (bare && !teeLike) || strap;
    const innerM = over ? clothMat(look.innerColor || '#f6f6f6', 'fabric') : null, upperM = crop || strap ? mSkin : over ? innerM : mTop, hipM = hip.material;
    const MAT = { skin: mSkin, top: mTop, upper: upperM, hip: hipM, sleeve: mSleeve, legL: LL.p.mat, legR: LR.p.mat }, CAN = {}, slotM = {};
    for (const k in MAT) { let c = k; for (const j in slotM) if (slotM[j] === MAT[k]) { c = j; break; } if (c === k) slotM[k] = MAT[k]; CAN[k] = c; }
    const r3 = v => Math.round(v * 1000) / 1000, kp = o2 => Object.keys(o2).map(k => typeof o2[k] === 'number' ? r3(o2[k]) : typeof o2[k] === 'boolean' ? +o2[k] : '').join(',');
    const KEY = ['b41', look.gender, r3(B), r3(CV), r3(MU), r3(BELLY), r3(HIPK), look.idol ? 1 : 0, look.oversize ? 1 : 0, crop ? 1 : 0, strap ? 1 : 0, over ? 1 : 0, teeLike ? 1 : 0, sleeveless ? 1 : 0, kp(AL.p), kp(LL.p), kp(LR.p), JSON.stringify(CAN), SG.ts, SG.ls].join('|');
    const tc = body.worldToLocal(torso.getWorldPosition(new T.Vector3())), ac = [AL, AR].map(A => body.worldToLocal(A.sh.getWorldPosition(new T.Vector3()))), lc = [LL, LR].map(L => body.worldToLocal(L.lg.getWorldPosition(new T.Vector3())));
    let G41 = SKGEO.get(KEY);
    if (!G41) {
      const SB = SkinGeo();
      /* 몸통 + 목 (뼈 0 골반 · 1 몸통 · 2 목) */
      const HK = B * HIPK * (f ? 1 + .1 * CV : 1), NR = f ? .045 : .053 * (1 + .2 * MU);   /* v42 목 둘레 실제 비율(머리보다 굵어 보이던 문제) */
      const SW = (prof.find(v => Math.abs(v.y - .45) < .001) || { x: (f ? .155 : .2) * B }).x;
      const PH = f ? 1 : .93;   // 남성 골반은 가슴보다 좁게(V자) — 예전엔 골반=가슴 폭이라 상자처럼 보였음
      const TK = [[-.118, .004], [-.112, .09 * HK * PH], [-.1, .14 * HK * PH], [-.07, .163 * HK * PH], [-.04, .171 * HK * PH], [.02, f ? (.165 * HK + .14 * B) / 2 : .152 * B]]
        .concat(prof.filter(v => v.y > .07 && v.y < .41).map(v => [v.y, f ? v.x : v.y < .2 ? v.x * .97 : v.x]), [[.425, SW], [.452, SW * .95], [.478, SW * .8], [.502, SW * .58], [.525, NR * 1.5], [.55, NR * 1.12], [.575, NR], [.635, NR * .97], [.655, NR * .6], [.662, .004]]);   // 승모근: 목→어깨로 비스듬히 내려오는 경사
      const rxT = mono(TK), BUST = (.014 + .02 * CV) * B * (look.idol ? .9 : 1), PEC = (.005 + .012 * MU) * B, GLU = (f ? .022 : .013) * B * HIPK;
      const tSec = (y, th) => { const c = Math.cos(th), sn = Math.sin(th), r = rxT(y), k = y < .4 ? .68 : y < .5 ? .68 - .16 * sstep(.4, .5, y) : .52 + .48 * sstep(.5, .565, y);
        const x = c * r; let z = sn * r * k * (sn > 0 ? 1 - .28 * sstep(-.02, -.1, y) : 1) + .006 * sstep(.5, .6, y); /* 사타구니 앞은 평평하게(허벅지 사이로 들어감) */ const fr = Math.max(0, sn), bk = Math.max(0, -sn), f2 = fr * Math.sqrt(fr), b2 = bk * Math.sqrt(bk);
        if (f) z += f2 * BUST * (gau(x, .06 * B, .046 * B) + gau(x, -.06 * B, .046 * B)) * gau(y, .35, .045);        // 가슴: 몸통에서 자연스럽게 솟은 완만한 볼륨(공 모양 X)
        else z += f2 * PEC * (gau(x, .068 * B, .055 * B) + gau(x, -.068 * B, .055 * B)) * gau(y, .375, .048);         // 대흉근
        if (BELLY > .05) z += f2 * BELLY * .034 * B * gau(y, .085, .075) * gau(x, 0, .14 * B);                         // 아랫배
        z -= b2 * GLU * (gau(x, .065 * B, .065 * B) + gau(x, -.065 * B, .065 * B)) * gau(y, -.085, .05);                // 둔근
        z -= b2 * .006 * (gau(x, .075 * B, .04) + gau(x, -.075 * B, .04)) * gau(y, .4, .05);                            // 견갑골
        z += b2 * .006 * gau(x, 0, .014) * sstep(-.05, .1, y) * (1 - sstep(.44, .52, y));                               // 척추 고랑
        if (!f) z += f2 * .004 * gau(x, 0, .011) * gau(y, .575, .012);                                                 // 울대
        return [x, z]; };
      const tW = y => { const wn = sstep(.52, .585, y), wh = 1 - sstep(-.035, .09, y); return wNorm([[0, wh], [1, Math.max(0, 1 - wn - wh)], [2, wn]]); };
      const Y0 = .662, Y1 = -.118, tv = y => (Y0 - y) / (Y0 - Y1), C0 = tc;
      const K = (sec, k) => k === 1 ? sec : (y, th) => { const q = sec(y, th); return [q[0] * k, q[1] * k]; };
      const bands = (list, c, seg, sec, wf, vf) => {   // 위→아래 띠 목록 [y0, y1, slot, 두께배율] — 재질·두께가 바뀌는 곳엔 단(hem) 고리
        list.forEach((b, i) => { SB.strip(tubeRings(c, ys(b[0], b[1], SG.dy), seg, K(sec, b[3]), wf, vf), seg, CAN[b[2]] || b[2]);
          const nx = list[i + 1]; if (nx && nx[3] !== b[3]) { const up = nx[3] > b[3]; SB.strip(hemRing(c, b[1], seg, sec, Math.max(b[3], nx[3]), Math.min(b[3], nx[3]), wf, up), seg, CAN[up ? nx[2] : b[2]]); } }); };
      let TB;
      if (crop) TB = strap ? [[Y0, .4, 'skin', 1], [.4, .2, 'top', 1.035], [.2, WY, 'skin', 1], [WY, Y1, 'hip', 1]] : [[Y0, NL, 'skin', 1], [NL, .14, 'top', 1.035], [.14, WY, 'skin', 1], [WY, Y1, 'hip', 1]];
      else if (strap) TB = CAN.hip === CAN.top ? [[Y0, .4, 'skin', 1], [.4, Y1, 'top', 1.03]] : [[Y0, .4, 'skin', 1], [.4, WY, 'top', 1.03], [WY, Y1, 'hip', 1]];
      else TB = CAN.hip === CAN.upper ? [[Y0, NL, 'skin', 1], [NL, Y1, 'upper', 1.012]] : [[Y0, NL, 'skin', 1], [NL, WY, 'upper', 1.012], [WY, Y1, 'hip', 1]];
      if (CAN.hip === CAN.skin && TB[TB.length - 1][2] === 'hip') TB[TB.length - 1][3] = 1;
      bands(TB, C0, SG.ts, tSec, tW, tv);
      if (over) SB.strip(tubeRings(C0, ys(NL - .005, -.12, SG.dy), SG.ts, K(tSec, 1.06), tW, tv, Math.PI / 2 + .44, Math.PI * 2.5 - .44), SG.ts, CAN.top, { open: true });   // 오버셔츠: 앞이 열린 겉판
      /* 팔 (뼈: 이음뼈(어깨 절반) · 위팔 · 이음뼈(팔꿈치 절반) · 아래팔) */
      [[AL, 3], [AR, 7]].forEach(([A, bi]) => { const P2 = A.p, dx = .048 * B * (1 + .22 * MU), YA = .014, YE = -.552, mk = (v, a, b2) => v / (1 + a * MU) * (1 + b2 * MU), uaT = mk(P2.uaT, .5, .26), uaB = mk(P2.uaB, .35, .2), faT = mk(P2.faT, .35, .2), faB = mk(P2.faB, .2, .12);   // 근육질도 과장 없이(예전 위팔 둘레 18cm 반지름 → 실제 비율)
        const Rr = y => { let rL; if (y >= -.28) { const t = U.clamp(-y / .28, 0, 1); rL = (uaT + (uaB - uaT) * t) * PF.ua(t); } else { const t = U.clamp((-.28 - y) / .25, 0, 1); rL = (faT + (faB - faT) * t) * PF.fa(t); }
          const e = (y + .03) / .044, dR = e < 1 ? dx * Math.sqrt(Math.max(0, 1 - e * e)) : 0; let r = y > -.02 ? dR : smax(rL, dR, .012);
          if (y < -.537) r *= Math.sqrt(Math.max(0, 1 - ((y + .537) / .0155) ** 2)); return Math.max(r, .002); };
        const aSec = cloth => (y, th) => { const c = Math.cos(th), sn = Math.sin(th), r = Rr(y), fr = Math.max(0, sn), bk = Math.max(0, -sn), m = cloth ? .35 : 1;
          const kz = 1 - .08 * sstep(0, -.06, y) - .24 * sstep(-.42, -.535, y), kx = 1 - .12 * sstep(-.45, -.535, y), x = c * r * kx; let z = sn * r * kz;
          z += fr * m * (.003 + .007 * MU) * gau(y, -.15, .05) * (f ? .5 : 1);                 // 이두
          z -= bk * m * .004 * gau(y, -.14, .06);                                              // 삼두
          if (!cloth) z -= bk * bk * .007 * gau(y, -.283, .017) * gau(x, 0, .016);            // 주두(팔꿈치 뼈)
          return [x, z]; };
        const wf = y => { const a = sstep(-.07, .01, y) * .55, E = gau(y, -.28, .035), lo = sstep(-.265, -.295, y); return wNorm([[bi, a], [bi + 1, (1 - a) * (1 - E) * (1 - lo)], [bi + 2, E], [bi + 3, (1 - E) * lo]]); };
        const av = y => (YA - y) / (YA - YE), c = ac[A === AL ? 0 : 1], OV = look.oversize ? 1.16 : 1.05;   // 오버사이즈 소매: 넉넉한 스킨드 소매(예전 단단한 원통 대신)
        const AB = sleeveless ? [[YA, YE, 'skin', 1]] : teeLike ? [[YA, -.12, 'sleeve', 1.1], [-.12, YE, 'skin', 1]] : P2.faBare ? [[YA, -.3, 'sleeve', OV], [-.3, YE, 'skin', 1]] : [[YA, -.528, 'sleeve', OV], [-.528, YE, 'skin', 1]];
        AB.forEach((b, i) => { const sec = aSec(b[2] === 'sleeve'); SB.strip(tubeRings(c, ys(b[0], b[1], SG.dy * .8), SG.ls, K(sec, b[3]), wf, av), SG.ls, CAN[b[2]]);
          const nx = AB[i + 1]; if (nx) SB.strip(hemRing(c, b[1], SG.ls, aSec(false), b[3], nx[3], wf, false), SG.ls, CAN[b[2]]); }); });
      /* 다리 (뼈: 이음뼈(고관절 절반) · 허벅지 · 이음뼈(무릎 절반) · 정강이) */
      [[LL, 11], [LR, 15]].forEach(([L, bi]) => { const P2 = L.p, T1 = P2.TL1, T2 = P2.TL2, YT = .07, YB = -(T1 + T2) - .028, bareL = !P2.PANTS;
        const Rr = y => { let r; if (y >= -T1) { const t = U.clamp(-y / T1, 0, 1); r = P2.wide ? P2.thT + (P2.thB - P2.thT) * t : (P2.thT + (P2.thB - P2.thT) * t) * PF[P2.PANTS ? 'thC' : 'th'](t); }
          else { const t = U.clamp((-T1 - y) / T2, 0, 1); r = P2.wide ? P2.snT + (P2.snB - P2.snT) * t : (P2.snT + (P2.snB - P2.snT) * t) * PF[P2.PANTS ? 'shC' : 'sh'](t); }
          const e = (y + .01) / .08, cap = e < 1 ? P2.thT * Math.sqrt(Math.max(0, 1 - e * e)) : 0; r = y > -.005 ? cap : smax(r, cap, .015);
          if (y < -(T1 + T2) - .012) r *= Math.sqrt(Math.max(0, 1 - ((y + T1 + T2 + .012) / .016) ** 2)); return Math.max(r, .002); };
        const lSec = (y, th) => { const c = Math.cos(th), sn = Math.sin(th), r = Rr(y), fr = Math.max(0, sn), bk = Math.max(0, -sn), x = c * r; let z = sn * r * (.93 - .08 * sstep(-(T1 + T2) + .12, -(T1 + T2), y));
          if (bareL) { z += fr * fr * .011 * gau(y, -T1 + .012, .026) * gau(x, 0, .03);   // 슬개골
            z -= bk * .012 * gau(y, -T1 - .13, .07);                                      // 종아리(비복근)
            z -= fr * .006 * gau(y, -T1 - .2, .12); }                                     // 정강이 앞은 납작
          else if (!P2.wide) z -= bk * .005 * gau(y, -T1 - .13, .08);
          return [x, z]; };
        const wf = y => { const a = sstep(-.09, .03, y) * .5, E = gau(y, -T1, .045), lo = sstep(-T1 + .02, -T1 - .02, y); return wNorm([[bi, a], [bi + 1, (1 - a) * (1 - E) * (1 - lo)], [bi + 2, E], [bi + 3, (1 - E) * lo]]); };
        SB.strip(tubeRings(lc[L === LL ? 0 : 1], ys(YT, YB, SG.dy), SG.ls, lSec, wf, y => (YT - y) / (YT - YB)), SG.ls, CAN[L === LL ? 'legL' : 'legR']); });
      G41 = SB.build(); SKGEO.set(KEY, G41);
    }
    const BN = [hips, torso, neck, AL.p.dg, AL.sh, AL.p.eg, AL.el, AR.p.dg, AR.sh, AR.p.eg, AR.el, LL.p.hg, LL.lg, LL.p.kg, LL.kn, LR.p.hg, LR.lg, LR.p.kg, LR.kn];
    const bones = BN.map(g => { const b = new T.Bone(); b.name = 'b41'; g.add(b); return b; });
    skMats = new Map(); const skMat = m => { if (skMats.has(m)) return skMats.get(m); const c = m.clone(); c.skinning = true; c.onBeforeCompile = m.onBeforeCompile; if (Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) c.customProgramCacheKey = m.customProgramCacheKey; skMats.set(m, c); return c; };
    const mats = G41.slots.map(sl => skMat(slotM[sl])); if (over) skMat(mTop).side = T.DoubleSide;
    skinBody = new T.SkinnedMesh(G41.g, mats); skinBody.userData.noMerge = true; skinBody.userData.skinBody = true; body.add(skinBody);
    root.updateMatrixWorld(true); skinBody.bind(new T.Skeleton(bones), skinBody.matrixWorld);
  }
  // 소품: 술잔
  const glass = new T.Group(); glass.visible = false; AR.hand.add(glass); glass.position.set(0, -.02, .035);
  glass.add(mesh(G('glass', () => new T.CylinderGeometry(.032, .024, .11, 12, 1, true)), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .35, roughness: .05, metalness: .2, side: T.DoubleSide })));
  glass.add(mesh(G('liq', () => new T.CylinderGeometry(.028, .022, .06, 12)), NC.mat.std('#ffb340', { roughness: .2, emissive: '#5a2a00' }), 0, -.02, 0));
  if (TL) { mHair.map = TL.texture('hair', 'map', {}, [3, 1]); mHair.normalMap = TL.texture('hair', 'normal', {}, [3, 1]); mHair.normalScale.set(.7, .7); mHair.onBeforeCompile = rimInject('1.0,0.95,0.9', '0.6'); }
  mergeStatic(fig);
  fig.position.y += SOLE + (look.shoes === 'platform' ? .055 : 0);   // v24 신발 밑창이 몸 기준점보다 3~4cm 아래로 내려와 바닥·무대에 발목이 잠겨 보이던 문제 → 몸 전체를 살짝 올림
  if (NC.contactShadow) root.add(NC.contactShadow(.85, .65));
  if (NC.shadow) NC.shadow(fig, true, false);
  // 이름표
  const label = makeLabel(o.name || '', o.labelColor || look.topColor); if (NC.LABEL_LAYER) label.layers.set(NC.LABEL_LAYER); label.position.y = look.height + (TOON ? .36 : .32); root.add(label);

  const u = root.userData = { gender: look.gender, look, mats: { top: mTop, sleeve: mSleeve, skin: mSkin, kind: look.top, inner: look.innerColor },
    name: o.name, look, label, fig, figScale, hipH, skirt, glass, face: { cv: fcv, tex: ftex },
    rig: { body, hips, torso, neck, head, shL: AL.sh, elL: AL.el, shR: AR.sh, elR: AR.el, legL: LL.lg, knL: LL.kn, legR: LR.lg, knR: LR.kn },
    bridges: BR, skinBody, skMats, hands: { L: AL.hand, R: AR.hand }, handPose: { L: 'relaxed', R: 'relaxed' }, sk: { rx: 0, rz: 0, vx: 0, vz: 0, px: null, pz: null, ry: null },
    seed: (U.hash(o.name || 'x') % 1000) / 1000, seated: false, moving: false, dance: null, talk: false, walkPh: 0,
    expr: o.expr || 'neutral', baseExpr: o.expr || 'neutral', exprUntil: 0, blink: false, blinkT: 1 + Math.random() * 3, blinkEnd: 0, talkUntil: 0, mouthT: 0, mouthOpen: false,
    motion: { t: 0, g: null, gT: 0, gDur: 0 }, faceDirty: true, seatH: .5,
  };
  u.gaze = [0, 0]; u.gazeT = 1;
  u.redraw = FC ? (() => { u.faceDirty = false; }) : () => { drawFace(fcv, look, u.expr, { blink: u.blink, talk: u.mouthOpen, gaze: u.gaze }); ftex.needsUpdate = true; u.faceDirty = false;
    const em = (EXPR[u.expr] || EXPR.neutral).eyes; corneaMesh.visible = !u.blink && em !== 'happy' && em !== 'wink'; void corneas; };
  u.setExpr = (name, dur = 0) => { if (!EXPR[name]) name = 'neutral'; u.expr = name; u.exprUntil = dur ? performance.now() + dur * 1000 : 0; if (!dur) u.baseExpr = name; u.faceDirty = true; };
  u.say = sec => { u.talkUntil = performance.now() + sec * 1000; };
  u.setName = n => { root.remove(u.label); u.label = makeLabel(n, look.topColor); if (NC.LABEL_LAYER) u.label.layers.set(NC.LABEL_LAYER); u.label.position.y = look.height + (TOON ? .36 : .32); root.add(u.label); if (look.photo && NC.Profile) NC.Profile.decorate(root); };
  u.redraw(); u.face42 = FC; if (FC) NC.Face.attach(FC, root);
  if (look.photo && NC.Profile) NC.Profile.decorate(root);   // v33 이름표에 프로필 사진
  return root;
}

const SOLE = .045;
/* 이름표 크기: 가까우면 작게(얼굴 가림 방지), 대화 상대는 숨김 */
function fitLabel(g, cam) { const l = g.userData.label; if (!l) return; const d = cam.position.distanceTo(g.position), k = U.clamp(d / 10, .32, 1); l.scale.set(1.9 * k, .48 * k, 1); l.visible = !g.userData.hideLabel; }
NC.Avatar = { create, undress, randomLook, mergeLook, drawFace, fitLabel, EXPR, FACE_SIZE: [FW, FH], skinCompile, SKIN_BODY, realSkin,
  /* 시작 화면 미리보기용: 얼굴 정면만 잘라서 작은 캔버스에 그림 */
  preview(cv, look, expr = 'smile') { const big = document.createElement('canvas'); big.width = FW; big.height = FH; drawFace(big, look, expr); const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.save(); g.beginPath(); g.ellipse(cv.width / 2, cv.height / 2, cv.width * .42, cv.height * .48, 0, 0, 7); g.clip(); g.drawImage(big, FW * .25 - 200, FH * .5 - 230, 400, 460, 0, 0, cv.width, cv.height); g.restore(); },
};
})();
