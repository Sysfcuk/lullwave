// Disco Cat: a slow, soft disco groove that winds down into a lullaby. Early on: a gentle
// four-on-the-floor, an octave-bouncing bass, offbeat electric piano chords, lush strings and
// a twinkle of music box. As the night goes on the beat goes first, then the bass and keys,
// leaving warm strings and a music box singing a different little tune each time.
import { channel, padChord, epiano, bass, kick, noiseHit, bell, pick, mtof } from './voices.js';

const CHORDS = {
  I: [0, 4, 7, 11, 14],
  vi: [-3, 0, 4, 7, 11],
  ii: [2, 5, 9, 12, 16],
  IV: [5, 9, 12, 16],
  iii: [4, 7, 11, 14],
  V: [-5, 2, 5, 9],
};
const ROOTS = { I: 0, vi: -3, ii: 2, IV: 5, iii: 4, V: -5 };
const PROGRESSIONS = [['I', 'vi', 'ii', 'V'], ['IV', 'iii', 'ii', 'I'], ['I', 'IV', 'vi', 'V'], ['ii', 'V', 'I', 'IV']];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const BEATS_PER_CHORD = 4;

export function createDisco({ rng }) {
  const root = pick(rng, [53, 55, 57, 52]);
  const prog = pick(rng, PROGRESSIONS);
  let next = 0, step = 0, tune = [];
  const bpm = (e) => 64 + 20 * e;

  function newTune() {
    // four or five notes over two bars, mostly stepwise, a different tune every time
    const notes = [];
    let deg = 2 + Math.floor(rng() * 4), pos = 0;
    while (pos < 14) {
      notes.push({ at: pos, deg });
      pos += pick(rng, [2, 2, 3, 4]);
      deg = Math.max(0, Math.min(PENTA.length - 1, deg + pick(rng, [-1, -1, 1, 1, 2, -2])));
    }
    return notes;
  }

  return {
    level: 0.9, // trim so every world plays at about the same loudness
    delayTime: (60 / bpm(1)) * 0.75,

    live(ac, dest, t0) {
      const g = ac.createGain(); g.gain.value = 0; g.connect(dest);
      const o = ac.createOscillator(); o.frequency.value = mtof(root - 24);
      const a = ac.createGain(); a.gain.value = 0.035; o.connect(a); a.connect(g);
      o.start(t0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.8, t0 + 10);
      return { stop(t) { try { o.stop(t + 0.05); } catch { /* fine */ } } };
    },

    chunk(A, from, to, energyAt) {
      const strCh = channel(A, { gain: 1, verb: 0.55, delay: 0.05 });
      const keysCh = channel(A, { gain: 1, verb: 0.3, delay: 0.15 });
      const bassCh = channel(A, { gain: 1, verb: 0.05 });
      const drumCh = channel(A, { gain: 1, verb: 0.18 });
      const boxCh = channel(A, { gain: 1, verb: 0.6, delay: 0.35 });
      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
        const beatLen = 60 / bpm(e), s16 = beatLen / 4;
        const beat = Math.floor(step / 4), sub = step % 4;
        const name = prog[Math.floor(beat / BEATS_PER_CHORD) % prog.length];
        const inChord = beat % BEATS_PER_CHORD;
        const bar = Math.floor(beat / 4);
        const chord = CHORDS[name].map((o) => root + o);

        // lush strings under everything, a new swell each chord
        if (sub === 0 && inChord === 0) {
          padChord(A, strCh, t, chord.slice(0, 4), BEATS_PER_CHORD * beatLen, { type: 'sawtooth', voices: 2, spread: 10, attack: 1.2, release: 2.5, vol: 0.018 + 0.028 * (1 - e), cutoff: 900 + 1100 * e, q: 0.5 });
          A.emit('chord', tm, { name });
        }

        // the groove, early in the night only
        if (e > 0.62) {
          if (sub === 0) { kick(A, drumCh, t, 0.14 + 0.12 * (e - 0.62)); A.emit('kick', tm, {}); }
          if (sub === 2) noiseHit(A, drumCh, t, { vel: 0.022, freq: 6500, decay: 0.11, pan: 0.2 }); // open hat on the off-beat
          if (sub === 0 && inChord % 2 === 1) noiseHit(A, drumCh, t, { vel: 0.035, type: 'bandpass', freq: 1500, q: 0.9, decay: 0.14 }); // a soft clap
        }
        // octave-bouncing bass
        if (e > 0.42 && sub % 2 === 0) bass(A, bassCh, t, root - 24 + ROOTS[name] + (sub === 2 ? 12 : 0), s16 * 1.5, 0.11 + 0.05 * e);
        // offbeat electric piano stabs
        if (e > 0.35 && sub === 2 && (inChord === 0 || inChord === 2 || (inChord === 3 && rng() < 0.5))) {
          chord.slice(1, 4).forEach((m, k) => epiano(A, keysCh, t + k * 0.01, m + 12, 0.022 + 0.012 * e, (k - 1) * 0.3, s16 * 2));
        }

        // the music box: a new little tune every four bars, carried on into the lullaby
        if (bar % 4 === 0 && step % 16 === 0) tune = newTune();
        if (bar % 4 < 2 && step % 2 === 0) {
          const pos = (bar % 4) * 8 + (step % 16) / 2;
          for (const n of tune) if (n.at === pos) {
            const m = root + 24 + PENTA[n.deg];
            bell(A, boxCh, t, m, 0.03 + 0.04 * (1 - e), (rng() - 0.5) * 0.8, 2.5 + 1.5 * (1 - e));
            A.emit('bell', tm, { midi: m });
          }
        }
        step++;
        next += s16;
      }
    },
  };
}
