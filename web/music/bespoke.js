// Shared machinery for the hand-written scene composers (market, choir, pizza, fever, canal,
// penny): a scheduler that steps through eighth notes with the night's slowing tempo, a player
// for composed tunes, continuous beds of place-sound, and a few instruments of their own.
import { channel, mtof } from './voices.js';
import { panned } from './ambient.js';

// ------------------------------------------------------------------ instruments
/** A steel pan: a bright, slightly inharmonic ping with a little drop in pitch as it's struck. */
export function steelpan(A, ch, t, m, vel = 0.05, pan = 0, bend = null) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan), f = mtof(m);
  for (const [mul, amp, dec] of [[1, 1, 1.3], [2.01, 0.55, 0.8], [3.02, 0.18, 0.4], [4.1, 0.08, 0.2]]) {
    if (f * mul > ac.sampleRate * 0.45) continue;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(f * mul * 1.012, t); o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.06);
    if (bend) bend.connect(o.detune);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * amp, t + 0.005); g.gain.setTargetAtTime(0, t + 0.005, dec / 3);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dec * 1.6);
  }
}
/** A vibraphone: soft mallet sine with a little fourth partial and the motor's slow tremolo. */
export function vibes(A, ch, t, m, vel = 0.05, pan = 0, dur = 2) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan), f = mtof(m);
  const out = ac.createGain(), trem = ac.createOscillator(), tg = ac.createGain();
  out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(vel, t + 0.004); out.gain.setTargetAtTime(0, t + 0.004, Math.min(dur, 2.2) / 2.5);
  trem.frequency.value = 5.5; tg.gain.value = vel * 0.25; trem.connect(tg); tg.connect(out.gain);
  out.connect(dest);
  const end = t + Math.min(dur, 2.2) * 2;
  for (const [mul, amp] of [[1, 1], [4, 0.12]]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * mul; g.gain.value = amp; o.connect(g); g.connect(out); o.start(t); o.stop(end); }
  trem.start(t); trem.stop(end);
}
/** A clarinet, far off: a mellow filtered square with a gentle swell and a little vibrato. */
export function clarinet(A, ch, t, m, dur, vel = 0.04, pan = 0, from = null) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan), f = mtof(m);
  const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain(), vib = ac.createOscillator(), vg = ac.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(from ? mtof(from) : f, t); o.frequency.exponentialRampToValueAtTime(f, t + (from ? 0.07 : 0.001));
  lp.type = 'lowpass'; lp.frequency.value = Math.min(2400, f * 3.2); lp.Q.value = 0.6;
  vib.frequency.value = 4.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(8, t + Math.min(0.8, dur)); vib.connect(vg); vg.connect(o.detune);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.09); g.gain.setValueAtTime(vel, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.35);
  o.connect(lp); lp.connect(g); g.connect(dest);
  for (const x of [o, vib]) { x.start(t); x.stop(t + dur + 0.4); }
}
/** A short squeeze of accordion: a chord of reedy detuned squares, in and out. */
export function squeeze(A, ch, t, notes, dur, vel = 0.012, pan = 0) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan);
  const lp = ac.createBiquadFilter(), g = ac.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.8;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.05); g.gain.setValueAtTime(vel, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.12);
  lp.connect(g); g.connect(dest);
  for (const m of notes) for (const d of [-6, 6]) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.15); }
}
/** A soft thud: dough on the board, a paw on the rug, a log settling. */
export function thud(A, ch, t, vel = 0.03, freq = 90, pan = 0) {
  t = Math.max(0, t);
  const { ac } = A, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g); g.connect(panned(A, ch, pan)); o.start(t); o.stop(t + 0.2);
}
/** A tiny sleepy mew. */
export function mew(A, ch, t, vel = 0.012, pan = 0) {
  t = Math.max(0, t);
  const { ac } = A, o = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(860, t + 0.12); o.frequency.linearRampToValueAtTime(560, t + 0.45);
  bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2.5;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.06); g.gain.linearRampToValueAtTime(0, t + 0.5);
  o.connect(bp); bp.connect(g); g.connect(panned(A, ch, pan)); o.start(t); o.stop(t + 0.55);
}
/** A pitch glide: the bounce of a pineapple, a boing. */
export function boing(A, ch, t, m, vel = 0.03, pan = 0) {
  t = Math.max(0, t);
  const { ac } = A, f = mtof(m), o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(f * 0.7, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.18); o.frequency.exponentialRampToValueAtTime(f, t + 0.5);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.01); g.gain.setTargetAtTime(0, t + 0.01, 0.15);
  o.connect(g); g.connect(panned(A, ch, pan)); o.start(t); o.stop(t + 0.7);
}

// ------------------------------------------------------------------ beds of place-sound
/**
 * Continuous sound for the whole session: a low drone and whichever beds the place has.
 * wind, water, fire, murmur, room, purr, lap (water against a hull), engine (a narrowboat's slow putter).
 */
export function liveBeds(ac, dest, t0, beds = {}, { droneMidi = null, drone = 0.03 } = {}) {
  const stops = [];
  const g = ac.createGain(); g.gain.value = 0; g.connect(dest);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + 10);
  if (droneMidi != null && drone) { const o = ac.createOscillator(), dg = ac.createGain(); o.frequency.value = mtof(droneMidi); dg.gain.value = drone; o.connect(dg); dg.connect(g); o.start(t0); stops.push(o); }
  const noise = (() => { const n = ac.sampleRate * 4, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); let br = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; br = (br + 0.02 * w) / 1.02; d[i] = i % 2 ? w : br * 3.5; } return b; })();
  const bed = (lvl, type, freq, q, lfoRate, lfoDepth, fmod = 0) => {
    if (!lvl) return;
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const gg = ac.createGain(); gg.gain.value = lvl;
    const l = ac.createOscillator(), la = ac.createGain(); l.frequency.value = lfoRate; la.gain.value = lvl * lfoDepth; l.connect(la); la.connect(gg.gain);
    if (fmod) { const fa = ac.createGain(); fa.gain.value = fmod; l.connect(fa); fa.connect(f.frequency); }
    s.connect(f); f.connect(gg); gg.connect(g);
    s.start(t0, Math.random() * 3); l.start(t0); stops.push(s, l);
  };
  bed(beds.wind, 'lowpass', 600, 0.6, 0.05, 0.6, 300);
  bed(beds.water, 'bandpass', 900, 0.8, 0.27, 0.4, 350);
  bed(beds.lap, 'bandpass', 420, 1.2, 0.45, 0.9, 160); // little waves against the hull
  bed(beds.fire, 'lowpass', 300, 0.7, 0.4, 0.5);
  bed(beds.murmur, 'bandpass', 520, 1.6, 0.6, 0.7, 180);
  bed(beds.room, 'lowpass', 220, 0.5, 0.03, 0.3);
  if (beds.purr) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const gg = ac.createGain(); gg.gain.value = 0;
    const am = ac.createOscillator(), aa = ac.createGain(); am.frequency.value = 25; aa.gain.value = beds.purr; am.connect(aa); aa.connect(gg.gain);
    const br = ac.createOscillator(), ba = ac.createGain(); br.frequency.value = 0.35; ba.gain.value = beds.purr * 0.5; br.connect(ba); ba.connect(gg.gain);
    s.connect(f); f.connect(gg); gg.connect(g); for (const x of [s, am, br]) x.start(t0); stops.push(s, am, br);
  }
  if (beds.engine) { // a narrowboat's engine, far off: a low thump at about two beats a second
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), gg = ac.createGain(), am = ac.createOscillator(), aa = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 42; f.type = 'lowpass'; f.frequency.value = 140; gg.gain.value = beds.engine * 0.5;
    am.type = 'square'; am.frequency.value = 2.1; aa.gain.value = beds.engine * 0.5; am.connect(aa); aa.connect(gg.gain);
    o.connect(f); f.connect(gg); gg.connect(g); for (const x of [o, am]) x.start(t0); stops.push(o, am);
  }
  return { stop(t) { for (const s of stops) { try { s.stop(t + 0.05); } catch { /* fine */ } } } };
}

// ------------------------------------------------------------------ the scheduler
/**
 * Build a composer from a step function. `step(S)` is called for every eighth note with
 * S = { A, ch, t, ts, tm, e, beatLen, eighth, step, beat, sub, bar, inBar, every }, where t is the time
 * in this chunk, ts the same nudged late on swung offbeats, and ch the shared channels.
 */
export function makeComposer({ rng, bpm: [lo, hi], meter = 4, swing = 0, level = 1, delay = 0.75, verb = 0.6, live, step, setup }) {
  const bpm = (e) => lo + (hi - lo) * e;
  let next = 0, n = 0;
  const nextAt = {};
  return {
    level,
    delayTime: (60 / bpm(1)) * delay,
    live,
    chunk(A, from, to, energyAt) {
      const ch = {
        pad: channel(A, { verb, delay: 0.04 }),
        lead: channel(A, { verb: verb * 0.9, delay: 0.25 }),
        arp: channel(A, { verb: verb * 0.7, delay: 0.1 }),
        bass: channel(A, { verb: 0.15 }),
        perc: channel(A, { verb: 0.25 }),
        night: channel(A, { verb: 0.35 }),
        far: channel(A, { gain: 0.8, verb: 1.1 }),
      };
      const extra = setup ? setup(A, ch, from, to) : null;
      if (next < from) next = from; // a skipped chunk: carry on from here rather than pile up
      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
        const beatLen = 60 / bpm(e), eighth = beatLen / 2;
        const beat = Math.floor(n / 2), sub = n % 2;
        const S = {
          A, ch, extra, t, tm, e, beatLen, eighth, step: n, beat, sub, bar: Math.floor(beat / meter), inBar: beat % meter,
          ts: sub ? t + swing * eighth : t,
          every(key, gap, fn) { // a sound that happens now and then, at its own unhurried pace
            if (!(key in nextAt)) nextAt[key] = tm + gap * (0.3 + rng() * 0.7);
            if (tm >= nextAt[key]) { fn(); nextAt[key] = tm + gap * (0.6 + rng() * 0.8); }
          },
        };
        step(S);
        n++;
        next += eighth;
      }
    },
  };
}

/**
 * Plays composed phrases: [[degree, eighths], ...] (degree null for a rest). Starts a phrase on a
 * bar line (every `align` bars, so it sits with the chords), then rests a bar or two before the next, so the tune breathes.
 */
export function tunePlayer(rng, phrases, { meter = 4, rest = [1, 2], until = 0.3, align = 1 } = {}) {
  let cur = null, i = 0, wait = 0, restBars = 0, lastPhrase = -1;
  return {
    get playing() { return !!cur; },
    step(S, play) {
      if (!cur && S.sub === 0 && S.inBar === 0 && S.bar % align === 0) {
        if (restBars > 0) restBars -= align;
        else if (S.e > until) {
          let k = Math.floor(rng() * phrases.length); if (k === lastPhrase) k = (k + 1) % phrases.length;
          lastPhrase = k; cur = phrases[k]; i = 0; wait = 0;
        }
      }
      if (!cur) return;
      if (wait === 0) {
        const [d, len] = cur[i];
        if (d != null) play(d, len, i === 0, i === cur.length - 1);
        wait = len; i++;
      }
      wait--;
      if (wait === 0 && i >= cur.length) { cur = null; restBars = rest[0] + Math.floor(rng() * (rest[1] - rest[0] + 1)); }
    },
  };
}

/** A scale lookup: degree → midi, any number of octaves up or down. */
export function scaleOf(root, steps) {
  const L = steps.length;
  return (d) => root + Math.floor(d / L) * 12 + steps[((d % L) + L) % L];
}
