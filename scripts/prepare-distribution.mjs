import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { buildStandalone } from './make-standalone.mjs';

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
  'Rule of Horror\nHOW TO PLAY\n1. Extract the WHOLE folder out of the zip first.\n2. Easiest: double-click index.html. The whole game\n   (models, textures, sounds) is packed inside that one file, so it runs\n   straight from the folder in Chrome or Edge - no install, no internet.\n3. Alternative for Windows: PLAY-GAME.bat starts a tiny local server\n   and opens the game (keep the black window open while playing).\n4. Hosting online or on LAN: serve this folder over HTTP and open index.html,\n   e.g. python -m http.server 8080.\nPersonal non-commercial play only. See LICENSE.\n');

const standalone = await buildStandalone();
console.log(`Standalone build: ${standalone} (${(await readdir(dist)).length} entries in dist)`);
