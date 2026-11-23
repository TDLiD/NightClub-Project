/* v66 사람 사이의 상호작용(대화 행동) — 말 차례·맞장구·시선 회피·대화 짝
 *  · 플레이어 대화창: 말하지 않는 쪽은 '듣기' 모션 + 상대가 말하는 동안 1.5~4초마다 작은 끄덕임, 말이 끝나면 맞장구 끄덕임(가끔 미소)
 *  · 말하는 사람은 생각할 때 시선을 잠깐 옆·아래로 돌림(대화 연구: 말하는 쪽이 듣는 쪽보다 시선을 더 자주 피함), 강조할 때 고개 까딱
 *  · 손님끼리: 'talk' 대기 포즈 손님은 가까이 멈춰 있는 손님과 짝을 지어 마주 보고 번갈아 말함(혼자 허공에 말하지 않음)
 *  · 오버레이는 behavior.js 처럼 기본 자세 위에 그 프레임에만 더함(누적 없음) */
(() => { const U = NC.util;
const S = NC.Social = { pairs: [], stats: { pairs: 0, turns: 0, nods: 0, avert: 0 } };
let SIM = 0; const now = () => SIM,   /* 시뮬레이션 시계(프레임 dt 누적) — 느린 기기에서도 대화 길이가 프레임 기준으로 일정 */
      rnd = (a, b) => a + Math.random() * (b - a);
const talking = u => u.talkUntil && performance.now() < u.talkUntil;
const st = g => g.userData._soc || (g.userData._soc = { nodT: 0, nod: -1, avT: rnd(2, 5), av: 0, avTo: 0, avY: 0, was: false, emT: 0 });
/* 듣는 사람: 끄덕임(0.55초 동안 두 번 작게) — 상대가 말하는 중이거나 막 끝났을 때 */
function listener(g, other, t, dt) { const u = g.userData, R = u.rig, s = st(g); if (!R) return;
  const ot = talking(other.userData);
  if (ot && t > s.nodT) { s.nod = 0; s.nodT = t + rnd(1.5, 4); S.stats.nods++; }
  if (s.was && !ot) { s.nod = 0; s.nodT = t + rnd(1.5, 3); S.stats.nods++; if (u.setExpr && !u.exprUntil && Math.random() < .35) u.setExpr('smile', 1.4); }   // 말이 끝나면 맞장구
  s.was = ot;
  if (s.nod >= 0) { s.nod += dt; const k = s.nod / .55; if (k >= 1) s.nod = -1; else { const a = Math.sin(k * Math.PI * 2) * Math.sin(k * Math.PI) * .09; R.head.rotation.x += Math.max(0, a); if (R.neck) R.neck.rotation.x += Math.max(0, a) * .4; } } }
/* 말하는 사람: 시선 회피(0.7~1.4초, 옆·아래) + 강조 고개 까딱 */
function speaker(g, t, dt) { const u = g.userData, R = u.rig, s = st(g); if (!R) return;
  if (t > s.avT) { if (s.avTo) { s.avTo = 0; s.avT = t + rnd(2.2, 5); } else { s.avTo = 1; s.avY = (Math.random() < .5 ? -1 : 1) * rnd(.22, .4); s.avT = t + rnd(.7, 1.4); S.stats.avert++; } }
  s.av += (s.avTo - s.av) * Math.min(1, dt * 6);
  const tt = performance.now() / 1000, emph = Math.max(0, Math.sin(tt * 4.3)) * Math.max(0, Math.sin(tt * 1.1 + 1)) * .045;
  R.head.rotation.y += s.av * s.avY; R.head.rotation.x += s.av * .07 + emph; }
function relax(g, dt) { const s = g.userData._soc; if (!s) return; s.av += (0 - s.av) * Math.min(1, dt * 6); s.avTo = 0; if (s.av > .01 && g.userData.rig) g.userData.rig.head.rotation.y += s.av * s.avY; }
/* 대화 한 쌍(a·b = 그룹) */
function converse(a, b, t, dt) { const ua = a.userData, ub = b.userData;
  if (talking(ua)) { speaker(a, t, dt); listener(b, a, t, dt); } else relax(a, dt);
  if (talking(ub)) { speaker(b, t, dt); listener(a, b, t, dt); } else relax(b, dt);
  if (!talking(ua) && !talking(ub)) { listener(a, b, t, dt); listener(b, a, t, dt); } }
/* 플레이어 대화창 */
let dlg = null;
NC.on && NC.on('dialog:open', n => { const P = NC.player; if (!n || !P) return; dlg = n; n.g.userData.listenTo = P.group; P.group.userData.listenTo = n.g; });
NC.on && NC.on('dialog:close', n => { const P = NC.player; if (n) n.g.userData.listenTo = null; if (P) P.group.userData.listenTo = null; dlg = null; });
/* 손님끼리 짝 */
const free = n => { const u = n.g.userData, BL = NC.Karaoke && NC.Karaoke.BL; return n.g.visible && u.rig && n.state === 'wander' && n.pause > 0 && !u.moving && !u.dance && !u.bAct && !n.party && !n._pairS && !(BL && n === BL.n) && !(NC.Motel && NC.Motel.on && NC.Motel.n === n) && !(u.motion && u.motion.g); };
function form(t) { const L = NC.npcs || [], P = NC.player;
  for (const a of L) { if (a.g.userData.idlePose !== 'talk' || !free(a) || (a._socCool && t < a._socCool)) continue;
    if (P && Math.hypot(a.x - P.x, a.z - P.z) > 25) continue;
    let best = null, bd = 2.4; for (const b of L) { if (b === a || !free(b) || !!b.g.userData.seated !== !!a.g.userData.seated) continue; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < bd && d > .55) { bd = d; best = b; } }
    if (!best) { a._socCool = t + 4; continue; }
    const pr = { a, b: best, until: t + rnd(14, 36), turn: Math.random() < .5 ? a : best, next: t + rnd(.3, 1.2) }; a._pairS = best._pairS = pr; S.pairs.push(pr); S.stats.pairs++;
    for (const [x, y] of [[a, best], [best, a]]) { const u = x.g.userData; if (!u.lookAt || u.lookAt._bh) u.lookAt = { x: y.x, z: y.z, g: y.g, _soc: 1 }; u.listenTo = y.g; x.pause = Math.max(x.pause, 3); } } }
function end(pr, t) { for (const x of [pr.a, pr.b]) { const u = x.g.userData; if (u.lookAt && u.lookAt._soc) u.lookAt = null; if (u.listenTo && x !== dlg) u.listenTo = null; x._pairS = null; x._socCool = t + rnd(10, 25); } }
let acc = 0;
NC.tickers.push(dt => { if (!dt || /[?&]nosoc\b/.test(location.search)) return; dt = Math.min(dt, .1); SIM += dt; const t = now(); acc += dt;
  if (acc > .5) { acc = 0; form(t); }
  for (let i = S.pairs.length - 1; i >= 0; i--) { const pr = S.pairs[i], { a, b } = pr, ua = a.g.userData, ub = b.g.userData;
    const ok = t < pr.until && a.state === 'wander' && b.state === 'wander' && !ua.moving && !ub.moving && !ua.dance && !ub.dance && a.g.visible && b.g.visible && Math.hypot(a.x - b.x, a.z - b.z) < 2.8;
    if (!ok) { S.lastEnd = [t >= pr.until, a.state, b.state, !!ua.moving, !!ub.moving, ua.dance, ub.dance, a.g.visible && b.g.visible, +Math.hypot(a.x - b.x, a.z - b.z).toFixed(2)].join(','); end(pr, t); S.pairs.splice(i, 1); continue; }
    a.pause = Math.max(a.pause, 1); b.pause = Math.max(b.pause, 1);
    /* 몸도 상대 쪽으로 천천히(사람은 대화 상대에게 상체·발끝을 돌림) — 정면이 아니라 약간 비스듬히(V자 배치) */
    for (const [x, y, sd] of [[a, b, 1], [b, a, -1]]) { if (x.g.userData.seated) continue; const yw = Math.atan2(y.x - x.x, y.z - x.z) + sd * .18; x.g.rotation.y = U.lerpAngle(x.g.rotation.y, yw, Math.min(1, dt * 1.6)); const L = x.g.userData.lookAt; if (L && L._soc) { L.x = y.x; L.z = y.z; } }
    /* 말 차례: 한 사람 2~6초 → 0.3~0.9초 쉼 → 대개 상대(15%는 같은 사람이 이어서) */
    if (!talking(ua) && !talking(ub) && t > pr.next) { const sp = pr.turn; sp.g.userData.say(rnd(2, 6)); S.stats.turns++; pr.turn = Math.random() < .85 ? (sp === a ? b : a) : sp; pr.next = t + rnd(.3, .9);
      if (sp.g.userData.setExpr && Math.random() < .3) sp.g.userData.setExpr(Math.random() < .5 ? 'smile' : 'joy', 1.5); }
    else if (talking(ua) || talking(ub)) pr.next = Math.max(pr.next, t + rnd(.3, .9));
    converse(a.g, b.g, t, dt); }
  if (dlg && NC.player && dlg.g.visible) converse(dlg.g, NC.player.group, t, dt);
});
console.info('[social] v66 대화 행동 — 말 차례·끄덕임·시선 회피·손님끼리 대화 짝');
})();
