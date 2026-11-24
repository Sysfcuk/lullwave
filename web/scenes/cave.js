// Crystal Cave: a slow flight down an endless winding tunnel through the rock. Crystal clusters
// grow out of the walls and light the stone around them, their glow hanging in the damp air;
// when the music's bells ring, a cluster ahead on that side flares up. A stream runs along the
// flat floor, mirroring the crystals and rippling where drops fall. Stalactites hang from the
// roof, wet patches and mineral veins glint, dust drifts through the light, and now and then
// the tunnel opens into a wider chamber. A few glowing motes drift ahead as if leading the way.
//
// The tunnel is one fixed mesh: its vertex shader bends it along the path and sizes it with the
// wall function, both evaluated at the camera's position along the path, so it never ends. The
// same path and wall functions run in JS to place crystals and stalactites on the walls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../audio.js';

const TAU = Math.PI * 2;
const PALETTES = [
  ['#8a6bff', '#2de0d0', '#ff4fa3', '#4f8bff', '#ffb03a'],
  ['#2de0d0', '#4f8bff', '#9b6bff', '#8fffe0', '#3dd0ff'],
  ['#ff6b8b', '#ffb03a', '#b05cff', '#ff8a5c', '#ffd27a'],
  ['#9b6bff', '#ff4fa3', '#4f8bff', '#c58bff', '#2de0d0'],
];
const RIPPLES = 6;

// The path (centre line) and the wall radius, written once for GLSL and once for JS. They must
// stay identical. `ph` is the seed's phase offsets. The floor is flattened into a channel for
// the stream: below the centre line the wall is pulled onto a level bed.
const GLSL_PATH = `
  uniform vec4 uPh;
  vec3 pathAt(float s){
    return vec3(9. * sin(s * .021 + uPh.x) + 4. * sin(s * .053 + uPh.y),
                3. * sin(s * .017 + uPh.z) + 1.5 * sin(s * .041),
                -s);
  }
  float chamber(float s){ return smoothstep(.55, 1., sin(s * .019 + uPh.w)); }
  float baseR(float s){ return 4.3 + 2.6 * chamber(s); }
  float wallR(float s, float a){
    float b = baseR(s);
    float r = b + .7 * sin(a * 3. + s * .23) * sin(s * .11 + 1.) + .45 * sin(a * 5. - s * .37 + 2.)
       + .3 * sin(a * 2. + s * .61) + .16 * sin(a * 9. + s * 1.3);
    float down = -sin(a);
    return mix(r, b * .78 / max(down, .3), smoothstep(.55, .9, down));
  }
  void frameAt(float s, out vec3 T, out vec3 R, out vec3 U){
    T = normalize(pathAt(s + .6) - pathAt(s - .6));
    R = normalize(cross(T, vec3(0., 1., 0.)));
    U = cross(R, T);
  }`;

function makePath(ph) {
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pathAt = (s, out = new THREE.Vector3()) => out.set(
    9 * Math.sin(s * 0.021 + ph[0]) + 4 * Math.sin(s * 0.053 + ph[1]),
    3 * Math.sin(s * 0.017 + ph[2]) + 1.5 * Math.sin(s * 0.041),
    -s);
  const chamber = (s) => smooth(0.55, 1, Math.sin(s * 0.019 + ph[3]));
  const baseR = (s) => 4.3 + 2.6 * chamber(s);
  const wallR = (s, a) => {
    const b = baseR(s);
    const r = b + 0.7 * Math.sin(a * 3 + s * 0.23) * Math.sin(s * 0.11 + 1) + 0.45 * Math.sin(a * 5 - s * 0.37 + 2)
      + 0.3 * Math.sin(a * 2 + s * 0.61) + 0.16 * Math.sin(a * 9 + s * 1.3);
    const down = -Math.sin(a), k = smooth(0.55, 0.9, down);
    return r + (b * 0.78 / Math.max(down, 0.3) - r) * k;
  };
  const a0 = new THREE.Vector3(), b0 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  function frameAt(s, T, R, U) {
    T.subVectors(pathAt(s + 0.6, a0), pathAt(s - 0.6, b0)).normalize();
    R.crossVectors(T, Y).normalize();
    U.crossVectors(R, T);
  }
  return { pathAt, wallR, baseR, chamber, frameAt };
}

const NOISE3 = `
  float h31(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
  float fbm3(vec3 p){ return .5 * vn3(p) + .25 * vn3(p * 2.03 + 1.7) + .125 * vn3(p * 4.01 + 3.1) + .0625 * vn3(p * 8.1 + 5.3); }`;

// The rock: bump-mapped from noise, wet patches with a sheen, mineral veins that pick up the
// crystals' colours, specks of glitter; a stream on the floor; and the glow of every crystal
// light hanging in the air between the eye and the surface.
function rockFragment(NL) {
  return `uniform vec3 uCam; uniform vec4 uL[${NL}]; uniform vec3 uLC[${NL}]; uniform vec3 uFog; uniform float uDensity, uTime;
    uniform vec4 uRip[${RIPPLES}];
    varying vec3 vW; varying float vAO, vWater;
    ${NOISE3}
    vec3 bumpN(vec3 pos, vec3 n, float h){
      vec3 dpx = dFdx(pos), dpy = dFdy(pos); float dhx = dFdx(h), dhy = dFdy(h);
      vec3 r1 = cross(dpy, n), r2 = cross(n, dpx); float det = dot(dpx, r1);
      vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
      return normalize(abs(det) * n - grad);
    }
    vec3 haze(vec3 ro, vec3 rd, float len){
      vec3 acc = vec3(0.);
      for (int i = 0; i < ${NL}; i++) {
        vec3 lp = uL[i].xyz - ro; float t = clamp(dot(lp, rd), 0., len);
        vec3 q = lp - rd * t; float d2 = dot(q, q);
        acc += uLC[i] * uL[i].w * (.07 / (1. + d2 * .7) + .16 * exp(-d2 * 1.8));
      }
      return acc;
    }
    void main(){
      vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
      vec3 toCam = uCam - vW; float dc = length(toCam); vec3 V = toCam / dc;
      if (dot(n, V) < 0.) n = -n;
      vec3 P = vW * .9;
      float h = fbm3(P * 1.2);
      float water = vWater;
      float wet = max(smoothstep(.5, .72, vn3(P * .6 + 9.)), water);
      // ripples where drops fall in the stream
      float rip = 0.;
      for (int i = 0; i < ${RIPPLES}; i++) {
        vec4 r = uRip[i]; float age = uTime - r.z;
        if (age > 0. && age < 5.) { float d = length(vW.xz - r.xy); float fr = age * 1.4;
          rip += sin((d - fr) * 9.) * exp(-pow(d - fr, 2.) * 3.) * exp(-age * .8) * r.w; }
      }
      float flow = vn3(vec3(vW.x * 2.5, vW.z * 1.2 + uTime * .5, uTime * .15)) * .12 + vn3(vec3(vW.x * 6., vW.z * 4. + uTime * .9, 3.)) * .04;
      float near = smoothstep(30., 4., dc);
      float hb = mix((h * .9 + vn3(P * 6.) * .12 * near) * (.35 + .65 * near), (flow + rip * .08) * (.4 + .6 * near), water);
      n = bumpN(vW, n, hb);
      vec3 rock = mix(vec3(.045, .05, .07), vec3(.115, .11, .125), smoothstep(.25, .75, h));
      rock *= .8 + .2 * sin(vW.y * 2.3 + h * 7.);
      rock = mix(rock, vec3(.01, .02, .03), water);
      float vein = (1. - smoothstep(0., .012, abs(vn3(P * 1.6 + 4.) - .5))) * smoothstep(.62, .82, vn3(P * .3 + 2.)) * (1. - water);
      vec3 cell = floor(vW * 11.); float g = h31(cell);
      float glit = step(.992, g) * smoothstep(.22, 0., length(fract(vW * 11.) - .5)) * (.3 + .7 * sin(uTime * 2.3 + g * 70.)) * (1. - water);
      vec3 diff = vec3(.14, .16, .26) * (.3 + .7 * max(dot(n, V), 0.)) / (1. + dc * dc * .012);
      vec3 spec = vec3(0.);
      float shin = mix(14., 90., wet), sk = mix(.12, 1.1, wet);
      for (int i = 0; i < ${NL}; i++) {
        vec3 L = uL[i].xyz - vW; float d2 = dot(L, L); vec3 Ld = L * inversesqrt(d2);
        float att = uL[i].w / (1. + d2 * .28);
        diff += uLC[i] * att * (.25 + .75 * max(dot(n, Ld), 0.));
        vec3 H = normalize(Ld + V);
        spec += uLC[i] * att * pow(max(dot(n, H), 0.), shin) * sk * (1. + water * 2.);
      }
      vec3 col = (rock * diff * 2.6 + spec) * vAO + vein * diff * .45 + glit * (diff * 2. + vec3(.03));
      float f = 1. - exp(-uDensity * uDensity * dc * dc);
      col = mix(col, uFog, f) + haze(uCam, -V, dc);
      gl_FragColor = vec4(col, 1.);
    }`;
}

function crystalGeo() {
  const prism = new THREE.CylinderGeometry(0.16, 0.2, 0.75, 6, 1); prism.translate(0, 0.375, 0);
  const tip = new THREE.ConeGeometry(0.16, 0.25, 6, 1); tip.translate(0, 0.875, 0);
  const g = mergeGeometries([prism.toNonIndexed(), tip.toNonIndexed()]);
  g.deleteAttribute('uv');
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = 0.3 + 0.7 * Math.min(1, p.getY(i)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.translate(0, -0.12, 0); // sink the base into the rock
  return g;
}

export function createCaveScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0x5eed);
  const palette = PALETTES[Math.floor(rand() * PALETTES.length)].map((c) => new THREE.Color(c));
  const ph = [rand() * TAU, rand() * TAU, rand() * TAU, rand() * TAU];
  const P = makePath(ph);
  const scene = new THREE.Scene();
  const FOG = new THREE.Color('#020309');
  scene.background = FOG;
  scene.fog = new THREE.FogExp2(FOG, 0.028);
  const camera = new THREE.PerspectiveCamera(66, 1, 0.05, 200);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const T = new THREE.Vector3(), R = new THREE.Vector3(), U = new THREE.Vector3(), C = new THREE.Vector3(), D = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const onWall = (s, a, inset, out) => {
    P.frameAt(s, T, R, U);
    D.copy(R).multiplyScalar(Math.cos(a)).addScaledVector(U, Math.sin(a)); // outward
    return P.pathAt(s, out).addScaledVector(D, P.wallR(s, a) - inset);
  };

  // ------------------------------------------------------------------ the tunnel
  const NL = mobile ? 7 : 10; // crystal lights the rock shader takes
  const DS = 0.8, RINGS = mobile ? 115 : 150, SEGS = mobile ? 26 : 34, BEHIND = 6;
  const rockU = {
    uS: { value: 0 }, uTime: { value: 0 }, uPh: { value: new THREE.Vector4(...ph) }, uCam: { value: new THREE.Vector3() },
    uL: { value: Array.from({ length: NL }, () => new THREE.Vector4()) },
    uLC: { value: Array.from({ length: NL }, () => new THREE.Color()) },
    uRip: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uFog: { value: FOG }, uDensity: { value: scene.fog.density },
  };
  const tGeo = keep(new THREE.BufferGeometry());
  {
    const pos = [], idx = [];
    for (let i = 0; i < RINGS; i++) for (let j = 0; j <= SEGS; j++) pos.push(i * DS, (j / SEGS) * TAU - Math.PI / 2, 0);
    for (let i = 0; i < RINGS - 1; i++) for (let j = 0; j < SEGS; j++) {
      const a = i * (SEGS + 1) + j, b = a + SEGS + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    tGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tGeo.setIndex(idx);
  }
  const tunnel = new THREE.Mesh(tGeo, keep(new THREE.ShaderMaterial({
    uniforms: rockU, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: `${GLSL_PATH}
      uniform float uS; varying vec3 vW; varying float vAO, vWater;
      void main(){
        float s = floor(uS / ${DS.toFixed(2)}) * ${DS.toFixed(2)} - ${BEHIND.toFixed(1)} + position.x;
        float a = position.y;
        vec3 T, R, U; frameAt(s, T, R, U);
        float r = wallR(s, a), dev = r - baseR(s), down = -sin(a);
        vec3 w = pathAt(s) + (cos(a) * R + sin(a) * U) * r;
        vW = w;
        // hollows and the corners where the floor meets the walls sit in shadow
        vAO = clamp(.85 - dev * .35, .35, 1.1) * (1. - .45 * smoothstep(.45, .7, down) * (1. - smoothstep(.75, .9, down)));
        vWater = smoothstep(.86, .93, down);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
      }`,
    fragmentShader: rockFragment(NL),
  })));
  tunnel.frustumCulled = false;
  scene.add(tunnel);

  // the far end of the tunnel: a sphere round the camera carrying the same glow in the air, so
  // the open end of the tunnel mesh never shows as a black hole
  const backdrop = new THREE.Mesh(keep(new THREE.SphereGeometry(140, 24, 12)), keep(new THREE.ShaderMaterial({
    uniforms: rockU, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uCam, uFog; uniform vec4 uL[${NL}]; uniform vec3 uLC[${NL}]; varying vec3 vW;
      void main(){
        vec3 rd = normalize(vW - uCam); vec3 acc = vec3(0.);
        for (int i = 0; i < ${NL}; i++) {
          vec3 lp = uL[i].xyz - uCam; float t = clamp(dot(lp, rd), 0., 140.);
          vec3 q = lp - rd * t; float d2 = dot(q, q);
          acc += uLC[i] * uL[i].w * (.07 / (1. + d2 * .7) + .16 * exp(-d2 * 1.8));
        }
        gl_FragColor = vec4(uFog + acc, 1.);
      }`,
  })));
  backdrop.renderOrder = -1; backdrop.frustumCulled = false;
  scene.add(backdrop);

  // ------------------------------------------------------------------ stalactites
  const SPIKES = mobile ? 28 : 40;
  const spikeGeo = keep((() => {
    const g = new THREE.ConeGeometry(1, 1, 7, 5); g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), wob = 1 + (Math.sin(y * 13 + i) * 0.12 + Math.sin(i * 7.3) * 0.08) * (1 - y);
      p.setXYZ(i, p.getX(i) * wob, y, p.getZ(i) * wob);
    }
    return g;
  })());
  const spikeMat = keep(new THREE.ShaderMaterial({
    uniforms: rockU, extensions: { derivatives: true },
    vertexShader: `varying vec3 vW; varying float vAO, vWater;
      void main(){
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
        vW = w.xyz; vAO = .55 + .5 * position.y; vWater = 0.;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: rockFragment(NL),
  }));
  const spikes = new THREE.InstancedMesh(spikeGeo, spikeMat, SPIKES);
  spikes.frustumCulled = false;
  scene.add(spikes);
  const spikeS = new Float32Array(SPIKES);
  function placeSpike(k, s) {
    // hanging from the roof, pointing down, never long enough to reach the flight path
    const a = Math.PI / 2 + (rand() - 0.5) * 1.5;
    onWall(s, a, -0.3, C);
    const room = P.wallR(s, a) - 2.2;
    const len = Math.max(0.5, Math.min(room, 0.8 + rand() * 2.6 * (P.chamber(s) > 0.5 ? 1.8 : 1)));
    const rad = len * (0.18 + rand() * 0.12);
    q.setFromUnitVectors(Y, v.copy(D).negate());
    spikes.setMatrixAt(k, m4.compose(C, q, sc.set(rad, len + 0.3, rad)));
    spikeS[k] = s;
    spikes.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ crystals on the walls
  const SLOTS = mobile ? 32 : 46, PER = 7, AHEAD = RINGS * DS - BEHIND - 4;
  const cU = { uCam: rockU.uCam, uFog: { value: FOG }, uDensity: { value: scene.fog.density }, uBright: { value: 1 }, uTime: rockU.uTime };
  const cMat = keep(new THREE.ShaderMaterial({
    uniforms: cU, vertexColors: true, extensions: { derivatives: true },
    vertexShader: `varying vec3 vC; varying vec3 vW; varying float vY;
      void main(){
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
        vC = instanceColor; vW = w.xyz; vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform vec3 uCam, uFog; uniform float uDensity, uBright, uTime; varying vec3 vC; varying vec3 vW; varying float vY;
      float h31(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      void main(){
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        vec3 v = uCam - vW; float d = length(v); v /= d;
        float facet = abs(dot(n, v));
        // lit from within: darker at the root, glowing towards the tip; facets catch the light,
        // edges glow (fresnel), a white glint where a face turns square to us, and flecks inside
        float core = smoothstep(-.25, 1., vY);
        vec3 col = vC * uBright * (.25 + 1.05 * core) * (.45 + .85 * facet * facet);
        col += vC * pow(1. - facet, 3.) * (.6 + .8 * core);
        col += vec3(1.) * pow(facet, 60.) * .35 * core;
        float fl = step(.985, h31(floor(vW * 18.))) * smoothstep(.25, 0., length(fract(vW * 18.) - .5)) * (.5 + .5 * sin(uTime * 3. + vW.x * 40. + vW.z * 17.));
        col += mix(vC, vec3(1.), .5) * fl * 1.5 * core;
        // they glow, so they carry further through the haze than the rock does
        float f = 1. - exp(-uDensity * uDensity * d * d * .45);
        gl_FragColor = vec4(mix(col, uFog, f), 1.);
      }`,
  }));
  const crystals = new THREE.InstancedMesh(keep(crystalGeo()), cMat, SLOTS * PER);
  crystals.frustumCulled = false;
  scene.add(crystals);
  const clusters = [];
  const tmpC = new THREE.Color();
  let farthest = 4, spikeFar = 6;

  function place(k, s) {
    const cl = clusters[k] ?? (clusters[k] = { shade: [], pos: new THREE.Vector3(), glow: 0, lit: false });
    // on the walls and roof, not in the stream
    let a = rand() * TAU;
    if (-Math.sin(a) > 0.55) a = (rand() < 0.5 ? -0.35 : Math.PI + 0.35) + (rand() - 0.5) * 0.3;
    if (Math.sin(a) > 0.6 && rand() < 0.4) a = (rand() < 0.5 ? 0.2 : Math.PI - 0.2);
    const big = P.chamber(s) > 0.5 ? 1.6 : Math.min(1, P.wallR(s, a) / 5.2);
    const size = (0.8 + rand() * 1.1) * big;
    cl.s = s; cl.a = a; cl.color = palette[Math.floor(rand() * palette.length)]; cl.glow = 0; cl.lit = true;
    for (let i = 0; i < PER; i++) {
      // each crystal sits on the wall a little apart from its neighbours and points inward
      const da = (rand() - 0.5) * 0.5 / big, dsI = (rand() - 0.5) * 1.6 * big;
      onWall(s + dsI, a + da, 0.05, C);
      q.setFromUnitVectors(Y, v.copy(D).negate());
      q2.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.9, rand() * TAU, (rand() - 0.5) * 0.9));
      q.multiply(q2);
      const h = size * (0.5 + rand() * (i === 0 ? 1.2 : 0.8));
      crystals.setMatrixAt(k * PER + i, m4.compose(C, q, sc.set(h * 0.85, h, h * 0.85)));
      cl.shade[i] = cl.color.clone().multiplyScalar(0.45 + rand() * 0.3);
      if (i === 0) cl.pos.copy(C).addScaledVector(D, -0.9 * size); // the light sits just off the wall
    }
    crystals.instanceMatrix.needsUpdate = true;
  }
  for (let k = 0; k < SLOTS; k++) { place(k, farthest); farthest += AHEAD / SLOTS * (0.6 + rand() * 0.8); }
  for (let k = 0; k < SPIKES; k++) { placeSpike(k, spikeFar); spikeFar += AHEAD / SPIKES * (0.5 + rand()); }

  // ------------------------------------------------------------------ dust lit by the crystals, and guiding motes
  const DUST = mobile ? 320 : 520;
  const dustGeo = keep(new THREE.BufferGeometry());
  const dp = new Float32Array(DUST * 3), dS = new Float32Array(DUST), dSeed = new Float32Array(DUST);
  function spawnDust(k, s) {
    const a = rand() * TAU;
    P.frameAt(s, T, R, U);
    D.copy(R).multiplyScalar(Math.cos(a)).addScaledVector(U, Math.sin(a));
    P.pathAt(s, C).addScaledVector(D, P.wallR(s, a) * Math.sqrt(rand()) * 0.8);
    dp.set([C.x, C.y, C.z], k * 3); dS[k] = s;
  }
  for (let k = 0; k < DUST; k++) { spawnDust(k, rand() * 70); dSeed[k] = rand(); }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1));
  const pointU = { uTime: rockU.uTime, uL: rockU.uL, uLC: rockU.uLC, uScale: { value: 800 } };
  const dust = new THREE.Points(dustGeo, keep(new THREE.ShaderMaterial({
    uniforms: pointU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale; uniform vec4 uL[${NL}]; uniform vec3 uLC[${NL}];
      varying vec3 vCol;
      void main(){
        vec3 p = position + vec3(sin(uTime * .3 + aSeed * 60.), cos(uTime * .23 + aSeed * 40.), sin(uTime * .17 + aSeed * 90.)) * .2;
        vec3 c = vec3(.05, .06, .1);
        for (int i = 0; i < ${NL}; i++) { vec3 d = uL[i].xyz - p; c += uLC[i] * uL[i].w * .9 / (1. + dot(d, d) * .5); }
        vec4 mv = viewMatrix * vec4(p, 1.); float dist = -mv.z;
        gl_PointSize = uScale * .035 * (.5 + aSeed) / dist;
        vCol = c * smoothstep(.4, 2., dist) * exp(-dist * dist * .0007) * (.55 + .45 * sin(uTime * 1.3 + aSeed * 200.));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vCol * exp(-r * 3.) * (1. - r), 1.); }`,
  })));
  dust.frustumCulled = false;
  scene.add(dust);

  const MOTES = 5;
  const mGeo = keep(new THREE.BufferGeometry());
  const mp = new Float32Array(MOTES * 3), mc = new Float32Array(MOTES * 3), ms = new Float32Array(MOTES);
  const motes = [];
  for (let k = 0; k < MOTES; k++) {
    const col = palette[k % palette.length];
    mc.set([col.r, col.g, col.b], k * 3);
    ms[k] = rand();
    motes.push({ ahead: 9 + k * 3.5, a: rand() * TAU, r: 0.3 + rand() * 0.35, ph: rand() * TAU });
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  mGeo.setAttribute('color', new THREE.BufferAttribute(mc, 3));
  mGeo.setAttribute('aSeed', new THREE.BufferAttribute(ms, 1));
  const moteMesh = new THREE.Points(mGeo, keep(new THREE.ShaderMaterial({
    uniforms: pointU, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale; varying vec3 vCol;
      void main(){ vec4 mv = viewMatrix * vec4(position, 1.); float dist = -mv.z;
        float pulse = .75 + .25 * sin(uTime * 1.7 + aSeed * 30.);
        gl_PointSize = uScale * .5 * pulse / dist; vCol = color * pulse * exp(-dist * dist * .0005); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vCol;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vCol * (exp(-r * 18.) * 2. + exp(-r * 4.) * .5) * (1. - r), 1.); }`,
  })));
  moteMesh.frustumCulled = false;
  scene.add(moteMesh);

  // ------------------------------------------------------------------ motion and music
  let s = 0, speed = 4, t = 0, ripN = 0;
  const look = new THREE.Vector3(), camPos = new THREE.Vector3();

  function onEvent(ev, at) {
    if (ev.type === 'bell') {
      // a cluster ahead, on the side the bell sounded from, flares up
      const target = Math.PI / 2 * (1 - ev.pan) + ((ev.midi % 5) - 2) * 0.25;
      let best = null, bestScore = Infinity;
      for (const c of clusters) {
        const ds = c.s - s;
        if (ds < 5 || ds > 40) continue;
        let da = Math.abs(((c.a - target) % TAU + TAU) % TAU); da = Math.min(da, TAU - da);
        const score = da + ds * 0.02 + c.glow * 2;
        if (score < bestScore) { bestScore = score; best = c; }
      }
      if (best) best.glow = Math.min(1.6, best.glow + 1);
    } else if (ev.type === 'drip') {
      // a drop lands in the stream ahead
      const ds = s + 7 + ev.x * 16;
      onWall(ds, -Math.PI / 2 + (ev.pan || 0) * 0.25, 0, C);
      rockU.uRip.value[ripN++ % RIPPLES].set(C.x, C.z, at ?? t, 1);
    } else if (ev.type === 'chord') {
      for (const c of clusters) if (c.s > s && c.s < s + 25) c.glow = Math.min(1.6, c.glow + 0.12);
    }
  }

  const lightPick = [];
  function update(time, dt, st) {
    t = time;
    rockU.uTime.value = t;
    pointU.uScale.value = innerHeight * Math.min(devicePixelRatio || 1, 2) / (2 * Math.tan(camera.fov * Math.PI / 360));
    speed += ((2.2 + 3.6 * st.energy) - speed) * Math.min(1, dt * 0.3);
    s += speed * dt;
    rockU.uS.value = s;

    // the camera rides the path, swaying gently, rolling into the bends
    P.frameAt(s, T, R, U);
    P.pathAt(s, camPos).addScaledVector(R, Math.sin(t * 0.13) * 0.7).addScaledVector(U, Math.sin(t * 0.09) * 0.4 - 0.1);
    camera.position.copy(camPos);
    P.pathAt(s + 11, look).addScaledVector(U, -0.4);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    const bend = P.pathAt(s + 9, v).x - 2 * camPos.x + P.pathAt(s - 9, C).x;
    camera.rotateZ(Math.max(-0.25, Math.min(0.25, -bend * 0.03)));
    rockU.uCam.value.copy(camPos);
    backdrop.position.copy(camPos);

    // recycle what is behind us to the far end
    for (let k = 0; k < clusters.length; k++) {
      if (clusters[k].s < s - BEHIND + 1) { place(k, farthest); farthest += AHEAD / SLOTS * (0.6 + rand() * 0.8); }
    }
    if (farthest < s + AHEAD - 10) farthest = s + AHEAD - 10;
    for (let k = 0; k < SPIKES; k++) {
      if (spikeS[k] < s - BEHIND + 1) { placeSpike(k, spikeFar); spikeFar += AHEAD / SPIKES * (0.5 + rand()); }
    }
    if (spikeFar < s + AHEAD - 10) spikeFar = s + AHEAD - 10;

    // glow fades; crystals brighten with it
    let dirty = false;
    for (let k = 0; k < clusters.length; k++) {
      const c = clusters[k];
      if (!c.lit && c.glow < 0.002) continue;
      c.glow *= Math.exp(-dt * 0.8);
      c.lit = c.glow >= 0.002;
      const boost = 1 + c.glow * 2.8;
      for (let i = 0; i < PER; i++) crystals.setColorAt(k * PER + i, tmpC.copy(c.shade[i]).multiplyScalar(boost));
      dirty = true;
    }
    if (dirty) crystals.instanceColor.needsUpdate = true;
    cU.uBright.value = 0.85 + 0.15 * Math.sin(t * 0.3);

    // the rock is lit by the clusters nearest ahead, the flaring ones first
    lightPick.length = 0;
    for (const c of clusters) { const ds = c.s - s; if (ds > -3 && ds < 45) lightPick.push(c); }
    lightPick.sort((a, b) => (a.s - s) * 0.05 - a.glow * 3 - ((b.s - s) * 0.05 - b.glow * 3));
    for (let i = 0; i < NL; i++) {
      const c = lightPick[i];
      // lights fade in from the far end, so nothing pops when the set of nearest clusters changes
      if (c) { const fade = Math.min(1, (45 - (c.s - s)) / 10); rockU.uL.value[i].set(c.pos.x, c.pos.y, c.pos.z, (0.45 + c.glow * 2.5) * fade); rockU.uLC.value[i].copy(c.color); }
      else rockU.uL.value[i].w = 0;
    }

    // dust behind us is sprinkled again further ahead
    for (let k = 0; k < DUST; k++) if (dS[k] < s - 2) spawnDust(k, s + 6 + rand() * 60);
    dustGeo.attributes.position.needsUpdate = true;
    for (let k = 0; k < MOTES; k++) {
      const m = motes[k], mS = s + m.ahead + Math.sin(t * 0.21 + m.ph) * 2;
      P.frameAt(mS, T, R, U);
      const a = m.a + Math.sin(t * 0.15 + m.ph) * 1.2, r = P.wallR(mS, a) * m.r;
      P.pathAt(mS, C).addScaledVector(R, Math.cos(a) * r).addScaledVector(U, Math.sin(a) * r);
      mp.set([C.x, C.y, C.z], k * 3);
    }
    mGeo.attributes.position.needsUpdate = true;
  }

  return {
    scene, camera, update, onEvent, portraitFov: 78,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.0, bloom: [0.8, 0.55, 0.6], finish: { vignette: 0.45, grain: 0.022, ca: 0.6 } },
    dispose() { for (const d of disposables) d.dispose?.(); crystals.dispose(); spikes.dispose(); },
  };
}
