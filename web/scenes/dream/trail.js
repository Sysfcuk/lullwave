// The Endless Hiking Trail: a little hiker walks a path that never ends, through rolling green
// hills between stone walls and woods, past wildflowers and signposts to imaginary places, while
// far ahead a mountain range slowly rises out of the haze and grows grander as the night goes on.
// The sky glows like a long sunset. The trail repeats every P metres, seamlessly.
import { createStage, scatter, canvasTexture, treeGeo, paint, mergeAll, THREE, TAU } from '../kit.js';
import { person } from '../figures.js';
import { makeSky, lightAt, lightDir, makeGrass, updateGrass, grassMaterial } from '../country.js';

const P = 720;

export function createTrailScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x7a11, bg: '#d8a986', fog: { color: '#d8a986', near: 120, far: 900 }, exposure: 1.05, bloom: [0.45, 0.55, 0.78], finish: { vignette: 0.4, grain: 0.02, ca: 0.3 }, fov: 55 });
  const { rand } = S;
  const ph = [rand() * TAU, rand() * TAU, rand() * TAU];
  const w = (k) => (k * TAU) / P;
  const pathX = (z) => 14 * Math.sin(z * w(2) + ph[0]) + 6 * Math.sin(z * w(5) + ph[1]);
  const ground = (x, z) => 6 * Math.sin(z * w(3) + ph[2]) * Math.cos(x * 0.011) + 3 * Math.sin(z * w(7) + x * 0.02) + Math.abs(x - pathX(z)) * 0.04;

  const U = { uDusk: { value: 0.3 }, uTime: S.U.uTime, uSunDir: { value: new THREE.Vector3(-0.2, 0.07, -1).normalize() }, uHorizonCol: { value: new THREE.Color() }, uZenithCol: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() } };
  const sky = makeSky(U); sky.renderOrder = -1; S.add(sky);
  const hemi = new THREE.HemisphereLight('#fff', '#444', 1); S.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 1); S.add(sun); S.add(sun.target);

  // the hills
  const gGeo = new THREE.PlaneGeometry(900, P + 900, mobile ? 130 : 180, mobile ? 260 : 360);
  gGeo.rotateX(-Math.PI / 2); gGeo.translate(0, 0, -(P + 900) / 2 + 120);
  { const p = gGeo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, ground(x, z)); const d = Math.abs(x - pathX(z)); c.set(d < 1.3 ? '#b4a07a' : Math.sin(x * 0.02 + Math.sin(z * w(4)) * 2) > 0.3 ? '#6e9a40' : '#5f8a38'); col.set([c.r, c.g, c.b], i * 3); }
    gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); gGeo.computeVertexNormals(); }
  S.add(new THREE.Mesh(gGeo, grassMaterial(null)));
  const grass = makeGrass({
    count: mobile ? 12000 : 20000, box: 26, U: { ...S.U, uPhT: { value: new THREE.Vector3(...ph) } }, rand, tint: '#5f8f36',
    groundGLSL: `uniform vec3 uPhT;
      float pathXg(float z){ float k = 6.2831853 / ${P}.; return 14. * sin(z * k * 2. + uPhT.x) + 6. * sin(z * k * 5. + uPhT.y); }
      float groundH(float x, float z){ float k = 6.2831853 / ${P}.; return 6. * sin(z * k * 3. + uPhT.z) * cos(x * .011) + 3. * sin(z * k * 7. + x * .02) + abs(x - pathXg(z)) * .04; }`,
    shortGLSL: 'float shortK(float x, float z){ return mix(.05, 1., smoothstep(1., 2.6, abs(x - pathXg(z)))); }',
  });
  S.add(grass);

  // two copies of everything along the way: this stretch and the next
  const along = (fn) => { const out = []; for (const tile of [0, -P]) for (const it of fn()) out.push([it[0], it[1], it[2] + tile, it[3], it[4]]); return out; };
  const treeItems = (() => { const out = []; for (let k = 0; k < 340; k++) { const z = -rand() * P, x = pathX(z) + (rand() < 0.5 ? -1 : 1) * (12 + rand() * 200); if (Math.sin(x * 0.03 + z * 0.01) < 0.2 && rand() < 0.7) continue; out.push([x, ground(x, z) - 0.3, z, 0.9 + rand() * 0.8, rand() * 6]); } return out; })();
  scatter(S, treeGeo(rand, { canopy: '#47703a' }), along(() => treeItems));
  const wallGeo = paint(new THREE.BoxGeometry(3.05, 0.75, 0.42, 3, 2, 1).translate(0, 0.25, 0), new THREE.Color('#a9967a'));
  { const p = wallGeo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.3) p.setY(i, p.getY(i) + (Math.sin(i * 12.9) * 0.5) * 0.1); }
  wallGeo.computeVertexNormals();
  const wallItems = []; for (let z = 0; z > -P; z -= 3) for (const side of [-1, 1]) { const x = pathX(z) + side * 3.4; if (Math.sin(z * 0.02 + side) > 0.6) continue; wallItems.push([x, ground(x, z) - 0.15, z, 1, Math.atan2(pathX(z - 1) - pathX(z + 1), 2) + Math.PI / 2]); }
  scatter(S, wallGeo, along(() => wallItems));

  // signposts to places you will never quite reach
  const PLACES = [['Dreamland', '½'], ['Slumber Peak', '3'], ['The Land of Nod', '1¼'], ['Nowhere in Particular', '∞'], ['Bed', '→'], ['Somewhere Lovely', '2'], ['Snoozeby-on-the-Wold', '4'], ['Yawning Vale', '¾']];
  const signTex = (a, b) => canvasTexture(S, 512, 96, (g, W, H) => { g.fillStyle = '#e7dcc2'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W - 48, 0); g.lineTo(W, H / 2); g.lineTo(W - 48, H); g.lineTo(0, H); g.fill(); g.fillStyle = '#2b2620'; g.font = 'bold 40px Georgia, serif'; g.textBaseline = 'middle'; g.fillText(a, 18, H / 2 + 2); g.textAlign = 'right'; g.fillText(b, W - 60, H / 2 + 2); });
  for (let k = 0; k < 6; k++) {
    const z = -60 - k * (P / 6), x = pathX(z) + 2.4;
    for (const tile of [0, -P]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.4, 6), S.mat('#5a4330')); post.position.set(x, ground(x, z + tile) + 1.2, z + tile); S.add(post);
      for (let j = 0; j < 2; j++) {
        const [a, b] = PLACES[(k * 2 + j) % PLACES.length];
        const arm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshLambertMaterial({ map: signTex(a, b), side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: null, emissiveIntensity: 0 }));
        arm.position.set(x + (j ? -0.7 : 0.7), ground(x, z + tile) + 2 - j * 0.38, z + tile); arm.rotation.y = j ? Math.PI * 0.85 : 0.25; S.add(arm);
      }
    }
  }

  // the mountains: a range far ahead that rises out of the haze as the night goes on
  const range = (() => {
    const parts = [];
    for (let k = 0; k < 14; k++) {
      const h = 140 + rand() * 220, r = 120 + rand() * 160;
      const c = new THREE.ConeGeometry(r, h, 7, 6); c.translate((k - 7) * 190 + rand() * 60, h / 2, -rand() * 160);
      const p = c.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), snowy = y > h * 0.62; p.setX(i, p.getX(i) + (Math.sin(i * 7.1) * 0.5) * 14); const cc = new THREE.Color(snowy ? '#eef0f6' : '#6a6f86'); col.set([cc.r, cc.g, cc.b], i * 3); }
      c.setAttribute('color', new THREE.BufferAttribute(col, 3));
      for (const k2 of Object.keys(c.attributes)) if (!['position', 'color'].includes(k2)) c.deleteAttribute(k2);
      parts.push(c.toNonIndexed());
    }
    const g = mergeAll(parts); g.computeVertexNormals();
    // far beyond the fog, so they carry their own haze: a pale tint over their colours
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false, color: '#c7b4c6' }));
    S.add(m); return m;
  })();

  // the hiker, a few steps ahead
  const hiker = person(S, { kind: 'hiker', coat: '#3a6a8a' });
  let s0 = 30, dusk = 0.3, rise = 0.25;
  const look = new THREE.Vector3(), cam = new THREE.Vector3(), kd = new THREE.Vector3();
  S.on((t, dt, st) => {
    const e = st.energy;
    s0 += (0.7 + 0.6 * e) * dt; if (s0 > P) s0 -= P;
    const hz = -s0, hx = pathX(hz);
    hiker.group.position.set(hx, ground(hx, hz), hz);
    hiker.group.rotation.y = Math.atan2(pathX(hz - 1) - pathX(hz + 1), -2); // facing along the path, away from us
    const cz = hz + 8, cx = pathX(cz) + Math.sin(t * 0.05) * 1.5;
    cam.set(cx, ground(cx, cz) + 3.1, cz); S.camera.position.copy(cam);
    look.set(pathX(hz - 14), ground(pathX(hz - 14), hz - 14) + 1.4, hz - 14); S.camera.lookAt(look);
    // the sky: a long golden evening; the mountains grow out of the haze
    dusk += ((0.25 + (1 - e) * 0.7) - dusk) * Math.min(1, dt * 0.04);
    rise += (Math.min(1, 0.25 + (1 - e) * 1.2 + t * 0.002) - rise) * Math.min(1, dt * 0.02);
    range.position.set(cam.x * 0.9, -40 + rise * 40, cam.z - 1300); range.scale.set(1, 0.35 + rise * 0.75, 1);
    const L = lightAt(Math.min(1, dusk));
    U.uDusk.value = Math.min(1, dusk); U.uHorizonCol.value.copy(L.horizon); U.uZenithCol.value.copy(L.zenith); U.uSunCol.value.copy(L.sun);
    hemi.color.copy(L.hemiSky); hemi.groundColor.copy(L.hemiGround); hemi.intensity = L.hemiI;
    sun.color.copy(L.sun); sun.intensity = L.sunI;
    sun.position.copy(cam).addScaledVector(lightDir(U.uSunDir.value, Math.min(1, dusk), kd), 300); sun.target.position.copy(cam);
    S.scene.fog.color.copy(L.fog); S.scene.background = S.scene.fog.color;
    sky.position.copy(cam);
    updateGrass(grass, { cam, hemi, sun, fog: S.scene.fog });
  });
  return S.finalize({ portraitFov: 66 });
}
