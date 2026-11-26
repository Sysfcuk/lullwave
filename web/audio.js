// The sound engine.
//
// The music is composed ahead of time, in chunks: each chunk (CHUNK seconds of notes) is rendered
// with an OfflineAudioContext, which runs faster than real time on its own thread, and the
// finished audio is queued to play at the right moment. The live audio graph only plays buffers,
// so a phone busy drawing 3D never makes the music stutter. Each chunk also renders TAIL seconds
// past its end so long notes, reverb and echoes ring out; overlapping chunks simply add up.
//
// The live graph: the chunk player, each world's drone (oscillators, so there is sound even if the
// page is frozen in the background and no new chunks arrive), looped ambience (rain, waves,
// brown noise), the master envelope and a gentle limiter.
//
// Sleep-specific choices:
// - The whole session's volume envelope (fade in, the long fade out before the timer ends) is
//   scheduled on the master gain up front, so it happens on time even if JavaScript is paused.
// - Output goes straight from Web Audio to the speakers (the most reliable path: routing it through
//   a MediaStream into an <audio> element drops out on some Android phones). A silent looping
//   <audio> element plays alongside, so the phone still treats the page as playing media:
//   lock-screen controls, and it keeps going with the screen off. "Stream" is the old route,
//   kept as a fallback for a phone that stops the sound when locked.
// - Chunks are rendered further ahead while the page is hidden.
import { createCave } from './music/cave.js';
import { createDrive } from './music/drive.js';
import { createOcean } from './music/ocean.js';
import { createAurora } from './music/aurora.js';
import { createRain } from './music/rain.js';
import { createSpace } from './music/space.js';
import { createDisco } from './music/disco.js';
import { createEventing } from './music/eventing.js';
import { createCotswold } from './music/cotswold.js';
import { createAmbient } from './music/ambient.js';
import { PROFILES } from './music/profiles.js';
import { createXmas } from './music/xmas.js';
import { createChoirSong } from './music/choirsong.js';
import { createPizzeria } from './music/pizzeria.js';
import { createFeverSong } from './music/feversong.js';
import { createCanalSong } from './music/canalsong.js';
import { createPennySong } from './music/pennysong.js';
import { createSheepSong } from './music/sheepsong.js';
import { createChipSong } from './music/chipsong.js';
import { createSandSong } from './music/sandsong.js';
import { createSnowSong } from './music/snowsong.js';

const COMPOSERS = { cave: createCave, drive: createDrive, ocean: createOcean, aurora: createAurora, rain: createRain, space: createSpace, disco: createDisco, eventing: createEventing, cotswold: createCotswold };
// the dream worlds share one ambient composer, each with its own profile
for (const id of Object.keys(PROFILES)) COMPOSERS[id] = (o) => createAmbient(PROFILES[id], o);
// ...and the dream worlds that are still on get music written for them
Object.assign(COMPOSERS, { market: createXmas, choir: createChoirSong, pizza: createPizzeria, fever: createFeverSong, canal: createCanalSong, penny: createPennySong, sheep: createSheepSong, pixel: createChipSong, sands: createSandSong, snowstorm: createSnowSong });
const CHUNK = 20;           // seconds of notes per chunk
const TAIL = 24;            // extra seconds for notes, reverb and echoes to ring out (longest pad ~15 s + reverb)
const AHEAD = 50;           // keep this much music rendered ahead (seconds)
const AHEAD_HIDDEN = 110;   // ... and more while the page is hidden, in case timers slow down

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Energy over the night: full at the start, easing down to a quiet floor. */
export function energyCurve(elapsed, total) {
  if (!total) return Math.max(0.3, 1 - 0.7 * Math.min(1, elapsed / 2700)); // no timer: settle over 45 minutes
  const p = Math.min(1, elapsed / total);
  const s = Math.min(1, Math.max(0, (p - 0.05) / 0.8));
  return 1 - 0.8 * s * s * (3 - 2 * s);
}

export function fadeLength(totalSec) { return Math.min(600, Math.max(45, totalSec * 0.25)); }

// ------------------------------------------------------------------ buffers (context-free)
function makeBuffer(channels, length, sampleRate) { return new AudioBuffer({ numberOfChannels: channels, length, sampleRate }); }

function noiseBuffer(sr, sec, fill) {
  const n = Math.floor(sec * sr), fade = Math.floor(sr * 0.5);
  const buf = makeBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const tmp = new Float32Array(n + fade);
    fill(tmp, sr, c);
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = tmp[i];
    // crossfade the overhang into the start so the loop is seamless
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = tmp[i] * k + tmp[n + i] * (1 - k); }
  }
  return buf;
}
const white = (d) => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; };
function brown(d) {
  let b = 0;
  for (let i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
}
// pink noise (equal energy per octave), with Paul Kellet's filter
function pink(d) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
}
function rain(d, sr) {
  // a soft hiss, a low patter and individual drops (tiny decaying chirps) at random times
  let lp = 0, lp2 = 0, hp = 0, prev = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    lp += 0.35 * (w - lp); hp = 0.97 * (hp + lp - prev); prev = lp;
    lp2 += 0.03 * (w - lp2);
    d[i] = hp * 0.22 + lp2 * 0.9;
  }
  const drops = Math.floor((d.length / sr) * 70);
  for (let k = 0; k < drops; k++) {
    const at = Math.floor(Math.random() * (d.length - sr * 0.05)), f = 1500 + Math.random() * 4500;
    const amp = Math.pow(Math.random(), 3) * 0.35, tau = sr * (0.002 + Math.random() * 0.004);
    const len = Math.floor(tau * 6), w = (2 * Math.PI * f) / sr;
    for (let i = 0; i < len; i++) d[at + i] += Math.sin(w * i * (1 + i / len * 0.3)) * amp * Math.exp(-i / tau);
  }
}
function impulse(sr, sec, decay) {
  const n = Math.floor(sec * sr), buf = makeBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n, a = 0.9 - 0.75 * k; // the tail gets darker as it dies
      lp += a * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - k, decay);
    }
  }
  return buf;
}

/**
 * Tidy a rendered chunk: repair isolated one-sample spikes (Chrome's offline renderer can
 * leave one at a render-block boundary, heard as a tick) and fade out the very end, so nothing
 * still ringing can click when the buffer stops.
 */
export function cleanUp(buffer) {
  const fadeN = Math.floor(buffer.sampleRate * 0.5);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c), n = d.length;
    for (let i = 1; i < n - 1; i++) {
      const mid = (d[i - 1] + d[i + 1]) * 0.5, dev = d[i] - mid;
      if ((dev > 0.06 || dev < -0.06) && Math.abs(d[i + 1] - d[i - 1]) < 0.03) d[i] = mid;
    }
    for (let i = 0; i < fadeN; i++) d[n - 1 - i] *= i / fadeN;
  }
}

/** One second of silence as a WAV file (8 kHz, 16-bit mono), for the keep-alive element. */
function silentWav() {
  const n = 8000, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export function createEngine({ mobile = false } = {}) {
  const SR = mobile ? 32000 : 44100; // offline render rate (bells are filtered below 15 kHz anyway)
  let ac = null, master, limiter, el = null, keepalive = null, streamDest = null, routeIsStream = false;
  const buses = {};
  let events = [];
  let composer = null, worker = null, session = null, paused = false;
  let verbIR = null, whiteBuffer = null;
  const mix = { music: 0.8, rain: 0, waves: 0, pink: 0, brown: 0 };
  let onEnd = () => {}, wantRoute = 'direct';
  const stats = { chunks: 0, lastRenderMs: 0 };

  // ------------------------------------------------------------------ the live graph
  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC({ latencyHint: 'playback' });
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
    master = ac.createGain(); master.gain.value = 0;
    limiter = ac.createDynamicsCompressor();
    // gentle compression: brief loud peaks are what rouse a sleeper, so keep the level even
    limiter.threshold.value = -20; limiter.knee.value = 14; limiter.ratio.value = 3.5; limiter.attack.value = 0.008; limiter.release.value = 0.5;
    const makeup = ac.createGain(); makeup.gain.value = 1.5;
    master.connect(makeup); makeup.connect(limiter);
    buses.music = ac.createGain(); buses.music.connect(master);

    const lsr = ac.sampleRate;
    const layer = (name, buffer, build) => {
      const src = ac.createBufferSource(); src.buffer = buffer; src.loop = true;
      buses[name] = ac.createGain(); buses[name].gain.value = 0;
      build(src, buses[name]);
      buses[name].connect(master);
      src.start(0, Math.random() * buffer.duration);
    };
    layer('rain', noiseBuffer(lsr, 9, rain), (src, out) => {
      const g = ac.createGain(); g.gain.value = 0.85;
      const lfo = ac.createOscillator(), amt = ac.createGain(); lfo.frequency.value = 0.037; amt.gain.value = 0.15;
      lfo.connect(amt); amt.connect(g.gain); lfo.start();
      src.connect(g); g.connect(out);
    });
    layer('waves', noiseBuffer(lsr, 10, brown), (src, out) => {
      // two slow LFOs out of step make the swells irregular; the filter opens as each wave breaks
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const g = ac.createGain(); g.gain.value = 0.5;
      for (const [f, gain, cut] of [[0.083, 0.32, 380], [0.057, 0.2, 220]]) {
        const lfo = ac.createOscillator(); lfo.frequency.value = f;
        const a = ac.createGain(); a.gain.value = gain; lfo.connect(a); a.connect(g.gain);
        const c = ac.createGain(); c.gain.value = cut; lfo.connect(c); c.connect(lp.frequency);
        lfo.start();
      }
      src.connect(lp); lp.connect(g); g.connect(out);
    });
    layer('pink', noiseBuffer(lsr, 8, pink), (src, out) => {
      const g = ac.createGain(); g.gain.value = 0.6;
      src.connect(g); g.connect(out);
    });
    layer('brown', noiseBuffer(lsr, 8, brown), (src, out) => {
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = ac.createGain(); g.gain.value = 0.7;
      src.connect(lp); lp.connect(g); g.connect(out);
    });
    applyMix(0);

    verbIR = impulse(SR, 6, 3);
    whiteBuffer = noiseBuffer(SR, 4, white);

    el = document.createElement('audio');
    el.setAttribute('playsinline', ''); el.autoplay = false;
    document.body.appendChild(el);
    keepalive = document.createElement('audio');
    keepalive.setAttribute('playsinline', ''); keepalive.loop = true; keepalive.src = silentWav();
    document.body.appendChild(keepalive);
    setRoute(wantRoute);

    const src = 'let id=0;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}';
    try {
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = tick;
    } catch { worker = null; }
    document.addEventListener('visibilitychange', () => tick());
  }

  function setRoute(route) {
    try { limiter.disconnect(); } catch { /* not connected */ }
    routeIsStream = false;
    if (route === 'stream' && ac.createMediaStreamDestination && 'srcObject' in el) {
      streamDest ??= ac.createMediaStreamDestination();
      limiter.connect(streamDest);
      el.srcObject = streamDest.stream;
      routeIsStream = true;
      keepalive.pause();
    } else {
      el.pause(); el.srcObject = null;
      limiter.connect(ac.destination);
    }
  }
  /** Start or stop the media element that makes the phone treat this as playing media. */
  function media(on) {
    const m = routeIsStream ? el : keepalive;
    if (on) m.play().catch(() => {}); else { el.pause(); keepalive.pause(); }
  }

  function applyMix(ramp = 0.4) {
    if (!ac) return;
    const now = ac.currentTime;
    const curve = (v) => v * v; // sliders feel more even with a squared law
    buses.music.gain.setTargetAtTime(curve(mix.music) * 0.9, now, ramp);
    buses.rain.gain.setTargetAtTime(curve(mix.rain) * 0.5, now, ramp);
    buses.waves.gain.setTargetAtTime(curve(mix.waves) * 0.6, now, ramp);
    buses.brown.gain.setTargetAtTime(curve(mix.brown) * 0.5, now, ramp);
    buses.pink.gain.setTargetAtTime(curve(mix.pink) * 0.35, now, ramp);
  }

  // ------------------------------------------------------------------ chunk rendering
  async function renderChunk(s, k) {
    const from = k * CHUNK, to = from + CHUNK;
    const oac = new OfflineAudioContext(2, Math.ceil((CHUNK + TAIL) * SR), SR);
    const dry = oac.createGain(); dry.connect(oac.destination);
    // reverb
    const verb = oac.createGain();
    const conv = oac.createConvolver(); conv.buffer = verbIR;
    const verbOut = oac.createGain(); verbOut.gain.value = 0.55;
    verb.connect(conv); conv.connect(verbOut); verbOut.connect(oac.destination);
    // ping-pong delay with a darkening feedback loop
    const delay = oac.createGain();
    const dl = oac.createDelay(3), dr = oac.createDelay(3);
    dl.delayTime.value = dr.delayTime.value = composer.delayTime;
    const fb = oac.createGain(); fb.gain.value = 0.4;
    const tone = oac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
    const pl = oac.createStereoPanner(), pr = oac.createStereoPanner(); pl.pan.value = -0.7; pr.pan.value = 0.7;
    const delOut = oac.createGain(); delOut.gain.value = 0.5;
    delay.connect(dl); dl.connect(pl); pl.connect(delOut);
    dl.connect(dr); dr.connect(pr); pr.connect(delOut);
    dr.connect(tone); tone.connect(fb); fb.connect(dl);
    delOut.connect(oac.destination); delOut.connect(verb);

    const chunkEvents = [];
    const A = {
      ac: oac, mobile, dry, verb, delay, whiteBuffer, from,
      emit(type, time, data) { chunkEvents.push({ type, time: s.t0 + time, ...data }); },
    };
    composer.chunk(A, from, to, (t) => energyCurve(t, s.total));
    const started = performance.now();
    const buffer = await oac.startRendering();
    stats.lastRenderMs = Math.round(performance.now() - started); stats.chunks++;
    if (session !== s) return; // stopped meanwhile
    cleanUp(buffer);
    const src = ac.createBufferSource(); src.buffer = buffer;
    src.connect(s.trim);
    const at = s.t0 + from, now = ac.currentTime;
    if (at >= now + 0.02) src.start(at);
    else if (now - at < CHUNK + TAIL) src.start(now + 0.02, now + 0.02 - at); // late: join in step
    else return;
    s.sources.add(src);
    src.onended = () => { s.sources.delete(src); try { src.disconnect(); } catch { /* fine */ } };
    events = events.concat(chunkEvents).sort((a, b) => a.time - b.time);
  }

  async function pump() {
    const s = session;
    if (!s || s.rendering) return;
    s.rendering = true;
    try {
      const ahead = document.hidden ? AHEAD_HIDDEN : AHEAD;
      while (session === s && s.next * CHUNK < Math.max(0, ac.currentTime - s.t0) + ahead) {
        if (s.total && s.next * CHUNK > s.total) break;
        await renderChunk(s, s.next++);
      }
    } catch (err) {
      console.error('render failed', err);
    } finally { s.rendering = false; }
  }

  function tick() {
    if (!session || !composer) return;
    pump();
    if (!paused && session.total && ac.currentTime > session.t0 + session.total + 0.5) end();
  }

  function scheduleEnvelope(from) {
    const g = master.gain, now = ac.currentTime;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
    const fadeInEnd = session.t0 + 5;
    if (from < fadeInEnd) g.linearRampToValueAtTime(1, fadeInEnd);
    else g.linearRampToValueAtTime(1, now + 2);
    if (!session.total) return;
    const end = session.t0 + session.total, len = fadeLength(session.total);
    const start = Math.max(end - len, Math.max(fadeInEnd, now + 2) + 0.01);
    // an equal-power fade feels even all the way down
    const N = 64, curve = new Float32Array(N);
    for (let i = 0; i < N; i++) curve[i] = Math.cos((i / (N - 1)) * Math.PI / 2) ** 2;
    g.setValueCurveAtTime(curve, start, Math.max(1, end - start));
  }

  function end() {
    const s = session;
    stopNow();
    if (s) onEnd();
  }

  function stopNow() {
    if (!ac) return;
    const s = session;
    session = null; paused = false;
    if (s) {
      for (const src of s.sources) { try { src.stop(); } catch { /* not started */ } }
      s.live?.stop(ac.currentTime);
      setTimeout(() => { try { s.trim.disconnect(); } catch { /* fine */ } }, 300);
    }
    composer = null; events = [];
    worker?.postMessage(0);
    clearInterval(fallbackTimer);
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(0, ac.currentTime);
    setTimeout(() => { if (!session) { ac.suspend(); media(false); } }, 200);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  let fallbackTimer = 0;

  return {
    get ctx() { return ac; },
    get route() { return routeIsStream ? 'stream' : 'direct'; },
    get running() { return !!session; },
    get paused() { return paused; },
    mix, stats,
    get queued() { return session ? session.sources.size : 0; },
    /** For the on-screen audio stats. */
    debugInfo() {
      if (!ac) return null;
      const ahead = session ? session.next * CHUNK - (ac.currentTime - session.t0) : 0;
      const ps = ac.playoutStats || ac.playbackStats;
      return {
        route: routeIsStream ? 'stream' : 'direct', state: ac.state, rate: ac.sampleRate, renderRate: SR,
        latency: Math.round(((ac.baseLatency || 0) + (ac.outputLatency || 0)) * 1000),
        chunks: stats.chunks, renderMs: stats.lastRenderMs, ahead: Math.round(ahead),
        glitches: ps ? (ps.fallbackFramesEvents ?? ps.underrunEvents ?? null) : null,
      };
    },
    set onEnd(f) { onEnd = f; },

    /** Must be called from a tap (browsers only start audio from a user gesture). */
    start({ scene, seed, minutes }) {
      init();
      if (session) stopNow();
      ac.resume();
      media(true);
      composer = COMPOSERS[scene]({ rng: mulberry32(seed), mobile });
      const t0 = ac.currentTime + 0.25;
      const trim = ac.createGain(); trim.gain.value = composer.level ?? 1; trim.connect(buses.music);
      session = { t0, total: minutes ? minutes * 60 : 0, scene, next: 0, rendering: false, sources: new Set(), live: null, trim };
      paused = false;
      session.live = composer.live(ac, trim, t0);
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setValueAtTime(0, ac.currentTime);
      scheduleEnvelope(t0);
      if (worker) worker.postMessage(250); else fallbackTimer = setInterval(tick, 250);
      tick();
    },

    /** Seconds into the session (stops while paused), and the session length (0 = no timer). */
    elapsed() { return session ? Math.max(0, ac.currentTime - session.t0) : 0; },
    total() { return session ? session.total : 0; },
    energy() { return session ? energyCurve(ac.currentTime - session.t0, session.total) : 1; },

    /** Change the timer mid-session (minutes from the session's start; 0 = no timer). */
    setTotal(minutes) {
      if (!session) return;
      session.total = minutes ? minutes * 60 : 0;
      scheduleEnvelope(ac.currentTime);
      tick();
    },

    pause() {
      if (!session || paused) return;
      paused = true;
      ac.suspend(); media(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    },
    resume() {
      if (!session || !paused) return;
      paused = false;
      ac.resume();
      media(true);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      tick();
    },
    stop() {
      if (!session) return;
      // a quick fade rather than a cut
      const now = ac.currentTime, g = master.gain;
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
      g.linearRampToValueAtTime(0, now + 1.2);
      const s = session;
      setTimeout(() => { if (session === s) stopNow(); }, 1300);
    },

    setMix(partial) { Object.assign(mix, partial); applyMix(); },
    setRoute(route) {
      wantRoute = route;
      if (!ac) return;
      media(false);
      setRoute(route);
      if (session && !paused) media(true);
    },

    /** Events (bells, drips, kicks, chords) whose time has come, for the visuals. */
    drainEvents() {
      if (!ac || !events.length) return [];
      const now = ac.currentTime;
      let n = 0;
      while (n < events.length && events[n].time <= now) n++;
      if (!n) return [];
      const out = events.slice(0, n);
      events = events.slice(n);
      return out.filter((e) => now - e.time < 1); // skip a backlog (after the screen was off)
    },
  };
}
