// The building, made of boxes.
//
// Every solid is a closed box. Seen through the cut, a box shows its own
// inside faces, and the ink shader paints those black: that is the poché of
// the plan. Boxes that share a material are merged into one mesh, and every
// box also contributes its outline to one set of ink lines.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  FT, WALLS, WALLS_UP, ROOFS, CEIL, F2, EAVE, LAWN, DECK, DOOR_H, SILL, OPEN_H, SWINGS, BARN, RISE, DECKS,
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
  function cyl(key, X, N, r0, r1, y0, y1, seg = 24, { lines = true } = {}) {
    const g = new THREE.CylinderGeometry(r1 * FT, r0 * FT, (y1 - y0) * FT, seg);
    g.translate(X * FT, ((y0 + y1) / 2) * FT, -N * FT);
    put(key, g);
    if (lines) addEdges(g, 30);
  }

  // ---- walls -----------------------------------------------------------------
  for (const w of [...WALLS, ...WALLS_UP]) {
    const Y0 = w.y0 ?? 0, Y1 = w.y1 ?? CEIL;
    const seg = (a, b, y0, y1, key = 'wall') => {
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
        if (w.ax === 'n') box('garage', w.c - 0.08, o.a, w.c + 0.08, o.b, 0, 7.0);
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
    } else {
      box('glass', w.c + off - t, a, w.c + off + t, b, y0, y1, { lines: false });
      addLine(w.c + off, a, w.c + off, b, y0);
      box('black', w.c + off - 0.09, a, w.c + off + 0.09, a + 0.12, y0, y1, { lines: false });
      box('black', w.c + off - 0.09, b - 0.12, w.c + off + 0.09, b, y0, y1, { lines: false });
    }
  }
  function addLine(X0, N0, X1, N1, y) {
    edges.push(X0 * FT, y * FT, -N0 * FT, X1 * FT, y * FT, -N1 * FT);
  }

  // ---- floors, ceilings, roof, foundation --------------------------------------
  const F = -0.02; // floor finish sits on y = 0
  box('oak', 0.46, 0.46, 16.21, 31.77, F, 0, { lines: false }); // great room, stair hall, mud room
  box('oak', 16.21, 5.0, 30.26, 22.0, F, 0, { lines: false }); // foyer
  box('oak', 30.26, 0.46, 55.67, 31.87, F, 0, { lines: false }); // east block
  box('concrete', 0.46, 32.23, 22.55, 55.31, F - 0.1, -0.1, { lines: false }); // garage slab
  // foundation (S1.1): a basement under the east block, crawl spaces under the rest
  for (const h of HOUSE) box('concrete', h[0], h[1], h[2], h[3], LAWN, -0.2, { lines: false });
  box('concrete', 29.8, 32.33, 56.13, 32.87, LAWN, 0.4, { lines: false }); // retaining wall / reverse brick drop
  // ceilings, and the floor band between the storeys (the second floor sits on it)
  for (const r of HOUSE) box('ceiling', r[0], r[1], r[2], r[3], CEIL, CEIL + 0.05, { lines: false });
  for (const r of HOUSE.slice(0, 3)) box('wall', r[0], r[1], r[2], r[3], CEIL + 0.05, F2, { lines: false });

  // basement walk-out under the dining room (W1 · D1 · W1 on the basement plan)
  for (const [a, b, top] of [[32.6, 35.4, -2.4], [39.7, 45.7, -0.9], [50.4, 53.2, -2.4]]) {
    box('black', a, -0.04, b, 0.02, LAWN + (top < -1 ? 2.2 : 0.2), top - 0.4, { lines: false });
  }

  // ---- roofs (A3.1, A3.2) ---------------------------------------------------------
  buildRoofs();

  // ---- the deck ----------------------------------------------------------------
  const deckBox = (b, key = 'deck') => {
    box(key, b[0], b[1], b[2], b[3], DECK - 0.15, DECK, { lines: true });
    box('black', b[0], b[1], b[2], b[3], DECK - 1.1, DECK - 0.15, { lines: false }); // joists
  };
  deckBox(DECKS.main);
  deckBox(DECKS.notch);
  deckBox(DECKS.grill);
  box('deck', ...DECKS.north.slice(0, 2), ...DECKS.north.slice(2), DECK - 0.15, DECK, { lines: false });
  // posts under the deck, on the sonotubes
  for (const X of [0.4, 8, 16, 23, 30, 37.5, 47.9, 55.6]) box('black', X - 0.25, -11.6, X + 0.25, -11.1, LAWN, DECK - 1.1);
  for (const X of [48.6, 55.6]) box('black', X - 0.25, -17.6, X + 0.25, -17.1, LAWN, DECK - 1.1);
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
  }
  box('oak', 31.02, 17.64, 38.34, 21.36, 9 * RISE - 0.15, 9 * RISE); // landing
  box('white', 31.02, 17.64, 38.34, 21.36, 9 * RISE - 0.8, 9 * RISE - 0.15, { lines: false });
  // ... then back south over the stair down to the basement
  for (let k = 10; k <= 17; k++) {
    const N1 = 17.64 - (k - 10) * 0.833, N0 = N1 - 0.833;
    tread(34.84, N0, 38.34, N1, k);
    box('white', 34.84, N0, 38.34, N1, k * RISE - 0.8, k * RISE - 0.15, { lines: false }); // soffit
  }
  // east stair: down to the basement, heading north, drawn as treads stepping into the floor
  for (let k = 0; k < 9; k++) addLine(34.84, 11.0 + k * 0.83, 38.34, 11.0 + k * 0.83, 0.02);

  // ---- furniture -----------------------------------------------------------------
  // great room: sofa with its back to the stair, two armchairs, coffee table, rug
  box('rug', 3.0, 1.5, 14.2, 9.4, 0, 0.04, { lines: true });
  sofa(8.4, 7.0, 7.4, 3.0, 0);
  armchair(3.6, 3.4, 90);
  armchair(13.4, 3.4, -90);
  cyl('walnut', 8.5, 3.6, 1.6, 1.6, 0.04, 1.35, 32); // round coffee table
  cyl('walnut', 3.4, 7.2, 0.9, 0.9, 0, 1.9, 20); // side tables
  cyl('walnut', 13.6, 7.2, 0.9, 0.9, 0, 1.9, 20);
  lamp(3.4, 7.2, 1.9);
  lamp(13.6, 7.2, 1.9);
  // a media console against the west wall
  box('walnut', 0.5, 4.0, 2.0, 10.0, 0, 1.8);

  // foyer: a round rug, a console, a big pendant
  cyl('rug', 23.2, 13.0, 4.2, 4.2, 0, 0.04, 48);
  box('walnut', 17.0, 14.5, 18.4, 19.5, 0, 2.7);
  // a close-to-ceiling drum under the 8'-0" ceiling, well above the 5'-2" eye line
  cyl('brass', 23.2, 13.0, 1.1, 0.25, 7.45, 7.85, 24);
  cyl('lamp', 23.2, 13.0, 1.0, 1.0, 7.38, 7.45, 24, { lines: false });
  cyl('black', 23.2, 13.0, 0.03, 0.03, 7.85, CEIL, 6, { lines: false });

  // dining: an 8' table with eight chairs
  box('walnut', 33.95, 3.65, 41.95, 7.15, 2.35, 2.5);
  for (const [X, N] of [[34.6, 3.95], [41.3, 3.95], [34.6, 6.85], [41.3, 6.85]]) box('black', X - 0.12, N - 0.12, X + 0.12, N + 0.12, 0, 2.35, { lines: false });
  for (const X of [35.4, 37.95, 40.5]) {
    chair(X, 2.6, 0);
    chair(X, 8.2, 180);
  }
  chair(32.8, 5.4, -90);
  chair(43.1, 5.4, 90);
  // pendant over the table
  for (const X of [36.0, 39.9]) {
    cyl('black', X, 5.4, 0.9, 0.2, 6.2, 6.9, 20);
    cyl('lamp', X, 5.4, 0.8, 0.8, 6.15, 6.2, 20, { lines: false });
    cyl('black', X, 5.4, 0.02, 0.02, 6.9, CEIL, 6, { lines: false });
  }

  // kitchen: island, L-shaped run with cabinets, uppers on the north wall
  // island table 6'-0" x 4'-0" with a 12" overhang on the west for stools
  box('cabinet', 47.2, 3.85, 50.1, 9.6, 0, 3.0);
  box('marble', 46.2, 3.73, 50.2, 9.73, 3.0, 3.15);
  for (const N of [4.9, 6.73, 8.55]) stool(45.6, N);
  box('cabinet', 53.6, 0.46, 55.67, 13.0, 0, 3.0);
  box('marble', 53.45, 0.46, 55.67, 13.15, 3.0, 3.15);
  box('cabinet', 46.8, 13.0, 55.67, 15.04, 0, 3.0);
  box('marble', 46.8, 12.85, 55.67, 15.04, 3.0, 3.15);
  box('cabinet', 47.5, 13.8, 55.67, 15.04, 4.6, 7.6);
  box('black', 49.6, 13.4, 52.2, 15.0, 3.15, 3.3); // cooktop
  box('marble', 46.8, 13.75, 55.67, 15.04, 3.15, 4.6, { lines: false }); // backsplash
  for (const N of [5.0, 6.6, 8.2]) {
    cyl('lamp', 48.25, N, 0.42, 0.42, 6.0, 6.7, 16, { lines: false });
    cyl('black', 48.25, N, 0.02, 0.02, 6.7, CEIL, 6, { lines: false });
  }
  // counter with cabinets along the stair wall
  box('cabinet', 38.75, 12.5, 40.9, 20.9, 0, 3.0);
  box('marble', 38.75, 12.4, 41.05, 20.9, 3.0, 3.15);

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
  // mud room bench, garage cars
  box('walnut', 0.5, 29.8, 2.0, 31.7, 0, 1.5);
  car(11.8, 48.6);
  car(11.8, 39.8);
  // deck furniture: a lounge set and a grill
  box('fabric', 4.0, -9.8, 12.0, -7.4, DECK, DECK + 2.6);
  box('fabric', 4.0, -7.4, 6.2, -2.6, DECK, DECK + 2.6);
  cyl('walnut', 9.0, -4.6, 1.8, 1.8, DECK, DECK + 1.3, 28);
  for (const X of [36.0, 42.0]) { box('fabric', X - 1.3, -9.6, X + 1.3, -7.2, DECK, DECK + 2.4); }
  cyl('stone', 39.0, -4.6, 2.2, 2.2, DECK, DECK + 1.25, 32);
  box('black', 50.4, -17.2, 53.6, -15.4, DECK, DECK + 3.0);

  // ---- swing doors, drawn open -------------------------------------------------------
  const arcs = [];
  for (const s of SWINGS) {
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

  return { group, edges, cables, arcs, treeEdges };

  // ---- roofs ------------------------------------------------------------------------
  // Every roof plane is a solid slab, 0.5 ft thick, so it casts shadows and closes
  // the model. Attics under the gables are solid wedges in the wall material, so
  // their gable ends read as siding.
  function buildRoofs() {
    const { oh, west, east, middle, garage, porch, grill } = ROOFS;
    const T = 0.5;
    // a gable with its ridge running north-south
    const gableNS = (r, eave, { south = true, north = true, wedgeBase = eave } = {}) => {
      const Xc = (r.X0 + r.X1) / 2, half = (r.X1 - r.X0) / 2;
      const top = eave + half * r.pitch, low = eave - oh * r.pitch;
      const N0 = r.N0 - (south ? oh : 0), N1 = r.N1 + (north ? oh : 0);
      slab('roof', [[r.X0 - oh, N0, low], [Xc, N0, top], [Xc, N1, top], [r.X0 - oh, N1, low]], T);
      slab('roof', [[r.X1 + oh, N0, low], [r.X1 + oh, N1, low], [Xc, N1, top], [Xc, N0, top]], T);
      wedge('wall', 'n', r.N0, r.N1, [[r.X0, wedgeBase], [r.X1, wedgeBase], [r.X1, eave], [Xc, top - T * 1.6], [r.X0, eave]]);
      return top;
    };
    gableNS(west, EAVE);
    gableNS(east, EAVE);
    gableNS(garage, garage.eave, { south: false, wedgeBase: CEIL });

    // the middle block: 8/12 east-west, its ridge dying into both 12/12 gables (the hexagon on A3.2)
    {
      const Nc = (middle.N0 + middle.N1) / 2, half = (middle.N1 - middle.N0) / 2;
      const top = EAVE + half * middle.pitch, low = EAVE - oh * middle.pitch;
      // where the middle planes meet the side gables (west gable falls to the east, east gable to the west)
      const xW = (h) => west.X1 + (EAVE - h) / west.pitch, xE = (h) => east.X0 - (EAVE - h) / east.pitch;
      const S = middle.N0 - oh, Nn = middle.N1 + oh;
      slab('roof', [[xW(low), S, low], [xE(low), S, low], [xE(top), Nc, top], [xW(top), Nc, top]], T);
      slab('roof', [[xW(top), Nc, top], [xE(top), Nc, top], [xE(low), Nn, low], [xW(low), Nn, low]], T);
      wedge('wall', 'x', middle.X0, middle.X1, [[middle.N0, EAVE], [middle.N1, EAVE], [Nc, top - T * 1.6]]);
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
  function slab(key, pts, t) {
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
    closedMesh('white', trim, c);
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
  function sofa(X, N, w, d, deg) {
    const r = (dx, dn, ww, dd, y0, y1, key = 'fabric') => {
      const a = (deg * Math.PI) / 180;
      const x = X + dx * Math.cos(a) - dn * Math.sin(a), n = N + dx * Math.sin(a) + dn * Math.cos(a);
      rbox(key, x, n, ww, dd, y0, y1, deg);
    };
    r(0, 0, w - 1.0, d - 0.8, 0.4, 1.45); // seat
    r(0, (d - 0.8) / 2 + 0.2, w, 0.8, 0.4, 2.8); // back (towards +N before rotation)
    r(-(w - 0.5) / 2, -0.2, 0.5, d - 0.4, 0.4, 2.1);
    r((w - 0.5) / 2, -0.2, 0.5, d - 0.4, 0.4, 2.1);
    r(0, 0, w, d, 0, 0.4, 'black');
  }
  function armchair(X, N, deg) {
    const a = (deg * Math.PI) / 180;
    const p = (dx, dn) => [X + dx * Math.cos(a) - dn * Math.sin(a), N + dx * Math.sin(a) + dn * Math.cos(a)];
    rbox('leather', ...p(0, 0), 2.2, 2.1, 0.4, 1.4, deg);
    rbox('leather', ...p(0, 1.15), 2.8, 0.5, 0.4, 2.6, deg);
    rbox('leather', ...p(-1.2, 0), 0.4, 2.5, 0.4, 2.0, deg);
    rbox('leather', ...p(1.2, 0), 0.4, 2.5, 0.4, 2.0, deg);
    rbox('black', ...p(0, 0.1), 2.8, 2.5, 0, 0.4, deg);
  }
  function chair(X, N, deg) {
    const a = (deg * Math.PI) / 180;
    const p = (dx, dn) => [X + dx * Math.cos(a) - dn * Math.sin(a), N + dx * Math.sin(a) + dn * Math.cos(a)];
    rbox('fabric', ...p(0, 0), 1.5, 1.5, 1.4, 1.6, deg);
    rbox('walnut', ...p(0, -0.68), 1.5, 0.14, 1.6, 3.0, deg);
    for (const [dx, dn] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) rbox('walnut', ...p(dx, dn), 0.12, 0.12, 0, 1.4, deg, { lines: false });
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
  function tree(t) {
    let s = t.seed * 9301;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    cyl('bark', t.X, t.N, 0.9, 0.55, LAWN, LAWN + t.h * 0.55, 10, { lines: false });
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd();
      const rr = t.r * (0.45 + 0.25 * rnd());
      const g = new THREE.IcosahedronGeometry(rr * FT, 1);
      g.scale(1, 0.8, 1);
      const off = i === 0 ? 0 : t.r * 0.5;
      const y = LAWN + t.h * (0.6 + 0.25 * rnd());
      g.translate((t.X + Math.cos(a) * off) * FT, y * FT, -(t.N + Math.sin(a) * off) * FT);
      put(i % 2 ? 'leaf' : 'leaf2', g);
      const e = new THREE.EdgesGeometry(g, 32);
      treeEdges.push(...e.attributes.position.array);
      e.dispose();
    }
  }
}
