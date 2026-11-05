// The house, as numbers.
//
// Traced from sheet A1.2 "Proposed Main Floor Plan" (scale 1/4" = 1'-0").
// Everything here is in FEET, measured on the drawing.
//
// Plan coordinates: X runs east (left to right on the sheet), N runs north (up
// the sheet). The origin is the outside south-west corner of the house, where
// the great room meets the deck. In three.js: x = X ft, y = up, z = -N ft
// (converted to metres by FT below), so walking "up the sheet" is walking down
// the negative z axis, which is where a three.js camera looks by default.

export const FT = 0.3048; // metres per foot

export const PAPER = '#f2efe8';
export const INK = '#16161a';
export const ACCENT = '#b3302e'; // the red of the annotations on the drawing

export const CEIL = 9; // ceiling height, ft
export const SLAB_TOP = 10; // top of the roof slab, ft
export const LAWN = -5.6; // the yard south of the deck sits nine risers below the deck
export const DECK = -0.2; // top of the composite deck
export const CUT_PLAN = 3.94; // 1.2 m: where an architect cuts a plan
export const DOOR_H = 6.67; // 6'-8"
export const SILL = 2.5;

// ---------------------------------------------------------------------------
// Walls
// ax: 'x' = the wall runs east-west at N = c; 'n' = runs north-south at X = c.
// a..b along the run, t = thickness. ops = openings along the run.
//   door: opening to DOOR_H     window: sill..head with glass
//   open: framed opening to 8'  garage: overhead door, panel closed
// ---------------------------------------------------------------------------
const E = 0.5; // exterior wall
const I = 0.4; // interior wall

export const WALLS = [
  // north side: garage / mud room line and the bedroom + bath block
  { ax: 'x', c: 32.0, a: 0, b: 23.0, t: E, ops: [{ a: 12.5, b: 15.5, k: 'door' }, { a: 17.2, b: 20.2, k: 'door' }] },
  { ax: 'x', c: 32.0, a: 29.75, b: 56.1, t: E, ops: [{ a: 34.4, b: 37.25, k: 'window' }, { a: 48.75, b: 51.5, k: 'window', sill: 4.5 }] },
  // garage north wall
  { ax: 'x', c: 55.5, a: 0, b: 23.0, t: E, ops: [] },
  // south: great room (W1 · D1 · W1) and dining/kitchen (W1 · D1 · W1)
  { ax: 'x', c: 0.25, a: 0, b: 16.6, t: E, ops: [{ a: 1.1, b: 3.6, k: 'window' }, { a: 5.4, b: 11.4, k: 'slider' }, { a: 13.1, b: 15.5, k: 'window' }] },
  { ax: 'x', c: 0.25, a: 29.75, b: 56.1, t: E, ops: [{ a: 32.75, b: 35.1, k: 'window' }, { a: 40.0, b: 46.0, k: 'slider' }, { a: 53.2, b: 55.4, k: 'window', sill: 4 }] },
  // foyer, south (W2 · D1 · W2) and north (W2 · D3 · W2)
  { ax: 'x', c: 5.2, a: 16.6, b: 29.75, t: 0.45, ops: [{ a: 17.1, b: 19.0, k: 'window' }, { a: 20.25, b: 26.25, k: 'open', h: DOOR_H }, { a: 27.5, b: 29.5, k: 'window' }] },
  { ax: 'x', c: 21.7, a: 16.6, b: 29.75, t: 0.45, ops: [{ a: 17.6, b: 19.5, k: 'window' }, { a: 21.75, b: 24.75, k: 'door' }, { a: 26.9, b: 28.75, k: 'window' }] },
  // mud room / stair, with the wide opening by the top of the stair
  { ax: 'x', c: 25.25, a: 0.5, b: 16.1, t: I, ops: [{ a: 11.6, b: 16.0, k: 'open', h: DOOR_H }] },
  // great-room stair: wall around the inside of the L
  { ax: 'x', c: 21.25, a: 4.0, b: 11.4, t: 0.35, ops: [] },
  // east block
  { ax: 'x', c: 21.7, a: 30.25, b: 42.9, t: I, ops: [] }, // bedroom south
  { ax: 'x', c: 27.1, a: 42.9, b: 46.45, t: 0.3, ops: [] }, // closet south
  { ax: 'x', c: 20.55, a: 46.45, b: 55.6, t: 0.5, ops: [] }, // bath south
  { ax: 'x', c: 15.05, a: 46.45, b: 55.6, t: 0.35, ops: [] }, // pantry south

  // west exterior, house + garage (W1 at the mud room)
  { ax: 'n', c: 0.25, a: 0, b: 55.75, t: E, ops: [{ a: 27.4, b: 29.75, k: 'window', sill: 3 }] },
  // garage east wall with the 16' overhead door (D9)
  { ax: 'n', c: 22.75, a: 32.25, b: 55.75, t: E, ops: [{ a: 35.75, b: 51.75, k: 'garage' }] },
  // great room / foyer, framed opening; mud room door to the covered deck
  { ax: 'n', c: 16.35, a: 0, b: 32.25, t: E, ops: [{ a: 5.45, b: 10.5, k: 'open' }, { a: 28.75, b: 31.5, k: 'door' }] },
  // foyer / east block, framed opening into dining; bedroom window onto the covered deck
  { ax: 'n', c: 30.0, a: 0, b: 32.25, t: E, ops: [{ a: 5.45, b: 10.5, k: 'open' }, { a: 25.4, b: 28.4, k: 'window', sill: 3 }] },
  { ax: 'n', c: 30.62, a: 10.5, b: 21.5, t: 0.75, ops: [] }, // the hatched wall along the stair
  { ax: 'n', c: 42.75, a: 21.5, b: 32.0, t: 0.3, ops: [{ a: 22.5, b: 25.5, k: 'door' }, { a: 29.1, b: 31.6, k: 'open', h: DOOR_H }] },
  { ax: 'n', c: 46.6, a: 20.3, b: 32.0, t: 0.3, ops: [{ a: 21.6, b: 24.4, k: 'door' }] },
  { ax: 'n', c: 46.6, a: 14.9, b: 20.3, t: 0.3, ops: [{ a: 16.25, b: 19.2, k: 'door' }] },
  { ax: 'n', c: 34.75, a: 10.6, b: 21.5, t: 0.4, ops: [] }, // stair divider
  { ax: 'n', c: 38.55, a: 10.6, b: 21.5, t: 0.35, ops: [] }, // stair east wall
  // east exterior (W5 · W5 at the kitchen)
  { ax: 'n', c: 55.85, a: 0, b: 32.25, t: E, ops: [{ a: 3.25, b: 5.6, k: 'window', sill: 3.5 }, { a: 9.1, b: 11.5, k: 'window', sill: 3.5 }] },
  // great-room stair: inner wall of the L
  { ax: 'n', c: 4.2, a: 13.0, b: 21.4, t: 0.35, ops: [] },
];

// ---------------------------------------------------------------------------
// Rooms the camera walks through. They tile the walk area to wall centre
// lines. Each one stays a drawing until the camera reaches it, then its
// materials sweep in along `dir` (in plan: [dX, dN]).
// Index 0 is "outside": everything not inside the house footprint.
// ---------------------------------------------------------------------------
export const WALK = [
  { key: 'out', name: 'OUTSIDE' },
  { key: 'foyer', box: [16.35, 5.2, 30.0, 21.7], dir: [0, 1] },
  { key: 'great', box: [0, 0, 16.35, 25.25], dir: [-1, 0] },
  { key: 'kitchen', box: [30.0, 0, 56.1, 15.05], dir: [1, 0] },
];

// The house footprint (anything here that is not a walk room stays ink).
export const HOUSE = [
  [0, 0, 16.35, 32.25],
  [16.35, 5.2, 30.0, 21.7],
  [30.0, 0, 56.1, 32.25],
  [0, 32.0, 23.0, 55.75],
];

// Room labels, as they read on the drawing.
export const LABELS = [
  { room: 'great', t: 'GREAT ROOM', d: "15'-8\" × 21'-3¼\"", X: 9.0, N: 10.2 },
  { room: 'foyer', t: 'ENTRY / FOYER', d: "13'-5½\" × 16'-0\"", X: 23.2, N: 14.6 },
  { room: 'kitchen', t: 'DINING AREA', d: "25'-4\" × 14'-6\"", X: 37.9, N: 10.6 },
  { room: 'kitchen', t: 'KITCHEN', d: 'ISLAND 6\'-0" × 4\'-0"', X: 51.6, N: 10.6 },
  { room: 'none', t: 'MUD ROOM', d: "15'-8\" × 6'-4\"", X: 8.0, N: 28.6 },
  { room: 'none', t: 'BEDROOM-01', d: "12'-2\" × 10'-0\"", X: 36.0, N: 23.4 },
  { room: 'none', t: 'BATHROOM-01', d: "8'-10\" × 11'-0\"", X: 51.6, N: 23.0 },
  { room: 'none', t: 'WALK-IN PANTRY', d: "8'-10\" × 5'-0\"", X: 51.1, N: 17.8 },
  { room: 'none', t: 'CLOSET', d: "3'-8\" × 4'-6\"", X: 44.7, N: 29.5, small: true },
  { room: 'none', t: '2-CAR GARAGE', d: "22'-0\" × 23'-0\"", X: 11.5, N: 43.9 },
  { room: 'out', t: 'COMPOSITE DECK', d: "48'-0\" × 11'-10\"", X: 9.0, N: -5.4 },
  { room: 'out', t: 'COMPOSITE DECK', d: 'SLOPE 1.5% MAX.', X: 39.0, N: -5.4 },
  { room: 'out', t: 'COVERED DECK', d: "13'-1½\" × 10'-0\"", X: 23.2, N: 27.4 },
  { room: 'out', t: 'GRILLING AREA', d: "7'-5½\" × 6'-0\"", X: 52.0, N: -14.0, small: true },
];

// Swing doors drawn standing open: hinge (X, N), radius, closed and open
// angles in degrees (0 = east, 90 = north), and the room whose reveal they follow.
export const SWINGS = [
  { X: 15.5, N: 31.75, r: 3, closed: 180, open: 270, room: 'none' }, // mud room to garage
  { X: 20.2, N: 32.25, r: 3, closed: 180, open: 90, room: 'none' }, // garage to covered deck
  { X: 16.1, N: 31.5, r: 2.75, closed: 270, open: 180, room: 'none' }, // mud room to covered deck
  { X: 24.75, N: 21.95, r: 3, closed: 180, open: 90, room: 'foyer' }, // D3, foyer to covered deck
  { X: 42.6, N: 22.5, r: 3, closed: 90, open: 180, room: 'none' }, // bedroom
  { X: 46.75, N: 21.6, r: 2.8, closed: 90, open: 0, room: 'none' }, // bathroom
];

// Stairs. The great-room stair is an L: eight treads west along the top, then
// nine south down the west wall, up to the second floor. The east stair is a
// straight run up, beside a run down to the basement.
export const RISE = 0.58;

// The deck, the grilling area and the stair down to the yard.
export const DECKS = {
  main: [0, -11.83, 48.3, 0],
  notch: [16.6, 0, 29.75, 5.2],
  grill: [48.3, -17.83, 55.8, -11.83],
  covered: [16.6, 21.7, 29.75, 32.0],
  stair: { x0: 19.45, x1: 27.45, top: -11.83, run: 0.98, risers: 9 },
};

// Railing posts along the south edge of the deck, from the drawing.
export const RAIL_POSTS = [0, 4.1, 8.0, 11.9, 16.0, 19.45, 27.45, 30.6, 38.15, 43.0, 48.3];

// Trees around the house. r = canopy radius (ft).
export const TREES = [
  { X: -18, N: -8, r: 9, h: 26, seed: 1 },
  { X: -19, N: 22, r: 10, h: 30, seed: 2 },
  { X: -17, N: 50, r: 8, h: 24, seed: 3 },
  { X: 76, N: -6, r: 10, h: 30, seed: 4 },
  { X: 75, N: 24, r: 8, h: 24, seed: 5 },
  { X: -8, N: -42, r: 7, h: 22, seed: 6 },
  { X: 56, N: -42, r: 8, h: 26, seed: 7 },
  { X: 42, N: 66, r: 9, h: 28, seed: 8 },
];

export const PROJECT = {
  title: 'Residential New Construction',
  place: 'The Lake House',
  sheet: 'A1.2',
  drawing: 'Proposed Main Floor Plan',
  scale: '1/4" = 1\'-0"',
};
