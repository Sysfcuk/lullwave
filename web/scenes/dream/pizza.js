// The Pineapple Pizza Incident: a little pizzeria after closing. The wood-fired oven still glows,
// the chef kneads tomorrow's dough at the counter, candles burn in old bottles on checked
// tablecloths, fairy lights loop across the ceiling, and a sign on the wall is very clear about
// pineapple. And yet... every so often, a pineapple appears on the counter. The chef turns to
// look at it. It is gone. Now and then one rolls, very slowly, across the floor.
import { createStage, motes, stringLights, glowMaterial, canvasTexture, box, cyl, smoke, THREE, TAU } from '../kit.js';
import { person } from '../figures.js';
import { surface, room, fire, candle, softBox } from '../interior.js';

function pineapple(S) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), S.mat('#c99a2a')); body.scale.set(1, 1.35, 1); body.position.y = 0.16; g.add(body);
  const dots = new THREE.Mesh(new THREE.SphereGeometry(0.123, 8, 6), new THREE.MeshLambertMaterial({ color: '#7a5a1a', wireframe: true })); dots.scale.set(1, 1.35, 1); dots.position.y = 0.16; g.add(dots);
  for (let k = 0; k < 9; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.2, 4), S.mat('#3f7a2a')); const a = (k / 9) * TAU; l.position.set(Math.cos(a) * 0.03, 0.4, Math.sin(a) * 0.03); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(l); }
  S.add(g);
  return g;
}

export function createPizzaScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x9122, bg: '#0c0806', fog: { color: '#1a100a', near: 6, far: 30 }, exposure: 1.1, bloom: [0.7, 0.55, 0.55], finish: { vignette: 0.5, grain: 0.026, ca: 0.35 }, fov: 58 });
  const { rand } = S;
  const W = 10, D = 9, H = 3.4;
  room(S, { w: W, d: D, h: H, floor: surface(S, 'tiles', { color: '#9a4a32' }), walls: surface(S, 'brick', { color: '#9a5a3a' }), ceiling: surface(S, 'planks', { color: '#4a3220' }) });
  S.add(new THREE.HemisphereLight('#9a8aa8', '#4a3020', 0.95));
  for (let z = -3; z <= 3; z += 2) box(S, [W, 0.2, 0.24], '#3a2616', [0, H - 0.1, z]); // beams

  // the oven: a brick dome in the back wall, its mouth glowing
  const oz = -D / 2 + 1.1;
  box(S, [2.6, 1, 1.8], '#7a4a32', [0, 0.5, oz]);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 14, 0, TAU, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ map: surface(S, 'brick', { color: '#a0603a', repeat: [3, 2] }) })); dome.position.set(0, 1, oz); dome.scale.set(1, 0.9, 0.75); S.add(dome);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24, 0, Math.PI), glowMaterial(S, '#ff7a2a', 0.85, false)); mouth.position.set(0, 1, oz + 0.92); S.add(mouth);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 20, Math.PI), S.mat('#6a3a22')); arch.position.set(0, 1, oz + 0.93); S.add(arch);
  fire(S, { pos: [0, 1.02, oz + 0.75], width: 0.5, intensity: 5, distance: 9, flames: 4 });
  box(S, [0.5, 1.6, 0.5], '#8a5232', [0, 2.6, oz - 0.3]);
  motes(S, { kind: 'spark', count: 24, box: [0.6, 1.5, 0.3], center: [0, 1.7, oz + 0.85], color: '#ffa24a', size: 0.03, speed: 0.4 });

  // the counter, the chef, and tomorrow's dough
  { const pt = surface(S, 'planks', { color: '#7a4e30', repeat: [3, 1] }); const ctr = new THREE.Mesh(softBox(3.4, 1, 0.8, 0.03), S.keep(new THREE.MeshLambertMaterial({ map: pt }))); ctr.position.set(0, 0.5, -0.6); S.add(ctr);
    for (let k = 0; k < 3; k++) { const pnl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), S.mat('#5a3620')); pnl.position.set(-1.1 + k * 1.1, 0.48, -0.195); S.add(pnl); } }
  box(S, [3.5, 0.06, 0.9], '#d8d0c0', [0, 1.03, -0.6]);
  const dough = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), S.mat('#f1e2c4')); dough.scale.y = 0.45; dough.position.set(1.05, 1.1, -0.6); S.add(dough);
  const peel = new THREE.Group(); peel.position.set(-1.25, 1.07, -0.5); peel.rotation.y = 0.4; S.add(peel);
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 20), S.mat('#b08a5a')); peel.add(b); const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.9), S.mat('#9a7448')); h.position.z = 0.6; peel.add(h); }
  for (const [x, c] of [[-0.05, '#c0392b'], [0.2, '#f1e2c4'], [0.45, '#3f7a2a']]) cyl(S, 0.08, 0.07, 0.12, c, [x, 1.12, -0.45], 12); // toppings: tomato, cheese, basil
  const chef = person(S, { kind: 'chef', pos: [1.05, 0, -1.3], ry: -0.15, skin: '#d9a882' });
  S.on((t) => { dough.scale.set(1 + Math.sin(t * 1.6) * 0.06, 0.45 - Math.sin(t * 1.6) * 0.04, 1 + Math.cos(t * 1.6) * 0.04); });

  // shelves of jars and oil either side of the oven
  for (const sx of [-1, 1]) for (let r = 0; r < 2; r++) {
    const x = sx * 2.7, y = 1.6 + r * 0.6, z = -D / 2 + 0.18;
    box(S, [1.6, 0.05, 0.3], '#5a3620', [x, y, z]);
    for (let k = 0; k < 6; k++) { const jx = x - 0.65 + k * 0.26; if (rand() < 0.15) continue; const tall = rand() < 0.4; const j = new THREE.Mesh(new THREE.CylinderGeometry(tall ? 0.04 : 0.07, tall ? 0.06 : 0.07, tall ? 0.32 : 0.18, 10), S.mat(tall ? ['#3a5a2a', '#5a2a1a', '#c9a24a'][k % 3] : ['#d8a050', '#c0392b', '#e8dcc0', '#7a4a2a'][k % 4])); j.position.set(jx, y + (tall ? 0.18 : 0.11), z); S.add(j); }
  }
  // copper pans hanging over the counter
  box(S, [2.4, 0.04, 0.04], '#3a2a1a', [0, 2.45, -0.6]);
  for (let k = 0; k < 5; k++) { const x = -1 + k * 0.5, r = 0.12 + (k % 3) * 0.03; const pan = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 0.08, 16), S.mat('#b8693a', { emissive: '#1a0a02' })); pan.rotation.x = Math.PI / 2; pan.position.set(x, 2.25 - r, -0.6); S.add(pan); cyl(S, 0.012, 0.012, 0.22, '#3a2a1a', [x, 2.36, -0.6], 4); }
  // firewood stacked by the oven
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), S.mat(k % 2 ? '#5a3a22' : '#6a4428')); lg.rotation.x = Math.PI / 2; lg.position.set(1.85 + k * 0.19 + r * 0.095, 0.09 + r * 0.16, oz + 0.3); S.add(lg); }
  // framed pictures of the old country
  for (const [x, z, ry, sky] of [[-W / 2 + 0.02, 1.6, Math.PI / 2, '#e8a070'], [W / 2 - 0.02, 2.6, -Math.PI / 2, '#7aa0d0']]) {
    const tx = canvasTexture(S, 200, 140, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, sky); gr.addColorStop(1, '#f2e0b0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#3a6a8a'; g.fillRect(0, h * 0.62, w, h); g.fillStyle = '#8a6a4a'; g.beginPath(); g.moveTo(w * 0.2, h * 0.62); g.lineTo(w * 0.45, h * 0.3); g.lineTo(w * 0.7, h * 0.62); g.fill(); g.strokeStyle = '#6a4a2a'; g.lineWidth = 12; g.strokeRect(0, 0, w, h); });
    const pc = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.7), new THREE.MeshLambertMaterial({ map: tx })); pc.position.set(x, 2, z); pc.rotation.y = ry; S.add(pc);
  }

  // the tables: checked cloths, candles in bottles, chairs tucked in
  const check = canvasTexture(S, 128, 128, (g) => { g.fillStyle = '#f2ede2'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(190,40,40,.75)'; for (let k = 0; k < 8; k++) { g.fillRect(k * 16, 0, 8, 128); g.fillRect(0, k * 16, 128, 8); } });
  check.wrapS = check.wrapT = THREE.RepeatWrapping; check.repeat.set(2, 2);
  const cloth = new THREE.MeshLambertMaterial({ map: check });
  const TABLES = [[-3, 1.4], [3, 1.4], [-2.6, 3.4], [2.6, 3.4], [0, 1.75]];
  TABLES.forEach(([x, z], i) => {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 24), cloth); top.position.set(x, 0.76, z); S.add(top);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.7, 0.3, 24, 1, true), cloth); drape.position.set(x, 0.62, z); S.add(drape);
    cyl(S, 0.05, 0.08, 0.72, '#2a1e16', [x, 0.36, z], 8);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.24, 10), new THREE.MeshLambertMaterial({ color: '#2a5a3a', emissive: '#0a2010' })); bottle.position.set(x, 0.9, z); S.add(bottle);
    candle(S, { pos: [x, 1.02, z], h: 0.12, r: 0.025, light: i % 2 === 0, intensity: 1.4, distance: 4 });
    for (let c = 0; c < 2; c++) { const a = c * Math.PI + (i % 2 ? 0.25 : -0.25), cx = x + Math.cos(a) * 0.85, cz = z + Math.sin(a) * 0.85; box(S, [0.42, 0.06, 0.42], '#6a4028', [cx, 0.46, cz], a); const back = box(S, [0.42, 0.5, 0.05], '#6a4028', [cx + Math.cos(a) * 0.2, 0.72, cz + Math.sin(a) * 0.2], -a + Math.PI / 2); void back; }
  });

  // fairy lights looping across the ceiling
  for (let k = 0; k < 4; k++) stringLights(S, [-W / 2 + 0.2, H - 0.25, -3 + k * 2.2], [W / 2 - 0.2, H - 0.25, -2 + k * 2.2], { sag: 0.45, count: 22, size: 0.09 });

  // the sign. Very clear.
  const signTex = canvasTexture(S, 320, 220, (g, w, h) => {
    g.fillStyle = '#1e2a22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b26a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#f2ede2'; g.textAlign = 'center'; g.font = 'bold 44px Georgia, serif'; g.fillText('NO', w / 2, 58); g.font = 'bold 36px Georgia, serif'; g.fillText('PINEAPPLE', w / 2, 200);
    g.fillStyle = '#d9a52a'; g.beginPath(); g.ellipse(w / 2, 118, 26, 36, 0, 0, TAU); g.fill(); g.fillStyle = '#3f8a2a'; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(w / 2 + k * 6, 84); g.lineTo(w / 2 + k * 14, 62); g.lineTo(w / 2 + k * 6 + 4, 84); g.fill(); }
    g.strokeStyle = '#e04040'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, 112, 50, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(w / 2 - 35, 77); g.lineTo(w / 2 + 35, 147); g.stroke();
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.82), new THREE.MeshLambertMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.25 })); sign.position.set(-W / 2 + 0.02, 2.1, -1.4); sign.rotation.y = Math.PI / 2; S.add(sign);
  // a menu board and a shelf of oil and wine on the other wall
  const menuTex = canvasTexture(S, 256, 320, (g, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#efe9dc'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('Menu', w / 2, 44); g.font = '20px Georgia, serif'; ['Margherita', 'Marinara', 'Funghi', 'Quattro Formaggi', 'Diavola', 'Dreamy Calzone'].forEach((s, k) => g.fillText(s, w / 2, 96 + k * 36)); g.font = 'italic 16px Georgia, serif'; g.fillText('(no exceptions)', w / 2, 304); });
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.12), new THREE.MeshLambertMaterial({ map: menuTex, emissive: '#ffffff', emissiveMap: menuTex, emissiveIntensity: 0.2 })); menu.position.set(W / 2 - 0.02, 2, -1); menu.rotation.y = -Math.PI / 2; S.add(menu);
  box(S, [0.25, 0.05, 1.8], '#4a3020', [W / 2 - 0.13, 1.3, 1.6]);
  for (let k = 0; k < 6; k++) cyl(S, 0.035, 0.045, 0.3, k % 2 ? '#3a1a2a' : '#5a6a2a', [W / 2 - 0.13, 1.48, 0.9 + k * 0.28], 8);
  smoke(S, { pos: [0, 2.3, oz + 0.6], color: '#d8c8b8', rise: 1, spread: 0.4, size: 0.4, rate: 0.05, opacity: 0.06 });

  // the incident: a pineapple appears on the counter; the chef turns, slowly; it is gone
  const pa = pineapple(S); pa.position.set(-0.7, 1.06, -0.45); pa.scale.setScalar(0.001);
  const roller = pineapple(S); roller.scale.setScalar(0.001);
  let showAt = 20 + rand() * 15, showFor = 0, rollAt = 50 + rand() * 30, rollT = -1, look = 0;
  S.on((t, dt) => {
    // on the counter
    if (t > showAt) { showFor = 1; showAt = t + 45 + rand() * 35; }
    const vis = showFor > 0 ? Math.min(1, (1 - showFor) * 8, showFor * 4) : 0;
    if (showFor > 0) showFor = Math.max(0, showFor - dt / 14);
    pa.scale.setScalar(0.001 + vis * 0.999);
    look += ((showFor > 0.15 && showFor < 0.85 ? 1 : 0) - look) * Math.min(1, dt * 0.8);
    chef.head.rotation.y = -look * 0.9 + Math.sin(t * 0.2) * 0.3 * (1 - look);
    chef.head.rotation.z = look * 0.12;
    // across the floor
    if (t > rollAt && rollT < 0) { rollT = 0; rollAt = t + 70 + rand() * 50; }
    if (rollT >= 0) {
      rollT += dt / 26;
      const x = -W / 2 + 0.6 + rollT * (W - 1.2);
      roller.position.set(x, 0, 0.6 + Math.sin(rollT * 3) * 0.2); roller.rotation.set(0, 0, -rollT * 18); roller.scale.setScalar(1);
      if (rollT >= 1) { rollT = -1; roller.scale.setScalar(0.001); }
    }
  });

  // a gentle swing round the room
  let ang = 0;
  S.on((t, dt, st) => {
    ang += dt * 0.012 * (0.55 + 0.45 * st.energy);
    const A = Math.sin(ang) * 0.6;
    S.camera.position.set(Math.sin(A) * 4.2, 1.8 + Math.sin(t * 0.05) * 0.08, 0.2 + Math.cos(A) * 4.2);
    S.camera.lookAt(Math.sin(A) * 0.6, 1.05, -1.2);
  });
  return S.finalize({ portraitFov: 76 });
}
