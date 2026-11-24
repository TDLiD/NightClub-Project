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
const MOBN = !!NC.isMobile, NEAR = MOBN ? 10 : 16; let lodF = 0;
let crowdOn = true;

function spawn(def, role) {
  const look = def.look || { gender: def.gender, topColor: def.color, hairColor: def.hair };
  const g = NC.Avatar.create({ name: def.name, look, seed: U.hash(def.id || def.name), expr: role === 'persona' ? 'smile' : 'neutral', hiRes: role === 'persona' });
  { // v14 개성: 주특기 춤 · 걸음걸이 · 습관 (데이터에 없으면 시드 기반 랜덤)
    const r = U.rng(U.hash((def.id || def.name) + 'pers')), pk = a => a[Math.floor(r() * a.length)], f = (look.gender || def.gender) === 'f';
    const u = g.userData; u.danceStyle = def.dance || pk(f ? ['hipSway', 'bodyRoll', 'hairFlip', 'vogue', 'hipCircle', 'disco', 'breaking', 'techno', 'shimmy'] : ['pump', 'runMan', 'disco', 'techno', 'breaking', 'robot', 'bounceRock', 'stepTouch']);
    u.walkStyle = def.walk || pk(f ? ['model', 'bouncy', 'shy', 'model', null] : ['swagger', 'bouncy', 'shy', 'swagger', null]);
    u.no19 = !!def.no19;
    if (def.wardrobe) { u.wardrobe = def.wardrobe; u.outfit = def.outfit || null; }   // v71 실사 모델 위에 입히는 옷·헤어(wardrobe.js)   // v70 실존 인물 동의 범위 밖 — 블루스·모텔 19+ 대상에서 제외(npcs.json no19)
    u.habit = def.habit || pk(['drinker', 'none', 'flirt', 'phone', 'none', 'drinker']);
    u.idlePose = def.pose && def.pose !== 'dance' ? def.pose : (def.pose ? null : pk([null, null, 'talk', 'drink', 'lean', 'pocket', null]));   // v32 대기 포즈
  }
  /* v45 VRM 은 init 의 일괄 배정(인물별 스타일 포함)에서 차례로 입힘 */
  if (def.realModel && NC.RealHuman && NC.RealHuman.ok) NC.RealHuman.pin(g, def.realModel, { skin: def.realSkin });   // v41 페르소나 고정 실사 GLB
  const n = {
    id: def.id, name: def.name, def, role, persona: role === 'persona' ? def : (role === 'crowd' ? { likes: [], lines: null, pullPush: .4 } : null),
    trait: def.trait || 'outgoing', gender: (def.look && def.look.gender) || def.gender || 'f', tag: def.tag || '', job: def.job ? (role === 'persona' ? `${def.age} · ${def.job} · ${def.mbti}` : def.job) : '',
    g, x: (Math.random() - .5) * 12, z: -9 + Math.random() * 6, wp: null, pause: Math.random() * 3, state: 'wander', cool: 0,
    mood: Number.isFinite(+def.mood) ? +def.mood : ((Math.random() * 3 | 0) - 1), aff: def.baseAffinity || 40, history: [], topicHits: {}, recentDeltas: [],
    enabled: true, stuck: 0, path: null, speed: 2.1, greeted: false, rejectedAt: 0, secretsShown: {},
  };
  if (def.always) { const Z = W.zones.dance; n.x = Z.x0 + 1 + Math.random() * (Z.x1 - Z.x0 - 2); n.z = Z.z0 + .8 + Math.random() * 1.6; n.always = true; }   // v36 입장하면 무대 앞 댄스플로어에
  g.position.set(n.x, 0, n.z); NC.scene.add(g); npcs.push(n);
  if (!crowdOn && role === 'crowd' && !def.always) { n.enabled = false; g.visible = false; n.state = 'off'; }   // 늦게 생성돼도 온라인 모드 설정을 따름
  return n;
}

function pickWaypoint(n) {
  const pz = n && n.def && n.def.pose; let r = Math.random(); const Z = W.zones;
  if (pz === 'dance') r = r < .75 ? r * .6 : r; else if (pz === 'drink') r = r < .5 ? .6 + r * .3 : r;   // v32 춤꾼은 댄스플로어, 술꾼은 바 쪽을 자주 감
  if (r < .45) return { x: Z.dance.x0 + .8 + Math.random() * (Z.dance.x1 - Z.dance.x0 - 1.6), z: Z.dance.z0 + .8 + Math.random() * (Z.dance.z1 - Z.dance.z0 - 1.6), act: 'dance' };
  if (r < .57) return { x: -8 + Math.random() * 16, z: -15.8 + Math.random() * 2.2, act: 'stage' };
  if (r < .75) return { x: 19.2, z: -12 + Math.random() * 13.5, act: 'bar' };
  if (r < .9) return { x: -16 + Math.random() * 32, z: (W.corridorY || 10.75) - .6 + Math.random() * 1.2, act: 'walk' };
  const t = U.pick(NC.tables); return { x: t.x + (Math.random() < .5 ? -3.2 : 3.2), z: t.z + (Math.random() - .5) * 2, act: 'idle' };
}
/* VIP 출입을 고려한 경로 계획 */
function planPath(from, to) {
  if (NC.Path) { const r = NC.Path.find(from, to, { exact: true }); if (r) return r; }   // v9: 격자 A* (벽·유리·가구 회피)
  const out = [], a = W.vipAt(from.x, from.z), b = W.vipAt(to.x, to.z);
  if (a >= 0 && a !== b) { const v = W.vip[a]; out.push(v.entry, { x: v.cx, z: v.z0 }, v.front); }
  if (b >= 0 && a !== b) { const v = W.vip[b]; if (from.z < W.zones.corridor.z0 && a < 0) out.push({ x: 0, z: (W.corridorY || 10.75) - 1.6 }); out.push(v.front, { x: v.cx, z: v.z0 }, v.entry); }
  if (W.terraceVia) out.push(...W.terraceVia(out.length ? out[out.length - 1] : from, to));
  out.push(to); return out;
}
function goTo(n, to, onArrive, speed = 2.6) { n.state = 'path'; n.path = planPath(n, to); n.onArrive = onArrive; n.speed = speed; n.stuck = 0; const u = n.g.userData; u.dance = null; u.seated = false; }

function stepToward(n, tx, tz, dt) {
  const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz), u = n.g.userData;
  if (d < .3) return true;
  let mx = dx / d, mz = dz / d, spd = n.speed;
  if (n.drunk) {   // v12 취한 걸음: 진행 방향이 좌우로 출렁이고 속도가 들쑥날쑥
    const tt = performance.now() / 1000, wv = Math.sin(tt * 1.7 + n.x) * .75 + Math.sin(tt * 3.3) * .25, cs = Math.cos(wv), sn = Math.sin(wv);
    [mx, mz] = [mx * cs - mz * sn, mx * sn + mz * cs]; spd *= .45 + .25 * (1 + Math.sin(tt * 2.3));
  }
  if (!u.moving) n._v = Math.min(n._v || 0, .35); n._v = (n._v || 0) + (spd - (n._v || 0)) * Math.min(1, dt * 3.2);   // v55 걷기 시작은 천천히 가속(0→정속 약 0.8초) — 멈춤에서 바로 정속으로 튀어 나가던 기계적인 출발 제거
  const sp = Math.min(d, Math.min(n._v, spd) * dt), px = n.x, pz = n.z; n.x += mx * sp; n.z += mz * sp; NC.collide(n, .38);
  if (Math.hypot(n.x - px, n.z - pz) < sp * .3) n.stuck += dt; else n.stuck = Math.max(0, n.stuck - dt);
  u.moving = true; n.g.rotation.y = U.lerpAngle(n.g.rotation.y, Math.atan2(mx, mz), Math.min(1, dt * (n.drunk ? 4 : 8)));
  return false;
}

/* v55 돌아다닐 때도 격자 A* 경로를 따라 걸음(전에는 목표점까지 직선 → 탁자·의자에 몸을 비비며 미끄러지거나 끼었음) */
function wpStep(n, dt) {
  const wp = n.wp; if (!wp) return true;
  if (n.wpath === undefined || n.wpath === null) { const r = NC.Path ? NC.Path.find({ x: n.x, z: n.z }, { x: wp.x, z: wp.z }, { exact: true }) : null; n.wpath = r && r.length ? r.slice() : [{ x: wp.x, z: wp.z }]; }
  const tg = n.wpath[0]; if (!tg) return true;
  if (stepToward(n, tg.x, tg.z, dt) || (n.stuck > 1.2 && n.wpath.length > 1)) { n.wpath.shift(); if (n.wpath.length) n.stuck = 0; }
  return !n.wpath.length;
}
/* v54 댄스플로어 내비게이션: 춤추는 동안 ① 개인 간격(0.8m) 밀어내기 ② 3~7초마다 반경 0.6m 안의 새 자리로 아주 천천히 이동
 *  ③ 가끔 무대·DJ·가까운 사람·임의 방향으로 몸을 돌림 ④ 무대 위 사람은 관객 쪽을 보고 가끔 환호·손 흔들기 */
const DF = { list: [], t: -1 };
function danceFloor(n, u, dt) {
  const now = performance.now() / 1000;
  const fr = Math.floor(now * 10); if (DF.t !== fr) { DF.t = fr; DF.list = npcs.filter(o => o.state === 'wander' && o.pause > 0 && o.g.userData.dance && o.g.visible); }
  const d = n.dfl || (n.dfl = { tx: n.x, tz: n.z, next: now + 1 + Math.random() * 3, face: null, faceNext: now + 2 + Math.random() * 4, gestNext: now + 6 + Math.random() * 10 });
  let sx = 0, sz = 0; const P = NC.player;
  const push = (ox, oz, r) => { const dx = n.x - ox, dz = n.z - oz, dd = Math.hypot(dx, dz); if (dd > 1e-3 && dd < r) { const k = (r - dd) / r; sx += dx / dd * k; sz += dz / dd * k; } };
  for (const o of DF.list) if (o !== n) push(o.x, o.z, .8);
  if (P && P.group) push(P.x, P.z, .9);
  if (now > d.next) { const a = Math.random() * Math.PI * 2, rr = Math.random() * .6, bx = n.wp ? n.wp.x : n.x, bz = n.wp ? n.wp.z : n.z; d.tx = bx + Math.cos(a) * rr; d.tz = bz + Math.sin(a) * rr; d.next = now + 3 + Math.random() * 4; }
  const tx = d.tx - n.x, tz = d.tz - n.z, td = Math.hypot(tx, tz), vx = (td > .05 ? tx / td * .12 : 0) + sx * .5, vz = (td > .05 ? tz / td * .12 : 0) + sz * .5, vs = Math.hypot(vx, vz), mxs = .35;
  const k = vs > mxs ? mxs / vs : 1; n.x += vx * k * dt; n.z += vz * k * dt; NC.collide && NC.collide(n, .38);
  // 방향: 무대 위 = 관객 쪽, 플로어 = 가끔 다른 곳을 봄
  if (now > d.faceNext) { d.faceNext = now + 4 + Math.random() * 6; const r = Math.random(), S = { x: 0, z: -16.6 };   // 무대 가운데(world.js zones.stage)
    if (u.dance === 'stageDance') d.face = (Math.random() - .5) * .9;   // 무대 위: 관객(+Z) 쪽
    else if (r < .35 && DF.list.length > 1) { let best = null, bd = 9; for (const o of DF.list) { if (o === n) continue; const dd = Math.hypot(o.x - n.x, o.z - n.z); if (dd < bd) { bd = dd; best = o; } } d.face = best && bd < 2.5 ? Math.atan2(best.x - n.x, best.z - n.z) : null; }
    else if (r < .6 && S && S.x != null) d.face = Math.atan2(S.x - n.x, S.z - n.z);
    else d.face = n.g.rotation.y + (Math.random() - .5) * 2.2; }
  if (d.face != null) n.g.rotation.y = U.lerpAngle(n.g.rotation.y, d.face, Math.min(1, dt * 1.6));
  if (u.dance === 'stageDance' && now > d.gestNext) { d.gestNext = now + 9 + Math.random() * 14; if (!u.motion || !u.motion.g) Mo.play(n.g, Math.random() < .6 ? 'cheer' : 'wave', { confetti: false }); }
  n.g.position.set(n.x, NC.groundY(n.x, n.z), n.z);
}

function update(n, dt) {
  const u = n.g.userData, P = NC.player;
  if (n.state === 'off') return;
  if (n.cool > 0) n.cool -= dt;
  if (u.seated && n.state !== 'seated' && n.state !== 'talk' && n.state !== 'blues') NC.unseatAvatar(n.g);   // v45 앉은 자세로 걸어 다니는 상태 방지
  if (n.state === 'wander') {
    if (n.pause > 0) {
      n.pause -= dt; u.moving = false;
      if (u.dance === 'groove' || u.dance === 'stageDance') danceFloor(n, u, dt);   // v54 플로어 위에서 조금씩 자리 이동·방향 전환·서로 간격 유지
      if (n.wp && (n.wp.act === 'bar' || u.holdGlass) && Math.random() < dt * .12) Mo.play(n.g, 'drink');
      if (n.pause <= 0) { n.wp = pickWaypoint(n); n.wpath = null; n.stuck = 0; u.dance = null; u.holdGlass = false; }
    } else {
      if (!n.wp) n.wp = pickWaypoint(n);
      if (wpStep(n, dt) || n.stuck > 2.5) { n.wpath = null;
        n.pause = (n.wp.act === 'dance' || n.wp.act === 'stage') ? 14 + Math.random() * 26 : 4 + Math.random() * 9; u.moving = false;   // v54 춤은 한 곡 정도 이어서
        u.dance = n.wp.act === 'stage' ? 'stageDance' : n.wp.act === 'dance' ? 'groove' : null; u.holdGlass = n.wp.act === 'bar' || (u.idlePose === 'drink' && !u.dance);
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
  else if (n.state !== 'escort') { u.moving = false; }   // escort: 웨이터에게 손잡혀 걷는 중(episodes.js 가 위치·걷기 상태를 줌)
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
  setCrowdEnabled(on) { crowdOn = on; npcs.forEach(n => { if (n.state === 'seated' || n.booked || (n.always && !on)) return;   /* v36 always 손님은 온라인 모드에서도 남김 */ n.enabled = on; n.g.visible = on; n.state = on ? 'wander' : 'off'; }); },
  show(n, on = true) { n.enabled = on; n.g.visible = on; if (on && n.state === 'off') n.state = 'wander'; if (!on) n.state = 'off'; },
  sit(n, x, z, ry, h) { n._seatArgs = [x, z, ry, h]; n.state = 'seated'; n.x = x; n.z = z; NC.seatAvatar(n.g, x, z, ry, h); },
  release(n) { const u = n.g.userData; NC.unseatAvatar(n.g); n.state = (crowdOn || n.always || !NC.isOnline()) ? 'wander' : 'off'; n.booked = false; n.wp = null; n.pause = 1; u.lookAt = null; u.talk = false; if (n.state === 'off') { n.g.visible = false; n.enabled = false; } },
  init(data) {
    // v17: 모바일/저사양은 로그인 화면에서 아바타를 하나도 만들지 않음(아바타 1명 생성 = 수백 ms 작업) →
    //      입장 버튼을 누른 뒤 한 명씩 '입장'하듯 나눠 생성 → 로그인 화면 입력·버튼 반응이 즉시
    let crowdDefs = (data.npcs || []).filter(d => d.enabled !== false);
    crowdDefs = crowdDefs.filter(d => d.always).concat(crowdDefs.filter(d => !d.always));   // v36 always(재숙·혜정·조여사·Lena) 먼저 → 저사양에서도 가장 먼저 생성
    if (NC.isMobile) { const cap = innerWidth * innerHeight > 900000 ? 16 : 12, al = crowdDefs.filter(d => d.always), rest = crowdDefs.filter(d => !d.always); crowdDefs = al.concat(rest.filter(d => d.v32), rest.filter(d => !d.v32)).slice(0, Math.max(cap, al.length)); }   // v34 모바일 인원 제한(폰 12 · 태블릿 16) — v36 always 는 항상 포함
    const list = (data.personas || []).map(d => [d, 'persona']).concat(crowdDefs.map(d => [d, 'crowd']));
    const lite = (NC.quality && NC.quality.level === 'low') || matchMedia('(pointer:coarse)').matches;
    if (lite) { NC.NPC.ready = false; let i = 0; const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 250 }) : f => setTimeout(f, 30);
      const step = () => { if (i < list.length) { spawn(...list[i++]); idle(step); } else NC.NPC.ready = true; };
      let started = false; const go = () => { if (started) return; started = true; idle(step); }; NC.on && NC.on('start', go); }
    else { list.forEach(a => spawn(...a)); NC.NPC.ready = true; }
    // 손님에게도 VRM 모델 배정 (npcs.json "crowdModels": [{ "model": "...", "gender": "f", "tint": {...} }], 최대 crowdModelMax 명)
    if (NC.VRMKit && NC.VRMKit.ok && Array.isArray(data.crowdModels) && data.crowdModels.length && !(NC.quality && NC.quality.level === 'low')) {
      const max = data.crowdModelMax || 6; let k = 0;
      npcs.filter(n => n.role === 'crowd').forEach(n => { if (k >= max) return; const pool = data.crowdModels.filter(m => !m.gender || m.gender === n.gender); if (!pool.length) return; const m = pool[k % pool.length]; NC.VRMKit.attach(n.g, m.model, { tint: m.tint }); k++; });
    }
    /* v45 모든 여성 인물을 하린·서진과 같은 3D(VRM) 캐릭터로 — 인물마다 얼굴(평소 표정·눈동자·피부)·헤어·옷 색과 무늬가 다름
     *  남성 인물은 남성 VRM 파일이 생기면 npcs.json "vrmModels": { "m": "models/파일.vrm" } 로 같은 방식 적용
     *  ?procedural 을 주소에 붙이면 끔 · 저사양/모바일은 가까운 순서로 최대 vrmLiteMax(기본 6)명 */
    if (NC.VRMKit && NC.VRMKit.ok && !/[?&]procedural/.test(location.search) && !(NC.RealHuman && NC.RealHuman.active && NC.RealHuman.active())) {   // v52 실사 모델이 켜져 있으면 NPC 에 VRM 을 입히지 않음(실사 모델과 충돌 → 투명 인물)
      const all = data.vrmAll !== false, VM = all ? Object.assign({ f: 'models/sample_girl.vrm' }, data.vrmModels || {}) : {}, lite2 = (NC.quality && NC.quality.level === 'low') || NC.isMobile, cap2 = lite2 ? (data.vrmLiteMax || 6) : 99;
      const styleOf = (n, d) => ({ look: n.g.userData.look || d.look || {}, seed: U.hash((d.id || d.name) + ':vrm'), trait: d.trait, age: d.age });
      const assign = () => { if (!NC.NPC.ready) return setTimeout(assign, 1500); let k = 0;
        npcs.slice().sort((a, b) => (b.role === 'persona') - (a.role === 'persona') || (b.def.always ? 1 : 0) - (a.def.always ? 1 : 0)).forEach(n => {
          if (n.g.userData.vrm || n.g.userData.vrmPending || n.def.realModel) return; const url = n.def.model || VM[n.gender]; if (!url || (k >= cap2 && !n.def.model)) return; k++;
          n.g.userData.vrmPending = true; NC.VRMKit.enqueue(n.g, url, { tint: n.def.tint || null, style: styleOf(n, n.def) }); });
        const lk = g => g && g.userData && g.userData.look; [NC.DJ, NC.Bartender].forEach((g, i) => { if (!all || !g || !lk(g) || lk(g).gender !== 'f' || g.userData.vrmPending || k >= cap2 || lite2) return; g.userData.vrmPending = true; k++; NC.VRMKit.enqueue(g, VM.f, { style: { look: lk(g), seed: 991 + i, trait: i ? 'cool' : 'outgoing', age: 28 } }); });
      };
      setTimeout(assign, lite ? 4000 : 600);
    }
    /* v24 여성 DJ 「루나」 — 글램 스테이지 룩(크롭 블레이저 · 레더 · 부츠 · 핑크 투톤 포니테일) */
    /* v35 DJ 루나: 1.25배 크게(무대 어디서나 눈에 띄게) · 은빛 메탈릭 크롭 재킷 + 핑크 투톤 하이 포니테일 + 레더 + 니하이 부츠 · 신나는 하이프 댄스 */
    NC.DJ = addStaff('DJ 루나', { gender: 'f', idol: true, body: 'athletic', height: 1.7, hairStyle: 'highPony', hairColor: '#1a1014', hair2: '#ff5fa8', top: 'blazerCrop', topColor: '#d8dce6', metallic: true, bottom: 'leather', bottomColor: '#0d0b10', shoes: 'thigh', choker: true, chain: true, gloves: true, belt: true, pattern: 'solid', hat: null, curve: .5, face: { lipColor: '#d0405e', shadow: '#d070a0', liner: .8, blush: .3, earring: true, attractive: true } }, W.spots.dj, 'djHype');
    NC.DJ.scale.setScalar(1.25);
    NC.Bartender = addStaff('바텐더 J', { gender: 'f', hairStyle: 'ponytail', hairColor: '#17110f', top: 'vest', topColor: '#121018', bottom: 'pants', bottomColor: '#121018' }, W.spots.bartender, null); NC.Bartender.userData.holdGlass = true;
    console.info(`[npc] 페르소나 ${data.personas ? data.personas.length : 0}명 · 손님 ${(data.npcs || []).length}명`);
  },
  update(dt, cam) {
    lodF++;
    npcs.forEach((n, i) => { if (!n.enabled && n.state === 'off') return; update(n, dt);
      if (!n.g.visible) return; const d = cam.position.distanceTo(n.g.position), near = d < NEAR;
      /* v34 LOD: 멀리 있는 손님(모바일 18m+)은 2~3프레임에 한 번만 관절 계산 → 대화 상대·가까운 손님은 매 프레임 */
      n._lodDt = (n._lodDt || 0) + dt; const every = !MOBN || d < 18 || n.state === 'talk' ? 1 : d < 30 ? 2 : 3;
      if ((lodF + i) % every === 0) { Mo.update(n.g, n._lodDt, { near, speed: n.speed / 2.1 }); n._lodDt = 0; }
      NC.Avatar.fitLabel(n.g, cam); });
    staff.forEach(g => { Mo.update(g, dt, { near: cam.position.distanceTo(g.position) < 16 }); NC.Avatar.fitLabel(g, cam); });
  },
};
NC.isOnline = () => NC.mode === 'online';
NC.on('music:drop', () => npcs.forEach(n => { const d = n.g.userData.dance; if (d && n.enabled) Mo.trigger(n.g, 'music:drop'); }));
NC.setNpcsEnabled = on => NC.NPC.setCrowdEnabled(on);   // 기존 API 호환
/* v55 개인 간격(Personal Space): 서서 걷거나 머무는 사람(손님·웨이터·플레이어)끼리 몸이 겹치지 않게 매 프레임 서로 밀어냄
 *  · 기준 거리 0.62m(어깨 폭+여유) · 춤추는 사람은 댄스플로어 로직이 따로 0.8m 유지
 *  · 앉은 사람·대화/블루스/에피소드/에스코트 중인 사람은 제외(의도된 접촉) · 플레이어는 밀리지 않고 상대가 비켜 줌
 *  · 밀린 뒤에는 벽·탁자 충돌(NC.collide)을 다시 적용 → 사람을 피하다가 탁자 안으로 들어가는 일 없음
 *  · 한 프레임에 움직이는 양은 최대 1.4m/s 로 제한(튀지 않음) */
const FREE = new Set(['wander', 'path', 'idle']), MIN_D = .62;
NC.tickers.push(dt => {
  if (!dt) return; const P = NC.player, BLn = NC.Karaoke && NC.Karaoke.BL && NC.Karaoke.BL.n, A = [];
  for (const n of npcs) { if (!n.g.visible || !FREE.has(n.state) || n.g.userData.seated || n === BLn || n.party || n._noSep) continue; if (W.extraZones.some(e => e.test(n.x, n.z))) continue; A.push({ o: n, x: n.x, z: n.z, m: 1, r: .38 }); }
  const WL = NC.Waiters ? NC.Waiters.list : []; for (const o of WL) { if (!o.g || !o.g.visible || o.busy) continue; A.push({ o, x: o.x, z: o.z, m: 1, r: .35, wt: true }); }
  if (P && P.group && !P.seat) A.push({ o: P, x: P.x, z: P.z, m: 0, r: .4, hard: !!(BLn || (NC.PairWalk && NC.PairWalk.n)) });
  /* v68 블루스·함께 걷는 두 사람은 '움직이지 않는 장애물'(m:0)로 — 둘 사이 간격은 각자의 조정자가 정하고, 지나가는 손님만 비켜 감(전에는 아예 빠져 있어서 손님이 커플 몸을 관통해 지나갔음) */
  if (BLn && BLn.g.visible) A.push({ o: BLn, x: BLn.x, z: BLn.z, m: 0, r: .38, hard: true });
  { const PW = NC.PairWalk && NC.PairWalk.n; if (PW && PW !== BLn && PW.g.visible) A.push({ o: PW, x: PW.x, z: PW.z, m: 0, r: .36, hard: true }); }
  const N = A.length; if (N < 2) return; const mx = 1.4 * dt;
  for (let i = 0; i < N; i++) { const a = A[i];
    for (let j = i + 1; j < N; j++) { const b = A[j]; if (!a.m && !b.m) continue; let dx = b.x - a.x, dz = b.z - a.z; const d2 = dx * dx + dz * dz; if (d2 >= MIN_D * MIN_D) continue;
      let d = Math.sqrt(d2); if (d < 1e-3) { const ang = (i * 7 + j * 13) % 6.283; dx = Math.cos(ang); dz = Math.sin(ang); d = 1; } else { dx /= d; dz /= d; }
      const ov = MIN_D - Math.min(d, MIN_D), tot = a.m + b.m, ka = a.m / tot, kb = b.m / tot;
      a.x -= dx * ov * ka; a.z -= dz * ov * ka; b.x += dx * ov * kb; b.z += dz * ov * kb; if (a.hard && b.m) b.hit = true; if (b.hard && a.m) a.hit = true; } }
  for (const a of A) { if (!a.m) continue; const o = a.o; let dx = a.x - o.x, dz = a.z - o.z; const l = Math.hypot(dx, dz); if (l < 1e-4) continue; const lim = a.hit ? Math.max(mx, 6 * dt) : mx; if (l > lim) { dx *= lim / l; dz *= lim / l; }   // v68 춤추는·함께 걷는 커플과 겹친 사람은 더 빨리 비켜 감(걷는 속도보다 빠르게 밀어내 관통 방지)
    o.x += dx; o.z += dz; NC.collide(o, a.r); if (o.g) o.g.position.set(o.x, NC.groundY(o.x, o.z), o.z); }
});
/* v56 배경 인물이 마네킹처럼 굳어 있지 않게(손님 전원, 걷는 중·춤추는 중·대화 중 제외)
 *  ① 음악 박자에 고개 까딱(Head Bob) — 사람마다 세기·위상 다르고 40%는 박자를 타지 않고 가끔만
 *  ② 7~15초마다 2~3.5초 동안 댄스플로어(블루스 중이면 그 커플) 쪽을 힐끗 봄(Look-At) — 다른 시스템이 시선을 잡고 있으면 건드리지 않음
 *  ③ 앉은 사람은 테이블 쪽으로 몸을 살짝 기울였다 폈다(느린 호흡 주기) */
NC.tickers.push(dt => {
  if (!dt) return; const t = performance.now() / 1000, b = NC.Audio && NC.Audio.beat ? NC.Audio.beat() : null, BL = NC.Karaoke && NC.Karaoke.BL, Z = W.zones && W.zones.dance;
  const look = BL && BL.n ? { x: BL.c.x, z: BL.c.z } : Z ? { x: (Z.x0 + Z.x1) / 2, z: (Z.z0 + Z.z1) / 2 } : null;
  for (const n of npcs) { const u0 = n.g.userData; if (!u0.trait && n.trait) u0.trait = n.trait;   // 성격 → 춤 스타일(mocap.js)
    /* v56 표정: 춤추는 손님은 기본 미소, 성격에 따라 가끔 환하게 웃거나(활발·장난) 수줍게 웃음(수줍음) — 대화·블루스 중 표정은 건드리지 않음 */
    if (u0.dance && u0.setExpr && !u0.exprUntil && n.state !== 'talk' && !(BL && n === BL.n)) { const ef = n._ef || (n._ef = { next: t + 2 + Math.random() * 8 }); if (u0.baseExpr === 'neutral') u0.setExpr('smile');
      if (t > ef.next) { ef.next = t + 6 + Math.random() * 12; const tr = u0.trait; u0.setExpr(tr === 'shy' ? 'shy' : tr === 'cool' ? (Math.random() < .5 ? 'smile' : 'wink') : Math.random() < .5 ? 'laugh' : 'joy', 1.2 + Math.random()); } }
  }
  for (const n of npcs) { const u = n.g.userData, R = u.rig; if (!R || !n.g.visible || u.moving || u.dance || n.state === 'talk' || (BL && n === BL.n) || n.party) continue;
    const bg = n._bg || (n._bg = { amp: Math.random() < .6 ? .025 + Math.random() * .025 : 0, ph: Math.random(), next: t + 3 + Math.random() * 10, gl: null, lean: Math.random() * 6.28 });
    if (b && bg.amp) { const k = Math.sin((b.phase + bg.ph * .25) * Math.PI * 2); R.head.rotation.x += Math.max(0, k) * bg.amp; R.neck.rotation.x += Math.max(0, k) * bg.amp * .4; }
    if (u.seated) R.torso.rotation.x += (Math.sin(t * .35 + bg.lean) * .5 + .5) * .05;
    if (look && t > bg.next) { if (!bg.gl && !u.lookAt) { bg.gl = { x: look.x + (Math.random() - .5) * 2, z: look.z + (Math.random() - .5) * 2 }; u.lookAt = bg.gl; bg.next = t + 2 + Math.random() * 1.5; }
      else { if (bg.gl && u.lookAt === bg.gl) u.lookAt = null; bg.gl = null; bg.next = t + 7 + Math.random() * 8; } }
  }
});
})();
