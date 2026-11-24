// Stardust: drifting through deep space. A nebula of glowing gas and dark dust lanes fills the
// sky; nearer clouds of it drift slowly past; stars stream by in layers; a ringed gas giant hangs
// in the distance, lit by a far sun; a comet now and then. Chords make the nebula glow brighter;
// the arpeggio makes the stars twinkle.
import * as THREE from 'three';
import { mulberry32 } from '../audio.js';

const TAU = Math.PI * 2;
const PALETTES = [
  { a: [0.9, 0.25, 0.55], b: [0.15, 0.55, 0.9], c: [1.0, 0.6, 0.3] },
  { a: [0.3, 0.8, 0.75], b: [0.55, 0.25, 0.9], c: [0.95, 0.4, 0.6] },
  { a: [1.0, 0.45, 0.25], b: [0.35, 0.3, 0.85], c: [0.95, 0.8, 0.5] },
  { a: [0.45, 0.35, 1.0], b: [0.2, 0.85, 0.9], c: [1.0, 0.35, 0.7] },
];
const NOISE3 = `
  float h31(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
  float fbm3(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vn3(p); p = p * 2.02 + 1.7; a *= .5; } return s; }`;

export function createSpaceScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0x57a2);
  const pal = PALETTES[Math.floor(rand() * PALETTES.length)];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000003');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const V3 = (a) => new THREE.Vector3(...a);
  const SUN = new THREE.Vector3(0.85, 0.3, -0.45).normalize();

  const U = {
    uTime: { value: 0 }, uGlow: { value: 0 }, uTwinkle: { value: 0 }, uSeed: { value: rand() * 40 },
    uA: { value: V3(pal.a) }, uB: { value: V3(pal.b) }, uC: { value: V3(pal.c) }, uSun: { value: SUN },
    uScale: { value: 800 }, uCam: { value: new THREE.Vector3() },
  };

  // ------------------------------------------------------------------ the sky: nebula, far stars, the sun
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(2000, 64, 32)), keep(new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime, uGlow, uSeed, uTwinkle; uniform vec3 uA, uB, uC, uSun; varying vec3 vDir;
      ${NOISE3}
      void main(){
        vec3 d = normalize(vDir);
        vec3 q = d * 2.2 + uSeed;
        // domain warping gives the gas its swirls
        vec3 w = vec3(fbm3(q + 1.3), fbm3(q + 7.2), fbm3(q + 4.1));
        float gas = fbm3(q + w * 1.6 + uTime * .002);
        float band = exp(-pow(dot(d, normalize(vec3(.3, .9, .2))) * 2.2, 2.)); // the nebula lies along a band
        float dens = smoothstep(.35, .8, gas) * (.35 + .65 * band);
        float dust = smoothstep(.45, .7, fbm3(q * 2.3 + w * 2. + 11.));
        vec3 gc = mix(uA, uB, smoothstep(.3, .7, w.x));
        gc = mix(gc, uC, smoothstep(.55, .85, w.y) * .6);
        vec3 col = vec3(.0015, .001, .004) + gc * dens * dens * (.16 + uGlow * .08) * (1. - dust * .85);
        col += gc * pow(dens, 4.) * .25;
        // far stars, denser along the band, a few tinted
        vec3 sc = floor(d * 260.); float h = h31(sc + 3.);
        if (h > .993 - band * .004) {
          vec3 cp = (fract(d * 260.) - .5);
          float s = smoothstep(.35, 0., length(cp));
          vec3 tint = mix(vec3(.75, .85, 1.), mix(vec3(1., .8, .6), uB + .4, step(.5, h31(sc + 9.))), step(.6, h31(sc + 5.)));
          col += tint * s * (.5 + .5 * sin(uTime * (.4 + h * 2.) + h * 90.)) * (1. + uTwinkle * .8) * 1.2;
        }
        // the far sun with a soft halo
        float sd = 1. - dot(d, uSun);
        col += vec3(1., .92, .8) * (smoothstep(.0006, .0002, sd) * 3. + exp(-sd * 900.) * .6 + exp(-sd * 60.) * .06);
        gl_FragColor = vec4(col, 1.);
      }`,
  })));
  sky.renderOrder = -2;
  scene.add(sky);

  // ------------------------------------------------------------------ the gas giant and its rings
  const PLANET_R = 70;
  const planetGroup = new THREE.Group();
  scene.add(planetGroup);
  const planet = new THREE.Mesh(keep(new THREE.SphereGeometry(PLANET_R, 96, 64)), keep(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vN, vW, vL; void main(){ vN = normalize(mat3(modelMatrix) * normal); vL = position / ${PLANET_R}.; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun, uA, uB, uC, uCam; varying vec3 vN, vW, vL;
      ${NOISE3}
      void main(){
        vec3 n = normalize(vN);
        // bands that swirl a little, turning slowly
        float lat = vL.y;
        float lon = atan(vL.z, vL.x) + uTime * .004;
        float turb = fbm3(vec3(lon * 3., lat * 14., 1.) + fbm3(vec3(lon * 6., lat * 30., 3.)) * .8);
        float bands = sin(lat * 22. + turb * 3.) * .5 + .5;
        vec3 base = mix(mix(uC * .8 + .1, vec3(.85, .8, .72), .5), mix(uA, uC, .5) * .7, bands);
        base = mix(base, vec3(.95, .9, .85), smoothstep(.75, .95, turb) * .3);
        float lit = max(dot(n, uSun), 0.);
        float term = smoothstep(-.05, .25, dot(n, uSun));
        vec3 V = normalize(uCam - vW);
        float rim = pow(1. - max(dot(n, V), 0.), 3.);
        vec3 col = base * (lit * .9 + .01) * term + uB * rim * (.15 + .6 * smoothstep(-.3, .3, dot(n, uSun)));
        gl_FragColor = vec4(col, 1.);
      }`,
  })));
  planetGroup.add(planet);
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(PLANET_R * 1.35, PLANET_R * 2.3, 160, 1)), keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: `varying vec3 vW; varying float vR; void main(){ vR = length(position.xy) / ${PLANET_R}.; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSun, uC; varying vec3 vW; varying float vR;
      float h1(float n){ return fract(sin(n * 91.7) * 43758.5453); }
      void main(){
        float r = (vR - 1.35) / .95;
        // many fine ringlets with gaps
        float ringlets = .55 + .45 * sin(r * 160.) * sin(r * 53. + 1.);
        float gaps = smoothstep(.0, .02, abs(r - .62)) * smoothstep(.0, .01, abs(r - .3));
        float a = smoothstep(0., .06, r) * smoothstep(1., .85, r) * ringlets * gaps * (.35 + .5 * h1(floor(r * 40.)));
        gl_FragColor = vec4(mix(vec3(.85, .78, .68), uC, .3) * a * .55, a * .8);
      }`,
  })));
  ring.rotation.x = -Math.PI / 2 + 0.38; ring.rotation.y = 0.2;
  planetGroup.add(ring);

  // ------------------------------------------------------------------ nearer nebula clouds drifting past (billboards)
  const CLOUDS = mobile ? 22 : 34, CBOX = 900;
  const cloudGeo = keep(new THREE.PlaneGeometry(1, 1));
  const cOff = new Float32Array(CLOUDS * 3), cSize = new Float32Array(CLOUDS), cSeed = new Float32Array(CLOUDS);
  for (let k = 0; k < CLOUDS; k++) { cOff.set([(rand() - 0.5) * CBOX, (rand() - 0.5) * CBOX * 0.6, (rand() - 0.5) * CBOX], k * 3); cSize[k] = 120 + rand() * 260; cSeed[k] = rand(); }
  cloudGeo.setAttribute('aOff', new THREE.InstancedBufferAttribute(cOff, 3));
  cloudGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(cSize, 1));
  cloudGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(cSeed, 1));
  const clouds = new THREE.InstancedMesh(cloudGeo, keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aOff; attribute float aSize, aSeed; uniform vec3 uCam; varying vec2 vUv; varying float vSeed, vFade;
      void main(){
        vec3 rel = mod(aOff - uCam + ${(CBOX / 2).toFixed(1)}, ${CBOX.toFixed(1)}) - ${(CBOX / 2).toFixed(1)};
        vec4 mv = viewMatrix * vec4(uCam + rel, 1.);
        mv.xy += position.xy * aSize;
        float d = length(rel);
        vFade = smoothstep(${(CBOX * 0.5).toFixed(1)}, ${(CBOX * 0.3).toFixed(1)}, d) * smoothstep(40., 160., d);
        vUv = position.xy; vSeed = aSeed;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uTime, uGlow; uniform vec3 uA, uB, uC; varying vec2 vUv; varying float vSeed, vFade;
      ${NOISE3}
      void main(){
        float r = length(vUv) * 2.;
        float n = fbm3(vec3(vUv * 3. + vSeed * 20., uTime * .01 + vSeed * 5.));
        float a = smoothstep(1., .2, r) * smoothstep(.35, .75, n);
        vec3 c = mix(mix(uA, uB, vSeed), uC, smoothstep(.6, .9, n) * .5);
        gl_FragColor = vec4(c * a * vFade * (.05 + uGlow * .03), 1.);
      }`,
  })), CLOUDS);
  clouds.frustumCulled = false;
  scene.add(clouds);

  // ------------------------------------------------------------------ star field streaming past (wraps around the camera)
  const STARS = mobile ? 2200 : 3600, SBOX = 400;
  const stGeo = keep(new THREE.BufferGeometry());
  const stp = new Float32Array(STARS * 3), sts = new Float32Array(STARS);
  for (let k = 0; k < STARS; k++) { stp.set([(rand() - 0.5) * SBOX, (rand() - 0.5) * SBOX, (rand() - 0.5) * SBOX], k * 3); sts[k] = rand(); }
  stGeo.setAttribute('position', new THREE.BufferAttribute(stp, 3));
  stGeo.setAttribute('aSeed', new THREE.BufferAttribute(sts, 1));
  const stars = new THREE.Points(stGeo, keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale, uTwinkle; uniform vec3 uCam, uB; varying vec3 vCol;
      void main(){
        vec3 rel = mod(position - uCam + ${(SBOX / 2).toFixed(1)}, ${SBOX.toFixed(1)}) - ${(SBOX / 2).toFixed(1)};
        vec4 mv = viewMatrix * vec4(uCam + rel, 1.); float d = -mv.z;
        float tw = .6 + .4 * sin(uTime * (1. + aSeed * 3.) + aSeed * 80.) + uTwinkle * step(.7, aSeed);
        gl_PointSize = max(1., uScale * (.25 + aSeed * .5) / d);
        vec3 c = mix(vec3(.8, .87, 1.), mix(vec3(1., .85, .7), uB + .35, step(.5, fract(aSeed * 7.))), step(.75, aSeed));
        vCol = c * tw * smoothstep(2., 20., d) * (1. - smoothstep(${(SBOX * 0.3).toFixed(1)}, ${(SBOX * 0.5).toFixed(1)}, d));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vCol * (exp(-r * 10.) * 1.4 + exp(-r * 2.5) * .25) * (1. - r), 1.); }`,
  })));
  stars.frustumCulled = false;
  scene.add(stars);

  // ------------------------------------------------------------------ comets
  const cometMat = keep(new THREE.ShaderMaterial({
    uniforms: { uAge: { value: 99 }, uC: U.uC },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uAge; uniform vec3 uC; varying vec2 vUv;
      void main(){ float head = smoothstep(.0, .06, vUv.x) * pow(vUv.x, 3.); float w = exp(-pow((vUv.y - .5) * 8. / (.3 + vUv.x), 2.));
        float life = smoothstep(0., .4, uAge) * smoothstep(6., 3.5, uAge);
        gl_FragColor = vec4((vec3(.8, .9, 1.) + uC * .4) * head * w * life * 1.5, 1.); }`,
  }));
  const comet = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), cometMat);
  comet.visible = false; comet.frustumCulled = false;
  scene.add(comet);
  const cm = { on: false, t0: 0, from: new THREE.Vector3(), dir: new THREE.Vector3() };

  // ------------------------------------------------------------------ motion
  let t = 0, glow = 0, twinkle = 0, travelled = 0;
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, -1);
  const planetOff = new THREE.Vector3(-175 + rand() * 40, -50 + rand() * 30, -620);

  function onEvent(ev, at) {
    if (ev.type === 'chord') glow = Math.min(1.5, glow + 0.7);
    else if (ev.type === 'star') twinkle = 1;
    else if (ev.type === 'comet' && !cm.on) {
      cm.on = true; cm.t0 = at ?? t;
      const side = rand() < 0.5 ? -1 : 1;
      cm.from.set(side * 260, 80 + rand() * 120, -500 - rand() * 200);
      cm.dir.set(-side * (0.8 + rand() * 0.4), -0.25 - rand() * 0.2, 0.15).normalize();
      comet.visible = true;
    }
  }

  function update(time, dt, st) {
    t = time;
    const e = st.energy;
    U.uTime.value = t;
    U.uScale.value = innerHeight * Math.min(devicePixelRatio || 1, 2) / (2 * Math.tan(camera.fov * Math.PI / 360));
    glow *= Math.exp(-dt * 0.25); twinkle *= Math.exp(-dt * 1.5);
    U.uGlow.value = glow; U.uTwinkle.value = twinkle;
    // drift forward, slower as the night goes on, swaying the view gently
    travelled += (2 + 4 * e) * dt;
    camPos.set(Math.sin(t * 0.01) * 20, Math.sin(t * 0.007) * 10, -travelled);
    camera.position.copy(camPos);
    look.copy(camPos).add(fwd.set(Math.sin(t * 0.004) * 0.25 - 0.1, Math.sin(t * 0.005) * 0.08 - 0.03, -1));
    camera.lookAt(look);
    camera.rotateZ(Math.sin(t * 0.003) * 0.15);
    U.uCam.value.copy(camPos);
    sky.position.copy(camPos);
    // the planet is far enough that it barely moves: keep it at a fixed offset that creeps a little
    planetGroup.position.copy(camPos).add(planetOff).add({ x: t * 0.02, y: 0, z: 0 });
    planet.rotation.y = t * 0.002;
    // a comet
    if (cm.on) {
      const age = t - cm.t0;
      if (age > 6) { cm.on = false; comet.visible = false; }
      else {
        const head = new THREE.Vector3().copy(camPos).add(cm.from).addScaledVector(cm.dir, age * 90);
        comet.position.copy(head).addScaledVector(cm.dir, -45); // the tail trails behind the head
        comet.scale.set(90, 9, 1);
        // the long axis along the direction of travel, the face turned to the camera
        const view = new THREE.Vector3().subVectors(camera.position, comet.position).normalize();
        const xAxis = cm.dir.clone(), zAxis = view.sub(xAxis.clone().multiplyScalar(view.dot(xAxis))).normalize(), yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
        comet.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
        cometMat.uniforms.uAge.value = age;
      }
    }
  }

  return {
    scene, camera, update, onEvent, portraitFov: 70,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.1, bloom: [0.9, 0.65, 0.3], finish: { vignette: 0.5, grain: 0.026, ca: 0.7 } },
    dispose() { for (const d of disposables) d.dispose?.(); clouds.dispose(); },
  };
}
