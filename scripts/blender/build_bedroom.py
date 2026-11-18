"""Authored midnight hotel bedroom kit. Run through bridge_client.py or Blender -b.

Same conventions as build_assets.py: meters; Blender Z up / -Y front becomes
Three.js +Y up / +Z front. Wall is Blender Y=0. Origins are floor anchors.
The 316 exit door reuses the existing door.glb kit asset. No external assets.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)

def mat(name, color, metal=0, rough=.5, emission=None, strength=.35):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*emission,1)
        p.inputs['Emission Strength'].default_value=strength
    return m

M={
 'gold':mat('Aged brass',(.29,.17,.055),.78,.3),
 'blackmetal':mat('Oxidized iron',(.035,.043,.036),.72,.42),
 'wood':mat('Dark mahogany',(.105,.032,.018),.05,.43),
 'woodtrim':mat('Mahogany edges',(.19,.071,.03),.1,.4),
 'fabric':mat('Old cotton',(.53,.48,.35),0,.94),
 'stripe':mat('Cotton border',(.16,.23,.19),0,.94),
 'lampshade':mat('Warm lampshade',(.62,.47,.3),0,.6,emission=(1,.72,.38),strength=1.3),
 'screen':mat('Screen glass',(.006,.008,.007),.55,.12),
}

def finish(obj,name,material):
    obj.name=name
    obj.data.materials.append(M[material])
    return obj

def cube(name,loc,scale,material,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object
    o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return finish(o,name,material)

def sphere(name,loc,scale,material,segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=12, radius=1, location=loc)
    o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,material)

def cylinder(name,a,b,radius,material,vertices=16):
    d=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=d.length,location=(Vector(a)+Vector(b))*.5)
    o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,material)

def tube(name,points,radius,material,cyclic=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=radius;c.bevel_resolution=2
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    s.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(M[material]);return o

def new_asset():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

MANIFEST=OUT/'manifest.json'
manifest={}
if MANIFEST.exists():
    try:manifest=json.loads(MANIFEST.read_text(encoding='utf-8')).get('assets',{})
    except Exception:manifest={}

def export(name):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.convert(target='MESH')
    for o in list(bpy.context.scene.objects):
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    groups={}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH':groups.setdefault(o.data.materials[0].name if o.data.materials else 'none',[]).append(o)
    for material,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        objects[0].name=name+'__'+material.replace(' ','_')
    bpy.ops.object.select_all(action='SELECT')
    for o in bpy.context.selected_objects:o.data.calc_loop_triangles()
    bounds=[o.matrix_world@Vector(p) for o in bpy.context.selected_objects for p in o.bound_box]
    coords=[(p.x,p.z,-p.y) for p in bounds]
    mn=[min(p[i] for p in coords) for i in range(3)];mx=[max(p[i] for p in coords) for i in range(3)]
    tris=sum(len(o.data.loop_triangles) for o in bpy.context.selected_objects if o.type=='MESH')
    path=OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(name+'.blend')),compress=True)
    manifest[name]={'file':name+'.glb','bounds':{'min':mn,'max':mx},'triangles':tris,'meshes':len(groups),'bytes':path.stat().st_size,'front':'+Z','origin':'floor anchor'}
    print('ASSET_EXPORTED',name,json.dumps(manifest[name]))

# Double bed. Headboard against the wall (Y=0), mattress toward the front.
new_asset()
cube('Headboard',(0,-.035,.62),(1.7,.07,1.12),'wood',.02)
cube('Headboard trim',(0,-.085,.62),(1.6,.03,1.0),'woodtrim',.012)
for x in (-.81,.81):cube('Bed side rail',(x,-1.02,.28),(.06,2.0,.16),'wood',.012)
cube('Bed foot rail',(0,-2.02,.28),(1.56,.06,.16),'wood',.012)
for x in (-.75,.75):
    for y in (-.15,-1.9):
        cylinder('Bed leg',(x,y,0),(x,y,.26),.045,'wood',12)
cube('Mattress',(0,-1.02,.42),(1.58,1.96,.24),'fabric',.045)
cube('Blanket',(0,-1.45,.565),(1.64,1.3,.05),'stripe',.02)
cube('Blanket fold',(0,-.88,.55),(1.6,.16,.03),'stripe',.015)
for x in (-.38,.38):
    pillow=cube('Pillow',(x,-.34,.6),(.64,.44,.15),'fabric',.06);pillow.rotation_euler[2]=.04
export('bed')

# Night stand with a lit brass lamp on top.
new_asset()
cube('Night stand body',(0,-.2,.29),(.5,.42,.5),'wood',.014)
cube('Night stand top',(0,-.21,.55),(.54,.46,.035),'woodtrim',.01)
cube('Drawer front',(0,-.42,.38),(.4,.02,.16),'woodtrim',.008)
cube('Drawer recess',(0,-.43,.38),(.34,.008,.1),'wood',.004)
cylinder('Drawer knob',(0,-.45,.38),(0,-.485,.38),.014,'gold',16)
for x in (-.2,.2):
    for y in (-.05,-.36):
        cylinder('Stand leg',(x,y,0),(x,y,.06),.02,'woodtrim',10)
cylinder('Lamp base',(0,-.18,.565),(0,-.18,.595),.075,'gold',24)
cylinder('Lamp stem',(0,-.18,.595),(0,-.18,.78),.012,'gold',12)
cylinder('Lamp shade',(0,-.18,.78),(0,-.18,.95),.095,'lampshade',20)
sphere('Lamp glow core',(0,-.18,.8),(.03,.03,.03),'lampshade',12)
export('nightstand')

# Mahogany wardrobe with two inset doors, cornice and plinth.
new_asset()
cube('Wardrobe body',(0,-.275,1.075),(1.1,.55,2.0),'wood',.02)
cube('Wardrobe cornice',(0,-.29,2.12),(1.18,.6,.09),'woodtrim',.015)
cube('Wardrobe plinth',(0,-.29,.05),(1.04,.52,.1),'woodtrim',.012)
for x in (-.27,.27):
    cube('Wardrobe door',(x,-.56,1.075),(.5,.03,1.86),'woodtrim',.012)
    cube('Wardrobe panel',(x,-.575,1.075),(.36,.012,1.5),'wood',.01)
    hx=x+(.18 if x<0 else -.18)
    cylinder('Wardrobe handle',(hx,-.59,.85),(hx,-.59,1.15),.013,'gold',12)
export('wardrobe')

# Television on a low mahogany cabinet; screen is dead glass.
new_asset()
cube('Tv cabinet',(0,-.21,.3),(1.3,.42,.6),'wood',.015)
cube('Cabinet top',(0,-.22,.62),(1.34,.46,.04),'woodtrim',.01)
for x in (-.3,0,.3):cube('Cabinet door',(x,-.43,.3),(.36,.025,.5),'woodtrim',.01)
for x in (-.3,.3):cylinder('Cabinet knob',(x,-.46,.3),(x,-.49,.3),.011,'gold',12)
cube('Tv stand foot',(0,-.2,.665),(.5,.24,.035),'blackmetal',.01)
cube('Tv stand neck',(0,-.2,.72),(.3,.2,.08),'blackmetal',.01)
cube('Tv bezel',(0,-.2,1.02),(.98,.05,.56),'blackmetal',.01)
cube('Tv screen',(0,-.23,1.02),(.9,.012,.48),'screen',.004)
export('tv')

# Folding luggage rack with crossing iron legs and cotton straps.
new_asset()
for x in (-.42,.42):
    tube('Rack leg',[(x,-.26,.02),(x,-.02,.42)],.015,'blackmetal')
    tube('Rack leg',[(x,.26,.02),(x,-.02,.42)],.015,'blackmetal')
    cylinder('Rack side bar',(x,-.28,.42),(x,.28,.42),.012,'blackmetal',10)
cylinder('Rack rail front',(-.42,-.26,.44),(.42,-.26,.44),.012,'blackmetal',10)
cylinder('Rack rail back',(-.42,.26,.44),(.42,.26,.44),.012,'blackmetal',10)
for i in range(5):
    y=-.24+i*.12
    cube('Rack strap',(0,y,.445),(.86,.07,.02),'fabric',.008)
for x in (-.42,.42):
    for y in (-.26,.26):
        sphere('Rack foot',(x,y,.015),(.022,.022,.012),'blackmetal',10)
export('luggage-rack')

MANIFEST.write_text(json.dumps({'units':'meters','up':'+Y','front':'+Z','assets':manifest},indent=2),encoding='utf-8')
print('BEDROOM_KIT_COMPLETE',json.dumps(manifest))
