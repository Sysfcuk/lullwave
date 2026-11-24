// Pineapple Fever Dream: the pizzeria's sign said no pineapple, and this is the dream that
// followed. A checkerboard floor rolls gently away forever under a pastel night; a pineapple
// moon hangs in the sky; a pineapple house glows on its little hill; pineapples, pineapple rings
// and slices of (pineapple) pizza drift past and tumble, very slowly, through the air. The old
// sign floats by, forlorn. The sky's colours wander and the whole thing breathes with the music.
import { createStage, orbitRig, nightSky, moonlight, motes, canvasTexture, paint, mergeAll, THREE, TAU } from '../kit.js';

/** One pineapple as a single painted geometry: a criss-cross body and a crown of leaves. */
function pineappleGeo() {
  const body = new THREE.SphereGeometry(0.5, 30, 22).toNonIndexed(); body.scale(1, 1.35, 1);
  { // criss-cross diamonds painted face by face
    const p = body.attributes.position, c = new Float32Array(p.count * 3), a = new THREE.Color('#e3b23c'), b = new THREE.Color('#a8742a'), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      v.set(0, 0, 0); for (let j = 0; j < 3; j++) v.x += p.getX(i + j) / 3, v.y += p.getY(i + j) / 3, v.z += p.getZ(i + j) / 3;
      const ang = Math.atan2(v.z, v.x), l1 = Math.abs(Math.sin(ang * 7 + v.y * 11)), l2 = Math.abs(Math.sin(ang * 7 - v.y * 11));
      const col = Math.min(l1, l2) < 0.22 ? b : a; // criss-cross lines make the diamonds
      for (let j = 0; j < 3; j++) c.set([col.r, col.g, col.b], (i + j) * 3);
    }
    body.setAttribute('color', new THREE.BufferAttribute(c, 3)); body.deleteAttribute('uv');
  }
  const parts = [body];
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * TAU, tall = k % 2 ? 0.75 : 0.95;
    const leaf = new THREE.ConeGeometry(0.09, tall, 4); leaf.translate(0, tall / 2, 0);
    leaf.rotateZ(-0.45 - (k % 3) * 0.12); leaf.rotateY(a); leaf.translate(0, 0.6, 0);
    parts.push(paint(leaf, new THREE.Color(k % 3 ? '#4f9a3a' : '#3a7a2e')).toNonIndexed());
  }
  const g = mergeAll(parts); g.computeVertexNormals(); return g;
}
/** A slice of pizza with pineapple on it, naturally. */
function sliceGeo() {
  const base = paint(new THREE.CylinderGeometry(1, 1, 0.08, 1, 1, false, -0.35, 0.7), new THREE.Color('#f0c66a')).toNonIndexed();
  const crust = paint(new THREE.CylinderGeometry(1.02, 1.02, 0.16, 8, 1, true, -0.35, 0.7).translate(0, 0.02, 0), new THREE.Color('#c98a3a')).toNonIndexed();
  const parts = [base, crust];
  for (const [r, a, col] of [[0.45, -0.1, '#c0392b'], [0.7, 0.12, '#f4d03f'], [0.55, 0.18, '#c0392b'], [0.8, -0.15, '#f4d03f'], [0.3, 0.08, '#f4d03f']]) {
    const t = paint(new THREE.BoxGeometry(0.11, 0.06, 0.11), new THREE.Color(col)).toNonIndexed(); t.translate(Math.sin(a) * r, 0.06, Math.cos(a) * r); parts.push(t);
  }
  const g = mergeAll(parts); g.computeVertexNormals(); return g;
}

export function createFeverScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xfe7e, bg: '#1a1038', fog: { color: '#3a2458', near: 40, far: 260 }, exposure: 1.1, bloom: [0.7, 0.6, 0.55], finish: { vignette: 0.42, grain: 0.022, ca: 0.8 }, fov: 58 });
  const { rand } = S;
  const sky = nightSky(S, { top: '#140c3a', horizon: '#c06a9a', moon: [-0.25, 0.32, -0.9], moonSize: 0.001, stars: 1.3, clouds: 0.5, cloudColor: '#6a4a9a', tint: '#ffb070' });
  const hemi = moonlight(S, { dir: [-0.3, 0.6, -0.7], color: '#ffd9a0', intensity: 0.9, sky: '#b08ad8', ground: '#2a3a5a', fill: 0.9 }).hemi;
  const su = sky.userData.u, top0 = new THREE.Color('#140c3a'), hor0 = new THREE.Color('#c06a9a'), hsl = {};

  // the moon is a pineapple ring
  const ringTex = canvasTexture(S, 256, 256, (g) => {
    const c = 128; g.fillStyle = '#f7d65a'; g.beginPath(); g.arc(c, c, 118, 0, TAU); g.fill();
    g.strokeStyle = '#e8a83a'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, 112, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(232,168,58,.6)'; g.lineWidth = 3; for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * 40, c + Math.sin(a) * 40); g.lineTo(c + Math.cos(a) * 104, c + Math.sin(a) * 104); g.stroke(); }
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(c, c, 34, 0, TAU); g.fill();
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, fog: false, depthWrite: false, toneMapped: false, color: '#c9a858' })); moon.scale.setScalar(130); S.add(moon);
  const glowTex = canvasTexture(S, 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,220,140,.22)'); gr.addColorStop(1, 'rgba(255,180,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); moonGlow.scale.setScalar(340); S.add(moonGlow);
  const moonDir = new THREE.Vector3(-0.25, 0.32, -0.9).normalize();

  // the floor: a checkerboard that rolls gently away for ever
  const check = canvasTexture(S, 128, 128, (g) => { for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { g.fillStyle = (r + c) % 2 ? '#2f8f8a' : '#f2d27a'; g.fillRect(c * 64, r * 64, 64, 64); } });
  check.wrapS = check.wrapT = THREE.RepeatWrapping; check.repeat.set(70, 70); check.magFilter = THREE.NearestFilter;
  const SEG = mobile ? 90 : 130, floorGeo = new THREE.PlaneGeometry(560, 560, SEG, SEG); floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ map: check })); S.add(floor);
  const fp = floorGeo.attributes.position, base = Float32Array.from(fp.array);
  const wave = (x, z, t) => 1.6 * Math.sin(x * 0.035 + t * 0.12) * Math.cos(z * 0.03 - t * 0.09) + 0.8 * Math.sin((x + z) * 0.05 + t * 0.07) + Math.max(0, 22 - Math.hypot(x, z)) * 0.12;
  let lastWave = -1;

  // the giant pineapple on its little hill, pink sparkles rising from its crown
  const pg = pineappleGeo();
  const home = new THREE.Group(); S.add(home);
  const house = new THREE.Mesh(pg, S.vmat); house.scale.setScalar(9); home.add(house);
  // ...who is fast asleep: closed eyes, rosy cheeks, Zs drifting up
  const onShell = (ang, h, out = 0.06) => { const R = 4.5 * Math.sqrt(Math.max(0, 1 - (h / 6.08) ** 2)) + out; return new THREE.Vector3(Math.sin(ang) * R, h, Math.cos(ang) * R); };
  const face = (o, ang, h, out) => { o.position.copy(onShell(ang, h, out)); o.lookAt(o.position.clone().multiplyScalar(3).setY(h)); home.add(o); return o; };
  for (const sx of [-1, 1]) {
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.13, 8, 20, Math.PI), S.mat('#3a2410')); lid.rotation.z = Math.PI;
    const g = new THREE.Group(); g.add(lid); face(g, sx * 0.42, 0.6, 0.05);
    const lash = new THREE.Group(); for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.06), S.mat('#3a2410')); const a2 = Math.PI + 0.6 + k * 0.5; l.position.set(Math.cos(a2) * 0.96, Math.sin(a2) * 0.96, 0); l.rotation.z = a2 + Math.PI / 2; lash.add(l); } g.add(lash);
    face(new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: '#ff8a9a', transparent: true, opacity: 0.55, depthWrite: false })), sx * 0.62, -0.6, 0.1);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 16), S.mat('#3a2410')); mouth.scale.y = 0.7; face(mouth, 0, -1.3, 0.05);
  const zTex = canvasTexture(S, 64, 64, (g) => { g.fillStyle = '#fff4d0'; g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 32, 34); });
  const zs = Array.from({ length: 4 }, (_, k) => { const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, toneMapped: false })); S.add(z); return { z, ph: k / 4 }; });
  const lamp = new THREE.PointLight('#ffb36b', 60, 40, 2); lamp.position.set(0, 9, 12); S.add(lamp);

  // things drifting through the air: pineapples, rings and slices, all tumbling very slowly
  const ringGeo = paint(new THREE.TorusGeometry(0.5, 0.2, 10, 22), new THREE.Color('#f4d03f')).toNonIndexed(); ringGeo.computeVertexNormals();
  const sg = sliceGeo();
  const kinds = [[pg, mobile ? 26 : 40, 1.4, 2.6], [ringGeo, mobile ? 18 : 28, 1.6, 2.8], [sg, mobile ? 10 : 16, 1.6, 2.4]];
  const floaters = kinds.map(([geo, n, s0, s1]) => {
    const mesh = new THREE.InstancedMesh(geo, S.vmat, n); mesh.frustumCulled = false; S.add(mesh);
    const it = Array.from({ length: n }, () => ({ a: rand() * TAU, r: 18 + rand() * 90, y: 6 + rand() * 40, s: s0 + rand() * (s1 - s0), sp: (rand() < 0.5 ? -1 : 1) * (0.004 + rand() * 0.01), bob: rand() * TAU, rot: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), rs: 0.05 + rand() * 0.12 }));
    return { mesh, it };
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();

  // the old sign, drifting by, forlorn
  const signTex = canvasTexture(S, 256, 176, (g, w, h) => {
    g.fillStyle = '#1e2a22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b26a'; g.lineWidth = 7; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#f2ede2'; g.textAlign = 'center'; g.font = 'bold 34px Georgia, serif'; g.fillText('NO', w / 2, 46); g.font = 'bold 28px Georgia, serif'; g.fillText('PINEAPPLE', w / 2, 160);
    g.fillStyle = '#d9a52a'; g.beginPath(); g.ellipse(w / 2, 94, 20, 28, 0, 0, TAU); g.fill();
    g.strokeStyle = '#e04040'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, 92, 38, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(w / 2 - 27, 65); g.lineTo(w / 2 + 27, 119); g.stroke();
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.75), new THREE.MeshLambertMaterial({ map: signTex, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.35 })); S.add(sign);

  // pink sparkles rising from the crown, and golden motes everywhere
  motes(S, { kind: 'spark', count: mobile ? 60 : 100, box: [3, 40, 3], center: [0, 34, 0], color: '#ff9ad0', size: 0.5, speed: 0.15 });
  motes(S, { kind: 'firefly', count: mobile ? 160 : 260, box: [160, 30, 160], center: [0, 12, 0], color: '#ffe08a', size: 0.22, speed: 0.25 });

  // breathe with the music
  let pulse = 0;
  S.onEvent((ev) => { if (ev.type === 'chord') pulse = 1; });

  S.on((t, dt, st) => {
    pulse *= Math.exp(-dt * 0.5);
    // the sky's colours wander, slowly
    top0.getHSL(hsl); su.uTop.value.setHSL((hsl.h + Math.sin(t * 0.012) * 0.06 + 1) % 1, hsl.s, hsl.l);
    hor0.getHSL(hsl); su.uHor.value.setHSL((hsl.h + Math.sin(t * 0.009 + 1) * 0.08 + 1) % 1, hsl.s, hsl.l * (0.9 + 0.1 * st.energy));
    S.scene.fog.color.copy(su.uHor.value).multiplyScalar(0.45); S.scene.background = S.scene.fog.color;
    su.uPulse.value = pulse * 0.5;
    hemi.intensity = 0.9 + pulse * 0.15;
    // the moon follows the sky, turning very slowly
    moon.position.copy(S.camera.position).addScaledVector(moonDir, 900); moonGlow.position.copy(moon.position);
    moon.material.rotation = t * 0.01;
    // the floor rolls (four times a second is plenty)
    if (t - lastWave > 0.25 || lastWave < 0) {
      lastWave = t;
      for (let i = 0; i < fp.count; i++) { const x = base[i * 3], z = base[i * 3 + 2]; fp.array[i * 3 + 1] = wave(x, z, t); }
      fp.needsUpdate = true; floorGeo.computeVertexNormals();
    }
    home.position.y = wave(0, 0, t) + 5.4 + Math.sin(t * 0.3) * 0.05;
    const br = Math.sin(t * 0.35); // slow sleepy breathing
    home.scale.set(1 + br * 0.012 + pulse * 0.01, 1 + br * 0.018, 1 + br * 0.012 + pulse * 0.01);
    mouth.scale.set(1 + br * 0.15, 0.7 + br * 0.2, 1);
    zs.forEach(({ z, ph }) => { const f = (t * 0.06 + ph) % 1; z.position.set(3.5 + f * 4 + Math.sin(f * 9 + ph * 7) * 0.6, home.position.y + 5.5 + f * 10, 3 + f * 2); z.scale.setScalar(0.8 + f * 1.6); z.material.opacity = Math.sin(f * Math.PI) * 0.85; });
    // the drifters
    for (const { mesh, it } of floaters) {
      it.forEach((o, i) => {
        o.a += o.sp * dt * (0.5 + 0.5 * st.energy);
        p.set(Math.cos(o.a) * o.r, o.y + Math.sin(t * 0.2 + o.bob) * 1.5, Math.sin(o.a) * o.r);
        q.setFromAxisAngle(o.rot, t * o.rs + o.bob);
        mesh.setMatrixAt(i, m4.compose(p, q, sc.setScalar(o.s)));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    const sa = t * 0.006 + 2;
    sign.position.set(Math.cos(sa) * 30, 16 + Math.sin(t * 0.15) * 1.2, Math.sin(sa) * 30);
    sign.rotation.set(Math.sin(t * 0.1) * 0.25, -sa + Math.PI / 2 + Math.sin(t * 0.07) * 0.5, Math.sin(t * 0.13) * 0.2);
  });

  orbitRig(S, { center: [0, 0, 0], radius: 34, height: 9, speed: 0.012, lookY: 9, start: 0.15, sway: 0.6, arc: 0.85 }); // swing round the front, so we can see them sleep
  return S.finalize({ portraitFov: 70 });
}
