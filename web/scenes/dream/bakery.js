// The Great Bread Bake: a village bakery in the small hours. The oven glows, loaves cool on the
// racks with steam curling off them, shelves are stacked with bread of every shape, the big
// table is dusted with flour and a ball of dough slowly rises on it. Flour hangs in the warm air
// like snow, and the bakery cat sleeps in front of the oven. Every so often, a fresh loaf
// appears on the cooling rack.
import { createStage, motes, smoke, glowMaterial, canvasTexture, box, cyl, THREE, TAU } from '../kit.js';
import { cat } from '../figures.js';
import { surface, room, moonWindow, fire, candle } from '../interior.js';

const CRUST = ['#b8742e', '#a8622a', '#c98a3a', '#8a4e22', '#d0a050'];
function loaf(S, kind, col) {
  let geo;
  if (kind === 'baguette') geo = new THREE.CapsuleGeometry(0.05, 0.5, 4, 10).rotateZ(Math.PI / 2);
  else if (kind === 'round') geo = new THREE.SphereGeometry(0.14, 14, 10).scale(1, 0.62, 1);
  else if (kind === 'plait') geo = new THREE.TorusKnotGeometry(0.09, 0.035, 40, 6, 2, 3).scale(1.4, 0.5, 0.7).rotateX(Math.PI / 2);
  else geo = new THREE.CapsuleGeometry(0.1, 0.16, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.75, 1); // tin loaf / bloomer
  const m = new THREE.Mesh(geo, S.mat(col)); S.add(m); return m;
}

export function createBakeryScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xb4ce, bg: '#0e0a06', fog: { color: '#1c140c', near: 6, far: 30 }, exposure: 1.1, bloom: [0.65, 0.55, 0.58], finish: { vignette: 0.48, grain: 0.024, ca: 0.3 }, fov: 58 });
  const { rand } = S;
  const W = 10, D = 9, H = 3.4;
  room(S, { w: W, d: D, h: H, floor: surface(S, 'stone', { color: '#6a5a48' }), walls: surface(S, 'plaster', { color: '#c9b08a' }), ceiling: surface(S, 'planks', { color: '#3e2c1c' }) });
  S.add(new THREE.HemisphereLight('#a0a0c0', '#5a3c24', 1.2));
  for (let z = -3.5; z <= 3.5; z += 1.75) box(S, [W, 0.2, 0.22], '#2e2116', [0, H - 0.12, z]);

  // the oven: a big brick range in the back wall with an iron door glowing round the edges
  const oz = -D / 2 + 0.6;
  const oven = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 1.2), new THREE.MeshLambertMaterial({ map: surface(S, 'brick', { color: '#9a5a3a', repeat: [2, 2] }) })); oven.position.set(0, 1.1, oz); S.add(oven);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), glowMaterial(S, '#ff8a3a', 0.9, false)); mouth.position.set(0, 1.05, oz + 0.61); S.add(mouth);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.04), S.mat('#1e1a18')); door.position.set(0, 1.05, oz + 0.64); door.rotation.x = -0.18; S.add(door);
  for (const x of [-0.35, 0.35]) cyl(S, 0.02, 0.02, 0.08, '#c9a24a', [x, 1.25, oz + 0.7], 6);
  fire(S, { pos: [0, 0.35, oz + 0.5], width: 1.2, intensity: 12, distance: 12, flames: 5 });
  box(S, [1.4, 0.4, 0.04], '#140e0a', [0, 0.38, oz + 0.61]);
  box(S, [3.6, 0.12, 1.4], '#7a4a32', [0, 2.26, oz + 0.05]);
  // the peel and tools hanging beside it
  const peel = new THREE.Group(); peel.position.set(1.95, 1.3, oz + 0.3); peel.rotation.z = 0.1; S.add(peel);
  { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.02), S.mat('#b08a5a')); b.position.y = -0.5; peel.add(b); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4), S.mat('#9a7448')); h.position.y = 0.4; peel.add(h); }

  // the bakery cat, asleep in the warmth
  cat(S, { coat: '#e8e0d4', stripe: '#c9a27a', belly: '#f8f4ee', pose: 'curl', pos: [-1.1, 0, oz + 1.25], ry: 2.2, scale: 1.15 });
  const mat = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), S.mat('#7a3a2a')); mat.rotation.x = -Math.PI / 2; mat.position.set(-1.1, 0.008, oz + 1.25); S.add(mat);

  // shelves of bread down both side walls
  const shelfLoaves = [];
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - 0.3);
    box(S, [0.5, 2.4, 3.6], '#4a3020', [x + side * 0.02, 1.2, 0]);
    for (let sh = 0; sh < 4; sh++) {
      box(S, [0.55, 0.05, 3.6], '#6a4630', [x - side * 0.03, 0.4 + sh * 0.55, 0]);
      for (let k = 0; k < 7; k++) {
        const kind = ['round', 'tin', 'baguette', 'plait'][Math.floor(rand() * 4)];
        const l = loaf(S, kind, CRUST[Math.floor(rand() * CRUST.length)]);
        l.position.set(x - side * 0.08, 0.5 + sh * 0.55, -1.5 + k * 0.5 + (rand() - 0.5) * 0.1);
        l.rotation.y = kind === 'baguette' ? Math.PI / 2 + (rand() - 0.5) * 0.3 : rand() * TAU;
        shelfLoaves.push(l);
      }
    }
  }
  // a basket of baguettes by the door
  cyl(S, 0.3, 0.24, 0.5, '#8a6a3a', [3.6, 0.25, 3.4], 14);
  for (let k = 0; k < 6; k++) { const b = loaf(S, 'baguette', CRUST[k % 3]); b.position.set(3.6 + (rand() - 0.5) * 0.2, 0.7, 3.4 + (rand() - 0.5) * 0.2); b.rotation.set(0, rand() * TAU, Math.PI / 2 + (rand() - 0.5) * 0.5); }

  // the cooling rack: fresh loaves steaming, and a new one appears now and then
  const rackX = 2.4, rackZ = -1.8;
  for (let lv = 0; lv < 4; lv++) {
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7, 10, 5), new THREE.MeshBasicMaterial({ color: '#4a4440', wireframe: true })); grid.rotation.x = -Math.PI / 2; grid.position.set(rackX, 0.35 + lv * 0.45, rackZ); S.add(grid);
  }
  for (const [dx, dz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) cyl(S, 0.02, 0.02, 1.8, '#3a3634', [rackX + dx, 0.9, rackZ + dz], 6);
  const rackSlots = []; for (let lv = 0; lv < 4; lv++) for (let k = 0; k < 4; k++) rackSlots.push([rackX - 0.5 + k * 0.33, 0.36 + lv * 0.45, rackZ + (rand() - 0.5) * 0.15]);
  const rackLoaves = rackSlots.map(([x, y, z], i) => { const l = loaf(S, i % 3 ? 'round' : 'tin', CRUST[i % CRUST.length]); l.position.set(x, y + 0.07, z); l.rotation.y = rand() * TAU; l.scale.setScalar(i % 4 === 3 ? 0.001 : 1); return l; });
  smoke(S, { pos: [rackX, 1.9, rackZ], color: '#f2ebe0', rise: 1.2, spread: 0.6, size: 0.5, rate: 0.06, opacity: 0.08 });
  let nextLoaf = 18 + rand() * 12, growing = null, g0 = 0;
  S.on((t) => {
    if (t > nextLoaf && !growing) {
      const empty = rackLoaves.filter((l) => l.scale.x < 0.01);
      if (empty.length) { growing = empty[Math.floor(rand() * empty.length)]; g0 = t; }
      else rackLoaves[Math.floor(rand() * rackLoaves.length)].scale.setScalar(0.001); // sold!
      nextLoaf = t + 30 + rand() * 25;
    }
    if (growing) { const f = Math.min(1, (t - g0) / 5); growing.scale.setScalar(0.001 + (1 - Math.pow(1 - f, 3)) * 0.999); if (f >= 1) growing = null; }
  });

  // the big table, floury, with a ball of dough rising slowly and a rolling pin
  box(S, [2.6, 0.08, 1.3], '#a8865a', [-0.4, 0.92, 0.6]);
  for (const [dx, dz] of [[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]]) box(S, [0.1, 0.88, 0.1], '#6a4a30', [-0.4 + dx, 0.44, 0.6 + dz]);
  const flourTex = canvasTexture(S, 256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(255,252,244,${Math.random() * 0.5})`; const r = Math.random() * 6; g.beginPath(); g.arc(w / 2 + (Math.random() - 0.5) * w * Math.random(), h / 2 + (Math.random() - 0.5) * h * Math.random(), r, 0, TAU); g.fill(); } });
  const flour = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshLambertMaterial({ map: flourTex, transparent: true, depthWrite: false })); flour.rotation.x = -Math.PI / 2; flour.position.set(-0.4, 0.965, 0.6); S.add(flour);
  const dough = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), S.mat('#f1e2c4')); dough.position.set(-0.8, 1.04, 0.55); S.add(dough);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 10, 0, TAU, Math.PI / 2, Math.PI / 2), S.mat('#c9d4dc', { side: THREE.DoubleSide })); bowl.position.set(0.35, 1.25, 0.45); S.add(bowl);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 10), S.mat('#c9a070')); pin.rotation.set(0, 0.4, Math.PI / 2); pin.position.set(-0.1, 1.01, 0.95); S.add(pin);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), S.mat('#9a7448')); h.rotation.set(0, 0.4, Math.PI / 2); h.position.set(-0.1 + s * Math.cos(0.4) * 0.37, 1.01, 0.95 - s * Math.sin(0.4) * 0.37); S.add(h); }
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), S.mat('#d8ccb0')); sack.scale.set(1, 1.3, 0.85); sack.position.set(-2.4, 0.42, 1.6); S.add(sack);
  S.on((t) => { const r = 1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.06)); dough.scale.set(r, 0.62 * r, r); });
  candle(S, { pos: [0.9, 0.96, 0.95], h: 0.18, light: true, intensity: 1.6, distance: 5 });

  // a window by the door, the moon, and flour drifting in the warm air
  const winTex = canvasTexture(S, 128, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0e1838'); gr.addColorStop(1, '#2e3e6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#f4efd8'; g.beginPath(); g.arc(40, 44, 14, 0, TAU); g.fill(); g.fillStyle = '#1a2030'; g.fillRect(0, h * 0.75, w, h); g.fillStyle = '#ffcf7a'; g.fillRect(84, h * 0.8, 10, 10); g.fillStyle = '#2a1e16'; g.fillRect(w / 2 - 3, 0, 6, h); g.fillRect(0, h / 2 - 3, w, 6); });
  moonWindow(S, { pos: [-1.8, 1.8, D / 2 - 0.02], ry: Math.PI, w: 1.2, h: 1.5, tex: winTex, to: [-1.2, 0, 1.4], shaftOpacity: 0.1 });
  motes(S, { kind: 'flour', count: mobile ? 360 : 600, box: [W - 1, H - 0.4, D - 1], center: [0, H / 2, 0], color: '#fff4e0', size: 0.018, speed: 0.6 });

  // drift slowly round the table
  let ang = 0;
  S.on((t, dt, st) => {
    ang += dt * 0.011 * (0.55 + 0.45 * st.energy);
    const A = Math.sin(ang) * 0.75;
    S.camera.position.set(Math.sin(A) * 3.6, 1.85 + Math.sin(t * 0.05) * 0.08, 0.6 + Math.cos(A) * 3.6);
    S.camera.lookAt(Math.sin(A) * 0.5, 1, -1.4);
  });
  return S.finalize({ portraitFov: 76 });
}
