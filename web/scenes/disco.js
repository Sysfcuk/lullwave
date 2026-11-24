// Disco Cat: a rainbow cat on a light-up dance floor under a spinning mirror ball. Its fur
// shimmers through the rainbow; spots of light from the mirror ball sweep over it, the floor and
// the walls; beams fan out through the haze. Early in the night it nods along to the beat and
// swishes its tail. As the music winds down into a lullaby the disco dims, the cat grows sleepy,
// lowers its head, closes its eyes, and little Zs float up.
import * as THREE from 'three';
import { mulberry32 } from '../audio.js';

const TAU = Math.PI * 2;
const BALL = new THREE.Vector3(0, 4.3, 0);

// light from the mirror ball: a ring of spots on every surface, turning with the ball
const DISCO = `
  uniform float uTime, uSpin, uDisco, uHue;
  uniform vec3 uBall;
  float dh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(fract(h + vec3(0., 2. / 3., 1. / 3.)) * 6. - 3.) - 1., 0., 1.); return v * mix(vec3(1.), k, s); }
  vec3 spots(vec3 p, vec3 n){
    vec3 d = p - uBall; float dist = length(d); d /= dist;
    float c = cos(uSpin), s = sin(uSpin);
    vec3 r = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
    // cells on the faces of a cube round the ball: evenly sized everywhere, no pinching at a pole
    vec3 ar = abs(r); vec2 uv; float fid;
    if (ar.x > ar.y && ar.x > ar.z) { uv = r.yz / ar.x; fid = sign(r.x); }
    else if (ar.y > ar.z) { uv = r.xz / ar.y; fid = 2. + sign(r.y); }
    else { uv = r.xy / ar.z; fid = 4. + sign(r.z); }
    vec2 g = uv * 7.;
    vec2 id = floor(g) + fid * 31.; vec2 f = fract(g) - .5;
    float h = dh(id);
    float spot = smoothstep(.3, .12, length(f)) * step(.45, h);
    float face = max(dot(n, -d), 0.);
    return hsv(h * 3. + uHue, .65, 1.) * spot * face * uDisco * 1.6 / (1. + dist * dist * .03);
  }`;

function zTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = 'bold 50px Outfit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#fff'; g.shadowBlur = 8;
  g.fillText('z', 32, 34);
  return new THREE.CanvasTexture(c);
}

export function createDiscoScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0xd15c);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05030a');
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  const U = {
    uTime: { value: 0 }, uSpin: { value: 0 }, uDisco: { value: 1 }, uHue: { value: rand() }, uBall: { value: BALL },
    uBeat: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSleep: { value: 0 }, uScale: { value: 800 },
  };

  // ------------------------------------------------------------------ the cat's fur: a rainbow that drifts through it
  const furMat = keep(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW, vN, vL;
      void main(){ vL = (modelMatrix * vec4(position, 1.)).xyz; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${DISCO} uniform vec3 uCam; uniform float uSleep; varying vec3 vW, vN, vL;
      void main(){
        vec3 n = normalize(vN); vec3 V = normalize(uCam - vW);
        float hue = vL.y * .32 + vL.x * .12 - vL.z * .08 + uTime * .035 + uHue;
        // soft tabby stripes
        float stripe = smoothstep(.55, .95, sin(vL.y * 16. + sin(vL.x * 7.) * 1.5 + vL.z * 4.)) * .18;
        vec3 fur = hsv(hue, .72 - stripe, 1.);
        // a soft key light from the front, the floor's glow from below, rainbow rim light, disco spots
        float key = max(dot(n, normalize(vec3(.3, .8, .6))), 0.);
        float under = max(-n.y, 0.) * .35;
        float rim = pow(1. - max(dot(n, V), 0.), 2.5);
        vec3 col = fur * (.06 + .38 * key * (.45 + .55 * uDisco) + under * uDisco * .45) + hsv(hue + .5, .7, 1.) * rim * (.16 + .22 * uDisco);
        col += fur * spots(vW, n) * .7;
        gl_FragColor = vec4(col, 1.);
      }`,
  }));
  const plain = (hex, glow = 0) => keep(new THREE.ShaderMaterial({
    uniforms: { ...U, uCol: { value: new THREE.Color(hex) }, uGlowAmt: { value: glow } },
    vertexShader: `varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${DISCO} uniform vec3 uCam, uCol; uniform float uGlowAmt; varying vec3 vW, vN;
      void main(){ vec3 n = normalize(vN); vec3 V = normalize(uCam - vW);
        float key = max(dot(n, normalize(vec3(.3, .8, .6))), 0.);
        float spec = pow(max(dot(reflect(-V, n), normalize(vec3(.3, .8, .6))), 0.), 40.);
        vec3 col = uCol * (.1 + .6 * key + uGlowAmt) + vec3(1.) * spec * .6 + uCol * spots(vW, n) * .5;
        gl_FragColor = vec4(col, 1.); }`,
  }));
  const pinkMat = plain('#ff8fb8', 0.1), eyeMat = plain('#140c1c'), whiteMat = plain('#ffffff', 0.8);

  const cat = new THREE.Group();
  scene.add(cat);
  const sph = (r, ws = 28, hs = 20) => keep(new THREE.SphereGeometry(r, ws, hs));
  const add = (parent, geo, mat, pos, scale = [1, 1, 1], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); m.rotation.set(...rot); parent.add(m); return m;
  };
  const body = new THREE.Group(); cat.add(body);
  add(body, sph(0.55), furMat, [0, 0.45, -0.1], [1, 0.85, 1.05]);           // hips
  add(body, sph(0.42), furMat, [0, 0.86, 0.1], [0.95, 1.15, 0.9]);          // chest
  for (const sx of [-1, 1]) {
    add(body, sph(0.3), furMat, [sx * 0.33, 0.3, -0.08], [0.8, 0.95, 1.15]); // haunches
    add(body, sph(0.13), furMat, [sx * 0.34, 0.07, 0.24], [1, 0.65, 1.5]);   // back feet
    add(body, keep(new THREE.CapsuleGeometry(0.11, 0.42, 6, 14)), furMat, [sx * 0.17, 0.33, 0.33]); // front legs
    add(body, sph(0.14), furMat, [sx * 0.18, 0.08, 0.42], [1, 0.65, 1.3]);   // front paws
  }
  const head = new THREE.Group(); head.position.set(0, 1.4, 0.18); body.add(head);
  add(head, sph(0.4, 32, 24), furMat, [0, 0, 0], [1.12, 0.93, 0.95]);
  for (const sx of [-1, 1]) {
    add(head, sph(0.2), furMat, [sx * 0.2, -0.12, 0.17], [1.1, 0.85, 0.9]); // cheeks
    const ear = add(head, keep(new THREE.ConeGeometry(0.16, 0.34, 4)), furMat, [sx * 0.24, 0.34, -0.03], [1, 1, 0.7], [0, Math.PI / 4, sx * -0.38]);
    add(ear, keep(new THREE.ConeGeometry(0.09, 0.22, 4)), pinkMat, [0, -0.02, 0.05], [1, 1, 0.4]);
  }
  add(head, sph(0.14), furMat, [0, -0.13, 0.3], [1.25, 0.8, 1]);  // muzzle
  add(head, sph(0.045), pinkMat, [0, -0.05, 0.42], [1.3, 0.85, 1]); // nose
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = add(head, sph(0.085), eyeMat, [sx * 0.165, 0.04, 0.3], [1, 1, 0.55]);
    add(eye, sph(0.028), whiteMat, [0.025, 0.03, 0.07]); // the sparkle in its eye
    eyes.push(eye);
  }
  // whiskers
  {
    const pts = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) pts.push(sx * 0.12, -0.12 + k * 0.03, 0.36, sx * 0.48, -0.16 + k * 0.06, 0.32);
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    head.add(new THREE.LineSegments(g, keep(new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }))));
  }
  // the tail: a chain of shrinking spheres, waved each frame
  const TAIL = 40;
  const tail = [];
  for (let k = 0; k < TAIL; k++) tail.push(add(cat, sph(0.095 - k * 0.0011, 14, 10), furMat, [0, 0, 0]));

  // ------------------------------------------------------------------ the dance floor
  const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(9, 64)), keep(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${DISCO} uniform float uBeat; uniform vec3 uCam; varying vec3 vW;
      void main(){
        vec2 g = vW.xz / .8; vec2 id = floor(g); vec2 f = fract(g);
        float grout = smoothstep(.0, .05, f.x) * smoothstep(1., .95, f.x) * smoothstep(.0, .05, f.y) * smoothstep(1., .95, f.y);
        float r = length(vW.xz);
        // tiles light up in slow waves rolling out from the cat, and flash with the beat
        float wave = .5 + .5 * sin(r * 1.4 - uTime * 1.2 + dh(id) * 2.);
        float on = smoothstep(.55, .9, wave) * (.4 + .6 * step(.35, dh(id + 4.))) + uBeat * step(.6, dh(id + floor(uTime * 2.))) * .8;
        vec3 tile = hsv(dh(id) * .5 + r * .05 + uTime * .03 + uHue, .7, 1.);
        vec3 col = tile * (.03 + on * .5 * uDisco) * grout;
        // a soft glossy sheen and a dark contact shadow under the cat
        vec3 V = normalize(uCam - vW);
        col += vec3(.6, .55, .8) * pow(max(V.y, 0.), 12.) * .05;
        col *= smoothstep(.35, 1.1, r) * .75 + .25;
        col += spots(vW, vec3(0., 1., 0.)) * .35;
        col *= smoothstep(9., 4., r);
        gl_FragColor = vec4(col, 1.);
      }`,
  })));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // the room: dark walls where the spots wheel round
  const room = new THREE.Mesh(keep(new THREE.CylinderGeometry(10, 10, 12, 64, 1, true)), keep(new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide,
    vertexShader: `varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = -normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${DISCO} varying vec3 vW, vN;
      void main(){ vec3 col = vec3(.012, .008, .022) + spots(vW, normalize(vN)) * .5; col *= smoothstep(-1., 2., vW.y) * smoothstep(9., 4., vW.y); gl_FragColor = vec4(col, 1.); }`,
  })));
  room.position.y = 5;
  scene.add(room);

  // ------------------------------------------------------------------ the mirror ball, its string, and beams through the haze
  const ball = new THREE.Mesh(keep(new THREE.SphereGeometry(0.42, 40, 24)), keep(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vL, vN, vW; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${DISCO} uniform vec3 uCam; varying vec3 vL, vN, vW;
      void main(){
        vec3 d = normalize(vL);
        vec2 g = vec2(atan(d.z, d.x) / 6.2832 * 40., acos(d.y) / 3.1416 * 22.);
        vec2 id = floor(g), f = fract(g);
        float edge = smoothstep(0., .1, f.x) * smoothstep(1., .9, f.x) * smoothstep(0., .1, f.y) * smoothstep(1., .9, f.y);
        float glint = pow(dh(id + floor(uTime * 3. + dh(id) * 10.)), 12.) * 4.;
        vec3 n = normalize(vN); float fac = .25 + .5 * max(dot(n, normalize(uCam - vW)), 0.);
        vec3 col = vec3(.55, .55, .62) * fac * edge + hsv(dh(id) + uHue, .5, 1.) * glint * edge * uDisco;
        gl_FragColor = vec4(col, 1.);
      }`,
  })));
  ball.position.copy(BALL);
  scene.add(ball);
  const string = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.008, 0.008, 2, 4)), keep(new THREE.MeshBasicMaterial({ color: '#333' })));
  string.position.set(0, BALL.y + 1.4, 0);
  scene.add(string);
  const BEAMS = mobile ? 7 : 10;
  const beamMat = keep(new THREE.ShaderMaterial({
    uniforms: { ...U, uColB: { value: new THREE.Color() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying float vY; varying float vFace, vNear; uniform vec3 uCam;
      void main(){ vY = position.y; vec4 w = modelMatrix * vec4(position, 1.); vec3 n = normalize(mat3(modelMatrix) * normal);
        vFace = abs(dot(n, normalize(uCam - w.xyz))); vNear = smoothstep(2.2, 5.5, length(uCam - w.xyz)); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uDisco; uniform vec3 uColB; varying float vY; varying float vFace, vNear;
      void main(){ float a = pow(vFace, 3.) * smoothstep(.5, .3, vY) * smoothstep(-.5, -.1, vY) * vNear; gl_FragColor = vec4(uColB * a * .2 * uDisco, 1.); }`,
  }));
  const beamGeo = keep(new THREE.CylinderGeometry(0.02, 0.5, 1, 10, 1, true)); beamGeo.translate(0, -0.5, 0);
  const beams = [];
  for (let k = 0; k < BEAMS; k++) {
    const m = new THREE.Mesh(beamGeo, beamMat.clone()); keep(m.material);
    m.material.uniforms = { ...U, uColB: { value: new THREE.Color().setHSL((k / BEAMS + U.uHue.value) % 1, 0.8, 0.6) } };
    m.position.copy(BALL); m.scale.set(1, 7, 1);
    m.userData = { a: (k / BEAMS) * TAU, tilt: 0.7 + rand() * 0.5 };
    scene.add(m); beams.push(m);
  }

  // ------------------------------------------------------------------ glitter in the air, and sleepy Zs
  const GLIT = mobile ? 260 : 420;
  const glGeo = keep(new THREE.BufferGeometry());
  const gp = new Float32Array(GLIT * 3), gs = new Float32Array(GLIT);
  for (let k = 0; k < GLIT; k++) { const a = rand() * TAU, r = 1.2 + rand() * 7; gp.set([Math.cos(a) * r, rand() * 6, Math.sin(a) * r], k * 3); gs[k] = rand(); }
  glGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  glGeo.setAttribute('aSeed', new THREE.BufferAttribute(gs, 1));
  const glitter = new THREE.Points(glGeo, keep(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale, uDisco, uHue; varying vec3 vCol;
      vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(fract(h + vec3(0., 2. / 3., 1. / 3.)) * 6. - 3.) - 1., 0., 1.); return v * mix(vec3(1.), k, s); }
      void main(){
        vec3 p = position; p.y = mod(p.y - uTime * (.05 + aSeed * .08), 6.);
        p.x += sin(uTime * .4 + aSeed * 30.) * .2;
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
        float tw = pow(.5 + .5 * sin(uTime * (2. + aSeed * 4.) + aSeed * 90.), 6.);
        gl_PointSize = max(1., uScale * .035 * (.5 + aSeed) / d * (1. + tw));
        vCol = hsv(aSeed + uTime * .05 + uHue, .5, 1.) * (.1 + tw) * (.35 + .65 * uDisco);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; gl_FragColor = vec4(vCol * exp(-r * 6.) * (1. - r), 1.); }`,
  })));
  glitter.frustumCulled = false;
  scene.add(glitter);

  const zTex = keep(zTexture());
  const zs = [];
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, opacity: 0, color: '#d8c8ff' })));
    s.userData = { t0: -99 }; scene.add(s); zs.push(s);
  }
  let nextZ = 0, zN = 0;

  // ------------------------------------------------------------------ motion
  let t = 0, beat = 0, nod = 0, disco = 1, sleep = 0, blinkAt = 3, hueTarget = U.uHue.value;
  const look = new THREE.Vector3(0, 1.0, 0), headWorld = new THREE.Vector3();
  function onEvent(ev) {
    if (ev.type === 'kick') { beat = 1; nod = 1; }
    else if (ev.type === 'chord') hueTarget += 0.08;
  }

  function update(time, dt, st) {
    t = time;
    const e = st.energy;
    U.uTime.value = t;
    U.uScale.value = innerHeight * Math.min(devicePixelRatio || 1, 2) / (2 * Math.tan(camera.fov * Math.PI / 360));
    // the disco dims and slows as the cat gets sleepy
    disco += ((0.25 + 0.75 * Math.min(1, e * 1.25)) - disco) * Math.min(1, dt * 0.1);
    sleep += ((e < 0.5 ? 1 : e < 0.62 ? (0.62 - e) / 0.12 : 0) - sleep) * Math.min(1, dt * 0.08);
    U.uDisco.value = disco; U.uSleep.value = sleep;
    U.uSpin.value += dt * (0.08 + 0.17 * disco);
    beat *= Math.exp(-dt * 5); U.uBeat.value = beat;
    U.uHue.value += (hueTarget - U.uHue.value) * Math.min(1, dt * 0.3);
    nod *= Math.exp(-dt * 6);

    // the cat: bobs with the beat when awake, breathes slowly, head droops as it falls asleep
    const breathe = Math.sin(t * (1.2 - sleep * 0.5)) * 0.012;
    body.scale.set(1 + breathe, 1 + breathe * 1.5, 1 + breathe);
    body.rotation.z = Math.sin(t * 1.3) * 0.04 * (1 - sleep);
    head.rotation.x = nod * 0.12 * (1 - sleep) + sleep * 0.32 + Math.sin(t * 0.7) * 0.03;
    head.rotation.z = Math.sin(t * 0.9) * 0.08 * (1 - sleep) + sleep * 0.12;
    head.position.y = 1.4 - sleep * 0.12;
    // blinking, then eyes closing as it nods off
    if (t > blinkAt) blinkAt = t + 2.5 + rand() * 4;
    const blink = Math.max(0, 1 - Math.abs(t - blinkAt + 0.12) / 0.12);
    const open = Math.max(0.06, (1 - sleep * 0.97) * (1 - blink * 0.94));
    for (const eye of eyes) eye.scale.y = open;
    // the tail curls round and swishes
    for (let k = 0; k < TAIL; k++) {
      const s = k / (TAIL - 1);
      const sw = Math.sin(t * (1.6 - sleep) - s * 2.2) * (0.25 + 0.15 * (1 - sleep)) * s;
      const a = -Math.PI / 2 - s * 2.0 + sw; // sweeping round from behind to the side
      const lift = (1 - sleep * 0.8) * Math.pow(s, 2.2) * 0.75; // the tip curls up when it's awake
      tail[k].position.set(Math.cos(a) * (0.58 + s * 0.12) + 0.05, 0.1 + Math.sin(s * Math.PI * 0.8) * 0.12 + lift, Math.sin(a) * (0.58 + s * 0.15) - 0.1);
    }

    // beams sweep round from the mirror ball
    for (const b of beams) {
      const u = b.userData, a = u.a + U.uSpin.value;
      b.rotation.set(0, 0, 0);
      b.rotateY(a); b.rotateX(u.tilt);
    }

    // sleepy Zs drift up from its head
    head.getWorldPosition(headWorld);
    if (sleep > 0.6 && t > nextZ) { const z = zs[zN++ % zs.length]; z.userData.t0 = t; z.userData.side = rand() < 0.5 ? -1 : 1; nextZ = t + 2.6; }
    for (const z of zs) {
      const age = t - z.userData.t0;
      if (age < 0 || age > 5) { z.material.opacity = 0; continue; }
      z.position.set(headWorld.x + 0.3 * (z.userData.side || 1) + Math.sin(age * 1.5) * 0.1, headWorld.y + 0.35 + age * 0.22, headWorld.z + 0.1);
      const sc = 0.12 + age * 0.05; z.scale.set(sc, sc, sc);
      z.material.opacity = Math.min(1, age * 1.5) * Math.max(0, 1 - age / 5) * 0.9;
    }

    // the camera circles slowly, lower and closer as the cat sleeps
    const ca = t * 0.05 + 0.4, r = 4.3 - sleep * 0.5;
    camera.position.set(Math.sin(ca) * r, 1.55 + Math.sin(t * 0.07) * 0.15 - sleep * 0.2, Math.cos(ca) * r);
    look.set(0, 1.05 - sleep * 0.1, 0);
    camera.lookAt(look);
    U.uCam.value.copy(camera.position);
  }

  return {
    scene, camera, update, onEvent, portraitFov: 66,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.0, bloom: [0.6, 0.5, 0.55], finish: { vignette: 0.45, grain: 0.022, ca: 0.6 } },
    dispose() { for (const d of disposables) d.dispose?.(); },
  };
}
