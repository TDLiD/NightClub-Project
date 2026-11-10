/* gfx.js — 실사 렌더링 파이프라인 (v3)
 *  ■ 화질 단계: high(그림자+블룸+필름) / mid(블룸) / low(모바일: 후처리 없음). 상단 ⚙ 버튼으로 전환, localStorage 저장
 *  ■ 절차적 PBR 텍스처 라이브러리 NC.TexLib — 대리석 바닥·원목·벨벳 터프팅·가죽·카펫·브러시드 메탈·스피커 그릴·패브릭·
 *    시퀸·피부 모공·헤어 결·연기 구름·노래방 벽지. 외부 이미지 없이 캔버스로 생성(타일링 무이음) → GitHub Pages 그대로 동작
 *  ■ 환경맵(PMREM): 클럽 조명 색을 담은 가상 방을 구워 scene.environment 로 → 모든 금속·유리·광택면에 실제 같은 반사
 *  ■ HDR 후처리: 씬(하프플로트 MSAA) → 밝은 부분 추출 → 듀얼 카와세 블룸(5단) → ACES 톤매핑 → 색수차·비네팅·필름 그레인 → sRGB
 *  ■ 볼륨 조명 빔 셰이더(NC.mat.beam): 가장자리 부드럽게·먼지 일렁임 / 접지 그림자(NC.contactShadow)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const T = NC.THREE, R = NC.renderer, U = NC.util;

/* ───────── 화질 ───────── */
const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 600;
const LEVELS = { high: { post: true, shadows: true, pr: 1.75, tex: 512, film: true }, mid: { post: true, shadows: false, pr: 1.25, tex: 512, film: true }, low: { post: false, shadows: false, pr: 1, tex: 256, film: false } };
const level = LEVELS[U.store.get('nc_quality', '')] ? U.store.get('nc_quality', '') : (mobile ? 'low' : 'high');
const Q = NC.quality = Object.assign({ level }, LEVELS[level]);
NC.setQuality = lv => { if (!LEVELS[lv]) return; U.store.set('nc_quality', lv); location.reload(); };
R.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pr));
R.shadowMap.enabled = Q.shadows; R.shadowMap.type = T.PCFSoftShadowMap; R.shadowMap.autoUpdate = true;
if (Q.post) R.toneMapping = T.NoToneMapping;          // 톤매핑은 최종 합성 셰이더에서(블룸이 HDR 값에 작용하도록)
const EXPOSURE = 1.15;
NC.shadow = (o, cast = true, receive = false) => { if (!Q.shadows || !o) return o; o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } }); return o; };

/* ───────── 절차적 텍스처 ───────── */
const S = Q.tex;
const cnv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// 타일링되는 값 노이즈 fBm  (base: 1옥타브 격자 수)
function fbm(size, base, oct, seed, pers = .5) {
  const out = new Float32Array(size * size), r = U.rng(seed); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const n = base << o, lat = new Float32Array(n * n); for (let i = 0; i < n * n; i++) lat[i] = r();
    for (let y = 0; y < size; y++) { const fy = y / size * n, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = iy % n, y1 = (iy + 1) % n;
      for (let x = 0; x < size; x++) { const fx = x / size * n, ix = fx | 0, tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % n, x1 = (ix + 1) % n;
        const a = lat[y0 * n + x0], b = lat[y0 * n + x1], c = lat[y1 * n + x0], d = lat[y1 * n + x1];
        out[y * size + x] += (a + (b - a) * sx + (c - a + (a - b - c + d) * sx) * sy) * amp; } }
    tot += amp; amp *= pers;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
// 높이 → 노멀맵 (wrap)
function normalFrom(h, size, str) {
  const c = cnv(size), g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + (x - 1 + size) % size], r = h[y * size + (x + 1) % size], u = h[((y - 1 + size) % size) * size + x], dn = h[((y + 1) % size) * size + x];
    let nx = (l - r) * str, ny = (u - dn) * str, nz = 1; const k = 1 / Math.hypot(nx, ny, nz); const i = (y * size + x) * 4;
    d[i] = (nx * k * .5 + .5) * 255; d[i + 1] = (ny * k * .5 + .5) * 255; d[i + 2] = (nz * k * .5 + .5) * 255; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
function fieldCanvas(size, f) { const c = cnv(size), g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = f(x, y), i = (y * size + x) * 4; d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = v[3] == null ? 255 : v[3]; } g.putImageData(im, 0, 0); return c; }
const heightOf = (c, size) => { const d = c.getContext('2d').getImageData(0, 0, size, size).data, h = new Float32Array(size * size); for (let i = 0; i < h.length; i++) h[i] = d[i * 4] / 255; return h; };
const hexRGB = h => { const c = new T.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };

const GEN = {
  // 광택 대리석 타일 (2×2 타일/텍스처)
  marble(o) {
    const n = fbm(S, 2, 6, 11), m = fbm(S, 4, 5, 12), cl = fbm(S, 2, 3, 14), A = hexRGB(o.a || '#26202f'), B = hexRGB(o.b || '#8d7fa6'), tiles = o.tiles || 2, grout = S / tiles;
    const h = new Float32Array(S * S);
    const map = fieldCanvas(S, (x, y) => { const i = y * S + x, u = x / S, v = y / S;
      const s1 = Math.abs(Math.sin((u * 1.3 + v * .7 + n[i] * 2.4) * Math.PI * 2)), s2 = Math.abs(Math.sin((u * .6 - v * 1.1 + m[i] * 1.8) * Math.PI * 2));
      const vein = (Math.pow(1 - s1, 42) * .9 + Math.pow(1 - s2, 60) * .55) * U.clamp(m[i] * 1.6 - .25, 0, 1);
      const gx = Math.min(x % grout, grout - x % grout), gy = Math.min(y % grout, grout - y % grout), gl = Math.min(gx, gy) < 1.2;
      h[i] = gl ? 0 : 1 - vein * .05; const k = U.clamp(.18 + (cl[i] - .5) * .45 + vein * .7, 0, 1);
      return gl ? [10, 9, 12] : [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]; });
    const sm = fbm(S, 8, 3, 13), rough = fieldCanvas(S, (x, y) => { const i = y * S + x; const v = h[i] === 0 ? 235 : 18 + sm[i] * 60; return [v, v, v]; });
    return { map, normal: normalFrom(h, S, 5), rough };
  },
  // 원목 판재 (세로 판 4장)
  wood(o) {
    const n = fbm(S, 4, 5, 21), A = hexRGB(o.a || '#3b2416'), B = hexRGB(o.b || '#7a4a2a'), PL = S / 4, h = new Float32Array(S * S), r = U.rng(22), tint = [0, 1, 2, 3].map(() => .82 + r() * .3);
    const map = fieldCanvas(S, (x, y) => { const i = y * S + x, p = (x / PL) | 0, lx = x % PL, ring = .5 + .5 * Math.sin((lx / PL * 7 + n[i] * 9 + p * 3.1) * Math.PI), k = Math.pow(ring, 3) * .7 + n[i] * .3;
      const seam = lx < 1.5 || (((y + p * 97) % S) < 1.5) ? .25 : 1; h[i] = seam < 1 ? 0 : .5 + ring * .08; const t = tint[p] * seam;
      return [(A[0] + (B[0] - A[0]) * k) * t, (A[1] + (B[1] - A[1]) * k) * t, (A[2] + (B[2] - A[2]) * k) * t]; });
    const rough = fieldCanvas(S, (x, y) => { const v = h[y * S + x] === 0 ? 220 : 70 + n[y * S + x] * 60; return [v, v, v]; });
    return { map, normal: normalFrom(h, S, 3), rough };
  },
  // 다이아몬드 터프팅 (벨벳 벽·가죽 소파 공용, 회색조 — 머티리얼 color 로 색 입힘)
  tufted(o) {
    const cells = o.cells || 4, cw = S / cells, grain = fbm(S, 32, 2, 31), h = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const u = x / cw, v = y / cw, du = u - Math.round(u), dv = v - Math.round(v), dd = Math.abs(du) + Math.abs(dv);
      const cu = u - Math.floor(u) - .5, cv = v - Math.floor(v) - .5, dc = Math.abs(cu) + Math.abs(cv); const bump = Math.min(dd, dc) ; h[y * S + x] = Math.sqrt(U.clamp(bump * 2, 0, 1)) - grain[y * S + x] * (o.leather ? .05 : .02); }
    const map = fieldCanvas(S, (x, y) => { const v = h[y * S + x], base = o.leather ? 150 : 175, k = base + v * 80 - (v < .12 ? 70 : 0); return [k, k, k]; });
    const rough = fieldCanvas(S, (x, y) => { const v = (o.leather ? 110 : 235) - h[y * S + x] * (o.leather ? 50 : 20); return [v, v, v]; });
    return { map, normal: normalFrom(h, S, o.leather ? 9 : 7), rough };
  },
  leather() { const n = fbm(S, 64, 2, 41), m = fbm(S, 8, 3, 42); return { map: fieldCanvas(S, (x, y) => { const v = 175 + m[y * S + x] * 50; return [v, v, v]; }), normal: normalFrom(n, S, 3), rough: fieldCanvas(S, (x, y) => { const v = 95 + n[y * S + x] * 70; return [v, v, v]; }) }; },
  // 아르데코 패턴 카펫
  carpet(o) {
    const c = cnv(S), g = c.getContext('2d'), A = o.a || '#7a0e2c', B = o.b || '#d9a64a';
    g.fillStyle = A; g.fillRect(0, 0, S, S); g.strokeStyle = B; g.lineWidth = S / 90; g.globalAlpha = .85;
    const q = S / 2; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const cx = q * i + q / 2, cy = q * j + q / 2;
      g.beginPath(); g.moveTo(cx, cy - q * .42); g.lineTo(cx + q * .42, cy); g.lineTo(cx, cy + q * .42); g.lineTo(cx - q * .42, cy); g.closePath(); g.stroke();
      for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(cx, cy, q * .08 * k, 0, 7); g.stroke(); }
      g.beginPath(); g.arc(q * i, q * j, q * .2, 0, 7); g.stroke(); }
    g.globalAlpha = 1; const fib = fbm(S, 128, 1, 51), im = g.getImageData(0, 0, S, S), d = im.data; for (let i = 0; i < S * S; i++) { const k = .82 + fib[i] * .3; d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; } g.putImageData(im, 0, 0);
    return { map: c, normal: normalFrom(fib, S, 2.5), rough: fieldCanvas(S, () => [245, 245, 245]) };
  },
  speckle(o) { const n = fbm(S, 128, 2, 61), A = hexRGB(o.a || '#2a2030'); return { map: fieldCanvas(S, (x, y) => { const k = .7 + n[y * S + x] * .6; return [A[0] * k, A[1] * k, A[2] * k]; }), normal: normalFrom(n, S, 2), rough: fieldCanvas(S, () => [240, 240, 240]) }; },
  brushed() { const r = U.rng(71), h = new Float32Array(S * S); for (let y = 0; y < S; y++) { let v = r(); for (let x = 0; x < S; x++) { v += (r() - .5) * .08; h[y * S + x] = v; } }
    return { map: fieldCanvas(S, (x, y) => { const v = 190 + (h[y * S + x] % 1) * 40; return [v, v, v]; }), rough: fieldCanvas(S, (x, y) => { const v = 70 + (h[y * S + x] % 1) * 60; return [v, v, v]; }), normal: normalFrom(h.map(v => (v % 1) * .2), S, 1) }; },
  grill() { const c = cnv(S), g = c.getContext('2d'); g.fillStyle = '#26262c'; g.fillRect(0, 0, S, S); g.fillStyle = '#050506'; const st = S / 32; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { g.beginPath(); g.arc(x * st + st / 2 + (y % 2) * st / 2, y * st + st / 2, st * .36, 0, 7); g.fill(); } return { map: c, normal: normalFrom(heightOf(c, S), S, 4), rough: fieldCanvas(S, () => [150, 150, 150]) }; },
  ceiling() { const n = fbm(S, 16, 3, 81), P = S / 2, h = new Float32Array(S * S); return { map: fieldCanvas(S, (x, y) => { const e = Math.min(x % P, P - x % P, y % P, P - y % P) < 2; h[y * S + x] = e ? 0 : 1; const v = e ? 8 : 26 + n[y * S + x] * 16; return [v, v * .9, v * 1.25]; }), normal: normalFrom(h, S, 3), rough: fieldCanvas(S, () => [240, 240, 240]) }; },
  // 의상 원단: 촘촘한 직조 (회색조)
  fabric() { const s = 256, h = new Float32Array(s * s), n = fbm(s, 32, 2, 91); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const a = Math.sin(x / s * Math.PI * 96) * Math.sin(y / s * Math.PI * 96); h[y * s + x] = .5 + a * .35 + n[y * s + x] * .2; } return { size: s, map: fieldCanvas(s, (x, y) => { const v = 215 + h[y * s + x] * 40; return [v, v, v]; }), normal: normalFrom(h, s, 2.2), rough: fieldCanvas(s, (x, y) => { const v = 200 + h[y * s + x] * 40; return [v, v, v]; }) }; },
  // 시퀸 드레스: 조명 받으면 반짝이는 스케일
  sequin() { const s = 256, c = cnv(s), g = c.getContext('2d'), r = U.rng(95); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, s, s); const st = s / 24; for (let y = 0; y < 26; y++) for (let x = 0; x < 25; x++) { const nx = (r() - .5) * 200 + 128, ny = (r() - .5) * 200 + 128; g.fillStyle = `rgb(${nx | 0},${ny | 0},230)`; g.beginPath(); g.arc(x * st + (y % 2) * st / 2, y * st * .86, st * .52, 0, 7); g.fill(); } return { size: s, normal: c, rough: fieldCanvas(s, () => [70, 70, 70]) }; },
  // 피부 미세 모공
  skin() { const s = 256, n = fbm(s, 64, 2, 101), m = fbm(s, 16, 3, 102); return { size: s, normal: normalFrom(n.map((v, i) => v * .7 + m[i] * .3), s, 2.5) }; },
  // 헤어 결 (세로 줄무늬)
  hair() { const s = 256, r = U.rng(111), col = new Float32Array(s); for (let x = 0; x < s; x++) col[x] = r(); const n = fbm(s, 8, 3, 112), h = new Float32Array(s * s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const xx = (x + Math.floor(n[y * s + x] * 18)) % s; h[y * s + x] = col[xx] * .7 + col[(xx + 1) % s] * .3; }
    return { size: s, map: fieldCanvas(s, (x, y) => { const v = 150 + h[y * s + x] * 105; return [v, v, v]; }), normal: normalFrom(h, s, 1.6) }; },
  // 연기(헤이즈) 구름 — 가장자리로 갈수록 투명
  cloud() { const s = 256, n = fbm(s, 4, 5, 121); return { size: s, map: fieldCanvas(s, (x, y) => { const dx = x / s - .5, dy = y / s - .5, f = U.clamp(1 - Math.hypot(dx, dy) * 2, 0, 1); const a = Math.pow(f, 1.6) * U.clamp(n[y * s + x] * 1.8 - .35, 0, 1); return [255, 255, 255, a * 255]; }) }; },
  // 노래방 벽지 (레트로 기하학)
  wallpaper(o) { const c = cnv(S), g = c.getContext('2d'); g.fillStyle = o.a || '#1b1032'; g.fillRect(0, 0, S, S); const q = S / 4; g.lineWidth = S / 160;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const cx = i * q + q / 2, cy = j * q + q / 2; g.strokeStyle = o.b || '#c9a24a'; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * q * .42, cy + Math.sin(a) * q * .42); } g.closePath(); g.stroke();
      g.strokeStyle = o.c || '#ff5fa8'; g.globalAlpha = .55; g.beginPath(); g.arc(cx, cy, q * .18, 0, 7); g.stroke(); g.globalAlpha = 1; }
    const n = fbm(S, 64, 2, 131); return { map: c, normal: normalFrom(n, S, 1.2), rough: fieldCanvas(S, (x, y) => { const v = 180 + n[y * S + x] * 50; return [v, v, v]; }) }; },
};
const cache = {};
function texFrom(c, srgb, rep) { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy()); if (srgb) t.encoding = T.sRGBEncoding; if (rep) t.repeat.set(rep[0], rep[1]); return t; }
NC.TexLib = {
  get(name, o = {}) { const key = name + JSON.stringify(o); if (!cache[key]) { const t0 = performance.now(); cache[key] = GEN[name](o); cache[key]._ms = performance.now() - t0; } return cache[key]; },
  /* PBR 머티리얼: NC.mat.pbr('marble', { repeat:[12,10], color, roughness, metalness, gen:{a,b} }) */
  material(name, o = {}) {
    const set = this.get(name, o.gen || {}), rep = o.repeat || [1, 1];
    const m = new T.MeshStandardMaterial({ roughness: o.roughness ?? 1, metalness: o.metalness ?? 0, envMapIntensity: o.env ?? 1, side: o.side || T.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
    m.color = NC.col(o.color || '#ffffff');
    if (set.map) m.map = texFrom(set.map, true, rep);
    if (set.normal) { m.normalMap = texFrom(set.normal, false, rep); const ns = o.normalScale ?? 1; m.normalScale.set(ns, ns); }
    if (set.rough) m.roughnessMap = texFrom(set.rough, false, rep);
    if (o.emissive) { m.emissive = NC.col(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
    return m;
  },
  texture(name, kind, o = {}, rep) { const set = this.get(name, o); return texFrom(set[kind], kind === 'map', rep); },
};
NC.mat.pbr = (name, o) => NC.TexLib.material(name, o);

/* ───────── 볼륨 빔 · 접지 그림자 ───────── */
NC.mat.beam = (color, intensity = 1) => new T.ShaderMaterial({
  uniforms: { color: { value: NC.col(color) }, intensity: { value: intensity }, time: { value: 0 } },
  vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main(){ vT = 1.0 - uv.y; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 color; uniform float intensity, time; varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
      float fade = smoothstep(0.0, 0.06, vT) * pow(1.0 - vT, 1.25);
      float dust = 0.7 + 0.3 * sin(vW.x * 2.1 + time * 0.6) * sin(vW.y * 1.7 - time * 0.45) * sin(vW.z * 2.3 + time * 0.35);
      gl_FragColor = vec4(color * intensity * f * fade * dust, 1.0); }`,
  transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
});
const blobTex = (() => { const c = cnv(128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(.45, 'rgba(0,0,0,.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })();
const blobGeo = new T.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
const blobMat = new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false });
NC.contactShadow = (w = .9, d = .7) => { const m = new T.Mesh(blobGeo, blobMat); m.scale.set(w, 1, d); m.position.y = .012; m.renderOrder = 1; return m; };

/* ───────── 색종이 FX (환호·고득점) ───────── */
NC.fx = (() => {
  const MAX = 420, geo = new T.PlaneGeometry(.09, .05), mat = new T.MeshBasicMaterial({ side: T.DoubleSide, toneMapped: true });
  const im = new T.InstancedMesh(geo, mat, MAX); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const P = [], o = new T.Object3D(), c = new T.Color(), PAL = ['#ff4f9a', '#ffd23d', '#3de6ff', '#9be15d', '#b07cff', '#ff8a3d', '#ffffff'];
  for (let i = 0; i < MAX; i++) im.setColorAt(i, c.set('#ffffff'));
  let added = false;
  function confetti(x, y, z, n = 40) {
    if (!NC.fxConfetti) return;   // v16: 공중을 떠다니던 색종이(조명에 따라 검은 조각으로 보임) — 너무 산만해서 기본 끔
    if (!added && NC.scene) { NC.scene.add(im); added = true; }
    for (let i = 0; i < n; i++) { const p = P.length < MAX ? {} : P.shift(); const a = Math.random() * Math.PI * 2, sp = .6 + Math.random() * 1.8;
      Object.assign(p, { x, y, z, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 2.2, vz: Math.sin(a) * sp, rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - .5) * 14, sy: (Math.random() - .5) * 14, life: 2.8 + Math.random() * 1.2, col: PAL[(Math.random() * PAL.length) | 0] }); P.push(p); }
  }
  NC.tickers.push(dt => {
    if (!P.length) { im.count = 0; return; }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.life -= dt; if (p.life <= 0 || p.y < 0) { P.splice(i, 1); continue; }
      p.vy -= 2.2 * dt; p.vx *= .985; p.vz *= .985; if (p.vy < -.9) p.vy = -.9; p.x += p.vx * dt + Math.sin(p.life * 4 + i) * .004; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.sx * dt; p.ry += p.sy * dt; }
    im.count = P.length;
    P.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.rotation.set(p.rx, p.ry, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.set(p.col).multiplyScalar(1.6)); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
  });
  return { confetti };
})();
/* ───────── 환경맵 (클럽 조명 반사용) ───────── */
NC.buildEnv = (palette = ['#ff3d9a', '#3de6ff', '#ffd23d', '#9b5cff', '#fff1e0']) => {
  const es = new T.Scene(); es.background = new T.Color(0x07040c);
  const room = new T.Mesh(new T.BoxGeometry(40, 14, 40), new T.MeshBasicMaterial({ color: NC.col('#150d22'), side: T.BackSide })); es.add(room);
  const panel = (c, w, h, x, y, z, ry = 0, rx = 0, k = 4) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: NC.col(c).multiplyScalar(k), side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); es.add(m); };
  panel(palette[4], 10, 3, 0, 6.9, -6, 0, Math.PI / 2, 3.5);                 // 천장 워시
  panel(palette[0], 16, 1, -10, 3, -19.9, 0, 0, 5); panel(palette[1], 16, 1, 10, 3, -19.9, 0, 0, 5);
  panel(palette[2], 8, 5, 0, 4, -19.8, 0, 0, 2.2);                          // LED 월
  panel(palette[3], 1, 30, -19.9, 4, 0, Math.PI / 2, 0, 3); panel(palette[1], 1, 30, 19.9, 4, 0, -Math.PI / 2, 0, 3);
  panel(palette[0], 30, .6, 0, 1, 19.9, Math.PI, 0, 3);
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; panel(palette[i % 5], .5, .5, Math.cos(a) * 12, 6.8, Math.sin(a) * 12, 0, Math.PI / 2, 8); }
  const pm = new T.PMREMGenerator(R); const rt = pm.fromScene(es, .035); pm.dispose(); return rt.texture;
};

/* ───────── 평면 반사 (고화질 전용) ─────────
 * 바닥 위에 가산 블렌딩 평면을 깔고, 매 프레임 거울 카메라로 반쪽 해상도 반사를 그림 → 광택 대리석에 조명·인물이 비침 */
NC.preRender = [];
const LABEL_LAYER = 1; if (NC.camera) NC.camera.layers.enable(LABEL_LAYER); NC.LABEL_LAYER = LABEL_LAYER;
NC.reflector = (w, d, o = {}) => {
  if (Q.level !== 'high') return null;
  const rt = new T.WebGLRenderTarget(2, 2, { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
  const texMat = new T.Matrix4(), mcam = new T.PerspectiveCamera();
  const noise = NC.TexLib.texture('marble', 'rough', o.gen || { a: '#1d1826', b: '#6f6488' }, [12, 10]);
  const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { tRefl: { value: rt.texture }, texMat: { value: texMat }, strength: { value: o.strength ?? .32 }, tNoise: { value: noise } },
    vertexShader: `uniform mat4 texMat; varying vec4 vR; varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vR = texMat * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D tRefl, tNoise; uniform float strength; varying vec4 vR; varying vec3 vW; varying vec2 vUv;
      void main(){ float rough = texture2D(tNoise, vUv * vec2(12.0, 10.0)).r; if (rough > 0.8) discard;           // 줄눈은 반사 없음
        vec2 j = vec2(rough - 0.2) * 0.012 * vR.w; vec3 c = texture2DProj(tRefl, vR + vec4(j, 0.0, 0.0)).rgb;
        c += texture2DProj(tRefl, vR + vec4(-j.y, j.x, 0.0, 0.0) * 1.6).rgb; c *= 0.5;
        vec3 v = normalize(cameraPosition - vW); float fr = 0.35 + 0.65 * pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
        gl_FragColor = vec4(c * strength * fr * (1.0 - rough * 1.2), 1.0); }` });
  const mesh = new T.Mesh(new T.PlaneGeometry(w, d), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.y = o.y ?? .006; mesh.renderOrder = -1;
  const P0 = new T.Vector3(), N = new T.Vector3(0, 1, 0), cp = new T.Vector3(), view = new T.Vector3(), tgt = new T.Vector3(), rot = new T.Matrix4(), look = new T.Vector3(), sz = new T.Vector2();
  NC.preRender.push((scene, cam) => {
    if (!mesh.parent || !mesh.visible) return;
    R.getDrawingBufferSize(sz); const w2 = Math.max(2, sz.x >> 1), h2 = Math.max(2, sz.y >> 1); if (rt.width !== w2 || rt.height !== h2) rt.setSize(w2, h2);
    mesh.updateMatrixWorld(); P0.setFromMatrixPosition(mesh.matrixWorld); cp.setFromMatrixPosition(cam.matrixWorld);
    view.subVectors(P0, cp); if (view.dot(N) > 0) return; view.reflect(N).negate().add(P0);
    rot.extractRotation(cam.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cp); tgt.subVectors(P0, look).reflect(N).negate().add(P0);
    mcam.position.copy(view); mcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(N); mcam.lookAt(tgt); mcam.far = cam.far; mcam.near = cam.near; mcam.updateMatrixWorld(); mcam.projectionMatrix.copy(cam.projectionMatrix); mcam.layers.set(0);
    texMat.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1); texMat.multiply(mcam.projectionMatrix); texMat.multiply(mcam.matrixWorldInverse); texMat.multiply(mesh.matrixWorld);
    mesh.visible = false; const sh = R.shadowMap.autoUpdate; R.shadowMap.autoUpdate = false; R.setRenderTarget(rt); R.clear(); R.render(scene, mcam); R.shadowMap.autoUpdate = sh; mesh.visible = true;
  });
  return mesh;
};
/* ───────── HDR 후처리 파이프라인 ───────── */
const quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new T.Scene(), quad = new T.Mesh(new T.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const sm = (fs, uni) => new T.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false });
const brightMat = sm(`uniform sampler2D tDiffuse; uniform float threshold, knee; varying vec2 vUv;
  void main(){ vec3 c = min(texture2D(tDiffuse, vUv).rgb, vec3(24.0)); float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
    gl_FragColor = vec4(c * max(soft, br - threshold) / max(br, 1e-4), 1.0); }`, { tDiffuse: { value: null }, threshold: { value: 1.5 }, knee: { value: .6 } });
const downMat = sm(`uniform sampler2D tDiffuse; uniform vec2 texel; varying vec2 vUv;
  void main(){ vec4 s = texture2D(tDiffuse, vUv) * 4.0; s += texture2D(tDiffuse, vUv + vec2(-1.0,-1.0) * texel); s += texture2D(tDiffuse, vUv + vec2(1.0,-1.0) * texel);
    s += texture2D(tDiffuse, vUv + vec2(-1.0,1.0) * texel); s += texture2D(tDiffuse, vUv + vec2(1.0,1.0) * texel); gl_FragColor = s / 8.0; }`, { tDiffuse: { value: null }, texel: { value: new T.Vector2() } });
const upMat = sm(`uniform sampler2D tLow, tCur; uniform vec2 texel; uniform float curW; varying vec2 vUv;
  void main(){ vec4 s = texture2D(tLow, vUv + vec2(-2.0,0.0) * texel) + texture2D(tLow, vUv + vec2(2.0,0.0) * texel) + texture2D(tLow, vUv + vec2(0.0,-2.0) * texel) + texture2D(tLow, vUv + vec2(0.0,2.0) * texel);
    s += (texture2D(tLow, vUv + vec2(-1.0,-1.0) * texel) + texture2D(tLow, vUv + vec2(1.0,-1.0) * texel) + texture2D(tLow, vUv + vec2(-1.0,1.0) * texel) + texture2D(tLow, vUv + vec2(1.0,1.0) * texel)) * 2.0;
    gl_FragColor = s / 12.0 + texture2D(tCur, vUv) * curW; }`, { tLow: { value: null }, tCur: { value: null }, texel: { value: new T.Vector2() }, curW: { value: 1 } });
const finalMat = sm(`uniform sampler2D tScene, tBloom; uniform float bloomStr, exposure, vignette, grain, ca, time, sat, wobble; varying vec2 vUv;
  vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
  vec3 aces(vec3 c){ const mat3 IN = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
    const mat3 OUT = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
    c *= exposure / 0.6; c = IN * c; c = RRTAndODTFit(c); c = OUT * c; return clamp(c, 0.0, 1.0); }
  vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main(){ vec2 uv = vUv + vec2(sin(vUv.y * 9.0 + time * 1.3), cos(vUv.x * 7.0 + time * 1.1)) * wobble * 0.006; vec2 d = uv - 0.5; float r2 = dot(d, d); vec2 off = d * (ca + wobble * 0.02) * r2;
    vec3 c = vec3(texture2D(tScene, uv + off).r, texture2D(tScene, uv).g, texture2D(tScene, uv - off).b);
    c += texture2D(tBloom, uv).rgb * bloomStr;
    c = aces(c); float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, sat);
    c *= mix(1.0, smoothstep(0.85, 0.15, r2 * 1.9), vignette);
    float n = fract(sin(dot(vUv * 1000.0 + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; c += n * grain * (1.0 - l * 0.6);
    gl_FragColor = vec4(srgb(clamp(c, 0.0, 1.0)), 1.0); }`,
{ tScene: { value: null }, tBloom: { value: null }, bloomStr: { value: .42 }, exposure: { value: EXPOSURE }, vignette: { value: .55 }, grain: { value: .035 }, ca: { value: .014 }, time: { value: 0 }, sat: { value: 1.06 }, wobble: { value: 0 } });
if (!Q.film) { finalMat.uniforms.grain.value = 0; finalMat.uniforms.ca.value = 0; }

const gl2 = R.capabilities.isWebGL2, halfOK = gl2 ? !!(R.extensions.get('EXT_color_buffer_float') || R.extensions.get('EXT_color_buffer_half_float')) : !!(R.extensions.get('OES_texture_half_float') && R.extensions.get('EXT_color_buffer_half_float'));
const rtOpt = { type: halfOK ? T.HalfFloatType : T.UnsignedByteType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false };
const P = { w: 0, h: 0, scene: null, bright: null, down: [], up: [] }, LV = 5, size = new T.Vector2();
if (!halfOK && Q.post) brightMat.uniforms.threshold.value = .82;
function allocate(w, h) {
  [P.scene, P.bright, ...P.down, ...P.up].forEach(r => r && r.dispose()); P.w = w; P.h = h;
  if (gl2 && T.WebGLMultisampleRenderTarget) { P.scene = new T.WebGLMultisampleRenderTarget(w, h, Object.assign({}, rtOpt, { depthBuffer: true })); P.scene.samples = 4; }
  else P.scene = new T.WebGLRenderTarget(w, h, Object.assign({}, rtOpt, { depthBuffer: true }));
  let bw = Math.max(1, w >> 1), bh = Math.max(1, h >> 1); P.bright = new T.WebGLRenderTarget(bw, bh, rtOpt); P.down = []; P.up = [];
  for (let i = 0; i < LV; i++) { bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); P.down.push(new T.WebGLRenderTarget(bw, bh, rtOpt)); P.up.push(new T.WebGLRenderTarget(bw, bh, rtOpt)); }
  P.up.push(new T.WebGLRenderTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), rtOpt));
}
function pass(mat, target) { quad.material = mat; R.setRenderTarget(target); R.render(quadScene, quadCam); }
const clock0 = performance.now();
NC.post = { uniforms: finalMat.uniforms, bright: brightMat.uniforms };
NC.render = (scene, cam) => {
  NC.preRender.forEach(f => f(scene, cam));
  if (!Q.post) { R.render(scene, cam); return; }
  R.getDrawingBufferSize(size); if (size.x !== P.w || size.y !== P.h) allocate(size.x, size.y);
  R.setRenderTarget(P.scene); R.clear(); R.render(scene, cam);
  brightMat.uniforms.tDiffuse.value = P.scene.texture; pass(brightMat, P.bright);
  let src = P.bright;
  for (let i = 0; i < LV; i++) { downMat.uniforms.tDiffuse.value = src.texture; downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height); pass(downMat, P.down[i]); src = P.down[i]; }
  // 업샘플: 가장 작은 단계부터 위로 누적 (마지막은 bright 해상도)
  let low = P.down[LV - 1];
  for (let i = LV - 2; i >= -1; i--) { const cur = i >= 0 ? P.down[i] : P.bright, out = i >= 0 ? P.up[i] : P.up[LV];
    upMat.uniforms.tLow.value = low.texture; upMat.uniforms.tCur.value = cur.texture; upMat.uniforms.curW.value = i >= 0 ? .8 : .5; upMat.uniforms.texel.value.set(.5 / low.width, .5 / low.height); pass(upMat, out); low = out; }
  finalMat.uniforms.tScene.value = P.scene.texture; finalMat.uniforms.tBloom.value = low.texture; finalMat.uniforms.time.value = ((performance.now() - clock0) / 1000) % 100;
  pass(finalMat, null);
};
console.info(`[gfx] 화질 ${Q.level} · 후처리 ${Q.post ? (halfOK ? 'HDR' : 'LDR') : '끔'} · 그림자 ${Q.shadows ? '켬' : '끔'}`);
})();
