// Penny's Night Patrol: a cosy country-house sitting room after everyone has gone to bed. The
// fire has burned down to embers, a table lamp is still on, the grandfather clock ticks, and the
// moon looks in through the window. Penny the cat makes her rounds: past the bookcase, a pause on
// the hearth, round the armchair, a hop up to the window seat to look out at the night, down
// again, behind the sofa and up onto it for a while, leaving softly glowing paw prints that fade
// behind her. She walks round the furniture, never through it.
import { createStage, motes, box, cyl, canvasTexture, THREE, TAU } from '../kit.js';
import { cat } from '../figures.js';
import { surface, room, moonWindow, fire, candle, softBox } from '../interior.js';

// her rounds: waypoints [x, y, z], with an optional pause (seconds) and the way she faces while sitting
const ROUTE = [
  { p: [-2.6, 0, -2.0] },
  { p: [-0.6, 0.06, -2.95], sit: 9, face: Math.PI }, // on the hearth, watching the embers
  { p: [1.6, 0, -2.5] },
  { p: [3.6, 0, -1.6] },
  { p: [3.75, 0, 0.35] },
  { p: [4.18, 0.56, 0.85] }, // up onto the window seat
  { p: [4.18, 0.56, 1.5], sit: 11, face: Math.PI / 2 }, // looking out at the moon
  { p: [3.4, 0, 2.25] }, // and down again
  { p: [1.7, 0, 2.3] }, // behind the sofa
  { p: [1.75, 0, 0.05] },
  { p: [0.9, 0, -0.2] },
  { p: [0.5, 0.57, 0.72] }, // up onto the sofa
  { p: [-0.55, 0.57, 0.72], sit: 10, face: Math.PI }, // a sit on the cushions
  { p: [-1.0, 0, -0.25] }, // down
  { p: [-2.4, 0, -0.55] },
];

export function createPennyScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x9e77, bg: '#0a0806', fog: { color: '#140e0a', near: 7, far: 30 }, exposure: 1.12, bloom: [0.55, 0.5, 0.66], finish: { vignette: 0.46, grain: 0.024, ca: 0.25 }, fov: 58 });
  const { rand } = S;
  const W = 9, D = 8, H = 3.2;
  room(S, { w: W, d: D, h: H, floor: surface(S, 'planks', { color: '#76543a' }), walls: surface(S, 'plaster', { color: '#5f6f5c' }), ceiling: surface(S, 'plaster', { color: '#d8cfbf' }) });
  S.add(new THREE.HemisphereLight('#a0a8c8', '#5a4030', 1.25));
  const moon = new THREE.DirectionalLight('#9fb4ee', 0.35); moon.position.set(5, 4, 2); S.add(moon);
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
  const bed = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 10, 24), S.mat('#8a4a3a')); bed.rotation.x = -Math.PI / 2; bed.position.set(-1.85, 0.08, fz + 0.75); S.add(bed);
  cyl(S, 0.26, 0.26, 0.06, '#c9a88a', [-1.85, 0.04, fz + 0.75], 20);

  // the rug
  const rugTex = canvasTexture(S, 256, 192, (g, w, h) => { g.fillStyle = '#7a2a2a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b26a'; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24); g.strokeStyle = '#2a3a5a'; g.lineWidth = 10; g.strokeRect(28, 28, w - 56, h - 56); g.fillStyle = '#d8b26a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(w / 2, h / 2, 50 - k * 9, 0, TAU); g.globalAlpha = 0.25; g.fill(); } g.globalAlpha = 1; });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), new THREE.MeshLambertMaterial({ map: rugTex })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, -1.2); S.add(rug);

  // the sofa, facing the fire: soft, with cushions, a bolster and a throw
  const sofa = new THREE.Group(); sofa.position.set(0, 0, 0.9); S.add(sofa);
  const sc1 = '#3d4f72', sc2 = '#4a5f86';
  soft(2.4, 0.36, 0.9, 0.06, sc1, [0, 0.2, 0], sofa);
  soft(2.4, 0.62, 0.24, 0.09, sc1, [0, 0.62, 0.34], sofa, [-0.12, 0, 0]);
  for (const x of [-1.13, 1.13]) soft(0.24, 0.62, 0.92, 0.1, sc1, [x, 0.36, 0], sofa);
  for (const x of [-0.5, 0.5]) soft(0.98, 0.16, 0.7, 0.07, sc2, [x, 0.46, -0.06], sofa);
  for (const x of [-0.5, 0.5]) soft(0.95, 0.42, 0.16, 0.08, sc2, [x, 0.72, 0.18], sofa, [-0.25, 0, 0]);
  soft(0.42, 0.36, 0.13, 0.06, '#c9a24a', [-0.78, 0.72, 0.06], sofa, [-0.3, 0.35, 0.15]);
  soft(0.75, 0.04, 0.95, 0.02, '#a8603a', [0.62, 0.86, 0.28], sofa, [-0.65, 0, 0]);
  for (const [x, z] of [[-1.1, -0.38], [1.1, -0.38], [-1.1, 0.38], [1.1, 0.38]]) cyl(S, 0.035, 0.03, 0.06, '#2a1a10', [x, 0.03, 0.9 + z], 8);
  // the armchair, angled to the fire
  const chair = new THREE.Group(); chair.position.set(2.55, 0, -0.55); chair.rotation.y = -2.2; S.add(chair);
  const cc = '#7a3e2c';
  soft(0.95, 0.38, 0.85, 0.06, cc, [0, 0.21, 0], chair);
  soft(0.95, 0.75, 0.22, 0.1, cc, [0, 0.72, -0.34], chair, [0.12, 0, 0]);
  for (const x of [-0.47, 0.47]) soft(0.2, 0.55, 0.85, 0.09, cc, [x, 0.38, 0], chair);
  soft(0.62, 0.13, 0.64, 0.05, '#8a4a36', [0, 0.45, 0.05], chair);
  // a footstool with a ball of wool
  soft(0.55, 0.3, 0.4, 0.06, '#7a3e2c', [2.0, 0.15, -1.75]);
  const wool = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), S.mat('#c94a6a')); wool.position.set(2.1, 0.38, -1.7); S.add(wool);

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
  soft(0.55, 0.6, 0.55, 0.03, '#4a3020', [-1.7, 0.3, 0.85]);
  cyl(S, 0.08, 0.1, 0.05, '#8a6a3a', [-1.7, 0.625, 0.85], 14);
  cyl(S, 0.015, 0.015, 0.32, '#8a6a3a', [-1.7, 0.8, 0.85], 6);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, 0.24, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffcf8a', side: THREE.DoubleSide, toneMapped: false })); shade.position.set(-1.7, 1.0, 0.85); S.add(shade);
  const lamp = new THREE.PointLight('#ffc27a', 3.2, 7, 2); lamp.position.set(-1.7, 0.95, 0.85); S.add(lamp);
  cyl(S, 0.045, 0.035, 0.08, '#e8e2d6', [-1.55, 0.64, 0.72], 12);
  // a plant in the corner by the window
  cyl(S, 0.2, 0.15, 0.36, '#9a5a3a', [W / 2 - 0.45, 0.18, -D / 2 + 0.5], 14);
  for (let k = 0; k < 9; k++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), S.mat(k % 2 ? '#3f6a34' : '#4f7a3e')); lf.scale.set(0.5, 1.4, 0.25); const a = (k / 9) * TAU; lf.position.set(W / 2 - 0.45 + Math.cos(a) * 0.14, 0.62 + (k % 3) * 0.08, -D / 2 + 0.5 + Math.sin(a) * 0.14); lf.rotation.set(Math.sin(a) * 0.5, a, -Math.cos(a) * 0.5); S.add(lf); }

  // the window, the moon looking in, and a cushioned window seat
  const winTex = canvasTexture(S, 128, 192, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1838'); gr.addColorStop(1, '#2a3a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#f4efd8'; g.beginPath(); g.arc(84, 52, 16, 0, TAU); g.fill(); g.fillStyle = '#fff'; for (let k = 0; k < 30; k++) g.fillRect(Math.random() * w, Math.random() * h * 0.7, 1.5, 1.5); g.fillStyle = '#0a1420'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.78 - Math.sin(x * 0.08) * 8 - (x > 30 && x < 60 ? 30 : 0)); g.lineTo(w, h); g.fill(); g.fillStyle = '#2a1e16'; g.fillRect(w / 2 - 3, 0, 6, h); g.fillRect(0, h / 2 - 3, w, 6); });
  moonWindow(S, { pos: [W / 2 - 0.02, 1.55, 1.2], ry: -Math.PI / 2, w: 1.2, h: 1.3, tex: winTex, to: [1.6, 0, 0.6], shaftOpacity: 0.1 });
  soft(0.55, 0.48, 1.55, 0.03, '#ddd3c2', [W / 2 - 0.28, 0.24, 1.2]);
  soft(0.5, 0.08, 1.45, 0.04, '#6a7a9a', [W / 2 - 0.28, 0.52, 1.2]);
  for (const dz of [-0.95, 0.95]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.5, 10, 1, true), S.mat('#7a3a3a', { side: THREE.DoubleSide })); c.scale.z = 0.5; c.position.set(W / 2 - 0.14, 1.85, 1.2 + dz); S.add(c); }
  box(S, [0.06, 0.05, 2.6], '#3a2416', [W / 2 - 0.08, 3.1, 1.2]);

  // ---------------------------------------------------------------- Penny and her rounds
  const penny = cat(S, { coat: '#6a5040', stripe: '#2e221a', belly: '#ece6dc', pose: 'walk', scale: 1.15 });
  const pts = ROUTE.map((w) => new THREE.Vector3(...w.p));

  // glowing paw prints, laid down as she walks and fading away (toes pointing the way she went)
  const pawTex = canvasTexture(S, 64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 42, 12, 10, 0, 0, TAU); g.fill(); for (const [x, y] of [[17, 24], [27, 15], [38, 15], [48, 24]]) { g.beginPath(); g.ellipse(x, y, 5, 6.5, 0, 0, TAU); g.fill(); } });
  const MAXP = 56;
  const prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.075, 0.075).rotateX(-Math.PI / 2).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: pawTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), MAXP);
  prints.frustumCulled = false; S.add(prints);
  const born = new Float32Array(MAXP).fill(-99), col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < MAXP; i++) { prints.setMatrixAt(i, m4.makeTranslation(0, -5, 0)); prints.setColorAt(i, col.setRGB(0, 0, 0)); }
  let pi = 0, stride = 0, side = 1;

  // walking a leg of the route, hopping when it changes height, sitting where the route says
  let leg = 0, u = 0, mode = 'walk', until = 0, yaw = 0;
  const pos = new THREE.Vector3().copy(pts[0]), a = new THREE.Vector3(), b = new THREE.Vector3();
  S.on((t, dt, st) => {
    a.copy(pts[leg]); b.copy(pts[(leg + 1) % pts.length]);
    const flat = Math.hypot(b.x - a.x, b.z - a.z), jump = Math.abs(b.y - a.y) > 0.2;
    let walking = false;
    if (mode === 'sit') {
      penny.pose = 'sit';
      const face = ROUTE[leg].face ?? yaw;
      yaw += Math.atan2(Math.sin(face - yaw), Math.cos(face - yaw)) * Math.min(1, dt * 1.5);
      if (t > until) mode = 'walk';
    } else {
      penny.pose = 'walk';
      const speed = jump ? 1 / 0.75 : (0.3 + 0.12 * st.energy) / Math.max(0.01, flat); // a jump takes 0.75 s
      u += dt * speed;
      if (u >= 1) {
        u = 0; leg = (leg + 1) % pts.length;
        if (ROUTE[leg].sit) { mode = 'sit'; until = t + ROUTE[leg].sit; }
        a.copy(pts[leg]); b.copy(pts[(leg + 1) % pts.length]);
      }
      walking = !jump;
      const want = Math.atan2(b.x - a.x, b.z - a.z);
      yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * Math.min(1, dt * (jump ? 8 : 3.5));
    }
    const isJump = Math.abs(b.y - a.y) > 0.2 && mode === 'walk';
    pos.lerpVectors(a, b, mode === 'sit' ? 0 : isJump ? (1 - Math.cos(u * Math.PI)) / 2 : u);
    if (isJump) pos.y = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * 0.32; // a little arc through the air
    penny.group.position.copy(pos);
    penny.group.rotation.y = yaw;
    // prints: alternate left and right, every step's length, only where she actually walks
    if (walking) {
      stride += dt * (0.3 + 0.12 * st.energy);
      if (stride > 0.13) {
        stride = 0; side = -side;
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
    look.lerp(want, Math.min(1, dt * 0.6));
    S.camera.lookAt(look);
  });
  return S.finalize({ portraitFov: 74 });
}
