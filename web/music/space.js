// Stardust: deep-space ambient. Slowly evolving pads whose filters breathe, a slow arpeggio of
// soft plucks echoing away, a sub drone, distant radio-like sweeps, and the odd bright bell.
import { channel, padChord, pluck, bell, swell, pick, mtof } from './voices.js';

const CHORDS = {
  I: [0, 7, 14, 16],
  bVII: [-2, 5, 12, 14],
  IV: [5, 9, 12, 16],
  v: [7, 10, 14, 17],
  II: [2, 6, 9, 14],
};
const PROGRESSIONS = [['I', 'bVII', 'IV', 'I'], ['I', 'II', 'IV', 'bVII'], ['I', 'v', 'bVII', 'IV']];
const BEATS_PER_CHORD = 8;

export function createSpace({ rng, mobile }) {
  const root = pick(rng, [48, 50, 45, 52]);
  const prog = pick(rng, PROGRESSIONS);
  let next = 0, step = 0, nextSweep = 20 + rng() * 20;
  const bpm = (e) => 56 + 10 * e;

  return {
    level: 1.5, // trim so every world plays at about the same loudness
    delayTime: (60 / bpm(1)) * 0.75,

    live(ac, dest, t0) {
      const g = ac.createGain(); g.gain.value = 0; g.connect(dest);
      const oscs = [];
      for (const [hz, amp] of [[mtof(root - 24), 0.05], [mtof(root - 24) * 1.5 + 0.15, 0.014], [mtof(root - 12) + 0.11, 0.01]]) {
        const o = ac.createOscillator(), a = ac.createGain();
        o.frequency.value = hz; a.gain.value = amp; o.connect(a); a.connect(g); oscs.push(o);
      }
      for (const o of oscs) o.start(t0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.8, t0 + 12);
      return { stop(t) { for (const o of oscs) { try { o.stop(t + 0.05); } catch { /* fine */ } } } };
    },

    chunk(A, from, to, energyAt) {
      const { ac } = A;
      const padCh = channel(A, { gain: 1, verb: 0.7, delay: 0.1 });
      const arpCh = channel(A, { gain: 1, verb: 0.5, delay: 0.6 });
      const bellCh = channel(A, { gain: 1, verb: 0.9, delay: 0.4 });
      const fxCh = channel(A, { gain: 1, verb: 0.8 });
      // one slow LFO per chunk breathes the pad filters open and closed
      const lfo = ac.createOscillator(), amt = ac.createGain();
      lfo.frequency.value = 0.045; amt.gain.value = 420; lfo.connect(amt); lfo.start(0);
      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
        const beatLen = 60 / bpm(e), s16 = beatLen / 4;
        const beat = Math.floor(step / 4), sub = step % 4;
        const chordIdx = Math.floor(beat / BEATS_PER_CHORD) % prog.length;
        const chord = CHORDS[prog[chordIdx]];
        const inChord = beat % BEATS_PER_CHORD;
        const bar = Math.floor(beat / 4);

        if (step % (4 * BEATS_PER_CHORD) === 0) {
          const f = padChord(A, padCh, t, chord.map((o) => root + o), BEATS_PER_CHORD * beatLen, { type: 'sawtooth', voices: mobile ? 2 : 3, spread: 14, attack: 4, release: 6, vol: 0.022, cutoff: 650 + 700 * e, q: 2.5 });
          amt.connect(f.frequency);
          padChord(A, padCh, t, chord.slice(1).map((o) => root + 12 + o), BEATS_PER_CHORD * beatLen, { type: 'sine', voices: 2, spread: 6, attack: 6, release: 6, vol: 0.012, cutoff: 5000 });
          A.emit('chord', tm, { index: chordIdx });
        }

        // the arpeggio: up through the chord in sixteenths, every other bar
        if (e > 0.3 && bar % 2 === 0) {
          const tones = chord.map((o) => root + 12 + o).concat(chord.map((o) => root + 24 + o));
          const k = step % tones.length;
          if (rng() < 0.85) pluck(A, arpCh, t, tones[k], 0.022 + 0.03 * (e - 0.3), k % 2 ? 0.5 : -0.5, { bright: 1200 + 1600 * e, decay: 0.45 });
          if (k === 0) A.emit('star', tm, {});
        }

        // a bright bell, rarely
        if (sub === 0 && inChord === 4 && rng() < 0.3) {
          const m = root + 24 + chord[Math.floor(rng() * chord.length)];
          bell(A, bellCh, t, m, 0.03, (rng() - 0.5) * 1.4, 7);
          A.emit('bell', tm, { midi: m });
        }

        // a sweep like a distant radio signal
        if (tm >= nextSweep) {
          swell(A, fxCh, t, { dur: 8 + rng() * 5, vel: 0.025, freq: 2400, freq2: 350, q: 7, pan: -0.7, pan2: 0.7 });
          A.emit('comet', tm, {});
          nextSweep = tm + 40 + rng() * 40;
        }
        step++;
        next += s16;
      }
    },
  };
}
