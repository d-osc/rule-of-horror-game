"""Send one official Blender addon command over its loopback JSON socket."""
import argparse
import json
import socket
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--script', type=Path)
parser.add_argument('--code')
parser.add_argument('--port', type=int, default=9876)
args = parser.parse_args()
code = (f'__file__ = {str(args.script.resolve())!r}\n' + args.script.read_text(encoding='utf-8')) if args.script else args.code
command = {'type': 'execute_code', 'params': {'code': code}} if code else {'type': 'get_scene_info', 'params': {}}
with socket.create_connection(('127.0.0.1', args.port), timeout=10) as client:
    client.settimeout(180)
    client.sendall(json.dumps(command).encode('utf-8'))
    data = b''
    while True:
        chunk = client.recv(65536)
        if not chunk:
            raise RuntimeError('Bridge disconnected before replying')
        data += chunk
        try:
            response = json.loads(data.decode('utf-8'))
            break
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
    print(json.dumps(response, ensure_ascii=False, indent=2))
    if response.get('status') == 'error':
        raise SystemExit(1)
