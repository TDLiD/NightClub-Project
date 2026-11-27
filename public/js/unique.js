/* unique.js — v64 같은 얼굴 금지: 세션 외형 등록부(Session Appearance Registry)
 *  원인: 페르소나 35명은 서로 다른 모델이지만, 테이블 손님(guestPlan)·직원(staff 풀)·내 캐릭터·다른 접속자는 같은 67개 모델 풀에서
 *        따로 고르기 때문에 같은 얼굴·옷이 한 화면에 둘씩 나왔음.
 *  해결: 실사 모델을 입히는 모든 경로(RH.attach — 거리별 화질 교체 포함)를 한 곳에서 거쳐
 *   ① 지금 화면에 살아 있는 아바타가 이미 쓰는 모델이면, 같은 성별의 '아무도 안 쓰는' 모델로 바꿔 입힘(우선순위: 내 캐릭터 > 고정(pinned) > 페르소나 > 손님·직원)
 *   ② 한 번 정한 모델은 그 아바타에 고정(화질 교체·재접속 때도 같은 사람으로 보이게)
 *   ③ 모델이 모자라면(67명 초과) 키 ±3%·체형 폭 ±3% 변주로 겹치지 않는 '외형 지문'을 만듦
 *  NC.Unique.report() → { visible, dupModels, dupPrints } (시험·🦴 패널용) */
(() => {
'use strict';
const NC = window.NC, RH = NC && NC.RealHuman; if (!RH || !RH.ok || !RH.attach) return;
const idOf = url => { const m = /([fm]_\d{2})(?:_lodm?)?\.glb/.exec(url || ''); return m ? m[1] : null; };
const swap = (url, from, to) => url.replace(from, to);
const isPlayer = root => NC.player && root === NC.player.group;
const live = () => { const out = []; const P = NC.player; if (P && P.group) out.push(P.group);
  for (const n of NC.npcs || []) if (n.g && n.state !== 'off') out.push(n.g);
  for (const g of (NC.NPC && NC.NPC.staff) || []) out.push(g);
  for (const k in (NC.remotes || {})) { const r = NC.remotes[k]; if (r && r.group) out.push(r.group); }
  return out; };
const rank = root => isPlayer(root) ? 4 : (root.userData._uPinned || root.userData.wardrobe) ? 3 :   /* v71 옷을 입히는 인물(조여사)은 바탕 모델이 정해져 있어 바꾸지 않음 */ (NC.npcs || []).some(n => n.g === root && n.persona) ? 2 : 1;
function usedBy(id, except) { const r = []; for (const g of live()) { if (g === except) continue; const u = g.userData; if (u._uid === id && (u.real || u._uPending)) r.push(g); } return r; }
function pool(gender) { const C = RH.cfg || {}, P = C.playerPool || {}; return (P[gender] || []).slice(); }
function pickFree(gender, except) { const busy = new Set(); for (const g of live()) if (g !== except && g.userData._uid) busy.add(g.userData._uid);
  const cand = pool(gender).filter(i => !busy.has(i) && /^[fm]_\d{2}$/.test(i));   /* v87 체형 변형 항목(f_12_fat 등)은 별도 GLB 파일이 없음 — 얼굴 교체 후보에서 제외(그 파일을 찾다 실패해 옛 절차적 인형으로 남던 원인) */ if (!cand.length) return null; const seed = [...String(except.uuid || '')].reduce((a, c) => a + c.charCodeAt(0), 0); return cand[seed % cand.length]; }
/* 같은 모델을 쓸 수밖에 없을 때: 키·체형 폭 변주(±3%) — 외형 지문(모델, 변주)이 겹치지 않게 */
function variant(root, id) { const taken = new Set(); for (const g of usedBy(id, root)) taken.add(g.userData._uvar || 0); let v = 0; while (taken.has(v) && v < 8) v++; root.userData._uvar = v;
  if (v) { const s = [1, 1.03, .97, 1.015, .985, 1.03, .97, 1.02][v], w = [1, .97, 1.03, 1.02, .98, 1.03, .97, .99][v]; root.userData._uscale = [w, s, w]; } return v; }
const STAT = { swaps: 0, variants: 0 };
const A0 = RH.attach;
RH.attach = async (root, url, opt = {}) => {
  const u = root && root.userData; let id = idOf(url);
  if (u && id) {
    if (opt.pinned) u._uPinned = true;
    const want = u._ufix || id; if (want !== id) { url = swap(url, id, want); id = want; }   // 정해 둔 모델 유지(화질 교체·재장착 시)
    const others = usedBy(id, root).filter(g => !u._ufix || rank(g) >= 1).filter(g => u._ufix ? true : rank(g) >= rank(root));
    if (others.length) { const alt = pickFree(id[0], root); if (alt) { url = swap(url, id, alt); STAT.swaps++; { const n = (NC.npcs || []).find(x => x.g === root); if (n && n.def && /real\//.test(n.def.photo || '')) n.def.photo = 'real/' + alt + '.jpg'; }   /* 프로필 사진도 바뀐 얼굴로 */ console.info('[unique] 겹치는 모델', id, '→', alt); id = alt; } else { variant(root, id); STAT.variants++; } }
    u._ufix = id;
    u._uid = id; u._uPending = true;
  }
  try { return await A0(root, url, opt); } finally { if (u) { u._uPending = false; if (u._uscale && u.real && u.real.holder) { const h = u.real.holder; h.scale.set(h.scale.x * u._uscale[0], h.scale.y * u._uscale[1], h.scale.z * u._uscale[2]); u._uscale = null; } } }
};
NC.Unique = { STAT, report() { const vis = live().filter(g => g.visible && g.userData.real && g.userData._uid), m = {}, p = {}; vis.forEach(g => { const u = g.userData; m[u._uid] = (m[u._uid] || 0) + 1; const k = u._uid + ':' + (u._uvar || 0); p[k] = (p[k] || 0) + 1; });
  return { visible: vis.length, dupModels: Object.entries(m).filter(([, c]) => c > 1), dupPrints: Object.entries(p).filter(([, c]) => c > 1), swaps: STAT.swaps, variants: STAT.variants }; } };
console.info('[unique] v64 외형 등록부 — 같은 모델 동시 등장 방지');
})();
