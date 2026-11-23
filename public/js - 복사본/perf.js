/* perf.js — v53 적응형 성능(모든 기기)
 *  ■ 입장 후 3초마다 실제 FPS 를 재서, 느리면 렌더 해상도(픽셀 비율)를 조금씩 낮추고 여유가 생기면 다시 올림
 *    (모바일 저화질은 mobile.js 의 기존 적응형 해상도가 담당 → 여기서는 건너뜀)
 *  ■ 입장 직후 6초(모델 장착·셰이더 준비)와 탭이 숨겨진 동안은 재지 않음 → 일시적인 끊김으로 화질이 떨어지지 않게
 *  ■ 계속 20fps 아래면 한 번만 "화질을 낮춰 보세요" 안내
 *  ■ NC.perf = { fps, pr, base, tier } — ⚙ 화질 메뉴·디버그에서 확인용
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.renderer) return;
const R = NC.renderer, Q = NC.quality || {};
const base = R.getPixelRatio();
const perf = NC.perf = { fps: 0, pr: base, base, tier: (NC.device && NC.device.tier) || (NC.isMobile ? 'mobile' : 'desktop'), adaptive: !(NC.isMobile && !Q.post) };
if (!perf.adaptive) return;
const minPr = Math.max(.6, +(base * .6).toFixed(2));
let pr = base, fr = 0, acc = 0, calm = 0, warm = 0, started = false, slow = 0, hinted = false;
NC.on && NC.on('start', () => { started = true; warm = 0; });
NC.tickers.push(dt => {
  if (!started || document.hidden || dt > .5) return;
  if (warm < 6) { warm += dt; return; }
  fr++; acc += dt; if (acc < 3) return;
  const fps = fr / acc; fr = 0; acc = 0; perf.fps = Math.round(fps);
  if (fps < 20 && pr <= minPr) { if (++slow >= 3 && !hinted && Q.level !== 'low') { hinted = true; NC.ui && NC.ui.toast && NC.ui.toast('🐢 화면이 느려요 — ⚙ 화질을 한 단계 낮추면 부드러워져요', 5000); } } else slow = 0;
  if (fps < 38 && pr > minPr) { pr = Math.max(minPr, +(pr - .15).toFixed(2)); calm = 0; }
  else if (fps > 56 && pr < base) { if (++calm < 3) return; pr = Math.min(base, +(pr + .1).toFixed(2)); calm = 0; }
  else return;
  R.setPixelRatio(pr); R.setSize(innerWidth, innerHeight, false); NC.renderScale = perf.pr = pr;   // 후처리 버퍼는 gfx.js 가 크기 변화를 감지해 다시 만듦
});
console.info('[perf] 적응형 해상도 켜짐 · 기기 등급 ' + perf.tier + (NC.device && NC.device.gpu ? ' · ' + NC.device.gpu.slice(0, 60) : ''));
})();
