// Shared bits for the countryside worlds: a stretch of land that repeats every P metres along the
// way (so the camera can quietly jump back by P and the walk or ride never ends), lit by a low sun
// that sets through the night, with a sky dome, hazy distance, and stars once it is dark.
import * as THREE from 'three';

export const TAU = Math.PI * 2;

/** Sky dome: a sunset gradient with a soft sun, wisps of cloud, and stars as it gets dark. */
export function makeSky(U) {
  return new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uDusk, uTime; uniform vec3 uSunDir, uHorizonCol, uZenithCol, uSunCol; varying vec3 vDir;
      float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        vec3 col = mix(uHorizonCol, uZenithCol, pow(smoothstep(-.04, .95, y), .7));
        float sd = max(dot(d, normalize(uSunDir)), 0.);
        col += uSunCol * (pow(sd, 900.) * 3. + pow(sd, 18.) * .35 + pow(sd, 4.) * .12) * smoothstep(-.06, .02, y);
        // wisps of cloud catching the light
        float az = atan(d.x, -d.z);
        float c = vn(vec2(az * 5. + uTime * .004, y * 30.)) * vn(vec2(az * 13., y * 60. + 3.));
        float cloud = smoothstep(.25, .6, c) * smoothstep(.02, .08, y) * smoothstep(.4, .15, y);
        col = mix(col, mix(uHorizonCol * 1.3, uSunCol * .9, pow(sd, 3.)) * (1. - uDusk * .8) + vec3(.02, .02, .04) * uDusk, cloud * .7);
        // stars come out at dusk
        vec2 sp = vec2(atan(d.x, d.z) * 130., y * 150.); vec2 cell = floor(sp); float h = h2(cell);
        if (h > .978 && y > .05) { vec2 cc = fract(sp) - .5 - (vec2(h2(cell + 3.1), h2(cell + 7.7)) - .5) * .6; col += vec3(.9, .9, 1.) * smoothstep(.13, 0., length(cc)) * smoothstep(.45, .85, uDusk) * (.6 + .4 * sin(uTime * (.5 + h) + h * 50.)); }
        gl_FragColor = vec4(col, 1.);
      }`,
  }));
}

/** Evening light: colours of sun, sky and haze for a dusk amount from 0 (golden hour) to 1 (night). */
/** Where the key light comes from: the low sun, swinging to a high moon as night falls. */
export function lightDir(sunDir, dusk, out) {
  const k = Math.min(1, Math.max(0, (dusk - 0.55) / 0.3));
  return out.copy(sunDir).lerp(new THREE.Vector3(-0.45, 0.75, -0.5).normalize(), k * k * (3 - 2 * k)).normalize();
}

export function lightAt(dusk) {
  const k = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, dusk));
  const k2 = (a, b, c) => (dusk < 0.5 ? new THREE.Color(a).lerp(new THREE.Color(b), dusk * 2) : new THREE.Color(b).lerp(new THREE.Color(c), (dusk - 0.5) * 2));
  return {
    sun: k2('#ffc58a', '#ff7f50', '#8796c8'),
    horizon: k2('#f7c08f', '#c2768a', '#141a33'),
    zenith: k2('#6f8fc4', '#3b3f78', '#05081a'),
    hemiSky: k2('#c9d7f0', '#8c88b8', '#3b4a7e'),
    hemiGround: k2('#6b7a3c', '#4a3d40', '#161a28'),
    fog: k2('#e6b892', '#a86f7e', '#0e1328'),
    sunI: 1.9 * (1 - dusk) + 0.42 * dusk * dusk, // the sun, then the moon
    hemiI: 1.15 - dusk * 0.7,
  };
}

/** A bushy tree: a lumpy canopy and a trunk, as one geometry with vertex colours. */
export function treeGeo(rand, { canopy = '#3f6b2f', trunk = '#4a3626', round = 1 } = {}) {
  const parts = [];
  const c = new THREE.Color(canopy), tc = new THREE.Color(trunk);
  const t = new THREE.CylinderGeometry(0.25, 0.4, 3.2, 6); t.translate(0, 1.6, 0);
  paint(t, tc); parts.push(t.toNonIndexed());
  for (let k = 0; k < 5; k++) {
    const g = new THREE.IcosahedronGeometry(1.6 + rand() * 0.9, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const j = 1 + (rand() - 0.5) * 0.25; p.setXYZ(i, p.getX(i) * j, p.getY(i) * j * round, p.getZ(i) * j); }
    g.translate((rand() - 0.5) * 2.2, 4 + rand() * 2, (rand() - 0.5) * 2.2);
    paint(g, c.clone().multiplyScalar(0.8 + rand() * 0.4));
    parts.push(g.toNonIndexed());
  }
  const merged = mergeAll(parts);
  merged.computeVertexNormals();
  return merged;
}

export function paint(g, color) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

export function mergeAll(parts) {
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Grass with detail: vertex colours give the broad patches; the fragment shader adds fine
 * mottling and mown stripes near the track, from the world position.
 */
export function grassMaterial(trackAt) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp;
      float gh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float mott = gn(vWp.xz * .35) * .6 + gn(vWp.xz * 1.7) * .4;
        diffuseColor.rgb *= .82 + .3 * mott;
        ${trackAt ? 'float tr = ' + trackAt + '; diffuseColor.rgb *= 1. + .1 * tr * (step(.5, fract(vWp.z / 4.)) - .5);' : ''}`);
  };
  return m;
}

/**
 * Grass: thousands of blades around the camera, each a single tapered triangle swaying in the
 * wind. The patch wraps round the camera in the vertex shader, so it costs nothing to move, and
 * every blade stands on the ground using the world's own height function (GLSL `groundH`).
 * `shortGLSL` returns a 0..1 factor to cut the grass short (a mown track, a lane).
 */
export function makeGrass({ count, box = 34, groundGLSL, shortGLSL = 'float shortK(float x, float z){ return 1.; }', U, tint = '#6f9a3c', rand }) {
  const pos = new Float32Array(count * 3 * 3), corner = new Float32Array(count * 3), seedA = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) {
    const x = (rand() - 0.5) * box, z = (rand() - 0.5) * box, sd = rand();
    for (let c = 0; c < 3; c++) { pos.set([x, 0, z], (k * 3 + c) * 3); corner[k * 3 + c] = c; seedA[k * 3 + c] = sd; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uGrass: { value: new THREE.Color(tint) }, uLightCol: { value: new THREE.Color('#fff') }, uAmb: { value: new THREE.Color('#888') }, uCamP: { value: new THREE.Vector3() }, uFogC: { value: new THREE.Color() }, uFogNear: { value: 100 }, uFogFar: { value: 900 } },
    side: THREE.DoubleSide,
    vertexShader: `attribute float aCorner, aSeed; uniform float uTime; uniform vec3 uCamP, uSunDir;
      ${groundGLSL}
      ${shortGLSL}
      varying float vTip, vShade; varying float vDist;
      void main(){
        vec2 rel = mod(position.xz - uCamP.xz + ${(box / 2).toFixed(1)}, ${box.toFixed(1)}) - ${(box / 2).toFixed(1)};
        vec2 b = uCamP.xz + rel;
        float h = (.18 + aSeed * .32) * shortK(b.x, b.y);
        float ang = aSeed * 31.4;
        vec2 side = vec2(cos(ang), sin(ang)) * .032;
        float wind = sin(uTime * 1.3 + b.x * .35 + b.y * .22) * .5 + sin(uTime * 2.1 + aSeed * 20.) * .2;
        vec3 p = vec3(b.x, groundH(b.x, b.y), b.y);
        if (aCorner < .5) p.xz -= side;
        else if (aCorner < 1.5) p.xz += side;
        else { p.y += h; p.xz += vec2(.35, .2) * wind * h; }
        vTip = aCorner > 1.5 ? 1. : 0.;
        vShade = .75 + .5 * aSeed;
        vec4 mv = viewMatrix * vec4(p, 1.); vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uGrass, uLightCol, uAmb, uFogC; uniform float uFogNear, uFogFar; varying float vTip, vShade, vDist;
      void main(){
        vec3 base = uGrass * .5, tip = uGrass * 1.02 + vec3(.03, .025, 0.);
        vec3 col = mix(base, tip, vTip) * vShade * (uAmb + uLightCol * (.35 + .65 * vTip));
        float f = smoothstep(uFogNear, uFogFar, vDist);
        float edge = smoothstep(${(box * 0.5).toFixed(1)}, ${(box * 0.32).toFixed(1)}, vDist);
        if (edge < .02) discard;
        gl_FragColor = vec4(mix(col, uFogC, f), 1.);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/** Feed the grass the scene's current light, fog and camera. */
export function updateGrass(grass, { cam, hemi, sun, fog }) {
  const u = grass.material.uniforms;
  u.uCamP.value.copy(cam);
  u.uLightCol.value.copy(sun.color).multiplyScalar(sun.intensity * 0.55);
  u.uAmb.value.copy(hemi.color).lerp(hemi.groundColor, 0.4).multiplyScalar(hemi.intensity * 0.6);
  u.uFogC.value.copy(fog.color); u.uFogNear.value = fog.near; u.uFogFar.value = fog.far;
}

/** Long golden-hour shadows from the key light, in a box that follows the camera. */
export function setupShadows(sun, mobile) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const c = sun.shadow.camera;
  c.left = -55; c.right = 55; c.top = 55; c.bottom = -55; c.near = 50; c.far = 900;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  sun.shadow.radius = 3;
}
