// Crystal Cave: slow Lydian pads, glass bells that answer each other across the cavern, a low
// drone, water dripping into the lake and the odd breath of wind. Everything thins out, slows
// down and darkens as the energy falls through the night.
import { channel, padChord, bell, drip, swell, pick, mtof } from './voices.js';

const CHORDS = {
  I: [0, 7, 11, 14, 16],    // maj9
  II: [2, 9, 14, 18],       // the Lydian II (add9)
  vi: [-3, 4, 7, 11, 14],   // m9
  iii: [4, 11, 14, 19],     // m7
  V: [-5, 2, 7, 12, 14],    // sus
};
const PROGRESSIONS = [['I', 'II', 'vi', 'I'], ['I', 'vi', 'iii', 'II'], ['vi', 'II', 'I', 'V'], ['I', 'V', 'vi', 'II']];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const BEATS_PER_CHORD = 8;

export function createCave(A) {
  const { ac, rng } = A;
  const root = pick(rng, [50, 52, 53, 55, 57]); // D, E, F, G or A
  const prog = pick(rng, PROGRESSIONS);
  const padCh = channel(A, { gain: 1, verb: 0.55 });
  const bellCh = channel(A, { gain: 1, verb: 0.85, delay: 0.35 });
  const dripCh = channel(A, { gain: 0.8, verb: 1.2 });
  const windCh = channel(A, { gain: 1, verb: 0.4 });

  // a drone under everything: root and fifth an octave down, breathing very slowly. It runs on
  // its own, so it keeps sounding even if the page stops scheduling notes in the background.
  const drone = ac.createGain(); drone.gain.value = 0; drone.connect(padCh.input);
  const droneOscs = [];
  for (const [m, amp] of [[root - 12, 0.07], [root - 5, 0.025], [root, 0.015]]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = mtof(m); g.gain.value = amp;
    o.connect(g); g.connect(drone); droneOscs.push(o);
  }
  const breath = ac.createOscillator(), breathAmt = ac.createGain();
  breath.frequency.value = 0.05; breathAmt.gain.value = 0.25;
  breath.connect(breathAmt); breathAmt.connect(drone.gain);
  droneOscs.push(breath);

  let next = 0, step = 0, motif = [], motifOn = false, lastBellPan = 0, nextDrip = 0, nextWind = 0;
  const bpm = (e) => 48 + 8 * e;

  function newMotif() {
    // a few notes on the pentatonic, placed on eighth notes across two bars
    const n = 3 + Math.floor(rng() * 3), notes = [];
    let deg = 3 + Math.floor(rng() * 4), pos = 0;
    for (let k = 0; k < n; k++) {
      notes.push({ at: pos, deg });
      pos += pick(rng, [1, 2, 2, 3, 4]);
      deg = Math.max(0, Math.min(PENTA.length - 1, deg + pick(rng, [-2, -1, -1, 1, 1, 2])));
    }
    return notes;
  }

  function playStep(t, e) {
    const beat = step / 4;
    const chordIdx = Math.floor(beat / BEATS_PER_CHORD) % prog.length;
    const inChord = beat % BEATS_PER_CHORD;
    const beatLen = 60 / bpm(e);

    if (step % (4 * BEATS_PER_CHORD) === 0) {
      const name = prog[chordIdx];
      const notes = CHORDS[name].map((o) => root + o).filter((_, k) => e > 0.3 || k < 4);
      padChord(A, padCh, t, notes, BEATS_PER_CHORD * beatLen, {
        type: 'triangle', voices: 2, spread: 7, attack: 3.5, release: 5, vol: 0.035, cutoff: 500 + 1300 * e, q: 0.3,
      });
      // a soft sine layer an octave up for air
      padChord(A, padCh, t, notes.slice(1, 3).map((m) => m + 12), BEATS_PER_CHORD * beatLen, { type: 'sine', voices: 1, attack: 5, release: 5, vol: 0.012 * (0.4 + e), cutoff: 4000 });
      A.emit('chord', t, { index: chordIdx, name });
      if (chordIdx === 0) motif = newMotif();
    }

    // the bell motif at the start of a chord, call and answer from opposite sides
    if (step % 2 === 0) {
      const eighth = Math.round(inChord * 2);
      if (eighth === 0) motifOn = rng() < 0.25 + 0.6 * e;
      if (motifOn) {
        for (const nt of motif) {
          if (nt.at === eighth) {
            const shift = chordIdx % 2 ? pick(rng, [0, -1, 1]) : 0;
            const deg = Math.max(0, Math.min(PENTA.length - 1, nt.deg + shift));
            const m = root + 12 + PENTA[deg] + (e < 0.35 ? -12 : 0);
            const pan = eighth === 0 ? (lastBellPan = (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.4)) : lastBellPan * 0.8;
            bell(A, bellCh, t + (rng() - 0.5) * 0.02, m, 0.05 + 0.05 * e, pan, 5 + 3 * (1 - e));
            A.emit('bell', t, { midi: m, pan });
          }
        }
      }
      // stray glints between phrases
      if (inChord >= 4 && rng() < 0.03 + 0.05 * e) {
        const m = root + 24 + pick(rng, PENTA.slice(0, 7));
        const pan = (rng() - 0.5) * 1.6;
        bell(A, bellCh, t, m, 0.025 + 0.02 * e, pan, 4);
        A.emit('bell', t, { midi: m, pan });
      }
    }

    // water dripping into the lake, whatever the energy
    if (t >= nextDrip) {
      if (nextDrip) {
        const pan = (rng() - 0.5) * 1.6;
        drip(A, dripCh, t, 700 + rng() * 900, 0.05 + rng() * 0.05, pan);
        if (rng() < 0.3) drip(A, dripCh, t + 0.11 + rng() * 0.1, 900 + rng() * 900, 0.03, pan);
        A.emit('drip', t, { pan, x: rng() });
      }
      nextDrip = t + 2 + rng() * 6;
    }
    // a breath of wind through the cavern now and then
    if (t >= nextWind) {
      if (nextWind) {
        const from = (rng() - 0.5) * 1.6;
        swell(A, windCh, t, { dur: 9 + rng() * 8, vel: 0.05, freq: 250 + rng() * 300, freq2: 400 + rng() * 400, q: 1.5, pan: from, pan2: -from });
      }
      nextWind = t + 18 + rng() * 30;
    }
    step++;
    next += beatLen / 4;
  }

  return {
    delayTime: 60 / bpm(1) * 0.75,
    start(t0) {
      next = t0; step = 0;
      for (const o of droneOscs) o.start(t0);
      drone.gain.setValueAtTime(0, t0); drone.gain.linearRampToValueAtTime(0.75, t0 + 8);
    },
    schedule(until, energyAt) {
      while (next < until) playStep(next, energyAt(next));
    },
    stop(t) {
      for (const o of droneOscs) { try { o.stop(t + 0.1); } catch { /* never started */ } }
    },
  };
}
