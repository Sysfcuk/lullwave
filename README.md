# Lullwave

**Generative sleep music with slow, dreamy 3D worlds.**

▶ **[Open on your phone](https://sysfcuk.github.io/lullwave/)**, then tap **Install app** (Android/Chrome), or on iPhone use Safari's
**Share → Add to Home Screen**.

Pick a world, set a sleep timer, and drift off. The music is composed live in the browser (Web Audio, no audio files),
so it never plays the same way twice, and it winds down over the night: the tempo slows, layers drop away, the filter
closes, and in the last stretch of the timer everything fades out.

## Worlds

| World | Visuals | Music |
| --- | --- | --- |
| **Crystal Cave** | A slow drift round an underground lake. Crystals light up as the bells ring; drips ripple the water. | Lydian pads, glass bells answering across the cavern, a drone, water drops, wind. |
| **Night Drive** | An endless neon road through wireframe mountains. The striped sun sinks as the night goes on. | Slow synthwave: detuned saw pads with tape wobble, bass, arpeggio, a sung hook, a soft beat, passing cars. |

Every session has a **variation** number (the seed): the same number gives the same layout and the same tune.

## Features

- Sleep timer: 15 to 90 minutes, no timer, or a custom length; +15 minutes mid-session.
- Ambience mixer: music, rain, waves and brown noise, each with its own level.
- The screen dims gently, then fades to black after a set time (5, 15 or 30 minutes, or never) and lets the phone sleep;
  the sound keeps playing. A warm-screen filter cuts blue light.
- Lock-screen controls (Media Session), offline support (service worker), installable PWA.

## How it keeps playing with the screen off

- The audio goes through a `MediaStream` into an `<audio>` element, so the phone treats it as media playback.
  (Settings → Background audio → **Direct** switches back to plain Web Audio if a device plays nothing.)
- The whole session's volume envelope, including the final fade, is scheduled on the audio thread when it starts.
- Rain, waves, noise and each world's drone are looping sources that need no JavaScript once started.
- Notes are scheduled from a Web Worker clock, with a longer look-ahead while the page is hidden.

## Run it locally

```powershell
python serve.py      # http://localhost:8150
```

No build step: plain ES modules and Three.js (vendored in `web/vendor/three`). Pushing to `main` deploys `web/` to
GitHub Pages.

| File | What it does |
| --- | --- |
| `web/main.js` | Screens, settings, the session (timer, dimming, wake lock, lock-screen controls), install button. |
| `web/audio.js` | Audio graph, reverb and delay, ambience layers, scheduler, session envelope. |
| `web/music/*.js` | The composers (`cave.js`, `drive.js`) and shared synth voices (`voices.js`). |
| `web/render.js` | Renderer, bloom, frame loop (30 fps in a session), adaptive resolution. |
| `web/scenes/*.js` | The 3D worlds. |
