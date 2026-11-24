// Penny's Night Patrol: a cosy country-house sitting room after everyone has gone to bed. The
// fire has burned down to embers, the moon looks in through the window, and Penny the cat makes
// her rounds: along the rug, past the bookcase, up onto the sofa, over to the window, leaving a
// trail of softly glowing paw prints that fade behind her. Now and then she sits and surveys
// her kingdom.
import { createStage, motes, box, cyl, canvasTexture, THREE, TAU } from '../kit.js';
import { cat } from '../figures.js';
import { surface, room, moonWindow, fire, candle } from '../interior.js';

export function createPennyScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x9e77, bg: '#0a0806', fog: { color: '#140e0a', near: 6, far: 30 }, exposure: 1.1, bloom: [0.6, 0.5, 0.62], finish: { vignette: 0.5, grain: 0.026, ca: 0.3 }, fov: 60 });
  const { rand } = S;
  const W = 9, D = 8, H = 3.2;
  room(S, { w: W, d: D, h: H, floor: surface(S, 'planks', { color: '#6a4a30' }), walls: surface(S, 'plaster', { color: '#5a6a58' }), ceiling: surface(S, 'plaster', { color: '#d8cfbf' }) });
  S.add(new THREE.HemisphereLight('#8a96c0', '#4a3424', 1.1));
  const moon = new THREE.DirectionalLight('#9fb4ee', 0.3); moon.position.set(5, 4, 2); S.add(moon);
  box(S, [W, 0.12, 0.04], '#3a2a1c', [0, 0.06, -D / 2 + 0.03]); // skirting

  // the fireplace, burned down to embers
  box(S, [2.4, 1.4, 0.5], '#e8e0d0', [0, 0.7, -D / 2 + 0.25]);
  box(S, [1.3, 0.9, 0.52], '#120c08', [0, 0.45, -D / 2 + 0.26]);
  box(S, [2.7, 0.1, 0.65], '#d8d0c0', [0, 1.45, -D / 2 + 0.33]);
  fire(S, { pos: [0, 0.12, -D / 2 + 0.45], width: 0.7, intensity: 7, distance: 9, flames: 4 });
  for (const x of [-1, 1]) { cyl(S, 0.05, 0.06, 0.04, '#b08a3a', [x * 0.9, 1.52, -D / 2 + 0.35], 8); candle(S, { pos: [x * 0.9, 1.54, -D / 2 + 0.35], h: 0.22, light: x > 0, intensity: 1, distance: 5 }); }
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), S.mat('#c9b27a')); clock.rotation.x = Math.PI / 2; clock.position.set(0, 1.68, -D / 2 + 0.33); S.add(clock);
  // a painting above it
  const art = canvasTexture(S, 256, 180, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a3a6a'); gr.addColorStop(0.6, '#c98a5a'); gr.addColorStop(1, '#3a5a2a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#2a4a22'; g.beginPath(); g.moveTo(0, h * 0.7); for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.65 + Math.sin(x * 0.03) * 14); g.lineTo(w, h); g.lineTo(0, h); g.fill(); g.strokeStyle = '#8a6a2a'; g.lineWidth = 14; g.strokeRect(0, 0, w, h); });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), new THREE.MeshLambertMaterial({ map: art })); pic.position.set(0, 2.35, -D / 2 + 0.02); S.add(pic);

  // the rug
  const rugTex = canvasTexture(S, 256, 192, (g, w, h) => { g.fillStyle = '#7a2a2a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b26a'; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24); g.strokeStyle = '#2a3a5a'; g.lineWidth = 10; g.strokeRect(28, 28, w - 56, h - 56); g.fillStyle = '#d8b26a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(w / 2, h / 2, 50 - k * 9, 0, TAU); g.globalAlpha = 0.25; g.fill(); } g.globalAlpha = 1; });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), new THREE.MeshLambertMaterial({ map: rugTex })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, -1.2); S.add(rug);

  // the sofa (facing the fire) and an armchair beside it
  const sofaCol = '#3a4a6a';
  const sofa = new THREE.Group(); sofa.position.set(0, 0, 0.9); S.add(sofa);
  for (const [w, h, d, x, y, z] of [[2.4, 0.42, 0.9, 0, 0.21, 0], [2.4, 0.6, 0.22, 0, 0.6, 0.38], [0.22, 0.6, 0.9, -1.2, 0.4, 0], [0.22, 0.6, 0.9, 1.2, 0.4, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), S.mat(sofaCol)); m.position.set(x, y, z); sofa.add(m); }
  for (const x of [-0.58, 0.58]) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.72), S.mat('#45577a')); c.position.set(x, 0.49, -0.05); sofa.add(c); }
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.14), S.mat('#c9a24a')); cushion.position.set(-0.85, 0.75, 0.22); cushion.rotation.set(-0.3, 0.3, 0.2); sofa.add(cushion);
  const throwB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.95), S.mat('#a8603a')); throwB.position.set(0.7, 0.92, 0.3); throwB.rotation.x = -0.6; sofa.add(throwB);
  const chair = new THREE.Group(); chair.position.set(2.6, 0, -0.6); chair.rotation.y = -1.1; S.add(chair);
  for (const [w, h, d, x, y, z] of [[1, 0.45, 0.9, 0, 0.22, 0], [1, 0.7, 0.2, 0, 0.75, 0.36], [0.2, 0.62, 0.9, -0.5, 0.42, 0], [0.2, 0.62, 0.9, 0.5, 0.42, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), S.mat('#6a3a2a')); m.position.set(x, y, z); chair.add(m); }

  // a bookcase, full
  const bc = new THREE.Group(); bc.position.set(-W / 2 + 0.25, 0, -1.4); bc.rotation.y = Math.PI / 2; S.add(bc);
  const bcBack = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 0.4), S.mat('#3a2818')); bcBack.position.y = 1.2; bc.add(bcBack);
  const bookCols = ['#7a2a2a', '#2a4a6a', '#3a5a2a', '#8a6a2a', '#5a2a4a', '#2a2a2a', '#a88a5a'];
  for (let sh = 0; sh < 5; sh++) {
    let x = -0.9;
    while (x < 0.85) { const bw = 0.04 + rand() * 0.05, bh = 0.28 + rand() * 0.12; const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.26), S.mat(bookCols[Math.floor(rand() * bookCols.length)])); b.position.set(x + bw / 2, 0.12 + sh * 0.46 + bh / 2, 0.08); b.rotation.z = rand() < 0.08 ? 0.25 : 0; bc.add(b); x += bw + 0.005; }
  }
  // a side table with a lamp (off) and a cup
  box(S, [0.5, 0.6, 0.5], '#4a3020', [-1.7, 0.3, 0.8]);
  cyl(S, 0.05, 0.04, 0.09, '#e8e2d6', [-1.65, 0.65, 0.75], 10);

  // the window, and the moon looking in
  const winTex = canvasTexture(S, 128, 192, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1838'); gr.addColorStop(1, '#2a3a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#f4efd8'; g.beginPath(); g.arc(84, 52, 16, 0, TAU); g.fill(); g.fillStyle = '#fff'; for (let k = 0; k < 30; k++) g.fillRect(Math.random() * w, Math.random() * h * 0.7, 1.5, 1.5); g.fillStyle = '#0a1420'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.78 - Math.sin(x * 0.08) * 8 - (x > 30 && x < 60 ? 30 : 0)); g.lineTo(w, h); g.fill(); g.fillStyle = '#2a1e16'; g.fillRect(w / 2 - 3, 0, 6, h); g.fillRect(0, h / 2 - 3, w, 6); });
  moonWindow(S, { pos: [W / 2 - 0.02, 1.7, 1.2], ry: -Math.PI / 2, w: 1.2, h: 1.6, tex: winTex, to: [1.2, 0, 0.4], shaftOpacity: 0.11 });
  box(S, [0.35, 0.06, 1.5], '#e8e0d0', [W / 2 - 0.18, 0.87, 1.2]); // window seat
  for (const dz of [-0.95, 0.95]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.45), S.mat('#7a3a3a')); c.position.set(W / 2 - 0.1, 1.8, 1.2 + dz); S.add(c); }

  // Penny's rounds: a loop through the room, up onto the sofa and the window seat and down again
  const route = new THREE.CatmullRomCurve3([
    [-1.2, 0, -1.6], [0, 0, -2.4], [1.4, 0, -1.8], [1.9, 0, -0.4], [3.2, 0, 0.3], [W / 2 - 0.45, 0.9, 1.0], [W / 2 - 0.45, 0.9, 1.6], [3.2, 0, 2.3], [1.5, 0, 2.6], [0.9, 0.62, 1.0], [-0.9, 0.62, 0.95], [-2.2, 0, 2.2], [-3.4, 0, 0.6], [-3.2, 0, -1.2],
  ].map((p) => new THREE.Vector3(...p)), true, 'centripetal');
  const len = route.getLength();
  const penny = cat(S, { coat: '#6a5040', stripe: '#2e221a', belly: '#ece6dc', pose: 'walk', scale: 1.15 });

  // glowing paw prints, laid down as she walks and fading away
  const pawTex = canvasTexture(S, 64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 40, 13, 11, 0, 0, TAU); g.fill(); for (const [x, y] of [[16, 22], [27, 14], [38, 14], [49, 22]]) { g.beginPath(); g.ellipse(x, y, 5.5, 7, 0, 0, TAU); g.fill(); } });
  const MAXP = 48;
  const prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.09).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: pawTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), MAXP);
  prints.frustumCulled = false; S.add(prints);
  const born = new Float32Array(MAXP).fill(-99), col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < MAXP; i++) { prints.setMatrixAt(i, m4.makeTranslation(0, -5, 0)); prints.setColorAt(i, col.setRGB(0, 0, 0)); }
  let pi = 0, lastPrint = 0, side = 1;

  let s = 0, sitUntil = 0, nextSit = 25 + rand() * 20;
  const p = new THREE.Vector3(), a = new THREE.Vector3();
  S.on((t, dt, st) => {
    if (t > nextSit) { sitUntil = t + 7 + rand() * 5; nextSit = t + 35 + rand() * 30; }
    const walking = t > sitUntil;
    penny.pose = walking ? 'walk' : 'sit';
    if (walking) s = (s + dt * (0.32 + 0.12 * st.energy)) % len;
    route.getPointAt(s / len, p); route.getPointAt(((s + 0.15) % len) / len, a);
    penny.group.position.copy(p);
    const yaw = Math.atan2(a.x - p.x, a.z - p.z);
    penny.group.rotation.y = walking ? yaw : yaw + Math.sin(t * 0.4) * 0.6;
    if (walking && s - lastPrint > 0.16 || s < lastPrint - 1) {
      lastPrint = s; side = -side;
      v.set(Math.cos(yaw) * 0.05 * side, 0.012, -Math.sin(yaw) * 0.05 * side).add(p);
      prints.setMatrixAt(pi, m4.compose(v, q.setFromAxisAngle(up, yaw), sc)); born[pi] = t; pi = (pi + 1) % MAXP;
      prints.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < MAXP; i++) { const age = t - born[i], f = age < 0.4 ? age / 0.4 : Math.max(0, 1 - (age - 0.4) / 10); prints.setColorAt(i, col.setRGB(1, 0.72, 0.35).multiplyScalar(f * 0.9)); }
    prints.instanceColor.needsUpdate = true;
  });

  motes(S, { kind: 'dust', count: mobile ? 160 : 260, box: [W - 1, H - 0.4, D - 1], center: [0, H / 2, 0], color: '#ffe6c0', size: 0.025, speed: 0.5 });
  // swing slowly round the room, keeping half an eye on Penny
  let ang = 0;
  const look = new THREE.Vector3(0, 0.4, -0.5), want = new THREE.Vector3();
  S.on((t, dt, st) => {
    ang += dt * 0.01 * (0.55 + 0.45 * st.energy);
    const A = 0.55 + Math.sin(ang) * 0.85;
    S.camera.position.set(Math.sin(A) * 3.2, 2.05 + Math.sin(t * 0.06) * 0.08, 0.3 + Math.cos(A) * 3.1);
    want.set(p.x * 0.6, 0.3 + p.y * 0.6, p.z * 0.6 - 0.4);
    look.lerp(want, Math.min(1, dt * 0.4));
    S.camera.lookAt(look);
  });
  return S.finalize({ portraitFov: 76 });
}
