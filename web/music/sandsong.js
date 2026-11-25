// Glowing Sands' music: glassy and still. Soft pads drift through a lydian progression; high, tiny
// bell pings fall at random like grains striking glass (fewer as the night goes on); now and then a
// slow phrase on the glass bells; a low hum underneath, and the faint hiss of the sand.
import { bell, padChord } from './voices.js';
import { makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const PHRASES = [
  [[4, 4], [3, 2], [4, 2], [6, 8]],
  [[7, 6], [6, 2], [4, 4], [2, 4]],
  [[2, 4], [4, 4], [3, 4], [1, 4]],
  [[9, 4], [7, 4], [6, 2], [4, 6]],
];
// two bars each: D(maj9), E (the lydian II), Bm7, F#m7, as voicings above D
const PROG = [[0, [0, 4, 7, 11, 14]], [2, [2, 6, 9, 14]], [-3, [-3, 2, 5, 9]], [4, [4, 7, 11, 14]]];

export function createSandSong({ rng }) {
  const root = 50, deg = scaleOf(root, LYDIAN);
  const tune = tunePlayer(rng, PHRASES, { meter: 4, rest: [2, 4], align: 2 });
  return makeComposer({
    rng, bpm: [44, 58], meter: 4, swing: 0, level: 1.0, verb: 0.9, delay: 1,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { wind: 0.005, water: 0.0015 }, { droneMidi: root - 24, drone: 0.012 }),
    step(S) {
      const { A, ch, t, e, beatLen, sub, inBar, bar } = S;
      const ci = Math.floor(bar / 2) % PROG.length, [br, voicing] = PROG[ci];
      if (sub === 0 && inBar === 0 && bar % 2 === 0) {
        A.emit('chord', S.tm, { index: ci });
        padChord(A, ch.pad, t, voicing.map((x) => root + x), beatLen * 8, { vol: 0.0055 + 0.0035 * e, attack: 3, release: 5, cutoff: 1100, spread: 6, type: 'sine', voices: 3 });
        bell(A, ch.bass, t, root - 12 + br, 0.02, 0, 6);
      }
      // grains on glass: tiny high pings, scattered
      const chance = 0.18 + 0.32 * e;
      if (rng() < chance) { const d = Math.floor(rng() * 7) + 14; bell(A, ch.arp, t + rng() * S.eighth, deg(d), 0.006 + rng() * 0.006, (rng() - 0.5) * 1.4, 0.7 + rng() * 0.6); }
      // a slow phrase on the glass bells
      tune.step(S, (d, len) => { bell(A, ch.lead, t, deg(d) + 12, 0.03 + 0.015 * e, (rng() - 0.5) * 0.4, 4 + len * 0.2); A.emit('note', S.tm, {}); });
    },
  });
}
