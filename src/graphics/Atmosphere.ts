import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { grimeTexture } from './Materials';

export class Atmosphere {
  curtain: T.Mesh;
  private curtainShader?: { uniforms: { [key: string]: T.IUniform } };
  private waterShaders: { uniforms: { [key: string]: T.IUniform } }[] = [];
  constructor(scene: T.Scene, brass: T.Material) {
    const cloth = new T.MeshPhysicalMaterial({
      color: '#768073',
      roughness: 0.9,
      side: T.DoubleSide,
      sheen: 0.45,
      sheenRoughness: 0.8,
    });
    const geo = new T.PlaneGeometry(0.7, 2.25, 40, 35),
      p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i);
      p.setZ(
        i,
        Math.sin((x + 0.35) * 68) * 0.043 + (1 - (y + 1.125) / 2.25) * Math.sin(x * 11) * 0.02,
      );
    }
    geo.computeVertexNormals();
    cloth.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uStrength = { value: 0 };
      shader.vertexShader =
        'uniform float uTime;uniform float uStrength;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n transformed.z += sin(position.x*8.+uTime*.8)*max(0.,1.125-position.y)*.012*uStrength;',
        );
      this.curtainShader = shader;
    };
    cloth.customProgramCacheKey = () => 'hotel-curtain-v1';
    this.curtain = new T.Mesh(geo, cloth);
    this.curtain.position.set(2.95, 1.37, -1.5);
    this.curtain.castShadow = true;
    scene.add(this.curtain);
    const rings: T.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const g = new T.TorusGeometry(0.045, 0.006, 6, 16);
      g.rotateY(Math.PI / 2);
      g.translate(2.64 + i * 0.079, 2.55, -1.5);
      rings.push(g);
    }
    scene.add(new T.Mesh(mergeGeometries(rings), brass));
    rings.forEach((g) => g.dispose());
    // Moisture trails and oxidized edges have local placement rather than uniform wall noise.
    const dirt = new T.MeshBasicMaterial({
      map: grimeTexture(),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    for (const [x, z, rot, w, h] of [
      [-2.9, -3.4748, 0, 1.0, 1.6],
      [2.6, -3.4748, 0, 1.65, 2.3],
      [-3.4748, -0.7, Math.PI / 2, 2.1, 1.7],
      [3.4748, -2, -Math.PI / 2, 2.2, 1.8],
    ] as number[][]) {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), dirt);
      m.position.set(x, h * 0.5 + 0.08, z);
      m.rotation.y = rot;
      scene.add(m);
    }
    // Condensation and finger marks on the mirror retain enough clear glass to read the threat.
    const mist = new T.Mesh(
      new T.CircleGeometry(1, 64),
      new T.MeshPhysicalMaterial({
        map: grimeTexture(),
        transparent: true,
        opacity: 0.18,
        roughness: 0.7,
        depthWrite: false,
      }),
    );
    mist.scale.set(0.363, 0.478, 1);
    mist.position.set(-0.8, 1.7, -3.3595);
    scene.add(mist);
  }
  waterMaterial(color: string, extent = new T.Vector2(0.85, 0.75)) {
    const m = new T.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      roughness: 0.13,
      metalness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      side: T.DoubleSide,
      depthWrite: false,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = { value: 0 };
      shader.uniforms.uWaterExtent = { value: extent };
      shader.vertexShader =
        'varying vec3 vWaterPos;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n vWaterPos=position;',
        );
      shader.fragmentShader =
        'uniform float uWaterTime;uniform vec2 uWaterExtent;varying vec3 vWaterPos;\n' +
        shader.fragmentShader.replace(
          '#include <normal_fragment_begin>',
          '#include <normal_fragment_begin>\n normal=normalize(normal+vec3(sin(vWaterPos.x*34.+uWaterTime*2.)*.08,cos(vWaterPos.y*39.-uWaterTime*2.6)*.08,0.));',
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n float rim=length(vWaterPos.xy/uWaterExtent)+sin(vWaterPos.x*21.+vWaterPos.y*13.)*.018;diffuseColor.a*=1.-smoothstep(.78,1.,rim);',
      );
      this.waterShaders.push(shader);
    };
    m.customProgramCacheKey = () => 'hotel-water-v1';
    return m;
  }
  update(time: number, water: boolean, reduced: boolean) {
    if (this.curtainShader) {
      this.curtainShader.uniforms.uTime.value = time;
      this.curtainShader.uniforms.uStrength.value = reduced ? 0 : water ? 1 : 0.25;
    }
    for (const s of this.waterShaders) s.uniforms.uWaterTime.value = reduced ? 0 : time;
  }
}
