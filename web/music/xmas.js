// The Christmas Market's music: a little carol-like waltz on celesta and music box over warm
// strings and pizzicato, sleigh bells shivering on the beat, a peal of handbells ringing down the
// scale now and then, the church clock across the square, the market murmuring and footsteps
// crunching through the snow. The tunes are our own.
import { bell, pluck, padChord, noiseHit } from './voices.js';
import { jingle, footstep } from './ambient.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// four-bar phrases in 3/4 (six eighths a bar): [scale degree, eighths]
const PHRASES = [
  [[4, 2], [4, 2], [5, 2], [4, 4], [2, 2], [0, 2], [1, 2], [2, 2], [1, 6]],
  [[7, 3], [6, 1], [5, 2], [4, 4], [4, 2], [5, 2], [4, 2], [2, 2], [4, 6]],
  [[2, 2], [4, 2], [7, 2], [6, 4], [5, 2], [4, 2], [2, 2], [1, 2], [0, 6]],
  [[4, 4], [5, 2], [6, 2], [5, 2], [4, 2], [2, 4], [1, 2], [0, 6]],
];
// I vi IV V7 I IV ii V, two bars each (semitones above the key note)
const PROG = [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14, 17], [0, 4, 7], [5, 9, 12], [2, 5, 9], [7, 11, 14]];

export function createXmas({ rng }) {
  const root = 55, deg = scaleOf(root, MAJOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 2], align: 4 });
  let voice = 'celesta';
  return makeComposer({
    rng, bpm: [64, 78], meter: 3, level: 2, verb: 0.7, delay: 1,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { murmur: 0.014, wind: 0.016 }, { droneMidi: root - 24, drone: 0.018 }),
    step(S) {
      const { A, ch, t, e, beatLen, sub, inBar, bar } = S;
      const ci = Math.floor(bar / 2) % PROG.length, chord = PROG[ci].map((x) => root + x);
      // warm strings, a new chord every two bars
      if (sub === 0 && inBar === 0 && bar % 2 === 0) {
        padChord(A, ch.pad, t, chord, beatLen * 6, { type: 'sawtooth', voices: 2, spread: 7, attack: 2, release: 4, vol: 0.015, cutoff: 650 + 550 * e });
        A.emit('chord', S.tm, { index: ci });
      }
      // pizzicato: the bass on one, the chord on two and three
      if (sub === 0 && e > 0.3) {
        if (inBar === 0) pluck(A, ch.bass, t, chord[0] - 12, 0.05 * (0.6 + 0.4 * e), 0, { bright: 900, decay: 0.5 });
        else { pluck(A, ch.arp, t, chord[1] + 12, 0.014, -0.3, { bright: 1400, decay: 0.22 }); pluck(A, ch.arp, t + 0.012, chord[2] + 12, 0.014, 0.3, { bright: 1400, decay: 0.22 }); }
      }
      // sleigh bells, shivering softly on the beat
      if (e > 0.45 && sub === 0) noiseHit(A, ch.perc, t, { vel: (inBar ? 0.003 : 0.006) * e, type: 'bandpass', freq: 6800, q: 3, decay: 0.14, pan: 0.4 });
      if (e > 0.45 && sub === 0 && inBar === 0 && bar % 8 === 7) jingle(A, ch.far, t, { vel: 0.01, pan: 0.5 });
      // the tune: celesta or music box, a phrase at a time
      tune.step(S, (d, len, first) => {
        if (first) voice = rng() < 0.6 ? 'celesta' : 'musicbox';
        bell(A, ch.lead, t, deg(d) + 24, (0.03 + 0.02 * e) * (voice === 'musicbox' ? 0.8 : 1), (rng() - 0.5) * 0.4, voice === 'musicbox' ? 2.4 : 1.4);
        A.emit('note', S.tm, {});
      });
      // a peal of handbells, ringing rounds down the scale
      S.every('peal', 150, () => {
        for (let k = 0; k < 16; k++) bell(A, ch.far, t + k * 0.42, deg(7 - (k % 8)) + 12, 0.016 + (k % 8 === 0 ? 0.006 : 0), k % 2 ? 0.35 : -0.35, 3);
        A.emit('bell', S.tm, {});
      });
      // the church clock across the square
      S.every('clock', 260, () => { for (let k = 0; k < 3; k++) bell(A, ch.far, t + k * 2.6, root - 12, 0.022, -0.2, 7); });
      // shoppers' footsteps in the snow
      S.every('steps', 7, () => { const n = 3 + Math.floor(rng() * 4), p = (rng() - 0.5) * 1.4; for (let k = 0; k < n; k++) footstep(A, ch.night, t + k * 0.55, { vel: 0.014, pan: p + k * 0.05, surface: 'snow' }); });
    },
  });
}
