// The Moonlit Canal: a narrowboat drifting along a still canal under a starry sky. Its windows
// glow and its little chimney smokes; willows trail their fronds over the water; a hump-backed
// stone bridge crosses ahead; ducks doze on the bank (one now and then shuffles, and the water
// ripples where it does); the moon and the stars lie on the water.
import { createStage, nightSky, moonlight, terrain, water, willow, smoke, scatter, glowMaterial, canvasTexture, lantern, box, cyl, motes, treeGeo, paint, mergeAll, THREE, TAU } from '../kit.js';

export function createCanalScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xca2a, bg: '#050a1e', fog: { color: '#0e1630', near: 50, far: 380 }, exposure: 1.1, bloom: [0.7, 0.55, 0.55], finish: { vignette: 0.45, grain: 0.022, ca: 0.4 }, fov: 52 });
  const { rand } = S;
  const MOON = [-0.75, 0.22, -0.6];
  nightSky(S, { top: '#040a24', horizon: '#1d2b58', moon: MOON, moonSize: 0.05, clouds: 0.3 });
  moonlight(S, { dir: [0.4, 0.7, 0.6], color: '#b2c0ee', intensity: 1.35, sky: '#4a5c9a', ground: '#1c2436', fill: 0.85 });

  // the canal runs along x; banks rise either side, a towpath on the near one
  const height = (x, z) => { const a = Math.abs(z); return a < 6 ? -1 : a < 7 ? -1 + (a - 6) * 1.4 : 0.4 + Math.max(0, a - 40) * 0.05 + Math.sin(x * 0.04) * 0.3 * Math.min(1, (a - 7) / 10); };
  terrain(S, { size: 520, seg: mobile ? 150 : 200, height, color: (x, z) => (z > 7.2 && z < 10.6 ? '#a3977f' : Math.sin(x * 0.11 + z * 0.3) > 0.4 ? '#3c5634' : '#34502e') });
  const canal = water(S, { w: 520, d: 12.4, pos: [0, -0.45, 0], deep: '#020a14', sky: '#1d2b58', moon: MOON, glow: null });

  // the bridge: a hump of stone with parapets, crossing ahead
  const bridge = new THREE.Group(); bridge.position.set(-60, 0, 0); S.add(bridge);
  for (let k = 0; k <= 16; k++) {
    const u = k / 16, z = -9 + u * 18, y = 1 + Math.sin(u * Math.PI) * 2.2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(4, 0.7, 1.25), S.mat('#7a6f60')); b.position.set(0, y, z); b.rotation.x = -Math.cos(u * Math.PI) * 0.45; bridge.add(b);
    for (const sx of [-1.9, 1.9]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 1.25), S.mat('#857a6a')); p.position.set(sx, y + 0.6, z); p.rotation.x = b.rotation.x; bridge.add(p); }
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.5, 8, 24, Math.PI), S.mat('#6e6456')); arch.rotation.y = Math.PI / 2; arch.position.set(0, -1.6, 0); bridge.add(arch);

  // the narrowboat
  const boat = new THREE.Group(); S.add(boat);
  const hullCol = ['#1f4a3a', '#5a1f24', '#1f2f5a'][Math.floor(rand() * 3)];
  const hull = new THREE.Mesh(new THREE.BoxGeometry(18, 1.1, 2.1), S.mat(hullCol)); hull.position.y = 0.05; boat.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.6, 4, 1), S.mat(hullCol)); bow.rotation.z = Math.PI / 2; bow.rotation.x = Math.PI / 4; bow.scale.set(1, 1, 0.75); bow.position.set(-10.2, 0.05, 0); boat.add(bow); // the bow leads the way
  const rub = new THREE.Mesh(new THREE.BoxGeometry(18.1, 0.12, 2.16), S.mat('#141414')); rub.position.y = -0.3; boat.add(rub);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(18.1, 0.14, 2.14), S.mat('#c9a24a')); trim.position.y = 0.55; boat.add(trim);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(14, 1.1, 1.9), S.mat('#2f5a44')); cabin.position.set(1, 1.15, 0); boat.add(cabin);
  const band = new THREE.Mesh(new THREE.BoxGeometry(14.04, 0.42, 1.94), S.mat('#e8dcc0')); band.position.set(1, 1.2, 0); boat.add(band); // the cream panel round the windows
  const roof = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.12, 2.05), S.mat('#7a2a24')); roof.position.set(1, 1.76, 0); boat.add(roof);
  const nameTex = canvasTexture(S, 512, 96, (g, w, h) => { g.fillStyle = '#2f5a44'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e6c467'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#e6c467'; g.font = 'italic bold 56px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('The Dormouse', w / 2, h / 2 + 4); });
  const name = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshLambertMaterial({ map: nameTex, emissive: '#ffffff', emissiveMap: nameTex, emissiveIntensity: 0.22 }));
  name.position.set(5.2, 1.15, 0.965); boat.add(name);
  const winM = glowMaterial(S, '#ffb860', 1);
  for (let k = 0; k < 6; k++) for (const sz of [-0.975, 0.975]) {
    if (sz > 0 && k >= 4) continue;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 6, 18), S.mat('#c9a24a')); ring.position.set(-5 + k * 2.2, 1.2, sz * 1.002); ring.rotation.y = sz > 0 ? 0 : Math.PI; boat.add(ring);
    const wpane = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16), winM); wpane.position.set(-5 + k * 2.2, 1.2, sz); wpane.rotation.y = sz > 0 ? 0 : Math.PI; boat.add(wpane);
  }
  // on the roof: pots of flowers, a coiled rope, a water can; fenders over the side
  for (let k = 0; k < 4; k++) { const x = -4 + k * 1.4; const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 10), S.mat('#a85a3a')); pot.position.set(x, 1.94, -0.45); boat.add(pot); for (let j = 0; j < 4; j++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), S.mat(['#d84a6a', '#f0d070', '#e8e0f0', '#3f7a34'][j])); f.position.set(x + (j - 1.5) * 0.06, 2.12 + (j % 2) * 0.05, -0.45 + (j % 2 ? 0.05 : -0.05)); boat.add(f); } }
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 16), S.mat('#c9b08a')); rope.rotation.x = Math.PI / 2; rope.position.set(5.5, 1.86, 0.3); boat.add(rope);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.4, 12), S.mat('#2a5a8a')); can.position.set(3.2, 2.02, 0.45); boat.add(can);
  for (let k = 0; k < 3; k++) { const fd = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), S.mat('#2a2420')); fd.position.set(-6 + k * 5, 0.1, 1.12); boat.add(fd); }
  // the stern: an open deck, a tiller, and a lantern
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6), S.mat('#c9a24a')); tiller.rotation.z = 1.15; tiller.position.set(9.3, 1.35, 0); boat.add(tiller);
  const stern = lantern(S, { pos: [0, 0, 0], color: '#ffb35c', intensity: 2.5, distance: 7, flicker: 0.12, halo: 0.6 });
  boat.add(stern); stern.position.set(8.2, 2.05, 0.6);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.7, 10), S.mat('#141414')); stack.position.set(-3.5, 2.15, 0.3); boat.add(stack);
  const glowLight = new THREE.PointLight('#ffb05a', 3, 10, 2); glowLight.position.set(1, 1.2, 1.6); boat.add(glowLight);
  const boatSmoke = smoke(S, { pos: [0, 0, 0], color: '#8a90a8', rise: 5, spread: 1.2, size: 1.2, rate: 0.06, opacity: 0.16 });

  // the canal's stone edges
  for (const z of [-6.25, 6.25]) { const c = new THREE.Mesh(new THREE.BoxGeometry(520, 0.5, 0.55), S.mat('#8a7e6c')); c.position.set(0, -0.2, z); S.add(c); }
  // grass in tufts along both banks, and reeds with bulrushes at the water's edge
  const tuft = (() => { const parts = []; for (let k = 0; k < 7; k++) { const h = 0.28 + (k % 3) * 0.12, a = (k / 7) * TAU; const bl = new THREE.PlaneGeometry(0.05, h, 1, 2); bl.translate(0, h / 2, 0); const p = bl.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; p.setX(i, p.getX(i) * (1 - y * 0.9) + y * y * 0.12); } bl.rotateY(a); bl.translate(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05); parts.push(paint(bl, new THREE.Color(['#5f8a48', '#6e9852', '#4f7a3c'][k % 3])).toNonIndexed()); } const g = mergeAll(parts); g.computeVertexNormals(); return g; })();
  const tufts = [];
  for (let k = 0; k < (mobile ? 2600 : 4200); k++) { const x = -160 + rand() * 300, side = rand() < 0.62 ? 1 : -1, z = side * (6.6 + Math.pow(rand(), 1.4) * 10); if (side > 0 && z > 7.3 && z < 10.4 && rand() < 0.8) continue; tufts.push([x, height(x, z) - 0.02, z, 0.8 + rand() * 0.8, rand() * 6]); }
  scatter(S, tuft, tufts, S.keep(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  const reed = (() => { const parts = []; for (let k = 0; k < 6; k++) { const h = 1.1 + (k % 3) * 0.35, a = (k / 6) * TAU; const st = new THREE.CylinderGeometry(0.012, 0.02, h, 4); st.translate(Math.cos(a) * 0.12, h / 2, Math.sin(a) * 0.12); parts.push(paint(st, new THREE.Color('#5a7a3a')).toNonIndexed()); if (k % 2 === 0) { const head = new THREE.CapsuleGeometry(0.035, 0.16, 3, 6); head.translate(Math.cos(a) * 0.12, h - 0.1, Math.sin(a) * 0.12); parts.push(paint(head, new THREE.Color('#5a3a22')).toNonIndexed()); } } const g = mergeAll(parts); g.computeVertexNormals(); return g; })();
  const reeds = []; for (let k = 0; k < (mobile ? 140 : 220); k++) { const x = -160 + rand() * 300; if (rand() < 0.4) continue; reeds.push([x, -0.6, (rand() < 0.5 ? -1 : 1) * (5.75 + rand() * 0.25), 0.8 + rand() * 0.5, rand() * 6]); }
  scatter(S, reed, reeds);
  // the towpath itself: rolled gravel with worn tracks, grassy verges, and mooring bollards
  const gravel = canvasTexture(S, 256, 128, (g, w, h) => {
    g.fillStyle = '#9a8e78'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2600; k++) { const c = 120 + Math.random() * 80; g.fillStyle = `rgba(${c},${c * 0.93},${c * 0.82},.55)`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 1 + Math.random() * 2); }
    for (const y of [0.35, 0.65]) { const gr = g.createLinearGradient(0, h * (y - 0.08), 0, h * (y + 0.08)); gr.addColorStop(0, 'rgba(60,52,40,0)'); gr.addColorStop(0.5, 'rgba(60,52,40,.35)'); gr.addColorStop(1, 'rgba(60,52,40,0)'); g.fillStyle = gr; g.fillRect(0, h * (y - 0.08), w, h * 0.16); }
  });
  gravel.wrapS = THREE.RepeatWrapping; gravel.repeat.set(90, 1);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(520, 3.2), new THREE.MeshLambertMaterial({ map: gravel })); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.42, 8.9); S.add(path);
  const verge = []; for (let k = 0; k < (mobile ? 900 : 1500); k++) { const x = -160 + rand() * 300, z = rand() < 0.5 ? 7.15 + rand() * 0.3 : 10.35 + rand() * 0.4; verge.push([x, 0.4, z, 0.6 + rand() * 0.6, rand() * 6]); }
  scatter(S, tuft, verge, S.keep(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  const bollard = paint(new THREE.CylinderGeometry(0.13, 0.16, 0.5, 10).translate(0, 0.25, 0), new THREE.Color('#2a2a2a')).toNonIndexed();
  const bollards = []; for (let x = -137; x <= 140; x += 26) bollards.push([x, 0.4, 7.45, 1, 0]);
  scatter(S, bollard, bollards);

  // towpath lamps: glowing glass on iron posts; the two nearest the camera cast real light
  const lamps = [];
  for (let x = -150; x <= 140; x += 26) {
    cyl(S, 0.06, 0.09, 2.9, '#1a1a1c', [x, 0.4 + 1.45, 7.0], 8);
    box(S, [0.05, 0.05, 0.5], '#1a1a1c', [x, 3.2, 7.2]);
    lantern(S, { pos: [x, 3.0, 7.4], color: '#ffc77a', intensity: 0.001, distance: 0.1, flicker: 0.05, halo: 1.3 });
    lamps.push(x);
  }
  const lampLights = [0, 1].map(() => { const l = new THREE.PointLight('#ffc070', 14, 18, 2); S.add(l); return l; });
  S.on(() => { const cx = S.camera.position.x; const near = [...lamps].sort((p, q) => Math.abs(p - cx) - Math.abs(q - cx)); lampLights.forEach((l, k) => l.position.set(near[k], 2.9, 7.4)); });

  // willows along the far bank, and trees beyond
  for (let k = 0; k < 6; k++) willow(S, { pos: [-90 + k * 36 + rand() * 10, height(0, -10), -10.5 - rand() * 4], scale: 0.9 + rand() * 0.4 });
  const trees = [];
  for (let k = 0; k < 50; k++) { const x = (rand() - 0.5) * 400, z = (rand() < 0.5 ? -1 : 1) * (22 + rand() * 120); trees.push([x, height(x, z) - 0.3, z, 0.9 + rand() * 0.9, rand() * 6]); }
  scatter(S, treeGeo(rand, { canopy: '#1d3420', trunk: '#2a2018' }), trees);

  // ducks: most asleep on the bank, a pair floating; when one stirs, the water ripples
  const ducks = [];
  const duck = (x, y, z, ry, floating) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), S.mat(rand() < 0.5 ? '#6b5a44' : '#4a4a3e')); body.scale.set(1.3, 0.8, 0.9); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), S.mat('#1f4a2e')); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), S.mat('#c99a2a')); beak.rotation.z = -Math.PI / 2; head.add(beak); beak.position.x = 0.12;
    g.position.set(x, y, z); g.rotation.y = ry; S.add(g);
    const d = { g, head, floating, x, z, tuck: floating ? 0 : 1, stir: 0 };
    ducks.push(d); return d;
  };
  for (let k = 0; k < 5; k++) duck(-30 + k * 3.2 + rand(), 0.55, 7.4 + rand() * 0.5, rand() * TAU, false);
  for (let k = 0; k < 2; k++) duck(-14 + k * 1.4, -0.38, 3 + k * 0.6, 2.8, true);
  S.onEvent((ev) => { if (ev.type === 'duck') { const d = ducks[Math.floor(rand() * ducks.length)]; d.stir = 1; if (d.floating) canal.userData.ripple(d.g.position.x, d.g.position.z, 1); } });

  motes(S, { kind: 'firefly', count: 40, box: [120, 3, 30], center: [0, 1.5, 0], color: '#d9ff8a', size: 0.08, speed: 0.4 });

  // the boat drifts slowly along; the camera keeps pace on the towpath, swinging round a little
  let bx = 40;
  S.on((t, dt, st) => {
    bx -= dt * (0.35 + 0.35 * st.energy);
    if (bx < -140) bx = 120; // far behind the bridge and lost in the haze, it comes round again
    boat.position.set(bx, -0.35 + Math.sin(t * 0.6) * 0.03, 1.2);
    boat.rotation.z = Math.sin(t * 0.5) * 0.008;
    boatSmoke.position.set(bx - 3.5, 1.9, 1.5);
    if (Math.floor(t * 1.5) % 9 === 0) canal.userData.ripple(bx - 11, 1.2, 0.35); // the bow's gentle wake
    for (const d of ducks) {
      d.stir *= Math.exp(-dt * 0.5);
      d.head.position.set(d.tuck ? -0.05 + d.stir * 0.3 : 0.25, d.tuck ? 0.12 + d.stir * 0.1 : 0.18, 0);
      if (d.floating) { d.g.position.y = -0.38 + Math.sin(t * 0.8 + d.x) * 0.02; d.g.position.x = d.x + Math.sin(t * 0.03 + d.z) * 3; }
    }
  });
  const target = new THREE.Vector3();
  S.on((t, dt, st) => {
    const a = Math.sin(t * 0.01) * 0.5;
    target.set(bx - 2, 0.5, 0);
    S.camera.position.set(bx + 14 + Math.sin(a) * 7, 2.6 + Math.sin(t * 0.07) * 0.15, 9.4 + Math.cos(a) * 1.0);
    S.camera.lookAt(target.x - 6, 0.2, target.z - 2.2);
  });
  return S.finalize({ portraitFov: 66 });
}
