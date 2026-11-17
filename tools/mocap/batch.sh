cd /home/claude/mocap
G=/home/claude/.npm-global/lib/node_modules/@gltf-transform/cli
for f in /home/claude/microsoft/microsoft-rocketbox/Assets/Animations/all_animations_max_motextr_*/*.fbx; do
  n=$(basename $f .max.fbx); n=${n//-/_}; case $n in *sexy*) continue;; esac; [ -f out3/$n.glb ] && continue
  m=$(python3 conv_anim2.py "$f" raw2/$n.glb 2>&1 | grep META | sed 's/META //')
  (cd $G && LVL=high node strip.mjs /home/claude/mocap/raw2/$n.glb /home/claude/mocap/out3/$n.glb >/dev/null 2>&1)
  echo "$n $m" >> meta2.txt
done; echo DONE3 >> meta2.txt
