"""Authored 1980s hotel bathroom dressing; run through the official Blender MCP.

All authored coordinates below are Three.js world meters: X right, Y up, +Z
front. Export converts Blender Z up back to GLTF +Y up. Existing runtime models
are only imported for the proof render, never overwritten.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Preserve stable runtime material names across repeated MCP builds.
for old in list(bpy.data.materials):
    if old.name.startswith('Dressing_'):bpy.data.materials.remove(old)
for old in list(bpy.data.images):
    if old.name.startswith('Baked_'):bpy.data.images.remove(old)
ORIGIN=(0,0,0);YAW=0

def T(v):
    x,y,z=v;c=math.cos(YAW);s=math.sin(YAW)
    return Vector((ORIGIN[0]+x*c+z*s,-(ORIGIN[2]-x*s+z*c),ORIGIN[1]+y))

def at(origin=(0,0,0),yaw=0):
    global ORIGIN,YAW
    ORIGIN=origin;YAW=yaw

M={}
def material(key,color,metal=0,rough=.5,texture=False,emission=0):
    m=bpy.data.materials.new('Dressing_'+key);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    if texture:
        # Locally baked 128px wear. GLB contains standard PBR image maps only.
        size=128;pixels=[]
        image=bpy.data.images.new('Baked_'+key,width=size,height=size,alpha=False)
        for j in range(size):
            for i in range(size):
                u=i/size;v=j/size
                slow=math.sin(u*28+math.sin(v*14)*2)*math.sin(v*20+math.cos(u*12))
                fine=math.sin(i*57.31+j*12.473)*math.cos(i*9.137-j*65.33)
                scratch=1 if abs(math.sin(v*136+u*.9))<.035 else 0
                a=.90+.07*slow+.035*fine-.055*scratch
                pixels.extend([max(0,min(1,c*a)) for c in color]+[1])
        image.pixels.foreach_set(pixels);image.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    M[key]=m;return m

material('ivory_glaze',(.67,.63,.48),.05,.22,True)
material('jade_glaze',(.19,.29,.23),.05,.21,True)
material('aged_brass',(.30,.19,.07),.82,.38,True)
material('rusted_iron',(.11,.075,.052),.72,.6,True)
material('dark_enamel',(.027,.047,.036),.45,.38)
material('nickel',(.34,.39,.36),.88,.25)
material('amber_glass',(.22,.075,.019),.05,.16)
material('green_glass',(.055,.18,.12),.05,.14)
material('cotton',(.48,.44,.33),0,.96,True)
material('walnut',(.11,.055,.028),.03,.48,True)
material('paper',(.62,.58,.42),0,.85)
material('shadow',(.009,.015,.011),.02,.9)
material('fluorescent',(.56,.77,.65),.05,.35,emission=3)

# A real cylindrical UV label, embedded in the glass base-color/roughness maps.
# No paper card, floating text or decal geometry is created for any bottle.
FONT={
 'S':['01111','10000','10000','01110','00001','00001','11110'],
 'I':['11111','00100','00100','00100','00100','00100','11111'],
 'A':['01110','10001','10001','11111','10001','10001','10001'],
 'M':['10001','11011','10101','10101','10001','10001','10001'],
 'H':['10001','10001','10001','11111','10001','10001','10001'],
 'O':['01110','10001','10001','10001','10001','10001','01110'],
 'T':['11111','00100','00100','00100','00100','00100','00100'],
 'E':['11111','10000','10000','11110','10000','10000','11111'],
 'L':['10000','10000','10000','10000','10000','10000','11111'],
 'N':['10001','11001','11001','10101','10011','10011','10001'],
 'C':['01111','10000','10000','10000','10000','10000','01111'],
 'P':['11110','10001','10001','11110','10000','10000','10000'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '6':['01110','10000','10000','11110','10001','10001','01110'],
}
def bottle_material(key,base,product):
    size=512;pixels=[];rough=[]
    for y in range(size):
        for x in range(size):
            u=x/size;v=y/size
            inside=.305<u<.695 and .23<v<.64
            age=.96+.025*math.sin(x*13.4+y*6.1)
            col=(.72*age,.66*age,.47*age) if inside else base
            border=inside and (u<.315 or u>.685 or v<.24 or v>.63)
            if border:col=(.12,.19,.13)
            pixels.extend([*col,1]);r=.83 if inside else .19;rough.extend([r,r,r,1])
    def stamp(text,cy,scale=2):
        start=int(size/2-(len(text)*6-1)*scale/2)
        for idx,ch in enumerate(text):
            glyph=FONT[ch]
            for row,line in enumerate(glyph):
                for col,bit in enumerate(line):
                    if bit=='1':
                        for dy in range(scale):
                            for dx in range(scale):
                                px=start+idx*6*scale+col*scale+dx;py=cy+(6-row)*scale+dy
                                off=(py*size+px)*4;pixels[off:off+4]=[.075,.13,.085,1]
    stamp('SIAM',286,4);stamp('HOTEL',238,4);stamp('316',192,4);stamp(product,144,2)
    color=bpy.data.images.new('Baked_'+key+'_label',width=size,height=size,alpha=False);color.pixels.foreach_set(pixels);color.pack()
    surface=bpy.data.images.new('Baked_'+key+'_roughness',width=size,height=size,alpha=False);surface.colorspace_settings.name='Non-Color';surface.pixels.foreach_set(rough);surface.pack()
    m=M[key];p=m.node_tree.nodes.get('Principled BSDF')
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=color;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=surface;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Roughness'])
bottle_material('amber_glass',(.22,.075,.019),'SHAMPOO')
bottle_material('green_glass',(.055,.18,.12),'TONIC')

def finish(o,name,mat):
    o.name=name;o.data.materials.append(M[mat]);return o

def cube(name,loc,dims,mat,bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1,location=T(loc));o=bpy.context.object
    o.dimensions=(dims[0],dims[2],dims[1]);o.rotation_euler[2]=YAW
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Hand finished edges','BEVEL');b.width=bevel;b.segments=3
        o.modifiers.new('Weighted edge normals','WEIGHTED_NORMAL')
    return finish(o,name,mat)

def sphere(name,loc,dims,mat,n=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=10,radius=1,location=T(loc));o=bpy.context.object
    o.scale=(dims[0],dims[2],dims[1]);o.rotation_euler[2]=YAW
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat)

def cyl(name,a,b,r,mat,n=16):
    aa=T(a);bb=T(b);d=bb-aa
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d.length,location=(aa+bb)*.5)
    o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat)

def tube(name,points,r,mat,closed=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=r;c.bevel_resolution=2
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*T(v),1)
    s.use_cyclic_u=closed;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(M[mat]);return o

def ring(name,loc,rx,rz,r,mat,n=64):
    return tube(name,[(loc[0]+rx*math.cos(i*math.tau/n),loc[1],loc[2]+rz*math.sin(i*math.tau/n)) for i in range(n)],r,mat,True)

def mesh(name,verts,faces,mat,uvs=None):
    data=bpy.data.meshes.new(name);data.from_pydata([T(p) for p in verts],[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);data.materials.append(M[mat])
    for p in data.polygons:p.use_smooth=True
    uv=data.uv_layers.new(name='UVMap')
    for polygon in data.polygons:
        for loopindex in polygon.loop_indices:
            index=data.loops[loopindex].vertex_index
            v=verts[index];uv.data[loopindex].uv=uvs[index] if uvs else (v[0]*1.7+v[2]*.3,v[1]*1.3)
    return o

def revolve(name,profile,mat,n=48):
    # Profile entries (height, width radius, depth radius, center Z).
    verts=[];faces=[]
    for y,rx,rz,cz in profile:
        for i in range(n):
            a=i*math.tau/n;verts.append((rx*math.cos(a),y,cz+rz*math.sin(a)))
    for j in range(len(profile)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    return mesh(name,verts,faces,mat)

def labelled_bottle(name,profile,mat,n=48):
    verts=[];faces=[];uv=[];bottom=profile[0][0];height=profile[-1][0]-bottom
    for y,rx,rz,cz in profile:
        for i in range(n+1):
            u=i/n;a=(u-.5)*math.tau+math.pi/2
            verts.append((rx*math.cos(a),y,cz+rz*math.sin(a)));uv.append((1-u,(y-bottom)/height))
    for j in range(len(profile)-1):
        for i in range(n):
            a=j*(n+1)+i;b=a+1;faces.append((a,a+n+1,b+n+1,b))
    return mesh(name,verts,faces,mat,uv)

def label(name,body,loc,size,mat='paper'):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.align_x='CENTER';c.size=size;c.extrude=.0003
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=T(loc)
    o.rotation_euler=(math.pi/2,0,YAW);c.materials.append(M[mat]);return o

def wheel(name,x,y,z):
    cyl(name,(x-.027,y,z),(x+.027,y,z),.055,'shadow',16)
    cyl(name+' steel axle',(x-.035,y,z),(x+.035,y,z),.025,'nickel',12)

# Washstand pedestal: fluted porcelain with a stepped foot, not a box proxy.
at((-.8,0,-3.12))
revolve('Porcelain pedestal',[(.015,.23,.20,0),(.07,.23,.20,0),(.1,.19,.16,0),(.14,.15,.13,0),(.2,.095,.09,0),(.5,.085,.075,0),(.61,.12,.11,0),(.68,.19,.15,0)],'ivory_glaze')
for i in range(12):
    a=i*math.tau/12
    tube('Pedestal flute',[(.087*math.cos(a),.19,.079*math.sin(a)),(.083*math.cos(a),.51,.074*math.sin(a)),(.115*math.cos(a),.61,.10*math.sin(a))],.006,'ivory_glaze')
cube('Washstand marble backsplash',(0,1.02,-.28),(1.17,.18,.075),'jade_glaze',.025)
cube('Washstand brass ledge',(0,1.115,-.23),(1.22,.025,.18),'aged_brass',.01)
for side in (-1,1):
    cube('Backsplash end cap',(side*.59,1.025,-.26),(.045,.21,.1),'aged_brass',.01)
cube('Soap dish',(.48,.94,-.02),(.17,.035,.115),'ivory_glaze',.015)
sphere('Used olive soap',(.48,.967,-.02),(.065,.017,.04),'jade_glaze')

# Toiletries: labeled amber shampoo, mouthwash, stopper bottle, ceramic tumbler.
for x,y,z,r,h,color in [(-.46,1.13,-.22,.037,.18,'amber_glass'),(-.34,1.13,-.22,.031,.13,'green_glass'),(.42,1.13,-.22,.027,.12,'amber_glass')]:
    bottle=labelled_bottle('Apothecary bottle with baked label',[(y,r*.65,r*.65,z),(y+.02,r,r,z),(y+h*.72,r,r,z),(y+h*.83,r*.48,r*.48,z),(y+h,r*.45,r*.45,z)],color)
    # revolve local X center defaults zero: offset all vertices by bottle x.
    # Explicitly translate using local-to-world direction, independent of origin.
    bottle.location += Vector((x,0,0))
    cyl('Bottle screw cap',(x,y+h,z),(x,y+h+.022,z),r*.52,'aged_brass',20)
mug=revolve('Ceramic tooth mug',[(1.13,.04,.04,-.22),(1.235,.045,.045,-.22),(1.24,.039,.039,-.22),(1.15,.033,.033,-.22)],'ivory_glaze',32)
mug.location+=Vector((.28,0,0))
cyl('Bamboo toothbrush',(.28,1.15,-.22),(.29,1.34,-.21),.005,'walnut',8)
cube('Toothbrush bristles',(.29,1.34,-.20),(.015,.028,.012),'cotton',.003)

# Wall-mounted cistern toilet: porcelain hollow basin, seat and raised tank.
at((-3.35,0,1.55),math.pi/2)
revolve('Toilet pedestal',[(.015,.17,.21,.37),(.08,.16,.19,.37),(.19,.13,.15,.35),(.26,.18,.22,.38),(.35,.24,.32,.43),(.405,.25,.35,.44),(.425,.23,.33,.44),(.4,.19,.28,.44),(.31,.13,.20,.41),(.265,.07,.12,.37)],'ivory_glaze')
ring('Black bakelite seat',(0,.439,.44),.235,.335,.025,'dark_enamel')
ring('Seat inner bevel',(0,.45,.44),.2,.285,.012,'shadow')
cube('Toilet hinge mounting',(0,.445,.13),(.32,.045,.075),'nickel',.012)
for x in (-.12,.12):
    cyl('Seat hinge',(x,.455,.10),(x,.455,.18),.022,'nickel')
cube('Raised porcelain cistern',(0,1.68,.12),(.65,.49,.23),'ivory_glaze',.065)
cube('Cistern lid',(0,1.945,.12),(.69,.055,.27),'ivory_glaze',.025)
cube('Tank recessed front',(0,1.69,.245),(.52,.31,.014),'jade_glaze',.04)
cube('Cistern medallion',(0,1.69,.255),(.2,.09,.009),'aged_brass',.02)
label('Tank porcelain stamp','SIAM',(0,1.67,.264),.038,'dark_enamel')
tube('High cistern flush pipe',[(0,1.44,.13),(0,.66,.13),(0,.56,.22),(0,.44,.30)],.025,'nickel')
for y in (.85,1.32):
    cyl('Flushpipe wall clamp',(0,y,0),(0,y,.13),.04,'nickel',20)
cyl('Cistern pullchain lever',(.25,1.79,.13),(.40,1.79,.13),.012,'aged_brass')
for i in range(31):
    # First/last links are anchor eyes; neighbors alternate XY/YZ planes.
    # Pitch = 2*15mm - 2*2.5mm wire: adjacent loops touch while interlocked.
    y=1.80-i*.025;perpendicular=(i%2==0)
    pts=[]
    for j in range(32):
        a=j*math.tau/32
        pts.append((.40 if perpendicular else .40+.009*math.cos(a),y+.015*math.sin(a),.13+.009*math.cos(a) if perpendicular else .13))
    tube('Interlocked perpendicular flush chain',pts,.0025,'aged_brass',True)
cyl('Chain grip attachment stem',(.40,1.025,.13),(.40,1.055,.13),.006,'nickel',12)
sphere('Porcelain chain grip',(.40,.99,.13),(.019,.055,.019),'ivory_glaze')
cube('Toilet roll holder',(0,.81,.05),(.22,.045,.12),'aged_brass',.02)
cyl('Toilet paper roll',(-.08,.81,.12),(.08,.81,.12),.06,'paper',24)
cube('Loose paper sheet',(0,.735,.174),(.16,.11,.002),'paper',.003)

# Backwall octagonal fan, blades, louver grille and visible mounting screws.
at((.8,2.65,-3.39))
cyl('Vent inner shadow',(0,0,-.025),(0,0,.015),.24,'shadow',8)
for radius,depth in ((.29,.018),(.265,.035)):
    tube('Octagonal enamel vent frame',[(radius*math.cos(math.pi/8+i*math.tau/8),radius*math.sin(math.pi/8+i*math.tau/8),depth) for i in range(8)],.018,'ivory_glaze',True)
for i in range(7):
    yy=(i-3)*.058;half=math.sqrt(max(0,.225**2-yy**2))
    cube('Vent horizontal louvre',(0,yy,.052),(half*2,.027,.035),'jade_glaze',.008)
for xx in (-.18,.18):
    cyl('Vent mounting screw',(xx,-.18,.047),(xx,-.18,.067),.009,'nickel',12)
    tube('Screwdriver slot',[(xx-.005,-.18,.069),(xx+.005,-.18,.069)],.0013,'shadow')

# Fluorescent fixture above shower: reflector housing, sockets and tube guards.
at((2.1,2.96,-3.30))
cube('Fluorescent reflector tray',(0,0,0),(1.23,.19,.16),'ivory_glaze',.025)
cube('Fluorescent fixture recess',(0,-.025,.091),(1.11,.10,.025),'shadow',.012)
for y in (-.04,.035):
    cyl('Fluorescent glass tube',(-.5,y,.12),(.5,y,.12),.018,'fluorescent',32)
    for x in (-.54,.54):cyl('Ceramic tube socket',(x-.018,y,.12),(x+.018,y,.12),.026,'ivory_glaze',20)
for x in (-.42,0,.42):
    tube('Tube safety guard',[(x,-.085,.09),(x,-.09,.17),(x,.09,.17),(x,.09,.09)],.004,'nickel')
cube('Fixture service badge',(.44,.105,.06),(.20,.036,.012),'paper',.003)
label('Fixture manufacturer','SIAM ELECTRIC',(.44,.098,.069),.018,'dark_enamel')

# Left wall old exposed services, bends, threaded couplings and isolation valves.
at((-3.37,0,-2.3),math.pi/2)
for side,x in enumerate((-.12,.13)):
    pts=[(x,.12,.055),(x,2.55,.055),(x+.08,2.63,.055),(x+.55,2.63,.055)]
    tube('Aged service copper pipe',pts,.022,'aged_brass')
    for y in (.22,.64,1.30,1.95,2.47):
        cyl('Copperpipe clamp',(x,y,0),(x,y,.08),.036,'rusted_iron',20)
        for yy in (y-.025,y+.025):cyl('Clamp bolt',(x-.038,yy,.015),(x+.038,yy,.015),.005,'nickel',10)
    for y in (.45,1.75):cyl('Threaded coupling',(x,y-.035,.055),(x,y+.035,.055),.031,'rusted_iron',20)
    cyl('Valve housing',(x,.95,.055),(x,.95,.15),.045,'aged_brass',20)
    tube('Isolation valve handwheel',[(x+.085*math.cos(i*math.tau/32),.95+.085*math.sin(i*math.tau/32),.17) for i in range(32)],.012,'rusted_iron',True)
    for i in range(3):
        a=i*math.tau/3;tube('Valve spokes',[(x,.95,.17),(x+.08*math.cos(a),.95+.08*math.sin(a),.17)],.009,'rusted_iron')

# A cast iron sectional radiator mounted by the left/front wall.
at((-3.34,0,2.69),math.pi/2)
for i in range(8):
    x=(i-3.5)*.083
    # Closed rounded vertical loops, front and back headers, cast feet.
    points=[]
    for j in range(12):
        a=math.pi-j*math.pi/11;points.append((x,.73+.06*math.sin(a),.13+.06*math.cos(a)))
    points.extend([(x,.22,.19),(x,.16,.16),(x,.16,.10),(x,.22,.07),(x,.73,.07)])
    tube('Cast radiator section',points,.023,'rusted_iron',True)
    if i in (1,6):cube('Radiator cast foot',(x,.10,.14),(.055,.17,.13),'rusted_iron',.018)
for y in (.23,.71):cyl('Radiator manifold',(-.38,y,.13),(.38,y,.13),.028,'rusted_iron',20)
cyl('Radiator brass bleed',(.37,.72,.13),(.43,.72,.13),.025,'aged_brass')
cube('Thermostat valve',(-.40,.23,.13),(.10,.07,.08),'nickel',.015)
for yy in (.20,.23,.26):ring('Thermostat grip',(-.44,yy,.13),.025,.025,.003,'ivory_glaze',20)

# Linen service cart with wood slats, curved handle, casters, folded towels.
at((-2.64,0,2.22))
for y in (.2,.68):
    for j in range(5):cube('Cart walnut shelf slat',((j-2)*.13,y,0),(.105,.025,.47),'walnut',.009)
    for z in (-.235,.235):cube('Cart shelf brass lip',(0,y+.025,z),(.7,.055,.02),'aged_brass',.007)
for x in (-.33,.33):
    for z in (-.22,.22):
        cyl('Cart tubular upright',(x,.13,z),(x,.8,z),.014,'aged_brass')
        wheel('Cart caster',x,.075,z)
tube('Cart curved push handle',[(-.33,.72,-.22),(-.33,.86,-.22),(-.28,.90,-.22),(.28,.90,-.22),(.33,.86,-.22),(.33,.72,-.22)],.015,'aged_brass')
for j,(x,z,w,d) in enumerate([(-.14,0,.28,.34),(.16,.02,.22,.30)]):
    for level in range(3):
        y=.73+level*.055
        cube('Folded guest linen',(x,y,z),(w,.05,d),'cotton',.018)
        for offset in (-.012,.012):
            cube('Linen border stitch',(x,y+.026,z+d/2-.045+offset),(w-.025,.0015,.003),'jade_glaze',.0005)
cube('Cart laundry sack',(0,.42,0),(.49,.37,.36),'cotton',.05)
for z in (-.183,.183):
    tube('Laundry sack seam',[(-.21,.23,z),(-.22,.54,z),(-.18,.59,z),(.19,.59,z),(.22,.54,z),(.21,.23,z)],.003,'paper')

# Backwall narrow toiletries ledge with spare stopper bottles at right of sink.
at((.27,1.32,-3.35))
cube('Beveled glass ledge',(0,0,.12),(.47,.022,.24),'green_glass',.009)
for x in (-.16,.16):tube('Glass ledge bracket',[(x,-.14,.025),(x,-.04,.22),(x,-.02,.22),(x,-.02,.02)],.008,'nickel')
for x in (-.10,.05):
    bottle=labelled_bottle('Small bottle with baked label',[(.012,.025,.025,.12),(.025,.030,.030,.12),(.16,.030,.030,.12),(.175,.016,.016,.12),(.195,.016,.016,.12)],'green_glass')
    bottle.location+=Vector((x,0,0))
    sphere('Ground glass stopper',(x,.205,.12),(.023,.016,.023),'ivory_glaze',16)

# Decorative ceiling coves and sculpted corner consoles (clear all routes).
at()
for z in (-3.38,3.38):
    for y,d in ((3.10,.13),(3.16,.10),(3.21,.06)):
        cube('Ceiling cornice back-front',(0,y,z),(6.9,.055,d),'ivory_glaze',.018)
for x in (-3.38,3.38):
    for y,d in ((3.10,.13),(3.16,.10),(3.21,.06)):
        cube('Ceiling cornice sides',(x,y,0),(d,.055,6.9),'ivory_glaze',.018)
for x in (-3.27,3.27):
    for z in (-3.27,3.27):
        sphere('Corner ceiling plaster rosette',(x,3.11,z),(.14,.065,.14),'ivory_glaze',24)
        for i in range(8):
            a=i*math.tau/8
            sphere('Rosette plaster petal',(x+.10*math.cos(a),3.10,z+.10*math.sin(a)),(.07,.025,.035),'ivory_glaze',12)

# Brass drain and cleanable floor flange details near real water sources.
for x,z,size in ((2.18,-2.88,.24),(-2.78,-.45,.16)):
    cube('Floor drain dark recess',(x,.009,z),(size,.016,size),'shadow',.012)
    for s in (-1,1):
        cube('Drain brass surround',(x+s*size/2,.021,z),(.012,.012,size+.024),'aged_brass',.003)
        cube('Drain brass surround',(x,.021,z+s*size/2),(size+.024,.012,.012),'aged_brass',.003)
    for i in range(7):cube('Drain grille slots',(x-size*.39+i*size*.13,.021,z),(.008,.012,size-.025),'nickel',.003)
    for dx in (-size*.35,size*.35):cyl('Drain screw',(x+dx,.024,z-size*.36),(x+dx,.027,z-size*.36),.006,'nickel',12)

# Apply bevels and batch all geometry by semantic material (13 draw calls).
at();bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH')
for o in list(bpy.context.scene.objects):
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
groups={}
for o in list(bpy.context.scene.objects):groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    objects[0].name=name
    # Bake the joined batch's world transform. Runtime roots are identity and
    # axis-aligned bounds remain exact instead of inflating rotated local AABBs.
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.select_all(action='SELECT')
points=[o.matrix_world@v.co for o in bpy.context.selected_objects for v in o.data.vertices]
coordinates=[(v.x,v.z,-v.y) for v in points]
minimum=[min(v[i] for v in coordinates) for i in range(3)];maximum=[max(v[i] for v in coordinates) for i in range(3)]
for o in bpy.context.selected_objects:o.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in bpy.context.selected_objects)
bpy.ops.export_scene.gltf(filepath=str(OUT/'dressing.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'dressing.blend'),compress=True)
report={'bytes':(OUT/'dressing.glb').stat().st_size,'triangles':triangles,'meshes':len(groups),'materials':len(groups),'textures':sum(sum(n.type=='TEX_IMAGE' for n in m.node_tree.nodes) for m in M.values()),'bounds':{'min':minimum,'max':maximum},'units':'meters','up':'+Y','rootTransform':'identity','colliders':[{'name':'toilet','x':[-3.4,-2.25],'z':[1.1,2.0]},{'name':'linen-cart','x':[-3.08,-2.20],'z':[1.91,2.48]}]}
print('DRESSING_EXPORT',json.dumps(report),flush=True)

# Reimport actual runtime GLB, then context assets for a readable proof render.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUT/'dressing.glb'))
for name,origin,yaw in [('mirror',(-.8,0,-3.4),0),('sink',(-.8,0,-3.4),0),('shower',(2.2,0,-3.43),0),('bathtub',(-3.4,0,-.55),math.pi/2)]:
    bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
    # Wrap roots to preserve authored per-mesh offsets under world rotation.
    root=bpy.data.objects.new(name+'_proof_placement',None);bpy.context.collection.objects.link(root)
    for o in list(bpy.context.selected_objects):
        if o.parent is None:o.parent=root
    root.location=(origin[0],-origin[2],origin[1]);root.rotation_euler[2]=yaw

at()
proofwall=material('proof_wall',(.15,.22,.18),0,.82)
cube('Proof backwall',(0,1.61,-3.52),(7.15,3.3,.15),'proof_wall',0)
cube('Proof westwall',(-3.52,1.61,0),(.15,3.3,7.15),'proof_wall',0)
cube('Proof floor',(0,-.07,0),(7.15,.12,7.15),'proof_wall',0)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.16,.13,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
for pos,power,size,color in [((1.6,3,2.7),1050,5,(1,.86,.63)),((-1.5,2.7,0),650,3,(.70,.86,1)),((2.1,3,-2.9),150,1,(.63,1,.75))]:
    bpy.ops.object.light_add(type='AREA',location=(pos[0],-pos[2],pos[1]));o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color
    o.rotation_euler=(Vector((-1.0,1.8,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.8,-5.3,3.0));camera=bpy.context.object
camera.rotation_euler=(Vector((-.8,1.0,1.45))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=28
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'artifacts/aaa-dressing.png')
if globals().get('DRESSING_RENDER_MODE','all')=='all':bpy.ops.render.render(write_still=True)
print('DRESSING_PROOF_RENDERED',scene.render.filepath,flush=True)

# Close inspection proves wire contact and the label's curved surface mapping.
for name,pos,target,lens in [
    ('chain-interlock',(-1.92,1.40,1.45),(-3.22,1.40,1.15),65),
    ('bottle-texture',(-.70,1.36,-1.95),(-.8,1.23,-3.32),55),
    ('bottle-texture-side',(-.24,1.31,-2.46),(-1.11,1.23,-3.32),62),
]:
    if globals().get('DRESSING_RENDER_MODE')=='bottle' and name=='chain-interlock':continue
    camera.location=(pos[0],-pos[2],pos[1]);camera.rotation_euler=(Vector((target[0],-target[2],target[1]))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=lens
    scene.render.resolution_x=1200;scene.render.resolution_y=1400 if name=='chain-interlock' else 900
    scene.render.filepath=str(ROOT/'artifacts'/(name+'.png'));bpy.ops.render.render(write_still=True)
    print('DRESSING_CLOSEUP_RENDERED',scene.render.filepath,flush=True)
