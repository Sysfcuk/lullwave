// The renderer: one WebGL canvas, bloom, the active scene, and a frame loop that can be capped
// (30 fps in a session saves battery) or stopped entirely when the screen fades to black.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createCaveScene } from './scenes/cave.js';
import { createDriveScene } from './scenes/drive.js';
import { createOceanScene } from './scenes/ocean.js';
import { createAuroraScene } from './scenes/aurora.js';
import { createRainScene } from './scenes/rain.js';
import { createSpaceScene } from './scenes/space.js';
import { createDiscoScene } from './scenes/disco.js';
import { createEventingScene } from './scenes/eventing.js';
import { createCotswoldScene } from './scenes/cotswold.js';
import { createMeadowScene } from './scenes/dream/meadow.js';
import { createEstateScene } from './scenes/dream/estate.js';
import { createWoolpackScene } from './scenes/dream/woolpack.js';
import { createCanalScene } from './scenes/dream/canal.js';
import { createStablesScene } from './scenes/dream/stables.js';
import { createMarketScene } from './scenes/dream/market.js';
import { createTrailScene } from './scenes/dream/trail.js';
import { createChoirScene } from './scenes/dream/choir.js';
import { createPennyScene } from './scenes/dream/penny.js';
import { createPizzaScene } from './scenes/dream/pizza.js';
import { createLostScene } from './scenes/dream/lost.js';
import { createStardomeScene } from './scenes/dream/stardome.js';
import { createBakeryScene } from './scenes/dream/bakery.js';
import { createFeverScene } from './scenes/dream/fever.js';
import { createSheepScene } from './scenes/dream/sheep.js';
import { createPixelScene } from './scenes/dream/pixel.js';
import { createSandsScene } from './scenes/dream/sands.js';
import { createSnowstormScene } from './scenes/dream/snowstorm.js';
import { createSaysNoScene } from './scenes/dream/saysno.js';
import { createTrainScene } from './scenes/dream/train.js';

const SCENES = { cave: createCaveScene, drive: createDriveScene, ocean: createOceanScene, aurora: createAuroraScene, rain: createRainScene, space: createSpaceScene, disco: createDiscoScene, eventing: createEventingScene, cotswold: createCotswoldScene,
  meadow: createMeadowScene, estate: createEstateScene, woolpack: createWoolpackScene, canal: createCanalScene, stables: createStablesScene, market: createMarketScene, trail: createTrailScene, choir: createChoirScene, penny: createPennyScene, pizza: createPizzaScene, lost: createLostScene, stardome: createStardomeScene, bakery: createBakeryScene, fever: createFeverScene, sheep: createSheepScene, pixel: createPixelScene, sands: createSandsScene, snowstorm: createSnowstormScene, saysno: createSaysNoScene, train: createTrainScene };

// The finishing pass, after tone mapping: a little chromatic aberration towards the edges, a
// vignette, and fine animated grain, which also dithers away the banding that dark gradients
// show on 8-bit (and especially OLED) screens.
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 }, uVignette: { value: 0.3 }, uGrain: { value: 0.02 }, uCA: { value: 0.4 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAspect, uVignette, uGrain, uCA; varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 c = vUv - .5; vec2 ca = vec2(c.x * uAspect, c.y);
      float r2 = dot(ca, ca);
      vec2 off = c * r2 * uCA * .02;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1. - uVignette * smoothstep(.05, .75, r2);
      // triangular-ish grain: two hashes, so it dithers evenly
      vec2 px = gl_FragCoord.xy + fract(uTime * 7.31) * 113.;
      float n = hash(px) + hash(px + 71.7) - 1.;
      col += n * uGrain * (.35 + .65 * (1. - dot(col, vec3(.299, .587, .114))));
      gl_FragColor = vec4(max(col, 0.), 1.);
    }`,
};

export function createRenderer(canvas, { mobile }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'low-power' });
  let dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // multisampled targets smooth the edges (the canvas itself can't antialias through post passes)
  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: mobile ? 2 : 4 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.5, 0.6);
  const finish = new ShaderPass(FinishShader);
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(finish);

  let active = null, activeKey = '', running = false, raf = 0, last = 0, t = 0, fpsCap = 60, acc = 0;
  let state = { energy: 1 };
  let eventSource = () => [];
  let audioTime = () => t;
  const frameTimes = [];
  const adaptive = !location.search.includes('fixedres'); // ?fixedres for screenshots in a throttled tab

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    finish.uniforms.uAspect.value = w / h;
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
    renderer.shadowMap.enabled = !!active.look.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    [bloom.strength, bloom.radius, bloom.threshold] = active.look.bloom;
    const f = active.look.finish ?? {};
    finish.uniforms.uVignette.value = f.vignette ?? 0.3; finish.uniforms.uGrain.value = f.grain ?? 0.02; finish.uniforms.uCA.value = f.ca ?? 0.4;
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
      finish.uniforms.uTime.value = t;
      composer.render(step);
    }
    // if frames run slow, drop the resolution a notch (once or twice)
    frameTimes.push(step);
    if (frameTimes.length > 90) {
      frameTimes.sort((a, b) => a - b);
      const median = frameTimes[45];
      frameTimes.length = 0;
      if (adaptive && median > 1.6 / fpsCap && dpr > 0.75) { dpr = Math.max(0.75, dpr * 0.8); renderer.setPixelRatio(dpr); resize(); }
    }
  }

  return {
    setScene,
    register(id, factory) { SCENES[id] = factory; },
    get active() { return active; },
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    get running() { return running; },
    setFps(f) { fpsCap = f; },
    setState(s) { state = { ...state, ...s }; },
    setEvents(src, clock) { eventSource = src; audioTime = clock; },
    snapshot() { composer.render(0); return canvas.toDataURL('image/png'); },
    get memory() { return { ...renderer.info.memory, programs: renderer.info.programs?.length }; },
  };
}
