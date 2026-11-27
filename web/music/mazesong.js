// Lost in Thought's music: a slow, wandering waltz for a sleepwalk through a labyrinth. Each dream
// has its own key, mode and colour (a music box in the moon garden, a warm electric piano in the
// library, vibraphone and a far-off choir in the sunken temple, high glassy bells in the halls of
// glass, bells and voices floating in the cloud palace, handbells and a choir in the snowbound abbey),
// and the music decides when the dream changes: a long breath out, a low bell, and the screen melts
// into the next one. It also brings the weather and the whale: a shower passes over the garden or
// the temple (you hear it come and go, and the pools ring with it), and now and then a whale sings
// far off as it swims across the sky. Bells ring that make the guiding wisp brighten, and late in
// the night the dreams stop changing and the waltz thins out to a pad and the odd bell.
import { bell, padChord, swell, epiano, choir, whale } from './voices.js';
import { vibes, makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

// the dreams, in the same order as the scene's (maze-tex.js)
const ORDER = ['garden', 'library', 'temple', 'glass', 'cloud', 'abbey'];
const MODES = {
  garden: { key: 50, steps: [0, 2, 4, 6, 7, 9, 11], prog: [[0, 4], [3, 7], [5, 9], [4, 1]], showers: true, whale: true },  // D lydian
  library: { key: 53, steps: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4], [5, 2], [3, 0], [4, 1]] },                              // F major
  temple: { key: 45, steps: [0, 2, 3, 5, 7, 9, 10], prog: [[0, 2], [3, 5], [6, 1], [4, 6]], showers: true, whale: true },   // A dorian
  glass: { key: 52, steps: [0, 2, 4, 6, 7, 9, 11], prog: [[0, 4], [1, 5], [5, 2], [4, 6]], whale: true },                    // E lydian
  cloud: { key: 55, steps: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4], [3, 0], [5, 2], [4, 1]], whale: true }, // G, airy
  abbey: { key: 48, steps: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 2], [5, 0], [3, 5], [4, 6]] },                                 // C aeolian
};
const PHRASES = [ // waltz phrases: [degree, eighths], six eighths a bar
  [[4, 4], [2, 2], [0, 6]],
  [[0, 2], [2, 2], [4, 2], [7, 6]],
  [[9, 4], [7, 2], [4, 4], [2, 2], [4, 6]],
  [[7, 3], [6, 1], [4, 2], [2, 6]],
  [[4, 2], [5, 2], [7, 2], [9, 4], [7, 2], [4, 6], [null, 6]],
  [[2, 4], [4, 2], [0, 6], [-1, 4], [0, 2], [2, 6]],
];

export function createMazeSong({ rng }) {
  let dream = null, nextDream = 0, bars = 0, k = -1, nextShower = 120, nextWhale = 90;
  const rains = []; // showers, decided a chunk ahead so their sound can be laid down: { t0, t1, amt, told }
  const pending = [];
  const later = (when, fn) => pending.push({ when, fn });
  const rainAt = (tm) => {
    let v = 0;
    for (const r of rains) { if (tm < r.t0 || tm > r.t1) continue; v = Math.max(v, r.amt * Math.min(1, (tm - r.t0) / 10, (r.t1 - tm) / 12)); }
    return v;
  };
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 3], align: 2, until: 0.3 });
  return makeComposer({
    rng, bpm: [54, 72], meter: 3, swing: 0.08, level: 1.8, verb: 1, delay: 0.75,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { wind: 0.006, room: 0.01 }),
    // the rain: soft noise, its level following the showers
    setup(A, ch, from, to) {
      if (!rains.some((r) => r.t1 > from && r.t0 < to)) return null;
      const { ac } = A, s = ac.createBufferSource(), bp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = A.whiteBuffer; s.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.35; lp.type = 'lowpass'; lp.frequency.value = 7000;
      g.gain.value = 0; s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(ch.night.input);
      for (let tm = from; tm <= to + 2; tm += 0.5) g.gain.setTargetAtTime(rainAt(tm) * 0.035, Math.max(0, tm - from), 0.4);
      s.start(0); s.stop(to - from + 3);
      return null;
    },
    step(S) {
      const { A, ch, t, tm, e, beatLen, sub, inBar } = S;
      const barLen = beatLen * 3;
      // ---- a new dream: the music chooses it, and the screen melts into it
      if (sub === 0 && inBar === 0 && tm >= nextDream && (dream === null || e > 0.3)) {
        let n = Math.floor(rng() * ORDER.length); if (n === k) n = (n + 1) % ORDER.length;
        k = n; dream = { name: ORDER[k], ...MODES[ORDER[k]] }; bars = 0;
        A.emit('dream', tm, { k });
        for (const r of rains) if (r.t1 > tm + 22) r.t1 = Math.max(r.t0, tm + 22); // the weather goes with the dream
        if (tm > 1) {
          swell(A, ch.night, t, { dur: 7, vel: 0.012, freq: 3200, freq2: 260, q: 0.8, pan: 0.3, pan2: -0.3 });
          bell(A, ch.bass, t + 0.4, dream.key - 12, 0.03, 0, 9);
          bell(A, ch.far, t + 1.2, dream.key + 19, 0.012, 0.3, 6);
        }
        nextDream = tm + 270 + rng() * 90;
        nextShower = Math.max(nextShower, tm + 60 + rng() * 60); nextWhale = Math.max(nextWhale, tm + 40 + rng() * 60);
      }
      if (!dream) return;
      const deg = scaleOf(dream.key, dream.steps);
      if (sub === 0 && inBar === 0) bars++;
      const ci = Math.floor((bars - 1) / 2) % dream.prog.length;
      // ---- weather: a shower, decided a little ahead, then told to the scene as it arrives
      if (dream.showers && tm >= nextShower && e > 0.3) {
        const t0 = tm + 22, dur = 50 + rng() * 50;
        rains.push({ t0, t1: t0 + dur, amt: 0.6 + rng() * 0.4, told: false });
        nextShower = t0 + dur + 150 + rng() * 200;
      }
      for (const r of rains) if (!r.told && tm >= r.t0) { r.told = true; if (dream.showers) A.emit('weather', tm, { amt: r.amt, dur: r.t1 - tm }); }
      // ---- the whale: it swims across the sky, singing as it goes
      if (dream.whale && tm >= nextWhale && sub === 0 && inBar === 0) {
        A.emit('whale', tm, {});
        const root = dream.key - 12;
        whale(A, ch.far, t + 2, root + 7, 7, 0.01, -0.4);
        later(tm + 18, (tt) => whale(A, ch.far, tt, root + 12, 8, 0.009, 0));
        later(tm + 38, (tt) => whale(A, ch.far, tt, root + 5, 7, 0.008, 0.4));
        nextWhale = tm + 200 + rng() * 120;
      }
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].when < tm + S.eighth) { const it = pending.splice(i, 1)[0]; it.fn(t + Math.max(0, it.when - tm)); }
      // ---- the pad, two bars a chord
      if (sub === 0 && inBar === 0 && bars % 2 === 1) {
        const [a, b] = dream.prog[ci], notes = [deg(a), deg(a + 2), deg(b + 7)].map((m) => m - 12);
        padChord(A, ch.pad, t, notes, barLen * 2, { vol: 0.005 + 0.003 * e, attack: 2, release: 4, cutoff: 800 + 600 * e, type: dream.name === 'glass' || dream.name === 'cloud' ? 'triangle' : 'sine', spread: 5 });
        bell(A, ch.bass, t, deg(a) - 24, 0.016, 0, 5);
        if (dream.name === 'temple' || dream.name === 'glass' || dream.name === 'abbey' || dream.name === 'cloud') choir(A, ch.far, t, [deg(a), deg(a + 4)], barLen * 2, { vol: (dream.name === 'abbey' ? 0.008 : 0.006) * (0.5 + e * 0.5), attack: 3, release: 5, bright: dream.name === 'cloud' ? 0.9 : 0.6 });
      }
      // ---- the waltz's lilt: a low note on one, a soft chord on two and three
      if (e > 0.35 && sub === 0) {
        const [a] = dream.prog[Math.max(0, ci)];
        if (inBar === 0) bell(A, ch.bass, t, deg(a) - 12, 0.008 + 0.006 * e, -0.1, 2.5);
        else if (dream.name === 'library') epiano(A, ch.arp, t, deg(a + 2 + (inBar === 2 ? 2 : 0)), 0.004 + 0.004 * e, 0.2, beatLen);
        else if (dream.name !== 'abbey') vibes(A, ch.arp, t, deg(a + 2 + (inBar === 2 ? 2 : 0)), 0.003 + 0.004 * e, 0.2, beatLen * 1.2);
      }
      // ---- the tune, in this dream's voice
      tune.step(S, (d) => {
        const m = deg(d) + 12, pan = (rng() - 0.5) * 0.5;
        if (dream.name === 'library') epiano(A, ch.lead, t, m, 0.009 + 0.006 * e, pan, 2.4);
        else if (dream.name === 'temple') vibes(A, ch.lead, t, m, 0.012 + 0.008 * e, pan, 2.2);
        else if (dream.name === 'glass') bell(A, ch.lead, t, m + 12, 0.01 + 0.005 * e, pan, 3.5);
        else if (dream.name === 'cloud') { bell(A, ch.lead, t, m + 12, 0.009 + 0.005 * e, pan, 4); bell(A, ch.far, t + 0.02, m + 19, 0.003, -pan, 3); }
        else if (dream.name === 'abbey') bell(A, ch.lead, t, m, 0.014 + 0.006 * e, pan, 4.5); // handbells
        else bell(A, ch.lead, t, m + 12, 0.012 + 0.006 * e, pan, 2.4); // a music box
      });
      // the abbey's great bell, far off, now and then
      if (dream.name === 'abbey') S.every('toll', 45, () => { bell(A, ch.far, t, dream.key - 12, 0.02, 0.3, 10); bell(A, ch.far, t + 0.02, dream.key - 5, 0.008, 0.3, 8); });
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
