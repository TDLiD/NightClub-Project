'use strict';
/**
 * 아바타 외형(look) 검증 — 클라이언트가 보낸 값을 화이트리스트/범위로만 통과시킵니다.
 * (다른 접속자 화면에 그대로 그려지므로 임의 문자열·거대한 숫자가 들어오지 않게 막는 용도)
 */
const HAIR = ['long', 'bob', 'ponytail', 'bun', 'wavy', 'short', 'twoblock', 'slick', 'curly', 'buzz', 'side'];
const TOPS = ['tee', 'shirt', 'jacket', 'dress', 'vest'];
const BOTTOMS = ['pants', 'skirt'];
const MOUTH_BEARD = [null, 'stubble', 'goatee'];
const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);
const num = (v, a, b, d) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : d);
const pick = (v, list, d) => (list.includes(v) ? v : d);

function sanitizeLook(l, colorNum) {
  l = l && typeof l === 'object' ? l : {};
  const f = l.face && typeof l.face === 'object' ? l.face : {};
  const g = l.gender === 'm' ? 'm' : 'f';
  const topColor = hex(l.topColor, '#' + (Number.isInteger(colorNum) ? colorNum : 0xff3d9a).toString(16).padStart(6, '0'));
  return {
    gender: g,
    height: num(l.height, 1.5, 1.95, g === 'f' ? 1.65 : 1.77),
    build: num(l.build, 0.85, 1.2, 1),
    skin: hex(l.skin, '#f1c9a5'),
    hairStyle: pick(l.hairStyle, HAIR, g === 'f' ? 'long' : 'short'),
    hairColor: hex(l.hairColor, '#2a1a12'),
    top: pick(l.top, TOPS, 'shirt'), topColor,
    bottom: pick(l.bottom, BOTTOMS, 'pants'), bottomColor: hex(l.bottomColor, '#22223a'),
    photo: typeof l.photo === 'string' && /^(boy|girl)\/[\w.-]{1,60}$/.test(l.photo) ? l.photo : null,   // v33 프로필 사진(profile/ 아래 경로만 허용)
    face: {
      eyeColor: hex(f.eyeColor, '#3a2416'), eyeSize: num(f.eyeSize, .7, 1.3, 1), eyeTilt: num(f.eyeTilt, -.2, .2, 0), eyeGap: num(f.eyeGap, -.05, .05, 0),
      lid: f.lid ? 1 : 0, browThick: num(f.browThick, .3, 1.6, 1), browTilt: num(f.browTilt, -.2, .2, 0), browArch: num(f.browArch, 0, 1, .5),
      lipColor: hex(f.lipColor, '#c4475a'), lipW: num(f.lipW, .7, 1.3, 1), lipFull: num(f.lipFull, .6, 1.4, 1), nose: num(f.nose, .7, 1.3, 1),
      faceW: num(f.faceW, .85, 1.08, 1), jaw: num(f.jaw, .85, 1.15, 1), blush: num(f.blush, 0, 1, .2), liner: num(f.liner, 0, 1, 0),
      shadow: f.shadow ? hex(f.shadow, null) : null, freckles: !!f.freckles,
      mole: Array.isArray(f.mole) ? [num(f.mole[0], -.5, .5, .2), num(f.mole[1], -.2, .8, .3)] : null,
      beard: pick(f.beard ?? null, MOUTH_BEARD, null), glasses: !!f.glasses, earring: !!f.earring,
    },
  };
}
module.exports = { sanitizeLook };
