// The Sleeper Train: a night journey in a cosy couchette compartment. A real railway line, made up
// as the train goes, curves away ahead; the carriage leans into the bends and, out of the window on
// the inside of a curve, you see the rest of the train snaking round it, its windows lit and the
// engine's smoke drifting back. Outside is a papercut world in moonlit blues: layer upon layer of
// cut-paper hills, a tree line, hedgerows, farms and villages whose windows glow and go out one by
// one through the night, cows and sheep in the fields, telegraph poles whipping past, and the train's
// own lit windows throwing moving squares of warm light over everything it passes.
//
// The rails set the pace: the music runs the journey (train-journey.js) and tells the scene how fast
// the train is going and what's coming, so the clickety-clack, the stations, tunnels, viaducts, level
// crossings and passing trains are where the sounds say they are. The train stops at country
// stations (lamps, a nameboard, a clock with the real time, a cat on a bench, the guard walking up
// with his lantern); in tunnels the window turns into a mirror and you see the compartment in it.
//
// Everything outside lives along the track: it's generated in 50 m chunks ahead and recycled behind,
// into one ribbon geometry (hills, ground, the track bed) and one instanced set of paper cutouts.
import { createStage, canvasTexture, THREE, TAU } from '../kit.js';
import { softBox } from '../interior.js';
import { createJourney } from './train-journey.js';

const SEG = 2, CHUNK = 50, NCH = 26, BEHIND = 9, K = 72, RAIL = 18;
const CARLEN = 20.5, BOGIE = 7, NCARS = 7, OURS = 3; // ours is the fourth carriage, three ahead and three behind
const FL = 1.2; // the compartment floor, above the rails

// ------------------------------------------------------------------ the papercut world's layers
// walls: cut-paper ribbons standing beside the line; flats: the ground and the track bed
const STRIPS = [
  { wall: true, d: 55, step: 2, base: 4, amp: 5, f: 1 / 23, col: '#172240', trees: true, hillK: 1, drop: 30 },
  { wall: true, d: 95, step: 5, base: 8, amp: 12, f: 1 / 95, col: '#22345e', hillK: 0.8, drop: 34 },
  { wall: true, d: 160, step: 6.25, base: 14, amp: 26, f: 1 / 230, col: '#2f4676', hillK: 0.3, drop: 52 },
  { wall: true, d: 265, step: 10, base: 22, amp: 58, f: 1 / 470, col: '#3f5890', hillK: 0, drop: 0 },
  { wall: true, d: -42, step: 2.5, base: 4, amp: 5, f: 1 / 27, col: '#1b2744', trees: true, hillK: 1, drop: 30 },
  { wall: true, d: -120, step: 6.25, base: 10, amp: 22, f: 1 / 180, col: '#26375f', hillK: 0.6, drop: 14 },
  { wall: true, d: 7.4, step: 2, near: 'cut', col: '#1d2436' },
  { wall: true, d: -3.2, step: 2, near: 'cut', col: '#1d2436' },
  { wall: true, d: 6.1, step: 2, near: 'para', col: '#262836' },
  { flat: true, l0: 5.9, l1: 56, y: -0.7, step: 5, kind: 1, col: '#1c2b34', ground: true, widen: true },
  { flat: true, l0: -1.9, l1: 5.9, y: -0.45, step: 2, kind: 2, col: '#2a2a32', bed: true },
  { flat: true, l0: -43, l1: -1.9, y: -0.7, step: 5, kind: 1, col: '#1c2b34', ground: true },
  { flat: true, l0: 56, l1: 262, y: -0.7, step: 10, kind: 1, col: '#1a2a36', valley: true },
  { flat: true, l0: 175, l1: 228, y: -0.7, step: 10, kind: 4, col: '#2a3a6a', river: true },
];
let VPS = 0, IPS = 0; // vertices and indices per chunk slot
for (const s of STRIPS) { s.cols = Math.round(CHUNK / s.step) + 1; s.v0 = VPS; VPS += s.cols * 2; IPS += (s.cols - 1) * 6; }

const PAPER_COMMON = `
uniform vec4 uCar[${NCARS}]; uniform float uCarL[${NCARS}]; uniform vec3 uFog, uWarm; uniform float uFogD, uLitFrac, uTime;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// warm light from the train's windows, falling on whatever is beside the line
float carLight(vec3 p) {
  float acc = 0.0;
  for (int i = 0; i < ${NCARS}; i++) {
    vec2 d = p.xz - uCar[i].xy, dir = uCar[i].zw;
    float a = dot(d, dir), l = abs(dir.x * d.y - dir.y * d.x);
    if (abs(a) > 11.0 || l < 1.5 || l > 26.0) continue;
    float lo = 2.4 - 0.62 * (l - 0.9) - 0.4, hi = 2.4 + 0.9 * (l - 0.9);
    float band = smoothstep(lo - 0.5, lo + 0.3, p.y) * (1.0 - smoothstep(hi - 0.3, hi + 0.5, p.y));
    float blur = min(1.2, 0.12 + l * 0.035);
    float w = smoothstep(-0.31 - blur, -0.31 + blur, cos(6.2832 * a / 2.2));
    float ends = 1.0 - smoothstep(9.2, 10.6, abs(a));
    acc += uCarL[i] * w * band * ends * 2.4 / (1.0 + 0.05 * l * l);
  }
  return acc;
}
vec3 finish(vec3 col, float lit, float dist) {
  col += uWarm * min(lit, 1.2) * (0.12 + 0.9 * dot(col, vec3(0.3, 0.5, 0.2)));
  return mix(col, uFog, 1.0 - exp(-dist * uFogD));
}`;

const WORLD_V = `
attribute vec3 aCol; attribute float aTop, aKind; attribute vec2 aSL;
varying vec3 vCol, vW; varying float vTop, vKind, vDist; varying vec2 vSL;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vCol = aCol; vTop = aTop; vKind = aKind; vSL = aSL;
  vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv;
}`;
const WORLD_F = `${PAPER_COMMON}
uniform float uBlur;
varying vec3 vCol, vW; varying float vTop, vKind, vDist; varying vec2 vSL;
void main() {
  vec3 col = vCol;
  if (vKind < 0.5) { // a paper hill: fibres, a moonlit cut edge along the top, darker lower down
    float g = vn(vec2(vSL.x * 0.9, vW.y * 0.9)) * 0.5 + vn(vec2(vSL.x * 4.0, vW.y * 4.0)) * 0.5;
    col *= 0.9 + 0.14 * g;
    col *= 0.62 + 0.38 * smoothstep(vTop - 14.0, vTop, vW.y);
    float rim = 1.0 - smoothstep(0.0, 0.28 + vDist * 0.002, vTop - vW.y);
    col += vec3(0.06, 0.075, 0.12) * rim;
    col *= 0.85 + 0.3 * vn(vec2(vSL.x / 60.0, vTop));
    if (vSL.y > 70.0 || vSL.y < -70.0) { // far farms: a lit window or two on the hillsides
      float cx = floor(vSL.x / 7.0), h = h21(vec2(cx, floor(vSL.y)));
      if (h > 0.86) {
        float wy = vTop - 2.5 - fract(h * 31.0) * min(14.0, vTop * 0.5), wx = (cx + 0.3 + fract(h * 17.0) * 0.4) * 7.0;
        float sz = 0.45 + vDist * 0.0018;
        if (abs(vSL.x - wx) < sz && abs(vW.y - wy) < sz * 0.8 && fract(h * 53.0) < uLitFrac) col = uWarm * (0.9 + 0.2 * fract(h * 7.0));
      }
    }
  } else if (vKind < 1.5) { // fields: patches of paper in different shades, some ploughed
    vec2 c = floor(vec2(vSL.x / 38.0, vSL.y / 26.0));
    float h = h21(c), h2 = h21(c + 7.3);
    col *= 0.78 + 0.4 * h;
    float fur = h2 > 0.5 ? sin(vSL.x * 5.0) : sin(vSL.y * 5.0);
    col *= 0.94 + 0.06 * fur * step(0.35, h2);
    col *= 0.92 + 0.16 * vn(vSL * 1.7);
    if (vSL.y > 66.0) { // down in the valley, the lights of farms and a village
      vec2 cc = floor(vSL / 9.0); float h = h21(cc + 3.1);
      if (h > 0.84 && fract(h * 41.0) < uLitFrac) { vec2 dd = abs(vSL - (cc + 0.5) * 9.0); float sz = 0.8 + vDist * 0.004; if (dd.x < sz && dd.y < sz * 0.8) col = uWarm * (0.8 + 0.3 * fract(h * 13.0)); }
    }
  } else if (vKind > 2.5 && vKind < 3.5) { // a tunnel's lining: sooty brick, a lamp now and then, the train's windows sliding along it
    float row = floor(vW.y / 0.32), bx = fract((vSL.x + mod(row, 2.0) * 0.45) / 0.9), by = fract(vW.y / 0.32);
    col = vec3(0.022, 0.019, 0.021) * (0.8 + 0.4 * h21(vec2(floor((vSL.x + mod(row, 2.0) * 0.45) / 0.9), row)));
    col *= 0.75 + 0.25 * step(0.06, bx) * step(0.1, by);
    float ld = mod(vSL.x + 22.5, 45.0) - 22.5, ly = vW.y - 3.4;
    col += vec3(1.0, 0.85, 0.6) * (exp(-(ld * ld + ly * ly * 2.0) * 6.0) * 3.0 + exp(-(ld * ld + ly * ly) * 0.08) * 0.08);
  } else if (vKind > 3.5 && vKind < 4.5) { // the river in the valley: dark water, the moon glittering on it
    col = vCol * (0.8 + 0.3 * vn(vSL * vec2(0.08, 0.3)));
    float gl = vn(vec2(vSL.x * 0.6 + uTime * 0.5, vSL.y * 3.0 - uTime * 0.2));
    col += vec3(0.7, 0.75, 0.9) * smoothstep(0.72, 0.92, gl) * 0.9;
  } else if (vKind > 4.5 && vKind < 5.5) { // the platform: flagstones, a white edge, pools of lamplight
    vec2 fl = fract(vec2(vSL.x / 0.9, vSL.y / 0.9));
    col *= (0.85 + 0.25 * h21(floor(vec2(vSL.x / 0.9, vSL.y / 0.9)))) * (0.8 + 0.2 * step(0.05, fl.x) * step(0.05, fl.y));
    col = mix(col, vec3(0.55, 0.55, 0.6), 1.0 - smoothstep(2.05, 2.15, vSL.y));
    float ld = mod(vSL.x - vTop + 7.5, 15.0) - 7.5, lw = vSL.y - 7.4;
    col += vec3(1.0, 0.78, 0.45) * exp(-(ld * ld) / 12.0 - (lw * lw) / 9.0) * 0.32;
  } else if (vKind > 5.5) { // the platform's edge
    col *= 0.7 + 0.3 * step(0.8, vW.y) + 0.1 * vn(vSL * vec2(3.0, 3.0));
  } else { // the track bed: ballast, sleepers and rails for both lines (the sleepers blur at speed)
    float l = vSL.y, best = 9.0;
    for (int k = 0; k < 2; k++) {
      float ll = l - (k == 0 ? 0.0 : vTop);
      if (abs(ll) < 1.3) {
        float sl = 0.5 + 0.5 * cos(6.2832 * vSL.x / 0.65) * exp(-uBlur * uBlur * 14.0);
        col = mix(col, vec3(0.05, 0.04, 0.035), 0.6 * sl);
      }
      best = min(best, abs(abs(ll) - 0.72));
    }
    col *= 0.85 + 0.3 * vn(vSL * vec2(9.0, 9.0));
    col = mix(col, vec3(0.42, 0.46, 0.56), 1.0 - smoothstep(0.015, 0.05, best));
  }
  gl_FragColor = vec4(finish(col, carLight(vW) * (vKind > 2.5 && vKind < 3.5 ? 0.3 : 1.0), vDist), 1.0);
}`;
const ITEM_V = `
attribute vec2 aCell; attribute vec3 aCol, aGlow; attribute float aRnd;
varying vec2 vUv; varying vec3 vCol, vGlow, vW; varying float vRnd, vDist;
void main() {
  vUv = (aCell + uv) / vec2(8.0, 4.0); vCol = aCol; vGlow = aGlow; vRnd = aRnd;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv;
}`;
const ITEM_F = `${PAPER_COMMON}
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec3 vCol, vGlow, vW; varying float vRnd, vDist;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < 0.5) discard;
  vec3 col = vCol * (t.g / 0.78) * (0.92 + 0.12 * vn(vUv * 300.0));
  float on = vRnd < -0.5 ? step(0.5, fract(uTime * 0.85 + (vRnd < -1.5 ? 0.5 : 0.0))) : step(vRnd, uLitFrac); // crossing lights flash in turn
  if (t.r > 0.5) col = on > 0.5 ? vGlow * 1.7 : vCol * 0.45;   // a window or a lamp: lit, or not any more
  gl_FragColor = vec4(finish(col, carLight(vW), vDist), 1.0);
}`;
const GLASS_V = `uniform mat4 uTexMat; varying vec4 vR; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vR = uTexMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GLASS_F = `uniform sampler2D uRefl; uniform float uStrength; varying vec4 vR; void main() { vec3 c = texture2DProj(uRefl, vR).rgb; gl_FragColor = vec4(c * uStrength + vec3(0.012, 0.015, 0.02), 1.0); }`;
const SKY_V = `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_F = `
uniform vec3 uTop, uHor, uMoon; uniform float uTime;
varying vec3 vDir;
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
void main() {
  vec3 d = normalize(vDir);
  vec3 col = mix(uHor, uTop, smoothstep(-0.02, 0.5, d.y));
  vec3 c = floor(d * 260.0); float s = h31(c);
  if (s > 0.9965 && d.y > 0.02) { float tw = 0.6 + 0.4 * sin(uTime * (1.0 + s * 3.0) + s * 40.0); col += vec3(0.9, 0.92, 1.0) * tw * (s - 0.9965) * 220.0 * smoothstep(0.02, 0.2, d.y); }
  float m = dot(d, uMoon);
  col += vec3(0.25, 0.27, 0.36) * pow(max(m, 0.0), 300.0) * 1.0 + vec3(0.06, 0.07, 0.11) * pow(max(m, 0.0), 30.0);
  float disc = smoothstep(0.9985, 0.99868, m);
  vec3 mc = vec3(1.0, 0.96, 0.84) * (0.88 + 0.12 * h31(floor(d * 3000.0)));
  col = mix(col, mc * 0.8, disc);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createTrainScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x7a17, bg: '#0a0e22', exposure: 1.05, bloom: [0.6, 0.45, 0.6], finish: { vignette: 0.4, grain: 0.03, ca: 0.25 }, fov: 50 });
  const { rand } = S;
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const R = (seed * 2654435761) >>> 0;
  const hash = (n, m = 0) => { let h = (Math.imul(n | 0, 374761393) + Math.imul(m | 0, 668265263) + R) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const n1 = (x, salt = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, salt) * (1 - u) + hash(i + 1, salt) * u; };
  const fbm = (x, salt) => n1(x, salt) * 0.55 + n1(x * 2.13, salt + 1) * 0.28 + n1(x * 4.7, salt + 2) * 0.17;
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ---------------------------------------------------------------- the line: made up as we go, curving gently
  const MOON = new THREE.Vector3(0.62, 0.2, 0.72).normalize();
  const tx = [0], tz = [0], th = [Math.atan2(-MOON.x, MOON.z) - 0.35]; // start off with the moon in the window
  const ph = [rand() * 100, rand() * 100, rand() * 100];
  const curv = (s) => {
    const k = 0.62 * Math.sin(s / 640 + ph[0]) + 0.38 * Math.sin(s / 251 + ph[1]);
    const straight = sstep(0.15, 0.45, Math.abs(Math.sin(s / 1900 + ph[2])));
    return (Math.max(-1, Math.min(1, k * 1.5)) * straight) / 470;
  };
  function extend(sMax) {
    while ((tx.length - 1) * SEG < sMax) {
      const i = tx.length - 1, s = i * SEG, h = th[i] + curv(s + SEG / 2) * SEG;
      tx.push(tx[i] + Math.cos(h) * SEG); tz.push(tz[i] + Math.sin(h) * SEG); th.push(h);
    }
  }
  const at = { x: 0, z: 0, dx: 1, dz: 0 };
  function track(s, o = at) { // position and direction at a distance along the line
    const u = s / SEG, i = Math.max(0, Math.min(tx.length - 2, Math.floor(u))), f = u - i;
    o.x = tx[i] + (tx[i + 1] - tx[i]) * f; o.z = tz[i] + (tz[i + 1] - tz[i]) * f;
    const h = th[i] + (th[i + 1] - th[i]) * f; o.dx = Math.cos(h); o.dz = Math.sin(h);
    return o;
  }
  let dist = 500; // how far we've come
  extend(dist + (NCH - BEHIND + 2) * CHUNK);
  { const h0 = th[0] + (th[0] - th[dist / SEG]); tx.length = tz.length = th.length = 1; th[0] = h0; extend(dist + (NCH - BEHIND + 2) * CHUNK); } // so we're facing it where we begin

  // ---------------------------------------------------------------- what's on the line here: tunnels, viaducts, stations, crossings
  const features = [];
  function fAt(s) {
    let cut = -1.5, lining = 0, hill = 0, vf = 0, wid = 0, para = -1.5;
    for (const f of features) {
      if (s < f.s0 - 420 || s > f.s1 + 420) continue;
      if (f.kind === 'tunnel') {
        cut = Math.max(cut, lerp(-1.5, 11, Math.min(sstep(f.s0 - 150, f.s0, s), 1 - sstep(f.s1, f.s1 + 150, s))));
        if (s >= f.s0 && s <= f.s1) lining = 1;
        hill = Math.max(hill, Math.min(sstep(f.s0 - 280, f.s0 - 30, s), 1 - sstep(f.s1 + 30, f.s1 + 280, s)));
      } else if (f.kind === 'viaduct') {
        vf = Math.max(vf, Math.min(sstep(f.s0 - 40, f.s0 + 30, s), 1 - sstep(f.s1 - 30, f.s1 + 40, s)));
        if (s > f.s0 - 45 && s < f.s1 + 45) para = 1.25;
      } else if (f.kind === 'station') wid = Math.max(wid, Math.min(sstep(f.s0 - 200, f.s0 - 140, s), 1 - sstep(f.s0 + 150, f.s0 + 210, s)));
    }
    return { cut, lining, hill, vf, wid: wid * 6.3, para };
  }
  const groundY = (s, fa = fAt(s)) => -0.7 - 30 * fa.vf;

  // ---------------------------------------------------------------- the sky: a gradient, stars, a paper moon
  const skyU = { uTop: { value: new THREE.Color('#060a1e') }, uHor: { value: new THREE.Color('#34447a') }, uMoon: { value: MOON }, uTime: S.U.uTime };
  const moonL = new THREE.DirectionalLight('#8a9ad0', 0.6); moonL.position.set(0.62, 0.3, 0.72); S.add(moonL);
  S.add(new THREE.HemisphereLight('#3a4a80', '#10141c', 0.35));
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, depthTest: false }));
  sky.renderOrder = -10; sky.frustumCulled = false; S.add(sky);

  // ---------------------------------------------------------------- the papercut world: one ribbon geometry, recycled chunk by chunk
  const carU = Array.from({ length: NCARS }, () => new THREE.Vector4());
  const PU = { uCar: { value: carU }, uCarL: { value: new Array(NCARS).fill(1) }, uFog: { value: new THREE.Color('#2e3e70') }, uWarm: { value: new THREE.Color('#ffb868') }, uFogD: { value: 0.0042 }, uBlur: { value: 0 }, uLitFrac: { value: 0.8 }, uTime: S.U.uTime };
  const wg = new THREE.BufferGeometry();
  const wPos = new Float32Array(VPS * NCH * 3), wCol = new Float32Array(VPS * NCH * 3), wTop = new Float32Array(VPS * NCH), wKind = new Float32Array(VPS * NCH), wSL = new Float32Array(VPS * NCH * 2);
  const wIdx = new Uint32Array(IPS * NCH);
  { let ii = 0;
    for (let c = 0; c < NCH; c++) for (const s of STRIPS) for (let k = 0; k < s.cols - 1; k++) { const a = c * VPS + s.v0 + k * 2; wIdx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], ii); ii += 6; } }
  wg.setAttribute('position', new THREE.BufferAttribute(wPos, 3)); wg.setAttribute('aCol', new THREE.BufferAttribute(wCol, 3));
  wg.setAttribute('aTop', new THREE.BufferAttribute(wTop, 1)); wg.setAttribute('aKind', new THREE.BufferAttribute(wKind, 1)); wg.setAttribute('aSL', new THREE.BufferAttribute(wSL, 2));
  wg.setIndex(new THREE.BufferAttribute(wIdx, 1));
  const world = new THREE.Mesh(wg, new THREE.ShaderMaterial({ uniforms: PU, vertexShader: WORLD_V, fragmentShader: WORLD_F, side: THREE.DoubleSide }));
  world.frustumCulled = false; S.add(world);
  const tmpC = new THREE.Color();
  const wallTop = (s, st, i, fa) => {
    if (st.near) return st.near === 'cut' ? fa.cut : fa.para;
    let h = st.base + st.amp * fbm(s * st.f, 10 + i * 7) + 34 * fa.hill * st.hillK - st.drop * fa.vf;
    if (st.trees) { const w = n1(s / 70, 90 + i); h += w > 0.3 ? (2 + 5 * (w - 0.45)) * (0.6 + 0.4 * Math.abs(Math.sin(s * 0.35 + 3 * n1(s / 9, 95)))) : 0; } // a tree line, here and there
    return h;
  };
  function buildRibbons(c, slot) {
    const s0 = c * CHUNK, p = {};
    STRIPS.forEach((st, si) => {
      tmpC.set(st.col);
      for (let k = 0; k < st.cols; k++) {
        const s = s0 + k * st.step; track(s, p);
        const nx = -p.dz, nz = p.dx, fa = fAt(s), gy = groundY(s, fa);
        let kind = st.wall ? (st.near === 'cut' && fa.lining ? 3 : 0) : st.kind;
        for (let v = 0; v < 2; v++) {
          const vi = slot * VPS + st.v0 + k * 2 + v;
          let x, y, z, lat, top;
          if (st.wall) { lat = st.d; top = wallTop(s, st, si, fa); x = p.x + nx * lat; z = p.z + nz * lat; y = v ? top : Math.min(-12, top - 10) - (st.near ? 0 : 30 * fa.vf); }
          else {
            lat = v ? st.l1 + (st.bed ? fa.wid : 0) : st.l0 + (st.widen ? fa.wid : 0);
            x = p.x + nx * lat; z = p.z + nz * lat;
            y = st.ground ? gy : st.river ? gy + 0.35 * fa.vf - 5 * (1 - fa.vf) : st.valley ? gy + 0.05 * fa.vf - 5 * (1 - fa.vf) : st.y;
            top = st.bed ? 4.2 + fa.wid : y;
          }
          wPos[vi * 3] = x; wPos[vi * 3 + 1] = y; wPos[vi * 3 + 2] = z;
          wCol[vi * 3] = tmpC.r; wCol[vi * 3 + 1] = tmpC.g; wCol[vi * 3 + 2] = tmpC.b;
          wTop[vi] = top; wKind[vi] = kind; wSL[vi * 2] = s % 2280; wSL[vi * 2 + 1] = lat;
        }
      }
    });
    for (const k of ['position', 'aCol', 'aTop', 'aKind', 'aSL']) wg.attributes[k].needsUpdate = true;
  }

  // ---------------------------------------------------------------- paper cutouts: an atlas of shapes, instanced
  // red channel: windows and lamps (they glow); green: the paper's shading; alpha: the cut
  const atlas = canvasTexture(S, 2048, 1024, (g) => {
    const cell = (i, fn) => { g.save(); g.translate((i % 8) * 256 + 128, Math.floor(i / 8) * 256 + 256); fn(); g.restore(); };
    const paper = (v) => `rgb(0,${v},0)`, glow = 'rgb(255,200,0)';
    const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x + (Math.random() - 0.5) * 1.5, y + (Math.random() - 0.5) * 1.5) : g.moveTo(x, y))); g.closePath(); g.fill(); };
    const circ = (x, y, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
    const rect = (x, y, w, h, fill) => { g.fillStyle = fill; g.fillRect(x, y, w, h); };
    cell(0, () => { rect(-6, -26, 12, 26, paper(150)); for (let k = 0; k < 4; k++) { const y = -24 - k * 52, w = 92 - k * 18; poly([[-w, y], [w, y], [0, y - 120 + k * 10]], paper(200 - k * 6)); } }); // pine
    cell(1, () => { rect(-8, -90, 16, 90, paper(150)); for (const [x, y, r] of [[-40, -120, 52], [38, -125, 56], [0, -165, 66], [-20, -200, 40], [28, -195, 42]]) circ(x, y, r, paper(195)); circ(-10, -170, 30, paper(215)); }); // round tree
    cell(2, () => { for (let k = 0; k < 9; k++) circ(-112 + k * 28, -26 - (k % 3) * 6, 30 + (k % 2) * 8, paper(185 + (k % 3) * 10)); rect(-125, -26, 250, 26, paper(185)); }); // hedge
    cell(3, () => { poly([[-90, 0], [-90, -100], [0, -170], [90, -100], [90, 0]], paper(200)); poly([[-100, -98], [0, -176], [100, -98], [90, -92], [0, -160], [-90, -92]], paper(140)); rect(40, -190, 22, 50, paper(160)); for (const [x, y] of [[-62, -80], [30, -80], [-62, -40]]) rect(x, y, 30, 28, glow); rect(10, -48, 26, 48, paper(110)); }); // farmhouse
    cell(4, () => { poly([[-120, 0], [-120, -90], [-80, -150], [80, -150], [120, -90], [120, 0]], paper(185)); poly([[-124, -88], [-82, -154], [82, -154], [124, -88], [116, -84], [78, -142], [-78, -142], [-116, -84]], paper(130)); rect(-40, -80, 80, 80, paper(120)); rect(70, -120, 18, 16, glow); }); // barn
    cell(5, () => { for (const [x0, w, h] of [[-124, 80, 110], [-40, 70, 140], [34, 90, 100]]) { poly([[x0, 0], [x0, -h], [x0 + w / 2, -h - 50], [x0 + w, -h], [x0 + w, 0]], paper(190 + (w % 20))); for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) rect(x0 + 12 + q * (w / 2), -h + 20 + r * 44, 16, 18, glow); } }); // cottages
    cell(6, () => { rect(-110, -100, 140, 100, paper(195)); poly([[-116, -98], [-40, -150], [36, -98]], paper(140)); rect(30, -150, 60, 150, paper(200)); poly([[26, -148], [60, -250], [94, -148]], paper(160)); for (const x of [-90, -55, -20]) { rect(x, -70, 14, 32, glow); circ(x + 7, -70, 7, glow); } circ(60, -110, 10, glow); }); // church
    cell(7, () => { rect(-4, -250, 8, 250, paper(160)); rect(-46, -228, 92, 7, paper(160)); rect(-34, -206, 68, 6, paper(160)); for (const x of [-42, -24, 24, 42]) rect(x - 3, -238, 6, 10, paper(220)); }); // telegraph pole
    cell(8, () => { for (let k = 0; k < 6; k++) rect(-124 + k * 48, -36, 8, 36, paper(170)); rect(-126, -30, 252, 6, paper(185)); rect(-126, -16, 252, 6, paper(185)); }); // fence
    cell(9, () => { g.fillStyle = paper(205); g.beginPath(); g.moveTo(-70, 0); g.quadraticCurveTo(-74, -120, 0, -126); g.quadraticCurveTo(74, -120, 70, 0); g.fill(); for (let k = 0; k < 6; k++) rect(-60 + k * 22, -110 + Math.abs(k - 2.5) * 6, 3, 100, paper(170)); }); // haystack
    cell(10, () => { g.fillStyle = paper(190); g.beginPath(); g.ellipse(0, -62, 62, 30, 0, 0, TAU); g.fill(); for (const x of [-46, -30, 30, 46]) rect(x - 4, -40, 8, 40, paper(170)); poly([[52, -78], [92, -70], [96, -54], [60, -46]], paper(200)); circ(-20, -70, 12, paper(235)); circ(14, -56, 10, paper(235)); rect(-66, -70, 4, 36, paper(170)); }); // cow
    cell(11, () => { for (const [x, y, r] of [[-26, -50, 22], [0, -58, 26], [26, -50, 22], [-12, -40, 20], [14, -40, 20]]) circ(x, y, r, paper(235)); poly([[38, -60], [58, -56], [58, -40], [42, -38]], paper(90)); for (const x of [-22, -6, 10, 24]) rect(x - 3, -24, 6, 24, paper(90)); }); // sheep
    cell(12, () => { poly([[-40, 0], [-26, -150], [26, -150], [40, 0]], paper(195)); poly([[-30, -148], [0, -178], [30, -148]], paper(140)); rect(-8, -50, 16, 26, glow); g.save(); g.translate(0, -160); for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2 + 0.3); g.fillStyle = paper(215); g.fillRect(-6, 0, 12, 90); g.fillStyle = paper(180); g.fillRect(6, 20, 18, 66); } g.restore(); }); // windmill
    cell(13, () => { rect(-5, -40, 10, 40, paper(150)); g.fillStyle = paper(195); g.beginPath(); g.ellipse(0, -140, 34, 112, 0, 0, TAU); g.fill(); g.fillStyle = paper(215); g.beginPath(); g.ellipse(-8, -150, 14, 80, 0, 0, TAU); g.fill(); }); // poplar
    cell(14, () => { rect(-4, -230, 8, 230, paper(160)); rect(-18, -236, 36, 64, paper(150)); circ(0, -218, 10, glow); rect(-30, -150, 60, 6, paper(170)); }); // signal
    cell(15, () => { for (const [x, y, r] of [[-90, -90, 46], [-50, -130, 60], [0, -110, 64], [52, -140, 58], [92, -96, 44], [20, -180, 46], [-30, -190, 40]]) circ(x, y, r, paper(185 + ((x * 7) & 31))); rect(-110, -50, 220, 50, paper(170)); }); // a copse
    cell(16, () => { rect(-120, -120, 240, 120, paper(195)); poly([[-126, -118], [-90, -170], [90, -170], [126, -118]], paper(140)); rect(60, -196, 20, 40, paper(160)); rect(-80, -205, 18, 50, paper(160)); for (const x of [-104, -64, 36, 76]) { rect(x, -100, 26, 40, glow); rect(x, -100, 26, 3, paper(150)); } rect(-20, -78, 36, 78, paper(110)); rect(-14, -72, 24, 30, glow); rect(-128, -62, 256, 8, paper(120)); for (let x = -126; x < 126; x += 12) poly([[x, -54], [x + 12, -54], [x + 6, -44]], paper(120)); }); // the station building
    cell(17, () => { rect(-3, -230, 6, 230, paper(140)); rect(-9, -12, 18, 12, paper(140)); poly([[-16, -232], [16, -232], [12, -200], [-12, -200]], paper(150)); rect(-10, -226, 20, 22, glow); poly([[-18, -232], [0, -246], [18, -232]], paper(140)); rect(-14, -200, 28, 4, paper(140)); }); // a platform lamp
    cell(18, () => { rect(-90, -70, 180, 8, paper(170)); rect(-90, -84, 180, 8, paper(170)); rect(-90, -100, 180, 8, paper(170)); for (let k = 0; k < 4; k++) rect(-90, -48 - k * 10, 180, 6, paper(180)); for (const x of [-80, 72]) rect(x, -48, 8, 48, paper(130)); rect(-90, -50, 180, 6, paper(150)); }); // a bench
    cell(19, () => { g.fillStyle = paper(190); g.beginPath(); g.ellipse(0, -40, 90, 40, 0, 0, TAU); g.fill(); circ(70, -58, 34, paper(200)); poly([[48, -84], [56, -112], [72, -88]], paper(200)); poly([[82, -86], [96, -110], [100, -80]], paper(200)); g.strokeStyle = paper(170); g.lineWidth = 16; g.beginPath(); g.arc(-60, -20, 40, Math.PI * 0.6, Math.PI * 1.6); g.stroke(); }); // a sleeping cat
    cell(20, () => { circ(-40, -205, 18, paper(180)); rect(-58, -228, 36, 10, paper(120)); rect(-60, -186, 40, 100, paper(150)); rect(-58, -86, 14, 86, paper(130)); rect(-36, -86, 14, 86, paper(130)); rect(-22, -150, 50, 10, paper(150)); rect(20, -110, 100, 12, paper(140)); circ(40, -18, 18, paper(110)); circ(100, -18, 18, paper(110)); rect(30, -100, 80, 60, paper(200)); rect(36, -150, 66, 50, paper(180)); rect(30, -40, 90, 10, paper(140)); }); // a porter and his trolley
    cell(21, () => { rect(-80, -120, 160, 120, paper(170)); rect(-90, -210, 180, 92, paper(195)); poly([[-100, -208], [0, -250], [100, -208]], paper(140)); rect(-80, -190, 160, 46, glow); for (let x = -80; x <= 80; x += 32) rect(x - 2, -192, 4, 50, paper(150)); for (let k = 0; k < 6; k++) rect(80 + k * 6, -120 + k * 20, 10, 6, paper(140)); }); // a signal box
    cell(22, () => { rect(-4, -200, 8, 200, paper(170)); rect(-30, -200, 60, 40, paper(140)); circ(-15, -180, 11, glow); poly([[-30, -150], [30, -110], [30, -100], [-30, -140]], paper(220)); poly([[30, -150], [-30, -110], [-30, -100], [30, -140]], paper(220)); }); // a crossing light
    cell(23, () => { for (let k = 0; k < 8; k++) rect(-126 + k * 30, -30, 30, 10, paper(k % 2 ? 110 : 235)); rect(-126, -32, 12, 32, paper(150)); }); // a barrier arm
    cell(24, () => { g.fillStyle = paper(170); g.beginPath(); g.moveTo(-110, -20); g.lineTo(-110, -70); g.quadraticCurveTo(-100, -84, -70, -86); g.lineTo(-56, -130); g.quadraticCurveTo(0, -142, 56, -130); g.lineTo(70, -86); g.quadraticCurveTo(100, -84, 110, -70); g.lineTo(110, -20); g.closePath(); g.fill(); rect(-50, -124, 100, 34, paper(110)); circ(-78, -60, 15, glow); circ(78, -60, 15, glow); rect(-40, -64, 80, 18, paper(130)); rect(-104, -20, 30, 20, paper(90)); rect(74, -20, 30, 20, paper(90)); }); // a car, waiting
    cell(25, () => { for (const [x, h] of [[-50, 90], [-8, 80], [32, 96]]) { rect(x, -h, 34, h, paper(200)); rect(x + 6, -h - 14, 22, 14, paper(170)); rect(x, -h * 0.55, 34, 6, paper(150)); } }); // milk churns
    cell(26, () => { circ(0, -200, 16, paper(180)); rect(-20, -224, 40, 10, paper(110)); rect(-14, -230, 28, 8, paper(110)); poly([[-26, -184], [26, -184], [34, -80], [-34, -80]], paper(140)); rect(-26, -82, 18, 82, paper(120)); rect(8, -82, 18, 82, paper(120)); rect(26, -170, 40, 12, paper(140)); rect(56, -158, 6, 16, paper(160)); rect(50, -142, 18, 22, glow); }); // the guard, with his lantern
  });
  atlas.colorSpace = THREE.NoColorSpace; atlas.premultiplyAlpha = false;
  const IU = { ...PU, uAtlas: { value: atlas } };
  const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
  const NI = NCH * K;
  const aCell = new Float32Array(NI * 2), aCol = new Float32Array(NI * 3), aGlow = new Float32Array(NI * 3), aRnd = new Float32Array(NI);
  quad.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2)); quad.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 3));
  quad.setAttribute('aGlow', new THREE.InstancedBufferAttribute(aGlow, 3)); quad.setAttribute('aRnd', new THREE.InstancedBufferAttribute(aRnd, 1));
  const items = new THREE.InstancedMesh(quad, new THREE.ShaderMaterial({ uniforms: IU, vertexShader: ITEM_V, fragmentShader: ITEM_F, side: THREE.DoubleSide }), NI);
  items.frustumCulled = false; S.add(items);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const COLS = { tree: ['#141f36', '#17243c', '#1a2a40', '#132034'], house: ['#3e3a56', '#46405e', '#36344e'], barn: ['#3a2a36', '#2e2a3e'], pole: ['#0f1420'], animal: ['#2a2c40'], sheep: ['#6a7092'], hay: ['#4a4450'], church: ['#4a4a62'] };
  const WARM = ['#ffc46a', '#ffb050', '#ffd890'];
  function buildItems(c, slot) {
    const r = mulberry((c * 7919) ^ R), s0 = c * CHUNK, list = [];
    const add = (cell, s, lat, size, col, glowCol = '#ffc46a', lit = r(), y = null, keep = false) => list.push({ cell, s, lat, size, col, glowCol, lit, y, keep });
    const e0 = s0 + CHUNK, inC = (s) => s >= s0 && s < e0;
    const tun = features.some((f) => f.kind === 'tunnel' && e0 > f.s0 - 40 && s0 < f.s1 + 40);
    const via = features.some((f) => f.kind === 'viaduct' && e0 > f.s0 - 50 && s0 < f.s1 + 50);
    const st = features.find((f) => f.kind === 'station' && e0 > f.s0 - 210 && s0 < f.s0 + 220);
    const cr = features.find((f) => f.kind === 'crossing' && e0 > f.s0 - 20 && s0 < f.s0 + 20);
    const village = sstep(0.5, 0.7, n1(s0 / 1100, 300)), woods = sstep(0.55, 0.75, n1(s0 / 800, 310));
    if (!via && !st) add(7, s0 + 3, 5.8, 8.5, COLS.pole[0]); // telegraph poles along the line
    if (r() < 0.07) add(14, s0 + 20, -2.6, 6, COLS.pole[0], r() < 0.6 ? '#40ff80' : '#ff4030', 0); // a signal
    for (const side of [1, -1]) {
      const n = side > 0 ? 1 : 0.55;
      if (r() < 0.55 * n) { const l = side * (8 + r() * 3); for (let k = 0; k < 5; k++) add(8, s0 + k * 10 + 5, l, 10, COLS.pole[0]); } // a fence
      for (let k = 0, m = Math.floor((6 + woods * 10) * n * (0.6 + r() * 0.8)); k < m; k++) { const l = side * (10 + r() * (side > 0 ? 42 : 30)); add(r() < 0.35 ? 0 : r() < 0.2 ? 13 : 1, s0 + r() * CHUNK, l, 7 + r() * 7, pick(COLS.tree)); }
      if (r() < 0.7 * n) { const l = side * (12 + r() * 30); for (let k = 0; k < 4; k++) add(2, s0 + r() * CHUNK, l + side * k * 0.5, 8 + r() * 4, pick(COLS.tree)); } // hedgerows
      if (r() < 0.35 * n * (1 - woods)) { const sheep = r() < 0.5, l = side * (14 + r() * 25), sp = s0 + r() * 35; for (let k = 0, m = 2 + Math.floor(r() * 5); k < m; k++) add(sheep ? 11 : 10, sp + r() * 14, l + side * r() * 8, sheep ? 1.5 : 2.6, sheep ? COLS.sheep[0] : COLS.animal[0]); }
      if (r() < 0.14 * n) add(9, s0 + r() * CHUNK, side * (14 + r() * 20), 3.2, COLS.hay[0]);
      if (r() < (0.16 + 0.7 * village) * n) { // a farm, or a village
        const l0 = side * (18 + r() * 22), sp = s0 + r() * 25;
        add(3, sp, l0, 9 + r() * 3, pick(COLS.house), pick(WARM));
        if (village > 0.4) { add(5, sp + 12, l0 + side * 4, 12, pick(COLS.house), pick(WARM)); if (r() < 0.25) add(6, sp + 25, l0 + side * 12, 18, COLS.church[0], '#ffd890'); }
        else if (r() < 0.6) add(4, sp + 10, l0 + side * 3, 12, pick(COLS.barn), pick(WARM), r() * 0.5 + 0.5);
        if (r() < 0.1) add(12, sp + 30, l0 + side * 18, 16, pick(COLS.house), pick(WARM));
        for (let k = 0; k < 2; k++) add(1, sp + r() * 30, l0 + side * (5 + r() * 6), 8 + r() * 5, pick(COLS.tree));
      }
      if (r() < 0.2 * n) add(15, s0 + r() * CHUNK, side * (35 + r() * 15), 16, pick(COLS.tree));
    }
    // not where the hill is (over a tunnel), not on the platform, not in the road
    for (let k = list.length - 1; k >= 0; k--) {
      const it = list[k];
      if (tun || (st && it.s > st.s0 - 210 && it.s < st.s0 + 220 && (it.lat > 0 ? it.lat < 26 : it.lat > -7)) || (cr && Math.abs(it.s - cr.s0) < 9 && Math.abs(it.lat) < 45)) list.splice(k, 1);
    }
    if (st) { // the station: lamps along the platform, benches (a cat asleep on one), the building, a porter, a signal box
      const P = 0.9;
      for (let k = -6; k < 8; k++) { const ls = st.s0 + 3.4 + k * 15; if (inC(ls)) add(17, ls, 7.6, 4.4, '#141820', '#ffd890', 0, P); }
      for (const [ds, cell, lat, size, col, y] of [[-3.2, 18, 7.2, 1.7, '#2c2228', P], [-33, 18, 7.2, 1.7, '#2c2228', P], [27, 18, 7.2, 1.7, '#2c2228', P], [-3.0, 19, 7.15, 0.75, '#4a3e40', P + 0.62], [1, 16, 16, 10, '#2a2638', P], [-28, 16, 16, 10, '#2a2638', P], [6.5, 20, 8.2, 2.3, '#2a2834', P], [-9, 25, 7.8, 1.2, '#5a5a66', P], [125, 21, 10, 9, '#3a3448', null]]) {
        if (inC(st.s0 + ds)) add(cell, st.s0 + ds, lat, size, col, cell === 16 ? '#b07838' : '#ffc878', 0, y);
      }
      for (let k = 0; k < 20; k++) { const fs = st.s0 - 95 + k * 10; if (inC(fs) && Math.abs(fs - st.s0 - 1) > 12) add(8, fs, 11.8, 10, '#151a28', '#fff', 1, P); } // the fence behind the platform
    }
    if (cr && inC(cr.s0)) { // a level crossing: barriers down, lights flashing in turn, a car waiting
      add(23, cr.s0 - 4, 7.8, 8, '#8a3030', '#fff', 1); add(23, cr.s0 + 4, -3.4, 8, '#8a3030', '#fff', 1);
      add(22, cr.s0 - 4.6, 8.1, 3.4, '#1a1c26', '#ff3020', -1); add(22, cr.s0 + 4.6, 8.1, 3.4, '#1a1c26', '#ff3020', -2);
      add(22, cr.s0 - 4.6, -3.7, 3.4, '#1a1c26', '#ff3020', -2); add(22, cr.s0 + 4.6, -3.7, 3.4, '#1a1c26', '#ff3020', -1);
      add(24, cr.s0 + 1.2, 13.5, 3.4, pick(['#5a2a2a', '#2a3a5a', '#3a4a3a']), '#fff2c8', 0);
      add(3, cr.s0 + 16, 19, 8, pick(COLS.house), pick(WARM));
      cr.road = true;
    }
    const p = {};
    for (let k = 0; k < K; k++) {
      const i = slot * K + k, it = list[k];
      if (!it) { items.setMatrixAt(i, zero); continue; }
      if (it.s < s0 - 30 || it.s > e0 + 30) { items.setMatrixAt(i, zero); continue; }
      track(it.s, p);
      const nx = -p.dz, nz = p.dx, side = Math.sign(it.lat);
      v3.set(p.x + nx * it.lat, it.y ?? groundY(it.s), p.z + nz * it.lat);
      const fx = -nx * side, fz = -nz * side; // face the line
      q4.setFromAxisAngle(up, Math.atan2(fx, fz) + (it.cell === 8 ? 0 : (r() - 0.5) * 0.4));
      items.setMatrixAt(i, m4.compose(v3, q4, sc3.set(it.size, it.size, 1)));
      aCell[i * 2] = it.cell % 8; aCell[i * 2 + 1] = 3 - Math.floor(it.cell / 8);
      tmpC.set(it.col); aCol.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
      tmpC.set(it.glowCol); aGlow.set([tmpC.r, tmpC.g, tmpC.b], i * 3); aRnd[i] = it.lit;
    }
    items.instanceMatrix.needsUpdate = true;
    for (const k of ['aCell', 'aCol', 'aGlow', 'aRnd']) quad.attributes[k].needsUpdate = true;
  }
  const built = new Array(NCH).fill(-1);
  function rebuild(s0, s1) { // a new feature: build the chunks it touches again
    for (let c = Math.floor(s0 / CHUNK); c <= Math.floor(s1 / CHUNK); c++) { const slot = ((c % NCH) + NCH) % NCH; if (built[slot] === c) built[slot] = -1; }
  }
  function chunks(max = 99) {
    const cur = Math.floor(dist / CHUNK);
    for (let c = cur - BEHIND; c < cur - BEHIND + NCH && max > 0; c++) {
      const slot = ((c % NCH) + NCH) % NCH;
      if (built[slot] !== c) { buildRibbons(c, slot); buildItems(c, slot); built[slot] = c; max--; }
    }
  }
  chunks();

  // ---------------------------------------------------------------- the train: carriages ahead and behind, and the engine
  const carW = 2.8, carH = 2.75;
  const sideTex = canvasTexture(S, 512, 96, (g, w, h) => {
    g.fillStyle = '#22382c'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8a860'; g.fillRect(0, 22, w, 2); g.fillRect(0, 70, w, 2);
    for (let k = 0; k < 9; k++) { g.fillStyle = '#3a3020'; g.fillRect(12 + k * 55, 28, 40, 34); }
  });
  const glowTex = canvasTexture(S, 512, 96, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) { const blind = Math.random() < 0.3; g.fillStyle = blind ? '#8a5a2a' : '#ffc070'; g.fillRect(14 + k * 55, 30, 36, 30); }
  });
  const carMat = new THREE.MeshLambertMaterial({ map: sideTex, emissiveMap: glowTex, emissive: '#ffffff', emissiveIntensity: 1 });
  carMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLit; varying float vLit;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLit = aLit;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLit;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vLit;');
  };
  const bodyGeo = new THREE.BoxGeometry(CARLEN - 0.9, carH, carW); bodyGeo.translate(0, 0.95 + carH / 2, 0);
  bodyGeo.setAttribute('aLit', new THREE.InstancedBufferAttribute(new Float32Array(NCARS).fill(1), 1));
  const bodies = new THREE.InstancedMesh(bodyGeo, carMat, NCARS); bodies.frustumCulled = false; S.add(bodies);
  const roofGeo = new THREE.CylinderGeometry(carW / 2, carW / 2, CARLEN - 0.9, 16, 1, false, 0, Math.PI); roofGeo.rotateZ(Math.PI / 2); roofGeo.scale(1, 0.28, 1); roofGeo.translate(0, 0.95 + carH, 0);
  const roofs = new THREE.InstancedMesh(roofGeo, S.mat('#2a2e34'), NCARS); roofs.frustumCulled = false; S.add(roofs);
  const bogGeo = new THREE.BoxGeometry(3, 0.7, 2.3); bogGeo.translate(0, 0.45, 0);
  const bogies = new THREE.InstancedMesh(bogGeo, S.mat('#141414'), NCARS * 2); bogies.frustumCulled = false; S.add(bogies);
  // the engine: an old steam locomotive, its firebox glowing in the cab
  const loco = new THREE.Group(); S.add(loco);
  const locoGreen = S.mat('#1e3a2a'), black = S.mat('#141416');
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 7.5, 18), locoGreen); boiler.rotation.z = Math.PI / 2; boiler.position.set(2.2, 2.35, 0); loco.add(boiler);
  const smokebox = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 18), black); smokebox.rotation.z = Math.PI / 2; smokebox.position.set(6.4, 2.35, 0); loco.add(smokebox);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 1.1, 12), black); chimney.position.set(6.3, 3.6, 0); loco.add(chimney);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), S.mat('#b08a3a')); dome.position.set(3, 3.2, 0); loco.add(dome);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 2.7), locoGreen); cab.position.set(-2.6, 2.6, 0); loco.add(cab);
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 2.9), black); cabRoof.position.set(-2.6, 3.95, 0); loco.add(cabRoof);
  const fireM = new THREE.MeshBasicMaterial({ color: '#ff7a2a', toneMapped: false });
  for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.8), fireM); w.position.set(-2.6, 2.9, sz * 1.36); w.rotation.y = sz > 0 ? 0 : Math.PI; loco.add(w); }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.5, 2.4), black); frame.position.set(1.4, 1.2, 0); loco.add(frame);
  for (let k = 0; k < 3; k++) for (const sz of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.15, 18), S.mat('#5a1a1a')); wh.rotation.x = Math.PI / 2; wh.position.set(-0.4 + k * 1.7, 0.8, sz * 1.15); loco.add(wh); }
  const lampM = new THREE.MeshBasicMaterial({ color: '#fff0c0', toneMapped: false }); const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampM); head.position.set(7.05, 1.9, 0); loco.add(head);
  const tender = new THREE.Mesh(softBox(5.2, 2.2, 2.7, 0.08), locoGreen); tender.position.set(-6.8, 2.1, 0); loco.add(tender);
  const coal = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 2.4), black); coal.position.set(-6.8, 3.3, 0); loco.add(coal);
  const LOCOLEN = 18;

  // smoke from the chimney, left hanging in the air as the train runs on
  const NSM = 80, smPos = new Float32Array(NSM * 3), smAge = new Float32Array(NSM).fill(99), smGeo = new THREE.BufferGeometry();
  smGeo.setAttribute('position', new THREE.BufferAttribute(smPos, 3)); smGeo.setAttribute('aAge', new THREE.BufferAttribute(smAge, 1));
  const smoke = new THREE.Points(smGeo, new THREE.ShaderMaterial({ uniforms: { uScale: S.U.uScale, uFog: PU.uFog, uFogD: PU.uFogD }, transparent: true, depthWrite: false,
    vertexShader: `attribute float aAge; uniform float uScale; varying float vA, vD; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_PointSize = uScale * (1.2 + aAge * 0.7) / vD; vA = aAge > 12.0 ? 0.0 : smoothstep(0.0, 0.5, aAge) * (1.0 - aAge / 12.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uFog; uniform float uFogD; varying float vA, vD; void main() { vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; vec3 col = mix(vec3(0.34, 0.37, 0.48), uFog, 1.0 - exp(-vD * uFogD)); gl_FragColor = vec4(col, vA * 0.32 * (1.0 - smoothstep(0.3, 1.0, r))); }` }));
  smoke.frustumCulled = false; S.add(smoke);
  let smI = 0, smT = 0, puff = 0;

  // ---------------------------------------------------------------- our carriage: the compartment
  const car = new THREE.Group(); S.add(car);
  const inner = new THREE.Group(); car.add(inner); // what sways
  const wood = canvasTexture(S, 256, 256, (g, w, h) => {
    g.fillStyle = '#5a3020'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(${30 + Math.random() * 40},${12 + Math.random() * 16},6,${0.25 + Math.random() * 0.3})`; g.fillRect(x, 0, 1 + Math.random() * 2, h); }
    g.strokeStyle = 'rgba(20,8,4,.7)'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.strokeStyle = 'rgba(200,150,90,.25)'; g.lineWidth = 2; g.strokeRect(16, 16, w - 32, h - 32);
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  const woodM = new THREE.MeshLambertMaterial({ map: wood });
  const seatCol = pick([['#7a1e2a', '#c8a050'], ['#1e4a3a', '#d8b060'], ['#2a2a5a', '#c87a3a']]);
  const moquette = canvasTexture(S, 128, 128, (g, w, h) => {
    g.fillStyle = seatCol[0]; g.fillRect(0, 0, w, h);
    g.fillStyle = seatCol[1]; for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.globalAlpha = 0.55; g.beginPath(); g.moveTo(x + 16, y + 4); g.lineTo(x + 28, y + 16); g.lineTo(x + 16, y + 28); g.lineTo(x + 4, y + 16); g.fill(); g.globalAlpha = 1; g.fillStyle = seatCol[0]; g.fillRect(x + 13, y + 13, 6, 6); g.fillStyle = seatCol[1]; }
  });
  moquette.wrapS = moquette.wrapT = THREE.RepeatWrapping; moquette.repeat.set(3, 3);
  const seatM = new THREE.MeshLambertMaterial({ map: moquette });
  const brass = S.mat('#b08a40');
  const X0 = -1.1, X1 = 1.1, Z0 = -0.6, Z1 = 1.42, WY0 = FL + 0.8, WY1 = FL + 1.75, WX = 0.66, CEIL = FL + 2.2;
  const panel = (w, h, d, x, y, z, m = woodM) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); inner.add(b); return b; };
  // the outer wall, round the window
  panel(X1 - X0, WY0 - FL, 0.06, 0, (FL + WY0) / 2, Z1);
  panel(X1 - X0, CEIL - WY1, 0.06, 0, (WY1 + CEIL) / 2, Z1);
  panel(-WX - X0, WY1 - WY0, 0.06, (X0 - WX) / 2, (WY0 + WY1) / 2, Z1);
  panel(X1 - WX, WY1 - WY0, 0.06, (X1 + WX) / 2, (WY0 + WY1) / 2, Z1);
  for (const [w, h, x, y] of [[WX * 2 + 0.1, 0.05, 0, WY0], [WX * 2 + 0.1, 0.05, 0, WY1], [0.05, WY1 - WY0, -WX, (WY0 + WY1) / 2], [0.05, WY1 - WY0, WX, (WY0 + WY1) / 2]]) panel(w, h, 0.09, x, y, Z1 - 0.02, brass);
  // partitions, floor, ceiling
  for (const x of [X0, X1]) { const p = panel(0.06, CEIL - FL, Z1 - Z0, x, (FL + CEIL) / 2, (Z0 + Z1) / 2); p.material = woodM; }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), S.mat('#3a1a1a')); floor.rotation.x = -Math.PI / 2; floor.position.set(0, FL, (Z0 + Z1) / 2); inner.add(floor);
  const ceilG = new THREE.CylinderGeometry(1.6, 1.6, X1 - X0, 24, 1, true, -0.62, 1.24); ceilG.rotateX(-Math.PI / 2); ceilG.rotateY(Math.PI / 2);
  const ceil = new THREE.Mesh(ceilG, new THREE.MeshLambertMaterial({ color: '#e8dcc0', side: THREE.BackSide })); ceil.position.set(0, CEIL - 1.6 + 0.25, (Z0 + Z1) / 2); ceil.rotation.x = 0; inner.add(ceil);
  // the berths, facing each other, with white antimacassars and a luggage rack above
  for (const sx of [-1, 1]) {
    const cush = new THREE.Mesh(softBox(0.55, 0.16, Z1 - Z0 - 0.15, 0.05), seatM); cush.position.set(sx * 0.8, FL + 0.42, (Z0 + Z1) / 2 - 0.05); inner.add(cush);
    const baseB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, Z1 - Z0 - 0.2), woodM); baseB.position.set(sx * 0.82, FL + 0.17, (Z0 + Z1) / 2 - 0.05); inner.add(baseB);
    const back = new THREE.Mesh(softBox(0.14, 0.72, Z1 - Z0 - 0.15, 0.05), seatM); back.position.set(sx * 1.0, FL + 0.86, (Z0 + Z1) / 2 - 0.05); back.rotation.z = -sx * 0.08; inner.add(back);
    for (const z of [0.05, 0.8]) { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.24), S.mat('#bfb8ac', { side: THREE.DoubleSide })); a.position.set(sx * 0.925, FL + 1.1, z); a.rotation.y = -sx * Math.PI / 2; a.rotation.x = 0; inner.add(a); }
    for (const dy of [0, 0.22]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, Z1 - Z0 - 0.1, 8), brass); rod.rotation.x = Math.PI / 2; rod.position.set(sx * (0.98 - dy * 0.9), FL + 1.78, (Z0 + Z1) / 2); inner.add(rod); }
    const net = new THREE.Mesh(new THREE.PlaneGeometry(0.24, Z1 - Z0 - 0.1), new THREE.MeshLambertMaterial({ color: '#4a3a2a', transparent: true, opacity: 0.6, side: THREE.DoubleSide })); net.rotation.x = -Math.PI / 2; net.rotation.y = 0; net.position.set(sx * 0.9, FL + 1.76, (Z0 + Z1) / 2); inner.add(net);
  }
  const caseM = S.mat(pick(['#6a4a2a', '#2a3a5a', '#7a2a2a']));
  const suitcase = new THREE.Mesh(softBox(0.22, 0.4, 0.62, 0.03), caseM); suitcase.position.set(-0.9, FL + 1.98, 0.4); suitcase.rotation.z = Math.PI / 2 - 0.0; inner.add(suitcase);
  const hatbox = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 18), S.mat('#c8b090')); hatbox.position.set(0.88, FL + 1.88, 0.9); inner.add(hatbox);
  // pictures above the seats: travel posters for places on the line
  const PLACES = ['BRAMBLECOMBE', 'NODDING-ON-SEA', 'LULLWATER', 'DOZEMOOR', 'STARHAVEN', 'SNOOZEBURY', 'HUSHFORD BAY'];
  for (const sx of [-1, 1]) {
    const place = pick(PLACES), kind = rand() < 0.5;
    const t = canvasTexture(S, 160, 120, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, kind ? '#f0c890' : '#9ac8e8'); gr.addColorStop(1, kind ? '#e88a5a' : '#f0e0b0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = kind ? '#4a6a8a' : '#3a5a3a'; g.beginPath(); g.moveTo(0, h * 0.75); for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (kind ? 0.72 : 0.55) - Math.sin(x * 0.05) * 14); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      if (kind) { g.fillStyle = '#fff4c0'; g.beginPath(); g.arc(w * 0.7, h * 0.35, 14, 0, TAU); g.fill(); }
      g.fillStyle = '#20202a'; g.fillRect(0, h - 22, w, 22); g.fillStyle = '#f2e6c8'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText(place, w / 2, h - 7);
    });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.375), new THREE.MeshLambertMaterial({ map: t })); pic.position.set(sx * (X1 - 0.035), FL + 1.45, 0.55); pic.rotation.y = -sx * Math.PI / 2; inner.add(pic);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.55), brass); fr.position.set(sx * (X1 - 0.025), FL + 1.45, 0.55); inner.add(fr);
  }
  // the table, a lamp with a pleated shade, a cup and saucer, a book
  const table = new THREE.Mesh(softBox(1.2, 0.04, 0.36, 0.015), woodM); table.position.set(0, FL + 0.72, Z1 - 0.2); inner.add(table);
  const lampG = new THREE.Group(); lampG.position.set(0.5, FL + 0.74, Z1 - 0.22); inner.add(lampG);
  const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.03, 16), brass); lb.position.y = 0.015; lampG.add(lb);
  const ls = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), brass); ls.position.y = 0.17; lampG.add(ls);
  const shadeG = new THREE.CylinderGeometry(0.07, 0.13, 0.15, 32, 1, true);
  { const p = shadeG.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.06 * Math.cos(a * 16); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } shadeG.computeVertexNormals(); }
  const shadeCol = pick(['#f0b080', '#e89a8a', '#f2d8a0']);
  const shadeM = new THREE.MeshLambertMaterial({ color: shadeCol, emissive: shadeCol, emissiveIntensity: 0.9, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(shadeG, shadeM); shade.position.y = 0.34; lampG.add(shade);
  const bulbM = new THREE.MeshBasicMaterial({ color: '#fff2d0', toneMapped: false }); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), bulbM); bulb.position.y = 0.31; lampG.add(bulb);
  const lamp = new THREE.PointLight('#ffc890', 1.1, 6, 2); lamp.position.set(0.5, FL + 1.06, Z1 - 0.27); inner.add(lamp);
  const fill = new THREE.PointLight('#ffd8a8', 0.35, 5, 2); fill.position.set(0, CEIL - 0.15, 0.3); inner.add(fill);
  const cupG = new THREE.Group(); cupG.position.set(-0.3, FL + 0.74, Z1 - 0.24); inner.add(cupG);
  const china = S.mat('#f2eee6');
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.012, 20), china); saucer.position.y = 0.006; cupG.add(saucer);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.03, 0.06, 18, 1, true), new THREE.MeshLambertMaterial({ color: '#f2eee6', side: THREE.DoubleSide })); cup.position.y = 0.044; cupG.add(cup);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), S.mat('#7a4a22')); tea.rotation.x = -Math.PI / 2; tea.position.y = 0.064; cupG.add(tea);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 12, Math.PI), china); handle.rotation.z = -Math.PI / 2; handle.position.set(0.045, 0.046, 0); cupG.add(handle);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.025, 0.21), S.mat(pick(['#2a4a6a', '#6a2a2a', '#2a5a3a']))); book.position.set(-0.05, FL + 0.753, Z1 - 0.17); book.rotation.y = 0.3; inner.add(book);
  // the blind, rolled up, its cord and tassel swinging; curtains at the sides
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, WX * 2 + 0.06, 12), S.mat('#c8b896')); roller.rotation.z = Math.PI / 2; roller.position.set(0, WY1 + 0.02, Z1 - 0.06); inner.add(roller);
  const blindM = new THREE.MeshLambertMaterial({ color: '#d8c8a0', side: THREE.DoubleSide });
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(WX * 2, 1), blindM); blind.position.set(0, WY1, Z1 - 0.06); inner.add(blind);
  let blindDown = 0.06;
  const cordG = new THREE.Group(); inner.add(cordG);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.22, 4), S.mat('#c8a050')); cord.position.y = -0.11; cordG.add(cord);
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 8), S.mat('#c8a050')); tassel.position.y = -0.24; cordG.add(tassel);
  const curtM = new THREE.MeshLambertMaterial({ map: canvasTexture(S, 64, 8, (g, w) => { for (let x = 0; x < w; x++) { g.fillStyle = new THREE.Color(seatCol[0]).multiplyScalar(0.6 + 0.4 * Math.sin((x / w) * TAU * 3)).getStyle(); g.fillRect(x, 0, 1, 8); } }), side: THREE.DoubleSide });
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.22, WY1 - WY0 + 0.25), curtM); c.position.set(sx * (WX + 0.06), (WY0 + WY1) / 2 + 0.05, Z1 - 0.07); inner.add(c); }
  // the glass, with the lamp's reflection in it
  const glareTex = canvasTexture(S, 128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,220,170,.9)'); gr.addColorStop(0.25, 'rgba(255,200,140,.25)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const reflRT = S.keep(new THREE.WebGLRenderTarget(mobile ? 384 : 640, mobile ? 256 : 400, {}));
  const GU = { uRefl: { value: reflRT.texture }, uStrength: { value: 0.1 }, uTexMat: { value: new THREE.Matrix4() } };
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WX * 2, WY1 - WY0), new THREE.ShaderMaterial({ uniforms: GU, vertexShader: GLASS_V, fragmentShader: GLASS_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glass.position.set(0, (WY0 + WY1) / 2, Z1 + 0.012); glass.rotation.y = Math.PI; inner.add(glass);
  const vcam = new THREE.PerspectiveCamera(); vcam.layers.set(1);
  const mN = new THREE.Vector3(), mP = new THREE.Vector3(), cPos = new THREE.Vector3(), cDir = new THREE.Vector3(), cUp = new THREE.Vector3(), tgt = new THREE.Vector3();
  const reflect = (v, isDir) => { const d = isDir ? v.dot(mN) : tgt.subVectors(v, mP).dot(mN); return v.addScaledVector(mN, -2 * d); };
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  let mirroring = false;
  glass.onBeforeRender = (renderer, scene, camera) => {
    if (mirroring || GU.uStrength.value < 0.01 || camera !== S.camera) return;
    mirroring = true;
    glass.updateMatrixWorld();
    mP.setFromMatrixPosition(glass.matrixWorld); mN.set(0, 0, 1).transformDirection(glass.matrixWorld);
    camera.getWorldPosition(cPos); camera.getWorldDirection(cDir); cUp.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(q4));
    reflect(cPos, false); reflect(cDir, true); reflect(cUp, true);
    vcam.position.copy(cPos); vcam.up.copy(cUp); vcam.lookAt(tgt.copy(cPos).add(cDir));
    vcam.projectionMatrix.copy(camera.projectionMatrix); vcam.updateMatrixWorld(); vcam.matrixWorldInverse.copy(vcam.matrixWorld).invert();
    GU.uTexMat.value.copy(bias).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
    const rt = renderer.getRenderTarget(), bg = scene.background;
    glass.visible = false; scene.background = null;
    renderer.setRenderTarget(reflRT); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, vcam);
    renderer.setRenderTarget(rt); scene.background = bg; glass.visible = true;
    mirroring = false;
  };
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: glareTex, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); glare.position.set(0.22, WY0 + 0.2, Z1 + 0.005); glare.rotation.y = Math.PI; inner.add(glare);

  inner.traverse((o) => o.layers.enable(1)); // the compartment is what the glass reflects
  glass.layers.disable(1);

  // ---------------------------------------------------------------- stations, crossings: their own meshes, built when announced
  const featG = new THREE.Group(); S.add(featG);
  const NAMES = [['Little ', 'Upper ', 'Lower ', 'Great ', 'Nether ', '', '', ''], ['Dozing', 'Nodding', 'Yawnley', 'Slumberford', 'Hushwell', 'Lullcombe', 'Dreamsby', 'Pillowden', 'Starling', 'Moonford', 'Owlcombe', 'Featherbed', 'Blanketby', 'Snugglestone'], ['', '', ' Halt', ' Junction', ' Parva', '-on-the-Marsh', '-by-the-Sea', ' Road']];
  const faceTrack = (obj, s, lat, y) => { const pp = track(s, {}); obj.position.set(pp.x - pp.dz * lat, y, pp.z + pp.dx * lat); obj.rotation.set(0, Math.atan2(pp.dz * Math.sign(lat), -pp.dx * Math.sign(lat)) , 0); };
  const clockFaces = [];
  function drawClock(c, now) {
    const g = c.getContext('2d'), w = c.width; g.clearRect(0, 0, w, w);
    g.fillStyle = '#20202a'; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, TAU); g.fill(); g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 8, 0, TAU); g.fill();
    g.fillStyle = '#20202a'; for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.fillRect(w / 2 + Math.sin(a) * (w / 2 - 20) - 3, w / 2 - Math.cos(a) * (w / 2 - 20) - 3, 6, 6); }
    const hand = (a, len, wd) => { g.save(); g.translate(w / 2, w / 2); g.rotate(a); g.fillRect(-wd / 2, -len, wd, len + 8); g.restore(); };
    const m = now.getMinutes(), h = now.getHours() % 12;
    hand(((h + m / 60) / 12) * TAU, w * 0.26, 8); hand((m / 60) * TAU, w * 0.38, 5);
  }
  function stationMeshes(f) {
    const G = new THREE.Group(); featG.add(G); f.group = G;
    // the platform: flagstones on top, a stone face to the track
    const a = f.s0 - 100, b = f.s0 + 106, cols = Math.round((b - a) / 2) + 1, pp = {};
    track(f.s0, pp); const ox = pp.x, oz = pp.z; G.position.set(ox, 0, oz);
    const pos = [], col = [], top = [], kind = [], sl = [], idx = [];
    const pc = new THREE.Color('#4a4a56'), ec = new THREE.Color('#3a3846'), phase = ((f.s0 + 3.4) % 2280 + 2280) % 2280;
    for (let k = 0; k < cols; k++) {
      const s = a + k * 2; track(s, pp); const nx = -pp.dz, nz = pp.dx;
      for (const [lat, y, kd, c] of [[1.7, 0.9, 5, pc], [8.6, 0.9, 5, pc], [1.7, 0.9, 6, ec], [1.7, -0.45, 6, ec]]) {
        pos.push(pp.x + nx * lat - ox, y, pp.z + nz * lat - oz); col.push(c.r, c.g, c.b); top.push(phase); kind.push(kd); sl.push(((s % 2280) + 2280) % 2280, lat);
      }
      if (k < cols - 1) for (const q of [0, 2]) { const i0 = k * 4 + q; idx.push(i0, i0 + 1, i0 + 4, i0 + 1, i0 + 5, i0 + 4); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1)); geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1)); geo.setAttribute('aSL', new THREE.Float32BufferAttribute(sl, 2)); geo.setIndex(idx);
    const plat = new THREE.Mesh(geo, world.material); plat.frustumCulled = false; G.add(plat);
    // the nameboard, on two posts, just along from our window; a clock under the canopy
    const name = (pick(NAMES[0]) + pick(NAMES[1]) + pick(NAMES[2])).toUpperCase();
    f.name = name;
    const nb = canvasTexture(S, 512, 96, (g, w, h) => { g.fillStyle = '#1e2a52'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8e0c8'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#f0e8d0'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 46; g.font = `bold ${fs}px sans-serif`; while (g.measureText(name).width > w - 40 && fs > 18) { fs -= 2; g.font = `bold ${fs}px sans-serif`; } g.fillText(name, w / 2, h / 2 + 2); });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.68), new THREE.MeshBasicMaterial({ map: nb, color: '#8a8a8a' })); G.add(board);
    faceTrack(board, f.s0, 9.5, 2.85); board.position.x -= ox; board.position.z -= oz;
    for (const d of [-1.5, 1.5]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), S.mat('#1a1a22')); G.add(post); faceTrack(post, f.s0 + d, 9.55, 0.9 + 1.2); post.position.x -= ox; post.position.z -= oz; }
    const cc = document.createElement('canvas'); cc.width = cc.height = 128; drawClock(cc, new Date());
    const ct = S.keep(new THREE.CanvasTexture(cc)); ct.colorSpace = THREE.SRGBColorSpace;
    const clockM = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ map: ct, color: '#9a9a9a' })); G.add(clockM);
    faceTrack(clockM, f.s0 + 2.2, 7.7, 3.05); clockM.position.x -= ox; clockM.position.z -= oz;
    clockFaces.push({ c: cc, t: ct, f });
    const glowT = glowTex2;
    for (let k = -6; k < 8; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#ffc878', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })); sp.scale.set(1.6, 1.6, 1); G.add(sp); const p2 = track(f.s0 + 3.4 + k * 15, {}); sp.position.set(p2.x - p2.dz * 7.6 - ox, 0.9 + 4.4 * 0.93, p2.z + p2.dx * 7.6 - oz); }
  }
  function crossingMeshes(f) {
    const G = new THREE.Group(); featG.add(G); f.group = G;
    const pp = track(f.s0, {}); G.position.set(pp.x, -0.66, pp.z); G.rotation.y = Math.atan2(-pp.dz, pp.dx);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 110), S.mat('#24242c')); road.rotation.x = -Math.PI / 2; G.add(road);
    for (let k = -8; k <= 8; k++) { if (Math.abs(k) < 2) continue; const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2.5), S.mat('#8a8a80')); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.01, k * 6); G.add(line); }
    for (const z of [-0.6, 0.6]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex2, color: '#fff0c0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); sp.scale.set(1.2, 1.2, 1); sp.position.set(1.2 + z * 1.3, 0.75, 13.5); G.add(sp); }
  }
  const glowTex2 = canvasTexture(S, 64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  function addFeature(f) {
    if (features.some((g) => g.kind === f.kind && Math.abs(g.s0 - f.s0) < 5)) return;
    features.push(f);
    rebuild(f.s0 - 300, f.s1 + 300);
    if (f.kind === 'station') stationMeshes(f);
    if (f.kind === 'crossing') crossingMeshes(f);
  }
  function dropFeature(f) {
    if (f.group) { f.group.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material !== world.material) { o.material.map?.dispose(); o.material.dispose(); } }); featG.remove(f.group); }
    const ci = clockFaces.findIndex((c) => c.f === f); if (ci >= 0) clockFaces.splice(ci, 1);
  }

  // ---------------------------------------------------------------- other trains: an express on the other line, the other way
  const exTex = canvasTexture(S, 512, 96, (g, w, h) => { g.fillStyle = '#1c2848'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8ccb0'; g.fillRect(0, 24, w, 3); g.fillRect(0, 66, w, 3); for (let k = 0; k < 10; k++) { g.fillStyle = '#2a2a30'; g.fillRect(8 + k * 50, 30, 38, 32); } });
  const exGlow = canvasTexture(S, 512, 96, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let k = 0; k < 10; k++) { g.fillStyle = Math.random() < 0.25 ? '#6a6050' : '#fff0d0'; g.fillRect(10 + k * 50, 32, 34, 28); } });
  const exMat = new THREE.MeshLambertMaterial({ map: exTex, emissiveMap: exGlow, emissive: '#ffe2b8', emissiveIntensity: 0.45 });
  const NEX = 11;
  const exBodies = new THREE.InstancedMesh(bodyGeo.clone().deleteAttribute('aLit'), exMat, NEX); exBodies.frustumCulled = false; S.add(exBodies);
  const exRoofs = new THREE.InstancedMesh(roofGeo, S.mat('#22262c'), NEX); exRoofs.frustumCulled = false; S.add(exRoofs);
  const exHead = new THREE.Group(); S.add(exHead);
  for (const zz of [-0.8, 0.8]) { const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex2, color: '#fff4d8', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); hl.scale.set(1.6, 1.6, 1); hl.position.set(0, 1.5, zz); exHead.add(hl); }
  let express = null; // { s0, speed, cars, metAt }
  function placeExpress(t) {
    const f = express;
    for (let k = 0; k < NEX; k++) { exBodies.setMatrixAt(k, zero); exRoofs.setMatrixAt(k, zero); }
    exHead.visible = false;
    if (f) {
      let sf;
      if (f.metAt == null) { if (dist >= f.s0) f.metAt = t; sf = f.s0 + (f.s0 - dist) * (f.speed / Math.max(4, speed)); }
      if (f.metAt != null) sf = f.s0 - f.speed * (t - f.metAt);
      if (sf < dist - 1500) express = null;
      else if (sf < dist + 1600) {
        for (let k = 0; k < f.cars; k++) {
          const s = sf + 10.25 + k * CARLEN, lat = 4.2 + fAt(s).wid;
          const o = placeOnTrack(s, BOGIE, null, co);
          cq.setFromAxisAngle(up, o.yaw + Math.PI); cp.set(o.x - o.dz * lat, 0, o.z + o.dx * lat);
          cm.compose(cp, cq, one); exBodies.setMatrixAt(k, cm); exRoofs.setMatrixAt(k, cm);
          if (k === 0) { exHead.position.set(cp.x - o.dx * 10, 0, cp.z - o.dz * 10); exHead.rotation.y = o.yaw; exHead.visible = true; }
        }
        f.near = Math.abs(sf + f.cars * CARLEN * 0.5 - dist) < f.cars * CARLEN * 0.5 + 6;
      }
    }
    exBodies.instanceMatrix.needsUpdate = exRoofs.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the guard, walking up the platform with his lantern
  const gq = new THREE.PlaneGeometry(1, 1); gq.translate(0, 0.5, 0);
  { const gc = new THREE.Color('#262833'), gg = new THREE.Color('#ffc060');
    gq.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array([26 % 8, 3 - Math.floor(26 / 8)]), 2)); gq.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array([gc.r, gc.g, gc.b]), 3));
    gq.setAttribute('aGlow', new THREE.InstancedBufferAttribute(new Float32Array([gg.r, gg.g, gg.b]), 3)); gq.setAttribute('aRnd', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1)); }
  const guard = new THREE.InstancedMesh(gq, items.material, 1); guard.frustumCulled = false; guard.setMatrixAt(0, zero); S.add(guard);
  const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex2, color: '#ffb860', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); lanternGlow.scale.set(1.1, 1.1, 1); lanternGlow.visible = false; S.add(lanternGlow);
  let arrived = null, waved = -99;

  // ---------------------------------------------------------------- the camera: sat on the berth by the door, gazing out
  car.add(S.camera);

  // ---------------------------------------------------------------- motion
  let speed = 16, bump = 0, bumpV = 0, clock = 0, clink = 0, rebaseX = 0, shake = 0;
  let lastJoint = Math.floor(dist / RAIL);
  let J = null, jOff = null, lastSpeed = -99, vNow = 16, aNow = 0;
  function handleEv(ev) {
    if (ev.type === 'plan') { if (jOff === null) return; const f = { kind: ev.kind, s0: ev.s0 + jOff, s1: ev.s1 + jOff, no: ev.no, dwell: ev.dwell, speed: ev.speed, cars: ev.cars }; if (f.kind === 'pass') { if (!express) express = f; } else addFeature(f); }
    else if (ev.type === 'arrive') arrived = { t: clock, dwell: ev.dwell, st: features.find((f) => f.kind === 'station' && Math.abs(f.s0 - dist) < 40) };
    else if (ev.type === 'guard') waved = clock;
    else if (ev.type === 'clack') bumpV -= 0.012 * (ev.vel || 1);
    else if (ev.type === 'clink') clink = 1;
    else if (ev.type === 'whistle') puff = 1.5;
    else if (ev.type === 'meet') shake = 1;
  }
  S.onEvent((ev) => {
    if (ev.type === 'speed') { // the music's journey: where we are and how fast we're going
      if (J) { J = null; jOff = null; }
      lastSpeed = clock;
      if (jOff === null) jOff = dist - ev.pos;
      const err = ev.pos + jOff - dist;
      if (Math.abs(err) > 60) dist += err; else dist += err * 0.3;
      vNow = ev.v; aNow = ev.a;
      return;
    }
    handleEv(ev);
  });
  const p = {}, pa = {}, pb = {};
  function placeOnTrack(s, half, obj, o = {}) { // a body set on two bogies: its middle and its heading from the chord between them
    track(s + half, pa); track(s - half, pb);
    o.x = (pa.x + pb.x) / 2; o.z = (pa.z + pb.z) / 2;
    let dx = pa.x - pb.x, dz = pa.z - pb.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; o.dx = dx; o.dz = dz;
    o.yaw = Math.atan2(-dz, dx);
    if (obj) { obj.position.set(o.x, 0, o.z); obj.rotation.set(0, o.yaw, 0); }
    return o;
  }
  const cm = new THREE.Matrix4(), off = new THREE.Matrix4(), cq = new THREE.Quaternion(), cp = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), camW = new THREE.Vector3();
  const lean = { v: 0 }, co = {}, look = new THREE.Vector3();
  let darkness = 0, stationGlow = 0, lampLvlNow = 1, valleyLook = 0;
  function rebase() { // keep the numbers small: move the whole world back to the origin now and then
    const ox = p.x, oz = p.z;
    for (let i = 0; i < tx.length; i++) { tx[i] -= ox; tz[i] -= oz; }
    for (let i = 0; i < wPos.length; i += 3) { wPos[i] -= ox; wPos[i + 2] -= oz; }
    wg.attributes.position.needsUpdate = true;
    const ia = items.instanceMatrix.array; for (let i = 0; i < NI; i++) { if (ia[i * 16] === 0 && ia[i * 16 + 5] === 0) continue; ia[i * 16 + 12] -= ox; ia[i * 16 + 14] -= oz; }
    items.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NSM; i++) { smPos[i * 3] -= ox; smPos[i * 3 + 2] -= oz; }
    for (const g of featG.children) { g.position.x -= ox; g.position.z -= oz; }
    rebaseX++;
  }

  S.on((t, dt, st) => {
    clock = t;
    const e = st.energy;
    // the journey: the music's, or (with no music) our own
    if (!J && t - lastSpeed > 3) { J = createJourney(Math.random); jOff = dist; }
    if (J) { for (const ev of J.step(dt, e, 15 + 7 * e)) handleEv(ev); vNow = J.v; aNow = 0; dist = J.pos + jOff; }
    else { vNow = Math.max(0, vNow + aNow * dt); dist += vNow * dt; }
    speed = vNow;
    extend(dist + (NCH - BEHIND + 2) * CHUNK);
    chunks(2);
    if (J) { const j = Math.floor(dist / RAIL); if (j !== lastJoint) { lastJoint = j; bumpV -= 0.012; } }
    // features well behind us go
    for (let i = features.length - 1; i >= 0; i--) if (features[i].s1 < dist - 700) { dropFeature(features[i]); features.splice(i, 1); }
    if (Math.floor(t / 20) !== Math.floor((t - dt) / 20)) for (const c of clockFaces) { drawClock(c.c, new Date()); c.t.needsUpdate = true; }
    // bumps over the joints, a hum of vibration
    bumpV += (-bump * 260 - bumpV * 18) * dt; bump += bumpV * dt;
    // the carriages: ours at `dist`, three ahead, three behind, the engine in front
    for (let k = 0; k < NCARS; k++) {
      const s = dist + (k - OURS) * CARLEN, o = placeOnTrack(s, BOGIE, null, co);
      carU[k].set(o.x, o.z, o.dx, o.dz);
      cq.setFromAxisAngle(up, o.yaw); cp.set(o.x, 0, o.z);
      cm.compose(cp, cq, one); bodies.setMatrixAt(k, cm); roofs.setMatrixAt(k, cm);
      for (const [j, sb] of [[0, -BOGIE], [1, BOGIE]]) { off.makeTranslation(sb, 0, 0); bogies.setMatrixAt(k * 2 + j, m4.multiplyMatrices(cm, off)); }
    }
    bodies.instanceMatrix.needsUpdate = roofs.instanceMatrix.needsUpdate = bogies.instanceMatrix.needsUpdate = true;
    bodies.visible = true;
    // ours is drawn from inside, so hide its outside but for the panel under the window
    bodies.setMatrixAt(OURS, zero); roofs.setMatrixAt(OURS, zero); bogies.setMatrixAt(OURS * 2, zero); bogies.setMatrixAt(OURS * 2 + 1, zero);
    const lit = 0.35 + 0.65 * sstep(0.25, 0.8, e);
    const litA = bodyGeo.attributes.aLit; for (let k = 0; k < NCARS; k++) { litA.array[k] = k === OURS ? 0 : lit * (0.75 + 0.25 * Math.sin(k * 3.7)); PU.uCarL.value[k] = k === OURS ? 1 : litA.array[k] * 0.8; } litA.needsUpdate = true;
    placeOnTrack(dist + (NCARS - 1 - OURS) * CARLEN + CARLEN / 2 + 9.9, 5, loco);
    // our carriage, leaning into the curves, shaking a little
    const o = placeOnTrack(dist, BOGIE, car, p);
    track(dist, pa); track(dist + 30, pb);
    const k = Math.atan2(pb.dz, pb.dx) - Math.atan2(pa.dz, pa.dx);
    const wrapK = Math.atan2(Math.sin(k), Math.cos(k)) / 30;
    lean.v = lerp(lean.v, Math.max(-0.045, Math.min(0.045, wrapK * speed * speed * 0.09)), 1 - Math.exp(-dt * 1.5));
    car.rotation.set(lean.v, o.yaw, 0, 'YXZ');
    inner.position.y = bump + 0.0012 * Math.sin(t * 47) * Math.sin(t * 3.1) + 0.0008 * Math.sin(t * 13.7);
    inner.rotation.z = 0.003 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
    PU.uBlur.value = (speed * Math.max(dt, 1 / 60)) / 0.65 * 0.6;
    // another train going by: it rocks us, and its windows flicker light into ours
    placeExpress(t);
    shake = Math.max(0, shake - dt * 0.5);
    if (express?.near) { bumpV += (Math.random() - 0.5) * 0.02; inner.rotation.z += Math.sin(t * 9) * 0.004; }
    // in a tunnel the window's a mirror; at a station, lamplight comes in
    const fh = fAt(dist), tunnelIn = fh.lining;
    darkness = lerp(darkness, tunnelIn, 1 - Math.exp(-dt * 6));
    valleyLook = lerp(valleyLook, fh.vf, 1 - Math.exp(-dt * 0.8));
    PU.uFogD.value = 0.0042 * (1 - 0.55 * valleyLook);
    GU.uStrength.value = 0.06 * lampLvlNow + 0.65 * darkness;
    const stNear = features.find((f) => f.kind === 'station' && Math.abs(f.s0 - dist) < 110);
    stationGlow = lerp(stationGlow, stNear ? 1 - Math.abs(stNear.s0 - dist) / 110 : 0, 1 - Math.exp(-dt * 2));
    fill.intensity = 0.35 + 0.5 * stationGlow + (express?.near ? 0.35 * (0.5 + 0.5 * Math.sin(t * 37)) : 0);
    // the guard: up the platform, a wave of the lantern, and he stays as we pull away
    const gst = arrived?.st;
    if (gst && dist - gst.s0 < 260) {
      const k = Math.min(1, (t - arrived.t) / Math.max(10, arrived.dwell * 0.6)), gs = gst.s0 + 60 - 59 * Math.sqrt(k);
      const walking = k < 1, lift = Math.max(0, 1 - Math.abs(t - waved - 1.2) / 1.5);
      const pg = track(gs, {}), nx = -pg.dz, nz = pg.dx, lat = 4.6;
      v3.set(pg.x + nx * lat, 0.9 + (walking ? Math.abs(Math.sin(t * 5)) * 0.04 : 0), pg.z + nz * lat);
      q4.setFromAxisAngle(up, Math.atan2(-nx, -nz));
      guard.setMatrixAt(0, m4.compose(v3, q4, sc3.set(2, 2, 1)));
      lanternGlow.visible = true;
      const lx = 0.4 + Math.sin(t * 5) * 0.03 * (walking ? 1 : 0), ly = 1.0 + lift * 0.7;
      lanternGlow.position.set(v3.x + (-pg.dx) * lx * 0 + pg.dx * -lx, v3.y + ly, v3.z + pg.dz * -lx);
    } else { guard.setMatrixAt(0, zero); lanternGlow.visible = false; if (gst) arrived = null; }
    guard.instanceMatrix.needsUpdate = true;
    // the cup rattles on its saucer
    clink = Math.max(0, clink - dt * 3);
    cupG.position.x = -0.3 + Math.sin(t * 61) * 0.0012 * (clink + Math.min(1, -bumpV * 40));
    cupG.rotation.y = Math.sin(t * 9) * 0.02 * clink;
    // the cord swings with the sway
    cordG.position.set(0.58, WY1 - 0.01 - blindDown, Z1 - 0.07);
    cordG.rotation.z = Math.sin(t * 1.3) * 0.08 + lean.v * 3 + inner.rotation.z * 6;
    cordG.rotation.x = Math.sin(t * 0.9 + 1) * 0.05 - bumpV * 2;
    blind.scale.y = blindDown; blind.position.y = WY1 + 0.01 - blindDown / 2;
    // the lamp: warm, dimming a little later on
    const lampLvl = 0.75 + 0.25 * e; lampLvlNow = lampLvl;
    lamp.intensity = 1.1 * lampLvl; shadeM.emissiveIntensity = 0.45 * lampLvl;
    // houses' windows go out as the night goes on
    IU.uLitFrac.value = 0.15 + 0.7 * sstep(0.2, 0.9, e);
    // smoke from the chimney, puffed harder when it whistles
    loco.updateMatrixWorld();
    smT += dt; puff = Math.max(0, puff - dt);
    while (smT > (puff > 0 ? 0.05 : 0.12)) {
      smT -= puff > 0 ? 0.05 : 0.12;
      v3.set(6.3, 4.2, 0).applyMatrix4(loco.matrixWorld);
      smPos.set([v3.x + (Math.random() - 0.5) * 0.4, v3.y, v3.z + (Math.random() - 0.5) * 0.4], smI * 3); smAge[smI] = 0; smI = (smI + 1) % NSM;
    }
    for (let i = 0; i < NSM; i++) { if (smAge[i] > 12) continue; smAge[i] += dt; smPos[i * 3 + 1] += dt * (0.6 + 0.4 / (1 + smAge[i])); smPos[i * 3] += dt * 0.4; smPos[i * 3 + 2] += dt * 0.25; }
    smGeo.attributes.position.needsUpdate = true; smGeo.attributes.aAge.needsUpdate = true;

    // the camera: on the berth by the door, looking out of the window, eyes wandering along the view
    const cam = S.camera, a = cam.aspect || 1, portrait = a < 0.8;
    const gaze = 0.18 * Math.sin(t * 0.031) + 0.08 * Math.sin(t * 0.083 + 1);
    cam.position.set((portrait ? 0.1 : 0.05) + Math.sin(t * 0.05) * 0.03, FL + 1.13 + bump * 0.6, portrait ? -0.5 : -0.38);
    car.updateMatrixWorld();
    look.set(portrait ? 0.14 + gaze * 0.4 : 0.1 + gaze * 1.5, FL + 1.18 - (portrait ? 0.2 : 0) - 0.25 * valleyLook, Z1 + 1.0); car.localToWorld(look); cam.lookAt(look);
    cam.position.y += inner.position.y * 0.6;
    // the sky goes with us
    cam.getWorldPosition(camW); sky.position.copy(camW);
    // keep the numbers small
    if (Math.hypot(p.x, p.z) > 3000) rebase();
  });

  S.scene.userData.train = { get dist() { return dist; }, get speed() { return speed; }, get rebased() { return rebaseX; }, get lean() { return lean.v; }, get features() { return features.map((f) => ({ kind: f.kind, s0: Math.round(f.s0 - dist), s1: Math.round(f.s1 - dist), name: f.name })); }, get state() { return J ? J.state : 'music'; }, get express() { return express && { s0: Math.round(express.s0 - dist), near: !!express.near }; }, get darkness() { return darkness; }, handleEv, get jOff() { return jOff; } };
  return S.finalize({ portraitFov: 64 });
}
