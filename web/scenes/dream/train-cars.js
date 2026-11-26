// The Sleeper Train's other rooms, for the walk back through the train: the corridor outside our
// compartment, the dining car (tables with little red-shaded lamps, a steward polishing glasses at
// the bar, a passenger reading, another asleep), and the observation car at the very back, with
// armchairs facing the big rear window and the rails running away into the night.
// All in a carriage's own frame: x along the train (forward +), z across (+ is our window side), y up
// from the rails; the floor is at FL.
import { THREE, canvasTexture, TAU } from '../kit.js';
import { softBox } from '../interior.js';

const CL = 20.5 - 0.9; // a carriage's inside length

/** A simple person, sitting or standing, built from soft shapes. Returns the group and an animate(t). */
function figure(S, { coat = '#2a2a3a', trousers = '#1e1e24', skin = '#e2b597', hair = '#3a2a20', sit = false, white = false }) {
  const m = (c) => S.mat(c);
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 6, 12), m(white ? '#ece8de' : coat)); torso.position.y = sit ? 0.78 : 1.12; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), m(skin)); head.position.y = sit ? 1.22 : 1.56; g.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 8, 0, TAU, 0, Math.PI / 2.1), m(hair)); hairM.position.copy(head.position).y += 0.01; g.add(hairM);
  const arms = [];
  for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), m(white ? '#ece8de' : coat)); a.position.set(sx * 0.22, sit ? 0.8 : 1.14, 0); g.add(a); arms.push(a); }
  if (sit) { for (const sx of [-1, 1]) { const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.36, 4, 8), m(trousers)); th.rotation.x = Math.PI / 2; th.position.set(sx * 0.09, 0.5, 0.2); g.add(th); const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.38, 4, 8), m(trousers)); sh.position.set(sx * 0.09, 0.25, 0.4); g.add(sh); } }
  else for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.62, 4, 8), m(trousers)); l.position.set(sx * 0.09, 0.42, 0); g.add(l); }
  if (white) { const tie = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.02), m('#1a1a1a')); tie.position.set(0, 1.42, 0.16); g.add(tie); }
  return { g, head, arms, torso };
}

/** Wood panelling, a curved cream ceiling, a carpet: the shell of a carriage, with windows along one or both sides. */
function shell(S, G, { FL, woodM, sides = [1, -1], windows = [], winY = [0.8, 1.75], carpet = '#5a1a1e', ceilY = 2.25, x0 = -CL / 2, x1 = CL / 2, half = 1.4, fz = [-half, half], ends = [true, true] }) {
  const box = (w, h, d, x, y, z, mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); G.add(b); return b; };
  const L = x1 - x0, cx = (x0 + x1) / 2, top = FL + ceilY;
  for (const sz of sides) {
    const z = sz * half;
    box(L, winY[0], 0.06, cx, FL + winY[0] / 2, z, woodM);
    box(L, ceilY - winY[1], 0.06, cx, FL + (winY[1] + ceilY) / 2, z, woodM);
    // posts between the windows
    const ws = [...windows].sort((a, b) => a[0] - b[0]);
    let x = x0;
    for (const [wx, ww] of ws) { const a = wx - ww / 2; if (a > x) box(a - x, winY[1] - winY[0], 0.06, (a + x) / 2, FL + (winY[0] + winY[1]) / 2, z, woodM); x = wx + ww / 2; }
    if (x1 > x) box(x1 - x, winY[1] - winY[0], 0.06, (x1 + x) / 2, FL + (winY[0] + winY[1]) / 2, z, woodM);
    for (const [wx, ww] of ws) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(ww, winY[1] - winY[0]), new THREE.MeshBasicMaterial({ color: '#6a7a98', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide })); gl.position.set(wx, FL + (winY[0] + winY[1]) / 2, z); G.add(gl); }
  }
  for (const [ex, on] of [[x0, ends[0]], [x1, ends[1]]]) if (on) { box(0.06, 2.8, (fz[1] - fz[0]), ex, FL + 1.4, (fz[0] + fz[1]) / 2, woodM); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, fz[1] - fz[0]), S.mat(carpet)); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, FL, (fz[0] + fz[1]) / 2); G.add(floor);
  const cg = new THREE.CylinderGeometry(2.2, 2.2, L, 24, 1, true, -0.68, 1.36); cg.rotateX(-Math.PI / 2); cg.rotateY(Math.PI / 2);
  const ceil = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: '#e6dac0', side: THREE.BackSide })); ceil.position.set(cx, top - 2.2 + 0.32, 0); G.add(ceil);
  return { box };
}

/** The corridor outside our compartment: windows on the far side, compartment doors on the near. */
export function buildCorridor(S, { FL, woodM, brass, Z0 }) {
  const G = new THREE.Group();
  const half = 1.4, zc = (Z0 - half) / 2;
  const wins = []; for (let x = -8.8; x <= 8.8; x += 2.2) wins.push([x, 1.0]);
  const { box } = shell(S, G, { FL, woodM, sides: [-1], windows: wins, winY: [0.85, 1.65], fz: [-half, Z0] });
  // the compartment wall, with doors (ours open)
  const glassM = new THREE.MeshLambertMaterial({ color: '#c89a58', emissive: '#6a4420', emissiveIntensity: 0.5 });
  for (let x = -8.8; x <= 8.8; x += 2.2) {
    if (Math.abs(x) < 0.1) { // our door, slid open
      box(0.5, 2.0, 0.05, x - 0.62, FL + 1.0, Z0 - 0.03, woodM);
      box(0.08, 2.0, 0.06, x + 0.4, FL + 1.0, Z0, woodM); box(0.08, 2.0, 0.06, x - 0.4, FL + 1.0, Z0, woodM); box(0.88, 0.25, 0.06, x, FL + 2.1, Z0, woodM);
      continue;
    }
    box(2.2, 2.25, 0.05, x, FL + 1.12, Z0, woodM);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.7), glassM); pane.position.set(x - 0.2, FL + 1.35, Z0 - 0.03); pane.rotation.y = Math.PI; G.add(pane); // the blinds drawn, a lamp on behind
    box(0.03, 0.12, 0.04, x + 0.15, FL + 1.0, Z0 - 0.05, brass);
  }
  // the handrail under the windows, little lamps along the ceiling
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, CL, 8), brass); rail.rotation.z = Math.PI / 2; rail.position.set(0, FL + 0.95, -half + 0.08); G.add(rail);
  const domeM = new THREE.MeshBasicMaterial({ color: '#ffe0b0', toneMapped: false });
  for (let x = -8; x <= 8; x += 3.2) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, TAU, 0, Math.PI / 2), domeM); d.rotation.x = Math.PI; d.position.set(x, FL + 2.3, zc); G.add(d); }
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(CL, 0.5), S.mat('#7a2a2a')); runner.rotation.x = -Math.PI / 2; runner.position.set(0, FL + 0.005, zc); G.add(runner);
  // our compartment's wall, round the open door, seen from inside
  box(0.7, 2.2, 0.05, -0.75, FL + 1.1, Z0 + 0.03, woodM); box(0.7, 2.2, 0.05, 0.75, FL + 1.1, Z0 + 0.03, woodM);
  const light = new THREE.PointLight('#ffd8a8', 0, 9, 1); light.position.set(0, FL + 2.1, zc); G.add(light);
  return { group: G, light };
}

/** The dining car: tables down both sides, a little lamp on each, the bar at the back with the steward. */
export function buildDining(S, { FL, woodM, brass, pick }) {
  const G = new THREE.Group();
  const tx = [6.4, 3.6, 0.8, -2.0], wins = tx.map((x) => [x, 1.5]);
  const { box } = shell(S, G, { FL, woodM, windows: wins, winY: [0.75, 1.7], carpet: '#4a2030' });
  const cloth = S.mat('#efe9dc'), chairM = S.mat(pick(['#6a2a2a', '#2a4a3a', '#5a3a2a']));
  const shadeM = new THREE.MeshLambertMaterial({ color: '#d84a3a', emissive: '#ff6a3a', emissiveIntensity: 0.9 });
  const glassM = new THREE.MeshLambertMaterial({ color: '#c8d8e8', transparent: true, opacity: 0.5 });
  for (const x of tx) for (const sz of [1, -1]) {
    const z = sz * 0.95;
    box(0.8, 0.04, 0.85, x, FL + 0.74, z, cloth); box(0.8, 0.22, 0.02, x, FL + 0.63, z - sz * 0.42, cloth);
    box(0.08, 0.7, 0.08, x, FL + 0.37, z, S.mat('#2a1a14'));
    for (const dx of [-0.65, 0.65]) { const ch = new THREE.Mesh(softBox(0.42, 0.1, 0.46, 0.03), chairM); ch.position.set(x + dx, FL + 0.46, z); G.add(ch); const bk = new THREE.Mesh(softBox(0.08, 0.6, 0.46, 0.03), chairM); bk.position.set(x + dx * 1.3, FL + 0.82, z); G.add(bk); }
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.22, 8), brass); lb.position.set(x, FL + 0.87, z + sz * 0.25); G.add(lb);
    const sh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 14, 1, true), shadeM); sh.position.set(x, FL + 1.0, z + sz * 0.25); G.add(sh);
    for (const dx of [-0.2, 0.2]) { const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.1, 10), glassM); gl.position.set(x + dx, FL + 0.81, z - sz * 0.05); G.add(gl); }
  }
  // the bar at the back end, bottles on shelves, and the steward polishing a glass
  box(0.5, 1.05, 2.0, -7.6, FL + 0.52, 0.2, woodM); box(0.62, 0.05, 2.1, -7.6, FL + 1.07, 0.2, brass);
  box(0.25, 1.4, 2.6, -9.4, FL + 1.25, 0, woodM);
  const bottleCols = ['#2a5a3a', '#6a2a1a', '#c8a050', '#3a3a6a', '#8a8a6a'];
  for (let k = 0; k < 14; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 8), new THREE.MeshLambertMaterial({ color: bottleCols[k % 5], emissive: bottleCols[k % 5], emissiveIntensity: 0.25 })); b.position.set(-9.22, FL + 1.32 + Math.floor(k / 7) * 0.42, -1.0 + (k % 7) * 0.33); G.add(b); }
  const steward = figure(S, { white: true, trousers: '#1a1a20', hair: '#2a2a2a' }); steward.g.position.set(-8.4, FL, 0.3); steward.g.rotation.y = Math.PI / 2; G.add(steward.g);
  const polish = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.11, 10), glassM); steward.g.add(polish);
  // a passenger reading, another asleep over the last of their cocoa
  const reader = figure(S, { sit: true, coat: '#3a4a6a', hair: '#8a6a4a' }); reader.g.position.set(3.6 - 0.65, FL + 0.05, -0.95); reader.g.rotation.y = Math.PI / 2; G.add(reader.g);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.32), new THREE.MeshLambertMaterial({ map: canvasTexture(S, 64, 48, (g, w, h) => { g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a5a5a'; for (let y = 6; y < h; y += 4) g.fillRect(3 + (y % 8), y, w - 10, 1.5); g.fillRect(3, 2, w - 6, 3); }), side: THREE.DoubleSide })); paper.position.set(0, 1.0, 0.32); paper.rotation.x = -0.25; reader.g.add(paper);
  const sleeper = figure(S, { sit: true, coat: '#5a3a2a', hair: '#c8b090' }); sleeper.g.position.set(-2.0 + 0.65, FL + 0.05, 0.95); sleeper.g.rotation.y = -Math.PI / 2; G.add(sleeper.g);
  sleeper.head.position.z += 0.08; sleeper.head.rotation.z = 0.4;
  const light = new THREE.PointLight('#ffc890', 0, 18, 1); light.position.set(1, FL + 2.0, 0); G.add(light);
  const animate = (t) => {
    steward.arms[1].rotation.x = -1.3 + Math.sin(t * 2.2) * 0.25; steward.arms[1].rotation.z = 0.25;
    steward.arms[0].rotation.x = -1.1; steward.arms[0].rotation.z = -0.3;
    polish.position.set(0.05, 1.35 + Math.sin(t * 2.2) * 0.03, 0.32); polish.rotation.y = t * 3;
    steward.head.rotation.x = 0.25 + Math.sin(t * 0.4) * 0.05;
    paper.rotation.z = Math.sin(t * 0.3) * 0.04;
    sleeper.torso.position.y = 0.78 + Math.sin(t * 1.1) * 0.006;
  };
  return { group: G, light, animate, BAR: -6.6 };
}

/** The observation car at the back of the train: armchairs, and windows all round the rear. */
export function buildObservation(S, { FL, woodM, brass, pick, glowTex }) {
  const G = new THREE.Group();
  const wins = [[-6.9, 2.2], [-4.4, 2.2], [-1.9, 2.2], [0.6, 2.2]];
  const { box } = shell(S, G, { FL, woodM, windows: wins, winY: [0.55, 1.9], carpet: '#3a2a3a', x0: -CL / 2 + 0.2, x1: 3, ends: [false, false] });
  // the rear wall is mostly window
  const xr = -CL / 2 + 0.2;
  box(0.06, 0.55, 2.8, xr, FL + 0.27, 0, woodM); box(0.06, 0.35, 2.8, xr, FL + 2.07, 0, woodM);
  for (const z of [-1.25, 1.25]) box(0.06, 1.35, 0.3, xr, FL + 1.22, z, woodM);
  box(0.06, 1.35, 0.08, xr, FL + 1.22, 0, woodM);
  box(0.06, 2.25, 2.8, 3, FL + 1.12, 0, woodM); // the end wall forward, with its door
  const chairM = S.mat(pick(['#2a3a5a', '#4a2a3a', '#2a4a3a']));
  for (const [x, z, ry] of [[-7.2, 0.75, -Math.PI / 2], [-7.2, -0.75, -Math.PI / 2], [-4.2, 1.05, Math.PI], [-4.2, -1.05, 0], [-1.6, 1.05, Math.PI]]) {
    const c = new THREE.Group(); c.position.set(x, FL, z); c.rotation.y = ry; G.add(c);
    const seat = new THREE.Mesh(softBox(0.62, 0.2, 0.6, 0.06), chairM); seat.position.y = 0.38; c.add(seat);
    const back = new THREE.Mesh(softBox(0.62, 0.62, 0.16, 0.06), chairM); back.position.set(0, 0.74, -0.27); c.add(back);
    for (const sx of [-1, 1]) { const arm = new THREE.Mesh(softBox(0.12, 0.3, 0.58, 0.04), chairM); arm.position.set(sx * 0.33, 0.55, 0); c.add(arm); }
  }
  box(0.45, 0.04, 0.45, -5.8, FL + 0.55, 0, woodM);
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.15, 18, 1, true), new THREE.MeshLambertMaterial({ color: '#f0c890', emissive: '#f0b070', emissiveIntensity: 0.6, side: THREE.DoubleSide })); lampShade.position.set(-5.8, FL + 0.9, 0); G.add(lampShade);
  const ls = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), brass); ls.position.set(-5.8, FL + 0.72, 0); G.add(ls);
  // the tail lamp, glowing red on the back of the train
  const tail = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff3020', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 })); tail.scale.set(0.9, 0.9, 1); tail.position.set(xr - 0.25, 1.1, 0.9); G.add(tail);
  const light = new THREE.PointLight('#ffc890', 0, 10, 1); light.position.set(-5.8, FL + 1.5, 0); G.add(light);
  return { group: G, light, SEAT: [-7.2, 0.75] };
}
