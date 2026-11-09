/* npc.js — NPC 런타임 (페르소나 5명 · 일반 손님 · DJ · 바텐더)
 *  상태: wander(구역 돌아다니기) · talk(플레이어와 대화) · path(경로 이동) · seated · off
 *  wander 목적지: 댄스플로어(groove) 45% · 스테이지(stageDance) 12% · 바(술 마시기) 18% · 부킹 통로 15% · 테이블 주변 10%
 *  경로: VIP 룸 출입은 '통로 앞 → 문 → 룸 입구 → 좌석' 웨이포인트를 거침. 끼이면(stuck) 다음 점으로 스킵
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, W = NC.world, Mo = NC.Motion;
const npcs = NC.npcs = [];
let crowdOn = true;

function spawn(def, role) {
  const look = def.look || { gender: def.gender, topColor: def.color, hairColor: def.hair };
  const g = NC.Avatar.create({ name: def.name, look, seed: U.hash(def.id || def.name), expr: role === 'persona' ? 'smile' : 'neutral', hiRes: role === 'persona' });
  if (def.model && NC.VRMKit && NC.VRMKit.ok) NC.VRMKit.attach(g, def.model, { tint: def.tint });
  const n = {
    id: def.id, name: def.name, def, role, persona: role === 'persona' ? def : (role === 'crowd' ? { likes: [], lines: null, pullPush: .4 } : null),
    trait: def.trait || 'outgoing', gender: (def.look && def.look.gender) || def.gender || 'f', tag: def.tag || '', job: def.job ? (role === 'persona' ? `${def.age} · ${def.job} · ${def.mbti}` : def.job) : '',
    g, x: (Math.random() - .5) * 12, z: -9 + Math.random() * 6, wp: null, pause: Math.random() * 3, state: 'wander', cool: 0,
    mood: Number.isFinite(+def.mood) ? +def.mood : ((Math.random() * 3 | 0) - 1), aff: def.baseAffinity || 40, history: [], topicHits: {}, recentDeltas: [],
    enabled: true, stuck: 0, path: null, speed: 2.1, greeted: false, rejectedAt: 0, secretsShown: {},
  };
  g.position.set(n.x, 0, n.z); NC.scene.add(g); npcs.push(n); return n;
}

function pickWaypoint() {
  const r = Math.random(), Z = W.zones;
  if (r < .45) return { x: Z.dance.x0 + .8 + Math.random() * (Z.dance.x1 - Z.dance.x0 - 1.6), z: Z.dance.z0 + .8 + Math.random() * (Z.dance.z1 - Z.dance.z0 - 1.6), act: 'dance' };
  if (r < .57) return { x: -8 + Math.random() * 16, z: -15.8 + Math.random() * 2.2, act: 'stage' };
  if (r < .75) return { x: 19.2, z: -12 + Math.random() * 13.5, act: 'bar' };
  if (r < .9) return { x: -20 + Math.random() * 40, z: 6.2 + Math.random() * 1.5, act: 'walk' };
  const t = U.pick(NC.tables); return { x: t.x + (Math.random() < .5 ? -3.2 : 3.2), z: t.z + (Math.random() - .5) * 2, act: 'idle' };
}
/* VIP 출입을 고려한 경로 계획 */
function planPath(from, to) {
  const out = [], a = W.vipAt(from.x, from.z), b = W.vipAt(to.x, to.z);
  if (a >= 0 && a !== b) { const v = W.vip[a]; out.push(v.entry, { x: v.cx, z: v.z0 }, v.front); }
  if (b >= 0 && a !== b) { const v = W.vip[b]; if (from.z < W.zones.corridor.z0 && a < 0) out.push({ x: U.clamp(from.x, -9.5, 9.5), z: 4 }); out.push(v.front, { x: v.cx, z: v.z0 }, v.entry); }
  if (W.terraceVia) out.push(...W.terraceVia(out.length ? out[out.length - 1] : from, to));
  out.push(to); return out;
}
function goTo(n, to, onArrive, speed = 2.6) { n.state = 'path'; n.path = planPath(n, to); n.onArrive = onArrive; n.speed = speed; n.stuck = 0; const u = n.g.userData; u.dance = null; u.seated = false; }

function stepToward(n, tx, tz, dt) {
  const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz), u = n.g.userData;
  if (d < .3) return true;
  const sp = Math.min(d, n.speed * dt), px = n.x, pz = n.z; n.x += dx / d * sp; n.z += dz / d * sp; NC.collide(n, .38);
  if (Math.hypot(n.x - px, n.z - pz) < sp * .3) n.stuck += dt; else n.stuck = Math.max(0, n.stuck - dt);
  u.moving = true; n.g.rotation.y = U.lerpAngle(n.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8));
  return false;
}

function update(n, dt) {
  const u = n.g.userData, P = NC.player;
  if (n.state === 'off') return;
  if (n.cool > 0) n.cool -= dt;
  if (n.state === 'wander') {
    if (n.pause > 0) {
      n.pause -= dt; u.moving = false;
      if (n.wp && n.wp.act === 'bar' && Math.random() < dt * .12) Mo.play(n.g, 'drink');
      if (n.pause <= 0) { n.wp = pickWaypoint(); n.stuck = 0; u.dance = null; u.holdGlass = false; }
    } else {
      if (!n.wp) n.wp = pickWaypoint();
      if (stepToward(n, n.wp.x, n.wp.z, dt) || n.stuck > 2.5) {
        n.pause = 4 + Math.random() * 9; u.moving = false;
        u.dance = n.wp.act === 'stage' ? 'stageDance' : n.wp.act === 'dance' ? 'groove' : null; u.holdGlass = n.wp.act === 'bar';
        if (n.wp.act === 'bar') n.g.rotation.y = Math.PI / 2;
      }
    }
    // 플레이어가 다가오면 쳐다보고, 처음엔 손 인사
    if (P.group && !P.seat) { const d = Math.hypot(P.x - n.x, P.z - n.z); if (d < 4.2) { u.lookAt = P; if (!n.greeted && d < 3.2 && n.role === 'persona') { n.greeted = true; Mo.trigger(n.g, 'social:greet'); } } else if (u.lookAt === P) u.lookAt = null; }
  } else if (n.state === 'path') {
    const tgt = n.path && n.path[0];
    if (!tgt) { u.moving = false; n.state = 'idle'; const f = n.onArrive; n.onArrive = null; f && f(n); }
    else if (stepToward(n, tgt.x, tgt.z, dt) || n.stuck > 1.2) { n.path.shift(); n.stuck = 0; }
  } else if (n.state === 'talk') { u.moving = false; u.dance = null; u.lookAt = P; const yw = Math.atan2(P.x - n.x, P.z - n.z); n.g.rotation.y = U.lerpAngle(n.g.rotation.y, yw, Math.min(1, dt * 5)); }
  else if (n.state === 'seated') { u.moving = false; }
  else { u.moving = false; }
  if (n.state !== 'seated') n.g.position.set(n.x, NC.groundY(n.x, n.z), n.z);
}

/* ── 스태프(DJ · 바텐더) ── */
const staff = [];
function addStaff(name, look, spot, base) {
  const g = NC.Avatar.create({ name, look, seed: U.hash(name), expr: 'smile' }); g.position.set(spot.x, spot.y || 0, spot.z); g.rotation.y = spot.ry || 0; g.userData.dance = base; NC.scene.add(g); staff.push(g); return g;
}

NC.NPC = {
  list: npcs, spawn, goTo, planPath,
  byId: id => npcs.find(n => n.id === id),
  personas: () => npcs.filter(n => n.role === 'persona'),
  setCrowdEnabled(on) { crowdOn = on; npcs.forEach(n => { if (n.state === 'seated' || n.booked) return; n.enabled = on; n.g.visible = on; n.state = on ? 'wander' : 'off'; }); },
  show(n, on = true) { n.enabled = on; n.g.visible = on; if (on && n.state === 'off') n.state = 'wander'; if (!on) n.state = 'off'; },
  sit(n, x, z, ry, h) { n.state = 'seated'; n.x = x; n.z = z; NC.seatAvatar(n.g, x, z, ry, h); },
  release(n) { const u = n.g.userData; NC.unseatAvatar(n.g); n.state = (crowdOn || !NC.isOnline()) ? 'wander' : 'off'; n.booked = false; n.wp = null; n.pause = 1; u.lookAt = null; u.talk = false; if (n.state === 'off') { n.g.visible = false; n.enabled = false; } },
  init(data) {
    (data.personas || []).forEach(d => spawn(d, 'persona'));
    (data.npcs || []).forEach(d => { if (d.enabled !== false) spawn(d, 'crowd'); });
    // 손님에게도 VRM 모델 배정 (npcs.json "crowdModels": [{ "model": "...", "gender": "f", "tint": {...} }], 최대 crowdModelMax 명)
    if (NC.VRMKit && NC.VRMKit.ok && Array.isArray(data.crowdModels) && data.crowdModels.length && !(NC.quality && NC.quality.level === 'low')) {
      const max = data.crowdModelMax || 6; let k = 0;
      npcs.filter(n => n.role === 'crowd').forEach(n => { if (k >= max) return; const pool = data.crowdModels.filter(m => !m.gender || m.gender === n.gender); if (!pool.length) return; const m = pool[k % pool.length]; NC.VRMKit.attach(n.g, m.model, { tint: m.tint }); k++; });
    }
    NC.DJ = addStaff('DJ 노스탤지어', { gender: 'm', hairStyle: 'curly', hairColor: '#e8e2da', top: 'jacket', topColor: '#3de6ff', bottom: 'pants', face: { glasses: true, beard: 'goatee' } }, W.spots.dj, 'groove');
    addStaff('바텐더 J', { gender: 'f', hairStyle: 'ponytail', hairColor: '#17110f', top: 'vest', topColor: '#121018', bottom: 'pants', bottomColor: '#121018' }, W.spots.bartender, null).userData.holdGlass = true;
    console.info(`[npc] 페르소나 ${data.personas ? data.personas.length : 0}명 · 손님 ${(data.npcs || []).length}명`);
  },
  update(dt, cam) {
    npcs.forEach(n => { if (!n.enabled && n.state === 'off') return; update(n, dt); const near = cam.position.distanceTo(n.g.position) < 16; Mo.update(n.g, dt, { near, speed: n.speed / 2.1 }); NC.Avatar.fitLabel(n.g, cam); });
    staff.forEach(g => { Mo.update(g, dt, { near: cam.position.distanceTo(g.position) < 16 }); NC.Avatar.fitLabel(g, cam); });
  },
};
NC.isOnline = () => NC.mode === 'online';
NC.on('music:drop', () => npcs.forEach(n => { const d = n.g.userData.dance; if (d && n.enabled) Mo.trigger(n.g, 'music:drop'); }));
NC.setNpcsEnabled = on => NC.NPC.setCrowdEnabled(on);   // 기존 API 호환
})();
