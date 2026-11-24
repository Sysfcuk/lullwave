// Offline support: network first (so updates show straight away), cached copy when offline.
const CACHE = 'lullwave-v8';
const J = './vendor/three/examples/jsm/';
const CORE = ['./', './index.html', './main.js', './audio.js', './render.js',
  './music/voices.js', './music/cave.js', './music/drive.js', './music/ocean.js', './music/aurora.js', './music/rain.js', './music/space.js', './music/disco.js', './scenes/cave.js', './scenes/drive.js', './scenes/ocean.js', './scenes/aurora.js', './scenes/rain.js', './scenes/space.js', './scenes/disco.js',
  './vendor/three/build/three.module.js', J + 'utils/BufferGeometryUtils.js',
  J + 'postprocessing/EffectComposer.js', J + 'postprocessing/Pass.js', J + 'postprocessing/RenderPass.js', J + 'postprocessing/ShaderPass.js',
  J + 'postprocessing/MaskPass.js', J + 'postprocessing/OutputPass.js', J + 'postprocessing/UnrealBloomPass.js', J + 'shaders/CopyShader.js',
  J + 'shaders/OutputShader.js', J + 'shaders/LuminosityHighPassShader.js',
  './manifest.webmanifest', './fonts.css', './fonts/Unbounded-1.woff2', './fonts/Outfit-0.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

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
