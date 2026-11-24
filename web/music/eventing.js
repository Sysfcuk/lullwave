// Cross Country: pastoral folk in a lilting 6/8, to ride to at sunset. Plucked guitar-like
// arpeggios rocking through each bar, warm strings, a flute singing a new tune now and then, and
// soft hoofbeats on turf in a canter rhythm (three beats, then the moment of suspension). As the
// night goes on the canter becomes a walk, then stops; the evening birds fall quiet; strings remain.
import { channel, padChord, pluck, swell, pick, mtof } from './voices.js';
import { flute, bird, hoof } from './nature.js';

const CHORDS = {
  I: [0, 4, 7, 12],
  IV: [5, 9, 12, 17],
  vi: [-3, 0, 4, 9],
  V: [-5, 2, 7, 11],
  bVII: [-2, 2, 5, 10], // the Mixolydian colour of folk tunes
  ii: [2, 5, 9, 14],
};
const ROOTS = { I: 0, IV: 5, vi: -3, V: -5, bVII: -2, ii: 2 };
const PROGRESSIONS = [['I', 'IV', 'I', 'V'], ['I', 'bVII', 'IV', 'I'], ['vi', 'IV', 'I', 'V'], ['I', 'vi', 'ii', 'V']];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const EIGHTHS = 6; // 6/8: one bar is one stride of the canter

export function createEventing({ rng }) {
  const root = pick(rng, [55, 50, 57, 52]); // G, D, A or E
  const prog = pick(rng, PROGRESSIONS);
  let next = 0, step = 0, tune = [], lastNote = null, nextBird = 3;
  const bpm = (e) => 44 + 16 * e; // dotted-quarter beats per minute; two per bar

  function newTune() {
    // a folk phrase of two bars on the major scale, stepwise with the odd leap, ending long
    const notes = [];
    let deg = 4 + Math.floor(rng() * 3), pos = 0;
    while (pos < 10) {
      const len = pos >= 8 ? 12 - pos : pick(rng, [1, 2, 2, 3]);
      notes.push({ at: pos, len, deg });
      pos += len;
      deg = Math.max(2, Math.min(11, deg + pick(rng, [-1, -1, 1, 1, -2, 2, 0])));
    }
    return notes;
  }
  const degMidi = (d) => root + Math.floor(d / 7) * 12 + MAJOR[((d % 7) + 7) % 7];

  return {
    level: 1.75,
    delayTime: (60 / bpm(1)) / 3 * 2,

    live(ac, dest, t0) {
      const g = ac.createGain(); g.gain.value = 0; g.connect(dest);
      const o = ac.createOscillator(); o.frequency.value = mtof(root - 24);
      const a = ac.createGain(); a.gain.value = 0.04; o.connect(a); a.connect(g); o.start(t0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.8, t0 + 10);
      return { stop(t) { try { o.stop(t + 0.05); } catch { /* fine */ } } };
    },

    chunk(A, from, to, energyAt) {
      const strCh = channel(A, { gain: 1, verb: 0.5 });
      const gtrCh = channel(A, { gain: 1, verb: 0.25, delay: 0.1 });
      const fluteCh = channel(A, { gain: 1, verb: 0.5, delay: 0.25 });
      const hoofCh = channel(A, { gain: 1, verb: 0.08 });
      const birdCh = channel(A, { gain: 1, verb: 0.45 });
      const windCh = channel(A, { gain: 1, verb: 0.3 });
      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
        const eighth = 60 / bpm(e) / 3;
        const bar = Math.floor(step / EIGHTHS), sub = step % EIGHTHS;
        const name = prog[Math.floor(bar / 2) % prog.length];
        const chord = CHORDS[name].map((o) => root + o);

        if (sub === 0 && bar % 2 === 0) {
          padChord(A, strCh, t, chord.map((m) => m - 12).concat(chord[1]), eighth * 12, { type: 'sawtooth', voices: 2, spread: 8, attack: 1.5, release: 3, vol: 0.016 + 0.01 * (1 - e), cutoff: 800 + 900 * e, q: 0.4 });
          A.emit('chord', tm, { name });
        }
        if (sub === 0) A.emit('stride', tm, { dur: eighth * EIGHTHS, gait: e > 0.55 ? 'canter' : e > 0.3 ? 'walk' : 'still' });

        // plucked arpeggio rocking through the bar: root, fifth, third, octave, third, fifth
        if (e > 0.25) {
          const pattern = [0, 2, 1, 3, 1, 2];
          const m = (sub === 0 ? root - 12 + ROOTS[name] : chord[pattern[sub]]) + (sub === 0 ? 0 : 0);
          pluck(A, gtrCh, t, m, (sub === 0 ? 0.06 : 0.035) * (0.6 + 0.4 * e), sub % 2 ? 0.25 : -0.25, { bright: 1300 + 1300 * e, decay: 0.55 });
        }

        // hoofbeats: a canter's three beats then a rest; later an even, slower walk; then stillness
        if (e > 0.55) {
          if (sub === 0 || sub === 1 || sub === 2) hoof(A, hoofCh, t + (sub === 1 ? 0.02 : 0), (sub === 2 ? 0.09 : 0.07) * (e - 0.4), sub === 1 ? -0.15 : 0.1);
        } else if (e > 0.3 && sub % 3 === 0) {
          hoof(A, hoofCh, t, 0.045 * e, sub === 0 ? -0.1 : 0.1);
        }

        // the flute: a different two-bar tune every eight bars, early in the night
        if (bar % 8 === 0 && sub === 0) tune = newTune();
        if (e > 0.4 && bar % 8 >= 4 && bar % 8 < 6) {
          const pos = (bar % 8 - 4) * 6 + sub;
          for (const n of tune) if (n.at === pos) {
            const m = degMidi(n.deg) + 12;
            flute(A, fluteCh, t, m, n.len * eighth * 0.95, 0.04 + 0.015 * e, 0.15, lastNote);
            lastNote = m;
          }
        } else lastNote = null;

        // evening birds, fewer as it gets dark; a breeze over the fields
        if (tm >= nextBird) {
          if (e > 0.35) bird(A, birdCh, t, rng, { vel: 0.012 + 0.012 * e, pan: (rng() - 0.5) * 1.6, base: 1800 + rng() * 1400 });
          if (rng() < 0.3) swell(A, windCh, t, { dur: 8 + rng() * 6, vel: 0.03, freq: 400 + rng() * 300, freq2: 700, q: 1.5, pan: -0.5, pan2: 0.5 });
          nextBird = tm + 6 + rng() * 12;
        }
        step++;
        next += eighth;
      }
    },
  };
}
