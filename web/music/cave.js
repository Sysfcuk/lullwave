// Crystal Cave: slow Lydian pads, glass bells that answer each other from either side, a low
// drone, water dripping and the odd breath of wind through the tunnels. Everything thins out,
// slows down and darkens as the energy falls through the night.
//
// A composer keeps its musical state (position, motif) across chunks; `chunk()` writes the notes
// between two music times into one chunk's offline context, and `live()` starts the drone in the
// live context.
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

export function createCave({ rng }) {
  const root = pick(rng, [50, 52, 53, 55, 57]); // D, E, F, G or A
  const prog = pick(rng, PROGRESSIONS);
  let next = 0, step = 0, motif = [], motifOn = false, lastBellPan = 0, nextDrip = 1, nextWind = 12;
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

  return {
    level: 1.1, // trim so every world plays at about the same loudness
    delayTime: (60 / bpm(1)) * 0.75,

    live(ac, dest, t0) {
      // root and fifth an octave down, breathing very slowly
      const drone = ac.createGain(); drone.gain.value = 0; drone.connect(dest);
      const oscs = [];
      for (const [m, amp] of [[root - 12, 0.06], [root - 5, 0.02], [root, 0.012]]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = mtof(m); g.gain.value = amp;
        o.connect(g); g.connect(drone); oscs.push(o);
      }
      const breath = ac.createOscillator(), amt = ac.createGain();
      breath.frequency.value = 0.05; amt.gain.value = 0.25;
      breath.connect(amt); amt.connect(drone.gain); oscs.push(breath);
      for (const o of oscs) o.start(t0);
      drone.gain.setValueAtTime(0, t0); drone.gain.linearRampToValueAtTime(0.75, t0 + 10);
      return { stop(t) { for (const o of oscs) { try { o.stop(t + 0.05); } catch { /* fine */ } } } };
    },

    chunk(A, from, to, energyAt) {
      const padCh = channel(A, { gain: 1, verb: 0.55 });
      const bellCh = channel(A, { gain: 1, verb: 0.85, delay: 0.35 });
      const dripCh = channel(A, { gain: 0.8, verb: 1.2 });
      const windCh = channel(A, { gain: 1, verb: 0.4 });

      while (next < to) {
        const tm = next, t = tm - from, e = energyAt(tm);
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
          padChord(A, padCh, t, notes.slice(1, 3).map((m) => m + 12), BEATS_PER_CHORD * beatLen, { type: 'sine', voices: 1, attack: 5, release: 5, vol: 0.012 * (0.4 + e), cutoff: 4000 });
          A.emit('chord', tm, { index: chordIdx, name });
          motif = newMotif(); // a new phrase every chord: nothing repeats enough to stick
        }

        if (step % 2 === 0) {
          // the bell motif at the start of a chord, call and answer from opposite sides
          const eighth = Math.round(inChord * 2);
          if (eighth === 0) motifOn = rng() < 0.25 + 0.6 * e;
          if (motifOn) {
            for (const nt of motif) {
              if (nt.at !== eighth) continue;
              const shift = chordIdx % 2 ? pick(rng, [0, -1, 1]) : 0;
              const deg = Math.max(0, Math.min(PENTA.length - 1, nt.deg + shift));
              const m = root + 12 + PENTA[deg] + (e < 0.35 ? -12 : 0);
              const pan = eighth === 0 ? (lastBellPan = (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.4)) : lastBellPan * 0.8;
              bell(A, bellCh, t + (rng() - 0.5) * 0.02, m, 0.05 + 0.05 * e, pan, 5 + 3 * (1 - e));
              A.emit('bell', tm, { midi: m, pan });
            }
          }
          // stray glints between phrases
          if (inChord >= 4 && rng() < 0.03 + 0.05 * e) {
            const m = root + 24 + pick(rng, PENTA.slice(0, 7));
            const pan = (rng() - 0.5) * 1.6;
            bell(A, bellCh, t, m, 0.025 + 0.02 * e, pan, 4);
            A.emit('bell', tm, { midi: m, pan });
          }
        }

        // water dripping, whatever the energy
        if (tm >= nextDrip) {
          const pan = (rng() - 0.5) * 1.6;
          drip(A, dripCh, t, 700 + rng() * 900, 0.05 + rng() * 0.05, pan);
          if (rng() < 0.3) drip(A, dripCh, t + 0.11 + rng() * 0.1, 900 + rng() * 900, 0.03, pan);
          A.emit('drip', tm, { pan, x: rng() });
          nextDrip = tm + 2 + rng() * 6;
        }
        // a breath of wind through the tunnels now and then
        if (tm >= nextWind) {
          const side = (rng() - 0.5) * 1.6;
          swell(A, windCh, t, { dur: 9 + rng() * 6, vel: 0.05, freq: 250 + rng() * 300, freq2: 400 + rng() * 400, q: 1.5, pan: side, pan2: -side });
          nextWind = tm + 18 + rng() * 30;
        }
        step++;
        next += beatLen / 4;
      }
    },
  };
}
