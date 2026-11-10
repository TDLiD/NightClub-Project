/* guests.js — v16 좌측 손님 리스트
 *  ■ 입장한 모든 AI 손님을 왼쪽에 세로로 나열 (이름 · 성별 · 지금 있는 곳 · 하는 일)
 *  ■ 이름을 누르면 그 사람 옆으로 자동 이동 (상대가 움직이면 따라가며 길을 다시 찾음) → 도착하면 E 로 말 걸기
 *  ■ 온라인 접속자(실제 사람)는 맨 위 「🌐 온라인 접속자」에 따로 표시
 *  ■ 검색 · 필터(전체/여성/남성/춤추는 중) · 접기
 */
(() => {
'use strict';
const NC = window.NC; if (!NC || !NC.world) return;
const W = NC.world, U = NC.util, P = () => NC.player;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const box = document.createElement('div'); box.id = 'guestList'; box.style.display = 'none';
box.innerHTML = `<div class="glHead"><b>👥 손님</b><span id="glCount"></span><button id="glFold" title="접기/펴기">▾</button></div>
  <div id="glBody"><input id="glSearch" placeholder="🔍 이름 검색" autocomplete="off">
  <div id="glFilter"><button data-f="all" class="on">전체</button><button data-f="f">♀ 여성</button><button data-f="m">♂ 남성</button><button data-f="dance">💃 춤</button></div>
  <div id="glOnline"></div><div id="glAI"></div></div>`;
document.body.appendChild(box);
const $ = s => box.querySelector(s);
let filter = 'all', folded = window.innerWidth < 700 || window.innerHeight < 500, follow = null;
const fold = v => { folded = v; box.classList.toggle('folded', v); $('#glFold').textContent = v ? '▸' : '▾'; };
$('#glFold').onclick = () => fold(!folded); box.querySelector('.glHead b').onclick = () => fold(!folded);
$('#glFilter').onclick = e => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.f; $('#glFilter').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); render(true); };
$('#glSearch').oninput = () => render(true);
$('#glSearch').addEventListener('keydown', e => e.stopPropagation());   // 검색창 타이핑이 WASD 이동으로 새지 않게
NC.on && NC.on('start', () => { box.style.display = ''; fold(folded); render(); });

const ACT = n => {
  if (n.party) return n.g.userData.dance === 'blues' ? '💕 블루스' : '🪩 디스코';
  switch (n.state) { case 'seated': return '🪑 앉아 있음'; case 'talk': return '💬 대화 중'; case 'blues': return '💕 블루스'; case 'tableDance': return '💃 테이블 댄스'; case 'ep': return '🎬 에피소드'; case 'path': return '🚶 이동 중'; case 'off': return '— 퇴장'; }
  return n.g.userData.dance ? '💃 춤추는 중' : '🚶 돌아다님';
};
const where = (x, z) => { const zn = W.zoneAt(x, z); if (zn.name === 'vip') return `VIP ${zn.room + 1}`; if (zn.name === 'tables') { const t = (NC.tables || []).reduce((a, b, i) => { const d = Math.hypot(b.x - x, b.z - z); return d < a.d ? { d, i } : a; }, { d: 99, i: -1 }); if (t.d < 3.4) return `T${t.i + 1}`; } return W.zoneLabel[zn.name] || zn.name; };
const isDancing = n => !!(n.party || n.g.userData.dance);

let hover = false, lastO = '', lastA = '';
box.addEventListener('mouseenter', () => { hover = true; }); box.addEventListener('mouseleave', () => { hover = false; });
function render(force) {
  if (box.style.display === 'none' || (hover && force !== true && !follow)) return;   // 마우스를 올려 둔 동안은 목록이 바뀌지 않게(클릭 놓침 방지)
  const q = $('#glSearch').value.trim(), all = (NC.npcs || []).filter(n => (n.role === 'crowd' || n.role === 'persona') && n.g.visible && n.state !== 'off');
  const list = all.filter(n => (!q || n.name.includes(q)) && (filter === 'all' || (filter === 'dance' ? isDancing(n) : n.gender === filter)));
  list.sort((a, b) => (a.role === 'persona' ? 0 : 1) - (b.role === 'persona' ? 0 : 1) || a.name.localeCompare(b.name, 'ko'));
  const rem = []; (NC.remotes || new Map()).forEach((r, id) => { if (r && r.g && (!q || String(r.name || '').includes(q))) rem.push([id, r]); });
  $('#glCount').textContent = ` AI ${all.length}${rem.length ? ' · 🌐 ' + rem.length : ''}`;
  const ho = rem.length ? `<div class="glSec">🌐 온라인 접속자 ${rem.length}명</div>` + rem.map(([id, r]) => `<div class="glRow online${follow && follow.rid === id ? ' go' : ''}" data-r="${esc(id)}"><i class="dot on"></i><b>${esc(r.name || '손님')}</b><small>${esc(where(r.g.position.x, r.g.position.z))}</small></div>`).join('') : (NC.mode === 'online' ? '<div class="glSec">🌐 온라인 접속자 0명</div>' : '');
  const ha = `<div class="glSec">🤖 AI 손님 ${list.length}명</div>` + list.map(n => `<div class="glRow${follow && follow.n === n ? ' go' : ''}" data-id="${esc(n.id)}"><i class="dot ${n.gender === 'f' ? 'f' : 'm'}">${n.gender === 'f' ? '♀' : '♂'}</i><b>${esc(n.name)}${n.role === 'persona' ? ' ⭐' : ''}</b><small>${esc(where(n.x, n.z))} · ${ACT(n)}</small></div>`).join('');
  if (ho !== lastO) $('#glOnline').innerHTML = lastO = ho; if (ha !== lastA) $('#glAI').innerHTML = lastA = ha;
}
box.addEventListener('click', e => {
  const row = e.target.closest('.glRow'); if (!row) return;
  if (row.dataset.r) { const r = NC.remotes.get(row.dataset.r); if (r) goTo({ rid: row.dataset.r, name: r.name, pos: () => r.g.position }); return; }
  const n = (NC.npcs || []).find(x => String(x.id) === row.dataset.id); if (n) goTo({ n, name: n.name, pos: () => ({ x: n.x, z: n.z }) });
});

/* ── 자동 이동: 상대 바로 옆(앉아 있으면 테이블 바깥쪽)으로 길찾기 → 상대가 움직이면 2초마다 다시 찾기 ── */
function targetNear(f) {
  const p = f.pos(), me = P(); let tx = p.x, tz = p.z;
  const n = f.n; if (n && n.state === 'seated' && n._seatArgs) { const t = (NC.tables || []).find(b => Math.hypot(b.x - p.x, b.z - p.z) < 2.6); if (t) { const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz) || 1; tx = t.x + dx / d * 3; tz = t.z + dz / d * 3; } }
  const dx = me.x - tx, dz = me.z - tz, d = Math.hypot(dx, dz) || 1; return { x: tx + dx / d * 1.1, z: tz + dz / d * 1.1 };
}
function goTo(f) {
  const me = P(); if (!me.group) return;
  if (me.busy || NC.Dialog && NC.Dialog.cur) return NC.ui.toast('지금은 이동할 수 없어요 (대화·이벤트 중)');
  const zn = W.zoneAt(me.x, me.z).name; if (['karaoke', 'restroom', 'wroom', 'smoke'].includes(zn)) return NC.ui.toast('클럽 홀로 나온 뒤 이동할 수 있어요');
  follow = Object.assign(f, { t0: performance.now(), next: 0 }); path(); NC.ui.toast(`🚶 ${f.name}님에게 가는 중… (아무 키나 누르면 멈춤)`); render();
}
function path() {
  const me = P(), to = targetNear(follow), r = NC.Path ? NC.Path.find(me, to) : null;
  if (r && r.length) NC.walkPlayer(r, arrived); else { me.target = to; }
  follow.next = performance.now() + 2000; follow.last = Object.assign({}, follow.pos());
}
function arrived() {
  if (!follow) return; const p = follow.pos(), me = P();
  if (Math.hypot(p.x - me.x, p.z - me.z) > 2.4) { path(); return; }
  me.ry = Math.atan2(p.x - me.x, p.z - me.z); if (me.group) me.group.rotation.y = me.ry;
  NC.ui.toast(`👋 ${follow.name}님 옆이에요${follow.n ? ' — E 로 말 걸기' : ''}`); follow = null; render();
}
NC.tickers.push(() => {
  if (!follow) return; const me = P(), now = performance.now();
  if (now - follow.t0 > 30000 || me.busy || (NC.Dialog && NC.Dialog.cur)) { follow = null; render(); return; }
  if (!me.autoPath && !me.target) { arrived(); return; }
  const p = follow.pos(); if (now > follow.next && Math.hypot(p.x - follow.last.x, p.z - follow.last.z) > 1.2) path();
});
addEventListener('keydown', e => { if (follow && !NC.ui.typing() && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes((e.key || '').toLowerCase())) { follow = null; render(); } });
setInterval(render, 1500);
NC.GuestList = { render, goTo };
})();
