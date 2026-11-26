// Glowing Sands: an hourglass of light. Thousands of glowing grains (a real falling-sand simulation:
// each grain falls, or slides down to one side if it can't) lie in rainbow layers in the top bulb
// and pour through the neck in a thin stream, heaping into a cone below. When the top runs empty
// the hourglass slowly turns over and pours again; the colours keep their grains, so every turn
// stirs the layers into new patterns. A glow behind the glass takes the colour of the stream.
// Through the night the sand runs slower and dimmer, and at the end the glass comes to rest.
import { createStage, nightSky, motes, canvasTexture, THREE } from '../kit.js';

const SAND = ['#ff6fa8', '#ff9f5a', '#ffd25a', '#8af0a0', '#5ae0d8', '#6ab0ff', '#a88aff', '#ff8ae8'];

export function createSandsScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x5a4d, bg: '#07061a', exposure: 1, bloom: [0.6, 0.5, 0.55], finish: { vignette: 0.45, grain: 0.015, ca: 0.4 }, fov: 50 });
  nightSky(S, { top: '#04030f', horizon: '#141034', moon: [0, -1, 0], moonSize: 0.0001, halo: '#000000', stars: 1.1, clouds: 0, tint: '#1a0c2a' });
  motes(S, { kind: 'dust', count: mobile ? 70 : 120, box: [14, 10, 6], center: [0, 0, -9], color: '#ffd8f0', size: 0.05, speed: 0.3 });
  let rs = (seed * 2654435761 + 12345) >>> 0;
  const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; };

  // ---------------------------------------------------------------- the glass
  const GW = mobile ? 112 : 140, GH = Math.round(GW * 1.8), CAP = 7, NECK = GH >> 1;
  const cx = GW / 2, maxHW = GW / 2 - 10, neckHW = 1.3;
  /** Half the glass's inside width on each row: rounded bulbs pinching to a narrow neck. */
  const halfW = (y) => {
    if (y < CAP + 1 || y > GH - CAP - 2) return -1;
    const v = (y - CAP) / (GH - 2 * CAP), u = v < 0.5 ? v / 0.5 : (1 - v) / 0.5; // 0 at a cap, 1 at the neck
    const taper = Math.pow(1 - Math.pow(u, 2.1), 0.85);          // wide bulb, curving in to a short neck
    const corner = Math.sqrt(Math.min(1, 0.45 + u * 7));            // rounded where the glass meets the caps
    return neckHW + (maxHW - neckHW) * taper * corner;
  };
  const N = GW * GH;
  let type = new Uint8Array(N), col = new Uint8Array(N), vari = new Uint8Array(N), act = new Uint8Array(N); // type: 0 inside (empty), 1 outside, 2 sand
  const vy = new Uint8Array(N); // how fast each grain is falling, in cells a step (0: resting)
  const stamp = new Uint16Array(N); let step = 1;
  for (let y = 0; y < GH; y++) { const hw = halfW(y); for (let x = 0; x < GW; x++) type[y * GW + x] = hw > 0 && Math.abs(x + 0.5 - cx) <= hw ? 0 : 1; }
  // the frame drawn round it: glass edges, brass posts, wooden caps (all fixed, so drawn once)
  const frame = new Uint32Array(N);
  const pack = (h, a = 255) => { const n = parseInt(h.slice(1), 16); return ((a & 255) << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16); };
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const k = y * GW + x;
    if (y < CAP || y >= GH - CAP) { const top = y < CAP ? y : GH - 1 - y; frame[k] = pack(top === 0 || top === CAP - 1 ? '#3a2418' : top === 1 ? '#8a5a34' : '#6a4228'); if (x < 2 || x >= GW - 2) frame[k] = 0; continue; }
    if (x >= 3 && x <= 5 || x >= GW - 6 && x <= GW - 4) { const lit = x === 4 || x === GW - 5; frame[k] = pack(lit ? '#b08a4a' : '#6a4e26'); continue; } // posts
    if (type[k] === 1) { // glass edge where outside meets inside
      const near = [-1, 1, -GW, GW].some((d) => type[k + d] === 0);
      if (near) frame[k] = pack('#b8b4f0', 90);
    } else {
      const hw = halfW(y), dx = x + 0.5 - cx; frame[k] = pack('#8a86d0', 14); // a faint body of glass
      if (dx < -hw * 0.58 && dx > -hw * 0.63) frame[k] = pack('#e8e8ff', 11); // a highlight down the left
    }
  }
  // fill the top bulb with layers of colour, settled against the neck
  let top = 0;
  { let band = Math.floor(rnd() * SAND.length), rows = 0;
    for (let y = NECK - 1; y > CAP + Math.round((NECK - CAP) * 0.22); y--) {
      for (let x = 0; x < GW; x++) { const k = y * GW + x; if (type[k] === 0) { type[k] = 2; col[k] = band; vari[k] = Math.floor(rnd() * 255); top++; } }
      if (++rows >= 7 + Math.floor(rnd() * 6)) { rows = 0; band = (band + 1 + Math.floor(rnd() * 2)) % SAND.length; }
    } }

  // ---------------------------------------------------------------- the sand falls
  // Grains speed up once they're in the open below the neck (so the stream stretches into droplets),
  // the whole stream sways as `wander` moves (so the heap's peak drifts and its layers come out wavy
  // and lopsided), hard landings roll on a little further and throw up glitter, grains in the neck now
  // and then catch for a moment (`jam`: dribbles, and the odd pause and rush), and after each turn the
  // glass settles with a slight lean (`bias`). Every rule applies to all the grains alike at any
  // moment: chance applied grain by grain stirs the colour layers into confetti.
  let wander = 0, bias = 0, jam = 0;
  const glitter = [];
  const inX = (x) => x >= 0 && x < GW;
  function simulate() {
    step = (step + 1) & 0xffff || 1;
    let moved = 0; top = 0;
    const sway = rnd() < Math.abs(wander) * 0.7 ? (wander > 0 ? 1 : -1) : 0; // this step, the whole stream leans one way (or not)
    for (let y = GH - 2; y >= 0; y--) {
      const ltr = (y + step) & 1;
      for (let i = 0; i < GW; i++) {
        const x = ltr ? i : GW - 1 - i, k = y * GW + x;
        if (type[k] !== 2) continue;
        if (stamp[k] === step) { if (y < NECK) top++; continue; }
        if (jam > 0 && y >= NECK - 2 && y <= NECK + 1 && rnd() < jam) { if (y < NECK) top++; continue; } // caught in the neck
        let to = -1, v = 0; const b = k + GW;
        if (type[b] === 0) {
          // falling: a little faster each step, up to four cells, stopping at whatever is below
          const want = y < NECK - 1 ? 1 : Math.min(4, vy[k] + 1); let kk = k; // speeding up only in the open fall below the neck (above it, the sand drains in order)
          for (let n = 0; n < want; n++) { if (kk + GW >= N || type[kk + GW] !== 0) break; kk += GW; }
          if (sway && want >= 2 && y > NECK) { const xx = (kk % GW) + sway; if (inX(xx) && type[kk + sway] === 0) kk += sway; } // the stream sways
          to = kk; v = want;
        } else {
          // on something: slide down a side if it can, rolling on a little further after a hard landing
          const hard = vy[k] >= 3;
          {
            const d = rnd() < 0.5 + bias ? 1 : -1;
            if (inX(x + d) && type[b + d] === 0 && type[k + d] === 0) to = b + d; else if (inX(x - d) && type[b - d] === 0 && type[k - d] === 0) to = b - d;
            if (to >= 0 && hard) { const dd = (to % GW) - x; if (inX(x + 2 * dd) && type[to + GW + dd] === 0 && type[to + dd] === 0) to = to + GW + dd; } // and roll on
          }
          if (to < 0 && y < NECK && rnd() < 0.12) { const d = rnd() < 0.5 + bias ? 1 : -1; if (inX(x + d) && type[k + d] === 0 && type[b + d] === 0) to = k + d; }
          if (hard && glitter.length < 60 && rnd() < 0.22) glitter.push({ x: x + 0.5, y: y, vx: (rnd() - 0.5) * 6, life: 1, c: col[k] });
        }
        if (to < 0) { vy[k] = 0; if (y < NECK) top++; if (act[k] > 0) act[k] = Math.max(0, act[k] - 40); continue; }
        type[to] = 2; col[to] = col[k]; vari[to] = vari[k]; act[to] = 255; vy[to] = v; stamp[to] = step;
        type[k] = 0; act[k] = 0; vy[k] = 0; moved++;
        const ty = (to / GW) | 0;
        if (ty < NECK) top++; else if (y < NECK) passed++;
      }
    }
    return moved;
  }

  // ---------------------------------------------------------------- drawing it
  const buf = new Uint32Array(N);
  const tex = new THREE.DataTexture(new Uint8Array(buf.buffer), GW, GH, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace; S.keep(tex);
  const rgb = SAND.map((h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
  let bright = 1;
  function draw(t) {
    const slot = Math.floor(t * 6);
    for (let y = 0; y < GH; y++) {
      const row = (GH - 1 - y) * GW;
      for (let x = 0; x < GW; x++) {
        const k = y * GW + x;
        if (type[k] !== 2) { buf[row + x] = frame[k]; continue; }
        const c = rgb[col[k]], v = 0.7 + 0.3 * (vari[k] / 255), a = act[k] / 255;
        const sp = ((Math.imul(k, 2654435761) ^ Math.imul(slot, 40503)) >>> 0) % 997 === 0 ? 0.55 : 0; // the odd sparkle
        let m = (v * 0.92 + a * 0.18) * bright;
        const r = Math.min(255, c[0] * m + 255 * sp), g = Math.min(255, c[1] * m + 255 * sp), b = Math.min(255, c[2] * m + 255 * sp);
        buf[row + x] = (255 << 24) | (b << 16) | (g << 8) | r;
        if (vy[k] >= 2 && y > 0 && type[k - GW] === 0) { const tr = 0.3 * bright; buf[row + GW + x] = (150 << 24) | ((c[2] * tr) << 16) | ((c[1] * tr) << 8) | (c[0] * tr); } // a streak
      }
    }
    for (const p of glitter) { // tiny sparks thrown up by hard landings
      const x = Math.round(p.x), y = Math.round(p.y); if (x < 0 || x >= GW || y < 0 || y >= GH) continue;
      const c = rgb[p.c], w = p.life * bright, r = Math.min(255, 140 * w + c[0] * w), g = Math.min(255, 140 * w + c[1] * w), b = Math.min(255, 140 * w + c[2] * w);
      buf[(GH - 1 - y) * GW + x] = ((Math.min(255, 255 * p.life * 1.4) | 0) << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
    }
    tex.needsUpdate = true;
  }

  const quad = new THREE.Mesh(S.keep(new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
  quad.position.z = -10; S.camera.add(quad);
  // a glow behind the glass, in the colour of the falling stream
  const glowTex = canvasTexture(S, 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.4, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
  glow.position.z = -10.5; S.camera.add(glow);
  const glowCol = new THREE.Color(SAND[0]), tmpC = new THREE.Color();
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------------------------------------------------------------- time: pouring, resting, turning over
  let catchT = 0, lean = 0, newLean = 0, passed = 0, lastPass = 0, acc = 0, still = 0, flip = -1, pulse = 0, energy = 1, rest = false;
  S.onEvent((ev) => { if (ev.type === 'chord') pulse = 1; });
  S.on((t, dt, st) => {
    energy = st.energy;
    bright = (0.62 + 0.38 * energy) * (1 + 0.08 * pulse); pulse *= Math.exp(-dt * 0.8);
    wander = 0.24 * Math.sin(t * 0.13) + 0.14 * Math.sin(t * 0.051 + 2);
    if (catchT > 0) { catchT -= dt; jam = 0.93; } else { jam = 0.1 * (0.5 + 0.5 * Math.sin(t * 0.37)) * (0.5 + 0.5 * Math.sin(t * 0.11 + 1)); if (Math.random() < dt / 35) catchT = 0.8 + Math.random() * 2; }
    for (let i = glitter.length - 1; i >= 0; i--) { const p = glitter[i]; p.life -= dt * 1.4; p.y -= dt * 5 * p.life; p.x += p.vx * dt; if (p.life <= 0) glitter.splice(i, 1); }
    if (flip < 0) {
      const rate = 34 * (0.4 + 0.6 * energy); // grain-steps a second
      acc += dt * rate; let n = 0, moved = 0;
      while (acc >= 1 && n < 3) { acc -= 1; n++; moved += simulate(); }
      if (passed !== lastPass) { lastPass = passed; still = 0; } else still += dt;
      // turn over once the stream through the neck has stopped (not at the very end of the night)
      if (still > 3 && !rest) { if (energy < 0.33) rest = true; else { flip = 0; newLean = (Math.random() - 0.5) * 0.05; } } // each turn settles at its own slight lean
    } else {
      flip += dt / 8;
      const k = Math.min(1, flip), e = k * k * (3 - 2 * k);
      quad.rotation.z = lerp(lean, Math.PI + newLean, e); glow.material.rotation = Math.PI * e;
      if (k >= 1) { type.reverse(); col.reverse(); vari.reverse(); act.fill(0); vy.fill(0); stamp.fill(0); glitter.length = 0; lean = newLean; bias = -lean * 6; quad.rotation.z = lean; flip = -1; still = 0; }
    }
    draw(t);
    // size: the glass stands tall in the view, whatever the screen's shape
    const vh = 2 * Math.tan((S.camera.fov * Math.PI) / 360) * 10, vw = vh * S.camera.aspect;
    const h = Math.min(vh * 0.9, (vw * 0.92 * GH) / GW), w = (h * GW) / GH;
    quad.scale.set(w, h, 1); quad.position.y = Math.sin(t * 0.15) * vh * 0.004;
    // the glow takes the colour of the sand passing through the neck
    for (let y = NECK - 2; y <= NECK + 6; y++) { const k = y * GW + Math.floor(cx); if (type[k] === 2) { tmpC.set(SAND[col[k]]); glowCol.lerp(tmpC, 0.05); break; } }
    glow.material.color.copy(glowCol); glow.scale.set(w * 1.6, h * 0.9, 1); glow.material.opacity = (0.22 + 0.12 * pulse) * (0.5 + 0.5 * energy);
  });

  S.scene.userData.sands = { coherence() { let same = 0, all = 0; for (let y = NECK + 2; y < GH - CAP; y++) for (let x = 0; x < GW - 1; x++) { const k = y * GW + x; if (type[k] === 2 && type[k + 1] === 2) { all++; if (col[k] === col[k + 1]) same++; } } return all ? same / all : 0; }, get top() { return top; }, get flipping() { return flip >= 0; }, get grains() { let n = 0; for (let k = 0; k < N; k++) if (type[k] === 2) n++; return n; } };
  return S.finalize({ portraitFov: 50 });
}
