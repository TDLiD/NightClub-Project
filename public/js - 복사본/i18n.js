/* i18n.js — 한국어 / English 전환 (v43)
 *  ■ 상단 🌐 버튼(시작 화면·게임 화면 공통)으로 언어 선택 → localStorage 'nc_lang' 저장 후 새로고침(세션·이어서 입장 유지)
 *  ■ 화면 문구: DOM 텍스트·title/placeholder 속성(MutationObserver) + 캔버스에 그리는 글자(이름표·말풍선·간판·노래방 화면: fillText/strokeText/measureText)
 *     사전: i18n/en.json  { exact: {한국어: English}, pats: [[정규식, "...\0 1\0..."]] }  — ${이름} 같은 변수가 든 문장은 정규식 패턴으로 번역
 *  ■ 데이터: 영어일 때 data/en/{npcs,dialogs,waiter,minigames}.json 을 대신 읽음(없으면 한국어 원본)
 *  ■ 이름: 사전에 없는 짧은 한글 낱말(사람 이름 등)은 로마자 표기(국어의 로마자 표기법)로 자동 변환 — 저장 데이터의 이름 키는 그대로
 *  ■ 음성 인식: 영어일 때 en-US
 *  ■ 대형 대화 데이터(conversations.json)는 3단계에서 배치 번역 예정 — 아직 번역 안 된 대사는 한국어로 표시
 */
(() => {
'use strict';
const NC = window.NC || (window.NC = {});
const KEY = 'nc_lang';
let LANG = 'ko'; try { LANG = localStorage.getItem(KEY) || (/[?&]lang=en/.test(location.search) ? 'en' : 'ko'); } catch (e) { /* 저장소 막힘 */ }
if (/[?&]lang=(ko|en)/.test(location.search)) LANG = location.search.match(/[?&]lang=(ko|en)/)[1];
const EN = LANG === 'en';
const I = NC.I18N = { lang: LANG, ready: !EN, exact: null, pats: [], misses: new Set() };
NC.lang = LANG;
document.documentElement.lang = LANG;
const HAN = /[가-힣]/;

/* ── 로마자 표기(국어의 로마자 표기법, 이름용 간이판) ── */
const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
function romanize(s) {
  let out = '', prevJong = -1;
  for (const ch of s) { const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c > 11171) { out += ch; prevJong = -1; continue; }
    const cho = Math.floor(c / 588), jung = Math.floor((c % 588) / 28), jong = c % 28;
    let ini = CHO[cho]; if (cho === 5) ini = prevJong === 8 ? 'l' : 'r';
    out += ini + JUNG[jung] + JONG[jong]; prevJong = jong; }
  return out.replace(/(^|[\s·(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}
I.romanize = romanize;

/* ── 번역 ── */
const cache = new Map(), OUT = new Set(); let depth = 0;   // OUT: 번역 결과물(다시 번역하지 않음 → 무한 반복 방지)
function trCore(t) {
  const E = I.exact; if (!E) return null;
  if (E[t] != null) return E[t];
  for (const [re, en] of I.pats) { const m = re.exec(t); if (m) return en.replace(/\0(\d)\0/g, (_, k) => tr(m[+k] || '')); }
  return null;
}
function tr(s) {
  if (!EN || s == null) return s; s = String(s); if (!HAN.test(s) || OUT.has(s)) return s;
  const c = cache.get(s); if (c != null) return c;
  if (depth > 3) return s; depth++; try { return tr0(s); } finally { depth--; }
}
function tr0(s) {
  const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0], t = s.trim();
  let r = trCore(t);
  if (r == null) {   // 구분자로 나뉜 조각별 번역(예: "🪙 코인 · 닉네임 · 내 캐릭터 저장")
    const parts = t.split(/(\s*[·|/]\s*|\s+—\s+|\n)/);
    if (parts.length > 1) { let ok = true; const o = parts.map(p => { if (!HAN.test(p)) return p; const q = trCore(p.trim()) ?? (/^[가-힣]{1,4}$/.test(p.trim()) ? romanize(p.trim()) : null); if (q == null) ok = false; return q ?? p; }); if (ok) r = o.join(''); }
  }
  if (r == null) {   // 이모지·기호 접두를 떼고 다시
    const m = t.match(/^([^가-힣A-Za-z0-9]+)(.*)$/); if (m && m[2]) { const q = trCore(m[2]); if (q != null) r = m[1] + q; }
  }
  if (r == null && /^[가-힣]{1,4}$/.test(t)) r = romanize(t);   // 이름(한 낱말, 4자 이하)만 로마자로 — 문장을 로마자로 바꾸지 않음
  if (r == null && /^(.+?)(님|씨)(.*)$/.test(t)) { const m = t.match(/^(.+?)(님|씨)(.*)$/); if (m[1].length <= 5) { const rest = m[3] ? trCore(m[3].trim()) : ''; if (rest != null) r = romanize(m[1]) + (rest ? ' ' + rest : ''); } }
  if (r == null) { I.misses.add(t); r = t; }
  r = lead + r + tail; if (cache.size > 6000) { cache.clear(); OUT.clear(); } cache.set(s, r); OUT.add(r); return r;
}
NC.t = tr; I.tr = tr;

/* ── 데이터 파일: 영어면 data/en/ 우선 ── */
if (EN && window.fetch) {
  const of = window.fetch.bind(window);
  window.fetch = (url, opt) => {
    const u = typeof url === 'string' ? url : url && url.url;
    const m = u && u.match(/(^|\/)data\/(npcs|dialogs|waiter|minigames)\.json/);
    if (m) return of(u.replace(/data\/(npcs|dialogs|waiter|minigames)\.json/, 'data/en/$1.json'), opt).then(r => r.ok ? r : of(url, opt)).catch(() => of(url, opt));
    return of(url, opt);
  };
}

/* ── 캔버스 글자(이름표·말풍선·간판·노래방 화면) ── */
if (EN && window.CanvasRenderingContext2D) {
  const P = CanvasRenderingContext2D.prototype;
  for (const fn of ['fillText', 'strokeText', 'measureText']) { const o = P[fn]; P[fn] = function (text, ...a) { return o.call(this, typeof text === 'string' && HAN.test(text) ? tr(text) : text, ...a); }; }
}

/* ── DOM ── */
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'], SET = new WeakMap();
function fixNode(n) {
  if (n.nodeType === 3) { const v = n.nodeValue; if (v && HAN.test(v) && SET.get(n) !== v) { const r = tr(v); if (r !== v) { SET.set(n, r); n.nodeValue = r; } } return; }
  if (n.nodeType !== 1) return; const tag = n.tagName; if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
  fixAttrs(n);
  if (tag === 'INPUT' && (n.type === 'button' || n.type === 'submit') && HAN.test(n.value)) n.value = tr(n.value);
  if (tag === 'OPTION' && HAN.test(n.textContent)) n.textContent = tr(n.textContent);
  for (let c = n.firstChild; c; c = c.nextSibling) fixNode(c);
}
function fixAttrs(n) { for (const a of ATTRS) { const v = n.getAttribute && n.getAttribute(a); if (v && HAN.test(v)) { const r = tr(v); if (r !== v) n.setAttribute(a, r); } } }   // 바뀔 때만 씀(같은 값 재설정 → 변경 감지 무한 반복 방지)
I.fix = fixNode;
function startDOM() {
  if (!document.body) return; fixNode(document.body); document.title = tr(document.title);
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') fixNode(m.target); else if (m.type === 'attributes') fixAttrs(m.target); else m.addedNodes.forEach(fixNode); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
if (EN) {
  const xhr = new XMLHttpRequest(); xhr.open('GET', 'i18n/en.json', false);   // 동기 로드(첫 화면부터 영어, 약 120KB · 캐시됨)
  try { xhr.send(); if (xhr.status === 200) { const d = JSON.parse(xhr.responseText); I.exact = d.exact; I.pats = d.pats.map(([re, en]) => [new RegExp(re), en]); I.ready = true; } } catch (e) { console.warn('[i18n] 사전 로드 실패', e); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startDOM); else startDOM();
}

/* ── 상단 언어 버튼 ── */
function button() {
  if (document.getElementById('langBtn')) return;
  const b = document.createElement('button'); b.id = 'langBtn'; b.className = 'ibtn'; b.type = 'button';
  b.textContent = EN ? '🌐 한국어' : '🌐 EN'; b.title = EN ? '한국어로 보기' : 'View in English';
  b.style.cssText = 'font-size:12px;padding:0 9px;width:auto;min-width:54px;white-space:nowrap';
  b.onclick = () => { const next = EN ? 'ko' : 'en'; try { localStorage.setItem(KEY, next); } catch (e) { /* */ }
    const q = location.search.replace(/[?&]lang=(ko|en)/, '').replace(/^&/, '?'); location.href = location.pathname + (q && q !== '?' ? q : '') + location.hash; };
  const host = document.getElementById('topbtns'); if (host) host.insertBefore(b, host.firstChild);
  else { b.style.cssText += ';position:fixed;top:8px;right:8px;z-index:9999'; document.body.appendChild(b); }
  // 시작 화면에도(상단바가 가려지는 경우) 작은 버튼
  const start = document.getElementById('start') || document.getElementById('intro');
  if (start && !host && !document.getElementById('langBtn2')) { const c = b.cloneNode(true); c.id = 'langBtn2'; c.onclick = b.onclick; c.style.cssText = 'position:absolute;top:10px;right:10px;z-index:20;font-size:12px;padding:4px 10px;border-radius:14px;background:rgba(20,10,30,.7);color:#fff;border:1px solid rgba(255,255,255,.35);cursor:pointer'; start.appendChild(c); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', button); else button();

/* ── 음성 인식 언어 ── */
if (EN) { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (SR) { const d = Object.getOwnPropertyDescriptor(SR.prototype, 'lang'); if (d && d.set) Object.defineProperty(SR.prototype, 'lang', { get: d.get, set(v) { d.set.call(this, v === 'ko-KR' ? 'en-US' : v); }, configurable: true }); } }
I.report = () => [...I.misses];
console.info('[i18n] 언어: ' + (EN ? 'English' : '한국어') + (EN ? ` · 사전 ${I.exact ? Object.keys(I.exact).length : 0}개 + 패턴 ${I.pats.length}개` : ''));
})();
