// Interiors for the dream worlds: rooms with painted walls and floors (stone, brick, plaster,
// boards), windows that let the moonlight in as shafts full of dust, candles and fires that
// flicker, and a few bits of furniture.
import { THREE, canvasTexture, shaft, motes, TAU } from './kit.js';

/** Painted textures: 'stone' blocks, 'brick', 'planks', 'plaster', 'tiles' (checkerboard). */
export function surface(S, kind, { color = '#8a7a66', repeat = [4, 4] } = {}) {
  const base = new THREE.Color(color);
  const tex = canvasTexture(S, 256, 256, (g, w, h) => {
    g.fillStyle = base.getStyle(); g.fillRect(0, 0, w, h);
    const shade = (k) => base.clone().multiplyScalar(k).getStyle();
    if (kind === 'stone' || kind === 'brick') {
      const rows = kind === 'brick' ? 12 : 6, bw = kind === 'brick' ? 42 : 64;
      for (let r = 0; r < rows; r++) for (let c = -1; c < w / bw + 1; c++) {
        const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * (h / rows);
        g.fillStyle = shade(0.82 + Math.random() * 0.3); g.fillRect(x + 2, y + 2, bw - 4, h / rows - 4);
      }
    } else if (kind === 'planks') {
      for (let i = 0; i < 8; i++) { g.fillStyle = shade(0.8 + Math.random() * 0.3); g.fillRect(i * 32 + 1, 0, 30, h); g.fillStyle = shade(0.6); g.fillRect(i * 32 + 1, (i * 77) % h, 30, 2); }
      g.strokeStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 40; k++) { const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 6, h); g.stroke(); }
    } else if (kind === 'tiles') {
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { g.fillStyle = (r + c) % 2 ? shade(1) : '#efe9dc'; g.fillRect(c * 32, r * 32, 32, 32); }
    } else { // plaster: soft mottling
      for (let k = 0; k < 400; k++) { g.fillStyle = shade(0.92 + Math.random() * 0.16); g.globalAlpha = 0.25; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 18, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat);
  return tex;
}

/** A box with rounded edges and corners (for cushions, sofas, soft things). Exact normals. */
export function softBox(w, h, d, r = 0.05, seg = 5) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position, nrm = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const ix = Math.max(0, w / 2 - r), iy = Math.max(0, h / 2 - r), iz = Math.max(0, d / 2 - r);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
    n.subVectors(v, c); if (n.lengthSq() < 1e-12) continue;
    n.normalize(); v.copy(c).addScaledVector(n, r);
    p.setXYZ(i, v.x, v.y, v.z); nrm.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

/** A room: floor, ceiling and four walls (seen from inside), each with its own surface. */
export function room(S, { w = 10, d = 10, h = 4, floor, walls, ceiling, pos = [0, 0, 0] }) {
  const g = new THREE.Group(); g.position.set(...pos);
  const plane = (pw, ph, mat, p, r) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat); m.position.set(...p); m.rotation.set(...r); m.receiveShadow = true; g.add(m); return m; };
  const mat = (tex, rep) => { if (tex.isTexture) { const t = tex.clone(); t.repeat.set(...rep); t.needsUpdate = true; S.keep(t); return new THREE.MeshLambertMaterial({ map: t }); } return S.mat(tex); };
  plane(w, d, mat(floor, [w / 3, d / 3]), [0, 0, 0], [-Math.PI / 2, 0, 0]);
  plane(w, d, mat(ceiling, [w / 3, d / 3]), [0, h, 0], [Math.PI / 2, 0, 0]);
  plane(w, h, mat(walls, [w / 4, h / 4]), [0, h / 2, -d / 2], [0, 0, 0]);
  plane(w, h, mat(walls, [w / 4, h / 4]), [0, h / 2, d / 2], [0, Math.PI, 0]);
  plane(d, h, mat(walls, [d / 4, h / 4]), [-w / 2, h / 2, 0], [0, Math.PI / 2, 0]);
  plane(d, h, mat(walls, [d / 4, h / 4]), [w / 2, h / 2, 0], [0, -Math.PI / 2, 0]);
  return S.add(g);
}

/** A window of moonlight: a pale glowing pane and a shaft of light falling into the room. */
export function moonWindow(S, { pos, ry = 0, w = 1.2, h = 1.6, to, color = '#9fb6ff', paneColor = '#4a5c96', shaftOpacity = 0.09, tex = null }) {
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : new THREE.MeshBasicMaterial({ color: paneColor, toneMapped: false }));
  pane.position.set(...pos); pane.rotation.y = ry; S.add(pane);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.08, 0.08), S.mat('#2a2018')); frame.position.set(...pos); frame.rotation.y = ry; S.add(frame);
  const frame2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, h + 0.16, 0.08), S.mat('#2a2018')); frame2.position.set(...pos); frame2.rotation.y = ry; S.add(frame2);
  if (to) shaft(S, { from: pos, to, r0: Math.min(w, h) * 0.45, r1: Math.max(w, h) * 0.9, color, opacity: shaftOpacity });
  return pane;
}

/** A candle: wax, a flame that wavers, and (optionally) a real light. */
export function candle(S, { pos, h = 0.25, r = 0.035, light = false, color = '#ffb35a', intensity = 1.6, distance = 6 }) {
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 10), S.mat('#efe6d2')); wax.position.set(pos[0], pos[1] + h / 2, pos[2]); S.add(wax);
  const flame = flameSprite(S, [pos[0], pos[1] + h + 0.045, pos[2]], 0.09, color);
  let l = null;
  if (light) { l = new THREE.PointLight(color, intensity, distance, 2); l.position.set(pos[0], pos[1] + h + 0.15, pos[2]); S.add(l); }
  const seed = S.rand() * 50;
  S.on((t) => { const f = 0.85 + 0.1 * Math.sin(t * 9 + seed) + 0.05 * Math.sin(t * 23 + seed * 2); flame.scale.set(0.06 * f, 0.11 * (0.9 + 0.2 * f), 1); if (l) l.intensity = intensity * f; });
  return { wax, flame, light: l };
}

const flameTexs = new WeakMap(); // one flame texture per stage, disposed with it
export function flameSprite(S, pos, size = 0.1, color = '#ffb35a') {
  let flameTex = flameTexs.get(S);
  if (!flameTex) {
    flameTex = canvasTexture(S, 64, 128, (g) => {
      const gr = g.createRadialGradient(32, 84, 2, 32, 74, 40); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.35, 'rgba(255,190,90,.9)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(60, 70, 32, 124); g.quadraticCurveTo(4, 70, 32, 4); g.fill();
    });
    flameTexs.set(S, flameTex);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sp.position.set(...pos); sp.scale.set(size * 0.6, size * 1.1, 1);
  S.add(sp);
  return sp;
}

/** A fire in a grate or an oven: a cluster of flames, glowing embers, and a warm flickering light. */
export function fire(S, { pos, width = 0.8, intensity = 6, distance = 10, color = '#ff8a3a', flames = 7 }) {
  const fl = [];
  for (let k = 0; k < flames; k++) fl.push({ sp: flameSprite(S, [pos[0] + (k / (flames - 1) - 0.5) * width, pos[1] + 0.15, pos[2]], 0.45, k % 2 ? '#ffb45a' : '#ff7a3a'), ph: S.rand() * 10 });
  const embers = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.35), new THREE.MeshBasicMaterial({ color: '#ff5a1a', toneMapped: false })); embers.position.set(...pos); S.add(embers);
  const l = new THREE.PointLight(color, intensity, distance, 2); l.position.set(pos[0], pos[1] + 0.5, pos[2] + 0.4); S.add(l);
  S.on((t) => {
    fl.forEach(({ sp, ph }) => { const f = 0.75 + 0.25 * Math.sin(t * 6 + ph) * Math.sin(t * 3.7 + ph * 2); sp.scale.set(0.28 * f, 0.55 * (0.7 + 0.5 * f), 1); });
    l.intensity = intensity * (0.82 + 0.1 * Math.sin(t * 5.3) + 0.08 * Math.sin(t * 13.1));
    embers.material.color.setRGB(1, 0.32 + 0.08 * Math.sin(t * 2.3), 0.1);
  });
  return { light: l };
}

// ------------------------------------------------------------------ a real fireplace
const NOISE = `
  float hh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ return .5 * vn(p) + .27 * vn(p * 2.1 + 3.1) + .15 * vn(p * 4.3 + 7.7) + .08 * vn(p * 8.9 + 1.3); }`;

/**
 * A fireplace set into a wall: a painted surround with a proper opening, a recessed firebox of
 * sooty brick, an iron grate holding charred logs whose ends glow, a bed of embers, flames drawn
 * by a shader (a white-yellow core, orange body, red tips, licking upwards and never the same
 * twice), sparks drifting up the chimney, and the fire's light coming from inside the opening.
 * `wallZ` is the wall's face; the fireplace stands out from it towards +z.
 */
export function hearth(S, { x = 0, wallZ, width = 2.5, height = 1.4, depth = 0.5, opening = [1.3, 0.9], surround = '#d9cfbd', intensity = 4.5 }) {
  const g = new THREE.Group(); g.position.set(x, 0, wallZ); S.add(g);
  const [ow, oh] = opening, front = depth, side = (width - ow) / 2;
  const paint = S.mat(surround);
  // the surround: two pillars and a lintel, leaving the opening
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(softBox(side, height, depth, 0.03), paint); p.position.set(sx * (ow / 2 + side / 2), height / 2, depth / 2); g.add(p); }
  const lintel = new THREE.Mesh(softBox(ow + 0.02, height - oh, depth, 0.03), paint); lintel.position.set(0, oh + (height - oh) / 2, depth / 2); g.add(lintel);
  // a slim moulding round the opening
  const trim = S.mat('#c4b8a2');
  for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, oh, 0.03), trim); t.position.set(sx * (ow / 2 + 0.025), oh / 2, front + 0.01); g.add(t); }
  { const t = new THREE.Mesh(new THREE.BoxGeometry(ow + 0.1, 0.05, 0.03), trim); t.position.set(0, oh + 0.025, front + 0.01); g.add(t); }
  // the firebox: sooty brick on the back and the angled sides, a blackened ceiling and floor
  const brick = surface(S, 'brick', { color: '#4a2f24', repeat: [2, 1.5] });
  const sooty = S.keep(new THREE.MeshLambertMaterial({ map: brick, color: '#8a7a70' }));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(ow * 0.72, oh), sooty); back.position.set(0, oh / 2, 0.03); g.add(back);
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(sx * ow / 2, 0, front), b = new THREE.Vector3(sx * ow * 0.36, 0, 0.03), len = a.distanceTo(b);
    const sd = new THREE.Mesh(new THREE.PlaneGeometry(len, oh), sooty); sd.position.set((a.x + b.x) / 2, oh / 2, (a.z + b.z) / 2); sd.rotation.y = Math.atan2(b.z - a.z, b.x - a.x) * -1 + (sx > 0 ? Math.PI : 0); sd.material.side = THREE.DoubleSide; g.add(sd);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ow, front), S.mat('#120c0a')); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, oh, front / 2); g.add(ceil);
  const floorIn = new THREE.Mesh(new THREE.PlaneGeometry(ow, front), S.mat('#1a1412')); floorIn.rotation.x = -Math.PI / 2; floorIn.position.set(0, 0.004, front / 2); g.add(floorIn);

  // the grate: an iron basket on little legs
  const iron = S.mat('#1c1a1a'), gz = front * 0.5, gw = ow * 0.58;
  for (let k = 0; k < 7; k++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), iron); bar.position.set(-gw / 2 + (k / 6) * gw, 0.16, gz + 0.12); g.add(bar); }
  for (const y of [0.07, 0.25]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.018, 0.018), iron); rail.position.set(0, y, gz + 0.12); g.add(rail); }
  { const basePlate = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.015, 0.26), iron); basePlate.position.set(0, 0.07, gz); g.add(basePlate); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 5), iron); leg.position.set(sx * gw * 0.45, 0.035, gz + sz * 0.11); g.add(leg); }

  // logs: bark, and ends glowing where they've burned
  const bark = canvasTexture(S, 64, 128, (c, w, h) => { c.fillStyle = '#2e2018'; c.fillRect(0, 0, w, h); for (let k = 0; k < 90; k++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(10,6,4,.7)' : 'rgba(90,64,44,.5)'; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 6 + Math.random() * 20); } });
  const barkM = S.keep(new THREE.MeshLambertMaterial({ map: bark }));
  const glowEnd = S.keep(new THREE.ShaderMaterial({
    uniforms: { uTime: S.U.uTime }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `${NOISE} uniform float uTime; varying vec2 vUv; void main(){ vec2 c = vUv - .5; float r = length(c) * 2.; float n = fbm(c * 9. + uTime * .3); float hot = (1. - smoothstep(.2, 1., r)) * (.5 + .7 * n); vec3 col = mix(vec3(.25, .04, .01), vec3(1., .45, .08), clamp(hot, 0., 1.)); gl_FragColor = vec4(col * (.4 + hot * 1.4), 1.); }`,
  }));
  const LOGS = [[-0.12, 0.14, -0.08, 0.3, 0.07], [0.12, 0.14, -0.06, -0.25, 0.065], [0.0, 0.24, -0.03, 0.05, 0.06]];
  for (const [lx, ly, lz, ry, r] of LOGS) {
    const lg = new THREE.Group(); lg.position.set(lx, ly, gz + lz); lg.rotation.y = ry; g.add(lg);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.5, 10), barkM); body.rotation.z = Math.PI / 2; lg.add(body);
    for (const sx of [-1, 1]) { const end = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 14), glowEnd); end.position.x = sx * 0.251; end.rotation.y = sx * Math.PI / 2; lg.add(end); }
  }
  // the ember bed under the logs
  const embers = new THREE.Mesh(new THREE.PlaneGeometry(gw * 0.95, 0.24), new THREE.ShaderMaterial({
    uniforms: { uTime: S.U.uTime }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `${NOISE} uniform float uTime; varying vec2 vUv; void main(){ float n = fbm(vUv * vec2(14., 6.) + vec2(uTime * .05, uTime * .12)), m = fbm(vUv * vec2(30., 12.) - uTime * .2); float hot = smoothstep(.35, .8, n) * (.6 + .6 * m); vec3 col = mix(vec3(.08, .02, .01), vec3(1., .38, .06), clamp(hot, 0., 1.)); col += vec3(1., .8, .4) * smoothstep(.75, 1., hot) * .6; float edge = smoothstep(0., .15, vUv.x) * smoothstep(0., .15, 1. - vUv.x) * smoothstep(0., .2, vUv.y) * smoothstep(0., .2, 1. - vUv.y); gl_FragColor = vec4(col * edge, 1.); }`,
  }));
  S.keep(embers.material); embers.rotation.x = -Math.PI / 2; embers.position.set(0, 0.082, gz); g.add(embers);

  // the flames: shader quads that turn to face you, each licking and flickering in its own way
  const flameMat = (seed, amt) => S.keep(new THREE.ShaderMaterial({
    uniforms: { uTime: S.U.uTime, uSeed: { value: seed }, uAmt: { value: amt } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `${NOISE} uniform float uTime, uSeed, uAmt; varying vec2 vUv;
      void main(){
        vec2 uv = vUv;
        float n = fbm(vec2(uv.x * 2.6 + uSeed, uv.y * 2.2 - uTime * 1.5));
        float n2 = fbm(vec2(uv.x * 5.5 - uSeed * 1.7, uv.y * 4.5 - uTime * 2.3));
        float x = (uv.x - .5) * 2. + (n - .5) * .9 * uv.y;  // the flame sways more the higher it goes
        float w = mix(.9, .06, pow(uv.y, .75));            // wide at the base, a point at the top
        float body = 1. - smoothstep(w * .35, w, abs(x));
        float top = 1. - smoothstep(.35, 1., uv.y + (n2 - .5) * .45);
        float base = smoothstep(0., .1, uv.y);
        float f = clamp(body * top * base * (.65 + .6 * n2), 0., 1.);
        vec3 col = mix(vec3(.75, .12, .02), vec3(1., .5, .08), smoothstep(.12, .5, f));
        col = mix(col, vec3(1., .9, .62), smoothstep(.62, .95, f));
        gl_FragColor = vec4(max(col * f * uAmt, 0.), 1.);
      }`,
  }));
  const flames = [];
  const FL = [[-0.16, 0.34, 0.5, 0.8], [0.0, 0.42, 0.62, 1.0], [0.15, 0.32, 0.48, 0.75], [-0.05, 0.28, 0.4, 0.6], [0.08, 0.36, 0.55, 0.85]];
  FL.forEach(([fx, w, h, amt], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flameMat(i * 3.7 + S.rand() * 10, amt * 1.15));
    m.geometry.translate(0, h / 2, 0); m.position.set(fx, 0.13, gz + 0.02 - i * 0.012); g.add(m); flames.push(m);
  });
  motes(S, { kind: 'spark', count: 18, box: [gw * 0.8, 1.1, 0.2], center: [x, 0.75, wallZ + gz], color: '#ffa04a', size: 0.022, speed: 0.55 });

  // the light comes from inside the opening, low, so the surround is lit by it rather than blazing
  const light = new THREE.PointLight('#ff8f42', intensity, 8.5, 2); light.position.set(0, 0.32, front + 0.12); g.add(light);
  const glowTex = canvasTexture(S, 64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,140,60,.55)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
  const hearthGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); hearthGlow.rotation.x = -Math.PI / 2; hearthGlow.position.set(0, 0.07, front + 0.35); g.add(hearthGlow);
  const tmp = new THREE.Vector3();
  S.on((t) => {
    const flick = 0.8 + 0.12 * Math.sin(t * 5.3) + 0.08 * Math.sin(t * 13.1 + 1.3) + 0.05 * Math.sin(t * 23.7);
    light.intensity = intensity * flick; hearthGlow.material.opacity = 0.3 + 0.2 * flick;
    // turn each flame to face the camera, around the upright only
    S.camera.getWorldPosition(tmp); g.worldToLocal(tmp);
    for (const m of flames) m.rotation.y = Math.atan2(tmp.x - m.position.x, tmp.z - m.position.z);
  });
  return { group: g, light };
}
