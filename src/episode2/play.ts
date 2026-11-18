import * as T from 'three';
import { HorrorAudio } from '../game/audio';
import { objectives } from './objectives';
import { scenery } from './scenery';
import { story } from './story';
import './episode.css';

const DRIVE_SPEED = 1.9;
const WALK_SPEED = 2.8;
const HORN_WINDOW = 5.3;
const INSPECT_DOT = 0.87;
const controls = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' } as const;

export function play(canvas: HTMLCanvasElement) {
  const app = document.querySelector<HTMLElement>('#app')!;
  app.replaceChildren(canvas);
  app.insertAdjacentHTML(
    'beforeend',
    `
    <section class="visit" aria-label="ตอนที่ 2 บ้านย่านุ่น">
      <header>
        <a href="?">← เลือกตอน</a>
        <div><small id="visit-progress"></small><h1 id="visit-title"></h1></div>
        <div class="visit-header-actions">
          <button id="visit-journal" type="button">บันทึก</button>
          <button id="visit-pause" type="button">พัก</button>
        </div>
      </header>
      <div id="visit-reticle" aria-hidden="true"></div>
      <p id="visit-marker" hidden aria-hidden="true">◇</p>
      <div class="visit-objective">
        <p id="visit-objective"></p>
        <progress id="visit-pressure" max="1" hidden aria-label="เวลาเหลือ"></progress>
        <p id="visit-text"></p>
      </div>
      <div id="visit-move" aria-label="เดิน" hidden>
        <button type="button" data-move="up" aria-label="เดินหน้า">↑</button>
        <button type="button" data-move="left" aria-label="เดินซ้าย">←</button>
        <button type="button" data-move="down" aria-label="ถอยหลัง">↓</button>
        <button type="button" data-move="right" aria-label="เดินขวา">→</button>
      </div>
      <div class="visit-actions">
        <button id="visit-other" type="button" hidden></button>
        <button id="visit-next" type="button" hidden></button>
      </div>
      <p id="visit-controls">WASD เดิน · เมาส์มอง · E ใช้งาน · R บันทึก</p>
      <div id="visit-overlay" class="visit-overlay">
        <article class="visit-panel" role="dialog" aria-labelledby="visit-heading">
          <small>ตอนที่ 2 · บ้านย่านุ่น</small>
          <h2 id="visit-heading"></h2>
          <p id="visit-summary"></p>
          <button id="visit-continue" type="button"></button>
          <button id="visit-audio" type="button" aria-pressed="false">ปิดเสียง</button>
          <a href="?">กลับไปเลือกตอน</a>
        </article>
      </div>
    </section>`,
  );
  const get = <Element extends HTMLElement>(id: string) => document.getElementById(id)! as Element;
  const next = get<HTMLButtonElement>('visit-next');
  const other = get<HTMLButtonElement>('visit-other');
  const resume = get<HTMLButtonElement>('visit-continue');
  const mute = get<HTMLButtonElement>('visit-audio');
  const overlay = get('visit-overlay');
  const marker = get('visit-marker');
  const journalButton = get<HTMLButtonElement>('visit-journal');
  const pressure = get<HTMLProgressElement>('visit-pressure');
  const audio = new HorrorAudio();
  const camera = new T.PerspectiveCamera(59, 1, 0.05, 90);
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
  } catch {
    get('visit-heading').textContent = 'เปิดฉาก 3D ไม่ได้';
    get('visit-summary').textContent = 'เบราว์เซอร์นี้ไม่สามารถเริ่ม WebGL ได้';
    resume.hidden = mute.hidden = true;
    return;
  }
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const touchDevice = matchMedia('(pointer: coarse)');
  const portrait = matchMedia('(pointer: coarse) and (orientation: portrait)');
  const keys = new Set<string>();
  const held = new Map<number, string>();
  const direction = new T.Vector3();
  const target = new T.Vector3();
  const delta = new T.Vector3();
  const screen = new T.Vector3();
  const men = [new T.Vector3(2.35, 1.38, -4), new T.Vector3(1.48, 1.38, -9)];
  let scene: T.Scene;
  let lamp: T.SpotLight;
  let cabin: T.Object3D;
  let step = 0;
  let time = 0;
  let last = 0;
  let looked = 0;
  let footDistance = 0;
  let yaw = 0;
  let pitch = 0;
  let phase: 'intro' | 'playing' | 'paused' | 'journal' | 'failed' | 'finished' = 'intro';
  let drag: { id: number; x: number; y: number } | undefined;

  const playing = () => phase === 'playing' && !portrait.matches && !document.hidden;
  const onFoot = () => step >= 6 && step < 15 && step !== 13;
  function clearInput() {
    keys.clear();
    held.clear();
    drag = undefined;
  }
  function updateLabels() {
    const touch = touchDevice.matches;
    const beat = story[step];
    const hint = objectives[step].hint;
    get('visit-objective').textContent = touch ? hint.replace('กด E', 'แตะปุ่มใช้งาน') : hint;
    get('visit-controls').textContent = touch
      ? 'ลากฉากเพื่อมอง'
      : 'WASD เดิน · ลากเมาส์มอง · E ใช้งาน · R บันทึก';
    next.textContent = (touch ? '' : 'E · ') + (beat.action ?? '');
    other.textContent = (touch ? '' : 'Q · ') + (beat.mistake?.[0] ?? '');
    get('visit-move').hidden = !playing() || !onFoot() || !touch;
  }
  function resize() {
    const blocked = portrait.matches;
    get('rotate-device').hidden = !blocked;
    app.inert = blocked;
    clearInput();
    if (blocked && phase === 'playing') pause();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    updateLabels();
  }
  function disposeScene() {
    const geometries = new Set<T.BufferGeometry>();
    const materials = new Set<T.Material>();
    scene?.traverse((object) => {
      if (object instanceof T.Mesh) {
        geometries.add(object.geometry);
        for (const material of [object.material].flat()) materials.add(material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
  function modal(title: string, summary: string, button: string) {
    clearInput();
    overlay.hidden = false;
    next.hidden = other.hidden = marker.hidden = true;
    get('visit-move').hidden = true;
    pressure.hidden = true;
    get('visit-heading').textContent = title;
    get('visit-summary').textContent = summary;
    resume.textContent = button;
    resume.focus();
  }
  function load(keepPosition = false) {
    const beat = story[step];
    disposeScene();
    scene = scenery(beat.scene, step);
    lamp = scene.getObjectByName('player-light') as T.SpotLight;
    cabin = scene.getObjectByName('cabin')!;
    time = looked = footDistance = 0;
    // Release movement across cuts so a key that was held in the previous scene cannot start a new one.
    clearInput();
    if (!keepPosition) {
      yaw = step === 14 ? -0.045 : 0;
      pitch = step === 0 || step === 5 ? -0.6 : step === 13 ? -0.27 : 0;
      camera.position.set(0, step < 6 ? 1.27 : 1.65, 2.5);
    }
    get('visit-progress').textContent = String(step + 1).padStart(2, '0') + ' / ' + story.length;
    get('visit-title').textContent = beat.title;
    get('visit-text').textContent = beat.text;
    updateLabels();
    if (phase === 'playing' && !reduced.matches)
      canvas.animate([{ filter: 'brightness(.06)' }, { filter: 'brightness(1)' }], 240);
    overlay.hidden = phase === 'playing';
    if (step === story.length - 1) {
      phase = 'finished';
      audio.setActive(false);
      audio.cue('win');
      modal(beat.title, beat.text, 'เล่นตอนนี้ใหม่');
    }
  }
  function advance() {
    if (!playing()) return;
    const cue = step === 1 ? 'horn' : step === 9 || step === 13 ? 'danger' : 'interact';
    step++;
    load(step === 8 || step === 10);
    if (phase === 'playing') audio.cue(cue);
  }
  function fail(reason: string) {
    phase = 'failed';
    audio.setActive(false);
    audio.cue('fail');
    modal('ผิดคำเตือนของย่า', reason, 'ลองเหตุการณ์นี้ใหม่');
  }
  function pause() {
    if (phase !== 'playing') return;
    phase = 'paused';
    audio.setActive(false);
    modal('พักเกม', 'กลับมาเล่นต่อจากเหตุการณ์เดิมได้', 'เล่นต่อ');
  }
  function journal() {
    if (!playing()) return;
    phase = 'journal';
    audio.setActive(false);
    const reminder =
      step < 6
        ? 'บีบแตรเมื่อผ่านศาลไม้ อย่าเปิดกระจกตอนมีกลิ่น อย่าจ้องหรือทักชายริมทาง ย่าบอกให้เลี้ยวขวาและออกจากเขาก่อนตีสาม'
        : 'พกย่ามและตะเกียง ระวังเสียงที่เล้าไก่ช่วงสามทุ่ม กระดาษเตือนให้ออกก่อนเที่ยงคืนและนำห่อยาเส้นไปให้ชายแก่ที่คันนา';
    modal('บันทึกคำเตือน', reminder, 'กลับเข้าเกม');
  }
  resume.addEventListener('click', () => {
    if (portrait.matches) return;
    const restart = phase === 'intro' || phase === 'failed' || phase === 'finished';
    if (phase === 'finished') step = 0;
    phase = 'playing';
    if (restart) load();
    overlay.hidden = true;
    get('visit-move').hidden = !onFoot() || !touchDevice.matches;
    resume.blur();
    void audio
      .unlock()
      .then(() => audio.setActive(playing()))
      .catch(() => {});
  });
  mute.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    mute.setAttribute('aria-pressed', String(audio.muted));
    mute.textContent = audio.muted ? 'เปิดเสียง' : 'ปิดเสียง';
  });
  function canInspect() {
    const objective = objectives[step];
    if (objective.kind !== 'inspect') return false;
    target.set(...objective.target);
    delta.subVectors(target, camera.position);
    camera.getWorldDirection(direction);
    return (
      delta.lengthSq() <= objective.range ** 2 && direction.dot(delta.normalize()) >= INSPECT_DOT
    );
  }
  function interact() {
    if (!playing()) return;
    const kind = objectives[step].kind;
    if (
      (kind === 'horn' && time >= 0.5) ||
      kind === 'signal' ||
      (kind === 'junction' && time >= 2.5) ||
      canInspect()
    )
      advance();
  }
  function wrongAction() {
    if (!playing()) return;
    if (step === 2) fail('อย่าเปิดกระจกเมื่อได้กลิ่นแปลก รอให้รถผ่านไปก่อน');
    if (step === 3) fail('อย่าทักชายที่ยืนริมถนน ทำเหมือนไม่เห็นแล้วรอให้รถผ่าน');
    if (step === 4 && time >= 2.5) fail('ทางซ้ายยังอยู่ในเขตเขา ย่านุ่นบอกให้เลี้ยวขวา');
  }
  next.addEventListener('click', interact);
  other.addEventListener('click', wrongAction);
  get('visit-pause').addEventListener('click', pause);
  journalButton.addEventListener('click', journal);

  document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && playing()) pause();
    if (!playing()) return;
    if (
      event.code.startsWith('Arrow') ||
      Object.values(controls).some((code) => code === event.code)
    ) {
      event.preventDefault();
      keys.add(event.code);
    }
    if (event.repeat) return;
    if (event.code === 'KeyE') interact();
    if (event.code === 'KeyQ') wrongAction();
    if (event.code === 'KeyR') journal();
  });
  document.addEventListener('keyup', (event) => keys.delete(event.code));
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-move]')) {
    button.addEventListener('pointerdown', (event) => {
      if (!playing() || !onFoot()) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      held.set(event.pointerId, controls[button.dataset.move as keyof typeof controls]);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(name, (event) => held.delete((event as PointerEvent).pointerId));
    }
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (!playing() || drag) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!playing() || drag?.id !== event.pointerId) return;
    yaw -= (event.clientX - drag.x) * 0.005;
    if (step < 6) yaw = T.MathUtils.clamp(yaw, -1.05, 1.05);
    pitch = T.MathUtils.clamp(pitch - (event.clientY - drag.y) * 0.005, -1.19, 1.05);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('lostpointercapture', (event) => {
    if (drag?.id === event.pointerId) drag = undefined;
  });
  function down(code: string) {
    if (keys.has(code)) return true;
    for (const active of held.values()) if (active === code) return true;
    return false;
  }

  function move(dt: number) {
    if (!touchDevice.matches) {
      yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.8;
      pitch += (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * dt * 1.4;
      pitch = T.MathUtils.clamp(pitch, -1.19, 1.05);
      if (step < 6) yaw = T.MathUtils.clamp(yaw, -1.05, 1.05);
    }
    if (step >= 1 && step <= 4) {
      const roadTime = step === 4 ? Math.min(time, 2.5) : time;
      cabin.position.z = -roadTime * DRIVE_SPEED;
      camera.position.z = 2.5 + cabin.position.z;
    } else if (onFoot()) {
      const forward = Number(down(controls.up)) - Number(down(controls.down));
      const sideways = Number(down(controls.right)) - Number(down(controls.left));
      const scale = (WALK_SPEED * dt) / Math.max(1, Math.hypot(forward, sideways));
      const edge = step >= 12 ? 0.92 : 2.1;
      camera.position.x = T.MathUtils.clamp(
        camera.position.x + (sideways * Math.cos(yaw) - forward * Math.sin(yaw)) * scale,
        -edge,
        edge,
      );
      camera.position.z = T.MathUtils.clamp(
        camera.position.z - (sideways * Math.sin(yaw) + forward * Math.cos(yaw)) * scale,
        -6,
        5,
      );
      if (forward || sideways) {
        footDistance += scale;
        if (footDistance > 0.55) {
          audio.cue('footstep');
          footDistance = 0;
        }
      }
      const floor =
        story[step].scene === 'hut' ? 0.5 * T.MathUtils.smoothstep(-camera.position.z, 2.4, 3) : 0;
      camera.position.y = 1.65 + floor;
    }
    if (step === 13)
      camera.position.y = T.MathUtils.lerp(camera.position.y, 0.78, Math.min(1, dt * 4));
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.getWorldDirection(direction);
    lamp.position.copy(camera.position);
    lamp.position.y -= 0.13;
    lamp.target.position.copy(camera.position).addScaledVector(direction, 8);
  }
  function update(dt: number) {
    time += dt;
    move(dt);
    const objective = objectives[step];
    let available = false;
    let secondary = false;
    marker.hidden = true;
    pressure.hidden = true;
    switch (objective.kind) {
      case 'horn':
        if (time > HORN_WINDOW) {
          fail('รถผ่านศาลไม้ไปแล้ว ลองใหม่และบีบแตรให้ทัน');
          return;
        }
        pressure.hidden = false;
        pressure.value = 1 - time / HORN_WINDOW;
        available = time >= 0.5;
        break;
      case 'wait':
        secondary = true;
        if (time >= 4) {
          advance();
          return;
        }
        break;
      case 'avert':
        secondary = true;
        if (
          men.some((man) => {
            delta.subVectors(man, camera.position);
            return delta.lengthSq() < 64 && direction.dot(delta.normalize()) > 0.984;
          })
        )
          looked += dt;
        else looked = Math.max(0, looked - dt * 2);
        if (looked > 1.15) {
          fail('จ้องชายริมถนนนานเกินไป มองกลับมาที่ถนนแล้วรอให้รถผ่าน');
          return;
        }
        if (time >= 6.1) {
          advance();
          return;
        }
        break;
      case 'junction':
        available = secondary = time >= 2.5;
        break;
      case 'signal':
        available = true;
        break;
      case 'inspect':
      case 'reach':
      case 'observe': {
        target.set(...objective.target);
        delta.subVectors(target, camera.position);
        const inRange = delta.lengthSq() <= objective.range ** 2;
        const aiming = direction.dot(delta.normalize()) >= INSPECT_DOT;
        if (objective.kind === 'reach' && inRange) {
          advance();
          return;
        }
        if (objective.kind === 'observe') {
          looked = inRange && aiming ? looked + dt : 0;
          pressure.hidden = false;
          pressure.value = Math.min(1, looked / 0.9);
          if (looked >= 0.9) {
            advance();
            return;
          }
        }
        available = objective.kind === 'inspect' && inRange && aiming;
        if (direction.dot(delta) > 0.08) {
          camera.updateMatrixWorld();
          screen.copy(target).project(camera);
          if (Math.abs(screen.x) < 0.97 && Math.abs(screen.y) < 0.95) {
            marker.hidden = false;
            marker.style.left = 50 + screen.x * 50 + '%';
            marker.style.top = 50 - screen.y * 50 + '%';
          }
        }
        break;
      }
    }
    next.hidden = !available;
    other.hidden = !secondary;
  }
  window.addEventListener('resize', resize);
  portrait.addEventListener('change', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', pause);
  window.addEventListener('pagehide', () => audio.setActive(false));
  load();
  modal('กฎในการไปเยี่ยมบ้านย่านุ่น', 'ฟังคำเตือนของย่า ระวังสิ่งที่อยู่ริมถนน และเอาตัวรอดให้ถึงรุ่งเช้า', 'เริ่มเดินทาง');
  resize();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (portrait.matches) return;
    if (playing()) update(dt);
    if (!playing()) camera.rotation.set(pitch, yaw, 0, 'YXZ');
    if (!reduced.matches && playing() && step === 13)
      camera.rotation.z = Math.sin(time * 9) * 0.025;
    renderer.render(scene, camera);
  });
}
