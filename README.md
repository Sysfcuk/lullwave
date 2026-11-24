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
| **Crystal Cave** | A slow flight down an endless winding tunnel of wet, bump-mapped rock. Faceted crystals grow from the walls, their light glowing in the damp air and mirrored in a stream along the floor; a cluster flares on the side each bell rings from, and drips ripple the water. Stalactites, glinting mineral veins, dust lit by the crystals. | Lydian pads, glass bells answering across the cavern, a drone, water drops, wind. |
| **Night Drive** | An endless rain-wet neon road through wireframe mountains, towards a striped sun behind far ranges and a city skyline. The sun sinks as the night goes on; kicks roll rings of light across the grid; passing cars, thin clouds, swaying palms, shooting stars. | Slow synthwave: detuned saw pads with tape wobble, bass, arpeggio, a sung hook, a soft beat, passing cars. |

Every session has a **variation** number (the seed): the same number gives the same layout and the same tune.

## Features

- Sleep timer: 15 to 90 minutes, no timer, or a custom length; +15 minutes mid-session.
- Ambience mixer: music, rain, waves and brown noise, each with its own level.
- The screen dims gently, then fades to black after a set time (5, 15 or 30 minutes, or never) and lets the phone sleep;
  the sound keeps playing. A warm-screen filter cuts blue light.
- Lock-screen controls (Media Session), offline support (service worker), installable PWA.

## How the music plays smoothly

The music is composed ahead in 20-second chunks, each rendered by an `OfflineAudioContext` (faster than real time, off
the audio thread) with 24 seconds of tail for notes and reverb to ring out. The live audio graph just plays the
finished buffers, so a phone busy drawing 3D can't make it stutter.

## How it keeps playing with the screen off

- Web Audio plays straight to the speakers, and a silent looping `<audio>` element plays alongside so the phone treats
  the page as playing media (lock-screen controls, keeps going with the screen off). Settings → Audio output →
  **Stream** routes the sound itself through an `<audio>` element instead, for a phone that stops it when locked
  (that route drops out on some Android phones, so it isn't the default).
- The whole session's volume envelope, including the final fade, is scheduled on the audio thread when it starts.
- Rain, waves, noise and each world's drone are looping sources that need no JavaScript once started.
- Chunks are rendered from a Web Worker clock, further ahead (almost two minutes) while the page is hidden.

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
| `web/render.js` | Renderer (multisampled), bloom, a finishing pass (grain/dither, vignette, chromatic aberration), frame loop (30 fps in a session), adaptive resolution. |
| `web/scenes/*.js` | The 3D worlds. |
