/* entry.js — v12 입장 화면
 *  ■ 닉네임 샘플 10개(🎲 새로 뽑기)  ■ 👗 스타일 바꾸기: 미리 만든 멋쟁이 스타일 22종(전신 3D 썸네일)
 *  ■ 🎨 내 3D 캐릭터 만들기: 얼굴·몸매·헤어·의상·소품을 고르고 저장(전신 3D 미리보기, 마우스로 회전)
 *  ■ 🌐 온라인 버튼에 현재 접속자 수 표시(5초마다 갱신) · 접속자 0명이면 🤖 솔로가 기본 선택
 */
(() => {
'use strict';
const NC = window.NC, T = window.THREE, U = NC.util, $ = s => document.querySelector(s);
const E = NC.entry; if (!E) return;
const cfg = E.cfg;

/* ───── 전신 3D 미리보기 렌더러 (별도 작은 캔버스 하나를 재사용) ───── */
let R = null;
function rig() {
  if (R) return R;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(26, 3 / 4, .1, 20);
  scene.add(new T.HemisphereLight(0xfff0ff, 0x30204a, 1.05));
  const key = new T.DirectionalLight(0xffffff, 1.3); key.position.set(1.5, 3, 2.5); scene.add(key);
  const rim = new T.DirectionalLight(0xff5fd2, .9); rim.position.set(-2, 2, -2); scene.add(rim);
  const fill = new T.DirectionalLight(0x5fd2ff, .45); fill.position.set(2, 1, -1.5); scene.add(fill);
  const floor = new T.Mesh(new T.CircleGeometry(.6, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xff5fd2, transparent: true, opacity: .18 })); scene.add(floor);
  R = { renderer, scene, cam, cur: null }; return R;
}
function draw(look, w, h, ry = .35, target) {
  const r = rig(); r.renderer.setSize(w, h, false); r.cam.aspect = w / h; r.cam.updateProjectionMatrix();
  if (r.cur) { r.scene.remove(r.cur); try { const f = r.cur.userData.face; f && f.tex && f.tex.dispose(); } catch (e) { } }   // v34 이전 미리보기 얼굴 텍스처 해제
  const g = NC.Avatar.create({ name: 'preview', look, seed: cfg.seed, expr: 'smile', hiRes: true });
  g.traverse(o => { if (o.isSprite) o.visible = false; });
  g.rotation.y = ry; r.scene.add(g); r.cur = g;
  const H = (look.height || 1.65); r.cam.position.set(0, H * .6, H * 2.3); r.cam.lookAt(0, H * .53, 0);
  r.renderer.render(r.scene, r.cam);
  if (target) { const c = target.getContext('2d'); c.clearRect(0, 0, target.width, target.height); c.drawImage(r.renderer.domElement, 0, 0, target.width, target.height); }
  return r.renderer.domElement.toDataURL('image/png');
}
// 시작 화면 미리보기 = 전신 3D
const previewNow = look => { try { draw(look, 240, 276, .4, $('#facePrev')); } catch (e) { console.warn(e); NC.Avatar.preview($('#facePrev'), look, 'smile'); } };
/* v36 모바일: 3D 미리보기는 버튼 반응이 먼저 그려진 뒤(디바운스 120ms), 처음 한 번은 브라우저가 한가할 때 → 성별·스타일 버튼 터치가 즉시 반응 */
let pvT = null, pvFirst = true;
E.preview = look => {
  if (!NC.isMobile) return previewNow(look);
  clearTimeout(pvT); const run = () => { pvT = null; if (NC.started) return; previewNow(look); };
  if (pvFirst) { pvFirst = false; (window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 2500 }) : f => setTimeout(f, 1200))(run); return; }
  pvT = setTimeout(() => requestAnimationFrame(run), 120);
};

/* ───── 1. 닉네임 샘플 ───── */
const NICKS = ['밤의황제', '부킹왕', '춤신춤왕', '나이트여신', '불금러버', '골드미스', '강남제비', '블루스킹', '홍대여우', '압구정공주', '디스코킹', '청담스타', '미러볼요정', '샴페인걸', '로맨티스트', '야간비행', '네온나비', '추억소환', '금요일밤', '무대장악',
  '보스베이비', '퀸카', '킹카', '스윙보이', '댄싱퀸', '분위기메이커', '건배요정', '야경덕후', '레트로맨', '핑크레이디'];
function nickChips() {
  const box = $('#nickSamples'); if (!box) return;
  const pick = U.shuffle ? U.shuffle(NICKS.slice()).slice(0, 10) : NICKS.slice().sort(() => Math.random() - .5).slice(0, 10);
  box.innerHTML = pick.map(n => `<button type="button" class="nk">${n}</button>`).join('') + '<button type="button" class="nk re" title="새로 뽑기">🎲</button>';
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.classList.contains('re')) return nickChips(); $('#nick').value = b.textContent; box.querySelectorAll('.nk').forEach(x => x.classList.toggle('on', x === b)); };
}
nickChips();

/* ───── 2. 스타일 프리셋 22종 (전체 패션) ───── */
const W_ = '#f4f4f6', K_ = '#16161a';
const STYLES = [
  // 여성
  ['f', '강남 클럽 퀸', { hairStyle: 'wavy', hairColor: '#17110f', top: 'dress', topColor: '#c8102e', bottom: 'skirt', bottomColor: '#c8102e', pattern: 'solid', shoes: 'boots', shoeColor: K_, necklace: true, hat: null, face: { earring: true, lipColor: '#c4475a', liner: .9, shadow: '#b06aa0', glasses: false, sunglasses: false } }],
  ['f', '블랙 미니드레스', { hairStyle: 'bob', hairColor: '#17110f', top: 'dress', topColor: '#141418', bottom: 'skirt', bottomColor: '#141418', pattern: 'solid', shoes: 'boots', shoeColor: K_, necklace: true, hat: null, face: { earring: true, lipColor: '#a83e52', liner: 1, glasses: false, sunglasses: false } }],
  ['f', '화이트 원피스', { hairStyle: 'long', hairColor: '#4e3020', top: 'dress', topColor: '#f6f2ec', bottom: 'skirt', bottomColor: '#f6f2ec', pattern: 'solid', shoes: 'sneakers', shoeColor: W_, necklace: false, hat: null, face: { earring: true, lipColor: '#e07a7a', blush: .5, glasses: false, sunglasses: false } }],
  ['f', '레트로 디스코', { hairStyle: 'wavy', hairColor: '#93653a', top: 'dress', topColor: '#e8b84a', bottom: 'skirt', bottomColor: '#e8b84a', pattern: 'solid', shoes: 'boots', shoeColor: '#e8b84a', necklace: true, hat: null, face: { earring: true, shadow: '#c88a6a', lipColor: '#d96f6f', glasses: false, sunglasses: false } }],
  ['f', '레더 록시크', { hairStyle: 'long', hairColor: '#17110f', top: 'jacket', topColor: '#1a1a1e', inner: 'tee', innerColor: '#1c1c20', bottom: 'pants', fit: 'skinny', bottomColor: '#141416', pattern: 'solid', shoes: 'boots', shoeColor: K_, hat: null, face: { liner: 1, lipColor: '#a83e52', glasses: false, sunglasses: false } }],
  ['f', '오피스 시크', { hairStyle: 'ponytail', hairColor: '#241812', top: 'shirt', topColor: '#f4f4f6', bottom: 'skirt', bottomColor: '#1d1d26', pattern: 'solid', shoes: 'boots', shoeColor: K_, hat: null, face: { glasses: true, sunglasses: false, lipColor: '#c4475a', earring: true } }],
  ['f', '홍대 힙스터', { hairStyle: 'bob', hairColor: '#ff8fb8', top: 'crop', topColor: '#1c1c22', bottom: 'shorts', bottomColor: '#3a5f9a', pattern: 'graphic', hat: 'cap', hatColor: '#f4f4f6', shoes: 'sneakers', shoeColor: W_, face: { earring: true, glasses: false, sunglasses: false } }],
  ['f', 'Y2K 걸', { hairStyle: 'twin', hairColor: '#c4a070', top: 'crop', topColor: '#ff7ab8', bottom: 'skirt', bottomColor: '#5a3a6a', pattern: 'solid', hat: 'beanie', hatColor: '#ffd23d', shoes: 'boots', shoeColor: W_, face: { blush: .6, earring: true, glasses: false, sunglasses: false } }],
  ['f', '레오파드 마담', { hairStyle: 'bun', hairColor: '#3b2417', top: 'dress', topColor: '#c9963a', bottom: 'skirt', bottomColor: '#c9963a', pattern: 'leopard', shoes: 'boots', shoeColor: K_, necklace: true, hat: null, face: { lipColor: '#b8485e', liner: .9, earring: true, glasses: false, sunglasses: false } }],
  ['f', '스트릿 오버핏', { hairStyle: 'braids', hairColor: '#241812', top: 'overshirt', topColor: '#3a3f6a', oversize: true, inner: 'tee', innerColor: W_, bottom: 'pants', fit: 'wide', bottomColor: '#2a2a30', pattern: 'stripe', hat: 'cap', hatColor: '#1c1c22', shoes: 'sneakers', shoeColor: W_, face: { earring: true, glasses: false, sunglasses: false } }],
  ['f', '데님 캐주얼', { hairStyle: 'ponytail', hairColor: '#6e4425', top: 'jacket', topColor: '#3a5f9a', inner: 'tee', innerColor: W_, bottom: 'pants', fit: 'skinny', bottomColor: '#24324e', pattern: 'solid', hat: null, shoes: 'sneakers', shoeColor: W_, face: { glasses: false, sunglasses: false } }],
  // 남성
  ['m', '강남 수트', { hairStyle: 'slick', hairColor: '#17110f', top: 'jacket', setup: true, topColor: '#1d2742', inner: 'tee', innerColor: W_, bottom: 'pants', fit: 'skinny', bottomColor: '#1d2742', pattern: 'solid', hat: null, shoes: 'sneakers', shoeColor: K_, necklace: false, face: { beard: null, glasses: false, sunglasses: false } }],
  ['m', '버건디 셋업', { hairStyle: 'side', hairColor: '#241812', top: 'jacket', setup: true, topColor: '#6a1f2e', inner: 'turtle', innerColor: K_, bottom: 'pants', fit: 'skinny', bottomColor: '#6a1f2e', pattern: 'solid', hat: null, shoes: 'sneakers', shoeColor: K_, face: { beard: null, glasses: false, sunglasses: false } }],
  ['m', '페도라 젠틀맨', { hairStyle: 'slick', hairColor: '#3b2417', top: 'vest', topColor: '#2a2a30', inner: 'tee', innerColor: W_, bottom: 'pants', fit: 'skinny', bottomColor: '#2a2a30', pattern: 'solid', hat: 'fedora', hatColor: '#1c1c22', shoes: 'sneakers', shoeColor: K_, face: { beard: 'stubble', glasses: false, sunglasses: false } }],
  ['m', '레트로 디스코킹', { hairStyle: 'curly', hairColor: '#241812', top: 'shirt', topColor: '#e8b84a', bottom: 'pants', fit: 'wide', bottomColor: '#f4f4f6', pattern: 'graphic', necklace: true, hat: null, shoes: 'sneakers', shoeColor: W_, face: { sunglasses: true, glasses: false, beard: null } }],
  ['m', '레더 바이커', { hairStyle: 'spiky', hairColor: '#17110f', top: 'jacket', topColor: '#141418', inner: 'turtle', innerColor: K_, bottom: 'pants', fit: 'ripped', bottomColor: '#1a1a20', pattern: 'solid', hat: null, shoes: 'boots', shoeColor: K_, face: { beard: 'stubble', glasses: false, sunglasses: false } }],
  ['m', '올블랙 시크', { hairStyle: 'twoblock', hairColor: '#17110f', top: 'jacket', topColor: '#121216', inner: 'tee', innerColor: K_, bottom: 'pants', fit: 'skinny', bottomColor: '#121216', pattern: 'solid', hat: null, shoes: 'sneakers', shoeColor: K_, necklace: true, face: { sunglasses: true, glasses: false, beard: null } }],
  ['m', '화이트 린넨', { hairStyle: 'side', hairColor: '#4e3020', top: 'shirt', topColor: '#f6f2ec', bottom: 'pants', fit: 'wide', bottomColor: '#cbb89a', pattern: 'solid', hat: null, shoes: 'sneakers', shoeColor: W_, face: { beard: null, glasses: false, sunglasses: false } }],
  ['m', '힙합 스트릿', { hairStyle: 'twoblock', hairColor: '#17110f', top: 'tee', topColor: '#141418', oversize: true, bottom: 'pants', fit: 'wide', bottomColor: '#3a3a42', pattern: 'graphic', hat: 'cap', hatColor: '#c8102e', shoes: 'sneakers', shoeColor: W_, necklace: true, face: { beard: null, glasses: false, sunglasses: false } }],
  ['m', '마이애미 나이트', { hairStyle: 'slick', hairColor: '#93653a', top: 'jacket', setup: true, topColor: '#f2a6c4', inner: 'tee', innerColor: W_, bottom: 'pants', fit: 'skinny', bottomColor: '#f2a6c4', pattern: 'solid', hat: null, shoes: 'sneakers', shoeColor: W_, face: { sunglasses: true, glasses: false, beard: null } }],
  ['m', '체크 캐주얼', { hairStyle: 'short', hairColor: '#3b2417', top: 'overshirt', topColor: '#7a2a2a', inner: 'tee', innerColor: W_, bottom: 'pants', fit: 'skinny', bottomColor: '#24324e', pattern: 'plaid', hat: null, shoes: 'sneakers', shoeColor: W_, face: { glasses: true, sunglasses: false, beard: null } }],
  ['m', '스포티 무드', { hairStyle: 'buzz', hairColor: '#17110f', top: 'tee', topColor: '#d22a3a', bottom: 'shorts', bottomColor: '#1c1c22', pattern: 'stripe', hat: null, shoes: 'sneakers', shoeColor: W_, face: { beard: 'goatee', glasses: false, sunglasses: false } }],
];
const MALE_EXTRA = [
  ['m', '머슬 보디가드', { hairStyle: 'buzz', hairColor: '#17110f', top: 'tee', topColor: '#141418', bottom: 'pants', fit: 'skinny', bottomColor: '#1a1a20', pattern: 'solid', muscle: 1, hat: null, shoes: 'boots', shoeColor: '#141418', face: { sunglasses: true, glasses: false, beard: 'stubble', attractive: true } }],
  ['m', '피트니스 킹', { hairStyle: 'twoblock', hairColor: '#241812', top: 'tee', topColor: '#f4f4f6', bottom: 'pants', fit: 'wide', bottomColor: '#3a3a42', pattern: 'solid', muscle: .85, hat: 'cap', hatColor: '#141418', shoes: 'sneakers', shoeColor: '#f4f4f6', necklace: true, face: { beard: null, glasses: false, sunglasses: false, attractive: true } }],
];
STYLES.push(...MALE_EXTRA);
/* v17 K-pop 스테이지 프리셋 (기존 번호는 그대로, 각 성별 목록 끝에 추가) */
const IDOL_FACE_F = { stage: true, liner: .95, lid: 1, earring: true, blush: .35, glasses: false, sunglasses: false, freckles: false, mole: null };
const IDOL_FACE_M = { attractive: true, earring: true, glasses: false, sunglasses: false, beard: null, mole: null };
STYLES.push(
  ['f', '스테이지 튤 룩', { idol: true, hairStyle: 'spaceBuns', hairColor: '#17110f', top: 'blazerCrop', topColor: '#141016', bottom: 'tutu', bottomColor: '#0d0b10', shoes: 'thigh', belt: true, choker: true, pattern: 'solid', hat: null, curve: .42, face: Object.assign({ lipColor: '#c4475a', shadow: '#d070a0' }, IDOL_FACE_F) }],
  ['f', '블랙 레더 홀터', { idol: true, hairStyle: 'highPony', hairColor: '#0e0b0e', top: 'halter', topColor: '#141016', bottom: 'leather', bottomColor: '#0d0b10', shoes: 'thigh', gloves: true, belt: true, pattern: 'solid', hat: null, curve: .42, face: Object.assign({ lipColor: '#a83e52', shadow: '#6a5aa0' }, IDOL_FACE_F) }],
  ['f', '퍼플 패턴 크롭', { idol: true, hairStyle: 'twinHigh', hairColor: '#0e0b0e', hair2: '#b06aff', top: 'meshCrop', topColor: '#5a2a7a', bottom: 'leather', bottomColor: '#0d0b10', shoes: 'boots', belt: true, choker: true, pattern: 'monogram', hat: null, curve: .42, face: Object.assign({ lipColor: '#d0566a', shadow: '#9a6ad8' }, IDOL_FACE_F) }],
  ['f', '그래피티 카고', { idol: true, hairStyle: 'long', hairColor: '#c8c4d8', hair2: '#b7a6d9', top: 'blazerCrop', topColor: '#141016', bottom: 'cargo', bottomColor: '#0d0b10', cargoPrint: true, shoes: 'boots', chain: true, pattern: 'solid', hat: 'newsboy', hatColor: '#121016', curve: .42, face: Object.assign({ lipColor: '#b8485e', shadow: '#6a5aa0' }, IDOL_FACE_F) }],
  ['f', '실버 하이 트윈', { idol: true, hairStyle: 'twinHigh', hairColor: '#e9e4ee', hair2: '#cfd2ff', top: 'halter', topColor: '#141016', bottom: 'tutu', bottomColor: '#0d0b10', shoes: 'thigh', choker: true, pattern: 'solid', hat: null, curve: .42, face: Object.assign({ lipColor: '#c4475a', shadow: '#9a6ad8' }, IDOL_FACE_F) }],
  ['f', '히메컷 블레이저', { idol: true, hairStyle: 'hime', hairColor: '#17110f', hair2: '#ff5fa8', top: 'blazerCrop', topColor: '#141016', bottom: 'leather', bottomColor: '#0d0b10', shoes: 'thigh', chain: true, belt: true, pattern: 'solid', hat: null, curve: .42, face: Object.assign({ lipColor: '#a83e52', shadow: '#b05a8a' }, IDOL_FACE_F) }],
  ['f', '베레모 시크', { idol: true, hairStyle: 'hime', hairColor: '#241812', top: 'meshCrop', topColor: '#3a2a5a', bottom: 'cargo', bottomColor: '#0d0b10', cargoPrint: true, shoes: 'boots', choker: true, pattern: 'monogram', hat: 'beret', hatColor: '#121016', curve: .42, face: Object.assign({ lipColor: '#d0566a', shadow: '#d070a0' }, IDOL_FACE_F) }],
  ['f', '걸크러시 스페이스번', { idol: true, hairStyle: 'spaceBuns', hairColor: '#0e0b0e', hair2: '#7a4cff', top: 'halter', topColor: '#141016', bottom: 'leather', bottomColor: '#0d0b10', shoes: 'boots', gloves: true, belt: true, chain: true, pattern: 'solid', hat: null, curve: .42, face: Object.assign({ lipColor: '#b8485e', shadow: '#6a5aa0' }, IDOL_FACE_F) }],
  ['m', '블랙 라이더 아이돌', { idol: true, hairStyle: 'comma', hairColor: '#0e0b0e', top: 'stageJacket', topColor: '#121014', inner: 'tee', innerColor: '#141016', bottom: 'pants', fit: 'skinny', bottomColor: '#0e0c10', shoes: 'boots', chain: true, pattern: 'solid', hat: null, face: Object.assign({}, IDOL_FACE_M) }],
  ['m', '콤마헤어 블랙수트', { idol: true, hairStyle: 'comma', hairColor: '#241812', top: 'jacket', topColor: '#121014', inner: 'tee', innerColor: '#f4f2ee', bottom: 'pants', fit: 'skinny', bottomColor: '#121014', shoes: 'boots', chain: true, pattern: 'solid', hat: null, face: Object.assign({}, IDOL_FACE_M) }],
  ['m', '울프컷 체인', { idol: true, hairStyle: 'wolf', hairColor: '#17110f', top: 'stageJacket', topColor: '#16141a', inner: 'tee', innerColor: '#f4f2ee', bottom: 'pants', fit: 'skinny', bottomColor: '#0e0c10', shoes: 'boots', chain: true, pattern: 'solid', hat: null, face: Object.assign({}, IDOL_FACE_M) }],
  ['m', '애쉬 실버 스테이지', { idol: true, hairStyle: 'wolf', hairColor: '#c8c4d8', top: 'stageJacket', topColor: '#121014', inner: 'tee', innerColor: '#141016', bottom: 'pants', fit: 'skinny', bottomColor: '#0e0c10', shoes: 'boots', chain: true, pattern: 'solid', hat: null, face: Object.assign({}, IDOL_FACE_M) }],
);
const fullLook = (g, over) => { const base = NC.Avatar.randomLook(cfg.seed, g); const l = Object.assign(base, { wings: false, strapless: false, mini: false, muscle: 0, curve: g === 'f' ? .6 : .5, idol: false, choker: false, chain: false, belt: false, gloves: false, hair2: null, cargoPrint: false }, JSON.parse(JSON.stringify(over)), { gender: g }); l.face = Object.assign(base.face, { stage: false }, over.face || {}); if (l.top === 'dress') { l.bottom = 'skirt'; l.bottomColor = l.topColor; } return l; };
const thumbCache = {};
E.openStyles = () => {
  const g = cfg.gender, list = STYLES.filter(s => s[0] === g), mine = U.store.get('nc_mychar', null);
  const cards = list.map(([, nm], i) => `<div class="stc" data-i="${STYLES.indexOf(list[i])}"><img alt=""><b>${nm}</b></div>`).join('')
    + (mine && mine.gender === g ? `<div class="stc" data-i="mine"><img alt=""><b>⭐ 내 캐릭터</b></div>` : '');
  NC.ui.modal(`<h3>👗 스타일 바꾸기 <small style="opacity:.6">${g === 'f' ? '여성' : '남성'} ${list.length}종 · 성별은 시작 화면에서 바꿔요</small></h3><div id="stGrid">${cards}</div>
    <p style="font-size:11px;opacity:.65;margin:6px 0 0">스타일을 고른 뒤에도 헤어·상의·색상은 시작 화면에서 바로 바꿀 수 있어요. 얼굴형은 🎲로 랜덤.</p>`,
    [['🎲 얼굴만 랜덤', 'rand'], ['닫기', 1, true]]).then(r => { if (r.val !== 'rand') return;
      cfg.seed = Math.random() * 1e9 | 0; if (cfg.full) { const keep = cfg.full; cfg.full = fullLook(cfg.gender, Object.assign({}, keep, { face: { glasses: keep.face.glasses, sunglasses: keep.face.sunglasses, beard: keep.face.beard, earring: keep.face.earring } })); } E.renderCustom(); E.openStyles(); });
  const grid = $('#stGrid'); if (!grid) return;
  const imgs = [...grid.querySelectorAll('.stc')];
  let k = 0; const step = () => {                      // 썸네일을 한 장씩 렌더 (화면 멈춤 방지)
    if (k >= imgs.length || !document.body.contains(grid)) return; const el = imgs[k++], i = el.dataset.i;
    const look = i === 'mine' ? mine : fullLook(g, STYLES[+i][2]), key = i + ':' + cfg.seed;
    el.querySelector('img').src = thumbCache[key] || (thumbCache[key] = draw(look, 150, 200, .45));
    requestAnimationFrame(step);
  }; requestAnimationFrame(step);
  grid.onclick = e => { const c = e.target.closest('.stc'); if (!c) return; const i = c.dataset.i;
    if (i === 'mine') { cfg.full = JSON.parse(JSON.stringify(mine)); cfg.styleName = '내 캐릭터'; } else { const s = STYLES[+i]; cfg.full = fullLook(s[0], s[2]); cfg.styleName = s[1]; }
    cfg.topColor = cfg.full.topColor; cfg.hairStyle = cfg.full.hairStyle; cfg.top = cfg.full.top;
    grid.querySelectorAll('.stc').forEach(x => x.classList.toggle('on', x === c)); E.renderCustom(); NC.ui.toast(`👗 ${cfg.styleName} 스타일 적용`);
  };
};

/* ───── 3. 내 3D 캐릭터 만들기 ───── */
const OPT = {
  hairF: [['long', '긴 생머리'], ['wavy', '웨이브'], ['bob', '단발'], ['ponytail', '포니테일'], ['bun', '똥머리'], ['twin', '양갈래'], ['braids', '땋은 머리']],
  hairM: [['short', '짧은 머리'], ['twoblock', '투블럭'], ['slick', '올백'], ['side', '가르마'], ['curly', '곱슬'], ['spiky', '스파이키'], ['buzz', '삭발']],
  topF: [['dress', '원피스'], ['crop', '크롭탑'], ['tee', '티셔츠'], ['shirt', '블라우스'], ['jacket', '재킷'], ['overshirt', '오버셔츠']],
  topM: [['shirt', '셔츠'], ['tee', '티셔츠'], ['jacket', '재킷'], ['overshirt', '오버셔츠'], ['vest', '베스트']],
  bottom: [['pants', '바지'], ['skirt', '스커트'], ['shorts', '반바지']], fit: [['skinny', '스키니'], ['wide', '와이드'], ['ripped', '찢청']],
  inner: [['tee', '라운드 티'], ['turtle', '터틀넥']], pattern: [['solid', '무지'], ['stripe', '스트라이프'], ['plaid', '체크'], ['leopard', '레오파드'], ['graphic', '그래픽']],
  hat: [['', '없음'], ['cap', '캡모자'], ['beanie', '비니'], ['fedora', '페도라']], shoes: [['sneakers', '스니커즈'], ['boots', '부츠']],
  skin: ['#fae3d3', '#f7dcc8', '#f1c9a5', '#ecc0a0', '#e3b08a', '#d39b72', '#c88e66', '#9a6a48'],
  hairC: ['#17110f', '#3b2417', '#6e4425', '#93653a', '#c4a070', '#e8c35a', '#b8b0a8', '#f2f2f2', '#6b2e3a', '#ff8fb8', '#7a8cff', '#c9572f'],
  eye: ['#3a2416', '#5a3a20', '#2a1a10', '#3d5a7a', '#4a6a3a', '#7a5a9a'], lip: ['#d0566a', '#c4475a', '#e07a7a', '#a83e52', '#e0857c', '#c08a80', '#8a2a3a'],
  cloth: ['#c8102e', '#ff3d9a', '#ff7ab8', '#9b5cff', '#3a5f9a', '#1d2742', '#3de6ff', '#4cd964', '#ffd23d', '#e8b84a', '#ff8a3d', '#f4f4f6', '#cbb89a', '#6a1f2e', '#2a2a30', '#141418'],
};
E.openCreator = () => {
  const L = cfg.full ? JSON.parse(JSON.stringify(cfg.full)) : E.buildLook(); L.face = L.face || {};
  const sel = (key, list, v, sub) => `<label>${key}<select data-k="${sub || ''}">${list.map(([k, t]) => `<option value="${k}"${(v || '') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const sw = (title, path, list, v) => `<div class="ccSw"><span>${title}</span>${list.map(c => `<i data-p="${path}" data-c="${c}" style="background:${c}" class="${c === v ? 'on' : ''}"></i>`).join('')}</div>`;
  const rng = (title, path, min, max, st, v) => `<label>${title}<input type="range" data-p="${path}" min="${min}" max="${max}" step="${st}" value="${v}"></label>`;
  const chk = (title, path, v) => `<label class="ck"><input type="checkbox" data-p="${path}"${v ? ' checked' : ''}> ${title}</label>`;
  const f = L.gender === 'f';
  const html = `<h3>🎨 내 3D 캐릭터 만들기</h3><div id="cc"><div class="ccL"><canvas id="ccPrev" width="300" height="400"></canvas><small>드래그해서 돌려 보기</small></div><div class="ccR">
    <div class="ccTab"><button data-t="body" class="on">몸매</button><button data-t="face">얼굴</button><button data-t="hair">헤어</button><button data-t="cloth">의상</button><button data-t="acc">소품</button></div>
    <div class="ccP" data-t="body">${rng('키', 'height', f ? 1.5 : 1.62, f ? 1.8 : 1.95, .01, L.height)}${rng('체형(마름 ↔ 볼륨)', 'build', .82, 1.22, .01, L.build || 1)}${f ? rng('글래머(실루엣)', 'curve', 0, 1, .05, L.curve != null ? L.curve : .6) : rng('어깨 넓이', 'curve', 0, 1, .05, L.curve != null ? L.curve : .5) + rng('💪 근육량', 'muscle', 0, 1, .05, L.muscle || 0)}${sw('피부', 'skin', OPT.skin, L.skin)}</div>
    <div class="ccP" data-t="face" hidden>${rng('눈 크기', 'face.eyeSize', .75, 1.3, .01, L.face.eyeSize || 1)}${rng('눈꼬리', 'face.eyeTilt', -.2, .2, .01, L.face.eyeTilt || 0)}${rng('얼굴 폭', 'face.faceW', .86, 1.08, .01, L.face.faceW || 1)}${rng('턱선', 'face.jaw', .86, 1.12, .01, L.face.jaw || 1)}${rng('코', 'face.nose', .75, 1.25, .01, L.face.nose || 1)}${rng('입술 도톰함', 'face.lipFull', .7, 1.4, .01, L.face.lipFull || 1)}${rng('눈썹 두께', 'face.browThick', .4, 1.6, .01, L.face.browThick || 1)}${f ? rng('아이라인', 'face.liner', 0, 1, .05, L.face.liner || 0) + rng('볼터치', 'face.blush', 0, .8, .05, L.face.blush || 0) : ''}${sw('눈동자', 'face.eyeColor', OPT.eye, L.face.eyeColor)}${sw('입술', 'face.lipColor', OPT.lip, L.face.lipColor)}</div>
    <div class="ccP" data-t="hair" hidden>${sel('헤어스타일', f ? OPT.hairF : OPT.hairM, L.hairStyle, 'hairStyle')}${sw('헤어 색', 'hairColor', OPT.hairC, L.hairColor)}${!f ? sel('수염', [['', '없음'], ['stubble', '까칠 수염'], ['goatee', '염소 수염']], L.face.beard || '', 'face.beard') : ''}</div>
    <div class="ccP" data-t="cloth" hidden>${sel('상의', f ? OPT.topF : OPT.topM, L.top, 'top')}${sw('상의 색', 'topColor', OPT.cloth, L.topColor)}${sel('패턴', OPT.pattern, L.pattern, 'pattern')}${sel('이너', OPT.inner, L.inner, 'inner')}${sw('이너 색', 'innerColor', OPT.cloth, L.innerColor)}${sel('하의', OPT.bottom, L.bottom, 'bottom')}${sel('핏', OPT.fit, L.fit, 'fit')}${sw('하의 색', 'bottomColor', OPT.cloth, L.bottomColor)}${f ? chk('스트랩리스(원피스·크롭)', 'strapless', L.strapless) + chk('미니 길이(스커트·핫팬츠)', 'mini', L.mini) : ''}${chk('상하의 셋업(재킷)', 'setup', L.setup)}${chk('오버사이즈', 'oversize', L.oversize)}${sel('신발', OPT.shoes, L.shoes, 'shoes')}${sw('신발 색', 'shoeColor', OPT.cloth, L.shoeColor)}</div>
    <div class="ccP" data-t="acc" hidden>${sel('모자', OPT.hat, L.hat || '', 'hat')}${sw('모자 색', 'hatColor', OPT.cloth, L.hatColor)}${chk('안경', 'face.glasses', L.face.glasses)}${chk('선글라스', 'face.sunglasses', L.face.sunglasses)}${chk('귀걸이', 'face.earring', L.face.earring)}${chk('목걸이', 'necklace', L.necklace)}</div>
  </div></div>`;
  NC.ui.modal(html, [['💾 저장하고 적용', 'save', true], ['취소', 0]]).then(r => { if (r.val !== 'save') return;
    U.store.set('nc_mychar', L); cfg.full = JSON.parse(JSON.stringify(L)); cfg.styleName = '내 캐릭터'; cfg.topColor = L.topColor; cfg.hairStyle = L.hairStyle; cfg.top = L.top; E.renderCustom(); NC.ui.toast('💾 내 3D 캐릭터를 저장했어요 — 👗 스타일 목록의 ⭐ 내 캐릭터에서도 불러올 수 있어요'); });
  const root = $('#cc'); if (!root) return; const cv = $('#ccPrev'); let ry = .4, dirty = true, drag = null;
  const setP = (p, v) => { const ks = p.split('.'); let o = L; while (ks.length > 1) { const k = ks.shift(); o = o[k] = o[k] || {}; } o[ks[0]] = v; if (p === 'top' && v === 'dress') { L.bottom = 'skirt'; L.bottomColor = L.topColor; } if (p === 'topColor' && L.top === 'dress') L.bottomColor = v; dirty = true; };
  root.addEventListener('input', e => { const t = e.target; if (t.matches('input[type=range]')) setP(t.dataset.p, +t.value); else if (t.matches('input[type=checkbox]')) setP(t.dataset.p, t.checked); else if (t.matches('select')) setP(t.dataset.k, t.value || null); });
  root.addEventListener('click', e => { const i = e.target.closest('i[data-p]'); if (i) { setP(i.dataset.p, i.dataset.c); i.parentNode.querySelectorAll('i').forEach(x => x.classList.toggle('on', x === i)); }
    const tb = e.target.closest('.ccTab button'); if (tb) { root.querySelectorAll('.ccTab button').forEach(b => b.classList.toggle('on', b === tb)); root.querySelectorAll('.ccP').forEach(p => p.hidden = p.dataset.t !== tb.dataset.t); } });
  cv.onpointerdown = e => { drag = e.clientX; cv.setPointerCapture(e.pointerId); }; cv.onpointermove = e => { if (drag == null) return; ry += (e.clientX - drag) * .012; drag = e.clientX; dirty = true; }; cv.onpointerup = () => { drag = null; };
  let built = null, builtKey = '';
  const loop = () => { if (!document.body.contains(cv)) return; requestAnimationFrame(loop);
    if (!dirty && drag == null) { ry += .004; } else dirty = false;
    const key = JSON.stringify(L);
    if (key !== builtKey) { builtKey = key; built = true; draw(L, 300, 400, ry, cv); }
    else if (built) { const r = rig(); r.cur.rotation.y = ry; r.renderer.render(r.scene, r.cam); const c = cv.getContext('2d'); c.clearRect(0, 0, 300, 400); c.drawImage(r.renderer.domElement, 0, 0, 300, 400); } };
  loop();
};
const cm = $('#charMake'); if (cm) cm.onclick = () => E.openCreator();

/* ───── 4. 온라인 접속자 수 · 0명이면 솔로 기본 ───── */
let pollT = null, userPicked = false;
document.addEventListener('click', e => { if (e.target.closest('#modeSel button') && e.isTrusted) userPicked = true; });
E.onlineCount = n => {
  const on = $('#modeSel [data-m=online]'), so = $('#modeSel [data-m=solo]'); if (!on) return;
  on.innerHTML = `🌐 온라인 <span class="cnt${n ? ' live' : ''}">● 현재 ${n}명 접속</span>`;
  if (!userPicked) { const m = n > 0 ? 'online' : 'solo'; NC.settings.playMode = m; on.classList.toggle('on', m === 'online'); so.classList.toggle('on', m === 'solo'); }
  if (!pollT) pollT = setInterval(async () => {
    if ($('#start').style.display === 'none') { clearInterval(pollT); return; }
    try { const h = await (await fetch('/api/health', { cache: 'no-store' })).json(); E.onlineCount(h.online || 0); } catch (e) { }
  }, 5000);
};
// v13: 캐릭터 번호 = 성별별 스타일 순번(1~11). 회원 DB 의 characterNo 와 동기화
E.STYLES = STYLES;
E.stylesOf = g => STYLES.filter(s => s[0] === g);
E.lookByNo = (g, no) => { const L = E.stylesOf(g), s = L[U.clamp((no | 0) - 1, 0, L.length - 1)]; return fullLook(g, s[2]); };
E.styleName = (g, no) => { const L = E.stylesOf(g); return (L[U.clamp((no | 0) - 1, 0, L.length - 1)] || [])[1] || ''; };
E.thumb = (look, w = 150, h = 200) => draw(look, w, h, .45);
/* v34 미리보기용 두 번째 WebGL 화면은 입장하면 완전히 해제 — 모바일에서 WebGL 화면 2개가 동시에 살아 있으면
 *     메인 화면이 메모리 부족으로 끊겨(context lost) 로그인 화면으로 튕기던 원인 중 하나 */
E.releasePreview = () => { if (!R) return; try { if (R.cur) R.scene.remove(R.cur); R.renderer.dispose(); R.renderer.forceContextLoss(); R.renderer.domElement.width = R.renderer.domElement.height = 1; } catch (e) { } R = null; };
NC.on && NC.on('start', () => setTimeout(E.releasePreview, 300));
E.renderCustom();
})();
