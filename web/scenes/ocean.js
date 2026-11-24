// Deep Ocean: sinking slowly through dark water. Shafts of light reach down from a surface far
// above and fade as the night goes on; marine snow drifts past; jellyfish pulse and glow, and
// flare when the sonar pings; plankton light up in waves; bubbles rise; and when a whale sings,
// a vast shape glides by in the distance.
//
// Everything near the camera wraps or recycles around it: marine snow and plankton wrap in the
// vertex shader, jellyfish and bubbles are recycled in JS.
import * as THREE from 'three';
import { mulberry32 } from '../audio.js';

const TAU = Math.PI * 2;
const JELLY_COLORS = ['#7af0ff', '#b48cff', '#ff7ad9', '#7affc4', '#8fb0ff', '#ffb37a'];

export function createOceanScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0x0cea);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const tint = new THREE.Color(['#0a4d6e', '#0b3f6e', '#0d5c63', '#16406e'][Math.floor(rand() * 4)]);

  // light from above fades over the night; uLight 1 = near the surface, 0 = the deep
  const U = {
    uTime: { value: 0 }, uLight: { value: 1 }, uCam: { value: new THREE.Vector3() },
    uTint: { value: tint }, uFog: { value: new THREE.Color() }, uDensity: { value: 0.035 },
    uWave: { value: new THREE.Vector4(0, 0, 0, -99) }, uScale: { value: 800 },
  };
  const FOGFN = `
    uniform vec3 uFog; uniform float uDensity;
    vec3 fogged(vec3 col, float d){ return mix(col, uFog, 1. - exp(-uDensity * uDensity * d * d)); }`;

  // ------------------------------------------------------------------ the water all around
  const backdrop = new THREE.Mesh(keep(new THREE.SphereGeometry(300, 48, 24)), keep(new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime, uLight; uniform vec3 uTint; varying vec3 vDir;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      float vn(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(hash(i), hash(i + 1.), f); }
      void main(){
        vec3 d = normalize(vDir);
        float up = d.y * .5 + .5;
        vec3 deep = vec3(.002, .006, .014);
        vec3 col = mix(deep, uTint * (.08 + .5 * uLight), pow(up, 2.2) * (.25 + .75 * uLight));
        // the bright window of the surface far above, and rays fanning down from it
        float az = atan(d.x, d.z);
        float rays = vn(az * 7. + uTime * .03) * vn(az * 13. - uTime * .02 + 5.);
        float fan = smoothstep(.15, 1., d.y);
        col += uTint * 1.4 * rays * fan * fan * uLight * .6;
        col += vec3(.6, .9, 1.) * pow(max(d.y, 0.), 24.) * uLight * .8;
        gl_FragColor = vec4(col, 1.);
      }`,
  })));
  backdrop.renderOrder = -1; backdrop.frustumCulled = false;
  scene.add(backdrop);

  // ------------------------------------------------------------------ shafts of light, swaying slowly
  const SHAFTS = mobile ? 5 : 8;
  const shaftMat = keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying float vY; varying vec2 vUv; varying float vD, vFace; uniform vec3 uCam;
      void main(){ vY = position.y; vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vD = length(w.xyz - uCam);
        vec3 n = normalize(mat3(modelMatrix) * normal); vFace = abs(dot(n, normalize(uCam - w.xyz)));
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uLight, uTime; uniform vec3 uTint; varying float vY; varying vec2 vUv; varying float vD, vFace;
      void main(){
        float edge = vFace * vFace * vFace; // thickest through the middle, soft at the sides
        float a = edge * smoothstep(-.5, .3, vY) * (1. - smoothstep(.3, .5, vY)) * smoothstep(2., 10., vD) * exp(-vD * .02);
        a *= .7 + .3 * sin(uTime * .4 + vUv.x * 18.);
        gl_FragColor = vec4((uTint * 1.6 + vec3(.1, .2, .25)) * a * .11 * uLight, 1.);
      }`,
  }));
  const shaftGeo = keep(new THREE.CylinderGeometry(1.4, 3.2, 1, 12, 1, true));
  const shafts = [];
  for (let k = 0; k < SHAFTS; k++) {
    const m = new THREE.Mesh(shaftGeo, shaftMat);
    m.scale.set(1, 90, 1);
    m.userData = { a: rand() * TAU, r: 8 + rand() * 30, tilt: (rand() - 0.5) * 0.35, ph: rand() * TAU, w: 0.6 + rand() * 1.2 };
    m.scale.x = m.scale.z = m.userData.w;
    scene.add(m); shafts.push(m);
  }

  // ------------------------------------------------------------------ marine snow (wraps around the camera in the shader)
  const SNOW = mobile ? 1400 : 2400, BOX = 36;
  const snowGeo = keep(new THREE.BufferGeometry());
  const sp = new Float32Array(SNOW * 3), ss = new Float32Array(SNOW);
  for (let k = 0; k < SNOW; k++) { sp.set([(rand() - 0.5) * BOX, (rand() - 0.5) * BOX, (rand() - 0.5) * BOX], k * 3); ss[k] = rand(); }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
  const WRAP = `
    vec3 wrapPos(vec3 p){ vec3 rel = mod(p - uCam + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)}; return uCam + rel; }`;
  const snow = new THREE.Points(snowGeo, keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale, uLight; uniform vec3 uCam, uTint; varying vec3 vCol;
      ${WRAP}
      void main(){
        vec3 p = position + vec3(sin(uTime * .2 + aSeed * 50.) * .3, -uTime * (.05 + aSeed * .06), cos(uTime * .17 + aSeed * 30.) * .3);
        p = wrapPos(p);
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
        gl_PointSize = max(1.5, uScale * .045 * (.4 + aSeed) / d);
        float fade = smoothstep(.5, 3., d) * (1. - smoothstep(${(BOX * 0.3).toFixed(1)}, ${(BOX * 0.5).toFixed(1)}, d));
        vCol = mix(vec3(.35, .4, .45), uTint * 2. + .25, .5) * fade * (.45 + .45 * uLight) * (.6 + .4 * aSeed);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vCol * exp(-r * 3.) * (1. - r), 1.); }`,
  })));
  snow.frustumCulled = false;
  scene.add(snow);

  // ------------------------------------------------------------------ plankton: tiny lights that flare in waves
  const PLANK = mobile ? 500 : 900, PBOX = 50;
  const plGeo = keep(new THREE.BufferGeometry());
  const pp = new Float32Array(PLANK * 3), ps = new Float32Array(PLANK);
  for (let k = 0; k < PLANK; k++) { pp.set([(rand() - 0.5) * PBOX, (rand() - 0.5) * PBOX, (rand() - 0.5) * PBOX], k * 3); ps[k] = rand(); }
  plGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  plGeo.setAttribute('aSeed', new THREE.BufferAttribute(ps, 1));
  const plankton = new THREE.Points(plGeo, keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale, uLight; uniform vec3 uCam; uniform vec4 uWave; varying vec3 vCol;
      vec3 wrapPos(vec3 p){ vec3 rel = mod(p - uCam + ${(PBOX / 2).toFixed(1)}, ${PBOX.toFixed(1)}) - ${(PBOX / 2).toFixed(1)}; return uCam + rel; }
      void main(){
        vec3 p = wrapPos(position + vec3(sin(uTime * .1 + aSeed * 40.), cos(uTime * .13 + aSeed * 20.), 0.) * .5);
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
        // a slow ambient shimmer, and a bright ring of light spreading from each sonar ping
        float amb = pow(max(0., sin(uTime * .35 + aSeed * 40. + p.y * .1)), 30.) * .6;
        float age = uTime - uWave.w, wr = age * 7.;
        float ring = exp(-pow(length(p - uWave.xyz) - wr, 2.) * .25) * exp(-age * .45) * step(0., age);
        float glow = amb + ring * 2.5;
        gl_PointSize = max(1., uScale * .05 * (.5 + aSeed) / d * (1. + glow));
        float fade = smoothstep(.5, 3., d) * (1. - smoothstep(${(PBOX * 0.3).toFixed(1)}, ${(PBOX * 0.5).toFixed(1)}, d));
        vCol = mix(vec3(.2, 1., .85), vec3(.35, .6, 1.), aSeed) * glow * fade * (1.2 - uLight * .5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vCol * (exp(-r * 12.) * 1.5 + exp(-r * 3.) * .4) * (1. - r), 1.); }`,
  })));
  plankton.frustumCulled = false;
  scene.add(plankton);

  // ------------------------------------------------------------------ jellyfish
  const JELLIES = mobile ? 9 : 13, TENT = 9, TSEG = 22;
  // the bell: a dome, open underneath, with a scalloped rim
  const bellGeo = keep((() => {
    const g = new THREE.SphereGeometry(1, 32, 14, 0, TAU, 0, Math.PI * 0.55);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      const rim = 1 - Math.min(1, Math.max(0, (y - 0.0) / 0.35));
      const sc = 1 + Math.sin(a * 16) * 0.04 * rim;
      p.setXYZ(i, p.getX(i) * sc, y * 0.75, p.getZ(i) * sc);
    }
    g.computeVertexNormals();
    return g;
  })());
  const jCol = new Float32Array(JELLIES * 3), jPhase = new Float32Array(JELLIES), jGlow = new Float32Array(JELLIES);
  bellGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(jCol, 3));
  bellGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(jPhase, 1));
  bellGeo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(jGlow, 1));
  const PULSE = `
    // the beat of a jellyfish: a quick squeeze, then a slow relax
    float pulseOf(float ph){ float p = fract(ph); return p < .22 ? sin(p / .22 * 1.5708) : pow(1. - (p - .22) / .78, 2.); }`;
  const bells = new THREE.InstancedMesh(bellGeo, keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aCol; attribute float aPhase, aGlow; uniform float uTime; uniform vec3 uCam;
      varying vec3 vCol; varying float vFres, vY, vGlow, vD;
      ${PULSE}
      void main(){
        float pu = pulseOf(aPhase);
        vec3 p = position;
        float rim = 1. - smoothstep(0., .6, p.y);
        p.xz *= 1. - pu * .22 * (.4 + rim);
        p.y *= 1. + pu * .18;
        p.xz *= 1. + sin(uTime * 2. + atan(p.z, p.x) * 4. + aPhase * 6.) * .03 * rim;
        vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.);
        vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec3 V = normalize(uCam - w.xyz);
        vFres = pow(1. - abs(dot(n, V)), 2.);
        vCol = aCol; vY = position.y; vGlow = aGlow; vD = length(uCam - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `varying vec3 vCol; varying float vFres, vY, vGlow, vD; uniform float uTime;
      ${FOGFN}
      void main(){
        // translucent: bright at the edges, a glowing heart near the top
        float heart = smoothstep(.45, .75, vY);
        vec3 col = vCol * (.06 + vFres * .55 + heart * .22) * (1. + vGlow * 2.5);
        col *= exp(-uDensity * uDensity * vD * vD);
        gl_FragColor = vec4(col, 1.);
      }`,
  })), JELLIES);
  bells.frustumCulled = false;
  scene.add(bells);

  // tentacles: lines that trail and wave below each bell; positions are worked out in the shader
  const tentGeo = keep(new THREE.BufferGeometry());
  {
    const n = JELLIES * TENT * TSEG, pos = new Float32Array(n * 3), idx = [];
    let v = 0;
    for (let j = 0; j < JELLIES; j++) for (let k = 0; k < TENT; k++) for (let s = 0; s < TSEG; s++) {
      pos.set([j, k, s / (TSEG - 1)], v * 3);
      if (s > 0) idx.push(v - 1, v);
      v++;
    }
    tentGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tentGeo.setIndex(idx);
  }
  const jU = { uJ: { value: Array.from({ length: JELLIES }, () => new THREE.Vector4()) }, uJC: { value: Array.from({ length: JELLIES }, () => new THREE.Vector4()) } };
  const tentacles = new THREE.LineSegments(tentGeo, keep(new THREE.ShaderMaterial({
    uniforms: { ...U, ...jU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform vec4 uJ[${JELLIES}]; uniform vec4 uJC[${JELLIES}]; uniform float uTime; uniform vec3 uCam;
      varying vec3 vCol; varying float vA;
      ${PULSE}
      void main(){
        int j = int(position.x + .5); float k = position.y, s = position.z;
        vec4 J = uJ[j], C = uJC[j]; // J: centre + size, C: colour + phase
        float pu = pulseOf(C.w);
        float a = k / ${TENT}. * 6.2832 + float(j);
        float r0 = J.w * (.85 - pu * .2) * (k < ${(TENT * 0.34).toFixed(1)} ? .35 : 1.);
        float len = J.w * (k < ${(TENT * 0.34).toFixed(1)} ? 2.2 : 3.8 + sin(k * 3.7) * .8);
        // trailing: each point lags the motion above it, so a wave runs down the tentacle
        float sway = sin(uTime * .9 - s * 4. + k * 1.7 + float(j)) * .35 * s + sin(uTime * .5 - s * 2. + k) * .2 * s;
        vec3 p = J.xyz + vec3(cos(a) * r0 * (1. - s * .4) + sway * J.w, -s * len + pu * s * .3 * J.w, sin(a) * r0 * (1. - s * .4) + cos(uTime * .7 - s * 3. + k) * .25 * s * J.w);
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
        vCol = C.rgb; vA = (1. - s) * (1. - s * .3) * exp(-.0012 * d * d);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol; varying float vA; void main(){ gl_FragColor = vec4(vCol * vA * .45, 1.); }`,
  })));
  tentacles.frustumCulled = false;
  scene.add(tentacles);

  const jellies = [];
  const camPos = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  function spawnJelly(j, initial) {
    const J = jellies[j] ?? (jellies[j] = { p: new THREE.Vector3(), col: new THREE.Color(), size: 1, phase: 0, rate: 0.4, glow: 0, drift: new THREE.Vector3(), tilt: 0 });
    // somewhere ahead of us, below (we sink past them) or, at the start, anywhere in view
    // a narrow arc: a portrait phone only sees about 36 degrees across
    const d = 10 + rand() * 24, a = yaw + (rand() - 0.5) * Math.min(0.9, 7 / d + 0.3);
    J.p.set(camPos.x + Math.sin(a) * d, camPos.y + (initial ? (rand() - 0.6) * 22 : -16 - rand() * 14), camPos.z - Math.cos(a) * d);
    J.size = 0.4 + Math.pow(rand(), 2.5) * 1.5;
    J.col.set(JELLY_COLORS[Math.floor(rand() * JELLY_COLORS.length)]);
    J.phase = rand(); J.rate = 0.22 + rand() * 0.25; J.glow = 0;
    J.drift.set((rand() - 0.5) * 0.15, 0, (rand() - 0.5) * 0.15);
    J.tilt = (rand() - 0.5) * 0.4;
  }

  // ------------------------------------------------------------------ bubbles
  const BUB = 60;
  const bubGeo = keep(new THREE.BufferGeometry());
  const bp = new Float32Array(BUB * 3), bs = new Float32Array(BUB);
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  bubGeo.setAttribute('aSize', new THREE.BufferAttribute(bs, 1));
  const bubbles = new THREE.Points(bubGeo, keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; uniform float uScale; varying float vA;
      void main(){ vec4 mv = viewMatrix * vec4(position, 1.); float d = -mv.z; gl_PointSize = aSize > 0. ? max(2., uScale * aSize / d) : 0.; vA = aSize > 0. ? exp(-d * .04) : 0.; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; uniform float uLight; uniform vec3 uTint;
      void main(){ vec2 c = gl_PointCoord - .5; float r = length(c) * 2.;
        float ring = smoothstep(.7, .9, r) * smoothstep(1., .92, r) + smoothstep(.35, 0., length(c - vec2(-.15, .15))) * .8;
        gl_FragColor = vec4((vec3(.6, .85, 1.) * .5 + uTint) * ring * vA * (.35 + .4 * uLight), 1.); }`,
  })));
  bubbles.frustumCulled = false;
  scene.add(bubbles);
  const bubs = Array.from({ length: BUB }, () => ({ on: false, p: new THREE.Vector3(), v: 0, s: 0, ph: 0 }));
  function releaseBubbles(pan, n) {
    const a = yaw + pan * 0.8, d = 5 + rand() * 6;
    const x = camPos.x + Math.sin(a) * d, z = camPos.z - Math.cos(a) * d, y = camPos.y - 6;
    for (let k = 0; k < n * 2; k++) {
      const b = bubs.find((b) => !b.on); if (!b) return;
      b.on = true; b.p.set(x + (rand() - 0.5) * 0.4, y - k * 0.35, z + (rand() - 0.5) * 0.4);
      b.v = 0.8 + rand() * 0.6; b.s = 0.03 + rand() * 0.05; b.ph = rand() * TAU;
    }
  }

  // ------------------------------------------------------------------ a whale, far off
  const whaleGeo = keep((() => {
    // a long body turned on a lathe, with a fluked tail and two long flippers
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const x = i / 24, r = Math.pow(Math.sin(Math.PI * Math.pow(x, 0.75)), 0.8) * (1 - 0.85 * Math.pow(x, 3)) * 0.13 + 0.004;
      pts.push(new THREE.Vector2(r, x));
    }
    const body = new THREE.LatheGeometry(pts, 16); body.rotateZ(-Math.PI / 2); body.scale(1, 0.85, 1); // along +x, head at 0
    const fluke = new THREE.BufferGeometry();
    fluke.setAttribute('position', new THREE.Float32BufferAttribute([0.97, 0, 0, 1.12, 0, 0.16, 1.06, 0, 0, 0.97, 0, 0, 1.12, 0, -0.16, 1.06, 0, 0], 3));
    const fin = new THREE.BufferGeometry();
    fin.setAttribute('position', new THREE.Float32BufferAttribute([0.22, -0.05, 0.09, 0.36, -0.12, 0.42, 0.3, -0.06, 0.1, 0.22, -0.05, -0.09, 0.36, -0.12, -0.42, 0.3, -0.06, -0.1], 3));
    const parts = [body.toNonIndexed(), fluke, fin];
    for (const g of parts) for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const pos = [];
    for (const g of parts) pos.push(...g.attributes.position.array);
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.computeVertexNormals();
    return out;
  })());
  const whaleU = { uSwim: { value: 0 } };
  const whale = new THREE.Mesh(whaleGeo, keep(new THREE.ShaderMaterial({
    uniforms: { ...U, ...whaleU }, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: `uniform float uSwim; varying float vD, vTop, vRim;
      void main(){
        vec3 p = position;
        float k = max(0., p.x - .45);
        p.y += sin(uSwim - p.x * 3.) * k * k * .35; // the tail beats
        vec4 w = modelMatrix * vec4(p, 1.);
        vD = length(w.xyz - cameraPosition); vTop = position.y;
        vec3 n = normalize(mat3(modelMatrix) * normal);
        vRim = pow(1. - abs(dot(n, normalize(cameraPosition - w.xyz))), 2.);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform float uLight; uniform vec3 uTint; varying float vD, vTop, vRim;
      ${FOGFN}
      void main(){
        // a dark shape with light catching its back, and a faint glow along its outline
        vec3 col = vec3(.003, .006, .012) + uTint * .35 * smoothstep(.02, .11, vTop) * (.3 + .7 * uLight) + (uTint * .6 + vec3(.02, .05, .07)) * vRim * .5;
        float f = 1. - exp(-uDensity * uDensity * vD * vD * .1);
        gl_FragColor = vec4(col, (1. - f) * .95);
      }`,
  })));
  whale.visible = false; whale.frustumCulled = false;
  scene.add(whale);
  const W = { on: false, start: new THREE.Vector3(), dir: new THREE.Vector3(), t0: 0, dur: 1 };
  function sendWhale(pan, dur = 70) {
    if (W.on) return;
    const side = pan >= 0 ? 1 : -1;
    const a = yaw + (rand() - 0.5) * 0.3, d = 40 + rand() * 15;
    const cx = camPos.x + Math.sin(a) * d, cz = camPos.z - Math.cos(a) * d;
    const across = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(-side); // left/right across our view
    W.on = true; W.t0 = t; W.dur = dur;
    W.dir.copy(across); W.start.set(cx, 0, cz).addScaledVector(across, -50);
    whale.visible = true;
  }

  // ------------------------------------------------------------------ motion
  let t = 0, yaw = rand() * TAU, depth = 0, light = 1;
  camPos.set(0, -12, 0);
  for (let j = 0; j < JELLIES; j++) spawnJelly(j, true);

  function onEvent(ev, at) {
    if (ev.type === 'ping') {
      // the nearest jellyfish in front answers with a flash, and a ring of plankton lights up
      let best = null, bd = Infinity;
      for (const J of jellies) { const d = J.p.distanceTo(camPos); if (d < bd && d < 30) { bd = d; best = J; } }
      if (best) { best.glow = Math.min(1.5, best.glow + 1); U.uWave.value.set(best.p.x, best.p.y, best.p.z, at ?? t); }
    } else if (ev.type === 'chord') {
      for (const J of jellies) J.glow = Math.min(1.5, J.glow + 0.15);
    } else if (ev.type === 'bubbles') releaseBubbles(ev.pan || 0, ev.n || 4);
    else if (ev.type === 'whale') sendWhale(ev.pan || 0, ev.test || 70);
  }

  function update(time, dt, st) {
    t = time;
    const e = st.energy;
    U.uTime.value = t;
    U.uScale.value = innerHeight * Math.min(devicePixelRatio || 1, 2) / (2 * Math.tan(camera.fov * Math.PI / 360));
    // light fades as the night (and our descent) goes on
    light += ((0.12 + 0.88 * e * e) - light) * Math.min(1, dt * 0.05);
    U.uLight.value = light;
    U.uFog.value.copy(tint).multiplyScalar(0.06 + 0.22 * light).add({ r: 0.002, g: 0.005, b: 0.01 });
    scene.background = U.uFog.value;

    // sink slowly, turning gently to look around
    depth += (0.35 + 0.45 * e) * dt;
    yaw += dt * 0.012;
    camPos.set(Math.sin(t * 0.05) * 1.5, -12 - depth, Math.cos(t * 0.04) * 1.5);
    camera.position.copy(camPos);
    fwd.set(Math.sin(yaw), -0.18 + Math.sin(t * 0.07) * 0.08, -Math.cos(yaw));
    camera.lookAt(tmp.copy(camPos).add(fwd));
    camera.rotateZ(Math.sin(t * 0.06) * 0.03);
    U.uCam.value.copy(camPos);
    backdrop.position.copy(camPos);

    // shafts hang from the surface, swaying, staying round us
    for (const m of shafts) {
      const u = m.userData, a = u.a + Math.sin(t * 0.03 + u.ph) * 0.2;
      m.position.set(camPos.x + Math.sin(a) * u.r, camPos.y + 20, camPos.z - Math.cos(a) * u.r);
      m.rotation.set(u.tilt + Math.sin(t * 0.1 + u.ph) * 0.04, 0, u.tilt * 0.5);
    }

    // jellyfish: pulse, rise a little on each squeeze, drift; recycle the ones left above us
    for (let j = 0; j < JELLIES; j++) {
      const J = jellies[j];
      const prev = J.phase;
      J.phase += J.rate * dt * (0.7 + 0.3 * e);
      const p = J.phase % 1;
      const thrust = p < 0.22 ? 1 : 0.15;
      J.p.y += thrust * 0.35 * J.size * dt;
      J.p.addScaledVector(J.drift, dt);
      J.glow *= Math.exp(-dt * 0.9);
      // recycle ones left above us, too far, or (as we slowly turn) well out of view
      tmp.subVectors(J.p, camPos);
      let off = Math.atan2(tmp.x, -tmp.z) - yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
      if (J.p.y > camPos.y + 18 || tmp.length() > 60 || (Math.abs(off) > 1.1 && J.glow < 0.05)) spawnJelly(j, false);
      q.setFromAxisAngle(tmp.set(1, 0, 0), J.tilt);
      bells.setMatrixAt(j, m4.compose(J.p, q, sc.setScalar(J.size)));
      jCol.set([J.col.r, J.col.g, J.col.b], j * 3);
      jPhase[j] = J.phase; jGlow[j] = J.glow + (prev % 1 > p ? 0.12 : 0); // a tiny flash each beat
      jU.uJ.value[j].set(J.p.x, J.p.y, J.p.z, J.size);
      jU.uJC.value[j].set(J.col.r * (1 + J.glow * 2), J.col.g * (1 + J.glow * 2), J.col.b * (1 + J.glow * 2), J.phase);
    }
    bells.instanceMatrix.needsUpdate = true;
    bellGeo.attributes.aCol.needsUpdate = true; bellGeo.attributes.aPhase.needsUpdate = true; bellGeo.attributes.aGlow.needsUpdate = true;

    // bubbles rise and wobble
    for (let k = 0; k < BUB; k++) {
      const b = bubs[k];
      if (b.on) {
        b.p.y += b.v * dt; b.p.x += Math.sin(t * 3 + b.ph) * 0.15 * dt;
        if (b.p.y > camPos.y + 20) b.on = false;
      }
      bp.set([b.p.x, b.p.y, b.p.z], k * 3); bs[k] = b.on ? b.s : 0;
    }
    bubGeo.attributes.position.needsUpdate = true; bubGeo.attributes.aSize.needsUpdate = true;

    // the whale glides across, far away, keeping pace with our descent
    if (W.on) {
      const k = (t - W.t0) / W.dur;
      if (k > 1) { W.on = false; whale.visible = false; }
      else {
        whale.position.copy(W.start).addScaledVector(W.dir, k * 100);
        whale.position.y = camPos.y + 13 + Math.sin(k * 3) * 2;
        whale.scale.setScalar(24);
        // the body runs along +x with the head at 0, so turn it to lead with the head
        whale.rotation.set(0, Math.atan2(W.dir.z, -W.dir.x), Math.sin(t * 0.3) * 0.05);
        whaleU.uSwim.value = t * 0.9;
      }
    }
  }

  return {
    scene, camera, update, onEvent, portraitFov: 72,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.05, bloom: [0.9, 0.6, 0.3], finish: { vignette: 0.5, grain: 0.024, ca: 0.5 } },
    dispose() { for (const d of disposables) d.dispose?.(); bells.dispose(); },
  };
}
