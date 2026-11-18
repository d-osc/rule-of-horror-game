"""Authored midnight hotel prop kit. Run through bridge_client.py or Blender -b.

All assets: meters; Blender Z up / -Y front becomes Three.js +Y up / +Z front.
Wall is Blender Y=0. Origins are floor anchors (0,0,0). No external assets.
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

def mat(name, color, metal=0, rough=.5, emission=None):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*emission,1)
        p.inputs['Emission Strength'].default_value=.35
    return m

M={
 'gold':mat('Aged brass',(.29,.17,.055),.78,.3),
 'blackmetal':mat('Oxidized iron',(.035,.043,.036),.72,.42),
 'chrome':mat('Tarnished nickel',(.32,.37,.33),.9,.23),
 'porcelain':mat('Ivory porcelain',(.72,.68,.52),.04,.23),
 'drain':mat('Drain darkness',(.008,.013,.011),.15,.5),
 'wood':mat('Dark mahogany',(.105,.032,.018),.05,.43),
 'woodtrim':mat('Mahogany edges',(.19,.071,.03),.1,.4),
 'mirror':mat('Silvered glass',(.23,.31,.26),.94,.12),
 'fabric':mat('Old cotton',(.53,.48,.35),0,.94),
 'stripe':mat('Cotton border',(.16,.23,.19),0,.94),
 'ghost':mat('Wet hospital cotton',(.42,.46,.39),0,.88),
 'skin':mat('Ashen skin',(.35,.41,.37),0,.7),
 'hair':mat('Waterlogged black hair',(.009,.012,.009),.04,.48),
 'eye':mat('Empty sockets',(.001,.002,.001),0,.9),
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

def oval(name,rx,rz,y,zc,radius,material):
    return tube(name,[(rx*math.cos(i*math.tau/96),y,zc+rz*math.sin(i*math.tau/96)) for i in range(96)],radius,material,True)

def mesh(name,verts,faces,material):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
    o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(M[material])
    for p in m.polygons:p.use_smooth=True
    return o

def text_obj(name,text,loc,size,material):
    c=bpy.data.curves.new(name,'FONT');c.body=text;c.size=size;c.align_x='CENTER';c.extrude=.0009
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);c.materials.append(M[material]);return o

def new_asset():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

manifest={}
def export(name):
    # Apply authored bevels/curves then batch material geometry to keep draws low.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.convert(target='MESH')
    for o in list(bpy.context.scene.objects):
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    # Merge by material; five or fewer primitives per ordinary prop.
    groups={}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH':groups.setdefault(o.data.materials[0].name if o.data.materials else 'none',[]).append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for material,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        objects[0].name=name+'__'+material.replace(' ','_')
    bpy.ops.object.select_all(action='SELECT')
    bounds=[o.matrix_world@Vector(p) for o in bpy.context.selected_objects for p in o.bound_box]
    # Convert Blender bounds to Three coordinates (x,z,-y).
    coords=[(p.x,p.z,-p.y) for p in bounds]
    mn=[min(p[i] for p in coords) for i in range(3)];mx=[max(p[i] for p in coords) for i in range(3)]
    tris=sum(len(o.data.loop_triangles) for o in bpy.context.selected_objects if o.type=='MESH')
    for o in bpy.context.selected_objects:o.data.calc_loop_triangles()
    tris=sum(len(o.data.loop_triangles) for o in bpy.context.selected_objects)
    path=OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(name+'.blend')),compress=True)
    manifest[name]={'file':name+'.glb','bounds':{'min':mn,'max':mx},'triangles':tris,'meshes':len(groups),'bytes':path.stat().st_size,'front':'+Z','origin':'floor anchor'}
    print('ASSET_EXPORTED',name,json.dumps(manifest[name]))

# Victorian mirror. Oval silver pane, concentric molding, brass leaves, crown.
new_asset()
sphere('Silvered mirror',(0,-.055,1.7),(.365,.014,.48),'mirror',48)
oval('Inner beading',.385,.50,-.075,1.7,.013,'gold')
oval('Heavy outer frame',.425,.55,-.045,1.7,.032,'wood')
oval('Gilded molding',.451,.575,-.067,1.7,.014,'gold')
for side in (-1,1):
    for j in range(4):
        z=1.47+j*.15;x=side*(.43+.024*math.sin(j))
        leaf=sphere('Acantus leaf',(x,-.085,z),(.055,.023,.105),'gold',16);leaf.rotation_euler[1]=side*.5
    tube('Crown scroll',[(side*.24*(1-t),-.07,2.23+.14*math.sin(t*math.pi)) for t in [i/24 for i in range(25)]],.018,'gold')
sphere('Crown medallion',(0,-.073,2.31),(.072,.025,.1),'gold')
cube('Backboard',(0,.008,1.7),(.78,.035,1.05),'wood',.03)
export('mirror')

# Basin cross section: a thick rounded rim and smooth hollow bowl.
new_asset()
profile=[(.045,.65),(.22,.66),(.35,.72),(.42,.82),(.43,.88),(.405,.9),(.38,.88),(.34,.8),(.23,.735),(.06,.72)]
verts=[]
for r,z in profile:
    for i in range(64):
        a=i*math.tau/64;verts.append((r*math.cos(a),-.29+r*.67*math.sin(a),z))
faces=[]
for j in range(len(profile)-1):
    for i in range(64):a=j*64+i;b=j*64+(i+1)%64;faces.append((a,b,b+64,a+64))
mesh('Porcelain basin',verts,faces,'porcelain')
cube('Ceramic wall shelf',(0,-.07,.855),(.77,.19,.08),'porcelain',.025)
cylinder('Drain plate',(0,-.29,.721),(0,-.29,.728),.048,'chrome',32)
for i in range(8):
    a=i*math.tau/8;cylinder('Drain aperture',(.027*math.cos(a),-.29+.027*math.sin(a),.728),(.027*math.cos(a),-.29+.027*math.sin(a),.73),.004,'drain',8)
tube('Exposed P trap',[(0,-.29,.65),(0,-.29,.44),(.02,-.29,.38),(.11,-.29,.38),(.15,-.29,.43),(.15,-.29,.52),(.15,-.12,.53),(.15,0,.53)],.024,'chrome')
for x in (-.24,.24):
    cylinder('Bracket',(x,-.04,.76),(x,-.25,.55),.014,'blackmetal')
    cylinder('Tap base',(x,-.07,.9),(x,-.07,.96),.028,'chrome')
    cylinder('Cross handle',(x-.055,-.07,.967),(x+.055,-.07,.967),.009,'gold')
    cylinder('Cross handle',(x,-.12,.967),(x,-.02,.967),.009,'gold')
tube('Swan neck faucet',[(0,-.06,.9),(0,-.06,1.04),(0,-.08,1.075),(0,-.18,1.075),(0,-.215,1.04)],.018,'chrome')
export('sink')

# Aged brass rain shower, riser, mixer, diverter, hose and perforated head.
new_asset()
tube('Shower riser',[(0,-.075,.93),(0,-.075,2.13),(0,-.1,2.21),(0,-.18,2.25),(0,-.52,2.25)],.018,'gold')
for z in (1.12,1.95):
    cylinder('Wall mount',(0,0,z),(0,-.08,z),.035,'gold',24)
    cylinder('Mount screw',(-.035,-.02,z),(.035,-.02,z),.01,'blackmetal')
sphere('Shower head domed back',(0,-.52,2.23),(.19,.19,.055),'gold',32)
cylinder('Shower face',(0,-.52,2.2),(0,-.52,2.19),.18,'chrome',48)
for ring in range(1,5):
    for i in range(ring*9):
        a=i*math.tau/(ring*9);r=ring*.035
        sphere('Rubber nozzle',(r*math.cos(a),-.52+r*math.sin(a),2.185),(.004,.004,.006),'drain',8)
cylinder('Mixer',(0,-.04,.95),(0,-.13,.95),.095,'gold',32)
cylinder('Mixer handle',(-.14,-.15,.95),(.14,-.15,.95),.013,'gold')
for x in (-.14,.14):sphere('Mixer knob',(x,-.15,.95),(.023,.023,.023),'porcelain')
tube('Flexible hose',[(.07,-.13,.9),(.18,-.18,.62),(.24,-.18,.45),(.31,-.18,.52),(.30,-.18,1.38)],.012,'chrome')
cylinder('Handheld shower',(.3,-.18,1.3),(.3,-.18,1.52),.027,'gold')
sphere('Handheld head',(.3,-.18,1.59),(.064,.025,.085),'chrome')
export('shower')

# Mahogany hotel room door, frame, raised moldings, antique brass hardware.
new_asset()
cube('Door slab',(0,-.045,1.12),(1.03,.08,2.24),'wood',.012)
for x in (-.58,.58):cube('Door jamb',(x,0,1.19),(.11,.17,2.38),'woodtrim',.015)
cube('Lintel',(0,0,2.41),(1.27,.18,.13),'woodtrim',.018)
for z,h in ((.48,.65),(1.50,.96)):
    for x in (-.25,.25):
        cube('Inset panel',(x,-.094,z),(.4,.025,h),'woodtrim',.015)
        cube('Dark recessed panel',(x,-.11,z),(.345,.009,h-.06),'wood',.012)
        for off in (-.19,.19):cube('Panel molding',(x+off,-.12,z),(.018,.015,h-.035),'gold',.004)
        for zz in (z-h/2+.02,z+h/2-.02):cube('Panel molding',(x,-.12,zz),(.39,.015,.018),'woodtrim',.005)
cube('Lock plate',(.38,-.1,1.0),(.1,.028,.28),'gold',.022)
cylinder('Handle spindle',(.38,-.1,1.04),(.38,-.18,1.04),.025,'gold')
cylinder('Door lever',(.38,-.18,1.04),(.23,-.18,1.04),.018,'gold')
sphere('Key hole',(.38,-.118,.93),(.012,.005,.018),'drain')
cube('Room plaque',(0,-.12,1.9),(.25,.025,.12),'gold',.025)
text_obj('Room number','316',(0,-.137,1.87),.07,'drain')
cylinder('Peephole',(0,-.09,1.59),(0,-.12,1.59),.018,'gold')
sphere('Peephole glass',(0,-.125,1.59),(.009,.005,.009),'drain')
for z in (.25,1.15,2.0):
    cylinder('Hinge',(-.505,-.035,z-.065),(-.505,-.035,z+.065),.025,'gold')
cube('Brass threshold',(0,-.04,.016),(1.12,.22,.032),'gold',.007)
export('door')

# Folded cotton towel with authored hanging folds and woven stripes.
new_asset()
for x in (-.35,.35):
    cylinder('Towel mount',(x,0,1.28),(x,-.15,1.28),.035,'gold',24)
cylinder('Towel bar',(-.39,-.15,1.28),(.39,-.15,1.28),.017,'gold',24)
verts=[];faces=[];nx=32;nz=30
for j in range(nz+1):
    z=1.29-j*.018
    for i in range(nx+1):
        x=(i/nx-.5)*.54;y=-.18-.014*math.sin(i/nx*math.tau*5)*(j/nz)**.5
        verts.append((x,y,z+.006*math.sin(i*.7)*(j/nz)))
for j in range(nz):
    for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
towel=mesh('Folded towel',verts,faces,'fabric')
solid=towel.modifiers.new('Cotton thickness','SOLIDIFY');solid.thickness=.004
for z in (.80,.82,.84):
    tube('Woven hotel stripe',[(i*.54/32-.27,-.185-.014*math.sin(i/32*math.tau*5),z+.004*math.sin(i*.7)) for i in range(33)],.004,'stripe')
export('towel-rack')

# Clawfoot cast-iron bathtub: rolled rim, deep hollow bowl and ball feet.
new_asset()
N=96
# Elliptical ring profile gives a continuous thick-walled vessel.
profile=[(.69,.31,.16),(.83,.38,.22),(.93,.44,.48),(.96,.46,.60),(.94,.445,.65),(.90,.405,.66),(.875,.385,.625),(.85,.365,.50),(.73,.29,.28),(.64,.24,.255)]
verts=[];faces=[]
for rx,ry,z in profile:
    for i in range(N):
        a=i*math.tau/N
        # Lift both ends slightly for the old slipper-bath silhouette.
        verts.append((rx*math.cos(a),-.46+ry*math.sin(a),z+.055*abs(math.cos(a))**5))
for j in range(len(profile)-1):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
mesh('Cast porcelain tub',verts,faces,'porcelain')
# Basin floor; dark drain at the plumbing end.
sphere('Tub interior base',(0,-.46,.255),(.65,.25,.012),'porcelain',48)
cylinder('Tub drain',(.57,-.46,.265),(.57,-.46,.271),.031,'chrome',24)
for x in (-.65,.65):
    for y in (-.73,-.19):
        sphere('Clawfoot ball',(x,y,.055),(.065,.065,.055),'gold',16)
        tube('Clawfoot leg',[(x,y,.06),(x*.98,y,.13),(x*.91,y+.03,.25)],.035,'gold')
        for offset in (-.025,0,.025):
            tube('Claw toes',[(x+offset,y-.025,.10),(x+offset,y-.06,.05),(x+offset,y-.07,.035)],.009,'gold')
for x in (.58,.75):
    tube('Bath supply pipe',[(x,-.06,.05),(x,-.06,.79),(x,-.11,.83)],.016,'gold')
    cylinder('Bath tap handle',(x-.04,-.12,.83),(x+.04,-.12,.83),.008,'gold')
tube('Bath fill spout',[(.665,-.08,.78),(.665,-.25,.78),(.665,-.29,.74)],.025,'gold')
export('bathtub')

# Spectral woman. Uneven draped dress, bowed head and heavy wet hair veil.
new_asset()
N=48;levels=20;verts=[];faces=[]
for j in range(levels+1):
    t=j/levels;z=.04+t*1.42
    rx=.3*(1-t)+.15*t+.035*math.sin(t*math.pi)
    ry=.18*(1-t)+.12*t
    for i in range(N):
        a=i*math.tau/N;fold=1+.075*math.sin(a*11+t*2)
        verts.append((rx*math.cos(a)*fold,ry*math.sin(a)*fold,z+.025*math.sin(a*7)*(1-t)))
for j in range(levels):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
mesh('Draped dress',verts,faces,'ghost')
sphere('Shoulder mass',(0,0,1.42),(.23,.13,.16),'ghost')
cylinder('Neck',(0,-.015,1.44),(0,-.035,1.59),.065,'skin')
head=sphere('Bowed head',(0,-.04,1.68),(.115,.105,.155),'skin',32);head.rotation_euler[0]=.18
sphere('Wet hair crown',(0,-.035,1.70),(.126,.117,.158),'hair',32)
for side in (-1,1):
    x=side*.19
    cylinder('Sleeve',(x,0,1.40),(side*.24,-.015,1.12),.07,'ghost')
    cylinder('Forearm',(side*.24,-.015,1.12),(side*.25,-.07,.85),.035,'skin')
    sphere('Hand',(side*.25,-.075,.82),(.037,.021,.066),'skin')
    for j in range(4):
        xx=side*.25+(j-1.5)*.013
        tube('Long fingers',[(xx,-.08,.80),(xx+.008,-.085,.74),(xx+.012,-.10,.71)],.007,'skin')
    sphere('Eye socket',(side*.041,-.139,1.70),(.024,.009,.014),'eye',16)
# Hair forms a curtain, with asymmetry and many coherent tapering strands.
for i in range(40):
    a=i*math.tau/40
    length=.46+.16*(.5+.5*math.sin(i*1.7))
    points=[]
    for j in range(18):
        t=j/17
        rad=.04+.085*math.sin(min(t*2.1,1.8))
        xx=rad*math.cos(a)+.012*math.sin(t*9+i)
        yy=-.025+rad*math.sin(a)-.035*t
        zz=1.825-length*t
        points.append((xx,yy,zz))
    tube('Wet hair strand',points,.012 if i%3 else .017,'hair')
export('ghost')

(OUT/'manifest.json').write_text(json.dumps({'units':'meters','up':'+Y','front':'+Z','assets':manifest},indent=2),encoding='utf-8')
print('HOTEL_KIT_COMPLETE',json.dumps(manifest))
