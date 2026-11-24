// Crystal Cave: a slow flight down an endless winding tunnel through the rock. Crystal clusters
// grow out of the walls and light the stone around them; when the music's bells ring, a cluster
// ahead on that side flares up. Now and then the tunnel opens into a wider chamber. A few
// glowing motes drift ahead as if leading the way, and dust hangs in the air.
//
// The tunnel is one fixed mesh: its vertex shader bends it along the path and sizes it with the
// wall function, both evaluated at the camera's position along the path, so it never ends. The
// same path and wall functions run in JS to place the crystals on the walls.
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

// The path (centre line) and the wall radius, written once for GLSL and once for JS. They must
// stay identical. `ph` is the seed's phase offsets.
const GLSL_PATH = `
  uniform vec4 uPh;
  vec3 pathAt(float s){
    return vec3(9. * sin(s * .021 + uPh.x) + 4. * sin(s * .053 + uPh.y),
                3. * sin(s * .017 + uPh.z) + 1.5 * sin(s * .041),
                -s);
  }
  float chamber(float s){ return smoothstep(.55, 1., sin(s * .019 + uPh.w)); }
  float wallR(float s, float a){
    float r = 4.3 + 2.6 * chamber(s);
    r += .7 * sin(a * 3. + s * .23) * sin(s * .11 + 1.) + .45 * sin(a * 5. - s * .37 + 2.)
       + .3 * sin(a * 2. + s * .61) + .16 * sin(a * 9. + s * 1.3);
    return r;
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
  const wallR = (s, a) => 4.3 + 2.6 * chamber(s)
    + 0.7 * Math.sin(a * 3 + s * 0.23) * Math.sin(s * 0.11 + 1) + 0.45 * Math.sin(a * 5 - s * 0.37 + 2)
    + 0.3 * Math.sin(a * 2 + s * 0.61) + 0.16 * Math.sin(a * 9 + s * 1.3);
  const a0 = new THREE.Vector3(), b0 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  function frameAt(s, T, R, U) {
    T.subVectors(pathAt(s + 0.6, a0), pathAt(s - 0.6, b0)).normalize();
    R.crossVectors(T, Y).normalize();
    U.crossVectors(R, T);
  }
  return { pathAt, wallR, chamber, frameAt };
}

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
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

  // ------------------------------------------------------------------ the tunnel
  const NL = mobile ? 6 : 10; // crystal lights the rock shader takes
  const DS = 0.8, RINGS = mobile ? 115 : 150, SEGS = mobile ? 22 : 30, BEHIND = 6;
  const tunnelU = {
    uS: { value: 0 }, uPh: { value: new THREE.Vector4(...ph) }, uCam: { value: new THREE.Vector3() },
    uL: { value: Array.from({ length: NL }, () => new THREE.Vector4()) },
    uLC: { value: Array.from({ length: NL }, () => new THREE.Color()) },
    uFog: { value: FOG }, uDensity: { value: scene.fog.density },
  };
  const tGeo = keep(new THREE.BufferGeometry());
  {
    const pos = [], idx = [];
    for (let i = 0; i < RINGS; i++) for (let j = 0; j <= SEGS; j++) pos.push(i * DS, (j / SEGS) * TAU, 0);
    for (let i = 0; i < RINGS - 1; i++) for (let j = 0; j < SEGS; j++) {
      const a = i * (SEGS + 1) + j, b = a + SEGS + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    tGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tGeo.setIndex(idx);
  }
  const tunnel = new THREE.Mesh(tGeo, keep(new THREE.ShaderMaterial({
    uniforms: tunnelU, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: `${GLSL_PATH}
      uniform float uS; varying vec3 vW; varying vec2 vSA;
      void main(){
        float s = floor(uS / ${DS.toFixed(2)}) * ${DS.toFixed(2)} - ${BEHIND.toFixed(1)} + position.x;
        float a = position.y;
        vec3 T, R, U; frameAt(s, T, R, U);
        vec3 w = pathAt(s) + (cos(a) * R + sin(a) * U) * wallR(s, a);
        vW = w; vSA = vec2(s, a);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
      }`,
    fragmentShader: `uniform vec3 uCam; uniform vec4 uL[${NL}]; uniform vec3 uLC[${NL}]; uniform vec3 uFog; uniform float uDensity;
      varying vec3 vW; varying vec2 vSA;
      void main(){
        // flat facets from screen-space derivatives give the rock its chiselled look
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        vec3 toCam = uCam - vW; float dc = length(toCam);
        if (dot(n, toCam) < 0.) n = -n;
        float grain = .75 + .25 * sin(vSA.x * 1.9 + vSA.y * 7.) * sin(vSA.x * .7 - vSA.y * 3.);
        vec3 rock = vec3(.075, .08, .11) * grain;
        // a faint cool light that travels with us, so the walls never vanish
        vec3 light = vec3(.13, .15, .24) * (.35 + .65 * max(dot(n, toCam / dc), 0.)) / (1. + dc * dc * .012);
        for (int i = 0; i < ${NL}; i++) {
          vec3 d = uL[i].xyz - vW; float dist2 = dot(d, d);
          float lam = .35 + .65 * max(dot(n, d * inversesqrt(dist2)), 0.);
          light += uLC[i] * uL[i].w * lam / (1. + dist2 * .28);
        }
        vec3 col = rock * light * 2.2;
        float f = 1. - exp(-uDensity * uDensity * dc * dc);
        gl_FragColor = vec4(mix(col, uFog, f), 1.);
      }`,
  })));
  tunnel.frustumCulled = false;
  scene.add(tunnel);

  // ------------------------------------------------------------------ crystals on the walls
  const SLOTS = mobile ? 32 : 46, PER = 7, AHEAD = RINGS * DS - BEHIND - 4;
  // crystals: lit from within, with facets catching the light as we pass
  const cU = { uCam: tunnelU.uCam, uFog: { value: FOG }, uDensity: { value: scene.fog.density }, uBright: { value: 1 } };
  const cMat = keep(new THREE.ShaderMaterial({
    uniforms: cU, vertexColors: true, extensions: { derivatives: true },
    vertexShader: `varying vec3 vC; varying vec3 vW; varying float vY;
      void main(){
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
        vC = color * instanceColor; vW = w.xyz; vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform vec3 uCam, uFog; uniform float uDensity, uBright; varying vec3 vC; varying vec3 vW; varying float vY;
      void main(){
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        vec3 v = uCam - vW; float d = length(v);
        float facet = abs(dot(n, v / d));
        vec3 col = vC * uBright * (.45 + 1.1 * facet * facet) + vC * pow(1. - facet, 4.) * .8;
        float f = 1. - exp(-uDensity * uDensity * d * d);
        gl_FragColor = vec4(mix(col, uFog, f), 1.);
      }`,
  }));
  const crystals = new THREE.InstancedMesh(keep(crystalGeo()), cMat, SLOTS * PER);
  crystals.frustumCulled = false;
  scene.add(crystals);
  const clusters = [];
  const T = new THREE.Vector3(), R = new THREE.Vector3(), U = new THREE.Vector3(), C = new THREE.Vector3(), D = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const tmpC = new THREE.Color();
  let farthest = 4;

  function place(k, s) {
    const cl = clusters[k] ?? (clusters[k] = { shade: [], pos: new THREE.Vector3(), glow: 0, lit: false });
    // favour the sides and floor a little over the ceiling
    let a = rand() * TAU;
    if (Math.sin(a) > 0.6 && rand() < 0.5) a = -a;
    const big = P.chamber(s) > 0.5 ? 1.6 : Math.min(1, P.wallR(s, a) / 5.2);
    const size = (0.8 + rand() * 1.1) * big;
    cl.s = s; cl.a = a; cl.color = palette[Math.floor(rand() * palette.length)]; cl.glow = 0.0; cl.lit = true;
    P.frameAt(s, T, R, U);
    for (let i = 0; i < PER; i++) {
      // each crystal sits on the wall a little apart from its neighbours and points inward
      const da = (rand() - 0.5) * 0.5 / big, dsI = (rand() - 0.5) * 1.6 * big;
      const si = s + dsI, ai = a + da;
      P.frameAt(si, T, R, U);
      D.copy(R).multiplyScalar(Math.cos(ai)).addScaledVector(U, Math.sin(ai)); // outward
      P.pathAt(si, C).addScaledVector(D, P.wallR(si, ai) - 0.05);
      q.setFromUnitVectors(Y, v.copy(D).negate());
      q2.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.9, rand() * TAU, (rand() - 0.5) * 0.9));
      q.multiply(q2);
      const h = size * (0.5 + rand() * (i === 0 ? 1.2 : 0.8));
      crystals.setMatrixAt(k * PER + i, m4.compose(C, q, sc.set(h * 0.85, h, h * 0.85)));
      cl.shade[i] = cl.color.clone().multiplyScalar(0.4 + rand() * 0.25);
      if (i === 0) cl.pos.copy(C).addScaledVector(D, -0.9 * size); // the light sits just off the wall
    }
    crystals.instanceMatrix.needsUpdate = true;
  }
  for (let k = 0; k < SLOTS; k++) { place(k, farthest); farthest += AHEAD / SLOTS * (0.6 + rand() * 0.8); }

  // ------------------------------------------------------------------ dust and guiding motes
  const dot = keep(softDot());
  const DUST = mobile ? 220 : 400;
  const dustGeo = keep(new THREE.BufferGeometry());
  const dp = new Float32Array(DUST * 3), dS = new Float32Array(DUST);
  function spawnDust(k, s) {
    const a = rand() * TAU;
    P.frameAt(s, T, R, U);
    D.copy(R).multiplyScalar(Math.cos(a)).addScaledVector(U, Math.sin(a));
    P.pathAt(s, C).addScaledVector(D, P.wallR(s, a) * Math.sqrt(rand()) * 0.85);
    dp.set([C.x, C.y, C.z], k * 3); dS[k] = s;
  }
  for (let k = 0; k < DUST; k++) spawnDust(k, rand() * 70);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({ size: 0.05, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#9fb4ff', toneMapped: false, opacity: 0.6 })));
  dust.frustumCulled = false;
  scene.add(dust);

  const MOTES = 5;
  const mGeo = keep(new THREE.BufferGeometry());
  const mp = new Float32Array(MOTES * 3), mc = new Float32Array(MOTES * 3);
  const motes = [];
  for (let k = 0; k < MOTES; k++) {
    const col = palette[k % palette.length];
    mc.set([col.r, col.g, col.b], k * 3);
    motes.push({ ahead: 9 + k * 3.5, a: rand() * TAU, r: 0.3 + rand() * 0.4, ph: rand() * TAU });
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  mGeo.setAttribute('color', new THREE.BufferAttribute(mc, 3));
  const moteMesh = new THREE.Points(mGeo, keep(new THREE.PointsMaterial({ size: 0.5, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  moteMesh.frustumCulled = false;
  scene.add(moteMesh);

  // ------------------------------------------------------------------ motion and music
  let s = 0, speed = 4;
  const look = new THREE.Vector3(), camPos = new THREE.Vector3();

  function onEvent(ev) {
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
      const c = clusters[Math.floor(ev.x * clusters.length)];
      if (c && c.s > s) c.glow = Math.min(1.6, c.glow + 0.3);
    } else if (ev.type === 'chord') {
      for (const c of clusters) if (c.s > s && c.s < s + 25) c.glow = Math.min(1.6, c.glow + 0.12);
    }
  }

  const lightPick = [];
  function update(t, dt, st) {
    speed += ((2.2 + 3.6 * st.energy) - speed) * Math.min(1, dt * 0.3);
    s += speed * dt;
    tunnelU.uS.value = s;

    // the camera rides the path, swaying gently, rolling into the bends
    P.frameAt(s, T, R, U);
    P.pathAt(s, camPos).addScaledVector(R, Math.sin(t * 0.13) * 0.7).addScaledVector(U, Math.sin(t * 0.09) * 0.45 - 0.3);
    camera.position.copy(camPos);
    P.pathAt(s + 11, look);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    const bend = P.pathAt(s + 9, v).x - 2 * camPos.x + P.pathAt(s - 9, C).x;
    camera.rotateZ(Math.max(-0.25, Math.min(0.25, -bend * 0.03)));
    tunnelU.uCam.value.copy(camPos);

    // recycle clusters that are behind us to the far end
    for (let k = 0; k < clusters.length; k++) {
      if (clusters[k].s < s - BEHIND + 1) { place(k, farthest); farthest += AHEAD / SLOTS * (0.6 + rand() * 0.8); }
    }
    if (farthest < s + AHEAD - 10) farthest = s + AHEAD - 10;

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
      if (c) { tunnelU.uL.value[i].set(c.pos.x, c.pos.y, c.pos.z, 0.45 + c.glow * 3.4); tunnelU.uLC.value[i].copy(c.color); }
      else tunnelU.uL.value[i].w = 0;
    }

    // dust behind us is sprinkled again further ahead
    for (let k = 0; k < DUST; k++) if (dS[k] < s - 2) spawnDust(k, s + 8 + rand() * 60);
    dustGeo.attributes.position.needsUpdate = true;
    for (let k = 0; k < MOTES; k++) {
      const m = motes[k], ms = s + m.ahead + Math.sin(t * 0.21 + m.ph) * 2;
      P.frameAt(ms, T, R, U);
      const a = m.a + Math.sin(t * 0.15 + m.ph) * 1.2, r = P.wallR(ms, a) * m.r;
      P.pathAt(ms, C).addScaledVector(R, Math.cos(a) * r).addScaledVector(U, Math.sin(a) * r);
      mp.set([C.x, C.y, C.z], k * 3);
    }
    mGeo.attributes.position.needsUpdate = true;
  }

  return {
    scene, camera, update, onEvent, portraitFov: 78,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.0, bloom: [0.85, 0.5, 0.55] },
    dispose() { for (const d of disposables) d.dispose?.(); crystals.dispose(); },
  };
}
