// The Midnight Choir's music: plainsong. A single voice sings a slow modal line; the whole choir
// answers with a soft "amen"; an organ holds the low notes beneath them, the chords breathe in
// and out like the choir itself, and the stone gives everything back as a long echo. Now and
// then the tower bell tolls. No beat at all. The melodies are our own.
import { bell, padChord, choir } from './voices.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
// free-flowing chant lines: [scale degree, eighths]
const PHRASES = [
  [[0, 2], [2, 2], [3, 2], [4, 4], [3, 2], [2, 2], [0, 4]],
  [[4, 2], [5, 2], [4, 2], [3, 2], [2, 4], [0, 2], [2, 2], [3, 6]],
  [[3, 2], [4, 2], [6, 2], [5, 2], [4, 4], [2, 2], [3, 2], [2, 2], [0, 6]],
  [[7, 4], [6, 2], [4, 2], [5, 4], [4, 2], [3, 2], [2, 4], [0, 6]],
];
// i VII IV i v VII IV i, two bars each (semitones above the key note)
const PROG = [[0, 7, 12, 15], [-2, 5, 10, 14], [-7, 5, 9, 12], [0, 7, 12, 15], [-5, 7, 10, 14], [-2, 5, 10, 14], [-7, 5, 9, 12], [0, 7, 12, 15]];
const AMEN = [[-7, 5, 9, 12], [0, 7, 12, 15]]; // the plagal "a-men": IV to i

export function createChoirSong({ rng }) {
  const root = 50, deg = scaleOf(root, DORIAN);
  const tune = tunePlayer(rng, PHRASES, { rest: [1, 2], until: 0.25 });
  return makeComposer({
    rng, bpm: [36, 44], meter: 4, level: 1.75, verb: 1.25, delay: 1,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { room: 0.028 }),
    step(S) {
      const { A, ch, t, e, beatLen, sub, inBar, bar } = S;
      const ci = Math.floor(bar / 2) % PROG.length, chord = PROG[ci].map((x) => root + x);
      if (sub === 0 && inBar === 0 && bar % 2 === 0) {
        const dur = beatLen * 8;
        // the choir hums the harmony, softly, and the organ holds the bass
        choir(A, ch.pad, t, chord, dur, { vol: 0.02, attack: 4, release: 6, bright: 0.35 + 0.4 * e });
        padChord(A, ch.pad, t, [chord[0] - 12], dur, { type: 'triangle', voices: 1, attack: 3, release: 5, vol: 0.026, cutoff: 420 });
        padChord(A, ch.pad, t, [chord[0], chord[1]], dur, { type: 'sine', voices: 2, spread: 3, attack: 3, release: 5, vol: 0.012, cutoff: 900 }); // a soft flue stop
        A.emit('chord', S.tm, { index: ci });
      }
      // the cantor's line, and the choir's amen at the end of it
      tune.step(S, (d, len, first, last) => {
        const dur = len * S.eighth;
        choir(A, ch.lead, t, [deg(d) + 12], dur * 1.15, { vol: 0.026, attack: 0.35, release: 1.4, bright: 0.75 });
        A.emit('note', S.tm, {});
        if (last && S.e > 0.3) {
          const at = t + dur + beatLen;
          AMEN.forEach((c, k) => choir(A, ch.lead, at + k * beatLen * 3, c.map((x) => root + x + 12), beatLen * 3.2, { vol: 0.022, attack: 0.8, release: 3, bright: 0.6 }));
        }
      });
      // the tower bell tolls, slow and far away
      S.every('toll', 170, () => { for (let k = 0; k < 3; k++) bell(A, ch.far, t + k * 4, root - 12, 0.026, 0.25, 9); A.emit('bell', S.tm, {}); });
    },
  });
}
