/* realpick.js — v48 모든 화면의 캐릭터를 '실사 인물(Rocketbox)' 하나로 통일
 *  ■ 입장 화면 미리보기 · 👗 스타일 바꾸기 · 🧍 캐릭터 고르기(회원가입·로그인·게임 중 변경)가 실제 게임 속 모델 목록(manifest.playerPool)을 보여 줌
 *  ■ 고른 모델 id 는 look.realModel 로 내 아바타 → 온라인 다른 접속자 화면까지 그대로 전달(humanglb.modelFor 가 사용)
 *  ■ 프로필 사진 = 그 모델 얼굴을 Blender 로 렌더한 사진(profile/real/<id>.jpg) → 3D 얼굴과 일치
 *  ■ 실사 모델이 꺼져 있으면(?noreal · 매니페스트 없음) 아무것도 바꾸지 않음 = 예전 절차적 캐릭터 화면 그대로
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, $ = s => document.querySelector(s), E = NC.entry, RH = NC.RealHuman;
if (!E || !RH || !RH.ready) return;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const photoOf = id => 'real/' + id + '.jpg';

/* v53 매니페스트가 늦게 오면(느린 회선: RH.ready 가 6초 뒤 null 로 끝남) 오류 없이 기다렸다가 도착하는 즉시 적용 */
const whenCfg = () => new Promise(res => RH.ready.then(C => { if (C) return res(C); const t = setInterval(() => { if (RH.cfg) { clearInterval(t); res(RH.cfg); } }, 500); setTimeout(() => clearInterval(t), 120000); }));
whenCfg().then(C => {
  if (!C || !RH.active() || !C.playerPool) return;
  document.documentElement.classList.add('realOn');
  const cfg = E.cfg, M = id => RH.modelOf(id);
  const pool = g => (C.playerPool[g === 'm' ? 'm' : 'f'] || []).filter(M);
  const labelOf = id => (M(id) || {}).label || id;
  const fullImg = id => (M(id) || {}).full || '';
  cfg.realM = cfg.realM || {};
  const lookFor = (g, id) => { const l = NC.Avatar.randomLook(cfg.seed, g); l.gender = g; l.realModel = id; l.photo = photoOf(id); return l; };
  /* 지금 고른 모델: 회원(characterNo) → cfg.full.realModel → 마지막 선택 → 성별 풀 첫 번째 */
  const current = g => { g = g || cfg.gender; const f = cfg.full; if (f && f.realModel && f.gender === g && M(f.realModel)) return f.realModel;
    const r = cfg.realM[g]; if (r && M(r) && M(r).gender === g) return r; const P = pool(g); return P[U.hash(String(cfg.seed)) % Math.min(6, P.length)]; };
  const select = (g, id) => { cfg.gender = g; cfg.realM[g] = id; cfg.full = lookFor(g, id); cfg.styleName = labelOf(id); try { U.store.set('nc_look', cfg); } catch (e) { } E.renderCustom(); refreshChip();
    /* v77 게임 중(내 사진 칩 → 스타일 바꾸기)에 고르면 화면 속 내 캐릭터도 바로 그 모델로 — 전에는 시작 화면 설정만 바뀌어 고른 것과 보이는 게 달랐음 */
    if (NC.started && NC.rebuildPlayer) { const pl = NC.player && NC.player.group, cur0 = pl && pl.userData.look && pl.userData.look.realModel; if (cur0 !== id) NC.rebuildPlayer(Object.assign({}, cfg.full)); } };

  /* ── 번호 체계(회원 DB characterNo 1..N = playerPool 순서) ── */
  const origThumb = E.thumb;
  E.stylesOf = g => pool(g).map(id => [g, labelOf(id), { realModel: id }]);
  E.lookByNo = (g, no) => { const P = pool(g); return lookFor(g, P[U.clamp((no | 0) - 1, 0, P.length - 1)]); };
  E.styleName = (g, no) => { const P = pool(g); return labelOf(P[U.clamp((no | 0) - 1, 0, P.length - 1)]); };
  E.thumb = (look, w, h) => look && look.realModel ? fullImg(look.realModel) : origThumb(look, w, h);
  E.realCurrent = current;
  { const ob = E.buildLook; E.buildLook = function () { const l = ob.apply(this, arguments); const id = current(l.gender); l.realModel = id; l.photo = photoOf(id); return l; }; }

  /* ── 입장 화면 미리보기: 실제 모델 전신 렌더 ── */
  const imgs = {}; const img = u => imgs[u] || (imgs[u] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; }));
  E.preview = look => { const cv = $('#facePrev'); if (!cv) return; const id = current(look && look.gender);
    img(fullImg(id)).then(im => { if (current(look && look.gender) !== id) return; const g = cv.getContext('2d'), W = cv.width, H = cv.height, s = H / im.naturalHeight * 1.04, w = im.naturalWidth * s;
      g.clearRect(0, 0, W, H); g.drawImage(im, (W - w) / 2, -H * .02, w, im.naturalHeight * s); }).catch(() => { });
    const sn = $('#cFace'); if (sn) sn.textContent = '👗 스타일 바꾸기 · ' + labelOf(id); };
  E.releasePreview = () => { };

  /* ── 👗 스타일 바꾸기 = 실사 모델 갤러리 ── */
  E.openStyles = () => {
    const g = cfg.gender, P = pool(g), cur = current(g), a = NC.account;
    NC.ui.modal(`<h3>👗 스타일 바꾸기 <small style="opacity:.6">${g === 'f' ? '여성' : '남성'} ${P.length}종 · 게임 속 실제 캐릭터</small></h3>
      <div id="stGrid">${P.map((id, i) => `<div class="stc real${id === cur ? ' on' : ''}" data-id="${id}"><img loading="lazy" alt="" src="${esc(fullImg(id))}"><b>No.${i + 1} ${esc(labelOf(id))}</b></div>`).join('')}</div>
      <p style="font-size:11px;opacity:.65;margin:6px 0 0">${a ? '고른 캐릭터는 회원 정보(캐릭터 번호)에도 저장돼요.' : '성별은 시작 화면에서 바꿔요. 로그인하면 캐릭터가 계정에 저장돼요.'}</p>`, [['닫기', 1, true]]);
    const grid = $('#stGrid'); if (!grid) return;
    grid.onclick = async e => { const c = e.target.closest('.stc'); if (!c) return; const id = c.dataset.id; grid.querySelectorAll('.stc').forEach(x => x.classList.toggle('on', x === c));
      select(g, id); NC.ui.toast(`👗 ${labelOf(id)} 캐릭터 적용`);
      const acc = NC.account; if (acc && acc.uid && NC.Auth && NC.Auth.DB) { const no = P.indexOf(id) + 1;
        try { const r = await fetch(`${NC.Auth.DB}/users/${acc.uid}/characterNo.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(no) }); if (r.ok) { acc.characterNo = no; U.store.set('nc_session', acc); } } catch (er) { } } };
  };

  /* ── 프로필 사진 = 모델 얼굴 렌더 ── */
  const Pf = NC.Profile;
  const reg = () => { if (!Pf) return; C.models.forEach(m => { const f = photoOf(m.id); Pf.byPath[f] = Pf.byPath[f] || { f, m: 'real/mini/' + m.id + '.jpg', t: null, res: true }; }); };
  function refreshChip() {
    const id = current(), u = Pf ? Pf.url(photoOf(id)) : null; const chip = $('#myPhoto'); if (chip && u) { chip.querySelector('img').src = u; chip.classList.remove('empty'); chip.title = '캐릭터(얼굴) 바꾸기'; chip.onclick = () => E.openStyles(); const sp = chip.querySelector('span'); if (sp) sp.textContent = '🧍 얼굴'; }
    const lp = $('#lgPhoto img'); if (lp && u) lp.src = u;
    const lph = $('#lgPh'); if (lph) { lph.style.display = 'none'; const sep = lph.nextElementSibling; if (sep && sep.tagName === 'SPAN') sep.style.display = 'none'; }
    const lg = $('#lgPhoto'); if (lg) lg.onclick = () => { const b = $('#lgChar'); b && b.click(); };
  }
  if (Pf) {
    Pf.ready.then(() => { reg(); refreshChip(); });
    const om = Pf.mine; Pf.mine = () => photoOf(current()) || om();
    const orc = Pf.refreshChip; Pf.refreshChip = () => { try { orc && orc(); } catch (e) { } refreshChip(); };
    /* NPC: 실사 모델이 정해진 사람은 그 모델 얼굴 사진(데이터에 지정이 없을 때도) */
    const oa = Pf.assignOne; Pf.assignOne = n => { if (n && !n._ph && n.def && !n.def.photo) { const id = RH.modelIdFor(n); if (id) n.def.photo = photoOf(id); } return oa(n); };
  }
  document.addEventListener('click', e => { if (e.target.closest('#cGender button, #authTabs button, #lgOut, #lgChar')) setTimeout(refreshChip, 80); }, true);
  { const st = $('#start'); if (st) { const mo = new MutationObserver(() => { if ($('#lgPh') && $('#lgPh').style.display !== 'none') refreshChip(); }); mo.observe(st, { childList: true, subtree: true }); NC.on && NC.on('start', () => mo.disconnect()); } }
  NC.on && NC.on('player:look', L => { if (L && L.realModel && M(L.realModel)) { const g0 = M(L.realModel).gender; cfg.gender = g0; cfg.realM[g0] = L.realModel; cfg.full = lookFor(g0, L.realModel); cfg.styleName = labelOf(L.realModel); try { U.store.set('nc_look', cfg); } catch (e) { } }   /* v77 어느 경로로 바꿔도 시작 화면·다음 입장 설정과 일치 */
    const pg = NC.player && NC.player.group; if (!pg || !L || !L.realModel) return; pg.userData.look.photo = photoOf(L.realModel); if (NC.settings.look) NC.settings.look.photo = pg.userData.look.photo; Pf && Pf.decorate(pg); });

  /* ── 입장 직전: 내 look 에 모델·사진 확정(프로필 훅보다 뒤) ── */
  NC.hooks.beforeStart.push(async () => { const L = NC.settings.look; if (!L) return; const g = L.gender || cfg.gender, id = (L.realModel && M(L.realModel) && M(L.realModel).gender === g) ? L.realModel : current(g);
    L.realModel = id; L.photo = photoOf(id); try { U.store.set('nc_look', cfg); } catch (e) { } });

  /* 로그인된 상태로 페이지를 열었으면 계정 번호로 다시 적용 */
  const a = NC.account; if (a && a.characterNo) { const g = a.gender === '여성' ? 'f' : 'm'; cfg.gender = g; cfg.full = E.lookByNo(g, a.characterNo); cfg.styleName = E.styleName(g, a.characterNo); }
  E.renderCustom(); refreshChip();
  if (!NC.started && RH.prestart) setTimeout(() => RH.prestart(), 1200);
});
})();
