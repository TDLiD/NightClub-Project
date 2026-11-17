import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const BODY = /^Bip01 (Pelvis|Spine\d?|Neck|Head|[LR] (Clavicle|UpperArm|Forearm|Hand|Thigh|Calf|Foot|Toe0|Finger\d\d?))$/;
const [inp, out, info] = process.argv.slice(2);
const doc = await io.read(inp); let k = 0, d = 0;
for (const an of doc.getRoot().listAnimations()) for (const ch of an.listChannels()) {
  const n = ch.getTargetNode().getName(), p = ch.getTargetPath();
  const keep = BODY.test(n) && (p === 'rotation' || (p === 'translation' && n === 'Bip01 Pelvis'));
  if (keep) k++; else { const s = ch.getSampler(); ch.dispose(); s.dispose(); d++; }
}
await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: process.env.LVL || 'medium' }));
await io.write(out, doc);
if (info) { const arm = doc.getRoot().listNodes().find(n => n.listChildren().some(c => c.getName() === 'Bip01 Pelvis'));
  const an = doc.getRoot().listAnimations()[0], ch = an.listChannels().find(c => c.getTargetNode().getName() === 'Bip01 Pelvis' && c.getTargetPath() === 'translation');
  const o = ch.getSampler().getOutput(); const a = o.getArray(), nn = o.getNormalized(); 
  console.log('arm', arm.getName(), arm.getRotation().map(x => x.toFixed(4)), arm.getScale(), arm.getTranslation(), 'pelvis t first', [0,1,2].map(i=>o.getElement(0,[])[i]?.toFixed(2)), 'n', o.getCount(), 'norm', nn); }
console.log('kept', k, 'dropped', d);
