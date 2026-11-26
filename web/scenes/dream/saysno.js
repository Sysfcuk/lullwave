// Computer Says No: a bedroom desk late at night, and on it a 1980s home computer, made up fresh each
// time (its maker's name, its case, its keys, the colour of its screen, whether it's all in one, a
// keyboard with a monitor on top, or a system box with disk drives). Someone we never see sits at it
// typing questions, the keys going down as they type, and whatever they ask, the computer thinks it
// over (the disk drive whirrs, a spinner turns) and says NO. Sometimes it searches its records first,
// or works it out with a progress bar, or prints it in big block letters. The questions are cheeky to
// begin with, then about bedtime, then the kind where "no" is a comfort. The typing slows and slips as
// the night goes on; they ask to turn the lamp off (no), turn it off anyway, and at last ask if it's
// still awake. NO. And it goes to sleep, its cursor blinking slower and slower.
//
// The screen is a little 192x144 phosphor buffer (our own 5x7 font) shown through a CRT shader:
// curved glass, scanlines, a soft beam, a slow refresh band and phosphor that fades a moment after.
import { createStage, canvasTexture, THREE, TAU } from '../kit.js';
import { room, surface, softBox } from '../interior.js';
import { createTalk } from './nobot-talk.js';

// ------------------------------------------------------------------ the font: 5x7, a column of bits each (bit 0 at the top)
const FONT_HEX = (
  '0000000000 00005f0000 0007000700 147f147f14 242a7f2a12 2313086462 3649552250 0005030000 001c224100 0041221c00 '
  + '082a1c2a08 08083e0808 0050300000 0808080808 0060600000 2010080402 3e5149453e 00427f4000 4261514946 2141454b31 '
  + '1814127f10 2745454539 3c4a494930 0171090503 3649494936 064949291e 0036360000 0056360000 0008142241 1414141414 '
  + '4122140800 0201510906 324979413e 7e1111117e 7f49494936 3e41414122 7f4141221c 7f49494941 7f09090101 3e41415132 '
  + '7f0808087f 00417f4100 2040413f01 7f08142241 7f40404040 7f0204027f 7f0408107f 3e4141413e 7f09090906 3e4151215e '
  + '7f09192946 4649494931 01017f0101 3f4040403f 1f2040201f 7f2018207f 6314081463 0304780403 6151494543 007f414100 '
  + '0204081020 0041417f00 0402010204 4040404040').split(' ');
const FONT = FONT_HEX.map((h) => [0, 2, 4, 6, 8].map((i) => parseInt(h.slice(i, i + 2), 16)));
const TW = 192, TH = 144, COLS = 28, ROWS = 14, OX = 12, OY = 9, CW = 6, CH = 9;

// ------------------------------------------------------------------ made up for each computer
const PRE = ['NOCTA', 'DOZE', 'LULLA', 'SNOOZE', 'NAP', 'SLUMBA', 'YAWN', 'HUSH', 'DROWSI', 'NODDI'];
const SUF = ['TRON', 'TEK', 'VOX', 'BYTE', 'MATIC', 'NIX', 'DATA', 'COM'];
const MODEL = ['64', '128', '2000', 'XL', 'PLUS', '800', 'II', '48K', '3000', 'MICRO'];
const CASES = [['#d9cbb0', '#4a4038'], ['#cfc4ae', '#2e2a28'], ['#b9b4a8', '#3a3a3e'], ['#e6dcc4', '#6a5038'], ['#3a3a40', '#1e1e22'], ['#c8b896', '#8a5a3a']];
const PHOSPHOR = [['#3dff7a', 'green'], ['#ffb02e', 'amber'], ['#cfe4ff', 'white'], ['#5dffd8', 'aqua']];
const STRIPES = [['#e8443a', '#f08a2a', '#f4d03a', '#4ab04a', '#3a7ad8'], ['#d83a3a', '#d83a3a'], ['#3a6ad8', '#e8e8e8', '#3a6ad8'], ['#f0a02a', '#c8402a']];

const SCREEN_V = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SCREEN_F = `
uniform sampler2D uTex; uniform vec3 uCol; uniform float uB, uTime, uOn, uLamp, uFlash; uniform vec2 uRes;
varying vec2 vUv;
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  vec2 cc = c * (1.0 + 0.07 * dot(c, c));                       // the curve of the glass
  float d = length(max(abs(cc) - vec2(0.9), 0.0)) - 0.1;         // rounded corners
  float mask = 1.0 - smoothstep(-0.015, 0.0, d);
  vec2 uv = cc * 0.5 + 0.5;
  vec2 px = uv * uRes;
  vec2 cell = floor(px) + 0.5;
  float fx = fract(px.x) - 0.5, fy = fract(px.y) - 0.5;
  float s0 = texture2D(uTex, cell / uRes).r, sl = texture2D(uTex, (cell - vec2(1.0, 0.0)) / uRes).r, sr = texture2D(uTex, (cell + vec2(1.0, 0.0)) / uRes).r;
  float su = texture2D(uTex, (cell + vec2(0.0, 1.0)) / uRes).r, sd = texture2D(uTex, (cell - vec2(0.0, 1.0)) / uRes).r;
  float s = s0 * exp(-fx * fx * 5.0) + sl * exp(-(fx + 1.0) * (fx + 1.0) * 5.0) + sr * exp(-(fx - 1.0) * (fx - 1.0) * 5.0);
  float beam = exp(-fy * fy / (0.06 + 0.1 * s0));                 // scanlines: the beam swells where it's bright
  float halo = 0.12 * (sl + sr + su + sd + s0);                  // a little glow round each letter
  float band = 1.0 + 0.05 * exp(-(fract(vUv.y * 0.6 - uTime * 0.06) - 0.5) * (fract(vUv.y * 0.6 - uTime * 0.06) - 0.5) * 60.0);
  float flick = 0.985 + 0.015 * sin(uTime * 51.0);
  float open = clamp(uOn * 1.7 - 0.35, 0.0, 1.0);               // switching on: a line that opens out
  float on = 1.0 - smoothstep(max(0.004, open), max(0.004, open) + 0.03, abs(cc.y));
  float bright = (s * beam * 1.9 + halo * 0.45) * uB * band * flick * (1.0 + uFlash) * (1.0 + 3.0 * (1.0 - open) * step(0.01, uOn));
  vec3 col = uCol * bright * on;
  col += uCol * 0.014 * uB * on;                                 // the raster's faint glow
  col *= 1.0 - 0.3 * dot(c, c) * 0.5;
  vec3 glass = vec3(0.018, 0.021, 0.02) * (1.0 - 0.4 * dot(c, c));
  glass += uLamp * vec3(0.06, 0.05, 0.035) * (1.0 - smoothstep(0.0, 0.7, length(c - vec2(-0.55, 0.55))));   // the lamp in the glass
  glass += vec3(0.012, 0.014, 0.02) * (1.0 - smoothstep(0.0, 0.5, length(c - vec2(0.6, 0.65))));           // and the window
  gl_FragColor = vec4((col + glass) * mask, 1.0);
}`;

export function createSaysNoScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x40e0, bg: '#05060a', exposure: 1.05, bloom: [0.75, 0.5, 0.55], finish: { vignette: 0.42, grain: 0.03, ca: 0.3 }, fov: 40 });
  const { rand } = S;
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------------------------------------------------------------- this computer
  const brand = pick(PRE) + pick(SUF), model = pick(MODEL), year = 1981 + Math.floor(rand() * 7);
  const [caseCol, darkCol] = pick(CASES), [phos] = pick(PHOSPHOR), stripes = pick(STRIPES);
  const style = pick(['wedge', 'box', 'compact']);
  const keyCol = pick([darkCol, '#3a3430', '#e8e0cc', '#5a4a3c']), accent = pick(['#d8603a', '#c8a02a', '#7a8a9a', stripes[0]]);
  const bytes = (16 + Math.floor(rand() * 48)) * 1024 - Math.floor(rand() * 900);

  // ---------------------------------------------------------------- the room: a desk against the wall, a window, a poster
  const wallCol = pick(['#3e4a5e', '#5a4a52', '#3e5248', '#5e5240']);
  room(S, { w: 4, d: 4, h: 2.6, pos: [0, 0, 1.25], floor: surface(S, 'planks', { color: '#4a3a2e' }), walls: surface(S, 'plaster', { color: wallCol }), ceiling: surface(S, 'plaster', { color: '#8a8478' }) });
  const hemi = new THREE.HemisphereLight('#6a78a8', '#20160f', 0.3); S.add(hemi);
  const moonL = new THREE.DirectionalLight('#8fa6e0', 0.5); moonL.position.set(1.4, 2.4, -1.2); moonL.target.position.set(0, 0.7, 0); S.add(moonL); S.add(moonL.target);
  const wood = '#6a4a32';
  const DESK_Y = 0.74, WALL_Z = -0.75;
  const deskTop = new THREE.Mesh(softBox(1.6, 0.04, 0.82, 0.008), S.mat(wood)); deskTop.position.set(0, DESK_Y - 0.02, -0.34); S.add(deskTop);
  for (const x of [-0.76, 0.76]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, DESK_Y - 0.04, 0.78), S.mat('#55402c')); p.position.set(x, (DESK_Y - 0.04) / 2, -0.34); S.add(p); }
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.02), S.mat('#55402c')); back.position.set(0, 0.5, WALL_Z + 0.02); S.add(back);

  // the window, with the night outside (rooftops, a few lit windows, stars, the moon) and curtains
  const winTex = canvasTexture(S, 256, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#070b22'); gr.addColorStop(0.7, '#1a2450'); gr.addColorStop(1, '#2a3060'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(255,255,240,${0.3 + rand() * 0.7})`; const s = rand() < 0.1 ? 2 : 1; g.fillRect(rand() * w, rand() * h * 0.7, s, s); }
    g.fillStyle = '#f4efd8'; g.beginPath(); g.arc(w * 0.68, h * 0.22, 20, 0, TAU); g.fill();
    g.fillStyle = '#0d1430'; g.beginPath(); g.arc(w * 0.68 + 9, h * 0.22 - 4, 18, 0, TAU); g.fill();
    let x = 0; g.fillStyle = '#05070f';
    while (x < w) { const bw = 30 + rand() * 50, bh = 50 + rand() * 70; g.fillRect(x, h - bh, bw, bh); if (rand() < 0.6) g.fillRect(x + bw * 0.6, h - bh - 14, 8, 14); x += bw; }
    x = 0;
    while (x < w) { const bw = 30 + rand() * 50; for (let k = 0; k < 2; k++) if (rand() < 0.4) { g.fillStyle = '#ffc870'; g.fillRect(x + 6 + rand() * (bw - 16), h - 20 - rand() * 30, 6, 8); } x += bw; }
  });
  const WIN = [0.62, 1.55, WALL_Z + 0.005];
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false, color: '#9aa4c0' })); pane.position.set(...WIN); S.add(pane);
  for (const [w, h, x, y] of [[0.7, 0.04, 0, 0.38], [0.7, 0.05, 0, -0.38], [0.04, 0.8, -0.33, 0], [0.04, 0.8, 0.33, 0], [0.62, 0.025, 0, 0], [0.025, 0.72, 0, 0]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), S.mat('#d8d0c0')); f.position.set(WIN[0] + x, WIN[1] + y, WIN[2] + 0.015); S.add(f); }
  const curtCol = pick(['#7a3a3a', '#3a5a7a', '#6a5a3a', '#4a3a6a']);
  const curtTex = canvasTexture(S, 64, 8, (g, w) => { for (let x = 0; x < w; x++) { const k = 0.6 + 0.4 * Math.sin((x / w) * TAU * 3); g.fillStyle = new THREE.Color(curtCol).multiplyScalar(k).getStyle(); g.fillRect(x, 0, 1, 8); } });
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 1.05), new THREE.MeshLambertMaterial({ map: curtTex })); c.position.set(WIN[0] + s * 0.42, WIN[1] - 0.08, WIN[2] + 0.06); S.add(c); }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.05, 8), S.mat('#8a7a5a')); rail.rotation.z = Math.PI / 2; rail.position.set(WIN[0], WIN[1] + 0.46, WIN[2] + 0.07); S.add(rail);
  // a poster: a ringed planet over a starfield, with the computer's own name across the bottom (it came free with it)
  const posterTex = canvasTexture(S, 200, 280, (g, w, h) => {
    g.fillStyle = '#0c0f2a'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(255,255,255,${rand()})`; g.fillRect(rand() * w, rand() * h * 0.8, 1.5, 1.5); }
    const pc = pick(['#e88a4a', '#6ab0e8', '#c86ae8', '#e8c86a']);
    const gr = g.createRadialGradient(w * 0.42, h * 0.36, 6, w * 0.5, h * 0.42, 60); gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, pc); gr.addColorStop(1, '#1a1030'); g.fillStyle = gr; g.beginPath(); g.arc(w * 0.5, h * 0.42, 52, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,240,210,.7)'; g.lineWidth = 5; g.beginPath(); g.ellipse(w * 0.5, h * 0.42, 88, 18, -0.3, 0, TAU); g.stroke();
    stripes.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, h * 0.78 + i * 6, w, 5); });
    g.fillStyle = '#f2ead8'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText(brand, w / 2, h * 0.95);
  });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.56), new THREE.MeshLambertMaterial({ map: posterTex })); poster.position.set(-0.6, 1.5, WALL_Z + 0.005); poster.rotation.z = (rand() - 0.5) * 0.04; S.add(poster);

  // ---------------------------------------------------------------- the computer
  const caseM = S.mat(caseCol), darkM = S.mat(darkCol);
  const led = (col, pos, parent, size = [0.008, 0.005, 0.004]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); m.position.set(...pos); parent.add(m); m.userData.base = new THREE.Color(col); return m; };
  const badgeTex = canvasTexture(S, 256, 40, (g, w, h) => {
    g.fillStyle = darkCol; g.fillRect(0, 0, w, h);
    stripes.forEach((c, i) => { g.fillStyle = c; g.fillRect(w - 70 + i * 12, 4, 8, h - 8); });
    g.fillStyle = '#ece4d0'; g.font = 'bold 22px sans-serif'; g.textBaseline = 'middle'; g.fillText(`${brand} ${model}`, 10, h / 2 + 1);
  });
  const badge = (w, pos, parent) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 40 / 256), new THREE.MeshLambertMaterial({ map: badgeTex })); b.position.set(...pos); parent.add(b); return b; };
  const driveLeds = [];
  const floppy = (parent, pos, w = 0.15) => { // a 5.25" drive front: a slot, a latch, a light
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.042, 0.004), S.mat(darkCol)); f.position.set(...pos); parent.add(f);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.006, 0.002), S.mat('#0a0a0a')); slot.position.set(pos[0], pos[1] + 0.004, pos[2] + 0.003); parent.add(slot);
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.008), S.mat('#2a2a2a')); latch.position.set(pos[0], pos[1] - 0.006, pos[2] + 0.005); parent.add(latch);
    driveLeds.push(led('#ff3a2a', [pos[0] - w * 0.4, pos[1] - 0.013, pos[2] + 0.004], parent));
  };
  // a CRT: a rounded front, a tapering back, the glass in a bezel
  function crt(w, h, d, sw, sh, sy, parent) {
    const g = new THREE.Group(); parent.add(g);
    const front = new THREE.Mesh(softBox(w, h, 0.07, 0.014), caseM); front.position.z = -0.035; g.add(front);
    const bg = new THREE.BoxGeometry(w * 0.92, h * 0.86, d, 1, 1, 1), p = bg.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0) { p.setX(i, p.getX(i) * 0.6); p.setY(i, p.getY(i) * 0.62 - h * 0.05); }
    bg.computeVertexNormals();
    const backM = new THREE.Mesh(bg, caseM); backM.position.z = -0.07 - d / 2; g.add(backM);
    const bezel = new THREE.Mesh(softBox(sw + 0.035, sh + 0.035, 0.01, 0.008), S.mat('#1a1a1c')); bezel.position.set(0, sy, 0.0); g.add(bezel);
    return g;
  }
  const comp = new THREE.Group(); S.add(comp);
  let screenW = 0.3, screenH = 0.225, screenPos = new THREE.Vector3(), powerLed;
  let kb = { pos: [0, DESK_Y, -0.06], w: 0.42, d: 0.16, h0: 0.022, h1: 0.04, wedge: false };
  if (style === 'compact') {
    screenW = 0.23; screenH = 0.1725;
    const bodyH = 0.42, body = new THREE.Mesh(softBox(0.36, bodyH, 0.36, 0.02), caseM); body.position.set(0, DESK_Y + bodyH / 2, -0.44); comp.add(body);
    const g = new THREE.Group(); g.position.set(0, DESK_Y + 0.27, -0.26); comp.add(g);
    const bezel = new THREE.Mesh(softBox(screenW + 0.04, screenH + 0.04, 0.01, 0.01), S.mat('#1a1a1c')); g.add(bezel);
    screenPos.set(0, DESK_Y + 0.27, -0.252);
    floppy(comp, [0.07, DESK_Y + 0.08, -0.258], 0.13);
    badge(0.11, [-0.09, DESK_Y + 0.075, -0.258], comp);
    for (let k = 0; k < 6; k++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.06, 0.002), darkM); v.position.set(-0.16 + k * 0.012, DESK_Y + 0.11, -0.259); comp.add(v); }
    powerLed = led('#3aff5a', [0.15, DESK_Y + 0.035, -0.259], comp);
    kb = { pos: [0, DESK_Y, -0.02], w: 0.34, d: 0.14, h0: 0.02, h1: 0.034, wedge: false };
  } else {
    let baseY = DESK_Y;
    if (style === 'box') {
      const unit = new THREE.Mesh(softBox(0.5, 0.12, 0.42, 0.012), caseM); unit.position.set(0, DESK_Y + 0.06, -0.45); comp.add(unit);
      floppy(comp, [0.1, DESK_Y + 0.075, -0.238]); floppy(comp, [0.1, DESK_Y + 0.03, -0.238]);
      badge(0.15, [-0.13, DESK_Y + 0.075, -0.239], comp);
      powerLed = led('#3aff5a', [-0.2, DESK_Y + 0.03, -0.239], comp);
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.01), S.mat('#c83a2a')); sw.position.set(-0.17, DESK_Y + 0.03, -0.238); comp.add(sw);
      baseY = DESK_Y + 0.12;
      kb = { pos: [0, DESK_Y, -0.02], w: 0.36, d: 0.15, h0: 0.02, h1: 0.036, wedge: false };
    } else {
      kb = { pos: [0, DESK_Y, -0.03], w: 0.39, d: 0.19, h0: 0.025, h1: 0.06, wedge: true };
      // a disk drive to one side, with its cable
      const dz = -0.2, dx = 0.43;
      const drv = new THREE.Mesh(softBox(0.2, 0.075, 0.27, 0.008), caseM); drv.position.set(dx, DESK_Y + 0.0375, dz - 0.1); comp.add(drv);
      floppy(comp, [dx, DESK_Y + 0.042, dz + 0.037], 0.16);
    }
    const mh = 0.34, mw = 0.42;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.025, 20), darkM); stand.position.set(0, baseY + 0.0125, -0.44); comp.add(stand);
    const mon = new THREE.Group(); mon.position.set(0, baseY + 0.025 + mh / 2, -0.33); comp.add(mon);
    crt(mw, mh, 0.3, screenW, screenH, 0.015, mon);
    screenPos.set(0, baseY + 0.025 + mh / 2 + 0.015, -0.322);
    badge(0.1, [-0.13, -mh / 2 + 0.028, 0.001], mon);
    for (let k = 0; k < 2; k++) { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), darkM); kn.rotation.x = Math.PI / 2; kn.position.set(0.1 + k * 0.025, -mh / 2 + 0.028, 0.003); mon.add(kn); }
    const pl = led('#3aff5a', [0.17, -mh / 2 + 0.028, 0.002], mon); if (!powerLed) powerLed = pl;
  }
  // the glass
  const screenTex = new THREE.DataTexture(new Uint8Array(TW * TH), TW, TH, THREE.RedFormat);
  screenTex.magFilter = screenTex.minFilter = THREE.NearestFilter; screenTex.generateMipmaps = false; screenTex.needsUpdate = true; S.keep(screenTex);
  const SU = { uTex: { value: screenTex }, uCol: { value: new THREE.Color(phos) }, uB: { value: 1 }, uTime: S.U.uTime, uOn: { value: 0 }, uLamp: { value: 1 }, uFlash: { value: 0 }, uRes: { value: new THREE.Vector2(TW, TH) } };
  const sg = new THREE.PlaneGeometry(screenW, screenH, 12, 9), sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) { const u = sp.getX(i) / (screenW / 2), v = sp.getY(i) / (screenH / 2); sp.setZ(i, 0.012 * (1 - u * u * 0.5 - v * v * 0.5)); }
  const glass = new THREE.Mesh(sg, new THREE.ShaderMaterial({ uniforms: SU, vertexShader: SCREEN_V, fragmentShader: SCREEN_F }));
  glass.position.copy(screenPos).add(new THREE.Vector3(0, 0, 0.004)); S.add(glass);
  const screenLight = new THREE.PointLight(phos, 0.05, 2.6, 2); screenLight.position.copy(screenPos).add(new THREE.Vector3(0, -0.02, 0.32)); S.add(screenLight);

  // ---------------------------------------------------------------- the keyboard, keys that go down as they're typed
  const kbG = new THREE.Group(); kbG.position.set(...kb.pos); S.add(kbG);
  {
    const sh = new THREE.Shape(); sh.moveTo(-kb.d / 2, 0); sh.lineTo(kb.d / 2, 0); sh.lineTo(kb.d / 2, kb.h0); sh.lineTo(-kb.d / 2, kb.h1); sh.closePath();
    const eg = new THREE.ExtrudeGeometry(sh, { depth: kb.w, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 });
    eg.translate(0, 0, -kb.w / 2); eg.rotateY(-Math.PI / 2);
    const body = new THREE.Mesh(eg, caseM); kbG.add(body);
    if (kb.wedge) { badge(0.12, [-kb.w / 2 + 0.08, kb.h1 - (0.03 * (kb.h1 - kb.h0)) / kb.d + 0.0015, -kb.d / 2 + 0.03], kbG).rotation.x = -Math.PI / 2 + Math.atan2(kb.h1 - kb.h0, kb.d); powerLed = powerLed || led('#ff4a3a', [kb.w / 2 - 0.03, kb.h1 - 0.008, -kb.d / 2 + 0.02], kbG); }
  }
  const plate = new THREE.Group(); kbG.add(plate);
  const tilt = Math.atan2(kb.h1 - kb.h0, kb.d);
  plate.rotation.x = tilt; plate.position.set(0, (kb.h0 + kb.h1) / 2 + 0.003, kb.wedge ? 0.025 : 0.005);
  const P = 0.0185, KEYS = [], keyIndex = {};
  const row = (z, x0, items) => { let x = x0; for (const [label, w = 1, kind = 'key'] of items) { KEYS.push({ label, x: x + (w * P) / 2, z, w, kind }); x += w * P; } };
  const chars = (s) => [...s].map((c) => [c]);
  row(-2 * P, -7.25 * P, [['ESC', 1, 'mod'], ...chars('1234567890-='), ['DEL', 1.5, 'mod']]);
  row(-1 * P, -7.25 * P, [['CTRL', 1.5, 'mod'], ...chars('QWERTYUIOP'), ['@'], ['*', 1.5]]);
  row(0, -7.25 * P, [['CAPS', 1.75, 'mod'], ...chars('ASDFGHJKL;'), [':'], ['RETURN', 2.25, 'accent']]);
  row(P, -7.25 * P, [['SHIFT', 2.25, 'mod'], ...chars('ZXCVBNM,./'), ['SHIFT', 2.75, 'mod']]);
  row(2 * P, -4 * P, [['SPACE', 8.5, 'space']]);
  if (kb.wedge || (kb.w >= 0.36 && rand() < 0.5)) for (let k = 0; k < 4; k++) KEYS.push({ label: `F${k * 2 + 1}`, x: 8.6 * P, z: (k - 1.5) * P * 1.05, w: 1.3, kind: 'accent' });
  KEYS.forEach((k, i) => { if (k.label.length === 1) keyIndex[k.label] = i; else if (!(k.label in keyIndex)) keyIndex[k.label] = i; });
  // legends: a little atlas of what's printed on the keys
  const legends = [...new Set(KEYS.map((k) => k.label))], AT = 8;
  const legTex = canvasTexture(S, 512, 512, (g) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    legends.forEach((l, i) => { g.font = l.length > 2 ? 'bold 15px sans-serif' : 'bold 30px sans-serif'; g.fillText(l === 'SPACE' ? '' : l, (i % AT) * 64 + 32, Math.floor(i / AT) * 64 + 32); });
  });
  const capGeo = new THREE.BoxGeometry(1, 1, 1);
  { const p = capGeo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.84); p.setZ(i, p.getZ(i) * 0.84); } capGeo.computeVertexNormals(); }
  const cell = new Float32Array(KEYS.length * 2), aspect = new Float32Array(KEYS.length);
  KEYS.forEach((k, i) => { const li = legends.indexOf(k.label); cell[i * 2] = li % AT; cell[i * 2 + 1] = AT - 1 - Math.floor(li / AT); aspect[i] = k.w; });
  capGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
  capGeo.setAttribute('aW', new THREE.InstancedBufferAttribute(aspect, 1));
  const capMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  capMat.onBeforeCompile = (sh) => {
    sh.uniforms.uLeg = { value: legTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell; attribute float aW; varying vec2 vLeg; varying float vTop;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTop = step(0.5, normal.y);\nvec2 lu = vec2(0.5 + (uv.x - 0.5) * aW, uv.y); lu = clamp((lu - 0.5) * 0.92 + 0.5, 0.0, 1.0);\nvLeg = (aCell + lu) / 8.0;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uLeg; varying vec2 vLeg; varying float vTop;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat la = vTop * texture2D(uLeg, vLeg).a;\nfloat lum = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));\ndiffuseColor.rgb = mix(diffuseColor.rgb, lum > 0.3 ? vec3(0.08) : vec3(0.82, 0.8, 0.74), la * 0.9);');
  };
  const keys = new THREE.InstancedMesh(capGeo, capMat, KEYS.length); plate.add(keys);
  const kc = new THREE.Color(), modCol = keyCol === darkCol ? caseCol : darkCol;
  KEYS.forEach((k, i) => keys.setColorAt(i, kc.set(k.kind === 'accent' ? accent : k.kind === 'mod' ? modCol : keyCol)));
  const press = new Float32Array(KEYS.length), m4 = new THREE.Matrix4(), kq = new THREE.Quaternion(), kv = new THREE.Vector3(), ks = new THREE.Vector3();
  function placeKeys() {
    for (let i = 0; i < KEYS.length; i++) { const k = KEYS[i]; ks.set(k.w * P - 0.0028, 0.008, P - 0.0028); kv.set(k.x, 0.004 - press[i] * 0.0035, k.z); keys.setMatrixAt(i, m4.compose(kv, kq, ks)); }
    keys.instanceMatrix.needsUpdate = true;
  }
  placeKeys();
  const SHIFTED = { '?': '/', '"': '2', '!': '1', '+': ';', '(': '8', ')': '9', '=': '-' };
  function hitKey(c) {
    const name = c === ' ' ? 'SPACE' : c === '\n' ? 'RETURN' : c === '\b' ? 'DEL' : SHIFTED[c] || c;
    const i = keyIndex[name]; if (i != null) press[i] = 1;
    if (SHIFTED[c] && keyIndex.SHIFT != null) press[keyIndex.SHIFT] = 1;
  }

  // ---------------------------------------------------------------- the desk: lamp, clock, cocoa, disks, a joystick
  const lampG = new THREE.Group(); lampG.position.set(-0.56, DESK_Y, -0.5); S.add(lampG);
  const lampCol = pick(['#c83a2a', '#2a4a8a', '#e8e0d0', '#2a2a2a', '#d8a02a']), lampM = S.mat(lampCol);
  const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.025, 20), lampM); lbase.position.y = 0.0125; lampG.add(lbase);
  const arm = (a, b) => { const v = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, v.length(), 8), S.mat('#9a9a9a')); m.position.copy(a).addScaledVector(v, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); lampG.add(m); };
  const j1 = new THREE.Vector3(0, 0.025, 0), j2 = new THREE.Vector3(0.05, 0.32, 0.06), j3 = new THREE.Vector3(0.2, 0.44, 0.17);
  arm(j1, j2); arm(j2, j3);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.075, 0.1, 20, 1, true), new THREE.MeshLambertMaterial({ color: lampCol, side: THREE.DoubleSide })); head.position.copy(j3); head.rotation.set(0.5, 0, 0.55); lampG.add(head);
  const bulbM = new THREE.MeshBasicMaterial({ color: '#fff2d0', toneMapped: false }); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), bulbM); bulb.position.copy(j3).add(new THREE.Vector3(0.012, -0.03, 0.012)); lampG.add(bulb);
  const lamp = new THREE.SpotLight('#ffd6a0', 1.2, 3, 0.85, 0.7, 1.6); lamp.position.copy(j3).add(lampG.position); lamp.target.position.set(-0.32, DESK_Y, 0.02); S.add(lamp); S.add(lamp.target);
  // the clock (red digits, the real time)
  const clockC = document.createElement('canvas'); clockC.width = 128; clockC.height = 48;
  const clockTex = S.keep(new THREE.CanvasTexture(clockC)); clockTex.colorSpace = THREE.SRGBColorSpace;
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  let clockKey = '';
  function drawClock(now) {
    const hh = now.getHours(), mm = now.getMinutes(), colon = now.getSeconds() % 2 === 0, key = `${hh}:${mm}:${colon}`;
    if (key === clockKey) return; clockKey = key;
    const g = clockC.getContext('2d'); g.fillStyle = '#0a0302'; g.fillRect(0, 0, 128, 48);
    const digit = (d, x, on) => { const s = SEG[d]; const seg = (k, sx, sy, w, h) => { g.fillStyle = s.includes(k) && on ? '#ff3a24' : '#2a0804'; g.fillRect(x + sx, sy, w, h); }; seg('a', 4, 4, 14, 3); seg('b', 18, 7, 3, 15); seg('c', 18, 26, 3, 15); seg('d', 4, 41, 14, 3); seg('e', 1, 26, 3, 15); seg('f', 1, 7, 3, 15); seg('g', 4, 22.5, 14, 3); };
    const h12 = String(hh % 12 || 12).padStart(2, ' '), m2 = String(mm).padStart(2, '0');
    if (h12[0] !== ' ') digit(+h12[0], 6, true); digit(+h12[1], 32, true);
    g.fillStyle = colon ? '#ff3a24' : '#2a0804'; g.fillRect(60, 15, 4, 4); g.fillRect(60, 29, 4, 4);
    digit(+m2[0], 72, true); digit(+m2[1], 98, true);
    clockTex.needsUpdate = true;
  }
  drawClock(new Date());
  const clockG = new THREE.Group(); clockG.position.set(0.52, DESK_Y, -0.48); clockG.rotation.y = -0.4; S.add(clockG);
  const cbody = new THREE.Mesh(softBox(0.16, 0.07, 0.08, 0.01), S.mat('#1e1c1c')); cbody.position.y = 0.035; clockG.add(cbody);
  const cface = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.049), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false })); cface.position.set(0, 0.036, 0.0405); clockG.add(cface);
  const clockLight = new THREE.PointLight('#ff3a20', 0.06, 0.6, 2); clockLight.position.set(0.52, DESK_Y + 0.05, -0.38); S.add(clockLight);
  // a mug of cocoa, steaming (until it goes cold)
  const mugX = style === 'wedge' ? 0.48 : 0.42, mugZ = style === 'wedge' ? 0.02 : -0.12;
  const mugCol = pick(['#e8e0d0', '#c83a3a', '#3a6aa8', '#e8c040']);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 18, 1, true), new THREE.MeshLambertMaterial({ color: mugCol, side: THREE.DoubleSide })); mug.position.set(mugX, DESK_Y + 0.0475, mugZ); S.add(mug);
  const cocoa = new THREE.Mesh(new THREE.CircleGeometry(0.037, 18), S.mat('#3a2218')); cocoa.rotation.x = -Math.PI / 2; cocoa.position.set(mugX, DESK_Y + 0.08, mugZ); S.add(cocoa);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 16, Math.PI), S.mat(mugCol)); handle.rotation.z = -Math.PI / 2; handle.position.set(mugX + 0.04, DESK_Y + 0.05, mugZ); S.add(handle);
  const SN = 14, sSeed = new Float32Array(SN).map((_, k) => k / SN), sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3)); sGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const steamU = { uTime: S.U.uTime, uScale: S.U.uScale, uA: { value: 1 } };
  const steam = new THREE.Points(sGeo, new THREE.ShaderMaterial({ uniforms: steamU, transparent: true, depthWrite: false,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale; varying float vA, vS;
      void main() { float age = fract(uTime * 0.22 + aSeed);
        vec3 q = position + vec3(sin(aSeed * 40.0 + uTime * 0.9 + age * 4.0) * 0.012 * (0.3 + age), age * 0.16, cos(aSeed * 25.0 + uTime * 0.7) * 0.008 * age);
        vec4 mv = viewMatrix * vec4(q, 1.0); gl_PointSize = uScale * 0.035 * (0.5 + age * 1.5) / -mv.z;
        vA = smoothstep(0.0, 0.2, age) * (1.0 - age) * 0.1; vS = aSeed; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uA; varying float vA, vS; void main() { vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
      gl_FragColor = vec4(vec3(0.85, 0.82, 0.78), vA * uA * (1.0 - smoothstep(0.2, 1.0, r))); }` }));
  steam.position.set(mugX, DESK_Y + 0.085, mugZ); steam.frustumCulled = false; S.add(steam);
  // floppy disks, a little stack and one on its own, labelled in felt tip
  const diskLabels = ['GAMES', 'HOMEWORK', 'DO NOT ERASE', 'MUSIC', 'MY STORY', 'BACKUP', 'SECRET'];
  for (let k = 0; k < 4; k++) {
    const lab = diskLabels[Math.floor(rand() * diskLabels.length)], dc = pick(['#1a1a1c', '#2a2a5a', '#1a1a1c', '#5a1a1a']);
    const t = canvasTexture(S, 64, 64, (g) => { g.fillStyle = dc; g.fillRect(0, 0, 64, 64); g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(32, 36, 10, 0, TAU); g.fill(); g.fillStyle = '#7a6a5a'; g.beginPath(); g.arc(32, 36, 4, 0, TAU); g.fill(); g.fillStyle = '#f2ecd8'; g.fillRect(6, 4, 52, 16); g.fillStyle = '#2a3a8a'; g.font = '9px sans-serif'; g.fillText(lab, 9, 15); g.fillStyle = '#0a0a0a'; g.fillRect(28, 46, 8, 16); });
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.0025, 0.13), [S.mat(dc), S.mat(dc), new THREE.MeshLambertMaterial({ map: t }), S.mat(dc), S.mat(dc), S.mat(dc)]);
    const solo = k === 3;
    d.position.set(solo ? -0.32 : -0.5, DESK_Y + 0.00125 + (solo ? 0 : k * 0.0026), solo ? -0.02 : -0.1); d.rotation.y = solo ? 0.5 : (rand() - 0.5) * 0.4; S.add(d);
  }
  // a joystick
  const joy = new THREE.Group(); joy.position.set(-0.36, DESK_Y, -0.32); joy.rotation.y = 0.3; S.add(joy);
  const jb = new THREE.Mesh(softBox(0.09, 0.03, 0.09, 0.008), S.mat('#1e1e1e')); jb.position.y = 0.015; joy.add(jb);
  const js = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.09, 8), S.mat('#2a2a2a')); js.position.y = 0.075; js.rotation.z = 0.15; joy.add(js);
  const jk = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), S.mat('#c82a2a')); jk.position.set(-0.007, 0.12, 0); joy.add(jk);
  const jbtn = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 10), S.mat('#c82a2a')); jbtn.position.set(0.028, 0.032, 0.028); joy.add(jbtn);


  // ---------------------------------------------------------------- the terminal
  const grid = Array.from({ length: ROWS }, () => new Uint8Array(COLS).fill(32));
  let cx = 0, cy = 0;
  const outQ = []; let printAcc = 0;
  let thinkUntil = 0, progress = null, sleepT = -1, lampOn = 1, lampWant = 1, flash = 0, bootDone = false;
  const scrollUp = () => { for (let r = 0; r < ROWS - 1; r++) grid[r].set(grid[r + 1]); grid[ROWS - 1].fill(32); };
  const newline = () => { cx = 0; cy++; if (cy >= ROWS) { scrollUp(); cy = ROWS - 1; } };
  function putc(c) {
    if (c === '\n') { newline(); return; }
    if (c === '\b') { if (cx > 2 || (cx > 0 && grid[cy][0] !== 62)) { cx--; grid[cy][cx] = 32; } return; }
    if (cx >= COLS) newline();
    grid[cy][cx] = c === '#' ? 127 : c.charCodeAt(0); cx++;
  }
  const print = (s) => { for (const c of s) outQ.push(c); };
  const BOOT = [`*** ${brand} ${model} ***`.slice(0, COLS), `(C) ${year} ${brand} LTD`.slice(0, COLS), `${bytes} BYTES FREE`, '', 'READY.', ''];

  function apply(op) {
    if (op.type === 'key') { hitKey(op.c); if (outQ.length || progress) outQ.push(op.c); else putc(op.c); } // typed while it's still printing: it shows after
    else if (op.type === 'say') { print(op.text); if (op.text.includes('NO')) flash = Math.max(flash, 0.12); }
    else if (op.type === 'think') thinkUntil = clock + op.dur;
    else if (op.type === 'progress') { outQ.push({ progress: op.dur }); }
    else if (op.type === 'prompt') outQ.push('prompt');
    else if (op.type === 'lamp') lampWant = 0;
    else if (op.type === 'sleep') sleepT = 0;
  }
  // with no music playing, it runs its own conversation
  let heard = -1e9, local = null, localQ = [], localNext = 0;
  S.onEvent((ev) => {
    if (!['key', 'say', 'think', 'progress', 'prompt', 'lamp', 'sleep'].includes(ev.type)) return;
    heard = clock; local = null; localQ = [];
    apply(ev);
  });

  // ---------------------------------------------------------------- drawing the screen
  const tgt = new Uint8Array(TW * TH), glowBuf = new Float32Array(TW * TH), out = screenTex.image.data;
  function cellAt(r, c, code, inten = 255) {
    const x0 = OX + c * CW, y0 = OY + r * CH;
    if (code === 127) { for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) tgt[(TH - 1 - (y0 + y)) * TW + x0 + x] = inten; return; }
    const g = FONT[code - 32]; if (!g) return;
    for (let x = 0; x < 5; x++) { const bits = g[x]; if (!bits) continue; for (let y = 0; y < 7; y++) if (bits & (1 << y)) tgt[(TH - 1 - (y0 + y + 1)) * TW + x0 + x] = inten; }
  }
  let lit = 0;
  function drawScreen(dt, t) {
    tgt.fill(0);
    const dim = sleepT >= 0 ? 1 - sstep(20, 45, sleepT) : 1; // in its sleep, the words fade away and only the cursor's left
    if (dim > 0.01) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const code = grid[r][c]; if (code !== 32) cellAt(r, c, code, 255 * dim); }
    const thinking = t < thinkUntil;
    if (thinking) cellAt(cy, Math.min(cx, COLS - 1), '|/-\\'.charCodeAt(Math.floor(t * 8) % 4));
    else if (!outQ.length && !progress) {
      const period = sleepT >= 0 ? 1.06 + sstep(0, 60, sleepT) * 2.4 : 1.06;
      if ((t % period) < period / 2) cellAt(Math.min(cy, ROWS - 1), Math.min(cx, COLS - 1), 127, sleepT >= 0 ? 200 : 255);
    }
    const k = Math.exp(-dt * 16);
    lit = 0;
    for (let i = 0; i < TW * TH; i++) { const v = Math.max(tgt[i], glowBuf[i] * k); glowBuf[i] = v; out[i] = v; lit += v; }
    lit /= TW * TH * 255;
    screenTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the camera: sat at the desk
  const look = new THREE.Vector3(), eye = new THREE.Vector3();
  let clock = 0;
  S.on((t, dt, st) => {
    clock = t;
    const e = st.energy;
    // switching on, then the start-up message
    SU.uOn.value = Math.min(1, t / 1.4);
    if (!bootDone && t > 1.8) { bootDone = true; for (const l of BOOT) print(l + '\n'); outQ.push('prompt'); }
    // its own conversation, if the music isn't telling it what's typed
    if (!local && t - heard > (heard < 0 ? 14 : 40) && t > 14 && sleepT < 0) { local = createTalk(Math.random); localNext = t; }
    if (local) {
      if (!localQ.length && t >= localNext && !local.ended) { const x = local.next(e); localQ = x.acts.map((a) => ({ ...a, at: a.at + t })); localNext = t + x.len; }
      while (localQ.length && localQ[0].at <= t) apply(localQ.shift());
    }
    // printing what it has to say
    printAcc += dt * 40;
    while (printAcc >= 1 && outQ.length) {
      const c = outQ[0];
      if (c === 'prompt') { if (cx > 0) newline(); putc('>'); putc(' '); outQ.shift(); continue; }
      if (typeof c === 'object') { // a progress bar: brackets, then blocks filling in
        if (!progress) { progress = { dur: c.progress, t: 0, col: cx, row: cy }; putc('['); for (let i = 0; i < 8; i++) putc(' '); putc(']'); }
        break;
      }
      putc(c); outQ.shift(); printAcc -= 1;
    }
    if (printAcc > 2) printAcc = 2;
    if (progress) {
      progress.t += dt;
      const n = Math.min(8, Math.floor((progress.t / progress.dur) * 8));
      for (let i = 0; i < n; i++) if (progress.row < ROWS && progress.col + 1 + i < COLS) grid[progress.row][progress.col + 1 + i] = 127;
      if (progress.t >= progress.dur) { progress = null; outQ.shift(); print(' 100%\n'); }
    }
    drawScreen(dt, t);

    // keys spring back up
    let moved = false;
    for (let i = 0; i < press.length; i++) if (press[i] > 0) { press[i] = Math.max(0, press[i] - dt * 9); moved = true; }
    if (moved) placeKeys();

    // the lamp (it goes off when they turn it off, or late in the night regardless), the screen's glow, the LEDs
    if (e < 0.24) lampWant = 0;
    lampOn = lampWant ? lerp(lampOn, 1, 1 - Math.exp(-dt * 8)) : Math.max(0, lampOn - dt * 7);
    lamp.intensity = 1.2 * lampOn; bulbM.color.setRGB(1, 0.95, 0.82).multiplyScalar(0.08 + 0.92 * lampOn);
    SU.uLamp.value = lampOn;
    flash = Math.max(0, flash - dt * 0.5);
    SU.uFlash.value = flash;
    const asleep = sleepT >= 0 ? sstep(0, 30, (sleepT += dt)) : 0;
    SU.uB.value = 1 - 0.45 * asleep;
    screenLight.intensity = (0.02 + lit * 0.7) * SU.uB.value * SU.uOn.value;
    hemi.intensity = 0.2 + 0.1 * lampOn;
    const thinking = t < thinkUntil;
    for (const l of driveLeds) l.material.color.copy(l.userData.base).multiplyScalar(thinking && Math.sin(t * 40 + l.id) > -0.3 ? 1 : 0.08);
    if (!driveLeds.length && powerLed) powerLed.material.color.copy(powerLed.userData.base).multiplyScalar(thinking && Math.sin(t * 30) > 0 ? 0.3 : 1);
    else if (powerLed) powerLed.material.color.copy(powerLed.userData.base).multiplyScalar(sleepT >= 0 ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.2)) : 1);
    if (Math.floor(t) !== Math.floor(t - dt)) drawClock(new Date());
    steamU.uA.value = sstep(0.3, 0.7, e); // the cocoa goes cold

    // sat at the desk, looking at the screen; easing back a little as the night goes on
    const cam = S.camera, tanH = Math.tan((cam.fov * Math.PI) / 360), a = cam.aspect || 1;
    const dH = (screenH * 1.55) / (0.42 * 2 * tanH), dW = (screenW * 1.45) / (0.95 * 2 * tanH * a);
    const back = 1 + 0.18 * (1 - sstep(0.25, 0.9, e)) + 0.12 * asleep;
    const dist = Math.max(dH, dW) * back;
    const portrait = a < 0.8;
    eye.set(Math.sin(t * 0.05) * 0.03 * dist, screenPos.y + 0.1 * dist + Math.sin(t * 0.21) * 0.004, screenPos.z + dist);
    cam.position.copy(eye);
    look.set(Math.sin(t * 0.05 + 1) * 0.01, screenPos.y - (portrait ? 0.16 : 0.07) * Math.min(1.4, dist), screenPos.z);
    cam.lookAt(look);
  });

  S.scene.userData.saysno = { get grid() { return grid.map((r) => String.fromCharCode(...r)).join('\n'); }, style, brand, model, phos, get lamp() { return lampOn; }, get asleep() { return sleepT; }, get local() { return !!local; }, apply };
  return S.finalize({ portraitFov: 56 });
}
