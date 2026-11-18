import * as T from 'three';
import { agedPaper } from '../graphics/AgedPaper';
import type { Scene } from './story';

function seededRandom(seed: number) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

let timberMap: T.CanvasTexture | undefined;
let ruleMap: T.CanvasTexture | undefined;

function timberTexture() {
  if (timberMap) return timberMap;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(76);
  ctx.fillStyle = '#b2a495';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 980; i++) {
    const x = random() * 256;
    const y = random() * 256;
    const w = 2 + random() * 65;
    ctx.fillStyle = i % 4 ? '#4a342328' : '#ece2cc50';
    ctx.fillRect(x, y, w, 0.6 + random());
    if (x + w > 256) ctx.fillRect(x - 256, y, w, 1);
  }
  timberMap = new T.CanvasTexture(canvas);
  timberMap.colorSpace = T.SRGBColorSpace;
  timberMap.anisotropy = 4;
  return timberMap;
}

function rulesTexture() {
  if (ruleMap) return ruleMap;
  const canvas = agedPaper(1);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#443728c0';
  ctx.font = 'bold 34px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('ฝากคนเฝ้าเล้า', 29, 80);
  ctx.font = '23px "IBM Plex Sans Thai", sans-serif';
  for (const [i, line] of [
    'เตรียมย่ามและตะเกียง',
    'ระวังเสียงที่เล้าตอนสามทุ่ม',
    'พักได้หลังสี่ทุ่ม',
    'ออกไปก่อนเที่ยงคืน',
    'เอาห่อยาเส้นไปให้ชายแก่',
  ].entries())
    ctx.fillText(line, 29, 155 + i * 52);
  ruleMap = new T.CanvasTexture(canvas);
  ruleMap.colorSpace = T.SRGBColorSpace;
  return ruleMap;
}

export function scenery(kind: Scene, beat: number) {
  const scene = new T.Scene();
  const day = kind === 'house' || kind === 'dawn';
  const road = kind === 'road' || kind === 'station';
  scene.background = new T.Color(day ? '#8a7975' : '#101b24');
  scene.fog = new T.FogExp2(scene.background, 0.034);
  const material = (color: string) => new T.MeshStandardMaterial({ color });
  const wood = new T.MeshStandardMaterial({ color: '#675442', map: timberTexture() }),
    trim = new T.MeshStandardMaterial({ color: '#94755a', map: timberTexture(), roughness: 0.91 }),
    roof = material('#495350');
  const plants = material('#304639'),
    ground = material(road ? '#29352d' : '#384834');
  const boxGeometry = new T.BoxGeometry();
  function box(x: number, y: number, z: number, w: number, h: number, d: number, mat: T.Material) {
    const mesh = new T.Mesh(boxGeometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    scene.add(mesh);
    return mesh;
  }
  function shelter(x: number, z: number, width: number, enclosed = false) {
    box(x, 0.48, z, width, 0.16, 3.5, wood);
    for (const side of [-1, 1]) {
      for (const depth of [-1, 1])
        box(x + side * (width / 2 - 0.12), 1.4, z + depth * 1.6, 0.17, 2.8, 0.17, trim);
      const slope = box(x + side * width * 0.26, 2.89, z, width * 0.61, 0.1, 4.2, roof);
      slope.rotation.z = -side * 0.27;
      if (enclosed) box(x + side * width * 0.48, 1.55, z, 0.1, 2, 3.3, wood);
    }
    for (let i = 0; i < 12; i++)
      box(
        x - width / 2 + ((i + 0.5) * width) / 12,
        0.57,
        z,
        width / 12 - 0.015,
        0.03,
        3.4,
        i % 3 ? trim : wood,
      );
    if (enclosed) box(x, 1.55, z - 1.65, width, 2, 0.12, wood);
    for (let i = 0; i < 3; i++) box(x, 0.09 + i * 0.15, z + 2 - i * 0.19, 1, 0.15, 0.35, trim);
  }
  function silhouette(x: number, z: number, cloth: string, skin: string, bent = false) {
    const body = box(x, bent ? 0.85 : 1.06, z, 0.43, 0.7, 0.25, material(cloth));
    if (bent) body.rotation.x = 0.42;
    const head = new T.Mesh(new T.SphereGeometry(0.15, 20, 12), material(skin));
    head.scale.y = 1.25;
    head.position.set(x, bent ? 1.27 : 1.58, z + (bent ? 0.16 : 0));
    scene.add(head);
    for (const s of [-1, 1]) {
      box(x + s * 0.11, 0.37, z, 0.15, 0.74, 0.16, material('#262b28'));
      box(x + s * 0.26, 0.94, z, 0.11, 0.55, 0.11, material(skin)).rotation.z = s * 0.12;
    }
  }
  box(0, -0.19, -13, 120, 0.3, 120, ground);
  scene.add(new T.HemisphereLight(day ? '#f8cba1' : '#708fa1', '#343226', day ? 1.8 : 0.8));
  const lamp = new T.SpotLight(day ? '#ffd6ad' : '#ffd5a0', day ? 95 : 230, 32, 0.66, 0.88);
  lamp.name = 'player-light';
  lamp.position.set(0, road ? 1.1 : 1.75, 2);
  lamp.target.position.set(0, 0.9, -7);
  scene.add(lamp, lamp.target);
  const rand = seededRandom(174);
  const trees = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), plants, 200);
  const trunks = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.24, 5, 5), wood, 100);
  const tree = new T.Object3D();
  for (let i = 0; i < trunks.count; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * ((road ? 4 : 13) + rand() * 28);
    const z = -rand() * 44;
    const height = 2.4 + rand() * 1.6;
    tree.position.set(x, height / 2, z);
    tree.scale.set(1, height / 3.4, 1);
    tree.updateMatrix();
    trunks.setMatrixAt(i, tree.matrix);
    for (let crown = 0; crown < 2; crown++) {
      tree.position.set(x + crown * 0.65, height + crown * 0.7, z - crown * 0.8);
      tree.scale.set(1.1 + rand() * 1.7, 1.05 + rand() * 1.35, 1.3 + rand() * 1.75);
      tree.updateMatrix();
      trees.setMatrixAt(i * 2 + crown, tree.matrix);
    }
  }
  scene.add(trunks, trees);
  const cabin = new T.Group();
  cabin.name = 'cabin';
  scene.add(cabin);
  if (road) {
    const asphalt = material('#353937'),
      paint = material('#bead78');
    box(0, -0.027, -20, 6, 0.05, 57, asphalt);
    for (let i = 0; i < 16; i++) box(0, 0, 1 - i * 3.3, 0.09, 0.012, 1.4, paint);
    const dash = material('#222927');
    const frame = material('#211f1a');
    cabin.add(box(0, 0.47, 1.75, 2.7, 0.25, 1.05, dash));
    cabin.add(box(0, 2.06, 1.75, 2.7, 0.1, 0.48, frame));
    for (const side of [-1, 1]) {
      const pillar = box(side * 1.25, 1.36, 1.7, 0.1, 1.38, 0.18, frame);
      pillar.rotation.z = side * 0.13;
      cabin.add(pillar);
    }
    const wheel = new T.Mesh(new T.TorusGeometry(0.27, 0.035, 8, 32), frame);
    wheel.position.set(-0.69, 0.78, 2.0);
    wheel.rotation.x = -0.35;
    cabin.add(wheel);
    const warning = box(0.32, 0.611, 1.59, 0.25, 0.012, 0.22, material('#b3a47c'));
    warning.rotation.y = 0.2;
    cabin.add(warning);
    cabin.add(box(0.66, 0.83, 1.97, 0.36, 0.15, 0.13, frame));
    cabin.add(
      box(0.69, 0.83, 2.045, 0.25, 0.033, 0.016, new T.MeshBasicMaterial({ color: '#8d6550' })),
    );
    if (kind === 'station') {
      box(3.2, 3.1, -8, 9, 0.24, 6, trim);
      for (const x of [0.4, 6]) box(x, 1.5, -8, 0.22, 3, 0.22, roof);
      for (const x of [2, 4]) box(x, 0.65, -8, 0.6, 1.3, 0.5, paint);
      const stationLight = new T.PointLight('#ffe0ac', 65, 18);
      stationLight.position.set(3, 2.8, -8);
      scene.add(stationLight);
    } else if (beat === 1) {
      box(-3.2, 0.65, -7, 0.15, 1.3, 0.15, trim);
      box(-3.2, 1.3, -7, 0.95, 0.7, 0.5, wood);
      box(-3.2, 1.36, -6.74, 0.57, 0.46, 0.025, frame);
      for (const side of [-1, 1])
        box(-3.2 + side * 0.25, 1.73, -7, 0.66, 0.12, 0.78, roof).rotation.z = -side * 0.48;
    } else if (beat === 3) {
      silhouette(2.35, -4, '#75614a', '#75614a');
      silhouette(1.48, -9, '#75614a', '#75614a');
    } else if (beat === 4) box(0, -0.005, -8, 16, 0.06, 4, asphalt);
  } else {
    const paddy = new T.MeshStandardMaterial({
      color: '#273c37',
      metalness: 0.24,
      roughness: 0.26,
    });
    for (const x of [-6, 6]) box(x, -0.018, -14, 10, 0.04, 36, paddy);
    box(0, 0.015, -6, 2.15, 0.17, 26, material('#534c37'));
    const blades = new T.BufferGeometry();
    const positions: number[] = [];
    for (let blade = 0; blade < 7; blade++) {
      const angle = blade * 2.4;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      positions.push(
        z * 0.018,
        0,
        -x * 0.018,
        -z * 0.018,
        0,
        x * 0.018,
        x * 0.17,
        0.27 + rand() * 0.24,
        z * 0.17,
      );
    }
    blades.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    blades.computeVertexNormals();
    const rice = new T.InstancedMesh(
      blades,
      new T.MeshStandardMaterial({ color: '#435139', side: T.DoubleSide }),
      480,
    );
    for (let i = 0; i < rice.count; i++) {
      const n = i % 240;
      tree.position.set(
        (i < 240 ? -1 : 1) * (1.4 + (n % 12) * 0.68 + rand() * 0.25),
        0.01,
        -Math.floor(n / 12) * 1.45 + rand() * 0.27,
      );
      tree.scale.setScalar(0.8 + rand() * 0.4);
      tree.rotation.y = rand() * Math.PI;
      tree.updateMatrix();
      rice.setMatrixAt(i, tree.matrix);
    }
    scene.add(rice);
    if (kind === 'house' || kind === 'dawn') shelter(0, -7, 6, true);
    else if (kind === 'hut') {
      shelter(0, -4.5, 4.7, true);
      box(0, 2.58, -3.03, 4.49, 0.17, 0.14, trim);
      const mat = new T.MeshStandardMaterial({ color: '#867951', map: timberTexture() });
      box(-0.65, 0.609, -3.6, 0.73, 0.05, 1.23, mat);
      const pillow = new T.Mesh(new T.SphereGeometry(1, 18, 10), material('#8e8170'));
      pillow.scale.set(0.31, 0.07, 0.17);
      pillow.position.set(-0.65, 0.648, -4.02);
      scene.add(pillow);
      const rule = new T.Mesh(
        new T.PlaneGeometry(0.23, 0.31),
        new T.MeshStandardMaterial({ map: rulesTexture(), roughness: 0.98 }),
      );
      rule.position.set(0.7, 2.46, -2.95);
      rule.rotation.z = -0.065;
      scene.add(rule);
      const cloth = new T.MeshStandardMaterial({
        color: '#63563b',
        map: timberTexture(),
        roughness: 0.99,
      });
      const profile = [
        [0, 0],
        [0.13, 0],
        [0.17, 0.07],
        [0.16, 0.19],
        [0.12, 0.28],
        [0.07, 0.31],
        [0, 0.31],
      ];
      const bag = new T.Mesh(
        new T.LatheGeometry(
          profile.map(([radius, height]) => new T.Vector2(radius, height)),
          16,
        ),
        cloth,
      );
      bag.position.set(0.53, 0.59, -3.5);
      bag.scale.z = 0.69;
      scene.add(bag);
      box(0.53, 0.78, -3.39, 0.024, 0.11, 0.018, material('#352c20'));
      const strap = new T.Mesh(
        new T.TubeGeometry(
          new T.QuadraticBezierCurve3(
            new T.Vector3(0.39, 0.8, -3.5),
            new T.Vector3(0.5, 1.16, -3.51),
            new T.Vector3(0.67, 0.8, -3.5),
          ),
          14,
          0.012,
          5,
          false,
        ),
        material('#55422c'),
      );
      scene.add(strap);
      const brass = new T.MeshStandardMaterial({
        color: '#574032',
        metalness: 0.54,
        roughness: 0.43,
      });
      const lanternPart = (
        height: number,
        radius: number,
        thickness: number,
        surface: T.Material,
      ) => {
        const part = new T.Mesh(new T.CylinderGeometry(radius, radius, thickness, 12), surface);
        part.position.set(0.97, height, -3.43);
        scene.add(part);
      };
      lanternPart(0.62, 0.105, 0.07, brass);
      lanternPart(0.75, 0.058, 0.19, new T.MeshBasicMaterial({ color: '#f9ab56' }));
      lanternPart(0.86, 0.088, 0.04, brass);
      for (const side of [-1, 1]) box(0.97 + side * 0.077, 0.74, -3.41, 0.015, 0.22, 0.017, brass);
      const glow = new T.PointLight('#ffb66d', 4, 5);
      glow.position.set(0.96, 0.76, -3.32);
      scene.add(glow);
    } else if (kind === 'coop') {
      shelter(1, -6, 3.7);
      for (let i = 0; i < 14; i++) box(-0.7 + i * 0.26, 1, -4.2, 0.09, 1.2, 0.07, trim);
      if (beat === 9) silhouette(0.2, -3.6, '#796e65', '#9a8771', true);
      if (beat === 10) {
        box(0.8, 0.7, 4, 0.09, 1.4, 0.09, trim);
        box(0.8, 1.45, 4, 0.16, 0.23, 0.16, new T.MeshBasicMaterial({ color: '#ffc779' }));
      }
    } else {
      shelter(-5, -12, 4);
      silhouette(0.2, beat >= 14 ? -2.5 : -5, '#51594a', '#8d7960');
      if (beat === 13) {
        box(0.45, 0.31, 0.45, 0.16, 0.52, 0.13, material('#8c806c')).rotation.z = -0.6;
        for (let i = 0; i < 4; i++)
          box(0.29 + i * 0.05, 0.53, 0.46, 0.028, 0.15, 0.032, material('#8c806c')).rotation.z =
            -0.4;
      }
    }
  }
  return scene;
}
