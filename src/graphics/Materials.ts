import * as T from 'three';
import { assetUrl } from '../game/fileAssets';

export class Materials {
  floor = new T.MeshPhysicalMaterial({
    color: '#bbb5a1',
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
  });
  wall = new T.MeshPhysicalMaterial({
    color: '#546e64',
    roughness: 0.48,
    clearcoat: 0.45,
    clearcoatRoughness: 0.28,
  });
  plaster = new T.MeshStandardMaterial({ color: '#a8a58e', roughness: 0.95 });
  dark = new T.MeshStandardMaterial({ color: '#17221e', roughness: 0.7, metalness: 0.12 });
  brass = new T.MeshStandardMaterial({ color: '#7e6541', metalness: 0.86, roughness: 0.35 });
  carpet = new T.MeshStandardMaterial({ color: '#8f887c', roughness: 0.9 });
  ready: Promise<void>;
  constructor() {
    this.ready = Promise.all([
      this.loadSet(this.floor, 'interior_tiles', 3.5, 3.5, 0.5),
      this.loadSet(this.wall, 'long_white_tiles', 3.5, 0.725, 0.65),
      this.loadSet(this.plaster, 'worn_plaster_wall', 2.8, 0.72, 0.45),
      this.loadSet(this.carpet, 'bedroom_carpet', 3.5, 4, 0.5),
    ]).then(() => {});
  }
  private async loadSet(
    mat: T.MeshStandardMaterial,
    asset: string,
    rx: number,
    ry: number,
    normal: number,
  ) {
    const loader = new T.TextureLoader();
    const maps = await Promise.all(
      ['diffuse', 'nor_gl', 'rough', 'ao'].map(async (role) => {
        const t = await loader.loadAsync(
          assetUrl(`textures/${asset}_${role}.jpg`),
        );
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.repeat.set(rx, ry);
        t.anisotropy = 8;
        t.colorSpace = role === 'diffuse' ? T.SRGBColorSpace : T.NoColorSpace;
        return t;
      }),
    );
    [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap] = maps;
    mat.normalScale.set(normal, normal);
    mat.aoMapIntensity = 0.8;
    mat.needsUpdate = true;
  }
  polishImported(root: T.Object3D) {
    root.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!(m instanceof T.MeshStandardMaterial)) continue;
        m.envMapIntensity = 0.6;
        if (/brass|nickel|iron/i.test(m.name)) {
          m.roughness = Math.max(0.3, m.roughness);
          m.envMapIntensity = 0.9;
        }
        if (/porcelain|ivory_glaze|ceramic/i.test(m.name)) {
          m.roughness = 0.19;
          m.envMapIntensity = 0.75;
        }
        if (/skin/i.test(m.name)) {
          m.color.set('#9ba79b');
          m.roughness = 0.7;
        }
        if (/hair/i.test(m.name)) {
          m.color.set('#101613');
          m.roughness = 0.35;
        }
      }
    });
  }
}

export function grimeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!;
  let seed = 8651;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 95; i++) {
    const x = rand() * 512,
      y = rand() * 400,
      w = 10 + rand() * 70,
      h = 30 + rand() * 180;
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(w, h));
    g.addColorStop(0, 'rgba(13,21,15,.2)');
    g.addColorStop(1, 'rgba(13,21,15,0)');
    c.fillStyle = g;
    c.save();
    c.translate(x, y);
    c.scale(w / h, 1);
    c.fillRect(-h, -h, h * 2, h * 3);
    c.restore();
  }
  for (let i = 0; i < 100; i++) {
    const x = rand() * 512;
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, 'rgba(34,35,23,.3)');
    g.addColorStop(0.8, 'rgba(34,35,23,0)');
    c.fillStyle = g;
    c.fillRect(x, 0, 1 + rand() * 3, 100 + rand() * 412);
  }
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
