// Computer Says No's music: a soft 1980s synth lullaby (a warm analogue pad, a little plucked
// arpeggio, an electric piano tune) in the room with the computer itself. This is also where the
// conversation runs: it plays every key click as the questions are typed, the disk drive's motor
// and head steps as the computer thinks, its two-note "no" beep, the lamp switch, and tells the
// scene what's being typed and printed, so the screen and the sounds land together.
import { padChord, pluck, bass, epiano, noiseHit, mtof } from './voices.js';
import { panned } from './ambient.js';
import { thud, makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';
import { createTalk } from '../scenes/dream/nobot-talk.js';

/** A key going down: a plastic click and a soft thock (the space bar and RETURN are deeper). */
function keyClick(A, ch, t, c) {
  const big = c === ' ' || c === '\n';
  noiseHit(A, ch, t, { vel: (big ? 0.04 : 0.03) * (0.8 + Math.random() * 0.4), type: 'bandpass', freq: big ? 1400 : 2600 + Math.random() * 900, q: 1.2, decay: big ? 0.035 : 0.022, pan: 0.05 });
  thud(A, ch, t + 0.004, big ? 0.028 : 0.016, big ? 95 : 150 + Math.random() * 40, 0.05);
}
/** The disk drive thinking: the motor's hum and the head stepping back and forth. */
function drive(A, ch, t, dur) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, 0.25);
  const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.value = 48; lp.type = 'lowpass'; lp.frequency.value = 260;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.009, t + 0.15); g.gain.setValueAtTime(0.009, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.25);
  o.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.3);
  let k = t + 0.12;
  while (k < t + dur - 0.05) { // the head: little buzzy steps in runs
    const run = 2 + Math.floor(Math.random() * 6), f = 500 + Math.random() * 500;
    for (let i = 0; i < run && k < t + dur; i++, k += 0.035 + Math.random() * 0.012) {
      const s = ac.createOscillator(), bp = ac.createBiquadFilter(), sg = ac.createGain();
      s.type = 'square'; s.frequency.value = f; bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 3;
      sg.gain.setValueAtTime(0, k); sg.gain.linearRampToValueAtTime(0.01, k + 0.003); sg.gain.exponentialRampToValueAtTime(0.0001, k + 0.028);
      s.connect(bp); bp.connect(sg); sg.connect(dest); s.start(k); s.stop(k + 0.03);
    }
    k += 0.08 + Math.random() * 0.25;
  }
}
/** Its beep: two notes, down. */
function beep(A, ch, t, m, vel = 0.01) {
  t = Math.max(0, t);
  const { ac } = A;
  for (const [dt, mm] of [[0, m], [0.11, m - 5]]) {
    const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = mtof(mm); lp.type = 'lowpass'; lp.frequency.value = 1800;
    g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(vel, t + dt + 0.005); g.gain.setValueAtTime(vel, t + dt + 0.07); g.gain.linearRampToValueAtTime(0, t + dt + 0.1);
    o.connect(lp); lp.connect(g); g.connect(ch.input); o.start(t + dt); o.stop(t + dt + 0.12);
  }
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRASES = [
  [[4, 2], [2, 2], [4, 4], [7, 4], [5, 4]],
  [[2, 2], [4, 2], [5, 2], [4, 2], [2, 4], [0, 4]],
  [[7, 4], [6, 2], [4, 2], [2, 8]],
  [[0, 2], [4, 2], [7, 4], [9, 2], [7, 2], [4, 4]],
  [[9, 3], [7, 1], [5, 4], [4, 4], [2, 4]],
];
// two bars each, as semitones above F: Fmaj7, Am7, Bbmaj7, C(add9)
const PROG = [[0, [0, 4, 7, 11]], [4, [4, 7, 11, 14]], [5, [5, 9, 12, 16]], [-5, [7, 11, 14, 16]]];

export function createSaysNoSong({ rng }) {
  const root = 53, deg = scaleOf(root, MAJOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 4, rest: [1, 3], align: 2 });
  const talk = createTalk(rng);
  let queue = [], nextAt = 9, booted = false;
  return makeComposer({
    rng, bpm: [52, 68], meter: 4, swing: 0, level: 1.0, verb: 0.8, delay: 0.75,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { room: 0.02 }, { droneMidi: root - 24, drone: 0.007 }),
    step(S) {
      const { A, ch, t, tm, e, beatLen, eighth, sub, inBar, bar, step } = S;
      // switching on: the thunk of the tube warming, and its start-up beep
      if (!booted) { booted = true; thud(A, ch.perc, t, 0.02, 55); noiseHit(A, ch.perc, t + 0.02, { vel: 0.006, type: 'lowpass', freq: 400, decay: 0.6 }); beep(A, ch.perc, t + 1.9, root + 31, 0.006); }
      // ---- the music
      const ci = Math.floor(bar / 2) % PROG.length, [br, voicing] = PROG[ci], notes = voicing.map((x) => root + x);
      if (sub === 0 && inBar === 0 && bar % 2 === 0) {
        padChord(A, ch.pad, t, notes.map((m) => m - 12), beatLen * 8, { vol: 0.0045 + 0.0025 * e, attack: 2.5, release: 4, cutoff: 650 + 300 * e, type: 'sawtooth', voices: 2, spread: 9 });
        bass(A, ch.bass, t, root - 12 + br, beatLen * 3.5, 0.05 + 0.02 * e);
      }
      if (sub === 0 && inBar === 2 && bar % 2 === 1) bass(A, ch.bass, t, root - 12 + br + 7, beatLen * 1.8, 0.035);
      if (e > 0.32) { // a little plucked arpeggio, thinning out
        const order = [0, 1, 2, 3, 2, 1, 2, 1], m = notes[order[(inBar * 2 + sub) % 8]];
        if (sub === 0 || e > 0.55) pluck(A, ch.arp, t, m + 12, 0.008 * e, (inBar * 2 + sub) % 2 ? 0.3 : -0.3, { bright: 1500, decay: 0.4 });
      }
      tune.step(S, (d, len) => epiano(A, ch.lead, t, deg(d) + 12, 0.03 + 0.012 * e, (rng() - 0.5) * 0.3, len * eighth * 1.2));

      // ---- the conversation
      if (!queue.length && tm >= nextAt && !talk.ended) { const x = talk.next(e); queue = x.acts.map((a) => ({ ...a, at: a.at + tm })); nextAt = tm + x.len; }
      while (queue.length && queue[0].at < tm + eighth) {
        const a = queue.shift(), at = Math.max(tm, a.at), lt = t + (at - tm);
        if (a.type === 'key') { keyClick(A, ch.perc, lt, a.c); A.emit('key', at, { c: a.c }); }
        else if (a.type === 'think') { if (a.kind === 'disk') drive(A, ch.perc, lt, a.dur); A.emit('think', at, { dur: a.dur }); }
        else if (a.type === 'say') { if (a.text.includes('NO')) beep(A, ch.perc, lt + (a.text.indexOf('NO') + 1) / 40, root + 36 - (a.text.length > 20 ? 0 : 2), 0.014); A.emit('say', at, { text: a.text }); }
        else if (a.type === 'progress') { for (let i = 1; i <= 8; i++) noiseHit(A, ch.perc, lt + (a.dur * i) / 8, { vel: 0.004, type: 'bandpass', freq: 3200, q: 2, decay: 0.02 }); A.emit('progress', at, { dur: a.dur }); }
        else if (a.type === 'prompt') A.emit('prompt', at, {});
        else if (a.type === 'lamp') { noiseHit(A, ch.perc, lt, { vel: 0.03, type: 'highpass', freq: 2500, decay: 0.025, pan: -0.5 }); thud(A, ch.perc, lt, 0.012, 220, -0.5); A.emit('lamp', at, {}); }
        else if (a.type === 'sleep') A.emit('sleep', at, {});
      }
      void step;
    },
  });
}
