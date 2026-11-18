"""Authored student apparition. Default renders previews BEFORE any export.

Run through bridge_client.py for preview; after visual review execute this file
with global GHOST_STAGE='export' to write ghost-aaa.glb. No external assets.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
STAGE=globals().get('GHOST_STAGE','preview')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials):
    if m.name.startswith('Apparition_'):bpy.data.materials.remove(m)
for m in list(bpy.data.images):
    if m.name.startswith('Apparition_'):bpy.data.images.remove(m)

def T(v):return Vector((v[0],-v[2],v[1]))
def noise(u,v):return math.sin(u*31+math.sin(v*17)*2)*math.sin(v*23+math.cos(u*13))

M={}
def material(name,col,rough,role,metal=0):
    m=bpy.data.materials.new('Apparition_'+name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if role in ('skin','face','shirt','skirt','hair'):
        size=256 if role in ('face','hair') else 128
        image=bpy.data.images.new('Apparition_'+role+'_albedo',width=size,height=size,alpha=False)
        normal=bpy.data.images.new('Apparition_'+role+'_normal',width=size,height=size,alpha=False)
        # Blender resets a generated image buffer when changing color space.
        # Set Non-Color BEFORE assigning pixels so exported normals stay valid.
        normal.colorspace_settings.name='Non-Color'
        pixels=[];normals=[]
        for j in range(size):
            for i in range(size):
                u=i/size;v=j/size;n=noise(u,v);fine=math.sin(i*46.17+j*33.29)
                if role in ('skin','face'):
                    # Thin branching bluish veins, diffuse mottling, fine pores.
                    vein=max(0,1-abs(math.sin(u*18+.22*math.sin(v*25)+v*5))/.035)*.055
                    b=.96+.025*n+.008*fine
                    c=(col[0]*b-vein*.18,col[1]*b-vein*.06,col[2]*b+vein*.04)
                    if role=='face':
                        # Anatomical pigment is painted into UVs, avoiding
                        # detached black outlines around eyes/nose/lips.
                        a=u*math.tau;xx=.086*math.sin(a);yy=1.535+v*.275;front=max(0,math.cos(a))**8
                        orbital=sum(math.exp(-((xx-k)/.029)**2-((yy-1.678)/.022)**2) for k in (-.037,.037))
                        cheek=sum(math.exp(-((xx-k)/.024)**2-((yy-1.640)/.024)**2) for k in (-.052,.052))
                        lip=math.exp(-(xx/.030)**2-((yy-1.607)/.009)**2)
                        shade=front*(orbital*.22+cheek*.07)
                        c=(c[0]*(1-shade)-lip*front*.025,c[1]*(1-shade)-lip*front*.068,c[2]*(1-shade)-lip*front*.05)
                    nx=.5+.014*math.sin(i*15.7+j*11.8);ny=.5+.014*math.cos(i*22.1-j*5.3)
                elif role=='hair':
                    strand=.71+.22*abs(math.sin(u*471+math.sin(v*13)*.45))
                    c=tuple(c*strand for c in col);nx=.5+.034*math.cos(u*471);ny=.5+.006*math.sin(v*80)
                else:
                    grime=max(0,n-.3)*.20
                    b=.94+.035*n+.012*fine-grime
                    c=tuple(c*b for c in col)
                    # Fine, irregular weave instead of visible checkerboard.
                    weave=.009 if role=='shirt' else .013
                    nx=.5+weave*math.sin(i*2.40+j*.18);ny=.5+weave*math.sin(j*2.37+i*.13)
                pixels.extend([max(.001,min(1,c)) for c in c]+[1]);normals.extend([nx,ny,.997,1])
        image.pixels.foreach_set(pixels);image.pack();normal.pixels.foreach_set(normals);normal.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=normal
        node=m.node_tree.nodes.new('ShaderNodeNormalMap');node.inputs['Strength'].default_value=.26 if role in ('skin','face') else .35
        m.node_tree.links.new(tex.outputs['Color'],node.inputs['Color']);m.node_tree.links.new(node.outputs['Normal'],p.inputs['Normal'])
    M[name]=m;return m

material('ashen_skin',(.58,.61,.57),.78,'skin')
material('wet_hair',(.012,.017,.014),.60,'hair')
M['wet_hair'].node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.25
material('ivory_blouse',(.59,.57,.46),.92,'shirt')
material('charcoal_skirt',(.055,.064,.060),.82,'skirt')
material('eye_and_creases',(.008,.015,.011),.65,'plain')
material('face_skin',(.58,.61,.57),.76,'face')
material('worn_nickel',(.32,.34,.29),.4,'plain',.78)

def group(name,location=(0,0,0)):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=T(location);return o
ROOTGROUP=group('apparition')
BODY=group('body');HEAD=group('head',(0,1.67,0));LHAND=group('leftHand',(-.225,.955,.06));RHAND=group('rightHand',(.258,.965,.045))
for g in (BODY,HEAD,LHAND,RHAND):g.parent=ROOTGROUP
bpy.context.view_layer.update()

def finish(o,name,mat,parent=BODY):
    o.name=name;o.data.materials.append(M[mat]);o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted();return o

def mesh(name,verts,faces,mat,parent=BODY,uvs=None):
    data=bpy.data.meshes.new(name);data.from_pydata([T(p) for p in verts],[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
    for p in data.polygons:p.use_smooth=True
    uv=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        for loop in p.loop_indices:
            idx=data.loops[loop].vertex_index
            uv.data[loop].uv=uvs[idx] if uvs else (verts[idx][0]*4+verts[idx][2],verts[idx][1]*3)
    return finish(o,name,mat,parent)

def sphere(name,loc,scale,mat,parent=BODY,n=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=12,radius=1,location=T(loc));o=bpy.context.object;o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat,parent)

def tube(name,points,r,mat,parent=BODY):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=5;c.bevel_depth=r;c.bevel_resolution=2
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*T(v),1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);return finish(o,name,mat,parent)

def loft(name,points,mat,parent=BODY,n=20):
    # Arbitrary anatomical centerline with tapered elliptical cross sections.
    verts=[];faces=[];uv=[]
    for j,(center,rx,rz) in enumerate(points):
        for i in range(n):
            a=i*math.tau/n
            # Ellipse rings remain horizontal, fitting naturally hanging limbs.
            verts.append((center[0]+rx*math.cos(a),center[1],center[2]+rz*math.sin(a)));uv.append((i/n,j/max(1,len(points)-1)))
    for j in range(len(points)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    faces.append(tuple(reversed(range(n))));faces.append(tuple((len(points)-1)*n+i for i in range(n)))
    if points[-1][0][1]>points[0][0][1]:faces=[tuple(reversed(f)) for f in faces]
    return mesh(name,verts,faces,mat,parent,uv)

def profile_interp(profile,t):
    for a,b in zip(profile,profile[1:]):
        if a[0]<=t<=b[0]:
            s=(t-a[0])/(b[0]-a[0]);s=s*s*(3-2*s)
            return tuple(a[k]*(1-s)+b[k]*s for k in range(1,len(a)))
    return profile[-1][1:]

# A contoured head. Deliberate orbital, cheek, jaw, nose and lip volumes are
# deformations of continuous topology rather than glued-on facial primitives.
profile=[(0,.024,.027,.011),(.10,.049,.052,.005),(.25,.073,.066,0),(.44,.087,.078,0),(.61,.088,.079,-.002),(.78,.082,.073,-.006),(.92,.063,.058,-.009),(1,.003,.004,-.01)]
def face_uv(v,shape=profile):
    t=max(0,min(1,(v[1]-1.535)/.275));rx=profile_interp(shape,t)[0]
    angle=math.asin(max(-1,min(1,v[0]/max(.001,rx))))
    return ((angle/math.tau)%1,t)
verts=[];faces=[];uv=[];rings=52;n=88
for j in range(rings+1):
    t=j/rings;y=1.535+t*.275;rx,rz,zc=profile_interp(profile,t)
    for i in range(n):
        a=i*math.tau/n;x=rx*math.sin(a);front=max(0,math.cos(a));z=zc+rz*math.cos(a)
        if front>0:
            def gauss(xx,yy,sx,sy):return math.exp(-((x-xx)/sx)**2-((y-yy)/sy)**2)
            # Soft orbital hollows and continuous nasal/cheek anatomy.
            sockets=sum(gauss(xx,1.683,.025,.017) for xx in (-.037,.037))
            brow=sum(gauss(xx,1.705,.030,.009) for xx in (-.037,.037))
            cheek=sum(gauss(xx,1.662,.020,.010) for xx in (-.058,.058))
            hollow=sum(gauss(xx,1.640,.020,.018) for xx in (-.046,.046))
            bridge=gauss(0,1.675,.014,.031)*.012
            tip=gauss(0,1.650,.017,.014)*.021
            alar=sum(gauss(xx,1.642,.008,.006) for xx in (-.013,.013))*.007
            philtrum=gauss(0,1.624,.007,.010)*.003
            chin=gauss(0,1.566,.022,.012)*.006
            z+=front**6*(-sockets*.014+brow*.003+cheek*.005-hollow*.005+bridge+tip+alar+philtrum+chin)
        verts.append((x,y,z));uv.append((i/n,t))
for j in range(rings):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
mesh('Contoured face jaw and skull',verts,faces,'face_skin',HEAD,uv)

# Recessed almond eyes with broad skin transitions. No ring-shaped outlines,
# protruding black socket spheres or bright cartoon dots.
for side in (-1,1):
    x=side*.037
    sphere('Recessed dead eye',(x,1.682,.057),(.016,.0085,.012),'eye_and_creases',HEAD,n=28)
    for upper in (True,False):
        vv=[];ff=[]
        for j in range(4):
            blend=j/3
            for i in range(33):
                u=i/32;s=math.sin(u*math.pi);xx=x+(u-.5)*(.032+.016*blend)
                yy=1.682+(1 if upper else -1)*(.0055+.007*blend)*s
                zz=.069-.005*blend-.003*abs(u-.5)*2
                vv.append((xx,yy,zz))
        for j in range(3):
            for i in range(32):
                a=j*33+i;face=(a,a+1,a+34,a+33);ff.append(face if upper else tuple(reversed(face)))
        mesh('Soft upper eyelid' if upper else 'Soft lower eyelid',vv,ff,'face_skin',HEAD,[face_uv(v) for v in vv])
    sphere('Recessed nostril',(side*.011,1.639,.091),(.0038,.0017,.002),'eye_and_creases',HEAD,n=16)

# Slack parted lips over a dark interior; corners stay sealed, center gapes.
for upper in (True,False):
    verts=[];faces=[]
    for j in range(3):
        v=j/2
        for i in range(33):
            u=i/32;x=(u-.5)*.064;shape=math.sin(u*math.pi)
            yc=1.608+.0025*shape*(1 if upper else -1)-.001*shape
            y=yc+(1 if upper else -1)*(.004 if upper else .005)*shape*v
            z=.070+.0045*shape*math.sin(v*math.pi/2)
            verts.append((x,y,z))
    for j in range(2):
        for i in range(32):a=j*33+i;faces.append((a,a+1,a+34,a+33))
    if not upper:faces=[tuple(reversed(f)) for f in faces]
    mesh('Upper lip' if upper else 'Lower lip',verts,faces,'face_skin',HEAD,[face_uv(v) for v in verts])
sphere('Mouth interior',(0,1.607,.061),(.022,.0036,.009),'eye_and_creases',HEAD,n=24)
for side in (-1,1):
    sphere('Ear pinna',(side*.088,1.673,-.014),(.016,.035,.017),'ashen_skin',HEAD)
    sphere('Ear concha',(side*.098,1.675,.002),(.006,.018,.003),'eye_and_creases',HEAD,n=16)

# Neck and clavicles blend under a folded shirt collar.
loft('Slender neck',[((0,1.43,0),.049,.046),((0,1.48,.003),.040,.041),((0,1.55,.004),.037,.039),((0,1.574,.008),.046,.043)],'ashen_skin',n=24)
for side in (-1,1):
    tube('Clavicle',[(side*.035,1.445,.052),(side*.085,1.43,.072),(side*.145,1.421,.056)],.004,'ashen_skin')

# Blouse: waist, bust and shoulder contours with draped tension wrinkles.
profile=[(0,.127,.077),(.13,.133,.081),(.4,.157,.097),(.7,.178,.099),(.9,.189,.078),(1,.080,.056)]
verts=[];faces=[];uv=[];n=72;rows=32
for j in range(rows+1):
    t=j/rows;y=1.025+t*.435;rx,rz=profile_interp(profile,t)
    for i in range(n):
        a=i*math.tau/n
        wrinkles=(.0035*math.sin(a*9+t*11)+.002*math.sin(a*17-t*7))*math.sin(t*math.pi)
        verts.append(((rx+wrinkles)*math.sin(a),y,rz*math.cos(a)+wrinkles));uv.append((i/n,t))
for j in range(rows):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
mesh('Tailored wrinkled blouse',verts,faces,'ivory_blouse',BODY,uv)
for side in (-1,1):
    mesh('Folded pointed shirt collar',[(side*.026,1.46,.055),(side*.074,1.441,.075),(side*.093,1.387,.092),(side*.042,1.416,.114),(side*.025,1.46,.061)],[(0,1,3),(1,2,3),(0,3,4)],'ivory_blouse')
    tube('Collar stitched edge',[(side*.026,1.46,.061),(side*.074,1.441,.079),(side*.093,1.387,.096),(side*.042,1.416,.117)],.0013,'ivory_blouse')
for j in range(6):
    y=1.11+j*.049
    sphere('Shirt pearl button',(.008,y,.102 if y<1.35 else .097),(.004,.004,.0017),'worn_nickel',n=12)
tube('Shirt center placket',[(.017,1.07,.083),(.017,1.16,.096),(.017,1.29,.105),(.017,1.39,.090)],.0025,'ivory_blouse')
for side in (-1,1):
    tube('Shirt side seam',[(side*.128,1.04,.01),(side*.144,1.18,.01),(side*.176,1.36,.01)],.0018,'ivory_blouse')
# Small period-appropriate student pin; abstract, no invented school identity.
mesh('Student metal insignia',[(-.074,1.337,.103),(-.067,1.355,.105),(-.060,1.337,.105),(-.067,1.324,.104)],[(0,1,2,3)],'worn_nickel')

# Arms with elbow, forearm and wrist contour; short sleeves overlap shoulders.
loft('Left arm anatomy',[((-.161,1.425,0),.046,.047),((-.192,1.36,.005),.043,.040),((-.213,1.27,.012),.032,.031),((-.221,1.205,.022),.026,.027),((-.228,1.17,.031),.032,.029),((-.228,1.10,.044),.029,.025),((-.225,1.01,.054),.021,.019),((-.225,.955,.060),.016,.015)],'ashen_skin',n=28)
loft('Right arm anatomy',[((.161,1.425,-.008),.046,.046),((.193,1.36,-.007),.042,.039),((.224,1.28,-.001),.032,.030),((.242,1.205,.008),.027,.027),((.246,1.16,.015),.032,.027),((.253,1.09,.026),.028,.024),((.258,1.01,.038),.021,.018),((.258,.965,.045),.016,.014)],'ashen_skin',n=28)
for side in (-1,1):
    loft('Short blouse sleeve',[((side*.155,1.432,-.003),.059,.059),((side*.185,1.38,0),.063,.056),((side*.204,1.316,.006),.054,.050)],'ivory_blouse',n=32)
    points=[(side*.204+.054*math.cos(i*math.tau/48),1.316,.006+.05*math.sin(i*math.tau/48)) for i in range(49)]
    tube('Sleeve cuff seam',points,.0025,'ivory_blouse')

def hand(side,center,parent):
    x,y,z=center
    # Tapered knuckles and a flattened anatomical palm; right wrist more flexed.
    loft('Anatomical palm',[(center,.017,.014),((x+side*.003,y-.028,z+.006),.025,.014),((x+side*.003,y-.062,z+.008),.026,.012),((x+side*.001,y-.071,z+.01),.021,.011)],'ashen_skin',parent,n=24)
    for k in range(4):
        xx=x+(k-1.5)*.014;length=[.063,.074,.068,.05][k]
        yy=y-.067+(.004 if k in (0,3) else 0);bend=[.007,.012,.018,.016][k]
        # Each digit has visible proximal/intermediate/distal taper and flexion.
        points=[((xx,yy,z+.01),.0065,.006),((xx,yy-length*.34,z+.012),.006,.0057),((xx+side*.001,yy-length*.53,z+.017),.0057,.0055),((xx+side*.003,yy-length*.79,z+.02+bend),.0047,.0046),((xx+side*.004,yy-length,z+.018+bend),.003,.003)]
        loft('Articulated finger',points,'ashen_skin',parent,n=12)
        for joint in (.34,.65):
            tube('Finger knuckle crease',[(xx-.004,yy-length*joint,z+.018),(xx+.004,yy-length*joint,z+.018)],.0005,'eye_and_creases',parent)
        sphere('Fingernail',(xx+side*.003,yy-length*.86,z+.024+bend),(.003,.006,.001),'ashen_skin',parent,n=12)
    # Separate abducted thumb bends inward, rather than five parallel sticks.
    loft('Opposed thumb',[((x-side*.019,y-.025,z+.004),.009,.008),((x-side*.033,y-.044,z+.010),.008,.007),((x-side*.035,y-.068,z+.022),.006,.006),((x-side*.026,y-.084,z+.029),.004,.004)],'ashen_skin',parent,n=14)
    tube('Palm lifeline',[(x-side*.013,y-.025,z+.020),(x-side*.009,y-.046,z+.021),(x+side*.006,y-.063,z+.020)],.0006,'eye_and_creases',parent)

hand(-1,(-.225,.955,.060),LHAND);hand(1,(.258,.965,.045),RHAND)

# Pleated charcoal student skirt: hanging folds and asymmetrical hem weight.
verts=[];faces=[];uv=[];n=96;rows=32
for j in range(rows+1):
    t=j/rows;y=.095+t*.95;rx=.245*(1-t)+.13*t;rz=.145*(1-t)+.078*t
    for i in range(n):
        a=i*math.tau/n;pleat=(math.cos(a*24)*.010+math.cos(a*48)*.003)*(1-.30*t)
        lean=.008*math.sin(t*math.pi)*math.cos(a*2)
        verts.append(((rx+pleat)*math.sin(a)+lean,y+.009*math.sin(a*5)*(1-t), (rz+pleat)*math.cos(a)));uv.append((i/n,t))
for j in range(rows):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
mesh('Long pleated skirt',verts,faces,'charcoal_skirt',BODY,uv)
for y in (1.032,1.05):
    tube('Skirt waistband',[(.132*math.sin(i*math.tau/64),y,.080*math.cos(i*math.tau/64)) for i in range(65)],.004,'charcoal_skirt')
for side in (-1,1):
    sphere('Bare foot',(side*.073,.048,.065),(.044,.035,.105),'ashen_skin',n=24)
    for toe in range(5):
        xx=side*.073+(toe-2)*.012
        sphere('Individual toe',(xx,.037,.152-toe*.004),(.008-.0007*toe,.014,.024-.002*toe),'ashen_skin',n=12)

# Thin tapered hair ribbons with crown parting. Wet curtain strands fall
# straight across the face, veiling the sockets; a denser right veil leaves
# one side half-hidden.
def ribbon(name,points,widths,parent=HEAD):
    verts=[];faces=[];uv=[]
    for j,(p,w) in enumerate(zip(points,widths)):
        x,y,z=p;radial=Vector((x,0,z));
        if radial.length<.01:radial=Vector((1,0,0))
        radial.normalize();side=Vector((radial.z,0,-radial.x))
        for k in (-1,0,1):
            q=Vector(p)+side*w*k+radial*(.00020 if k==0 else 0)
            verts.append(tuple(q));uv.append(((k+1)*.5,j/(len(points)-1)))
    for j in range(len(points)-1):
        for k in range(2):a=j*3+k;faces.append((a,a+3,a+4,a+1))
    return mesh(name,verts,faces,'wet_hair',parent,uv)

# A thin textured undercoat follows the actual cranium, closing pale scalp
# gaps under the layered locks. The front hairline remains irregular/open.
vv=[];ff=[];uv=[];around=72;rows=15
for j in range(rows+1):
    t=j/rows
    for i in range(around+1):
        a=i/around*math.tau;front=max(0,math.cos(a))
        limit=1.91-.96*front**3
        phi=.025+t*limit
        vv.append((.103*math.sin(phi)*math.sin(a),1.675+.147*math.cos(phi),-.008+.096*math.sin(phi)*math.cos(a)))
        uv.append((i/around*12,t))
for j in range(rows):
    for i in range(around):
        a=j*(around+1)+i;ff.append((a,a+around+1,a+around+2,a+1))
mesh('Textured hair undercoat',vv,ff,'wet_hair',HEAD,uv)

# Back and sides: broad overlapped locks with individual narrow tip wisps.
for i in range(56):
    theta=.50+i*(math.tau-1.08)/55
    length=.43+.11*(.5+.5*math.sin(i*2.27));points=[];width=[]
    for j in range(24):
        t=j/23
        if t<.48:
            phi=.12+t/.48*1.45
            x=.098*math.sin(phi)*math.sin(theta);y=1.675+.143*math.cos(phi);z=-.008+.092*math.sin(phi)*math.cos(theta)
        else:
            q=(t-.48)/.52
            x=(.100+.016*q)*math.sin(theta)+.006*math.sin(q*8+i)
            y=1.675-q*length;z=-.008+(.094+.016*q)*math.cos(theta)+.005*math.sin(q*12+i)
        points.append((x,y,z));width.append((.0055+.002*(i%3))*max(.04,(1-t)**.42))
    ribbon('Layered back hair lock',points,width)

# Dense wet curtain: clumped strands fall from the crown straight across the
# forehead and sockets, crossing in front of the nose; a heavier right veil
# half-conceals the face and breaks up the outline.
for i in range(24):
    target=-.062+.124*(i/23)+.004*math.sin(i*4.7)
    points=[];width=[]
    drop=.36+.16*((i*11)%7)/6
    for j in range(26):
        t=j/25
        x=target*(.30+.70*t**1.2)+.0025*math.sin(t*11+i*1.9)
        y=1.815-t*drop
        rise=min(1.0,t/.26)**.7
        z=.014+(.080+.016*math.exp(-(target/.052)**2))*rise+.002*math.sin(t*9+i)
        points.append((x,y,z));width.append((.00065+.00055*((i*5)%3)/2)*max(.03,(1-t)**.55))
    ribbon('Wet curtain strand',points,width)
for i in range(6):
    points=[];width=[]
    drop=.40+.10*(i/5)
    for j in range(24):
        t=j/23
        x=-.030-(.028+.034*(i/5))*math.sin(t*math.pi*.60)+.003*math.sin(t*9+i)
        y=1.814-t*drop
        z=.014+.092*math.sin(min(t*math.pi*.9,math.pi/2))+.003*math.sin(t*7+i)
        points.append((x,y,z));width.append(.0040*max(.025,(1-t)**.5))
    ribbon('Left contour veil',points,width)
for i in range(12):
    points=[];width=[]
    drop=.42+.12*(i/11)
    for j in range(24):
        t=j/23
        x=.026+(.034+.046*(i/11))*math.sin(t*math.pi*.52)+.004*math.sin(t*8+i*1.3)
        y=1.814-t*drop
        z=.014+.094*math.sin(min(t*math.pi,math.pi/2))+.004*math.sin(t*7+i)
        points.append((x,y,z));width.append(.0044*max(.025,(1-t)**.5))
    ribbon('Thin wet right veil',points,width)

# Tapering wisps bridge crown gaps without a smooth helmet shell.
for i in range(32):
    theta=i*math.tau/32+.13;points=[];width=[]
    for j in range(20):
        t=j/19;phi=.02+t*1.5
        points.append((.101*math.sin(phi)*math.sin(theta),1.675+.145*math.cos(phi),-.006+.096*math.sin(phi)*math.cos(theta)))
        width.append(.0042*(1-t*.8))
    ribbon('Crown parting strands',points,width)

# Slight tilt and lowered chin; wet strands veil the sockets asymmetrically.
bpy.context.view_layer.update()
HEAD.rotation_euler[1]=-.105
HEAD.rotation_euler[0]=.055

# Consolidate only within each named pose group, keeping six shared materials.
for parent in (BODY,HEAD,LHAND,RHAND):
    children=[o for o in bpy.context.scene.objects if o.parent==parent and o.type in ('MESH','CURVE')]
    bpy.ops.object.select_all(action='DESELECT')
    for o in children:o.select_set(True)
    if children:
        bpy.context.view_layer.objects.active=children[0];bpy.ops.object.convert(target='MESH')
    batches={}
    for o in [o for o in bpy.context.scene.objects if o.parent==parent and o.type=='MESH']:
        batches.setdefault(o.data.materials[0].name,[]).append(o)
    for name,objects in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        objects[0].name=parent.name+'__'+name

if STAGE=='export':
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:o.select_set(True)
    bpy.context.view_layer.update()
    coords=[o.matrix_world@v.co for o in bpy.context.selected_objects if o.type=='MESH' for v in o.data.vertices]
    bounds={'min':[min((p.x,p.z,-p.y)[i] for p in coords) for i in range(3)],'max':[max((p.x,p.z,-p.y)[i] for p in coords) for i in range(3)]}
    for o in bpy.context.selected_objects:
        if o.type=='MESH':o.data.calc_loop_triangles()
    tris=sum(len(o.data.loop_triangles) for o in bpy.context.selected_objects if o.type=='MESH')
    path=ROOT/'public/models/ghost-aaa.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'public/models/ghost-aaa.blend'),compress=True)
    print('GHOST_AAA_EXPORTED',json.dumps({'bytes':path.stat().st_size,'triangles':tris,'materials':len(M),'meshBatches':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'bounds':bounds,'front':'+Z','up':'+Y','units':'meters','poseGroups':['head','leftHand','rightHand']}),flush=True)
else:
    # Preview is inspected first. Export is a separate deliberate stage.
    world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.045,.038,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65
    for pos,power,size,color in [((1.8,2.5,2.8),240,2,(.83,.92,1)),((-1.5,1.9,.8),110,2,(1,.87,.72)),((0,2.1,-1.6),180,1.6,(.66,.85,.73))]:
        bpy.ops.object.light_add(type='AREA',location=T(pos));o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color
        o.rotation_euler=(T((0,1.05,0))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=T((.45,1.15,3.8)));cam=bpy.context.object
    scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.render.resolution_x=900;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
    cam.rotation_euler=(T((0,.93,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=60
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'artifacts/ghost-aaa-front.png');bpy.ops.render.render(write_still=True)
    cam.location=T((-.30,1.70,1.15));cam.rotation_euler=(T((0,1.67,.02))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=85
    scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.filepath=str(ROOT/'artifacts/ghost-aaa-detail.png');bpy.ops.render.render(write_still=True)
    print('GHOST_AAA_PREVIEW_READY',flush=True)
