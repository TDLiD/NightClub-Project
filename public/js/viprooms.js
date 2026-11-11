/* viprooms.js — v25 VIP 룸 확장
 *  ■ 1층: VIP 4·5(무대 양옆 북쪽 구석) · VIP 6·7(서쪽 동 — 옛 노래방 자리)
 *  ■ 2층: 서쪽 동 앞 계단 → 층계참 「2F VIP LOUNGE」 문 → 2층 VIP 라운지(복도 · VIP 8~13)
 *  ■ 각 VIP 룸 안: karaoke.js 프라이빗 룸을 'VIP 모드'로 — 🔔 웨이터 호출(주문·부킹·팁) · 💃 부킹 여성 입장 · 💬 대화 · 🕺 부르스
 *  (기존 VIP 1~3 은 2층 발코니의 그대로)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world || !NC.Rooms || !NC.Rooms.make) return;
const T = NC.THREE, M = NC.mat, U = NC.util, col = NC.col, W = NC.world, R_ = NC.Rooms, P = () => NC.player;
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
const enterVip = (label, exit) => NC.Karaoke && NC.Karaoke.enter({ mode: 'vip', label, exit, comp: null });

/* ═════ 2층 VIP 라운지 ═════ */
const LG = R_.make('lounge2f', '✨ 2층 VIP 라운지', 200, -40, 10, 3.6, 3.4);
LG.enterMsg = '✨ 2층 VIP 라운지 — 원하는 VIP 룸(8~13) 문 앞에서 E';
const LOUNGE_DOORS = [];
{
  const carpet = M.pbr ? M.pbr('carpet', { repeat: [10, 3], roughness: 1, gen: { a: '#3a0a22', b: '#d4a24a' } }) : M.std('#3a0a22');
  const wall = M.pbr ? M.pbr('tufted', { repeat: [10, 2], color: '#2a1a40', roughness: 1 }) : M.std('#2a1a40');
  R_.shell(LG, carpet, wall, M.std('#120c1a', { roughness: .9 }));
  const gold = M.std('#d9b056', { roughness: .22, metalness: 1 });
  LG.add(new T.Mesh(box(20, .06, .06), gold), 0, 1.0, -3.55); LG.add(new T.Mesh(box(20, .06, .06), gold), 0, 1.0, 3.55);
  LG.add(new T.Mesh(box(20, .05, .05), M.emi('#ffb35a', 3)), 0, 3.25, -3.55); LG.add(new T.Mesh(box(20, .05, .05), M.emi('#ffb35a', 3)), 0, 3.25, 3.55);
  // 샹들리에 3개
  for (const x of [-6, 0, 6]) { LG.add(new T.Mesh(new T.CylinderGeometry(.02, .02, .5, 6), gold), x, 3.15, 0); const c = LG.add(new T.Mesh(new T.IcosahedronGeometry(.32, 1), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .02, metalness: .6, emissive: col('#ffeedd'), emissiveIntensity: .6, flatShading: true })), x, 2.75, 0); void c; }
  // VIP 8~13 문 (북쪽 벽)
  const colors = ['#b07cff', '#ffc46b', '#ff6fae', '#3de6ff', '#7bff9a', '#ff9a5a'];
  [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5].forEach((x, i) => {
    const no = 8 + i, c = colors[i];
    LG.add(new T.Mesh(box(1.6, 2.7, .12), gold), x, 1.35, -3.52);
    LG.add(new T.Mesh(new T.PlaneGeometry(1.3, 2.5), M.pbr ? M.pbr('tufted', { repeat: [1, 3], color: '#4a1a6a', gen: { leather: true, cells: 3 } }) : M.std('#4a1a6a')), x, 1.25, -3.45);
    LG.add(new T.Mesh(box(1.4, .05, .05), M.emi(c, 4)), x, 2.62, -3.42);
    const sg = NC.neonSign(`VIP ${no}`, 1.6, .5, { font: '900 140px Arial', color: '#fff', glow: c, ph: 220 }); sg.material.color.setScalar(2.2); sg.position.set(LG.cx + x, 3.0, LG.cz - 3.42); LG.G.add(sg);
    LOUNGE_DOORS.push({ no, x, z: -2.6 });
  });
  // 남쪽: 소파 · 미니 바 · 출입문
  for (const x of [-6, -2]) { LG.add(new T.Mesh(box(2.4, .45, .7), M.pbr ? M.pbr('leather', { repeat: [2, 1], color: '#8a6a3a', roughness: 1 }) : M.std('#8a6a3a')), x, .23, 3.0); LG.add(new T.Mesh(box(2.4, .6, .2), M.std('#8a6a3a', { roughness: .7 })), x, .7, 3.4); LG.rects.push([LG.cx + x - 1.2, LG.cz + 2.6, LG.cx + x + 1.2, LG.cz + 3.6]); }
  LG.add(new T.Mesh(box(2.2, 1.05, .6), M.std('#1a1018', { roughness: .4 })), 3.5, .53, 3.0); LG.add(new T.Mesh(box(2.3, .05, .7), gold), 3.5, 1.07, 3.0); LG.rects.push([LG.cx + 2.4, LG.cz + 2.6, LG.cx + 4.6, LG.cz + 3.6]);
  for (let k = 0; k < 5; k++) LG.add(new T.Mesh(new T.CylinderGeometry(.035, .045, .3, 10), M.std(['#1f4a28', '#6a3a10', '#e8e2da', '#5a1a2a', '#2a2a6a'][k], { roughness: .08, metalness: .3 })), 2.7 + k * .4, 1.25, 3.05);
  LG.add(new T.Mesh(box(1.8, 2.8, .12), gold), 8.5, 1.4, 3.52);
  const ex = NC.neonSign('EXIT ▼ 1F', 1.6, .45, { font: '900 110px Arial', color: '#e9fff0', glow: '#3dff8a', ph: 200 }); ex.material.color.setScalar(2.2); ex.position.set(LG.cx + 8.5, 3.0, LG.cz + 3.45); ex.rotation.y = Math.PI; LG.G.add(ex);
  LG.entry = { x: 8.5, z: 2.6, ry: Math.PI }; LG.exit = { x: 8.5, z: 2.9 };
}

/* ═════ 상호작용 ═════ */
NC.interactProviders.push(() => {
  const p = P(), out = []; if (!p.group || p.seat || p.busy || (NC.Karaoke && NC.Karaoke.inRoom)) return out;
  const cur = R_.current();
  if (!cur) {
    (W.vipDoors || []).forEach(d => { const dist = Math.hypot(p.x - d.x, p.z - d.z); if (dist < 1.7 && (p.y || 0) < 1) out.push({ label: `🚪 VIP ${d.no} 들어가기 (E) — 웨이터 호출 · 부킹`, dist: dist - .3, run: () => enterVip(`VIP ${d.no}`, { x: d.x, z: d.z, ry: d.ry, club: true }) }); });
    const l = W.spots.lounge2F; if (l) { const dist = Math.hypot(p.x - l.x, p.z - l.z); if (dist < 1.6 && (p.y || 0) > 3.5) out.push({ label: '✨ 2층 VIP 라운지 들어가기 (E)', dist: dist - .3, run: () => R_.go(LG, LG.entry) }); }
    return out;
  }
  if (cur !== LG) return out;
  const lx = p.x - LG.cx, lz = p.z - LG.cz;
  if (Math.hypot(lx - LG.exit.x, lz - LG.exit.z) < 1.5) out.push({ label: '🚪 1층 클럽으로 내려가기 (E)', dist: .4, run: () => { const l = W.spots.lounge2F; R_.go(null, { x: l.x, z: l.z - .5, ry: Math.PI, y: l.y }); } });
  LOUNGE_DOORS.forEach(d => { const dist = Math.hypot(lx - d.x, lz - d.z); if (dist < 1.4) out.push({ label: `🚪 VIP ${d.no} 들어가기 (E) — 웨이터 호출 · 부킹`, dist: dist - .3, run: () => enterVip(`VIP ${d.no} (2층)`, { x: LG.cx + d.x, z: LG.cz + d.z + .3, ry: 0 }) }); });
  return out;
});
if (NC.Audio && NC.Audio.ZONE_FX) NC.Audio.ZONE_FX.lounge2f = { lp: 1600, gain: .45, wet: .06, bass: 1, bleed: .5 };
NC.VipRooms = { lounge: LG, doors: () => W.vipDoors, enterVip };
console.info(`[viprooms] 1층 VIP ${(W.vipDoors || []).map(d => d.no).join('·')} · 2층 라운지 VIP 8~13 준비 완료`);
})();
