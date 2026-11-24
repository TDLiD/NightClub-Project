#!/bin/bash
# 새 실사 인물 1명 추가: ./add_model.sh <입력 FBX/GLB> <id 예: f_21> <f|m> "<스타일 이름>" [east|west] [dressy|casual|suit]
#  v70: 7번째 인자부터 manifest 옵션 그대로 전달 — 예) ./add_model.sh jo.fbx f_32 f "조여사" east casual --outfits=concert,casual --outfit=casual --name=조여사 --no19
#       의상은 메시 이름을 OUT_concert_tank · OUT_casual_hoodie 처럼 지어 두면 게임에서 한 벌씩 갈아입힘
# 결과: public/models/humans/<id>.glb · _lod.glb · _lodm.glb · full/<id>.jpg · public/profile/real/<id>.jpg(+mini) + manifest.json 항목
set -e
SRC=$1; ID=$2; G=$3; LABEL=$4; LOOK=${5:-east}; WEAR=${6:-casual}; shift 6 2>/dev/null || shift $#; EXTRA=("$@")
DEF=$(printf "%s\n" "${EXTRA[@]}" | sed -n "s/^--outfit=//p" | head -1); [ -z "$DEF" ] && DEF=$(printf "%s\n" "${EXTRA[@]}" | sed -n "s/^--outfits=\([^,]*\).*/\1/p" | head -1); export OUTFIT=$DEF
HERE=$(cd $(dirname $0) && pwd); ROOT=$(cd $HERE/../.. && pwd); H=$ROOT/public/models/humans; T=$(mktemp -d)
python3 $HERE/rh_convert.py "$SRC" $T/$ID.glb
python3 $HERE/rb_lod.py $T/$ID.glb $T/${ID}_lod.glb
gltf-transform meshopt $T/$ID.glb $H/$ID.glb
gltf-transform meshopt $T/${ID}_lod.glb $H/${ID}_lod.glb
gltf-transform resize $H/${ID}_lod.glb $T/m.glb --width 256 --height 256 && gltf-transform meshopt $T/m.glb $H/${ID}_lodm.glb
mkdir -p $H/full $ROOT/public/profile/real/mini
python3 $HERE/rb_portrait.py $T/$ID.glb $ROOT/public/profile/real/$ID.jpg
python3 $HERE/rb_portrait.py $T/$ID.glb $H/full/$ID.jpg - - full
python3 -c "from PIL import Image; Image.open('$ROOT/public/profile/real/$ID.jpg').resize((128,160)).save('$ROOT/public/profile/real/mini/$ID.jpg', quality=84)"
node $HERE/manifest_add.js "$ID" "$G" "$LABEL" "$LOOK" "$WEAR" "${EXTRA[@]}"
rm -rf $T; echo "완료: $ID — 확인 후 manifest.json 의 assign 에서 NPC 에 배정하세요"
