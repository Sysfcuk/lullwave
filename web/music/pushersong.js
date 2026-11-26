// Any Second Now's music: a seaside-arcade waltz, slow and a little wistful. A music-box tune and soft
// vibes over a warm pad, the sea outside, the other machines' far-off jingles (fewer as the arcade
// empties). And the machine itself: the shelf's push once a bar (the pile shuffling forward with a
// clink), every coin that goes in (the click of the slot, the rattle down the rail, the clink as it
// lands), now and then the clatter of one slipping into a side gutter, and, when the edge looks
// closest of all, a hopeful run of notes up... and a soft two-note "nearly" back down.
import { bell, padChord, noiseHit, swell, epiano } from './voices.js';
import { panned } from './ambient.js';
import { thud, vibes, makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRASES = [
  [[4, 2], [5, 1], [4, 1], [2, 2], [0, 6]],
  [[7, 3], [6, 1], [4, 2], [5, 2], [4, 4]],
  [[2, 2], [4, 2], [7, 2], [9, 4], [7, 2]],
  [[9, 2], [7, 2], [5, 2], [4, 3], [2, 1], [0, 2]],
  [[4, 2], [7, 2], [11, 2], [9, 4], [7, 2]],
];
// two bars each, semitones above G: G, Em, C, D
const PROG = [[0, [0, 4, 7, 11]], [-3, [-3, 0, 4, 7]], [5, [0, 5, 9, 12]], [7, [2, 7, 11, 14]]];

/** A coin's clink: a couple of high, slightly inharmonic pings. */
function clink(A, ch, t, vel = 0.01, pan = 0, n = 2) {
  t = Math.max(0, t);
  const { ac } = A;
  for (let k = 0; k < n; k++) {
    const tt = t + k * (0.03 + Math.random() * 0.05), f = 2600 + Math.random() * 1600;
    for (const [mul, amp] of [[1, 1], [2.71, 0.4]]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * mul; g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(vel * amp / (k + 1), tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.18); o.connect(g); g.connect(panned(A, ch, pan)); o.start(tt); o.stop(tt + 0.2); }
  }
}
/** A coin rolling down the rail: a fine metallic rattle. */
function roll(A, ch, t, dur, pan) {
  t = Math.max(0, t);
  const { ac } = A, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), am = ac.createOscillator(), ag = ac.createGain();
  s.buffer = A.whiteBuffer; f.type = 'bandpass'; f.frequency.setValueAtTime(3800, t); f.frequency.linearRampToValueAtTime(3200, t + dur); f.Q.value = 4;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.006, t + 0.05); g.gain.setValueAtTime(0.006, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur);
  am.frequency.setValueAtTime(18, t); am.frequency.linearRampToValueAtTime(30, t + dur); ag.gain.value = 0.004; am.connect(ag); ag.connect(g.gain);
  s.connect(f); f.connect(g); g.connect(panned(A, ch, pan)); s.start(t, Math.random()); s.stop(t + dur + 0.05); am.start(t); am.stop(t + dur + 0.05);
}

export function createPusherSong({ rng }) {
  const root = 55, deg = scaleOf(root, MAJOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 3, rest: [1, 3], align: 2 });
  let nextCoin = 4, nextAbsorb = 14, nextTease = 30, warm = 0;
  return makeComposer({
    rng, bpm: [58, 74], meter: 3, swing: 0, level: 1.8, verb: 0.8, delay: 0.75,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { water: 0.004, room: 0.018 }, { droneMidi: root - 24, drone: 0.006 }),
    step(S) {
      const { A, ch, t, tm, e, beatLen, sub, inBar, bar } = S;
      const barLen = beatLen * 3;
      // ---- the machine: the shelf's push, once a bar; the pile shuffling forward as it goes
      if (sub === 0 && inBar === 0) {
        A.emit('push', tm, { dur: barLen });
        noiseHit(A, ch.perc, t + barLen * 0.45, { vel: 0.006, type: 'bandpass', freq: 2800, q: 1.5, decay: 0.12 });
        if (rng() < 0.7) clink(A, ch.perc, t + barLen * 0.45 + rng() * 0.2, 0.004, (rng() - 0.5) * 0.6, 1 + Math.floor(rng() * 2));
        thud(A, ch.bass, t, 0.004, 60);
      }
      // a coin in: the slot, the rail, the landing
      if (tm >= nextCoin) {
        A.emit('coin', tm, {});
        clink(A, ch.perc, t, 0.012, 0.5, 1); thud(A, ch.perc, t + 0.02, 0.006, 300, 0.5);
        roll(A, ch.perc, t + 0.05, 0.75, 0.4);
        clink(A, ch.perc, t + 1.28, 0.014, 0.1, 3);
        warm++;
        nextCoin = tm + (4 + 14 * (1 - e)) * (0.7 + rng() * 0.6);
      }
      // the house's share: a coin slipping away into a side gutter
      if (tm >= nextAbsorb && warm > 2) {
        A.emit('absorb', tm, {});
        const side = rng() < 0.5 ? -0.7 : 0.7;
        clink(A, ch.perc, t, 0.008, side, 2); thud(A, ch.perc, t + 0.25, 0.008, 140, side); clink(A, ch.far, t + 0.3, 0.005, side, 3);
        nextAbsorb = tm + (5 + 16 * (1 - e)) * (0.7 + rng() * 0.6);
      }
      // the edge at its closest: a hopeful run up... and "nearly", back down
      if (tm >= nextTease && sub === 0 && inBar === 0) {
        A.emit('tease', tm, {});
        [0, 2, 4, 5, 7, 9, 11, 12].forEach((d, k) => bell(A, ch.arp, t + k * 0.09, deg(d) + 12, 0.008 + k * 0.001, -0.3 + k * 0.08, 1.2));
        vibes(A, ch.lead, t + 1.6, deg(4) + 12, 0.03, 0.1, 1.2); vibes(A, ch.lead, t + 2.2, deg(2) + 12, 0.026, 0.1, 2);
        nextTease = tm + 50 + rng() * 60;
      }
      // ---- the waltz
      const ci = Math.floor(bar / 2) % PROG.length, [br, voicing] = PROG[ci], notes = voicing.map((x) => root + x);
      if (sub === 0 && inBar === 0 && bar % 2 === 0) padChord(A, ch.pad, t, notes.map((m) => m - 12), barLen * 2, { vol: 0.005 + 0.002 * e, attack: 1.5, release: 3, cutoff: 1100, type: 'triangle' });
      if (sub === 0) {
        if (inBar === 0) bell(A, ch.bass, t, root - 12 + br, 0.02, 0, 3);
        else if (e > 0.3) epiano(A, ch.arp, t, notes[inBar] + 12, 0.008 + 0.004 * e, inBar === 1 ? -0.3 : 0.3, beatLen * 0.8);
      }
      tune.step(S, (d, len) => { bell(A, ch.lead, t, deg(d) + 24, 0.02 + 0.008 * e, (rng() - 0.5) * 0.4, 2.2); if (e > 0.5) vibes(A, ch.far, t, deg(d) + 12, 0.012, 0, len * S.eighth * 1.5); });
      // other machines, far off, playing to no one (fewer as the arcade empties)
      if (e > 0.35) S.every('jingle', 14, () => { const b = 72 + Math.floor(rng() * 8); [0, 4, 7, 12, 7, 4].forEach((x, k) => bell(A, ch.far, t + k * 0.08, b + x, 0.003, rng() < 0.5 ? -0.8 : 0.8, 0.4)); });
      S.every('sea', 9, () => swell(A, ch.night, t, { dur: 7, vel: 0.006, freq: 420, freq2: 300, q: 0.6, pan: 0.2 }));
    },
  });
}
