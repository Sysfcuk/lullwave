// Voices for the countryside worlds: a breathy folk flute, birdsong, an owl, hoofbeats on turf.
// Same conventions as voices.js: (A, ch, t, ...) with t in the chunk's own time.
import { mtof } from './voices.js';

function panned(A, ch, pan) {
  if (!pan) return ch.input;
  const p = A.ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(ch.input);
  return p;
}

/** A soft wooden flute: sine with a little second harmonic, a puff of breath at the start, gentle vibrato. */
export function flute(A, ch, t, m, dur, vel = 0.05, pan = 0, from = null) {
  t = Math.max(0, t);
  const { ac } = A, f = mtof(m), dest = panned(A, ch, pan);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.09);
  g.gain.setValueAtTime(vel * 0.9, t + Math.max(0.1, dur * 0.7));
  g.gain.linearRampToValueAtTime(0, t + dur + 0.25);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 5);
  lp.connect(g); g.connect(dest);
  const vib = ac.createOscillator(), vg = ac.createGain();
  vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(10, t + Math.min(0.8, dur));
  vib.connect(vg);
  for (const [ratio, amp] of [[1, 1], [2, 0.12], [3, 0.04]]) {
    const o = ac.createOscillator(), a = ac.createGain();
    o.frequency.setValueAtTime((from ? mtof(from) : f) * ratio, t);
    o.frequency.exponentialRampToValueAtTime(f * ratio, t + (from ? 0.1 : 0.001));
    a.gain.value = amp; vg.connect(o.detune);
    o.connect(a); a.connect(lp);
    o.start(t); o.stop(t + dur + 0.3);
  }
  // breath: a short burst of band-passed noise as the note speaks
  const n = ac.createBufferSource(); n.buffer = A.whiteBuffer;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.5;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(vel * 0.5, t); ng.gain.exponentialRampToValueAtTime(vel * 0.06, t + 0.12);
  ng.gain.linearRampToValueAtTime(0, t + dur);
  n.connect(bp); bp.connect(ng); ng.connect(dest);
  n.start(t, Math.random() * 2); n.stop(t + dur + 0.05);
  vib.start(t); vib.stop(t + dur + 0.3);
}

/**
 * A songbird phrase: a handful of quick whistled notes with swoops, like a blackbird or robin in
 * the evening. `rng` keeps it repeatable for the seed.
 */
export function bird(A, ch, t, rng, { vel = 0.03, pan = 0, base = 2200, notes = 0 } = {}) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan);
  const n = notes || 3 + Math.floor(rng() * 6);
  let at = t;
  for (let k = 0; k < n; k++) {
    const f0 = base * (0.7 + rng() * 0.9), f1 = f0 * (0.75 + rng() * 0.6), d = 0.05 + rng() * 0.16;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + d);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vel * (0.6 + rng() * 0.4), at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + d + 0.03);
    o.connect(g); g.connect(dest);
    o.start(at); o.stop(at + d + 0.05);
    at += d + 0.03 + rng() * 0.12;
  }
  return at - t;
}

/** A tawny owl far off: a soft low "hoo", a pause, then a wavering "hoo-oo-oo". */
export function owl(A, ch, t, { vel = 0.04, pan = 0 } = {}) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan);
  const hoot = (at, dur, f0, f1, wobble) => {
    const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    o.frequency.setValueAtTime(f0, at); o.frequency.linearRampToValueAtTime(f1, at + dur);
    if (wobble) { const w = ac.createOscillator(), wg = ac.createGain(); w.frequency.value = 9; wg.gain.value = 18; w.connect(wg); wg.connect(o.frequency); w.start(at); w.stop(at + dur + 0.1); }
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vel, at + 0.06); g.gain.setValueAtTime(vel, at + dur * 0.7); g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(lp); lp.connect(g); g.connect(dest);
    o.start(at); o.stop(at + dur + 0.05);
  };
  hoot(t, 0.7, 430, 400, false);
  hoot(t + 1.6, 1.3, 440, 380, true);
}

/** A hoof landing on turf: a low muffled thud with a little scuff of grass. */
export function hoof(A, ch, t, vel = 0.12, pan = 0) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan);
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.2);
  const n = ac.createBufferSource(); n.buffer = A.whiteBuffer;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const ng = ac.createGain(); ng.gain.setValueAtTime(vel * 0.35, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  n.connect(lp); lp.connect(ng); ng.connect(dest);
  n.start(t, Math.random() * 2); n.stop(t + 0.09);
}
