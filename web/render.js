// The renderer: one WebGL canvas, bloom, the active scene, and a frame loop that can be capped
// (30 fps in a session saves battery) or stopped entirely when the screen fades to black.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createCaveScene } from './scenes/cave.js';
import { createDriveScene } from './scenes/drive.js';

const SCENES = { cave: createCaveScene, drive: createDriveScene };

export function createRenderer(canvas, { mobile }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'low-power' });
  let dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.5, 0.6);
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());

  let active = null, activeKey = '', running = false, raf = 0, last = 0, t = 0, fpsCap = 60, acc = 0;
  let state = { energy: 1 };
  let eventSource = () => [];
  let audioTime = () => t;
  const frameTimes = [];

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    if (active) { active.camera.aspect = w / h; active.camera.fov = w / h < 0.8 ? (active.portraitFov ?? 70) : active.camera.userData.fov0; active.camera.updateProjectionMatrix(); }
  }
  addEventListener('resize', resize);

  function setScene(key, seed) {
    if (key + seed === activeKey) return;
    if (active) active.dispose();
    active = SCENES[key]({ mobile, seed });
    activeKey = key + seed;
    active.camera.userData.fov0 = active.camera.fov;
    renderPass.scene = active.scene; renderPass.camera = active.camera;
    renderer.toneMapping = active.look.toneMapping; renderer.toneMappingExposure = active.look.exposure;
    [bloom.strength, bloom.radius, bloom.threshold] = active.look.bloom;
    resize();
    active.update(t, 0.016, state);
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    acc += dt;
    if (acc < 1 / fpsCap - 0.004) return;
    const step = Math.min(0.1, acc); acc = 0;
    t += step;
    if (active) {
      const at = audioTime();
      for (const ev of eventSource()) active.onEvent(ev, t - Math.max(0, at - ev.time));
      active.update(t, step, state);
      composer.render(step);
    }
    // if frames run slow, drop the resolution a notch (once or twice)
    frameTimes.push(step);
    if (frameTimes.length > 90) {
      frameTimes.sort((a, b) => a - b);
      const median = frameTimes[45];
      frameTimes.length = 0;
      if (median > 1.6 / fpsCap && dpr > 0.75) { dpr = Math.max(0.75, dpr * 0.8); renderer.setPixelRatio(dpr); resize(); }
    }
  }

  return {
    setScene,
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    get running() { return running; },
    setFps(f) { fpsCap = f; },
    setState(s) { state = { ...state, ...s }; },
    setEvents(src, clock) { eventSource = src; audioTime = clock; },
    snapshot() { composer.render(0); return canvas.toDataURL('image/png'); },
  };
}
