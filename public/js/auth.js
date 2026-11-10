/* auth.js — v13 계정: 👤 손님(기본) · 🔑 로그인 · 📝 회원가입 · 아이디/비번 찾기 · ⚙ 설정에서 캐릭터 변경
 *  저장소: Firebase Realtime Database REST API (SDK 없이 fetch)
 *    GET/PUT  {DB}/users.json · {DB}/users/{uid}.json · 조회는 ?orderBy="필드"&equalTo="값" (규칙에 .indexOn 필요, 없으면 전체 조회로 대체)
 *  레코드: { id, password, email, nickname, gender: '남성'|'여성', characterNo: 1~11(성별별 스타일 번호), createdAt }
 *  ⚠ 요청 스펙대로 비밀번호를 평문 저장하고 '비번 찾기'에서 끝 한 자리만 가려 보여 줍니다.
 *    DB 를 공개(read:true)로 두면 누구나 전체 회원 정보를 볼 수 있으므로 테스트·소규모용으로만 쓰세요 (docs/21 참고).
 */
(() => {
'use strict';
const NC = window.NC, U = NC.util, $ = s => document.querySelector(s), E = NC.entry;
const DB = (NC.config && NC.config.firebaseUrl) || 'https://night-club-866bc-default-rtdb.asia-southeast1.firebasedatabase.app';
const SESSION_KEY = 'nc_session', LOCK_KEY = 'nc_login_lock';

/* ───── Firebase REST ───── */
async function req(path, opt = {}) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`${DB}/${path}`, Object.assign({ signal: ctl.signal, cache: 'no-store' }, opt.body ? { headers: { 'Content-Type': 'application/json' } } : {}, opt));   // GET 은 헤더 없이 → CORS 사전요청 없음
    const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { }
    if (!r.ok) { const err = new Error(r.status === 401 || r.status === 403 ? 'DB 접근이 거부됐어요 — Firebase 콘솔 → Realtime Database → 규칙에서 users 읽기/쓰기를 허용해 주세요 (docs/21 참고).' : (data && data.error) || `HTTP ${r.status}`); err.status = r.status; throw err; }
    return data;
  } catch (e) { if (e.name === 'AbortError') throw new Error('서버 응답이 없어요 (시간 초과). 네트워크를 확인해 주세요.'); if (e.status) throw e; throw new Error('서버에 연결할 수 없어요. 네트워크를 확인해 주세요.'); }
  finally { clearTimeout(to); }
}
async function findBy(field, value) {          // → [uid, user] | null
  const v = String(value);
  try {
    const q = await req(`users.json?orderBy=${encodeURIComponent(JSON.stringify(field))}&equalTo=${encodeURIComponent(JSON.stringify(v))}`);
    const k = q && Object.keys(q)[0]; return k ? [k, q[k]] : null;
  } catch (e) {
    if (e.status !== 400) throw e;            // 400 = .indexOn 없음 → 전체 조회 후 비교
    const all = await req('users.json') || {}; const lv = v.toLowerCase();
    const hit = Object.entries(all).find(([, u]) => u && String(u[field] || '').toLowerCase() === lv); return hit || null;
  }
}
const newUid = () => 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

/* ───── 검증 규칙 ───── */
const RX = {
  id: /^[a-zA-Z][a-zA-Z0-9_]{3,15}$/,                                          // 영문 시작 4~16자
  email: /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/,
  nick: /^[가-힣a-zA-Z0-9_ ]{2,10}$/,                                           // 입장 닉네임 규칙과 동일
};
const pwRules = pw => ({ len: pw.length >= 6, up: /[A-Z]/.test(pw), low: /[a-z]/.test(pw), num: /[0-9]/.test(pw), sp: /[^A-Za-z0-9]/.test(pw) });
const pwOk = r => r.len && r.up && r.low && r.num;                               // 특수문자는 옵션
const maskPw = pw => pw.length <= 1 ? '*' : pw.slice(0, -1) + '*';

/* ───── 세션 ───── */
const getSession = () => U.store.get(SESSION_KEY, null);
const setSession = s => { if (s) U.store.set(SESSION_KEY, s); else { try { localStorage.removeItem(SESSION_KEY); } catch (e) { } } NC.account = s; };
NC.account = getSession();
const genderCode = g => g === '여성' ? 'f' : 'm';

/* ───── UI 골격 ───── */
const card = $('#start .card'), guestEls = ['.custom', '#sws', '.charRow'].map(s => $(s)).filter(Boolean);
const tabs = document.createElement('div'); tabs.id = 'authTabs'; tabs.className = 'seg';
tabs.innerHTML = '<button data-t="guest" class="on">👤 손님</button><button data-t="login">🔑 로그인</button><button data-t="join">📝 회원가입</button>';
card.insertBefore(tabs, $('#start .custom'));
const pane = document.createElement('div'); pane.id = 'authPane'; card.insertBefore(pane, $('#start .custom'));
const goBtn = $('#go'), modeSel = $('#modeSel');
const field = (id, label, type = 'text', ph = '', extra = '') => `<label class="af"><span>${label}</span><div class="ar"><input id="${id}" type="${type}" placeholder="${ph}" autocomplete="off" ${extra}>${type === 'password' ? `<button type="button" class="eye" data-for="${id}" title="보기">👁</button>` : ''}</div><small id="${id}_m"></small></label>`;
const msg = (id, text, ok) => { const m = $('#' + id + '_m'); if (m) { m.textContent = text || ''; m.className = text ? (ok ? 'ok' : 'bad') : ''; } };

function show(tab) {
  tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  const acc = NC.account, guest = tab === 'guest';
  guestEls.forEach(el => el.style.display = guest && !acc ? '' : 'none');
  goBtn.style.display = (guest || (tab === 'login' && acc)) ? '' : 'none';
  if (modeSel && NC.server) modeSel.style.display = goBtn.style.display === 'none' ? 'none' : '';
  $('#nick').closest('.copts') && ($('#nick').style.display = acc ? 'none' : '', $('#nickSamples') && ($('#nickSamples').style.display = acc ? 'none' : ''));
  if (acc) { pane.innerHTML = loggedHtml(acc); bindLogged(); goBtn.textContent = `${acc.nickname}(으)로 입장하기`; tabs.style.display = 'none'; applyAccount(acc); return; }
  tabs.style.display = ''; goBtn.textContent = '손님으로 입장하기';
  if (guest) { pane.innerHTML = '<p class="authHint">로그인 없이 바로 입장해요. 닉네임과 스타일을 고르세요 · 회원이 되면 닉네임·캐릭터가 저장돼요</p>'; return; }
  if (tab === 'login') { pane.innerHTML = loginHtml(); bindLogin(); }
  if (tab === 'join') { pane.innerHTML = joinHtml(); bindJoin(); }
}
tabs.onclick = e => { const b = e.target.closest('button[data-t]'); if (b) show(b.dataset.t); };
pane.addEventListener('click', e => { const eye = e.target.closest('.eye'); if (!eye) return; const i = $('#' + eye.dataset.for); i.type = i.type === 'password' ? 'text' : 'password'; eye.textContent = i.type === 'password' ? '👁' : '🙈'; });

/* ───── 로그인 ───── */
function loginHtml() {
  const saved = U.store.get('nc_saved_id', '');
  return `<div class="authBox">${field('lgId', '아이디', 'text', '아이디', `value="${saved}"`)}${field('lgPw', '비밀번호', 'password', '비밀번호')}
    <label class="ck"><input type="checkbox" id="lgSave"${saved ? ' checked' : ''}> 아이디 저장</label>
    <button id="lgGo" class="pri wide">🔑 로그인</button><div id="lgErr" class="aerr"></div>
    <div class="alinks"><button type="button" id="findId">아이디 찾기</button><span>|</span><button type="button" id="findPw">비밀번호 찾기</button><span>|</span><button type="button" id="toJoin">회원가입</button></div></div>`;
}
function lockLeft() { const l = U.store.get(LOCK_KEY, null); if (!l) return 0; const left = l.until - Date.now(); return left > 0 ? Math.ceil(left / 1000) : 0; }
function bindLogin() {
  const go = $('#lgGo'), err = t => { $('#lgErr').textContent = t || ''; };
  const submit = async () => {
    const id = $('#lgId').value.trim(), pw = $('#lgPw').value; err('');
    const lk = lockLeft(); if (lk) return err(`로그인 시도가 너무 많아요. ${lk}초 후 다시 시도해 주세요.`);
    if (!id) { $('#lgId').focus(); return err('아이디를 입력해 주세요.'); }
    if (!pw) { $('#lgPw').focus(); return err('비밀번호를 입력해 주세요.'); }
    go.disabled = true; go.textContent = '확인 중…';
    try {
      const hit = await findBy('id', id);
      if (!hit || hit[1].password !== pw) {
        const l = U.store.get(LOCK_KEY, { n: 0, until: 0 }); l.n = (l.n || 0) + 1; if (l.n >= 5) { l.until = Date.now() + 30000; l.n = 0; } U.store.set(LOCK_KEY, l);
        err(l.until > Date.now() ? '5회 실패 — 30초 동안 로그인할 수 없어요.' : `아이디 또는 비밀번호가 올바르지 않아요. (${l.n}/5)`); $('#lgPw').value = ''; $('#lgPw').focus(); return;
      }
      U.store.set(LOCK_KEY, { n: 0, until: 0 });
      if ($('#lgSave').checked) U.store.set('nc_saved_id', id); else U.store.set('nc_saved_id', '');
      const [uid, u] = hit; setSession({ uid, id: u.id, nickname: u.nickname, gender: u.gender, characterNo: u.characterNo || 1, email: u.email });
      NC.ui.toast(`🎉 ${u.nickname}님, 어서 오세요!`); show('login'); syncAccount();
    } catch (e) { err(e.message); }
    finally { if (document.body.contains(go)) { go.disabled = false; go.textContent = '🔑 로그인'; } }
  };
  go.onclick = submit; ['#lgId', '#lgPw'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
  $('#findId').onclick = () => findDialog('id'); $('#findPw').onclick = () => findDialog('pw'); $('#toJoin').onclick = () => show('join');
  setTimeout(() => ($('#lgId').value ? $('#lgPw') : $('#lgId')).focus(), 50);
}
function findDialog(kind) {
  const title = kind === 'id' ? '🔎 아이디 찾기' : '🔐 비밀번호 찾기';
  NC.ui.modal(`<h3>${title}</h3><p style="font-size:13px;opacity:.8">가입할 때 입력한 이메일을 적어 주세요.</p><input id="fdEmail" type="email" placeholder="example@email.com" style="width:100%;padding:10px;border-radius:10px"><div id="fdErr" class="aerr"></div>`, [['찾기', 'go', true], ['닫기', 0]]).then(async r => {
    if (r.val !== 'go') return; const em = (r.root.querySelector('#fdEmail').value || '').trim();
    const again = t => { NC.ui.toast(t); setTimeout(() => findDialog(kind), 50); };
    if (!RX.email.test(em)) return again('이메일 형식이 올바르지 않아요.');
    try {
      const hit = await findBy('email', em); if (!hit) return again('해당 이메일로 가입된 계정이 없어요.');
      const u = hit[1];
      NC.ui.modal(kind === 'id' ? `<h3>🔎 아이디 찾기 결과</h3><div class="findRes">회원님의 아이디는<br><b>${esc(u.id)}</b><br>입니다.</div>`
        : `<h3>🔐 비밀번호 찾기 결과</h3><div class="findRes">아이디 <b>${esc(u.id)}</b> 의 비밀번호는<br><b class="pw">${esc(maskPw(String(u.password || '')))}</b><br><small>보안을 위해 마지막 한 자리는 * 로 가렸어요.</small></div>`,
        [['로그인하러 가기', 'login', true], ['닫기', 0]]).then(x => { if (x.val === 'login') { show('login'); if (kind === 'id') $('#lgId').value = u.id; } });
    } catch (e) { again(e.message); }
  });
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ───── 회원가입 ───── */
const J = { id: null, email: null, nick: null, gender: '남성', characterNo: 1 };       // 중복 확인 통과한 값 기록
function joinHtml() {
  return `<div class="authBox join">
    <label class="af"><span>아이디</span><div class="ar"><input id="jnId" placeholder="영문으로 시작 4~16자 (영문·숫자·_)" autocomplete="off"><button type="button" class="chk" data-k="id">중복확인</button></div><small id="jnId_m"></small></label>
    ${field('jnPw', '비밀번호', 'password', '6자 이상 · 대문자+소문자+숫자')}<div id="pwRule" class="pwRule"><i data-r="len">6자 이상</i><i data-r="up">대문자</i><i data-r="low">소문자</i><i data-r="num">숫자</i><i data-r="sp" class="opt">특수문자(선택)</i></div>
    ${field('jnPw2', '비밀번호 확인', 'password', '비밀번호를 한 번 더')}
    <label class="af"><span>이메일</span><div class="ar"><input id="jnEmail" type="email" placeholder="example@email.com" autocomplete="off"><button type="button" class="chk" data-k="email">중복확인</button></div><small id="jnEmail_m"></small></label>
    <label class="af"><span>성별</span><div class="seg" id="jnGender"><button type="button" data-g="남성" class="on">👨 남성</button><button type="button" data-g="여성">👩 여성</button></div></label>
    <label class="af"><span>닉네임</span><div class="ar"><input id="jnNick" placeholder="2~10자 (한글·영문·숫자)" autocomplete="off"><button type="button" class="chk" data-k="nick">중복확인</button></div><small id="jnNick_m"></small></label>
    <label class="af"><span>캐릭터 <em>(선택)</em></span><div class="ar"><div id="jnChar" class="charPick">No.1 기본 캐릭터</div><button type="button" id="jnCharBtn" class="chk">고르기</button></div></label>
    <label class="ck"><input type="checkbox" id="jnAgree"> 만 19세 이상이며 <a href="#" id="jnTerms">이용약관·개인정보 수집</a>에 동의합니다 (필수)</label>
    <button id="jnGo" class="pri wide">📝 가입하기</button><div id="jnErr" class="aerr"></div></div>`;
}
function bindJoin() {
  Object.assign(J, { id: null, email: null, nick: null, gender: '남성', characterNo: 1 });
  const pw = $('#jnPw'), pw2 = $('#jnPw2');
  const pwCheck = () => { const r = pwRules(pw.value); document.querySelectorAll('#pwRule i').forEach(i => i.classList.toggle('ok', !!r[i.dataset.r]));
    msg('jnPw', pw.value ? (pwOk(r) ? '사용 가능한 비밀번호예요' + (r.sp ? ' (강함)' : '') : '조건을 모두 만족해야 해요') : '', pwOk(r));
    msg('jnPw2', pw2.value ? (pw2.value === pw.value ? '비밀번호가 일치해요' : '비밀번호가 일치하지 않아요') : '', pw2.value === pw.value); };
  pw.oninput = pwCheck; pw2.oninput = pwCheck;
  // 입력이 바뀌면 중복확인 무효화
  [['jnId', 'id'], ['jnEmail', 'email'], ['jnNick', 'nick']].forEach(([el, k]) => $('#' + el).addEventListener('input', () => { J[k] = null; msg(el, ''); }));
  pane.querySelectorAll('.chk[data-k]').forEach(b => b.onclick = () => dupCheck(b.dataset.k, b));
  $('#jnGender').onclick = e => { const b = e.target.closest('button'); if (!b) return; J.gender = b.dataset.g; J.characterNo = 1; $('#jnGender').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); charLabel(); };
  $('#jnCharBtn').onclick = () => pickCharacter(genderCode(J.gender), J.characterNo).then(no => { if (no) { J.characterNo = no; charLabel(); } });
  $('#jnTerms').onclick = e => { e.preventDefault(); NC.ui.modal(`<h3>이용약관 · 개인정보 수집 안내</h3><div style="font-size:12px;line-height:1.7;max-height:50vh;overflow:auto;text-align:left">
    1. 본 서비스는 만 19세 이상을 위한 가상공간 오락 콘텐츠입니다.<br>2. 수집 항목: 아이디, 비밀번호, 이메일, 닉네임, 성별, 캐릭터 번호, 가입일시.<br>3. 이용 목적: 회원 식별, 로그인, 아이디·비밀번호 찾기, 캐릭터 저장.<br>
    4. 보관 기간: 회원 탈퇴 시까지. 탈퇴를 원하시면 운영자에게 요청하세요.<br>5. 🪙 코인은 현금 가치가 없는 게임 재화입니다.<br>6. 다른 이용자를 괴롭히거나 불법적인 행위를 하면 이용이 제한될 수 있습니다.</div>`, [['확인', 1, true]]); };
  $('#jnGo').onclick = submitJoin; charLabel();
}
function charLabel() { const g = genderCode(J.gender), el = $('#jnChar'); if (el && E.styleName) el.textContent = `No.${J.characterNo} ${E.styleName(g, J.characterNo)}${J.characterNo === 1 ? ' (기본)' : ''}`; }
async function dupCheck(k, btn) {
  const map = { id: ['jnId', 'id', RX.id, '아이디는 영문으로 시작하는 4~16자(영문·숫자·_)여야 해요'], email: ['jnEmail', 'email', RX.email, '이메일 형식이 올바르지 않아요'], nick: ['jnNick', 'nickname', RX.nick, '닉네임은 2~10자(한글·영문·숫자)여야 해요'] }[k];
  const [el, fieldName, rx, bad] = map, v = $('#' + el).value.trim();
  if (!rx.test(v)) { J[k] = null; msg(el, bad, false); return false; }
  if (btn) { btn.disabled = true; btn.textContent = '확인 중'; }
  try { const hit = await findBy(fieldName, v);
    if (hit) { J[k] = null; msg(el, { id: '이미 사용 중인 아이디예요', email: '이미 가입된 이메일이에요', nick: '이미 사용 중인 닉네임이에요' }[k], false); return false; }
    J[k] = v; msg(el, { id: '사용 가능한 아이디예요 ✓', email: '사용 가능한 이메일이에요 ✓', nick: '사용 가능한 닉네임이에요 ✓' }[k], true); return true;
  } catch (e) { J[k] = null; msg(el, e.message, false); return false; }
  finally { if (btn) { btn.disabled = false; btn.textContent = '중복확인'; } }
}
async function submitJoin() {
  const go = $('#jnGo'), err = t => { $('#jnErr').textContent = t || ''; }; err('');
  const id = $('#jnId').value.trim(), pw = $('#jnPw').value, pw2 = $('#jnPw2').value, email = $('#jnEmail').value.trim(), nick = $('#jnNick').value.trim();
  const fail = (t, focus) => { err(t); if (focus) $(focus).focus(); };
  if (!RX.id.test(id)) return fail('아이디를 확인해 주세요.', '#jnId');
  if (J.id !== id) return fail('아이디 중복확인을 해 주세요.', '#jnId');
  if (!pwOk(pwRules(pw))) return fail('비밀번호는 6자 이상, 대문자·소문자·숫자를 모두 포함해야 해요.', '#jnPw');
  if (pw !== pw2) return fail('비밀번호 확인이 일치하지 않아요.', '#jnPw2');
  if (pw.toLowerCase().includes(id.toLowerCase())) return fail('비밀번호에 아이디를 포함할 수 없어요.', '#jnPw');
  if (!RX.email.test(email)) return fail('이메일을 확인해 주세요.', '#jnEmail');
  if (J.email !== email) return fail('이메일 중복확인을 해 주세요.', '#jnEmail');
  if (!RX.nick.test(nick)) return fail('닉네임을 확인해 주세요.', '#jnNick');
  if (J.nick !== nick) return fail('닉네임 중복확인을 해 주세요.', '#jnNick');
  if (!$('#jnAgree').checked) return fail('약관에 동의해 주세요.');
  go.disabled = true; go.textContent = '가입 처리 중…';
  try {
    // 제출 직전 재확인 (그 사이 다른 사람이 가입했을 수 있음)
    for (const [f, v, t] of [['id', id, '아이디'], ['email', email, '이메일'], ['nickname', nick, '닉네임']]) if (await findBy(f, v)) { J[{ id: 'id', email: 'email', nickname: 'nick' }[f]] = null; return fail(`방금 다른 분이 같은 ${t}로 가입했어요. 다른 ${t}를 입력해 주세요.`); }
    const uid = newUid(), rec = { id, password: pw, email, nickname: nick, gender: J.gender, characterNo: J.characterNo || 1, createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), coins: DEFAULT_COINS, role: ADMIN_IDS.includes(id) ? 'admin' : 'user' };
    await req(`users/${uid}.json`, { method: 'PUT', body: JSON.stringify(rec) });
    const back = await req(`users/${uid}.json`); if (!back || back.id !== id) throw new Error('저장 확인에 실패했어요. 잠시 후 다시 시도해 주세요.');
    setSession({ uid, id, nickname: nick, gender: J.gender, characterNo: rec.characterNo, email }); syncAccount();
    NC.ui.modal(`<h3>🎉 회원가입 완료!</h3><div class="findRes"><b>${esc(nick)}</b>님 환영합니다.<br>캐릭터 No.${rec.characterNo} · ${esc(E.styleName(genderCode(J.gender), rec.characterNo))}<br><small>입장 후에도 ⚙ 설정에서 캐릭터를 바꿀 수 있어요.</small></div>`, [['입장 준비', 1, true]]);
    show('login');
  } catch (e) { fail(e.status === 401 || e.status === 403 ? '서버가 저장을 거부했어요 (DB 규칙 확인 필요).' : e.message); }
  finally { if (document.body.contains(go)) { go.disabled = false; go.textContent = '📝 가입하기'; } }
}

/* ───── 캐릭터 고르기 (번호 갤러리) ───── */
function pickCharacter(g, cur) {
  return new Promise(res => {
    const L = E.stylesOf(g);
    NC.ui.modal(`<h3>🧍 캐릭터 고르기 <small style="opacity:.6">${g === 'f' ? '여성' : '남성'} ${L.length}종</small></h3><div id="stGrid">${L.map(([, nm], i) => `<div class="stc${i + 1 === cur ? ' on' : ''}" data-no="${i + 1}"><img alt=""><b>No.${i + 1} ${nm}</b></div>`).join('')}</div>`, [['선택', 'ok', true], ['취소', 0]])
      .then(r => res(r.val === 'ok' ? sel : null));
    let sel = cur; const grid = $('#stGrid'), cards = [...grid.querySelectorAll('.stc')]; let k = 0;
    const step = () => { if (k >= cards.length || !document.body.contains(grid)) return; const c = cards[k++]; c.querySelector('img').src = E.thumb(E.lookByNo(g, +c.dataset.no)); requestAnimationFrame(step); }; requestAnimationFrame(step);
    grid.onclick = e => { const c = e.target.closest('.stc'); if (!c) return; sel = +c.dataset.no; cards.forEach(x => x.classList.toggle('on', x === c)); };
  });
}

/* ───── 로그인 상태 ───── */
function loggedHtml(a) {
  return `<div class="authBox logged"><div class="who">✅ <b>${esc(a.nickname)}</b>님 로그인됨 <small>(${esc(a.id)})</small></div>
    <div class="who2">${a.gender} · 캐릭터 No.${a.characterNo} ${esc(E.styleName(genderCode(a.gender), a.characterNo))}</div>
    <div class="alinks"><button type="button" id="lgChar">🧍 캐릭터 변경</button><span>|</span><button type="button" id="lgOut">로그아웃</button></div></div>`;
}
function bindLogged() { $('#lgOut').onclick = () => { restoreGuestCoins(); setSession(null); E.cfg.full = null; E.cfg.styleName = ''; E.renderCustom(); NC.ui.toast('로그아웃했어요'); show('guest'); };
  $('#lgChar').onclick = () => changeCharacter(); }
function applyAccount(a) {
  const g = genderCode(a.gender); E.cfg.gender = g; E.cfg.full = E.lookByNo(g, a.characterNo); E.cfg.styleName = E.styleName(g, a.characterNo);
  E.cfg.topColor = E.cfg.full.topColor; E.cfg.hairStyle = E.cfg.full.hairStyle; E.cfg.top = E.cfg.full.top; $('#nick').value = a.nickname; E.renderCustom();
}
async function changeCharacter() {
  const a = NC.account; if (!a) return; const g = genderCode(a.gender);
  const no = await pickCharacter(g, a.characterNo); if (!no || no === a.characterNo) return;
  try {
    await req(`users/${a.uid}/characterNo.json`, { method: 'PUT', body: JSON.stringify(no) });
    a.characterNo = no; setSession(a); NC.ui.toast(`🧍 캐릭터를 No.${no} ${E.styleName(g, no)}(으)로 바꿨어요`);
    if ($('#start').style.display !== 'none') show('login'); else NC.rebuildPlayer && NC.rebuildPlayer(E.lookByNo(g, no));
  } catch (e) { NC.ui.toast('캐릭터 저장 실패: ' + e.message); }
}

/* ───── v16 회원 코인 · 관리자 ─────
 *  · 로그인하면 users/{uid}/coins 를 내 지갑으로 불러오고, 코인이 바뀔 때마다 1.2초 뒤 저장 (항목이 없던 회원은 첫 로그인 때 자동 추가)
 *  · ADMIN_IDS(기본 sodapam) 계정은 로그인 때 users/{uid}/role = "admin" 으로 표시 → 👑 관리자 패널
 *  · 손님(비로그인) 코인은 따로 보관했다가 로그아웃하면 되돌림
 *  ⚠ DB 규칙이 공개 읽기/쓰기라서 관리자 권한은 화면 기능일 뿐 보안 장치가 아님 — 운영 전 Firebase Auth + 규칙 필요 (docs/21) */
const ADMIN_IDS = (NC.config && NC.config.adminIds) || ['sodapam'];
const DEFAULT_COINS = 120;
let coinTimer = null, applying = false;
function restoreGuestCoins() { const gc = U.store.get('nc_coins_guest', null); if (gc != null) { applying = true; U.store.set('nc_coins', gc); NC.emit('coins', gc, 0); applying = false; try { localStorage.removeItem('nc_coins_guest'); } catch (e) { } } }
async function syncAccount() {
  const a = NC.account; if (!a || !a.uid) return;
  try {
    const u = await req(`users/${a.uid}.json`); if (!u) return;
    if (U.store.get('nc_coins_guest', null) == null) U.store.set('nc_coins_guest', NC.Wallet.get());
    const patch = {};
    if (typeof u.coins === 'number' && isFinite(u.coins)) { applying = true; U.store.set('nc_coins', u.coins); NC.emit('coins', u.coins, 0); applying = false; }
    else patch.coins = NC.Wallet.get();
    const role = ADMIN_IDS.includes(u.id) ? 'admin' : (u.role || 'user'); if (u.role !== role) patch.role = role;
    if (Object.keys(patch).length) await req(`users/${a.uid}.json`, { method: 'PATCH', body: JSON.stringify(patch) });
    a.role = role; setSession(a); adminUi();
    if (role === 'admin') NC.ui.toast('👑 관리자 계정으로 로그인했어요 — 상단 👑 버튼');
  } catch (e) { console.warn('[auth] 계정 동기화 실패:', e.message); }
}
NC.on && NC.on('coins', () => {
  const a = NC.account; if (applying || !a || !a.uid) return;
  clearTimeout(coinTimer); coinTimer = setTimeout(() => req(`users/${a.uid}/coins.json`, { method: 'PUT', body: JSON.stringify(NC.Wallet.get()) }).catch(e => console.warn('[auth] 코인 저장 실패:', e.message)), 1200);
});
function adminUi() {
  const on = NC.account && NC.account.role === 'admin', tb = document.getElementById('topbtns'); let b = document.getElementById('btnAdmin');
  if (on && !b && tb) { b = document.createElement('button'); b.id = 'btnAdmin'; b.className = 'ibtn'; b.title = '관리자 패널'; b.textContent = '👑'; b.onclick = adminPanel; tb.insertBefore(b, tb.firstChild); }
  if (b) b.style.display = on ? '' : 'none';
}
async function adminPanel() {
  if (!NC.account || NC.account.role !== 'admin') return;
  const p = NC.ui.modal(`<h3>👑 관리자 패널</h3><div id="admBar"><button id="admRe">🔄 새로고침</button><button id="admFix">🪙 코인 항목 없는 회원 일괄 추가</button><button id="admDisco">🪩 디스코 타임</button><button id="admBlues">💕 블루스 타임</button></div>
    <div id="admList" class="admList">불러오는 중…</div><p class="admNote">비밀번호는 표시하지 않아요 · 코인을 고친 뒤 💾 를 누르세요<br>⚠ 지금 DB 규칙은 누구나 읽고 쓸 수 있는 상태예요. 운영 전에 Firebase Auth + 보안 규칙을 꼭 적용하세요.</p>`, [['닫기', 0]]);
  const box = document.getElementById('admList');
  const load = async () => {
    box.textContent = '불러오는 중…';
    try { const all = await req('users.json') || {}; const rows = Object.entries(all).filter(([, u]) => u && u.id);
      box.innerHTML = `<table><tr><th>아이디</th><th>닉네임</th><th>성별</th><th>코인</th><th>역할</th><th>가입</th><th></th></tr>${rows.map(([uid, u]) => `<tr data-uid="${esc(uid)}"><td>${esc(u.id)}</td><td>${esc(u.nickname || '')}</td><td>${esc(u.gender || '')}</td>
        <td><input type="number" min="0" value="${typeof u.coins === 'number' ? u.coins : ''}" placeholder="없음"></td><td>${u.role === 'admin' ? '👑 admin' : esc(u.role || 'user')}</td><td>${esc(String(u.createdAt || '').slice(0, 10))}</td><td><button class="admSave">💾</button><button class="admAdd">+100</button></td></tr>`).join('')}</table>`;
      const miss = rows.filter(([, u]) => typeof u.coins !== 'number').length; document.getElementById('admFix').textContent = `🪙 코인 항목 없는 회원 일괄 추가 (${miss}명)`; document.getElementById('admFix').disabled = !miss;
    } catch (e) { box.textContent = '불러오기 실패: ' + e.message; }
  };
  box.addEventListener('click', async e => {
    const tr = e.target.closest('tr[data-uid]'); if (!tr) return; const inp = tr.querySelector('input'), uid = tr.dataset.uid;
    if (e.target.classList.contains('admAdd')) inp.value = (+inp.value || 0) + 100;
    if (e.target.classList.contains('admSave') || e.target.classList.contains('admAdd')) {
      const v = Math.max(0, Math.floor(+inp.value || 0));
      try { await req(`users/${uid}/coins.json`, { method: 'PUT', body: JSON.stringify(v) }); NC.ui.toast(`💾 ${tr.children[0].textContent} 코인 = ${v}`);
        if (NC.account && uid === NC.account.uid) { applying = true; U.store.set('nc_coins', v); NC.emit('coins', v, 0); applying = false; } } catch (er) { NC.ui.toast('저장 실패: ' + er.message); }
    }
  });
  document.getElementById('admRe').onclick = load;
  document.getElementById('admFix').onclick = async () => {
    try { const all = await req('users.json') || {}; const miss = Object.entries(all).filter(([, u]) => u && u.id && typeof u.coins !== 'number');
      await Promise.all(miss.map(([uid]) => req(`users/${uid}/coins.json`, { method: 'PUT', body: JSON.stringify(DEFAULT_COINS) }))); NC.ui.toast(`🪙 ${miss.length}명에게 코인 항목(${DEFAULT_COINS}) 추가`); load();
    } catch (er) { NC.ui.toast('일괄 추가 실패: ' + er.message); }
  };
  document.getElementById('admDisco').onclick = () => NC.Party && NC.Party.start('disco');
  document.getElementById('admBlues').onclick = () => NC.Party && NC.Party.start('blues');
  load(); await p;
}
if (NC.account) setTimeout(syncAccount, 300);
NC.on && NC.on('start', adminUi);
NC.Auth = { changeCharacter, findBy, getSession, logout: () => setSession(null), DB, syncAccount, adminPanel };

/* ───── ⚙ 설정 메뉴에 계정 항목 추가 ───── */
const qm = $('#qmenu');
if (qm) { const sep = document.createElement('div'); sep.className = 'qsep'; qm.appendChild(sep);
  const bc = document.createElement('button'); bc.id = 'qChar'; qm.appendChild(bc);
  const refresh = () => { const a = NC.account; bc.textContent = a ? `🧍 내 캐릭터 변경 (No.${a.characterNo})` : '🧍 캐릭터 변경은 로그인 후 가능'; bc.disabled = !a; };
  const bo = document.createElement('button'); bo.id = 'qLogout'; bo.textContent = '🚪 로그아웃'; qm.appendChild(bo);
  bo.onclick = () => { qm.style.display = 'none'; NC.ui.modal('<h3>🚪 로그아웃할까요?</h3><p style="font-size:13px">처음 입장 화면으로 돌아가요.</p>', [['로그아웃', 'ok', true], ['취소', 0]]).then(r => { if (r.val !== 'ok') return; restoreGuestCoins(); setSession(null); location.reload(); }); };
  bc.onclick = () => { qm.style.display = 'none'; changeCharacter().then(refresh); };
  const refresh2 = () => { refresh(); bo.style.display = NC.account ? '' : 'none'; }; $('#btnQuality').addEventListener('click', refresh2); refresh2(); }

/* ───── 입장 가드: 로그인 상태면 계정 닉네임·캐릭터 강제 ───── */
NC.hooks.beforeStart.unshift(async () => { const a = NC.account; if (a) { applyAccount(a); NC.settings.name = a.nickname; NC.settings.look = E.buildLook(); } });
goBtn.addEventListener('click', () => { const a = NC.account; if (a) $('#nick').value = a.nickname; }, true);
show(NC.account ? 'login' : 'guest');
})();
