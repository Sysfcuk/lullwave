// The Pineapple Pizza Incident's music: a slow, sleepy tarantella in A minor. A mandolin plays
// the tune with its trembling strokes, an accordion squeezes the off-beats, a guitar thumbs the
// bass and a tambourine barely shivers. Around it, the kitchen after closing: the oven's fire,
// a log settling, the chef kneading tomorrow's dough, a plate clinking on the pass. Our own tunes.
import { bell, pluck, noiseHit } from './voices.js';
import { crackle, tick } from './ambient.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds, squeeze, thud } from './bespoke.js';

const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const PHRASES = [
  [[4, 3], [5, 1], [4, 2], [3, 2], [2, 2], [1, 2], [2, 3], [3, 1], [4, 2], [0, 6]],
  [[7, 2], [6, 2], [5, 2], [4, 4], [2, 2], [3, 2], [4, 2], [5, 2], [4, 6]],
  [[0, 2], [2, 2], [4, 2], [7, 4], [6, 2], [5, 2], [4, 2], [3, 2], [2, 6]],
  [[4, 2], [3, 2], [2, 2], [1, 2], [2, 2], [3, 2], [4, 4], [1, 2], [0, 6]],
];
// Am Dm E7 Am F Dm E7 Am, a bar each
const PROG = [[0, 3, 7], [5, 8, 12], [7, 11, 14, 17], [0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 11, 14, 17], [0, 3, 7]];

export function createPizzeria({ rng }) {
  const root = 57, deg = scaleOf(root, HARMONIC_MINOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 2], align: 4 });
  return makeComposer({
    rng, bpm: [70, 82], meter: 3, level: 3.1, verb: 0.5, delay: 1,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { fire: 0.016, murmur: 0.006 }),
    step(S) {
      const { A, ch, t, e, beatLen, sub, inBar, bar } = S;
      const ci = bar % PROG.length, chord = PROG[ci].map((x) => root + x);
      if (sub === 0 && inBar === 0) A.emit('chord', S.tm, { index: ci });
      // guitar bass on one, accordion on two and three
      if (sub === 0 && e > 0.25) {
        if (inBar === 0) pluck(A, ch.bass, t, chord[0] - 24, 0.055 * (0.6 + 0.4 * e), 0, { bright: 700, decay: 0.55 });
        else squeeze(A, ch.arp, t, chord.slice(0, 3).map((m) => m - 12), beatLen * 0.45, 0.009 * (0.6 + 0.4 * e), inBar === 1 ? -0.25 : 0.25);
      }
      // a tambourine, barely touched
      if (e > 0.45 && sub === 0 && inBar === 0) noiseHit(A, ch.perc, t, { vel: 0.006 * e, type: 'bandpass', freq: 7500, q: 2, decay: 0.1, pan: 0.35 });
      // the mandolin's tune, each long note trembling
      tune.step(S, (d, len) => {
        const m = deg(d) + 12, v = 0.034 + 0.018 * e, p = (rng() - 0.5) * 0.3;
        pluck(A, ch.lead, t, m, v, p, { bright: 2600, decay: 0.45 });
        const strokes = Math.min(6, Math.floor((len * S.eighth) / 0.12));
        for (let k = 1; k < strokes; k++) tick(A, ch.lead, t + k * 0.12, m, v * 0.38, p);
        A.emit('note', S.tm, {});
      });
      // the kitchen
      S.every('crackle', 3, () => crackle(A, ch.night, t, { vel: 0.012, pan: -0.2 }));
      S.every('knead', 30, () => { for (let k = 0; k < 4; k++) thud(A, ch.night, t + k * 0.7, 0.02, 80 + rng() * 15, 0.15); });
      S.every('clink', 40, () => { bell(A, ch.night, t, 94 + Math.floor(rng() * 5), 0.006, 0.4, 0.5); bell(A, ch.night, t + 0.14, 97 + Math.floor(rng() * 4), 0.004, 0.4, 0.4); });
    },
  });
}
