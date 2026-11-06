/* ops.js — 운영 기능(클라이언트): 성인 인증 게이트 · 접속자 목록(신고/차단) · 차단 관리
 * index.html(js/main.js)이 서버를 감지하면 multi.js 보다 먼저 로드됩니다. (v2: 솔로 모드에서도 AI 대화 토큰을 위해 인증 게이트 사용)
 * ⚠ 현재 인증 화면은 개발용(생년월일 자기신고)입니다. 실서비스는 본인인증 기관(PASS 등) 팝업 결과를
 *   /api/verify 로 보내도록 교체하세요 (server-ops.js providers.pass).
 */
(() => {
  const NC = window.NC, $ = s => document.querySelector(s);
  const KEY = 'nc_session', DEV = 'nc_device';
  const load = () => { try { const s = JSON.parse(sessionStorage.getItem(KEY)); return s && s.exp > Date.now() + 60e3 ? s : null; } catch (e) { return null; } };
  const store = s => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } };
  const deviceId = () => { try { let d = localStorage.getItem(DEV); if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem(DEV, d); } return d; } catch (e) { return 'nodev'; } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── 1) 성인 인증 게이트 ── */
  NC.hooks.beforeStart.push(async function ageGate() {
    const s = load(); if (s) { NC.session = s; return; }
    const yNow = new Date().getFullYear();
    const yOpts = Array.from({ length: 90 }, (_, i) => `<option value="${yNow - 10 - i}"${i === 25 ? ' selected' : ''}>${yNow - 10 - i}년</option>`).join('');
    const mOpts = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join('');
    const dOpts = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join('');
    for (; ;) {
      const r = await NC.ui.modal(`<h3>🔞 성인 인증</h3>
        <p style="font-size:13px;color:#cdb7ff;margin:0 0 10px">이 공간은 <b>만 19세 이상</b>만 이용할 수 있습니다. 생년월일은 성인 여부 확인에만 쓰이며 저장되지 않습니다.</p>
        <div style="display:flex;gap:6px"><select id="by">${yOpts}</select><select id="bm">${mOpts}</select><select id="bd">${dOpts}</select></div>
        <label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px"><input type="checkbox" id="agree" style="margin-top:3px">
        <span>이용 규칙에 동의합니다. 욕설·성희롱·사칭·외부 연락처 유도는 신고 시 이용이 제한될 수 있습니다.</span></label>
        <div id="gerr" style="color:#ff8fb8;font-size:13px;min-height:18px;margin-top:6px"></div>`,
        [['취소', 'cancel'], ['인증하고 입장', 'ok', true]]);
      if (r.val === 'cancel') throw new Error('성인 인증이 필요합니다.');
      // modal 은 닫혀도 root 요소가 메모리에 남아 있으므로 입력값을 읽을 수 있음
      const v = r.root; const by = v.querySelector('#by').value, bm = v.querySelector('#bm').value, bd = v.querySelector('#bd').value, ag = v.querySelector('#agree').checked;
      if (!ag) { NC.ui.toast('이용 규칙에 동의해 주세요.'); continue; }
      const birth = `${by}-${String(bm).padStart(2, '0')}-${String(bd).padStart(2, '0')}`;
      let res; try { res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ birth, deviceId: deviceId() }) }); } catch (e) { throw new Error('인증 서버에 연결할 수 없습니다.'); }
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { if (res.status === 403) throw new Error(j.error || '입장할 수 없습니다.'); NC.ui.toast(j.error || '인증에 실패했어요.'); continue; }
      NC.session = { token: j.token, exp: j.exp }; store(NC.session); return;
    }
  });

  /* ── 2) 접속자 패널: 신고 / 차단 ── */
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:12px;top:60px;width:min(300px,86vw);max-height:60vh;overflow:auto;background:rgba(18,8,40,.94);border:1px solid rgba(255,61,154,.55);border-radius:14px;padding:10px;z-index:12;display:none;font-size:13px';
  document.body.appendChild(panel);
  const btn = document.createElement('button'); btn.className = 'ibtn'; btn.id = 'btnPeople'; btn.title = '접속자 · 신고/차단'; btn.textContent = '👥'; btn.style.display = 'none';
  $('#topbtns').prepend(btn);
  NC.on('start', () => { if (NC.mode === 'online') btn.style.display = ''; });
  btn.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; render(); };
  function render() {
    if (panel.style.display === 'none') return;
    const rows = [...NC.remotes.entries()].map(([id, r]) => `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #2d1a55"><span style="flex:1">${esc(r.name)}</span>
      <button data-r="${esc(id)}" style="background:#33145f;border:1px solid #5b3aa8;color:#fff;border-radius:8px;padding:5px 8px">🚩 신고</button>
      <button data-b="${esc(id)}" style="background:#33145f;border:1px solid #5b3aa8;color:#fff;border-radius:8px;padding:5px 8px">🚫 차단</button></div>`).join('') || '<div style="color:#b8a4e8;padding:6px 0">지금은 다른 접속자가 없어요.</div>';
    const bl = (NC.blocks || []).map(b => `<div style="display:flex;align-items:center;gap:6px;padding:5px 0"><span style="flex:1">${esc(b.name)}</span><button data-u="${esc(b.uid)}" style="background:#241048;border:1px solid #5b3aa8;color:#fff;border-radius:8px;padding:4px 8px">해제</button></div>`).join('');
    panel.innerHTML = `<b>👥 접속자 (${NC.remotes.size + 1}명)</b>${rows}${bl ? '<div style="margin-top:8px;color:#cdb7ff">차단 목록</div>' + bl : ''}`;
  }
  NC.ui.refreshPeople = render;
  panel.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.b) { const r = NC.remotes.get(t.dataset.b); const a = await NC.ui.modal(`<h3>🚫 차단</h3><p>${esc(r ? r.name : '')}님을 차단할까요?<br><span style="font-size:12px;color:#cdb7ff">서로의 아바타·채팅·초대가 보이지 않게 됩니다.</span></p>`, [['취소', 0], ['차단', 1, true]]); if (a.val) NC.net.send({ type: 'block', target: t.dataset.b }); }
    else if (t.dataset.r) NC.ui.reportDialog(t.dataset.r);
    else if (t.dataset.u) NC.net.send({ type: 'unblock', uid: t.dataset.u });
  });
  NC.ui.reportDialog = async id => {
    const r = NC.remotes.get(id); const reasons = NC.reasons || ['욕설·비하', '성희롱·성적 언행', '스팸·홍보', '사칭·사기', '기타'];
    const a = await NC.ui.modal(`<h3>🚩 신고</h3><p style="margin:0 0 8px">${esc(r ? r.name : '')}님을 신고합니다.</p><select id="rr">${reasons.map(x => `<option>${esc(x)}</option>`).join('')}</select>
      <input type="text" id="rd" maxlength="200" placeholder="상세 내용(선택)" style="margin-top:8px"><p style="font-size:12px;color:#cdb7ff;margin:8px 0 0">최근 대화 내용이 증거로 함께 접수됩니다. 허위 신고는 제재 대상입니다.</p>`, [['취소', 0], ['신고 접수', 1, true]]);
    if (a.val) NC.net.send({ type: 'report', target: id, reason: a.root.querySelector('#rr').value, detail: a.root.querySelector('#rd').value });
  };
})();
