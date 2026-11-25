// 8-Bit Night Walk's music: a chiptune lullaby, softened for bedtime. A triangle-wave tune over
// slow pulse-wave arpeggios, a triangle bass, the faintest noise ticks; little 8-bit crickets, a
// sparkle as a shooting star goes over, and (once the walker has made camp) the fire crackling.
// The beat sets the walker's pace. Our own tune.
import { noiseHit, mtof } from './voices.js';
import { panned, crackle } from './ambient.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

const waves = new WeakMap();
/** A pulse wave of the given duty cycle (a narrow pulse sounds thin and soft, like old consoles). */
function pulseWave(ac, duty) {
  let m = waves.get(ac); if (!m) waves.set(ac, (m = {}));
  if (!m[duty]) {
    const n = 24, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    m[duty] = ac.createPeriodicWave(re, im);
  }
  return m[duty];
}
/** One chip note: pulse or triangle, a quick attack, a short decay to a held level, a soft release. */
export function chip(A, ch, t, m, dur, vel = 0.03, { duty = 0.25, tri = false, pan = 0, cut = 2600, vib = 0 } = {}) {
  t = Math.max(0, t);
  const { ac } = A, o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
  if (tri) o.type = 'triangle'; else o.setPeriodicWave(pulseWave(ac, duty));
  o.frequency.value = mtof(m);
  if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(vib, t + Math.min(0.4, dur)); l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + 0.2); }
  lp.type = 'lowpass'; lp.frequency.value = cut;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.12);
  g.gain.setValueAtTime(vel * 0.6, t + Math.max(0.12, dur)); g.gain.linearRampToValueAtTime(0, t + Math.max(0.12, dur) + 0.14);
  o.connect(lp); lp.connect(g); g.connect(panned(A, ch, pan)); o.start(t); o.stop(t + Math.max(0.12, dur) + 0.2);
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRASES = [
  [[4, 2], [2, 2], [0, 2], [2, 2], [4, 4], [4, 4]],
  [[5, 2], [4, 2], [2, 2], [4, 2], [2, 4], [0, 4]],
  [[0, 2], [2, 2], [4, 2], [7, 2], [6, 4], [4, 4]],
  [[7, 3], [6, 1], [4, 2], [2, 2], [4, 8]],
  [[2, 2], [4, 2], [5, 2], [4, 2], [2, 2], [1, 2], [0, 4]],
  [[4, 1], [5, 1], [7, 2], [9, 4], [7, 2], [4, 2], [5, 4]],
];
// a bar each: C Am F G | C Em F G (bass, chord, in semitones above C)
const PROG = [[0, [0, 4, 7]], [-3, [-3, 0, 4]], [5, [5, 9, 12]], [7, [7, 11, 14]], [0, [0, 4, 7]], [4, [4, 7, 11]], [5, [5, 9, 12]], [7, [7, 11, 14]]];

export function createChipSong({ rng }) {
  const root = 60, deg = scaleOf(root, MAJOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 4, rest: [1, 2], align: 2 });
  return makeComposer({
    rng, bpm: [50, 74], meter: 4, swing: 0.12, level: 1.5, verb: 0.55, delay: 0.75,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { wind: 0.004 }),
    step(S) {
      const { A, ch, t, ts, e, beatLen, sub, inBar, bar } = S;
      const ci = bar % PROG.length, [br, chord] = PROG[ci], notes = chord.map((x) => root + x);
      if (sub === 0) A.emit('step', S.tm, { beat: beatLen }); // the walker's pace
      if (sub === 0 && inBar === 0) A.emit('chord', S.tm, { index: ci });
      // triangle bass: root on one, fifth on three
      if (sub === 0 && (inBar === 0 || inBar === 2)) chip(A, ch.bass, t, root - 24 + br + (inBar === 2 ? 7 : 0), beatLen * 1.6, 0.032 * (0.6 + 0.4 * e), { tri: true, cut: 1200 });
      // a slow pulse arpeggio, up and down the chord (it thins out as the night goes on)
      if (e > 0.3) {
        const order = [0, 1, 2, 1], m = notes[order[(inBar * 2 + sub) % 4]] + 12;
        if (sub === 0 || e > 0.6) chip(A, ch.arp, ts, m, S.eighth * 0.8, 0.012 * e, { duty: 0.125, pan: ((inBar * 2 + sub) % 2 ? 0.35 : -0.35), cut: 2200 });
      }
      // the faintest tick on the off-beats, and a soft thump on one, while the walk goes on
      if (e > 0.55) { if (sub === 1) noiseHit(A, ch.perc, ts, { vel: 0.0035 * e, type: 'highpass', freq: 6500, decay: 0.03 }); if (sub === 0 && inBar === 0) chip(A, ch.perc, t, 36, 0.08, 0.012 * e, { tri: true, cut: 400 }); }
      // the tune on a triangle (soft as a flute), echoed an octave up on a thin pulse
      tune.step(S, (d, len) => {
        chip(A, ch.lead, ts, deg(d) + 12, len * S.eighth * 0.9, 0.038 + 0.015 * e, { tri: true, vib: 9, cut: 3000 });
        if (e > 0.5) chip(A, ch.far, ts + S.eighth * 2, deg(d) + 24, len * S.eighth * 0.6, 0.006, { duty: 0.125, pan: 0.4, cut: 3000 });
        A.emit('note', S.tm, {});
      });
      // 8-bit crickets, a shooting star now and then, the campfire once the walker has stopped
      S.every('cricket', 5, () => { for (let k = 0; k < 3; k++) chip(A, ch.night, t + k * 0.07, 100 + (k % 2), 0.03, 0.0035, { duty: 0.125, pan: 0.6 * (rng() - 0.5), cut: 6000 }); });
      S.every('star', 48, () => { if (e > 0.35) { [0, 4, 7, 12, 16, 19].forEach((x, k) => chip(A, ch.far, t + k * 0.06, root + 24 + x, 0.12, 0.009, { duty: 0.125, pan: -0.3 + k * 0.1, cut: 5000 })); A.emit('star', S.tm, {}); } });
      if (e < 0.55) S.every('crackle', 3, () => crackle(A, ch.night, t, { vel: 0.008, pan: 0.15 }));
    },
  });
}
