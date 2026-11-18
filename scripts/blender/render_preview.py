"""Load exported runtime assets and render a material/scale proof sheet."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
placements=[('mirror',(-1.6,.8,0)),('sink',(-1.6,.8,0)),('shower',(.1,.8,0)),('door',(1.8,.8,0)),('towel-rack',(-.35,.8,0)),('bathtub',(-1.35,-1.1,0)),('ghost',(1.4,-.8,0))]
for name,pos in placements:
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models'/(name+'.glb')))
    for obj in list(bpy.context.selected_objects):
        if obj.parent is None:obj.location+=Vector(pos)

def material(name,col):
    m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);return m
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.035));bpy.context.object.data.materials.append(material('Charcoal floor',(.075,.085,.075)))
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,.92,1.4));bpy.context.object.dimensions=(5.6,.07,2.9);bpy.context.object.data.materials.append(material('Sage wall',(.18,.24,.20)))
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.21,.17,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
for loc,power,size in [((-3,-4,6),1500,5),((4,-2,4),1000,4),((0,2,4),750,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(4.4,-7.7,4.0));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=6.3
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=12
scene.render.resolution_x=1200;scene.render.resolution_y=840;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'scripts/blender/kit-preview.png')
bpy.ops.render.render(write_still=True)
print('PREVIEW_RENDERED',scene.render.filepath)
