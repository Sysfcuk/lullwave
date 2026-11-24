// The ambient composer for the dream worlds: one engine, a profile per scene. A profile sets
// the key and mode, tempo, the pad, a lead voice that wanders through a new little tune each
// time (never the same twice), and a bed of sounds for the place itself: crickets, owls, wind,
// water, a fire, a pub's murmur, footsteps, horses, ducks, a purring cat. Everything quiet and
// slow, and it all thins out as the night goes on.
import { channel, padChord, pluck, bell, epiano, choir, swell, noiseHit, pick, mtof } from './voices.js';
import { flute, bird, owl } from './nature.js';

const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], minor: [0, 2, 3, 5, 7, 8, 10],
};
// chord roots as scale degrees, per mode family
const PROGS = {
  major: [[0, 5, 3, 4], [0, 3, 5, 4], [3, 0, 4, 5], [0, 4, 5, 3]],
  dorian: [[0, 3, 0, 6], [0, 6, 3, 0], [0, 2, 3, 4]],
  lydian: [[0, 1, 0, 5], [0, 1, 4, 3]],
  mixolydian: [[0, 6, 3, 0], [0, 3, 6, 4]],
  minor: [[0, 5, 2, 6], [0, 3, 5, 4]],
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

// ------------------------------------------------------------------ the composer
export function createAmbient(P, { rng, mobile }) {
  const root = P.root ?? pick(rng, [50, 52, 53, 55, 57]);
  const scale = MODES[P.mode || 'major'];
  const prog = pick(rng, PROGS[P.mode || 'major'] || PROGS.major);
  const [bpmLo, bpmHi] = P.bpm || [50, 60];
  const bpm = (e) => bpmLo + (bpmHi - bpmLo) * e;
  const BEATS = P.beatsPerChord || 8;
  const deg = (d) => root + Math.floor(d / 7) * 12 + scale[((d % 7) + 7) % 7];
  const chordOf = (d0) => [deg(d0), deg(d0 + 2), deg(d0 + 4), deg(d0 + 6)];
  let next = 0, step = 0, tune = [], last = null;
  const nextAt = {};
  const A0 = P.ambience || {};

  function newTune() {
    const notes = []; let d = 7 + Math.floor(rng() * 4), pos = 0;
    while (pos < 13) { const len = pick(rng, [2, 2, 3, 4]); notes.push({ at: pos, len, d }); pos += len + (rng() < 0.3 ? 1 : 0); d = Math.max(4, Math.min(13, d + pick(rng, [-1, -1, 1, 1, -2, 2]))); }
    return notes;
  }

  return {
    level: P.level ?? 1.3,
    delayTime: (60 / bpm(1)) * 0.75,

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
      const leadCh = channel(A, { gain: 1, verb: (P.verb ?? 0.6) * 0.9, delay: 0.3 });
      const nightCh = channel(A, { gain: 1, verb: 0.35 });
      const farCh = channel(A, { gain: 0.8, verb: 1.1 });
      const every = (key, gap, fn, tm, t) => {
        if (!(key in nextAt)) nextAt[key] = tm + gap * (0.3 + rng() * 0.7);
        if (tm >= nextAt[key]) { fn(t); nextAt[key] = tm + gap * (0.6 + rng() * 0.8); }
      };
      if (next < from) next = from; // a skipped chunk: carry on from here rather than pile up
      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
        const beatLen = 60 / bpm(e), eighth = beatLen / 2;
        const beat = Math.floor(step / 2), sub = step % 2;
        const ci = Math.floor(beat / BEATS) % prog.length, inChord = beat % BEATS;
        const chord = chordOf(prog[ci]);

        // the pad
        if (step % (2 * BEATS) === 0) {
          const notes = chord.slice(0, e > 0.4 ? 4 : 3);
          if (P.pad === 'choir') choir(A, padCh, t, notes, BEATS * beatLen, { vol: 0.03, attack: 4, release: 6, bright: 0.4 + 0.5 * e });
          else padChord(A, padCh, t, notes, BEATS * beatLen, { type: P.pad === 'organ' ? 'triangle' : P.pad === 'glass' ? 'sine' : 'sawtooth', voices: 2, spread: P.pad === 'organ' ? 3 : 8, attack: 3, release: 5, vol: P.pad === 'glass' ? 0.03 : 0.02, cutoff: 600 + 900 * e, q: 0.4 });
          padChord(A, padCh, t, [chord[0] - 12], BEATS * beatLen, { type: 'sine', voices: 1, attack: 3, release: 5, vol: 0.03, cutoff: 800 });
          A.emit('chord', tm, { index: ci });
        }
        // the lead: a different little tune every 16 beats, early in the night
        if (beat % 16 === 0 && sub === 0) tune = newTune();
        if (P.lead && e > (P.leadUntil ?? 0.35) && beat % 16 >= 4 && beat % 16 < 11) {
          const pos = (beat % 16 - 4) * 2 + sub;
          for (const n of tune) if (n.at === pos) {
            const m = deg(n.d) + (P.leadOct ?? 0) * 12, dur = n.len * eighth * 0.95, v = 0.03 + 0.02 * e, pan = (rng() - 0.5) * 0.6;
            if (P.lead === 'flute') flute(A, leadCh, t, m, dur, v, pan, last);
            else if (P.lead === 'bell' || P.lead === 'musicbox') bell(A, leadCh, t, m + (P.lead === 'musicbox' ? 12 : 0), v * 0.9, pan, P.lead === 'musicbox' ? 2.5 : 5);
            else if (P.lead === 'epiano') epiano(A, leadCh, t, m, v * 0.9, pan, dur);
            else if (P.lead === 'pluck' || P.lead === 'mandolin') { pluck(A, leadCh, t, m, v, pan, { bright: 2600, decay: 0.5 }); if (P.lead === 'mandolin') pluck(A, leadCh, t + 0.06, m, v * 0.7, pan, { bright: 2600, decay: 0.4 }); }
            else if (P.lead === 'choir') choir(A, leadCh, t, [m], dur * 1.3, { vol: 0.018, attack: 0.4, release: 1.5, bright: 0.6 });
            last = m;
            A.emit('note', tm, { midi: m });
          }
        }
        // a gentle broken chord (harp, guitar) early in each chord
        if (P.arp && e > 0.4 && inChord < 2 && step % 2 === 0) {
          const k = (step / 2) % 4;
          pluck(A, leadCh, t, chord[k] + 12, 0.022 * e, (k - 1.5) * 0.25, { bright: 1800, decay: 0.7 });
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
