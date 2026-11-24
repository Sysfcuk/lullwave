// The Stardome: a hillside under an enormous starry sky, and far below, a little concert stage
// glowing pink and violet under a shell of light. No crowd, no noise: soft beams sweep slowly
// across the sky, a crescent moon hangs over it all, paper lanterns drift upwards, and the stars
// swell gently on every chord of the music.
import { createStage, orbitRig, nightSky, moonlight, terrain, shaft, motes, glowMaterial, cyl, THREE, TAU } from '../kit.js';

export function createStardomeScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x5ad, bg: '#0a0620', fog: { color: '#1a0f36', near: 60, far: 500 }, exposure: 1.1, bloom: [0.85, 0.6, 0.45], finish: { vignette: 0.45, grain: 0.022, ca: 0.6 }, fov: 58 });
  const { rand } = S;
  const sky = nightSky(S, { top: '#07041c', horizon: '#3a1d5a', moon: [0.18, 0.55, -0.8], moonSize: 0.05, moonColor: '#fff2e6', halo: '#b07ad0', stars: 1.6, clouds: 0.15, cloudColor: '#3a2560', tint: '#ff6fc8', crescent: 1 });
  moonlight(S, { dir: [0.4, 0.6, -0.6], color: '#c9a8f0', intensity: 0.7, sky: '#5a3a8a', ground: '#140c22', fill: 0.6 });

  // the hill we sit on, falling away to the valley where the stage is
  const height = (x, z) => (z > 0 ? 6 + z * 0.06 : 6 + z * 0.12) + 2 * Math.sin(x * 0.03) + Math.max(0, Math.abs(x) - 120) * 0.1 - Math.max(0, -z - 60) * 0.05 * 0;
  terrain(S, { size: 600, seg: mobile ? 110 : 150, height: (x, z) => Math.max(-12, height(x, z)), color: (x, z) => (z > -40 ? '#1e1530' : '#160f26') });

  // the stage: a platform under a shell of light rings, glowing in pink and violet
  const stage = new THREE.Group(); stage.position.set(0, -10.5, -150); S.add(stage);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(14, 15, 1.6, 40, 1, false, 0, Math.PI), S.mat('#2a1d3a')); deck.rotation.y = Math.PI / 2; stage.add(deck);
  const shellMats = [];
  for (let k = 0; k < 6; k++) {
    const m = glowMaterial(S, k % 2 ? '#ff7ad9' : '#a77aff', 0.7, false); shellMats.push(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(10 - k * 1.2, 0.18, 8, 48, Math.PI), m); ring.position.set(0, 0.8, -k * 1.4); stage.add(ring);
  }
  const glowFloor = new THREE.Mesh(new THREE.CircleGeometry(12, 40, 0, Math.PI), glowMaterial(S, '#ff9ae6', 0.45, false)); glowFloor.rotation.x = -Math.PI / 2; glowFloor.rotation.z = Math.PI; glowFloor.position.y = 0.85; stage.add(glowFloor);
  const spot = new THREE.PointLight('#ff8ae0', 30, 60, 2); spot.position.set(0, 6, 4); stage.add(spot);
  // beams sweeping the sky, slowly
  const beams = [];
  for (let k = 0; k < 5; k++) { const b = shaft(S, { from: [0, 0, 0], to: [0, 120, 0], r0: 0.6, r1: 7, color: k % 2 ? '#ff7ad9' : '#9a7aff', opacity: 0.12 }); b.position.set(-8 + k * 4, -9.5, -150); beams.push({ b, ph: rand() * TAU }); }
  S.on((t, dt, st) => {
    beams.forEach(({ b, ph }, k) => { b.rotation.set(Math.sin(t * 0.07 + ph) * 0.35, 0, Math.sin(t * 0.05 + ph * 2) * 0.45 + (k - 2) * 0.15); b.rotateX(Math.PI); });
    shellMats.forEach((m, k) => { m.userData.u.uLevel.value = (0.5 + 0.4 * Math.sin(t * 0.4 - k * 0.6)) * (0.5 + 0.5 * st.energy); });
    spot.intensity = 20 + 10 * Math.sin(t * 0.3);
  });

  // paper lanterns drifting up into the night
  const lanterns = motes(S, { kind: 'spark', count: mobile ? 40 : 70, box: [120, 140, 120], center: [0, 60, -110], color: '#ffb36b', size: 0.9, speed: 0.08 });
  // and the stars breathe with the music
  let pulse = 0;
  S.onEvent((ev) => { if (ev.type === 'chord') pulse = 1; });
  S.on((t, dt) => { pulse *= Math.exp(-dt * 0.5); sky.userData.u.uPulse.value = pulse * 0.6; });

  // sit on the hillside, looking up and out
  // pink glow-worms on the hillside around us
  motes(S, { kind: 'firefly', count: 60, box: [40, 2, 30], center: [0, 8, 12], color: '#ff9ae6', size: 0.12, speed: 0.4 });
  orbitRig(S, { center: [0, 0, -150], radius: 175, height: 9.5, speed: 0.008, lookY: 68, start: 0, arc: 0.18 });
  return S.finalize({ portraitFov: 72 });
}
