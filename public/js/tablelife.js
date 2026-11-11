/* tablelife.js — v25 테이블 디테일
 *  ① 모든 테이블에 호출 전등(무선 테이블 램프) — 테이블에 앉아 「🔔 웨이터 호출」을 누르면 전등을 머리 위로 들고 흔듦(나이트 웨이터 부르는 방식)
 *  ② 손님이 앉아 있는 테이블에는 맥주·안주 세트(맥주 4병 · 잔 · 마른안주 · 과일 접시)가 자동으로 차려짐 — 비면 치워짐
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.tables) return;
const T = NC.THREE, M = NC.mat, S = NC.scene, Mo = NC.Motion, P = () => NC.player;
const TOP = .9;   // 테이블 상판 윗면 높이

/* ── 호출 전등 ── */
const lampShade = new T.MeshStandardMaterial({ color: 0xfff1d0, emissive: new T.Color('#ffb84a'), emissiveIntensity: 1.6, roughness: .4, transparent: true, opacity: .92 });
function makeLamp() {
  const g = new T.Group();
  const base = new T.Mesh(new T.CylinderGeometry(.07, .085, .05, 18), M.std('#d9b056', { roughness: .22, metalness: 1 })); base.position.y = .025; g.add(base);
  const stem = new T.Mesh(new T.CylinderGeometry(.018, .018, .16, 10), M.std('#d9b056', { roughness: .22, metalness: 1 })); stem.position.y = .13; g.add(stem);
  const shade = new T.Mesh(new T.CylinderGeometry(.055, .095, .12, 18, 1, true), lampShade.clone()); shade.position.y = .25; g.add(shade);
  const bulb = new T.Mesh(new T.SphereGeometry(.035, 10, 8), new T.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false })); bulb.position.y = .23; g.add(bulb);
  g.userData.shade = shade; g.userData.bulb = bulb; return g;
}
const lamps = NC.tables.map(tb => { const g = makeLamp(); g.position.set(tb.x + .1, TOP, tb.z + .42); S.add(g); g.userData.home = g.position.clone(); return g; });

/* ── 맥주·안주 세트 ── */
const brown = M.std('#5a2e0c', { roughness: .06, metalness: .3 }), green = M.std('#1f4a28', { roughness: .06, metalness: .3 }), label = M.std('#f2e6c8', { roughness: .6 });
const glass = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .03, metalness: .1, transparent: true, opacity: .3, depthWrite: false });
const beerLiq = M.std('#e8a020', { roughness: .2, emissive: '#3a2000' }), foam = M.std('#fbf6ea', { roughness: .9 }), plate = M.std('#f6f4f0', { roughness: .25 });
function makeSet(seed) {
  const g = new T.Group(), r = n => (Math.sin(seed * 97.3 + n * 13.1) + 1) / 2;
  for (let i = 0; i < 4; i++) { const a = -.6 + i * .32, b = new T.Mesh(new T.CylinderGeometry(.032, .038, .24, 10), i % 3 === 2 ? green : brown); b.position.set(-.28 + Math.cos(a) * .12, .12, -.28 + Math.sin(a) * .12); g.add(b);
    const nk = new T.Mesh(new T.CylinderGeometry(.013, .02, .07, 8), b.material); nk.position.set(b.position.x, .275, b.position.z); g.add(nk);
    const lb = new T.Mesh(new T.CylinderGeometry(.0385, .0385, .07, 10, 1, true), label); lb.position.set(b.position.x, .1, b.position.z); g.add(lb); }
  [[.36, -.1], [-.05, .38], [.12, -.42], [-.42, .12]].forEach(([x, z]) => { const gl = new T.Mesh(new T.CylinderGeometry(.035, .03, .11, 12, 1, true), glass); gl.position.set(x, .055, z); g.add(gl);
    const lq = new T.Mesh(new T.CylinderGeometry(.031, .027, .075, 12), beerLiq); lq.position.set(x, .04, z); g.add(lq); const fm = new T.Mesh(new T.CylinderGeometry(.032, .031, .015, 12), foam); fm.position.set(x, .084, z); g.add(fm); });
  // 마른안주(오징어·땅콩) 접시 + 과일 접시
  const p1 = new T.Mesh(new T.CylinderGeometry(.16, .12, .025, 20), plate); p1.position.set(.22, .013, .2); g.add(p1);
  for (let k = 0; k < 9; k++) { const sq = new T.Mesh(new T.BoxGeometry(.11, .008, .025), M.std('#e8c890', { roughness: .8 })); sq.position.set(.22 + (r(k) - .5) * .16, .03 + k * .003, .2 + (r(k + 9) - .5) * .16); sq.rotation.y = r(k + 3) * 3; g.add(sq); }
  for (let k = 0; k < 10; k++) { const nt = new T.Mesh(new T.SphereGeometry(.012, 6, 5), M.std('#a8743a', { roughness: .7 })); nt.position.set(.3 + (r(k + 20) - .5) * .08, .035, .12 + (r(k + 30) - .5) * .08); g.add(nt); }
  const p2 = new T.Mesh(new T.CylinderGeometry(.18, .13, .03, 20), plate); p2.position.set(-.18, .015, .3); g.add(p2);
  ['#ff3d5a', '#ffd23d', '#7bd33d', '#ff8a3d', '#b03dff', '#ffe0a0'].forEach((c, i) => { const f = new T.Mesh(new T.SphereGeometry(.035, 8, 6), M.std(c, { roughness: .4 })); f.position.set(-.18 + Math.cos(i) * .08, .05, .3 + Math.sin(i) * .08); f.scale.y = .7; g.add(f); });
  return g;
}
const sets = NC.tables.map(tb => { const g = makeSet(tb.id + 1); g.position.set(tb.x, TOP, tb.z); g.visible = false; S.add(g); return g; });
function occupied(tb) {
  const occ = NC.tableOcc && NC.tableOcc[tb.id]; if (occ && occ.some(v => v)) return true;
  const p = P(); if (p.seat && p.seat.kind === 'table' && p.seat.t === tb.id) return true;
  return (NC.npcs || []).some(n => n.g.visible && n.g.userData.seated && Math.abs(n.x - tb.x) < 1.6 && Math.abs(n.z - tb.z) < 1.6);
}
let occT = 0;

/* ── 전등 들고 흔들기 ── */
const WAVE = { lamp: null, t: 0, dur: 3.4 };
function waveLamp(t) {
  if (WAVE.lamp) return; const lamp = lamps[t]; if (!lamp) return; const p = P(), u = p.group.userData, hand = u.rig && u.rig.elR && (u.rig.elR.children.find(c => c.isGroup) || u.rig.elR);
  if (!hand) return; WAVE.lamp = lamp; WAVE.t = 0; WAVE.hand = hand;
  S.remove(lamp); hand.add(lamp); lamp.position.set(0, -.12, .06); lamp.rotation.set(Math.PI, 0, 0); lamp.scale.setScalar(1 / (u.figScale || 1));
  lamp.userData.shade.material.emissiveIntensity = 3.5;
  Mo.play(p.group, 'wave'); NC.bubble && NC.bubble(p.group, U_pick(['여기요~!! 🔔', '웨이터~ 여기 주문이요!', '저기요~ 여기요!']), 2);
}
const U_pick = a => a[Math.floor(Math.random() * a.length)];
function lampHome() {
  const lamp = WAVE.lamp; if (!lamp) return; if (WAVE.hand) WAVE.hand.remove(lamp); lamp.rotation.set(0, 0, 0); lamp.scale.setScalar(1); lamp.position.copy(lamp.userData.home); S.add(lamp);
  lamp.userData.shade.material.emissiveIntensity = 1.6; WAVE.lamp = null; WAVE.hand = null;
}
NC.tickers.push((dt, t) => {
  occT -= dt; if (occT <= 0) { occT = .8; NC.tables.forEach((tb, i) => { sets[i].visible = occupied(tb); }); }
  if (WAVE.lamp) { WAVE.t += dt; const k = WAVE.lamp.userData;
    k.shade.material.emissiveIntensity = 2.5 + 2 * Math.abs(Math.sin(WAVE.t * 9)); k.bulb.material.color.setHSL(.11, 1, .7 + .25 * Math.sin(WAVE.t * 9));
    if (WAVE.t > 1.1 && WAVE.t < 1.2) Mo.play(P().group, 'wave'); if (WAVE.t > 2.2 && WAVE.t < 2.3) Mo.play(P().group, 'wave');
    if (WAVE.t >= WAVE.dur || !P().seat) lampHome(); }
  else lamps.forEach((l, i) => { l.userData.bulb.material.color.setHSL(.11, 1, .72 + .06 * Math.sin(t * 2 + i)); });
});
NC.TableLife = { lamps, sets, waveLamp };
console.info(`[tablelife] 테이블 ${lamps.length}개 · 호출 전등 · 맥주·안주 세트 준비 완료`);
})();
