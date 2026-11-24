// Cotswold Valley: an evening walk along a footpath high on the side of a steep Cotswold valley.
// Beech woods crown the slopes; dry-stone walls divide the meadows; sheep graze; a stream winds
// along the bottom; across the valley a village of honey-coloured stone cottages and a church
// tower catches the last sun, and as dusk falls their windows light up one by one, haze gathers
// in the valley, glow-worms appear in the verges, and the stars come out.
import * as THREE from 'three';
import { mulberry32 } from '../audio.js';
import { TAU, makeSky, lightAt, lightDir, treeGeo, paint, mergeAll, grassMaterial, makeGrass, updateGrass, setupShadows } from './country.js';

const P = 760; // the valley repeats every P metres

export function createCotswoldScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0xc075);
  const ph = [rand() * TAU, rand() * TAU, rand() * TAU, rand() * TAU];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2400);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const w = (k) => (k * TAU) / P;

  // the valley: a stream winding along the bottom, steep sides, combes cut into them
  const streamX = (z) => 18 * Math.sin(z * w(2) + ph[0]) + 7 * Math.sin(z * w(5) + ph[1]);
  const ground = (x, z) => {
    const dx = x - streamX(z), a = Math.abs(dx);
    const side = Math.pow(Math.min(1, a / 230), 1.25) * 95; // the steep sides
    const combe = 1 - 0.35 * Math.max(0, Math.sin(z * w(4) + ph[2] + (dx > 0 ? 1.7 : 0))); // side valleys
    const roll = 3 * Math.sin(z * w(9) + x * 0.03) + 2 * Math.sin(x * 0.05 + z * w(6));
    return side * combe + roll * Math.min(1, a / 40) + Math.min(a, 6) * 0.15;
  };
  const pathX = (z) => streamX(z) - 70 - 10 * Math.sin(z * w(3) + ph[3]); // our footpath, up the west side

  // ------------------------------------------------------------------ light and sky
  const U = { uDusk: { value: 0 }, uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0.2, 0.08, -1).normalize() }, uHorizonCol: { value: new THREE.Color() }, uZenithCol: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() } };
  const sky = keep(makeSky(U)); sky.renderOrder = -1; scene.add(sky);
  const hemi = new THREE.HemisphereLight('#fff', '#888', 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 1); scene.add(sun); scene.add(sun.target);
  setupShadows(sun, mobile);
  scene.fog = new THREE.Fog('#e6b892', 140, 1000);

  // ------------------------------------------------------------------ the land
  const W = 900, L = P + 950, SX = mobile ? 170 : 230, SZ = mobile ? 300 : 400;
  const gGeo = keep(new THREE.PlaneGeometry(W, L, SX, SZ));
  gGeo.rotateX(-Math.PI / 2); gGeo.translate(0, 0, -L / 2 + 120);
  const woods = (x, z) => ground(x, z) > 58 + 12 * Math.sin(z * w(5) + x * 0.01) || (Math.sin(z * w(7) + ph[1]) > 0.7 && ground(x, z) > 30);
  {
    const p = gGeo.attributes.position, col = new Float32Array(p.count * 3);
    const meadow = new THREE.Color('#6f9440'), hay = new THREE.Color('#a3a352'), wood = new THREE.Color('#2f4522'), lane = new THREE.Color('#9b8a5c'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, ground(x, z));
      // fields: a patchwork of meadow and hay, separated by the walls below
      const fid = Math.floor((z + 2000) / 95) * 7 + Math.floor((x - streamX(z) + 2000) / 80);
      const f = (Math.sin(fid * 12.9898) * 43758.5453) % 1;
      c.copy(meadow).lerp(hay, Math.abs(f) * 0.55);
      if (woods(x, z)) c.copy(wood);
      const dp = Math.abs(x - pathX(z));
      if (dp < 2.2) c.lerp(lane, 0.7);
      col.set([c.r, c.g, c.b], i * 3);
    }
    gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    gGeo.computeVertexNormals();
  }
  const land = new THREE.Mesh(gGeo, keep(grassMaterial(null)));
  land.receiveShadow = true;
  scene.add(land);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function instanced(geo, items, material) {
    const mesh = new THREE.InstancedMesh(geo, material, items.length * 2);
    let n = 0;
    for (const tile of [0, -P]) for (const it of items) {
      q.setFromEuler(new THREE.Euler(0, it.ry ?? 0, it.rz ?? 0, 'YXZ'));
      const sc = it.sv ?? [it.s ?? 1, it.s ?? 1, it.s ?? 1];
      mesh.setMatrixAt(n++, m4.compose(v.set(it.x, (it.y ?? ground(it.x, it.z)) + (it.dy ?? 0), it.z + tile), q, s.set(...sc)));
    }
    mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  const lambert = keep(new THREE.MeshLambertMaterial({ vertexColors: true }));

  // beech woods on the tops, and trees dotted along the hedges and the stream
  const beeches = [];
  for (let k = 0; k < (mobile ? 1300 : 2000); k++) {
    const z = -rand() * P, x = streamX(z) + (rand() - 0.5) * 820;
    const nearPath = Math.abs(x - pathX(z)) < 9;
    if (nearPath) continue;
    const inWood = woods(x, z);
    if (!inWood && rand() > 0.07) continue;
    beeches.push({ x, z, s: (inWood ? 1.1 : 0.9) + rand() * 0.7, ry: rand() * TAU, dy: -0.3 });
  }
  instanced(keep(treeGeo(rand, { canopy: '#48632c', round: 0.85 })), beeches, lambert);

  // dry-stone walls: across the slopes between fields, and along the lane
  const wallGeo = keep(paint(new THREE.BoxGeometry(3.2, 1.15, 0.6), new THREE.Color('#b9a57c')));
  wallGeo.translate(0, 0.5, 0); wallGeo.computeVertexNormals();
  const walls = [];
  for (let z0 = -40; z0 > -P; z0 -= 95) {
    for (let d = -300; d < 300; d += 3) {
      const z = z0 + Math.sin(d * 0.013) * 6, x = streamX(z) + d;
      if (Math.abs(x - pathX(z)) < 2.5 || woods(x, z) || Math.abs(d) < 8) continue;
      const slope = (ground(x + 1.6, z) - ground(x - 1.6, z)) / 3.2;
      walls.push({ x, z, ry: -Math.atan(Math.cos(d * 0.013) * 0.08), rz: Math.atan(slope), sv: [1.02, 1.3, 1], dy: -0.35 }); // across the slope, tilted to follow it
    }
  }
  instanced(wallGeo, walls, lambert);

  // sheep grazing in the meadows
  const sheepGeo = keep((() => {
    const body = paint(new THREE.SphereGeometry(0.6, 10, 8).scale(1.35, 0.85, 0.85), new THREE.Color('#e9e4d6'));
    const head = paint(new THREE.SphereGeometry(0.24, 8, 6).scale(1.2, 1, 0.9).translate(0.85, 0.15, 0), new THREE.Color('#2b2522'));
    const g = mergeAll([body.toNonIndexed(), head.toNonIndexed()]); g.translate(0, 0.7, 0); g.computeVertexNormals(); return g;
  })());
  const sheep = [];
  for (let k = 0; k < (mobile ? 140 : 220); k++) {
    const z = -rand() * P, x = streamX(z) + (rand() - 0.5) * 380;
    if (woods(x, z) || Math.abs(x - pathX(z)) < 6 || Math.abs(x - streamX(z)) < 6) continue;
    sheep.push({ x, z, ry: rand() * TAU, s: 0.85 + rand() * 0.3 });
  }
  instanced(sheepGeo, sheep, lambert);

  // ------------------------------------------------------------------ the village across the valley
  const cottageGeo = keep((() => {
    const walls_ = paint(new THREE.BoxGeometry(7, 4.6, 5.2).translate(0, 2.3, 0), new THREE.Color('#d8b878'));
    const roof = new THREE.CylinderGeometry(3.4, 3.4, 7.4, 3, 1); roof.rotateZ(Math.PI / 2); roof.scale(1, 1.05, 1.05); roof.translate(0, 5.6, 0);
    paint(roof, new THREE.Color('#7d7466'));
    const chimney = paint(new THREE.BoxGeometry(0.8, 2.2, 0.8).translate(2.6, 7, 0), new THREE.Color('#c9a86a'));
    const g = mergeAll([walls_.toNonIndexed(), roof.toNonIndexed(), chimney.toNonIndexed()]); g.computeVertexNormals(); return g;
  })());
  const churchGeo = keep((() => {
    const tower = paint(new THREE.BoxGeometry(5, 18, 5).translate(0, 9, 0), new THREE.Color('#d2b072'));
    const nave = paint(new THREE.BoxGeometry(14, 7, 7).translate(9, 3.5, 0), new THREE.Color('#d6b678'));
    const nroof = new THREE.CylinderGeometry(4.6, 4.6, 14.4, 3, 1); nroof.rotateZ(Math.PI / 2); nroof.translate(9, 8.4, 0); paint(nroof, new THREE.Color('#77705f'));
    const parts = [tower.toNonIndexed(), nave.toNonIndexed(), nroof.toNonIndexed()];
    for (const [x, z] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) parts.push(paint(new THREE.BoxGeometry(0.6, 1.6, 0.6).translate(x, 18.8, z), new THREE.Color('#d2b072')).toNonIndexed()); // pinnacles
    const g = mergeAll(parts); g.computeVertexNormals(); return g;
  })());
  const cottages = [], windows = [];
  for (const cz of [-160 - rand() * 60, -480 - rand() * 80]) {
    const n = mobile ? 18 : 26;
    for (let k = 0; k < n; k++) {
      // strung along a lane that climbs the east side
      const z = cz + (rand() - 0.5) * 140, d = 38 + rand() * 75;
      const x = streamX(z) + d;
      const ry = -Math.PI / 2 + (rand() - 0.5) * 0.4; // facing across the valley
      const sc = 0.85 + rand() * 0.35;
      cottages.push({ x, z, ry, s: sc, dy: -0.6 });
      // two warm windows on the front, one on the side
      const fx = Math.sin(ry), fz = Math.cos(ry); // the front faces this way
      const gy = ground(x, z) - 0.6;
      for (const [off, hgt] of [[-1.7, 1.6], [1.7, 1.6], [-1.7, 3.4], [1.7, 3.4]]) {
        if (rand() < 0.3) continue;
        const rx = Math.cos(ry) * off * sc, rz = -Math.sin(ry) * off * sc;
        windows.push({ x: x + rx + fx * 2.65 * sc, y: gy + hgt * sc, z: z + rz + fz * 2.65 * sc, ry, s: sc, delay: rand() });
      }
    }
  }
  instanced(cottageGeo, cottages, lambert);
  const church = { x: streamX(-330) + 60, z: -330, ry: -Math.PI / 2 + 0.2, dy: -0.8 };
  instanced(churchGeo, [church], lambert);

  // windows light up as dusk falls, each in its own time
  const winGeo = keep(new THREE.PlaneGeometry(0.9, 1.0));
  const winDelay = new Float32Array(windows.length * 2);
  windows.forEach((wi, k) => { winDelay[k] = wi.delay; winDelay[k + windows.length] = wi.delay; });
  winGeo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(winDelay, 1));
  const winU = { uLit: { value: 0 }, uTime: U.uTime };
  const winMat = keep(new THREE.ShaderMaterial({
    uniforms: winU, side: THREE.DoubleSide,
    vertexShader: `attribute float aDelay; uniform float uLit; varying float vOn; varying vec2 vUv; varying float vD;
      void main(){ vOn = smoothstep(aDelay * .7, aDelay * .7 + .15, uLit); vUv = uv; vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vOn; varying vec2 vUv; varying float vD;
      void main(){
        vec2 c = abs(vUv - .5);
        float bars = step(.05, abs(vUv.x - .5)) * step(.05, abs(vUv.y - .5)); // the glazing bars
        vec3 lit = vec3(1., .72, .38) * 2.2 * bars;
        vec3 off = vec3(.05, .045, .04);
        gl_FragColor = vec4(mix(off, lit, vOn) * (1. - smoothstep(600., 1100., vD) * .6), 1.);
      }`,
  }));
  instanced(winGeo, windows.map((wi) => ({ ...wi, sv: [wi.s, wi.s, wi.s] })), winMat);

  // ------------------------------------------------------------------ the stream
  const streamGeo = keep(new THREE.PlaneGeometry(5, P * 2 + 400, 1, 600));
  streamGeo.rotateX(-Math.PI / 2); streamGeo.translate(0, 0, -P + 100);
  { const p = streamGeo.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setX(i, p.getX(i) + streamX(z)); p.setY(i, ground(streamX(z), z) + 0.25); } }
  const streamMat = keep(new THREE.MeshBasicMaterial({ color: '#cfe0f0', fog: true }));
  scene.add(new THREE.Mesh(streamGeo, streamMat));

  // ------------------------------------------------------------------ wildflowers along the path, glow-worms at night
  const FLOW = mobile ? 900 : 1500;
  const fGeo = keep(new THREE.BufferGeometry());
  const fp = new Float32Array(FLOW * 2 * 3), fc = new Float32Array(FLOW * 2 * 3);
  const palette = ['#f7d64a', '#f7d64a', '#e97aa8', '#f4f1e8', '#9a8cf0'].map((h) => new THREE.Color(h));
  for (let k = 0; k < FLOW; k++) {
    const z = -rand() * P, side = rand() < 0.5 ? -1 : 1, x = pathX(z) + side * (2.4 + rand() * 6);
    const c = palette[Math.floor(rand() * palette.length)];
    for (const [i, tile] of [[k, 0], [k + FLOW, -P]]) { fp.set([x, ground(x, z) + 0.25, z + tile], i * 3); fc.set([c.r, c.g, c.b], i * 3); }
  }
  fGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const pointU = { uScale: { value: 800 }, uDusk: U.uDusk, uTime: U.uTime };
  const flowers = new THREE.Points(fGeo, keep(new THREE.ShaderMaterial({
    uniforms: pointU, vertexColors: true, transparent: true, depthWrite: false,
    vertexShader: `uniform float uScale, uDusk; varying vec3 vCol; varying float vA;
      void main(){ vec4 mv = viewMatrix * vec4(position, 1.); float d = -mv.z; gl_PointSize = max(1., uScale * .05 / d); vCol = color * (1. - uDusk * .75); vA = smoothstep(80., 15., d) * smoothstep(1.8, 4., d); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vCol; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; if (dot(c, c) > .25) discard; gl_FragColor = vec4(vCol, vA); }`,
  })));
  flowers.frustumCulled = false;
  scene.add(flowers);

  const GLOW = 120;
  const gwGeo = keep(new THREE.BufferGeometry());
  const gp = new Float32Array(GLOW * 2 * 3), gs = new Float32Array(GLOW * 2);
  for (let k = 0; k < GLOW; k++) {
    const z = -rand() * P, x = pathX(z) + (rand() < 0.5 ? -1 : 1) * (2.5 + rand() * 4);
    for (const [i, tile] of [[k, 0], [k + GLOW, -P]]) { gp.set([x, ground(x, z) + 0.15, z + tile], i * 3); gs[i] = rand(); }
  }
  gwGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  gwGeo.setAttribute('aSeed', new THREE.BufferAttribute(gs, 1));
  const glow = new THREE.Points(gwGeo, keep(new THREE.ShaderMaterial({
    uniforms: pointU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uScale, uDusk, uTime; varying float vI;
      void main(){ vec4 mv = viewMatrix * vec4(position, 1.); float d = -mv.z; gl_PointSize = max(2., uScale * .12 / d);
        vI = smoothstep(.65, .95, uDusk) * (.55 + .45 * sin(uTime * (.4 + aSeed) + aSeed * 60.)) * smoothstep(60., 8., d); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vI; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vec3(.45, 1., .35) * vI * exp(-r * 6.) * 1.5, 1.); }`,
  })));
  glow.frustumCulled = false;
  scene.add(glow);

  // ------------------------------------------------------------------ meadow grass round about, short on the lane
  U.uPhC = { value: new THREE.Vector4(...ph) };
  const grass = makeGrass({
    count: mobile ? 14000 : 22000, box: 26, U, rand, tint: '#5f8a36',
    groundGLSL: `uniform vec4 uPhC;
      float W(float k){ return k * 6.2831853 / ${P}.; }
      float streamXg(float z){ return 18. * sin(z * W(2.) + uPhC.x) + 7. * sin(z * W(5.) + uPhC.y); }
      float groundH(float x, float z){
        float dx = x - streamXg(z), a = abs(dx);
        float side = pow(min(1., a / 230.), 1.25) * 95.;
        float combe = 1. - .35 * max(0., sin(z * W(4.) + uPhC.z + (dx > 0. ? 1.7 : 0.)));
        float roll = 3. * sin(z * W(9.) + x * .03) + 2. * sin(x * .05 + z * W(6.));
        return side * combe + roll * min(1., a / 40.) + min(a, 6.) * .15;
      }
      float pathXg(float z){ return streamXg(z) - 70. - 10. * sin(z * W(3.) + uPhC.w); }`,
    shortGLSL: 'float shortK(float x, float z){ return mix(.12, 1., smoothstep(1.6, 3.6, abs(x - pathXg(z)))); }',
  });
  keep(grass.geometry); keep(grass.material);
  scene.add(grass);

  // ------------------------------------------------------------------ the walk
  let t = 0, s0 = 20, dusk = 0, stepPh = 0, gaze = 0.35, gazeTarget = 0.35, nextGaze = 12;
  const look = new THREE.Vector3(), cam = new THREE.Vector3(), keyDir = new THREE.Vector3();
  function onEvent(ev) {
    if (ev.type === 'bell') { gazeTarget = 0.55; nextGaze = t + 14; } // turn to look across at the village when the bell rings
  }
  function update(time, dt, st) {
    t = time;
    const e = st.energy;
    U.uTime.value = t;
    pointU.uScale.value = innerHeight * Math.min(devicePixelRatio || 1, 2) / (2 * Math.tan(camera.fov * Math.PI / 360));
    const speed = 0.8 + 0.7 * e;
    s0 += speed * dt;
    if (s0 > P) s0 -= P;
    stepPh += dt * speed * 1.6;

    dusk += ((1 - e) * 1.15 - dusk) * Math.min(1, dt * 0.05);
    const dd = Math.min(1, Math.max(0, dusk));
    const L = lightAt(dd);
    U.uDusk.value = dd; U.uHorizonCol.value.copy(L.horizon); U.uZenithCol.value.copy(L.zenith); U.uSunCol.value.copy(L.sun);
    U.uSunDir.value.set(0.12, 0.09 - dd * 0.16, -1).normalize();
    hemi.color.copy(L.hemiSky); hemi.groundColor.copy(L.hemiGround); hemi.intensity = L.hemiI;
    sun.color.copy(L.sun); sun.intensity = L.sunI;
    scene.fog.color.copy(L.fog); scene.background = scene.fog.color;
    streamMat.color.copy(L.horizon).multiplyScalar(0.75).lerp(new THREE.Color('#0b1020'), dd * 0.6);
    winU.uLit.value = Math.min(1, Math.max(0, (dd - 0.25) / 0.6));

    // walk the path, looking down the valley, now and then turning to look across it
    if (t > nextGaze) { gazeTarget = 0.2 + rand() * 0.45; nextGaze = t + 18 + rand() * 20; }
    gaze += (gazeTarget - gaze) * Math.min(1, dt * 0.15);
    const z = -s0;
    cam.set(pathX(z), ground(pathX(z), z) + 1.7 + Math.abs(Math.sin(stepPh * Math.PI)) * 0.035, z);
    camera.position.copy(cam);
    const az = z - 30;
    const ahead = new THREE.Vector3(pathX(az), ground(pathX(az), az) + 1.2, az);
    const across = new THREE.Vector3(streamX(z - 40) + 70, ground(streamX(z - 40) + 70, z - 40) + 4, z - 40);
    look.copy(ahead).lerp(across, gaze);
    camera.lookAt(look);
    camera.rotateZ(Math.sin(stepPh * Math.PI) * 0.004);
    sun.position.copy(cam).addScaledVector(lightDir(U.uSunDir.value, Math.min(1, dusk), keyDir), 400); sun.target.position.copy(cam);
    sky.position.copy(cam);
    updateGrass(grass, { cam, hemi, sun, fog: scene.fog });
  }

  return {
    scene, camera, update, onEvent, portraitFov: 70,
    look: { shadows: true, toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.05, bloom: [0.45, 0.55, 0.78], finish: { vignette: 0.4, grain: 0.02, ca: 0.3 } },
    dispose() { for (const d of disposables) d.dispose?.(); },
  };
}
