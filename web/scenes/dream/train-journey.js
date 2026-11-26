// The Sleeper Train's journey: how fast the train goes, what it passes through and what it meets
// along the line. Shared by the music (which runs it, so the clickety-clack, the brakes, the tunnel's
// roar, the crossing bells, the rain and the footsteps land exactly where the train is) and the scene
// (which builds what's announced, and runs its own copy when there's no music).
//
// The night: it leaves a city terminus, runs out through farmland, climbs into the mountains, follows
// a lake and crosses a snowy pass, the country changing as the night goes on. Somewhere in the middle
// we get up and walk back through the train (the corridor, the dining car, the observation car at the
// back), and late on we go to bed.
//
// step(dt, e, cruise) moves the train on and returns what happened:
//   { type: 'plan', kind, s0, s1, ... }   something ahead to build (region, station, tunnel, viaduct, crossing, pass)
//   { type: 'brake' } / 'arrive' (with dwell) / 'guard' / 'depart'
//   { type: 'enter' | 'exit', kind }      into and out of a tunnel, onto and off a viaduct
//   { type: 'cross' } / 'meet'            a level crossing passed, another train met
//   { type: 'region', name }              into new country
//   { type: 'weather', rain, fog, snow }  the weather changing (amounts 0..1)
//   { type: 'walk' } / { type: 'bed' }    our walk through the train; bedtime
// Positions are in metres along the line from where the journey began.

export const RAIL = 18;
export const LEAD = 700; // how far ahead things are announced
export const RLEAD = 1150; // and new country, further (the line's bends depend on it)
export const REGIONS = ['city', 'farm', 'mountain', 'lake', 'snow'];
export const WALK = [['up', 7], ['corridor', 16], ['dining', 34], ['through', 3], ['obs', 70], ['back', 3]];
export const WALK_LEN = WALK.reduce((a, [, d]) => a + d, 0);
const regionFor = (e) => (e > 0.88 ? 'city' : e > 0.66 ? 'farm' : e > 0.5 ? 'mountain' : e > 0.37 ? 'lake' : 'snow');
// how often things come in each country (multiplies the gap between them; 0: never)
const RATE = {
  city: { station: 0, tunnel: 2.5, viaduct: 0.8, crossing: 0, pass: 1 },
  farm: { station: 1, tunnel: 1.3, viaduct: 1.4, crossing: 1, pass: 1 },
  mountain: { station: 2, tunnel: 0.45, viaduct: 0.55, crossing: 0, pass: 1.4 },
  lake: { station: 1.6, tunnel: 2, viaduct: 2, crossing: 2.5, pass: 1.3 },
  snow: { station: 2.2, tunnel: 0.9, viaduct: 1.3, crossing: 0, pass: 2 },
};
const BASE = { city: [0, 0.05, 0], farm: [0, 0, 0], mountain: [0, 0.25, 0], lake: [0, 0.35, 0], snow: [0, 0.2, 0.8] };

export function createJourney(rng) {
  let pos = 0, v = 0, a = 0, T = 0, state = 'dwell', first = true;
  const plans = [];
  const next = { station: 0, tunnel: 60 + rng() * 60, viaduct: 90 + rng() * 120, crossing: 35 + rng() * 40, pass: 110 + rng() * 90, spell: 150 + rng() * 200 };
  let stop = null, dwell = 0, dwellT = 0, guarded = false, stationNo = 0;
  let planned = 'city', here = 'city', spell = 0, walkT = -1, bed = false;
  const free = (s0, s1, gap = 260) => plans.every((p) => { if (p.kind === 'region') return true; const g = p.kind === 'station' ? Math.max(gap, 700) : gap; return s1 + g < p.s0 || s0 > p.s1 + g; });
  const weather = (out) => { const [r, f, s] = BASE[here]; out.push({ type: 'weather', rain: spell > 0 && here !== 'snow' ? spell : r, fog: Math.max(f, spell > 0 ? 0.25 : 0), snow: s }); };
  return {
    get pos() { return pos; }, get v() { return v; }, get a() { return a; }, get state() { return state; },
    get plans() { return plans; }, get region() { return here; }, get walkT() { return walkT; }, get T() { return T; },
    step(dt, e, cruise) {
      const out = [];
      T += dt;
      if (first) { // the night begins at the terminus, the train about to leave
        first = false;
        const r = { kind: 'region', s0: -1e5, s1: -1e5, name: 'city' }; plans.push(r); out.push({ type: 'plan', ...r });
        stop = { kind: 'station', s0: 0, s1: 0, no: stationNo++, dwell: 26, city: true }; plans.push(stop); out.push({ type: 'plan', ...stop });
        dwell = stop.dwell; dwellT = 0; guarded = false; out.push({ type: 'arrive', dwell, no: 0, first: true });
        weather(out);
      }
      // ---- new country ahead, as the night goes on
      const want = regionFor(e);
      if (want !== planned && REGIONS.indexOf(want) > REGIONS.indexOf(planned)) {
        planned = want; const r = { kind: 'region', s0: pos + RLEAD, s1: pos + RLEAD, name: want }; plans.push(r); out.push({ type: 'plan', ...r });
      }
      // ---- plan what's coming
      const R = RATE[planned];
      const ahead = pos + LEAD + (state === 'cruise' ? 0 : 1e9);
      const plan = (kind, len, extra = {}) => { const s0 = ahead, s1 = ahead + len; if (!free(s0, s1, kind === 'station' || kind === 'pass' ? 700 : 260)) return false; const p = { kind, s0, s1, ...extra }; plans.push(p); out.push({ type: 'plan', ...p }); return true; };
      const due = (k) => T > next[k] && state === 'cruise' && R[k] > 0;
      if (next.station === 0) next.station = 240 + rng() * 120;
      if (due('station')) { if (plan('station', 0, { no: stationNo++, dwell: 30 + rng() * 20 + 10 * e })) next.station = T + (300 + rng() * 240) * (1.4 - 0.5 * e) * R.station; else next.station += 15; }
      if (due('tunnel')) { if (plan('tunnel', (260 + rng() * 520) * (planned === 'city' ? 0.5 : 1))) next.tunnel = T + (140 + rng() * 160) * R.tunnel; else next.tunnel += 10; }
      if (due('viaduct')) { if (plan('viaduct', 180 + rng() * 160)) next.viaduct = T + (260 + rng() * 260) * R.viaduct; else next.viaduct += 10; }
      if (due('crossing')) { if (plan('crossing', 0)) next.crossing = T + (80 + rng() * 110) * R.crossing; else next.crossing += 8; }
      if (due('pass')) { if (plan('pass', 0, { speed: 30 + rng() * 8, cars: 6 + Math.floor(rng() * 5) })) next.pass = T + (150 + rng() * 180) * R.pass; else next.pass += 8; }
      // ---- now and then a spell of rain (or, high up, fog)
      if (T > next.spell) {
        if (spell > 0) { spell = 0; next.spell = T + 200 + rng() * 300; }
        else if (here === 'farm' || here === 'mountain' || here === 'lake') { spell = 0.5 + rng() * 0.5; next.spell = T + 80 + rng() * 120; }
        else next.spell = T + 60;
        weather(out);
      }
      // ---- the station ahead: brake to stop with our window in the middle of the platform
      if (!stop) stop = plans.find((p) => p.kind === 'station' && !p.done && p.s0 > pos - 0.5) || null;
      if (state === 'cruise' || state === 'brake') {
        const d = stop ? stop.s0 - pos : Infinity;
        if (state === 'cruise' && d < (v * v) / (2 * 0.45) + 2) { state = 'brake'; out.push({ type: 'brake', dist: d }); }
        if (state === 'brake') {
          a = d > 0.3 ? -(v * v) / (2 * Math.max(0.3, d)) : -2;
          if (v < 0.35 && d < 1.5) { v = 0; a = 0; state = 'dwell'; dwell = stop.dwell; dwellT = 0; guarded = false; out.push({ type: 'arrive', dwell, no: stop.no }); }
        } else a = Math.max(-0.3, Math.min(0.3, (cruise - v) * 0.15));
      } else if (state === 'dwell') {
        dwellT += dt;
        if (!guarded && dwellT > dwell - 7) { guarded = true; out.push({ type: 'guard' }); }
        if (dwellT >= dwell) { state = 'accel'; out.push({ type: 'depart' }); stop.done = true; stop = null; }
      } else if (state === 'accel') {
        a = 0.3 * Math.min(1, 0.3 + v / 6);
        if (v >= cruise) { state = 'cruise'; a = 0; }
      }
      const was = pos;
      v = Math.max(0, v + a * dt); pos += v * dt;
      // ---- passing things
      for (const p of plans) {
        if ((p.kind === 'tunnel' || p.kind === 'viaduct')) { if (was < p.s0 && pos >= p.s0) out.push({ type: 'enter', kind: p.kind, len: p.s1 - p.s0 }); if (was < p.s1 && pos >= p.s1) out.push({ type: 'exit', kind: p.kind }); }
        if (p.kind === 'crossing' && was < p.s0 && pos >= p.s0) out.push({ type: 'cross' });
        if (p.kind === 'pass' && was < p.s0 && pos >= p.s0) out.push({ type: 'meet', speed: p.speed });
        if (p.kind === 'region' && was < p.s0 && pos >= p.s0) { here = p.name; spell = 0; out.push({ type: 'region', name: here }); weather(out); }
      }
      // ---- our walk through the train, and bedtime
      if (walkT < 0 && e < 0.56 && state === 'cruise') { walkT = T; out.push({ type: 'walk' }); }
      if (!bed && walkT >= 0 && T > walkT + WALK_LEN + 20 && e < 0.3) { bed = true; out.push({ type: 'bed' }); }
      const lastRegion = plans.filter((p) => p.kind === 'region' && p.s0 <= pos).pop();
      for (let i = plans.length - 1; i >= 0; i--) if (plans[i].s1 < pos - 900 && plans[i] !== lastRegion) plans.splice(i, 1);
      return out;
    },
  };
}
