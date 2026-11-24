// The Woolpack at Dusk: an old stone pub on a Cotswold hillside as the sky goes from rose to
// indigo. Warm light flickers in its windows (the fire's going inside), smoke curls from the
// chimney, the painted sign creaks gently on its bracket, a footpath winds up to the door past
// a few tables on the terrace, and the village's cottages and the hills fall away behind.
import { createStage, orbitRig, terrain, building, lantern, smoke, scatter, canvasTexture, box, cyl, treeGeo, THREE, TAU } from '../kit.js';
import { makeSky, lightAt, lightDir } from '../country.js';

export function createWoolpackScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x3001, bg: '#2a2140', fog: { color: '#6a5470', near: 70, far: 520 }, exposure: 1.05, bloom: [0.6, 0.55, 0.62], finish: { vignette: 0.42, grain: 0.022, ca: 0.3 }, fov: 52 });
  const { rand } = S;
  // the dusk sky and its light, deepening with the night
  const U = { uDusk: { value: 0.5 }, uTime: S.U.uTime, uSunDir: { value: new THREE.Vector3(-0.5, 0.02, -1).normalize() }, uHorizonCol: { value: new THREE.Color() }, uZenithCol: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() } };
  const sky = makeSky(U); sky.renderOrder = -1; S.add(sky);
  const hemi = new THREE.HemisphereLight('#fff', '#444', 1); S.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 1); S.add(sun); S.add(sun.target);
  let dusk = 0.5;
  const kd = new THREE.Vector3();
  S.on((t, dt, st) => {
    dusk += ((0.5 + (1 - st.energy) * 0.55) - dusk) * Math.min(1, dt * 0.05);
    const d = Math.min(1, dusk), L = lightAt(d);
    U.uDusk.value = d; U.uHorizonCol.value.copy(L.horizon); U.uZenithCol.value.copy(L.zenith); U.uSunCol.value.copy(L.sun);
    hemi.color.copy(L.hemiSky); hemi.groundColor.copy(L.hemiGround); hemi.intensity = L.hemiI + 0.15;
    sun.color.copy(L.sun); sun.intensity = L.sunI * 0.8;
    sun.position.copy(S.camera.position).addScaledVector(lightDir(U.uSunDir.value, d, kd), 300); sun.target.position.copy(S.camera.position);
    S.scene.fog.color.copy(L.fog); S.scene.background = S.scene.fog.color;
    sky.position.copy(S.camera.position);
  });

  // the hillside: the pub on a shelf, the village below, hills beyond
  // the ground falls away in front of the pub and rises gently to rolling hills behind
  const height = (x, z) => (z < 0 ? Math.min(-z * 0.07, 14 + 4 * Math.sin(x * 0.02)) : -z * 0.07) + 2.4 * Math.sin(x * 0.03) * Math.cos(z * 0.025);
  const pathX = (z) => 4 + Math.sin(z * 0.06) * 6;
  terrain(S, { size: 700, seg: mobile ? 130 : 180, height, color: (x, z) => (Math.abs(x - pathX(z)) < 1.2 && z > 4 && z < 80 ? '#7d6e55' : z < -100 ? '#3e5a30' : '#4a6a36') });
  const gy = (x, z) => height(x, z);

  // the pub
  const pubY = gy(0, 0);
  const pub = building(S, { w: 14, d: 8, h: 5.2, roof: 3.4, wall: '#c9a368', roofCol: '#5d5650', pos: [0, pubY - 0.4, 0], windows: [['front', -4.5, 1.7, 1.3, 1.1], ['front', 4.5, 1.7, 1.3, 1.1], ['front', -4.5, 4, 1.1, 0.9], ['front', 0, 4, 1.1, 0.9], ['front', 4.5, 4, 1.1, 0.9], ['right', 0, 1.8, 1.2, 1]], glow: '#ffae55', doorCol: '#3b2516' });
  // the fire glows brighter in the ground-floor windows
  const fireGlow = new THREE.PointLight('#ff9a4a', 5, 9, 2); fireGlow.position.set(-4.5, pubY + 1.6, 3); S.add(fireGlow);
  S.on((t) => { fireGlow.intensity = 4 + Math.sin(t * 5.3) * 0.6 + Math.sin(t * 11.7) * 0.4 + Math.sin(t * 2.1) * 0.5; });
  smoke(S, { pos: [0 + 14 * 0.32, pubY + 5.2 + 3.4 + 0.8, 0], color: '#b4a6b0', rise: 7, spread: 1.4, size: 1.6, rate: 0.05, opacity: 0.2 });
  lantern(S, { pos: [1.1, pubY + 2.6, 4.4], intensity: 4, distance: 10, halo: 1.3 });

  // the painted sign, swinging slowly on its bracket
  const signTex = canvasTexture(S, 256, 320, (g, w, h) => {
    g.fillStyle = '#2b3b2a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8a24a'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#d9c38a'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.fillText('THE', w / 2, 58); g.font = 'bold 40px Georgia, serif'; g.fillText('WOOLPACK', w / 2, 276);
    // a fat sheep with a sack of wool
    g.fillStyle = '#efe8d8'; for (const [x, y, r] of [[100, 160, 34], [140, 150, 38], [175, 165, 30], [120, 185, 30], [160, 188, 28]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.fillStyle = '#2a2420'; g.beginPath(); g.ellipse(70, 160, 18, 14, -0.3, 0, TAU); g.fill(); g.fillRect(105, 205, 8, 26); g.fillRect(160, 205, 8, 26);
  });
  const signPivot = new THREE.Group(); signPivot.position.set(-6.6, pubY + 4.4, 6); S.add(signPivot);
  cyl(S, 0.12, 0.14, 4.6, '#2a1d14', [-6.6, pubY + 2.1, 6], 8);
  box(S, [1.8, 0.1, 0.1], '#2a1d14', [-5.8, pubY + 4.5, 6]);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.75), new THREE.MeshLambertMaterial({ map: signTex, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.12 }));
  sign.position.set(0.8, -1, 0); sign.rotation.y = -0.6; signPivot.add(sign);
  S.on((t) => { signPivot.rotation.z = Math.sin(t * 0.55) * 0.06; signPivot.rotation.x = Math.sin(t * 0.4) * 0.05; });

  // the footpath winding up to the door
  {
    const pts = [], col = [];
    const c = new THREE.Color('#8a7a5e');
    for (let k = 0; k <= 80; k++) {
      const z = 5 + k * 0.9, x = pathX(z), wdt = 1 + Math.sin(k * 0.7) * 0.15;
      for (const sx of [-wdt, wdt]) { pts.push(x + sx, gy(x + sx, z) + 0.06, z); col.push(c.r, c.g, c.b); }
    }
    const idx = [];
    for (let k = 0; k < 80; k++) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    S.add(new THREE.Mesh(g, S.vmat));
  }

  // tables on the terrace, a couple of pints left out
  for (const [x, z] of [[-6, 9], [-1.5, 10.5], [6, 9.5]]) {
    const y = gy(x, z);
    box(S, [2.2, 0.08, 0.9], '#6b4a30', [x, y + 0.75, z]);
    for (const dz of [-0.75, 0.75]) box(S, [2.2, 0.06, 0.3], '#6b4a30', [x, y + 0.45, z + dz]);
    for (const dx of [-0.9, 0.9]) box(S, [0.08, 0.75, 0.9], '#5a3e28', [x + dx, y + 0.37, z]);
    if (rand() < 0.8) { const p = cyl(S, 0.05, 0.045, 0.16, '#c8862e', [x + 0.4, y + 0.87, z], 10); p.material = new THREE.MeshLambertMaterial({ color: '#c8862e', emissive: '#4a2a08' }); }
  }

  // the village below and around, and trees
  for (let k = 0; k < (mobile ? 12 : 18); k++) {
    const x = (rand() - 0.5) * 140, z = 22 + rand() * 80; if (Math.abs(x - pathX(z)) < 6) continue;
    building(S, { w: 6 + rand() * 4, d: 5, h: 4.2, roof: 3, wall: rand() < 0.5 ? '#d2ae72' : '#c49e62', roofCol: '#5f5a52', pos: [x, gy(x, z) - 0.5, z], ry: (rand() - 0.5) * 0.6 + Math.PI, windows: [['front', -1.5, 1.6], ['front', 1.5, 1.6], ['front', 0, 3.4]], lit: rand() < 0.7 ? 1 : 0.15 });
  }
  const trees = [];
  for (let k = 0; k < 60; k++) { const x = (rand() - 0.5) * 300, z = -30 - rand() * 200 + (rand() < 0.3 ? 120 : 0); trees.push([x, gy(x, z) - 0.3, z, 1 + rand() * 0.8, rand() * 6]); }
  scatter(S, treeGeo(rand, { canopy: '#3a5428', trunk: '#3a2a1e' }), trees);

  orbitRig(S, { center: [0, pubY + 2, 2], radius: 26, height: pubY + 6, speed: 0.012, lookY: pubY + 2.6, start: 0.25, arc: 0.6 });
  return S.finalize({ portraitFov: 66 });
}
