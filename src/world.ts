import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RULES, type Action } from './game/rules';
import { assetUrl } from './game/fileAssets';
import { Materials } from './graphics/Materials';
import { Atmosphere } from './graphics/Atmosphere';
import { WaterParticles } from './graphics/WaterParticles';
import { agedPaper } from './graphics/AgedPaper';

export interface Hotspot {
  action: Action;
  label: string;
  position: T.Vector3;
  radius: number;
}
export class HotelWorld {
  scene = new T.Scene();
  hotspots: Hotspot[] = [];
  ghost = (() => {
    const g = new T.Group();
    // YXZ so the overhead reveal pitches the face down after the yaw flip.
    g.rotation.order = 'YXZ';
    return g;
  })();
  water: T.Mesh;
  bathWater: T.Mesh;
  light: T.PointLight;
  showerLight: T.PointLight;
  rain: T.Mesh;
  private waterFx: WaterParticles;
  colliders: T.Box3[] = [];
  assetsReady: Promise<void>;
  assetErrors: string[] = [];
  private towel = new T.Group();
  private bag = new T.Group();
  private hair = new T.Group();
  private bedLamp: T.PointLight;
  private seamMat: T.MeshStandardMaterial;
  private rng = 123;
  private materials = new Materials();
  private atmosphere: Atmosphere;
  private staticParts: T.Mesh[] = [];
  private bathLevel = 0;
  private fillingBath = false;
  private reflector: Reflector;
  private ghostHead?: T.Object3D;
  private ghostHeadBase = new T.Quaternion();
  private motionRotation = new T.Quaternion();
  private zAxis = new T.Vector3(0, 0, 1);
  private deathTimer = -1;
  private bathroomHinge = new T.Group();
  private bathroomOpen = true;
  private random() {
    this.rng = (this.rng * 1664525 + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }
  constructor() {
    this.scene.background = new T.Color('#121c19');
    this.scene.fog = new T.FogExp2('#101b17', 0.033);
    const { floor: floorMat, wall: wallMat, plaster: plasterMat, dark, brass } = this.materials;
    const paint = new T.MeshStandardMaterial({ color: '#4c4438', roughness: 0.9 });
    const bedroomCeil = new T.MeshStandardMaterial({ color: '#344038', roughness: 1 });
    this.box(7, 0.12, 7, floorMat, 0, -0.06, 0);
    this.box(7, 0.12, 8, this.materials.carpet, 0, -0.06, 7.5);
    this.box(7, 0.1, 8, bedroomCeil, 0, 3.27, 7.5);
    for (const side of [-1, 1]) {
      this.box(0.15, 1.45, 7, wallMat, side * 3.55, 0.72, 0);
      this.box(0.15, 1.8, 7, plasterMat, side * 3.55, 2.35, 0);
      this.box(0.08, 0.08, 7, brass, side * 3.45, 1.47, 0);
      this.box(0.12, 0.16, 7, dark, side * 3.45, 0.08, 0);
      this.box(0.22, 0.18, 7, dark, side * 3.4, 3.13, 0);
    }
    this.box(7, 1.45, 0.15, wallMat, 0, 0.72, -3.55);
    this.box(7, 1.8, 0.15, plasterMat, 0, 2.35, -3.55);
    this.box(7, 0.08, 0.08, brass, 0, 1.47, -3.45);
    this.box(7, 0.16, 0.12, dark, 0, 0.08, -3.45);
    this.box(7, 0.18, 0.22, dark, 0, 3.13, -3.4);
    this.southWall(wallMat, plasterMat, brass, dark);
    this.bedroomWalls(paint, plasterMat, brass, dark);
    this.box(7, 1.45, 0.15, wallMat, 0, 0.72, 11.55);
    this.box(7, 1.8, 0.15, plasterMat, 0, 2.35, 11.55);
    this.box(7, 0.08, 0.08, brass, 0, 1.47, 11.45);
    this.box(7, 0.16, 0.12, dark, 0, 0.08, 11.45);
    this.box(7, 0.18, 0.22, dark, 0, 3.13, 11.4);
    this.box(7, 0.1, 7, new T.MeshStandardMaterial({ color: '#344038', roughness: 1 }), 0, 3.27, 0);
    this.box(
      2.1,
      0.055,
      2.1,
      new T.MeshStandardMaterial({ color: '#b4b4a3', roughness: 0.27 }),
      2.35,
      0.027,
      -2.38,
    );
    this.box(2.1, 0.1, 0.12, brass, 2.35, 0.06, -1.29);
    const glass = new T.MeshPhysicalMaterial({
      color: '#a2bab0',
      transparent: true,
      opacity: 0.15,
      roughness: 0.16,
      side: T.DoubleSide,
      depthWrite: false,
    });
    this.box(0.035, 2.45, 1.5, glass, 1.25, 1.23, -2.7);
    this.box(0.035, 2.45, 0.035, brass, 1.25, 1.23, -1.95);
    this.box(0.5, 0.01, 0.38, brass, 2.3, 0.055, -2.35);
    for (let i = 0; i < 7; i++) this.box(0.012, 0.012, 0.25, dark, 2.12 + i * 0.055, 0.065, -2.35);
    this.box(1.5, 0.02, 0.04, brass, 2.2, 2.55, -1.5);
    this.atmosphere = new Atmosphere(this.scene, brass);
    this.rulePages();
    const spots: [Action, string, number, number, number, number][] = [
      ['note', 'อ่านข้อปฏิบัติหลังเที่ยงคืน', -1.76, 1.55, -3.473, 0.4],
      ['bath', 'เปิดน้ำเติมอ่าง / ลงแช่', -2.65, 0.85, -0.55, 0.7],
      ['shower', 'เปิด / ปิดฝักบัว', 2.2, 1.2, -3.12, 0.5],
      ['heater', 'ปรับอุณหภูมิน้ำ', 2.8, 1.65, -3.3, 0.28],
      ['rinse', 'ล้างสบู่ออกจากตา', 2.15, 2.08, -2.85, 0.5],
      ['door', 'เปิด / ปิดประตูห้องน้ำ', 0, 1.2, 3.55, 0.8],
      ['towel', 'หยิบผ้าขนหนู', 3.25, 1.2, 0.5, 0.5],
      ['bag', 'เก็บกระเป๋าและของใช้ส่วนตัว', 1.55, 0.62, 4.6, 0.5],
      ['exit', 'เปิดประตูห้อง 316 ออกไป', 0, 1.2, 11.2, 0.8],
    ];
    for (const [action, label, x, y, z, radius] of spots)
      this.hotspots.push({ action, label, position: new T.Vector3(x, y, z), radius });
    const bottleMat = new T.MeshStandardMaterial({ color: '#adad83', roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      this.box(0.065, 0.16, 0.065, bottleMat, 1.43 + i * 0.12, 1.01, 4.6, this.bag);
      this.box(0.038, 0.035, 0.038, dark, 1.43 + i * 0.12, 1.105, 4.6, this.bag);
    }
    this.box(0.9, 0.48, 0.45, dark, 1.55, 0.69, 4.6, this.bag);
    this.box(0.45, 0.07, 0.07, brass, 1.55, 0.96, 4.6, this.bag);
    this.scene.add(this.bag);
    this.label('HOT  ·  COLD', 0.36, 0.13, 2.8, 1.9, -3.38, 0);
    this.box(0.26, 0.43, 0.06, dark, 2.8, 1.6, -3.4);
    this.scene.add(new T.HemisphereLight('#a7b9ac', '#11130e', 0.18));
    const key = new T.SpotLight('#e4d8a4', 24, 12, 0.95, 0.7, 2);
    key.position.set(-0.8, 2.9, -1.4);
    key.target.position.set(-0.8, 0.2, -2.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.far = 15;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.018;
    this.scene.add(key, key.target);
    this.light = new T.PointLight('#ffe2a9', 9, 8, 2);
    this.light.position.set(-0.8, 2.4, -2.7);
    this.scene.add(this.light);
    this.showerLight = new T.PointLight('#b2d6cf', 13, 9, 2);
    this.showerLight.position.set(2.3, 2.8, -2);
    this.scene.add(this.showerLight);
    const front = new T.PointLight('#d1aa70', 5, 8, 2);
    front.position.set(0, 2.7, 2.2);
    this.scene.add(front);
    const moon = new T.SpotLight('#9fb8c8', 10, 8, 0.6, 0.5, 1.6);
    moon.position.set(5.5, 4.2, 7.2);
    moon.target.position.set(0.6, 0, 7.2);
    this.scene.add(moon, moon.target);
    this.bedLamp = new T.PointLight('#ffd9a0', 6, 7, 2);
    this.bedLamp.position.set(-2.9, 1.15, 6.1);
    this.scene.add(this.bedLamp);
    const bedFill = new T.PointLight('#c9a26a', 3, 9, 2);
    bedFill.position.set(0, 2.9, 8.5);
    this.scene.add(bedFill);
    this.seamMat = new T.MeshStandardMaterial({
      color: '#3a2c18',
      emissive: '#d8b06a',
      emissiveIntensity: 1.1,
      roughness: 0.6,
    });
    this.box(1.0, 0.02, 0.03, this.seamMat, 0, 0.012, 11.32);
    for (const x of [-1.65, 0.05]) {
      this.box(0.09, 0.4, 0.11, brass, x, 2.12, -3.35);
      this.box(
        0.13,
        0.32,
        0.13,
        new T.MeshStandardMaterial({
          color: '#e9dab3',
          emissive: '#efb95c',
          emissiveIntensity: 1.5,
        }),
        x,
        2.2,
        -3.22,
      );
    }
    const reflector = new Reflector(new T.CircleGeometry(1, 96), {
      textureWidth: 768,
      textureHeight: 768,
      color: 0x8b9e92,
    });
    this.reflector = reflector;
    const layered = reflector as Reflector & {
      _getReflectionCamera: (camera: T.Camera) => T.Camera;
    };
    const reflectionCamera = layered._getReflectionCamera.bind(layered);
    layered._getReflectionCamera = (camera) => {
      const result = reflectionCamera(camera);
      result.layers.enable(1);
      return result;
    };
    reflector.scale.set(0.364, 0.479, 1);
    reflector.position.set(-0.8, 1.7, -3.36);
    const reflect = reflector.onBeforeRender.bind(reflector);
    reflector.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      if (!scene.overrideMaterial) reflect(renderer, scene, camera, geometry, material, group);
    };
    this.scene.add(reflector);
    this.water = new T.Mesh(
      new T.PlaneGeometry(1.7, 1.5),
      this.atmosphere.waterMaterial('#3c5147'),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(2.25, 0.08, -2.45);
    this.scene.add(this.water);
    this.bathWater = new T.Mesh(
      new T.PlaneGeometry(0.64, 1.45),
      this.atmosphere.waterMaterial('#698679', new T.Vector2(0.32, 0.725)),
    );
    this.bathWater.rotation.x = -Math.PI / 2;
    this.bathWater.position.set(-2.93, 0.52, -0.55);
    this.bathWater.visible = false;
    this.scene.add(this.bathWater);
    this.waterFx = new WaterParticles(this.scene);
    this.rain = this.waterFx.drops;
    this.colliders.push(
      new T.Box3(new T.Vector3(-3.4, 0, 1.1), new T.Vector3(-2.25, 1.5, 2)),
      new T.Box3(new T.Vector3(-3.08, 0, 1.91), new T.Vector3(-2.2, 1.5, 2.48)),
      new T.Box3(new T.Vector3(-3.5, 0, -1.65), new T.Vector3(-2.15, 1.3, 0.55)),
      new T.Box3(new T.Vector3(-1.3, 0, -3.5), new T.Vector3(-0.3, 1.2, -2.7)),
      new T.Box3(new T.Vector3(1.15, 0, -3.5), new T.Vector3(1.34, 2.5, -1.94)),
      new T.Box3(new T.Vector3(1.1, 0, 4.3), new T.Vector3(2.0, 0.6, 4.9)),
      new T.Box3(new T.Vector3(-3.5, 0, 6.35), new T.Vector3(-1.35, 0.7, 8.05)),
      new T.Box3(new T.Vector3(-3.45, 0, 5.8), new T.Vector3(-2.9, 0.7, 6.4)),
      new T.Box3(new T.Vector3(2.9, 0, 8.3), new T.Vector3(3.46, 0.7, 9.7)),
      new T.Box3(new T.Vector3(-3.45, 0, 9.5), new T.Vector3(-2.8, 2.2, 10.72)),
      new T.Box3(new T.Vector3(-1.15, 0, 3.35), new T.Vector3(-0.45, 2.1, 4.75)),
    );
    const hairMat = new T.MeshStandardMaterial({ color: '#11150f', roughness: 0.7 });
    for (let i = 0; i < 48; i++) {
      const x = 1.97 + this.random() * 0.46,
        z = -2.8 + this.random() * 0.3;
      const curve = new T.QuadraticBezierCurve3(
        new T.Vector3(x, 2.15, z),
        new T.Vector3(x + 0.03, 1.2, z + 0.04),
        new T.Vector3(x - 0.035, 0.5 + this.random() * 0.6, z),
      );
      this.hair.add(
        new T.Mesh(
          new T.TubeGeometry(curve, 16, 0.0016 + this.random() * 0.001, 3, false),
          hairMat,
        ),
      );
    }
    this.hair.visible = false;
    this.scene.add(this.hair);
    const hairParts = this.hair.children.map((o) => (o as T.Mesh).geometry);
    const merged = mergeGeometries(hairParts);
    this.hair.clear();
    this.hair.add(new T.Mesh(merged, hairMat));
    hairParts.forEach((g) => g.dispose());
    this.assetsReady = Promise.all([this.loadAssets(), this.materials.ready]).then(() =>
      this.mergeStatic(),
    );
  }
  private southWall(
    wallMat: T.Material,
    plasterMat: T.Material,
    brass: T.Material,
    dark: T.Material,
  ) {
    const half = 2.015;
    for (const x of [-half, half]) {
      this.box(2.97, 1.45, 0.15, wallMat, x, 0.72, 3.55);
      this.box(2.97, 1.8, 0.15, plasterMat, x, 2.35, 3.55);
      this.box(2.97, 0.08, 0.08, brass, x, 1.47, 3.45);
      this.box(2.97, 0.16, 0.12, dark, x, 0.08, 3.45);
    }
    this.box(1.06, 0.85, 0.15, plasterMat, 0, 2.825, 3.55);
    this.box(7, 0.18, 0.22, dark, 0, 3.13, 3.4);
  }
  private bedroomWalls(
    paint: T.Material,
    plasterMat: T.Material,
    brass: T.Material,
    dark: T.Material,
  ) {
    const glass = new T.MeshPhysicalMaterial({
      color: '#16232c',
      transparent: true,
      opacity: 0.55,
      roughness: 0.25,
    });
    const night = new T.MeshStandardMaterial({
      color: '#101a26',
      emissive: '#1d2c3d',
      emissiveIntensity: 0.55,
      roughness: 1,
    });
    this.box(0.15, 1.45, 8, paint, -3.55, 0.72, 7.5);
    this.box(0.15, 1.8, 8, plasterMat, -3.55, 2.35, 7.5);
    this.box(0.08, 0.08, 8, brass, -3.45, 1.47, 7.5);
    this.box(0.12, 0.16, 8, dark, -3.45, 0.08, 7.5);
    this.box(0.22, 0.18, 8, dark, -3.4, 3.13, 7.5);
    this.box(0.12, 0.16, 8, dark, 3.45, 0.08, 7.5);
    this.box(0.22, 0.18, 8, dark, 3.4, 3.13, 7.5);
    this.box(0.08, 0.08, 3.2, brass, 3.45, 1.47, 5.1);
    this.box(0.08, 0.08, 3.8, brass, 3.45, 1.47, 9.6);
    this.box(0.15, 1.45, 3.2, paint, 3.55, 0.72, 5.1);
    this.box(0.15, 1.8, 3.2, plasterMat, 3.55, 2.35, 5.1);
    this.box(0.15, 1.45, 3.8, paint, 3.55, 0.72, 9.6);
    this.box(0.15, 1.8, 3.8, plasterMat, 3.55, 2.35, 9.6);
    this.box(0.15, 1.1, 1.0, paint, 3.55, 0.55, 7.2);
    this.box(0.15, 0.95, 1.0, plasterMat, 3.55, 2.775, 7.2);
    this.box(0.07, 1.26, 0.09, brass, 3.52, 1.7, 6.68);
    this.box(0.07, 1.26, 0.09, brass, 3.52, 1.7, 7.72);
    this.box(0.07, 0.09, 1.14, brass, 3.52, 2.33, 7.2);
    this.box(0.07, 0.09, 1.14, brass, 3.52, 1.07, 7.2);
    this.box(0.03, 1.2, 1.0, glass, 3.56, 1.7, 7.2);
    this.box(0.02, 1.5, 1.3, night, 3.78, 1.7, 7.2);
  }
  private box(
    w: number,
    h: number,
    d: number,
    material: T.Material,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = this.scene,
  ) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    if (parent === this.scene) this.staticParts.push(m);
    return m;
  }
  private label(text: string, w: number, h: number, x: number, y: number, z: number, rot: number) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#192a22';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#a38f60';
    ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = '#d7c28b';
    ctx.font = '64px serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 105);
    const m = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({ map: new T.CanvasTexture(c), roughness: 0.7 }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rot;
    this.scene.add(m);
  }
  private async loadAssets() {
    const loader = new GLTFLoader();
    const hinge = this.bathroomHinge;
    hinge.position.set(-0.515, 0, 3.55);
    hinge.rotation.y = -2.0;
    this.scene.add(hinge);
    const wood = new T.MeshStandardMaterial({ color: '#291b15', roughness: 0.7 });
    const trim = new T.MeshStandardMaterial({ color: '#493124', roughness: 0.64 });
    const brass = this.materials.brass;
    for (const x of [-0.58, 0.58])
      this.box(0.11, 2.4, 0.2, trim, x, 1.2, 3.55);
    this.box(1.27, 0.13, 0.2, trim, 0, 2.41, 3.55);
    this.box(1.02, 2.32, 0.07, wood, 0.515, 1.18, 0, hinge);
    for (const side of [-1, 1]) {
      for (const y of [0.62, 1.67])
        this.box(0.79, 0.84, 0.016, trim, 0.515, y, side * 0.043, hinge);
      this.box(0.075, 0.24, 0.023, brass, 0.88, 1.03, side * 0.055, hinge);
      this.box(0.16, 0.028, 0.04, brass, 0.83, 1.06, side * 0.095, hinge);
    }
    const placements: [string, number, number, number, T.Group?][] = [
      ['dressing', 0, 0, 0],
      ['mirror', -0.8, -3.43, 0],
      ['sink', -0.8, -3.4, 0],
      ['shower', 2.2, -3.43, 0],
      ['towel-rack', 3.43, 0.5, -Math.PI / 2, this.towel],
      ['bathtub', -3.4, -0.55, Math.PI / 2],
      ['ghost', 0, 0, 0, this.ghost],
      ['bed', -3.4, 7.2, Math.PI / 2],
      ['nightstand', -3.4, 6.1, Math.PI / 2],
      ['wardrobe', -3.4, 10.1, Math.PI / 2],
      ['tv', 3.43, 9.0, -Math.PI / 2],
      ['luggage-rack', 1.55, 4.6, Math.PI],
      ['door-316', 0, 11.46, Math.PI],
    ];
    await Promise.all(
      placements.map(async ([name, x, z, rot, target]) => {
        try {
          const file = name === 'ghost' ? 'ghost-aaa' : name === 'door-316' ? 'door' : name;
          const gltf = await loader.loadAsync(assetUrl(`models/${file}.glb`));
          const root = target ?? new T.Group();
          root.add(gltf.scene);
          root.position.set(x, 0, z);
          root.rotation.y = rot;
          root.name = name;
          root.traverse((o) => {
            if (o instanceof T.Mesh) {
              o.castShadow = name !== 'ghost';
              o.receiveShadow = true;
            }
          });
          if (name === 'mirror') {
            root.traverse((o) => {
              if (o.name === 'mirror__Silvered_glass') o.visible = false;
            });
            root.add(this.reflector);
            this.reflector.position.set(0, 1.7, 0.07);
          }
          this.materials.polishImported(root);
          if (name === 'ghost') {
            this.ghostHead = root.getObjectByName('head');
            if (this.ghostHead) this.ghostHeadBase.copy(this.ghostHead.quaternion);
          }
          if (!root.parent) this.scene.add(root);
        } catch (e) {
          this.assetErrors.push(name);
          console.error(`Asset failed: ${name}`, e);
        }
      }),
    );
    this.ghost.visible = false;
  }
  private rulePages() {
    for (let page = 0; page < 2; page++) {
      const canvas = agedPaper(page);
      const c = canvas.getContext('2d')!;
      c.strokeStyle = '#776b4e';
      c.strokeRect(17, 17, 350, 478);
      c.fillStyle = '#3c3b2d';
      c.font = '17px serif';
      c.textAlign = 'center';
      c.fillText('โรงแรมราตรี · ห้อง 316', 192, 52);
      c.font = 'bold 24px serif';
      c.fillText('ข้อปฏิบัติหลังเที่ยงคืน', 192, 95);
      c.textAlign = 'left';
      c.font = '18px serif';
      RULES.slice(page ? 5 : 0, page ? 9 : 5).forEach((r, i) => {
        c.fillText(`${page * 5 + i + 1}. ${r.title}`, 32, 144 + i * 62);
        c.fillStyle = '#66624b';
        c.font = '13px serif';
        c.fillText('โปรดทำตามอย่างเคร่งครัด', 53, 165 + i * 62);
        c.font = '18px serif';
        c.fillStyle = '#3c3b2d';
      });
      c.globalCompositeOperation = 'destination-out';
      for (const [x, y, dx, dy] of [
        [0, 0, 16, 11],
        [384, 0, -11, 7],
        [384, 512, -19, -13],
        [0, 512, 9, -12],
      ]) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + dx, y);
        c.lineTo(x + dx * 0.45, y + dy * 0.3);
        c.lineTo(x, y + dy);
        c.fill();
      }
      const t = new T.CanvasTexture(canvas);
      t.colorSpace = T.SRGBColorSpace;
      const geo = new T.PlaneGeometry(0.25, 0.34, 12, 12);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getY(i) * 20) * 0.00025);
      geo.computeVertexNormals();
      const mesh = new T.Mesh(
        geo,
        new T.MeshStandardMaterial({ map: t, roughness: 0.95, side: T.DoubleSide, alphaTest: 0.5 }),
      );
      mesh.position.set(-1.62 - page * 0.3, 1.73 - page * 0.04, -3.4743);
      mesh.rotation.z = page ? -0.035 : 0.045;
      this.scene.add(mesh);
    }
  }
  private mergeStatic() {
    this.scene.updateMatrixWorld(true);
    const groups = new Map<T.Material, T.BufferGeometry[]>();
    for (const mesh of this.staticParts) {
      const mat = mesh.material as T.Material;
      const list = groups.get(mat) ?? [];
      list.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
      groups.set(mat, list);
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    for (const [material, geometries] of groups) {
      const merged = mergeGeometries(geometries);
      const mesh = new T.Mesh(merged, material);
      mesh.receiveShadow = true;
      mesh.name = 'Architectural batch';
      this.scene.add(mesh);
      geometries.forEach((g) => g.dispose());
    }
    this.staticParts = [];
  }
  onInteract(action: Action) {
    if (action === 'bath' && this.bathLevel < 1) this.fillingBath = true;
    if (action === 'door' || action === 'leave') this.bathroomOpen = !this.bathroomOpen;
  }
  reset() {
    this.bathroomOpen = true;
    this.bathroomHinge.rotation.y = -2;
    this.bathLevel = 0;
    this.fillingBath = false;
  }
  dispose() {
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        geometries.add(o.geometry);
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) {
          materials.add(m);
          for (const value of Object.values(m)) if (value instanceof T.Texture) textures.add(value);
        }
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.reflector.dispose();
    this.scene.clear();
  }
  setQuality(mobile: boolean) {
    const size = mobile ? 1024 : 2048;
    this.scene.traverse((o) => {
      if (o instanceof T.SpotLight && o.castShadow && o.shadow.mapSize.x !== size) {
        o.shadow.mapSize.set(size, size);
        o.shadow.map?.dispose();
        o.shadow.map = null;
      }
    });
    this.reflector.getRenderTarget().setSize(mobile ? 384 : 768, mobile ? 384 : 768);
  }
  canMove(x: number, z: number) {
    if (!this.bathroomOpen && Math.abs(x) < 0.7 && Math.abs(z - 3.55) < 0.26) return false;
    const inBathroom = Math.abs(x) <= 3.16 && z <= 3.15;
    const inDoorway = Math.abs(x) <= 0.5 && z > 3.15 && z < 3.85;
    const inBedroom = Math.abs(x) <= 3.16 && z >= 3.85 && z <= 11.34;
    if (!inBathroom && !inDoorway && !inBedroom) return false;
    return !this.colliders.some(
      (b) => x > b.min.x - 0.17 && x < b.max.x + 0.17 && z > b.min.z - 0.17 && z < b.max.z + 0.17,
    );
  }
  update(
    dt: number,
    time: number,
    step: number,
    waterOn: boolean,
    dead: boolean,
    bathFilled: boolean,
    towelTaken: boolean,
    bagTaken: boolean,
    reduced: boolean,
    viewer?: T.Camera,
    hairGhost = false,
  ) {
    this.bathroomHinge.rotation.y = T.MathUtils.damp(
      this.bathroomHinge.rotation.y, this.bathroomOpen ? -2 : 0, 7, dt,
    );
    this.rain.visible = waterOn;
    this.water.visible = waterOn;
    this.waterFx.update(time, waterOn, step === 5);
    this.bathWater.visible = bathFilled;
    this.towel.traverse((o) => {
      if (o instanceof T.Mesh && /cotton/i.test(o.name)) o.visible = !towelTaken;
    });
    this.bag.visible = !bagTaken;
    this.hair.visible = step === 5;
    this.hair.rotation.y = reduced ? 0 : Math.sin(time * 0.7) * 0.005;
    const danger = step === 5 || dead;
    this.showerLight.color.lerp(new T.Color(danger ? '#bd3328' : '#b2d6cf'), 0.08);
    this.atmosphere.update(time, waterOn, reduced);
    if (this.fillingBath && !bathFilled) this.bathLevel = Math.min(1, this.bathLevel + dt / 8);
    if (bathFilled) this.bathLevel = 1;
    this.bathWater.visible = this.bathLevel > 0.01;
    this.bathWater.position.y = 0.25 + this.bathLevel * 0.3;
    (this.water.material as T.MeshStandardMaterial).color.lerp(
      new T.Color(danger ? '#330705' : '#4e6559'),
      0.08,
    );
    this.light.intensity = 9 * (reduced ? 1 : 0.97 + Math.sin(time * 6) * 0.025);
    const lampDip = step === 9 && !reduced ? 0.72 + 0.28 * Math.abs(Math.sin(time * 5.3)) : 1;
    this.bedLamp.intensity = 6 * (0.95 + 0.05 * Math.sin(time * 0.9)) * lampDip;
    this.seamMat.emissiveIntensity = T.MathUtils.lerp(
      this.seamMat.emissiveIntensity,
      viewer && viewer.position.z > 9.5 ? 0.05 : 1.1,
      0.06,
    );
    const overhead = hairGhost && !dead;
    this.ghost.visible = dead || step === 2 || step === 5;
    this.ghost.traverse((o) => o.layers.set(dead || overhead ? 0 : 1));
    if (dead) {
      if (this.deathTimer < 0) this.deathTimer = 0;
      this.deathTimer += dt;
    } else this.deathTimer = -1;
    if (overhead) {
      // The look-up reveal: bent over the bather from above the shower, face tipped down.
      this.ghost.position.set(2.2, 2.22 + (reduced ? 0 : Math.sin(time * 0.9) * 0.02), -0.9);
      this.ghost.rotation.set(1.15, Math.PI, 0);
    } else {
      this.ghost.position.set(
        dead ? 0 : 0.05,
        dead ? 0 : 0.08 + Math.sin(time * 0.7) * 0.035,
        dead ? -0.3 : -1.8,
      );
      this.ghost.rotation.set(0, dead ? 0 : Math.PI, 0);
      if (!dead && viewer) {
        const distance = Math.max(0.35, viewer.position.z + 3.3);
        this.ghost.position.x = -0.8 + ((-0.8 - viewer.position.x) * 0.55) / distance;
        this.ghost.position.z = -2.75;
        this.ghost.position.y = 0.04 + (reduced ? 0 : Math.sin(time * 0.7) * 0.018);
      }
    }
    if (this.ghostHead) {
      const lunge = dead && !reduced ? Math.min(1, this.deathTimer / 0.42) : 1;
      this.motionRotation.setFromAxisAngle(
        this.zAxis,
        reduced ? 0 : Math.sin(time * 0.63) * 0.038 + (dead ? 0.1 + 0.22 * (1 - lunge) : 0),
      );
      this.ghostHead.quaternion.copy(this.ghostHeadBase).multiply(this.motionRotation);
    }
    if (dead && viewer) {
      const d = new T.Vector3();
      viewer.getWorldDirection(d);
      d.y = 0;
      d.normalize();
      // A rule violation triggers a lunge: the apparition rushes into the
      // viewer's face over 0.42s, then holds just beyond arm's length.
      const rush = reduced ? 1 : Math.min(1, this.deathTimer / 0.42) ** 2;
      const reach = reduced ? 0.9 : 2.6 + (0.5 - 2.6) * rush;
      this.ghost.position.set(
        T.MathUtils.clamp(viewer.position.x + d.x * reach, -3.05, 3.05),
        0,
        T.MathUtils.clamp(viewer.position.z + d.z * reach, -3.05, 3.05),
      );
      this.ghost.rotation.set(0, Math.atan2(-d.x, -d.z), 0);
    }
  }
}
