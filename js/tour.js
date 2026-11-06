// The Clayborn presentation: the default way the page plays.
//
//   1  the sheet         Clayborn's title block and the main floor plan, as printed
//   2  into the plans    zoom in; the lower, main and upper levels in turn; back to main
//   3  plan to house     the cut opens, the house stands up, the camera comes down
//                        to the street side and the front door
//   4  front door        straight through the foyer to the lake
//   5  main level        great room, then dining and kitchen
//   6  upstairs          up the stair to a lake-view bedroom
//   7  downstairs        down to the walk-out lower level and out onto the patio
//   8  outside           a sweep round all four elevations, ending on the lake
//   9  close             Clayborn, and a next step
//
// Everything is a function of one scroll value s (0 to 1).

import { FT, CUT_PLAN, CEIL, F2, DECK, BASE_FLOOR } from './plan.js';
import { glide } from './rig.js';

const io = (t) => t * t * (3 - 2 * t);
const io5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lin = (t) => t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const rad = Math.PI / 180;
const L = Math.log, T = (deg) => Math.tan((deg * rad) / 2);
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
const span = (s, a, b) => clamp01((s - a) / (b - a));
const window_ = (s, a, b, f = 0.008) => span(s, a - f, a) * (1 - span(s, b, b + f));

export const EYE = 5.2;
const B = BASE_FLOOR;

// ---- the stops, in scroll order ------------------------------------------------------
export const T_ = {
  sheet: 0.035, zoomed: 0.085,
  lower: [0.09, 0.114], main1: [0.117, 0.138], upper: [0.141, 0.163], main2: [0.166, 0.19],
  stand: 0.27, arrive: 0.3, orbit: 0.78, end: 0.955,
  dips: [[0.552, 0.566, 0.58], [0.644, 0.656, 0.67]], // [fade out, cut, fade in] between floors
};

// The sheet the plan is printed on, in plan feet: a 36" x 24" sheet with the drawing area
// centred on the plan and Clayborn's title block down the right-hand side.
export const SHEET = { X0: -46, X1: 115, N0: -40, N1: 66, block: 96.0 };

// On foot: [s, X ft, N ft, yaw deg (0 north, + turns left), pitch deg, floor height ft under the camera]
// Between floors the picture dips to paper and comes up on the next level (T_.dips), so
// no time is spent in stair corridors.
const WALK = [
  [0.3, 25.4, 35.6, 174, -3, -0.3], // the street side, just inside the gate
  [0.322, 24.0, 29.6, 177, -2, DECK],
  [0.342, 23.2, 23.6, 180, -1, DECK], // at the front door
  [0.362, 23.2, 16.8, 180, -2, 0], // in: straight through the house to the lake ...
  [0.374, 23.25, 12.6, 250, 1, 0], // ... then turn round as the front door swings shut
  [0.386, 23.25, 7.6, 360, -3, 0], // the entry, from the back of the foyer: door and sidelights,
  [0.398, 23.25, 7.2, 360, -3, 0], //   chandelier, bench and mirror, console and painting
  [0.412, 23.3, 7.8, 205, -3, 0], // and back round to the lake
  [0.424, 21.0, 9.8, 128, -4, 0], // turn towards the great room
  [0.438, 13.6, 11.0, 140, -6, 0], // through the framed opening, clear of the lamp
  [0.452, 9.2, 11.6, 180, -8, 0], // over the sofa to the lake, centred between the lamps
  [0.474, 13.6, 8.8, 268, -5, 0], // round to the east
  [0.492, 21.0, 8.2, 268, -4, 0], // back across the foyer
  [0.506, 30.6, 9.8, 250, -5, 0], // into the dining room
  [0.518, 41.6, 12.9, 156, -9, 0], // the dining room, from the corner by the kitchen: chandeliers, table, the lake beyond
  [0.528, 41.9, 12.7, 160, -9, 0],
  [0.536, 44.3, 9.6, 250, -6, 0], // round the host chair ...
  [0.544, 43.4, 1.1, 323, -9, 0], // ... to the kitchen: island, lanterns, range and hood, the sink window
  [0.552, 43.45, 0.95, 325, -9, 0],
  [0.5655, 43.5, 0.9, 326, -9, 0], // (dip to the upper level: the cut happens while the screen is blank)
  [0.5665, 54.3, 9.4, 120, -17, F2], // upstairs: bedroom-04, from its far corner: the bed in front,
  [0.6, 54.4, 9.6, 131, -17, F2], //   the big south window and the lake beyond it
  [0.64, 54.5, 9.8, 141, -16, F2],
  [0.652, 54.5, 9.8, 144, -16, F2], // (dip to the lower level)
  [0.6555, 54.5, 9.8, 144, -16, F2],
  [0.6565, 44.6, 21.0, 178, -9, B],
  [0.668, 44.6, 20.8, 180, -9, B], // the lower level: over the sectional, out through the walk-out to the lake
  [0.69, 44.0, 20.2, 186, -8, B],
  [0.712, 41.0, 13.0, 222, -6, B], // round past the sectional towards the daybed
  [0.732, 42.4, 6.0, 196, -3, B],
  [0.75, 41.6, 0.6, 196, 0, B], // out through the slider ...
  [0.764, 42.6, -9.0, 205, 1, B], // ... onto the patio under the deck, looking down the lawn away from the low sun ...
  [0.78, 45.5, -24.0, 32, 2, B], // ... out onto the lawn, turning back to face the house
];

export const COPY = [
  { at: [0.04, 0.085], no: 'Clayborn', head: 'See what your home could become.', sub: 'Every Clayborn drawing is a house you can already walk through.' },
  { at: [0.196, 0.27], no: 'From plan to place', head: 'Three levels, engineered as one.', sub: 'Lower, main and upper floors, drawn together and built to fit.' },
  { at: [0.344, 0.37], no: 'Arrival', head: 'Through the front door, straight to the lake.', sub: 'The entry lines up with the view, so the house opens the moment you step in.' },
  { at: [0.442, 0.553], no: 'Main level', head: 'Plan spaces around the way you live.', sub: 'Great room, dining and kitchen open to one another, and to the water.' },
  { at: [0.572, 0.648], side: 'right', no: 'Upper level', head: 'Room to grow, upstairs.', sub: 'Four bedrooms and a game room under the gables, with the lake in view.' },
  { at: [0.664, 0.772], no: 'Lower level', head: 'Discover the possibilities below.', sub: 'A walk-out lower level that opens straight onto the lakeside patio.' },
  { at: [0.79, 0.95], no: 'Outside', head: 'Every elevation, resolved.', sub: 'Clayborn designs and engineers the whole house, inside and out.' },
];

export const LEVELS = [
  { at: T_.lower, t: 'Lower level', d: 'Walk-out basement · mechanical, laundry, half bath, open space' },
  { at: T_.main1, t: 'Main level', d: 'Entry, great room, dining & kitchen, bedroom suite' },
  { at: T_.upper, t: 'Upper level', d: 'Four bedrooms, two baths, game room' },
  { at: T_.main2, t: 'Main level', d: 'Where the tour begins' },
];

export function makeTourRig(aspect) {
  const portrait = aspect < 0.9;
  const fovWalk = portrait ? 74 : aspect < 1.5 ? 60 : 54;

  // ---- 1-2: overhead framings (frame = height of the view at the plan, in metres) ----
  const sheetW = (SHEET.X1 - SHEET.X0) * FT, sheetH = (SHEET.N1 - SHEET.N0) * FT;
  const fSheet = Math.max(sheetH * 1.14, (sheetW * 1.06) / aspect);
  const fPlan = portrait ? (78 * FT) / aspect * 1.05 : Math.max(76 * FT, (84 * FT) / aspect);
  const sheetCx = ((SHEET.X0 + SHEET.X1) / 2) * FT, sheetCn = ((SHEET.N0 + SHEET.N1) / 2) * FT;
  const planCx = 27 * FT, planCn = 13 * FT;

  // ---- 3: from overhead to the street side ---------------------------------------
  const REST = 15;
  const landFrame = 2 * REST * T(fovWalk);
  const w0 = WALK[0];
  const yaw0 = w0[3] * rad, pit0 = w0[4] * rad;
  const f0 = [-Math.sin(yaw0) * Math.cos(pit0), Math.sin(pit0), -Math.cos(yaw0) * Math.cos(pit0)];
  const cam0 = [w0[1] * FT, (w0[5] + EYE) * FT, -w0[2] * FT];
  const tgt0 = cam0.map((c, i) => c + f0[i] * REST);

  const { zoomed, main2, stand, arrive } = T_;
  const z1 = T_.sheet, z2 = zoomed, d0 = main2[1];
  const oFrm = track([[0, L(fSheet)], [z1, L(fSheet)], [z2, L(fPlan), io], [d0, L(fPlan)], [stand, L(36 * FT), io], [arrive, L(landFrame), io5]]);
  const oFov = track([[0, L(T(2))], [d0, L(T(2))], [stand, L(T(7)), io], [arrive, L(T(fovWalk)), io5]]);
  const oPitch = track([[0, -89.9], [d0, -89.9], [stand, -40, io], [arrive, w0[4], io]]);
  const oYaw = track([[0, 0], [d0, 0], [arrive, w0[3], io]]);
  const otx = track([[0, sheetCx], [z1, sheetCx], [z2, planCx, io], [d0, planCx], [stand, 25 * FT, io], [arrive, tgt0[0], io]]);
  const oty = track([[0, 0], [d0, 0], [stand, 6 * FT, io], [arrive, tgt0[1], io]]);
  const otz = track([[0, -sheetCn], [z1, -sheetCn], [z2, -planCn, io], [d0, -planCn], [stand, -20 * FT, io], [arrive, tgt0[2], io]]);

  // the cut: the main plan, then the lower, main, upper and main again, then open
  const LOW = (B + CUT_PLAN) * FT, MAIN = CUT_PLAN * FT, UP = (F2 + CUT_PLAN) * FT;
  const cut = track([
    [0, MAIN], [T_.lower[0] - 0.0006, MAIN], [T_.lower[0], LOW], [T_.lower[1] + 0.002, LOW], [T_.lower[1] + 0.0026, MAIN],
    [T_.main1[1] + 0.002, MAIN], [T_.main1[1] + 0.0026, UP], [T_.upper[1] + 0.002, UP], [T_.upper[1] + 0.0026, MAIN], [main2[1], MAIN],
    [0.25, (CEIL - 0.3) * FT, io], [0.268, 60, io],
  ]);

  // ---- 4-7: on foot --------------------------------------------------------------
  const px = glide(WALK.map((k) => [k[0], k[1]]));
  const pn = glide(WALK.map((k) => [k[0], k[2]]));
  const pyaw = glide(WALK.map((k) => [k[0], k[3]]));
  const ppitch = glide(WALK.map((k) => [k[0], k[4]]));
  const ph = glide(WALK.map((k) => [k[0], k[5]]));

  // ---- 8: round the house -------------------------------------------------------
  // phi = where the camera stands around the house: 0 south, 90 east, 180 north, 270 west.
  // It starts from the patio (south-east), runs quickly past the street side, slows
  // along the west and settles on the lake.
  const C = [27, 14]; // the house's centre, ft
  const last = WALK[WALK.length - 1];
  const r0 = Math.hypot(last[1] - C[0], last[2] - C[1]), phi0 = Math.atan2(last[1] - C[0], C[1] - last[2]) / rad;
  const { orbit, end } = T_;
  const oPhi = track([[orbit, phi0], [0.815, 92, io], [0.85, 196, lin], [0.9, 300, lin], [end, 378, io]]);
  const oR = track([[orbit, r0], [0.815, 92, io], [0.9, 98, lin], [end, 84, io]]);
  const oH = track([[orbit, last[5] + EYE], [0.795, last[5] + EYE + 1.0, io], [0.82, 13, io], [0.88, 15, lin], [end, 4, io]]); // camera height, ft
  const oLookH = track([[orbit, last[5] + EYE + 2], [0.815, 13, io], [end, 9.5, io]]);
  const oFovX = track([[orbit, fovWalk], [0.815, 44, io], [end, 40, io]]);

  function at(sIn) {
    const s = clamp01(sIn);
    const o = { s };
    o.cut = cut(s);
    o.cutLow = s > T_.main1[1] + 0.002 && s < T_.upper[1] + 0.0026 ? 60 : o.cut;
    if (s <= arrive) {
      const yaw = oYaw(s) * rad, pitch = oPitch(s) * rad;
      const tanHalf = Math.exp(oFov(s));
      const dist = Math.exp(oFrm(s)) / (2 * tanHalf);
      const fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
      o.fov = (2 * Math.atan(tanHalf)) / rad;
      o.yaw = yaw;
      o.pitch = pitch;
      o.x = otx(s) - fx * dist;
      o.y = oty(s) - fy * dist;
      o.z = otz(s) - fz * dist;
      o.dist = dist;
      o.frame = Math.exp(oFrm(s));
    } else if (s <= orbit) {
      const X = px(s), N = pn(s);
      o.fov = fovWalk;
      o.yaw = pyaw(s) * rad;
      o.pitch = ppitch(s) * rad;
      o.x = X * FT;
      o.z = -N * FT;
      o.y = (ph(s) + EYE) * FT;
      o.dist = REST;
    } else {
      const phi = oPhi(s) * rad, R = oR(s);
      const X = C[0] + R * Math.sin(phi), N = C[1] - R * Math.cos(phi);
      const h = oH(s);
      const dX = C[0] - X, dN = C[1] - N;
      o.x = X * FT;
      o.z = -N * FT;
      o.y = h * FT;
      o.yaw = Math.atan2(-dX, dN);
      o.pitch = Math.atan2(oLookH(s) - h, Math.hypot(dX, dN));
      o.fov = oFovX(s);
      o.dist = R * FT;
    }
    // reveals
    // the house finishes as it stands up: by the time the camera arrives every room is done
    o.out = span(s, 0.2, 0.275);
    o.foyer = o.great = o.kitchen = o.upper = o.lower = span(s, 0.235, 0.29);
    o.sky = span(s, 0.2, 0.3);
    o.fogNear = s < 0.2 ? 4000 : s < arrive ? 4000 - 3700 * io(span(s, 0.2, arrive)) : 300;
    o.fogFar = s < 0.2 ? 9000 : s < arrive ? 9000 - 6500 * io(span(s, 0.2, arrive)) : 2500;
    o.near = o.dist > 60 ? Math.max(0.1, o.dist - 70) : 0.05;
    o.far = o.dist > 60 ? o.dist + 90 : 900;
    // drafting layers and overlays
    o.elev = 0;
    o.roofLab = 0;
    o.upLab = window_(s, T_.upper[0], T_.upper[1], 0.004);
    o.lowLab = window_(s, T_.lower[0], T_.lower[1], 0.004);
    o.planLab = 1 - span(s, 0.2, 0.25);
    o.sheet = 1 - span(s, z1 + 0.002, z1 + 0.018); // the printed sheet and title block fade early in the zoom
    o.end = span(s, 0.972, 0.99); // the close comes in after the lake-side view has settled
    // a touch more exposure indoors, so the rooms read bright and airy
    o.exposure = 1.05 + 0.3 * span(s, 0.33, 0.36) * (1 - span(s, 0.766, 0.79));
    o.doorAngle = 268 - 88 * io(span(s, 0.364, 0.38)); // the front door closes behind you
    o.dip = 0;
    for (const [a, m, b] of T_.dips) o.dip = Math.max(o.dip, s < m ? span(s, a, m - 0.003) : 1 - span(s, m + 0.003, b));
    return o;
  }
  return { at, portrait, fovWalk };
}
