/* wardrobe.js — v71 실사 모델 위에 '입히는' 의상·헤어·문신·체형 (얼굴은 그 모델 그대로 = 랜덤 얼굴)
 *  왜: 실사(Rocketbox/VALID) 모델은 옷·머리가 텍스처/메시에 구워져 있어서 npcs.json 의 look(옷 색·헤어)이 화면에 안 나옴
 *  방법(새 애니메이션·새 뼈대 없음 — 몸과 같은 뼈에 같은 가중치로 묶여 저절로 따라 움직임):
 *   · 껍질(shell): 몸 메시에서 부위(뼈 가중치·높이)로 삼각형을 골라 법선 방향으로 몇 mm 띄운 사본 = 청바지·후드·카디건·문신
 *   · 띠(ring): 몸 단면을 각도별로 재서 그 바깥에 두른 띠 = 벨트·손목 밴드·목걸이 (한 뼈에 고정)
 *   · 헤어: 머리 메시를 각도·높이별로 재서 그 바깥에 씌운 층진 단발(얼굴 쪽은 열림) — 머리뼈에 고정
 *   · 메시 이름 OUT_<세트>_… → humanglb 의 RH.setOutfit 으로 한 벌씩 갈아입음, 그 외(헤어·문신·청바지)는 항상 보임
 *  데이터: npcs.json 의 NPC 항목 "wardrobe": "jo_rock" (아래 SPECS) — 얼굴(모델)은 manifest assign 으로 고름 */
(() => {
const NC = window.NC, RH = NC && NC.RealHuman; if (!RH || !RH.attach || !NC.THREE) { console.warn('[wardrobe] RealHuman 없음'); return; }
const T = NC.THREE, V = () => new T.Vector3();
/* r128 은 정규화(양자화) 속성을 getX 로 읽을 때 정수 그대로 줌 → 직접 풀어서 Float32 로 */
const DEN = { Int8Array: 127, Uint8Array: 255, Int16Array: 32767, Uint16Array: 65535 };
const dec = a => { if (!a) return null; if (a._dec) return a._dec; const n = a.count, k = a.itemSize, out = new Float32Array(n * k), d = a.normalized ? (DEN[a.array.constructor.name] || 1) : 1, ia = a.isInterleavedBufferAttribute;
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) { const v = ia ? a.data.array[i * a.data.stride + a.offset + j] : a.array[i * k + j]; out[i * k + j] = d > 1 ? Math.max(v / d, -1) : v; } return a._dec = out; };

/* ---------- 텍스처(캔버스, 로고·상표 없음) ---------- */
const TEX = {};
function canvasTex(key, w, h, draw, rep) { if (TEX[key]) return TEX[key]; const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; else if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; /* r128 은 encoding */ t.wrapS = t.wrapT = rep ? T.RepeatWrapping : T.ClampToEdgeWrapping; t.anisotropy = 4; return TEX[key] = t; }
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(12345);
const denim = () => canvasTex('denim', 256, 256, (g, w, h) => { g.fillStyle = '#304a73'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5200; i++) { const x = rnd() * w, y = rnd() * h, l = 6 + rnd() * 10; g.strokeStyle = `rgba(${rnd() < .5 ? '220,230,245' : '20,34,62'},${.05 + rnd() * .07})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * .35, y + l); g.stroke(); } for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(255,255,255,${.02 + rnd() * .03})`; g.fillRect(0, y, w, 1); } }, true);
const knit = (key, base, line) => canvasTex(key, 128, 128, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 6) for (let y = 0; y < h; y += 4) { g.fillStyle = line; g.beginPath(); g.ellipse(x + 3, y + 2, 2.2, 1.6, (x / 6) % 2 ? .5 : -.5, 0, Math.PI * 2); g.globalAlpha = .38; g.fill(); g.globalAlpha = 1; } }, true);
const fleece = () => canvasTex('fleece', 128, 128, (g, w, h) => { g.fillStyle = '#1d2a4a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${.03 + rnd() * .05})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); } }, true);
const studs = () => canvasTex('studs', 512, 32, (g, w, h) => { g.fillStyle = '#16120f'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 3, w, 1); g.fillRect(0, h - 4, w, 1); for (let x = 8; x < w; x += 16) for (const y of [10, 22]) { const gr = g.createRadialGradient(x - 1, y - 1, .5, x, y, 4.5); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.4, '#b8bcc4'); gr.addColorStop(1, '#3a3c42'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); } }, true);
const beads = () => canvasTex('beads', 256, 32, (g, w, h) => { g.fillStyle = '#121212'; g.fillRect(0, 0, w, h); for (let x = 6; x < w; x += 12) { const gr = g.createRadialGradient(x - 2, 13, 1, x, 16, 7); gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(.5, '#2a2a2a'); gr.addColorStop(1, '#050505'); g.fillStyle = gr; g.beginPath(); g.arc(x, 16, 6, 0, Math.PI * 2); g.fill(); } }, true);
const hairTex = () => canvasTex('hairAuburn', 256, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a2412'); gr.addColorStop(.35, '#8a3a1a'); gr.addColorStop(1, '#a8522a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { const x = rnd() * w, y0 = rnd() * h * .3, l = h * (.4 + rnd() * .7), c = rnd(); g.strokeStyle = c < .5 ? `rgba(40,12,4,${.12 + rnd() * .18})` : `rgba(230,140,80,${.08 + rnd() * .16})`; g.lineWidth = .6 + rnd() * 1.2; g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x + (rnd() - .5) * 8, y0 + l * .4, x + (rnd() - .5) * 10, y0 + l * .7, x + (rnd() - .5) * 14, y0 + l); g.stroke(); } }, true);
/* 용 문신: 팔을 S자로 감고 내려오는 비늘 몸통(윤곽선 + 비늘 + 배 줄무늬) + 머리(어깨) + 발톱 + 구름 — 먹색 잉크, 바탕 투명 (u=팔 둘레, v=어깨→손목) */
const dragonTex = side => canvasTex('dragon' + side, 512, 1024, (g, w, h) => { g.clearRect(0, 0, w, h); const INK = '28,38,36', ink = a => `rgba(${INK},${a})`, ph = side === 'L' ? 0 : 1.6;
  const P = t => [w * (.5 + .3 * Math.sin(t * Math.PI * 2.6 + ph)), h * (.06 + t * .9)];
  const N = 160, C = [], Wd = t => 40 * Math.sin(Math.PI * Math.min(1, .15 + t * .95)) + 8;
  for (let k = 0; k <= N; k++) { const t = k / N, [x, y] = P(t), [x2, y2] = P(Math.min(1, t + .005)), nx = -(y2 - y), ny = x2 - x, nl = Math.hypot(nx, ny) || 1; C.push({ x, y, nx: nx / nl, ny: ny / nl, wd: Wd(t), t }); }
  // 구름 소용돌이(몸통 뒤, 옅게)
  g.lineWidth = 2.2; for (let i = 0; i < 26; i++) { const cx = 40 + rnd() * (w - 80), cy = 60 + rnd() * (h - 120), r = 14 + rnd() * 18; g.strokeStyle = ink(.5); g.beginPath(); g.arc(cx, cy, r, Math.PI * .1, Math.PI * 1.7); g.stroke(); g.beginPath(); g.arc(cx + r * .9, cy + r * .2, r * .6, Math.PI * 1.1, Math.PI * 2.4); g.stroke(); g.beginPath(); g.arc(cx + r * .3, cy, r * .35, 0, Math.PI * 1.5); g.stroke(); }
  // 몸통 채움 + 윤곽
  const outline = () => { g.beginPath(); C.forEach((c, k) => k ? g.lineTo(c.x + c.nx * c.wd, c.y + c.ny * c.wd) : g.moveTo(c.x + c.nx * c.wd, c.y + c.ny * c.wd)); for (let k = C.length - 1; k >= 0; k--) { const c = C[k]; g.lineTo(c.x - c.nx * c.wd, c.y - c.ny * c.wd); } g.closePath(); };
  outline(); g.fillStyle = ink(.42); g.fill(); g.save(); outline(); g.clip();
  // 비늘(몸통 안, 반원 줄)
  g.lineWidth = 1.6; g.strokeStyle = ink(.7); for (let k = 2; k < C.length - 2; k += 2) { const c = C[k]; for (let s = -2; s <= 2; s++) { if (Math.abs(s) * .36 > .9) continue; const x = c.x + c.nx * c.wd * s * .36, y = c.y + c.ny * c.wd * s * .36; g.beginPath(); g.arc(x, y, c.wd * .2, Math.atan2(c.ny, c.nx) - 1.4, Math.atan2(c.ny, c.nx) + 1.4); g.stroke(); } }
  // 배 줄무늬(한쪽 가장자리)
  g.strokeStyle = 'rgba(150,120,70,.5)'; g.lineWidth = 3; for (let k = 3; k < C.length - 2; k += 3) { const c = C[k]; g.beginPath(); g.moveTo(c.x - c.nx * c.wd * .95, c.y - c.ny * c.wd * .95); g.lineTo(c.x - c.nx * c.wd * .55, c.y - c.ny * c.wd * .55); g.stroke(); }
  g.restore(); outline(); g.lineWidth = 3; g.strokeStyle = ink(.92); g.stroke();
  // 등 갈기(톱니)
  g.fillStyle = ink(.8); for (let k = 6; k < C.length - 6; k += 4) { const c = C[k], b = C[k + 2]; g.beginPath(); g.moveTo(c.x + c.nx * c.wd, c.y + c.ny * c.wd); g.lineTo((c.x + b.x) / 2 + c.nx * (c.wd + 12), (c.y + b.y) / 2 + c.ny * (c.wd + 12)); g.lineTo(b.x + b.nx * b.wd, b.y + b.ny * b.wd); g.fill(); }
  // 발톱 3쌍
  for (const t of [.3, .55, .8]) { const c = C[Math.round(t * N)], sx = c.x - c.nx * c.wd, sy = c.y - c.ny * c.wd; g.strokeStyle = ink(.9); g.lineWidth = 4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - c.nx * 26, sy - c.ny * 26 + 10); g.stroke(); g.lineWidth = 2.5; for (let f = -1; f <= 1; f++) { g.beginPath(); g.moveTo(sx - c.nx * 26, sy - c.ny * 26 + 10); g.quadraticCurveTo(sx - c.nx * 36 + f * 8, sy - c.ny * 36 + 14, sx - c.nx * 40 + f * 12, sy - c.ny * 30 + 24); g.stroke(); } }
  // 머리(어깨 쪽 끝): 주둥이·눈·뿔·수염
  { const c = C[0], x = c.x, y = c.y; g.fillStyle = ink(.4); g.strokeStyle = ink(.95); g.lineWidth = 3; g.beginPath(); g.moveTo(x - 34, y + 6); g.quadraticCurveTo(x - 10, y - 30, x + 30, y - 12); g.quadraticCurveTo(x + 46, y + 2, x + 30, y + 16); g.quadraticCurveTo(x, y + 30, x - 34, y + 6); g.fill(); g.stroke();
    g.fillStyle = 'rgba(170,40,25,.75)'; g.beginPath(); g.ellipse(x + 8, y - 6, 6, 4, -.3, 0, Math.PI * 2); g.fill(); g.fillStyle = ink(1); g.beginPath(); g.arc(x + 9, y - 6, 2, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3; g.beginPath(); g.moveTo(x - 6, y - 18); g.quadraticCurveTo(x - 18, y - 46, x - 40, y - 52); g.moveTo(x + 6, y - 20); g.quadraticCurveTo(x + 2, y - 50, x - 14, y - 60); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(x + 36, y + 6); g.bezierCurveTo(x + 70, y + 20, x + 50, y + 60, x + 80, y + 80); g.moveTo(x + 30, y + 14); g.bezierCurveTo(x + 50, y + 40, x + 20, y + 70, x + 44, y + 96); g.stroke(); }
});
/* ---------- 몸 분석(바인드 자세, 모델 단위) ---------- */
function analyze(model, Bn) {
  const skinned = []; model.traverse(o => { if (o.isSkinnedMesh && o.geometry && o.geometry.attributes.skinIndex) skinned.push(o); });
  if (!skinned.length) return null;
  const mn = o => [].concat(o.material).map(m => (m && m.name || '').toLowerCase()).join('|');
  const body = skinned.find(o => /body/.test(mn(o))) || skinned.reduce((a, b) => (b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a));
  const head = skinned.find(o => o !== body && /head/.test(mn(o))) || body;
  const sk = body.skeleton, bones = sk.bones, BP = bones.map((b, i) => V().setFromMatrixPosition(new T.Matrix4().copy(sk.boneInverses[i]).invert()));
  const idx = b => b ? bones.indexOf(b) : -1, P = b => BP[idx(b)] || null;
  const grp = bones.map(b => { for (let q = b; q; q = q.parent) { for (const s of ['L', 'R']) { if (q === Bn['hand' + s]) return 'hand' + s; if (q === Bn['la' + s]) return 'fa' + s; if (q === Bn['ua' + s]) return 'ua' + s; if (q === Bn['foot' + s]) return 'foot' + s; if (q === Bn['ll' + s]) return 'calf' + s; if (q === Bn['ul' + s]) return 'thigh' + s; } if (q === Bn.clavL || q === Bn.clavR) return 'torso';   /* Biped 쇄골은 목의 자식 — 어깨는 몸통으로 */ if (q === Bn.head) return 'head'; if (q === Bn.neck) return 'neck'; if (q === Bn.hips) return 'torso'; } return 'torso'; });
  const hips = P(Bn.hips), neck = P(Bn.neck), hd = P(Bn.head); if (!hips || !neck || !hd) return null;
  const up = V().subVectors(neck, hips).normalize(), lat = V().subVectors(P(Bn.uaL), P(Bn.uaR)); lat.addScaledVector(up, -lat.dot(up)).normalize();
  const rd = (mesh) => { const g = mesh.geometry, pa = dec(g.attributes.position), na = dec(g.attributes.normal), si = dec(g.attributes.skinIndex), sw = dec(g.attributes.skinWeight), n = g.attributes.position.count, out = new Array(n), bm = mesh.bindMatrix, nm = new T.Matrix3().getNormalMatrix(bm);
    for (let i = 0; i < n; i++) { const p = V().fromArray(pa, i * 3), bw = p.clone().applyMatrix4(bm), ln = na ? V().fromArray(na, i * 3).normalize() : V(0, 1, 0), nr = ln.clone().applyMatrix3(nm).normalize(); const W = {}; let ws = 0; for (let k = 0; k < 4; k++) ws += sw[i * 4 + k]; for (let k = 0; k < 4; k++) { const w = sw[i * 4 + k] / (ws || 1), b = si[i * 4 + k]; if (w > 0) W[grp[b]] = (W[grp[b]] || 0) + w; } out[i] = { i, p, ln, bw, nr, W, si: [si[i * 4], si[i * 4 + 1], si[i * 4 + 2], si[i * 4 + 3]], sw: [0, 1, 2, 3].map(k => sw[i * 4 + k] / (ws || 1)) }; } return out; };
  const BV = rd(body), HV = head === body ? BV : rd(head);
  let lo = 1e9, hi = -1e9; for (const v of BV.concat(head === body ? [] : HV)) { const h = v.bw.clone().sub(hips).dot(up); if (h < lo) lo = h; if (h > hi) hi = h; }
  const U = (hi - lo) / 1.7;   // 모델 단위 / m (실사 모델은 1.7m 기준으로 변환돼 있음)
  // 앞쪽: 발끝 방향
  const fv = V(); let fc = 0; for (const v of BV) if ((v.W.footL || 0) + (v.W.footR || 0) > .6) { fv.add(v.bw); fc++; } fv.multiplyScalar(1 / Math.max(1, fc)).sub(V().addVectors(P(Bn.footL), P(Bn.footR)).multiplyScalar(.5)); fv.addScaledVector(up, -fv.dot(up));
  let fwd = V().crossVectors(lat, up).normalize(); if (fwd.dot(fv) < 0) fwd.negate();
  const H = v => v.clone().sub(hips).dot(up) / U, F = v => v.clone().sub(hips).dot(fwd) / U, L = v => v.clone().sub(hips).dot(lat) / U;   // m 단위 높이·앞·옆
  return { model, Bn, body, head, sk, bones, BP, P, idx, up, lat, fwd, U, H, F, L, BV, HV, lo: lo / U, hi: hi / U, kB: V().setFromMatrixColumn(body.bindMatrix, 0).length(), kH: V().setFromMatrixColumn(head.bindMatrix, 0).length() };
}

/* ---------- 껍질: 조건에 맞는 삼각형만 골라 법선 방향으로 띄움 ---------- */
function shell(A, mesh, verts, pick, offM, uvFn, need = 3) {   // need: 삼각형 꼭짓점 중 몇 개가 맞아야 넣을지(성긴 LOD 메시는 2 = 구멍 줄임)
  const g = mesh.geometry, ix = g.index, n = ix ? ix.count : g.attributes.position.count, pa = [], na = [], ua = [], si = [], sw = [], map = new Map(), id = [];
  const k = mesh === A.body ? A.kB : A.kH, off = offM, uvD = dec(g.attributes.uv);
  const ok = verts.map((v, i) => pick(v, i));
  for (let t = 0; t < n; t += 3) { const a = ix ? ix.getX(t) : t, b = ix ? ix.getX(t + 1) : t + 1, c = ix ? ix.getX(t + 2) : t + 2; if ((ok[a] ? 1 : 0) + (ok[b] ? 1 : 0) + (ok[c] ? 1 : 0) < need) continue;
    for (const i of [a, b, c]) { let j = map.get(i); if (j === undefined) { j = map.size; map.set(i, j); const v = verts[i], ln = v.ln, o = (typeof off === 'function' ? off(v) : off) * A.U / k; pa.push(v.p.x + ln.x * o, v.p.y + ln.y * o, v.p.z + ln.z * o); na.push(ln.x, ln.y, ln.z);
        const q = uvFn ? uvFn(v) : (uvD ? [uvD[i * 2], uvD[i * 2 + 1]] : [0, 0]); ua.push(q[0], q[1]); for (let kk = 0; kk < 4; kk++) { si.push(v.si[kk]); sw.push(v.sw[kk]); } } id.push(j); } }
  if (!id.length) return null;
  const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pa, 3)); G.setAttribute('normal', new T.Float32BufferAttribute(na, 3)); G.setAttribute('uv', new T.Float32BufferAttribute(ua, 2)); G.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4)); G.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4)); G.setIndex(id); G.computeBoundingSphere(); return { G, mesh };
}
/* 한 뼈에 고정된 메시(띠·헤어·이어폰): 바인드 공간 좌표 → 메시 로컬, 가중치 1 */
function rigid(A, Gbw, bone, mesh = A.body) { const bi = A.idx(bone); if (bi < 0) return null; const inv = new T.Matrix4().copy(mesh.bindMatrix).invert(),   /* bindMatrixInverse 가 아닌 bindMatrix 의 역(껍질은 bind() 로 다시 묶임) */ pa = Gbw.attributes.position, n = pa.count; for (let i = 0; i < n; i++) { const p = V().fromBufferAttribute(pa, i).applyMatrix4(inv); pa.setXYZ(i, p.x, p.y, p.z); }
  if (Gbw.attributes.normal) { const nm = new T.Matrix3().getNormalMatrix(inv), na = Gbw.attributes.normal; for (let i = 0; i < n; i++) { const q = V().fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); na.setXYZ(i, q.x, q.y, q.z); } }
  Gbw.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => i % 4 === 0 ? bi : 0), 4)); Gbw.setAttribute('skinWeight', new T.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0), 4)); Gbw.computeBoundingSphere(); return { G: Gbw, mesh }; }
/* 띠: 축(c, ax) 둘레 각도별로 몸 반지름을 재서(+여유) 폭 wM 의 띠 */
function ring(A, verts, sel, c, ax, wM, padM, seg = 48, tilt) {
  const ref = Math.abs(ax.dot(A.fwd)) < .9 ? A.fwd.clone() : A.up.clone(); ref.addScaledVector(ax, -ref.dot(ax)).normalize(); const r2 = V().crossVectors(ax, ref), R = new Array(seg).fill(0), U = A.U;
  const win = Math.max(wM * 1.5, .02) * U; for (const v of verts) { if (!sel(v)) continue; const d = v.bw.clone().sub(c), x = d.dot(ref), y = d.dot(r2), th = Math.atan2(y, x), a = d.dot(ax) - (tilt ? tilt(th) * U : 0); if (Math.abs(a) > win) continue; const r = Math.hypot(x, y), s = Math.floor(((th / (Math.PI * 2)) + 1) % 1 * seg); if (r > R[s]) R[s] = r; }
  for (let it = 0; it < 3; it++) for (let s = 0; s < seg; s++) if (!R[s]) R[s] = Math.max(R[(s + 1) % seg], R[(s + seg - 1) % seg]);
  const mx = Math.max(...R); if (!mx) return null; for (let s = 0; s < seg; s++) R[s] = Math.max(R[s], mx * .55);
  const pa = [], na = [], ua = [], id = [];
  for (let s = 0; s <= seg; s++) { const th = s / seg * Math.PI * 2, r = R[s % seg] + padM * U, dir = ref.clone().multiplyScalar(Math.cos(th)).addScaledVector(r2, Math.sin(th)), dy = tilt ? tilt(th) * U : 0;
    for (const e of [-.5, .5]) { const p = c.clone().addScaledVector(dir, r).addScaledVector(ax, e * wM * U + dy); pa.push(p.x, p.y, p.z); na.push(dir.x, dir.y, dir.z); ua.push(s / seg * (seg / 8), e + .5); } }
  for (let s = 0; s < seg; s++) { const a = s * 2; id.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pa, 3)); G.setAttribute('normal', new T.Float32BufferAttribute(na, 3)); G.setAttribute('uv', new T.Float32BufferAttribute(ua, 2)); G.setIndex(id); return G;
}
/* 층진 단발: 머리 메시를 (각도 θ, 높이) 칸으로 재서 바깥에 씌움 — 얼굴 쪽(앞 ±face°)은 눈썹 아래로 안 내려옴, 아랫단은 들쭉날쭉 */
function bob(A, o) {
  const HV = A.HV.filter(v => (v.W.head || 0) > .5), hc = A.P(A.Bn.head), U = A.U; if (HV.length < 50) return null;
  const top = Math.max(...HV.map(v => A.H(v.bw))), c = hc.clone().addScaledVector(A.up, (top - A.H(hc)) * U * .0);   // 축: 머리뼈를 지나는 세로선
  const NA = 40, NH = 22, hTop = top + o.thick, hBot = top - o.len, R = Array.from({ length: NH }, () => new Array(NA).fill(0));
  const ang = v => { const d = v.bw.clone().sub(c); const x = d.dot(A.fwd), y = d.dot(A.lat); return [Math.atan2(y, x), Math.hypot(x, y) / U]; };
  for (const v of HV) { const h = A.H(v.bw), [a, r] = ang(v), ri = Math.floor((hTop - h) / (hTop - hBot) * NH), ai = Math.floor(((a / (Math.PI * 2)) + 1) % 1 * NA); if (ri >= 0 && ri < NH && r > R[ri][ai]) R[ri][ai] = r; }
  for (let i = 0; i < NH; i++) for (let it = 0; it < 4; it++) for (let j = 0; j < NA; j++) if (!R[i][j]) R[i][j] = Math.max(R[i][(j + 1) % NA], R[i][(j + NA - 1) % NA]);
  { let i0 = R.findIndex(row => row.some(x => x > 0)); if (i0 < 0) return null; for (let i = i0 - 1; i >= 0; i--) for (let j = 0; j < NA; j++) R[i][j] = R[i + 1][j] * .86; }   // 정수리 위(표본 없음)는 둥글게 좁혀 돔으로
  const rr = Array.from({ length: NH + 1 }, () => new Array(NA + 1).fill(0)); let mx = 0;
  for (let i = 0; i <= NH; i++) for (let j = 0; j <= NA; j++) { const rowR = R[Math.min(NH - 1, i)], v = Math.max(rowR[j % NA], rowR[(j + 1) % NA], rowR[(j + NA - 1) % NA]); mx = Math.max(mx, v); rr[i][j] = v; }
  // 아래로 갈수록 머리카락은 떨어져 내려오므로 반지름은 줄지 않게(최대값 유지) + 끝으로 갈수록 살짝 안으로 말림
  for (let j = 0; j <= NA; j++) { let m = 0; for (let i = 0; i <= NH; i++) { m = Math.max(m, rr[i][j]); rr[i][j] = m; } }
  const face = o.face * Math.PI / 180, pa = [], ua = [], id = [], vi = (i, j) => i * (NA + 1) + j, tipJ = Array.from({ length: NA + 1 }, (_, j) => (Math.sin(j * 2.3) * .5 + .5) * o.layer + (Math.sin(j * 5.7) * .5 + .5) * o.layer * .5);
  const brow = top - o.brow;
  for (let i = 0; i <= NH; i++) for (let j = 0; j <= NA; j++) { const th = j / NA * Math.PI * 2, t = i / NH; let h = hTop - t * (hTop - hBot); const fr = Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) < face;
      if (fr) h = Math.max(h, brow + (1 - Math.cos(th * 2)) * .006 + Math.sin(th) * .012 + (i === NH ? tipJ[j] * .35 : 0));   /* 옆으로 넘긴 앞머리(비스듬) */ else if (i === NH) h += tipJ[j];
      const swell = Math.sin(Math.min(1, t * 1.6) * Math.PI * .5) * o.vol * (fr ? .4 : 1) - (t > .8 ? (t - .8) * o.curl : 0);
      const r = (rr[i][j] || mx) + o.thick * (i === 0 ? .4 : 1) + swell, d = A.fwd.clone().multiplyScalar(Math.cos(th)).addScaledVector(A.lat, Math.sin(th));
      const p = c.clone().addScaledVector(d, r * U).addScaledVector(A.up, (h - A.H(c)) * U); pa.push(p.x, p.y, p.z); ua.push(j / NA * 4, t); }
  // 정수리 마감(위 뚜껑)
  const capI = pa.length / 3; { const p = c.clone().addScaledVector(A.up, (hTop + o.thick * .3 - A.H(c)) * U); pa.push(p.x, p.y, p.z); ua.push(.5, 0); }
  for (let j = 0; j < NA; j++) id.push(capI, vi(0, j + 1), vi(0, j));
  for (let i = 0; i < NH; i++) for (let j = 0; j < NA; j++) id.push(vi(i, j), vi(i, j + 1), vi(i + 1, j), vi(i, j + 1), vi(i + 1, j + 1), vi(i + 1, j));
  const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pa, 3)); G.setAttribute('uv', new T.Float32BufferAttribute(ua, 2)); G.setIndex(id); G.computeVertexNormals(); return G;
}

/* ---------- 의상 정의 ---------- */
const mat = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: .8, metalness: 0, skinning: true }, o));   // r128: 스킨 재질은 skinning:true 필요
const SPECS = {
  /* 조여사(록 기타리스트): 공연복 = 흰 민소매(모델 자체 옷) + 청바지 + 징 벨트 + 손목 밴드 / 평상복 = 네이비 집업 후드 + 베이지 니트 카디건 + 금목걸이 + 흰 무선 이어폰
   * 헤어 = 적갈색 층진 단발 · 몸 = 다부진 체형(가로 +7%) · 양팔 용 문신(항상 — 후드를 입으면 가려짐) */
  jo_rock: { outfit: 'concert', tuck: true, width: 1.07, height: 1.6, clothTone: [0, 0], build(A) {
    const out = [], Bn = A.Bn, W = (v, ...k) => k.reduce((s, x) => s + (v.W[x] || 0), 0), arms = v => W(v, 'uaL', 'uaR', 'faL', 'faR', 'handL', 'handR'), legs = v => W(v, 'thighL', 'thighR', 'calfL', 'calfR');
    const hipH = A.H(A.P(Bn.hips)), neckH = A.H(A.P(Bn.neck)), waist = hipH + .1, ankle = Math.max(A.H(A.P(Bn.footL)), A.H(A.P(Bn.footR))) + .035;
    // 청바지(두 벌 공통): 다리 + 골반, 손·팔 제외, 발목 위까지
    const jeans = shell(A, A.body, A.BV, v => { const h = A.H(v.bw); return arms(v) < .15 && W(v, 'footL', 'footR') < .35 && h > ankle && (legs(v) > .45 || (W(v, 'torso') > .5 && h < waist)); }, .007);
    if (jeans) out.push({ name: 'WR_jeans', ...jeans, mat: mat({ map: denim(), roughness: .92 }) });
    // 문신: 위팔~손목 + 어깨 머리, 팔 둘레 원통 UV
    for (const s of ['L', 'R']) { const a = A.P(Bn['ua' + s]), b = A.P(Bn['hand' + s]); if (!a || !b) continue; const ax = V().subVectors(b, a), len = ax.length(); ax.normalize(); const ref = A.fwd.clone().addScaledVector(ax, -A.fwd.dot(ax)).normalize(), r2 = V().crossVectors(ax, ref);
      const t = shell(A, A.body, A.BV, v => { const d = v.bw.clone().sub(a), q = d.dot(ax) / len; return W(v, 'ua' + s, 'fa' + s) > .55 && W(v, 'hand' + s) < .3 && q > -.12 && q < .97; }, .0012,
        v => { const d = v.bw.clone().sub(a), q = d.dot(ax) / len, ang = Math.atan2(d.dot(r2), d.dot(ref)); return [((ang / (Math.PI * 2)) + 1.25) % 1, 1 - Math.min(1, Math.max(0, (q + .12) / 1.09))]; });
      if (t) out.push({ name: 'WR_tattoo' + s, ...t, mat: mat({ map: dragonTex(s), transparent: true, alphaTest: .08, depthWrite: false, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2 }), order: 1 }); }
    // 징 박힌 벨트(골반 높이, 엉덩이뼈 고정)
    { const c = A.P(Bn.hips).clone().addScaledVector(A.up, (waist - .015 - hipH) * A.U), G = ring(A, A.BV, v => arms(v) < .1, c, A.up, .04, .011); const r = G && rigid(A, G, Bn.hips); if (r) out.push({ name: 'OUT_concert_belt', ...r, mat: mat({ map: studs(), roughness: .45, metalness: .35 }) }); }
    // 손목 밴드: 왼손 구슬 + 가죽, 오른손 가죽
    for (const s of ['L', 'R']) { const la = A.P(Bn['la' + s]), hd = A.P(Bn['hand' + s]); if (!la || !hd) continue; const ax = V().subVectors(hd, la).normalize();
      for (const [k, back, tex, w] of s === 'L' ? [[0, .035, beads(), .016], [1, .06, null, .02]] : [[0, .04, null, .028]]) { const c = hd.clone().addScaledVector(ax, -back * A.U), G = ring(A, A.BV, v => W(v, 'fa' + s, 'hand' + s) > .6, c, ax, w, .005, 24); const r = G && rigid(A, G, Bn['la' + s]); if (r) out.push({ name: `OUT_concert_band${s}${k}`, ...r, mat: tex ? mat({ map: tex, roughness: .35, metalness: .2 }) : mat({ color: 0x141414, roughness: .55 }) }); } }
    // 평상복: 카디건(몸통) → 후드(몸통+팔, 앞 지퍼 열림)
    const torsoTop = neckH - .035, isFrontOpen = (v, half) => A.F(v.bw) > 0 && Math.abs(A.L(v.bw)) < half && A.H(v.bw) > waist - .02;
    const card = shell(A, A.body, A.BV, v => { const h = A.H(v.bw); return arms(v) < .5 && W(v, 'neck', 'head') < .3 && h > waist - .09 && h < neckH - .005; }, .008);
    if (card) out.push({ name: 'OUT_casual_cardigan', ...card, mat: mat({ map: knit('knitBeige2', '#cdb38a', '#a08560'), roughness: 1 }) });
    // 카디건 단추 5개(앞 중심선, 몸 표면 + 1.2cm)
    { const fr = A.BV.filter(v => Math.abs(A.L(v.bw)) < .02 && A.F(v.bw) > 0 && arms(v) < .1 && W(v, 'neck', 'head') < .3); for (let k = 0; k < 5; k++) { const hh = neckH - .07 - k * .065, near = fr.filter(v => Math.abs(A.H(v.bw) - hh) < .02); if (!near.length) continue; const f = near.reduce((m, v) => (A.F(v.bw) > A.F(m.bw) ? v : m));
        const G = new T.SphereGeometry(.0055 * A.U, 8, 6); G.scale(1, 1, .45); const q = new T.Quaternion().setFromUnitVectors(V().set(0, 0, 1), A.fwd); G.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(q)); const pp = f.bw.clone().addScaledVector(A.fwd, .012 * A.U); G.translate(pp.x, pp.y, pp.z); const r = rigid(A, G, Bn.chest || Bn.spine); if (r) out.push({ name: 'OUT_casual_btn' + k, ...r, mat: mat({ color: 0xf2eee6, roughness: .4 }) }); } }
    const hood = shell(A, A.body, A.BV, v => { const h = A.H(v.bw); if (W(v, 'handL', 'handR') > .25 || W(v, 'head') > .15) return false; if (isFrontOpen(v, .06)) return false; if (W(v, 'neck') > .45) return h < neckH + .06 && !(A.F(v.bw) > A.F(A.P(Bn.neck)) && Math.abs(A.L(v.bw)) < .045);   /* 목 뒤·옆 = 후드 깃(목 앞은 열림) */ return (arms(v) > .4 && W(v, 'handL', 'handR') < .2) || (h > waist - .11 && h < neckH + .06); }, v => .014 + (arms(v) > .5 ? .002 : 0));
    if (hood) out.push({ name: 'OUT_casual_hoodie', ...hood, mat: mat({ map: fleece(), roughness: .9 }) });
    // 금목걸이: 목 아래, 앞쪽으로 V 처짐
    { const c = A.P(Bn.neck).clone().addScaledVector(A.up, -.035 * A.U), G = ring(A, A.BV, v => W(v, 'torso', 'neck') > .6 && arms(v) < .1, c, A.up, .004, .014, 40, th => -.05 * Math.max(0, Math.cos(th)) ** 2); const r = G && rigid(A, G, Bn.chest || Bn.spine); if (r) out.push({ name: 'OUT_casual_necklace', ...r, mat: mat({ color: 0xe0b44c, roughness: .3, metalness: .45, emissive: 0x3a2800 })   /* 환경맵이 없으면 금속 1.0 은 검게 보임 */ }); }
    // 흰 무선 이어폰: 머리 메시 좌우 끝(귀 높이)
    { const hv = A.HV.filter(v => (v.W.head || 0) > .6), top = Math.max(...hv.map(v => A.H(v.bw))); for (const sg of [1, -1]) { const band = hv.filter(v => Math.abs(A.H(v.bw) - (top - .12)) < .02 && Math.abs(A.F(v.bw) - A.F(A.P(Bn.head))) < .04); if (!band.length) continue; const e = band.reduce((m, v) => (A.L(v.bw) * sg > A.L(m.bw) * sg ? v : m)).bw.clone();
      const G = new T.SphereGeometry(.0068 * A.U, 10, 8); G.scale(1, 2.2, 1); G.translate(0, -.012 * A.U, 0); /* 이어폰 몸통(세로로 긴 알) */ const q = new T.Quaternion().setFromUnitVectors(V().set(0, 1, 0), A.up); G.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(q)); G.translate(e.x + A.lat.x * sg * .004 * A.U, e.y + A.lat.y * sg * .004 * A.U, e.z + A.lat.z * sg * .004 * A.U); const r = rigid(A, G, Bn.head, A.head); if (r) out.push({ name: 'OUT_casual_buds' + (sg > 0 ? 'L' : 'R'), ...r, mat: mat({ color: 0xf4f4f2, roughness: .3 }) }); } }
    // 적갈색 층진 단발(머리뼈 고정, 양면)
    { const G = bob(A, { thick: .016, len: .235, layer: .035, face: 42, brow: .1, vol: .013, curl: .05 }); const r = G && rigid(A, G, Bn.head, A.head); if (r) out.push({ name: 'WR_hair', ...r, mat: mat({ map: hairTex(), side: T.DoubleSide, roughness: .55 }) }); }
    return out;
  } },
};

/* 원래 머리 메시에서 단발 밖으로 나오는 꽁지머리 정점(뒤통수보다 뒤·아래)을 머리 속 한 점으로 접음 — 이 인스턴스의 지오메트리 사본만 바꿈 */
function tuck(r, head) { if (head._wrTuck) return; const A = analyze(r.model, r.Bn); if (!A || A.head !== head) return; const g = head.geometry.clone(), pa = g.attributes.position;
  const d = pa.normalized ? (DEN[pa.array.constructor.name] || 1) : 1, top = Math.max(...A.HV.map(v => A.H(v.bw))), fh = A.F(A.P(A.Bn.head)), inner = A.P(A.Bn.head).clone().addScaledVector(A.up, .06 * A.U), inv = new T.Matrix4().copy(head.bindMatrix).invert(), ip = inner.applyMatrix4(inv); let n = 0;
  A.HV.forEach(v => { if (A.F(v.bw) < fh - .075 && A.H(v.bw) < top - .15) { pa.setXYZ(v.i, ip.x * d, ip.y * d, ip.z * d); n++; }   /* r128 setXYZ 는 정규화 안 함 → 정수값으로 */ });
  (pa.data || pa).needsUpdate = true; head.geometry = g; head._wrTuck = n; }

/* ---------- 입히기 ---------- */
const CACHE = new Map();   // url → 조각 목록(지오메트리 공유)
function dress(root) {
  const u = root && root.userData, r = u && u.real, sp = u && SPECS[u.wardrobe]; if (!sp || !r || r.pending || !r.model) return false;
  if (r._wr === u.wardrobe) return true;
  let parts = CACHE.get(r.url + '|' + u.wardrobe); const t0 = performance.now();
  if (!parts) { const A = analyze(r.model, r.Bn); if (!A) return false; parts = sp.build(A).map(p => ({ name: p.name, G: p.G, src: p.mesh === A.head ? 'head' : 'body', mat: p.mat, order: p.order || 0 })); CACHE.set(r.url + '|' + u.wardrobe, parts); }
  const skinned = []; r.model.traverse(o => { if (o.isSkinnedMesh && o.geometry && o.geometry.attributes.skinIndex) skinned.push(o); });
  const mn = o => [].concat(o.material).map(m => (m && m.name || '').toLowerCase()).join('|'), body = skinned.find(o => /body/.test(mn(o))) || skinned[0], head = skinned.find(o => o !== body && /head/.test(mn(o))) || body;
  (r._wrMeshes || []).forEach(m => m.parent && m.parent.remove(m)); r._wrMeshes = [];
  for (const p of parts) { const src = p.src === 'head' ? head : body, m = new T.SkinnedMesh(p.G, p.mat); m.name = p.name; m.bind(src.skeleton, src.bindMatrix); m.frustumCulled = false; m.castShadow = src.castShadow; m.receiveShadow = src.receiveShadow; m.renderOrder = (src.renderOrder || 0) + p.order; m.userData.wardrobe = true; src.parent.add(m); r._wrMeshes.push(m); }
  if (sp.tuck) tuck(r, head);   // 원래 모델의 뒤로 묶은 머리(꽁지)가 새 단발 아래로 삐져나와서 머리 안쪽으로 접어 넣음
  r._wr = u.wardrobe;
  if (sp.width && r.holder && !r._wrW) { r.holder.scale.x *= sp.width; r.holder.scale.z *= sp.width; r._wrW = sp.width; }
  if (sp.clothTone && RH.clothTone) RH.clothTone(root, sp.clothTone[0], sp.clothTone[1]);
  RH.setOutfit(root, u.outfit || sp.outfit);
  r._wrMs = +(performance.now() - t0).toFixed(1); return true;
}
/* ═════════════ v72 상황별 옷 레이어(OutfitManager) — 모든 실사 모델 공통 ═════════════
 *  모텔·라운지 상태(재킷 벗음·편한 차림·상의 벗음·잠옷 차림·가운·실크 가운·새틴 슬립·커플 잠옷·수건·이불)를
 *  몸에 딱 맞는 껍질로 표현 — 구워진 외출복 위를 덮고, 드러나야 할 팔·다리·어깨는 그 사람 피부색 껍질로 덮음(맨살 디테일 없음)
 *  · 신발: 침대·가운·잠옷 단계에선 항상 호텔 슬리퍼로 덮음  · 노출 상한: 잠옷/캐미솔 세트(몸통은 항상 가림), 남성 수건 차림만 상체 노출 */
const SKIN = new Map();
function skinOf(r, look) {   // 얼굴 텍스처에서 피부색(YCbCr 피부 범위 픽셀 평균) — 못 찾거나 너무 하얗/회색이면 look.skin
  if (SKIN.has(r.url)) return SKIN.get(r.url); const fb = new T.Color(look && look.skin || '#e0b090'); if (fb.convertSRGBToLinear) fb.convertSRGBToLinear(); let col = fb;
  try { const imgs = []; r.model.traverse(o => { if (o.isMesh && !o.userData.wardrobe) [].concat(o.material).forEach(m => { if (m && m.map && m.map.image && m.map.image.width && !imgs.includes(m.map.image)) imgs.push(m.map.image); }); });
    let best = null, bestN = 0; for (const img of imgs) { const c = document.createElement('canvas'), W0 = 64; c.width = c.height = W0; const g = c.getContext('2d'); g.drawImage(img, 0, 0, W0, W0); const d = g.getImageData(0, 0, W0, W0).data; let R = 0, G = 0, B = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const r0 = d[i], g0 = d[i + 1], b0 = d[i + 2], y = .299 * r0 + .587 * g0 + .114 * b0, cb = 128 - .169 * r0 - .331 * g0 + .5 * b0, cr = 128 + .5 * r0 - .419 * g0 - .081 * b0; if (y > 70 && y < 235 && cb > 85 && cb < 130 && cr > 135 && cr < 175) { R += r0; G += g0; B += b0; n++; } }
      if (n > bestN) { bestN = n; best = [R / n / 255, G / n / 255, B / n / 255]; } }   // 텍스처마다 피부 픽셀 수 — 가장 많은 것(얼굴·몸)
    if (best && bestN > 30) { col = new T.Color().setRGB(best[0], best[1], best[2]); if (col.convertSRGBToLinear) col.convertSRGBToLinear(); } } catch (e) { }
  { const hsl = {}; col.getHSL(hsl); if (col === fb || hsl.l > .8 || hsl.s < .15) col = fb; }
  SKIN.set(r.url, col); return col; }
const terry = () => canvasTex('terry', 128, 128, (g, w, h) => { g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '150,140,130'},${.08 + rnd() * .12})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, .8 + rnd() * 1.2, 0, Math.PI * 2); g.fill(); } }, true);
const satin = (key, a, b) => canvasTex(key, 128, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, a); gr.addColorStop(.5, b); gr.addColorStop(1, a); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, true);
const check = (key, a, b) => canvasTex(key, 64, 64, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h); for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 6); }, true);
/* 옷 종류: top(몸통 위 끝: 'neck' 목까지 · 'cami' 쇄골 아래 · 'chest' 가슴 위 · 'none') · sleeve(none|short|elbow|long) · bottom(none|hip|thigh|knee|ankle) · slippers · robe(가운 V·허리끈) · towel(남: 허리만) */
const LAYERS = {
  jacketOff: { f: { top: 'neck', sleeve: 'short', bottom: 'keep', mat: 'blouse' }, m: { top: 'neck', sleeve: 'short', bottom: 'keep', mat: 'tee' } },
  barefoot: { f: { top: 'neck', sleeve: 'short', bottom: 'keep', mat: 'blouse', slippers: 1 }, m: { top: 'neck', sleeve: 'short', bottom: 'keep', mat: 'tee', slippers: 1 } },
  underTop: { f: { top: 'cami', sleeve: 'none', bottom: 'keep', mat: 'camiSatin', slippers: 1 }, m: { top: 'tank', sleeve: 'none', bottom: 'keep', mat: 'tankWhite', slippers: 1 } },
  under: { f: { top: 'cami', sleeve: 'none', bottom: 'thigh', mat: 'camiSatin', slippers: 1 }, m: { top: 'tank', sleeve: 'none', bottom: 'thigh', mat: 'lounge', slippers: 1 } },
  slip: { f: { top: 'cami', sleeve: 'none', bottom: 'thighDress', mat: 'slipSatin', slippers: 1 }, m: { top: 'neck', sleeve: 'long', bottom: 'ankle', mat: 'pjNavy', slippers: 1 } },
  pajama: { f: { top: 'neck', sleeve: 'long', bottom: 'ankle', mat: 'pjBlue', slippers: 1 }, m: { top: 'neck', sleeve: 'long', bottom: 'ankle', mat: 'pjBlue', slippers: 1 } },
  robe: { f: { top: 'robe', sleeve: 'elbow', bottom: 'knee', mat: 'terry', robe: 1, slippers: 1 }, m: { top: 'robe', sleeve: 'elbow', bottom: 'knee', mat: 'terry', robe: 1, slippers: 1 } },
  silk: { f: { top: 'robe', sleeve: 'elbow', bottom: 'knee', mat: 'silkRed', robe: 1, slippers: 1 }, m: { top: 'robe', sleeve: 'elbow', bottom: 'knee', mat: 'silkPlum', robe: 1, slippers: 1 } },
  towel: { f: { top: 'chest', sleeve: 'none', bottom: 'thighDress', mat: 'towel', slippers: 1 }, m: { top: 'none', sleeve: 'none', bottom: 'kneeDress', mat: 'towel', slippers: 1 } },
  cover: { f: { top: 'chest', sleeve: 'none', bottom: 'kneeDress', mat: 'towel', slippers: 1 }, m: { top: 'none', sleeve: 'none', bottom: 'kneeDress', mat: 'towel', slippers: 1 } },
};
const LMAT = { blouse: () => mat({ color: 0xf1ebe0, roughness: .75 }), tee: () => mat({ color: 0xe9e7e2, roughness: .9 }), camiSatin: () => mat({ map: satin('satWine', '#5a0c22', '#a3274a'), roughness: .32, metalness: .08 }), tankWhite: () => mat({ color: 0xf2f1ec, roughness: .9 }),
  lounge: () => mat({ map: check('chkNavy', '#2a3550', '#36456a'), roughness: .85 }), slipSatin: () => mat({ map: satin('satChamp', '#b89a72', '#ead6b6'), roughness: .3, metalness: .08 }), pjNavy: () => mat({ map: satin('satNavy', '#16223e', '#2c3e66'), roughness: .35 }),
  pjBlue: () => mat({ map: check('chkBlue', '#9cc0e6', '#b8d4f0'), roughness: .85 }), terry: () => mat({ map: terry(), roughness: 1 }), silkRed: () => mat({ map: satin('satRed', '#6e0a2c', '#b0204c'), roughness: .3, metalness: .08 }), silkPlum: () => mat({ map: satin('satPlum', '#24142e', '#4a2a5a'), roughness: .3, metalness: .08 }),
  towel: () => mat({ map: terry(), roughness: 1 }), slipper: () => mat({ map: terry(), roughness: 1 }), belt: () => mat({ map: terry(), roughness: 1 }) };
function buildLayer(A, sp, skinCol) {
  const shell2 = (A_, m, vs, pk, off) => shell(A_, m, vs, pk, off, null, 2);
  const out = [], Bn = A.Bn, W = (v, ...k) => k.reduce((s, x) => s + (v.W[x] || 0), 0), armsW = v => W(v, 'uaL', 'uaR', 'faL', 'faR'), handW = v => W(v, 'handL', 'handR'), legW = v => W(v, 'thighL', 'thighR', 'calfL', 'calfR'), footW = v => W(v, 'footL', 'footR');
  const H = v => A.H(v.bw), hipH = A.H(A.P(Bn.hips)), neckH = A.H(A.P(Bn.neck)), waist = hipH + .1, kneeH = (A.H(A.P(Bn.llL)) + A.H(A.P(Bn.llR))) / 2, ankle = Math.max(A.H(A.P(Bn.footL)), A.H(A.P(Bn.footR))) + .03, crotch = hipH - .1;
  const elbowQ = (v, s) => { const a = A.P(Bn['ua' + s]), b = A.P(Bn['la' + s]), h = A.P(Bn['hand' + s]); if (!a || !b || !h) return 0; const ax = V().subVectors(h, a), q = v.bw.clone().sub(a).dot(ax) / ax.lengthSq(); return q; };   // 0 어깨 → 1 손목
  const side = v => (W(v, 'uaL', 'faL', 'handL') > W(v, 'uaR', 'faR', 'handR') ? 'L' : 'R');
  const topLine = { neck: neckH + .04, tank: neckH - .06, cami: neckH - .1, chest: neckH - .16, robe: neckH + .03, none: -9 }[sp.top];
  const sleeveTo = { none: 0, short: .3, elbow: .55, long: 1.01 }[sp.sleeve];
  const botTo = { keep: null, none: null, hip: crotch, thigh: crotch - .1, thighDress: crotch - .16, knee: kneeH - .02, kneeDress: kneeH - .02, ankle: ankle }[sp.bottom];
  const M = LMAT[sp.mat](), skin = mat({ color: skinCol, roughness: .62 });
  // 1) 몸통 + 소매(팔은 sleeveTo 까지) — 상의 위 끝(topLine) 아래, 가운은 앞 V 열림
  const isTorso = v => armsW(v) < .45 && handW(v) < .2 && W(v, 'head') < .15 && legW(v) < .5;
  const inV = v => sp.robe && A.F(v.bw) > 0 && H(v) > neckH - .2 + Math.abs(A.L(v.bw)) * 1.6 * 0 && Math.abs(A.L(v.bw)) < (H(v) - (neckH - .2)) * .55;   // 가운 앞섶 V (가슴 위쪽 일부만)
  const topPick = v => { if (sp.top === 'none') return false; if (handW(v) > .25) return false; const h = H(v);
    if (armsW(v) > .45) { const q = elbowQ(v, side(v)); return q < sleeveTo && (sp.sleeve !== 'none' || false); }
    if (W(v, 'neck') > .45) return sp.top === 'neck' || sp.top === 'robe' ? h < neckH + .03 && !(A.F(v.bw) > A.F(A.P(Bn.neck)) + .005) : false;
    return isTorso(v) && h < topLine && h > (sp.bottom === 'keep' ? waist - .06 : crotch + .02) && !inV(v); };
  const topOff = sp.robe ? .016 : sp.mat === 'pjBlue' || sp.mat === 'pjNavy' || sp.mat === 'lounge' ? .011 : .008;
  const top = shell2(A, A.body, A.BV, topPick, topOff); if (top) out.push({ name: 'LY_top', ...top, mat: M });
  // 2) 아래(반바지·치마형·바지·가운 자락) — 다리 + 골반, 'Dress' 는 다리 사이를 메우듯 조금 더 띄움
  if (botTo !== null) { const dress = /Dress/.test(sp.bottom) || sp.robe; const bot = shell2(A, A.body, A.BV, v => { const h = H(v); if (armsW(v) > .2 || handW(v) > .2 || footW(v) > .35) return false; return h > botTo && (legW(v) > .4 || (W(v, 'torso') > .5 && h < (sp.top === 'none' ? waist + .02 : waist + .02))); }, v => (dress ? .02 : .009) + (dress ? Math.max(0, (crotch - H(v))) * .12 : 0));
    if (bot) out.push({ name: 'LY_bottom', ...bot, mat: M }); }
  // 3) 피부: 소매 밖 팔(+손 제외) · 아래 밖 다리(발목 위) · 위 끝보다 위의 어깨·목 앞(여성은 쇄골 위까지만) · 남성 수건 차림 상체
  const skinPick = v => { const h = H(v); if (handW(v) > .3 || footW(v) > .3 || W(v, 'head') > .3) return false;
    if (armsW(v) > .45) return elbowQ(v, side(v)) >= sleeveTo - .02;
    if (legW(v) > .4) return botTo !== null && h <= botTo + .02 && (!sp.slippers || footW(v) < .3);
    if (sp.top === 'none') return isTorso(v) && h > waist - .02 && h < neckH + .05;   // 남성 수건(허리) 차림
    if (W(v, 'neck') > .45) return sp.top !== 'neck';
    if (inV(v)) return true;
    return isTorso(v) && h >= topLine - .01 && h < neckH + .05; };
  const sk = shell2(A, A.body, A.BV, skinPick, .004); if (sk) out.push({ name: 'LY_skin', ...sk, mat: skin, order: -1 });
  // 4) 캐미솔·민소매 어깨끈
  if (sp.top === 'cami' || sp.top === 'tank') for (const s of ['L', 'R']) { const c = A.P(Bn['clav' + s] || Bn['ua' + s]); if (!c) continue; const sh = A.P(Bn['ua' + s]); const st = shell(A, A.body, A.BV, v => { const h = H(v); return isTorso(v) && h >= topLine - .02 && h < neckH + .03 && Math.abs(Math.abs(A.L(v.bw)) - Math.abs(A.L(sh)) * (sp.top === 'tank' ? .55 : .62)) < (sp.top === 'tank' ? .028 : .011); }, .009); if (st) out.push({ name: 'LY_strap' + s, ...st, mat: M }); }
  // 5) 가운 허리끈
  if (sp.robe) { const c = A.P(Bn.hips).clone().addScaledVector(A.up, (waist + .02 - hipH) * A.U), G = ring(A, A.BV, v => armsW(v) < .1 && handW(v) < .1, c, A.up, .035, .024); const r = G && rigid(A, G, Bn.spine || Bn.hips); if (r) out.push({ name: 'LY_belt', ...r, mat: M }); }
  // 6) 호텔 슬리퍼(신발 위)
  if (sp.slippers) { const sl = shell2(A, A.body, A.BV, v => footW(v) > .25, .01); if (sl) out.push({ name: 'LY_slippers', ...sl, mat: LMAT.slipper() }); }
  return out;
}
const LCACHE = new Map();
function setLayer(root, kind, gender) {
  const u = root && root.userData; if (!u) return false; u.layer = kind ? { kind, gender: gender === 'm' ? 'm' : 'f' } : null; const r = u.real; if (!r || r.pending || !r.model) return false;
  (r._lyMeshes || []).forEach(m => m.parent && m.parent.remove(m)); r._lyMeshes = [];
  const restore = () => { (r._wrMeshes || []).forEach(m => { m.visible = !/^OUT_/.test(m.name); }); if (u.wardrobe) RH.setOutfit(root, u.outfit || (SPECS[u.wardrobe] || {}).outfit); };
  if (!kind) { restore(); return true; }
  const sp = LAYERS[kind] && LAYERS[kind][u.layer.gender]; if (!sp) { restore(); return false; }
  const key = r.url + '|' + kind + '|' + u.layer.gender; let parts = LCACHE.get(key);
  if (!parts) { const A = analyze(r.model, r.Bn); if (!A) return false; parts = buildLayer(A, sp, skinOf(r, u.look)).map(p => ({ name: p.name, G: p.G, src: p.mesh === A.head ? 'head' : 'body', mat: p.mat, order: p.order || 0 })); LCACHE.set(key, parts); }
  const skinned = []; r.model.traverse(o => { if (o.isSkinnedMesh && o.geometry && o.geometry.attributes.skinIndex && !o.userData.wardrobe) skinned.push(o); });
  const mn = o => [].concat(o.material).map(m => (m && m.name || '').toLowerCase()).join('|'), body = skinned.find(o => /body/.test(mn(o))) || skinned[0], head = skinned.find(o => o !== body && /head/.test(mn(o))) || body;
  for (const p of parts) { const src = p.src === 'head' ? head : body, m = new T.SkinnedMesh(p.G, p.mat); m.name = p.name; m.bind(src.skeleton, src.bindMatrix); m.frustumCulled = false; m.castShadow = src.castShadow; m.receiveShadow = src.receiveShadow; m.renderOrder = (src.renderOrder || 0) + p.order; m.userData.wardrobe = true; src.parent.add(m); r._lyMeshes.push(m); }
  (r._wrMeshes || []).forEach(m => { m.visible = m.name === 'WR_hair' || /^WR_tattoo/.test(m.name); });   // 조여사 등: 머리·문신만 남기고 자기 옷은 숨김
  r._ly = key; return true;
}
{ const a0 = RH.attach; RH.attach = async (root, url, opt) => { const res = await a0(root, url, opt); try { const u = root && root.userData; if (u && u.wardrobe) dress(root); if (u && u.layer) setLayer(root, u.layer.kind, u.layer.gender); } catch (e) { console.warn('[wardrobe]', e); } return res; }; }
// 이미 붙어 있는 모델(이 파일이 늦게 로드된 경우)도 입힘
setInterval(() => { (NC.npcs || []).forEach(n => { const u = n.g && n.g.userData; if (u && u.wardrobe && u.real && !u.real.pending && u.real._wr !== u.wardrobe) try { dress(n.g); } catch (e) { } }); }, 1500);
NC.Wardrobe = { SPECS, LAYERS, setLayer, dress, analyze, CACHE, LCACHE, _h: { ring, bob, rigid, shell, tuck } };
console.info('[wardrobe] v71 실사 모델 위 의상·헤어·문신·체형');
})();
