// Pineapple Fever Dream's music: a tropical lullaby that has gone a bit strange. A steel pan
// plays the tune in a whole-tone scale (no home note, so it floats), slightly out of tune with
// itself as if the tape were warped; a marimba echoes it a bar later; dreamy augmented chords
// wobble on glass pads, celesta twinkles drift by, the odd pineapple goes boing, and swells of
// air rise and fall. The tunes are our own.
import { bell, padChord, swell } from './voices.js';
import { marimba, cricket } from './ambient.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds, steelpan, boing } from './bespoke.js';

const WHOLE_TONE = [0, 2, 4, 6, 8, 10];
const PHRASES = [
  [[0, 2], [1, 2], [2, 2], [3, 4], [2, 2], [4, 2], [3, 2], [1, 2], [2, 6]],
  [[5, 3], [4, 1], [3, 2], [2, 2], [3, 2], [4, 2], [6, 4], [5, 2], [3, 6]],
  [[3, 2], [5, 2], [3, 2], [1, 4], [0, 2], [1, 2], [2, 2], [3, 2], [0, 6]],
];
// augmented chords drifting by whole tones, two bars each
const PROG = [[0, 4, 8], [2, 6, 10], [0, 4, 8], [-2, 2, 6]];

export function createFeverSong({ rng }) {
  const root = 54, deg = scaleOf(root, WHOLE_TONE);
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 2], align: 4 });
  return makeComposer({
    rng, bpm: [50, 58], meter: 3, level: 0.88, verb: 0.95, delay: 1,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { wind: 0.01 }),
    // the warp: slow pitch drifts shared by the pads and the steel pan
    setup(A, ch, from, to) {
      const mk = (rate, depth) => { const o = A.ac.createOscillator(), g = A.ac.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); o.start(0); o.stop(to - from + 30); return g; };
      return { wob: mk(0.11, 24), bend: mk(0.07, 16) };
    },
    step(S) {
      const { A, ch, t, e, beatLen, sub, inBar, bar, extra } = S;
      const ci = Math.floor(bar / 2) % PROG.length, chord = PROG[ci].map((x) => root + x);
      if (sub === 0 && inBar === 0 && bar % 2 === 0) {
        padChord(A, ch.pad, t, chord, beatLen * 6, { type: 'sine', voices: 2, spread: 10, attack: 2.5, release: 4, vol: 0.026, cutoff: 1400, wobble: extra.wob });
        padChord(A, ch.pad, t, [chord[0] - 12], beatLen * 6, { type: 'sine', voices: 1, attack: 3, release: 4, vol: 0.026, cutoff: 600 });
        A.emit('chord', S.tm, { index: ci });
      }
      // celesta twinkles
      if (e > 0.3 && rng() < 0.16) bell(A, ch.arp, S.t, chord[Math.floor(rng() * chord.length)] + 24, 0.008 + rng() * 0.006, (rng() - 0.5) * 1.4, 1.2);
      // the steel pan's tune, and the marimba's echo a bar behind
      tune.step(S, (d, len) => {
        const m = deg(d) + 12, v = 0.038 + 0.018 * e, p = (rng() - 0.5) * 0.5;
        steelpan(A, ch.lead, t, m, v, p, extra.bend);
        if (len >= 2) steelpan(A, ch.lead, t + S.eighth, m, v * 0.35, p, extra.bend); // the pan's quick double-strike
        marimba(A, ch.arp, t + beatLen * 3, m - 12, v * 0.55, -p);
        A.emit('note', S.tm, {});
      });
      S.every('boing', 45, () => boing(A, ch.night, t, root + 12 + Math.floor(rng() * 8), 0.018, (rng() - 0.5)));
      S.every('swell', 32, () => swell(A, ch.far, t, { dur: 7, vel: 0.03, freq: 500, freq2: 1600, q: 2, pan: -0.5, pan2: 0.5 }));
      S.every('cricket', 4, () => cricket(A, ch.night, t, { vel: 0.006, pan: (rng() - 0.5) * 1.6, f: 3600 + rng() * 900 }));
    },
  });
}
