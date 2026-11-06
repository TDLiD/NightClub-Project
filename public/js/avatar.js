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
const HAIR_F = ['long', 'bob', 'ponytail', 'bun', 'wavy', 'long', 'bob'];
const HAIR_M = ['short', 'twoblock', 'slick', 'curly', 'buzz', 'side', 'twoblock'];
const TOPS_F = ['dress', 'tee', 'shirt', 'jacket', 'dress'];
const TOPS_M = ['shirt', 'jacket', 'tee', 'shirt', 'jacket'];
const hsl = (h, s, l) => '#' + new T.Color().setHSL(h, s, l).getHexString();

function randomLook(seed, gender) {
  const r = U.rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const g = gender || (r() < .5 ? 'f' : 'm'), f = g === 'f';
  const top = pick(f ? TOPS_F : TOPS_M);
  return {
    gender: g, height: f ? 1.6 + r() * .12 : 1.72 + r() * .12, build: .92 + r() * .2,
    skin: pick(SKINS), hairStyle: pick(f ? HAIR_F : HAIR_M), hairColor: pick(HAIRC),
    top, topColor: hsl(r(), .55 + r() * .35, .42 + r() * .2),
    bottom: top === 'dress' ? 'skirt' : (f && r() < .45 ? 'skirt' : 'pants'), bottomColor: hsl(r(), .2 + r() * .3, .12 + r() * .14),
    face: {
      eyeColor: pick(EYEC), eyeSize: .85 + r() * .35, eyeTilt: (r() - .5) * .28, eyeGap: (r() - .5) * .05, lid: r() < .6 ? 1 : 0,
      browThick: f ? .55 + r() * .45 : .95 + r() * .6, browTilt: (r() - .5) * .3, browArch: r(),
      lipColor: pick(f ? LIPS_F : LIPS_M), lipW: .85 + r() * .3, lipFull: .8 + r() * .5, nose: .82 + r() * .4,
      faceW: .9 + r() * .14, jaw: .92 + r() * .18, blush: f ? .2 + r() * .4 : r() * .12, liner: f ? .3 + r() * .7 : 0,
      shadow: f && r() < .8 ? pick(SHADOWS) : null, freckles: r() < .15, mole: r() < .25 ? [(r() - .5) * .9, .15 + r() * .5] : null,
      beard: !f && r() < .35 ? (r() < .6 ? 'stubble' : 'goatee') : null, glasses: r() < .16, earring: f && r() < .5,
    },
  };
}
function mergeLook(seed, gender, look) {
  const base = randomLook(seed, (look && look.gender) || gender);
  const o = Object.assign({}, base, look || {});
  const plain = { freckles: false, mole: null, beard: null, glasses: false, earring: false, shadow: null };   // 지정 얼굴은 랜덤 소품을 섞지 않음
  o.face = Object.assign({}, base.face, look && look.face ? plain : {}, (look && look.face) || {}); return o;
}

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
};
const rgba = (hex, a) => { const c = new T.Color(hex); return `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`; };
const shade = (hex, l) => { const c = new T.Color(hex); const h = {}; c.getHSL(h); return '#' + c.setHSL(h.h, h.s, U.clamp(h.l + l, 0, 1)).getHexString(); };

function drawFace(cv, look, exName, st = {}) {
  const g = cv.getContext('2d'), F = look.face, fem = look.gender === 'f', e = EXPR[exName] || EXPR.neutral;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = look.skin; g.fillRect(0, 0, FW, FH);
  g.setTransform(K, 0, 0, K, FW * .25, FH * .5);          // 이후 단위: 라디안 (정면 중앙 = 0,0 / +y = 아래)
  let gr;
  // 윤곽 음영
  gr = g.createRadialGradient(0, .15, .35, 0, .2, 1.35); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(70,25,15,.22)'); g.fillStyle = gr; g.fillRect(-1.6, -1.6, 3.2, 3.2);
  // 볼터치
  const bl = U.clamp((F.blush || 0) + (e.blush || 0), 0, 1);
  if (bl > .02) for (const s of [-1, 1]) { gr = g.createRadialGradient(s * .44, .32, 0, s * .44, .32, .22); gr.addColorStop(0, `rgba(255,100,125,${.55 * bl})`); gr.addColorStop(1, 'rgba(255,100,125,0)'); g.fillStyle = gr; g.beginPath(); g.arc(s * .44, .32, .22, 0, 7); g.fill(); }
  // 주근깨 · 점
  if (F.freckles) { const r = U.rng(U.hash(look.skin + look.hairColor)); g.fillStyle = 'rgba(140,80,50,.35)'; for (let i = 0; i < 26; i++) { const s = r() < .5 ? -1 : 1; g.beginPath(); g.arc(s * (.15 + r() * .3), .16 + r() * .2, .008 + r() * .006, 0, 7); g.fill(); } }
  if (F.mole) { g.fillStyle = 'rgba(60,30,20,.75)'; g.beginPath(); g.arc(F.mole[0], F.mole[1], .012, 0, 7); g.fill(); }
  // 수염
  if (F.beard) {
    g.fillStyle = rgba(look.hairColor, F.beard === 'stubble' ? .2 : .55); g.beginPath();
    if (F.beard === 'stubble') { g.moveTo(-.55, .32); g.quadraticCurveTo(-.58, 1.05, 0, 1.15); g.quadraticCurveTo(.58, 1.05, .55, .32); g.quadraticCurveTo(.3, .44, 0, .4); g.quadraticCurveTo(-.3, .44, -.55, .32); }
    else { g.ellipse(0, .74, .17, .17, 0, 0, 7); g.moveTo(-.2, .43); g.quadraticCurveTo(0, .37, .2, .43); g.quadraticCurveTo(0, .46, -.2, .43); }
    g.fill();
  }
  // 눈
  const ex = .31 + (F.eyeGap || 0), es = (F.eyeSize || 1) * 1.3, EY = .05;
  for (const s of [-1, 1]) {
    let mode = e.eyes; if (mode === 'wink') mode = s > 0 ? 'happy' : 'open'; if (st.blink && mode !== 'happy') mode = 'closed';
    g.save(); g.translate(s * ex, EY); g.rotate(-s * (F.eyeTilt || 0)); if (s < 0) g.scale(-1, 1);   // 항상 +x = 바깥 눈꼬리
    const w = .11 * es, open = { open: 1, wide: 1.3, half: .55, down: .62 }[mode] || 0, h = .05 * es * Math.max(open, .01);
    if (F.shadow) { gr = g.createRadialGradient(.01, -.05, 0, .01, -.05, .17); gr.addColorStop(0, rgba(F.shadow, .5)); gr.addColorStop(1, rgba(F.shadow, 0)); g.fillStyle = gr; g.beginPath(); g.arc(.01, -.05, .17, 0, 7); g.fill(); }
    g.strokeStyle = '#1b1210'; g.lineCap = 'round'; g.lineJoin = 'round';
    if (open > 0) {
      const upper = () => { g.moveTo(-w, .006); g.bezierCurveTo(-w * .5, -h * 1.3, w * .45, -h * 1.35, w, -.008 - (fem ? .006 : 0)); };
      g.beginPath(); upper(); g.bezierCurveTo(w * .5, h * .95, -w * .45, h * .95, -w, .006); g.closePath(); g.fillStyle = '#fbf6f1'; g.fill();
      g.save(); g.clip();
      const iy = mode === 'down' ? h * .45 : -h * .1, ir = .052 * es;
      gr = g.createRadialGradient(-.006, iy, ir * .2, -.006, iy, ir); gr.addColorStop(0, shade(F.eyeColor, .14)); gr.addColorStop(.75, F.eyeColor); gr.addColorStop(1, '#120a06');
      g.fillStyle = gr; g.beginPath(); g.arc(-.006, iy, ir, 0, 7); g.fill();
      g.fillStyle = '#0a0605'; g.beginPath(); g.arc(-.006, iy, ir * .45, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(-.022, iy - .018, ir * .22, 0, 7); g.fill();
      g.fillStyle = 'rgba(80,40,30,.2)'; g.fillRect(-w, -h * 1.5, w * 2, h * .75);
      g.restore();
      g.beginPath(); upper(); g.lineWidth = .013 + (F.liner || 0) * .012; g.stroke();
      if ((F.liner || 0) > .3) { g.beginPath(); g.moveTo(w * .9, -.012); g.lineTo(w + .035 * F.liner, -.03 * F.liner - .006); g.lineWidth = .01; g.stroke(); }
      if (fem) { g.lineWidth = .006; [[.5, -h * 1.2], [.7, -h * 1.05], [.88, -h * .7]].forEach(([k, y]) => { g.beginPath(); g.moveTo(w * k, y); g.lineTo(w * k + .016, y - .022); g.stroke(); }); }
      g.beginPath(); g.moveTo(-w * .8, .014); g.bezierCurveTo(-w * .3, h * 1.0, w * .4, h * .95, w * .95, -.002); g.lineWidth = .005; g.strokeStyle = 'rgba(60,30,25,.35)'; g.stroke();
      if (F.lid) { g.beginPath(); g.moveTo(-w * .55, -h * 1.25); g.bezierCurveTo(-w * .2, -h * 2.0, w * .4, -h * 2.0, w * .95, -h * .9); g.lineWidth = .006; g.strokeStyle = 'rgba(90,45,35,.45)'; g.stroke(); }
    } else if (mode === 'happy') {
      g.beginPath(); g.moveTo(-w, .02); g.quadraticCurveTo(0, -.075 * es, w, .012); g.lineWidth = .018; g.stroke();
    } else {
      g.beginPath(); g.moveTo(-w, -.002); g.quadraticCurveTo(0, .04 * es, w, -.006); g.lineWidth = .015; g.stroke();
    }
    g.restore();
  }
  // 눈썹
  const bt = F.browThick || 1, by = -.16 - (e.brow || 0) * .045;
  g.strokeStyle = shade(look.hairColor, -.05); g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.save(); g.translate(s * ex, 0); if (s < 0) g.scale(-1, 1);
    const iy = by + (e.browIn || 0) * .035 + .008, oy = by - (F.browTilt || 0) * .12 + .02;
    g.beginPath(); g.moveTo(-.14, iy); g.quadraticCurveTo(.0, by - .035 - (F.browArch || .5) * .03, .16, oy); g.lineWidth = .028 * bt; g.stroke();
    g.beginPath(); g.moveTo(-.14, iy); g.quadraticCurveTo(-.06, iy - .01, .0, by - .02); g.lineWidth = .036 * bt; g.stroke();
    g.restore();
  }
  // 코 (입체는 메시, 텍스처는 콧망울 음영)
  const nz = F.nose || 1;
  gr = g.createRadialGradient(0, .36, 0, 0, .36, .1 * nz); gr.addColorStop(0, 'rgba(110,50,35,.2)'); gr.addColorStop(1, 'rgba(110,50,35,0)'); g.fillStyle = gr; g.fillRect(-.2, .2, .4, .3);
  g.fillStyle = 'rgba(100,45,35,.42)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * .04 * nz, .335, .02, .011, s * .3, 0, 7); g.fill(); }
  // 입
  const M = MOUTHS[e.mouth] || MOUTHS.neutral, my = .53, mw = .21 * (F.lipW || 1) * M.ws, lf = (F.lipFull || 1) * (fem ? 1.15 : .8);
  const lip = fem ? F.lipColor : F.lipColor || '#c08a80';
  const L = [-mw, my - M.cuL], R = [mw, my - M.cuR], midTop = my + M.line;
  const opn = M.open * .07 + (st.talk ? .035 : 0);
  if (opn > 0) {
    g.beginPath(); g.moveTo(...L); g.quadraticCurveTo(0, midTop - .006, ...R); g.quadraticCurveTo(0, midTop + opn * 2, ...L); g.fillStyle = '#4a1820'; g.fill();
    g.save(); g.clip(); g.fillStyle = '#f7f3ee'; g.fillRect(-mw, midTop - .02, mw * 2, .04); g.restore();
  }
  g.fillStyle = lip; g.beginPath(); g.moveTo(...L);
  g.bezierCurveTo(-mw * .6, my - .035 * lf - M.cuL * .5, -mw * .2, my - .045 * lf, 0, my - .028 * lf);
  g.bezierCurveTo(mw * .2, my - .045 * lf, mw * .6, my - .035 * lf - M.cuR * .5, ...R);
  g.quadraticCurveTo(0, midTop + .006, ...L); g.fill();
  const lt = midTop + opn * 1.8;
  g.fillStyle = shade(lip, .04); g.beginPath(); g.moveTo(...L); g.quadraticCurveTo(0, lt, ...R); g.quadraticCurveTo(0, lt + .07 * lf + Math.max(0, (M.cuL + M.cuR) / 2) * .4, ...L); g.fill();
  g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(-mw * .15, lt + .028 * lf, mw * .22, .01, 0, 0, 7); g.fill();
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
function mesh(g, m, x = 0, y = 0, z = 0, sx, sy, sz) { const o = new T.Mesh(g, m); o.position.set(x, y, z); if (sx != null) o.scale.set(sx, sy, sz); return o; }

function makeLabel(text, color) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = 'rgba(25,12,52,.78)'; g.strokeStyle = color || '#ff3d9a'; g.lineWidth = 3;
  g.beginPath(); g.roundRect ? g.roundRect(4, 8, 312, 60, 24) : g.rect(4, 8, 312, 60); g.fill(); g.stroke();
  g.font = '700 32px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(text, 160, 40);
  const s = new T.Sprite(new T.SpriteMaterial({ map: NC.tex(c), transparent: true, depthWrite: false })); s.scale.set(1.9, .48, 1); s.renderOrder = 10; return s;
}

function buildHair(skull, look, mHair, r) {
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
    case 'slick': cap(r * 1.09, .5, .55); blob(0, .72, .42, .62, .32, .6); break;
    case 'side': cap(r * 1.08, .5, .45); { const b = bangs(front - .2, 1.3, Math.PI / 2 - .62, .28); b.rotation.z = -.12; } break;
    case 'twoblock': cap(r * 1.04, .5, .5); blob(0, .62, .05, 1.0, .52, 1.0); bangs(front - .75, 1.5, Math.PI / 2 - .6, .24); break;
    default: cap(r * 1.07, .5, .45);
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

/* ───────── 아바타 생성 ───────── */
function create(o = {}) {
  const look = mergeLook(o.seed != null ? o.seed : U.hash(o.name || String(Math.random())), o.gender, o.look);
  const f = look.gender === 'f', B = look.build || 1;
  const root = new T.Group(), fig = new T.Group(); root.add(fig);
  const figScale = look.height / 1.75; fig.scale.setScalar(figScale);
  const body = new T.Group(); fig.add(body);
  const hipH = .965, hips = new T.Group(); hips.position.y = hipH; body.add(hips);
  const torso = new T.Group(); hips.add(torso);
  const shiny = look.top === 'dress' ? { roughness: .32, metalness: .28 } : look.top === 'jacket' ? { roughness: .45, metalness: .1 } : { roughness: .6 };
  const mSkin = std(look.skin, { roughness: .58 }), mTop = std(look.topColor, shiny), mBot = std(look.bottomColor, { roughness: .75 }),
    mShoe = std('#141018', { roughness: .35, metalness: .25 }), mHair = std(look.hairColor, { roughness: .48, metalness: .06, side: T.DoubleSide }),
    mSleeve = look.top === 'vest' ? std('#f4f2ee') : mTop;
  // 몸통
  const prof = (f ? F_PROF : M_PROF).map(([rr, y]) => new T.Vector2(rr * B, y));
  const tor = mesh(G('tor' + look.gender + B.toFixed(2), () => new T.LatheGeometry(prof, 22)), mTop); tor.scale.z = .68; torso.add(tor);
  if (look.top === 'jacket' || look.top === 'vest') {   // V넥 안쪽 셔츠
    const vg = G('vneck', () => { const sh = new T.Shape(); sh.moveTo(-.07, .17); sh.lineTo(.07, .17); sh.lineTo(0, -.06); sh.closePath(); return new T.ShapeGeometry(sh); });
    const inner = mesh(vg, std(look.top === 'vest' ? '#f4f2ee' : (f ? '#f2e6ee' : '#f4f2ee')), 0, .36, .112); inner.rotation.x = -.22; torso.add(inner); }
  if (look.top === 'vest') { const bt = std('#0d0b10'); for (const s of [-1, 1]) { const w = mesh(G('cone', () => new T.ConeGeometry(1, 1, 4)), bt, s * .028, .5, .12, .022, .04, .012); w.rotation.z = s * Math.PI / 2; w.position.y = .505; w.position.z = .118; torso.add(w); } }
  if (look.top === 'shirt') { const col = mesh(G('collar', () => new T.TorusGeometry(.06, .014, 6, 14)), mTop, 0, .54, .01, 1, .75, 1); col.rotation.x = Math.PI / 2; torso.add(col); }
  const hip = mesh(cyl(.172 * B, .158 * B, .18, 18), look.bottom === 'pants' ? mBot : mTop, 0, -.05, 0); hip.scale.z = .7; hips.add(hip);
  if (look.bottom === 'pants') { const belt = mesh(G('belt', () => new T.TorusGeometry(1, .08, 5, 22)), std('#18141c', { metalness: .4, roughness: .35 }), 0, .03, 0, .163 * B, .163 * B, .163 * B); belt.rotation.x = Math.PI / 2; belt.scale.y = .7 * .163 * B; hips.add(belt); }
  let skirt = null;
  if (look.bottom === 'skirt') { const len = look.top === 'dress' ? .44 : .34; skirt = mesh(G('sk' + len + B.toFixed(2), () => new T.LatheGeometry([[.172 * B, .05], [.2 * B, -.1], [.25 * B, -len + .04], [.262 * B, -len]].map(([a, b]) => new T.Vector2(a, b)), 22)), look.top === 'dress' ? mTop : std(look.bottomColor, { roughness: .5, side: T.DoubleSide })); skirt.material.side = T.DoubleSide; skirt.scale.z = .8; skirt.userData.noMerge = true; hips.add(skirt); }
  // 목 · 머리
  const neck = new T.Group(); neck.position.y = .55; torso.add(neck);
  neck.add(mesh(cyl(.046, .054, .12), mSkin, 0, .04, .005));
  const head = new T.Group(); head.position.y = .075; neck.add(head);
  const F = look.face, r = .115, sx = .86 * (F.faceW || 1), sy = 1.03 * (F.jaw || 1), sz = .98;
  const skull = new T.Group(); skull.position.set(0, .095, .012); skull.scale.set(sx, sy, sz); head.add(skull);
  const fcv = document.createElement('canvas'); fcv.width = FW; fcv.height = FH;
  const ftex = NC.tex(fcv);
  const headMesh = new T.Mesh(G('head', () => new T.SphereGeometry(r, 40, 28)), new T.MeshStandardMaterial({ map: ftex, roughness: .55 })); headMesh.userData.noMerge = true; skull.add(headMesh);
  const onHead = (a, b, k = 1) => new T.Vector3(r * k * Math.sin(a) * Math.cos(b), -r * k * Math.sin(b), r * k * Math.cos(a) * Math.cos(b));
  const nose = mesh(sph(), mSkin); nose.position.copy(onHead(0, .24, .975)); nose.scale.set(.0125 * F.nose / sx, .022 * F.nose / sy, .02 * F.nose); nose.rotation.x = -.35; skull.add(nose);
  for (const s of [-1, 1]) { const ear = mesh(sph(), mSkin); ear.position.copy(onHead(s * 1.48, .06)); ear.scale.set(.012 / sx, .03 / sy, .022); skull.add(ear);
    if (F.earring) { const er = mesh(sph(), std('#f2d27a', { metalness: .9, roughness: .2 })); er.position.copy(onHead(s * 1.48, .3, 1.02)); er.scale.set(.008 / sx, .008 / sy, .008); skull.add(er); } }
  buildHair(skull, look, mHair, r);
  if (F.glasses) {
    const gm = std('#141418', { metalness: .6, roughness: .3 }), gl = new T.Group(); head.add(gl); gl.position.set(0, .095, .012);
    const ex = .31 + (F.eyeGap || 0);
    for (const s of [-1, 1]) { const p = onHead(s * ex, .05, 1); const ring = mesh(G('lens', () => new T.TorusGeometry(.024, .0028, 6, 22)), gm, p.x * sx, p.y * sy, p.z * sz + .012); ring.scale.set(1.15, .85, 1); gl.add(ring);
      const arm = mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), gm, s * .052, .004, -.03, .003, .004, .1); gl.add(arm); }
    gl.add(mesh(G('box', () => new T.BoxGeometry(1, 1, 1)), gm, 0, .006, r * sz + .01, .022, .003, .003));
  }
  // 팔
  const bare = look.top === 'tee' || look.top === 'dress';
  const arm = s => {
    const sh = new T.Group(); sh.position.set(s * (f ? .172 : .198) * B, .45, 0); torso.add(sh);
    sh.add(mesh(sph(), look.top === 'dress' ? mSkin : mSleeve, 0, -.01, 0, .052 * B, .052, .052));
    sh.add(mesh(cyl(.05 * B, .042, .28), bare ? mSkin : mSleeve, 0, -.14, 0));
    if (look.top === 'tee') sh.add(mesh(cyl(.06 * B, .054, .13), mTop, 0, -.055, 0));
    const el = new T.Group(); el.position.y = -.28; sh.add(el);
    el.add(mesh(cyl(.042, .033, .25), bare ? mSkin : mSleeve, 0, -.125, 0));
    el.add(mesh(sph(), mSkin, 0, -.29, .005, .034, .062, .022));
    const hand = new T.Group(); hand.position.y = -.31; el.add(hand);
    return { sh, el, hand };
  };
  const AL = arm(-1), AR = arm(1);
  // 다리
  const leg = s => {
    const lg = new T.Group(); lg.position.set(s * .09 * B, -.04, 0); hips.add(lg);
    const legMat = look.bottom === 'pants' ? mBot : mSkin;
    lg.add(mesh(cyl(.078 * B, .06, .44), legMat, 0, -.22, 0));
    const kn = new T.Group(); kn.position.y = -.44; lg.add(kn);
    kn.add(mesh(cyl(.058, .044, .43), legMat, 0, -.215, 0));
    kn.add(mesh(G('foot' + look.gender, () => new T.BoxGeometry(f ? .075 : .095, .07, f ? .21 : .25)), mShoe, 0, -.45, .045));
    return { lg, kn };
  };
  const LL = leg(-1), LR = leg(1);
  // 소품: 술잔
  const glass = new T.Group(); glass.visible = false; AR.hand.add(glass); glass.position.set(0, -.02, .035);
  glass.add(mesh(G('glass', () => new T.CylinderGeometry(.032, .024, .11, 12, 1, true)), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .35, roughness: .05, metalness: .2, side: T.DoubleSide })));
  glass.add(mesh(G('liq', () => new T.CylinderGeometry(.028, .022, .06, 12)), NC.mat.std('#ffb340', { roughness: .2, emissive: '#5a2a00' }), 0, -.02, 0));
  mergeStatic(fig);
  // 이름표
  const label = makeLabel(o.name || '', o.labelColor || look.topColor); label.position.y = look.height + .32; root.add(label);

  const u = root.userData = {
    name: o.name, look, label, fig, figScale, hipH, skirt, glass, face: { cv: fcv, tex: ftex },
    rig: { body, hips, torso, neck, head, shL: AL.sh, elL: AL.el, shR: AR.sh, elR: AR.el, legL: LL.lg, knL: LL.kn, legR: LR.lg, knR: LR.kn },
    seed: (U.hash(o.name || 'x') % 1000) / 1000, seated: false, moving: false, dance: null, talk: false, walkPh: 0,
    expr: o.expr || 'neutral', baseExpr: o.expr || 'neutral', exprUntil: 0, blink: false, blinkT: 1 + Math.random() * 3, blinkEnd: 0, talkUntil: 0, mouthT: 0, mouthOpen: false,
    motion: { t: 0, g: null, gT: 0, gDur: 0 }, faceDirty: true, seatH: .5,
  };
  u.redraw = () => { drawFace(fcv, look, u.expr, { blink: u.blink, talk: u.mouthOpen }); ftex.needsUpdate = true; u.faceDirty = false; };
  u.setExpr = (name, dur = 0) => { if (!EXPR[name]) name = 'neutral'; u.expr = name; u.exprUntil = dur ? performance.now() + dur * 1000 : 0; if (!dur) u.baseExpr = name; u.faceDirty = true; };
  u.say = sec => { u.talkUntil = performance.now() + sec * 1000; };
  u.setName = n => { root.remove(u.label); u.label = makeLabel(n, look.topColor); u.label.position.y = look.height + .32; root.add(u.label); };
  u.redraw();
  return root;
}

/* 이름표 크기: 가까우면 작게(얼굴 가림 방지), 대화 상대는 숨김 */
function fitLabel(g, cam) { const l = g.userData.label; if (!l) return; const d = cam.position.distanceTo(g.position), k = U.clamp(d / 10, .32, 1); l.scale.set(1.9 * k, .48 * k, 1); l.visible = !g.userData.hideLabel; }
NC.Avatar = { create, randomLook, mergeLook, drawFace, fitLabel, EXPR, FACE_SIZE: [FW, FH],
  /* 시작 화면 미리보기용: 얼굴 정면만 잘라서 작은 캔버스에 그림 */
  preview(cv, look, expr = 'smile') { const big = document.createElement('canvas'); big.width = FW; big.height = FH; drawFace(big, look, expr); const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.save(); g.beginPath(); g.ellipse(cv.width / 2, cv.height / 2, cv.width * .42, cv.height * .48, 0, 0, 7); g.clip(); g.drawImage(big, FW * .25 - 200, FH * .5 - 230, 400, 460, 0, 0, cv.width, cv.height); g.restore(); },
};
})();
