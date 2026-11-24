// Interiors for the dream worlds: rooms with painted walls and floors (stone, brick, plaster,
// boards), windows that let the moonlight in as shafts full of dust, candles and fires that
// flicker, and a few bits of furniture.
import { THREE, canvasTexture, shaft, TAU } from './kit.js';

/** Painted textures: 'stone' blocks, 'brick', 'planks', 'plaster', 'tiles' (checkerboard). */
export function surface(S, kind, { color = '#8a7a66', repeat = [4, 4] } = {}) {
  const base = new THREE.Color(color);
  const tex = canvasTexture(S, 256, 256, (g, w, h) => {
    g.fillStyle = base.getStyle(); g.fillRect(0, 0, w, h);
    const shade = (k) => base.clone().multiplyScalar(k).getStyle();
    if (kind === 'stone' || kind === 'brick') {
      const rows = kind === 'brick' ? 12 : 6, bw = kind === 'brick' ? 42 : 64;
      for (let r = 0; r < rows; r++) for (let c = -1; c < w / bw + 1; c++) {
        const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * (h / rows);
        g.fillStyle = shade(0.82 + Math.random() * 0.3); g.fillRect(x + 2, y + 2, bw - 4, h / rows - 4);
      }
    } else if (kind === 'planks') {
      for (let i = 0; i < 8; i++) { g.fillStyle = shade(0.8 + Math.random() * 0.3); g.fillRect(i * 32 + 1, 0, 30, h); g.fillStyle = shade(0.6); g.fillRect(i * 32 + 1, (i * 77) % h, 30, 2); }
      g.strokeStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 40; k++) { const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 6, h); g.stroke(); }
    } else if (kind === 'tiles') {
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { g.fillStyle = (r + c) % 2 ? shade(1) : '#efe9dc'; g.fillRect(c * 32, r * 32, 32, 32); }
    } else { // plaster: soft mottling
      for (let k = 0; k < 400; k++) { g.fillStyle = shade(0.92 + Math.random() * 0.16); g.globalAlpha = 0.25; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 18, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat);
  return tex;
}

/** A room: floor, ceiling and four walls (seen from inside), each with its own surface. */
export function room(S, { w = 10, d = 10, h = 4, floor, walls, ceiling, pos = [0, 0, 0] }) {
  const g = new THREE.Group(); g.position.set(...pos);
  const plane = (pw, ph, mat, p, r) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat); m.position.set(...p); m.rotation.set(...r); m.receiveShadow = true; g.add(m); return m; };
  const mat = (tex, rep) => { if (tex.isTexture) { const t = tex.clone(); t.repeat.set(...rep); t.needsUpdate = true; S.keep(t); return new THREE.MeshLambertMaterial({ map: t }); } return S.mat(tex); };
  plane(w, d, mat(floor, [w / 3, d / 3]), [0, 0, 0], [-Math.PI / 2, 0, 0]);
  plane(w, d, mat(ceiling, [w / 3, d / 3]), [0, h, 0], [Math.PI / 2, 0, 0]);
  plane(w, h, mat(walls, [w / 4, h / 4]), [0, h / 2, -d / 2], [0, 0, 0]);
  plane(w, h, mat(walls, [w / 4, h / 4]), [0, h / 2, d / 2], [0, Math.PI, 0]);
  plane(d, h, mat(walls, [d / 4, h / 4]), [-w / 2, h / 2, 0], [0, Math.PI / 2, 0]);
  plane(d, h, mat(walls, [d / 4, h / 4]), [w / 2, h / 2, 0], [0, -Math.PI / 2, 0]);
  return S.add(g);
}

/** A window of moonlight: a pale glowing pane and a shaft of light falling into the room. */
export function moonWindow(S, { pos, ry = 0, w = 1.2, h = 1.6, to, color = '#9fb6ff', paneColor = '#4a5c96', shaftOpacity = 0.09, tex = null }) {
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : new THREE.MeshBasicMaterial({ color: paneColor, toneMapped: false }));
  pane.position.set(...pos); pane.rotation.y = ry; S.add(pane);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.08, 0.08), S.mat('#2a2018')); frame.position.set(...pos); frame.rotation.y = ry; S.add(frame);
  const frame2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, h + 0.16, 0.08), S.mat('#2a2018')); frame2.position.set(...pos); frame2.rotation.y = ry; S.add(frame2);
  if (to) shaft(S, { from: pos, to, r0: Math.min(w, h) * 0.45, r1: Math.max(w, h) * 0.9, color, opacity: shaftOpacity });
  return pane;
}

/** A candle: wax, a flame that wavers, and (optionally) a real light. */
export function candle(S, { pos, h = 0.25, r = 0.035, light = false, color = '#ffb35a', intensity = 1.6, distance = 6 }) {
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 10), S.mat('#efe6d2')); wax.position.set(pos[0], pos[1] + h / 2, pos[2]); S.add(wax);
  const flame = flameSprite(S, [pos[0], pos[1] + h + 0.045, pos[2]], 0.09, color);
  let l = null;
  if (light) { l = new THREE.PointLight(color, intensity, distance, 2); l.position.set(pos[0], pos[1] + h + 0.15, pos[2]); S.add(l); }
  const seed = S.rand() * 50;
  S.on((t) => { const f = 0.85 + 0.1 * Math.sin(t * 9 + seed) + 0.05 * Math.sin(t * 23 + seed * 2); flame.scale.set(0.06 * f, 0.11 * (0.9 + 0.2 * f), 1); if (l) l.intensity = intensity * f; });
  return { wax, flame, light: l };
}

const flameTexs = new WeakMap(); // one flame texture per stage, disposed with it
export function flameSprite(S, pos, size = 0.1, color = '#ffb35a') {
  let flameTex = flameTexs.get(S);
  if (!flameTex) {
    flameTex = canvasTexture(S, 64, 128, (g) => {
      const gr = g.createRadialGradient(32, 84, 2, 32, 74, 40); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.35, 'rgba(255,190,90,.9)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(60, 70, 32, 124); g.quadraticCurveTo(4, 70, 32, 4); g.fill();
    });
    flameTexs.set(S, flameTex);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sp.position.set(...pos); sp.scale.set(size * 0.6, size * 1.1, 1);
  S.add(sp);
  return sp;
}

/** A fire in a grate or an oven: a cluster of flames, glowing embers, and a warm flickering light. */
export function fire(S, { pos, width = 0.8, intensity = 6, distance = 10, color = '#ff8a3a', flames = 7 }) {
  const fl = [];
  for (let k = 0; k < flames; k++) fl.push({ sp: flameSprite(S, [pos[0] + (k / (flames - 1) - 0.5) * width, pos[1] + 0.15, pos[2]], 0.45, k % 2 ? '#ffb45a' : '#ff7a3a'), ph: S.rand() * 10 });
  const embers = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.35), new THREE.MeshBasicMaterial({ color: '#ff5a1a', toneMapped: false })); embers.position.set(...pos); S.add(embers);
  const l = new THREE.PointLight(color, intensity, distance, 2); l.position.set(pos[0], pos[1] + 0.5, pos[2] + 0.4); S.add(l);
  S.on((t) => {
    fl.forEach(({ sp, ph }) => { const f = 0.75 + 0.25 * Math.sin(t * 6 + ph) * Math.sin(t * 3.7 + ph * 2); sp.scale.set(0.28 * f, 0.55 * (0.7 + 0.5 * f), 1); });
    l.intensity = intensity * (0.82 + 0.1 * Math.sin(t * 5.3) + 0.08 * Math.sin(t * 13.1));
    embers.material.color.setRGB(1, 0.32 + 0.08 * Math.sin(t * 2.3), 0.1);
  });
  return { light: l };
}
