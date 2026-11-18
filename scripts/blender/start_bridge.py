"""Start the official addon in a dedicated Blender GUI process.

Launch with PowerShell Start-Process -WindowStyle Hidden. Does not touch another
running Blender instance or save/change its scene. Addon preference persists.
"""
import bpy
import addon_utils
import os

os.environ['DISABLE_TELEMETRY'] = 'true'
addon_utils.enable('blender_mcp', default_set=True, persistent=True)
bpy.ops.wm.save_userpref()
import blender_mcp
server = getattr(bpy.types, 'blendermcp_server', None)
if server is None:
    server = blender_mcp.BlenderMCPServer(host='127.0.0.1', port=9876)
    bpy.types.blendermcp_server = server
server.start()
bpy.context.scene.blendermcp_server_running = bool(server.running)
print('RULE_HORROR_BRIDGE_READY', server.running, flush=True)
