/* escort.js — v77 🤵 부킹 웨이터가 여성 손님 손을 잡고 테이블 사이를 데리고 다니는 장면
 *  ■ 웨이터 3명(명찰: 강호동 · 강쇠 · 먹쇠) — 흰 셔츠 + 검정 넥타이 + 검정 바지(wardrobe.js 'waiter_shirt', 얼굴은 남는 실사 모델)
 *  ■ 순서: 통로에서 대기 → 한가한 여성 손님에게 걸어감 → 인사 → 손을 맞잡고(couple.js 2관절 IK, 허리 높이) 나란히 걸어 테이블로
 *          → 테이블 앞에서 웨이터가 인사하며 소개 → 손님은 그 자리에서 다시 자유롭게 → 웨이터는 통로로 복귀
 *  ■ 내가 그 손님에게 말을 걸거나(대화)·블루스·다른 시스템이 데려가면 즉시 손을 놓고 중단 · 플레이어 일행(부킹 상대)은 건드리지 않음
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.THREE) return;
const T = NC.THREE, U = NC.util, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
let Mo = NC.Motion;
let W = NC.world;   /* world.js 가 이 파일보다 늦게 로드될 수 있어 입장 때 다시 잡음 */
const NAMES = [['hodong', '강호동'], ['kangsoe', '강쇠'], ['meoksoe', '먹쇠']];
const LOOK = { gender: 'm', height: 1.75, skin: '#e8bf9f', hairStyle: 'slick', hairColor: '#141010', top: 'shirt', topColor: '#f3f4f6', tie: true, bottom: 'pants', bottomColor: '#121216', shoes: 'loafers', shoeColor: '#0a0a0a' };
const LINES = { greet: ['손님~ 저쪽 테이블에서 한번 뵙고 싶다는데요 😄', '잠깐 저랑 같이 가실까요? 좋은 자리 있어요~', '오늘 물 좋은 테이블 있습니다, 모실게요!'], intro: ['형님~ 제가 모셔 왔습니다! 🙇', '자~ 인사들 나누세요 ㅎㅎ', '두 분 잘 어울리시네요~ 즐거운 시간 되세요!'], girl: ['어머, 진짜요? ㅎㅎ', '…한 번만 가 볼게요 😊', '어디요 어디? ㅋㅋ'] };
const ES = NC.Escort = { list: [], log: [] };
const female = n => n.gender === 'f' && (n.role === 'persona' || n.role === 'crowd');
const free = n => n.enabled !== false && n.g && n.g.visible && !n.booked && !n.karaoke && !n.stay && !n._dk && !n._sd && !n.drunkHelp && !n._escortBy && !['seated', 'talk', 'blues', 'karaoke', 'escort', 'party', 'off'].includes(n.state)
  && n !== (NC.Karaoke && NC.Karaoke.BL && NC.Karaoke.BL.n) && !(NC.Dialog && NC.Dialog.cur && NC.Dialog.cur.n === n) && !(NC.PairWalk && NC.PairWalk.n === n) && !W.extraZones.some(e => e.test(n.x, n.z)) && (W.vipAt ? W.vipAt(n.x, n.z) < 0 : true);
const bubble = (g, t, s = 2.6) => NC.bubble && NC.bubble(g, t, s);

function spawn() {
  W = NC.world; Mo = NC.Motion; if (!W || !W.spots || !NC.Avatar) return;
  NAMES.forEach(([id, title], i) => {
    const g = NC.Avatar.create({ name: '🤵 ' + title, look: Object.assign({}, LOOK), seed: U.hash('esc' + id), expr: 'smile', labelColor: '#ffd23d' });
    g.userData.wardrobe = 'waiter_shirt'; g.userData.outfit = 'main';
    const x = -9 + i * 9, z = (W.corridorY || 10.75) - .4; g.position.set(x, 0, z); NC.scene.add(g);
    ES.list.push({ id, title, g, x, z, state: 'idle', wait: 6 + i * 7 + Math.random() * 6, path: null, n: null, w: 0, t: 0, speed: 1.9, home: { x, z } });
  });
}
ES.walkTo = (o, to, sp) => walkTo(o, to, sp); ES.step = (o, dt) => step(o, dt);   // v79 events.js(샴페인 쇼)가 웨이터를 잠깐 빌려 씀 — state 'show' 동안은 이 파일의 상태 머신이 건드리지 않음
function walkTo(o, to, speed) { o.path = NC.NPC && NC.NPC.planPath ? NC.NPC.planPath(o, to) : [to]; if (!o.path || !o.path.length) o.path = [to]; o.speed = speed || o.speed; }
function step(o, dt) {   // 경로 따라 걷기 → 도착하면 true
  const p = o.path && o.path[0]; if (!p) { o.g.userData.moving = false; return true; }
  const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz); if (d < .3) { o.path.shift(); return !o.path.length; }
  const s = Math.min(d, o.speed * dt); o.x += dx / d * s; o.z += dz / d * s; if (NC.collide) NC.collide(o, .32);
  o.g.rotation.y = U.lerpAngle(o.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 7)); o.g.userData.moving = true; return false;
}
function release(o, why) { const n = o.n; o.n = null; o.w = 0; const ug = o.g.userData; ug.armOffL = ug.armOffR = false;
  if (n) { const u = n.g.userData; u.armOffL = u.armOffR = false; if (n._escortBy === o) { n._escortBy = null; if (n.state === 'escort') n.state = 'wander'; if (n.stay === 'escortW') n.stay = null; n.booked = false; n.path = null; u.moving = false; } }
  ES.log.push([o.title, why, Date.now()]); if (ES.log.length > 40) ES.log.shift(); }
function pickTable(o) { const tb = (NC.tables || []).filter(t => Math.hypot(t.x - o.x, t.z - o.z) > 4); return tb.length ? U.pick(tb) : null; }

/* 손님: 웨이터 옆(오른쪽 52cm)을 스프링으로 따라옴 + 같은 방향 */
function follow(o, dt) {
  const n = o.n, u = n.g.userData, ry = o.g.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry), rx = -fz, rz = fx, side = o.side || 1;
  const tx = o.x + rx * side * .52, tz = o.z + rz * side * .52, dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
  if (d > 3) { n.x = tx; n.z = tz; } else { const k = 1 - Math.exp(-dt * 6), mx = 2.2 * dt; let sx = dx * k, sz = dz * k; const sl = Math.hypot(sx, sz); if (sl > mx) { sx *= mx / sl; sz *= mx / sl; } n.x += sx; n.z += sz; }
  if (NC.collide) NC.collide(n, .24);
  n.g.position.set(n.x, NC.groundY ? NC.groundY(n.x, n.z) : 0, n.z); u.moving = o.g.userData.moving || d > .14;
  n.g.rotation.y = U.lerpAngle(n.g.rotation.y, o.g.userData.moving ? ry : Math.atan2(o.x - n.x, o.z - n.z), Math.min(1, dt * 6));
}
/* 손: pairwalk 의 '손잡기'와 같은 방식 — 가까운 쪽 손끼리 허리 높이에서, 걸음에 맞춰 앞뒤로 */
function hands(o, dt) {
  const C = NC.Couple, n = o.n; if (!C || !C.ikArm || !C.bodyX) return; o.g.updateMatrixWorld(true); n.g.updateMatrixWorld(true);
  const A = C.bodyX(o.g), B = C.bodyX(n.g); if (!A || !B) return;
  const nearS = (X, Y) => X.R.shL.getWorldPosition(V()).distanceTo(Y.chest) < X.R.shR.getWorldPosition(V()).distanceTo(Y.chest) ? 'L' : 'R', sdA = nearS(A, B), sdB = nearS(B, A);
  const ua = o.g.userData, ub = n.g.userData; ua.armOffL = sdA === 'R'; ua.armOffR = sdA === 'L'; ub.armOffL = sdB === 'R'; ub.armOffR = sdB === 'L';
  const fwd = A.fwd.clone().setY(0).normalize(), sa = A.R['sh' + sdA].getWorldPosition(V()), sb = B.R['sh' + sdB].getWorldPosition(V()), mv = ua.moving ? 1 : 0;
  const m = sa.clone().lerp(sb, .5); m.y = (A.hips.y + B.hips.y) / 2 - .04 * A.sc; m.addScaledVector(fwd, .05 + Math.sin(o.t * 5.6) * .05 * mv);
  const toB = sb.clone().sub(sa).setY(0).normalize();
  C.ikArm(A.R, sdA, m.clone().addScaledVector(toB, -.025), o.w, V(0, -1, 0).addScaledVector(fwd, -.4), B);
  C.ikArm(B.R, sdB, m.clone().addScaledVector(toB, .025), o.w, V(0, -1, 0).addScaledVector(fwd, -.4), A);
}
const stolen = (o) => { const n = o.n; return !n || n._escortBy !== o || (NC.Dialog && NC.Dialog.cur && NC.Dialog.cur.n === n) || (NC.Karaoke && NC.Karaoke.BL && NC.Karaoke.BL.n === n) || (NC.PairWalk && NC.PairWalk.n === n) || n.karaoke || (n.stay && n.stay !== 'escortW'); };

function tick(dt) {
  if (!ES.list.length) return; const cam = NC.camera;
  ES.list.forEach(o => {
    const u = o.g.userData; o.t += dt;
    if (Mo && Mo.update && cam) { Mo.update(o.g, dt, { near: cam.position.distanceTo(o.g.position) < 16 }); NC.Avatar.fitLabel(o.g, cam); }   // 기본 자세 먼저 → 그 위에 손 IK(순서가 반대면 IK 가 덮어써짐)
    if (o.n && stolen(o)) release(o, 'stolen');
    switch (o.state) {
      case 'idle': u.moving = false; o.wait -= dt; if (o.wait <= 0) { const p = NC.player, cand = (NC.npcs || []).filter(n => female(n) && free(n) && Math.hypot(n.x - o.x, n.z - o.z) < 22 && !(p && Math.hypot(n.x - p.x, n.z - p.z) < 1.4));
          if (!cand.length) { o.wait = 5; break; } const n = U.pick(cand.slice(0, 12)); o.n = n; n._escortBy = o; n.stay = 'escortW'; n.booked = true; n.state = 'escort'; n.path = null; n.g.userData.dance = null; walkTo(o, { x: n.x, z: n.z + .7 }); o.state = 'go'; } break;
      case 'go': if (!o.n) { o.state = 'back'; break; } o.n.g.userData.moving = false; if (step(o, dt) || Math.hypot(o.n.x - o.x, o.n.z - o.z) < .9) { o.state = 'greet'; o.timer = 2.2; u.moving = false; o.g.rotation.y = Math.atan2(o.n.x - o.x, o.n.z - o.z); Mo.play && Mo.play(o.g, 'bow'); bubble(o.g, U.pick(LINES.greet)); setTimeout(() => o.n && bubble(o.n.g, U.pick(LINES.girl)), 1100); o.n.g.userData.lookAt = o.g.position; } break;
      case 'greet': o.timer -= dt; if (!o.n) { o.state = 'back'; break; } if (o.timer <= 0) { const tb = pickTable(o); if (!tb) { release(o, 'notable'); o.state = 'back'; break; }
          const rx = -Math.cos(o.g.rotation.y), rz = Math.sin(o.g.rotation.y); o.side = ((o.n.x - o.x) * rx + (o.n.z - o.z) * rz) >= 0 ? 1 : -1; o.n.g.userData.lookAt = null;
          const ang = Math.atan2(o.x - tb.x, o.z - tb.z); o.tb = tb; walkTo(o, { x: tb.x + Math.sin(ang) * 1.9, z: tb.z + Math.cos(ang) * 1.9 }, 1.25); o.state = 'escort'; } break;
      case 'escort': if (!o.n) { o.state = 'back'; break; } o.w = Math.min(1, o.w + dt * 2); { const done = step(o, dt); follow(o, dt); hands(o, dt);
          if (done) { o.state = 'intro'; o.timer = 3; u.moving = false; o.g.rotation.y = Math.atan2(o.tb.x - o.x, o.tb.z - o.z); Mo.play && Mo.play(o.g, 'bow'); bubble(o.g, U.pick(LINES.intro)); } } break;
      case 'intro': o.timer -= dt; if (o.n) { follow(o, dt); o.w = Math.max(0, o.w - dt * .8); hands(o, dt); o.n.g.userData.lookAt = null; o.n.g.rotation.y = U.lerpAngle(o.n.g.rotation.y, Math.atan2(o.tb.x - o.n.x, o.tb.z - o.n.z), Math.min(1, dt * 4)); }
        if (o.timer <= 0) { if (o.n) { const n = o.n; Mo.play && Mo.play(n.g, 'wave'); release(o, 'done'); } o.state = 'back'; walkTo(o, { x: o.x < 0 ? -9 : 9, z: (W.corridorY || 10.75) - .4 }, 1.9); } break;
      case 'back': if (step(o, dt)) { o.state = 'idle'; o.wait = 12 + Math.random() * 18; } break;
    }
    o.g.position.set(o.x, NC.groundY ? NC.groundY(o.x, o.z) : 0, o.z);
  });
}
NC.tickers.push(dt => { try { tick(dt); } catch (e) { if (!ES.err) { ES.err = String(e); console.warn('[escort]', e); } } });
ES.spawn = spawn;
{ const iv = setInterval(() => { if (NC.started && NC.scene && NC.npcs && NC.npcs.length) { clearInterval(iv); setTimeout(() => { if (!ES.list.length) spawn(); }, 2500); } }, 1000); }   // 입장 뒤 한 번
console.info('[escort] v77 부킹 웨이터(강호동·강쇠·먹쇠) 손잡고 안내');
})();
