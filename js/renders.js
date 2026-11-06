// The render presentation (renders.html): built from Clayborn's rendered plans and elevations.
//
//   1  the site       an aerial of the lot, from the lake up the lawn to the house
//   2  the plans      roof, upper, main and lower levels, stacked in register and peeled away
//   3  outside        round the house without going in: rear (lake), east, front (street), west
//   4  close          Clayborn, and a next step
//
// Everything is a function of one scroll value s (0 to 1). ?capture=1 lets a recorder set s.
//
// Plan space: u = X (feet east), v = 60 - N (feet south, so it runs down the screen). Each plan
// render is pinned by a reference rectangle (pixels in the image -> feet on the plan), measured
// off the renders against the drawing set, so every level lands exactly over the one before.

const U = 10; // px per foot in plan space, before the camera's zoom
const REF = {
  'L-site': { px: [388, 640, 182, 440], ft: [-1.33, 57.46, 2.9, 72.3] }, // the roof as seen in the aerial
  'L-roof': { px: [143, 1005, 182, 1088], ft: [-1.33, 57.46, 2.9, 72.3] }, // roof edges and porch eave
  'L-main': { px: [40, 1005, 25, 990], ft: [0, 56.13, 4.23, 60] }, // outside walls: west, east, garage north, house south
  'L-upper': { px: [18, 1612, 25, 940], ft: [0, 56.13, 27.67, 60] }, // second-floor outside walls
  'L-lower': { px: [62, 872, 60, 1135], ft: [29.8, 56.13, 27.67, 60] }, // basement outside walls (east block only)
};

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const io = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const span = (s, a, b) => clamp01((s - a) / (b - a));
const fade = (s, a, b, f = 0.012) => clamp01((s - a) / f) * (1 - clamp01((s - b) / f));
function track(keys) {
  return (s) => {
    if (s <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (s <= keys[i][0]) {
      const t = (s - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
      return lerp(keys[i - 1][1], keys[i][1], io(t));
    }
    return keys[keys.length - 1][1];
  };
}

// ---- the story ------------------------------------------------------------------------
const LEVELS = [
  { at: [0.16, 0.22], t: 'Roof', d: 'Standing-seam gables, a full-width porch roof' },
  { at: [0.25, 0.32], t: 'Upper level', d: 'Four bedrooms · two baths · game room' },
  { at: [0.35, 0.43], t: 'Main level', d: 'Entry · great room · dining & kitchen · bedroom suite' },
  { at: [0.46, 0.53], t: 'Lower level', d: 'Walk-out family room · laundry · half bath' },
];
const CAPS = [
  { at: [0.012, 0.1], no: 'Clayborn', head: 'See what your home could become.', sub: 'A lake house on a long lot running down to the water, designed and engineered by Clayborn.' },
  { at: [0.16, 0.22], no: 'The plans', head: 'Designed from the roof down.', sub: 'Every level drawn together, so the house works as one.' },
  { at: [0.25, 0.32], no: 'The plans', head: 'Room to grow.', sub: 'Bedrooms and a game room tucked under the gables.' },
  { at: [0.35, 0.43], no: 'The plans', head: 'Plan spaces around the way you live.', sub: 'Great room, dining and kitchen open to one another and to the lakeside deck.' },
  { at: [0.46, 0.53], no: 'The plans', head: 'Discover the possibilities below.', sub: 'A walk-out lower level that opens straight onto the patio.' },
  { at: [0.595, 0.665], no: 'Lake side', head: 'Built for the view.', sub: 'A covered porch across the whole house, and a walk-out below it.' },
  { at: [0.695, 0.755], no: 'East side', head: 'Every elevation, resolved.', sub: 'The garage tucks in beside the house, the drive running in from the street.' },
  { at: [0.785, 0.845], no: 'Street side', head: 'A quiet arrival.', sub: 'A covered entry between the garage and the bedroom wing.' },
  { at: [0.875, 0.915], no: 'West side', head: 'Clean lines, honest materials.', sub: 'Board-and-batten siding, a stone base and standing-seam roofs.' },
];
// the walk round the outside: [element, in-start, in-end, out-start, out-end, pan]
const ELEVS = [
  ['E-rear', 0.555, 0.59, 0.67, 0.69, (t) => ({ pos: `50% ${lerp(88, 22, t)}%`, sc: lerp(1.04, 1.0, t) })], // from the patio up to the gables
  ['E-east', 0.67, 0.69, 0.76, 0.78, (t) => ({ pos: `${lerp(0, 100, t)}% 50%`, sc: 1.0 })], // porch to garage: towards the street
  ['E-front', 0.76, 0.78, 0.85, 0.87, (t) => ({ pos: `50% 45%`, sc: lerp(1.0, 1.07, t) })],
  ['E-west', 0.85, 0.87, 0.92, 0.94, (t) => ({ pos: `${lerp(0, 100, t)}% 50%`, sc: 1.0 })], // garage end to the porch: back towards the lake
  ['E-close', 0.92, 0.945, 2, 2, (t) => ({ pos: `50% ${lerp(30, 42, t)}%`, sc: lerp(1.1, 1.0, t) })], // the lake side again, for the close
];

// ---- set up ----------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const plan = $('plan');
const layers = Object.fromEntries(Object.keys(REF).map((id) => [id, $(id)]));
const capsEl = $('caps');
capsEl.innerHTML = CAPS.map((c) => `<section class="cap"><p class="no">${c.no}</p><h2>${c.head}</h2><p class="sub">${c.sub}</p></section>`).join('');
const caps = [...capsEl.children];
const level = $('level'), lvT = level.querySelector('.lv-t'), lvD = level.querySelector('.lv-d');
const elevEls = ELEVS.map((e) => ({ el: $(e[0]), img: $(e[0]).querySelector('img') }));

function place() {
  for (const [id, r] of Object.entries(REF)) {
    const img = layers[id];
    const [x0, x1, y0, y1] = r.px, [u0, u1, v0, v1] = r.ft;
    const sx = (u1 - u0) / (x1 - x0), sy = (v1 - v0) / (y1 - y0);
    Object.assign(img.style, {
      left: (u0 - x0 * sx) * U + 'px', top: (v0 - y0 * sy) * U + 'px',
      width: img.naturalWidth * sx * U + 'px', height: img.naturalHeight * sy * U + 'px',
    });
  }
}

// the camera over the plan stack: centre (u, v) and the height of the view, all in feet
let cam;
function makeCam() {
  const a = innerWidth / innerHeight;
  // the aerial is 238 ft wide: fit its width, start at the lake end, climb the lawn to the house
  const Hw = Math.min(410, 238 / a);
  const Hl = Math.max(58, 32 / a); // the lower level (east block)
  const Hh = Math.max(104, 70 / a); // the house with its deck and stair, with room round it
  const off = a > 1.2 ? 0.07 * Hh * a : 0; // on a wide screen the house sits right of centre, clear of the captions
  const offL = a > 1.2 ? 0.07 * Hl * a : 0;
  cam = {
    u: track([[0, 27], [0.11, 27], [0.16, 28 - off], [0.43, 28 - off], [0.46, 43 - offL], [0.53, 43 - offL], [0.58, 34]]),
    v: track([[0, 368 - Hw / 2], [0.03, 368 - Hw / 2], [0.11, 46], [0.16, 39], [0.43, 39], [0.46, 47], [0.53, 47], [0.58, 40]]),
    H: track([[0, Hw], [0.11, Hw], [0.16, Hh], [0.43, Hh], [0.46, Hl], [0.53, Hl], [0.58, Hh * 1.5]]),
  };
}

// one plan layer handing over to the next: the old one lifts off and fades
function handover(s, a, b) { return io(span(s, a, b)); }

function draw(s) {
  // camera
  const k = innerHeight / (cam.H(s) * U);
  plan.style.transform = `translate(${innerWidth / 2 - cam.u(s) * U * k}px, ${innerHeight / 2 - cam.v(s) * U * k}px) scale(${k})`;
  // the plan stack
  const roofIn = handover(s, 0.115, 0.155), roofOut = handover(s, 0.22, 0.25);
  const upIn = handover(s, 0.22, 0.25), upOut = handover(s, 0.32, 0.35);
  const mainIn = handover(s, 0.32, 0.35), mainOut = handover(s, 0.43, 0.46);
  const lowIn = handover(s, 0.43, 0.46);
  const set = (id, o, lift = 0) => { const el = layers[id]; el.style.opacity = o; el.style.transform = `scale(${1 + lift * 0.05})`; el.style.visibility = o > 0.001 ? 'visible' : 'hidden'; };
  set('L-roof', roofIn * (1 - roofOut), roofOut);
  set('L-upper', upIn * (1 - upOut), upOut);
  set('L-main', mainIn * (1 - mainOut * 0.72)); // stays faintly under the lower level, for context
  set('L-lower', lowIn);
  set('L-site', 1);
  $('dim').style.opacity = io(span(s, 0.53, 0.565));
  // the walk round the outside
  ELEVS.forEach((e, i) => {
    const [, a0, a1, b0, b1, pan] = e;
    const { el, img } = elevEls[i];
    const vis = s > a0 && s < b1;
    el.style.visibility = vis ? 'visible' : 'hidden';
    if (!vis) return;
    const pin = span(s, a0, a1), pout = span(s, b0, b1);
    const first = i === 0 || i === ELEVS.length - 1;
    // turning the corner: the façade we leave swings away left, the next swings in from the right
    // walking round a corner: the next façade swings in from the right and pushes the last one off to the left
    const lastOut = i === ELEVS.length - 2; // the west side hands over to the close with a dissolve
    const pushIn = !first, pushOut = !lastOut && i < ELEVS.length - 1;
    const dx = (pushIn ? (1 - io(pin)) * 100 : 0) - (pushOut ? io(pout) * 100 : 0);
    const rot = (pushIn ? (1 - io(pin)) * -28 : 0) + (pushOut ? io(pout) * 28 : 0);
    el.style.opacity = (pushIn ? 1 : io(pin)) * (pushOut ? 1 : 1 - io(pout));
    el.style.zIndex = i;
    el.style.transform = `translateX(${dx}%) rotateY(${rot}deg)`;
    const p = pan(span(s, a0, b1 < 2 ? b1 : 1));
    img.style.objectPosition = p.pos;
    img.style.transform = `scale(${p.sc})`;
  });
  // words
  caps.forEach((el, i) => {
    const f = fade(s, ...CAPS[i].at);
    el.style.opacity = f;
    el.style.transform = `translateY(${(1 - f) * 18}px)`;
    el.style.visibility = f > 0.001 ? 'visible' : 'hidden';
  });
  let lv = null, lf = 0;
  for (const L of LEVELS) { const f = fade(s, ...L.at); if (f > lf) { lf = f; lv = L; } }
  if (lv) { lvT.textContent = lv.t; lvD.textContent = lv.d; }
  level.style.opacity = lf;
  const close = io(span(s, 0.945, 0.97));
  $('close').style.opacity = close;
  $('close').style.visibility = close > 0.001 ? 'visible' : 'hidden';
  $('progress').firstElementChild.style.transform = `scaleX(${s})`;
  $('cue').style.opacity = 1 - clamp01(s / 0.02);
}

// ---- run -----------------------------------------------------------------------------------
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
// ?capture=1, or #capture (some servers drop the query string when they tidy the URL)
const CAPTURE = new URLSearchParams(location.search).has('capture') || location.hash === '#capture';

async function boot() {
  await Promise.all([...document.images].map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
  await document.fonts.ready;
  place();
  makeCam();
  let s = 0, target = 0;
  draw(0);
  addEventListener('resize', () => { makeCam(); draw(s); });
  if (CAPTURE) {
    document.documentElement.style.overflow = 'hidden';
    window.__frame = (v) => new Promise((res) => { s = v; draw(s); requestAnimationFrame(() => requestAnimationFrame(() => res(true))); });
  } else {
    const read = () => { const max = document.documentElement.scrollHeight - innerHeight; target = max > 0 ? scrollY / max : 0; };
    addEventListener('scroll', read, { passive: true });
    read();
    (function tick() { s += (target - s) * 0.09; if (Math.abs(target - s) < 1e-5) s = target; draw(s); requestAnimationFrame(tick); })();
  }
  window.__state = () => ({ errors, calls: 0, tris: 0 });
  window.__ready = true;
}
boot().catch((e) => { errors.push(String(e)); console.error(e); });
