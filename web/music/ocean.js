// Deep Ocean: muffled Dorian pads as if heard through water, a slow sub drone with a gentle beat
// between two close tones, sonar-like pings that echo away, whales singing far off, and strings
// of bubbles. Very slow; it thins and darkens through the night like sinking deeper.
import { channel, padChord, bell, drip, swell, whale, pick, mtof } from './voices.js';

const CHORDS = {
  i: [0, 7, 10, 14, 15],
  IV: [5, 9, 12, 16],
  VII: [-2, 5, 9, 14],
  v: [7, 10, 14, 17],
  III: [3, 7, 10, 14],
};
const PROGRESSIONS = [['i', 'IV', 'i', 'VII'], ['i', 'VII', 'IV', 'i'], ['i', 'III', 'IV', 'v'], ['i', 'v', 'VII', 'IV']];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const BEATS_PER_CHORD = 8;

export function createOcean({ rng }) {
  const root = pick(rng, [45, 47, 48, 50]); // A, B, C or D
  const prog = pick(rng, PROGRESSIONS);
  let next = 0, step = 0, nextWhale = 14 + rng() * 20, nextBubbles = 8, nextSwell = 5;
  const bpm = (e) => 40 + 8 * e;

  return {
    delayTime: (60 / bpm(1)) * 1.5,

    live(ac, dest, t0) {
      // a deep drone: two tones a fraction of a hertz apart, slowly beating like a swell
      const g = ac.createGain(); g.gain.value = 0; g.connect(dest);
      const oscs = [];
      for (const [hz, amp] of [[mtof(root - 24), 0.05], [mtof(root - 24) + 0.23, 0.04], [mtof(root - 12), 0.012]]) {
        const o = ac.createOscillator(), a = ac.createGain();
        o.frequency.value = hz; a.gain.value = amp;
        o.connect(a); a.connect(g); oscs.push(o);
      }
      for (const o of oscs) o.start(t0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.8, t0 + 12);
      return { stop(t) { for (const o of oscs) { try { o.stop(t + 0.05); } catch { /* fine */ } } } };
    },

    chunk(A, from, to, energyAt) {
      const padCh = channel(A, { gain: 1, verb: 0.7, delay: 0.05 });
      const pingCh = channel(A, { gain: 1, verb: 0.6, delay: 0.55 });
      const whaleCh = channel(A, { gain: 1, verb: 1.1, delay: 0.25 });
      const fxCh = channel(A, { gain: 1, verb: 0.8 });

      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
        const beat = step / 4, beatLen = 60 / bpm(e);
        const chordIdx = Math.floor(beat / BEATS_PER_CHORD) % prog.length;
        const inChord = beat % BEATS_PER_CHORD;

        if (step % (4 * BEATS_PER_CHORD) === 0) {
          const notes = CHORDS[prog[chordIdx]].map((o) => root + 12 + o);
          // muffled, as if through water: low cutoff that opens a little with the energy
          padChord(A, padCh, t, notes, BEATS_PER_CHORD * beatLen, { type: 'sawtooth', voices: 2, spread: 9, attack: 4, release: 6, vol: 0.042, cutoff: 320 + 520 * e, q: 0.6 });
          padChord(A, padCh, t, notes.slice(1, 4).map((m) => m + 12), BEATS_PER_CHORD * beatLen, { type: 'sine', voices: 1, attack: 6, release: 6, vol: 0.01 * (0.3 + e), cutoff: 3000 });
          A.emit('chord', tm, { index: chordIdx });
        }

        // sonar pings: a single high note now and then, echoing away
        if (step % 4 === 0 && inChord % 2 === 0 && rng() < 0.12 + 0.3 * e) {
          const m = root + 24 + pick(rng, [0, 7, 12, 14, 19, 10]);
          const pan = (rng() - 0.5) * 1.6;
          bell(A, pingCh, t, m, 0.035 + 0.03 * e, pan, 6);
          A.emit('ping', tm, { midi: m, pan });
        }

        // a whale, far away
        if (tm >= nextWhale) {
          const deg = pick(rng, [0, 2, 4, 3]), m = root + 12 + DORIAN[deg];
          const pan = (rng() - 0.5) * 1.4, dur = 5 + rng() * 4;
          whale(A, whaleCh, t, m, dur, 0.05 + 0.02 * e, pan);
          if (rng() < 0.6) whale(A, whaleCh, t + dur * 0.8, m + pick(rng, [-5, -2, 3, 5]), dur * 0.8, 0.04, pan * 0.7);
          A.emit('whale', tm, { pan, dur });
          nextWhale = tm + 35 + rng() * 45;
        }

        // a string of bubbles rising
        if (tm >= nextBubbles) {
          const n = 3 + Math.floor(rng() * 6), pan = (rng() - 0.5) * 1.6;
          let bt = t;
          for (let k = 0; k < n; k++) { drip(A, fxCh, bt, 500 + k * 120 + rng() * 300, 0.025 + rng() * 0.02, pan + (rng() - 0.5) * 0.2); bt += 0.08 + rng() * 0.25; }
          A.emit('bubbles', tm, { pan, n });
          nextBubbles = tm + 7 + rng() * 14;
        }

        // the slow heave of deep water
        if (tm >= nextSwell) {
          swell(A, fxCh, t, { dur: 10 + rng() * 6, vel: 0.04, freq: 140 + rng() * 80, freq2: 90 + rng() * 40, q: 1.2, pan: (rng() - 0.5), pan2: (rng() - 0.5) });
          nextSwell = tm + 14 + rng() * 14;
        }
        step++;
        next += beatLen / 4;
      }
    },
  };
}
