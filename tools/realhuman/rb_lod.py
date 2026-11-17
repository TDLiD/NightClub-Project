import bpy, sys, os
src, out = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for o in list(bpy.data.objects):
    if o.type == 'MESH':
        bpy.context.view_layer.objects.active = o
        if o.data.shape_keys: o.shape_key_clear()
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = 0.3
        # keep armature modifier after decimate
        bpy.ops.object.modifier_move_to_index(modifier='dec', index=0)
        bpy.ops.object.modifier_apply(modifier='dec')
for im in bpy.data.images:
    if im.size[0] > 512: im.scale(512, 512)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_morph=False, export_animations=False, export_vertex_color='NONE', export_image_format='WEBP', export_image_quality=80)
print('LOD', os.path.getsize(out))
