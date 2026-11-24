// Small synth voices shared by the scene composers. Every note is a handful of Web Audio nodes
// that are started at a scheduled time and stopped (then garbage collected) after their release.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/**
 * A channel strip: an input that feeds the dry mix and, through fixed send levels, the shared
 * reverb and delay. Notes connect to `ch.input` (through their own panner when they pan).
 */
export function channel(A, { gain = 1, verb = 0.3, delay = 0 } = {}) {
  const { ac } = A;
  const input = ac.createGain();
  const level = ac.createGain(); level.gain.value = gain;
  input.connect(level); level.connect(A.dry);
  if (verb) { const s = ac.createGain(); s.gain.value = verb; level.connect(s); s.connect(A.verb); }
  if (delay) { const s = ac.createGain(); s.gain.value = delay; level.connect(s); s.connect(A.delay); }
  return { input, level };
}

function panned(A, ch, pan) {
  if (!pan) return ch.input;
  const p = A.ac.createStereoPanner(); p.pan.value = pan; p.connect(ch.input);
  return p;
}

/** A glassy bell: a few inharmonic sine partials, the upper ones dying away first. */
export function bell(A, ch, t, m, vel = 0.2, pan = 0, decay = 5) {
  const { ac } = A, f = mtof(m), dest = panned(A, ch, pan);
  const parts = [[1, 1, 1], [2, 0.3, 0.55], [2.76, 0.22, 0.4], [5.4, 0.07, 0.2], [8.93, 0.03, 0.1]];
  for (const [ratio, amp, life] of parts) {
    if (f * ratio > Math.min(15000, ac.sampleRate * 0.45)) continue;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f * ratio * (1 + (Math.random() - 0.5) * 0.002);
    const d = decay * life;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * amp, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, d / 4);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + d + 0.1);
  }
}

/** A water drip: a short sine whose pitch bends upward as it dies (the "bloop" of a drop). */
export function drip(A, ch, t, f, vel = 0.12, pan = 0) {
  const { ac } = A, dest = panned(A, ch, pan);
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.07);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + 0.12);
}

/**
 * A pad chord: every note is a pair (or more) of slightly detuned oscillators, all through one
 * lowpass, with a slow swell in and out. Returns the filter so a composer can sweep it.
 */
export function padChord(A, ch, t, notes, dur, opts = {}) {
  const { ac } = A;
  const { type = 'triangle', voices = 2, spread = 8, attack = 3, release = 4, vol = 0.05, cutoff = 1200, q = 0.5, wobble = null } = opts;
  const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = q;
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + attack);
  env.gain.setValueAtTime(vol, t + Math.max(attack, dur));
  env.gain.linearRampToValueAtTime(0, t + Math.max(attack, dur) + release);
  filter.connect(env); env.connect(ch.input);
  const end = t + Math.max(attack, dur) + release + 0.1;
  for (const m of notes) {
    for (let v = 0; v < voices; v++) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = mtof(m);
      o.detune.value = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * 2 * spread + (Math.random() - 0.5) * 3;
      if (wobble) wobble.connect(o.detune); // chunks are offline and thrown away whole, so no cleanup needed
      o.connect(filter);
      o.start(t); o.stop(end);
    }
  }
  return filter;
}

/** A soft pluck: triangle plus a quiet square, through a lowpass that closes quickly. */
export function pluck(A, ch, t, m, vel = 0.1, pan = 0, { bright = 2400, decay = 0.35 } = {}) {
  const { ac } = A, f = mtof(m), dest = panned(A, ch, pan);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
  lp.frequency.setValueAtTime(bright, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.2), t + decay);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.005);
  g.gain.setTargetAtTime(0, t + 0.005, decay / 2.5);
  lp.connect(g); g.connect(dest);
  for (const [type, amp] of [['triangle', 1], ['square', 0.25]]) {
    const o = ac.createOscillator(), a = ac.createGain();
    o.type = type; o.frequency.value = f; a.gain.value = amp;
    o.connect(a); a.connect(lp);
    o.start(t); o.stop(t + decay * 3);
  }
}

/** A round bass note: sine plus a little triangle, lowpassed. */
export function bass(A, ch, t, m, dur, vel = 0.2) {
  const { ac } = A, f = mtof(m);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.02);
  g.gain.setTargetAtTime(vel * 0.7, t + 0.02, 0.3);
  g.gain.setTargetAtTime(0, t + dur, 0.08);
  lp.connect(g); g.connect(ch.input);
  for (const [type, amp] of [['sine', 1], ['triangle', 0.35]]) {
    const o = ac.createOscillator(), a = ac.createGain();
    o.type = type; o.frequency.value = f; a.gain.value = amp;
    o.connect(a); a.connect(lp);
    o.start(t); o.stop(t + dur + 0.6);
  }
}

/** A hollow lead: a filtered square with a delayed vibrato, gliding from the previous note. */
export function lead(A, ch, t, m, dur, vel = 0.06, from = null) {
  const { ac } = A, f = mtof(m);
  const o = ac.createOscillator(), o2 = ac.createOscillator();
  o.type = 'square'; o2.type = 'sawtooth'; o2.detune.value = 7;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 1;
  const g = ac.createGain(), g2 = ac.createGain(); g2.gain.value = 0.4;
  const start = from ? mtof(from) : f;
  for (const osc of [o, o2]) {
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + (from ? 0.12 : 0.001));
  }
  const vib = ac.createOscillator(), vg = ac.createGain();
  vib.frequency.value = 4.8;
  vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(9, t + Math.min(0.9, dur));
  vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.08);
  g.gain.setValueAtTime(vel, t + dur);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.5);
  o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(ch.input);
  const end = t + dur + 0.6;
  for (const osc of [o, o2, vib]) { osc.start(t); osc.stop(end); }
}

/** A soft kick: a sine dropping in pitch. */
export function kick(A, ch, t, vel = 0.3) {
  const { ac } = A;
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  o.connect(g); g.connect(ch.input);
  o.start(t); o.stop(t + 0.4);
}

/** A noise hit (hat, rim, brush), shaped by a filter. */
export function noiseHit(A, ch, t, { vel = 0.05, type = 'highpass', freq = 7000, q = 0.7, decay = 0.05, pan = 0 } = {}) {
  const { ac } = A, dest = panned(A, ch, pan);
  const s = ac.createBufferSource(); s.buffer = A.whiteBuffer;
  s.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  s.connect(f); f.connect(g); g.connect(dest);
  const off = Math.random() * (A.whiteBuffer.duration - 1);
  s.start(t, off); s.stop(t + decay + 0.02);
}

/** A slow swell of filtered noise: wind through the cave, a car passing in the night. */
export function swell(A, ch, t, { dur = 10, vel = 0.05, freq = 500, freq2 = null, q = 1, pan = 0, pan2 = null } = {}) {
  const { ac } = A;
  const s = ac.createBufferSource(); s.buffer = A.whiteBuffer; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  const p = ac.createStereoPanner();
  p.pan.setValueAtTime(pan, t);
  if (pan2 !== null) p.pan.linearRampToValueAtTime(pan2, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + dur * 0.45);
  g.gain.linearRampToValueAtTime(0, t + dur);
  s.connect(f); f.connect(g); g.connect(p); p.connect(ch.input);
  s.start(t, Math.random() * 2); s.stop(t + dur + 0.1);
}

/**
 * Whale song: a breathy sine-and-triangle voice through a resonant band, rising then sinking
 * in a long slow moan, with a vibrato that comes in as it sustains.
 */
export function whale(A, ch, t, m, dur = 6, vel = 0.06, pan = 0) {
  const { ac } = A, f = mtof(m), dest = panned(A, ch, pan);
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + dur * 0.25);
  g.gain.setValueAtTime(vel, t + dur * 0.6);
  g.gain.linearRampToValueAtTime(0, t + dur);
  bp.connect(lp); lp.connect(g); g.connect(dest);
  const vib = ac.createOscillator(), vg = ac.createGain();
  vib.frequency.value = 2.7;
  vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(22, t + dur * 0.5);
  vib.connect(vg);
  for (const [type, amp, det] of [['sine', 1, 0], ['triangle', 0.5, 6]]) {
    const o = ac.createOscillator(), a = ac.createGain();
    o.type = type; o.detune.value = det; a.gain.value = amp;
    o.frequency.setValueAtTime(f * 0.82, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.22, t + dur * 0.38);
    o.frequency.exponentialRampToValueAtTime(f * 0.68, t + dur);
    vg.connect(o.detune);
    o.connect(a); a.connect(bp);
    o.start(t); o.stop(t + dur + 0.1);
  }
  bp.frequency.setValueAtTime(f * 1.6, t);
  bp.frequency.exponentialRampToValueAtTime(f * 2.4, t + dur * 0.4);
  bp.frequency.exponentialRampToValueAtTime(f * 1.2, t + dur);
  vib.start(t); vib.stop(t + dur + 0.1);
}
