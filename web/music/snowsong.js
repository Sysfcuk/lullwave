// The Fantastical Snowstorm's music: a storm that blows itself out into a lullaby. At first the wind
// howls (resonant gusts that rise and fall, sent to the scene so the snow surges with them) over a
// low drone and a wordless choir; a celesta picks out a tune in D dorian, high and glassy, with
// sleigh-bell shimmers for the snow spirits. As the night goes on the gusts come less often and
// softer, the howl drops away, and what's left is the choir, the celesta and the hush of falling snow.
import { bell, padChord, swell, choir } from './voices.js';
import { jingle } from './ambient.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
// phrases in eighths, two bars of three-four
const PHRASES = [
  [[4, 2], [5, 1], [4, 1], [2, 2], [0, 6]],
  [[7, 3], [6, 1], [4, 2], [5, 2], [4, 4]],
  [[2, 2], [4, 2], [5, 2], [7, 4], [9, 2]],
  [[9, 2], [7, 2], [5, 2], [4, 3], [2, 1], [0, 2]],
  [[0, 1], [2, 1], [4, 2], [7, 2], [6, 4], [4, 2]],
];
// two bars each: Dm(add9), Bb(maj7), F, C(add9) (bass, voicing, semitones above D)
const PROG = [[0, [0, 3, 7, 14]], [-4, [-4, 0, 3, 9]], [3, [3, 7, 12, 15]], [-2, [-2, 2, 5, 10]]];

export function createSnowSong({ rng }) {
  const root = 50, deg = scaleOf(root, DORIAN);
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 3], align: 2 });
  return makeComposer({
    rng, bpm: [46, 62], meter: 3, swing: 0, level: 1.0, verb: 0.95, delay: 0.9,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { wind: 0.012 }, { droneMidi: root - 24, drone: 0.012 }),
    step(S) {
      const { A, ch, t, e, beatLen, sub, inBar, bar } = S;
      const storm = Math.min(1, Math.max(0, (e - 0.38) / 0.57));
      const ci = Math.floor(bar / 2) % PROG.length, [br, voicing] = PROG[ci], notes = voicing.map((x) => root + x);
      if (sub === 0 && inBar === 0 && bar % 2 === 0) {
        A.emit('chord', S.tm, { index: ci });
        padChord(A, ch.pad, t, notes.map((m) => m - 12), beatLen * 6, { vol: 0.009 + 0.004 * e, attack: 2.5, release: 4, cutoff: 900, type: 'triangle' });
        choir(A, ch.far, t, notes.slice(0, 3), beatLen * 6, { vol: 0.012 + 0.006 * (1 - storm), attack: 3, release: 5, bright: 0.6 });
        bell(A, ch.bass, t, root - 12 + br, 0.022, 0, 5);
      }
      // the storm: gusts that howl and fade, coming oftener and stronger while it rages
      S.every('gust', 7 - 3.5 * storm, () => {
        if (storm < 0.05 && rng() < 0.7) return;
        const strength = (0.3 + 0.7 * rng()) * (0.25 + 0.75 * storm), dur = 4 + rng() * 4;
        swell(A, ch.night, t, { dur, vel: 0.004 + 0.02 * strength, freq: 280 + rng() * 200, freq2: 700 + rng() * 500, q: 0.7, pan: rng() - 0.5, pan2: rng() - 0.5 });
        if (strength > 0.45) swell(A, ch.far, t + 0.5, { dur: dur * 0.9, vel: 0.006 * strength, freq: 420 + rng() * 160, freq2: 900 + rng() * 300, q: 7, pan: rng() - 0.5 }); // the howl
        A.emit('gust', S.tm + dur * 0.35, { strength });
      });
      // the celesta's tune, glassy and high
      tune.step(S, (d, len) => { bell(A, ch.lead, t, deg(d) + 24, 0.028 + 0.012 * e, (rng() - 0.5) * 0.5, 2.6 + len * 0.2); A.emit('note', S.tm, {}); });
      // a shimmer of bells for the snow spirits
      S.every('shimmer', 22, () => { jingle(A, ch.far, t, { vel: 0.006 + 0.004 * e, pan: rng() - 0.5 }); A.emit('chime', S.tm, {}); });
      if (sub === 1 && rng() < 0.08 * (1 - storm * 0.5)) bell(A, ch.arp, t, deg(14 + Math.floor(rng() * 5)), 0.005, (rng() - 0.5) * 1.2, 1.2); // a flake catching the light
    },
  });
}
