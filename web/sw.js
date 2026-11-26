// Offline support: network first (so updates show straight away), cached copy when offline.
const CACHE = 'lullwave-v36';
const J = './vendor/three/examples/jsm/';
const CORE = ['./', './index.html', './main.js', './audio.js', './render.js',
  './music/voices.js', './music/cave.js', './music/drive.js', './music/ocean.js', './music/aurora.js', './music/rain.js', './music/space.js', './music/disco.js', './music/nature.js', './music/eventing.js', './music/cotswold.js', './scenes/cave.js', './scenes/drive.js', './scenes/ocean.js', './scenes/aurora.js', './scenes/rain.js', './scenes/space.js', './scenes/disco.js', './scenes/country.js', './scenes/eventing.js', './scenes/cotswold.js', './scenes/kit.js', './scenes/tabby.js', './scenes/dream/penny-life.js', J + 'loaders/GLTFLoader.js', './models/penny/ArmChair_01.glb', './models/penny/ClassicNightstand_01.glb', './models/penny/Ottoman_01.glb', './models/penny/Sofa_01.glb', './models/penny/potted_plant_04.glb', './models/penny/throw_pillows_01.glb', './models/penny/vintage_grandfather_clock_01.glb', './models/penny/vintage_oil_lamp.glb', './models/penny/wicker_basket_01.glb', './models/penny/wooden_bookshelf_worn.glb',  './scenes/figures.js', './scenes/interior.js', './music/ambient.js', './music/profiles.js', './music/bespoke.js', './music/xmas.js', './music/choirsong.js', './music/pizzeria.js', './music/feversong.js', './music/canalsong.js', './music/pennysong.js', './scenes/dream/meadow.js', './scenes/dream/estate.js', './scenes/dream/woolpack.js', './scenes/dream/canal.js', './scenes/dream/stables.js', './scenes/dream/market.js', './scenes/dream/trail.js', './scenes/dream/choir.js', './scenes/dream/penny.js', './scenes/dream/pizza.js', './scenes/dream/lost.js', './scenes/dream/stardome.js', './scenes/dream/bakery.js', './scenes/dream/fever.js', './scenes/dream/sheep.js', './music/sheepsong.js', './scenes/dream/pixel.js', './music/chipsong.js', './scenes/dream/sands.js', './music/sandsong.js', './scenes/dream/snowstorm.js', './music/snowsong.js', './scenes/dream/saysno.js', './scenes/dream/nobot-talk.js', './music/saysnosong.js', './scenes/dream/train.js', './scenes/dream/train-journey.js', './scenes/dream/train-cars.js', './music/trainsong.js', './scenes/dream/pusher.js', './music/pushersong.js',
  './vendor/three/build/three.module.js', J + 'utils/BufferGeometryUtils.js',
  J + 'postprocessing/EffectComposer.js', J + 'postprocessing/Pass.js', J + 'postprocessing/RenderPass.js', J + 'postprocessing/ShaderPass.js',
  J + 'postprocessing/MaskPass.js', J + 'postprocessing/OutputPass.js', J + 'postprocessing/UnrealBloomPass.js', J + 'shaders/CopyShader.js',
  J + 'shaders/OutputShader.js', J + 'shaders/LuminosityHighPassShader.js',
  './manifest.webmanifest', './fonts.css', './fonts/Unbounded-1.woff2', './fonts/Outfit-0.woff2',
  './icons/icon.svg', './thumbs/cave.jpg', './thumbs/drive.jpg', './thumbs/ocean.jpg', './thumbs/aurora.jpg', './thumbs/rain.jpg', './thumbs/space.jpg', './thumbs/eventing.jpg', './thumbs/cotswold.jpg', './thumbs/disco.jpg', './thumbs/meadow.jpg', './thumbs/estate.jpg', './thumbs/woolpack.jpg', './thumbs/canal.jpg', './thumbs/stables.jpg', './thumbs/market.jpg', './thumbs/trail.jpg', './thumbs/choir.jpg', './thumbs/penny.jpg', './thumbs/pizza.jpg', './thumbs/lost.jpg', './thumbs/stardome.jpg', './thumbs/bakery.jpg', './thumbs/fever.jpg', './thumbs/sheep.jpg', './thumbs/pixel.jpg', './thumbs/sands.jpg', './thumbs/snowstorm.jpg', './thumbs/saysno.jpg', './thumbs/train.jpg', './thumbs/pusher.jpg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))));
});
