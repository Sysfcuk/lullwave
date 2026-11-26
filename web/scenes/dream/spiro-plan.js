// Round and Round: what each drawing is. Shared by the scene and its music, so the gears you see
// are the interval you hear. A spirograph's fixed ring has R teeth and the wheel rolling inside it r:
// reduced, R:r is also a frequency ratio (3:2 a fifth, 5:4 a major third, 15:8 a major seventh...).
// The curve has R petals and closes after the wheel has gone round the ring r times, so a
// consonant interval draws a simple flower and a richer one a denser, lacier curve.

/** [R, r], reduced, each one a just interval. */
export const RATIOS = [
  [16, 9], [15, 8], [9, 5], [8, 5], [5, 3], [7, 4], [10, 3], [8, 3], [7, 5], [5, 2], [5, 4], [6, 5], [4, 3], [3, 2], [3, 1], [2, 1],
];
const PALETTES = [ // gel pens: [start, end] of the line
  ['#ff6fc8', '#ffd36a'], ['#5ae8e0', '#b48cff'], ['#ff9a5a', '#ff5aa8'], ['#8affb0', '#5ac8ff'],
  ['#ffd36a', '#ff7a7a'], ['#c08aff', '#ff8ae0'], ['#6ab0ff', '#8affd8'], ['#ffe6a0', '#ff9ad0'],
];
const LATE = [['#9ab8ff', '#d8e4ff'], ['#b8a8ff', '#9ad8ff'], ['#c8d8ff', '#a8b0e8']];

/** Pick the next drawing for this point in the night (energy e, from 1 down to about 0.2). */
export function pickDrawing(rng, e, prev = null) {
  // early on the lacy ones (many petals, many laps), later the plainest: a fifth, an octave
  const want = 3 + 22 * Math.pow(Math.max(0, (e - 0.22) / 0.78), 1.2);
  let best = null, bestScore = Infinity;
  for (const [R, r] of RATIOS) {
    if (prev && prev.R === R && prev.r === r) continue;
    const score = Math.abs(R + r - want) + rng() * 6;
    if (score < bestScore) { bestScore = score; best = [R, r]; }
  }
  const [R, r] = best;
  // the pen's hole: inside the wheel (rounded petals) or out at the rim and past it (loops)
  const d = r * (e > 0.45 ? 0.45 + rng() * 0.8 : 0.5 + rng() * 0.4);
  const pal = e > 0.4 ? PALETTES[Math.floor(rng() * PALETTES.length)] : LATE[Math.floor(rng() * LATE.length)];
  return { R, r, d, petals: R, laps: r, rot: rng() * Math.PI * 2, c0: pal[0], c1: pal[1] };
}

/** How long a drawing takes: one petal's tip per few bars, so the tips land on the beat. */
export function drawingBars(dr, e) {
  const target = 50 + 40 * (1 - e); // seconds, slower as the night goes on
  return Math.max(1, Math.round(target / 4 / dr.petals)); // bars per petal at about 4 s a bar
}

/** The pen at angle th (radians of the wheel's centre round the ring), in the drawing's own units. */
export function penAt(dr, th, out = { x: 0, y: 0 }) {
  const { R, r, d } = dr, k = (R - r) / r;
  out.x = (R - r) * Math.cos(th) + d * Math.cos(k * th);
  out.y = (R - r) * Math.sin(th) - d * Math.sin(k * th);
  return out;
}
/** The angle at which the curve closes. */
export const closeAt = (dr) => Math.PI * 2 * dr.r;
