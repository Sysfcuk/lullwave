// Lost in Thought: the labyrinth itself, made fresh for each dream. A grid of cells, like an old
// first-person maze game, but each cell is a Doom "sector" of its own: its own floor height (so the
// corridors climb and fall in little flights of steps), its own ceiling height or open sky, its own
// light, water in it or not. A maze is carved (a depth-first walk, then some dead ends knocked
// through so it loops), rooms are laid over it (courtyards open to the stars, gardens, halls of
// pillars, pools, walkways over a sea of stars), doors put in the narrow places, grilles and
// lattices where a wall is thin enough to see through, and lanterns, flowers and creatures set about.
//
// And some of it is impossible. Below the maze runs a band of corridors joined end to end by
// portals: walk off the top of the stair and you're back at its foot, a storey higher, so it
// climbs for ever and lets you out where you came in; walk to the end of the long gallery and
// you're back at its start, so it never ends. The renderer follows its rays through the portals
// the same way, so you can see the stair rising out of sight and the gallery going on and on.

export const OPEN = 0, WALL = 1, DOOR = 2, GRATE = 3, PORTAL = 4;

export function buildMaze(rng, D, set, noise) {
  const M = 17, N = 2 * M + 1, NY = N + 2, NN = N * NY;
  const kind = new Uint8Array(NN).fill(WALL), fl = new Float32Array(NN), ce = new Float32Array(NN);
  const sky = new Uint8Array(NN), water = new Uint8Array(NN), voidc = new Uint8Array(NN), light = new Float32Array(NN), wt = new Uint16Array(NN), ft = new Uint8Array(NN), ct = new Uint8Array(NN), roomOf = new Int16Array(NN).fill(-1);
  const pTo = new Int32Array(NN).fill(-1), pDX = new Int16Array(NN), pDZ = new Float32Array(NN);
  const at = (x, y) => y * N + x;
  const inside = (x, y) => x > 0 && y > 0 && x < N - 1 && y < NY - 1;
  const ri = (n) => Math.floor(rng() * n);
  const fbm = (x, y, s) => noise.fbm(x, y, 64, 3, s);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // ---- the maze: a depth-first walk over the odd cells
  const seen = new Uint8Array(M * M), stack = [[ri(M), ri(M)]];
  seen[stack[0][1] * M + stack[0][0]] = 1; kind[at(stack[0][0] * 2 + 1, stack[0][1] * 2 + 1)] = OPEN;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const nb = DIRS.filter(([dx, dy]) => { const a = i + dx, b = j + dy; return a >= 0 && b >= 0 && a < M && b < M && !seen[b * M + a]; });
    if (!nb.length) { stack.pop(); continue; }
    const [dx, dy] = nb[ri(nb.length)], a = i + dx, b = j + dy;
    seen[b * M + a] = 1; kind[at(i * 2 + 1 + dx, j * 2 + 1 + dy)] = OPEN; kind[at(a * 2 + 1, b * 2 + 1)] = OPEN;
    stack.push([a, b]);
  }
  // ---- knock through some dead ends so it loops (a labyrinth to wander, not a puzzle to solve)
  for (let y = 1; y < N - 1; y += 2) for (let x = 1; x < N - 1; x += 2) {
    const walls = DIRS.filter(([dx, dy]) => kind[at(x + dx, y + dy)] === WALL && x + dx * 2 > 0 && y + dy * 2 > 0 && x + dx * 2 < N - 1 && y + dy * 2 < N - 1);
    if (walls.length === 3 && rng() < 0.55) { const [dx, dy] = walls[ri(3)]; kind[at(x + dx, y + dy)] = OPEN; }
  }

  // ---- rooms laid over the maze
  const rooms = [], types = [];
  for (const [t, n] of Object.entries(D.rooms)) for (let k = 0; k < n; k++) types.push(t);
  for (const type of types) {
    const big = type === 'hall' || type === 'pool' || type === 'void';
    for (let tries = 0; tries < 40; tries++) {
      const w = 3 + 2 * ri(type === 'court' || type === 'garden' ? 3 : 2) + (big ? 2 : 0), h = 3 + 2 * ri(2) + (big ? 2 : 0);
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
      if (kind[j] === WALL || j >= at(0, N - 1)) continue;
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
    ft[i] = D.skyFloor != null && sky[i] ? D.skyFloor : r ? (r.type === 'garden' || r.type === 'hall' ? 1 : 0) : (fbm(x / 5, y / 5, 314) > 0.62 ? 1 : 0);
  }
  // pools: the middle of a pool room sinks into still water; the temple has shallow channels too
  for (const r of rooms) if (r.type === 'pool') {
    const b = r.w >= 5 && r.h >= 5 ? 1 : 0;
    for (let y = r.y0 + b; y < r.y1 - b; y++) for (let x = r.x0 + b; x < r.x1 - b; x++) if (b || (x === Math.round(r.cx) && y === Math.round(r.cy))) { const i = at(x, y); water[i] = 2; fl[i] -= 0.375; }
  }
  if (D.water) for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = at(x, y); if (kind[i] !== OPEN || roomOf[i] >= 0) continue;
    if (fbm(x / 6, y / 6, 320) > 0.62 - D.water * 0.15) { water[i] = 1; fl[i] -= 0.0625; }
  }
  // walkways over the void: a narrow path winds across a room whose floor has fallen away into the stars
  for (const r of rooms) if (r.type === 'void') {
    const inRoom = (x, y) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
    const ents = [];
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) for (const [dx, dy] of DIRS) if (!inRoom(x + dx, y + dy) && y + dy < N - 1 && kind[at(x + dx, y + dy)] !== WALL) ents.push([x, y]);
    if (!ents.length) continue;
    const path = new Set([at(...ents[0])]);
    const link = (x, y) => { // a wandering line from (x, y) to the nearest walkway cell
      let best = null, bd = 1e9;
      for (const i of path) { const d = Math.abs((i % N) - x) + Math.abs(Math.floor(i / N) - y); if (d < bd) { bd = d; best = i; } }
      const tx = best % N, ty = Math.floor(best / N);
      while (x !== tx || y !== ty) {
        path.add(at(x, y));
        if (x !== tx && (y === ty || rng() < 0.5)) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      }
    };
    for (const [x, y] of ents.slice(1)) link(x, y);
    if (ents.length === 1) link(r.x0 + ri(r.w), r.y0 + ri(r.h));
    if (path.size < 4) link(Math.round(r.cx), Math.round(r.cy));
    r.walkway = path;
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) { const i = at(x, y); if (!path.has(i)) { voidc[i] = 1; fl[i] -= 0.22; } light[i] = D.moonLight; }
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

  // ---- grilles: where one thin wall stands between a corridor and a room, you can see through it
  let grates = 0;
  for (let y = 2; y < N - 2 && grates < 6; y++) for (let x = 2; x < N - 2 && grates < 6; x++) {
    const i = at(x, y); if (kind[i] !== WALL || wt[i] === 200 || noise.hash(x, y, 360) > 0.35) continue;
    for (const [a, b, c, d] of [[i - 1, i + 1, i - N, i + N], [i - N, i + N, i - 1, i + 1]]) {
      if (kind[i] !== WALL) break;
      if (kind[a] !== OPEN || kind[b] !== OPEN || kind[c] !== WALL || kind[d] !== WALL) continue;
      if ((roomOf[a] >= 0) === (roomOf[b] >= 0) || voidc[a] || voidc[b] || water[a] || water[b]) continue;
      kind[i] = GRATE; fl[i] = Math.max(fl[a], fl[b]) + 0.0625; ce[i] = Math.min(ce[a], ce[b], fl[i] + 1.1); sky[i] = 0; light[i] = Math.max(light[a], light[b]);
      grates++;
    }
  }

  // ---- the impossible corridors, in a band below the maze
  const loops = [];
  const band = N; // the row the corridors run along; the maze's last wall row above, the border below
  const stairX0 = 3 + 2 * ri(3), galleryX0 = stairX0 + 11 + 2 * ri(3);
  for (const [x0, L, rise] of [[stairX0, 8, 0.125], [galleryX0, 6, 0]]) {
    const mid = x0 + (L >> 1), above = at(mid, N - 2);
    if (kind[above] === WALL || water[above] === 2 || voidc[above]) continue;
    const base = fl[above], door = at(mid, N - 1);
    kind[door] = OPEN; fl[door] = base; ce[door] = base + D.corrH; sky[door] = 0; light[door] = D.light;
    for (let x = x0; x < x0 + L; x++) {
      const i = at(x, band);
      kind[i] = OPEN; fl[i] = base + (x - mid) * rise; ce[i] = fl[i] + D.corrH + 0.25; sky[i] = 0; light[i] = D.light * 1.05; ft[i] = 0;
    }
    const after = at(x0 + L, band), before = at(x0 - 1, band);
    kind[after] = PORTAL; pTo[after] = at(x0, band); pDX[after] = -L; pDZ[after] = rise * L;
    kind[before] = PORTAL; pTo[before] = at(x0 + L - 1, band); pDX[before] = L; pDZ[before] = -rise * L;
    loops.push({ x0, L, rise, mid: at(mid, band), door, y: band, kind: rise ? 'stair' : 'gallery' });
  }

  // ---- what each wall is made of
  const windowK = set.specialLight ? set.specialLight.findIndex((c) => c) : -1;
  for (let y = 0; y < NY; y++) for (let x = 0; x < N; x++) {
    const i = at(x, y); if (kind[i] !== WALL || wt[i] === 200) continue;
    wt[i] = Math.min(set.walls.length - 1, Math.floor(fbm(x / 5, y / 5, 330) * set.walls.length * 1.5 - set.walls.length * 0.25 + 0.5) | 0);
    if (wt[i] < 0) wt[i] = 0;
    const faces = DIRS.some(([dx, dy]) => inside(x + dx, y + dy) && kind[at(x + dx, y + dy)] !== WALL);
    if (faces && noise.hash(x, y, 331) < 0.06) wt[i] = 100 + ri(set.special.length);
    else if (faces && D.paintings && y < N - 1 && noise.hash(x, y, 332) < 0.07) wt[i] = 300 + ri(64);
  }
  // the gallery's walls are hung with paintings (or windows), so you can watch them go by for ever
  for (const lp of loops) for (let x = lp.x0; x < lp.x0 + lp.L; x++) for (const y of [band - 1, band + 1]) {
    const i = at(x, y); if (kind[i] !== WALL) continue;
    if (lp.kind === 'gallery') wt[i] = (x + y) % 2 ? (D.paintings ? 300 + ((x * 7 + y) % 64) : windowK >= 0 ? 100 + windowK : wt[i]) : wt[i];
  }

  // ---- things and lights: lanterns, flowers, floating dream-things, creatures
  const things = [], lights = [];
  const flicker = new Set();
  const lightUp = (x, y, k, flick = false) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!inside(x + dx, y + dy)) continue;
      const j = at(x + dx, y + dy), f = Math.max(0, 1 - Math.hypot(dx, dy) / 2.6);
      light[j] = Math.min(1.2, light[j] + k * f);
      if (flick && f > 0.5) flicker.add(j);
    }
  };
  const sz = (T, s = 1) => ({ w: (T.w / 64) * s, h: (T.h / 64) * s });
  const S = set.things;
  const hang = (x, y, loop = -1, oy = 0) => {
    const i = at(x, y), s = sz(S.hang);
    things.push({ kind: 'hang', spr: S.hang, x: x + 0.5, y: y + 0.5 + oy, z: ce[i] - s.h, ...s, swing: rng() * 6, loop });
    lights.push({ x: x + 0.5, y: y + 0.5 + oy, z: ce[i] - 0.4, col: D.hangCol, r: 2.3, i: 0.38, flick: true, loop });
    lightUp(x, y, 0.2, D.id === 'library');
  };
  // hanging lanterns along roofed corridors
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = at(x, y); if (kind[i] !== OPEN || roomOf[i] >= 0 || sky[i] || water[i] === 2) continue;
    if (noise.hash(x, y, 340) > 0.14 || things.some((t) => t.kind === 'hang' && Math.abs(t.x - x - 0.5) + Math.abs(t.y - y - 0.5) < 4)) continue;
    hang(x, y);
  }
  loops.forEach((lp, k) => { for (let x = lp.x0; x < lp.x0 + lp.L; x += 2) hang(x, band, k, (x - lp.x0) % 4 ? 0.36 : -0.36); }); // to the sides, so you walk between them
  for (const r of rooms) {
    const free = [];
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) { const i = at(x, y); if (kind[i] === OPEN && !water[i] && !voidc[i]) free.push([x, y]); }
    const put = (spr, x, y, s = 1, extra = {}) => { const d = sz(spr, s); things.push({ kind: 'decor', spr, x, y, z: fl[at(Math.floor(x), Math.floor(y))], ...d, ...extra }); };
    const lamp = (x, y) => { put(S.lamp, x + 0.5, y + 0.5, 1, { glowy: true }); lights.push({ x: x + 0.5, y: y + 0.5, z: fl[at(x, y)] + 0.55, col: D.lampCol, r: 2.6, i: 0.42, flick: D.id === 'library' || D.id === 'abbey' }); lightUp(x, y, 0.25, D.id === 'library'); };
    if (r.type === 'court' || r.type === 'hall') {
      const cx = Math.round(r.cx), cy = Math.round(r.cy), i = at(cx, cy);
      if (kind[i] === OPEN && !water[i]) lamp(cx, cy);
      else for (const [dx, dy] of [[0, 0], [r.w - 1, 0], [0, r.h - 1], [r.w - 1, r.h - 1]]) lamp(r.x0 + dx, r.y0 + dy);
    }
    if (r.type === 'pool') for (const [dx, dy] of [[0, 0], [r.w - 1, r.h - 1]]) lamp(r.x0 + dx, r.y0 + dy);
    if (r.type === 'void' && r.walkway) { const cells = [...r.walkway]; for (let k = 0; k < Math.min(3, cells.length); k++) { const i = cells[Math.floor((k + 0.5) * cells.length / 3)]; lamp(i % N, Math.floor(i / N)); } }
    if (r.type === 'garden' || r.type === 'court' || r.type === 'pool') for (const [x, y] of free) {
      if (rng() < (r.type === 'garden' ? 0.55 : 0.18)) { const spr = S.decor[ri(S.decor.length)]; put(spr, x + 0.2 + rng() * 0.6, y + 0.2 + rng() * 0.6, 0.8 + rng() * 0.4); }
    }
    // floating things drift about the room
    const nf = r.type === 'garden' ? 2 : r.type === 'pool' || r.type === 'void' ? 3 : 1 + ri(2);
    for (let k = 0; k < nf; k++) {
      const s = sz(S.float[0], S.floatScale ?? 1);
      things.push({ kind: 'float', spr: S.float[0], frames: S.float, x: r.cx + 0.5, y: r.cy + 0.5, z: fl[at(Math.round(r.cx), Math.round(r.cy))] + 0.6, ...s, home: [r.cx + 0.5, r.cy + 0.5], rx: Math.max(0.6, (r.w - 1.6) / 2), ry: Math.max(0.6, (r.h - 1.6) / 2), ph: rng() * 6.28, sp: 0.05 + rng() * 0.05, base: fl[at(Math.round(r.cx), Math.round(r.cy))] + (r.type === 'void' ? 0.3 : 0) });
    }
  }
  // stained glass and glowing walls throw coloured light into the cell in front of them
  for (let y = 1; y < NY - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = at(x, y), w = wt[i]; if (kind[i] !== WALL || w < 100 || w >= 200) continue;
    const col = set.specialLight?.[w - 100]; if (!col) continue;
    for (const [dx, dy] of DIRS) {
      const j = at(x + dx, y + dy); if (!inside(x + dx, y + dy) || kind[j] !== OPEN) continue;
      lights.push({ x: x + 0.5 + dx * 0.95, y: y + 0.5 + dy * 0.95, z: fl[j] + 0.5, col, r: 1.7, i: 0.4 });
    }
  }
  // a few lone flowers or crystals along open-air corridors
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = at(x, y); if (kind[i] !== OPEN || roomOf[i] >= 0 || !sky[i] || water[i]) continue;
    if (noise.hash(x, y, 350) < 0.08) { const spr = S.decor[ri(S.decor.length)]; const d = sz(spr, 0.7); things.push({ kind: 'decor', spr, x: x + 0.5 + (rng() - 0.5) * 0.5, y: y + 0.5 + (rng() - 0.5) * 0.5, z: fl[i], ...d }); }
  }
  // owls on the wall tops round the courtyards; a cat asleep somewhere warm
  if (S.owl) {
    let owls = 0;
    for (const r of rooms) if (r.type !== 'hall' && owls < 4) for (let tries = 0; tries < 6 && owls < 4; tries++) {
      const side = ri(4), x = side < 2 ? r.x0 + ri(r.w) : side === 2 ? r.x0 - 1 : r.x1, y = side < 2 ? (side ? r.y0 - 1 : r.y1) : r.y0 + ri(r.h);
      const i = at(x, y); if (!inside(x, y) || kind[i] !== WALL) continue;
      const inner = at(Math.max(r.x0, Math.min(r.x1 - 1, x)), Math.max(r.y0, Math.min(r.y1 - 1, y)));
      const s = sz(S.owl[0], 0.9);
      things.push({ kind: 'owl', spr: S.owl[0], frames: S.owl, x: x + 0.5, y: y + 0.5, z: ce[inner], ...s, ph: rng() * 20 });
      owls++; break;
    }
  }
  if (S.cat) {
    const cand = rooms.filter((r) => r.type === 'hall' || r.type === 'court');
    for (const r of cand) {
      const x = r.x0, y = r.y0 + ri(r.h), i = at(x, y);
      if (kind[i] !== OPEN || water[i] || voidc[i]) continue;
      const s = sz(S.cat[0], 0.8);
      things.push({ kind: 'cat', spr: S.cat[0], frames: S.cat, x: x + 0.3, y: y + 0.5, z: fl[i], ...s, ph: rng() * 6 });
      break;
    }
  }

  // ---- walls that can quietly move while nobody's looking
  const shift = [];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    if ((x + y) % 2 === 0) continue;
    const i = at(x, y); if (roomOf[i] >= 0 || (kind[i] !== WALL && kind[i] !== OPEN) || wt[i] >= 100) continue;
    const ew = (x % 2 === 0), a = ew ? i - 1 : i - N, b = ew ? i + 1 : i + N, c = ew ? i - N : i - 1, d = ew ? i + N : i + 1;
    if (kind[a] !== OPEN || kind[b] !== OPEN || kind[c] !== WALL || kind[d] !== WALL || voidc[a] || voidc[b] || water[a] === 2 || water[b] === 2) continue;
    if (things.some((t) => Math.floor(t.x) === x && Math.floor(t.y) === y)) continue;
    shift.push(i);
  }

  // ---- where the dreamer starts: a room, or failing that any open cell
  const walk = (i) => (kind[i] === OPEN || kind[i] === DOOR) && water[i] !== 2 && !voidc[i];
  let start = null;
  for (const r of rooms) { for (let y = r.y0; y < r.y1 && !start; y++) for (let x = r.x0; x < r.x1; x++) if (walk(at(x, y)) && kind[at(x, y)] === OPEN) { start = [x, y]; break; } if (start) break; }
  if (!start) for (let i = 0; i < NN; i++) if (kind[i] === OPEN) { start = [i % N, Math.floor(i / N)]; break; }
  // and where a deer of light might be wandering
  const open = []; for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) if (walk(at(x, y)) && sky[at(x, y)]) open.push(at(x, y));
  const deerStart = open.length ? open[ri(open.length)] : null;

  return { N, NY, NN, kind, fl, ce, sky, water, voidc, light, wt, ft, ct, roomOf, rooms, doors, things, lights, flicker: [...flicker], start, walk, at, pTo, pDX, pDZ, loops, shift, deerStart };
}

/** Breadth-first distances (in cells) from a cell, through anywhere the dreamer can walk. */
export function distances(m, from) {
  const d = new Int32Array(m.NN).fill(-1), qq = [from];
  d[from] = 0;
  for (let h = 0; h < qq.length; h++) {
    const i = qq[h];
    for (const j of [i + 1, i - 1, i + m.N, i - m.N]) if (j >= 0 && j < m.NN && d[j] < 0 && m.walk(j)) { d[j] = d[i] + 1; qq.push(j); }
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
