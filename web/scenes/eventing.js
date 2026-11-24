// Cross Country: riding a cross-country course at sunset, seen between your horse's ears. The
// track winds over rolling fields between hedgerows and oaks; at each fence (logs, rails, brush,
// a roll-top, all flagged red on the right and white on the left) the horse gathers and lifts
// you over. The canter follows the music's strides. As the night goes on the horse eases to a
// walk and goes round the fences instead, the sun sets, and the stars come out.
import * as THREE from 'three';
import { mulberry32 } from '../audio.js';
import { TAU, makeSky, lightAt, lightDir, treeGeo, paint, mergeAll, grassMaterial, makeGrass, updateGrass, setupShadows } from './country.js';

const P = 900; // the course repeats every P metres

export function createEventingScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0xe7e7);
  const ph = [rand() * TAU, rand() * TAU, rand() * TAU];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(64, 1, 0.05, 2400);
  scene.add(camera);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  // the course line and the ground, both repeating every P along z
  const w = (k) => (k * TAU) / P;
  const pathX = (z) => 22 * Math.sin(z * w(2) + ph[0]) + 9 * Math.sin(z * w(5) + ph[1]);
  const ground = (x, z) => 5 * Math.sin(z * w(3) + ph[2]) * Math.cos(x * 0.012) + 2.4 * Math.sin(z * w(7) + x * 0.025) + 7 * Math.sin(x * 0.006 + 1.2) * Math.sin(z * w(1));

  // ------------------------------------------------------------------ light and sky
  const U = { uDusk: { value: 0 }, uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0.35, 0.09, -1).normalize() }, uHorizonCol: { value: new THREE.Color() }, uZenithCol: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() } };
  const sky = keep(makeSky(U)); sky.renderOrder = -1; scene.add(sky);
  const hemi = new THREE.HemisphereLight('#fff', '#888', 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 1); scene.add(sun); scene.add(sun.target);
  setupShadows(sun, mobile);
  scene.fog = new THREE.Fog('#e6b892', 120, 900);

  // ------------------------------------------------------------------ the fields
  const W = 1300, L = P + 900, SX = mobile ? 150 : 200, SZ = mobile ? 300 : 420;
  const gGeo = keep(new THREE.PlaneGeometry(W, L, SX, SZ));
  gGeo.rotateX(-Math.PI / 2); gGeo.translate(0, 0, -L / 2 + 120);
  {
    const p = gGeo.attributes.position, col = new Float32Array(p.count * 3);
    const a = new THREE.Color('#5d8a37'), b = new THREE.Color('#7a9a3f'), track = new THREE.Color('#8fb04e'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, ground(x, z));
      // patches of different fields, with a lighter mown strip along the course
      const patch = 0.5 + 0.5 * Math.sin(x * 0.011 + Math.sin(z * w(4)) * 2) * Math.sin(z * w(6) + x * 0.004);
      c.copy(a).lerp(b, patch);
      const dx = Math.abs(x - pathX(z));
      c.lerp(track, Math.max(0, 1 - dx / 7) * 0.7);
      col.set([c.r, c.g, c.b], i * 3);
    }
    gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    gGeo.computeVertexNormals();
  }
  const groundMesh = new THREE.Mesh(gGeo, keep(grassMaterial(null)));
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // place things on two copies of the course: this stretch and the next
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function instanced(geo, items, material) {
    const mesh = new THREE.InstancedMesh(geo, material, items.length * 2);
    let n = 0;
    for (const tile of [0, -P]) for (const it of items) {
      q.setFromAxisAngle(up, it.ry ?? 0);
      mesh.setMatrixAt(n++, m4.compose(v.set(it.x, ground(it.x, it.z + tile) + (it.dy ?? 0), it.z + tile), q, s.setScalar(it.s ?? 1)));
    }
    mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  const lambert = keep(new THREE.MeshLambertMaterial({ vertexColors: true }));

  // oaks and copses, kept back from the course
  const trees = [];
  for (let k = 0; k < (mobile ? 260 : 380); k++) {
    const z = -rand() * P, x = (rand() - 0.5) * 900;
    if (Math.abs(x - pathX(z)) < 16) continue;
    trees.push({ x, z, s: 0.8 + rand() * 0.9, ry: rand() * TAU });
  }
  instanced(keep(treeGeo(rand, { canopy: '#4f7d38' })), trees, lambert);

  // hedgerows across the fields, with a gap where the course goes through
  const hedgeGeo = keep(paint(new THREE.BoxGeometry(4.2, 1.8, 1.4, 2, 2, 1), new THREE.Color('#4b7034')));
  { const p = hedgeGeo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) + (Math.random() - 0.5) * 0.5); hedgeGeo.translate(0, 0.8, 0); hedgeGeo.computeVertexNormals(); }
  const hedges = [];
  for (let line = 0; line < 7; line++) {
    const z0 = -(line + 0.5) * (P / 7);
    for (let x = -460; x < 460; x += 4) {
      const z = z0 + Math.sin(x * 0.01 + line) * 18;
      if (Math.abs(x - pathX(z)) < 5) continue;
      hedges.push({ x, z, ry: Math.atan(Math.cos(x * 0.01 + line) * 0.18), s: 0.9 + Math.random() * 0.25 });
    }
  }
  instanced(hedgeGeo, hedges, lambert);

  // ------------------------------------------------------------------ the fences
  function fenceGeo(kind) {
    const parts = [];
    const add = (g, col, x = 0, y = 0, z = 0, rz = 0, rx = 0) => { g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); parts.push(paint(g.toNonIndexed(), new THREE.Color(col))); };
    if (kind === 0) { // a big log on stumps
      add(new THREE.CylinderGeometry(0.42, 0.45, 4.2, 10), '#6b4a2e', 0, 0.75, 0, Math.PI / 2);
      for (const x of [-1.6, 1.6]) add(new THREE.CylinderGeometry(0.22, 0.25, 0.5, 6), '#5a3d25', x, 0.25);
    } else if (kind === 1) { // post and rails
      for (const x of [-2.1, 0, 2.1]) add(new THREE.BoxGeometry(0.18, 1.35, 0.18), '#e9e4d8', x, 0.67);
      for (const y of [0.45, 0.85, 1.22]) add(new THREE.BoxGeometry(4.4, 0.12, 0.08), '#f4f0e6', 0, y, 0.08);
    } else if (kind === 2) { // a brush fence on a timber frame
      add(new THREE.BoxGeometry(4.2, 0.6, 1.1), '#7a5a3a', 0, 0.3);
      const b = new THREE.BoxGeometry(4.2, 0.75, 0.9, 12, 3, 2);
      const p = b.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) + Math.random() * 0.25);
      add(b, '#3e6b2b', 0, 0.95);
    } else { // a roll-top
      add(new THREE.CylinderGeometry(0.75, 0.75, 4.2, 14, 1, false, 0, Math.PI), '#4f7a3a', 0, 0.1, 0, Math.PI / 2, Math.PI / 2);
    }
    // flags: red on the right, white on the left, as on every cross-country fence
    for (const [x, col] of [[-2.6, '#f3f3f0'], [2.6, '#d6262c']]) {
      add(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 5), '#dddddd', x, 0.95);
      const f = new THREE.BufferGeometry();
      f.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.85, 0, 0, 1.45, 0, x > 0 ? 0.45 : -0.45, 1.65, 0], 3));
      f.translate(x, 0, 0); parts.push(paint(f, new THREE.Color(col)));
    }
    const g = mergeAll(parts); g.computeVertexNormals(); return g;
  }
  const fences = [];
  for (let z = -60; z > -P + 40; z -= 85 + rand() * 50) {
    const dz = 2, dx = pathX(z - dz) - pathX(z + dz);
    fences.push({ x: pathX(z), z, kind: Math.floor(rand() * 4), ry: Math.atan2(dx, 2 * dz) });
  }
  const fenceDouble = fences.concat(fences.map((f) => ({ ...f, z: f.z - P })));
  const fenceMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  for (let k = 0; k < 4; k++) {
    const list = fences.filter((f) => f.kind === k);
    if (list.length) instanced(keep(fenceGeo(k)), list, fenceMat);
  }

  // ------------------------------------------------------------------ long grass round about, short on the course
  U.uPhE = { value: new THREE.Vector3(...ph) };
  const grass = makeGrass({
    count: mobile ? 16000 : 26000, box: 26, U, rand, tint: '#5c8a33',
    groundGLSL: `uniform vec3 uPhE;
      float groundH(float x, float z){ float w1 = 6.2831853 / ${P}.; return 5. * sin(z * w1 * 3. + uPhE.z) * cos(x * .012) + 2.4 * sin(z * w1 * 7. + x * .025) + 7. * sin(x * .006 + 1.2) * sin(z * w1); }
      float pathXg(float z){ float w1 = 6.2831853 / ${P}.; return 22. * sin(z * w1 * 2. + uPhE.x) + 9. * sin(z * w1 * 5. + uPhE.y); }`,
    shortGLSL: 'float shortK(float x, float z){ return mix(.22, 1., smoothstep(2.5, 6.5, abs(x - pathXg(z)))); }',
  });
  keep(grass.geometry); keep(grass.material);
  scene.add(grass);

  // ------------------------------------------------------------------ your horse, seen from the saddle
  // The neck runs forward and up from the withers below you to the poll; the mane lies along its
  // crest; the head angles down beyond the poll, and the ears stand up at the top of it.
  const horse = new THREE.Group();
  camera.add(horse);
  const coat = keep(new THREE.MeshLambertMaterial({ color: '#6e3b1e' })), dark = keep(new THREE.MeshLambertMaterial({ color: '#170e0a' }));
  const strap = keep(new THREE.MeshLambertMaterial({ color: '#2a1a10' }));
  const WITHERS = new THREE.Vector3(0, -0.9, -0.15), POLL = new THREE.Vector3(0, -0.47, -1.3);
  const along = (geo, a0, a1, mat) => {
    const d = new THREE.Vector3().subVectors(a1, a0), len = d.length();
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(a0).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.scale.y = len;
    horse.add(m); return m;
  };
  const neck = along(keep(new THREE.CylinderGeometry(0.15, 0.3, 1, 20, 6)), WITHERS, POLL, coat);
  neck.scale.x = 0.85; // a neck is deeper than it is wide
  // the crest of the neck, with the mane lying along it
  const crestA = WITHERS.clone().add(new THREE.Vector3(0, 0.27, 0.02)), crestB = POLL.clone().add(new THREE.Vector3(0, 0.14, 0.04));
  const maneGeo = keep(new THREE.BoxGeometry(0.045, 1, 0.05, 1, 14, 1));
  { const p = maneGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.06 + Math.sin(y * 40) * 0.012); p.setZ(i, p.getZ(i) * (1 + Math.sin(y * 23) * 0.4)); } }
  along(maneGeo, crestA, crestB, dark);
  // the head, angled down and forward beyond the poll
  const muzzle = POLL.clone().add(new THREE.Vector3(0, -0.5, -0.32));
  along(keep(new THREE.CylinderGeometry(0.09, 0.15, 1, 16, 2)), POLL.clone().add(new THREE.Vector3(0, 0.02, 0)), muzzle, coat);
  const pollCap = new THREE.Mesh(keep(new THREE.SphereGeometry(0.15, 18, 12)), coat);
  pollCap.position.copy(POLL); pollCap.scale.set(0.95, 0.85, 1.1); horse.add(pollCap);
  // forelock
  const fore = new THREE.Mesh(keep(new THREE.ConeGeometry(0.06, 0.16, 6)), dark);
  fore.position.copy(POLL).add(new THREE.Vector3(0, 0.08, -0.12)); fore.rotation.x = -2.2; horse.add(fore);
  const ears = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(keep(new THREE.ConeGeometry(0.045, 0.19, 8)), coat);
    ear.scale.set(1, 1, 0.6);
    ear.position.copy(POLL).add(new THREE.Vector3(sx * 0.075, 0.18, 0.0));
    ear.rotation.set(-0.15, 0, sx * -0.22);
    horse.add(ear); ears.push(ear);
  }
  // bridle: a thin browband and the reins running back to your hands below the frame
  const brow = new THREE.Mesh(keep(new THREE.TorusGeometry(0.135, 0.008, 5, 18, Math.PI)), strap);
  brow.position.copy(POLL).add(new THREE.Vector3(0, 0.02, -0.06)); brow.rotation.set(-0.5, 0, 0); horse.add(brow);
  const reinGeo = keep(new THREE.BufferGeometry());
  const bit = muzzle.clone().add(new THREE.Vector3(0, 0.08, 0.06));
  reinGeo.setAttribute('position', new THREE.Float32BufferAttribute([bit.x - 0.1, bit.y, bit.z, -0.3, -1.1, -0.35, bit.x + 0.1, bit.y, bit.z, 0.3, -1.1, -0.35], 3));
  horse.add(new THREE.LineSegments(reinGeo, keep(new THREE.LineBasicMaterial({ color: '#24160e' }))));
  horse.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ------------------------------------------------------------------ motion
  let t = 0, s0 = 30, speed = 7, dusk = 0, stridePh = 0, strideDur = 0.75, gaitK = 1, sway = 0, earFlick = 0;
  const look = new THREE.Vector3(), cam = new THREE.Vector3(), keyDir = new THREE.Vector3();
  function onEvent(ev) {
    if (ev.type === 'stride') { stridePh = 0; strideDur = ev.dur || strideDur; }
  }
  function update(time, dt, st) {
    t = time;
    const e = st.energy;
    U.uTime.value = t;
    // canter early, then a walk: the jumps stop and the horse goes round the fences instead
    gaitK += ((e > 0.55 ? 1 : e > 0.3 ? 0.35 : 0.12) - gaitK) * Math.min(1, dt * 0.15);
    speed = 1.2 + 8.8 * gaitK;
    s0 += speed * dt;
    if (s0 > P) s0 -= P; // the course repeats: jump back a lap, nothing visible changes
    stridePh += dt / strideDur;

    // the light: golden hour to dusk to night
    dusk += ((1 - e) * 1.15 - dusk) * Math.min(1, dt * 0.05);
    const L = lightAt(Math.min(1, Math.max(0, dusk)));
    U.uDusk.value = Math.min(1, dusk); U.uHorizonCol.value.copy(L.horizon); U.uZenithCol.value.copy(L.zenith); U.uSunCol.value.copy(L.sun);
    U.uSunDir.value.set(0.16, 0.08 - dusk * 0.15, -1).normalize();
    hemi.color.copy(L.hemiSky); hemi.groundColor.copy(L.hemiGround); hemi.intensity = L.hemiI;
    sun.color.copy(L.sun); sun.intensity = L.sunI;
    scene.fog.color.copy(L.fog); scene.background = scene.fog.color;

    // ride along the course; lift over the fences when cantering, steer round them when walking
    const z = -s0;
    let lift = 0, side = 0;
    for (const f of fenceDouble) {
      const d = z - f.z; // positive before the fence
      if (Math.abs(d) < 7) {
        const k = 1 - Math.abs(d) / 7;
        lift += Math.max(0, Math.sin((1 - (d + 4) / 8) * Math.PI)) * (Math.abs(d) < 4 ? 1 : 0) * 1.25 * gaitK;
        side += Math.sin(k * Math.PI / 2) * 4.2 * (1 - gaitK);
      }
    }
    const gaitBob = gaitK > 0.6 ? Math.sin(stridePh * TAU) * 0.09 : Math.sin(stridePh * TAU * 2) * 0.03;
    cam.set(pathX(z) + side + Math.sin(t * 0.3) * 0.4, ground(pathX(z), z) + 2.45 + lift + gaitBob * gaitK, z);
    camera.position.copy(cam);
    const az = z - 18;
    look.set(pathX(az) + side * 0.5, ground(pathX(az), az) + 1.5 + lift * 0.4, az);
    camera.lookAt(look);
    camera.rotateZ(Math.sin(stridePh * TAU) * 0.012 * gaitK + Math.sin(t * 0.2) * 0.01);
    camera.updateMatrixWorld();
    sun.position.copy(cam).addScaledVector(lightDir(U.uSunDir.value, Math.min(1, dusk), keyDir), 400); sun.target.position.copy(cam);
    sky.position.copy(cam);
    updateGrass(grass, { cam, hemi, sun, fog: scene.fog });

    // the horse's neck rocks with the canter and stretches over the jumps; ears flick now and then
    horse.rotation.x = Math.sin(stridePh * TAU + 0.6) * 0.035 * gaitK - lift * 0.06;
    horse.position.y = Math.sin(stridePh * TAU + 0.8) * 0.03 * gaitK;
    if (rand() < dt * 0.15) earFlick = 1;
    earFlick *= Math.exp(-dt * 3);
    ears[0].rotation.z = 0.22 + earFlick * 0.45; ears[1].rotation.z = -0.22 - Math.sin(t * 0.7) * 0.05;
  }

  return {
    scene, camera, update, onEvent, portraitFov: 72,
    look: { shadows: true, toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.05, bloom: [0.4, 0.55, 0.8], finish: { vignette: 0.4, grain: 0.02, ca: 0.3 } },
    dispose() { for (const d of disposables) d.dispose?.(); },
  };
}
