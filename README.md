# Lullwave

**Generative sleep music with slow, dreamy 3D worlds.**

▶ **[Open on your phone](https://sysfcuk.github.io/lullwave/)**, then tap **Install app** (Android/Chrome), or on iPhone use Safari's
**Share → Add to Home Screen**.

Pick a world, set a sleep timer, and drift off. The music is composed live in the browser (Web Audio, no audio files),
so it never plays the same way twice, and it winds down over the night: the tempo slows, layers drop away, the filter
closes, and in the last stretch of the timer everything fades out.

## Worlds

Sixteen worlds are on: Crystal Cave, Night Drive, Deep Ocean, Aurora, Cotswold Valley, Disco Cat, and ten dream
scenes (Moonlit Canal, Christmas Market, Midnight Choir, Penny's Night Patrol, Pineapple Pizza Incident, Counting
Sheep, 8-Bit Night Walk, Glowing Sands, The Fantastical Snowstorm, Pineapple Fever Dream). The others are switched off with `off: true` in `WORLDS` in `web/main.js`; their code is kept, and
flipping the flag brings one back.

| World | Visuals | Music |
| --- | --- | --- |
| **Crystal Cave** | A slow flight down an endless winding tunnel of wet, bump-mapped rock. Faceted crystals grow from the walls, their light glowing in the damp air and mirrored in a stream along the floor; a cluster flares on the side each bell rings from, and drips ripple the water. Stalactites, glinting mineral veins, dust lit by the crystals. | Lydian pads, glass bells answering across the cavern, a drone, water drops, wind. |
| **Night Drive** | An endless rain-wet neon road through wireframe mountains, towards a striped sun behind far ranges and a city skyline. The sun sinks as the night goes on; kicks roll rings of light across the grid; passing cars, thin clouds, swaying palms, shooting stars. | Slow synthwave: detuned saw pads with tape wobble, bass, arpeggio, a sung hook, a soft beat, passing cars. |
| **Deep Ocean** | Sinking slowly through dark water: glowing jellyfish pulse and trail their tentacles, marine snow drifts, shafts of light from the surface fade through the night, plankton flare in rings at each sonar ping, bubbles rise, and a whale glides past when one sings. | Muffled Dorian pads, a slowly beating sub drone, sonar pings echoing away, whale song, strings of bubbles. |
| **Aurora** | Northern lights ripple and fold over a snowy tundra, mirrored in a still lake; snow-laden pines, falling snow, a low moon. Chords brighten the aurora, chimes send a shimmer along it. | A hushed choir over a drone, glassy chimes, wind across the snow. |
| **Neon Rain** | Rain runs down a window over a city at night: out-of-focus neon and street lights, traffic far below, each drop a tiny lens; lightning before the thunder. | Lo-fi: electric piano jazz chords, upright-ish bass, brushed swing beat, rain on the glass, distant thunder. |
| **Stardust** | Drifting through deep space: a swirling nebula with dust lanes, nearer clouds drifting past, streaming stars, a ringed gas giant lit by a far sun, the odd comet. | Evolving pads with breathing filters, a slow echoing arpeggio, a sub drone, radio-like sweeps. |
| **Disco Cat** | A rainbow cat really dances on a light-up floor under a spinning mirror ball, on the beat of the music's kick drum: groove, point, paws up, step and clap, shimmy, a twirl. Two follow-spots track it and a ring of kitten fans bobs along in the shadows, eyes glowing. As the night winds down it sits and sways, paw-tapping, then yawns, stretches, hops onto a velvet cushion and curls up; the kittens nod off one by one; Zs float up. | A soft disco groove (gentle kick, octave bass, offbeat keys, strings) that winds down into a music-box lullaby. |
| **Cross Country** | Riding a cross-country course at sunset, seen between your horse's ears: logs, rails, brush fences and roll-tops flagged red and white, hedgerows and oaks. The canter eases to a walk round the fences as the sun sets and the stars come out. | Pastoral folk in a lilting 6/8: plucked arpeggios, strings, a flute with a new tune each time, soft hoofbeats in a canter rhythm, evening birds. |
| **Cotswold Valley** | An evening walk high on the side of a steep valley (inspired by the Laurie Lee walk around Slad): beech woods, dry-stone walls, sheep, a stream, and a village of honey-stone cottages whose windows light up at dusk; glow-worms and stars under moonlight. | English pastoral strings, a wandering folk flute, blackbirds and a thrush, the stream, a church bell across the valley, a tawny owl after dark. |

### Dream scenes

The ten dream scenes that are on each have their own hand-written composer, with its own original tunes, band and
sounds of the place (built on `web/music/bespoke.js`):

| Scene | Music |
| --- | --- |
| **The Moonlit Canal** (`canalsong.js`) | A barcarolle in rocking 6/8: a clarinet sings over a harp that rocks up and down each chord like the boat; water laps the hull, a narrowboat engine putters far off, ducks, drips, an owl. |
| **The Christmas Market** (`xmas.js`) | A carol-like waltz on celesta and music box over warm strings and pizzicato; sleigh bells on the beat, handbells ringing rounds, the church clock, the market's murmur, footsteps in snow. |
| **The Midnight Choir** (`choirsong.js`) | Plainsong: a cantor sings a slow modal line and the choir answers "amen", over a humming choir and an organ pedal in a long stone echo; the tower bell tolls. No beat. |
| **Penny's Night Patrol** (`pennysong.js`) | A late-night jazz trio: vibraphone tune, electric piano comping, walking bass and brushes, swung, round a ii-V-I; Penny purrs, the embers settle, the grandfather clock ticks and chimes, the odd sleepy mew. |
| **The Pineapple Pizza Incident** (`pizzeria.js`) | A slow tarantella in A minor: mandolin tremolo, accordion on the off-beats, guitar bass, a whispered tambourine; the oven's fire, the chef kneading, plates clinking. |
| **Pineapple Fever Dream** (`feversong.js`) | A warped tropical lullaby: steel pan in a whole-tone scale, a marimba echo, wobbling augmented chords, celesta twinkles, the odd boing. |
| **Counting Sheep** (`sheepsong.js`) | A music-box waltz over soft strings that slowly winds down through the night like a box running down. It breathes with the jumps: a rising swell as each sheep starts its run-up (breathe in), a falling one as it floats down beneath the moon (breathe out), with a bell that climbs the scale as the count goes up. A bleat now and then, the ram's huff, the box being wound again. |
| **8-Bit Night Walk** (`chipsong.js`) | A chiptune lullaby, softened for bedtime: a triangle-wave tune with a thin pulse-wave echo, slow pulse arpeggios, a triangle bass, the faintest ticks; 8-bit crickets, a sparkle when a shooting star goes over, and the campfire crackling once the walker has stopped. The beat sets the walker's pace. |
| **Glowing Sands** (`sandsong.js`) | Glassy and still: soft sine pads drifting through a lydian progression, tiny high bell pings falling at random like grains striking glass (fewer as the night goes on), a slow phrase on glass bells, a low hum and the faint hiss of sand. |
| **The Fantastical Snowstorm** (`snowsong.js`) | A storm that blows itself out into a lullaby: resonant gusts that rise, howl and fade (sent to the scene, so the snow surges with them) over a low drone and a wordless choir; a glassy celesta tune in D dorian, sleigh-bell shimmers for the snow spirits. The gusts come softer and further apart through the night until only the choir, the celesta and the hush of snow are left. |

In **Counting Sheep**, a flock of cloud-sheep grazes on stars growing in the grass of a floating island, above a slowly billowing sea of moonlit cloud. Each sheep has its own mind: it wanders, eats a star (which grows back), rests, or looks up to bleat. On the music's breath, one trots up and leaps the fence, sailing across the gap to the next island beneath a moon that hangs high in the sky: the run-up and the hop to the top are the in-breath, and the long, slow float down onto the quilt (ears up, legs dangling, like thistledown) is the out-breath. A number glows and fades at the top of the leap. A soft ring of light round the moon breathes with the music, swelling on the in-breath and settling on the out-breath, whether or not a sheep is jumping, so you can breathe along with it. It lands on the next island (a patchwork quilt with a pillow), finds a bed and goes to sleep; later its fleece dissolves into a soft cloud that drifts up into the sky, and a cloud may come back down to the grass as a sheep. The moon waxes through the night, from a thin, leaning crescent at bedtime (with the rest of its face just showing by earthshine) to full; when it's full it has a face, fast asleep. As the night goes on the jumps get lazier and the clouds stop coming down, until the flock is asleep on the quilt and in the sky. The ram won't jump: he watches from the fence and shakes his head. Now and then he squares up to it (backs off, paws the ground, makes a run at it), stops short, shakes his head and wanders off. In the end he falls asleep there.

**8-Bit Night Walk** is real pixel art: the whole picture is drawn into a small pixel buffer (about 100-200
pixels across, sized to the screen so the pixels stay square) and shown full screen with no smoothing. A little
sleepwalker in a nightcap and pyjamas, lantern in hand, walks through a never-repeating night of parallax mountains,
hills with windmills and castles, villages whose windows (and chimney smoke) go out one by one, woods, lamp posts, and
ponds with little bridges that mirror the sky. Stars twinkle, clouds drift over the moon, fireflies blink, and now and
then a shooting star crosses. As the night winds down the walker looks for a field, builds a campfire, sits by it,
then lies down under a blanket; pixel Zs drift up and the fire burns low.

**Glowing Sands** is a real falling-sand simulation in an hourglass: about seven thousand glowing grains in rainbow
layers pour through the neck and heap below. Grains speed up once they're falling free, so the stream stretches into
sparkling droplets; the whole stream sways as it falls, so the heap's peak wanders and its layers come out wavy and
lopsided; hard landings roll on and throw up a little glitter; the neck dribbles, and now and then catches for a moment
and lets go with a rush. When the stream stops, the hourglass slowly turns over and settles with a slight lean of its own (so each pour slides
its own way); every grain keeps its
colour, so each turn stirs the layers into new chevrons and stripes. A glow behind the glass takes the colour of the
falling stream. Through the night the sand runs slower and dimmer, and at the end the glass comes to rest.

**The Fantastical Snowstorm** circles a hilltop clearing in a snowy pine wood, with a lantern-lit cabin and its
chimney smoking. At bedtime it's a whiteout: thousands of flakes streak along a swirling wind (each stretched along
the way it's being blown), gusts surge with the music, snow devils spiral across the clearing, spindrift streams over
the ground and the pines sway. And it's not an ordinary storm: giant snowflakes, each drawn in code with its own
arms, branches and plates, drift slowly past and turn; groves of ice crystals glow among the trees; little snow
spirits ride the wind trailing light and chase one another. Through the night the storm blows itself out: the wind
drops, the fog lifts, the clouds part on the stars and the moon, an aurora unfurls over the trees, the snow falls
gently, and the spirits settle on the crystals and treetops like fairy lights.

The switched-off dream scenes use the shared ambient composer described below.

#### The shared ambient composer

The other dream scenes share one ambient composer
(`web/music/ambient.js`), but each profile in `web/music/profiles.js` makes it a different little band: its own key
and mode (including pentatonic and whole-tone), time signature (waltzes and lilting 6/8s), swing, chord colour,
accompaniment (harp arpeggios, strummed guitar, oom-pah-pah, Alberti, a rocking boat, twinkles), bass line (held,
walking, pulsing), the softest percussion (brushes, a shaker, a heartbeat, a ticking clock), a lead that plays a new
little tune each time (flute, whistle, celesta, marimba, mandolin, electric piano, choir; sometimes echoed in canon),
and a bed of sounds for the place (crickets, owls, water, a fire, a pub's
murmur, footsteps, horses, ducks, a purring cat). It all thins out as the night goes on.

| Scene | What you see | What you hear |
| --- | --- | --- |
| **ET's Midnight Meadow** | A horse grazing in long moonlit grass under a huge moon; fireflies, oaks, a lantern on the stable. | Strings and a flute; crickets, an owl, a soft nicker now and then (and the horse looks up). |
| **The Rivals Estate** | A grand manor by moonlight: portico, a fountain with a gilded horse, a striped lawn, a flamingo float drifting on the pool, a tennis court. | Lydian strings and harp; a fountain, crickets, a far-off owl. |
| **The Woolpack at Dusk** | A village pub in a dale at dusk: lit windows, chimney smoke, a creaking sign, picnic tables, a footpath up the hill. | Folk organ and flute; a murmur of voices, a crackling fire, evening birds. |
| **The Moonlit Canal** | A narrowboat (*The Dormouse*) drifting along a canal under a big moon, past willows, a hump bridge and sleeping ducks. | Glass pads and bells; lapping water, a sleepy quack. |
| **The Midnight Stables** | Horses dozing over their half-doors by lantern light; moonlight shafts and dust; the yard cat asleep on the hay. | Dorian strings and flute; snorts and nickers, wind round the roof. |
| **The Christmas Market** | Snow on glowing stalls, fairy lights, wreaths and swaying stars, steam, a tree twinkling in the square. | A music box and strings; distant sleigh bells, a church bell, footsteps in snow. |
| **The Endless Hiking Trail** | A little hiker on a path that never ends, between stone walls and signposts to imaginary places, towards mountains rising out of a golden haze. | Pastoral strings and flute; footsteps, birds, gusts of wind. |
| **The Midnight Choir** | An old stone church: candles, stained glass glowing with moonlight, shafts of light, a small choir swaying as it sings. | A slow choir in a big reverberant space. |
| **Penny's Night Patrol** | Penny the tabby lives her own night in a country-house sitting room: she naps in her basket, on the sofa or in a cardboard box, laps at her water bowl, eats, grooms, scratches her post, bats a ball of yarn round the room, watches the moon from the window seat, stares at the birdcage, and uses her litter tray like a proper cat (dig, squat, turn round, cover it up thoroughly, sometimes followed by the zoomies). When the mouse peeks out of its hole she stalks, wiggles and pounces (too late, always); when the canary slips out of its cage she follows it round the room, gazing up and swatting at the air. Glowing paw prints fade behind her. She gets sleepier as the night goes on. | A music box over glass pads; purring, the fire, an owl outside. |
| **The Pineapple Pizza Incident** | A pizzeria after closing: the oven glows, the chef kneads, the sign says no pineapple. A pineapple appears anyway, and sometimes one rolls across the floor. | Mandolin and strings; the oven crackling, a low murmur. |
| **Lost on the Trail** | A hiker following a glowing map route round a starlit wood, past signposts that disagree; now and then they stop and scratch their head. | Glass pads and flute; crickets, owls, footsteps. |
| **The Stardome** | A glowing stage far below a vast starry sky, soft beams sweeping slowly, lanterns rising, stars swelling with each chord. | Dreamy electric piano and arpeggios. |
| **Pineapple Fever Dream** | The dream after the pizzeria: a giant pineapple fast asleep (Zs drifting up) on a checkerboard that rolls gently away for ever, under a pineapple-ring moon and a sky whose colours slowly wander; pineapples, rings and pineapple pizza slices tumble past, and the old NO PINEAPPLE sign floats by. | A lydian music box over glass pads and a gentle harp; soft wind, a few crickets. |
| **The Great Bread Bake** | A village bakery in the small hours: the oven glows, loaves steam on the racks (a fresh one appears now and then), flour drifts like snow, a cat sleeps by the oven. | Organ and harp; the oven crackling, early birds. |

The dream scenes are built from a shared kit: `web/scenes/kit.js` (stage, skies, terrain, water, buildings,
lanterns, fairy lights, motes, smoke, light shafts), `figures.js` (horse, cat, little people) and `interior.js`
(rooms, windows, candles, fires). Each scene registers its own update and event handlers, and one sweep on
`dispose()` frees its geometry, materials and textures.

Every session has a **variation** number (the seed): the same number gives the same layout and the same tune.

## Features

- Sleep timer: 15 to 90 minutes, no timer, or a custom length; +15 minutes mid-session.
- Ambience mixer: music, rain, waves, pink noise and brown noise, each with its own level.
- Breathing guide (optional): a soft ring for the first 2 or 5 minutes, six breaths a minute with a longer out-breath.
- Favourites: tap the heart to keep a world and variation you liked, and pick it again from the list.
- Surprise me: a random world and variation.
- Your nights: a log of nights listened (5 minutes or more) and your streak, kept on the device.
- Lock-screen artwork is a frame of the world you're in.
- The screen dims gently, then fades to black after a set time (5, 15 or 30 minutes, or never) and lets the phone sleep;
  the sound keeps playing. A warm-screen filter cuts blue light.
- Lock-screen controls (Media Session), offline support (service worker), installable PWA.

## Grounded in sleep research

What helps and what doesn't, and how Lullwave follows it: see [docs/RESEARCH.md](docs/RESEARCH.md). In short: slow,
soft, instrumental music for 25–60 minutes with a gradual fade; no catchy repeating hooks; no sudden loud sounds
late in the night; a dim screen; low volume. The app's settings include a short tips sheet.

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
| `web/music/*.js` | One composer per world, and the shared synth voices (`voices.js`). |
| `web/render.js` | Renderer (multisampled), bloom, a finishing pass (grain/dither, vignette, chromatic aberration), frame loop (30 fps in a session), adaptive resolution. |
| `web/scenes/*.js` | The 3D worlds; `web/scenes/dream/*.js` the dream scenes, built from `kit.js`, `figures.js` and `interior.js`. |

## Models and credits

Penny's sitting room uses furniture from [Poly Haven](https://polyhaven.com) (CC0, public domain; credit
not required, but thank you): Sofa 01, Arm Chair 01, Ottoman 01, Classic Nightstand 01, Vintage Grandfather
Clock 01, Wooden Bookshelf Worn, Throw Pillows 01, Vintage Oil Lamp, Potted Plant 04 and Wicker Basket 01.
Penny herself is built by hand (`web/scenes/tabby.js`), and her behaviour lives in `web/scenes/dream/penny-life.js`:
needs that rise and fall, a choice of what to do next, A* pathfinding round the furniture, and reactions to the
mouse and the canary.

Models are shrunk for phones by `tools/pack_models.py` (needs Pillow): textures to 512/256/128 px JPEG,
geometry quantised to 16-bit (KHR_mesh_quantization), all packed into one `.glb` each in `web/models/`.
The full-size downloads go in `assets-src/` (not committed):

```powershell
python tools/pack_models.py assets-src/polyhaven web/models/penny Sofa_01 ArmChair_01 ...
```

Scenes load models with `model()` from `web/scenes/kit.js`; each keeps a hand-built stand-in until its
model arrives, so a world still works if a file is missing.

