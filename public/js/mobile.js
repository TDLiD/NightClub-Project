/* mobile.js — v28 모바일 중심 최적화
 *  ■ 이어서 입장(Resume): 모바일 브라우저가 메모리 부족·백그라운드 전환으로 탭을 다시 불러오면 처음 입장(로그인) 화면으로
 *    돌아가던 문제 → 게임 중 상태를 4초마다 저장하고, 다시 열리면 「▶ 이어서 입장」(모바일은 3초 뒤 자동)
 *  ■ WebGL 컨텍스트 손실: 검은 화면으로 멈추지 않고 상태 저장 → 자동 새로고침 → 이어서 입장
 *  ■ 적응형 해상도: 프레임이 떨어지면 렌더 해상도를 자동으로 낮추고, 여유가 생기면 다시 올림(저사양 모드)
 *  ■ 백그라운드: 화면을 끄거나 앱을 전환하면 음악·영상 일시정지(배터리·메모리 절약, 탭 강제 종료 예방)
 *  ■ 터치: 두 손가락 핀치 줌, 길게 누르기 메뉴·더블탭 확대 방지
 *  ■ 화면 배치: 세로/가로 폰에서 버튼·패널이 겹치지 않게 재배치(이모트는 😀 서랍, 대화 선택지는 아래 시트, 프로필 카드는 상단)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, $ = s => document.querySelector(s), MOB = !!NC.isMobile, root = document.documentElement;
const RKEY = 'nc_resume', RMAX = 15 * 60 * 1000;

/* ───────── 이어서 입장 ───────── */
const Resume = NC.Resume = {
  save() {
    const P = NC.player; if (!P || !P.group) return;
    const K = NC.Karaoke, W = NC.world, inner = (K && K.inRoom) || (W.extraZones || []).some(e => e.test(P.x, P.z));
    const s = { t: Date.now(), name: NC.settings.name, mode: NC.settings.playMode };
    if (!inner && P.y < .5) Object.assign(s, { x: +P.x.toFixed(2), z: +P.z.toFixed(2), ry: +P.ry.toFixed(2) });
    U.store.set(RKEY, s);
  },
  get() { const s = U.store.get(RKEY, null); return s && Date.now() - s.t < RMAX ? s : null; },
  clear() { try { localStorage.removeItem(RKEY); } catch (e) { } },
};
let started = false, saveT = null;
NC.on('start', () => {
  started = true; clearInterval(saveT); saveT = setInterval(() => Resume.save(), 4000); Resume.save();
  const s = pendingResume; pendingResume = null;
  if (s && s.x != null) { const P = NC.player; P.x = s.x; P.z = s.z; P.ry = s.ry || P.ry; P.group.position.set(P.x, NC.groundY ? NC.groundY(P.x, P.z) : 0, P.z); P.group.rotation.y = P.ry; }
  if (s) setTimeout(() => NC.ui.toast('📱 화면이 다시 열려서 이어서 입장했어요'), 600);
  if (MOB && !U.store.get('nc_touchHint', false)) { U.store.set('nc_touchHint', true); setTimeout(() => NC.ui.toast('👆 바닥 탭: 이동 · 드래그: 시점 · 두 손가락: 확대/축소 · 😀 이모트'), 2500); }
});
addEventListener('pagehide', () => { if (started) Resume.save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && started) Resume.save(); });

let pendingResume = null;
function offerResume() {
  const s = Resume.get(); if (!s || started) return;
  const card = $('#start .card'); if (!card) return;
  const box = document.createElement('div'); box.id = 'resumeBox';
  box.innerHTML = `<b>📱 방금 플레이하던 화면이 다시 열렸어요</b><div class="rbRow"><button id="rbGo">▶ 이어서 입장<span id="rbCnt"></span></button><button id="rbNo">처음부터</button></div>`;
  card.insertBefore(box, card.firstChild);
  let n = MOB ? 3 : 0, tm = null;
  const go = async () => {
    clearInterval(tm); box.remove();
    try { await NC.dataReady; } catch (e) { return; }
    const nick = $('#nick'); if (nick && !nick.value && s.name) nick.value = String(s.name).replace(/ \(나\)$/, '').slice(0, 10);
    pendingResume = s; const g = $('#go'); if (g && !g.disabled) g.click();
  };
  const cnt = () => { const c = $('#rbCnt'); if (c) c.textContent = n > 0 ? ` (${n})` : ''; };
  $('#rbGo').onclick = go; $('#rbNo').onclick = () => { clearInterval(tm); Resume.clear(); box.remove(); };
  if (n > 0) { cnt(); tm = setInterval(() => { n--; cnt(); if (n <= 0) go(); }, 1000); }
  ['pointerdown', 'keydown'].forEach(k => card.addEventListener(k, e => { if (!box.contains(e.target)) { clearInterval(tm); const c = $('#rbCnt'); if (c) c.textContent = ''; } }, { once: true }));
}
setTimeout(offerResume, 300);

/* ───────── WebGL 컨텍스트 손실 → 저장 후 자동 새로고침 ───────── */
/* v34: 바로 새로고침하지 않고 먼저 같은 화면에서 복구를 기다림(대부분 1~2초 안에 복구) → 복구되면 그대로 계속(대화·위치 유지)
 *      5초 안에 복구되지 않을 때만 저장 후 새로고침 → 이어서 입장 */
let lostT = null;
NC.canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault(); if (started) Resume.save();
  let o = $('#ctxLost'); if (!o) { o = document.createElement('div'); o.id = 'ctxLost'; document.body.appendChild(o); }
  o.innerHTML = '<div>📱 화면 메모리를 정리하는 중…<br><small>잠시만 기다려 주세요</small></div>';
  clearTimeout(lostT); lostT = setTimeout(() => { o.innerHTML = '<div>📱 다시 불러오는 중…<br><small>이어서 입장해요</small></div>'; setTimeout(() => location.reload(), 600); }, 5000);
  NC.contextLost = true;
}, false);
NC.canvas.addEventListener('webglcontextrestored', () => {
  clearTimeout(lostT); NC.contextLost = false; const o = $('#ctxLost'); if (o) o.remove();
  try { const R = NC.renderer; R.setPixelRatio(Math.max(.7, (NC.renderScale || R.getPixelRatio()) - .15)); R.setSize(innerWidth, innerHeight, false); } catch (er) { }
  (NC.npcs || []).forEach(n => { const u = n.g && n.g.userData; if (u) u.faceDirty = true; });
  NC.ui.toast('📱 화면을 복구했어요 — 해상도를 조금 낮췄어요');
}, false);

/* ───────── 백그라운드: 음악·영상 일시정지 (모바일) ───────── */
let bgPaused = false;
document.addEventListener('visibilitychange', () => {
  if (!MOB) return; const A = NC.Audio; if (!A || !A.ctx) return;
  if (document.hidden) { const el = A.mp3El; if (el && !el.paused) { el.pause(); bgPaused = true; } try { A.ctx.suspend(); } catch (e) { } }
  else { try { A.ctx.resume(); } catch (e) { } if (bgPaused && !A.paused && A.mp3El) { const p = A.mp3El.play(); if (p && p.catch) p.catch(() => {}); } bgPaused = false; }
});

/* ───────── 적응형 해상도 (저사양 = 후처리 없음일 때만) ───────── */
if (MOB && NC.quality && !NC.quality.post) {
  const R = NC.renderer, base = R.getPixelRatio(); let pr = base, fr = 0, acc = 0, calm = 0;
  NC.tickers.push(dt => {
    if (document.hidden || !started) return; fr++; acc += dt; if (acc < 4) return;
    const fps = fr / acc; fr = 0; acc = 0;
    if (fps < 24 && pr > .7) { pr = Math.max(.7, +(pr - .15).toFixed(2)); calm = 0; }
    else if (fps > 50 && pr < base) { if (++calm >= 2) { pr = Math.min(base, +(pr + .1).toFixed(2)); calm = 0; } }
    else return;
    R.setPixelRatio(pr); R.setSize(innerWidth, innerHeight, false); NC.renderScale = pr;
  });
}
/* 모바일에서 고화질 선택 시 경고 */
if (MOB && NC.setQuality) { const sq = NC.setQuality; NC.setQuality = lv => { if (lv === 'high' && !confirm('고화질은 휴대폰 메모리를 많이 써서 화면이 다시 시작될 수 있어요. 그래도 바꿀까요?')) return; sq(lv); }; }

/* ───────── 터치: 핀치 줌 · 길게 누르기/더블탭 방지 ───────── */
{ const pts = new Map(); let d0 = 0, dist0 = 0;
  const cv = NC.canvas;
  cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = NC.cam.dist; NC._pinch = true; NC._pinchEnd = true; } });
  addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && d0 > 10) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); NC.cam.dist = U.clamp(dist0 * d0 / Math.max(20, d), 3, 18); const zv = $('#zVal'); if (zv) zv.textContent = Math.round((18 - NC.cam.dist) / 15 * 100) + '%'; } });
  const up = e => { if (!pts.delete(e.pointerId)) return; if (pts.size < 2) NC._pinch = false; if (pts.size === 0) setTimeout(() => { NC._pinchEnd = false; }, 60); };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());   // iOS 페이지 확대 방지
  let lastTap = 0; document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastTap < 320 && e.target === cv) e.preventDefault(); lastTap = now; }, { passive: false });
}

/* ───────── 화면 배치 ───────── */
if (MOB) {
  const em = $('#emotes'), tg = document.createElement('button'); tg.id = 'emoteToggle'; tg.textContent = '😀'; tg.title = '이모트'; tg.style.display = 'none'; document.body.appendChild(tg);
  tg.onclick = () => root.classList.toggle('emOpen');
  if (em) em.addEventListener('click', e => { if (e.target.closest('button[data-e]')) root.classList.remove('emOpen'); });
  NC.on('start', () => { tg.style.display = ''; });
  const help = $('#help'); if (help) help.innerHTML = '👆 탭: 이동 · 드래그: 시점 · 핀치: 확대';
}
const css = `
html.mobile *{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}   /* v34 모바일: 반투명 블러 끄기(합성 비용↓ → 패널 열고 닫을 때 버벅임 감소) */
html.mobile #help{display:none!important}
html.mobile #title{font-size:14px}html.mobile #badge{display:none}
html.mobile .ibtn{min-width:34px;height:34px;font-size:15px;padding:0 6px}
html.mobile input,html.mobile select,html.mobile textarea{font-size:16px!important}
html.mobile #emoteToggle{position:fixed;right:max(10px,env(safe-area-inset-right));bottom:calc(env(safe-area-inset-bottom) + 12px);z-index:11;width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:rgba(44,23,88,.92);font-size:22px;color:#fff;box-shadow:0 0 14px rgba(123,61,255,.5)}
html.mobile #emotes{left:auto!important;right:max(10px,env(safe-area-inset-right));transform:none!important;bottom:calc(env(safe-area-inset-bottom) + 66px)!important;display:none!important;flex-wrap:wrap;width:178px;max-width:none!important;gap:6px;padding:7px;overflow:visible!important}
html.mobile.emOpen #emotes{display:flex!important}
html.mobile #emotes button{width:36px!important;height:36px!important;font-size:18px!important}
html.mobile #joy{left:max(12px,env(safe-area-inset-left));bottom:calc(env(safe-area-inset-bottom) + 14px);width:112px;height:112px;touch-action:none}
html.mobile #act{bottom:calc(env(safe-area-inset-bottom) + 140px)!important;max-width:68vw;font-size:14px;padding:10px 16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:10}
html.mobile #zoomBar{bottom:calc(env(safe-area-inset-bottom) + 70px);padding:3px;gap:2px}html.mobile #zoomBar button{width:32px;height:32px;font-size:17px}html.mobile #zVal{font-size:9.5px}
html.mobile #btnSearch{bottom:calc(env(safe-area-inset-bottom) + 196px)!important;width:40px;height:40px;font-size:18px}
html.mobile #cpToggle{width:34px;height:46px;font-size:18px}
html.mobile #musicPlayer{left:auto!important;right:max(8px,env(safe-area-inset-right))!important;top:calc(env(safe-area-inset-top) + 50px)!important;bottom:auto!important;width:auto!important;padding:4px 6px!important;gap:4px}
html.mobile #musicPlayer .mpTop{display:none!important}html.mobile #musicPlayer .mpBtns button{width:26px!important;height:26px!important;font-size:10.5px!important}html.mobile #musicPlayer .mpBtns .mpPlay{width:30px!important;height:30px!important}
html.mobile #musicPlayer .mpBar{width:46px}
html.mobile #partyBar{position:fixed!important;left:max(8px,env(safe-area-inset-left))!important;right:auto;top:calc(env(safe-area-inset-top) + 96px)!important;transform:none!important;gap:5px;flex-wrap:wrap;max-width:calc(100vw - 16px)}
html.mobile #partyBar button{height:30px!important;padding:0 10px!important;font-size:12px!important;border-radius:15px!important}
html.mobile #guestList{top:calc(env(safe-area-inset-top) + 134px)!important;left:max(8px,env(safe-area-inset-left))!important;width:min(176px,46vw)!important;font-size:12px}
html.mobile #guestList #glBody{max-height:40vh!important}
html.mobile #karaBar{top:auto!important;bottom:calc(env(safe-area-inset-bottom) + 188px)!important;left:50%!important;transform:translateX(-50%)!important;gap:5px;flex-wrap:nowrap;z-index:10}
html.mobile #karaBar button{white-space:nowrap;padding:7px 10px!important;font-size:12px!important}
html.mobile #karaLyrics{bottom:calc(env(safe-area-inset-bottom) + 236px)!important;width:96vw}
html.mobile #kara{left:2vw!important;right:2vw!important;width:auto!important;max-height:78vh;transform:none!important}
html.mobile #dlg{left:0!important;right:0!important;bottom:0!important;transform:none!important;width:auto!important;max-height:62vh;overflow-y:auto;border-radius:16px 16px 0 0;padding:12px 12px calc(12px + env(safe-area-inset-bottom))!important;box-sizing:border-box}
html.mobile #dlg button.opt{padding:12px;font-size:14.5px}
html.mobile #talk{left:2vw!important;right:2vw!important;width:auto!important;top:auto!important;bottom:calc(env(safe-area-inset-bottom) + 6px)!important;height:54vh!important}
html.mobile #profCard{left:max(8px,env(safe-area-inset-left))!important;top:calc(env(safe-area-inset-top) + 92px)!important;right:auto!important;transform:scale(.8)!important;transform-origin:top left;max-height:none;overflow:hidden;z-index:16}
html.mobile #chat{bottom:calc(env(safe-area-inset-bottom) + 190px)!important;width:min(300px,70vw)}html.mobile #chatlog{max-height:90px}
html.mobile .modal .box{width:94vw;max-height:86vh}
html.mobile #seatBar{bottom:calc(env(safe-area-inset-bottom) + 188px)!important;max-width:96vw;flex-wrap:wrap;justify-content:center}
html.mobile #seatBar button{padding:7px 10px!important;font-size:12px!important}
/* 가로 폰 */
@media (orientation:landscape) and (max-height:500px){
 html.mobile #partyBar{top:calc(env(safe-area-inset-top) + 44px)!important;left:auto!important;right:max(60px,env(safe-area-inset-right))!important}
 html.mobile #guestList{top:calc(env(safe-area-inset-top) + 80px)!important}html.mobile #guestList #glBody{max-height:calc(100vh - 150px)!important}
 html.mobile #musicPlayer{top:auto!important;bottom:calc(env(safe-area-inset-bottom) + 6px)!important;right:auto!important;left:50%!important;transform:translateX(-50%)}
 html.mobile #act{bottom:calc(env(safe-area-inset-bottom) + 56px)!important}
 html.mobile #karaBar{bottom:calc(env(safe-area-inset-bottom) + 100px)!important}
 html.mobile #joy{width:96px;height:96px;bottom:8px}
 html.mobile #dlg{max-height:72vh;left:auto!important;width:min(520px,60vw)!important;right:0!important}
 html.mobile #talk{top:6px!important;bottom:6px!important;height:auto!important;left:auto!important;width:min(340px,46vw)!important}
 html.mobile #profCard{top:calc(env(safe-area-inset-top) + 44px)!important}
 html.mobile #btnSearch{bottom:calc(env(safe-area-inset-bottom) + 150px)!important;right:max(54px,calc(env(safe-area-inset-right) + 44px))!important}
}
#resumeBox{margin:0 0 12px;padding:12px;border-radius:14px;background:linear-gradient(135deg,rgba(255,61,154,.25),rgba(123,61,255,.3));border:1px solid rgba(255,255,255,.3);color:#fff;font-size:14px;text-align:center}
#resumeBox .rbRow{display:flex;gap:8px;margin-top:9px}#resumeBox button{flex:1;padding:12px;border-radius:12px;border:0;font-size:15px;font-weight:800;color:#fff;cursor:pointer}
#rbGo{background:linear-gradient(135deg,#ff3d9a,#7b3dff)}#rbNo{flex:0 0 34%!important;background:rgba(255,255,255,.12)!important;border:1px solid rgba(255,255,255,.25)!important;font-weight:600!important}
#ctxLost{position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;background:rgba(10,4,24,.92);color:#fff;font-size:16px;text-align:center;line-height:1.7}
`;
{ const st = document.createElement('style'); st.id = 'mobStyle'; st.textContent = css; document.head.appendChild(st); }
console.info('[mobile] 📱 v28 모바일 최적화', MOB ? '(모바일 기기)' : '(PC)', '· 이어서 입장 · 핀치 줌 · 적응형 해상도');
})();
