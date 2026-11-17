import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer'; import fs from 'fs';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const meta = {}; for (const l of fs.readFileSync('/home/claude/mocap/meta2.txt', 'utf8').split('\n')) { const i = l.indexOf(' '); if (i > 0 && l[i + 1] === '{') meta[l.slice(0, i)] = JSON.parse(l.slice(i + 1)); }
const out = { _설명: 'v54 Rocketbox 모션캡처(MIT) — 골반 수평 이동 제거·무게중심 흔들림 보존. speed=클립 보행 속도(m/s, 키 1.0 기준), sitRef=앉은 골반 높이(cm), pref=선 자세 골반 높이(cm)', source: 'Microsoft Rocketbox Avatar Library — Animations (MIT License)', pref: {}, clips: {} };
const dir = '/home/claude/mocap/out3/';
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.glb')).sort()) { const n = f.replace('.glb', ''), m = meta[n] || {}; const doc = await io.read(dir + f);
  const an = doc.getRoot().listAnimations()[0]; const ch = an.listChannels().find(c => c.getTargetNode().getName() === 'Bip01 Pelvis' && c.getTargetPath() === 'translation');
  const o = ch.getSampler().getOutput(); const N = o.getCount(), ys = []; for (let i = 0; i < N; i++) ys.push(o.getElement(i, [])[1]);
  const mean = ys.reduce((a, b) => a + b, 0) / N; let sitRef = null;
  if (/sit_chair/.test(n)) sitRef = mean; else if (/sit_down/.test(n)) sitRef = ys[N - 1]; else if (/stand_up/.test(n)) sitRef = ys[0];
  out.clips[n] = { g: n[0], dur: m.dur, speed: m.speed || 0, kind: m.kind, ...(sitRef != null ? { sitRef: +sitRef.toFixed(2) } : {}), py: +mean.toFixed(2) };
}
out.pref = { f: out.clips.f_idle_neutral_01.py, m: out.clips.m_idle_neutral_01.py };
fs.writeFileSync('/home/claude/mocap/out3/manifest.json', JSON.stringify(out, null, 1));
console.log(out.pref, Object.keys(out.clips).length, out.clips.f_sit_chair_idle_neutral_01, out.clips.f_sit_down_chair_01, out.clips.f_walk_neutral_01);
