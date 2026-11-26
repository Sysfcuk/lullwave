// The Sleeper Train's journey: how fast the train goes and what it meets along the line. Shared by
// the music (which runs it, so the clickety-clack, the brakes, the tunnel's roar and the crossing
// bells land exactly where the train is) and the scene (which builds what's announced, and runs
// its own copy when there's no music).
//
// step(dt, e, cruise) moves the train on and returns what happened:
//   { type: 'plan', kind, s0, s1, ... }   something ahead to build (station, tunnel, viaduct, crossing, pass)
//   { type: 'brake' } / 'arrive' (with dwell) / 'guard' / 'depart'
//   { type: 'enter' | 'exit', kind }   into and out of a tunnel or onto and off a viaduct
//   { type: 'cross' } / 'meet'         a level crossing passed, another train met
// Positions are in metres along the line from where the journey began.

export const RAIL = 18;
export const LEAD = 700; // how far ahead things are announced

export function createJourney(rng) {
  let pos = 0, v = 0, a = 0, T = 0, state = 'cruise', first = true;
  const plans = [];
  const next = { station: 200 + rng() * 120, tunnel: 70 + rng() * 60, viaduct: 160 + rng() * 120, crossing: 35 + rng() * 40, pass: 110 + rng() * 90 };
  let stop = null, dwell = 0, dwellT = 0, guarded = false, stationNo = 0;
  const free = (s0, s1, gap = 260) => plans.every((p) => { const g = p.kind === 'station' ? Math.max(gap, 700) : gap; return s1 + g < p.s0 || s0 > p.s1 + g; });
  return {
    get pos() { return pos; }, get v() { return v; }, get a() { return a; }, get state() { return state; },
    get plans() { return plans; },
    step(dt, e, cruise) {
      const out = [];
      T += dt;
      if (first) { first = false; v = cruise; }
      // ---- plan what's coming
      const ahead = pos + LEAD + (state === 'cruise' ? 0 : 1e9);
      const plan = (kind, len, extra = {}) => { const s0 = ahead, s1 = ahead + len; if (!free(s0, s1, kind === 'station' || kind === 'pass' ? 700 : 260)) return false; const p = { kind, s0, s1, ...extra }; plans.push(p); out.push({ type: 'plan', ...p }); return true; };
      if (T > next.station && state === 'cruise') { if (plan('station', 0, { no: stationNo++, dwell: 35 + rng() * 20 + 10 * e })) next.station = T + (300 + rng() * 240) * (1.4 - 0.5 * e); else next.station += 15; }
      if (T > next.tunnel && state === 'cruise') { if (plan('tunnel', 260 + rng() * 520)) next.tunnel = T + 140 + rng() * 160; else next.tunnel += 10; }
      if (T > next.viaduct && state === 'cruise') { if (plan('viaduct', 180 + rng() * 160)) next.viaduct = T + 260 + rng() * 260; else next.viaduct += 10; }
      if (T > next.crossing && state === 'cruise') { if (plan('crossing', 0)) next.crossing = T + 80 + rng() * 110; else next.crossing += 8; }
      if (T > next.pass && state === 'cruise') { if (plan('pass', 0, { speed: 30 + rng() * 8, cars: 6 + Math.floor(rng() * 5) })) next.pass = T + 150 + rng() * 180; else next.pass += 8; }
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
        a = 0.28 * Math.min(1, 0.3 + v / 6);
        if (v >= cruise) { state = 'cruise'; a = 0; }
      }
      const was = pos;
      v = Math.max(0, v + a * dt); pos += v * dt;
      // ---- passing things
      for (const p of plans) {
        if ((p.kind === 'tunnel' || p.kind === 'viaduct')) { if (was < p.s0 && pos >= p.s0) out.push({ type: 'enter', kind: p.kind, len: p.s1 - p.s0 }); if (was < p.s1 && pos >= p.s1) out.push({ type: 'exit', kind: p.kind }); }
        if (p.kind === 'crossing' && was < p.s0 && pos >= p.s0) out.push({ type: 'cross' });
        if (p.kind === 'pass' && was < p.s0 && pos >= p.s0) out.push({ type: 'meet', speed: p.speed });
      }
      while (plans.length && plans[0].s1 < pos - 900) plans.shift();
      return out;
    },
  };
}
