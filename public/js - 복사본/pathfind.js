/* pathfind.js — v9 클럽 내부 길찾기 (격자 A* + 경로 다듬기)
 *  ■ world.js 의 충돌 사각형(W.rects)·원(W.circles)을 0.35m 격자로 굽고, 캐릭터 반경만큼 부풀려 '못 가는 칸'을 만든다.
 *  ■ VIP 유리문은 다가가면 열리므로 통과 가능 칸으로 취급(잠긴 방은 클릭 단계에서 안내).
 *  ■ A*(8방향, 옥타일 휴리스틱, 이진 힙) → 시야 검사로 꺾이는 점만 남김 → 통로·계단·문을 자연스럽게 돌아 걷는다.
 *  ■ 격자는 처음 쓸 때 한 번만 생성(~10ms). 탐색 1회는 보통 1~3ms → CPU 부담 거의 없음.
 *  ■ 노래방·화장실·흡연실처럼 멀리 떨어진 별도 공간(extraZones) 안에서는 쓰지 않는다(직선 이동).
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world) return;
const W = NC.world, U = NC.util;
const CS = .35, R = .42;                      // 칸 크기, 캐릭터 반경(+여유)
let G = null;                                 // { nx, nz, x0, z0, block: Uint8Array }

function build() {
  const X = W.ROOM.x - .8, Z = W.ROOM.z - .8, x0 = -X, z0 = -Z, nx = Math.ceil(2 * X / CS) + 1, nz = Math.ceil(2 * Z / CS) + 1, block = new Uint8Array(nx * nz);
  const mark = (ax, az, bx, bz) => { const i0 = Math.max(0, Math.floor((ax - x0) / CS)), i1 = Math.min(nx - 1, Math.ceil((bx - x0) / CS)), j0 = Math.max(0, Math.floor((az - z0) / CS)), j1 = Math.min(nz - 1, Math.ceil((bz - z0) / CS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const px = x0 + i * CS, pz = z0 + j * CS; if (px >= ax && px <= bx && pz >= az && pz <= bz) block[j * nx + i] = 1; } };
  W.rects.forEach(([a, b, c, d]) => mark(a - R, b - R, c + R, d + R));
  W.circles.forEach(([cx, cz, rad]) => { const rr = rad + .05; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const px = x0 + i * CS - cx, pz = z0 + j * CS - cz; if (px * px + pz * pz < rr * rr) block[j * nx + i] = 1; } });
  // VIP 문 칸은 다시 열어 둔다 (문 사각형은 W.rects 에 없지만, 옆 유리벽을 부풀리며 막힌 가장자리를 정리)
  W.vip.forEach(v => { for (let z = v.z0 - .6; z <= v.z0 + .6; z += CS / 2) for (let x = v.cx - .7; x <= v.cx + .7; x += CS / 2) { const i = Math.round((x - x0) / CS), j = Math.round((z - z0) / CS); if (i >= 0 && j >= 0 && i < nx && j < nz) block[j * nx + i] = 0; } });
  G = { nx, nz, x0, z0, block };
  return G;
}
const cellOf = (x, z) => [U.clamp(Math.round((x - G.x0) / CS), 0, G.nx - 1), U.clamp(Math.round((z - G.z0) / CS), 0, G.nz - 1)];
const blocked = (i, j) => i < 0 || j < 0 || i >= G.nx || j >= G.nz || G.block[j * G.nx + i] === 1;
const posOf = (i, j) => ({ x: G.x0 + i * CS, z: G.z0 + j * CS });
function nearestFree(i, j, maxR = 14) {
  if (!blocked(i, j)) return [i, j];
  for (let r = 1; r <= maxR; r++) { let best = null, bd = 1e9;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r || blocked(i + di, j + dj)) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i + di, j + dj]; } }
    if (best) return best; }
  return null;
}
/* 이진 힙 */
function Heap() { const a = [], f = []; return {
  push(v, p) { a.push(v); f.push(p); let k = a.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (f[q] <= f[k]) break; [a[q], a[k]] = [a[k], a[q]]; [f[q], f[k]] = [f[k], f[q]]; k = q; } },
  pop() { const top = a[0], lv = a.pop(), lf = f.pop(); if (a.length) { a[0] = lv; f[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < a.length && f[l] < f[m]) m = l; if (r < a.length && f[r] < f[m]) m = r; if (m === k) break; [a[m], a[k]] = [a[k], a[m]]; [f[m], f[k]] = [f[k], f[m]]; k = m; } } return top; },
  get size() { return a.length; } }; }
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
let gScore = null, came = null, stamp = null, gen = 0;
function astar(s, e) {
  const N = G.nx * G.nz; if (!gScore || gScore.length !== N) { gScore = new Float32Array(N); came = new Int32Array(N); stamp = new Uint32Array(N); }
  gen++; const si = s[1] * G.nx + s[0], ei = e[1] * G.nx + e[0], h = (i, j) => { const dx = Math.abs(i - e[0]), dz = Math.abs(j - e[1]); return Math.max(dx, dz) + .4142 * Math.min(dx, dz); };
  const open = Heap(); stamp[si] = gen; gScore[si] = 0; came[si] = -1; open.push(si, h(s[0], s[1])); let it = 0;
  while (open.size && it++ < 40000) {
    const cur = open.pop(); if (cur === ei) break; const ci = cur % G.nx, cj = (cur / G.nx) | 0, cg = gScore[cur];
    for (const [di, dj, c] of DIRS) { const ni = ci + di, nj = cj + dj; if (blocked(ni, nj)) continue; if (di && dj && (blocked(ci + di, cj) || blocked(ci, cj + dj))) continue;   // 모서리 끼임 방지
      const k = nj * G.nx + ni, ng = cg + c; if (stamp[k] === gen && gScore[k] <= ng) continue; stamp[k] = gen; gScore[k] = ng; came[k] = cur; open.push(k, ng + h(ni, nj)); }
  }
  if (stamp[ei] !== gen) return null;
  const out = []; for (let k = ei; k !== -1; k = came[k]) out.push([k % G.nx, (k / G.nx) | 0]); return out.reverse();
}
function los(a, b) {   // 두 점 사이가 막힘 없이 트였는지 (격자 샘플링)
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / (CS * .45));
  for (let k = 1; k < n; k++) { const t = k / n, [i, j] = cellOf(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t); if (blocked(i, j)) return false; }
  return true;
}
const inClub = p => !W.extraZones.some(e => e.test(p.x, p.z)) && Math.abs(p.x) < W.ROOM.x + 1 && Math.abs(p.z) < W.ROOM.z + 1;

/* find(from, to) → [{x,z}, …] (마지막 점 = 실제 도착 가능 지점) · 실패 시 null */
function find(from, to, opt = {}) {
  if (!inClub(from) || !inClub(to)) return null;
  if (!G) build();
  const s = nearestFree(...cellOf(from.x, from.z), 4), e = nearestFree(...cellOf(to.x, to.z));
  if (!s || !e) return null;
  const cells = astar(s, e); if (!cells) return null;
  const pts = cells.map(([i, j]) => posOf(i, j)); pts[pts.length - 1] = blocked(...cellOf(to.x, to.z)) ? pts[pts.length - 1] : { x: to.x, z: to.z };
  // 경로 다듬기: 시야가 트인 가장 먼 점으로 건너뛴다
  const out = []; let a = { x: from.x, z: from.z }, k = 0;
  while (k < pts.length - 1) { let far = k + 1; for (let m = pts.length - 1; m > k + 1; m--) if (los(a, pts[m])) { far = m; break; } out.push(pts[far]); a = pts[far]; k = far; }
  if (!out.length) out.push(pts[pts.length - 1]);
  out.snapped = blocked(...cellOf(to.x, to.z));       // 목적지가 가구/벽 위였는지 (→ 근처 빈 자리로 보정됨)
  if (opt.exact && out.snapped) out.push({ x: to.x, z: to.z });
  return out;
}
NC.Path = { find, rebuild: build, isBlocked: (x, z) => { if (!G) build(); return blocked(...cellOf(x, z)); } };
})();
