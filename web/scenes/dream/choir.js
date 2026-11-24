// The Midnight Choir: an old stone church at midnight. Candles flicker on the altar and along the
// pews, the stained glass glows with moonlight, pale shafts fall across the nave, and a small
// choir in red and white sways gently as it sings. Dust hangs in the air. We drift slowly up
// the aisle towards them, and back.
import { createStage, motes, shaft, box, cyl, canvasTexture, THREE, TAU } from '../kit.js';
import { person } from '../figures.js';
import { surface, room, candle } from '../interior.js';

export function createChoirScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xc401, bg: '#07070c', fog: { color: '#120f16', near: 8, far: 55 }, exposure: 1.1, bloom: [0.75, 0.55, 0.55], finish: { vignette: 0.52, grain: 0.024, ca: 0.35 }, fov: 56 });
  const { rand } = S;
  const W = 13, L = 32, H = 10;
  room(S, { w: W, d: L, h: H, floor: surface(S, 'stone', { color: '#5c574e' }), walls: surface(S, 'stone', { color: '#8a8070' }), ceiling: surface(S, 'planks', { color: '#2c2219' }) });
  S.add(new THREE.HemisphereLight('#6a7ab0', '#3a2c20', 1.3));

  // the arcade: two rows of columns, round arches between them
  const stone = S.mat('#9a907e');
  for (const side of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const z = -12 + k * 4;
      cyl(S, 0.38, 0.42, 5.2, '#9a907e', [side * 4, 2.6, z], 14);
      box(S, [1, 0.3, 1], '#857b6a', [side * 4, 5.35, z]);
      box(S, [1, 0.25, 1], '#857b6a', [side * 4, 0.12, z]);
      if (k < 6) { const a = new THREE.Mesh(new THREE.TorusGeometry(2, 0.3, 8, 20, Math.PI), stone); a.rotation.y = Math.PI / 2; a.position.set(side * 4, 5.5, z + 2); S.add(a); }
    }
    box(S, [0.6, H - 7.8, L], '#857b6a', [side * 4, 7.8 + (H - 7.8) / 2 - 0.3, 0]);
  }
  // roof trusses
  for (let z = -14; z <= 14; z += 4) { const b = box(S, [W, 0.35, 0.35], '#2a1f16', [0, H - 0.4, z]); b.castShadow = false; }

  // stained glass: tall lancets down both sides, a rose window over the altar
  const glass = (w, h, rose) => canvasTexture(S, rose ? 256 : 128, rose ? 256 : 256, (g, cw, ch) => {
    g.fillStyle = '#0d0b10'; g.fillRect(0, 0, cw, ch);
    const COLS = ['#2a4fb8', '#b8263a', '#e8b23a', '#2f8a4a', '#7a3ab0', '#3aa0c8'];
    if (rose) {
      for (let r = 6; r > 0; r--) for (let k = 0; k < 12; k++) { g.fillStyle = COLS[(k + r) % COLS.length]; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, r * 20, (k / 12) * TAU + 0.02, ((k + 1) / 12) * TAU - 0.02); g.closePath(); g.fill(); }
      g.fillStyle = '#f2d27a'; g.beginPath(); g.arc(128, 128, 16, 0, TAU); g.fill();
      g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.arc(128, 128, 124, 0, TAU); g.fill();
    } else {
      for (let y = 0; y < ch; y += 22) for (let x = 0; x < cw; x += 22) { g.fillStyle = COLS[Math.floor(rand() * COLS.length)]; g.fillRect(x + 2, y + 2, 18, 18); }
      g.fillStyle = '#f2d27a'; g.beginPath(); g.arc(cw / 2, ch * 0.42, 22, 0, TAU); g.fill();
      g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.moveTo(8, ch); g.lineTo(8, cw / 2); g.arc(cw / 2, cw / 2, cw / 2 - 8, Math.PI, 0); g.lineTo(cw - 8, ch); g.fill();
    }
  });
  const panes = [];
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const z = -10 + k * 6.5, x = side * (W / 2 - 0.03);
    const tex = glass(1.4, 3.2, false);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, color: '#9aa4c8' }));
    m.position.set(x, 6.4, z); m.rotation.y = -side * Math.PI / 2; S.add(m); panes.push(m);
  }
  const rose = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: glass(4, 4, true), transparent: true, toneMapped: false, color: '#a0a8d0' }));
  rose.position.set(0, 7, -L / 2 + 0.03); S.add(rose); panes.push(rose);
  // moonlight through the left-hand windows, falling across the nave
  for (let k = 0; k < 4; k++) shaft(S, { from: [-W / 2 + 0.1, 6.4, -10 + k * 6.5], to: [1.5, 0, -8 + k * 6.5], r0: 0.6, r1: 1.6, color: '#a9b8ff', opacity: 0.11 });

  // pews down both sides of the aisle, a candle at the end of every other row
  const pewMat = S.mat('#4a2e1c');
  for (const side of [-1, 1]) for (let k = 0; k < 8; k++) {
    const z = -3 + k * 1.6, x = side * 2.4;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.45), pewMat); seat.position.set(x, 0.48, z); S.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 0.06), pewMat); back.position.set(x, 0.8, z + 0.24); S.add(back);
    for (const e of [-1.6, 1.6]) { const end = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 0.5), pewMat); end.position.set(x + e, 0.52, z + 0.03); S.add(end); }
    if (k % 2 === 0) { cyl(S, 0.04, 0.06, 1.1, '#3a3028', [side * 0.75, 0.55, z], 8); candle(S, { pos: [side * 0.75, 1.1, z], h: 0.2, light: k % 4 === 0, intensity: 3, distance: 6 }); }
  }

  // the chancel: a step, the altar with its candles, and the choir
  box(S, [W - 1, 0.3, 7], '#6d665a', [0, 0.15, -L / 2 + 3.5]);
  box(S, [3, 1, 1], '#d8d0c0', [0, 0.8, -L / 2 + 1.2]);
  box(S, [3.1, 0.06, 1.05], '#f4efe4', [0, 1.33, -L / 2 + 1.2]);
  const cross = new THREE.Group(); cross.position.set(0, 1.9, -L / 2 + 1.1); S.add(cross);
  for (const [w, h] of [[0.05, 0.9], [0.45, 0.05]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), S.mat('#d8b25a', { emissive: '#4a3410' })); c.position.y = h > 0.5 ? 0 : 0.15; cross.add(c); }
  for (let k = 0; k < 6; k++) { const x = -1.3 + k * 0.52; cyl(S, 0.04, 0.06, 0.1, '#c9a24a', [x, 1.41, -L / 2 + 1.2], 8); candle(S, { pos: [x, 1.46, -L / 2 + 1.2], h: 0.3 + (k % 3) * 0.08, light: k === 1 || k === 4, intensity: 7, distance: 11 }); }
  // tall candle stands either side of the choir
  for (const x of [-4.6, 4.6]) { cyl(S, 0.05, 0.12, 1.6, '#3a3028', [x, 1.1, -L / 2 + 4.5], 8); candle(S, { pos: [x, 1.9, -L / 2 + 4.5], h: 0.35, r: 0.05, light: true, intensity: 9, distance: 12 }); }

  const singers = [];
  const N = mobile ? 7 : 8;
  for (let k = 0; k < N; k++) {
    const u = k / (N - 1) - 0.5, row = k % 2;
    const p = person(S, { kind: 'choir', pos: [u * 6.5, 0.3 + row * 0.15, -L / 2 + 4 - row * 0.9 + Math.abs(u) * 1.2], ry: -u * 0.5, skin: ['#e9c2a0', '#c99a72', '#8a5a3a', '#f1d1b5'][k % 4] });
    singers.push(p);
  }
  // the choir breathes with the music: on each new chord they lift a little, together
  let lift = 0;
  S.onEvent((ev) => { if (ev.type === 'chord') lift = 1; });
  S.on((t, dt) => {
    lift *= Math.exp(-dt * 0.6);
    singers.forEach((p, k) => { p.head.rotation.x = -0.12 * lift + Math.sin(t * 0.4 + k) * 0.03; });
    panes.forEach((m, k) => m.material.color.setHSL(0.63, 0.25, 0.62 + 0.05 * Math.sin(t * 0.07 + k)));
  });
  motes(S, { kind: 'dust', count: mobile ? 300 : 500, box: [W - 1, H - 1, L - 2], center: [0, H / 2, 0], color: '#ffe6c0', size: 0.035, speed: 0.5 });

  // walk slowly up the aisle towards the choir, and back
  S.on((t, dt, st) => {
    const u = 0.5 + 0.5 * Math.sin(t * 0.014 * (0.6 + 0.4 * st.energy) - 1.5);
    const z = 13 - u * 13;
    S.camera.position.set(Math.sin(t * 0.04) * 0.4, 1.7 + u * 0.3, z);
    S.camera.lookAt(Math.sin(t * 0.027) * 1.2, 2.1 + (1 - u) * 1.4, -L / 2 + 2);
  });
  return S.finalize({ portraitFov: 72 });
}
