// Round and Round: spirographs of light, drawn one at a time in the dark. A glittering pen traces
// each curve as the ghost of its two gears turns, sparks trailing behind it and the fresh ink
// glowing. When a drawing closes it lingers a moment, then slowly melts into the background: a
// canvas that is always blurring, drifting outwards and turning very slowly, so every drawing
// that has gone before is still there as a soft, swirling haze of colour behind the new one.
// The music chooses the gears (see spiro-plan.js), so each drawing is the interval you can hear,
// and each petal's tip lands on a bell. Through the night the curves get plainer, slower and
// cooler, until the last ones are slow silver ovals.
import { createStage, nightSky, motes, canvasTexture, THREE } from '../kit.js';
import { pickDrawing, drawingBars, penAt, closeAt } from './spiro-plan.js';

const INK_VERT = `
attribute vec2 aN; attribute float aU, aSide;
uniform float uW;
varying float vU, vSide;
void main() {
  vU = aU; vSide = aSide;
  vec3 p = position + vec3(aN * aSide * uW, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const INK_FRAG = `
uniform float uHead, uOpacity, uTime, uCore, uGlit, uWet, uHalo;
uniform vec3 uC0, uC1; uniform float uBands;
varying float vU, vSide;
float h1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
void main() {
  if (vU > uHead) discard;
  float x = abs(vSide);
  float core = smoothstep(uCore, uCore * 0.3, x);
  float halo = exp(-x * x * 7.0) * uHalo;
  vec3 c = mix(uC0, uC1, 0.5 - 0.5 * cos(vU * 6.2832 * uBands));
  // gel-pen glitter: a fleck here and there along the line, each twinkling at its own pace
  float cell = floor(vU * uGlit), g = h1(cell);
  float tw = step(0.9, g) * pow(0.5 + 0.5 * sin(uTime * (1.5 + g * 4.0) + g * 60.0), 3.0);
  // the fresh ink just behind the pen still glows
  float wet = exp(-(uHead - vU) * uWet);
  vec3 col = c * (core * (1.0 + wet * 2.0) + halo * (1.0 + wet * 3.0)) + vec3(1.0, 0.96, 0.9) * tw * core * 1.6;
  gl_FragColor = vec4(col * uOpacity, 1.0);
}`;
const QUAD_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// one step of the background: a soft blur, pulled very slightly outwards and round, and faded
const PASS_FRAG = `
uniform sampler2D uPrev; uniform vec2 uTexel; uniform float uFade, uZoom, uRot;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5; float cs = cos(uRot), sn = sin(uRot);
  vec2 uv = mat2(cs, -sn, sn, cs) * c * uZoom + 0.5;
  vec3 a = texture2D(uPrev, uv).rgb * 0.44;
  a += texture2D(uPrev, uv + uTexel * vec2(0.32, 0.12)).rgb * 0.14;
  a += texture2D(uPrev, uv + uTexel * vec2(-0.12, 0.32)).rgb * 0.14;
  a += texture2D(uPrev, uv + uTexel * vec2(-0.32, -0.12)).rgb * 0.14;
  a += texture2D(uPrev, uv + uTexel * vec2(0.12, -0.32)).rgb * 0.14;
  float r = length(vUv - 0.5) * 2.0;
  gl_FragColor = vec4(a * uFade * (1.0 - smoothstep(0.75, 1.0, r) * 0.04), 1.0);
}`;
const SHOW_FRAG = `
uniform sampler2D uTex; uniform float uGain;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  vec3 c = texture2D(uTex, vUv).rgb * (1.0 - smoothstep(0.7, 1.0, r));
  gl_FragColor = vec4(c * uGain, 1.0);
}`;
const SPARK_VERT = `
uniform float uTime, uScale;
attribute vec3 aVel, aCol; attribute float aBirth, aLife, aSize, aSeed;
varying vec3 vCol; varying float vA;
void main() {
  float age = uTime - aBirth, k = age / aLife;
  vec3 p = position + aVel * age; p.y -= 0.003 * age * age; // glitter settling slowly
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float alive = step(0.0, age) * step(k, 1.0);
  float tw = 0.5 + 0.5 * sin(age * (4.0 + aSeed * 8.0) + aSeed * 30.0);
  vA = alive * (1.0 - k) * (1.0 - k) * min(1.0, age * 6.0) * (0.35 + 0.65 * tw * tw);
  gl_PointSize = alive * aSize * uScale / -mv.z;
  vCol = aCol;
}`;
const SPARK_FRAG = `
uniform float uGain;
varying vec3 vCol; varying float vA;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q);
  float core = exp(-d * d * 140.0);
  float rays = exp(-abs(q.x) * 70.0) * exp(-abs(q.y) * 6.0) + exp(-abs(q.y) * 70.0) * exp(-abs(q.x) * 6.0);
  float a = (core * 1.5 + rays * 0.9 + exp(-d * d * 30.0) * 0.25) * vA * smoothstep(0.5, 0.36, d);
  gl_FragColor = vec4(mix(vCol, vec3(1.0), core * 0.7) * a * uGain, 1.0);
}`;

export function createSpiroScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x5b1, bg: '#05040d', exposure: 1, bloom: [0.75, 0.5, 0.42], finish: { vignette: 0.55, grain: 0.02, ca: 0.5 }, fov: 50 });
  const { rand, camera, U } = S;
  nightSky(S, { top: '#04030c', horizon: '#0c0a1e', moon: [0, -1, 0], moonSize: 0.0001, halo: '#000000', stars: 0.55, clouds: 0, tint: '#140a24' });
  const L = 4.4, RES = mobile ? 512 : 768, BG_HZ = 30;
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false };

  // ---------------------------------------------------------------- the background canvas
  const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  let rtA = S.keep(new THREE.WebGLRenderTarget(RES, RES, rtOpts)), rtB = S.keep(new THREE.WebGLRenderTarget(RES, RES, rtOpts));
  const quadGeo = S.keep(new THREE.PlaneGeometry(2, 2));
  const PU = { uPrev: { value: null }, uTexel: { value: new THREE.Vector2(1 / RES, 1 / RES) }, uFade: { value: Math.exp(-1 / (BG_HZ * 80)) }, uZoom: { value: 0.99993 }, uRot: { value: 0.00012 } };
  const passScene = new THREE.Scene(), passCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  passScene.add(new THREE.Mesh(quadGeo, S.keep(new THREE.ShaderMaterial({ uniforms: PU, vertexShader: QUAD_VERT, fragmentShader: PASS_FRAG, depthTest: false, depthWrite: false }))));
  const inkScene = new THREE.Scene(), inkCam = new THREE.OrthographicCamera(-L / 2, L / 2, L / 2, -L / 2, -1, 1);
  const SU = { uTex: { value: rtA.texture }, uGain: { value: 1 } };
  const show = new THREE.Mesh(new THREE.PlaneGeometry(L, L), new THREE.ShaderMaterial({ uniforms: SU, vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: SHOW_FRAG, ...add }));
  show.renderOrder = 1; show.frustumCulled = false; S.add(show);

  // ---------------------------------------------------------------- a drawing's line
  function inkMaterial(dr, { w, core, halo, max = false }) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uW: { value: w }, uCore: { value: core }, uHalo: { value: halo }, uHead: { value: 0 }, uOpacity: { value: 1 }, uTime: U.uTime, uGlit: { value: 2400 }, uWet: { value: 60 }, uBands: { value: Math.max(1, Math.round(dr.laps / 2)) }, uC0: { value: new THREE.Color(dr.c0) }, uC1: { value: new THREE.Color(dr.c1) } },
      vertexShader: INK_VERT, fragmentShader: INK_FRAG, side: THREE.DoubleSide, ...add,
    });
    // on screen, where the line crosses itself it stays a line (the brighter wins) rather than piling up into a white-out
    if (max) { m.blending = THREE.CustomBlending; m.blendEquation = THREE.MaxEquation; }
    return m;
  }
  /** The curve as a ribbon: two vertices a sample, each knowing how far along the curve it is. */
  function curveGeometry(dr) {
    const thMax = closeAt(dr), k = Math.abs((dr.R - dr.r) / dr.r);
    const n = Math.min(14000, Math.ceil(thMax * (1 + k) * (mobile ? 26 : 34)) + 1);
    const s = 0.94 / ((dr.R - dr.r) + dr.d);
    const pts = new Float32Array(n * 2), p = { x: 0, y: 0 };
    for (let i = 0; i < n; i++) { penAt(dr, (i / (n - 1)) * thMax, p); pts[i * 2] = p.x * s; pts[i * 2 + 1] = p.y * s; }
    const pos = new Float32Array(n * 6), nrm = new Float32Array(n * 4), u = new Float32Array(n * 2), side = new Float32Array(n * 2);
    let nx = 0, ny = 1;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      const tx = pts[b * 2] - pts[a * 2], ty = pts[b * 2 + 1] - pts[a * 2 + 1], len = Math.hypot(tx, ty);
      if (len > 1e-7) { nx = -ty / len; ny = tx / len; }
      for (let sd = 0; sd < 2; sd++) {
        const v = i * 2 + sd;
        pos[v * 3] = pts[i * 2]; pos[v * 3 + 1] = pts[i * 2 + 1];
        nrm[v * 2] = nx; nrm[v * 2 + 1] = ny; u[v] = i / (n - 1); side[v] = sd ? 1 : -1;
      }
    }
    const idx = new Uint32Array((n - 1) * 6);
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aN', new THREE.BufferAttribute(nrm, 2));
    g.setAttribute('aU', new THREE.BufferAttribute(u, 1)); g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.userData = { n, s, thMax };
    return g;
  }
  const W_LINE = mobile ? 0.016 : 0.013, W_BG = 0.032;
  function makeDrawing(dr, dur, owned) {
    const geom = curveGeometry(dr);
    const mesh = new THREE.Mesh(geom, inkMaterial(dr, { w: W_LINE, core: 0.26, halo: 0.2, max: true }));
    mesh.material.uniforms.uWet.value = geom.userData.n / 70;
    mesh.rotation.z = dr.rot; mesh.renderOrder = 2; mesh.frustumCulled = false; S.add(mesh);
    const bg = new THREE.Mesh(geom, inkMaterial(dr, { w: W_BG, core: 0.5, halo: 0.4 }));
    bg.material.uniforms.uWet.value = 1e4; bg.rotation.z = dr.rot; bg.frustumCulled = false; bg.visible = false; inkScene.add(bg);
    return { dr, geom, mesh, bg, dur, t0: clock, head: 0, done: false, endT: 0, owned, rel: 0 };
  }
  function dropDrawing(d) {
    S.scene.remove(d.mesh); inkScene.remove(d.bg);
    d.geom.dispose(); d.mesh.material.dispose(); d.bg.material.dispose();
  }

  // ---------------------------------------------------------------- the gears, as ghosts
  const gearMat = new THREE.LineBasicMaterial({ color: '#b8c4ff', opacity: 0, ...add });
  const GEAR = 0.1;
  const rig = new THREE.Group(); rig.renderOrder = 3; S.add(rig);
  let ring = null, wheel = null;
  const toothed = (rad, teeth, depth) => {
    const pts = [], N = Math.max(96, teeth * 8);
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, rr = rad + depth * Math.max(-1, Math.min(1, Math.sin(a * teeth) * 1.6)); pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0)); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  };
  function buildGears(d) {
    for (const o of [ring, wheel]) if (o) { rig.remove(o); o.traverse((x) => x.geometry?.dispose()); }
    const { R, r, d: hole } = d.dr, s = d.geom.userData.s, m = Math.max(1, Math.round(96 / R));
    ring = new THREE.LineLoop(toothed(R * s + 0.012, R * m, 0.006), gearMat); ring.renderOrder = 3; rig.add(ring);
    wheel = new THREE.Group(); rig.add(wheel);
    const rim = new THREE.LineLoop(toothed(r * s - 0.006, r * m, 0.006), gearMat); rim.renderOrder = 3; wheel.add(rim);
    const holeLoop = new THREE.LineLoop(toothed(0.012, 1, 0), gearMat); holeLoop.position.x = hole * s; holeLoop.renderOrder = 3; wheel.add(holeLoop);
    const arm = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(hole * s, 0, 0)]), gearMat); arm.renderOrder = 3; wheel.add(arm);
    rig.rotation.z = d.dr.rot;
  }
  S.keep({ dispose() { for (const o of [ring, wheel]) if (o) o.traverse((x) => x.geometry?.dispose()); } });

  // ---------------------------------------------------------------- sparkle
  const NP = mobile ? 500 : 800;
  const sp = { pos: new Float32Array(NP * 3), vel: new Float32Array(NP * 3), col: new Float32Array(NP * 3), birth: new Float32Array(NP).fill(-99), life: new Float32Array(NP).fill(1), size: new Float32Array(NP), seed: new Float32Array(NP) };
  const spGeo = new THREE.BufferGeometry();
  const spAttr = {
    position: new THREE.BufferAttribute(sp.pos, 3), aVel: new THREE.BufferAttribute(sp.vel, 3), aCol: new THREE.BufferAttribute(sp.col, 3),
    aBirth: new THREE.BufferAttribute(sp.birth, 1), aLife: new THREE.BufferAttribute(sp.life, 1), aSize: new THREE.BufferAttribute(sp.size, 1), aSeed: new THREE.BufferAttribute(sp.seed, 1),
  };
  for (const k in spAttr) { spAttr[k].setUsage(THREE.DynamicDrawUsage); spGeo.setAttribute(k, spAttr[k]); }
  const SPU = { uTime: U.uTime, uScale: U.uScale, uGain: { value: 1 } };
  const sparks = new THREE.Points(spGeo, new THREE.ShaderMaterial({ uniforms: SPU, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, ...add }));
  sparks.frustumCulled = false; sparks.renderOrder = 4; S.add(sparks);
  let spI = 0, spDirty = false;
  const tmpC = new THREE.Color();
  function spark(x, y, { vel = 0.02, life = 4, size = 0.02, color }) {
    const i = spI; spI = (spI + 1) % NP;
    const a = rand() * Math.PI * 2, v = vel * (0.3 + rand() * 0.7);
    sp.pos.set([x, y, (rand() - 0.5) * 0.02], i * 3); sp.vel.set([Math.cos(a) * v, Math.sin(a) * v, (rand() - 0.5) * v], i * 3);
    sp.col.set([color.r, color.g, color.b], i * 3);
    sp.birth[i] = clock; sp.life[i] = life * (0.6 + rand() * 0.8); sp.size[i] = size * (0.6 + rand() * 0.8); sp.seed[i] = rand();
    spDirty = true;
  }

  // ---------------------------------------------------------------- the pen
  const penTex = canvasTexture(S, 128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.12, 'rgba(255,250,240,0.8)'); r.addColorStop(0.4, 'rgba(255,240,230,0.12)'); r.addColorStop(1, 'rgba(255,240,230,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (const [sx, sy] of [[1, 0.06], [0.06, 1]]) { const lg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); lg.addColorStop(0, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.save(); g.translate(w / 2, h / 2); g.scale(sx, sy); g.translate(-w / 2, -h / 2); g.fillStyle = lg; g.fillRect(0, 0, w, h); g.restore(); }
  });
  const pen = new THREE.Sprite(new THREE.SpriteMaterial({ map: penTex, color: '#ffffff', ...add }));
  pen.renderOrder = 5; pen.scale.setScalar(0.14); S.add(pen);

  // ---------------------------------------------------------------- the night's drawings
  let clock = 0, cur = null, prev = null, lastEnd = -3.5, heardMusic = false, energy = 1;
  const fading = [];
  const HOLD = 3, MELT = 12;
  function start(dr, dur, owned) {
    if (cur) release(cur);
    cur = makeDrawing(dr, dur, owned); prev = dr; buildGears(cur);
  }
  function release(d) { d.rel = clock; d.dep = 0; d.bg.visible = true; fading.push(d); if (cur === d) { cur = null; lastEnd = clock; } }
  function headPos(d, u, out) { penAt(d.dr, u * d.geom.userData.thMax, out); const s = d.geom.userData.s, c = Math.cos(d.dr.rot), sn = Math.sin(d.dr.rot), x = out.x * s, y = out.y * s; out.x = x * c - y * sn; out.y = x * sn + y * c; return out; }
  const P = { x: 0, y: 0 };
  function glint(d, big) {
    if (!d || d.head <= 0.002) return;
    headPos(d, rand() * d.head, P);
    const u = rand();
    tmpC.set(d.dr.c0).lerp(tmpC.clone().set(d.dr.c1), u);
    spark(P.x, P.y, { vel: 0.002, life: big ? 1.8 : 1.2, size: big ? 0.11 : 0.06, color: tmpC });
  }
  S.onEvent((ev) => {
    if (ev.type === 'spiro') { heardMusic = true; start(ev.dr, ev.dur, 'music'); }
    else if (ev.type === 'glint') { glint(cur || fading[fading.length - 1], true); if (rand() < 0.5) glint(cur, false); }
  });

  // ---------------------------------------------------------------- the background, step by step
  let bgDue = 0, warmed = false;
  function deposit(renderer, d, amount, head) {
    d.bg.visible = true; d.bg.material.uniforms.uOpacity.value = amount; d.bg.material.uniforms.uHead.value = head;
    renderer.render(inkScene, inkCam);
  }
  function bgStep(renderer) {
    PU.uPrev.value = rtA.texture;
    renderer.setRenderTarget(rtB); renderer.render(passScene, passCam);
    const live = fading.filter((d) => d.dep > 0);
    if (live.length) { for (const d of inkScene.children) d.visible = false; for (const d of live) { d.bg.visible = true; d.bg.material.uniforms.uOpacity.value = d.dep; d.bg.material.uniforms.uHead.value = d.head; d.dep = 0; } renderer.render(inkScene, inkCam); }
    [rtA, rtB] = [rtB, rtA];
  }
  function warm(renderer) {
    // the night didn't start with an empty page: a couple of drawings are already melting away
    renderer.setRenderTarget(rtA); renderer.setClearColor(0x000000, 1); renderer.clear();
    renderer.setRenderTarget(rtB); renderer.clear();
    let pd = null;
    for (const [amt, steps] of [[0.3, 240], [0.22, 70]]) {
      const dr = pickDrawing(rand, 1, pd); pd = dr;
      const d = makeDrawing(dr, 1, 'warm'); S.scene.remove(d.mesh);
      for (const o of inkScene.children) o.visible = false;
      renderer.setRenderTarget(rtA); deposit(renderer, d, amt, 1);
      d.bg.visible = false;
      for (let i = 0; i < steps; i++) bgStep(renderer);
      dropDrawing(d);
    }
  }
  show.onBeforeRender = (renderer, scene, cam) => {
    if (cam !== camera) return;
    const rt = renderer.getRenderTarget(), ac = renderer.autoClear, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.autoClear = false;
    if (!warmed) { warmed = true; warm(renderer); }
    const n = Math.min(3, Math.floor(bgDue)); bgDue -= n; if (bgDue > 3) bgDue = 0;
    for (let i = 0; i < n; i++) bgStep(renderer);
    renderer.setRenderTarget(rt); renderer.autoClear = ac; renderer.setClearColor(cc, ca);
    SU.uTex.value = rtA.texture;
  };

  // ---------------------------------------------------------------- each frame
  let emitAcc = 0, glintAcc = 0;
  const pc = new THREE.Color();
  S.on((t, dt, st) => {
    clock = t; energy = st.energy;
    const e = energy;
    bgDue += dt * BG_HZ;
    // with no music to choose them, choose our own
    if (!cur && clock - lastEnd > (heardMusic ? 16 : 6)) {
      const dr = pickDrawing(rand, e, prev);
      start(dr, drawingBars(dr, e) * 4 * dr.petals, 'local');
    }
    if (cur) {
      const d = cur, u = d.mesh.material.uniforms;
      d.head = Math.min(1, (clock - d.t0) / d.dur);
      u.uHead.value = d.head; u.uOpacity.value = 0.5 + 0.5 * e; d.op = u.uOpacity.value;
      const n = d.geom.userData.n;
      d.geom.setDrawRange(0, Math.min((n - 1) * 6, Math.ceil(d.head * (n - 1) + 1) * 6));
      const th = d.head * d.geom.userData.thMax, s = d.geom.userData.s, k = (d.dr.R - d.dr.r) / d.dr.r;
      wheel.position.set((d.dr.R - d.dr.r) * s * Math.cos(th), (d.dr.R - d.dr.r) * s * Math.sin(th), 0); wheel.rotation.z = -k * th;
      headPos(d, d.head, P);
      pc.set(d.dr.c0).lerp(tmpC.set(d.dr.c1), d.head);
      if (!d.done) {
        pen.visible = true; pen.position.set(P.x, P.y, 0.002);
        pen.material.color.copy(pc).lerp(tmpC.set('#ffffff'), 0.55);
        pen.scale.setScalar((mobile ? 0.17 : 0.14) * (0.85 + 0.15 * Math.sin(t * 7.3)) * (0.6 + 0.4 * e));
        gearMat.opacity = Math.min(1, (clock - d.t0) / 2.5) * GEAR * (0.35 + 0.65 * e);
        // glitter shed from the pen as it goes
        emitAcc += dt * (10 + 22 * e);
        while (emitAcc >= 1) { emitAcc -= 1; spark(P.x + (rand() - 0.5) * 0.01, P.y + (rand() - 0.5) * 0.01, { vel: 0.03, life: 3 + 3 * e, size: 0.022 + rand() * 0.02, color: pc }); }
        if (d.head >= 1) { d.done = true; d.endT = clock; for (let i = 0; i < 14; i++) spark(P.x, P.y, { vel: 0.07, life: 3, size: 0.03, color: pc }); }
      } else {
        pen.visible = false;
        gearMat.opacity = Math.max(0, 1 - (clock - d.endT) / 1.5) * GEAR * (0.35 + 0.65 * e);
        if (clock - d.endT > HOLD) release(d);
      }
    } else { pen.visible = false; gearMat.opacity = 0; }
    // now and then a glint catches the line
    glintAcc += dt * (0.25 + 0.5 * e);
    if (glintAcc >= 1) { glintAcc -= 1 + rand(); glint(cur || fading[fading.length - 1], false); }
    // drawings melting away into the background
    for (let i = fading.length - 1; i >= 0; i--) {
      const d = fading[i], k = (clock - d.rel) / MELT;
      if (k >= 1) { fading.splice(i, 1); dropDrawing(d); continue; }
      d.mesh.material.uniforms.uOpacity.value = (d.op ?? 1) * Math.pow(1 - k, 1.6);
      d.mesh.material.uniforms.uWet.value = 1e4;
      d.dep += dt * 1.3 / MELT * Math.sin(Math.PI * k) * 1.57; // what goes into the background, a little each step
    }
    if (spDirty) { for (const k in spAttr) spAttr[k].needsUpdate = true; spDirty = false; }
    SPU.uGain.value = 0.55 + 0.45 * e;
    SU.uGain.value = 0.28 + 0.24 * e;
    // the camera: square on, close enough that the drawing fills the narrower side, with a slow drift
    const half = Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, camera.aspect);
    const z = 1.1 / half;
    camera.position.set(Math.sin(t * 0.031) * 0.06 * z, Math.sin(t * 0.023 + 1) * 0.045 * z, z);
    camera.lookAt(0, 0, 0);
  });
  motes(S, { kind: 'dust', count: mobile ? 50 : 90, box: [4, 4, 1.6], center: [0, 0, 0.9], color: '#d8d0ff', size: 0.01, speed: 0.15 });
  S.keep({ dispose() { for (const d of [...fading, cur]) if (d) { d.geom.dispose(); d.bg.material.dispose(); } gearMat.dispose(); } });
  return S.finalize({ portraitFov: 50 });
}
