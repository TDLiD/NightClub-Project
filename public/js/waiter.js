/* waiter.js — 웨이터 NPC · 팁(🪙) 부킹 · VIP 룸 매칭/안내
 *  1) 웨이터에게 E → 대화 트리(data/waiter.json): 스타일 → 성별 → 팁 단계
 *  2) match(): 후보 NPC 점수화 → 성공확률 판정 → 빈 VIP 룸 확보(온라인은 서버 잠금 roomClaim)
 *  3) 에스코트: 웨이터가 앞장서 걷고 플레이어는 자동 추적 → 룸 착석 → 상대 NPC 입장·착석 → 대화 패널(시작 호감 보너스)
 *  4) 종료: 대화 닫으면 NPC 퇴장 · 룸 잠금 해제
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, W = NC.world, Mo = NC.Motion;
let DATA = null, rep = U.store.get('nc_rep', 0);
const waiters = [];

/* ── VIP 룸 관리 ── */
const VIP = NC.VIP = {
  session: null,                                  // { room, npc, seatP, seatN }
  freeRoom() { const order = [1, 0, 2]; for (const i of order) { const v = W.vip[i]; if (!v.occ.some(Boolean) && !W.locked(i)) return i; } return -1; },
  async claim(i) { return NC.claimRoom ? NC.claimRoom(i) : true; },
  release(i) { const v = W.vip[i]; if (v) { v.occ = v.occ.map(() => null); v.champ.visible = false; } NC.releaseRoom && NC.releaseRoom(i); },
  /* 플레이어+NPC 착석 (뒷소파 가운데=플레이어, 오른쪽=NPC) */
  seatBoth(i, n) {
    const v = W.vip[i], sp = v.seats[1], sn = v.seats[2];
    v.occ[1] = 'me'; v.occ[2] = n.id;
    NC.sitPlayer({ kind: 'vip', room: i, s: 1 }, sp);
    NC.NPC.sit(n, sn.x, sn.z, sn.ry, sn.h);
    n.g.userData.lookAt = NC.player.group.position; NC.player.group.userData.lookAt = n.g.position;
  },
  /* 대화 중 "VIP 룸 갈래요?" → 둘이 같이 걸어가서 착석 */
  async moveWith(n) {
    const i = VIP.freeRoom(); if (i < 0) return NC.ui.toast('VIP 룸이 모두 사용 중이에요');
    if (!(await VIP.claim(i))) return NC.ui.toast('방금 다른 손님이 룸을 잡았어요');
    const v = W.vip[i]; NC.Dialog.npcSay(n.trait === 'cool' ? '…좋아요. 조용한 데가 낫겠네요.' : '좋아요! 가요 가요~', 'smile');
    const panelN = n;
    NC.Dialog.close('switch'); n.booked = true;
    NC.walkPlayer(NC.NPC.planPath(NC.player, v.seats[1]), () => {});
    NC.NPC.goTo(n, v.seats[2], () => { const wait = () => { if (Math.hypot(NC.player.x - v.seats[1].x, NC.player.z - v.seats[1].z) < 1.2 || !NC.player.autoPath) { VIP.seatBoth(i, n); VIP.session = { room: i, npc: n }; NC.Dialog.open(panelN, { intro: '여기 분위기 좋네요. 자, 이제 진짜 얘기해 봐요 🥂' }); } else setTimeout(wait, 300); }; wait(); });
  },
  endSession(n, reason) {
    const s = VIP.session; NC.requestStand();
    if (s && s.npc === n) { VIP.session = null;
      NC.NPC.release(n); n.booked = true; n.g.visible = true; n.enabled = true;
      NC.NPC.goTo(n, { x: (Math.random() - .5) * 10, z: -8 + Math.random() * 4 }, () => { n.booked = false; n.state = NC.isOnline() ? 'off' : 'wander'; if (NC.isOnline()) NC.NPC.show(n, false); });
      setTimeout(() => VIP.release(s.room), 2500);
      if (reason === 'ending') { rep = Math.min(10, rep + 1); U.store.set('nc_rep', rep); }
    } else if (n.state === 'seated') { NC.NPC.release(n); }
  },
};

/* ── 매칭 알고리즘 ── */
function match(style, gender, tier) {
  const adj = (DATA.adjacent || {})[style] || [];
  const pool = NC.npcs.filter(n => (n.role === 'persona' || n.role === 'crowd') && !n.booked && n.state !== 'seated' && n.state !== 'talk' && n.cool <= 0 && (gender === 'any' || n.gender === gender) && (n.enabled || NC.isOnline() && n.role === 'persona'));
  const scored = pool.map(n => {
    let s = style === 'any' ? 30 : n.trait === style ? 60 : adj.includes(n.trait) ? 20 : 0;
    s += n.role === 'persona' ? tier.personaBias * 30 : 0; s += (n.mood || 0) * 5 + rep * 2 + Math.random() * 15;
    if (Date.now() - (n.rejectedAt || 0) < 120e3) s -= 40;
    return { n, s };
  }).sort((a, b) => b.s - a.s);
  const best = scored[0];
  if (!best || best.s < 25) return { ok: false, why: 'nomatch' };
  if (Math.random() > tier.success + rep * .02) { best.n.rejectedAt = Date.now(); return { ok: false, why: 'rejected', n: best.n }; }
  return { ok: true, n: best.n, score: best.s };
}
NC.Waiter = { match, rep: () => rep };

/* ── 웨이터 아바타 ── */
function spawnWaiters() {
  DATA.waiters.forEach((w, k) => {
    const g = NC.Avatar.create({ name: w.title, look: w.look, seed: U.hash(w.id), expr: 'smile', labelColor: '#ffd23d' });
    const sp = W.spots.waiterStation; const o = { def: w, g, x: w.station ? sp.x : -12, z: w.station ? sp.z : (W.corridorY || 10.75), home: w.station ? { x: sp.x, z: sp.z } : null, state: 'idle', path: null, t: Math.random() * 10, busy: false };
    g.position.set(o.x, 0, o.z); NC.scene.add(g); waiters.push(o);
  });
}
function walk(o, pts, done, speed = 2.6) { o.path = pts.slice(); o.done = done; o.speed = speed; o.state = 'path'; }
function updateWaiters(dt, cam) {
  waiters.forEach(o => {
    const u = o.g.userData; o.t += dt;
    if (o.state === 'path') {
      const p = o.path[0];
      if (!p) { o.state = 'idle'; u.moving = false; const f = o.done; o.done = null; f && f(); }
      else { const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz); if (d < .3) o.path.shift(); else { const s = Math.min(d, o.speed * dt); o.x += dx / d * s; o.z += dz / d * s; NC.collide(o, .35); o.g.rotation.y = U.lerpAngle(o.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8)); u.moving = true; } }
    } else if (!o.busy && !o.home) {                    // 순찰 웨이터: 통로 왕복
      if (o.state === 'idle') { const tx = o.x < 0 ? 15.5 : -15.5; walk(o, [{ x: tx, z: (W.corridorY || 10.75) - .3 + Math.random() * .6 }], () => { o.state = 'wait'; o.wait = 3 + Math.random() * 5; Mo.play(o.g, 'lookAround'); }, 1.6); }
      else if (o.state === 'wait') { u.moving = false; o.wait -= dt; if (o.wait < 0) o.state = 'idle'; }
    } else { u.moving = false; if (o.home && !o.busy) { if (Math.hypot(o.home.x - o.x, o.home.z - o.z) > .5) walk(o, [o.home]); else o.g.rotation.y = U.lerpAngle(o.g.rotation.y, 0, dt * 3); } }
    const P = NC.player; if (!o.busy && P.group && Math.hypot(P.x - o.x, P.z - o.z) < 3.5) u.lookAt = P; else if (!o.busy) u.lookAt = null;
    o.g.position.set(o.x, 0, o.z);
    Mo.update(o.g, dt, { near: cam.position.distanceTo(o.g.position) < 16 }); NC.Avatar.fitLabel(o.g, cam);
  });
}

/* ── 대화 트리 실행기 ── */
function runTree(o) {
  const P = NC.player, st = { style: 'any', gender: 'any', tier: null }; const tree = DATA.tree;
  P.busy = true; P.target = null; o.busy = true; o.g.userData.lookAt = P;
  const styleLabel = () => (DATA.styles.find(s => s.id === st.style) || {}).label || '아무나';
  const sub = s => String(s).replace(/\{(\w+)\}/g, (_, k) => ({ coins: NC.Wallet.get(), style: styleLabel(), title: o.def.title, gender: st.gender }[k] ?? ''));
  const end = msg => { NC.ui.hideDlg(); P.busy = false; o.busy = false; o.g.userData.lookAt = null; if (msg) NC.ui.toast(msg); };
  const show = (id, extra = {}) => {
    const node = tree[id]; if (!node || id === 'end') return end();
    if (node.motion) Mo.play(o.g, node.motion);
    let say = extra.say || node.say; if (say === '$rooms') say = W.vip.map(v => `VIP ${v.id + 1}: ${W.locked(v.id) ? '🔒 예약됨' : v.occ.some(Boolean) ? '🟡 사용 중' : '🟢 비어 있음'}`).join('  ·  ');
    let opts = node.opts;
    if (opts === '$styles') opts = DATA.styles.map(s => ({ t: s.label, set: { style: s.id }, next: 'gender' }));
    else if (opts === '$tiers') opts = DATA.tiers.map(t => ({ t: `${t.label}  (성공률 ${Math.round(t.success * 100)}%)`, tier: t })).concat([{ t: '다음에 할게요', next: 'end' }]);
    NC.ui.showDlg({ name: o.def.title, tag: '🤵 부킹 담당', job: `단골도 ★${rep}`, say: sub(say), opts: (opts || []).map(op => ({ t: op.t, run: () => {
      if (op.set) Object.assign(st, op.set);
      if (op.tier) return book(op.tier);
      if (op.next === 'tipOnly') { if (!NC.Wallet.spend(5)) return show('noMoney'); rep = Math.min(10, rep + 1); U.store.set('nc_rep', rep); NC.Audio.sfx('coin'); }
      show(op.next || 'end');
    } })) });
  };
  async function book(tier) {
    if (NC.Wallet.get() < tier.coin) return show('noMoney');
    NC.Wallet.spend(tier.coin); NC.Audio.sfx('coin');
    show('searching'); NC.ui.showDlg({ name: o.def.title, tag: '🤵 부킹 담당', say: sub(tree.searching.say), opts: [] });
    await new Promise(r => setTimeout(r, 1600));
    const room = VIP.freeRoom();
    if (room < 0) { NC.Wallet.add(tier.coin); return show('roomsFull'); }
    const m = match(st.style, st.gender, tier);
    if (!m.ok) { NC.Wallet.add(Math.floor(tier.coin / 2)); return show('matchFail'); }
    if (!(await VIP.claim(room))) { NC.Wallet.add(tier.coin); return show('roomsFull'); }
    const n = m.n; n.booked = true;
    show('matchOk', { say: tree.matchOk.say.replace('{name}', n.name).replace('{room}', room + 1) });
    Mo.trigger(o.g, 'waiter:guide');
    await new Promise(r => setTimeout(r, 1800));
    NC.ui.hideDlg(); escort(o, room, n, tier);
  }
  show('root');
}

/* ── 에스코트: 웨이터 앞장 → 플레이어 따라옴 → 착석 → NPC 입장 ── */
function escort(o, room, n, tier) {
  const v = W.vip[room], P = NC.player;
  const route = NC.NPC.planPath(o, { x: v.cx - 1.4, z: 17.2 });
  walk(o, route, () => { o.g.rotation.y = Math.PI; Mo.play(o.g, 'point'); });
  NC.walkPlayer(NC.NPC.planPath(P, v.seats[1]), () => {
    NC.ui.fade(() => { v.occ[1] = 'me'; NC.sitPlayer({ kind: 'vip', room, s: 1 }, v.seats[1]); if (tier.champagne) v.champ.visible = true; });
    // NPC 호출: 멀리 있으면 통로에서 등장
    NC.NPC.show(n, true); n.booked = true; if (Math.hypot(n.x - v.cx, n.z - v.front.z) > 18 || NC.isOnline()) { n.x = v.cx + 4; n.z = W.corridorY || 10.75; }
    NC.NPC.goTo(n, v.seats[2], () => {
      VIP.seatBoth(room, n); VIP.session = { room, npc: n };
      n.aff = U.clamp(n.aff + tier.affBonus + (tier.champagne ? 0 : 0), 0, 100);
      Mo.trigger(o.g, 'social:bow');
      const intro = tier.champagne ? `와… 샴페인까지? 웨이터님이 엄청 칭찬하던데요. 반가워요, ${n.name}이에요 🥂` : `안녕하세요~ 웨이터님이 꼭 만나 보라고 해서요. ${n.name}이에요 😊`;
      NC.Dialog.open(n, { intro, vip: true });
      if (tier.affBonus) NC.Dialog.sys(`🤵 웨이터 팁 효과: 시작 호감도 +${tier.affBonus}${tier.champagne ? ' · 🍾 샴페인 서비스' : ''}`);
      setTimeout(() => { o.busy = false; o.state = 'idle'; if (o.home) walk(o, NC.NPC.planPath(o, o.home)); }, 2500);
    }, 3.2);
  });
}

NC.interactProviders.push(() => {
  const P = NC.player, out = []; if (P.seat || P.busy) return out;
  waiters.forEach(o => { if (o.busy) return; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < 3) out.push({ label: `🤵 ${o.def.title} 부르기 (E) · 🪙${NC.Wallet.get()}`, dist: d - .3, run: () => runTree(o) }); });
  return out;
});
NC.Waiters = { init(d) { DATA = d; spawnWaiters(); }, update: updateWaiters, list: waiters, walk, runTree, data: () => DATA };
})();
