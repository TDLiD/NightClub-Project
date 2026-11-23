/* pose.js — v61 중앙 자세 관리자 (CharacterStateValidator + AnimationRecoveryManager + 소유권/임대)
 *
 *  ■ 왜 필요한가 (원인 분석 요약)
 *   ① motion.js 가 관절을 '현재 회전 → 목표'로 보간해서, 다른 시스템(couple.js 의 체중 이동·호흡·IK, npc.js 의 고개 까딱)이
 *      매 프레임 += 로 더한 값이 1/k(≈5배)로 누적·증폭됨. 특히 골반(hips)은 motion.js 관절 목록에 없어 한 번 더해진 값이
 *      영원히 남음 → 블루스·딥 뒤에 몸 전체(다리까지)가 통째로 기운 채 걸어 다님. (v61: motion.js 를 상태 보관형 레이어로 바꿔 해결)
 *   ② 몸 전체를 눕히는 루트 회전(모텔 눕기 등)은 그걸 건 쪽이 끝낼 때만 풀렸음 — 다른 경로(체크아웃·장면 전환·취소·새로고침 직전 상태)로
 *      빠져나가면 회전이 남은 채 걸어 다님. (v61: 루트 회전·바닥 이탈은 '임대(lease)'가 있어야만 허용, 갱신이 끊기면 자동 복구)
 *   ③ 비동기 연출(대기 후 자세 변경)이 취소된 뒤에도 실행돼 새 동작을 덮어씀. (v61: motel19 의 대기는 세대 토큰으로 취소)
 *   ④ 해부학 한계 없이 더해진 값(허리·목·무릎)이 겹치면 불가능한 각도. (v61: 리타깃 직전 관절 한계 적용)
 *
 *  ■ 하는 일 (매 프레임, 모든 시스템이 자세를 만든 뒤 · 실사 모델 리타깃 직전)
 *   · 수명 주기: IDLE → TRANSITION_TO_ACTION → ACTION_ACTIVE → ACTION_COMPLETING → RETURNING_TO_NEUTRAL → NEUTRAL_VALIDATION → IDLE_RECOVERED
 *   · 검증: 루트 기울기(임대 없으면 금지) · 걷는데 기울어짐 · 바닥에서 뜸/파묻힘 · 골반/척추/목/머리/무릎 한계 · 앉은 채 걷기 · 끝난 동작 잔류
 *   · 복구: 원인(만료된 임대·남은 동작)을 해제하고 0.3초 안에 부드럽게 바로 섬 — 의도한 눕기/앉기는 임대가 살아 있는 동안 보존
 *   · 개발자 패널: ?posedebug=1 또는 관리자 🦴 버튼 (일반 사용자 화면엔 없음)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.THREE) return;
const T = NC.THREE, U = NC.util, UP = new T.Vector3(0, 1, 0), _v = new T.Vector3(), _q = new T.Quaternion(), _e = new T.Euler();
const ST = { IDLE: 'IDLE', TRANS: 'TRANSITION_TO_ACTION', ACTIVE: 'ACTION_ACTIVE', COMPLETING: 'ACTION_COMPLETING', RETURN: 'RETURNING_TO_NEUTRAL', VALID: 'NEUTRAL_VALIDATION', RECOVERED: 'IDLE_RECOVERED' };
/* 관절 한계(rig 오일러, rad) — 사람 가동 범위 안쪽으로 넉넉히 */
const LIM = { hips: [[-.45, .4], [-.7, .7], [-.32, .32]], torso: [[-.75, 1.0], [-.7, .7], [-.45, .45]], neck: [[-.55, .6], [-.8, .8], [-.4, .4]], head: [[-.6, .7], [-1.25, 1.25], [-.5, .5]], knL: [[-.05, 2.5], [-.15, .15], [-.15, .15]], knR: [[-.05, 2.5], [-.15, .15], [-.15, .15]] };
const R = new WeakMap(); let TOK = 0, LOGN = 0;
const LOG = [];   // 최근 이상 감지·복구 기록(테스트·패널용)
const now = () => performance.now();
function rec(g) { let r = R.get(g); if (!r) { r = { id: ++LOGN, state: ST.IDLE, t: now(), leases: new Map(), action: null, last: null, fixes: 0, issues: [], tilt: 0, gdy: 0 }; R.set(g, r); } return r; }
function log(g, kind, msg) { const r = rec(g), name = nameOf(g); r.fixes++; LOG.push({ t: Math.round(now()), id: r.id, name, kind, msg }); if (LOG.length > 200) LOG.shift(); if (DBG) console.info('[pose]', name, kind, msg); }
function nameOf(g) { if (NC.player && g === NC.player.group) return 'player'; const n = (NC.npcs || []).find(x => x.g === g); return n ? n.name : 'avatar'; }
function setState(r, s) { if (r.state !== s) { r.state = s; r.t = now(); } }

/* ── 임대(lease): 몸 전체 자세를 바꾸는 쪽은 매 프레임(또는 ttl 안에) 갱신해야 함 — 끊기면 자동 만료 → 복구 ── */
function claim(g, owner, kind = 'upright', ttl = .4) { const r = rec(g); const L = r.leases.get(owner); if (L) { L.until = now() + ttl * 1000; L.kind = kind; return L.tok; }
  const tok = ++TOK; r.leases.set(owner, { kind, until: now() + ttl * 1000, tok, t0: now() }); if (r.state === ST.IDLE || r.state === ST.RECOVERED) setState(r, ST.TRANS); return tok; }
function release(g, owner) { const r = R.get(g); if (!r) return; if (owner) r.leases.delete(owner); else r.leases.clear(); }
const has = (r, kind) => { for (const L of r.leases.values()) if (L.kind === kind && L.until > now()) return true; return false; };
/* 동작 세션 토큰 — 비동기 콜백이 아직 '그 동작'에 속하는지 확인 */
function begin(g, name, maxSec = 30) { const r = rec(g); const tok = ++TOK; r.action = { name, tok, t0: now(), max: maxSec * 1000 }; r.last = name; setState(r, ST.TRANS); return tok; }
function end(g, tok) { const r = R.get(g); if (!r || !r.action || (tok && r.action.tok !== tok)) return false; r.action = null; setState(r, ST.COMPLETING); return true; }
const alive = (g, tok) => { const r = R.get(g); return !!(r && r.action && r.action.tok === tok); };

/* ── 복구 ── */
function upright(g, k) { _e.setFromQuaternion(g.quaternion, 'YXZ'); const yaw = _e.y; _q.setFromEuler(_e.set(0, yaw, 0, 'YXZ')); if (k >= 1) g.quaternion.copy(_q); else g.quaternion.slerp(_q, k);
  _v.copy(UP).applyQuaternion(g.quaternion); if (_v.y > .9999) g.rotation.set(0, yaw, 0); }   // 다 섰으면 오일러를 (0, yaw, 0) 형태로 정리
/* v65 '거꾸로 보며 걷기' 버그: 쿼터니언으로 회전을 다루면 three.js 가 오일러를 (π, y, π) 같은 '같은 자세의 다른 표기'로 바꿔 둠.
 *  이동 코드는 rotation.y 만 덮어쓰므로 x=z=π 가 남으면 실제 방향이 (π − y) 로 뒤집혀 → 캐릭터가 진행 방향이 아닌 쪽(카메라 쪽)을 본 채 걸었음.
 *  몸은 똑바로 서 있어서(기울기 0) 기존 검사에 안 걸렸음 → 임대 없는 캐릭터는 x·z 표기를 항상 0 으로 정리(이동 코드가 의도한 y 유지) */
function canon(g) { const r = g.rotation; if (Math.abs(r.x) < 1e-4 && Math.abs(r.z) < 1e-4) return false; _v.copy(UP).applyQuaternion(g.quaternion); if (_v.y < .9995) return false;
  const flip = Math.abs(Math.abs(r.x) - Math.PI) < .05 && Math.abs(Math.abs(r.z) - Math.PI) < .05; if (flip) r.set(0, r.y, 0); else { _e.setFromQuaternion(g.quaternion, 'YXZ'); r.set(0, _e.y, 0); } return true; }
function recover(g, reason = 'manual', hard = false) {
  const u = g.userData, r = rec(g); r.leases.clear(); r.action = null;
  u.bAct = null; u.handTgt = null; u.cfix = null; u.ikLock = null; u.handPose = null; u.footPlant = null; u.swayOff = null;
  if (u.seated && !(NC.player && g === NC.player.group && NC.player.seat)) { const n = (NC.npcs || []).find(x => x.g === g); if (!n || n.state !== 'seated') NC.unseatAvatar(g); }
  if (hard) { upright(g, 1); g.position.y = gy(g); if (u.mp) for (const j of ['hips', 'torso', 'neck', 'head']) if (u.mp[j]) u.mp[j] = [0, 0, 0]; if (u.real) { u.real.fp = null; if (u.real.sep) u.real.sep.set(0, 0, 0); } }
  setState(r, ST.RETURN); log(g, hard ? 'hard-reset' : 'recover', reason);
}
const gy = g => { const p = g.position; return NC.groundY ? NC.groundY(p.x, p.z) : 0; };

/* ── 검증 + 복구 (한 캐릭터) ── */
function check(g, dt, inBlues) {
  const u = g.userData; if (!u || !u.rig) return; const r = rec(g), t = now(), issues = [];
  for (const [o, L] of r.leases) if (L.until < t) { r.leases.delete(o); if (L.kind !== 'upright') log(g, 'lease-expired', `${o}(${L.kind}) 갱신 끊김 → 복구`); }
  if (r.action && t - r.action.t0 > r.action.max) { log(g, 'watchdog', `${r.action.name} ${Math.round(r.action.max / 1000)}초 초과 → 강제 종료`); r.action = null; setState(r, ST.COMPLETING); }
  if (u.bAct && (t - u.bAct.t0) / 1000 > u.bAct.dur + 1.5) { u.bAct = null; issues.push('stale-bAct'); log(g, 'stale', '끝난 블루스 동작이 남아 있음 → 해제'); }
  const lying = has(r, 'lying'), custom = has(r, 'custom'), seatedOK = !!u.seated;
  /* 1) 루트 기울기 */
  _v.copy(UP).applyQuaternion(g.quaternion); const tilt = Math.acos(U.clamp(_v.y, -1, 1)); r.tilt = tilt;
  if (tilt > .015 && !lying && !custom) { const fast = u.moving || tilt > 1; upright(g, 1 - Math.exp(-dt * (fast ? 22 : 10))); if (!r._tiltLogged) { r._tiltLogged = true; issues.push('root-tilt'); log(g, 'root-tilt', `임대 없는 루트 기울기 ${(tilt * 57.3).toFixed(0)}°${u.moving ? ' (걷는 중)' : ''} → 바로 세움`); } }
  else if (tilt < .01) r._tiltLogged = false;
  if (!lying && !custom && canon(g) && !r._canLogged) { r._canLogged = true; log(g, 'yaw-flip', '회전 표기(π,y,π) 정리 → 진행 방향을 보고 걷게'); }
  /* 2) 바닥 — 눕기·자유 연출 임대가 없는데 뜨거나 파묻힘 */
  const dy = g.position.y - gy(g); r.gdy = dy;
  if (!lying && !custom && Math.abs(dy) > .06 && !(NC.player && g === NC.player.group && (NC.player.y || 0) > .05)) { g.position.y -= dy * (1 - Math.exp(-dt * 12)); if (!r._gLogged) { r._gLogged = true; issues.push('ground'); log(g, 'ground', `바닥에서 ${dy.toFixed(2)}m → 다시 디딤`); } }
  else if (Math.abs(dy) < .02) r._gLogged = false;
  /* 3) 앉은 채 걷기 */
  if (u.seated && u.moving) { NC.unseatAvatar(g); issues.push('seated-moving'); log(g, 'seated-moving', '앉은 자세로 이동 → 일어섬'); }
  /* 4) 관절 한계(다른 시스템이 더한 값까지 포함한 최종값) */
  const Rg = u.rig; for (const j in LIM) { const b = Rg[j]; if (!b) continue; const rr = b.rotation, l = LIM[j]; const x = U.clamp(rr.x, l[0][0], l[0][1]), y = U.clamp(rr.y, l[1][0], l[1][1]), z = U.clamp(rr.z, l[2][0], l[2][1]); if (x !== rr.x || y !== rr.y || z !== rr.z) { rr.set(x, y, z); r.clamped = (r.clamped || 0) + 1; } }
  /* 5) 수명 주기 */
  const busy = inBlues || !!r.action || !!u.bAct || lying || custom || [...r.leases.values()].some(L => L.until > t);
  if (busy) { if (r.state !== ST.ACTIVE && (r.state !== ST.TRANS || t - r.t > 250)) setState(r, ST.ACTIVE); }
  else if (r.state === ST.ACTIVE || r.state === ST.TRANS) setState(r, ST.COMPLETING);
  else if (r.state === ST.COMPLETING && t - r.t > 150) setState(r, ST.RETURN);
  else if (r.state === ST.RETURN && t - r.t > 350) setState(r, ST.VALID);
  else if (r.state === ST.VALID) { const ok = tilt < .02 && Math.abs(dy) < .06 && Math.abs(Rg.hips.rotation.x) < .2 && Math.abs(Rg.hips.rotation.z) < .2; if (ok) setState(r, ST.RECOVERED); else if (t - r.t > 1500) recover(g, '중립 검증 실패', true); }
  else if (r.state === ST.RECOVERED && t - r.t > 2000) setState(r, ST.IDLE);
  r.issues = issues;
}
let DBG = /[?&]posedebug=1/.test(location.search);
function tick(dt) {
  if (!dt) return; dt = Math.min(dt, .25); const K = NC.Karaoke, BL = K && K.BL, P = NC.player;
  if (P && P.group) check(P.group, dt, !!(BL && BL.n));
  const list = NC.npcs || []; for (let i = 0; i < list.length; i++) { const n = list[i]; if (!n.g || !n.g.visible || n.state === 'off') continue; check(n.g, dt, !!(BL && BL.n === n)); }
  if (panelOn) drawPanel();
}
addEventListener('load', () => NC.tickers.push(tick));   // 다른 시스템(커플 IK·모텔 연출) 뒤 · humanglb 리타깃(로드 시 등록, 이 파일보다 뒤에 로드) 앞
/* 로그인·새로고침·장면 전환: 이전 세션의 임시 자세를 새 세션으로 가져가지 않음 */
const fresh = why => { const P = NC.player; if (P && P.group) recover(P.group, why, true); };
if (NC.on) { NC.on('start', () => fresh('login/start')); }
let lastArea = null; NC.tickers.push(() => { const a = NC.player && (NC.player.zone || '') + ':' + ((NC.Rooms && NC.Rooms.cur && NC.Rooms.cur.id) || ''); if (a !== lastArea) { if (lastArea != null) { const P = NC.player, r = R.get(P.group); if (r) for (const [o, L] of r.leases) if (L.kind !== 'upright') r.leases.delete(o); } lastArea = a; } });

/* ── 개발자 패널 ── */
let panelOn = DBG, pane = null, pAcc = 0;
function drawPanel() {
  if (!pane) { pane = document.createElement('div'); pane.id = 'poseDbg'; pane.style.cssText = 'position:fixed;left:8px;top:64px;z-index:9999;width:340px;max-height:70vh;overflow:auto;background:rgba(6,10,18,.92);color:#cfe;font:11px/1.35 monospace;border:1px solid #3de6ff66;border-radius:8px;padding:6px';
    pane.innerHTML = `<b style="color:#3de6ff">🦴 Pose Debug (dev)</b> <button data-p="close">✕</button><div id="pdBtns" style="display:flex;flex-wrap:wrap;gap:3px;margin:4px 0"></div><div id="pdBody"></div><div id="pdLog" style="opacity:.75;margin-top:4px"></div>`;
    const B = [['stop', '⏹ 모든 동작 중지'], ['reset', '♻ 자세 리셋'], ['neutral', '🧍 중립 서기'], ['ik', '✋ IK 해제'], ['own', '🔓 소유권 해제'], ['ground', '⬇ 바닥 재계산'], ['replay', '🔁 직전 동작 재생']];
    pane.querySelector('#pdBtns').innerHTML = B.map(([k, l]) => `<button data-p="${k}" style="font:11px sans-serif">${l}</button>`).join('');
    pane.addEventListener('click', e => { const k = e.target.dataset && e.target.dataset.p; if (!k) return; const P = NC.player, K = NC.Karaoke, all = [P.group].concat((NC.npcs || []).filter(n => n.g.visible).map(n => n.g));
      if (k === 'close') { panelOn = false; pane.remove(); pane = null; return; }
      if (k === 'stop') { try { K && K.BL && K.BL.n && K.endBlues('leave'); } catch (e2) { } try { NC.Motel && NC.Motel._x && NC.Motel._x.stopCurrent(true); } catch (e2) { } all.forEach(g => recover(g, '패널: 모든 동작 중지')); }
      if (k === 'reset') all.forEach(g => recover(g, '패널: 리셋', true));
      if (k === 'neutral') { if (P.seat) NC.requestStand(); recover(P.group, '패널: 중립', true); }
      if (k === 'ik') all.forEach(g => { const u = g.userData; u.handTgt = null; u.cfix = null; u.ikLock = null; u.handPose = null; if (NC.Couple) NC.Couple.ST.sofa = null; });
      if (k === 'own') all.forEach(g => release(g));
      if (k === 'ground') all.forEach(g => { if (!has(rec(g), 'lying')) g.position.y = gy(g); });
      if (k === 'replay') { const r = rec(P.group); if (K && K.BL && K.BL.n && r.lastAct) try { K.bluesAct(r.lastAct, { out: 'accept', d: 0, e: 'smile', line: '…' }); } catch (e2) { } } });
    document.body.appendChild(pane); }
  if ((pAcc = (pAcc + 1) % 6)) return;
  const P = NC.player, K = NC.Karaoke, BL = K && K.BL, rows = [[P.group, 'player']].concat((NC.npcs || []).filter(n => n.g.visible && (n === (BL && BL.n) || Math.hypot(n.x - P.x, n.z - P.z) < 6)).slice(0, 6).map(n => [n.g, n.name]));
  pane.querySelector('#pdBody').innerHTML = rows.map(([g, nm]) => { const r = rec(g), u = g.userData, ls = [...r.leases.entries()].map(([o, L]) => `${o}:${L.kind}`).join(',') || '-', bad = r.tilt > .02 && !has(r, 'lying');
    if (u.bAct) r.lastAct = u.bAct.k;
    return `<div style="border-top:1px solid #234;padding:2px 0;${bad ? 'color:#ff8a8a' : ''}">#${r.id} <b>${nm}</b> · ${r.state}<br>base=${u.mBase || '-'} act=${u.bAct ? u.bAct.k : '-'} seat=${u.seated ? 'Y' : 'N'} mov=${u.moving ? 'Y' : 'N'}<br>rot=(${(g.rotation.x * 57.3).toFixed(0)},${(g.rotation.y * 57.3).toFixed(0)},${(g.rotation.z * 57.3).toFixed(0)})° tilt=${(r.tilt * 57.3).toFixed(1)}° pos=(${g.position.x.toFixed(1)},${g.position.y.toFixed(2)},${g.position.z.toFixed(1)}) Δg=${r.gdy.toFixed(2)}<br>IK=${u.ikLock ? 'arm' : '-'}${u.handTgt ? '+hand' : ''}${u.cfix && Object.keys(u.cfix).length ? '+contact' : ''} lease=${ls} partner=${BL && (BL.n && (BL.n.g === g ? 'player' : g === P.group ? BL.n.name : '-')) || '-'} 검증=${bad ? '❌' : '✅'}</div>`; }).join('');
  pane.querySelector('#pdLog').innerHTML = LOG.slice(-6).reverse().map(l => `${l.name}: ${l.kind} — ${l.msg}`).join('<br>');
}
/* 관리자에게만 🦴 버튼 */
NC.tickers.push(() => { const adm = NC.account && NC.account.role === 'admin', b = document.getElementById('btnPoseDbg'), tb = document.getElementById('topbtns');
  if (adm && !b && tb) { const x = document.createElement('button'); x.id = 'btnPoseDbg'; x.className = 'ibtn'; x.textContent = '🦴'; x.title = '개발자 자세 디버그 패널'; x.onclick = () => { panelOn = !panelOn; if (!panelOn && pane) { pane.remove(); pane = null; } }; tb.insertBefore(x, tb.firstChild); }
  else if (!adm && b) { b.remove(); if (pane && !DBG) { pane.remove(); pane = null; panelOn = false; } } });

NC.Pose = { ST, claim, release, begin, end, alive, recover, validate: g => { const r = rec(g); return { state: r.state, tilt: r.tilt, groundDy: r.gdy, leases: [...r.leases.keys()], issues: r.issues }; }, LOG, rec, debug(on = true) { DBG = on; panelOn = on; } };
console.info('[pose] v61 중앙 자세 관리자 — 임대 없는 루트 기울기·바닥 이탈 자동 복구');
})();
