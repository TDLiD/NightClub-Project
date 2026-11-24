/* pairwalk.js — v67 💑 파트너와 함께 걷기 (손잡기 · 팔짱 · 허리 감싸 안기)
 *  ■ 부킹 상대·동반 손님이 '뒤에서 따라오던' 것을 → 내 옆에 붙어 같은 속도·같은 방향으로 함께 걷게
 *  ■ 스타일(호감도로 기본값, 대화 칩으로 바꿈)
 *     · 🤝 손잡기(52cm): 가까운 손끼리 허리 높이에서 맞잡고, 걸음에 맞춰 손이 앞뒤로 살짝 흔들림
 *     · 💞 팔짱(38cm): 내 팔은 팔꿈치를 옆으로 벌려 배 앞에, 상대 손은 내 아래팔 위에 걸침, 상대가 반 걸음 뒤
 *     · 🤗 허리 감싸 안기(34cm): 내 팔은 상대의 먼 쪽 허리, 상대 팔은 내 등 뒤, 상대 머리는 내 어깨 쪽으로 기울어짐
 *  ■ 위치는 스프링으로 따라옴(딱딱하게 붙지 않음) · 멈추면 서로 살짝 마주 보게 · 벽·가구 충돌 · 3m 넘게 떨어지면(방 이동 페이드) 바로 옆으로
 *  ■ 팔은 couple.js 2관절 IK(실제 어깨·팔 길이·상대 몸 회피) — 모션캡처 걷기 중에도 묶인 팔만 IK, 나머지 몸은 실측 걸음 그대로(mocap.js armOffL/R)
 *  ■ 쓰는 곳: VIP 룸 함께 가기(waiter.js) · 1층 VIP 문(viprooms.js) · 노래방 외출(outside.js) · 대화 칩 「💑 같이 걸어요」
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const T = NC.THREE, U = NC.util, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z), UP = V(0, 1, 0);
const GAP = { hand: .52, arm: .38, hug: .34 }, BACK = { hand: 0, arm: .06, hug: .02 };
const PACE = 1.5;   // 둘이 붙어 걷는 보통 걸음(m/s)
const NAME = { hand: '🤝 손잡기', arm: '💞 팔짱', hug: '🤗 허리 감싸 안기' };
const S = NC.PairWalk = { n: null, style: 'hand', side: 1, t: 0, w: 0, talk: false, stats: { frames: 0, ik: 0 } };
const P = () => NC.player;
const styleFor = n => n.aff >= 85 ? 'hug' : n.aff >= 70 ? 'arm' : 'hand';
const busyElse = n => { const BL = NC.Karaoke && NC.Karaoke.BL; return (BL && BL.n === n) || (NC.Motel && (NC.Motel.on || NC.Motel.busy) && NC.Motel.n === n) || n.karaoke; };

S.start = (n, style, quiet) => {
  if (!n || !n.g) return false; if (S.n && S.n !== n) S.stop(true);
  const p = P(); if (p.seat && NC.requestStand) NC.requestStand();
  const u = n.g.userData; if (u.seated || n.state === 'seated') { NC.unseatAvatar && NC.unseatAvatar(n.g, n.x, n.z); u.seated = false; }
  if (S.sp0 == null) { S.sp0 = p.speed; p.speed = Math.min(p.speed, PACE); }   // 팔짱·손잡기 중엔 자연스러운 보행 속도(혼자 뛰던 5m/s → 1.5m/s)
  S.px = S.pz = null; S.n = n; S.style = style || S.style0 || styleFor(n); S.t = 0; S.w = 0; S.talk = false; S.home = n.bookSeat || null;
  /* 상대가 내 어느 쪽에 있나(지금 서 있는 쪽 그대로 → 엇갈려 걷지 않음) */
  const rx = -Math.cos(p.ry || 0), rz = Math.sin(p.ry || 0); S.side = ((n.x - p.x) * rx + (n.z - p.z) * rz) >= 0 ? 1 : -1;
  n.prevStay = n.stay; n.stay = n.stay || 'pair'; n.state = 'escort'; n.booked = true; n.path = null; u.dance = null; u.moving = false;
  if (!quiet) NC.ui.toast(`💑 ${n.name}님과 ${NAME[S.style]} 하고 함께 걸어요`);
  return true;
};
S.setStyle = st => { if (!S.n || !GAP[st]) return; S.style = st; S.t = 0; S.w = 0; NC.ui.toast(`💑 ${NAME[st]}`); };
/* stop(keep): keep=true 면 상대 상태는 그대로 두고(방 입장 등 다른 시스템이 이어받음) 팔·플래그만 정리 */
S.stop = (keep, n0) => {
  const n = S.n; if (!n || (n0 && n0 !== n)) return; S.n = null; if (S.sp0 != null) { P().speed = S.sp0; S.sp0 = null; } const u = n.g.userData; u.armOffL = u.armOffR = false; const pu = P().group && P().group.userData; if (pu) pu.armOffL = pu.armOffR = false;
  if (n.stay === 'pair') n.stay = n.prevStay || null;
  if (keep) return;
  u.moving = false; u.lookAt = null;
  if (n.booked && S.home && NC.NPC && NC.NPC.goTo) { const s = S.home; NC.NPC.goTo(n, { x: s.pos.x, z: s.pos.z }, () => { NC.NPC.sit(n, s.pos.x, s.pos.z, s.pos.ry, s.pos.h); }, 2.4); }
  else if (n.state === 'escort') { n.state = 'wander'; n.pause = 4; n.wp = null; }
};
S.active = n => !!S.n && (!n || S.n === n);

/* ── 위치: 내 옆 목표점을 스프링으로 따라감 ── */
function follow(n, dt) {
  const p = P(), u = n.g.userData, ry = p.ry || 0, fx = Math.sin(ry), fz = Math.cos(ry), rx = -fz, rz = fx;
  const gap = GAP[S.style], tx = p.x + rx * S.side * gap - fx * BACK[S.style], tz = p.z + rz * S.side * gap - fz * BACK[S.style];
  const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
  /* 내 걸음(속도)을 그대로 함께 + 남은 차이만 스프링으로 → 걸을 때 뒤로 처지지 않음 */
  const vx = S.px == null ? 0 : (p.x - S.px), vz = S.pz == null ? 0 : (p.z - S.pz); S.px = p.x; S.pz = p.z; const jump = Math.hypot(vx, vz) > 1;
  if (d > 3 || jump) { n.x = tx; n.z = tz; }                                            // 방 이동(페이드)·순간이동 뒤: 바로 옆으로
  else { n.x += vx; n.z += vz; const ex = tx - n.x, ez = tz - n.z, k = 1 - Math.exp(-dt * 7), mx = 1.6 * dt; let sx = ex * k, sz = ez * k; const sl = Math.hypot(sx, sz); if (sl > mx) { sx *= mx / sl; sz *= mx / sl; } n.x += sx; n.z += sz; }
  if (NC.collide) NC.collide(n, .24);
  const pm = !!(p.group && p.group.userData.moving);
  u.moving = pm || Math.hypot(tx - n.x, tz - n.z) > .12;
  /* 방향: 걸을 땐 나와 같은 방향, 멈추면 내 쪽으로 25° 돌아섬(대화하듯) */
  const want = pm || d > .2 ? ry : ry - S.side * .45;
  n.g.rotation.y = U.lerpAngle(n.g.rotation.y, want, Math.min(1, dt * (pm ? 7 : 3)));
  if (!pm && S.style !== 'hug') u.lookAt = p.group.position; else if (u.lookAt === p.group.position) u.lookAt = null;
}

/* ── 팔: 실제 몸(couple.js body) 기준 IK ── */
const near = (A, B) => A.R.shL.getWorldPosition(V()).distanceTo(B.chest) < A.R.shR.getWorldPosition(V()).distanceTo(B.chest) ? 'L' : 'R';
const sideOn = (X, pt) => Math.sign(pt.clone().sub(X.chest).dot(X.tr)) || 1;   // pt 가 X 몸의 tr 기준 어느 쪽
function arms(n, dt) {
  const C = NC.Couple; if (!C || !C.ikArm || !C.bodyX) return; const pg = P().group;
  pg.updateMatrixWorld(true); n.g.updateMatrixWorld(true); const A = C.bodyX(pg), B = C.bodyX(n.g); if (!A || !B) return;
  const sdA = near(A, B), sdB = near(B, A), w = S.w, mv = pg.userData.moving ? 1 : 0, ph = S.t * 5.6;
  const ua = pg.userData, ub = n.g.userData; ua.armOffL = sdA === 'R'; ua.armOffR = sdA === 'L'; ub.armOffL = sdB === 'R'; ub.armOffR = sdB === 'L';   // rig 'L' = 아바타 오른쪽(모델 Bip01 R)
  const fwd = A.fwd.clone().setY(0).normalize();
  if (S.style === 'hand') {
    const sa = A.R['sh' + sdA].getWorldPosition(V()), sb = B.R['sh' + sdB].getWorldPosition(V());
    const m = sa.clone().lerp(sb, .5); m.y = (A.hips.y + B.hips.y) / 2 - .04 * A.sc; m.addScaledVector(fwd, .05 + Math.sin(ph) * .055 * mv);   // 맞잡은 손: 허리 높이 · 걸음에 맞춰 앞뒤로
    const toB = sb.clone().sub(sa).setY(0).normalize();
    C.ikArm(A.R, sdA, m.clone().addScaledVector(toB, -.025), w, V(0, -1, 0).addScaledVector(fwd, -.4), B);
    C.ikArm(B.R, sdB, m.clone().addScaledVector(toB, .025), w, V(0, -1, 0).addScaledVector(fwd, -.4), A);
  } else if (S.style === 'arm') {
    const out = sideOn(A, B.chest);                                                               // 상대 쪽(+1/-1, A.tr 기준)
    const hA = A.hips.clone().addScaledVector(A.tu, .2 * A.sc).addScaledVector(A.tf, A.rzF + .07 * A.sc).addScaledVector(A.tr, out * A.rx * .25);   // 내 손: 배 앞
    C.ikArm(A.R, sdA, hA, w, A.tr.clone().multiplyScalar(out).add(V(0, -.7, 0)), B);             // 팔꿈치를 상대 쪽으로 벌림 → 팔 사이 고리
    A.R['el' + sdA].updateMatrixWorld(true); const el = A.R['el' + sdA].getWorldPosition(V());
    const hB = el.clone().lerp(hA, .4).addScaledVector(UP, .035 * A.sc).addScaledVector(fwd, .02);    // 상대 손: 내 아래팔 위
    C.ikArm(B.R, sdB, hB, w, V(0, -1, 0).addScaledVector(fwd, -.6), A);
    if (C.aimHead) C.aimHead(B.R, A.head, w * .25 * (mv ? .6 : 1));
  } else {
    const fB = -sideOn(B, A.chest), fA = -sideOn(A, B.chest);                                     // 각자 '먼 쪽'
    const hA = B.hips.clone().addScaledVector(B.tu, .12 * B.sc).addScaledVector(B.tr, fB * B.rx * .95).addScaledVector(B.tf, -B.rzB * .35);   // 내 손: 상대 먼 쪽 허리
    C.ikArm(A.R, sdA, hA, w, V(0, -.6, 0).addScaledVector(fwd, -1), B);
    const hB = A.chest.clone().addScaledVector(A.tu, -.13 * A.sc).addScaledVector(A.tf, -A.rzB * 1.05).addScaledVector(A.tr, fA * A.rx * .55);   // 상대 손: 내 등 뒤
    C.ikArm(B.R, sdB, hB, w, V(0, -.6, 0).addScaledVector(fwd, -1), A);
    if (C.aimHead) { const sh = A.neck.clone().addScaledVector(A.tr, -fA * A.rx * .7); C.aimHead(B.R, sh, w * .45, -fB * .22); C.aimHead(A.R, B.head, w * .15); }
    B.R.torso.rotation.z += (-fB * .07 - 0) * w;                                                  // 상체도 살짝 내 쪽으로 기댐
  }
  S.stats.ik++;
}

NC.tickers.push(dt => {
  const n = S.n; if (!n || !dt) return; dt = Math.min(dt, .1); const p = P();
  if (!n.g.visible || n.state === 'off' || busyElse(n) || n.leftRoom) { S.stop(true); return; }
  if (n.state === 'talk') { S.talk = true; return; }                       // 대화창 열린 동안 잠깐 멈춤
  if (S.talk && n.state === 'wander') { n.state = 'escort'; } S.talk = false;  // 대화 닫히면 다시 함께
  if (n.state !== 'escort') { S.stop(true); return; }                       // 다른 시스템(블루스·앉기·모텔·경로 이동)이 가져감
  if (p.seat) { S.w = Math.max(0, S.w - dt * 3); return; }
  S.t += dt; S.w = Math.min(1, S.w + dt * 1.6);
  follow(n, dt); arms(n, dt); S.stats.frames++;
});

/* ── 대화 칩 ── */
(NC.dialogChips = NC.dialogChips || []).push((n, CHIP) => {
  const K = NC.Karaoke; if (K && K.inRoom) return; if (busyElse(n)) return;
  const mine = n.booked || (NC.Outside && NC.Outside.KS && NC.Outside.KS.comp === n) || n.aff >= 55;
  if (!mine) return;
  if (S.n === n) {
    Object.keys(GAP).forEach(st => { if (st !== S.style) CHIP(NAME[st] + '로 걷기', () => { NC.Dialog.close('bye'); S.setStyle(st); }); });
    CHIP('✋ 손 놓기', () => { NC.Dialog.close('bye'); S.stop(false); });
  } else if (!P().seat || n.booked) {
    CHIP('💑 같이 걸어요', () => {
      const st = styleFor(n), D = NC.Dialog;
      if (n.aff < 45) { D.npcSay(U.pick(['음… 그냥 옆에서 걸을게요 ㅎㅎ', '손은 아직이요~ 천천히요!']), 'shy'); return; }
      D.npcSay(st === 'hug' ? U.pick(['(허리에 팔을 두르며) 이렇게 가요 💗', '(살짝 기대며) …좋다.']) : st === 'arm' ? U.pick(['(팔짱을 끼며) 가요~ 넘어지면 책임져요 ㅎㅎ', '팔짱 껴도 되죠? ㅎㅎ']) : U.pick(['(손을 내밀며) 잃어버리면 안 되니까요 ㅎㅎ', '…손 잡을래요?']), 'shy');
      setTimeout(() => { D.close('bye'); S.start(n, st); }, 900);
    });
  }
});
NC.on && NC.on('dialog:close', n => { if (S.n === n && n.state === 'wander') n.state = 'escort'; });
console.info('[pairwalk] v67 함께 걷기 — 손잡기·팔짱·허리 감싸 안기');
})();
