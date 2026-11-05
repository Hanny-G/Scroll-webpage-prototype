// The building, made of boxes.
//
// Every solid is a closed box. Seen through the cut, a box shows its own
// inside faces, and the ink shader paints those black: that is the poché of
// the plan. Boxes that share a material are merged into one mesh, and every
// box also contributes its outline to one set of ink lines.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  FT, WALLS, CEIL, SLAB_TOP, LAWN, DECK, DOOR_H, SILL, SWINGS, RISE, DECKS, RAIL_POSTS, TREES, HOUSE,
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
  for (const w of WALLS) {
    const seg = (a, b, y0, y1, key = 'wall') => {
      if (b - a < 1e-3) return;
      if (w.ax === 'x') box(key, a, w.c - w.t / 2, b, w.c + w.t / 2, y0, y1);
      else box(key, w.c - w.t / 2, a, w.c + w.t / 2, b, y0, y1);
    };
    const ops = [...w.ops].sort((p, q) => p.a - q.a);
    let at = w.a;
    for (const o of ops) {
      seg(at, o.a, 0, CEIL);
      if (o.k === 'door') seg(o.a, o.b, DOOR_H, CEIL);
      if (o.k === 'open') seg(o.a, o.b, o.h ?? 8, CEIL);
      if (o.k === 'slider') {
        seg(o.a, o.b, DOOR_H, CEIL);
        // two glass leaves, one slid open, with thin black frames
        const mid = (o.a + o.b) / 2;
        glassPane(w, o.a + 0.1, mid + 0.4, 0.05, DOOR_H - 0.05, -0.06);
        glassPane(w, mid + 0.4, o.b - 0.1, 0.05, DOOR_H - 0.05, 0.06);
      }
      if (o.k === 'window') {
        const sill = o.sill ?? SILL;
        seg(o.a, o.b, 0, sill);
        seg(o.a, o.b, DOOR_H, CEIL);
        glassPane(w, o.a, o.b, sill, DOOR_H, 0);
      }
      if (o.k === 'garage') {
        seg(o.a, o.b, 7.5, CEIL);
        if (w.ax === 'n') box('garage', w.c - 0.08, o.a, w.c + 0.08, o.b, 0, 7.5);
      }
      at = o.b;
    }
    seg(at, w.b, 0, CEIL);
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
  box('oak', 0.5, 0.5, 16.1, 31.75, F, 0, { lines: false }); // great room, mud room
  box('oak', 16.1, 5.0, 30.25, 21.95, F, 0, { lines: false }); // foyer
  box('oak', 30.25, 0.5, 55.6, 31.75, F, 0, { lines: false }); // east block
  box('concrete', 0.5, 32.25, 22.5, 55.25, F - 0.1, -0.1, { lines: false }); // garage slab
  // foundation under everything, walk-out on the south
  for (const h of HOUSE) box('stone', h[0], h[1], h[2], h[3], LAWN, -0.2, { lines: false });
  // ceilings and the roof slab
  const roofParts = [[0, 0, 16.6, 32.25], [16.6, 5.0, 29.75, 21.95], [29.75, 0, 56.1, 32.25], [0, 32.0, 23.0, 55.75]];
  for (const r of roofParts) {
    box('ceiling', r[0], r[1], r[2], r[3], CEIL, CEIL + 0.05, { lines: false });
    box('roof', r[0] - 0.6, r[1] - 0.6, r[2] + 0.6, r[3] + 0.6, CEIL + 0.05, SLAB_TOP, { lines: false });
  }
  // a roof over the covered deck, on two posts
  box('roof', 16.6, 21.7, 29.75, 32.6, CEIL + 0.05, SLAB_TOP - 0.3, { lines: false });
  box('black', 28.9, 31.2, 29.5, 31.8, DECK, CEIL, { lines: true });
  box('black', 28.9, 22.0, 29.5, 22.6, DECK, CEIL, { lines: true });

  // basement walk-out openings below the deck (W1 · D1 · W1 on the basement plan)
  for (const [a, b, top] of [[1.5, 4.5, -2.4], [6.0, 12.0, -0.9], [13.0, 15.5, -2.4], [33, 36, -2.4], [40, 46, -0.9], [50, 53, -2.4]]) {
    box('black', a, -0.04, b, 0.02, LAWN + (top < -1 ? 2.2 : 0.2), top - 0.4, { lines: false });
  }

  // ---- the deck ----------------------------------------------------------------
  const deckBox = (b, key = 'deck') => {
    box(key, b[0], b[1], b[2], b[3], DECK - 0.15, DECK, { lines: true });
    box('black', b[0], b[1], b[2], b[3], DECK - 1.1, DECK - 0.15, { lines: false }); // joists
  };
  deckBox(DECKS.main);
  deckBox(DECKS.notch);
  deckBox(DECKS.grill);
  box('deck', ...DECKS.covered.slice(0, 2), ...DECKS.covered.slice(2), DECK - 0.15, DECK, { lines: false });
  // posts under the deck
  for (const X of [0.4, 8, 16, 24, 32, 40, 47.9]) box('black', X - 0.25, -11.6, X + 0.25, -11.1, LAWN, DECK - 1.1);
  for (const X of [48.6, 55.4]) box('black', X - 0.25, -17.6, X + 0.25, -17.1, LAWN, DECK - 1.1);

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
  for (const [X, N] of [[48.3, -17.83], [52, -17.83], [55.8, -17.83], [55.8, -14.8], [55.8, -11.83], [55.8, -6], [55.8, 0]]) posts.push([X, N]);
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
  rail(48.3, -17.83, 55.8, -17.83);
  rail(55.8, -17.83, 55.8, 0);
  rail(0, -11.83, 0, 0);

  // ---- stairs inside -------------------------------------------------------------
  // great room L stair: treads 1-8 west along the top, 9-17 south down the west wall
  const tread = (X0, N0, X1, N1, k) => box('oak', X0, N0, X1, N1, k * RISE - 0.15, k * RISE);
  for (let k = 1; k <= 8; k++) {
    const X1 = 11.4 - (k - 1) * 0.925, X0 = X1 - 0.925;
    tread(X0, 21.4, X1, 25.05, k);
    box('white', X1 - 0.05, 21.4, X1, 25.05, (k - 1) * RISE, k * RISE, { lines: false }); // riser
  }
  box('oak', 0.5, 21.4, 4.0, 25.05, 8 * RISE - 0.15, 8 * RISE); // corner landing
  for (let k = 9; k <= 17; k++) {
    const N1 = 21.4 - (k - 9) * 0.93, N0 = N1 - 0.93;
    tread(0.5, N0, 4.0, N1, k);
  }
  // east stair: up, straight north
  for (let k = 1; k <= 18; k++) {
    const N0 = 10.6 + (k - 1) * 0.6;
    if (N0 > 21.3) break;
    box('oak', 31.0, N0, 34.55, N0 + 0.6, k * RISE - 0.15, k * RISE);
  }
  // east stair: down to the basement, drawn as treads stepping into the floor
  for (let k = 0; k < 9; k++) addLine(34.95, 20.9 - k * 0.92, 38.4, 20.9 - k * 0.92, 0.02);

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
  // drum bottom at 7'-8": above the 5'-2" eye line, so it doesn't block the view in
  cyl('brass', 23.2, 13.0, 1.1, 0.2, 7.75, 8.25, 24);
  cyl('lamp', 23.2, 13.0, 1.0, 1.0, 7.65, 7.75, 24, { lines: false });
  cyl('black', 23.2, 13.0, 0.03, 0.03, 8.25, CEIL, 6, { lines: false });

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
  box('cabinet', 46.4, 3.75, 50.1, 9.45, 0, 3.0);
  box('marble', 46.25, 3.6, 50.25, 9.6, 3.0, 3.15);
  for (const N of [4.8, 6.6, 8.4]) stool(45.4, N);
  box('cabinet', 53.6, 0.6, 55.6, 13.0, 0, 3.0);
  box('marble', 53.45, 0.5, 55.6, 13.15, 3.0, 3.15);
  box('cabinet', 46.6, 13.0, 55.6, 14.85, 0, 3.0);
  box('marble', 46.6, 12.85, 55.6, 14.85, 3.0, 3.15);
  box('cabinet', 47.5, 13.65, 55.6, 14.85, 4.6, 7.6);
  box('black', 49.6, 13.4, 52.2, 14.85, 3.15, 3.3); // cooktop
  box('marble', 46.6, 13.6, 55.6, 14.85, 3.15, 4.6, { lines: false }); // backsplash
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
  // bathroom: double vanity, toilet, shower
  box('white', 46.8, 26.0, 48.6, 31.5, 0, 2.9);
  box('white', 52.6, 27.4, 54.4, 29.6, 0, 1.4);
  box('glass', 51.2, 21.0, 51.3, 26.0, 0, 7, { lines: true });
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
