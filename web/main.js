// Lullwave: screens, settings, the sleep session (timer, dimming, wake lock, lock-screen
// controls) and the install button. The sound is in audio.js, the visuals in render.js.
import { createEngine, energyCurve } from './audio.js';
import { createRenderer } from './render.js';

const $ = (id) => document.getElementById(id);
const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const WORLDS = [
  { id: 'cave', name: 'Crystal Cave', tag: 'Glass bells and dripping water by an underground lake, deep under the mountain.' },
  { id: 'drive', name: 'Night Drive', tag: 'Slow synthwave on an endless neon road. The sun sinks as you drift off.' },
  { id: 'ocean', name: 'Deep Ocean', tag: 'Sink slowly through dark water among glowing jellyfish, while whales sing far away.' },
  { id: 'aurora', name: 'Aurora', tag: 'Northern lights ripple over a frozen lake as snow falls softly. A quiet choir sings.' },
  { id: 'rain', name: 'Neon Rain', tag: 'Rain runs down the window of a city night. Lo-fi keys, soft beats, distant thunder.' },
  { id: 'space', name: 'Stardust', tag: 'Drift through glowing nebulae past a ringed giant, to slow cosmic ambient.' },
  { id: 'disco', name: 'Disco Cat', tag: 'A rainbow cat grooves under the mirror ball, then curls up and drifts off to a lullaby.' },
];
const TIMERS = [15, 30, 45, 60, 90, 0];
const FADES = [[5, '5m'], [15, '15m'], [30, '30m'], [0, 'Never']];
const ICONS = {
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15a5 5 0 1 1 9.6-2H18a3 3 0 0 1 0 6M8 19l-1 2m5-2-1 2m5-2-1 2"/></svg>',
  waves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 8c3 0 3-2 5-2s2 2 5 2 3-2 5-2 2 2 5 2M2 14c3 0 3-2 5-2s2 2 5 2 3-2 5-2 2 2 5 2M2 20c3 0 3-2 5-2s2 2 5 2 3-2 5-2 2 2 5 2"/></svg>',
  pink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h3l1.5-3 3 6 3-8 3 9 1.5-4H21"/></svg>',
  brown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h2l2-5 3 10 3-12 3 14 2-7h3"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
};
const MIX = [['music', 'Music'], ['rain', 'Rain'], ['waves', 'Waves'], ['pink', 'Pink noise'], ['brown', 'Brown noise']];

// ------------------------------------------------------------------ settings (remembered)
const store = {
  get(k, d) { try { const v = localStorage.getItem('lw.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lw.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const S = {
  world: store.get('world', 0) % WORLDS.length,
  seed: store.get('seed', newSeed()),
  timer: store.get('timer', 45),
  custom: store.get('custom', 120),
  fade: store.get('fade', 15),
  warm: store.get('warm', false),
  route: store.get('route3', 'direct'),
  stats: store.get('stats', false),
  breathe: store.get('breathe', 0),
  favs: store.get('favs', []),
  mix: { music: 0.8, rain: 0, waves: 0, pink: 0, brown: 0, ...store.get('mix', {}) },
};
function newSeed() { return 1 + Math.floor(Math.random() * 9999); }
const minutes = () => (S.timer === 'custom' ? Math.max(1, Math.min(720, S.custom | 0)) : S.timer);

// ------------------------------------------------------------------ engine and visuals
const engine = createEngine({ mobile });
const view = createRenderer($('view'), { mobile });
view.setEvents(() => engine.drainEvents(), () => engine.ctx?.currentTime ?? 0);
engine.setMix(S.mix);

function showWorld(animate = true) {
  const w = WORLDS[S.world];
  const apply = () => {
    $('sceneName').textContent = w.name; $('sceneTag').textContent = w.tag;
    $('sceneName').classList.remove('swap');
  };
  if (animate) { $('sceneName').classList.add('swap'); setTimeout(apply, 250); } else apply();
  $('seedLabel').textContent = '#' + S.seed;
  paintFav();
  [...$('dots').children].forEach((d, k) => d.classList.toggle('on', k === S.world));
  view.setScene(w.id, S.seed);
  store.set('world', S.world); store.set('seed', S.seed);
}

// ------------------------------------------------------------------ favourites: worlds and variations worth keeping
const isFav = () => S.favs.some((f) => f.w === WORLDS[S.world].id && f.s === S.seed);
function paintFav() {
  const on = isFav();
  $('fav').classList.toggle('on', on); $('fav').setAttribute('aria-pressed', on);
  $('favList').classList.toggle('hidden', !S.favs.length);
  $('favCount').textContent = S.favs.length;
}
$('fav').onclick = () => {
  const w = WORLDS[S.world].id;
  if (isFav()) S.favs = S.favs.filter((f) => !(f.w === w && f.s === S.seed));
  else { S.favs.unshift({ w, s: S.seed }); toast('Saved to favourites'); }
  store.set('favs', S.favs); paintFav();
};
function renderFavs() {
  const box = $('favItems'); box.innerHTML = '';
  for (const f of S.favs) {
    const k = WORLDS.findIndex((w) => w.id === f.w);
    if (k < 0) continue;
    const row = document.createElement('div'); row.className = 'fav-item';
    const go = document.createElement('button'); go.className = 'go';
    go.innerHTML = `${WORLDS[k].name}<small>#${f.s}</small>`;
    go.onclick = () => { S.world = k; S.seed = f.s; showWorld(); $('favSheet').classList.add('hidden'); };
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '\u00d7'; x.setAttribute('aria-label', 'Remove');
    x.onclick = () => { S.favs = S.favs.filter((g) => g !== f); store.set('favs', S.favs); paintFav(); if (!S.favs.length) $('favSheet').classList.add('hidden'); else renderFavs(); };
    row.append(go, x); box.appendChild(row);
  }
}
$('favList').onclick = () => { renderFavs(); $('favSheet').classList.remove('hidden'); };
$('favClose').onclick = () => $('favSheet').classList.add('hidden');
$('favSheet').onclick = (e) => { if (e.target === $('favSheet')) $('favSheet').classList.add('hidden'); };

// ------------------------------------------------------------------ home UI
function chips(el, items, isOn, onPick) {
  el.innerHTML = '';
  for (const [value, label] of items) {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = label;
    b.onclick = () => { onPick(value); render(); };
    el.appendChild(b);
  }
  const render = () => [...el.children].forEach((b, k) => b.classList.toggle('on', isOn(items[k][0])));
  render();
  return render;
}

function mixer(el) {
  el.innerHTML = '';
  const inputs = {};
  for (const [key, label] of MIX) {
    const l = document.createElement('label');
    l.innerHTML = ICONS[key] + label;
    const r = document.createElement('input');
    r.type = 'range'; r.min = 0; r.max = 100; r.value = Math.round(S.mix[key] * 100);
    r.setAttribute('aria-label', label + ' volume');
    const paint = () => r.style.setProperty('--v', r.value + '%');
    r.oninput = () => { S.mix[key] = r.value / 100; paint(); engine.setMix({ [key]: S.mix[key] }); store.set('mix', S.mix); syncMixers(); };
    paint();
    inputs[key] = { r, paint };
    el.append(l, r);
  }
  return inputs;
}
const mixers = [mixer($('homeMix')), mixer($('sessionMix'))];
function syncMixers() { for (const m of mixers) for (const k in m) { m[k].r.value = Math.round(S.mix[k] * 100); m[k].paint(); } }

$('dots').innerHTML = WORLDS.map(() => '<i></i>').join('');
$('prev').onclick = () => { S.world = (S.world + WORLDS.length - 1) % WORLDS.length; showWorld(); };
$('next').onclick = () => { S.world = (S.world + 1) % WORLDS.length; showWorld(); };
$('reroll').onclick = () => { S.seed = newSeed(); showWorld(false); };
// swipe between worlds on the open background
let swipe = null;
$('view').addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY }; });
$('view').addEventListener('pointerup', (e) => {
  if (!swipe || mode !== 'home') return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? $('next') : $('prev')).click();
  swipe = null;
});

const timerLabel = (v) => (v === 0 ? '∞' : String(v));
function pickTimer(v) {
  S.timer = v; store.set('timer', v); updateStart();
  $('customRow').classList.toggle('hidden', v !== 'custom');
  $('customBtn').classList.toggle('on', v === 'custom');
  paintTimer();
}
const paintTimer = chips($('timer'), TIMERS.map((v) => [v, timerLabel(v)]), (v) => v === S.timer, pickTimer);
$('customBtn').onclick = () => { pickTimer('custom'); setTimeout(() => $('customMin').focus(), 50); };
$('customRow').classList.toggle('hidden', S.timer !== 'custom');
$('customBtn').classList.toggle('on', S.timer === 'custom');
$('customMin').value = S.custom;
$('customMin').oninput = () => { S.custom = +$('customMin').value || 0; store.set('custom', S.custom); updateStart(); };
chips($('breatheSet'), [[0, 'Off'], [2, '2m'], [5, '5m']], (v) => v === S.breathe, (v) => { S.breathe = v; store.set('breathe', v); });
chips($('fade'), FADES, (v) => v === S.fade, (v) => { S.fade = v; store.set('fade', v); });
chips($('route'), [['direct', 'Direct'], ['stream', 'Stream']], (v) => v === S.route, (v) => { S.route = v; store.set('route3', v); engine.setRoute(v); });
// audio stats, for testing on a phone
const statsToggle = $('statsToggle');
const applyStats = () => { statsToggle.classList.toggle('on', S.stats); $('stats').classList.toggle('hidden', !S.stats); };
statsToggle.onclick = () => { S.stats = !S.stats; store.set('stats', S.stats); applyStats(); };
applyStats();
let lastFrame = performance.now(), worstGap = 0;
(function watch() { const now = performance.now(); worstGap = Math.max(worstGap, now - lastFrame); lastFrame = now; requestAnimationFrame(watch); })();
setInterval(() => {
  if (!S.stats) return;
  const d = engine.debugInfo();
  $('stats').textContent = d
    ? `out ${d.route} · ${d.state} · ${d.rate} Hz · latency ${d.latency} ms
chunks ${d.chunks} · last render ${d.renderMs} ms · ${d.ahead} s ahead` +
      (d.glitches !== null ? ` · glitches ${d.glitches}` : '') + `
slowest frame ${Math.round(worstGap)} ms · ${navigator.hardwareConcurrency || '?'} cores`
    : 'audio not started';
  worstGap = 0;
}, 1000);
engine.setRoute(S.route);
const warmToggle = $('warmToggle');
const applyWarm = () => { warmToggle.classList.toggle('on', S.warm); $('warm').classList.toggle('on', S.warm); };
warmToggle.onclick = () => { S.warm = !S.warm; store.set('warm', S.warm); applyWarm(); };
applyWarm();
$('more').addEventListener('toggle', () => $('home').classList.toggle('expanded', $('more').open));

function fmtClock(d) { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function updateStart() {
  const m = minutes();
  $('startLabel').textContent = m ? `Start · ${m >= 60 && m % 60 === 0 ? m / 60 + ' h' : m + ' min'}` : 'Start';
  $('endsAt').textContent = m ? 'ends ' + fmtClock(new Date(Date.now() + m * 60000)) : 'no timer';
}
setInterval(updateStart, 30000);

// ------------------------------------------------------------------ the session
let mode = 'home', lastTouch = 0, visualsUntil = 0, wakeLock = null, hideTimer = 0, dimLevel = 0;
const SHOW_FOR = 6000;

async function lockScreenOn(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not allowed right now */ }
}

// Brave pauses audio when the screen goes off unless its Background play setting is on
const isBrave = !!navigator.brave;
if (isBrave) $('sHint').textContent = 'Brave: to keep the sound going with the screen off, turn on Background play in Brave’s Settings → Media.';

function startSession() {
  const w = WORLDS[S.world];
  engine.start({ scene: w.id, seed: S.seed, minutes: minutes() });
  mode = 'session';
  $('home').classList.add('away');
  $('sScene').textContent = w.name;
  view.setFps(30);
  visualsUntil = S.fade ? Date.now() + S.fade * 60000 : Infinity;
  showControls();
  setupMediaSession(w);
  lockScreenOn(true);
  startBreathing();
  if (isBrave && !store.get('braveTip', false)) { store.set('braveTip', true); toast('Brave: turn on Settings → Media → Background play so the sound keeps going when the screen is off.'); }
}

function endSession(finished) {
  if (finished) {
    $('ended').classList.add('show');
    view.stop();
    lockScreenOn(false);
    stopBreathing();
    mode = 'ended';
    return;
  }
  engine.stop();
  backHome();
}

function backHome() {
  mode = 'home';
  stopBreathing();
  $('ended').classList.remove('show');
  $('session').classList.remove('show');
  $('home').classList.remove('away');
  $('dim').style.opacity = 0; dimLevel = 0;
  view.setFps(mobile ? 30 : 60);
  view.setState({ energy: 1 });
  view.start();
  lockScreenOn(false);
  updateStart();
}

engine.onEnd = () => endSession(true);
$('ended').onclick = backHome;

function showControls() {
  $('session').classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (mode === 'session') $('session').classList.remove('show'); }, SHOW_FOR);
}
// a tap anywhere during a session shows the controls (and brings the visuals back for a while)
let wasShown = false;
document.addEventListener('pointerdown', () => {
  lastTouch = Date.now();
  if (mode !== 'session') return;
  wasShown = $('session').classList.contains('show');
  if (S.fade && Date.now() > visualsUntil - 60000) visualsUntil = Date.now() + 60000;
  if (!view.running) view.start();
  lockScreenOn(true);
  showControls();
}, true);
$('tapzone').onclick = () => { if (wasShown) { clearTimeout(hideTimer); $('session').classList.remove('show'); } };

$('start').onclick = () => {
  if (S.timer === 'custom' && !(S.custom >= 1)) { toast('Enter how many minutes to play'); $('customMin').focus(); return; }
  startSession();
};
$('sStop').onclick = () => endSession(false);
$('sPause').onclick = () => { engine.paused ? engine.resume() : engine.pause(); paintPause(); showControls(); };
$('sPlus').onclick = () => {
  const total = engine.total() / 60;
  const base = total || Math.ceil(engine.elapsed() / 60);
  engine.setTotal(Math.max(base, engine.elapsed() / 60) + 15);
  toast('15 more minutes'); showControls();
};
function paintPause() { $('sPause').innerHTML = engine.paused ? ICONS.play : ICONS.pause; $('sPause').setAttribute('aria-label', engine.paused ? 'Play' : 'Pause'); }
paintPause();

function setupMediaSession(w) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: w.name, artist: 'Lullwave', album: minutes() ? `Sleep timer · ${minutes()} min` : 'Sleep',
      artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
    navigator.mediaSession.playbackState = 'playing';
    navigator.mediaSession.setActionHandler('play', () => { engine.resume(); paintPause(); });
    navigator.mediaSession.setActionHandler('pause', () => { engine.pause(); paintPause(); });
    navigator.mediaSession.setActionHandler('stop', () => endSession(false));
  } catch { /* partial support */ }
}

const fmt = (s) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

// the session clock: time left, the energy for the visuals, and the slow fade to black
setInterval(() => {
  if (mode !== 'session' || !engine.running) return;
  const el = engine.elapsed(), total = engine.total();
  $('sTime').textContent = total ? fmt(total - el) : fmt(el);
  $('sSub').textContent = total ? `left · ends ${fmtClock(new Date(Date.now() + (total - el) * 1000))}` : 'playing · no timer';
  $('sBar').style.width = total ? (100 * el / total).toFixed(2) + '%' : '0%';
  view.setState({ energy: energyCurve(el, total) });

  // the screen dims gently from the start, then fades to black when the visuals time runs out
  // (or as the music fades out at the end of the timer)
  const sinceStart = el / 60;
  let target = Math.min(0.55, sinceStart * 0.07) + (S.warm ? 0.12 : 0);
  const now = Date.now();
  if (now > visualsUntil) target = Math.min(1, (now - visualsUntil) / 45000);
  if (total && total - el < 60) target = Math.max(target, 1 - (total - el) / 60);
  if ($('session').classList.contains('show')) target = Math.min(target, 0.35);
  dimLevel += (target - dimLevel) * 0.15;
  $('dim').style.opacity = dimLevel.toFixed(3);
  if (dimLevel > 0.985 && view.running) { view.stop(); lockScreenOn(false); }
}, 250);

// ------------------------------------------------------------------ the breathing guide
// Six breaths a minute with a longer out-breath (4 s in, 6 s out). It follows the session's clock,
// so it pauses with the music, and fades away once its few minutes are up.
let breatheRaf = 0, breatheWord = '';
const IN = 4, OUT = 6;
function startBreathing() {
  stopBreathing();
  if (!S.breathe) return;
  const until = S.breathe * 60;
  const tick = () => {
    breatheRaf = requestAnimationFrame(tick);
    const el = engine.elapsed();
    if (el > until) { stopBreathing(); return; }
    const c = el % (IN + OUT);
    const inhale = c < IN;
    const k = inhale ? c / IN : 1 - (c - IN) / OUT;
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * k);
    $('breatheRing').style.transform = `scale(${(0.55 + 0.45 * ease).toFixed(4)})`;
    const word = inhale ? 'in' : 'out';
    if (word !== breatheWord) { breatheWord = word; $('bIn').style.opacity = inhale ? 1 : 0; $('bOut').style.opacity = inhale ? 0 : 1; }
    // fade in over the first few seconds, step back while the controls are up, soften at the end
    const show = Math.min(1, el / 3, (until - el) / 10);
    $('breathe').style.opacity = ($('session').classList.contains('show') ? 0.25 : 1) * show;
  };
  tick();
}
function stopBreathing() {
  cancelAnimationFrame(breatheRaf); breatheRaf = 0; breatheWord = '';
  $('breathe').style.opacity = 0;
}

// ------------------------------------------------------------------ install
let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (!standalone) $('install').classList.remove('hidden'); });
addEventListener('appinstalled', () => { $('install').classList.add('hidden'); toast('Installed. Find Lullwave on your home screen.'); });
if (isIOS && !standalone) $('install').classList.remove('hidden');
$('install').onclick = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') $('install').classList.add('hidden');
    deferredPrompt = null;
  } else $('iosSheet').classList.remove('hidden');
};
$('iosClose').onclick = () => $('iosSheet').classList.add('hidden');
$('tipsBtn').onclick = () => $('tipsSheet').classList.remove('hidden');
$('tipsClose').onclick = () => $('tipsSheet').classList.add('hidden');
$('tipsSheet').onclick = (e) => { if (e.target === $('tipsSheet')) $('tipsSheet').classList.add('hidden'); };
$('iosSheet').onclick = (e) => { if (e.target === $('iosSheet')) $('iosSheet').classList.add('hidden'); };

let toastTimer = 0;
function toast(msg) {
  $('toast').textContent = msg; $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), Math.max(3500, msg.length * 70));
}

document.addEventListener('keydown', (e) => {
  if (mode === 'session' && e.code === 'Space') { e.preventDefault(); $('sPause').click(); }
  if (mode === 'session' && e.code === 'Escape') endSession(false);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && mode === 'session' && view.running) lockScreenOn(true); });

// ------------------------------------------------------------------ go
showWorld(false);
updateStart();
view.setFps(mobile ? 30 : 60);
view.start();
requestAnimationFrame(() => requestAnimationFrame(() => { $('loader').style.opacity = 0; setTimeout(() => $('loader').remove(), 1000); }));
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) navigator.serviceWorker.register('./sw.js').catch(() => {});
window.__lw = { engine, view, S };
