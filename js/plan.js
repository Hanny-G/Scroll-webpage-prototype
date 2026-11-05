// The house, as numbers.
//
// Traced from the permit set dated July 3, 2026 (Clayborn Engineering): sheet A1.2 "Proposed Main Floor Plan", A1.3 "Proposed Second Floor
// Plan", A2.1-A2.4 elevations and A3.1-A3.2 roof plans, all at 1/4" = 1'-0".
// The wall positions below were read from the drawing's own vector geometry,
// so they are exact to the drawing, not measured off a picture.
//
// Everything here is in FEET. Plan coordinates: X runs east (left to right on
// the sheet), N runs north (up the sheet). The origin is the outside south-west
// corner of the house, where the great room meets the deck. In three.js:
// x = X ft, y = up, z = -N ft (converted to metres by FT below), so walking
// "up the sheet" is walking down the negative z axis, which is where a three.js
// camera looks by default.

export const FT = 0.3048; // metres per foot

export const PAPER = '#f2efe8';
export const INK = '#16161a';
export const ACCENT = '#b3302e'; // the red of the annotations on the drawing

export const CEIL = 8; // main floor ceiling, 8'-0" (A2.x "main floor ceiling line")
export const F2 = 9.17; // second floor finish, 8'-0" + 1'-2" floor structure
export const EAVE = 17.6; // top of the second floor walls, where the roofs start
export const LAWN = -5.6; // the yard south of the deck sits nine risers below the deck
export const DECK = -0.2; // top of the composite deck
export const CUT_PLAN = 3.94; // 1.2 m: where an architect cuts a plan
export const DOOR_H = 6.67; // 6'-8"
export const SILL = 2.42; // W1 windows: 2'-6" x 4'-3" under a 6'-8" head
export const OPEN_H = 7; // framed openings

// ---------------------------------------------------------------------------
// Walls
// ax: 'x' = the wall runs east-west at N = c; 'n' = runs north-south at X = c.
// a..b along the run, t = thickness. ops = openings along the run.
//   door: opening to DOOR_H            window: sill..head with glass
//   open: framed opening to h          garage: overhead door, panel closed
//   slider: 6'-0" glass slider (D1), one leaf slid open on the `open` side
// y0/y1 (optional): bottom and top of the wall; openings are measured from y0.
// ---------------------------------------------------------------------------
const E = 0.46; // exterior wall (5½")
const I = 0.29; // interior wall (3½")

export const WALLS = [
  // north: garage / mud room line, then the bedroom + bath block (two EWO egress windows)
  { ax: 'x', c: 32.0, a: 0, b: 23.0, t: E, ops: [{ a: 12.5, b: 15.5, k: 'door' }, { a: 17.0, b: 20.0, k: 'door' }] },
  { ax: 'x', c: 32.1, a: 29.8, b: 56.13, t: E, ops: [{ a: 34.3, b: 37.3, k: 'window', sill: 1.5 }, { a: 48.63, b: 51.63, k: 'window', sill: 1.5 }] },
  // garage north wall
  { ax: 'x', c: 55.54, a: 0, b: 23.0, t: E, ops: [] },
  // south: great room (W1 · D1 · W1) and dining/kitchen (W1 · D1 · W1)
  { ax: 'x', c: 0.23, a: 0, b: 16.67, t: E, ops: [{ a: 1.15, b: 3.65, k: 'window' }, { a: 5.33, b: 11.33, k: 'slider', open: 'e' }, { a: 13.02, b: 15.52, k: 'window' }] },
  { ax: 'x', c: 0.23, a: 29.8, b: 56.13, t: E, ops: [{ a: 32.63, b: 35.13, k: 'window' }, { a: 39.97, b: 45.97, k: 'slider', open: 'e' }, { a: 50.8, b: 53.3, k: 'window' }] },
  // foyer, south (W2 · D1 · W2) and north (W2 · D3 · W2). W2 is a full-height 2'-4" x 6'-8" light.
  { ax: 'x', c: 5.23, a: 16.21, b: 30.26, t: E, ops: [{ a: 17.0, b: 19.0, k: 'window', sill: 0.1 }, { a: 20.23, b: 26.23, k: 'slider', open: 'e' }, { a: 27.47, b: 29.47, k: 'window', sill: 0.1 }] },
  { ax: 'x', c: 21.75, a: 16.21, b: 30.26, t: 0.5, ops: [{ a: 17.57, b: 19.57, k: 'window', sill: 0.1 }, { a: 21.73, b: 24.73, k: 'door' }, { a: 26.9, b: 28.9, k: 'window', sill: 0.1 }] },
  // mud room / stair hall, with the wide opening by the foot of the stair
  { ax: 'x', c: 25.25, a: 0.46, b: 16.21, t: I, ops: [{ a: 11.33, b: 16.21, k: 'open', h: DOOR_H }] },
  // great-room stair: the walls around the L
  { ax: 'x', c: 21.47, a: 4.0, b: 11.33, t: I, ops: [] },
  { ax: 'x', c: 13.21, a: 0.46, b: 4.29, t: I, ops: [] },
  { ax: 'n', c: 4.15, a: 13.36, b: 21.32, t: I, ops: [] },
  // east block
  { ax: 'x', c: 21.65, a: 30.26, b: 42.8, t: I, ops: [] }, // bedroom south
  { ax: 'x', c: 27.15, a: 42.8, b: 46.34, t: I, ops: [] }, // closet south
  { ax: 'x', c: 20.6, a: 46.51, b: 55.67, t: E, ops: [] }, // bath south (plumbing wall)
  { ax: 'x', c: 15.19, a: 46.51, b: 55.67, t: I, ops: [] }, // pantry south

  // west exterior, house + garage (W1 at the mud room)
  { ax: 'n', c: 0.23, a: 0, b: 55.77, t: E, ops: [{ a: 27.35, b: 29.85, k: 'window' }] },
  // garage east wall with the 16'-0" x 7'-0" overhead door (D9)
  { ax: 'n', c: 22.78, a: 32.23, b: 55.77, t: E, ops: [{ a: 35.77, b: 51.77, k: 'garage' }] },
  // great room / foyer: exterior to the south, a 5'-0" framed opening, exterior again to the north deck
  { ax: 'n', c: 16.44, a: 0, b: 5.0, t: E, ops: [] },
  { ax: 'n', c: 16.36, a: 5.0, b: 21.5, t: I, ops: [{ a: 5.46, b: 10.46, k: 'open', h: OPEN_H }] },
  { ax: 'n', c: 16.44, a: 22.0, b: 32.0, t: E, ops: [] },
  // foyer / east block: the same, plus the bedroom window onto the north deck
  { ax: 'n', c: 30.03, a: 0, b: 5.0, t: E, ops: [] },
  { ax: 'n', c: 30.15, a: 5.0, b: 21.5, t: I, ops: [{ a: 5.46, b: 10.46, k: 'open', h: OPEN_H }] },
  { ax: 'n', c: 30.03, a: 22.0, b: 32.1, t: E, ops: [{ a: 25.41, b: 28.41, k: 'window', sill: 3 }] },
  { ax: 'n', c: 30.66, a: 10.46, b: 21.5, t: 0.72, ops: [] }, // the hatched VOID along the stair
  { ax: 'n', c: 34.7, a: 10.63, b: 17.97, t: I, ops: [] }, // stair divider, stops at the landing
  { ax: 'n', c: 38.48, a: 10.63, b: 21.5, t: I, ops: [] }, // stair east wall
  { ax: 'n', c: 42.65, a: 21.5, b: 32.1, t: I, ops: [{ a: 22.5, b: 25.5, k: 'door' }, { a: 29.17, b: 31.17, k: 'door' }] }, // bedroom east (D2, D7 barn)
  { ax: 'n', c: 46.65, a: 20.6, b: 27.15, t: I, ops: [{ a: 21.33, b: 24.32, k: 'door' }] }, // bath west
  { ax: 'n', c: 46.57, a: 27.15, b: 32.1, t: E, ops: [] }, // bath west (vanity wall)
  { ax: 'n', c: 46.65, a: 15.04, b: 20.6, t: I, ops: [{ a: 15.83, b: 18.83, k: 'door' }] }, // pantry (D4 barn)
  // east exterior (W5 · W5 at the kitchen, 2'-6" x 3'-8")
  { ax: 'n', c: 55.9, a: 0, b: 32.33, t: E, ops: [{ a: 3.26, b: 5.76, k: 'window', sill: 3 }, { a: 9.09, b: 11.59, k: 'window', sill: 3 }] },
];

// Second floor (A1.3): only the outside walls and their windows are modelled,
// so the house reads right from the yard. Same footprint as the floor below.
const UP = { y0: F2, y1: EAVE, t: E };
export const WALLS_UP = [
  { ...UP, ax: 'x', c: 0.23, a: 0, b: 16.67, ops: [{ a: 4.59, b: 12.09, k: 'window' }] }, // W3, 7'-6" wide
  { ...UP, ax: 'x', c: 0.23, a: 29.8, b: 56.13, ops: [{ a: 32.63, b: 35.13, k: 'window' }, { a: 39.21, b: 46.71, k: 'window' }, { a: 50.8, b: 53.3, k: 'window' }] },
  { ...UP, ax: 'x', c: 5.23, a: 16.21, b: 30.26, ops: [{ a: 22.0, b: 24.5, k: 'window', sill: 3.67 }] }, // W4 casement
  { ...UP, ax: 'x', c: 21.77, a: 16.21, b: 30.26, ops: [{ a: 21.73, b: 24.73, k: 'window', sill: 1.5 }] }, // EWO
  { ...UP, ax: 'x', c: 32.0, a: 0, b: 16.67, ops: [{ a: 7.09, b: 9.59, k: 'window', sill: 3.67 }] }, // W4a
  { ...UP, ax: 'x', c: 32.1, a: 29.8, b: 56.13, ops: [{ a: 34.3, b: 37.3, k: 'window', sill: 1.5 }, { a: 48.63, b: 51.63, k: 'window', sill: 1.5 }] },
  { ...UP, ax: 'n', c: 0.23, a: 0, b: 32.23, ops: [{ a: 4.0, b: 6.5, k: 'window' }] },
  { ...UP, ax: 'n', c: 55.9, a: 0, b: 32.33, ops: [{ a: 5.25, b: 8.25, k: 'window', sill: 1.5 }, { a: 24.08, b: 27.08, k: 'window', sill: 1.5 }] },
  { ...UP, ax: 'n', c: 16.44, a: 0, b: 5.0, ops: [] },
  { ...UP, ax: 'n', c: 16.44, a: 22.0, b: 32.23, ops: [] },
  { ...UP, ax: 'n', c: 30.03, a: 0, b: 5.0, ops: [] },
  { ...UP, ax: 'n', c: 30.03, a: 22.0, b: 32.33, ops: [] },
];

// Roofs (A3.1, A3.2). Pitch is rise per foot of run; overhangs are 1'-4".
export const ROOFS = {
  oh: 1.33,
  west: { X0: 0, N0: 0, X1: 16.67, N1: 32.23, pitch: 1 }, // 12/12, ridge north-south
  east: { X0: 29.8, N0: 0, X1: 56.13, N1: 32.33, pitch: 1 }, // 12/12, ridge north-south
  middle: { X0: 16.67, N0: 5.0, X1: 29.8, N1: 22.0, pitch: 8 / 12 }, // 8/12, ridge east-west, valleys into both gables
  garage: { X0: 0, N0: 32.23, X1: 23.0, N1: 55.77, pitch: 8 / 12, eave: 8.6 }, // 8/12, ridge north-south
  porch: { X0: -0.5, X1: 56.6, N: -12.3, top: 10.3, pitch: 3 / 12, well: [19.2, 27.2] }, // 3/12 over the whole deck
  grill: { X0: 46.85, X1: 57.45, N: -19.5, eave: 7.0, pitch: 4 / 12 }, // 4/12 gable over the grilling area
};

// ---------------------------------------------------------------------------
// Rooms the camera walks through. They tile the walk area to wall centre
// lines. Each one stays a drawing until the camera reaches it, then its
// materials sweep in along `dir` (in plan: [dX, dN]).
// Index 0 is "outside": everything not inside the house footprint.
// ---------------------------------------------------------------------------
export const WALK = [
  { key: 'out', name: 'OUTSIDE' },
  { key: 'foyer', box: [16.36, 5.23, 30.15, 21.75], dir: [0, 1] },
  { key: 'great', box: [0, 0, 16.36, 25.25], dir: [-1, 0] },
  { key: 'kitchen', box: [30.15, 0, 56.13, 15.19], dir: [1, 0] },
];

// The house footprint (anything here that is not a walk room stays ink).
export const HOUSE = [
  [0, 0, 16.67, 32.23],
  [16.67, 5.0, 29.8, 22.0],
  [29.8, 0, 56.13, 32.33],
  [0, 32.23, 23.0, 55.77],
];

// Room labels, as they read on the drawing.
export const LABELS = [
  { room: 'great', t: 'GREAT ROOM', d: "15'-9\" × 21'-3¾\"", X: 9.0, N: 10.2 },
  { room: 'foyer', t: 'ENTRY / FOYER', d: "13'-6\" × 16'-0½\"", X: 23.2, N: 14.6 },
  { room: 'kitchen', t: 'DINING AREA', d: "25'-5\" × 14'-7\"", X: 37.9, N: 10.6 },
  { room: 'kitchen', t: 'KITCHEN', d: 'ISLAND TABLE 6\'-0" × 4\'-0"', X: 51.8, N: 10.9 },
  { room: 'none', t: 'MUD ROOM', d: "15'-8½\" × 6'-4½\"", X: 8.0, N: 28.6 },
  { room: 'none', t: 'BEDROOM-01', d: "12'-3\" × 10'-1\"", X: 36.0, N: 23.4 },
  { room: 'none', t: 'BATHROOM-01', d: "8'-10½\" × 11'-0½\"", X: 51.6, N: 23.0 },
  { room: 'none', t: 'WALK-IN PANTRY', d: "8'-10½\" × 5'-0\"", X: 51.1, N: 17.8 },
  { room: 'none', t: 'CLOSET', d: "3'-6½\" × 4'-7\"", X: 44.6, N: 29.5, small: true },
  { room: 'none', t: '2-CAR GARAGE', d: "22'-1\" × 23'-1\"", X: 11.5, N: 43.9 },
  { room: 'out', t: 'COMPOSITE DECK', d: "48'-0\" × 11'-10\"", X: 9.0, N: -5.4 },
  { room: 'out', t: 'COMPOSITE DECK', d: 'AZEK TIMBERTECH · SLOPE 1.5% MAX.', X: 39.0, N: -5.4 },
  { room: 'out', t: 'COMPOSITE DECK', d: 'SLOPE 1.5% MAX.', X: 23.2, N: 27.4 },
  { room: 'out', t: 'GRILLING AREA', d: "7'-5½\" × 6'-0\"", X: 52.0, N: -14.0, small: true },
];

// Swing doors drawn standing open: hinge (X, N), radius, closed and open
// angles in degrees (0 = east, 90 = north), and the room whose reveal they follow.
export const SWINGS = [
  { X: 15.5, N: 31.77, r: 3, closed: 180, open: 270, room: 'none' }, // D2 mud room to garage
  { X: 20.0, N: 32.23, r: 3, closed: 180, open: 90, room: 'none' }, // D2 garage to the north deck
  { X: 24.73, N: 22.0, r: 3, closed: 180, open: 90, room: 'foyer' }, // D3 foyer to the north deck
  { X: 42.5, N: 22.5, r: 3, closed: 90, open: 180, room: 'none' }, // D2 bedroom
  { X: 46.8, N: 21.33, r: 3, closed: 90, open: 0, room: 'none' }, // D2 bathroom
];

// Barn doors (D4 pantry, D7 bedroom closet), drawn slid open beside their openings.
export const BARN = [
  { X0: 46.28, X1: 46.43, N0: 12.85, N1: 15.85 }, // pantry, on the kitchen side
  { X0: 42.36, X1: 42.49, N0: 27.15, N1: 29.15 }, // closet, on the bedroom side
];

// Stairs: 17 risers from the main floor to the second floor.
// The great-room stair is an L: eight treads west along the top, a landing,
// then nine south down the west wall. The east stair climbs nine risers north
// to a landing and turns back south over the stair down to the basement.
export const RISE = F2 / 17;

// The deck, the grilling area and the stair down to the yard.
export const DECKS = {
  main: [0, -11.83, 56.0, 0],
  notch: [16.67, 0, 29.8, 5.0],
  grill: [48.3, -17.83, 56.0, -11.83],
  north: [16.67, 22.0, 29.8, 32.23],
  stair: { x0: 19.1, x1: 27.1, top: -11.83, run: 0.98, risers: 9 },
};

// Railing posts along the south edge of the deck, from the drawing.
export const RAIL_POSTS = [0, 4.08, 8.0, 11.92, 16.0, 19.1, 27.1, 30.2, 37.75, 43.1, 48.3];
// Porch-roof posts along the deck edge, over the foundation sonotubes (S1.1).
export const PORCH_POSTS = [0.3, 8.0, 16.0, 30.2, 37.75, 48.3, 55.7];

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
