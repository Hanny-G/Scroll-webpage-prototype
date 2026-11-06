// The building, made of boxes.
//
// Every solid is a closed box. Seen through the cut, a box shows its own
// inside faces, and the ink shader paints those black: that is the poché of
// the plan. Boxes that share a material are merged into one mesh, and every
// box also contributes its outline to one set of ink lines.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { groundH, WALL_X } from './terrain.js';
import {
  FT, WALLS, WALLS_UP, WALLS_UP_INT, WALLS_BASE, WELLS, BASE_FLOOR, BASE_CEIL, ROOFS, CEIL, F2, EAVE, LAWN, DECK, DOOR_H, SILL, OPEN_H, SWINGS, BARN, RISE, DECKS,
  RAIL_POSTS, PORCH_POSTS, TREES, HOUSE,
} from './plan.js';

export function buildHouse(M) {
  const geos = {}; // material key -> geometries
  const edges = []; // flat positions for ink lines
  const cables = []; // deck cable rails: stay as thin dark lines
  const group = new THREE.Group();

  const put = (key, g) => (geos[key] ??= []).push(g.index ? g.toNonIndexed() : g);
  const treeEdges = [];
  const addEdges = (g, angle = 20) => {
    const e = new THREE.EdgesGeometry(g, angle);
    const p = e.attributes.position.array;
    for (let i = 0; i < p.length; i++) edges.push(p[i]);
    e.dispose();
  };

  // a box in plan feet: X0..X1 (east), N0..N1 (north), y0..y1 (up)
  function box(key, X0, N0, X1, N1, y0, y1, { lines = true } = {}) {
    const w = Math.abs(X1 - X0) * FT, d = Math.abs(N1 - N0) * FT, h = Math.abs(y1 - y0) * FT;
    if (w < 1e-4 || d < 1e-4 || h < 1e-4) return;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(((X0 + X1) / 2) * FT, ((y0 + y1) / 2) * FT, (-(N0 + N1) / 2) * FT);
    put(key, g);
    if (lines) addEdges(g);
  }
  // a box rotated about its vertical axis (deg, 0 = long side east-west)
  function rbox(key, X, N, w, d, y0, y1, deg = 0, { lines = true } = {}) {
    const g = new THREE.BoxGeometry(w * FT, (y1 - y0) * FT, d * FT);
    g.rotateY((deg * Math.PI) / 180);
    g.translate(X * FT, ((y0 + y1) / 2) * FT, -N * FT);
    put(key, g);
    if (lines) addEdges(g);
  }
  // a soft-edged box (cushions, mattresses, upholstery). The ink outline is the plain box.
  function soft(key, X0, N0, X1, N1, y0, y1, r = 0.18, { lines = true, deg = 0, cx, cn } = {}) {
    const w = Math.abs(X1 - X0), d = Math.abs(N1 - N0), h = Math.abs(y1 - y0);
    if (w < 1e-3 || d < 1e-3 || h < 1e-3) return;
    const rr = Math.min(r, w / 2 - 0.01, d / 2 - 0.01, h / 2 - 0.01);
    const g = new RoundedBoxGeometry(w * FT, h * FT, d * FT, 3, Math.max(0.005, rr * FT));
    const outline = new THREE.BoxGeometry(w * FT, h * FT, d * FT);
    const mx = (X0 + X1) / 2, mn = (N0 + N1) / 2;
    for (const geo of [g, outline]) {
      if (deg) {
        // rotate about a pivot (cx, cn) in plan feet
        geo.translate((mx - cx) * FT, 0, -(mn - cn) * FT);
        geo.rotateY((deg * Math.PI) / 180);
        geo.translate(cx * FT, ((y0 + y1) / 2) * FT, -cn * FT);
      } else geo.translate(mx * FT, ((y0 + y1) / 2) * FT, -mn * FT);
    }
    put(key, g);
    if (lines) addEdges(outline);
    outline.dispose();
  }
  // rectangles minus holes: [X0, N0, X1, N1] cut into pieces around each hole
  function minus(rect, holes) {
    const xs = [rect[0], rect[2]], ns = [rect[1], rect[3]];
    for (const h of holes) {
      for (const x of [h[0], h[2]]) if (x > rect[0] && x < rect[2]) xs.push(x);
      for (const n of [h[1], h[3]]) if (n > rect[1] && n < rect[3]) ns.push(n);
    }
    xs.sort((a, b) => a - b); ns.sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ns.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cn = (ns[j] + ns[j + 1]) / 2;
      if (holes.some((h) => cx > h[0] && cx < h[2] && cn > h[1] && cn < h[3])) continue;
      out.push([xs[i], ns[j], xs[i + 1], ns[j + 1]]);
    }
    return out;
  }
  const slabs = (key, rect, holes, y0, y1) => { for (const r of minus(rect, holes)) box(key, r[0], r[1], r[2], r[3], y0, y1, { lines: false }); };

  function cyl(key, X, N, r0, r1, y0, y1, seg = 24, { lines = true } = {}) {
    const g = new THREE.CylinderGeometry(r1 * FT, r0 * FT, (y1 - y0) * FT, seg);
    g.translate(X * FT, ((y0 + y1) / 2) * FT, -N * FT);
    put(key, g);
    if (lines) addEdges(g, 30);
  }

  // ---- walls -----------------------------------------------------------------
  for (const w of [...WALLS, ...WALLS_UP, ...WALLS_BASE]) {
    const Y0 = w.y0 ?? 0, Y1 = w.y1 ?? CEIL + 0.06; // main walls meet the floor band above with no gap
    const seg = (a, b, y0, y1, key = w.t > 1 ? 'basewall' : 'wall') => {
      if (b - a < 1e-3) return;
      if (w.ax === 'x') box(key, a, w.c - w.t / 2, b, w.c + w.t / 2, Y0 + y0, Math.min(Y1, Y0 + y1));
      else box(key, w.c - w.t / 2, a, w.c + w.t / 2, b, Y0 + y0, Math.min(Y1, Y0 + y1));
    };
    const top = Y1 - Y0;
    const ops = [...w.ops].sort((p, q) => p.a - q.a);
    let at = w.a;
    for (const o of ops) {
      seg(at, o.a, 0, top);
      if (o.k === 'door') seg(o.a, o.b, DOOR_H, top);
      if (o.k === 'open') seg(o.a, o.b, o.h ?? OPEN_H, top);
      if (o.k === 'slider') {
        seg(o.a, o.b, DOOR_H, top);
        // D1: a fixed leaf and a sliding leaf parked behind it, so half the door stands open
        const mid = (o.a + o.b) / 2;
        const [p, q] = o.open === 'w' ? [mid - 0.05, o.b - 0.1] : [o.a + 0.1, mid + 0.05];
        glassPane(w, p, q, Y0 + 0.05, Y0 + DOOR_H - 0.05, 0.06);
        glassPane(w, p, q, Y0 + 0.05, Y0 + DOOR_H - 0.05, -0.06);
      }
      if (o.k === 'window') {
        const sill = o.sill ?? SILL;
        seg(o.a, o.b, 0, sill);
        seg(o.a, o.b, DOOR_H, top);
        glassPane(w, o.a, o.b, Y0 + sill, Y0 + DOOR_H, 0);
      }
      if (o.k === 'garage') {
        seg(o.a, o.b, 7.0, top);
        if (w.ax === 'n') garageDoor(w.c + w.t / 2, o.a, o.b);
      }
      at = o.b;
    }
    seg(at, w.b, 0, top);
  }

  function glassPane(w, a, b, y0, y1, off) {
    const t = 0.06;
    if (w.ax === 'x') {
      box('glass', a, w.c + off - t, b, w.c + off + t, y0, y1, { lines: false });
      addLine(a, w.c + off, b, w.c + off, y0);
      // frame
      box('black', a, w.c + off - 0.09, a + 0.12, w.c + off + 0.09, y0, y1, { lines: false });
      box('black', b - 0.12, w.c + off - 0.09, b, w.c + off + 0.09, y0, y1, { lines: false });
      box('black', a, w.c + off - 0.09, b, w.c + off + 0.09, y0, y0 + 0.12, { lines: false });
      box('black', a, w.c + off - 0.09, b, w.c + off + 0.09, y1 - 0.12, y1, { lines: false });
    } else {
      box('glass', w.c + off - t, a, w.c + off + t, b, y0, y1, { lines: false });
      addLine(w.c + off, a, w.c + off, b, y0);
      box('black', w.c + off - 0.09, a, w.c + off + 0.09, a + 0.12, y0, y1, { lines: false });
      box('black', w.c + off - 0.09, b - 0.12, w.c + off + 0.09, b, y0, y1, { lines: false });
      box('black', w.c + off - 0.09, a, w.c + off + 0.09, b, y0, y0 + 0.12, { lines: false });
      box('black', w.c + off - 0.09, a, w.c + off + 0.09, b, y1 - 0.12, y1, { lines: false });
    }
  }
  function addLine(X0, N0, X1, N1, y) {
    edges.push(X0 * FT, y * FT, -N0 * FT, X1 * FT, y * FT, -N1 * FT);
  }

  // ---- floors, ceilings, roof, foundation --------------------------------------
  const F = -0.02; // floor finish sits on y = 0
  box('oak', 0.46, 0.46, 16.21, 31.77, F, 0, { lines: false }); // great room, stair hall, mud room
  box('oak', 16.21, 5.0, 30.26, 22.0, F, 0, { lines: false }); // foyer
  slabs('oak', [30.26, 0.46, 55.67, 31.87], WELLS.down, F, 0); // east block, open over the stair down
  box('concrete', 0.46, 32.23, 22.55, 55.31, F - 0.1, -0.1, { lines: false }); // garage slab
  // foundation (S1.1): crawl spaces under the great room, foyer and garage ...
  for (const h of [HOUSE[0], HOUSE[1], HOUSE[3]]) box('concrete', h[0], h[1], h[2], h[3], -9.6, -0.2, { lines: false });
  box('concrete', 29.8, 32.33, 56.13, 32.87, -9.6, 0.4, { lines: false }); // retaining wall / reverse brick drop
  // ... and the basement under the east block: slab, finished floor, ceiling and the main floor's structure
  box('concrete', 29.8, 0, 56.13, 32.33, -9.6, BASE_FLOOR - 0.02, { lines: false });
  box('oak', 30.97, 0.46, 54.96, 31.16, BASE_FLOOR - 0.02, BASE_FLOOR, { lines: false });
  slabs('ceiling', [30.97, 0.46, 54.96, 31.16], WELLS.down, BASE_CEIL - 0.05, BASE_CEIL);
  slabs('band', [29.8, 0, 56.13, 32.33], WELLS.down, BASE_CEIL, F);
  // ceilings, and the floor band between the storeys (the second floor sits on it)
  const inset = (r, d = 0.47) => [r[0] + d, r[1] + d, r[2] - d, r[3] - d];
  box('ceiling', ...inset(HOUSE[3]), CEIL, CEIL + 0.05, { lines: false });
  for (const r of HOUSE.slice(0, 3)) slabs('ceiling', inset(r), WELLS.up, CEIL, CEIL + 0.05);
  for (const r of HOUSE.slice(0, 3)) slabs('band', r, WELLS.up, CEIL + 0.05, F2 - 0.02);
  for (const r of HOUSE.slice(0, 3)) slabs('oak', inset(r), WELLS.up, F2 - 0.02, F2);
  for (const r of HOUSE.slice(0, 3)) box('ceiling', ...inset(r), F2 + 8, F2 + 8.05, { lines: false });

  // ---- the second floor inside (A1.3): partitions --------------------------------
  for (const b of WALLS_UP_INT) box('wall', b[0], b[1], b[2], b[3], F2, F2 + 8);

  // ---- the lake side: the basement patio and the wall that holds the terrace -------
  box('stone', WALL_X + 0.4, -14, 56.6, -0.02, BASE_FLOOR - 0.35, BASE_FLOOR + 0.02, { lines: false });
  for (let n = 0; n > -46; n -= 1.5) {
    const top = groundH(WALL_X - 1, n - 0.75) + 0.35, bot = groundH(WALL_X + 1, n - 1.5) - 0.4;
    if (top - bot > 0.6) box('stone', WALL_X - 0.4, n - 1.5, WALL_X + 0.4, n, bot, top, { lines: false });
  }

  // ---- roofs (A3.1, A3.2) ---------------------------------------------------------
  buildRoofs();

  // ---- the deck ----------------------------------------------------------------
  const deckBox = (b, key = 'deck') => {
    box(key, b[0], b[1], b[2], b[3], DECK - 0.15, DECK, { lines: true });
    box('walnut', b[0], b[1], b[2], b[3], DECK - 1.1, DECK - 0.15, { lines: false }); // joists
  };
  deckBox(DECKS.main);
  deckBox(DECKS.notch);
  deckBox(DECKS.grill);
  box('deck', ...DECKS.north.slice(0, 2), ...DECKS.north.slice(2), DECK - 0.15, DECK, { lines: false });
  // posts under the deck, on the sonotubes
  for (const X of [0.4, 8, 16, 30, 37.5, 47.9, 55.6]) box('black', X - 0.25, -11.6, X + 0.25, -11.1, groundH(X, -11.35) - 0.3, DECK - 1.1);
  for (const X of [48.6, 55.6]) box('black', X - 0.25, -17.6, X + 0.25, -17.1, groundH(X, -17.35) - 0.3, DECK - 1.1);
  // the deck's beam along the house over the patio, so the walk-out reads as covered
  box('black', 29.8, -0.6, 56.13, -0.1, DECK - 1.1, DECK - 0.15, { lines: false });
  // posts carrying the porch roof, along the deck edge and at the grilling area
  const porchUnder = (N) => ROOFS.porch.top + ROOFS.porch.pitch * N - 0.5;
  for (const X of PORCH_POSTS) box('white', X - 0.25, -11.83, X + 0.25, -11.33, DECK, porchUnder(-11.58));
  for (const X of [48.55, 55.75]) box('white', X - 0.25, -17.83, X + 0.25, -17.33, DECK, ROOFS.grill.eave + 0.2);

  // stair down to the yard
  const S = DECKS.stair;
  for (let k = 1; k <= S.risers - 1; k++) {
    const top = DECK - k * ((DECK - LAWN) / S.risers);
    box('deck', S.x0, S.top - k * S.run, S.x1, S.top - (k - 1) * S.run, LAWN, top);
  }
  // stair stringers / side rails (sloped)
  const run = (S.risers - 1) * S.run, drop = DECK - LAWN;
  const slope = Math.atan2(drop, run);
  for (const X of [S.x0 - 0.15, S.x1 + 0.15]) {
    const len = Math.hypot(run, drop);
    const g = new THREE.BoxGeometry(0.18 * FT, 0.18 * FT, len * FT);
    g.rotateX(slope);
    g.translate(X * FT, ((DECK + LAWN) / 2 + 3.1) * FT, -(S.top - run / 2) * FT);
    put('black', g);
    addEdges(g);
    box('black', X - 0.12, S.top - run - 0.2, X + 0.12, S.top - run + 0.04, LAWN, LAWN + 3.2);
  }

  // cable railing along the deck edges
  const railTop = DECK + 3.2;
  const posts = [];
  for (const X of RAIL_POSTS) posts.push([X, -11.83]);
  for (const N of [-11.83, -5.9, 0]) posts.push([0, N]);
  for (const [X, N] of [[48.3, -17.83], [52, -17.83], [56.0, -17.83], [56.0, -14.8], [56.0, -11.83], [56.0, -6], [56.0, 0]]) posts.push([X, N]);
  for (const [X, N] of posts) box('black', X - 0.17, N - 0.17, X + 0.17, N + 0.17, DECK, railTop);
  const rail = (X0, N0, X1, N1) => {
    const len = Math.hypot(X1 - X0, N1 - N0);
    const g = new THREE.BoxGeometry(len * FT, 0.14 * FT, 0.32 * FT);
    g.rotateY(Math.atan2(N1 - N0, X1 - X0));
    g.translate(((X0 + X1) / 2) * FT, railTop * FT, -((N0 + N1) / 2) * FT);
    put('black', g);
    for (let c = 1; c <= 9; c++) {
      const y = (DECK + c * 0.32) * FT;
      cables.push(X0 * FT, y, -N0 * FT, X1 * FT, y, -N1 * FT);
    }
  };
  rail(0, -11.83, S.x0, -11.83);
  rail(S.x1, -11.83, 48.3, -11.83);
  rail(48.3, -11.83, 48.3, -17.83);
  rail(48.3, -17.83, 56.0, -17.83);
  rail(56.0, -17.83, 56.0, 0);
  rail(0, -11.83, 0, 0);

  // ---- stairs inside -------------------------------------------------------------
  // great room L stair: treads 1-8 west along the top, a landing, 9-17 south down the west wall
  const tread = (X0, N0, X1, N1, k) => box('oak', X0, N0, X1, N1, k * RISE - 0.15, k * RISE);
  for (let k = 1; k <= 8; k++) {
    const X1 = 11.33 - (k - 1) * 0.916, X0 = X1 - 0.916;
    tread(X0, 21.61, X1, 25.11, k);
    box('white', X1 - 0.05, 21.61, X1, 25.11, (k - 1) * RISE, k * RISE, { lines: false }); // riser
  }
  box('oak', 0.46, 21.61, 4.0, 25.11, 8 * RISE - 0.15, 8 * RISE); // corner landing
  for (let k = 9; k <= 17; k++) {
    const N1 = 21.61 - (k - 9) * 0.917, N0 = N1 - 0.917;
    tread(0.46, N0, 4.0, N1, k);
  }
  // east stair: nine risers up, north, to a landing across both runs ...
  for (let k = 1; k <= 8; k++) {
    const N0 = 10.97 + (k - 1) * 0.833;
    tread(31.02, N0, 34.55, N0 + 0.833, k);
    box('white', 31.02, N0, 34.55, N0 + 0.05, (k - 1) * RISE, k * RISE, { lines: false }); // riser
    box('white', 31.02, N0, 34.55, N0 + 0.833, k * RISE - 0.8, k * RISE - 0.15, { lines: false }); // soffit (the floor is open below)
  }
  box('oak', 31.02, 17.64, 38.34, 21.36, 9 * RISE - 0.15, 9 * RISE); // landing
  box('white', 31.02, 17.64, 38.34, 21.36, 9 * RISE - 0.8, 9 * RISE - 0.15, { lines: false });
  // ... then back south over the stair down to the basement
  for (let k = 10; k <= 17; k++) {
    const N1 = 17.64 - (k - 10) * 0.833, N0 = N1 - 0.833;
    tread(34.84, N0, 38.34, N1, k);
    box('white', 34.84, N0, 38.34, N1, k * RISE - 0.8, k * RISE - 0.15, { lines: false }); // soffit
  }
  // the stair down to the basement: eight risers north under the return run, a landing,
  // then eight more south along the west wall to the basement floor (A1.2, basement)
  for (let k = 1; k <= 8; k++) {
    const N0 = 10.97 + (k - 1) * 0.833;
    box('oak', 34.84, N0, 38.34, N0 + 0.833, -k * RISE - 0.15, -k * RISE);
    box('white', 34.84, N0, 38.34, N0 + 0.833, -k * RISE - 0.8, -k * RISE - 0.15, { lines: false });
  }
  box('oak', 31.02, 17.64, 38.34, 21.36, -9 * RISE - 0.15, -9 * RISE); // landing
  box('white', 31.02, 17.64, 38.34, 21.36, -9 * RISE - 0.8, -9 * RISE - 0.15, { lines: false });
  for (let k = 10; k <= 16; k++) {
    const N1 = 17.64 - (k - 10) * 0.833, N0 = N1 - 0.833;
    box('oak', 31.02, N0, 34.55, N1, -k * RISE - 0.15, -k * RISE);
    box('white', 31.02, N0, 34.55, N1, BASE_FLOOR, -k * RISE - 0.15, { lines: false }); // closed below
  }

  // ---- furniture -----------------------------------------------------------------
  // great room: sofa with its back to the stair, two armchairs, coffee table, rug
  box('rug', 3.0, 1.5, 14.2, 9.4, 0, 0.04, { lines: true });
  sofa(8.4, 7.0, 7.4, 3.0, 0);
  // (lounge chairs and side tables are Poly Haven models: js/models.js)
  cyl('walnut', 8.5, 3.6, 1.6, 1.6, 0.04, 1.35, 32); // round coffee table
  lamp(3.4, 7.2, 1.48); // table lamps on the side tables
  lamp(13.6, 7.2, 1.48);
  // a media console against the west wall
  box('walnut', 0.5, 4.0, 2.0, 10.0, 0, 1.8);

  foyer();

  // (the dining table, chairs and chandelier are Poly Haven models: js/models.js)

  kitchenDining();

  // bedroom (stays a drawing): bed, nightstands
  box('white', 33.0, 24.6, 38.6, 31.3, 0, 1.9);
  box('white', 33.0, 30.6, 38.6, 31.6, 0, 3.4);
  box('walnut', 31.4, 29.9, 32.8, 31.4, 0, 2.0);
  box('walnut', 38.8, 29.9, 40.2, 31.4, 0, 2.0);
  // bathroom: double vanity, toilet behind a half wall, 3'-0" x 5'-0" shower
  box('white', 46.8, 26.0, 48.6, 31.5, 0, 2.9);
  box('white', 53.2, 27.0, 55.0, 29.0, 0, 1.4);
  box('wall', 52.34, 25.83, 55.67, 26.29, 0, CEIL); // shower wall
  box('wall', 52.34, 26.29, 52.6, 27.6, 0, 3.5); // the 1/2 wall
  box('glass', 52.6, 20.83, 52.7, 25.83, 0, 7, { lines: true });
  // barn doors (D4 pantry, D7 closet), slid open
  for (const b of BARN) box('walnut', b.X0, b.N0, b.X1, b.N1, 0.05, DOOR_H + 0.1);
  // mud room bench
  box('walnut', 0.5, 29.8, 2.0, 31.7, 0, 1.5);

  // ---- upstairs (A1.3) ---------------------------------------------------------------
  const U2 = F2;
  // game room: a deep sectional facing the big south window and the lake
  box('rug', 2.4, 1.6, 13.8, 9.6, U2, U2 + 0.04);
  sectional(2.8, 6.6, 12.2, 9.4, U2);
  soft('fabric', 2.8, 3.4, 5.3, 6.6, U2 + 0.4, U2 + 1.45, 0.2); // the chaise
  cyl('walnut', 8.4, 4.4, 1.5, 1.5, U2 + 0.04, U2 + 1.3, 32);
  // bedrooms: a bed each, headboard on the solid wall, foot towards the window
  bed(49.2, 7.0, U2, 0); // bedroom-04: headboard on the north wall, looking south over the lake
  bed(36.4, 28.0, U2, 0); // bedroom-02
  bed(50.6, 28.0, U2, 0); // bedroom-03
  bed(21.8, 17.6, U2, 0); // bedroom-05

  // ---- the basement (A1.2) ---------------------------------------------------------
  const B = BASE_FLOOR;
  box('rug', 40.4, 9.6, 50.6, 18.6, B, B + 0.04);
  sectional(41.4, 15.6, 49.6, 18.4, B); // facing south, out through the walk-out to the lake
  // the media wall on the blocked stair wall: a long low walnut console and the screen above it
  soft('walnut', 38.95, 11.4, 40.4, 18.2, B, B + 1.9, 0.06);
  box('black', 38.95, 12.9, 39.1, 16.7, B + 3.0, B + 5.4);
  // a low rectangular coffee table on slim legs
  soft('walnut', 43.2, 11.6, 47.6, 13.6, B + 1.1, B + 1.35, 0.06);
  for (const [x, n] of [[43.5, 11.9], [47.3, 11.9], [43.5, 13.3], [47.3, 13.3]]) cyl('black', x, n, 0.06, 0.06, B, B + 1.1, 8, { lines: false });
  // (the daybed under the egress window is a Poly Haven model)
  // a floor lamp by the sectional
  cyl('black', 50.2, 17.6, 0.5, 0.06, B, B + 5.2, 12, { lines: false });
  cyl('fabric', 50.2, 17.6, 0.85, 0.65, B + 4.6, B + 5.8, 20);
  box('white', 31.6, 27.6, 34.6, 30.6, B, B + 5.4); // furnace
  cyl('white', 37.4, 29.9, 1.1, 1.1, B, B + 5.0, 24); // water heater
  box('white', 50.0, 29.6, 52.4, 31.1, B, B + 3.0); // washer
  box('white', 52.5, 29.6, 54.9, 31.1, B, B + 3.0); // dryer
  // deck furniture: a lounge set and a grill
  sofa(8.0, -8.6, 8.0, 2.6, 0, DECK); // an outdoor sofa, facing the house and the fire table
  armchair(4.6, -4.8, -90);
  cyl('walnut', 9.0, -4.6, 1.8, 1.8, DECK, DECK + 1.3, 28);
  for (const X of [36.0, 42.0]) armchair(X, -8.4, 0);
  cyl('stone', 39.0, -4.6, 2.2, 2.2, DECK, DECK + 1.25, 32);
  box('black', 50.4, -17.2, 53.6, -15.4, DECK, DECK + 3.0);

  // ---- swing doors, drawn open -------------------------------------------------------
  const arcs = [];
  for (const s of SWINGS) {
    if (s.room === 'foyer') continue; // the front door is its own moving part (frontDoor below)
    const a = (s.open * Math.PI) / 180;
    const ex = s.X + Math.cos(a) * s.r, en = s.N + Math.sin(a) * s.r;
    const w = 0.15;
    const len = s.r;
    const g = new THREE.BoxGeometry(len * FT, DOOR_H * FT, w * FT);
    g.rotateY(a);
    g.translate(((s.X + ex) / 2) * FT, (DOOR_H / 2) * FT, -((s.N + en) / 2) * FT);
    put('white', g);
    addEdges(g);
    arcs.push(s);
  }

  // ---- trees ---------------------------------------------------------------------
  for (const t of TREES) tree(t);

  // ---- merge -------------------------------------------------------------------
  for (const key in geos) {
    const g = mergeGeometries(geos[key], false);
    geos[key].forEach((x) => x.dispose());
    const mesh = new THREE.Mesh(g, M[key]);
    mesh.castShadow = key !== 'glass' && key !== 'lamp';
    mesh.receiveShadow = key !== 'glass';
    mesh.name = key;
    group.add(mesh);
  }

  // the entry lantern beside the front door (A2.1)
  box('black', 20.85, 21.95, 21.4, 22.35, 5.5, 6.8, { lines: false });
  box('lamp', 20.9, 22.0, 21.35, 22.4, 5.7, 6.6, { lines: false });
  // planters of white hydrangeas on the entry deck, either side of the door (seen through the sidelights)
  for (const [x, n] of [[18.6, 24.2], [27.9, 24.2], [17.8, 29.5], [28.6, 29.5]]) {
    cyl('stone', x, n, 0.9, 1.1, DECK, DECK + 1.7, 20, { lines: false });
    for (let k = 0; k < 9; k++) {
      const t = k * 2.4, r = k === 0 ? 0 : 0.6;
      const g = new THREE.IcosahedronGeometry((k === 0 ? 0.55 : 0.45) * FT, 1);
      g.translate((x + Math.cos(t) * r) * FT, (DECK + 2.1 + (k % 3) * 0.25) * FT, -(n + Math.sin(t) * r) * FT);
      put(k % 4 === 3 ? 'leafy' : 'flowers', g);
    }
  }
  const door = frontDoor();
  return { group, edges, cables, arcs, treeEdges, door: door.group, doorEdges: door.edges };

  // ---- the kitchen and dining room, after the references ------------------------------
  function kitchenDining() {
    const T = { lines: false };
    const top = CEIL;
    // a run of white shaker cabinets. face: the side the doors are on ('w' = -X, 's' = -N, 'e', 'n');
    // a drawer band at the top of a base run, panelled doors below, brass cup pulls and knobs
    function run(x0, n0, x1, n1, y0, y1, face, { drawer = true, unit = 1.6, kick = 0.35, upper = false } = {}) {
      box('shaker', x0, n0, x1, n1, y0 + (upper ? 0 : kick), y1);
      if (!upper) box('black', x0 + 0.05, n0 + 0.05, x1 - 0.05, n1 - 0.05, y0, y0 + kick, T); // toe kick
      const alongX = face === 's' || face === 'n';
      const a0 = alongX ? x0 : n0, a1 = alongX ? x1 : n1, len = a1 - a0;
      const f = face === 'w' ? x0 : face === 'e' ? x1 : face === 's' ? n0 : n1, d = face === 'w' || face === 's' ? -1 : 1;
      const k = Math.max(1, Math.round(len / unit)), w = len / k;
      const yb = y0 + (upper ? 0.05 : kick + 0.05), yt = y1 - 0.05;
      const strip = (u0, u1, v0, v1, p = 0.04, key = 'shaker') => alongX
        ? box(key, u0, Math.min(f, f + d * p), u1, Math.max(f, f + d * p), v0, v1, T)
        : box(key, Math.min(f, f + d * p), u0, Math.max(f, f + d * p), u1, v0, v1, T);
      const doorTop = drawer && !upper ? yt - 0.6 : yt;
      for (let i = 0; i < k; i++) {
        const u0 = a0 + i * w + 0.03, u1 = a0 + (i + 1) * w - 0.03, s = 0.22;
        // the door: a frame of stiles and rails standing proud of a recessed panel
        strip(u0, u0 + s, yb, doorTop); strip(u1 - s, u1, yb, doorTop);
        strip(u0 + s, u1 - s, yb, yb + s); strip(u0 + s, u1 - s, doorTop - s, doorTop);
        if (drawer && !upper) { strip(u0, u1, doorTop + 0.06, yt, 0.04); strip((u0 + u1) / 2 - 0.2, (u0 + u1) / 2 + 0.2, yt - 0.34, yt - 0.26, 0.09, 'gilt'); }
        const ky = upper ? yb + 0.35 : doorTop - 0.35, ku = i % 2 ? u0 + 0.3 : u1 - 0.3;
        strip(ku - 0.05, ku + 0.05, ky - 0.05, ky + 0.05, 0.1, 'gilt');
      }
    }
    // the island: white shaker on all four sides, grey marble top with an overhang for stools
    run(47.2, 3.85, 50.1, 9.6, 0, 3.0, 'e', { unit: 1.9 });
    run(47.2, 3.85, 50.1, 9.6, 0, 3.0, 's', { drawer: false, unit: 2.9 });
    run(47.2, 3.85, 50.1, 9.6, 0, 3.0, 'n', { drawer: false, unit: 2.9 });
    box('marbleg', 46.15, 3.7, 50.25, 9.75, 3.0, 3.17);
    for (const n of [3.85, 9.6]) for (const x of [47.2, 50.1]) box('shaker', x - 0.18, n - 0.18, x + 0.18, n + 0.18, 0, 3.0, T); // corner pilasters
    // the east run under the windows: sink, dishwasher, drawers
    run(53.65, 0.46, 55.67, 13.0, 0, 3.0, 'w');
    box('marbleg', 53.4, 0.46, 55.67, 13.2, 3.0, 3.17);
    box('steel', 53.6, 5.9, 53.68, 7.9, 0.4, 2.95); // dishwasher front
    box('nickel', 53.5, 6.1, 53.6, 7.7, 2.6, 2.7, T); // its handle
    box('black', 53.9, 3.4, 55.3, 5.6, 2.95, 3.18, T); // undermount sink
    cyl('nickel', 55.35, 4.5, 0.08, 0.08, 3.17, 4.15, 10, T); // bridge faucet
    { const g = new THREE.TorusGeometry(0.42 * FT, 0.05 * FT, 8, 16, Math.PI); g.rotateY(Math.PI / 2); g.translate(55.35 * FT, 4.15 * FT, -4.08 * FT); put('nickel', g); }
    box('subway', 55.55, 0.46, 55.67, 13.0, 3.17, 4.6, T); // backsplash, east
    // the north wall: a stainless fridge, the range under a white hood, cabinets to the ceiling
    box('steel', 46.85, 12.75, 49.85, 15.04, 0, 6.9); // refrigerator
    box('black', 48.33, 12.7, 48.37, 15.0, 2.15, 6.85, T); // French doors
    box('black', 46.9, 12.7, 49.8, 15.0, 2.1, 2.15, T);
    for (const x of [48.15, 48.55]) box('nickel', x - 0.04, 12.55, x + 0.04, 12.7, 3.2, 5.9, T);
    box('nickel', 47.2, 12.55, 49.5, 12.7, 1.75, 1.83, T);
    box('black', 47.0, 12.74, 49.7, 12.8, 6.4, 6.8, T); // grille
    run(46.85, 13.2, 49.85, 15.04, 7.0, top - 0.05, 's', { upper: true, unit: 1.5 });
    run(49.85, 13.0, 50.75, 15.04, 0, 3.0, 's', { unit: 0.9 });
    box('steel', 50.75, 12.95, 53.35, 15.04, 0, 3.05); // range
    box('black', 50.85, 12.9, 53.25, 12.96, 0.6, 2.2, T); // oven window
    box('nickel', 51.0, 12.75, 53.1, 12.85, 2.35, 2.42, T);
    box('black', 50.75, 13.1, 53.35, 15.0, 3.05, 3.12, T); // cooktop grates
    for (let i = 0; i < 5; i++) cyl('black', 51.05 + i * 0.5, 12.92, 0.08, 0.08, 2.75, 2.85, 8, T);
    run(53.35, 13.0, 55.67, 15.04, 0, 3.0, 's', { unit: 1.15 });
    box('marbleg', 49.85, 12.8, 50.75, 15.04, 3.0, 3.17); box('marbleg', 53.35, 12.8, 55.67, 15.04, 3.0, 3.17);
    box('subway', 49.85, 14.92, 55.67, 15.04, 3.17, 4.6, T); // backsplash, north
    // the hood: a white plaster chimney flaring out over the range
    box('shaker', 50.55, 13.5, 53.55, 15.04, 5.0, 5.55);
    box('shaker', 50.85, 14.0, 53.25, 15.04, 5.55, top);
    box('trim', 50.5, 13.45, 53.6, 15.04, 5.55, 5.7, T);
    run(49.85, 13.85, 50.55, 15.04, 4.6, top - 0.05, 's', { upper: true, unit: 0.7 });
    run(53.55, 13.85, 55.67, 15.04, 4.6, top - 0.05, 's', { upper: true, unit: 1.05 });
    box('trim', 46.85, 13.6, 55.67, 15.04, top - 0.3, top, T); // crown
    // two brass lanterns over the island
    for (const n of [5.35, 8.15]) lantern(48.2, n, 6.05);
    // flowers: blue and white hydrangeas in the blue-and-white jar on the island, white by the sink
    hydrangeas(48.65, 6.0, 4.25, true);
    hydrangeas(54.85, 8.4, 4.55, false);

    // ---- the dining room ---------------------------------------------------------------
    box('rugdin', 32.2, 0.6, 43.7, 10.2, 0, 0.04, T);
    // a limed-oak trestle table
    soft('driftwood', 33.9, 3.55, 42.0, 7.25, 2.33, 2.55, 0.05);
    for (const X of [35.1, 40.8]) {
      box('driftwood', X - 0.22, 4.45, X + 0.22, 6.35, 0.25, 2.2);
      soft('driftwood', X - 0.3, 3.9, X + 0.3, 6.9, 0, 0.26, 0.05);
      soft('driftwood', X - 0.3, 4.1, X + 0.3, 6.7, 2.15, 2.33, 0.04);
    }
    box('driftwood', 35.1, 5.25, 40.8, 5.55, 0.9, 1.2);
    box('linen', 34.4, 4.85, 41.5, 5.95, 2.55, 2.57, T); // the runner
    // places for eight: charger, plate, napkin, wine glass
    const places = [[35.4, 3.95, 0], [37.95, 3.95, 0], [40.5, 3.95, 0], [35.4, 6.85, 180], [37.95, 6.85, 180], [40.5, 6.85, 180], [34.45, 5.4, -90], [41.45, 5.4, 90]];
    for (const [X, N, deg] of places) {
      cyl('pewter', X, N, 0.6, 0.6, 2.55, 2.58, 28, T);
      cyl('china', X, N, 0.46, 0.5, 2.58, 2.62, 28, T);
      soft('linen', X - 0.22, N - 0.12, X + 0.22, N + 0.12, 2.62, 2.75, 0.05, { lines: false, deg, cx: X, cn: N });
      const [gx, gn] = rotP(X + 0.62, N + 0.55, X, N, deg);
      wineGlass(gx, gn, 2.55);
    }
    // candlesticks and hydrangeas down the middle
    for (const X of [36.4, 39.5]) {
      cyl('pewter', X, 5.4, 0.25, 0.22, 2.57, 2.66, 16, T); cyl('pewter', X, 5.4, 0.07, 0.07, 2.66, 3.5, 10, T); cyl('pewter', X, 5.4, 0.13, 0.17, 3.5, 3.6, 12, T);
      cyl('white', X, 5.4, 0.13, 0.13, 3.6, 4.15, 14, T); cyl('lamp', X, 5.4, 0.02, 0.035, 4.15, 4.3, 6, T);
    }
    for (const [X, N, h] of [[37.4, 5.25, 0.85], [38.55, 5.6, 1.05]]) { cyl('glass', X, N, 0.27, 0.27, 2.57, 2.57 + h, 16, T); hydrangeas(X, N, 2.57 + h + 0.15, false); }
    // two tiered capiz-shell chandeliers
    for (const X of [36.0, 39.9]) capiz(X, 5.4, top);
    // white fretwork chairs with blue seats, and blue upholstered host chairs at the ends
    for (const X of [35.4, 37.95, 40.5]) { fretChair(X, 2.75, 0); fretChair(X, 8.05, 180); }
    hostChair(33.0, 5.4, -90); hostChair(42.9, 5.4, 90);
  }
  function lantern(X, N, yb) {
    const w = 1.05, h = 1.7, T = { lines: false };
    box('gilt', X - w / 2, N - w / 2, X + w / 2, N + w / 2, yb, yb + 0.1, T);
    for (const [dx, dn] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box('gilt', X + dx * w / 2 - 0.04, N + dn * w / 2 - 0.04, X + dx * w / 2 + 0.04, N + dn * w / 2 + 0.04, yb, yb + h - 0.4, T);
    for (const d of [-1, 1]) {
      box('glass', X - w / 2 + 0.05, N + d * w / 2 - 0.01, X + w / 2 - 0.05, N + d * w / 2 + 0.01, yb + 0.1, yb + h - 0.42, T);
      box('glass', X + d * w / 2 - 0.01, N - w / 2 + 0.05, X + d * w / 2 + 0.01, N + w / 2 - 0.05, yb + 0.1, yb + h - 0.42, T);
    }
    box('gilt', X - w / 2 - 0.05, N - w / 2 - 0.05, X + w / 2 + 0.05, N + w / 2 + 0.05, yb + h - 0.45, yb + h - 0.38, T);
    const cap = new THREE.ConeGeometry(w * 0.78 * FT, 0.45 * FT, 4); cap.rotateY(Math.PI / 4); cap.translate(X * FT, (yb + h - 0.15) * FT, -N * FT); put('gilt', cap);
    cyl('gilt', X, N, 0.1, 0.06, yb + h + 0.05, yb + h + 0.3, 8, T);
    cyl('black', X, N, 0.025, 0.025, yb + h + 0.3, CEIL, 5, T);
    cyl('gilt', X, N, 0.07, 0.12, yb + 0.1, yb + 0.55, 8, T);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2, r = k ? 0.28 : 0; cyl('white', X + Math.cos(a) * r, N + Math.sin(a) * r, 0.04, 0.04, yb + 0.55, yb + 0.95, 6, T); cyl('lamp', X + Math.cos(a) * r, N + Math.sin(a) * r, 0.02, 0.04, yb + 0.95, yb + 1.08, 6, T); }
  }
  function capiz(X, N, top) {
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
    const tiers = [[1.25, top - 1.0], [1.0, top - 1.65], [0.72, top - 2.25]];
    for (const [r, y] of tiers) {
      const ring = new THREE.TorusGeometry(r * FT, 0.04 * FT, 6, 40); ring.rotateX(Math.PI / 2); ring.translate(X * FT, y * FT, -N * FT); put('gilt', ring);
      const n = Math.round((2 * Math.PI * r) / 0.19);
      for (let row = 0; row < 4; row++) for (let i = 0; i < n; i++) {
        const a = ((i + row * 0.5) / n) * Math.PI * 2;
        const g = new THREE.CylinderGeometry(0.095 * FT, 0.095 * FT, 0.012 * FT, 14);
        q.setFromUnitVectors(up, new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)));
        g.applyQuaternion(q);
        g.translate((X + Math.cos(a) * r) * FT, (y - 0.12 - row * 0.17) * FT, -(N + Math.sin(a) * r) * FT);
        put('capiz', g);
      }
    }
    cyl('lamp', X, N, 0.35, 0.3, top - 2.3, top - 1.2, 12, { lines: false });
    cyl('gilt', X, N, 0.03, 0.03, top - 1.0, top, 5, { lines: false });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; cyl('gilt', X + Math.cos(a) * 0.6, N + Math.sin(a) * 0.6, 0.015, 0.015, top - 2.3, top - 1.0, 4, { lines: false }); }
    cyl('gilt', X, N, 0.3, 0.3, top - 0.1, top, 16, { lines: false });
  }
  // a bunch of hydrangeas: round heads built from many small florets, with a few leaves
  function hydrangeas(X, N, y, blue) {
    let s = Math.round(X * 31 + N * 17);
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let h = 0; h < 6; h++) {
      const t = h * 2.1, r = h === 0 ? 0 : 0.3, hx = X + Math.cos(t) * r, hn = N + Math.sin(t) * r, hy = y + (h === 0 ? 0.28 : 0.12);
      const key = blue && h % 2 ? 'hydblue' : 'flowers';
      for (let f = 0; f < 16; f++) {
        const a = rnd() * Math.PI * 2, b = Math.acos(1 - rnd() * 1.4), R = 0.2;
        const g = new THREE.IcosahedronGeometry((0.065 + rnd() * 0.03) * FT, 0);
        g.translate((hx + Math.sin(b) * Math.cos(a) * R) * FT, (hy + Math.cos(b) * R) * FT, -(hn + Math.sin(b) * Math.sin(a) * R) * FT);
        put(key, g);
      }
      if (h > 0) { const g = new THREE.IcosahedronGeometry(0.12 * FT, 0); g.scale(1.6, 0.35, 1); g.translate((hx + Math.cos(t) * 0.18) * FT, (hy - 0.12) * FT, -(hn + Math.sin(t) * 0.18) * FT); put('leafy', g); }
    }
  }
  function wineGlass(X, N, y) {
    const pts = [[0.12, 0], [0.12, 0.02], [0.02, 0.04], [0.02, 0.32], [0.09, 0.4], [0.14, 0.55], [0.13, 0.7]].map(([r, h]) => new THREE.Vector2(r * FT, h * FT));
    const g = new THREE.LatheGeometry(pts, 14);
    g.translate(X * FT, y * FT, -N * FT);
    put('glass', g);
  }
  function fretChair(X, N, deg) {
    const o = { deg, cx: X, cn: N }, L = { ...o, lines: false };
    for (const [dx, dn] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) soft('cream', X + dx - 0.06, N + dn - 0.06, X + dx + 0.06, N + dn + 0.06, 0, 1.4, 0.03, L);
    soft('cream', X - 0.72, N - 0.72, X + 0.72, N + 0.72, 1.35, 1.5, 0.03, o);
    soft('blueseat', X - 0.68, N - 0.62, X + 0.68, N + 0.68, 1.5, 1.78, 0.1, o);
    for (const dx of [-0.66, 0.66]) soft('cream', X + dx - 0.07, N - 0.74, X + dx + 0.07, N - 0.6, 1.4, 3.45, 0.03, L);
    soft('cream', X - 0.72, N - 0.76, X + 0.72, N - 0.58, 3.12, 3.45, 0.05, o);
    soft('cream', X - 0.6, N - 0.72, X + 0.6, N - 0.62, 1.82, 1.9, 0.02, L);
    soft('fret', X - 0.6, N - 0.69, X + 0.6, N - 0.65, 1.9, 3.12, 0.005, L);
  }
  function hostChair(X, N, deg) {
    const o = { deg, cx: X, cn: N }, L = { ...o, lines: false };
    for (const [dx, dn] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.75], [0.7, 0.75]]) soft('driftwood', X + dx - 0.07, N + dn - 0.07, X + dx + 0.07, N + dn + 0.07, 0, 1.3, 0.03, L);
    soft('blueseat', X - 0.82, N - 0.6, X + 0.82, N + 0.85, 1.25, 1.8, 0.15, o);
    soft('bluepat', X - 0.9, N - 0.95, X + 0.9, N - 0.55, 1.25, 3.95, 0.18, o); // the back, patterned outside
    soft('blueseat', X - 0.78, N - 0.6, X + 0.78, N - 0.45, 1.8, 3.8, 0.1, L); // plain inside face
    for (const dx of [-0.84, 0.84]) soft('bluepat', X + dx - 0.07, N - 0.6, X + dx + 0.07, N + 0.35, 1.8, 3.3, 0.06, L); // wings
  }

  // ---- the foyer, after the reference: a coastal entry ------------------------------------
  // Inside faces of the room: X 16.5-30.0, N 5.46-21.5, ceiling 8'-0".
  function foyer() {
    const T = { lines: false };
    const W0 = 16.505, W1 = 30.005, S = 5.46, Nn = 21.5, top = CEIL;
    // casings: 3½" flat stock round every opening, with a head and a cap
    const caseX = (f, dir, a, b, h) => {
      const n0 = Math.min(f, f + dir * 0.07), n1 = Math.max(f, f + dir * 0.07);
      box('trim', a - 0.32, n0, a, n1, 0, h + 0.36, T);
      box('trim', b, n0, b + 0.32, n1, 0, h + 0.36, T);
      box('trim', a - 0.4, n0, b + 0.4, n1, h, h + 0.4, T);
      box('trim', a - 0.46, Math.min(f, f + dir * 0.12), b + 0.46, Math.max(f, f + dir * 0.12), h + 0.4, h + 0.48, T);
    };
    const caseN = (f, dir, a, b, h) => {
      const x0 = Math.min(f, f + dir * 0.07), x1 = Math.max(f, f + dir * 0.07);
      box('trim', x0, a - 0.32, x1, a, 0, h + 0.36, T);
      box('trim', x0, b, x1, b + 0.32, 0, h + 0.36, T);
      box('trim', x0, a - 0.4, x1, b + 0.4, h, h + 0.4, T);
    };
    caseX(Nn, -1, 17.57, 19.57, DOOR_H); caseX(Nn, -1, 21.73, 24.73, DOOR_H); caseX(Nn, -1, 26.9, 28.9, DOOR_H);
    caseX(S, 1, 17.0, 19.0, DOOR_H); caseX(S, 1, 20.23, 26.23, DOOR_H); caseX(S, 1, 27.47, 29.47, DOOR_H);
    caseN(W0, 1, 5.46, 10.46, OPEN_H); caseN(W1, -1, 5.46, 10.46, OPEN_H);
    // baseboards between the openings
    const baseX = (f, dir, runs) => runs.forEach(([a, b]) => box('trim', a, Math.min(f, f + dir * 0.08), b, Math.max(f, f + dir * 0.08), 0, 0.58, T));
    const baseN = (f, dir, runs) => runs.forEach(([a, b]) => box('trim', Math.min(f, f + dir * 0.08), a, Math.max(f, f + dir * 0.08), b, 0, 0.58, T));
    baseX(Nn, -1, [[W0, 17.25], [19.89, 21.41], [25.05, 26.58], [29.22, W1]]);
    baseX(S, 1, [[W0, 16.68], [19.32, 19.91], [26.55, 27.15], [29.79, W1]]);
    baseN(W0, 1, [[10.78, Nn]]); baseN(W1, -1, [[10.78, Nn]]);
    // picture-frame panels and a chair rail on the long side walls
    const frameN = (f, dir, a, b, y0, y1) => {
      const x0 = Math.min(f, f + dir * 0.05), x1 = Math.max(f, f + dir * 0.05), w = 0.11;
      box('trim', x0, a, x1, b, y0, y0 + w, T); box('trim', x0, a, x1, b, y1 - w, y1, T);
      box('trim', x0, a, x1, a + w, y0, y1, T); box('trim', x0, b - w, x1, b, y0, y1, T);
    };
    for (const [f, dir] of [[W0, 1], [W1, -1]]) {
      for (const [a, b] of [[11.35, 16.05], [16.55, 21.0]]) { frameN(f, dir, a, b, 0.95, 2.7); frameN(f, dir, a, b, 3.35, 7.05); }
      box('trim', Math.min(f, f + dir * 0.09), 10.78, Math.max(f, f + dir * 0.09), Nn, 2.95, 3.12, T);
    }
    // crown moulding, then a coffered ceiling: perimeter beams and a 3 x 4 grid
    for (const [x0, n0, x1, n1] of [[W0, S, W1, S + 0.3], [W0, Nn - 0.3, W1, Nn], [W0, S, W0 + 0.3, Nn], [W1 - 0.3, S, W1, Nn]]) box('trim', x0, n0, x1, n1, top - 0.38, top, T);
    for (const X of [21.0, 25.5]) box('trim', X - 0.24, S, X + 0.24, Nn, top - 0.42, top, T);
    for (const N of [9.47, 13.48, 17.49]) box('trim', W0, N - 0.24, W1, N + 0.24, top - 0.42, top, T);
    for (const [X, N] of [[18.75, 7.47], [18.75, 19.5], [27.75, 7.47], [27.75, 19.5]]) cyl('lamp', X, N, 0.2, 0.2, top - 0.02, top, 16, T); // recessed lights
    // the sea-glass chandelier, centred in the coffer in front of the door
    const cx = 23.25, cn = 15.48, R = 1.15, yc = 7.85;
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
    for (let row = 0; row < 7; row++) {
      const a = (28 + row * 10.5) * (Math.PI / 180); // from near the bottom of the bowl up to its rim
      const r = R * Math.sin(a), y = yc - R * Math.cos(a), n = Math.max(6, Math.round((2 * Math.PI * r) / 0.24));
      for (let i = 0; i < n; i++) {
        const t = ((i + (row % 2) * 0.5) / n) * Math.PI * 2;
        const nx = Math.sin(a) * Math.cos(t), ny = -Math.cos(a), nz = Math.sin(a) * Math.sin(t);
        const g = new THREE.CylinderGeometry(0.135 * FT, 0.135 * FT, 0.03 * FT, 7);
        q.setFromUnitVectors(up, new THREE.Vector3(nx, ny, nz));
        g.applyQuaternion(q);
        g.translate((cx + r * Math.cos(t)) * FT, y * FT, -(cn + r * Math.sin(t)) * FT);
        put('seaglass', g);
      }
    }
    cyl('lamp', cx, cn, 0.42, 0.35, yc - 0.8, yc - 0.25, 16, T); // the glow inside
    cyl('brass', cx, cn, R + 0.05, R + 0.05, yc - 0.06, yc, 32, T); // the rim
    for (let k = 0; k < 3; k++) { // three chains up to a canopy
      const t = (k / 3) * Math.PI * 2, x = cx + (R - 0.05) * Math.cos(t), n = cn + (R - 0.05) * Math.sin(t);
      const len = Math.hypot(cx - x, cn - n, top - 0.1 - yc);
      const g = new THREE.CylinderGeometry(0.025 * FT, 0.025 * FT, len * FT, 5);
      q.setFromUnitVectors(up, new THREE.Vector3(cx - x, top - 0.1 - yc, -(cn - n)).normalize());
      g.applyQuaternion(q);
      g.translate(((x + cx) / 2) * FT, ((yc + top - 0.1) / 2) * FT, -((n + cn) / 2) * FT);
      put('brass', g);
    }
    cyl('brass', cx, cn, 0.35, 0.35, top - 0.12, top, 16, T);
    // the rug: soft blue on cream
    box('rugblue', 20.3, 11.4, 26.2, 18.9, 0, 0.04, T);
    // an upholstered bench on turned legs, under a gilt mirror (west wall)
    for (const X of [16.95, 18.05]) for (const N of [15.6, 17.5, 19.4]) { cyl('driftwood', X, N, 0.075, 0.1, 0, 0.6, 10, T); cyl('driftwood', X, N, 0.1, 0.075, 0.6, 1.25, 10, T); }
    soft('driftwood', 16.8, 15.45, 18.2, 19.55, 1.2, 1.45, 0.04);
    soft('linen', 16.82, 15.47, 18.18, 19.53, 1.45, 1.95, 0.2);
    soft('stripe', 16.85, 17.5, 17.3, 19.25, 1.9, 3.4, 0.22); // a ticking-stripe pillow
    box('gilt', W0, 15.6, W0 + 0.12, 19.4, 3.9, 7.1);
    box('mirror', W0 + 0.12, 15.85, W0 + 0.15, 19.15, 4.15, 6.85, T);
    // a limed-oak console with a lamp, hydrangeas and a basket, under a sea painting (east wall)
    soft('driftwood', 28.5, 14.6, W1, 19.4, 2.55, 2.76, 0.03);
    box('driftwood', 28.6, 14.75, W1, 19.25, 2.2, 2.55, T);
    for (const [x, n] of [[28.62, 14.72], [28.62, 19.06], [29.7, 14.72], [29.7, 19.06]]) box('driftwood', x, n, x + 0.24, n + 0.24, 0, 2.2, T);
    box('driftwood', 28.62, 14.72, W1, 19.3, 0.45, 0.58, T);
    cyl('ceramic', 29.3, 15.5, 0.3, 0.52, 2.76, 3.35, 20, T);
    cyl('ceramic', 29.3, 15.5, 0.52, 0.2, 3.35, 3.95, 20, T);
    cyl('brass', 29.3, 15.5, 0.06, 0.06, 3.95, 4.35, 8, T);
    cyl('shade', 29.3, 15.5, 0.82, 0.72, 4.25, 5.2, 24, T);
    box('white', 29.0, 16.4, 29.75, 17.1, 2.76, 2.98, T); box('trim', 29.05, 16.45, 29.7, 17.05, 2.98, 3.12, T); // books
    for (let k = 0; k < 9; k++) {
      const t = k * 2.4, r = k === 0 ? 0 : 0.32;
      const g = new THREE.IcosahedronGeometry(0.3 * FT, 1);
      g.translate((29.35 + Math.cos(t) * r) * FT, (3.75 + (k % 3) * 0.12) * FT, -(18.2 + Math.sin(t) * r) * FT);
      put('flowers', g);
    }
    box('gilt', W1 - 0.12, 14.9, W1, 19.1, 4.3, 7.25);
    box('painting', W1 - 0.15, 15.12, W1 - 0.12, 18.88, 4.52, 7.03, T);
  }

  // the front door (D3): a white leaf with a four-lite top and a raised panel below, hung at
  // its hinge so the page can swing it shut behind the visitor
  function frontDoor() {
    const g = new THREE.Group();
    g.position.set(24.73 * FT, 0, -21.75 * FT);
    const lines = [];
    const part = (key, x0, x1, y0, y1, z) => { // local feet: x along the leaf (0 at the hinge, -3 at the latch)
      const geo = new THREE.BoxGeometry(Math.abs(x1 - x0) * FT, (y1 - y0) * FT, z * 2 * FT);
      geo.translate(((x0 + x1) / 2) * FT, ((y0 + y1) / 2) * FT, 0);
      const m = new THREE.Mesh(geo, M[key]);
      m.castShadow = key !== 'glass';
      g.add(m);
      if (key !== 'glass') { const e = new THREE.EdgesGeometry(geo, 20); lines.push(...e.attributes.position.array); e.dispose(); }
    };
    const t = 0.075;
    part('trim', -0.45, 0, 0, DOOR_H, t); part('trim', -3.0, -2.55, 0, DOOR_H, t); // stiles
    part('trim', -2.55, -0.45, 0, 0.75, t); part('trim', -2.55, -0.45, 3.05, 3.5, t); part('trim', -2.55, -0.45, 6.22, DOOR_H, t); // rails
    part('trim', -2.55, -0.45, 0.75, 3.05, t * 0.55); part('trim', -2.25, -0.75, 1.05, 2.75, t * 0.85); // the raised panel
    part('glass', -2.55, -0.45, 3.5, 6.22, 0.02);
    part('trim', -1.55, -1.45, 3.5, 6.22, t * 0.7); part('trim', -2.55, -0.45, 4.81, 4.91, t * 0.7); // muntins
    part('black', -2.82, -2.7, 3.0, 4.6, 0.2); // the pull, both faces
    const edges = new THREE.BufferGeometry();
    edges.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    return { group: g, edges };
  }

  // ---- roofs
  // D9: a 16'-0" x 7'-0" overhead door (A2.3): four raised panels high, a row of lights at the top,
  // flush with the outside of the garage wall so it reads from the drive
  function garageDoor(Xf, a, b) {
    box('garage', Xf - 0.42, a, Xf - 0.3, b, 0, 7.0); // panels, set back in the opening
    for (let k = 1; k < 4; k++) box('black', Xf - 0.3, a + 0.15, Xf - 0.28, b - 0.15, k * 1.75 - 0.03, k * 1.75 + 0.03, { lines: false });
    const n = 7, w = (b - a - 0.6) / n;
    for (let i = 0; i < n; i++) box('glass', Xf - 0.3, a + 0.3 + i * w + 0.12, Xf - 0.27, a + 0.3 + (i + 1) * w - 0.12, 5.55, 6.6, { lines: false });
    // white trim round the opening
    box('white', Xf - 0.3, a - 0.45, Xf + 0.06, a, 0, 7.45);
    box('white', Xf - 0.3, b, Xf + 0.06, b + 0.45, 0, 7.45);
    box('white', Xf - 0.3, a - 0.45, Xf + 0.06, b + 0.45, 7.0, 7.45);
    // a wall light either side (A2.3)
    for (const n0 of [a - 1.3, b + 0.9]) box('black', Xf, n0, Xf + 0.25, n0 + 0.4, 7.6, 8.4, { lines: false });
  }

  // ---- roofs ------------------------------------------------------------------------
  // Every roof plane is a solid slab, 0.5 ft thick, so it casts shadows and closes
  // the model. Attics under the gables are solid wedges in the wall material, so
  // their gable ends read as siding.
  function buildRoofs() {
    const { oh, west, east, middle, garage, porch, grill } = ROOFS;
    const T = 0.5;
    // a gable with its ridge running north-south
    const gableNS = (r, eave, { south = true, north = true, wedgeBase = eave, roof = 'roof', trim = 'white', attic = 'attic' } = {}) => {
      const Xc = (r.X0 + r.X1) / 2, half = (r.X1 - r.X0) / 2;
      const top = eave + half * r.pitch, low = eave - oh * r.pitch;
      const N0 = r.N0 - (south ? oh : 0), N1 = r.N1 + (north ? oh : 0);
      slab(roof, [[r.X0 - oh, N0, low], [Xc, N0, top], [Xc, N1, top], [r.X0 - oh, N1, low]], T, trim);
      slab(roof, [[r.X1 + oh, N0, low], [r.X1 + oh, N1, low], [Xc, N1, top], [Xc, N0, top]], T, trim);
      wedge(attic, 'n', r.N0, r.N1, [[r.X0, wedgeBase], [r.X1, wedgeBase], [r.X1, eave], [Xc, top - T * 1.6], [r.X0, eave]]);
      return top;
    };
    gableNS(west, EAVE);
    gableNS(east, EAVE);
    gableNS(garage, garage.eave, { south: false, wedgeBase: CEIL, roof: 'roofLow', trim: 'whiteLow', attic: 'atticLow' });

    // the middle block: 8/12 east-west, its ridge dying into both 12/12 gables (the hexagon on A3.2)
    {
      const Nc = (middle.N0 + middle.N1) / 2, half = (middle.N1 - middle.N0) / 2;
      const top = EAVE + half * middle.pitch, low = EAVE - oh * middle.pitch;
      // where the middle planes meet the side gables (west gable falls to the east, east gable to the west)
      const xW = (h) => west.X1 + (EAVE - h) / west.pitch, xE = (h) => east.X0 - (EAVE - h) / east.pitch;
      const S = middle.N0 - oh, Nn = middle.N1 + oh;
      slab('roof', [[xW(low), S, low], [xE(low), S, low], [xE(top), Nc, top], [xW(top), Nc, top]], T);
      slab('roof', [[xW(top), Nc, top], [xE(top), Nc, top], [xE(low), Nn, low], [xW(low), Nn, low]], T);
      wedge('attic', 'x', middle.X0, middle.X1, [[middle.N0, EAVE], [middle.N1, EAVE], [Nc, top - T * 1.6]]);
    }

    // the porch roof over the whole deck, 3/12, with the open light well in front of the foyer
    const ph = (N) => porch.top + porch.pitch * N;
    slab('roof', [[porch.X0, 0, ph(0)], [porch.X1, 0, ph(0)], [porch.X1, porch.N, ph(porch.N)], [porch.X0, porch.N, ph(porch.N)]], T);
    const [w0, w1] = porch.well;
    for (const [a, b] of [[west.X1, w0], [w1, east.X0]]) slab('roof', [[a, 0, ph(0)], [b, 0, ph(0)], [b, 5.0, ph(5.0)], [a, 5.0, ph(5.0)]], T);

    // the grilling-area gable, 4/12, its ridge running north into the porch roof
    {
      const Xc = (grill.X0 + grill.X1) / 2;
      const top = grill.eave + ((grill.X1 - grill.X0) / 2) * grill.pitch;
      const Nr = (top - porch.top) / porch.pitch, Ne = (grill.eave - porch.top) / porch.pitch; // where ridge and eave meet the porch roof
      slab('roof', [[grill.X0, grill.N, grill.eave], [Xc, grill.N, top], [Xc, Nr, top], [grill.X0, Ne, grill.eave]], T * 0.7);
      slab('roof', [[grill.X1, grill.N, grill.eave], [grill.X1, Ne, grill.eave], [Xc, Nr, top], [Xc, grill.N, top]], T * 0.7);
    }
  }

  // A planar polygon [X, N, h] in feet, made into a closed slab t feet thick (dropped straight down).
  function slab(key, pts, t, trimKey = 'white') {
    const P = (X, N, h) => new THREE.Vector3(X * FT, h * FT, -N * FT);
    const top = pts.map((p) => P(p[0], p[1], p[2]));
    const bot = pts.map((p) => P(p[0], p[1], p[2] - t));
    const c = new THREE.Vector3();
    [...top, ...bot].forEach((v) => c.add(v));
    c.multiplyScalar(1 / (top.length * 2));
    // the top is roofing; the underside and edges are the light soffit and fascia (A3.x soffit note)
    const roof = [], trim = [];
    for (let i = 1; i < top.length - 1; i++) {
      roof.push([top[0], top[i], top[i + 1]]);
      trim.push([bot[0], bot[i + 1], bot[i]]);
    }
    for (let i = 0; i < top.length; i++) {
      const j = (i + 1) % top.length;
      trim.push([top[i], bot[i], bot[j]], [top[i], bot[j], top[j]]);
    }
    closedMesh(key, roof, c);
    closedMesh(trimKey, trim, c);
  }

  // A prism: a cross-section [[u, h], ...] (u = X when axis 'n', u = N when axis 'x'),
  // run from a to b along the other plan axis.
  function wedge(key, axis, a, b, sec) {
    const P = (u, h, v) => (axis === 'n' ? new THREE.Vector3(u * FT, h * FT, -v * FT) : new THREE.Vector3(v * FT, h * FT, -u * FT));
    const A = sec.map(([u, h]) => P(u, h, a)), B = sec.map(([u, h]) => P(u, h, b));
    const c = new THREE.Vector3();
    [...A, ...B].forEach((v) => c.add(v));
    c.multiplyScalar(1 / (A.length * 2));
    const tris = [];
    for (let i = 1; i < A.length - 1; i++) tris.push([A[0], A[i], A[i + 1]], [B[0], B[i + 1], B[i]]);
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      tris.push([A[i], B[i], B[j]], [A[i], B[j], A[j]]);
    }
    closedMesh(key, tris, c);
  }

  // Triangles of a convex solid, each turned to face away from its centre, so the
  // ink shader sees the outside as front faces and the cut inside as back faces.
  function closedMesh(key, tris, centre) {
    const pos = [];
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
    for (const [p, q, r] of tris) {
      e1.subVectors(q, p); e2.subVectors(r, p); n.crossVectors(e1, e2);
      if (n.lengthSq() < 1e-14) continue;
      m.copy(p).add(q).add(r).multiplyScalar(1 / 3).sub(centre);
      const tri = n.dot(m) < 0 ? [p, r, q] : [p, q, r];
      for (const v of tri) pos.push(v.x, v.y, v.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.computeVertexNormals();
    put(key, g);
    addEdges(g);
  }

  // ---- helpers ---------------------------------------------------------------------
  // a three-seat sofa: plinth, three seat cushions, three back cushions, low arms
  function sofa(X, N, w, d, deg, y = 0) {
    const o = { deg, cx: X, cn: N };
    const x0 = X - w / 2, n0 = N - d / 2;
    soft('walnut', x0 + 0.15, n0 + 0.15, x0 + w - 0.15, n0 + d - 0.15, y, y + 0.35, 0.05, o); // plinth
    const arm = 0.55, sw = (w - 2 * arm) / 3;
    for (let i = 0; i < 3; i++) {
      soft('fabric', x0 + arm + i * sw + 0.03, n0 + 0.1, x0 + arm + (i + 1) * sw - 0.03, n0 + d - 0.75, y + 0.35, y + 1.45, 0.22, o);
      soft('fabric', x0 + arm + i * sw + 0.05, n0 + d - 0.85, x0 + arm + (i + 1) * sw - 0.05, n0 + d - 0.1, y + 1.2, y + 2.65, 0.25, o);
    }
    soft('fabric', x0, n0 + 0.05, x0 + arm, n0 + d, y + 0.35, y + 2.1, 0.2, o);
    soft('fabric', x0 + w - arm, n0 + 0.05, x0 + w, n0 + d, y + 0.35, y + 2.1, 0.2, o);
  }
  // an L sectional: a long run along the back, open to the front
  function sectional(X0, N0, X1, N1, y, deg = 0) {
    sofa((X0 + X1) / 2, (N0 + N1) / 2, X1 - X0, N1 - N0, deg, y);
  }
  // a queen bed: base, mattress, duvet, two pillows, upholstered headboard. deg 0 = headboard north
  function bed(X, N, y, deg) {
    const o = { deg, cx: X, cn: N };
    soft('walnut', X - 2.75, N - 3.6, X + 2.75, N + 3.4, y, y + 1.0, 0.08, o);
    soft('white', X - 2.6, N - 3.45, X + 2.6, N + 3.25, y + 1.0, y + 1.8, 0.2, o);
    soft('linen', X - 2.72, N - 3.57, X + 2.72, N + 1.7, y + 1.62, y + 2.02, 0.18, o); // the duvet
    soft('throw', X - 2.78, N - 3.62, X + 2.78, N - 1.9, y + 1.95, y + 2.12, 0.08, o); // a throw across the foot
    soft('rug', X - 4.2, N - 5.6, X + 4.2, N + 3.3, y, y + 0.04, 0.02, { ...o, lines: false }); // the rug under the bed
    soft('white', X - 2.2, N + 1.9, X - 0.2, N + 3.0, y + 1.8, y + 2.35, 0.2, o);
    soft('white', X + 0.2, N + 1.9, X + 2.2, N + 3.0, y + 1.8, y + 2.35, 0.2, o);
    soft('fabric', X - 3.0, N + 3.4, X + 3.0, N + 3.85, y, y + 4.2, 0.18, o); // headboard
    soft('walnut', X - 4.5, N + 2.1, X - 3.2, N + 3.5, y, y + 2.0, 0.05, o); // bedside tables, each with a lamp
    soft('walnut', X + 3.2, N + 2.1, X + 4.5, N + 3.5, y, y + 2.0, 0.05, o);
    for (const dx of [-3.85, 3.85]) {
      const [lx, ln] = rotP(X + dx, N + 2.8, X, N, deg);
      cyl('brass', lx, ln, 0.05, 0.05, y + 2.0, y + 3.0, 6, { lines: false });
      cyl('fabric', lx, ln, 0.45, 0.32, y + 2.9, y + 3.6, 16);
    }
  }
  function rotP(x, n, cx, cn, deg) {
    const a = (deg * Math.PI) / 180, dx = x - cx, dn = n - cn;
    return [cx + dx * Math.cos(a) - dn * Math.sin(a), cn + dx * Math.sin(a) + dn * Math.cos(a)];
  }
  // a leather lounge chair on slim legs; deg turns it about its centre (0 = facing south)
  function armchair(X, N, deg) {
    const o = { deg, cx: X, cn: N };
    soft('leather', X - 1.05, N - 1.05, X + 1.05, N + 0.75, 0.45, 1.35, 0.2, o); // seat
    soft('leather', X - 1.35, N + 0.7, X + 1.35, N + 1.3, 0.45, 2.7, 0.22, o); // back
    soft('leather', X - 1.4, N - 1.1, X - 1.0, N + 1.2, 0.45, 2.0, 0.15, o); // arms
    soft('leather', X + 1.0, N - 1.1, X + 1.4, N + 1.2, 0.45, 2.0, 0.15, o);
    for (const [dx, dn] of [[-1.2, -0.95], [1.2, -0.95], [-1.2, 1.1], [1.2, 1.1]]) {
      const [x, n] = rotP(X + dx, N + dn, X, N, deg);
      cyl('black', x, n, 0.06, 0.06, 0, 0.45, 8, { lines: false });
    }
  }
  // a dining chair: upholstered seat, curved walnut back, slim legs
  function chair(X, N, deg) {
    const o = { deg, cx: X, cn: N };
    soft('fabric', X - 0.75, N - 0.6, X + 0.75, N + 0.75, 1.35, 1.6, 0.1, o);
    soft('walnut', X - 0.72, N - 0.78, X + 0.72, N - 0.6, 1.9, 2.9, 0.08, o);
    for (const [dx, dn] of [[-0.62, -0.68], [0.62, -0.68], [-0.62, 0.62], [0.62, 0.62]]) {
      const [x, n] = rotP(X + dx, N + dn, X, N, deg);
      cyl('walnut', x, n, 0.06, 0.05, 0, dn < 0 ? 2.9 : 1.4, 8, { lines: false });
    }
  }
  function stool(X, N) {
    cyl('walnut', X, N, 0.6, 0.6, 2.25, 2.4, 16);
    cyl('black', X, N, 0.06, 0.06, 0, 2.25, 6, { lines: false });
  }
  function lamp(X, N, y) {
    cyl('brass', X, N, 0.05, 0.05, y, y + 1.3, 6, { lines: false });
    cyl('fabric', X, N, 0.7, 0.45, y + 1.2, y + 2.2, 20);
  }
  function car(X, N) {
    box('car', X - 7.8, N - 3.0, X + 7.8, N + 3.0, 0.7, 2.6);
    box('car', X - 3.6, N - 2.6, X + 3.4, N + 2.6, 2.6, 4.4);
    for (const dx of [-5, 5]) for (const dn of [-2.7, 2.7]) cyl('black', X + dx, N + dn, 1.1, 1.1, 0, 0.8, 12, { lines: false });
  }
  // roughen a leaf mass: push its surface in and out with a smooth positional noise (so shared
  // corners move together and nothing cracks), and shade it lighter on top, darker beneath
  function leafy(g, rnd, amp = 0.16) {
    const p = g.attributes.position;
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3()), h = g.boundingBox.max.y - g.boundingBox.min.y;
    const k = 4.0 + rnd() * 3, ph = rnd() * 10, tone = 0.82 + rnd() * 0.3;
    const col = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).sub(c);
      const n = Math.sin(v.x * k + ph) * Math.sin(v.y * k * 1.3 + ph * 0.7) * Math.sin(v.z * k * 0.9 + ph * 1.3);
      v.multiplyScalar(1 + amp * n);
      p.setXYZ(i, v.x + c.x, v.y + c.y, v.z + c.z);
      const up = 0.78 + 0.4 * ((v.y / (h || 1)) + 0.5);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.min(1.25, up * tone * (0.92 + 0.16 * n));
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
  }
  function tree(t) {
    let s = t.seed * 9301;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const G = groundH(t.X, t.N);
    if (t.seed % 3 === 0) {
      // a conifer: a slim trunk and stacked, slightly irregular cones
      cyl('bark', t.X, t.N, 0.7, 0.4, G, G + t.h * 0.3, 8, { lines: false });
      for (let k = 0; k < 5; k++) {
        const y0 = G + t.h * (0.18 + k * 0.16), r = t.r * (0.85 - k * 0.15) * (0.9 + 0.2 * rnd());
        const g = new THREE.ConeGeometry(r * FT, t.h * 0.3 * FT, 9);
        g.translate((t.X + (rnd() - 0.5) * 0.8) * FT, (y0 + t.h * 0.15) * FT, -t.N * FT);
        leafy(g.toNonIndexed ? g : g, rnd, 0.08);
        put(k % 2 ? 'leaf' : 'leaf2', g);
      }
      return;
    }
    cyl('bark', t.X, t.N, 0.9, 0.55, G, G + t.h * 0.55, 10, { lines: false });
    // a few limbs reaching up into the crown
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + rnd(), len = t.h * 0.32;
      const g = new THREE.CylinderGeometry(0.18 * FT, 0.32 * FT, len * FT, 6);
      g.translate(0, (len / 2) * FT, 0);
      g.rotateZ(0.55); g.rotateY(a);
      g.translate(t.X * FT, (G + t.h * 0.45) * FT, -t.N * FT);
      put('bark', g);
    }
    // a deciduous crown: many small, lumpy leaf masses with light and dark variation
    const n = 34;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd();
      const rr = t.r * (0.45 + 0.25 * rnd());
      const g = new THREE.IcosahedronGeometry(rr * FT * 0.62, 2);
      g.scale(1, 0.85, 1);
      leafy(g, rnd);
      const off = i === 0 ? 0 : t.r * (0.35 + 0.45 * rnd());
      const y = G + t.h * (0.6 + 0.25 * rnd());
      g.translate((t.X + Math.cos(a) * off) * FT, y * FT, -(t.N + Math.sin(a) * off) * FT);
      put(i % 2 ? 'leaf' : 'leaf2', g);
      if (i < 7) { // the crown's outline, for the drawing
        const e = new THREE.EdgesGeometry(g, 40);
        treeEdges.push(...e.attributes.position.array);
        e.dispose();
      }
    }
  }
}
