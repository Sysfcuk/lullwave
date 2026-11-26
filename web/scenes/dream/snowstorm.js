// The Fantastical Snowstorm: a hilltop clearing in a snowy pine wood, a lantern-lit cabin with its
// chimney smoking, and a storm. Thousands of flakes ride a swirling wind; gusts surge with the music,
// snow devils spiral across the clearing, spindrift streams over the ground and the pines sway. And it
// is not an ordinary storm: giant snowflakes, each one drawn by hand of code and none alike, drift
// slowly past; groves of ice crystals glow among the trees; little snow spirits ride the wind,
// trailing light, chasing one another. As the night winds down the storm blows itself out: the wind
// drops, the fog lifts, the clouds part on the stars and the moon, an aurora unfurls, the snow falls
// gently, and the spirits settle in the treetops like fairy lights.
import { createStage, nightSky, moonlight, building, smoke, lantern, canvasTexture, paint, mergeAll, THREE, TAU } from '../kit.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

/** The lie of the snow: a gentle hill under the clearing and soft drifts all around (shared with the shaders). */
const groundH = (x, z) => 2.6 * Math.exp(-(x * x + z * z) / 500) + 0.5 * Math.sin(x * 0.08) * Math.cos(z * 0.07) + 0.25 * Math.sin(x * 0.21 + 1) * Math.sin(z * 0.17);
const GROUND_GLSL = 'float groundH(vec2 p){ return 2.6 * exp(-dot(p, p) / 500.) + .5 * sin(p.x * .08) * cos(p.y * .07) + .25 * sin(p.x * .21 + 1.) * sin(p.y * .17); }';

/** A pine heavy with snow: dark tiers, each capped in white. */
function snowPineGeo(rand) {
  const parts = [paint(new THREE.CylinderGeometry(0.14, 0.24, 1.6, 6).translate(0, 0.8, 0), new THREE.Color('#3b2a1e')).toNonIndexed()];
  const snow = new THREE.Color('#eef3fb'), green = new THREE.Color('#2e5446');
  for (let k = 0; k < 5; k++) {
    const r = 1.9 - k * 0.33, y = 1.5 + k * 1.05;
    const cone = new THREE.ConeGeometry(r, 1.9, 10, 3).translate(0, y + 0.95, 0).toNonIndexed(), p = cone.attributes.position, c = new Float32Array(p.count * 3), tmp = new THREE.Color();
    const shade = 0.85 + rand() * 0.3;
    for (let i = 0; i < p.count; i++) { const f = (p.getY(i) - y) / 1.9; tmp.copy(green).multiplyScalar(shade).lerp(snow, sstep(0.25, 0.7, f) * (0.85 + 0.15 * Math.sin(i * 1.7))); c.set([tmp.r, tmp.g, tmp.b], i * 3); }
    cone.setAttribute('color', new THREE.BufferAttribute(c, 3)); cone.deleteAttribute('uv'); cone.deleteAttribute('normal'); parts.push(cone);
  }
  const g = mergeAll(parts); g.computeVertexNormals(); return g;
}

/** A unique snowflake, six-fold: arms with branches and branchlets, a plate at the heart. */
function drawFlake(g, cx, cy, R, rand) {
  g.save(); g.translate(cx, cy);
  g.strokeStyle = 'rgba(236,246,255,.95)'; g.fillStyle = 'rgba(210,235,255,.35)'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(150,205,255,.9)'; g.shadowBlur = R * 0.06;
  const branches = Array.from({ length: 2 + Math.floor(rand() * 4) }, () => ({ t: 0.2 + rand() * 0.7, len: (0.12 + rand() * 0.32) * R, ang: 0.45 + rand() * 0.6, sub: rand() < 0.5 }));
  const tip = rand(), plate = rand(), w = R * (0.035 + rand() * 0.03);
  for (let a = 0; a < 6; a++) {
    g.save(); g.rotate((a * Math.PI) / 3);
    g.lineWidth = w; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -R); g.stroke();
    for (const b of branches) for (const s of [-1, 1]) {
      const by = -b.t * R, len = b.len * (1 - b.t * 0.45), ex = s * Math.sin(b.ang) * len, ey = by - Math.cos(b.ang) * len;
      g.lineWidth = w * 0.7; g.beginPath(); g.moveTo(0, by); g.lineTo(ex, ey); g.stroke();
      if (b.sub) { g.lineWidth = w * 0.45; for (const f of [0.45, 0.75]) { const px = ex * f, py = by + (ey - by) * f; g.beginPath(); g.moveTo(px, py); g.lineTo(px + s * len * 0.18, py - len * 0.22); g.stroke(); } }
    }
    if (tip < 0.5) { g.lineWidth = w * 0.6; g.beginPath(); for (let k = 0; k <= 6; k++) { const q = (k / 6) * TAU; g.lineTo(Math.cos(q) * R * 0.07, -R + Math.sin(q) * R * 0.07); } g.stroke(); }
    else { g.beginPath(); g.moveTo(0, -R * 1.06); g.lineTo(R * 0.05, -R * 0.94); g.lineTo(0, -R * 0.86); g.lineTo(-R * 0.05, -R * 0.94); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
  const pr = R * (0.12 + plate * 0.14);
  g.lineWidth = w * 0.6; g.beginPath(); for (let k = 0; k <= 6; k++) { const q = (k / 6) * TAU + Math.PI / 6; g.lineTo(Math.cos(q) * pr, Math.sin(q) * pr); } g.fill(); g.stroke();
  if (plate > 0.5) { g.beginPath(); for (let k = 0; k <= 6; k++) { const q = (k / 6) * TAU + Math.PI / 6; g.lineTo(Math.cos(q) * pr * 0.5, Math.sin(q) * pr * 0.5); } g.stroke(); }
  g.restore();
}

export function createSnowstormScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x5a0f, bg: '#4a546c', fog: { color: '#4a546c', near: 2, far: 40 }, exposure: 1.0, bloom: [0.6, 0.5, 0.62], finish: { vignette: 0.42, grain: 0.02, ca: 0.4 }, fov: 55 });
  const { rand } = S;
  const sky = nightSky(S, { top: '#050a1e', horizon: '#1a2448', moon: [0.45, 0.42, -0.78], moonSize: 0.04, stars: 1.5, clouds: 0.3, cloudColor: '#2a3250', crescent: 0 });
  const su = sky.userData.u;
  const { hemi, key } = moonlight(S, { dir: [0.45, 0.6, -0.6], color: '#b8c8f0', intensity: 0.6, sky: '#8a98c0', ground: '#3a4258', fill: 0.8 });

  // ---------------------------------------------------------------- the land: snow, pines that sway, the cabin
  const tg = new THREE.PlaneGeometry(320, 320, mobile ? 110 : 160, mobile ? 110 : 160).rotateX(-Math.PI / 2);
  { const p = tg.attributes.position, c = new Float32Array(p.count * 3), a = new THREE.Color('#e6ecf6'), b = new THREE.Color('#b4c0d8'), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, groundH(x, z)); tmp.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(x * 0.3 + Math.cos(z * 0.21) * 2) * Math.sin(z * 0.27)); c.set([tmp.r, tmp.g, tmp.b], i * 3); }
    tg.setAttribute('color', new THREE.BufferAttribute(c, 3)); tg.computeVertexNormals(); }
  S.add(new THREE.Mesh(tg, S.vmat));

  const CABIN = new THREE.Vector3(18, 0, -16); CABIN.y = groundH(CABIN.x, CABIN.z) - 0.2;
  const GROVES = [];
  for (let k = 0; k < 5; k++) { const a = -2.4 + k * 1.15 + rand() * 0.4, r = 5.5 + rand() * 5.5; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - CABIN.x, z - CABIN.z) < 7) continue; GROVES.push(new THREE.Vector3(x, groundH(x, z), z)); }
  const pineItems = [];
  for (let n = 0, tries = 0; n < (mobile ? 110 : 180) && tries < 3000; tries++) {
    const a = rand() * TAU, r = 22 + Math.pow(rand(), 0.7) * 70, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - CABIN.x, z - CABIN.z) < 7 || GROVES.some((g) => Math.hypot(x - g.x, z - g.z) < 4)) continue;
    pineItems.push([x, groundH(x, z) - 0.1, z, 0.8 + rand() * 0.9, rand() * TAU]); n++;
  }
  const swayU = { uWind: { value: 0 } };
  const pineMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  pineMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = S.U.uTime; sh.uniforms.uWind = swayU.uWind;
    sh.vertexShader = 'uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hgt = max(transformed.y - 1.0, 0.) / 7.;
      float ph = instanceMatrix[3][0] * .13 + instanceMatrix[3][2] * .17;
      float sw = uWind * hgt * hgt * (.65 + .35 * sin(uTime * 1.7 + ph)) + .025 * hgt * sin(uTime * .9 + ph * 2.);
      transformed.x += sw * .9; transformed.z += sw * .4;`);
  };
  { const geo = S.keep(snowPineGeo(rand)), mesh = new THREE.InstancedMesh(geo, pineMat, pineItems.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
    pineItems.forEach((it, i) => mesh.setMatrixAt(i, m4.compose(v.set(it[0], it[1], it[2]), q.setFromEuler(e.set(0, it[4], 0)), s.setScalar(it[3]))));
    S.add(mesh); }
  const cabin = building(S, { w: 6, d: 5, h: 3.2, roof: 2.4, wall: '#6a4a36', roofCol: '#e8eef8', pos: [CABIN.x, CABIN.y, CABIN.z], ry: Math.atan2(-CABIN.x, -CABIN.z), windows: [['front', -1.7, 1.7, 1, 1.1], ['front', 1.7, 1.7, 1, 1.1], ['left', 0, 1.7, 1.1, 1]], glow: '#ffb36b' });
  cabin.updateMatrixWorld(true);
  smoke(S, { pos: cabin.localToWorld(cabin.userData.chimneyTop.clone()).toArray(), color: '#a8b0c4', count: 30, rise: 7, spread: 2.2, size: 1.3, opacity: 0.16 });
  { const lp = cabin.localToWorld(new THREE.Vector3(1.4, 0, 3.4)); lantern(S, { pos: [lp.x, lp.y + 2.1, lp.z], color: '#ffb35c', intensity: 7, distance: 12 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2, 6), S.mat('#2a2018')); post.position.set(lp.x, lp.y + 1, lp.z); S.add(post); }
  const cabinLight = new THREE.PointLight('#ffb36b', 8, 16, 1.6); cabinLight.position.copy(cabin.localToWorld(new THREE.Vector3(0, 1.6, 4))); S.add(cabinLight);

  // ---------------------------------------------------------------- groves of glowing ice crystals
  const fogU = { uFogCol: { value: new THREE.Color('#4a546c') }, uFogNear: { value: 2 }, uFogFar: { value: 40 } };
  const iceU = { uTime: S.U.uTime, uCam: { value: new THREE.Vector3() }, uGlow: { value: 0.5 }, ...fogU };
  const iceMat = new THREE.ShaderMaterial({
    uniforms: iceU,
    vertexShader: `attribute float aPh, aH; varying vec3 vW, vN; varying float vPh, vH;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vPh = aPh; vH = aH; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uGlow, uFogNear, uFogFar; uniform vec3 uCam, uFogCol; varying vec3 vW, vN; varying float vPh, vH;
      void main(){
        vec3 n = normalize(vN), V = normalize(uCam - vW);
        float fr = pow(1. - abs(dot(n, V)), 2.);
        vec3 base = mix(vec3(.08, .2, .42), vec3(.62, .9, 1.), vH);
        vec3 glow = mix(vec3(.4, .9, 1.), vec3(.75, .6, 1.), .5 + .5 * sin(vPh * 6.28));
        float pulse = .6 + .4 * sin(uTime * .8 + vPh * 12.);
        vec3 col = base * (.25 + .55 * fr) + glow * uGlow * (.25 + .75 * vH) * pulse + vec3(.9, .97, 1.) * pow(fr, 4.) * .5;
        float f = smoothstep(uFogNear, uFogFar, length(vW - uCam));
        gl_FragColor = vec4(mix(clamp(col, 0., 3.), uFogCol, f * .9), 1.);
      }`,
  });
  const iceTips = [];
  const groveGlowGeo = S.keep(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2));
  const groveGlowMat = new THREE.MeshBasicMaterial({ map: canvasTexture(S, 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(140,220,255,.55)'); gr.addColorStop(1, 'rgba(140,220,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 });
  for (const gp of GROVES) {
    const parts = [], phs = [];
    const n = 6 + Math.floor(rand() * 7), ph = rand();
    for (let k = 0; k < n; k++) {
      const h = 0.9 + rand() * 3, r = 0.1 + rand() * 0.18, a = rand() * TAU, d = rand() * 1.4;
      const body = new THREE.CylinderGeometry(r * 0.85, r, h, 6).translate(0, h / 2, 0);
      const cap = new THREE.ConeGeometry(r * 0.85, r * 2.2, 6).translate(0, h + r * 1.1, 0);
      const g = mergeAll([paint(body, new THREE.Color(1, 1, 1)).toNonIndexed(), paint(cap, new THREE.Color(1, 1, 1)).toNonIndexed()]);
      const tilt = new THREE.Euler((rand() - 0.5) * 0.6 + Math.sin(a) * d * 0.25, a, -Math.cos(a) * d * 0.25 + (rand() - 0.5) * 0.4);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * d, -0.2, Math.sin(a) * d), new THREE.Quaternion().setFromEuler(tilt), new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      const cnt = g.attributes.position.count, top = h + r * 2.2;
      for (let i = 0; i < cnt; i++) { phs.push(ph + k * 0.07); }
      iceTips.push(new THREE.Vector3(0, top, 0).applyMatrix4(m).add(gp));
      parts.push(g);
    }
    const geo = mergeAll(parts); geo.computeVertexNormals();
    // height for the glow: from each vertex's height above the grove floor
    const p = geo.attributes.position, hh = new Float32Array(p.count); let maxY = 0; for (let i = 0; i < p.count; i++) maxY = Math.max(maxY, p.getY(i));
    for (let i = 0; i < p.count; i++) hh[i] = clamp(p.getY(i) / maxY, 0, 1);
    geo.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(phs), 1)); geo.setAttribute('aH', new THREE.BufferAttribute(hh, 1));
    const mesh = new THREE.Mesh(geo, iceMat); mesh.position.copy(gp); S.add(mesh);
    const gl = new THREE.Mesh(groveGlowGeo, groveGlowMat); gl.position.copy(gp).add(new THREE.Vector3(0, 0.08, 0)); S.add(gl);
  }

  // ---------------------------------------------------------------- the storm: flakes on a swirling wind
  const windU = { value: new THREE.Vector3() }, aspectU = { value: 1 };
  function snowLayer({ count, box, ground = false, size = 1, fast = 1 }) {
    const pos = new Float32Array(count * 3), sd = new Float32Array(count);
    for (let k = 0; k < count; k++) { pos.set([(rand() - 0.5) * box[0], ground ? rand() * box[1] : (rand() - 0.5) * box[1], (rand() - 0.5) * box[2]], k * 3); sd[k] = rand(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    const u = { // each layer its own settings
      uTime: S.U.uTime, uScale: S.U.uScale, uDrift: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() }, uSwirl: { value: 1 },
      uDensity: { value: 1 }, uDevil: { value: new THREE.Vector3(0, 0, 0) }, uSize: { value: 0.07 }, uBright: { value: 1 }, uVel: windU, uAspect: aspectU, uStreak: { value: 1 },
      uBox: { value: new THREE.Vector3(...box) }, uLayer: { value: size }, uFast: { value: fast },
    };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false,
      vertexShader: `attribute float aSeed; uniform float uTime, uScale, uSwirl, uDensity, uSize, uLayer, uFast, uBright, uAspect, uStreak; uniform vec3 uDrift, uC, uBox, uDevil, uVel; varying float vA; varying vec2 vDir; varying float vStretch;
        ${GROUND_GLSL}
        void main(){
          float s = aSeed;
          vec3 p = position + uDrift * vec3(uFast * (.6 + .8 * s), ${ground ? '0.' : '(.7 + .6 * s)'}, uFast * (.6 + .8 * s));
          p.x += sin(p.y * .35 + uTime * 1.3 + s * 6.28) * uSwirl * (.5 + s);
          p.z += cos(p.x * .3 + uTime * 1.1 + s * 4.) * uSwirl * (.5 + s) * .8;
          p.y += sin(p.x * .2 + uTime * .9 + s * 9.) * uSwirl * .4;
          ${ground ? 'p.xz = uC.xz + mod(p.xz - uC.xz + uBox.xz * .5, uBox.xz) - uBox.xz * .5; p.y = groundH(p.xz) + mod(p.y, uBox.y);'
                   : 'p = uC + mod(p - uC + uBox * .5, uBox) - uBox * .5;'}
          // a snow devil: flakes near it whirl round and up
          vec2 dv = p.xz - uDevil.xy; float r = length(dv), w = uDevil.z * exp(-r * r / 14.);
          float ang = w * (uTime * 2.6 + s * 6.28); float ca = cos(ang), sa = sin(ang);
          p.xz = uDevil.xy + vec2(ca * dv.x - sa * dv.y, sa * dv.x + ca * dv.y) * (1. - w * .35);
          p.y += w * 3.5 * fract(uTime * .35 + s);
          float gh = groundH(p.xz);
          vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
          float on = step(s, uDensity) * step(gh - .05, p.y);
          // stretch along the flake's motion on the screen (a streak in the wind)
          vec4 c1 = projectionMatrix * mv, c2 = projectionMatrix * viewMatrix * vec4(p + (uVel * uFast * (.6 + .8 * s) + vec3(0., -1.5, 0.)) * .045, 1.);
          vec2 sd = (c2.xy / c2.w - c1.xy / c1.w) * vec2(uAspect, 1.) * uScale * .5;
          float base = max(1., uScale * uSize * uLayer * (.5 + s) / max(d, 2.)), len = length(sd);
          vStretch = clamp(1. + len * uStreak / base, 1., 6.); vDir = len > 1e-4 ? sd / len : vec2(0., 1.);
          gl_PointSize = on * base * vStretch;
          vA = on * uBright * smoothstep(.8, 2.5, d) * (1. - smoothstep(18., 34., d)) * (.55 + .45 * s);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; varying vec2 vDir; varying float vStretch;
        void main(){ vec2 c = gl_PointCoord - .5; c.y = -c.y; vec2 q = vec2(dot(c, vDir), dot(c, vec2(-vDir.y, vDir.x)) * vStretch);
          float r = dot(q, q) * 4.; if (r > 1.) discard; gl_FragColor = vec4(vec3(.93, .96, 1.), vA * (1. - r) * .9 / sqrt(vStretch)); }`,
    }));
    pts.frustumCulled = false; S.add(pts); return u;
  }
  const flakes = snowLayer({ count: mobile ? 5000 : 8000, box: [26, 16, 26] });
  const far = snowLayer({ count: mobile ? 2500 : 4000, box: [70, 32, 70], size: 1.4 });
  const drift = snowLayer({ count: mobile ? 1600 : 2600, box: [44, 1.6, 44], ground: true, size: 0.7, fast: 1.8 });

  // ---------------------------------------------------------------- giant snowflakes, each one its own
  const atlas = canvasTexture(S, 1024, 512, (g) => { for (let i = 0; i < 8; i++) drawFlake(g, 128 + (i % 4) * 256, 128 + Math.floor(i / 4) * 256, 104, rand); });
  const giant = Array.from({ length: mobile ? 7 : 10 }, (_, i) => {
    const tex = atlas.clone(); tex.repeat.set(0.25, 0.5); tex.offset.set((i % 4) * 0.25, (1 - Math.floor((i % 8) / 4)) * 0.5 - 0.5 + 0.5); S.keep(tex);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    S.add(sp); return { sp, life: -rand() * 8, span: 10, vel: new THREE.Vector3(), spin: 0, size: 1 };
  });
  const camFwd = new THREE.Vector3(), camRight = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function spawnGiant(f) {
    const cam = S.camera; cam.getWorldDirection(camFwd); camRight.crossVectors(camFwd, up).normalize();
    f.sp.position.copy(cam.position).addScaledVector(camFwd, 4 + rand() * 9).addScaledVector(camRight, (rand() - 0.5) * 10).addScaledVector(up, 1.5 + rand() * 4);
    f.size = 0.35 + rand() * 0.9; f.spin = (rand() - 0.5) * 0.5; f.sp.material.rotation = rand() * TAU; f.life = 0; f.span = 9 + rand() * 8;
  }

  // ---------------------------------------------------------------- snow spirits, riding the wind
  const wispTex = canvasTexture(S, 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.75)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const WISPCOL = ['#bfefff', '#d8c8ff', '#fff0c0', '#c0ffe8'];
  const TRAIL = 14, NW = mobile ? 9 : 13;
  const trailPos = new Float32Array(NW * TRAIL * 3), trailA = new Float32Array(NW * TRAIL), trailC = new Float32Array(NW * TRAIL * 3);
  const spirits = Array.from({ length: NW }, (_, i) => {
    const c = new THREE.Color(WISPCOL[i % WISPCOL.length]);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: wispTex, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(0.8); S.add(sp);
    const p = new THREE.Vector3((rand() - 0.5) * 16, 3 + rand() * 4, (rand() - 0.5) * 16);
    for (let k = 0; k < TRAIL; k++) { trailPos.set(p.toArray(), (i * TRAIL + k) * 3); trailC.set([c.r, c.g, c.b], (i * TRAIL + k) * 3); }
    return { sp, p, v: new THREE.Vector3(), c, ph: rand() * TAU, perch: null, buddy: (i + 1) % NW };
  });
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('aA', new THREE.BufferAttribute(trailA, 1)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailC, 3));
  const trails = new THREE.Points(trailGeo, new THREE.ShaderMaterial({
    uniforms: { uScale: S.U.uScale }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: 'attribute float aA; uniform float uScale; varying float vA; varying vec3 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = max(1., uScale * .09 * aA / -mv.z); vA = aA; vC = color; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; varying vec3 vC; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; if (r > 1.) discard; gl_FragColor = vec4(vC * vA * (1. - r) * .8, 1.); }',
  }));
  trails.frustumCulled = false; S.add(trails);
  // perches for the calm: the tops of the nearer pines and the tips of the ice crystals
  const perches = [...iceTips.map((p) => p.clone().add(new THREE.Vector3(0, 0.25, 0))), ...pineItems.filter((it) => Math.hypot(it[0], it[2]) < 30).slice(0, 20).map((it) => new THREE.Vector3(it[0], it[1] + 8.3 * it[3], it[2]))];

  // ---------------------------------------------------------------- the aurora, when the sky clears
  const auroraU = { uTime: S.U.uTime, uCalm: { value: 0 } };
  const auroraMat = new THREE.ShaderMaterial({
    uniforms: auroraU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; float w = sin(uv.x * 6. + uTime * .12) * 9. + sin(uv.x * 15. - uTime * .2) * 3.; p.x += w * .4; p.z += w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
    fragmentShader: `uniform float uTime, uCalm; varying vec2 vUv;
      void main(){
        float rays = .7 + .3 * sin(vUv.x * 60. + uTime * .3 + sin(vUv.x * 9. + uTime * .2) * 5.) * sin(vUv.x * 23. - uTime * .17);
        float fold = .6 + .4 * sin(vUv.x * 7. + uTime * .09 + sin(vUv.x * 3. - uTime * .05) * 2.);
        float body = smoothstep(0., .12, vUv.y) * (1. - smoothstep(.15, .95, vUv.y)) * fold;
        float ends = smoothstep(0., .12, vUv.x) * (1. - smoothstep(.88, 1., vUv.x));
        vec3 col = mix(vec3(.25, 1., .6), vec3(.7, .4, 1.), smoothstep(.25, .85, vUv.y));
        gl_FragColor = vec4(col * rays * body * ends * uCalm * .55, 1.);
      }`,
  });
  for (let k = 0; k < 3; k++) {
    const g = new THREE.PlaneGeometry(1, 1, 120, 1), p = g.attributes.position, uv = g.attributes.uv;
    const a0 = -2.6 + k * 0.7, a1 = a0 + 1.9, R = 240 + k * 30, y0 = 26 + k * 8, hgt = 70 + k * 10;
    for (let i = 0; i < p.count; i++) { const u = uv.getX(i), v = uv.getY(i), a = lerp(a0, a1, u); p.setXYZ(i, Math.cos(a) * R, y0 + v * hgt, Math.sin(a) * R); }
    const m = new THREE.Mesh(g, auroraMat); m.frustumCulled = false; m.renderOrder = -0.5; S.add(m);
  }

  // ---------------------------------------------------------------- the weather, and the music's gusts
  let gust = 0, windA = rand() * TAU, devil = null, nextDevil = 12, storm = 1, chime = 0;
  const windV = new THREE.Vector3(), dr = new THREE.Vector3(), tmp = new THREE.Vector3();
  const stormTop = new THREE.Color('#3a4258'), stormHor = new THREE.Color('#4a546c'), calmTop = new THREE.Color('#050a1e'), calmHor = new THREE.Color('#1a2448');
  const fogStorm = new THREE.Color('#4a546c'), fogCalm = new THREE.Color('#141a30'), moonCol = new THREE.Color('#f6f1dc');
  S.onEvent((ev) => {
    if (ev.type === 'gust') { gust = Math.max(gust, ev.strength ?? 0.8); if (!devil && storm > 0.45 && (ev.strength ?? 0) > 0.75) nextDevil = 0; }
    else if (ev.type === 'chord' || ev.type === 'chime') chime = 1;
  });

  S.on((t, dt, st) => {
    const e = st.energy;
    storm = lerp(storm, sstep(0.38, 0.95, e), 1 - Math.exp(-dt * 0.2));
    const calm = 1 - storm;
    gust *= Math.exp(-dt * 0.45); chime *= Math.exp(-dt * 0.7);
    // wind: its direction wanders; its strength is the storm plus the gusts
    windA += dt * 0.02 * Math.sin(t * 0.03);
    const speed = 0.4 + 7 * storm * (0.55 + 0.45 * Math.sin(t * 0.17) * 0.5 + 0.6 * gust) + 0.3 * calm;
    windV.set(Math.cos(windA) * speed, 0, Math.sin(windA) * speed);
    dr.addScaledVector(windV, dt); dr.y -= dt * (1.1 + 0.7 * storm);
    windU.value.copy(windV); aspectU.value = S.camera.aspect;
    for (const u of [flakes, far, drift]) {
      u.uDrift.value.copy(dr); u.uC.value.copy(S.camera.position);
      u.uSwirl.value = 0.25 + 1.6 * storm * (0.7 + 0.5 * gust);
    }
    flakes.uDensity.value = 0.25 + 0.75 * storm; flakes.uSize.value = 0.032 + 0.01 * storm; flakes.uBright.value = 1;
    far.uDensity.value = 0.15 + 0.85 * storm; far.uBright.value = 0.75;
    drift.uDensity.value = storm * (0.4 + 0.6 * gust); drift.uBright.value = 0.6;
    swayU.uWind.value = (0.04 + 0.5 * storm * (0.6 + 0.8 * gust)) * Math.sign(Math.cos(windA) + 1e-3);
    // snow devils, now and then, across the clearing
    if (!devil) { nextDevil -= dt; if (nextDevil <= 0 && storm > 0.45) { const a = rand() * TAU; devil = { from: new THREE.Vector2(Math.cos(a) * 14, Math.sin(a) * 14), to: new THREE.Vector2(-Math.cos(a + 0.6) * 14, -Math.sin(a + 0.6) * 14), t: 0, span: 12 + rand() * 6 }; } }
    if (devil) {
      devil.t += dt; const k = devil.t / devil.span, s = Math.sin(Math.PI * clamp(k, 0, 1)) * storm;
      for (const u of [flakes, far, drift]) u.uDevil.value.set(lerp(devil.from.x, devil.to.x, k), lerp(devil.from.y, devil.to.y, k), s * 1.2);
      if (k >= 1) { devil = null; nextDevil = 22 + rand() * 25; for (const u of [flakes, far, drift]) u.uDevil.value.z = 0; }
    }
    // the sky: a whiteout that lifts on stars, a moon and an aurora
    S.scene.fog.color.copy(fogStorm).lerp(fogCalm, calm); S.scene.background = S.scene.fog.color;
    S.scene.fog.far = lerp(38, 190, calm * calm); S.scene.fog.near = lerp(1, 20, calm);
    fogU.uFogCol.value.copy(S.scene.fog.color); fogU.uFogNear.value = S.scene.fog.near; fogU.uFogFar.value = S.scene.fog.far;
    su.uTop.value.copy(stormTop).lerp(calmTop, calm); su.uHor.value.copy(S.scene.fog.color).lerp(calmHor, calm * 0.6);
    su.uStars.value = 1.6 * sstep(0.35, 0.9, calm); su.uClouds.value = 0.15 + 0.5 * storm;
    su.uMoonCol.value.copy(moonCol).multiplyScalar(sstep(0.3, 0.85, calm)); su.uHalo.value.setRGB(0.36, 0.44, 0.66).multiplyScalar(sstep(0.3, 0.85, calm));
    auroraU.uCalm.value = sstep(0.45, 1, calm);
    key.intensity = 0.35 + 0.55 * calm; hemi.intensity = 0.55 + 0.35 * storm;
    iceU.uGlow.value = 0.35 + 0.35 * calm + 0.35 * chime; iceU.uCam.value.copy(S.camera.position);
    groveGlowMat.opacity = 0.25 + 0.45 * iceU.uGlow.value;
    cabinLight.intensity = 6 + Math.sin(t * 7) * 0.4 + Math.sin(t * 13.3) * 0.3;

    // giant flakes: drift past slowly, turning, glinting, and fade
    for (const f of giant) {
      f.life += dt;
      if (f.life < 0) { f.sp.material.opacity = 0; continue; }
      if (!f.on || f.life > f.span || f.sp.position.distanceTo(S.camera.position) > 18) { spawnGiant(f); f.on = true; }
      f.sp.position.addScaledVector(windV, dt * 0.25).add(tmp.set(Math.sin(t * 0.7 + f.size * 9) * 0.15 * dt, -0.32 * dt, Math.cos(t * 0.5 + f.size * 5) * 0.12 * dt));
      f.sp.material.rotation += f.spin * dt;
      const k = f.life / f.span, glint = 0.75 + 0.25 * Math.sin(t * 2.3 + f.size * 20);
      f.sp.material.opacity = sstep(0, 0.15, k) * (1 - sstep(0.75, 1, k)) * 0.8 * glint * (0.6 + 0.4 * calm);
      f.sp.scale.setScalar(f.size);
    }

    // snow spirits: in the storm they ride the wind round the clearing, chasing one another; in the calm, they settle
    spirits.forEach((w, i) => {
      if (calm > 0.55 && !w.perch) w.perch = perches[(i * 3 + 1) % perches.length];
      if (calm < 0.45) w.perch = null;
      let target;
      if (w.perch) { target = tmp.copy(w.perch); target.y += Math.sin(t * 1.3 + w.ph) * 0.06; }
      else {
        const b = spirits[w.buddy].p;
        target = tmp.set(Math.sin(t * 0.21 + w.ph) * 9, 3.5 + Math.sin(t * 0.33 + w.ph * 2) * 2.2, Math.cos(t * 0.17 + w.ph * 1.6) * 9).lerp(b, 0.35);
        target.y += groundH(target.x, target.z);
      }
      const acc = target.sub(w.p).multiplyScalar(w.perch ? 1.2 : 0.6);
      if (!w.perch) acc.addScaledVector(windV, 0.12 * (1 + gust));
      w.v.addScaledVector(acc, dt); w.v.multiplyScalar(Math.exp(-dt * (w.perch ? 2.5 : 0.6)));
      const vmax = w.perch ? 2 : 5; if (w.v.length() > vmax) w.v.setLength(vmax);
      w.p.addScaledVector(w.v, dt);
      const gy = groundH(w.p.x, w.p.z) + 0.6; if (w.p.y < gy) w.p.y = gy;
      w.sp.position.copy(w.p);
      const tw = w.perch ? 0.7 + 0.3 * Math.sin(t * 2.1 + w.ph * 5) : 1;
      w.sp.scale.setScalar((0.75 + 0.2 * Math.sin(t * 3 + w.ph)) * (1 + chime * 0.3) * tw);
      // the trail: shift back, newest at the head
      const base = i * TRAIL;
      for (let k = TRAIL - 1; k > 0; k--) { trailPos[(base + k) * 3] = trailPos[(base + k - 1) * 3]; trailPos[(base + k) * 3 + 1] = trailPos[(base + k - 1) * 3 + 1]; trailPos[(base + k) * 3 + 2] = trailPos[(base + k - 1) * 3 + 2]; }
      trailPos[base * 3] = w.p.x; trailPos[base * 3 + 1] = w.p.y; trailPos[base * 3 + 2] = w.p.z;
      const sp = Math.min(1, w.v.length() / 3);
      for (let k = 0; k < TRAIL; k++) trailA[base + k] = (1 - k / TRAIL) * sp;
    });
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.aA.needsUpdate = true;

    // the camera: a slow walk round the clearing, buffeted a touch by the gusts
    const a = 0.6 + t * 0.008 * (0.6 + 0.4 * e), R = 17, cx = Math.sin(a) * R, cz = Math.cos(a) * R;
    const buf = storm * (0.03 + 0.06 * gust);
    S.camera.position.set(cx + Math.sin(t * 1.7) * buf, groundH(cx, cz) + 4.2 + Math.sin(t * 0.2) * 0.25 + Math.sin(t * 2.3) * buf, cz);
    S.camera.lookAt(0, 3.2 + 4.5 * sstep(0.3, 1, calm), 0); // looking up more as the sky clears
  });

  S.scene.userData.snow = { get storm() { return storm; }, spirits, giant };
  return S.finalize({ portraitFov: 72 });
}
