// The house, as numbers.
//
// Traced from Clayborn's permit drawing set (July 2026): sheet A1.2 "Proposed Main Floor Plan", A1.3 "Proposed Second Floor
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

export const PAPER = '#f6f5f2'; // Clayborn sheets are white paper
export const INK = '#16161a';
export const ACCENT = '#ad1c33'; // Clayborn red, sampled from the drawings' annotation and logo colour

export const CEIL = 8; // main floor ceiling, 8'-0" (A2.x "main floor ceiling line")
export const F2 = 9.17; // second floor finish, 8'-0" + 1'-2" floor structure
export const EAVE = 18.5; // where the roof planes cross the wall line: 8'-0" ceiling + raised truss heel.
// Checked against A2.1: east ridge 31'-8", west 26'-10", middle 24'-2", as drawn.
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

// Second-floor partitions (A1.3), as boxes [X0, N0, X1, N1], read from the drawing's
// vector geometry like the walls above. Gaps between them are the doors.
export const WALLS_UP_INT = [
  [37.17, 0.46, 37.47, 1.5], [37.17, 4.17, 37.47, 5.17], [30.26, 5.25, 38.47, 5.45], [41.47, 5.17, 42.76, 5.45],
  [42.47, 5.45, 42.76, 9.75], [16.21, 9.75, 26.47, 10.04], [29.47, 9.75, 34.84, 10.04], [38.34, 9.75, 38.63, 21.5],
  [42.47, 9.75, 42.76, 10.87], [16.21, 10.04, 16.5, 21.54], [30.01, 10.04, 30.3, 14.23], [34.55, 10.04, 34.84, 17.96],
  [42.47, 10.87, 55.67, 11.33], [42.47, 11.33, 42.76, 13.83], [4.0, 13.36, 4.29, 17.31], [27.13, 15.0, 30.3, 15.29],
  [27.13, 15.29, 27.43, 16.47], [30.01, 15.29, 30.3, 21.5], [4.0, 17.31, 12.0, 17.61], [42.47, 17.33, 55.67, 17.62],
  [4.0, 17.61, 4.29, 21.31], [27.13, 19.75, 27.43, 21.54], [4.0, 21.31, 12.0, 21.61], [41.97, 21.5, 45.59, 21.79],
  [30.26, 21.54, 38.97, 21.79], [11.71, 21.61, 12.0, 25.11], [42.47, 21.79, 42.76, 26.68], [45.3, 21.79, 45.59, 23.0],
  [0.46, 25.11, 12.67, 25.57], [15.67, 25.11, 16.21, 25.57], [45.3, 25.66, 45.59, 26.71], [42.47, 26.71, 45.59, 26.93],
  [42.47, 26.99, 42.76, 28.16], [45.3, 26.99, 45.59, 31.87], [42.47, 30.83, 42.76, 31.87],
];

// Second-floor room names, as they read on A1.3.
export const LABELS_UP = [
  { t: 'GAME ROOM', X: 8.2, N: 8.6 },
  { t: 'BATHROOM-02', X: 6.4, N: 28.4 },
  { t: 'CLOSET', X: 8.0, N: 19.4, small: true },
  { t: 'BEDROOM-05', X: 21.8, N: 15.4 },
  { t: 'HALLWAY', X: 29.4, N: 7.6 },
  { t: 'BEDROOM-02', X: 36.6, N: 26.6 },
  { t: 'BEDROOM-03', X: 50.6, N: 26.6 },
  { t: 'BATHROOM-03', X: 49.0, N: 14.4 },
  { t: 'BEDROOM-04', X: 49.6, N: 5.4 },
  { t: 'WALK-IN CLOSET', X: 33.4, N: 2.8, small: true },
  { t: 'CLOSET', X: 44.0, N: 29.4, small: true },
  { t: 'CLOSET', X: 44.0, N: 24.4, small: true },
  { t: 'CLOSET', X: 28.6, N: 18.2, small: true },
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
// y = [floor, ceiling] in feet: rooms are stacked, so each is a box in plan and a band in height.
export const BASE_FLOOR = -9.17; // basement floor finish: 8'-0" + 1'-2" below the main floor
export const BASE_CEIL = -1.17; // 8'-0" flat ceiling from the basement floor (A1.2)
export const WALK = [
  { key: 'out', name: 'OUTSIDE' },
  { key: 'foyer', box: [16.36, 5.23, 30.15, 21.75], dir: [0, 1], tint: [0.68, 0.84, 1.02] }, // pale coastal blue walls
  { key: 'great', box: [0, 0, 16.36, 25.25], dir: [-1, 0] },
  { key: 'kitchen', box: [30.15, 0, 56.13, 15.19], dir: [1, 0], tint: [0.7, 0.84, 1.0] }, // pale blue walls
  // the rest of the main floor: bedroom suite and pantry, mud room and stair hall, garage
  { key: 'kitchen', box: [30.15, 15.19, 56.13, 32.33], dir: [0, 1] },
  { key: 'great', box: [0, 25.25, 16.36, 32.23], dir: [0, 1] },
  { key: 'great', box: [0, 32.23, 23.0, 55.77], dir: [0, 1] },
  // the east stair well, from the basement to the second floor: it reveals with the kitchen
  { key: 'kitchen', box: [30.15, 10.4, 38.63, 21.6], dir: [0, 1], y: [-9.17, 17.17] },
  // the whole second floor reveals as one, in its three blocks
  { key: 'upper', box: [0, 0, 16.67, 32.23], dir: [0, -1], y: [9.17, 17.17] },
  { key: 'upper', box: [16.67, 5.0, 29.8, 22.0], dir: [0, -1], y: [9.17, 17.17] },
  { key: 'upper', box: [29.8, 0, 56.13, 32.33], dir: [0, -1], y: [9.17, 17.17] },
  // the basement, under the east block only
  { key: 'lower', box: [29.8, 0, 56.13, 32.33], dir: [0, -1], y: [BASE_FLOOR, BASE_CEIL] },
];

// ---------------------------------------------------------------------------
// Basement (A1.2, left): 14" concrete walls on three sides, a framed walk-out
// wall to the lake (W1 · D1 · W1), mechanical room, laundry, half bath, the
// L-shaped stair and a big open space. Measured off the drawing.
// ---------------------------------------------------------------------------
const C = 1.17; // 14" concrete
const BB = { y0: BASE_FLOOR, y1: BASE_CEIL };
export const WALLS_BASE = [
  { ...BB, ax: 'n', c: 29.8 + C / 2, a: 0, b: 32.33, t: C, ops: [] }, // west, concrete
  { ...BB, ax: 'n', c: 56.13 - C / 2, a: 0, b: 32.33, t: C, ops: [{ a: 3.0, b: 10.0, k: 'window', sill: 0.6 }] }, // east, egress window
  { ...BB, ax: 'x', c: 32.33 - C / 2, a: 29.8, b: 56.13, t: C, ops: [] }, // north, concrete
  { ...BB, ax: 'x', c: 0.23, a: 29.8, b: 56.13, t: 0.46, ops: [{ a: 33.2, b: 35.7, k: 'window' }, { a: 40.0, b: 46.0, k: 'slider', open: 'w' }, { a: 50.9, b: 53.4, k: 'window' }] }, // walk-out to the lake
  { ...BB, ax: 'x', c: 21.6, a: 30.97, b: 42.85, t: 0.35, ops: [{ a: 39.0, b: 42.4, k: 'door' }] }, // mechanical room, south
  { ...BB, ax: 'n', c: 42.85, a: 21.6, b: 31.16, t: 0.35, ops: [] }, // mechanical / laundry
  { ...BB, ax: 'x', c: 25.8, a: 42.85, b: 54.96, t: 0.35, ops: [{ a: 43.0, b: 46.4, k: 'door' }] }, // laundry, south
  { ...BB, ax: 'n', c: 49.5, a: 20.2, b: 25.8, t: 0.35, ops: [{ a: 20.7, b: 23.8, k: 'door' }] }, // half bath, west
  { ...BB, ax: 'x', c: 20.2, a: 49.5, b: 54.96, t: 0.35, ops: [] }, // half bath, south
  { ...BB, ax: 'n', c: 34.7, a: 10.6, b: 17.64, t: 0.29, ops: [] }, // between the two stair runs
  { ...BB, ax: 'n', c: 38.6, a: 10.6, b: 21.6, t: 0.35, ops: [] }, // stair east wall (the TV wall)
];
export const LABELS_BASE = [
  { t: 'OPEN SPACE', X: 46.0, N: 7.4 },
  { t: 'MECHANICAL ROOM', X: 36.8, N: 26.6 },
  { t: 'LAUNDRY ROOM', X: 49.0, N: 29.2, small: true },
  { t: 'HALF BATH-01', X: 52.3, N: 22.9, small: true },
];

// Openings in the floors for the stairs: [X0, N0, X1, N1].
export const WELLS = {
  up: [[0.46, 13.36, 4.0, 21.61], [4.0, 21.61, 11.33, 25.11], [31.02, 10.97, 38.34, 21.36]], // second floor, over both stairs
  down: [[31.02, 10.97, 38.34, 21.36]], // main floor, over the stair to the basement
};

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
  { X: 24.73, N: 21.5, r: 3, closed: 180, open: 268, room: 'foyer' }, // D3 front door, swung open against the foyer wall (A1.2)
  { X: 42.5, N: 22.5, r: 3, closed: 90, open: 180, room: 'none' }, // D2 bedroom
  { X: 46.8, N: 21.33, r: 3, closed: 90, open: 0, room: 'none' }, // D2 bathroom
];

// Barn doors (D4 pantry, D7 bedroom closet), drawn slid open beside their openings.
export const BARN = [
  { X0: 46.28, X1: 46.43, N0: 18.9, N1: 20.5 }, // pantry, slid open along the hall wall
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
// They stand well back (beyond the camera's sweep round the house), framing it rather
// than blocking it: woods behind on the street side and along both neighbours, open to the lake.
export const TREES = [
  { X: -105, N: 40, r: 13, h: 38, seed: 1 }, { X: -118, N: 5, r: 12, h: 34, seed: 2 }, { X: -95, N: 80, r: 14, h: 40, seed: 3 },
  { X: -60, N: 125, r: 13, h: 36, seed: 4 }, { X: -15, N: 140, r: 14, h: 42, seed: 5 }, { X: 35, N: 150, r: 13, h: 38, seed: 6 },
  { X: 85, N: 140, r: 14, h: 40, seed: 7 }, { X: 135, N: 95, r: 13, h: 36, seed: 8 }, { X: 150, N: 50, r: 12, h: 34, seed: 9 },
  { X: 160, N: 5, r: 13, h: 38, seed: 10 }, { X: -125, N: -35, r: 11, h: 30, seed: 11 }, { X: 175, N: -38, r: 12, h: 32, seed: 12 },
];

export const PROJECT = {
  title: 'Residential New Construction',
  place: 'The Lake House', // placeholder: the client's name and address stay off the page
  sheet: 'A1.2',
  drawing: 'Proposed Main Floor Plan',
  scale: '1/4" = 1\'-0"',
};
