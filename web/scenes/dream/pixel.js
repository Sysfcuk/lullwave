// 8-Bit Night Walk: a little sleepwalker in a nightcap and pyjamas, lantern in hand, strolls through
// a scrolling pixel-art night. Layers of mountains, hills with a windmill and a castle, a village
// whose windows go out one by one, lamp posts, woods, and ponds with little bridges (the sky and the
// moon reflected in them). Stars twinkle; now and then a shooting star. The walk keeps time with the
// music's beat. As the night winds down the walker finds a field, builds a campfire, sits by it a
// while, then lies down under a blanket and sleeps, little pixel Zs drifting up; the fire burns low.
//
// Everything is drawn into a small pixel buffer (about 120-250 pixels across, sized to the screen
// so the pixels stay square) and shown full screen with no smoothing.
import { createStage, THREE } from '../kit.js';

// ------------------------------------------------------------------ the palette (our own)
const HEX = [
  '#0b0a1f', '#151634', '#22285a', '#36437a', '#4f5f9a', '#8a95c8', '#e8e2c8', '#ffd27a', // 0-7: night, sky, moonlight, lamplight
  '#ff9a4a', '#c84a3a', '#1d3a34', '#2f5a40', '#4f8a4a', '#3a2a2a', '#6a4a3a', '#f4f0ff', // 8-15: fire, red, greens, browns, white
  '#f2c8a0', '#6a4a8a', '#10162a', '#2a2f52', '#5a3a2a',                                   // 16-20: skin, blanket, silhouettes, far hills, roof
];
const PAL = HEX.map((h) => { const n = parseInt(h.slice(1), 16); return (0xff << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16); });
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// ------------------------------------------------------------------ sprites (characters map to palette entries)
const KEY = { r: 9, w: 15, s: 16, b: 4, B: 3, d: 1, l: 7, L: 6, p: 17, P: 3, o: 8, y: 7, k: 13, n: 14, g: 12, G: 11 };
const WALK_TOP = [
  '....rrr.w',
  '...rrrrr.',
  '..rrrrr..',
  '..sssss..',
  '..sssdsss',
  '..sssss..',
  '..bbbbb..',
  '.bbbbbbs.',
  '.bbbbb.l.',
  '..bbbb.L.',
];
const LEGS = [['..b..b...', '..d..d...'], ['..bb.b...', '..dd.d...'], ['...bb....', '...dd....'], ['..b.bb...', '..d.dd...']];
const SIT = [
  '....rrr.w',
  '...rrrrr.',
  '..rrrrr..',
  '..sssss..',
  '..sssdsss',
  '..sssss..',
  '..bbbbbs.',
  '.bbbbbbbs',
  '.bbbbbbbb',
  '..dd.bbdd',
];
const SLEEP = [
  '.w..............',
  'rr..............',
  'rrrss.pppppppppp',
  'rrssdpppppppppppp',
  '.kkkkkkkkkkkkkkkk',
];
const FLAMES = [
  ['..y..', '.yoy.', '.oyo.', 'oyoyo', 'oorro'],
  ['.y...', '.yy..', '.oyo.', 'ooyoo', 'orroo'],
  ['...y.', '..yy.', '.oyo.', 'oyoyo', 'oroor'],
];
const LOGS = ['n.....n', '.nn.nn.', '...k...'];
const ZED = ['wwww', '..w.', '.w..', 'wwww'];

export function createPixelScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x8b17, bg: '#0b0a1f', exposure: 1, bloom: [0.55, 0.35, 0.6], finish: { vignette: 0.28, grain: 0, ca: 0 }, fov: 50 });
  const R = (seed * 2654435761) >>> 0;
  const hash = (n, m = 0) => { let h = (Math.imul(n | 0, 374761393) + Math.imul(m | 0, 668265263) + R) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const n1 = (x, salt = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, salt) * (1 - u) + hash(i + 1, salt) * u; };

  // ---------------------------------------------------------------- the pixel buffer and the screen it fills
  let W = 0, H = 0, buf = null, tex = null, yg = 0;
  const quad = new THREE.Mesh(S.keep(new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, depthWrite: false }));
  quad.position.z = -1; quad.renderOrder = 10; S.camera.add(quad);
  function resize() {
    const a = S.camera.aspect || 1;
    const w = a < 0.8 ? 96 : Math.round(118 * a), h = a < 0.8 ? Math.round(96 / a) : 118;
    if (w === W && h === H) return;
    W = w; H = h; yg = H - (a < 0.8 ? 30 : 22);
    buf = new Uint32Array(W * H);
    if (tex) tex.dispose();
    tex = new THREE.DataTexture(new Uint8Array(buf.buffer), W, H, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    quad.material.map = tex; quad.material.needsUpdate = true;
  }
  S.keep({ dispose: () => tex && tex.dispose() });

  const put = (x, y, c) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; buf[(H - 1 - y) * W + x] = c; };
  const get = (x, y) => { x = Math.max(0, Math.min(W - 1, x | 0)); y = Math.max(0, Math.min(H - 1, y | 0)); return buf[(H - 1 - y) * W + x]; };
  const P = (i) => PAL[i];
  const mix = (c, d, k) => { // blend two packed colours
    const r = (c & 255) + (((d & 255) - (c & 255)) * k), g = ((c >> 8) & 255) + ((((d >> 8) & 255) - ((c >> 8) & 255)) * k), b = ((c >> 16) & 255) + ((((d >> 16) & 255) - ((c >> 16) & 255)) * k);
    return (0xff << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
  };
  const glow = (x, y, k, tint) => { put(x, y, mix(get(x, y), tint, k)); };
  function sprite(rows, x, y, flip = false, map = KEY) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || map[ch] === undefined) continue; put(flip ? x + row.length - 1 - i : x + i, y + j, P(map[ch])); }
    }
  }
  /** A pool of warm light: dithered, falling off from the centre (lantern, fire, lamp). */
  function light(cx, cy, rad, k, col) {
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.2) / rad; if (d >= 1) continue;
      const a = (1 - d) * k; if (a > BAYER[((y & 3) << 2) | (x & 3)] * 0.9) glow(x, y, Math.min(0.5, a), col);
    }
  }

  // ---------------------------------------------------------------- the world, by layers (all from the walk's distance, so it never repeats)
  const SEG = 72;
  const segType = (i) => { if (i <= 1) return 'field'; const h = hash(i, 7); return h < 0.26 ? 'village' : h < 0.46 ? 'forest' : h < 0.6 ? 'pond' : h < 0.72 ? 'lamps' : 'field'; };
  const winOff = (i, k) => 0.35 + hash(i * 13 + k, 11) * 0.6; // the energy at which each window goes out

  function sky(t, energy) {
    const top = [P(0), P(0), P(1), P(2), P(3)];
    for (let y = 0; y < yg; y++) {
      const f = Math.pow(y / yg, 1.4) * 3.6;
      for (let x = 0; x < W; x++) { const i = Math.min(4, Math.floor(f + BAYER[((y & 3) << 2) | (x & 3)])); buf[(H - 1 - y) * W + x] = top[i]; }
    }
    // stars, drifting very slowly, a few twinkling
    const off = Math.floor(scroll * 0.02);
    for (let y = 0; y < yg - 26; y++) for (let x = 0; x < W; x++) {
      const h = hash(x + off, y + 999);
      if (h > 0.0075) continue;
      const tw = hash(x + off, y + Math.floor(t * (0.6 + h * 80)));
      put(x, y, P(h < 0.0012 ? 15 : tw < 0.2 ? 4 : tw < 0.6 ? 5 : 6));
    }
  }
  function moon(t, energy) {
    const r = W < 110 ? 8 : 7, mx = W * (0.78 - 0.45 * (1 - energy)), my = H * (W < 140 ? 0.16 : 0.2) + (1 - energy) * 6;
    for (let y = Math.floor(my - r - 4); y <= my + r + 4; y++) for (let x = Math.floor(mx - r - 4); x <= mx + r + 4; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d <= r) {
        const lx = (x - mx) / r, ly = (y - my) / r;
        let c = 6; if ((hash(Math.floor(lx * 4 + 9), Math.floor(ly * 4 + 9)) < 0.22 && d < r - 1) || (lx > 0.45 && d > r - 2)) c = 5;
        put(x, y, P(c));
      } else if (d < r + 4 && BAYER[((y & 3) << 2) | (x & 3)] < (1 - (d - r) / 4) * 0.55) glow(x, y, 0.35, P(5)); // a dithered halo
    }
    return { mx, my, r };
  }
  function clouds(t) {
    for (let k = 0; k < 4; k++) {
      const w = 26 + hash(k, 3) * 24, cy = 10 + hash(k, 4) * (yg * 0.35);
      const cx = (((hash(k, 5) * (W + 80) + t * (0.6 + k * 0.25) + scroll * 0.03) % (W + 80)) + W + 80) % (W + 80) - 40;
      for (let y = Math.floor(cy - 4); y < cy + 4; y++) for (let x = Math.floor(cx - w / 2); x < cx + w / 2; x++) {
        const u = (x - cx) / (w / 2), v = (y - cy) / 4, puff = 1 - u * u - v * v * 1.6 + 0.25 * Math.sin(x * 0.7 + k);
        if (puff > BAYER[((y & 3) << 2) | (x & 3)] * 0.6) glow(x, y, puff > 0.45 ? 0.5 : 0.28, P(3));
      }
    }
  }
  function mountains() {
    const off = scroll * 0.06;
    for (let x = 0; x < W; x++) {
      const xw = x + off, h = 16 + 26 * n1(xw * 0.025, 1) + 9 * n1(xw * 0.09, 2), top = Math.floor(yg - 8 - h);
      for (let y = top; y < yg; y++) put(x, y, P(y === top ? 4 : y < top + 3 && h > 34 ? 5 : 19));
    }
  }
  function hills(t, energy) {
    const off = scroll * 0.28;
    const hy = (xw) => yg - 6 - 12 * n1(xw * 0.03, 3);
    for (let x = 0; x < W; x++) { const top = Math.floor(hy(x + off)); for (let y = top; y < yg; y++) put(x, y, P(y === top ? 11 : 18)); }
    // landmarks on the hills
    const s0 = Math.floor(off / 90) - 1;
    for (let i = s0; i < s0 + Math.ceil(W / 90) + 3; i++) {
      const h = hash(i, 21), bx = Math.floor(i * 90 + 20 + hash(i, 22) * 40 - off), base = Math.floor(hy(i * 90 + 30 + hash(i, 22) * 40));
      if (h < 0.28) { // a windmill, its sails turning slowly
        for (let j = 0; j < 14; j++) for (let k = -2 - (j >> 3); k <= 2 + (j >> 3); k++) put(bx + k, base - 14 + j, P(18));
        put(bx, base - 9, P(energy > winOff(i, 1) ? 7 : 2));
        const a = t * 0.35 + i;
        for (let q = 0; q < 4; q++) { const ang = a + q * Math.PI / 2; for (let l = 1; l < 10; l++) put(bx + Math.cos(ang) * l, base - 15 + Math.sin(ang) * l, P(18)); }
      } else if (h < 0.48) { // a castle on the skyline
        for (let x = -9; x <= 9; x++) for (let y = base - 10; y < base + 2; y++) put(bx + x, y, P(18));
        for (let x = -9; x <= 9; x += 3) put(bx + x, base - 11, P(18));
        for (let y = base - 18; y < base - 10; y++) for (let x = -2; x <= 2; x++) put(bx + x, y, P(18));
        for (let x = -2; x <= 2; x += 2) put(bx + x, base - 19, P(18));
        put(bx, base - 14, P(energy > winOff(i, 2) ? 7 : 2)); put(bx - 5, base - 6, P(energy > winOff(i, 3) ? 7 : 2)); put(bx + 5, base - 6, P(energy > winOff(i, 4) ? 8 : 2));
      } else if (h < 0.75) { // a stand of far pines
        for (let p = 0; p < 4; p++) { const px = bx + p * 5 - 8, ph = 6 + Math.floor(hash(i, 30 + p) * 6); for (let j = 0; j < ph; j++) for (let k = -(j >> 1); k <= j >> 1; k++) put(px + k, base - ph + j, P(18)); }
      }
    }
  }

  function ground(t, energy, fireX) {
    // grass on top, then soil, with a worn path along it
    for (let x = 0; x < W; x++) {
      const xw = x + scroll;
      for (let y = yg; y < H; y++) {
        let c = y === yg ? 12 : y < yg + 3 ? 11 : 13;
        if (y === yg + 3 || y === yg + 4) c = hash(Math.floor(xw), y) < 0.6 ? 14 : 13;
        if (y > yg + 4 && hash(Math.floor(xw), y) < 0.05) c = 14;
        put(x, y, P(c));
      }
      if (hash(Math.floor(xw), 40) < 0.3) put(x, yg - 1, P(hash(Math.floor(xw), 41) < 0.5 ? 12 : 11)); // tufts
      if (hash(Math.floor(xw), 42) < 0.015) { put(x, yg - 2, P(hash(Math.floor(xw), 43) < 0.5 ? 15 : 7)); put(x, yg - 1, P(11)); } // a little flower
    }
    // things along the way
    const s0 = Math.floor(scroll / SEG) - 1;
    for (let i = s0; i < s0 + Math.ceil(W / SEG) + 2; i++) {
      const type = segType(i), x0 = Math.floor(i * SEG - scroll);
      if (type === 'village') { house(x0 + 6, i, 0, energy); if (hash(i, 50) < 0.6) house(x0 + 40, i, 1, energy); }
      else if (type === 'forest') { for (let k = 0; k < 4; k++) { const tx = x0 + 6 + k * 17 + Math.floor(hash(i, 60 + k) * 6); if (hash(i, 70 + k) < 0.65) pine(tx, 16 + Math.floor(hash(i, 80 + k) * 12)); else roundTree(tx, 12 + Math.floor(hash(i, 80 + k) * 5)); } }
      else if (type === 'lamps') { lamp(x0 + 14, i, 0, energy); fence(x0 + 22, 30); lamp(x0 + 56, i, 1, energy); }
      else if (type === 'pond') pond(x0 + 6, t);
      else if (type === 'field' && hash(i, 90) < 0.4 && i > 1) signpost(x0 + 50);
    }
  }
  function house(x0, i, k, energy) {
    const w = 18 + Math.floor(hash(i, 100 + k) * 6), h = 12 + Math.floor(hash(i, 110 + k) * 4);
    for (let y = yg - h; y < yg; y++) for (let x = x0; x < x0 + w; x++) put(x, y, P(x === x0 + w - 1 ? 13 : 14));
    const rh = Math.ceil(w / 2) + 1;
    for (let j = 0; j < rh; j++) for (let x = x0 - 1 + j; x <= x0 + w - j; x++) put(x, yg - h - 1 - j, P(j === rh - 1 || x === x0 - 1 + j ? 9 : 20));
    // chimney, and a curl of smoke while someone's up
    const cx = x0 + w - 5; for (let y = yg - h - rh + 1; y < yg - h - 2; y++) { put(cx, y, P(13)); put(cx + 1, y, P(13)); }
    if (energy > winOff(i, 9 + k)) for (let q = 0; q < 6; q++) { const sy = yg - h - rh - 1 - q * 2 - ((clock * 3) % 2 | 0); put(cx + Math.round(Math.sin(q * 0.9 + clock * 0.8) * 1.5), sy, P(q < 3 ? 4 : 3)); }
    // windows that go out as the night goes on, and a door
    for (let q = 0; q < 2; q++) {
      const wx = x0 + 3 + q * (w - 9), on = energy > winOff(i, k * 4 + q);
      for (let y = yg - h + 3; y < yg - h + 6; y++) for (let x = wx; x < wx + 3; x++) put(x, y, P(on ? (x === wx + 1 || y === yg - h + 4 ? 8 : 7) : 2));
      if (on) light(wx + 1, yg - 2, 5, 0.5, P(7));
    }
    const dx = x0 + Math.floor(w / 2) - 1; for (let y = yg - 6; y < yg; y++) { put(dx, y, P(13)); put(dx + 1, y, P(13)); put(dx + 2, y, P(13)); }
  }
  function pine(x, h) {
    for (let j = 0; j < h; j++) { const half = Math.floor((j % 6) * 0.7 + j * 0.18); for (let k = -half; k <= half; k++) put(x + k, yg - h - 3 + j, P(k === half ? 11 : k > half - 2 ? 10 : 18)); }
    for (let y = yg - 3; y < yg; y++) put(x, y, P(13));
  }
  function roundTree(x, r) {
    const inside = (k, y) => Math.hypot(k, y * 1.15) < r - 2 + hash(x + k, y + 500) * 2;
    for (let y = -r; y <= r; y++) for (let k = -r; k <= r; k++) {
      if (!inside(k, y)) continue;
      const lit = !inside(k + 1, y - 1) && k + y < r * 0.2, shade = !inside(k - 1, y + 1);
      put(x + k, yg - r - 6 + y, P(lit ? 12 : shade ? 18 : (hash(x + k, y) < 0.18 ? 11 : 10)));
    }
    for (let y = yg - 7; y < yg; y++) { put(x, y, P(13)); put(x + 1, y, P(13)); }
  }
  function lamp(x, i, k, energy) {
    for (let y = yg - 15; y < yg; y++) put(x, y, P(1));
    put(x - 1, yg - 16, P(1)); put(x + 1, yg - 16, P(1));
    const on = energy > winOff(i, 20 + k) * 0.85;
    put(x, yg - 16, P(on ? 7 : 3)); put(x, yg - 17, P(1));
    if (on) { light(x, yg - 15, 8, 0.6, P(7)); light(x, yg, 7, 0.45, P(7)); }
  }
  function fence(x0, n) { for (let x = 0; x < n; x++) { put(x0 + x, yg - 3, P(14)); put(x0 + x, yg - 5, P(14)); if (x % 5 === 0) for (let y = yg - 6; y < yg; y++) put(x0 + x, y, P(14)); } }
  function signpost(x) { for (let y = yg - 9; y < yg; y++) put(x, y, P(14)); for (let k = -3; k <= 4; k++) { put(x + k, yg - 8, P(14)); put(x + k, yg - 7, P(k === 4 ? 13 : 14)); } }
  function pond(x0, t) {
    const w = 60;
    // water down to the bottom, mirroring the sky and moon above with a gentle ripple
    for (let y = yg; y < H; y++) for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= W) continue;
      const edge = Math.min(x - x0, x0 + w - 1 - x); if (edge < (y - yg) * 0.6 - 2) continue; // sloping banks
      const dy = y - yg, sx = x + Math.round(Math.sin(y * 0.9 + t * 1.6) * (dy > 1 ? 1 : 0));
      put(x, y, mix(get(sx, yg - 1 - dy), P(2), 0.45 + Math.min(0.35, dy * 0.02)));
    }
    // a little wooden bridge for the walker
    for (let x = x0 - 2; x < x0 + w + 2; x++) { put(x, yg, P(14)); put(x, yg + 1, P(x % 3 ? 14 : 13)); if ((x - x0) % 10 === 0) for (let y = yg - 4; y < yg + 6; y++) put(x, y, P(13)); put(x, yg - 4, P(13)); }
  }

  // ---------------------------------------------------------------- the walker, the camp, and small lives
  let scroll = 0, speed = 6, walkPhase = 0, clock = 0, energy = 1;
  let state = 'walk', campWorld = 0, fire = 0, sitT = 0;
  const sparks = [], zs = [], flies = Array.from({ length: 7 }, (_, k) => ({ x: hash(k, 200) * 300, y: 6 + hash(k, 201) * 18, ph: hash(k, 202) * 6.28 }));
  let shooting = null;

  S.onEvent((ev) => {
    if (ev.type === 'step' && state === 'walk') speed = lerp(speed, 7 / Math.max(0.5, ev.beat), 0.5); // a stride of seven pixels a beat
    if (ev.type === 'star' && !shooting) shooting = { x: W * (0.3 + hash(Math.floor(clock), 300) * 0.6), y: 6 + hash(Math.floor(clock), 301) * (yg * 0.3), t: 0 };
  });
  const lerp = (a, b, k) => a + (b - a) * k;

  S.on((t, dt, st) => {
    clock = t; energy = st.energy;
    resize();
    const wx = Math.floor(W * 0.3);
    // walking, then finding a field to camp in as the night winds down
    if (state === 'walk') {
      scroll += speed * dt; walkPhase += (speed * dt) / 2.4;
      const here = scroll + wx;
      if (energy < 0.55 && segType(Math.floor(here / SEG)) === 'field' && here % SEG > 6 && here % SEG < 26) { state = 'stop'; }
    } else if (state === 'stop') {
      speed = Math.max(0, speed - dt * 4); scroll += speed * dt; walkPhase += (speed * dt) / 2.4;
      if (speed <= 0) { state = 'camp'; campWorld = scroll + wx + 13; sitT = t; }
    } else if (state === 'camp' && energy < 0.42) state = 'sleep';
    if (state === 'camp' || state === 'sleep') fire = lerp(fire, state === 'sleep' && energy < 0.3 ? 0.45 : 1, 1 - Math.exp(-dt * 0.4));

    // ---- draw, back to front
    sky(t, energy);
    const m = moon(t, energy);
    clouds(t);
    if (shooting) {
      shooting.t += dt; const k = shooting.t / 1.1;
      for (let q = 0; q < 14; q++) { const kk = k - q * 0.018; if (kk < 0 || kk > 1) continue; const c = P(q < 2 ? 15 : q < 5 ? 6 : q < 9 ? 5 : 4); put(shooting.x - kk * 52, shooting.y + kk * 20, c); if (q < 4) put(shooting.x - kk * 52, shooting.y + kk * 20 - 1, mix(c, P(0), 0.5)); }
      if (k > 1.2) shooting = null;
    }
    mountains(); hills(t, energy);
    ground(t, energy);
    void m;

    // the camp
    const fx = Math.floor(campWorld - scroll);
    if (state === 'camp' || state === 'sleep') {
      light(fx + 3, yg - 3, 14 + fire * 6, 0.55 * fire, P(8));
      sprite(LOGS, fx, yg - 2);
      if (fire > 0.05) {
        const f = FLAMES[Math.floor(t * 7) % 3], big = fire > 0.6;
        sprite(big ? f : f.slice(2), fx + 1, yg - (big ? 7 : 4));
        if (Math.random() < dt * 6 * fire) sparks.push({ x: fx + 3, y: yg - 6, vx: (Math.random() - 0.5) * 3, life: 1 });
      }
    }
    for (let k = sparks.length - 1; k >= 0; k--) { const s = sparks[k]; s.life -= dt * 0.7; s.y -= dt * 7; s.x += s.vx * dt; if (s.life <= 0) { sparks.splice(k, 1); continue; } put(s.x, s.y, P(s.life > 0.6 ? 7 : s.life > 0.3 ? 8 : 9)); }

    // the walker
    const bob = state === 'walk' || state === 'stop' ? (Math.floor(walkPhase) % 2) : 0;
    if (state === 'walk' || state === 'stop') {
      light(wx + 7, yg - 2, 9, 0.5, P(7)); // the lantern's pool of light (on the ground, beneath the walker)
      sprite(WALK_TOP, wx, yg - 12 + bob);
      sprite(LEGS[Math.floor(walkPhase) % 4], wx, yg - 2);
    } else if (state === 'camp') {
      light(wx - 2, yg - 1, 6, 0.4, P(7)); sprite(SIT, wx, yg - 10); put(wx - 2, yg - 2, P(7)); put(wx - 2, yg - 1, P(6)); // lantern set down
    } else {
      sprite(SLEEP, wx - 6, yg - 5); put(wx - 9, yg - 2, P(energy > 0.33 ? 7 : 3)); put(wx - 9, yg - 1, P(6));
      if (zs.length < 3 && Math.random() < dt * 0.5) zs.push({ x: wx - 4, y: yg - 8, t: 0 });
    }
    for (let k = zs.length - 1; k >= 0; k--) { const z = zs[k]; z.t += dt; if (z.t > 4) { zs.splice(k, 1); continue; } if (z.t > 0.2 && z.t < 3.6) sprite(ZED, z.x + z.t * 2 + Math.sin(z.t * 2) * 1.5, z.y - z.t * 4, false, { w: z.t < 2.8 ? 15 : 5 }); }

    // fireflies over the grass
    for (const f of flies) {
      const x = ((f.x - scroll * 0.6 + Math.sin(t * 0.3 + f.ph) * 8) % (W + 20) + W + 20) % (W + 20) - 10, y = yg - f.y + Math.sin(t * 0.7 + f.ph) * 3;
      const on = Math.sin(t * 1.3 + f.ph * 3) > 0.3 && energy > 0.35;
      if (on) { put(x, y, P(12)); glow(x + 1, y, 0.3, P(12)); glow(x - 1, y, 0.3, P(12)); }
    }
    tex.needsUpdate = true;
    // fill the screen
    const hgt = 2 * Math.tan((S.camera.fov * Math.PI) / 360);
    quad.scale.set(hgt * S.camera.aspect, hgt, 1);
  });

  S.scene.userData.pixel = { get state() { return state; }, get scroll() { return scroll; }, get size() { return [W, H]; } };
  return S.finalize({ portraitFov: 50 });
}
