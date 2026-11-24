// Neon Rain: lo-fi for a rainy night in the city. Electric piano jazz chords, an upright-ish
// bass, a soft brushed swing beat, stray melody notes, rain on the glass, and thunder rolling in
// the distance. The beat drops away first as the night goes on, then the bass, leaving the keys.
import { channel, epiano, bass, kick, noiseHit, swell, pick, mtof } from './voices.js';

const CHORDS = {
  I: [0, 4, 7, 11, 14],
  vi: [-3, 0, 4, 7, 11],
  ii: [2, 5, 9, 12, 16],
  V: [-5, 0, 2, 5, 9],
  iii: [4, 7, 11, 14],
  IV: [5, 9, 12, 16, 19],
};
const ROOTS = { I: 0, vi: -3, ii: 2, V: -5, iii: 4, IV: 5 };
const PROGRESSIONS = [['I', 'vi', 'ii', 'V'], ['IV', 'iii', 'vi', 'ii'], ['ii', 'V', 'I', 'vi'], ['I', 'iii', 'IV', 'V']];
const PENTA = [0, 2, 4, 7, 9];
const BEATS_PER_CHORD = 4;
const SWING = 0.16; // of a beat, on the off-beat eighths

export function createRain({ rng }) {
  const root = pick(rng, [53, 55, 50, 57, 52]);
  const prog = pick(rng, PROGRESSIONS);
  let next = 0, step = 0, nextThunder = 40 + rng() * 40;
  const bpm = (e) => 66 + 10 * e;

  return {
    level: 0.8, // trim so every world plays at about the same loudness
    delayTime: (60 / bpm(1)) * 0.75,

    live(ac, dest, t0) {
      // rain against the glass: soft filtered noise, always there
      const n = ac.sampleRate * 3, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
      const g = ac.createGain(); g.gain.value = 0;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(dest);
      const sub = ac.createOscillator(), sg = ac.createGain();
      sub.frequency.value = mtof(root - 24); sg.gain.value = 0.025; sub.connect(sg); sg.connect(dest);
      src.start(t0); sub.start(t0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.035, t0 + 8);
      return { stop(t) { for (const o of [src, sub]) { try { o.stop(t + 0.05); } catch { /* fine */ } } } };
    },

    chunk(A, from, to, energyAt) {
      const keysCh = channel(A, { gain: 1, verb: 0.35, delay: 0.12 });
      const leadCh = channel(A, { gain: 1, verb: 0.45, delay: 0.35 });
      const bassCh = channel(A, { gain: 1, verb: 0.05 });
      const drumCh = channel(A, { gain: 1, verb: 0.15 });
      const fxCh = channel(A, { gain: 1, verb: 0.5 });
      while (next < to) {
        const tm = next, e = energyAt(tm);
        const beatLen = 60 / bpm(e), s16 = beatLen / 4;
        const beat = Math.floor(step / 4), sub = step % 4;
        const name = prog[Math.floor(beat / BEATS_PER_CHORD) % prog.length];
        const inChord = beat % BEATS_PER_CHORD;
        const t = tm - from + (sub === 2 ? SWING * beatLen : 0); // swing the off-beat
        const chord = CHORDS[name].map((o) => root + o);

        // keys: the chord on the one (gently strummed), a softer stab on the "and" of two
        if (sub === 0 && inChord === 0) {
          chord.forEach((m, k) => epiano(A, keysCh, t + k * 0.018, m, 0.04 + 0.015 * e, (k / chord.length - 0.5) * 0.6, beatLen * 2.6));
          A.emit('chord', tm, { name });
        }
        if (sub === 2 && inChord === 1 && rng() < 0.7) chord.slice(1, 4).forEach((m, k) => epiano(A, keysCh, t + k * 0.015, m, 0.025 + 0.01 * e, 0, beatLen * 1.2));

        // bass on one and three
        if (e > 0.25 && sub === 0 && (inChord === 0 || inChord === 2)) {
          const r = root - 24 + ROOTS[name] + (inChord === 2 ? pick(rng, [7, 0, 12, 5]) : 0);
          bass(A, bassCh, t, r, beatLen * 1.6, 0.15 + 0.04 * e);
        }

        // the beat: soft kick, brushed snare, swung hats
        if (e > 0.5) {
          if (sub === 0 && (inChord === 0 || (inChord === 2 && rng() < 0.5))) { kick(A, drumCh, t, 0.16 + 0.1 * (e - 0.5)); A.emit('kick', tm, {}); }
          if (sub === 2 && inChord === 1 && rng() < 0.4) kick(A, drumCh, t, 0.1);
          if (sub === 0 && inChord % 2 === 1) noiseHit(A, drumCh, t, { vel: 0.05, type: 'bandpass', freq: 2400, q: 0.6, decay: 0.22 });
          if (sub % 2 === 0) noiseHit(A, drumCh, t, { vel: 0.012 + (sub === 2 ? 0.006 : 0), freq: 7500, decay: 0.05, pan: 0.25 });
        }

        // a stray melody note on the pentatonic
        if (sub % 2 === 0 && rng() < 0.03 + 0.06 * e) {
          const m = root + 12 + PENTA[Math.floor(rng() * 5)] + (rng() < 0.3 ? 12 : 0);
          epiano(A, leadCh, t, m, 0.035, (rng() - 0.5) * 0.8, beatLen * 1.5);
          A.emit('note', tm, { midi: m });
        }

        // thunder far off: the flash comes first, the roll a few seconds later
        // thunder only early on, and soft: sudden loud sounds rouse sleepers
        if (tm >= nextThunder && e > 0.45) {
          A.emit('lightning', tm, {});
          swell(A, fxCh, t + 2.5, { dur: 9 + rng() * 4, vel: 0.03 + 0.05 * e, freq: 70, freq2: 45, q: 0.8, pan: (rng() - 0.5), pan2: (rng() - 0.5) });
          nextThunder = tm + 60 + rng() * 80;
        }
        step++;
        next += s16;
      }
    },
  };
}
