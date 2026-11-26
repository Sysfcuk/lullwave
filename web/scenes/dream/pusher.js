// Any Second Now: a 2p coin pusher in a seaside amusement arcade, late at night. Coins drop through
// the slot, roll down the rail and land on the moving shelf; the shelf slides in and out, pushing the
// pile towards the edge, and the coins at the front edge hang further and further over it, teetering
// with every push. Any second now. They never fall. The machine takes every coin (now and then one
// slips away into the side gutters, the house's share), the pile grows into a shingled wall over the
// lip, and the payout tray stays empty. The counter on the front says so: PAID OUT 0.
//
// The coins are a small simulation of our own: discs on two levels (the shelf, and the bed below
// it) that push apart, ride on each other, climb when they're squeezed, and fall from the shelf to the
// bed, all with one rule bent: at the front edge a coin can hang almost halfway over, but no further.
import { createStage, canvasTexture, THREE, TAU } from '../kit.js';
import { softBox } from '../interior.js';

const R = 0.0129, T = 0.0021; // a 2p coin: 25.9 mm across
const W = 0.5, HALF = W / 2, ZEDGE = 0.11, H1 = 0.034, ZBACK = -0.3, STROKE = 0.055, ZMID = -0.06, SHELF_D = 0.205;
const N = 580;
const FREE = 0, SHELF = 1, BED = 2, CHUTE = 3, GONE = 4;
const CHUTE_T = 1.3;

export function createPusherScene({ mobile, seed }) {
  const S = createStage({ mobile, seed, salt: 0x2e2e, bg: '#07060c', exposure: 1.0, bloom: [0.6, 0.45, 0.78], finish: { vignette: 0.45, grain: 0.03, ca: 0.3 }, fov: 40 });
  const { rand } = S;
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const lerp = (a, b, k) => a + (b - a) * k;
  const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

  // ---------------------------------------------------------------- the coins
  const X = new Float32Array(N), Z = new Float32Array(N), Y = new Float32Array(N), VY = new Float32Array(N);
  const DX = new Float32Array(N), DZ = new Float32Array(N), PX = new Float32Array(N), PZ = new Float32Array(N);
  const ST = new Uint8Array(N), SUP = new Int16Array(N).fill(-1), SPIN = new Float32Array(N), WOB = new Float32Array(N), AGE = new Float32Array(N);
  const TX = new Float32Array(N), TZ = new Float32Array(N), DROPX = new Float32Array(N), SIDE = new Float32Array(N);
  for (let i = 0; i < N; i++) { SPIN[i] = rand() * TAU; WOB[i] = rand() * TAU; }
  let zf = ZMID, dzf = 0, pushT0 = 0, pushDur = 2.8, coinsIn = 0, shake = 0;
  const free = () => { for (let i = 0; i < N; i++) if (ST[i] === FREE) return i; return -1; };
  const place = (st, x, z, y) => { const i = free(); if (i < 0) return -1; ST[i] = st; X[i] = x; Z[i] = z; Y[i] = y; VY[i] = 0; DX[i] = DZ[i] = 0; SUP[i] = -1; AGE[i] = 0; return i; };
  // the pile, to begin with: a packed bed, a second layer towards the front, a few on the shelf
  for (let row = 0; row < 12; row++) for (let k = 0; k < 20; k++) {
    const x = -HALF + R + k * 2 * R * 0.99 + (row % 2) * R + (rand() - 0.5) * 0.004, z = ZMID + STROKE / 2 + R + row * R * 1.75;
    if (x < HALF - R && z < ZEDGE + 0.3 * R) place(BED, x, z, 0);
  }
  for (let k = 0; k < 190; k++) place(BED, (rand() - 0.5) * (W - 2 * R), lerp(-0.01, ZEDGE + 0.2 * R, Math.pow(rand(), 0.6)), T * (1 + Math.floor(rand() * 3)));
  for (let k = 0; k < 45; k++) place(SHELF, (rand() - 0.5) * (W - 2 * R), ZMID - rand() * (SHELF_D - 2 * R), H1);

  // ---------------------------------------------------------------- the simulation
  const CELL = 2 * R, grid = new Map(), key = (ix, iz) => (ix + 100) * 1000 + (iz + 100);
  function buildGrid() {
    grid.clear();
    for (let i = 0; i < N; i++) { if (ST[i] !== SHELF && ST[i] !== BED) continue; const k = key(Math.floor(X[i] / CELL), Math.floor(Z[i] / CELL)); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(i); }
  }
  function neighbours(i, fn) {
    const cx = Math.floor(X[i] / CELL), cz = Math.floor(Z[i] / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const g = grid.get(key(cx + a, cz + b)); if (g) for (const j of g) if (j !== i) fn(j); }
  }
  let pressFront = 0;
  function step(dt, t) {
    // the shelf: in and out, once a bar
    const ph = (t - pushT0) / pushDur, nz = ZMID - (STROKE / 2) * Math.cos(TAU * ph);
    dzf = nz - zf; zf = nz;
    for (let i = 0; i < N; i++) { PX[i] = X[i]; PZ[i] = Z[i]; }
    // carried: shelf coins move with the shelf, coins riding on others move with them
    for (let i = 0; i < N; i++) {
      if (ST[i] === SHELF) Z[i] += dzf;
      else if (ST[i] === BED && SUP[i] >= 0) { X[i] += DX[SUP[i]] * 0.85; Z[i] += DZ[SUP[i]] * 0.85; }
    }
    buildGrid();
    pressFront = 0;
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < N; i++) {
        const s = ST[i]; if (s !== SHELF && s !== BED) continue;
        neighbours(i, (j) => {
          if (j < i || ST[j] !== s || Math.abs(Y[i] - Y[j]) > T * 0.9) return;
          const dx = X[j] - X[i], dz = Z[j] - Z[i], d2 = dx * dx + dz * dz;
          if (d2 >= 4 * R * R) return;
          const d = Math.sqrt(d2) || 1e-6, ov = 2 * R - d;
          if (ov > 0.62 * R) { const back = Z[i] < Z[j] ? i : j, front = back === i ? j : i; Y[back] = Y[front] + T; return; } // squeezed: it climbs on
          const ux = dx / d, uz = dz / d, h = ov / 2;
          X[i] -= ux * h; Z[i] -= uz * h; X[j] += ux * h; Z[j] += uz * h;
        });
      }
      for (let i = 0; i < N; i++) {
        const s = ST[i];
        if (s === SHELF) {
          if (Z[i] < ZBACK + R) Z[i] = ZBACK + R;
          X[i] = Math.max(-HALF + R, Math.min(HALF - R, X[i]));
          if (Z[i] > zf + 0.25 * R) { ST[i] = BED; VY[i] = 0; } // over the shelf's front: it drops to the bed
        } else if (s === BED) {
          if (Y[i] < H1 - T * 0.5 && Z[i] < zf + R) Z[i] = zf + R; // the shelf's face pushes
          if (Z[i] > ZEDGE + 0.43 * R) { Z[i] = ZEDGE + 0.43 * R; pressFront++; } // the one rule bent: never further than this
          X[i] = Math.max(-HALF + R, Math.min(HALF - R, X[i]));
        }
      }
    }
    // heights: each coin rests on whatever is under it (or the bed, or the shelf)
    for (let i = 0; i < N; i++) {
      const s = ST[i]; if (s !== SHELF && s !== BED) continue;
      let sup = s === SHELF ? H1 : 0, who = -1;
      neighbours(i, (j) => {
        if (ST[j] !== s || Y[j] > Y[i] - T * 0.5) return;
        const dx = X[j] - X[i], dz = Z[j] - Z[i];
        if (dx * dx + dz * dz < 1.75 * R * 1.75 * R && Y[j] + T > sup) { sup = Y[j] + T; who = j; }
      });
      if (s === BED && Y[i] >= H1 - 0.002 && Z[i] < zf - 0.2 * R) sup = Math.max(sup, H1); // up on the shelf's top
      SUP[i] = who;
      if (Y[i] > sup + 0.0003) { VY[i] -= 9.8 * dt; Y[i] += VY[i] * dt; if (Y[i] < sup) { Y[i] = sup; VY[i] = 0; } } else { Y[i] = sup; VY[i] = 0; }
      // how it sits: tipped towards the coin under it, or (at the lip) leaning out over the edge
      let tx = 0, tz = 0;
      if (who >= 0) { tx = (Z[i] - Z[who]) / (2 * R) * 0.45; tz = -(X[i] - X[who]) / (2 * R) * 0.45; }
      const over = Z[i] - (ZEDGE - 0.15 * R);
      if (s === BED && over > 0 && who < 0 && Y[i] < T * 0.6) tx += (over / R) * 0.55 + Math.sin(t * 6.5 + WOB[i]) * (0.02 + 0.1 * shake) * (over / R);
      TX[i] = lerp(TX[i], tx, 0.3); TZ[i] = lerp(TZ[i], tz, 0.3);
    }
    for (let i = 0; i < N; i++) { DX[i] = X[i] - PX[i]; DZ[i] = Z[i] - PZ[i]; }
  }
  // a coin through the slot: down the rail on its edge, then a drop onto the shelf
  function insert() {
    const i = place(CHUTE, 0, 0, 0); if (i < 0) return;
    DROPX[i] = (rand() - 0.5) * 0.34; coinsIn++;
  }
  // the house's share: a coin nearest a side gutter slips away
  function absorb(auto = false) {
    let best = -1, bs = -1;
    for (let i = 0; i < N; i++) if (ST[i] === BED && Y[i] < T * 2.5) { const sc = Math.abs(X[i]) + (Z[i] > 0 ? 0.05 : 0) + (auto ? 0 : rand() * 0.02); if (sc > bs) { bs = sc; best = i; } }
    if (best >= 0) { ST[best] = GONE; AGE[best] = 0; SIDE[best] = Math.sign(X[best]) || 1; }
  }
  const count = () => { let c = 0; for (let i = 0; i < N; i++) if (ST[i] === SHELF || ST[i] === BED) c++; return c; };
  // settle the pile before anyone looks
  for (let k = 0; k < 240; k++) step(1 / 60, k / 60);

  // ---------------------------------------------------------------- how the coins look: copper, some bright and new, some old and brown
  const env = canvasTexture(S, 512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1a30'); gr.addColorStop(0.5, '#140c18'); gr.addColorStop(1, '#0a0608'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) { g.fillStyle = pick(['#ffd080', '#ff6080', '#60c0ff', '#ffe0a0', '#ff9040']); g.globalAlpha = 0.5 + Math.random() * 0.5; g.beginPath(); g.arc(Math.random() * w, Math.random() * h * 0.6, 2 + Math.random() * 7, 0, TAU); g.fill(); }
    g.globalAlpha = 1; g.fillStyle = '#ffe6b0'; g.fillRect(0, h * 0.18, w, 6);
  });
  env.mapping = THREE.EquirectangularReflectionMapping; S.scene.environment = env;
  const coinTex = canvasTexture(S, 256, 256, (g, w, h) => {
    g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8e8e8'; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 10, 0, TAU); g.stroke();
    g.strokeStyle = '#7a7a7a'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 22, 0, TAU); g.stroke();
    for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU; g.fillStyle = '#9a9a9a'; g.fillRect(w / 2 + Math.cos(a) * (w / 2 - 30) - 2, h / 2 + Math.sin(a) * (h / 2 - 30) - 2, 4, 4); }
    g.fillStyle = '#ececec'; g.font = 'bold 120px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2', w / 2, h / 2 + 6);
    g.fillStyle = '#8a8a8a'; g.fillText('2', w / 2 + 3, h / 2 + 10); g.fillStyle = '#f4f4f4'; g.fillText('2', w / 2 - 1, h / 2 + 5);
  });
  const coinGeo = new THREE.CylinderGeometry(R, R, T, 28);
  const coinMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: coinTex, metalness: 0.7, roughness: 0.45, envMapIntensity: 1.2 });
  const coins = new THREE.InstancedMesh(coinGeo, coinMat, N); coins.frustumCulled = false; S.add(coins);
  const TINTS = ['#e08a50', '#d27a46', '#c0703c', '#a85e34', '#8a4e2c', '#f09a5a'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) coins.setColorAt(i, TINTS[Math.floor(rand() * TINTS.length)]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0), qs = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const RAIL0 = new THREE.Vector3(0.22, 0.2, -0.288), RAIL1 = new THREE.Vector3(-0.2, 0.105, -0.288);
  function drawCoins() {
    for (let i = 0; i < N; i++) {
      const s = ST[i];
      if (s === FREE) { coins.setMatrixAt(i, zero); continue; }
      if (s === CHUTE) { // rolling down the rail on its edge, then dropping onto the shelf
        const u = AGE[i] / CHUTE_T;
        if (u < 0.62) { const k = u / 0.62; v3.lerpVectors(RAIL0, RAIL1, k); v3.x = lerp(RAIL0.x, DROPX[i] + 0.02, k); e3.set(Math.PI / 2, -AGE[i] * 22, 0); }
        else { const k = (u - 0.62) / 0.38, ease = k * k; v3.set(DROPX[i], lerp(RAIL1.y, H1 + T / 2, ease), lerp(-0.288, -0.24, k)); e3.set(Math.PI / 2 * (1 - ease) + 0.3 * Math.sin(k * 9) * (1 - k), 0, 0); }
        q.setFromEuler(e3); coins.setMatrixAt(i, m4.compose(v3, q, one)); continue;
      }
      if (s === GONE) { // slipping into the side gutter
        const k = Math.min(1, AGE[i] / 0.55);
        v3.set(X[i] + SIDE[i] * k * 0.03, Y[i] + T / 2 - k * k * 0.08, Z[i]); e3.set(0, 0, SIDE[i] * -k * 1.3); q.setFromEuler(e3);
        coins.setMatrixAt(i, m4.compose(v3, q, one)); continue;
      }
      v3.set(X[i], Y[i] + T / 2, Z[i]);
      e3.set(TX[i], 0, TZ[i]); q.setFromEuler(e3); qs.setFromAxisAngle(up, SPIN[i]); q.multiply(qs);
      coins.setMatrixAt(i, m4.compose(v3, q, one));
    }
    coins.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the machine
  const chrome = new THREE.MeshStandardMaterial({ color: '#b8b8c0', metalness: 1, roughness: 0.3, envMapIntensity: 0.45 });
  const bedM = new THREE.MeshStandardMaterial({ color: '#30303a', metalness: 0.7, roughness: 0.35 });
  const add = (geo, mat, x, y, z, parent = S.scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  add(new THREE.BoxGeometry(W, 0.01, ZEDGE - ZBACK + 0.02), bedM, 0, -0.005, (ZEDGE + ZBACK) / 2);
  add(new THREE.BoxGeometry(W + 0.02, 0.012, 0.01), chrome, 0, -0.004, ZEDGE + 0.006); // the lip
  // below the lip: the drop to the payout chute, dark, and the (empty) tray further down
  add(new THREE.BoxGeometry(W, 0.16, 0.01), new THREE.MeshStandardMaterial({ color: '#141418', metalness: 0.5, roughness: 0.5 }), 0, -0.09, ZEDGE + 0.012);
  // the shelf
  const shelf = new THREE.Group(); S.add(shelf);
  const shelfTop = add(new THREE.BoxGeometry(W, H1, SHELF_D), new THREE.MeshStandardMaterial({ color: '#2a2832', metalness: 0.6, roughness: 0.4 }), 0, H1 / 2, -SHELF_D / 2, shelf);
  const stripeTex = canvasTexture(S, 256, 32, (g, w, h) => { for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? '#ffd040' : '#202024'; g.beginPath(); g.moveTo(k * 16, h); g.lineTo(k * 16 + 16, h); g.lineTo(k * 16 + 32, 0); g.lineTo(k * 16 + 16, 0); g.fill(); } });
  stripeTex.wrapS = THREE.RepeatWrapping; stripeTex.repeat.set(3, 1);
  const face = add(new THREE.PlaneGeometry(W, H1), new THREE.MeshStandardMaterial({ map: stripeTex, metalness: 0.3, roughness: 0.5, emissive: '#3a2a00', emissiveMap: stripeTex }), 0, H1 / 2, 0.0005, shelf);
  void shelfTop; void face;
  // side walls with neon tubes; the gutters (dark slots at the front corners, where the house's share goes)
  const neonCol = pick([['#ff4fb0', '#40c8ff'], ['#ffb030', '#ff4060'], ['#60ff9a', '#a060ff']]);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.01, 0.42, ZEDGE - ZBACK + 0.02), new THREE.MeshStandardMaterial({ color: '#1a1622', metalness: 0.4, roughness: 0.6 }), sx * (HALF + 0.005), 0.2, (ZEDGE + ZBACK) / 2);
    const tube = add(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 8), new THREE.MeshBasicMaterial({ color: neonCol[sx > 0 ? 1 : 0], toneMapped: false }), sx * (HALF - 0.004), 0.22, ZEDGE - 0.01);
    void tube;
    add(new THREE.BoxGeometry(0.012, 0.004, 0.09), new THREE.MeshBasicMaterial({ color: '#000' }), sx * (HALF - 0.004), 0.0015, 0.05);
  }
  // the backboard: a sunburst, the machine's name, a ring of bulbs
  const NAMES = ['GOLDEN CASCADE', 'PENNY TOWER', 'TREASURE TIDE', 'COPPER COAST', 'MEGA PUSH', 'LUCKY LEDGE', 'THE BIG DROP', 'NEARLY THERE'];
  const mname = pick(NAMES), sun = pick([['#c81e3a', '#ffcf3a'], ['#1e5ac8', '#ffd84a'], ['#7a1ec8', '#ff8a3a']]);
  const boardTex = canvasTexture(S, 512, 320, (g, w, h) => {
    for (let k = 0; k < 24; k++) { const a0 = (k / 24) * TAU, a1 = ((k + 1) / 24) * TAU; g.fillStyle = k % 2 ? sun[0] : sun[1]; g.beginPath(); g.moveTo(w / 2, h * 1.05); g.arc(w / 2, h * 1.05, w * 1.2, a0, a1); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, h);
    g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#2a0a10'; g.strokeText(mname, w / 2, 90); g.fillStyle = '#fff4d0'; g.fillText(mname, w / 2, 90);
    g.font = 'bold 30px sans-serif'; g.strokeText('2p  PLAY  2p', w / 2, 150); g.fillStyle = '#ffd84a'; g.fillText('2p  PLAY  2p', w / 2, 150);
  });
  add(new THREE.PlaneGeometry(W, 0.32), new THREE.MeshStandardMaterial({ map: boardTex, emissive: '#ffffff', emissiveMap: boardTex, emissiveIntensity: 0.28, roughness: 0.6 }), 0, 0.2, ZBACK - 0.005);
  // the rail the coins roll down
  const railV = new THREE.Vector3().subVectors(RAIL1, RAIL0), rail = add(new THREE.CylinderGeometry(0.0025, 0.0025, railV.length(), 8), chrome, 0, 0, 0);
  rail.position.copy(RAIL0).add(RAIL1).multiplyScalar(0.5); rail.position.y -= R + 0.002; rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), railV.clone().normalize());
  const slot = add(new THREE.BoxGeometry(0.04, 0.012, 0.02), chrome, RAIL0.x + 0.02, RAIL0.y + 0.01, -0.288);
  void slot;
  // bulbs: round the backboard and along the top, chasing
  const bulbTex = canvasTexture(S, 64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const bulbs = [];
  const bulbCols = ['#ffd860', '#ff6a8a', '#ffd860', '#6ad0ff'];
  const addBulb = (x, y, z, size, k) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bulbTex, color: bulbCols[k % 4], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.set(x, y, z); sp.scale.set(size, size, 1); S.add(sp); bulbs.push({ sp, k, base: new THREE.Color(bulbCols[k % 4]) }); };
  for (let k = 0; k < 22; k++) { const a = Math.PI * (k / 21); addBulb(Math.cos(a) * -0.23, 0.36 + Math.sin(a) * 0.04 - 0.04, ZBACK + 0.002, 0.022, k); }
  for (let k = 0; k < 18; k++) addBulb(-0.32 + k * (0.64 / 17), 0.52, 0.31, 0.03, k + 1);
  // the cabinet round the glass: painted panels, chrome trim, the marquee, the coin slot, the counter, the tray
  const cabCol = pick(['#a0182a', '#1a3a9a', '#6a1aa0', '#0a7a5a']);
  const cabM = new THREE.MeshStandardMaterial({ color: cabCol, metalness: 0.3, roughness: 0.45 });
  add(new THREE.BoxGeometry(0.1, 0.9, 0.05), cabM, -0.35, 0.1, 0.3); add(new THREE.BoxGeometry(0.1, 0.9, 0.05), cabM, 0.35, 0.1, 0.3);
  add(new THREE.BoxGeometry(0.8, 0.14, 0.05), cabM, 0, 0.53, 0.3);
  const marqTex = canvasTexture(S, 512, 96, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, sun[1]); gr.addColorStop(1, sun[0]); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.font = 'bold 58px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#2a0a10'; g.strokeText('WIN! WIN! WIN!', w / 2, h / 2 + 3); g.fillStyle = '#fff6e0'; g.fillText('WIN! WIN! WIN!', w / 2, h / 2 + 3); });
  add(new THREE.PlaneGeometry(0.56, 0.1), new THREE.MeshBasicMaterial({ map: marqTex, color: '#cccccc', toneMapped: true }), 0, 0.53, 0.326);
  const trim = new THREE.MeshStandardMaterial({ color: '#8a8a94', metalness: 0.3, roughness: 0.6, envMapIntensity: 0.2 });
  for (const y of [-0.05, 0.455]) add(new THREE.BoxGeometry(0.62, 0.012, 0.03), trim, 0, y, 0.31);
  for (const x of [-0.305, 0.305]) add(new THREE.BoxGeometry(0.012, 0.52, 0.03), trim, x, 0.2, 0.31);
  const panel = add(new THREE.BoxGeometry(0.62, 0.22, 0.05), cabM, 0, -0.17, 0.33); panel.rotation.x = -0.25;
  // the counter: COINS IN goes up; PAID OUT does not
  const ledC = document.createElement('canvas'); ledC.width = 512; ledC.height = 96;
  const ledT = S.keep(new THREE.CanvasTexture(ledC)); ledT.colorSpace = THREE.SRGBColorSpace;
  let ledShown = -1;
  function drawLed() {
    if (ledShown === coinsIn) return; ledShown = coinsIn;
    const g = ledC.getContext('2d'); g.fillStyle = '#100404'; g.fillRect(0, 0, 512, 96);
    g.font = 'bold 30px monospace'; g.fillStyle = '#ff3a24'; g.textAlign = 'left';
    g.fillText('IN ' + String(4271 + coinsIn).padStart(6, '0'), 18, 40); g.fillText('PAID OUT 000000', 18, 82);
    ledT.needsUpdate = true;
  }
  drawLed();
  const led = add(new THREE.PlaneGeometry(0.2, 0.0375), new THREE.MeshBasicMaterial({ map: ledT, toneMapped: false }), -0.14, -0.13, 0.36); led.rotation.x = -0.25;
  const slotPlate = add(new THREE.BoxGeometry(0.06, 0.07, 0.01), chrome, 0.16, -0.135, 0.357); slotPlate.rotation.x = -0.25;
  const slotLbl = canvasTexture(S, 128, 128, (g, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#000'; g.fillRect(56, 20, 16, 60); g.fillStyle = '#ffd84a'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('2p', w / 2, 112); });
  const sl = add(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ map: slotLbl, color: '#aaaaaa' }), 0.16, -0.135, 0.3625); sl.rotation.x = -0.25;
  const tray = add(softBox(0.3, 0.05, 0.09, 0.01), chrome, 0, -0.33, 0.37); void tray;
  const trayIn = add(new THREE.BoxGeometry(0.27, 0.01, 0.07), new THREE.MeshStandardMaterial({ color: '#101014', metalness: 0.6, roughness: 0.5 }), 0, -0.305, 0.37); void trayIn;
  // the glass, with its reflections (and a smudge or two)
  const glassTex = canvasTexture(S, 256, 256, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0.2, 'rgba(255,255,255,0)'); gr.addColorStop(0.32, 'rgba(255,255,255,.35)'); gr.addColorStop(0.36, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0)'); gr.addColorStop(0.66, 'rgba(255,255,255,.18)'); gr.addColorStop(0.7, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.ellipse(60 + Math.random() * 140, 40 + Math.random() * 80, 4, 6, Math.random(), 0, TAU); g.fill(); }
  });
  add(new THREE.PlaneGeometry(0.6, 0.5), new THREE.MeshBasicMaterial({ map: glassTex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.2, 0.3);
  // light inside the machine (warm from above), the neon's colour from the sides
  const topL = new THREE.PointLight('#ffe0b0', 0.55, 1.4, 2); topL.position.set(0, 0.42, -0.12); S.add(topL);
  const backL = new THREE.PointLight('#ffd0a0', 0.3, 1, 2); backL.position.set(0, 0.25, -0.18); S.add(backL);
  const sideL = new THREE.PointLight(neonCol[0], 0.06, 0.8, 2); sideL.position.set(-0.22, 0.15, 0.08); S.add(sideL);
  const sideR = new THREE.PointLight(neonCol[1], 0.06, 0.8, 2); sideR.position.set(0.22, 0.15, 0.08); S.add(sideR);
  S.add(new THREE.HemisphereLight('#4a3a5a', '#120a10', 0.4));

  // ---------------------------------------------------------------- the arcade around it: other machines glowing, the carpet, a neon sign
  const carpet = canvasTexture(S, 256, 256, (g, w, h) => { g.fillStyle = '#2a0a2a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 90; k++) { g.fillStyle = pick(['#c81e6a', '#1ec8c8', '#ffd84a', '#6a1ec8']); g.save(); g.translate(Math.random() * w, Math.random() * h); g.rotate(Math.random() * TAU); g.fillRect(-8, -2, 16, 4); g.restore(); } });
  carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(10, 10);
  const floor = add(new THREE.PlaneGeometry(14, 14), new THREE.MeshLambertMaterial({ map: carpet }), 0, -0.95, 0); floor.rotation.x = -Math.PI / 2;
  const glows = [];
  for (const [x, z, ry] of [[-0.85, 0.15, 0.25], [0.85, 0.15, -0.25], [-1.7, -0.1, 0.4], [1.7, -0.1, -0.4], [-0.4, -2.2, 0], [0.6, -2.4, 0]]) {
    const gtex = canvasTexture(S, 64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); const c = pick(['#ff4f9a', '#4fc8ff', '#ffc84f', '#8a4fff', '#4fff9a']); gr.addColorStop(0, c); gr.addColorStop(1, '#1a0a1a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const gm = add(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshBasicMaterial({ map: gtex, color: '#999999' }), x, 0.15, z); gm.rotation.y = ry;
    const body = add(new THREE.BoxGeometry(0.72, 1.6, 0.6), new THREE.MeshLambertMaterial({ color: '#2a1a2a' }), x, -0.15, z - 0.31); body.rotation.y = ry;
    glows.push(gm.material);
  }
  const signTex = canvasTexture(S, 512, 128, (g, w, h) => { g.font = 'bold 80px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff3aa0'; g.shadowBlur = 20; g.fillStyle = '#ffd0ee'; g.fillText('AMUSEMENTS', w / 2, h / 2); });
  const sign = add(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, color: '#ff8ad0' }), 0, 1.25, -3.2);

  // ---------------------------------------------------------------- events from the music: the push, a coin, the house's share, a tease
  let lastPush = -99, nextCoin = 3, nextAbsorb = 12, tease = 0;
  S.onEvent((ev) => {
    if (ev.type === 'push') { pushDur = ev.dur; pushT0 = clockT; lastPush = clockT; }
    else if (ev.type === 'coin') insert();
    else if (ev.type === 'absorb') absorb();
    else if (ev.type === 'tease') { tease = 1; shake = 1; }
  });

  // ---------------------------------------------------------------- each frame
  let clockT = 0, leanIn = 0, leanT = 40;
  const look = new THREE.Vector3();
  S.on((t, dt, st) => {
    clockT = t;
    const e = st.energy;
    // with no music: our own pace
    if (t - lastPush > 6) { if (t - pushT0 >= pushDur) { pushT0 = t; pushDur = 3.2 - 0.6 * e; } if (t > nextCoin) { insert(); nextCoin = t + 5 + (1 - e) * 15 + rand() * 4; } if (t > nextAbsorb) { absorb(); nextAbsorb = t + 7 + (1 - e) * 18 + rand() * 6; } }
    // the coins
    const h = Math.min(dt, 1 / 30);
    step(h, t);
    for (let i = 0; i < N; i++) {
      if (ST[i] === CHUTE) { AGE[i] += dt; if (AGE[i] >= CHUTE_T) { ST[i] = SHELF; X[i] = DROPX[i]; Z[i] = -0.24; Y[i] = H1; VY[i] = 0; } }
      else if (ST[i] === GONE) { AGE[i] += dt; if (AGE[i] > 0.55) ST[i] = FREE; }
    }
    if (count() > 500) absorb(true);
    shake = Math.max(0, shake - dt * 0.35);
    drawCoins();
    shelf.position.z = zf;
    stripeTex.offset.x = (t * 0.2) % 1;
    drawLed();
    // the lights: bulbs chasing round, slower and softer as the night goes on; the arcade dimming
    const chase = t * (2 + 6 * e);
    for (const b of bulbs) { const on = (Math.floor(chase) + b.k) % 4 === 0 || (tease > 0.2 && Math.sin(t * 20 + b.k) > 0); b.sp.material.color.copy(b.base).multiplyScalar(on ? 1.4 : 0.25 + 0.15 * e); }
    tease = Math.max(0, tease - dt * 0.3);
    const dim = 0.35 + 0.65 * sstep(0.2, 0.75, e);
    for (const g of glows) g.color.setScalar(0.6 * dim);
    sign.material.opacity = e < 0.32 ? 0.15 + 0.1 * (Math.sin(t * 13) > 0.6 ? 1 : 0) : 0.9;
    topL.intensity = 0.28 + 0.1 * e;
    // the camera: stood at the machine; now and then leaning in to watch the edge
    leanT -= dt;
    if (leanT < 0) { leanIn = leanIn > 0.5 ? 0 : 1; leanT = leanIn ? 14 + rand() * 8 : 40 + rand() * 40; }
    if (tease > 0.9) { leanIn = 1; leanT = Math.max(leanT, 10); }
    lean = lerp(lean, leanIn, 1 - Math.exp(-dt * 0.4));
    const cam = S.camera, a = cam.aspect || 1, portrait = a < 0.8;
    const sway = Math.sin(t * 0.07) * 0.04;
    cam.position.set(lerp(sway, 0.05 + sway * 0.3, lean), lerp(portrait ? 0.26 : 0.27, 0.075, lean), lerp(portrait ? 0.64 : 0.52, portrait ? 0.4 : 0.34, lean));
    look.set(lerp(0, 0.02, lean), lerp(portrait ? -0.09 : 0.045, 0.004, lean), lerp(-0.04, 0.05, lean));
    cam.lookAt(look);
  });
  let lean = 0;

  S.scene.userData.pusher = { get count() { return count(); }, get coinsIn() { return coinsIn; }, get front() { return pressFront; }, get overhang() { let m = 0; for (let i = 0; i < N; i++) if (ST[i] === BED) m = Math.max(m, (Z[i] - ZEDGE) / R); return m; }, get fallen() { let c = 0; for (let i = 0; i < N; i++) if (ST[i] === BED && Z[i] > ZEDGE + 0.5 * R) c++; return c; }, insert, absorb };
  return S.finalize({ portraitFov: 62 });
}
