// The Sleeper Train's music: the rails are the rhythm. Each beat is one rail length, so the wheels
// cross a joint on every beat: the rear bogie of the carriage ahead, then our front bogie, the
// clickety-clack, while the train rumbles underneath. Over it, a night-train lullaby in D: soft
// electric-piano chords, a round bass, a clarinet tune; a distant whistle now and then, and the
// cup rattling on its saucer. The scene takes its speed from the beat, and its bumps from the clacks.
import { padChord, bass, epiano, noiseHit, mtof } from './voices.js';
import { panned } from './ambient.js';
import { thud, clarinet, makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';

/** A wheel over a rail joint: a metallic knock with a thump under it. */
function clack(A, ch, t, vel, pan = 0, ring = true) {
  t = Math.max(0, t);
  noiseHit(A, ch, t, { vel, type: 'bandpass', freq: 1300 + Math.random() * 500, q: 1.6, decay: 0.05, pan });
  thud(A, ch, t, vel * 0.9, 70 + Math.random() * 15, pan);
  if (!ring) return;
  const { ac } = A, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = 2100 + Math.random() * 400; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.08, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g); g.connect(panned(A, ch, pan)); o.start(t); o.stop(t + 0.1);
}
/** The engine's whistle, far up the train: two soft reedy notes, swelling and fading. */
function whistle(A, ch, t, m, dur = 1.6, vel = 0.01) {
  t = Math.max(0, t);
  const { ac } = A, lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 1500;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.25); g.gain.setValueAtTime(vel, t + dur - 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
  lp.connect(g); g.connect(panned(A, ch, 0.6));
  for (const [mm, d] of [[m, -6], [m + 4, 5], [m + 7, 0]]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(mm); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
}
/** The cup on its saucer. */
function clink(A, ch, t) {
  t = Math.max(0, t);
  const { ac } = A;
  for (let k = 0; k < 3; k++) {
    const o = ac.createOscillator(), g = ac.createGain(), tt = t + k * 0.07 + Math.random() * 0.02;
    o.frequency.value = 3400 + Math.random() * 600; g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.004 / (k + 1), tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.15);
    o.connect(g); g.connect(panned(A, ch, 0.2)); o.start(tt); o.stop(tt + 0.16);
  }
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRASES = [
  [[4, 3], [2, 1], [4, 2], [7, 4], [6, 2], [4, 4]],
  [[2, 2], [4, 2], [5, 4], [4, 2], [2, 2], [0, 4]],
  [[7, 4], [9, 2], [7, 2], [4, 6], [2, 2]],
  [[0, 2], [2, 2], [4, 2], [5, 2], [7, 6], [4, 2]],
  [[9, 3], [8, 1], [7, 2], [4, 2], [5, 4], [4, 4]],
];
// two bars each, semitones above D: Dmaj7, Bm7, Gmaj7, A(sus4)
const PROG = [[0, [0, 4, 7, 11]], [-3, [2, 4, 7, 9]], [-7, [2, 5, 9, 11]], [-5, [2, 7, 9, 14]]];

export function createTrainSong({ rng }) {
  const root = 50, deg = scaleOf(root, MAJOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 4, rest: [1, 3], align: 2 });
  return makeComposer({
    rng, bpm: [54, 74], meter: 4, swing: 0.08, level: 0.82, verb: 0.7, delay: 0.75,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { room: 0.05, wind: 0.01 }, { droneMidi: root - 24, drone: 0.006 }),
    step(S) {
      const { A, ch, t, tm, e, beatLen, sub, inBar, bar } = S;
      // ---- the rails: a joint every beat
      if (sub === 0) {
        A.emit('rail', tm, { beat: beatLen });
        const v = 0.022 * (0.85 + 0.15 * e);
        for (const [f, vel, pan] of [[0, 1, 0.15], [0.144, 1.1, 0.15], [0.778, 0.75, -0.1], [0.922, 0.8, -0.1]]) clack(A, ch.perc, t + f * beatLen, v * vel * (0.9 + rng() * 0.2), pan, vel > 1);
        A.emit('clack', tm, { vel: 1 }); A.emit('clack', tm + 0.778 * beatLen, { vel: 0.7 });
      }
      // ---- the lullaby
      const ci = Math.floor(bar / 2) % PROG.length, [br, voicing] = PROG[ci], notes = voicing.map((x) => root + x);
      if (sub === 0 && inBar === 0 && bar % 2 === 0) {
        padChord(A, ch.pad, t, notes.map((m) => m - 12), beatLen * 8, { vol: 0.004 + 0.002 * e, attack: 2.5, release: 4, cutoff: 900, type: 'triangle', voices: 2, spread: 6 });
        A.emit('chord', tm, { index: ci });
      }
      if (sub === 0 && (inBar === 0 || inBar === 2)) bass(A, ch.bass, t, root - 12 + br + (inBar === 2 ? 7 : 0), beatLen * 1.6, 0.05 + 0.02 * e);
      if (e > 0.3 && sub === 0 && inBar === (bar % 2 ? 3 : 1)) for (const m of notes.slice(1)) epiano(A, ch.arp, t + rng() * 0.02, m, 0.008 + 0.006 * e, (rng() - 0.5) * 0.4, beatLen * 0.9);
      tune.step(S, (d, len) => clarinet(A, ch.lead, t, deg(d) + 12, len * S.eighth * 0.95, 0.024 + 0.01 * e, (rng() - 0.5) * 0.3));
      // ---- now and then
      S.every('whistle', 80, () => { whistle(A, ch.far, t, root + 19 + (rng() < 0.5 ? 0 : 2), 1.4 + rng(), 0.006 + 0.004 * e); A.emit('whistle', S.tm, {}); });
      S.every('clink', 17, () => { clink(A, ch.night, t); A.emit('clink', S.tm, {}); });
    },
  });
}
