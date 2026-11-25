// The scene kit: building blocks shared by the smaller "dream worlds". A stage owns its scene,
// camera, uniforms and update loop, and disposes of everything it made in one pass when the world
// changes. Builders add skies, ground, water, buildings, trees, lights, signs and particles.
import * as THREE from 'three';
import { mulberry32 } from '../audio.js';
import { paint, mergeAll, treeGeo } from './country.js';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';

export const TAU = Math.PI * 2;
export { THREE, paint, mergeAll, treeGeo };

// ------------------------------------------------------------------ the stage
export function createStage({ mobile, seed, salt = 1, fov = 55, far = 2600, bg = '#05060d', fog = null, exposure = 1, bloom = [0.6, 0.5, 0.6], finish, shadows = false }) {
  const rand = mulberry32((seed ^ salt) >>> 0);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  if (fog) scene.fog = fog.density ? new THREE.FogExp2(fog.color, fog.density) : new THREE.Fog(fog.color, fog.near ?? 40, fog.far ?? 400);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, far);
  scene.add(camera);
  const U = { uTime: { value: 0 }, uScale: { value: 800 }, uEnergy: { value: 1 } };
  const updaters = [], handlers = [], extras = [];
  const mats = new Map();
  const stage = {
    THREE, scene, camera, rand, U, mobile,
    keep(x) { extras.push(x); return x; },
    on(fn) { updaters.push(fn); },
    onEvent(fn) { handlers.push(fn); },
    /** A shared Lambert material per colour (and side). */
    mat(color, { side = THREE.FrontSide, emissive = null, flat = false } = {}) {
      const k = `${color}|${side}|${emissive}|${flat}`;
      if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color, side, emissive: emissive || '#000', flatShading: flat }));
      return mats.get(k);
    },
    vmat: null,
    add(obj) { scene.add(obj); return obj; },
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure, bloom, finish, shadows },
  };
  stage.vmat = new THREE.MeshLambertMaterial({ vertexColors: true });
  stage.finalize = ({ portraitFov = 70 } = {}) => ({
    scene, camera, portraitFov, look: stage.look,
    update(t, dt, st) {
      U.uTime.value = t; U.uEnergy.value = st.energy;
      U.uScale.value = innerHeight * Math.min(devicePixelRatio || 1, 2) / (2 * Math.tan(camera.fov * Math.PI / 360));
      for (const f of updaters) f(t, dt, st);
    },
    onEvent(ev, at) { for (const h of handlers) h(ev, at); },
    dispose() {
      stage.disposed = true; // models still loading will not be added
      // everything the stage made goes in one sweep: geometry, materials and their textures
      const seen = new Set();
      const drop = (m) => { if (!m || seen.has(m)) return; seen.add(m); for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose?.(); };
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : [m]).forEach(drop); if (o.dispose && o.isInstancedMesh) o.dispose(); });
      for (const m of mats.values()) drop(m);
      drop(stage.vmat);
      for (const x of extras) x.dispose?.();
    },
  });
  return stage;
}

// ------------------------------------------------------------------ camera paths
/** A slow orbit round a point, energy slowing it as the night goes on. */
export function orbitRig(stage, { center = [0, 0, 0], radius = 14, height = 3, speed = 0.015, lookY = 1.5, start = 0, sway = 0.25, arc = null }) {
  const c = new THREE.Vector3(...center);
  let a = start;
  stage.on((t, dt, st) => {
    a += dt * speed * (0.55 + 0.45 * st.energy);
    const ang = arc ? start + Math.sin(a) * arc : a; // arc: swing back and forth instead of circling
    stage.camera.position.set(c.x + Math.sin(ang) * radius, height + Math.sin(t * 0.06) * sway, c.z + Math.cos(ang) * radius);
    stage.camera.lookAt(c.x, lookY, c.z);
  });
}
/** Glide along a closed path through the scene, looking a little ahead. */
export function pathRig(stage, { points, height = 1.7, speed = 0.6, ahead = 0.02, lookDrop = 0.2, bob = 0 }) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
  const len = curve.getLength();
  let u = 0;
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  stage.on((t, dt, st) => {
    u = (u + dt * speed * (0.6 + 0.4 * st.energy) / len) % 1;
    curve.getPointAt(u, p); curve.getPointAt((u + ahead) % 1, q);
    stage.camera.position.set(p.x, p.y + height + Math.sin(t * 3.2) * bob, p.z);
    stage.camera.lookAt(q.x, q.y + height - lookDrop, q.z);
  });
  return curve;
}

// ------------------------------------------------------------------ skies
const SKYNOISE = `
  float kh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float kn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(kh(i), kh(i + vec2(1, 0)), f.x), mix(kh(i + vec2(0, 1)), kh(i + vec2(1, 1)), f.x), f.y); }
  float kf(vec2 p){ return .5 * kn(p) + .25 * kn(p * 2.03 + 1.7) + .125 * kn(p * 4.1 + 3.3); }`;

/**
 * A night sky: deep blue to a glowing horizon, stars, a large moon with a halo, and slow
 * clouds that drift across it. Follows the camera.
 */
export function nightSky(stage, { top = '#03061a', horizon = '#1b2448', moon = [0.35, 0.32, -0.88], moonSize = 0.055, moonColor = '#f6f1dc', halo = '#5d6fa8', stars = 1, clouds = 0.45, cloudColor = '#2a3358', tint = null, crescent = 0 } = {}) {
  const u = {
    uTime: stage.U.uTime, uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(horizon) }, uMoon: { value: new THREE.Vector3(...moon).normalize() },
    uMoonSize: { value: moonSize }, uMoonCol: { value: new THREE.Color(moonColor) }, uHalo: { value: new THREE.Color(halo) }, uStars: { value: stars },
    uClouds: { value: clouds }, uCloudCol: { value: new THREE.Color(cloudColor) }, uTint: { value: new THREE.Color(tint || '#000') }, uPulse: { value: 0 }, uCrescent: { value: crescent },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 48, 24), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uTime, uMoonSize, uStars, uClouds, uPulse, uCrescent; uniform vec3 uTop, uHor, uMoon, uMoonCol, uHalo, uCloudCol, uTint; varying vec3 vDir;
      ${SKYNOISE}
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        vec3 col = mix(uHor, uTop, smoothstep(-.05, .55, y)) + uTint * smoothstep(.4, -.05, y) * .5;
        // stars, with a slow twinkle (and a gentle swell when the music asks)
        vec2 sp = vec2(atan(d.x, d.z) * 140., y * 160.); vec2 cell = floor(sp); float h = kh(cell);
        if (h > 1. - .03 * uStars && y > .02) {
          vec2 c = fract(sp) - .5 - (vec2(kh(cell + 3.1), kh(cell + 7.7)) - .5) * .6;
          float tw = .55 + .45 * sin(uTime * (.4 + h * 1.5) + h * 60.);
          col += mix(vec3(.85, .88, 1.), vec3(1., .85, .75), step(.7, kh(cell + 5.))) * smoothstep(.13, 0., length(c)) * tw * (1. + uPulse) * smoothstep(.02, .2, y);
        }
        // the moon: a disc with soft maria, and a wide halo
        float md = acos(clamp(dot(d, uMoon), -1., 1.));
        vec3 mp = d - uMoon;
        float maria = kf(mp.xy * 40. + 3.) * .35;
        col += uHalo * exp(-md * 7.) * .45 + uHalo * exp(-md * 22.) * .35;
        float disc = smoothstep(uMoonSize, uMoonSize * .93, md);
        // a crescent: the disc with a second, shifted disc taken out of it
        if (uCrescent > 0.) { vec3 sh = normalize(uMoon + vec3(uMoonSize * .55, uMoonSize * .25, 0.)); disc *= 1. - smoothstep(uMoonSize, uMoonSize * .93, acos(clamp(dot(d, sh), -1., 1.))) * uCrescent; }
        col = mix(col, uMoonCol * (1. - maria), disc);
        // clouds drifting across, silver-edged near the moon
        float az = atan(d.x, -d.z);
        float c = kf(vec2(az * 3. + uTime * .006, y * 9. - uTime * .002));
        float cl = smoothstep(.55, .8, c) * smoothstep(-.02, .12, y) * smoothstep(.75, .3, y) * uClouds;
        vec3 cc = uCloudCol + uMoonCol * exp(-md * 5.) * .5 * smoothstep(.55, .75, c);
        col = mix(col, cc, cl * .85);
        gl_FragColor = vec4(col, 1.);
      }`,
  }));
  sky.renderOrder = -1; sky.frustumCulled = false;
  stage.add(sky);
  stage.on(() => sky.position.copy(stage.camera.position));
  sky.userData.u = u;
  return sky;
}

/** Moonlight and starlight: a cool key light from the moon, a dim blue fill. */
export function moonlight(stage, { dir = [0.35, 0.55, -0.6], color = '#9fb0e0', intensity = 0.9, sky = '#33407a', ground = '#0c0f1a', fill = 0.55 } = {}) {
  const hemi = new THREE.HemisphereLight(sky, ground, fill);
  const key = new THREE.DirectionalLight(color, intensity);
  key.position.set(...dir).multiplyScalar(100);
  stage.add(hemi); stage.add(key);
  return { hemi, key };
}

// ------------------------------------------------------------------ ground and water
/** Ground from a height function, coloured per vertex. */
export function terrain(stage, { size = 400, seg = 120, height = () => 0, color = () => '#355a2a', pos = [0, 0, 0] }) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + pos[0], z = p.getZ(i) + pos[2];
    const h = height(x, z);
    p.setY(i, h);
    c.set(color(x, z, h));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, stage.vmat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.receiveShadow = true;
  return stage.add(m);
}

/**
 * Still water that mirrors the night: the sky's gradient, a long moon path, reflected stars, and
 * slow ripples (with rings from `ripple()` calls).
 */
export function water(stage, { w = 40, d = 40, pos = [0, 0, 0], deep = '#020814', sky = '#1b2448', moon = [0.35, 0.32, -0.88], moonColor = '#f6f1dc', glow = null, round = false } = {}) {
  const RIP = 6;
  const u = {
    uTime: stage.U.uTime, uDeep: { value: new THREE.Color(deep) }, uSky: { value: new THREE.Color(sky) }, uMoon: { value: new THREE.Vector3(...moon).normalize() },
    uMoonCol: { value: new THREE.Color(moonColor) }, uGlow: { value: new THREE.Color(glow || '#000') },
    uRip: { value: Array.from({ length: RIP }, () => new THREE.Vector4(0, 0, -99, 0)) },
  };
  const geo = round ? new THREE.CircleGeometry(w / 2, 64) : new THREE.PlaneGeometry(w, d);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: u, transparent: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform vec3 uDeep, uSky, uMoon, uMoonCol, uGlow; uniform vec4 uRip[${RIP}]; varying vec3 vW;
      ${SKYNOISE}
      void main(){
        vec2 p = vW.xz;
        float rip = 0.;
        for (int i = 0; i < ${RIP}; i++) { vec4 r = uRip[i]; float age = uTime - r.z; if (age > 0. && age < 6.) { float dd = length(p - r.xy), fr = age * .8; rip += sin((dd - fr) * 14.) * exp(-pow(dd - fr, 2.) * 6.) * exp(-age * .7) * r.w; } }
        vec2 g = vec2(kn(p * .9 + uTime * .12) - .5, kn(p * .9 - uTime * .1 + 7.) - .5) * .08 + vec2(kn(p * 3.1 + uTime * .3) - .5) * .03 + rip * .05;
        vec3 n = normalize(vec3(g.x, 1., g.y));
        vec3 V = normalize(cameraPosition - vW);
        vec3 r = reflect(-V, n);
        float fres = .2 + .8 * pow(1. - max(dot(V, n), 0.), 4.);
        vec3 col = mix(uDeep, uSky, fres * smoothstep(-.1, .5, r.y));
        // the moon's path across the water, and reflected stars
        float m = max(dot(r, uMoon), 0.);
        col += uMoonCol * (pow(m, 1400.) * 1.8 + pow(m, 160.) * .2);
        vec2 sp = vec2(atan(r.x, r.z) * 140., r.y * 160.); vec2 cell = floor(sp);
        if (kh(cell) > .975 && r.y > .05) col += vec3(.8) * smoothstep(.15, 0., length(fract(sp) - .5)) * .5;
        col += uGlow * (.5 + .5 * kn(p * .5 + uTime * .05)) * .35;
        gl_FragColor = vec4(col, 1.);
      }`,
  }));
  m.rotation.x = -Math.PI / 2; m.position.set(...pos);
  stage.add(m);
  let n = 0;
  m.userData.ripple = (x, z, strength = 1) => { u.uRip.value[n++ % RIP].set(x, z, stage.U.uTime.value, strength); };
  m.userData.u = u;
  return m;
}

// ------------------------------------------------------------------ buildings
/**
 * A stone building: walls, a pitched roof, an optional chimney, and glowing windows that light
 * and flicker on their own. `windows` is a list of [face, x, y, w, h] with face 'front'|'back'|'left'|'right'.
 */
export function building(stage, { w = 8, d = 6, h = 5, roof = 3, wall = '#cfae74', roofCol = '#6f685c', pos = [0, 0, 0], ry = 0, chimney = true, windows = [], glow = '#ffb766', door = 'front', doorCol = '#4a3322', lit = 1 } = {}) {
  const g = new THREE.Group();
  const parts = [];
  parts.push(paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), new THREE.Color(wall)).toNonIndexed());
  const r = new THREE.CylinderGeometry(1, 1, w + 0.4, 3, 1); r.rotateZ(Math.PI / 2); r.scale(1, roof / 1.5, (d / 2 + 0.35) / 0.866); r.translate(0, h + roof / 3, 0);
  parts.push(paint(r, new THREE.Color(roofCol)).toNonIndexed());
  if (chimney) parts.push(paint(new THREE.BoxGeometry(0.8, roof + 1.4, 0.8).translate(w * 0.32, h + roof * 0.5 + 0.4, 0), new THREE.Color(wall).multiplyScalar(0.92)).toNonIndexed());
  if (door) parts.push(paint(new THREE.BoxGeometry(1.1, 2.1, 0.12).translate(0, 1.05, d / 2 + 0.05), new THREE.Color(doorCol)).toNonIndexed());
  const body = new THREE.Mesh(mergeAll(parts), stage.vmat); body.geometry.computeVertexNormals();
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const wm = glowMaterial(stage, glow, lit);
  for (const [face, x, y, ww = 0.9, hh = 1.1] of windows) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), wm);
    const off = 0.04;
    if (face === 'front') { pane.position.set(x, y, d / 2 + off); }
    else if (face === 'back') { pane.position.set(x, y, -d / 2 - off); pane.rotation.y = Math.PI; }
    else if (face === 'left') { pane.position.set(-w / 2 - off, y, x); pane.rotation.y = -Math.PI / 2; }
    else { pane.position.set(w / 2 + off, y, x); pane.rotation.y = Math.PI / 2; }
    pane.userData.seed = stage.rand();
    g.add(pane);
  }
  g.position.set(...pos); g.rotation.y = ry;
  stage.add(g);
  g.userData.chimneyTop = new THREE.Vector3(w * 0.32, h + roof + 1.2, 0);
  return g;
}

/** Warm glass: a window or lamp that glows and flickers a little, with glazing bars. */
export function glowMaterial(stage, color = '#ffb766', level = 1, bars = true) {
  const u = { uTime: stage.U.uTime, uCol: { value: new THREE.Color(color) }, uLevel: { value: level } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime, uLevel; uniform vec3 uCol; varying vec2 vUv; varying vec3 vW;
      void main(){
        float bar = ${bars ? 'step(.06, abs(vUv.x - .5)) * step(.05, abs(vUv.y - .5)) * step(.04, vUv.x) * step(vUv.x, .96) * step(.04, vUv.y) * step(vUv.y, .96)' : '1.'};
        float seed = fract(sin(dot(floor(vW.xz * 2.), vec2(12.9, 78.2))) * 43758.5);
        float flick = .88 + .08 * sin(uTime * (1.3 + seed * 2.) + seed * 40.) + .04 * sin(uTime * 7.1 + seed * 9.);
        vec3 inner = uCol * (1.4 - .5 * length(vUv - vec2(.5, .35)));
        gl_FragColor = vec4(mix(vec3(.03, .025, .02), inner * flick * 1.8, bar * uLevel), 1.);
      }`,
  });
  m.userData.u = u;
  return stage.keep(m);
}

/** A painted sign or board from a canvas drawing. */
export function canvasTexture(stage, w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return stage.keep(t);
}
export function board(stage, { w = 2, h = 1, tex, pos = [0, 0, 0], ry = 0, emissive = 0.15, doubleSided = true }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: emissive }));
  m.position.set(...pos); m.rotation.y = ry;
  return stage.add(m);
}

// ------------------------------------------------------------------ trees
export function pineGeo(rand, { col = '#1f3a2a', trunk = '#3b2a1e' } = {}) {
  const parts = [paint(new THREE.CylinderGeometry(0.15, 0.25, 2, 6).translate(0, 1, 0), new THREE.Color(trunk)).toNonIndexed()];
  for (let k = 0; k < 4; k++) parts.push(paint(new THREE.ConeGeometry(1.9 - k * 0.38, 2.4, 8).translate(0, 2.2 + k * 1.25, 0), new THREE.Color(col).multiplyScalar(0.85 + rand() * 0.3)).toNonIndexed());
  const g = mergeAll(parts); g.computeVertexNormals(); return g;
}
/** Place many copies of a geometry (trees, posts, bales) as one instanced mesh. */
export function scatter(stage, geo, items, material = stage.vmat, { shadows = false } = {}) {
  const mesh = new THREE.InstancedMesh(geo, material, items.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  items.forEach((it, i) => mesh.setMatrixAt(i, m4.compose(v.set(it[0], it[1], it[2]), q.setFromEuler(e.set(0, it[4] ?? 0, 0)), s.setScalar(it[3] ?? 1))));
  mesh.castShadow = shadows; mesh.receiveShadow = shadows;
  return stage.add(mesh);
}
/** A weeping willow: a trunk, a crown, and long hanging fronds that sway in the breeze. */
export function willow(stage, { pos = [0, 0, 0], scale = 1, col = '#5d7a3a' } = {}) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 5, 8).translate(0, 2.5, 0), stage.mat('#3b2c22'));
  g.add(trunk);
  for (let k = 0; k < 5; k++) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + stage.rand() * 0.5, 1), stage.mat(new THREE.Color(col).multiplyScalar(0.7).getStyle(), { flat: true }));
    const a = k * 1.26; crown.position.set(Math.cos(a) * 1.1, 6.6 + stage.rand() * 1.2, Math.sin(a) * 1.1); g.add(crown);
  }
  // fronds: thin strips hanging from the crown's rim, swaying more towards their tips
  const pos2 = [], col2 = [];
  const c = new THREE.Color(col);
  for (let k = 0; k < 260; k++) {
    const a = stage.rand() * TAU, r = 1.2 + stage.rand() * 2.2, len = 4 + stage.rand() * 3.2, x = Math.cos(a) * r, z = Math.sin(a) * r, y0 = 6.6 - (r - 1.4) * 0.5;
    const wdt = 0.1, cc = c.clone().multiplyScalar(0.8 + stage.rand() * 0.4);
    const tx = Math.cos(a + 1.57) * wdt, tz = Math.sin(a + 1.57) * wdt;
    for (const v of [[x - tx, y0, z - tz], [x + tx, y0, z + tz], [x, y0 - len, z]]) { pos2.push(...v); col2.push(cc.r, cc.g, cc.b); }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3));
  fg.setAttribute('color', new THREE.Float32BufferAttribute(col2, 3));
  fg.computeVertexNormals();
  const fm = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  fm.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = stage.U.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hang = clamp((6.6 - position.y) / 5.5, 0., 1.);
      transformed.x += sin(uTime * .7 + position.z * .4) * .35 * hang * hang;
      transformed.z += cos(uTime * .55 + position.x * .4) * .25 * hang * hang;`);
  };
  g.add(new THREE.Mesh(fg, fm));
  g.position.set(...pos); g.scale.setScalar(scale);
  return stage.add(g);
}

// ------------------------------------------------------------------ light
/** A lantern or lamp: a small glowing glass, a soft halo, and a real light that flickers. */
export function lantern(stage, { pos = [0, 2, 0], color = '#ffb35c', intensity = 6, distance = 14, flicker = 0.15, body = true, halo = 1 } = {}) {
  const g = new THREE.Group(); g.position.set(...pos);
  if (body) {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), glowMaterial(stage, color, 1, false)));
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 4).translate(0, 0.22, 0), stage.mat('#1c1712')));
  }
  const light = new THREE.PointLight(color, intensity, distance, 2);
  g.add(light);
  const hTex = haloTexture(stage);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: hTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 * halo }));
  sp.scale.setScalar(1.6 * halo); g.add(sp);
  const seed = stage.rand() * 50;
  stage.on((t) => {
    const f = 1 - flicker + flicker * (0.6 * Math.sin(t * 7.3 + seed) * 0.5 + 0.5 + 0.4 * Math.sin(t * 13.7 + seed * 2) * 0.5);
    light.intensity = intensity * f; sp.material.opacity = 0.55 * halo * f;
  });
  stage.add(g);
  return g;
}
let haloTex = null;
function haloTexture(stage) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c);
  return stage.keep(haloTex);
}

/** A string of fairy lights hanging between two points, each bulb twinkling on its own. */
export function stringLights(stage, from, to, { sag = 0.8, count = 24, colors = ['#ffd08a', '#ffb56b', '#fff1c9'], size = 0.16 } = {}) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const pos = [], col = [], seed = [];
  for (let k = 0; k < count; k++) {
    const t = k / (count - 1), p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag;
    const c = new THREE.Color(colors[k % colors.length]);
    pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); seed.push(stage.rand());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uTime: stage.U.uTime, uScale: stage.U.uScale, uSize: { value: size } }, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale, uSize; varying vec3 vCol;
      void main(){ vec4 mv = viewMatrix * vec4(position, 1.); float d = -mv.z; float tw = .7 + .3 * sin(uTime * (.8 + aSeed * 1.5) + aSeed * 40.);
        gl_PointSize = max(2., uScale * uSize / d * (.8 + .4 * tw)); vCol = color * tw * 1.6; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec3 vCol; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vCol * (exp(-r * 14.) * 2. + exp(-r * 3.) * .35) * (1. - r), 1.); }',
  }));
  pts.frustumCulled = false;
  // the wire
  const wire = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 20 }, (_, k) => { const t = k / 19, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; return p; }));
  stage.add(new THREE.Line(wire, new THREE.LineBasicMaterial({ color: '#1b1612' })));
  return stage.add(pts);
}

// ------------------------------------------------------------------ particles
/**
 * Motes of all kinds, wrapped round a centre so they never run out:
 * 'firefly' (wandering, blinking), 'dust' (hanging, glinting), 'snow' (falling, swaying),
 * 'flour' (slow, pale), 'spark' (rising embers).
 */
export function motes(stage, { kind = 'dust', count = 300, box = [20, 8, 20], center = [0, 4, 0], color = '#ffe9b0', size = 0.05, speed = 1, follow = false } = {}) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let k = 0; k < count; k++) { pos.set([(stage.rand() - 0.5) * box[0], (stage.rand() - 0.5) * box[1], (stage.rand() - 0.5) * box[2]], k * 3); seed[k] = stage.rand(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const u = { uTime: stage.U.uTime, uScale: stage.U.uScale, uCol: { value: new THREE.Color(color) }, uSize: { value: size }, uC: { value: new THREE.Vector3(...center) }, uBox: { value: new THREE.Vector3(...box) }, uSpeed: { value: speed }, uLevel: { value: 1 } };
  const additive = kind !== 'snow';
  const motion = {
    firefly: 'p += vec3(sin(t * .31 + s * 50.), sin(t * .23 + s * 31.) * .6, cos(t * .27 + s * 17.)) * 1.2; float glow = pow(max(0., sin(t * (.5 + s * .8) + s * 90.)), 3.);',
    dust: 'p += vec3(sin(t * .11 + s * 50.), -t * .02 * (.5 + s), cos(t * .09 + s * 17.)) * .4; float glow = .35 + .65 * pow(.5 + .5 * sin(t * (1.5 + s * 2.) + s * 60.), 6.);',
    snow: 'p += vec3(sin(t * .5 + s * 50.) * .5 + t * .1, -t * (.35 + s * .35), cos(t * .4 + s * 30.) * .4); float glow = .8;',
    flour: 'p += vec3(sin(t * .13 + s * 50.), -t * .015 + sin(t * .2 + s * 9.) * .2, cos(t * .1 + s * 17.)) * .35; float glow = .45 + .3 * sin(t * 2. + s * 40.);',
    spark: 'p += vec3(sin(t * .7 + s * 50.) * .3, t * (.4 + s * .5), cos(t * .6 + s * 30.) * .3); float glow = .6 + .4 * sin(t * 9. + s * 70.);',
  }[kind];
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale, uSize, uSpeed, uLevel; uniform vec3 uC, uBox; varying float vA;
      void main(){
        float t = uTime * uSpeed, s = aSeed;
        vec3 p = position;
        ${motion}
        p = uC + mod(p + uBox * .5, uBox) - uBox * .5;
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
        gl_PointSize = max(1.5, uScale * uSize * (.6 + .8 * s) / d);
        vA = glow * uLevel * smoothstep(.3, 1.5, d);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; if (r > 1.) discard;
        ${additive ? 'gl_FragColor = vec4(uCol * vA * (exp(-r * 8.) * 1.6 + exp(-r * 2.) * .3), 1.);' : 'gl_FragColor = vec4(uCol, vA * (1. - r));'} }`,
  }));
  pts.frustumCulled = false;
  if (follow) stage.on(() => u.uC.value.copy(stage.camera.position));
  pts.userData.u = u;
  return stage.add(pts);
}

/** Smoke or steam: soft puffs rising, spreading and fading, from a point. */
export function smoke(stage, { pos = [0, 0, 0], color = '#9aa0b0', count = 26, rise = 6, spread = 1.6, size = 1.2, rate = 0.06, opacity = 0.18 } = {}) {
  const p = new Float32Array(count * 3), s = new Float32Array(count);
  for (let k = 0; k < count; k++) { p.set(pos, k * 3); s[k] = k / count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uTime: stage.U.uTime, uScale: stage.U.uScale, uCol: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale; varying float vA, vS;
      void main(){
        float age = fract(uTime * ${rate.toFixed(3)} + aSeed);
        vec3 q = position + vec3(sin(aSeed * 40. + uTime * .3) * ${spread.toFixed(2)} * age + age * 1.2, age * ${rise.toFixed(2)}, cos(aSeed * 25. + uTime * .2) * ${spread.toFixed(2)} * age * .6);
        vec4 mv = viewMatrix * vec4(q, 1.); float d = -mv.z;
        gl_PointSize = uScale * ${size.toFixed(2)} * (.4 + age * 1.6) / d;
        vA = smoothstep(0., .15, age) * (1. - age) * ${opacity.toFixed(3)}; vS = aSeed;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA, vS;
      void main(){ vec2 c = gl_PointCoord - .5; float r = length(c) * 2.; float n = .7 + .3 * sin(c.x * 9. + vS * 30.) * sin(c.y * 7. + vS * 11.);
        gl_FragColor = vec4(uCol, vA * smoothstep(1., .2, r) * n); }`,
  }));
  pts.frustumCulled = false;
  return stage.add(pts);
}

// ------------------------------------------------------------------ small props
export function box(stage, size, color, pos, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), stage.mat(color));
  m.position.set(...pos); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
  return stage.add(m);
}
export function cyl(stage, rTop, rBot, h, color, pos, segs = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), stage.mat(color));
  m.position.set(...pos); m.castShadow = true; m.receiveShadow = true;
  return stage.add(m);
}
/** A light shaft: a soft additive cone of moonlight or candlelight, catching the dust. */
export function shaft(stage, { from = [0, 6, 0], to = [0, 0, 0], r0 = 0.4, r1 = 1.6, color = '#9fb3ff', opacity = 0.08 } = {}) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), dir = b.clone().sub(a), len = dir.length();
  const geo = new THREE.CylinderGeometry(r0, r1, len, 20, 1, true); geo.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color) }, uOp: { value: opacity }, uTime: stage.U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; varying float vF; void main(){ vY = position.y; vec4 w = modelMatrix * vec4(position, 1.); vec3 n = normalize(mat3(modelMatrix) * normal); vF = abs(dot(n, normalize(cameraPosition - w.xyz))); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uCol; uniform float uOp, uTime; varying float vY; varying float vF;
      void main(){ float a = vF * vF * smoothstep(${(-len).toFixed(2)}, ${(-len * 0.6).toFixed(2)}, vY) * smoothstep(0., ${(-len * 0.15).toFixed(2)}, vY); gl_FragColor = vec4(uCol * a * uOp * (.85 + .15 * sin(uTime * .3)), 1.); }`,
  }));
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  return stage.add(m);
}

// ------------------------------------------------------------------ models
THREE.Cache.enabled = true; // keep fetched model files in memory, so revisiting a world is instant
const gltfLoader = new GLTFLoader();
/**
 * Load a .glb model and place it: standing on the floor at `pos`, turned by `ry`, scaled so its
 * width (x) is `width` (or by `scale`). Resolves with the model group, already in the scene, plus
 * its box; resolves with null if the world closed first or the file could not be loaded, so callers
 * can keep a hand-built stand-in.
 */
export function model(stage, url, { pos = [0, 0, 0], ry = 0, width = null, scale = 1, shadows = false, tweak = null } = {}) {
  return new Promise((resolve) => {
    gltfLoader.load(url, (gltf) => {
      if (stage.disposed) { gltf.scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; if (m) { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); } }); resolve(null); return; }
      const g = new THREE.Group(), inner = gltf.scene;
      g.add(inner);
      const b0 = new THREE.Box3().setFromObject(inner);
      const k = width ? width / Math.max(1e-6, b0.max.x - b0.min.x) : scale;
      inner.scale.setScalar(k);
      inner.position.set(-(b0.min.x + b0.max.x) / 2 * k, -b0.min.y * k, -(b0.min.z + b0.max.z) / 2 * k); // centred, standing on y = 0
      inner.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = shadows; if (tweak) tweak(o.material, o); } });
      g.position.set(...pos); g.rotation.y = ry;
      stage.add(g);
      g.updateMatrixWorld(true);
      resolve({ group: g, box: new THREE.Box3().setFromObject(g) });
    }, undefined, () => resolve(null));
  });
}
