// Lost on the Trail: a forest path by starlight, a glowing map route traced along it, signposts
// that cannot agree, and a small hiker who is (gently) lost. The trail is a loop, so they keep
// coming back past the same signs; now and then they stop, look about and scratch their head.
// Fireflies light the way, sort of.
import { createStage, pathRig, nightSky, moonlight, terrain, scatter, motes, canvasTexture, pineGeo, cyl, THREE, TAU } from '../kit.js';
import { person } from '../figures.js';

export function createLostScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x1057, bg: '#040814', fog: { color: '#0a1226', near: 20, far: 140 }, exposure: 1.15, bloom: [0.8, 0.55, 0.5], finish: { vignette: 0.48, grain: 0.024, ca: 0.4 }, fov: 55 });
  const { rand } = S;
  nightSky(S, { top: '#030716', horizon: '#14214a', moon: [-0.4, 0.5, -0.75], moonSize: 0.04, clouds: 0.2 });
  moonlight(S, { dir: [-0.3, 0.8, 0.4], color: '#9fb4ee', intensity: 0.9, sky: '#3a4a86', ground: '#0c1018', fill: 0.6 });

  // the loop: a wobbly circle through the woods
  const R = 30;
  const loopAt = (u) => { const a = u * TAU, r = R + 6 * Math.sin(a * 3 + 1) + 3 * Math.sin(a * 5); return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); };
  const height = (x, z) => 0.8 * Math.sin(x * 0.07) * Math.cos(z * 0.06);
  terrain(S, { size: 260, seg: mobile ? 100 : 140, height, color: () => '#1d2a1c' });

  // the woods, thick except along the path
  const near = (x, z) => { let m = 1e9; for (let k = 0; k < 64; k++) { const p = loopAt(k / 64); m = Math.min(m, Math.hypot(p.x - x, p.z - z)); } return m; };
  const pines = [];
  for (let k = 0; k < (mobile ? 260 : 380); k++) { const a = rand() * TAU, r = Math.sqrt(rand()) * 110, x = Math.cos(a) * r, z = Math.sin(a) * r; if (near(x, z) < 5) continue; pines.push([x, height(x, z) - 0.2, z, 0.8 + rand() * 1.1, rand() * 6]); }
  scatter(S, pineGeo(rand, { col: '#173022' }), pines);

  // the glowing route, traced along the path like a map line, with a "you are here" pin
  const N = 220, pts = [], seeds = [];
  for (let k = 0; k < N; k++) { const p = loopAt(k / N); pts.push(p.x, height(p.x, p.z) + 0.12, p.z); seeds.push(k / N); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); rg.setAttribute('aU', new THREE.Float32BufferAttribute(seeds, 1));
  const route = new THREE.Points(rg, new THREE.ShaderMaterial({
    uniforms: { uTime: S.U.uTime, uScale: S.U.uScale }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aU; uniform float uTime, uScale; varying float vA;
      void main(){ vec4 mv = viewMatrix * vec4(position, 1.); float d = -mv.z; gl_PointSize = max(2., uScale * .16 / d);
        vA = (.45 + .55 * step(.5, fract(aU * 110. - uTime * .25))) * smoothstep(60., 6., d); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vec3(.25, 1., .55) * vA * (exp(-r * 6.) * 1.4 + exp(-r * 2.) * .3), 1.); }',
  }));
  route.frustumCulled = false; S.add(route);
  const pinTex = canvasTexture(S, 128, 160, (g) => { g.fillStyle = '#ff5a6a'; g.beginPath(); g.arc(64, 56, 46, Math.PI, 0); g.lineTo(64, 150); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 56, 18, 0, TAU); g.fill(); });
  const pin = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinTex, transparent: true, depthWrite: false, toneMapped: false })); pin.scale.set(0.7, 0.88, 1); S.add(pin);

  // signposts that cannot agree with one another
  const SIGNS = [['This way', '→'], ['No, this way', '←'], ['You were here', '↻'], ['Start (again)', '→'], ['Definitely this way', '↑'], ['Car park', '?'], ['Shortcut', '→'], ['Back the way you came', '←']];
  const armTex = (a, b, flip) => canvasTexture(S, 512, 96, (g, W, H) => { g.fillStyle = '#d6c7a4'; g.beginPath(); if (flip) { g.moveTo(48, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(48, H); g.lineTo(0, H / 2); } else { g.moveTo(0, 0); g.lineTo(W - 48, 0); g.lineTo(W, H / 2); g.lineTo(W - 48, H); g.lineTo(0, H); } g.fill(); g.fillStyle = '#2b2620'; g.font = 'bold 40px Georgia, serif'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(`${a} ${b}`, W / 2, H / 2 + 2); });
  for (let k = 0; k < 5; k++) {
    const p = loopAt(k / 5 + 0.03), o = loopAt(k / 5 + 0.031).sub(p).normalize(), side = new THREE.Vector3(-o.z, 0, o.x);
    const x = p.x + side.x * 2.2, z = p.z + side.z * 2.2, y = height(x, z);
    cyl(S, 0.07, 0.08, 2.4, '#4a3828', [x, y + 1.2, z], 6);
    for (let j = 0; j < 2; j++) {
      const [a, b] = SIGNS[(k * 2 + j) % SIGNS.length];
      const arm = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.32), new THREE.MeshLambertMaterial({ map: armTex(a, b, j === 1), side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: null, emissiveIntensity: 0 }));
      arm.position.set(x, y + 2 - j * 0.4, z); arm.rotation.y = Math.atan2(o.x, o.z) + (j ? 2.4 : -0.5) + (rand() - 0.5) * 0.6; S.add(arm);
    }
  }

  // fireflies, and the hiker
  motes(S, { kind: 'firefly', count: mobile ? 80 : 130, box: [80, 3, 80], center: [0, 1.3, 0], color: '#d9ff8a', size: 0.1, speed: 0.5 });
  const hiker = person(S, { kind: 'hiker', coat: '#7a4a6a' });
  const torch = new THREE.PointLight('#ffd9a0', 2.5, 9, 2); S.add(torch);
  let u = 0, stopUntil = 0, nextStop = 30;
  const hp = new THREE.Vector3(), ahead = new THREE.Vector3(), cam = new THREE.Vector3();
  S.on((t, dt, st) => {
    const walking = t > stopUntil;
    if (t > nextStop) { stopUntil = t + 7; nextStop = t + 35 + rand() * 25; }
    hiker.walking = walking;
    hiker.puzzled += ((walking ? 0 : 1) - hiker.puzzled) * Math.min(1, dt * 2);
    if (walking) u = (u + dt * (0.5 + 0.4 * st.energy) / (TAU * R)) % 1;
    hp.copy(loopAt(u)); hp.y = height(hp.x, hp.z);
    ahead.copy(loopAt((u + 0.01) % 1));
    hiker.group.position.copy(hp);
    hiker.group.rotation.y = Math.atan2(ahead.x - hp.x, ahead.z - hp.z) + (walking ? 0 : Math.sin(t * 0.7) * 0.8);
    torch.position.set(hp.x, hp.y + 1.3, hp.z);
    pin.position.set(hp.x, hp.y + 2.6 + Math.sin(t * 1.5) * 0.08, hp.z);
    // follow a little behind and above
    const back = loopAt((u - 0.035 + 1) % 1);
    cam.set(back.x * 1.06, height(back.x, back.z) + 3.2, back.z * 1.06);
    S.camera.position.lerp(cam, Math.min(1, dt * 1.5));
    S.camera.lookAt(hp.x, hp.y + 1.1, hp.z);
  });
  S.camera.position.copy(loopAt(0.965)).multiplyScalar(1.06).setY(3);
  return S.finalize({ portraitFov: 66 });
}
