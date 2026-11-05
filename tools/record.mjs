// Records the page frame by frame, straight from the real scene.
//
//   node tools/record.mjs shots 0 0.1 0.3 ...    -> review/shot-0.000.png ...
//   node tools/record.mjs video                    -> review/frames/*.png, then ffmpeg
//
// Needs: a local server on PORT (python3 -m http.server 8000), Node with
// Playwright installed (npm i playwright && npx playwright install chromium).
// Set VENDOR=/path/to/node_modules to serve three/gsap/lenis from disk instead
// of the CDN (for machines without internet access).

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 8000;
const W = +(process.env.W || 1920), H = +(process.env.H || 1080);
const OUT = process.env.OUT || 'review';
const [mode = 'shots', ...rest] = process.argv.slice(2);

// time (s) -> scroll progress, for the video. Holds on the sheet at the start
// and on the kitchen at the end; slower where there is more to look at.
const KEYS = [
  [0, 0], [2.2, 0], [6.5, 0.05], [15, 0.3], [22.5, 0.5], [30, 0.675], [35, 0.765],
  [41, 0.86], [47, 0.95], [51.5, 1], [54, 1],
];
function monotone(keys) {
  const n = keys.length, xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// GPU=1 renders on the real graphics card (much faster); the default is the
// software renderer, which works everywhere.
const glArgs = process.env.GPU
  ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args: glArgs });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

if (process.env.VENDOR) {
  const V = process.env.VENDOR;
  const map = [
    [/three@[^/]+\/build\//, 'three/build/'],
    [/three@[^/]+\/examples\/jsm\//, 'three/examples/jsm/'],
    [/gsap@[^/]+\/dist\//, 'gsap/dist/'],
    [/lenis@[^/]+\/dist\//, 'lenis/dist/'],
  ];
  await page.route('https://cdn.jsdelivr.net/**', (route) => {
    const url = route.request().url();
    for (const [re, local] of map) {
      const m = url.match(re);
      if (m) {
        const file = path.join(V, local, url.slice(m.index + m[0].length));
        const type = file.endsWith('.css') ? 'text/css' : 'application/javascript';
        return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
      }
    }
    return route.abort();
  });
}

// ROUTE=a|b|c|d picks a walk-through variation (js/routes.js)
await page.goto(`http://localhost:${PORT}/?capture=1${process.env.PR ? '&pr=' + process.env.PR : ''}${process.env.ROUTE ? '&route=' + process.env.ROUTE : ''}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForTimeout(800);
fs.mkdirSync(OUT, { recursive: true });

if (mode === 'shots') {
  const list = rest.length ? rest.map(Number) : [0, 0.12, 0.3, 0.42, 0.5, 0.6, 0.7, 0.76, 0.84, 0.92, 1];
  for (const s of list) {
    await page.evaluate((v) => window.__frame(v), s);
    const f = path.join(OUT, `shot-${process.env.ROUTE ? process.env.ROUTE + '-' : ''}${s.toFixed(3)}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 85 });
    console.log(f);
  }
} else if (mode === 'video') {
  const FPS = +(process.env.FPS || 30);
  const dur = KEYS[KEYS.length - 1][0];
  const toS = monotone(KEYS);
  const dir = path.join(OUT, 'frames');
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(dur * FPS);
  const from = +(process.env.FROM || 0);
  const to = Math.min(n, +(process.env.TO || n));
  const t0 = Date.now();
  for (let i = from; i < to; i++) {
    const s = toS(i / FPS);
    await page.evaluate((v) => window.__frame(v), s);
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (i % 60 === 0) console.log(`frame ${i}/${n}  s=${s.toFixed(3)}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log(`done: ${n} frames. Now: ffmpeg -framerate ${FPS} -i ${dir}/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 demo.mp4`);
}
const state = await page.evaluate(() => window.__state && window.__state());
console.log('state', JSON.stringify({ calls: state?.calls, tris: state?.tris, errors: state?.errors }));
if (logs.length) console.log(logs.slice(0, 30).join('\n'));
await browser.close();
