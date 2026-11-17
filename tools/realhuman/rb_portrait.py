import bpy, sys, mathutils, math, os
src, out = sys.argv[1], sys.argv[2]
headtex = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != '-' else None
bodytex = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else None
FULL = len(sys.argv) > 5 and sys.argv[5] == 'full'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
hb = [b for b in arm.pose.bones if b.name.lower().endswith('head')][0]
hw = arm.matrix_world @ hb.head
if headtex:
    hc = os.path.join(headtex, 'head_color.jpg') if os.path.isdir(headtex) else headtex
    op = os.path.join(headtex, 'opacity_color.png') if os.path.isdir(headtex) else None
    for m in bpy.data.materials:
        for n in m.node_tree.nodes:
            if n.type != 'TEX_IMAGE' or not n.image or n.image.colorspace_settings.name == 'Non-Color': continue
            if m.name.endswith('_head'): n.image = bpy.data.images.load(hc)
            if m.name.endswith('_opacity') and op and os.path.exists(op): n.image = bpy.data.images.load(op)
if bodytex:
    for m in bpy.data.materials:
        if m.name.endswith('_body'):
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name != 'Non-Color': n.image = bpy.data.images.load(bodytex)
# model faces? find forward: glTF -> Blender +Y up converted; character faces -Y typically
mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]
if FULL:
    bpy.context.view_layer.update()
    for sd in ('L', 'R'):
        b = arm.pose.bones.get('Bip01 %s UpperArm' % sd); h = arm.pose.bones.get('Bip01 %s Hand' % sd)
        if not b or not h: continue
        M = arm.matrix_world @ b.matrix; hd = M.translation.copy(); hp = arm.matrix_world @ h.head
        v = (hp - hd).normalized(); out_ = mathutils.Vector((v.x, v.y, 0)).normalized()
        tgt = (out_ * .2 + mathutils.Vector((0, 0, -1))).normalized()
        q = v.rotation_difference(tgt)
        newM = mathutils.Matrix.Translation(hd) @ q.to_matrix().to_4x4() @ mathutils.Matrix.Translation(-hd) @ M
        b.matrix = arm.matrix_world.inverted() @ newM
        bpy.context.view_layer.update()
# estimate face direction using eye bones
eyes = [b for b in arm.pose.bones if 'eye' in b.name.lower() and 'blink' not in b.name.lower()]
if len(eyes) >= 2:
    ec = (arm.matrix_world @ eyes[0].head + arm.matrix_world @ eyes[1].head) / 2
    fwd = (ec - hw); fwd.z = 0; fwd.normalize()
else:
    fwd = mathutils.Vector((0, -1, 0))
target = hw + mathutils.Vector((0, 0, .075)) if not FULL else mathutils.Vector((hw.x, hw.y, (hw.z + .12) * .5))
cam_data = bpy.data.cameras.new('cam'); cam_data.lens = 85
cam = bpy.data.objects.new('cam', cam_data); bpy.context.scene.collection.objects.link(cam)
cam.location = target + (fwd * 1.05 + mathutils.Vector((0, 0, .03)) if not FULL else (fwd * 5.6 + fwd.cross(mathutils.Vector((0,0,1))) * 1.0 + mathutils.Vector((0, 0, .15))))
d = target - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam
def light(name, loc, energy, color=(1, 1, 1), size=1.0):
    L = bpy.data.lights.new(name, 'AREA'); L.energy = energy; L.color = color; L.size = size
    o = bpy.data.objects.new(name, L); bpy.context.scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (target - o.location).to_track_quat('-Z', 'Y').to_euler()
side = fwd.cross(mathutils.Vector((0, 0, 1)))
light('key', target + fwd * 1.0 + side * .8 + mathutils.Vector((0, 0, .5)), 90, (1, .95, .9), 1.2)
light('fill', target + fwd * 1.0 - side * 1.0 + mathutils.Vector((0, 0, .1)), 35, (.9, .85, 1), 1.5)
light('rim', target - fwd * .8 + side * .5 + mathutils.Vector((0, 0, .6)), 60, (1, .6, .9), .8)
w = bpy.data.worlds.new('w'); bpy.context.scene.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (.06, .03, .09, 1); bg.inputs[1].default_value = 1.0
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = True
sc.render.resolution_x = 384 if not FULL else 360; sc.render.resolution_y = 480 if not FULL else 720; sc.render.film_transparent = False
sc.view_settings.view_transform = 'AgX' if 'AgX' in [x.name for x in []] else sc.view_settings.view_transform
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 88; sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('OK', out)
