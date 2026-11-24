// ET's Midnight Meadow: a horse grazing in a moonlit field. Long grass sways around it,
// fireflies drift through the dark, Cotswold hills roll away under a huge low moon, and far off
// a little stable glows with a lantern. Slowly, the camera circles.
import { createStage, orbitRig, nightSky, moonlight, terrain, building, lantern, motes, scatter, treeGeo, THREE } from '../kit.js';
import { horse } from '../figures.js';
import { makeGrass, updateGrass } from '../country.js';

export function createMeadowScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0xe7, bg: '#060a1c', fog: { color: '#0d1430', near: 60, far: 520 }, exposure: 1.1, bloom: [0.7, 0.6, 0.55], finish: { vignette: 0.45, grain: 0.022, ca: 0.4 }, fov: 50 });
  const { rand } = S;
  const MOON = [-0.12, 0.2, -1];
  nightSky(S, { top: '#040820', horizon: '#1d2a55', moon: MOON, moonSize: 0.058, moonColor: '#e9e4d2', halo: '#56679f', clouds: 0.35 });
  // the moon hangs ahead, but the light comes over your shoulder so the horse reads in the dark
  const L = moonlight(S, { dir: [0.6, 0.7, 0.8], color: '#b4c2f0', intensity: 1.35, sky: '#4a5a9a', ground: '#141a2c', fill: 0.75 });

  // the field, and the hills beyond it
  const height = (x, z) => {
    const r = Math.hypot(x, z);
    return 0.6 * Math.sin(x * 0.05) * Math.cos(z * 0.04) + Math.max(0, r - 70) * 0.12 * (1 + 0.6 * Math.sin(x * 0.012 + 1) * Math.sin(z * 0.01));
  };
  terrain(S, { size: 900, seg: mobile ? 140 : 200, height, color: (x, z, h) => (h > 6 ? '#24361f' : '#2c4326') });
  const grass = makeGrass({
    count: mobile ? 13000 : 22000, box: 28, U: S.U, rand, tint: '#3d5c2c',
    groundGLSL: 'float groundH(float x, float z){ float r = length(vec2(x, z)); return .6 * sin(x * .05) * cos(z * .04) + max(0., r - 70.) * .12 * (1. + .6 * sin(x * .012 + 1.) * sin(z * .01)); }',
  });
  S.add(grass);
  S.on(() => updateGrass(grass, { cam: S.camera.position, hemi: L.hemi, sun: L.key, fog: S.scene.fog }));

  // the horse
  const H = horse(S, { coat: ['#6b3b20', '#3a2a22', '#8a8a86', '#a0582c'][Math.floor(rand() * 4)], blaze: rand() < 0.5, socks: rand() < 0.4, pos: [0, height(0, 0), 0], ry: 0.6, mode: 'graze' });
  S.onEvent((ev) => { if (ev.type === 'horse') H.nicker(); });

  // the stable, its lantern, and a few oaks and a hedge
  const st = building(S, { w: 12, d: 6, h: 3.4, roof: 2.4, wall: '#7a5a3a', roofCol: '#3d3a36', pos: [-34, height(-34, -48) - 0.2, -48], ry: 0.4, chimney: false, windows: [['front', -3.5, 2, 0.8, 0.7], ['front', 3.5, 2, 0.8, 0.7]], glow: '#ffb35a', doorCol: '#3a2a1c' });
  lantern(S, { pos: [-34 + 1.2, height(-34, -48) + 2.6, -44.5], intensity: 4, distance: 12, halo: 2.2 });
  const oaks = [];
  for (let k = 0; k < 26; k++) { const a = rand() * Math.PI * 2, r = 35 + rand() * 90; const x = Math.cos(a) * r, z = Math.sin(a) * r; oaks.push([x, height(x, z) - 0.3, z, 0.9 + rand() * 0.8, rand() * 6]); }
  scatter(S, treeGeo(rand, { canopy: '#203a1e', trunk: '#2a2018' }), oaks);

  // fireflies drifting through the grass
  motes(S, { kind: 'firefly', count: mobile ? 70 : 110, box: [44, 3, 44], center: [0, 1.4, 0], color: '#d6ff7a', size: 0.09, speed: 0.6 });

  orbitRig(S, { center: [0, 0, 0], radius: 7.8, height: 2.5, speed: 0.012, lookY: 1.25, start: 0.1, arc: 0.6 }); // facing the moon
  return S.finalize({ portraitFov: 68 });
}
