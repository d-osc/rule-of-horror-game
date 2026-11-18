import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const releases = join(root, 'releases');
const name = 'rule-of-horror-game';
const stageRoot = join(releases, 'stage');
const stage = join(stageRoot, name);
const zipPath = join(releases, `${name}.zip`);

/** Script files stay out of the distributed package entirely. */
const EXCLUDED = /\.(ps1|sh|bat)$/i;
// Full path: Git Bash's GNU tar shadows the Windows one and cannot write zip archives.
const BSDTAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');

rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(join(root, 'dist'), stage, { recursive: true, filter: (src) => !EXCLUDED.test(src) });

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const smuggled = walk(stage).filter((path) => EXCLUDED.test(path));
if (smuggled.length) throw new Error(`Script files reached the package: ${smuggled.join(', ')}`);

// Compress-Archive trips over transient AV locks on freshly written multi-MB files; bsdtar just reads.
try {
  execFileSync(BSDTAR, ['-a', '-cf', zipPath, '-C', stageRoot, name], { stdio: 'inherit' });
} catch {
  execFileSync(BSDTAR, ['-a', '-cf', zipPath, '-C', stageRoot, name], { stdio: 'inherit' });
}
rmSync(stageRoot, { recursive: true, force: true });

const entries = execFileSync(BSDTAR, ['-tf', zipPath]).toString().split('\n').filter(Boolean);
const bad = entries.filter((entry) => EXCLUDED.test(entry));
if (bad.length) throw new Error(`Script files reached the archive: ${bad.join(', ')}`);
const files = entries.filter((entry) => !entry.endsWith('/'));

const hash = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
writeFileSync(`${zipPath}.sha256`, `${hash}  ${name}.zip\n`);
console.log(`${name}.zip: ${(statSync(zipPath).size / 1048576).toFixed(1)} MB, ${files.length} files, sha256 ${hash.slice(0, 16)}…`);
