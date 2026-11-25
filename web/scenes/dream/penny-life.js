// Penny's life: everything that lets her be a cat rather than a figure on a track.
//
//  - A floor map of the room for finding her way round the furniture (A* on a 10 cm grid, then
//    smoothed), plus raised spots she jumps up to: the sofa, the window seat, her basket, a box.
//  - The things in the room: a ball of yarn that rolls and bounces when she bats it, water and
//    food bowls, a scratching post, a cardboard box, a mouse that peeks out of its hole (and now
//    and then dashes to the other one), and a canary in a cage that sometimes slips out and
//    flutters round the room.
//  - Her mind: needs that rise and fall (sleep, thirst, hunger, play, curiosity), a choice of what
//    to do next weighed from them, and interruptions when the mouse or the bird appears. As the
//    night goes on she gets sleepier, and by the small hours she mostly dozes. She never catches
//    anything: this is a sleep app.
import { THREE, TAU, canvasTexture, cyl, box } from '../kit.js';

const V2 = (x, z) => ({ x, z });
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const lerp = (a, b, k) => a + (b - a) * k;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// ------------------------------------------------------------------ the floor map
function navGrid({ W, D, cell = 0.1, obstacles, pad = 0.17, wall = 0.2 }) {
  const nx = Math.round(W / cell), nz = Math.round(D / cell);
  const blocked = new Uint8Array(nx * nz), solid = new Uint8Array(nx * nz);
  const cx = (i) => -W / 2 + (i + 0.5) * cell, cz = (j) => -D / 2 + (j + 0.5) * cell;
  const inside = (o, x, z, p) => o.r != null ? Math.hypot(x - o.x, z - o.z) < o.r + p : x > o.x0 - p && x < o.x1 + p && z > o.z0 - p && z < o.z1 + p;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = cx(i), z = cz(j), k = j * nx + i;
    if (Math.abs(x) > W / 2 - wall || Math.abs(z) > D / 2 - wall) blocked[k] = 1;
    if (Math.abs(x) > W / 2 - 0.08 || Math.abs(z) > D / 2 - 0.08) solid[k] = 1;
    for (const o of obstacles) { if (inside(o, x, z, pad)) blocked[k] = 1; if (inside(o, x, z, 0.02)) solid[k] = 1; }
  }
  const idx = (x, z) => { const i = Math.floor((x + W / 2) / cell), j = Math.floor((z + D / 2) / cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
  const clampIdx = (x, z) => idx(THREE.MathUtils.clamp(x, -W / 2 + cell, W / 2 - cell), THREE.MathUtils.clamp(z, -D / 2 + cell, D / 2 - cell));
  const isBlocked = (x, z, g = blocked) => { const k = idx(x, z); return k < 0 || g[k] === 1; };
  const nearestFree = (k) => { // breadth-first out to the nearest open cell
    if (!blocked[k]) return k;
    const seen = new Uint8Array(nx * nz), q = [k]; seen[k] = 1;
    while (q.length) { const c = q.shift(); if (!blocked[c]) return c; const i = c % nx, j = (c / nx) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const n = b * nx + a; if (!seen[n]) { seen[n] = 1; q.push(n); } } }
    return k;
  };
  const clear = (a, b) => { const d = dist2(a, b), n = Math.ceil(d / (cell * 0.5)); for (let s = 1; s < n; s++) { const u = s / n; if (isBlocked(lerp(a.x, b.x, u), lerp(a.z, b.z, u))) return false; } return true; };
  function path(a, b) {
    let s = nearestFree(clampIdx(a.x, a.z)), e = nearestFree(clampIdx(b.x, b.z));
    const g = new Float32Array(nx * nz).fill(1e9), from = new Int32Array(nx * nz).fill(-1), done = new Uint8Array(nx * nz);
    const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const ei = e % nx, ej = (e / nx) | 0, h = (k) => Math.hypot(k % nx - ei, ((k / nx) | 0) - ej);
    g[s] = 0; push(s, h(s));
    while (heap.length) {
      const [, c] = pop(); if (done[c]) continue; done[c] = 1; if (c === e) break;
      const i = c % nx, j = (c / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const a2 = i + di, b2 = j + dj; if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= nz) continue;
        const n = b2 * nx + a2; if (blocked[n] || done[n]) continue;
        if (di && dj && (blocked[j * nx + a2] || blocked[b2 * nx + i])) continue; // no cutting corners
        const ng = g[c] + (di && dj ? 1.414 : 1); if (ng < g[n]) { g[n] = ng; from[n] = c; push(n, ng + h(n)); }
      }
    }
    if (from[e] < 0 && e !== s) return [V2(cx(s % nx), cz((s / nx) | 0))]; // no way there: stay put
    const cells = []; for (let k = e; k >= 0; k = from[k]) { cells.push(V2(cx(k % nx), cz((k / nx) | 0))); if (k === s) break; }
    cells.reverse();
    // pull the string tight: keep only the corners we can't see past
    const out = [V2(a.x, a.z)]; let anchor = out[0];
    for (let k = 1; k < cells.length; k++) if (!clear(anchor, cells[k])) { anchor = cells[k - 1]; out.push(anchor); }
    const bi = idx(b.x, b.z);
    out.push(bi < 0 || blocked[bi] ? cells[cells.length - 1] : V2(b.x, b.z));
    return out.slice(1);
  }
  const snap = (x, z) => { const k = nearestFree(clampIdx(x, z)); return V2(cx(k % nx), cz((k / nx) | 0)); };
  return { path, isBlocked, snap, solidAt: (x, z) => isBlocked(x, z, solid), free: (x, z) => !isBlocked(x, z) };
}

// ------------------------------------------------------------------ the ball of yarn
function yarnBall(S, { pos, color = '#c9506e', nav, W, D }) {
  const tex = canvasTexture(S, 128, 64, (g, w, h) => { g.fillStyle = color; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2; for (let k = 0; k < 40; k++) { g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 40, w * 0.7, y + (Math.random() - 0.5) * 40, w, y + (Math.random() - 0.5) * 20); g.stroke(); } g.strokeStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 30; k++) { g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 30, h); g.stroke(); } });
  const R = 0.07;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), new THREE.MeshLambertMaterial({ map: tex })); S.add(ball);
  const p = new THREE.Vector3(pos[0], R, pos[1]), v = new THREE.Vector3(), axis = new THREE.Vector3(), q = new THREE.Quaternion();
  // a loose strand trailing behind it along the floor
  const TRAIL = 24, trail = Array.from({ length: TRAIL }, () => p.clone()), tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const strand = new THREE.Line(tg, new THREE.LineBasicMaterial({ color })); strand.frustumCulled = false; S.add(strand);
  let acc = 0;
  S.on((t, dt) => {
    if (v.lengthSq() > 1e-6) {
      const nx = p.x + v.x * dt, nz = p.z + v.z * dt;
      if (nav.solidAt(nx, p.z) || Math.abs(nx) > W / 2 - R) v.x *= -0.6; else p.x = nx;
      if (nav.solidAt(p.x, nz) || Math.abs(nz) > D / 2 - R) v.z *= -0.6; else p.z = nz;
      const sp = v.length(); axis.set(v.z, 0, -v.x).normalize(); q.setFromAxisAngle(axis, (sp * dt) / R); ball.quaternion.premultiply(q);
      v.multiplyScalar(Math.exp(-dt * 1.6)); if (sp < 0.03) v.set(0, 0, 0);
    }
    ball.position.copy(p);
    acc += dt; if (acc > 0.05) { acc = 0; if (trail[0].distanceTo(p) > 0.03) { trail.pop(); trail.unshift(p.clone().setY(0.006)); } }
    const a = tg.attributes.position; trail.forEach((pt, i) => a.setXYZ(i, pt.x, i === 0 ? p.y - R * 0.6 : 0.006, pt.z)); a.needsUpdate = true;
  });
  return { pos: p, push(dir, speed) { v.set(Math.sin(dir), 0, Math.cos(dir)).multiplyScalar(speed); }, get moving() { return v.length() > 0.05; } };
}

// ------------------------------------------------------------------ the mouse and its holes
function mouseAndHoles(S, { holes, rand }) {
  const grey = S.mat('#8a8486'), pink = S.mat('#d9a0a4'), dark = S.mat('#0c0a0a');
  // the holes: dark arches in the skirting
  for (const h of holes) {
    const arch = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#070505' }));
    arch.position.set(h.x, 0.0, h.z); arch.rotation.y = h.ry; arch.position.x += Math.sin(h.ry) * 0.046; arch.position.z += Math.cos(h.ry) * 0.046; S.add(arch); // just proud of the skirting board
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.009, 6, 20, Math.PI), S.mat('#a8845e')); rim.position.copy(arch.position); rim.rotation.y = h.ry; S.add(rim); // worn pale wood round the edge
  }
  const m = new THREE.Group(); m.scale.setScalar(1.5); S.add(m); // likewise the mouse
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), grey); body.scale.set(0.032, 0.028, 0.052); body.position.set(0, 0.03, -0.02); m.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.035, 0.035); m.add(head);
  const hs = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), grey); hs.scale.set(1, 0.9, 1.25); head.add(hs);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), pink); nose.position.set(0, 0, 0.032); head.add(nose);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CircleGeometry(0.017, 14), pink); ear.position.set(sx * 0.019, 0.024, -0.004); ear.rotation.set(-0.2, sx * 0.4, 0); head.add(ear);
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.019, 14), grey); back.position.set(sx * 0.019, 0.024, -0.006); back.rotation.set(-0.2, sx * 0.4 + Math.PI, 0); head.add(back);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 6, 5), dark); eye.position.set(sx * 0.012, 0.008, 0.022); head.add(eye);
  }
  { const pts = []; for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) pts.push(sx * 0.004, -0.002, 0.03, sx * 0.04, -0.004 + k * 0.006, 0.025); const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); head.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#dddddd', transparent: true, opacity: 0.6 }))); }
  const tailPts = Array.from({ length: 10 }, (_, k) => new THREE.Vector3(0, 0.012, -0.07 - k * 0.012)), tGeo = new THREE.BufferGeometry().setFromPoints(tailPts);
  const tailLine = new THREE.Line(tGeo, new THREE.LineBasicMaterial({ color: '#c9a0a4' })); m.add(tailLine);
  m.visible = false;

  // what it is doing: 'in' (out of sight), 'peek' (head out, sniffing), 'run' (dashing to the other hole)
  const st = { mode: 'in', hole: 0, until: 25 + rand() * 30, visible: false, pos: new THREE.Vector3(), scared: false };
  let k = 0, runFrom = null, runTo = null, runU = 0;
  const place = (h, out) => { m.position.set(h.x + Math.sin(h.ry) * out, 0, h.z + Math.cos(h.ry) * out); m.rotation.y = h.ry; };
  S.on((t, dt) => {
    if (st.mode === 'in' && t > st.until) {
      st.hole = rand() < 0.5 ? 0 : 1; k = 0; st.scared = false;
      st.mode = rand() < 0.3 ? 'run' : 'peek'; st.until = t + (st.mode === 'peek' ? 4 + rand() * 4 : 99);
      if (st.mode === 'run') { runFrom = holes[st.hole]; runTo = holes[1 - st.hole]; runU = 0; }
    }
    if (st.mode === 'peek') {
      const h = holes[st.hole], leaving = t > st.until || st.scared;
      k = Math.max(0, Math.min(1, k + dt * (leaving ? -2.5 : 1.2)));
      place(h, -0.12 + k * 0.17);
      head.rotation.set(Math.sin(t * 3) * 0.15, Math.sin(t * 1.3) * 0.6, 0);
      nose.position.z = 0.032 + Math.sin(t * 30) * 0.002;
      if (leaving && k === 0) { st.mode = 'in'; st.until = t + 45 + rand() * 50; }
    } else if (st.mode === 'run') {
      // out of one hole, a quick dash across the floor, into the other
      const a = new THREE.Vector3(runFrom.x + Math.sin(runFrom.ry) * 0.12, 0, runFrom.z + Math.cos(runFrom.ry) * 0.12);
      const b = new THREE.Vector3(runTo.x + Math.sin(runTo.ry) * 0.12, 0, runTo.z + Math.cos(runTo.ry) * 0.12);
      const len = a.distanceTo(b);
      runU += dt * 1.1 / len;
      if (runU < 1) { m.position.lerpVectors(a, b, runU); m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); m.position.y = Math.abs(Math.sin(t * 30)) * 0.006; }
      else { place(runTo, -0.12 + Math.max(0, 1 - (runU - 1) * 8) * 0.24); m.rotation.y = runTo.ry + Math.PI; if (runU > 1.2) { st.mode = 'in'; st.hole = 1 - st.hole; st.until = t + 50 + rand() * 50; } }
      head.rotation.set(0, 0, 0);
    }
    // the tail swishes behind it
    tailPts.forEach((p, i) => { p.x = Math.sin(t * 6 - i * 0.6) * 0.006 * i; }); tGeo.setFromPoints(tailPts);
    m.visible = st.mode !== 'in';
    st.visible = m.visible && (st.mode === 'run' || k > 0.4);
    m.getWorldPosition(st.pos);
  });
  return st;
}

// ------------------------------------------------------------------ the canary and its cage
function canaryAndCage(S, { stand, perches, rand }) {
  const brass = S.mat('#c9a24a', { emissive: '#2a1a04' }), barM = S.mat('#b8964a');
  // the stand: a weighted base, a pole and a hook
  const sg = new THREE.Group(); sg.position.set(stand.x, 0, stand.z); S.add(sg);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 20), brass); base.position.y = 0.025; sg.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.85, 8), brass); pole.position.y = 0.95; sg.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6), brass); arm.rotation.z = Math.PI / 2; arm.position.set(0.15, 1.86, 0); sg.add(arm);
  // the cage, hanging from the hook
  const cage = new THREE.Group(); cage.position.set(0.3, 1.2, 0); sg.add(cage);
  const R = 0.17, H = 0.32;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.01, R + 0.01, 0.025, 24), brass); cage.add(floor);
  const barGeo = new THREE.CylinderGeometry(0.0035, 0.0035, H, 4); barGeo.translate(0, H / 2, 0);
  const DOOR_A = Math.PI; // the door faces the room (towards -x)
  for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; if (Math.abs(angDiff(a, DOOR_A)) < 0.4) continue; const b = new THREE.Mesh(barGeo, barM); b.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); cage.add(b); }
  for (let k = 0; k < 6; k++) { const arc = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0035, 4, 20, Math.PI), barM); arc.position.y = H; arc.rotation.y = (k / 6) * Math.PI; cage.add(arc); }
  for (const y of [0.1, H]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.004, 4, 32), barM); ring.rotation.x = Math.PI / 2; ring.position.y = y; cage.add(ring); }
  const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16), brass); topRing.position.y = H + R + 0.02; cage.add(topRing);
  const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, R * 1.7, 6), S.mat('#8a6a3a')); perch.rotation.z = Math.PI / 2; perch.position.y = 0.14; cage.add(perch);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.03, 12), S.mat('#e8e2d6')); cup.position.set(0.08, 0.03, 0.06); cage.add(cup);
  // the door: three bars on a hinge, on the side facing the room
  const doorPivot = new THREE.Group(); const da = DOOR_A - 0.38; doorPivot.position.set(Math.cos(da) * R, 0.02, Math.sin(da) * R); doorPivot.rotation.y = -da - Math.PI / 2; cage.add(doorPivot);
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.16, 4), barM); b.position.set(k * 0.028 + 0.012, 0.08, 0); doorPivot.add(b); }
  for (const y of [0.0, 0.16]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.005, 0.005), barM); r.position.set(0.04, y, 0); doorPivot.add(r); }

  // the canary
  const bird = new THREE.Group(); bird.scale.setScalar(1.7); S.add(bird); // a little larger than life, so it reads on a phone
  const yellow = S.mat('#f5d33a'), y2 = S.mat('#e8bf2a');
  const bb = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), yellow); bb.scale.set(0.028, 0.026, 0.042); bird.add(bb);
  const bh = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), yellow); bh.position.set(0, 0.025, 0.03); bird.add(bh);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.016, 6), S.mat('#e88a3a')); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.022, 0.054); bird.add(beak);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 5), S.mat('#0a0806')); e.position.set(sx * 0.013, 0.03, 0.044); bird.add(e); }
  const tailB = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.04), y2); tailB.position.set(0, 0.004, -0.055); tailB.rotation.x = -0.3; bird.add(tailB);
  const wings = [-1, 1].map((sx) => { const piv = new THREE.Group(); piv.position.set(sx * 0.022, 0.012, 0); bird.add(piv); const w = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), y2); w.scale.set(0.035, 0.006, 0.026); w.position.set(sx * 0.03, 0, -0.005); piv.add(w); return { piv, sx }; });
  const legsB = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.018, 0.004), S.mat('#c98a6a')); legsB.position.set(0, -0.026, 0.004); bird.add(legsB);

  // what it does: 'cage' (hopping inside), 'out' (flying from perch to perch), 'home' (flying back in)
  const st = { mode: 'cage', free: false, pos: new THREE.Vector3(), until: 60 + rand() * 60, flying: false };
  const cagePos = new THREE.Vector3(), doorOut = new THREE.Vector3(), tmp = new THREE.Vector3();
  let flight = null, flightU = 0, flightLen = 1, perchUntil = 0, hops = 0, door = 0, flap = 0, inCage = new THREE.Vector3(0, 0.15, 0), hopT = 0;
  const fly = (to, t) => {
    const from = bird.position.clone(), mid = from.clone().lerp(to, 0.5);
    mid.y = Math.max(from.y, to.y) + 0.4 + rand() * 0.4; mid.x += (rand() - 0.5) * 1.5; mid.z += (rand() - 0.5) * 1.5;
    flight = new THREE.CatmullRomCurve3([from, mid, to.clone()]); flightLen = flight.getLength(); flightU = 0; st.flying = true;
  };
  S.on((t, dt, e) => {
    cage.getWorldPosition(cagePos);
    doorOut.set(cagePos.x - 0.35, cagePos.y + 0.1, cagePos.z + 0.05);
    if (st.mode === 'cage') {
      // hops between perch and floor, now and then a flutter
      if (t > hopT) { inCage.set((rand() - 0.5) * 0.12, rand() < 0.6 ? 0.15 : 0.03, (rand() - 0.5) * 0.1); hopT = t + 1 + rand() * 3; }
      tmp.copy(cagePos).add(inCage); bird.position.lerp(tmp, Math.min(1, dt * 6));
      bird.rotation.y = Math.PI * 1.5 + Math.sin(t * 0.5) * 0.8;
      flap = Math.max(0, flap - dt * 3); if (rand() < dt * 0.15) flap = 1;
      door = Math.max(0, door - dt * 0.8);
      if (t > st.until && e.energy > 0.3) { st.mode = 'out'; door = 1; hops = 3 + Math.floor(rand() * 3); fly(doorOut, t); }
    } else if (st.flying) {
      flightU += dt * (st.mode === 'home' ? 1.3 : 1.6) / flightLen;
      if (flightU >= 1) {
        st.flying = false; flight.getPointAt(1, bird.position);
        if (st.mode === 'home') { st.mode = 'cage'; st.until = t + 160 + rand() * 140; }
        else perchUntil = t + 5 + rand() * 9;
      } else {
        flight.getPointAt(flightU, bird.position); flight.getTangentAt(flightU, tmp);
        bird.rotation.y = Math.atan2(tmp.x, tmp.z); flap = 1;
      }
      if (st.mode === 'out' && flightU < 0.3) door = 1;
    } else if (st.mode === 'out') {
      // perched somewhere: bobbing, looking about, then off again (or home when it's had enough)
      bird.rotation.y += Math.sin(t * 2) * dt * 0.8; flap = Math.max(0, flap - dt * 4);
      if (t > perchUntil) {
        if (hops-- > 0) { const p = perches[Math.floor(rand() * perches.length)]; fly(new THREE.Vector3(...p), t); }
        else { st.mode = 'home'; fly(tmp.copy(cagePos).add(inCage.set(0, 0.15, 0)), t); }
      }
    }
    // wings, a little head bob, the door swinging
    wings.forEach(({ piv, sx }) => { piv.rotation.z = st.flying ? Math.sin(t * 38) * 0.9 * sx : flap * Math.sin(t * 30) * 0.6 * sx; });
    bh.position.y = 0.025 + (st.flying ? 0 : Math.abs(Math.sin(t * 2.3)) * 0.006);
    doorPivot.rotation.y = -da - Math.PI / 2 - (st.mode === 'cage' ? door : 1) * 1.6;
    st.free = st.mode !== 'cage';
    st.pos.copy(bird.position);
  });
  return st;
}

// ------------------------------------------------------------------ Penny's mind
/**
 * Wire it all up. `cat` is the tabby; `places` lists the furniture footprints and the props'
 * spots. Returns the cat's state (position, facing, whether she is walking on the floor) for the
 * paw prints and the camera, and the bird (so the camera can glance at it).
 */
export function pennyLife(S, { cat, rand, W, D, obstacles, spots }) {
  const nav = navGrid({ W, D, obstacles });
  const yarn = yarnBall(S, { pos: spots.yarn, nav, W, D });
  const mouse = mouseAndHoles(S, { holes: spots.holes, rand });
  const bird = canaryAndCage(S, { stand: spots.cage, perches: spots.perches, rand });

  // the bowls: water that ripples when she laps, and a little kibble
  for (const [b, water] of [[spots.water, true], [spots.food, false]]) {
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.05, 24, 1, true), S.mat(water ? '#5a7aa8' : '#a85a4a', { side: THREE.DoubleSide })); dish.position.set(b.x, 0.025, b.z); S.add(dish);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), S.mat(water ? '#5a7aa8' : '#a85a4a')); bottom.rotation.x = -Math.PI / 2; bottom.position.set(b.x, 0.003, b.z); S.add(bottom);
    if (water) {
      const surf = new THREE.Mesh(new THREE.CircleGeometry(0.098, 24), new THREE.MeshLambertMaterial({ color: '#9fc3e8', emissive: '#203048', transparent: true, opacity: 0.85 })); surf.rotation.x = -Math.PI / 2; surf.position.set(b.x, 0.04, b.z); S.add(surf);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.026, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(b.x, 0.041, b.z); S.add(ring);
      b.ripple = (t) => { const u = (t * 1.6) % 1; ring.scale.setScalar(1 + u * 3.5); ring.material.opacity = (1 - u) * 0.5; };
      b.still = () => { ring.material.opacity = 0; };
    } else {
      for (let k = 0; k < 26; k++) { const kb = new THREE.Mesh(new THREE.SphereGeometry(0.011, 5, 4), S.mat(k % 2 ? '#8a5a2a' : '#a8723a')); const a = rand() * TAU, r = Math.sqrt(rand()) * 0.07; kb.position.set(b.x + Math.cos(a) * r, 0.02 + rand() * 0.012, b.z + Math.sin(a) * r); S.add(kb); }
    }
  }
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.38), S.mat('#3a5a7a')); mat.rotation.x = -Math.PI / 2; mat.position.set((spots.water.x + spots.food.x) / 2, 0.004, spots.water.z); S.add(mat);

  // the scratching post: a sisal-wrapped post on a carpeted base, a toy dangling from the top
  { const p = spots.post, rope = canvasTexture(S, 64, 256, (g, w, h) => { g.fillStyle = '#c9a874'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(90,60,30,.5)'; g.lineWidth = 2; for (let y = 0; y < h; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 3); g.stroke(); } }); rope.wrapT = THREE.RepeatWrapping; rope.repeat.set(1, 3);
    box(S, [0.46, 0.06, 0.46], '#7a6a8a', [p.x, 0.03, p.z]);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 14), new THREE.MeshLambertMaterial({ map: rope })); post.position.set(p.x, 0.43, p.z); S.add(post);
    box(S, [0.34, 0.04, 0.34], '#7a6a8a', [p.x, 0.82, p.z]);
    const toy = new THREE.Group(); toy.position.set(p.x - 0.12, 0.8, p.z); S.add(toy);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.25, 4), S.mat('#eeeeee')); str.position.y = -0.125; toy.add(str);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), S.mat('#e8c94a')); pom.position.y = -0.26; toy.add(pom);
    S.on((t) => { toy.rotation.z = Math.sin(t * 1.7) * 0.12 + (p.batted || 0); toy.rotation.x = Math.sin(t * 1.3) * 0.08; p.batted = (p.batted || 0) * 0.97; });
  }
  // the cardboard box (cats will sit in a box)
  { const b = spots.box, card = S.mat('#b88a56'), side = S.mat('#a87a48');
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = b.ry || 0; S.add(g);
    const add = (w, h, d, x, y, z, m, rx = 0, rz = 0) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mm.position.set(x, y, z); mm.rotation.set(rx, 0, rz); g.add(mm); return mm; };
    add(0.6, 0.012, 0.48, 0, 0.006, 0, card);
    add(0.6, 0.3, 0.012, 0, 0.15, 0.234, side); add(0.6, 0.3, 0.012, 0, 0.15, -0.234, side); add(0.012, 0.3, 0.48, 0.294, 0.15, 0, card); add(0.012, 0.3, 0.48, -0.294, 0.15, 0, card);
    add(0.6, 0.012, 0.22, 0, 0.36, 0.33, card, 0.9); add(0.6, 0.012, 0.22, 0, 0.36, -0.33, card, -0.9); add(0.2, 0.012, 0.46, 0.39, 0.33, 0, side, 0, -1.1);
  }

  // ---------------------------------------------------------------- moving about
  const me = { pos: new THREE.Vector3(spots.basket.perch[0], spots.basket.perch[1], spots.basket.perch[2]), yaw: 0.6, walking: false, on: 'basket', bird, mouse };
  let queue = [], step = null, stepT = 0, path = null, jumpFrom = null, jumpTo = null;
  const need = { energy: 0.35, thirst: 0.8, hunger: 0.85, fun: 0.6, curious: 0.6 };
  let last = 'sleep', justWoke = 0, sinceMeal = 99, focus = null, lastEventT = -99;
  const SPEED = { walk: 0.34, trot: 0.75, stalk: 0.14 };

  const go = (x, z, speed = 'walk', look = null) => ({ type: 'go', x, z, speed, look });
  const jump = (x, y, z, dur = 0.7, land = 'floor') => ({ type: 'jump', to: new THREE.Vector3(x, y, z), dur, land });
  const act = (pose, dur, o = {}) => ({ type: 'act', pose, dur, ...o });
  const call = (fn) => ({ type: 'call', fn });
  const nearPerch = (spot) => spot.approach; // where to stand before hopping up or in

  // leave a raised spot first, if she's on one
  const getDown = () => { if (me.on === 'floor') return []; const s = spots[me.on] || spots.sofa; const a = s.approachFor ? s.approachFor([me.pos.x, me.pos.y, me.pos.z]) : s.approach; return [jump(a[0], 0, a[1], 0.6, 'floor')]; };
  const goToSpot = (name, perchAt = null) => { const s = spots[name], p = perchAt || s.perch; const a = s.approachFor ? s.approachFor(p) : s.approach; return [...getDown(), go(a[0], a[1]), jump(p[0], p[1], p[2], 0.75, name)]; };
  const floorTo = (x, z, speed = 'walk', look = null) => [...getDown(), go(x, z, speed, look)];

  // ---------------------------------------------------------------- what to do next
  const BEHAVIOURS = {
    sleep(e) { const where = rand() < 0.5 ? 'basket' : rand() < 0.6 ? 'sofa' : 'box'; const p = where === 'sofa' ? [lerp(-0.6, 0.2, rand()), spots.sofa.perch[1], spots.sofa.perch[2]] : null; const dur = 35 + rand() * 40 + (1 - e) * 80; return [...goToSpot(where, p), act(where === 'box' ? 'loaf' : 'curl', 2, { face: rand() * TAU }), act(where === 'box' ? 'loaf' : 'curl', dur, { sleep: true }), call(() => { justWoke = 1; })]; },
    drink() { const b = spots.water; return [...floorTo(b.x, b.z + 0.3), act('drink', 5 + rand() * 4, { face: Math.PI, action: 'drink', bowl: b, onEnd: () => { need.thirst = 1; b.still(); } })]; },
    eat() { const b = spots.food; return [...floorTo(b.x, b.z + 0.3), act('drink', 6 + rand() * 4, { face: Math.PI, action: 'drink', onEnd: () => { need.hunger = 1; sinceMeal = 0; } })]; },
    play() {
      const out = [...getDown()];
      const rounds = 3 + Math.floor(rand() * 4);
      for (let k = 0; k < rounds; k++) {
        out.push({ type: 'chaseBall' });
        out.push(act('crouch', 0.8 + rand() * 1.2, { lookBall: true, wiggle: rand() < 0.5 }));
        out.push({ type: 'bat' });
      }
      out.push(call(() => { need.fun = 1; }), act('sit', 3 + rand() * 3, { lookBall: true }));
      return out;
    },
    scratch() { const p = spots.post; return [...floorTo(p.x - 0.3, p.z), act('rear', 4 + rand() * 3, { face: Math.PI / 2, action: 'scratch', onTick: () => { p.batted = 0.15; } }), act('stand', 1)]; },
    groom() { return [act('sit', 7 + rand() * 6, { action: 'groom' })]; },
    window() { const z = lerp(0.8, 1.55, rand()); return [...goToSpot('window', [spots.window.perch[0], spots.window.perch[1], z]), act('sit', 10 + rand() * 12, { face: Math.PI / 2, look: new THREE.Vector3(8, 2.2, z) })]; },
    cage() { const c = spots.cage; return [...floorTo(c.x - 0.75, c.z + 0.35), act('sit', 8 + rand() * 6, { lookBird: true, twitch: 0.6 })]; },
    box() { return [...goToSpot('box'), act('loaf', 10 + rand() * 12)]; },
    hole() { const h = spots.holes[Math.floor(rand() * 2)]; return [...floorTo(h.x + Math.sin(h.ry) * 0.6, h.z + Math.cos(h.ry) * 0.6), act('sit', 8 + rand() * 6, { look: new THREE.Vector3(h.x, 0.04, h.z), twitch: 0.5 })]; },
    wander() { const p = nav.snap((rand() - 0.5) * (W - 1), (rand() - 0.5) * (D - 1)); return [...floorTo(p.x, p.z), act(rand() < 0.5 ? 'sit' : 'stand', 3 + rand() * 4)]; },
  };
  function choose(t, e) {
    const sleepy = (1 - need.energy) * 1.3 + (1 - e) * 0.9;
    const scores = {
      sleep: sleepy, drink: (1 - need.thirst) * 1.3, eat: (1 - need.hunger) * 1.2,
      play: (1 - need.fun) * (0.4 + e * 0.8), scratch: 0.14 + justWoke * 0.7, groom: 0.3 + (sinceMeal < 30 ? 0.6 : 0) + justWoke * 0.4,
      window: 0.16 + (1 - need.curious) * 0.3, cage: bird.free ? 0 : 0.24 + (1 - need.curious) * 0.25, box: 0.24, hole: 0.18 + (1 - need.curious) * 0.2, wander: 0.26,
    };
    let best = 'wander', bs = -1;
    for (const [k, v] of Object.entries(scores)) { const s = v * (0.65 + rand() * 0.7) * (k === last ? 0.35 : 1); if (s > bs) { bs = s; best = k; } }
    last = best; me.doing = best; justWoke = Math.max(0, justWoke - 0.5);
    if (['window', 'cage', 'hole', 'wander', 'box'].includes(best)) need.curious = Math.min(1, need.curious + 0.35);
    return BEHAVIOURS[best](e);
  }

  // ---------------------------------------------------------------- reacting to the world
  const airborne = () => step && step.type === 'jump';
  function interrupt(t, steps, label) { queue = steps; step = null; focus = label; lastEventT = t; me.doing = label; }
  function watchMouse(t) {
    const h = spots.holes[mouse.hole], m = mouse.pos;
    const stand = [m.x + Math.sin(h.ry) * 0.75, m.z + Math.cos(h.ry) * 0.75];
    interrupt(t, [...getDown(), act('stand', 0.6, { lookMouse: true }), go(stand[0], stand[1], 'stalk', 'mouse'),
      act('crouch', 1.5 + rand() * 2, { lookMouse: true, twitch: 1, wiggle: true }),
      jump(h.x + Math.sin(h.ry) * 0.28, 0, h.z + Math.cos(h.ry) * 0.28, 0.55), call(() => { mouse.scared = true; }),
      act('sit', 10 + rand() * 8, { look: new THREE.Vector3(h.x, 0.04, h.z), twitch: 0.7 })], 'mouse');
  }
  function chaseMouse(t) { const h = spots.holes[1 - mouse.hole]; interrupt(t, [...getDown(), go(h.x + Math.sin(h.ry) * 0.4, h.z + Math.cos(h.ry) * 0.4, 'trot', 'mouse'), act('crouch', 2, { look: new THREE.Vector3(h.x, 0.04, h.z), twitch: 1 }), act('sit', 12, { look: new THREE.Vector3(h.x, 0.04, h.z), twitch: 0.6 })], 'mouse'); }
  function watchBird(t) {
    // follow under it, sit and stare up, now and then rear up and swat at the air
    const p = bird.pos, under = nav.snap(p.x + (rand() - 0.5) * 0.6, p.z + (rand() - 0.5) * 0.6), x = under.x, z = under.z;
    const low = p.y < 1.4;
    interrupt(t, [...getDown(), go(x, z, rand() < 0.5 ? 'trot' : 'walk', 'bird'), act('sit', 3 + rand() * 4, { lookBird: true, twitch: 1 }), ...(low && rand() < 0.6 ? [act('rear', 0.9, { lookBird: true }), { type: 'bat' }, act('sit', 2, { lookBird: true, twitch: 1 })] : [])], 'bird');
  }

  // ---------------------------------------------------------------- the frame-by-frame
  const tmp = new THREE.Vector3(), lookAt = new THREE.Vector3();
  let wasMouse = false, birdCheck = 0;
  S.on((t, dt, st) => {
    const e = st.energy;
    const asleep = step && step.sleep && cat.pose === 'curl';
    // needs drift
    need.energy = Math.max(0, Math.min(1, need.energy + dt * (asleep ? 0.01 : -0.0022)));
    need.thirst = Math.max(0, need.thirst - dt * 0.0011); need.hunger = Math.max(0, need.hunger - dt * 0.0007);
    need.fun = Math.max(0, need.fun - dt * 0.0028); need.curious = Math.max(0, need.curious - dt * 0.003); sinceMeal += dt;

    // the mouse: she may notice it (less likely the sleepier she is, never in deep sleep)
    if (mouse.visible && !wasMouse && focus !== 'mouse' && t - lastEventT > 8 && !airborne()) {
      const awake = !asleep || rand() < 0.25;
      if (awake && rand() < 0.45 + e * 0.4) (mouse.mode === 'run' ? chaseMouse : watchMouse)(t);
    }
    wasMouse = mouse.visible;
    // the bird: while it's out she keeps after it
    birdCheck -= dt;
    if (bird.free && birdCheck <= 0) {
      birdCheck = 4 + rand() * 3;
      const ready = !airborne();
      if (ready && (!asleep || rand() < 0.6) && (focus === 'bird' || t - lastEventT > 6)) watchBird(t);
    }
    if (!bird.free && focus === 'bird' && !queue.length) focus = null;

    // next step
    if (!step) {
      if (!queue.length) { focus = null; queue = choose(t, e); }
      step = queue.shift(); stepT = 0; path = null;
      if (step.type === 'go') { path = nav.path(V2(me.pos.x, me.pos.z), V2(step.x, step.z)); }
      if (step.type === 'jump') { jumpFrom = me.pos.clone(); jumpTo = step.to; }
      if (step.type === 'act') { cat.action = step.action || null; cat.twitch = step.twitch || 0; if (step.wiggle) cat.wiggle(Math.min(step.dur, 1.4)); }
      if (step.type === 'chaseBall') { const bp = yarn.pos, a = Math.atan2(me.pos.x - bp.x, me.pos.z - bp.z); let x = bp.x + Math.sin(a) * 0.28, z = bp.z + Math.cos(a) * 0.28; if (!nav.free(x, z)) { x = bp.x; z = bp.z; } path = nav.path(V2(me.pos.x, me.pos.z), V2(x, z)); step.speed = rand() < 0.5 ? 'trot' : 'walk'; }
      if (step.type === 'bat') { cat.swipe(); step.dur = 0.5; }
      if (step.type === 'call') { step.fn(); step = null; return; }
    }
    stepT += dt;
    let moving = 0;
    cat.look = null;
    switch (step.type) {
      case 'go': case 'chaseBall': {
        const sp = SPEED[step.speed || 'walk'] * (step.speed === 'walk' ? 0.8 + 0.4 * e : 1);
        cat.pose = step.speed === 'stalk' ? 'stalk' : step.speed === 'trot' ? 'trot' : 'walk';
        cat.speed = step.speed === 'trot' ? 1.8 : step.speed === 'stalk' ? 0.55 : 0.75 + 0.35 * e;
        if (step.look === 'mouse') cat.look = mouse.visible ? mouse.pos : null;
        if (step.look === 'bird') cat.look = bird.pos;
        if (step.type === 'chaseBall') cat.look = yarn.pos;
        const target = path && path[0];
        if (!target) { step = null; break; }
        const dx = target.x - me.pos.x, dz = target.z - me.pos.z, d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz); me.yaw += angDiff(me.yaw, want) * Math.min(1, dt * 6);
        const facing = Math.cos(angDiff(me.yaw, want)); // turn before striding off
        const adv = Math.min(d, sp * dt * Math.max(0.15, facing));
        me.pos.x += Math.sin(want) * adv; me.pos.z += Math.cos(want) * adv; me.pos.y = 0;
        moving = Math.max(0.25, facing);
        if (d < 0.04) { path.shift(); if (!path.length) step = null; }
        if (stepT > 25) step = null; // give up rather than dither
        break;
      }
      case 'jump': {
        cat.pose = 'jump';
        const u = Math.min(1, stepT / step.dur), s = (1 - Math.cos(u * Math.PI)) / 2;
        me.pos.lerpVectors(jumpFrom, jumpTo, s); me.pos.y = lerp(jumpFrom.y, jumpTo.y, s) + Math.sin(u * Math.PI) * 0.3;
        const want = Math.atan2(jumpTo.x - jumpFrom.x, jumpTo.z - jumpFrom.z); if (Math.hypot(jumpTo.x - jumpFrom.x, jumpTo.z - jumpFrom.z) > 0.05) me.yaw += angDiff(me.yaw, want) * Math.min(1, dt * 10);
        if (u >= 1) { me.pos.copy(jumpTo); me.on = step.land; step = null; }
        break;
      }
      case 'bat': {
        cat.pose = 'stand'; cat.look = yarn.pos;
        if (stepT > 0.18 && !step.hit) { step.hit = true; if (yarn.pos.distanceTo(tmp.set(me.pos.x, yarn.pos.y, me.pos.z)) < 0.5) yarn.push(me.yaw + (rand() - 0.5) * 1.2, 0.8 + rand() * 1.4); }
        if (stepT > step.dur) step = null;
        break;
      }
      case 'act': {
        cat.pose = step.pose;
        if (step.face != null) me.yaw += angDiff(me.yaw, step.face) * Math.min(1, dt * 3);
        if (step.look) cat.look = step.look;
        if (step.lookBall) { cat.look = yarn.pos; const a = Math.atan2(yarn.pos.x - me.pos.x, yarn.pos.z - me.pos.z); me.yaw += angDiff(me.yaw, a) * Math.min(1, dt * 4); }
        if (step.lookBird) cat.look = bird.pos;
        if (step.lookMouse) cat.look = mouse.pos;
        if (step.bowl && step.bowl.ripple) step.bowl.ripple(t);
        if (step.onTick) step.onTick(t);
        // a sleeping cat stays asleep until she's slept enough, or the night ends
        if (stepT > step.dur) { if (step.onEnd) step.onEnd(); cat.action = null; cat.twitch = 0; step = null; }
        break;
      }
      default: step = null;
    }
    cat.moving = lerp(cat.moving, moving, Math.min(1, dt * 8));
    me.walking = moving > 0.2 && (step ? step.type !== 'jump' : true);
    me.pos.x = THREE.MathUtils.clamp(me.pos.x, -W / 2 + 0.2, W / 2 - 0.2); me.pos.z = THREE.MathUtils.clamp(me.pos.z, -D / 2 + 0.2, D / 2 - 0.2);
    cat.group.position.copy(me.pos);
    cat.group.rotation.y = me.yaw;
  });
  return me;
}
