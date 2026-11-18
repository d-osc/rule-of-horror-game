import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export class RenderPipeline {
  private composer: EffectComposer;
  private ao: SSAOPass;
  private grade: ShaderPass;
  private mobile = false;
  private envTarget: T.WebGLRenderTarget;
  constructor(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera) {
    const pmrem = new T.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    this.envTarget = pmrem.fromScene(environment, 0.06);
    scene.environment = this.envTarget.texture;
    scene.environmentIntensity = 0.16;
    environment.dispose();
    pmrem.dispose();
    this.composer = new EffectComposer(renderer);
    this.composer.renderTarget1.samples = 4;
    this.composer.renderTarget2.samples = 4;
    this.composer.addPass(new RenderPass(scene, camera));
    this.ao = new SSAOPass(scene, camera, 640, 360, 12);
    this.ao.kernelRadius = 0.18;
    this.ao.minDistance = 0.001;
    this.ao.maxDistance = 0.16;
    const aoRender = this.ao.render.bind(this.ao);
    this.ao.render = (...args: Parameters<SSAOPass['render']>) => {
      const hidden: T.Object3D[] = [];
      scene.traverse((o) => {
        if (o.userData.noAO && o.visible) {
          hidden.push(o);
          o.visible = false;
        }
      });
      aoRender(...args);
      hidden.forEach((o) => (o.visible = true));
    };
    this.composer.addPass(this.ao);
    this.grade = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uDread: { value: 0 },
        uReduced: { value: 0 },
        uWet: { value: 0 },
        uCinema: { value: 0 },
      },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `
      uniform sampler2D tDiffuse;uniform float uTime,uDread,uReduced,uWet,uCinema;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){vec2 uv=vUv;vec2 lens=uv-.5;uv+=lens*dot(lens,lens)*.008;vec4 c=texture2D(tDiffuse,uv);float l=dot(c.rgb,vec3(.2126,.7152,.0722));
      c.rgb=mix(vec3(l),c.rgb,.78); c.rgb=c.rgb/(vec3(1.)+c.rgb*.045);c.rgb*=vec3(1.018,1.015,.975);
      float edge=smoothstep(.25,.78,distance(uv,vec2(.5)));c.rgb*=1.0-edge*.22;
      float grain=hash(uv*vec2(1280.,720.)+floor(uTime*24.)*(1.0-uReduced))-.5;c.rgb+=grain*.008;
      c.rgb=mix(c.rgb,c.rgb*vec3(1.08,.92,.89),uDread*.2);
      float steam=edge*(.5+.5*sin(uv.x*9.+uv.y*12.+uTime*.12*(1.-uReduced)));c.rgb=mix(c.rgb,vec3(.34,.39,.35),steam*uWet*.045);float bar=smoothstep(uCinema-.002,uCinema, vUv.y)*smoothstep(uCinema-.002,uCinema,1.-vUv.y);c.rgb*=bar;gl_FragColor=vec4(c.rgb,c.a);}`,
    });
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }
  resize(w: number, h: number, dpr: number) {
    this.mobile = w < 700 || matchMedia('(pointer:coarse)').matches;
    this.ao.enabled = !this.mobile;
    const samples = this.mobile ? 0 : 4;
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2])
      if (rt.samples !== samples) {
        rt.samples = samples;
        rt.dispose();
      }
    this.composer.setPixelRatio(Math.min(dpr, this.mobile ? 1.25 : 1.5));
    this.composer.setSize(w, h);
  }
  render(time: number, dread: number, reduced: boolean, wet = false, cinema = false) {
    this.grade.uniforms.uTime.value = time;
    this.grade.uniforms.uDread.value = dread;
    this.grade.uniforms.uReduced.value = reduced ? 1 : 0;
    this.grade.uniforms.uWet.value = T.MathUtils.lerp(
      this.grade.uniforms.uWet.value,
      wet ? 1 : 0,
      0.015,
    );
    this.grade.uniforms.uCinema.value = T.MathUtils.lerp(
      this.grade.uniforms.uCinema.value,
      cinema ? 0.035 : 0.008,
      0.06,
    );
    this.composer.render();
  }
  get passes() {
    return this.mobile ? 1 : 2;
  }
  bake(renderer: T.WebGLRenderer, scene: T.Scene) {
    const hidden: T.Object3D[] = [];
    scene.traverse((o) => {
      if (o instanceof Reflector && o.visible) {
        hidden.push(o);
        o.visible = false;
      }
    });
    const pmrem = new T.PMREMGenerator(renderer);
    const old = this.envTarget;
    this.envTarget = pmrem.fromScene(scene, 0.025, 0.05, 25, {
      size: 256,
      position: new T.Vector3(0, 1.5, 0),
    });
    scene.environment = this.envTarget.texture;
    scene.environmentIntensity = 0.65;
    hidden.forEach((o) => (o.visible = true));
    pmrem.dispose();
    old.dispose();
  }
  dispose() {
    this.ao.dispose();
    this.grade.dispose();
    this.composer.dispose();
    this.envTarget.dispose();
  }
}
