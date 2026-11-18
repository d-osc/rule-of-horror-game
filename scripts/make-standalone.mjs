import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const dist = join(process.cwd(), 'dist');

const MIME = {
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

const inline = (path) => {
  const mime = MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(join(dist, path)).toString('base64')}`;
};

/** Model files the runtime loads (world.ts loadAssets placements; ghost.glb is an unused legacy export). */
const MODEL_FILES = [
  'dressing', 'mirror', 'sink', 'shower', 'towel-rack', 'bathtub', 'ghost-aaa',
  'bed', 'nightstand', 'wardrobe', 'tv', 'luggage-rack', 'door',
].map((name) => `models/${name}.glb`);

export function buildStandalone() {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');

  const scriptMatch = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
  if (!scriptMatch) throw new Error('Built module script tag not found in dist/index.html');
  const cssMatches = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g)];
  if (!cssMatches.length) throw new Error('Built stylesheet link not found in dist/index.html');

  const assets = {};
  for (const path of MODEL_FILES) assets[path] = inline(path);
  for (const file of readdirSync(join(dist, 'textures'))) {
    if (file.endsWith('.jpg')) assets[`textures/${file}`] = inline(`textures/${file}`);
  }
  assets['audio/screech.mp3'] = inline('audio/screech.mp3');
  for (const file of readdirSync(join(dist, 'audio/episode-01'))) {
    if (file.endsWith('.mp3')) assets[`audio/episode-01/${file}`] = inline(`audio/episode-01/${file}`);
  }

  let standalone = html;
  for (const match of cssMatches) {
    const cssPath = match[1];
    const cssDir = join(dist, cssPath, '..');
    const css = readFileSync(join(dist, cssPath), 'utf8').replace(
      /url\((['"]?)(\.\/[^'")]+?)\1\)/g,
      (whole, quote, path) => {
        // Built CSS lives in assets/, so bare ./ refs resolve against that folder first.
        for (const base of [cssDir, dist]) {
          const file = join(base, path.replace(/^.\//, ''));
          if (existsSync(file) && MIME[extname(path).toLowerCase()]) {
            const mime = MIME[extname(path).toLowerCase()];
            return `url(${quote}data:${mime};base64,${readFileSync(file).toString('base64')}${quote})`;
          }
        }
        return whole;
      },
    );
    // Replacement functions keep `$&`-style sequences in the payload from being interpreted.
    standalone = standalone.replace(match[0], () => `<style>\n${css}\n</style>`);
  }
  standalone = standalone.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
  for (const icon of ['branding/icon-32.png', 'branding/icon-180.png']) {
    if (existsSync(join(dist, icon))) standalone = standalone.replaceAll(`./${icon}`, inline(icon));
  }

  let js = readFileSync(join(dist, scriptMatch[1]), 'utf8');
  // Inlined into the document, import.meta.url becomes the page URL instead of /assets/,
  // so point the audio worker chunk at its real location for the HTTP-served case.
  const workerRef = js.match(/new\s+URL\(\s*(['"`])(audio-synthesis\.worker-[A-Za-z0-9_-]+\.js)\1\s*,\s*import\.meta\.url\s*\)\.href/);
  if (!workerRef) throw new Error('Audio worker URL reference not found in bundle');
  js = js.replace(workerRef[0], () => `"./assets/${workerRef[2]}"`);
  const bootstrap = `<script>window.__FILE_ASSETS__=${JSON.stringify(assets)};</script>`;
  standalone = standalone.replace(scriptMatch[0], () => `${bootstrap}\n<script type="module">\n${js}\n</script>`);

  const target = join(dist, 'index.html');
  writeFileSync(target, standalone);
  return target;
}
