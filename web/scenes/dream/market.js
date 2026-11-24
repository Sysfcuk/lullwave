// The Christmas Market: a little market in a Cotswold square on a snowy winter evening. Wooden
// stalls glow from within under strings of fairy lights, wreaths on their fronts and tiny stars
// swaying beneath their eaves; steam curls up from the food stalls; a Christmas tree stands in
// the middle, its lights twinkling and a star on top; snow lies on the roofs and falls, slowly.
import { createStage, orbitRig, nightSky, moonlight, terrain, building, lantern, smoke, motes, stringLights, glowMaterial, canvasTexture, box, cyl, THREE, TAU } from '../kit.js';

export function createMarketScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x3a5, bg: '#0a0f22', fog: { color: '#1a2140', near: 30, far: 220 }, exposure: 1.1, bloom: [0.75, 0.55, 0.55], finish: { vignette: 0.45, grain: 0.022, ca: 0.35 }, fov: 52 });
  const { rand } = S;
  nightSky(S, { top: '#060c26', horizon: '#26305a', moon: [0.5, 0.35, -0.8], moonSize: 0.045, clouds: 0.6, cloudColor: '#323a60' });
  moonlight(S, { dir: [0.5, 0.7, 0.4], color: '#aebce8', intensity: 0.8, sky: '#4a5890', ground: '#2a3048', fill: 0.75 });

  // the square: snowy cobbles
  terrain(S, { size: 300, seg: 90, height: (x, z) => (Math.hypot(x, z) > 40 ? (Math.hypot(x, z) - 40) * 0.05 : 0), color: (x, z) => (Math.hypot(x, z) < 26 ? '#c9cdd8' : '#dfe3ec') });

  // the buildings round the square, snow on their roofs
  const snowCap = (b, w, d, h, roof) => { const r = new THREE.CylinderGeometry(1, 1, w + 0.6, 3, 1); r.rotateZ(Math.PI / 2); r.scale(1, roof / 1.5 * 1.02, (d / 2 + 0.45) / 0.866); r.translate(0, h + roof / 3 + 0.12, 0); const m = new THREE.Mesh(r, S.mat('#eef1f7')); m.scale.y = 0.98; b.add(m); };
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + 0.3, r = 34 + rand() * 6, w = 8 + rand() * 5, d = 6, h = 5 + rand() * 3, roof = 3.4;
    const b = building(S, { w, d, h, roof, wall: rand() < 0.5 ? '#d8b77c' : '#cfa96a', roofCol: '#55504a', pos: [Math.cos(a) * r, 0, Math.sin(a) * r], ry: -a - Math.PI / 2, windows: [['front', -w / 4, 1.8, 1.1, 1.3], ['front', w / 4, 1.8, 1.1, 1.3], ['front', -w / 4, h - 1.4], ['front', w / 4, h - 1.4]], glow: '#ffc070' });
    snowCap(b, w, d, h, roof);
  }

  // the stalls: little wooden huts in a ring, lit inside, garlanded, with wreaths and swaying stars
  const starTex = canvasTexture(S, 64, 64, (g) => { g.fillStyle = '#ffd36a'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 30, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill(); });
  const swayers = [];
  const STALLS = mobile ? 6 : 8;
  for (let k = 0; k < STALLS; k++) {
    const a = (k / STALLS) * TAU, r = 15, x = Math.cos(a) * r, z = Math.sin(a) * r, ry = -a + Math.PI / 2;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g);
    const wood = S.mat(['#7a5232', '#6b4528', '#835a38'][k % 3]);
    for (const [w, h, d, px, py, pz] of [[3.6, 2.6, 0.15, 0, 1.3, -1.2], [0.15, 2.6, 2.4, -1.8, 1.3, 0], [0.15, 2.6, 2.4, 1.8, 1.3, 0], [3.6, 1, 0.5, 0, 0.5, 1.1]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(px, py, pz); g.add(m); }
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4.2, 3, 1).rotateZ(Math.PI / 2).scale(1, 0.9, 1.75), S.mat('#4a3020')); roof.position.y = 3.05; g.add(roof);
    const snow = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4.25, 3, 1).rotateZ(Math.PI / 2).scale(1, 0.9, 1.75), S.mat('#f0f3f8')); snow.position.y = 3.17; snow.scale.set(1, 0.97, 0.97); g.add(snow);
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.5), glowMaterial(S, ['#ffb860', '#ffcf8a', '#ff9d5c'][k % 3], 0.42, false)); inside.position.set(0, 1.85, -1.1); g.add(inside);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.7), S.mat('#c9a77a')); counter.position.set(0, 1.03, 1.1); g.add(counter);
    for (let i = 0; i < 5; i++) { const item = new THREE.Mesh(new THREE.SphereGeometry(0.1 + rand() * 0.06, 8, 6), S.mat(['#c0392b', '#e9c46a', '#2a9d8f', '#f4a261', '#8e5a3a'][Math.floor(rand() * 5)])); item.position.set(-1.4 + i * 0.7, 1.15, 1.05); g.add(item); }
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 8, 20), S.mat('#1f5a32')); wreath.position.set(0, 2.85, 1.65); g.add(wreath);
    const bow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), S.mat('#c62828')); bow.position.set(0, 2.55, 1.7); g.add(bow);
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), new THREE.MeshBasicMaterial({ map: starTex, transparent: true, side: THREE.DoubleSide, toneMapped: false })); st.position.set(-1.2 + i * 1.2, 2.25, 1.55); g.add(st); swayers.push({ m: st, ph: rand() * TAU }); }
    // fairy lights along the eaves
    const w = new THREE.Vector3(-2.1, 2.55, 1.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(g.position);
    const e = new THREE.Vector3(2.1, 2.55, 1.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(g.position);
    stringLights(S, w.toArray(), e.toArray(), { sag: 0.35, count: 14, size: 0.12 });
    if (k % 3 === 0) smoke(S, { pos: [x * 0.97, 2.4, z * 0.97], color: '#d5d8e2', rise: 4, spread: 0.9, size: 0.9, rate: 0.08, opacity: 0.14 });
  }
  S.on((t) => swayers.forEach((s) => { s.m.rotation.z = Math.sin(t * 0.8 + s.ph) * 0.25; s.m.rotation.y = Math.sin(t * 0.5 + s.ph) * 0.4; }));
  // garlands strung across the square
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; stringLights(S, [Math.cos(a) * 30, 6.5, Math.sin(a) * 30], [-Math.cos(a) * 30, 6.5, -Math.sin(a) * 30], { sag: 2.2, count: 40, size: 0.14 }); }

  // the tree in the middle
  const tree = new THREE.Group(); S.add(tree);
  for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(3 - k * 0.55, 2.6, 14), S.mat(k % 2 ? '#1c4a2c' : '#21553a')); c.position.y = 1.6 + k * 1.35; tree.add(c); }
  cyl(S, 0.3, 0.35, 1.2, '#4a3020', [0, 0.6, 0], 8);
  const lights = [];
  for (let i = 0; i < 70; i++) { const u = i / 70, y = 1 + u * 6.6, r = (1 - u) * 2.9 + 0.2, a = u * 28; lights.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  { // the tree's lights, spiralling up
    const g = new THREE.BufferGeometry(), cols = [], seeds = [];
    const pal = ['#ffd27a', '#ff6b6b', '#7ad1ff', '#fff3c9'].map((c) => new THREE.Color(c));
    g.setAttribute('position', new THREE.Float32BufferAttribute(lights.flat(), 3));
    lights.forEach((_, i) => { const c = pal[i % 4]; cols.push(c.r, c.g, c.b); seeds.push(rand()); });
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    const p = stringLights(S, [0, -50, 0], [0.1, -50, 0], { count: 2 }); p.geometry.dispose(); p.geometry = g; // reuse the twinkling bulb material
  }
  const star = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: starTex, transparent: true, toneMapped: false, color: '#ffe9a0', side: THREE.DoubleSide })); star.position.y = 8.6; S.add(star);
  S.on((t) => { star.rotation.y = t * 0.2; star.scale.setScalar(1 + Math.sin(t * 1.3) * 0.05); });
  lantern(S, { pos: [0, 9, 0], color: '#ffd27a', intensity: 6, distance: 20, body: false, halo: 2.5 });
  lantern(S, { pos: [12, 3, -6], intensity: 4, distance: 12, body: false, halo: 0.01 });
  lantern(S, { pos: [-10, 3, 8], intensity: 4, distance: 12, body: false, halo: 0.01 });

  // snow, falling slowly round the camera
  motes(S, { kind: 'snow', count: mobile ? 900 : 1600, box: [36, 18, 36], center: [0, 6, 0], color: '#ffffff', size: 0.045, speed: 0.6, follow: true });

  orbitRig(S, { center: [0, 0, 0], radius: 27, height: 5.2, speed: 0.012, lookY: 3.6, start: 0.2 });
  return S.finalize({ portraitFov: 66 });
}
