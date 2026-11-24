// Characters for the dream worlds: a horse that grazes, swishes its tail and flicks its ears; a cat
// that sits, curls up asleep, stretches or pads about; and little people (a hiker, a chef, choir
// singers). All built from simple shapes, gently animated, never fast.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Put a mesh between two points (a leg, a neck). */
function limb(geo, a, b, mat) {
  const d = b.clone().sub(a), len = d.length();
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  m.scale.y = len;
  m.castShadow = true;
  return m;
}

/**
 * A horse, about 1.65 m at the withers, facing +z. `mode`: 'graze' (head down to the grass now and
 * then), 'rest' (standing, dozing), 'stall' (head up, looking over a door).
 */
export function horse(stage, { coat = '#6b3b20', mane = '#1a1210', socks = false, blaze = false, pos = [0, 0, 0], ry = 0, mode = 'graze', scale = 1 } = {}) {
  const { rand } = stage;
  const m = (c) => stage.mat(c);
  const body = m(coat), dark = m(mane), hoofM = m('#24201c'), white = m('#e8e2d6');
  const g = new THREE.Group();
  const torso = new THREE.Group(); g.add(torso);
  const barrel = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), body); barrel.scale.set(0.82, 0.9, 2.05); barrel.position.set(0, 1.28, 0); torso.add(barrel);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), body); chest.scale.set(0.95, 1.05, 1); chest.position.set(0, 1.33, 0.72); torso.add(chest);
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 14), body); rump.scale.set(1, 1, 1.05); rump.position.set(0, 1.36, -0.72); torso.add(rump);
  for (const o of [barrel, chest, rump]) { o.castShadow = true; o.receiveShadow = true; }
  // legs: a thigh and a cannon each, with a dark hoof (and white socks if asked)
  const legGeo = new THREE.CylinderGeometry(0.06, 0.09, 1, 10);
  const thighGeo = new THREE.CylinderGeometry(0.12, 0.16, 1, 12);
  for (const [x, z, back] of [[-0.2, 0.75, 0], [0.2, 0.75, 0], [-0.21, -0.78, 1], [0.21, -0.78, 1]]) {
    const top = V(x, 1.15, z), knee = V(x * 1.05, 0.55, z + (back ? -0.08 : 0.03)), foot = V(x, 0.08, z + (back ? 0.02 : 0));
    torso.add(limb(thighGeo, top, knee, body));
    torso.add(limb(legGeo, knee, foot, socks && rand() < 0.6 ? white : body));
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.12, 10), hoofM); h.position.set(foot.x, 0.06, foot.z); torso.add(h);
  }
  // neck and head pivot at the withers so the horse can lower its head to graze
  const neckPivot = new THREE.Group(); neckPivot.position.set(0, 1.5, 0.78); g.add(neckPivot);
  const neck = limb(new THREE.CylinderGeometry(0.17, 0.3, 1, 14), V(0, 0, 0), V(0, 0.62, 0.42), body); neckPivot.add(neck);
  const maneM = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 1, 1, 1, 8), dark);
  maneM.position.set(0.05, 0.4, 0.13); maneM.rotation.x = -0.6; maneM.scale.z = 0.78; neckPivot.add(maneM);
  const head = new THREE.Group(); head.position.set(0, 0.66, 0.46); neckPivot.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), body); skull.scale.set(0.9, 1, 1.2); head.add(skull);
  const face = limb(new THREE.CylinderGeometry(0.085, 0.14, 1, 14), V(0, 0, 0.05), V(0, -0.3, 0.42), body); head.add(face);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), m(blaze ? '#d9cfc0' : coat)); muzzle.scale.set(1, 0.85, 1.1); muzzle.position.set(0, -0.32, 0.46); head.add(muzzle);
  if (blaze) { const b = limb(new THREE.CylinderGeometry(0.03, 0.04, 1, 6), V(0, 0.12, 0.17), V(0, -0.28, 0.5), white); head.add(b); }
  const ears = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), body); e.scale.z = 0.6; e.position.set(sx * 0.08, 0.17, -0.04); e.rotation.z = sx * -0.25; head.add(e); ears.push(e);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), m('#0b0807')); eye.position.set(sx * 0.13, 0.02, 0.08); head.add(eye);
  }
  const fore = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), dark); fore.position.set(0, 0.16, 0.1); fore.rotation.x = 2.4; head.add(fore);
  // the tail: a few strands from the dock, swishing slowly
  const tail = new THREE.Group(); tail.position.set(0, 1.45, -1.1); g.add(tail);
  for (let k = 0; k < 5; k++) {
    const s = limb(new THREE.CylinderGeometry(0.03, 0.07, 1, 6), V((k - 2) * 0.025, 0, 0), V((k - 2) * 0.05, -0.85 - rand() * 0.15, -0.18), dark);
    tail.add(s);
  }
  g.position.set(...pos); g.rotation.y = ry; g.scale.setScalar(scale);
  stage.add(g);

  // gentle behaviour: grazing bouts, tail swishes, ear flicks, slow breathing
  let headDown = mode === 'graze' ? 1 : 0, target = headDown, nextChange = 4 + rand() * 6, swish = 0, nextSwish = 3 + rand() * 4, flick = 0, phase = rand() * 10;
  const api = {
    group: g, head, neckPivot,
    nicker() { target = 0; nextChange = Math.max(nextChange, phase + 6); flick = 1; },
  };
  stage.on((t, dt) => {
    phase = t;
    if (t > nextChange) {
      if (mode === 'graze') { target = target > 0.5 ? 0 : 1; nextChange = t + (target ? 9 + rand() * 10 : 5 + rand() * 6); }
      else { target = mode === 'rest' ? (target > 0.2 ? 0 : 0.35) : (rand() < 0.3 ? 0.15 : 0); nextChange = t + 8 + rand() * 10; }
    }
    headDown += (target - headDown) * Math.min(1, dt * 0.6);
    neckPivot.rotation.x = 0.15 + headDown * (mode === 'graze' ? 1.05 : 0.5) + Math.sin(t * 0.5) * 0.02;
    head.rotation.x = headDown * 0.35 + (headDown > 0.8 ? Math.sin(t * 2.2) * 0.04 : 0); // nibbling
    if (t > nextSwish) { swish = 1; nextSwish = t + 3 + rand() * 7; }
    swish *= Math.exp(-dt * 0.9);
    tail.rotation.y = Math.sin(t * 2.4) * 0.45 * swish + Math.sin(t * 0.4) * 0.05;
    tail.rotation.x = 0.15 + swish * 0.1;
    if (rand() < dt * 0.12) flick = 1;
    flick *= Math.exp(-dt * 3);
    ears[0].rotation.x = -flick * 0.6; ears[1].rotation.x = Math.sin(t * 0.3) * 0.1;
    const breath = Math.sin(t * 1.1 + phase * 0) * 0.012;
    torso.scale.set(1 + breath, 1 + breath, 1);
  });
  return api;
}

/**
 * A cat. Poses: 'sit', 'curl' (asleep, breathing slowly, now and then stretching), 'walk'
 * (padding along, for a patrol). `coat` and `stripe` set the colours.
 */
export function cat(stage, { coat = '#8a7a6a', stripe = '#4a3f36', belly = '#d9cfc2', pose = 'curl', pos = [0, 0, 0], ry = 0, scale = 1 } = {}) {
  const m = (c) => stage.mat(c);
  const fur = m(coat), dark = m(stripe), light = m(belly);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), fur);
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), fur); skull.scale.set(1.1, 0.95, 1); head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), light); muzzle.position.set(0, -0.03, 0.08); muzzle.scale.set(1.2, 0.8, 0.9); head.add(muzzle);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), fur); ear.position.set(sx * 0.06, 0.09, -0.01); ear.rotation.z = sx * -0.3; head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), m('#d8c35a')); eye.position.set(sx * 0.042, 0.015, 0.088); eye.scale.z = 0.5; head.add(eye); eyes.push(eye);
  }
  const tail = new THREE.Group();
  const segs = [];
  for (let k = 0; k < 9; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.03 - k * 0.0012, 8, 6), k % 3 === 1 ? dark : fur); tail.add(s); segs.push(s); }
  const legs = [];
  for (const [x, z] of [[-0.06, 0.1], [0.06, 0.1], [-0.06, -0.1], [0.06, -0.1]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.14, 6), fur); l.position.set(x, 0.07, z); legs.push(l); g.add(l); }
  g.add(body, head, tail);
  for (const o of [body, skull]) o.castShadow = true;
  g.position.set(...pos); g.rotation.y = ry; g.scale.setScalar(scale);
  stage.add(g);

  let p = pose, stretch = 0, nextStretch = 15 + stage.rand() * 20;
  const api = { group: g, set pose(v) { p = v; }, get pose() { return p; }, stride: 0 };
  stage.on((t, dt) => {
    const breathe = Math.sin(t * 1.2) * 0.03;
    legs.forEach((l) => { l.visible = p !== 'curl'; });
    if (p === 'curl') {
      if (t > nextStretch) { stretch = 1; nextStretch = t + 25 + stage.rand() * 30; }
      stretch = Math.max(0, stretch - dt * 0.25);
      const st = Math.sin(Math.min(1, stretch) * Math.PI);
      body.scale.set(1.25 + breathe, 0.62 + breathe * 0.5, 1.15 + st * 0.35); body.position.set(0, 0.1, 0);
      head.position.set(0.1, 0.1 + st * 0.06, 0.12); head.rotation.set(0.5 - st * 0.4, -0.6, 0.3);
      eyes.forEach((e) => { e.scale.y = st > 0.3 ? 0.6 : 0.12; });
      segs.forEach((s, k) => { const a = 0.6 + k * 0.35; s.position.set(Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2 - 0.02); });
    } else if (p === 'sit') {
      body.scale.set(0.95, 1.15 + breathe * 0.4, 0.9); body.position.set(0, 0.17, -0.02);
      head.position.set(0, 0.36, 0.04); head.rotation.set(Math.sin(t * 0.3) * 0.05, Math.sin(t * 0.21) * 0.3, 0);
      eyes.forEach((e) => { e.scale.y = Math.sin(t * 0.7) > 0.97 ? 0.15 : 1; });
      segs.forEach((s, k) => { const a = -1.4 + k * 0.28; s.position.set(Math.cos(a) * 0.18, 0.02 + Math.sin(t * 1.3 - k * 0.5) * 0.008 * k, Math.sin(a) * 0.18 - 0.04); });
      legs.forEach((l, k) => { l.position.y = 0.07; l.position.z = k < 2 ? 0.08 : -0.04; });
    } else { // walk
      const w = t * 4.5;
      body.scale.set(0.95, 0.85, 1.55); body.position.set(0, 0.2 + Math.sin(w * 2) * 0.006, 0);
      head.position.set(0, 0.29, 0.22); head.rotation.set(0.1, Math.sin(t * 0.6) * 0.2, 0);
      eyes.forEach((e) => { e.scale.y = 1; });
      legs.forEach((l, k) => { const s = Math.sin(w + (k === 0 || k === 3 ? 0 : Math.PI)); l.position.set(l.position.x, 0.07 + Math.max(0, s) * 0.02, (k < 2 ? 0.11 : -0.11) + s * 0.04); });
      segs.forEach((s, k) => { s.position.set(Math.sin(t * 1.5 - k * 0.4) * 0.012 * k, 0.24 + k * 0.03, -0.24 - k * 0.012); });
    }
  });
  return api;
}

/**
 * A little person, about 1.7 m: 'hiker' (backpack, woolly hat), 'chef' (whites, tall hat),
 * 'choir' (a robe with a white surplice). Walks, sways or works, gently.
 */
export function person(stage, { kind = 'hiker', pos = [0, 0, 0], ry = 0, coat = '#3f5a7a', skin = '#e2b597', scale = 1 } = {}) {
  const m = (c) => stage.mat(c);
  const g = new THREE.Group();
  const robe = kind === 'choir';
  const torso = new THREE.Mesh(robe ? new THREE.CylinderGeometry(0.17, 0.32, 1.25, 14) : new THREE.CapsuleGeometry(0.18, 0.45, 6, 12), m(kind === 'chef' ? '#f2efe8' : robe ? '#5b1f2b' : coat));
  torso.position.y = robe ? 0.65 : 1.05; g.add(torso);
  if (robe) { const sur = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.26, 0.5, 14), m('#f4f1ea')); sur.position.y = 1.1; g.add(sur); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), m(skin)); head.position.y = 1.5; g.add(head);
  const legs = [];
  if (!robe) for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.6, 4, 8), m(kind === 'chef' ? '#2d2d33' : '#3a3530')); l.position.set(sx * 0.09, 0.42, 0); g.add(l); legs.push(l); }
  if (kind === 'hiker') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.18), m('#b0502f')); pack.position.set(0, 1.12, -0.2); g.add(pack);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m('#c9a227')); hat.position.y = 1.53; g.add(hat);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), m('#c9a227')); bob.position.y = 1.67; g.add(bob);
  } else if (kind === 'chef') {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.28, 12), m('#ffffff')); hat.position.y = 1.72; g.add(hat);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), m('#ffffff')); puff.position.y = 1.86; puff.scale.y = 0.6; g.add(puff);
  } else if (robe) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), m(['#3b2a1f', '#a77c4f', '#1f1a17', '#c9b18a'][Math.floor(stage.rand() * 4)])); hair.position.y = 1.52; g.add(hair);
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), m('#2a1d18')); book.position.set(0, 1.12, 0.22); book.rotation.x = -0.6; g.add(book);
  }
  const arms = [];
  for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.45, 4, 8), m(kind === 'chef' ? '#f2efe8' : robe ? '#5b1f2b' : coat)); a.position.set(sx * 0.24, 1.08, robe ? 0.08 : 0); a.rotation.x = robe ? -0.9 : 0; g.add(a); arms.push(a); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(...pos); g.rotation.y = ry; g.scale.setScalar(scale);
  stage.add(g);
  const seed = stage.rand() * 10;
  const api = { group: g, head, arms, legs, walking: kind === 'hiker', puzzled: 0 };
  stage.on((t) => {
    if (api.walking) {
      const w = t * 3.6;
      legs.forEach((l, k) => { l.rotation.x = Math.sin(w + k * Math.PI) * 0.45; });
      arms.forEach((a, k) => { a.rotation.x = Math.sin(w + (1 - k) * Math.PI) * 0.35; });
      torso.position.y = 1.05 + Math.abs(Math.sin(w)) * 0.02;
    } else if (kind === 'chef') {
      arms.forEach((a, k) => { a.rotation.x = -0.9 + Math.sin(t * 1.6 + k * 1.3) * 0.25; }); // kneading
      head.rotation.y = Math.sin(t * 0.2 + seed) * 0.4;
    } else if (robe) {
      g.rotation.z = Math.sin(t * 0.5 + seed) * 0.02;
      head.position.y = 1.5 + Math.sin(t * 0.6 + seed) * 0.008;
    }
    if (api.puzzled) { head.rotation.z = Math.sin(t * 0.8) * 0.18 * api.puzzled; arms[1].rotation.x = -2.5 * api.puzzled; arms[1].rotation.z = 0.4 * api.puzzled; }
  });
  return api;
}
