// A tabby cat, built by hand: a shaped body (chest, barrel, haunches, neck), a striped coat
// with a cream belly and white chest and paws, a head with cheeks, muzzle, pink nose, ears with
// pink insides, green slit-pupil eyes that blink and close, and whiskers; two-jointed legs that
// walk in a cat's lateral gait; and a tail of many segments that carries a question-mark curl
// when walking and wraps round the feet when sitting. Poses blend smoothly (stand, walk, trot,
// stalk, crouch, drink, sit, loaf, curl, rear, jump), with actions on top: batting a paw,
// grooming, drinking, scratching, a tail twitch, the wiggle before a pounce, and looking at things. Faces +z, paws on y = 0, about 0.25 m at the shoulder.
import * as THREE from 'three';

const lerp = (a, b, k) => a + (b - a) * k;

/** The coat's stripe pattern (greyscale: multiplied by each part's coat colours). */
function stripes(stage, rings = 9, wobble = 0.35) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 256);
  for (let k = 0; k < rings; k++) {
    const y0 = (k + 0.5) / rings * 256;
    g.fillStyle = 'rgba(46,34,26,.36)';
    g.beginPath();
    for (let x = 0; x <= 128; x += 4) { const y = y0 + Math.sin(x * 0.09 + k * 1.7) * 6 * wobble * 3 + Math.sin(x * 0.23 + k) * 2; g.lineTo(x, y - 2.5 - Math.abs(Math.sin(x * 0.05 + k)) * 3); }
    for (let x = 128; x >= 0; x -= 4) { const y = y0 + Math.sin(x * 0.09 + k * 1.7) * 6 * wobble * 3 + Math.sin(x * 0.23 + k) * 2; g.lineTo(x, y + 2.5); }
    g.fill();
  }
  // a fine ticking of individual hairs
  for (let i = 0; i < 1400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.12)'; g.fillRect(Math.random() * 128, Math.random() * 256, 1, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return stage.keep(t);
}

/** Colour a fur part per vertex: coat on top, cream underneath, white at the front if asked. */
function fur(geo, { coat, belly, white = null, whiteFront = 0.55 }) {
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3), a = new THREE.Color(coat), b = new THREE.Color(belly), w = white ? new THREE.Color(white) : null, out = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    const ny = n.getY(i), nz = n.getZ(i);
    out.copy(a).lerp(b, THREE.MathUtils.smoothstep(-ny, 0.1, 0.65));
    if (w) out.lerp(w, THREE.MathUtils.smoothstep(nz - Math.max(0, ny) * 0.8, whiteFront - 0.25, whiteFront + 0.2));
    c.set([out.r, out.g, out.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

export function tabby(stage, { coat = '#8a6446', stripe = null, belly = '#efe2cc', white = '#f6f1e8', eyes = '#b9c94a', pos = [0, 0, 0], ry = 0, scale = 1, pose = 'walk' } = {}) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = ry; g.scale.setScalar(scale);
  const tex = stripes(stage, 11), fine = stripes(stage, 18, 0.2);
  const furMat = stage.keep(new THREE.MeshLambertMaterial({ vertexColors: true, map: tex }));
  const fineMat = stage.keep(new THREE.MeshLambertMaterial({ vertexColors: true, map: fine }));
  const softMat = stage.keep(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const plain = (col) => stage.mat(col);
  const ellip = (r, sx, sy, sz, opts, mat = furMat, seg = 18) => { const ge = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)); ge.rotateX(Math.PI / 2); ge.scale(sx, sy, sz); fur(ge, { coat, belly, ...opts }); return new THREE.Mesh(ge, mat); };

  // body: pivots at the hips, so sitting tips the chest up
  const body = new THREE.Group(); g.add(body);
  const barrel = ellip(1, 0.105, 0.11, 0.2, {}); barrel.position.set(0, 0, 0.12); body.add(barrel);
  const haunch = ellip(1, 0.11, 0.115, 0.11, {}); haunch.position.set(0, 0.005, 0); body.add(haunch);
  const chest = ellip(1, 0.095, 0.115, 0.1, { white, whiteFront: 0.45 }, softMat); chest.position.set(0, 0.01, 0.25); body.add(chest);
  const neck = ellip(1, 0.065, 0.075, 0.07, { white, whiteFront: 0.3 }, softMat); neck.position.set(0, 0.075, 0.32); body.add(neck);
  for (const o of [barrel, haunch, chest, neck]) o.castShadow = true;

  // head
  const head = new THREE.Group(); head.position.set(0, 0.13, 0.37); body.add(head);
  const skull = ellip(1, 0.075, 0.068, 0.07, { white: null }, fineMat, 22); head.add(skull);
  for (const sx of [-1, 1]) { const ch = ellip(1, 0.04, 0.035, 0.04, { white, whiteFront: 0.7 }, softMat, 14); ch.position.set(sx * 0.038, -0.028, 0.035); head.add(ch); }
  const muzzle = ellip(1, 0.034, 0.024, 0.026, { white, whiteFront: -0.5 }, softMat, 14); muzzle.position.set(0, -0.032, 0.062); head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.012, 3), plain('#d98a8a')); nose.rotation.set(-Math.PI / 2 - 0.3, 0, Math.PI); nose.position.set(0, -0.017, 0.085); head.add(nose);
  const chin = ellip(1, 0.018, 0.012, 0.016, { white, whiteFront: -1 }, softMat, 10); chin.position.set(0, -0.052, 0.055); head.add(chin);
  const ears = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(sx * 0.045, 0.05, -0.005); ear.rotation.set(-0.15, 0, sx * -0.32); head.add(ear);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.062, 4, 1), plain(coat)); outer.scale.z = 0.45; outer.position.y = 0.03; outer.rotation.y = Math.PI / 4; ear.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.045, 3, 1), plain('#d9a0a0')); inner.scale.z = 0.3; inner.position.set(0, 0.024, 0.008); ear.add(inner);
    ears.push(ear);
  }
  // eyes: almond, green, a slit of a pupil; lids close them
  const eyeGroups = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(sx * 0.032, 0.004, 0.058); eg.rotation.set(0, sx * 0.35, sx * -0.12); head.add(eg);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), new THREE.MeshLambertMaterial({ color: eyes, emissive: eyes, emissiveIntensity: 0.25 })); ball.scale.set(1, 0.72, 0.45); eg.add(ball);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), plain('#0a0806')); pupil.scale.set(0.2, 0.68, 0.3); pupil.position.z = 0.003; eg.add(pupil);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0028, 5, 12, Math.PI), plain('#2a1c14')); lid.rotation.z = Math.PI; lid.position.z = 0.006; lid.visible = false; eg.add(lid); // a closed eye: a soft curve
    eyeGroups.push({ eg, lid, ball, pupil });
    stage.keep(ball.material);
  }
  // whiskers
  { const pts = []; for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { pts.push(sx * 0.03, -0.03, 0.07, sx * (0.11 + k * 0.006), -0.022 - k * 0.012 + 0.008, 0.055 - k * 0.01); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    head.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#f4efe6', transparent: true, opacity: 0.55 }))); }

  // legs: [hip/shoulder pivot] -> upper -> [knee/elbow pivot] -> lower -> paw
  const legs = [];
  const legPart = (r0, r1, len, col) => { const ge = new THREE.CylinderGeometry(r1, r0, len, 10); ge.translate(0, -len / 2, 0); fur(ge, { coat: col, belly: col }); return new THREE.Mesh(ge, softMat); };
  for (const [sx, front] of [[-1, true], [1, true], [-1, false], [1, false]]) {
    const top = new THREE.Group(); top.position.set(sx * (front ? 0.052 : 0.06), front ? -0.03 : -0.02, front ? 0.25 : 0.0); body.add(top);
    const u = legPart(front ? 0.03 : 0.045, front ? 0.024 : 0.03, front ? 0.12 : 0.11, coat); top.add(u);
    const mid = new THREE.Group(); mid.position.y = front ? -0.12 : -0.11; top.add(mid);
    const l = legPart(0.022, 0.019, front ? 0.1 : 0.115, front ? coat : coat); mid.add(l);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), plain(white)); paw.scale.set(0.95, 0.55, 1.35); paw.position.set(0, front ? -0.1 : -0.115, 0.012); mid.add(paw);
    u.castShadow = l.castShadow = true;
    legs.push({ top, mid, front, sx });
  }

  // tail: a chain of segments, each turned a little relative to the last
  const tail = new THREE.Group(); tail.position.set(0, 0.06, -0.09); body.add(tail);
  const SEG = 14, segs = [];
  let parent = tail;
  for (let k = 0; k < SEG; k++) {
    const r = lerp(0.022, 0.011, k / (SEG - 1)), dark = k % 3 === 1 || k >= SEG - 2;
    const seg = new THREE.Group(); seg.position.z = k === 0 ? 0 : -0.026; parent.add(seg);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), plain(dark ? '#4a3424' : coat)); m.scale.z = 1.5; m.position.z = -0.012; seg.add(m);
    segs.push(seg); parent = seg;
  }

  // ---------------------------------------------------------------- poses, blended
  // Each pose is a full set of joint targets; the current values ease towards them. Leg angles are
  // relative to the body (positive swings a leg backwards). Actions (batting, grooming, drinking,
  // scratching) and a look target sit on top of whatever pose she is in.
  const POSES = {
    stand: { y: 0.215, pitch: 0, fU: 0, fL: 0, bU: -0.25, bL: 0.45, head: 0.05, lift: 1, wrap: 0, eyes: 1, hide: 0 },
    walk: { y: 0.215, pitch: 0, fU: 0, fL: 0, bU: -0.25, bL: 0.45, head: 0.05, lift: 1, wrap: 0, eyes: 1, hide: 0 },
    trot: { y: 0.205, pitch: 0.03, fU: 0, fL: 0, bU: -0.25, bL: 0.45, head: 0.0, lift: 0.75, wrap: 0, eyes: 1, hide: 0 },
    stalk: { y: 0.15, pitch: 0.06, fU: -0.35, fL: 0.85, bU: -0.75, bL: 1.25, head: -0.12, lift: 0.12, wrap: 0, eyes: 1, hide: 0 },
    crouch: { y: 0.11, pitch: 0.04, fU: -0.7, fL: 1.45, bU: -1.15, bL: 1.95, head: -0.15, lift: 0.08, wrap: 0, eyes: 1, hide: 0 },
    drink: { y: 0.16, pitch: 0.32, fU: -0.62, fL: 0.6, bU: -0.75, bL: 1.1, head: 0.85, lift: 0.3, wrap: 0, eyes: 0.6, hide: 0 },
    sit: { y: 0.1, pitch: -0.62, fU: 0.62, fL: 0, bU: -0.78, bL: 2.0, head: 0.12, lift: 0, wrap: 1, eyes: 1, hide: 0 },
    loaf: { y: 0.075, pitch: 0, fU: -1.4, fL: 2.4, bU: -1.5, bL: 2.4, head: 0.05, lift: 0, wrap: 1.2, eyes: 0.55, hide: 1 },
    curl: { y: 0.06, pitch: 0, fU: -1.4, fL: 2.4, bU: -1.5, bL: 2.4, head: 0.5, lift: 0, wrap: 1.6, eyes: 0, hide: 1 },
    squat: { y: 0.15, pitch: -0.32, fU: 0.3, fL: 0, bU: -1.25, bL: 2.05, head: 0.05, lift: 0.45, wrap: 0, eyes: 0.6, hide: 0 },
    rear: { y: 0.27, pitch: -1.15, fU: -0.3, fL: -0.2, bU: 0.95, bL: 0.35, head: 0.2, lift: 0.4, wrap: 0, eyes: 1, hide: 0 },
    jump: { y: 0.23, pitch: 0, fU: -0.85, fL: 0, bU: 0.75, bL: 0.05, head: -0.1, lift: 0.6, wrap: 0, eyes: 1, hide: 0 },
  };
  const KEYS = Object.keys(POSES.stand);
  const P = { ...POSES.stand };
  let cur = pose, phase = 0, blink = 0, nextBlink = 2, lookYaw = 0, lookPitch = 0, idleYaw = 0, nextLook = 3;
  let swipeT = -1, wiggleT = 0;
  const tmpV = new THREE.Vector3(), inv = new THREE.Matrix4();
  const api = {
    group: g, head,
    set pose(v) { if (POSES[v]) cur = v; }, get pose() { return cur; },
    moving: 0, // 0..1: how much she is moving (drives the gait)
    speed: 1, // gait rate
    look: null, // a world point to look at, or null to look about
    action: null, // 'groom' | 'drink' | 'scratch' | 'dig' | null
    twitch: 0, // tail-tip twitching (stalking, watching)
    swipe() { swipeT = 0; }, // bat with the right front paw
    wiggle(d = 1.2) { wiggleT = d; }, // the bottom-wiggle before a pounce
  };

  stage.on((t, dt) => {
    const T = POSES[cur];
    const k = Math.min(1, dt * (cur === 'jump' ? 10 : cur === 'crouch' || cur === 'rear' ? 5 : 3));
    for (const key of KEYS) P[key] = lerp(P[key], T[key], k);
    phase += dt * 5.6 * api.speed * api.moving;
    const gait = api.moving;
    const breathe = Math.sin(t * (cur === 'curl' ? 1.1 : 1.6)) * 0.012;
    wiggleT = Math.max(0, wiggleT - dt);

    // body
    body.position.y = P.y + Math.abs(Math.sin(phase)) * 0.006 * gait + (cur === 'jump' ? 0 : 0);
    body.rotation.x = P.pitch + Math.sin(phase * 2) * 0.012 * gait;
    body.rotation.y = wiggleT > 0 ? Math.sin(t * 22) * 0.06 : 0; // the wiggle
    barrel.scale.set(1 + breathe, 1 + breathe, 1); chest.scale.set(1 + breathe * 0.6, 1 + breathe * 0.6, 1);
    barrel.rotation.y = P.wrap > 1 ? (P.wrap - 1) * 0.5 : 0; chest.position.x = P.wrap > 1 ? (P.wrap - 1) * 0.08 : 0;

    // where to look: a target in the world, or idly about
    if (t > nextLook) { idleYaw = gait > 0.5 ? (Math.random() - 0.5) * 0.5 : (Math.random() - 0.5) * 1.4; nextLook = t + 2 + Math.random() * 4; }
    let wantYaw = idleYaw, wantPitch = 0;
    if (api.look) {
      g.updateMatrixWorld(); inv.copy(g.matrixWorld).invert();
      tmpV.copy(api.look).applyMatrix4(inv); // into the cat's own space
      const dx = tmpV.x, dz = tmpV.z - 0.3, dy = tmpV.y - 0.3;
      wantYaw = THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.3, 1.3);
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -1.0, 0.7);
    }
    lookYaw = lerp(lookYaw, wantYaw, Math.min(1, dt * (api.look ? 4 : 1.5)));
    lookPitch = lerp(lookPitch, wantPitch, Math.min(1, dt * (api.look ? 4 : 1.5)));
    const asleep = cur === 'curl';
    let hx = -P.pitch * 0.9 + P.head + (asleep ? 0 : lookPitch), hy = asleep ? 1.1 : lookYaw, hz = asleep ? 0.35 : 0;
    if (api.action === 'groom') { hx += 0.35 + Math.sin(t * 7) * 0.08; hy += 0.35; }
    if (api.action === 'drink') hx += Math.sin(t * 9) * 0.06;
    if (api.action === 'dig') hx += 0.45 + Math.sin(t * 5.5) * 0.05; // looking down at her work
    head.rotation.set(hx, hy, hz);
    head.position.set(P.wrap > 1 ? 0.07 * (P.wrap - 1) : 0, 0.13 - (P.wrap > 1 ? 0.1 * (P.wrap - 1) : 0), 0.37);
    ears.forEach((e, i) => { e.rotation.x = -0.15 + Math.max(0, Math.sin(t * 0.7 + i * 2) - 0.96) * 6 + (cur === 'stalk' || cur === 'crouch' ? 0.25 : 0); });
    // eyes: blink now and then; closed when asleep, half-closed when dozing
    if (t > nextBlink) { blink = 1; nextBlink = t + 2.5 + Math.random() * 4; }
    blink = Math.max(0, blink - dt * 7);
    const open = P.eyes * (1 - Math.sin(Math.min(1, blink) * Math.PI));
    eyeGroups.forEach(({ lid, ball, pupil }) => { const shut = open < 0.3; ball.visible = pupil.visible = !shut; lid.visible = shut; ball.scale.y = 0.72 * Math.max(0.35, open); pupil.scale.y = 0.68 * Math.max(0.35, open) * (cur === 'stalk' || cur === 'crouch' ? 1.4 : 1); });

    // legs: the pose, the gait on top, then any action
    if (swipeT >= 0) swipeT += dt;
    legs.forEach((L, i) => {
      const off = [0.25, 0.75, 0, 0.5][i] * Math.PI * 2; // lateral sequence: LH, LF, RH, RF
      const s = Math.sin(phase + off), lift = Math.max(0, Math.sin(phase + off + Math.PI / 2));
      let up, low;
      if (L.front) { up = P.fU + s * 0.38 * gait; low = P.fL - lift * 0.65 * gait; }
      else { up = P.bU - s * 0.34 * gait; low = P.bL + lift * 0.7 * gait; }
      if (L.front && api.action === 'scratch') { const a = Math.sin(t * 9 + (i === 0 ? 0 : Math.PI)); up = -0.35 + a * 0.22; low = -0.15 - Math.max(0, a) * 0.35; }
      if (L.front && api.action === 'dig') { const a = Math.sin(t * 11 + (i === 0 ? 0 : Math.PI)); up = -0.25 + a * 0.45; low = 0.25 + Math.max(0, a) * 0.6; }
      if (i === 1 && api.action === 'groom') { up = -1.35; low = 1.9 + Math.sin(t * 3) * 0.2; }
      if (i === 1 && swipeT >= 0 && swipeT < 0.5) { const u = swipeT / 0.5; up = lerp(-1.35, -0.25, u * u); low = lerp(0.6, -0.2, u); }
      L.top.rotation.x = up; L.mid.rotation.x = low;
      L.top.visible = P.hide < 0.6;
    });
    if (swipeT > 0.5) swipeT = -1;

    // tail: a hooked question mark held high when walking, low and straight when stalking (the
    // tip twitching), wrapped round her when sitting or asleep
    segs.forEach((sg, k) => {
      const u = k / (SEG - 1), L = P.lift, W = Math.min(1, P.wrap);
      let rx, ry;
      if (k === 0) { rx = lerp(-1.35, 1.2, L); ry = 0; }
      else {
        const hook = u > 0.6 ? 0.34 : 0.03;
        const lie = k < 4 ? 0.36 * W + (1 - W) * 0.05 : 0.0;
        rx = lerp(lie, hook, L);
        ry = (k > 3 ? W * 0.3 : 0) + Math.sin(t * 1.3 - k * 0.45) * (gait > 0.3 ? 0.07 : 0.02) * (k > 3 ? 1 : 0.3);
        if (u > 0.7) ry += Math.sin(t * 11 + k) * 0.22 * api.twitch;
      }
      sg.rotation.set(rx, ry, 0);
    });
  });

  stage.add(g);
  return api;
}
