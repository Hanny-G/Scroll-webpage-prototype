// The lot: street side up at the main floor, falling away south to the lake.
//
// The elevations show the ground about level with the main floor along the street
// (north) and the basement walking out under the deck to a paver patio on the lake
// side (south). The exact contours aren't on the sheets we have, so this is a gentle,
// believable grade that honours those three facts:
//   - north of the house the yard sits just under the main floor (-0'-4")
//   - the deck stair lands on a lawn terrace nine risers down (-5'-7")
//   - east of the stair the patio sits at the basement floor (-9'-2"), held by a
//     retaining wall, and the lawn runs on down to the shore.
// Everything here is in feet, like plan.js.

import * as THREE from 'three';
import { FT, BASE_FLOOR, HOUSE } from './plan.js';

export const WATER = -13.0; // lake level
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the terrace grade west of the patio
function terrace(N) {
  if (N >= 33) return -0.3;
  if (N >= -12) return -0.3 + (-5.6 + 0.3) * ((33 - N) / 45);
  if (N >= -26) return -5.6;
  return Math.max(-16, -5.6 - (-26 - N) * 0.2);
}
// the patio and the lawn below it
function patio(N) {
  if (N >= -14) return BASE_FLOOR - 0.05;
  return Math.max(-16, BASE_FLOOR - 0.05 - (-14 - N) * 0.11);
}
export const WALL_X = 29.0; // the retaining wall between the terrace and the patio

export function groundH(X, N) {
  // under the house: well below everything, hidden by the foundation
  for (const h of HOUSE) if (X > h[0] - 0.4 && X < h[2] + 0.4 && N > h[1] - 0.4 && N < h[3] + 0.4) return -9.8;
  if (X > 16 && X < 30.5 && N > 21.5 && N < 33) return -0.45; // under the north composite deck: fill, at grade
  const t = terrace(N);
  if (N > 0 && N < 33 && X > 56) return Math.min(t, -0.3 + (BASE_FLOOR + 0.3) * sm(33, 2, N)); // east side, down to the egress window
  if (X > WALL_X && N <= 0) return Math.min(t, patio(N)); // the patio side
  return t;
}

export function buildTerrain(material, { X0 = -170, X1 = 230, N0 = -230, N1 = 170, step = 2 } = {}) {
  const nx = Math.round((X1 - X0) / step), nn = Math.round((N1 - N0) / step);
  const g = new THREE.PlaneGeometry((X1 - X0) * FT, (N1 - N0) * FT, nx, nn);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i) / FT + (X0 + X1) / 2, N = -p.getZ(i) / FT + (N0 + N1) / 2;
    p.setXYZ(i, X * FT, groundH(X, N) * FT, -N * FT);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

export function buildWater(material) {
  const g = new THREE.PlaneGeometry(3000, 3000);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, material);
  m.position.set(28 * FT, WATER * FT, 1500 + 50 * FT); // from N -50 southwards (z = -N); the lawn hides it until the shore
  return m;
}
