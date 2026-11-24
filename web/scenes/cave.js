// Crystal Cave: a slow drift around an underground lake in a vast cavern. Crystal clusters glow
// along the shore and the walls and light up when the music's bells ring (each cluster has its
// own pitch range), drips from the music send ripples across the lake, dust drifts through a
// shaft of moonlight, and a few wisps wander over the water. The cluster layout comes from the
// session's seed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../audio.js';

const TAU = Math.PI * 2;
const FLOOR = 0;
const LAKE_R = 15;
const PALETTES = [
  ['#7a5cff', '#2de0d0', '#ff4fa3', '#4f8bff', '#ffb03a'],
  ['#2de0d0', '#4f8bff', '#9b6bff', '#8fffe0', '#3dd0ff'],
  ['#ff6b8b', '#ffb03a', '#b05cff', '#ff8a5c', '#ffd27a'],
  ['#9b6bff', '#ff4fa3', '#4f8bff', '#c58bff', '#2de0d0'],
];

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
  return g;
}

export function createCaveScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0x5eed);
  const palette = PALETTES[Math.floor(rand() * PALETTES.length)];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03040a');
  scene.fog = new THREE.FogExp2('#04060e', 0.016);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  scene.add(new THREE.HemisphereLight('#4a5a9a', '#05060c', 0.7));
  const moon = new THREE.DirectionalLight('#b9c8ff', 0.6); moon.position.set(4, 30, 2); scene.add(moon);

  function jitter(geo, amount, keepFn = () => false) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (keepFn(p.getX(i), p.getY(i), p.getZ(i))) continue;
      const j = 1 + (rand() - 0.5) * amount;
      p.setXYZ(i, p.getX(i) * j, p.getY(i) * (1 + (rand() - 0.5) * amount * 0.5), p.getZ(i) * j);
    }
    geo.computeVertexNormals();
    return geo;
  }

  const rockMat = keep(new THREE.MeshStandardMaterial({ color: '#262b3e', roughness: 0.95, flatShading: true }));
  // ------------------------------------------------------------------ the cavern
  const dome = new THREE.Mesh(keep(jitter(new THREE.IcosahedronGeometry(70, 3), 0.2)), keep(new THREE.MeshStandardMaterial({ color: '#0d0f1a', roughness: 1, flatShading: true, side: THREE.BackSide })));
  dome.scale.set(1, 0.5, 1); dome.position.y = 6;
  scene.add(dome);
  const floorGeo = keep(new THREE.RingGeometry(LAKE_R - 0.3, 80, 64, 6));
  { const p = floorGeo.attributes.position; for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); p.setZ(i, r > LAKE_R + 1 ? (rand() - 0.3) * 0.8 + (r - LAKE_R) * 0.04 : -0.05); } floorGeo.computeVertexNormals(); }
  const floor = new THREE.Mesh(floorGeo, keep(new THREE.MeshStandardMaterial({ color: '#141725', roughness: 1, flatShading: true })));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR;
  scene.add(floor);

  // stalactites and stalagmites
  const spike = keep(jitter(new THREE.ConeGeometry(1, 1, 7, 3), 0.25, (x, y) => y > 0.49));
  const SPIKES = mobile ? 50 : 90;
  const spikes = new THREE.InstancedMesh(spike, rockMat, SPIKES);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const down = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  for (let k = 0; k < SPIKES; k++) {
    const a = rand() * TAU, len = 3 + rand() * 10, r = 0.6 + rand() * 1.5;
    if (k % 2) { const d = 18 + rand() * 45; v.set(Math.cos(a) * d, 38 - len / 2 - rand() * 6, Math.sin(a) * d); q.copy(down); }
    else { const d = 34 + rand() * 30; v.set(Math.cos(a) * d, FLOOR + len / 2 - 0.5, Math.sin(a) * d); q.identity(); }
    spikes.setMatrixAt(k, m4.compose(v, q, s.set(r, len, r)));
  }
  scene.add(spikes);

  // ------------------------------------------------------------------ crystals
  const CRYSTALS = mobile ? 230 : 380;
  const cGeo = keep(crystalGeo());
  const cMat = keep(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0.93 }));
  const crystals = new THREE.InstancedMesh(cGeo, cMat, CRYSTALS);
  crystals.frustumCulled = false;
  const clusters = []; // { base: Color, from, to, glow, light, x, z, pitch }
  let n = 0;
  function cluster(x, y, z, color, count, size) {
    const base = new THREE.Color(color), from = n;
    for (let k = 0; k < count && n < CRYSTALS; k++) {
      const a = rand() * TAU, d = rand() * size * 0.55;
      q.setFromEuler(new THREE.Euler((rand() - 0.5) * 1.1, rand() * TAU, (rand() - 0.5) * 1.1));
      const h = size * (0.45 + rand() * 0.9);
      crystals.setMatrixAt(n, m4.compose(v.set(x + Math.cos(a) * d, y - 0.1, z + Math.sin(a) * d), q, s.set(h * 0.9, h, h * 0.9)));
      crystals.setColorAt(n, base.clone().multiplyScalar(0.55 + rand() * 0.3));
      n++;
    }
    const c = { base, from, to: n, glow: 0, x, y, z, light: null, shade: [] };
    for (let i = from; i < n; i++) { const col = new THREE.Color(); crystals.getColorAt(i, col); c.shade.push(col); }
    clusters.push(c);
    return c;
  }
  // a ring of clusters along the lake shore, bigger ones further back, some up on the walls
  const SHORE = mobile ? 14 : 20;
  for (let k = 0; k < SHORE; k++) {
    const a = (k / SHORE) * TAU + rand() * 0.25, d = LAKE_R + 1 + rand() * 4;
    cluster(Math.cos(a) * d, FLOOR, Math.sin(a) * d, palette[k % palette.length], 6, 1.1 + rand() * 1.4);
  }
  for (let k = 0; k < (mobile ? 9 : 14); k++) {
    const a = rand() * TAU, d = 26 + rand() * 20;
    cluster(Math.cos(a) * d, FLOOR + rand() * 2, Math.sin(a) * d, palette[Math.floor(rand() * palette.length)], 9, 3 + rand() * 3);
  }
  for (let k = 0; k < (mobile ? 5 : 8); k++) {
    const a = rand() * TAU, d = 30 + rand() * 25;
    cluster(Math.cos(a) * d, 20 + rand() * 10, Math.sin(a) * d, palette[Math.floor(rand() * palette.length)], 5, 2 + rand() * 2);
  }
  crystals.count = n;
  scene.add(crystals);
  // each cluster answers a slice of pitch: low notes light the far, big ones, high notes the shore
  clusters.forEach((c, k) => { c.pitch = k; });
  // a few coloured lights so the glow really lights the rock
  const lights = [];
  for (let k = 0; k < (mobile ? 3 : 6); k++) {
    const c = clusters[Math.floor((k / (mobile ? 3 : 6)) * SHORE)];
    const l = new THREE.PointLight(c.base, 18, 26, 2);
    l.position.set(c.x, FLOOR + 2.5, c.z);
    l.userData.base = 18;
    c.light = l; scene.add(l); lights.push(l);
  }

  // the crystals' reflection in the lake: the same instances, mirrored about the water line
  const mirrorMat = keep(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  const mirror = new THREE.InstancedMesh(cGeo, mirrorMat, CRYSTALS);
  mirror.instanceMatrix = crystals.instanceMatrix; mirror.instanceColor = crystals.instanceColor;
  mirror.count = n; mirror.frustumCulled = false;
  mirror.position.y = 2 * FLOOR - 0.02; mirror.scale.y = -1;
  scene.add(mirror);

  // ------------------------------------------------------------------ the lake
  const RIPPLES = 8;
  const lakeU = {
    uTime: { value: 0 }, uRip: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uTint: { value: new THREE.Color(palette[1]) }, fogColor: { value: scene.fog.color }, fogDensity: { value: scene.fog.density },
  };
  let ripN = 0;
  const lakeMat = keep(new THREE.ShaderMaterial({
    uniforms: lakeU, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vW; varying float vDepth;
      void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; uniform vec4 uRip[${RIPPLES}]; uniform vec3 uTint; uniform vec3 fogColor; uniform float fogDensity;
      varying vec3 vW; varying float vDepth;
      void main(){
        vec2 p = vW.xz; float h = 0.;
        for (int i = 0; i < ${RIPPLES}; i++) {
          vec4 r = uRip[i]; float age = uTime - r.z;
          if (age > 0. && age < 9.) {
            float d = length(p - r.xy), front = age * 1.7;
            float env = exp(-pow((d - front) * 1.3, 2.)) * r.w * exp(-age * 0.45) / (1. + front * 0.3);
            h += env * sin((d - front) * 7.);
          }
        }
        float sh = sin(p.x * .55 + uTime * .23) * sin(p.y * .7 - uTime * .19) + .5 * sin(p.x * 1.3 - p.y * .9 + uTime * .31);
        float edge = smoothstep(${(LAKE_R - 3).toFixed(1)}, ${LAKE_R.toFixed(1)}, length(p));
        vec3 col = vec3(.008, .025, .04) + uTint * (.035 + .02 * sh) + uTint * max(h, 0.) * .9 + vec3(.7, .8, 1.) * max(-h, 0.) * .15;
        float a = mix(.78, .95, edge);
        float f = 1. - exp(-fogDensity * fogDensity * vDepth * vDepth);
        gl_FragColor = vec4(mix(col, fogColor, f), a);
      }`,
  }));
  const lake = new THREE.Mesh(keep(new THREE.CircleGeometry(LAKE_R, 64)), lakeMat);
  lake.rotation.x = -Math.PI / 2; lake.position.y = FLOOR;
  scene.add(lake);

  // ------------------------------------------------------------------ the shaft of moonlight and its dust
  const shaftTex = keep((() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(225,235,255,.7)'); gr.addColorStop(0.7, 'rgba(200,215,255,.2)'); gr.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(255,255,255,${0.03 + rand() * 0.04})`; g.fillRect(rand() * 128, 0, 2 + rand() * 6, 256); }
    return new THREE.CanvasTexture(c);
  })());
  const shaftMat = keep(new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  const shaft = new THREE.Mesh(keep(new THREE.CylinderGeometry(2.5, 6, 40, 32, 1, true)), shaftMat);
  shaft.position.set(2, 20, -3); shaft.rotation.z = 0.08;
  scene.add(shaft);
  const dot = keep(softDot());
  const DUST = mobile ? 180 : 360;
  const dustGeo = keep(new THREE.BufferGeometry());
  const dp = new Float32Array(DUST * 3), dSeed = new Float32Array(DUST);
  for (let k = 0; k < DUST; k++) { const a = rand() * TAU, d = Math.sqrt(rand()) * 6; dp[k * 3] = 2 + Math.cos(a) * d; dp[k * 3 + 1] = rand() * 22; dp[k * 3 + 2] = -3 + Math.sin(a) * d; dSeed[k] = rand() * TAU; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({ size: 0.09, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#cfdcff', toneMapped: false, opacity: 0.8 })));
  dust.frustumCulled = false;
  scene.add(dust);

  // ------------------------------------------------------------------ wisps over the water
  const WISPS = mobile ? 26 : 44;
  const wGeo = keep(new THREE.BufferGeometry());
  const wp = new Float32Array(WISPS * 3), wc = new Float32Array(WISPS * 3), wSeed = [];
  for (let k = 0; k < WISPS; k++) {
    const col = new THREE.Color(palette[k % palette.length]);
    wc.set([col.r, col.g, col.b], k * 3);
    wSeed.push({ a: rand() * TAU, r: 3 + rand() * (LAKE_R + 8), h: 0.8 + rand() * 6, sp: (rand() - 0.5) * 0.05, ph: rand() * TAU });
  }
  wGeo.setAttribute('position', new THREE.BufferAttribute(wp, 3));
  wGeo.setAttribute('color', new THREE.BufferAttribute(wc, 3));
  const wisps = new THREE.Points(wGeo, keep(new THREE.PointsMaterial({ size: 0.55, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  wisps.frustumCulled = false;
  scene.add(wisps);

  // ------------------------------------------------------------------ motion
  const cam = { a: rand() * TAU, r: 25 };
  const look = new THREE.Vector3();
  const tmpC = new THREE.Color();

  function flash(c, amount) { c.glow = Math.min(1.6, c.glow + amount); }

  function onEvent(ev, t) {
    if (ev.type === 'bell') {
      // map pitch to a cluster so a melody walks around the cavern
      const k = Math.abs(Math.floor(ev.midi * 7.3)) % clusters.length;
      flash(clusters[k], 1);
      flash(clusters[(k + 1) % clusters.length], 0.3);
    } else if (ev.type === 'drip') {
      const a = ev.x * TAU, d = Math.sqrt((ev.x * 7.13) % 1) * (LAKE_R - 3);
      lakeU.uRip.value[ripN++ % RIPPLES].set(Math.cos(a) * d, Math.sin(a) * d, t, 0.6);
    } else if (ev.type === 'chord') {
      for (const c of clusters) if (c.light) flash(c, 0.25);
    }
  }

  function update(t, dt, st) {
    const calm = 0.55 + 0.45 * st.energy;
    lakeU.uTime.value = t;
    // the camera drifts round the lake, rising and falling a little
    cam.a += dt * 0.018 * calm;
    const r = cam.r + Math.sin(t * 0.021) * 4;
    camera.position.set(Math.cos(cam.a) * r, FLOOR + 3.2 + Math.sin(t * 0.05) * 1.4, Math.sin(cam.a) * r);
    look.set(Math.cos(cam.a + 2.4) * 6, FLOOR + 2.4 + Math.sin(t * 0.037) * 0.8, Math.sin(cam.a + 2.4) * 6);
    camera.lookAt(look);

    // crystals glow when the bells ring, and fade back
    let dirty = false;
    for (const c of clusters) {
      if (c.glow < 0.002 && !c.lit) continue;
      c.glow *= Math.exp(-dt * 0.9);
      c.lit = c.glow >= 0.002;
      const boost = 1 + c.glow * 2.6;
      for (let i = c.from; i < c.to; i++) crystals.setColorAt(i, tmpC.copy(c.shade[i - c.from]).multiplyScalar(boost));
      if (c.light) c.light.intensity = c.light.userData.base * (1 + c.glow * 2.2);
      dirty = true;
    }
    if (dirty) crystals.instanceColor.needsUpdate = true;
    cMat.color.setScalar(0.85 + 0.15 * Math.sin(t * 0.25));
    shaftMat.opacity = 0.055 + 0.02 * Math.sin(t * 0.3);

    const p = dustGeo.attributes.position;
    for (let k = 0; k < DUST; k++) {
      let y = p.getY(k) - dt * 0.1;
      if (y < 0) y = 22;
      p.setY(k, y);
      p.setX(k, p.getX(k) + Math.sin(t * 0.3 + dSeed[k]) * dt * 0.06);
    }
    p.needsUpdate = true;
    for (let k = 0; k < WISPS; k++) {
      const w = wSeed[k];
      w.a += w.sp * dt * calm;
      const rr = w.r + Math.sin(t * 0.13 + w.ph) * 2;
      wp[k * 3] = Math.cos(w.a) * rr; wp[k * 3 + 1] = FLOOR + w.h + Math.sin(t * 0.4 + w.ph) * 0.5; wp[k * 3 + 2] = Math.sin(w.a) * rr;
    }
    wGeo.attributes.position.needsUpdate = true;
  }

  return {
    scene, camera, update, onEvent,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.1, bloom: [0.85, 0.55, 0.6] },
    dispose() { for (const d of disposables) d.dispose?.(); spikes.dispose(); crystals.dispose(); lights.forEach((l) => l.dispose()); },
  };
}
