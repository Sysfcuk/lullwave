// The Midnight Stables: a long aisle of loose boxes by lantern light. Horses look out over their
// half-doors, dozing, ears flicking; moonlight falls through the high windows in dusty shafts;
// hay bales are stacked at the end, saddles hang on their racks, and the yard cat sleeps curled
// on a bale, stretching now and then. We drift slowly up and down the aisle.
import { createStage, lantern, motes, box, cyl, scatter, paint, mergeAll, THREE } from '../kit.js';
import { horse, cat } from '../figures.js';
import { surface, room, moonWindow } from '../interior.js';

export function createStablesScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x57ab, bg: '#0c0906', fog: { color: '#20180f', near: 10, far: 48 }, exposure: 1.05, bloom: [0.6, 0.5, 0.6], finish: { vignette: 0.5, grain: 0.026, ca: 0.3 }, fov: 58 });
  const { rand } = S;
  const L = 26, W = 11, H = 4.6;
  room(S, { w: W, d: L, h: H, floor: surface(S, 'stone', { color: '#5a4d3e' }), walls: surface(S, 'brick', { color: '#7a5a42' }), ceiling: surface(S, 'planks', { color: '#3a2a1c' }) });
  S.add(new THREE.HemisphereLight('#8a96c0', '#5a4028', 1.5));
  const moon = new THREE.DirectionalLight('#9fb4ee', 0.35); moon.position.set(-3, 6, -4); S.add(moon);

  // roof beams
  for (let z = -L / 2 + 2; z < L / 2; z += 3) box(S, [W, 0.25, 0.3], '#2e2116', [0, H - 0.2, z]);
  box(S, [0.3, 0.3, L], '#2e2116', [0, H - 0.5, 0]);

  // the loose boxes: half-doors along both sides, dividers between, a horse in most of them
  const COATS = [['#6b3b20', '#1a1210'], ['#3a2418', '#120c0a'], ['#8a5a32', '#3a2416'], ['#b8b0a4', '#7a7068'], ['#1e1814', '#0b0807'], ['#9a6a3a', '#e8dcc0']];
  const doorWood = surface(S, 'planks', { color: '#6a4a2c' });
  const doorMat = new THREE.MeshLambertMaterial({ map: doorWood });
  const horses = [];
  let n = 0;
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const z = -8 + k * 4.4 + (side > 0 ? 0.6 : 0), x = side * 2.4;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 2.6), doorMat); door.position.set(x, 0.65, z); S.add(door);
    box(S, [0.14, 0.12, 2.7], '#3a2818', [x, 1.32, z]);
    for (const dz of [-1.35, 1.35]) { box(S, [0.16, 2.2, 0.16], '#3a2818', [x, 1.1, z + dz]); box(S, [2.8, 2.2, 0.1], '#5a3e26', [x + side * 1.45, 1.1, z + dz]); }
    if (rand() < 0.9 && n < (mobile ? 6 : 8)) {
      const [coat, mane] = COATS[(n + Math.floor(rand() * 3)) % COATS.length];
      horses.push(horse(S, { coat, mane, blaze: rand() < 0.4, socks: rand() < 0.3, pos: [side * 3.9, 0, z], ry: -side * Math.PI / 2 + (rand() - 0.5) * 0.25, mode: 'stall' }));
      n++;
    }
  }
  // lanterns hanging down the aisle
  for (const z of [-8, -1, 6]) { cyl(S, 0.01, 0.01, 0.8, '#1a1410', [0, H - 0.6, z], 4); lantern(S, { pos: [0, H - 1.1, z], color: '#ffb256', intensity: 16, distance: 11, flicker: 0.12, halo: 0.45 }); }

  // hay bales stacked at the far end, and the cat asleep on one
  const bale = paint(new THREE.BoxGeometry(1.1, 0.5, 0.55, 3, 2, 2), new THREE.Color('#c9a656'));
  { const p = bale.attributes.position; for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) * (1 + Math.sin(i * 5.1) * 0.03)); p.setY(i, p.getY(i) * (1 + Math.cos(i * 3.7) * 0.05)); } bale.computeVertexNormals(); }
  const bales = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) bales.push([-1.6 + c * 1.15 + r * 0.55, 0.25 + r * 0.5, -L / 2 + 0.6, 1, (rand() - 0.5) * 0.1]);
  bales.push([1.6, 0.25, -L / 2 + 1.9, 1, 0.5], [-0.4, 0.25, -L / 2 + 1.8, 1, -0.2]);
  scatter(S, bale, bales);
  const kitty = cat(S, { coat: '#d08a4a', stripe: '#8a4f22', belly: '#f1dcc0', pose: 'curl', pos: [-0.4, 0.5, -L / 2 + 1.8], ry: 0.6, scale: 1.1 });
  void kitty;
  // loose straw on the floor
  const straw = []; for (let k = 0; k < 160; k++) straw.push(new THREE.Vector3((rand() - 0.5) * 4.5, 0.01, (rand() - 0.5) * L * 0.9));
  { const g = new THREE.BufferGeometry(), pos = []; straw.forEach((p) => { const a = rand() * Math.PI, l = 0.15 + rand() * 0.2; pos.push(p.x, p.y, p.z, p.x + Math.cos(a) * l, p.y, p.z + Math.sin(a) * l); }); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); S.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#8a7240' }))); }

  // saddles on their racks and bridles on hooks between the boxes
  for (const [x, z] of [[-2.25, 9.3], [2.25, -5.7], [2.25, 3.1]]) {
    const s = Math.sign(x);
    box(S, [0.4, 0.08, 0.08], '#2a1d14', [x - s * 0.2, 1.3, z]);
    const sad = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), S.mat('#5a2e18')); sad.scale.set(0.8, 0.5, 1.2); sad.position.set(x - s * 0.3, 1.33, z); sad.rotation.y = Math.PI / 2; S.add(sad);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.5), S.mat('#4a2414')); flap.position.set(x - s * 0.08, 1.12, z); S.add(flap);
  }
  // buckets
  for (const [x, z] of [[-2, 4], [2, -9], [1.9, 7.5]]) cyl(S, 0.18, 0.14, 0.3, '#6d7680', [x, 0.15, z], 12);

  // high windows on the end wall and the sides: moonlight in dusty shafts
  moonWindow(S, { pos: [0, H - 1.1, L / 2 - 0.02], ry: Math.PI, w: 1.1, h: 0.9, to: [0, 0, L / 2 - 6], shaftOpacity: 0.12 });
  for (const z of [-5, 3]) moonWindow(S, { pos: [-W / 2 + 0.02, H - 0.9, z], ry: Math.PI / 2, w: 0.9, h: 0.7, to: [-0.5, 0, z + 1.5], shaftOpacity: 0.1 });
  motes(S, { kind: 'dust', count: mobile ? 260 : 420, box: [W - 1, H, L - 2], center: [0, H / 2, 0], color: '#ffe2b0', size: 0.03, speed: 0.6 });

  // a horse whinnies softly in the music: the nearest one looks up
  S.onEvent((ev) => { if (ev.type === 'horse' && horses.length) horses[Math.floor(rand() * horses.length)].nicker(); });

  // drift slowly up and down the aisle, gazing at the boxes
  const look = new THREE.Vector3();
  S.on((t, dt, st) => {
    const u = Math.sin(t * 0.018 * (0.6 + 0.4 * st.energy) - 1.2);
    const z = 7.5 - (u * 0.5 + 0.5) * 12;
    S.camera.position.set(Math.sin(t * 0.05) * 0.5, 1.75 + Math.sin(t * 0.07) * 0.08, z);
    look.set(Math.sin(t * 0.031) * 2.4, 1.4, z - 6);
    S.camera.lookAt(look);
  });
  return S.finalize({ portraitFov: 74 });
}
