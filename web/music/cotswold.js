// Cotswold Valley: English pastoral for an evening walk. Modal strings in the manner of a folk-song
// setting, a wooden flute wandering through a new tune each time, a harp-like ripple early on,
// blackbirds and a song thrush in the hedges, the stream at the valley bottom, a church bell far
// off across the valley, and, once it's dark, a tawny owl.
import { channel, padChord, pluck, bell, pick, mtof } from './voices.js';
import { flute, bird, owl } from './nature.js';

const CHORDS = {
  i: [0, 7, 10, 15],      // Dorian minor
  IV: [5, 9, 12, 17],     // the bright Dorian IV
  bVII: [-2, 5, 10, 14],
  III: [3, 7, 10, 15],
  v: [7, 10, 14, 19],
};
const PROGRESSIONS = [['i', 'IV', 'i', 'bVII'], ['i', 'bVII', 'III', 'IV'], ['IV', 'i', 'bVII', 'i'], ['i', 'III', 'IV', 'v']];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const BEATS_PER_CHORD = 6; // two bars of 3/4

export function createCotswold({ rng }) {
  const root = pick(rng, [50, 52, 55, 57]); // D, E, G or A Dorian
  const prog = pick(rng, PROGRESSIONS);
  let next = 0, step = 0, tune = [], lastNote = null, nextBird = 2, nextBell = 30 + rng() * 40, nextOwl = 20;
  const bpm = (e) => 52 + 10 * e;

  function newTune() {
    const notes = [];
    let deg = 7 + Math.floor(rng() * 3), pos = 0;
    while (pos < 10) {
      const len = pos >= 8 ? 12 - pos : pick(rng, [2, 2, 3, 1, 4]);
      notes.push({ at: pos, len, deg });
      pos += len;
      deg = Math.max(3, Math.min(12, deg + pick(rng, [-1, -1, 1, 1, -2, 2, -3])));
    }
    return notes;
  }
  const degMidi = (d) => root + Math.floor(d / 7) * 12 + DORIAN[((d % 7) + 7) % 7];

  return {
    level: 1.55,
    delayTime: (60 / bpm(1)) * 0.75,

    live(ac, dest, t0) {
      // the stream: soft babbling noise, its level wandering, under a low drone
      const n = ac.sampleRate * 4, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
      const g = ac.createGain(); g.gain.value = 0;
      const lfo = ac.createOscillator(), la = ac.createGain(); lfo.frequency.value = 0.13; la.gain.value = 0.006; lfo.connect(la); la.connect(g.gain);
      const fl = ac.createOscillator(), fa = ac.createGain(); fl.frequency.value = 0.31; fa.gain.value = 350; fl.connect(fa); fa.connect(bp.frequency);
      src.connect(bp); bp.connect(g); g.connect(dest);
      const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = mtof(root - 24); og.gain.value = 0.03; o.connect(og); og.connect(dest);
      for (const s of [src, lfo, fl, o]) s.start(t0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.022, t0 + 8);
      return { stop(t) { for (const s of [src, lfo, fl, o]) { try { s.stop(t + 0.05); } catch { /* fine */ } } } };
    },

    chunk(A, from, to, energyAt) {
      const strCh = channel(A, { gain: 1, verb: 0.6 });
      const harpCh = channel(A, { gain: 1, verb: 0.45, delay: 0.2 });
      const fluteCh = channel(A, { gain: 1, verb: 0.55, delay: 0.2 });
      const birdCh = channel(A, { gain: 1, verb: 0.5 });
      const farCh = channel(A, { gain: 0.8, verb: 1.1 });
      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
        const beatLen = 60 / bpm(e), eighth = beatLen / 2;
        const beat = Math.floor(step / 2), sub = step % 2;
        const chordIdx = Math.floor(beat / BEATS_PER_CHORD) % prog.length;
        const chord = CHORDS[prog[chordIdx]].map((o) => root + o);
        const inChord = beat % BEATS_PER_CHORD;
        const bar = Math.floor(beat / 3);

        if (step % (2 * BEATS_PER_CHORD) === 0) {
          padChord(A, strCh, t, chord, BEATS_PER_CHORD * beatLen, { type: 'sawtooth', voices: 2, spread: 7, attack: 2.5, release: 4, vol: 0.02, cutoff: 650 + 900 * e, q: 0.3 });
          padChord(A, strCh, t, [chord[0] - 12, chord[1] - 12], BEATS_PER_CHORD * beatLen, { type: 'triangle', voices: 2, spread: 5, attack: 3, release: 4, vol: 0.02, cutoff: 900 });
          A.emit('chord', tm, { index: chordIdx });
        }
        // a harp-like ripple up the chord at the start of each chord, early in the evening
        if (e > 0.45 && inChord === 0 && sub === 0) {
          chord.concat(chord[0] + 12).forEach((m, k) => pluck(A, harpCh, t + k * eighth * 0.5, m + 12, 0.03 * e, (k - 2) * 0.2, { bright: 2200, decay: 0.9 }));
        }

        // the flute wanders through a new tune every eight bars
        if (bar % 8 === 0 && step % 6 === 0) tune = newTune();
        if (e > 0.3 && bar % 8 >= 2 && bar % 8 < 4) {
          const pos = (bar % 8 - 2) * 6 + (step % 6);
          for (const n of tune) if (n.at === pos) {
            const m = degMidi(n.deg);
            flute(A, fluteCh, t, m, n.len * eighth * 0.95, 0.035 + 0.02 * e, -0.2, lastNote);
            lastNote = m;
          }
        } else lastNote = null;

        // blackbirds and a thrush in the hedgerows, quieter as dusk falls
        if (tm >= nextBird) {
          if (e > 0.3) bird(A, birdCh, t, rng, { vel: 0.012 + 0.014 * e, pan: (rng() - 0.5) * 1.6, base: 1500 + rng() * 1600 });
          A.emit('bird', tm, {});
          nextBird = tm + 4 + rng() * 9 / Math.max(0.3, e);
        }
        // the church bell across the valley
        if (tm >= nextBell) {
          for (let k = 0; k < 3; k++) bell(A, farCh, t + k * 2.2, root - 5 + (k === 1 ? 0 : 0), 0.03, -0.4, 6);
          A.emit('bell', tm, {});
          nextBell = tm + 120 + rng() * 120;
        }
        // a tawny owl once it's dark
        if (tm >= nextOwl) {
          if (e < 0.55) { owl(A, farCh, t, { vel: 0.035, pan: (rng() - 0.5) * 1.4 }); A.emit('owl', tm, {}); }
          nextOwl = tm + 40 + rng() * 50;
        }
        step++;
        next += eighth;
      }
    },
  };
}
