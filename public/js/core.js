/* core.js — 공용 네임스페이스(NC) · 렌더러/씬 · 머티리얼 · 이벤트 버스 · UI 도우미
 * 로드 순서: three → core → avatar → motion → world → audio → affinity → npc → dialog → waiter → minigames → main
 */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const T = window.THREE;
if (!T) return;

const NC = window.NC = {
  THREE: T, $, version: '13.0.0', mode: 'demo', chatEnabled: false, server: false, config: {},
  settings: { name: '', color: 0xff3d9a, look: null, playMode: 'solo' },
  hooks: { beforeStart: [] }, interactProviders: [], tickers: [],
  remotes: new Map(), ui: {}, net: null, session: null, listeners: {},
  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
  off(ev, fn) { const l = this.listeners[ev]; if (l) this.listeners[ev] = l.filter(f => f !== fn); },
  emit(ev, ...a) { (this.listeners[ev] || []).slice().forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); },
};

/* ── 유틸 ── */
const U = NC.util = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  lerpAngle(a, b, t) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; },
  rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; },
  hexNum(v, d) { if (typeof v === 'number') return v; const m = /^#?([0-9a-f]{6})$/i.exec(String(v || '')); return m ? parseInt(m[1], 16) : d; },
  esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  pick: (arr, r = Math.random) => arr[Math.floor(r() * arr.length)],
  dist: (a, b) => Math.hypot(a.x - b.x, a.z - b.z),
  store: { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } },
};

/* ── 렌더러 / 씬 ──
 * 밝은 클럽 연출: sRGB 출력 + ACES 톤매핑 + 노출 1.3. 색상은 sRGB hex로 쓰고 col()로 선형 변환.
 */
const canvas = $('#c');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(55, 1, 0.1, 180);
Object.assign(NC, { renderer, scene, camera, canvas });
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

NC.col = c => new T.Color(typeof c === 'string' ? U.hexNum(c, 0xffffff) : c).convertSRGBToLinear();
NC.mat = {
  std: (c, o = {}) => { const m = new T.MeshStandardMaterial(Object.assign({ roughness: .7, metalness: .05 }, o)); m.color = NC.col(c); if (o.emissive != null) m.emissive = NC.col(o.emissive); return m; },
  emi: (c, i = 1) => { const m = new T.MeshStandardMaterial({ color: 0x000000, emissiveIntensity: i, roughness: .6 }); m.emissive = NC.col(c); return m; },
  glow: (c, op = 1) => { const m = new T.MeshBasicMaterial({ transparent: op < 1, opacity: op }); m.color = NC.col(c); return m; },
  add: (c, op = .2) => { const m = new T.MeshBasicMaterial({ transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }); m.color = NC.col(c); return m; },
};
NC.tex = cv => { const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
NC.textTex = function (txt, w, h, font, color, glow, bg) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (glow) { g.shadowColor = glow; g.shadowBlur = 24; }
  g.fillStyle = color; for (let i = 0; i < 2; i++) g.fillText(txt, w / 2, h / 2);
  return NC.tex(c);
};
NC.neonSign = (txt, w, h, opt = {}) => {
  const tex = NC.textTex(txt, opt.pw || 1024, opt.ph || 256, opt.font || '800 130px "Malgun Gothic",sans-serif', opt.color || '#ffe3f3', opt.glow || '#ff3d9a');
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
};
const softDot = (() => { let t; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new T.CanvasTexture(c); return t; }; })();
NC.softDot = softDot;

/* ── UI 도우미 ── */
NC.ui.toast = msg => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; $('#toast').appendChild(d); setTimeout(() => d.remove(), 3700); };
NC.ui.chatAdd = (who, text, cls) => { const l = $('#chatlog'), d = document.createElement('div'); if (cls) d.className = cls; if (who) { const b = document.createElement('b'); b.textContent = who + ' '; d.appendChild(b); } d.appendChild(document.createTextNode(text)); l.appendChild(d); l.scrollTop = 1e9; while (l.children.length > 80) l.firstChild.remove(); };
NC.ui.modal = (html, buttons) => new Promise(res => {
  const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = '<div class="box">' + html + '<div class="row"></div></div>'; const row = m.querySelector('.row');
  buttons.forEach(([label, val, pri]) => { const b = document.createElement('button'); b.textContent = label; if (pri) b.className = 'pri'; b.onclick = () => { res({ val, root: m }); m.remove(); }; row.appendChild(b); });
  document.body.appendChild(m);
});
NC.ui.fade = fn => { const f = $('#fade'); f.style.opacity = 1; setTimeout(() => { try { fn(); } finally { f.style.opacity = 0; } }, 380); };
NC.ui.typing = () => { const a = document.activeElement; return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')); };

/* 대화창(선택지형) — 웨이터·간단 부킹·미니게임 안내에서 공용 사용 */
const dlg = $('#dlg');
NC.ui.showDlg = o => {
  dlg.style.display = 'block';
  dlg.innerHTML = `<div class="who"><span></span><span class="tag"></span><span class="job"></span></div><div class="say"></div><div class="opts"></div>`;
  dlg.querySelector('.who span').textContent = o.name || ''; dlg.querySelector('.tag').textContent = o.tag || ''; dlg.querySelector('.job').textContent = o.job || '';
  if (!o.tag) dlg.querySelector('.tag').style.display = 'none';
  dlg.querySelector('.say').textContent = o.say || '';
  const box = dlg.querySelector('.opts');
  (o.opts || []).forEach((p, i) => { const b = document.createElement('button'); b.className = 'opt'; b.textContent = (i + 1) + '. ' + p.t; if (p.disabled) b.disabled = true; b.onclick = p.run; box.appendChild(b); });
};
NC.ui.hideDlg = () => { dlg.style.display = 'none'; dlg.innerHTML = ''; };
NC.ui.dlgOpen = () => dlg.style.display === 'block';
addEventListener('keydown', e => { if (NC.ui.dlgOpen() && !NC.ui.typing() && /^[1-6]$/.test(e.key)) { const b = dlg.querySelectorAll('button.opt')[+e.key - 1]; if (b && !b.disabled) { b.click(); e.preventDefault(); } } });

/* ── 지갑(가상 재화 🪙 클럽 코인) — 현금 가치 없음, 로컬 저장 ── */
NC.Wallet = {
  get() { return U.store.get('nc_coins', 120); },
  add(n, why) { const v = Math.max(0, this.get() + n); U.store.set('nc_coins', v); NC.emit('coins', v, n, why); if (n > 0 && why) NC.ui.toast(`🪙 +${n} (${why})`); return v; },
  spend(n) { if (this.get() < n) return false; this.add(-n); return true; },
};
(function dailyBonus() { const d = new Date().toDateString(); if (U.store.get('nc_daily') !== d) { U.store.set('nc_daily', d); setTimeout(() => NC.Wallet.add(50, '오늘의 출석 보너스'), 4000); } })();
})();
