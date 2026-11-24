// Night Drive: an endless cruise down a rain-wet neon road through wireframe mountains, towards a
// striped sun setting behind a far mountain range and a city skyline. Over the night the sun
// sinks below the horizon, the sky deepens, more stars come out and the car slows. Kicks in the
// music send a ring of light rolling out across the grid, chords tint it, cars pass now and then
// (their lights mirrored in the wet tarmac), thin clouds catch the last light, palms sway, and
// the odd shooting star crosses the sky. Terrain, road and sky are shaders; palms are instanced.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../audio.js';

// Value noise that repeats every "per" cells along y, so the terrain tiles along the road and the
// scroll offset can wrap (a float32 shader loses precision after hours of driving otherwise).
const NOISE = `
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p, float per){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    float y0 = mod(i.y, per), y1 = mod(i.y + 1., per);
    return mix(mix(hash(vec2(i.x, y0)), hash(vec2(i.x + 1., y0)), u.x), mix(hash(vec2(i.x, y1)), hash(vec2(i.x + 1., y1)), u.x), u.y); }
  float fbm(vec2 p, float per){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vnoise(p, per); p *= 2.; per *= 2.; a *= .5; } return s; }`;
// one lap of the tiling world, in metres: a whole number of grid cells (7 m), dashes (10.5 m)
// and noise cells (below)
const LAP = 2100;
const CARS = 3;

// fog towards the horizon glow, and the world bending away below the horizon
const COMMON = `
  uniform vec3 uHorizon; uniform float uSunset;
  vec3 fogColor(){ return mix(uHorizon * .16, vec3(.02, .004, .035), uSunset); }
  vec3 applyFog(vec3 col, float dist){ float f = smoothstep(120., 760., dist); return mix(col, fogColor(), f); }`;
const DROP = (z) => `pow(max(0., -(${z})) / 900., 2.) * 40.`;

// grid tints the chords cycle through: [line, glow]
const TINTS = [['#ff3fd0', '#7a2bff'], ['#3fd8ff', '#ff3fd0'], ['#b44bff', '#3f7bff'], ['#ff5fa0', '#ffb03a']];

export function createDriveScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0xd21e);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05010d');
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1500);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const lin = (hex) => new THREE.Color(hex);

  const shared = {
    uScroll: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 }, uKick: { value: -99 },
    uLine: { value: lin(TINTS[0][0]) }, uGlow: { value: lin(TINTS[0][1]) },
    uHorizon: { value: lin('#ff4fa3') }, uSunset: { value: 0 },
    uSeed: { value: rand() * 100 }, uCamX: { value: 0 },
    uCars: { value: Array.from({ length: CARS }, () => new THREE.Vector4(0, -999, 0, 0)) },
  };

  // ------------------------------------------------------------------ sky
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(1000, 64, 32)), keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { ...shared, uMeteor: { value: new THREE.Vector4(0, 0, -99, 0) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime, uSunset, uSeed; uniform vec3 uHorizon, uLine; uniform vec4 uMeteor; varying vec3 vDir;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        float az = atan(d.x, -d.z); // 0 straight ahead
        float set = uSunset;
        // the sky: deep indigo overhead to a magenta glow on the horizon, darker as the sun sets
        vec3 top = mix(vec3(.012, .004, .035), vec3(.002, .001, .008), set);
        vec3 mid = mix(vec3(.04, .007, .08), vec3(.01, .002, .025), set);
        vec3 hor = mix(uHorizon * .36, vec3(.035, .006, .05), set);
        vec3 col = mix(mid, top, smoothstep(.05, .55, y));
        col = mix(hor, col, smoothstep(-.02, .22, y));

        // stars: more as the night deepens, a few coloured, the brightest with a soft cross
        vec2 sp = vec2(atan(d.x, d.z) * 120., y * 140.);
        vec2 cell = floor(sp); float h = hash(cell + uSeed);
        if (h > mix(.983, .962, set) && y > .05) {
          vec2 c = fract(sp) - .5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - .5) * .6;
          float tw = .55 + .45 * sin(uTime * (.4 + h * 2.) + h * 40.);
          vec3 sc = mix(vec3(.85, .85, 1.), mix(vec3(1., .75, .85), vec3(.7, .85, 1.), hash(cell + 9.)), step(.6, hash(cell + 5.)));
          float core = smoothstep(.12, 0., length(c));
          float big = step(.996, h);
          float cross = big * (smoothstep(.04, 0., abs(c.x)) + smoothstep(.04, 0., abs(c.y))) * smoothstep(.5, 0., length(c)) * .5;
          col += sc * (core * (1. + big * 2.) + cross) * tw * smoothstep(.05, .3, y) * 1.3;
        }
        col += vec3(.12, .06, .2) * fbm(vec2(atan(d.x, d.z) * 3., y * 6.) + 2., 1e4) * smoothstep(.12, .5, y) * smoothstep(.9, .4, y) * .4 * (.3 + set);

        // the sun: bands cut from its lower half, layered glow around it
        float sunY = mix(.085, -.17, set);
        vec2 sd = vec2(az, y - sunY);
        float r = length(sd) / .16;
        float sun = smoothstep(1., .992, r);
        // stripes from just above the middle down, getting wider towards the bottom
        float gap = smoothstep(.04, -.1, sd.y);
        float bandY = fract(sd.y * 62. - uTime * .06);
        float bw2 = .15 + gap * .55, baa = fwidth(sd.y) * 62.;
        float band = mix(1., smoothstep(bw2 - baa, bw2 + baa, bandY), step(sd.y, .04));
        vec3 sunCol = mix(vec3(1., .04, .32), vec3(1., .55, .08), smoothstep(-.12, .15, sd.y));
        float above = step(-.003, y);
        col = mix(col, sunCol * .75, sun * band * above);
        float fade = 1. - set * .85;
        col += vec3(1., .2, .5) * (exp(-r * 2.4) * .14 + exp(-r * .7) * .05) * fade * smoothstep(-.03, .0, y);
        // a thin bright line where the sky meets the land
        col += uHorizon * exp(-abs(y - .004) * 160.) * .25 * (1. - set * .6);

        // thin clouds, their undersides lit by the sun
        float cl = fbm(vec2(az * 2.6 + uTime * .0015 + uSeed, y * 26.), 1e4);
        float cloud = smoothstep(.56, .78, cl) * smoothstep(.015, .06, y) * smoothstep(.32, .1, y);
        float lit = exp(-length(vec2(az * .8, y - sunY)) * 3.) * fade;
        vec3 cloudCol = mix(vec3(.05, .012, .08), vec3(.75, .16, .38), lit) + vec3(.9, .35, .2) * lit * lit * .25;
        col = mix(col, cloudCol, cloud * .85);

        // far mountains in two ranges, with glowing ridgelines
        float side = smoothstep(.05, .5, abs(az));
        float ridge2 = .006 + (fbm(vec2(az * 3.2 + 11., 1.), 1e4) * .075 + fbm(vec2(az * 14., 4.), 1e4) * .015) * (.25 + .75 * side);
        float ridge1 = .003 + (fbm(vec2(az * 5.5 + 3., 2.), 1e4) * .055 + fbm(vec2(az * 24., 6.), 1e4) * .01) * side;
        float aa = fwidth(y) * 1.5;
        float m2 = smoothstep(ridge2 + aa, ridge2, y), m1 = smoothstep(ridge1 + aa, ridge1, y);
        vec3 far = mix(vec3(.06, .012, .09), vec3(.02, .004, .04), set);
        col = mix(col, far + uHorizon * .05 * (1. - set), m2 * above);
        col += uLine * exp(-abs(y - ridge2) * 600.) * .35 * above * fade;
        col = mix(col, far * .55, m1 * above);
        col += uLine * exp(-abs(y - ridge1) * 700.) * .45 * above;

        // a city on the horizon, straight ahead, silhouetted against the sun, its windows lit
        float span = .3;
        if (abs(az) < span && y > -.01) {
          float bw = .0075, bi = floor(az / bw);
          float hb = hash(vec2(bi, 7.)), hn = hash(vec2(bi + 1., 7.));
          float taper = pow(1. - abs(az) / span, .6);
          float bh = .004 + taper * (.016 + hb * hb * .06);
          float bld = step(y, bh) * step(.07, fract(az / bw));
          vec3 city = vec3(.008, .002, .016);
          // windows
          vec2 wv = vec2(fract(az / .0013), fract(y / .0021));
          float win = step(.45, wv.x) * step(wv.x, .8) * step(.4, wv.y) * step(wv.y, .8);
          float on = step(.72 - set * .25, hash(floor(vec2(az / .0013, y / .0021)) + uSeed));
          vec3 wc = mix(vec3(1., .75, .4), vec3(.4, .85, 1.), step(.75, hash(floor(vec2(az / .0013, y / .0021)) + 3.)));
          city += wc * win * on * .7 * smoothstep(.0, .004, bh - y);
          // aerial lights blinking on the tallest towers
          vec2 tip = vec2((bi + .5) * bw - az, (bh + .0025) - y);
          col = mix(col, city, bld * above);
          col += vec3(1., .1, .15) * step(.8, hb) * smoothstep(.0012, 0., length(tip)) * step(.5, fract(uTime * .5 + hb * 3.)) * 3. * (1. - bld);
        }

        // a shooting star
        float age = uTime - uMeteor.z;
        if (age > 0. && age < 1.2) {
          vec2 a = uMeteor.xy, b = a + vec2(-.35, -.12);
          vec2 pos = vec2(az, y);
          float k = clamp(age / 1.2, 0., 1.);
          vec2 head = mix(a, b, k), tail = mix(a, b, max(0., k - .25));
          vec2 pa = pos - tail, ba = head - tail; float hh = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
          col += vec3(.8, .9, 1.) * smoothstep(.003, .0, length(pa - ba * hh)) * hh * sin(k * 3.14159) * 2.;
        }
        gl_FragColor = vec4(col, 1.);
      }`,
  })));
  sky.renderOrder = -1;
  scene.add(sky);

  // ------------------------------------------------------------------ terrain
  const W = 640, L = 900;
  const tGeo = keep(new THREE.PlaneGeometry(W, L, mobile ? 120 : 170, mobile ? 170 : 240));
  tGeo.rotateX(-Math.PI / 2); tGeo.translate(0, 0, -L / 2 + 40);
  const terrain = new THREE.Mesh(tGeo, keep(new THREE.ShaderMaterial({
    uniforms: shared, extensions: { derivatives: true },
    vertexShader: `uniform float uScroll, uSeed; varying vec3 vW; varying vec2 vG; varying float vH, vDist;
      ${NOISE}
      float height(vec2 g){
        float ax = abs(g.x);
        float valley = smoothstep(24., 110., ax);
        float m = fbm(g * (25. / ${LAP}.) + vec2(uSeed, 0.), 25.) * 1.4 + fbm(g * (95. / ${LAP}.) + vec2(7., 0.), 95.) * .35;
        return valley * (m * m * 90. + 3.);
      }
      void main(){
        vec3 p = position;
        vec2 g = vec2(p.x, p.z - uScroll); // ground coordinates move under the car
        p.y = height(g) - .2;
        vH = p.y;
        p.y -= ${DROP('p.z')};
        vG = g;
        vec4 w = modelMatrix * vec4(p, 1.); vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uLine, uGlow; uniform float uPulse, uKick, uTime; varying vec3 vW; varying vec2 vG; varying float vH, vDist;
      ${COMMON}
      void main(){
        // grid lines: a sharp core and a soft neon glow, fading to an even tone where the cells get
        // smaller than a few pixels (no shimmering moire in the distance)
        vec2 p = vG / 7.;
        vec2 fw = fwidth(p);
        vec2 dl = abs(fract(p - .5) - .5) / max(fw, 1e-4);
        float dpx = min(dl.x, dl.y);
        float core = 1. - smoothstep(.6, 1.6, dpx);
        float glow = exp(-dpx * .45) * .28;
        float tiny = smoothstep(.12, .4, max(fw.x, fw.y));
        float lineAmt = mix(core + glow, .09, tiny);
        float hk = clamp(vH / 60., 0., 1.);
        // the rolling ring of light from the beat
        float age = uTime - uKick, rr = age * 70., gd = length(vec2(vW.x, vW.z - 6.));
        float ring = exp(-pow((gd - rr) / 6., 2.)) * exp(-age * 1.4) * step(0., age);
        vec3 line = mix(uLine, uGlow, hk) * (.8 + uPulse * .5 + ring * 1.6);
        // faces of the mountains: dark, with the ridges catching the sunset from behind
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        vec3 V = normalize(cameraPosition - vW);
        float rim = pow(1. - abs(dot(n, V)), 3.) * hk;
        vec3 fill = mix(vec3(.008, .002, .016), vec3(.03, .006, .05), hk) + uHorizon * rim * .25 * (1. - uSunset * .7);
        vec3 col = fill + line * lineAmt * (1. - smoothstep(250., 700., vDist) * .65);
        gl_FragColor = vec4(applyFog(col, vDist), 1.);
      }`,
  })));
  scene.add(terrain);

  // ------------------------------------------------------------------ road: wet tarmac
  const road = new THREE.Mesh(keep(new THREE.PlaneGeometry(15, L, 1, mobile ? 140 : 220).rotateX(-Math.PI / 2).translate(0, 0.01, -L / 2 + 40)), keep(new THREE.ShaderMaterial({
    uniforms: shared, extensions: { derivatives: true },
    vertexShader: `varying vec2 vUv2; varying float vDist, vZ; uniform float uScroll;
      void main(){ vUv2 = vec2(position.x, position.z - uScroll); vZ = position.z; vec3 p = position; p.y -= ${DROP('p.z')};
        vec4 mv = modelViewMatrix * vec4(p, 1.); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uLine; uniform float uTime, uCamX; uniform vec4 uCars[${CARS}]; varying vec2 vUv2; varying float vDist, vZ;
      ${NOISE}
      ${COMMON}
      void main(){
        float xs = vUv2.x, x = abs(xs), aa = fwidth(vUv2.x) * 1.5;
        float grain = hash(floor(vUv2 * 40.));
        vec3 col = vec3(.012, .008, .024) * (.85 + .3 * grain);
        // puddles: some stretches are wetter, mirror-like
        float wet = smoothstep(.35, .7, vnoise(vec2(xs * .25, vUv2.y * .08), 1e5));
        float ripple = vnoise(vec2(xs * 3., vUv2.y * 1.2 + uTime * .3), 1e5);
        float graze = smoothstep(2., 90., vDist); // reflections strengthen at grazing angles
        // the sun (or, once it has set, the horizon glow) mirrored in a long broken streak
        float streak = exp(-pow((xs - uCamX) * (.18 + .25 * (1. - graze)), 2.)) * graze * (.35 + .9 * wet) * (.5 + ripple);
        vec3 sunRef = mix(vec3(1., .3, .2), uHorizon * .5, uSunset) * (1. - uSunset * .6);
        col += sunRef * streak * .7;
        // edge lines and their glow spilling onto the wet surface
        float edge = smoothstep(.2 + aa, .2, abs(x - 6.9));
        col += vec3(.1, .8, 1.) * (edge * 1.1 + exp(-abs(x - 6.9) * 1.3) * (.05 + .1 * wet));
        float dash = step(.5, fract(vUv2.y / 10.5)) * smoothstep(.12 + aa, .12, abs(x - 2.3));
        col += uLine * (dash * .8 + exp(-abs(x - 2.3) * 2.) * .03 * wet);
        // car lights mirrored in the road, stretching towards us
        for (int i = 0; i < ${CARS}; i++) {
          vec4 c = uCars[i];
          if (c.w <= 0.) continue;
          float behind = vZ - c.y; // positive between the car and us
          float spread = exp(-pow((xs - c.x) * 2.2, 2.)) * smoothstep(-1., 2., behind) * exp(-max(behind, 0.) * .035);
          vec3 lc = c.z > .5 ? vec3(1., .85, .6) : vec3(1., .08, .1);
          col += lc * spread * c.w * (.08 + .3 * wet) * (.5 + .7 * ripple);
        }
        col += uHorizon * .03 * smoothstep(80., 500., vDist);
        gl_FragColor = vec4(applyFog(col, vDist), 1.);
      }`,
  })));
  scene.add(road);

  // ------------------------------------------------------------------ palms: swaying silhouettes, lit from behind
  function palmGeo() {
    const parts = [];
    const segs = 7, hgt = 9;
    for (let i = 0; i < segs; i++) {
      const y0 = (i / segs) * hgt, r = 0.32 - i * 0.025;
      const c = new THREE.CylinderGeometry(r - 0.025, r, hgt / segs + 0.05, 7, 1);
      c.translate(Math.pow(i / segs, 2) * 1.2, y0 + hgt / segs / 2, 0);
      parts.push(c.toNonIndexed());
    }
    for (let k = 0; k < 9; k++) {
      // each frond: a long thin leaf bent down in a few segments
      const f = new THREE.ConeGeometry(0.42, 4.6, 4, 4);
      f.translate(0, 2.3, 0); f.scale(1, 1, 0.18);
      const p = f.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + y * y * 0.07); }
      f.rotateZ(-1.75 + Math.sin(k * 2.3) * 0.3);
      f.rotateY((k / 9) * Math.PI * 2 + Math.sin(k) * 0.2);
      f.translate(1.2, hgt, 0);
      parts.push(f.toNonIndexed());
    }
    const g = mergeGeometries(parts); g.deleteAttribute('uv'); g.computeVertexNormals();
    return g;
  }
  const PALMS = mobile ? 26 : 38, SPACING = 26, SPAN = PALMS / 2 * SPACING;
  const palms = new THREE.InstancedMesh(keep(palmGeo()), keep(new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: `uniform float uTime; varying float vDist, vY, vRim;
      void main(){
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
        float ph = instanceMatrix[3].x * .37 + instanceMatrix[3].z * .11;
        float k = pow(max(position.y, 0.) / 9., 2.);
        w.x += sin(uTime * .7 + ph) * .35 * k; w.z += cos(uTime * .53 + ph) * .2 * k;
        w.y -= ${DROP('w.z')};
        vY = position.y;
        vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec3 V = normalize(cameraPosition - w.xyz);
        vRim = pow(1. - abs(dot(n, V)), 2.5);
        vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uGlow; varying float vDist, vY, vRim;
      ${COMMON}
      void main(){
        vec3 col = vec3(.01, .003, .018) + (uHorizon * .5 + uGlow * .2) * vRim * .35 * (1. - uSunset * .6) * smoothstep(2., 9., vY);
        gl_FragColor = vec4(applyFog(col, vDist), 1.);
      }`,
  })), PALMS);
  palms.frustumCulled = false;
  const palmData = [];
  for (let k = 0; k < PALMS; k++) {
    const side = k % 2 ? 1 : -1;
    palmData.push({ x: side * (10.5 + rand() * 5), z: Math.floor(k / 2) * SPACING + rand() * 10, s: 0.8 + rand() * 0.5, ry: rand() * Math.PI * 2 });
  }
  scene.add(palms);

  // ------------------------------------------------------------------ other cars: just their lights, glowing
  const carGeo = keep(new THREE.BufferGeometry());
  const cp = new Float32Array(CARS * 2 * 3), cc = new Float32Array(CARS * 2 * 3), cs = new Float32Array(CARS * 2);
  carGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  carGeo.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  carGeo.setAttribute('aSize', new THREE.BufferAttribute(cs, 1));
  const carU = { uScale: { value: 800 } };
  const carLights = new THREE.Points(carGeo, keep(new THREE.ShaderMaterial({
    uniforms: carU, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; uniform float uScale; varying vec3 vCol;
      void main(){ vec4 mv = viewMatrix * vec4(position, 1.); float d = -mv.z;
        gl_PointSize = max(2., uScale * aSize / d); vCol = color * smoothstep(900., 300., d); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vCol;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vCol * (exp(-r * 30.) * 3. + exp(-r * 5.) * .6) * (1. - r), 1.); }`,
  })));
  carLights.frustumCulled = false;
  scene.add(carLights);
  const cars = Array.from({ length: CARS }, () => ({ on: false, x: 0, z: 0, v: 0, head: false }));
  function spawnCar(oncoming) {
    const c = cars.find((k) => !k.on);
    if (!c) return;
    c.on = true; c.head = oncoming;
    if (oncoming) { c.x = 4.6; c.z = -850; c.v = 22 + rand() * 10; } // coming towards us in the far lane
    else { c.x = 0.3 + (rand() - 0.5) * 0.6; c.z = -26; c.v = -(2 + rand() * 3); } // pulling slowly away ahead of us
  }

  // ------------------------------------------------------------------ motion
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let travelled = 0, speed = 18, tint = 0, nextMeteor = 8 + rand() * 20, sunset = 0, nextCar = 6 + rand() * 20, t = 0;
  const targetLine = shared.uLine.value.clone(), targetGlow = shared.uGlow.value.clone();

  function onEvent(ev, at) {
    if (ev.type === 'kick') { shared.uPulse.value = Math.min(1, shared.uPulse.value + 0.5); if (rand() < 0.35) shared.uKick.value = at ?? t; }
    else if (ev.type === 'chord') {
      tint = (tint + 1) % TINTS.length;
      targetLine.set(TINTS[tint][0]); targetGlow.set(TINTS[tint][1]);
    } else if (ev.type === 'car') spawnCar(rand() < 0.7);
  }

  function update(time, dt, st) {
    t = time;
    const e = st.energy;
    shared.uTime.value = t;
    speed += ((7 + 20 * e) - speed) * Math.min(1, dt * 0.2);
    travelled += speed * dt;
    shared.uScroll.value = travelled % LAP;
    shared.uPulse.value *= Math.exp(-dt * 4);
    // the sun goes down as the night goes on
    sunset += ((1 - e) * 1.25 - sunset) * Math.min(1, dt * 0.05);
    shared.uSunset.value = Math.min(1, Math.max(0, sunset));
    const k = Math.min(1, dt * 0.4);
    shared.uLine.value.lerp(targetLine, k); shared.uGlow.value.lerp(targetGlow, k);

    camera.position.set(Math.sin(t * 0.11) * 1.6 - 2.3, 2.1 + Math.sin(t * 0.37) * 0.06, 6);
    camera.lookAt(Math.sin(t * 0.07) * 4 - 2.3, 3.2, -120);
    camera.rotateZ(Math.sin(t * 0.09) * 0.012);
    shared.uCamX.value = camera.position.x;
    carU.uScale.value = innerHeight * Math.min(devicePixelRatio || 1, 2) / (2 * Math.tan(camera.fov * Math.PI / 360));

    // palms scroll past and wrap round
    for (let i = 0; i < PALMS; i++) {
      const p = palmData[i];
      const z = ((p.z + travelled) % SPAN) - SPAN + 30;
      q.setFromAxisAngle(up, p.ry);
      palms.setMatrixAt(i, m4.compose(v.set(p.x, 0, z), q, sc.setScalar(p.s)));
    }
    palms.instanceMatrix.needsUpdate = true;

    // other cars: oncoming ones rush past, ones ahead drift away into the distance
    if (t > nextCar) { spawnCar(rand() < 0.6); nextCar = t + 20 + rand() * 40; }
    cars.forEach((c, i) => {
      if (c.on) { c.z += (c.head ? speed + c.v : c.v * 0.6) * dt; if (c.z > 12 || c.z < -880) c.on = false; }
      const drop = Math.pow(Math.max(0, -c.z) / 900, 2) * 40;
      const lc = c.head ? [1, 0.9, 0.75] : [1, 0.06, 0.08];
      const vis = c.on ? Math.min(1, (c.z + 880) / 120) : 0;
      for (let j = 0; j < 2; j++) {
        const o = (i * 2 + j) * 3;
        cp[o] = c.x + (j ? 0.75 : -0.75); cp[o + 1] = 0.75 - drop; cp[o + 2] = c.z;
        cc[o] = lc[0] * vis; cc[o + 1] = lc[1] * vis; cc[o + 2] = lc[2] * vis;
        cs[i * 2 + j] = c.head ? 1.3 : 0.9;
      }
      shared.uCars.value[i].set(c.x, c.z, c.head ? 1 : 0, vis);
    });
    carGeo.attributes.position.needsUpdate = true; carGeo.attributes.color.needsUpdate = true; carGeo.attributes.aSize.needsUpdate = true;

    if (t > nextMeteor) {
      sky.material.uniforms.uMeteor.value.set((rand() - 0.3) * 1.2, 0.3 + rand() * 0.35, t, 0);
      nextMeteor = t + 25 + rand() * 50;
    }
  }

  return {
    scene, camera, update, onEvent,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.0, bloom: [0.8, 0.5, 0.48], finish: { vignette: 0.4, grain: 0.02, ca: 0.9 } }, portraitFov: 74,
    dispose() { for (const d of disposables) d.dispose?.(); palms.dispose(); },
  };
}
