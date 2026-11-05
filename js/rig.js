// The camera path, as a function of scroll progress s (0 to 1).
//
// One perspective camera does the whole page. On the sheet it hangs far above
// the house with a 2-degree lens, which flattens perspective until the model
// reads as a drawing. Coming down, the lens opens and the distance shrinks
// together (a dolly zoom), so the framing never jumps.
//
//   1  the sheet        0.00 - 0.05
//   2  the cut rises    0.05 - 0.30   walls grow, camera tips back
//   3  coming down      0.30 - 0.50   roofs close, camera lands in the yard
//   4  the deck         0.50 - 0.70   up nine steps
//   5  entry / foyer    0.70 - 0.79
//   6  great room       0.77 - 0.88
//   7  dining, kitchen  0.88 - 1.00

import { FT, CUT_PLAN, CEIL, LAWN, DECK, DECKS } from './plan.js';

const io = (t) => t * t * (3 - 2 * t);
const io5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lin = (t) => t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const rad = Math.PI / 180;
const L = Math.log, T = (deg) => Math.tan((deg * rad) / 2);

// keys: [s, value, ease into this key]
function track(keys) {
  return (s) => {
    if (s <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (s <= keys[i][0]) {
        const t = (s - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
        return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * (keys[i][2] ?? lin)(t);
      }
    }
    return keys[keys.length - 1][1];
  };
}

// Smooth curve through keys that never overshoots (monotone cubic Hermite).
// Used for walking so the pace never stops dead and never swings past a key.
export function glide(keys) {
  const n = keys.length;
  const xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (s) => {
    if (s <= xs[0]) return ys[0];
    if (s >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (s > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (s - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

export const STOPS = { sheetEnd: 0.05, liftEnd: 0.3, landed: 0.5 };

// Height of whatever the visitor is standing on, in feet.
function groundAt(X, N) {
  const S = DECKS.stair;
  const bottom = S.top - (S.risers - 1) * S.run;
  if (N < bottom) return LAWN;
  if (N < S.top) return LAWN + (DECK - LAWN) * io((N - bottom) / (S.top - bottom));
  if (N < 4.2) return DECK;
  if (N < 6.2) return DECK + (0 - DECK) * io((N - 4.2) / 2);
  return 0;
}

const EYE = 5.2; // ft

export function makeRig(aspect) {
  const portrait = aspect < 0.9;
  const fovWalk = portrait ? 74 : aspect < 1.5 ? 60 : 54;

  // the sheet: a frame F0 metres tall. On a wide screen the plan sits right of
  // centre so the headline has room on the left; on a phone it sits low.
  const planW = 76 * FT, planH = 96 * FT; // drawing incl. dimensions and title
  const planCx = 29 * FT, planCn = 13.5 * FT;
  const F0 = portrait ? (planW / aspect) * 1.12 : Math.max(planH * 1.08, (planW / aspect) * 1.9);
  const cx = portrait ? planCx : planCx - 0.16 * F0 * aspect;
  const cn = portrait ? planCn + 0.2 * F0 : planCn;

  // landing in the yard, in front of the deck stair, looking north
  const landX = 23.45 * FT, landN = -34 * FT;
  const landY = (LAWN + EYE) * FT;
  const REST = 15; // m from camera to the point it looks at when it lands
  const landFrame = 2 * REST * T(fovWalk);
  const { sheetEnd: s1, liftEnd: s2, landed: s3 } = STOPS;

  // ---- stops 1-3: framed from above ---------------------------------------------
  const early = (t) => 0.5 * io(t) + 0.5 * (1 - (1 - t) * (1 - t));
  const elev = track([[0, 90], [s1, 90], [s2, 34, early], [s3, 0, io]]);
  const fovL = track([[0, L(T(2))], [s1, L(T(2))], [s2, L(T(4.8)), io], [s3, L(T(fovWalk)), io5]]);
  const frmL = track([[0, L(F0)], [s1, L(F0)], [s2, L(portrait ? 30 : 23), io], [s3, L(landFrame), io5]]);
  const tx = track([[0, cx], [s1, cx], [s2, 28 * FT, io], [s3, landX, io]]);
  const ty = track([[0, 0], [s1, 0], [s2, 1.0, io], [s3, landY, io]]);
  const tz = track([[0, -cn], [s1, -cn], [s2, -13 * FT, io], [s3, -landN * 1 - REST, io]]);
  // the cut: walls first, then the roofs close in the last stretch of the descent
  const cut = track([[0, CUT_PLAN * FT], [s1 + 0.01, CUT_PLAN * FT], [s2, (CEIL - 0.35) * FT, io], [0.4, (CEIL - 0.3) * FT, lin], [0.47, 60, io]]);
  const fogN = track([[0, L(4000)], [s2, L(4000)], [s3, L(40), io]]);
  const fogF = track([[0, L(9000)], [s2, L(9000)], [s3, L(160), io]]);

  // ---- stops 4-7: on foot. [s, X ft, N ft, yaw deg (+ = turn left / west), pitch deg]
  const W = [
    [s3, 23.45, -34, 0, 0],
    [0.555, 23.45, -23.5, 0, 4],
    [0.62, 23.45, -12.4, 0, 0],
    [0.675, 23.45, -3.0, 0, -2],
    [0.735, 23.3, 7.4, 8, -3],
    [0.775, 21.0, 8.1, 72, -4],
    [0.815, 14.6, 8.3, 104, -6],
    [0.85, 11.8, 9.6, 142, -8],
    [0.875, 13.6, 8.1, 232, -5],
    [0.9, 19.4, 7.9, 262, -5],
    [0.93, 27.0, 7.9, 266, -5],
    [0.96, 33.6, 8.3, 268, -7],
    [1.0, 37.6, 8.7, 256, -9],
  ];
  const px = glide(W.map((k) => [k[0], k[1]]));
  const pn = glide(W.map((k) => [k[0], k[2]]));
  const pyaw = glide(W.map((k) => [k[0], k[3]]));
  const ppitch = glide(W.map((k) => [k[0], k[4]]));

  function at(sIn) {
    const s = clamp01(sIn);
    const o = { s };
    o.cut = cut(s);
    o.fogNear = Math.exp(fogN(s));
    o.fogFar = Math.exp(fogF(s));
    if (s <= s3) {
      const e = elev(s) * rad;
      const tanHalf = Math.exp(fovL(s));
      const dist = Math.exp(frmL(s)) / (2 * tanHalf);
      o.fov = (2 * Math.atan(tanHalf)) / rad;
      o.pitch = -e;
      o.yaw = 0;
      o.x = tx(s);
      o.y = ty(s) + dist * Math.sin(e);
      o.z = tz(s) + dist * Math.cos(e);
      o.dist = dist;
    } else {
      const X = px(s), N = pn(s);
      o.fov = fovWalk;
      o.yaw = pyaw(s) * rad;
      o.pitch = ppitch(s) * rad;
      o.x = X * FT;
      o.z = -N * FT;
      o.y = (groundAt(X, N) + EYE) * FT;
      o.dist = REST;
    }
    // reveals: the yard and deck first, then each room as the camera reaches it
    o.out = clamp01((s - 0.44) / 0.2);
    o.foyer = clamp01((s - 0.69) / 0.075);
    o.great = clamp01((s - 0.765) / 0.065);
    o.kitchen = clamp01((s - 0.885) / 0.07);
    o.sky = clamp01((s - 0.4) / 0.12);
    // keep the depth buffer tight: from far above, everything sits in a thin slab
    o.near = o.y > 60 ? Math.max(0.1, o.dist - 70) : 0.05;
    o.far = o.y > 60 ? o.dist + 90 : 600;
    return o;
  }

  return { at, portrait, fovWalk };
}
