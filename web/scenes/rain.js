// Neon Rain: looking out through a rain-streaked window at a city at night. The city is all
// out of focus: windows, neon signs and street lights melt into soft discs of colour, traffic
// streams along far below. Drops cling to the glass and run down it in fits and starts, each one
// a tiny lens showing the lights behind, leaving trails of droplets. Lightning flashes in the
// distance before the thunder in the music; chords shift the signs' colours.
//
// It is one full-screen shader: the city is drawn procedurally, so a drop can simply look it up
// at a bent position.
import * as THREE from 'three';
import { mulberry32 } from '../audio.js';

const PALETTES = [
  ['vec3(1., .25, .6)', 'vec3(.2, .8, 1.)', 'vec3(1., .65, .25)', 'vec3(.6, .35, 1.)'],
  ['vec3(.25, .9, 1.)', 'vec3(1., .3, .45)', 'vec3(.4, 1., .7)', 'vec3(1., .8, .45)'],
  ['vec3(1., .45, .2)', 'vec3(.9, .2, .8)', 'vec3(.3, .6, 1.)', 'vec3(1., .9, .6)'],
];

export function createRainScene({ mobile, seed }) {
  const rand = mulberry32(seed ^ 0x7a17);
  const pal = PALETTES[Math.floor(rand() * PALETTES.length)];
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const U = {
    uTime: { value: 0 }, uAspect: { value: 0.5 }, uFlash: { value: 0 }, uHue: { value: 0 }, uSeed: { value: rand() * 100 },
    uEnergy: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform float uTime, uAspect, uFlash, uHue, uSeed, uEnergy; varying vec2 vUv;
      float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
      float h2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec3 neon(float k){
        k = fract(k + uHue);
        vec3 a = ${pal[0]}, b = ${pal[1]}, c = ${pal[2]}, d = ${pal[3]};
        return k < .25 ? a : k < .5 ? b : k < .75 ? c : d;
      }
      // soft out-of-focus discs scattered over a grid: one layer of city lights
      vec3 bokeh(vec2 p, float cell, float size, float yMin, float yMax, float warm, float seedK){
        vec3 acc = vec3(0.);
        vec2 g = p / cell;
        vec2 id0 = floor(g);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 id = id0 + vec2(i, j);
          float r = h2(id + seedK + uSeed);
          vec2 c = (id + .5 + (vec2(h2(id + 7.1), h2(id + 3.3)) - .5) * .8) * cell;
          if (c.y < yMin || c.y > yMax || r > .62) continue;
          float d = length(p - c) / (size * (.6 + .8 * h2(id + 9.2)));
          float disc = smoothstep(1., .82, d) * (.65 + .35 * smoothstep(.55, 1., d)); // bokeh: a brighter rim
          float flick = .75 + .25 * sin(uTime * (.3 + r * 2.) + r * 40.);
          vec3 col = r < .3 ? neon(r * 4. + seedK) * 1.3 : mix(vec3(1., .62, .3), vec3(.55, .7, 1.), step(warm, h2(id + 1.7)));
          acc += col * disc * flick * (.35 + .65 * h2(id + 5.5));
        }
        return acc;
      }
      vec3 city(vec2 p){
        // the night sky glows from the city below, plus a flash of lightning
        vec3 col = mix(vec3(.05, .02, .09), vec3(.006, .006, .02), smoothstep(-.4, .6, p.y));
        col += vec3(.25, .08, .2) * smoothstep(.3, -.5, p.y) * .4;
        col += vec3(.6, .6, .9) * uFlash * smoothstep(-.2, .7, p.y) * .6;
        float bh = .35;
        // windows and street lights near and far, two big neon signs, and the traffic below
        col += bokeh(p, .055, .018, -1., bh, .6, 1.) * .3;
        col += bokeh(p + vec2(uTime * .002, 0.), .11, .036, -1., .25, .5, 2.) * .32;
        col += bokeh(p, .26, .085, -.6, .15, .3, 3.) * .26;
        for (int k = 0; k < 2; k++) {
          vec2 sc = vec2(-.35 + float(k) * .75, .05 + float(k) * .12);
          float on = step(.08, fract(uTime * .07 + float(k) * .37)) * (.85 + .15 * sin(uTime * 23. + float(k)));
          col += neon(float(k) * .5 + .1) * exp(-length((p - sc) * vec2(1.6, 3.)) * 4.) * .55 * on;
        }
        for (int k = 0; k < 2; k++) {
          float lane = -.62 - float(k) * .07, dir = k == 0 ? 1. : -1.;
          vec2 q = vec2(p.x - uTime * .05 * dir, p.y - lane);
          float id = floor(q.x / .09);
          float x = (fract(q.x / .09) - .5) * .09;
          float car = step(.45, h1(id + float(k) * 13.));
          col += (k == 0 ? vec3(1., .2, .15) : vec3(1., .9, .7)) * car * smoothstep(.02, .008, length(vec2(x, q.y))) * .8;
        }
        return col;
      }
      // one layer of drops running down the glass: returns the lens offset (xy) and coverage (z)
      vec3 runners(vec2 uv, float t, float scale, float seedK){
        vec2 grid = vec2(7., 2.) * scale;
        vec2 p = uv * grid;
        float col = floor(p.x);
        float n = h1(col + seedK);
        p.y += t * (.12 + n * .1) * grid.y * .0 + n * 7.;
        vec2 id = floor(p), st = fract(p) - .5;
        float n2 = h2(id + seedK);
        // stick-slip: the drop hangs, then slides, then hangs again
        float ph = fract(t * (.05 + n2 * .05) + n2);
        float slide = smoothstep(.0, .35, ph) * .5 + smoothstep(.55, .9, ph) * .5;
        float y = .45 - slide * .9;
        float x = (n2 - .5) * .2 + sin(y * 9. + n2 * 6.) * .03;
        vec2 dp = (st - vec2(x, y)) * vec2(grid.y / grid.x, 1.) * vec2(1., .9);
        float r = .055 + .025 * n2;
        float drop = smoothstep(r, r * .7, length(dp));
        vec2 off = drop > 0. ? dp / r * drop : vec2(0.);
        // its trail of small droplets
        float above = st.y - y;
        vec2 tp = vec2((st.x - x) * grid.y / grid.x, fract(above * 7.) - .5);
        float trailR = .018 + .012 * (1. - clamp(above / .9, 0., 1.));
        float trail = smoothstep(trailR, trailR * .5, length(tp * vec2(1., 1. / 7.) * vec2(1., 7.))) * step(0., above) * (1. - smoothstep(.3, .9, above)) * step(.35, h2(vec2(id.x, floor(above * 7.)) + seedK));
        off += trail > 0. ? tp * 3. * trail : vec2(0.);
        return vec3(off, max(drop, trail * .8));
      }
      // small beads that cling to the glass, fading in as rain hits and out as they run off
      vec3 beads(vec2 uv, float t, float cells){
        vec2 p = uv * cells;
        vec2 id = floor(p), st = fract(p) - .5;
        float n = h2(id + 4.2);
        vec2 c = (vec2(h2(id + 1.3), h2(id + 8.8)) - .5) * .7;
        float life = sin((t * (.05 + n * .1) + n) * 6.2832) * .5 + .5;
        float r = (.06 + .12 * n) * life;
        float b = smoothstep(r, r * .6, length(st - c)) * step(.3, n);
        return vec3((st - c) / max(r, .001) * b * .6, b);
      }
      void main(){
        vec2 uv = vUv; vec2 p = (uv - .5) * vec2(uAspect, 1.);
        float t = uTime;
        vec3 r1 = runners(p * .9, t, 1., 1.);
        vec3 r2 = runners(p * 1.4 + 3.1, t * .9, 1.6, 2.);
        vec3 b1 = beads(p, t, 34.);
        vec3 b2 = beads(p + 9.7, t * 1.3, 58.);
        vec2 off = r1.xy * r1.z + r2.xy * r2.z * .8 + b1.xy * b1.z + b2.xy * b2.z * .6;
        float cover = clamp(r1.z + r2.z + b1.z + b2.z, 0., 1.);
        // through a drop the city is refracted and seen a little sharper and brighter; the rest
        // of the glass is misted
        // each drop is a little lens: it shows the lights behind it bent, brighter and upside down
        vec3 col = city(p - off * .16) * (1. + cover * .5);
        col = mix(col, col * .78 + vec3(.012, .012, .02), (1. - cover) * .4); // the rest of the glass is misted
        // a dark rim round each drop and a highlight on its upper edge
        float rim = smoothstep(.55, .95, length(off));
        col *= 1. - rim * cover * .6;
        col += vec3(.85, .9, 1.) * pow(max(off.y, 0.), 4.) * cover * .35;
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);

  let t = 0, flash = 0, flashAt = -99, hue = 0, hueTarget = 0;
  function onEvent(ev, at) {
    if (ev.type === 'lightning') flashAt = at ?? t;
    else if (ev.type === 'chord') hueTarget += 0.06;
  }
  function update(time, dt, st) {
    t = time;
    U.uTime.value = t;
    U.uAspect.value = camera.userData.aspect ?? (innerWidth / innerHeight);
    U.uEnergy.value = st.energy;
    // a lightning flash: two or three flickers, then gone
    const a = t - flashAt;
    flash = a > 0 && a < 1.2 ? Math.max(0, Math.sin(a * 22) * Math.exp(-a * 3.5)) + (a < 0.12 ? 0.6 : 0) : 0;
    U.uFlash.value = flash * (0.25 + 0.75 * st.energy); // softer flashes as the night goes on
    hue += (hueTarget - hue) * Math.min(1, dt * 0.2);
    U.uHue.value = hue;
  }
  // the renderer sets camera.aspect on perspective cameras; keep our own copy
  Object.defineProperty(camera, 'aspect', { set(v) { camera.userData.aspect = v; }, get() { return camera.userData.aspect; } });

  return {
    scene, camera, update, onEvent,
    look: { toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.1, bloom: [0.7, 0.6, 0.45], finish: { vignette: 0.45, grain: 0.03, ca: 0.6 } },
    dispose() { mat.dispose(); quad.geometry.dispose(); },
  };
}
