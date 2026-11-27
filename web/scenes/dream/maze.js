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
// Everything in it is made in code: the textures, the sprites, the skies (stars, the Milky Way, a
// big moon with its halo, an aurora over the temple), the labyrinth itself (maze-map.js). Four
// dreams: a hedge garden under the moon with koi swimming through the air, an endless library of
// candles and drifting books, a sunken temple of glowing runes and still pools, and halls of
// glass and marble. A will-o'-the-wisp leads the way and lights the walls as it passes. In the
// courtyards the dreamer stops to look up at the moon. Late in the night the walking slows, and at
// last they sit down by a moonlit pool, put the lantern down, and just look at the sky.
import { createStage, THREE } from '../kit.js';
import { DREAMS, noiser, makeSky, makeClouds, heldLantern, TS, SKY_W, SKY_H, EL0, EL1, CL_W, CL_H, CL_EL1, hx } from './maze-tex.js';
import { buildMaze, distances, route, WALL, DOOR } from './maze-map.js';

const TAU = Math.PI * 2;
const MAXD = 34, EYE = 0.56;
const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const c8 = (v) => (v > 255 ? 255 : v < 0 ? 0 : v | 0);

export function createMazeScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xd0e, bg: '#000000', exposure: 1, bloom: [0.6, 0.42, 0.6], finish: { vignette: 0.3, grain: 0.012, ca: 0.2 }, fov: 50 });
  const { rand } = S;

  // ---------------------------------------------------------------- the pixel buffer, shown full screen
  let W = 0, H = 0, buf = null, depth = null, old = null, tex = null, f = 1, hz = 0;
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
    buf = new Uint32Array(W * H); depth = new Float32Array(W * H); old = null; melt = null;
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

  // ---------------------------------------------------------------- the dream: its textures, sky and labyrinth
  const built = new Map();
  let D, set, SKY, CLOUD, map, N, KIND, FL, CE, SKYC, WATER, LIGHT, LIGHTE, WT, FT, CT;
  let FR = 0, FG = 0, FB = 0, FOGC = 0, T0 = 1, T1 = 1, T2 = 1, moonAz = 0, moonEl = 0.6, dreamK = -1, dreamNo = 0;
  let stars = [], cloudCol = [0, 0, 0];
  function buildDream(k) {
    D = DREAMS[k]; dreamK = k; dreamNo++;
    if (!built.has(D.id)) {
      const n = noiser((seed * 2654435761 + k * 977) >>> 0);
      built.set(D.id, { set: D.build(n), sky: makeSky(n, D.sky), clouds: makeClouds(n, D.sky.clouds) });
    }
    ({ set, sky: SKY, clouds: CLOUD } = built.get(D.id));
    const mapNoise = noiser((seed * 31 + dreamNo * 7919) >>> 0);
    map = buildMaze(rand, D, set, mapNoise);
    ({ N, kind: KIND, fl: FL, ce: CE, sky: SKYC, water: WATER, light: LIGHT, wt: WT, ft: FT, ct: CT } = map);
    LIGHTE = LIGHT.slice();
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
    // the dreamer arrives
    const [sx, sy] = map.start;
    px = sx + 0.5; py = sy + 0.5; eyeZ = FL[map.at(sx, sy)] + EYE;
    walk.path = null; walk.state = 'walk'; walk.wait = 0; walk.recent = [];
    planRoute(false);
    if (walk.path) { const p = pointAt(0.8); camA = Math.atan2(p[1] - py, p[0] - px); }
    wisp.x = px + Math.cos(camA) * 1.5; wisp.y = py + Math.sin(camA) * 1.5; wisp.z = eyeZ;
    titleAt = clock; titleMask = null;
  }

  // ---------------------------------------------------------------- the walk
  let px = 0, py = 0, camA = 0, pitch = 0, eyeZ = 0.5, bobPh = 0, speed = 0, clock = 0, energy = 1, resting = 0;
  const walk = { path: null, cum: null, s: 0, seg: 0, state: 'walk', wait: 0, recent: [], room: -1 };
  const wisp = { x: 0, y: 0, z: 0, pulse: 0, I: 0.9 };
  const cellAt = (x, y) => Math.floor(y) * N + Math.floor(x);
  function planRoute(preferSky) {
    const from = cellAt(px, py), d = distances(map, from);
    let best = null, bs = -1e9;
    map.rooms.forEach((r, k) => {
      if (walk.recent.includes(k)) return;
      const cells = [];
      for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) { const i = y * N + x; if (d[i] > 0 && KIND[i] !== DOOR) cells.push(i); }
      if (!cells.length) return;
      const i = cells[Math.floor(rand() * cells.length)];
      const sc = -Math.abs(d[i] - 18) + rand() * 12 + (preferSky && SKYC[i] ? 60 - d[i] : 0);
      if (sc > bs) { bs = sc; best = { i, k }; }
    });
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
    walk.path = pts; walk.cum = cum; walk.s = 0; walk.seg = 0; walk.room = best.k;
    if (best.k >= 0) { walk.recent.push(best.k); if (walk.recent.length > Math.min(4, map.rooms.length - 1)) walk.recent.shift(); }
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
  function stepWalk(dt, e) {
    if (!walk.path) { planRoute(e < 0.28); if (!walk.path) return; }
    const L = walk.cum[walk.cum.length - 1];
    if (walk.state === 'walk') {
      // a door just ahead that hasn't finished opening: wait for it
      let blocked = false;
      for (const ds of [0.45, 0.8]) { const q = pointAt(walk.s + ds), c = cellAt(q[0], q[1]); if (KIND[c] === DOOR) { const dr = map.doors.find((o) => o.i === c); if (dr && dr.open < 0.9) blocked = true; } }
      const ahead = pointAt(walk.s + 0.9), want = Math.atan2(ahead[1] - py, ahead[0] - px), turn = Math.abs(wrapPi(want - camA));
      const vmax = (0.55 + 0.6 * e) * (resting ? 0.8 : 1);
      const target = blocked ? 0 : vmax * Math.max(0.25, Math.cos(Math.min(1.5, turn)));
      speed += (target - speed) * Math.min(1, dt * 2.5);
      walk.s = Math.min(L, walk.s + speed * dt);
      const p = pointAt(walk.s); px = p[0]; py = p[1];
      camA += wrapPi(want - camA) * Math.min(1, dt * 2.2);
      pitch += (0 - pitch) * Math.min(1, dt * 0.8);
      if (walk.s >= L - 0.02) {
        speed = 0;
        const c = cellAt(px, py);
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
      if (walk.state === 'rest') { resting = Math.min(1, resting + dt / 8); return; }
      if (walk.wait <= 0) { walk.state = 'walk'; planRoute(e < 0.28); }
    }
  }
  /** How high the walls and roofs stand in a direction: the elevation you'd have to look above to see sky. */
  function skyline(az) {
    let hi = -1, lastCe = CE[cellAt(px, py)];
    const dx = Math.cos(az), dy = Math.sin(az);
    for (let d = 0.3; d < 14; d += 0.12) {
      const c = cellAt(px + dx * d, py + dy * d);
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

  // ---------------------------------------------------------------- light: Doom's falloff, our fog, a lantern and a wisp
  let LR = 0, LG = 0, LB = 0, FA = 0, lanternI = 0.5, WR2 = 4.4, WC0 = 0, WC1 = 0, WC2 = 0, wispI = 0;
  function lightTerms(Lc, d) {
    const vis = Math.max(0, Math.min(1, 1.3 - d * D.fogD * 2.1));
    const l = Math.floor(Lc * vis * 0.85 * 32) / 32; // banded, like Doom's colormaps
    const fa = 1 - Math.exp(-d * D.fogD * 1.4), k = 1 - fa;
    const lan = lanternI / (1 + d * d * 1.6);
    LR = (l * T0 + lan) * k; LG = (l * T1 + lan * 0.74) * k; LB = (l * T2 + lan * 0.45) * k; FA = fa;
  }
  function shade(c, g, lr, lg, lb, fa) {
    const r = c & 255, gg = (c >> 8) & 255, b = (c >> 16) & 255;
    let R = r * lr + FR * fa, G = gg * lg + FG * fa, B = b * lb + FB * fa;
    if (g) { const k = (g / 255) * (1 - fa * 0.6); R += (r * 1.05 - R) * k; G += (gg * 1.05 - G) * k; B += (b * 1.05 - B) * k; }
    return (255 << 24) | (c8(B) << 16) | (c8(G) << 8) | c8(R);
  }
  const wallTex = (i) => { const w = WT[i]; return w >= 200 ? set.upper : w >= 100 ? set.special[w - 100] : set.walls[w]; };

  // ---------------------------------------------------------------- spans
  function wallSpan(x, ya, yb, T, tu, d, Lc, peg, hx0, hy0) {
    lightTerms(Lc, d);
    const k = (d / f) * TS;
    let tv = -(eyeZ - (ya + 0.5 - hz) * (d / f) - peg) * TS;
    const wdx = hx0 - wisp.x, wdy = hy0 - wisp.y, wh2 = wdx * wdx + wdy * wdy, useW = wispI > 0 && wh2 < WR2;
    const px_ = T.px, gl = T.glow;
    for (let y = ya, p = ya * W + x; y < yb; y++, tv += k, p += W) {
      const ti = ((Math.floor(tv) & 63) << 6) | tu;
      let lr = LR, lg = LG, lb = LB;
      if (useW) { const z = eyeZ - (y + 0.5 - hz) * (d / f) - wisp.z, q = 1 - (wh2 + z * z) / WR2; if (q > 0) { const w = q * q * wispI * (1 - FA); lr += WC0 * w; lg += WC1 * w; lb += WC2 * w; } }
      buf[p] = shade(px_[ti], gl ? gl[ti] : 0, lr, lg, lb, FA);
      depth[p] = d;
    }
  }
  function flatSpan(x, ya, yb, cell, h, ceil, rdx, rdy, t) {
    const T = ceil ? (CT[cell] ? set.hallCeil : set.ceil) : set.floor[FT[cell]];
    const dz = ceil ? h - eyeZ : eyeZ - h, Lc = LIGHTE[cell], wet = !ceil && WATER[cell];
    const px_ = T.px, gl = T.glow;
    for (let y = ya, p = ya * W + x; y < yb; y++, p += W) {
      const d = dz * Math.abs(rowInv[y]);
      const wx = px + rdx * d, wy = py + rdy * d;
      lightTerms(Lc, d);
      let lr = LR, lg = LG, lb = LB;
      if (wispI > 0) { const ax = wx - wisp.x, ay = wy - wisp.y, az = h - wisp.z, q = 1 - (ax * ax + ay * ay + az * az) / WR2; if (q > 0) { const w = q * q * wispI * (1 - FA); lr += WC0 * w; lg += WC1 * w; lb += WC2 * w; } }
      if (wet) {
        // still water: the sky, upside down, trembling
        const rip = (Math.sin(wy * 9 + t * 1.3) + Math.sin(wx * 7.3 - t * 0.9) * 0.7) / (1 + d * 0.25);
        const u = (colU[x] + Math.round(rip * 3)) & (SKY_W - 1), v = Math.max(0, Math.min(SKY_H - 1, rowMirV[y] + Math.round(rip * 1.5)));
        const c = SKY.px[v * SKY_W + u], k = (1 - FA) * (WATER[cell] === 2 ? 0.8 : 0.55);
        const sh = 0.75 + 0.25 * rip;
        let R = (c & 255) * k * sh + FR * FA, G = ((c >> 8) & 255) * k * sh + FG * FA, B = ((c >> 16) & 255) * k * sh + FB * FA;
        R += (lr - LR) * 90; G += (lg - LG) * 90; B += (lb - LB) * 90; // the wisp on the water
        buf[p] = (255 << 24) | (c8(B * 1.05 + 4) << 16) | (c8(G + 6) << 8) | c8(R);
      } else {
        const ti = ((Math.floor(wy * TS) & 63) << 6) | (Math.floor(wx * TS) & 63);
        buf[p] = shade(px_[ti], gl ? gl[ti] : 0, lr, lg, lb, FA);
      }
      depth[p] = d;
    }
  }
  let cloudOff = 0;
  function skySpan(x, ya, yb) {
    const u = colU[x], cu = (u >> 1);
    const daz = wrapPi(colAz[x] - moonAz);
    for (let y = ya, p = ya * W + x; y < yb; y++, p += W) {
      let c = SKY.px[rowSkyV[y] * SKY_W + u];
      const cv = rowCloudV[y];
      if (cv >= 0) {
        const a = CLOUD[cv * CL_W + ((cu + cloudOff) & (CL_W - 1))];
        if (a) {
          const de = rowEl[y] - moonEl, ce_ = Math.cos(rowEl[y]), prox = Math.exp(-(daz * daz * ce_ * ce_ + de * de) * 5);
          const k = a / 255, lit = 0.55 + prox * 1.6;
          const R = (c & 255) * (1 - k) + cloudCol[0] * lit * k + 200 * prox * k, G = ((c >> 8) & 255) * (1 - k) + cloudCol[1] * lit * k + 196 * prox * k, B = ((c >> 16) & 255) * (1 - k) + cloudCol[2] * lit * k + 190 * prox * k;
          c = (255 << 24) | (c8(B) << 16) | (c8(G) << 8) | c8(R);
        }
      }
      buf[p] = c; depth[p] = 1e9;
    }
  }

  // ---------------------------------------------------------------- one column, front to back (Doom's way, clipping as it goes)
  function column(x, t) {
    const rdx = colRX[x], rdy = colRY[x];
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
    let sx, sy, stx, sty;
    if (rdx < 0) { stx = -1; sx = (px - mx) * ddx; } else { stx = 1; sx = (mx + 1 - px) * ddx; }
    if (rdy < 0) { sty = -1; sy = (py - my) * ddy; } else { sty = 1; sy = (my + 1 - py) * ddy; }
    let cur = my * N + mx, top = 0, bot = H, d1 = 0, side = 0;
    for (let it = 0; it < 90; it++) {
      if (sx < sy) { d1 = sx; sx += ddx; mx += stx; side = 0; } else { d1 = sy; sy += ddy; my += sty; side = 1; }
      if (d1 < 0.02) d1 = 0.02;
      const fh = FL[cur], ch = CE[cur];
      const yC = hz - ((ch - eyeZ) * f) / d1, yF = hz + ((eyeZ - fh) * f) / d1;
      const rc = Math.min(bot, Math.ceil(yC - 0.5));
      if (rc > top) { if (SKYC[cur]) skySpan(x, top, rc); else flatSpan(x, top, rc, cur, ch, true, rdx, rdy, t); top = rc; }
      const rf = Math.max(top, Math.ceil(yF - 0.5));
      if (rf < bot) { flatSpan(x, rf, bot, cur, fh, false, rdx, rdy, t); bot = rf; }
      if (top >= bot) return;
      if (d1 > MAXD || mx < 0 || my < 0 || mx >= N || my >= N) break;
      const nx = my * N + mx, k = KIND[nx];
      let wu = side === 0 ? py + d1 * rdy : px + d1 * rdx; wu -= Math.floor(wu);
      let tu = (wu * TS) | 0; if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tu = 63 - tu;
      const hx0 = px + rdx * d1, hy0 = py + rdy * d1, Lc = LIGHTE[cur] * (side ? 0.88 : 1.08);
      if (k === WALL) { wallSpan(x, top, bot, wallTex(nx), tu, d1, Lc, 0, hx0, hy0); return; }
      const nf = FL[nx], nc = CE[nx];
      if (nc < ch && !(SKYC[cur] && SKYC[nx])) {
        const b = Math.min(bot, Math.ceil(hz - ((nc - eyeZ) * f) / d1 - 0.5));
        if (b > top) {
          if (k === DOOR) { // the door itself, pegged to its bottom edge so it slides up with it; the lintel above
            const m = Math.max(top, Math.min(b, Math.ceil(hz - ((nc + 1 - eyeZ) * f) / d1 - 0.5)));
            if (m > top) wallSpan(x, top, m, set.upper, tu, d1, Lc, 0, hx0, hy0);
            if (b > m) wallSpan(x, m, b, set.door, tu, d1, Lc, nc, hx0, hy0);
          } else wallSpan(x, top, b, set.upper, tu, d1, Lc, 0, hx0, hy0);
          top = b;
        }
      }
      if (nf > fh) {
        const a = Math.max(top, Math.ceil(hz + ((eyeZ - nf) * f) / d1 - 0.5));
        if (a < bot) { wallSpan(x, a, bot, set.step, tu, d1, Lc, 0, hx0, hy0); bot = a; }
      }
      if (top >= bot) return;
      cur = nx;
    }
    for (let y = top, p = top * W + x; y < bot; y++, p += W) { buf[p] = FOGC; depth[p] = MAXD; }
  }

  // ---------------------------------------------------------------- things (billboards), the wisp, motes, stars
  let ca = 1, sa = 0;
  function sprite(T, wx, wy, z, w, h, { Lc = 0.6, flip = false, add = 0, frameT = null } = {}) {
    T = frameT || T;
    const dx = wx - px, dy = wy - py, tz = dx * ca + dy * sa;
    if (tz < 0.15 || tz > MAXD) return;
    const tx = -dx * sa + dy * ca, sc = f / tz, cx = W / 2 + tx * sc, wp = w * sc, hp = h * sc;
    const left = cx - wp / 2, yT = hz - (z + h - eyeZ) * sc;
    const x0 = Math.max(0, Math.ceil(left - 0.5)), x1 = Math.min(W, Math.ceil(left + wp - 0.5));
    const y0 = Math.max(0, Math.ceil(yT - 0.5)), y1 = Math.min(H, Math.ceil(yT + hp - 0.5));
    if (x1 <= x0 || y1 <= y0) return;
    lightTerms(Lc, tz);
    let lr = LR, lg = LG, lb = LB;
    if (wispI > 0) { const ax = wx - wisp.x, ay = wy - wisp.y, az = z + h / 2 - wisp.z, q = 1 - (ax * ax + ay * ay + az * az) / WR2; if (q > 0) { const ww = q * q * wispI * (1 - FA); lr += WC0 * ww; lg += WC1 * ww; lb += WC2 * ww; } }
    const tw = T.w, th = T.h;
    for (let c = x0; c < x1; c++) {
      let u = Math.min(tw - 1, ((c + 0.5 - left) / wp * tw) | 0); if (flip) u = tw - 1 - u;
      for (let y = y0; y < y1; y++) {
        const v = Math.min(th - 1, ((y + 0.5 - yT) / hp * th) | 0), i = v * tw + u;
        if (!T.alpha[i]) continue;
        const p = y * W + c;
        if (depth[p] <= tz) continue;
        if (add) {
          const s = T.px[i], o = buf[p], k = add * (1 - FA * 0.8) * (T.glow ? 0.35 + (T.glow[i] / 255) * 0.65 : 1);
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
  let motes = [];
  const trail = [];
  let shoot = null, shootDue = 20;

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
    for (let x = 0; x < W; x++) column(x, t);

    // twinkling stars and the odd shooting star, wherever the sky shows
    const hf = Math.atan((W / 2) / f) + 0.05;
    for (const s of stars) {
      const da = wrapPi(s.az - camA); if (Math.abs(da) > hf) continue;
      const x = Math.floor(W / 2 + f * Math.tan(da)), y = Math.floor(hz - f * Math.tan(s.el));
      if (x < 0 || y < 0 || x >= W || y >= H || depth[y * W + x] < 1e8) continue;
      const tw = s.sp ? 0.5 + 0.5 * Math.sin(t * s.sp + s.ph) : 0.85, a = s.b * tw * tw, col = s.col;
      addPix(x, y, col, a);
      if (a > 0.75) { addPix(x + 1, y, col, a * 0.3); addPix(x - 1, y, col, a * 0.3); addPix(x, y + 1, col, a * 0.3); addPix(x, y - 1, col, a * 0.3); }
    }
    if (shoot) {
      const k = (t - shoot.t0) / shoot.dur;
      if (k > 1) shoot = null;
      else for (let j = 0; j < 14; j++) {
        const kk = k - j * 0.012; if (kk < 0) break;
        const az = shoot.az + shoot.daz * kk, el = shoot.el + shoot.del * kk, da = wrapPi(az - camA);
        if (Math.abs(da) > hf) continue;
        const x = Math.floor(W / 2 + f * Math.tan(da)), y = Math.floor(hz - f * Math.tan(el));
        if (x < 0 || y < 0 || x >= W || y >= H || depth[y * W + x] < 1e8) continue;
        addPix(x, y, [255, 250, 235], (1 - j / 14) * Math.sin(Math.PI * k) * 0.95);
      }
    }

    // things, far to near
    const vis = [];
    for (const th of map.things) {
      const dx = th.x - px, dy = th.y - py, tz = dx * ca + dy * sa;
      if (tz > 0.15 && tz < MAXD) vis.push([tz, th]);
    }
    vis.sort((a, b) => b[0] - a[0]);
    for (const [, th] of vis) {
      const Lc = Math.max(LIGHTE[cellAt(th.x, th.y)], th.glowy ? 0.8 : 0);
      if (th.kind === 'float') sprite(th.spr, th.x, th.y, th.z, th.w, th.h, { Lc: Lc + 0.15, flip: th.flip, frameT: th.frames[th.frame], add: D.id === 'temple' ? 0.8 : D.id === 'glass' ? 0.5 : 0 });
      else if (th.kind === 'hang') sprite(th.spr, th.x + Math.sin(t * 0.7 + th.swing) * 0.02, th.y, th.z, th.w, th.h, { Lc: 0.9 });
      else sprite(th.spr, th.x, th.y, th.z, th.w, th.h, { Lc });
    }
    // the wisp and its trail of sparks
    const pul = 0.75 + 0.25 * Math.sin(t * 2.3) + wisp.pulse;
    for (const s of trail) glowAt(s.x, s.y, s.z, 0.012, D.wisp, s.a);
    glowAt(wisp.x, wisp.y, wisp.z, 0.045 * (0.9 + 0.2 * pul), D.wisp, 0.9 * pul * (1 - resting * 0.4));
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
  function addPix(x, y, col, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x, o = buf[p];
    buf[p] = (255 << 24) | (c8(((o >> 16) & 255) + col[2] * a) << 16) | (c8(((o >> 8) & 255) + col[1] * a) << 8) | c8((o & 255) + col[0] * a);
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
    buildDream(k); lastDream = clock;
  }
  S.onEvent((ev) => {
    if (ev.type === 'dream') { heardMusic = true; changeDream(ev.k % DREAMS.length); }
    else if (ev.type === 'chime') { wisp.pulse = Math.min(1, wisp.pulse + 0.6); }
  });

  // ---------------------------------------------------------------- each frame
  buildDream(Math.floor(rand() * DREAMS.length));
  S.on((t, dt, st) => {
    clock = t; energy = st.energy;
    const e = energy;
    resize();
    dt = Math.min(dt, 0.1);
    // with no music to choose the dreams, change them ourselves now and then
    if (!heardMusic && t - lastDream > 300 && e > 0.3) changeDream((dreamK + 1 + Math.floor(rand() * (DREAMS.length - 1))) % DREAMS.length);
    stepDoors(dt);
    stepWalk(dt, e);
    // the view: Doom's bob as you walk, easing up and down the steps
    bobPh += speed * dt * 5.2;
    const fz = FL[cellAt(px, py)] + EYE * (1 - resting * 0.45) + Math.abs(Math.sin(bobPh)) * 0.022 * Math.min(1, speed * 1.5) - 0.011;
    eyeZ += (fz - eyeZ) * Math.min(1, dt * 6);
    eyeZ = Math.max(FL[cellAt(px, py)] + 0.12, Math.min(CE[cellAt(px, py)] - 0.08, eyeZ));
    // lantern, wisp and lit corners
    lanternI = (0.15 + 0.1 * e) * (1 - resting * 0.85) * (0.95 + 0.05 * Math.sin(t * 11) * Math.sin(t * 5.3));
    for (const i of map.flicker) LIGHTE[i] = LIGHT[i] * (0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * 8.1 + i) * Math.sin(t * 5.3 + i * 0.7)));
    const breathe = 1 + 0.04 * Math.sin(t * 0.2);
    [WC0, WC1, WC2] = D.wisp.map((v) => (v / 255) * breathe);
    wisp.pulse = Math.max(0, wisp.pulse - dt * 0.5);
    wispI = (0.32 + 0.22 * e + wisp.pulse * 0.35) * (1 - resting * 0.5);
    let wx, wy, wz;
    if (walk.state === 'walk' && walk.path) { const q = pointAt(walk.s + 1.6 + 0.3 * Math.sin(t * 0.6)); wx = q[0]; wy = q[1]; wz = eyeZ + 0.06 + Math.sin(t * 1.3) * 0.06; }
    else { const r = 0.9 + 0.2 * Math.sin(t * 0.3); wx = px + Math.cos(moonAz + Math.sin(t * 0.4) * 0.5) * r; wy = py + Math.sin(moonAz + Math.sin(t * 0.4) * 0.5) * r; wz = eyeZ + 0.25 + Math.sin(t * 0.8) * 0.08 - resting * 0.15; }
    const c = cellAt(wx, wy);
    if (KIND[c] !== WALL) wz = Math.max(FL[c] + 0.15, Math.min(CE[c] - 0.1, wz));
    const kk = Math.min(1, dt * 1.6);
    wisp.x += (wx - wisp.x) * kk; wisp.y += (wy - wisp.y) * kk; wisp.z += (wz - wisp.z) * kk;
    if (rand() < dt * 14) trail.push({ x: wisp.x + (rand() - 0.5) * 0.06, y: wisp.y + (rand() - 0.5) * 0.06, z: wisp.z + (rand() - 0.5) * 0.06, a: 0.5, vz: -0.04 - rand() * 0.06 });
    for (let i = trail.length - 1; i >= 0; i--) { const s = trail[i]; s.a -= dt * 0.35; s.z += s.vz * dt; if (s.a <= 0) trail.splice(i, 1); }
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
        const ci = cellAt(m.x, m.y); m.z = KIND[ci] !== WALL ? FL[ci] + 0.15 + rand() * 0.9 : eyeZ;
      }
      m.x += Math.sin(t * m.sp + m.ph) * dt * 0.08; m.y += Math.cos(t * m.sp * 0.8 + m.ph) * dt * 0.08; m.z += Math.sin(t * m.sp * 1.3 + m.ph * 2) * dt * 0.05;
    }
    cloudOff = Math.floor(t * 1.2);
    if ((shootDue -= dt) < 0) { shootDue = 25 + rand() * 50; const az = camA + (rand() - 0.5) * 1.2; shoot = { t0: t, dur: 0.9 + rand() * 0.5, az, el: 0.5 + rand() * 0.6, daz: (rand() < 0.5 ? -1 : 1) * (0.25 + rand() * 0.2), del: -0.15 - rand() * 0.15 }; }

    render(t, dt);
    tex.needsUpdate = true;
    const hgt = 2 * Math.tan((S.camera.fov * Math.PI) / 360);
    quad.scale.set(hgt * S.camera.aspect, hgt, 1);
  });

  S.scene.userData.maze = { get state() { return { dream: D.id, walk: walk.state, px, py, camA, pitch, resting, W, H, melt: !!melt }; }, change: (k) => changeDream(k), setPose(x, y, a, p = 0) { px = x; py = y; camA = a; pitch = p; walk.path = null; } };
  return S.finalize({ portraitFov: 50 });
}
