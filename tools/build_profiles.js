/* tools/build_profiles.js — public/profile/index.json 다시 만들기
 *  사용: 프로젝트 폴더에서  node tools/build_profiles.js
 *  - boy/girl 폴더의 사진을 읽어 목록을 갱신 (기존 태그 eth/age/style 은 그대로 유지)
 *  - sharp 가 설치돼 있으면(npm i sharp) 320x400 썸네일(thumb/*.jpg)도 만듦. 없으면 원본을 그대로 사용
 *  - 서버(npm start)로 실행하면 /api/profiles 가 폴더를 직접 읽으므로, 이 스크립트 없이도 새 사진이 바로 반영됨
 *    (GitHub Pages 같은 정적 호스팅에서는 index.json 이 있어야 함 → 사진을 바꾸면 이 스크립트를 실행)
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public', 'profile'), IDX = path.join(ROOT, 'index.json');
const IMG = /\.(jpe?g|jfif|png|webp|avif|gif)$/i;
let sharp = null; try { sharp = require('sharp'); } catch (e) { }
(async () => {
  let old = {}; try { old = JSON.parse(fs.readFileSync(IDX, 'utf8')); } catch (e) { }
  const out = { _설명: old._설명 || ['프로필 사진 목록 — node tools/build_profiles.js 로 갱신'], boy: [], girl: [] };
  for (const g of ['boy', 'girl']) {
    const dir = path.join(ROOT, g); if (!fs.existsSync(dir)) continue;
    const prev = new Map((old[g] || []).map(e => [e.f, e]));
    const crypto = require('crypto'), seen = new Map();   // 내용이 똑같은 파일은 dup 로 표시
    for (const fn of fs.readdirSync(dir).filter(f => IMG.test(f)).sort()) {
      const f = `${g}/${fn}`, e = Object.assign({}, prev.get(f) || { f }); e.f = f;
      const h = crypto.createHash('md5').update(fs.readFileSync(path.join(dir, fn))).digest('hex');
      if (seen.has(h)) { e.dup = seen.get(h); delete e.t; out[g].push(e); continue; } seen.set(h, f); if (e.dup && !prev.get(f)) delete e.dup;
      const tn = `thumb/${g}/${fn.replace(/\.([^.]+)$/, '_$1')}.jpg`   /* 확장자까지 넣음: image-001.jpg 와 image-001.webp 가 섞여 있어도 안 겹침 */, tp = path.join(ROOT, tn);
      if (sharp && !fs.existsSync(tp)) { fs.mkdirSync(path.dirname(tp), { recursive: true }); try { await sharp(path.join(dir, fn)).resize(320, 400, { fit: 'cover', position: 'north' }).jpeg({ quality: 84 }).toFile(tp); } catch (er) { console.warn('썸네일 실패', fn, er.message); } }
      e.t = fs.existsSync(tp) ? tn : null;
      out[g].push(e);
    }
  }
  fs.writeFileSync(IDX, JSON.stringify(out, null, 1));
  console.log(`index.json 갱신: 남 ${out.boy.length} · 여 ${out.girl.length}장${sharp ? '' : ' (sharp 없음 → 새 사진은 원본 사용)'}`);
})();
