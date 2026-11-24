// Night Drive: slow synthwave for an endless road at 2am. Warm detuned saw pads with a tape
// wobble, a round bass, a dotted-eighth arpeggio, a hollow lead that sings a hook, and a soft
// beat. As the energy falls the beat goes first, then the arpeggio and the lead, until only the
// pads and the bass are left, rolling along under the stars. A car passes now and then.
import { channel, padChord, pluck, bass, lead, kick, noiseHit, swell, pick } from './voices.js';

// chords as semitones from the key's root (minor key), with the bass root of each
const CHORDS = {
  i: { notes: [0, 3, 7, 10, 14], bass: 0 },
  VI: { notes: [-4, 0, 3, 7], bass: -4 },
  III: { notes: [3, 7, 10, 14], bass: 3 },
  VII: { notes: [-2, 2, 5, 9], bass: -2 },
  iv: { notes: [5, 8, 12, 15], bass: 5 },
  v: { notes: [-5, -2, 2, 5], bass: -5 },
};
const PROGRESSIONS = [['i', 'VI', 'III', 'VII'], ['i', 'iv', 'VI', 'v'], ['VI', 'VII', 'i', 'i'], ['i', 'VI', 'iv', 'VII']];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const BEATS_PER_CHORD = 8;

export function createDrive(A) {
  const { ac, rng, mobile } = A;
  const root = pick(rng, [57, 54, 52, 55, 53]); // A, F#, E, G or F minor
  const prog = pick(rng, PROGRESSIONS);
  const padCh = channel(A, { gain: 1, verb: 0.45, delay: 0.08 });
  const bassCh = channel(A, { gain: 1, verb: 0.05 });
  const arpCh = channel(A, { gain: 1, verb: 0.3, delay: 0.45 });
  const leadCh = channel(A, { gain: 1, verb: 0.5, delay: 0.4 });
  const drumCh = channel(A, { gain: 1, verb: 0.2 });
  const fxCh = channel(A, { gain: 1, verb: 0.3 });

  // the tape wobble: one slow LFO bending every pad oscillator together
  const wob = ac.createOscillator(), wobAmt = ac.createGain();
  wob.frequency.value = 0.31; wobAmt.gain.value = 6;
  wob.connect(wobAmt);
  // a held bass drone that keeps going on its own (background safety, and warmth)
  const hum = ac.createOscillator(), humG = ac.createGain(), humLp = ac.createBiquadFilter();
  hum.type = 'triangle'; hum.frequency.value = 440 * Math.pow(2, (root - 24 - 69) / 12);
  humLp.type = 'lowpass'; humLp.frequency.value = 180; humG.gain.value = 0;
  hum.connect(humLp); humLp.connect(humG); humG.connect(bassCh.input);

  let next = 0, step = 0, hook = [], lastLead = null, nextCar = 0;
  const bpm = (e) => 64 + 14 * e;

  function newHook() {
    // two bars of melody on the minor scale, mostly stepwise, ending long
    const notes = [];
    let deg = 7 + Math.floor(rng() * 4), pos = 0;
    while (pos < 14) {
      const len = pos >= 10 ? 16 - pos : pick(rng, [1, 2, 2, 3, 4]);
      notes.push({ at: pos, len, deg });
      pos += len;
      deg = Math.max(4, Math.min(13, deg + pick(rng, [-2, -1, -1, 1, 1, 2, 0])));
    }
    return notes;
  }
  const degMidi = (d) => root + Math.floor(d / 7) * 12 + MINOR[((d % 7) + 7) % 7];

  function playStep(t, e) {
    const beatLen = 60 / bpm(e), s16 = beatLen / 4;
    const beat = Math.floor(step / 4), sub = step % 4;
    const chordIdx = Math.floor(beat / BEATS_PER_CHORD) % prog.length;
    const ch = CHORDS[prog[chordIdx]];
    const inChord = beat % BEATS_PER_CHORD;
    const bar = Math.floor(beat / 4);

    if (step % (4 * BEATS_PER_CHORD) === 0) {
      padChord(A, padCh, t, ch.notes.map((o) => root + o), BEATS_PER_CHORD * beatLen, {
        type: 'sawtooth', voices: mobile ? 2 : 3, spread: 11, attack: 1.8, release: 3, vol: 0.022, cutoff: 700 + 1500 * e, q: 0.8, wobble: wobAmt,
      });
      A.emit('chord', t, { index: chordIdx });
      if (chordIdx === 0 && (bar % 16 === 0 || !hook.length)) hook = newHook();
    }

    // bass: long notes when it's quiet, a gentle eighth-note pulse when there's energy
    if (e > 0.55) {
      if (sub % 2 === 0) bass(A, bassCh, t, root - 24 + ch.bass + (sub === 2 && inChord % 2 ? 12 : 0), s16 * 1.6, 0.13 + 0.05 * e);
    } else if (sub === 0 && inChord % 4 === 0) {
      bass(A, bassCh, t, root - 24 + ch.bass, beatLen * 3.8, 0.16);
    }

    // the arpeggio: up and down the chord in dotted rhythm, an octave up
    if (e > 0.35 && sub % 2 === 0) {
      const tones = ch.notes.map((o) => root + 12 + o);
      const seq = [...tones, ...tones.slice(1, -1).reverse()];
      const k = (step / 2) % seq.length;
      const vel = 0.03 + 0.05 * (e - 0.35);
      pluck(A, arpCh, t, seq[k], vel, k % 2 ? 0.35 : -0.35, { bright: 1400 + 1800 * e, decay: 0.3 });
    }

    // the lead sings the hook on two bars out of every eight
    if (e > 0.45 && bar % 8 >= 4 && bar % 8 < 6) {
      const pos = (bar % 8 - 4) * 8 + step % 16 / 2; // eighths into the phrase
      if (step % 2 === 0) for (const nt of hook) {
        if (nt.at === pos) {
          const m = degMidi(nt.deg);
          lead(A, leadCh, t, m, nt.len * s16 * 2 * 0.95, 0.035 + 0.02 * e, lastLead);
          lastLead = m;
          A.emit('lead', t, { midi: m });
        }
      }
    } else lastLead = null;

    // the beat
    if (e > 0.6 && sub === 0 && (beat % 4 === 0 || beat % 4 === 2)) { kick(A, drumCh, t, 0.18 + 0.15 * (e - 0.6)); A.emit('kick', t, {}); }
    if (e > 0.72 && sub === 0 && beat % 2 === 1) noiseHit(A, drumCh, t, { vel: 0.05, type: 'bandpass', freq: 1800, q: 0.8, decay: 0.18 });
    if (e > 0.5 && sub === 2) noiseHit(A, drumCh, t, { vel: 0.018 + 0.02 * (e - 0.5), freq: 8000, decay: 0.04, pan: 0.2 });

    // a car passing on the other side of the road
    if (t >= nextCar) {
      if (nextCar) {
        const from = rng() < 0.5 ? -0.8 : 0.8;
        swell(A, fxCh, t, { dur: 5 + rng() * 3, vel: 0.06, freq: 300, freq2: 140, q: 0.7, pan: from, pan2: -from });
        A.emit('car', t, { side: from });
      }
      nextCar = t + 25 + rng() * 50;
    }
    step++;
    next += s16;
  }

  return {
    delayTime: 60 / bpm(1) * 0.75,
    start(t0) {
      next = t0; step = 0;
      wob.start(t0); hum.start(t0);
      humG.gain.setValueAtTime(0, t0); humG.gain.linearRampToValueAtTime(0.06, t0 + 10);
    },
    schedule(until, energyAt) {
      while (next < until) playStep(next, energyAt(next));
    },
    stop(t) {
      for (const o of [wob, hum]) { try { o.stop(t + 0.1); } catch { /* never started */ } }
    },
  };
}
