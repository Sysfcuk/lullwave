// A tabby cat, built by hand: a shaped body (chest, barrel, haunches, neck), a striped coat
// with a cream belly and white chest and paws, a head with cheeks, muzzle, pink nose, ears with
// pink insides, green slit-pupil eyes that blink and close, and whiskers; two-jointed legs that
// walk in a cat's lateral gait; and a tail of many segments that carries a question-mark curl
// when walking and wraps round the feet when sitting. Poses blend smoothly: walk, sit, curl
// (asleep), jump. Faces +z, paws on y = 0, about 0.25 m at the shoulder.
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
  const POSES = {
    //        bodyY  pitch  headPitch  tailLift  tailCurl  tailWrap  legsFold  crouch  stretch
    walk: { y: 0.215, pitch: 0, head: 0.05, lift: 1, curl: 1, wrap: 0, fold: 0, eyes: 1 },
    sit: { y: 0.1, pitch: -0.62, head: 0.55, lift: 0, curl: 0, wrap: 1, fold: 1, eyes: 1 },
    curl: { y: 0.06, pitch: 0, head: 0.5, lift: 0, curl: 0, wrap: 1.6, fold: 2, eyes: 0 },
    jump: { y: 0.23, pitch: 0, head: -0.1, lift: 0.6, curl: 0.2, wrap: 0, fold: 0, eyes: 1, stretch: 1 },
  };
  const P = { ...POSES.walk, stretch: 0 };
  let cur = pose, phase = 0, blink = 0, nextBlink = 2, lookYaw = 0, lookTarget = 0, nextLook = 3;
  const api = { group: g, head, set pose(v) { if (POSES[v]) cur = v; }, get pose() { return cur; }, speed: 1, pitch: 0 };

  stage.on((t, dt) => {
    const T = POSES[cur];
    const k = Math.min(1, dt * (cur === 'jump' ? 9 : 2.4));
    for (const key of ['y', 'pitch', 'head', 'lift', 'curl', 'wrap', 'fold', 'eyes']) P[key] = lerp(P[key], T[key], k);
    P.stretch = lerp(P.stretch, T.stretch || 0, Math.min(1, dt * 8));
    const walking = cur === 'walk';
    if (walking) phase += dt * 5.6 * api.speed;
    const breathe = Math.sin(t * (cur === 'curl' ? 1.1 : 1.6)) * 0.012;

    // body
    body.position.y = P.y + (walking ? Math.abs(Math.sin(phase)) * 0.006 : 0);
    body.rotation.x = P.pitch + api.pitch * 0.5 + (walking ? Math.sin(phase * 2) * 0.012 : 0);
    barrel.scale.set(1 + breathe, 1 + breathe, 1); chest.scale.set(1 + breathe * 0.6, 1 + breathe * 0.6, 1);
    // when curled, the body bends round on itself a little
    barrel.rotation.y = P.wrap > 1 ? (P.wrap - 1) * 0.5 : 0; chest.position.x = (P.wrap > 1 ? (P.wrap - 1) * 0.08 : 0);

    // head: level against the body's pitch, looking about when still
    if (t > nextLook) { lookTarget = walking ? (Math.random() - 0.5) * 0.5 : (Math.random() - 0.5) * 1.4; nextLook = t + 2 + Math.random() * 4; }
    lookYaw = lerp(lookYaw, lookTarget, Math.min(1, dt * 1.5));
    head.rotation.set(-P.pitch * 0.9 + P.head * (cur === 'curl' ? 1 : 0.25) - (cur === 'curl' ? 0 : 0.05), lookYaw * (cur === 'curl' ? 0 : 1) + (P.wrap > 1 ? 1.1 : 0), P.wrap > 1 ? 0.35 : 0);
    head.position.set(P.wrap > 1 ? 0.07 * (P.wrap - 1) : 0, 0.13 - (P.wrap > 1 ? 0.1 * (P.wrap - 1) : 0), 0.37);
    ears.forEach((e, i) => { e.rotation.x = -0.15 + Math.max(0, Math.sin(t * 0.7 + i * 2) - 0.96) * 6; });
    // eyes: blink now and then; closed when asleep
    if (t > nextBlink) { blink = 1; nextBlink = t + 2.5 + Math.random() * 4; }
    blink = Math.max(0, blink - dt * 7);
    const open = P.eyes * (1 - Math.sin(Math.min(1, blink) * Math.PI));
    eyeGroups.forEach(({ lid, ball, pupil }) => { const shut = open < 0.3; ball.visible = pupil.visible = !shut; lid.visible = shut; ball.scale.y = 0.72 * Math.max(0.35, open); pupil.scale.y = 0.68 * Math.max(0.35, open); });

    // legs
    legs.forEach((L, i) => {
      const off = [0.25, 0.75, 0, 0.5][i] * Math.PI * 2; // lateral sequence: LH, LF, RH, RF
      const s = Math.sin(phase + off), lift = Math.max(0, Math.sin(phase + off + Math.PI / 2));
      let up, low;
      if (L.front) {
        up = (walking ? s * 0.38 : 0) - P.pitch * (1 - Math.min(1, P.fold - 1 > 0 ? P.fold - 1 : 0)) + P.stretch * -0.85;
        low = (walking ? -lift * 0.65 : 0) - Math.max(0, P.fold - 1) * 2.2;
        if (P.fold > 1) up = lerp(up, -1.35, P.fold - 1);
      } else {
        up = (walking ? -s * 0.34 : 0) - 0.25 - P.pitch - Math.min(1, P.fold) * 1.15 + P.stretch * 1.0;
        low = (walking ? lift * 0.7 : 0) + 0.45 + Math.min(1, P.fold) * 1.55 - P.stretch * 0.4;
        if (P.fold > 1) { up = lerp(up, -1.5, P.fold - 1); low = lerp(low, 2.4, P.fold - 1); }
      }
      L.top.rotation.x = up; L.mid.rotation.x = low;
    });

    // tail: lifted with a hooked tip when walking, wrapped round when sitting or curled
    segs.forEach((sg, k) => {
      const u = k / (SEG - 1), L = P.lift, W = Math.min(1, P.wrap);
      let rx, ry;
      if (k === 0) { rx = lerp(-1.35, 1.2, L); ry = 0; }
      else {
        const hook = u > 0.6 ? 0.34 * P.curl : 0.03; // walking: the tip curls over
        const lie = k < 4 ? 0.36 : 0.0; // sitting: bends from hanging down to lying along the floor
        rx = lerp(lie, hook, L);
        ry = (k > 3 ? W * 0.3 : 0) + Math.sin(t * 1.3 - k * 0.45) * (walking ? 0.07 : 0.02) * (k > 3 ? 1 : 0.3);
      }
      sg.rotation.set(rx, ry, 0);
    });
    // curled up asleep: legs tucked under, so hide them rather than fold them through the body
    legs.forEach((L) => { L.top.visible = P.fold < 1.6; });
  });

  stage.add(g);
  return api;
}
