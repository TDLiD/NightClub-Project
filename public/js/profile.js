/* profile.js — v33 프로필 사진: public/profile/boy(남성) · girl(여성) 폴더의 이미지를 모든 캐릭터 이미지에 사용
 *  ─ 목록: profile/index.json(썸네일·태그) + 서버 /api/profiles(폴더 실시간 목록 — 새 사진을 넣으면 자동 추가)
 *  ─ 배정: NPC 마다 성별 폴더에서 1장씩, 중복 최소화 · 인종(east/west/black…)·나이대(20대/30~40대/50대+)·실사 우선 점수로 매칭
 *          npcs.json 에서 "photo": "girl/image-005.jfif" 로 직접 지정 가능, "photo": false 면 사진 없이 3D 얼굴 유지
 *  ─ 사용처: 입장 화면(내 사진 고르기) · 회원가입/로그인 · 부킹 대화창 얼굴 · 프로필 카드 · 손님 리스트 · 머리 위 이름표 · 크게 보기
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, $ = s => document.querySelector(s);
const BASE = 'profile/';
const P = NC.Profile = { list: { boy: [], girl: [] }, byPath: {}, ready: null };
const gk = g => (g === 'f' || g === 'girl' || g === '여성') ? 'girl' : 'boy';
P.gk = gk;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ───── 목록 불러오기 ───── */
async function load() {
  let idx = null, live = null;
  try { const r = await fetch(BASE + 'index.json', { cache: 'no-cache' }); if (r.ok) idx = await r.json(); } catch (e) { }
  try { const r = await fetch('api/profiles', { cache: 'no-store' }); if (r.ok) live = await r.json(); } catch (e) { }
  for (const g of ['boy', 'girl']) {
    const known = (idx && Array.isArray(idx[g])) ? idx[g] : [];
    let arr = known.slice();
    if (live && Array.isArray(live[g])) {   // 서버가 있으면 실제 폴더 기준: 지운 파일은 빼고, 새 파일은 태그 없이 추가
      const files = new Set(live[g]), have = new Set(known.map(e => e.f));
      arr = arr.filter(e => files.has(e.f.split('/').pop()));
      live[g].forEach(fn => { const f = g + '/' + fn; if (!have.has(f)) arr.push({ f, t: null }); });
    }
    P.list[g] = arr; arr.forEach(e => { P.byPath[e.f] = e; });
  }
  console.info(`[profile] 남 ${P.list.boy.length} · 여 ${P.list.girl.length}장`);
}
P.ready = load().then(() => { P.loaded = true; });
P.pool = g => P.list[gk(g)].filter(e => !e.dup && !e.res);   // res = 특정 캐릭터 전용 사진(v34.1)
P.url = (path, big) => { if (!path) return null; const e = P.byPath[path]; if (big === 'mini') return BASE + (e && (e.m || e.t) || path); return BASE + (big || !e || !e.t ? path : e.t); };   // v34 'mini' = 128x160 (리스트·이름표·카드 — 모바일 메모리 절약)
const imgCache = {};
P.img = (path, big) => { const u = P.url(path, big); if (!u) return Promise.reject(); return imgCache[u] || (imgCache[u] = new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => { delete imgCache[u]; rej(new Error('img ' + u)); }; im.src = u; })); };

/* 캔버스에 사진을 꽉 차게(cover) — 얼굴이 위쪽에 있으므로 세로는 위 18% 기준 */
function cover(g, im, x, y, w, h) {
  const r = Math.max(w / im.naturalWidth, h / im.naturalHeight), sw = w / r, sh = h / r;
  const sx = (im.naturalWidth - sw) / 2, sy = Math.max(0, (im.naturalHeight - sh) * .18);
  g.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}
P.cover = cover;

/* ───── NPC 배정 ───── */
const WEST_NAMES = /^(소피아|클로이|제이크|레오|니콜|마르코|Sophia|Chloe|Jake|Leo|Nicole|Marco)$/;
function ethOf(n) {
  const L = (n.def && n.def.look) || (n.g && n.g.userData.look) || {};
  if (L.ethnic === 'jp' || L.ethnic === 'east') return 'east'; if (L.ethnic) return L.ethnic;
  const sk = L.skin; if (typeof sk === 'string' && /^#[0-9a-f]{6}$/i.test(sk)) { const c = parseInt(sk.slice(1), 16), lum = ((c >> 16) & 255) * .3 + ((c >> 8) & 255) * .59 + (c & 255) * .11; if (lum < 125) return 'black'; }
  return WEST_NAMES.test(n.name) ? 'west' : 'east';
}
const band = a => a >= 48 ? 'old' : a >= 30 ? 'm' : 'y';
function score(e, eth, b) {
  let s = 0;
  if (!e.eth) s += 1.5; else if (e.eth === eth) s += 4; else if (eth !== 'east' && e.eth !== 'east') s += 1.2;
  if (!e.age) s += .8; else if (e.age === b) s += 3; else if (b === 'm' || e.age === 'm') s += .8;
  s += { photo: 1.4, art: .6, cartoon: 0, anime: -1.2, fantasy: -1 }[e.style] || 0;
  return s;
}
const used = { boy: new Map(), girl: new Map() }; let reserved = false;
function reserve() { if (reserved) return; reserved = true; (NC.npcs || []).forEach(n => { const d = n.def || {}; if (d.photo) used[gk(n.gender)].set(d.photo, 9); }); }   // 직접 지정한 사진은 다른 사람에게 안 줌
P.assignOne = n => {
  if (!n || !n.g || n._ph) return; n._ph = true; const d = n.def || {}; if (d.photo === false) return;
  const g = gk(n.gender), age = +d.age || +String(n.job || '').match(/^(\d+)/)?.[1] || 27;
  let path = d.photo;
  if (!path) {
    const eth = ethOf(n), b = band(age); let best = null, bs = -1e9;
    P.pool(g).forEach(e => {
      if (age >= 40 && (e.age === 'y' || (e.eth && e.eth !== eth))) return;   // 40대 이상은 나이·인종이 맞는 사진이 없으면 3D 얼굴 유지
      const s = score(e, eth, b) - (used[g].get(e.f) || 0) * 7 + (U.hash(String(n.id) + e.f) % 100) / 400;
      if (s > bs) { bs = s; best = e; } });
    if (!best) return; path = best.f; used[g].set(path, (used[g].get(path) || 0) + 1);
  }
  P.setFor(n, path);
};
P.assignAll = () => {
  reserve();
  (NC.npcs || []).slice().sort((a, b) => (a.role === 'persona' ? 0 : 1) - (b.role === 'persona' ? 0 : 1)).forEach(P.assignOne);
  NC.emit && NC.emit('profile:assigned');
};
/* 저사양은 NPC 를 한 명씩 나눠 만들므로, 만들어질 때마다 배정 */
{ let last = 0; NC.tickers.push(() => { const now = performance.now(); if (!P.loaded || now - last < 700) return; last = now; const ns = NC.npcs || []; if (ns.some(n => !n._ph)) P.assignAll(); }); }
P.setFor = (n, path) => { n.photo = path; const u = n.g && n.g.userData; if (!u) return; u.look.photo = path; P.decorate(n.g); };

/* ───── 머리 위 이름표: 왼쪽에 동그란 사진 ───── */
P.decorate = g => {
  const u = g && g.userData, path = u && u.look && u.look.photo; if (!u || !u.label || !path) return;
  P.img(path, 'mini').then(im => {
    const s = u.label, tex = s.material.map, c = tex && tex.image; if (!c || !c.getContext) return;
    const x = c.getContext('2d'), name = String(u.name || '').trim(), col = (u.look && u.look.topColor) || '#ff3d9a';
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(25,12,52,.82)'; x.strokeStyle = col; x.lineWidth = 3;
    x.beginPath(); x.roundRect ? x.roundRect(4, 8, 312, 60, 30) : x.rect(4, 8, 312, 60); x.fill(); x.stroke();
    x.save(); x.beginPath(); x.arc(40, 38, 27, 0, 7); x.clip(); cover(x, im, 13, 11, 54, 54); x.restore();
    x.beginPath(); x.arc(40, 38, 27, 0, 7); x.lineWidth = 2.5; x.strokeStyle = 'rgba(255,255,255,.85)'; x.stroke();
    let fs = 32; x.font = `700 ${fs}px "Malgun Gothic","Apple SD Gothic Neo",sans-serif`; while (x.measureText(name).width > 228 && fs > 18) { fs -= 2; x.font = `700 ${fs}px "Malgun Gothic","Apple SD Gothic Neo",sans-serif`; }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(name, 188, 40);
    tex.needsUpdate = true;
  }).catch(() => { });
};

/* ───── 대화창 얼굴(미리보기 캔버스)을 사진으로 ───── */
if (NC.Avatar && NC.Avatar.preview) {
  const orig = NC.Avatar.preview;
  NC.Avatar.preview = function (cv, look, expr) {
    const path = look && look.photo;
    if (!path) { if (cv.dataset.ph) { cv.width = +cv.dataset.w; cv.height = +cv.dataset.h; delete cv.dataset.ph; cv.style.width = cv.style.height = ''; } cv.classList.remove('hasPhoto'); return orig.apply(this, arguments); }
    if (!cv.dataset.w) { cv.dataset.w = cv.width; cv.dataset.h = cv.height; }
    const W = +cv.dataset.w, H = +cv.dataset.h; cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = W * 2; cv.height = H * 2; cv.dataset.ph = path; cv.classList.add('hasPhoto');
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    P.img(path).then(im => { if (cv.dataset.ph !== path) return; g.clearRect(0, 0, cv.width, cv.height); g.save(); g.beginPath(); g.roundRect ? g.roundRect(0, 0, cv.width, cv.height, 22) : g.rect(0, 0, cv.width, cv.height); g.clip(); cover(g, im, 0, 0, cv.width, cv.height); g.restore(); }).catch(() => { delete cv.dataset.ph; orig.call(NC.Avatar, cv, look, expr); });
  };
}

/* ───── 크게 보기 (대화창 얼굴 · 프로필 카드 사진 클릭) ───── */
P.view = (path, title, sub) => {
  if (!path) return;
  NC.ui.modal(`<div class="phView"><img src="${esc(P.url(path, true))}" alt="" onerror="this.src='${esc(P.url(path))}'"><h3>${esc(title || '')}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`, [['닫기', 0, true]]);
};
{ const tf = $('#tFace'); if (tf) { tf.style.cursor = 'zoom-in'; tf.title = '사진 크게 보기'; tf.addEventListener('click', () => { const n = NC.Dialog && NC.Dialog.cur && NC.Dialog.cur.n; if (n && n.photo) P.view(n.photo, n.name, n.job || ''); }); } }

/* ───── 내 프로필 사진 ───── */
const LS = 'nc_photo';
P.mine = () => (NC.account && NC.account.photo) || U.store.get(LS, null);
P.defaultFor = (g, seed) => { const pool = P.pool(g).filter(e => e.style === 'photo' || !e.style); const arr = pool.length ? pool : P.pool(g); return arr.length ? arr[U.hash(String(seed || Math.random())) % arr.length].f : null; };
P.saveMine = async path => {
  const a = NC.account;
  if (a && a.uid && NC.Auth && NC.Auth.DB) {
    const r = await fetch(`${NC.Auth.DB}/users/${a.uid}/photo.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(path) });
    if (!r.ok) throw new Error('사진 저장 실패 (' + r.status + ')');
    a.photo = path; U.store.set('nc_session', a);
  } else U.store.set(LS, path);
  NC.emit && NC.emit('profile:mine', path);
};
/* 사진 고르기 창: 성별 폴더만 보여 줌 → 고른 경로를 돌려줌 */
P.pick = (g, cur) => new Promise(res => {
  const key = gk(g), pool = P.pool(key);
  if (!pool.length) { NC.ui.modal(`<h3>📷 프로필 사진</h3><p style="font-size:13px">public/profile/${key}/ 폴더에 사진이 없어요.</p>`, [['확인', 0, true]]); return res(null); }
  let sel = cur && P.byPath[cur] && cur.startsWith(key + '/') ? cur : null;
  NC.ui.modal(`<h3>📷 프로필 사진 고르기 <small style="opacity:.65">${key === 'girl' ? '👩 여성' : '👨 남성'} ${pool.length}장</small></h3>
    <div id="phGrid">${pool.map(e => `<button type="button" class="phc${e.f === sel ? ' on' : ''}" data-p="${esc(e.f)}"><img loading="lazy" src="${esc(P.url(e.f))}" alt=""></button>`).join('')}</div>`,
    [['선택', 'ok', true], ['취소', 0]]).then(r => res(r.val === 'ok' ? sel : null));
  const grid = $('#phGrid'); grid.onclick = e => { const b = e.target.closest('.phc'); if (!b) return; sel = b.dataset.p; grid.querySelectorAll('.phc').forEach(x => x.classList.toggle('on', x === b)); };
  grid.ondblclick = e => { const b = e.target.closest('.phc'); if (b) { sel = b.dataset.p; const ok = [...document.querySelectorAll('.modal button')].find(x => x.textContent === '선택'); ok && ok.click(); } };
});

/* ───── 입장 화면: 3D 미리보기 옆 동그란 내 사진 + 고르기 ───── */
const myGender = () => { const a = NC.account; if (a) return a.gender === '여성' ? 'f' : 'm'; const c = NC.entry && NC.entry.cfg; return (c && c.gender) || 'f'; };
function startChip() {
  const host = $('#start .custom'); if (!host) return; let chip = $('#myPhoto');
  if (!chip) { chip = document.createElement('button'); chip.type = 'button'; chip.id = 'myPhoto'; chip.title = '프로필 사진 고르기'; chip.innerHTML = '<img alt=""><span>📷 사진</span>';
    const fp = $('#facePrev'); if (fp && fp.parentNode) { const w = document.createElement('span'); w.id = 'fpWrap'; fp.parentNode.insertBefore(w, fp); w.appendChild(fp); w.appendChild(chip); } else host.appendChild(chip);
    chip.onclick = async () => { const g = myGender(), p = await P.pick(g, P.mine()); if (!p) return; try { await P.saveMine(p); } catch (e) { NC.ui.toast(e.message); } refreshChip(); }; }
  refreshChip();
}
function refreshChip() {
  const chip = $('#myPhoto'); if (!chip) return; const g = myGender(); let p = P.mine();
  if (!p || !p.startsWith(gk(g) + '/') || !P.byPath[p]) { p = P.defaultFor(g, (NC.account && NC.account.id) || ($('#nick') && $('#nick').value) || 'guest'); if (p && !NC.account) U.store.set(LS, p); }
  chip.querySelector('img').src = p ? P.url(p) : ''; chip.classList.toggle('empty', !p);
  const lp = $('#lgPhoto img'); if (lp && p) lp.src = P.url(p);
}
P.refreshChip = refreshChip;
P.ready.then(() => { startChip(); });
document.addEventListener('click', e => { if (e.target.closest('#cGender button, #authTabs button, #lgOut')) setTimeout(refreshChip, 60); }, true);

/* 입장 직전: 내 look 에 사진 경로를 넣음(온라인이면 다른 접속자에게도 전달) */
NC.hooks.beforeStart.push(async () => { try { await P.ready; } catch (e) { } const g = myGender(); let p = P.mine(); if (!p || !p.startsWith(gk(g) + '/') || !P.byPath[p]) p = P.defaultFor(g, NC.settings.name); /* 파일명이 바뀌어 없어진 사진이면 새로 고름 */ if (NC.settings.look) NC.settings.look.photo = p || null; });
NC.on && NC.on('player:look', () => { const pg = NC.player && NC.player.group; if (pg && NC.settings.look && !pg.userData.look.photo) { pg.userData.look.photo = NC.settings.look.photo || P.mine(); P.decorate(pg); } });
NC.on && NC.on('profile:mine', p => { const pg = NC.player && NC.player.group; if (pg) { pg.userData.look.photo = p; if (NC.settings.look) NC.settings.look.photo = p; P.decorate(pg); } });

/* NPC 가 모두 만들어진 뒤 배정 */
Promise.all([P.ready, NC.dataReady || Promise.resolve()]).then(() => setTimeout(P.assignAll, 50)).catch(() => P.ready.then(() => setTimeout(P.assignAll, 50)));

/* ───── 스타일 ───── */
const st = document.createElement('style'); st.textContent = `
#tFace.hasPhoto{background:#120a24;box-shadow:0 0 0 2px rgba(255,140,210,.65),0 4px 14px rgba(0,0,0,.45)}
#fpWrap{position:relative;display:inline-block;flex:none;align-self:center}
#myPhoto{position:absolute;right:-12px;bottom:-10px;width:58px;height:56px;padding:0;border-radius:50%;border:2px solid #ff5fd2;background:#1a1030;overflow:hidden;cursor:pointer;flex:none;z-index:2;box-shadow:0 3px 10px rgba(0,0,0,.5)}
#myPhoto img{width:100%;height:100%;object-fit:cover;object-position:50% 18%;display:block}
#myPhoto span{position:absolute;left:0;right:0;bottom:0;font-size:9px;line-height:15px;background:rgba(0,0,0,.6);color:#fff;text-align:center}
#myPhoto.empty img{display:none}
#phGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:7px;max-height:56vh;overflow:auto;padding:2px;margin-top:6px}
#phGrid .phc{padding:0;border:2px solid transparent;border-radius:12px;overflow:hidden;background:#120a24;cursor:pointer;aspect-ratio:4/5}
#phGrid .phc img{width:100%;height:100%;object-fit:cover;object-position:50% 18%;display:block}
#phGrid .phc.on{border-color:#ff5fd2;box-shadow:0 0 0 2px rgba(255,95,210,.35)}
.phView{text-align:center}.phView img{max-width:min(78vw,420px);max-height:62vh;border-radius:14px;display:block;margin:0 auto 8px;box-shadow:0 8px 28px rgba(0,0,0,.55)}
.phView h3{margin:4px 0 2px}.phView p{margin:0;font-size:12.5px;opacity:.8}
.glRow .gph{grid-row:1/3;align-self:center;width:24px;height:24px;border-radius:50%;object-fit:cover;object-position:50% 18%;border:1.5px solid rgba(255,255,255,.35)}
.glRow .gph.f{border-color:rgba(255,92,170,.9)}.glRow .gph.m{border-color:rgba(61,150,255,.9)}
#guestList .glRow:has(.gph){grid-template-columns:26px 1fr}
#profCard .pcPh{pointer-events:auto;float:left;width:54px;height:66px;margin:0 8px 4px 0;border-radius:9px;object-fit:cover;object-position:50% 18%;border:1.5px solid rgba(255,140,210,.7);cursor:zoom-in}
#lgPhoto{display:inline-block;width:46px;height:46px;border-radius:50%;overflow:hidden;border:2px solid #ff5fd2;vertical-align:middle;margin-right:8px;cursor:pointer}
#lgPhoto img{width:100%;height:100%;object-fit:cover;object-position:50% 18%}
.jnPh{display:flex;align-items:center;gap:8px}.jnPh img{width:44px;height:54px;border-radius:9px;object-fit:cover;object-position:50% 18%;border:1.5px solid #ff5fd2;background:#120a24}`;
document.head.appendChild(st);
})();
