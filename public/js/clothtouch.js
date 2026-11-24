/* clothtouch.js — v73 손이 닿은 자리의 옷감 반응(국소 변형) — 엉덩이·가슴 위(옷 위) 접촉, 허리춤 매만지기
 *  · 손 목표점은 couple.js 가 상대 몸의 실제 위치에서 매 프레임 계산한 IK 목표(armDbg.tgt)와 접촉 가중치(w)를 그대로 씀 — 고정 월드 좌표 아님
 *  · 변형은 상대 몸 셰이더(avatar.js realBodyMat, 스키닝 후 객체 공간)에서: 반경 안을 부드럽게 눌러 들어가게(손바닥 방향) + 가장자리 주름 파동
 *  · 허리춤: 두 손 아래 허리선을 바깥·위로 살짝(최대 8mm·6mm) 당겼다가 놓으면 제자리로 — 옷은 계속 입은 상태(숨기기·삭제·정점 순간이동 없음)
 *  · 사람마다 몸 재질이 따로라(humanglb 인스턴스 복제) 다른 사람에게 번지지 않음. 덧입힌 옷(wardrobe 껍질)은 변형 대상 아님 */
(() => {
const NC = window.NC, T = NC && NC.THREE; if (!T) return;
const V = () => new T.Vector3(), up = new T.Vector3(0, 1, 0);
const KIND = { butt: { r: .085, dent: .014 }, chest: { r: .075, dent: .013 }, undress: { r: .1, pull: .015, lift: .01 } };   // 눌림 1.3~1.4cm · 허리선 당김 최대 1.5cm(바깥)·1cm(위)
const ST = { g: null, w: [0, 0], log: [] };
const cus = g => { const u = g && g.userData; return u ? [].concat(u._contact || [], u._cloth || []) : []; };   // 옷 그려진 몸(_contact) + 피부 재질(_cloth)
function off(g) { cus(g).forEach(cu => { if (cu.uCt) { cu.uCt.value[0].w = 0; cu.uCt.value[1].w = 0; } }); }
/* 재질(cu)마다 그 재질을 쓰는 스킨 메시의 객체 공간으로 변환 — 셰이더의 transformed(스키닝 후)는 그 메시의 로컬 좌표 */
function meshOf(g, cu) { const r = g.userData.real; if (!r || !r.model) return null; if (r._ctMap && r._ctMap.get(cu)) return r._ctMap.get(cu); const M = r._ctMap || (r._ctMap = new Map());
  r.model.traverse(o => { if (o.isSkinnedMesh) [].concat(o.material).forEach(m => { if (!m || !m.userData) return; for (const c of [m.userData.cu, m.userData.ccu]) if (c && !M.has(c)) M.set(c, o); }); }); return M.get(cu) || null; }
function put(g, i, P, Vw, rM) { cus(g).forEach(cu => { if (!cu.uCt) return; const m = meshOf(g, cu); if (!m) return; const ws = m.getWorldScale(V()).x || 1, lp = m.worldToLocal(P.clone()), lv = m.worldToLocal(P.clone().add(Vw)).sub(lp);
  cu.uCt.value[i].set(lp.x, lp.y, lp.z, rM / ws); cu.uCv.value[i].copy(lv); }); }
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function tick() {
  if (NC.ClothTouch && NC.ClothTouch.disabled) { if (ST.g) { off(ST.g); ST.g = null; } return; }   // 시험용 비교 스위치
  const BL = NC.Karaoke && NC.Karaoke.BL, act = BL && BL.act, n = BL && BL.n, P = NC.player && NC.player.group;
  const k = act && (act.k === 'panty' ? 'undress' : act.k), spec = KIND[k], out = n && n.g.userData.bAct && n.g.userData.bAct.out;
  if (!spec || !n || !P || out === 'refuse') { if (ST.g) { off(ST.g); ST.g = null; } return; }
  const g = n.g, r = g.userData.real; if (!r || r.pending || !r.Bn || !r.Bn.hips) return; if (ST.g && ST.g !== g) off(ST.g); ST.g = g;
  const ad = P.userData.armDbg || {}, hips = r.Bn.hips.getWorldPosition(V()), t = (performance.now() - act.t0) / 1000, dur = act.dur || 3, hit = act.hit || 1;
  const hold = ss(hit - .35, hit + .05, t) * (1 - ss(dur - .6, dur - .15, t));   // 닿는 순간 → 유지 → 떼기 직전 풀림
  ['L', 'R'].forEach((sd, i) => { const d = ad[sd]; if (!d || !d.tgt || !(d.w > .05)) { cus(g).forEach(cu => cu.uCt && (cu.uCt.value[i].w = 0)); ST.w[i] = 0; return; }
    const RHn = NC.RealHuman && NC.RealHuman.norm, near = RHn ? RHn(g, d.tgt) : 1; const c = Math.min(1, d.w) * hold * (1 - ss(1.35, 1.8, near)); ST.w[i] = +c.toFixed(2);   // 상대 몸 표면 근처에 있는 손만(내 몸에 둔 손은 제외) if (c < .01) { cus(g).forEach(cu => cu.uCt && (cu.uCt.value[i].w = 0)); return; }
    let dir; if (d.n && d.n.lengthSq() > .5) dir = d.n.clone().normalize(); else { dir = d.tgt.clone().sub(hips); dir.y = 0; if (dir.lengthSq() < 1e-6) return; dir.normalize(); }   // 접촉면 바깥 법선(couple 이 찾은 표면) — 없으면 몸 중심→접촉점
    let vec;
    if (spec.dent) vec = dir.clone().multiplyScalar(-spec.dent * c);   // 손바닥이 누르는 쪽(안쪽)으로 살짝
    else { const ph = Math.sin(Math.PI * ss(hit, dur - .5, t)); vec = dir.clone().multiplyScalar(spec.pull * c * ph).addScaledVector(up, spec.lift * c * ph); }   // 허리선: 바깥·위로 당겼다 제자리
    put(g, i, d.tgt, vec, spec.r); });
  if (ST.log.length < 400 && t < dur) ST.log.push([+t.toFixed(2), k, ST.w[0], ST.w[1]]);
}
NC.tickers.push(() => { try { tick(); } catch (e) { if (!ST.err) { ST.err = String(e); console.warn('[clothtouch]', e); } } });
NC.ClothTouch = { ST, KIND };
console.info('[clothtouch] v73 손 접촉 옷감 국소 변형');
})();
