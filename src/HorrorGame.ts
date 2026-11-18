import * as T from 'three';
import { Episode, RULES, type Action } from './game/rules';
import { HorrorAudio } from './game/audio';
import { dialogue, dialogueByRule, dialogueUrl } from './game/dialogue';
import { HotelWorld, type Hotspot } from './world';
import { RenderPipeline } from './graphics/RenderPipeline';
import { agedPaper } from './graphics/AgedPaper';

const el = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as E;
const show = (id: string, visible: boolean) => {
  el(id).hidden = !visible;
};
declare global {
  interface Window {
    __HORROR_QA__?: {
      episode: Episode;
      camera: T.PerspectiveCamera;
      world: HotelWorld;
      tick: (seconds: number) => void;
      look: (x: number, y: number, z: number) => void;
      teleport: (x: number, z: number) => void;
      inspect: () => unknown;
    };
  }
}

export class HorrorGame {
  private world = new HotelWorld();
  private renderer: T.WebGLRenderer;
  private pipeline: RenderPipeline;
  private camera = new T.PerspectiveCamera(60, 1, 0.05, 40);
  private episode = new Episode();
  private audio = new HorrorAudio();
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private sensitivity = 0.0018;
  private frame = 0;
  private time = 0;
  private last = 0;
  private raf = 0;
  private frozen = false;
  private portraitBlocked = false;
  private reduced = false;
  private target?: Hotspot;
  private hadLock = false;
  private noteFromPlay = false;
  private readBefore = false;
  private touchMove = new T.Vector2();
  private velocity = new T.Vector2();
  private deathAt = -10;
  private footstep = 0;
  private oldStep = -1;
  private oldPhase = 'menu';
  private nextUiUpdate = 0;
  private dialogueCaption?: { text: string; until: number };
  private direction = new T.Vector3();
  private toTarget = new T.Vector3();
  private lifecycle = new AbortController();
  private boundFrame = (t: number) => this.animate(t);

  constructor(private canvas: HTMLCanvasElement) {
    try {
      this.renderer = new T.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      show('load-error', true);
      el('load-error').textContent =
        'เบราว์เซอร์นี้เปิด WebGL ไม่ได้ กรุณาเปิดด้วย Chrome หรือ Edge ที่รองรับกราฟิก 3D';
      throw new Error('WebGL unavailable');
    }
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.pipeline = new RenderPipeline(this.renderer, this.world.scene, this.camera);
    this.camera.rotation.order = 'YXZ';
    this.menuCamera();
    this.resize();
    el('rules-list')
      .closest<HTMLElement>('.paper')
      ?.style.setProperty('--aged-paper', `url(${agedPaper(0).toDataURL('image/jpeg', 0.86)})`);
    el('rules-list').innerHTML = RULES.map(
      (r) => `<li><strong>${r.title}</strong><span>${r.body}</span></li>`,
    ).join('');
    el('rule-progress').innerHTML = RULES.map(() => '<i></i>').join('');
    this.bindInput();
    void this.world.assetsReady.then(() => {
      if (this.lifecycle.signal.aborted) return;
      if (this.world.assetErrors.length) {
        show('load-error', true);
        el('load-error').textContent =
          `โหลดฉากไม่ครบ (${this.world.assetErrors.join(', ')}) กรุณารีเฟรชหน้า`;
        return;
      }
      this.pipeline.bake(this.renderer, this.world.scene);
      el<HTMLButtonElement>('start').disabled = false;
      el('start').innerHTML = '<span>เช็คอิน · เริ่มคืนนี้</span><b>↗</b>';
    });
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) this.installHooks();
  }
  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.boundFrame);
  }
  private listen(target: EventTarget, event: string, fn: EventListener) {
    target.addEventListener(event, fn, { signal: this.lifecycle.signal });
  }
  private bindInput() {
    const click = (id: string, fn: () => void) => this.listen(el(id), 'click', fn);
    const app = el('app');
    const menu = el('menu');
    const firstEpisode = menu.querySelector<HTMLElement>('.menu-copy')!;
    const secondEpisode = el('episode-two');
    const backdrop = el('episode-two-backdrop');
    let second = false;
    let swipe: Touch | undefined;
    let offset = 0;
    let sliding = false;
    const panels = () => (second ? [secondEpisode, firstEpisode] : [firstEpisode, secondEpisode]);
    const backdropOpacity = (progress: number) => (second ? 1 - progress : progress);
    const finishSlide = async (advance: boolean, focus = false) => {
      if (sliding) return;
      sliding = true;
      const [current, incoming] = panels();
      const distance = menu.clientWidth * (second ? -1 : 1);
      const target = advance ? distance : 0;
      incoming.hidden = false;
      incoming.inert = true;
      const animation: KeyframeAnimationOptions = {
        duration: this.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 270,
        easing: 'cubic-bezier(.22,.8,.25,1)',
        fill: 'forwards',
      };
      const slide = (element: HTMLElement, from: number, to: number) =>
        element.animate([{ translate: `${from}px 0` }, { translate: `${to}px 0` }], animation);
      const animations = [
        slide(current, offset, target),
        slide(incoming, offset - distance, target - distance),
        backdrop.animate(
          [
            { opacity: backdropOpacity(offset / distance) },
            { opacity: backdropOpacity(advance ? 1 : 0) },
          ],
          animation,
        ),
      ];
      await Promise.allSettled(animations.map((animation) => animation.finished));
      if (advance) {
        second = !second;
        app.dataset.menuEpisode = second ? '2' : '1';
        el('menu-location').textContent = second ? 'บ้านย่านุ่น' : 'โรงแรมราตรี';
        el('menu-warning').textContent = second
          ? 'ถ้าเห็นชายริมทาง อย่าทัก'
          : 'ถ้าได้ยินเสียงเรียกจากห้องน้ำ อย่าตอบ';
        el('menu-time').textContent = second ? '19:00' : '00:01 AM';
        this.renderer.domElement.setAttribute('aria-hidden', String(second));
      }
      firstEpisode.hidden = second;
      secondEpisode.hidden = !second;
      firstEpisode.inert = second;
      secondEpisode.inert = !second;
      for (const element of [current, incoming]) element.style.removeProperty('translate');
      backdrop.style.removeProperty('opacity');
      animations.forEach((animation) => animation.cancel());
      offset = 0;
      sliding = false;
      if (advance) menu.scrollTop = 0;
      if (focus) el(second ? 'previous-episode' : 'next-episode').focus();
    };
    click('next-episode', () => {
      if (!second && !swipe) void finishSlide(true, true);
    });
    click('previous-episode', () => {
      if (second && !swipe) void finishSlide(true, true);
    });
    this.listen(menu, 'touchstart', (event) => {
      const { touches } = event as TouchEvent;
      if (sliding) return;
      if (touches.length !== 1 && offset !== 0) void finishSlide(false);
      swipe = touches.length === 1 ? touches[0] : undefined;
    });
    this.listen(menu, 'touchmove', (event) => {
      if (!swipe || sliding) return;
      const touch = (event as TouchEvent).touches[0];
      if (!touch || touch.identifier !== swipe.identifier) return;
      const dx = touch.clientX - swipe.clientX;
      if (
        offset === 0 &&
        (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(touch.clientY - swipe.clientY) * 1.5)
      )
        return;
      const distance = menu.clientWidth * (second ? -1 : 1);
      offset =
        Math.sign(distance) * Math.min(Math.abs(distance), Math.max(0, dx * Math.sign(distance)));
      const [current, incoming] = panels();
      incoming.hidden = false;
      incoming.inert = true;
      current.style.translate = `${offset}px 0`;
      incoming.style.translate = `${offset - distance}px 0`;
      backdrop.style.opacity = String(backdropOpacity(offset / distance));
    });
    const endSwipe = (event: Event) => {
      if (!swipe || sliding) return;
      swipe = undefined;
      if (offset === 0 && panels()[1].hidden) return;
      if (event.cancelable) event.preventDefault();
      void finishSlide(event.type === 'touchend' && Math.abs(offset) >= 55);
    };
    this.listen(menu, 'touchend', endSwipe);
    this.listen(menu, 'touchcancel', endSwipe);
    click('start', () => this.begin());
    click('retry', () => this.begin());
    click('restart-pause', () => this.begin());
    click('read-menu', () => this.openNote());
    click('close-note', () => this.closeNote());
    click('pause', () => this.pause());
    click('resume', () => this.resume());
    click('quit', () => this.quit());
    click('end-menu', () => this.quit());
    click('mute', () => {
      void this.audio.unlock();
      this.audio.setMuted(!this.audio.muted);
      el('mute').textContent = this.audio.muted ? 'เสียง ปิด' : 'เสียง เปิด';
      el('mute').setAttribute('aria-label', this.audio.muted ? 'เปิดเสียง' : 'ปิดเสียง');
    });
    click('touch-eyes', () => this.action('eyes'));
    click('touch-note', () => this.openNote());
    click('touch-act', () => this.interact());
    this.listen(el('reduce-motion'), 'change', () => {
      this.reduced = el<HTMLInputElement>('reduce-motion').checked;
      document.body.classList.toggle('reduced-motion', this.reduced);
    });
    this.listen(el('sensitivity'), 'input', () => {
      this.sensitivity = Number(el<HTMLInputElement>('sensitivity').value);
    });
    this.listen(document, 'keydown', (event) => {
      const e = event as KeyboardEvent;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
        ].includes(e.code)
      )
        e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Escape') {
        if (!el('note').hidden) this.closeNote();
        else if (this.episode.state.phase === 'playing') this.pause();
      }
      if (this.episode.state.phase !== 'playing') return;
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyC') this.action('eyes');
      if (e.code === 'KeyR') this.openNote();
    });
    this.listen(document, 'keyup', (event) => this.keys.delete((event as KeyboardEvent).code));
    this.listen(window, 'blur', () => {
      this.clearInput();
      this.pause();
    });
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.clearInput();
        this.pause();
      }
    });
    this.listen(window, 'resize', () => this.resize());
    this.listen(document, 'pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) this.hadLock = true;
      else if (this.hadLock) {
        this.hadLock = false;
        this.clearInput();
        if (this.episode.state.phase === 'playing' && el('note').hidden) this.pause();
      }
    });
    this.listen(document, 'mousemove', (event) => {
      const e = event as MouseEvent;
      if (document.pointerLockElement === this.canvas && this.episode.state.phase === 'playing')
        this.lookDelta(e.movementX, e.movementY);
    });
    let drag: number | undefined;
    let px = 0,
      py = 0;
    this.listen(this.canvas, 'pointerdown', (event) => {
      const e = event as PointerEvent;
      if (this.episode.state.phase !== 'playing') return;
      void this.audio.unlock();
      drag = e.pointerId;
      px = e.clientX;
      py = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
      if (e.pointerType === 'mouse') this.lockPointer();
    });
    this.listen(this.canvas, 'pointermove', (event) => {
      const e = event as PointerEvent;
      if (
        drag === e.pointerId &&
        document.pointerLockElement !== this.canvas &&
        this.episode.state.phase === 'playing'
      ) {
        this.lookDelta((e.clientX - px) * 2, (e.clientY - py) * 2);
        px = e.clientX;
        py = e.clientY;
      }
    });
    const endDrag = () => {
      drag = undefined;
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.listen(this.canvas, name, endDrag);
    const stick = el('stick');
    let stickId: number | undefined;
    const moveStick = (e: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      this.touchMove.set((e.clientX - rect.left - 55) / 40, (e.clientY - rect.top - 55) / 40);
      if (this.touchMove.length() > 1) this.touchMove.normalize();
      (stick.firstElementChild as HTMLElement).style.transform =
        `translate(${this.touchMove.x * 30}px,${this.touchMove.y * 30}px)`;
    };
    this.listen(stick, 'pointerdown', (event) => {
      const e = event as PointerEvent;
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    this.listen(stick, 'pointermove', (event) => {
      const e = event as PointerEvent;
      if (stickId === e.pointerId) moveStick(e);
    });
    const stopStick = () => {
      this.velocity.set(0, 0);
      stickId = undefined;
      this.touchMove.set(0, 0);
      (stick.firstElementChild as HTMLElement).style.transform = '';
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.listen(stick, name, stopStick);
    this.listen(document.querySelector('.hotel-brand')!, 'click', (e) => {
      e.preventDefault();
      if (this.episode.state.phase === 'menu') return;
      this.pause();
    });
  }
  private clearInput() {
    this.keys.clear();
    this.velocity.set(0, 0);
    this.touchMove.set(0, 0);
    (el('stick').firstElementChild as HTMLElement).style.transform = '';
  }
  private lockPointer() {
    if (matchMedia('(pointer:coarse)').matches || document.pointerLockElement === this.canvas)
      return;
    try {
      void this.canvas.requestPointerLock()?.catch(() => {});
    } catch {
      /* Touch or embedded browsers retain drag-look controls. */
    }
  }
  private begin() {
    this.world.reset();
    this.stopSceneAudio();
    this.episode.start();
    this.camera.position.set(0, 1.65, 2.5);
    this.yaw = 0;
    this.pitch = 0;
    this.applyLook();
    this.clearInput();
    this.oldStep = -1;
    show('menu', false);
    show('pause-screen', false);
    show('end-screen', false);
    show('note', false);
    show('hud', true);
    document.body.classList.add('playing');
    document.body.classList.remove('dead');
    void this.audio.unlock();
    this.audio.preloadSpeech(Object.keys(dialogue).map(dialogueUrl));
    if (this.readBefore) {
      this.episode.act('note');
      this.audio.setActive(true);
      this.lockPointer();
    } else this.openNote();
    this.renderUI();
  }
  private pause() {
    if (this.episode.state.phase !== 'playing') return;
    this.episode.pause();
    this.stopSceneAudio();
    this.clearInput();
    show('pause-screen', true);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  private resume() {
    show('pause-screen', false);
    this.episode.resume();
    this.audio.setActive(true);
    this.last = performance.now();
    this.lockPointer();
  }
  private quit() {
    this.episode = new Episode();
    this.stopSceneAudio();
    this.clearInput();
    for (const id of ['hud', 'note', 'pause-screen', 'end-screen']) show(id, false);
    show('menu', true);
    document.body.classList.remove('playing', 'dead', 'eyes-closed');
    if (document.pointerLockElement) document.exitPointerLock();
    this.menuCamera();
    this.renderUI();
  }
  private openNote() {
    if (!['playing', 'menu'].includes(this.episode.state.phase)) return;
    this.noteFromPlay = this.episode.state.phase === 'playing';
    if (this.noteFromPlay) {
      this.episode.act('note');
      this.episode.pause();
      this.stopSceneAudio();
      this.clearInput();
    }
    show('note', true);
    if (document.pointerLockElement) document.exitPointerLock();
    el('close-note').focus({ preventScroll: true });
    el('note').scrollTop = 0;
  }
  private closeNote() {
    if (el('note').hidden) return;
    show('note', false);
    this.readBefore = true;
    if (this.noteFromPlay) {
      this.episode.resume();
      this.audio.setActive(true);
      this.lockPointer();
    } else el('start').focus();
  }
  private action(action: Action) {
    this.episode.act(action);
    if (this.episode.state.phase === 'playing') this.world.onInteract(action);
    this.audio.cue('interact');
    this.renderUI();
  }
  private interact() {
    if (this.episode.state.phase !== 'playing') return;
    if (this.episode.state.step === 4 && this.inShower()) {
      this.action('rinse');
      return;
    }
    if (this.target) {
      if (this.target.action === 'note') this.openNote();
      else this.action(this.target.action);
    }
  }
  private inShower() {
    return Math.hypot(this.camera.position.x - 2.2, this.camera.position.z + 2.75) < 0.52;
  }
  private lookDelta(x: number, y: number) {
    this.yaw -= x * this.sensitivity;
    this.pitch = T.MathUtils.clamp(this.pitch - y * this.sensitivity, -1.25, 1.25);
    this.applyLook();
  }
  private applyLook() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
  private menuCamera() {
    this.camera.position.set(3.1, 1.8, 3);
    this.camera.lookAt(-0.8, 1.45, -2);
    this.yaw = this.camera.rotation.y;
    this.pitch = this.camera.rotation.x;
  }
  private move(dt: number) {
    let x =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.touchMove.x;
    let z =
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) +
      this.touchMove.y;
    const mag = Math.hypot(x, z);
    if (mag > 1) {
      x /= mag;
      z /= mag;
    }
    const blend = 1 - Math.exp(-dt * 15);
    this.velocity.set(
      T.MathUtils.lerp(this.velocity.x, x, blend),
      T.MathUtils.lerp(this.velocity.y, z, blend),
    );
    x = this.velocity.x;
    z = this.velocity.y;
    const speed = this.episode.eyesClosed ? 0.7 : 1.9;
    const dx = (x * Math.cos(this.yaw) + z * Math.sin(this.yaw)) * speed * dt;
    const dz = (-x * Math.sin(this.yaw) + z * Math.cos(this.yaw)) * speed * dt;
    const p = this.camera.position;
    if (this.world.canMove(p.x + dx, p.z)) p.x += dx;
    if (this.world.canMove(p.x, p.z + dz)) p.z += dz;
    this.camera.rotation.z = this.reduced ? 0 : -x * 0.008;
    if (mag > 0.1) {
      this.footstep += dt;
      if (this.footstep > 0.55) {
        this.audio.cue('footstep');
        this.footstep = 0;
      }
    }
    p.y = 1.65 + (!this.reduced && mag > 0.1 ? Math.sin(this.time * 10) * 0.012 : 0);
  }
  private context() {
    this.camera.getWorldDirection(this.direction);
    this.toTarget.set(-0.8, 1.7, -3.36).sub(this.camera.position);
    const distance = this.toTarget.length();
    return {
      lookingAtMirror: distance < 5.8 && this.direction.dot(this.toTarget.normalize()) > 0.976,
      inShower: this.inShower(),
      lookingUp: this.direction.y > 0.45,
      lookingDown: this.direction.y < -0.45,
    };
  }
  private findTarget() {
    this.target = undefined;
    if (this.episode.eyesClosed) return;
    this.camera.getWorldDirection(this.direction);
    let best = 0;
    for (const target of this.world.hotspots) {
      if (target.action === 'rinse' && this.episode.state.step !== 4) continue;
      if (target.action === 'bag' && this.episode.bagCollected) continue;
      if (target.action === 'towel' && this.episode.state.step > 7) continue;
      this.toTarget.copy(target.position).sub(this.camera.position);
      const distance = this.toTarget.length();
      const dot = this.direction.dot(this.toTarget.normalize());
      if (distance < 2.3 && dot > 0.88 && dot > best) {
        this.target = target;
        best = dot;
      }
    }
    if (this.episode.state.step === 4 && this.inShower())
      this.target = this.world.hotspots.find((s) => s.action === 'rinse');
  }
  private stopSceneAudio() {
    this.dialogueCaption = undefined;
    this.audio.setActive(false);
  }
  private speak(id: keyof typeof dialogue) {
    const line = dialogue[id];
    this.dialogueCaption = {
      text: `${line.speaker} — ${line.text}`,
      until: this.time + line.seconds / (line.eerie ? 0.9 : 1),
    };
    void this.audio.speak(dialogueUrl(id), line);
  }
  private update(dt: number) {
    if (this.episode.state.phase === 'playing') {
      this.move(dt);
      this.episode.update(dt, this.context());
      this.findTarget();
    }
    const s = this.episode.state;
    if (s.step !== this.oldStep && s.phase === 'playing') {
      if (this.oldStep >= 0) this.audio.cue(s.step >= 3 && s.step <= 6 ? 'danger' : 'step');
      const line = dialogueByRule[s.step];
      if (line) this.speak(line);
      else {
        this.dialogueCaption = undefined;
        this.audio.stopSpeech();
      }
      this.oldStep = s.step;
    }
    if (s.phase !== this.oldPhase) {
      if (s.phase === 'dead' || s.phase === 'won') {
        // setActive first: it stops every voice, so a screech cued before it dies unheard.
        this.stopSceneAudio();
        if (s.phase === 'dead') this.audio.cue('screech', true);
        this.audio.cue(s.phase === 'dead' ? 'fail' : 'win');
        if (s.phase === 'won') this.speak('check-out');
        this.clearInput();
        if (document.pointerLockElement) document.exitPointerLock();
        this.deathAt = this.time;
        show('end-screen', s.phase === 'won' || this.reduced);
        if (s.phase === 'dead') {
          this.pitch = -0.02;
          this.applyLook();
        }
        el('end-kicker').textContent = s.phase === 'won' ? 'CHECK-OUT COMPLETE' : 'YOU WERE WARNED';
        el('end-title').textContent = s.phase === 'won' ? 'คุณรอดจากคืนนี้' : 'คุณทำผิดกฎ';
        const ending = dialogue['check-out'];
        el('end-cause').textContent =
          s.phase === 'won' ? `${ending.speaker} — ${ending.text}` : s.cause;
        el('end-detail').textContent =
          s.phase === 'won'
            ? 'ตอนที่ 1 จบแล้ว · ตอนที่ 2 ยังไม่เปิดให้เล่น'
            : `ผ่าน ${s.completed.length} จาก 9 ข้อ · จำสิ่งที่เกิดขึ้น แล้วลองใหม่`;
        document.body.classList.toggle('dead', s.phase === 'dead');
      }
      this.oldPhase = s.phase;
    }
    this.audio.setWater(this.episode.waterOn && s.phase === 'playing');
    if (this.time >= this.nextUiUpdate || s.phase !== 'playing') {
      this.renderUI();
      this.nextUiUpdate = this.time + 0.1;
    }
  }
  private renderUI() {
    const s = this.episode.state;
    const rule = RULES[Math.min(s.step, 8)];
    document.body.classList.toggle('soap-eyes', s.phase === 'playing' && s.step === 4);
    el('rule-index').textContent =
      `ข้อปฏิบัติ ${String(Math.min(s.step + 1, 9)).padStart(2, '0')} / 09`;
    el('objective').textContent = rule.objective;
    el('hint').textContent = rule.hint;
    const subtitle = el('subtitle');
    if (subtitle.textContent !== s.message) subtitle.textContent = s.message;
    const line = this.dialogueCaption;
    const caption = s.phase === 'playing' && line && this.time < line.until ? line.text : '';
    const dialogueElement = el('dialogue-caption');
    if (dialogueElement.textContent !== caption) dialogueElement.textContent = caption;
    el('clock').textContent = `00:${String(13 + Math.floor(s.elapsed / 60)).padStart(2, '0')}`;
    document.querySelectorAll('#rule-progress i').forEach((n, i) => {
      n.classList.toggle('done', s.completed.includes(i));
      n.classList.toggle('current', i === s.step);
    });
    el('interaction').style.opacity =
      this.target && s.phase === 'playing' && !this.episode.eyesClosed ? '1' : '0';
    el('interaction').querySelector('span')!.textContent = this.target?.label ?? '';
    document.body.classList.toggle('eyes-closed', this.episode.eyesClosed);
    el('touch-eyes').textContent = this.episode.eyesClosed ? 'ลืมตา' : 'หลับตา';
  }
  private animate(now: number) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (this.portraitBlocked) {
      this.raf = requestAnimationFrame(this.boundFrame);
      return;
    }
    this.frame++;
    if (!this.frozen) {
      this.time += this.episode.state.phase === 'paused' ? 0 : dt;
      this.update(dt);
    }
    const s = this.episode.state;
    this.world.update(
      this.frozen || s.phase === 'paused' ? 0 : dt,
      this.time,
      s.phase === 'menu' ? -1 : s.step,
      this.episode.waterOn,
      s.phase === 'dead',
      this.episode.bathFilled,
      s.step > 7,
      this.episode.bagCollected,
      this.reduced,
      this.camera,
      (s.phase === 'playing' || s.phase === 'paused') && s.step === 5 && this.context().lookingUp,
    );
    if (s.phase === 'dead' && this.time - this.deathAt > 0.7) show('end-screen', true);
    this.renderer.info.reset();
    this.pipeline.render(
      this.time,
      s.dread,
      this.reduced,
      this.episode.waterOn && this.inShower(),
      s.phase === 'menu' || s.phase === 'dead' || s.phase === 'won',
    );
    this.diagnostics();
    this.raf = requestAnimationFrame(this.boundFrame);
  }
  private resize() {
    const w = innerWidth,
      h = innerHeight;
    this.portraitBlocked = matchMedia('(pointer: coarse) and (orientation: portrait)').matches;
    el('app').inert = this.portraitBlocked;
    show('rotate-device', this.portraitBlocked);
    if (this.portraitBlocked) this.pause();
    const mobile = matchMedia('(pointer: coarse)').matches || w < 700;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 1.75));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pipeline.resize(w, h, this.renderer.getPixelRatio());
    this.world.setQuality(w < 700 || matchMedia('(pointer:coarse)').matches);
  }
  private diagnostics() {
    const i = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.episode.state.elapsed,
      score: this.episode.state.completed.length,
      targetScore: 9,
      complete: this.episode.state.phase === 'won',
      player: {
        position: {
          x: this.camera.position.x,
          y: this.camera.position.y,
          z: this.camera.position.z,
        },
        speed: 1.9,
      },
      renderer: {
        calls: i.render.calls,
        triangles: i.render.triangles,
        geometries: i.memory.geometries,
        textures: i.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: this.renderer.getPixelRatio(),
      },
    };
  }
  private installHooks() {
    window.__THREE_GAME_TEST_HOOKS__ = {
      // The episode has no randomized hazards; all world noise uses a fixed local seed.
      seed: () => {},
      setPausedForScreenshot: (v) => {
        this.frozen = v;
      },
      setReducedMotion: (v) => {
        this.reduced = v;
        document.body.classList.toggle('reduced-motion', v);
        if (v && this.episode.state.phase === 'dead') show('end-screen', true);
      },
      hideDebugUi: () => {},
      setState: async (name) => {
        await this.world.assetsReady;
        if (name === 'menu') this.quit();
        else if (name === 'active-play') {
          this.begin();
          this.closeNote();
          this.episode.act('note');
          this.camera.position.set(0, 1.65, 2.5);
          this.yaw = 0;
          this.pitch = -0.05;
          this.applyLook();
        } else if (name === 'bath-area') {
          this.begin();
          this.closeNote();
          this.camera.position.set(0.7, 1.65, 1.8);
          this.camera.lookAt(-2.5, 1, 0.15);
          this.yaw = this.camera.rotation.y;
          this.pitch = this.camera.rotation.x;
          this.update(0);
        } else if (name === 'mirror-event') {
          this.begin();
          this.closeNote();
          const safe = { lookingAtMirror: false, inShower: true, lookingDown: true };
          const wait = (seconds: number) => {
            for (let i = 0; i < seconds * 60; i++) this.episode.update(1 / 60, safe);
          };
          this.episode.act('note');
          this.episode.act('bath');
          wait(8.1);
          this.episode.act('shower');
          wait(8.1);
          this.camera.position.set(-0.2, 1.65, -0.15);
          this.camera.lookAt(-0.8, 1.76, -3.3);
          this.yaw = this.camera.rotation.y;
          this.pitch = this.camera.rotation.x;
          this.update(0);
        } else if (name === 'hair-event') {
          this.begin();
          this.closeNote();
          const safe = { lookingAtMirror: false, inShower: true, lookingDown: true };
          const wait = (seconds: number) => {
            for (let i = 0; i < seconds * 60; i++) this.episode.update(1 / 60, safe);
          };
          this.episode.act('note');
          this.episode.act('bath');
          wait(8.1);
          this.episode.act('shower');
          wait(24.3);
          this.episode.act('rinse');
          this.camera.position.set(2.2, 1.65, -2.5);
          this.camera.lookAt(2.2, 0.4, -3.2);
          this.yaw = this.camera.rotation.y;
          this.pitch = this.camera.rotation.x;
          this.update(0);
        } else if (name === 'failure') {
          this.begin();
          this.closeNote();
          this.episode.act('shower');
          this.update(0);
        } else throw new Error(`Unknown capture state ${name}`);
        return { state: name };
      },
    };
    window.__HORROR_QA__ = {
      episode: this.episode,
      camera: this.camera,
      world: this.world,
      tick: (seconds) => {
        for (let i = 0; i < seconds * 60; i++) this.update(1 / 60);
      },
      look: (x, y, z) => {
        this.camera.lookAt(x, y, z);
        this.yaw = this.camera.rotation.y;
        this.pitch = this.camera.rotation.x;
      },
      teleport: (x, z) => {
        this.camera.position.set(x, 1.65, z);
      },
      inspect: () => ({
        state: this.episode.state,
        eyes: this.episode.eyesClosed,
        audioUnlocked: this.audio.unlocked,
        muted: this.audio.muted,
        playing: this.audio.playingDurations,
        speechPlaying: this.audio.speechPlaying,
        target: this.target?.action,
        assets: this.world.assetErrors,
      }),
    };
    Object.defineProperty(window.__HORROR_QA__, 'episode', { get: () => this.episode });
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.lifecycle.abort();
    this.audio.dispose();
    this.pipeline.dispose();
    this.world.dispose();
    this.renderer.dispose();
    delete window.__HORROR_QA__;
    delete window.__THREE_GAME_TEST_HOOKS__;
  }
}
