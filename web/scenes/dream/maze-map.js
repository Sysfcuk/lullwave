// Lost in Thought: the labyrinth itself, made fresh for each dream. A grid of cells, like an old
// first-person maze game, but each cell is a Doom "sector" of its own: its own floor height (so the
// corridors climb and fall in little flights of steps), its own ceiling height or open sky, its own
// light, water in it or not. A maze is carved (a depth-first walk, then some dead ends knocked
// through so it loops), rooms are laid over it (courtyards open to the stars, gardens, halls of
// pillars, pools), doors put in the narrow places, and lanterns, flowers and floating things set about.

export const OPEN = 0, WALL = 1, DOOR = 2;

export function buildMaze(rng, D, set, noise) {
  const M = 17, N = 2 * M + 1, NN = N * N;
  const kind = new Uint8Array(NN).fill(WALL), fl = new Float32Array(NN), ce = new Float32Array(NN);
  const sky = new Uint8Array(NN), water = new Uint8Array(NN), light = new Float32Array(NN), wt = new Uint16Array(NN), ft = new Uint8Array(NN), ct = new Uint8Array(NN), roomOf = new Int16Array(NN).fill(-1);
  const at = (x, y) => y * N + x;
  const inside = (x, y) => x > 0 && y > 0 && x < N - 1 && y < N - 1;
  const ri = (n) => Math.floor(rng() * n);
  const fbm = (x, y, s) => noise.fbm(x, y, 64, 3, s);

  // ---- the maze: a depth-first walk over the odd cells
  const seen = new Uint8Array(M * M), stack = [[ri(M), ri(M)]];
  seen[stack[0][1] * M + stack[0][0]] = 1; kind[at(stack[0][0] * 2 + 1, stack[0][1] * 2 + 1)] = OPEN;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const a = i + dx, b = j + dy; return a >= 0 && b >= 0 && a < M && b < M && !seen[b * M + a]; });
    if (!nb.length) { stack.pop(); continue; }
    const [dx, dy] = nb[ri(nb.length)], a = i + dx, b = j + dy;
    seen[b * M + a] = 1; kind[at(i * 2 + 1 + dx, j * 2 + 1 + dy)] = OPEN; kind[at(a * 2 + 1, b * 2 + 1)] = OPEN;
    stack.push([a, b]);
  }
  // ---- knock through some dead ends so it loops (a labyrinth to wander, not a puzzle to solve)
  for (let y = 1; y < N - 1; y += 2) for (let x = 1; x < N - 1; x += 2) {
    const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => kind[at(x + dx, y + dy)] === WALL && inside(x + dx * 2, y + dy * 2));
    if (walls.length === 3 && rng() < 0.55) { const [dx, dy] = walls[ri(3)]; kind[at(x + dx, y + dy)] = OPEN; }
  }

  // ---- rooms laid over the maze
  const rooms = [], types = [];
  for (const [t, n] of Object.entries(D.rooms)) for (let k = 0; k < n; k++) types.push(t);
  for (const type of types) {
    for (let tries = 0; tries < 40; tries++) {
      const w = 3 + 2 * ri(type === 'court' || type === 'garden' ? 3 : 2) + (type === 'hall' || type === 'pool' ? 2 : 0), h = 3 + 2 * ri(2) + (type === 'hall' || type === 'pool' ? 2 : 0);
      const x0 = 1 + 2 * ri((N - 1 - w) / 2), y0 = 1 + 2 * ri((N - 1 - h) / 2);
      if (x0 + w > N - 1 || y0 + h > N - 1) continue;
      if (rooms.some((r) => x0 < r.x1 + 3 && x0 + w > r.x0 - 3 && y0 < r.y1 + 3 && y0 + h > r.y0 - 3)) continue;
      rooms.push({ type, x0, y0, x1: x0 + w, y1: y0 + h, cx: x0 + (w - 1) / 2, cy: y0 + (h - 1) / 2, w, h });
      break;
    }
  }
  rooms.forEach((r, k) => { for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) { kind[at(x, y)] = OPEN; roomOf[at(x, y)] = k; } });

  // ---- floors: rolling ground in steps of an eighth (Doom's stairs), rooms level
  const q = (v) => Math.round(v * 8) / 8;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) fl[at(x, y)] = q((fbm(x / 9, y / 9, 300) - 0.5) * 2.6 * D.hills);
  for (const r of rooms) { const h = fl[at(Math.round(r.cx), Math.round(r.cy))]; for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) fl[at(x, y)] = h; }
  // no step taller than a quarter between cells you can walk between
  for (let pass = 0; pass < 12; pass++) for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = at(x, y); if (kind[i] === WALL) continue;
    for (const j of [i + 1, i + N]) {
      if (kind[j] === WALL) continue;
      const d = fl[j] - fl[i];
      if (d > 0.25) { if (roomOf[j] < 0) fl[j] = fl[i] + 0.25; else fl[i] = fl[j] - 0.25; }
      else if (d < -0.25) { if (roomOf[i] < 0) fl[i] = fl[j] + 0.25; else fl[j] = fl[i] - 0.25; }
    }
  }

  // ---- open sky, ceilings, light
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = at(x, y), r = roomOf[i] >= 0 ? rooms[roomOf[i]] : null;
    const reg = fbm(x / 7, y / 7, 310);
    sky[i] = r ? (r.type === 'hall' ? 0 : 1) : (reg < 0.3 + D.skyCorr * 0.42 ? 1 : 0);
    const roofed = !sky[i];
    ce[i] = fl[i] + (r && r.type === 'hall' ? D.hallH : roofed ? D.corrH + (noise.hash(x, y, 311) < 0.2 ? 0.25 : 0) : D.wallH + (r ? 0.25 : 0));
    ct[i] = r && r.type === 'hall' ? 1 : 0;
    light[i] = sky[i] ? D.moonLight * (0.88 + 0.12 * noise.hash(x, y, 312)) : D.light * (0.7 + 0.6 * fbm(x / 4, y / 4, 313)) * (r ? 1.1 : 1);
    ft[i] = r ? (r.type === 'garden' || r.type === 'hall' ? 1 : 0) : (fbm(x / 5, y / 5, 314) > 0.62 ? 1 : 0);
  }
  // pools: the middle of a pool room sinks into still water; the temple has shallow channels too
  for (const r of rooms) if (r.type === 'pool') {
    const b = r.w >= 5 && r.h >= 5 ? 1 : 0;
    for (let y = r.y0 + b; y < r.y1 - b; y++) for (let x = r.x0 + b; x < r.x1 - b; x++) if (b || (x === Math.round(r.cx) && y === Math.round(r.cy))) { const i = at(x, y); water[i] = 2; fl[i] -= 0.375; }
    if (!b) water[at(Math.round(r.cx), Math.round(r.cy))] = 2;
  }
  if (D.water) for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = at(x, y); if (kind[i] !== OPEN || roomOf[i] >= 0) continue;
    if (fbm(x / 6, y / 6, 320) > 0.62 - D.water * 0.15) { water[i] = 1; fl[i] -= 0.0625; }
  }
  // halls get pillars in a grid
  for (const r of rooms) if (r.type === 'hall' && r.w >= 5 && r.h >= 5) for (let y = r.y0 + 1; y < r.y1 - 1; y += 2) for (let x = r.x0 + 1; x < r.x1 - 1; x += 2) { const i = at(x, y); kind[i] = WALL; wt[i] = 200; }

  // ---- doors in the narrow places beside rooms
  const doors = [];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = at(x, y); if (kind[i] !== OPEN || roomOf[i] >= 0 || water[i]) continue;
    const ew = kind[i - 1] !== WALL && kind[i + 1] !== WALL && kind[i - N] === WALL && kind[i + N] === WALL;
    const ns = kind[i - N] !== WALL && kind[i + N] !== WALL && kind[i - 1] === WALL && kind[i + 1] === WALL;
    if (!ew && !ns) continue;
    const nextToRoom = ew ? roomOf[i - 1] >= 0 || roomOf[i + 1] >= 0 : roomOf[i - N] >= 0 || roomOf[i + N] >= 0;
    if (!nextToRoom || rng() > D.doors) continue;
    if (doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) < 3)) continue;
    kind[i] = DOOR; sky[i] = 0;
    const top = Math.min(...[i - 1, i + 1, i - N, i + N].filter((j) => kind[j] !== WALL).map((j) => ce[j]));
    doors.push({ x, y, i, open: 0, top: Math.max(fl[i] + 1, top), timer: 0 });
    ce[i] = fl[i];
  }

  // ---- what each wall is made of
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = at(x, y); if (kind[i] !== WALL || wt[i] === 200) continue;
    wt[i] = Math.min(set.walls.length - 1, Math.floor(fbm(x / 5, y / 5, 330) * set.walls.length * 1.5 - set.walls.length * 0.25 + 0.5) | 0);
    if (wt[i] < 0) wt[i] = 0;
    const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && kind[at(x + dx, y + dy)] !== WALL);
    if (faces && noise.hash(x, y, 331) < 0.06) wt[i] = 100 + ri(set.special.length);
  }

  // ---- things: lanterns, flowers, floating dream-things
  const things = [];
  const lightUp = (x, y, k, flick = false) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!inside(x + dx, y + dy)) continue;
      const j = at(x + dx, y + dy), f = Math.max(0, 1 - Math.hypot(dx, dy) / 2.6);
      light[j] = Math.min(1.25, light[j] + k * f);
      if (flick && f > 0.5) flicker.add(j);
    }
  };
  const flicker = new Set();
  const sz = (T, s = 1) => ({ w: (T.w / 64) * s, h: (T.h / 64) * s });
  const S = set.things;
  // hanging lanterns along roofed corridors
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = at(x, y); if (kind[i] !== OPEN || roomOf[i] >= 0 || sky[i] || water[i] === 2) continue;
    if (noise.hash(x, y, 340) > 0.14 || things.some((t) => t.kind === 'hang' && Math.abs(t.x - x - 0.5) + Math.abs(t.y - y - 0.5) < 4)) continue;
    const s = sz(S.hang);
    things.push({ kind: 'hang', spr: S.hang, x: x + 0.5, y: y + 0.5, z: ce[i] - s.h, ...s, swing: rng() * 6 });
    lightUp(x, y, 0.35, D.id === 'library');
  }
  for (const r of rooms) {
    const free = [];
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) { const i = at(x, y); if (kind[i] === OPEN && !water[i]) free.push([x, y]); }
    const put = (spr, x, y, s = 1, extra = {}) => { const d = sz(spr, s); things.push({ kind: 'decor', spr, x, y, z: fl[at(Math.floor(x), Math.floor(y))], ...d, ...extra }); };
    if (r.type === 'court' || r.type === 'hall') {
      const cx = Math.round(r.cx), cy = Math.round(r.cy), i = at(cx, cy);
      if (kind[i] === OPEN && !water[i]) { put(S.lamp, cx + 0.5, cy + 0.5, 1, { glowy: true }); lightUp(cx, cy, 0.4, D.id === 'library'); }
      else for (const [dx, dy] of [[0, 0], [r.w - 1, 0], [0, r.h - 1], [r.w - 1, r.h - 1]]) { put(S.lamp, r.x0 + dx + 0.5, r.y0 + dy + 0.5, 1, { glowy: true }); lightUp(r.x0 + dx, r.y0 + dy, 0.3); }
    }
    if (r.type === 'pool') for (const [dx, dy] of [[0, 0], [r.w - 1, r.h - 1]]) { put(S.lamp, r.x0 + dx + 0.5, r.y0 + dy + 0.5, 1, { glowy: true }); lightUp(r.x0 + dx, r.y0 + dy, 0.3); }
    if (r.type === 'garden' || r.type === 'court' || r.type === 'pool') for (const [x, y] of free) {
      if (rng() < (r.type === 'garden' ? 0.55 : 0.18)) { const spr = S.decor[ri(S.decor.length)]; put(spr, x + 0.2 + rng() * 0.6, y + 0.2 + rng() * 0.6, 0.8 + rng() * 0.4); }
    }
    // floating things drift about the room
    const nf = r.type === 'garden' ? 2 : r.type === 'pool' ? 3 : 1 + ri(2);
    for (let k = 0; k < nf; k++) {
      const s = sz(S.float[0], D.id === 'library' ? 1 : S.floatCol === 'koi' ? 0.85 : 1.35);
      things.push({ kind: 'float', spr: S.float[0], frames: S.float, x: r.cx + 0.5, y: r.cy + 0.5, z: fl[at(Math.round(r.cx), Math.round(r.cy))] + 0.6, ...s, home: [r.cx + 0.5, r.cy + 0.5], rx: Math.max(0.6, (r.w - 1.6) / 2), ry: Math.max(0.6, (r.h - 1.6) / 2), ph: rng() * 6.28, sp: 0.05 + rng() * 0.05, base: fl[at(Math.round(r.cx), Math.round(r.cy))], add: D.things?.addFloat });
    }
  }
  // a few lone flowers or crystals along open-air corridors
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = at(x, y); if (kind[i] !== OPEN || roomOf[i] >= 0 || !sky[i] || water[i]) continue;
    if (noise.hash(x, y, 350) < 0.08) { const spr = S.decor[ri(S.decor.length)]; const d = sz(spr, 0.7); things.push({ kind: 'decor', spr, x: x + 0.5 + (rng() - 0.5) * 0.5, y: y + 0.5 + (rng() - 0.5) * 0.5, z: fl[i], ...d }); }
  }

  // ---- where the dreamer starts: a room, or failing that any open cell
  let start = null;
  const walk = (i) => kind[i] !== WALL && water[i] !== 2;
  for (const r of rooms) { for (let y = r.y0; y < r.y1 && !start; y++) for (let x = r.x0; x < r.x1; x++) if (walk(at(x, y)) && kind[at(x, y)] === OPEN) { start = [x, y]; break; } if (start) break; }
  if (!start) for (let i = 0; i < NN; i++) if (kind[i] === OPEN) { start = [i % N, Math.floor(i / N)]; break; }

  return { N, kind, fl, ce, sky, water, light, wt, ft, ct, roomOf, rooms, doors, things, flicker: [...flicker], start, walk, at };
}

/** Breadth-first distances (in cells) from a cell, through anywhere the dreamer can walk. */
export function distances(m, from) {
  const d = new Int32Array(m.N * m.N).fill(-1), qq = [from];
  d[from] = 0;
  for (let h = 0; h < qq.length; h++) {
    const i = qq[h];
    for (const j of [i + 1, i - 1, i + m.N, i - m.N]) if (d[j] < 0 && m.walk(j)) { d[j] = d[i] + 1; qq.push(j); }
  }
  return d;
}
/** The way from a cell to another, back along the distances. */
export function route(m, d, to) {
  if (d[to] < 0) return null;
  const path = [to];
  let i = to;
  while (d[i] > 0) { const n = [i + 1, i - 1, i + m.N, i - m.N].find((j) => d[j] === d[i] - 1); path.push(n); i = n; }
  return path.reverse();
}
