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
const KEYS_PLAN = [
  [0, 0], [2.2, 0], [6.5, 0.05], [15, 0.3], [22.5, 0.5], [30, 0.675], [35, 0.765],
  [41, 0.86], [47, 0.95], [51.5, 1], [54, 1],
];
// the roof opening has three drawings to show before the descent: hold on each
const KEYS_ROOF = [
  [0, 0], [3.0, 0.03], [6.0, 0.06], [8.5, 0.12], [11.5, 0.17], [14.5, 0.24], [17.0, 0.29],
  [21.5, 0.4], [26.0, 0.5], [33.5, 0.675], [38.5, 0.765], [44.5, 0.86], [50.5, 0.95], [55, 1], [57.5, 1],
];
// the Clayborn presentation (the default): sheet, plans, arrival, rooms, up, down, outside, close
const KEYS_TOUR = [
  [0, 0], [2.5, 0.03], [5.5, 0.085], [6.6, 0.09], [8.0, 0.114], [8.6, 0.117], [10.0, 0.138], [10.6, 0.141], [12.0, 0.163],
  [12.6, 0.166], [14.0, 0.19], [19.0, 0.27], [22.0, 0.3], [26.0, 0.342], [28.5, 0.364], [30.5, 0.38], [31.5, 0.386], [34.0, 0.398], [35.5, 0.412], [38.5, 0.438], [40.5, 0.452], [47.0, 0.526],
  [50.0, 0.548], [52.5, 0.566], [55.0, 0.58], [60.5, 0.64], [63.0, 0.656], [65.5, 0.67], [72.0, 0.732], [76.0, 0.766],
  [78.0, 0.78], [82.0, 0.815], [87.0, 0.85], [94.0, 0.9], [99.5, 0.955], [102.0, 0.972], [105.0, 0.99], [107.5, 1],
];
// the render presentation (PAGE=renders.html): site, four plans, four elevations, close
const KEYS_RENDERS = [
  [0, 0], [3.0, 0.03], [9.0, 0.11], [12.0, 0.16], [16.0, 0.22], [18.0, 0.25], [22.5, 0.32], [24.5, 0.35],
  [29.5, 0.43], [31.5, 0.46], [36.0, 0.53], [39.0, 0.58], [45.0, 0.67], [47.0, 0.69], [52.0, 0.76],
  [54.0, 0.78], [59.0, 0.85], [61.0, 0.87], [65.0, 0.92], [68.0, 0.945], [71.0, 0.97], [74.0, 1],
];
const KEYS = process.env.PAGE === 'renders.html' ? KEYS_RENDERS : process.env.OPEN === 'roof' ? KEYS_ROOF : ['plan', 'elevation'].includes(process.env.OPEN) || process.env.ROUTE ? KEYS_PLAN : KEYS_TOUR;
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

// ROUTE=a|b|c|d picks a walk-through variation (js/routes.js); OPEN=elevation opens on sheet A2.1
await page.goto(`http://localhost:${PORT}/${process.env.PAGE || ''}?capture=1${process.env.PR ? '&pr=' + process.env.PR : ''}${process.env.ROUTE ? '&route=' + process.env.ROUTE : ''}${process.env.OPEN ? '&open=' + process.env.OPEN : ''}${process.env.PAGE ? '#capture' : ''}`);
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
