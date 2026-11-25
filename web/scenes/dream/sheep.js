// Counting Sheep: the old trick, made literal. A flock of cloud-sheep grazes on stars that grow
// in the grass of a little floating island. Beyond its fence, a crescent moon rocks like a cradle
// in the gap, and across it lies a second island made up like a bed: a patchwork quilt and a
// pillow. Every so often (on the music's breath: the run-up on the in-breath, the long float down
// on the out-breath) a sheep trots up and leaps the fence, over the moon, and a number glows and
// fades: 1, 2, 3... It lands on the quilt, finds a place, lies down and sleeps; after a while it
// melts into a cloud and drifts up into the sky, and later a cloud may come down to the grass as a
// sheep again. As the night goes on the jumps get lazier, the clouds stop coming down, and the
// flock ends up asleep: on the quilt and in the sky. The ram, who will not jump, sleeps by the fence.
import { createStage, nightSky, moonlight, motes, canvasTexture, THREE, TAU } from '../kit.js';

// ------------------------------------------------------------------ the lie of the land (world space)
const WC = new THREE.Vector3(-5, 0, 0), WR = 5.0;       // the waking island, where the flock grazes
const SC = new THREE.Vector3(6.2, -0.7, -0.4), SR = 3.3; // the sleeping island: the quilt and the pillow
const FENCE_X = -0.85, FENCE_Z = 1.75;
const TAKEOFF = new THREE.Vector3(-1.95, 0, 0), WAIT = new THREE.Vector3(-4.2, 0, 0.1), LAND = new THREE.Vector3(4.05, 0, 0.1);
const MOON = new THREE.Vector3(1.1, -0.55, -0.9);
const RAMSPOT = new THREE.Vector3(-1.75, 0, 1.25);
const FLIGHT = 2.6;   // seconds in the air, take-off to landing; the apex is halfway
const H = 0.40;       // hip height (and leg length) of a sheep

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

/** The grass of the waking island: a gentle dome that rounds off at its edge. */
const hW = (x, z) => {
  const lx = x - WC.x, lz = z - WC.z, r = Math.hypot(lx, lz);
  return WC.y + 0.55 * (1 - (r / WR) ** 2) + 0.1 * Math.sin(lx * 0.9 + 1) * Math.cos(lz * 1.1) - 0.22 * sstep(WR - 0.6, WR, r);
};
/** The quilt: a low mound, puffed up patch by patch, falling away over the edge of the island. */
const PATCH = 0.6;
const hS = (x, z) => {
  const lx = x - SC.x, lz = z - SC.z, r = Math.hypot(lx, lz);
  const puff = 0.035 * Math.abs(Math.sin(lx * Math.PI / PATCH)) * Math.abs(Math.sin(lz * Math.PI / PATCH));
  return SC.y + 0.22 * (1 - Math.min(1, (r / SR) ** 2)) + puff - 0.9 * sstep(SR - 0.15, SR + 0.3, r) * (1 + 0.25 * Math.sin(Math.atan2(lz, lx) * 9));
};
const onW = (x, z) => Math.hypot(x - WC.x, z - WC.z) < WR;
const onS = (x, z) => Math.hypot(x - SC.x, z - SC.z) < SR;
const ground = (x, z) => (onW(x, z) ? hW(x, z) : onS(x, z) ? hS(x, z) : -50);

// ------------------------------------------------------------------ geometry helpers
/** Merge geometries keeping their smooth normals (and colours, if they all have them). */
function mergeSmooth(parts) {
  parts = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const withCol = parts.every((p) => p.attributes.color);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = withCol ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3);
    if (col) col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** A round surface over a height function, in world space: rings out from the centre. */
function polarSurface(cx, cz, R, rings, segs, h, color) {
  const pos = [], col = [], uv = [], idx = [], c = new THREE.Color();
  const vert = (x, z) => { pos.push(x, h(x, z), z); color(x, z, c); col.push(c.r, c.g, c.b); uv.push((x - cx) / (2 * R) + 0.5, (z - cz) / (2 * R) + 0.5); };
  vert(cx, cz);
  for (let k = 1; k <= rings; k++) for (let s = 0; s < segs; s++) { const a = (s / segs) * TAU, r = (k / rings) * R; vert(cx + Math.cos(a) * r, cz + Math.sin(a) * r); }
  const at = (k, s) => (k === 0 ? 0 : 1 + (k - 1) * segs + (s % segs));
  for (let s = 0; s < segs; s++) idx.push(0, at(1, s + 1), at(1, s));
  for (let k = 1; k < rings; k++) for (let s = 0; s < segs; s++) { const a = at(k, s), b = at(k, s + 1), d = at(k + 1, s), e = at(k + 1, s + 1); idx.push(a, b, d, b, e, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** The underside of a floating island: earth then rock, tapering lumpily to a point, with roots. */
function islandUnder(cx, cy, cz, R, depth, seed) {
  const K = 14, segs = 48, pos = [], col = [], idx = [];
  const top = new THREE.Color('#3a2e26'), mid = new THREE.Color('#2c2734'), low = new THREE.Color('#17141f'), c = new THREE.Color();
  for (let k = 0; k <= K; k++) {
    const f = k / K;
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * TAU;
      const lump = 1 + 0.16 * Math.sin(a * 5 + seed + f * 4) * Math.sin(a * 3 - seed * 2 + f * 7) * f + 0.06 * Math.sin(a * 11 + f * 9 + seed);
      const r = R * (1 - f ** 1.25) * lump;
      pos.push(cx + Math.cos(a) * r, cy - 0.05 - depth * f ** 0.85 - 0.25 * Math.sin(a * 4 + seed) * f, cz + Math.sin(a) * r);
      c.copy(top).lerp(mid, sstep(0, 0.4, f)).lerp(low, sstep(0.4, 1, f)).multiplyScalar(0.85 + 0.3 * (0.5 + 0.5 * Math.sin(a * 13 + f * 21 + seed)));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let k = 0; k < K; k++) for (let s = 0; s < segs; s++) { const a = k * segs + s, b = k * segs + ((s + 1) % segs), d = a + segs, e = b + segs; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** A crescent moon, horns up like a cradle, with a little thickness. */
function crescentGeo(R) {
  const c = 0.5 * R, ri = 0.85 * R;
  const th = Math.asin((R * R + c * c - ri * ri) / (2 * c * R)); // where the two circles cross
  const shape = new THREE.Shape(), N = 64;
  for (let i = 0; i <= N; i++) { const a = th - (i / N) * (Math.PI + 2 * th); const x = Math.cos(a) * R, y = Math.sin(a) * R; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); }
  const yL = Math.sin(th) * R, aL = Math.atan2(yL - c, -Math.cos(th) * R), aR = Math.atan2(yL - c, Math.cos(th) * R);
  const aR2 = aR < aL ? aR + TAU : aR; // round underneath, through the bottom of the inner circle
  for (let i = 1; i < N; i++) { const a = aL + (i / N) * (aR2 - aL); shape.lineTo(Math.cos(a) * ri, c + Math.sin(a) * ri); }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.3 * R, bevelEnabled: true, bevelThickness: 0.12 * R, bevelSize: 0.08 * R, bevelSegments: 4, curveSegments: 64 });
  g.translate(0, 0, -0.15 * R);
  return g;
}

/** A sheep's fleece: a soft core with puffs of wool all over it (a cloud with legs, nearly). */
function fleeceGeo(rand, { wid = 0.34, hi = 0.3, len = 0.5, puffs = 44, r0 = 0.08, r1 = 0.12, seg = 10 } = {}) {
  const parts = [new THREE.SphereGeometry(1, 20, 14).scale(wid * 0.92, hi * 0.92, len * 0.92)];
  const gold = Math.PI * (3 - Math.sqrt(5)), off = rand() * TAU;
  for (const [n, out, k] of [[puffs, 0.9, 1], [Math.round(puffs * 0.45), 0.72, 1.35]]) { // two layers of curls
    for (let i = 0; i < n; i++) {
      const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = i * gold + off * k;
      const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      const rr = (r0 + rand() * (r1 - r0)) * k * (d.y < -0.5 ? 0.8 : 1);
      parts.push(new THREE.SphereGeometry(rr, seg, Math.round(seg * 0.75)).translate(d.x * wid * out, d.y * hi * out, d.z * len * out));
    }
  }
  return mergeSmooth(parts);
}

// ------------------------------------------------------------------ the wool: soft, curly, moonlit
const WOOLV = `varying vec3 vP, vW, vN;
  void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const WOOLF = `uniform vec3 uCam, uKey, uKeyCol, uMoonPos, uMoonCol, uSky, uGround, uTint, uCloudCol; uniform float uCloud, uSeed, uMoonPow; varying vec3 vP, vW, vN;
  float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
  void main(){
    vec3 q = vP * 46. + uSeed;
    float c1 = n3(q), c2 = n3(q * 2.1 + 7.);
    float e = .2; vec3 gr = vec3(n3(q + vec3(e, 0., 0.)) - c1, n3(q + vec3(0., e, 0.)) - c1, n3(q + vec3(0., 0., e)) - c1) / e;
    vec3 n = normalize(normalize(vN) - gr * .22 * (1. - uCloud * .85));   // the curls catch the light
    vec3 V = normalize(uCam - vW);
    float curl = c1 * .6 + c2 * .4;
    vec3 base = mix(uTint * (.8 + .3 * curl), uCloudCol * (.9 + .15 * curl), uCloud);
    float wrap = max((dot(n, uKey) + .5) / 1.5, 0.);                    // light wraps round through wool
    vec3 Lm = uMoonPos - vW; float dm = length(Lm); Lm /= max(dm, .001);
    float moon = max((dot(n, Lm) + .3) / 1.3, 0.) * uMoonPow / (1. + dm * dm * .06);
    vec3 hemi = mix(uGround, uSky, n.y * .5 + .5);
    float occ = .6 + .4 * curl;                                           // the hollows between curls
    vec3 col = base * (hemi * .6 * occ + uKeyCol * wrap * .6 + uMoonCol * moon * .85);
    float rim = pow(1. - max(dot(n, V), 0.), 2.5);
    col += (uKeyCol * .3 + uMoonCol * moon * .25) * rim * occ + base * .035;
    col += uCloudCol * rim * uCloud * .3;                                 // a cloud's silver lining
    gl_FragColor = vec4(clamp(col, 0., 4.), 1.);
  }`;

export function createSheepScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x5ee9, bg: '#0b0a26', fog: { color: '#1c1a40', near: 30, far: 140 }, exposure: 1.0, bloom: [0.75, 0.55, 0.6], finish: { vignette: 0.4, grain: 0.02, ca: 0.6 }, fov: 50 });
  const { rand } = S;
  const sky = nightSky(S, { top: '#06051a', horizon: '#221d4c', moon: [0, -1, 0], moonSize: 0.0001, halo: '#000000', stars: 1.6, clouds: 0.22, cloudColor: '#34306a', tint: '#2c1640' });
  const su = sky.userData.u;
  moonlight(S, { dir: [-0.4, 0.8, 0.5], color: '#b8c2ff', intensity: 0.75, sky: '#6a6ab8', ground: '#1a1830', fill: 0.75 });

  // ---------------------------------------------------------------- the crescent moon, rocking in the gap
  const moonU = { uTime: S.U.uTime, uGlow: { value: 1 } };
  const moon = new THREE.Mesh(crescentGeo(1.7), new THREE.ShaderMaterial({
    uniforms: moonU,
    vertexShader: 'varying vec3 vP, vN; void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uGlow; varying vec3 vP, vN;
      float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float m = n2(vP.xy * 3.) * .6 + n2(vP.xy * 7. + 3.) * .4;                    // soft grey seas
        float crater = smoothstep(.62, .78, n2(vP.xy * 5. + 11.)) * .5;
        vec3 col = mix(vec3(1., .95, .8), vec3(.86, .8, .66), m * .7 + crater * .5);
        col *= .8 + .2 * max(normalize(vN).z, 0.);
        gl_FragColor = vec4(col * (.6 + .16 * uGlow), 1.);
      }`,
  }));
  moon.position.copy(MOON); S.add(moon);
  const haloTex = canvasTexture(S, 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,226,170,.22)'); gr.addColorStop(0.35, 'rgba(255,200,150,.07)'); gr.addColorStop(1, 'rgba(255,180,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.copy(MOON).add(new THREE.Vector3(0, -0.4, -0.3)); halo.scale.setScalar(7); S.add(halo);
  const moonLamp = new THREE.PointLight('#ffe2a8', 9, 16, 1.4); moonLamp.position.copy(MOON).add(new THREE.Vector3(0, 0.5, 0.8)); S.add(moonLamp);

  // ---------------------------------------------------------------- the waking island: grass, stars growing in it, the fence
  const grassCol = (x, z, c) => { const k = 0.5 + 0.5 * Math.sin(x * 1.7 + Math.cos(z * 1.3) * 2) * Math.sin(z * 1.1 - x * 0.4); c.set('#3a6a3c').lerp(new THREE.Color('#5d8a4a'), k * 0.8); };
  S.add(new THREE.Mesh(polarSurface(WC.x, WC.z, WR, 26, 72, hW, grassCol), S.vmat));
  S.add(new THREE.Mesh(islandUnder(WC.x, hW(WC.x + WR, WC.z), WC.z, WR, 4.2, 1.3), S.vmat));
  { // grass tufts: three blades each, darker at the root
    const pos = [], col = [], nor = [], lo = new THREE.Color('#34583a'), hi = new THREE.Color('#9cc47a');
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI + 0.3, w = 0.022, h = 0.13 + b * 0.04, lean = 0.04 * (b - 1);
      const ca = Math.cos(a), sa = Math.sin(a);
      pos.push(-ca * w, 0, -sa * w, ca * w, 0, sa * w, lean * sa, h, -lean * ca);
      col.push(lo.r, lo.g, lo.b, lo.r, lo.g, lo.b, hi.r, hi.g, hi.b); nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const n = mobile ? 700 : 1300, tufts = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU, r = Math.sqrt(rand()) * (WR - 0.15); p.set(WC.x + Math.cos(a) * r, 0, WC.z + Math.sin(a) * r); p.y = hW(p.x, p.z) - 0.01;
      q.setFromAxisAngle(up, rand() * TAU); s.set(0.8 + rand() * 0.6, 0.45 + rand() * 0.5, 0.8 + rand() * 0.6); tufts.setMatrixAt(i, m.compose(p, q, s));
    }
    S.add(tufts);
  }
  // star-flowers: little stars that grow in the grass. The sheep eat them; they grow back
  const STARS = mobile ? 30 : 40, starPos = new Float32Array(STARS * 3), starGlow = new Float32Array(STARS), starSeed = new Float32Array(STARS);
  const stars = [];
  for (let i = 0; i < STARS; i++) {
    let x, z; do { const a = rand() * TAU, r = Math.sqrt(rand()) * (WR - 0.9); x = WC.x + Math.cos(a) * r; z = WC.z + Math.sin(a) * r; } while (x > FENCE_X - 0.6 || Math.hypot(x - WAIT.x, z - WAIT.z) < 0.9);
    starPos.set([x, hW(x, z) + 0.07, z], i * 3); starGlow[i] = 1; starSeed[i] = rand();
    stars.push({ x, z, glow: 1, eaten: false, back: 0, by: null });
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); starGeo.setAttribute('aGlow', new THREE.BufferAttribute(starGlow, 1)); starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 1));
  const starU = { uTime: S.U.uTime, uScale: S.U.uScale, uPulse: { value: 0 } };
  S.add(new THREE.Points(starGeo, new THREE.ShaderMaterial({
    uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aGlow, aSeed; uniform float uTime, uScale, uPulse; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); float tw = .75 + .25 * sin(uTime * (.8 + aSeed) + aSeed * 40.);
        vA = aGlow * tw * (1. + uPulse * .5); gl_PointSize = uScale * .22 * (.4 + .6 * aGlow) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; vec2 a = abs(c);
        float star = exp(-a.x * 30.) * exp(-a.y * 5.) + exp(-a.y * 30.) * exp(-a.x * 5.) + exp(-dot(c, c) * 60.) * 1.4;
        gl_FragColor = vec4(vec3(1., .9, .6) * star * vA, 1.); }`,
  })));

  // the fence: four wonky posts and two rails
  {
    const wood = S.mat('#7a6048'), dark = S.mat('#5a4434');
    const posts = [-FENCE_Z, -0.58, 0.58, FENCE_Z].map((z, i) => { const x = FENCE_X + (i % 2 ? 0.04 : -0.03); return new THREE.Vector3(x, hW(x, z), z); });
    posts.forEach((p, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), i % 2 ? dark : wood); m.position.set(p.x, p.y + 0.42, p.z); m.rotation.set((i - 1.5) * 0.03, i * 0.4, (i % 2 ? 1 : -1) * 0.035); S.add(m); });
    for (let i = 0; i < 3; i++) for (const hgt of [0.38, 0.76]) {
      const a = posts[i], b = posts[i + 1], len = a.distanceTo(b) + 0.16;
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, len), wood);
      r.position.set((a.x + b.x) / 2 + 0.06, (a.y + b.y) / 2 + hgt + (i - 1) * 0.02, (a.z + b.z) / 2); r.rotation.set(Math.atan2(a.y - b.y, len) * 0.5, Math.atan2(b.x - a.x, b.z - a.z), (i % 2 ? 0.03 : -0.02)); S.add(r);
    }
  }

  // ---------------------------------------------------------------- the sleeping island: a quilt and a pillow
  const quiltTex = canvasTexture(S, 512, 512, (g, w) => {
    const cols = ['#7a4a6a', '#3e6a78', '#b08a3a', '#9a4e52', '#d8ccb0', '#4e5a8a', '#6a7a4a', '#c07a5a'];
    const n = Math.round((2 * (SR + 0.3)) / PATCH), cell = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const k = (i * 7 + j * 3 + ((i * j) % 5)) % cols.length; g.fillStyle = cols[k]; g.fillRect(i * cell, j * cell, cell, cell);
      g.fillStyle = 'rgba(255,255,255,.12)'; // a small pattern in each patch
      if ((i + j) % 3 === 0) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { g.beginPath(); g.arc(i * cell + (a + 0.5) * cell / 4, j * cell + (b + 0.5) * cell / 4, cell * 0.04, 0, TAU); g.fill(); }
      else if ((i + j) % 3 === 1) for (let a = 1; a < 4; a++) g.fillRect(i * cell + (a * cell) / 4 - 1, j * cell, 2.5, cell);
    }
    g.strokeStyle = 'rgba(245,230,200,.55)'; g.lineWidth = 2; g.setLineDash([5, 5]); // the stitching
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, w); g.stroke(); g.beginPath(); g.moveTo(0, i * cell); g.lineTo(w, i * cell); g.stroke(); }
  });
  {
    const QR = SR + 0.3, g = polarSurface(SC.x, SC.z, QR, 30, 96, hS, (x, z, c) => c.set('#ffffff'));
    // the texture lines up with the puffed patches: one patch per PATCH metres
    const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - SC.x) / (2 * QR) + 0.5, (p.getZ(i) - SC.z) / (2 * QR) + 0.5);
    S.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: quiltTex, emissive: '#ffffff', emissiveMap: quiltTex, emissiveIntensity: 0.07, side: THREE.DoubleSide })));
    S.add(new THREE.Mesh(islandUnder(SC.x, SC.y - 0.35, SC.z, SR * 0.97, 3.3, 4.1), S.vmat));
  }
  const PILLOW = new THREE.Vector3(SC.x + 2.05, 0, SC.z);
  {
    const tick = canvasTexture(S, 256, 64, (g, w, h) => { g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a8cb8'; for (let x = 0; x < w; x += 22) g.fillRect(x, 0, 6, h); g.fillStyle = '#b8c4dc'; for (let x = 11; x < w; x += 22) g.fillRect(x, 0, 2, h); });
    const pg = new THREE.SphereGeometry(1, 40, 20); const pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const sq = 1 - 0.35 * z * z; pp.setXYZ(i, x * 0.55 * sq, y * 0.26 * (1 - 0.5 * z * z), z * 1.45); }
    pg.computeVertexNormals();
    const pillow = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ map: tick, emissive: '#ffffff', emissiveMap: tick, emissiveIntensity: 0.06 }));
    pillow.position.set(PILLOW.x, hS(PILLOW.x, PILLOW.z) + 0.16, PILLOW.z); pillow.rotation.set(0, 0.08, -0.12); S.add(pillow);
  }

  // ---------------------------------------------------------------- far below: a sea of cloud
  const seaU = { uTime: S.U.uTime, uLit: { value: 1 } };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: seaU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime, uLit; varying vec3 vW;
      float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      float fb(vec2 p){ return .5 * n2(p) + .25 * n2(p * 2.1 + 1.7) + .125 * n2(p * 4.3 + 3.1) + .0625 * n2(p * 8.7); }
      void main(){
        vec2 p = vW.xz * .055 + vec2(uTime * .006, uTime * .003);
        float d = fb(p), d2 = fb(p * 1.7 - 4.);
        float dens = .3 + .7 * smoothstep(.28, .66, d * .7 + d2 * .3);
        vec3 col = mix(vec3(.09, .08, .22), vec3(.42, .4, .7), dens) * (.75 + .2 * uLit);
        col += vec3(1., .85, .6) * .12 * exp(-length(vW.xz - vec2(1., -1.)) * .03) * dens;   // the moon's glow on the cloud tops
        float r = length(vW.xz);
        gl_FragColor = vec4(col, dens * (1. - smoothstep(160., 430., r)) * .95);
      }`,
  }));
  sea.position.y = -11; sea.renderOrder = -0.5; S.add(sea);
  motes(S, { kind: 'dust', count: mobile ? 90 : 150, box: [24, 10, 14], center: [0.5, 2.5, -1], color: '#ffeccc', size: 0.045, speed: 0.4 });

  // ---------------------------------------------------------------- the sheep
  const woolU = {
    uCam: { value: new THREE.Vector3() }, uKey: { value: new THREE.Vector3(-0.4, 0.8, 0.5).normalize() }, uKeyCol: { value: new THREE.Color('#aab4f0') },
    uMoonPos: { value: moonLamp.position.clone() }, uMoonCol: { value: new THREE.Color('#ffd9a0') }, uMoonPow: { value: 1.6 },
    uSky: { value: new THREE.Color('#7070c0') }, uGround: { value: new THREE.Color('#2a2a44') }, uCloudCol: { value: new THREE.Color('#c4c0ee') },
  };
  const woolMat = (tint, s) => S.keep(new THREE.ShaderMaterial({ uniforms: { ...woolU, uTint: { value: new THREE.Color(tint) }, uCloud: { value: 0 }, uSeed: { value: s } }, vertexShader: WOOLV, fragmentShader: WOOLF }));
  const fleeces = [fleeceGeo(rand), fleeceGeo(rand, { wid: 0.36, hi: 0.31, len: 0.52 }), fleeceGeo(rand, { wid: 0.32, hi: 0.29, len: 0.48, puffs: 20 })].map((g) => S.keep(g));
  const capGeo = S.keep(fleeceGeo(rand, { wid: 0.1, hi: 0.06, len: 0.09, puffs: 10, r0: 0.035, r1: 0.05, seg: 8 }));
  const tailGeo = S.keep(fleeceGeo(rand, { wid: 0.06, hi: 0.07, len: 0.05, puffs: 8, r0: 0.03, r1: 0.045, seg: 8 }));
  const neckGeo = S.keep(fleeceGeo(rand, { wid: 0.16, hi: 0.16, len: 0.13, puffs: 16, r0: 0.05, r1: 0.07, seg: 8 }));
  const legGeo = S.keep(new THREE.CylinderGeometry(0.03, 0.025, H, 8).translate(0, -H / 2, 0));
  const hoofGeo = S.keep(new THREE.CylinderGeometry(0.03, 0.034, 0.05, 8).translate(0, -H + 0.025, 0));
  const headGeo = S.keep(new THREE.SphereGeometry(1, 18, 12).scale(0.115, 0.125, 0.18).translate(0, 0, 0.17));
  const muzzleGeo = S.keep(new THREE.SphereGeometry(1, 14, 10).scale(0.085, 0.08, 0.09).translate(0, -0.04, 0.31));
  const earGeo = S.keep(new THREE.SphereGeometry(1, 12, 8).scale(0.075, 0.018, 0.034).translate(0.06, 0, 0));
  const eyeGeo = S.keep(new THREE.SphereGeometry(0.021, 10, 8));
  const pupilGeo = S.keep(new THREE.BoxGeometry(0.026, 0.007, 0.01));
  const faceMat = S.mat('#6a5a5e', { emissive: '#2a2026' }), earMat = S.mat('#7a6064', { emissive: '#2a1c20' }), hoofMat = S.mat('#1a1618'), eyeMat = S.mat('#e8dfc6', { emissive: '#2a261c' }), pupilMat = S.mat('#120e0e');
  const hornGeo = (() => { // a ram's horn: a curl back and round, tapering
    const pts = []; for (let i = 0; i <= 24; i++) { const s = i / 24, a = s * 1.7 * Math.PI, r = 0.11 * (1 - 0.5 * s); pts.push(new THREE.Vector3(0.04 * s, 0.05 + Math.cos(a) * r - 0.02 * s, -0.02 - Math.sin(a) * r)); }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.034, 10, false);
    const p = g.attributes.position; const cen = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { const seg = Math.floor(i / 11) / 40; const pt = new THREE.CatmullRomCurve3(pts).getPointAt(Math.min(1, seg), cen); const k = 1 - 0.6 * seg; p.setXYZ(i, pt.x + (p.getX(i) - pt.x) * k, pt.y + (p.getY(i) - pt.y) * k, pt.z + (p.getZ(i) - pt.z) * k); }
    g.computeVertexNormals(); return S.keep(g);
  })();
  const hornMat = S.mat('#b9a888', { emissive: '#1a160e' });
  const shadowTex = canvasTexture(S, 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(8,6,20,.65)'); gr.addColorStop(0.6, 'rgba(8,6,20,.3)'); gr.addColorStop(1, 'rgba(8,6,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const shadowGeo = S.keep(new THREE.PlaneGeometry(0.9, 1.25).rotateX(-Math.PI / 2));
  const zTex = canvasTexture(S, 64, 64, (g) => { g.fillStyle = '#fff2d8'; g.font = 'italic bold 50px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 32, 34); });

  function makeSheep(i, ram = false) {
    const g = new THREE.Group(); g.rotation.order = 'YXZ'; S.add(g);
    const mat = woolMat(ram ? '#d4ccbc' : ['#f4efe4', '#f7f1e6', '#efe8dc'][i % 3], i * 13.7);
    const torso = new THREE.Group(); torso.position.y = H + 0.1; g.add(torso);
    const fleece = new THREE.Mesh(fleeces[i % fleeces.length], mat); torso.add(fleece);
    const tail = new THREE.Mesh(tailGeo, mat); tail.position.set(0, 0.06, -0.5); torso.add(tail);
    const neck = new THREE.Mesh(neckGeo, mat); neck.position.set(0, 0.08, 0.4); torso.add(neck);
    const head = new THREE.Group(); head.position.set(0, H + 0.14, 0.44); head.rotation.order = 'YXZ'; g.add(head);
    head.add(new THREE.Mesh(headGeo, faceMat), new THREE.Mesh(muzzleGeo, faceMat));
    const cap = new THREE.Mesh(capGeo, mat); cap.position.set(0, 0.085, 0.07); head.add(cap);
    const ears = [-1, 1].map((sx) => { const e = new THREE.Mesh(earGeo, earMat); e.position.set(sx * 0.09, 0.05, 0.08); e.scale.x = sx; e.rotation.set(0, sx * -0.3, sx * -0.35); head.add(e); return e; });
    const eyes = [-1, 1].map((sx) => {
      const eg = new THREE.Group(); eg.position.set(sx * 0.082, 0.035, 0.22); eg.rotation.y = sx * 0.55; head.add(eg);
      eg.add(new THREE.Mesh(eyeGeo, eyeMat)); const pu = new THREE.Mesh(pupilGeo, pupilMat); pu.position.z = 0.018; eg.add(pu);
      return eg;
    });
    if (ram) {
      for (const sx of [-1, 1]) { const h = new THREE.Mesh(hornGeo, hornMat); h.position.set(sx * 0.07, 0.04, 0.08); h.scale.x = sx; head.add(h); }
      for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), pupilMat); b.position.set(sx * 0.08, 0.07, 0.24); b.rotation.set(0, sx * 0.5, sx * -0.4); head.add(b); }
    }
    const legs = [[-0.13, 0.26, 0], [0.13, 0.26, 1], [-0.13, -0.27, 1], [0.13, -0.27, 0]].map(([x, z, pair]) => {
      const pv = new THREE.Group(); pv.position.set(x, H, z); g.add(pv);
      pv.add(new THREE.Mesh(legGeo, faceMat), new THREE.Mesh(hoofGeo, hoofMat));
      return { pv, x, z, pair, front: z > 0 };
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.renderOrder = 1; S.add(shadow);
    const zz = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, opacity: 0 })); zz.scale.setScalar(0.22); S.add(zz);
    const scale = ram ? 1.2 : 0.92 + rand() * 0.14;
    g.scale.setScalar(scale);
    return {
      i, ram, g, mat, torso, fleece, head, ears, eyes, legs, shadow, zz, scale,
      pos: new THREE.Vector3(), air: new THREE.Vector3(), yaw: 0, speed: 0, phase: rand() * TAU,
      state: 'graze', task: null, target: null, until: 0, t0: 0,
      headPitch: 0, headYaw: 0, hp: -0.2, hy: 0, lie: 0, lieT: 0, eyesOpen: 1, eyesT: 1, cloud: 0, puff: 1,
      bed: -1, sleepUntil: 0, ring: { a: rand() * TAU, r: 4.5 + rand() * 2.5, alt: 5.6 + rand() * 2, w: (rand() < 0.5 ? -1 : 1) * (0.018 + rand() * 0.012), ph: rand() * TAU },
      zph: rand(), blink: rand() * 4, chew: 0, look: null, shake: 0,
    };
  }

  const N = mobile ? 10 : 12;
  const flock = Array.from({ length: N }, (_, i) => makeSheep(i));
  const ram = makeSheep(N, true);
  const all = [...flock, ram];

  // beds on the quilt: a row with their heads on the pillow, then rows in front
  const BEDS = [[1.15, -0.95], [1.15, 0.05], [1.15, 1.05], [-0.15, -1.25], [-0.15, -0.1], [-0.2, 1.1], [-1.35, -1.25], [-1.25, 1.45]]
    .map(([x, z]) => ({ x: SC.x + x, z: SC.z + z, by: null }));

  // where they start: most of them grazing, two asleep on the quilt, one up in the sky
  const randomOnW = (pad = 0.9) => { for (;;) { const a = rand() * TAU, r = Math.sqrt(rand()) * (WR - pad); const x = WC.x + Math.cos(a) * r, z = WC.z + Math.sin(a) * r; if (x < FENCE_X - 0.6 && all.every((o) => o.state === 'cloud' || Math.hypot(o.pos.x - x, o.pos.z - z) > 1 || o.pos.lengthSq() === 0)) return new THREE.Vector3(x, 0, z); } };
  flock.forEach((sh, k) => {
    if (k < 2) { const b = BEDS[k]; b.by = sh; sh.bed = k; sh.pos.set(b.x, 0, b.z); sh.yaw = Math.PI / 2; sh.state = 'sleep'; sh.lie = sh.lieT = 1; sh.eyesOpen = sh.eyesT = 0; sh.sleepUntil = 40 + k * 50; }
    else if (k === 2) { sh.state = 'cloud'; sh.cloud = 1; sh.until = 30; }
    else { sh.pos.copy(randomOnW()); sh.yaw = rand() * TAU; sh.until = rand() * 4; }
  });
  ram.pos.set(-3.0, 0, 2.2); ram.yaw = 1.2;

  // ---------------------------------------------------------------- counting: the numbers that glow over the moon
  let count = 0;
  const nums = [0, 1].map(() => {
    const tex = canvasTexture(S, 256, 128, () => {});
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false })); sp.scale.set(2.4, 1.2, 1); S.add(sp);
    return { tex, sp, t0: -99, at: new THREE.Vector3() };
  });
  let numK = 0;
  function showCount(at) {
    count++;
    const n = nums[numK = 1 - numK], g = n.tex.image.getContext('2d');
    g.clearRect(0, 0, 256, 128); g.font = 'italic 84px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,210,140,.9)'; g.shadowBlur = 18; g.fillStyle = '#fff3d6'; g.fillText(String(count), 128, 68);
    n.tex.needsUpdate = true; n.t0 = clockT; n.at.copy(at);
  }

  // ---------------------------------------------------------------- the flock's brains
  let clockT = 0, energy = 1, next = null, breath = 0, breathT = 0;
  const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  const awake = () => flock.filter((s) => ['graze', 'next', 'run', 'flight'].includes(s.state));
  const freeStar = (sh) => {
    let best = null, bd = 1e9;
    for (const st of stars) { if (st.eaten || st.by) continue; const d = Math.hypot(st.x - sh.pos.x, st.z - sh.pos.z) + rand() * 2.5; if (d < bd) { bd = d; best = st; } }
    return best;
  };
  const freeBed = () => { const free = BEDS.filter((b) => !b.by); if (free.length) return free[Math.floor(rand() * Math.min(2, free.length))]; return null; };

  /** Walk towards a point, making room for the others; returns the distance left. */
  function steer(sh, tx, tz, maxSpeed, dt, { crowd = true } = {}) {
    let dx = tx - sh.pos.x, dz = tz - sh.pos.z; const dist = Math.hypot(dx, dz);
    if (dist < 0.02) { sh.speed = 0; return dist; }
    dx /= dist; dz /= dist;
    if (crowd) for (const o of all) {
      if (o === sh || ['cloud', 'rise', 'descend', 'flight'].includes(o.state)) continue;
      const ox = sh.pos.x - o.pos.x, oz = sh.pos.z - o.pos.z, d = Math.hypot(ox, oz), room = o.state === 'run' ? 1.4 : 1.0;
      if (d < room && d > 0.001) { const push = (room - d) / room * 1.6; dx += (ox / d) * push; dz += (oz / d) * push; }
    }
    const want = Math.atan2(dx, dz), turn = angDiff(sh.yaw, want);
    sh.yaw += clamp(turn, -2.2 * dt, 2.2 * dt);
    const go = Math.max(0, Math.cos(turn)) * Math.min(maxSpeed, dist * 0.9 + 0.08);
    sh.speed = lerp(sh.speed, go, 1 - Math.exp(-dt * 3));
    sh.pos.x += Math.sin(sh.yaw) * sh.speed * dt; sh.pos.z += Math.cos(sh.yaw) * sh.speed * dt;
    return dist;
  }
  /** Keep a sheep on its island (and the grazers on their side of the fence). */
  function keepOn(sh) {
    const isW = sh.pos.x < 1;
    const c = isW ? WC : SC, R = isW ? WR - 0.75 : SR - 0.65;
    const dx = sh.pos.x - c.x, dz = sh.pos.z - c.z, d = Math.hypot(dx, dz);
    if (d > R) { sh.pos.x = c.x + (dx / d) * R; sh.pos.z = c.z + (dz / d) * R; }
    if (isW && sh.state !== 'run' && sh.pos.x > FENCE_X - 0.5) sh.pos.x = FENCE_X - 0.5;
  }

  function graze(sh, t, dt) {
    if (!sh.task || (t > sh.until && sh.task !== 'walk')) {
      const r = rand(), sleepy = 1 - energy;
      sh.target?.by === sh && (sh.target.by = null);
      if (sh.ram && energy < 0.42) { sh.task = 'bedtime'; sh.target = RAMSPOT; }
      else if (sh.ram && r < 0.45) { sh.task = 'fence'; sh.target = RAMSPOT; }
      else if (!sh.ram && energy < 0.36 && r < 0.5) { sh.task = 'rest'; sh.until = t + 1e9; }
      else if (r < 0.55) { const st = freeStar(sh); if (st) { st.by = sh; sh.task = 'walk'; sh.target = st; sh.goal = 'eat'; } else sh.task = 'look'; }
      else if (r < 0.8) { sh.task = 'walk'; sh.target = randomOnW(); sh.goal = 'look'; }
      else if (r < 0.8 + 0.15 * sleepy) { sh.task = 'rest'; sh.until = t + 20 + rand() * 30; }
      else sh.task = 'look';
      if (sh.task === 'look') sh.until = t + 2 + rand() * 4;
      if (sh.task === 'walk') sh.until = t + 25;
      if (sh.task === 'fence' || sh.task === 'bedtime') sh.until = t + 1e9;
    }
    sh.lieT = sh.task === 'rest' || sh.task === 'asleep' ? 1 : 0;
    sh.eyesT = sh.task === 'asleep' || (sh.task === 'rest' && energy < 0.5) ? 0 : 1;
    if (sh.lie > 0.05 && !sh.lieT) { sh.speed = 0; return; } // stand up first
    if (sh.task === 'walk') {
      const st = sh.target, tx = st.x - (sh.goal === 'eat' ? Math.sin(sh.yaw) * 0.62 : 0), tz = st.z - (sh.goal === 'eat' ? Math.cos(sh.yaw) * 0.62 : 0);
      const left = steer(sh, tx, tz, 0.42, dt);
      sh.hp = -0.15;
      if (left < 0.12 || t > sh.until) { // there (or given up: someone is in the way)
        if (left >= 0.12 && sh.goal === 'eat') { sh.target.by = null; sh.target = null; sh.goal = 'look'; }
        sh.task = sh.goal; sh.until = t + (sh.goal === 'eat' ? 5 + rand() * 5 : 2 + rand() * 4); sh.t0 = t;
      }
    } else if (sh.task === 'eat') {
      sh.speed = lerp(sh.speed, 0, 1 - Math.exp(-dt * 4)); sh.hp = 1.25; sh.chew += dt;
      const st = sh.target; if (st && !st.eaten && t - sh.t0 > 2.5) { st.eaten = true; st.back = t + 70 + rand() * 90; st.by = null; }
    } else if (sh.task === 'look') { sh.speed = lerp(sh.speed, 0, 1 - Math.exp(-dt * 4)); sh.hp = -0.3; }
    else if (sh.task === 'rest') { sh.speed = 0; sh.hp = 0.35; }
    else if (sh.task === 'fence' || sh.task === 'bedtime') { // the ram goes to stand by the fence, and will not be moved
      const left = steer(sh, RAMSPOT.x, RAMSPOT.z, 0.38, dt);
      if (left < 0.1) {
        sh.yaw += angDiff(sh.yaw, Math.PI / 2) * (1 - Math.exp(-dt * 2));
        if (sh.task === 'bedtime') { sh.task = 'asleep'; }
        else if (!sh.until || sh.until > 1e8) sh.until = t + 25 + rand() * 30;
      }
      sh.hp = -0.1;
    } else if (sh.task === 'asleep') { sh.speed = 0; sh.hp = 0.5; sh.lieT = 1; sh.eyesT = 0; }
  }

  function startRun(sh, t, apexIn) {
    const T = apexIn - FLIGHT / 2;
    if (T < 1.6) return false;
    sh.state = 'run'; sh.t0 = t; sh.until = t + T; sh.from = sh.pos.clone(); sh.task = null; sh.lieT = 0; sh.eyesT = 1;
    return true;
  }

  function update(sh, t, dt) {
    switch (sh.state) {
      case 'graze': graze(sh, t, dt); break;
      case 'next': { // waiting by the run-up for the music's breath
        if (energy < 0.36) { sh.state = 'graze'; sh.task = 'rest'; sh.until = t + 1e9; if (next === sh) next = null; break; }
        sh.lieT = 0; sh.eyesT = 1;
        const left = steer(sh, WAIT.x, WAIT.z, 0.45, dt);
        if (left < 0.1) { sh.yaw += angDiff(sh.yaw, Math.PI / 2) * (1 - Math.exp(-dt * 2)); sh.hp = -0.35 + 0.1 * Math.sin(t * 0.7 + sh.i); }
        else sh.hp = -0.15;
        break;
      }
      case 'run': { // the in-breath: an easy walk that gathers into a trot
        const u = clamp((t - sh.t0) / (sh.until - sh.t0), 0, 1), k = u ** 1.7;
        const px = sh.pos.x, pz = sh.pos.z;
        sh.pos.x = lerp(sh.from.x, TAKEOFF.x, k); sh.pos.z = lerp(sh.from.z, TAKEOFF.z, k);
        const moved = Math.hypot(sh.pos.x - px, sh.pos.z - pz); sh.speed = moved / Math.max(dt, 1e-3);
        sh.yaw += angDiff(sh.yaw, Math.atan2(TAKEOFF.x - sh.from.x, TAKEOFF.z - sh.from.z)) * (1 - Math.exp(-dt * 4));
        sh.hp = -0.25;
        if (u >= 1) {
          sh.state = 'flight'; sh.t0 = sh.until; sh.until = sh.t0 + FLIGHT;
          sh.land = LAND.clone(); sh.land.z += (rand() - 0.5) * 0.4;
          sh.y0 = groundY(sh); sh.y1 = hS(sh.land.x, sh.land.z); sh.from = sh.pos.clone();
          sh.hop = 1.6 + 0.9 * energy; sh.apexAt = sh.t0 + FLIGHT / 2; sh.counted = false;
          breathT = 0;
        }
        break;
      }
      case 'flight': { // the out-breath: up and over the moon, and a long float down
        const k = clamp((t - sh.t0) / FLIGHT, 0, 1);
        sh.pos.x = lerp(sh.from.x, sh.land.x, k); sh.pos.z = lerp(sh.from.z, sh.land.z, k);
        sh.air.set(sh.pos.x, lerp(sh.y0, sh.y1, k) + 4 * sh.hop * k * (1 - k), sh.pos.z);
        sh.vy = (sh.y1 - sh.y0 + 4 * sh.hop * (1 - 2 * k)) / FLIGHT; sh.vx = (sh.land.x - sh.from.x) / FLIGHT;
        sh.yaw += angDiff(sh.yaw, Math.PI / 2) * (1 - Math.exp(-dt * 3));
        sh.hp = -0.35;
        if (!sh.counted && t >= sh.apexAt) { sh.counted = true; showCount(v3.set(sh.air.x, sh.air.y + 0.9, sh.air.z + 0.3)); }
        if (k >= 1) { sh.state = 'land'; sh.t0 = t; sh.pos.copy(sh.land); }
        break;
      }
      case 'land': {
        sh.speed = 0; sh.hp = -0.1;
        if (t - sh.t0 > 0.8) {
          let b = freeBed();
          if (!b) { // the quilt is full: the longest asleep drifts off as a cloud to make room
            const old = flock.filter((o) => o.state === 'sleep').sort((a, c) => a.sleepUntil - c.sleepUntil)[0];
            if (old) { toCloud(old, t); b = freeBed(); }
          }
          if (b) { b.by = sh; sh.bed = BEDS.indexOf(b); sh.state = 'toBed'; } else { sh.state = 'sleep'; sh.sleepUntil = t + 60; }
        }
        break;
      }
      case 'toBed': {
        const b = BEDS[sh.bed];
        const left = steer(sh, b.x, b.z, 0.32, dt);
        sh.hp = -0.1;
        if (left < 0.1) {
          sh.yaw += angDiff(sh.yaw, Math.PI / 2) * (1 - Math.exp(-dt * 2.5));
          if (Math.abs(angDiff(sh.yaw, Math.PI / 2)) < 0.15) { sh.state = 'sleep'; sh.sleepUntil = t + (30 + rand() * 35) * (1 + 2.5 * (1 - energy)); }
        }
        break;
      }
      case 'sleep': {
        sh.speed = 0; sh.lieT = 1; sh.eyesT = 0; sh.hp = 0.45; sh.hy = 0.25 * (sh.i % 2 ? 1 : -1);
        if (sh.bed >= 0 && sh.bed < 3) { sh.hp = 0.15; sh.hy = 0; } // heads on the pillow
        if (t > sh.sleepUntil && energy > 0.42) toCloud(sh, t);
        break;
      }
      case 'rise': case 'descend': {
        const k = clamp((t - sh.t0) / (sh.until - sh.t0), 0, 1), e = k * k * (3 - 2 * k);
        const up = sh.state === 'rise';
        const c = up ? e : 1 - e;
        sh.cloud = c;
        ringPos(sh, t, v4);
        if (up) sh.air.set(lerp(sh.from.x, v4.x, e), lerp(sh.from.y, v4.y, e * e), lerp(sh.from.z, v4.z, e));
        else sh.air.set(lerp(sh.from.x, sh.land.x, e), lerp(sh.from.y, ground(sh.land.x, sh.land.z), Math.sqrt(e)), lerp(sh.from.z, sh.land.z, e));
        sh.pos.set(sh.air.x, 0, sh.air.z);
        sh.lieT = up ? 1 : 0; sh.eyesT = 0;
        if (k >= 1) {
          if (up) { sh.state = 'cloud'; sh.until = t + 12 + rand() * 20; }
          else { sh.state = 'graze'; sh.task = 'look'; sh.until = t + 3; sh.cloud = 0; sh.pos.copy(sh.land); sh.eyesT = 1; }
        }
        break;
      }
      case 'cloud': {
        ringPos(sh, t, sh.air); sh.pos.set(sh.air.x, 0, sh.air.z);
        // come back down as a sheep, while the night is young enough and the meadow wants one
        const want = Math.round(N * clamp((energy - 0.45) / 0.45, 0, 1) * 0.75);
        if (t > sh.until && energy > 0.45 && awake().length < want) {
          sh.state = 'descend'; sh.t0 = t; sh.until = t + 13; sh.from = sh.air.clone(); sh.land = randomOnW(1.2); sh.lie = sh.lieT = 0;
        }
        break;
      }
    }
    if (['graze', 'next', 'toBed', 'land', 'sleep', 'run'].includes(sh.state)) keepOn(sh);
  }
  function toCloud(sh, t) {
    if (sh.bed >= 0) { BEDS[sh.bed].by = null; sh.bed = -1; }
    sh.from = v3.set(sh.pos.x, groundY(sh), sh.pos.z).clone();
    sh.state = 'rise'; sh.t0 = t; sh.until = t + 13;
  }
  function ringPos(sh, t, out) {
    const r = sh.ring; return out.set(0.5 + Math.cos(r.a) * r.r * 1.3, r.alt + Math.sin(t * 0.25 + r.ph) * 0.25, -2.2 + Math.sin(r.a) * r.r * 0.55);
  }
  /** The ground under a sheep's four feet (the sheep's own origin is at its feet). */
  function groundY(sh) {
    const c = Math.cos(sh.yaw), s = Math.sin(sh.yaw), sc = sh.scale; let sum = 0;
    for (const L of sh.legs) { const x = sh.pos.x + (L.x * c + L.z * s) * sc, z = sh.pos.z + (-L.x * s + L.z * c) * sc; sum += ground(x, z); }
    return sum / 4;
  }

  // ---------------------------------------------------------------- posing every frame
  const wp = new THREE.Vector3();
  function pose(sh, t, dt) {
    const sc = sh.scale, ease = 1 - Math.exp(-dt * 2.5);
    sh.lie = lerp(sh.lie, sh.lieT, 1 - Math.exp(-dt * 1.2));
    sh.eyesOpen = lerp(sh.eyesOpen, sh.eyesT, 1 - Math.exp(-dt * 1.5));
    sh.headPitch = lerp(sh.headPitch, sh.hp, ease); sh.headYaw = lerp(sh.headYaw, sh.hy, ease);
    if (!['sleep'].includes(sh.state)) sh.hy = lerp(sh.hy, 0, ease);
    const airborne = ['flight', 'rise', 'descend', 'cloud'].includes(sh.state);
    const g = sh.g;
    // the stride: diagonal pairs together, a full cycle every 0.8 m
    sh.phase += (sh.speed * dt / 0.4) * Math.PI;
    const amp = clamp(sh.speed / 0.4, 0, 1) * (sh.state === 'run' ? 0.6 : 0.42);
    let pitch = 0;
    if (!airborne) {
      const c = Math.cos(sh.yaw), s = Math.sin(sh.yaw);
      const gF = (ground(sh.pos.x + 0.27 * sc * s, sh.pos.z + 0.27 * sc * c)), gB = ground(sh.pos.x - 0.27 * sc * s, sh.pos.z - 0.27 * sc * c);
      pitch = Math.atan2(gB - gF, 0.54 * sc) * (1 - sh.lie);
      const bob = Math.abs(Math.sin(sh.phase)) * 0.018 * amp;
      g.position.set(sh.pos.x, groundY(sh) - sh.lie * 0.22 * sc + bob, sh.pos.z);
    } else g.position.copy(sh.air);
    if (sh.state === 'flight') pitch = clamp(-Math.atan2(sh.vy, sh.vx) * 0.55, -0.6, 0.6);
    g.rotation.set(pitch, sh.yaw, 0);
    // wool: breathes; squashes and stretches through the jump; puffs right up into a cloud
    const br = 1 + Math.sin(t * (sh.state === 'sleep' ? 0.9 : 1.6) + sh.i) * (sh.state === 'sleep' ? 0.025 : 0.012);
    let sx = 1, sy = 1, sz = 1;
    if (sh.state === 'flight') { const k = (t - sh.t0) / FLIGHT; sz = 1 + 0.1 * Math.sin(Math.PI * k); sy = 1 - 0.05 * Math.sin(Math.PI * k); }
    if (sh.state === 'land') { const k = clamp((t - sh.t0) / 0.8, 0, 1); sy = 1 - 0.14 * Math.sin(Math.PI * k) * (1 - k); sx = 1 + 0.07 * Math.sin(Math.PI * k) * (1 - k); }
    const cl = sh.cloud, puff = 1 + 1.5 * cl;
    sh.torso.scale.set(sx * br * puff * (1 + 0.5 * cl), sy * br * puff * (1 - 0.15 * cl), sz * br * puff * (1 + 0.25 * cl));
    sh.torso.position.y = H + 0.1 - sh.lie * 0.04;
    sh.mat.uniforms.uCloud.value = cl;
    sh.torso.rotation.y = cl * 0.6 * Math.sin(t * 0.05 + sh.i);
    // head: tucked into the wool as it turns to cloud
    const hk = 1 - sstep(0.1, 0.6, cl);
    sh.head.visible = hk > 0.01; sh.head.scale.setScalar(Math.max(0.001, hk));
    const chew = sh.task === 'eat' && sh.state === 'graze' ? Math.sin(sh.chew * 9) * 0.05 : 0;
    let hp = sh.headPitch + chew, hy = sh.headYaw;
    if (sh.look && sh.state === 'graze') { // watching something (the ram watches the jumpers)
      v3.copy(sh.look).sub(sh.head.getWorldPosition(wp)); hy = clamp(angDiff(sh.yaw, Math.atan2(v3.x, v3.z)), -1.1, 1.1); hp = clamp(-Math.atan2(v3.y, Math.hypot(v3.x, v3.z)), -0.7, 0.6);
      sh.headYaw = hy; sh.headPitch = hp;
    }
    hy += Math.sin(sh.shake * 18) * 0.35 * Math.min(1, sh.shake); sh.shake = Math.max(0, sh.shake - dt);
    sh.head.rotation.set(hp, hy, 0);
    sh.head.position.set(0, H + 0.14 - sh.lie * 0.2, 0.44 - sh.lie * 0.02);
    sh.ears.forEach((e, k) => { e.rotation.z = (k ? -1 : 1) * (0.35 + 0.15 * Math.sin(t * 0.7 + sh.i * 3 + k) * (1 - sh.lie)); });
    sh.blink -= dt; const blink = sh.blink < 0.12 ? 0.1 : 1; if (sh.blink < 0) sh.blink = 2.5 + rand() * 5;
    sh.eyes.forEach((e) => { e.scale.y = Math.max(0.08, sh.eyesOpen * blink); });
    // legs: the trot, the jump, folded under when lying down, tucked away in a cloud
    const legK = 1 - sstep(0, 0.35, cl);
    for (const L of sh.legs) {
      const ph = sh.phase + (L.pair ? Math.PI : 0);
      let a = Math.sin(ph) * amp, lift = Math.max(0, Math.cos(ph)) * 0.16 * amp;
      if (sh.state === 'flight') { const k = (t - sh.t0) / FLIGHT, tuck = Math.sin(Math.PI * clamp(k * 1.25, 0, 1)); a = (L.front ? -1.05 : 0.95) * tuck; lift = 0.2 * tuck; }
      a = lerp(a, L.front ? -1.35 : 1.35, sh.lie);
      L.pv.rotation.set(a, 0, 0);
      L.pv.updateMatrixWorld();
      let k = 1 - lift - 0.55 * sh.lie;
      if (!airborne && sh.lie < 0.5) { // reach exactly to the ground under each hoof
        L.pv.getWorldPosition(wp);
        const reach = (wp.y - ground(wp.x, wp.z)) / (H * sc * Math.max(0.3, Math.cos(a + pitch)));
        k = clamp(reach, 0.7, 1.25) - lift;
      }
      L.pv.scale.set(1, Math.max(0.001, k * legK), 1);
      L.pv.visible = legK > 0.01;
    }
    // a soft shadow on the ground beneath
    const gy = airborne ? ground(g.position.x, g.position.z) : groundY(sh);
    const hgt = g.position.y - gy;
    sh.shadow.visible = gy > -40 && cl < 0.9;
    sh.shadow.position.set(g.position.x, gy + 0.02, g.position.z); sh.shadow.rotation.y = sh.yaw;
    sh.shadow.scale.setScalar(sc * clamp(1.15 - hgt * 0.25, 0.25, 1.1) * (1 - cl));
    // a little z, rising from sleepers
    const asleep = sh.state === 'sleep' || (sh.state === 'graze' && sh.task === 'asleep');
    if (asleep && sh.lie > 0.9) {
      const f = (t * 0.12 + sh.zph) % 1; sh.head.getWorldPosition(wp);
      sh.zz.position.set(wp.x + f * 0.3, wp.y + 0.25 + f * 0.8, wp.z + Math.sin(f * 7) * 0.08); sh.zz.material.opacity = Math.sin(f * Math.PI) * 0.7; sh.zz.scale.setScalar(0.12 + f * 0.18);
    } else sh.zz.material.opacity = 0;
  }

  // ---------------------------------------------------------------- the music's breath, and its other news
  S.onEvent((ev) => {
    if (ev.type === 'cue') { // breathe in: the next sheep starts its run-up
      breathT = 1;
      // (while the night is young, a few always stay behind to graze)
      const grazing = flock.filter((s) => s.state === 'graze').length;
      // one at a time: if the last is still on its way (the screen slept, say), this breath passes
      const busy = flock.some((s) => s.state === 'run' || (s.state === 'flight' && !s.counted));
      if (!busy && next && next.state === 'next' && (grazing >= 2 || energy < 0.6)) { if (startRun(next, clockT, ev.apexIn)) next = null; }
    } else if (ev.type === 'leap') { // the top of the jump
      const f = flock.find((s) => s.state === 'flight' && !s.counted);
      if (f) { const err = clockT - f.apexAt; if (Math.abs(err) < 0.5) { f.t0 += err * 0.6; f.apexAt += err * 0.6; } }
      if (ram.state === 'graze' && ram.task === 'fence' && f) ram.shake = rand() < 0.3 ? 1 : 0; // the ram disapproves
    } else if (ev.type === 'baa') {
      const a = flock.filter((s) => s.state === 'graze' && s.task !== 'rest');
      if (a.length) { const s = a[Math.floor(rand() * a.length)]; s.task = 'look'; s.until = clockT + 2.5; s.hp = -0.55; }
    } else if (ev.type === 'huff') { if (ram.state === 'graze' && ram.task !== 'asleep') ram.shake = 1.2; }
    else if (ev.type === 'chord') starU.uPulse.value = 1;
  });

  // ---------------------------------------------------------------- the camera: framed for the jump, whatever the screen's shape
  const look = new THREE.Vector3(0.3, 0.9, 0);
  S.on((t, dt, st) => {
    clockT = t; energy = st.energy;
    starU.uPulse.value *= Math.exp(-dt * 1.2);
    // stars grow back
    for (let i = 0; i < STARS; i++) {
      const s = stars[i];
      if (s.eaten && t > s.back) s.eaten = false;
      s.glow = lerp(s.glow, s.eaten ? 0 : 1, 1 - Math.exp(-dt * (s.eaten ? 0.8 : 0.15)));
      starGlow[i] = s.glow;
    }
    starGeo.attributes.aGlow.needsUpdate = true;
    // pick the next to jump: an awake grazer near the run-up
    if ((!next || next.state !== 'next') && energy > 0.36) {
      next = null;
      const c = flock.filter((s) => s.state === 'graze' && s.lie < 0.2 && s.task !== 'rest').sort((a, b) => a.pos.distanceTo(WAIT) - b.pos.distanceTo(WAIT))[0];
      if (c) { if (c.target?.by === c) c.target.by = null; c.state = 'next'; c.task = null; next = c; }
    }
    for (const sh of all) { if (sh.state === 'cloud') sh.ring.a += sh.ring.w * dt * (0.5 + 0.5 * energy); update(sh, t, dt); }
    // personal space: no two sheep in the same place (whoever is asleep or running doesn't budge)
    const solid = all.filter((s) => !['flight', 'rise', 'descend', 'cloud'].includes(s.state));
    for (let a = 0; a < solid.length; a++) for (let b = a + 1; b < solid.length; b++) {
      const p = solid[a], q = solid[b], dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz), room = 0.8 * (p.scale + q.scale) / 2;
      if (d >= room || d < 1e-4) continue;
      const fixedP = p.state === 'sleep' || p.state === 'run' || p.task === 'asleep', fixedQ = q.state === 'sleep' || q.state === 'run' || q.task === 'asleep';
      if (fixedP && fixedQ) continue;
      const push = (room - d) * Math.min(1, dt * 4), kp = fixedP ? 0 : fixedQ ? 1 : 0.5, kq = 1 - kp;
      p.pos.x -= (dx / d) * push * kp; p.pos.z -= (dz / d) * push * kp; q.pos.x += (dx / d) * push * kq; q.pos.z += (dz / d) * push * kq;
    }
    for (const sh of solid) if (sh.state !== 'run' && sh.state !== 'land') keepOn(sh);
    // the ram watches whoever is jumping
    const jumper = flock.find((s) => s.state === 'run' || s.state === 'flight');
    ram.look = ram.state === 'graze' && ram.task === 'fence' && jumper ? jumper.g.position : null;
    for (const sh of all) pose(sh, t, dt);
    // the breath, in the light: the moon brightens as the runner breathes in, and fades on the long breath out
    breath = lerp(breath, breathT, 1 - Math.exp(-dt * (breathT > breath ? 0.5 : 0.35)));
    if (!jumper) breathT = 0;
    moonU.uGlow.value = 0.6 + 0.6 * breath; seaU.uLit.value = 0.6 + 0.5 * breath; woolU.uMoonPow.value = 1.3 + 0.8 * breath; moonLamp.intensity = 7 + 4 * breath;
    halo.material.opacity = 0.6 + 0.4 * breath;
    moon.rotation.set(0.08, -0.25, Math.sin(t * 0.21) * 0.07); // rocking like a cradle
    // the numbers: glow up, drift and fade
    for (const n of nums) { const k = (t - n.t0) / 5; n.sp.visible = k >= 0 && k < 1; if (!n.sp.visible) continue; n.sp.material.opacity = sstep(0, 0.12, k) * (1 - sstep(0.45, 1, k)) * 0.95; n.sp.position.copy(n.at).y += k * 0.7; }
    // the sky gathers its clouds as the flock goes to sleep
    const clouds = flock.filter((s) => s.state === 'cloud' || s.state === 'rise').length;
    su.uClouds.value = lerp(su.uClouds.value, 0.18 + 0.05 * clouds + 0.25 * (1 - energy), 1 - Math.exp(-dt * 0.05));
    // the camera
    const cam = S.camera, tanH = Math.tan((cam.fov * Math.PI) / 360), portrait = cam.aspect < 0.8;
    const dist = clamp(Math.max((portrait ? 4.9 : 10) / (tanH * cam.aspect), 4.8 / tanH), 11, 32);
    const az = Math.sin(t * 0.011) * 0.14, el = 0.3 + Math.sin(t * 0.017 + 1) * 0.04;
    look.set(portrait ? 0.9 : 0.6, portrait ? 0.2 : 0.6, -0.3);
    cam.position.set(look.x + Math.sin(az) * dist * Math.cos(el), look.y + Math.sin(el) * dist, look.z + Math.cos(az) * dist * Math.cos(el));
    cam.lookAt(look);
    woolU.uCam.value.copy(cam.position);
  });

  S.scene.userData.flock = { flock, ram, stars, BEDS, get count() { return count; }, ground, hW, hS };
  return S.finalize({ portraitFov: 62 });
}
