// Plain Sailing's music: a slow sea lullaby in a rocking 6/8, for a night ferry. A concertina
// breathes the chords, a guitar picks the lilt, a music box carries the tune over a soft low bass,
// with the water lapping at the hull and the engine's far-off hum under it all. The sea has its own
// voices: a bell buoy clanking somewhere off in the dark as the swell rocks it, the ship's bell
// telling the half hours, another ship's horn far off as it passes (and the scene sees its lights),
// our own horn, long and low, when the mist comes down. The music decides the night's events and
// tells the scene: dolphins alongside (a glitter of bells), a shower (you hear it come and go), the
// sea lighting up with plankton (a shimmer of voices). Late on it all thins to the concertina,
// the water and the odd bell, and the ferry slips into harbour.
import { bell, padChord, swell, pluck, choir } from './voices.js';
import { squeeze, makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';
import { panned } from './ambient.js';

const STEPS = [0, 2, 4, 5, 7, 9, 10]; // G mixolydian: a sea song's flattened seventh
const PROG = [[0], [3], [0], [4], [5], [3], [0], [4]]; // two bars each
const PHRASES = [ // [degree, eighths], six eighths a bar
  [[4, 3], [5, 1], [4, 2], [2, 3], [0, 3]],
  [[0, 2], [2, 1], [4, 3], [7, 3], [6, 3]],
  [[7, 3], [5, 1], [4, 2], [2, 6]],
  [[4, 2], [2, 1], [0, 3], [-1, 3], [0, 3]],
  [[2, 3], [4, 3], [5, 2], [4, 1], [2, 3], [null, 3]],
  [[9, 3], [7, 3], [5, 2], [4, 1], [2, 6]],
];

/** A ship's horn, far off: a low, slightly rough tone through a resonant hull, rising and fading. */
function horn(A, ch, t, m, dur, vel = 0.03, pan = 0) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan), f = 440 * Math.pow(2, (m - 69) / 12);
  const lp = ac.createBiquadFilter(), bp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = f * 4; bp.type = 'peaking'; bp.frequency.value = f * 2.5; bp.gain.value = 6; bp.Q.value = 1.2;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.6); g.gain.setValueAtTime(vel, t + dur - 0.9); g.gain.linearRampToValueAtTime(0, t + dur);
  lp.connect(bp); bp.connect(g); g.connect(dest);
  for (const [type, mul, det] of [['sawtooth', 1, 0], ['sawtooth', 1, 7], ['square', 0.5, -4]]) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f * mul * 0.985, t); o.frequency.linearRampToValueAtTime(f * mul, t + 0.5); o.detune.value = det;
    const a = ac.createGain(); a.gain.value = 0.33; o.connect(a); a.connect(lp); o.start(t); o.stop(t + dur + 0.1);
  }
}
/** A bell buoy: an iron bell struck by the swell, two or three uneven clanks, inharmonic and far. */
function buoy(A, ch, t, vel, pan) {
  const n = 2 + Math.floor(Math.random() * 2);
  for (let k = 0; k < n; k++) { const tt = t + k * (0.5 + Math.random() * 0.6); bell(A, ch, tt, 79, vel * (1 - k * 0.2), pan, 3); bell(A, ch, tt + 0.003, 85.4, vel * 0.5, pan, 2); bell(A, ch, tt + 0.002, 67, vel * 0.4, pan, 3.5); }
}

export function createFerrySong({ rng }) {
  const key = 55, deg = scaleOf(key, STEPS);
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 3], align: 2, until: 0.3 });
  const next = { ship: 160, dolphins: 90, glow: 330, mist: 250, rain: 420, watch: 30 };
  const rains = [];
  const rainAt = (tm) => { let v = 0; for (const r of rains) if (tm >= r.t0 && tm <= r.t1) v = Math.max(v, Math.min(1, (tm - r.t0) / 10, (r.t1 - tm) / 12)); return v; };
  let bars = 0;
  return makeComposer({
    rng, bpm: [58, 76], meter: 3, swing: 0.12, level: 1.4, verb: 0.9, delay: 0.75,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { lap: 0.014, wind: 0.007, engine: 0.004 }),
    setup(A, ch, from, to) {
      if (!rains.some((r) => r.t1 > from && r.t0 < to)) return null;
      const { ac } = A, s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = A.whiteBuffer; s.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.35;
      g.gain.value = 0; s.connect(bp); bp.connect(g); g.connect(ch.night.input);
      for (let tm = from; tm <= to + 2; tm += 0.5) g.gain.setTargetAtTime(rainAt(tm) * 0.04, Math.max(0, tm - from), 0.4);
      s.start(0); s.stop(to - from + 3);
      return null;
    },
    step(S) {
      const { A, ch, t, tm, e, beatLen, sub, inBar } = S;
      const barLen = beatLen * 3, eighth = beatLen / 2;
      if (sub === 0 && inBar === 0) bars++;
      const [cd] = PROG[Math.floor((bars - 1) / 2) % PROG.length], root = deg(cd);
      // ---- the concertina's chord, breathing in on the bar, out at the half
      if (sub === 0 && inBar === 0 && bars % 2 === 1) {
        squeeze(A, ch.pad, t, [deg(cd) - 12, deg(cd + 2) - 12, deg(cd + 4) - 12], barLen * 2 * 0.95, 0.007 + 0.005 * e, -0.15);
        padChord(A, ch.pad, t, [root - 24], barLen * 2, { vol: 0.004, attack: 1.5, release: 3, cutoff: 300, type: 'triangle', voices: 1 });
      }
      // ---- the lilt: a low note on one and four, the guitar picking up and down in between
      const e8 = inBar * 2 + sub; // which of the six eighths
      if (e8 === 0) bell(A, ch.bass, t, root - 12, 0.014 + 0.006 * e, 0, 2.2);
      if (e8 === 3 && e > 0.3) bell(A, ch.bass, t, deg(cd + 4) - 24, 0.008 + 0.004 * e, 0, 1.8);
      if (e > 0.32) pluck(A, ch.arp, t + (e8 % 3 ? 0.01 : 0), deg(cd + [0, 2, 4, 7, 4, 2][e8]), 0.006 + 0.006 * e, 0.25, { bright: 1500 + 900 * e, decay: 0.5 });
      // ---- the tune, on a music box
      tune.step(S, (d) => bell(A, ch.lead, t, deg(d) + 12, 0.012 + 0.007 * e, (rng() - 0.5) * 0.4, 2.6));
      // ---- the sea's own sounds
      S.every('buoy', 26 + 14 * (1 - e), () => buoy(A, ch.far, t, 0.006, rng() < 0.5 ? -0.7 : 0.6));
      if (tm >= next.watch && sub === 0 && inBar === 0) { // the ship's bell: two strikes, a pause, two more
        for (const [dt, v] of [[0, 1], [0.55, 0.9], [1.6, 1], [2.15, 0.9]]) { bell(A, ch.far, t + dt, 88, 0.01 * v, 0.2, 4); bell(A, ch.far, t + dt + 0.002, 95.2, 0.004 * v, 0.2, 3); }
        next.watch = tm + 180 + rng() * 60;
      }
      // ---- the night's events: the music chooses, and tells the scene
      if (e > 0.32) {
        if (tm >= next.ship) { // another ship, passing: its lights, and a while later its horn
          A.emit('ship', tm, {});
          horn(A, ch.far, t + 18, 38, 4.5, 0.012, -0.6); horn(A, ch.far, t + 25, 38, 3.5, 0.01, -0.6);
          next.ship = tm + 330 + rng() * 150;
        }
        if (tm >= next.dolphins) {
          A.emit('dolphins', tm, {});
          for (let k = 0; k < 8; k++) bell(A, ch.far, t + 1 + k * eighth * 0.75, deg(7 + [0, 2, 4, 7, 9, 7, 4, 2][k]) + 12, 0.004, 0.5, 2.5);
          next.dolphins = tm + 220 + rng() * 140;
        }
        if (tm >= next.mist) { // the mist comes down; our own horn, long and low
          A.emit('mist', tm, {});
          horn(A, ch.far, t + 6, 33, 5.5, 0.016, 0.3);
          next.mist = tm + 360 + rng() * 200;
        }
        if (tm >= next.rain) { // a shower, decided a little ahead so its sound can be laid down
          const t0 = tm + 22, dur = 55 + rng() * 40;
          rains.push({ t0, t1: t0 + dur, told: false });
          next.rain = t0 + dur + 400 + rng() * 300;
        }
      }
      for (const r of rains) if (!r.told && tm >= r.t0) { r.told = true; A.emit('rain', tm, { dur: r.t1 - tm }); }
      if (tm >= next.glow) { // the sea lights up: a shimmer of voices
        A.emit('glow', tm, {});
        choir(A, ch.far, t, [deg(7) + 12, deg(9) + 12, deg(11) + 12], 30, { vol: 0.005, attack: 10, release: 15, bright: 1.2 });
        swell(A, ch.night, t, { dur: 40, vel: 0.004, freq: 5000, freq2: 2500, q: 1.5 });
        next.glow = tm + 420 + rng() * 240;
      }
    },
  });
}
