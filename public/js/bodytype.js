/* bodytype.js — v77 체형 캐릭터(근육질 · 통통 · 날씬) — 실사 모델 몸을 셰이더에서 부위별로 부풀리거나 줄임
 *  · manifest 모델 항목 { id: 'f_15_mus', url: (원래 모델과 같은 파일), body: 'muscle'|'fat'|'slim' } → 캐릭터 고르기 목록에 따로 나옴
 *  · 부위 가중치(aInfl = 배·엉덩이 / 가슴·어깨·등 / 팔·다리)는 뼈 가중치·높이로 한 번 계산해 지오메트리에 저장(같은 파일 모델끼리 공유)
 *  · 변형량은 인스턴스 재질 uniform(uInfl) — 같은 파일을 쓰는 다른 사람은 0 이라 영향 없음 · 스키닝 뒤 법선 방향이라 걷기·춤에도 따라감
 */
(() => {
'use strict';
const NC = window.NC, RH = NC && NC.RealHuman; if (!RH || !RH.attach || !NC.THREE) return;
const T = NC.THREE;
/* m 단위: [배·엉덩이, 가슴·어깨·등, 팔·다리], 가로 폭, 키 배율 */
const BODY = { muscle: { infl: [.006, .036, .027], width: 1.09, height: 1.01, label: '근육질' }, fat: { infl: [.085, .034, .028], width: 1.09, height: .99, label: '통통' }, slim: { infl: [-.016, -.012, -.010], width: .89, height: 1.02, label: '날씬' } };   // v78 근육질·날씬 강화
/* v78 AI 손님: 외형 시드로 정해진 look.body(avatar.js mergeLook)를 실사 모델 체형으로 — [종류, 강도] */
const NPC_MAP = { plus: ['fat', 1], stocky: ['fat', .8], soft: ['fat', .75], muscular: ['muscle', 1], athletic: ['muscle', .8], slim: ['slim', 1] };
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function weights(A) {   // 정점마다 [배, 가슴어깨, 팔다리]
  const Bn = A.Bn, hipH = A.H(A.P(Bn.hips)), neckH = A.H(A.P(Bn.neck)), out = new Float32Array(A.body.geometry.attributes.position.count * 3);
  for (const v of A.BV) { const W = k => v.W[k] || 0, torso = W('torso'), arms = W('uaL') + W('uaR') + W('faL') + W('faR'), legs = W('thighL') + W('thighR') + W('calfL') + W('calfR'), h = A.H(v.bw), f = A.F(v.bw);
    const belly = torso * ss(hipH - .14, hipH + .02, h) * (1 - ss(neckH - .3, neckH - .2, h)) * (f > 0 ? 1 : .35) + legs * ss(hipH - .32, hipH - .1, h) * .45;   // 배(앞쪽이 더) + 엉덩이·허벅지 윗부분
    const chest = torso * ss(neckH - .34, neckH - .2, h) * (1 - ss(neckH - .02, neckH + .04, h)) + W('neck') * .25;   // 가슴·어깨·등
    const limbs = arms * .9 + legs * (.55 + .45 * ss(hipH - .85, hipH - .35, h));   // 팔 + 다리(허벅지 쪽이 더)
    out[v.i * 3] = belly; out[v.i * 3 + 1] = chest; out[v.i * 3 + 2] = limbs; }
  return out;
}
function apply(root) {
  const u = root && root.userData, r = u && u.real; if (!r || r.pending || !r.model) return;
  const K = kindOf(root, u), bt = K && BODY[K[0]], k = K ? K[1] : 0, key = K && K.join(':'); const prev = r._bt;
  if (!bt) { if (prev) { setU(r, [0, 0, 0]); r._bt = null; } return; }
  if (prev === key) return;
  const W = NC.Wardrobe; if (!W || !W.analyze) return; const A = W.analyze(r.model, r.Bn); if (!A) return;
  const g = A.body.geometry; if (!g.attributes.aInfl) g.setAttribute('aInfl', new T.BufferAttribute(weights(A), 3));
  setU(r, bt.infl.map(x => x * k), A.body); r._bt = key;
  if (r.holder && !r._btW) { const w = 1 + (bt.width - 1) * k, h = 1 + (bt.height - 1) * k; r.holder.scale.x *= w; r.holder.scale.z *= w; r.holder.scale.y *= h; r._btW = true; }
}
function kindOf(root, u) {
  const id = u.look && u.look.realModel, m = id && RH.modelOf(id);
  if (m && BODY[m.body]) return [m.body, 1];                        // 체형 캐릭터를 고른 경우(내 캐릭터)
  if (id || (NC.player && root === NC.player.group)) return null;   // 직접 고른 모델은 그대로
  if (u.wardrobe || u._uPinned || u.noBody) return null;            // 옷을 입히는 고정 인물(조여사·재숙이·Alex Kim 등)
  return NPC_MAP[u.look && u.look.body] || null;                    // AI 손님 · 직원
}
function setU(r, infl, mesh) {
  r.model.traverse(o => { if (!o.isSkinnedMesh) return; const ws = o.getWorldScale(new T.Vector3()).x || 1; [].concat(o.material).forEach(mt => { const c = mt && mt.userData && mt.userData.ccu; if (c && c.uInfl) c.uInfl.value.set(infl[0] / ws, infl[1] / ws, infl[2] / ws); }); });
}
{ const a0 = RH.attach; RH.attach = async (root, url, opt) => { const res = await a0(root, url, opt); try { apply(root); } catch (e) { console.warn('[bodytype]', e); } return res; }; }
NC.BodyType = { BODY, apply, kindOf, stat() { const c = {}; for (const n of NC.npcs || []) { const r = n.g && n.g.userData.real; const b = r && r._bt; if (n.g && n.g.visible) c[b || 'normal'] = (c[b || 'normal'] || 0) + 1; } return c; } };
console.info('[bodytype] v78 근육질·통통·날씬 체형 (AI 손님 포함)');
})();
