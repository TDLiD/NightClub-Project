/* aicount.js — v77 👑 관리자: AI 손님 수 조절(상단 바)
 *  ■ 관리자 계정(role=admin)으로 로그인하면 상단 👑 옆에 「🤖 AI 손님 N명  − ＋」
 *  ■ 홀에서 돌아다니는 AI 손님(군중·페르소나) 수를 그 숫자로 맞춤 — 늘리면 쉬던 손님이 나타나고, 줄이면 한가한 손님부터 퇴장
 *     · 그대로 두는 손님: 항상 나오는 주요 인물(Lena·Alex Kim·조여사·재숙이 등), 대화·블루스·부킹·테이블·룸·흡연실 등에 있는 손님
 *  ■ 값은 DB config/aiGuests 에 저장 → 다른 접속자도 입장할 때·30초마다 같은 수로 맞춤(관리자가 아니면 조절 버튼은 안 보임)
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const AC = NC.AICount = { target: null, max: 0, last: 0 };
const pool = () => (NC.npcs || []).filter(n => n.role === 'crowd' || n.role === 'persona');
const pinned = n => !!(n.def && (n.def.always || n.def.wardrobe));
const busy = n => n.booked || n.karaoke || n.stay || n._dk || n._sd || n._escortBy || ['seated', 'talk', 'blues', 'karaoke', 'escort', 'party'].includes(n.state) || (NC.Dialog && NC.Dialog.cur && NC.Dialog.cur.n === n) || (NC.Karaoke && NC.Karaoke.BL && NC.Karaoke.BL.n === n);
const active = n => n.enabled !== false && n.state !== 'off' && n.g && n.g.visible;
AC.count = () => pool().filter(active).length;
AC.apply = t => {
  const P = pool(); AC.max = P.length; if (t == null) return; t = Math.max(0, Math.min(P.length, t | 0)); AC.target = t;
  let on = P.filter(active); const keep = on.filter(n => pinned(n) || busy(n)).length;
  if (on.length > t) { const drop = on.filter(n => !pinned(n) && !busy(n)).sort((a, b) => String(b.id).localeCompare(String(a.id))); for (const n of drop) { if (on.length <= Math.max(t, keep)) break; NC.NPC.show(n, false); on = on.filter(x => x !== n); } }
  else if (on.length < t) { const W = NC.world, add = P.filter(n => !active(n) && !n.stay && !n.booked).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const n of add) { if (on.length >= t) break; const z = W && W.zones && (W.zones.dance || W.zones.hall); if (z && z.x0 != null) { n.x = z.x0 + Math.random() * (z.x1 - z.x0); n.z = z.z0 + Math.random() * (z.z1 - z.z0); n.g.position.set(n.x, NC.groundY ? NC.groundY(n.x, n.z) : 0, n.z); } NC.NPC.show(n, true); on.push(n); } }
  render();
};
const DB = () => NC.Auth && NC.Auth.DB;
async function load() { if (!DB()) return; try { const r = await fetch(`${DB()}/config/aiGuests.json`); if (!r.ok) return; const v = await r.json(); if (typeof v === 'number' && v !== AC.target) AC.apply(v); } catch (e) { } }
async function save(v) { if (!DB()) return; try { await fetch(`${DB()}/config/aiGuests.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) }); } catch (e) { NC.ui && NC.ui.toast('AI 손님 수 저장 실패: ' + e.message); } }

let box = null;
function render() {
  const admin = !!(NC.account && NC.account.role === 'admin'), tb = document.getElementById('topbtns'); if (!tb) return;
  if (!box) { box = document.createElement('div'); box.id = 'aiCount'; box.style.cssText = 'display:none;align-items:center;gap:4px;padding:2px 8px;margin-right:6px;border-radius:14px;background:rgba(20,14,36,.78);border:1px solid rgba(255,210,61,.5);color:#ffe08a;font-size:12px;white-space:nowrap';
    box.innerHTML = '<span title="홀의 AI 손님 수(관리자)">🤖 AI 손님 <b id="aiN">0</b>/<span id="aiMax">0</span></span><button id="aiDn" class="ibtn" style="min-width:24px;height:24px;padding:0">−</button><button id="aiUp" class="ibtn" style="min-width:24px;height:24px;padding:0">＋</button>';
    const adm = document.getElementById('btnAdmin'); tb.insertBefore(box, adm ? adm.nextSibling : tb.firstChild);
    const bump = d => { const cur = AC.target ?? AC.count(), v = Math.max(0, Math.min(AC.max || pool().length, cur + d)); AC.apply(v); clearTimeout(AC._st); AC._st = setTimeout(() => save(v), 600); NC.ui && NC.ui.toast(`🤖 AI 손님 ${v}명으로 맞춤`); };
    box.querySelector('#aiDn').onclick = e => bump(e.shiftKey ? -5 : -1); box.querySelector('#aiUp').onclick = e => bump(e.shiftKey ? 5 : 1); }
  box.style.display = admin && NC.started ? 'inline-flex' : 'none';
  const n = box.querySelector('#aiN'), m = box.querySelector('#aiMax'); if (n) n.textContent = AC.count(); if (m) m.textContent = AC.max || pool().length;
}
NC.tickers.push(dt => { AC.last += dt; if (AC.last < 1) return; AC.last = 0; render(); });
setInterval(() => { if (NC.started) load(); }, 30000);
{ const iv = setInterval(() => { if (NC.started && NC.npcs && NC.npcs.length) { clearInterval(iv); setTimeout(() => { load(); render(); }, 4000); } }, 1000); }
console.info('[aicount] v77 관리자 AI 손님 수 조절');
})();
