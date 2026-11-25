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
const BODY = { muscle: { infl: [.004, .024, .017], width: 1.05, height: 1.0, label: '근육질' }, fat: { infl: [.075, .03, .024], width: 1.07, height: .99, label: '통통' }, slim: { infl: [-.012, -.008, -.007], width: .92, height: 1.02, label: '날씬' } };
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
  const id = u.look && u.look.realModel, m = id && RH.modelOf(id), bt = m && BODY[m.body]; const prev = r._bt;
  if (!bt) { if (prev) { setU(r, [0, 0, 0]); r._bt = null; } return; }
  if (prev === m.body) return;
  const W = NC.Wardrobe; if (!W || !W.analyze) return; const A = W.analyze(r.model, r.Bn); if (!A) return;
  const g = A.body.geometry; if (!g.attributes.aInfl) g.setAttribute('aInfl', new T.BufferAttribute(weights(A), 3));
  setU(r, bt.infl, A.body); r._bt = m.body;
  if (r.holder && !r._btW) { r.holder.scale.x *= bt.width; r.holder.scale.z *= bt.width; r.holder.scale.y *= bt.height; r._btW = true; }
}
function setU(r, infl, mesh) {
  r.model.traverse(o => { if (!o.isSkinnedMesh) return; const ws = o.getWorldScale(new T.Vector3()).x || 1; [].concat(o.material).forEach(mt => { const c = mt && mt.userData && mt.userData.ccu; if (c && c.uInfl) c.uInfl.value.set(infl[0] / ws, infl[1] / ws, infl[2] / ws); }); });
}
{ const a0 = RH.attach; RH.attach = async (root, url, opt) => { const res = await a0(root, url, opt); try { apply(root); } catch (e) { console.warn('[bodytype]', e); } return res; }; }
NC.BodyType = { BODY, apply };
console.info('[bodytype] v77 근육질·통통·날씬 체형');
})();
