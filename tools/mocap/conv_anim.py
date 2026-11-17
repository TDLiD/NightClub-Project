"""Rocketbox 모션캡처 FBX → 애니메이션 전용 GLB (+ 걷기 속도 측정). 사용: python3 conv_anim.py <in.fbx> <out.glb>"""
import bpy, sys, json, mathutils
src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, use_anim=True)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE' and o.name == 'Bip01'][0]
for o in list(bpy.data.objects):
    if o is not arm: bpy.data.objects.remove(o, do_unlink=True)
act = arm.animation_data.action; f0, f1 = int(act.frame_range[0]), int(act.frame_range[1]); sc = bpy.context.scene; sc.frame_start, sc.frame_end = f0, f1
fps = sc.render.fps
def pelvis(f):
    sc.frame_set(f); return arm.matrix_world @ arm.pose.bones['Bip01 Pelvis'].head
p0, p1 = pelvis(f0), pelvis(f1); dur = (f1 - f0) / fps
travel = mathutils.Vector((p1.x - p0.x, p1.y - p0.y, 0)).length   # Blender Z-up → 수평 이동 거리
hmin = min(pelvis(f).z for f in range(f0, f1 + 1, 3)); hmax = max(pelvis(f).z for f in range(f0, f1 + 1, 3)); hstand = pelvis(f0).z
# v54: Bip01(무게중심) 오브젝트 움직임을 골반 뼈에 구워 넣음 → 상하 흔들림·좌우 흔들림·몸 기울기 보존, 수평 이동(travel)만 제거
import re, math
KIND = 'xy' if src.split('/')[-2].endswith('_xy') else 'xyz' if src.split('/')[-2].endswith('_xyz') else 'static'
pb = arm.pose.bones['Bip01 Pelvis']; pb.rotation_mode = 'QUATERNION'
frames = list(range(f0, f1 + 1)); W = []
for f in frames: sc.frame_set(f); W.append((arm.matrix_world @ pb.matrix).copy())
AX = [None]
def yaw_of(M):   # 골반 뼈의 가장 수평인 축 → 수평 각도
    R = M.to_3x3().normalized()
    if AX[0] is None: AX[0] = min([mathutils.Vector(v) for v in ((1,0,0),(0,1,0),(0,0,1))], key=lambda a: abs((R @ a).normalized().z))
    fwd = R @ AX[0]; return math.atan2(fwd.y, fwd.x)
A = mathutils.Matrix.LocRotScale(mathutils.Vector((0, 0, 0)), mathutils.Euler((0, 0, -math.pi / 2)), mathutils.Vector((.01, .01, .01)))   # 모델 아마추어와 같은 기준
REST = A @ arm.data.bones['Bip01 Pelvis'].matrix_local   # 휴지 자세의 골반(앞방향 기준)
import cmath
yr = yaw_of(REST); ys = [yaw_of(M) for M in W]; avg = cmath.phase(sum(cmath.exp(1j * y) for y in ys) / len(ys)) if KIND == 'static' else ys[0]
dyaw = yr - avg; Rz = mathutils.Matrix.Rotation(dyaw, 4, 'Z')
P0, P1 = W[0].translation.copy(), W[-1].translation.copy(); n = len(W) - 1
mx = sum(M.translation.x for M in W) / len(W); my = sum(M.translation.y for M in W) / len(W)
for o in list(act.fcurves) if hasattr(act, 'fcurves') else []: pass
def channelbags(a):
    try:
        for L in a.layers:
            for st in L.strips:
                for slot in a.slots:
                    cb = st.channelbag(slot)
                    if cb: yield cb
    except AttributeError:
        yield a
BODY = re.compile(r'^Bip01 (Pelvis|Spine\d?|Neck|Head|[LR] (Clavicle|UpperArm|Forearm|Hand|Thigh|Calf|Foot|Toe0|Finger\d\d?))$')
removed = kept = 0
for cb in channelbags(act):
    for fc in list(cb.fcurves):
        m = re.match(r'pose\.bones\["(.+?)"\]\.(\w+)', fc.data_path); keep = False
        if m: bn, prop = m.group(1), m.group(2); keep = bool(BODY.match(bn)) and bn != 'Bip01 Pelvis' and prop in ('rotation_quaternion', 'rotation_euler')
        if keep: kept += 1
        else: cb.fcurves.remove(fc); removed += 1
arm.matrix_world = A; bpy.context.view_layer.update()
travel_xy = (P1 - P0); travel_xy.z = 0
TT = []
for i in range(len(W)):
    t = W[i].translation.copy()
    if KIND == 'xy': t -= travel_xy * (i / n if n else 0)
    TT.append(t)
cx = sum(t.x for t in TT) / len(TT) if KIND != 'xyz' else TT[0].x; cy = sum(t.y for t in TT) / len(TT) if KIND != 'xyz' else TT[0].y
for i, f in enumerate(frames):
    M = W[i].copy(); t = TT[i]; t.x -= cx; t.y -= cy
    M.translation = t; M = Rz @ M
    sc.frame_set(f); pb.matrix = A.inverted() @ M; bpy.context.view_layer.update()
    pb.keyframe_insert('location', frame=f); pb.keyframe_insert('rotation_quaternion', frame=f)
print('CURVES kept', kept, 'removed', removed, 'dyaw', round(math.degrees(dyaw), 1))
for o in bpy.data.objects: o.select_set(o is arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=True, export_skins=False, export_morph=False, export_yup=True, export_apply=False, export_extras=False, export_force_sampling=True, export_frame_step=(2 if dur > 8 else 1), export_anim_single_armature=True)
print('META', json.dumps({'dur': round(dur, 3), 'speed': round(travel / dur, 3) if dur else 0, 'pelvisMin': round(hmin, 3), 'pelvisMax': round(hmax, 3), 'pelvis0': round(hstand, 3), 'frames': f1 - f0, 'kind': KIND}))
