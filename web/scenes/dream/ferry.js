// Plain Sailing: a night ferry crossing a calm sea. You stand at the starboard rail of a small
// ferry, the deck lamps warm on the planks behind you, and watch the night go by: a big low moon
// laying a glittering path across the water, islands drifting past with their few lit windows,
// a lighthouse sweeping its beams through the mist, another ship's lights passing far off (and its
// horn, faint), the wake glowing blue-green behind with phosphorescence. Now and then dolphins
// come alongside, glowing as they swim under the surface and trailing light when they leap; a
// shower passes and rings the sea; a mist rolls in and lifts; the whole sea lights up with
// plankton. Through the night the sea calms, the moon moves round ahead, and at the end the ferry
// slows into a sleeping harbour, its lamps going out one by one.
//
// The sea is a shader: a wide radial grid round the ship, lifted by a few long waves (their phase
// worked out on the CPU so a whole night's travel never loses precision), its normals sharpened
// with ripples; it reflects the sky (and the islands' silhouettes, from a little horizon texture),
// glitters with the moon, and throws back every light nearby as a long trembling streak.
import { createStage, canvasTexture, paint, mergeAll, THREE } from '../kit.js';

const TAU = Math.PI * 2;
const DECK = 2.6, RAIL = 3.95, HULL = 4.15, STERN = 14, BOW = -15;
const NLIGHT = 16, NWAVE = 6;

const NOISE = `
float hh(vec2 p){ p = mod(p, 256.); p = fract(p * vec2(.1031, .1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ return .5 * vn(p) + .25 * vn(p * 2.) + .125 * vn(p * 4.) + .0625 * vn(p * 8.); }
float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;
// the night sky, shared by the dome and the sea's reflections
const SKY = `
uniform float uTime, uAur, uMist, uRain, uE;
uniform vec3 uMoon;
vec3 skyCol(vec3 d, float refl) {
  float y = d.y, az = atan(d.x, -d.z);
  vec3 top = vec3(.010, .018, .055), hor = mix(vec3(.06, .08, .16), vec3(.11, .12, .17), uMist);
  vec3 col = mix(hor, top, smoothstep(-.02, .6, y));
  float md = acos(clamp(dot(d, uMoon), -1., 1.));
  col += vec3(.32, .38, .55) * exp(-md * 6.) * .13 + vec3(.6, .62, .72) * exp(-md * 26.) * .16;
  // the Milky Way, with its dust lanes
  vec3 bn = normalize(vec3(-.35, .55, .75)); float b = dot(d, bn);
  float band = exp(-b * b * 16.) * (.45 + .6 * fbm(vec2(az * 5., y * 7.) + 3.));
  band *= 1. - .75 * smoothstep(.5, .72, fbm(vec2(az * 11., y * 15.) + 9.)) * exp(-b * b * 45.);
  col += vec3(.15, .14, .21) * band * smoothstep(-.02, .25, y) * (1. - uMist * .8);
  // stars
  vec2 sp = vec2(az * 150., y * 170.); vec2 cell = floor(sp); float h = hs(cell + 17.);
  if (h > .965 && y > .015) {
    vec2 c = fract(sp) - .5 - (vec2(hs(cell + 3.1), hs(cell + 7.7)) - .5) * .6;
    float tw = .55 + .45 * sin(uTime * (.4 + h * 1.5) + h * 60.);
    col += mix(vec3(.85, .88, 1.), vec3(1., .86, .74), step(.7, hs(cell + 5.))) * smoothstep(.13, 0., length(c)) * mix(tw, .5, refl) * (1. - uMist * .9) * smoothstep(.015, .2, y) * (h > .993 ? 1.6 : .8);
  }
  // aurora, some nights
  if (uAur > 0. && y > 0.) {
    float cur = pow(fbm(vec2(az * 2.6 + uTime * .004, 1.3)), 2.) * 2.4, ray = .6 + .4 * vn(vec2(az * 60., uTime * .05));
    float k = cur * ray * smoothstep(.03, .14, y) * smoothstep(.75, .25, y) * uAur;
    col += mix(vec3(.15, .9, .5), vec3(.5, .25, .95), smoothstep(.12, .45, y)) * k * .32;
  }
  // clouds, silver near the moon, more of them in the rain
  float cl = smoothstep(.55 - uRain * .2, .82, fbm(vec2(az * 2.4 + uTime * .002, y * 7.))) * smoothstep(-.02, .1, y) * smoothstep(.7, .2, y);
  col = mix(col, vec3(.05, .06, .1) + vec3(.55, .58, .7) * exp(-md * 4.) * .5, cl * .8);
  // the moon
  vec3 mp = d - uMoon;
  float maria = fbm(mp.xy * 60. + 3.) * .35;
  float disc = smoothstep(.05, .046, md);
  col = mix(col, vec3(1., .97, .88) * (1.1 - maria) * (1. - uMist * .5), disc * (1. - cl * .6));
  // mist lies along the horizon
  col = mix(col, hor * 1.25 + vec3(.04, .045, .06), uMist * smoothstep(.25, 0., abs(y)) * .8);
  return col;
}`;
const SEA_VERT = `
uniform vec4 uWv[${NWAVE}]; uniform float uPh[${NWAVE}];
varying vec3 vW; varying float vH;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.);
  float h = 0.;
  for (int i = 0; i < ${NWAVE}; i++) { vec4 v = uWv[i]; h += v.w * sin(v.z * dot(v.xy, w.xz) + uPh[i]); }
  float r = length(w.xz);
  h *= 1. - smoothstep(250., 700., r);
  w.y += h; vW = w.xyz; vH = h;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SEA_FRAG = `
${NOISE}
${SKY}
uniform vec4 uWv[${NWAVE}]; uniform float uPh[${NWAVE}];
uniform float uAmp, uTw, uTt, uGlow, uFogD, uWake, uSpeed;
uniform vec3 uLP[${NLIGHT}], uLC[${NLIGHT}]; uniform int uNL;
uniform vec3 uDol[3]; uniform float uDolA;
uniform sampler2D uSil;
varying vec3 vW; varying float vH;
void main() {
  vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
  // the waves' slope, and fine ripples, both fading with distance so the far sea is calm and smooth
  vec2 g = vec2(0.);
  for (int i = 0; i < ${NWAVE}; i++) { vec4 v = uWv[i]; g += v.w * v.z * cos(v.z * dot(v.xy, vW.xz) + uPh[i]) * v.xy; }
  g *= 1. - smoothstep(250., 700., dist);
  vec2 q = vW.xz - vec2(0., uTw); // the sea's own coordinates (the ship moves through it)
  float fd = 1. / (1. + dist * .02);
  vec2 rp = q * 2. + vec2(uTt * .5, uTt * .25);
  float e = .05;
  vec2 rg = vec2(fbm(rp + vec2(e, 0.)) - fbm(rp - vec2(e, 0.)), fbm(rp + vec2(0., e)) - fbm(rp - vec2(0., e))) / (2. * e);
  g += rg * .045 * fd * (.6 + .4 * uAmp);
  // rain rings
  if (uRain > 0. && dist < 60.) {
    vec2 c = floor(q * 1.5), f = fract(q * 1.5) - .5;
    float ph = fract(uTt * .5 + hh(c) * 7.), rr = ph * .45, d = length(f - (vec2(hh(c + 1.), hh(c + 2.)) - .5) * .4);
    float ring = smoothstep(.06, 0., abs(d - rr)) * (1. - ph) * uRain * (1. - dist / 60.);
    g += normalize(f + .001) * ring * .6;
  }
  vec3 N = normalize(vec3(-g.x, 1., -g.y));
  float F = .02 + .98 * pow(1. - max(dot(N, V), 0.), 5.);
  vec3 R = reflect(-V, N); R.y = abs(R.y) + .002;
  vec3 refl = skyCol(R, 1.);
  // the islands' dark shapes, in the reflection
  float sil = texture2D(uSil, vec2(atan(R.x, -R.z) / 6.2832 + .5, .5)).r * .35;
  refl = mix(refl, vec3(.012, .016, .03) * (1. + uMist * 2.), smoothstep(sil + .002, sil - .002, R.y) * step(.0005, sil));
  vec3 deep = vec3(.004, .016, .03) + vec3(.0, .02, .03) * smoothstep(-.3, .6, vH) * uAmp;
  vec3 col = mix(deep, refl, F);
  // the moon's glittering path
  float m = max(dot(R, uMoon), 0.);
  col += vec3(1., .95, .82) * (pow(m, 1400.) * 3.5 + pow(m, 160.) * .07) * (1. - uMist * .7) * (1. - uRain * .5);
  // every light nearby, thrown back as a trembling streak
  for (int i = 0; i < ${NLIGHT}; i++) {
    if (i >= uNL) break;
    vec3 L = uLP[i] - vW; float dl = length(L); L /= dl;
    float s = max(dot(R, L), 0.);
    col += uLC[i] * (pow(s, 700.) * 2.6 + pow(s, 80.) * .05) / (1. + dl * .004);
  }
  // the ship's wake: churned foam behind, a bow wave along the hull, the long arms of the Kelvin wake
  float side = abs(vW.x), wz = vW.z - ${STERN.toFixed(1)}, wake = 0., arms = 0.;
  if (wz > 0.) wake = smoothstep(3.6 + wz * .1, 1. + wz * .05, side) * exp(-wz * .01);
  else if (wz > -30.) wake = smoothstep(1.4, 0., abs(side - ${HULL.toFixed(2)})) * smoothstep(-30., -25., wz) * .8;
  float az = wz + 30.;
  if (az > 0.) arms = exp(-pow((side - .36 * az) * .5, 2.)) * exp(-az * .007) * .6;
  wake *= uWake; arms *= uWake;
  float churn = fbm(q * 1. + vec2(0., uTt * .25));
  float foam = (wake * smoothstep(.35, .7, churn) + arms * smoothstep(.55, .8, churn)) * (.4 + .6 * fd);
  col += vec3(.55, .62, .72) * foam * .32;
  // phosphorescence: the plankton glow where the water's stirred, sparkling
  float sp = pow(vn(q * 4. + vec2(uTt * .5, 0.)), 6.) * 3.;
  float glow = (wake * 1.4 + arms * .5) * (.3 + uGlow) * (.35 + sp);
  glow += smoothstep(.5, 1., vH / max(.15, uAmp * .7)) * uGlow * sp * .5 * fd;          // crests flashing, on a glowing night
  glow += uGlow * pow(vn(q * .25 + vec2(0., uTt * .25)), 3.) * .25 * fd;                  // drifting clouds of light
  // dolphins swimming under the surface, glowing
  for (int i = 0; i < 3; i++) { vec3 dp = uDol[i]; if (dp.y < -0.15) { vec2 d = vW.xz - dp.xz; glow += exp(-dot(d * vec2(1.6, .55), d * vec2(1.6, .55)) * 1.2) * 1.4 * uDolA * smoothstep(-2.5, -.2, dp.y); } }
  col += vec3(.1, .8, 1.) * glow * .55;
  // distance: fog and mist
  float fog = 1. - exp(-dist * uFogD);
  col = mix(col, skyCol(normalize(vec3(-V.x, .01, -V.z)), 1.), fog);
  gl_FragColor = vec4(col, 1.);
}`;
const DOME_FRAG = `
${NOISE}
${SKY}
varying vec3 vDir;
void main() { gl_FragColor = vec4(skyCol(normalize(vDir), 0.), 1.); }`;
const POINTS_VERT = `
uniform float uScale, uTime, uFogD;
attribute float aSize, aSeed, aOn; attribute vec3 aCol;
varying vec3 vCol; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  gl_PointSize = max(1.5, aSize * uScale / d);
  float tw = .8 + .2 * sin(uTime * (.7 + aSeed * 2.) + aSeed * 40.);
  vA = aOn * tw * exp(-d * uFogD * .7) * min(1., aSize * uScale / d / 1.5);
  vCol = aCol;
}`;
const POINTS_FRAG = `
varying vec3 vCol; varying float vA;
void main() { vec2 q = gl_PointCoord - .5; float d = length(q); float a = (exp(-d * d * 40.) + exp(-d * d * 8.) * .25) * smoothstep(.5, .3, d) * vA; gl_FragColor = vec4(vCol * a, 1.); }`;
const BEAM_FRAG = `
uniform float uOp; varying float vT; varying vec3 vN, vV;
void main() { float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5); gl_FragColor = vec4(vec3(1., .95, .8) * pow(1. - vT, 1.6) * edge * uOp, 1.); }`;
const BEAM_VERT = `
uniform float uLen; varying float vT; varying vec3 vN, vV;
void main() { vT = clamp(-position.y / uLen + .5, 0., 1.); vec4 w = modelMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SPARK_VERT = `
uniform float uTime, uScale;
attribute vec3 aVel; attribute float aBirth, aLife;
varying float vA;
void main() {
  float age = uTime - aBirth, k = age / aLife;
  vec3 p = position + aVel * age; p.y -= 4.9 * age * age;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float alive = step(0., age) * step(k, 1.);
  vA = alive * (1. - k);
  gl_PointSize = alive * .12 * uScale / -mv.z;
}`;
const SPARK_FRAG = `varying float vA; void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.25, .9, 1.) * exp(-d * d * 30.) * vA * 1.4, 1.); }`;

export function createFerryScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xfe77, bg: '#03050c', exposure: 0.95, bloom: [0.5, 0.45, 0.62], finish: { vignette: 0.4, grain: 0.02, ca: 0.25 }, fov: 55, far: 4000, fog: { color: '#0e1424', density: 0.0012 } });
  const { rand, camera, U } = S;
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  const EMPTY = Array.from({ length: NLIGHT }, () => new THREE.Vector3());

  // ---------------------------------------------------------------- shared uniforms
  const moon = new THREE.Vector3(0.62, 0.27, -0.74).normalize();
  const SU = {
    uTime: { value: 0 }, uAur: { value: 0 }, uMist: { value: 0 }, uRain: { value: 0 }, uE: U.uEnergy, uMoon: { value: moon },
  };
  const waves = [];
  for (let i = 0; i < NWAVE; i++) {
    const L = [11, 7.3, 4.6, 3.1, 17, 2.2][i], a = -0.35 + (i - 2.5) * 0.32 + (rand() - 0.5) * 0.3; // mostly from ahead and to port
    const k = TAU / L;
    waves.push({ dir: [Math.sin(a), -Math.cos(a)], k, w: Math.sqrt(9.8 * k), amp: L * 0.011, ph: rand() * TAU });
  }
  const WU = {
    uWv: { value: waves.map(() => new THREE.Vector4()) }, uPh: { value: new Float32Array(NWAVE) },
    uAmp: { value: 1 }, uTw: { value: 0 }, uTt: { value: 0 }, uGlow: { value: 0 }, uFogD: { value: 0.0012 }, uWake: { value: 1 }, uSpeed: { value: 1 },
    uLP: { value: EMPTY.map((v) => v.clone()) }, uLC: { value: EMPTY.map((v) => v.clone()) }, uNL: { value: 0 },
    uDol: { value: [new THREE.Vector3(0, -9, 0), new THREE.Vector3(0, -9, 0), new THREE.Vector3(0, -9, 0)] }, uDolA: { value: 0 },
  };
  // the islands' outline round the horizon, for the sea to reflect
  const SIL_N = 512, silData = new Uint8Array(SIL_N * 4);
  const silTex = S.keep(new THREE.DataTexture(silData, SIL_N, 1, THREE.RGBAFormat));
  silTex.magFilter = silTex.minFilter = THREE.LinearFilter; silTex.wrapS = THREE.RepeatWrapping; silTex.needsUpdate = true;

  // ---------------------------------------------------------------- the sky dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({
    uniforms: SU, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: DOME_FRAG,
  }));
  dome.renderOrder = -10; dome.frustumCulled = false; S.add(dome);

  // ---------------------------------------------------------------- the sea: a wide radial grid round the ship
  {
    const NR = mobile ? 120 : 170, NS = mobile ? 150 : 210, r0 = 0.5, r1 = 3200;
    const pos = new Float32Array(NR * NS * 3);
    for (let j = 0; j < NR; j++) {
      const r = r0 * Math.pow(r1 / r0, j / (NR - 1));
      for (let i = 0; i < NS; i++) { const a = (i / NS) * TAU, o = (j * NS + i) * 3; pos[o] = Math.cos(a) * r; pos[o + 1] = 0; pos[o + 2] = Math.sin(a) * r; }
    }
    const idx = [];
    for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NS; i++) {
      const a = j * NS + i, b = j * NS + (i + 1) % NS, c = (j + 1) * NS + i, d = (j + 1) * NS + (i + 1) % NS;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const sea = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...SU, ...WU, uSil: { value: silTex } }, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, side: THREE.DoubleSide }));
    sea.frustumCulled = false; S.add(sea);
  }

  // ---------------------------------------------------------------- the ferry: the deck you stand on, and the ship round it
  const ship = new THREE.Group(); S.add(ship);
  ship.add(camera);
  const C = (h) => new THREE.Color(h);
  const ni = (g) => (g.index ? g.toNonIndexed() : g);
  const parts = [];
  const bx = (w, h, d, x, y, z, col, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); parts.push(paint(ni(g), C(col))); };
  const cy = (r0, r1, h, x, y, z, col, seg = 10, rx = 0) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); if (rx) g.rotateX(rx); g.translate(x, y, z); parts.push(paint(ni(g), C(col))); };
  // the hull: dark plates with a white band, narrowing to the bow
  for (const sx of [1, -1]) {
    bx(0.22, 3.4, STERN + 6, sx * HULL, DECK - 1.6, (STERN - 6) / 2 + 0.5, '#141c30');
    bx(0.24, 0.35, STERN + 6, sx * (HULL + 0.01), DECK - 0.15, (STERN - 6) / 2 + 0.5, '#c8ccd6');
    const len = Math.hypot(HULL, BOW + 6), ang = Math.atan2(HULL, -(BOW + 6)) * sx;
    bx(0.22, 3.4, len, sx * HULL / 2, DECK - 1.6, (BOW - 6) / 2 + 0.2, '#141c30', ang);
    bx(0.24, 0.35, len, sx * HULL / 2, DECK - 0.15, (BOW - 6) / 2 + 0.2, '#c8ccd6', ang);
  }
  bx(HULL * 2, 3.4, 0.25, 0, DECK - 1.6, STERN, '#141c30');
  // the rails: posts and two rails all round
  const railPts = [[HULL - 0.2, STERN - 0.3], [HULL - 0.2, -6], [0, BOW + 0.4], [-(HULL - 0.2), -6], [-(HULL - 0.2), STERN - 0.3]];
  for (let s = 0; s < railPts.length - 1; s++) {
    const [x0, z0] = railPts[s], [x1, z1] = railPts[s + 1], len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    for (const yy of [1.05, 0.55]) bx(0.06, 0.06, len, (x0 + x1) / 2, DECK + yy, (z0 + z1) / 2, '#d8dce4', ang);
    const n = Math.ceil(len / 1.6);
    for (let k = 0; k <= n; k++) cy(0.03, 0.03, 1.05, x0 + (x1 - x0) * k / n, DECK + 0.52, z0 + (z1 - z0) * k / n, '#c8ccd4', 6);
  }
  // the cabin, its upper deck, the funnel, a lifeboat, the mast
  bx(5, 2.5, 16, -0.9, DECK + 1.25, 1, '#8e94a0');
  bx(5.4, 0.15, 16.4, -0.9, DECK + 2.55, 1, '#8a909c');
  bx(4.2, 1.8, 11, -1, DECK + 3.5, 2, '#9aa0aa');
  bx(4.6, 0.12, 11.4, -1, DECK + 4.45, 2, '#7a808c');
  cy(0.9, 1.05, 3.2, -1, DECK + 6, 5, '#1a1c24', 14); cy(0.95, 0.95, 0.5, -1, DECK + 6.8, 5, '#b8342e', 14);
  bx(1.1, 0.7, 4.2, 1.85, DECK + 3.3, 3, '#e86a2a'); bx(1.15, 0.12, 4.3, 1.85, DECK + 3.7, 3, '#f0f0f0');
  cy(0.07, 0.09, 7.5, 0, DECK + 3.75, -11, '#c8ccd4', 8); bx(1.6, 0.06, 0.06, 0, DECK + 6.2, -11, '#c8ccd4');
  bx(0.9, 0.45, 2.6, 1.95, DECK + 0.25, -2.5, '#6a4a32'); bx(0.12, 0.5, 2.6, 1.6, DECK + 0.7, -2.5, '#5a3e2a'); // a bench
  const ringG = new THREE.TorusGeometry(0.3, 0.07, 8, 20); ringG.rotateY(Math.PI / 2); ringG.translate(RAIL - 0.02, DECK + 0.75, -4.6); parts.push(paint(ni(ringG), C('#e8642a')));
  const coilG = new THREE.TorusGeometry(0.28, 0.06, 6, 16); coilG.rotateX(Math.PI / 2); coilG.translate(2.6, DECK + 0.07, -6.5); parts.push(paint(ni(coilG), C('#8a6a44')));
  const shipGeo = mergeAll(parts); shipGeo.computeVertexNormals();
  ship.add(new THREE.Mesh(S.keep(shipGeo), S.vmat));
  // the deck: planks
  const planks = canvasTexture(S, 256, 256, (g, w, h) => {
    g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { g.fillStyle = `hsl(28, 25%, ${16 + rand() * 8}%)`; g.fillRect(i * 16 + 1, 0, 14, h); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(i * 16, 0, 1, h); g.fillRect(i * 16, Math.floor(rand() * h), 16, 1); }
  });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(2, 8);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(HULL * 2 - 0.2, STERN - BOW), new THREE.MeshLambertMaterial({ map: planks }));
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, DECK, (STERN + BOW) / 2); ship.add(deck);
  // the cabin's lit portholes and windows
  const portTex = canvasTexture(S, 512, 64, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) { const x = 30 + i * 50, lit = rand() < 0.8; const gr = g.createRadialGradient(x - 3, 27, 0, x, 30, 11); gr.addColorStop(0, lit ? '#a87848' : '#0c1018'); gr.addColorStop(0.8, lit ? '#6a4020' : '#080a10'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.beginPath(); g.arc(x, 30, 11, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,40,40,1)'; }
  });
  const portMat = new THREE.MeshBasicMaterial({ map: portTex, ...add });
  const ports = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), portMat); ports.rotation.y = Math.PI / 2; ports.position.set(1.62, DECK + 1.4, 1); ship.add(ports);
  const ports2 = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.6), portMat); ports2.rotation.y = Math.PI / 2; ports2.position.set(1.12, DECK + 3.5, 2); ship.add(ports2);
  // deck lamps on the cabin wall, the masthead light, the green starboard light
  const glowTex = canvasTexture(S, 64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  const glow = (col, s, x, y, z, parent = ship) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, ...add })); m.scale.setScalar(s); m.position.set(x, y, z); parent.add(m); return m; };
  const lamps = [];
  for (const z of [-5.5, 0.5, 6.5]) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: '#ffe0a8' }));
    body.position.set(1.66, DECK + 2.1, z); ship.add(body);
    lamps.push({ body, glow: glow('#ffc070', 1.2, 1.75, DECK + 2.1, z), light: null, z });
  }
  for (const L of lamps.slice(0, 2)) { L.light = new THREE.PointLight('#ffb766', 6, 9, 1.6); L.light.position.set(2.1, DECK + 2, L.z); ship.add(L.light); }
  const mastLight = glow('#ffffff', 1.4, 0, DECK + 7.3, -11), greenLight = glow('#40ff80', 0.45, 1.75, DECK + 2.4, -7.1);
  S.add(new THREE.HemisphereLight('#3a4a78', '#06080e', 0.55));
  const moonL = new THREE.DirectionalLight('#9fb0e0', 0.75); moonL.position.copy(moon).multiplyScalar(100); S.add(moonL);

  // ---------------------------------------------------------------- lights for the sea to reflect, and points of light far off
  /** A cloud of glowing points (windows, lamps), drawn additively with a little twinkle. */
  function lightPoints(list) {
    const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), sd = new Float32Array(n), on = new Float32Array(n);
    list.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); const c = C(p.col); col.set([c.r, c.g, c.b], i * 3); size[i] = p.size ?? 0.8; sd[i] = rand(); on[i] = 1; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1)); g.setAttribute('aOn', new THREE.BufferAttribute(on, 1));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uScale: U.uScale, uTime: U.uTime, uFogD: WU.uFogD }, vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG, ...add }));
    m.frustumCulled = false;
    m.userData.on = on; m.userData.offAt = list.map(() => 0.22 + rand() * 0.5); // the energy at which each one goes out
    return m;
  }

  // ---------------------------------------------------------------- islands drifting past
  const islands = [];
  function makeIsland(big, z) {
    const g = new THREE.Group();
    const r = big ? 110 + rand() * 160 : 35 + rand() * 50, h = big ? 45 + rand() * 90 : 12 + rand() * 25;
    const side = rand() < 0.62 ? 1 : -1, x = side * (big ? 380 + rand() * 500 : 160 + rand() * 260);
    // the land: a rough cone of rock and woods, hollowed into coves
    const NA = 48, NRr = 10, pos = [], col = [], idx = [];
    const ph = rand() * 10;
    for (let j = 0; j <= NRr; j++) for (let i = 0; i < NA; i++) {
      const a = (i / NA) * TAU, rho = j / NRr, wob = 0.75 + 0.25 * Math.sin(a * 3 + ph) + 0.12 * Math.sin(a * 7 + ph * 2);
      const rr = r * (1 - rho) * wob, ridge = 0.55 + 0.25 * Math.sin(a * 2 + ph * 3) + 0.14 * Math.sin(a * 5 + ph) + 0.06 * Math.sin(a * 11 + ph * 5);
      const hh = h * Math.pow(Math.sin(rho * Math.PI / 2), 1.3) * ridge * (1 + 0.12 * Math.sin(rho * 9 + a * 3)) - (j === 0 ? 4 : 0);
      pos.push(Math.cos(a) * rr, hh, Math.sin(a) * rr);
      const c = j < 2 ? C('#1a1c22') : C(rho > 0.4 ? '#0e1a14' : '#121a16');
      col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < NRr; j++) for (let i = 0; i < NA; i++) { const a = j * NA + i, b = j * NA + (i + 1) % NA, c = (j + 1) * NA + i, d = (j + 1) * NA + (i + 1) % NA; idx.push(a, b, c, b, d, c); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, S.vmat));
    // its few lit windows, mostly low down by the shore, facing the sea lanes
    const lights = [], nl = big ? 10 + Math.floor(rand() * 26) : Math.floor(rand() * 6);
    const cx = rand() * TAU;
    for (let k = 0; k < nl; k++) {
      const a = cx + (rand() - 0.5) * 1.6, rho = 0.08 + rand() * 0.35, rr = r * (1 - rho) * 0.85;
      lights.push({ x: Math.cos(a) * rr, y: h * Math.pow(rho, 0.8) * 0.8 + 0.8, z: Math.sin(a) * rr, col: rand() < 0.8 ? '#ffc070' : '#fff0d0', size: 2.6 + rand() * 1.8 });
    }
    if (lights.length) g.add(lightPoints(lights));
    g.position.set(x, 0, z);
    S.add(g);
    const isl = { g, x, z, r, h, lights, big };
    islands.push(isl);
    return isl;
  }
  function dropIsland(isl) { S.scene.remove(isl.g); isl.g.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material !== S.vmat) o.material.dispose(); }); islands.splice(islands.indexOf(isl), 1); }
  S.keep({ dispose() { for (const i of [...islands]) dropIsland(i); } });

  // ---------------------------------------------------------------- the lighthouse
  let lighthouse = null;
  function makeLighthouse(z) {
    const g = new THREE.Group(), x = 260 + rand() * 120;
    const rock = [];
    for (let k = 0; k < 6; k++) { const s = new THREE.DodecahedronGeometry(8 + rand() * 9, 0); s.translate((rand() - 0.5) * 26, -2 + rand() * 4, (rand() - 0.5) * 26); rock.push(paint(ni(s), C('#1a1c22'))); }
    for (let k = 0; k < 6; k++) { const t = new THREE.CylinderGeometry(3.2 - k * 0.12, 3.3 - k * 0.12, 4, 14); t.translate(0, 9 + k * 4, 0); rock.push(paint(ni(t), C(k % 2 ? '#a83028' : '#d8d8dc'))); }
    const top = new THREE.CylinderGeometry(3.6, 3.6, 0.6, 14); top.translate(0, 33, 0); rock.push(paint(ni(top), C('#202024')));
    const cap = new THREE.ConeGeometry(2.6, 3, 14); cap.translate(0, 38, 0); rock.push(paint(ni(cap), C('#202024')));
    const geo = mergeAll(rock); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, S.vmat));
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.2, 14), new THREE.MeshBasicMaterial({ color: '#ffe8b0' }));
    lampRoom.position.y = 35; g.add(lampRoom);
    const beams = new THREE.Group(); beams.position.y = 35; g.add(beams);
    const len = 520;
    const bu = { uLen: { value: len }, uOp: { value: 0.14 } };
    for (const s of [1, -1]) {
      const cg = new THREE.CylinderGeometry(0.4, 26, len, 24, 1, true); cg.translate(0, -len / 2, 0); cg.rotateZ(s * Math.PI / 2);
      beams.add(new THREE.Mesh(cg, new THREE.ShaderMaterial({ uniforms: bu, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, side: THREE.DoubleSide, ...add })));
    }
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff2d0', ...add })); flare.position.y = 35; flare.scale.setScalar(18); g.add(flare);
    g.position.set(x, 0, z); S.add(g);
    lighthouse = { g, x, z, beams, flare, bu, a: rand() * TAU };
  }
  function dropLighthouse() { if (!lighthouse) return; S.scene.remove(lighthouse.g); lighthouse.g.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material !== S.vmat) o.material.dispose(); }); lighthouse = null; }
  S.keep({ dispose: dropLighthouse });

  // ---------------------------------------------------------------- another ship, passing in the night
  let other = null;
  function makeOther() {
    const g = new THREE.Group(), L = 60 + rand() * 50;
    const hp = [];
    const hull = new THREE.BoxGeometry(12, 7, L); hull.translate(0, 1.5, 0); hp.push(paint(ni(hull), C('#0a0c12')));
    const sup = new THREE.BoxGeometry(9, 8, L * 0.4); sup.translate(0, 9, L * 0.15); hp.push(paint(ni(sup), C('#14161e')));
    const geo = mergeAll(hp); geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, S.vmat));
    const lights = [];
    for (let row = 0; row < 3; row++) for (let k = 0; k < 14; k++) if (rand() < 0.75) lights.push({ x: -6.1, y: 6 + row * 2.4, z: -L * 0.05 + k * (L * 0.4 / 14), col: '#ffd890', size: 2.2 });
    lights.push({ x: 0, y: 24, z: -L * 0.3, col: '#ffffff', size: 4.5 }, { x: 0, y: 20, z: L * 0.3, col: '#ffffff', size: 4 }, { x: -6.2, y: 13, z: 0, col: '#ff4030', size: 4 }); // coming the other way, you see her port side: red
    g.add(lightPoints(lights));
    const x = 200 + rand() * 140; // to starboard, where you can see it
    g.position.set(x, 0, -2600); S.add(g);
    other = { g, x, L, lights };
  }
  function dropOther() { if (!other) return; S.scene.remove(other.g); other.g.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material !== S.vmat) o.material.dispose(); }); other = null; }
  S.keep({ dispose: dropOther });

  // ---------------------------------------------------------------- the harbour at the journey's end
  const harbour = new THREE.Group(); harbour.visible = false; S.add(harbour);
  const harbourLights = [];
  {
    const hp = [];
    for (let k = 0; k < 7; k++) { const s = new THREE.SphereGeometry(140 + rand() * 120, 16, 8, 0, TAU, 0, Math.PI / 2); s.scale(1, 0.16 + rand() * 0.12, 0.6); s.translate(-500 + k * 170, -6, -330 - rand() * 120); hp.push(paint(ni(s), C('#0e1418'))); }
    const quay = new THREE.BoxGeometry(260, 4, 18); quay.translate(-20, 0, 40); hp.push(paint(ni(quay), C('#2a2a30')));
    
    const SL0 = 0.2, tb = 2 + 70 * SL0;
    const tower = new THREE.BoxGeometry(10, 40, 10); tower.translate(-60, tb + 20, -110); hp.push(paint(ni(tower), C('#24262c')));
    const spire = new THREE.ConeGeometry(8, 20, 4); spire.rotateY(Math.PI / 4); spire.translate(-60, tb + 50, -110); hp.push(paint(ni(spire), C('#1c1e24')));
    // the town climbs the hill behind the quay: a slope, and houses stepping up it, their windows lit
    const SL = 0.2, slope = new THREE.BoxGeometry(340, 6, 200); slope.rotateX(Math.atan(SL)); slope.translate(-20, 2 + 100 * SL - 3, -40 - 100); hp.push(paint(ni(slope), C('#101418')));
    const houses = [];
    for (let k = 0; k < 46; k++) {
      const w = 7 + rand() * 9, h = 6 + rand() * 9, x = -150 + rand() * 260, z = -46 - rand() * 150, yb = 2 + (-z - 40) * SL;
      const b = new THREE.BoxGeometry(w, h, 7); b.translate(x, yb + h / 2 - 1, z); hp.push(paint(ni(b), C(rand() < 0.5 ? '#22232a' : '#2a282c')));
      const roof = new THREE.ConeGeometry(w * 0.72, 4, 4); roof.rotateY(Math.PI / 4); roof.translate(x, yb + h + 1, z); hp.push(paint(ni(roof), C('#1a1a20')));
      houses.push([x, yb, z + 3.6, w, h]);
    }
    for (let k = 0; k < 6; k++) { const b = new THREE.BoxGeometry(5, 3, 14); b.translate(-110 + k * 28, 1, 62); hp.push(paint(ni(b), C('#1a1c24'))); }
    const geo = mergeAll(hp); geo.computeVertexNormals(); harbour.add(new THREE.Mesh(geo, S.vmat));
    const lts = [];
    for (const [x, yb, z, w, h] of houses) for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) lts.push({ x: x + (rand() - 0.5) * w * 0.7, y: yb + 1.5 + rand() * (h - 3), z, col: rand() < 0.85 ? '#ffc070' : '#fff0d0', size: 1.4 + rand() });
    for (let k = 0; k < 12; k++) lts.push({ x: -140 + k * 22, y: 9, z: 36, col: '#ffd890', size: 3.5, lamp: true });
    for (let k = 0; k < 6; k++) lts.push({ x: -110 + k * 28, y: 9, z: 62, col: k % 2 ? '#ff5040' : '#ffffff', size: 1.8 });
    lts.push({ x: -60, y: 2 + 64 * SL + 34, z: -104, col: '#fff4d8', size: 5 }); // the church clock
    harbour.add(lightPoints(lts));
    harbourLights.push(...lts.filter((l) => l.lamp || l.size > 5));
  }

  // ---------------------------------------------------------------- dolphins of light
  const dolphins = [];
  {
    const prof = [[0, 1.2], [0.12, 0.95], [0.22, 0.4], [0.24, 0], [0.2, -0.5], [0.12, -0.9], [0.05, -1.2], [0, -1.3]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.LatheGeometry(prof, 10); body.rotateX(-Math.PI / 2);
    const fin = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.2, 0.1), new THREE.Vector3(0, 0.55, 0.4), new THREE.Vector3(0, 0.2, 0.55)]);
    const tail = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 1.25), new THREE.Vector3(0.4, 0, 1.55), new THREE.Vector3(-0.4, 0, 1.55)]);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 1 } }, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vN, vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uA; varying vec3 vN, vV; void main(){ float r = 1. - abs(dot(normalize(vN), vV)); gl_FragColor = vec4(vec3(.05, .08, .12) + vec3(.2, .9, 1.) * pow(r, 2.) * 1.3 * uA, 1.); }',
    });
    fin.computeVertexNormals(); tail.computeVertexNormals();
    for (let k = 0; k < 3; k++) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(body, mat), new THREE.Mesh(fin, mat), new THREE.Mesh(tail, mat));
      g.scale.setScalar(1.1); g.visible = false; S.add(g);
      dolphins.push({ g, x: 10 + k * 2.5, z: -8 + k * 6, ph: rand() * 6, y: -3, wasUp: false });
    }
    S.keep({ dispose() { body.dispose(); fin.dispose(); tail.dispose(); mat.dispose(); } });
  }
  let dolphinT = -1e9;

  // ---------------------------------------------------------------- splashes of light, and the rain
  const NP = 500, sp = { pos: new Float32Array(NP * 3), vel: new Float32Array(NP * 3), birth: new Float32Array(NP).fill(-99), life: new Float32Array(NP).fill(1) };
  const spGeo = new THREE.BufferGeometry();
  const spAttr = { position: new THREE.BufferAttribute(sp.pos, 3), aVel: new THREE.BufferAttribute(sp.vel, 3), aBirth: new THREE.BufferAttribute(sp.birth, 1), aLife: new THREE.BufferAttribute(sp.life, 1) };
  for (const k in spAttr) { spAttr[k].setUsage(THREE.DynamicDrawUsage); spGeo.setAttribute(k, spAttr[k]); }
  const sparks = new THREE.Points(spGeo, new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uScale: U.uScale }, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, ...add }));
  sparks.frustumCulled = false; S.add(sparks);
  let spI = 0, spDirty = false, clock = 0;
  function splash(x, y, z, n, v = 2.5) {
    for (let k = 0; k < n; k++) {
      const i = spI; spI = (spI + 1) % NP;
      const a = rand() * TAU, s = v * (0.3 + rand() * 0.7);
      sp.pos.set([x + (rand() - 0.5) * 0.6, y, z + (rand() - 0.5) * 1.2], i * 3); sp.vel.set([Math.cos(a) * s * 0.5, s * (0.8 + rand()), Math.sin(a) * s * 0.5], i * 3);
      sp.birth[i] = clock; sp.life[i] = 0.8 + rand() * 0.9;
    }
    spDirty = true;
  }
  const NR_ = 360, rainPos = new Float32Array(NR_ * 6), rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMat = new THREE.LineBasicMaterial({ color: '#8aa0c8', opacity: 0, ...add });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; S.add(rain);
  const drops = Array.from({ length: NR_ }, () => ({ x: (rand() - 0.5) * 30, y: rand() * 14, z: (rand() - 0.5) * 30 }));

  // ---------------------------------------------------------------- the night
  let travel = 0, speed = 6, heardMusic = false, glowT = -1e9, mistT = -1e9, rainT = -1e9, rainDur = 60, nextIsland = 0, nextLight = 200, otherDue = 120, look = { yaw: -0.6, pitch: -0.08, ty: -0.6, tp: -0.08, next: 20 }, auroraNight = rand() < 0.5;
  const due = { dol: 150, glow: 300, mist: 220, rain: 400 };
  // a few islands already in view as the night begins
  for (let k = 0; k < 4; k++) makeIsland(k < 2, -300 - k * 600 - rand() * 300);
  function startDolphins() { dolphinT = clock; for (const d of dolphins) { d.g.visible = true; d.y = -3; d.ph = rand() * 3; } look.ty = -1.35; look.tp = -0.2; look.next = clock + 25; }
  S.onEvent((ev) => {
    if (ev.type === 'dolphins') { heardMusic = true; startDolphins(); }
    else if (ev.type === 'ship') { heardMusic = true; if (!other) makeOther(); }
    else if (ev.type === 'glow') { heardMusic = true; glowT = clock; }
    else if (ev.type === 'mist') { heardMusic = true; mistT = clock; }
    else if (ev.type === 'rain') { heardMusic = true; rainT = clock; rainDur = ev.dur ?? 70; }
  });
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const envelope = (t0, dur, rise = 12, fall = 15) => { const a = clock - t0; return a < 0 || a > dur ? 0 : Math.min(1, a / rise, (dur - a) / fall); };
  const cw = new THREE.Vector3(), lightList = [];

  S.on((t, dt, st) => {
    clock = t; const e = st.energy;
    dt = Math.min(dt, 0.1);
    // ---- the harbour comes into view late in the night, and the ferry slows into it
    const arrive = smooth(0.2, 0.42, e); // 1: open sea; 0: alongside the quay
    harbour.visible = e < 0.45;
    if (harbour.visible) harbour.position.set(70, 0, -(150 + 1900 * arrive));
    speed += ((1.5 + 4.5 * smooth(0.22, 0.6, e)) * (0.15 + 0.85 * arrive) - speed) * Math.min(1, dt * 0.2);
    travel += speed * dt;
    // ---- the sea: waves calm through the night
    const amp = (0.3 + 0.7 * e) * (1 + envelope(rainT, rainDur, 20, 20) * 0.3);
    WU.uAmp.value = amp;
    for (let i = 0; i < NWAVE; i++) {
      const w = waves[i];
      WU.uWv.value[i].set(w.dir[0], w.dir[1], w.k, w.amp * amp);
      WU.uPh.value[i] = ((w.ph - w.w * t - w.k * w.dir[1] * travel) % TAU + TAU) % TAU; // worked out here, in double precision
    }
    WU.uTw.value = travel % 512; WU.uTt.value = t % 1024; SU.uTime.value = t % 6283;
    WU.uWake.value = Math.min(1, speed / 4);
    // ---- events: the music's, or our own when there's no music
    if (!heardMusic) {
      if ((due.dol -= dt) < 0) { due.dol = 240 + rand() * 200; if (e > 0.3) startDolphins(); }
      if ((due.glow -= dt) < 0) { due.glow = 400 + rand() * 300; glowT = clock; }
      if ((due.mist -= dt) < 0) { due.mist = 350 + rand() * 300; mistT = clock; }
      if ((due.rain -= dt) < 0) { due.rain = 500 + rand() * 400; if (e > 0.3) { rainT = clock; rainDur = 60 + rand() * 40; } }
      if ((otherDue -= dt) < 0) { otherDue = 300 + rand() * 300; if (!other && e > 0.35) makeOther(); }
    }
    const glowA = Math.max(envelope(glowT, 80, 15, 25), 0) * 0.9 + 0.08 * (1 - e);
    const mist = envelope(mistT, 120, 25, 35);
    const rainA = envelope(rainT, rainDur, 12, 15);
    WU.uGlow.value = glowA; SU.uMist.value = mist; SU.uRain.value = rainA;
    SU.uAur.value = auroraNight ? smooth(0.85, 0.5, e) * smooth(0.2, 0.35, e) * 0.9 : 0;
    const fogD = 0.0011 * (1 + mist * 4 + rainA * 1.5);
    WU.uFogD.value = fogD; S.scene.fog.density = fogD * 1.1;
    S.scene.fog.color.setRGB(0.06 + mist * 0.05, 0.08 + mist * 0.04, 0.15 + mist * 0.02);
    // ---- the moon swings round ahead as the night goes on
    const maz = -0.95 + 0.75 * (1 - e), mel = 0.2 + 0.08 * e;
    moon.set(Math.sin(-maz) * Math.cos(mel), Math.sin(mel), -Math.cos(maz) * Math.cos(mel));
    moonL.position.copy(moon).multiplyScalar(100);
    // ---- islands drift past (none once the harbour's in sight)
    for (const isl of [...islands]) { isl.z += speed * dt; isl.g.position.z = isl.z; if (isl.z > 1500) dropIsland(isl); }
    if (travel > nextIsland && islands.length < 6 && e > 0.42) { makeIsland(rand() < 0.5, -2800 - rand() * 400); nextIsland = travel + 260 + rand() * 420; }
    for (const isl of islands) { const pts = isl.g.children[1]; if (pts?.userData.on) { const on = pts.userData.on; let ch = false; pts.userData.offAt.forEach((v, i) => { const want = e > v ? 1 : 0; if (on[i] !== want) { on[i] = want; ch = true; } }); if (ch) pts.geometry.attributes.aOn.needsUpdate = true; } }
    if (lighthouse) { lighthouse.z += speed * dt; lighthouse.g.position.z = lighthouse.z; if (lighthouse.z > 1600) dropLighthouse(); }
    else if (travel > nextLight && e > 0.45) { makeLighthouse(-2600); nextLight = travel + 4000 + rand() * 3000; }
    if (lighthouse) {
      lighthouse.a += dt * 0.55; lighthouse.beams.rotation.y = lighthouse.a;
      const toCam = Math.atan2(-lighthouse.g.position.z, -lighthouse.x), face = Math.max(Math.cos(lighthouse.a - toCam), Math.cos(lighthouse.a + Math.PI - toCam));
      lighthouse.flash = Math.pow(Math.max(0, face), 30);
      lighthouse.flare.scale.setScalar(14 + 50 * lighthouse.flash); lighthouse.flare.material.opacity = 0.6 + 0.4 * lighthouse.flash;
      lighthouse.bu.uOp.value = 0.11 * (1 + mist * 1.5 + rainA * 0.6);
    }
    if (other) { other.g.position.z += (speed + 9) * dt; if (other.g.position.z > 2000) dropOther(); }
    // ---- dolphins: alongside for a while, under the glowing water, leaping
    const dolA = envelope(dolphinT, 45, 4, 8);
    WU.uDolA.value = dolA;
    dolphins.forEach((d, k) => {
      if (dolA <= 0) { d.g.visible = false; WU.uDol.value[k].set(0, -9, 0); return; }
      d.ph += dt * (0.55 + k * 0.07);
      const cyc = d.ph % 3.2, leap = cyc < 1.1 ? Math.sin((cyc / 1.1) * Math.PI) : 0;
      d.y = leap > 0 ? -0.6 + leap * 2.1 : -1.4 + Math.sin(d.ph * 2) * 0.3;
      const x = 9 + k * 2.6 + Math.sin(d.ph * 0.7) * 1.2, z = -14 + k * 5 + Math.sin(d.ph * 0.4 + k) * 4;
      const up = d.y > -0.05;
      if (up !== d.wasUp) splash(x, 0, z, 26, 2.2);
      d.wasUp = up;
      d.g.visible = d.y > -0.9; d.g.position.set(x, d.y, z);
      d.g.rotation.set(cyc < 1.1 ? Math.cos((cyc / 1.1) * Math.PI) * 0.7 : 0, 0, 0);
      d.g.children[0].material.uniforms.uA.value = dolA;
      WU.uDol.value[k].set(x, d.y, z);
      if (d.y < -0.15 && rand() < dt * 3) splash(x, -0.05, z + 1.2, 1, 0.6);
    });
    // ---- the rain
    rainMat.opacity = rainA * 0.35;
    if (rainA > 0) {
      camera.getWorldPosition(cw);
      drops.forEach((d, i) => {
        d.y -= dt * 11; if (d.y < 0) { d.y = 12 + rand() * 4; d.x = cw.x + (rand() - 0.5) * 30; d.z = cw.z + (rand() - 0.5) * 30; }
        rainPos.set([d.x, d.y, d.z, d.x + 0.03, d.y - 0.5, d.z], i * 6);
      });
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (spDirty) { for (const k in spAttr) spAttr[k].needsUpdate = true; spDirty = false; }
    // ---- the ship rolls, pitches and heaves on the swell
    const rollA = (0.012 + 0.03 * e) * (1 + rainA * 0.4);
    ship.rotation.set(Math.sin(t * 0.37) * rollA * 0.35, 0, Math.sin(t * 0.52 + 1) * rollA + Math.sin(t * 0.21) * rollA * 0.4);
    ship.position.y = Math.sin(t * 0.45) * 0.08 * (0.4 + e);
    // ---- the deck lamps: warm, flickering a little, going out one by one at the very end
    lamps.forEach((L, k) => {
      const on = smooth(0.12 + k * 0.04, 0.2 + k * 0.04, e);
      const f = on * (0.92 + 0.08 * Math.sin(t * 9 + k * 3) * Math.sin(t * 5.7 + k));
      L.glow.material.opacity = f; L.body.material.color.setRGB(1 * f + 0.1, 0.88 * f + 0.08, 0.66 * f + 0.06);
      if (L.light) L.light.intensity = 6 * f;
    });
    portMat.opacity = 0.35 + 0.65 * smooth(0.15, 0.4, e);
    mastLight.material.opacity = 0.9; greenLight.material.opacity = 0.85;
    // ---- where you're looking: ahead past the bow, out to sea, back along the wake, up at the sky
    if (clock > look.next) {
      const views = [[-0.35, -0.06], [-1.35, -0.12], [-1.1, 0.25], [-2.55, -0.14], [-0.8, -0.05], [-1.6, 0.05]];
      let v = views[Math.floor(rand() * views.length)];
      if (lighthouse && Math.abs(lighthouse.z) < 900) v = [Math.atan2(-lighthouse.x, -lighthouse.z), 0.02];
      else if (other && Math.abs(other.g.position.z) < 700) v = [Math.atan2(-other.x, -other.g.position.z), 0];
      if (harbour.visible) v = [-0.3, -0.02];
      look.ty = v[0]; look.tp = v[1]; look.next = clock + 22 + rand() * 25;
    }
    look.yaw += (look.ty - look.yaw) * Math.min(1, dt * 0.12); look.pitch += (look.tp - look.pitch) * Math.min(1, dt * 0.15);
    camera.position.set(3.15 + Math.sin(t * 0.11) * 0.08, DECK + 1.62, -2.5);
    camera.rotation.set(0, 0, 0); camera.rotateY(look.yaw + Math.sin(t * 0.07) * 0.06); camera.rotateX(look.pitch + Math.sin(t * 0.13) * 0.015);
    camera.getWorldPosition(cw); dome.position.copy(cw);
    // ---- the lights the sea throws back: the deck lamps, the lighthouse, the other ship, islands, the harbour
    lightList.length = 0;
    const L = (x, y, z, r, g, b, k) => lightList.push([x, y, z, r * k, g * k, b * k]);
    lamps.forEach((l) => L(1.75, DECK + 2.1, l.z, 1, 0.75, 0.4, 0.5 * l.glow.material.opacity));
    L(0, DECK + 7.3, -11, 1, 1, 1, 0.3); L(1.75, DECK + 2.4, -7.1, 0.2, 1, 0.4, 0.4);
    if (lighthouse) L(lighthouse.x, 35, lighthouse.z, 1, 0.95, 0.8, 0.6 + 3 * lighthouse.flash);
    if (other) { const o = other.g.position; L(o.x - 6, 8, o.z, 1, 0.85, 0.55, 1.2); L(o.x, 24, o.z - other.L * 0.3, 1, 1, 1, 0.8); L(o.x - 6, 13, o.z, 1, 0.25, 0.2, 0.6); }
    for (const isl of islands) for (let k = 0; k < Math.min(3, isl.lights.length); k++) { const l = isl.lights[k]; const on = isl.g.children[1]?.userData.on[k]; if (on) L(isl.x + l.x, l.y, isl.z + l.z, 1, 0.75, 0.4, 0.9); }
    if (harbour.visible) for (const l of harbourLights) L(harbour.position.x + l.x, l.y, harbour.position.z + l.z, 1, 0.8, 0.5, (l.size > 5 ? 2 : 1.2) * (1 - arrive * 0.5));
    lightList.sort((a, b) => (a[0] * a[0] + a[2] * a[2]) / (a[3] + a[4] + 0.01) - (b[0] * b[0] + b[2] * b[2]) / (b[3] + b[4] + 0.01));
    const nl = Math.min(NLIGHT, lightList.length); WU.uNL.value = nl;
    for (let i = 0; i < nl; i++) { const l = lightList[i]; WU.uLP.value[i].set(l[0], l[1], l[2]); WU.uLC.value[i].set(l[3], l[4], l[5]); }
    // ---- the horizon's outline, for the sea's reflections
    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) {
      silData.fill(0);
      const shapes = islands.map((i) => [i.x, i.z, i.r * 0.8, i.h * 0.9]);
      if (lighthouse) shapes.push([lighthouse.x, lighthouse.z, 22, 36]);
      if (harbour.visible) for (let k = 0; k < 7; k++) shapes.push([harbour.position.x - 500 + k * 170, harbour.position.z - 380, 150, 30]);
      if (other) shapes.push([other.g.position.x, other.g.position.z, other.L / 2, 12]);
      for (const [x, z, r, h] of shapes) {
        const d = Math.hypot(x, z); if (d < r + 5) continue;
        const az = Math.atan2(x, -z), half = Math.atan(r / d), el = Math.atan(h / d);
        for (let u = Math.floor((az - half) / TAU * SIL_N); u <= Math.ceil((az + half) / TAU * SIL_N); u++) {
          const a = (u / SIL_N) * TAU, k = 1 - Math.pow((a - az) / half, 2); if (k <= 0) continue;
          const i = ((u + SIL_N / 2) % SIL_N + SIL_N) % SIL_N, v = Math.min(255, Math.round((el * Math.sqrt(k)) / 0.35 * 255));
          if (v > silData[i * 4]) silData[i * 4] = v;
        }
      }
      silTex.needsUpdate = true;
    }
  });
  S.scene.userData.ferry = { get state() { return { travel, speed, islands: islands.length, lighthouse: !!lighthouse, other: !!other, glow: WU.uGlow.value, mist: SU.uMist.value, rain: SU.uRain.value, dol: WU.uDolA.value, harbour: harbour.visible, lights: WU.uNL.value }; },
    dolphins: startDolphins, ship: () => { if (!other) makeOther(); if (other) other.g.position.z = -500; }, glow: () => { glowT = clock; }, mist: () => { mistT = clock; }, rain: () => { rainT = clock; rainDur = 80; },
    lighthouse: () => { dropLighthouse(); makeLighthouse(-450); }, look: (y, p) => { look.ty = look.yaw = y; look.tp = look.pitch = p; look.next = clock + 999; } };
  return S.finalize({ portraitFov: 72 });
}
