// Night Drive: an endless cruise down a neon road through wireframe mountains, under a striped
// sun. Over the night the sun sinks below the horizon, the sky deepens, more stars come out and
// the car slows. Kicks in the music pulse the grid, chords tint it, and the odd shooting star
// crosses the sky. Terrain, road and sky are shaders; the palms are one instanced mesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../audio.js';

// Value noise that repeats every \`per\` cells along y, so the terrain tiles along the road and the
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

const FOG = `
  vec3 applyFog(vec3 col, float dist, vec3 fogCol){ float f = smoothstep(120., 760., dist); return mix(col, fogCol, f); }`;

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
    uScroll: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 },
    uLine: { value: lin(TINTS[0][0]) }, uGlow: { value: lin(TINTS[0][1]) },
    uHorizon: { value: lin('#ff4fa3') }, uSunset: { value: 0 },
    uSeed: { value: rand() * 100 },
  };

  // ------------------------------------------------------------------ sky
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(1000, 48, 24)), keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { ...shared, uMeteor: { value: new THREE.Vector4(0, 0, -99, 0) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime, uSunset, uSeed; uniform vec3 uHorizon; uniform vec4 uMeteor; varying vec3 vDir;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        // the sky: deep indigo overhead to a magenta-orange glow on the horizon, darker as the sun sets
        float set = uSunset;
        vec3 top = mix(vec3(.012, .004, .035), vec3(.002, .001, .008), set);
        vec3 mid = mix(vec3(.035, .006, .07), vec3(.01, .002, .025), set);
        vec3 hor = mix(uHorizon * .32, vec3(.035, .006, .05), set);
        vec3 col = mix(mid, top, smoothstep(.05, .55, y));
        col = mix(hor, col, smoothstep(-.02, .2, y));
        // the sun: a disc with horizontal bands cut out of its lower half
        vec2 sd = vec2(atan(d.x, -d.z), y - mix(.085, -.16, set));
        float r = length(sd) / .16;
        float sun = smoothstep(1., .985, r);
        float gap = smoothstep(.0, -.12, sd.y);
        float band = mix(1., step(.35 + gap * .45, fract(sd.y * 30. - uTime * .04)), step(sd.y, 0.));
        vec3 sunCol = mix(vec3(1., .05, .3), vec3(1., .45, .06), smoothstep(-.12, .14, sd.y));
        col = mix(col, sunCol * .7, sun * band * step(-.005, y));
        col += vec3(1., .25, .5) * exp(-r * 2.2) * .12 * (1. - set * .8) * step(-.02, y);
        // stars, more of them as the night deepens, twinkling slowly
        vec2 sp = vec2(atan(d.x, d.z) * 120., y * 140.);
        vec2 cell = floor(sp); float h = hash(cell + uSeed);
        float thresh = mix(.985, .965, set);
        if (h > thresh && y > .04) {
          vec2 c = fract(sp) - .5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - .5) * .6;
          float tw = .6 + .4 * sin(uTime * (.5 + h * 2.) + h * 40.);
          col += vec3(.9, .85, 1.) * smoothstep(.12, .0, length(c)) * tw * smoothstep(.04, .25, y) * 1.4;
        }
        // a faint milky band
        col += vec3(.12, .06, .2) * fbm(vec2(atan(d.x, d.z) * 3., y * 6.) + 2., 1e4) * smoothstep(.1, .5, y) * smoothstep(.9, .4, y) * .35 * (.3 + set);
        // a shooting star
        float age = uTime - uMeteor.z;
        if (age > 0. && age < 1.2) {
          vec2 a = vec2(uMeteor.x, uMeteor.y), b = a + vec2(-.35, -.12);
          vec2 pos = vec2(atan(d.x, -d.z), y);
          float k = clamp(age / 1.2, 0., 1.);
          vec2 head = mix(a, b, k), tail = mix(a, b, max(0., k - .25));
          vec2 pa = pos - tail, ba = head - tail; float hh = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
          float dl = length(pa - ba * hh);
          col += vec3(.8, .9, 1.) * smoothstep(.003, .0, dl) * hh * sin(k * 3.14159) * 2.;
        }
        gl_FragColor = vec4(col, 1.);
      }`,
  })));
  sky.renderOrder = -1;
  scene.add(sky);

  // ------------------------------------------------------------------ terrain
  const W = 640, L = 900;
  const tGeo = keep(new THREE.PlaneGeometry(W, L, mobile ? 110 : 160, mobile ? 150 : 220));
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
        // the world falls away gently towards the horizon so the mountains sit on it
        p.y -= pow(max(0., -p.z) / 900., 2.) * 40.;
        vG = g; vH = p.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uLine, uGlow, uHorizon; uniform float uPulse, uSunset; varying vec2 vG; varying float vH, vDist;
      ${FOG}
      float grid(vec2 p, float w){ vec2 f = abs(fract(p - .5) - .5) / fwidth(p); return 1. - min(min(f.x, f.y) / w, 1.); }
      void main(){
        float g = grid(vG / 7., 1.2);
        float hk = clamp(vH / 60., 0., 1.);
        vec3 line = mix(uLine, uGlow, hk) * (.75 + uPulse * .6);
        vec3 fill = mix(vec3(.01, .002, .02), vec3(.03, .005, .05), hk);
        vec3 col = mix(fill, line, g * (1. - smoothstep(200., 650., vDist) * .7));
        vec3 fogCol = mix(uHorizon * .16, vec3(.02, .004, .035), uSunset);
        gl_FragColor = vec4(applyFog(col, vDist, fogCol), 1.);
      }`,
  })));
  scene.add(terrain);

  // ------------------------------------------------------------------ road
  const road = new THREE.Mesh(keep(new THREE.PlaneGeometry(15, L, 1, mobile ? 120 : 200).rotateX(-Math.PI / 2).translate(0, 0.01, -L / 2 + 40)), keep(new THREE.ShaderMaterial({
    uniforms: shared, extensions: { derivatives: true }, transparent: false,
    vertexShader: `varying vec2 vUv2; varying float vDist; uniform float uScroll;
      void main(){ vUv2 = vec2(position.x, position.z - uScroll); vec3 p = position; p.y -= pow(max(0., -p.z) / 900., 2.) * 40.;
        vec4 mv = modelViewMatrix * vec4(p, 1.); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uLine, uGlow, uHorizon; uniform float uSunset, uPulse; varying vec2 vUv2; varying float vDist;
      ${FOG}
      void main(){
        float x = abs(vUv2.x), aa = fwidth(vUv2.x) * 1.5;
        vec3 col = vec3(.012, .008, .025);
        float edge = smoothstep(.22 + aa, .22, abs(x - 6.9));
        col += vec3(.1, .8, 1.) * edge * 1.1;
        col += vec3(.1, .8, 1.) * exp(-abs(x - 6.9) * 2.) * .08;
        float dash = step(.5, fract(vUv2.y / 10.5)) * smoothstep(.12 + aa, .12, abs(x - 2.3));
        col += uLine * dash * .8;
        // a faint reflection of the sky's glow on the tarmac
        col += uHorizon * .04 * smoothstep(80., 500., vDist);
        vec3 fogCol = mix(uHorizon * .16, vec3(.02, .004, .035), uSunset);
        gl_FragColor = vec4(applyFog(col, vDist, fogCol), 1.);
      }`,
  })));
  scene.add(road);

  // ------------------------------------------------------------------ palms: dark silhouettes along both sides
  function palmGeo() {
    const parts = [];
    const segs = 6, hgt = 9;
    for (let i = 0; i < segs; i++) {
      const y0 = (i / segs) * hgt, r = 0.32 - i * 0.03;
      const c = new THREE.CylinderGeometry(r - 0.03, r, hgt / segs + 0.05, 6, 1);
      c.translate(Math.pow(i / segs, 2) * 1.2, y0 + hgt / segs / 2, 0);
      parts.push(c.toNonIndexed());
    }
    for (let k = 0; k < 7; k++) {
      const f = new THREE.ConeGeometry(0.35, 4.2, 4, 1);
      f.translate(0, 2.1, 0); f.scale(1, 1, 0.25);
      f.rotateZ(-1.9 + Math.sin(k) * 0.25); // droop
      f.rotateY((k / 7) * Math.PI * 2);
      f.translate(1.2, hgt, 0);
      parts.push(f.toNonIndexed());
    }
    const g = mergeGeometries(parts); g.deleteAttribute('uv'); g.computeVertexNormals();
    return g;
  }
  const PALMS = mobile ? 24 : 36, SPACING = 26, SPAN = PALMS / 2 * SPACING;
  const palms = new THREE.InstancedMesh(keep(palmGeo()), keep(new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: `varying float vDist; varying float vY;
      void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); w.y -= pow(max(0., -w.z) / 900., 2.) * 40.;
        vY = position.y; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uHorizon, uGlow; uniform float uSunset; varying float vDist; varying float vY;
      ${FOG}
      void main(){ vec3 col = vec3(.012, .004, .02) + uGlow * .05 * smoothstep(6., 10., vY);
        vec3 fogCol = mix(uHorizon * .16, vec3(.02, .004, .035), uSunset); gl_FragColor = vec4(applyFog(col, vDist, fogCol), 1.); }`,
  })), PALMS);
  palms.frustumCulled = false;
  const palmData = [];
  for (let k = 0; k < PALMS; k++) {
    const side = k % 2 ? 1 : -1;
    palmData.push({ x: side * (10.5 + rand() * 5), z: Math.floor(k / 2) * SPACING + rand() * 10, s: 0.8 + rand() * 0.5, ry: rand() * Math.PI * 2 });
  }
  scene.add(palms);

  // ------------------------------------------------------------------ motion
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let travelled = 0, speed = 18, tint = 0, nextMeteor = 8 + rand() * 20, sunset = 0;
  const targetLine = shared.uLine.value.clone(), targetGlow = shared.uGlow.value.clone();

  function onEvent(ev, t) {
    if (ev.type === 'kick') shared.uPulse.value = Math.min(1, shared.uPulse.value + 0.5);
    else if (ev.type === 'chord') {
      tint = (tint + 1) % TINTS.length;
      targetLine.set(TINTS[tint][0]); targetGlow.set(TINTS[tint][1]);
    }
  }

  function update(t, dt, st) {
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

    camera.position.set(Math.sin(t * 0.11) * 1.6 - 2.3, 2.1 + Math.sin(t * 0.37) * 0.08, 6);
    camera.lookAt(Math.sin(t * 0.07) * 4 - 2.3, 3.2, -120);
    camera.rotateZ(Math.sin(t * 0.09) * 0.012);

    // palms scroll past and wrap round
    const scroll = travelled;
    for (let i = 0; i < PALMS; i++) {
      const p = palmData[i];
      const z = ((p.z + scroll) % SPAN) - SPAN + 30;
      q.setFromAxisAngle(up, p.ry);
      palms.setMatrixAt(i, m4.compose(v.set(p.x, 0, z), q, sc.setScalar(p.s)));
    }
    palms.instanceMatrix.needsUpdate = true;

    if (t > nextMeteor) {
      sky.material.uniforms.uMeteor.value.set((rand() - 0.3) * 1.2, 0.3 + rand() * 0.35, t, 0);
      nextMeteor = t + 25 + rand() * 50;
    }
  }

  return {
    scene, camera, update, onEvent,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.0, bloom: [0.75, 0.45, 0.5] }, portraitFov: 74,
    dispose() { for (const d of disposables) d.dispose?.(); palms.dispose(); },
  };
}
