"""valid_conv.py — VALID(Google·UCF, MIT) 아바타 FBX → 게임용 GLB
사용: python valid_conv.py <입력.fbx> <출력.glb>
 - Adobe Fuse 표정 → ARKit/비즘 이름으로 변환(눈 깜빡임·입 벌림·미소·말하기), 나머지 표정은 삭제
 - 조명·빈 오브젝트 삭제, 재질 이름을 <이름>_body 로, 컬러 2048 · 노멀 1024 WebP
 - 뼈 이름(Hips·LeftArm…: Mixamo 형식)은 humanglb.js 가 자동 인식"""
import bpy, sys, os, re
src, out = sys.argv[1], sys.argv[2]
name = os.path.splitext(os.path.basename(src))[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, use_anim=False)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA') or (o.type == 'EMPTY' and o.name.startswith(('Lights', 'spotLight'))): bpy.data.objects.remove(o, do_unlink=True)
MAP = {'LeyeClose': 'eyeBlinkLeft', 'ReyeClose': 'eyeBlinkRight', 'MouthOpen': 'jawOpen',
       'LsmileClose': 'mouthSmileLeft', 'RsmileClose': 'mouthSmileRight', 'LmouthSad': 'mouthFrownLeft', 'RmouthSad': 'mouthFrownRight',
       'LbrowUp': 'browOuterUpLeft', 'RbrowUp': 'browOuterUpRight', 'LbrowDown': 'browDownLeft', 'RbrowDown': 'browDownRight',
       'Lsquint': 'eyeSquintLeft', 'Rsquint': 'eyeSquintRight', 'Kiss': 'mouthPucker',
       'AE_AA': 'viseme_aa', 'AO_a': 'viseme_O', 'Ax_E': 'viseme_E', 'UW_U': 'viseme_U', 'UH_OO': 'viseme_O2', 'TD_I': 'viseme_I',
       'FV': 'viseme_FF', 'KG': 'viseme_kk', 'S': 'viseme_SS', 'SH_CH': 'viseme_CH', 'MPB_Down': 'viseme_PP'}
nk = 0
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.data.shape_keys: continue
    for kb in list(o.data.shape_keys.key_blocks):
        if kb.name == 'Basis' or kb == o.data.shape_keys.reference_key: continue
        base = re.sub(r'^.*\.', '', kb.name); base = re.sub(r'^t_', '', base); base = re.sub(r'_h$', '', base)
        if base in MAP: kb.name = MAP[base]; nk += 1
        else: o.shape_key_remove(kb)
# 투명 각막(_Eye_trans)은 텍스처가 없어 흰 막처럼 보임 → 삭제
for o in list(bpy.data.objects):
    if o.type == 'MESH' and any(sl.material and 'trans' in sl.material.name.lower() for sl in o.material_slots): bpy.data.objects.remove(o, do_unlink=True)
for m in bpy.data.materials:
    hair = 'hair' in m.name.lower() or 'wig' in m.name.lower()
    m.name = name.lower() + ('_hair' if hair else '_body')
    bs = next((n for n in (m.node_tree.nodes if m.node_tree else []) if n.type == 'BSDF_PRINCIPLED'), None)
    if bs:   # 스튜디오·클럽 조명에서 플라스틱·은발처럼 번들거리지 않게
        bs.inputs['Roughness'].default_value = .72 if hair else .62
        for k in ('Specular IOR Level', 'Specular'):
            if k in bs.inputs: bs.inputs[k].default_value = .04 if hair else .3; break
        if hair:   # 가발 노멀맵이 조명에서 은발처럼 번들거림 → 노멀맵 끊고 색을 약간 어둡게
            for l in list(m.node_tree.links):
                if l.to_socket.name == 'Normal' and l.to_node == bs: m.node_tree.links.remove(l)
            tex = next((l.from_node for l in m.node_tree.links if l.to_node == bs and l.to_socket.name == 'Base Color'), None)
            if tex:
                mix = m.node_tree.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
                mix.inputs[7].default_value = (.6, .6, .6, 1)
                m.node_tree.links.new(tex.outputs['Color'], mix.inputs[6]); m.node_tree.links.new(mix.outputs[2], bs.inputs['Base Color'])
    try: m.blend_method = 'OPAQUE'
    except Exception: pass
    try: m.surface_render_method = 'DITHERED'
    except Exception: pass
for im in bpy.data.images:
    if not im.size[0]: continue
    lim = 1024 if ('nm' in im.name.lower() or 'normal' in im.name.lower()) else 2048
    if max(im.size) > lim: r = lim / max(im.size); im.scale(int(im.size[0] * r), int(im.size[1] * r))
for o in bpy.data.objects:
    if o.type == 'ARMATURE': o.name = name + '_rig'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_morph=True, export_morph_normal=False, export_animations=False,
                          export_yup=True, export_image_format='WEBP', export_image_quality=86, export_apply=False, export_extras=False)
print('DONE', name, 'morphs', nk, os.path.getsize(out))
