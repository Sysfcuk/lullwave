// Penny's Night Patrol's music: a late-night jazz trio for a cat. Vibraphone tune, electric
// piano comping on the "Charleston" rhythm, a walking upright bass and brushes, all swung and
// soft, round a ii-V-I. In the room: Penny purring, the embers, the grandfather clock ticking
// (and chiming now and then), the odd sleepy mew. Our own tunes.
import { bell, epiano, bass, noiseHit } from './voices.js';
import { crackle } from './ambient.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds, vibes, mew } from './bespoke.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// two-bar phrases (eight eighths a bar)
const PHRASES = [
  [[4, 1], [5, 1], [4, 2], [2, 2], [0, 2], [1, 6], [null, 2]],
  [[7, 3], [6, 1], [4, 2], [2, 2], [3, 4], [2, 2], [null, 2]],
  [[2, 1], [4, 1], [6, 1], [8, 1], [7, 4], [5, 2], [4, 2], [2, 4]],
  [[0, 2], [2, 1], [4, 1], [6, 4], [5, 1], [4, 1], [2, 2], [0, 4]],
];
// Gm7 C7 Fmaj7 Dm7 | Gm7 C7 Am7 D7, a bar each: [bass note, voicing] in semitones above F
const PROG = [[2, [5, 9, 12, 14]], [-5, [5, 11, 14, 16]], [0, [4, 7, 11, 14]], [-3, [7, 9, 12, 16]], [2, [5, 9, 12, 14]], [-5, [5, 11, 14, 16]], [4, [7, 11, 14, 16]], [-3, [7, 9, 13, 16]]];
const CHIME = [4, 2, 3, 0];

export function createPennySong({ rng }) {
  const root = 53, deg = scaleOf(root, MAJOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 4, rest: [1, 2], align: 2 });
  let walkPrev = null;
  return makeComposer({
    rng, bpm: [54, 64], meter: 4, swing: 0.33, level: 1.1, verb: 0.45, delay: 0.75,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { purr: 0.045, fire: 0.008 }),
    step(S) {
      const { A, ch, t, ts, e, beatLen, sub, inBar, bar, beat } = S;
      const ci = bar % PROG.length, [br, voicing] = PROG[ci], chord = voicing.map((x) => root + x);
      if (sub === 0 && inBar === 0) A.emit('chord', S.tm, { index: ci });
      // electric piano comping: on one, and on the "and" of two
      if (e > 0.3 && ((inBar === 0 && sub === 0) || (inBar === 1 && sub === 1))) chord.slice(0, 3).forEach((m, k) => epiano(A, ch.arp, ts + k * 0.008, m, 0.011 * (0.6 + 0.4 * e), (k - 1.5) * 0.2, beatLen * (inBar === 0 ? 1.2 : 0.8)));
      // the walking bass: root, the third, the fifth, then a step into the next chord
      if (sub === 0 && e > 0.25) {
        const low = root - 12 + br, third = voicing.some((x) => ((x - br) % 12 + 12) % 12 === 3) ? 3 : 4;
        const nextLow = root - 12 + PROG[(ci + 1) % PROG.length][0];
        let m = [low, low + third, low + 7, nextLow + (rng() < 0.5 ? -1 : 1)][inBar];
        if (walkPrev != null && Math.abs(m - walkPrev) > 9) m += m > walkPrev ? -12 : 12;
        walkPrev = m;
        bass(A, ch.bass, t, m, beatLen * 0.55, 0.075 * (inBar === 0 ? 1 : 0.85) * (0.6 + 0.4 * e));
      }
      // brushes: a swish on two and four, feathery taps on the swung offbeats
      if (e > 0.35) {
        if (sub === 0 && inBar % 2 === 1) noiseHit(A, ch.perc, t, { vel: 0.011 * e, type: 'bandpass', freq: 2600, q: 0.6, decay: 0.22 });
        else if (sub === 1) noiseHit(A, ch.perc, ts, { vel: 0.0035 * e, type: 'highpass', freq: 5000, decay: 0.03 });
      }
      // the vibraphone's tune
      tune.step(S, (d, len) => { vibes(A, ch.lead, ts, deg(d) + 12, 0.04 + 0.02 * e, (rng() - 0.5) * 0.4, len * S.eighth + 0.5); A.emit('note', S.tm, {}); });
      // the room: the clock ticks on, the fire settles, Penny mews in her sleep
      if (sub === 0) noiseHit(A, ch.night, t, { vel: 0.004, type: 'bandpass', freq: beat % 2 ? 3100 : 2500, q: 5, decay: 0.012, pan: 0.5 });
      S.every('crackle', 4, () => crackle(A, ch.night, t, { vel: 0.01, pan: -0.3 }));
      S.every('chime', 210, () => CHIME.forEach((d, k) => bell(A, ch.far, t + k * 1.1, deg(d) + 12, 0.018, 0.5, 4)));
      S.every('mew', 260, () => { if (S.e > 0.4) mew(A, ch.night, t, 0.01, (rng() - 0.5)); });
    },
  });
}
