import * as T from 'three';

export class WaterParticles {
  drops: T.Mesh;
  private splashes: T.Mesh;
  private uniforms = { uTime: { value: 0 }, uBlood: { value: 0 } };
  constructor(scene: T.Scene) {
    const make = (count: number) => {
      const geo = new T.InstancedBufferGeometry();
      const plane = new T.PlaneGeometry(1, 1);
      geo.index = plane.index;
      geo.attributes = plane.attributes;
      const seeds = new Float32Array(count * 4);
      let n = 45317;
      for (let i = 0; i < seeds.length; i++) {
        n = (n * 1664525 + 1013904223) >>> 0;
        seeds[i] = n / 4294967296;
      }
      geo.setAttribute('aSeed', new T.InstancedBufferAttribute(seeds, 4));
      geo.instanceCount = count;
      return geo;
    };
    this.drops = new T.Mesh(
      make(280),
      new T.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        vertexShader: `attribute vec4 aSeed;uniform float uTime;varying vec2 vUv;varying float vAlpha;void main(){vUv=uv;float p=fract(uTime*(1.5+aSeed.w*.4)+aSeed.z);float spread=.13+p*.14;vec3 center=vec3(2.2+(aSeed.x-.5)*spread*2.,2.17-p*2.08,-2.75+(aSeed.y-.5)*spread*2.);vec4 mv=modelViewMatrix*vec4(center,1.);mv.xy+=position.xy*vec2(.0035,.10+aSeed.w*.07);vAlpha=.22+aSeed.w*.23;gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `uniform float uBlood;varying vec2 vUv;varying float vAlpha;void main(){float a=smoothstep(.5,.05,abs(vUv.x-.5))*sin(vUv.y*3.14159)*vAlpha;gl_FragColor=vec4(mix(vec3(.65,.79,.75),vec3(.44,.12,.08),uBlood),a);}`,
      }),
    );
    this.splashes = new T.Mesh(
      make(35),
      new T.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        vertexShader: `attribute vec4 aSeed;uniform float uTime;varying vec2 vUv;varying float vAge;void main(){vUv=uv;vAge=fract(uTime*1.8+aSeed.z);vec3 p=vec3(2.2+(aSeed.x-.5)*.7,.087,-2.7+(aSeed.y-.5)*.65);p.xz+=position.xy*(.02+vAge*.12);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
        fragmentShader: `uniform float uBlood;varying vec2 vUv;varying float vAge;void main(){float r=length(vUv-.5);float a=(1.-smoothstep(.015,.06,abs(r-.4)))*(1.-vAge)*.18;gl_FragColor=vec4(mix(vec3(.7,.83,.77),vec3(.3,.07,.03),uBlood),a);}`,
      }),
    );
    this.drops.frustumCulled = this.splashes.frustumCulled = false;
    this.drops.userData.noAO = this.splashes.userData.noAO = true;
    this.drops.visible = this.splashes.visible = false;
    scene.add(this.drops, this.splashes);
  }
  update(time: number, on: boolean, blood: boolean) {
    this.drops.visible = this.splashes.visible = on;
    this.uniforms.uTime.value = time;
    this.uniforms.uBlood.value = T.MathUtils.lerp(this.uniforms.uBlood.value, blood ? 1 : 0, 0.06);
  }
}
