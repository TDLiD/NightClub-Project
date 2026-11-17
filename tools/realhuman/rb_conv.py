import bpy, sys, os, glob, re
src, out = sys.argv[1], sys.argv[2]   # src = avatar dir, out = glb path
name = os.path.basename(src.rstrip('/'))
tex = os.path.join(src, 'Textures'); work = '/home/claude/rbconv/tex/' + name; os.makedirs(work, exist_ok=True)
from PIL import Image
conv = {}
for f in glob.glob(tex + '/*.tga'):
    b = os.path.basename(f)[:-4]; im = Image.open(f)
    if 'opacity' in b:
        im = im.convert('RGBA'); im.thumbnail((1024, 1024)); p = f'{work}/{b}.png'; im.save(p, optimize=True)
    else:
        sz = 2048 if ('head_color' in b) else 1024
        im = im.convert('RGB'); im.thumbnail((sz, sz)); p = f'{work}/{b}.jpg'; im.save(p, quality=88 if 'color' in b else 92)
    conv[b] = p
fbx = glob.glob(os.path.join(src, 'Export', '*_facial.fbx'))[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
def img(key):
    for b, p in conv.items():
        if b.endswith(key): return bpy.data.images.load(p)
    return None
for mat in list(bpy.data.materials):
    n = mat.name.lower(); part = 'opacity' if 'opacity' in n else 'head' if 'head' in n else 'body'
    nt = mat.node_tree; nt.nodes.clear()
    out_n = nt.nodes.new('ShaderNodeOutputMaterial'); bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(bs.outputs[0], out_n.inputs[0])
    bs.inputs['Metallic'].default_value = 0.0
    if part == 'opacity':
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img('opacity_color'); nt.links.new(t.outputs['Color'], bs.inputs['Base Color']); nt.links.new(t.outputs['Alpha'], bs.inputs['Alpha'])
        bs.inputs['Roughness'].default_value = .5
        try: mat.surface_render_method = 'DITHERED'
        except Exception: pass
        mat.blend_method = 'CLIP' if hasattr(mat, 'blend_method') else None
    else:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img(part + '_color'); nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
        nm = img(part + '_normal')
        if nm:
            nm.colorspace_settings.name = 'Non-Color'; tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = nm; mn = nt.nodes.new('ShaderNodeNormalMap'); mn.inputs['Strength'].default_value = .9
            nt.links.new(tn.outputs['Color'], mn.inputs['Color']); nt.links.new(mn.outputs['Normal'], bs.inputs['Normal'])
        bs.inputs['Roughness'].default_value = .52 if part == 'head' else .66
    mat.name = name.lower() + '_' + part
# shape keys: ARKit 52 + visemes only
VIS = {'Sil': 'sil', 'PP': 'PP', 'FF': 'FF', 'TH': 'TH', 'DD': 'DD', 'KK': 'kk', 'CH': 'CH', 'SS': 'SS', 'nn': 'nn', 'RR': 'RR', 'aa': 'aa', 'E': 'E', 'I': 'I', 'O': 'O', 'U': 'U'}
nkeep = 0
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.data.shape_keys: continue
    bpy.context.view_layer.objects.active = o
    for kb in list(o.data.shape_keys.key_blocks):
        if kb.name == 'Basis': continue
        m = re.match(r'AK_\d+_(\w+)', kb.name); v = re.match(r'AA_VI_\d+_(\w+)', kb.name)
        if m: kb.name = m.group(1)[0].lower() + m.group(1)[1:]; nkeep += 1
        elif v: kb.name = 'viseme_' + VIS.get(v.group(1), v.group(1)); nkeep += 1
        else: o.shape_key_remove(kb)
    o.name = name
for o in bpy.data.objects:
    if o.type == 'ARMATURE': o.name = name + '_rig'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_morph=True, export_morph_normal=False, export_animations=False, export_yup=True, export_image_format='WEBP', export_image_quality=88, export_apply=False, export_extras=False, export_vertex_color='NONE', export_all_vertex_colors=False)
print('DONE', name, nkeep, os.path.getsize(out))
