"""rh_convert.py — 일반 휴머노이드(FBX/GLB/GLTF: Character Creator·Daz(→FBX)·Mixamo·Rocketbox 등) → 게임용 GLB
사용: python3 rh_convert.py <입력.fbx|.glb> <출력.glb> [키_m=자동]
 - 단위를 미터로 맞추고(키 1.4~2.1m 범위가 아니면 자동 스케일), 텍스처는 얼굴/몸 2048·그 외 1024 로 줄여 WebP 로 저장
 - 뼈(스킨)·블렌드셰이프(표정, ARKit 이름이면 그대로 쓰임)·재질을 유지, 애니메이션은 제거
 - 뼈 이름은 humanglb.js 가 Mixamo/CC_Base/Bip01/VRM 등을 자동 인식 → 별도 리깅 불필요
필요: pip install bpy (Blender 4.x/5.x 파이썬 모듈)"""
import bpy, sys, os
src, out = sys.argv[1], sys.argv[2]; H = float(sys.argv[3]) if len(sys.argv) > 3 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext == '.fbx': bpy.ops.import_scene.fbx(filepath=src, use_anim=False, automatic_bone_orientation=False)
else: bpy.ops.import_scene.gltf(filepath=src)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
# 텍스처 경로 복구: FBX 옆 폴더(Textures/·*.fbm/·상위 폴더)에서 같은 이름(확장자 무관) 파일을 찾아 연결
base = os.path.dirname(os.path.abspath(src)); files = {}
for root in {base, os.path.dirname(base)}:
    for dp, dn, fn in os.walk(root):
        if dp.count(os.sep) - root.count(os.sep) > 2: continue
        for f in fn:
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.tga', '.tif', '.tiff', '.webp', '.bmp')): files.setdefault(os.path.splitext(f)[0].lower(), os.path.join(dp, f))
for im in bpy.data.images:
    if im.packed_file or im.source != 'FILE': continue
    fp = bpy.path.abspath(im.filepath)
    if fp and os.path.exists(fp): continue
    k = os.path.splitext(os.path.basename(fp or im.name))[0].lower()
    if k in files: im.filepath = files[k]; im.reload(); print('텍스처 연결:', k, '→', files[k])
bpy.context.view_layer.update()
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
zs = [(o.matrix_world @ v.co).z for o in meshes for i, v in enumerate(o.data.vertices) if i % 7 == 0]
h = max(zs) - min(zs) if zs else 1.7
target = H or (h if 1.4 <= h <= 2.1 else 1.7)
s = target / h if h > 0 else 1
if abs(s - 1) > .01:
    for o in bpy.data.objects:
        if o.parent is None: o.scale = [c * s for c in o.scale]
    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        if o.parent is None:
            bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
for im in bpy.data.images:
    if not im.size[0]: continue
    n = im.name.lower(); lim = 2048 if any(k in n for k in ('head', 'face', 'body', 'skin')) else 1024
    if max(im.size) > lim: r = lim / max(im.size); im.scale(int(im.size[0] * r), int(im.size[1] * r))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_morph=True, export_morph_normal=False, export_animations=False, export_image_format='WEBP', export_image_quality=85)
print('OK', out, 'height %.2fm (원본 %.2f, x%.3f)' % (target, h, s))
