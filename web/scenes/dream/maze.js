// Lost in Thought: a sleepwalk through a labyrinth of dreams, drawn the way Doom drew its worlds.
// No polygons: a software renderer casts one ray per column of a small pixel buffer through a grid
// of "sectors", each with its own floor and ceiling height, and fills the column front to back,
// ceiling and floor spans first, then the steps and lintels where heights change, then the wall
// that ends the ray, clipping as it goes (Doom's floorclip and ceilingclip). Floors and ceilings are
// perspective-mapped flats; where a sector has no roof, the sky shows through, fixed to the view's
// turn the way Doom's was. Light falls off with distance in banded steps, walls facing one way are a
// shade lighter than the other ("fake contrast"), lit sectors flicker, things are billboards
// clipped against what's in front, the view bobs as you walk and eases up and down stairs, the
// lantern in your hand sways like a Doom weapon, doors slide up as you reach them, and when the
// dream changes the screen melts away, column by column, into the next one.
//
// Then the things Doom couldn't do, or did later. Grilles, lattices and gates you can see through
// (masked textures, drawn back to front over the column once it's done). Pools that really
// reflect: each column with water in it is cast a second time from an eye mirrored under the
// surface, and the water shows that, rippling. Walkways over a sea of stars. Coloured light from
// every lantern, crystal and stained-glass window, lighting only what it can reach. Portals: rays
// (and the dreamer) that walk off the top of a stair come back in at its foot a storey higher, so
// it climbs for ever, and a gallery that never ends. Walls that quietly move when you're not
// looking. Weather (petals, rain with rings on the pools, snow), a whale that swims across the sky
// when the music sings it, a deer of light, owls on the walls, a cat asleep by the candles, and
// paintings of the other worlds hung in the galleries.
//
// Everything is made in code (maze-tex.js, maze-map.js). A will-o'-the-wisp leads the way. In the
// courtyards the dreamer stops to look up at the moon. Late in the night the walking slows, and at
// last they sit down under the sky, put the lantern away, and the night's wandering is drawn
// across the stars as a constellation.
import { createStage, THREE } from '../kit.js';
import { DREAMS, noiser, makeSky, makeClouds, heldLantern, loadPaintings, deerSide, deerFront, whale as whaleSprite, TS, SKY_W, SKY_H, EL0, EL1, CL_W, CL_H, CL_EL1, hx } from './maze-tex.js';
import { buildMaze, distances, route, OPEN, WALL, DOOR, GRATE, PORTAL } from './maze-map.js';

const TAU = Math.PI * 2;
const MAXD = 34, EYE = 0.56, NL = 6;
const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const c8 = (v) => (v > 255 ? 255 : v < 0 ? 0 : v | 0);

export function createMazeScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xd0e, bg: '#000000', exposure: 1, bloom: [0.6, 0.42, 0.6], finish: { vignette: 0.3, grain: 0.012, ca: 0.2 }, fov: 50 });
  const { rand } = S;

  // ---------------------------------------------------------------- the pixel buffer, shown full screen
  let W = 0, H = 0, buf = null, depth = null, refl = null, old = null, tex = null, f = 1, hz = 0, mcol = null, mdep = null;
  let colRX, colRY, colU, colAz, rowInv, rowSkyV, rowMirV, rowCloudV, rowEl, melt = null;
  const quad = new THREE.Mesh(S.keep(new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, depthWrite: false }));
  quad.position.z = -1; quad.renderOrder = 10; S.camera.add(quad);
  function resize() {
    const a = S.camera.aspect || 1;
    let w, h;
    if (a >= 1) { h = mobile ? 200 : 240; w = Math.round(h * a); } else { w = mobile ? 200 : 216; h = Math.round(w / a); }
    if (w === W && h === H) return;
    W = w; H = h;
    f = a >= 1 ? (H / 2) / Math.tan(0.62) : (W / 2) / Math.tan(0.68);
    buf = new Uint32Array(W * H); depth = new Float32Array(W * H); refl = new Uint8Array(W * H); old = null; melt = null;
    mcol = new Uint32Array(H); mdep = new Float32Array(H);
    colRX = new Float32Array(W); colRY = new Float32Array(W); colU = new Int32Array(W); colAz = new Float32Array(W);
    rowInv = new Float32Array(H); rowSkyV = new Int32Array(H); rowMirV = new Int32Array(H); rowCloudV = new Int32Array(H); rowEl = new Float32Array(H);
    if (tex) tex.dispose();
    tex = new THREE.DataTexture(new Uint8Array(buf.buffer), W, H, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1, -1); tex.offset.set(0, 1); // the buffer runs top to bottom
    quad.material.map = tex; quad.material.needsUpdate = true;
    titleMask = null;
  }
  S.keep({ dispose: () => tex && tex.dispose() });

  // paintings of the other worlds, when they've loaded
  let paints = null, gone = false;
  loadPaintings().then((p) => { if (!gone) paints = p.length ? p : null; });
  S.keep({ dispose: () => { gone = true; } });
  const deerS = [deerSide(0), deerSide(1)], deerF = deerFront(), whaleT = whaleSprite();

  // ---------------------------------------------------------------- the dream: its textures, sky and labyrinth
  const built = new Map();
  let D, set, SKY, CLOUD, map, N, NY, KIND, FL, CE, SKYC, WATER, VOID, LIGHT, LIGHTE, WT, FT, CT, PTO, PDX, PDZ, LMASK;
  let FR = 0, FG = 0, FB = 0, FOGC = 0, T0 = 1, T1 = 1, T2 = 1, moonAz = 0, moonEl = 0.6, dreamK = -1, dreamNo = 0;
  let stars = [], cloudCol = [0, 0, 0], trace = [], deer = null, weather = [], constellation = null;
  function buildDream(k) {
    D = DREAMS[k]; dreamK = k; dreamNo++;
    if (!built.has(D.id)) {
      const n = noiser((seed * 2654435761 + k * 977) >>> 0);
      built.set(D.id, { set: D.build(n), sky: makeSky(n, D.sky), clouds: makeClouds(n, D.sky.clouds) });
    }
    ({ set, sky: SKY, clouds: CLOUD } = built.get(D.id));
    const mapNoise = noiser((seed * 31 + dreamNo * 7919) >>> 0);
    map = buildMaze(rand, D, set, mapNoise);
    ({ N, NY, kind: KIND, fl: FL, ce: CE, sky: SKYC, water: WATER, voidc: VOID, light: LIGHT, wt: WT, ft: FT, ct: CT, pTo: PTO, pDX: PDX, pDZ: PDZ } = map);
    LIGHTE = LIGHT.slice(); LMASK = new Uint8Array(map.NN);
    [FR, FG, FB] = hx(D.fog); FOGC = (255 << 24) | (FB << 16) | (FG << 8) | FR;
    [T0, T1, T2] = D.tint;
    [moonAz, moonEl] = D.sky.moon;
    cloudCol = [FR * 1.6 + 20, FG * 1.6 + 20, FB * 1.6 + 30];
    stars = [];
    for (let i = 0; i < 700; i++) {
      const tw = rand() < 0.3, b = 0.22 + Math.pow(rand(), 5) * 1.1, tint = rand(), az = rand() * TAU, el = Math.asin(0.04 + 0.95 * rand());
      const cm = Math.sin(el) * Math.sin(moonEl) + Math.cos(el) * Math.cos(moonEl) * Math.cos(az - moonAz);
      if (Math.acos(Math.min(1, cm)) < D.sky.moonRad * 1.6) continue; // none in front of the moon
      stars.push({ az, el, ph: rand() * TAU, sp: tw ? 0.6 + rand() * 2.2 : 0, b: tw ? b + 0.25 : b, col: tint < 0.18 ? [255, 214, 176] : tint > 0.85 ? [186, 204, 255] : [240, 240, 255] });
    }
    motes = [];
    for (let i = 0; i < D.motes.n; i++) motes.push({ x: 0, y: 0, z: 0, ph: rand() * TAU, sp: 0.2 + rand() * 0.4, fresh: true });
    // weather: petals in the garden, rain when it showers, snow at the abbey
    weather = [];
    const nW = D.weather ? (D.weather.snow ? 170 : D.weather.showers ? 240 : 0) + (D.weather.petals ? 50 : 0) : 0;
    for (let i = 0; i < nW; i++) weather.push({ x: 0, y: 0, z: -99, ph: rand() * TAU, kind: D.weather.petals && i < 50 ? 'petal' : D.weather.snow ? 'snow' : 'rain', col: rand() < 0.5 ? [255, 214, 232] : [255, 246, 250] });
    rainAmt = 0; rainTarget = 0; rainUntil = 0;
    // a deer of light, wandering
    deer = D.deer && map.deerStart != null ? { cell: map.deerStart, x: (map.deerStart % N) + 0.5, y: Math.floor(map.deerStart / N) + 0.5, to: map.deerStart, from: -1, hd: 0, ph: 0, pause: 0 } : null;
    // the dreamer arrives
    const [sx, sy] = map.start;
    px = sx + 0.5; py = sy + 0.5; eyeZ = FL[map.at(sx, sy)] + EYE;
    walk.path = null; walk.state = 'walk'; walk.wait = 0; walk.recent = []; walk.loop = null; walk.loopsDone = 0;
    planRoute(false);
    if (walk.path) { const p = pointAt(0.8); camA = Math.atan2(p[1] - py, p[0] - px); }
    wisp.x = px + Math.cos(camA) * 1.5; wisp.y = py + Math.sin(camA) * 1.5; wisp.z = eyeZ;
    titleAt = clock; titleMask = null;
    trace = [[px, py]]; constellation = null; shiftDue = 20;
  }

  // ---------------------------------------------------------------- the walk
  let px = 0, py = 0, camA = 0, pitch = 0, eyeZ = 0.5, bobPh = 0, speed = 0, clock = 0, energy = 1, resting = 0, restAt = 0;
  const walk = { path: null, cum: null, s: 0, state: 'walk', wait: 0, recent: [], room: -1, cells: new Set(), loop: null, loopsDone: 0 };
  const wisp = { x: 0, y: 0, z: 0, pulse: 0 };
  const cellAt = (x, y) => Math.floor(y) * N + Math.floor(x);
  function planRoute(preferSky) {
    const from = cellAt(px, py), d = distances(map, from);
    let best = null, bs = -1e9;
    map.rooms.forEach((r, k) => {
      if (walk.recent.includes(k)) return;
      const cells = [];
      for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) { const i = y * N + x; if (d[i] > 0 && KIND[i] === OPEN && map.walk(i)) cells.push(i); }
      if (!cells.length) return;
      const i = cells[Math.floor(rand() * cells.length)];
      const sc = -Math.abs(d[i] - 18) + rand() * 12 + (preferSky && SKYC[i] ? 60 - d[i] * 0.5 + r.w * r.h * 1.2 - (r.type === 'void' ? 30 : 0) : 0) + (r.type === 'void' ? 6 : 0); // to rest: the widest open sky
      if (sc > bs) { bs = sc; best = { i, k }; }
    });
    // now and then, the impossible corridors
    if (!preferSky && map.loops.length && rand() < 0.3) {
      const lp = map.loops[Math.floor(rand() * map.loops.length)];
      if (d[lp.mid] > 0 && !walk.recent.includes('loop' + lp.mid)) best = { i: lp.mid, k: 'loop' + lp.mid, loop: lp };
    }
    if (!best) { // nowhere new: anywhere a good way off
      const far = []; for (let i = 0; i < d.length; i++) if (d[i] > 6) far.push(i);
      if (!far.length) { walk.path = null; return; }
      best = { i: far[Math.floor(rand() * far.length)], k: -1 };
    }
    const cells = route(map, d, best.i);
    if (!cells || cells.length < 2) { walk.path = null; return; }
    let pts = [[px, py], ...cells.slice(1).map((i) => [(i % N) + 0.5, Math.floor(i / N) + 0.5])];
    for (let it = 0; it < 2; it++) { // round the corners (Chaikin), keeping the ends
      const o = [pts[0]];
      for (let j = 0; j < pts.length - 1; j++) { const a = pts[j], b = pts[j + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
      o.push(pts[pts.length - 1]); pts = o;
    }
    const cum = [0];
    for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    walk.path = pts; walk.cum = cum; walk.s = 0; walk.room = best.k; walk.cells = new Set(cells); walk.target = best; walk.sky = preferSky;
    if (best.k !== -1) { walk.recent.push(best.k); if (walk.recent.length > Math.min(4, map.rooms.length - 1)) walk.recent.shift(); }
  }
  const PT = [0, 0];
  function pointAt(s) {
    const { path: p, cum } = walk, L = cum[cum.length - 1];
    s = Math.max(0, Math.min(L, s));
    let j = 1; while (j < cum.length - 1 && cum[j] < s) j++;
    const k = (s - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
    PT[0] = p[j - 1][0] + (p[j][0] - p[j - 1][0]) * k; PT[1] = p[j - 1][1] + (p[j][1] - p[j - 1][1]) * k;
    return PT;
  }
  /** Through a portal: the dreamer steps from one end of an impossible corridor to the other, seeing nothing change. */
  function portalStep() {
    const c = cellAt(px, py);
    if (KIND[c] !== PORTAL) return;
    px += PDX[c]; eyeZ -= PDZ[c]; wisp.x += PDX[c]; wisp.z -= PDZ[c];
    for (const s of trail) { s.x += PDX[c]; s.z -= PDZ[c]; }
  }
  function stepWalk(dt, e) {
    if (walk.state === 'loop') {
      // up the endless stair (or along the endless gallery), round and round, then out the way we came in
      const lp = walk.loop, want = walk.loopDir > 0 ? 0 : Math.PI;
      camA += wrapPi(want - camA) * Math.min(1, dt * 1.8);
      const facing = Math.cos(wrapPi(want - camA));
      speed += ((0.5 + 0.45 * e) * Math.max(0, facing) - speed) * Math.min(1, dt * 2);
      const mv = speed * dt;
      px += walk.loopDir * mv; walk.loopLeft -= mv;
      portalStep();
      pitch += ((lp.rise ? 0.12 : 0) * (walk.loopLeft > 1 ? 1 : 0) - pitch) * Math.min(1, dt * 0.8);
      if (walk.loopLeft <= 0) { px = (lp.mid % N) + 0.5; walk.state = 'walk'; walk.path = null; planRoute(e < 0.28); }
      return;
    }
    if (!walk.path) { planRoute(e < 0.28); if (!walk.path) return; }
    const L = walk.cum[walk.cum.length - 1];
    if (walk.state === 'walk' && e < 0.28 && !walk.sky) { planRoute(true); if (!walk.path) return; } // time to find somewhere to lie and look at the sky
    if (walk.state === 'walk') {
      // a door just ahead that hasn't finished opening: wait for it
      let blocked = false;
      for (const ds of [0.45, 0.8]) { const q = pointAt(walk.s + ds), c = cellAt(q[0], q[1]); if (KIND[c] === DOOR) { const dr = map.doors.find((o) => o.i === c); if (dr && dr.open < 0.9) blocked = true; } else if (KIND[c] === WALL) blocked = true; }
      const ahead = pointAt(walk.s + 0.9), want = Math.atan2(ahead[1] - py, ahead[0] - px), turn = Math.abs(wrapPi(want - camA));
      const vmax = 0.55 + 0.6 * e;
      const target = blocked ? 0 : vmax * Math.max(0.25, Math.cos(Math.min(1.5, turn)));
      speed += (target - speed) * Math.min(1, dt * 2.5);
      walk.s = Math.min(L, walk.s + speed * dt);
      const p = pointAt(walk.s); px = p[0]; py = p[1];
      camA += wrapPi(want - camA) * Math.min(1, dt * 2.2);
      pitch += (0 - pitch) * Math.min(1, dt * 0.8);
      if (blocked && KIND[cellAt(pointAt(walk.s + 0.8)[0], pointAt(walk.s + 0.8)[1])] === WALL && (walk.stuck = (walk.stuck || 0) + dt) > 2) { walk.stuck = 0; walk.path = null; return; }
      if (walk.s >= L - 0.02) {
        speed = 0;
        const c = cellAt(px, py);
        if (walk.target && walk.target.loop) {
          const lp = walk.target.loop; walk.loop = lp; walk.state = 'loop'; walk.loopDir = rand() < 0.75 ? 1 : -1;
          walk.loopLeft = lp.L * (lp.rise ? 2 : 2 + Math.floor(rand() * 2)); walk.loopsDone++;
          return;
        }
        if (SKYC[c]) { walk.state = e < 0.28 ? 'rest' : 'gaze'; walk.wait = 7 + rand() * 9; aimGaze(); }
        else { walk.state = 'pause'; walk.wait = 1 + rand() * 2.5; }
        walk.lookA = camA + (rand() - 0.5) * 2;
      }
    } else {
      speed += (0 - speed) * Math.min(1, dt * 3);
      walk.wait -= dt;
      if (walk.state === 'gaze' || walk.state === 'rest') {
        // stop and look up at the moon
        const ta = walk.gazeA + Math.sin(clock * 0.05) * (walk.state === 'rest' ? 0.3 : 0.1);
        camA += wrapPi(ta - camA) * Math.min(1, dt * 0.45);
        const tp = Math.min(S.camera.aspect >= 1 ? 0.52 : 0.32, walk.gazeP) + (walk.state === 'rest' ? 0.05 : 0);
        pitch += (tp - pitch) * Math.min(1, dt * 0.35);
      } else {
        camA += wrapPi(walk.lookA - camA) * Math.min(1, dt * 0.9);
        pitch += (0 - pitch) * Math.min(1, dt);
      }
      if (walk.state === 'rest') { if (!resting) restAt = clock; resting = Math.min(1, resting + dt / 8); return; }
      if (walk.wait <= 0) { walk.state = 'walk'; planRoute(e < 0.28); }
    }
  }
  /** How high the walls and roofs stand in a direction: the elevation you'd have to look above to see sky. */
  function skyline(az) {
    let hi = -1, lastCe = CE[cellAt(px, py)];
    const dx = Math.cos(az), dy = Math.sin(az);
    for (let d = 0.3; d < 14; d += 0.12) {
      const c = cellAt(px + dx * d, py + dy * d);
      if (c < 0 || c >= map.NN) break;
      const h = KIND[c] === WALL ? lastCe : SKYC[c] ? -9 : CE[c];
      if (h > -9) hi = Math.max(hi, Math.atan2(h - eyeZ, d));
      if (KIND[c] === WALL) break;
      lastCe = CE[c];
    }
    return hi;
  }
  /** Where to look when stopping under the sky: the moon if the walls let you see it, else the most open sky. */
  function aimGaze() {
    if (moonEl > skyline(moonAz) + 0.12) { walk.gazeA = moonAz; walk.gazeP = moonEl * 0.8; return; }
    let best = camA, lo = 9;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, h = skyline(a); if (h < lo) { lo = h; best = a; } }
    walk.gazeA = best; walk.gazeP = Math.max(0.3, Math.min(0.55, lo + 0.35));
  }
  function stepDoors(dt) {
    for (const d of map.doors) {
      const dist = Math.hypot(d.x + 0.5 - px, d.y + 0.5 - py);
      if (dist < 1.9) { d.open = Math.min(1, d.open + dt / 1.3); d.timer = 2.5; }
      else if ((d.timer -= dt) < 0 && dist > 1.2) d.open = Math.max(0, d.open - dt / 1.8);
      const e = d.open * d.open * (3 - 2 * d.open);
      CE[d.i] = FL[d.i] + e * (d.top - FL[d.i]);
    }
  }
  // ---- walls that move when you're not looking (never one you could see, never one on your way)
  let shiftDue = 20;
  function stepShift(dt) {
    if ((shiftDue -= dt) > 0 || !map.shift.length || walk.state === 'loop') return;
    shiftDue = 16 + rand() * 20;
    for (let tries = 0; tries < 8; tries++) {
      const i = map.shift[Math.floor(rand() * map.shift.length)], x = (i % N) + 0.5, y = Math.floor(i / N) + 0.5;
      const dx = x - px, dy = y - py, dist = Math.hypot(dx, dy);
      if (dist < 2.5 || walk.cells.has(i)) continue;
      if (dist < 12 && Math.abs(wrapPi(Math.atan2(dy, dx) - camA)) < Math.atan(W / 2 / f) + 0.5) continue;
      const ew = (i % N) % 2 === 0, a = ew ? i - 1 : i - N;
      if (KIND[i] === WALL) { KIND[i] = OPEN; FL[i] = FL[a]; CE[i] = CE[a]; SKYC[i] = SKYC[a]; LIGHT[i] = LIGHTE[i] = LIGHT[a]; FT[i] = FT[a]; CT[i] = CT[a]; }
      else {
        const before = distances(map, cellAt(px, py)).reduce((n, v) => n + (v >= 0), 0);
        KIND[i] = WALL;
        const after = distances(map, cellAt(px, py)).reduce((n, v) => n + (v >= 0), 0);
        if (after < before - 1) { KIND[i] = OPEN; continue; }
      }
      return;
    }
  }

  // ---------------------------------------------------------------- light: Doom's falloff, our fog, the lantern, and coloured lights
  let LR = 0, LG = 0, LB = 0, FA = 0, lanternI = 0.5, wispI = 0;
  const ALx = new Float32Array(NL), ALy = new Float32Array(NL), ALz = new Float32Array(NL), ALir2 = new Float32Array(NL), ALr = new Float32Array(NL), ALg = new Float32Array(NL), ALb = new Float32Array(NL);
  let nAL = 0;
  const lmaskCells = [];
  function lightTerms(Lc, d) {
    const vis = Math.max(0, Math.min(1, 1.3 - d * D.fogD * 2.1));
    const l = Math.floor(Lc * vis * 0.85 * 32) / 32; // banded, like Doom's colormaps
    const fa = 1 - Math.exp(-d * D.fogD * 1.4), k = 1 - fa;
    const lan = lanternI / (1 + d * d * 1.6);
    LR = (l * T0 + lan) * k; LG = (l * T1 + lan * 0.74) * k; LB = (l * T2 + lan * 0.45) * k; FA = fa;
  }
  /** The coloured lights that can reach this cell, added to the light at a point. */
  function addLights(m, wx, wy, wz) {
    const k = 1 - FA;
    for (let i = 0; i < nAL; i++) if (m & (1 << i)) {
      const dx = wx - ALx[i], dy = wy - ALy[i], dz = wz - ALz[i], q = 1 - (dx * dx + dy * dy + dz * dz) * ALir2[i];
      if (q > 0) { const w = q * q * k; LR += ALr[i] * w; LG += ALg[i] * w; LB += ALb[i] * w; }
    }
  }
  /** Choose the lights near the dreamer and flood each one through the open cells it can reach. */
  function gatherLights(t) {
    for (const i of lmaskCells) LMASK[i] = 0;
    lmaskCells.length = 0; nAL = 0;
    const add = (x, y, z, col, r, I) => {
      if (nAL >= NL) return;
      const k = nAL++;
      ALx[k] = x; ALy[k] = y; ALz[k] = z; ALir2[k] = 1 / (r * r); ALr[k] = col[0] * I; ALg[k] = col[1] * I; ALb[k] = col[2] * I;
      const start = cellAt(x, y); if (start < 0 || start >= map.NN || KIND[start] === WALL) return;
      const reach = Math.ceil(r) + 1, seen = [start], dist = [0];
      LMASK[start] |= 1 << k; lmaskCells.push(start);
      for (let h = 0; h < seen.length; h++) {
        if (dist[h] >= reach) continue;
        for (const j of [seen[h] + 1, seen[h] - 1, seen[h] + N, seen[h] - N]) {
          if (j < 0 || j >= map.NN || (LMASK[j] & (1 << k)) || KIND[j] === PORTAL) continue;
          LMASK[j] |= 1 << k; lmaskCells.push(j);
          if (KIND[j] !== WALL) { seen.push(j); dist.push(dist[h] + 1); }
        }
      }
    };
    if (wispI > 0) add(wisp.x, wisp.y, wisp.z, D.wisp.map((v) => v / 255), 1.6, wispI);
    const near = [];
    for (const L of map.lights) { const d = Math.hypot(L.x - px, L.y - py); if (d < 9) near.push([d, L]); }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, L] of near) add(L.x, L.y, L.z, L.col, L.r, L.i * (L.flick ? 0.85 + 0.15 * Math.sin(t * 7.3 + L.x * 3) * Math.sin(t * 4.1 + L.y) : 1) * (0.6 + 0.4 * energy));
  }
  function shade(c, g, lr, lg, lb, fa) {
    const r = c & 255, gg = (c >> 8) & 255, b = (c >> 16) & 255;
    let R = r * lr + FR * fa, G = gg * lg + FG * fa, B = b * lb + FB * fa;
    if (g) { const k = (g / 255) * (1 - fa * 0.6); R += (r * 1.05 - R) * k; G += (gg * 1.05 - G) * k; B += (b * 1.05 - B) * k; }
    return (255 << 24) | (c8(B) << 16) | (c8(G) << 8) | c8(R);
  }
  const wallTex = (i) => { const w = WT[i]; return w >= 300 ? (paints ? paints[(w - 300) % paints.length] : set.walls[0]) : w >= 200 ? set.upper : w >= 100 ? set.special[w - 100] : set.walls[w]; };

  // ---------------------------------------------------------------- spans, drawn into whichever column is being cast (the screen, or a mirror)
  let OB = null, OD = null, OS = 1, OX = 0, EZ = 0.5, MIRROR = false, ZO = 0, OXW = 0;
  let colWet = false, colWetH = 0;
  function wallSpan(ya, yb, T, tu, d, Lc, peg, hx0, hy0, cell, alpha) {
    lightTerms(Lc, d);
    const bR = LR, bG = LG, bB = LB, m = LMASK[cell], k = (d / f) * TS, zs = d / f;
    let tv = -(EZ - (ya + 0.5 - hz) * zs - peg) * TS;
    const px_ = T.px, gl = T.glow, al = alpha ? T.alpha : null, wx = hx0 + OXW;
    for (let y = ya, p = ya * OS + OX; y < yb; y++, tv += k, p += OS) {
      const ti = ((Math.floor(tv) & 63) << 6) | tu;
      if (al && !al[ti]) continue;
      LR = bR; LG = bG; LB = bB;
      if (m) addLights(m, wx, hy0, EZ - (y + 0.5 - hz) * zs - ZO);
      OB[p] = shade(px_[ti], gl ? gl[ti] : 0, LR, LG, LB, FA);
      OD[p] = d;
      if (al && !MIRROR) refl[p] = 0;
    }
  }
  function flatSpan(x, ya, yb, cell, h, ceil, rdx, rdy, t) {
    const T = ceil ? (CT[cell] ? set.hallCeil : set.ceil) : set.floor[FT[cell]];
    const dz = ceil ? h - EZ : EZ - h, Lc = LIGHTE[cell], wet = !ceil && WATER[cell], vd = !ceil && VOID[cell], m = LMASK[cell];
    const px_ = T.px, gl = T.glow;
    if (wet && !MIRROR && !colWet) { colWet = true; colWetH = h; }
    for (let y = ya, p = ya * OS + OX; y < yb; y++, p += OS) {
      const d = dz * Math.abs(rowInv[y]);
      const wx = px + rdx * d, wy = py + rdy * d;
      lightTerms(Lc, d);
      if (m) addLights(m, wx + OXW, wy, h - ZO);
      if (vd) {
        // the floor has fallen away: stars below, and the moon
        const c = SKY.px[rowMirV[y] * SKY_W + colU[x]], k = 0.9 * (1 - FA * 0.6);
        OB[p] = (255 << 24) | (c8(((c >> 16) & 255) * k + FB * FA * 0.6) << 16) | (c8(((c >> 8) & 255) * k + FG * FA * 0.6) << 8) | c8((c & 255) * k + FR * FA * 0.6);
        OD[p] = d; if (!MIRROR) refl[p] = 2;
      } else if (wet && !MIRROR) {
        // water: first the sky upside down; the reflection pass paints the rest in
        const c = SKY.px[rowMirV[y] * SKY_W + colU[x]];
        OB[p] = c; OD[p] = d; refl[p] = 1;
      } else {
        const ti = ((Math.floor(wy * TS) & 63) << 6) | (Math.floor(wx * TS) & 63);
        OB[p] = shade(px_[ti], gl ? gl[ti] : 0, LR, LG, LB, FA);
        OD[p] = d;
      }
    }
  }
  let cloudOff = 0;
  function skySpan(x, ya, yb) {
    const u = colU[x], cu = (u >> 1);
    const daz = wrapPi(colAz[x] - moonAz);
    for (let y = ya, p = ya * OS + OX; y < yb; y++, p += OS) {
      let c = SKY.px[rowSkyV[y] * SKY_W + u];
      const cv = rowCloudV[y];
      if (cv >= 0) {
        const a = CLOUD[cv * CL_W + ((cu + cloudOff) & (CL_W - 1))];
        if (a) {
          const de = rowEl[y] - moonEl, ce_ = Math.cos(rowEl[y]), prox = Math.exp(-(daz * daz * ce_ * ce_ + de * de) * 5);
          const k = Math.min(1, (a / 255) * (1 + rainAmt * 0.6)), lit = (0.55 + prox * 1.6) * (1 - rainAmt * 0.3);
          const R = (c & 255) * (1 - k) + cloudCol[0] * lit * k + 200 * prox * k, G = ((c >> 8) & 255) * (1 - k) + cloudCol[1] * lit * k + 196 * prox * k, B = ((c >> 16) & 255) * (1 - k) + cloudCol[2] * lit * k + 190 * prox * k;
          c = (255 << 24) | (c8(B) << 16) | (c8(G) << 8) | c8(R);
        }
      }
      OB[p] = c; OD[p] = 1e9;
    }
  }

  // ---------------------------------------------------------------- one column, front to back (Doom's way, clipping as it goes), through portals
  const masks = [];
  function column(x, t) {
    const rdx = colRX[x], rdy = colRY[x];
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
    let sx, sy, stx, sty;
    if (rdx < 0) { stx = -1; sx = (px - mx) * ddx; } else { stx = 1; sx = (mx + 1 - px) * ddx; }
    if (rdy < 0) { sty = -1; sy = (py - my) * ddy; } else { sty = 1; sy = (my + 1 - py) * ddy; }
    let cur = my * N + mx, top = 0, bot = H, d1 = 0, side = 0;
    ZO = 0; OXW = 0; masks.length = 0;
    for (let it = 0; it < 110; it++) {
      if (sx < sy) { d1 = sx; sx += ddx; mx += stx; side = 0; } else { d1 = sy; sy += ddy; my += sty; side = 1; }
      if (d1 < 0.02) d1 = 0.02;
      const fh = FL[cur] + ZO, ch = CE[cur] + ZO;
      const yC = hz - ((ch - EZ) * f) / d1, yF = hz + ((EZ - fh) * f) / d1;
      if (ch > EZ) {
        const rc = Math.min(bot, Math.ceil(yC - 0.5));
        if (rc > top) { if (SKYC[cur]) skySpan(x, top, rc); else flatSpan(x, top, rc, cur, ch, true, rdx, rdy, t); top = rc; }
      }
      if (fh < EZ) {
        const rf = Math.max(top, Math.ceil(yF - 0.5));
        if (rf < bot) { flatSpan(x, rf, bot, cur, fh, false, rdx, rdy, t); bot = rf; }
      }
      if (top >= bot) break;
      if (d1 > MAXD || mx < 0 || my < 0 || mx >= N || my >= NY) break;
      let nx = my * N + mx;
      if (KIND[nx] === PORTAL) { const dx = PDX[nx]; mx += dx; OXW += dx; ZO += PDZ[nx]; nx = my * N + mx; }
      const k = KIND[nx];
      let wu = side === 0 ? py + d1 * rdy : px + d1 * rdx; wu -= Math.floor(wu);
      let tu = (wu * TS) | 0; if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tu = 63 - tu;
      const hx0 = px + rdx * d1, hy0 = py + rdy * d1, Lc = LIGHTE[cur] * (side ? 0.88 : 1.08);
      if (k === WALL) { wallSpan(top, bot, wallTex(nx), tu, d1, Lc, 0, hx0, hy0, cur, false); top = bot; break; }
      const nf = FL[nx] + ZO, nc = CE[nx] + ZO;
      if (nc < ch && !(SKYC[cur] && SKYC[nx])) {
        const b = Math.min(bot, Math.ceil(hz - ((nc - EZ) * f) / d1 - 0.5));
        if (b > top) {
          if (k === DOOR) { // the door itself, pegged to its bottom edge so it slides up with it; the lintel above
            const m = Math.max(top, Math.min(b, Math.ceil(hz - ((nc + 1 - EZ) * f) / d1 - 0.5)));
            if (m > top) wallSpan(top, m, set.upper, tu, d1, Lc, 0, hx0, hy0, cur, false);
            if (b > m) wallSpan(m, b, set.door, tu, d1, Lc, nc, hx0, hy0, cur, false);
          } else wallSpan(top, b, set.upper, tu, d1, Lc, 0, hx0, hy0, cur, false);
          top = b;
        }
      }
      if (nf > fh) {
        const a = Math.max(top, Math.ceil(hz + ((EZ - nf) * f) / d1 - 0.5));
        if (a < bot) { wallSpan(a, bot, set.step, tu, d1, Lc, 0, hx0, hy0, cur, false); bot = a; }
      }
      if (top >= bot) break;
      // a grille: remember it, to draw over everything behind it once the column is done
      if (k === GRATE && !MIRROR) {
        const a = Math.max(top, Math.ceil(hz - ((nc - EZ) * f) / d1 - 0.5)), b = Math.min(bot, Math.ceil(hz + ((EZ - nf) * f) / d1 - 0.5));
        if (b > a) masks.push({ a, b, tu, d: d1, Lc, peg: nf + 1, hx0, hy0, cell: cur, zo: ZO, oxw: OXW });
      }
      cur = nx;
    }
    if (top < bot) fogFill(x, top, bot);
    for (let i = masks.length - 1; i >= 0; i--) { const s = masks[i]; ZO = s.zo; OXW = s.oxw; wallSpan(s.a, s.b, set.grate, s.tu, s.d, s.Lc, s.peg, s.hx0, s.hy0, s.cell, true); }
  }
  function fogFill(x, top, bot) { for (let y = top, p = top * OS + OX; y < bot; y++, p += OS) { OB[p] = FOGC; OD[p] = MAXD; } }

  // ---------------------------------------------------------------- things (billboards), the wisp, creatures, stars
  let ca = 1, sa = 0;
  function sprite(T, wx, wy, z, w, h, { Lc = 0.6, flip = false, add = 0 } = {}) {
    const dx = wx - px, dy = wy - py, tz = dx * ca + dy * sa;
    if (tz < 0.15 || tz > MAXD) return;
    const tx = -dx * sa + dy * ca, sc = f / tz, cx = W / 2 + tx * sc, wp = w * sc, hp = h * sc;
    const left = cx - wp / 2, yT = hz - (z + h - eyeZ) * sc;
    const x0 = Math.max(0, Math.ceil(left - 0.5)), x1 = Math.min(W, Math.ceil(left + wp - 0.5));
    const y0 = Math.max(0, Math.ceil(yT - 0.5)), y1 = Math.min(H, Math.ceil(yT + hp - 0.5));
    if (x1 <= x0 || y1 <= y0) return;
    lightTerms(Lc, tz);
    const c0 = cellAt(wx, wy);
    if (c0 >= 0 && c0 < map.NN && LMASK[c0]) addLights(LMASK[c0], wx, wy, z + h / 2);
    const lr = LR, lg = LG, lb = LB, tw = T.w, th = T.h, near = Math.min(1, Math.max(0, (tz - 0.35) / 1.2)); // glowing things fade as they come right up to you
    for (let c = x0; c < x1; c++) {
      let u = Math.min(tw - 1, ((c + 0.5 - left) / wp * tw) | 0); if (flip) u = tw - 1 - u;
      for (let y = y0; y < y1; y++) {
        const v = Math.min(th - 1, ((y + 0.5 - yT) / hp * th) | 0), i = v * tw + u;
        if (!T.alpha[i]) continue;
        const p = y * W + c;
        if (depth[p] <= tz) continue;
        if (add) {
          const s = T.px[i], o = buf[p], k = add * near * (1 - FA * 0.8) * (T.glow ? 0.35 + (T.glow[i] / 255) * 0.65 : 1);
          buf[p] = (255 << 24) | (c8(((o >> 16) & 255) + ((s >> 16) & 255) * k) << 16) | (c8(((o >> 8) & 255) + ((s >> 8) & 255) * k) << 8) | c8((o & 255) + (s & 255) * k);
        } else { buf[p] = shade(T.px[i], T.glow ? T.glow[i] : 0, lr, lg, lb, FA); depth[p] = tz; }
      }
    }
  }
  /** A soft additive glow at a point in the world (the wisp, sparks), hidden by anything in front. */
  function glowAt(wx, wy, wz, rad, col, amt) {
    const dx = wx - px, dy = wy - py, tz = dx * ca + dy * sa;
    if (tz < 0.12 || tz > MAXD) return;
    const sc = f / tz, cx = W / 2 + (-dx * sa + dy * ca) * sc, cy = hz - (wz - eyeZ) * sc, r = Math.max(0.6, rad * sc), R = r * 3;
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
    const fog = 1 - (1 - Math.exp(-tz * D.fogD * 1.4)) * 0.7;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x; if (depth[p] < tz - 0.15) continue;
      const q = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / (r * r);
      const a = (Math.exp(-q * 1.6) * 1.1 + Math.exp(-q * 0.18) * 0.22) * amt * fog;
      if (a < 0.01) continue;
      const o = buf[p];
      buf[p] = (255 << 24) | (c8(((o >> 16) & 255) + col[2] * a) << 16) | (c8(((o >> 8) & 255) + col[1] * a) << 8) | c8((o & 255) + col[0] * a);
    }
  }
  function addPix(x, y, col, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x, o = buf[p];
    buf[p] = (255 << 24) | (c8(((o >> 16) & 255) + col[2] * a) << 16) | (c8(((o >> 8) & 255) + col[1] * a) << 8) | c8((o & 255) + col[0] * a);
  }
  /** A point on the sky (azimuth, elevation) to the screen, the same way the sky itself is laid out. */
  const SKYP = [0, 0];
  function skyToScreen(az, el) {
    const da = wrapPi(az - camA);
    if (Math.abs(da) > 1.45) return null;
    SKYP[0] = W / 2 + f * Math.tan(da); SKYP[1] = hz - f * Math.tan(el);
    return SKYP;
  }
  let motes = [];
  const trail = [];
  let shoot = null, shootDue = 20, whaleS = null, whaleDue = 150, rainAmt = 0, rainTarget = 0, rainUntil = 0, showerDue = 120;

  // ---------------------------------------------------------------- the lantern in your hand
  const held = heldLantern();
  function drawHeld(t) {
    const s = Math.min(W, H) / 200 * 1.12, w = held.w * s, h = held.h * s;
    const bx = Math.cos(bobPh) * 3.5 * s * Math.min(1, speed * 1.6), by = Math.abs(Math.sin(bobPh)) * 3 * s * Math.min(1, speed * 1.6);
    const down = (Math.max(0, pitch) * 70 + resting * 120) * s;
    const left = W * 0.6 - w / 2 + bx, topY = H - h * 0.92 + by + down;
    if (topY >= H) return;
    const flick = 0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 7.7 + 1);
    const amb = Math.min(1, LIGHTE[cellAt(px, py)] * 0.6 + lanternI * 0.9);
    const x0 = Math.max(0, Math.floor(left)), x1 = Math.min(W, Math.ceil(left + w)), y0 = Math.max(0, Math.floor(topY)), y1 = Math.min(H, Math.ceil(topY + h));
    for (let y = y0; y < y1; y++) {
      const v = Math.min(held.h - 1, ((y + 0.5 - topY) / s) | 0);
      for (let x = x0; x < x1; x++) {
        const u = Math.min(held.w - 1, ((x + 0.5 - left) / s) | 0), i = v * held.w + u;
        if (!held.alpha[i]) continue;
        const g = held.glow[i];
        buf[y * W + x] = g ? shade(held.px[i], 255, flick, flick, flick, 0) : shade(held.px[i], 0, amb * 1.05, amb * 0.86, amb * 0.66, 0);
      }
    }
  }

  // ---------------------------------------------------------------- the dream's name, in a blocky font, as it begins
  let titleAt = -99, titleMask = null;
  function drawTitle(t) {
    const age = t - titleAt; if (age > 8 || age < 0) return;
    if (!titleMask) {
      const s = Math.max(1, Math.round(Math.min(W, H) / 200)), c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
      const fs = 9 * s; g.font = `bold ${fs}px monospace`;
      const text = D.name.toUpperCase(), tw = Math.ceil(g.measureText(text).width) + 4;
      c.width = Math.min(W, tw); c.height = fs + 6; g.font = `bold ${fs}px monospace`; g.textBaseline = 'top'; g.fillStyle = '#fff';
      g.fillText(text, 2, 2, W - 4);
      const d = g.getImageData(0, 0, c.width, c.height).data, m = new Uint8Array(c.width * c.height);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 120 ? 1 : 0;
      titleMask = { w: c.width, h: c.height, m };
    }
    const a = Math.min(1, age / 1.5) * Math.min(1, (8 - age) / 2.5) * 0.9;
    const { w, h, m } = titleMask, ox = Math.floor((W - w) / 2), oy = Math.floor(H * 0.16);
    const col = D.wisp;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      for (const [dx, dy, k, c] of [[1, 1, a * 0.7, [0, 0, 0]], [0, 0, a, col]]) {
        const X = ox + x + dx, Y = oy + y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const p = Y * W + X, o = buf[p];
        buf[p] = (255 << 24) | (c8(((o >> 16) & 255) * (1 - k) + c[2] * k) << 16) | (c8(((o >> 8) & 255) * (1 - k) + c[1] * k) << 8) | c8((o & 255) * (1 - k) + c[0] * k);
      }
    }
  }

  // ---------------------------------------------------------------- the reflection pass: a column cast again from under the water
  function reflectColumn(x, t) {
    const sEZ = EZ;
    OB = mcol; OD = mdep; OS = 1; OX = 0; EZ = 2 * colWetH - eyeZ; MIRROR = true;
    column(x, t);
    OB = buf; OD = depth; OS = W; OX = x; EZ = sEZ; MIRROR = false;
    const rain = rainAmt * (D.weather?.showers ? 1 : 0);
    for (let y = Math.max(0, Math.floor(hz)); y < H; y++) {
      const p = y * W + x; if (refl[p] !== 1) continue;
      const d = depth[p], rip = Math.sin(y * 0.9 + t * 1.7 + Math.sin(x * 0.31 + t * 0.6) * 2) * (1.2 / (1 + d * 0.4)) + (rain ? Math.sin(x * 1.7 + t * 9) * Math.sin(y * 2.3 - t * 7) * rain * 2 : 0);
      const ym = Math.round(2 * hz - y - 1 + rip);
      const c = ym >= 0 && ym < H ? mcol[ym] : buf[p];
      const fa = 1 - Math.exp(-d * D.fogD * 1.4), k = 0.72 * (1 - fa);
      let R = (c & 255) * k + FR * fa + 3, G = ((c >> 8) & 255) * k + FG * fa + 6, B = ((c >> 16) & 255) * k + FB * fa + 10;
      if (rain && ((x * 7 + y * 13 + Math.floor(t * 12)) % 97) === 0) { R += 60; G += 60; B += 70; } // a raindrop lands
      buf[p] = (255 << 24) | (c8(B) << 16) | (c8(G) << 8) | c8(R);
    }
  }

  // ---------------------------------------------------------------- one frame
  function render(t, dt) {
    ca = Math.cos(camA); sa = Math.sin(camA);
    hz = H / 2 + f * Math.tan(pitch);
    for (let x = 0; x < W; x++) {
      const cx = (x + 0.5 - W / 2) / f;
      colRX[x] = ca - sa * cx; colRY[x] = sa + ca * cx;
      const az = camA + Math.atan(cx); colAz[x] = az;
      colU[x] = Math.floor(((az / TAU) % 1 + 1) % 1 * SKY_W) & (SKY_W - 1);
    }
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - hz;
      rowInv[y] = Math.abs(dy) < 1e-4 ? 1e4 : f / dy;
      const el = Math.atan(-dy / f); rowEl[y] = el;
      rowSkyV[y] = Math.max(0, Math.min(SKY_H - 1, Math.floor(((EL1 - el) / (EL1 - EL0)) * SKY_H)));
      rowMirV[y] = Math.max(0, Math.min(SKY_H - 1, Math.floor(((EL1 + el) / (EL1 - EL0)) * SKY_H)));
      rowCloudV[y] = el > EL0 && el < CL_EL1 ? Math.floor(((CL_EL1 - el) / (CL_EL1 - EL0)) * CL_H) : -1;
    }
    refl.fill(0);
    OB = buf; OD = depth; OS = W; EZ = eyeZ; MIRROR = false;
    for (let x = 0; x < W; x++) {
      OX = x; colWet = false;
      column(x, t);
      if (colWet) reflectColumn(x, t);
    }

    // twinkling stars (in the sky, and mirrored in the water and the void), and the odd shooting star
    for (const s of stars) {
      const q = skyToScreen(s.az, s.el); if (!q) continue;
      const x = Math.floor(q[0]); if (x < 0 || x >= W) continue;
      const tw = s.sp ? 0.5 + 0.5 * Math.sin(t * s.sp + s.ph) : 0.85, a = s.b * tw * tw, col = s.col;
      const y = Math.floor(q[1]);
      if (y >= 0 && y < H && depth[y * W + x] > 1e8) {
        addPix(x, y, col, a);
        if (a > 0.75) { addPix(x + 1, y, col, a * 0.3); addPix(x - 1, y, col, a * 0.3); addPix(x, y + 1, col, a * 0.3); addPix(x, y - 1, col, a * 0.3); }
      }
      const ym = Math.floor(2 * hz - q[1]);
      if (ym >= 0 && ym < H) { const r = refl[ym * W + x]; if (r) addPix(x, ym, col, a * (r === 2 ? 0.8 : 0.3)); }
    }
    if (shoot) {
      const k = (t - shoot.t0) / shoot.dur;
      if (k > 1) shoot = null;
      else for (let j = 0; j < 14; j++) {
        const kk = k - j * 0.012; if (kk < 0) break;
        const q = skyToScreen(shoot.az + shoot.daz * kk, shoot.el + shoot.del * kk); if (!q) continue;
        const x = Math.floor(q[0]), y = Math.floor(q[1]);
        if (x < 0 || y < 0 || x >= W || y >= H || depth[y * W + x] < 1e8) continue;
        addPix(x, y, [255, 250, 235], (1 - j / 14) * Math.sin(Math.PI * k) * 0.95);
      }
    }
    drawWhale(t);
    drawConstellation(t);

    // things, far to near (the ones in the impossible corridors seen again and again down them)
    const vis = [];
    const consider = (th, x, y, z) => { const dx = x - px, dy = y - py, tz = dx * ca + dy * sa; if (tz > 0.15 && tz < MAXD) vis.push([tz, th, x, y, z]); };
    for (const th of map.things) {
      consider(th, th.x, th.y, th.z);
      if (th.loop >= 0 && th.loop !== undefined) { const lp = map.loops[th.loop]; for (const k of [-3, -2, -1, 1, 2, 3]) consider(th, th.x + k * lp.L, th.y, th.z + k * lp.L * lp.rise); }
    }
    if (deer) consider({ kind: 'deer' }, deer.x, deer.y, FL[deer.cell]);
    vis.sort((a, b) => b[0] - a[0]);
    for (const [, th, x, y, z] of vis) {
      const c = cellAt(th.x ?? x, th.y ?? y), Lc = Math.max(c >= 0 && c < map.NN ? LIGHTE[c] : 0.5, th.glowy ? 0.8 : 0);
      if (th.kind === 'float') sprite(th.frames[th.frame], x, y, z, th.w, th.h, { Lc: Lc + 0.15, flip: th.flip, add: D.addFloat || 0 });
      else if (th.kind === 'hang') sprite(th.spr, x + Math.sin(t * 0.7 + th.swing) * 0.02, y, z, th.w, th.h, { Lc: 0.9 });
      else if (th.kind === 'owl') sprite(th.frames[Math.sin(t * 0.4 + th.ph) > 0.96 ? 1 : 0], x, y, z, th.w, th.h, { Lc: Math.max(Lc, 0.7) });
      else if (th.kind === 'cat') sprite(th.frames[Math.floor(t * 0.45 + th.ph) % 2], x, y, z, th.w, th.h, { Lc: Math.max(Lc, 0.75) });
      else if (th.kind === 'deer') drawDeer(x, y, z);
      else sprite(th.spr, x, y, z, th.w, th.h, { Lc });
    }
    // the wisp and its trail of sparks
    const pul = 0.75 + 0.25 * Math.sin(t * 2.3) + wisp.pulse;
    for (const s of trail) glowAt(s.x, s.y, s.z, 0.012, D.wisp, s.a);
    glowAt(wisp.x, wisp.y, wisp.z, 0.045 * (0.9 + 0.2 * pul), D.wisp, 0.9 * pul * (1 - resting * 0.4));
    drawWeather(t);
    // motes in the air (fireflies, dust, spores)
    for (const m of motes) {
      const dx = m.x - px, dy = m.y - py, tz = dx * ca + dy * sa; if (tz < 0.2) continue;
      const sc = f / tz, x = Math.floor(W / 2 + (-dx * sa + dy * ca) * sc), y = Math.floor(hz - (m.z - eyeZ) * sc);
      if (x < 0 || y < 0 || x >= W || y >= H || depth[y * W + x] < tz) continue;
      const blink = D.motes.blink ? Math.max(0, Math.sin(t * m.sp * 3 + m.ph * 5)) ** 2 : 0.5 + 0.3 * Math.sin(t * m.sp * 4 + m.ph);
      const a = blink * Math.min(1, 2.5 / tz) * (0.6 + 0.4 * energy);
      addPix(x, y, D.motes.col, a); if (tz < 2.5) { addPix(x + 1, y, D.motes.col, a * 0.4); addPix(x, y + 1, D.motes.col, a * 0.4); }
    }
    drawHeld(t);
    drawTitle(t);
    // the melt: the last dream slides down off the screen in ragged columns
    if (melt) {
      let done = true;
      const sp = H / 200;
      for (let x = 0; x < W; x++) {
        let o = melt.y[x];
        o = o < 0 ? o + dt * 22 * sp : o + Math.min(o * 0.04 + 1, 8) * dt * 17 * sp; // slower than Doom's: a dream fading
        melt.y[x] = o;
        const off = Math.max(0, Math.floor(o));
        if (off < H) done = false;
        for (let y = H - 1; y >= off; y--) buf[y * W + x] = old[(y - off) * W + x];
      }
      if (done) { melt = null; old = null; }
    }
  }

  // ---------------------------------------------------------------- the deer of light
  function stepDeer(dt) {
    if (!deer) return;
    if (deer.pause > 0) { deer.pause -= dt; return; }
    const tx = (deer.to % N) + 0.5, ty = Math.floor(deer.to / N) + 0.5, dx = tx - deer.x, dy = ty - deer.y, d = Math.hypot(dx, dy);
    if (d < 0.03) {
      const nb = [deer.to + 1, deer.to - 1, deer.to + N, deer.to - N].filter((j) => map.walk(j) && KIND[j] === OPEN);
      const fwd = nb.filter((j) => j !== deer.from);
      deer.from = deer.to; deer.to = (fwd.length ? fwd : nb)[Math.floor(rand() * (fwd.length || nb.length))] ?? deer.to; deer.cell = deer.from;
      if (rand() < 0.15) deer.pause = 2 + rand() * 4; // stops, listens
      return;
    }
    const v = Math.min(d, 0.32 * dt);
    deer.x += (dx / d) * v; deer.y += (dy / d) * v; deer.hd = Math.atan2(dy, dx); deer.ph += dt * 1.6; deer.cell = cellAt(deer.x, deer.y);
  }
  function drawDeer(x, y, z) {
    const toDeer = Math.atan2(y - py, x - px), rel = wrapPi(deer.hd - toDeer);
    const a = 0.75 * (0.75 + 0.25 * Math.sin(clock * 1.3));
    if (Math.abs(Math.cos(rel)) > 0.8) sprite(deerF, x, y, z, deerF.w / 64 * 0.95, deerF.h / 64 * 0.95, { add: a });
    else sprite(deerS[deer.pause > 0 ? 0 : Math.floor(deer.ph * 2) % 2], x, y, z, deerS[0].w / 64 * 0.95, deerS[0].h / 64 * 0.95, { add: a, flip: Math.cos(deer.hd) * -sa + Math.sin(deer.hd) * ca < 0 });
  }

  // ---------------------------------------------------------------- a whale swimming across the sky
  function drawWhale(t) {
    if (!whaleS) return;
    const k = (t - whaleS.t0) / whaleS.dur;
    if (k > 1) { whaleS = null; return; }
    const az = whaleS.az + whaleS.daz * k, el = whaleS.el + 0.03 * Math.sin(k * 7);
    const q = skyToScreen(az, el); if (!q) return;
    const pw = f * 0.62 * (1 + 0.04 * Math.sin(k * 12)), ph = pw * whaleT.h / whaleT.w, fade = Math.sin(Math.PI * k) * 0.42;
    const cx = q[0], cy = q[1], flip = whaleS.daz < 0;
    const x0 = Math.max(0, Math.floor(cx - pw / 2)), x1 = Math.min(W, Math.ceil(cx + pw / 2)), y0 = Math.max(0, Math.floor(cy - ph / 2)), y1 = Math.min(H, Math.ceil(cy + ph / 2));
    for (let y = y0; y < y1; y++) {
      const v = Math.min(whaleT.h - 1, ((y + 0.5 - (cy - ph / 2)) / ph * whaleT.h) | 0);
      for (let x = x0; x < x1; x++) {
        const p = y * W + x; if (depth[p] < 1e8) continue;
        let u = Math.min(whaleT.w - 1, ((x + 0.5 - (cx - pw / 2)) / pw * whaleT.w) | 0); if (!flip) u = whaleT.w - 1 - u;
        const i = v * whaleT.w + u; if (!whaleT.alpha[i]) continue;
        const s = whaleT.px[i], a = fade;
        addPix(x, y, [s & 255, (s >> 8) & 255, (s >> 16) & 255], a);
      }
    }
  }
  function startWhale() {
    if (!D.whale || whaleS) return;
    const dir = rand() < 0.5 ? -1 : 1;
    whaleS = { t0: clock, dur: 55 + rand() * 20, az: (walk.state === 'gaze' || walk.state === 'rest' ? walk.gazeA : camA) - dir * 0.9, daz: dir * 1.8, el: 0.55 + rand() * 0.3 };
  }

  // ---------------------------------------------------------------- weather
  function stepWeather(dt, t) {
    if (!weather.length) return;
    if (rainUntil && clock > rainUntil) { rainTarget = 0; rainUntil = 0; }
    rainAmt += (rainTarget - rainAmt) * Math.min(1, dt * 0.15);
    for (const w of weather) {
      if (w.z < -50 || Math.hypot(w.x - px, w.y - py) > 5.5 || w.z < FL[Math.max(0, Math.min(map.NN - 1, cellAt(w.x, w.y)))]) {
        const a = rand() * TAU, r = Math.sqrt(rand()) * 5;
        w.x = px + Math.cos(a) * r; w.y = py + Math.sin(a) * r; w.z = eyeZ + 0.5 + rand() * (w.z < -50 ? 3 : 2);
      }
      if (w.kind === 'rain') w.z -= dt * 5.5;
      else if (w.kind === 'snow') { w.z -= dt * 0.35; w.x += Math.sin(t * 0.7 + w.ph) * dt * 0.15; w.y += Math.cos(t * 0.5 + w.ph) * dt * 0.1 + dt * 0.05; }
      else { w.z -= dt * 0.22; w.x += (Math.sin(t * 1.1 + w.ph) * 0.25 + 0.15) * dt; w.y += Math.cos(t * 0.9 + w.ph * 2) * dt * 0.2; }
    }
  }
  function drawWeather(t) {
    for (const w of weather) {
      if (w.kind === 'rain' && rainAmt < 0.05) continue;
      const c = cellAt(w.x, w.y); if (c < 0 || c >= map.NN || !SKYC[c]) continue;
      const dx = w.x - px, dy = w.y - py, tz = dx * ca + dy * sa; if (tz < 0.25) continue;
      const sc = f / tz, x = Math.floor(W / 2 + (-dx * sa + dy * ca) * sc), y = Math.floor(hz - (w.z - eyeZ) * sc);
      if (x < 0 || x >= W) continue;
      if (w.kind === 'rain') {
        const len = Math.max(1, Math.round(0.14 * sc)), a = 0.22 * rainAmt * Math.min(1, 2 / tz);
        for (let k = 0; k < len; k++) { const yy = y + k; if (yy >= 0 && yy < H && depth[yy * W + x] > tz) addPix(x, yy, [170, 190, 230], a); }
      } else if (y >= 0 && y < H && depth[y * W + x] > tz) {
        const a = (w.kind === 'snow' ? 0.6 : 0.55) * Math.min(1, 2.5 / tz), col = w.kind === 'snow' ? [235, 240, 255] : w.col;
        addPix(x, y, col, a);
        if (tz < 1.6) { addPix(x + 1, y, col, a * 0.7); if (w.kind === 'snow') { addPix(x, y + 1, col, a * 0.7); addPix(x + 1, y + 1, col, a * 0.5); } }
      }
    }
  }

  // ---------------------------------------------------------------- the night's wandering, drawn in the stars
  function drawConstellation(t) {
    if (!resting || resting < 1 || clock - restAt < 12 || trace.length < 4) return;
    if (!constellation) {
      // keep the turns of the way we came, and lay them out over the sky beside the moon
      const pts = [trace[0]];
      for (let i = 1; i < trace.length - 1; i++) {
        const a = pts[pts.length - 1], b = trace[i], c = trace[i + 1];
        const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
        if (Math.abs(wrapPi(t2 - t1)) > 0.5 && Math.hypot(b[0] - a[0], b[1] - a[1]) > 1.2) pts.push(b);
      }
      pts.push(trace[trace.length - 1]);
      const sel = pts.length > 40 ? pts.filter((_, i) => i % Math.ceil(pts.length / 40) === 0) : pts;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [x, y] of sel) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const az0 = walk.gazeA + (Math.abs(wrapPi(walk.gazeA - moonAz)) < 0.3 ? -0.55 : 0), el0 = Math.max(0.55, Math.min(S.camera.aspect >= 1 ? 0.88 : 1, Math.max(skyline(az0) + 0.3, walk.gazeP / 0.8 + 0.15)));
      const sc = Math.min(0.7 / Math.max(1, x1 - x0), 0.26 / Math.max(1, y1 - y0));
      constellation = { t0: clock, pts: sel.map(([x, y]) => [az0 + (x - (x0 + x1) / 2) * sc, el0 - (y - (y0 + y1) / 2) * sc]) };
    }
    const C = constellation, n = C.pts.length, shown = Math.min(n - 1, ((clock - C.t0) / 45) * (n - 1));
    const col = [220, 230, 255];
    for (let i = 0; i < Math.ceil(shown); i++) {
      const a = C.pts[i], b = C.pts[i + 1], frac = Math.min(1, shown - i);
      const steps = 40;
      for (let s = 0; s <= steps * frac; s += 1) {
        if (s % 3 === 2) continue; // a dotted line, like a star chart
        const k = s / steps, q = skyToScreen(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); if (!q) continue;
        const x = Math.floor(q[0]), y = Math.floor(q[1]); if (x < 0 || y < 0 || x >= W || y >= H || depth[y * W + x] < 1e8) continue;
        addPix(x, y, col, 0.16);
      }
    }
    for (let i = 0; i <= Math.ceil(shown) && i < n; i++) {
      const q = skyToScreen(C.pts[i][0], C.pts[i][1]); if (!q) continue;
      const x = Math.floor(q[0]), y = Math.floor(q[1]); if (x < 0 || y < 0 || x >= W || y >= H || depth[y * W + x] < 1e8) continue;
      const a = 0.7 + 0.3 * Math.sin(t * 1.3 + i), big = i === 0 || i === n - 1;
      addPix(x, y, [255, 246, 220], a); addPix(x + 1, y, [255, 246, 220], a * 0.35); addPix(x - 1, y, [255, 246, 220], a * 0.35); addPix(x, y + 1, [255, 246, 220], a * 0.35); addPix(x, y - 1, [255, 246, 220], a * 0.35);
      if (big) glowAtScreen(x, y, 2.5, [255, 236, 200], 0.4);
    }
  }
  function glowAtScreen(cx, cy, r, col, amt) {
    for (let y = Math.floor(cy - r * 2); y <= cy + r * 2; y++) for (let x = Math.floor(cx - r * 2); x <= cx + r * 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || depth[y * W + x] < 1e8) continue;
      const q = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r); addPix(x, y, col, Math.exp(-q) * amt);
    }
  }

  // ---------------------------------------------------------------- changing dreams
  let heardMusic = false, lastDream = 0;
  function changeDream(k) {
    if (resting > 0 || k === dreamK) return;
    if (buf && clock > 1.5) {
      old = buf.slice();
      const y = new Float32Array(W), s = H / 200;
      y[0] = -rand() * 14 * s;
      for (let x = 1; x < W; x++) { const step = (x % 2) ? 0 : (rand() * 3 - 1) * s * 1.5; y[x] = Math.max(-16 * s, Math.min(0, (x % 2 ? y[x - 1] : y[x - 1] + step))); }
      melt = { y };
    }
    buildDream(k); lastDream = clock; whaleS = null;
  }
  S.onEvent((ev) => {
    if (ev.type === 'dream') { heardMusic = true; changeDream(ev.k % DREAMS.length); }
    else if (ev.type === 'chime') { wisp.pulse = Math.min(1, wisp.pulse + 0.6); }
    else if (ev.type === 'whale') { heardMusic = true; startWhale(); }
    else if (ev.type === 'weather') { heardMusic = true; if (D.weather?.showers) { rainTarget = ev.amt ?? 1; rainUntil = clock + (ev.dur ?? 60); } }
  });

  // ---------------------------------------------------------------- each frame
  buildDream(Math.floor(rand() * DREAMS.length));
  S.on((t, dt, st) => {
    clock = t; energy = st.energy;
    const e = energy;
    resize();
    dt = Math.min(dt, 0.1);
    // with no music to lead, change the dreams, the weather and the whale ourselves now and then
    if (!heardMusic) {
      if (t - lastDream > 300 && e > 0.3) changeDream((dreamK + 1 + Math.floor(rand() * (DREAMS.length - 1))) % DREAMS.length);
      if ((whaleDue -= dt) < 0) { whaleDue = 160 + rand() * 120; startWhale(); }
      if (D.weather?.showers && (showerDue -= dt) < 0) { showerDue = 200 + rand() * 200; rainTarget = 0.6 + rand() * 0.4; rainUntil = clock + 50 + rand() * 40; }
    }
    stepDoors(dt);
    stepShift(dt);
    stepWalk(dt, e);
    portalStep();
    stepDeer(dt);
    if (walk.state !== 'loop') { const last = trace[trace.length - 1]; if (Math.hypot(px - last[0], py - last[1]) > 0.6) trace.push([px, py]); }
    // the view: Doom's bob as you walk, easing up and down the steps
    bobPh += speed * dt * 5.2;
    const cNow = cellAt(px, py);
    const fz = FL[cNow] + EYE * (1 - resting * 0.45) + Math.abs(Math.sin(bobPh)) * 0.022 * Math.min(1, speed * 1.5) - 0.011;
    eyeZ += (fz - eyeZ) * Math.min(1, dt * 6);
    eyeZ = Math.max(FL[cNow] + 0.12, Math.min(CE[cNow] - 0.08, eyeZ));
    // lantern, wisp, lights
    lanternI = (0.15 + 0.1 * e) * (1 - resting * 0.85) * (0.95 + 0.05 * Math.sin(t * 11) * Math.sin(t * 5.3));
    for (const i of map.flicker) LIGHTE[i] = LIGHT[i] * (0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * 8.1 + i) * Math.sin(t * 5.3 + i * 0.7)));
    wisp.pulse = Math.max(0, wisp.pulse - dt * 0.5);
    wispI = (0.3 + 0.18 * e + wisp.pulse * 0.3) * (1 - resting * 0.5);
    let wx, wy, wz;
    if (walk.state === 'walk' && walk.path) { const q = pointAt(walk.s + 1.6 + 0.3 * Math.sin(t * 0.6)); wx = q[0]; wy = q[1]; wz = eyeZ + 0.06 + Math.sin(t * 1.3) * 0.06; }
    else if (walk.state === 'loop') { wx = px + walk.loopDir * 1.4; wy = py + Math.sin(t * 0.9) * 0.2; wz = eyeZ + 0.1 + (walk.loop.rise ? walk.loopDir * 1.4 * walk.loop.rise : 0); }
    else { const r = 0.9 + 0.2 * Math.sin(t * 0.3); wx = px + Math.cos(moonAz + Math.sin(t * 0.4) * 0.5) * r; wy = py + Math.sin(moonAz + Math.sin(t * 0.4) * 0.5) * r; wz = eyeZ + 0.25 + Math.sin(t * 0.8) * 0.08 - resting * 0.15; }
    const c = cellAt(wx, wy);
    if (c >= 0 && c < map.NN && KIND[c] !== WALL && KIND[c] !== PORTAL) wz = Math.max(FL[c] + 0.15, Math.min(CE[c] - 0.1, wz));
    const kk = Math.min(1, dt * 1.6);
    wisp.x += (wx - wisp.x) * kk; wisp.y += (wy - wisp.y) * kk; wisp.z += (wz - wisp.z) * kk;
    if (rand() < dt * 14) trail.push({ x: wisp.x + (rand() - 0.5) * 0.06, y: wisp.y + (rand() - 0.5) * 0.06, z: wisp.z + (rand() - 0.5) * 0.06, a: 0.5, vz: -0.04 - rand() * 0.06 });
    for (let i = trail.length - 1; i >= 0; i--) { const s = trail[i]; s.a -= dt * 0.35; s.z += s.vz * dt; if (s.a <= 0) trail.splice(i, 1); }
    gatherLights(t);
    // floating things
    for (const th of map.things) if (th.kind === 'float') {
      const a = th.ph + t * th.sp, nx = th.home[0] + Math.cos(a) * th.rx, ny = th.home[1] + Math.sin(a * 1.3) * th.ry;
      const vx = nx - th.x, vy = ny - th.y;
      th.x = nx; th.y = ny; th.z = th.base + 0.5 + 0.22 * Math.sin(t * 0.5 + th.ph);
      th.frame = Math.floor(t * (D.id === 'library' ? 2.2 : 1.6) + th.ph) % 2;
      th.flip = (-vx * sa + vy * ca) < 0;
    }
    // motes drift round the dreamer
    for (const m of motes) {
      if (m.fresh || Math.hypot(m.x - px, m.y - py) > 5) {
        const a = rand() * TAU, r = m.fresh ? rand() * 5 : 4.5;
        m.x = px + Math.cos(a) * r; m.y = py + Math.sin(a) * r; m.fresh = false;
        const ci = cellAt(m.x, m.y); m.z = ci >= 0 && ci < map.NN && KIND[ci] !== WALL ? FL[ci] + 0.15 + rand() * 0.9 : eyeZ;
      }
      m.x += Math.sin(t * m.sp + m.ph) * dt * 0.08; m.y += Math.cos(t * m.sp * 0.8 + m.ph) * dt * 0.08; m.z += Math.sin(t * m.sp * 1.3 + m.ph * 2) * dt * 0.05;
    }
    stepWeather(dt, t);
    cloudOff = Math.floor(t * 1.2);
    if ((shootDue -= dt) < 0) { shootDue = 25 + rand() * 50; const az = camA + (rand() - 0.5) * 1.2; shoot = { t0: t, dur: 0.9 + rand() * 0.5, az, el: 0.5 + rand() * 0.6, daz: (rand() < 0.5 ? -1 : 1) * (0.25 + rand() * 0.2), del: -0.15 - rand() * 0.15 }; }

    render(t, dt);
    tex.needsUpdate = true;
    const hgt = 2 * Math.tan((S.camera.fov * Math.PI) / 360);
    quad.scale.set(hgt * S.camera.aspect, hgt, 1);
  });

  S.scene.userData.maze = {
    get state() { return { dream: D.id, walk: walk.state, px, py, camA, pitch, resting, W, H, melt: !!melt, loops: walk.loopsDone, rain: rainAmt, whale: !!whaleS, paints: !!paints, constellation: !!constellation, trace: trace.length }; },
    get map() { return map; },
    change: (k) => changeDream(k),
    whale: startWhale,
    rain(a = 1, d = 60) { rainTarget = a; rainUntil = clock + d; rainAmt = a; },
    goLoop(k = 0) { const lp = map.loops[k]; if (!lp) return false; px = (lp.mid % N) + 0.5; py = Math.floor(lp.mid / N) + 0.5; eyeZ = FL[lp.mid] + EYE; walk.loop = lp; walk.state = 'loop'; walk.loopDir = 1; walk.loopLeft = lp.L * 2; camA = 0; return true; },
    setPose(x, y, a, p = 0) { px = x; py = y; camA = a; pitch = p; eyeZ = FL[cellAt(x, y)] + EYE; walk.path = null; walk.state = 'pause'; walk.wait = 999; walk.lookA = a; },
  };
  return S.finalize({ portraitFov: 50 });
}
