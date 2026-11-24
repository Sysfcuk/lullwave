// Aurora: a snowy tundra at night. Curtains of northern lights ripple and fold across the sky,
// mirrored in a still lake; snow-laden pines stand on the hills; snow drifts down; a low moon
// silvers the drifts. Chords in the music brighten the aurora; each chime sends a shimmer
// running along it. The camera glides slowly along the shore.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../audio.js';

const TAU = Math.PI * 2;
const PALETTES = [
  { low: [0.15, 1.0, 0.55], mid: [0.1, 0.75, 0.85], high: [0.6, 0.25, 0.95] },
  { low: [0.2, 1.0, 0.45], mid: [0.25, 0.9, 0.7], high: [0.95, 0.3, 0.6] },
  { low: [0.1, 0.9, 0.8], mid: [0.3, 0.55, 1.0], high: [0.75, 0.3, 1.0] },
];

// the sky (stars, moon, aurora), shared by the sky dome and the lake's reflection
const SKY = `
  uniform float uTime, uPulse, uShimT, uShimAz, uSeed; uniform vec3 uLow, uMid, uHigh, uMoon;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ return .5 * vn(p) + .25 * vn(p * 2.03 + 3.1) + .125 * vn(p * 4.1 + 7.7); }
  vec3 aurora(vec3 d){
    float y = d.y; if (y < 0.) return vec3(0.);
    float az = atan(d.x, -d.z);
    vec3 acc = vec3(0.);
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      // each curtain hangs from a slowly wandering lower edge and fades upward, with fine
      // vertical rays and broad folds of brightness that drift along it
      float edge = .12 + fk * .07 + .06 * sin(az * (1.1 + fk * .3) + uTime * .035 + fk * 2.1 + uSeed) + .025 * sin(az * 3.7 - uTime * .06 + fk)
        + (fbm(vec2(az * 9. + fk * 3., uTime * .03)) - .5) * .05;
      float h = y - edge;
      float H = .13 + fk * .05;
      float body = smoothstep(-.004, .03, h) * exp(-max(h, 0.) / H) * (1. + 1.2 * exp(-max(h, 0.) * 40.)); // brightest along the lower hem
      float rays = .45 + .55 * fbm(vec2(az * (38. + fk * 9.) + uTime * .05, fk * 7.));
      float fold = smoothstep(.3, .85, fbm(vec2(az * 2.2 + uTime * .02 + fk * 4., uTime * .01 + uSeed)));
      float span = smoothstep(1.5, .5, abs(az + .2 - fk * .3)); // the display sits ahead of us
      float shim = exp(-pow((az - uShimAz) * 4., 2.)) * exp(-(uTime - uShimT) * 1.2) * step(uShimT, uTime);
      float hk = clamp(h / H, 0., 1.);
      vec3 c = mix(uLow, uMid, smoothstep(0., .45, hk));
      c = mix(c, uHigh * .7, smoothstep(.5, 1., hk));
      acc += c * body * rays * fold * span * (.5 - fk * .12) * (1. + uPulse * .6 + shim * 1.5);
    }
    return acc * smoothstep(0., .05, y);
  }
  vec3 skyColor(vec3 d){
    float y = d.y;
    vec3 col = mix(vec3(.012, .02, .045), vec3(.002, .004, .012), smoothstep(-.05, .6, y));
    // stars
    vec2 sp = vec2(atan(d.x, d.z) * 130., y * 150.);
    vec2 cell = floor(sp); float h = hash(cell + uSeed);
    if (h > .975 && y > .02) {
      vec2 c = fract(sp) - .5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - .5) * .6;
      col += vec3(.85, .9, 1.) * smoothstep(.13, 0., length(c)) * (.5 + .5 * sin(uTime * (.5 + h) + h * 50.)) * smoothstep(.02, .2, y);
    }
    // the moon, low, with a halo
    float md = distance(d, uMoon);
    col += vec3(.9, .92, 1.) * smoothstep(.028, .024, md) * .9 + vec3(.25, .3, .45) * exp(-md * 9.) * .25;
    col += aurora(d);
    return col;
  }`;

export function createAuroraScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0xa0a0);
  const pal = PALETTES[Math.floor(rand() * PALETTES.length)];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02040a');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  const U = {
    uTime: { value: 0 }, uPulse: { value: 0 }, uShimT: { value: -99 }, uShimAz: { value: 0 }, uSeed: { value: rand() * 50 },
    uLow: { value: new THREE.Vector3(...pal.low) }, uMid: { value: new THREE.Vector3(...pal.mid) }, uHigh: { value: new THREE.Vector3(...pal.high) },
    uMoon: { value: new THREE.Vector3(0.75, 0.12, -0.65).normalize() }, uGlow: { value: new THREE.Vector3(...pal.low) },
    uScale: { value: 800 }, uCam: { value: new THREE.Vector3() },
  };
  const FOG = `vec3 fogged(vec3 col, float d){ float f = 1. - exp(-pow(d * .0028, 2.)); return mix(col, vec3(.012, .02, .045) + uGlow * .02, f); }`;

  // ------------------------------------------------------------------ sky
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(1000, 64, 32)), keep(new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `${SKY} varying vec3 vDir; void main(){ gl_FragColor = vec4(skyColor(normalize(vDir)), 1.); }`,
  })));
  sky.renderOrder = -1;
  scene.add(sky);

  // ------------------------------------------------------------------ snowy hills round a lake
  const LAKE = new THREE.Vector2(0, -90), LAKE_R = 85;
  const hillsAt = (x, z) => {
    const d = Math.hypot(x - LAKE.x, (z - LAKE.y) * 0.8);
    const shore = Math.max(0, d - LAKE_R);
    const n = Math.sin(x * 0.013 + 1.3) * Math.sin(z * 0.011) * 18 + Math.sin(x * 0.031 + z * 0.02) * 7 + Math.sin(x * 0.07 - z * 0.05) * 2;
    return Math.min(1, shore / 60) * (n + shore * 0.12) + Math.min(shore, 4) * 0.25 - 0.6;
  };
  const SEG = mobile ? 160 : 220;
  const gGeo = keep(new THREE.PlaneGeometry(1400, 1400, SEG, SEG));
  gGeo.rotateX(-Math.PI / 2);
  {
    const p = gGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, hillsAt(p.getX(i), p.getZ(i)));
    gGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(gGeo, keep(new THREE.ShaderMaterial({
    uniforms: U, extensions: { derivatives: true },
    vertexShader: `varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uMoon, uGlow, uCam; uniform float uTime, uPulse; varying vec3 vW, vN;
      float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      ${FOG}
      void main(){
        vec3 n = normalize(vN);
        vec3 V = normalize(uCam - vW); float d = length(uCam - vW);
        float moon = max(dot(n, normalize(uMoon * vec3(1., 2.5, 1.))), 0.);
        // snow: cold moonlight, the aurora's glow from the sky, glittering crystals
        // wind-carved ripples in the drifts
        float rip = sin(vW.x * 1.3 + sin(vW.z * .35) * 2.5 + vW.z * .4) * .5 + .5;
        float shade = .82 + .18 * rip;
        vec3 col = (vec3(.025, .035, .06) + vec3(.09, .11, .16) * moon) * shade + uGlow * (.035 + .04 * uPulse) * (.5 + .5 * n.y);
        vec2 gc = vW.xz * 6.;
        float sparkle = step(.996, h2(floor(gc))) * smoothstep(.18, 0., length(fract(gc) - .5)) * pow(max(dot(reflect(-V, n), normalize(uMoon + vec3(0., .3, 0.))), 0.), 6.) * (.5 + .5 * sin(uTime * 3. + vW.x * 9.));
        col += vec3(.8, .9, 1.) * sparkle * smoothstep(60., 5., d);
        gl_FragColor = vec4(fogged(col, d), 1.);
      }`,
  })));
  scene.add(ground);

  // the lake: a mirror for the sky, broken by a faint slow ripple
  const lake = new THREE.Mesh(keep(new THREE.CircleGeometry(LAKE_R + 25, 96)), keep(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${SKY} uniform vec3 uCam, uGlow; varying vec3 vW;
      ${FOG}
      void main(){
        vec3 V = normalize(vW - uCam); float d = length(vW - uCam);
        vec2 rp = vW.xz * .08;
        vec3 n = normalize(vec3((vn(rp + uTime * .05) - .5) * .05, 1., (vn(rp * 1.3 - uTime * .04 + 9.) - .5) * .05));
        vec3 r = reflect(V, n);
        float fres = .25 + .75 * pow(1. - max(dot(-V, n), 0.), 4.);
        vec3 col = skyColor(r) * fres * .85 + vec3(.004, .007, .014);
        gl_FragColor = vec4(fogged(col, d), 1.);
      }`,
  })));
  lake.rotation.x = -Math.PI / 2; lake.position.set(LAKE.x, -0.15, LAKE.y); lake.scale.set(1, 1.25, 1);
  scene.add(lake);

  // ------------------------------------------------------------------ pines
  const pineGeo = keep((() => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.15, 0.22, 1.6, 6); trunk.translate(0, 0.8, 0); parts.push(trunk.toNonIndexed());
    for (let k = 0; k < 5; k++) {
      const r = 1.9 - k * 0.32, h = 2.2 - k * 0.25;
      const c = new THREE.ConeGeometry(r, h, 8, 1); c.translate(0, 1.4 + k * 1.15 + h / 2, 0); parts.push(c.toNonIndexed());
    }
    const g = mergeGeometries(parts); g.deleteAttribute('uv'); g.computeVertexNormals(); return g;
  })());
  const PINES = mobile ? 260 : 420;
  const pines = new THREE.InstancedMesh(pineGeo, keep(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vN; varying vec3 vW; varying float vY;
      void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz; vY = position.y; vN = normalize(mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uMoon, uGlow, uCam; varying vec3 vN; varying vec3 vW; varying float vY;
      ${FOG}
      void main(){
        vec3 n = normalize(vN);
        // dark needles, with snow lying on the upward faces
        float snow = smoothstep(.35, .75, n.y);
        vec3 col = mix(vec3(.006, .014, .014), vec3(.12, .15, .22) + vec3(.1, .12, .17) * max(dot(n, uMoon), 0.), snow);
        col += uGlow * .03 * snow;
        gl_FragColor = vec4(fogged(col, length(uCam - vW)), 1.);
      }`,
  })), PINES);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let n = 0, tries = 0;
    while (n < PINES && tries++ < PINES * 20) {
      // in clumps on the far shores and hills, none on the lake or in front of us
      const x = (rand() - 0.5) * 900, z = -40 - rand() * 520;
      const d = Math.hypot(x - LAKE.x, (z - LAKE.y) * 0.8);
      if (d < LAKE_R + 10) continue;
      if (Math.sin(x * 0.02) * Math.sin(z * 0.025) < -0.2 && rand() < 0.8) continue;
      const sc = 0.7 + rand() * 0.9;
      pines.setMatrixAt(n++, m4.compose(v.set(x, hillsAt(x, z) - 0.3, z), q.setFromAxisAngle(up, rand() * TAU), s.set(sc, sc * (0.9 + rand() * 0.4), sc)));
    }
    pines.count = n;
  }
  scene.add(pines);

  // ------------------------------------------------------------------ falling snow (wraps around the camera)
  const SNOW = mobile ? 1600 : 2600, BOX = 40;
  const snowGeo = keep(new THREE.BufferGeometry());
  const sp = new Float32Array(SNOW * 3), ss = new Float32Array(SNOW);
  for (let k = 0; k < SNOW; k++) { sp.set([(rand() - 0.5) * BOX, (rand() - 0.5) * BOX, (rand() - 0.5) * BOX], k * 3); ss[k] = rand(); }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
  const snow = new THREE.Points(snowGeo, keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale; uniform vec3 uCam, uGlow; varying vec3 vCol;
      void main(){
        vec3 p = position + vec3(sin(uTime * .3 + aSeed * 40.) * .6 + uTime * .25, -uTime * (.5 + aSeed * .5), cos(uTime * .23 + aSeed * 30.) * .5);
        vec3 rel = mod(p - uCam + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
        vec4 mv = viewMatrix * vec4(uCam + rel, 1.); float d = -mv.z;
        gl_PointSize = max(1.2, uScale * .05 * (.4 + aSeed) / d);
        vCol = (vec3(.5, .55, .65) + uGlow * .15) * smoothstep(.4, 2.5, d) * (1. - smoothstep(${(BOX * 0.3).toFixed(1)}, ${(BOX * 0.5).toFixed(1)}, d)) * .55;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vCol * exp(-r * 2.5) * (1. - r), 1.); }`,
  })));
  snow.frustumCulled = false;
  scene.add(snow);

  // ------------------------------------------------------------------ motion
  let t = 0, pulse = 0;
  const look = new THREE.Vector3(), glow = new THREE.Vector3();
  function onEvent(ev, at) {
    if (ev.type === 'chord') pulse = Math.min(1.2, pulse + 0.6);
    else if (ev.type === 'chime') { U.uShimT.value = at ?? t; U.uShimAz.value = (ev.pan || 0) * 0.9 - 0.2; }
  }

  function update(time, dt, st) {
    t = time;
    U.uTime.value = t;
    U.uScale.value = innerHeight * Math.min(devicePixelRatio || 1, 2) / (2 * Math.tan(camera.fov * Math.PI / 360));
    pulse *= Math.exp(-dt * 0.35);
    U.uPulse.value = pulse * (0.5 + 0.5 * st.energy);
    // the aurora's light on the snow follows its colour and brightness
    glow.set(...pal.low).multiplyScalar(0.7 + 0.5 * pulse);
    U.uGlow.value.copy(glow);
    // glide slowly along the shore, looking out over the lake
    const x = Math.sin(t * 0.008) * 35;
    camera.position.set(x, 2.6 + Math.sin(t * 0.05) * 0.12, 22 + Math.cos(t * 0.006) * 5);
    look.set(x * 0.4, 30 + Math.sin(t * 0.03) * 2, -260);
    camera.lookAt(look);
    U.uCam.value.copy(camera.position);
  }

  return {
    scene, camera, update, onEvent, portraitFov: 70,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.05, bloom: [0.85, 0.6, 0.35], finish: { vignette: 0.4, grain: 0.022, ca: 0.4 } },
    dispose() { for (const d of disposables) d.dispose?.(); pines.dispose(); },
  };
}
