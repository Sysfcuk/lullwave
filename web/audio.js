// The sound engine: one AudioContext, a master chain, shared reverb and delay, the ambience
// layers (rain, waves, brown noise) and the scene's generative composer.
//
// Sleep-specific choices:
// - The whole session's volume envelope (fade in, the long fade out before the timer ends) is
//   scheduled on the master gain up front, so it happens on time even if the phone freezes the
//   page's JavaScript while the screen is off.
// - The ambience layers are looped buffers and the composers keep a drone running, so there is
//   sound even if note scheduling stalls in the background.
// - The output goes through a MediaStream into an <audio> element (when allowed), so the phone
//   treats it as media playback: lock-screen controls, and it keeps playing with the screen off.
// - Notes are scheduled from a Web Worker clock, which browsers throttle far less than timers on
//   a hidden page, and with a longer look-ahead while the page is hidden.
import { createCave } from './music/cave.js';
import { createDrive } from './music/drive.js';

const COMPOSERS = { cave: createCave, drive: createDrive };

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

export function createEngine({ mobile = false } = {}) {
  let ac = null, master, limiter, dry, verb, delayIn, delayL, delayR, el = null, streamDest = null, routeIsMedia = false;
  const buses = {}, events = [];
  let composer = null, worker = null, session = null, paused = false;
  let whiteBuffer = null;
  const mix = { music: 0.8, rain: 0, waves: 0, brown: 0 };
  let onEnd = () => {}, wantRoute = 'media';

  // ------------------------------------------------------------------ buffers
  function noiseBuffer(sec, fill) {
    const sr = ac.sampleRate, n = Math.floor(sec * sr), fade = Math.floor(sr * 0.5);
    const buf = ac.createBuffer(2, n, sr);
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

  // ------------------------------------------------------------------ graph
  function impulse(sec, decay) {
    const sr = ac.sampleRate, n = Math.floor(sec * sr), buf = ac.createBuffer(2, n, sr);
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

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC({ latencyHint: 'playback' });
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
    master = ac.createGain(); master.gain.value = 0;
    limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 10; limiter.ratio.value = 4; limiter.attack.value = 0.02; limiter.release.value = 0.4;
    master.connect(limiter);

    buses.music = ac.createGain(); buses.music.connect(master);
    dry = ac.createGain(); dry.connect(buses.music);
    verb = ac.createGain();
    const conv = ac.createConvolver(); conv.buffer = impulse(6, 3);
    const verbOut = ac.createGain(); verbOut.gain.value = 0.55;
    verb.connect(conv); conv.connect(verbOut); verbOut.connect(buses.music);
    // ping-pong delay with a darkening feedback loop
    delayIn = ac.createGain();
    delayL = ac.createDelay(3); delayR = ac.createDelay(3);
    const fb = ac.createGain(); fb.gain.value = 0.42;
    const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
    const pl = ac.createStereoPanner(), pr = ac.createStereoPanner(); pl.pan.value = -0.7; pr.pan.value = 0.7;
    const delOut = ac.createGain(); delOut.gain.value = 0.5;
    delayIn.connect(delayL); delayL.connect(pl); pl.connect(delOut);
    delayL.connect(delayR); delayR.connect(pr); pr.connect(delOut);
    delayR.connect(tone); tone.connect(fb); fb.connect(delayL);
    delOut.connect(buses.music); delOut.connect(verb);

    whiteBuffer = noiseBuffer(4, white);
    const layer = (name, buffer, build) => {
      const src = ac.createBufferSource(); src.buffer = buffer; src.loop = true;
      buses[name] = ac.createGain(); buses[name].gain.value = 0;
      build(src, buses[name]);
      buses[name].connect(master);
      src.start(0, Math.random() * buffer.duration);
    };
    layer('rain', noiseBuffer(9, rain), (src, out) => {
      // the rain swells a little, slowly
      const g = ac.createGain(); g.gain.value = 0.85;
      const lfo = ac.createOscillator(), amt = ac.createGain(); lfo.frequency.value = 0.037; amt.gain.value = 0.15;
      lfo.connect(amt); amt.connect(g.gain); lfo.start();
      src.connect(g); g.connect(out);
    });
    layer('waves', noiseBuffer(10, brown), (src, out) => {
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
    layer('brown', noiseBuffer(8, brown), (src, out) => {
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = ac.createGain(); g.gain.value = 0.7;
      src.connect(lp); lp.connect(g); g.connect(out);
    });
    applyMix(0);

    el = document.createElement('audio');
    el.setAttribute('playsinline', ''); el.autoplay = false;
    document.body.appendChild(el);
    setRoute(wantRoute);

    // the scheduler's clock
    const src = 'let id=0;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}';
    try {
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = tick;
    } catch { worker = null; }
    document.addEventListener('visibilitychange', () => tick());
  }

  function setRoute(route) {
    try { limiter.disconnect(); } catch { /* not connected */ }
    routeIsMedia = false;
    if (route === 'media' && ac.createMediaStreamDestination && 'srcObject' in el) {
      streamDest ??= ac.createMediaStreamDestination();
      limiter.connect(streamDest);
      el.srcObject = streamDest.stream;
      routeIsMedia = true;
    } else {
      el.pause(); el.srcObject = null;
      limiter.connect(ac.destination);
    }
  }

  function applyMix(ramp = 0.4) {
    if (!ac) return;
    const now = ac.currentTime;
    const curve = (v) => v * v; // sliders feel more even with a squared law
    buses.music.gain.setTargetAtTime(curve(mix.music) * 0.9, now, ramp);
    buses.rain.gain.setTargetAtTime(curve(mix.rain) * 0.5, now, ramp);
    buses.waves.gain.setTargetAtTime(curve(mix.waves) * 0.6, now, ramp);
    buses.brown.gain.setTargetAtTime(curve(mix.brown) * 0.5, now, ramp);
  }

  // ------------------------------------------------------------------ scheduling
  function tick() {
    if (!session || paused || !composer) return;
    const now = ac.currentTime;
    const ahead = document.hidden ? 4 : 0.6;
    composer.schedule(now + ahead, (t) => energyCurve(t - session.t0, session.total));
    if (session.total && now > session.t0 + session.total + 0.5) end();
  }

  function scheduleEnvelope(from) {
    const g = master.gain, now = ac.currentTime;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
    const fadeInEnd = session.t0 + 6;
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
    if (composer) { composer.stop(ac.currentTime); composer = null; }
    session = null; paused = false;
    worker?.postMessage(0);
    clearInterval(fallbackTimer);
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(0, ac.currentTime);
    setTimeout(() => { if (!session) { ac.suspend(); el.pause(); } }, 200);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  let fallbackTimer = 0;

  return {
    get ctx() { return ac; },
    get isMediaRoute() { return routeIsMedia; },
    get running() { return !!session; },
    get paused() { return paused; },
    mix,
    set onEnd(f) { onEnd = f; },

    /** Must be called from a tap (browsers only start audio from a user gesture). */
    start({ scene, seed, minutes }) {
      init();
      if (session) stopNow();
      ac.resume();
      if (routeIsMedia) el.play().catch(() => { setRoute('direct'); });
      const A = {
        ac, rng: mulberry32(seed), mobile, dry, verb, delay: delayIn, whiteBuffer,
        emit(type, time, data) { events.push({ type, time, ...data }); if (events.length > 300) events.splice(0, events.length - 300); },
      };
      composer = COMPOSERS[scene](A);
      delayL.delayTime.value = delayR.delayTime.value = composer.delayTime;
      const t0 = ac.currentTime + 0.15;
      session = { t0, total: minutes ? minutes * 60 : 0, scene };
      paused = false;
      composer.start(t0);
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setValueAtTime(0, ac.currentTime);
      scheduleEnvelope(t0);
      if (worker) worker.postMessage(100); else fallbackTimer = setInterval(tick, 100);
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
    },

    pause() {
      if (!session || paused) return;
      paused = true;
      ac.suspend(); el.pause();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    },
    resume() {
      if (!session || !paused) return;
      paused = false;
      ac.resume();
      if (routeIsMedia) el.play().catch(() => {});
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
      setRoute(route);
      if (routeIsMedia && session && !paused) el.play().catch(() => {});
    },

    /** Events (bells, drips, kicks, chords) whose time has come, for the visuals. */
    drainEvents() {
      if (!ac || !events.length) return [];
      const now = ac.currentTime, out = [];
      while (events.length && events[0].time <= now) out.push(events.shift());
      return out;
    },
  };
}
