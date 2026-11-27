// Lost in Thought's music: a slow, wandering waltz for a sleepwalk through a labyrinth. Each dream
// has its own key, mode and colour (a music box in the moon garden, a warm electric piano in the
// library, vibraphone and a far-off choir in the sunken temple, high glassy bells in the halls of
// glass), and the music decides when the dream changes: a long breath out, a low bell, and the
// screen melts into the next one. Bells ring now and then that make the guiding wisp brighten, and
// late in the night the dreams stop changing and the waltz thins out to a pad and the odd bell.
import { bell, padChord, swell, epiano, choir } from './voices.js';
import { vibes, makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

const MODES = {
  garden: { key: 50, steps: [0, 2, 4, 6, 7, 9, 11], prog: [[0, 4], [3, 7], [5, 9], [4, 1]] },  // D lydian
  library: { key: 53, steps: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4], [5, 2], [3, 0], [4, 1]] }, // F major
  temple: { key: 45, steps: [0, 2, 3, 5, 7, 9, 10], prog: [[0, 2], [3, 5], [6, 1], [4, 6]] },  // A dorian
  glass: { key: 52, steps: [0, 2, 4, 6, 7, 9, 11], prog: [[0, 4], [1, 5], [5, 2], [4, 6]] },   // E lydian
};
const ORDER = ['garden', 'library', 'temple', 'glass'];
const PHRASES = [ // waltz phrases: [degree, eighths], six eighths a bar
  [[4, 4], [2, 2], [0, 6]],
  [[0, 2], [2, 2], [4, 2], [7, 6]],
  [[9, 4], [7, 2], [4, 4], [2, 2], [4, 6]],
  [[7, 3], [6, 1], [4, 2], [2, 6]],
  [[4, 2], [5, 2], [7, 2], [9, 4], [7, 2], [4, 6], [null, 6]],
  [[2, 4], [4, 2], [0, 6], [-1, 4], [0, 2], [2, 6]],
];

export function createMazeSong({ rng }) {
  let dream = null, nextDream = 0, bars = 0, k = -1;
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 3], align: 2, until: 0.3 });
  return makeComposer({
    rng, bpm: [54, 72], meter: 3, swing: 0.08, level: 1.8, verb: 1, delay: 0.75,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { wind: 0.006, room: 0.01 }),
    step(S) {
      const { A, ch, t, tm, e, beatLen, sub, inBar } = S;
      const barLen = beatLen * 3;
      // ---- a new dream: the music chooses it, and the screen melts into it
      if (sub === 0 && inBar === 0 && tm >= nextDream && (dream === null || e > 0.3)) {
        let n = Math.floor(rng() * ORDER.length); if (n === k) n = (n + 1) % ORDER.length;
        k = n; dream = { name: ORDER[k], ...MODES[ORDER[k]] }; bars = 0;
        A.emit('dream', tm, { k });
        if (tm > 1) {
          swell(A, ch.night, t, { dur: 7, vel: 0.012, freq: 3200, freq2: 260, q: 0.8, pan: 0.3, pan2: -0.3 });
          bell(A, ch.bass, t + 0.4, dream.key - 12, 0.03, 0, 9);
          bell(A, ch.far, t + 1.2, dream.key + 19, 0.012, 0.3, 6);
        }
        nextDream = tm + 270 + rng() * 90;
      }
      if (!dream) return;
      const deg = scaleOf(dream.key, dream.steps);
      if (sub === 0 && inBar === 0) bars++;
      const ci = Math.floor((bars - 1) / 2) % dream.prog.length;
      // ---- the pad, two bars a chord
      if (sub === 0 && inBar === 0 && bars % 2 === 1) {
        const [a, b] = dream.prog[ci], notes = [deg(a), deg(a + 2), deg(b + 7)].map((m) => m - 12);
        padChord(A, ch.pad, t, notes, barLen * 2, { vol: 0.005 + 0.003 * e, attack: 2, release: 4, cutoff: 800 + 600 * e, type: dream.name === 'glass' ? 'triangle' : 'sine', spread: 5 });
        bell(A, ch.bass, t, deg(a) - 24, 0.016, 0, 5);
        if (dream.name === 'temple' || dream.name === 'glass') choir(A, ch.far, t, [deg(a), deg(a + 4)], barLen * 2, { vol: 0.006 * (0.5 + e * 0.5), attack: 3, release: 5, bright: 0.6 });
      }
      // ---- the waltz's lilt: a low note on one, a soft chord on two and three
      if (e > 0.35 && sub === 0) {
        const [a] = dream.prog[Math.max(0, ci)];
        if (inBar === 0) bell(A, ch.bass, t, deg(a) - 12, 0.008 + 0.006 * e, -0.1, 2.5);
        else if (dream.name === 'library') epiano(A, ch.arp, t, deg(a + 2 + (inBar === 2 ? 2 : 0)), 0.004 + 0.004 * e, 0.2, beatLen);
        else vibes(A, ch.arp, t, deg(a + 2 + (inBar === 2 ? 2 : 0)), 0.003 + 0.004 * e, 0.2, beatLen * 1.2);
      }
      // ---- the tune, in this dream's voice
      tune.step(S, (d) => {
        const m = deg(d) + 12, pan = (rng() - 0.5) * 0.5;
        if (dream.name === 'library') epiano(A, ch.lead, t, m, 0.009 + 0.006 * e, pan, 2.4);
        else if (dream.name === 'temple') vibes(A, ch.lead, t, m, 0.012 + 0.008 * e, pan, 2.2);
        else if (dream.name === 'glass') bell(A, ch.lead, t, m + 12, 0.01 + 0.005 * e, pan, 3.5);
        else bell(A, ch.lead, t, m + 12, 0.012 + 0.006 * e, pan, 2.4); // a music box
      });
      // ---- a bell from somewhere in the labyrinth, and the wisp brightens with it
      S.every('chime', 14 + 10 * (1 - e), () => {
        A.emit('chime', tm, {});
        const m = deg(Math.floor(rng() * 5) + 7) + 12;
        bell(A, ch.far, t, m, 0.01, (rng() - 0.5) * 1.2, 6); bell(A, ch.far, t + 0.09, m + 7, 0.005, (rng() - 0.5) * 1.2, 5);
      });
      // the air of the place, now and then
      S.every('air', 30, () => swell(A, ch.night, t, { dur: 9, vel: 0.004 + 0.003 * e, freq: 700, freq2: 1500, q: 0.6, pan: rng() - 0.5, pan2: rng() - 0.5 }));
    },
  });
}
