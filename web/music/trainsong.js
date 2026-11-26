// The Sleeper Train's music, and the journey itself. The rails are the rhythm: every axle that
// crosses a rail joint knocks (the rear bogie of the carriage ahead, our front bogie: the
// clickety-clack), and at a cruise the beat is one rail length, so the train and the tune keep
// time. This also runs the journey (from train-journey.js) so every sound lands where the train is:
// the brakes squealing into a station, the hiss as it stops, the platform chime and the guard's
// whistle, the engine chuffing away again; the roar of a tunnel, the hollow knock of a viaduct, a
// level crossing's bell rising and falling in pitch as it goes by, another train's horn bending
// down as it flashes past. Over it all, a night-train lullaby in D: soft electric-piano chords, a
// round bass, and a tune that changes with the country: an electric piano in the city, a clarinet
// over the farmland, lower in the mountains, glass bells by the lake, a celesta in the snow. And when
// we walk back through the train: the door sliding, footsteps, the rattle of the gangway, the murmur
// and clink of the dining car. Rain patters on the glass; snow hushes everything.
import { padChord, bass, epiano, noiseHit, bell, swell, mtof } from './voices.js';
import { panned } from './ambient.js';
import { thud, clarinet, mew, makeComposer, tunePlayer, scaleOf, liveBeds } from './bespoke.js';
import { createJourney, RAIL, WALK } from '../scenes/dream/train-journey.js';

/** A wheel over a rail joint: a metallic knock with a thump under it (lower and boomier on a viaduct). */
function clack(A, ch, t, vel, pan = 0, ring = true, hollow = 0) {
  t = Math.max(0, t);
  noiseHit(A, ch, t, { vel, type: 'bandpass', freq: (1300 + Math.random() * 500) * (1 - 0.35 * hollow), q: 1.6, decay: 0.05 + 0.05 * hollow, pan });
  thud(A, ch, t, vel * (0.9 + 0.6 * hollow), (70 + Math.random() * 15) * (1 - 0.3 * hollow), pan);
  if (!ring) return;
  const { ac } = A, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = 2100 + Math.random() * 400; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.08, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g); g.connect(panned(A, ch, pan)); o.start(t); o.stop(t + 0.1);
}
/** The engine's whistle, far up the train: a soft reedy chord, swelling and fading. */
function whistle(A, ch, t, m, dur = 1.6, vel = 0.01) {
  t = Math.max(0, t);
  const { ac } = A, lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 1500;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.25); g.gain.setValueAtTime(vel, t + dur - 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
  lp.connect(g); g.connect(panned(A, ch, 0.6));
  for (const [mm, d] of [[m, -6], [m + 4, 5], [m + 7, 0]]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(mm); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
}
/** A tone gliding in pitch (a squeal, a horn bending past): freq from f0 to f1 over its length. */
function glide(A, ch, t, f0, f1, dur, vel, { type = 'sine', lp = 4000, pan = 0, att = 0.2, vib = 0 } = {}) {
  t = Math.max(0, t);
  const { ac } = A, o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 6 + Math.random() * 3; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
  f.type = 'lowpass'; f.frequency.value = lp;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + att); g.gain.setValueAtTime(vel, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(f); f.connect(g); g.connect(panned(A, ch, pan)); o.start(t); o.stop(t + dur + 0.05);
}
/** The cup on its saucer. */
function clink(A, ch, t) {
  t = Math.max(0, t);
  const { ac } = A;
  for (let k = 0; k < 3; k++) {
    const o = ac.createOscillator(), g = ac.createGain(), tt = t + k * 0.07 + Math.random() * 0.02;
    o.frequency.value = 3400 + Math.random() * 600; g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.004 / (k + 1), tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.15);
    o.connect(g); g.connect(panned(A, ch, 0.2)); o.start(tt); o.stop(tt + 0.16);
  }
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRASES = [
  [[4, 3], [2, 1], [4, 2], [7, 4], [6, 2], [4, 4]],
  [[2, 2], [4, 2], [5, 4], [4, 2], [2, 2], [0, 4]],
  [[7, 4], [9, 2], [7, 2], [4, 6], [2, 2]],
  [[0, 2], [2, 2], [4, 2], [5, 2], [7, 6], [4, 2]],
  [[9, 3], [8, 1], [7, 2], [4, 2], [5, 4], [4, 4]],
];
// two bars each, semitones above D: Dmaj7, Bm7, Gmaj7, A(sus4)
const PROG = [[0, [0, 4, 7, 11]], [-3, [2, 4, 7, 9]], [-7, [2, 5, 9, 11]], [-5, [2, 7, 9, 14]]];
// the axles near us (metres from the middle of our carriage) and how loud each sounds
const AXLES = [[14.8, 0.6], [12.2, 0.6], [8.3, 1], [5.7, 1]]; // the rear bogie of the carriage ahead, our front bogie
const C = 343;

export function createTrainSong({ rng }) {
  const root = 50, deg = scaleOf(root, MAJOR);
  const tune = tunePlayer(rng, PHRASES, { meter: 4, rest: [1, 3], align: 2 });
  const J = createJourney(rng);
  const joints = AXLES.map(([o]) => Math.floor(o / RAIL));
  let hollow = 0, tunnel = 0, squealed = false, chuff = 0, horned = new Set(), whistled = new Set();
  let region = 'city', wxs = { rain: 0, fog: 0, snow: 0 };
  const pending = []; // sounds to come at a journey time: [at, fn(localTime)]
  const later = (at, fn) => pending.push([at, fn]);
  const footstep = (A, ch, t, v = 1) => { thud(A, ch, t, 0.009 * v, 105 + Math.random() * 20, 0.05); noiseHit(A, ch, t, { vel: 0.006 * v, type: 'lowpass', freq: 900, decay: 0.05 }); };
  const door = (A, ch, t) => swell(A, ch, t, { dur: 0.9, vel: 0.02, freq: 700, freq2: 1500, q: 1.2, pan: -0.3 });
  return {
    ...makeComposer({
      rng, bpm: [54, 74], meter: 4, swing: 0.08, level: 0.82, verb: 0.7, delay: 0.75,
      live: (ac, dest, t0) => liveBeds(ac, dest, t0, { room: 0.05, wind: 0.01 }, { droneMidi: root - 24, drone: 0.006 }),
      step(S) {
        const { A, ch, t, tm, e, beatLen, eighth, sub, inBar, bar } = S;
        // ---- the journey, in small steps through this eighth note
        const cruise = RAIL / beatLen;
        A.emit('speed', tm, { v: J.v, a: J.a, pos: J.pos });
        const n = Math.ceil(eighth / 0.025), dt = eighth / n;
        for (let k = 0; k < n; k++) {
          const lt = t + k * dt, at = tm + k * dt;
          for (const ev of J.step(dt, e, cruise)) {
            const lt2 = lt + dt;
            if (ev.type === 'plan') A.emit('plan', at, { kind: ev.kind, s0: ev.s0, s1: ev.s1, no: ev.no, dwell: ev.dwell, speed: ev.speed, cars: ev.cars, name: ev.name, city: ev.city });
            else if (ev.type === 'region') { region = ev.name; A.emit('region', at, { name: ev.name }); }
            else if (ev.type === 'weather') { wxs = { rain: ev.rain, fog: ev.fog, snow: ev.snow }; A.emit('weather', at, wxs); }
            else if (ev.type === 'bed') { A.emit('bed', at, {}); later(J.T + 8, (lt3) => { noiseHit(A, ch.perc, lt3, { vel: 0.02, type: 'highpass', freq: 2500, decay: 0.02, pan: 0.3 }); thud(A, ch.perc, lt3, 0.008, 240, 0.3); }); }
            else if (ev.type === 'walk') { // up, out of the door, along the corridor, through the gangway, the dining car, the observation car, and back
              A.emit('walk', at, {});
              const w0 = J.T, P = {}; let acc = 0; for (const [nm, d] of WALK) { P[nm] = acc; acc += d; }
              later(w0 + 2.5, (x) => noiseHit(A, ch.night, x, { vel: 0.01, type: 'lowpass', freq: 600, decay: 0.4 }));
              later(w0 + P.up + 4.5, (x) => door(A, ch.night, x));
              for (let q = P.corridor + 0.5; q < P.dining - 1.2; q += 0.62) later(w0 + q, (x) => footstep(A, ch.night, x));
              later(w0 + P.dining - 1.4, (x) => { swell(A, ch.perc, x, { dur: 2.6, vel: 0.04, freq: 400, freq2: 300, q: 0.6 }); door(A, ch.night, x + 1.8); });
              for (let q = P.dining + 0.6; q < P.dining + 22; q += 0.62) later(w0 + q, (x) => footstep(A, ch.night, x, 0.9));
              for (const q of [0.5, 16]) later(w0 + P.dining + q, (x) => swell(A, ch.far, x, { dur: 20, vel: 0.012, freq: 480, freq2: 520, q: 1.3 })); // the dining car's murmur
              for (const q of [3, 8, 15, 21, 27, 31]) later(w0 + P.dining + q, (x) => { for (let k = 0; k < 2; k++) bell(A, ch.night, x + k * 0.09, 100 + rng() * 4, 0.004, rng() - 0.5, 0.4); });
              later(w0 + P.through + 0.4, (x) => door(A, ch.night, x));
              later(w0 + P.obs + 1, (x) => swell(A, ch.night, x, { dur: 60, vel: 0.008, freq: 300, freq2: 260, q: 0.5 }));
              later(w0 + P.back + 0.5, (x) => door(A, ch.night, x));
            }
            else if (ev.type === 'brake') { squealed = false; A.emit('brake', at, {}); }
            else if (ev.type === 'arrive') {
              noiseHit(A, ch.perc, lt2, { vel: 0.02, type: 'highpass', freq: 2500, decay: 1.2, pan: 0.5 }); // the brakes' sigh
              for (const [d, m] of [[3, 79], [3.45, 76], [3.9, 72]]) bell(A, ch.far, lt2 + d, m, 0.012, -0.3, 2.5); // the platform chime
              if (rng() < 0.5) mew(A, ch.night, lt2 + 6 + rng() * 6, 0.008, 0.4);
              A.emit('arrive', at, { dwell: ev.dwell, no: ev.no });
            } else if (ev.type === 'guard') { // the guard's whistle, a wave of the lantern
              glide(A, ch.night, lt2, 2900, 2800, 0.9, 0.006, { att: 0.02, vib: 120, pan: 0.4 });
              whistle(A, ch.far, lt2 + 2.5, root + 19, 1.6, 0.01);
              A.emit('guard', at, {}); A.emit('whistle', at + 2.5, {});
            } else if (ev.type === 'depart') { chuff = 0; A.emit('depart', at, {}); }
            else if (ev.type === 'enter') {
              if (ev.kind === 'tunnel') { tunnel = 1; const dur = ev.len / Math.max(5, J.v); swell(A, ch.night, lt2, { dur: dur + 1.5, vel: 0.035, freq: 260, freq2: 220, q: 0.6 }); }
              else hollow = 1;
              A.emit('enter', at, { kind: ev.kind });
            } else if (ev.type === 'exit') { if (ev.kind === 'tunnel') tunnel = 0; else hollow = 0; A.emit('exit', at, { kind: ev.kind }); }
            else if (ev.type === 'meet') { // the other train: a rush of air and its wheels
              const dur = (ev.speed > 0 ? 180 : 150) / (J.v + 30);
              swell(A, ch.perc, lt2 - 0.3, { dur: dur + 1, vel: 0.05, freq: 900, freq2: 500, q: 0.5, pan: 0.6, pan2: 0.3 });
              for (let q = 0; q < dur * 11; q++) clack(A, ch.perc, lt2 + q / 11 + rng() * 0.03, 0.016 * (1 - 0.5 * Math.abs(q / (dur * 11) - 0.5)), 0.6, false);
              A.emit('meet', at, {});
            }
          }
          while (pending.length) { const i = pending.findIndex(([w]) => w <= J.T); if (i < 0) break; const [, fn] = pending.splice(i, 1)[0]; fn(lt + dt); }
          // wheels over the joints
          const pos = J.pos;
          AXLES.forEach(([o, g], i) => {
            const j = Math.floor((pos + o) / RAIL);
            if (j !== joints[i]) { joints[i] = j; clack(A, ch.perc, lt, 0.022 * g * (0.85 + 0.15 * e) * (1 + 0.5 * tunnel) * (0.9 + rng() * 0.2), o > 0 ? 0.15 : -0.1, g > 0.9, hollow); if (o === 5.7) A.emit('clack', at, { vel: 1 }); else if (o === 12.2) A.emit('clack', at, { vel: 0.6 }); }
          });
          // braking into a station: the squeal as it slows to a stop
          if (J.state === 'brake' && J.v < 4.5 && !squealed) { squealed = true; glide(A, ch.night, lt, 2600, 3100, 4.5, 0.004, { vib: 30, pan: -0.2, att: 1 }); glide(A, ch.night, lt + 0.6, 3400, 3700, 3.4, 0.002, { vib: 40, pan: 0.3, att: 1 }); }
          // pulling away: the engine's chuffs, quick as the wheels turn, fading as it gets going
          if (J.state === 'accel' || (J.state === 'cruise' && J.v < 10)) {
            chuff += dt * Math.max(0.7, (J.v * 4) / 5.5);
            if (chuff >= 1) { chuff -= 1; noiseHit(A, ch.far, lt, { vel: 0.02 * Math.max(0.2, 1 - J.v / 14), type: 'bandpass', freq: 600, q: 0.8, decay: 0.25, pan: 0.5 }); }
          }
          // things ahead: a whistle before a tunnel, the crossing bell, the other train's horn
          for (const p of J.plans) {
            const d = p.s0 - pos;
            if (p.kind === 'tunnel' && d < 260 && d > 0 && !whistled.has(p)) { whistled.add(p); whistle(A, ch.far, lt, root + 19 + (rng() < 0.5 ? 0 : 2), 1.3 + rng() * 0.6, 0.009); A.emit('whistle', at, {}); }
            if (p.kind === 'crossing' && d < 230 && d > -170) {
              p.bell = (p.bell || 0) + dt;
              if (p.bell >= 0.42) { p.bell -= 0.42; const l = 7, r = Math.hypot(d, l), vr = (J.v * d) / r, f = 1 + vr / C; bell(A, ch.night, lt, 86 + 12 * Math.log2(f), 0.014 / (1 + (d / 28) ** 2), d > 0 ? 0.5 : 0.3, 0.9); }
            }
            if (p.kind === 'pass' && !horned.has(p)) {
              const vc = J.v + p.speed, tt = d / Math.max(1, vc);
              if (tt < 3.2 && tt > 0) { horned.add(p); const f = 330, up = (C + J.v) / (C - p.speed), dn = (C - J.v) / (C + p.speed); glide(A, ch.far, lt, f * up, f * up * 0.995, tt, 0.006, { type: 'sawtooth', lp: 1600, pan: 0.6, att: tt * 0.8 }); glide(A, ch.far, lt + tt, f * dn, f * dn * 0.99, 1.4, 0.007, { type: 'sawtooth', lp: 1300, pan: 0.2, att: 0.03 }); glide(A, ch.far, lt, f * 1.26 * up, f * 1.26 * up * 0.995, tt, 0.004, { type: 'sawtooth', lp: 1600, pan: 0.6, att: tt * 0.8 }); glide(A, ch.far, lt + tt, f * 1.26 * dn, f * 1.26 * dn * 0.99, 1.4, 0.005, { type: 'sawtooth', lp: 1300, pan: 0.2, att: 0.03 }); }
            }
          }
        }

        // ---- the lullaby
        const ci = Math.floor(bar / 2) % PROG.length, [br, voicing] = PROG[ci], notes = voicing.map((x) => root + x);
        if (sub === 0 && inBar === 0 && bar % 2 === 0) {
          padChord(A, ch.pad, t, notes.map((m) => m - 12), beatLen * 8, { vol: 0.004 + 0.002 * e, attack: 2.5, release: 4, cutoff: 900, type: 'triangle', voices: 2, spread: 6 });
          A.emit('chord', tm, { index: ci });
        }
        if (sub === 0 && (inBar === 0 || inBar === 2)) bass(A, ch.bass, t, root - 12 + br + (inBar === 2 ? 7 : 0), beatLen * 1.6, 0.05 + 0.02 * e);
        if (e > 0.3 && sub === 0 && inBar === (bar % 2 ? 3 : 1)) for (const m of notes.slice(1)) epiano(A, ch.arp, t + rng() * 0.02, m, 0.008 + 0.006 * e, (rng() - 0.5) * 0.4, beatLen * 0.9);
        tune.step(S, (d, len) => { // the tune, on the country's own instrument
          const dur = len * S.eighth * 0.95, pan = (rng() - 0.5) * 0.3;
          if (region === 'city') epiano(A, ch.lead, t, deg(d) + 12, 0.034 + 0.01 * e, pan, dur * 1.3);
          else if (region === 'mountain') clarinet(A, ch.lead, t, deg(d), dur, 0.03 + 0.01 * e, pan);
          else if (region === 'lake') bell(A, ch.lead, t, deg(d) + 24, 0.022 + 0.008 * e, pan, 3.5);
          else if (region === 'snow') { bell(A, ch.lead, t, deg(d) + 24, 0.02, pan, 2.4); bell(A, ch.far, t + 0.01, deg(d) + 36, 0.004, -pan, 1.4); }
          else clarinet(A, ch.lead, t, deg(d) + 12, dur, 0.024 + 0.01 * e, pan);
        });
        // ---- weather: rain pattering on the glass; snow's hush
        if (wxs.rain > 0.05) { if (rng() < wxs.rain * 0.9) noiseHit(A, ch.night, t + rng() * eighth, { vel: 0.004 * wxs.rain, type: 'highpass', freq: 3500 + rng() * 2000, decay: 0.015, pan: 0.4 + rng() * 0.4 }); S.every('rainbed', 6, () => swell(A, ch.night, t, { dur: 10, vel: 0.022 * wxs.rain, freq: 2400, freq2: 2600, q: 0.5, pan: 0.4 })); }
        if (wxs.snow > 0.05) S.every('snowhush', 7, () => swell(A, ch.far, t, { dur: 11, vel: 0.012 * wxs.snow, freq: 380, freq2: 300, q: 0.6, pan: 0.3 }));
        // ---- now and then
        S.every('whistle', 90, () => { if (J.state === 'cruise') { whistle(A, ch.far, t, root + 19 + (rng() < 0.5 ? 0 : 2), 1.4 + rng(), 0.006 + 0.004 * e); A.emit('whistle', S.tm, {}); } });
        S.every('clink', 17, () => { if (J.v > 3) { clink(A, ch.night, t); A.emit('clink', S.tm, {}); } });
        if (horned.size > 20) horned = new Set([...horned].slice(-5));
        if (whistled.size > 20) whistled = new Set([...whistled].slice(-5));
      },
    }),
  };
}
