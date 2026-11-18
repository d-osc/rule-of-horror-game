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

  // Asset URLs carry the deploy base (`./` locally, `/repo-name/` on Pages); capture only the dist-relative tail.
  const scriptMatch = html.match(/<script type="module"[^>]*src="[^"]*?(assets\/[^"]+\.js)"[^>]*><\/script>/);
  if (!scriptMatch) throw new Error('Built module script tag not found in dist/index.html');
  const cssMatches = [...html.matchAll(/<link rel="stylesheet"[^>]*href="[^"]*?(assets\/[^"]+\.css)"[^>]*>/g)];
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
      /url\((['"]?)([^'")]+?)\1\)/g,
      (whole, quote, path) => {
        // Candidates cover `./name.woff2` (relative to the CSS file in assets/),
        // `./assets/x`, and `/deploy-base/assets/x` from absolute-base builds.
        const bare = path.replace(/^\.\//, '');
        const candidates = [
          join(dist, bare),
          join(dist, path.replace(/^.*?assets\//, 'assets/')),
          join(cssDir, bare),
        ];
        const file = candidates.find((c) => existsSync(c) && MIME[extname(c).toLowerCase()]);
        if (!file) return whole;
        const mime = MIME[extname(file).toLowerCase()];
        return `url(${quote}data:${mime};base64,${readFileSync(file).toString('base64')}${quote})`;
      },
    );
    // Replacement functions keep `$&`-style sequences in the payload from being interpreted.
    standalone = standalone.replace(match[0], () => `<style>\n${css}\n</style>`);
  }
  standalone = standalone.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
  for (const icon of ['branding/icon-32.png', 'branding/icon-180.png']) {
    if (!existsSync(join(dist, icon))) continue;
    const uri = inline(icon);
    standalone = standalone.replace(new RegExp(`[^'"]*${icon.split('/')[1]}(?=['"])`, 'g'), () => uri);
  }

  let js = readFileSync(join(dist, scriptMatch[1]), 'utf8');
  // Inlined into the document, import.meta.url becomes the page URL instead of /assets/,
  // so point the audio worker chunk at its real location for the HTTP-served case.
  // Vite emits either `new URL('audio-synthesis.worker-X.js', import.meta.url)` (relative base)
  // or `new URL('/base/assets/audio-synthesis.worker-X.js', import.meta.url)` (absolute base);
  // rewrite the URL string literal to a dist-relative './assets/...' in both.
  const workerName = js.match(/audio-synthesis\.worker-[A-Za-z0-9_-]+\.js/);
  if (!workerName) throw new Error('Audio worker chunk reference not found in bundle');
  const workerLiteral = new RegExp(`(['"\`])[^'"\`]*${workerName[0]}[^'"\`]*\\1`);
  if (!workerLiteral.test(js)) throw new Error('Audio worker URL string literal not found in bundle');
  js = js.replace(workerLiteral, () => `"./assets/${workerName[0]}"`);
  const bootstrap = `<script>window.__FILE_ASSETS__=${JSON.stringify(assets)};</script>`;
  standalone = standalone.replace(scriptMatch[0], () => `${bootstrap}\n<script type="module">\n${js}\n</script>`);

  const target = join(dist, 'index.html');
  writeFileSync(target, standalone);
  return target;
}
