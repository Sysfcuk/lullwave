// The Rivals Estate: a preposterously grand country house by moonlight. A pale stone manor with
// a columned portico and a great many lit windows (people still up somewhere, lights coming
// and going), a fountain crowned by a gilded horse (which, if you watch closely, is breathing),
// a parterre of clipped box, topiary, a striped lawn with a helipad, a pool with a flamingo
// drifting on it, an immaculate tennis court where a stray ball now and then rolls by, and the
// stable block with its clock tower beyond. Clouds slide across the moon.
import { createStage, orbitRig, nightSky, moonlight, terrain, building, lantern, motes, scatter, water, canvasTexture, board, box, cyl, treeGeo, pineGeo, THREE, TAU } from '../kit.js';
import { horse } from '../figures.js';

export function createEstateScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xe57a, bg: '#070a1c', fog: { color: '#121a36', near: 90, far: 600 }, exposure: 1.1, bloom: [0.65, 0.55, 0.6], finish: { vignette: 0.4, grain: 0.02, ca: 0.35 }, fov: 50 });
  const { rand } = S;
  const sky = nightSky(S, { top: '#050a22', horizon: '#223060', moon: [-0.35, 0.3, -1], moonSize: 0.05, clouds: 0.75, cloudColor: '#2c3666' });
  moonlight(S, { dir: [-0.2, 0.8, 0.7], color: '#b8c6f2', intensity: 1.25, sky: '#4a5a9c', ground: '#141a2c', fill: 0.7 });

  // the lawn, mown in stripes, and the gravel sweep
  terrain(S, {
    size: 800, seg: mobile ? 90 : 130, height: (x, z) => (Math.hypot(x, z) > 120 ? (Math.hypot(x, z) - 120) * 0.06 : 0),
    color: () => '#2c4526',
  });
  // the lawn in front of the house, mown in perfect stripes, and the gravel sweep round the fountain
  const stripes = canvasTexture(S, 64, 64, (g) => { g.fillStyle = '#2f4d29'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#3e6534'; g.fillRect(0, 0, 32, 64); });
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping; stripes.repeat.set(14, 1);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(130, 90), new THREE.MeshLambertMaterial({ map: stripes })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.02, 30); S.add(lawn);
  const sweep = new THREE.Mesh(new THREE.RingGeometry(7.5, 12, 64), S.mat('#8a857a')); sweep.rotation.x = -Math.PI / 2; sweep.position.set(0, 0.04, 18); S.add(sweep);
  box(S, [5, 0.05, 20], '#8a857a', [0, 0.03, 3]);

  // the house: a central block with a portico, two wings, rows of lit windows
  const rows = (w, n, ys) => ys.flatMap((y) => Array.from({ length: n }, (_, i) => ['front', -w / 2 + (i + 0.5) * (w / n), y, 1.2, 1.8]));
  const main = building(S, { w: 26, d: 12, h: 10, roof: 4, wall: '#d8ccb2', roofCol: '#4b4a52', pos: [0, 0, -8], windows: rows(26, 8, [2.6, 6.8]), glow: '#ffc27a', doorCol: '#2a2420' });
  const wings = [-1, 1].map((sx) => building(S, { w: 13, d: 10, h: 7.5, roof: 3.2, wall: '#d2c6aa', roofCol: '#4b4a52', pos: [sx * 19.5, 0, -7], windows: rows(13, 4, [2.4, 5.6]), glow: '#ffbd70', door: null, chimney: rand() < 0.7 }));
  for (let k = 0; k < 4; k++) cyl(S, 0.42, 0.48, 8.6, '#e6dcc6', [-4.5 + k * 3, 4.3, -1.2], 14);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 11, 3).rotateZ(Math.PI / 2).scale(1, 1.4, 1.6), S.mat('#e2d8c0'));
  ped.position.set(0, 9.6, -1.4); S.add(ped);
  box(S, [12, 0.5, 4], '#cfc3a9', [0, 8.85, -1.3]);
  // lights in the house come and go, room by room
  const glows = [main, ...wings].flatMap((b) => b.children.filter((c) => c.material?.userData?.u)).map((c) => c.material);
  const uniqueGlows = [...new Set(glows)];
  S.on((t) => uniqueGlows.forEach((m, k) => { m.userData.u.uLevel.value = 0.75 + 0.25 * Math.sin(t * 0.05 + k * 2.1); }));

  // the fountain, crowned by a gilded horse that is (quietly) alive
  cyl(S, 6, 6.2, 0.7, '#cfc3a9', [0, 0.35, 18], 40);
  const pool = water(S, { w: 11.4, pos: [0, 0.72, 18], deep: '#03101c', sky: '#2a3a6a', moon: [-0.35, 0.3, -1], round: true });
  cyl(S, 1.4, 1.8, 2.2, '#cfc3a9', [0, 1.1, 18], 24);
  cyl(S, 2.6, 2.4, 0.3, '#cfc3a9', [0, 2.3, 18], 24);
  cyl(S, 0.5, 0.7, 1.2, '#cfc3a9', [0, 2.9, 18], 16);
  const gold = horse(S, { coat: '#c8a24a', mane: '#a8862e', pos: [0, 3.5, 18], ry: Math.PI, mode: 'rest', scale: 0.9 });
  motes(S, { kind: 'spark', count: 160, box: [3.4, 3.2, 3.4], center: [0, 3.6, 18], color: '#9cc8ff', size: 0.05, speed: 0.6 }); // the spray, catching the moon
  S.on((t) => { if (Math.floor(t * 0.7) % 3 === 0) pool.userData.ripple((Math.sin(t) * 2), 18 + Math.cos(t * 1.3) * 2, 0.4); });
  lantern(S, { pos: [-7, 3.2, 10], intensity: 5, distance: 16, halo: 1.5 });
  lantern(S, { pos: [7, 3.2, 10], intensity: 5, distance: 16, halo: 1.5 });
  for (const sx of [-7, 7]) cyl(S, 0.08, 0.1, 3, '#1c1a18', [sx, 1.5, 10], 8);

  // the parterre and the topiary
  const hedge = '#1f3b22';
  for (const sx of [-1, 1]) {
    for (const [w, d, x, z] of [[14, 1, 22, 12], [14, 1, 22, 24], [1, 13, 15, 18], [1, 13, 29, 18], [6, 1, 22, 18], [1, 6, 22, 18]]) box(S, [w, 0.9, d], hedge, [sx * x, 0.45, z]);
    for (const [x, z] of [[15.5, 12.5], [28.5, 12.5], [15.5, 23.5], [28.5, 23.5]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 12), S.mat('#22452a')); cone.position.set(sx * x, 1.6, z); S.add(cone);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), S.mat('#22452a')); ball.position.set(sx * 22, 1.2, 18); S.add(ball);
  }

  // the pool, with loungers and a flamingo drifting about
  const poolW = water(S, { w: 18, d: 8, pos: [24, 0.08, 44], deep: '#03222e', sky: '#2a4a7a', moon: [-0.35, 0.3, -1], glow: '#1b8fae' });
  box(S, [20, 0.2, 10], '#d9d2c2', [24, -0.04, 44]);
  for (let k = 0; k < 4; k++) { const l = box(S, [0.8, 0.3, 2], '#f2efe8', [17 + k * 3, 0.25, 50]); l.rotation.x = -0.1; }
  const flamingo = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.22, 10, 24), S.mat('#ff7ab4')); ring.rotation.x = Math.PI / 2; flamingo.add(ring);
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.09, 8, 16, Math.PI * 1.2), S.mat('#ff7ab4')); neck.position.set(0.55, 0.4, 0); neck.rotation.z = -0.3; flamingo.add(neck);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), S.mat('#2a1a1a')); beak.position.set(0.85, 0.78, 0); beak.rotation.z = -1.6; flamingo.add(beak);
  S.add(flamingo);
  S.on((t) => { flamingo.position.set(24 + Math.sin(t * 0.045) * 6.5, 0.22 + Math.sin(t * 0.9) * 0.03, 44 + Math.sin(t * 0.07) * 2.2); flamingo.rotation.y = t * 0.03; if (Math.floor(t * 2) % 7 === 0) poolW.userData.ripple(flamingo.position.x, flamingo.position.z, 0.3); });

  // the tennis court: immaculate, of course, with a ball that wanders across now and then
  const courtTex = canvasTexture(S, 256, 512, (g, w, h) => {
    g.fillStyle = '#2f6b4c'; g.fillRect(0, 0, w, h); g.fillStyle = '#3d7d5b'; g.fillRect(28, 32, w - 56, h - 64);
    g.strokeStyle = '#f4f4ee'; g.lineWidth = 4; g.strokeRect(28, 32, w - 56, h - 64); g.strokeRect(56, 32, w - 112, h - 64);
    g.beginPath(); g.moveTo(56, h / 2 - 120); g.lineTo(w - 56, h / 2 - 120); g.moveTo(56, h / 2 + 120); g.lineTo(w - 56, h / 2 + 120); g.moveTo(w / 2, h / 2 - 120); g.lineTo(w / 2, h / 2 + 120); g.stroke();
  });
  const court = new THREE.Mesh(new THREE.PlaneGeometry(14, 28), new THREE.MeshLambertMaterial({ map: courtTex })); court.rotation.x = -Math.PI / 2; court.position.set(-24, 0.05, 42); court.rotation.z = Math.PI / 2; S.add(court);
  box(S, [0.05, 0.9, 11], '#1a1a1a', [-24, 0.45, 42]); box(S, [0.07, 0.08, 11], '#f4f4ee', [-24, 0.92, 42]);
  for (const [x, z] of [[-38, 35], [-10, 35], [-38, 49], [-10, 49]]) cyl(S, 0.06, 0.06, 3, '#1c1c1c', [x, 1.5, z], 6);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshLambertMaterial({ color: '#d8f04a', emissive: '#3a4a10' })); S.add(ball);
  let ballT = -99;
  S.on((t) => { if (t - ballT > 40 + rand() * 20) ballT = t; const k = (t - ballT) / 18; ball.visible = k >= 0 && k <= 1; if (ball.visible) { ball.position.set(-36 + k * 24, 0.09, 38 + k * 6 + Math.sin(k * 3) * 1.5); ball.rotation.z = -k * 40; } });

  // the helipad (naturally), the stables beyond, and cedars
  const hTex = canvasTexture(S, 256, 256, (g, w, h) => { g.fillStyle = '#2d3a2c'; g.beginPath(); g.arc(128, 128, 124, 0, TAU); g.fill(); g.strokeStyle = '#e8e4d8'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 100, 0, TAU); g.stroke(); g.fillStyle = '#e8e4d8'; g.font = 'bold 130px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 136); });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshLambertMaterial({ map: hTex })); pad.rotation.x = -Math.PI / 2; pad.position.set(-30, 0.06, 14); S.add(pad);
  building(S, { w: 22, d: 8, h: 4.2, roof: 2.6, wall: '#b79d74', roofCol: '#3e3c40', pos: [46, 0, -40], ry: -0.5, chimney: false, windows: [['front', -6, 2.2, 1, 0.9], ['front', 0, 2.2, 1, 0.9], ['front', 6, 2.2, 1, 0.9]], glow: '#ffb35a' });
  box(S, [2.4, 4, 2.4], '#b79d74', [46, 6, -40]);
  const cedars = [];
  for (let k = 0; k < 30; k++) { const a = rand() * TAU, r = 70 + rand() * 120; cedars.push([Math.cos(a) * r, 0, Math.sin(a) * r - 30, 1.4 + rand(), rand() * 6]); }
  scatter(S, pineGeo(rand, { col: '#16301f' }), cedars);
  const oaks = [];
  for (let k = 0; k < 16; k++) { const a = rand() * TAU, r = 60 + rand() * 60; oaks.push([Math.cos(a) * r, 0, Math.sin(a) * r, 1.2 + rand() * 0.6, rand() * 6]); }
  scatter(S, treeGeo(rand, { canopy: '#1d3520', trunk: '#2a2018' }), oaks);
  motes(S, { kind: 'firefly', count: 50, box: [80, 4, 60], center: [0, 1.5, 20], color: '#e6ff9a', size: 0.08, speed: 0.5 });

  orbitRig(S, { center: [0, 0, 12], radius: 58, height: 15, speed: 0.01, lookY: 3, start: 0.05, arc: 0.55 });
  return S.finalize({ portraitFov: 62 });
}
