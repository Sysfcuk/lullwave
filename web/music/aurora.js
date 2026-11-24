// Aurora: a hushed choir over a held drone, glassy chimes falling like snow, and wind across
// the tundra. Major and Lydian colours, very slow; the chimes thin out through the night.
import { channel, choir, padChord, bell, swell, pick, mtof } from './voices.js';

const CHORDS = {
  I: [0, 4, 7, 11, 14],
  II: [2, 6, 9, 14],      // Lydian II
  vi: [-3, 0, 4, 7, 11],
  IV: [5, 9, 12, 16],
  V: [-5, 2, 7, 9],       // sus
};
const PROGRESSIONS = [['I', 'II', 'vi', 'IV'], ['I', 'vi', 'II', 'V'], ['IV', 'I', 'II', 'I'], ['vi', 'IV', 'I', 'V']];
const PENTA = [0, 2, 4, 7, 9];
const BEATS_PER_CHORD = 8;

export function createAurora({ rng }) {
  const root = pick(rng, [52, 50, 55, 53]);
  const prog = pick(rng, PROGRESSIONS);
  let next = 0, step = 0, nextWind = 6;
  const bpm = (e) => 50 + 8 * e;

  return {
    level: 1.8, // trim so every world plays at about the same loudness
    delayTime: (60 / bpm(1)) * 0.75,

    live(ac, dest, t0) {
      const g = ac.createGain(); g.gain.value = 0; g.connect(dest);
      const oscs = [];
      for (const [m, amp] of [[root - 24, 0.05], [root - 17, 0.018], [root - 12, 0.012]]) {
        const o = ac.createOscillator(), a = ac.createGain();
        o.frequency.value = mtof(m); a.gain.value = amp; o.connect(a); a.connect(g); oscs.push(o);
      }
      for (const o of oscs) o.start(t0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.8, t0 + 12);
      return { stop(t) { for (const o of oscs) { try { o.stop(t + 0.05); } catch { /* fine */ } } } };
    },

    chunk(A, from, to, energyAt) {
      const choirCh = channel(A, { gain: 1, verb: 0.75 });
      const padCh = channel(A, { gain: 1, verb: 0.5 });
      const chimeCh = channel(A, { gain: 1, verb: 0.8, delay: 0.45 });
      const windCh = channel(A, { gain: 1, verb: 0.3 });
      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
        const beat = step / 4, beatLen = 60 / bpm(e);
        const chordIdx = Math.floor(beat / BEATS_PER_CHORD) % prog.length;
        if (step % (4 * BEATS_PER_CHORD) === 0) {
          const notes = CHORDS[prog[chordIdx]].map((o) => root + o);
          choir(A, choirCh, t, notes.slice(0, e > 0.4 ? 5 : 3), BEATS_PER_CHORD * beatLen, { vol: 0.03, attack: 4, release: 6, bright: 0.5 + 0.5 * e });
          padChord(A, padCh, t, [root - 12 + CHORDS[prog[chordIdx]][0], ...notes.slice(1, 3).map((m) => m + 12)], BEATS_PER_CHORD * beatLen, { type: 'sine', voices: 2, spread: 5, attack: 5, release: 6, vol: 0.018, cutoff: 3000 });
          A.emit('chord', tm, { index: chordIdx });
        }
        // chimes drifting down like snowflakes
        if (step % 2 === 0 && rng() < 0.05 + 0.13 * e) {
          const m = root + 24 + PENTA[Math.floor(rng() * 5)] + (rng() < 0.3 ? 12 : 0);
          const pan = (rng() - 0.5) * 1.6;
          bell(A, chimeCh, t + (rng() - 0.5) * 0.03, m, 0.02 + 0.025 * e, pan, 4 + rng() * 3);
          A.emit('chime', tm, { midi: m, pan });
        }
        // a slow high line in the choir now and then
        if (step % (4 * BEATS_PER_CHORD) === 16 && rng() < 0.4 * e) {
          const m = root + 12 + PENTA[Math.floor(rng() * 5)];
          choir(A, choirCh, t, [m + 12], 4 * beatLen, { vol: 0.016, attack: 2, release: 4, bright: 0.7 });
        }
        if (tm >= nextWind) {
          const side = (rng() - 0.5) * 1.6;
          swell(A, windCh, t, { dur: 10 + rng() * 8, vel: 0.045, freq: 500 + rng() * 500, freq2: 900 + rng() * 600, q: 2.2, pan: side, pan2: -side });
          A.emit('wind', tm, { side });
          nextWind = tm + 16 + rng() * 22;
        }
        step++;
        next += beatLen / 4;
      }
    },
  };
}
