// Lost in Thought: every surface, thing and sky, made in code when a dream begins. Walls are
// 64x64 texels to the unit, like Doom's, flats (floors and ceilings) the same. Each texture is packed
// pixels plus, where something glows (a lantern's paper, a rune, a stained-glass moon), a glow mask
// for the texels the renderer shows at full brightness whatever the light. Sprites are drawn with
// the 2D canvas at their own tiny size and snapped to hard pixel edges. Skies are whole panoramas,
// stars, the Milky Way, a big bright moon with its halo and ring, laid out by direction.

export const TS = 64;
export const SKY_W = 1024, SKY_H = 256, EL0 = -0.35, EL1 = 1.45; // the sky panorama: azimuth all round, elevation EL0..EL1
export const CL_W = 512, CL_H = 64, CL_EL1 = 0.75;              // the cloud layer, drifting over the lower sky

const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
export const pack = (r, g, b) => (255 << 24) | (clamp8(b) << 16) | (clamp8(g) << 8) | clamp8(r);
export const hx = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Seeded hash and tileable noise (period p in noise cells, so a texture wraps without a seam). */
export function noiser(seed) {
  const hash = (x, y, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1440662683) + seed) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const tn = (x, y, p, s = 0) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const m = (a) => ((a % p) + p) % p;
    const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, p, oct = 4, s = 0) => { let t = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { t += amp * tn(x * f, y * f, p * f, s + i * 17); n += amp; amp *= 0.5; f *= 2; } return t / n; };
  return { hash, tn, fbm };
}

function tex(w = TS, h = TS) { return { w, h, px: new Uint32Array(w * h), glow: null }; }
function paint(T, fn) { // fn(x, y) -> [r, g, b] or [r, g, b, glow]
  for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) {
    const c = fn(x, y), i = y * T.w + x;
    T.px[i] = pack(c[0], c[1], c[2]);
    if (c[3]) { if (!T.glow) T.glow = new Uint8Array(T.w * T.h); T.glow[i] = clamp8(c[3]); }
  }
  return T;
}
const unpack = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];

// ------------------------------------------------------------------ walls
/** Dressed stone in running bond: each block its own shade, bevelled, grained, mossy if asked. */
function stone(N, { base, mortar, rows = 4, cols = 2, moss = 0, mossCol = '#3f6a3a', grain = 0.45, s = 0 }) {
  const B = hx(base), M = hx(mortar), G = hx(mossCol), bh = TS / rows, bw = TS / cols;
  return paint(tex(), (x, y) => {
    const row = Math.floor(y / bh), off = (row % 2) * bw / 2, xx = (x + off) % TS, col = Math.floor(xx / bw);
    const lx = xx % bw, ly = y % bh;
    const n = N.fbm(x / 8, y / 8, 8, 4, s + 3);
    if (lx < 1 || ly < 1) return mul(M, 0.8 + 0.4 * n);
    const tint = 0.78 + 0.34 * N.hash(col + 5 * s, row, 9 + s);
    let c = mul(B, tint * (1 - grain / 2 + grain * n));
    if (ly === 1 || lx === 1) c = mul(c, 1.22); else if (ly === bh - 1 || lx === bw - 1) c = mul(c, 0.68);
    if (N.hash(x, y, 31 + s) < 0.03) c = mul(c, 0.8); // pits
    if (moss) { const m = N.fbm(x / 6, y / 6, 10.6667, 3, s + 7) + (y / TS) * 0.25 * moss; if (m > 0.72 - moss * 0.1) c = mixc(c, mul(G, 0.7 + 0.6 * N.hash(x, y, 4)), 0.8); }
    return c;
  });
}
/** Ivy hanging down over a wall, with a few small moonflowers that glow faintly. */
function ivy(N, T, { leaf = '#2f5a34', amount = 0.5, flower = '#f4f0ff', s = 0 }) {
  const L = hx(leaf), F = hx(flower);
  const out = tex(); out.glow = T.glow ? T.glow.slice() : null;
  return paint(out, (x, y) => {
    const base = unpack(T.px[y * TS + x]);
    const d = N.fbm(x / 5.333, y / 5.333, 12, 3, 40 + s) + (1 - y / TS) * 0.35 * amount - (1 - amount) * 0.25;
    if (d < 0.6) return base;
    const h = N.hash(x, y, 41 + s);
    if (h < 0.025 && d > 0.66) return [...F, 150];
    return mul(L, 0.55 + 0.7 * N.tn(x / 2, y / 2, 32, 42 + s) + (h > 0.85 ? 0.3 : 0));
  });
}
/** A clipped hedge: deep layered leaves, lighter where the moon catches them, the odd white flower. */
function hedge(N, { leaf = '#1a3a2a', hi = '#3e6e4c', flower = '#fff8f0', s = 0 }) {
  const L = hx(leaf), H = hx(hi), F = hx(flower);
  return paint(tex(), (x, y) => {
    const big = N.fbm(x / 16, y / 16, 4, 3, 50 + s), fine = N.tn(x / 2.5, y / 2.5, 25.6, 51 + s), h = N.hash(x, y, 52 + s);
    if (h < 0.0022) return [...F, 110];
    const k = big * 0.7 + fine * 0.5 - 0.15;
    return k < 0.25 ? mul(L, 0.35 + k) : mixc(mul(L, 0.85), H, Math.min(1, (k - 0.25) * 1.6));
  });
}
/** A bookcase: shelves of books in old cloth bindings, gilt bands on the spines. */
function bookcase(N, { wood = '#4a2e1c', s = 0 }) {
  const W = hx(wood), cols = ['#5e1e28', '#1e2c4c', '#264a30', '#54391e', '#48224a', '#6a5222', '#1e464a', '#30221e', '#6a2e1e'].map(hx), gold = hx('#b8944c');
  const T = tex(), books = [];
  for (const [y0, y1] of [[4, 30], [34, 61]]) {
    let x = 3;
    while (x < TS) {
      const w = 2 + Math.floor(N.hash(x, y0, 60 + s) * 4), h = (y1 - y0) - Math.floor(N.hash(x, y0, 61 + s) * 9);
      const gap = N.hash(x, y0, 62 + s) < 0.07;
      books.push({ x, w: Math.min(w, TS - x), y0: y1 - h, y1, c: cols[Math.floor(N.hash(x, y0, 63 + s) * cols.length)], gap, band: N.hash(x, y0, 64 + s) < 0.6 });
      x += w;
    }
  }
  return paint(T, (x, y) => {
    const grain = 0.8 + 0.3 * N.tn(x / 16, y / 1.5, 4, 65 + s);
    if (y < 4 || (y >= 30 && y < 34) || y >= 61) return mul(W, grain * (y === 0 || y === 30 || y === 61 ? 1.4 : y === 3 || y === 33 ? 0.6 : 1)); // the shelves
    if (x < 3) return mul(W, grain * (x === 0 ? 1.3 : x === 2 ? 0.55 : 0.9)); // the upright
    const b = books.find((k) => x >= k.x && x < k.x + k.w && y >= (y < 30 ? 4 : 34) && y < (y < 30 ? 30 : 61));
    if (!b || b.gap || y < b.y0) return mul(W, 0.18 + 0.08 * N.hash(x, y, 66));
    const lx = x - b.x, ly = y - b.y0;
    let c = mul(b.c, (lx === 0 ? 1.35 : lx === b.w - 1 ? 0.6 : 1) * (0.85 + 0.25 * N.hash(x, y, 67)));
    if (b.band && (ly === 2 || ly === b.y1 - b.y0 - 3)) c = mul(gold, lx === 0 ? 1.1 : 0.85);
    return c;
  });
}
/** Panelled wood, the kind that lines a reading room. */
function panel(N, { wood = '#5a3a24', s = 0 }) {
  const W = hx(wood);
  return paint(tex(), (x, y) => {
    const g = 0.75 + 0.35 * (0.5 + 0.5 * Math.sin(x * 0.9 + N.fbm(x / 16, y / 8, 4, 3, 70 + s) * 9));
    let c = mul(W, g);
    const px = x % 32, inFrame = px >= 5 && px <= 26 && y >= 6 && y <= 57;
    if (px === 0) c = mul(c, 0.5);
    if (inFrame) { if (px === 5 || y === 6) c = mul(c, 0.65); else if (px === 26 || y === 57) c = mul(c, 1.3); else if (px === 6 || y === 7) c = mul(c, 1.25); }
    if (y < 3) c = mul(W, 1.2 - y * 0.15);
    return c;
  });
}
/** Marble slabs: pale, with soft grey veins and the occasional thread of gold. */
function marble(N, { base = '#dfe4f2', vein = '#7a84a8', gold = '#f0c870', slab = 32, s = 0 }) {
  const B = hx(base), V = hx(vein), G = hx(gold);
  return paint(tex(), (x, y) => {
    const n = N.fbm(x / 16, y / 16, 4, 5, 80 + s);
    const v = Math.abs(Math.sin((x * 0.05 + y * 0.025) * 6.283 + n * 9));
    let c = mixc(B, V, Math.pow(1 - v, 9) * 0.8);
    c = mul(c, 0.9 + 0.15 * N.tn(x / 4, y / 4, 16, 81 + s));
    if (v < 0.035 && n > 0.5) return [...G, 70];
    if (x % slab === 0 || y % slab === 0) c = mul(c, 0.7);
    return c;
  });
}
/** Night glass: deep blue crystal, a few stars caught inside it, glowing. */
function nightGlass(N, { base = '#2a3a7a', edge = '#9ab8ff', s = 0 }) {
  const B = hx(base), E = hx(edge);
  return paint(tex(), (x, y) => {
    const n = N.fbm(x / 16, y / 16, 4, 4, 90 + s), lx = x % 32, ly = y % 32;
    let c = mixc(mul(B, 0.6 + 0.6 * n), E, Math.pow(Math.max(0, 1 - Math.min(lx, ly, 31 - lx, 31 - ly) / 6), 3) * 0.6);
    const h = N.hash(x, y, 91 + s);
    if (h < 0.012) return [255, 250, 235, 120 + h * 9000];
    if (lx === 0 || ly === 0) c = mul(E, 0.8);
    return [...c, 40];
  });
}
/** A stained-glass moon in an arched window, lit from the far side. */
function moonWindow(N, { frame, glass = '#1e3a8a', glass2 = '#3a2a7a', moon = '#ffe6a0', s = 0 }) {
  const F = unpack(frame.px[0]), G1 = hx(glass), G2 = hx(glass2), M = hx(moon);
  return paint(tex(), (x, y) => {
    const cx = x - 31.5, inArch = Math.abs(cx) < 18 && y > 8 && y < 58 && (y > 24 || Math.hypot(cx, y - 24) < 18);
    if (!inArch) return unpack(frame.px[y * TS + x]);
    if (Math.abs(cx) > 16.5 || y > 56 || (y <= 24 && Math.hypot(cx, y - 24) > 16.5)) return mul(F, 0.55); // the reveal
    const lead = (Math.abs(cx) < 0.6 || (y % 11 === 0)) && Math.hypot(cx, y - 30) > 9.5;
    if (lead) return [24, 20, 30];
    const dm = Math.hypot(cx, y - 30), cres = dm < 8.5 && Math.hypot(cx - 3.5, y - 28) > 7;
    if (cres) return [...M, 255];
    if (Math.abs(dm - 9) < 0.8) return [40, 30, 40];
    const c = (Math.floor((cx + 20) / 6) + Math.floor(y / 11)) % 2 ? G1 : G2;
    return [...mul(c, 0.8 + 0.5 * N.hash(Math.floor(cx / 6), Math.floor(y / 11), 100 + s)), 200];
  });
}
/** A rune carved into a stone and glowing from inside. */
function runeStone(N, T, { glow = '#7af0ff', s = 0 }) {
  const C = hx(glow), out = tex();
  const strokes = [];
  const r = (k) => N.hash(k, 7, 110 + s);
  strokes.push(['c', 0, 0, 9 + r(1) * 3]);
  for (let k = 0; k < 4; k++) { const a = r(k + 2) * 6.283, b = a + 1.5 + r(k + 9) * 2; strokes.push(['l', Math.cos(a) * 11, Math.sin(a) * 11, Math.cos(b) * 11, Math.sin(b) * 11]); }
  const dist = (x, y) => {
    let d = 99;
    for (const st of strokes) {
      if (st[0] === 'c') d = Math.min(d, Math.abs(Math.hypot(x, y) - st[3]));
      else { const [, ax, ay, bx, by] = st, vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))); d = Math.min(d, Math.hypot(x - ax - vx * t, y - ay - vy * t)); }
    }
    return d;
  };
  return paint(out, (x, y) => {
    const base = unpack(T.px[y * TS + x]), d = dist(x - 31.5, y - 31.5);
    if (d < 1.1) return [...mixc(C, [255, 255, 255], 0.4), 255];
    if (d < 4) return [...mixc(base, C, (1 - d / 4) * 0.55), 90 * (1 - d / 4)];
    return base;
  });
}
/** A door: planks or stone, iron bands, and a moon on it, faintly glowing. */
function door(N, { plank = '#5a3a26', band = '#3a3a44', moon = '#f4e8c0', s = 0 }) {
  const P = hx(plank), B = hx(band), M = hx(moon);
  return paint(tex(), (x, y) => {
    if (x < 3 || x > 60) return mul(B, x === 0 || x === 63 ? 0.6 : 1.1);
    const pl = Math.floor((x - 3) / 9.5), lx = (x - 3) % 9.5;
    let c = mul(P, (0.8 + 0.3 * N.hash(pl, 0, 120 + s)) * (0.8 + 0.3 * N.tn(x / 16, y / 1.2, 4, 121 + s)));
    if (lx < 1) c = mul(c, 0.5);
    if (Math.abs(y - 12) < 2.5 || Math.abs(y - 52) < 2.5) { c = mul(B, Math.abs(y - 12) < 0.6 || Math.abs(y - 52) < 0.6 ? 1.3 : 1); if ((x - 6) % 10 === 0) c = [180, 180, 190]; }
    const dm = Math.hypot(x - 31.5, y - 31.5);
    if (dm < 7 && Math.hypot(x - 34, y - 29.5) > 6) return [...M, 160];
    if (Math.abs(dm - 8.5) < 0.7) return mul(B, 1.2);
    return c;
  });
}
/** Little trim stones for the risers of steps and the rims of pools. */
const riser = (N, base, mortar, s) => stone(N, { base, mortar, rows: 8, cols: 4, grain: 0.3, s });

// ------------------------------------------------------------------ flats
/** Flagstones: irregular slabs (a jittered grid, tiled), grass or moss in the joints. */
function flags(N, { base = '#8a8478', joint = '#3a5a34', cells = 3, s = 0 }) {
  const B = hx(base), J = hx(joint), cw = TS / cells;
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.2 + N.hash(i, j, 130 + s) * 0.6) * cw, (j + 0.2 + N.hash(i, j, 131 + s) * 0.6) * cw, i, j]);
  return paint(tex(), (x, y) => {
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (const [px, py, i, j] of pts) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const d = Math.hypot(x - px - ox * TS, y - py - oy * TS);
      if (d < d1) { d2 = d1; d1 = d; id = i + j * 7; } else if (d < d2) d2 = d;
    }
    const n = N.fbm(x / 8, y / 8, 8, 3, 132 + s);
    if (d2 - d1 < 1.6) return mul(J, 0.6 + 0.6 * n);
    let c = mul(B, (0.8 + 0.3 * N.hash(id, 1, 133 + s)) * (0.8 + 0.4 * n));
    if (d2 - d1 < 3) c = mul(c, 1.12);
    return c;
  });
}
function grass(N, { base = '#2e5a32', flower = '#e8f0ff', s = 0 }) {
  const B = hx(base), F = hx(flower);
  return paint(tex(), (x, y) => {
    const h = N.hash(x, y, 140 + s);
    if (h < 0.004) return [...F, 140];
    return mul(B, 0.55 + 0.5 * N.fbm(x / 8, y / 8, 8, 3, 141 + s) + (h > 0.8 ? 0.25 : 0));
  });
}
function carpet(N, { base = '#5a1e2e', line = '#d0a050', edge = '#2a1430', s = 0 }) {
  const B = hx(base), L = hx(line), E = hx(edge);
  return paint(tex(), (x, y) => {
    const wear = 0.85 + 0.25 * N.fbm(x / 16, y / 16, 4, 3, 150 + s);
    const a = (x + y) % 32, b = (x - y + 64) % 32;
    if (a === 0 || b === 0) return mul(L, wear * 0.9);
    const dx = Math.abs((x % 32) - 16), dy = Math.abs((y % 32) - 16);
    if (dx + dy < 4) return mul(L, wear);
    if (dx + dy < 7) return mul(E, wear);
    return mul(B, wear * (0.9 + 0.15 * N.hash(x, y, 151)));
  });
}
function boards(N, { wood = '#6a4a2e', s = 0 }) {
  const W = hx(wood);
  return paint(tex(), (x, y) => {
    const row = Math.floor(y / 8), off = N.hash(row, 0, 160 + s) * TS, xx = (x + off) % TS;
    let c = mul(W, (0.75 + 0.3 * N.hash(row, Math.floor(xx / 32), 161 + s)) * (0.85 + 0.25 * N.tn(x / 16, y / 1, 4, 162 + s)));
    if (y % 8 === 0 || xx % 32 === 0) c = mul(c, 0.5);
    return c;
  });
}
function starTiles(N, { a = '#1a2050', b = '#2a1e50', star = '#f0d080', s = 0 }) {
  const A = hx(a), B = hx(b), S = hx(star);
  return paint(tex(), (x, y) => {
    const tx = x % 32, ty = y % 32, dx = Math.min(tx, 32 - tx), dy = Math.min(ty, 32 - ty);
    if (dx * dy < 6 && dx + dy < 9) return [...mul(S, 0.8), 50];
    const c = ((x >> 5) + (y >> 5)) % 2 ? A : B;
    return mul(c, 0.8 + 0.35 * N.fbm(x / 8, y / 8, 8, 4, 170 + s));
  });
}
function beams(N, { wood = '#3a2618', s = 0 }) {
  const W = hx(wood);
  return paint(tex(), (x, y) => {
    const by = y % 32, beam = by < 10;
    let c = mul(W, (beam ? 1.05 : 0.6) * (0.8 + 0.3 * N.tn(x / 1.5, y / 16, 42.6667, 180 + s)));
    if (by === 0) c = mul(c, 1.4); else if (by === 9) c = mul(c, 0.5);
    if (!beam && x % 16 === 0) c = mul(c, 0.6);
    return c;
  });
}
function paintedStars(N, { base = '#141c44', star = '#f0d890', s = 0 }) {
  const B = hx(base), S = hx(star);
  return paint(tex(), (x, y) => {
    const h = N.hash(x, y, 190 + s);
    if (h < 0.01) return [...S, 200];
    return mul(B, 0.7 + 0.5 * N.fbm(x / 8, y / 8, 8, 3, 191 + s));
  });
}

// ------------------------------------------------------------------ skies
/** A whole sky by direction: gradient, Milky Way, aurora, and the moon with halo and ring. */
export function makeSky(N, o) {
  const T = { w: SKY_W, h: SKY_H, px: new Uint32Array(SKY_W * SKY_H) };
  const Z = hx(o.zen), M = hx(o.mid), H = hx(o.hor), GL = hx(o.glow), MC = hx(o.moonCol), BAND = hx(o.band || '#b8b0e0');
  const ma = o.moon[0], me = o.moon[1], md = [Math.cos(me) * Math.cos(ma), Math.cos(me) * Math.sin(ma), Math.sin(me)];
  const bn = (() => { const a = o.bandTilt ?? 0.9, b = ma + 1.2; const v = [Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), Math.cos(a)]; return v; })();
  // a tangent frame on the moon, for its face
  const up = [0, 0, 1], e1 = norm(cross(up, md)), e2 = cross(md, e1);
  const AUR = o.aurora ? o.aurora.map(hx) : null;
  for (let v = 0; v < SKY_H; v++) {
    const el = EL1 - ((v + 0.5) / SKY_H) * (EL1 - EL0), ce = Math.cos(el), se = Math.sin(el);
    for (let u = 0; u < SKY_W; u++) {
      const az = ((u + 0.5) / SKY_W) * Math.PI * 2, d = [ce * Math.cos(az), ce * Math.sin(az), se];
      const t = Math.max(0, Math.min(1, (el + 0.05) / 1.0));
      let c = t < 0.3 ? mixc(H, M, t / 0.3) : mixc(M, Z, Math.min(1, (t - 0.3) / 0.7));
      if (el < 0) c = mul(H, Math.max(0.25, 1 + el * 2.5));
      // the Milky Way, with its dark dust lanes
      const b = d[0] * bn[0] + d[1] * bn[1] + d[2] * bn[2];
      const nb = N.fbm(u / 32, v / 32, 32, 5, 200);
      const band = Math.exp(-b * b * 22) * (0.35 + 0.9 * nb) * (1 - 0.8 * sstep(0.45, 0.7, N.fbm(u / 16, v / 16, 64, 4, 201)) * Math.exp(-b * b * 60));
      c = mixc(c, BAND, band * (o.bandAmt ?? 0.32));
      // aurora curtains, if this dream has them
      if (AUR && el > 0.05 && el < 0.9) {
        const cur = Math.pow(N.fbm(u / 24, 0.5, 42.6667, 3, 202), 2.2) * 2.6, ray = 0.6 + 0.4 * N.tn(u / 2.5, 0.5, 409.6, 203);
        const k = cur * ray * sstep(0.05, 0.2, el) * (1 - sstep(0.25, 0.9, el)) * o.auroraAmt;
        c = mixc(c, mixc(AUR[0], AUR[1], sstep(0.2, 0.6, el)), Math.min(0.85, k));
      }
      // (the stars themselves are drawn as points by the renderer, so they stay sharp wherever you look)
      // the moon's glow, its ring and its face
      const cosA = d[0] * md[0] + d[1] * md[1] + d[2] * md[2], ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
      c = mixc(c, GL, Math.min(1, Math.exp(-ang * 3.2) * 0.75 + Math.exp(-ang * 14) * 0.6));
      if (o.ring) { const r = (ang - o.ring) / 0.035; if (Math.abs(r) < 3) { const w = Math.exp(-r * r) * 0.18; c = [c[0] + 255 * w * (1 - r * 0.25), c[1] + 235 * w, c[2] + 255 * w * (1 + r * 0.25)]; } }
      if (ang < o.moonRad) {
        const px = (d[0] * e1[0] + d[1] * e1[1] + d[2] * e1[2]) / Math.sin(o.moonRad), py = (d[0] * e2[0] + d[1] * e2[1] + d[2] * e2[2]) / Math.sin(o.moonRad);
        const r2 = px * px + py * py, limb = Math.pow(Math.max(0, 1 - r2), 0.25);
        const mar = N.fbm(px * 2 + 4, py * 2 + 4, 64, 5, 206), crat = N.tn(px * 9 + 30, py * 9 + 30, 256, 207);
        let k = (0.78 + 0.22 * limb) * (mar > 0.55 ? 0.78 : 1) * (crat > 0.8 ? 0.85 : crat < 0.12 ? 1.08 : 1);
        const edge = sstep(1, 0.9, Math.sqrt(r2));
        c = mixc(c, mul(MC, k), edge);
      }
      T.px[v * SKY_W + u] = pack(c[0], c[1], c[2]);
    }
  }
  return T;
}
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/** Wisps of cloud, as coverage (0-255): thin near the zenith, more of them low down. */
export function makeClouds(N, amount) {
  const a = new Uint8Array(CL_W * CL_H);
  for (let v = 0; v < CL_H; v++) for (let u = 0; u < CL_W; u++) {
    const el = CL_EL1 - ((v + 0.5) / CL_H) * (CL_EL1 - EL0);
    const n = N.fbm(u / 64, v / 16, 8, 5, 220 + Math.floor(amount * 10)) * 0.75 + N.fbm(u / 16, v / 8, 32, 3, 221) * 0.25;
    const k = sstep(0.55 - amount * 0.15, 0.8, n) * sstep(CL_EL1, 0.3, el) * sstep(-0.15, 0.05, el);
    a[v * CL_W + u] = clamp8(k * 255 * 0.85);
  }
  return a;
}

// ------------------------------------------------------------------ sprites, drawn with the 2D canvas and snapped to pixels
function sprite(w, h, draw, glow) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const T = { w, h, px: new Uint32Array(w * h), alpha: new Uint8Array(w * h), glow: null };
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 110) { const a = d[i * 4 + 3] / 255; T.px[i] = pack(d[i * 4] / a, d[i * 4 + 1] / a, d[i * 4 + 2] / a); T.alpha[i] = 1; }
  if (glow) {
    g.clearRect(0, 0, w, h); glow(g, w, h);
    const e = g.getImageData(0, 0, w, h).data; T.glow = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) T.glow[i] = T.alpha[i] ? e[i * 4 + 3] : 0;
  }
  return T;
}
const ell = (g, x, y, rx, ry, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
const rect = (g, x, y, w, h, fill) => { g.fillStyle = fill; g.fillRect(x, y, w, h); };

export function stoneLantern() {
  const body = (g) => {
    rect(g, 8, 50, 12, 6, '#6a6a70'); rect(g, 11, 30, 6, 20, '#7a7a80'); rect(g, 6, 27, 16, 4, '#6a6a72');
    rect(g, 7, 17, 14, 10, '#5a5a62'); rect(g, 9, 19, 10, 7, '#ffd890');
    g.fillStyle = '#707078'; g.beginPath(); g.moveTo(1, 17); g.lineTo(27, 17); g.lineTo(20, 10); g.lineTo(8, 10); g.closePath(); g.fill();
    rect(g, 12, 5, 4, 5, '#7a7a82'); ell(g, 14, 4, 2.5, 2.5, '#7a7a82');
    rect(g, 11, 30, 2, 20, '#8a8a92'); rect(g, 2, 16, 24, 1, '#8a8a92');
  };
  return sprite(28, 56, body, (g) => { rect(g, 9, 19, 10, 7, '#fff'); });
}
export function hangingLantern(col = '#ffcf7a') {
  return sprite(16, 44, (g) => {
    rect(g, 7, 0, 2, 12, '#3a3a40'); rect(g, 4, 12, 8, 3, '#2a2a30');
    ell(g, 8, 24, 6, 9, col); rect(g, 3, 32, 10, 3, '#2a2a30');
    for (let y = 18; y < 32; y += 4) rect(g, 2, y, 12, 1, '#c88a40');
    rect(g, 7, 35, 2, 7, '#c84a3a');
  }, (g) => { ell(g, 8, 24, 6, 9, 'rgba(255,255,255,0.95)'); });
}
export function moonflowers() {
  const pts = [[7, 9], [15, 5], [23, 10], [11, 14], [20, 15]];
  return sprite(32, 24, (g) => {
    g.fillStyle = '#244a2a';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(4 + i * 3, 19, 2, 6, (i - 4) * 0.25, 0, Math.PI * 2); g.fill(); }
    rect(g, 2, 21, 28, 3, '#1e3a22');
    for (const [x, y] of pts) { rect(g, x, y + 2, 1, 22 - y, '#2f5a34'); ell(g, x, y, 3, 2.5, '#f4f2ff'); ell(g, x, y, 1, 1, '#ffe8a0'); }
  }, (g) => { for (const [x, y] of pts) ell(g, x, y, 3, 2.5, 'rgba(255,255,255,0.6)'); });
}
export function koi(frame, col = '#ff8a4a') {
  return sprite(40, 20, (g) => {
    const sway = frame ? 3 : -3;
    g.fillStyle = 'rgba(255,240,230,0.9)'; g.beginPath(); g.moveTo(31, 10); g.lineTo(39, 4 + sway); g.lineTo(37, 10); g.lineTo(39, 16 + sway); g.closePath(); g.fill();
    ell(g, 18, 10, 14, 6, '#f8f0e8');
    ell(g, 14, 8, 5, 3, col); ell(g, 23, 11, 4, 3, col); ell(g, 8, 10, 3, 2.5, col);
    g.fillStyle = 'rgba(255,240,230,0.9)'; g.beginPath(); g.moveTo(16, 14); g.lineTo(21, 19); g.lineTo(23, 14); g.fill();
    g.beginPath(); g.moveTo(16, 5); g.lineTo(22, 1); g.lineTo(24, 5); g.fill();
    rect(g, 6, 8, 1, 1, '#1a1a1a');
  }, (g) => { ell(g, 18, 10, 14, 6, 'rgba(255,255,255,0.3)'); });
}
export function candelabra() {
  const flames = [[6, 14], [14, 9], [22, 14]];
  return sprite(28, 56, (g) => {
    rect(g, 9, 51, 10, 4, '#a07a30'); rect(g, 13, 24, 2, 28, '#c8a040'); rect(g, 5, 24, 18, 2, '#c8a040');
    rect(g, 5, 18, 2, 7, '#c8a040'); rect(g, 21, 18, 2, 7, '#c8a040');
    for (const [x, y] of flames) { rect(g, x - 1, y + 3, 3, 9 - (x === 14 ? 4 : 0), '#f4ecd8'); ell(g, x, y + 1, 1.6, 3, '#ffcf6a'); ell(g, x, y + 2, 0.8, 1.4, '#fff8e0'); }
  }, (g) => { for (const [x, y] of flames) ell(g, x, y + 1, 1.6, 3, '#fff'); });
}
export function book(frame) {
  return sprite(24, 16, (g) => {
    const lift = frame ? -4 : 2;
    g.fillStyle = '#6a2a3a'; g.beginPath(); g.moveTo(12, 10); g.lineTo(1, 8 + lift); g.lineTo(1, 11 + lift); g.lineTo(12, 13); g.lineTo(23, 11 + lift); g.lineTo(23, 8 + lift); g.closePath(); g.fill();
    g.fillStyle = '#f4ead0'; g.beginPath(); g.moveTo(12, 10); g.lineTo(2, 7 + lift); g.lineTo(2, 9 + lift); g.lineTo(12, 12); g.lineTo(22, 9 + lift); g.lineTo(22, 7 + lift); g.closePath(); g.fill();
  }, (g) => { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, 24, 16); });
}
export function jelly(frame) {
  return sprite(24, 34, (g) => {
    const sq = frame ? 1.5 : 0;
    ell(g, 12, 10, 10 - sq, 8 + sq, 'rgba(140,240,255,0.95)'); ell(g, 12, 9, 6 - sq, 5, 'rgba(220,250,255,1)');
    g.strokeStyle = 'rgba(150,230,255,1)'; g.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(5 + k * 4.5, 16); g.quadraticCurveTo(3 + k * 4.5 + (frame ? 3 : -2), 24, 6 + k * 4.5, 33); g.stroke(); }
  }, (g) => { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(0, 0, 24, 34); });
}
export function crystal(a = '#ff9ae8', b = '#9ae8ff') {
  const shards = [[12, 2, 5, 30], [6, 12, 4, 22], [18, 10, 4, 24], [3, 22, 3, 14], [21, 24, 3, 12]];
  const draw = (g) => {
    for (const [x, y, w, h] of shards) { const gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + 6); g.lineTo(x + w * 0.7, y + h); g.lineTo(x - w * 0.7, y + h); g.lineTo(x - w, y + 6); g.closePath(); g.fill(); rect(g, x, y + 2, 1, h - 4, 'rgba(255,255,255,0.9)'); }
    rect(g, 1, 36, 22, 4, '#4a4458');
  };
  return sprite(24, 40, draw, (g) => { for (const [x, y, w, h] of shards) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x - w, y, w * 2, h); } });
}
export function orbPlinth(col = '#d8c8ff') {
  return sprite(24, 52, (g) => {
    rect(g, 4, 46, 16, 6, '#c8c4d8'); rect(g, 7, 24, 10, 22, '#dcd8ea'); rect(g, 7, 24, 2, 22, '#f0eef8'); rect(g, 4, 20, 16, 4, '#c8c4d8');
    ell(g, 12, 12, 8, 8, col); ell(g, 10, 10, 3, 3, '#ffffff');
  }, (g) => { ell(g, 12, 12, 8, 8, '#fff'); });
}
/** The dreamer's own hand, in a striped pyjama sleeve, holding up a lantern (drawn like a Doom weapon). */
export function heldLantern() {
  return sprite(64, 80, (g) => {
    // the arm, in a striped pyjama sleeve, reaching in from the bottom right
    g.save(); g.translate(60, 86); g.rotate(-0.42);
    rect(g, -10, -74, 20, 80, '#4e5c9e'); for (let y = -66; y < 6; y += 7) rect(g, -10, y, 20, 2, '#b8c2e8');
    rect(g, -11, -76, 22, 6, '#3e4a86');
    g.restore();
    // the lantern hangs from the bail
    g.strokeStyle = '#2a2a30'; g.lineWidth = 2; g.beginPath(); g.arc(28, 22, 9, Math.PI, 0); g.stroke();
    rect(g, 18, 22, 20, 5, '#2a2a34'); g.fillStyle = '#2a2a34'; g.beginPath(); g.moveTo(16, 27); g.lineTo(40, 27); g.lineTo(36, 22); g.lineTo(20, 22); g.fill();
    rect(g, 19, 27, 18, 26, '#ffd27a'); rect(g, 21, 29, 14, 22, '#fff0c0');
    rect(g, 18, 27, 2, 26, '#2a2a34'); rect(g, 36, 27, 2, 26, '#2a2a34'); rect(g, 27, 27, 2, 26, '#3a3a44');
    ell(g, 28, 44, 3, 5, '#ffffff'); rect(g, 27, 46, 2, 6, '#f4ecd8');
    rect(g, 16, 53, 24, 5, '#2a2a34'); rect(g, 22, 58, 12, 2, '#2a2a34');
    // the hand round the top of the bail
    ell(g, 30, 12, 7, 5.5, '#d8a888'); rect(g, 23, 9, 14, 3, '#e8b898');
    for (let k = 0; k < 4; k++) rect(g, 24 + k * 3.2, 14, 2.4, 3, '#c89878');
    ell(g, 36, 10, 3, 4, '#e0b090');
  }, (g) => { rect(g, 19, 27, 18, 26, '#fff'); });
}

// ------------------------------------------------------------------ see-through walls (Doom's masked mid-textures)
function masked(fn) {
  const T = tex(); T.alpha = new Uint8Array(TS * TS);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const c = fn(x, y); if (!c) continue;
    const i = y * TS + x; T.px[i] = pack(c[0], c[1], c[2]); T.alpha[i] = 1;
    if (c[3]) { if (!T.glow) T.glow = new Uint8Array(TS * TS); T.glow[i] = clamp8(c[3]); }
  }
  return T;
}
/** A wrought-iron garden gate, ivy climbing it. */
function gate(N, { iron = '#2a2a34', leaf = '#2a5a34', frost = 0, s = 0 }) {
  const I = hx(iron), L = hx(leaf);
  return masked((x, y) => {
    const bar = x % 8 === 3 || x % 8 === 4, rail = (y >= 14 && y <= 15) || (y >= 56 && y <= 57) || y >= 62;
    const tip = x % 8 >= 2 && x % 8 <= 5 && y >= 4 && y < 8 && Math.abs((x % 8) - 3.5) < (y - 3) * 0.6;
    const curl = Math.abs(Math.hypot((x % 16) - 8, y - 22) - 5) < 0.8 && y < 26;
    const on = (bar && y >= 7) || rail || tip || curl || x < 2 || x > 61;
    const lv = N.fbm(x / 6, y / 6, 10.6667, 3, 400 + s) + (y / TS) * 0.25;
    if (lv > 0.66 && (on || lv > 0.72)) return mul(L, 0.6 + 0.7 * N.hash(x, y, 401 + s));
    if (!on) return null;
    let c = mul(I, x % 8 === 3 ? 1.5 : 1);
    if (frost && N.hash(x, y, 402) < frost) c = [210, 225, 245];
    return c;
  });
}
/** Carved wooden lattice, a reading-room screen. */
function lattice(N, { wood = '#5a3a24', s = 0 }) {
  const W = hx(wood);
  return masked((x, y) => {
    const fr = x < 3 || x > 60 || y < 3 || y > 60, d1 = (x + y) % 11, d2 = (x - y + 66) % 11;
    if (!fr && d1 > 1 && d2 > 1) return null;
    return mul(W, (fr ? 1 : 0.85) * (0.8 + 0.3 * N.tn(x / 16, y / 1.5, 4, 410 + s)) * (d1 === 0 || d2 === 0 ? 1.25 : 1));
  });
}
/** A stone screen pierced with round holes. */
function pierced(N, T, { r = 5.5 } = {}) {
  return masked((x, y) => {
    const dx = (x % 16) - 7.5, dy = (y % 16) - 7.5, d = Math.hypot(dx, dy);
    if (d < r) return null;
    const c = unpack(T.px[y * TS + x]);
    return d < r + 1.2 ? mul(c, dy < 0 ? 0.6 : 1.3) : c;
  });
}
/** Golden filigree: thin bars and rings, glinting. */
function filigree(N, { gold = '#e0b860', s = 0 }) {
  const G = hx(gold);
  return masked((x, y) => {
    const bar = x % 16 === 7 || x % 16 === 8, ring = Math.abs(Math.hypot((x % 16) - 7.5, (y % 16) - 7.5) - 6) < 0.7, fr = x < 2 || x > 61 || y > 61 || y < 2;
    if (!bar && !ring && !fr) return null;
    return [...mul(G, 0.8 + 0.4 * N.hash(x, y, 420 + s)), N.hash(x, y, 421 + s) < 0.05 ? 160 : 30];
  });
}
/** Crystal leading: a lattice of fine lines with a star at each crossing. */
function crystalLattice(N, { line = '#f0c8ff' } = {}) {
  const C = hx(line);
  return masked((x, y) => {
    const lx = x % 16, ly = y % 16, ax = Math.abs(lx - 8), ay = Math.abs(ly - 8), star = ax + ay < 3 - Math.min(ax, ay) * 0.8;
    if (!(lx === 0 || ly === 0 || star || x > 62 || y > 62)) return null;
    return [...mul(C, star ? 1.1 : 0.75), star ? 140 : 40];
  });
}

// ------------------------------------------------------------------ more walls and floors
/** Walls of cloud: soft puffs, lilac in the shadows, pink-white where the moon catches them, a gold band. */
function cloudStone(N, { lo = '#3e3258', hi = '#b8a4c0', s = 0 }) {
  const L = hx(lo), H = hx(hi);
  return paint(tex(), (x, y) => {
    const n = N.fbm(x / 16, y / 16, 4, 5, 430 + s), m = N.fbm(x / 8 + 3, y / 8, 8, 3, 431 + s);
    const k = sstep(0.32, 0.72, n * 0.8 + m * 0.3 + (1 - y / TS) * 0.12);
    let c = mul(mixc(L, H, k), 0.82);
    if (y % 32 === 0 || y % 32 === 1) c = mixc(c, [224, 184, 96], 0.7);
    return c;
  });
}
/** Old stone with snow lying along the top of every course. */
function snowStone(N, { base = '#6a6a74', mortar = '#2a2a34', s = 0 }) {
  const T = stone(N, { base, mortar, rows: 4, cols: 2, grain: 0.4, s });
  return paint(tex(), (x, y) => {
    const c = unpack(T.px[y * TS + x]), ly = y % 16, drift = 1.5 + 2.5 * N.tn(x / 4, Math.floor(y / 16), 16, 440 + s);
    if (ly >= 1 && ly < drift) return mixc([168, 178, 198], [136, 148, 172], N.hash(x, y, 441) * 0.5);
    return c;
  });
}
function snowFloor(N, { s = 0 } = {}) {
  return paint(tex(), (x, y) => {
    const n = N.fbm(x / 16, y / 16, 4, 4, 450 + s), h = N.hash(x, y, 451 + s);
    if (h < 0.01) return [255, 255, 255, 160];
    return mixc([104, 116, 144], [160, 170, 194], 0.4 + n * 0.6);
  });
}

// ------------------------------------------------------------------ paintings of the other worlds, hung in the galleries
const WORLD_THUMBS = ['cave', 'drive', 'ocean', 'aurora', 'cotswold', 'disco', 'canal', 'market', 'choir', 'penny', 'pizza', 'sheep', 'pixel', 'sands', 'snowstorm', 'saysno', 'train', 'pusher', 'spiro', 'fever'];
let paintingsP = null;
export function loadPaintings() {
  if (paintingsP) return paintingsP;
  paintingsP = Promise.all(WORLD_THUMBS.map((id) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = new URL(`../../thumbs/${id}.jpg`, import.meta.url).href;
  }))).then((ims) => ims.filter(Boolean).map((im) => {
    const c = document.createElement('canvas'); c.width = TS; c.height = TS;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#2a2026'; g.fillRect(0, 0, TS, TS);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(13, 6, 42, 56);
    const gr = g.createLinearGradient(10, 4, 54, 60); gr.addColorStop(0, '#f0d488'); gr.addColorStop(0.5, '#a07830'); gr.addColorStop(1, '#e0bc68');
    g.fillStyle = gr; g.fillRect(11, 4, 42, 56);
    g.fillStyle = '#5a4018'; g.fillRect(14, 7, 36, 50);
    g.drawImage(im, 15, 8, 34, 48);
    const d = g.getImageData(0, 0, TS, TS).data, T = tex();
    for (let i = 0; i < TS * TS; i++) T.px[i] = pack(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    T.glow = new Uint8Array(TS * TS);
    for (let y = 8; y < 56; y++) for (let x = 15; x < 49; x++) T.glow[y * TS + x] = 70; // a little lit, like a gallery picture
    return T;
  }));
  return paintingsP;
}

// ------------------------------------------------------------------ creatures and more things
export function cat(frame) {
  return sprite(36, 20, (g) => {
    const b = frame ? 0.6 : 0;
    ell(g, 18, 13 - b / 2, 14, 7 + b, '#8a8aa0'); ell(g, 20, 11 - b, 10, 4, '#a0a0b8');
    g.strokeStyle = '#7a7a90'; g.lineWidth = 3; g.beginPath(); g.arc(18, 14, 13, 0.2, 2.2); g.stroke();
    ell(g, 7, 13, 6, 5, '#9a9ab0');
    g.fillStyle = '#8a8aa0'; g.beginPath(); g.moveTo(3, 10); g.lineTo(4, 5); g.lineTo(7, 9); g.fill(); g.beginPath(); g.moveTo(8, 9); g.lineTo(11, 5); g.lineTo(12, 10); g.fill();
    rect(g, 4, 13, 2, 1, '#3a3a48'); rect(g, 8, 13, 2, 1, '#3a3a48');
    for (let k = 0; k < 4; k++) rect(g, 14 + k * 5, 8 - b, 2, 1, '#6a6a80');
  });
}
export function owl(frame) {
  return sprite(16, 22, (g) => {
    ell(g, 8, 13, 6, 8, '#6a5440'); ell(g, 8, 9, 5.5, 5, '#8a7458');
    g.fillStyle = '#6a5440'; g.beginPath(); g.moveTo(3, 6); g.lineTo(4, 1); g.lineTo(6, 5); g.fill(); g.beginPath(); g.moveTo(10, 5); g.lineTo(12, 1); g.lineTo(13, 6); g.fill();
    if (frame) { rect(g, 4, 9, 3, 1, '#2a2018'); rect(g, 9, 9, 3, 1, '#2a2018'); } else { ell(g, 5.5, 9, 2, 2, '#ffd860'); ell(g, 10.5, 9, 2, 2, '#ffd860'); rect(g, 5, 9, 1, 1, '#1a1410'); rect(g, 10, 9, 1, 1, '#1a1410'); }
    rect(g, 7, 11, 2, 2, '#c89040');
    for (let y = 14; y < 20; y += 2) rect(g, 5, y, 6, 1, '#7a6450');
    rect(g, 5, 20, 2, 2, '#c89040'); rect(g, 9, 20, 2, 2, '#c89040');
  }, (g) => { if (!frame) { ell(g, 5.5, 9, 2, 2, 'rgba(255,255,255,0.6)'); ell(g, 10.5, 9, 2, 2, 'rgba(255,255,255,0.6)'); } });
}
const DEER = '#d8f4ff';
export function deerSide(frame) {
  return sprite(48, 44, (g) => {
    g.strokeStyle = DEER; g.fillStyle = DEER;
    ell(g, 22, 24, 13, 6.5, DEER);
    g.lineWidth = 4; g.beginPath(); g.moveTo(32, 21); g.lineTo(37, 11); g.stroke();
    ell(g, 39, 10, 5, 3, DEER);
    g.lineWidth = 1.2; g.beginPath(); g.moveTo(37, 7); g.lineTo(33, 1); g.moveTo(35, 4); g.lineTo(31, 3); g.moveTo(39, 7); g.lineTo(42, 0); g.moveTo(41, 3); g.lineTo(45, 2); g.stroke();
    g.lineWidth = 2;
    const sw = frame ? 3 : -3;
    for (const [x, d] of [[13, sw], [16, -sw], [29, -sw], [32, sw]]) { g.beginPath(); g.moveTo(x, 28); g.lineTo(x + d * 0.5, 36); g.lineTo(x + d, 43); g.stroke(); }
    ell(g, 9, 21, 2.5, 2, '#ffffff');
  }, (g) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, 48, 44); });
}
export function deerFront() {
  return sprite(28, 44, (g) => {
    g.strokeStyle = DEER;
    ell(g, 14, 24, 7, 7, DEER); ell(g, 14, 12, 4, 6, DEER);
    g.lineWidth = 1.2; g.beginPath();
    g.moveTo(11, 7); g.lineTo(5, 1); g.moveTo(8, 4); g.lineTo(3, 5); g.moveTo(17, 7); g.lineTo(23, 1); g.moveTo(20, 4); g.lineTo(25, 5); g.stroke();
    ell(g, 7, 8, 2.5, 1.2, DEER); ell(g, 21, 8, 2.5, 1.2, DEER);
    g.lineWidth = 2; for (const x of [10, 13, 15, 18]) { g.beginPath(); g.moveTo(x, 28); g.lineTo(x, 43); g.stroke(); }
  }, (g) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, 28, 44); });
}
export function whale() {
  return sprite(128, 48, (g) => {
    g.fillStyle = '#a8c8f0';
    g.beginPath(); g.moveTo(4, 22); g.bezierCurveTo(10, 6, 50, 4, 84, 16); g.bezierCurveTo(98, 20, 106, 22, 112, 20); g.lineTo(126, 10); g.lineTo(120, 24); g.lineTo(126, 36); g.lineTo(110, 27); g.bezierCurveTo(96, 32, 70, 40, 40, 36); g.bezierCurveTo(18, 34, 4, 30, 4, 22); g.fill();
    g.fillStyle = '#d0e4ff'; g.beginPath(); g.moveTo(8, 27); g.bezierCurveTo(30, 36, 60, 38, 84, 30); g.lineTo(84, 33); g.bezierCurveTo(60, 41, 26, 39, 8, 29); g.fill();
    g.fillStyle = '#90b0e0'; g.beginPath(); g.moveTo(34, 32); g.lineTo(52, 46); g.lineTo(46, 33); g.fill();
    g.strokeStyle = '#c0d8f8'; g.lineWidth = 0.8; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(14 + k * 8, 30 + k * 0.4); g.lineTo(30 + k * 9, 35); g.stroke(); }
    rect(g, 20, 20, 2, 2, '#ffffff');
  }, (g) => { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(0, 0, 128, 48); });
}
export function skyLantern(col = '#ffb860') {
  const body = (g, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(2, 2); g.lineTo(14, 2); g.lineTo(12, 18); g.lineTo(4, 18); g.closePath(); g.fill(); };
  return sprite(16, 22, (g) => {
    body(g, col);
    rect(g, 4, 18, 8, 2, '#5a3a20'); ell(g, 8, 15, 2, 2.5, '#fff4d0');
    for (let y = 6; y < 18; y += 4) rect(g, 3, y, 10, 1, 'rgba(160,80,30,0.8)');
  }, (g) => body(g, '#fff'));
}
export function fir() {
  return sprite(32, 48, (g) => {
    rect(g, 14, 40, 4, 8, '#3a2a20');
    for (let k = 0; k < 4; k++) {
      const y = 4 + k * 9, w = 6 + k * 4;
      g.fillStyle = '#1e3a2e'; g.beginPath(); g.moveTo(16, y); g.lineTo(16 + w, y + 14); g.lineTo(16 - w, y + 14); g.closePath(); g.fill();
      g.fillStyle = '#d8e4f4'; g.beginPath(); g.moveTo(16, y); g.lineTo(16 + w * 0.6, y + 8); g.lineTo(16, y + 6); g.lineTo(16 - w * 0.6, y + 8); g.closePath(); g.fill();
    }
  });
}

// ------------------------------------------------------------------ the dreams
/** Each dream: its name, its walls, floors and ceilings, its sky, its fog, its things, its weather. Built on demand. */
export const DREAMS = [
  {
    id: 'garden', name: 'The Moon Garden', fog: '#1c1a3a', fogD: 0.075, light: 0.62, moonLight: 0.95, tint: [0.92, 0.95, 1.08],
    skyCorr: 0.85, corrH: 1.25, wallH: 1.3, hallH: 2.2, rooms: { court: 2, garden: 4, pool: 2, hall: 1, void: 1 }, doors: 0.25, water: 0,
    hills: 1.4, motes: { col: [190, 255, 140], n: 26, blink: true }, wisp: [255, 236, 190], hangCol: [1, 0.78, 0.45], lampCol: [1, 0.82, 0.55],
    weather: { petals: 1, showers: true }, whale: true, deer: true,
    sky: { zen: '#060818', mid: '#141a40', hor: '#2c2a5a', glow: '#8a90c8', moonCol: '#fff6e0', moon: [0.4, 0.62], moonRad: 0.1, ring: 0.42, band: '#c0b8e8', clouds: 0.35 },
    build(N) {
      const st = stone(N, { base: '#8a8070', mortar: '#3a3a34', moss: 0.8, s: 1 });
      return {
        walls: [hedge(N, { s: 1 }), hedge(N, { s: 2, leaf: '#163a2e' }), ivy(N, st, { amount: 0.8, s: 1 }), hedge(N, { s: 3 })],
        special: [ivy(N, stone(N, { base: '#b0a490', mortar: '#4a4a40', moss: 0.5, s: 2 }), { amount: 0.4, s: 2 })], specialLight: [null],
        upper: stone(N, { base: '#a09480', mortar: '#3a3a34', rows: 4, cols: 2, s: 3 }), step: riser(N, '#9a9080', '#3a3a34', 4),
        door: door(N, { plank: '#4a5a3a', band: '#3a3a3a', s: 1 }), grate: gate(N, { s: 1 }),
        floor: [flags(N, { base: '#6e6a64', joint: '#2a4a2e', s: 1 }), grass(N, { base: '#24462a', s: 1 })], ceil: beams(N, { wood: '#3a2a20', s: 1 }), hallCeil: beams(N, { s: 2 }),
        things: { lamp: stoneLantern(), hang: hangingLantern(), decor: [moonflowers()], float: [koi(0), koi(1)], floatScale: 0.85, owl: [owl(0), owl(1)] },
      };
    },
  },
  {
    id: 'library', name: 'The Endless Library', fog: '#1e140e', fogD: 0.1, light: 0.5, moonLight: 0.8, tint: [1.12, 0.98, 0.85],
    skyCorr: 0.08, corrH: 1.5, wallH: 1.6, hallH: 2.8, rooms: { court: 2, hall: 5 }, doors: 0.6, water: 0,
    hills: 1.1, motes: { col: [255, 220, 160], n: 34, blink: false }, wisp: [255, 220, 160], hangCol: [1, 0.75, 0.4], lampCol: [1, 0.7, 0.35],
    weather: null, paintings: true,
    sky: { zen: '#04101a', mid: '#0c2030', hor: '#1e3444', glow: '#a09060', moonCol: '#ffe8b0', moon: [2.1, 0.7], moonRad: 0.085, ring: 0, band: '#a8c0d0', clouds: 0.2 },
    build(N) {
      const pan = panel(N, { s: 1 });
      return {
        walls: [bookcase(N, { s: 1 }), bookcase(N, { s: 2 }), bookcase(N, { s: 3, wood: '#3e2618' }), pan],
        special: [moonWindow(N, { frame: pan, s: 1 })], specialLight: [[0.45, 0.55, 1]],
        upper: panel(N, { wood: '#4a2e1c', s: 2 }), step: boards(N, { wood: '#5a3a24', s: 3 }),
        door: door(N, { plank: '#6a3a22', band: '#2a2420', moon: '#ffe0a0', s: 2 }), grate: lattice(N, { s: 1 }),
        floor: [carpet(N, { s: 1 }), boards(N, { s: 1 })], ceil: beams(N, { wood: '#2e1e14', s: 3 }), hallCeil: paintedStars(N, { s: 1 }),
        things: { lamp: candelabra(), hang: hangingLantern('#ffe0a0'), decor: [candelabra()], float: [book(0), book(1)], floatScale: 1, cat: [cat(0), cat(1)] },
      };
    },
  },
  {
    id: 'temple', name: 'The Sunken Temple', fog: '#0a2026', fogD: 0.085, light: 0.5, moonLight: 0.85, tint: [0.85, 1.05, 1.05],
    skyCorr: 0.4, corrH: 1.3, wallH: 1.6, hallH: 2.4, rooms: { court: 2, pool: 4, hall: 2, void: 1 }, doors: 0.35, water: 0.3,
    hills: 1.0, motes: { col: [150, 255, 240], n: 30, blink: false }, wisp: [170, 255, 240], hangCol: [0.5, 1, 0.9], lampCol: [0.4, 0.95, 1], addFloat: 0.6,
    weather: { showers: true }, whale: true,
    sky: { zen: '#020a10', mid: '#06182a', hor: '#0e2a3a', glow: '#70a0a8', moonCol: '#e8fff8', moon: [3.6, 0.55], moonRad: 0.11, ring: 0, band: '#90c8c8', aurora: ['#40ffa0', '#a060ff'], auroraAmt: 0.55, clouds: 0.15 },
    build(N) {
      const st = stone(N, { base: '#56685f', mortar: '#1e2a26', moss: 0.55, mossCol: '#2a5a40', rows: 3, cols: 2, s: 5 });
      const st2 = stone(N, { base: '#4a5a58', mortar: '#1a2422', moss: 0.3, mossCol: '#2a5a40', rows: 4, cols: 3, s: 6 });
      return {
        walls: [st, st2, st, ivy(N, st2, { leaf: '#1e4a3a', amount: 0.5, flower: '#a0fff0', s: 3 })],
        special: [runeStone(N, st, { s: 1 }), runeStone(N, st2, { s: 2, glow: '#a0ffb0' })], specialLight: [[0.4, 1, 1], [0.55, 1, 0.65]],
        upper: stone(N, { base: '#506660', mortar: '#1e2a26', rows: 2, cols: 1, s: 7 }), step: riser(N, '#5a6a64', '#1e2a26', 8),
        door: door(N, { plank: '#3a4a46', band: '#22302c', moon: '#a0fff0', s: 3 }), grate: pierced(N, st2),
        floor: [flags(N, { base: '#56645e', joint: '#1e3a30', cells: 2, s: 3 }), flags(N, { base: '#4a5a56', joint: '#1a3028', cells: 4, s: 4 })], ceil: stone(N, { base: '#3e4c48', mortar: '#1a2422', rows: 2, cols: 2, s: 9 }), hallCeil: stone(N, { base: '#3a4644', mortar: '#162020', rows: 1, cols: 1, s: 10 }),
        things: { lamp: crystal('#7affe0', '#7ab8ff'), hang: hangingLantern('#9affe8'), decor: [crystal('#7affe0', '#b07aff')], float: [jelly(0), jelly(1)], floatScale: 1.35, owl: [owl(0), owl(1)] },
      };
    },
  },
  {
    id: 'glass', name: 'The Halls of Glass', fog: '#2a1a3a', fogD: 0.07, light: 0.68, moonLight: 1, tint: [1.02, 0.95, 1.1],
    skyCorr: 0.3, corrH: 1.4, wallH: 1.5, hallH: 3, rooms: { court: 2, hall: 4, pool: 2, void: 1 }, doors: 0.3, water: 0,
    hills: 1.7, motes: { col: [255, 210, 250], n: 30, blink: true }, wisp: [255, 220, 255], hangCol: [1, 0.72, 0.95], lampCol: [0.85, 0.72, 1], addFloat: 0.5,
    weather: null, whale: true, paintings: true,
    sky: { zen: '#0a0620', mid: '#2a1446', hor: '#5a2e64', glow: '#c0a0d8', moonCol: '#fff4fa', moon: [5.2, 0.5], moonRad: 0.13, ring: 0.5, band: '#e0c0f0', clouds: 0.3 },
    build(N) {
      const m1 = marble(N, { base: '#868298', vein: '#4c4e70', s: 1 }), m2 = marble(N, { base: '#8c8094', vein: '#5a4870', s: 2 });
      return {
        walls: [m1, m2, m1, nightGlass(N, { s: 1 })],
        special: [nightGlass(N, { base: '#4a2a7a', edge: '#ffb8f0', s: 2 }), moonWindow(N, { frame: m1, glass: '#3a2a8a', glass2: '#7a2a7a', moon: '#fff4fa', s: 2 })], specialLight: [[0.75, 0.5, 1], [0.6, 0.45, 1]],
        upper: marble(N, { base: '#8e88a6', vein: '#585c80', slab: 16, s: 3 }), step: marble(N, { base: '#84809c', vein: '#585c80', slab: 8, s: 4 }),
        door: door(N, { plank: '#8a84a4', band: '#5a5070', moon: '#ffe0ff', s: 4 }), grate: crystalLattice(N),
        floor: [starTiles(N, { s: 1 }), marble(N, { base: '#7a7494', vein: '#4a4870', slab: 32, s: 5 })], ceil: paintedStars(N, { base: '#1e1440', star: '#ffd8f0', s: 2 }), hallCeil: paintedStars(N, { base: '#1a1238', s: 3 }),
        things: { lamp: orbPlinth(), hang: hangingLantern('#ffd0f8'), decor: [crystal(), orbPlinth('#a8e8ff')], float: [jelly(0), jelly(1)], floatScale: 1.35 },
      };
    },
  },
  {
    id: 'cloud', name: 'The Cloud Palace', fog: '#3a2a4e', fogD: 0.06, light: 0.7, moonLight: 1, tint: [1.05, 0.95, 1.05],
    skyCorr: 0.7, corrH: 1.4, wallH: 1.4, hallH: 2.8, rooms: { void: 4, court: 2, hall: 2 }, doors: 0.3, water: 0,
    hills: 2, motes: { col: [255, 230, 180], n: 30, blink: true }, wisp: [255, 230, 200], hangCol: [1, 0.7, 0.8], lampCol: [1, 0.85, 0.6],
    weather: null, whale: true, deer: true,
    sky: { zen: '#140a2a', mid: '#3a2458', hor: '#8a5480', glow: '#e0a8c8', moonCol: '#fff0f4', moon: [1.3, 0.48], moonRad: 0.14, ring: 0.46, band: '#f0c8e8', clouds: 0.6 },
    build(N) {
      const c1 = cloudStone(N, { s: 1 }), c2 = cloudStone(N, { lo: '#363a60', hi: '#aaa8c4', s: 2 });
      return {
        walls: [c1, c2, c1, c2],
        special: [moonWindow(N, { frame: c1, glass: '#7a3a8a', glass2: '#3a3a9a', moon: '#fff0f4', s: 3 })], specialLight: [[1, 0.6, 0.9]],
        upper: cloudStone(N, { lo: '#463a62', hi: '#bcaac4', s: 3 }), step: marble(N, { base: '#c8b8c8', vein: '#9a8aa8', slab: 8, s: 6 }),
        door: door(N, { plank: '#c8b8d0', band: '#c0a060', moon: '#fff0c0', s: 5 }), grate: filigree(N, { s: 1 }),
        floor: [marble(N, { base: '#857890', vein: '#5e5074', slab: 32, s: 7 }), starTiles(N, { a: '#3a2a5a', b: '#4a3060', star: '#ffd890', s: 2 })], ceil: paintedStars(N, { base: '#2a1a48', star: '#ffe0f0', s: 4 }), hallCeil: paintedStars(N, { base: '#24163e', star: '#ffd890', s: 5 }),
        things: { lamp: orbPlinth('#ffe8b0'), hang: hangingLantern('#ffc8e0'), decor: [orbPlinth('#ffd0f0')], float: [skyLantern(), skyLantern('#ff9ab0')], floatScale: 1.3 },
      };
    },
  },
  {
    id: 'abbey', name: 'The Snowbound Abbey', fog: '#1a2230', fogD: 0.08, light: 0.52, moonLight: 0.95, tint: [0.95, 1, 1.1],
    skyCorr: 0.45, corrH: 1.4, wallH: 1.6, hallH: 2.8, rooms: { court: 3, hall: 3, garden: 1 }, doors: 0.45, water: 0, skyFloor: 2,
    hills: 1.2, motes: { col: [255, 210, 150], n: 16, blink: false }, wisp: [255, 214, 170], hangCol: [1, 0.72, 0.38], lampCol: [1, 0.68, 0.32],
    weather: { snow: 1 }, deer: true, paintings: true,
    sky: { zen: '#04060e', mid: '#101828', hor: '#283648', glow: '#9aa8c0', moonCol: '#f4f8ff', moon: [4.4, 0.6], moonRad: 0.1, ring: 0.4, band: '#b8c4d8', clouds: 0.45 },
    build(N) {
      const s1 = snowStone(N, { s: 1 }), s2 = snowStone(N, { base: '#5e5a62', s: 2 });
      return {
        walls: [s1, s2, s1, stone(N, { base: '#6a6670', mortar: '#2a2a34', rows: 3, cols: 2, s: 12 })],
        special: [moonWindow(N, { frame: s1, glass: '#c87a2a', glass2: '#a8501e', moon: '#fff0c0', s: 4 })], specialLight: [[1, 0.65, 0.3]],
        upper: stone(N, { base: '#605c66', mortar: '#26262e', rows: 2, cols: 1, s: 13 }), step: riser(N, '#6a6670', '#2a2a34', 14),
        door: door(N, { plank: '#4a3020', band: '#2a2a30', moon: '#ffe0a0', s: 6 }), grate: gate(N, { iron: '#24242c', leaf: '#3a4a40', frost: 0.25, s: 2 }),
        floor: [flags(N, { base: '#5e5a60', joint: '#2a2a30', cells: 3, s: 5 }), carpet(N, { base: '#3a1a22', line: '#c09048', s: 2 }), snowFloor(N)], ceil: beams(N, { wood: '#2a1e18', s: 4 }), hallCeil: stone(N, { base: '#4a4652', mortar: '#1e1e26', rows: 1, cols: 1, s: 15 }),
        things: { lamp: candelabra(), hang: hangingLantern('#ffd090'), decor: [fir()], float: [skyLantern(), skyLantern('#ffd080')], floatScale: 1.2, owl: [owl(0), owl(1)], cat: [cat(0), cat(1)] },
      };
    },
  },
];
