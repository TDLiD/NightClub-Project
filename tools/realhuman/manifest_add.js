// node manifest_add.js <id> <f|m> <label> <east|west> <dressy|casual|suit> [옵션...]  — manifest.json 에 모델 추가(이미 있으면 갱신) + playerPool 맨 뒤에 추가
//  v70 옵션: --outfits=concert,casual (메시 이름 OUT_<세트>_… 와 같게) · --outfit=casual (기본 한 벌) · --name=조여사 (표시 이름)
//            --no19 (블루스 19+ 칩·모텔 19+ 대상에서 제외 — 실존 인물 얼굴로 만든 캐릭터는 꼭 켜 두세요) · --npc-only (회원 캐릭터 선택 목록에 넣지 않음)
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--')), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const [id, g, label, look = 'east', wear = 'casual'] = pos;
const P = path.join(__dirname, '../../public/models/humans/manifest.json'), M = JSON.parse(fs.readFileSync(P, 'utf8'));
const e = { id, url: `models/humans/${id}.glb`, lod: `models/humans/${id}_lod.glb`, lodm: `models/humans/${id}_lodm.glb`, gender: g, label, full: `models/humans/full/${id}.jpg`, portrait: `profile/real/${id}.jpg`, look, wear, src: 'custom' };
if (opt.outfits) { e.outfits = String(opt.outfits).split(',').map(s => s.trim()).filter(Boolean); e.outfit = opt.outfit && e.outfits.includes(opt.outfit) ? opt.outfit : e.outfits[0]; }
if (opt.name) e.name = String(opt.name);
if (opt.no19) e.no19 = true;
const i = M.models.findIndex(m => m.id === id); if (i >= 0) M.models[i] = Object.assign(M.models[i], e); else M.models.push(e);
if (!opt['npc-only']) { const pool = M.playerPool[g] = (M.playerPool[g] || []).filter(x => x !== id); pool.push(id); }   // 맨 뒤에 추가 — 기존 회원의 캐릭터 번호(characterNo = 순번)가 바뀌지 않게
else if (M.playerPool[g] && M.playerPool[g].includes(id)) console.log('주의: 이미 playerPool 에 있음 — 회원 번호가 바뀌지 않게 그대로 둠');
fs.writeFileSync(P, JSON.stringify(M, null, 1)); console.log('manifest:', JSON.stringify(e));
