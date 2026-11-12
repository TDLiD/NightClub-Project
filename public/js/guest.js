/* guest.js — v32 손님(비회원) 모드 = 나이트 내부 둘러보기 전용
 *  허용: 걷기·클릭 이동·시점/줌·화질/음악/도움말·설정 메뉴
 *  차단(회원가입 팝업): 대화·부킹, 앉기, 이모트/춤, 채팅·음성, 웨이터, 노래방, 미니게임, 파티, 각종 HUD 버튼
 *  ─ 모든 상호작용 진입점은 NC.memberGate(이름) 하나로 판정 (회원이면 true) */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const $ = s => document.querySelector(s);
const isGuest = () => !NC.account;
NC.isGuest = isGuest;

/* 둘러보기용으로 허용하는 UI 영역 (그 밖의 버튼은 손님이면 막힘) */
const ALLOW = '#start, .modal, #topbtns, #qmenu, #zoomBar, #joy, #resumeBox, #ctxLost, #guestBanner, #emoteToggle, #musicPlayer, #talk #tClose, #talk #tCancel';

let openNow = false, lastShown = 0, lastInput = 0;
['pointerdown', 'keydown'].forEach(k => addEventListener(k, () => { lastInput = performance.now(); }, true));
function popup(what) {
  openNow = true; lastShown = performance.now();
  const feat = what ? `<b>${String(what).replace(/[<>]/g, '')}</b>` : '대화 · 부킹 · 춤 · 노래방 · 게임';
  NC.ui.modal(
    `<h3>🔒 회원 전용 기능이에요</h3>
     <p style="font-size:13px;line-height:1.65">손님은 나이트 내부를 <b>둘러보기</b>만 할 수 있어요.<br>${feat}${what ? ' 기능은' : '은'} 회원가입 후 이용할 수 있어요.</p>
     <ul style="font-size:12px;line-height:1.7;text-align:left;margin:8px 0 4px 18px;opacity:.9">
       <li>💬 손님들과 부킹 대화 · 🤵 웨이터 부킹</li><li>💃 스테이지 댄스 · 🎤 노래방 · 🎲 미니게임</li><li>🪙 코인 · 닉네임 · 내 캐릭터 저장</li></ul>
     <p style="font-size:11px;opacity:.7">가입은 1분이면 끝나요</p>`,
    [['📝 회원가입하기', 'join', true], ['🔑 로그인', 'login'], ['계속 둘러보기', 0]]
  ).then(r => {
    openNow = false;
    if (r && (r.val === 'join' || r.val === 'login')) {
      try { localStorage.setItem('nc_auth_tab', r.val); } catch (e) { }
      NC.Resume && NC.Resume.clear && NC.Resume.clear();
      location.reload();
    }
  });
}
/* user=false: NPC 가 먼저 다가오는 등 자동 이벤트 → 팝업 남발 방지(90초에 한 번) */
NC.memberGate = (what, user = true) => {
  if (!isGuest()) return true;
  if (openNow) return false;
  if (!user && performance.now() - lastShown < 90000) return false;
  popup(what); return false;
};

/* ① 대화(부킹) 창 — 누가 열든 손님이면 차단 */
if (NC.Dialog && NC.Dialog.open) {
  const open = NC.Dialog.open;
  NC.Dialog.open = function (n, opt) { if (!NC.memberGate('부킹 대화', performance.now() - lastInput < 1500)) return; return open.apply(this, arguments); };
}
/* ② 노래방·미니게임·파티 진입 함수가 있으면 감싸기 */
[['Karaoke', 'enter', '노래방'], ['Karaoke', 'start', '노래방'], ['Games', 'start', '미니게임'], ['Party', 'join', '파티 이벤트'], ['Waiter', 'open', '웨이터 부킹']].forEach(([m, f, label]) => {
  const o = NC[m]; if (!o || typeof o[f] !== 'function') return; const fn = o[f];
  o[f] = function () { if (!NC.memberGate(label)) return; return fn.apply(this, arguments); };
});

/* ③ HUD 버튼 — 캡처 단계에서 가로채기 */
document.addEventListener('click', e => {
  if (!isGuest() || !NC.started) return;
  const b = e.target.closest('button, [role=button], .chip'); if (!b || b.closest(ALLOW)) return;
  if (b.id === 'act') return;                                   // 상호작용 버튼은 main.js 에서 판정
  e.preventDefault(); e.stopImmediatePropagation();
  NC.memberGate((b.title || b.textContent || '').replace(/\(.*?\)/g, '').trim().slice(0, 18) || null);
}, true);

/* ④ 채팅 입력 */
const ci = $('#chatin');
if (ci) ci.addEventListener('focus', () => { if (isGuest() && NC.started) { ci.blur(); NC.memberGate('채팅'); } });

/* ⑤ 손님 배너 */
function banner() {
  let b = $('#guestBanner');
  if (!isGuest()) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('div'); b.id = 'guestBanner';
    b.innerHTML = '<span>👤 손님 모드 · 둘러보기 전용</span><button type="button">📝 회원가입</button>';
    document.body.appendChild(b);
    b.querySelector('button').onclick = () => popup(null);
  }
}
const css = document.createElement('style');
css.textContent = `#guestBanner{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 52px);transform:translateX(-50%);z-index:30;display:flex;gap:8px;align-items:center;
  padding:5px 6px 5px 12px;border-radius:999px;background:rgba(20,12,36,.82);border:1px solid rgba(255,95,210,.45);color:#f3e9ff;font-size:12px;backdrop-filter:blur(6px)}
#guestBanner button{border:0;border-radius:999px;padding:4px 10px;background:linear-gradient(90deg,#ff5fd2,#8a5bff);color:#fff;font-weight:700;font-size:12px;cursor:pointer}
body.guest #act{opacity:.85}
html.mobile #guestBanner{top:calc(env(safe-area-inset-top,0px) + 46px);font-size:11px}`;
document.head.appendChild(css);
NC.on('start', () => { NC.started = true; banner(); document.body.classList.toggle('guest', isGuest());
  if (isGuest()) setTimeout(() => NC.ui.toast('👤 손님 모드예요 — 자유롭게 둘러보세요. 대화·부킹·춤은 회원가입 후 이용할 수 있어요'), 2600); });
})();
