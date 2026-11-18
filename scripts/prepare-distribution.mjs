import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const modelDirectory = new URL('models/', dist);
for (const file of await readdir(modelDirectory)) {
  if (/\.blend\d*$/.test(file)) await rm(new URL(file, modelDirectory));
}
for (const file of ['LICENSE', 'THIRD_PARTY_ASSETS.md']) {
  await copyFile(new URL(file, root), new URL(file, dist));
}
await mkdir(new URL('licenses/', dist), { recursive: true });
for (const [name, packagePath] of [
  ['three', 'three/LICENSE'],
  ['ibm-plex-sans-thai', '@fontsource/ibm-plex-sans-thai/LICENSE'],
  ['libre-caslon-display', '@fontsource/libre-caslon-display/LICENSE'],
]) {
  await copyFile(new URL('node_modules/' + packagePath, root), new URL('licenses/' + name + '.txt', dist));
}
await writeFile(new URL('START-HERE.txt', dist),
  'Rule of Horror\nServe this folder through HTTP to play.\nExample with Python installed: python -m http.server 8080\nThen open http://localhost:8080\nMobile players can use the HTTP address of the hosting computer on their local network.\nPersonal non-commercial play only. See LICENSE.\n');
