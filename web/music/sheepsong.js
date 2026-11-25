// Counting Sheep's music: a music-box lullaby in three-four that slowly winds down through the
// night (the tempo falls with the energy, like a box running down), over soft strings. It also
// keeps the jumps: every four bars it breathes in (a soft rising swell, and the scene's next sheep
// starts its run-up), and two bars later breathes out (a falling swell) as the sheep sails over
// the moon, with a bell that climbs the scale with the count. Now and then a sheep bleats, the
// ram huffs, and the box is wound again. Our own tune.
import { bell, padChord, noiseHit, swell, mtof } from './voices.js';
import { panned, snort } from './ambient.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

/** A music box: a steel tine's ping (a pure tone with its high, quickly-gone partials) and the pin's click. */
export function musicBox(A, ch, t, m, vel = 0.03, pan = 0, decay = 1.8) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan), f = mtof(m);
  for (const [mul, amp, d] of [[1, 1, decay], [2, 0.08, decay * 0.3], [6.27, 0.05, 0.12]]) {
    if (f * mul > ac.sampleRate * 0.45) continue;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f * mul;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * amp, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, d / 4);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + d * 1.3);
  }
  noiseHit(A, ch, t, { vel: vel * 0.12, type: 'highpass', freq: 6000, decay: 0.008, pan });
}
/** A sheep's bleat, far off across the grass: a buzzy voice through an "aa", with its quaver. */
export function baa(A, ch, t, vel = 0.012, pan = 0, f0 = 230) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan), dur = 0.7;
  const env = ac.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vel, t + 0.06); env.gain.setValueAtTime(vel, t + dur * 0.6); env.gain.linearRampToValueAtTime(0, t + dur);
  const trem = ac.createOscillator(), tg = ac.createGain(); trem.frequency.value = 11; tg.gain.value = vel * 0.45; trem.connect(tg); tg.connect(env.gain);
  const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), soft = ac.createBiquadFilter(); f1.type = f2.type = 'bandpass'; f1.frequency.value = 760; f1.Q.value = 4; f2.frequency.value = 1180; f2.Q.value = 5;
  soft.type = 'lowpass'; soft.frequency.value = 1500; f1.connect(env); f2.connect(env); env.connect(soft); soft.connect(dest);
  for (const det of [-7, 7]) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.04, t + 0.15); o.frequency.linearRampToValueAtTime(f0 * 0.88, t + dur);
    o.connect(f1); o.connect(f2); o.start(t); o.stop(t + dur + 0.05);
  }
  trem.start(t); trem.stop(t + dur + 0.05);
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// phrases in eighths, two or four bars of three-four
const PHRASES = [
  [[4, 2], [3, 1], [2, 1], [1, 2], [2, 2], [4, 4]],
  [[2, 2], [4, 2], [7, 4], [6, 2], [4, 2]],
  [[4, 3], [5, 1], [4, 2], [2, 6]],
  [[7, 2], [6, 2], [4, 2], [5, 2], [4, 2], [2, 2], [0, 6], [null, 6]],
  [[0, 2], [2, 2], [4, 2], [4, 3], [2, 1], [3, 2], [2, 4], [1, 2], [0, 6]],
];
// a bar each: I vi IV V | I iii ii V, as [bass, chord] in semitones above the key note
const PROG = [[0, [0, 4, 7]], [-3, [9, 12, 16]], [5, [5, 9, 12]], [7, [7, 11, 14]], [0, [0, 4, 7]], [4, [4, 7, 11]], [2, [2, 5, 9]], [7, [7, 11, 14]]];

export function createSheepSong({ rng }) {
  const root = 63, deg = scaleOf(root, MAJOR); // E flat
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 2], align: 2 });
  let leapBar = -1, jumps = 0;
  return makeComposer({
    rng, bpm: [40, 66], meter: 3, swing: 0, level: 1.05, verb: 0.7, delay: 1,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { wind: 0.007 }, { droneMidi: root - 24, drone: 0.01 }),
    step(S) {
      const { A, ch, t, e, beatLen, sub, inBar, bar } = S;
      const ci = bar % PROG.length, [br, chord] = PROG[ci], notes = chord.map((x) => root + x);
      if (sub === 0 && inBar === 0) {
        A.emit('chord', S.tm, { index: ci });
        if (bar % 2 === 0) padChord(A, ch.pad, t, notes.map((m) => m - 12), beatLen * 6, { vol: 0.011 + 0.007 * e, attack: 1.6, release: 3, cutoff: 900, spread: 7 });
        // the breath: in, as the next sheep starts its run-up...
        if (bar % 4 === 0 && e > 0.36 && rng() < (e > 0.6 ? 0.75 : 0.6)) {
          A.emit('cue', S.tm, { apexIn: beatLen * 6 });
          swell(A, ch.far, t, { dur: beatLen * 6, vel: 0.016, freq: 300, freq2: 900, q: 0.8, pan: -0.2, pan2: 0.1 });
          leapBar = bar + 2;
        }
        // ...and out, as it sails over the moon: a bell that climbs with the count
        if (bar === leapBar) {
          A.emit('leap', S.tm, {});
          bell(A, ch.lead, t, deg(jumps % 8) + 12, 0.035, 0.15, 5);
          swell(A, ch.far, t, { dur: beatLen * 9, vel: 0.014, freq: 900, freq2: 260, q: 0.8, pan: 0.1, pan2: 0.35 });
          jumps++;
        }
      }
      // the box's comb: a low tine on one, the chord on two and three (and a lilt between, while it's wound tight)
      if (sub === 0) {
        if (inBar === 0) musicBox(A, ch.bass, t, root - 12 + br, 0.03 + 0.012 * e, -0.15, 2.4);
        else musicBox(A, ch.arp, t, notes[inBar] + 12, 0.011 + 0.007 * e, inBar === 1 ? -0.3 : 0.3, 1.2);
      } else if (e > 0.6 && inBar === 2 && rng() < 0.5) musicBox(A, ch.arp, t, notes[0] + 24, 0.007, 0.4, 0.9);
      // the tune
      tune.step(S, (d, len) => { musicBox(A, ch.lead, t, deg(d) + 12, 0.04 + 0.016 * e, (rng() - 0.5) * 0.3, 1.2 + len * 0.25); A.emit('note', S.tm, {}); });
      // the meadow: a bleat now and then, the ram's opinion, the box wound again
      S.every('baa', 38, () => { baa(A, ch.night, t, 0.007 + 0.003 * e, (rng() - 0.5) * 1.2, 200 + rng() * 70); A.emit('baa', S.tm, {}); });
      S.every('huff', 75, () => { if (e > 0.42) { snort(A, ch.night, t, { vel: 0.02, pan: -0.25 }); A.emit('huff', S.tm, {}); } });
      S.every('wind', 240, () => { if (e > 0.5) for (let k = 0; k < 7; k++) noiseHit(A, ch.night, t + k * 0.09, { vel: 0.0045, type: 'bandpass', freq: 3200, q: 3, decay: 0.02, pan: 0.45 }); });
    },
  });
}
