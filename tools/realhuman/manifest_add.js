// node manifest_add.js <id> <f|m> <label> <east|west> <dressy|casual|suit>  — manifest.json 에 모델 추가(이미 있으면 갱신) + playerPool 맨 뒤에 추가
const fs = require('fs'), path = require('path');
const [id, g, label, look = 'east', wear = 'casual'] = process.argv.slice(2);
const P = path.join(__dirname, '../../public/models/humans/manifest.json'), M = JSON.parse(fs.readFileSync(P, 'utf8'));
const e = { id, url: `models/humans/${id}.glb`, lod: `models/humans/${id}_lod.glb`, lodm: `models/humans/${id}_lodm.glb`, gender: g, label, full: `models/humans/full/${id}.jpg`, portrait: `profile/real/${id}.jpg`, look, wear, src: 'custom' };
const i = M.models.findIndex(m => m.id === id); if (i >= 0) M.models[i] = Object.assign(M.models[i], e); else M.models.push(e);
const pool = M.playerPool[g] = (M.playerPool[g] || []).filter(x => x !== id);
pool.push(id);   // 맨 뒤에 추가 — 기존 회원의 캐릭터 번호(characterNo = 순번)가 바뀌지 않게
fs.writeFileSync(P, JSON.stringify(M, null, 1)); console.log('manifest:', id, g, label, look, wear, '· playerPool', g, pool.length);
