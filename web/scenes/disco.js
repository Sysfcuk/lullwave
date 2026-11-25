// Disco Cat: a rainbow cat on a light-up dance floor under a spinning mirror ball. Its fur
// shimmers through the rainbow; spots of light from the mirror ball sweep over it, the floor and
// the walls; beams fan out through the haze, and two follow-spots track it. Early in the night it
// dances properly, on the beat (groove, point, paws up, step and clap, shimmy, a twirl), while a
// ring of kitten fans bobs along in the shadows. As the music winds down it sits and sways, yawns
// and stretches, hops onto a velvet cushion and curls up; the kittens nod off; little Zs float up.
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
    uBeat: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSleep: { value: 0 }, uScale: { value: 800 }, uPool: { value: new THREE.Vector3() },
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
        vec3 fur = hsv(hue, .82 - stripe, 1.);
        // a soft key light from the front, the floor's glow from below, rainbow rim light, disco spots
        float key = max(dot(n, normalize(vec3(.3, .8, .6))), 0.);
        float under = max(-n.y, 0.) * .35;
        float rim = pow(1. - max(dot(n, V), 0.), 2.5);
        vec3 col = fur * (.07 + .5 * key * (.5 + .5 * uDisco) + under * uDisco * .4) + hsv(hue + .5, .75, 1.) * rim * (.07 + .11 * uDisco);
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
  const pinkMat = plain('#ff8fb8', 0.1), eyeMat = plain('#140c1c'), whiteMat = plain('#ffffff', 0.8), mouthMat = plain('#5a1830', 0.05), velvet = plain('#5a1a6a', 0.04), gold = plain('#e8c060', 0.15), kitMat = plain('#3a2650', 0.03), kitEye = plain('#ffe27a', 1.6);

  // ------------------------------------------------------------------ the cat: a chubby dancer with arms and legs that bend
  // Root at the floor facing +z; the pelvis carries the body, the spine leans and sways, arms and legs
  // are two-jointed. Leg and arm angles: rotation.x swings forward (negative) or back; rotation.z
  // lifts out to the side (mirrored per side).
  const sph = (r, ws = 28, hs = 20) => keep(new THREE.SphereGeometry(r, ws, hs));
  const add = (parent, geo, mat, pos, scale = [1, 1, 1], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); m.rotation.set(...rot); parent.add(m); return m;
  };
  const cat = new THREE.Group(); scene.add(cat);
  const pelvis = new THREE.Group(); cat.add(pelvis);
  add(pelvis, sph(0.5), furMat, [0, 0.02, -0.05], [1, 0.82, 0.95]); // hips
  const spine = new THREE.Group(); spine.position.y = 0.18; pelvis.add(spine);
  const chest = add(spine, sph(0.42), furMat, [0, 0.36, 0.05], [0.95, 1.1, 0.88]);
  add(spine, sph(0.3), furMat, [0, 0.3, 0.2], [1.05, 1.1, 0.7]); // a soft round tummy
  const head = new THREE.Group(); head.position.set(0, 0.93, 0.1); spine.add(head);
  add(head, sph(0.4, 32, 24), furMat, [0, 0, 0], [1.12, 0.93, 0.95]);
  for (const sx of [-1, 1]) {
    add(head, sph(0.2), furMat, [sx * 0.2, -0.12, 0.17], [1.1, 0.85, 0.9]); // cheeks
    const ear = add(head, keep(new THREE.ConeGeometry(0.16, 0.34, 4)), furMat, [sx * 0.24, 0.34, -0.03], [1, 1, 0.7], [0, Math.PI / 4, sx * -0.38]);
    add(ear, keep(new THREE.ConeGeometry(0.09, 0.22, 4)), pinkMat, [0, -0.02, 0.05], [1, 1, 0.4]);
  }
  add(head, sph(0.14), furMat, [0, -0.13, 0.3], [1.25, 0.8, 1]); // muzzle
  add(head, sph(0.045), pinkMat, [0, -0.05, 0.42], [1.3, 0.85, 1]); // nose
  const mouth = add(head, sph(0.07), mouthMat, [0, -0.25, 0.33], [1, 0.05, 0.5]); // opens wide for a yawn
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = add(head, sph(0.085), eyeMat, [sx * 0.165, 0.04, 0.3], [1, 1, 0.55]);
    add(eye, sph(0.028), whiteMat, [0.025, 0.03, 0.07]); // the sparkle in its eye
    eyes.push(eye);
  }
  {
    const pts = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) pts.push(sx * 0.12, -0.12 + k * 0.03, 0.36, sx * 0.48, -0.16 + k * 0.06, 0.32);
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    head.add(new THREE.LineSegments(g, keep(new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }))));
  }
  const limb = (r0, r1, len) => { const g = keep(new THREE.CapsuleGeometry((r0 + r1) / 2, len, 6, 12)); g.translate(0, -len / 2, 0); return g; };
  const arms = [-1, 1].map((sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.3, 0.55, 0.12); spine.add(sh);
    add(sh, limb(0.12, 0.1, 0.36), furMat, [0, 0, 0]);
    const el = new THREE.Group(); el.position.y = -0.4; sh.add(el);
    add(el, limb(0.1, 0.09, 0.32), furMat, [0, 0, 0]);
    add(el, sph(0.13), furMat, [0, -0.4, 0.03], [1, 0.8, 1.1]); // paw
    return { sh, el, sx };
  });
  const legs = [-1, 1].map((sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.26, -0.05, 0.02); pelvis.add(hip);
    add(hip, sph(0.26), furMat, [0, -0.08, 0], [0.9, 1.05, 1.05]); // haunch
    add(hip, limb(0.16, 0.13, 0.26), furMat, [0, -0.04, 0]);
    const kn = new THREE.Group(); kn.position.y = -0.34; hip.add(kn);
    add(kn, limb(0.12, 0.1, 0.24), furMat, [0, 0, 0]);
    add(kn, sph(0.14), furMat, [0, -0.33, 0.1], [1, 0.6, 1.5]); // foot
    return { hip, kn, sx };
  });
  // the tail: a chain of shrinking spheres placed along a curve each frame
  const TAIL = 40, tail = [];
  for (let k = 0; k < TAIL; k++) tail.push(add(cat, sph(0.095 - k * 0.0011, 14, 10), furMat, [0, 0, 0]));

  // a velvet cushion to sleep on, behind the dance spot
  const CUSHION = new THREE.Vector3(0, 0, -1.0);
  {
    const cg = new THREE.Group(); cg.position.copy(CUSHION); scene.add(cg);
    add(cg, keep(new THREE.CylinderGeometry(0.76, 0.8, 0.18, 40)), velvet, [0, 0.09, 0]);
    add(cg, sph(1), velvet, [0, 0.17, 0], [0.76, 0.09, 0.76]);
    add(cg, keep(new THREE.TorusGeometry(0.78, 0.032, 8, 48)), gold, [0, 0.12, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; add(cg, keep(new THREE.ConeGeometry(0.045, 0.15, 8)), gold, [Math.cos(a) * 0.8, 0.05, Math.sin(a) * 0.8]); }
  }
  // a ring of kitten fans in the shadows, eyes glowing, bobbing along (and nodding off later)
  const KITS = mobile ? 7 : 9, kittens = [];
  for (let k = 0; k < KITS; k++) {
    const a = (k / KITS) * TAU + 0.3, r = 6.4 + rand() * 0.6, s = 1.05 + rand() * 0.3;
    const kg = new THREE.Group(); kg.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); kg.rotation.y = Math.atan2(-kg.position.x, -kg.position.z); kg.scale.setScalar(s); scene.add(kg);
    add(kg, sph(0.45), kitMat, [0, 0.42, 0], [1, 1.05, 0.95]);
    const kh = new THREE.Group(); kh.position.y = 1.05; kg.add(kh);
    add(kh, sph(0.33), kitMat, [0, 0, 0], [1.1, 0.95, 0.95]);
    for (const sx of [-1, 1]) {
      add(kh, keep(new THREE.ConeGeometry(0.13, 0.28, 4)), kitMat, [sx * 0.2, 0.3, 0], [1, 1, 0.7], [0, Math.PI / 4, sx * -0.38]);
      add(kh, sph(0.085), kitEye, [sx * 0.13, 0.03, 0.27], [1, 1.15, 0.5]);
    }
    kittens.push({ head: kh, eyes: kh.children.filter((c) => c.material === kitEye), phase: rand() * TAU, doze: 0.35 + rand() * 0.5 });
  }

  // ------------------------------------------------------------------ the dance floor
  const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(9, 64)), keep(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${DISCO} uniform float uBeat; uniform vec3 uCam, uPool; varying vec3 vW;
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
        col += vec3(1., .9, .95) * smoothstep(1.2, .25, length(vW.xz - uPool.xz)) * (.1 + .12 * uDisco); // the follow-spots' pool
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

  // follow-spots: two soft cones of light from high up either side, tracking the cat
  const spotGeo = keep(new THREE.CylinderGeometry(0.06, 0.85, 1, 20, 1, true)); spotGeo.rotateX(-Math.PI / 2); spotGeo.translate(0, 0, 0.5);
  const spotsL = [[-3.2, 6.4, 2.6, '#ffd6f0'], [3.4, 6.2, 2.2, '#d6e4ff']].map(([x, y, z, c]) => {
    const m = new THREE.Mesh(spotGeo, keep(new THREE.ShaderMaterial({
      uniforms: { ...U, uColS: { value: new THREE.Color(c) }, uAmt: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying float vZ, vFace; uniform vec3 uCam; void main(){ vZ = position.z; vec4 w = modelMatrix * vec4(position, 1.); vec3 n = normalize(mat3(modelMatrix) * normal); vFace = abs(dot(n, normalize(uCam - w.xyz))); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 uColS; uniform float uAmt; varying float vZ, vFace; void main(){ float a = pow(clamp(vFace, 0., 1.), 2.5) * smoothstep(0., .15, vZ) * (1. - smoothstep(.7, 1., vZ)); gl_FragColor = vec4(max(uColS * a * .09 * uAmt, 0.), 1.); }', // (edges in order: reversed smoothstep is undefined on some GPUs)
    })));
    m.position.set(x, y, z); m.scale.set(1, 1, Math.hypot(x, y, z)); scene.add(m); return m;
  });

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
  // The beat comes from the music's kick drum: the gaps between kicks give the tempo, so the
  // bounces land on the beat. Moves change every two bars. As the night winds down the cat sits
  // and sways, yawns and stretches, hops onto the cushion and curls up to sleep.
  let t = 0, beat = 0, disco = 1, sleep = 0, stand = 1, blinkAt = 3, hueTarget = U.uHue.value;
  let lastKick = -1, interval = 0.55, beats = 0, move = 'groove', moveFrom = 0, yawnT = -99, yawned = false;
  const MOVES = ['groove', 'point', 'pawsUp', 'stepTouch', 'shimmy', 'twirl'];
  const look = new THREE.Vector3(0, 1.0, 0), headWorld = new THREE.Vector3(), catPos = new THREE.Vector3();
  function onEvent(ev) {
    if (ev.type === 'kick') {
      beat = 1;
      if (lastKick > 0) { const gap = t - lastKick; if (gap > 0.3 && gap < 1.3) interval += (gap - interval) * 0.3; }
      lastKick = t; beats++;
      if (beats - moveFrom >= 8) { let m; do { m = MOVES[Math.floor(rand() * MOVES.length)]; } while (m === move); move = m; moveFrom = beats; }
    } else if (ev.type === 'chord') hueTarget += 0.08;
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  const S = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  // a pose: every joint's angles, plus where the pelvis sits
  const base = () => ({ py: 0.72, px: 0, pz: 0, prz: 0, rootY: 0, spx: 0, spy: 0, spz: 0, hx: 0, hy: 0, hz: 0,
    arm: [[0.05, 0.18, -0.35], [0.05, 0.18, -0.35]], leg: [[0, 0.04, 0], [0, 0.04, 0]], tailUp: 1, wrap: 0, eyes: 1, mouth: 0 });
  function dancePose(bp, ph, tt) {
    // bp: beats so far plus the phase into this one; ph: 0..1 through the current beat
    const P = base(), bounce = Math.pow(1 - Math.min(1, ph), 3), side = Math.floor(bp) % 2 ? 1 : -1, sway = Math.sin(bp * Math.PI);
    P.py -= 0.05 * bounce; P.leg.forEach((l) => { l[0] -= 0.22 * bounce; l[2] += 0.42 * bounce; });
    P.hx = 0.1 * bounce; P.px = sway * 0.07; P.prz = -sway * 0.08; P.spz = sway * 0.1;
    const into = beats - moveFrom + ph; // beats into this move
    switch (move) {
      case 'groove':
        P.arm = [[-0.35 + sway * 0.35, 0.55, -1.9], [-0.35 - sway * 0.35, 0.55, -1.9]]; P.hz = sway * 0.12; break;
      case 'point': { // one paw jabs up high then down across, the other on the hip
        const up = Math.floor(bp) % 2 === 0, k = S(0, 0.35, ph);
        P.arm[1] = up ? [lerp(-0.6, -0.3, k), lerp(0.5, 2.5, k), 0] : [lerp(-0.3, -0.7, k), lerp(2.5, -0.3, k), 0];
        P.arm[0] = [0.3, 0.7, -1.8]; P.px = side * 0.07; P.prz = -side * 0.1; P.hy = up ? 0.25 : -0.15; P.hx = up ? -0.25 : 0.15; break;
      }
      case 'pawsUp': { const w = Math.sin(bp * Math.PI) * 0.35; P.arm = [[-0.15, 2.6 - w, -0.4], [-0.15, 2.6 + w, -0.4]]; P.hx = -0.15; P.spz = w * 0.4; break; }
      case 'stepTouch': { // side to side, a clap on every beat
        const s2 = Math.sin(bp * Math.PI / 2); P.px = s2 * 0.24; P.prz = -s2 * 0.06;
        const lift = Math.max(0, Math.cos(bp * Math.PI / 2)), lift2 = Math.max(0, -Math.cos(bp * Math.PI / 2));
        P.leg[0][2] += lift * 0.5; P.leg[0][0] -= lift * 0.25; P.leg[1][2] += lift2 * 0.5; P.leg[1][0] -= lift2 * 0.25;
        const clap = 1 - bounce; P.arm = [[-0.7, lerp(-0.1, 0.45, clap), -1.5], [-0.7, lerp(-0.1, 0.45, clap), -1.5]]; break;
      }
      case 'shimmy': P.spy = Math.sin(tt * 17) * 0.12; P.arm = [[0.15, 0.85, -0.5], [0.15, 0.85, -0.5]]; P.hy = Math.sin(tt * 17) * -0.08; break;
      case 'twirl': { // one slow turn over the move's eight beats, paws out like a ballerina
        P.rootY = S(1, 7, into) * Math.PI * 2; P.arm = [[-0.2, 1.4, -0.2], [-0.2, 1.4, -0.2]]; P.hx = -0.1; break;
      }
    }
    P.tailUp = 1;
    return P;
  }
  function sitPose(bp, ph, tt) {
    // sitting up, swaying, a paw tapping on the beat, head bobbing
    const P = base(), bounce = Math.pow(1 - Math.min(1, ph), 3), sway = Math.sin(bp * Math.PI * 0.5);
    P.py = 0.46; P.spx = 0.3; P.leg = [[-1.5, 0.12, 1.55], [-1.5, 0.12, 1.55]];
    const tap = Math.floor(bp) % 2; P.arm = [[-0.3, 0.06, 0], [-0.3, 0.06, 0]];
    P.arm[tap][0] = -0.3 - 0.35 * bounce; P.arm[tap][2] = -0.5 * bounce;
    P.spz = sway * 0.08; P.hz = sway * 0.12; P.hx = -0.3 + bounce * 0.1; P.tailUp = 0.2; P.wrap = 0.6;
    return P;
  }
  function sleepPose(tt) {
    // curled on the cushion: legs folded, chest low, chin resting on its paws, tail round it
    const P = base(), br = Math.sin(tt * 0.9) * 0.02;
    P.py = 0.34 + br; P.spx = 1.05; P.leg = [[-1.6, 0.3, 2.6], [-1.6, 0.3, 2.6]];
    P.arm = [[-0.55, 0.15, -0.9], [-0.55, 0.15, -0.9]]; P.hx = -0.75; P.hy = 0.35; P.hz = 0.25;
    P.tailUp = 0; P.wrap = 1; P.eyes = 0;
    return P;
  }
  const blend = (A, B, k) => {
    const out = {};
    for (const key of Object.keys(A)) out[key] = Array.isArray(A[key]) ? A[key].map((v, i) => v.map((x, j) => lerp(x, B[key][i][j], k))) : lerp(A[key], B[key], k);
    return out;
  };

  function update(time, dt, st) {
    t = time;
    const e = st.energy;
    U.uTime.value = t;
    U.uScale.value = innerHeight * Math.min(devicePixelRatio || 1, 2) / (2 * Math.tan(camera.fov * Math.PI / 360));
    // the disco dims and slows as the cat gets sleepy
    disco += ((0.25 + 0.75 * Math.min(1, e * 1.25)) - disco) * Math.min(1, dt * 0.1);
    sleep += ((e < 0.5 ? 1 : e < 0.6 ? (0.6 - e) / 0.1 : 0) - sleep) * Math.min(1, dt * 0.08);
    stand += ((e > 0.72 ? 1 : e > 0.64 ? (e - 0.64) / 0.08 : 0) - stand) * Math.min(1, dt * 0.25);
    U.uDisco.value = disco; U.uSleep.value = sleep;
    U.uSpin.value += dt * (0.05 + 0.17 * disco);
    beat *= Math.exp(-dt * 5); U.uBeat.value = beat;
    U.uHue.value += (hueTarget - U.uHue.value) * Math.min(1, dt * 0.3);

    // where in the beat we are (free-running if the kicks have stopped)
    const sinceKick = lastKick > 0 ? t - lastKick : 99;
    const ph = sinceKick < interval * 2 ? Math.min(1.5, sinceKick / interval) : (t / 1.4) % 1;
    const bp = (sinceKick < interval * 2 ? beats : t / 1.4) + Math.min(1, ph);

    // a yawn and a stretch on the way to bed
    if (sleep > 0.25 && !yawned) { yawned = true; yawnT = t; }
    if (sleep < 0.05) yawned = false;
    const yawn = Math.max(0, Math.sin(Math.min(1, Math.max(0, (t - yawnT) / 3.2)) * Math.PI));

    let P = blend(sitPose(bp, ph, t), dancePose(bp, ph, t), S(0, 1, stand));
    P = blend(P, sleepPose(t), S(0.45, 0.85, sleep));
    if (yawn > 0) { P.mouth = Math.max(P.mouth, yawn); P.hx -= yawn * 0.35; P.arm = P.arm.map((a) => [lerp(a[0], -0.4, yawn * 0.7), lerp(a[1], 2.3, yawn * 0.7), a[2]]); P.eyes *= 1 - yawn * 0.8; }

    // apply it
    const onCushion = S(0.4, 0.75, sleep);
    catPos.set(P.px, 0, 0).lerp(CUSHION, onCushion); catPos.y = onCushion * 0.2 + Math.sin(onCushion * Math.PI) * 0.35; // a hop up onto it
    cat.position.copy(catPos); cat.rotation.y = P.rootY;
    pelvis.position.set(0, P.py, P.pz); pelvis.rotation.set(0, 0, P.prz);
    spine.rotation.set(P.spx, P.spy, P.spz);
    head.rotation.set(P.hx + Math.sin(t * 0.7) * 0.02, P.hy, P.hz);
    arms.forEach((A, i) => { const [sx, sz, ex] = P.arm[i]; A.sh.rotation.set(sx, 0, A.sx * sz); A.el.rotation.set(ex, 0, 0); });
    legs.forEach((L, i) => { const [hx, hz, kx] = P.leg[i]; L.hip.rotation.set(hx, 0, L.sx * hz); L.kn.rotation.set(kx, 0, 0); });
    mouth.scale.set(1, 0.05 + P.mouth * 0.85, 0.5);
    const breathe = Math.sin(t * (1.2 - sleep * 0.5)) * 0.012; chest.scale.set(0.95 + breathe, 1.1 + breathe * 1.5, 0.88 + breathe);
    // blinking, then eyes closing as it nods off
    if (t > blinkAt) blinkAt = t + 2.5 + rand() * 4;
    const blink = Math.max(0, 1 - Math.abs(t - blinkAt + 0.12) / 0.12);
    const open = Math.max(0.06, P.eyes * (1 - blink * 0.94));
    for (const eye of eyes) eye.scale.y = open;
    // the tail: up and swishing when dancing, curled round when sitting or asleep
    for (let k = 0; k < TAIL; k++) {
      const s = k / (TAIL - 1);
      const sw = Math.sin(t * (2.6 - sleep * 1.6) - s * 2.4) * (0.35 - sleep * 0.2) * s;
      // dancing: rising behind in an S
      const up = new THREE.Vector3(Math.sin(sw * 2) * 0.35 * s, P.py - 0.05 + Math.pow(s, 0.8) * 1.1, -0.45 - Math.sin(s * Math.PI * 0.8) * 0.35 + Math.pow(s, 2) * 0.2);
      // curled: sweeping round on the floor from behind to the side
      const a = -Math.PI / 2 - s * 2.7 + sw * 0.4, rr = 0.55 + s * 0.12 + Math.sin(s * Math.PI) * 0.06; // round the side and towards the front paws
      const curl = new THREE.Vector3(Math.cos(a) * rr + 0.05, 0.1 + Math.sin(s * Math.PI * 0.8) * 0.12 + P.wrap * 0, Math.sin(a) * rr - 0.1);
      tail[k].position.copy(curl.lerp(up, P.tailUp));
    }

    // beams sweep round from the mirror ball
    for (const b of beams) {
      const u = b.userData, a = u.a + U.uSpin.value;
      b.rotation.set(0, 0, 0);
      b.rotateY(a); b.rotateX(u.tilt);
    }
    // the follow-spots find the cat
    U.uPool.value.set(cat.position.x, 0, cat.position.z);
    for (const s of spotsL) { s.lookAt(cat.position.x, 0.4, cat.position.z); s.material.uniforms.uAmt.value = 0.55 + 0.45 * disco; }
    // the kittens bob along, and nod off one by one
    kittens.forEach((k) => { const awake = sleep < k.doze; k.head.rotation.x = awake ? Math.pow(1 - Math.min(1, ph), 3) * 0.18 * stand : 0.4; k.head.rotation.z = awake ? Math.sin(t * 1.5 + k.phase) * 0.08 : 0.15; k.eyes.forEach((ey) => { ey.scale.y = lerp(ey.scale.y, awake ? 1 : 0.08, Math.min(1, dt * 2)); }); });

    // sleepy Zs drift up from its head
    head.getWorldPosition(headWorld);
    if (sleep > 0.7 && t > nextZ) { const z = zs[zN++ % zs.length]; z.userData.t0 = t; z.userData.side = rand() < 0.5 ? -1 : 1; nextZ = t + 2.6; }
    for (const z of zs) {
      const age = t - z.userData.t0;
      if (age < 0 || age > 5) { z.material.opacity = 0; continue; }
      z.position.set(headWorld.x + 0.3 * (z.userData.side || 1) + Math.sin(age * 1.5) * 0.1, headWorld.y + 0.35 + age * 0.22, headWorld.z + 0.1);
      const sc = 0.12 + age * 0.05; z.scale.set(sc, sc, sc);
      z.material.opacity = Math.min(1, age * 1.5) * Math.max(0, 1 - age / 5) * 0.9;
    }

    // the camera circles slowly: a little further out while it dances, lower and closer as it sleeps
    const ca = t * 0.045 + 0.4, r = lerp(4.0, 4.9, stand) - sleep * 0.6;
    camera.position.set(cat.position.x * 0.5 + Math.sin(ca) * r, lerp(1.45, 1.75, stand) + Math.sin(t * 0.07) * 0.12 - sleep * 0.35, cat.position.z * 0.5 + Math.cos(ca) * r);
    look.set(cat.position.x * 0.8, lerp(0.95, 1.25, stand) - sleep * 0.45, cat.position.z * 0.8);
    camera.lookAt(look);
    U.uCam.value.copy(camera.position);
  }

  return {
    scene, camera, update, onEvent, portraitFov: 66,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.0, bloom: [0.6, 0.5, 0.55], finish: { vignette: 0.45, grain: 0.022, ca: 0.6 } },
    dispose() { for (const d of disposables) d.dispose?.(); },
  };
}
