/* v37.js — ⑥ 상단 「📍 바로가기」(VIP 룸·화장실·흡연실·출입구·바·플로어·노래방·2층 라운지)
 *          ⑨ 노래방 · VIP 룸 · 테이블에서 부킹 상대에게 「🍶 술 한 잔 권하기」 → 10잔 이상이면 상대가 토하는 장면(코믹)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world) return;
const T = NC.THREE, U = NC.util, W = NC.world, Mo = NC.Motion;
const P = () => NC.player, K = () => NC.Karaoke, R = () => NC.Rooms;
const say = (g, t, s = 2.4) => NC.bubble && NC.bubble(g, t, s);
const myGender = () => (NC.settings && NC.settings.look && NC.settings.look.gender) || 'm';

/* ═════ ⑥ 📍 바로가기 ═════ */
const btn = document.createElement('button'); btn.className = 'ibtn'; btn.id = 'btnGo'; btn.title = '바로가기'; btn.textContent = '📍';
const tb = document.getElementById('topbtns'); if (tb) tb.insertBefore(btn, tb.firstChild); btn.style.display = 'none';
const panel = document.createElement('div'); panel.id = 'quickNav'; panel.style.display = 'none'; document.body.appendChild(panel);
NC.on && NC.on('start', () => { btn.style.display = ''; });

function leaveRooms(then) {   // 노래방·VIP 7 같은 프라이빗 룸 안이면 먼저 나온 뒤 이동
  const k = K(); if (k && k.inRoom) { k.leave(); setTimeout(then, 750); } else then();
}
function club(spot) { leaveRooms(() => R().go(null, spot)); }
const DEST = [
  ['💎', 'VIP 룸', '2층 VIP 1~3 룸 안으로', () => { const i = W.vip.findIndex(v => !W.locked(v.id) && !v.occ.some(Boolean)); const v = W.vip[i >= 0 ? i : W.vip.findIndex(q => !W.locked(q.id))] || W.vip[0]; club({ x: v.entry.x, z: v.entry.z, ry: 0, y: v.y || 0 }); }],
  ['🚻', '화장실', '내 성별 화장실 안으로', () => leaveRooms(() => R().go(myGender() === 'f' ? R().wroom : R().restroom))],
  ['🚬', '흡연실', '흡연실 안으로', () => leaveRooms(() => R().go(R().smoke, null, () => R().initSmokers && R().initSmokers()))],
  ['🚪', '출입구', '클럽 출입구 앞 (E: 밖으로)', () => club({ x: 22.2, z: W.corridorY || 10.75, ry: Math.PI / 2 })],
  ['🍸', '바', '바 카운터 앞', () => club({ x: 19.3, z: -4.8, ry: Math.PI / 2 })],
  ['💃', '플로어', '댄스플로어 · 스테이지 앞', () => club({ x: 0, z: -6.5, ry: Math.PI })],
  ['🎤', '노래방', '길 건너 별빛 노래방 로비', () => leaveRooms(() => NC.Outside && NC.Outside.goLobby ? NC.Outside.goLobby() : NC.ui.toast('노래방 건물을 아직 준비 중이에요'))],
  ['✨', '2층 라운지', 'VIP 4~7 · 2층 라운지', () => leaveRooms(() => { const L = NC.VipRooms && NC.VipRooms.lounge; if (L) R().go(L, L.entry); })],
];
panel.innerHTML = '<div class="qnHead">📍 바로가기 <button class="qnX" title="닫기">✕</button></div>' + DEST.map((d, i) => `<button class="qnBtn" data-i="${i}"><span>${d[0]}</span><b>${d[1]}</b><small>${d[2]}</small></button>`).join('');
const open = on => { panel.style.display = on ? 'grid' : 'none'; btn.classList.toggle('on', on); };
btn.onclick = e => { e.stopPropagation(); open(panel.style.display === 'none'); };
panel.querySelector('.qnX').onclick = () => open(false);
panel.addEventListener('click', e => {
  const b = e.target.closest('.qnBtn'); if (!b) return; const d = DEST[+b.dataset.i], p = P(); open(false);
  if (!p.group) return; if (NC.Games && NC.Games.active) return NC.ui.toast('미니게임이 끝난 뒤 이동할 수 있어요');
  if (p.busy && !(NC.Dialog && NC.Dialog.cur)) return NC.ui.toast('지금은 이동할 수 없어요 (이벤트 진행 중)');
  if (NC.Dialog && NC.Dialog.cur) NC.Dialog.close('bye'); if (NC.ui.dlgOpen()) { NC.ui.hideDlg(); p.busy = false; }
  NC.stopFollow && NC.stopFollow(); p.target = null; p.autoPath = null;
  NC.ui.toast(`${d[0]} ${d[1]}(으)로 이동해요`); setTimeout(d[3], 60);
});
addEventListener('pointerdown', e => { if (panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== btn) open(false); }, true);
{ const st = document.createElement('style'); st.textContent = `
#quickNav{position:fixed;top:56px;right:10px;z-index:30;display:none;grid-template-columns:repeat(2,minmax(120px,1fr));gap:6px;padding:10px;background:rgba(24,10,48,.96);border:1px solid #6b4bc0;border-radius:16px;box-shadow:0 0 24px rgba(123,61,255,.5);max-height:calc(100vh - 70px);overflow-y:auto;width:min(330px,92vw);box-sizing:border-box}
#quickNav .qnHead{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;font-weight:800;color:#ffd1ea;font-size:14px}
#quickNav .qnX{background:none;border:0;color:#fff;font-size:16px;cursor:pointer}
#quickNav .qnBtn{display:grid;grid-template-columns:28px 1fr;grid-template-rows:auto auto;align-items:center;text-align:left;gap:0 6px;padding:8px;border-radius:12px;border:1px solid #4a2d8a;background:#2c1758;color:#fff;cursor:pointer}
#quickNav .qnBtn:hover{background:linear-gradient(135deg,#ff3d9a,#7b3dff)}
#quickNav .qnBtn span{grid-row:1/3;font-size:20px;text-align:center}#quickNav .qnBtn b{font-size:13px}#quickNav .qnBtn small{font-size:10.5px;color:#cbbaf0}
#btnGo.on{background:linear-gradient(135deg,#ff3d9a,#7b3dff)}
@media (max-height:500px) and (orientation:landscape){#quickNav{top:44px;grid-template-columns:repeat(4,minmax(100px,1fr));width:min(560px,80vw)}#quickNav .qnBtn small{display:none}}
`; document.head.appendChild(st); }

/* ═════ ⑨ 술 권하기 → 10잔 이상이면 토하는 장면 ═════ */
const LIMIT = 10;
function drinkCtx(n) {
  const p = P(), k = K();
  if (k && k.inRoom) return k.mode === 'vip' ? 'VIP 룸' : '노래방';
  if (p.room >= 0 || (p.seat && p.seat.kind === 'vip') || n.session) return 'VIP 룸';
  if ((p.seat && p.seat.kind === 'table') || n.state === 'seated') return '테이블';
  return null;
}
(NC.dialogChips = NC.dialogChips || []).push((n, CHIP) => {
  const ctx = drinkCtx(n); if (!ctx || n.sick) return;
  const c = n.offered || 0;
  CHIP(`🍶 술 한 잔 권하기 (지금까지 ${c}잔)`, () => offer(n, ctx));
});
const STAGE = [
  [3, ['감사합니다~ 짠! 🥂', '오 좋아요! 원샷?', '분위기 좋다~ 한 잔 받을게요 ㅎㅎ'], 2, 'smile'],
  [6, ['어우… 벌써 몇 잔째예요? 그래도 짠!', '이거 마시면 저 노래 한 곡 해요 ㅋㅋ', '오늘 달리시네요? 좋아요 좋아!'], 1, 'laugh'],
  [8, ['(얼굴이 빨개짐) 저 진짜 취한 것 같아요… 히히 🥴', '세상이 빙글빙글 돌아요~ 히끅!', '이제 그만 줘요… 아니 한 잔만 더? ㅋㅋ'], -2, 'shy'],
  [9, ['진짜… 진짜 마지막이에요… 우웁 🤢', '속이 좀… 이상한데… 괜찮아요… 아마도…', '물… 물 좀… 아니 술 말고 물…'], -3, 'sad'],
];
function offer(n, ctx) {
  const D = NC.Dialog, c = D.cur; if (!c || c.n !== n) return;
  n.offered = (n.offered || 0) + 1; const k = n.offered;
  D.meSay(U.pick(['자~ 한 잔 받으세요! 🍶', '오늘 같은 날 한 잔 더!', '이번 잔은 원샷이에요~', '쭉 들이켜요! 짠~']));
  Mo.trigger(P().group, 'drink:cheers'); setTimeout(() => { Mo.trigger(n.g, 'drink:cheers', { silent: true }); }, 350);
  if (k >= 6 && NC.Nightlife && !n.drunk) NC.Nightlife.makeDrunk(n, 120);
  if (k >= LIMIT) { setTimeout(() => { if (!D.cur || D.cur.n !== n) return; D.npcSay('우… 우웁…!! 🤮', 'sad'); D.sys(`🤢 ${n.name}님이 ${ctx}에서 ${k}잔째… 한계를 넘었어요!`); setTimeout(() => { if (D.cur && D.cur.n === n) D.close('bye'); vomitScene(n, ctx); }, 900); }, 700); return; }
  const st = STAGE.find(s => k <= s[0]) || STAGE[STAGE.length - 1];
  setTimeout(() => { if (!D.cur || D.cur.n !== n) return; D.npcSay(U.pick(st[1]), st[3]); if (st[2]) { n.aff = U.clamp((n.aff ?? 40) + st[2], 0, 100); D.floatDelta && D.floatDelta(st[2]); } D.renderHead && D.renderHead(); D.chips && D.chips();
    if (k === 7) D.sys('⚠️ 상대가 많이 취했어요 — 더 권하면 큰일 날지도…'); }, 900);
}
/* 토하는 장면: 앉아 있으면 앉은 채로 고개 숙여, 서 있으면 허리 숙여 → 작은 물방울 + 바닥 웅덩이(잠시 뒤 사라짐) · 주변 반응 · 웨이터가 치움 */
const puddles = [];
function vomitScene(n, ctx) {
  const g = n.g, seated = !!g.userData.seated;
  n.sick = true; n.offered = 0; n.vomited = (n.vomited || 0) + 1; n.aff = U.clamp((n.aff ?? 40) - 8, 0, 100); n.cool = Math.max(n.cool || 0, 60);
  Mo.play(g, seated ? 'vomitSit' : 'vomit'); say(g, U.pick(['우욱… 🤢', '으… 속이…', '나 괜찮아… 우웩']), 2.4);
  NC.ui.toast(`🤮 ${n.name}님이 너무 많이 마셨어요! (호감도 -8)`); NC.camShake = .35;
  setTimeout(() => {
    const ry = g.rotation.y, gx = g.position.x, gz = g.position.z, gy = g.position.y || 0, hx = gx + Math.sin(ry) * .45, hz = gz + Math.cos(ry) * .45;
    const fx = new T.Group(); NC.scene.add(fx); const mat = new T.MeshStandardMaterial({ color: 0x9aa84a, roughness: .3 }), dg = new T.SphereGeometry(.022, 6, 4);
    for (let i = 0; i < 12; i++) { const d = new T.Mesh(dg, mat); d.position.set(gx + Math.sin(ry) * .25, gy + (seated ? .85 : 1.0), gz + Math.cos(ry) * .25); d.userData.v = new T.Vector3(Math.sin(ry) * .35 + (Math.random() - .5) * .3, Math.random() * .25, Math.cos(ry) * .35 + (Math.random() - .5) * .3); fx.add(d); }
    const pd = new T.Mesh(new T.CircleGeometry(.26, 18), new T.MeshStandardMaterial({ color: 0x8a9a3a, roughness: .15, transparent: true, opacity: .8 })); pd.rotation.x = -Math.PI / 2; pd.position.set(hx, gy + .012, hz); pd.scale.setScalar(.1); NC.scene.add(pd);
    puddles.push({ fx, pd, t: 0, n, helped: false });
    const k = K(), near = (k && k.inRoom ? (k.guests || []).concat(k.companion ? [k.companion] : []) : (NC.npcs || [])).filter(o => o && o !== n && o.g && o.g.visible && Math.hypot(o.g.position.x - gx, o.g.position.z - gz) < 4).slice(0, 3);
    near.forEach((o, i) => setTimeout(() => { say(o.g, U.pick(['으악!! 🤮', '어머 괜찮아?!', '야야 물 가져와!!', '헐… 대박 ㅋㅋㅋ', '그러게 적당히 마시지~']), 1.8); Mo.play(o.g, 'flinch'); }, 300 + i * 350));
    setTimeout(() => say(P().group, U.pick(['괜찮아요?! 제가 너무 권했나 봐요…', '헉… 미안해요! 물 드릴게요!', '어이쿠… 휴지! 휴지!']), 2), 900);
  }, 1200);
  setTimeout(() => { say(g, U.pick(['죄송해요… 화장실 좀 다녀올게요 ㅠㅠ', '창피해… 잠깐 바람 좀 쐴게요…', '저 오늘은 여기까지… 우웁']), 2.6); NC.ui.toast('🧻 근처에서 E: 휴지·물 건네주기 (호감도 회복) · 🧹 잠시 뒤 웨이터가 치워요'); }, 4200);
  setTimeout(() => { n.sick = false; n.tipsy = 0; }, 90000);
}
NC.tickers.push(dt => {
  for (let i = puddles.length - 1; i >= 0; i--) { const q = puddles[i]; q.t += dt;
    q.fx.children.forEach(d => { d.userData.v.y -= 9.8 * dt * .5; d.position.addScaledVector(d.userData.v, dt * 2); if (d.position.y < q.pd.position.y) d.visible = false; });
    q.pd.scale.setScalar(Math.min(1, .1 + q.t * .8)); if (q.t > 2) q.fx.visible = false;
    if (q.t > 14 && !q.cleaned) { q.cleaned = true; NC.ui.chatAdd('웨이터', U.pick(['🧹 괜찮으세요? 금방 치워 드릴게요~', '🧹 물수건이랑 꿀물 가져왔습니다! 천천히 드세요', '🧹 자자 비켜 주세요~ 깨끗하게 치울게요'])); }
    if (q.t > 16) { q.pd.material.opacity -= dt * .6; if (q.pd.material.opacity <= 0) { NC.scene.remove(q.pd); NC.scene.remove(q.fx); q.pd.geometry.dispose(); q.pd.material.dispose(); puddles.splice(i, 1); } } }
});
NC.interactProviders.push(() => { const p = P(), out = []; if (!p.group || (NC.Dialog && NC.Dialog.cur)) return out;
  puddles.forEach(q => { const n = q.n, d = Math.hypot(n.g.position.x - p.x, n.g.position.z - p.z); if (q.t < 14 && !q.helped && d < 2.6) out.push({ label: `🧻 ${n.name}에게 휴지·물 건네주기 (E)`, dist: d - .5, run: () => { q.helped = true; n.aff = U.clamp((n.aff ?? 40) + 6, 0, 100); Mo.play(p.group, 'bow'); say(n.g, U.pick(['고, 고마워요… 창피하다 ㅠㅠ', '헤헤… 착하시네요… 물 한 잔만 더…', '이 은혜는 꼭 갚을게요… 우웁']), 2.6); NC.ui.toast(`💗 ${n.name} 호감도 +6`); } }); });
  return out; });
// 대화를 열 때 아직 속이 안 좋은 상대
if (NC.Dialog && NC.Dialog.open) { const o = NC.Dialog.open.bind(NC.Dialog); NC.Dialog.open = (n, opt) => { const r = o(n, opt); if (n && n.sick) setTimeout(() => NC.Dialog.cur && NC.Dialog.cur.n === n && NC.Dialog.sys(`🤢 ${n.name}님은 아직 속이 안 좋아요 — 술은 권할 수 없어요`), 600); return r; }; }
NC.V37 = { offer, vomitScene, DEST };
console.info('[v37] 📍 바로가기 · 🍶 술 권하기(10잔 → 🤮)');
})();
