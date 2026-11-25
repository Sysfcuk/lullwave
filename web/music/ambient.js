// The ambient composer for the dream worlds: one engine, a profile per scene. A profile sets
// the key and mode, tempo, the pad, a lead voice that wanders through a new little tune each
// time (never the same twice), and a bed of sounds for the place itself: crickets, owls, wind,
// water, a fire, a pub's murmur, footsteps, horses, ducks, a purring cat. Everything quiet and
// slow, and it all thins out as the night goes on.
import { channel, padChord, pluck, bell, epiano, choir, swell, noiseHit, bass, kick, pick, mtof } from './voices.js';
import { flute, bird, owl } from './nature.js';

const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9], wholetone: [0, 2, 4, 6, 8, 10],
};
// chord roots as scale degrees, per mode family
const PROGS = {
  major: [[0, 5, 3, 4], [0, 3, 5, 4], [3, 0, 4, 5], [0, 4, 5, 3]],
  dorian: [[0, 3, 0, 6], [0, 6, 3, 0], [0, 2, 3, 4]],
  lydian: [[0, 1, 0, 5], [0, 1, 4, 3]],
  mixolydian: [[0, 6, 3, 0], [0, 3, 6, 4]],
  minor: [[0, 5, 2, 6], [0, 3, 5, 4]],
  pentatonic: [[0, 3, 1, 4], [0, 2, 3, 1], [0, 4, 3, 1]],
  wholetone: [[0, 1, 0, 4], [0, 2, 1, 3]],
};

// ------------------------------------------------------------------ small sounds of the night
function panned(A, ch, pan) { if (!pan) return ch.input; const p = A.ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(ch.input); return p; }

/** A cricket: a few quick bright chirps. */
function cricket(A, ch, t, { vel = 0.012, pan = 0, f = 4300 } = {}) {
  const { ac } = A, dest = panned(A, ch, pan);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let k = 0; k < n; k++) {
    const at = t + k * 0.075, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f * (0.98 + Math.random() * 0.04);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vel, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    o.connect(g); g.connect(dest); o.start(at); o.stop(at + 0.06);
  }
}
/** A horse breathing out: a soft fluttering snort. */
function snort(A, ch, t, { vel = 0.05, pan = 0 } = {}) {
  const { ac } = A, dest = panned(A, ch, pan);
  const s = ac.createBufferSource(); s.buffer = A.whiteBuffer;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(350, t + 0.6);
  const g = ac.createGain(), flut = ac.createOscillator(), fg = ac.createGain();
  flut.frequency.value = 26; fg.gain.value = vel * 0.4; flut.connect(fg); fg.connect(g.gain);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  s.connect(bp); bp.connect(g); g.connect(dest);
  s.start(t, Math.random() * 2); s.stop(t + 0.75); flut.start(t); flut.stop(t + 0.75);
}
/** A low, gentle nicker. */
function nicker(A, ch, t, { vel = 0.035, pan = 0 } = {}) {
  const { ac } = A, dest = panned(A, ch, pan);
  const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter(), am = ac.createOscillator(), ag = ac.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(115, t); o.frequency.linearRampToValueAtTime(95, t + 0.9);
  lp.type = 'lowpass'; lp.frequency.value = 600;
  am.frequency.value = 9; ag.gain.value = vel * 0.6; am.connect(ag); ag.connect(g.gain);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.1); g.gain.linearRampToValueAtTime(0, t + 0.95);
  o.connect(lp); lp.connect(g); g.connect(dest);
  for (const x of [o, am]) { x.start(t); x.stop(t + 1); }
}
/** A sleepy duck: one soft, muffled quack. */
function quack(A, ch, t, { vel = 0.025, pan = 0 } = {}) {
  const { ac } = A, dest = panned(A, ch, pan);
  const o = ac.createOscillator(), g = ac.createGain(), bp = ac.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.16);
  bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 3;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(bp); bp.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.22);
}
/** A footstep: on gravel (crunch) or snow (a soft squeak). */
function footstep(A, ch, t, { vel = 0.03, pan = 0, surface = 'gravel' } = {}) {
  noiseHit(A, ch, t, { vel, type: surface === 'snow' ? 'bandpass' : 'highpass', freq: surface === 'snow' ? 1800 : 2500, q: surface === 'snow' ? 2 : 0.7, decay: surface === 'snow' ? 0.14 : 0.09, pan });
  noiseHit(A, ch, t + 0.01, { vel: vel * 0.8, type: 'lowpass', freq: 400, decay: 0.06, pan });
}
/** A log settling in the fire: a few tiny crackles. */
function crackle(A, ch, t, { vel = 0.02, pan = 0 } = {}) {
  const n = 2 + Math.floor(Math.random() * 5);
  for (let k = 0; k < n; k++) noiseHit(A, ch, t + Math.random() * 0.35, { vel: vel * (0.4 + Math.random()), type: 'highpass', freq: 1500 + Math.random() * 3000, decay: 0.004 + Math.random() * 0.01, pan: pan + (Math.random() - 0.5) * 0.3 });
}
/** Sleigh-ish bells, far off and soft. */
function jingle(A, ch, t, { vel = 0.012, pan = 0 } = {}) {
  for (let k = 0; k < 6; k++) bell(A, ch, t + k * 0.11 + Math.random() * 0.03, 96 + Math.floor(Math.random() * 6), vel, pan, 0.6);
}

// ------------------------------------------------------------------ a few more instruments
/** A marimba: a soft woody sine with its bright fourth partial, dying away quickly. */
function marimba(A, ch, t, m, vel = 0.05, pan = 0) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan), f = mtof(m);
  for (const [mul, amp, dec] of [[1, 1, 0.9], [4, 0.25, 0.18], [10, 0.05, 0.05]]) {
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * mul;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * amp, t + 0.006); g.gain.setTargetAtTime(0, t + 0.006, dec / 3);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dec * 2.5);
  }
}
/** A light pluck for fast repeats (a mandolin's tremolo): one oscillator, no filter. */
function tick(A, ch, t, m, vel, pan, decay = 0.18) {
  t = Math.max(0, t);
  const { ac } = A, o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = mtof(m);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, decay / 3);
  o.connect(g); g.connect(panned(A, ch, pan)); o.start(t); o.stop(t + decay + 0.02);
}
/** A soft whistle: a near-pure tone that slides from the last note and warms into a vibrato. */
function whistle(A, ch, t, m, dur, vel = 0.04, pan = 0, from = null) {
  t = Math.max(0, t);
  const { ac } = A, dest = panned(A, ch, pan), f = mtof(m);
  const o = ac.createOscillator(), g = ac.createGain(), vib = ac.createOscillator(), vg = ac.createGain();
  o.frequency.setValueAtTime(from ? mtof(from) : f, t); o.frequency.exponentialRampToValueAtTime(f, t + (from ? 0.09 : 0.001));
  vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(14, t + Math.min(0.6, dur)); vib.connect(vg); vg.connect(o.detune);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.06); g.gain.setValueAtTime(vel, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.25);
  o.connect(g); g.connect(dest); for (const x of [o, vib]) { x.start(t); x.stop(t + dur + 0.3); }
}

// the chord colours a profile can ask for, as scale degrees above the root degree
const HARMONY = {
  seventh: [0, 2, 4, 6], triad: [0, 2, 4], sus: [0, 3, 4, 7], open: [0, 4, 9], quartal: [0, 3, 6, 9], add9: [0, 2, 4, 8],
};

// ------------------------------------------------------------------ the composer
export function createAmbient(P, { rng, mobile }) {
  const root = P.root ?? pick(rng, P.roots || [50, 52, 53, 55, 57]);
  const scale = MODES[P.mode || 'major'], L = scale.length;
  const prog = pick(rng, P.progs || PROGS[P.mode || 'major'] || PROGS.major);
  const [bpmLo, bpmHi] = P.bpm || [50, 60];
  const bpm = (e) => bpmLo + (bpmHi - bpmLo) * e;
  const M = P.meter || 4;                          // beats in a bar: 4, or 3 for a waltz / lilting 6/8
  const BEATS = P.beatsPerChord || M * 2;          // two bars a chord unless the profile says otherwise
  const CYCLE = M === 3 ? 12 : 16, W0 = M === 3 ? 3 : 4, WLEN = M === 3 ? 6 : 7; // the lead's phrase window
  const SWING = P.swing || 0;
  const deg = (d) => root + Math.floor(d / L) * 12 + scale[((d % L) + L) % L];
  const chordOf = (d0) => (HARMONY[P.harmony || 'seventh']).map((k) => deg(d0 + k));
  let next = 0, step = 0, tune = [], last = null, walkPrev = null;
  const nextAt = {};
  const A0 = P.ambience || {};

  function newTune() {
    const notes = [], maxPos = WLEN * 2 - 1, sparse = P.leadStyle === 'sparse';
    let d = L + Math.floor(rng() * 4), pos = sparse ? 0 : Math.floor(rng() * 2);
    while (pos < maxPos) {
      const len = sparse ? pick(rng, [4, 5, 6]) : pick(rng, [1, 2, 2, 3, 4]);
      notes.push({ at: pos, len: Math.min(len, maxPos + 1 - pos), d });
      pos += len + (rng() < (sparse ? 0.5 : 0.3) ? 1 + Math.floor(rng() * 2) : 0);
      d = Math.max(L - 3, Math.min(L * 2 - 1, d + pick(rng, [-1, -1, 1, 1, -2, 2, 0])));
    }
    return notes;
  }
  /** Play one note on the lead instrument. */
  function playLead(A, ch, t, m, dur, v, pan, kind = P.lead) {
    if (kind === 'flute') flute(A, ch, t, m, dur, v, pan, last);
    else if (kind === 'whistle') whistle(A, ch, t, m + 12, dur, v * 0.75, pan, last != null ? last + 12 : null);
    else if (kind === 'bell' || kind === 'musicbox' || kind === 'celesta') bell(A, ch, t, m + (kind === 'bell' ? 0 : 12), v * 0.9, pan, kind === 'bell' ? 5 : kind === 'musicbox' ? 2.5 : 1.4);
    else if (kind === 'epiano') epiano(A, ch, t, m, v * 0.9, pan, dur);
    else if (kind === 'marimba') marimba(A, ch, t, m, v * 1.2, pan);
    else if (kind === 'harp') pluck(A, ch, t, m, v, pan, { bright: 3200, decay: 1.1 });
    else if (kind === 'pluck' || kind === 'mandolin') { pluck(A, ch, t, m, v, pan, { bright: 2600, decay: 0.5 }); if (kind === 'mandolin') for (let k = 1; k < Math.min(5, Math.max(2, Math.round(dur / 0.13))); k++) tick(A, ch, t + k * 0.13, m, v * 0.4, pan); }
    else if (kind === 'choir') choir(A, ch, t, [m], dur * 1.3, { vol: 0.018, attack: 0.4, release: 1.5, bright: 0.6 });
  }
  /** One note of the accompaniment. */
  function playArp(A, ch, t, m, v, pan, short = false) {
    const k = P.arpVoice || 'harp';
    if (k === 'harp') pluck(A, ch, t, m, v, pan, { bright: 1800, decay: short ? 0.3 : 0.8 });
    else if (k === 'guitar') pluck(A, ch, t, m, v * 0.9, pan, { bright: 1500, decay: short ? 0.25 : 0.55 });
    else if (k === 'celesta') bell(A, ch, t, m + 12, v * 0.8, pan, 1.2);
    else if (k === 'marimba') marimba(A, ch, t, m, v, pan);
    else if (k === 'epiano') epiano(A, ch, t, m, v * 0.8, pan, 1.2);
  }

  return {
    level: P.level ?? 1.3,
    delayTime: (60 / bpm(1)) * (M === 3 ? 1 : 0.75),

    live(ac, dest, t0) {
      // continuous beds: a low drone, and whichever of wind, water, fire, murmur, purr this place has
      const stops = [];
      const g = ac.createGain(); g.gain.value = 0; g.connect(dest);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + 10);
      const drone = ac.createOscillator(), dg = ac.createGain(); drone.frequency.value = mtof(root - 24); dg.gain.value = P.drone ?? 0.03; drone.connect(dg); dg.connect(g); drone.start(t0); stops.push(drone);
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
      bed(A0.wind, 'lowpass', 600, 0.6, 0.05, 0.6, 300);
      bed(A0.water, 'bandpass', 900, 0.8, 0.27, 0.4, 350);
      bed(A0.fire, 'lowpass', 300, 0.7, 0.4, 0.5);
      bed(A0.murmur, 'bandpass', 520, 1.6, 0.6, 0.7, 180); // a room of voices, too far off for words
      bed(A0.room, 'lowpass', 220, 0.5, 0.03, 0.3);
      if (A0.purr) { // a cat purring: a low rumble beating at the purr rate
        const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
        const gg = ac.createGain(); gg.gain.value = 0;
        const am = ac.createOscillator(), aa = ac.createGain(); am.frequency.value = 25; aa.gain.value = A0.purr; am.connect(aa); aa.connect(gg.gain);
        const br = ac.createOscillator(), ba = ac.createGain(); br.frequency.value = 0.35; ba.gain.value = A0.purr * 0.5; br.connect(ba); ba.connect(gg.gain);
        s.connect(f); f.connect(gg); gg.connect(g); for (const x of [s, am, br]) x.start(t0); stops.push(s, am, br);
      }
      return { stop(t) { for (const s of stops) { try { s.stop(t + 0.05); } catch { /* fine */ } } } };
    },

    chunk(A, from, to, energyAt) {
      const padCh = channel(A, { gain: 1, verb: P.verb ?? 0.6, delay: 0.05 });
      const leadCh = channel(A, { gain: 1, verb: (P.verb ?? 0.6) * 0.9, delay: P.leadDelay ?? 0.3 });
      const arpCh = channel(A, { gain: 1, verb: (P.verb ?? 0.6) * 0.7, delay: 0.12 });
      const bassCh = channel(A, { gain: 1, verb: 0.15 });
      const percCh = channel(A, { gain: 1, verb: 0.25 });
      const nightCh = channel(A, { gain: 1, verb: 0.35 });
      const farCh = channel(A, { gain: 0.8, verb: 1.1 });
      // a slow seasick wobble in the pads, for dreams that want one
      let wobble = null;
      if (P.wobble) { const o = A.ac.createOscillator(), g = A.ac.createGain(); o.frequency.value = 0.13; g.gain.value = P.wobble; o.connect(g); o.start(0); o.stop(to - from + 30); wobble = g; }
      const every = (key, gap, fn, tm, t) => {
        if (!(key in nextAt)) nextAt[key] = tm + gap * (0.3 + rng() * 0.7);
        if (tm >= nextAt[key]) { fn(t); nextAt[key] = tm + gap * (0.6 + rng() * 0.8); }
      };
      if (next < from) next = from; // a skipped chunk: carry on from here rather than pile up
      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
        const beatLen = 60 / bpm(e), eighth = beatLen / 2;
        const beat = Math.floor(step / 2), sub = step % 2, inBar = beat % M;
        const ts = sub ? t + SWING * eighth : t; // swung offbeats
        const ci = Math.floor(beat / BEATS) % prog.length, inChord = beat % BEATS;
        const chord = chordOf(prog[ci]);
        const lowRoot = deg(prog[ci]) - 12;

        // the pad
        if (step % (2 * BEATS) === 0) {
          const notes = chord.slice(0, e > 0.4 ? 4 : 3), pad = P.pad || 'strings', dur = BEATS * beatLen;
          if (pad === 'choir') choir(A, padCh, t, notes, dur, { vol: 0.03, attack: 4, release: 6, bright: 0.4 + 0.5 * e });
          else if (pad !== 'none') {
            const o = {
              strings: { type: 'sawtooth', voices: 2, spread: 8, vol: 0.02, cutoff: 600 + 900 * e },
              organ: { type: 'triangle', voices: 2, spread: 3, vol: 0.02, cutoff: 600 + 900 * e },
              glass: { type: 'sine', voices: 2, spread: 8, vol: 0.03, cutoff: 1500 },
              reed: { type: 'square', voices: 2, spread: 5, vol: 0.011, cutoff: 700 + 500 * e, q: 1.2 }, // a squeezebox, far off
              warm: { type: 'sawtooth', voices: 3, spread: 14, vol: 0.02, cutoff: 380 + 300 * e, q: 0.8 }, // a soft analogue synth
            }[pad];
            padChord(A, padCh, t, notes, dur, { attack: pad === 'reed' ? 1.2 : 3, release: pad === 'reed' ? 2 : 5, q: 0.4, wobble, ...o });
          }
          if ((P.bass || 'sub') === 'sub') padChord(A, padCh, t, [chord[0] - 12], dur, { type: 'sine', voices: 1, attack: 3, release: 5, vol: 0.03, cutoff: 800 });
          A.emit('chord', tm, { index: ci });
        }

        // the lead: a different little tune every phrase, early in the night
        const inCycle = beat % CYCLE;
        if (inCycle === 0 && sub === 0) tune = newTune();
        if (P.lead && e > (P.leadUntil ?? 0.35) && inCycle >= W0 && inCycle < W0 + WLEN) {
          const pos = (inCycle - W0) * 2 + sub;
          for (const n of tune) if (n.at === pos) {
            const m = deg(n.d) + (P.leadOct ?? 0) * 12, dur = n.len * eighth * 0.95, v = 0.03 + 0.02 * e, pan = (rng() - 0.5) * 0.6;
            playLead(A, leadCh, ts, m, dur, v, pan);
            if (P.leadStyle === 'canon') playLead(A, leadCh, ts + beatLen * 2, m - 12, dur, v * 0.55, -pan, P.canonVoice || P.lead);
            last = m;
            A.emit('note', tm, { midi: m });
          }
        }

        // the accompaniment, in the profile's own pattern
        const arp = P.arp === true ? 'broken' : P.arp;
        if (arp && e > 0.3) {
          const v = 0.02 * (0.5 + 0.5 * e);
          const notes = [...chord.slice(0, 3), chord[0] + 12];
          if (arp === 'broken') { if (inChord < 2 && sub === 0) { const k = beat % 4; playArp(A, arpCh, t, chord[k % chord.length] + 12, v * 1.1, (k - 1.5) * 0.25); } }
          else if (arp === 'up') { if (inChord < M) { const k = (inChord * 2 + sub) % notes.length; playArp(A, arpCh, ts, notes[k] + 12, v * (k ? 0.8 : 1), (k - 1.5) * 0.3); } }
          else if (arp === 'alberti') { const k = [0, 2, 1, 2][(inBar * 2 + sub) % 4]; playArp(A, arpCh, ts, chord[k] + 12, v * (sub ? 0.65 : 0.85), (k - 1) * 0.3); }
          else if (arp === 'strum') { if (sub === 0 && (inBar === 0 || (M === 4 && inBar === 2))) notes.forEach((m, k) => playArp(A, arpCh, t + k * 0.04, m + 12, v * (inBar ? 0.7 : 1), (k - 1.5) * 0.15)); }
          else if (arp === 'waltz') { // oom-pah-pah (or oom-pah in four)
            if (sub === 0) {
              if (inBar === 0 || (M === 4 && inBar === 2)) playArp(A, arpCh, t, lowRoot + 12 + (inBar === 2 ? 7 : 0), v * 1.2, 0);
              else { playArp(A, arpCh, t, chord[1] + 12, v * 0.7, -0.25, true); playArp(A, arpCh, t + 0.01, chord[2] + 12, v * 0.7, 0.25, true); }
            }
          }
          else if (arp === 'twinkle') { if (rng() < 0.3) playArp(A, arpCh, ts, chord[Math.floor(rng() * chord.length)] + 24, v * (0.5 + rng() * 0.5), (rng() - 0.5) * 1.4); }
          else if (arp === 'rock') { if (sub === 0) playArp(A, arpCh, t, (beat % 2 ? chord[2] : chord[0]) + 12, v * (beat % 2 ? 0.7 : 1), beat % 2 ? 0.35 : -0.35); }
        }

        // the bass line
        const B = P.bass || 'sub', bv = (P.bassVel ?? 0.07) * (0.6 + 0.4 * e);
        if (sub === 0 && B !== 'sub' && B !== 'none') {
          if (B === 'roots') { if (inBar === 0) bass(A, bassCh, t, lowRoot, beatLen * M * 0.92, bv); }
          else if (B === 'pulse') { if (M === 3 ? inBar === 0 : inBar % 2 === 0) bass(A, bassCh, t, inBar === 2 ? lowRoot + 7 : lowRoot, beatLen * 0.7, bv * (inBar ? 0.8 : 1)); }
          else if (B === 'walk') { // a walking bass, pizzicato: root, up the chord, then a step into the next chord
            const lastBeat = inChord === BEATS - 1;
            let m = inBar === 0 ? lowRoot : lastBeat ? deg(prog[(ci + 1) % prog.length]) - 12 + (rng() < 0.5 ? -1 : 1) : chord[inBar % 3] - 12;
            if (walkPrev != null && Math.abs(m - walkPrev) > 9) m += m > walkPrev ? -12 : 12;
            walkPrev = m;
            bass(A, bassCh, ts, m, beatLen * 0.45, bv * (inBar === 0 ? 1 : 0.8));
          }
        }

        // a whisper of percussion, gone by the small hours
        const PC = P.perc;
        if (PC && e > 0.35) {
          const pv = (P.percVel ?? 1) * e;
          if (PC === 'brush') {
            if (sub === 0 && (M === 4 ? inBar % 2 === 1 : inBar > 0)) noiseHit(A, percCh, t, { vel: 0.012 * pv, type: 'bandpass', freq: 2600, q: 0.6, decay: 0.2 });
            else if (sub === 1) noiseHit(A, percCh, ts, { vel: 0.004 * pv, type: 'highpass', freq: 5000, decay: 0.03 });
          }
          else if (PC === 'shaker') { if (sub === 0 || beat % 2 === 0) noiseHit(A, percCh, ts, { vel: (sub ? 0.004 : 0.007) * pv, type: 'highpass', freq: 6500, decay: 0.035, pan: sub ? 0.3 : -0.2 }); }
          else if (PC === 'heart') { if (sub === 0 && inBar === 0) { kick(A, percCh, t, 0.06 * pv); kick(A, percCh, t + beatLen * 0.35, 0.035 * pv); } }
          else if (PC === 'tick') { if (sub === 0) noiseHit(A, percCh, t, { vel: 0.006 * pv, type: 'bandpass', freq: beat % 2 ? 3200 : 2700, q: 4, decay: 0.012, pan: beat % 2 ? 0.2 : -0.2 }); }
        }

        // the place itself
        if (step % 2 === 0) {
          if (A0.crickets) every('cricket', 1.6 / A0.crickets, (at) => cricket(A, nightCh, at, { vel: 0.008 + 0.006 * e, pan: (rng() - 0.5) * 1.8, f: 3800 + rng() * 1200 }), tm, t);
          if (A0.owl) every('owl', 55 / A0.owl, (at) => { if (e < 0.75) { owl(A, farCh, at, { vel: 0.03, pan: (rng() - 0.5) * 1.4 }); A.emit('owl', tm, {}); } }, tm, t);
          if (A0.birds) every('bird', 10 / A0.birds, (at) => { if (e > 0.3) { bird(A, nightCh, at, rng, { vel: 0.01 + 0.012 * e, pan: (rng() - 0.5) * 1.6, base: 1700 + rng() * 1500 }); A.emit('bird', tm, {}); } }, tm, t);
          if (A0.horse) every('horse', 26 / A0.horse, (at) => { (rng() < 0.6 ? snort : nicker)(A, nightCh, at, { pan: (rng() - 0.5) * 1.2 }); A.emit('horse', tm, {}); }, tm, t);
          if (A0.duck) every('duck', 30 / A0.duck, (at) => { quack(A, nightCh, at, { pan: (rng() - 0.5) * 1.4 }); if (rng() < 0.5) quack(A, nightCh, at + 0.35, { vel: 0.018, pan: 0 }); A.emit('duck', tm, {}); }, tm, t);
          if (A0.crackle) every('crackle', 2.5 / A0.crackle, (at) => crackle(A, nightCh, at, { vel: 0.012 * A0.crackle, pan: -0.3 }), tm, t);
          if (A0.jingle) every('jingle', 40 / A0.jingle, (at) => { if (e > 0.4) jingle(A, farCh, at, { pan: (rng() - 0.5) }); }, tm, t);
          if (A0.bell) every('bell', 140 / A0.bell, (at) => { for (let k = 0; k < 3; k++) bell(A, farCh, at + k * 2.4, root - 5, 0.025, 0.4, 6); A.emit('bell', tm, {}); }, tm, t);
          if (A0.gust) every('gust', 22 / A0.gust, (at) => swell(A, farCh, at, { dur: 9 + rng() * 6, vel: 0.035, freq: 400 + rng() * 300, freq2: 700, q: 1.4, pan: -0.6, pan2: 0.6 }), tm, t);
        }
        if (A0.steps && e > 0.3) { // footsteps keep to the beat, slowing as the walker does
          if (sub === 0) { footstep(A, nightCh, t, { vel: 0.02 * A0.steps * e, pan: beat % 2 ? 0.15 : -0.15, surface: A0.surface || 'gravel' }); if (beat % 2 === 0) A.emit('step', tm, {}); }
        }
        step++;
        next += eighth;
      }
    },
  };
}
