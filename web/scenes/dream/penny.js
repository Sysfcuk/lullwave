// Penny's Night Patrol: a cosy country-house sitting room after everyone has gone to bed. The
// fire has burned down to embers, a table lamp is still on, the grandfather clock ticks, and the
// moon looks in through the window. Penny the cat makes her rounds: past the bookcase, a pause on
// the hearth, round the armchair, a hop up to the window seat to look out at the night, down
// again, behind the sofa and up onto it for a while, leaving softly glowing paw prints that fade
// behind her. She walks round the furniture, never through it.
import { createStage, motes, box, cyl, canvasTexture, model, THREE, TAU } from '../kit.js';
import { tabby } from '../tabby.js';
import { pennyLife } from './penny-life.js';
import { surface, room, moonWindow, fire, candle, softBox } from '../interior.js';

export function createPennyScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x9e77, bg: '#0a0806', fog: { color: '#140e0a', near: 7, far: 30 }, exposure: 1.12, bloom: [0.55, 0.5, 0.66], finish: { vignette: 0.46, grain: 0.024, ca: 0.25 }, fov: 46 });
  const { rand } = S;
  const W = 9, D = 8, H = 3.2;
  room(S, { w: W, d: D, h: H, floor: surface(S, 'planks', { color: '#76543a' }), walls: surface(S, 'plaster', { color: '#5f6f5c' }), ceiling: surface(S, 'plaster', { color: '#d8cfbf' }) });
  S.add(new THREE.HemisphereLight('#a0a8c8', '#5a4030', 1.25));
  const moon = new THREE.DirectionalLight('#9fb4ee', 0.35); moon.position.set(5, 4, 2); S.add(moon);
  // where things stand on the floor (for finding her way round them), and her places
  const OBSTACLES = [
    { x0: -1.3, x1: 1.3, z0: -4, z1: -3.48 }, // the fireplace
    { x: -1.85, z: -3.2, r: 0.34 }, // her basket
    { x: -4.08, z: -3.58, r: 0.42 }, // the grandfather clock
    { x0: -4.5, x1: -3.8, z0: -2.25, z1: -0.55 }, // the bookshelf
    { x0: -1.98, x1: -1.42, z0: 0.62, z1: 1.08 }, // the bedside table
    { x0: -1.12, x1: 1.12, z0: 0.42, z1: 1.38 }, // the sofa
    { x: 2.55, z: -0.55, r: 0.6 }, // the armchair
    { x: 2.0, z: -1.75, r: 0.36 }, // the ottoman
    { x0: 3.94, x1: 4.5, z0: 0.42, z1: 1.98 }, // the window seat
    { x: -2.65, z: -3.62, r: 0.13 }, { x: -3.1, z: -3.62, r: 0.13 }, // her bowls
    { x0: 3.77, x1: 4.23, z0: -1.18, z1: -0.72 }, // the scratching post
    { x0: -3.7, x1: -3.1, z0: 2.51, z1: 2.99 }, // the box
    { x: 3.4, z: -3.5, r: 0.28 }, // the birdcage stand
  ];
  const spots = {
    basket: { perch: [-1.85, 0.09, -3.2], approach: [-1.85, -2.65] },
    box: { perch: [-3.4, 0.03, 2.75], approach: [-3.4, 2.2] },
    sofa: { perch: [-0.2, 0.53, 0.72], approachFor: (p) => [THREE.MathUtils.clamp(p[0], -0.9, 0.9), 0.12] },
    window: { perch: [4.2, 0.57, 1.2], approachFor: (p) => [3.62, THREE.MathUtils.clamp(p[2], 0.6, 1.8)] },
    water: { x: -2.65, z: -3.62 }, food: { x: -3.1, z: -3.62 },
    post: { x: 4.0, z: -0.95 },
    cage: { x: 3.4, z: -3.5 },
    yarn: [0.9, -1.4],
    holes: [{ x: 1.75, z: -D / 2, ry: 0 }, { x: W / 2, z: -1.9, ry: -Math.PI / 2 }],
    perches: [[-0.6, 1.53, -3.62], [0.7, 1.53, -3.62], [-4.02, 2.13, -3.52], [-4.15, 2.43, -1.4], [4.38, 3.14, 1.2], [4.25, 0.63, 1.85], [-1.62, 0.74, 0.8], [0, 2.83, -3.96]],
  };
  const soft = (w, h, d, r, col, pos, parent = null, rot = null) => { const m = new THREE.Mesh(softBox(w, h, d, r), S.mat(col)); m.position.set(...pos); if (rot) m.rotation.set(...rot); (parent || S.scene).add(m); return m; };

  // skirting round every wall, and two old beams across the ceiling
  for (const [w, x, z, ry] of [[W, 0, -D / 2 + 0.02, 0], [W, 0, D / 2 - 0.02, 0], [D, -W / 2 + 0.02, 0, Math.PI / 2], [D, W / 2 - 0.02, 0, Math.PI / 2]]) box(S, [w, 0.14, 0.04], '#3a2a1c', [x, 0.07, z], ry);
  for (const z of [-1.6, 1.6]) box(S, [W, 0.22, 0.26], '#3e2c1e', [0, H - 0.11, z]);

  // the fireplace: a painted surround, a stone hearth, a mantel with candles and a clock
  const fz = -D / 2;
  soft(2.5, 1.4, 0.5, 0.04, '#e8e0d0', [0, 0.7, fz + 0.25]);
  box(S, [1.3, 0.9, 0.52], '#120c08', [0, 0.45, fz + 0.26]);
  soft(2.8, 0.1, 0.66, 0.03, '#ddd3c2', [0, 1.45, fz + 0.33]);
  soft(2.7, 0.06, 0.7, 0.02, '#6e6760', [0, 0.03, fz + 0.85]); // hearth stone
  fire(S, { pos: [0, 0.12, fz + 0.45], width: 0.7, intensity: 7, distance: 9, flames: 4 });
  for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), S.mat('#3a2416')); l.rotation.set(0, 0.3 * k - 0.3, Math.PI / 2); l.position.set(-0.1 + k * 0.1, 0.1 + (k === 1 ? 0.1 : 0), fz + 0.45); S.add(l); }
  for (const x of [-1, 1]) { cyl(S, 0.05, 0.06, 0.04, '#b08a3a', [x * 0.95, 1.52, fz + 0.35], 8); candle(S, { pos: [x * 0.95, 1.54, fz + 0.35], h: 0.22, light: x > 0, intensity: 1, distance: 5 }); }
  const mclock = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24), S.mat('#c9b27a')); mclock.rotation.x = Math.PI / 2; mclock.position.set(0, 1.68, fz + 0.33); S.add(mclock);
  const art = canvasTexture(S, 256, 180, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a3a6a'); gr.addColorStop(0.6, '#c98a5a'); gr.addColorStop(1, '#3a5a2a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#2a4a22'; g.beginPath(); g.moveTo(0, h * 0.7); for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.65 + Math.sin(x * 0.03) * 14); g.lineTo(w, h); g.lineTo(0, h); g.fill(); g.strokeStyle = '#8a6a2a'; g.lineWidth = 14; g.strokeRect(0, 0, w, h); });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), new THREE.MeshLambertMaterial({ map: art })); pic.position.set(0, 2.35, fz + 0.02); S.add(pic);
  // Penny's own bed by the fire
  const bed = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 10, 24), S.mat('#8a4a3a')); bed.rotation.x = -Math.PI / 2; bed.position.set(-1.85, 0.08, fz + 0.8); S.add(bed);
  const bedCushion = cyl(S, 0.26, 0.26, 0.06, '#c9a88a', [-1.85, 0.04, fz + 0.8], 20);

  // the rug
  const rugTex = canvasTexture(S, 256, 192, (g, w, h) => { g.fillStyle = '#7a2a2a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b26a'; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24); g.strokeStyle = '#2a3a5a'; g.lineWidth = 10; g.strokeRect(28, 28, w - 56, h - 56); g.fillStyle = '#d8b26a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(w / 2, h / 2, 50 - k * 9, 0, TAU); g.globalAlpha = 0.25; g.fill(); } g.globalAlpha = 1; });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), new THREE.MeshLambertMaterial({ map: rugTex })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, -1.2); S.add(rug);

  // the sofa, facing the fire: soft, with cushions, a bolster and a throw
  const sofa = new THREE.Group(); sofa.position.set(0, 0, 0.9); S.add(sofa);
  const legsGroup = new THREE.Group(); S.add(legsGroup);
  const sc1 = '#3d4f72', sc2 = '#4a5f86';
  soft(2.4, 0.36, 0.9, 0.06, sc1, [0, 0.2, 0], sofa);
  soft(2.4, 0.62, 0.24, 0.09, sc1, [0, 0.62, 0.34], sofa, [-0.12, 0, 0]);
  for (const x of [-1.13, 1.13]) soft(0.24, 0.62, 0.92, 0.1, sc1, [x, 0.36, 0], sofa);
  for (const x of [-0.5, 0.5]) soft(0.98, 0.16, 0.7, 0.07, sc2, [x, 0.46, -0.06], sofa);
  for (const x of [-0.5, 0.5]) soft(0.95, 0.42, 0.16, 0.08, sc2, [x, 0.72, 0.18], sofa, [-0.25, 0, 0]);
  soft(0.42, 0.36, 0.13, 0.06, '#c9a24a', [-0.78, 0.72, 0.06], sofa, [-0.3, 0.35, 0.15]);
  soft(0.75, 0.04, 0.95, 0.02, '#a8603a', [0.62, 0.86, 0.28], sofa, [-0.65, 0, 0]);
  for (const [x, z] of [[-1.1, -0.38], [1.1, -0.38], [-1.1, 0.38], [1.1, 0.38]]) legsGroup.add(cyl(S, 0.035, 0.03, 0.06, '#2a1a10', [x, 0.03, 0.9 + z], 8));
  // the armchair, angled to the fire
  const chair = new THREE.Group(); chair.position.set(2.55, 0, -0.55); chair.rotation.y = -2.2; S.add(chair);
  const cc = '#7a3e2c';
  soft(0.95, 0.38, 0.85, 0.06, cc, [0, 0.21, 0], chair);
  soft(0.95, 0.75, 0.22, 0.1, cc, [0, 0.72, -0.34], chair, [0.12, 0, 0]);
  for (const x of [-0.47, 0.47]) soft(0.2, 0.55, 0.85, 0.09, cc, [x, 0.38, 0], chair);
  soft(0.62, 0.13, 0.64, 0.05, '#8a4a36', [0, 0.45, 0.05], chair);
  // a footstool with a ball of wool
  const stool = soft(0.55, 0.3, 0.4, 0.06, '#7a3e2c', [2.0, 0.15, -1.75]);

  // the bookcase: a proper frame with shelves, full of books
  const bc = new THREE.Group(); bc.position.set(-W / 2 + 0.22, 0, -1.4); bc.rotation.y = Math.PI / 2; S.add(bc);
  const wood = S.mat('#4a3020');
  const part = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); bc.add(m); };
  part(2.04, 2.4, 0.04, 0, 1.2, -0.18); part(0.06, 2.4, 0.4, -1, 1.2, 0); part(0.06, 2.4, 0.4, 1, 1.2, 0); part(2.1, 0.08, 0.44, 0, 2.42, 0);
  for (let sh = 0; sh < 6; sh++) part(2, 0.04, 0.38, 0, 0.06 + sh * 0.46, 0);
  const bookCols = ['#7a2a2a', '#2a4a6a', '#3a5a2a', '#8a6a2a', '#5a2a4a', '#2a2a2a', '#a88a5a', '#c9b48a'];
  for (let sh = 0; sh < 5; sh++) {
    let x = -0.94;
    while (x < 0.9) { const bw = 0.035 + rand() * 0.05, bh = 0.26 + rand() * 0.14; const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.26), S.mat(bookCols[Math.floor(rand() * bookCols.length)])); b.position.set(x + bw / 2, 0.08 + sh * 0.46 + bh / 2, 0.02); b.rotation.z = rand() < 0.06 ? 0.22 : 0; bc.add(b); x += bw + 0.004 + (rand() < 0.08 ? 0.12 : 0); }
  }

  // the grandfather clock in the corner, its pendulum swinging (you can hear it tick)
  const gc = new THREE.Group(); gc.position.set(-W / 2 + 0.35, 0, -D / 2 + 0.4); gc.rotation.y = Math.PI / 4; S.add(gc);
  soft(0.5, 1.9, 0.34, 0.03, '#3e2616', [0, 0.95, 0], gc); soft(0.6, 0.55, 0.4, 0.04, '#3e2616', [0, 2.15, 0], gc);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.19, 28), S.mat('#efe6cf')); face.position.set(0, 2.15, 0.205); gc.add(face);
  for (const [l, a] of [[0.13, 1.1], [0.09, 2.6]]) { const hand = new THREE.Mesh(new THREE.BoxGeometry(0.012, l, 0.005), S.mat('#1a1410')); hand.geometry.translate(0, l / 2, 0); hand.position.set(0, 2.15, 0.21); hand.rotation.z = -a; gc.add(hand); }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.9), S.mat('#1a120c')); glass.position.set(0, 1.15, 0.175); gc.add(glass);
  const pend = new THREE.Group(); pend.position.set(0, 1.55, 0.18); gc.add(pend);
  { const rod = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.6, 0.01), S.mat('#b08a3a')); rod.position.y = -0.3; pend.add(rod); const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 20), S.mat('#c9a24a', { emissive: '#2a1a04' })); bob.rotation.x = Math.PI / 2; bob.position.y = -0.62; pend.add(bob); }
  S.on((t) => { pend.rotation.z = Math.sin(t * Math.PI) * 0.16; });

  // the side table and its lamp, still on: a warm pool of light
  const sideTable = soft(0.55, 0.6, 0.55, 0.03, '#4a3020', [-1.7, 0.3, 0.85]);
  const lampParts = [cyl(S, 0.08, 0.1, 0.05, '#8a6a3a', [-1.7, 0.625, 0.85], 14), cyl(S, 0.015, 0.015, 0.32, '#8a6a3a', [-1.7, 0.8, 0.85], 6)];
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, 0.24, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffcf8a', side: THREE.DoubleSide, toneMapped: false })); shade.position.set(-1.7, 1.0, 0.85); S.add(shade); lampParts.push(shade);
  const lamp = new THREE.PointLight('#ffc27a', 3.2, 7, 2); lamp.position.set(-1.7, 0.95, 0.85); S.add(lamp);
  const cup = cyl(S, 0.045, 0.035, 0.08, '#e8e2d6', [-1.55, 0.64, 0.72], 12);
  // a plant in the corner by the window
  const plantParts = [cyl(S, 0.2, 0.15, 0.36, '#9a5a3a', [W / 2 - 0.45, 0.18, -D / 2 + 0.5], 14)];
  for (let k = 0; k < 9; k++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), S.mat(k % 2 ? '#3f6a34' : '#4f7a3e')); lf.scale.set(0.5, 1.4, 0.25); const a = (k / 9) * TAU; lf.position.set(W / 2 - 0.45 + Math.cos(a) * 0.14, 0.62 + (k % 3) * 0.08, -D / 2 + 0.5 + Math.sin(a) * 0.14); lf.rotation.set(Math.sin(a) * 0.5, a, -Math.cos(a) * 0.5); S.add(lf); plantParts.push(lf); }

  // the window, the moon looking in, and a cushioned window seat
  const winTex = canvasTexture(S, 128, 192, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1838'); gr.addColorStop(1, '#2a3a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#f4efd8'; g.beginPath(); g.arc(84, 52, 16, 0, TAU); g.fill(); g.fillStyle = '#fff'; for (let k = 0; k < 30; k++) g.fillRect(Math.random() * w, Math.random() * h * 0.7, 1.5, 1.5); g.fillStyle = '#0a1420'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.78 - Math.sin(x * 0.08) * 8 - (x > 30 && x < 60 ? 30 : 0)); g.lineTo(w, h); g.fill(); g.fillStyle = '#2a1e16'; g.fillRect(w / 2 - 3, 0, 6, h); g.fillRect(0, h / 2 - 3, w, 6); });
  moonWindow(S, { pos: [W / 2 - 0.02, 1.55, 1.2], ry: -Math.PI / 2, w: 1.2, h: 1.3, tex: winTex, to: [1.6, 0, 0.6], shaftOpacity: 0.1 });
  soft(0.55, 0.48, 1.55, 0.03, '#ddd3c2', [W / 2 - 0.28, 0.24, 1.2]);
  soft(0.5, 0.08, 1.45, 0.04, '#6a7a9a', [W / 2 - 0.28, 0.52, 1.2]);
  for (const dz of [-0.95, 0.95]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.5, 10, 1, true), S.mat('#7a3a3a', { side: THREE.DoubleSide })); c.scale.z = 0.5; c.position.set(W / 2 - 0.14, 1.85, 1.2 + dz); S.add(c); }
  box(S, [0.06, 0.05, 2.6], '#3a2416', [W / 2 - 0.08, 3.1, 1.2]);

  // ---------------------------------------------------------------- real furniture (Poly Haven, CC0)
  // Each piece replaces its hand-built stand-in when it arrives; if one can't load, the stand-in stays.
  { // a soft, warm surround for the models' materials to reflect: firelight low, moonlight to one side
    const env = canvasTexture(S, 256, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a2a36'); gr.addColorStop(0.5, '#4a3a2e'); gr.addColorStop(1, '#2a1e16'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const fireGlow = g.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, 60); fireGlow.addColorStop(0, 'rgba(255,170,90,.9)'); fireGlow.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = fireGlow; g.fillRect(0, 0, w, h);
      const moonGlow = g.createRadialGradient(w * 0.25, h * 0.4, 0, w * 0.25, h * 0.4, 40); moonGlow.addColorStop(0, 'rgba(150,170,230,.7)'); moonGlow.addColorStop(1, 'rgba(150,170,230,0)'); g.fillStyle = moonGlow; g.fillRect(0, 0, w, h); });
    env.mapping = THREE.EquirectangularReflectionMapping; S.scene.environment = env; S.scene.environmentIntensity = 0.55;
  }
  const blobTex = canvasTexture(S, 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const blob = (box, grow = 1.25) => { const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()); const m = new THREE.Mesh(new THREE.PlaneGeometry(sz.x * grow, sz.z * grow), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(c.x, 0.012, c.z); S.add(m); };
  const hide = (...objs) => objs.flat().forEach((o) => { o.visible = false; });
  const M = (n) => `models/penny/${n}.glb`;
  const sofaSeat = []; // the sofa's cushions, for finding where Penny lands
  model(S, M('Sofa_01'), { pos: [0, 0, 0.9], ry: Math.PI, width: 2.1 }).then((r) => {
    if (!r) return; hide(sofa, legsGroup); blob(r.box); r.group.traverse((o) => { if (o.isMesh) sofaSeat.push(o); });
    // set her sofa waypoints to the real height of the cushions
    const ray = new THREE.Raycaster();
    ray.set(new THREE.Vector3(-0.2, 2, 0.72), new THREE.Vector3(0, -1, 0)); const seat = ray.intersectObjects(sofaSeat, false)[0]; if (seat) spots.sofa.perch[1] = seat.point.y + 0.01;
    model(S, M('throw_pillows_01'), { pos: [0.62, 0, 1.0], ry: Math.PI + 0.15, width: 0.75 }).then((q) => { if (!q) return; ray.set(new THREE.Vector3(0.62, 2, 0.9), new THREE.Vector3(0, -1, 0)); const hit = ray.intersectObjects(sofaSeat, false)[0]; q.group.position.y = hit ? hit.point.y - 0.03 : 0.5; });
  });
  model(S, M('ArmChair_01'), { pos: [2.55, 0, -0.55], ry: -2.43, width: 1.0 }).then((r) => { if (r) { hide(chair); blob(r.box); } });
  model(S, M('Ottoman_01'), { pos: [2.0, 0, -1.75], ry: 0.3, width: 0.62 }).then((r) => { if (r) { hide(stool); blob(r.box); } });
  model(S, M('ClassicNightstand_01'), { pos: [-1.7, 0, 0.85], ry: Math.PI / 2, width: 0.55 }).then((r) => {
    if (!r) return; hide(sideTable, lampParts); blob(r.box); const top = r.box.max.y;
    cup.position.y = top + 0.04;
    model(S, M('vintage_oil_lamp'), { pos: [-1.72, top, 0.9], width: 0.17 }).then((q) => { if (!q) return; lamp.position.set(-1.72, q.box.max.y * 0.75 + top * 0.25, 0.9); lampGlow.position.copy(lamp.position); lampGlow.scale.setScalar(0.55); lampGlow.visible = true; });
  });
  model(S, M('vintage_grandfather_clock_01'), { pos: [-W / 2 + 0.42, 0, -D / 2 + 0.42], ry: Math.PI / 4, width: 0.6 }).then((r) => { if (r) { hide(gc); blob(r.box); } });
  model(S, M('wooden_bookshelf_worn'), { pos: [-W / 2 + 0.33, 0, -1.4], ry: Math.PI / 2, width: 1.6 }).then((r) => {
    if (!r) return; hide(bc); blob(r.box);
    // find its shelves and fill them with books
    const meshes = []; r.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const ray = new THREE.Raycaster(), x0 = r.box.max.x - 0.12, shelves = [];
    for (let y = r.box.max.y - 0.05; y > 0.05;) { ray.set(new THREE.Vector3(x0, y, -1.4), new THREE.Vector3(0, -1, 0)); const hit = ray.intersectObjects(meshes, false)[0]; if (!hit) break; if (hit.point.y < r.box.max.y - 0.2) shelves.push(hit.point.y); y = hit.point.y - 0.06; }
    const span = r.box.max.z - r.box.min.z - 0.24;
    for (const y of shelves) {
      let z = -1.4 - span / 2;
      while (z < -1.4 + span / 2 - 0.05) {
        const bw = 0.035 + rand() * 0.05, bh = 0.22 + rand() * 0.1;
        if (rand() < 0.06) { z += 0.14; continue; }
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, bh, bw), S.mat(bookCols[Math.floor(rand() * bookCols.length)])); b.position.set(x0 - 0.05, y + bh / 2, z + bw / 2); b.rotation.x = rand() < 0.05 ? 0.2 : 0; S.add(b); z += bw + 0.004;
      }
    }
  });
  model(S, M('potted_plant_04'), { pos: [W / 2 - 0.3, 0.56, 1.88], width: 0.28 }).then((r) => { if (r) hide(plantParts); });
  model(S, M('wicker_basket_01'), { pos: [-1.85, 0, fz + 0.8], ry: 0.5, width: 0.66 }).then((r) => { if (r) { hide(bed); blob(r.box, 1.15); bedCushion.position.y = 0.06; bedCushion.scale.set(0.95, 1, 0.75); bedCushion.rotation.y = 0.5; } });
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: blobTex, color: '#ffb35c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); lampGlow.scale.setScalar(0.01); lampGlow.visible = false; S.add(lampGlow);

  // ---------------------------------------------------------------- Penny's life
  const penny = tabby(S, { coat: '#8a6446', belly: '#efe2cc', white: '#f6f1e8' });
  const life = pennyLife(S, { cat: penny, rand, W, D, obstacles: OBSTACLES, spots });
  const pos = life.pos;
  S.scene.userData.life = life; // for looking in on her while testing

  // glowing paw prints, laid down as she walks and fading away (toes pointing the way she went)
  const pawTex = canvasTexture(S, 64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 42, 12, 10, 0, 0, TAU); g.fill(); for (const [x, y] of [[17, 24], [27, 15], [38, 15], [48, 24]]) { g.beginPath(); g.ellipse(x, y, 5, 6.5, 0, 0, TAU); g.fill(); } });
  const MAXP = 56;
  const prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.075, 0.075).rotateX(-Math.PI / 2).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: pawTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), MAXP);
  prints.frustumCulled = false; S.add(prints);
  const born = new Float32Array(MAXP).fill(-99), col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < MAXP; i++) { prints.setMatrixAt(i, m4.makeTranslation(0, -5, 0)); prints.setColorAt(i, col.setRGB(0, 0, 0)); }
  let pi = 0, stride = 0, side = 1;
  const lastPos = pos.clone();
  S.on((t) => {
    // prints: alternate left and right, a step's length apart, only where she actually walks
    const moved = Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z); lastPos.copy(pos);
    if (life.walking && moved < 0.2) {
      stride += moved;
      if (stride > 0.13) {
        stride = 0; side = -side; const yaw = life.yaw;
        v.set(Math.cos(yaw) * 0.045 * side, pos.y + 0.008, -Math.sin(yaw) * 0.045 * side); v.x += pos.x; v.z += pos.z;
        prints.setMatrixAt(pi, m4.compose(v, q.setFromAxisAngle(up, yaw), one)); born[pi] = t; pi = (pi + 1) % MAXP;
        prints.instanceMatrix.needsUpdate = true;
      }
    }
    for (let i = 0; i < MAXP; i++) { const age = t - born[i], f = age < 0.4 ? age / 0.4 : Math.max(0, 1 - (age - 0.4) / 12); prints.setColorAt(i, col.setRGB(1, 0.72, 0.38).multiplyScalar(f * 0.85)); }
    prints.instanceColor.needsUpdate = true;
  });

  motes(S, { kind: 'dust', count: mobile ? 160 : 260, box: [W - 1, H - 0.4, D - 1], center: [0, H / 2, 0], color: '#ffe6c0', size: 0.022, speed: 0.5 });

  // watch from above the furniture, drifting slowly along the front of the room, eyes on Penny
  let ang = 0;
  const look = new THREE.Vector3(0, 0.3, -1), want = new THREE.Vector3();
  S.on((t, dt, st) => {
    ang += dt * 0.012 * (0.55 + 0.45 * st.energy);
    S.camera.position.set(Math.sin(ang) * 2.6, 2.35 + Math.sin(t * 0.06) * 0.06, D / 2 - 0.7);
    want.set(pos.x * 0.85, pos.y + 0.15, pos.z * 0.85 - 0.25);
    if (life.bird.free) want.lerp(life.bird.pos, 0.35);
    look.lerp(want, Math.min(1, dt * 0.6));
    S.camera.lookAt(look);
  });
  return S.finalize({ portraitFov: 60 });
}
