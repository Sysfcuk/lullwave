// Round and Round's music: it chooses each drawing (spiro-plan.js) and plays its gears. The pad
// holds the interval the gears make, tuned pure (a 3:2 ring and wheel is a fifth of exactly 3:2,
// a 15:8 a major seventh), under a soft music-box tune. A bell rings each time the pen reaches the
// tip of a petal, walking up the scale and back, panned to where the tip is, and the last one,
// as the curve closes, rings the interval itself. The pen whispers as it moves (louder where it
// sweeps fast round the outside, near silent where it turns), a fine high glitter chimes as the
// line catches the light, and each finished drawing melts away on a slow breath.
import { bell, padChord, swell, epiano } from './voices.js';
import { vibes, makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';
import { pickDrawing, drawingBars, penAt, closeAt } from '../scenes/dream/spiro-plan.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const WALK = [0, 2, 4, 7, 9, 12, 14, 16, 14, 12, 9, 7, 4, 2]; // the tips' bells: up the pentatonic and back
const ROOTS = [0, -3, 5, 7, 2, -5, 4, 0, 5, -3, 7, 2]; // each drawing's root, round the key of D
const PHRASES = [
  [[4, 3], [2, 1], [0, 4], [null, 4]],
  [[0, 2], [2, 2], [4, 4], [7, 4], [4, 4]],
  [[9, 3], [7, 1], [4, 4], [2, 6]],
  [[7, 2], [9, 2], [7, 2], [4, 2], [2, 4], [0, 4]],
  [[4, 2], [7, 4], [9, 2], [7, 4], [null, 4]],
];

export function createSpiroSong({ rng }) {
  const key = 50, deg = scaleOf(key, MAJOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 4, rest: [1, 3], align: 2, until: 0.32 });
  let draw = null, prev = null, nextStart = 0, ri = 0;
  const pending = [];
  const later = (when, fn) => pending.push({ when, fn });
  const P = { x: 0, y: 0 }, Q = { x: 0, y: 0 };
  return makeComposer({
    rng, bpm: [50, 64], meter: 4, swing: 0, level: 2, verb: 0.95, delay: 0.75,
    live: (ac, dest, t0) => liveBeds(ac, dest, t0, { room: 0.012 }),
    // the pen: a soft hiss of glitter on paper, its level and place following the pen
    setup(A, ch, from, to) {
      const { ac } = A, s = ac.createBufferSource(), f = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), g = ac.createGain(), p = ac.createStereoPanner();
      s.buffer = A.whiteBuffer; s.loop = true; f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.8; f2.type = 'highshelf'; f2.frequency.value = 8000; f2.gain.value = -10;
      g.gain.value = 0; s.connect(f); f.connect(f2); f2.connect(g); g.connect(p); p.connect(ch.perc.input);
      s.start(0); s.stop(to - from + 1);
      return { g, p };
    },
    step(S) {
      const { A, ch, t, tm, e, beatLen, eighth, sub, inBar, bar, extra } = S;
      const barLen = beatLen * 4;
      // ---- a new drawing: choose the gears, tell the scene, and set out its bells
      if (tm >= nextStart && sub === 0 && inBar === 0) {
        const dr = pickDrawing(rng, e, prev); prev = dr;
        const dur = drawingBars(dr, e) * barLen * dr.petals;
        const root = key + ROOTS[ri++ % ROOTS.length];
        draw = { dr, t0: tm, dur, root, iv: 12 * Math.log2(dr.R / dr.r) };
        A.emit('spiro', tm, { dr, dur });
        const P1 = dr.petals, step = dur / P1, w0 = Math.floor(rng() * WALK.length);
        for (let k = 0; k <= P1; k++) {
          const ang = (k / P1) * closeAt(dr) + dr.rot, pan = 0.6 * Math.cos(ang), last = k === P1;
          later(tm + k * step, (tt) => {
            if (last) { // the curve closes on the interval itself
              bell(A, ch.lead, tt, root + 24, 0.018, -0.2, 5); bell(A, ch.lead, tt + 0.05, root + 24 + draw.iv, 0.016, 0.2, 5);
              vibes(A, ch.far, tt + 0.1, root + 36, 0.012, 0, 3);
            } else bell(A, ch.arp, tt, deg(0) - key + root + 24 + WALK[(w0 + k) % WALK.length], 0.014 + 0.006 * e, pan, 3.5);
          });
        }
        // and when it's done it melts into the background, on a slow breath out
        later(tm + dur + 3, (tt) => swell(A, ch.night, tt, { dur: 11, vel: 0.007, freq: 1400, freq2: 380, q: 0.7, pan: -0.2, pan2: 0.2 }));
        nextStart = tm + dur + 7;
      }
      // things scheduled to land between eighth notes (the tips' bells, the melt)
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].when < tm + eighth) { const it = pending.splice(i, 1)[0]; it.fn(t + Math.max(0, it.when - tm)); }
      const live = draw && tm < draw.t0 + draw.dur;
      // ---- the pen, by speed: the curve's rate of travel at this moment
      if (extra) {
        let lvl = 0, pan = 0;
        if (live) {
          const { dr } = draw, th = ((tm - draw.t0) / draw.dur) * closeAt(dr), dth = closeAt(dr) / draw.dur * 0.05;
          penAt(dr, th, P); penAt(dr, th + dth, Q);
          const s = 1 / ((dr.R - dr.r) + dr.d), speed = Math.hypot(Q.x - P.x, Q.y - P.y) * s / 0.05;
          lvl = Math.min(1, speed / 0.6) * 0.004 * (0.45 + 0.55 * e);
          pan = Math.max(-0.7, Math.min(0.7, (P.x * Math.cos(dr.rot) - P.y * Math.sin(dr.rot)) * s));
        }
        extra.g.gain.setTargetAtTime(lvl, t, 0.12); extra.p.pan.setTargetAtTime(pan, t, 0.2);
      }
      // the line catching the light: a fine high glitter
      if (live) S.every('glint', 5 + 6 * (1 - e), () => {
        A.emit('glint', tm, {});
        for (let k = 0; k < 3; k++) bell(A, ch.far, t + k * (0.05 + rng() * 0.05), 98 + Math.floor(rng() * 9), 0.0025 / (k + 1), (rng() - 0.5) * 1.2, 0.8);
      });

      // ---- the pad: the gears' interval, tuned pure, over its root
      const root = draw ? draw.root : key, iv = draw ? draw.iv : 7.02;
      if (sub === 0 && inBar === 0 && bar % 2 === 0) {
        padChord(A, ch.pad, t, [root, root + iv, root + 12], barLen * 2, { vol: 0.0045 + 0.0025 * e, attack: 2.5, release: 4, cutoff: 900 + 500 * e, type: 'sine', spread: 4 });
        padChord(A, ch.pad, t, [root - 12], barLen * 2, { vol: 0.004, attack: 3, release: 4, cutoff: 400, type: 'triangle', voices: 1 });
        bell(A, ch.bass, t, root - 12, 0.012, 0, 4);
      }
      if (sub === 0 && inBar === 2 && e > 0.4 && rng() < 0.5) epiano(A, ch.arp, t, root + 12 + [0, 4, 7][Math.floor(rng() * 3)], 0.006 + 0.004 * e, (rng() - 0.5) * 0.6, beatLen * 1.5);
      // ---- the music box
      tune.step(S, (d, len) => { bell(A, ch.lead, t, deg(d) + 24 + (root - key), 0.012 + 0.006 * e, (rng() - 0.5) * 0.4, 2.4); });
    },
  });
}
