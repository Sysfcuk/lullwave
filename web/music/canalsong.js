// The Moonlit Canal's music: a barcarolle, the boat song, in a gently rocking 6/8. A harp rocks
// up and down each chord like the narrowboat on the water, a clarinet sings the tune, and the
// canal does the rest: little waves lapping at the hull, the engine putting softly in the
// distance, ducks muttering in the reeds, drips from the willows, an owl. Our own tunes.
import { pluck, padChord, drip } from './voices.js';
import { quack, cricket } from './ambient.js';
import { owl } from './nature.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds, clarinet } from './bespoke.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRASES = [
  [[4, 3], [5, 1], [4, 2], [2, 6], [3, 3], [4, 1], [3, 2], [1, 6]],
  [[0, 2], [2, 2], [4, 2], [7, 4], [6, 2], [5, 3], [4, 1], [3, 2], [4, 6]],
  [[7, 3], [6, 1], [5, 2], [4, 3], [2, 3], [3, 2], [2, 2], [1, 2], [0, 6]],
  [[2, 4], [3, 2], [4, 4], [5, 2], [4, 2], [3, 2], [1, 2], [2, 6]],
];
// F Bb F C7 Dm Bb C7 F, two bars each
const PROG = [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14, 17], [9, 12, 16], [5, 9, 12], [7, 11, 14, 17], [0, 4, 7]];
const ROCK = [0, 1, 2, 3, 2, 1]; // up and down the chord, like the boat

export function createCanalSong({ rng }) {
  const root = 53, deg = scaleOf(root, MAJOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 2], align: 4 });
  let last = null;
  return makeComposer({
    rng, bpm: [58, 68], meter: 3, level: 1.45, verb: 0.75, delay: 1,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { lap: 0.022, water: 0.014, engine: 0.012, wind: 0.01 }),
    step(S) {
      const { A, ch, t, e, beatLen, sub, inBar, bar } = S;
      const ci = Math.floor(bar / 2) % PROG.length, c = PROG[ci].map((x) => root + x);
      if (sub === 0 && inBar === 0 && bar % 2 === 0) {
        padChord(A, ch.pad, t, c, beatLen * 6, { type: 'triangle', voices: 2, spread: 6, attack: 2.5, release: 4, vol: 0.012, cutoff: 700 });
        A.emit('chord', S.tm, { index: ci });
      }
      // the rocking harp: six notes a bar, low root, up the chord and back down
      if (e > 0.25) {
        const tones = [c[0] - 12, c[2] - 12, c[0], c[1]], k = ROCK[(inBar * 2 + sub) % 6];
        pluck(A, ch.arp, t, tones[k], (k === 0 ? 0.026 : 0.016) * (0.6 + 0.4 * e), (k - 1.5) * 0.25, { bright: 1500, decay: 0.75 });
      }
      // the clarinet's song
      tune.step(S, (d, len) => {
        const m = deg(d) + 12;
        clarinet(A, ch.lead, t, m, len * S.eighth * 0.95, 0.03 + 0.016 * e, (rng() - 0.5) * 0.3, last);
        last = m;
        A.emit('note', S.tm, {});
      });
      // the canal
      S.every('duck', 38, () => { quack(A, ch.night, t, { pan: (rng() - 0.5) * 1.4 }); if (rng() < 0.5) quack(A, ch.night, t + 0.35, { vel: 0.018 }); A.emit('duck', S.tm, {}); });
      S.every('drip', 5, () => drip(A, ch.night, t, 380 + rng() * 260, 0.018, (rng() - 0.5) * 1.2));
      S.every('cricket', 3, () => cricket(A, ch.night, t, { vel: 0.007, pan: (rng() - 0.5) * 1.8, f: 3800 + rng() * 1000 }));
      S.every('owl', 80, () => { if (S.e < 0.8) { owl(A, ch.far, t, { vel: 0.03, pan: (rng() - 0.5) * 1.4 }); A.emit('owl', S.tm, {}); } });
    },
  });
}
