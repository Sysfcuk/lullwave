// The Moonlit Canal: a narrowboat drifting along a still canal under a starry sky. Its windows
// glow and its little chimney smokes; willows trail their fronds over the water; a hump-backed
// stone bridge crosses ahead; ducks doze on the bank (one now and then shuffles, and the water
// ripples where it does); the moon and the stars lie on the water.
import { createStage, orbitRig, nightSky, moonlight, terrain, water, willow, smoke, scatter, glowMaterial, canvasTexture, box, cyl, motes, treeGeo, THREE, TAU } from '../kit.js';

export function createCanalScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xca2a, bg: '#050a1e', fog: { color: '#0e1630', near: 50, far: 380 }, exposure: 1.1, bloom: [0.7, 0.55, 0.55], finish: { vignette: 0.45, grain: 0.022, ca: 0.4 }, fov: 52 });
  const { rand } = S;
  const MOON = [-0.75, 0.22, -0.6];
  nightSky(S, { top: '#040a24', horizon: '#1d2b58', moon: MOON, moonSize: 0.05, clouds: 0.3 });
  moonlight(S, { dir: [0.4, 0.7, 0.6], color: '#b2c0ee', intensity: 1.2, sky: '#43538e', ground: '#11172a', fill: 0.7 });

  // the canal runs along x; banks rise either side, a towpath on the near one
  const height = (x, z) => { const a = Math.abs(z); return a < 6 ? -1 : a < 7 ? -1 + (a - 6) * 1.4 : 0.4 + Math.max(0, a - 40) * 0.05 + Math.sin(x * 0.04) * 0.3 * Math.min(1, (a - 7) / 10); };
  terrain(S, { size: 520, seg: mobile ? 150 : 200, height, color: (x, z) => (z > 7.5 && z < 10 ? '#5a5244' : '#2a3e26') });
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
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.4, 4, 1), S.mat(hullCol)); bow.rotation.z = -Math.PI / 2; bow.rotation.x = Math.PI / 4; bow.scale.set(1, 1, 0.75); bow.position.set(10.1, 0.05, 0); boat.add(bow);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(18.1, 0.16, 2.14), S.mat('#c9a24a')); trim.position.y = 0.55; boat.add(trim);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(14, 1.1, 1.9), S.mat('#2a3a30')); cabin.position.set(-1, 1.15, 0); boat.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.12, 2.05), S.mat('#3a2a22')); roof.position.set(-1, 1.76, 0); boat.add(roof);
  const nameTex = canvasTexture(S, 512, 96, (g, w, h) => { g.fillStyle = '#2a3a30'; g.fillRect(0, 0, w, h); g.fillStyle = '#e6c467'; g.font = 'italic bold 56px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('The Dormouse', w / 2, h / 2 + 4); });
  const name = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.85), new THREE.MeshLambertMaterial({ map: nameTex, emissive: '#ffffff', emissiveMap: nameTex, emissiveIntensity: 0.15 }));
  name.position.set(3.4, 1.15, 0.96); boat.add(name);
  const winM = glowMaterial(S, '#ffb860', 1);
  for (let k = 0; k < 6; k++) for (const sz of [-0.96, 0.96]) {
    if (sz > 0 && k >= 4) continue;
    const wpane = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), winM); wpane.position.set(-7 + k * 2.2, 1.2, sz); wpane.rotation.y = sz > 0 ? 0 : Math.PI; boat.add(wpane);
  }
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.7, 10), S.mat('#141414')); stack.position.set(-5.5, 2.15, 0.3); boat.add(stack);
  const glowLight = new THREE.PointLight('#ffb05a', 3, 10, 2); glowLight.position.set(-1, 1.2, 1.6); boat.add(glowLight);
  const boatSmoke = smoke(S, { pos: [0, 0, 0], color: '#8a90a8', rise: 5, spread: 1.2, size: 1.2, rate: 0.06, opacity: 0.16 });

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
    boatSmoke.position.set(bx - 5.5, 1.9, 1.5);
    if (Math.floor(t * 1.5) % 9 === 0) canal.userData.ripple(bx + 10.5, 1.2, 0.35); // the bow's gentle wake
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
    S.camera.position.set(bx + 13 + Math.sin(a) * 7, 1.7 + Math.sin(t * 0.07) * 0.15, 9.2 + Math.cos(a) * 1.2);
    S.camera.lookAt(target.x - 8, 0.1, target.z - 3);
  });
  return S.finalize({ portraitFov: 66 });
}
