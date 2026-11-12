/* prompt3d.js — v31 🎨 실사 3D 캐릭터 프롬프트 생성기
 *  손님(또는 내 캐릭터)의 외형 데이터(나이·성별·피부·헤어·의상·소품·성격)를 읽어 미드저니/DALL-E 에 바로 붙여 넣는
 *  'Positive Prompt' 와 'Negative Prompt' 를 영문으로 만듦. 마네킹·인형·도자기 피부 느낌을 없애는 실사 조건
 *  (모공 피부 · SSS · 눈 수분감 · 미세 주름 · 한 가닥 헤어 · 원단 섬유·스티치 · UE5 MetaHuman · Octane · 8K · 레이트레이싱 · 85mm)을 항상 포함.
 *  열기: 대화 패널 오른쪽 위 🎨 · 우측 클럽 설정 아래 「🎨 내 캐릭터」 · NC.Prompt3D.open(npc 또는 'me')
 */
(() => {
'use strict';
const NC = window.NC; if (!NC) return;
const U = NC.util, $ = s => document.querySelector(s), T = NC.THREE;

/* ── 색 이름 (가장 가까운 이름) ── */
const COLS = [['jet black', '#0c0a0c'], ['black', '#1a1a1d'], ['charcoal grey', '#3a3a40'], ['grey', '#8a8a90'], ['silver grey', '#c8c8d0'], ['white', '#f6f6f4'], ['ivory', '#eeeae0'], ['cream', '#e9dcc4'], ['beige', '#cdbb98'], ['camel', '#b08a5a'],
  ['dark brown', '#2e1e14'], ['chestnut brown', '#5a3420'], ['ash brown', '#6b5440'], ['light brown', '#8a6a48'], ['honey blonde', '#c9a060'], ['platinum blonde', '#e8dcb8'], ['auburn', '#8a3e1a'],
  ['navy', '#1f2a4a'], ['midnight navy', '#151a2e'], ['royal blue', '#2c3e8a'], ['denim blue', '#3a5070'], ['sky blue', '#a8c8e8'], ['teal', '#2a7a7a'], ['sage green', '#8a9e7c'], ['olive green', '#4a5a3a'], ['emerald green', '#2a6a4a'],
  ['burgundy', '#5a1f2c'], ['wine red', '#7a2a3a'], ['berry red', '#8a3a4a'], ['red', '#c8282e'], ['coral', '#e8786a'], ['blush pink', '#f0c8cc'], ['pastel pink', '#f2b8cc'], ['hot pink', '#ff2d8a'], ['lavender', '#c8b6ea'], ['purple', '#6a3a9a'],
  ['mustard yellow', '#d8b03a'], ['gold', '#d8b35a'], ['orange', '#e8742a'], ['tan', '#c2b29a'], ['chocolate brown', '#4a3022']];
const RGB = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; };
const CR = COLS.map(([n, h]) => [n, RGB(h)]);
const cname = hex => { if (!hex || typeof hex !== 'string') return ''; const a = RGB(hex); let best = CR[0], bd = 9; CR.forEach(c => { const d = (a[0] - c[1][0]) ** 2 + (a[1] - c[1][1]) ** 2 + (a[2] - c[1][2]) ** 2; if (d < bd) { bd = d; best = c; } }); return best[0]; };

const LIPS = [['nude beige', '#c8968a'], ['rosy pink', '#d07a8a'], ['soft coral', '#d8786a'], ['berry', '#a83e52'], ['deep red', '#9a2a3a'], ['peach', '#e0a090'], ['mauve', '#b07a86'], ['muted rose', '#c06a6e']].map(([n, h]) => [n, RGB(h)]);
const lipName = hex => { if (!hex) return 'natural'; const a = RGB(hex); let b = LIPS[0], bd = 9; LIPS.forEach(c => { const d = (a[0] - c[1][0]) ** 2 + (a[1] - c[1][1]) ** 2 + (a[2] - c[1][2]) ** 2; if (d < bd) { bd = d; b = c; } }); return b[0]; };
/* ── 외형 → 영문 묘사 ── */
const HAIR = { long: 'long straight', wavy: 'long softly wavy', bob: 'chin-length bob', ponytail: 'ponytail', bun: 'neat low bun', twin: 'twin pigtails', braids: 'long braids', twinHigh: 'high twin tails', spaceBuns: 'double space buns', hime: 'straight hime-cut with blunt bangs', highPony: 'sleek high ponytail',
  short: 'short neat', twoblock: 'two-block undercut', slick: 'slicked-back', curly: 'short curly', spiky: 'textured spiky', side: 'side-parted', buzz: 'buzz-cut', comma: 'comma-style fringe', wolf: 'layered wolf-cut' };
const PAT = { floral: 'small ditsy floral print', stripe: 'striped', plaid: 'plaid', leopard: 'leopard print', graphic: 'graphic print', monogram: 'diamond monogram pattern', paisley: 'paisley print', knit: 'chunky knit', cord: 'corduroy' };
const HAT = { cap: 'baseball cap', beanie: 'knit beanie', beret: 'wool beret', newsboy: 'newsboy cap', fedora: 'felt fedora', bucket: 'bucket hat', visor: 'sun visor without logo' };
const BODYW = { slim: 'slim, lean build with narrow shoulders and visible collarbones', average: 'average everyday build', soft: 'slightly chubby build with a soft belly and fuller upper arms', athletic: 'fit athletic build with natural muscle definition', stocky: 'stocky, broad-shouldered build with thick arms and a little belly', curvy: 'curvy build with fuller hips' };
const SHOE = { platform: 'chunky 1990s platform shoes with 6-7 cm soles', sneakers: 'sneakers with visible mesh and stitching', boots: 'leather ankle boots with natural creases', thigh: 'glossy thigh-high boots', sandals: 'strappy sandals', flats: 'ballet flats' };
const POSEW = { dance: 'caught mid-dance on a crowded dance floor', drink: 'holding a drink glass at chest height, mid-conversation at the bar', talk: 'talking and gesturing with one hand', lean: 'leaning against a wall with weight on one leg, arms crossed', pocket: 'standing with hands in pockets' };
const MOOD = { cool: 'composed, confident expression with a faint knowing smile', shy: 'gentle, slightly shy smile', outgoing: 'bright, warm genuine smile with natural smile lines', playful: 'playful grin with crinkled eyes' };
const ETH = { east: 'East Asian (Korean)', jp: 'East Asian (Japanese)', west: 'Caucasian', black: 'Black' };
const ageWord = (a, f) => { a = +a || 28; const d = a < 23 ? 'early 20s' : a < 27 ? 'mid-20s' : a < 30 ? 'late 20s' : a < 34 ? 'early 30s' : a < 37 ? 'mid-30s' : a < 40 ? 'late 30s' : a < 44 ? 'early 40s' : a < 47 ? 'mid-40s' : a < 50 ? 'late 40s' : a < 54 ? 'early 50s' : a < 57 ? 'mid-50s' : 'late 50s'; return `${f ? 'woman' : 'man'} in her ${d}`.replace('her', f ? 'her' : 'his'); };

function describe(look, meta) {
  const f = look.gender === 'f', F = look.face || {}, age = meta.age, out = {};
  out.subject = `${ETH[meta.ethnic || look.ethnic] || ETH.east} ${ageWord(age, f)}, ${f ? 'height about ' + Math.round((look.height || 1.63) * 100) + ' cm' : 'height about ' + Math.round((look.height || 1.76) * 100) + ' cm'}${look.body ? ', ' + BODYW[look.body] : ''}, realistic adult proportions about 7.5-8 heads tall, ${meta.pose ? POSEW[meta.pose] || 'natural relaxed standing pose' : 'natural relaxed standing pose'}, ${MOOD[meta.trait] || MOOD.outgoing}`;
  const extras = [];
  if (F.freckles) extras.push('light freckles across the nose'); if (F.mole) extras.push('a small beauty mole'); if (!f && F.beard) extras.push(F.beard === 'goatee' ? 'neatly trimmed goatee' : 'light stubble shadow');
  if (+age >= 40) extras.push('natural crow\'s feet and fine forehead lines appropriate to age'); else extras.push('very fine lines only when smiling');
  out.face = `${cname(look.skin) ? 'natural ' + (look.ethnic === 'black' ? 'deep brown' : look.ethnic === 'west' ? 'fair' : 'warm light') + ' skin tone' : 'natural skin tone'}, ${extras.join(', ')}, ${f && (F.liner || 0) > .7 ? 'defined winged eyeliner, ' : f ? 'soft natural makeup, ' : ''}${f ? lipName(F.lipColor) + ' lips with natural lip texture and fine vertical lip lines' : 'natural lip color with fine lip lines'}`;
  const hair = `${cname(look.hairColor)} ${HAIR[look.hairStyle] || 'natural'} hair${look.hair2 ? ' with ' + cname(look.hair2) + ' highlights' : ''}`;
  out.hair = hair;
  const top = (() => { const c = cname(look.topColor), p = look.pattern && look.pattern !== 'solid' ? PAT[look.pattern] + ' ' : '';
    switch (look.top) {
      case 'tee': if (look.polo) return `${c} cotton piqué polo shirt with a soft collar and two-button placket${look.belly ? ', tucked in, pulling slightly over the belly' : ''}`; return look.pattern === 'knit' ? `oversized ${c} chunky knit crew-neck sweater with visible knit stitches` : `${c} ${p}${look.longSleeve ? 'long-sleeve fitted athletic top with fine jersey knit' : 'cotton crew-neck T-shirt'}`;
      case 'shirt': return `${c} ${p}button-up ${f ? 'silk-cotton blouse' : 'cotton shirt'} with visible weave and stitching`;
      case 'jacket': if (look.leather) return `${c} worn leather biker jacket with creased elbows over a white tee`; return look.sailor ? `${c} wool sailor-collar jacket with ${cname(look.sailor.trim)} piping on collar and cuffs` : `${c} ${p}tailored wool blazer${look.inner === 'turtle' ? ' over a ' + cname(look.innerColor) + ' turtleneck' : look.innerColor ? ' over a ' + cname(look.innerColor) + ' tee' : ''}`;
      case 'dress': if (look.sequin) return `${c} sequined ${look.mini ? 'mini ' : ''}slip dress with thin straps, sequins catching the light`; return `${c} ${p}${look.maxi ? 'sleeveless ankle-length maxi dress' : look.mini ? 'mini dress' : 'midi dress'} in light flowing fabric`;
      case 'crop': return `${c} ${p}${look.metallic ? 'metallic ' : look.sequin ? 'sequined ' : ''}ribbed cropped top`;
      case 'overshirt': return `${c} ${p}knit cardigan / overshirt over a ${cname(look.innerColor)} tee`;
      case 'halter': return `${c} ${look.metallic ? 'metallic foil ' : look.sequin ? 'sequined ' : ''}halter-neck top`; case 'blazerCrop': return `${c} cropped blazer with gold buttons`; case 'meshCrop': return `${c} sheer mesh crop top`; case 'vest': return `${c} tailored vest over a white shirt`; case 'stageJacket': return `${c} leather rider jacket with silver hardware`;
      default: return `${c} top`; } })();
  const bot = look.top === 'dress' ? '' : (() => { const c = cname(look.bottomColor), bp = look.bottomPattern ? PAT[look.bottomPattern] + ' ' : '';
    switch (look.bottom) {
      case 'skirt': return `${c} ${look.mini ? 'mini skirt' : look.maxi ? 'long flowing skirt' : 'knee-length A-line skirt'}`;
      case 'pants': return `${c} ${bp}${look.fit === 'wide' ? 'wide-leg trousers' : look.fit === 'ripped' ? 'ripped skinny jeans' : 'slim tailored trousers'}`;
      case 'shorts': return `${c} ${look.mini ? 'short shorts' : 'athletic shorts'}`; case 'tutu': return `${c} layered tulle skirt`; case 'leather': return `${c} leather mini skirt`; case 'cargo': return `${c} cargo pants`;
      default: return `${c} trousers`; } })();
  const acc = [];
  if (look.hat) acc.push(`${cname(look.hatColor)} ${HAT[look.hat] || 'hat'}`); if (F.glasses) acc.push(`${F.glassesColor ? cname(F.glassesColor) + ' ' : 'thin '}framed glasses with realistic lens reflections`); if (F.sunglasses) acc.push('sunglasses');
  if (look.bandana) acc.push(`${cname(look.bandana.color)} paisley bandana tied at the neck`); if (look.bag) acc.push(`${cname(look.bag.color)} leather crossbody bag with worn strap edges`);
  if (look.necklace) acc.push('delicate gold necklace'); if (look.choker) acc.push('black choker'); if (look.chain) acc.push('silver chain'); if (F.earring) acc.push('small earrings');
  const shoes = `${cname(look.shoeColor)} ${SHOE[look.shoes] || 'shoes'}`.trim();
  out.clothing = [top, bot, shoes].filter(Boolean).join('; ') + (acc.length ? '; accessories: ' + acc.join(', ') : '');
  return out;
}

const NEG = ['mannequin', 'doll', 'toy-like', 'action figure', 'plastic skin', 'porcelain skin', 'waxy skin', 'rubber skin', 'clay texture', 'airbrushed', 'overly smooth skin', 'beauty filter', 'CGI look', 'video game graphics',
  'low poly', 'low polygon', 'cartoon', 'anime', 'stylized', 'uncanny valley', 'dead eyes', 'glassy eyes', 'perfect symmetry', 'flat lighting', 'harsh shadows', 'overexposed', 'oversaturated', 'blurry', 'low resolution',
  'jpeg artifacts', 'deformed hands', 'extra fingers', 'distorted face', 'stiff pose', 'floating clothes', 'fabric clipping', 'logo', 'brand name', 'text', 'watermark'];

function build(look, meta, extra) {
  const d = describe(look, meta);
  const positive = [
    `Hyperrealistic full-body 3D digital human for a metaverse platform, Unreal Engine 5 MetaHuman quality, indistinguishable from a real photograph.`,
    `Subject: ${d.subject}.`,
    `Skin & face: pore-level skin texture with visible pores, subsurface scattering (SSS) with warm light bleeding through ear edges and nostrils, ${d.face}, natural uneven skin tone with faint redness, realistic specular breakup (oilier T-zone, matte cheeks), micro-wrinkles and natural smile lines, slight facial asymmetry.`,
    `Eyes: moist, lifelike irises with fibrous detail, wet tear line, accurate corneal reflections and catchlights, individual eyelashes of varied length, eyebrows with individual hairs.`,
    `Hair: ${d.hair}, individual hair strands, natural flyaways, soft anisotropic highlights, realistic hairline.`,
    `Clothing: ${d.clothing}; visible textile fibers, real sewing stitches and seams, natural fabric folds and wrinkles at elbows and waist, realistic drape and slight wear.`,
    extra ? `Additional details: ${extra}.` : '',
    `Rendering: Octane Render, ray-traced lighting and reflections, global illumination, physically based materials, soft cinematic studio key light with gentle rim light, neutral grey studio backdrop, 85mm portrait lens, f/2.8, sharp focus on the face, 8K resolution, ultra-detailed.`,
  ].filter(Boolean).join('\n');
  const negative = NEG.join(', ');
  const flat = positive.replace(/\n/g, ' ');
  return { positive, negative, mj: `${flat} --no ${NEG.slice(0, 22).join(', ')} --ar 2:3 --style raw --v 7`, dalle: `${flat}\nAvoid: ${negative}.` };
}

/* ── UI ── */
const st = document.createElement('style'); st.textContent = `
#p3d{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(8,3,20,.72)}
#p3d .box{width:min(760px,96vw);max-height:92vh;overflow:auto;background:var(--panel,#1d1433);border:1px solid var(--line,#6b4bc0);border-radius:16px;padding:14px 16px;color:#fff;box-sizing:border-box}
#p3d h3{margin:0 0 6px;font-size:17px}#p3d .sub{font-size:12.5px;color:#d6c6ff;margin-bottom:8px}
#p3d label{display:block;font-size:12.5px;font-weight:700;margin:10px 0 4px;color:#ffd6f0}
#p3d textarea{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#120a24;color:#f4f0ff;font:12.5px/1.5 ui-monospace,Consolas,monospace;padding:8px;resize:vertical}
#p3d input{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#120a24;color:#fff;padding:8px;font-size:14px}
#p3d .row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#p3d button{padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:#2f1960;color:#fff;cursor:pointer;font-size:13px}
#p3d button.pri{background:linear-gradient(135deg,#ff3d9a,#7b3dff);border:0;font-weight:700}
#tPrompt{position:absolute;right:38px;top:8px;background:none;border:0;color:#fff;font-size:17px;cursor:pointer;opacity:.85}#tPrompt:hover{opacity:1}
#cpPrompt{width:100%;margin-top:6px}`;
document.head.appendChild(st);
const box = document.createElement('div'); box.id = 'p3d'; box.innerHTML = `<div class="box"><h3>🎨 실사 3D 캐릭터 프롬프트 <span id="p3Name"></span></h3>
  <div class="sub">이 캐릭터의 외형을 영문으로 옮겨 미드저니·DALL-E 에 바로 붙여 넣을 수 있게 만들었어요. 마네킹·인형·도자기 피부 느낌을 없애는 실사 조건이 항상 들어가요.</div>
  <label>✏ 추가 설명 (선택 · 영문 권장 — 예: wearing a gold watch, standing in a neon nightclub)</label><input id="p3Extra" placeholder="비워 두면 캐릭터 정보만으로 만들어요">
  <label>✅ Positive Prompt</label><textarea id="p3Pos" rows="11" readonly></textarea>
  <label>⛔ Negative Prompt</label><textarea id="p3Neg" rows="4" readonly></textarea>
  <div class="row"><button class="pri" data-c="pos">📋 Positive 복사</button><button class="pri" data-c="neg">📋 Negative 복사</button><button data-c="mj">📋 미드저니 한 줄 (--no 포함)</button><button data-c="dalle">📋 DALL-E·ChatGPT용 (Avoid 포함)</button><button id="p3Close">닫기</button></div></div>`;
document.body.appendChild(box);
let cur = null;
function render() { if (!cur) return; cur.res = build(cur.look, cur.meta, $('#p3Extra').value.trim()); $('#p3Pos').value = cur.res.positive; $('#p3Neg').value = cur.res.negative; }
async function copy(text) { try { await navigator.clipboard.writeText(text); NC.ui.toast('📋 복사했어요 — 미드저니/DALL-E 에 붙여 넣으세요'); } catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); NC.ui.toast('📋 복사했어요'); } catch (er) { NC.ui.toast('복사에 실패했어요 — 글상자에서 직접 선택해 복사하세요'); } t.remove(); } }
box.addEventListener('click', e => { const b = e.target.closest('button[data-c]'); if (b && cur && cur.res) { const k = b.dataset.c; copy(k === 'pos' ? cur.res.positive : k === 'neg' ? cur.res.negative : cur.res[k]); } if (e.target === box) close(); });
$('#p3Close').onclick = () => close(); $('#p3Extra').addEventListener('input', render); $('#p3Extra').addEventListener('keydown', e => e.stopPropagation());
function close() { box.style.display = 'none'; cur = null; }
function open(target) {
  let g, meta;
  if (target === 'me' || !target) { g = NC.player && NC.player.group; meta = { age: (NC.account && NC.account.age) || 28, trait: 'outgoing', name: (NC.settings.name || '나'), ethnic: 'east' }; }
  else { g = target.g; const d = target.def || {}, pr = NC.Service && NC.Service.profile ? NC.Service.profile(target) : null; meta = { age: d.age || (pr && pr.age) || 28, trait: target.trait || d.trait, name: target.name, pose: d.pose, ethnic: (d.look && d.look.ethnic) || (/[가-힣]/.test(target.name) || target.name === 'Lena' ? 'east' : null) }; }
  if (!g || !g.userData || !g.userData.look) return NC.ui.toast('캐릭터 정보를 찾지 못했어요');
  cur = { look: g.userData.look, meta }; $('#p3Name').textContent = '— ' + meta.name; $('#p3Extra').value = ''; render(); box.style.display = 'flex';
}
/* 진입점: 대화 패널 🎨 · 클럽 설정 패널 「🎨 내 캐릭터 프롬프트」 */
{ const th = $('#talk .th'); if (th) { const b = document.createElement('button'); b.id = 'tPrompt'; b.title = '이 손님의 실사 3D 프롬프트 만들기'; b.textContent = '🎨'; th.appendChild(b); b.onclick = () => { const c = NC.Dialog && NC.Dialog.cur; if (c) open(c.n); }; } }
{ const body = $('#cpBody'); if (body) { const b = document.createElement('button'); b.id = 'cpPrompt'; b.textContent = '🎨 내 캐릭터 실사 프롬프트'; b.onclick = () => open('me'); body.appendChild(b); } }
NC.Prompt3D = { open, build, describe };
console.info('[prompt3d] 🎨 실사 3D 캐릭터 프롬프트 생성기 준비 완료');
})();
