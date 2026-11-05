// Walk-through variations. Pick one with ?route=a|b|c|d (default a).
//
// Every route shares the first half of the page (sheet, cut, descent, landing
// in the yard and the climb up the deck stair, s = 0 to 0.62). They differ in
// what happens on foot after that.
//
//   walk     [s, X ft, N ft, yaw deg (0 = north, + = turn left / west), pitch deg]
//   reveal   room -> [s it starts, how long the sweep takes]
//   caps     caption -> [s in, s out] (out = null keeps it to the end)
//   rail     the progress rail on the right, in visiting order

const START = [
  [0.5, 23.1, -34, 0, 0],
  [0.555, 23.1, -23.5, 0, 4],
  [0.62, 23.1, -12.4, 0, 0], // top of the deck stair
];

export const ROUTES = {
  // A. The original: foyer -> great room -> back through the foyer -> dining, kitchen
  a: {
    name: 'A · Foyer first (original)',
    walk: [
      ...START,
      [0.675, 24.7, -3.0, 0, -2],
      [0.735, 24.4, 7.4, 8, -3],
      [0.775, 21.0, 8.1, 72, -4],
      [0.815, 14.4, 11.6, 104, -7],
      [0.85, 11.6, 14.6, 142, -12],
      [0.875, 13.0, 9.6, 232, -2],
      [0.9, 19.4, 7.9, 262, -5],
      [0.93, 27.0, 7.9, 266, -5],
      [0.96, 33.6, 8.3, 268, -7],
      [1.0, 37.6, 8.7, 256, -9],
    ],
    reveal: { foyer: [0.69, 0.075], great: [0.765, 0.065], kitchen: [0.885, 0.07] },
    caps: { deck: [0.53, 0.66], foyer: [0.71, 0.762], great: [0.795, 0.875], kitchen: [0.915, null] },
    rail: [['04 Deck', 0.5], ['05 Foyer', 0.7], ['06 Great room', 0.77], ['07 Kitchen', 0.88]],
  },

  // B. Kitchen first: along the deck to the east slider, dining and kitchen,
  //    west through the foyer, and end in the great room facing the evening sun
  b: {
    name: 'B · Kitchen first, end on the sunset',
    walk: [
      ...START,
      [0.645, 28.0, -6.5, -70, -2], // turn east while still out in the open
      [0.67, 33.0, -1.9, -90, -2], // east along the deck, facing the way we walk
      [0.69, 41.8, -1.9, -88, -2],
      [0.71, 44.3, -1.3, -10, -3], // turn into the dining slider
      [0.735, 44.4, 3.0, 0, -4], // through its open half
      [0.77, 44.0, 8.4, -55, -8], // the island and the uppers
      [0.8, 43.0, 8.8, 40, -6], // swing round over the table
      [0.835, 34.5, 8.6, 85, -5],
      [0.865, 27.0, 8.4, 70, -3], // foyer
      [0.9, 19.5, 8.0, 90, -4], // into the great room
      [0.94, 14.5, 11.5, 125, -8],
      [1.0, 11.0, 13.0, 160, -8], // behind the sofa, looking out the south windows
    ],
    reveal: { kitchen: [0.655, 0.075], foyer: [0.84, 0.06], great: [0.88, 0.065] },
    caps: { deck: [0.53, 0.645], kitchen: [0.735, 0.825], foyer: [0.845, 0.885], great: [0.91, null] },
    rail: [['04 Deck', 0.5], ['05 Kitchen', 0.69], ['06 Foyer', 0.84], ['07 Great room', 0.88]],
  },

  // C. Great room first: west along the deck, in through the great-room slider,
  //    across the foyer, and end in the kitchen
  c: {
    name: 'C · Great room first',
    walk: [
      ...START,
      [0.645, 19.5, -6.5, 70, -2], // turn west while still out in the open
      [0.67, 15.0, -1.9, 90, -2], // west along the deck, facing the way we walk
      [0.69, 12.0, -1.9, 88, -2],
      [0.705, 10.0, -1.2, 15, -3], // turn into the great-room slider
      [0.735, 10.4, 2.8, 30, -6], // through its open half, between the coffee table and the armchair
      [0.765, 14.9, 6.0, 150, -7], // up the east side, looking back at the south windows
      [0.795, 15.0, 10.6, 135, -9], // behind the sofa: the room and the evening sun
      [0.815, 15.0, 8.2, 10, -5],
      [0.84, 20.0, 7.9, -88, -4], // foyer
      [0.875, 27.0, 7.9, -94, -5],
      [0.925, 33.6, 8.3, -92, -7],
      [1.0, 37.6, 8.9, -104, -9],
    ],
    reveal: { great: [0.665, 0.07], foyer: [0.81, 0.06], kitchen: [0.865, 0.07] },
    caps: { deck: [0.53, 0.66], great: [0.715, 0.8], foyer: [0.82, 0.86], kitchen: [0.895, null] },
    rail: [['04 Deck', 0.5], ['05 Great room', 0.7], ['06 Foyer', 0.81], ['07 Kitchen', 0.865]],
  },

  // D. Stand and look: walk into the foyer, stop in the middle, pan left into
  //    the great room, pan right across to the dining room, then walk east
  d: {
    name: 'D · Foyer panorama',
    walk: [
      ...START,
      [0.675, 24.7, -3.0, 0, -2],
      [0.735, 24.4, 7.4, 8, -3],
      [0.78, 23.2, 8.2, 80, -4], // look left through the opening into the great room
      [0.81, 22.4, 8.0, 95, -6],
      [0.86, 23.4, 8.0, -85, -5], // pan right across the foyer
      [0.92, 31.5, 8.2, -92, -6],
      [1.0, 40.0, 9.6, -110, -10], // the table and the island
    ],
    reveal: { foyer: [0.69, 0.075], great: [0.76, 0.06], kitchen: [0.85, 0.07] },
    caps: { deck: [0.53, 0.66], foyer: [0.71, 0.76], great: [0.775, 0.84], kitchen: [0.875, null] },
    rail: [['04 Deck', 0.5], ['05 Foyer', 0.7], ['06 Great room', 0.76], ['07 Kitchen', 0.85]],
  },
};

// ?route=b, or #route-b (hosts that drop the query string, like a claude.ai artifact, keep the hash)
export function pickRoute() {
  const q = new URLSearchParams(location.search).get('route');
  const h = (location.hash.match(/^#route-([a-z])$/) || [])[1];
  const id = q || h;
  return ROUTES[id] ? id : 'a';
}
